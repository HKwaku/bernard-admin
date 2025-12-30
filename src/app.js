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
import { initPricingModel } from './pricing-model/pricing_model.js';
import { initReservations } from './reservations.js';
import { initRooms } from './rooms.js';
import { initExtras } from './extras.js';
import { initCoupons } from './coupons.js';
import { initPackages } from './packages.js';
import { initChat } from './chat.js';
import { openBookPackageModal } from './package_booking.js';
import { openNewCustomBookingModal } from './custom_booking.js';
import { openBlockDatesModal } from './blocked_bookings.js'; // NEW

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
            <button class="tab" data-view="pricing-model">💷 Pricing Model</button>

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
              <li><button data-view="pricing-model" class="btn" style="width:100%">💷 Pricing Model</button></li>

              <li><hr style="border:0;border-top:1px solid var(--ring);margin:6px 0"></li>
              <li><button id="mobile-custom-booking-btn" class="btn btn-primary" style="width:100%">+New Booking</button></li>
              <li><button id="mobile-package-btn" class="btn btn-primary" style="width:100%">+New Package</button></li>
              <li><button id="mobile-block-dates-btn" class="btn btn-primary" style="width:100%">Block Dates</button></li>
              <li><hr style="border:0;border-top:1px solid var(--ring);margin:6px 0"></li>
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

            <div id="view-pricing-model" class="card panel">
              <div class="card-bd">
                <!-- Content injected by pricing_model.js -->
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
        'pricing-model': 'Pricing Model',

      };
      $('#section-title').textContent = titles[btn.dataset.view] || 'Dashboard';

      if (btn.dataset.view === 'chat') initChat();
      if (btn.dataset.view === 'reservations') initReservations();
      if (btn.dataset.view === 'rooms') initRooms();
      if (btn.dataset.view === 'extras') initExtras();
      if (btn.dataset.view === 'coupons') initCoupons();
      if (btn.dataset.view === 'packages') initPackages();
      if (btn.dataset.view === 'analytics') initAnalytics();
      if (btn.dataset.view === 'pricing-model') initPricingModel();
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

        // Handle menu actions
    mDrawer.querySelectorAll('button[data-view]').forEach((b) => {
      b.addEventListener('click', async () => {
        const view = b.getAttribute('data-view');
        close();

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

    // ---- Mobile booking buttons stay in the menu, but open the same modals ----
    const mobileCustomBookingBtn = $('#mobile-custom-booking-btn');
    if (mobileCustomBookingBtn && !mobileCustomBookingBtn.dataset._wired) {
      mobileCustomBookingBtn.dataset._wired = '1';
      mobileCustomBookingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        // Ensure Reservations view is active before opening modal
        const tab = document.querySelector('#tabs .tab[data-view="reservations"]');
        tab?.dispatchEvent(new Event('click', { bubbles: true }));
        openNewCustomBookingModal();
      });
    }

    const mobilePackageBtn = $('#mobile-package-btn');
    if (mobilePackageBtn && !mobilePackageBtn.dataset._wired) {
      mobilePackageBtn.dataset._wired = '1';
      mobilePackageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        const tab = document.querySelector('#tabs .tab[data-view="reservations"]');
        tab?.dispatchEvent(new Event('click', { bubbles: true }));
        openBookPackageModal();
      });
    }

        const mobileBlockDatesBtn = $('#mobile-block-dates-btn');
    if (mobileBlockDatesBtn && !mobileBlockDatesBtn.dataset._wired) {
      mobileBlockDatesBtn.dataset._wired = '1';
      mobileBlockDatesBtn.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        const tab = document.querySelector('#tabs .tab[data-view="reservations"]');
        tab?.dispatchEvent(new Event('click', { bubbles: true }));
        openBlockDatesModal();
      });
    }

  }

} // End of initApp

// ========== SHARED MODAL HELPER ==========
export function openSharedModal({
  id,
  title,
  subtitle,
  bodyHtml = '',
  footerHtml = '',
  onMount = () => {}
}) {
  // Remove any existing modal with same id
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'modal-backdrop';
  wrap.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  document.body.appendChild(wrap);

  // Click outside closes
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  wrap.innerHTML = `
    <div class="modal-dialog" style="background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="hd" style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="min-width:0">
            <h3 style="margin:0;color:white;font-size:20px;font-weight:700;">${title || ''}</h3>
            ${subtitle ? `<p style="margin:4px 0 0 0;color:rgba(255,255,255,0.9);font-size:13px;">${subtitle}</p>` : ''}
          </div>
          <button type="button" aria-label="Close" class="btn" data-modal-close style="background:transparent;border:none;color:white;font-size:26px;line-height:1;cursor:pointer;padding:0 6px;">
            ×
          </button>
        </div>
      </div>

      <div class="bd" style="padding:24px;overflow-y:auto;flex:1;">
        ${bodyHtml}
      </div>

      <div class="ft" style="padding:20px 24px;border-top:2px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;">
        ${footerHtml}
      </div>
    </div>
  `;

  // CRITICAL: Force width on mobile with JavaScript (overrides everything)
  const modalDialog = wrap.querySelector('.modal-dialog');
  if (modalDialog && window.innerWidth <= 768) {
    modalDialog.style.maxWidth = 'calc(100vw - 20px)';
    modalDialog.style.width = 'calc(100vw - 20px)';
    modalDialog.style.minWidth = '0';
    modalDialog.style.margin = '0 auto';
    modalDialog.style.boxSizing = 'border-box';
  }

  // Wire close button
  wrap.querySelector('[data-modal-close]')?.addEventListener('click', () => wrap.remove());

  // Let caller attach listeners
  onMount(wrap);

  return wrap;
}

export function closeSharedModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}