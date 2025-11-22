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
import { openNewCustomBookingModal } from './custom_booking.js';
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
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth(); // 0–11

    // First day of current month (YYYY-MM-DD)
    const firstOfMonth = new Date(year, monthIndex, 1)
      .toISOString()
      .slice(0, 10);

    // First day of next month (YYYY-MM-DD) – safe for any month length
    const firstOfNextMonth = new Date(year, monthIndex + 1, 1)
      .toISOString()
      .slice(0, 10);

    const [
      checkins,   // count only
      confirmed,  // count only
      monthCnt,   // count only
      nightsSum   // rows (for sum)
    ] = await Promise.all([
      // Today's check-ins
      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .gte('check_in', today)
        .lte('check_in', today),

      // Active bookings (confirmed)
      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),

      // This month: check-in date in current month AND not cancelled / no-show
      supabase.from('reservations')
        .select('id', { count: 'exact', head: true })
        .gte('check_in', firstOfMonth)
        .lt('check_in', firstOfNextMonth)
        .not('status', 'in', '("cancelled","no_show")'),

      // Total nights booked
      supabase.from('reservations')
        .select('nights')
    ]);

    $('#stat-checkins').textContent = checkins?.count ?? 0;
    $('#stat-total').textContent    = confirmed?.count ?? 0;
    $('#stat-month').textContent    = monthCnt?.count ?? 0;
    $('#stat-nights').textContent   = (nightsSum?.data || [])
      .reduce((t, r) => t + (r.nights || 0), 0);
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
        .select(
          'guest_first_name,guest_last_name,confirmation_code,status,payment_status,created_at,room_name,check_in'
        )
        .order('created_at', { ascending: false })
        .limit(7);

      const rows = data || [];

      function renderStatusBadge(status) {
        if (!status) return '';
        const s = String(status).toLowerCase();

        switch (s) {
          case 'pending':
            return '<span class="badge pending">Pending</span>';
          case 'confirmed':
            return '<span class="badge ok">Confirmed</span>';
          case 'checked-in':
            return '<span class="badge checked-in">Checked in</span>';
          case 'checked-out':
            return '<span class="badge checked-out">Checked out</span>';
          case 'cancelled':
            return '<span class="badge err">Cancelled</span>';
          case 'no_show':
          case 'no-show':
            return '<span class="badge err">No-show</span>';
          default:
            return `<span class="badge">${status}</span>`;
        }
      }

      function renderPaymentBadge(paymentStatus) {
        if (!paymentStatus) return '';
        const p = String(paymentStatus).toLowerCase();

        switch (p) {
          case 'unpaid':
            return '<span class="badge err">Unpaid</span>';
          case 'partial':
          case 'partially_paid':
            return '<span class="badge partial">Partially paid</span>';
          case 'paid':
            return '<span class="badge ok">Paid</span>';
          case 'refunded':
            return '<span class="badge refunded">Refunded</span>';
          default:
            return `<span class="badge">${paymentStatus}</span>`;
        }
      }

      $('#recent-bookings').innerHTML =
        rows
          .map((r) => {
            const fullName = [r.guest_first_name, r.guest_last_name]
              .filter(Boolean)
              .join(' ') || 'Unknown guest';

            const when = r.check_in || '';
            const room = r.room_name || '';

            const statusBadge = renderStatusBadge(r.status);
            const paymentBadge = renderPaymentBadge(r.payment_status);

            return `
              <div class="recent-item">
                <div>
                  <div style="font-weight:700">${fullName}</div>
                  <div style="color:#6b7280">${room} • ${when}</div>
                  <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px">
                    ${statusBadge}
                    ${paymentBadge}
                  </div>
                </div>
                <span class="code">${r.confirmation_code || ''}</span>
              </div>
            `;
          })
          .join('') || 'No data';
    } catch (e) {
      $('#recent-bookings').textContent = 'Error loading';
    }
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