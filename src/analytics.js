// src/analytics.js
// Analytics Dashboard for Sojourn Cabins

import { renderComparisonView } from './analytics-comparison.js';
import { initClientAnalytics, updateClientAnalyticsDateRange } from './client-analytics.js';
import { supabase } from './config/supabase.js';
import { formatCurrency, toast } from './utils/helpers.js';

// Country code to country name mapping
const COUNTRY_CODE_MAP = {
  // Africa
  "+213": "Algeria", "+244": "Angola", "+229": "Benin", "+267": "Botswana",
  "+226": "Burkina Faso", "+257": "Burundi", "+237": "Cameroon", "+238": "Cape Verde",
  "+236": "Central African Republic", "+235": "Chad", "+269": "Comoros", "+242": "Congo",
  "+243": "Congo (DRC)", "+225": "Côte d'Ivoire", "+253": "Djibouti", "+20": "Egypt",
  "+240": "Equatorial Guinea", "+291": "Eritrea", "+251": "Ethiopia", "+241": "Gabon",
  "+220": "Gambia", "+233": "Ghana", "+224": "Guinea", "+245": "Guinea-Bissau",
  "+254": "Kenya", "+266": "Lesotho", "+231": "Liberia", "+218": "Libya",
  "+261": "Madagascar", "+265": "Malawi", "+223": "Mali", "+222": "Mauritania",
  "+230": "Mauritius", "+212": "Morocco", "+258": "Mozambique", "+264": "Namibia",
  "+227": "Niger", "+234": "Nigeria", "+250": "Rwanda", "+239": "Sao Tome & Principe",
  "+221": "Senegal", "+248": "Seychelles", "+232": "Sierra Leone", "+252": "Somalia",
  "+27": "South Africa", "+211": "South Sudan", "+249": "Sudan", "+268": "Eswatini",
  "+255": "Tanzania", "+216": "Tunisia", "+256": "Uganda", "+260": "Zambia", "+263": "Zimbabwe",
  
  // Europe
  "+355": "Albania", "+43": "Austria", "+32": "Belgium", "+359": "Bulgaria",
  "+385": "Croatia", "+357": "Cyprus", "+420": "Czechia", "+45": "Denmark",
  "+372": "Estonia", "+358": "Finland", "+33": "France", "+49": "Germany",
  "+30": "Greece", "+36": "Hungary", "+354": "Iceland", "+353": "Ireland",
  "+39": "Italy", "+371": "Latvia", "+370": "Lithuania", "+352": "Luxembourg",
  "+356": "Malta", "+373": "Moldova", "+377": "Monaco", "+382": "Montenegro",
  "+31": "Netherlands", "+47": "Norway", "+48": "Poland", "+351": "Portugal",
  "+40": "Romania", "+7": "Russia/Kazakhstan", "+381": "Serbia", "+421": "Slovakia",
  "+386": "Slovenia", "+34": "Spain", "+46": "Sweden", "+41": "Switzerland",
  "+44": "United Kingdom", "+380": "Ukraine",
  
  // Americas
  "+1": "USA/Canada", "+52": "Mexico", "+55": "Brazil", "+54": "Argentina",
  "+57": "Colombia", "+56": "Chile", "+51": "Peru", "+58": "Venezuela",
  
  // Asia
  "+93": "Afghanistan", "+374": "Armenia", "+994": "Azerbaijan", "+880": "Bangladesh",
  "+975": "Bhutan", "+673": "Brunei", "+855": "Cambodia", "+86": "China",
  "+91": "India", "+62": "Indonesia", "+98": "Iran", "+964": "Iraq",
  "+972": "Israel", "+81": "Japan", "+962": "Jordan", "+965": "Kuwait",
  "+996": "Kyrgyzstan", "+856": "Laos", "+961": "Lebanon", "+60": "Malaysia",
  "+960": "Maldives", "+976": "Mongolia", "+977": "Nepal", "+92": "Pakistan",
  "+63": "Philippines", "+65": "Singapore", "+94": "Sri Lanka", "+82": "South Korea",
  "+886": "Taiwan", "+66": "Thailand", "+90": "Turkey", "+971": "UAE",
  "+998": "Uzbekistan", "+84": "Vietnam",
  
  // Oceania
  "+61": "Australia", "+64": "New Zealand", "+679": "Fiji", "+685": "Samoa", "+676": "Tonga"
};

// View mode state: 'standard' or 'comparison'
let viewMode = 'standard';

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

const _now = new Date();

let dateRange = {
  start: new Date(_now.getFullYear(), _now.getMonth(), 1),
  // Full calendar month end (not "today")
  end: new Date(_now.getFullYear(), _now.getMonth() + 1, 0)
};


function sqlDate(d) {
  return d.toISOString().split('T')[0];
}

// Display helper for UK-style dates (DD/MM/YYYY)
function formatDateUK(d) {
  try {
    return d.toLocaleDateString('en-GB');
  } catch {
    return '';
  }
}

// Parse UK date string "DD/MM/YYYY" -> Date (local midnight)
function parseDateUK(value) {
  if (!value) return null;
  const s = String(value).trim();

  // Accept DD/MM/YYYY (optionally allow "-" too)
  const parts = s.includes('/') ? s.split('/') : s.split('-');
  if (parts.length !== 3) return null;

  const [dd, mm, yyyy] = parts.map(p => p.trim());
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);

  if (!year || !month || !day) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);

  // Validate (catches 31/02/2026 etc.)
  if (d.getFullYear() !== year || d.getMonth() !== (month - 1) || d.getDate() !== day) return null;

  return d;
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
  if (days > 31 && days <= 90) {
    mode = 'week';
  } else if (days > 90) {
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
  renderStandardViewContent();
}

function renderAnalytics() {
  const view = document.getElementById('view-analytics');
  if (!view) return;

view.innerHTML = `
  <div class="card-bd" style="padding: 16px; box-sizing: border-box;">

    <!-- Date Range Selector + View Toggle -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; width: 100%; box-sizing: border-box;">
      <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <!-- Month dropdown (checkbox multi-select) -->
        <div id="month-dd" style="position: relative;">
          <button id="month-dd-btn" type="button" class="select" style="min-width:118px;">
            All Months
          </button>
          <div id="month-dd-menu" style="
            display:none;
            position:absolute;
            z-index:50;
            margin-top:6px;
            background:#fff;
            border:1px solid #e2e8f0;
            border-radius:10px;
            box-shadow:0 10px 25px rgba(0,0,0,0.08);
            padding:10px;
            width:220px;
          ">
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Months</div>
            <label style="display:flex;gap:8px;align-items:center;padding:6px 4px;cursor:pointer;">
              <input type="checkbox" data-month="all" checked />
              <span>All Months</span>
            </label>
            <div style="height:1px;background:#e2e8f0;margin:8px 0;"></div>

            ${[
              'January','February','March','April','May','June',
              'July','August','September','October','November','December'
            ].map((m, i) => `
              <label style="display:flex;gap:8px;align-items:center;padding:6px 4px;cursor:pointer;">
                <input type="checkbox" data-month="${i}" />
                <span>${m}</span>
              </label>
            `).join('')}

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
              <button id="month-dd-clear" type="button" class="btn btn-sm" style="background:transparent;border:1px solid #e2e8f0;color:#64748b;">Clear</button>
              <button id="month-dd-apply" type="button" class="btn btn-sm">Apply</button>
            </div>
          </div>
        </div>

        <!-- Year dropdown (checkbox multi-select) -->
        <div id="year-dd" style="position: relative;">
          <button id="year-dd-btn" type="button" class="select" style="min-width:78px;">
            ${new Date().getFullYear()}
          </button>
          <div id="year-dd-menu" style="
            display:none;
            position:absolute;
            z-index:50;
            margin-top:6px;
            background:#fff;
            border:1px solid #e2e8f0;
            border-radius:10px;
            box-shadow:0 10px 25px rgba(0,0,0,0.08);
            padding:10px;
            width:160px;
          ">
            <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Years</div>
            <div id="year-dd-options"></div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
              <button id="year-dd-clear" type="button" class="btn btn-sm" style="background:transparent;border:1px solid #e2e8f0;color:#64748b;">Clear</button>
              <button id="year-dd-apply" type="button" class="btn btn-sm">Apply</button>
            </div>
          </div>
        </div>


        <!-- Custom range trigger -->
        <span style="color: #cbd5e1; font-size: 13px; margin: 0 2px;">|</span>
        <button id="btn-custom-range" class="btn btn-sm" style="background: transparent; border: 1px solid #e2e8f0; color: #64748b; padding: 5px 9px; font-size: 12px; border-radius: 6px; cursor: pointer;">Custom</button>
        <span id="custom-range-label" style="color:#64748b;font-size:12px;">&nbsp;</span>
        <!-- Custom date-range pickers (hidden until Custom clicked) -->
        <div id="custom-date-range" style="display: none; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input
          type="text"
          id="analytics-start"
          class="input"
          style="width: 120px;"
          placeholder="DD/MM/YYYY"
          inputmode="numeric"
          autocomplete="off"
        >
        <span style="color: #64748b;">to</span>
        <input
          type="text"
          id="analytics-end"
          class="input"
          style="width: 120px;"
          placeholder="DD/MM/YYYY"
          inputmode="numeric"
          autocomplete="off"
        >
        <button id="apply-date-range" class="btn btn-sm">Apply</button>
      </div>

      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <!-- View Toggle -->
        <div class="chart-controls">
          <button class="chart-btn active" id="view-standard" data-view="standard">Standard</button>
          <button class="chart-btn" id="view-comparison" data-view="comparison">Comparison</button>
          <button class="chart-btn" id="view-client" data-view="client">Client Analytics</button>
        </div>
        </div>
    </div>

    <!-- Content Container -->
    <div id="analytics-content">

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

    </div><!-- End analytics-content -->
  </div>
`;

// Initialise month/year checkbox dropdowns (must run AFTER HTML exists)
initMonthYearCheckboxDropdowns();

// Initialize date pickers for custom date range with UK format
function initDatePickers() {
  function setupFlatpickr() {
    flatpickr('#analytics-start', {
      dateFormat: 'd/m/Y',
      allowInput: true,
      onClose: function(selectedDates, dateStr, instance) {
        // When date is selected, keep UK format
      }
    });
    
    flatpickr('#analytics-end', {
      dateFormat: 'd/m/Y',
      allowInput: true,
      onClose: function(selectedDates, dateStr, instance) {
        // When date is selected, keep UK format
      }
    });
  }
  
  // Check if flatpickr is already loaded
  if (typeof flatpickr !== 'undefined') {
    setupFlatpickr();
  } else {
    // Dynamically load flatpickr
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
    document.head.appendChild(link);
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
    script.onload = () => {
      setupFlatpickr();
    };
    script.onerror = () => {
      console.error('Failed to load flatpickr');
    };
    document.head.appendChild(script);
  }
}

// Call it after a short delay to ensure DOM is ready
setTimeout(initDatePickers, 100);
syncCheckboxDropdownsToDateRange();

  // Chart granularity buttons (Revenue + Occupancy)
  document.querySelectorAll('.chart-btn[data-chart]').forEach((btn) => {
    btn.addEventListener('click', handleChartGranularityClick);
  });

  // Date filter – Month / Year / Custom
  document.getElementById('btn-custom-range')?.addEventListener('click', openCustomRange);
  document.getElementById('apply-date-range')?.addEventListener('click', applyCustomDateRange);

  

  // View toggle handlers
  document.getElementById('view-standard')?.addEventListener('click', () => {
    viewMode = 'standard';
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'standard');
    });
    renderStandardViewContent();
  });

  document.getElementById('view-comparison')?.addEventListener('click', async () => {
    viewMode = 'comparison';
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'comparison');
    });
    await renderComparisonView(dateRange);
  });

  document.getElementById('view-client')?.addEventListener('click', () => {
    viewMode = 'client';
    document.querySelectorAll('[data-view]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === 'client');
    });
    renderClientAnalyticsView();
  });
}

function renderClientAnalyticsView() {
  const container = document.getElementById('analytics-content');
  if (!container) return;
  
  container.innerHTML = '<div id="view-client-analytics"></div>';
  updateClientAnalyticsDateRange(dateRange.start, dateRange.end);
  initClientAnalytics();
}

function renderStandardViewContent() {
  const container = document.getElementById('analytics-content');
  if (!container) return;
  
  // Render the standard view HTML
  container.innerHTML = `
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
  `;
  
  // Re-attach chart button listeners for the standard view
  setTimeout(() => {
    document.querySelectorAll('.chart-btn[data-chart]').forEach((btn) => {
      btn.addEventListener('click', handleChartGranularityClick);
    });
  }, 100);

  // Init drill-through modal (idempotent) and attach delegated click handler
  initDrillThroughModal();
  const content = document.getElementById('analytics-content');
  if (content && !content.__drillBound) {
    content.addEventListener('click', (e) => {
      // 1) Metric tile click
      const card = e.target.closest('.metric-card[data-drill]');
      if (card) { handleDrillClick(card.dataset.drill); return; }
      // 2) Horizontal bar click
      const bar = e.target.closest('.drill-bar-row[data-drill-bar]');
      if (bar) { handleBarDrillClick(bar.dataset.drillBar); return; }
      // 3) Upcoming check-in row click
      const checkin = e.target.closest('.drill-checkin-row[data-drill-checkin]');
      if (checkin) { handleCheckinDrillClick(checkin.dataset.drillCheckin); return; }
    });
    content.__drillBound = true;
  }
  
  loadAllAnalytics();
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
    // Fetch reservations with overlap detection (no RPC needed!)
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('check_in, check_out, nights')
      .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Fetch blocked dates
    const { data: blockedDates } = await supabase
      .from('blocked_dates')
      .select('blocked_date')
      .gte('blocked_date', sqlDate(dateRange.start))
      .lte('blocked_date', sqlDate(dateRange.end));

    // Calculate everything in JavaScript
    const NUM_CABINS = 3;
    const daysInPeriod = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)) + 1;
    const theoreticalCapacity = daysInPeriod * NUM_CABINS;
    const blockedNights = (blockedDates || []).length;
    const availableNights = theoreticalCapacity - blockedNights;

    // Calculate occupied nights with boundary clipping
    let occupiedNights = 0;
    let totalNightsSold = 0;
    (reservations || []).forEach(r => {
      if (!r.check_in || !r.check_out) return;
      const checkIn = new Date(r.check_in + 'T00:00:00');
      const checkOut = new Date(r.check_out + 'T00:00:00');
      const rangeStart = new Date(Math.max(checkIn, dateRange.start));
      const rangeEnd = new Date(Math.min(checkOut, dateRange.end));
      const nightsInRange = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)));
      occupiedNights += nightsInRange;
      totalNightsSold += (r.nights || 0);
    });

    const occupancyRate = availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0;
    const alos = (reservations || []).length > 0 ? totalNightsSold / (reservations || []).length : 0;

    const html = `
      <div class="metric-card" data-drill="occupancy">
        <div class="metric-label">Occupancy Rate</div>
        <div class="metric-value">${occupancyRate.toFixed(1)}%</div>
        <div class="metric-subtext">${occupiedNights} of ${availableNights} nights occupied</div>
      </div>
      <div class="metric-card" data-drill="occupancy">
        <div class="metric-label">Nights Sold</div>
        <div class="metric-value">${totalNightsSold}</div>
      </div>
      <div class="metric-card" data-drill="occupancy">
        <div class="metric-label">Available Nights</div>
        <div class="metric-value">${availableNights}</div>
        <div class="metric-subtext">${blockedNights} nights blocked</div>
      </div>
      <div class="metric-card" data-drill="occupancy">
        <div class="metric-label">ALOS</div>
        <div class="metric-value">${alos.toFixed(1)}</div>
        <div class="metric-subtext">Average Length of Stay</div>
      </div>
      <div class="metric-card" data-drill="occupancy">
        <div class="metric-label">Bookings in Period</div>
        <div class="metric-value">${(reservations || []).length}</div>
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
      .select('total, room_subtotal, extras_total, check_in, check_out, nights')
      .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Get blocked dates to calculate available nights correctly
    const { data: blockedDates } = await supabase
      .from('blocked_dates')
      .select('blocked_date, room_type_id')
      .gte('blocked_date', sqlDate(dateRange.start))
      .lte('blocked_date', sqlDate(dateRange.end));


    // Calculate available nights (excluding blocked dates)
    const daysInPeriod = Math.max(
      1,
      Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)) + 1
    );
    const NUM_CABINS = 3;
    const theoreticalCapacity = daysInPeriod * NUM_CABINS;
    const blockedNights = (blockedDates || []).length;
    const totalAvailableNights = theoreticalCapacity - blockedNights;

    // Calculate revenue totals
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

    // Calculate occupied nights WITHIN the date range
    let occupiedNightsInRange = 0;
    reservations.forEach(r => {
      if (!r.check_in || !r.check_out) return;
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      const rangeStart = new Date(Math.max(checkIn, dateRange.start));
      const rangeEnd = new Date(Math.min(checkOut, dateRange.end));
      const nightsInRange = Math.max(0, Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)));
      occupiedNightsInRange += nightsInRange;
    });

    const avgBookingValue =
      reservations.length > 0 ? totalRevenue / reservations.length : 0;

    // RevPAR = Room Revenue / Available Nights (not sold nights)
    const revPAR = totalAvailableNights > 0 ? roomRevenue / totalAvailableNights : 0;

    // TRevPAR = Total Revenue / Available Nights (includes extras)
    const trevpar = totalAvailableNights > 0 ? totalRevenue / totalAvailableNights : 0;

    // ADR = Room Revenue / Occupied Nights (in range)
    const adr = occupiedNightsInRange > 0 ? roomRevenue / occupiedNightsInRange : 0;

    const html = `
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(totalRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">Room Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(roomRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">Extras Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(extrasRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">Avg Booking Value</div>
        <div class="metric-value">${formatCurrencyCompact(avgBookingValue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">ADR</div>
        <div class="metric-value">${formatCurrencyCompact(adr, 'GHS')}</div>
        <div class="metric-subtext">Average Daily Rate</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">RevPAR</div>
        <div class="metric-value">${formatCurrencyCompact(revPAR, 'GHS')}</div>
        <div class="metric-subtext">Revenue per Available Room</div>
      </div>
      <div class="metric-card" data-drill="revenue">
        <div class="metric-label">TRevPAR</div>
        <div class="metric-value">${formatCurrencyCompact(trevpar, 'GHS')}</div>
        <div class="metric-subtext">Total Revenue per Available Room</div>
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
      .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
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
    const isMobile = window.innerWidth <= 768;
    let points = [];

    if (mode === 'day') {
      points = dailySeries.map(({ date, value }) => ({
        label: isMobile
          ? date.toLocaleDateString('en-US', { day: 'numeric' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
    const mode = chartGranularity.occupancy || 'day';
    
    // Call database function for occupancy trend
    const { data, error } = await supabase
      .rpc('calculate_occupancy_trend', {
        p_start_date: sqlDate(dateRange.start),
        p_end_date: sqlDate(dateRange.end),
        p_granularity: mode
      });

    if (error) {
      console.error('Database function error:', error);
      throw new Error(`Failed to load occupancy trend: ${error.message}`);
    }

    // Transform database result into chart points
    const isMobile = window.innerWidth <= 768;
    const points = (data || []).map(item => {
      const d = new Date(item.date + 'T00:00:00');
      let label;
      if (mode === 'month') {
        label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else if (mode === 'week') {
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        // day mode
        label = isMobile
          ? d.toLocaleDateString('en-US', { day: 'numeric' })
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return { label, value: item.occupancy_rate };
    });

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
    // Call database function for occupancy by room
    const { data, error } = await supabase
      .rpc('calculate_occupancy_by_room', {
        p_start_date: sqlDate(dateRange.start),
        p_end_date: sqlDate(dateRange.end)
      });

    if (error) {
      console.error('Database function error:', error);
      throw new Error(`Failed to load occupancy by cabin: ${error.message}`);
    }

    // Extract occupancy rates for each cabin
    const cabins = { SAND: 0, SEA: 0, SUN: 0 };
    (data || []).forEach(room => {
      if (cabins.hasOwnProperty(room.room_code)) {
        cabins[room.room_code] = room.occupancy_rate;
      }
    });

    let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    Object.entries(cabins).forEach(([cabin, percentage]) => {
      html += `
        <div class="drill-bar-row" data-drill-bar="cabin-${cabin}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
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
      .select('*, reservations!inner(check_in, check_out, status)')
      .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0])
      .gte('reservations.check_out', dateRange.start.toISOString().split('T')[0])
      .in('reservations.status', ['confirmed', 'checked-in', 'checked-out']);


    if (error) throw error;

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id')
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .gte('check_out', dateRange.start.toISOString().split('T')[0])
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
      <div class="metric-card" data-drill="extras">
        <div class="metric-label">Extras Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(totalRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="extras">
        <div class="metric-label">Extras Attach Rate</div>
        <div class="metric-value">${attachRate.toFixed(1)}%</div>
      </div>
      <div class="metric-card" data-drill="extras">
        <div class="metric-label">Avg Per Booking</div>
        <div class="metric-value">${avgPerBooking.toFixed(1)}</div>
      </div>
      <div class="metric-card" data-drill="extras">
        <div class="metric-label">Total Extras Sold</div>
        <div class="metric-value">${reservationExtras.length}</div>
      </div>
      <div class="metric-card" data-drill="extras">
        <div class="metric-label">Top Extra</div>
        <div class="metric-value" style="font-size: 16px;">${topExtra ? topExtra[0] : 'N/A'}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${topExtra ? topExtra[1] + ' bookings' : ''}</div>
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
      .select('extra_name, subtotal, quantity, reservations!inner(check_in, check_out, status)')
      .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0])
      .gte('reservations.check_out', dateRange.start.toISOString().split('T')[0])
      .in('reservations.status', ['confirmed', 'checked-in', 'checked-out']);


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
        <div class="drill-bar-row" data-drill-bar="extra-${name}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
          <div style="min-width: 150px; font-size: 14px; color: #0f172a;">${name}</div>
          <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="width: ${width}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%);"></div>
          </div>
          <div style="min-width: 40px; text-align: right; font-weight: 600; color: #0f172a;">${count}</div>
        </div>
      `;
    });
    bookingsHtml += '</div>';

    // Revenue horizontal bar chart
    const totalRevenue = Object.values(extraRevenue).reduce((sum, v) => sum + v, 0);
    const sortedRevenue = Object.entries(extraRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const maxRevenue = Math.max(...sortedRevenue.map(r => r[1]), 1);

    let revenueHtml = '<div style="display: flex; flex-direction: column; gap: 12px; padding: 20px 0;">';
    sortedRevenue.forEach(([name, revenue]) => {
      const percentage = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      const barWidth = (revenue / maxRevenue) * 100;
      
      revenueHtml += `
        <div class="drill-bar-row" data-drill-bar="extra-${name}" style="display: flex; flex-direction: column; gap: 6px; cursor: pointer; border-radius: 6px; padding: 6px; transition: background 0.15s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px; color: #0f172a; font-weight: 500;">${name}</span>
            <span style="font-size: 14px; font-weight: 600; color: #0f172a;">${formatCurrencyCompact(revenue, 'GHS')}</span>
          </div>
          <div style="position: relative; width: 100%; height: 32px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="
              width: ${barWidth}%;
              height: 100%;
              background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%);
              transition: width 0.3s ease;
            "></div>
            <span style="
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 13px;
              font-weight: 600;
              color: #ffffff;
              text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
            ">${percentage.toFixed(0)}%</span>
          </div>
        </div>
      `;
    });
    revenueHtml += `</div>
      <div style="text-align: center; padding-top: 16px; border-top: 2px solid #e2e8f0; font-size: 15px; color: #64748b;">
        Total: <strong style="color: #0f172a; font-size: 16px;">${formatCurrencyCompact(totalRevenue, 'GHS')}</strong>
      </div>`;

    document.getElementById('extras-chart').innerHTML = bookingsHtml;
    document.getElementById('extras-revenue-chart').innerHTML = revenueHtml;
  } catch (error) {
    console.error('Error loading extras charts:', error);
  }
}

async function loadPairingAnalysis() {
  try {
    // Fetch reservations in date range with their extras
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        check_in,
        reservation_extras(extra_name)
      `)
      .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    if (!reservations || reservations.length === 0) {
      document.getElementById('pairing-analysis').innerHTML =
        '<div class="analytics-empty">No reservations in this period</div>';
      return;
    }

    // Count extras per booking
    const extrasDistribution = { 0: 0, 1: 0, '2+': 0 };
    const pairs = {};

    reservations.forEach(r => {
      // Normalise: Supabase may return null or [] for empty relation
      const extras = r.reservation_extras || [];
      const extrasCount = extras.length;
      
      if (extrasCount === 0) extrasDistribution[0]++;
      else if (extrasCount === 1) extrasDistribution[1]++;
      else extrasDistribution['2+']++;

      // Track pairs – only when 2+ extras exist
      if (extrasCount >= 2) {
        const names = extras.map(e => e.extra_name).sort();
        for (let i = 0; i < names.length - 1; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const pair = `${names[i]} + ${names[j]}`;
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
          <div class="drill-bar-row" data-drill-bar="pairing-${pair}" style="padding: 14px; background: #f9fafb; border-left: 3px solid #c9a86a; border-radius: 6px; cursor: pointer; transition: background 0.15s ease;">
            <span style="font-size: 15px; color: #0f172a;">${pair}</span>
            <strong style="margin-left: 8px; color: #c9a86a;">(${count} bookings)</strong>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<div style="text-align: center; padding: 20px; color: #94a3b8;">No common pairings found in this period</div>';
    }

    html += `
      <div style="display: flex; justify-content: space-around; padding: 20px; background: #f9fafb; border-radius: 8px; gap: 8px;">
        <div class="drill-bar-row" data-drill-bar="extrascount-0" style="text-align: center; flex: 1; cursor: pointer; border-radius: 6px; padding: 8px; transition: background 0.15s ease;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct0}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">0 Extras</div>
        </div>
        <div class="drill-bar-row" data-drill-bar="extrascount-1" style="text-align: center; flex: 1; cursor: pointer; border-radius: 6px; padding: 8px; transition: background 0.15s ease;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct1}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">1 Extra</div>
        </div>
        <div class="drill-bar-row" data-drill-bar="extrascount-2" style="text-align: center; flex: 1; cursor: pointer; border-radius: 6px; padding: 8px; transition: background 0.15s ease;">
          <div style="font-size: 28px; font-weight: 600; color: #0f172a;">${pct2}%</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">2+ Extras</div>
        </div>
      </div>
    </div>`;

    document.getElementById('pairing-analysis').innerHTML = html;
  } catch (error) {
    console.error('Error loading pairing analysis:', error);
    document.getElementById('pairing-analysis').innerHTML =
      '<div style="text-align:center; color:#ef4444;">Error loading pairing data</div>';
  }
}

async function loadPackageMetrics() {
  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('package_id, total, packages(name)')
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .gte('check_out', dateRange.start.toISOString().split('T')[0])
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
      <div class="metric-card" data-drill="packages">
        <div class="metric-label">Package Uptake Rate</div>
        <div class="metric-value">${uptakeRate.toFixed(0)}%</div>
      </div>
      <div class="metric-card" data-drill="packages">
        <div class="metric-label">Most Popular Package</div>
        <div class="metric-value" style="font-size: 16px;">${topPackage ? topPackage[0] : 'N/A'}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${topPackage ? topPackage[1] + ' bookings' : ''}</div>
      </div>
      <div class="metric-card" data-drill="packages">
        <div class="metric-label">Package Revenue</div>
        <div class="metric-value">${formatCurrencyCompact(packageRevenue, 'GHS')}</div>
      </div>
      <div class="metric-card" data-drill="packages">
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
      .lte('check_in', dateRange.end.toISOString().split('T')[0])
      .gte('check_out', dateRange.start.toISOString().split('T')[0])
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
        <div class="drill-bar-row" data-drill-bar="package-${name}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
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
        <div class="drill-bar-row" data-drill-bar="package-${name}" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f9fafb; border-radius: 6px; cursor: pointer; transition: background 0.15s ease;">
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
        'coupon_code, coupon_discount, discount_amount, room_discount, extras_discount, total, extras_total, check_in, check_out'
      )
      .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (couponsError || resError) throw (couponsError || resError);

    const allRes = reservations || [];

    // ---------- Split reservations ----------
    const withCouponRes = allRes.filter((r) => r.coupon_code);
    const withoutCouponRes = allRes.filter((r) => !r.coupon_code);

    // ---------- Core coupon metrics ----------
    // discount_amount is the total discount (room + extras combined).
    // room_discount and extras_discount are the breakdown (may be 0 if not populated).
    const totalDiscount = withCouponRes.reduce((sum, r) => {
      return sum + (parseFloat(r.discount_amount) || 0);
    }, 0);

    const avgDiscount =
      withCouponRes.length > 0 ? totalDiscount / withCouponRes.length : 0;

    const redemptionRate =
      allRes.length > 0 ? (withCouponRes.length / allRes.length) * 100 : 0;

    // ---------- Most used coupon (from coupons.current_uses) ----------
    const mostUsed =
      (coupons || [])
        .filter((c) => (c.current_uses || 0) > 0)
        .sort((a, b) => (b.current_uses || 0) - (a.current_uses || 0))[0] || null;

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
      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Total Discount Given</div>
        <div class="metric-value">${formatCurrencyCompact(totalDiscount, 'GHS')}</div>
      </div>

      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Avg Discount</div>
        <div class="metric-value">${formatCurrencyCompact(avgDiscount, 'GHS')}</div>
      </div>

      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Avg Booking with Coupon</div>
        <div class="metric-value">${formatCurrencyCompact(avgWith, 'GHS')}</div>
        <div class="metric-subtext">Based on ${withCouponRes.length} bookings</div>
      </div>

      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Avg Booking without Coupon</div>
        <div class="metric-value">${formatCurrencyCompact(avgWithout, 'GHS')}</div>
        <div class="metric-subtext">Based on ${withoutCouponRes.length} bookings</div>
      </div>

      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Active Coupons</div>
        <div class="metric-value">${coupons?.length || 0}</div>
        <div class="metric-subtext">currently active</div>
      </div>

      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Redemption Rate</div>
        <div class="metric-value">${redemptionRate.toFixed(0)}%</div>
      </div>

      <!-- Most used coupon -->
      <div class="metric-card" data-drill="coupons">
        <div class="metric-label">Most Used Coupon</div>
        <div class="metric-value">${mostUsed ? mostUsed.code : 'N/A'}</div>
        <div class="metric-subtext">
          ${mostUsed ? `${mostUsed.current_uses} uses` : ''}
        </div>
      </div>

      <div class="metric-card" data-drill="coupons">
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
          <div class="drill-bar-row" data-drill-bar="coupon-${c.code}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
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
      .select('confirmation_code, check_in, room_type_code, guest_first_name, guest_last_name')
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
        <div class="drill-checkin-row" data-drill-checkin="${r.confirmation_code || ''}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; width: 100%; box-sizing: border-box; cursor: pointer; border-radius: 6px; transition: background 0.15s ease;">
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
    const today = new Date().toISOString().split('T')[0];

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
      .lte('check_in', in30Days.toISOString().split('T')[0])
      .in('status', ['confirmed', 'checked-in']);

    const html = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; width: 100%; box-sizing: border-box;">
        <div class="drill-bar-row" data-drill-bar="status-occupied" style="text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; box-sizing: border-box; cursor: pointer; transition: background 0.15s ease;">
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
      <div class="drill-bar-row" data-drill-bar="status-next30" style="padding: 24px; background: #f9fafb; border-radius: 8px; text-align: center; width: 100%; box-sizing: border-box; cursor: pointer; transition: background 0.15s ease;">
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

// ============================================================
// DATE FILTER – independent Month + Year dropdowns + Custom
// ============================================================

// Fill the Year <select> from current year back to 2023
function populateYearSelect() {
  const sel = document.getElementById('analytics-year');
  if (!sel) return;

  const now = new Date();
  const nowYear = String(now.getFullYear());

  sel.innerHTML = '';
  for (let y = now.getFullYear(); y >= 2023; y--) {
    sel.innerHTML += `<option value="${y}">${y}</option>`;
  }

  // Default: select current year
  Array.from(sel.options).forEach((opt) => {
    opt.selected = opt.value === nowYear;
  });
}


// Read the current dateRange and set the two dropdowns to match.
// If dateRange is exactly one calendar month  → select that month + year.
// Otherwise (full year, or arbitrary custom)  → "All Months" + start year.
function syncDropdownsToDateRange() {
  const monthSel = document.getElementById('analytics-month');
  const yearSel  = document.getElementById('analytics-year');
  if (!monthSel || !yearSel) return;

  const s = dateRange.start, e = dateRange.end;
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const startsFirst = s.getDate() === 1;

  // Clear selections first
  Array.from(monthSel.options).forEach(o => (o.selected = false));
  Array.from(yearSel.options).forEach(o => (o.selected = false));

  // Month selection
  if (sameMonth && startsFirst) {
    const targetMonth = String(s.getMonth());
    const opt = Array.from(monthSel.options).find(o => o.value === targetMonth);
    if (opt) opt.selected = true;
  } else {
    const allOpt = Array.from(monthSel.options).find(o => o.value === 'all');
    if (allOpt) allOpt.selected = true;
  }

  // Year selection (select start year)
  const targetYear = String(s.getFullYear());
  const yearOpt = Array.from(yearSel.options).find(o => o.value === targetYear);
  if (yearOpt) yearOpt.selected = true;
}


// Either dropdown changed → compute new dateRange and reload
function handleMonthYearChange() {
  const monthSel = document.getElementById('analytics-month');
  const yearSel  = document.getElementById('analytics-year');

  const months = Array.from(monthSel.selectedOptions).map(o => o.value); // 'all' or '0'..'11'
  const years  = Array.from(yearSel.selectedOptions).map(o => parseInt(o.value, 10)).filter(Boolean);

  if (!years.length) return;

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  // If any "all" selected, treat as full-year selection over chosen year(s)
  if (months.includes('all') || months.length === 0) {
    dateRange.start = new Date(minYear, 0, 1);
    dateRange.end   = new Date(maxYear, 11, 31);
  } else {
    const monthNums = months.map(m => parseInt(m, 10)).filter(m => !Number.isNaN(m));
    const minMonth = Math.min(...monthNums);
    const maxMonth = Math.max(...monthNums);

    dateRange.start = new Date(minYear, minMonth, 1);
    dateRange.end   = new Date(maxYear, maxMonth + 1, 0);
  }

  autoSetGranularityFromRange?.();
  refreshView?.();
}


// "Custom" button clicked → show the date pickers pre-filled with current range
function openCustomRange() {
  document.getElementById('analytics-start').value = formatDateUK(dateRange.start);
  document.getElementById('analytics-end').value   = formatDateUK(dateRange.end);
  document.getElementById('custom-date-range').style.display = 'flex';
  const lbl = document.getElementById('custom-range-label');
  if (lbl) lbl.textContent = `${formatDateUK(dateRange.start)} – ${formatDateUK(dateRange.end)}`;
  
  // Re-initialize date pickers when shown
  if (typeof flatpickr !== 'undefined') {
    setTimeout(() => {
      const startInput = document.getElementById('analytics-start');
      const endInput = document.getElementById('analytics-end');
      
      // Destroy existing instances if any
      if (startInput._flatpickr) startInput._flatpickr.destroy();
      if (endInput._flatpickr) endInput._flatpickr.destroy();
      
      // Create new instances
      flatpickr('#analytics-start', {
        dateFormat: 'd/m/Y',
        allowInput: true,
      });
      
      flatpickr('#analytics-end', {
        dateFormat: 'd/m/Y',
        allowInput: true,
      });
    }, 50);
  }
}

// "Apply" clicked inside the custom picker row
function applyCustomDateRange() {
  const start = document.getElementById('analytics-start').value;
  const end   = document.getElementById('analytics-end').value;

  const startDate = parseDateUK(start);
  const endDate   = parseDateUK(end);

  if (startDate && endDate) {
    dateRange.start = startDate;
    dateRange.end   = endDate;

    autoSetGranularityFromRange();
    syncCheckboxDropdownsToDateRange();
    refreshView();
  } else {
    toast('Please enter dates as DD/MM/YYYY');
  }

  const lbl = document.getElementById('custom-range-label');
  if (lbl) lbl.textContent = `${formatDateUK(dateRange.start)} – ${formatDateUK(dateRange.end)}`;
}


function initMonthYearCheckboxDropdowns() {
  const monthBtn = document.getElementById('month-dd-btn');
  const monthMenu = document.getElementById('month-dd-menu');
  const yearBtn = document.getElementById('year-dd-btn');
  const yearMenu = document.getElementById('year-dd-menu');
  const yearOptionsWrap = document.getElementById('year-dd-options');

  if (!monthBtn || !monthMenu || !yearBtn || !yearMenu || !yearOptionsWrap) return;

  // --- populate years ---
  const now = new Date();
  const years = [];
  for (let y = now.getFullYear(); y >= 2023; y--) years.push(y);

  yearOptionsWrap.innerHTML = years.map(y => `
    <label style="display:flex;gap:8px;align-items:center;padding:6px 4px;cursor:pointer;">
      <input type="checkbox" data-year="${y}" />
      <span>${y}</span>
    </label>
  `).join('');

  // default: current year checked
  const currentYear = now.getFullYear();
  yearOptionsWrap.querySelectorAll('input[data-year]').forEach(inp => {
    inp.checked = parseInt(inp.getAttribute('data-year'), 10) === currentYear;
  });

  // --- dropdown open/close ---
  const toggle = (menu) => { menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none'; };
  monthBtn.addEventListener('click', (e) => { e.preventDefault(); toggle(monthMenu); yearMenu.style.display = 'none'; });
  yearBtn.addEventListener('click', (e) => { e.preventDefault(); toggle(yearMenu); monthMenu.style.display = 'none'; });

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!document.getElementById('month-dd')?.contains(t)) monthMenu.style.display = 'none';
    if (!document.getElementById('year-dd')?.contains(t)) yearMenu.style.display = 'none';
  });

  // --- month behaviour: "All Months" is exclusive ---
  monthMenu.querySelectorAll('input[data-month]').forEach(inp => {
    inp.addEventListener('change', () => {
      const v = inp.getAttribute('data-month');

      if (v === 'all' && inp.checked) {
        // uncheck all specific months
        monthMenu.querySelectorAll('input[data-month]').forEach(x => {
          if (x.getAttribute('data-month') !== 'all') x.checked = false;
        });
      } else if (v !== 'all' && inp.checked) {
        // uncheck "all"
        const all = monthMenu.querySelector('input[data-month="all"]');
        if (all) all.checked = false;
      }
    });
  });

  // clear/apply buttons
  document.getElementById('month-dd-clear')?.addEventListener('click', () => {
    monthMenu.querySelectorAll('input[data-month]').forEach(x => x.checked = false);
    const all = monthMenu.querySelector('input[data-month="all"]');
    if (all) all.checked = true;
  });

  document.getElementById('year-dd-clear')?.addEventListener('click', () => {
    yearOptionsWrap.querySelectorAll('input[data-year]').forEach(x => x.checked = false);
  });

  document.getElementById('month-dd-apply')?.addEventListener('click', () => {
    monthMenu.style.display = 'none';
    applyMonthYearFromCheckboxes();
  });

  document.getElementById('year-dd-apply')?.addEventListener('click', () => {
    yearMenu.style.display = 'none';
    applyMonthYearFromCheckboxes();
  });

  // set initial button labels
  updateMonthYearDropdownLabels();
}

function getSelectedMonthsFromUI() {
  const menu = document.getElementById('month-dd-menu');
  if (!menu) return ['all'];
  const checked = Array.from(menu.querySelectorAll('input[data-month]:checked')).map(i => i.getAttribute('data-month'));
  return checked.length ? checked : ['all'];
}

function getSelectedYearsFromUI() {
  const wrap = document.getElementById('year-dd-options');
  if (!wrap) return [new Date().getFullYear()];
  const years = Array.from(wrap.querySelectorAll('input[data-year]:checked'))
    .map(i => parseInt(i.getAttribute('data-year'), 10))
    .filter(Boolean);
  return years.length ? years : [new Date().getFullYear()];
}

function applyMonthYearFromCheckboxes() {
  const months = getSelectedMonthsFromUI(); // 'all' or '0'..'11'
  const years  = getSelectedYearsFromUI();  // numbers

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  if (months.includes('all') || months.length === 0) {
    dateRange.start = new Date(minYear, 0, 1);
    dateRange.end   = new Date(maxYear, 11, 31);
  } else {
    const monthNums = months.map(m => parseInt(m, 10)).filter(m => !Number.isNaN(m));
    const minMonth = Math.min(...monthNums);
    const maxMonth = Math.max(...monthNums);

    dateRange.start = new Date(minYear, minMonth, 1);
    dateRange.end   = new Date(maxYear, maxMonth + 1, 0);
  }

  updateMonthYearDropdownLabels();
  autoSetGranularityFromRange?.();
  refreshView?.();
}

function updateMonthYearDropdownLabels() {
  const monthBtn = document.getElementById('month-dd-btn');
  const yearBtn  = document.getElementById('year-dd-btn');
  if (!monthBtn || !yearBtn) return;

  const months = getSelectedMonthsFromUI();
  const years  = getSelectedYearsFromUI();

  // Month label
  if (months.includes('all')) {
    monthBtn.textContent = 'All Months';
  } else if (months.length === 1) {
    const idx = parseInt(months[0], 10);
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    monthBtn.textContent = names[idx] || 'Months';
  } else {
    monthBtn.textContent = `${months.length} months`;
  }

  // Year label
  if (years.length === 1) yearBtn.textContent = String(years[0]);
  else yearBtn.textContent = `${years.length} years`;
}

function syncCheckboxDropdownsToDateRange() {
  const monthMenu = document.getElementById('month-dd-menu');
  const yearWrap  = document.getElementById('year-dd-options');
  if (!monthMenu || !yearWrap) return;

  // Clear
  monthMenu.querySelectorAll('input[data-month]').forEach(x => x.checked = false);
  yearWrap.querySelectorAll('input[data-year]').forEach(x => x.checked = false);

  const s = dateRange.start;
  const e = dateRange.end;

  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  const isCalendarMonth = sameMonth && s.getDate() === 1 && e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();

  if (isCalendarMonth) {
    const m = monthMenu.querySelector(`input[data-month="${s.getMonth()}"]`);
    if (m) m.checked = true;
  } else {
    const all = monthMenu.querySelector('input[data-month="all"]');
    if (all) all.checked = true;
  }

  // select start year (simple + consistent with previous behavior)
  const y = yearWrap.querySelector(`input[data-year="${s.getFullYear()}"]`);
  if (y) y.checked = true;

  updateMonthYearDropdownLabels();
}


// Shared helper – dispatches to whichever view is currently active
function refreshView() {
  if (viewMode === 'comparison') {
    renderComparisonView(dateRange);
  } else if (viewMode === 'client') {
    updateClientAnalyticsDateRange(dateRange.start, dateRange.end);
  } else {
    loadAllAnalytics();
  }
}

// ============================================================
// DRILL-THROUGH MODAL  – click a metric tile to see details
// ============================================================

function initDrillThroughModal() {
  // Inject modal HTML once
  let modal = document.getElementById('drill-modal');
  if (modal) return;

  modal = document.createElement('div');
  modal.id = 'drill-modal';
  modal.className = 'drill-modal-overlay';
  modal.innerHTML = `
    <div class="drill-modal-content">
      <div class="drill-modal-header">
        <h3 class="drill-modal-title" id="drill-modal-title">Details</h3>
        <button class="drill-modal-close" id="drill-modal-close">&times;</button>
      </div>
      <div class="drill-modal-body" id="drill-modal-body">Loading…</div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close handlers
  document.getElementById('drill-modal-close').addEventListener('click', closeDrillModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDrillModal();
  });
  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrillModal();
  });
}

function openDrillModal(title, bodyHtml) {
  initDrillThroughModal();
  document.getElementById('drill-modal-title').textContent = title;
  document.getElementById('drill-modal-body').innerHTML = bodyHtml;
  document.getElementById('drill-modal').classList.add('active');
}

function closeDrillModal() {
  const modal = document.getElementById('drill-modal');
  if (modal) modal.classList.remove('active');
}

async function handleDrillClick(type) {
  const titleMap = {
    occupancy:       'Occupancy – Reservations in Period',
    revenue:         'Revenue – Reservations in Period',
    extras:          'Extras – Reservations with Add-ons',
    packages:        'Packages – Reservations with Packages',
    coupons:         'Coupon Analytics – Reservations with Coupons',
  };
  const title = titleMap[type] || 'Details';
  openDrillModal(title, '<div style="text-align:center;padding:24px;color:#64748b;">Loading…</div>');

  try {
    let reservations;
    if (type === 'extras') {
      // Need reservation_extras joined
      const { data, error } = await supabase
        .from('reservation_extras')
        .select('reservation_id, extra_name, subtotal, quantity, reservations!inner(confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total)')
        .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0])
      .gte('reservations.check_out', dateRange.start.toISOString().split('T')[0]);
      if (error) throw error;

      // Group by reservation
      const grouped = {};
      (data || []).forEach(row => {
        const code = row.reservations.confirmation_code;
        if (!grouped[code]) {
          grouped[code] = { ...row.reservations, extras: [] };
        }
        grouped[code].extras.push({ name: row.extra_name, subtotal: row.subtotal, qty: row.quantity });
      });
      reservations = Object.values(grouped);
    } else if (type === 'packages') {
      const { data, error } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, packages(name)')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .not('package_id', 'is', null);
      if (error) throw error;
      reservations = data || [];
    } else if (type === 'coupons') {
      const { data, error } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status, coupon_code, coupon_discount, discount_amount, room_discount, extras_discount')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .not('coupon_code', 'is', null)
        .order('check_in', { ascending: false });
      if (error) throw error;
      reservations = data || [];
    } else {
      // occupancy / revenue – plain reservations list
      const { data, error } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .order('check_in', { ascending: false });
      if (error) throw error;
      reservations = data || [];
    }

    const html = buildDrillTable(type, reservations);
    document.getElementById('drill-modal-body').innerHTML = html;
  } catch (err) {
    console.error('Drill-through error:', err);
    document.getElementById('drill-modal-body').innerHTML =
      '<div style="text-align:center;padding:24px;color:#ef4444;">Error loading details</div>';
  }
}

// ---- Bar drill: coupon-CODE | extra-NAME | package-NAME | cabin-CODE ----
async function handleBarDrillClick(barKey) {
  // Parse prefix and value: "coupon-SUMMER25" → { prefix:'coupon', value:'SUMMER25' }
  const dashIdx = barKey.indexOf('-');
  const prefix  = barKey.slice(0, dashIdx);
  const value   = barKey.slice(dashIdx + 1);

  const titleMap = {
    coupon:       (v) => `Coupon "${v}" – Reservations`,
    extra:        (v) => `Extra "${v}" – Reservations`,
    package:      (v) => `Package "${v}" – Reservations`,
    cabin:        (v) => `Cabin ${v} – Reservations in Period`,
    pairing:      (v) => `Pairing: ${v}`,
    extrascount:  (v) => v === '2' ? 'Reservations with 2+ Extras' : `Reservations with ${v} Extra${v === '1' ? '' : 's'}`,
    status:       (v) => v === 'occupied' ? 'Currently Occupied Cabins' : 'Next 30 Days – Upcoming Bookings',
  };
  const title = (titleMap[prefix] || (() => 'Details'))(value);
  openDrillModal(title, '<div style="text-align:center;padding:24px;color:#64748b;">Loading…</div>');

  try {
    let rows;

    if (prefix === 'coupon') {
      const { data, error } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status, coupon_code, coupon_discount, discount_amount, room_discount, extras_discount')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .eq('coupon_code', value)
        .order('check_in', { ascending: false });
      if (error) throw error;
      rows = data || [];
      document.getElementById('drill-modal-body').innerHTML = buildDrillTable('coupons', rows);

    } else if (prefix === 'extra') {
      const { data, error } = await supabase
        .from('reservation_extras')
        .select('reservation_id, extra_name, subtotal, quantity, reservations!inner(confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total)')
        .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0])
      .gte('reservations.check_out', dateRange.start.toISOString().split('T')[0])
        .eq('extra_name', value);
      if (error) throw error;
      // Group by reservation (same pattern as extras drill)
      const grouped = {};
      (data || []).forEach(row => {
        const code = row.reservations.confirmation_code;
        if (!grouped[code]) grouped[code] = { ...row.reservations, extras: [] };
        grouped[code].extras.push({ name: row.extra_name, subtotal: row.subtotal, qty: row.quantity });
      });
      rows = Object.values(grouped);
      document.getElementById('drill-modal-body').innerHTML = buildDrillTable('extras', rows);

    } else if (prefix === 'package') {
      if (value === 'No Package') {
        // Reservations without a package
        const { data, error } = await supabase
          .from('reservations')
          .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status')
          .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
          .in('status', ['confirmed', 'checked-in', 'checked-out'])
          .is('package_id', null)
          .order('check_in', { ascending: false });
        if (error) throw error;
        rows = data || [];
        document.getElementById('drill-modal-body').innerHTML = buildDrillTable('occupancy', rows);
      } else {
        const { data, error } = await supabase
          .from('reservations')
          .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, packages(name)')
          .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
          .in('status', ['confirmed', 'checked-in', 'checked-out'])
          .not('package_id', 'is', null)
          .eq('packages.name', value);
        if (error) throw error;
        rows = data || [];
        document.getElementById('drill-modal-body').innerHTML = buildDrillTable('packages', rows);
      }

    } else if (prefix === 'cabin') {
      const { data, error } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .eq('room_type_code', value)
        .order('check_in', { ascending: false });
      if (error) throw error;
      rows = data || [];
      document.getElementById('drill-modal-body').innerHTML = buildDrillTable('occupancy', rows);

    } else if (prefix === 'pairing') {
      // value = "Extra A + Extra B" — find reservations that have BOTH
      const extraNames = value.split(' + ').map(s => s.trim());
      const { data: allExtras, error: extErr } = await supabase
        .from('reservation_extras')
        .select('reservation_id, extra_name, subtotal, quantity, reservations!inner(confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total)')
        .lte('reservations.check_in', dateRange.end.toISOString().split('T')[0])
      .gte('reservations.check_out', dateRange.start.toISOString().split('T')[0]);
      if (extErr) throw extErr;
      const grouped = {};
      (allExtras || []).forEach(row => {
        const code = row.reservations.confirmation_code;
        if (!grouped[code]) grouped[code] = { ...row.reservations, extras: [], _names: new Set() };
        grouped[code].extras.push({ name: row.extra_name, subtotal: row.subtotal, qty: row.quantity });
        grouped[code]._names.add(row.extra_name);
      });
      rows = Object.values(grouped).filter(r => extraNames.every(n => r._names.has(n)));
      document.getElementById('drill-modal-body').innerHTML = buildDrillTable('extras', rows);

    } else if (prefix === 'extrascount') {
      // value = '0' | '1' | '2' (2 means 2+)
      const { data: allRes, error: resErr } = await supabase
        .from('reservations')
        .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status, reservation_extras(extra_name, subtotal, quantity)')
        .lte('check_in', sqlDate(dateRange.end))
      .gte('check_out', sqlDate(dateRange.start))
        .in('status', ['confirmed', 'checked-in', 'checked-out']);
      if (resErr) throw resErr;
      const target = parseInt(value, 10);
      rows = (allRes || []).filter(r => {
        const cnt = (r.reservation_extras || []).length;
        if (target === 0) return cnt === 0;
        if (target === 1) return cnt === 1;
        return cnt >= 2;
      }).map(r => ({
        ...r,
        extras: (r.reservation_extras || []).map(e => ({ name: e.extra_name, subtotal: e.subtotal, qty: e.quantity }))
      }));
      document.getElementById('drill-modal-body').innerHTML = buildDrillTable('extras', rows);

    } else if (prefix === 'status') {
      if (value === 'occupied') {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('reservations')
          .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status')
          .lte('check_in', today)
          .gte('check_out', today)
          .eq('status', 'checked-in')
          .order('check_out', { ascending: true });
        if (error) throw error;
        rows = data || [];
        document.getElementById('drill-modal-body').innerHTML = buildDrillTable('occupancy', rows);
      } else if (value === 'next30') {
        const today = new Date();
        const in30 = new Date(); in30.setDate(in30.getDate() + 30);
        const { data, error } = await supabase
          .from('reservations')
          .select('confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status')
          .gte('check_in', sqlDate(today))
          .lte('check_in', sqlDate(in30))
          .in('status', ['confirmed', 'checked-in'])
          .order('check_in', { ascending: true });
        if (error) throw error;
        rows = data || [];
        document.getElementById('drill-modal-body').innerHTML = buildDrillTable('occupancy', rows);
      }
    }
  } catch (err) {
    console.error('Bar drill-through error:', err);
    document.getElementById('drill-modal-body').innerHTML =
      '<div style="text-align:center;padding:24px;color:#ef4444;">Error loading details</div>';
  }
}

// ---- Check-in row drill: opens full reservation detail by confirmation_code ----
async function handleCheckinDrillClick(confirmationCode) {
  if (!confirmationCode) return;
  openDrillModal(`Reservation ${confirmationCode}`, '<div style="text-align:center;padding:24px;color:#64748b;">Loading…</div>');

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, confirmation_code, guest_first_name, guest_last_name, check_in, check_out, room_type_code, total, nights, status, coupon_code, coupon_discount, discount_amount, room_discount, extras_discount, package_id, packages(name)')
      .eq('confirmation_code', confirmationCode)
      .single();
    if (error) throw error;

    // Also fetch extras for this reservation
    const { data: extras } = await supabase
      .from('reservation_extras')
      .select('extra_name, quantity, subtotal')
      .eq('reservation_id', data.id || '')
      // fallback: match by confirmation if id not returned
      ;

    const r = data;
    const extrasStr = (extras || []).map(e => `${e.extra_name} ×${e.quantity}`).join(', ') || '–';
    const totalCouponDisc = parseFloat(r.discount_amount) || 0;
    const roomDisc = parseFloat(r.room_discount) || 0;
    const extrasDisc = parseFloat(r.extras_discount) || 0;
    const hasBreakdown = roomDisc > 0 || extrasDisc > 0;
    const discountStr = r.coupon_code
      ? `${r.coupon_code} (–${formatCurrencyCompact(totalCouponDisc, 'GHS')}${hasBreakdown ? `, R: ${formatCurrencyCompact(roomDisc, 'GHS')}, E: ${formatCurrencyCompact(extrasDisc, 'GHS')}` : ''})`
      : '–';

    const html = `
      <div class="drill-table-wrap">
        <table class="drill-table">
          <tbody>
            <tr><td style="font-weight:600;color:#64748b;width:140px;">Confirmation</td><td>${r.confirmation_code || '–'}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Guest</td><td>${[r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '–'}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Cabin</td><td>${r.room_type_code || '–'}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Check-in</td><td>${fmtDate(r.check_in)}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Check-out</td><td>${fmtDate(r.check_out)}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Nights</td><td>${r.nights || '–'}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Status</td><td><span class="drill-status drill-status-${(r.status||'').replace('-','')}">${r.status || '–'}</span></td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Package</td><td>${r.packages?.name || '–'}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Extras</td><td>${extrasStr}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Coupon</td><td>${discountStr}</td></tr>
            <tr><td style="font-weight:600;color:#64748b;">Total</td><td style="font-weight:700;font-size:18px;color:#c9a86a;">${formatCurrencyCompact(parseFloat(r.total) || 0, 'GHS')}</td></tr>
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('drill-modal-body').innerHTML = html;
  } catch (err) {
    console.error('Check-in drill error:', err);
    document.getElementById('drill-modal-body').innerHTML =
      '<div style="text-align:center;padding:24px;color:#ef4444;">Error loading reservation details</div>';
  }
}

function buildDrillTable(type, rows) {
  if (!rows || rows.length === 0) {
    return '<div style="text-align:center;padding:32px;color:#94a3b8;">No reservations found for this period</div>';
  }

  let headers, bodyFn;

  switch (type) {
    case 'extras':
      headers = ['Confirmation', 'Guest', 'Room', 'Check-in', 'Check-out', 'Extras', 'Total'];
      bodyFn = (r) => {
        const extrasStr = (r.extras || []).map(e => `${e.name} ×${e.qty}`).join(', ');
        return `
          <td>${r.confirmation_code || '–'}</td>
          <td>${[r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '–'}</td>
          <td>${r.room_type_code || '–'}</td>
          <td>${fmtDate(r.check_in)}</td>
          <td>${fmtDate(r.check_out)}</td>
          <td>${extrasStr}</td>
          <td style="text-align:right;">${formatCurrencyCompact(parseFloat(r.total) || 0, 'GHS')}</td>
        `;
      };
      break;
    case 'packages':
      headers = ['Confirmation', 'Guest', 'Room', 'Check-in', 'Check-out', 'Package', 'Total'];
      bodyFn = (r) => `
        <td>${r.confirmation_code || '–'}</td>
        <td>${[r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '–'}</td>
        <td>${r.room_type_code || '–'}</td>
        <td>${fmtDate(r.check_in)}</td>
        <td>${fmtDate(r.check_out)}</td>
        <td>${r.packages?.name || '–'}</td>
        <td style="text-align:right;">${formatCurrencyCompact(parseFloat(r.total) || 0, 'GHS')}</td>
      `;
      break;
    case 'coupons':
      headers = ['Confirmation', 'Guest', 'Room', 'Check-in', 'Check-out', 'Coupon', 'Discount', 'Total'];
      bodyFn = (r) => {
        const discount = parseFloat(r.discount_amount) || 0;
        const roomDisc = parseFloat(r.room_discount) || 0;
        const extrasDisc = parseFloat(r.extras_discount) || 0;
        const hasBreakdown = roomDisc > 0 || extrasDisc > 0;
        return `
          <td>${r.confirmation_code || '–'}</td>
          <td>${[r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '–'}</td>
          <td>${r.room_type_code || '–'}</td>
          <td>${fmtDate(r.check_in)}</td>
          <td>${fmtDate(r.check_out)}</td>
          <td style="font-family:monospace;font-weight:600;">${r.coupon_code || '–'}</td>
          <td style="text-align:right;color:#ef4444;">
            –${formatCurrencyCompact(discount, 'GHS')}
            ${hasBreakdown ? `<br><small style="color:#94a3b8;">(R: ${formatCurrencyCompact(roomDisc, 'GHS')} + E: ${formatCurrencyCompact(extrasDisc, 'GHS')})</small>` : ''}
          </td>
          <td style="text-align:right;">${formatCurrencyCompact(parseFloat(r.total) || 0, 'GHS')}</td>
        `;
      };
      break;
    default: // occupancy, revenue
      headers = ['Confirmation', 'Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Status', 'Total'];
      bodyFn = (r) => `
        <td>${r.confirmation_code || '–'}</td>
        <td>${[r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || '–'}</td>
        <td>${r.room_type_code || '–'}</td>
        <td>${fmtDate(r.check_in)}</td>
        <td>${fmtDate(r.check_out)}</td>
        <td>${r.nights || '–'}</td>
        <td><span class="drill-status drill-status-${(r.status||'').replace('-','')}">${r.status || '–'}</span></td>
        <td style="text-align:right;">${formatCurrencyCompact(parseFloat(r.total) || 0, 'GHS')}</td>
      `;
  }

  let html = `<div class="drill-table-wrap"><table class="drill-table">
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>`;
  rows.forEach(r => { html += `<tr>${bodyFn(r)}</tr>`; });
  html += '</tbody></table></div>';
  return html;
}

function fmtDate(str) {
  if (!str) return '–';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function exportAnalytics() {
  toast('Export functionality coming soon');
  // Future: Generate PDF or CSV export
}