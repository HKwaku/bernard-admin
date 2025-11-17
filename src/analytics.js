// src/analytics.js
// Analytics Dashboard for Sojourn Cabins

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
    // Remove trailing .0
    if (value.endsWith('.0')) value = value.slice(0, -2);
    suffix = 'K';
  } else {
    return `${currency} ${amount.toFixed(2)}`;
  }
  
  // Remove trailing .0
  if (value.endsWith('.0')) value = value.slice(0, -2);
  
  return `${currency} ${value}${suffix}`;
}

// Date range state
let dateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  end: new Date()
};

function sqlDate(d) {
  return d.toISOString().split('T')[0];
}
// ---- Chart granularity state & helpers ----
// 'day' | 'week' | 'month' for each chart
const chartGranularity = {
  revenue: 'day',
  occupancy: 'day',
};

function daysInRange(start, end) {
  const diffMs = end - start;
  // +1 so a same-day range counts as 1 day, not 0
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

// Auto-pick D / W / M based on current dateRange
function autoSetGranularityFromRange() {
  const days = daysInRange(dateRange.start, dateRange.end);

  let mode = 'day';
  if (days > 90 && days <= 180) {
    mode = 'week';
  } else if (days > 180) {
    mode = 'month';
  }

  chartGranularity.revenue = mode;
  chartGranularity.occupancy = mode;

  // If buttons are already rendered, sync their active state
  setActiveChartButtons('revenue', mode);
  setActiveChartButtons('occupancy', mode);
}

// Toggle the active class on D / W / M buttons
function setActiveChartButtons(chart, mode) {
  document
    .querySelectorAll(`.chart-btn[data-chart="${chart}"]`)
    .forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === mode);
    });
}

export function initAnalytics() {
  renderAnalytics();
  autoSetGranularityFromRange();
  loadAllAnalytics();
}

function renderAnalytics() {
  const view = document.getElementById('view-analytics');
  if (!view) return;

view.innerHTML = `
  <div class="card-bd" style="padding: 16px; box-sizing: border-box;">

    <!-- Date Range Selector -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; width: 100%; box-sizing: border-box;">
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

    <!-- ========================================================= -->
    <!-- UPCOMING & OPERATIONAL  (MOVED TO TOP)                     -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Upcoming & Operational</h2>
      <div class="two-column upcoming-grid">
        <div class="chart-card">
          <h3 class="chart-title">Next 7 Days Check-Ins</h3>
          <div id="upcoming-checkins">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 class="chart-title">Current Status</h3>
          <div id="current-status">Loading...</div>
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- OCCUPANCY OVERVIEW                                        -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Occupancy Overview</h2>
      <div class="metrics-grid" id="occupancy-metrics">
        <div class="metric-card"><div class="metric-label">Loading...</div></div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- OCCUPANCY TREND (LINE CHART) + SOURCES                    -->
    <!-- ========================================================= -->
    <div class="analytics-section">
    <h2 class="analytics-section-title">Occupancy & Sources</h2>
      <div class="chart-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 class="chart-title">Occupancy Trend</h3>
          <div class="chart-controls">
            <button class="chart-btn" data-chart="occupancy" data-period="day">D</button>
            <button class="chart-btn" data-chart="occupancy" data-period="week">W</button>
            <button class="chart-btn active" data-chart="occupancy" data-period="month">M</button>
          </div>

        </div>

        <div
          id="occupancy-trend-chart"
          style="height: 280px; display: flex; align-items: center; justify-content: center; color: #64748b;"
        >
          Loading chart...
        </div>

        <div style="margin-top: 32px;">
          <h4 class="chart-subtitle">Occupancy by Cabin</h4>
          <div id="occupancy-chart">Loading...</div>
        </div>
      </div>

      <div class="chart-card">
        <h3 class="chart-title">Booking Sources</h3>
        <div id="sources-chart">Loading...</div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- REVENUE OVERVIEW                                          -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Revenue Overview</h2>
      <div class="metrics-grid" id="revenue-metrics">
        <div class="metric-card"><div class="metric-label">Loading...</div></div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- REVENUE TREND (LINE CHART)                                -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Revenue Trend</h2>
      <div class="chart-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 class="chart-title">Revenue Trend</h3>
          <div class="chart-controls">
            <button class="chart-btn" data-chart="revenue" data-period="day">D</button>
            <button class="chart-btn" data-chart="revenue" data-period="week">W</button>
            <button class="chart-btn active" data-chart="revenue" data-period="month">M</button>
          </div>

        </div>
        <div id="revenue-chart" style="height: 280px; display: flex; align-items: center; justify-content: center; color: #64748b;">
          Loading chart...
        </div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- EXTRAS PERFORMANCE                                        -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Extras & Add-ons Performance</h2>
      <div class="metrics-grid" id="extras-metrics">
        <div class="metric-card"><div class="metric-label">Loading...</div></div>
      </div>

      <div class="two-column" style="margin-top: 20px;">
        <div class="chart-card">
          <h3 class="chart-title">Top Extras by Bookings</h3>
          <div id="extras-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 class="chart-title">Extras Revenue Breakdown</h3>
          <div id="extras-revenue-chart">Loading...</div>
        </div>
      </div>

      <div class="chart-card" style="margin-top: 20px;">
        <h3 class="chart-title">Extras Pairing Analysis</h3>
        <div id="pairing-analysis">Loading...</div>
      </div>
    </div>

    <!-- ========================================================= -->
    <!-- PACKAGE PERFORMANCE                                       -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Package Performance</h2>
      <div class="metrics-grid" id="package-metrics">
        <div class="metric-card"><div class="metric-label">Loading...</div></div>
      </div>

      <div class="two-column" style="margin-top: 20px;">
        <div class="chart-card">
          <h3 class="chart-title">Package Bookings</h3>
          <div id="package-chart">Loading...</div>
        </div>
        <div class="chart-card">
          <h3 class="chart-title">Package Revenue Split</h3>
          <div id="package-revenue-chart">Loading...</div>
        </div>
      </div>
    </div>

   
    <!-- ========================================================= -->
    <!-- COUPON ANALYTICS                                          -->
    <!-- ========================================================= -->
    <div class="analytics-section">
      <h2 class="analytics-section-title">Coupon Analytics</h2>

      <div class="metrics-grid" id="coupon-metrics">
        <div class="metric-card"><div class="metric-label">Loading...</div></div>
      </div>

      <div class="chart-card" style="margin-top: 20px;">
        <h3 class="chart-title">Top Coupons by Usage</h3>
        <div id="coupon-chart">Loading...</div>
      </div>
    </div>
  </div>
`;

  // Chart granularity buttons (Revenue + Occupancy)
  document.querySelectorAll('.chart-btn').forEach((btn) => {
    btn.addEventListener('click', handleChartGranularityClick);
  });

  // Event listeners
  document.getElementById('analytics-period')?.addEventListener('change', handlePeriodChange);
  document.getElementById('apply-date-range')?.addEventListener('click', applyCustomDateRange);
  document.getElementById('export-analytics')?.addEventListener('click', exportAnalytics);
}

async function loadAllAnalytics() {
  try {
    await Promise.all([
      loadOccupancyMetrics(),
      loadRevenueMetrics(),
      loadRevenueChart(),
      loadOccupancyTrendChart(),
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

async function loadOccupancyMetrics() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, check_out, nights, room_type_code')
      .gte('check_in', sqlDate(dateRange.start))
      .lte('check_in', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Nights sold (fallback to date difference if nights missing)
    const totalNightsSold = reservations.reduce((sum, r) => {
      if (r.nights && r.nights > 0) return sum + r.nights;
      if (r.check_in && r.check_out) {
        const inDate = new Date(r.check_in);
        const outDate = new Date(r.check_out);
        const diff = Math.round((outDate - inDate) / (1000 * 60 * 60 * 24));
        return sum + Math.max(diff, 0);
      }
      return sum;
    }, 0);

    const daysInPeriod = Math.max(
      1,
      Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24))
    );

    const NUM_CABINS = 3; // SAND, SEA, SUN
    const totalAvailableNights = daysInPeriod * NUM_CABINS;

    const occupancyRate =
      totalAvailableNights > 0
        ? (totalNightsSold / totalAvailableNights) * 100
        : 0;

    const avgLOS =
      reservations.length > 0 ? totalNightsSold / reservations.length : 0;

    const bookingsCount = reservations.length;

    const html = `
      <div class="metric-card">
        <div class="metric-label">Occupancy Rate</div>
        <div class="metric-value">${occupancyRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Nights Sold</div>
        <div class="metric-value">${totalNightsSold}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Available Nights</div>
        <div class="metric-value">${totalAvailableNights}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Length of Stay</div>
        <div class="metric-value">${avgLOS.toFixed(1)} nights</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Bookings in Period</div>
        <div class="metric-value">${bookingsCount}</div>
      </div>
    `;

    document.getElementById('occupancy-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading occupancy metrics:', error);
    document.getElementById('occupancy-metrics').innerHTML =
      '<div class="metric-card"><div class="metric-label">Error loading data</div></div>';
  }
}

async function loadRevenueMetrics() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('total, room_subtotal, extras_total, check_in, nights')
      .gte('check_in', sqlDate(dateRange.start))
      .lte('check_in', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const totalRevenue = reservations.reduce(
      (sum, r) => sum + (parseFloat(r.total) || 0),
      0
    );
    const roomRevenue = reservations.reduce(
      (sum, r) => sum + (parseFloat(r.room_subtotal) || 0),
      0
    );
    const extrasRevenue = reservations.reduce(
      (sum, r) => sum + (parseFloat(r.extras_total) || 0),
      0
    );

    const totalNights = reservations.reduce(
      (sum, r) => sum + (r.nights || 0),
      0
    );

    const avgBookingValue =
      reservations.length > 0 ? totalRevenue / reservations.length : 0;

    // RevPAR here is revenue per sold night in the range
    const revPAR = totalNights > 0 ? totalRevenue / totalNights : 0;

    // ADR = room revenue per sold night
    const adr = totalNights > 0 ? roomRevenue / totalNights : 0;

    const html = `
      <div class="metric-card">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(totalRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Room Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(roomRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Extras Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(extrasRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Booking Value</div>
        <div class="metric-value">${formatCurrencyCompact(avgBookingValue, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">RevPAR</div>
        <div class="metric-value">${formatCurrencyCompact(revPAR, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">ADR</div>
        <div class="metric-value">${formatCurrencyCompact(adr, 'GHS')}</div>
      </div>
    `;

    document.getElementById('revenue-metrics').innerHTML = html;
  } catch (error) {
    console.error('Error loading revenue metrics:', error);
    document.getElementById('revenue-metrics').innerHTML =
      '<div class="metric-card"><div class="metric-label">Error loading data</div></div>';
  }
}

function renderLineChart(containerId, points, options = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!points || !points.length) {
    el.innerHTML = '<div class="analytics-empty">No data available</div>';
    return;
  }

  const values = points.map((p) => p.value);
  const minValue = options.min != null ? options.min : Math.min(...values, 0);
  const maxValue =
    options.max != null ? options.max : Math.max(...values, minValue || 0);

  const width = 100;
  const height = 40;
  const padX = 6;
  const padY = 6;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const stepX = points.length === 1 ? 0 : innerW / (points.length - 1);

  const normalizeY = (v) => {
    if (maxValue === minValue) return padY + innerH / 2;
    const ratio = (v - minValue) / (maxValue - minValue);
    return padY + innerH - ratio * innerH;
  };

  const decimals = options.decimals ?? 0;
  const valueFormatter =
    options.formatValue ||
    ((v, label) => {
      const prefix = options.valuePrefix ?? '';
      const suffix = options.valueSuffix ?? '';
      const title = options.tooltipTitle ?? '';
      const valueStr =
        typeof v === 'number' ? v.toFixed(decimals) : Number(v).toFixed(decimals);
      const main = `${prefix}${valueStr}${suffix}`;
      return title ? `${title}: ${main} (${label})` : `${label}: ${main}`;
    });

  const pathD = points
    .map((p, i) => {
      const x = padX + stepX * i;
      const y = normalizeY(p.value);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const circles = points
    .map((p, i) => {
      const x = padX + stepX * i;
      const y = normalizeY(p.value);
      return `<circle class="chart-point"
                cx="${x.toFixed(2)}"
                cy="${y.toFixed(2)}"
                r="0.5"
                stroke="#3B82F6"
                fill="#ffffff">
              </circle>`;
    })
    .join('');

  const labels = points
    .map(
      (p) =>
        `<div class="chart-x-label">${p.label}</div>`
    )
    .join('');

  const gradientId = `${containerId}-gradient`;

  el.innerHTML = `
    <div class="chart-line-wrapper">
      <div class="chart-line-tooltip" id="${containerId}-tooltip"></div>
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-line-svg">
        <defs>
          <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.25"></stop>
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"></stop>
          </linearGradient>
        </defs>
        <path d="${pathD}"
            fill="none"
            stroke="#3B82F6"      <!-- soft blue -->
            stroke-width="0.5"
            stroke-linejoin="round"
            stroke-linecap="round"
        ></path>
    
        ${circles}
      </svg>
      <div class="chart-line-labels">
        ${labels}
      </div>
    </div>
  `;

  // Attach hover interactions
  const svg = el.querySelector('.chart-line-svg');
  const tooltip = el.querySelector('.chart-line-tooltip');
  const wrapper = el.querySelector('.chart-line-wrapper');
  const pointsEls = el.querySelectorAll('.chart-point');

  if (!svg || !tooltip || !wrapper) return;

  const wrapperRect = () => wrapper.getBoundingClientRect();
  const svgRect = () => svg.getBoundingClientRect();

  pointsEls.forEach((pt) => {
    pt.addEventListener('mouseenter', (e) => {
      const label = e.target.getAttribute('data-label') || '';
      const rawVal = parseFloat(e.target.getAttribute('data-value') || '0');
      tooltip.textContent = valueFormatter(rawVal, label);

      const cx = parseFloat(e.target.getAttribute('cx') || '0');
      const sRect = svgRect();
      const wRect = wrapperRect();
      const relativeX = ((cx / width) * sRect.width) + (sRect.left - wRect.left);

      tooltip.style.left = `${relativeX}px`;
      tooltip.style.opacity = '1';
    });

    pt.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });
}

async function loadRevenueChart() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('total, check_in')
      .gte('check_in', sqlDate(dateRange.start))
      .lte('check_in', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('check_in');

    if (error) throw error;

    if (!reservations || !reservations.length) {
      renderLineChart('revenue-chart', []);
      return;
    }

    // --- Daily revenue series ---
    const dailyMap = {};
    reservations.forEach((r) => {
      if (!r.check_in) return;
      const key = sqlDate(new Date(r.check_in)); // YYYY-MM-DD
      const val = parseFloat(r.total) || 0;
      dailyMap[key] = (dailyMap[key] || 0) + val;
    });

    const dailySeries = Object.keys(dailyMap)
      .sort()
      .map((key) => {
        const date = new Date(key + 'T00:00:00');
        return { date, value: dailyMap[key] };
      });

    const mode = chartGranularity.revenue || 'day';
    let points = [];

    if (mode === 'day') {
      points = dailySeries.map(({ date, value }) => ({
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
      }));
    } else {
      // --- Weekly / Monthly buckets (sum of revenue) ---
      const buckets = {};

      dailySeries.forEach(({ date, value }) => {
        let bucketKey;
        let labelDate;

        if (mode === 'week') {
          const weekStart = new Date(date);
          const day = weekStart.getDay(); // 0..6
          const diff = (day + 6) % 7;     // days since Monday
          weekStart.setDate(weekStart.getDate() - diff);
          bucketKey = sqlDate(weekStart);
          labelDate = weekStart;
        } else {
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          bucketKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
          labelDate = monthStart;
        }

        const bucket = buckets[bucketKey] || { total: 0, date: labelDate };
        bucket.total += value;
        buckets[bucketKey] = bucket;
      });

      const sortedBuckets = Object.values(buckets).sort(
        (a, b) => a.date - b.date
      );

      points = sortedBuckets.map(({ date, total }) => ({
        label:
          mode === 'month'
            ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: total,
      }));
    }

    renderLineChart('revenue-chart', points, { 
      min: 0,
      formatValue: (v, label) => `${label}: ${formatCurrencyCompact(v, 'GHS')}`
    });
  } catch (error) {
    console.error('Error loading revenue chart:', error);
    const el = document.getElementById('revenue-chart');
    if (el) {
      el.innerHTML =
        '<div style="text-align:center;color:#ef4444;">Error loading chart</div>';
    }
  }
}


async function loadOccupancyTrendChart() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, check_out')
      .gte('check_in', sqlDate(dateRange.start))
      .lte('check_in', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('check_in');

    if (error) throw error;

    const NUM_CABINS = 3;
    const occupancyByDate = {};

    // Expand each reservation into per-night occupancy
    (reservations || []).forEach((r) => {
      if (!r.check_in || !r.check_out) return;

      const start = new Date(r.check_in);
      const end = new Date(r.check_out);

      let d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      while (d < last) {
        const key = sqlDate(d);
        if (d >= dateRange.start && d <= dateRange.end) {
          occupancyByDate[key] = (occupancyByDate[key] || 0) + 1;
        }
        d.setDate(d.getDate() + 1);
      }
    });

    // --- Daily occupancy series (% of cabins) ---
    const dailySeries = [];
    let cursor = new Date(
      dateRange.start.getFullYear(),
      dateRange.start.getMonth(),
      dateRange.start.getDate()
    );
    const endDay = new Date(
      dateRange.end.getFullYear(),
      dateRange.end.getMonth(),
      dateRange.end.getDate()
    );

    while (cursor <= endDay) {
      const key = sqlDate(cursor);
      const occupiedCabins = occupancyByDate[key] || 0;
      const rate = Math.min(100, (occupiedCabins / NUM_CABINS) * 100);
      dailySeries.push({
        date: new Date(cursor),
        value: rate,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const mode = chartGranularity.occupancy || 'day';
    let points = [];

    if (mode === 'day') {
      points = dailySeries.map(({ date, value }) => ({
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: parseFloat(value.toFixed(1)),
      }));
    } else {
      // --- Weekly / Monthly buckets (average occupancy %) ---
      const buckets = {};

      dailySeries.forEach(({ date, value }) => {
        let bucketKey;
        let labelDate;

        if (mode === 'week') {
          const weekStart = new Date(date);
          const day = weekStart.getDay();
          const diff = (day + 6) % 7;
          weekStart.setDate(weekStart.getDate() - diff);
          bucketKey = sqlDate(weekStart);
          labelDate = weekStart;
        } else {
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          bucketKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
          labelDate = monthStart;
        }

        const bucket =
          buckets[bucketKey] || { sum: 0, count: 0, date: labelDate };
        bucket.sum += value;
        bucket.count += 1;
        buckets[bucketKey] = bucket;
      });

      const sortedBuckets = Object.values(buckets).sort(
        (a, b) => a.date - b.date
      );

      points = sortedBuckets.map(({ date, sum, count }) => {
        const avg = count > 0 ? sum / count : 0;
        return {
          label:
            mode === 'month'
              ? date.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
          value: parseFloat(avg.toFixed(1)),
        };
      });
    }

    renderLineChart('occupancy-trend-chart', points, {
      min: 0,
      max: 100,
    });
  } catch (error) {
    console.error('Error loading occupancy trend chart:', error);
    const el = document.getElementById('occupancy-trend-chart');
    if (el) {
      el.innerHTML =
        '<div style="text-align:center;color:#ef4444;">Error loading chart</div>';
    }
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
            <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%); transition: width 0.5s ease;"></div>
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
        <div class="metric-value">${formatCurrencyCompact(totalRevenue, 'GHS')}</div>
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
            <div style="width: ${width}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%);"></div>
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
            <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${formatCurrencyCompact(revenue, 'GHS')}</span>
          </div>
        </div>
      `;
    });
    revenueHtml += `</div>
      <div style="text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
        Total: <strong style="color: #0f172a;">${formatCurrencyCompact(totalRevenue, 'GHS')}</strong>
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
        <div class="metric-value">${formatCurrencyCompact(packageRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avg Package Value</div>
        <div class="metric-value">${formatCurrencyCompact(avgPackageValue, 'GHS')}</div>
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

    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select(
        'coupon_code, coupon_discount, discount_amount, total, extras_total, check_in'
      )
      .gte('check_in', sqlDate(dateRange.start))
      .lte('check_in', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (couponsError || resError) throw (couponsError || resError);

    const allRes = reservations || [];

    // ---------- Split reservations ----------
    const withCouponRes = allRes.filter((r) => r.coupon_code);
    const withoutCouponRes = allRes.filter((r) => !r.coupon_code);

    // ---------- Core coupon metrics ----------
    const totalDiscount = withCouponRes.reduce((sum, r) => {
      const couponDisc = parseFloat(r.coupon_discount) || 0;
      const extraDisc = parseFloat(r.discount_amount) || 0;
      return sum + couponDisc + extraDisc;
    }, 0);

    const avgDiscount =
      withCouponRes.length > 0 ? totalDiscount / withCouponRes.length : 0;

    const redemptionRate =
      allRes.length > 0 ? (withCouponRes.length / allRes.length) * 100 : 0;

    // ---------- Most used coupon (from coupons.current_uses) ----------
    const mostUsed =
      (coupons || [])
        .filter((c) => (c.current_uses || 0) > 0)
        .sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))
        .slice(-1)[0] || null;

    // ---------- Impact metrics ----------
    const sumTotal = (rows) =>
      rows.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);

    const countWithExtras = (rows) =>
      rows.filter((r) => (parseFloat(r.extras_total) || 0) > 0).length;

    const avgWith =
      withCouponRes.length > 0
        ? sumTotal(withCouponRes) / withCouponRes.length
        : 0;

    const avgWithout =
      withoutCouponRes.length > 0
        ? sumTotal(withoutCouponRes) / withoutCouponRes.length
        : 0;

    const extrasWith = countWithExtras(withCouponRes);
    const extrasWithout = countWithExtras(withoutCouponRes);

    const attachWith =
      withCouponRes.length > 0
        ? (extrasWith / withCouponRes.length) * 100
        : 0;

    const attachWithout =
      withoutCouponRes.length > 0
        ? (extrasWithout / withoutCouponRes.length) * 100
        : 0;

    // ---------- ALL coupon metrics in one metricsHtml ----------
    const metricsHtml = `
      <div class="metric-card">
        <div class="metric-label">Total Discount Given</div>
        <div class="metric-value">${formatCurrencyCompact(totalDiscount, 'GHS')}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Avg Discount</div>
        <div class="metric-value">${formatCurrencyCompact(avgDiscount, 'GHS')}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Avg Booking with Coupon</div>
        <div class="metric-value">${formatCurrencyCompact(avgWith, 'GHS')}</div>
        <div class="metric-subtext">Based on ${withCouponRes.length} bookings</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Avg Booking without Coupon</div>
        <div class="metric-value">${formatCurrencyCompact(avgWithout, 'GHS')}</div>
        <div class="metric-subtext">Based on ${withoutCouponRes.length} bookings</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Active Coupons</div>
        <div class="metric-value">${coupons?.length || 0}</div>
        <div class="metric-subtext">currently active</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Redemption Rate</div>
        <div class="metric-value">${redemptionRate.toFixed(0)}%</div>
      </div>

      <!-- Most used coupon -->
      <div class="metric-card">
        <div class="metric-label">Most Used Coupon</div>
        <div class="metric-value">${mostUsed ? mostUsed.code : 'N/A'}</div>
        <div class="metric-subtext">
          ${mostUsed ? `${mostUsed.current_uses} uses` : ''}
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Extras Attachment Rate</div>
        <div class="metric-value">${attachWith.toFixed(
          0
        )}% vs ${attachWithout.toFixed(0)}%</div>
        <div class="metric-subtext">With coupon vs without coupon</div>
      </div>
    `;

    const metricsEl = document.getElementById('coupon-metrics');
    if (metricsEl) metricsEl.innerHTML = metricsHtml;
  } catch (error) {
    console.error('Error loading coupon metrics:', error);
    const metricsEl = document.getElementById('coupon-metrics');
    if (metricsEl) {
      metricsEl.innerHTML =
        '<div class="metric-card"><div class="metric-label">Error loading data</div></div>';
    }
  }
}

async function loadCouponCharts() {
  try {
    // Only load coupons for usage chart
    const { data: coupons, error } = await supabase
      .from('coupons')
      .select('code, current_uses')
      .eq('is_active', true);

    if (error) throw error;

    /* ----------------------------------------------------------
       TOP COUPONS BY USAGE  (uses coupons.current_uses)
    ---------------------------------------------------------- */
    const sortedCoupons = (coupons || [])
      .filter(c => (c.current_uses || 0) > 0)
      .sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))
      .slice(0, 5);

    let usageHtml = '';

    if (!sortedCoupons.length) {
      usageHtml =
        '<div style="padding: 12px; text-align: center; color: #64748b;">No coupon usage in this period</div>';
    } else {
      const maxUsage = Math.max(...sortedCoupons.map(c => c.current_uses || 0), 1);

      usageHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
      sortedCoupons.forEach(c => {
        const count = c.current_uses || 0;
        const width = (count / maxUsage) * 100;

        usageHtml += `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="min-width: 120px; font-size: 14px; font-family: monospace; font-weight: 600; color: #0f172a;">
              ${c.code}
            </div>
            <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
              <div style="
                width: ${width}%;
                height: 100%;
                background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%);
              "></div>
            </div>
            <div style="min-width: 32px; text-align: right; font-size: 14px; font-weight: 600; color: #0f172a;">
              ${count}
            </div>
          </div>
        `;
      });
      usageHtml += '</div>';
    }

    const couponChartEl = document.getElementById('coupon-chart');
    if (couponChartEl) couponChartEl.innerHTML = usageHtml;

  } catch (error) {
    console.error('Error loading coupon charts:', error);
    const chartEl = document.getElementById('coupon-chart');
    if (chartEl) {
      chartEl.innerHTML =
        '<div style="text-align: center; color: #ef4444;">Error loading coupon data</div>';
    }
  }
}

async function loadUpcomingCheckins() {
  try {
    const today = new Date();
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);

    const todayStr = sqlDate(today);      // YYYY-MM-DD
    const in7DaysStr = sqlDate(in7Days);  // YYYY-MM-DD

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, room_type_code, guest_first_name, guest_last_name')
      .gte('check_in', todayStr)
      .lte('check_in', in7DaysStr)
      .in('status', ['confirmed', 'checked-in'])
      .order('check_in');

    if (error) throw error;

    const el = document.getElementById('upcoming-checkins');
    if (!el) return;

    if (!reservations || reservations.length === 0) {
      el.innerHTML =
        '<div class="analytics-empty">No upcoming check-ins in the next 7 days</div>';
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">';

    reservations.forEach((r) => {
      const date = new Date(r.check_in);
      const dateLabel = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      const guestName = [r.guest_first_name, r.guest_last_name]
        .filter(Boolean)
        .join(' ') || 'Guest';

      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
            <span style="font-weight: 600; color: #c9a86a;">${dateLabel}</span>
            <span style="font-weight: 600; color: #0f172a;">${r.room_type_code || ''}</span>
          </div>
          <div style="font-size: 14px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${guestName}</div>
        </div>
      `;
    });

    html += '</div>';

    el.innerHTML = html;
  } catch (error) {
    console.error('Error loading upcoming check-ins:', error);
    const el = document.getElementById('upcoming-checkins');
    if (el) {
      el.innerHTML =
        '<div style="text-align:center; color:#ef4444;">Error loading upcoming check-ins</div>';
    }
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
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; width: 100%; box-sizing: border-box;">
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; box-sizing: border-box;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${occupied}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Occupied</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; box-sizing: border-box;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${available}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Available</div>
        </div>
        <div style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; box-sizing: border-box;">
          <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">0</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Maintenance</div>
        </div>
      </div>
      <div style="padding: 24px; background: #f9fafb; border-radius: 8px; text-align: center; width: 100%; box-sizing: border-box;">
        <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Next 30 Days</div>
        <div style="font-size: 36px; font-weight: 600; color: #c9a86a;">${upcoming?.length || 0} Bookings</div>
      </div>
    `;

    document.getElementById('current-status').innerHTML = html;
  } catch (error) {
    console.error('Error loading current status:', error);
  }
}

function handleChartGranularityClick(e) {
  const btn = e.currentTarget;
  const period = btn.dataset.period;
  const chart = btn.dataset.chart;
  if (!period || !chart) return;

  chartGranularity[chart] = period;
  setActiveChartButtons(chart, period);

  if (chart === 'revenue') {
    loadRevenueChart();
  } else if (chart === 'occupancy') {
    loadOccupancyTrendChart();
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
    autoSetGranularityFromRange();
    loadAllAnalytics();
  }
}

function applyCustomDateRange() {
  const start = document.getElementById('analytics-start').value;
  const end = document.getElementById('analytics-end').value;
  
  if (start && end) {
    dateRange.start = new Date(start);
    dateRange.end = new Date(end);
    autoSetGranularityFromRange();
    loadAllAnalytics();
  } else {
    toast('Please select both start and end dates');
  }
}

function exportAnalytics() {
  toast('Export functionality coming soon');
  // Future: Generate PDF or CSV export
}
