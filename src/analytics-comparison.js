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
async function calculateOccupancyMetrics(reservations, start, end) {
  const NUM_CABINS = 3;
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  // Get blocked dates for this period
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('blocked_date, room_type_id')
    .gte('blocked_date', sqlDate(start))
    .lte('blocked_date', sqlDate(end));
  
  const blockedNights = (blockedDates || []).length;
  const totalCabinNights = (NUM_CABINS * totalDays) - blockedNights;

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

  return { occupancyRate, avgLOS, totalNights, bookings: reservations.length, availableNights: totalCabinNights };
}

// Calculate revenue metrics
function calculateRevenueMetrics(reservations, availableNights) {
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

  // Calculate occupied nights within range for ADR
  let occupiedNights = 0;
  reservations.forEach(r => {
    occupiedNights += r.nights || 0;
  });

  const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;
  
  // RevPAR = Room Revenue / Available Nights (not sold nights)
  const revPAR = availableNights > 0 ? roomRevenue / availableNights : 0;
  
  // TRevPAR = Total Revenue / Available Nights (includes extras)
  const trevpar = availableNights > 0 ? totalRevenue / availableNights : 0;
  
  // ADR = Room Revenue / Occupied Nights
  const adr = occupiedNights > 0 ? roomRevenue / occupiedNights : 0;

  return { totalRevenue, roomRevenue, extrasRevenue, avgBookingValue, revPAR, trevpar, adr };
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

// Generate time series for occupancy comparison with granularity support
async function generateOccupancyTimeSeries(periods, granularity = 'day') {
  const NUM_CABINS = 3;
  const datasets = [];

  for (const [label, period] of Object.entries(periods)) {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('check_in, check_out, nights')
      .gte('check_in', sqlDate(period.start))
      .lte('check_in', sqlDate(period.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    const occupancyByDate = {};
    
    (reservations || []).forEach(r => {
      if (!r.check_in || !r.check_out) return;
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      let d = new Date(checkIn);
      
      while (d < checkOut) {
        const key = sqlDate(d);
        occupancyByDate[key] = (occupancyByDate[key] || 0) + 1;
        d.setDate(d.getDate() + 1);
      }
    });

    let points = [];

    if (granularity === 'day') {
      // Daily granularity
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const occupied = occupancyByDate[key] || 0;
        const rate = (occupied / NUM_CABINS) * 100;
        
        points.push({
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: rate
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (granularity === 'week') {
      // Weekly granularity
      const weekBuckets = {};
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const occupied = occupancyByDate[key] || 0;
        const rate = (occupied / NUM_CABINS) * 100;
        
        // Get Monday of the week
        const weekStart = new Date(currentDate);
        const day = weekStart.getDay();
        const diff = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diff);
        const weekKey = sqlDate(weekStart);
        
        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = { sum: 0, count: 0, date: new Date(weekStart) };
        }
        weekBuckets[weekKey].sum += rate;
        weekBuckets[weekKey].count += 1;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      points = Object.values(weekBuckets)
        .sort((a, b) => a.date - b.date)
        .map(bucket => ({
          label: bucket.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: bucket.count > 0 ? bucket.sum / bucket.count : 0
        }));
    } else if (granularity === 'month') {
      // Monthly granularity
      const monthBuckets = {};
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const occupied = occupancyByDate[key] || 0;
        const rate = (occupied / NUM_CABINS) * 100;
        
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        
        if (!monthBuckets[monthKey]) {
          monthBuckets[monthKey] = { 
            sum: 0, 
            count: 0, 
            date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) 
          };
        }
        monthBuckets[monthKey].sum += rate;
        monthBuckets[monthKey].count += 1;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      points = Object.values(monthBuckets)
        .sort((a, b) => a.date - b.date)
        .map(bucket => ({
          label: bucket.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          value: bucket.count > 0 ? bucket.sum / bucket.count : 0
        }));
    }
    
    datasets.push({ label, points });
  }

  return datasets;
}

// Generate time series for revenue comparison with granularity support
async function generateRevenueTimeSeries(periods, granularity = 'day') {
  const datasets = [];

  for (const [label, period] of Object.entries(periods)) {
    const { data: reservations } = await supabase
      .from('reservations')
      .select('total, check_in')
      .gte('check_in', sqlDate(period.start))
      .lte('check_in', sqlDate(period.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    const revenueByDate = {};
    
    (reservations || []).forEach(r => {
      if (!r.check_in) return;
      const key = sqlDate(new Date(r.check_in));
      revenueByDate[key] = (revenueByDate[key] || 0) + (parseFloat(r.total) || 0);
    });

    let points = [];

    if (granularity === 'day') {
      // Daily granularity
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const revenue = revenueByDate[key] || 0;
        
        points.push({
          label: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: revenue
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else if (granularity === 'week') {
      // Weekly granularity
      const weekBuckets = {};
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const revenue = revenueByDate[key] || 0;
        
        // Get Monday of the week
        const weekStart = new Date(currentDate);
        const day = weekStart.getDay();
        const diff = (day + 6) % 7;
        weekStart.setDate(weekStart.getDate() - diff);
        const weekKey = sqlDate(weekStart);
        
        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = { total: 0, date: new Date(weekStart) };
        }
        weekBuckets[weekKey].total += revenue;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      points = Object.values(weekBuckets)
        .sort((a, b) => a.date - b.date)
        .map(bucket => ({
          label: bucket.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: bucket.total
        }));
    } else if (granularity === 'month') {
      // Monthly granularity
      const monthBuckets = {};
      let currentDate = new Date(period.start);
      const endDate = new Date(period.end);
      
      while (currentDate <= endDate) {
        const key = sqlDate(currentDate);
        const revenue = revenueByDate[key] || 0;
        
        const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        
        if (!monthBuckets[monthKey]) {
          monthBuckets[monthKey] = { 
            total: 0, 
            date: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) 
          };
        }
        monthBuckets[monthKey].total += revenue;
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      points = Object.values(monthBuckets)
        .sort((a, b) => a.date - b.date)
        .map(bucket => ({
          label: bucket.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          value: bucket.total
        }));
    }
    
    datasets.push({ label, points });
  }

  return datasets;
}

// Render multi-line comparison chart with period and granularity toggles
function renderComparisonLineChart(containerId, datasets, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!datasets || datasets.length === 0) {
    container.innerHTML = '<div class="analytics-empty">No data available</div>';
    return;
  }

  // Default to MoM comparison and daily granularity
  const comparisonMode = options.defaultMode || 'mom';
  const granularity = options.defaultGranularity || 'day';
  
  // Store datasets for re-rendering
  window[`${containerId}_datasets`] = datasets;
  window[`${containerId}_options`] = options;
  
  // Create wrapper with toggle buttons
  const wrapperId = `${containerId}-wrapper`;
  
  container.innerHTML = `
    <div id="${wrapperId}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <!-- Granularity Toggle -->
        <div class="chart-controls">
          <button class="chart-btn active" data-granularity="day" data-chart="${containerId}">D</button>
          <button class="chart-btn" data-granularity="week" data-chart="${containerId}">W</button>
          <button class="chart-btn" data-granularity="month" data-chart="${containerId}">M</button>
        </div>
        <!-- Comparison Period Toggle -->
        <div class="chart-controls">
          <button class="chart-btn active" data-mode="mom" data-chart="${containerId}">MoM</button>
          <button class="chart-btn" data-mode="qoq" data-chart="${containerId}">QoQ</button>
          <button class="chart-btn" data-mode="yoy" data-chart="${containerId}">YoY</button>
        </div>
      </div>
      <div id="${containerId}-chart">Loading...</div>
    </div>
  `;

  // Attach event listeners to granularity toggle buttons
  container.querySelectorAll('.chart-btn[data-granularity]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const newGranularity = e.target.dataset.granularity;
      const chartId = e.target.dataset.chart;
      
      // Update active state
      container.querySelectorAll('.chart-btn[data-granularity]').forEach(b => {
        b.classList.toggle('active', b.dataset.granularity === newGranularity);
      });
      
      // Get current comparison mode
      const currentMode = container.querySelector('.chart-btn[data-mode].active')?.dataset.mode || 'mom';
      
      // Show loading
      document.getElementById(`${chartId}-chart`).innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading...</div>';
      
      // Re-fetch data with new granularity
      await reloadChartData(chartId, currentMode, newGranularity);
    });
  });

  // Attach event listeners to comparison mode toggle buttons
  container.querySelectorAll('.chart-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const mode = e.target.dataset.mode;
      const chartId = e.target.dataset.chart;
      
      // Update active state
      container.querySelectorAll('.chart-btn[data-mode]').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      
      // Get current granularity
      const currentGranularity = container.querySelector('.chart-btn[data-granularity].active')?.dataset.granularity || 'day';
      
      // Re-render chart with new mode (no need to reload data)
      const storedDatasets = window[`${chartId}_datasets`];
      const storedOptions = window[`${chartId}_options`];
      renderComparisonLineChartContent(`${chartId}-chart`, storedDatasets, mode, storedOptions);
    });
  });

  // Initial render
  renderComparisonLineChartContent(`${containerId}-chart`, datasets, comparisonMode, options);
}

// Reload chart data with new granularity
async function reloadChartData(chartId, mode, granularity) {
  try {
    const storedOptions = window[`${chartId}_options`] || {};
    
    // Get periods from stored options or regenerate
    const dateRange = storedOptions.dateRange || { 
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), 
      end: new Date() 
    };
    
    const periods = getComparisonPeriods(dateRange.start, dateRange.end);
    
    // Regenerate data based on chart type
    let newDatasets;
    if (chartId.includes('occupancy')) {
      newDatasets = await generateOccupancyTimeSeries(periods, granularity);
    } else if (chartId.includes('revenue')) {
      newDatasets = await generateRevenueTimeSeries(periods, granularity);
    }
    
    // Store new datasets
    window[`${chartId}_datasets`] = newDatasets;
    
    // Re-render
    renderComparisonLineChartContent(`${chartId}-chart`, newDatasets, mode, storedOptions);
  } catch (error) {
    console.error('Error reloading chart data:', error);
    document.getElementById(`${chartId}-chart`).innerHTML = '<div class="analytics-empty">Error loading chart data</div>';
  }
}

// Render the actual chart content for selected comparison mode
function renderComparisonLineChartContent(containerId, datasets, mode, options = {}) {
  const chartContainer = document.getElementById(containerId);
  if (!chartContainer) return;

  // Select which datasets to show based on mode
  const currentDataset = datasets.find(ds => ds.label === 'current');
  let comparisonDataset;
  let comparisonLabel;

  switch(mode) {
    case 'mom':
      comparisonDataset = datasets.find(ds => ds.label === 'mom');
      comparisonLabel = 'Last Month';
      break;
    case 'qoq':
      comparisonDataset = datasets.find(ds => ds.label === 'qoq');
      comparisonLabel = 'Last Quarter';
      break;
    case 'yoy':
      comparisonDataset = datasets.find(ds => ds.label === 'yoy');
      comparisonLabel = 'Last Year';
      break;
  }

  if (!currentDataset || !comparisonDataset) {
    chartContainer.innerHTML = '<div class="analytics-empty">No data available</div>';
    return;
  }

  const displayDatasets = [currentDataset, comparisonDataset];

  // Find min/max across selected datasets
  let allValues = [];
  displayDatasets.forEach(ds => {
    allValues = allValues.concat(ds.points.map(p => p.value));
  });
  
  const minValue = options.min != null ? options.min : Math.min(...allValues, 0);
  const maxValue = options.max != null ? options.max : Math.max(...allValues, minValue || 0);

  const width = 100;
  const height = 40;
  const padX = 6;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const normalizeY = (val) => {
    if (maxValue === minValue) return padY + innerH / 2;
    return padY + innerH - ((val - minValue) / (maxValue - minValue)) * innerH;
  };

  const colors = ['#3B82F6', '#10b981']; // Blue for current, Green for comparison
  const labels = ['Current Period', comparisonLabel];

  // Use the first dataset's length for x-axis spacing
  const numPoints = currentDataset.points.length;
  const stepX = innerW / Math.max(numPoints - 1, 1);

  // Generate paths for each dataset
  let paths = '';
  displayDatasets.forEach((ds, idx) => {
    const color = colors[idx];
    const pathD = ds.points
      .map((p, i) => {
        const x = padX + stepX * i;
        const y = normalizeY(p.value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    
    paths += `<path class="chart-line-path" d="${pathD}" style="stroke: ${color};" />`;
  });

  // Use current dataset's labels for x-axis
  const xLabels = currentDataset.points
    .map(p => `<div class="chart-x-label">${p.label}</div>`)
    .join('');

  // Create legend
  const legend = displayDatasets
    .map((ds, idx) => {
      const color = colors[idx];
      const label = labels[idx];
      return `
        <div style="display: flex; align-items: center; gap: 6px;">
          <div style="width: 12px; height: 3px; background: ${color}; border-radius: 2px;"></div>
          <span style="font-size: 11px; color: #64748b;">${label}</span>
        </div>
      `;
    })
    .join('');

  chartContainer.innerHTML = `
    <div class="chart-line-wrapper">
      <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
        ${legend}
      </div>
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-line-svg">
        ${paths}
      </svg>
      <div class="chart-line-labels">
        ${xLabels}
      </div>
    </div>
  `;
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
    const currentOccupancy = await calculateOccupancyMetrics(currentRes, periods.current.start, periods.current.end);
    const momOccupancy = await calculateOccupancyMetrics(momRes, periods.mom.start, periods.mom.end);
    const qoqOccupancy = await calculateOccupancyMetrics(qoqRes, periods.qoq.start, periods.qoq.end);
    const yoyOccupancy = await calculateOccupancyMetrics(yoyRes, periods.yoy.start, periods.yoy.end);

    const currentRevenue = calculateRevenueMetrics(currentRes, currentOccupancy.availableNights);
    const momRevenue = calculateRevenueMetrics(momRes, momOccupancy.availableNights);
    const qoqRevenue = calculateRevenueMetrics(qoqRes, qoqOccupancy.availableNights);
    const yoyRevenue = calculateRevenueMetrics(yoyRes, yoyOccupancy.availableNights);

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
            'ALOS',
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

      <!-- Occupancy Trend Comparison Chart -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Occupancy Trend Comparison</h2>
        <div class="chart-card">
          <div id="occupancy-trend-comparison" style="height: 280px;">Loading chart...</div>
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
          ${renderComparisonCard(
            'ADR',
            currentRevenue.adr,
            momRevenue.adr,
            qoqRevenue.adr,
            yoyRevenue.adr,
            formatCurrencyCompact
          )}
          ${renderComparisonCard(
            'RevPAR',
            currentRevenue.revPAR,
            momRevenue.revPAR,
            qoqRevenue.revPAR,
            yoyRevenue.revPAR,
            formatCurrencyCompact
          )}
          ${renderComparisonCard(
            'TRevPAR',
            currentRevenue.trevpar,
            momRevenue.trevpar,
            qoqRevenue.trevpar,
            yoyRevenue.trevpar,
            formatCurrencyCompact
          )}
        </div>
      </div>

      <!-- Revenue Trend Comparison Chart -->
      <div class="analytics-section">
        <h2 class="analytics-section-title">Revenue Trend Comparison</h2>
        <div class="chart-card">
          <div id="revenue-trend-comparison" style="height: 280px;">Loading chart...</div>
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

    // Generate and render comparison charts with dateRange
    const occupancyData = await generateOccupancyTimeSeries(periods, 'day');
    renderComparisonLineChart('occupancy-trend-comparison', occupancyData, { 
      min: 0, 
      max: 100, 
      dateRange: { start: dateRange.start, end: dateRange.end } 
    });

    const revenueData = await generateRevenueTimeSeries(periods, 'day');
    renderComparisonLineChart('revenue-trend-comparison', revenueData, { 
      min: 0,
      dateRange: { start: dateRange.start, end: dateRange.end }
    });

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