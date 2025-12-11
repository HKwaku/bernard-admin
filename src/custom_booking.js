// src/custom_booking.js
// Custom Booking Modal for Sojourn Cabins

import { supabase } from './config/supabase.js';
import { toast } from './utils/helpers.js';
import { initReservations } from './reservations.js';
// Base URL of the Sojourn public site (for email API)
const SOJOURN_API_BASE_URL =
  'https://sojourn-cabins.vercel.app';




// ===== HELPER FUNCTIONS =====

// --------- SHARED: compute disabled CHECK-IN dates (no rooms free) ---------
async function loadDisabledCheckinDatesForAllRooms() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizonEnd = new Date(today);
    // 1-year horizon like the widget
    horizonEnd.setFullYear(horizonEnd.getFullYear() + 1);

    const horizonStartISO = today.toISOString().slice(0, 10);
    const horizonEndISO = horizonEnd.toISOString().slice(0, 10);

    // Load all active room types
    const { data: rooms, error: roomErr } = await supabase
      .from('room_types')
      .select('id, code')
      .eq('is_active', true);

    if (roomErr || !Array.isArray(rooms) || rooms.length === 0) {
      console.warn('loadDisabledCheckinDatesForAllRooms: no rooms or error', roomErr);
      return new Set();
    }

    // Build occupancy lookup per room
    const roomKeyById = {};
    const roomKeyByCode = {};
    const occupancy = {};

    rooms.forEach((room) => {
      const key = String(room.id);
      occupancy[key] = new Set();
      roomKeyById[String(room.id)] = key;
      if (room.code) roomKeyByCode[String(room.code)] = key;
    });

    // Reservations overlapping the horizon
    const { data: reservations, error: resErr } = await supabase
      .from('reservations')
      .select('room_type_id, room_type_code, check_in, check_out, status')
      .lt('check_in', horizonEndISO)
      .gt('check_out', horizonStartISO)
      .not('status', 'in', '("cancelled","no_show")');

    if (!resErr && Array.isArray(reservations)) {
      reservations.forEach((r) => {
        const keyFromId =
          r.room_type_id != null ? roomKeyById[String(r.room_type_id)] : null;
        const keyFromCode = r.room_type_code
          ? roomKeyByCode[String(r.room_type_code)]
          : null;
        const key = keyFromId || keyFromCode;
        if (!key || !r.check_in || !r.check_out) return;

        const start = new Date(r.check_in + 'T00:00:00');
        const end = new Date(r.check_out + 'T00:00:00');

        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          const dStr = d.toISOString().slice(0, 10);
          occupancy[key].add(dStr);
        }
      });
    }

    // Blocked dates
    const roomIds = rooms.map((r) => r.id).filter((id) => id != null);
    if (roomIds.length) {
      const { data: blocked, error: blkErr } = await supabase
        .from('blocked_dates')
        .select('room_type_id, blocked_date')
        .in('room_type_id', roomIds);

      if (!blkErr && Array.isArray(blocked)) {
        blocked.forEach((b) => {
          const key = roomKeyById[String(b.room_type_id)];
          if (!key || !b.blocked_date) return;
          occupancy[key].add(b.blocked_date);
        });
      }
    }

    // For each potential check-in date in horizon, disable if NO room is free
    const disabled = new Set();
    const cursor = new Date(today);

    while (cursor <= horizonEnd) {
      const ciStr = cursor.toISOString().slice(0, 10);

      let hasAvailableRoom = false;
      for (const room of rooms) {
        const key = String(room.id);
        const occ = occupancy[key] || new Set();
        if (!occ.has(ciStr)) {
          hasAvailableRoom = true;
          break;
        }
      }

      if (!hasAvailableRoom) {
        disabled.add(ciStr);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return disabled;
  } catch (e) {
    console.error('loadDisabledCheckinDatesForAllRooms error', e);
    return new Set();
  }
}

function genConfCode() {
  return ('B' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)).toUpperCase();
}

function toDateInput(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function addDaysISO(isoDate, nights) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + (Number(nights)||0));
  return toDateInput(d);
}

// Prevent double booking: correct date overlap check
async function isRoomAvailable(roomTypeId, roomTypeCode, checkInISO, checkOutISO) {
  if (!roomTypeId && !roomTypeCode) return false;
  if (!checkInISO || !checkOutISO) return false;

  const newStart = new Date(checkInISO);
  const newEnd   = new Date(checkOutISO);

  if (
    Number.isNaN(newStart.getTime()) ||
    Number.isNaN(newEnd.getTime())
  ) {
    console.error('Invalid dates passed to isRoomAvailable', {
      checkInISO,
      checkOutISO,
    });
    return false;
  }

  // safety net – check-out must be after check-in
  if (newEnd <= newStart) {
    return false;
  }

  let data, error;
  try {
    const res = await supabase
      .from('reservations')
      .select('id, check_in, check_out, status, room_type_id, room_type_code')
      .not('status', 'in', '("cancelled","no_show")'); // include all active stays

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

  // Only compare bookings for this specific cabin (same id OR same code)
  const relevant = data.filter((r) => {
    const sameId   = idNum !== null && Number(r.room_type_id) === idNum;
    const sameCode = roomTypeCode && r.room_type_code === roomTypeCode;
    return sameId || sameCode;
  });

  // Treat stays as half-open ranges [check_in, check_out)
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
        .lt('blocked_date', checkOutISO); // half-open [in, out)

      if (blockedError) {
        console.error('Blocked dates check error (custom booking):', blockedError);
      } else if (blocked && blocked.length > 0) {
        // there is at least one blocked day in the range
        return false;
      }
    }
  } catch (err) {
    console.error('Blocked dates check exception (custom booking):', err);
  }

  // Available only if there is NO overlapping stay and NO blocked dates
  return true;
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

// ===== MAIN CUSTOM BOOKING MODAL =====

export async function openNewCustomBookingModal() {
  // Ensure we never stack multiple modals
  const old = document.getElementById('reservation-modal');
  if (old) old.remove();

  const wrap = document.createElement('div');
  // Reuse reservation modal styling so you don't need new CSS
  wrap.id = 'reservation-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);
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

  const roomOptions = (rooms || []).map(r =>
    `<option value="${r.id}" data-code="${r.code}" data-name="${r.name}">
     ${r.name} (${r.code})
   </option>`
  ).join('');

  const extrasHtml = (extras || [])
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
  let appliedCoupon = null;
  let selectedExtras = [];

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()">
      <div class="hd">
        <h3>New Custom Booking</h3>
        <button class="btn" onclick="document.getElementById('reservation-modal').remove()">×</button>
      </div>

      <div class="bd">
        <div class="form-grid">
          <div class="form-group">
            <label>First Name</label>
            <input id="nb-first" type="text" />
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input id="nb-last" type="text" />
          </div>
        </div>

        <div class="form-group">
          <label>Email</label>
          <input id="nb-email" type="email" />
        </div>

        <div class="form-group">
          <label>Phone</label>
          <div style="display:flex;gap:8px;align-items:flex-start;width:100%">
            ${buildCountrySelectHtml("nb-country-code", "+233")}
            <input id="nb-phone" type="text" style="flex:1" />
          </div>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:4px;">
            <span>Influencer?</span>
            <input
              type="checkbox"
              id="nb-influencer"
              style="width:auto;flex-shrink:0;margin-left:2px"
            />
          </label>
        </div>

        <div class="form-grid">
          <div class="form-group" style="min-width:0">
            <label>Cabins (select one or more)</label>
            <div
              id="nb-rooms-list"
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
              ${
                (rooms || []).length
                  ? (rooms || [])
                      .map(
                        (r) => `
                          <label class="nb-room-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
                            <input 
                              type="checkbox" 
                              class="nb-room-checkbox" 
                              value="${r.id}" 
                              data-code="${r.code || ''}" 
                              data-name="${r.name || ''}"
                              style="width:auto"
                            />
                            <span>${(r.code || '').toUpperCase()} – ${r.name || ''}</span>
                          </label>

                        `
                      )
                      .join('')
                  : '<div class="muted">No room types available</div>'
              }
            </div>
          </div>
          <div class="form-group">
            <label>Currency</label>
            <input id="nb-currency" type="text" value="GHS" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Check-in</label>
            <input id="nb-in" type="date" value="${today}" />
          </div>
          <div class="form-group">
            <label>Check-out</label>
            <input id="nb-out" type="date" value="${addDaysISO(today,1)}" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Nights (auto-calculated)</label>
            <input id="nb-nights" type="number" min="1" step="1" value="1" readonly style="background:#f5f5f5" />
          </div>
          <!-- keep subtotal only as a hidden input so save logic still works -->
          <div class="form-group" style="display:none">
            <input id="nb-room-subtotal" type="hidden" value="" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Adults</label>
            <input id="nb-adults" type="number" min="1" step="1" value="1" />
          </div>
          <div class="form-group">
            <label>Children</label>
            <input id="nb-children" type="number" min="0" step="1" value="0" />
          </div>
        </div>

        <div class="form-group">
          <label>Extras (Optional)</label>
          <div style="border:1px solid var(--ring);border-radius:var(--radius-md);padding:10px;max-height:260px;overflow-y:auto">
            ${extrasHtml || '<div class="muted">No extras available</div>'}
          </div>
        </div>

        <div class="form-group">
          <label>Coupon Code (Optional)</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="nb-coupon" type="text" placeholder="Enter coupon code" style="text-transform:uppercase;flex:1" />
            <button class="btn btn-sm" id="apply-coupon-btn" type="button">Apply</button>
          </div>
          <div id="coupon-msg" style="margin-top:4px;font-size:0.875rem;min-height:18px"></div>
          <div id="applied-coupon-display" style="margin-top:8px"></div>
        </div>

        <!-- Price Breakdown -->
        <div style="background:#f8fafc;border:1px solid var(--ring);border-radius:var(--radius-md);padding:14px;margin-top:12px">
          <div style="font-weight:700;font-size:0.875rem;margin-bottom:10px;color:var(--ink)">Price Breakdown</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.875rem">
            <span style="color:var(--muted)">Room Subtotal:</span>
            <span id="calc-room-subtotal" style="font-weight:600">GHS 0.00</span>
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
            <select id="nb-status">
              <option value="pending">Pending</option>
              <option value="confirmed" selected>Confirmed</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="form-group">
            <label>Payment Status</label>
            <select id="nb-pay">
              <option value="unpaid" selected>Unpaid</option>
              <option value="partial">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="nb-notes" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="nb-send-email" type="checkbox" style="width:auto" />
            <span>Send confirmation email to guest</span>
          </label>
        </div>
      </div>

      <div class="ft">
        <button class="btn" onclick="document.getElementById('reservation-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nb-save">Save</button>
      </div>

  `;

  function getSelectedRoomIds() {
    return Array.from(
      wrap.querySelectorAll('.nb-room-checkbox:checked')
    ).map((cb) => cb.value);
  }

  const extraQuantities = {}; // { extraId: qty }

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
  attachCountrySearch('nb-country-code');

  const inEl = wrap.querySelector('#nb-in');
  const outEl = wrap.querySelector('#nb-out');
  const nightsEl = wrap.querySelector('#nb-nights');
  const roomSubtotalEl = wrap.querySelector('#nb-room-subtotal');

  // --- Room pricing helpers (weekday/weekend split, multiple cabins) ---
  const roomMap = Object.fromEntries((rooms || []).map((r) => [String(r.id), r]));

  function isWeekend(d) {
    // Friday (5) and Saturday (6) are weekend nights in the widget logic
    const dow = d.getDay();
    return dow === 5 || dow === 6;
  }

  function computeRoomSubtotal() {
    const selectedRoomIds = getSelectedRoomIds();
    const ci = new Date(inEl.value);
    const co = new Date(outEl.value);

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

    let totalSubtotal = 0;

    selectedRoomIds.forEach((roomId) => {
      const info = roomMap[String(roomId)];
      if (!info) return;

      const wkdPrice = Number(info.base_price_per_night_weekday || 0);
      const wkePrice = Number(info.base_price_per_night_weekend || 0);
      totalSubtotal += weekdayN * wkdPrice + weekendN * wkePrice;
    });

    roomSubtotalEl.value = String(totalSubtotal.toFixed(2));
    updatePriceBreakdown();
  }

  // Auto-calculate nights when dates change
  function calculateNights() {
    const checkIn = new Date(inEl.value);
    const checkOut = new Date(outEl.value);

    if (checkIn && checkOut && checkOut > checkIn) {
      nightsEl.value = Math.ceil(
        (checkOut - checkIn) / (1000 * 60 * 60 * 24)
      );
    } else {
      nightsEl.value = 1;
    }

    // Recompute pricing after nights change
    computeRoomSubtotal();
  }

  // Calculate price breakdown
  function updatePriceBreakdown() {
    const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
    const currency = wrap.querySelector('#nb-currency').value || 'GHS';

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

    // Update display
    wrap.querySelector('#calc-room-subtotal').textContent =
      `${currency} ${roomSubtotal.toFixed(2)}`;
    wrap.querySelector('#calc-extras-total').textContent =
      `${currency} ${extrasTotal.toFixed(2)}`;

    if (discount > 0 && appliedCoupon) {
      wrap.querySelector('#calc-discount-row').style.display = 'flex';
      wrap.querySelector('#calc-discount-label').textContent = appliedCoupon.code;
      wrap.querySelector('#calc-discount').textContent =
        `−${currency} ${discount.toFixed(2)}`;
    } else {
      wrap.querySelector('#calc-discount-row').style.display = 'none';
    }

    wrap.querySelector('#calc-total').textContent =
      `${currency} ${finalTotal.toFixed(2)}`;
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
  inEl.addEventListener('change', () => {
    // Auto-set checkout to check-in + 1 day
    if (inEl.value) {
      outEl.value = addDaysISO(inEl.value, 1);
    }
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
    if (e.target.classList.contains('nb-room-checkbox')) {
      computeRoomSubtotal();
    }
  });

  // Initial compute after modal opens
  computeRoomSubtotal();
  
  // Apply coupon button
  wrap.querySelector('#apply-coupon-btn').addEventListener('click', async () => {
    const code = wrap.querySelector('#nb-coupon').value.trim();
    const msgEl = wrap.querySelector('#coupon-msg');
    const displayEl = wrap.querySelector('#applied-coupon-display');
    const btn = wrap.querySelector('#apply-coupon-btn');
    
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
      
      // Show applied coupon with remove button
      const discountText = appliedCoupon.discount_type === 'percentage'
        ? `${appliedCoupon.discount_value}% off`
        : `GHS ${appliedCoupon.discount_value} off`;

      // Human-friendly scope label (with specific extra names)
      let scopeLabel;
      if (appliedCoupon.applies_to === 'both') {
        // Room + specific extras if configured
        let labels = [];

        if (Array.isArray(appliedCoupon.extra_ids) && appliedCoupon.extra_ids.length) {
          labels = appliedCoupon.extra_ids
            .map(id => extraNameMap[String(id)])
            .filter(Boolean);
        }

        if (labels.length === 0) {
          // No specific extras configured → generic
          scopeLabel = 'Room and Extras';
        } else if (labels.length === 1) {
          scopeLabel = `Room and ${labels[0]}`;
        } else if (labels.length === 2) {
          scopeLabel = `Room and ${labels[0]} and ${labels[1]}`;
        } else {
          scopeLabel = `Room and ${labels.slice(0, 2).join(', ')} and others`;
        }
      } else if (appliedCoupon.applies_to === 'rooms') {
        scopeLabel = 'Room Only';
      } else if (appliedCoupon.applies_to === 'extras') {
        let labels = [];

        if (Array.isArray(appliedCoupon.extra_ids) && appliedCoupon.extra_ids.length) {
          labels = appliedCoupon.extra_ids
            .map(id => extraNameMap[String(id)])
            .filter(Boolean);
        }

        if (labels.length === 0) {
          scopeLabel = 'Extras';
        } else if (labels.length === 1) {
          scopeLabel = labels[0];
        } else if (labels.length === 2) {
          scopeLabel = `${labels[0]} and ${labels[1]}`;
        } else {
          scopeLabel = `${labels.slice(0, 2).join(', ')} and others`;
        }
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
        wrap.querySelector('#nb-coupon').value = '';
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

  calculateNights(); // Initial calculation

  wrap.querySelector('#nb-save').addEventListener('click', async () => {
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

      // ---- AVAILABILITY CHECK FOR EACH CABIN ----
      for (const roomId of selectedRoomIds) {
        const info = roomMap[String(roomId)] || {};
        const roomTypeCode = info.code || null;
        const available = await isRoomAvailable(
          roomId,
          roomTypeCode,
          inEl.value,
          outEl.value
        );

        if (!available) {
          alert(
            `${info.name || 'One of the selected cabins'} is NOT available for the selected dates.`
          );
          return;
        }
      }

      // ---- PRICING (recompute per-cabin subtotals) ----
      const ci = new Date(inEl.value);
      const co = new Date(outEl.value);

      let weekdayN = 0;
      let weekendN = 0;
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        if (isWeekend(d)) weekendN++;
        else weekdayN++;
      }

            const perRoomSubtotals = selectedRoomIds.map((roomId) => {
        const info = roomMap[String(roomId)] || {};
        const wkdPrice = Number(info.base_price_per_night_weekday || 0);
        const wkePrice = Number(info.base_price_per_night_weekend || 0);
        return weekdayN * wkdPrice + weekendN * wkePrice;
      });

      const roomSubtotal =
        perRoomSubtotals.reduce((sum, v) => sum + v, 0) || 0;
      roomSubtotalEl.value = String(roomSubtotal.toFixed(2));

      // ----- DISTRIBUTE ADULTS ACROSS ROOMS -----
      const totalAdults =
        parseInt(
          wrap.querySelector('#nb-adults').value || '0',
          10
        ) || 0;

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

      const extrasTotal = selectedExtras.reduce(
        (sum, e) => sum + e.price * e.quantity,
        0
      );

      // ---- DISCOUNT (unchanged, based on overall totals) ----
      let discount = 0;
      if (appliedCoupon) {
        const subtotal = roomSubtotal + extrasTotal;

        if (appliedCoupon.applies_to === 'both') {
          let base;
          if (
            Array.isArray(appliedCoupon.extra_ids) &&
            appliedCoupon.extra_ids.length
          ) {
            const idSet = new Set(appliedCoupon.extra_ids.map(String));
            const targetedExtrasTotal = selectedExtras
              .filter((e) => idSet.has(String(e.extra_id)))
              .reduce(
                (sum, e) => sum + e.price * e.quantity,
                0
              );

            base = roomSubtotal + targetedExtrasTotal;
          } else {
            base = roomSubtotal + extrasTotal;
          }
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        } else if (appliedCoupon.applies_to === 'rooms') {
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (roomSubtotal * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        } else if (appliedCoupon.applies_to === 'extras') {
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (extrasTotal * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;
        }

        discount = Math.min(discount, roomSubtotal + extrasTotal);
      }

      const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);
      const isInfluencer = wrap.querySelector('#nb-influencer').checked;

      // Common data for all reservations
      const commonPayload = {
        guest_first_name:
          wrap.querySelector('#nb-first').value.trim() || null,
        guest_last_name:
          wrap.querySelector('#nb-last').value.trim() || null,
        guest_email:
          wrap.querySelector('#nb-email').value.trim() || null,
        country_code:
          wrap.querySelector('#nb-country-code')?.value || null,
        guest_phone:
          wrap.querySelector('#nb-phone').value.trim() || null,
        check_in: wrap.querySelector('#nb-in').value || null,
        check_out: wrap.querySelector('#nb-out').value || null,
        nights:
          parseInt(
            wrap.querySelector('#nb-nights').value || '0',
            10
          ) || 0,
        adults:
          parseInt(
            wrap.querySelector('#nb-adults').value || '0',
            10
          ) || 0,
        children:
          parseInt(
            wrap.querySelector('#nb-children').value || '0',
            10
          ) || 0,
        is_influencer: isInfluencer,
        status: wrap.querySelector('#nb-status').value,
        payment_status: wrap.querySelector('#nb-pay').value,
        currency:
          wrap.querySelector('#nb-currency').value.trim() || 'GHS',
        notes: wrap.querySelector('#nb-notes').value || null,
      };

      let primaryReservation = null;
      const createdReservations = [];

            // Insert one reservation per selected cabin
      for (let index = 0; index < selectedRoomIds.length; index++) {
        const roomId = selectedRoomIds[index];
        const info = roomMap[String(roomId)] || {};
        const perRoomSubtotal = perRoomSubtotals[index] || 0;
        const isPrimary = index === 0;

        const extrasForThis = isPrimary ? extrasTotal : 0;
        const discountForThis = isPrimary ? discount : 0;
        const totalForThis = Math.max(
          0,
          perRoomSubtotal + extrasForThis - discountForThis
        );

        const adultsForThis = adultsPerRoom[index] || 0;

        const reservationPayload = {
          ...commonPayload,
          adults: adultsForThis, // override with per-room adults
          confirmation_code: genConfCode(),
          room_name: info.name || null,
          room_type_id: roomId,
          room_type_code: info.code || null,
          room_subtotal: perRoomSubtotal,
          extras_total: extrasForThis,
          discount_amount: discountForThis,
          coupon_code:
            isPrimary && appliedCoupon ? appliedCoupon.code : null,
          total: totalForThis,
        };

        const { data: reservation, error: reservationError } =
          await supabase
            .from('reservations')
            .insert(reservationPayload)
            .select()
            .single();

        if (reservationError) throw reservationError;
        if (isPrimary) primaryReservation = reservation;
        createdReservations.push(reservation);

        // Only attach extras to the primary reservation
        if (isPrimary && selectedExtras.length > 0 && reservation) {
          const extrasPayload = selectedExtras.map((extra) => ({
            reservation_id: reservation.id,
            extra_id: extra.extra_id,
            extra_code: extra.extra_code,
            extra_name: extra.extra_name,
            price: extra.price,
            quantity: extra.quantity,
            subtotal: extra.price * extra.quantity,
          }));

          const { error: extrasError } = await supabase
            .from('reservation_extras')
            .insert(extrasPayload);

          if (extrasError) {
            console.error('Error saving extras:', extrasError);
          }
        }
      }

      // Update coupon usage once per booking (if applied)
      if (appliedCoupon && primaryReservation) {
        await supabase
          .from('coupons')
          .update({
            current_uses: (appliedCoupon.current_uses || 0) + 1,
          })
          .eq('id', appliedCoupon.id);
      }

      // If this is a group booking (more than one cabin), set group fields
      // --- Send confirmation email via Sojourn API (optional) ---
      const sendEmailCheckbox = wrap.querySelector('#nb-send-email');
      if (
        sendEmailCheckbox &&
        sendEmailCheckbox.checked &&
        primaryReservation &&
        primaryReservation.guest_email
      ) {
        if (!SOJOURN_API_BASE_URL) {
          console.error(
            'SOJOURN_API_BASE_URL is not set – cannot send booking email.'
          );
        } else {
          try {
            const emailResponse = await fetch(
              `${SOJOURN_API_BASE_URL}/api/send-booking-email`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ booking: primaryReservation }),
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

      toast('Reservation(s) created');
      wrap.remove();

      // Refresh calendar/list
      if (typeof initReservations === 'function') {
        initReservations();
      }
    } catch (e) {
      alert('Error saving: ' + (e.message || e));
    }
  });
}
