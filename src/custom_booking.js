// src/custom_booking.js
// Custom Booking Modal for Sojourn Cabins
// VERSION: Dynamic Pricing v1.0 - Dec 28, 2025


import { supabase } from './config/supabase.js';
import { toast } from './utils/helpers.js';
import { initReservations } from './reservations.js';

console.log('✅ Custom Booking with Dynamic Pricing v1.0 loaded');

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

    const horizonStartISO = toDateInput(today);
    const horizonEndISO = toDateInput(horizonEnd);

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
          const dStr = toDateInput(d);
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
      const ciStr = toDateInput(cursor);

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
  // Use local timezone instead of UTC to avoid date shifting
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(isoDate, nights) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + (Number(nights)||0));
  return toDateInput(d);
}

// Prevent double booking: correct date overlap check
async function isRoomAvailable(roomTypeId, roomTypeCode, checkInISO, checkOutISO) {
  console.log('🔍 isRoomAvailable called:', { roomTypeId, roomTypeCode, checkInISO, checkOutISO });
  
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
    console.log('📋 All reservations fetched:', data.length);
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
    const match = sameId || sameCode;
    
    console.log('Filtering reservation:', {
      resId: r.id,
      resRoomTypeId: r.room_type_id,
      resRoomCode: r.room_type_code,
      checkingId: idNum,
      checkingCode: roomTypeCode,
      sameId,
      sameCode,
      match
    });
    
    return match;
  });

  console.log('📋 Relevant reservations for this cabin:', relevant.length, relevant);

  // Use half-open intervals [check_in, check_out) - standard hospitality practice
  // Guest checks out on checkout day, so room becomes available for new check-in
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

    // Half-open interval overlap check
    const overlaps = existingStart < newEnd && existingEnd > newStart;
    console.log('Checking overlap:', { 
      existing: `${r.check_in} to ${r.check_out}`, 
      new: `${checkInISO} to ${checkOutISO}`,
      overlaps 
    });
    
    return overlaps;
  });

  console.log('❌ Has overlap?', hasOverlap);

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

      console.log('🚫 Blocked dates found:', blocked?.length || 0, blocked);

      if (blockedError) {
        console.error('Blocked dates check error (custom booking):', blockedError);
      } else if (blocked && blocked.length > 0) {
        // there is at least one blocked day in the range
        console.log('🚫 UNAVAILABLE - Blocked dates exist');
        return false;
      }
    }
  } catch (err) {
    console.error('Blocked dates check exception (custom booking):', err);
  }

  // Available only if there is NO overlapping stay and NO blocked dates
  console.log('✅ AVAILABLE - No conflicts found');
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
  
  // Add calendar CSS if not already present
  if (!document.getElementById('custom-calendar-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-calendar-styles';
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
    <div style="max-width:750px;width:100%;background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;" onclick="event.stopPropagation()">
      <div style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h3 style="margin:0;color:white;font-size:20px;font-weight:700">New Custom Booking</h3>
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
            <label>Adults</label>
            <select id="nb-adults">
              <option value="1">1</option>
              <option value="2" selected>2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
            </select>
          </div>
            <div class="form-group">
          <label>Check-in</label>
          <div class="date-picker-wrapper">
            <input id="nb-in" type="text" readonly class="date-picker-input" />
            <div id="nb-in-picker" class="date-picker-dropdown"></div>
          </div>
        </div>

        <div class="form-group">
          <label>Check-out</label>
          <div class="date-picker-wrapper">
            <input id="nb-out" type="text" readonly class="date-picker-input" />
            <div id="nb-out-picker" class="date-picker-dropdown"></div>
          </div>
        </div>
      </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <span style="background:#f3f4f6;padding:6px 12px;border-radius:8px;font-size:13px">
              Nights: <strong id="nb-nights-display">1</strong>
            </span>
          </div>
          <button id="search-availability-btn" class="btn" style="background:#667eea;color:white">
            Search Available Cabins
          </button>
        </div>

        <!-- Available Cabins Section (hidden until search) -->
        <div id="available-cabins-section" style="display:none;margin-bottom:20px">
          <h4 style="margin:0 0 12px 0;color:#1e293b;font-size:16px">Available Cabins</h4>
          <div id="nb-rooms-list" style="border:1px solid var(--ring);border-radius:var(--radius-md);padding:10px;max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
            <!-- Will be populated dynamically -->
          </div>
          <div id="nb-no-rooms-message" style="display:none;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#b91c1c;margin-top:12px">
            No cabins available for the selected dates and number of guests.
          </div>
        </div>

        <!-- STEP 2: Guest Information (only show after rooms selected) -->
        <div id="guest-info-section" style="display:none">
          <h4 style="margin:20px 0 12px 0;color:#1e293b;font-size:16px;border-top:2px solid #e2e8f0;padding-top:20px">Guest Information</h4>
          
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
              <input type="checkbox" id="nb-influencer" style="width:auto;flex-shrink:0;margin-left:2px" />
            </label>
          </div>

          <div class="form-group">
            <label>Children</label>
            <input id="nb-children" type="number" min="0" step="1" value="0" />
          </div>
        </div>

        <!-- Hidden fields -->
        <input id="nb-nights" type="hidden" value="1" />
        <input id="nb-room-subtotal" type="hidden" value="" />
        <div class="form-group" style="display:none">
          <label>Currency</label>
          <input id="nb-currency" type="text" value="GHS" />
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
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:0.875rem">
            <span style="color:var(--muted)">Override Price/Night:</span>
            <div style="display:flex;align-items:center;gap:8px">
              <input id="nb-price-override" type="number" min="0" step="0.01" placeholder="Auto"
                    style="width:120px;padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:13px" />
              <span style="font-size:12px;color:#9ca3af">GHS</span>
            </div>
          </div>

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
              <option value="pending_payment">Pending Payment</option>
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

      <div style="padding:16px 24px;border-top:2px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;">
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
  let selectedDatesCalendar = { 'nb-in': null, 'nb-out': null };
  let currentPickerMonth = { 'nb-in': new Date(), 'nb-out': new Date() };
  let calendarDisabledDates = [];
  let calendarPrices = {}; // Store nightly prices: { 'YYYY-MM-DD': { price: 123.45, currency: 'GHS' } }
  
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
  let currentAdultsForCalendar = 2; // Track current adults selection
  
  async function loadCalendarDisabledDates(adults) {
    // Store for later use
    currentAdultsForCalendar = adults || currentAdultsForCalendar;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toDateInput(today);
    
    const disabledSet = new Set();
    
    // 1) Always disable past dates
    for (let i = -365; i < 0; i++) {
      disabledSet.add(addDaysISO(todayISO, i));
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
    
    const today = toDateInput(new Date());
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(month.getFullYear(), month.getMonth(), day);
      const dateStr = toDateInput(dateObj);
      let isDisabled = false;
      
      // Different blocking logic for check-in vs check-out
      if (pickerId === 'nb-in') {
        // For check-in: block if that specific date has no availability
        isDisabled = calendarDisabledDates.indexOf(dateStr) !== -1 || dateStr < today;
      } else if (pickerId === 'nb-out') {
        // For check-out: block if date is before/equal to check-in, or if there's any blocked date in the interval
        if (!selectedDatesCalendar['nb-in'] || dateStr <= selectedDatesCalendar['nb-in']) {
          isDisabled = true;
        } else {
          // Check if any date in the interval [check-in, check-out) is blocked
          const checkInDate = selectedDatesCalendar['nb-in'];
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
      
      if (selectedDatesCalendar['nb-in'] && selectedDatesCalendar['nb-out']) {
        isInRange = dateStr > selectedDatesCalendar['nb-in'] && dateStr < selectedDatesCalendar['nb-out'];
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
    
    if (pickerId === 'nb-in') {
      // Find the nearest available checkout date
      if (!selectedDatesCalendar['nb-out'] || selectedDatesCalendar['nb-out'] <= dateStr) {
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
        selectedDatesCalendar['nb-out'] = checkoutDate;
        const outInputEl = document.querySelector('#nb-out');
        if (outInputEl) outInputEl.value = formatDisplayDateCustom(checkoutDate);
      }
      // If check-out picker is open, refresh it to show updated blocking
      if (activePickerId === 'nb-out') {
        renderCalendar('nb-out');
      }
    }
    
    closeDatePicker();
    calculateNights();
    computeRoomSubtotal();
  }
  
  // Initialize calendar disabled dates with default adults (2)
  loadCalendarDisabledDates(2);
  
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

  const inEl = wrap.querySelector('#nb-in');
  const outEl = wrap.querySelector('#nb-out');
  const nightsEl = wrap.querySelector('#nb-nights');
  const nightsDisplayEl = wrap.querySelector('#nb-nights-display');
  const roomSubtotalEl = wrap.querySelector('#nb-room-subtotal');
  const availableCabinsSection = wrap.querySelector('#available-cabins-section');
  const roomsListEl = wrap.querySelector('#nb-rooms-list');
  const noRoomsMessage = wrap.querySelector('#nb-no-rooms-message');
  const guestInfoSection = wrap.querySelector('#guest-info-section');
  const searchBtn = wrap.querySelector('#search-availability-btn');

  // Search availability handler (matching BookingWidget flow)
  async function searchAvailability() {
    const adults = parseInt(wrap.querySelector('#nb-adults').value, 10) || 2;
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
        roomsListEl.innerHTML = availableRooms.map(r => `
          <label class="nb-room-row" style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
            <input 
              type="checkbox" 
              class="nb-room-checkbox" 
              value="${r.id}" 
              data-code="${r.code || ''}" 
              data-name="${r.name || ''}"
              data-max-adults="${r.max_adults || 0}"
              style="width:auto"
            />
            <span style="flex:1">${(r.code || '').toUpperCase()} – ${r.name || ''} (max ${r.max_adults} adults)</span>
            <span style="font-size:12px;color:#64748b">GHS ${parseFloat(r.total_price || 0).toFixed(2)}</span>
          </label>
        `).join('');

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

  // Re-search when adults or dates change
  wrap.querySelector('#nb-adults').addEventListener('change', async () => {
    const adults = parseInt(wrap.querySelector('#nb-adults').value, 10) || 2;
    
    // Reload calendar blocked dates with new adults count (like BookingWidget)
    await loadCalendarDisabledDates(adults);
    
    // Hide results to force re-search
    availableCabinsSection.style.display = 'none';
    guestInfoSection.style.display = 'none';
  });
  
  // Price override field listener
  const priceOverrideEl = wrap.querySelector('#nb-price-override');
  if (priceOverrideEl) {
    priceOverrideEl.addEventListener('input', () => {
      computeRoomSubtotal();
    });
  }

  // --- Room pricing helpers (weekday/weekend split, multiple cabins) ---
  const roomMap = Object.fromEntries((rooms || []).map((r) => [String(r.id), r]));

  function isWeekend(d) {
    // Friday (5) and Saturday (6) are weekend nights in the widget logic
    const dow = d.getDay();
    return dow === 5 || dow === 6;
  }

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
    const priceOverrideEl = wrap.querySelector('#nb-price-override');
    const priceOverride = priceOverrideEl && priceOverrideEl.value ? parseFloat(priceOverrideEl.value) : null;

    let totalSubtotal = 0;
    
    // Use manual override if provided, otherwise use dynamic pricing
    if (priceOverride && priceOverride > 0) {
      console.log('Using manual price override:', priceOverride, 'per night');
      const totalNights = weekdayN + weekendN;
      
      for (const roomId of selectedRoomIds) {
        totalSubtotal += priceOverride * totalNights;
      }
    } else {
      // Use dynamic pricing for each selected room
      for (const roomId of selectedRoomIds) {
        const info = roomMap[String(roomId)];
        if (!info) continue;

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
            totalSubtotal += parseFloat(pricingData.total);
          } else {
            // Fallback to base prices if no dynamic pricing returned
            console.log('No dynamic pricing data, using base prices');
            const wkdPrice = Number(info.base_price_per_night_weekday || 0);
            const wkePrice = Number(info.base_price_per_night_weekend || 0);
            totalSubtotal += weekdayN * wkdPrice + weekendN * wkePrice;
          }
        } catch (err) {
          // Fallback to base prices on error
          console.error('Dynamic pricing failed for room', roomId, '- using base prices. Error:', err);
          const wkdPrice = Number(info.base_price_per_night_weekday || 0);
          const wkePrice = Number(info.base_price_per_night_weekend || 0);
          totalSubtotal += weekdayN * wkdPrice + weekendN * wkePrice;
        }
      }
    }

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

    // Recompute pricing after nights change
    computeRoomSubtotal();
    
    // Hide available cabins when dates change
    if (availableCabinsSection) availableCabinsSection.style.display = 'none';
    if (guestInfoSection) guestInfoSection.style.display = 'none';
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
    openDatePicker('nb-in');
  });
  
  outEl.addEventListener('click', () => {
    openDatePicker('nb-out');
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
      const totalAdults = parseInt(wrap.querySelector('#nb-adults').value, 10) || 2;
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

      // ---- PRICING (recompute per-cabin subtotals using dynamic pricing) ----
      const ci = new Date(checkInISO);
      const co = new Date(checkOutISO);

      
      // Check for manual price override
      const priceOverrideEl = wrap.querySelector('#nb-price-override');
      const priceOverride = priceOverrideEl && priceOverrideEl.value ? parseFloat(priceOverrideEl.value) : null;
      let weekdayN = 0;
      let weekendN = 0;
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        if (isWeekend(d)) weekendN++;
        else weekdayN++;
      }

      // Calculate dynamic pricing for each room
      const perRoomSubtotals = [];
      const totalNights = weekdayN + weekendN;

      for (const roomId of selectedRoomIds) {
        const info = roomMap[String(roomId)] || {};

        try {
          if (priceOverride && priceOverride > 0) {
            // Use manual override (apply per selected room)
            console.log('💰 Using manual price override:', priceOverride, 'per night');
            perRoomSubtotals.push(priceOverride * totalNights);
          } else {
            // Call dynamic pricing function - Supabase returns {data, error}
            const { data: pricingData, error: pricingError } = await supabase.rpc(
              'calculate_dynamic_price',
              {
                p_room_type_id: roomId,
                p_check_in: checkInISO,
                p_check_out: checkOutISO,
                p_pricing_model_id: null // Uses active model
              }
            );

            if (pricingError) {
              throw new Error(pricingError.message || 'Dynamic pricing failed');
            }

            if (pricingData && pricingData.total != null) {
              perRoomSubtotals.push(parseFloat(pricingData.total));
            } else {
              // Fallback to base prices
              const wkdPrice = Number(info.base_price_per_night_weekday || 0);
              const wkePrice = Number(info.base_price_per_night_weekend || 0);
              perRoomSubtotals.push(weekdayN * wkdPrice + weekendN * wkePrice);
            }
          }
        } catch (err) {
          // Fallback to base prices on error
          console.warn('Dynamic pricing failed in save, using base prices:', err);
          const wkdPrice = Number(info.base_price_per_night_weekday || 0);
          const wkePrice = Number(info.base_price_per_night_weekend || 0);
          perRoomSubtotals.push(weekdayN * wkdPrice + weekendN * wkePrice);
        }
      }


      const roomSubtotal =
        perRoomSubtotals.reduce((sum, v) => sum + v, 0) || 0;
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
      
      if (appliedCoupon) {
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
      } else {
        // No coupon: populate extrasWithDiscounts with zero discounts
        extrasWithDiscounts = selectedExtras.map((extra) => ({
          ...extra,
          discount: 0
        }));
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
        check_in: parseDisplayDateToISO(wrap.querySelector('#nb-in').value) || null,
        check_out: parseDisplayDateToISO(wrap.querySelector('#nb-out').value) || null,
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

      // Determine if this is a group booking (more than one cabin)
      const isGroupBooking = selectedRoomIds.length > 1;
      const genGroupReservationCode = () => `GRP-${Math.floor(100000 + Math.random() * 900000)}`;

      // Generate ONCE so it's available even before primaryReservation exists
      const groupCode = isGroupBooking ? genGroupReservationCode() : null;



      // Calculate total room price for proportional discount distribution (like BookingWidget)
      const totalRoomPrice = perRoomSubtotals.reduce((sum, price) => sum + price, 0);

      // Insert one reservation per selected cabin
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

        const reservationPayload = {
          ...commonPayload,
          adults: adultsForThis, // override with per-room adults
          confirmation_code: genConfCode(),
          group_reservation_code: groupCode,
          group_reservation_id: isGroupBooking && !isPrimary && primaryReservation ? primaryReservation.id : null,
          room_name: info.name || null,
          room_type_id: roomId,
          room_type_code: info.code || null,
          room_subtotal: perRoomSubtotal,
          extras_total: extrasForThis,
          discount_amount: totalRoomDiscount,              // Total discount for this room
          room_discount: roomOnlyDiscount,                 // Room portion only (proportional)
          extras_discount: extrasOnlyDiscount,             // Extras portion only
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

      // If this is a group booking, ensure ALL reservations (including primary) share:
      // 1) the same group_reservation_code (the one generated once above), and
      // 2) group_reservation_id is set for BOTH primary and children.
      // (Primary points to itself so downstream code never sees null.)
      if (isGroupBooking && primaryReservation && createdReservations.length > 1) {
        // Update PRIMARY: set group code + set group_reservation_id to itself
        const { error: grpPrimaryErr } = await supabase
          .from('reservations')
          .update({
            group_reservation_code: groupCode,
            group_reservation_id: primaryReservation.id,
          })
          .eq('id', primaryReservation.id);
        if (grpPrimaryErr) throw grpPrimaryErr;

        // Update CHILDREN: point to primary + carry the same group code
        const childIds = createdReservations
          .filter((r) => String(r.id) !== String(primaryReservation.id))
          .map((r) => r.id);

        if (childIds.length) {
          const { error: grpChildrenErr } = await supabase
            .from('reservations')
            .update({
              group_reservation_id: primaryReservation.id,
              group_reservation_code: groupCode,
            })
            .in('id', childIds);
          if (grpChildrenErr) throw grpChildrenErr;
        }

        // Keep local objects in sync (used below for email payload)
        primaryReservation.group_reservation_code = groupCode;
        primaryReservation.group_reservation_id = primaryReservation.id;

        createdReservations.forEach((r) => {
          r.group_reservation_code = groupCode;
          r.group_reservation_id =
            String(r.id) === String(primaryReservation.id)
              ? primaryReservation.id
              : primaryReservation.id;
        });
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
            const displayConfirmationCode = isGroupBooking && primaryReservation.group_reservation_code
              ? primaryReservation.group_reservation_code
              : primaryReservation.confirmation_code;

            // Build email data matching webhook structure
            const emailData = {
              booking: {
                confirmation_code: displayConfirmationCode,
                group_reservation_code: isGroupBooking ? primaryReservation.group_reservation_code : null,
                guest_first_name: primaryReservation.guest_first_name,
                guest_last_name: primaryReservation.guest_last_name,
                guest_email: primaryReservation.guest_email,
                guest_phone: primaryReservation.guest_phone,
                check_in: primaryReservation.check_in,
                check_out: primaryReservation.check_out,
                nights: primaryReservation.nights,
                adults: primaryReservation.adults,
                currency: primaryReservation.currency,
                room_name: primaryReservation.room_name,
                room_subtotal: primaryReservation.room_subtotal,
                extras_total: primaryReservation.extras_total,
                discount_amount: primaryReservation.discount_amount,
                coupon_code: primaryReservation.coupon_code,
                total: primaryReservation.total,
                is_group_booking: isGroupBooking,
                group_room_subtotal: aggregateRoomSubtotal,
                group_extras_total: aggregateExtrasSubtotal,
                group_discount_total: aggregateDiscountTotal,
                group_total: aggregateTotal,
                rooms: isGroupBooking ? roomsForEmail : [roomsForEmail[0]],
                package_code: primaryReservation.package_code || null,
                package_name: primaryReservation.package_name || null,
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

            // --- ALSO send experiences/extras selection email ---
            const selectionEmailResponse = await fetch(
              `${SOJOURN_API_BASE_URL}/api/send-extras-selection-email`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailData),
              }
            );

            if (!selectionEmailResponse.ok) {
              const errorText = await selectionEmailResponse.text();
              console.error('Extras selection Email API error:', errorText);
            } else {
              console.log('✅ Extras selection email sent successfully');
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