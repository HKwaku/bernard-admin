// src/notifications.js
// Notification bell – shows new bookings and their status

import { supabase } from './config/supabase.js';
import { formatCurrency } from './utils/helpers.js';

const POLL_INTERVAL_MS = 60000; // 1 minute
const RECENT_HOURS = 24;
const LAST_SEEN_KEY = 'bernard_notifications_last_seen';
let pollTimer = null;

function getLastSeen() {
  try {
    const s = localStorage.getItem(LAST_SEEN_KEY);
    return s ? new Date(s) : null;
  } catch {
    return null;
  }
}

function setLastSeen() {
  try {
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  } catch {}
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

function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'confirmed' || s === 'checked-in' || s === 'checked-out') return '#16a34a';
  if (s === 'pending_payment') return '#d97706';
  if (s === 'cancelled') return '#dc2626';
  return '#64748b';
}

async function fetchRecentBookings() {
  const since = new Date();
  since.setHours(since.getHours() - RECENT_HOURS);

  const { data, error } = await supabase
    .from('reservations')
    .select('id, confirmation_code, guest_first_name, guest_last_name, room_type_code, check_in, created_at, status, total')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Notifications fetch error:', error);
    return [];
  }
  return data || [];
}

function renderNotificationDropdown(bookings) {
  if (!bookings || bookings.length === 0) {
    return `
      <div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 13px;">
        No new bookings in the last 24 hours
      </div>
    `;
  }

  return `
    <div style="max-height: 360px; overflow-y: auto;">
      ${bookings.map(r => {
        const guest = [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ').trim() || 'Guest';
        const created = r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–';
        const statusColor = getStatusColor(r.status);
        const statusLabel = formatStatusLabel(r.status);
        return `
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px; border-bottom: 1px solid #f1f5f9;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: #0f172a; font-size: 13px;">${r.confirmation_code || '–'}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${guest} · ${r.room_type_code || '–'}</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${created}</div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: ${statusColor}20; color: ${statusColor};">${statusLabel}</span>
              <div style="font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 4px;">${formatCurrency(parseFloat(r.total) || 0, 'GHS')}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function updateBadge(unreadCount) {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;
  badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  badge.style.background = '#ef4444';
  badge.style.color = 'white';
}

function toggleDropdown() {
  const panel = document.getElementById('notification-panel');
  if (!panel) return;

  const isHidden = panel.hidden;
  panel.hidden = !isHidden;

  if (!isHidden) {
    setLastSeen();
    pollAndUpdateBadge();
    loadAndRenderNotifications();
  }
}

async function loadAndRenderNotifications() {
  const panel = document.getElementById('notification-panel');
  const body = document.getElementById('notification-panel-body');
  if (!panel || !body) return;

  body.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8;">Loading…</div>';
  const bookings = await fetchRecentBookings();
  body.innerHTML = renderNotificationDropdown(bookings);
}

async function pollAndUpdateBadge() {
  const bookings = await fetchRecentBookings();
  const lastSeen = getLastSeen();
  const unreadCount = lastSeen
    ? bookings.filter(r => new Date(r.created_at) > lastSeen).length
    : bookings.length;
  updateBadge(unreadCount);
}

function initNotificationBell() {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  if (!bell || !panel) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (panel && !panel.hidden && !panel.contains(e.target) && !bell.contains(e.target)) {
      panel.hidden = true;
    }
  });
}

export function initNotifications() {
  const container = document.getElementById('notification-bell-container');
  if (!container) return;

  const notificationHtml = `
      <button id="notification-bell" title="Recent bookings" style="
        background: none;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        color: #94a3b8;
        font-size: 18px;
        padding: 5px 10px;
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="font-size: 18px;">🔔</span>
        <span id="notification-badge" style="
          display: none;
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 700;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
        ">0</span>
      </button>
      <div id="notification-panel" class="notification-panel" hidden style="
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        width: min(380px, 92vw);
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.12);
        z-index: 50;
        overflow: hidden;
      ">
        <div style="padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #0f172a; font-size: 14px;">
          Recent Bookings
        </div>
        <div id="notification-panel-body" style="min-height: 80px;"></div>
      </div>
  `;

  container.innerHTML = notificationHtml;

  initNotificationBell();
  pollAndUpdateBadge();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollAndUpdateBadge, POLL_INTERVAL_MS);
}
