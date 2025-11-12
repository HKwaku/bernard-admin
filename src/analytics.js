// src/analytics.js
// Analytics Dashboard for Sojourn Cabins

import { supabase } from './config/supabase.js';
import { formatCurrency, toast } from './utils/helpers.js';

// Date range state
let dateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  end: new Date()
};

export function initAnalytics() {
  renderAnalytics();
  loadAllAnalytics();
}

function renderAnalytics() {
  const view = document.getElementById('view-analytics');
  if (!view) return;

  view.innerHTML = `
    <div class="card-bd" style="padding: 24px;">
      <!-- Date Range Selector -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <select id="analytics-period" class="select">
            <option value="7">Last 7 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 12 months</option>
            <option value="custom">Custom Range</option>
          </select>
          <div id="custom-date-range" style="display: none; gap: 8px;">
            <input type="date" id="analytics-start" class="input" style="width: auto;">
            <span>to</span>
            <input type="date" id="analytics-end" class="input" style="width: auto;">
            <button id="apply-date-range" class="btn btn-sm">Apply</button>
          </div>
        </div>
        <button id="export-analytics" class="btn">Export Report</button>
      </div>

      <!-- Revenue Overview -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; letter-spacing: -0.01em;">REVENUE OVERVIEW</h2>
        <div class="metrics-grid" id="revenue-metrics">
          <div class="metric-card"><div class="metric-label">Loading...</div></div>
        </div>
      </div>

      <!-- Revenue Trend Chart -->
      <div class="chart-card" style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a;">Revenue Trend</h3>
          <div class="chart-controls">
            <button class="chart-btn" data-period="day">D</button>
            <button class="chart-btn" data-period="week">W</button>
            <button class="chart-btn active" data-period="month">M</button>
          </div>
        </div>
        <div id="revenue-chart" style="height: 300px; display: flex; align-items: center; justify-content: center; color: #64748b;">
          Loading chart...
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="two-column" style="margin-bottom: 32px;">
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Occupancy by Cabin</h3>
          <div id="occupancy-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Booking Sources</h3>
          <div id="sources-chart">Loading...</div>
        </div>
      </div>

      <!-- Extras Performance -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; letter-spacing: -0.01em;">EXTRAS & ADD-ONS PERFORMANCE</h2>
        <div class="metrics-grid" id="extras-metrics">
          <div class="metric-card"><div class="metric-label">Loading...</div></div>
        </div>
      </div>

      <div class="two-column" style="margin-bottom: 32px;">
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Top Extras by Bookings</h3>
          <div id="extras-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Extras Revenue Breakdown</h3>
          <div id="extras-revenue-chart">Loading...</div>
        </div>
      </div>

      <!-- Extras Pairing -->
      <div class="chart-card" style="margin-bottom: 32px;">
        <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Extras Pairing Analysis</h3>
        <div id="pairing-analysis">Loading...</div>
      </div>

      <!-- Package Performance -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; letter-spacing: -0.01em;">PACKAGE PERFORMANCE</h2>
        <div class="metrics-grid" id="package-metrics">
          <div class="metric-card"><div class="metric-label">Loading...</div></div>
        </div>
      </div>

      <div class="two-column" style="margin-bottom: 32px;">
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Package Bookings</h3>
          <div id="package-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Package Revenue Split</h3>
          <div id="package-revenue-chart">Loading...</div>
        </div>
      </div>

      <!-- Coupon Analytics -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; letter-spacing: -0.01em;">COUPON ANALYTICS</h2>
        <div class="metrics-grid" id="coupon-metrics">
          <div class="metric-card"><div class="metric-label">Loading...</div></div>
        </div>
      </div>

      <div class="two-column" style="margin-bottom: 32px;">
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Top Coupons by Usage</h3>
          <div id="coupon-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Coupon Impact Analysis</h3>
          <div id="coupon-impact">Loading...</div>
        </div>
      </div>

      <!-- Upcoming & Operational -->
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-bottom: 16px; letter-spacing: -0.01em;">UPCOMING & OPERATIONAL</h2>
      </div>

      <div class="two-column">
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Next 7 Days Check-Ins</h3>
          <div id="upcoming-checkins">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 style="font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 20px;">Current Status</h3>
          <div id="current-status">Loading...</div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('analytics-period')?.addEventListener('change', handlePeriodChange);
  document.getElementById('apply-date-range')?.addEventListener('click', applyCustomDateRange);
  document.getElementById('export-analytics')?.addEventListener('click', exportAnalytics);
}

async function loadAllAnalytics() {
  try {
    await Promise.all([
      loadRevenueMetrics(),
      loadRevenueChart(),
      loadOccupancyChart(),
      loadSourcesChart(),
      loadExtrasMetrics(),
      loadExtrasCharts(),
      loadPairingAnalysis(),
      loadPackageMetrics(),
      loadPackageCharts(),
      loadCouponMetrics(),
      loadCouponCharts(),
      loadUpcomingCheckins(),
      loadCurrentStatus()
    ]);
  } catch (error) {
    console.error('Error loading analytics:', error);
    toast('Error loading analytics data');
  }
}

async function loadRevenueMetrics() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('total, room_subtotal, extras_total, created_at, check_in, nights')
      .gte('check_in', dateRange.start.toISOString().split('T')[0].split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0].split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const totalRevenue = reservations.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;
    const totalNights = reservations.reduce((sum, r) => sum + (r.nights || 0), 0);
    const revPAR = totalNights > 0 ? totalRevenue / totalNights : 0;
    
    // Calculate occupancy (assuming 3 cabins)
    const daysInPeriod = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    const totalPossibleNights = daysInPeriod * 3;
    const occupancyRate = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) * 100 : 0;
    
    const adr = totalNights > 0 ? totalRevenue / totalNights : 0;

    const html = `
      <div class="metric-card">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">GHS ${totalRevenue.toFixed(2)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Booking Value</div>
        <div class="metric-value">GHS ${avgBookingValue.toFixed(2)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">RevPAR</div>
        <div class="metric-value">GHS ${revPAR.toFixed(2)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Occupancy Rate</div>
        <div class="metric-value">${occupancyRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ADR</div>
        <div class="metric-value">GHS ${adr.toFixed(2)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Bookings</div>
        <div class="metric-value">${reservations.length}</div>
      </div>
    `;

    document.getElementById('revenue-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading revenue metrics:', error);
    document.getElementById('revenue-metrics').innerHTML = '<div class="metric-card"><div class="metric-label">Error loading data</div></div>';
  }
}

async function loadRevenueChart() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('total, check_in')
      .gte('check_in', dateRange.start.toISOString().split('T')[0].split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0].split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('check_in');

    if (error) throw error;

    // Group by month
    const monthlyData = {};
    reservations.forEach(r => {
      const month = new Date(r.check_in).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      monthlyData[month] = (monthlyData[month] || 0) + (parseFloat(r.total) || 0);
    });

    const months = Object.keys(monthlyData);
    const values = Object.values(monthlyData);
    const maxValue = Math.max(...values, 1);

    let html = '<div style="display: flex; align-items: flex-end; height: 250px; gap: 12px; padding: 20px 0;">';
    
    months.forEach((month, i) => {
      const height = (values[i] / maxValue) * 100;
      html += `
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="font-size: 12px; font-weight: 600; color: #0f172a;">GHS ${values[i].toFixed(0)}</div>
          <div style="width: 100%; height: ${height}%; background: linear-gradient(180deg, #c9a86a 0%, #b89858 100%); border-radius: 6px 6px 0 0; min-height: 4px; transition: all 0.3s ease;"></div>
          <div style="font-size: 11px; color: #64748b; text-align: center;">${month}</div>
        </div>
      `;
    });
    
    html += '</div>';

    document.getElementById('revenue-chart').innerHTML = html || '<div style="text-align: center; color: #94a3b8;">No data available</div>';
  } catch (error) {
    console.error('Error loading revenue chart:', error);
    document.getElementById('revenue-chart').innerHTML = '<div style="text-align: center; color: #ef4444;">Error loading chart</div>';
  }
}

async function loadOccupancyChart() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('room_type_code, nights')
      .gte('check_in', dateRange.start.toISOString().split('T')[0].split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0].split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const cabins = { SAND: 0, SEA: 0, SUN: 0 };
    reservations.forEach(r => {
      if (cabins.hasOwnProperty(r.room_type_code)) {
        cabins[r.room_type_code] += r.nights || 0;
      }
    });

    const daysInPeriod = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    const maxNights = daysInPeriod;

    let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    Object.entries(cabins).forEach(([cabin, nights]) => {
      const percentage = maxNights > 0 ? (nights / maxNights) * 100 : 0;
      html += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="min-width: 60px; font-weight: 600; color: #0f172a;">${cabin}</div>
          <div style="flex: 1; height: 32px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative;">
            <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #c9a86a 0%, #d4b577 100%); transition: width 0.5s ease;"></div>
          </div>
          <div style="min-width: 50px; text-align: right; font-weight: 600; color: #0f172a;">${percentage.toFixed(0)}%</div>
        </div>
      `;
    });
    
    html += '</div>';

    document.getElementById('occupancy-chart').innerHTML = html;
  } catch (error) {
    console.error('Error loading occupancy chart:', error);
    document.getElementById('occupancy-chart').innerHTML = '<div style="text-align: center; color: #ef4444;">Error loading chart</div>';
  }
}

async function loadSourcesChart() {
  // Since we don't have a source field, we'll show placeholder data
  const html = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="min-width: 100px; font-weight: 500; color: #0f172a;">Direct</div>
        <div style="flex: 1; height: 32px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
          <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%);"></div>
        </div>
        <div style="min-width: 50px; text-align: right; font-weight: 600; color: #0f172a;">100%</div>
      </div>
      <div style="text-align: center; margin-top: 12px; color: #64748b; font-size: 14px;">
        Booking source tracking coming soon
      </div>
    </div>
  `;
  document.getElementById('sources-chart').innerHTML = html;
}

async function loadExtrasMetrics() {
  try {
    const { data: reservationExtras, error } = await supabase
      .from('reservation_extras')
      .select('*, reservations!inner(check_in)')
      .gte('reservations.check_in', dateRange.start.toISOString().split('T')[0])
      .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0]);

    if (error) throw error;

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id')
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    const totalRevenue = reservationExtras.reduce((sum, e) => sum + (parseFloat(e.subtotal) || 0), 0);
    const bookingsWithExtras = new Set(reservationExtras.map(e => e.reservation_id)).size;
    const attachRate = reservations.length > 0 ? (bookingsWithExtras / reservations.length) * 100 : 0;
    const avgPerBooking = bookingsWithExtras > 0 ? reservationExtras.length / bookingsWithExtras : 0;
    
    // Find top extra
    const extraCounts = {};
    reservationExtras.forEach(e => {
      extraCounts[e.extra_name] = (extraCounts[e.extra_name] || 0) + 1;
    });
    const topExtra = Object.entries(extraCounts).sort((a, b) => b[1] - a[1])[0];

    const html = `
      <div class="metric-card">
        <div class="metric-label">Extras Revenue</div>
        <div class="metric-value">${`GHS ${(totalRevenue).toFixed(2)}`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Extras Attach Rate</div>
        <div class="metric-value">${attachRate.toFixed(0)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Per Booking</div>
        <div class="metric-value">${avgPerBooking.toFixed(1)}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Top Extra</div>
        <div class="metric-value" style="font-size: 16px;">${topExtra ? topExtra[0] : 'N/A'}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${topExtra ? topExtra[1] + ' bookings' : ''}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Extras Sold</div>
        <div class="metric-value">${reservationExtras.length}</div>
      </div>
    `;

    document.getElementById('extras-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading extras metrics:', error);
  }
}

async function loadExtrasCharts() {
  try {
    const { data: reservationExtras, error } = await supabase
      .from('reservation_extras')
      .select('extra_name, subtotal, quantity, reservations!inner(check_in)')
      .gte('reservations.check_in', dateRange.start.toISOString().split('T')[0])
      .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0]);

    if (error) throw error;

    // Count bookings per extra
    const extraCounts = {};
    const extraRevenue = {};
    
    reservationExtras.forEach(e => {
      extraCounts[e.extra_name] = (extraCounts[e.extra_name] || 0) + 1;
      extraRevenue[e.extra_name] = (extraRevenue[e.extra_name] || 0) + (parseFloat(e.subtotal) || 0);
    });

    const sortedExtras = Object.entries(extraCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxCount = Math.max(...sortedExtras.map(e => e[1]), 1);

    // Bookings chart
    let bookingsHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    sortedExtras.forEach(([name, count]) => {
      const width = (count / maxCount) * 100;
      bookingsHtml += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="min-width: 150px; font-size: 14px; color: #0f172a;">${name}</div>
          <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="width: ${width}%; height: 100%; background: linear-gradient(90deg, #c9a86a 0%, #d4b577 100%);"></div>
          </div>
          <div style="min-width: 40px; text-align: right; font-weight: 600; color: #0f172a;">${count}</div>
        </div>
      `;
    });
    bookingsHtml += '</div>';

    // Revenue pie chart (simplified as text percentages)
    const totalRevenue = Object.values(extraRevenue).reduce((sum, v) => sum + v, 0);
    const sortedRevenue = Object.entries(extraRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    let revenueHtml = '<div style="display: flex; flex-direction: column; gap: 12px; padding: 20px 0;">';
    sortedRevenue.forEach(([name, revenue]) => {
      const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      revenueHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 16px; height: 16px; border-radius: 4px; background: linear-gradient(135deg, #c9a86a 0%, #b89858 100%);"></div>
            <span style="font-size: 14px; color: #0f172a;">${name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 14px; font-weight: 600; color: #64748b;">${percentage.toFixed(0)}%</span>
            <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${`GHS ${(revenue).toFixed(2)}`}</span>
          </div>
        </div>
      `;
    });
    revenueHtml += `</div>
      <div style="text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
        Total: <strong style="color: #0f172a;">${`GHS ${(totalRevenue).toFixed(2)}`}</strong>
      </div>`;

    document.getElementById('extras-chart').innerHTML = bookingsHtml;
    document.getElementById('extras-revenue-chart').innerHTML = revenueHtml;
  } catch (error) {
    console.error('Error loading extras charts:', error);
  }
}

async function loadPairingAnalysis() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        check_in,
        reservation_extras(extra_name)
      `)
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Count extras per booking
    const extrasDistribution = { 0: 0, 1: 0, '2+': 0 };
    const pairs = {};

    reservations.forEach(r => {
      const extrasCount = r.reservation_extras?.length || 0;
      
      if (extrasCount === 0) extrasDistribution[0]++;
      else if (extrasCount === 1) extrasDistribution[1]++;
      else extrasDistribution['2+']++;

      // Track pairs
      if (extrasCount >= 2) {
        const extras = r.reservation_extras.map(e => e.extra_name).sort();
        for (let i = 0; i < extras.length - 1; i++) {
          for (let j = i + 1; j < extras.length; j++) {
            const pair = `${extras[i]} + ${extras[j]}`;
            pairs[pair] = (pairs[pair] || 0) + 1;
          }
        }
      }
    });

    const topPairs = Object.entries(pairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const total = reservations.length;
    const pct0 = total > 0 ? (extrasDistribution[0] / total * 100).toFixed(0) : 0;
    const pct1 = total > 0 ? (extrasDistribution[1] / total * 100).toFixed(0) : 0;
    const pct2 = total > 0 ? (extrasDistribution['2+'] / total * 100).toFixed(0) : 0;

    let html = '<div style="margin-bottom: 24px;">';
    
    if (topPairs.length > 0) {
      html += '<div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;">';
      topPairs.forEach(([pair, count]) => {
        html += `
          <div style="padding: 14px; background: #f9fafb; border-left: 3px solid #c9a86a; border-radius: 6px;">
            <span style="font-size: 15px; color: #0f172a;">${pair}</span>
            <strong style="margin-left: 8px; color: #c9a86a;">(${count} bookings)</strong>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<div style="text-align: center; padding: 20px; color: #94a3b8;">No common pairings found</div>';
    }

    html += `
      <div style="display: flex; justify-content: space-around; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <div style="text-align: center;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct0}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">0 Extras</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct1}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">1 Extra</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct2}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">2+ Extras</div>
        </div>
      </div>
    </div>`;

    document.getElementById('pairing-analysis').innerHTML = html;
  } catch (error) {
    console.error('Error loading pairing analysis:', error);
  }
}

async function loadPackageMetrics() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('package_id, total, packages(name)')
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const withPackage = reservations.filter(r => r.package_id);
    const packageRevenue = withPackage.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const uptakeRate = reservations.length > 0 ? (withPackage.length / reservations.length) * 100 : 0;
    const avgPackageValue = withPackage.length > 0 ? packageRevenue / withPackage.length : 0;

    // Find most popular
    const packageCounts = {};
    withPackage.forEach(r => {
      const name = r.packages?.name || 'Unknown';
      packageCounts[name] = (packageCounts[name] || 0) + 1;
    });
    const topPackage = Object.entries(packageCounts).sort((a, b) => b[1] - a[1])[0];

    const html = `
      <div class="metric-card">
        <div class="metric-label">Package Uptake Rate</div>
        <div class="metric-value">${uptakeRate.toFixed(0)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Most Popular Package</div>
        <div class="metric-value" style="font-size: 16px;">${topPackage ? topPackage[0] : 'N/A'}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${topPackage ? topPackage[1] + ' bookings' : ''}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Package Revenue</div>
        <div class="metric-value">${`GHS ${(packageRevenue).toFixed(2)}`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Package Value</div>
        <div class="metric-value">${`GHS ${(avgPackageValue).toFixed(2)}`}</div>
      </div>
    `;

    document.getElementById('package-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading package metrics:', error);
  }
}

async function loadPackageCharts() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('package_id, total, packages(name)')
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const packageCounts = { 'No Package': 0 };
    const packageRevenue = {};

    reservations.forEach(r => {
      if (r.package_id && r.packages?.name) {
        const name = r.packages.name;
        packageCounts[name] = (packageCounts[name] || 0) + 1;
        packageRevenue[name] = (packageRevenue[name] || 0) + (parseFloat(r.total) || 0);
      } else {
        packageCounts['No Package']++;
      }
    });

    const sortedPackages = Object.entries(packageCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = Math.max(...sortedPackages.map(p => p[1]), 1);

    // Bookings chart
    let bookingsHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    sortedPackages.forEach(([name, count]) => {
      const width = (count / maxCount) * 100;
      const isNoPackage = name === 'No Package';
      bookingsHtml += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="min-width: 140px; font-size: 14px; color: #0f172a;">${name}</div>
          <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="width: ${width}%; height: 100%; background: ${isNoPackage ? 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)' : 'linear-gradient(90deg, #c9a86a 0%, #d4b577 100%)'};"></div>
          </div>
          <div style="min-width: 40px; text-align: right; font-weight: 600; color: #0f172a;">${count}</div>
        </div>
      `;
    });
    bookingsHtml += '</div>';

    // Revenue split
    const totalRevenue = Object.values(packageRevenue).reduce((sum, v) => sum + v, 0);
    const sortedRevenue = Object.entries(packageRevenue).sort((a, b) => b[1] - a[1]);

    let revenueHtml = '<div style="display: flex; flex-direction: column; gap: 12px; padding: 20px 0;">';
    sortedRevenue.forEach(([name, revenue]) => {
      const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      revenueHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 16px; height: 16px; border-radius: 4px; background: linear-gradient(135deg, #c9a86a 0%, #b89858 100%);"></div>
            <span style="font-size: 14px; color: #0f172a;">${name}</span>
          </div>
          <div style="font-size: 14px; font-weight: 600; color: #c9a86a;">${percentage.toFixed(0)}%</div>
        </div>
      `;
    });
    revenueHtml += `</div>
      <div style="margin-top: 12px;">
        <div style="text-align: center; padding: 8px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px;">
          <span style="color: #64748b;">Package bookings:</span> <strong>${sortedPackages.filter(p => p[0] !== 'No Package').reduce((sum, p) => sum + p[1], 0)}</strong>
        </div>
        <div style="text-align: center; padding: 8px; background: #f9fafb; border-radius: 6px;">
          <span style="color: #64748b;">No package:</span> <strong>${packageCounts['No Package'] || 0}</strong>
        </div>
      </div>`;

    document.getElementById('package-chart').innerHTML = bookingsHtml;
    document.getElementById('package-revenue-chart').innerHTML = revenueHtml;
  } catch (error) {
    console.error('Error loading package charts:', error);
  }
}

async function loadCouponMetrics() {
  try {
    const { data: coupons, error: couponsError } = await supabase
      .from('coupons')
      .select('*')
      .eq('is_active', true);

    const { data: usage, error: usageError } = await supabase
      .from('coupon_usage')
      .select('*, reservations!inner(check_in)')
      .gte('reservations.check_in', dateRange.start.toISOString().split('T')[0])
      .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0]);

    const { data: reservations } = await supabase
      .from('reservations')
      .select('coupon_code')
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (couponsError || usageError) throw couponsError || usageError;

    const totalDiscount = usage?.reduce((sum, u) => sum + (parseFloat(u.discount_amount) || 0), 0) || 0;
    const avgDiscount = usage?.length > 0 ? totalDiscount / usage.length : 0;
    const redemptionRate = reservations?.length > 0 ? ((usage?.length || 0) / reservations.length) * 100 : 0;

    // Find most used coupon
    const couponCounts = {};
    reservations?.forEach(r => {
      if (r.coupon_code) {
        couponCounts[r.coupon_code] = (couponCounts[r.coupon_code] || 0) + 1;
      }
    });
    const topCoupon = Object.entries(couponCounts).sort((a, b) => b[1] - a[1])[0];

    const html = `
      <div class="metric-card">
        <div class="metric-label">Active Coupons</div>
        <div class="metric-value">${coupons?.length || 0}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">currently active</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Discount Given</div>
        <div class="metric-value">${`GHS ${(totalDiscount).toFixed(2)}`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Discount</div>
        <div class="metric-value">${`GHS ${(avgDiscount).toFixed(2)}`}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Redemption Rate</div>
        <div class="metric-value">${redemptionRate.toFixed(0)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Most Used Coupon</div>
        <div class="metric-value" style="font-size: 16px;">${topCoupon ? topCoupon[0] : 'N/A'}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${topCoupon ? topCoupon[1] + ' uses' : ''}</div>
      </div>
    `;

    document.getElementById('coupon-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading coupon metrics:', error);
  }
}

async function loadCouponCharts() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('coupon_code, total, extras_total')
      .gte('check_in', dateRange.start.toISOString().split('T')[0])
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Count coupon usage
    const couponCounts = {};
    reservations.forEach(r => {
      if (r.coupon_code) {
        couponCounts[r.coupon_code] = (couponCounts[r.coupon_code] || 0) + 1;
      }
    });

    const sortedCoupons = Object.entries(couponCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxCount = Math.max(...sortedCoupons.map(c => c[1]), 1);

    // Usage chart
    let usageHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    sortedCoupons.forEach(([code, count]) => {
      const width = (count / maxCount) * 100;
      usageHtml += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="min-width: 120px; font-size: 14px; font-family: monospace; font-weight: 600; color: #0f172a;">${code}</div>
          <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="width: ${width}%; height: 100%; background: linear-gradient(90deg, #c9a86a 0%, #d4b577 100%);"></div>
          </div>
          <div style="min-width: 40px; text-align: right; font-weight: 600; color: #0f172a;">${count}</div>
        </div>
      `;
    });
    usageHtml += '</div>';

    // Impact analysis
    const withCoupon = reservations.filter(r => r.coupon_code);
    const withoutCoupon = reservations.filter(r => !r.coupon_code);
    
    const avgWithCoupon = withCoupon.length > 0 
      ? withCoupon.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0) / withCoupon.length 
      : 0;
    const avgWithoutCoupon = withoutCoupon.length > 0 
      ? withoutCoupon.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0) / withoutCoupon.length 
      : 0;

    const extrasWithCoupon = withCoupon.filter(r => r.extras_total > 0).length;
    const extrasWithoutCoupon = withoutCoupon.filter(r => r.extras_total > 0).length;
    
    const extrasRateWith = withCoupon.length > 0 ? (extrasWithCoupon / withCoupon.length) * 100 : 0;
    const extrasRateWithout = withoutCoupon.length > 0 ? (extrasWithoutCoupon / withoutCoupon.length) * 100 : 0;

    const impactHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Avg Booking with Coupon</div>
          <div style="font-size: 32px; font-weight: 600; color: #c9a86a;">${`GHS ${(avgWithCoupon).toFixed(2)}`}</div>
        </div>
        <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Avg Booking without Coupon</div>
          <div style="font-size: 32px; font-weight: 600; color: #0f172a;">${`GHS ${(avgWithoutCoupon).toFixed(2)}`}</div>
        </div>
        <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Extras Attachment Rate</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: #64748b;">With coupon:</span>
            <strong style="color: #10b981;">${extrasRateWith.toFixed(0)}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Without coupon:</span>
            <strong style="color: #0f172a;">${extrasRateWithout.toFixed(0)}%</strong>
          </div>
        </div>
      </div>
    `;

    document.getElementById('coupon-chart').innerHTML = usageHtml;
    document.getElementById('coupon-impact').innerHTML = impactHtml;
  } catch (error) {
    console.error('Error loading coupon charts:', error);
  }
}

async function loadUpcomingCheckins() {
  try {
    const today = new Date();
    const in7Days = new Date(today);
    in7Days.setDate(today.getDate() + 7);

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, room_type_code, guest_first_name, guest_last_name')
      .gte('check_in', today.toISOString().split('T')[0].split('T')[0])
      .lte('check_in', in7Days.toISOString().split('T')[0].split('T')[0])
      .in('status', ['confirmed', 'checked-in'])
      .order('check_in');

    if (error) throw error;

    let html = '';
    if (reservations && reservations.length > 0) {
      html = '<div style="display: flex; flex-direction: column;">';
      reservations.forEach(r => {
        const date = new Date(r.check_in).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        html += `
          <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <div style="min-width: 60px; font-weight: 600; color: #c9a86a;">${date}</div>
              <div style="min-width: 50px; font-weight: 600; color: #0f172a;">${r.room_type_code}</div>
              <div style="color: #64748b;">${r.guest_first_name} ${r.guest_last_name}</div>
            </div>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html = '<div style="text-align: center; padding: 40px; color: #94a3b8;">No upcoming check-ins</div>';
    }

    document.getElementById('upcoming-checkins').innerHTML = html;
  } catch (error) {
    console.error('Error loading upcoming check-ins:', error);
  }
}

async function loadCurrentStatus() {
  try {
    const today = new Date().toISOString().split('T')[0].split('T')[0];

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, check_out, status')
      .lte('check_in', today)
      .gte('check_out', today)
      .eq('status', 'checked-in');

    if (error) throw error;

    const occupied = reservations?.length || 0;
    const available = 3 - occupied;

    // Get next 30 days bookings
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const { data: upcoming } = await supabase
      .from('reservations')
      .select('id')
      .gte('check_in', today)
      .lte('check_in', in30Days.toISOString().split('T')[0].split('T')[0])
      .in('status', ['confirmed', 'checked-in']);

    const html = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${occupied}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Occupied</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${available}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Available</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">0</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Maintenance</div>
        </div>
      </div>
      <div style="padding: 24px; background: #f9fafb; border-radius: 8px; text-align: center;">
        <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Next 30 Days</div>
        <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${upcoming?.length || 0} Bookings</div>
      </div>
    `;

    document.getElementById('current-status').innerHTML = html;
  } catch (error) {
    console.error('Error loading current status:', error);
  }
}

function handlePeriodChange(e) {
  const period = e.target.value;
  const customRange = document.getElementById('custom-date-range');
  
  if (period === 'custom') {
    customRange.style.display = 'flex';
  } else {
    customRange.style.display = 'none';
    const days = parseInt(period);
    dateRange.end = new Date();
    dateRange.start = new Date();
    dateRange.start.setDate(dateRange.start.getDate() - days);
    loadAllAnalytics();
  }
}

function applyCustomDateRange() {
  const start = document.getElementById('analytics-start').value;
  const end = document.getElementById('analytics-end').value;
  
  if (start && end) {
    dateRange.start = new Date(start);
    dateRange.end = new Date(end);
    loadAllAnalytics();
  } else {
    toast('Please select both start and end dates');
  }
}

function exportAnalytics() {
  toast('Export functionality coming soon');
  // Future: Generate PDF or CSV export
}
