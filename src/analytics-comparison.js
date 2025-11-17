// analytics-comparison.js
// Comparison view functions for analytics dashboard

import { supabase } from './config/supabase.js';
import { formatCurrency, toast } from './utils/helpers.js';

// Format currency with K/M suffix
function formatCurrencyCompact(amount, currency = 'GHS') {
  const absAmount = Math.abs(amount);
  let value, suffix;
  
  if (absAmount >= 1000000) {
    value = (amount / 1000000).toFixed(1);
    suffix = 'M';
  } else if (absAmount >= 1000) {
    value = (amount / 1000).toFixed(1);
    if (value.endsWith('.0')) value = value.slice(0, -2);
    suffix = 'K';
  } else {
    return `${currency} ${amount.toFixed(2)}`;
  }
  
  if (value.endsWith('.0')) value = value.slice(0, -2);
  return `${currency} ${value}${suffix}`;
}

function sqlDate(d) {
  return d.toISOString().split('T')[0];
}

// Calculate comparison periods
function getComparisonPeriods(currentStart, currentEnd) {
  const start = new Date(currentStart);
  const end = new Date(currentEnd);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  // MoM (Month over Month)
  const momStart = new Date(start);
  momStart.setMonth(momStart.getMonth() - 1);
  const momEnd = new Date(end);
  momEnd.setMonth(momEnd.getMonth() - 1);

  // QoQ (Quarter over Quarter)
  const qoqStart = new Date(start);
  qoqStart.setMonth(qoqStart.getMonth() - 3);
  const qoqEnd = new Date(end);
  qoqEnd.setMonth(qoqEnd.getMonth() - 3);

  // YoY (Year over Year)
  const yoyStart = new Date(start);
  yoyStart.setFullYear(yoyStart.getFullYear() - 1);
  const yoyEnd = new Date(end);
  yoyEnd.setFullYear(yoyEnd.getFullYear() - 1);

  return {
    current: { start, end },
    mom: { start: momStart, end: momEnd },
    qoq: { start: qoqStart, end: qoqEnd },
    yoy: { start: yoyStart, end: yoyEnd }
  };
}

// Helper to format change percentage
function formatChange(current, previous) {
  if (!previous || previous === 0) return { text: 'N/A', className: 'neutral' };
  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const className = isPositive ? 'positive' : 'negative';
  const arrow = isPositive ? '↑' : '↓';
  return {
    text: `${arrow} ${Math.abs(change).toFixed(1)}%`,
    className,
    change
  };
}

// Render comparison metric card
function renderComparisonCard(label, current, mom, qoq, yoy, formatter = (v) => v.toFixed(1)) {
  const momChange = formatChange(current, mom);
  const qoqChange = formatChange(current, qoq);
  const yoyChange = formatChange(current, yoy);

  return `
    <div class="metric-card">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${formatter(current)}</div>
      <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b;">vs Last Month:</span>
          <span class="change-${momChange.className}">${momChange.text}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b;">vs Last Quarter:</span>
          <span class="change-${qoqChange.className}">${qoqChange.text}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px;">
          <span style="color: #64748b;">vs Last Year:</span>
          <span class="change-${yoyChange.className}">${yoyChange.text}</span>
        </div>
      </div>
    </div>
  `;
}

// Fetch reservations for a period
async function fetchReservationsForPeriod(start, end) {
  const { data, error } = await supabase
    .from('reservations')
    .select('*, reservation_extras(subtotal)')
    .gte('check_in', sqlDate(start))
    .lte('check_in', sqlDate(end))
    .in('status', ['confirmed', 'checked-in', 'checked-out']);

  if (error) throw error;
  return data || [];
}

// Calculate occupancy metrics
function calculateOccupancyMetrics(reservations, start, end) {
  const NUM_CABINS = 3;
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  const totalCabinNights = NUM_CABINS * totalDays;

  let occupiedNights = 0;
  let totalNights = 0;

  reservations.forEach(r => {
    if (!r.check_in || !r.check_out) return;
    totalNights += r.nights || 0;
    
    // Calculate occupied nights within range
    const checkIn = new Date(r.check_in);
    const checkOut = new Date(r.check_out);
    const rangeStart = new Date(Math.max(checkIn, start));
    const rangeEnd = new Date(Math.min(checkOut, end));
    const nights = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)));
    occupiedNights += nights;
  });

  const occupancyRate = totalCabinNights > 0 ? (occupiedNights / totalCabinNights) * 100 : 0;
  const avgLOS = reservations.length > 0 ? totalNights / reservations.length : 0;

  return { occupancyRate, avgLOS, totalNights, bookings: reservations.length };
}

// Calculate revenue metrics
function calculateRevenueMetrics(reservations) {
  const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
  const roomRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.room_subtotal) || 0), 0);
  
  let extrasRevenue = 0;
  reservations.forEach(r => {
    if (r.reservation_extras) {
      r.reservation_extras.forEach(e => {
        extrasRevenue += parseFloat(e.subtotal) || 0;
      });
    }
  });

  const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;

  return { totalRevenue, roomRevenue, extrasRevenue, avgBookingValue };
}

// Calculate extras metrics
function calculateExtrasMetrics(reservations) {
  let totalBookingsWithExtras = 0;
  let totalExtras = 0;
  let totalExtrasRevenue = 0;

  reservations.forEach(r => {
    if (r.reservation_extras && r.reservation_extras.length > 0) {
      totalBookingsWithExtras++;
      totalExtras += r.reservation_extras.length;
      r.reservation_extras.forEach(e => {
        totalExtrasRevenue += parseFloat(e.subtotal) || 0;
      });
    }
  });

  const attachRate = reservations.length > 0 ? (totalBookingsWithExtras / reservations.length) * 100 : 0;
  const avgPerBooking = totalBookingsWithExtras > 0 ? totalExtras / totalBookingsWithExtras : 0;

  return { attachRate, avgPerBooking, totalExtrasRevenue };
}

// Get weekday vs weekend occupancy
async function getWeekdayWeekendComparison(start, end) {
  // First get weekend definitions
  const { data: weekendDefs, error: weekendError } = await supabase
    .from('weekend_definitions')
    .select('*');

  if (weekendError) throw weekendError;

  // Create a map of day_of_week to is_weekend
  const weekendMap = {};
  (weekendDefs || []).forEach(wd => {
    weekendMap[wd.day_of_week] = wd.is_weekend;
  });

  // Get all reservations
  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('check_in, check_out, nights')
    .gte('check_in', sqlDate(start))
    .lte('check_in', sqlDate(end))
    .in('status', ['confirmed', 'checked-in', 'checked-out']);

  if (error) throw error;

  let weekdayNights = 0;
  let weekendNights = 0;

  (reservations || []).forEach(r => {
    if (!r.check_in || !r.check_out) return;

    const checkIn = new Date(r.check_in);
    const checkOut = new Date(r.check_out);
    let currentDate = new Date(checkIn);

    while (currentDate < checkOut) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = weekendMap[dayOfWeek] || false;

      if (isWeekend) {
        weekendNights++;
      } else {
        weekdayNights++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  const NUM_CABINS = 3;
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // Count weekday and weekend days in range
  let weekdayDays = 0;
  let weekendDays = 0;
  let currentDate = new Date(start);
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    if (weekendMap[dayOfWeek]) {
      weekendDays++;
    } else {
      weekdayDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const weekdayCapacity = NUM_CABINS * weekdayDays;
  const weekendCapacity = NUM_CABINS * weekendDays;

  const weekdayOccupancy = weekdayCapacity > 0 ? (weekdayNights / weekdayCapacity) * 100 : 0;
  const weekendOccupancy = weekendCapacity > 0 ? (weekendNights / weekendCapacity) * 100 : 0;

  return { weekdayOccupancy, weekendOccupancy };
}

// Main function to render comparison view
export async function renderComparisonView(dateRange) {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  container.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading comparison data...</div>';

  try {
    const periods = getComparisonPeriods(dateRange.start, dateRange.end);

    // Fetch data for all periods
    const [currentRes, momRes, qoqRes, yoyRes] = await Promise.all([
      fetchReservationsForPeriod(periods.current.start, periods.current.end),
      fetchReservationsForPeriod(periods.mom.start, periods.mom.end),
      fetchReservationsForPeriod(periods.qoq.start, periods.qoq.end),
      fetchReservationsForPeriod(periods.yoy.start, periods.yoy.end)
    ]);

    // Calculate metrics for each period
    const currentOccupancy = calculateOccupancyMetrics(currentRes, periods.current.start, periods.current.end);
    const momOccupancy = calculateOccupancyMetrics(momRes, periods.mom.start, periods.mom.end);
    const qoqOccupancy = calculateOccupancyMetrics(qoqRes, periods.qoq.start, periods.qoq.end);
    const yoyOccupancy = calculateOccupancyMetrics(yoyRes, periods.yoy.start, periods.yoy.end);

    const currentRevenue = calculateRevenueMetrics(currentRes);
    const momRevenue = calculateRevenueMetrics(momRes);
    const qoqRevenue = calculateRevenueMetrics(qoqRes);
    const yoyRevenue = calculateRevenueMetrics(yoyRes);

    const currentExtras = calculateExtrasMetrics(currentRes);
    const momExtras = calculateExtrasMetrics(momRes);
    const qoqExtras = calculateExtrasMetrics(qoqRes);
    const yoyExtras = calculateExtrasMetrics(yoyRes);

    // Get weekday vs weekend comparison
    const weekdayWeekend = await getWeekdayWeekendComparison(periods.current.start, periods.current.end);

    // Render the comparison view
    container.innerHTML = `
      <!-- Occupancy Comparisons -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Occupancy Comparisons</h2>
        <div class="metrics-grid">
          ${renderComparisonCard(
            'Occupancy Rate',
            currentOccupancy.occupancyRate,
            momOccupancy.occupancyRate,
            qoqOccupancy.occupancyRate,
            yoyOccupancy.occupancyRate,
            (v) => `${v.toFixed(1)}%`
          )}
          ${renderComparisonCard(
            'Avg Length of Stay',
            currentOccupancy.avgLOS,
            momOccupancy.avgLOS,
            qoqOccupancy.avgLOS,
            yoyOccupancy.avgLOS,
            (v) => `${v.toFixed(1)} nights`
          )}
          ${renderComparisonCard(
            'Total Bookings',
            currentOccupancy.bookings,
            momOccupancy.bookings,
            qoqOccupancy.bookings,
            yoyOccupancy.bookings,
            (v) => v.toString()
          )}
        </div>
      </div>

      <!-- Weekday vs Weekend -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Weekday vs Weekend Occupancy</h2>
        <div class="chart-card">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
            <div style="text-align: center; padding: 24px; background: #f9fafb; border-radius: 12px;">
              <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: 500;">Weekday Occupancy</div>
              <div style="font-size: 32px; font-weight: 700; color: #0f172a;">${weekdayWeekend.weekdayOccupancy.toFixed(1)}%</div>
            </div>
            <div style="text-align: center; padding: 24px; background: #f9fafb; border-radius: 12px;">
              <div style="font-size: 14px; color: #64748b; margin-bottom: 8px; font-weight: 500;">Weekend Occupancy</div>
              <div style="font-size: 32px; font-weight: 700; color: #0f172a;">${weekdayWeekend.weekendOccupancy.toFixed(1)}%</div>
            </div>
          </div>
          <div style="margin-top: 16px; padding: 16px; background: #f0f9ff; border-radius: 8px; text-align: center;">
            <span style="color: #0369a1; font-weight: 500;">
              ${weekdayWeekend.weekendOccupancy > weekdayWeekend.weekdayOccupancy 
                ? `Weekends are ${((weekdayWeekend.weekendOccupancy / weekdayWeekend.weekdayOccupancy - 1) * 100).toFixed(1)}% more popular`
                : `Weekdays are ${((weekdayWeekend.weekdayOccupancy / weekdayWeekend.weekendOccupancy - 1) * 100).toFixed(1)}% more popular`
              }
            </span>
          </div>
        </div>
      </div>

      <!-- Revenue Comparisons -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Revenue Comparisons</h2>
        <div class="metrics-grid">
          ${renderComparisonCard(
            'Total Revenue',
            currentRevenue.totalRevenue,
            momRevenue.totalRevenue,
            qoqRevenue.totalRevenue,
            yoyRevenue.totalRevenue,
            formatCurrencyCompact
          )}
          ${renderComparisonCard(
            'Room Revenue',
            currentRevenue.roomRevenue,
            momRevenue.roomRevenue,
            qoqRevenue.roomRevenue,
            yoyRevenue.roomRevenue,
            formatCurrencyCompact
          )}
          ${renderComparisonCard(
            'Extras Revenue',
            currentRevenue.extrasRevenue,
            momRevenue.extrasRevenue,
            qoqRevenue.extrasRevenue,
            yoyRevenue.extrasRevenue,
            formatCurrencyCompact
          )}
          ${renderComparisonCard(
            'Avg Booking Value',
            currentRevenue.avgBookingValue,
            momRevenue.avgBookingValue,
            qoqRevenue.avgBookingValue,
            yoyRevenue.avgBookingValue,
            formatCurrencyCompact
          )}
        </div>
      </div>

      <!-- Extras Comparisons -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Extras Performance Comparisons</h2>
        <div class="metrics-grid">
          ${renderComparisonCard(
            'Extras Attach Rate',
            currentExtras.attachRate,
            momExtras.attachRate,
            qoqExtras.attachRate,
            yoyExtras.attachRate,
            (v) => `${v.toFixed(1)}%`
          )}
          ${renderComparisonCard(
            'Avg Extras Per Booking',
            currentExtras.avgPerBooking,
            momExtras.avgPerBooking,
            qoqExtras.avgPerBooking,
            yoyExtras.avgPerBooking,
            (v) => v.toFixed(1)
          )}
          ${renderComparisonCard(
            'Total Extras Revenue',
            currentExtras.totalExtrasRevenue,
            momExtras.totalExtrasRevenue,
            qoqExtras.totalExtrasRevenue,
            yoyExtras.totalExtrasRevenue,
            formatCurrencyCompact
          )}
        </div>
      </div>
    `;

  } catch (error) {
    console.error('Error loading comparison view:', error);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <div style="color: #ef4444; font-weight: 600; margin-bottom: 8px;">Error loading comparison data</div>
        <div style="color: #64748b; font-size: 14px;">${error.message}</div>
      </div>
    `;
  }
}
