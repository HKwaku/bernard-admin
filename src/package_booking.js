// src/package_booking.js
import { supabase } from './config/supabase.js';
import { toast } from './utils/helpers.js';
import { initReservations } from './reservations.js';
// Base URL of the Sojourn public site (for email API)
const SOJOURN_API_BASE_URL =
  'https://sojourn-cabins.vercel.app';



/* ---------- helpers (local copy, no changes to app.js) ---------- */

function genConfCode() {
  return (
    'B' +
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  ).toUpperCase();
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(iso, nights) {
  const d = new Date(iso);
  d.setDate(d.getDate() + (Number(nights) || 0));
  return toDateInput(d);
}

function diffNights(checkInISO, checkOutISO) {
  const ci = new Date(checkInISO);
  const co = new Date(checkOutISO);
  if (
    Number.isNaN(ci.getTime()) ||
    Number.isNaN(co.getTime()) ||
    co <= ci
  ) {
    return 0;
  }
  return Math.round((co - ci) / (1000 * 60 * 60 * 24));
}

// Availability check copied from app.js logic
async function isRoomAvailable(roomTypeId, roomTypeCode, checkInISO, checkOutISO) {
  if (!roomTypeId && !roomTypeCode) return false;
  if (!checkInISO || !checkOutISO) return false;

  const newStart = new Date(checkInISO);
  const newEnd = new Date(checkOutISO);
  if (
    Number.isNaN(newStart.getTime()) ||
    Number.isNaN(newEnd.getTime()) ||
    newEnd <= newStart
  ) {
    return false;
  }

  let data, error;
  try {
    const res = await supabase
      .from('reservations')
      .select('id, check_in, check_out, status, room_type_id, room_type_code')
      .not('status', 'in', '("cancelled","no_show")');

    data = res.data || [];
    error = res.error;
  } catch (err) {
    console.error('Availability check exception:', err);
    return false;
  }

  if (error) {
    console.error('Availability check error:', error);
    return false;
  }

  const idNum = roomTypeId != null ? Number(roomTypeId) : null;

  const relevant = data.filter((r) => {
    const sameId = idNum !== null && Number(r.room_type_id) === idNum;
    const sameCode = roomTypeCode && r.room_type_code === roomTypeCode;
    return sameId || sameCode;
  });

    const hasOverlap = relevant.some((r) => {
    if (!r.check_in || !r.check_out) return false;
    const existingStart = new Date(r.check_in);
    const existingEnd = new Date(r.check_out);
    if (
      Number.isNaN(existingStart.getTime()) ||
      Number.isNaN(existingEnd.getTime())
    ) {
      return false;
    }
    return existingStart < newEnd && existingEnd > newStart;
  });

  if (hasOverlap) {
    // already booked
    return false;
  }

  // --- ALSO TREAT BLOCKED DATES AS UNAVAILABLE ---
  try {
    if (roomTypeId != null) {
      const { data: blocked, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('id, room_type_id, blocked_date')
        .eq('room_type_id', roomTypeId)
        .gte('blocked_date', checkInISO)
        .lt('blocked_date', checkOutISO); // [in, out)

      if (blockedError) {
        console.error('Blocked dates check error (package booking):', blockedError);
      } else if (blocked && blocked.length > 0) {
        return false;
      }
    }
  } catch (err) {
    console.error('Blocked dates check exception (package booking):', err);
  }

  return true;
}


/* ---------- Book New Package ---------- */

export async function openBookPackageModal() {
  // clean up any existing instance
  document.getElementById('package-booking-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'package-booking-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  // close on backdrop click
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  // 1) Load active packages
  const { data: packages, error: pkgErr } = await supabase
    .from('packages')
    .select('id, code, name, package_price, currency, nights, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (pkgErr) {
    wrap.remove();
    alert('Error loading packages: ' + pkgErr.message);
    return;
  }
  if (!packages || !packages.length) {
    wrap.remove();
    alert('No active packages available.');
    return;
  }

  const pkgIds = packages.map((p) => p.id);
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  // 2) Load rooms linked to packages (packages_rooms + room_types)
  const { data: pkgRooms } = await supabase
    .from('packages_rooms')
    .select('package_id, room_type_id')
    .in('package_id', pkgIds);

  const roomIds = Array.from(
    new Set((pkgRooms || []).map((pr) => pr.room_type_id).filter(Boolean))
  );

  let roomsById = new Map();
  if (roomIds.length) {
    const { data: rooms } = await supabase
      .from('room_types')
      .select('id, code, name')
      .in('id', roomIds);

    roomsById = new Map((rooms || []).map((r) => [r.id, r]));
  }

  const roomsByPackage = new Map();
  (pkgRooms || []).forEach((pr) => {
    const room = roomsById.get(pr.room_type_id);
    if (!room) return;
    const arr = roomsByPackage.get(pr.package_id) || [];
    arr.push(room);
    roomsByPackage.set(pr.package_id, arr);
  });

  // 3) Load extras linked to packages (package_extras + extras)
  const { data: pkgExtras } = await supabase
    .from('package_extras')
    .select('package_id, extra_id, quantity, code')
    .in('package_id', pkgIds);

  const extraIds = Array.from(
    new Set((pkgExtras || []).map((px) => px.extra_id).filter(Boolean))
  );

  let extrasById = new Map();
  if (extraIds.length) {
    const { data: extras } = await supabase
      .from('extras')
      .select('id, name, price, currency, code')
      .in('id', extraIds);

    extrasById = new Map((extras || []).map((e) => [e.id, e]));
  }

  const extrasByPackage = new Map();
  (pkgExtras || []).forEach((px) => {
    const ex = extrasById.get(px.extra_id);
    if (!ex) return;
    const arr = extrasByPackage.get(px.package_id) || [];
    arr.push({
      extra_id: px.extra_id,
      quantity: px.quantity || 1,
      code: px.code || ex.code || '',
      name: ex.name || '',
      price: ex.price || 0,
      currency: ex.currency || pkgMap.get(px.package_id)?.currency || 'GHS',
    });
    extrasByPackage.set(px.package_id, arr);
  });

  const packageOptions = packages
    .map(
      (p) => `
      <option value="${p.id}">
        ${(p.code || '').toUpperCase()} — ${p.name}
      </option>`
    )
    .join('');

  const today = toDateInput(new Date());

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()">
      <div class="hd">
        <h3>Book New Package</h3>
        <button class="btn" onclick="document.getElementById('package-booking-modal').remove()">×</button>
      </div>

      <div class="bd">
        <div class="form-group">
          <label>Package</label>
          <select id="pb-package">
            ${packageOptions}
          </select>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Room Type</label>
            <select id="pb-room"></select>
          </div>
          <div class="form-group">
            <label>Nights (auto)</label>
            <input id="pb-nights" type="number" readonly style="background:#f3f4f6" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Check-in</label>
            <input id="pb-in" type="date" value="${today}" />
          </div>
          <div class="form-group">
            <label>Check-out</label>
            <input id="pb-out" type="date" value="${today}" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>First Name</label>
            <input id="pb-first" type="text" />
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input id="pb-last" type="text" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Email</label>
            <input id="pb-email" type="email" />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input id="pb-phone" type="text" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Adults</label>
            <input id="pb-adults" type="number" min="1" step="1" value="1" />
          </div>
          <div class="form-group">
            <label>Children</label>
            <input id="pb-children" type="number" min="0" step="1" value="0" />
          </div>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="pb-notes" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="pb-send-email" type="checkbox" style="width:auto" />
            <span>Send confirmation email to guest</span>
          </label>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--ring);border-radius:var(--radius-md);padding:12px;margin-top:12px">
          <div style="font-weight:700;font-size:0.875rem;margin-bottom:8px;color:var(--ink)">Price Breakdown</div>
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:4px">
            <span style="color:var(--muted)">Room Subtotal:</span>
            <span id="pb-room-subtotal-val">GHS 0.00</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.875rem;margin-bottom:4px">
            <span style="color:var(--muted)">Extras:</span>
            <span id="pb-extras-total-val">GHS 0.00</span>
          </div>
          <div style="border-top:2px solid var(--ring);margin:8px 0;padding-top:8px;display:flex;justify-content:space-between;font-size:0.95rem">
            <span style="font-weight:800">Total Package Price:</span>
            <span id="pb-total-val" style="font-weight:800;color:var(--brand)">GHS 0.00</span>
          </div>
          <div id="pb-extra-lines" style="margin-top:6px;font-size:0.8rem;color:#4b5563"></div>
        </div>
      </div>

      <div class="ft">
        <button class="btn" onclick="document.getElementById('package-booking-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="pb-save">Save Booking</button>
      </div>
    </div>
  `;

  const pkgSel = wrap.querySelector('#pb-package');
  const roomSel = wrap.querySelector('#pb-room');
  const inEl = wrap.querySelector('#pb-in');
  const outEl = wrap.querySelector('#pb-out');
  const nightsEl = wrap.querySelector('#pb-nights');
  const roomSubtotalDisplay = wrap.querySelector('#pb-room-subtotal-val');
  const extrasTotalDisplay = wrap.querySelector('#pb-extras-total-val');
  const totalDisplay = wrap.querySelector('#pb-total-val');
  const extraLines = wrap.querySelector('#pb-extra-lines');

  function getSelectedPackage() {
    const id = pkgSel.value;
    return pkgMap.get(id) || null;
  }

  function hydrateRoomsForPackage() {
    const pkg = getSelectedPackage();
    if (!pkg) return;
    const rooms = roomsByPackage.get(pkg.id) || [];

    if (!rooms.length) {
      roomSel.innerHTML =
        '<option value="">No room types linked to this package</option>';
      return;
    }

    roomSel.innerHTML = rooms
      .map(
        (r) =>
          `<option value="${r.id}" data-code="${r.code || ''}" data-name="${r.name || ''}">
            ${(r.code || '').toUpperCase()} – ${r.name || ''}
          </option>`
      )
      .join('');
  }

  function updateDatesAndNightsFromPackage() {
    const pkg = getSelectedPackage();
    if (!pkg) return;
    const baseNights = pkg.nights || 1;

    // Keep check-in as-is, adjust check-out based on baseNights
    if (!inEl.value) inEl.value = today;
    outEl.value = addDaysISO(inEl.value, baseNights);

    const nights = diffNights(inEl.value, outEl.value);
    nightsEl.value = nights > 0 ? String(nights) : '';
  }

  function updatePriceBreakdown() {
    const pkg = getSelectedPackage();
    if (!pkg) return;
    const cur = pkg.currency || 'GHS';
    const extras = extrasByPackage.get(pkg.id) || [];

    const extrasTotal = extras.reduce(
      (sum, e) => sum + (e.price || 0) * (e.quantity || 1),
      0
    );
    const packagePrice = Number(pkg.package_price || 0);
    let roomSubtotal = packagePrice - extrasTotal;
    if (roomSubtotal < 0) roomSubtotal = 0;

    roomSubtotalDisplay.textContent = `${cur} ${roomSubtotal.toFixed(2)}`;
    extrasTotalDisplay.textContent = `${cur} ${extrasTotal.toFixed(2)}`;
    totalDisplay.textContent = `${cur} ${packagePrice.toFixed(2)}`;

    if (extras.length) {
      extraLines.innerHTML =
        extras
          .map(
            (e) =>
              `${e.quantity} × ${e.name} – ${cur} ${(e.price || 0).toFixed(2)}`
          )
          .join('<br>') || '';
    } else {
      extraLines.innerHTML = '<em>No extras included in this package.</em>';
    }
  }

  // initial hydrate
  hydrateRoomsForPackage();
  updateDatesAndNightsFromPackage();
  updatePriceBreakdown();

  pkgSel.addEventListener('change', () => {
    hydrateRoomsForPackage();
    updateDatesAndNightsFromPackage();
    updatePriceBreakdown();
  });

  inEl.addEventListener('change', () => {
    const pkg = getSelectedPackage();
    if (!pkg) return;
    const baseNights = pkg.nights || 1;
    outEl.value = addDaysISO(inEl.value, baseNights);
    const nights = diffNights(inEl.value, outEl.value);
    nightsEl.value = nights > 0 ? String(nights) : '';
  });

  outEl.addEventListener('change', () => {
    const nights = diffNights(inEl.value, outEl.value);
    nightsEl.value = nights > 0 ? String(nights) : '';
  });

  // Save booking
  wrap.querySelector('#pb-save').addEventListener('click', async () => {
    try {
      const pkg = getSelectedPackage();
      if (!pkg) {
        alert('Please select a package.');
        return;
      }

      const rooms = roomsByPackage.get(pkg.id) || [];
      if (!rooms.length) {
        alert('This package has no room types linked.');
        return;
      }

      const roomOpt = roomSel.selectedOptions[0];
      if (!roomOpt) {
        alert('Please select a room type.');
        return;
      }

      const roomTypeId = roomOpt.value;
      const roomTypeCode = roomOpt.getAttribute('data-code') || null;
      const roomName = roomOpt.getAttribute('data-name') || null;

      if (!inEl.value || !outEl.value) {
        alert('Please select both check-in and check-out dates.');
        return;
      }

      const nights = diffNights(inEl.value, outEl.value);
      if (nights <= 0) {
        alert('Check-out must be after check-in.');
        return;
      }

      const baseNights = pkg.nights || 1;
      if (nights % baseNights !== 0) {
        alert(
          `This package is valid only for multiples of ${baseNights} night(s). ` +
            `You selected ${nights} night(s).`
        );
        return;
      }

      // Availability
      const isFree = await isRoomAvailable(
        roomTypeId,
        roomTypeCode,
        inEl.value,
        outEl.value
      );

      if (!isFree) {
        alert('This cabin is NOT available for the selected dates.');
        return;
      }

      // Pricing
      const extras = extrasByPackage.get(pkg.id) || [];
      const extrasTotal = extras.reduce(
        (sum, e) => sum + (e.price || 0) * (e.quantity || 1),
        0
      );
      const packagePrice = Number(pkg.package_price || 0);
      let roomSubtotal = packagePrice - extrasTotal;
      if (roomSubtotal < 0) roomSubtotal = 0;

      const currency = pkg.currency || 'GHS';

      // Insert reservation
      const reservationPayload = {
        confirmation_code: genConfCode(),
        guest_first_name: wrap
          .querySelector('#pb-first')
          .value.trim() || null,
        guest_last_name: wrap
          .querySelector('#pb-last')
          .value.trim() || null,
        guest_email: wrap.querySelector('#pb-email').value.trim() || null,
        guest_phone: wrap.querySelector('#pb-phone').value.trim() || null,
        check_in: inEl.value,
        check_out: outEl.value,
        nights,
        adults:
          parseInt(
            wrap.querySelector('#pb-adults').value || '0',
            10
          ) || 0,
        children:
          parseInt(
            wrap.querySelector('#pb-children').value || '0',
            10
          ) || 0,
        status: 'confirmed',
        payment_status: 'unpaid',
        currency,
        room_type_id: roomTypeId,
        room_type_code: roomTypeCode,
        room_name: roomName,
        package_id: pkg.id,
        room_subtotal: roomSubtotal,
        extras_total: extrasTotal,
        discount_amount: 0, // implicit discount is baked into room_subtotal
        total: packagePrice,
        notes: wrap.querySelector('#pb-notes').value || null,
      };

      const { data: reservation, error: resErr } = await supabase
        .from('reservations')
        .insert(reservationPayload)
        .select()
        .single();

      if (resErr) throw resErr;

      // Insert reservation_extras
      if (reservation && extras.length) {
        const extrasRows = extras.map((e) => ({
          reservation_id: reservation.id,
          extra_id: e.extra_id,
          extra_code: e.code || null,
          extra_name: e.name || null,
          price: e.price || 0,
          quantity: e.quantity || 1,
          subtotal: (e.price || 0) * (e.quantity || 1),
        }));

        const { error: rxErr } = await supabase
          .from('reservation_extras')
          .insert(extrasRows);

        if (rxErr) {
          console.error('Error saving reservation extras:', rxErr);
        }
      }

      // --- Send confirmation email via Sojourn API (optional) ---
      const sendEmailCheckbox = wrap.querySelector('#pb-send-email');
      if (
        sendEmailCheckbox &&
        sendEmailCheckbox.checked &&
        reservation &&
        reservation.guest_email
      ) {
        if (!SOJOURN_API_BASE_URL) {
          console.error(
            'SOJOURN_API_BASE_URL is not set – cannot send booking email.'
          );
        } else {
          const bookingForEmail = {
            // everything from the reservation record we just inserted
            ...reservation,
            // enrich with package info
            package_name: pkg.name,
            package_code: pkg.code,
            packageExtras: (extras || []).map((e) => ({
              name: e.name,
              quantity: e.quantity || 1,
            })),
          };



          try {
            const emailResponse = await fetch(
              `${SOJOURN_API_BASE_URL}/api/send-booking-email`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking: bookingForEmail }),
              }
            );

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              console.error('Email API error:', errorText);
            }
          } catch (err) {
            console.error('Failed to send booking email:', err);
          }
        }
      }
      toast('Package booking created');
      wrap.remove();
      initReservations?.();
    } catch (err) {
      alert('Error saving booking: ' + (err.message || err));
    }
  });
}