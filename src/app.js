// src/app.js
// Bernard Admin – main application script

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
          <div class="brand"><span class="bot">🤖</span> Bernard</div>

          <div class="tabs" id="tabs">
            <button class="tab active" data-view="chat">💬 Chat</button>
            <button class="tab" data-view="reservations">🗓️ Reservations</button>
            <button class="tab" data-view="rooms">🏠 Room Types</button>
            <button class="tab" data-view="extras">✨ Extras</button>
            <button class="tab" data-view="coupons">🎟️ Coupons</button>
            <button class="tab" data-view="packages">📦 Packages</button>
          </div>

          <button class="cta" id="new-booking-btn">+ New Booking</button>
          <div class="now" id="now"></div>

          <!-- Mobile menu button (moved to the RIGHT) -->
          <button
            id="mobile-menu-btn"
            class="mobile-menu-btn"
            aria-expanded="false"
            aria-controls="mobile-menu-drawer"
            title="Menu"
            style="
              margin-left:8px;
              border:1px solid var(--ring);
              background:#fff;
              color:#0f172a;
              border-radius:10px;
              padding:8px 12px;
              font-weight:800;
              cursor:pointer;
            "
          >☰</button>

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
              <li><button data-view="reservations" class="btn" style="width:100%">🗓️ Reservations</button></li>
              <li><button data-view="rooms"        class="btn" style="width:100%">🏠 Room Types</button></li>
              <li><button data-view="extras"       class="btn" style="width:100%">✨ Extras</button></li>
              <li><button data-view="coupons"      class="btn" style="width:100%">🎟️ Coupons</button></li>
              <li><button data-view="packages"     class="btn" style="width:100%">📦 Packages</button></li>
              <li><button data-view="newbooking"   class="btn" style="width:100%">➕ New Booking</button></li>
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
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
                  <input id="res-search" class="input" placeholder="Search name/email/code…" />
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
                </div>
                <div id="res-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-rooms" class="card panel">
              <div class="card-bd">
                <div id="rooms-list" class="list">Loading…</div>
              </div>
            </div>

            <div id="view-extras" class="card panel">
              <div class="card-bd">
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
                <div id="packages-list" class="list">Loading…</div>
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

      if (btn.dataset.view === 'reservations') initReservations();
      if (btn.dataset.view === 'rooms') initRooms();
      if (btn.dataset.view === 'extras') initExtras();
      if (btn.dataset.view === 'coupons') initCoupons();
      if (btn.dataset.view === 'packages') initPackages();
    })
  );

  // ---------- Mobile Menu (right-aligned dropdown) ----------
  const mBtn = $('#mobile-menu-btn');
  const mDrawer = $('#mobile-menu-drawer');

  if (mBtn && mDrawer) {
    const open = () => { mDrawer.hidden = false; mBtn.setAttribute('aria-expanded','true'); };
    const close = () => { mDrawer.hidden = true;  mBtn.setAttribute('aria-expanded','false'); };

    mBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mDrawer.hidden ? open() : close();
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!mDrawer.hidden && !mDrawer.contains(e.target) && e.target !== mBtn) {
        close();
      }
    });

    // Handle menu actions
    mDrawer.querySelectorAll('button[data-view]').forEach((b) => {
      b.addEventListener('click', async () => {
        const view = b.getAttribute('data-view');
        close();

        if (view === 'quickstats') {
          document.getElementById('quick-stats-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (view === 'recent') {
          document.getElementById('recent-bookings-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        if (view === 'newbooking') {
          document.getElementById('new-booking-btn')?.click();
          return;
        }

        // Delegate to the existing tab button (Reservations / Rooms / Extras / Coupons / Packages)
        const tab = document.querySelector(`#tabs .tab[data-view="${view}"]`);
        tab?.dispatchEvent(new Event('click', { bubbles: true }));
      });
    });
  }

  // ---------- Chat ----------
  addMessage(`Hello! My name is <strong>Bernard</strong>. What would you like to do today?`);
  $('#send-btn')?.addEventListener('click', send);
  $('#user-input')?.addEventListener('keydown', (e) => e.key === 'Enter' && send());
  async function send() {
    const el = $('#user-input');
    const text = (el?.value || '').trim();
    if (!text) return;
    addMessage(text, true);
    el.value = '';
    showTyping();
    try {
      const reply = await callOpenAI(conversationHistory, text);
      hideTyping();
      addMessage(reply || 'Done.');
    } catch (e) {
      hideTyping();
      addMessage('<span style="color:#b91c1c">✖ AI service temporarily unavailable.</span>');
      console.error(e);
    }
  }

  // ---------- Quick Stats ----------
  loadStats();
  async function loadStats() {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data: a } = await supabase.from('reservations').select('id').gte('check_in', today).lte('check_in', today);
      $('#stat-checkins').textContent = a?.length ?? 0;

      const { data: b } = await supabase.from('reservations').select('id').eq('status', 'confirmed');
      $('#stat-total').textContent = b?.length ?? 0;

      const n = new Date(),
        y = n.getFullYear(),
        m = String(n.getMonth() + 1).padStart(2, '0');
      const { data: c } = await supabase
        .from('reservations')
        .select('id')
        .gte('check_in', `${y}-${m}-01`)
        .lte('check_in', `${y}-${m}-31`);
      $('#stat-month').textContent = c?.length ?? 0;

      const { data: d } = await supabase.from('reservations').select('nights');
      $('#stat-nights').textContent = (d || []).reduce((t, r) => t + (r.nights || 0), 0);
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

  // ---------- Reservations ----------
  async function initReservations() {
    const list = $('#res-list');
    list.textContent = 'Loading…';
    const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
    if (error) {
      list.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    list.innerHTML = data
      .map(
        (r) => `
        <div class="item">
          <div class="row">
            <div>
              <div class="title">${r.guest_first_name} ${r.guest_last_name}</div>
              <div class="meta">${r.guest_email || ''}</div>
              <div class="meta">Room: <strong>${r.room_name || ''}</strong></div>
              <div class="meta">Check-in: ${r.check_in} • Check-out: ${r.check_out}</div>
              <div class="meta">Guests: ${r.adults || 1} • Nights: ${r.nights || 1}</div>
            </div>
            <div style="text-align:right;min-width:180px">
              <div class="code">${r.confirmation_code}</div>
              <div style="margin:6px 0">
                <span class="badge ${r.status === 'confirmed' ? 'ok' : 'err'}">${r.status}</span>
                <span class="badge ${r.payment_status === 'paid' ? 'ok' : 'err'}">${r.payment_status || 'unpaid'}</span>
              </div>
              <div class="price">${formatCurrency(r.total || 0, r.currency || 'GBP')}</div>
            </div>
          </div>
        </div>`
      )
      .join('');
  }

  // ---------- Rooms ----------
  async function initRooms() {
    const el = $('#rooms-list');
    el.textContent = 'Loading…';

    const { data, error } = await supabase
      .from('room_types')
      .select('code,name,base_price_per_night_weekday,base_price_per_night_weekend,currency,image_url,max_adults,description')
      .order('code', { ascending: true });

    if (error) {
      el.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    if (!data?.length) {
      el.innerHTML = `<div style="color:#6b7280">No room types found.</div>`;
      return;
    }

    const fmt = (n, cur) => formatCurrency(Number(n || 0), cur || 'GBP');

    el.innerHTML = data
      .map((r) => {
        const img = r.image_url
          ? `<img src="${r.image_url}" alt="${r.name}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;margin-right:10px;border:1px solid #e5e7eb" />`
          : '';
        const desc = r.description
          ? `<div class="meta" style="margin-top:6px;color:#6b7280">${r.description}</div>`
          : '';
        const adults = `<div class="meta" style="margin-top:6px;opacity:.8">Sleeps up to <strong>${r.max_adults || 1}</strong></div>`;

        return `
          <div class="item">
            <div class="row" style="align-items:center;gap:12px">
              ${img}
              <div style="flex:1">
                <div class="title">${(r.code ?? '—').toString().toUpperCase()}</div>
                <div class="meta">${r.name ?? ''}</div>
                ${desc}
                ${adults}
              </div>
              <div class="meta" style="text-align:right;min-width:220px">
                Weekday: <strong>${r.base_price_per_night_weekday != null ? fmt(r.base_price_per_night_weekday, r.currency) : 'n/a'}</strong>
                &nbsp;•&nbsp;
                Weekend: <strong>${r.base_price_per_night_weekend != null ? fmt(r.base_price_per_night_weekend, r.currency) : 'n/a'}</strong>
              </div>
            </div>
          </div>`;
      })
      .join('');
  }

  // ---------- Extras ----------
  async function initExtras() {
    const el = $('#extras-list');
    el.textContent = 'Loading…';
    const { data, error } = await supabase.from('extras').select('*').order('name', { ascending: true });
    if (error) {
      el.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    el.innerHTML = data
      .map(
        (x) => `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${x.name}</div>
            <div class="meta">${x.category || ''}</div>
            <div class="meta">${formatCurrency(x.price || 0, x.currency || 'GBP')}</div>
          </div>
          <div style="text-align:right">
            <span class="badge ${x.active !== false ? 'ok' : 'err'}">${x.active !== false ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>`
      )
      .join('');
  }

  // ---------- Coupons ----------
  async function initCoupons() {
    const el = $('#coupons-list');
    el.textContent = 'Loading…';
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    if (error) {
      el.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    el.innerHTML = data
      .map(
        (c) => `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${c.code}</div>
            <div class="meta">${c.description || ''}</div>
          </div>
          <div class="meta">${c.type || ''} ${c.value || ''}</div>
        </div>
      </div>`
      )
      .join('');
  }

  // ---------- Packages ----------
  async function initPackages() {
    const el = $('#packages-list');
    el.textContent = 'Loading…';
    const { data, error } = await supabase.from('packages').select('*').order('created_at', { ascending: false });
    if (error) {
      el.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    el.innerHTML = data
      .map(
        (p) => `
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${p.name}</div>
            <div class="meta">${(p.code || '').toUpperCase()}</div>
            ${p.description ? `<div class="meta" style="margin-top:6px">${p.description}</div>` : ''}
          </div>
          <div class="meta">
            Nights: <strong>${p.nights || 1}</strong> • Price: <strong>${formatCurrency(p.price || 0, p.currency || 'GBP')}</strong>
          </div>
        </div>
      </div>`
      )
      .join('');
  }
}
