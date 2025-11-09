// src/app.js
// Bernard Admin – main application script

import './styles.css';
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
      };
      $('#section-title').textContent = titles[btn.dataset.view] || 'Dashboard';

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
    
    // Create a status message element
    const statusDiv = document.createElement('div');
    statusDiv.className = 'msg bot';
    statusDiv.id = 'status-indicator';
    const statusBubble = document.createElement('div');
    statusBubble.className = 'bubble';
    statusBubble.style.fontStyle = 'italic';
    statusBubble.style.opacity = '0.8';
    statusBubble.textContent = '🤔 Thinking...';
    statusDiv.appendChild(statusBubble);
    
    const messagesDiv = $('#messages');
    if (messagesDiv) {
      messagesDiv.appendChild(statusDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    try {
      const reply = await callOpenAI(conversationHistory, text, (status) => {
        // Update status message
        if (status) {
          statusBubble.textContent = status;
        }
      });
      
      hideTyping();
      
      // Remove status indicator
      const statusIndicator = $('#status-indicator');
      if (statusIndicator) {
        statusIndicator.remove();
      }
      
      addMessage(reply || 'Done.');
    } catch (e) {
      hideTyping();
      
      // Remove status indicator
      const statusIndicator = $('#status-indicator');
      if (statusIndicator) {
        statusIndicator.remove();
      }
      
      addMessage('<span style="color:#b91c1c">✖ AI service temporarily unavailable.</span>');
      console.error(e);
    }
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

  // ---------- Reservations ----------
  let allReservations = [];
  let currentView = 'list'; // 'list' or 'calendar'
  
  async function initReservations() {
    const list = $('#res-list');
    list.textContent = 'Loading…';
    
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id,guest_first_name,guest_last_name,guest_email,guest_phone,confirmation_code,room_name,check_in,check_out,nights,adults,status,payment_status,total,currency,notes')
        .order('check_in', { ascending: false });
      
      if (error) {
        list.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
        return;
      }
      
      allReservations = data || [];
      setupReservationFilters();
      renderReservations();
    } catch (e) {
      list.innerHTML = `<div style="color:#b91c1c">Error loading reservations</div>`;
    }
  }
  const debounce = (fn, ms = 150) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// Search input filter
if (searchInput) {
  searchInput.addEventListener('input', debounce(() => renderReservations(), 180));
}

  function setupReservationFilters() {
    const searchInput = $('#res-search');
    const monthSelect = $('#res-month');
    const yearSelect = $('#res-year');
    const listBtn = $('#view-list-btn');
    const calendarBtn = $('#view-calendar-btn');
    
    // Populate year dropdown
    if (yearSelect) {
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
      yearSelect.innerHTML = '<option value="">All years</option>' + 
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    }
    
    // Search input filter
    if (searchInput) {
      searchInput.addEventListener('input', () => renderReservations());
    }
    
    // Month filter
    if (monthSelect) {
      monthSelect.addEventListener('change', () => renderReservations());
    }
    
    // Year filter
    if (yearSelect) {
      yearSelect.addEventListener('change', () => renderReservations());
    }
    
    // View toggle
    if (listBtn) {
      listBtn.addEventListener('click', () => {
        currentView = 'list';
        listBtn.classList.add('active');
        calendarBtn.classList.remove('active');
        renderReservations();
      });
    }
    
    if (calendarBtn) {
      calendarBtn.addEventListener('click', () => {
        currentView = 'calendar';
        calendarBtn.classList.add('active');
        listBtn.classList.remove('active');
        renderReservations();
      });
    }
  }
  
  function filterReservations() {
    const searchTerm = ($('#res-search')?.value || '').toLowerCase();
    const selectedMonth = $('#res-month')?.value;
    const selectedYear = $('#res-year')?.value;
    
    return allReservations.filter(r => {
      // Search filter
      if (searchTerm) {
        const searchable = [
          r.guest_first_name,
          r.guest_last_name,
          r.guest_email,
          r.confirmation_code
        ].join(' ').toLowerCase();
        
        if (!searchable.includes(searchTerm)) return false;
      }
      
      // Month filter
      if (selectedMonth !== '' && r.check_in) {
        const checkInDate = new Date(r.check_in);
        if (checkInDate.getMonth() !== parseInt(selectedMonth)) return false;
      }
      
      // Year filter
      if (selectedYear && r.check_in) {
        const checkInDate = new Date(r.check_in);
        if (checkInDate.getFullYear() !== parseInt(selectedYear)) return false;
      }
      
      return true;
    });
  }
  
  function renderReservations() {
    const filtered = filterReservations();
    
    if (currentView === 'list') {
      renderListView(filtered);
    } else {
      renderCalendarView(filtered);
    }
  }
  
  function renderListView(data) {
    const list = $('#res-list');
    const calendar = $('#res-calendar');
    
    if (list) list.style.display = 'block';
    if (calendar) calendar.style.display = 'none';
    
    if (!data || data.length === 0) {
      list.innerHTML = '<div style="color:#6b7280;padding:20px;text-align:center">No reservations found</div>';
      return;
    }
    
    list.innerHTML = data
      .map(r => `
        <div class="item" onclick="showReservationDetails('${r.confirmation_code}')" style="cursor:pointer">
          <div class="row">
            <div>
              <div class="title">${r.guest_first_name} ${r.guest_last_name}</div>
              <div class="meta">${r.guest_email || ''}</div>
              <div class="meta">Room: <strong>${r.room_name || ''}</strong></div>
              <div class="meta">Check-in: ${r.check_in} • Check-out: ${r.check_out}</div>
              <div class="meta">Guests: ${r.adults || 1} • Nights: ${r.nights || 1}</div>
            </div>

            <!-- right column – removed min-width to avoid stretch -->
            <div style="text-align:right">
              <div class="code">${r.confirmation_code}</div>
              <div style="margin:6px 0">
                <span class="badge ${r.status === 'confirmed' ? 'ok' : 'err'}">${r.status}</span>
                <span class="badge ${r.payment_status === 'paid' ? 'ok' : 'err'}">${r.payment_status || 'unpaid'}</span>
              </div>
              <div class="price">${formatCurrency(r.total || 0, r.currency || 'GHS')}</div>
            </div>
          </div>

          <!-- actions footer (same style as room types) -->
          <div class="room-card-footer" onclick="event.stopPropagation()">
            <button class="btn btn-sm" data-res-edit="${r.id}">Edit</button>
            <button class="btn btn-sm" data-res-delete="${r.id}" style="color:#b91c1c">Delete</button>
          </div>
        </div>
      `)
      .join('');
      list.querySelectorAll('[data-res-edit]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    reservationOpenEdit(btn.getAttribute('data-res-edit'));
  });
});
list.querySelectorAll('[data-res-delete]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    reservationDelete(btn.getAttribute('data-res-delete'));
  });
});
window.reservationOpenEdit = async function (id) {
  // tiny helper to coerce date strings -> YYYY-MM-DD for <input type="date">
  const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  try {
    const { data: r, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;

    // pick whichever room field your schema uses
    const roomFieldKey = ('room_type_code' in r) ? 'room_type_code'
                        : ('room_code' in r) ? 'room_code'
                        : ('room_name' in r) ? 'room_name'
                        : null;

    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'reservation-modal';
    modal.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3>Edit Reservation</h3>
          <button class="btn" onclick="this.closest('#reservation-modal').remove()">×</button>
        </div>

        <div class="bd">
          <div class="form-grid">
            <div class="form-group">
              <label>First Name</label>
              <input id="res-first" type="text" value="${r.guest_first_name || ''}" />
            </div>
            <div class="form-group">
              <label>Last Name</label>
              <input id="res-last" type="text" value="${r.guest_last_name || ''}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Email</label>
              <input id="res-email" type="email" value="${r.guest_email || ''}" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input id="res-phone" type="text" value="${r.guest_phone || ''}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Check-in</label>
              <input id="res-in" type="date" value="${toDateInput(r.check_in)}" />
            </div>
            <div class="form-group">
              <label>Check-out</label>
              <input id="res-out" type="date" value="${toDateInput(r.check_out)}" />
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Adults</label>
              <input id="res-adults" type="number" min="1" step="1" value="${r.adults ?? 1}" />
            </div>
            <div class="form-group">
              <label>Children</label>
              <input id="res-children" type="number" min="0" step="1" value="${r.children ?? 0}" />
            </div>
          </div>

          ${roomFieldKey ? `
          <div class="form-group">
            <label>${roomFieldKey.replace(/_/g,' ')}</label>
            <input id="res-room" type="text" value="${r[roomFieldKey] || ''}" />
          </div>` : ''}

          <div class="form-grid">
            <div class="form-group">
              <label>Status</label>
              <select id="res-status">
                <option value="pending" ${r.status==='pending'?'selected':''}>pending</option>
                <option value="confirmed" ${r.status==='confirmed'?'selected':''}>confirmed</option>
                <option value="cancelled" ${r.status==='cancelled'?'selected':''}>cancelled</option>
              </select>
            </div>
            <div class="form-group">
              <label>Payment Status</label>
              <select id="res-pay">
                <option value="unpaid" ${r.payment_status==='unpaid'?'selected':''}>unpaid</option>
                <option value="paid" ${r.payment_status==='paid'?'selected':''}>paid</option>
                <option value="refunded" ${r.payment_status==='refunded'?'selected':''}>refunded</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Currency</label>
              <input id="res-currency" type="text" value="${r.currency || 'GHS'}" />
            </div>
            <div class="form-group">
              <label>Total</label>
              <input id="res-total" type="number" step="0.01" value="${r.total ?? ''}" />
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea id="res-notes" rows="3">${r.notes || ''}</textarea>
          </div>
        </div>

        <div class="ft">
          <button class="btn" onclick="this.closest('#reservation-modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="res-edit-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#res-edit-save').addEventListener('click', async () => {
      const payload = {
        guest_first_name: modal.querySelector('#res-first').value.trim() || null,
        guest_last_name:  modal.querySelector('#res-last').value.trim() || null,
        guest_email:      modal.querySelector('#res-email').value.trim() || null,
        guest_phone:      modal.querySelector('#res-phone').value.trim() || null,
        check_in:         modal.querySelector('#res-in').value || null,
        check_out:        modal.querySelector('#res-out').value || null,
        adults:           parseInt(modal.querySelector('#res-adults').value || '0', 10) || 0,
        children:         parseInt(modal.querySelector('#res-children').value || '0', 10) || 0,
        status:           modal.querySelector('#res-status').value,
        payment_status:   modal.querySelector('#res-pay').value,
        currency:         modal.querySelector('#res-currency').value.trim() || null,
        total:            (modal.querySelector('#res-total').value === '' ? null : parseFloat(modal.querySelector('#res-total').value)),
        notes:            modal.querySelector('#res-notes').value || null
      };

      if (roomFieldKey) {
        payload[roomFieldKey] = modal.querySelector('#res-room').value.trim() || null;
      }

      const { error: upErr } = await supabase.from('reservations').update(payload).eq('id', id);
      if (upErr) { alert('Error saving: ' + upErr.message); return; }
      modal.remove();
      toast('Reservation updated');
      initReservations();
    });
  } catch (e) {
    console.error(e);
    alert('Error loading reservation: ' + (e.message || e));
  }
};

window.reservationDelete = async function (id) {
  if (!confirm('Delete this reservation? This cannot be undone.')) return;
  try {
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) throw error;
    toast('Reservation deleted');
    initReservations();
  } catch (e) {
    console.error(e);
    alert('Error deleting reservation: ' + (e.message || e));
  }
};

  }
  
  function renderCalendarView(data) {
    const list = $('#res-list');
    const calendar = $('#res-calendar');
    
    if (list) list.style.display = 'none';
    if (calendar) calendar.style.display = 'block';
    
    // Determine which month to show
    const selectedMonth = $('#res-month')?.value;
    const selectedYear = $('#res-year')?.value;
    
    let displayDate;
    if (selectedMonth !== '' && selectedYear) {
      displayDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
    } else if (selectedYear) {
      displayDate = new Date(parseInt(selectedYear), new Date().getMonth(), 1);
    } else if (selectedMonth !== '') {
      displayDate = new Date(new Date().getFullYear(), parseInt(selectedMonth), 1);
    } else {
      displayDate = new Date();
    }
    
    renderCalendar(displayDate, data);
  }
  
  function renderCalendar(date, reservations) {
    const calendar = $('#res-calendar');
    if (!calendar) return;
    
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const monthDays = lastDay.getDate();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Group reservations by date
    const reservationsByDate = {};
    reservations.forEach(r => {
      const checkIn = new Date(r.check_in);
      const checkOut = new Date(r.check_out);
      
      // Add reservation to all dates it spans
      for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year) {
          const dateKey = d.getDate();
          if (!reservationsByDate[dateKey]) reservationsByDate[dateKey] = [];
          reservationsByDate[dateKey].push(r);
        }
      }
    });
    
    let calendarHTML = `
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
      calendarHTML += '<div class="calendar-day empty"></div>';
    }
    
    // Days of the month
    for (let day = 1; day <= monthDays; day++) {
      const bookings = reservationsByDate[day] || [];
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      
      calendarHTML += `
        <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}">
          <div class="calendar-day-number">${day}</div>
          <div class="calendar-bookings">
            ${bookings.slice(0, 3).map(b => {
              const checkIn = new Date(b.check_in);
              const isCheckIn = checkIn.getDate() === day && checkIn.getMonth() === month;
              return `
                <div class="calendar-booking ${isCheckIn ? 'check-in' : 'staying'}" 
                     onclick="showReservationDetails('${b.confirmation_code}')"
                     title="${b.guest_first_name} ${b.guest_last_name} - ${b.room_name}">
                  ${isCheckIn ? '→ ' : ''}${b.guest_first_name} ${b.guest_last_name.charAt(0)}.
                </div>
              `;
            }).join('')}
            ${bookings.length > 3 ? `<div class="calendar-more">+${bookings.length - 3} more</div>` : ''}
          </div>
        </div>
      `;
    }
    
    calendarHTML += `
        </div>
      </div>
    `;
    
    calendar.innerHTML = calendarHTML;
    
    // Add navigation handlers
    $('#prev-month')?.addEventListener('click', () => {
      const prevMonth = new Date(year, month - 1, 1);
      renderCalendar(prevMonth, reservations);
    });
    
    $('#next-month')?.addEventListener('click', () => {
      const nextMonth = new Date(year, month + 1, 1);
      renderCalendar(nextMonth, reservations);
    });
  }
  
  // Global function to show reservation details
  window.showReservationDetails = async (confirmationCode) => {
    const reservation = allReservations.find(r => r.confirmation_code === confirmationCode);
    if (!reservation) return;
    
    const details = `
      <div style="line-height:1.8">
        <h3 style="margin:0 0 15px 0">${reservation.guest_first_name} ${reservation.guest_last_name}</h3>
        <p><strong>Email:</strong> ${reservation.guest_email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${reservation.guest_phone || 'N/A'}</p>
        <p><strong>Confirmation Code:</strong> <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">${reservation.confirmation_code}</code></p>
        <p><strong>Room:</strong> ${reservation.room_name || 'N/A'}</p>
        <p><strong>Check-in:</strong> ${reservation.check_in}</p>
        <p><strong>Check-out:</strong> ${reservation.check_out}</p>
        <p><strong>Nights:</strong> ${reservation.nights || 1}</p>
        <p><strong>Guests:</strong> ${reservation.adults || 1} adults</p>
        <p><strong>Status:</strong> <span class="badge ${reservation.status === 'confirmed' ? 'ok' : 'err'}">${reservation.status}</span></p>
        <p><strong>Payment:</strong> <span class="badge ${reservation.payment_status === 'paid' ? 'ok' : 'err'}">${reservation.payment_status || 'unpaid'}</span></p>
        <p><strong>Total:</strong> ${formatCurrency(reservation.total || 0, reservation.currency || 'GHS')}</p>
        ${reservation.notes ? `<p><strong>Notes:</strong> ${reservation.notes}</p>` : ''}
      </div>
    `;
    
    // Show in a simple alert for now (you can enhance this with a modal)
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center" onclick="this.remove()">
        <div style="background:white;padding:30px;border-radius:12px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
          ${details}
          <button class="btn" onclick="this.closest('div[style*=fixed]').remove()" style="margin-top:20px;width:100%">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };


  // ---------- Rooms ----------
  async function initRooms() {
    // Add event listener for Add Room button
    const addBtn = $('#add-room-btn');
    if (addBtn) {
      // Remove existing listener to avoid duplicates
      const newBtn = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(newBtn, addBtn);
      newBtn.addEventListener('click', () => openRoomModal());
    }

    const el = $('#rooms-list');
    el.textContent = 'Loading…';

    const { data, error } = await supabase
      .from('room_types')
      .select('*')
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
        const adults = `<div class="meta" style="margin-top:6px;opacity:.8">Sleeps up to <strong>${r.max_adults || 1}</strong></div>`;
        const isActive = r.is_active !== false;

        return `
  <div class="item">
    <!-- Top section: image + content -->
    <div class="room-card-top">
      <div class="room-card-media">
        ${r.image_url ? `<img src="${r.image_url}" alt="${r.name || ''}">` : ''}
      </div>
      <div>
        <div class="room-card-header">
          <div>
            <h3 class="room-card-title">${r.name ?? ''}</h3>
            <div class="meta" style="margin-top:6px;opacity:.8">
              Sleeps up to <strong>${r.max_adults || 1}</strong>
            </div>
          </div>
          <span class="badge ${isActive ? 'ok' : 'err'}">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div class="room-card-body">
          <div class="room-card-price-row">
            <span>Weekday:</span>
            <strong>${
              r.base_price_per_night_weekday != null
                ? fmt(r.base_price_per_night_weekday, r.currency)
                : 'n/a'
            }</strong>
          </div>
          <div class="room-card-price-row">
            <span>Weekend:</span>
            <strong>${
              r.base_price_per_night_weekend != null
                ? fmt(r.base_price_per_night_weekend, r.currency)
                : 'n/a'
            }</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer actions -->
    <div class="room-card-footer">
      <button class="btn btn-sm" data-room-edit="${r.id}">Edit</button>
      <button
        class="btn btn-sm"
        data-room-toggle="${r.id}"
        data-room-active="${isActive}"
      >
        ${isActive ? 'Deactivate' : 'Activate'}
      </button>
      <button
        class="btn btn-sm"
        data-room-delete="${r.id}"
        style="color:#b91c1c"
      >
        Delete
      </button>
    </div>
  </div>`;
      })
      .join('');

    // Attach event listeners
    el.querySelectorAll('[data-room-edit]').forEach(btn => {
      btn.addEventListener('click', () => openRoomModal(btn.dataset.roomEdit));
    });
    el.querySelectorAll('[data-room-toggle]').forEach(btn => {
      btn.addEventListener('click', () => toggleRoomStatus(btn.dataset.roomToggle, btn.dataset.roomActive === 'true'));
    });
    el.querySelectorAll('[data-room-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteRoom(btn.dataset.roomDelete));
    });
  }

  // Room Modal
  function openRoomModal(id = null) {
    const modal = document.createElement('div');
    modal.id = 'room-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="content">
        <div class="hd">
          <h3 id="room-modal-title" style="margin:0">${id ? 'Edit Room Type' : 'Add Room Type'}</h3>
          <button id="room-close" class="btn">×</button>
        </div>
        <div class="bd">
          <div id="room-error" class="muted" style="min-height:18px"></div>

          <div class="form-grid">
            <div class="form-group">
              <label>Code *</label>
              <input id="r-code" required style="text-transform:uppercase" />
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input id="r-name" required />
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea id="r-desc" rows="3" style="resize:vertical"></textarea>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Weekday Price *</label>
              <input id="r-weekday" type="number" step="0.01" required />
            </div>
            <div class="form-group">
              <label>Weekend Price *</label>
              <input id="r-weekend" type="number" step="0.01" required />
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select id="r-currency">
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GHS">GHS (₵)</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Max Adults</label>
              <input id="r-max-adults" type="number" min="1" value="2" />
            </div>
            <div class="form-group">
              <label>Active</label>
              <select id="r-active">
                <option value="true" selected>Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Image URL</label>
            <input id="r-image" type="url" placeholder="https://..." />
          </div>
        </div>
        <div class="ft">
          <button class="btn" id="room-cancel">Cancel</button>
          <button class="btn btn-primary" id="room-save">${id ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close handlers
    const close = () => modal.remove();
    $('#room-close').addEventListener('click', close);
    $('#room-cancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // If editing, fetch & populate
    if (id) {
      fillRoomForm(id).catch(err => {
        $('#room-error').textContent = 'Error loading room: ' + (err.message || err);
      });
    }

    // Save
    $('#room-save').addEventListener('click', async () => {
      try {
        const payload = collectRoomForm();
        let result;
        if (id) {
          result = await supabase.from('room_types').update(payload).eq('id', id);
        } else {
          result = await supabase.from('room_types').insert(payload);
        }
        if (result.error) throw result.error;
        close();
        await initRooms();
        toast(`Room type ${id ? 'updated' : 'created'} successfully`);
      } catch (e) {
        $('#room-error').textContent = 'Error saving: ' + (e.message || e);
      }
    });
  }

  function collectRoomForm() {
    const code = $('#r-code').value.trim().toUpperCase();
    const name = $('#r-name').value.trim();
    const description = $('#r-desc').value.trim() || null;
    const base_price_per_night_weekday = parseFloat($('#r-weekday').value);
    const base_price_per_night_weekend = parseFloat($('#r-weekend').value);
    const currency = $('#r-currency').value;
    const max_adults = parseInt($('#r-max-adults').value, 10) || 2;
    const active = $('#r-active').value === 'true';
    const image_url = $('#r-image').value.trim() || null;

    if (!code || !name || Number.isNaN(base_price_per_night_weekday) || Number.isNaN(base_price_per_night_weekend)) {
      throw new Error('Code, Name, and Prices are required.');
    }
    return {
      code,
      name,
      description,
      base_price_per_night_weekday,
      base_price_per_night_weekend,
      currency,
      max_adults,
      is_active: active, // map local `active` to DB column
      image_url
    };
  }

  async function fillRoomForm(id) {
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    const r = data;

    $('#r-code').value = (r.code || '').toUpperCase();
    $('#r-name').value = r.name || '';
    $('#r-desc').value = r.description || '';
    $('#r-weekday').value = r.base_price_per_night_weekday ?? '';
    $('#r-weekend').value = r.base_price_per_night_weekend ?? '';
    $('#r-currency').value = r.currency || 'GBP';
    $('#r-max-adults').value = r.max_adults ?? 2;
    $('#r-active').value = (r.is_active !== false) ? 'true' : 'false';
    $('#r-image').value = r.image_url || '';
  }

  async function toggleRoomStatus(id, currentStatus) {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('room_types')
        .update({ is_active: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      await initRooms();
      toast(`Room ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (e) {
      console.error('Toggle room status error:', e);
      alert('Error updating room status: ' + (e.message || e));
    }
  }

  async function deleteRoom(id) {
    if (!confirm('Are you sure you want to delete this room type? This action cannot be undone.')) {
      return;
    }
    const { error } = await supabase.from('room_types').delete().eq('id', id);
    if (error) {
      toast('Error deleting room: ' + error.message, 'error');
      return;
    }
    await initRooms();
    toast('Room type deleted successfully');
  }

  // ---------- Extras ----------
  async function initExtras() {
    // Add event listener for Add Extra button
    const addBtn = $('#add-extra-btn');
    if (addBtn) {
      // Remove existing listener to avoid duplicates
      const newBtn = addBtn.cloneNode(true);
      addBtn.parentNode.replaceChild(newBtn, addBtn);
      newBtn.addEventListener('click', () => openExtraModal());
    }

    const el = $('#extras-list');
    el.textContent = 'Loading…';
    const { data, error } = await supabase.from('extras').select('*').order('name', { ascending: true });
    if (error) {
      el.innerHTML = `<div style="color:#b91c1c">Error: ${error.message}</div>`;
      return;
    }
    if (!data?.length) {
      el.innerHTML = `<div style="color:#6b7280">No extras found.</div>`;
      return;
    }
    el.innerHTML = data
      .map((x) => {
        const isActive = x.is_active !== false;
        return `
        <div class="item">
          <div class="row" style="align-items:flex-start;gap:12px">
            <div style="flex:1">
              <div class="title">${x.name || ''}</div>
              <div class="meta">${x.category || ''}</div>
              ${x.description ? `<div class="meta" style="margin-top:6px;color:#6b7280">${x.description}</div>` : ''}
              <div class="meta" style="margin-top:8px">
                Price: <strong>${formatCurrency(x.price || 0, x.currency || 'GHS')}</strong> • ${x.unit_type || ''}
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${isActive ? 'ok' : 'err'}">${isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          <div class="room-card-footer">
            <button class="btn btn-sm" data-extra-edit="${x.id}">Edit</button>
            <button class="btn btn-sm" data-extra-toggle="${x.id}" data-extra-active="${isActive}">${isActive ? 'Deactivate' : 'Activate'}</button>
            <button class="btn btn-sm" data-extra-delete="${x.id}" style="color:#b91c1c">Delete</button>
          </div>
        </div>
      </div>`;
      })
      .join('');

    // Attach event listeners
    el.querySelectorAll('[data-extra-edit]').forEach(btn => {
      btn.addEventListener('click', () => openExtraModal(btn.dataset.extraEdit));
    });
    el.querySelectorAll('[data-extra-toggle]').forEach(btn => {
      btn.addEventListener('click', () => toggleExtraStatus(btn.dataset.extraToggle, btn.dataset.extraActive === 'true'));
    });
    el.querySelectorAll('[data-extra-delete]').forEach(btn => {
      btn.addEventListener('click', () => deleteExtra(btn.dataset.extraDelete));
    });
  }

  // Extra Modal
  function openExtraModal(id = null) {
    const modal = document.createElement('div');
    modal.id = 'extra-modal';
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
      <div class="content">
        <div class="hd">
          <h3 id="extra-modal-title" style="margin:0">${id ? 'Edit Extra' : 'Add Extra'}</h3>
          <button id="extra-close" class="btn">×</button>
        </div>
        <div class="bd">
          <div id="extra-error" class="muted" style="min-height:18px"></div>

          <div class="form-grid">
            <div class="form-group">
              <label>Name *</label>
              <input id="e-name" required />
            </div>
            <div class="form-group">
              <label>Category</label>
              <input id="e-category" placeholder="e.g., Food, Activity, Service" />
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea id="e-desc" rows="3" style="resize:vertical"></textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Price *</label>
              <input id="e-price" type="number" step="0.01" required />
            </div>
            <div class="form-group">
              <label>Currency</label>
              <select id="e-currency">
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GHS">GHS (₵)</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Unit Type</label>
              <select id="e-unit-type">
                <option value="per_booking">Per Booking</option>
                <option value="per_night">Per Night</option>
                <option value="per_person">Per Person</option>
                <option value="per_person_per_night">Per Person Per Night</option>
              </select>
            </div>
            <div class="form-group">
              <label>Active</label>
              <select id="e-active">
                <option value="true" selected>Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>
        <div class="ft">
          <button class="btn" id="extra-cancel">Cancel</button>
          <button class="btn btn-primary" id="extra-save">${id ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close handlers
    const close = () => modal.remove();
    $('#extra-close').addEventListener('click', close);
    $('#extra-cancel').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // If editing, fetch & populate
    if (id) {
      fillExtraForm(id).catch(err => {
        $('#extra-error').textContent = 'Error loading extra: ' + (err.message || err);
      });
    }

    // Save
    $('#extra-save').addEventListener('click', async () => {
      try {
        const payload = collectExtraForm();
        let result;
        if (id) {
          result = await supabase.from('extras').update(payload).eq('id', id);
        } else {
          result = await supabase.from('extras').insert(payload);
        }
        if (result.error) throw result.error;
        close();
        await initExtras();
        toast(`Extra ${id ? 'updated' : 'created'} successfully`);
      } catch (e) {
        $('#extra-error').textContent = 'Error saving: ' + (e.message || e);
      }
    });
  }

  function collectExtraForm() {
    const root = document.getElementById('extra-modal') || document;
    const name = root.querySelector('#e-name').value.trim();
    const category = root.querySelector('#e-category').value.trim() || null;
    const description = root.querySelector('#e-desc').value.trim() || null;
    const price = parseFloat(root.querySelector('#e-price').value);
    const currency = root.querySelector('#e-currency').value;
    const unit_type = root.querySelector('#e-unit-type').value;
    const active = root.querySelector('#e-active').value === 'true';

    if (!name || Number.isNaN(price)) {
      throw new Error('Name and Price are required.');
    }
    return {
      name,
      category,
      description,
      price,
      currency,
      unit_type,
      is_active: active     // map local `active` to DB column
    };
  }

  async function fillExtraForm(id) {
    const { data, error } = await supabase
      .from('extras')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    const e = data;
    const root = document.getElementById('extra-modal') || document;
    root.querySelector('#e-name').value = e.name || '';
    root.querySelector('#e-category').value = e.category || '';
    root.querySelector('#e-desc').value = e.description || '';
    root.querySelector('#e-price').value = e.price ?? '';
     root.querySelector('#e-currency').value = e.currency || 'GBP';
     root.querySelector('#e-unit-type').value = e.unit_type || 'per_booking';
     root.querySelector('#e-active').value = (e.is_active !== false) ? 'true' : 'false';
  }

  async function toggleExtraStatus(id, currentStatus) {
    const newStatus = !currentStatus;
    try {
      const { error } = await supabase
        .from('extras')
        .update({ is_active: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      await initExtras();
      toast(`Extra ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (e) {
      console.error('Toggle extra status error:', e);
      alert('Error updating extra status: ' + (e.message || e));
    }
  }

  async function deleteExtra(id) {
    if (!confirm('Are you sure you want to delete this extra? This action cannot be undone.')) {
      return;
    }
    const { error } = await supabase.from('extras').delete().eq('id', id);
    if (error) {
      toast('Error deleting extra: ' + error.message, 'error');
      return;
    }
    await initExtras();
    toast('Extra deleted successfully');
  }

/* =========================
   COUPONS (self-contained)
   Supabase columns:
   id, code, description, discount_type, discount_value,
   applies_to, valid_from, valid_until,
   max_uses, current_uses, max_uses_per_guest,
   min_booking_amount, is_active, created_at, updated_at, created_by
   ========================= */

// ---- Utilities local to this module ----
function $$sel(s, root = document) { return Array.from(root.querySelectorAll(s)); }
function $sel(s, root = document) { return root.querySelector(s); }
function coupons_nowISO(){ return new Date().toISOString(); }

// ---- List + header ----
async function initCoupons() {
  const panel = $sel('#view-coupons');
  if (!panel) return;

  panel.innerHTML = `
    <div style="display: flex; justify-content: flex-end; margin: 4px 14px 4px 0; padding-top: 2px;">
  <button class="btn" id="coupon-add-btn" style="margin-top: 8px;">+ Add Coupon</button>
    </div>
    <div id="coupons-list"><div class="muted">Loading…</div></div>
  `;

  $sel('#coupon-add-btn')?.addEventListener('click', () => coupons_openForm()); // ADD

  await coupons_renderList();
}

async function coupons_renderList() {
  const r = $sel('#coupons-list');
  if (!r) return;

  r.innerHTML = '<div class="muted" style="padding:12px">Loading…</div>';

  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('id,code,description,discount_type,discount_value,applies_to,valid_from,valid_until,max_uses,current_uses,max_uses_per_guest,min_booking_amount,is_active,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    if (!rows.length) {
      r.innerHTML = '<div class="muted" style="padding:20px">No coupons found.</div>';
      return;
    }

    r.innerHTML = rows.map(c => {
      const discountLabel = c.discount_type === 'percentage' ? `${c.discount_value}%` : `GHS${c.discount_value}`;
      const appliesToLabel = c.applies_to === 'both' ? 'both' : c.applies_to;
      const isActive = c.is_active;
      
      return `
          <div class="item coupon-card" data-id="${c.id}">
            <div class="row">
              <div style="flex:1">
                <div class="title">${(c.code||'').toUpperCase()}</div>
                <div class="meta"><strong style="color:#0f172a">${discountLabel} off</strong> · ${appliesToLabel}</div>
                ${c.description ? `<div class="meta" style="margin-top:6px;color:#6b7280">${c.description}</div>` : ''}
                <div class="meta" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:16px">
                  <span>Used <strong style="color:#0f172a">${c.current_uses ?? 0}${c.max_uses ? `/${c.max_uses}` : ''}</strong></span>
                  ${c.max_uses_per_guest ? `<span>Max <strong style="color:#0f172a">${c.max_uses_per_guest}</strong>/guest</span>` : ''}
                  ${c.min_booking_amount ? `<span>Min <strong style="color:#0f172a">£${c.min_booking_amount}</strong></span>` : ''}
                  ${c.valid_from || c.valid_until ? `<span>${c.valid_from ? new Date(c.valid_from).toLocaleDateString() : '∞'} → ${c.valid_until ? new Date(c.valid_until).toLocaleDateString() : '∞'}</span>` : ''}
                </div>
              </div>
              <div style="text-align:right">
                <span class="badge ${isActive ? 'ok' : 'err'}">${isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div class="room-card-footer">
              <button class="btn btn-sm" data-action="edit" data-id="${c.id}">Edit</button>
              <button class="btn btn-sm" data-action="toggle" data-id="${c.id}" data-active="${isActive}">${isActive ? 'Deactivate' : 'Activate'}</button>
              <button class="btn btn-sm" data-action="delete" data-id="${c.id}" style="color:#b91c1c">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // wire row actions
    $$sel('button[data-action="edit"]', r).forEach(btn =>
      btn.addEventListener('click', () => coupons_openForm(btn.dataset.id)) // EDIT
    );
    $$sel('button[data-action="toggle"]', r).forEach(btn =>
      btn.addEventListener('click', () => coupons_toggleStatus(btn.dataset.id, btn.dataset.active === 'true')) // TOGGLE
    );
    $$sel('button[data-action="delete"]', r).forEach(btn =>
      btn.addEventListener('click', () => coupons_delete(btn.dataset.id)) // DELETE
    );

  } catch (e) {
    console.error(e);
    r.innerHTML = `<div style="color:#b91c1c">Error: ${e.message || e}</div>`;
  }
}

// ---- Toggle status (activate/deactivate) ----
async function coupons_toggleStatus(id, currentStatus) {
  if (!id) return;
  const newStatus = !currentStatus;
  const action = newStatus ? 'activate' : 'deactivate';
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this coupon?`)) return;

  try {
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: newStatus, updated_at: coupons_nowISO() })
      .eq('id', id);
    if (error) throw error;
    await coupons_renderList();
  } catch (e) {
    alert('Failed: ' + (e.message || e));
  }
}

// ---- Delete coupon ----
async function coupons_delete(id) {
  if (!id) return;
  if (!confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;

  try {
    const { error } = await supabase
      .from('coupons')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await coupons_renderList();
  } catch (e) {
    alert('Failed to delete: ' + (e.message || e));
  }
}

// ---- Modal form (Add / Edit) ----
function coupons_openForm(id /* optional */) {
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.id = 'coupon-modal';

  // basic once-off styles (only if you don’t already have .modal)
  if (!$sel('#coupon-modal-inline-styles')) {
    const style = document.createElement('style');
    style.id = 'coupon-modal-inline-styles';
    style.textContent = `
      .modal.show{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.35);z-index:999}
      .modal .content{background:#fff;border-radius:12px;max-width:680px;width:92vw;box-shadow:0 10px 30px rgba(0,0,0,.15)}
      .modal .hd{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #e5e7eb}
      .modal .bd{padding:16px}
      .modal .ft{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end}
      .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .form-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      .form-group{display:flex;flex-direction:column;gap:6px}
      .form-group input, .form-group select{padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px}
      .muted{color:#64748b}
      @media (max-width:720px){.form-grid,.form-grid-3{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  modal.innerHTML = `
    <div class="content">
      <div class="hd">
        <h3 id="coupon-modal-title" style="margin:0">${id ? 'Edit Coupon' : 'Add Coupon'}</h3>
        <button id="coupon-close" class="btn">×</button>
      </div>
      <div class="bd">
        <div id="coupon-error" class="muted" style="min-height:18px"></div>

        <div class="form-grid">
          <div class="form-group">
            <label>Code *</label>
            <input id="c-code" required style="text-transform:uppercase" />
          </div>
          <div class="form-group">
            <label>Applies To *</label>
            <select id="c-applies">
              <option value="both">Both</option>
              <option value="rooms">Rooms Only</option>
              <option value="extras">Extras Only</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Discount Type *</label>
            <select id="c-type">
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </div>
          <div class="form-group">
            <label>Discount Value *</label>
            <input id="c-value" type="number" step="0.01" required />
          </div>
        </div>

        <div class="form-group">
          <label>Description</label>
          <input id="c-desc" />
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label>Valid From</label>
            <input id="c-from" type="date" />
          </div>
          <div class="form-group">
            <label>Valid Until</label>
            <input id="c-until" type="date" />
          </div>
          <div class="form-group">
            <label>Active</label>
            <select id="c-active">
              <option value="true" selected>Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Max Uses (overall)</label>
            <input id="c-max" type="number" />
          </div>
          <div class="form-group">
            <label>Max Uses per Guest</label>
            <input id="c-max-guest" type="number" />
          </div>
        </div>

        <div class="form-group">
          <label>Min Booking Amount (GHS)</label>
          <input id="c-min" type="number" step="0.01" />
        </div>
      </div>
      <div class="ft">
        <button class="btn" id="coupon-cancel">Cancel</button>
        <button class="btn btn-primary" id="coupon-save">${id ? 'Update' : 'Create'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close handlers
  const close = () => modal.remove();
  $sel('#coupon-close', modal).addEventListener('click', close);
  $sel('#coupon-cancel', modal).addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  // If editing, fetch & populate
  if (id) {
    coupons_fillForm(id).catch(err => {
      $sel('#coupon-error').textContent = 'Error loading coupon: ' + (err.message || err);
    });
  }

  // Save
  $sel('#coupon-save', modal).addEventListener('click', async () => {
    try {
      const payload = coupons_collectForm();
      let result;
      if (id) {
        result = await supabase.from('coupons').update({ ...payload, updated_at: coupons_nowISO() }).eq('id', id);
      } else {
        result = await supabase.from('coupons').insert({ ...payload, created_at: coupons_nowISO(), updated_at: coupons_nowISO(), current_uses: 0 });
      }
      if (result.error) throw result.error;
      close();
      await coupons_renderList();
    } catch (e) {
      $sel('#coupon-error').textContent = 'Error saving: ' + (e.message || e);
    }
  });
}

function coupons_collectForm() {
  const code = $sel('#c-code').value.trim().toUpperCase();
  const description = $sel('#c-desc').value.trim() || null;
  const discount_type = $sel('#c-type').value;
  const discount_value = parseFloat($sel('#c-value').value);
  const applies_to = $sel('#c-applies').value;
  const valid_from = $sel('#c-from').value || null;
  const valid_until = $sel('#c-until').value || null;
  const is_active = $sel('#c-active').value === 'true';
  const max_uses = $sel('#c-max').value ? parseInt($sel('#c-max').value, 10) : null;
  const max_uses_per_guest = $sel('#c-max-guest').value ? parseInt($sel('#c-max-guest').value, 10) : null;
  const min_booking_amount = $sel('#c-min').value ? parseFloat($sel('#c-min').value) : null;

  if (!code || Number.isNaN(discount_value)) {
    throw new Error('Code and Discount Value are required.');
  }
  return {
    code,
    description,
    discount_type,
    discount_value,
    applies_to,
    valid_from,
    valid_until,
    is_active,
    max_uses,
    max_uses_per_guest,
    min_booking_amount
  };
}

async function coupons_fillForm(id) {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  const c = data;

  $sel('#c-code').value = (c.code || '').toUpperCase();
  $sel('#c-desc').value = c.description || '';
  $sel('#c-type').value = c.discount_type || 'percentage';
  $sel('#c-value').value = c.discount_value ?? '';
  $sel('#c-applies').value = c.applies_to || 'both';
  $sel('#c-from').value = c.valid_from || '';
  $sel('#c-until').value = c.valid_until || '';
  $sel('#c-active').value = c.is_active ? 'true' : 'false';
  $sel('#c-max').value = c.max_uses ?? '';
  $sel('#c-max-guest').value = c.max_uses_per_guest ?? '';
  $sel('#c-min').value = c.min_booking_amount ?? '';
}

// ---------- Packages ----------
async function initPackages() {
  // Add event listener for Add Package button
  const addBtn = $('#add-package-btn');
  if (addBtn) {
    // Remove existing listener to avoid duplicates
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);
    newBtn.addEventListener('click', () => openPackageModal());
  }

  const list = document.getElementById("packages-list");
  if (!list) return;

  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = `<div class="muted">Error loading packages: ${error.message}</div>`;
    return;
  }
  if (!data || !data.length) {
    list.innerHTML = `<div class="muted">No packages yet.</div>`;
    return;
  }

  const html = data
    .map((p) => {
      const isActive = p.is_active !== false;
      return `
        <div class="item">
          <div class="row" style="align-items:flex-start;gap:12px">
            ${p.image_url ? `<img class="pkg-thumb" src="${p.image_url}" alt="${p.name || ""}">` : ""}
            <div style="flex:1">
              <div class="title">${p.name || ""}</div>
              ${p.description ? `<div class="pkg-meta" style="margin-top:4px">${p.description}</div>` : ""}
              <div class="meta" style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
                <span>Code: <strong>${(p.code || "").toUpperCase()}</strong></span>
                <span>Price: <strong>${formatCurrency(p.package_price || 0, p.currency || "GHS")}</strong></span>
                ${p.nights ? `<span>Nights: <strong>${p.nights}</strong></span>` : ""}
                ${
                  p.valid_from || p.valid_until
                    ? `<span>Valid: <strong>${p.valid_from || "—"}</strong> → <strong>${p.valid_until || "—"}</strong></span>`
                    : ""
                }
                ${p.is_featured ? `<span>Featured</span>` : ""}
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${isActive ? "ok" : "err"}">${isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>

          <div class="room-card-footer">
            <button class="btn btn-sm" data-pkg-edit="${p.id}">Edit</button>
            <button class="btn btn-sm" data-pkg-toggle="${p.id}" data-pkg-active="${isActive}">
              ${isActive ? "Deactivate" : "Activate"}
            </button>
            <button class="btn btn-sm" data-pkg-delete="${p.id}" style="color:#b91c1c">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  list.innerHTML = html;

  // wire actions
  list.querySelectorAll("[data-pkg-edit]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      openPackageModal("edit", b.getAttribute("data-pkg-edit"));
    })
  );

  list.querySelectorAll("[data-pkg-toggle]").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = b.getAttribute("data-pkg-toggle");
      const isActive = b.getAttribute("data-pkg-active") === "true";
      await togglePackageStatus(id, !isActive);
    })
  );

  list.querySelectorAll("[data-pkg-delete]").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deletePackage(b.getAttribute("data-pkg-delete"));
    })
  );
}

function openPackageModal(mode = "add", id = null) {
  const wrap = document.createElement("div");
  wrap.id = "package-modal";
  wrap.className = "modal show";
  document.body.appendChild(wrap);

  const toDateInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const loadExisting = async () => {
    if (mode !== "edit" || !id) return null;
    const { data, error } = await supabase.from("packages").select("*").eq("id", id).single();
    if (error) {
      alert("Error loading package: " + error.message);
      return null;
    }
    return data;
  };

  (async () => {
    const p = (await loadExisting()) || {};
    wrap.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3>${mode === "edit" ? "Edit" : "Add"} Package</h3>
          <button class="btn" onclick="document.getElementById('package-modal').remove()">×</button>
        </div>

        <div class="bd">
          <div class="form-grid">
            <div class="form-group">
              <label>Code *</label>
              <input id="pkg-code" type="text" value="${p.code || ""}">
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input id="pkg-name" type="text" value="${p.name || ""}">
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea id="pkg-desc" rows="3">${p.description || ""}</textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Package Price *</label>
              <input id="pkg-price" type="number" step="0.01" value="${p.package_price ?? ""}">
            </div>
            <div class="form-group">
              <label>Currency *</label>
              <select id="pkg-currency">
                <option value="GHS" ${p.currency === "GHS" ? "selected" : ""}>GHS (₵)</option>
                <option value="USD" ${p.currency === "USD" ? "selected" : ""}>USD ($)</option>
                <option value="GBP" ${p.currency === "GBP" ? "selected" : ""}>GBP (£)</option>
                <option value="${p.currency || "GHS"}" ${
      p.currency && !["GHS", "USD", "GBP"].includes(p.currency) ? "selected" : ""
    }>${p.currency || "GHS"}</option>
              </select>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Room Type ID</label>
              <input id="pkg-room" type="text" value="${p.room_type_id || ""}">
            </div>
            <div class="form-group">
              <label>Nights</label>
              <input id="pkg-nights" type="number" min="1" step="1" value="${p.nights ?? ""}">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Valid From</label>
              <input id="pkg-from" type="date" value="${toDateInput(p.valid_from)}">
            </div>
            <div class="form-group">
              <label>Valid Until</label>
              <input id="pkg-until" type="date" value="${toDateInput(p.valid_until)}">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Image URL</label>
              <input id="pkg-image" type="text" value="${p.image_url || ""}">
            </div>
            <div class="form-group">
              <label>Sort Order</label>
              <input id="pkg-sort" type="number" step="1" value="${p.sort_order ?? ""}">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Featured</label>
              <select id="pkg-featured">
                <option value="false" ${p.is_featured ? "" : "selected"}>No</option>
                <option value="true" ${p.is_featured ? "selected" : ""}>Yes</option>
              </select>
            </div>
            <div class="form-group">
              <label>Active</label>
              <select id="pkg-active">
                <option value="false" ${p.is_active ? "" : "selected"}>No</option>
                <option value="true" ${p.is_active ? "selected" : ""}>Yes</option>
              </select>
            </div>
          </div>
        </div>

        <div class="ft">
          <button class="btn" onclick="document.getElementById('package-modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="pkg-save">Save</button>
        </div>
      </div>
    `;

    wrap.querySelector("#pkg-save").addEventListener("click", async () => {
      try {
        const payload = collectPackageForm();
        if (mode === "edit") {
          const { error: upErr } = await supabase.from("packages").update(payload).eq("id", id);
          if (upErr) throw upErr;
          toast("Package updated");
        } else {
          const { error: insErr } = await supabase.from("packages").insert(payload);
          if (insErr) throw insErr;
          toast("Package created");
        }
        wrap.remove();
        initPackages();
      } catch (e) {
        alert("Error saving: " + (e.message || e));
      }
    });
  })();
}

function collectPackageForm() {
  const root = document.getElementById("package-modal") || document;
  const code = root.querySelector("#pkg-code").value.trim();
  const name = root.querySelector("#pkg-name").value.trim();
  const description = root.querySelector("#pkg-desc").value.trim() || null;
  const priceEl = root.querySelector("#pkg-price").value;
  const package_price = priceEl === "" ? null : parseFloat(priceEl);
  const currency = root.querySelector("#pkg-currency").value;
  const room_type_id = root.querySelector("#pkg-room").value.trim() || null;
  const nightsEl = root.querySelector("#pkg-nights").value;
  const nights = nightsEl === "" ? null : parseInt(nightsEl, 10);
  const valid_from = root.querySelector("#pkg-from").value || null;
  const valid_until = root.querySelector("#pkg-until").value || null;
  const image_url = root.querySelector("#pkg-image").value.trim() || null;
  const sortEl = root.querySelector("#pkg-sort").value;
  const sort_order = sortEl === "" ? null : parseInt(sortEl, 10);
  const is_featured = root.querySelector("#pkg-featured").value === "true";
  const is_active = root.querySelector("#pkg-active").value === "true";

  if (!code || !name || package_price == null || !currency) {
    throw new Error("Code, Name, Price and Currency are required.");
  }

  return {
    code,
    name,
    description,
    package_price,
    currency,
    room_type_id,
    nights,
    valid_from,
    valid_until,
    image_url,
    sort_order,
    is_featured,
    is_active
  };
}

async function togglePackageStatus(id, newStatus) {
  try {
    const { error } = await supabase.from("packages").update({ is_active: newStatus }).eq("id", id);
    if (error) throw error;
    toast(newStatus ? "Package activated" : "Package deactivated");
    initPackages();
  } catch (e) {
    alert("Error updating: " + (e.message || e));
  }
}

async function deletePackage(id) {
  if (!confirm("Delete this package? This cannot be undone.")) return;
  try {
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) throw error;
    toast("Package deleted");
    initPackages();
  } catch (e) {
    alert("Error deleting: " + (e.message || e));
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

/* ---------- New Custom Booking ---------- */
async function openNewCustomBookingModal() {
  const wrap = document.createElement('div');
  // Reuse reservation modal styling so you don't need new CSS
  wrap.id = 'reservation-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  // Fetch room types for dropdown
  const { data: rooms } = await supabase
    .from('room_types')
    .select('id,code,name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  // Fetch extras for selection
  const { data: extras } = await supabase
    .from('extras')
    .select('id,code,name,price,category')
    .eq('is_active', true)
    .order('category,name');

  const roomOptions = (rooms || []).map(r =>
    `<option value="${r.id}" data-code="${r.code}">${r.name} (${r.code})</option>`
  ).join('');

  const extrasHtml = (extras || []).map(e =>
    `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <input type="checkbox" id="extra-${e.id}" value="${e.id}" data-price="${e.price}" data-name="${e.name}" data-code="${e.code || ''}" style="width:auto">
      <label for="extra-${e.id}" style="margin:0;font-weight:400;cursor:pointer">${e.name} - GHS ${e.price}</label>
    </div>`
  ).join('');

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
            <input id="nb-phone" type="text" />
          </div>
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
          <div class="form-group">
            <label>Room Subtotal</label>
            <input id="nb-room-subtotal" type="number" step="0.01" value="" placeholder="Room cost" />
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

  const inEl = wrap.querySelector('#nb-in');
  const outEl = wrap.querySelector('#nb-out');
  const nightsEl = wrap.querySelector('#nb-nights');
  const roomSubtotalEl = wrap.querySelector('#nb-room-subtotal');

  // Auto-calculate nights when dates change
  function calculateNights() {
    const checkIn = new Date(inEl.value);
    const checkOut = new Date(outEl.value);
    if (checkIn && checkOut && checkOut > checkIn) {
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      nightsEl.value = nights;
    } else {
      nightsEl.value = 1;
    }
    updatePriceBreakdown();
  }

  // Calculate price breakdown
  function updatePriceBreakdown() {
    const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
    const currency = wrap.querySelector('#nb-currency').value || 'GHS';
    
    // Calculate extras total
    selectedExtras = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => ({
        extra_id: cb.value,
        extra_code: cb.getAttribute('data-code') || '',
        extra_name: cb.getAttribute('data-name') || '',
        price: parseFloat(cb.getAttribute('data-price') || 0),
        quantity: 1
      }));
    
    const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
    
    // Calculate discount
    let discount = 0;
    if (appliedCoupon) {
      const subtotal = roomSubtotal + extrasTotal;
      if (appliedCoupon.applies_to === 'both') {
        discount = appliedCoupon.discount_type === 'percentage' 
          ? (subtotal * appliedCoupon.discount_value / 100)
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
    
    // Update display
    wrap.querySelector('#calc-room-subtotal').textContent = `${currency} ${roomSubtotal.toFixed(2)}`;
    wrap.querySelector('#calc-extras-total').textContent = `${currency} ${extrasTotal.toFixed(2)}`;
    
    if (discount > 0) {
      wrap.querySelector('#calc-discount-row').style.display = 'flex';
      wrap.querySelector('#calc-discount-label').textContent = appliedCoupon.code;
      wrap.querySelector('#calc-discount').textContent = `−${currency} ${discount.toFixed(2)}`;
    } else {
      wrap.querySelector('#calc-discount-row').style.display = 'none';
    }
    
    wrap.querySelector('#calc-total').textContent = `${currency} ${finalTotal.toFixed(2)}`;
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
          error: `Minimum booking amount of GHS ${coupon.min_booking_amount} required` 
        };
      }
      
      return { valid: true, coupon: coupon };
    } catch (err) {
      return { valid: false, error: 'Error validating coupon: ' + err.message };
    }
  }

  // Event listeners
  inEl.addEventListener('change', calculateNights);
  outEl.addEventListener('change', calculateNights);
  roomSubtotalEl.addEventListener('input', updatePriceBreakdown);
  
  // Extras checkboxes
  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
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
      
      displayEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#dcfce7;border:1px solid #86efac;border-radius:8px">
          <div style="font-size:0.875rem;color:#166534">
            <strong>${appliedCoupon.code}</strong> - ${discountText} ${appliedCoupon.applies_to}
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
      const roomName = selectedOption ? selectedOption.textContent : null;

      if (!roomTypeId || !roomTypeCode) {
        alert('Please select a room type');
        return;
      }

      const roomSubtotal = parseFloat(roomSubtotalEl.value) || 0;
      const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
      
      // Calculate final discount
      let discount = 0;
      if (appliedCoupon) {
        const subtotal = roomSubtotal + extrasTotal;
        if (appliedCoupon.applies_to === 'both') {
          discount = appliedCoupon.discount_type === 'percentage' 
            ? (subtotal * appliedCoupon.discount_value / 100)
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

      // Create the reservation first
      const reservationPayload = {
        confirmation_code: genConfCode(),
        guest_first_name:  wrap.querySelector('#nb-first').value.trim() || null,
        guest_last_name:   wrap.querySelector('#nb-last').value.trim() || null,
        guest_email:       wrap.querySelector('#nb-email').value.trim() || null,
        guest_phone:       wrap.querySelector('#nb-phone').value.trim() || null,
        room_name:         roomName,
        room_type_id:      roomTypeId,
        room_type_code:    roomTypeCode,
        check_in:          wrap.querySelector('#nb-in').value || null,
        check_out:         wrap.querySelector('#nb-out').value || null,
        nights:            parseInt(wrap.querySelector('#nb-nights').value || '0', 10) || 0,
        adults:            parseInt(wrap.querySelector('#nb-adults').value || '0', 10) || 0,
        children:          parseInt(wrap.querySelector('#nb-children').value || '0', 10) || 0,
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
      initReservations?.();
    } catch (e) {
      alert('Error saving: ' + (e.message || e));
    }
  });
}

/* ---------- Book New Package ---------- */
async function openBookPackageModal() {
  const wrap = document.createElement('div');
  // Reuse package modal styling
  wrap.id = 'package-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  // fetch active packages with room type information
  const { data: pkgs, error } = await supabase
    .from('packages')
    .select(`
      id,code,name,package_price,currency,nights,room_type_id,is_active,
      room_types(id,code,name)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    wrap.remove();
    alert('Error loading packages: ' + error.message);
    return;
  }

  const options = (pkgs || []).map(p =>
    `<option value="${p.id}" 
             data-price="${p.package_price || 0}" 
             data-cur="${p.currency || 'GHS'}" 
             data-nights="${p.nights || 1}" 
             data-room-id="${p.room_type_id || ''}"
             data-room-code="${p.room_types?.code || ''}"
             data-room-name="${p.room_types?.name || ''}">
      ${(p.code || '').toUpperCase()} — ${p.name}
    </option>`
  ).join('');

  const today = toDateInput(new Date());

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()">
      <div class="hd">
        <h3>Book New Package</h3>
        <button class="btn" onclick="document.getElementById('package-modal').remove()">×</button>
      </div>

      <div class="bd">
        <div class="form-group">
          <label>Package</label>
          <select id="bp-pkg">${options}</select>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>First Name</label>
            <input id="bp-first" type="text" />
          </div>
          <div class="form-group">
            <label>Last Name</label>
            <input id="bp-last" type="text" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Email</label>
            <input id="bp-email" type="email" />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input id="bp-phone" type="text" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Check-in</label>
            <input id="bp-in" type="date" value="${today}" />
          </div>
          <div class="form-group">
            <label>Check-out</label>
            <input id="bp-out" type="date" value="${today}" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Total</label>
            <input id="bp-total" type="number" step="0.01" />
          </div>
          <div class="form-group">
            <label>Currency</label>
            <input id="bp-currency" type="text" value="GHS" />
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label>Adults</label>
            <input id="bp-adults" type="number" min="1" step="1" value="1" />
          </div>
          <div class="form-group">
            <label>Children</label>
            <input id="bp-children" type="number" min="0" step="1" value="0" />
          </div>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <textarea id="bp-notes" rows="3"></textarea>
        </div>
      </div>

      <div class="ft">
        <button class="btn" onclick="document.getElementById('package-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="bp-save">Save</button>
      </div>
    </div>
  `;

  const pkgSel = wrap.querySelector('#bp-pkg');
  const inEl = wrap.querySelector('#bp-in');
  const outEl = wrap.querySelector('#bp-out');
  const totalEl = wrap.querySelector('#bp-total');
  const curEl = wrap.querySelector('#bp-currency');

  function hydrateFromPkg() {
    const opt = pkgSel.selectedOptions[0];
    if (!opt) return;
    const nights = parseInt(opt.getAttribute('data-nights') || '1', 10);
    const price = parseFloat(opt.getAttribute('data-price') || '0');
    const cur = opt.getAttribute('data-cur') || 'GHS';
    outEl.value = addDaysISO(inEl.value, nights);
    totalEl.value = price || '';
    curEl.value = cur;
  }
  pkgSel.addEventListener('change', hydrateFromPkg);
  inEl.addEventListener('change', hydrateFromPkg);
  hydrateFromPkg();

  wrap.querySelector('#bp-save').addEventListener('click', async () => {
    try {
      const opt = pkgSel.selectedOptions[0];
      const nights = parseInt(opt.getAttribute('data-nights') || '1', 10);
      const roomTypeId = opt.getAttribute('data-room-id') || null;
      const roomTypeCode = opt.getAttribute('data-room-code') || null;
      const roomName = opt.getAttribute('data-room-name') || null;

      if (!roomTypeId || !roomTypeCode) {
        alert('Selected package does not have a valid room type assigned');
        return;
      }

      const payload = {
        confirmation_code: genConfCode(),
        guest_first_name: wrap.querySelector('#bp-first').value.trim() || null,
        guest_last_name:  wrap.querySelector('#bp-last').value.trim() || null,
        guest_email:      wrap.querySelector('#bp-email').value.trim() || null,
        guest_phone:      wrap.querySelector('#bp-phone').value.trim() || null,
        check_in:         inEl.value || null,
        check_out:        outEl.value || null,
        nights,
        adults:           parseInt(wrap.querySelector('#bp-adults').value || '0', 10) || 0,
        children:         parseInt(wrap.querySelector('#bp-children').value || '0', 10) || 0,
        status:           'confirmed',
        payment_status:   'unpaid',
        currency:         curEl.value.trim() || 'GHS',
        total:            totalEl.value === '' ? null : parseFloat(totalEl.value),
        notes:            `Booked via package ${(opt.textContent || '').trim()}`,
        room_type_id:     roomTypeId,
        room_type_code:   roomTypeCode,
        room_name:        roomName
      };

      const { error } = await supabase.from('reservations').insert(payload);
      if (error) throw error;
      toast('Package booking created');
      wrap.remove();
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


// keep your existing app bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
}