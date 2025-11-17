// src/app.js
// Bernard Admin – main application script

// ❌ REMOVE the CSS import here – main.js handles it
// import './styles.css';

import { supabase } from './config/supabase.js';
import { callOpenAI, conversationHistory } from './config/openai.js';
import {
  $,
  $$,
  addMessage,
  showTyping,
  hideTyping,
  formatCurrency,
  openModal,
  closeModal,
  toast,
} from './utils/helpers.js';

import { initAnalytics } from './analytics.js';
import { initReservations } from './reservations.js';
import { initRooms } from './rooms.js';
import { initExtras } from './extras.js';
import { initCoupons } from './coupons.js';
import { initPackages } from './packages.js';
import { openBookPackageModal } from './package_booking.js';
import { initChat } from './chat.js';

// Main app initializer
export function initApp() {
  const root =
    document.getElementById('root') || document.getElementById('admin-dashboard');

  if (!root) {
    const e = document.createElement('div');
    e.textContent = 'ERROR: root element not found';
    document.body.appendChild(e);
    return;
  }

  // ---------- Layout ----------
  root.innerHTML = `
    <div class="wrap">
      <div class="shell">
        <!-- Top Bar -->
        <div class="topbar" style="position:relative">
          <!-- Mobile menu button (moved to the LEFT) -->
          <button
            id="mobile-menu-btn"
            class="mobile-menu-btn"
            aria-expanded="false"
            aria-controls="mobile-menu-drawer"
            title="Menu"
          >☰</button>

          <div class="brand"><span class="bot">🤖</span> Bernard</div>

          <div class="tabs" id="tabs">
            <button class="tab active" data-view="chat">💬 Chat</button>
            <button class="tab" data-view="reservations">🗓️ Reservations</button>
            <button class="tab" data-view="rooms">🏠 Room Types</button>
            <button class="tab" data-view="extras">✨ Extras</button>
            <button class="tab" data-view="coupons">🎟️ Coupons</button>
            <button class="tab" data-view="packages">📦 Packages</button>
            <button class="tab" data-view="analytics">📊 Analytics</button>
          </div>

          <div class="booking-buttons">
            <button class="btn btn-primary" id="new-custom-booking-btn">+ New Custom Booking</button>
            <button class="btn btn-primary" id="book-package-btn">+ Book New Package</button>
          </div>

          <div class="now" id="now"></div>

          <!-- Right-aligned dropdown drawer -->
          <nav
            id="mobile-menu-drawer"
            hidden
            style="
              position:absolute;
              right:10px;
              top:calc(100% + 8px);
              width:min(260px, 92vw);
              background:#fff;
              border:1px solid var(--ring);
              border-radius:12px;
              box-shadow:0 10px 24px rgba(0,0,0,.12);
              z-index:40;
            "
          >
            <ul style="list-style:none;margin:10px;padding:0;display:grid;gap:8px">
              <li><button data-view="chat"         class="btn" style="width:100%">💬 Chat</button></li>
              <li><button data-view="reservations" class="btn" style="width:100%">🗓️ Reservations</button></li>
              <li><button data-view="rooms"        class="btn" style="width:100%">🏠 Room Types</button></li>
              <li><button data-view="extras"       class="btn" style="width:100%">✨ Extras</button></li>
              <li><button data-view="coupons"      class="btn" style="width:100%">🎟️ Coupons</button></li>
              <li><button data-view="packages"     class="btn" style="width:100%">📦 Packages</button></li>
              <li><button data-view="analytics"    class="btn" style="width:100%">📊 Analytics</button></li>
              <li><hr style="border:0;border-top:1px solid var(--ring);margin:6px 0"></li>
              <li><button id="mobile-custom-booking-btn" class="btn btn-primary" style="width:100%">+ New Custom Booking</button></li>
              <li><button id="mobile-package-btn" class="btn btn-primary" style="width:100%">+ Book New Package</button></li>
              <li><hr style="border:0;border-top:1px solid var(--ring);margin:6px 0"></li>
              <li><button data-view="quickstats"   class="btn" style="width:100%">📊 Quick Stats</button></li>
              <li><button data-view="recent"       class="btn" style="width:100%">🧾 Recent Bookings</button></li>
            </ul>
          </nav>
        </div>

        <!-- Page Heading -->
        <div class="pagehead">
          <div class="h1" id="section-title">Chat</div>
        </div>

        <!-- Body -->
        <div class="grid">
          <div>
            <div id="view-chat" class="card panel show">
              <div class="card-bd chat">
                <div id="messages" class="messages"></div>
                <div class="chat-input">
                  <input id="user-input" class="input" placeholder="Type a request…" />
                  <button id="send-btn" class="btn" title="Send">➤</button>
                </div>
              </div>
            </div>

            <div id="view-reservations" class="card panel">
              <div class="card-bd">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
                  <input id="res-search" class="input" placeholder="Search name/email/code…" style="flex:1;min-width:200px" />
                  <select id="res-month" class="select">
                    <option value="">All months</option>
                    ${Array.from({ length: 12 })
                      .map(
                        (_, i) =>
                          `<option value="${i}">${new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>`
                      )
                      .join('')}
                  </select>
                  <select id="res-year" class="select"></select>
                  <div style="display:flex;gap:4px;border:1px solid #cbd5e1;border-radius:8px;padding:2px">
                    <button id="view-list-btn" class="btn-view active" title="List View">📋</button>
                    <button id="view-calendar-btn" class="btn-view" title="Calendar View">📅</button>
                  </div>
                </div>
                <div id="res-list" class="list">Loading…</div>
                <div id="res-calendar" class="calendar-view" style="display:none"></div>
              </div>
            </div>

            <div id="view-rooms" class="card panel">
              <div class="card-bd">
                <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
                  <button id="add-room-btn" class="btn">+ Add Room Type</button>
                </div>
                <div id="rooms-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-extras" class="card panel">
              <div class="card-bd">
                <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
                  <button id="add-extra-btn" class="btn">+ Add Extra</button>
                </div>
                <div id="extras-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-coupons" class="card panel">
              <div class="card-bd">
                <div id="coupons-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-packages" class="card panel">
              <div class="card-bd">
                <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
                  <button id="add-package-btn" class="btn">+ Add Package</button>
                </div>
                <div id="packages-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-analytics" class="card panel">
              <div class="card-bd">
                <!-- Content will be injected by analytics.js -->
              </div>
            </div>
          </div>

          <div>
            <!-- ids so the mobile menu can scroll to these cards -->
            <div class="card" id="quick-stats-card">
              <div class="card-hd">Quick Stats</div>
              <div class="card-bd">
                <div class="stat-row"><span>Today's Check-ins</span><strong id="stat-checkins">—</strong></div>
                <div class="stat-row"><span>Active Bookings</span><strong id="stat-total">—</strong></div>
                <div class="stat-row"><span>This Month</span><strong id="stat-month">—</strong></div>
                <div class="stat-row"><span>Total Nights Booked</span><strong id="stat-nights">—</strong></div>
              </div>
            </div>

            <div class="card" id="recent-bookings-card" style="margin-top:18px">
              <div class="card-hd">Recent Bookings</div>
              <div class="card-bd" id="recent-bookings">Loading…</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Modal -->
    <div id="booking-modal" class="modal">
      <div class="inner">
        <div class="hd">
          <h3 style="margin:0">Create New Booking</h3>
          <button class="btn" data-close="booking-modal">×</button>
        </div>
        <div class="bd">
          <div class="frow">
            <div><label>First Name*</label><input id="b-first" class="input"></div>
            <div><label>Last Name*</label><input id="b-last" class="input"></div>
          </div>
          <div class="frow">
            <div><label>Email*</label><input id="b-email" type="email" class="input"></div>
            <div><label>Phone</label><input id="b-phone" class="input"></div>
          </div>
          <div class="frow">
            <div><label>Check-in*</label><input id="b-checkin" type="date" class="input"></div>
            <div><label>Check-out*</label><input id="b-checkout" type="date" class="input"></div>
          </div>
          <div class="frow">
            <div><label>Room Type*</label><select id="b-room" class="select"><option value="">Select...</option></select></div>
            <div><label>Adults*</label><select id="b-adults" class="select">${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join('')}</select></div>
          </div>
          <div><label>Notes</label><textarea id="b-notes" rows="3" class="textarea" style="resize:vertical"></textarea></div>
        </div>
        <div class="ft">
          <button class="btn" data-close="booking-modal">Cancel</button>
          <button class="btn" id="create-booking-btn">Create Booking</button>
        </div>
      </div>
    </div>
  `;

  // -------- Wire "New Custom Booking" and "Book New Package" buttons (no DOM changes) --------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, a, [role="button"]');
  if (!btn) return;

  // normalize the visible text of the clicked element
  const label = (btn.textContent || btn.innerText || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // handle both the new labels and any legacy variants
  if (
    label.includes('new custom booking') ||
    label === '+ new custom booking' ||
    label.includes('new booking') // legacy safety
  ) {
    e.preventDefault();
    if (typeof openNewCustomBookingModal === 'function') {
      openNewCustomBookingModal();
    } else {
      alert('openNewCustomBookingModal() is not defined.');
    }
    return;
  }

  if (
    label.includes('book new package') ||
    label === '+ book new package'
  ) {
    e.preventDefault();
    if (typeof openBookPackageModal === 'function') {
      openBookPackageModal();
    } else {
      alert('openBookPackageModal() is not defined.');
    }
  }
}, true);
// Stack the two booking buttons vertically without changing their size
function stackBookingButtons() {
  const a = document.getElementById('new-custom-booking-btn');
  const b = document.getElementById('book-package-btn');
  if (!a || !b) return;

  // already stacked?
  if (a.parentElement && a.parentElement.classList.contains('booking-btn-stack')) return;

  // create a compact vertical wrapper right where the first button lives
  const parent = a.parentElement;
  const wrap = document.createElement('div');
  wrap.className = 'booking-btn-stack';
  // insert before the first button, then move both buttons inside
  parent.insertBefore(wrap, a);
  wrap.appendChild(a);
  wrap.appendChild(b);
}
  // ---------- Live Clock ----------
  const nowEl = $('#now');
  const tick = () => {
    const d = new Date();
    nowEl.textContent = d.toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  tick();
  setInterval(tick, 60 * 1000);

  // ---------- Tabs ----------
  $$('#tabs .tab').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('#tabs .tab').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      $$('.panel').forEach((p) => p.classList.remove('show'));
      $(`#view-${btn.dataset.view}`).classList.add('show');

      // Update page title
      const titles = {
        chat: 'Chat',
        reservations: 'Reservations',
        rooms: 'Room Types',
        extras: 'Extras',
        coupons: 'Coupons',
        packages: 'Packages',
        analytics: 'Analytics',
      };
      $('#section-title').textContent = titles[btn.dataset.view] || 'Dashboard';

      if (btn.dataset.view === 'chat') initChat();
      if (btn.dataset.view === 'reservations') initReservations();
      if (btn.dataset.view === 'rooms') initRooms();
      if (btn.dataset.view === 'extras') initExtras();
      if (btn.dataset.view === 'coupons') initCoupons();
      if (btn.dataset.view === 'packages') initPackages();
      if (btn.dataset.view === 'analytics') initAnalytics();
      
    })
  );

  // ---------- Mobile Menu (right-aligned dropdown) ----------
  const mBtn = $('#mobile-menu-btn');
  const mDrawer = $('#mobile-menu-drawer');

  if (mBtn && mDrawer) {
    const open = () => { mDrawer.removeAttribute('hidden'); mBtn.setAttribute('aria-expanded','true'); };
    const close = () => { mDrawer.setAttribute('hidden', '');  mBtn.setAttribute('aria-expanded','false'); };

    mBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mDrawer.hasAttribute('hidden') ? open() : close();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!mDrawer.hasAttribute('hidden') && !mDrawer.contains(e.target) && e.target !== mBtn) {
        close();
      }
    });

    // Handle menu actions
    mDrawer.querySelectorAll('button[data-view]').forEach((b) => {
      b.addEventListener('click', async () => {
        const view = b.getAttribute('data-view');
        close();

        if (view === 'quickstats') {
          // Hide all panels
          $$('.panel').forEach((p) => p.classList.remove('show'));
          // Show only stats card
          const statsCard = document.getElementById('quick-stats-card');
          const recentCard = document.getElementById('recent-bookings-card');
          if (statsCard) statsCard.style.display = 'block';
          if (recentCard) recentCard.style.display = 'none';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          $('#section-title').textContent = 'Quick Stats';
          return;
        }
        if (view === 'recent') {
          // Hide all panels
          $$('.panel').forEach((p) => p.classList.remove('show'));
          // Show only recent bookings card
          const statsCard = document.getElementById('quick-stats-card');
          const recentCard = document.getElementById('recent-bookings-card');
          if (statsCard) statsCard.style.display = 'none';
          if (recentCard) recentCard.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          $('#section-title').textContent = 'Recent Bookings';
          return;
        }
        if (view === 'newbooking') {
          document.getElementById('new-booking-btn')?.click();
          return;
        }

        // Update page title
        const titles = {
          chat: 'Chat',
          reservations: 'Reservations',
          rooms: 'Room Types',
          extras: 'Extras',
          coupons: 'Coupons',
          packages: 'Packages',
          analytics: 'Analytics',
        };
        $('#section-title').textContent = titles[view] || 'Dashboard';

        // Hide stats cards when switching to other views
        const statsCard = document.getElementById('quick-stats-card');
        const recentCard = document.getElementById('recent-bookings-card');
        if (statsCard) statsCard.style.display = 'none';
        if (recentCard) recentCard.style.display = 'none';

        // Delegate to the existing tab button (Reservations / Rooms / Extras / Coupons / Packages)
        const tab = document.querySelector(`#tabs .tab[data-view="${view}"]`);
        tab?.dispatchEvent(new Event('click', { bubbles: true }));
      });
    });
  }

// ---------- Quick Stats ----------
loadStats();
async function loadStats() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, '0');

    const [
      checkins,  // count only (no rows)
      confirmed, // count only (no rows)
      monthCnt,  // count only (no rows)
      nightsSum  // minimal columns to sum
    ] = await Promise.all([
      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .gte('check_in', today).lte('check_in', today),

      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),

      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .gte('check_in', `${y}-${m}-01`)
        .lte('check_in', `${y}-${m}-31`),

      supabase.from('reservations')
        .select('nights')
    ]);

    $('#stat-checkins').textContent = checkins?.count ?? 0;
    $('#stat-total').textContent    = confirmed?.count ?? 0;
    $('#stat-month').textContent    = monthCnt?.count ?? 0;
    $('#stat-nights').textContent   = (nightsSum?.data || []).reduce((t, r) => t + (r.nights || 0), 0);
  } catch (e) {
    console.warn('stats error', e);
  }
}

  // ---------- Recent Bookings ----------
  loadRecent();
  async function loadRecent() {
    try {
      const { data } = await supabase
        .from('reservations')
        .select('guest_first_name,guest_last_name,confirmation_code,status,created_at,room_name,check_in')
        .order('created_at', { ascending: false })
        .limit(7);

      $('#recent-bookings').innerHTML =
        (data || [])
          .map(
            (r) => `
        <div class="recent-item">
          <div>
            <div style="font-weight:700">${r.guest_first_name} ${r.guest_last_name}</div>
            <div style="color:#6b7280">${r.room_name || ''} • ${r.check_in || ''}</div>
          </div>
          <span class="code">${r.confirmation_code}</span>
        </div>`
          )
          .join('') || 'No data';
    } catch (e) {
      $('#recent-bookings').textContent = 'Error loading';
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
// ---- shared helper: upload room image to Supabase Storage ----
async function uploadRoomImage(file, code) {
  const bucket = 'cabin-images'; // your existing bucket
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `rooms/${String(code || 'ROOM').toUpperCase()}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: '3600' });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl; // final public URL
}


// ----- Prevent double booking: correct date overlap check -----
// Checks overlap against BOTH room_type_id and room_type_code so older rows are included.
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

  // Available only if there is NO overlapping stay
  return !hasOverlap;
}

// ---- Region-sorted ISO country dial code list with emoji flags ----
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
  { region: "Africa", code: "+225", label: "🇨🇮 Côte d’Ivoire (+225)" },
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

// ---- Build searchable country dropdown ----
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
    <div class="country-select-box" style="display:flex;flex-direction:column;gap:6px;width:100%">
      <input type="text" id="${selectId}-search" placeholder="Search country..." 
        style="padding:6px;border:1px solid #ccc;border-radius:6px;font-size:14px"/>
      <select id="${selectId}" style="padding:6px;border:1px solid #ccc;border-radius:6px;">
        ${groupedHtml}
      </select>
    </div>
  `;
}

// ---- Enable search behaviour ----
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


/* ---------- New Custom Booking ---------- */
async function openNewCustomBookingModal() {
    // Ensure DEV never stacks multiple modals
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
    .select('id,code,name,base_price_per_night_weekday,base_price_per_night_weekend,currency')
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

  const extrasHtml = (extras || []).map(e =>
  `<label for="extra-${e.id}" style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
      <input type="checkbox"
        id="extra-${e.id}"
        value="${e.id}"
        data-price="${e.price}"
        data-name="${e.name}"
        data-code="${e.code || ''}"
        style="width:auto" />
      <span>${e.name} - GHS ${e.price}</span>
  </label>`
).join('');
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

        <div class="form-grid">
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
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;">
            <span>Influencer?</span>
            <input type="checkbox" id="nb-influencer">
          </label>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Room (name/code)</label>
            <select id="nb-room">
              <option value="">Select room type...</option>
              ${roomOptions}
            </select>
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
          <div style="border:1px solid var(--ring);border-radius:var(--radius-md);padding:10px;max-height:150px;overflow-y:auto">
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
      </div>

      <div class="ft">
        <button class="btn" onclick="document.getElementById('reservation-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="nb-save">Save</button>
      </div>
    </div>
  `;

   // enable search on the country code selector
  attachCountrySearch('nb-country-code');

  const inEl = wrap.querySelector('#nb-in');
  const outEl = wrap.querySelector('#nb-out');
  const nightsEl = wrap.querySelector('#nb-nights');
  const roomSubtotalEl = wrap.querySelector('#nb-room-subtotal');
 
    // --- Auto-calc Room Subtotal (weekday/weekend split like the widget) ---
  const roomSel = wrap.querySelector('#nb-room');
  const roomMap = Object.fromEntries((rooms || []).map(r => [String(r.id), r]));

  function isWeekend(d) {
    // Friday (5) and Saturday (6) are weekend nights in the widget logic
    const dow = d.getDay();
    return dow === 5 || dow === 6;
  }

  function computeRoomSubtotal() {
    const roomId = roomSel.value;
    const info = roomMap[roomId];
    const ci = new Date(inEl.value);
    const co = new Date(outEl.value);

    if (!info || !inEl.value || !outEl.value || !(co > ci)) {
      // nothing to do / invalid; keep whatever is currently there but still refresh totals
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

    const wkdPrice = Number(info.base_price_per_night_weekday || 0);
    const wkePrice = Number(info.base_price_per_night_weekend || 0);
    const subtotal = (weekdayN * wkdPrice) + (weekendN * wkePrice);

    // Put the computed value into the Room Subtotal input (leave editable)
    roomSubtotalEl.value = String(subtotal.toFixed(2));

    // Ensure nights field stays in sync too
    nightsEl.value = String(weekdayN + weekendN);

    updatePriceBreakdown();
  }

  // Auto-calculate nights when dates change
  function calculateNights() {
  const checkIn = new Date(inEl.value);
  const checkOut = new Date(outEl.value);

  if (checkIn && checkOut && checkOut > checkIn) {
    nightsEl.value = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  } else {
    nightsEl.value = 1;
  }
  
  // Recompute pricing after nights change
  computeRoomSubtotal();
}

  // Calculate price breakdown
  // Calculate price breakdown
  function updatePriceBreakdown() {
    const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
    const currency = wrap.querySelector('#nb-currency').value || 'GHS';

    // Calculate extras total + capture details
    selectedExtras = Array.from(
      wrap.querySelectorAll('input[type="checkbox"][id^="extra-"]:checked')
    ).map((cb) => ({
      extra_id: cb.value,
      extra_code: cb.getAttribute('data-code') || '',
      extra_name: cb.getAttribute('data-name') || '',
      price: parseFloat(cb.getAttribute('data-price') || 0),
      quantity: 1,
    }));

    const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);

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
        .reduce((sum, e) => sum + e.price, 0);
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
    const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
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
    // Recalculate subtotal whenever the room or dates change
  roomSel.addEventListener('change', computeRoomSubtotal);
  inEl.addEventListener('change', computeRoomSubtotal);
  outEl.addEventListener('change', computeRoomSubtotal);

  // Initial compute after modal opens
  computeRoomSubtotal();
  
  // Extras checkboxes
  wrap.querySelectorAll('input[type="checkbox"][id^="extra-"]').forEach(cb => {
    cb.addEventListener('change', updatePriceBreakdown);
  });

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
      const roomSelect = wrap.querySelector('#nb-room');
      const selectedOption = roomSelect.selectedOptions[0];
      const roomTypeId = roomSelect.value || null;
      const roomTypeCode = selectedOption ? selectedOption.getAttribute('data-code') : null;
      const roomName = selectedOption
        ? selectedOption.getAttribute("data-name")
        : null;

      
      if (!roomTypeId || !roomTypeCode) {
        alert('Please select a room type');
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

      // ---- AVAILABILITY CHECK ----
      const available = await isRoomAvailable(roomTypeId,roomTypeCode,inEl.value, outEl.value);
      if (!available) {
        alert('This cabin is NOT available for the selected dates.');
        return;
      }

      const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
      const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
      // ... (rest of your save logic stays exactly the same)

      
      // Calculate final discount
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
              .filter(e => idSet.has(String(e.extra_id)))
              .reduce((sum, e) => sum + e.price, 0);

            base = roomSubtotal + targetedExtrasTotal;
          } else {
            base = roomSubtotal + extrasTotal;
          }
          discount =
            appliedCoupon.discount_type === 'percentage'
              ? (base * appliedCoupon.discount_value) / 100
              : appliedCoupon.discount_value;

        } else if (appliedCoupon.applies_to === 'rooms') {
          discount = appliedCoupon.discount_type === 'percentage'
            ? (roomSubtotal * appliedCoupon.discount_value / 100)
            : appliedCoupon.discount_value;
        } else if (appliedCoupon.applies_to === 'extras') {
          discount = appliedCoupon.discount_type === 'percentage'
            ? (extrasTotal * appliedCoupon.discount_value / 100)
            : appliedCoupon.discount_value;
        }
        discount = Math.min(discount, subtotal);
      }
      
      const finalTotal = Math.max(0, roomSubtotal + extrasTotal - discount);
      const isInfluencer = wrap.querySelector('#nb-influencer').checked;

      // Create the reservation first
      const reservationPayload = {
        confirmation_code: genConfCode(),
        guest_first_name:  wrap.querySelector('#nb-first').value.trim() || null,
        guest_last_name:   wrap.querySelector('#nb-last').value.trim() || null,
        guest_email:       wrap.querySelector('#nb-email').value.trim() || null,
        country_code:      wrap.querySelector('#nb-country-code')?.value || null,
        guest_phone:       wrap.querySelector('#nb-phone').value.trim() || null,
        room_name:         roomName,
        room_type_id:      roomTypeId,
        room_type_code:    roomTypeCode,
        check_in:          wrap.querySelector('#nb-in').value || null,
        check_out:         wrap.querySelector('#nb-out').value || null,
        nights:            parseInt(wrap.querySelector('#nb-nights').value || '0', 10) || 0,
        adults:            parseInt(wrap.querySelector('#nb-adults').value || '0', 10) || 0,
        children:          parseInt(wrap.querySelector('#nb-children').value || '0', 10) || 0,
        is_influencer:     isInfluencer,
        status:            wrap.querySelector('#nb-status').value,
        payment_status:    wrap.querySelector('#nb-pay').value,
        currency:          wrap.querySelector('#nb-currency').value.trim() || 'GHS',
        room_subtotal:     roomSubtotal,
        extras_total:      extrasTotal,
        discount_amount:   discount,
        coupon_code:       appliedCoupon ? appliedCoupon.code : null,
        total:             finalTotal,
        notes:             wrap.querySelector('#nb-notes').value || null
      };

      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationPayload)
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Now insert extras into reservation_extras table if any selected
      if (selectedExtras.length > 0 && reservation) {
        const extrasPayload = selectedExtras.map(extra => ({
          reservation_id: reservation.id,
          extra_id: extra.extra_id,
          extra_code: extra.extra_code,
          extra_name: extra.extra_name,
          price: extra.price,
          quantity: extra.quantity,
          subtotal: extra.price * extra.quantity
        }));

        const { error: extrasError } = await supabase
          .from('reservation_extras')
          .insert(extrasPayload);

        if (extrasError) {
          console.error('Error saving extras:', extrasError);
        }
      }

      // Update coupon usage if applied
      if (appliedCoupon && reservation) {
        await supabase
          .from('coupons')
          .update({ current_uses: (appliedCoupon.current_uses || 0) + 1 })
          .eq('id', appliedCoupon.id);
      }

      toast('Reservation created');
      wrap.remove();
      toast('Reservation created');
      wrap.remove();

      // Refresh calendar/list
      if (typeof initReservations === 'function') {
        initReservations();
      }

      initReservations?.();
    } catch (e) {
      alert('Error saving: ' + (e.message || e));
    }
  });
}

// optional: hook a button with id="package-add-btn"
document.getElementById("package-add-btn")?.addEventListener("click", () => openPackageModal("add"));

// ---------- New Booking Buttons ----------
// ---- New Booking buttons: resilient binding (delegation + observer)
(function () {
  function onNewBookingClick(e) {
    const customBtn = e.target.closest('#new-custom-booking-btn, #mobile-custom-booking-btn');
    if (customBtn) {
      e.preventDefault();
      openNewCustomBookingModal();
      return;
    }
    const pkgBtn = e.target.closest('#book-package-btn, #mobile-package-btn');
    if (pkgBtn) {
      e.preventDefault();
      openBookPackageModal();
    }
  }

  // Delegation handles dynamically-added buttons
  document.addEventListener('click', onNewBookingClick, true);

  // Safety net: if the header is re-rendered later, attach direct listeners too
  const attachDirect = () => {
    const a = document.getElementById('new-custom-booking-btn');
    if (a && !a.__wired) {
      a.__wired = true;
      a.addEventListener('click', (e) => { e.preventDefault(); openNewCustomBookingModal(); });
    }
    const b = document.getElementById('book-package-btn');
    if (b && !b.__wired) {
      b.__wired = true;
      b.addEventListener('click', (e) => { e.preventDefault(); openBookPackageModal(); });
    }
    const mobileA = document.getElementById('mobile-custom-booking-btn');
    if (mobileA && !mobileA.__wired) {
      mobileA.__wired = true;
      mobileA.addEventListener('click', (e) => { e.preventDefault(); openNewCustomBookingModal(); });
    }
    const mobileB = document.getElementById('mobile-package-btn');
    if (mobileB && !mobileB.__wired) {
      mobileB.__wired = true;
      mobileB.addEventListener('click', (e) => { e.preventDefault(); openBookPackageModal(); });
    }
  };

  // Run once now and whenever DOM changes (header re-mounts)
  attachDirect();
  new MutationObserver(attachDirect).observe(document.body, { childList: true, subtree: true });
})();
}