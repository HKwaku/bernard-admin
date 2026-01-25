// src/reservations.js
// Reservations Management Module (modularised original behaviour)

import { supabase } from './config/supabase.js';
import { $, $$, formatCurrency, formatDate, toast } from './utils/helpers.js';
import { openBookPackageModal } from './package_booking.js';
import { openNewCustomBookingModal } from './custom_booking.js';
import { openBlockDatesModal } from './blocked_bookings.js';


// Base URL of the Sojourn public site (for email API)
const SOJOURN_API_BASE_URL =
  'https://sojourn-cabins.vercel.app';



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
    // --- Load real reservations ---
    const { data: resData, error } = await supabase
      .from('reservations')
      .select(
        'id,confirmation_code,group_reservation_id,group_reservation_code,room_type_id,room_type_code,room_name,check_in,check_out,nights,adults,children,status,payment_status,total,currency,guest_first_name,guest_last_name,guest_email,guest_phone,country_code,notes,package_code,package_name'
      )
      .order('check_in', { ascending: false });

    if (error) throw error;

    // --- Load blocked dates + room info ---
    const { data: blockedDates, error: blockedErr } = await supabase
      .from('blocked_dates')
      .select('id, room_type_id, blocked_date, reason');

    if (blockedErr) throw blockedErr;

    let blockedRows = [];
    if (blockedDates && blockedDates.length) {
      const roomIds = Array.from(
        new Set(
          blockedDates
            .map((b) => b.room_type_id)
            .filter(Boolean)
        )
      );

      let roomTypeMap = {};
      if (roomIds.length) {
        const { data: roomTypes, error: roomErr } = await supabase
          .from('room_types')
          .select('id, code, name')
          .in('id', roomIds);

        if (roomErr) throw roomErr;
        roomTypeMap = Object.fromEntries(
          (roomTypes || []).map((rt) => [String(rt.id), rt])
        );
      }

      blockedRows = blockedDates.map((b) => {
        const rt = roomTypeMap[String(b.room_type_id)] || {};
        const baseName = rt.name || rt.code || 'Cabin';
        const roomNameBlk = `${baseName}-BLK`;

        const blockDateStr = b.blocked_date; // 'YYYY-MM-DD'
        let checkOutStr = blockDateStr;
        if (blockDateStr) {
          const d = new Date(blockDateStr);
          if (!Number.isNaN(d.getTime())) {
            d.setDate(d.getDate() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            checkOutStr = `${y}-${m}-${day}`;
          }
        }

        return {
          id: `blocked-${b.id}`,
          blocked_id: b.id,
          confirmation_code: null,
          group_reservation_id: null,
          group_reservation_code: null,
          room_type_id: b.room_type_id,
          room_type_code: rt.code || null,
          room_name: roomNameBlk,
          check_in: blockDateStr,
          check_out: checkOutStr,
          nights: 1,
          adults: 0,
          children: 0,
          status: 'blocked',
          payment_status: 'unpaid',
          total: 0,
          currency: 'GHS',
          guest_first_name: null,
          guest_last_name: null,
          guest_email: null,
          guest_phone: null,
          country_code: null,
          notes: b.reason || 'Blocked',
          package_code: null,
          package_name: null,
          is_blocked: true,
        };
      });
    }

    // Combine real + blocked
    allReservations = [...(resData || []), ...blockedRows];

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

  // --- Type filter (standard / group / package / blocked) ---
  let typeSelect = $('#res-type');
  if (!typeSelect && yearSelect) {
    typeSelect = document.createElement('select');
    typeSelect.id = 'res-type';
    typeSelect.className = yearSelect.className || '';
    typeSelect.innerHTML = `
      <option value="">All types</option>
      <option value="standard">Standard</option>
      <option value="group">Group</option>
      <option value="package">Package</option>
      <option value="blocked">Blocked</option>
    `;
    yearSelect.insertAdjacentElement('afterend', typeSelect);
  }

  typeSelect?.addEventListener('change', () => renderReservations());


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

  // ---- Booking buttons (desktop + mobile) live in Reservations module ----
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

  // ---- Booking buttons are now created inside Reservations module ----
  // We attach them to the same toolbar row that holds search/month/year/view toggles.
  const toolbar =
    searchInput && searchInput.parentElement instanceof HTMLElement
      ? searchInput.parentElement
      : null;

  if (toolbar && !toolbar.dataset._bookingButtonsInjected) {
    toolbar.dataset._bookingButtonsInjected = '1';

    const btnWrap = document.createElement('div');
    btnWrap.className = 'booking-buttons';
    btnWrap.style.display = 'flex';
    btnWrap.style.flexDirection = 'row';
    btnWrap.style.alignItems = 'center';
    btnWrap.style.justifyContent = 'flex-end';
    btnWrap.style.gap = '8px';
    btnWrap.style.marginLeft = 'auto';
    btnWrap.style.flexWrap = 'nowrap'; // prevent mobile stacking


    const newCustomBtn = document.createElement('button');
    newCustomBtn.id = 'new-custom-booking-btn';
    newCustomBtn.className = 'btn btn-primary';
    newCustomBtn.textContent = '+New Booking';

    const bookPkgBtn = document.createElement('button');
    bookPkgBtn.id = 'book-package-btn';
    bookPkgBtn.className = 'btn btn-primary';
    bookPkgBtn.textContent = '+New Package';
    
    // NEW: Block Dates button
    const blockDatesBtn = document.createElement('button');
    blockDatesBtn.id = 'block-dates-btn';
    blockDatesBtn.className = 'btn btn-primary';
    blockDatesBtn.textContent = '+Block Dates';

    btnWrap.appendChild(newCustomBtn);
    btnWrap.appendChild(bookPkgBtn);
    btnWrap.appendChild(blockDatesBtn);
    toolbar.appendChild(btnWrap);

    newCustomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openNewCustomBookingModal();
    });

    bookPkgBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openBookPackageModal();
    });
     // Wire Block Dates button
    blockDatesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openBlockDatesModal();
    });
  }
}


function filterReservations() {
  const searchTerm = ($('#res-search')?.value || '').toLowerCase();
  const selectedMonth = $('#res-month')?.value ?? '';
  const selectedYear = $('#res-year')?.value ?? '';
  const typeFilter = $('#res-type')?.value || '';

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

        // Type filter: standard / group / package / blocked
    if (typeFilter) {
      const isBlocked = !!r.is_blocked;
      const isGroup = !!r.group_reservation_id;
      const isPackage = !!(r.package_code || r.package_name);
      const isStandard = !isBlocked && !isGroup && !isPackage;

      if (typeFilter === 'blocked' && !isBlocked) return false;
      if (typeFilter === 'group' && !isGroup) return false;
      if (typeFilter === 'package' && !isPackage) return false;
      if (typeFilter === 'standard' && !isStandard) return false;
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
  const s = (status || 'pending_payment').toLowerCase();
  if (s === 'checked-in') return 'Checked In';
  if (s === 'checked-out') return 'Checked Out';
  if (s === 'cancelled') return 'Cancelled';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'pending_payment') return 'Pending Payment';
  // fallback: capitalise and replace hyphens
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

function getStatusBadgeClass(status) {
  const s = (status || 'pending_payment').toLowerCase();
  if (s === 'confirmed') return 'ok';
  if (s === 'cancelled') return 'err';
  if (s === 'checked-in') return 'checked-in';
  if (s === 'checked-out') return 'checked-out';
  if (s === 'pending_payment') return 'Pending Payment';
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
  return 'unpaid';
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
    // Blocked rows: grey card with edit/delete buttons
    if (r.is_blocked) {
      return `
        <div class="item" style="border-left:4px solid #9ca3af;background:linear-gradient(to right,#f3f4f6,white);color:#6b7280;">
          <div class="row" style="align-items:flex-start;gap:12px">
            <div style="flex:1">
              <div class="title" style="color:#6b7280;">
                ${r.room_name || r.room_type_code || 'Cabin'}
              </div>
              <div class="meta">Blocked: ${formatDate(r.check_in) || ''}</div>
              ${
                r.notes
                  ? `<div class="meta">Reason: ${r.notes}</div>`
                  : ''
              }
            </div>
            <div style="text-align:right">
              <span class="badge" style="background:#e5e7eb;color:#374151;font-weight:600">
                Blocked
              </span>
            </div>
          </div>
          <div class="room-card-footer">
            <button class="btn btn-sm" onclick="editBlockedDate('${r.blocked_id}', '${r.room_type_id}', '${r.check_in}', '${r.notes || ''}'); event.stopPropagation();">Edit</button>
            <button class="btn btn-sm" onclick="deleteBlockedDate('${r.blocked_id}'); event.stopPropagation();" style="color:#b91c1c">Delete</button>
          </div>
        </div>
      `;
    }

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
            <div class="meta">Check-in: ${formatDate(r.check_in) || ''} • Check-out: ${formatDate(r.check_out) || ''}</div>
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
              <div class="meta"><strong>${totalRooms} Cabins</strong> • ${formatDate(primaryRes.check_in) || ''} to ${formatDate(primaryRes.check_out) || ''}</div>
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

    for (let d = new Date(checkIn); d < checkOut; d.setDate(d.getDate() + 1)) {
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

      <div class="calendar-day-chips">
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

              const isBlocked = !!b.is_blocked;
              const isGroup = !!b.group_reservation_id;

              let chipClass = isCheckoutDay
                ? 'calendar-chip checkout-day'
                : 'calendar-chip';
              if (isBlocked) chipClass += ' blocked-chip';

              let labelText = b.room_type_code || b.room_name || '';
              if (isBlocked) {
                // Ensure the label ends with -BLK
                if (!/-BLK$/i.test(labelText)) {
                  labelText = `${labelText}-BLK`;
                }
              }

              return `
                <div class="${chipClass}" style="${isBlocked ? 'color:#6b7280;' : ''}">
                  ${labelText}${isGroup ? ' G' : ''}
                  ${
                    !isBlocked && (b.package_code || b.package_name)
                      ? '<span class="pkg-badge">PK</span>'
                      : ''
                  }
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

        // Use half-open intervals [check_in, check_out) - standard hospitality practice
    // Overlap if: existing_start < new_end AND existing_end > new_start
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
      return existingStart < newEnd && existingEnd > newStart;
    });

    if (hasOverlap) {
      // clash with another reservation
      return false;
    }

    // --- ALSO TREAT BLOCKED DATES AS UNAVAILABLE WHEN EDITING ---
    try {
      if (roomTypeId != null) {
        const { data: blocked, error: blockedError } = await supabase
          .from('blocked_dates')
          .select('id, room_type_id, blocked_date')
          .eq('room_type_id', roomTypeId)
          .gte('blocked_date', checkInISO)
          .lt('blocked_date', checkOutISO); // [in, out)

        if (blockedError) {
          console.error('Blocked dates check error (edit):', blockedError);
        } else if (blocked && blocked.length > 0) {
          return false;
        }
      }
    } catch (blkErr) {
      console.error('Blocked dates check exception (edit):', blkErr);
    }

    return true;
  } catch (err) {
    console.error('Availability check exception (edit):', err);
    return false;
  }
}

// ===== COUNTRY OPTIONS =====

const COUNTRY_OPTIONS = [
  // AFRICA
  { region: "Africa", code: "+213", label: "🇩🇿 Algeria (+213)" },
  { region: "Africa", code: "+244", label: "🇦🇴 Angola (+244)" },
  { region: "Africa", code: "+229", label: "🇧🇯 Benin (+229)" },
  { region: "Africa", code: "+267", label: "🇧🇼 Botswana (+267)" },
  { region: "Africa", code: "+226", label: "🇧🇫 Burkina Faso (+226)" },
  { region: "Africa", code: "+257", label: "🇧🇮 Burundi (+257)" },
  { region: "Africa", code: "+237", label: "🇨🇲 Cameroon (+237)" },
  { region: "Africa", code: "+238", label: "🇨🇻 Cape Verde (+238)" },
  { region: "Africa", code: "+236", label: "🇨🇫 Central African Republic (+236)" },
  { region: "Africa", code: "+235", label: "🇹🇩 Chad (+235)" },
  { region: "Africa", code: "+269", label: "🇰🇲 Comoros (+269)" },
  { region: "Africa", code: "+242", label: "🇨🇬 Congo (+242)" },
  { region: "Africa", code: "+243", label: "🇨🇩 Congo (DRC) (+243)" },
  { region: "Africa", code: "+225", label: "🇨🇮 Côte d'Ivoire (+225)" },
  { region: "Africa", code: "+253", label: "🇩🇯 Djibouti (+253)" },
  { region: "Africa", code: "+20",  label: "🇪🇬 Egypt (+20)" },
  { region: "Africa", code: "+240", label: "🇬🇶 Equatorial Guinea (+240)" },
  { region: "Africa", code: "+291", label: "🇪🇷 Eritrea (+291)" },
  { region: "Africa", code: "+251", label: "🇪🇹 Ethiopia (+251)" },
  { region: "Africa", code: "+241", label: "🇬🇦 Gabon (+241)" },
  { region: "Africa", code: "+220", label: "🇬🇲 Gambia (+220)" },
  { region: "Africa", code: "+233", label: "🇬🇭 Ghana (+233)" },
  { region: "Africa", code: "+224", label: "🇬🇳 Guinea (+224)" },
  { region: "Africa", code: "+245", label: "🇬🇼 Guinea-Bissau (+245)" },
  { region: "Africa", code: "+254", label: "🇰🇪 Kenya (+254)" },
  { region: "Africa", code: "+266", label: "🇱🇸 Lesotho (+266)" },
  { region: "Africa", code: "+231", label: "🇱🇷 Liberia (+231)" },
  { region: "Africa", code: "+218", label: "🇱🇾 Libya (+218)" },
  { region: "Africa", code: "+261", label: "🇲🇬 Madagascar (+261)" },
  { region: "Africa", code: "+265", label: "🇲🇼 Malawi (+265)" },
  { region: "Africa", code: "+223", label: "🇲🇱 Mali (+223)" },
  { region: "Africa", code: "+222", label: "🇲🇷 Mauritania (+222)" },
  { region: "Africa", code: "+230", label: "🇲🇺 Mauritius (+230)" },
  { region: "Africa", code: "+212", label: "🇲🇦 Morocco (+212)" },
  { region: "Africa", code: "+258", label: "🇲🇿 Mozambique (+258)" },
  { region: "Africa", code: "+264", label: "🇳🇦 Namibia (+264)" },
  { region: "Africa", code: "+227", label: "🇳🇪 Niger (+227)" },
  { region: "Africa", code: "+234", label: "🇳🇬 Nigeria (+234)" },
  { region: "Africa", code: "+250", label: "🇷🇼 Rwanda (+250)" },
  { region: "Africa", code: "+239", label: "🇸🇹 Sao Tome & Principe (+239)" },
  { region: "Africa", code: "+221", label: "🇸🇳 Senegal (+221)" },
  { region: "Africa", code: "+248", label: "🇸🇨 Seychelles (+248)" },
  { region: "Africa", code: "+232", label: "🇸🇱 Sierra Leone (+232)" },
  { region: "Africa", code: "+252", label: "🇸🇴 Somalia (+252)" },
  { region: "Africa", code: "+27",  label: "🇿🇦 South Africa (+27)" },
  { region: "Africa", code: "+211", label: "🇸🇸 South Sudan (+211)" },
  { region: "Africa", code: "+249", label: "🇸🇩 Sudan (+249)" },
  { region: "Africa", code: "+268", label: "🇸🇿 Eswatini (+268)" },
  { region: "Africa", code: "+255", label: "🇹🇿 Tanzania (+255)" },
  { region: "Africa", code: "+216", label: "🇹🇳 Tunisia (+216)" },
  { region: "Africa", code: "+256", label: "🇺🇬 Uganda (+256)" },
  { region: "Africa", code: "+260", label: "🇿🇲 Zambia (+260)" },
  { region: "Africa", code: "+263", label: "🇿🇼 Zimbabwe (+263)" },

  // EUROPE
  { region: "Europe", code: "+355", label: "🇦🇱 Albania (+355)" },
  { region: "Europe", code: "+43",  label: "🇦🇹 Austria (+43)" },
  { region: "Europe", code: "+32",  label: "🇧🇪 Belgium (+32)" },
  { region: "Europe", code: "+359", label: "🇧🇬 Bulgaria (+359)" },
  { region: "Europe", code: "+385", label: "🇭🇷 Croatia (+385)" },
  { region: "Europe", code: "+357", label: "🇨🇾 Cyprus (+357)" },
  { region: "Europe", code: "+420", label: "🇨🇿 Czechia (+420)" },
  { region: "Europe", code: "+45",  label: "🇩🇰 Denmark (+45)" },
  { region: "Europe", code: "+372", label: "🇪🇪 Estonia (+372)" },
  { region: "Europe", code: "+358", label: "🇫🇮 Finland (+358)" },
  { region: "Europe", code: "+33",  label: "🇫🇷 France (+33)" },
  { region: "Europe", code: "+49",  label: "🇩🇪 Germany (+49)" },
  { region: "Europe", code: "+30",  label: "🇬🇷 Greece (+30)" },
  { region: "Europe", code: "+36",  label: "🇭🇺 Hungary (+36)" },
  { region: "Europe", code: "+354", label: "🇮🇸 Iceland (+354)" },
  { region: "Europe", code: "+353", label: "🇮🇪 Ireland (+353)" },
  { region: "Europe", code: "+39",  label: "🇮🇹 Italy (+39)" },
  { region: "Europe", code: "+371", label: "🇱🇻 Latvia (+371)" },
  { region: "Europe", code: "+370", label: "🇱🇹 Lithuania (+370)" },
  { region: "Europe", code: "+352", label: "🇱🇺 Luxembourg (+352)" },
  { region: "Europe", code: "+356", label: "🇲🇹 Malta (+356)" },
  { region: "Europe", code: "+373", label: "🇲🇩 Moldova (+373)" },
  { region: "Europe", code: "+377", label: "🇲🇨 Monaco (+377)" },
  { region: "Europe", code: "+382", label: "🇲🇪 Montenegro (+382)" },
  { region: "Europe", code: "+31",  label: "🇳🇱 Netherlands (+31)" },
  { region: "Europe", code: "+47",  label: "🇳🇴 Norway (+47)" },
  { region: "Europe", code: "+48",  label: "🇵🇱 Poland (+48)" },
  { region: "Europe", code: "+351", label: "🇵🇹 Portugal (+351)" },
  { region: "Europe", code: "+40",  label: "🇷🇴 Romania (+40)" },
  { region: "Europe", code: "+7",   label: "🇷🇺 Russia (+7)" },
  { region: "Europe", code: "+381", label: "🇷🇸 Serbia (+381)" },
  { region: "Europe", code: "+421", label: "🇸🇰 Slovakia (+421)" },
  { region: "Europe", code: "+386", label: "🇸🇮 Slovenia (+386)" },
  { region: "Europe", code: "+34",  label: "🇪🇸 Spain (+34)" },
  { region: "Europe", code: "+46",  label: "🇸🇪 Sweden (+46)" },
  { region: "Europe", code: "+41",  label: "🇨🇭 Switzerland (+41)" },
  { region: "Europe", code: "+44",  label: "🇬🇧 United Kingdom (+44)" },
  { region: "Europe", code: "+380", label: "🇺🇦 Ukraine (+380)" },

  // AMERICAS
  { region: "Americas", code: "+1",   label: "🇺🇸 United States (+1)" },
  { region: "Americas", code: "+1",   label: "🇨🇦 Canada (+1)" },
  { region: "Americas", code: "+52",  label: "🇲🇽 Mexico (+52)" },
  { region: "Americas", code: "+55",  label: "🇧🇷 Brazil (+55)" },
  { region: "Americas", code: "+54",  label: "🇦🇷 Argentina (+54)" },
  { region: "Americas", code: "+57",  label: "🇨🇴 Colombia (+57)" },
  { region: "Americas", code: "+56",  label: "🇨🇱 Chile (+56)" },
  { region: "Americas", code: "+51",  label: "🇵🇪 Peru (+51)" },
  { region: "Americas", code: "+58",  label: "🇻🇪 Venezuela (+58)" },

  // ASIA
  { region: "Asia", code: "+93",  label: "🇦🇫 Afghanistan (+93)" },
  { region: "Asia", code: "+374", label: "🇦🇲 Armenia (+374)" },
  { region: "Asia", code: "+994", label: "🇦🇿 Azerbaijan (+994)" },
  { region: "Asia", code: "+880", label: "🇧🇩 Bangladesh (+880)" },
  { region: "Asia", code: "+975", label: "🇧🇹 Bhutan (+975)" },
  { region: "Asia", code: "+673", label: "🇧🇳 Brunei (+673)" },
  { region: "Asia", code: "+855", label: "🇰🇭 Cambodia (+855)" },
  { region: "Asia", code: "+86",  label: "🇨🇳 China (+86)" },
  { region: "Asia", code: "+91",  label: "🇮🇳 India (+91)" },
  { region: "Asia", code: "+62",  label: "🇮🇩 Indonesia (+62)" },
  { region: "Asia", code: "+98",  label: "🇮🇷 Iran (+98)" },
  { region: "Asia", code: "+964", label: "🇮🇶 Iraq (+964)" },
  { region: "Asia", code: "+972", label: "🇮🇱 Israel (+972)" },
  { region: "Asia", code: "+81",  label: "🇯🇵 Japan (+81)" },
  { region: "Asia", code: "+962", label: "🇯🇴 Jordan (+962)" },
  { region: "Asia", code: "+7",   label: "🇰🇿 Kazakhstan (+7)" },
  { region: "Asia", code: "+965", label: "🇰🇼 Kuwait (+965)" },
  { region: "Asia", code: "+996", label: "🇰🇬 Kyrgyzstan (+996)" },
  { region: "Asia", code: "+856", label: "🇱🇦 Laos (+856)" },
  { region: "Asia", code: "+961", label: "🇱🇧 Lebanon (+961)" },
  { region: "Asia", code: "+60",  label: "🇲🇾 Malaysia (+60)" },
  { region: "Asia", code: "+960", label: "🇲🇻 Maldives (+960)" },
  { region: "Asia", code: "+976", label: "🇲🇳 Mongolia (+976)" },
  { region: "Asia", code: "+977", label: "🇳🇵 Nepal (+977)" },
  { region: "Asia", code: "+92",  label: "🇵🇰 Pakistan (+92)" },
  { region: "Asia", code: "+63",  label: "🇵🇭 Philippines (+63)" },
  { region: "Asia", code: "+65",  label: "🇸🇬 Singapore (+65)" },
  { region: "Asia", code: "+94",  label: "🇱🇰 Sri Lanka (+94)" },
  { region: "Asia", code: "+82",  label: "🇰🇷 South Korea (+82)" },
  { region: "Asia", code: "+886", label: "🇹🇼 Taiwan (+886)" },
  { region: "Asia", code: "+66",  label: "🇹🇭 Thailand (+66)" },
  { region: "Asia", code: "+90",  label: "🇹🇷 Turkey (+90)" },
  { region: "Asia", code: "+971", label: "🇦🇪 United Arab Emirates (+971)" },
  { region: "Asia", code: "+998", label: "🇺🇿 Uzbekistan (+998)" },
  { region: "Asia", code: "+84",  label: "🇻🇳 Vietnam (+84)" },

  // OCEANIA
  { region: "Oceania", code: "+61", label: "🇦🇺 Australia (+61)" },
  { region: "Oceania", code: "+64", label: "🇳🇿 New Zealand (+64)" },
  { region: "Oceania", code: "+679", label: "🇫🇯 Fiji (+679)" },
  { region: "Oceania", code: "+685", label: "🇼🇸 Samoa (+685)" },
  { region: "Oceania", code: "+676", label: "🇹🇴 Tonga (+676)" }
];

// Build searchable country dropdown
function buildCountrySelectHtml(selectId, currentValue = "+233") {
  const regions = ["Africa", "Europe", "Asia", "Americas", "Oceania"];

  const groupedHtml = regions
    .map(region => {
      const items = COUNTRY_OPTIONS.filter(c => c.region === region);
      if (!items.length) return "";

      const optionsHtml = items
        .map(c => `<option value="${c.code}" ${c.code === currentValue ? "selected" : ""}>
            ${c.label}
          </option>`)
        .join("");

      return `
        <optgroup label="${region}">
          ${optionsHtml}
        </optgroup>
      `;
    })
    .join("");

  return `
    <div class="country-select-box" style="display:flex;flex-direction:column;gap:6px;min-width:0;flex-shrink:0;">
      <input type="text" id="${selectId}-search" placeholder="Search country..." 
        style="padding:6px;border:1px solid #ccc;border-radius:6px;font-size:14px"/>
      <select id="${selectId}" style="padding:6px;border:1px solid #ccc;border-radius:6px;">
        ${groupedHtml}
      </select>
    </div>
  `;
}

// Enable search behaviour
function attachCountrySearch(selectId) {
  const searchEl = document.getElementById(`${selectId}-search`);
  const selectEl = document.getElementById(selectId);
  if (!searchEl || !selectEl) return;

  searchEl.addEventListener("input", () => {
    const q = searchEl.value.toLowerCase();

    [...selectEl.options].forEach(opt => {
      opt.style.display = opt.textContent.toLowerCase().includes(q) ? "block" : "none";
    });
  });
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function addDaysISO(iso, nights) {
  const d = new Date(iso);
  d.setDate(d.getDate() + (Number(nights) || 0));
  return toDateInput(d);
}

function diffNights(checkInISO, checkOutISO) {
  const ci = new Date(checkInISO);
  const co = new Date(checkOutISO);
  if (Number.isNaN(ci.getTime()) || Number.isNaN(co.getTime()) || co <= ci) return 0;
  return Math.round((co - ci) / (1000 * 60 * 60 * 24));
}


async function openEditModal(id) {
  try {
    // === LOAD EXISTING RESERVATION ===
    const { data: r, error: loadError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (loadError) throw loadError;
    if (!r) {
      alert('Reservation not found');
      return;
    }

    // Detect if this is a group booking
    const isGroupBooking = !!r.group_reservation_id;
    let allGroupReservations = [r];
    let primaryReservation = r;
    
    if (isGroupBooking) {
      // Load ALL reservations in this group
      const { data: groupReservations, error: groupError } = await supabase
        .from('reservations')
        .select('*')
        .eq('group_reservation_id', r.group_reservation_id)
        .order('id', { ascending: true });
      
      if (groupError) throw groupError;
      
      if (groupReservations && groupReservations.length > 0) {
        allGroupReservations = groupReservations;
        // Primary is the first one (they share dates, guest info, etc.)
        primaryReservation = groupReservations[0];
        
        console.log('📋 Editing group booking with', allGroupReservations.length, 'reservations');
        console.log('Group code:', r.group_reservation_code);
      }
    }

    // Store original values for smart availability check (from all rooms)
    const ORIGINAL_ROOM_IDS = allGroupReservations.map(res => res.room_type_id);
    const ORIGINAL_CHECK_IN = primaryReservation.check_in;
    const ORIGINAL_CHECK_OUT = primaryReservation.check_out;
    
    // Detect if this is a package booking
    const isPackage = !!(primaryReservation.package_code || primaryReservation.package_name);
    
    console.log('Editing reservation:', id);
    console.log('Is Group Booking:', isGroupBooking);
    console.log('Is Package:', isPackage);
    console.log('Original rooms:', ORIGINAL_ROOM_IDS);
    console.log('Original dates:', { ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT });

    // Load existing reservation extras (from primary reservation)
    const { data: resExtras } = await supabase
      .from('reservation_extras')
      .select('*')
      .eq('reservation_id', primaryReservation.id);


  // Ensure we never stack multiple modals
  const old = document.getElementById('edit-reservation-modal');
  if (old) old.remove();

  const wrap = document.createElement('div');
  // Reuse reservation modal styling so you don't need new CSS
  wrap.id = 'edit-reservation-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);
  
  // Add calendar CSS if not already present
  if (!document.getElementById('edit-calendar-styles')) {
    const style = document.createElement('style');
    style.id = 'edit-calendar-styles';
    style.textContent = `
      .date-picker-wrapper {
        position: relative;
        width: 100%;
      }
      .date-picker-input {
        width: 100%;
        padding: 12px 14px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        background: white;
      }
      .date-picker-input:focus {
        outline: none;
        border-color: #f97316;
        box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
      }
      .date-picker-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        z-index: 999999 !important;
        display: none;
        padding: 16px;
      }
      .date-picker-dropdown.active {
        display: block;
        z-index: 9999999 !important;
      }
      .date-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .date-picker-nav {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 4px 8px;
        color: #374151;
      }
      .date-picker-nav:hover {
        color: #f97316;
      }
      .date-picker-month {
        font-weight: 600;
        font-size: 14px;
        color: #111827;
      }
      .date-picker-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        margin-bottom: 8px;
      }
      .date-picker-weekday {
        text-align: center;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        padding: 4px;
      }
      .date-picker-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }
      .date-picker-day {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        border-radius: 8px;
        cursor: pointer;
        border: none;
        background: white;
        color: #111827;
        position: relative;
        overflow: hidden;
        min-width: 0;
      }
      .date-number {
        font-size: 16px;
        font-weight: 600;
        line-height: 1;
      }
      .date-price {
        font-size: 9px;
        font-weight: 500;
        color: #6b7280;
        text-align: center;
        line-height: 1.05;
        margin-top: 4px;
        white-space: normal;
        max-width: 100%;
      }
      .date-picker-day.disabled .date-price,
      .date-picker-day.empty .date-price {
        display: none;
      }
      .date-picker-day:hover:not(.disabled):not(.empty) {
        background: #f3f4f6;
      }
      .date-picker-day:hover:not(.disabled):not(.empty) .date-price {
        color: #374151;
      }
      .date-picker-day.selected {
        background: #f97316;
        color: white;
      }
      .date-picker-day.selected .date-price {
        color: white;
        opacity: 0.9;
      }
      .date-picker-day.in-range {
        background: rgba(249, 115, 22, 0.1);
      }
      .date-picker-day.disabled {
        color: #d1d5db;
        cursor: not-allowed;
        text-decoration: line-through;
        opacity: 0.5;
      }
      .date-picker-day.empty {
        cursor: default;
        visibility: hidden;
      }
      .date-picker-day.today {
        border: 2px solid #f97316;
      }
    `;
    document.head.appendChild(style);
  }
  
  // clicking the backdrop closes the modal
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });


  // Fetch room types for dropdown
  const { data: rooms } = await supabase
    .from('room_types')
    .select('id,code,name,base_price_per_night_weekday,base_price_per_night_weekend,currency,max_adults')
    .eq('is_active', true)
    .order('name', { ascending: true });
    
  // Fetch extras for selection
  const { data: extras } = await supabase
    .from('extras')
    .select('id,code,name,price,category')
    .eq('is_active', true)
    .order('category,name');
  const extraNameMap = Object.fromEntries(
    (extras || []).map(e => [String(e.id), e.name])
  );

    // Fetch packages for picker
  const { data: packages } = await supabase
    .from('packages')
    .select('id, code, name, nights, valid_from, valid_until, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const pkgList = packages || [];
  const pkgIds = pkgList.map(p => p.id);

  // Load rooms linked to packages (packages_rooms)
  const { data: pkgRoomsRows } = await supabase
    .from('packages_rooms')
    .select('package_id, room_type_id')
    .in('package_id', pkgIds.length ? pkgIds : [-1]);

  const pkgRooms = pkgRoomsRows || [];

  // Map: packageId -> [room_type_id...]
  const roomIdsByPackage = {};
  pkgRooms.forEach(pr => {
    const k = String(pr.package_id);
    if (!roomIdsByPackage[k]) roomIdsByPackage[k] = [];
    if (pr.room_type_id != null) roomIdsByPackage[k].push(pr.room_type_id);
  });

  // Preselect package from reservation if it has one (match by code first, then name)
  let selectedPackageId = null;
  if (r.package_code || r.package_name) {
    const match =
      pkgList.find(p => p.code && r.package_code && String(p.code) === String(r.package_code)) ||
      pkgList.find(p => p.name && r.package_name && String(p.name) === String(r.package_name));
    if (match) selectedPackageId = match.id;
  }

  const packageOptionsHtml =
    `<option value="">No package</option>` +
    pkgList.map(p => `
      <option value="${p.id}" ${String(p.id) === String(selectedPackageId) ? 'selected' : ''}>
        ${(p.code || '').toUpperCase()} — ${p.name || ''}
      </option>
    `).join('');


  const roomOptions = (rooms || []).map(r =>
    `<option value="${r.id}" data-code="${r.code}" data-name="${r.name}">
     ${r.name} (${r.code})
   </option>`
  ).join('');

  // Generate extras HTML - for packages, show as read-only with quantities
  const extrasHtml = isPackage 
    ? (resExtras || [])
        .map(e => `
          <div class="extra-row" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
            <div>
              <div style="font-weight:700">${e.extra_name || 'Extra'}</div>
              <div style="color:#64748b;font-size:0.85rem">GHS ${formatCurrency(e.price || 0, 'GHS')}</div>
            </div>
            <div style="font-weight:600;color:#0f172a">
              Qty: ${e.quantity || 1}
            </div>
          </div>
        `).join('') || '<div class="muted">No extras included</div>'
    : (extras || [])
        .map(
          (e) => `
          <div class="extra-row" data-extra-id="${e.id}" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;padding:8px;border:1px solid var(--ring);border-radius:10px;">
            <div>
              <div style="font-weight:700">${e.name}</div>
              <div style="color:#64748b;font-size:0.85rem">GHS ${e.price}</div>
            </div>

            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn btn-sm extra-dec" data-id="${e.id}">−</button>
              <span class="extra-qty" id="extra-qty-${e.id}">0</span>
              <button class="btn btn-sm extra-inc" data-id="${e.id}">+</button>
            </div>
          </div>
        `
        )
        .join('');

  const countryOptionsHtml = COUNTRY_OPTIONS
    .map(c => `<option value="${c.code}" ${c.code === '+233' ? 'selected' : ''}>${c.label}</option>`)
    .join('');

  const today = toDateInput(new Date());

  // Track state
  let selectedExtras = [];
  let perRoomSubtotals = []; // Track individual room prices (for breakdown display)

  // Load existing coupon if one was applied
  let appliedCoupon = null;
  if (r.coupon_code) {
    // Fetch the coupon details
    const { data: couponData } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', r.coupon_code)
      .single();
    
    if (couponData) {
      appliedCoupon = couponData;
      console.log('Loaded existing coupon:', appliedCoupon);
    }
  }

  // Pre-calculate date values for use in HTML
  const initialCheckInISO = r.check_in ? toDateInput(new Date(r.check_in)) : toDateInput(new Date());
  const initialCheckOutISO = r.check_out ? toDateInput(new Date(r.check_out)) : addDaysISO(initialCheckInISO, 1);

  // Calculate combined adults for group bookings
  const combinedAdults = isGroupBooking
    ? allGroupReservations.reduce((sum, res) => sum + (res.adults || 0), 0)
    : (primaryReservation.adults || 2);

  wrap.innerHTML = `
    <div style="max-width:750px;width:100%;background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;" onclick="event.stopPropagation()">
      <div style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h3 style="margin:0;color:white;font-size:20px;font-weight:700">
          ${isGroupBooking ? `Edit Group Booking - ${primaryReservation.group_reservation_code || ''}` : `Edit Reservation - ${primaryReservation.confirmation_code || ''}`}
        </h3>
      </div>

      <div style="padding:24px;overflow-y:auto;flex:1;">
        <!-- STEP 1: Search Criteria (like BookingWidget) -->
        <div style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;margin:0 0 20px 0;display:flex;align-items:center;gap:12px;">
          <svg style="width:20px;height:20px;color:#f59e0b;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span style="color:#92400e;font-size:14px;font-weight:500;">Select guests and dates to see available cabins.</span>
        </div>

        <div class="form-grid" style="display:flex;flex-direction:column;gap:14px">
          <div class="form-group">
            <label>Package</label>
            <select id="er-package">
              ${packageOptionsHtml}
            </select>
            <div id="er-package-current" style="margin-top:6px;font-size:12px;color:#64748b;">
              ${selectedPackageId ? 'This reservation is linked to a package.' : ''}
            </div>
          </div>

          <div class="form-group">
            <label>Adults</label>
            <select id="er-adults">
              <option value="1" ${combinedAdults === 1 ? 'selected' : ''}>1 adult</option>
              <option value="2" ${combinedAdults === 2 || !combinedAdults ? 'selected' : ''}>2 adults</option>
              <option value="3" ${combinedAdults === 3 ? 'selected' : ''}>3 adults</option>
              <option value="4" ${combinedAdults === 4 ? 'selected' : ''}>4 adults</option>
              <option value="5" ${combinedAdults === 5 ? 'selected' : ''}>5 adults</option>
              <option value="6" ${combinedAdults === 6 ? 'selected' : ''}>6 adults</option>
            </select>
          </div>
          <div class="form-group">
            <label>Check-in</label>
            <div class="date-picker-wrapper">
              <input id="er-in" type="text" readonly class="date-picker-input" placeholder="Select date" value="${formatDisplayDateCustom(initialCheckInISO)}" />
              <div id="er-in-picker" class="date-picker-dropdown"></div>
            </div>
          </div>
          <div class="form-group">
            <label>Check-out</label>
            <div class="date-picker-wrapper">
              <input id="er-out" type="text" readonly class="date-picker-input" placeholder="Select date" value="${formatDisplayDateCustom(initialCheckOutISO)}" />
              <div id="er-out-picker" class="date-picker-dropdown"></div>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <span style="background:#f3f4f6;padding:6px 12px;border-radius:8px;font-size:13px">
              Nights: <strong id="er-nights-display">1</strong>
            </span>
          </div>
          <button id="search-availability-btn" class="btn" style="background:#667eea;color:white">
            Search Available Cabins
          </button>
        </div>

        <!-- Current Booking Section (show existing room(s)) -->
        <div id="current-booking-section" style="margin-bottom:20px;padding:16px;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:12px">
          <h4 style="margin:0 0 12px 0;color:#1e293b;font-size:16px">
            Current Booking${isGroupBooking ? ` (${allGroupReservations.length} Room${allGroupReservations.length > 1 ? 's' : ''})` : ''}
          </h4>
          <div style="padding:12px;background:white;border-radius:8px">
            ${isGroupBooking ? 
              // Show all rooms in group
              `${allGroupReservations.map((res, index) => `
                <div style="${index > 0 ? 'border-top:1px solid #e5e7eb;margin-top:12px;padding-top:12px;' : ''}">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div>
                      <div style="font-weight:600;color:#0f172a">${res.room_name || res.room_type_code || 'Room'}</div>
                      <div style="font-size:13px;color:#64748b;margin-top:4px">
                        ${res.adults || 2} adults • ${res.nights || 1} night${(res.nights || 1) > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:12px;color:#64748b">Room ${index + 1}</div>
                      <div style="font-weight:600;color:#0f172a">${formatCurrency(res.room_subtotal || 0, 'GHS')}</div>
                    </div>
                  </div>
                </div>
              `).join('')}`
            : 
              // Show single room
              `<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px">
                <div>
                  <div style="font-weight:600;color:#0f172a">${primaryReservation.room_name || primaryReservation.room_type_code || 'Room'}</div>
                  <div style="font-size:13px;color:#64748b;margin-top:4px">
                    ${primaryReservation.adults || 2} adults • ${primaryReservation.nights || 1} night${(primaryReservation.nights || 1) > 1 ? 's' : ''}
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:14px;color:#64748b">Room Subtotal</div>
                  <div style="font-weight:600;color:#0f172a;font-size:16px">${formatCurrency(primaryReservation.room_subtotal || 0, 'GHS')}</div>
                </div>
              </div>`
            }
            ${primaryReservation.extras_total && parseFloat(primaryReservation.extras_total) > 0 ? `
            <div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:14px">
              <span style="color:#64748b">Extras</span>
              <span style="font-weight:600">${formatCurrency(primaryReservation.extras_total, 'GHS')}</span>
            </div>
            ` : ''}
            ${primaryReservation.discount_amount && parseFloat(primaryReservation.discount_amount) > 0 ? `
            <div id="current-booking-discount-row" style="border-top:1px solid #e5e7eb;padding-top:10px">
              <div style="display:flex;justify-content:space-between;align-items:start;font-size:14px;margin-bottom:4px">
                <div style="flex:1">
                  <div style="color:#16a34a;font-weight:600;margin-bottom:2px">
                    Discount${primaryReservation.coupon_code ? ` (${primaryReservation.coupon_code})` : ''}
                    <button id="remove-discount-btn" style="margin-left:8px;padding:2px 8px;background:#dc2626;color:white;border:none;border-radius:4px;font-size:11px;cursor:pointer">Remove</button>
                  </div>
                  ${appliedCoupon && appliedCoupon.description ? `
                  <div style="font-size:12px;color:#059669;font-style:italic">${appliedCoupon.description}</div>
                  ` : ''}
                </div>
                <span style="font-weight:600;color:#16a34a;white-space:nowrap;margin-left:8px">−${formatCurrency(primaryReservation.discount_amount, 'GHS')}</span>
              </div>
            </div>
            ` : ''}
            <div style="border-top:2px solid #e5e7eb;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between">
              <span style="font-weight:700">Total</span>
              <span style="font-weight:700;color:#3b82f6;font-size:16px">${formatCurrency(
                isGroupBooking 
                  ? allGroupReservations.reduce((sum, res) => sum + parseFloat(res.total || 0), 0)
                  : (primaryReservation.total || 0), 
                'GHS'
              )}</span>
            </div>
          </div>
          <div style="margin-top:12px;padding:12px;background:#fef3c7;border:1px solid #fde047;border-radius:8px">
            <p style="margin:0;font-size:13px;color:#78350f">
              💡 <strong>Edit Mode:</strong> ${isGroupBooking ? 'These are your current rooms.' : 'This is your current room.'} To change ${isGroupBooking ? 'them' : 'it'}, select different dates/adults above and click "Search Available Cabins".
            </p>
          </div>
        </div>

        <!-- Available Cabins Section (hidden until search) -->
        <div id="available-cabins-section" style="display:none;margin-bottom:20px">
          <h4 style="margin:0 0 12px 0;color:#1e293b;font-size:16px">Available Cabins</h4>
          <div id="er-rooms-list" style="border:1px solid var(--ring);border-radius:var(--radius-md);padding:10px;max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
            <!-- Will be populated dynamically -->
          </div>
          <div id="er-no-rooms-message" style="display:none;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;margin-top:12px">
            No cabins available for the selected dates and number of guests.
          </div>
        </div>

        <!-- STEP 2: Guest Information (only show after rooms selected) -->
        <div id="guest-info-section" style="display:none">
          <h4 style="margin:20px 0 12px 0;color:#1e293b;font-size:16px;border-top:2px solid #e2e8f0;padding-top:20px">Guest Information</h4>
          
          <div class="form-grid">
            <div class="form-group">
              <label>First Name</label>
              <input id="er-first" type="text" placeholder="John" value="${r.guest_first_name || ''}" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input id="er-last" type="text" placeholder="Doe" value="${r.guest_last_name || ''}" />
            </div>
          </div>

          <div class="form-group">
            <label>Email</label>
            <input id="er-email" type="email" placeholder="john@example.com" value="${r.guest_email || ''}" />
          </div>

          
          <div class="form-group">
            <label>Phone</label>
            <div style="display:flex;gap:8px;align-items:flex-start;width:100%">
              ${buildCountrySelectHtml("er-country-code", r.country_code || "+233")}
              <input id="er-phone" type="text" placeholder="1234567890" style="flex:1" value="${r.guest_phone || ''}" />
            </div>
          </div>

          <div class="form-group">
            <label style="display:flex;align-items:center;gap:4px;">
              <span>Influencer?</span>
              <input type="checkbox" id="er-influencer" style="width:auto;flex-shrink:0;margin-left:2px" />
            </label>
          </div>

          <div class="form-group">
            <label>Children</label>
            <input id="er-children" type="number" min="0" step="1" value="0" />
          </div>
        </div>

        <!-- Hidden fields -->
        <input id="er-nights" type="hidden" value="1" />
        <input id="er-room-subtotal" type="hidden" value="${typeof r.room_subtotal === 'number' ? r.room_subtotal.toFixed(2) : (r.room_subtotal ? Number(r.room_subtotal).toFixed(2) : '')}" />
        <div class="form-group" style="display:none">
          <label>Currency</label>
          <input id="er-currency" type="text" value="GHS" />
        </div>

        <div class="form-group">
          <label>Extras ${isPackage ? '(Package Included)' : '(Optional)'}</label>
          <div style="border:1px solid var(--ring);border-radius:var(--radius-md);padding:10px;max-height:260px;overflow-y:auto">
            ${extrasHtml || '<div class="muted">No extras available</div>'}
          </div>
          ${isPackage ? '<div style="margin-top:8px;padding:8px;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:6px;font-size:12px;color:#1e40af">📦 Package extras cannot be modified</div>' : ''}
        </div>

        ${!isPackage ? `
        <div class="form-group">
          <label>Coupon Code (Optional)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="er-coupon" type="text" placeholder="Enter coupon code" style="text-transform:uppercase;flex:1" />
            <button class="btn btn-sm" id="apply-coupon-btn" type="button">Apply</button>
          </div>
          <div id="coupon-msg" style="margin-top:4px;font-size:0.875rem;min-height:18px"></div>
          <div id="applied-coupon-display" style="margin-top:8px"></div>
        </div>
        ` : ''}

        <!-- Price Breakdown -->
        <div style="background:#f8fafc;border:1px solid var(--ring);border-radius:var(--radius-md);padding:14px;margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-weight:700;font-size:0.875rem;color:var(--ink)">Price Breakdown</div>
            ${!isPackage ? `
            <button id="recalculate-price-btn" class="btn btn-sm" style="background:#667eea;color:white;padding:4px 12px;font-size:12px">
              Recalculate Room Price
            </button>
            ` : ''}
          </div>
          ${!isPackage ? `
          <div id="price-note" style="padding:8px;background:#fef3c7;border:1px solid #fde047;border-radius:6px;margin-bottom:10px;font-size:12px;color:#78350f">
            💡 Using original booking prices. Click "Recalculate" to apply current dynamic pricing.
          </div>
          ` : `
          <div style="padding:8px;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:10px;font-size:12px;color:#1e40af">
            📦 Package pricing is fixed and cannot be recalculated.
          </div>
          `}
          <!-- Manual Price Override -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px;background:white;border:1px solid #e5e7eb;border-radius:8px">
            <label style="font-size:13px;color:#64748b;white-space:nowrap;font-weight:500">Override Price/Night:</label>
            <input id="er-price-override" type="number" min="0" step="0.01" placeholder="Auto" 
                   style="width:120px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px" />
            <span style="font-size:12px;color:#9ca3af;font-weight:500">GHS</span>
          </div>
          <!-- Room pricing breakdown -->
          <div id="calc-rooms-breakdown" style="margin-bottom:6px">
            <!-- Will be populated by updatePriceBreakdown() -->
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.875rem;font-weight:700;border-top:1px solid #e5e7eb;padding-top:6px">
            <span style="color:var(--muted)">Total Rooms:</span>
            <span id="calc-room-subtotal" style="font-weight:700">GHS 0.00</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
            <span style="color:var(--muted)">Extras:</span>
            <span id="calc-extras-total" style="font-weight:600">GHS 0.00</span>
          </div>
          <div id="calc-discount-row" style="display:none;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
            <span style="color:var(--muted)">Discount (<span id="calc-discount-label"></span>):</span>
            <span id="calc-discount" style="font-weight:600;color:#16a34a">−GHS 0.00</span>
          </div>
          <div style="border-top:2px solid var(--ring);margin:10px 0;padding-top:10px;display:flex;justify-content:space-between;font-size:1rem">
            <span style="font-weight:800">Total:</span>
            <span id="calc-total" style="font-weight:800;color:var(--brand)">GHS 0.00</span>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Status</label>
            <select id="er-status">
              <option value="pending_payment" ${r.status === 'pending_payment' ? 'selected' : ''}>Pending Payment</option>
              <option value="confirmed" ${r.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="checked-in" ${r.status === 'checked-in' ? 'selected' : ''}>Checked In</option>
              <option value="checked-out" ${r.status === 'checked-out' ? 'selected' : ''}>Checked Out</option>
              <option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
          <div class="form-group">
            <label>Payment Status</label>
            <select id="er-pay">
              <option value="unpaid" ${r.payment_status === 'unpaid' ? 'selected' : ''}>Unpaid</option>
              <option value="partial" ${r.payment_status === 'partial' ? 'selected' : ''}>Partially Paid</option>
              <option value="paid" ${r.payment_status === 'paid' ? 'selected' : ''}>Paid</option>
              <option value="refunded" ${r.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="er-notes" rows="3">${r.notes || ''}</textarea>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="er-send-email" type="checkbox" style="width:auto" />
            <span>Send confirmation email to guest</span>
          </label>
        </div>
      </div>

      <div style="padding:16px 24px;border-top:2px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;">
        <button class="btn" onclick="document.getElementById('edit-reservation-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="er-save">Save</button>
      </div>

  `;

  function getSelectedRoomIds() {
    return Array.from(
      wrap.querySelectorAll('.er-room-checkbox:checked')
    ).map((cb) => cb.value);
  }



  const extraQuantities = {}; // { extraId: qty }
    // Pre-populate extras from existing reservation
    (resExtras || []).forEach((rx) => {
      let key = rx.extra_id ? String(rx.extra_id) : null;

      // If extra_id is missing, try to map by extra_code to the active extras list
      if (!key && rx.extra_code) {
        const match = (extras || []).find(
          (e) => String(e.code || '').toLowerCase() === String(rx.extra_code || '').toLowerCase()
        );
        if (match) key = String(match.id);
      }

      if (key && rx.quantity != null && rx.quantity > 0) {
        extraQuantities[key] = rx.quantity;
      }
    });


    // Update extra qty displays after modal renders
    setTimeout(() => {
      Object.keys(extraQuantities).forEach(key => {
        const qtySpan = wrap.querySelector(`#extra-qty-${key}`);
        if (qtySpan) qtySpan.textContent = extraQuantities[key];
      });
    }, 100);


  wrap.querySelectorAll('.extra-inc').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      extraQuantities[id] = (extraQuantities[id] || 0) + 1;
      wrap.querySelector(`#extra-qty-${id}`).textContent = extraQuantities[id];
      updatePriceBreakdown();
    });
  });

  wrap.querySelectorAll('.extra-dec').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (!extraQuantities[id]) return;
      extraQuantities[id]--;
      wrap.querySelector(`#extra-qty-${id}`).textContent = extraQuantities[id];
      updatePriceBreakdown();
    });
  });

  // enable search on the country code selector
  attachCountrySearch('er-country-code');

  // ===== CALENDAR FUNCTIONS (from BookingWidget) =====
  
  // Helper function to format display date
  function formatDisplayDateCustom(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return dd + '-' + mmm + '-' + yyyy;
  }
  
  // Helper function to parse display date back to ISO
  function parseDisplayDateToISO(displayDate) {
    if (!displayDate) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const parts = displayDate.split('-');
    if (parts.length !== 3) return '';
    const day = parts[0];
    const monthIndex = months.indexOf(parts[1]);
    const year = parts[2];
    if (monthIndex === -1) return '';
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
  }
  
  // Calendar state
  let activePickerId = null;
  let selectedDatesCalendar = { 'er-in': null, 'er-out': null };
  let currentPickerMonth = { 'er-in': new Date(), 'er-out': new Date() };
  let calendarDisabledDates = [];
  let calendarPrices = {}; // Store nightly prices: { 'YYYY-MM-DD': { price: 123.45, currency: 'GHS' } }

  let pkgId = '';

  
  // Fetch calendar pricing for a specific month
  async function fetchCalendarPricing(year, month) {
    try {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const checkIn = toDateInput(firstDay);
      const checkOut = toDateInput(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1));

      // Get all active room types
      const { data: roomTypes, error: roomError } = await supabase
        .from('room_types')
        .select('id,currency')
        .eq('is_active', true);

      if (roomError || !roomTypes || !roomTypes.length) return;

      // For each room type, fetch nightly rates and keep the MIN per date
      for (const rt of roomTypes) {
        try {
          const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
            p_room_type_id: rt.id,
            p_check_in: checkIn,
            p_check_out: checkOut,
            p_pricing_model_id: null
          });

          if (!pricingError && pricingData && pricingData.nightly_rates) {
            pricingData.nightly_rates.forEach(night => {
              const nightDate = night.date;
              const nightRate = parseFloat(night.rate || 0);
              const nightCurrency = night.currency || pricingData.currency || rt.currency || 'GHS';

              if (!calendarPrices[nightDate] || nightRate < calendarPrices[nightDate].price) {
                calendarPrices[nightDate] = { price: nightRate, currency: nightCurrency };
              }
            });
          }
        } catch (e) {
          // ignore per-room failures, keep going
        }
      }
    } catch (err) {
      console.warn('Failed to fetch calendar pricing:', err);
    }
  }
  
  // Load disabled dates (reuse the existing function)
  let currentAdultsForCalendar = parseInt(r.adults) || 2; // Track current adults selection
  let currentPackageForCalendar = '';

  
  async function loadCalendarDisabledDates(adults, pkgId = '') {
    // Store for later use
    currentAdultsForCalendar = adults || currentAdultsForCalendar;
    
    // Store current package selection (if any)
    currentPackageForCalendar = pkgId || currentPackageForCalendar;

    // ===== PACKAGE CALENDAR (match PackagesModal behaviour) =====
    if (currentPackageForCalendar) {
      const pkg = (pkgList || []).find(p => String(p.id) === String(currentPackageForCalendar));
      const nights = Number(pkg?.nights || 1);
      const allowedRoomIds = (roomIdsByPackage[String(currentPackageForCalendar)] || []).map(String);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const horizonEnd = new Date(today);
      horizonEnd.setFullYear(horizonEnd.getFullYear() + 1);

      const horizonStartISO = toDateInput(today);
      const horizonEndISO = toDateInput(horizonEnd);

      // If package has no linked rooms, disable everything in the horizon
      if (!pkg || allowedRoomIds.length === 0) {
        const disabled = [];
        const cur = new Date(today);
        while (cur <= horizonEnd) {
          disabled.push(toDateInput(cur));
          cur.setDate(cur.getDate() + 1);
        }
        calendarDisabledDates = disabled;

        if (activePickerId) renderCalendar(activePickerId);
        return;
      }

      // Only rooms linked to this package
      const allowedRooms = (rooms || []).filter(rt => allowedRoomIds.includes(String(rt.id)));

      // occupancy map per room-id (and match by id or code)
      const roomKeyById = {};
      const roomKeyByCode = {};
      const occupancy = {};

      allowedRooms.forEach(rt => {
        const key = String(rt.id);
        occupancy[key] = new Set();
        roomKeyById[String(rt.id)] = key;
        if (rt.code) roomKeyByCode[String(rt.code)] = key;
      });

      // 1) Reservations overlapping horizon (exclude cancelled/no_show)
      const { data: reservationsRows, error: resErr } = await supabase
        .from('reservations')
        .select('room_type_id,room_type_code,check_in,check_out,status')
        .lt('check_in', horizonEndISO)
        .gt('check_out', horizonStartISO)
        .not('status', 'in', '(cancelled,no_show)');

      if (resErr) console.error('Error loading reservations for package calendar:', resErr);

      (reservationsRows || []).forEach(rr => {
        if (!rr.check_in || !rr.check_out) return;

        const idKey = rr.room_type_id ? roomKeyById[String(rr.room_type_id)] : undefined;
        const codeKey = rr.room_type_code ? roomKeyByCode[String(rr.room_type_code)] : undefined;
        const key = idKey || codeKey;
        if (!key || !occupancy[key]) return;

        let cur = new Date(String(rr.check_in).slice(0, 10) + 'T00:00:00');
        const end = new Date(String(rr.check_out).slice(0, 10) + 'T00:00:00');
        if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime())) return;

        while (cur < end) {
          occupancy[key].add(toDateInput(cur));
          cur.setDate(cur.getDate() + 1);
        }
      });

      // 2) Blocked dates for allowed rooms
      const allowedRoomIdsRaw = allowedRooms.map(rt => rt.id).filter(Boolean);
      if (allowedRoomIdsRaw.length) {
        const { data: blockedRows, error: bErr } = await supabase
          .from('blocked_dates')
          .select('room_type_id,blocked_date')
          .in('room_type_id', allowedRoomIdsRaw);

        if (bErr) console.error('Error loading blocked dates for package calendar:', bErr);

        (blockedRows || []).forEach(b => {
          const key = roomKeyById[String(b.room_type_id)];
          if (!key || !b.blocked_date) return;
          occupancy[key]?.add(String(b.blocked_date).slice(0, 10));
        });
      }

      // 3) Disable check-in dates where no room is free for the full package stay
      const disabled = [];
      const ciCursor = new Date(today);

      while (ciCursor <= horizonEnd) {
        const ciStr = toDateInput(ciCursor);

        // Enforce package validity on check-in + stay
        if (pkg.valid_from && ciStr < String(pkg.valid_from).slice(0, 10)) {
          disabled.push(ciStr);
          ciCursor.setDate(ciCursor.getDate() + 1);
          continue;
        }

        const coStr = addDaysISO(ciStr, nights);
        if (pkg.valid_until && coStr > String(pkg.valid_until).slice(0, 10)) {
          disabled.push(ciStr);
          ciCursor.setDate(ciCursor.getDate() + 1);
          continue;
        }

        let hasAvailableRoom = false;

        for (const rt of allowedRooms) {
          const key = String(rt.id);
          const occ = occupancy[key] || new Set();
          let free = true;

          for (let i = 0; i < nights; i++) {
            const d = new Date(ciCursor);
            d.setDate(d.getDate() + i);
            const dStr = toDateInput(d);
            if (occ.has(dStr)) { free = false; break; }
          }

          if (free) { hasAvailableRoom = true; break; }
        }

        if (!hasAvailableRoom) disabled.push(ciStr);

        ciCursor.setDate(ciCursor.getDate() + 1);
      }

      calendarDisabledDates = disabled;

      if (activePickerId) renderCalendar(activePickerId);
      return;
    }

    // ===== STANDARD CALENDAR (availability across all rooms, capacity vs adults) =====

    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toDateInput(today);
    
    const disabledSet = new Set();
    
    // 1) Always disable past dates
    for (let i = -365; i < 0; i++) {
      disabledSet.add(addDaysISO(todayISO, i));
    }

    pkgId = wrap.querySelector('#er-package')?.value || '';
    const pkgSelected = !!pkgId;

    if (pkgSelected) {
      const pkg = pkgList.find(p => String(p.id) === String(pkgId));
      const nights = Number(pkg?.nights || 1);

      const pkgRoomIds = (roomIdsByPackage[String(pkgId)] || []).map(x => Number(x)).filter(Boolean);
      if (!pkg || pkgRoomIds.length === 0) {
        // If package has no linked rooms, don't block additional dates here
        calendarDisabledDates = Array.from(disabledSet);
        if (activePickerId) renderCalendar(activePickerId);
        return;
      }

      // Horizon: 1 year (match PackagesModal)
      const horizonEnd = new Date(today);
      horizonEnd.setFullYear(horizonEnd.getFullYear() + 1);
      const horizonStartISO = toDateInput(today);
      const horizonEndISO = toDateInput(horizonEnd);

      // Build occupancy map for each room_type_id in this package
      const occupancy = {};
      pkgRoomIds.forEach(rid => (occupancy[String(rid)] = new Set()));

      // 1) Reservations overlapping horizon for these rooms
      const { data: occRes } = await supabase
        .from('reservations')
        .select('room_type_id, room_type_code, check_in, check_out, status')
        .lt('check_in', horizonEndISO)
        .gt('check_out', horizonStartISO)
        .not('status', 'in', '("cancelled","no_show")');

      (occRes || []).forEach(rr => {
        const rid = rr.room_type_id != null ? Number(rr.room_type_id) : null;
        if (!rid || !occupancy[String(rid)]) return;
        if (!rr.check_in || !rr.check_out) return;

        let cur = new Date(rr.check_in + 'T00:00:00');
        const end = new Date(rr.check_out + 'T00:00:00');
        if (isNaN(cur.getTime()) || isNaN(end.getTime())) return;

        while (cur < end) {
          occupancy[String(rid)].add(toDateInput(cur));
          cur.setDate(cur.getDate() + 1);
        }
      });

      // 2) Blocked dates for these rooms
      const { data: blocked } = await supabase
        .from('blocked_dates')
        .select('room_type_id, blocked_date')
        .in('room_type_id', pkgRoomIds);

      (blocked || []).forEach(b => {
        const rid = b.room_type_id != null ? Number(b.room_type_id) : null;
        if (!rid || !occupancy[String(rid)] || !b.blocked_date) return;
        occupancy[String(rid)].add(String(b.blocked_date).slice(0, 10));
      });

      // 3) For each potential check-in date, disable if:
      // - outside pkg.valid_from
      // - checkout exceeds pkg.valid_until
      // - no room is free for entire [ci, ci+nights)
      const ciCursor = new Date(today);
      while (ciCursor <= horizonEnd) {
        const ciStr = toDateInput(ciCursor);
        const coStr = addDaysISO(ciStr, nights);

        if (pkg.valid_from && ciStr < pkg.valid_from) {
          disabledSet.add(ciStr);
          ciCursor.setDate(ciCursor.getDate() + 1);
          continue;
        }
        if (pkg.valid_until && coStr > pkg.valid_until) {
          disabledSet.add(ciStr);
          ciCursor.setDate(ciCursor.getDate() + 1);
          continue;
        }

        let hasAvailableRoom = false;
        for (const roomId of pkgRoomIds) {
          const occ = occupancy[String(roomId)] || new Set();
          let roomFree = true;

          for (let i = 0; i < nights; i++) {
            const d = new Date(ciCursor);
            d.setDate(d.getDate() + i);
            const dStr = toDateInput(d);
            if (occ.has(dStr)) {
              roomFree = false;
              break;
            }
          }

          if (roomFree) {
            hasAvailableRoom = true;
            break;
          }
        }

        if (!hasAvailableRoom) disabledSet.add(ciStr);

        ciCursor.setDate(ciCursor.getDate() + 1);
      }

      calendarDisabledDates = Array.from(disabledSet);
      if (activePickerId) renderCalendar(activePickerId);
      return;
    }

    
    // 2) For next 90 days (not 365!), disable dates where combined capacity < adults
    // Reduced from 365 to 90 for performance - most bookings are within 90 days
    const MAX_LOOKAHEAD = 365;
    const BATCH_SIZE = 30; // Smaller batches for faster response
    
    for (let batchStart = 0; batchStart <= MAX_LOOKAHEAD; batchStart += BATCH_SIZE) {
      const promises = [];
      const dates = [];
      
      for (let i = 0; i < BATCH_SIZE && (batchStart + i) <= MAX_LOOKAHEAD; i++) {
        const offset = batchStart + i;
        const ciISO = addDaysISO(todayISO, offset);
        const coISO = addDaysISO(ciISO, 1);
        
        dates.push(ciISO);
        
        // Call get_available_rooms with p_adults: 1 to get ALL available rooms
        // Then we calculate combined capacity client-side
        promises.push(
          supabase.rpc('get_available_rooms', {
            p_check_in: ciISO,
            p_check_out: coISO,
            p_adults: 1 // Get ALL available rooms regardless of capacity
          })
          .then(({ data }) => data || [])
          .catch(() => [])
        );
      }
      
      try {
        const results = await Promise.all(promises);
        
        for (let i = 0; i < results.length; i++) {
          const rooms = results[i];
          const ciISO = dates[i];
          
          if (!rooms || rooms.length === 0) {
            disabledSet.add(ciISO);
          } else {
            // Calculate COMBINED CAPACITY like BookingWidget
            let totalCapacity = 0;
            rooms.forEach(room => {
              const cap = parseInt(room.max_adults, 10) || 0;
              totalCapacity += cap;
            });
            
            // Disable if combined capacity < adults
            if (totalCapacity < currentAdultsForCalendar) {
              disabledSet.add(ciISO);
            }
          }
        }
      } catch (err) {
        console.error('Error loading disabled dates batch:', err);
      }
    }
    
    calendarDisabledDates = Array.from(disabledSet);
    
    // Refresh calendar if open
    if (activePickerId) {
      renderCalendar(activePickerId);
    }
  }
  
  function openDatePicker(pickerId) {
    closeDatePicker();
    activePickerId = pickerId;
    const picker = document.querySelector('#' + pickerId + '-picker');
    if (!picker) return;
    picker.classList.add('active');
    
    const baseDate = selectedDatesCalendar[pickerId] ? new Date(selectedDatesCalendar[pickerId] + 'T00:00:00') : new Date();
    currentPickerMonth[pickerId] = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    
    // Fetch pricing for current and next month
    const month = currentPickerMonth[pickerId];
    fetchCalendarPricing(month.getFullYear(), month.getMonth()).then(() => {
      fetchCalendarPricing(month.getFullYear(), month.getMonth() + 1).then(() => {
        renderCalendar(pickerId);
      });
    });
  }
  
  function closeDatePicker() {
    if (activePickerId) {
      const picker = document.querySelector('#' + activePickerId + '-picker');
      if (picker) picker.classList.remove('active');
      activePickerId = null;
    }
  }
  
  function renderCalendar(pickerId) {
    const picker = document.querySelector('#' + pickerId + '-picker');
    if (!picker) return;
    
    const month = currentPickerMonth[pickerId];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    let html = '<div class="date-picker-header">' +
               '<button type="button" class="date-picker-nav" data-action="prev">‹</button>' +
               '<div class="date-picker-month">' + monthNames[month.getMonth()] + ' ' + month.getFullYear() + '</div>' +
               '<button type="button" class="date-picker-nav" data-action="next">›</button>' +
               '</div>';
    
    html += '<div class="date-picker-weekdays">';
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(day => {
      html += '<div class="date-picker-weekday">' + day + '</div>';
    });
    html += '</div>';
    
    html += '<div class="date-picker-days">';
    
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      html += '<button class="date-picker-day empty"></button>';
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(month.getFullYear(), month.getMonth(), day);
      const dateStr = toDateInput(dateObj);
      let isDisabled = false;
      
      // Different blocking logic for check-in vs check-out
      if (pickerId === 'er-in') {
        // For check-in: block if that specific date has no availability
        isDisabled = calendarDisabledDates.indexOf(dateStr) !== -1 || dateStr < today;
      } else if (pickerId === 'er-out') {
        // For check-out: block if date is before/equal to check-in, or if there's any blocked date in the interval
        if (!selectedDatesCalendar['er-in'] || dateStr <= selectedDatesCalendar['er-in']) {
          isDisabled = true;
        } else {
          // Check if any date in the interval [check-in, check-out) is blocked
          const checkInDate = selectedDatesCalendar['er-in'];
          let hasBlockedDateInInterval = false;
          let currentDate = checkInDate;
          
          while (currentDate < dateStr) {
            if (calendarDisabledDates.indexOf(currentDate) !== -1) {
              hasBlockedDateInInterval = true;
              break;
            }
            currentDate = addDaysISO(currentDate, 1);
          }
          
          isDisabled = hasBlockedDateInInterval;
        }
      }
      
      const isSelected = dateStr === selectedDatesCalendar[pickerId];
      const isToday = dateStr === today;
      let isInRange = false;
      
      if (selectedDatesCalendar['er-in'] && selectedDatesCalendar['er-out']) {
        isInRange = dateStr > selectedDatesCalendar['er-in'] && dateStr < selectedDatesCalendar['er-out'];
      }
      
      let classes = 'date-picker-day';
      if (isDisabled) classes += ' disabled';
      if (isSelected) classes += ' selected';
      if (isToday) classes += ' today';
      if (isInRange) classes += ' in-range';
      
      // Get price for this date if available
      let priceHtml = '';
      if (!isDisabled && calendarPrices[dateStr]) {
        const priceInfo = calendarPrices[dateStr];
        const roundedPrice = Math.round(priceInfo.price);
        priceHtml = '<div class="date-price">' + priceInfo.currency + ' ' + roundedPrice + '</div>';
      }
      
      html += '<button class="' + classes + '" data-date="' + dateStr + '"' +
              (isDisabled ? ' disabled' : '') + '>' +
              '<div class="date-number">' + day + '</div>' +
              priceHtml +
              '</button>';
    }
    
    html += '</div>';
    picker.innerHTML = html;
    
    // Add event listeners
    picker.querySelectorAll('[data-action="prev"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentPickerMonth[pickerId] = new Date(month.getFullYear(), month.getMonth() - 1, 1);
        const newMonth = currentPickerMonth[pickerId];
        await fetchCalendarPricing(newMonth.getFullYear(), newMonth.getMonth());
        renderCalendar(pickerId);
      });
    });
    
    picker.querySelectorAll('[data-action="next"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentPickerMonth[pickerId] = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        const newMonth = currentPickerMonth[pickerId];
        await fetchCalendarPricing(newMonth.getFullYear(), newMonth.getMonth());
        renderCalendar(pickerId);
      });
    });
    
    picker.querySelectorAll('.date-picker-day:not(.disabled):not(.empty)').forEach(dayBtn => {
      dayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dateStr = dayBtn.getAttribute('data-date');
        if (dateStr) selectDateCalendar(pickerId, dateStr);
      });
    });
  }
  
  function selectDateCalendar(pickerId, dateStr) {
    selectedDatesCalendar[pickerId] = dateStr;
    const inputEl = document.querySelector('#' + pickerId);
    if (inputEl) inputEl.value = formatDisplayDateCustom(dateStr);
    
    if (pickerId === 'er-in') {
    // If a package is selected, force fixed-length stay (match PackagesModal)
    pkgId = wrap.querySelector('#er-package')?.value || '';
    if (pkgId) {
      const pkg = (pkgList || []).find(p => String(p.id) === String(pkgId));
      const nights = Number(pkg?.nights || 1);
      const checkoutDate = addDaysISO(dateStr, nights);

      selectedDatesCalendar['er-out'] = checkoutDate;

      const outInputEl = document.querySelector('#er-out');
      if (outInputEl) outInputEl.value = formatDisplayDateCustom(checkoutDate);
    } else {
      // Find the nearest available checkout date
      if (!selectedDatesCalendar['er-out'] || selectedDatesCalendar['er-out'] <= dateStr) {

        let checkoutDate = addDaysISO(dateStr, 1);
        const maxLookahead = 365;
        let found = false;
        
        // Check each potential checkout date
        for (let i = 1; i <= maxLookahead; i++) {
          checkoutDate = addDaysISO(dateStr, i);
          let hasBlockedDate = false;
          
          // Check if any date in the interval [check-in, checkout) is blocked
          let currentDate = dateStr;
          while (currentDate < checkoutDate) {
            if (calendarDisabledDates.indexOf(currentDate) !== -1) {
              hasBlockedDate = true;
              break;
            }
            currentDate = addDaysISO(currentDate, 1);
          }
          
          // If no blocked dates in the interval, this is a valid checkout date
          if (!hasBlockedDate) {
            found = true;
            break;
          }
        }
        
        // Set the checkout date
        selectedDatesCalendar['er-out'] = checkoutDate;
        const outInputEl = document.querySelector('#er-out');
        if (outInputEl) outInputEl.value = formatDisplayDateCustom(checkoutDate);
      }
    }
      // If check-out picker is open, refresh it to show updated blocking
      if (activePickerId === 'er-out') {
        renderCalendar('er-out');
      }
    }
    
    closeDatePicker();
    calculateNights();
    computeRoomSubtotal();
  }
  
  // Initialize calendar disabled dates based on current reservation adults and (if applicable) package rules
  const initialAdults = parseInt(wrap.querySelector('#er-adults')?.value, 10) || (parseInt(r.adults, 10) || 2);
  pkgId = wrap.querySelector('#er-package')?.value || '';
  const initialPkgId = pkgId;
  loadCalendarDisabledDates(initialAdults, initialPkgId);

  // Close date picker when clicking anywhere in the modal (except the picker itself)
  const modalContent = wrap.querySelector('[onclick="event.stopPropagation()"]');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      // Check if click is outside date picker dropdowns
      const clickedPicker = e.target.closest('.date-picker-dropdown');
      const clickedInput = e.target.closest('.date-picker-input');
      
      // Close if not clicking on a picker or its input
      if (!clickedPicker && !clickedInput) {
        closeDatePicker();
      }
    });
  }

  
  // ===== END CALENDAR FUNCTIONS =====

  const inEl = wrap.querySelector('#er-in');
  const outEl = wrap.querySelector('#er-out');
  const nightsEl = wrap.querySelector('#er-nights');
  const nightsDisplayEl = wrap.querySelector('#er-nights-display');
  const roomSubtotalEl = wrap.querySelector('#er-room-subtotal');
  const availableCabinsSection = wrap.querySelector('#available-cabins-section');
  const roomsListEl = wrap.querySelector('#er-rooms-list');
  const noRoomsMessage = wrap.querySelector('#er-no-rooms-message');
  const guestInfoSection = wrap.querySelector('#guest-info-section');
  const searchBtn = wrap.querySelector('#search-availability-btn');

    // Ensure calendar state matches the reservation we are editing
  selectedDatesCalendar['er-in'] = initialCheckInISO;
  selectedDatesCalendar['er-out'] = initialCheckOutISO;

  // Make the pickers open on the reservation month (nicer UX)
  currentPickerMonth['er-in'] = new Date(initialCheckInISO + 'T00:00:00');
  currentPickerMonth['er-out'] = new Date(initialCheckOutISO + 'T00:00:00');

  // Ensure visible inputs match (in case anything else overwrote them)
  if (inEl) inEl.value = formatDisplayDateCustom(initialCheckInISO);
  if (outEl) outEl.value = formatDisplayDateCustom(initialCheckOutISO);

  // Track whether to use original prices or recalculate (declare early for calculateNights)
  let useOriginalPrices = true;

  // Set nights immediately
  calculateNights();

  // --- Room pricing helpers (needed for initialization) ---
  const roomMap = Object.fromEntries((rooms || []).map((rm) => [String(rm.id), rm]));

  function isWeekend(d) {
    // Friday (5) and Saturday (6) are weekend nights
    const dow = d.getDay();
    return dow === 5 || dow === 6;
  }

  // === EDIT MODE INITIALIZATION ===
  // For edit mode, immediately show the current room selection and guest info
  // Don't make user search - they're editing, not creating new
  
  // Show available cabins section with current room(s) pre-selected
  availableCabinsSection.style.display = 'block';
  guestInfoSection.style.display = 'block';
  
  // Create checkboxes for all rooms in the group (or single room if not a group)
  const currentRoomsHtml = allGroupReservations.map((res, index) => {
    const roomInfo = roomMap[String(res.room_type_id)] || {};
    return `
      <label class="nb-room-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer;background:#f0f9ff;padding:8px;border-radius:8px;border:2px solid #3b82f6">
        <input 
          type="checkbox" 
          class="er-room-checkbox" 
          value="${res.room_type_id}" 
          data-code="${roomInfo.code || res.room_type_code || ''}" 
          data-name="${roomInfo.name || res.room_name || ''}"
          data-max-adults="${roomInfo.max_adults || res.adults || 2}"
          checked
          style="width:auto"
        />
        <span style="flex:1;font-weight:600">${(roomInfo.code || res.room_type_code || '').toUpperCase()} – ${roomInfo.name || res.room_name || ''} (max ${roomInfo.max_adults || res.adults} adults)</span>
        <span style="font-size:12px;color:#64748b;font-weight:600">${isGroupBooking ? `Room ${index + 1}` : 'Current Room'}</span>
      </label>
    `;
  }).join('');
  
  roomsListEl.innerHTML = currentRoomsHtml;
  
  // Set up room selection change handler
  const setupRoomCheckboxListeners = () => {
    wrap.querySelectorAll('.er-room-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        // Only recalculate if user has clicked "Recalculate" button
        // Otherwise preserve original prices
        if (!useOriginalPrices) {
          computeRoomSubtotal();
        }
      });
    });
  };
  
  setupRoomCheckboxListeners();
  
  // Function to set pricing using original values
  function setOriginalPrices() {
    // Set room subtotal to original value from database
    // For group bookings: sum all room subtotals
    // For single bookings: use the single room subtotal
    const originalSubtotal = isGroupBooking
      ? allGroupReservations.reduce((sum, res) => sum + parseFloat(res.room_subtotal || 0), 0)
      : parseFloat(primaryReservation.room_subtotal || 0);
    
    // Set individual room prices for breakdown display
    perRoomSubtotals = isGroupBooking
      ? allGroupReservations.map(res => parseFloat(res.room_subtotal || 0))
      : [parseFloat(primaryReservation.room_subtotal || 0)];
    
    roomSubtotalEl.value = String(originalSubtotal.toFixed(2));
    console.log('Setting original room subtotal:', originalSubtotal, isGroupBooking ? `(${allGroupReservations.length} rooms)` : '(single room)');
    console.log('roomSubtotalEl.value after setting:', roomSubtotalEl.value);
    updatePriceBreakdown();
  }
  
  // Use original prices on init
  setOriginalPrices();
  
  console.log('✅ Edit mode initialized:', isGroupBooking ? `group with ${allGroupReservations.length} rooms` : `single room ${primaryReservation.room_name}`);

  // Recalculate button handler
  const recalcBtn = wrap.querySelector('#recalculate-price-btn');
const priceNote = wrap.querySelector('#price-note');

if (recalcBtn && priceNote) {
  recalcBtn.addEventListener('click', async () => {
    if (useOriginalPrices) {
      recalcBtn.disabled = true;
      recalcBtn.textContent = 'Recalculating...';

      await computeRoomSubtotal();

      useOriginalPrices = false;
      recalcBtn.textContent = 'Use Original Prices';
      priceNote.innerHTML = '🔄 Using current dynamic pricing. Click to revert to original booking prices.';
      priceNote.style.background = '#dbeafe';
      priceNote.style.borderColor = '#93c5fd';
      priceNote.style.color = '#1e40af';
      recalcBtn.disabled = false;
    } else {
      setOriginalPrices();

      useOriginalPrices = true;
      recalcBtn.textContent = 'Recalculate Room Price';
      priceNote.innerHTML = '💡 Using original booking prices. Click "Recalculate" to apply current dynamic pricing.';
      priceNote.style.background = '#fef3c7';
      priceNote.style.borderColor = '#fde047';
      priceNote.style.color = '#78350f';
    }
  });
}


  // Remove discount button handler
  const removeDiscountBtn = wrap.querySelector('#remove-discount-btn');
  if (removeDiscountBtn) {
    removeDiscountBtn.addEventListener('click', () => {
      if (confirm('Remove discount code? This will update the total price.')) {
        // Clear the applied coupon
        appliedCoupon = null;
        
        // Update the price breakdown (this will hide discount in bottom section)
        updatePriceBreakdown();
        
        // Hide the specific discount row in Current Booking by ID
        const discountRow = wrap.querySelector('#current-booking-discount-row');
        if (discountRow) {
          discountRow.style.display = 'none';
        }
        
        console.log('✅ Discount removed');
      }
    });
  }


  // Search availability handler (matching BookingWidget flow)
  async function searchAvailability() {
    const adults = parseInt(wrap.querySelector('#er-adults').value, 10) || 2;
    const checkInISO = parseDisplayDateToISO(inEl.value);
    const checkOutISO = parseDisplayDateToISO(outEl.value);

    if (!checkInISO || !checkOutISO) {
      alert('Please select check-in and check-out dates');
      return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';

    try {
      // Use p_adults: 1 to get ALL available rooms (same as calendar)
      const { data: availableRooms, error } = await supabase.rpc('get_available_rooms', {
        p_check_in: checkInISO,
        p_check_out: checkOutISO,
        p_adults: 1 // Get ALL available rooms to calculate combined capacity
      });

      if (error) throw error;

      // Calculate COMBINED CAPACITY like BookingWidget and calendar
      let totalCapacity = 0;
      (availableRooms || []).forEach(room => {
        const cap = parseInt(room.max_adults, 10) || 0;
        totalCapacity += cap;
      });

      // Show available cabins section
      availableCabinsSection.style.display = 'block';

      // Check if combined capacity can handle total adults
      if (!availableRooms || availableRooms.length === 0 || totalCapacity < adults) {
        roomsListEl.innerHTML = '';
        noRoomsMessage.style.display = 'block';
        guestInfoSection.style.display = 'none';
      } else {
        noRoomsMessage.style.display = 'none';
        
        // Render ALL available rooms (user can select multiple to meet capacity)
        roomsListEl.innerHTML = availableRooms.map(room => `
          <label class="nb-room-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
            <input 
              type="checkbox" 
              class="er-room-checkbox" 
              value="${room.id}" 
              data-code="${room.code || ''}" 
              data-name="${room.name || ''}"
              data-max-adults="${room.max_adults || 0}"
              style="width:auto"
            />
            <span style="flex:1">${(room.code || '').toUpperCase()} – ${room.name || ''} (max ${room.max_adults} adults)</span>
            <span style="font-size:12px;color:#64748b">GHS ${parseFloat(room.total_price || 0).toFixed(2)}</span>
          </label>
        `).join('');

        // Preselect the existing room from the reservation
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          const existingRoomId = r.room_type_id ? String(r.room_type_id) : null;
          console.log('Attempting to pre-select room ID:', existingRoomId);
          
          if (existingRoomId) {
            const existingCb = roomsListEl.querySelector(
              `input.er-room-checkbox[value="${existingRoomId}"]`
            );
            
            console.log('Found checkbox:', existingCb);
            
            if (existingCb) {
              existingCb.checked = true;
              console.log('✅ Pre-selected room:', existingRoomId);
              
              // Manually trigger change event to update pricing
              existingCb.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              console.warn('⚠️ Could not find room checkbox for ID:', existingRoomId);
              console.log('Available checkboxes:', roomsListEl.querySelectorAll('input.er-room-checkbox'));
            }
          }
          
          // Recompute subtotal after selection
          computeRoomSubtotal();
          
          // Set up change listeners for all checkboxes
          setupRoomCheckboxListeners();
        }, 100);


        // Show guest info section
        guestInfoSection.style.display = 'block';
          
      }

    } catch (err) {
      console.error('Search availability error:', err);
      alert('Error searching availability: ' + err.message);
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search Available Cabins';
    }
  }

  searchBtn.addEventListener('click', searchAvailability);
  // Note: Not auto-triggering search in edit mode - current room is shown immediately

    const pkgSelectEl = wrap.querySelector('#er-package');
  if (pkgSelectEl) {
    pkgSelectEl.disabled = true;
    pkgSelectEl.addEventListener('change', async () => {
      const selectedPkgId = pkgSelectEl.value || '';
      const pkg = pkgList.find(p => String(p.id) === String(selectedPkgId));
      const nights = Number(pkg?.nights || 1);

      // If package selected: force check-out = check-in + nights
      if (selectedPkgId && selectedDatesCalendar['er-in']) {
        const newOut = addDaysISO(selectedDatesCalendar['er-in'], nights);
        selectedDatesCalendar['er-out'] = newOut;

        const outInputEl = wrap.querySelector('#er-out');
        if (outInputEl) outInputEl.value = formatDisplayDateCustom(newOut);
        calculateNights();
      }

      // Reload calendar disabled dates using package rules
      const adults = parseInt(wrap.querySelector('#er-adults').value, 10) || 2;
      pkgId = selectedPkgId;
      await loadCalendarDisabledDates(adults, pkgId);


      // Re-run availability search if dates exist
      const searchBtn = wrap.querySelector('#search-availability-btn');
      if (searchBtn && selectedDatesCalendar['er-in'] && selectedDatesCalendar['er-out']) {
        searchBtn.click();
      }
    });
  }

  // Re-search when adults or dates change
  wrap.querySelector('#er-adults').addEventListener('change', async () => {
    const adults = parseInt(wrap.querySelector('#er-adults').value, 10) || 2;
    
    // Reload calendar blocked dates with new adults count (like BookingWidget)
    await loadCalendarDisabledDates(adults);
    
    // Hide results to force re-search
    availableCabinsSection.style.display = 'none';
    guestInfoSection.style.display = 'none';
  });
  
  // Price override field listener
  const priceOverrideEl = wrap.querySelector('#er-price-override');
  if (priceOverrideEl) {
    priceOverrideEl.addEventListener('input', () => {
      if (!useOriginalPrices) {
        computeRoomSubtotal();
      }
    });
  }

  // --- Room pricing helpers continued ---

  async function computeRoomSubtotal() {
    const selectedRoomIds = getSelectedRoomIds();
    
    // Parse display dates to ISO
    const checkInISO = parseDisplayDateToISO(inEl.value);
    const checkOutISO = parseDisplayDateToISO(outEl.value);
    
    const ci = new Date(checkInISO);
    const co = new Date(checkOutISO);

    if (
      !selectedRoomIds.length ||
      !inEl.value ||
      !outEl.value ||
      !(co > ci)
    ) {
      roomSubtotalEl.value = '';
      updatePriceBreakdown();
      return;
    }

    let weekdayN = 0;
    let weekendN = 0;

    // Count each *night* starting from check-in date up to night before check-out
    for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
      if (isWeekend(d)) weekendN++;
      else weekdayN++;
    }

    // Nights are the same for all cabins
    nightsEl.value = String(weekdayN + weekendN);
    
    // Check for manual price override
    const priceOverrideEl = wrap.querySelector('#er-price-override');
    const priceOverride = priceOverrideEl && priceOverrideEl.value ? parseFloat(priceOverrideEl.value) : null;

    let totalSubtotal = 0;
    const newPerRoomSubtotals = []; // Track individual prices
    
    // Use manual override if provided, otherwise use dynamic pricing
    if (priceOverride && priceOverride > 0) {
      console.log('Using manual price override:', priceOverride, 'per night');
      const totalNights = weekdayN + weekendN;
      
      for (const roomId of selectedRoomIds) {
        const roomPrice = priceOverride * totalNights;
        totalSubtotal += roomPrice;
        newPerRoomSubtotals.push(roomPrice);
      }
    } else {
      // Use dynamic pricing for each selected room
      for (const roomId of selectedRoomIds) {
        const info = roomMap[String(roomId)];
        if (!info) continue;

        let roomPrice = 0;

        try {
          console.log('Calling calculate_dynamic_price for room:', roomId, 'dates:', checkInISO, 'to', checkOutISO);
          
          // Call dynamic pricing function - Supabase returns {data, error}
          const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
            p_room_type_id: roomId,
            p_check_in: checkInISO,
            p_check_out: checkOutISO,
            p_pricing_model_id: null // Uses active model
          });

          console.log('Dynamic pricing response:', pricingData);
          console.log('Dynamic pricing error:', pricingError);

          if (pricingError) {
            console.error('RPC Error:', pricingError);
            throw new Error(pricingError.message || 'Dynamic pricing failed');
          }

          if (pricingData && pricingData.total) {
            console.log('Using dynamic price:', pricingData.total);
            roomPrice = parseFloat(pricingData.total);
          } else {
            // Fallback to base prices if no dynamic pricing returned
            console.log('No dynamic pricing data, using base prices');
            const wkdPrice = Number(info.base_price_per_night_weekday || 0);
            const wkePrice = Number(info.base_price_per_night_weekend || 0);
            roomPrice = weekdayN * wkdPrice + weekendN * wkePrice;
          }
        } catch (err) {
          // Fallback to base prices on error
          console.error('Dynamic pricing failed for room', roomId, '- using base prices. Error:', err);
          const wkdPrice = Number(info.base_price_per_night_weekday || 0);
          const wkePrice = Number(info.base_price_per_night_weekend || 0);
          roomPrice = weekdayN * wkdPrice + weekendN * wkePrice;
        }

        totalSubtotal += roomPrice;
        newPerRoomSubtotals.push(roomPrice);
      }
    }

    // Update the module-level array
    perRoomSubtotals = newPerRoomSubtotals;

    roomSubtotalEl.value = String(totalSubtotal.toFixed(2));
    updatePriceBreakdown();
  }

  // Auto-calculate nights when dates change
  function calculateNights() {
    // Parse display dates back to ISO
    const checkInISO = parseDisplayDateToISO(inEl.value);
    const checkOutISO = parseDisplayDateToISO(outEl.value);
    
    const checkIn = new Date(checkInISO);
    const checkOut = new Date(checkOutISO);

    if (checkIn && checkOut && checkOut > checkIn) {
      const nights = Math.ceil(
        (checkOut - checkIn) / (1000 * 60 * 60 * 24)
      );
      nightsEl.value = nights;
      if (nightsDisplayEl) nightsDisplayEl.textContent = nights;
    } else {
      nightsEl.value = 1;
      if (nightsDisplayEl) nightsDisplayEl.textContent = 1;
    }

    // Only recompute pricing if user has clicked "Recalculate" button
    // Check if useOriginalPrices is defined (after initialization)
    if (typeof useOriginalPrices !== 'undefined' && !useOriginalPrices) {
      computeRoomSubtotal();
    }
    
    // Hide available cabins when dates change
    if (availableCabinsSection) availableCabinsSection.style.display = 'none';
    if (guestInfoSection) guestInfoSection.style.display = 'none';
  }

  // Calculate price breakdown
  function updatePriceBreakdown() {
    const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
    const currency = wrap.querySelector('#er-currency').value || 'GHS';
    
    console.log('updatePriceBreakdown called - roomSubtotal:', roomSubtotal, 'from roomSubtotalEl.value:', roomSubtotalEl.value);

    // Calculate extras total + capture details from extraQuantities
    selectedExtras = Object.entries(extraQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const ex = (extras || []).find((e) => String(e.id) === String(id)) || {};
        return {
          extra_id: id,
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

    // Total only for extras that this coupon targets (if defined)
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

    // Calculate discount
    let discount = 0;
    if (appliedCoupon) {
      const subtotal = roomSubtotal + extrasTotal;

      if (appliedCoupon.applies_to === 'both') {
        // ROOM + only the targeted extras (if any are configured);
        // otherwise, room + all extras
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
        const base = extrasTargetTotal; // only targeted extras
        discount =
          appliedCoupon.discount_type === 'percentage'
            ? (base * appliedCoupon.discount_value) / 100
            : appliedCoupon.discount_value;
      }

      // Never discount more than the subtotal
      discount = Math.min(discount, subtotal);
    }

    const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);

    // Update individual rooms breakdown
    const roomsBreakdownEl = wrap.querySelector('#calc-rooms-breakdown');
    if (roomsBreakdownEl) {
      if (isGroupBooking && allGroupReservations.length > 1) {
        // Show breakdown for each cabin
        const selectedRoomIds = getSelectedRoomIds();
        const breakdownHtml = selectedRoomIds.map((roomId, index) => {
          // Get room info
          const roomInfo = roomMap[String(roomId)] || {};
          const roomName = roomInfo.name || `Room ${index + 1}`;
          
          // Get price from perRoomSubtotals if available (after recalculate)
          // Otherwise use original from allGroupReservations
          let roomPrice;
          if (typeof perRoomSubtotals !== 'undefined' && perRoomSubtotals[index]) {
            roomPrice = perRoomSubtotals[index];
          } else if (allGroupReservations[index]) {
            roomPrice = parseFloat(allGroupReservations[index].room_subtotal || 0);
          } else {
            roomPrice = 0;
          }
          
          return `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.875rem;padding-left:8px">
              <span style="color:#64748b">${roomName}</span>
              <span style="font-weight:600">${formatCurrency(roomPrice, currency)}</span>
            </div>
          `;
        }).join('');
        roomsBreakdownEl.innerHTML = breakdownHtml;
      } else {
        // Single room - no breakdown needed
        roomsBreakdownEl.innerHTML = '';
      }
    }

    // Update display with comma formatting
    wrap.querySelector('#calc-room-subtotal').textContent =
      formatCurrency(roomSubtotal, currency);
    wrap.querySelector('#calc-extras-total').textContent =
      formatCurrency(extrasTotal, currency);

    if (discount > 0 && appliedCoupon) {
      wrap.querySelector('#calc-discount-row').style.display = 'flex';
      wrap.querySelector('#calc-discount-label').textContent = appliedCoupon.code;
      wrap.querySelector('#calc-discount').textContent =
        `−${formatCurrency(discount, currency)}`;
    } else {
      wrap.querySelector('#calc-discount-row').style.display = 'none';
    }

    wrap.querySelector('#calc-total').textContent =
      formatCurrency(finalTotal, currency);
  }

  // Validate and apply coupon
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

      const today = toDateInput(new Date());
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

      // NEW: if coupon targets specific extras, ensure at least one is selected
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

      return { valid: true, coupon: coupon };
    } catch (err) {
      return { valid: false, error: 'Error validating coupon: ' + err.message };
    }
  }

  // Event listeners
  // Open calendar on click
  inEl.addEventListener('click', () => {
    openDatePicker('er-in');
  });
  
  outEl.addEventListener('click', () => {
    openDatePicker('er-out');
  });
  
  // Also handle change events for when dates are programmatically set
  inEl.addEventListener('change', () => {
    calculateNights();
    computeRoomSubtotal();
  });

  outEl.addEventListener('change', () => {
    calculateNights();
    computeRoomSubtotal();
  });

  roomSubtotalEl.addEventListener('input', updatePriceBreakdown);

  // Recalculate subtotal whenever any cabin checkbox changes
  wrap.addEventListener('change', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('er-room-checkbox')) {
      // Only recompute AFTER user has opted into dynamic pricing
      if (typeof useOriginalPrices !== 'undefined' && !useOriginalPrices) {
        computeRoomSubtotal();
      }
    }
  });


  // On first open, show the original booked prices in the breakdown.
  // (Dynamic recalculation only happens after user interaction.)
  updatePriceBreakdown();

  // Do NOT compute dynamic room subtotal on initial open —
  // the "Room Subtotal" should reflect the original booking price until the user triggers a recalculation.

  
  // Apply coupon button
  const applyCouponBtn = wrap.querySelector('#apply-coupon-btn');
  if (applyCouponBtn) {
    applyCouponBtn.addEventListener('click', async () => {
      const code = wrap.querySelector('#er-coupon').value.trim();
      const msgEl = wrap.querySelector('#coupon-msg');
      const displayEl = wrap.querySelector('#applied-coupon-display');
      const btn = applyCouponBtn;

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
        msgEl.textContent = '✓ Coupon applied: ' + (appliedCoupon.description || appliedCoupon.code);

        const discountText = appliedCoupon.discount_type === 'percentage'
          ? `${appliedCoupon.discount_value}% off`
          : `GHS ${appliedCoupon.discount_value} off`;

        let scopeLabel;
        if (appliedCoupon.applies_to === 'both') {
          let labels = [];
          if (Array.isArray(appliedCoupon.extra_ids) && appliedCoupon.extra_ids.length) {
            labels = appliedCoupon.extra_ids.map(id => extraNameMap[String(id)]).filter(Boolean);
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
            labels = appliedCoupon.extra_ids.map(id => extraNameMap[String(id)]).filter(Boolean);
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
            <button type="button" class="btn btn-sm" id="remove-coupon-btn" style="background:#fff;color:#b91c1c;border:1px solid #fecaca;padding:4px 8px;font-size:0.75rem">Remove</button>
          </div>
        `;

        wrap.querySelector('#remove-coupon-btn')?.addEventListener('click', () => {
          appliedCoupon = null;
          wrap.querySelector('#er-coupon').value = '';
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
  }


  calculateNights(); // Initial calculation

  wrap.querySelector('#er-save').addEventListener('click', async () => {
    try {
      const selectedRoomIds = getSelectedRoomIds();

      if (!selectedRoomIds.length) {
        alert('Please select at least one cabin');
        return;
      }

      // ---- DATE VALIDATION ----
      if (!inEl.value || !outEl.value) {
        alert('Please select both check-in and check-out dates.');
        return;
      }

      const checkInISO = parseDisplayDateToISO(inEl.value);
      const checkOutISO = parseDisplayDateToISO(outEl.value);
      
      const checkInDate = new Date(checkInISO);
      const checkOutDate = new Date(checkOutISO);

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

      // ---- CAPACITY VALIDATION (like BookingWidget) ----
      const totalAdults = parseInt(wrap.querySelector('#er-adults').value, 10) || 2;
      let combinedCapacity = 0;
      
      selectedRoomIds.forEach(roomId => {
        const info = roomMap[String(roomId)] || {};
        const cap = parseInt(info.max_adults, 10) || 0;
        combinedCapacity += cap;
      });
      
      if (combinedCapacity < totalAdults) {
        alert(
          `Selected cabins cannot accommodate ${totalAdults} adults. ` +
          `Combined capacity: ${combinedCapacity}. ` +
          `Please select additional cabins or reduce the number of adults.`
        );
        return;
      }

      // ---- AVAILABILITY CHECK FOR EACH CABIN ----
      // === SMART AVAILABILITY CHECK ===
      // Only check availability if rooms or dates changed
      
      // Check if room selection changed (for groups, check if set of rooms changed)
      const originalRoomSet = new Set(ORIGINAL_ROOM_IDS.map(String));
      const selectedRoomSet = new Set(selectedRoomIds.map(String));
      const roomsMatch = 
        originalRoomSet.size === selectedRoomSet.size &&
        [...originalRoomSet].every(id => selectedRoomSet.has(id));
      
      const roomChanged = !roomsMatch;
      const checkInChanged = checkInISO !== ORIGINAL_CHECK_IN;
      const checkOutChanged = checkOutISO !== ORIGINAL_CHECK_OUT;
      const needsAvailabilityCheck = roomChanged || checkInChanged || checkOutChanged;

      console.log('Availability check needed?', needsAvailabilityCheck, {
        roomChanged,
        checkInChanged,
        checkOutChanged,
        selectedRoomIds,
        ORIGINAL_ROOM_IDS,
        checkInISO,
        ORIGINAL_CHECK_IN,
        checkOutISO,
        ORIGINAL_CHECK_OUT
      });

      if (needsAvailabilityCheck) {
        console.log('🔍 Running availability check...');
        
        if (isPackage) {
          // === PACKAGE-SPECIFIC AVAILABILITY CHECK ===
          // Similar to PackagesModal.tsx - check reservations AND blocked dates
          console.log('Running package availability check...');
          
          for (const roomId of selectedRoomIds) {
            const info = roomMap[String(roomId)] || {};
            const roomTypeCode = info.code || null;
            
            // 1) Load ALL reservations that overlap the selected date range
            const { data: overlappingReservations, error: resError } = await supabase
              .from('reservations')
              .select('room_type_id,room_type_code,check_in,check_out,status,id')
              .lt('check_in', checkOutISO)
              .gt('check_out', checkInISO)
              .not('status', 'in', '(cancelled,no_show)')
              .neq('id', id); // Exclude current reservation being edited
            
            if (resError) {
              console.error('Package availability check (reservations) failed:', resError);
              alert('Error checking availability. Please try again.');
              return;
            }
            
            // Check if this room has overlapping reservations
            const hasReservation = (overlappingReservations || []).some(res => {
              const sameRoom = 
                (res.room_type_id && String(res.room_type_id) === String(roomId)) ||
                (roomTypeCode && res.room_type_code && res.room_type_code === roomTypeCode);
              
              if (!sameRoom) return false;
              
              const existingStart = new Date(res.check_in).getTime();
              const existingEnd = new Date(res.check_out).getTime();
              const start = new Date(checkInISO).getTime();
              const end = new Date(checkOutISO).getTime();
              
              // Overlap if existingStart < end && existingEnd > start
              return existingStart < end && existingEnd > start;
            });
            
            if (hasReservation) {
              alert(`${info.name || 'Selected cabin'} is NOT available for the selected dates (reserved).`);
              return;
            }
            
            // 2) Load blocked dates for this room in the date range
            const { data: blockedDates, error: blockedError } = await supabase
              .from('blocked_dates')
              .select('room_type_id,blocked_date')
              .eq('room_type_id', roomId)
              .gte('blocked_date', checkInISO)
              .lt('blocked_date', checkOutISO);
            
            if (blockedError) {
              console.error('Package availability check (blocked dates) failed:', blockedError);
              alert('Error checking availability. Please try again.');
              return;
            }
            
            if (blockedDates && blockedDates.length > 0) {
              alert(`${info.name || 'Selected cabin'} is NOT available for the selected dates (blocked).`);
              return;
            }
            
            console.log('✅ Package availability check passed for', info.name);
          }
        } else {
          // === STANDARD AVAILABILITY CHECK ===
          // Use the same RPC as BookingWidget for consistency
          for (const roomId of selectedRoomIds) {
            const info = roomMap[String(roomId)] || {};
            const roomTypeCode = info.code || null;
            
            console.log('Checking availability for:', {
              roomId,
              roomTypeCode,
              checkIn: checkInISO,
              checkOut: checkOutISO
            });
            
            // Call the same RPC that BookingWidget uses
            const { data: availableRooms, error: availError } = await supabase.rpc('get_available_rooms', {
              p_check_in: checkInISO,
              p_check_out: checkOutISO,
              p_adults: 1 // Just checking availability, not capacity
            });
            
            if (availError) {
              console.error('Availability check failed:', availError);
              alert('Error checking availability. Please try again.');
              return;
            }
            
            console.log('Available rooms from RPC:', availableRooms);

            // If a package is selected, restrict rooms to package-linked rooms only
            const selectedPkgId = wrap.querySelector('#er-package')?.value || '';
            if (selectedPkgId) {
              const pkgRoomIds = new Set((roomIdsByPackage[String(selectedPkgId)] || []).map(x => String(x)));
              const filtered = (availableRooms || []).filter(ar => pkgRoomIds.has(String(ar.id)));
              availableRooms = filtered;
            }

            
            // Check if this specific room is in the available list
            const isAvailable = availableRooms && availableRooms.some(r => 
              String(r.id) === String(roomId) || r.code === roomTypeCode
            );
            
            console.log('Availability result for', roomTypeCode, ':', isAvailable);

            if (!isAvailable) {
              alert(
                `${info.name || 'One of the selected cabins'} is NOT available for the selected dates.`
              );
              return;
            }
          }
        }
      } else {
        console.log('✅ Skipping availability check - room and dates unchanged');
      }

      // ---- PRICING ----
      let roomSubtotal;
      let perRoomSubtotals = [];
      
      // Check for manual price override
      const priceOverrideEl = wrap.querySelector('#er-price-override');
      const priceOverride = priceOverrideEl && priceOverrideEl.value ? parseFloat(priceOverrideEl.value) : null;
      
      if (isPackage) {
        // === PACKAGE: Use fixed package pricing (no dynamic pricing) ===
        console.log('📦 Using fixed package pricing');
        // For group bookings: use each room's original subtotal
        // For single bookings: use the single room subtotal
        if (isGroupBooking) {
          perRoomSubtotals = allGroupReservations.map(res => parseFloat(res.room_subtotal || 0));
          roomSubtotal = perRoomSubtotals.reduce((sum, price) => sum + price, 0);
        } else {
          perRoomSubtotals = [parseFloat(primaryReservation.room_subtotal || 0)];
          roomSubtotal = perRoomSubtotals[0];
        }
      } else if (priceOverride && priceOverride > 0) {
        // === MANUAL OVERRIDE: Use override price per night ===
        console.log('💰 Using manual price override:', priceOverride, 'per night');
        const ci = new Date(checkInISO);
        const co = new Date(checkOutISO);
        
        let totalNights = 0;
        for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
          totalNights++;
        }
        
        // Apply override price to each room
        for (const roomId of selectedRoomIds) {
          const roomPrice = priceOverride * totalNights;
          perRoomSubtotals.push(roomPrice);
        }
        
        roomSubtotal = perRoomSubtotals.reduce((sum, v) => sum + v, 0) || 0;
      } else {
        // === STANDARD: Recompute per-cabin subtotals using dynamic pricing ===
        const ci = new Date(checkInISO);
        const co = new Date(checkOutISO);

        let weekdayN = 0;
        let weekendN = 0;
        for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
          if (isWeekend(d)) weekdayN++;
          else weekdayN++;
        }

        // Calculate dynamic pricing for each room
        for (const roomId of selectedRoomIds) {
          const info = roomMap[String(roomId)] || {};
          
          try {
            // Call dynamic pricing function - Supabase returns {data, error}
            const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
              p_room_type_id: roomId,
              p_check_in: checkInISO,
              p_check_out: checkOutISO,
              p_pricing_model_id: null // Uses active model
            });

            if (pricingError) {
              throw new Error(pricingError.message || 'Dynamic pricing failed');
            }

            if (pricingData && pricingData.total) {
              perRoomSubtotals.push(parseFloat(pricingData.total));
            } else {
              // Fallback to base prices
              const wkdPrice = Number(info.base_price_per_night_weekday || 0);
              const wkePrice = Number(info.base_price_per_night_weekend || 0);
              perRoomSubtotals.push(weekdayN * wkdPrice + weekendN * wkePrice);
            }
          } catch (err) {
            // Fallback to base prices on error
            console.warn('Dynamic pricing failed in save, using base prices:', err);
            const wkdPrice = Number(info.base_price_per_night_weekday || 0);
            const wkePrice = Number(info.base_price_per_night_weekend || 0);
            perRoomSubtotals.push(weekdayN * wkdPrice + weekendN * wkePrice);
          }
        }

        roomSubtotal = perRoomSubtotals.reduce((sum, v) => sum + v, 0) || 0;
      }
      
      roomSubtotalEl.value = String(roomSubtotal.toFixed(2));

      // ----- DISTRIBUTE ADULTS ACROSS ROOMS -----
      // (totalAdults already declared above in capacity validation section)

      const roomCapacities = selectedRoomIds.map((roomId) => {
        const info = roomMap[String(roomId)] || {};
        return Number(info.max_adults || 0);
      });

      const adultsPerRoom = new Array(selectedRoomIds.length).fill(0);
      let remainingAdults = totalAdults;

      for (let i = 0; i < selectedRoomIds.length && remainingAdults > 0; i++) {
        const cap = roomCapacities[i];
        if (cap <= 0) continue;
        const assign = Math.min(cap, remainingAdults);
        adultsPerRoom[i] = assign;
        remainingAdults -= assign;
      }
      // ------------------------------------------

      // ---- EXTRAS: Rebuild selectedExtras from current quantities (like updatePriceBreakdown) ----
      selectedExtras = Object.entries(extraQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => {
          const ex = (extras || []).find((e) => String(e.id) === String(id)) || {};
          return {
            extra_id: id,
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

      // ---- DISCOUNT with breakdown (matching BookingWidget) ----
      let discount = 0;
      let roomDiscount = 0;
      let extrasDiscount = 0;
      let extrasWithDiscounts = [];
      
      if (isPackage) {
        // === PACKAGE: No discount logic, use original discount amount ===
        console.log('📦 Using fixed package discount (if any)');
        discount = parseFloat(primaryReservation.discount_amount || 0);
        roomDiscount = parseFloat(primaryReservation.room_discount || 0);
        extrasDiscount = parseFloat(primaryReservation.extras_discount || 0);
        
        // For packages, extras don't have individual discounts - just pass them through
        extrasWithDiscounts = selectedExtras.map(extra => ({
          ...extra,
          discount: 0
        }));
      } else if (appliedCoupon) {
        const subtotal = roomSubtotal + extrasTotal;

        // Calculate total only for extras that this coupon targets (if defined)
        let extrasTargetTotal = extrasTotal;
        let targetedExtras = selectedExtras; // All extras by default
        
        if (
          Array.isArray(appliedCoupon.extra_ids) &&
          appliedCoupon.extra_ids.length
        ) {
          const idSet = new Set(appliedCoupon.extra_ids.map(String));
          targetedExtras = selectedExtras.filter((e) => idSet.has(String(e.extra_id)));
          extrasTargetTotal = targetedExtras.reduce(
            (sum, e) => sum + e.price * e.quantity,
            0
          );
        }

        if (appliedCoupon.applies_to === 'both') {
          // Apply discount to both room and targeted extras
          const base = roomSubtotal + extrasTargetTotal;
          const totalDiscount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
          
          // Proportionally split discount between room and extras
          if (base > 0) {
            const roomPortion = roomSubtotal / base;
            const extrasPortion = extrasTargetTotal / base;
            
            roomDiscount = totalDiscount * roomPortion;
            extrasDiscount = totalDiscount * extrasPortion;
          }
        } else if (appliedCoupon.applies_to === 'rooms') {
          // Apply discount only to rooms
          roomDiscount =
            appliedCoupon.discount_type === 'percentage'
              ? (roomSubtotal * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
          extrasDiscount = 0;
        } else if (appliedCoupon.applies_to === 'extras') {
          // Apply discount only to targeted extras
          roomDiscount = 0;
          extrasDiscount =
            appliedCoupon.discount_type === 'percentage'
              ? (extrasTargetTotal * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        }

        // Calculate per-extra discounts for extras that are targeted
        extrasWithDiscounts = selectedExtras.map((extra) => {
          let extraDiscount = 0;
          
          if (extrasDiscount > 0 && extrasTargetTotal > 0) {
            // Check if this extra is targeted
            let isTargeted = true;
            if (appliedCoupon.extra_ids && appliedCoupon.extra_ids.length) {
              const idSet = new Set(appliedCoupon.extra_ids.map(String));
              isTargeted = idSet.has(String(extra.extra_id));
            }
            
            if (isTargeted && extra.quantity > 0) {
              const extraSubtotal = extra.price * extra.quantity;
              extraDiscount = (extraSubtotal / extrasTargetTotal) * extrasDiscount;
            }
          }
          
          return {
            ...extra,
            discount: extraDiscount
          };
        });

        // Total discount
        discount = roomDiscount + extrasDiscount;
        discount = Math.min(discount, subtotal);
      } else if (!isPackage) {
        // No coupon AND not a package: populate extrasWithDiscounts with zero discounts
        extrasWithDiscounts = selectedExtras.map((extra) => ({
          ...extra,
          discount: 0
        }));
      }

      const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);
      const isInfluencer = wrap.querySelector('#er-influencer').checked;

      // Common data for all reservations
      const commonPayload = {
        guest_first_name:
          wrap.querySelector('#er-first').value.trim() || null,
        guest_last_name:
          wrap.querySelector('#er-last').value.trim() || null,
        guest_email:
          wrap.querySelector('#er-email').value.trim() || null,
        country_code:
          wrap.querySelector('#er-country-code')?.value || null,
        guest_phone:
          wrap.querySelector('#er-phone').value.trim() || null,
        check_in: parseDisplayDateToISO(wrap.querySelector('#er-in').value) || null,
        check_out: parseDisplayDateToISO(wrap.querySelector('#er-out').value) || null,
        nights:
          parseInt(
            wrap.querySelector('#er-nights').value || '0',
            10
          ) || 0,
        adults:
          parseInt(
            wrap.querySelector('#er-adults').value || '0',
            10
          ) || 0,
        children:
          parseInt(
            wrap.querySelector('#er-children').value || '0',
            10
          ) || 0,
        is_influencer: isInfluencer,
        status: wrap.querySelector('#er-status').value,
        payment_status: wrap.querySelector('#er-pay').value,
        currency:
          wrap.querySelector('#er-currency').value.trim() || 'GHS',
        notes: wrap.querySelector('#er-notes').value || null,
      };

      let savedPrimaryReservation = null;
      const createdReservations = [];

      // For group bookings: handle room additions/removals
      if (isGroupBooking) {
        // If user removed rooms, we need to delete those reservations
        if (selectedRoomIds.length < allGroupReservations.length) {
          const removedReservations = allGroupReservations.slice(selectedRoomIds.length);
          for (const removedRes of removedReservations) {
            console.log('Deleting removed reservation:', removedRes.id);
            await supabase
              .from('reservations')
              .delete()
              .eq('id', removedRes.id);
          }
        }
      }

      // Calculate total room price for proportional discount distribution (like BookingWidget)
      const totalRoomPrice = perRoomSubtotals.reduce((sum, price) => sum + price, 0);

      // Insert/Update one reservation per selected cabin
      for (let index = 0; index < selectedRoomIds.length; index++) {
        const roomId = selectedRoomIds[index];
        const info = roomMap[String(roomId)] || {};
        const perRoomSubtotal = perRoomSubtotals[index] || 0;
        const isPrimary = index === 0;

        // ⭐ Calculate proportional room discount for THIS room (like BookingWidget)
        let roomOnlyDiscount = 0;
        let extrasOnlyDiscount = 0;
        
        if (isPrimary) {
          // Primary room carries extras discount
          extrasOnlyDiscount = extrasDiscount;
        }
        
        // Distribute room discount proportionally across all rooms
        if (roomDiscount > 0 && totalRoomPrice > 0) {
          const roomProportion = perRoomSubtotal / totalRoomPrice;
          roomOnlyDiscount = roomDiscount * roomProportion;
        }
        
        const totalRoomDiscount = roomOnlyDiscount + extrasOnlyDiscount;

        const extrasForThis = isPrimary ? extrasTotal : 0;
        const totalForThis = Math.max(
          0,
          perRoomSubtotal + extrasForThis - totalRoomDiscount
        );

        const adultsForThis = adultsPerRoom[index] || 0;

        const selectedPkgId = wrap.querySelector('#er-package')?.value || '';
        const selectedPkg = selectedPkgId
          ? pkgList.find(p => String(p.id) === String(selectedPkgId))
          : null;


        const reservationPayload = {
          ...commonPayload,
          adults: adultsForThis, // override with per-room adults
          // For updates: keep existing confirmation_code
          // For single bookings: use primary's code
          // For group inserts: will be set separately below
          confirmation_code: isGroupBooking && allGroupReservations[index]
            ? allGroupReservations[index].confirmation_code  // Keep existing for updates
            : (primaryReservation.confirmation_code || null), // Use for single bookings
          room_name: info.name || null,
          room_type_id: roomId,
          room_type_code: info.code || null,
          room_subtotal: perRoomSubtotal,
          extras_total: extrasForThis,
          discount_amount: totalRoomDiscount,              // Total discount for this room
          room_discount: roomOnlyDiscount,                 // Room portion only (proportional)
          extras_discount: extrasOnlyDiscount,             // Extras portion only
          package_code: selectedPkg ? (selectedPkg.code || null) : null,
          package_name: selectedPkg ? (selectedPkg.name || null) : null,

          coupon_code:
            isPrimary && appliedCoupon ? appliedCoupon.code : null,
          total: totalForThis,
        };

        // Determine operation: UPDATE existing or INSERT new
        // For group bookings: update if we have a matching original reservation, insert if new room added
        // For single bookings: always update the single ID
        let reservation;
        let reservationError;
        
        if (isGroupBooking && allGroupReservations[index]) {
          // Update existing reservation in group
          const updateResult = await supabase
            .from('reservations')
            .update(reservationPayload)
            .eq('id', allGroupReservations[index].id)
            .select()
            .single();
          reservation = updateResult.data;
          reservationError = updateResult.error;
        } else if (isGroupBooking && !allGroupReservations[index]) {
          // Insert new reservation (user added a room to the group)
          // Generate a unique confirmation code for the new room
          const newConfirmationCode = `${primaryReservation.group_reservation_code}-R${index + 1}`;
          
          const insertPayload = {
            ...reservationPayload,
            confirmation_code: newConfirmationCode,
            group_reservation_id: primaryReservation.group_reservation_id,
            group_reservation_code: primaryReservation.group_reservation_code,
          };
          const insertResult = await supabase
            .from('reservations')
            .insert(insertPayload)
            .select()
            .single();
          reservation = insertResult.data;
          reservationError = insertResult.error;
        } else {
          // Single booking: update the one reservation
          const updateResult = await supabase
            .from('reservations')
            .update(reservationPayload)
            .eq('id', id)
            .select()
            .single();
          reservation = updateResult.data;
          reservationError = updateResult.error;
        }

        if (reservationError) throw reservationError;
        if (isPrimary) savedPrimaryReservation = reservation;
        createdReservations.push(reservation);

        // Only attach extras to the primary reservation (with discount breakdown)
        if (isPrimary && extrasWithDiscounts.length > 0 && reservation) {
          const extrasPayload = extrasWithDiscounts.map((extra) => ({
            reservation_id: reservation.id,
            extra_code: extra.extra_code,
            extra_name: extra.extra_name,
            price: extra.price,
            quantity: extra.quantity,
            subtotal: extra.price * extra.quantity,
            discount_amount: extra.discount || 0  // ⭐ Match route.ts: discount_amount not discount
          }));

          // Delete old extras first
          await supabase
            .from('reservation_extras')
            .delete()
            .eq('reservation_id', id);

          // Insert new extras
          const { error: extrasError } = await supabase
            .from('reservation_extras')
            .insert(extrasPayload);

          if (extrasError) {
            console.error('Error saving extras:', extrasError);
          } else {
            console.log(`✅ Saved ${extrasPayload.length} extras to reservation_extras`);
          }
        }
      }

      // Update coupon usage once per booking (if applied)
      if (appliedCoupon && savedPrimaryReservation) {
        await supabase
          .from('coupons')
          .update({
            current_uses: (appliedCoupon.current_uses || 0) + 1,
          })
          .eq('id', appliedCoupon.id);
      }

      // If this is a group booking (more than one cabin), set group fields
      // --- Send confirmation email via Sojourn API (optional) ---
      const sendEmailCheckbox = wrap.querySelector('#er-send-email');
      if (
        sendEmailCheckbox &&
        sendEmailCheckbox.checked &&
        savedPrimaryReservation &&
        savedPrimaryReservation.guest_email
      ) {
        if (!SOJOURN_API_BASE_URL) {
          console.error(
            'SOJOURN_API_BASE_URL is not set – cannot send booking email.'
          );
        } else {
          try {
            // Fetch extras from database for all reservations
            const reservationIds = createdReservations.map(r => r.id);
            const { data: reservationExtras, error: extrasError } = await supabase
              .from('reservation_extras')
              .select('*')
              .in('reservation_id', reservationIds);

            if (extrasError) {
              console.error('Error fetching extras for email:', extrasError);
            }

            console.log(`Found ${reservationExtras?.length || 0} extras for email`);

            // Calculate aggregates for multi-room bookings
            const isGroupBooking = createdReservations.length > 1;
            let aggregateRoomSubtotal = 0;
            let aggregateExtrasSubtotal = 0;
            let aggregateDiscountTotal = 0;
            let aggregateTotal = 0;

            // Build rooms array with extras for each room
            const roomsForEmail = createdReservations.map((res) => {
              aggregateRoomSubtotal += res.room_subtotal || 0;
              aggregateExtrasSubtotal += res.extras_total || 0;
              aggregateDiscountTotal += res.discount_amount || 0;
              aggregateTotal += res.total || 0;

              const roomExtras = (reservationExtras || [])
                .filter((e) => e.reservation_id === res.id)
                .map((e) => ({
                  code: e.extra_code,
                  name: e.extra_name,
                  price: e.price,
                  qty: e.quantity,
                }));

              return {
                room_name: res.room_name,
                check_in: res.check_in,
                check_out: res.check_out,
                nights: res.nights,
                adults: res.adults,
                room_subtotal: res.room_subtotal,
                extras_total: res.extras_total,
                discount_amount: res.discount_amount,
                total: res.total,
                currency: res.currency,
                extras: roomExtras,
              };
            });

            // Use group code for groups, otherwise primary confirmation code
            // (savedPrimaryReservation can be null depending on update responses)
            const primaryForEmail = savedPrimaryReservation || (createdReservations && createdReservations[0]) || primaryReservation;
            const groupCodeForEmail = primaryForEmail?.group_reservation_code || null;

            const displayConfirmationCode =
              isGroupBooking && groupCodeForEmail
                ? groupCodeForEmail
                : (primaryForEmail?.confirmation_code || r.confirmation_code);

            // Build email data matching webhook structure
            const emailData = {
              booking: {
                confirmation_code: displayConfirmationCode,
                group_reservation_code: isGroupBooking ? groupCodeForEmail : null,

                guest_first_name: primaryForEmail?.guest_first_name,
                guest_last_name: primaryForEmail?.guest_last_name,
                guest_email: primaryForEmail?.guest_email,
                guest_phone: primaryForEmail?.guest_phone,

                check_in: primaryForEmail?.check_in,
                check_out: primaryForEmail?.check_out,
                nights: primaryForEmail?.nights,
                adults: primaryForEmail?.adults,
                currency: primaryForEmail?.currency,

                room_name: primaryForEmail?.room_name,
                room_subtotal: primaryForEmail?.room_subtotal,
                extras_total: primaryForEmail?.extras_total,
                discount_amount: primaryForEmail?.discount_amount,
                coupon_code: primaryForEmail?.coupon_code,
                total: primaryForEmail?.total,

                is_group_booking: isGroupBooking,
                group_room_subtotal: aggregateRoomSubtotal,
                group_extras_total: aggregateExtrasSubtotal,
                group_discount_total: aggregateDiscountTotal,
                group_total: aggregateTotal,

                rooms: isGroupBooking ? roomsForEmail : [roomsForEmail[0]],
                package_code: primaryForEmail?.package_code || null,
                package_name: primaryForEmail?.package_name || null,
              }
            };



            console.log('Sending email with', emailData.booking.rooms.length, 'room(s)');
            console.log('Primary room has', emailData.booking.rooms[0].extras?.length || 0, 'extras');

            const emailResponse = await fetch(
              `${SOJOURN_API_BASE_URL}/api/send-booking-email`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailData),
              }
            );
            
            
          // --- ALSO send the Experiences/Extras selection email ---
          // Route expects: { booking, extrasLink }
          try {
            const extrasLink = `${String(SOJOURN_API_BASE_URL || '').replace(/\/$/, '')}/extras?code=${encodeURIComponent(displayConfirmationCode || '')}`;

            const extrasEmailResponse = await fetch(
              `${SOJOURN_API_BASE_URL}/api/send-extras-selection-email`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  booking: emailData.booking,
                  extrasLink,
                }),
              }
            );

            if (!extrasEmailResponse.ok) {
              const errorText = await extrasEmailResponse.text();
              console.error('Extras selection email API error:', errorText);
            } else {
              console.log('✅ Extras selection email sent successfully');
            }
          } catch (err) {
            console.error('Failed to send extras selection email:', err);
          }


            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              console.error('Email API error:', errorText);
            } else {
              console.log('✅ Email sent successfully');
            }
          } catch (err) {
            console.error('Failed to send booking email:', err);
          }
        }
      }

      toast('Reservation updated');
      wrap.remove();
      loadReservations(); // Refresh the list

      // Refresh calendar/list
      if (typeof initReservations === 'function') {
        initReservations();
      }
    } catch (e) {
      alert('Error saving: ' + (e.message || e));
    }
  });

  } catch (error) {
    console.error('Error opening edit modal:', error);
    alert('Error loading reservation: ' + (error.message || error));
  }
}

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
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
          <div style="flex:1">
            <div style="font-weight:600">${res.guest_first_name || ''} ${res.guest_last_name || ''}</div>
            <div style="font-size:13px;color:#6b7280">
              ${res.room_name || res.room_type_code || 'Room'} • ${res.confirmation_code || ''}
            </div>
            <div style="font-size:13px;color:#6b7280">
              Check-in: ${res.check_in || ''} • Check-out: ${res.check_out || ''}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" data-res-edit="${res.id}">Edit</button>
            <button class="btn btn-sm" data-res-delete="${res.id}" style="color:#b91c1c">Delete</button>
          </div>
        </div>
      </div>
    `
    )
    .join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:60" id="calendar-date-popup">
      <div style="background:white;padding:24px;border-radius:16px;max-width:640px;width:100%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
        <h3 style="margin:0 0 10px 0">Reservations for ${dateDisplay}</h3>
        <p style="color:#6b7280;margin:0 0 16px 0">
          ${bookings.length} reservation${bookings.length === 1 ? '' : 's'}
        </p>
        ${reservationsList}
        <button class="btn" id="close-calendar-popup" style="margin-top:16px;width:100%">Close</button>
      </div>
    </div>
  `;

  const overlay = wrapper.firstElementChild;
  if (!overlay) return;

  // Close on background click
  overlay.addEventListener('click', () => {
    overlay.remove();
  });

  // Close button
  const closeBtn = overlay.querySelector('#close-calendar-popup');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove();
    });
  }

  // Attach edit/delete listeners EXACTLY like list view
  overlay.querySelectorAll('[data-res-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove(); // Close popup first
      reservationOpenEdit(btn.getAttribute('data-res-edit'));
    });
  });

  overlay.querySelectorAll('[data-res-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      reservationDelete(btn.getAttribute('data-res-delete'));
    });
  });

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
}

// ========== BLOCKED DATES EDIT/DELETE ==========

window.editBlockedDate = async function(blockedId, roomTypeId, blockedDate, reason) {
  try {
    // Load room types for dropdown
    const { data: rooms, error: roomsErr } = await supabase
      .from('room_types')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (roomsErr) throw roomsErr;

    const roomOptionsHtml = (rooms || []).map((rm) => {
      const selected = String(rm.id) === String(roomTypeId) ? 'selected' : '';
      return `<option value="${rm.id}" ${selected}>${(rm.code || '').toUpperCase()} — ${rm.name || ''}</option>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'edit-blocked-modal';
    modal.className = 'modal show';
    modal.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3>Edit Blocked Date</h3>
          <button class="btn" onclick="document.getElementById('edit-blocked-modal').remove()">×</button>
        </div>
        <div class="bd">
          <div class="form-group">
            <label>Cabin</label>
            <select id="edit-blocked-room">
              ${roomOptionsHtml}
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input id="edit-blocked-date" type="date" value="${blockedDate || ''}" />
          </div>
          <div class="form-group">
            <label>Reason</label>
            <select id="edit-blocked-reason">
              <option value="maintenance" ${reason === 'maintenance' ? 'selected' : ''}>Maintenance</option>
              <option value="staff holiday" ${reason === 'staff holiday' ? 'selected' : ''}>Staff holiday</option>
              <option value="other" ${reason === 'other' || (!reason || (reason !== 'maintenance' && reason !== 'staff holiday')) ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
        <div class="ft">
          <button class="btn" onclick="document.getElementById('edit-blocked-modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="save-blocked-btn">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#save-blocked-btn').addEventListener('click', async () => {
      const newRoomId = modal.querySelector('#edit-blocked-room').value;
      const newDate = modal.querySelector('#edit-blocked-date').value;
      const newReason = modal.querySelector('#edit-blocked-reason').value;

      if (!newRoomId || !newDate) {
        alert('Please select cabin and date');
        return;
      }

      const { error } = await supabase
        .from('blocked_dates')
        .update({
          room_type_id: newRoomId,
          blocked_date: newDate,
          reason: newReason
        })
        .eq('id', blockedId);

      if (error) {
        alert('Error updating blocked date: ' + (error.message || error));
        return;
      }

      toast('Blocked date updated successfully');
      modal.remove();
      await initReservations();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

  } catch (e) {
    alert('Error loading edit form: ' + (e.message || e));
  }
};

window.deleteBlockedDate = async function(blockedId) {
  if (!confirm('Are you sure you want to delete this blocked date?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('blocked_dates')
      .delete()
      .eq('id', blockedId);

    if (error) throw error;

    toast('Blocked date deleted successfully');
    await initReservations();
  } catch (e) {
    alert('Error deleting blocked date: ' + (e.message || e));
  }
};