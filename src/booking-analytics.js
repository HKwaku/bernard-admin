// src/booking-analytics.js
// Booking Analytics for Sojourn Cabins

import { supabase } from './config/supabase.js';
import { formatCurrency, formatDate } from './utils/helpers.js';
import { getExcludeInfluencer } from './analytics.js';
import { openDrillModal, initDrillThroughModal } from './drill-modal.js';

let dateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  end: (() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  })()
};

let dateFilterMode = 'created'; // 'created' | 'occupancy'
let cachedReservations = [];

function sqlDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function initBookingAnalytics() {
  renderBookingAnalytics();
}

export function updateBookingAnalyticsDateRange(start, end) {
  const s = new Date(sqlDate(start) + 'T00:00:00');
  const e = new Date(sqlDate(end) + 'T00:00:00');
  dateRange = { start: s, end: e };
  renderBookingAnalyticsContent();
  updateBookingFilterHint();
}

function formatStatusLabel(status) {
  const s = (status || '').toLowerCase();
  const map = {
    pending_payment: 'Pending Payment',
    confirmed: 'Confirmed',
    'checked-in': 'Checked In',
    'checked-out': 'Checked Out',
    cancelled: 'Cancelled'
  };
  return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ') : 'Unknown');
}

function getBookingFilterHint() {
  return dateFilterMode === 'created'
    ? 'Showing reservations created in the selected period'
    : 'Showing reservations with stays overlapping the selected period';
}

async function fetchReservationsForPeriod() {
  const excl = getExcludeInfluencer();
  let query = supabase
    .from('reservations')
    .select('id, confirmation_code, guest_first_name, guest_last_name, guest_email, guest_phone, country_code, room_type_code, check_in, check_out, created_at, status, total, nights, is_influencer');

  if (dateFilterMode === 'created') {
    query = query
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', new Date(dateRange.end.getTime() + 86400000).toISOString());
  } else {
    // Stay overlaps [start, end] (inclusive nights) iff check_in <= end AND check_out > start (exclusive checkout)
    query = query
      .lte('check_in', sqlDate(dateRange.end))
      .gt('check_out', sqlDate(dateRange.start));
  }

  const { data, error } = await query;
  if (error) throw error;

  let res = data || [];
  if (excl) res = res.filter(r => !r.is_influencer);
  cachedReservations = res;
  return res;
}

function sumNights(reservations) {
  return reservations.reduce((sum, r) => sum + (parseInt(r.nights, 10) || 0), 0);
}

function renderBookingAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  container.innerHTML = `
    <div id="view-booking-analytics" class="client-analytics-container">
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Bookings</h2>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 12px;">Conversion and status${getExcludeInfluencer() ? ' <span style="color:#ef4444;font-weight:600;">(excl. influencer)</span>' : ''}</p>
        <div class="chart-controls" style="display: inline-flex;">
          <button class="chart-btn ${dateFilterMode === 'created' ? 'active' : ''}" id="booking-filter-created" data-booking-filter="created">Created date</button>
          <button class="chart-btn ${dateFilterMode === 'occupancy' ? 'active' : ''}" id="booking-filter-occupancy" data-booking-filter="occupancy">Occupancy dates</button>
        </div>
        <p id="booking-filter-hint" style="font-size: 12px; color: #94a3b8; margin-top: 8px;"></p>
      </div>

      <div class="analytics-section" id="booking-pending-7days-section">
        <div class="analytics-section-title">Pending Payment (Last 7 Days)</div>
        <div id="booking-pending-7days"></div>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-title">Hit Ratio & Conversion</div>
        <div id="booking-hit-ratio-metrics"></div>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-title">Bookings by Status</div>
        <div class="chart-card">
          <div id="booking-status-summary"></div>
        </div>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-title">Bookings by Month</div>
        <div class="chart-card">
          <div id="booking-by-month-chart"></div>
        </div>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-title">Additional Metrics</div>
        <div id="booking-additional-metrics"></div>
      </div>
    </div>
  `;

  renderBookingAnalyticsContent();
  initBookingFilterToggle();
  initBookingDrillHandler();
}

function initBookingDrillHandler() {
  const view = document.getElementById('view-booking-analytics');
  if (!view || view.__bookingDrillBound) return;
  view.__bookingDrillBound = true;
  view.addEventListener('click', (e) => {
    const card = e.target.closest('.metric-card[data-drill]');
    const bar = e.target.closest('.drill-bar-row[data-drill-bar]');
    const drill = card?.dataset?.drill || (bar?.dataset?.drillBar?.startsWith('booking-') ? bar.dataset.drillBar : null);
    if (drill && drill.startsWith('booking-')) {
      e.preventDefault();
      e.stopPropagation();
      handleBookingDrillClick(drill);
    }
  });
}

function initBookingFilterToggle() {
  document.querySelectorAll('[data-booking-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      dateFilterMode = btn.dataset.bookingFilter;
      document.querySelectorAll('[data-booking-filter]').forEach(b => {
        b.classList.toggle('active', b.dataset.bookingFilter === dateFilterMode);
      });
      renderBookingAnalyticsContent();
      updateBookingFilterHint();
    });
  });
  updateBookingFilterHint();
}

function updateBookingFilterHint() {
  const el = document.getElementById('booking-filter-hint');
  if (el) el.textContent = getBookingFilterHint();
}

async function renderBookingAnalyticsContent() {
  try {
    await fetchReservationsForPeriod();
  } catch (err) {
    console.error('Booking analytics: failed to load reservations for period', err);
  }
  await Promise.all([
    renderPending7Days(),
    renderHitRatioMetrics(),
    renderStatusSummary(),
    renderBookingsByMonthChart(),
    renderAdditionalMetrics()
  ]);
  updateBookingFilterHint();
}

async function renderPending7Days() {
  const el = document.getElementById('booking-pending-7days');
  if (!el) return;

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('reservations')
      .select('id, confirmation_code, guest_first_name, guest_last_name, guest_email, guest_phone, country_code, room_type_code, check_in, check_out, created_at, status, total, nights')
      .eq('status', 'pending_payment')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reservations = data || [];

    if (reservations.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No pending payment bookings in the last 7 days</div>';
      return;
    }

    const html = `
      <div class="chart-card">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${reservations.map(r => {
            const guest = [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ').trim() || 'Guest';
            const created = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
            const checkIn = r.check_in ? new Date(r.check_in + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
            return `
              <div class="drill-bar-row" data-drill-bar="booking-detail-${r.id}" title="Open full booking details" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; cursor: pointer;">
                <div>
                  <div style="font-weight: 600; color: #0f172a;">${r.confirmation_code || '–'}</div>
                  <div style="font-size: 13px; color: #64748b;">${guest} · ${r.room_type_code || '–'} · Check-in ${checkIn}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 600; color: #b45309;">${formatCurrency(parseFloat(r.total) || 0, 'GHS')}</div>
                  <div style="font-size: 11px; color: #94a3b8;">Created ${created}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering pending 7 days:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading pending bookings</div>';
  }
}

async function renderHitRatioMetrics() {
  const el = document.getElementById('booking-hit-ratio-metrics');
  if (!el) return;

  try {
    const reservations = cachedReservations;
    const total = reservations.length;
    const totalNights = sumNights(reservations);

    const pendingPayment = reservations.filter(r => (r.status || '').toLowerCase() === 'pending_payment');
    const completed = reservations.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'confirmed' || s === 'checked-in' || s === 'checked-out';
    });
    const cancelled = reservations.filter(r => (r.status || '').toLowerCase() === 'cancelled');

    const completedCount = completed.length;
    const pendingCount = pendingPayment.length;
    const cancelledCount = cancelled.length;
    const completedNights = sumNights(completed);
    const pendingNights = sumNights(pendingPayment);
    const cancelledNights = sumNights(cancelled);

    const conversionRate = total > 0 ? (completedCount / total) * 100 : 0;
    const abandonmentRate = total > 0 ? (pendingCount / total) * 100 : 0;
    const cancellationRate = total > 0 ? (cancelledCount / total) * 100 : 0;

    const html = `
      <div class="metrics-grid">
        <div class="metric-card" data-drill="booking-total">
          <div class="metric-label">Total</div>
          <div class="metric-value">${total}</div>
          <div class="metric-subtext">${total} bookings · ${totalNights} nights</div>
        </div>
        <div class="metric-card" data-drill="booking-completed">
          <div class="metric-label">Completed</div>
          <div class="metric-value">${completedCount}</div>
          <div class="metric-subtext">${completedCount} bookings · ${completedNights} nights</div>
        </div>
        <div class="metric-card" data-drill="booking-pending">
          <div class="metric-label">Abandoned</div>
          <div class="metric-value">${pendingCount}</div>
          <div class="metric-subtext">${pendingCount} bookings · ${pendingNights} nights</div>
        </div>
        <div class="metric-card" data-drill="booking-completed">
          <div class="metric-label">Hit Ratio</div>
          <div class="metric-value">${total > 0 ? conversionRate.toFixed(1) : '—'}%</div>
          <div class="metric-subtext">Completed ÷ Total</div>
        </div>
        <div class="metric-card" data-drill="booking-pending">
          <div class="metric-label">Abandonment</div>
          <div class="metric-value">${total > 0 ? abandonmentRate.toFixed(1) : '—'}%</div>
          <div class="metric-subtext">Pending ÷ Total</div>
        </div>
        <div class="metric-card" data-drill="booking-cancelled">
          <div class="metric-label">Cancelled</div>
          <div class="metric-value">${cancelledCount}</div>
          <div class="metric-subtext">${cancelledCount} bookings · ${cancelledNights} nights · ${total > 0 ? cancellationRate.toFixed(1) : '—'}%</div>
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering hit ratio metrics:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading hit ratio metrics</div>';
  }
}

const STATUS_BAR_COLORS = {
  pending_payment: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
  confirmed: 'linear-gradient(90deg, #4f46e5 0%, #4338ca 100%)',
  'checked-in': 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
  'checked-out': 'linear-gradient(90deg, #64748b 0%, #475569 100%)',
  cancelled: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
};

async function renderStatusSummary() {
  const el = document.getElementById('booking-status-summary');
  if (!el) return;

  try {
    const reservations = cachedReservations;
    const total = reservations.length;

    const statusOrder = ['pending_payment', 'confirmed', 'checked-in', 'checked-out', 'cancelled'];
    const rows = statusOrder
      .map(status => {
        const subset = reservations.filter(r => (r.status || '').toLowerCase() === status);
        const count = subset.length;
        const nights = sumNights(subset);
        return { status, count, nights, label: formatStatusLabel(status) };
      })
      .filter(r => r.count > 0);

    if (rows.length === 0) {
      el.innerHTML = `<div class="analytics-empty">${getBookingFilterHint()}</div>`;
      return;
    }

    const maxCount = Math.max(...rows.map(r => r.count), 1);

    let html = '<div style="display: flex; flex-direction: column; gap: 14px;">';
    rows.forEach(({ status, count, nights, label }) => {
      const barWidth = (count / maxCount) * 100;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      const color = STATUS_BAR_COLORS[status] || 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)';
      html += `
        <div class="drill-bar-row" data-drill-bar="booking-status-${status}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
          <div style="min-width: 130px; font-size: 14px; font-weight: 500; color: #0f172a;">${label}</div>
          <div style="flex: 1; height: 32px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative;">
            <div style="width: ${barWidth}%; height: 100%; background: ${color}; transition: width 0.5s ease;"></div>
          </div>
          <div style="min-width: 120px; text-align: right; font-weight: 600; color: #0f172a;">${count} bookings · ${nights} nights (${pct}%)</div>
        </div>
      `;
    });
    html += '</div>';

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering status summary:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading status summary</div>';
  }
}

function nightsInMonthForStay(checkIn, checkOut, year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let nights = 0;
  let cur = new Date(checkIn + (checkIn.length === 10 ? 'T00:00:00' : ''));
  const end = new Date(checkOut + (checkOut.length === 10 ? 'T00:00:00' : ''));
  while (cur < end) {
    if (cur >= first && cur <= last) nights++;
    cur.setDate(cur.getDate() + 1);
  }
  return nights;
}

async function renderBookingsByMonthChart() {
  const el = document.getElementById('booking-by-month-chart');
  if (!el) return;

  try {
    const reservations = cachedReservations;
    const hint = getBookingFilterHint();

    if (reservations.length === 0) {
      el.innerHTML = `<div class="analytics-empty">${hint}</div>`;
      return;
    }

    const monthData = {};

    reservations.forEach(r => {
      const ci = r.check_in ? String(r.check_in).slice(0, 10) : null;
      const co = r.check_out ? String(r.check_out).slice(0, 10) : null;
      if (!ci || !co) return;
      const checkIn = new Date(ci + (ci.length === 10 ? 'T00:00:00' : ''));
      const checkOut = new Date(co + (co.length === 10 ? 'T00:00:00' : ''));
      for (let d = new Date(checkIn.getFullYear(), checkIn.getMonth(), 1); d <= checkOut; d.setMonth(d.getMonth() + 1), d.setDate(1)) {
        const y = d.getFullYear();
        const m = d.getMonth();
        const n = nightsInMonthForStay(ci, co, y, m);
        if (n > 0) {
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          if (!monthData[key]) {
            monthData[key] = { count: 0, nights: 0, label: new Date(y, m).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) };
          }
          monthData[key].count++;
          monthData[key].nights += n;
        }
      }
    });

    const sortedMonths = Object.entries(monthData)
      .filter(([, v]) => v.count > 0 || v.nights > 0)
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((a, b) => a.key.localeCompare(b.key));

    if (sortedMonths.length === 0) {
      el.innerHTML = `<div class="analytics-empty">${hint}</div>`;
      return;
    }

    const maxCount = Math.max(...sortedMonths.map(m => m.count), 1);

    const chartTitle = dateFilterMode === 'created'
      ? 'Stays by month (created in period)'
      : 'Bookings by month';

    let html = `<p style="font-size: 12px; color: #64748b; margin-bottom: 12px;">${chartTitle}</p>`;
    html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
    sortedMonths.forEach(({ key, label, count, nights }) => {
      const barWidth = (count / maxCount) * 100;
      html += `
        <div class="drill-bar-row" data-drill-bar="booking-month-${key}" style="display: flex; align-items: center; gap: 12px; cursor: pointer; border-radius: 6px; padding: 4px 0; transition: background 0.15s ease;">
          <div style="min-width: 90px; font-size: 14px; font-weight: 500; color: #0f172a;">${label}</div>
          <div style="flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden;">
            <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #4338ca 100%); transition: width 0.5s ease;"></div>
          </div>
          <div style="min-width: 100px; text-align: right; font-size: 14px; font-weight: 600; color: #0f172a;">${count} bookings · ${nights} nights</div>
        </div>
      `;
    });
    html += '</div>';

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering bookings by month chart:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading chart</div>';
  }
}

async function renderAdditionalMetrics() {
  const el = document.getElementById('booking-additional-metrics');
  if (!el) return;

  try {
    const reservations = cachedReservations;
    const completed = reservations.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'confirmed' || s === 'checked-in' || s === 'checked-out';
    });
    const uncompleted = reservations.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'pending_payment' || s === 'cancelled';
    });
    const pendingPayment = reservations.filter(r => (r.status || '').toLowerCase() === 'pending_payment');
    const cancelled = reservations.filter(r => (r.status || '').toLowerCase() === 'cancelled');

    const revenueCompleted = completed.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const revenuePending = pendingPayment.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const revenueCancelled = cancelled.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0);
    const revenueUncompleted = revenuePending + revenueCancelled;

    const avgBookingValueCompleted = completed.length > 0 ? revenueCompleted / completed.length : 0;
    const avgBookingValueUncompleted = uncompleted.length > 0 ? revenueUncompleted / uncompleted.length : 0;

    const avgNightsCompleted = completed.length > 0
      ? completed.reduce((sum, r) => sum + (parseInt(r.nights, 10) || 0), 0) / completed.length
      : 0;
    const avgNightsUncompleted = uncompleted.length > 0
      ? uncompleted.reduce((sum, r) => sum + (parseInt(r.nights, 10) || 0), 0) / uncompleted.length
      : 0;

    const html = `
      <div style="display: flex; flex-direction: column; gap: 28px;">
        <div>
          <h4 style="font-size: 14px; font-weight: 600; color: #16a34a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Completed</h4>
          <div class="metrics-grid">
            <div class="metric-card" data-drill="booking-completed">
              <div class="metric-label">Revenue</div>
              <div class="metric-value">${formatCurrency(revenueCompleted, 'GHS')}</div>
              <div class="metric-subtext">${completed.length} bookings · ${sumNights(completed)} nights</div>
            </div>
            <div class="metric-card" data-drill="booking-completed">
              <div class="metric-label">Avg Value</div>
              <div class="metric-value">${completed.length > 0 ? formatCurrency(avgBookingValueCompleted, 'GHS') : '—'}</div>
              <div class="metric-subtext">${completed.length} bookings</div>
            </div>
            <div class="metric-card" data-drill="booking-completed">
              <div class="metric-label">Avg Stay</div>
              <div class="metric-value">${completed.length > 0 ? avgNightsCompleted.toFixed(1) : '—'} nights</div>
              <div class="metric-subtext">Per booking</div>
            </div>
          </div>
        </div>

        <div>
          <h4 style="font-size: 14px; font-weight: 600; color: #d97706; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">Uncompleted</h4>
          <div class="metrics-grid">
            <div class="metric-card" data-drill="booking-pending">
              <div class="metric-label">Pending Revenue</div>
              <div class="metric-value">${formatCurrency(revenuePending, 'GHS')}</div>
              <div class="metric-subtext">${pendingPayment.length} bookings · ${sumNights(pendingPayment)} nights</div>
            </div>
            <div class="metric-card" data-drill="booking-cancelled">
              <div class="metric-label">Cancelled Revenue</div>
              <div class="metric-value">${formatCurrency(revenueCancelled, 'GHS')}</div>
              <div class="metric-subtext">${cancelled.length} bookings · ${sumNights(cancelled)} nights</div>
            </div>
            <div class="metric-card" data-drill="booking-uncompleted">
              <div class="metric-label">Avg Value</div>
              <div class="metric-value">${uncompleted.length > 0 ? formatCurrency(avgBookingValueUncompleted, 'GHS') : '—'}</div>
              <div class="metric-subtext">${uncompleted.length} total</div>
            </div>
            <div class="metric-card" data-drill="booking-uncompleted">
              <div class="metric-label">Avg Stay</div>
              <div class="metric-value">${uncompleted.length > 0 ? avgNightsUncompleted.toFixed(1) : '—'} nights</div>
              <div class="metric-subtext">Per booking</div>
            </div>
          </div>
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering additional metrics:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading additional metrics</div>';
  }
}

function fmtDate(str) {
  if (!str) return '–';
  try {
    const d = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d.getTime())) return '–';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '–';
  }
}

function escapeHtmlCell(s) {
  if (s == null || s === '') return '–';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildBookingDrillTable(rows) {
  if (!rows || rows.length === 0) {
    return '<div class="analytics-empty" style="padding: 24px; text-align: center;">No reservations</div>';
  }
  const headers = ['Confirmation', 'Guest', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Created', 'Status', 'Nights', 'Total'];
  let html = '<div class="drill-table-wrap"><table class="drill-table"><thead><tr>';
  headers.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach(r => {
    const guest = escapeHtmlCell([r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ').trim() || '–');
    const phone = [r.country_code, r.guest_phone].filter(Boolean).join(' ').trim();
    const status = (r.status || '').toLowerCase().replace(/[-_]/g, '');
    html += `<tr>
      <td>${escapeHtmlCell(r.confirmation_code)}</td>
      <td>${guest}</td>
      <td>${escapeHtmlCell(r.guest_email)}</td>
      <td>${escapeHtmlCell(phone || '–')}</td>
      <td>${escapeHtmlCell(r.room_type_code)}</td>
      <td>${fmtDate(r.check_in)}</td>
      <td>${fmtDate(r.check_out)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><span class="drill-status drill-status-${status}">${formatStatusLabel(r.status)}</span></td>
      <td>${r.nights ?? '–'}</td>
      <td style="text-align:right;">${formatCurrency(parseFloat(r.total) || 0, 'GHS')}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  return html;
}

export async function handleBookingDrillClick(drillType) {
  initDrillThroughModal();

  if (drillType.startsWith('booking-detail-')) {
    const rawId = drillType.replace('booking-detail-', '');
    if (rawId && typeof window !== 'undefined' && typeof window.editReservation === 'function') {
      window.editReservation(rawId);
      return;
    }
  }

  const titleMap = {
    'booking-total': 'All Reservations',
    'booking-completed': 'Completed Reservations',
    'booking-pending': 'Abandoned (Pending Payment)',
    'booking-uncompleted': 'Uncompleted Reservations',
    'booking-cancelled': 'Cancelled Reservations',
  };

  let filtered = [];
  if (drillType === 'booking-total') {
    filtered = cachedReservations;
  } else if (drillType === 'booking-completed') {
    filtered = cachedReservations.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'confirmed' || s === 'checked-in' || s === 'checked-out';
    });
  } else if (drillType === 'booking-uncompleted') {
    filtered = cachedReservations.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'pending_payment' || s === 'cancelled';
    });
  } else if (drillType === 'booking-pending') {
    filtered = cachedReservations.filter(r => (r.status || '').toLowerCase() === 'pending_payment');
  } else if (drillType === 'booking-cancelled') {
    filtered = cachedReservations.filter(r => (r.status || '').toLowerCase() === 'cancelled');
  } else if (drillType.startsWith('booking-status-')) {
    const status = drillType.replace('booking-status-', '');
    filtered = cachedReservations.filter(r => (r.status || '').toLowerCase() === status);
    const label = formatStatusLabel(status);
    openDrillModal(`${label} – ${filtered.length} Reservations`, buildBookingDrillTable(filtered));
    return;
  } else if (drillType === 'booking-pending-7days') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('reservations')
      .select('id, confirmation_code, guest_first_name, guest_last_name, guest_email, guest_phone, country_code, room_type_code, check_in, check_out, created_at, status, total, nights')
      .eq('status', 'pending_payment')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });
    filtered = data || [];
    openDrillModal(`Pending Payment (Last 7 Days) – ${filtered.length} Reservations`, buildBookingDrillTable(filtered));
    return;
  } else if (drillType.startsWith('booking-month-')) {
    const monthKey = drillType.replace('booking-month-', '');
    const [year, month] = monthKey.split('-').map(Number);
    const monthIdx = month - 1;
    filtered = cachedReservations.filter(r => {
      const ci = r.check_in ? String(r.check_in).slice(0, 10) : null;
      const co = r.check_out ? String(r.check_out).slice(0, 10) : null;
      if (!ci || !co) return false;
      return nightsInMonthForStay(ci, co, year, monthIdx) > 0;
    });
    const monthLabel = new Date(year, monthIdx).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    openDrillModal(`${monthLabel} – ${filtered.length} Reservations`, buildBookingDrillTable(filtered));
    return;
  }

  const title = (titleMap[drillType] || 'Reservations') + ` (${filtered.length})`;
  openDrillModal(title, buildBookingDrillTable(filtered));
}
