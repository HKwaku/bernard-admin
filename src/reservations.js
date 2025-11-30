// src/reservations.js
// Reservations Management Module (modularised original behaviour)

import { supabase } from './config/supabase.js';
import { $, $$, formatCurrency, toast } from './utils/helpers.js';

// Shared module state
let allReservations = [];
let currentView = 'list'; // 'list' | 'calendar'
let reservations = [];
let collapsedGroups = new Set(); // Track which groups are collapsed

/* ----------------- Public API ----------------- */

export function initReservations() {
  // If we've already loaded once, just re-render
  if (allReservations.length) {
    setupReservationFilters();
    renderReservations();
  } else {
    loadReservations();
  }
}

// Optional extra export if other modules ever need to force a reload
export async function reloadReservations() {
  await loadReservations();
}

/* ----------------- Data load ----------------- */

async function loadReservations() {
  const list = $('#res-list');
  if (list) list.textContent = 'Loading…';

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select(
        'id,confirmation_code,group_reservation_id,group_reservation_code,room_type_id,room_type_code,room_name,check_in,check_out,nights,adults,children,status,payment_status,total,currency,guest_first_name,guest_last_name,guest_email,guest_phone,country_code,notes,package_code,package_name'
      )
      .order('check_in', { ascending: false });

    if (error) throw error;

    allReservations = data || [];

    setupReservationFilters();
    renderReservations();
  } catch (err) {
    console.error('Error loading reservations', err);
    if (list) {
      list.innerHTML = `<div style="padding:24px;color:#b91c1c">
        Error loading reservations: ${err.message || err}
      </div>`;
    }
  }
}

/* ----------------- Filters & view toggle ----------------- */

function setupReservationFilters() {
  const searchInput = $('#res-search');
  const monthSelect = $('#res-month');
  const yearSelect = $('#res-year');
  const listBtn = $('#view-list-btn');
  const calendarBtn = $('#view-calendar-btn');

  // Populate year dropdown once
  if (yearSelect && !yearSelect.dataset._yearsInitialised) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
    yearSelect.innerHTML =
      '<option value="">All years</option>' +
      years.map((y) => `<option value="${y}">${y}</option>`).join('');
    yearSelect.dataset._yearsInitialised = '1';
  }

  searchInput?.addEventListener('input', () => renderReservations());
  monthSelect?.addEventListener('change', () => renderReservations());
  yearSelect?.addEventListener('change', () => renderReservations());

  listBtn?.addEventListener('click', () => {
    currentView = 'list';
    listBtn.classList.add('active');
    calendarBtn?.classList.remove('active');
    renderReservations();
  });

  calendarBtn?.addEventListener('click', () => {
    currentView = 'calendar';
    calendarBtn.classList.add('active');
    listBtn?.classList.remove('active');
    renderReservations();
  });
}

function filterReservations() {
  const searchTerm = ($('#res-search')?.value || '').toLowerCase();
  const selectedMonth = $('#res-month')?.value ?? '';
  const selectedYear = $('#res-year')?.value ?? '';

  return (allReservations || []).filter((r) => {
    // Text search
    if (searchTerm) {
      const searchable = [
        r.guest_first_name,
        r.guest_last_name,
        r.guest_email,
        r.guest_phone,
        r.confirmation_code,
        r.group_reservation_code, 
        r.room_name,
        r.room_type_code,
        r.package_code,
        r.package_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(searchTerm)) return false;
    }

    // Month filter (check_in)
    if (selectedMonth !== '' && r.check_in) {
      const d = new Date(r.check_in);
      if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(selectedMonth)) {
        return false;
      }
    }

    // Year filter (check_in)
    if (selectedYear && r.check_in) {
      const d = new Date(r.check_in);
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== Number(selectedYear)) {
        return false;
      }
    }

    return true;
  });
}

function renderReservations() {
  const filtered = filterReservations();
  const list = $('#res-list');
  const calendar = $('#res-calendar');

  if (currentView === 'calendar') {
    renderCalendarView(filtered);
    if (list) list.style.display = 'none';
    if (calendar) calendar.style.display = 'block';
  } else {
    renderListView(filtered);
    if (list) list.style.display = 'block';
    if (calendar) calendar.style.display = 'none';
  }
}

// ---- Badge helpers for status & payment ----
function formatStatusLabel(status) {
  const s = (status || 'pending').toLowerCase();
  if (s === 'checked-in') return 'Checked In';
  if (s === 'checked-out') return 'Checked Out';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'pending') return 'Pending';
  // fallback: capitalise and replace hyphens
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

function getStatusBadgeClass(status) {
  const s = (status || 'pending').toLowerCase();
  if (s === 'confirmed') return 'ok';
  if (s === 'cancelled') return 'err';
  if (s === 'checked-in') return 'checked-in';
  if (s === 'checked-out') return 'checked-out';
  if (s === 'pending') return 'pending';
  return 'pending';
}

function formatPaymentStatusLabel(status) {
  const s = (status || 'unpaid').toLowerCase();
  if (s === 'partial') return 'Partially Paid';
  if (s === 'unpaid') return 'Unpaid';
  if (s === 'paid') return 'Paid';
  if (s === 'refunded') return 'Refunded';
  // fallback
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

function getPaymentBadgeClass(status) {
  const s = (status || 'unpaid').toLowerCase();
  if (s === 'paid') return 'ok';
  if (s === 'unpaid') return 'err';
  if (s === 'partial') return 'partial';
  if (s === 'refunded') return 'refunded';
  return 'pending';
}

/* ----------------- List view ----------------- */

function renderListView(reservations) {
  const list = $('#res-list');
  if (!list) return;

  if (!reservations.length) {
    list.innerHTML =
      '<div style="padding:24px;text-align:center;color:#64748b">No reservations found</div>';
    return;
  }

    // Group reservations by group_reservation_id (normalise to string)
  const groupMap = new Map();
  const standaloneReservations = [];

  reservations.forEach((r) => {
    if (r.group_reservation_id) {
      const key = String(r.group_reservation_id);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push(r);
    } else {
      standaloneReservations.push(r);
    }
  });

    // ----- Default all groups to COLLAPSED -----
  if (collapsedGroups.size === 0) {
    for (const groupId of groupMap.keys()) {
      collapsedGroups.add(String(groupId));
    }
  }


  // Helper function to render a single reservation item
  const renderReservationItem = (r, inGroup = false) => {
    const total = formatCurrency(r.total || 0, r.currency || 'GHS');
    const statusLabel = formatStatusLabel(r.status);
    const statusClass = getStatusBadgeClass(r.status);
    const paymentLabel = formatPaymentStatusLabel(r.payment_status);
    const paymentClass = getPaymentBadgeClass(r.payment_status);

    const extraStyle = inGroup ? ' background: white; border: 1px solid #bae6fd; margin: 0;' : '';

    return `
      <div class="item" onclick="showReservationDetails('${r.confirmation_code}')" style="cursor:pointer;${extraStyle}">
        <div class="row">
          <div>
            <div class="title">${r.guest_first_name || ''} ${r.guest_last_name || ''}</div>
            <div class="meta">${r.guest_email || ''}</div>
            <div class="meta">Room: <strong>${r.room_name || ''}</strong></div>
            ${
              r.package_name || r.package_code
                ? `<div class="meta">Package: <strong>${r.package_name || r.package_name}</strong></div>`
                : ''
            }
            <div class="meta">Check-in: ${r.check_in || ''} • Check-out: ${r.check_out || ''}</div>
            <div class="meta">Guests: ${r.adults || 1} • Nights: ${r.nights || 1}</div>
          </div>

          <div style="text-align:right">
            <div class="code">
              ${r.confirmation_code}
              ${
                r.group_reservation_code && !inGroup
                  ? `<div style="font-size:12px;color:#0ea5e9;margin-top:2px">
                      Group: <strong>${r.group_reservation_code}</strong>
                    </div>`
                  : ''
              }
            </div>
            <div style="margin:6px 0">
              <span class="badge ${statusClass}">${statusLabel}</span>
              <span class="badge ${paymentClass}" style="margin-left:6px">
                ${paymentLabel}
              </span>
              ${
                r.package_code || r.package_name
                  ? `<span class="badge" style="margin-left:6px;background:#fbbf24;color:#78350f;font-weight:600">
                      Package
                    </span>`
                  : ''
              }
            </div>
            <div class="price">${total}</div>
          </div>
        </div>
        <div class="room-card-footer" onclick="event.stopPropagation()">
          <button class="btn btn-sm" data-res-edit="${r.id}">Edit</button>
          <button class="btn btn-sm" data-res-delete="${r.id}" style="color:#b91c1c">Delete</button>
        </div>
      </div>
    `;
  };

  const html = [];

  // Render groups
  groupMap.forEach((groupReservations, groupId) => {
    const key = String(groupId);
    const isCollapsed = collapsedGroups.has(key);
    
    if (isCollapsed) {
      // Collapsed: show single card
      const primaryRes = groupReservations[0];
      const totalRooms = groupReservations.length;
      const totalAmount = groupReservations.reduce((sum, r) => sum + (r.total || 0), 0);
      const total = formatCurrency(totalAmount, primaryRes.currency || 'GHS');
      const statusLabel = formatStatusLabel(primaryRes.status);
      const statusClass = getStatusBadgeClass(primaryRes.status);
      const paymentLabel = formatPaymentStatusLabel(primaryRes.payment_status);
      const paymentClass = getPaymentBadgeClass(primaryRes.payment_status);

      html.push(`
        <div class="item" style="border-left: 4px solid #0ea5e9; background: linear-gradient(to right, #f0f9ff, white);">
          <div class="row">
            <div>
              <div class="title" style="display: flex; align-items: center; gap: 8px;">
                <span style="background: #0ea5e9; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">GROUP</span>
                ${primaryRes.guest_first_name || ''} ${primaryRes.guest_last_name || ''}
              </div>
              <div class="meta">${primaryRes.guest_email || ''}</div>
              <div class="meta"><strong>${totalRooms} Cabins</strong> • ${primaryRes.check_in || ''} to ${primaryRes.check_out || ''}</div>
              <div class="meta">Total Guests: ${primaryRes.adults || 1} • Nights: ${primaryRes.nights || 1}</div>
            </div>

            <div style="text-align:right">
              <div class="code">
                ${primaryRes.group_reservation_code || primaryRes.confirmation_code}
              </div>
              <div style="margin:6px 0">
                <span class="badge ${statusClass}">${statusLabel}</span>
                <span class="badge ${paymentClass}" style="margin-left:6px">
                  ${paymentLabel}
                </span>
              </div>
              <div class="price">${total}</div>
            </div>
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <button 
              class="btn btn-sm" 
              data-group-toggle="${key}"
              onclick="event.stopPropagation()"
              style="font-size: 13px; padding: 4px 12px;">
              ▼ Expand ${totalRooms} Reservations
            </button>
          </div>
        </div>
      `);
    } else {
      // Expanded: show all reservations
      const totalRooms = groupReservations.length;
      const primaryRes = groupReservations[0];
      
      html.push(`
        <div class="group-card" style="border: 2px solid #0ea5e9; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f0f9ff;">
          <div class="group-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #0ea5e9; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">GROUP RESERVATION</span>
              <span style="color: #0369a1; font-weight: 600;">${totalRooms} Cabins</span>
              <span style="color: #64748b; font-size: 14px;">Code: ${primaryRes.group_reservation_code || primaryRes.confirmation_code}</span>
            </div>
            <button 
              class="btn btn-sm" 
              data-group-toggle="${key}"
              style="font-size: 13px; padding: 4px 12px;">
              ▲ Collapse Group
            </button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
      `);
      
      groupReservations.forEach((r) => {
        html.push(renderReservationItem(r, true));
      });
      
      html.push(`
          </div>
        </div>
      `);
    }
  });

  // Render standalone reservations
  standaloneReservations.forEach((r) => {
    html.push(renderReservationItem(r, false));
  });

  list.innerHTML = html.join('');

  // Attach Edit/Delete behaviour
  list.querySelectorAll('[data-res-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      reservationOpenEdit(btn.getAttribute('data-res-edit'));
    });
  });

  list.querySelectorAll('[data-res-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      reservationDelete(btn.getAttribute('data-res-delete'));
    });
  });

  // Attach group toggle listeners
  list.querySelectorAll('[data-group-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const groupId = btn.getAttribute('data-group-toggle'); // keep as string
      if (collapsedGroups.has(groupId)) {
        collapsedGroups.delete(groupId);
      } else {
        collapsedGroups.add(groupId);
      }
      renderReservations();
    });
  });

}

/* ----------------- Calendar view ----------------- */

function renderCalendarView(reservations) {
  const calendar = $('#res-calendar');
  if (!calendar) return;

  const monthSelect = $('#res-month');
  const yearSelect = $('#res-year');

  let displayDate;
  const today = new Date();

  if (monthSelect && yearSelect && yearSelect.value && monthSelect.value !== '') {
    displayDate = new Date(
      Number(yearSelect.value),
      Number(monthSelect.value),
      1
    );
  } else {
    // default to current month
    displayDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const monthDays = lastDay.getDate();

  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
   // ---- Occupancy baseline: how many cabins exist in total? ----
  const allActiveReservations = (allReservations || []).filter(
    (r) => r.status !== 'cancelled'
  );

  const cabinSet = new Set(
    allActiveReservations
      .map((r) => r.room_type_code)
      .filter(Boolean)
  );

  // Used to decide when a day is "full" vs "partial"
  const totalCabins = cabinSet.size || 1;
  // Group reservations by each date they span (ignore cancelled)
  const reservationsByDate = {};
  const activeReservationsForMonth = reservations.filter(
    (r) => r.status !== 'cancelled'
  );

  activeReservationsForMonth.forEach((r) => {

    if (!r.check_in || !r.check_out) return;
    const checkIn = new Date(r.check_in);
    const checkOut = new Date(r.check_out);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return;

    for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!reservationsByDate[day]) reservationsByDate[day] = [];
        reservationsByDate[day].push(r);
      }
    }
  });

  let html = `
    <div class="calendar-container">
      <div class="calendar-header">
        <button class="btn" id="prev-month">‹</button>
        <h3 style="margin:0;flex:1;text-align:center">${monthNames[month]} ${year}</h3>
        <button class="btn" id="next-month">›</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-header">Sun</div>
        <div class="calendar-day-header">Mon</div>
        <div class="calendar-day-header">Tue</div>
        <div class="calendar-day-header">Wed</div>
        <div class="calendar-day-header">Thu</div>
        <div class="calendar-day-header">Fri</div>
        <div class="calendar-day-header">Sat</div>
  `;

  // Empty cells before first day
  for (let i = 0; i < startingDayOfWeek; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of the month
for (let day = 1; day <= monthDays; day++) {
  const todayFlag =
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const bookings = reservationsByDate[day] || [];

  // 🔹 NEW: how many distinct cabins are booked on this day?
  const cabinsBookedToday = new Set(
    bookings
      .map((b) => b.room_type_code)
      .filter(Boolean)
  );
  const bookedCabinCount = cabinsBookedToday.size;

  // ---- Decide day colour based on occupancy (full / partial / free) ----
  let occupancyClass = '';
  if (bookedCabinCount >= totalCabins && bookedCabinCount > 0) {
    // All cabins that exist are booked → grey
    occupancyClass = ' desktop-full mobile-full';
  } else if (bookedCabinCount > 0) {
    // Some, but not all, cabins booked → amber
    occupancyClass = ' desktop-partial mobile-partial';
  }
  // If bookedCabinCount === 0, occupancyClass stays '' → green via CSS

  html += `
    <div class="calendar-day ${bookings.length ? 'has-bookings' : ''}${occupancyClass}"
         data-day="${day}"
         style="cursor:${bookings.length ? 'pointer' : 'default'}">

      <div class="calendar-day-number">${day}</div>
      ${
        bookings
          .slice(0, 5)
          .map((b) => {
            const co = b.check_out ? new Date(b.check_out) : null;
            const isCheckoutDay =
              co &&
              !Number.isNaN(co.getTime()) &&
              co.getFullYear() === year &&
              co.getMonth() === month &&
              co.getDate() === day;

            const chipClass = isCheckoutDay
              ? 'calendar-chip checkout-day'
              : 'calendar-chip';

            return `
              <div class="${chipClass}">
                ${b.room_type_code || b.room_name || ''}
                ${b.package_code || b.package_name ? '<span style="margin-left:4px;font-size:10px;background:#fbbf24;color:#78350f;padding:1px 4px;border-radius:4px;font-weight:600">PKG</span>' : ''}
              </div>`;
          })
          .join('') || ''
      }
      ${
        bookings.length > 5
          ? `<div class="calendar-more">+${bookings.length - 5} more</div>`
          : ''
      }

    </div>
  `;
}
  html += '</div></div>';
  calendar.innerHTML = html;

  // Month navigation
  $('#prev-month')?.addEventListener('click', () => {
    const d = new Date(year, month - 1, 1);
    if (monthSelect) monthSelect.value = d.getMonth().toString();
    if (yearSelect) yearSelect.value = d.getFullYear().toString();
    renderReservations();
  });

  $('#next-month')?.addEventListener('click', () => {
    const d = new Date(year, month + 1, 1);
    if (monthSelect) monthSelect.value = d.getMonth().toString();
    if (yearSelect) yearSelect.value = d.getFullYear().toString();
    renderReservations();
  });

  // Click a day with bookings to show all reservations for that date
  calendar
    .querySelectorAll('.calendar-day.has-bookings')
    .forEach((dayEl) => {
      dayEl.addEventListener('click', () => {
        const dayNum = Number(dayEl.getAttribute('data-day'));
        const bookings = reservationsByDate[dayNum] || [];
        showReservationsForDate(year, month, dayNum, bookings);
      });
    });
}

/* ----------------- Edit & delete ----------------- */

function reservationOpenEdit(id) {
  window.editReservation?.(id);
}

// Provide a full edit implementation here too, if window.editReservation is not set
window.editReservation = window.editReservation || openEditModal;

function reservationDelete(id) {
  if (!id) return;
  if (!confirm('Are you sure you want to delete this reservation?')) return;

  supabase
    .from('reservations')
    .delete()
    .eq('id', id)
    .then(({ error }) => {
      if (error) {
        alert('Error deleting: ' + (error.message || error));
        return;
      }
      toast('Reservation deleted');
      loadReservations();
    });
}

// ---- Prevent double booking when editing: skip the current reservation id ----
async function isRoomAvailableForEdit(roomTypeId, roomTypeCode, checkInISO, checkOutISO, reservationIdsToSkip) {
  if (!roomTypeId && !roomTypeCode) return false;
  if (!checkInISO || !checkOutISO) return false;

  const newStart = new Date(checkInISO);
  const newEnd   = new Date(checkOutISO);

  if (
    Number.isNaN(newStart.getTime()) ||
    Number.isNaN(newEnd.getTime()) ||
    newEnd <= newStart
  ) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, check_in, check_out, status, room_type_id, room_type_code');

    if (error) {
      console.error('Availability check error (edit):', error);
      return false;
    }

    const idNum = roomTypeId != null ? Number(roomTypeId) : null;
    
    // Convert reservationIdsToSkip to array if it's a single value
    const skipIds = Array.isArray(reservationIdsToSkip) 
      ? reservationIdsToSkip 
      : (reservationIdsToSkip ? [reservationIdsToSkip] : []);

    const relevant = (data || []).filter((r) => {
      if (skipIds.includes(r.id)) return false; // skip all IDs in the group
      if (r.status === 'cancelled' || r.status === 'no_show') return false;

      const sameId   = idNum !== null && Number(r.room_type_id) === idNum;
      const sameCode = roomTypeCode && r.room_type_code === roomTypeCode;
      return sameId || sameCode;
    });

    const hasOverlap = relevant.some((r) => {
      if (!r.check_in || !r.check_out) return false;
      const existingStart = new Date(r.check_in);
      const existingEnd   = new Date(r.check_out);
      if (
        Number.isNaN(existingStart.getTime()) ||
        Number.isNaN(existingEnd.getTime())
      ) {
        return false;
      }
      // half-open ranges [check_in, check_out)
      return existingStart < newEnd && existingEnd > newStart;
    });

    return !hasOverlap;
  } catch (err) {
    console.error('Availability check exception (edit):', err);
    return false;
  }
}

async function openEditModal(id) {
  try {
    // --- Load base reservation ---
    const { data: r, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!r) return;

    // --- Load rooms, extras, and existing reservation extras ---
    const [{ data: rooms }, { data: extras }, { data: resExtras }] = await Promise.all([
      supabase
        .from('room_types')
        .select('id,code,name,base_price_per_night_weekday,base_price_per_night_weekend,currency')
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('extras')
        .select('id,code,name,price,category')
        .eq('is_active', true)
        .order('category,name'),
      supabase
        .from('reservation_extras')
        .select('id,extra_id,extra_code,extra_name,price,quantity')
        .eq('reservation_id', id),
    ]);

    const toDateInput = (v) => {
      if (!v) return '';
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    };

    const roomMap = Object.fromEntries((rooms || []).map((rm) => [String(rm.id), rm]));
    const initialSelectedRoomId = r.room_type_id ? String(r.room_type_id) : null;

    const roomsHtml =
      (rooms || []).length
        ? (rooms || [])
            .map(
              (rm) => `
              <label style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
                <input 
                  type="checkbox"
                  class="er-room-checkbox"
                  value="${rm.id}"
                  data-code="${rm.code || ''}"
                  data-name="${rm.name || ''}"
                  style="width:auto"
                  ${
                    initialSelectedRoomId &&
                    String(rm.id) === initialSelectedRoomId
                      ? 'checked'
                      : ''
                  }
                />
                <span>${(rm.code || '').toUpperCase()} – ${rm.name || ''}</span>
              </label>
            `
            )
            .join('')
        : '<div class="muted">No room types available</div>';

    const extraNameMap = Object.fromEntries((extras || []).map((e) => [String(e.id), e.name]));
    const selectedExtraIdSet = new Set(
      (resExtras || []).map((e) => String(e.extra_id || e.extra_code || ''))
    );

    // Quantities per extra (preload from reservation_extras)
    const extraQuantities = {};
    (resExtras || []).forEach((e) => {
      const key = String(e.extra_id || e.extra_code || '');
      if (e.quantity != null && e.quantity > 0) {
        extraQuantities[key] = e.quantity;
      }
    });

    const roomOptions = (rooms || [])
      .map(
        (rm) => `
        <option value="${rm.id}"
          data-code="${rm.code}"
          data-name="${rm.name}"
          ${rm.id === r.room_type_id ? 'selected' : ''}
        >
          ${rm.name} (${rm.code})
        </option>`
      )
      .join('');

    const extrasHtml = (extras || [])
      .map((e) => {
        const key = String(e.id || e.code || '');
        const qty = extraQuantities[key] != null ? extraQuantities[key] : 0;
        return `
          <div class="er-extra-row" data-extra-id="${key}"
               style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;padding:8px;border:1px solid var(--ring);border-radius:10px;">
            <div>
              <div style="font-weight:700">${e.name}</div>
              <div style="color:#64748b;font-size:0.85rem">GHS ${e.price}</div>
            </div>

            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn btn-sm er-extra-dec" data-id="${key}">−</button>
              <span class="er-extra-qty" id="er-extra-qty-${key}">${qty}</span>
              <button class="btn btn-sm er-extra-inc" data-id="${key}">+</button>
            </div>
          </div>
        `;
      })
      .join('');

    // --- Build modal shell ---
    const modal = document.createElement('div');
    modal.id = 'reservation-modal';
    modal.className = 'modal show';

    modal.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3 style="margin:0">Edit Reservation</h3>
          <button class="btn" id="er-close-btn">×</button>
        </div>

        <div class="bd">
          <div class="form-grid">
            <div class="form-group">
              <label>First Name</label>
              <input id="er-first" type="text" value="${r.guest_first_name || ''}" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input id="er-last" type="text" value="${r.guest_last_name || ''}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Email</label>
              <input id="er-email" type="email" value="${r.guest_email || ''}" />
            </div>
            <div class="form-group">
            <label>Phone</label>
            <div style="display:flex;gap:8px;align-items:center;width:100%">
              <input
                id="er-country-code"
                type="text"
                placeholder="+233"
                style="max-width:80px"
                value="${r.country_code || ''}"
              />
              <input
                id="er-phone"
                type="text"
                style="flex:1"
                value="${r.guest_phone || ''}"
              />
            </div>
          </div>
            <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <span>Influencer?</span>
              <input type="checkbox" id="res-influencer" />
            </label>
          </div>
          </div>

                    <div class="form-grid">
            <div class="form-group" style="min-width:0">
              <label>Cabins (select one or more)</label>
              <div
                id="er-rooms-list"
                style="
                  border:1px solid var(--ring);
                  border-radius:var(--radius-md);
                  padding:10px;
                  max-height:200px;
                  overflow-y:auto;
                  display:flex;
                  flex-direction:column;
                  gap:6px;
                "
              >
                ${roomsHtml}
              </div>
            </div>
            <div class="form-group">
              <label>Currency</label>
              <input id="er-currency" type="text" value="${r.currency || 'GHS'}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Check-in</label>
              <input id="er-in" type="date" value="${toDateInput(r.check_in)}" />
            </div>
            <div class="form-group">
              <label>Check-out</label>
              <input id="er-out" type="date" value="${toDateInput(r.check_out)}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Nights (auto-calculated)</label>
              <input id="er-nights" type="number" min="1" step="1"
                     value="${r.nights || 1}" readonly style="background:#f5f5f5" />
            </div>
            <div class="form-group" style="display:none">
              <input id="er-room-subtotal" type="hidden"
                     value="${typeof r.room_subtotal === 'number' ? r.room_subtotal.toFixed(2) : ''}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Adults</label>
              <input id="er-adults" type="number" min="1" step="1" value="${r.adults ?? 1}" />
            </div>
            <div class="form-group">
              <label>Children</label>
              <input id="er-children" type="number" min="0" step="1" value="${r.children ?? 0}" />
            </div>
          </div>

          <div class="form-group">
            <label>Extras (Optional)</label>
            <div id="er-extras-list" class="extras-box">
              ${extrasHtml || '<div class="muted">No extras available</div>'}
            </div>
          </div>

          <div class="form-group">
            <label>Coupon Code (Optional)</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="er-coupon" type="text" placeholder="Enter coupon code"
                     style="text-transform:uppercase;flex:1"
                     value="${r.coupon_code || ''}" />
              <button class="btn btn-sm" id="er-apply-coupon" type="button">Apply</button>
            </div>
            <div id="er-coupon-msg" style="margin-top:4px;font-size:0.875rem;min-height:18px"></div>
            <div id="er-applied-coupon-display" style="margin-top:8px"></div>
          </div>

          <!-- Price Breakdown -->
          <div style="background:#f8fafc;border:1px solid var(--ring);border-radius:var(--radius-md);padding:14px;margin-top:12px">
            <div style="font-weight:700;font-size:0.875rem;margin-bottom:10px;color:var(--ink)">Price Breakdown</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
              <span style="color:var(--muted)">Room Subtotal:</span>
              <span id="er-calc-room-subtotal" style="font-weight:600">GHS 0.00</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
              <span style="color:var(--muted)">Extras:</span>
              <span id="er-calc-extras-total" style="font-weight:600">GHS 0.00</span>
            </div>
            <div id="er-calc-discount-row" style="display:none;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
              <span style="color:var(--muted)">Discount (<span id="er-calc-discount-label"></span>):</span>
              <span id="er-calc-discount" style="font-weight:600;color:#16a34a">−GHS 0.00</span>
            </div>
            <div style="border-top:2px solid var(--ring);margin:10px 0;padding-top:10px;display:flex;justify-content:space-between;font-size:1rem">
              <span style="font-weight:800">Total:</span>
              <span id="er-calc-total" style="font-weight:800;color:var(--brand)">GHS 0.00</span>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Status</label>
              <select id="er-status">
                <option value="pending"   ${r.status === 'pending'   ? 'selected' : ''}>Pending</option>
                <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="checked-in"  ${r.status === 'checked-in' ? 'selected' : ''}>Checked In</option>
                <option value="checked-out" ${r.status === 'checked-out' ? 'selected' : ''}>Checked Out</option>
                <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </div>
            <div class="form-group">
              <label>Payment Status</label>
              <select id="er-pay">
                <option value="unpaid"   ${r.payment_status === 'unpaid'   ? 'selected' : ''}>Unpaid</option>
                <option value="partial"  ${r.payment_status === 'partial'  ? 'selected' : ''}>Partially Paid</option>
                <option value="paid"     ${r.payment_status === 'paid'     ? 'selected' : ''}>Paid</option>
                <option value="refunded" ${r.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea id="er-notes" rows="3">${r.notes || ''}</textarea>
          </div>
        </div>

        <div class="ft">
          <button class="btn" id="er-cancel">Cancel</button>
          <button class="btn btn-danger" id="er-delete">Delete</button>
          <button class="btn btn-primary" id="er-save">Save Changes</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    const influencerEl = $('#res-influencer');
    if (influencerEl) {
      influencerEl.checked = !!r.is_influencer;
}
        // Extras quantity controls in edit modal
    modal.querySelectorAll('.er-extra-inc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = extraQuantities[id] || 0;
        const next = current + 1;
        extraQuantities[id] = next;
        const span = modal.querySelector(`#er-extra-qty-${id}`);
        if (span) span.textContent = String(next);
        updatePriceBreakdown();
      });
    });

    modal.querySelectorAll('.er-extra-dec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = extraQuantities[id] || 0;
        const next = current > 0 ? current - 1 : 0;
        extraQuantities[id] = next;
        const span = modal.querySelector(`#er-extra-qty-${id}`);
        if (span) span.textContent = String(next);
        updatePriceBreakdown();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    modal.querySelector('#er-close-btn')?.addEventListener('click', close);
    modal.querySelector('#er-cancel')?.addEventListener('click', close);

    // --- Delete behaviour (unchanged idea, but now within new modal) ---
    modal.querySelector('#er-delete')?.addEventListener('click', async () => {
      if (!confirm('Delete this reservation?')) return;
      const { error: delErr } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);
      if (delErr) {
        alert('Error deleting: ' + (delErr.message || delErr));
        return;
      }
      toast('Reservation deleted');
      close();
      loadReservations();
    });

    // ---------- Pricing + coupon logic (mirrors New Custom Booking) ----------
        const inEl = modal.querySelector('#er-in');
    const outEl = modal.querySelector('#er-out');
    const nightsEl = modal.querySelector('#er-nights');
    const roomSubtotalEl = modal.querySelector('#er-room-subtotal');
    const currencyInput = modal.querySelector('#er-currency');

    function getSelectedRoomIds() {
      return Array.from(
        modal.querySelectorAll('.er-room-checkbox:checked')
      ).map((cb) => cb.value);
    }


    let appliedCoupon = null;
    let selectedExtras = [];

    function isWeekend(d) {
      const dow = d.getDay();
      return dow === 5 || dow === 6; // Fri / Sat
    }

    function calculateNights() {
      const ci = new Date(inEl.value);
      const co = new Date(outEl.value);
      if (!Number.isNaN(ci.getTime()) && !Number.isNaN(co.getTime()) && co > ci) {
        nightsEl.value = String(Math.ceil((co - ci) / (1000 * 60 * 60 * 24)));
      } else {
        nightsEl.value = '1';
      }
    }

        function computeRoomSubtotal() {
      const selectedRoomIds = getSelectedRoomIds();
      const ci = new Date(inEl.value);
      const co = new Date(outEl.value);

      if (!selectedRoomIds.length || !inEl.value || !outEl.value || !(co > ci)) {
        // Fallback to stored subtotal if present
        if (typeof r.room_subtotal === 'number' && !roomSubtotalEl.value) {
          roomSubtotalEl.value = String(r.room_subtotal.toFixed(2));
        }
        updatePriceBreakdown();
        return;
      }

      let weekdayN = 0;
      let weekendN = 0;

      // Count nights between check-in (inclusive) and check-out (exclusive)
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        if (isWeekend(d)) weekendN++;
        else weekdayN++;
      }

      nightsEl.value = String(weekdayN + weekendN);

      let totalSubtotal = 0;

      selectedRoomIds.forEach((roomId) => {
        const info = roomMap[String(roomId)];
        if (!info) return;
        const wkdPrice = Number(info.base_price_per_night_weekday || 0);
        const wkePrice = Number(info.base_price_per_night_weekend || 0);
        totalSubtotal += weekdayN * wkdPrice + weekendN * wkePrice;
      });

      roomSubtotalEl.value = totalSubtotal.toFixed(2);
      updatePriceBreakdown();
    }

    function updatePriceBreakdown() {
      const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
      const currency = currencyInput.value || 'GHS';

            // extras from extraQuantities
      selectedExtras = Object.entries(extraQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([key, qty]) => {
          const ex =
            (extras || []).find(
              (e) => String(e.id || e.code || '') === String(key)
            ) || {};
          return {
            extra_id: ex.id,
            extra_code: ex.code || '',
            extra_name: ex.name || '',
            price: Number(ex.price || 0),
            quantity: qty,
          };
        });

      const extrasTotal = selectedExtras.reduce(
        (sum, e) => sum + e.price * e.quantity,
        0
      );

      // For coupons that target only some extras
      let extrasTargetTotal = extrasTotal;
      if (
        appliedCoupon &&
        Array.isArray(appliedCoupon.extra_ids) &&
        appliedCoupon.extra_ids.length
      ) {
        const idSet = new Set(appliedCoupon.extra_ids.map(String));
        extrasTargetTotal = selectedExtras
          .filter((e) => idSet.has(String(e.extra_id)))
          .reduce((sum, e) => sum + e.price * e.quantity, 0);
      }

      let discount = 0;
      if (appliedCoupon) {
        const subtotal = roomSubtotal + extrasTotal;

        if (appliedCoupon.applies_to === 'both') {
          let base;
          if (
            Array.isArray(appliedCoupon.extra_ids) &&
            appliedCoupon.extra_ids.length
          ) {
            base = roomSubtotal + extrasTargetTotal;
          } else {
            base = roomSubtotal + extrasTotal;
          }
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        } else if (appliedCoupon.applies_to === 'rooms') {
          const base = roomSubtotal;
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        } else if (appliedCoupon.applies_to === 'extras') {
          const base = extrasTargetTotal;
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        }

        discount = Math.min(discount, subtotal);
      }

      const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);

      modal.querySelector('#er-calc-room-subtotal').textContent =
        `${currency} ${roomSubtotal.toFixed(2)}`;
      modal.querySelector('#er-calc-extras-total').textContent =
        `${currency} ${extrasTotal.toFixed(2)}`;

      if (discount > 0 && appliedCoupon) {
        modal.querySelector('#er-calc-discount-row').style.display = 'flex';
        modal.querySelector('#er-calc-discount-label').textContent = appliedCoupon.code;
        modal.querySelector('#er-calc-discount').textContent =
          `−${currency} ${discount.toFixed(2)}`;
      } else {
        modal.querySelector('#er-calc-discount-row').style.display = 'none';
      }

      modal.querySelector('#er-calc-total').textContent =
        `${currency} ${finalTotal.toFixed(2)}`;
    }

    async function validateCoupon(code) {
      try {
        const { data: coupons } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', code.toUpperCase());

        if (!coupons || coupons.length === 0) {
          return { valid: false, error: 'Invalid coupon code' };
        }

        const coupon = coupons[0];

        if (!coupon.is_active) {
          return { valid: false, error: 'This coupon is no longer active' };
        }

        const today = new Date().toISOString().split('T')[0];
        if (coupon.valid_until && coupon.valid_until < today) {
          return { valid: false, error: 'This coupon has expired' };
        }

        if (coupon.max_uses && (coupon.current_uses || 0) >= coupon.max_uses) {
          return { valid: false, error: 'This coupon has reached its usage limit' };
        }

        const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
        const extrasTotal = selectedExtras.reduce(
          (sum, e) => sum + e.price * e.quantity,
          0
        );
        const subtotal = roomSubtotal + extrasTotal;

        if (coupon.min_booking_amount && subtotal < coupon.min_booking_amount) {
          return {
            valid: false,
            error: `Minimum booking amount of GHS ${coupon.min_booking_amount} required`,
          };
        }

        if (
          (coupon.applies_to === 'extras' || coupon.applies_to === 'both') &&
          Array.isArray(coupon.extra_ids) &&
          coupon.extra_ids.length
        ) {
          const selectedIds = new Set(selectedExtras.map((e) => String(e.extra_id)));
          const anyMatch = coupon.extra_ids.some((id) => selectedIds.has(String(id)));
          if (!anyMatch) {
            return {
              valid: false,
              error: 'This coupon does not apply to the selected extras',
            };
          }
        }

        return { valid: true, coupon };
      } catch (err) {
        return { valid: false, error: 'Error validating coupon: ' + err.message };
      }
    }

    // Events: dates & room
    function syncCheckoutPlusOne() {
      if (!inEl.value) return;
      const ci = new Date(inEl.value);
      if (Number.isNaN(ci.getTime())) return;
      ci.setDate(ci.getDate() + 1);
      outEl.value = ci.toISOString().slice(0, 10);
    }

    inEl.addEventListener('change', () => {
      syncCheckoutPlusOne();
      calculateNights();
      computeRoomSubtotal();
    });

    outEl.addEventListener('change', () => {
      calculateNights();
      computeRoomSubtotal();
    });

    modal.addEventListener('change', (e) => {
      if (e.target.classList.contains('er-room-checkbox')) {
        computeRoomSubtotal();
      }
    });



    // Apply coupon
    modal.querySelector('#er-apply-coupon').addEventListener('click', async () => {
      const code = modal.querySelector('#er-coupon').value.trim();
      const msgEl = modal.querySelector('#er-coupon-msg');
      const displayEl = modal.querySelector('#er-applied-coupon-display');
      const btn = modal.querySelector('#er-apply-coupon');

      if (!code) {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'Please enter a coupon code';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Checking...';

      const result = await validateCoupon(code);

      if (result.valid) {
        appliedCoupon = result.coupon;
        msgEl.style.color = '#166534';
        msgEl.textContent =
          '✓ Coupon applied: ' + (appliedCoupon.description || appliedCoupon.code);

        const discountText =
          appliedCoupon.discount_type === 'percentage'
            ? `${appliedCoupon.discount_value}% off`
            : `GHS ${appliedCoupon.discount_value} off`;

        let scopeLabel;
        if (appliedCoupon.applies_to === 'both') {
          let labels = [];
          if (Array.isArray(appliedCoupon.extra_ids) && appliedCoupon.extra_ids.length) {
            labels = appliedCoupon.extra_ids
              .map((id2) => extraNameMap[String(id2)])
              .filter(Boolean);
          }
          if (labels.length === 0) scopeLabel = 'Room and Extras';
          else if (labels.length === 1) scopeLabel = `Room and ${labels[0]}`;
          else if (labels.length === 2) scopeLabel = `Room and ${labels[0]} and ${labels[1]}`;
          else scopeLabel = `Room and ${labels.slice(0, 2).join(', ')} and others`;
        } else if (appliedCoupon.applies_to === 'rooms') {
          scopeLabel = 'Room Only';
        } else if (appliedCoupon.applies_to === 'extras') {
          let labels = [];
          if (Array.isArray(appliedCoupon.extra_ids) && appliedCoupon.extra_ids.length) {
            labels = appliedCoupon.extra_ids
              .map((id2) => extraNameMap[String(id2)])
              .filter(Boolean);
          }
          if (labels.length === 0) scopeLabel = 'Extras';
          else if (labels.length === 1) scopeLabel = labels[0];
          else if (labels.length === 2) scopeLabel = `${labels[0]} and ${labels[1]}`;
          else scopeLabel = `${labels.slice(0, 2).join(', ')} and others`;
        } else {
          scopeLabel = appliedCoupon.applies_to || '';
        }

        displayEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#dcfce7;border:1px solid #86efac;border-radius:8px">
            <div style="font-size:0.875rem;color:#166534">
              <strong>${appliedCoupon.code}</strong> - ${discountText} ${scopeLabel}
            </div>
            <button type="button" class="btn btn-sm" id="er-remove-coupon"
                    style="background:#fff;color:#b91c1c;border:1px solid #fecaca;padding:4px 8px;font-size:0.75rem">
              Remove
            </button>
          </div>
        `;

        modal.querySelector('#er-remove-coupon')?.addEventListener('click', () => {
          appliedCoupon = null;
          modal.querySelector('#er-coupon').value = '';
          msgEl.textContent = '';
          displayEl.innerHTML = '';
          updatePriceBreakdown();
        });

        updatePriceBreakdown();
      } else {
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = '✗ ' + result.error;
        appliedCoupon = null;
      }

      btn.disabled = false;
      btn.textContent = 'Apply';
    });

    // Initial calculations (using stored values if present)
    calculateNights();
    if (roomSubtotalEl.value) {
      updatePriceBreakdown();
    } else {
      computeRoomSubtotal();
    }

    // If an existing coupon is present, try to auto-apply it
    if (r.coupon_code) {
      const msgEl = modal.querySelector('#er-coupon-msg');
      const displayEl = modal.querySelector('#er-applied-coupon-display');
      const result = await validateCoupon(r.coupon_code);
      if (result.valid) {
        appliedCoupon = result.coupon;
        msgEl.style.color = '#166534';
        msgEl.textContent =
          '✓ Coupon applied: ' +
          (appliedCoupon.description || appliedCoupon.code);

        const discountText =
          appliedCoupon.discount_type === 'percentage'
            ? `${appliedCoupon.discount_value}% off`
            : `GHS ${appliedCoupon.discount_value} off`;

        let scopeLabel = appliedCoupon.applies_to || '';
        if (scopeLabel === 'rooms') scopeLabel = 'Room Only';
        if (scopeLabel === 'extras') scopeLabel = 'Extras';
        if (scopeLabel === 'both') scopeLabel = 'Room and Extras';

        displayEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#dcfce7;border:1px solid #86efac;border-radius:8px">
            <div style="font-size:0.875rem;color:#166534">
              <strong>${appliedCoupon.code}</strong> - ${discountText} ${scopeLabel}
            </div>
            <button type="button" class="btn btn-sm" id="er-remove-coupon"
                    style="background:#fff;color:#b91c1c;border:1px solid #fecaca;padding:4px 8px;font-size:0.75rem">
              Remove
            </button>
          </div>
        `;
        modal.querySelector('#er-remove-coupon')?.addEventListener('click', () => {
          appliedCoupon = null;
          modal.querySelector('#er-coupon').value = '';
          msgEl.textContent = '';
          displayEl.innerHTML = '';
          updatePriceBreakdown();
        });
        updatePriceBreakdown();
      }
    }

    // ---------- SAVE CHANGES ----------
    modal.querySelector('#er-save')?.addEventListener('click', async () => {
      try {
                const selectedRoomIds = getSelectedRoomIds();

        if (!selectedRoomIds.length) {
          alert('Please select at least one cabin');
          return;
        }

        const primaryRoomId = selectedRoomIds[0];
        const primaryInfo = roomMap[String(primaryRoomId)] || {};
        const roomTypeId = primaryRoomId;
        const roomTypeCode = primaryInfo.code || r.room_type_code || null;
        const roomName = primaryInfo.name || r.room_name || null;

        if (!roomTypeId || !roomTypeCode) {
          alert('Please select at least one cabin');
          return;
        }


        if (!inEl.value || !outEl.value) {
          alert('Please select both check-in and check-out dates.');
          return;
        }

        const checkInDate = new Date(inEl.value);
        const checkOutDate = new Date(outEl.value);

        if (
          Number.isNaN(checkInDate.getTime()) ||
          Number.isNaN(checkOutDate.getTime())
        ) {
          alert('One or both dates are invalid.');
          return;
        }

        if (checkOutDate <= checkInDate) {
          alert('Check-out date must be after check-in date.');
          return;
        }

                // Availability check for each selected cabin
        // First, get all reservation IDs in this group to skip them all
        let idsToSkip = [id];
        if (r.group_reservation_id) {
          // This is part of a group, fetch all IDs in the group
          const { data: groupRes } = await supabase
            .from('reservations')
            .select('id')
            .eq('group_reservation_id', r.group_reservation_id);
          if (groupRes && groupRes.length) {
            idsToSkip = groupRes.map(gr => gr.id);
          }
        }

        for (const roomId of selectedRoomIds) {
          const info = roomMap[String(roomId)] || {};
          const code = info.code || null;

          const available = await isRoomAvailableForEdit(
            roomId,
            code,
            inEl.value,
            outEl.value,
            idsToSkip
          );

          if (!available) {
            alert(
              `${info.name || 'One of the selected cabins'} is NOT available for the selected dates.`
            );
            return;
          }
        }

        const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
        const extrasTotal = selectedExtras.reduce(
          (sum, e) => sum + e.price * e.quantity,
          0
        );


        let discount = 0;
        if (appliedCoupon) {
          const subtotal = roomSubtotal + extrasTotal;

          let extrasTargetTotal = extrasTotal;
          if (
            Array.isArray(appliedCoupon.extra_ids) &&
            appliedCoupon.extra_ids.length
          ) {
            const idSet = new Set(appliedCoupon.extra_ids.map(String));
            extrasTargetTotal = selectedExtras
              .filter((e) => idSet.has(String(e.extra_id)))
              .reduce((sum, e) => sum + e.price * e.quantity, 0);

          }

          if (appliedCoupon.applies_to === 'both') {
            let base;
            if (
              Array.isArray(appliedCoupon.extra_ids) &&
              appliedCoupon.extra_ids.length
            ) {
              base = roomSubtotal + extrasTargetTotal;
            } else {
              base = roomSubtotal + extrasTotal;
            }
            discount =
              appliedCoupon.discount_type === 'percentage'
                ? (base * appliedCoupon.discount_value) / 100
                : appliedCoupon.discount_value;
          } else if (appliedCoupon.applies_to === 'rooms') {
            const base = roomSubtotal;
            discount =
              appliedCoupon.discount_type === 'percentage'
                ? (base * appliedCoupon.discount_value) / 100
                : appliedCoupon.discount_value;
          } else if (appliedCoupon.applies_to === 'extras') {
            const base = extrasTargetTotal;
            discount =
              appliedCoupon.discount_type === 'percentage'
                ? (base * appliedCoupon.discount_value) / 100
                : appliedCoupon.discount_value;
          }

          discount = Math.min(discount, subtotal);
        }

        const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);

                const commonPayload = {
          guest_first_name: modal.querySelector('#er-first')?.value.trim() || null,
          guest_last_name: modal.querySelector('#er-last')?.value.trim() || null,
          guest_email: modal.querySelector('#er-email')?.value.trim() || null,
          country_code: modal.querySelector('#er-country-code')?.value.trim() || null,
          guest_phone: modal.querySelector('#er-phone')?.value.trim() || null,
          is_influencer: !!$('#res-influencer')?.checked,
          check_in: inEl.value || null,
          check_out: outEl.value || null,
          nights: Number(nightsEl.value || 0),
          adults: Number(modal.querySelector('#er-adults')?.value || 0),
          children: Number(modal.querySelector('#er-children')?.value || 0),
          status: modal.querySelector('#er-status')?.value || 'pending',
          payment_status: modal.querySelector('#er-pay')?.value || 'unpaid',
          currency: currencyInput.value.trim() || 'GHS',
          notes: modal.querySelector('#er-notes')?.value || null,
        };

        // Recompute per-room subtotals
        const ci2 = new Date(inEl.value);
        const co2 = new Date(outEl.value);
        let weekdayN2 = 0;
        let weekendN2 = 0;
        for (let d = new Date(ci2); d < co2; d.setDate(d.getDate() + 1)) {
          if (isWeekend(d)) weekendN2++;
          else weekdayN2++;
        }

        const perRoomSubtotals = selectedRoomIds.map((roomId) => {
          const info = roomMap[String(roomId)] || {};
          const wkd = Number(info.base_price_per_night_weekday || 0);
          const wke = Number(info.base_price_per_night_weekend || 0);
          return weekdayN2 * wkd + weekendN2 * wke;
        });

        const primaryRoomSubtotal = perRoomSubtotals[0] || 0;

        const primaryPayload = {
          ...commonPayload,
          room_name: roomName,
          room_type_id: roomTypeId,
          room_type_code: roomTypeCode,
          room_subtotal: primaryRoomSubtotal,
          extras_total: extrasTotal,
          discount_amount: discount,
          coupon_code: appliedCoupon ? appliedCoupon.code : null,
          total: finalTotal,
        };

        // If more than one cabin, treat this as the group "leader"
        // OR if editing a reservation that's already part of a group, preserve those attributes
        if (selectedRoomIds.length > 1) {
          primaryPayload.group_reservation_id = id;
          primaryPayload.group_reservation_code = r.confirmation_code;
        } else if (r.group_reservation_id) {
          // Preserve existing group attributes when editing a group member
          primaryPayload.group_reservation_id = r.group_reservation_id;
          primaryPayload.group_reservation_code = r.group_reservation_code;
        } else {
          primaryPayload.group_reservation_id = null;
          primaryPayload.group_reservation_code = null;
        }

        const { error: upErr } = await supabase
          .from('reservations')
          .update(primaryPayload)
          .eq('id', id);

        if (upErr) {
          alert('Error saving: ' + (upErr.message || upErr));
          return;
        }

        // Replace reservation_extras for PRIMARY reservation only
        await supabase.from('reservation_extras').delete().eq('reservation_id', id);
        if (selectedExtras.length > 0) {
          const extrasPayload = selectedExtras.map((e) => ({
            reservation_id: id,
            extra_id: e.extra_id,
            extra_code: e.extra_code,
            extra_name: e.extra_name,
            price: e.price,
            quantity: e.quantity,
            subtotal: e.price * e.quantity,
          }));
          const { error: exErr } = await supabase
            .from('reservation_extras')
            .insert(extrasPayload);
          if (exErr) {
            console.error('Error saving extras (edit):', exErr);
          }
        }

        // Additional cabins → create extra reservations as a group (no extras/discount)
        const additionalRoomIds = selectedRoomIds.slice(1);

        for (let index = 0; index < additionalRoomIds.length; index++) {
          const roomId = additionalRoomIds[index];
          const info = roomMap[String(roomId)] || {};
          const sub = perRoomSubtotals[index + 1] || 0;
          const childTotal = sub;

          const childPayload = {
            ...commonPayload,
            confirmation_code:
              'G' +
              Math.random().toString(36).slice(2, 8).toUpperCase(),
            room_name: info.name || null,
            room_type_id: roomId,
            room_type_code: info.code || null,
            room_subtotal: sub,
            extras_total: 0,
            discount_amount: 0,
            coupon_code: null,
            total: childTotal,
            group_reservation_id: id,
            group_reservation_code: r.confirmation_code,
          };

          const { error: childErr } = await supabase
            .from('reservations')
            .insert(childPayload);

          if (childErr) {
            console.error('Error creating additional cabin reservation:', childErr);
          }
        }

        toast('Reservation updated');
        close();
        loadReservations();
      } catch (e) {
        alert('Error saving: ' + (e.message || e));
      }
    });
  } catch (e) {
    alert('Error loading reservation: ' + (e.message || e));
  }
}

/* ----------------- Detail modals ----------------- */

// show all bookings for a given calendar day
function showReservationsForDate(year, month, day, bookings) {
  if (!bookings || !bookings.length) return;

  const dateDisplay = new Date(year, month, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const reservationsList = bookings
    .map(
      (res) => `
      <div style="padding:10px 0;border-bottom:1px solid #e5e7eb">
        <div style="font-weight:600">${res.guest_first_name || ''} ${res.guest_last_name || ''}</div>
        <div style="font-size:13px;color:#6b7280">
          ${res.room_name || res.room_type_code || 'Room'} • ${res.confirmation_code || ''}
        </div>
        <div style="font-size:13px;color:#6b7280">
          Check-in: ${res.check_in || ''} • Check-out: ${res.check_out || ''}
        </div>
      </div>
    `
    )
    .join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:60">
      <div style="background:white;padding:24px;border-radius:16px;max-width:640px;width:100%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <h3 style="margin:0 0 10px 0">Reservations for ${dateDisplay}</h3>
        <p style="color:#6b7280;margin:0 0 16px 0">
          ${bookings.length} reservation${bookings.length === 1 ? '' : 's'}
        </p>
        ${reservationsList}
        <button class="btn" style="margin-top:16px;width:100%">Close</button>
      </div>
    </div>
  `;

  const overlay = wrapper.firstElementChild;
  if (!overlay) return;

  overlay.addEventListener('click', () => overlay.remove());
  overlay.querySelector('button.btn')?.addEventListener('click', () =>
    overlay.remove()
  );

  document.body.appendChild(overlay);
}

// Global function used by list & right rail
window.showReservationDetails = function (confirmationCode) {
  const reservation = (allReservations || []).find(
    (r) => r.confirmation_code === confirmationCode
  );
  if (!reservation) return;

  // Compute labels & classes
  const statusLabel = formatStatusLabel(reservation.status);
  const statusClass = getStatusBadgeClass(reservation.status);
  const paymentLabel = formatPaymentStatusLabel(reservation.payment_status);
  const paymentClass = getPaymentBadgeClass(reservation.payment_status);

  const modal = document.createElement('div');
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:60">
      <div style="background:white;padding:24px;border-radius:16px;max-width:560px;width:100%;line-height:1.7" onclick="event.stopPropagation()">
        <h3 style="margin-top:0;margin-bottom:12px">
          ${reservation.guest_first_name || ''} ${reservation.guest_last_name || ''}
        </h3>

        <p><strong>Email:</strong> ${reservation.guest_email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${
          reservation.guest_phone
            ? `${reservation.country_code || ''} ${reservation.guest_phone}`
            : 'N/A'
        }</p>


        <p><strong>Confirmation Code:</strong>
          <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">
            ${reservation.confirmation_code}
          </code>
        </p>

        <p><strong>Room:</strong> ${reservation.room_name || reservation.room_type_code || 'N/A'}</p>
        <p><strong>Check-in:</strong> ${reservation.check_in || 'N/A'}</p>
        <p><strong>Check-out:</strong> ${reservation.check_out || 'N/A'}</p>
        <p><strong>Nights:</strong> ${reservation.nights ?? 1}</p>

        <p><strong>Guests:</strong> ${reservation.adults ?? 1} adults ${
    reservation.children ? `, ${reservation.children} children` : ''
  }</p>
      <p><strong>Influencer?</strong> ${reservation.is_influencer ? 'Yes' : 'No'}</p>
        <!-- FIXED STATUS BADGE -->
        <p><strong>Status:</strong>
          <span class="badge ${statusClass}">
            ${statusLabel}
          </span>
        </p>

        <!-- FIXED PAYMENT BADGE -->
        <p><strong>Payment:</strong>
          <span class="badge ${paymentClass}">
            ${paymentLabel}
          </span>
        </p>

        ${
          reservation.package_code || reservation.package_name
            ? `<p><strong>Package:</strong>
                <span class="badge" style="background:#fbbf24;color:#78350f;font-weight:600">
                  ${reservation.package_name || reservation.package_name}
                </span>
              </p>`
            : ''
        }

        <p><strong>Total:</strong> ${formatCurrency(
          reservation.total || 0,
          reservation.currency || 'GHS'
        )}</p>

        ${reservation.notes ? `<p><strong>Notes:</strong> ${reservation.notes}</p>` : ''}

        <div style="margin-top:16px;display:flex;justify-content:space-between;gap:8px">
          <button class="btn" data-close>Close</button>
          <button class="btn btn-primary" data-edit>Edit Reservation</button>
        </div>
      </div>
    </div>
  `;

  const overlay = modal.firstElementChild;
  if (!overlay) return;

  overlay.addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-close]')?.addEventListener('click', () =>
    overlay.remove()
  );

  overlay.querySelector('[data-edit]')?.addEventListener('click', () => {
    overlay.remove();
    reservationOpenEdit(reservation.id);
  });

  document.body.appendChild(overlay);
};