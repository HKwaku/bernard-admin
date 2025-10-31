import { supabase } from './config/supabase.js';
import { callOpenAI, conversationHistory } from './config/openai.js';
import { $, $$, addMessage, showTyping, hideTyping, formatCurrency, openModal, closeModal, toast } from './utils/helpers.js';

export function initApp() {
  const root = document.getElementById('root') || document.getElementById('admin-dashboard');
  if (!root) { const e = document.createElement('div'); e.textContent = 'ERROR: root element not found'; document.body.appendChild(e); return; }

  root.innerHTML = `
    <div class="wrap">
      <div class="shell">
        <!-- Top Bar -->
        <div class="topbar">
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
        </div>

        <!-- Page Heading (NEW) -->
        <div class="pagehead">
          <div class="h1" id="section-title">Chat</div>
        </div>

        <!-- Body -->
        <div class="grid">
          <!-- LEFT -->
          <div>
            <!-- Chat -->
            <div id="view-chat" class="card panel show">
              <div class="card-bd chat">
                <div id="messages" class="messages"></div>
                <div class="chat-input">
                  <input id="user-input" class="input" placeholder="Type a request…" />
                  <button id="send-btn" class="btn" title="Send">➤</button>
                </div>
              </div>
            </div>

            <!-- Reservations -->
            <div id="view-reservations" class="card panel">
              <div class="card-bd">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
                  <input id="res-search" class="input" placeholder="Search name/email/code…" />
                  <select id="res-month" class="select">
                    <option value="">All months</option>
                    ${Array.from({length:12}).map((_,i)=>`<option value="${i}">${new Date(2000,i,1).toLocaleString('en',{month:'long'})}</option>`).join('')}
                  </select>
                  <select id="res-year" class="select"></select>
                </div>
                <div id="res-list" class="list">Loading…</div>
              </div>
            </div>

            <!-- Room Types -->
            <div id="view-rooms" class="card panel">
              <div class="card-bd"><div id="rooms-list" class="list">Loading…</div></div>
            </div>

            <!-- Extras -->
            <div id="view-extras" class="card panel">
              <div class="card-bd"><div id="extras-list" class="list">Loading…</div></div>
            </div>

            <!-- Coupons -->
            <div id="view-coupons" class="card panel">
              <div class="card-bd"><div id="coupons-list" class="list">Loading…</div></div>
            </div>

            <!-- Packages -->
            <div id="view-packages" class="card panel">
              <div class="card-bd"><div id="packages-list" class="list">Loading…</div></div>
            </div>
          </div>

          <!-- RIGHT -->
          <div>
            <div class="card">
              <div class="card-hd">Quick Stats</div>
              <div class="card-bd">
                <div class="stat-row"><span>Today's Check-ins</span><strong id="stat-checkins">—</strong></div>
                <div class="stat-row"><span>Active Bookings</span><strong id="stat-total">—</strong></div>
                <div class="stat-row"><span>This Month</span><strong id="stat-month">—</strong></div>
                <div class="stat-row"><span>Total Nights Booked</span><strong id="stat-nights">—</strong></div>
              </div>
            </div>

            <div class="card" style="margin-top:18px">
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
        <div class="hd"><h3 style="margin:0">Create New Booking</h3><button class="btn" data-close="booking-modal">×</button></div>
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
        <div class="ft"><button class="btn" data-close="booking-modal">Cancel</button><button class="btn" id="create-booking-btn">Create Booking</button></div>
      </div>
    </div>
  `;

  // live clock
  const nowEl = $('#now');
  const tick = () => { const d=new Date(); nowEl.textContent = d.toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); };
  tick(); setInterval(tick, 60*1000);

  // —— Section heading map (NEW) —— //
  const sectionMap = {
    chat: 'Chat',
    reservations: 'Reservations',
    rooms: 'Room Types',
    extras: 'Extras & Add-ons',
    coupons: 'Coupons',
    packages: 'Packages',
  };
  const setSection = (key) => { const el = $('#section-title'); if (el) el.textContent = sectionMap[key] || 'Dashboard'; };

  // Tabs
  $$('#tabs .tab').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('#tabs .tab').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      $$('.panel').forEach(p => p.classList.remove('show'));
      $(`#view-${btn.dataset.view}`).classList.add('show');
      setSection(btn.dataset.view);            // <— update heading

      if (btn.dataset.view === 'reservations') initReservations();
      if (btn.dataset.view === 'rooms') initRooms();
      if (btn.dataset.view === 'extras') initExtras();
      if (btn.dataset.view === 'coupons') initCoupons();
      if (btn.dataset.view === 'packages') initPackages();
    })
  );
  setSection('chat');

  // Chat
  addMessage(`Hello! My name is <strong>Bernard</strong>. What would you like to do today?`);
  $('#send-btn')?.addEventListener('click', send);
  $('#user-input')?.addEventListener('keydown', e => e.key==='Enter' && send());
  async function send(){
    const el = $('#user-input'); const text=(el?.value||'').trim(); if(!text) return;
    addMessage(text,true); el.value=''; showTyping();
    try{ const reply = await callOpenAI(conversationHistory,text); hideTyping(); addMessage(reply||'Done.'); }
    catch(e){ hideTyping(); addMessage('<span style="color:#b91c1c">✖ AI service temporarily unavailable.</span>'); }
  }

  // Quick stats + recent
  loadStats(); loadRecent();
  async function loadStats(){
    try{
      const today = new Date().toISOString().slice(0,10);
      const { data: a } = await supabase.from('reservations').select('id').gte('check_in',today).lte('check_in',today);
      $('#stat-checkins').textContent = a?.length ?? 0;
      const { data: b } = await supabase.from('reservations').select('id').eq('status','confirmed');
      $('#stat-total').textContent = b?.length ?? 0;
      const n=new Date(), y=n.getFullYear(), m=String(n.getMonth()+1).padStart(2,'0');
      const { data: c } = await supabase.from('reservations').select('id').gte('check_in',`${y}-${m}-01`).lte('check_in',`${y}-${m}-31`);
      $('#stat-month').textContent = c?.length ?? 0;
      const { data: d } = await supabase.from('reservations').select('nights');
      $('#stat-nights').textContent = (d||[]).reduce((t,r)=>t+(r.nights||0),0);
    }catch(e){ console.warn('stats error',e); }
  }
  async function loadRecent(){
    try{
      const { data } = await supabase.from('reservations')
        .select('guest_first_name,guest_last_name,confirmation_code,status,created_at,room_name,check_in')
        .order('created_at',{ascending:false}).limit(7);
      $('#recent-bookings').innerHTML = (data||[]).map(r=>`
        <div class="recent-item">
          <div><div style="font-weight:700">${r.guest_first_name} ${r.guest_last_name}</div>
          <div style="color:#6b7280">${r.room_name||''} • ${r.check_in||''}</div></div>
          <span class="code">${r.confirmation_code}</span>
        </div>`).join('') || 'No data';
    }catch(e){ $('#recent-bookings').textContent='Error loading'; }
  }

  // New booking modal
  $('#new-booking-btn')?.addEventListener('click', async () => {
    const { data: rooms } = await supabase.from('room_types').select('code,name').order('code',{ascending:true});
    $('#b-room').innerHTML = `<option value="">Select...</option>` + (rooms||[]).map(r=>`<option value="${r.code}">${r.name}</option>`).join('');
    openModal('booking-modal');
  });
  document.body.addEventListener('click', e => { const c=e.target.closest('[data-close]'); if(c) closeModal(c.getAttribute('data-close')); });
  $('#create-booking-btn')?.addEventListener('click', saveBooking);
  async function saveBooking(){
    const payload={
      guest_first_name: $('#b-first').value.trim(),
      guest_last_name : $('#b-last').value.trim(),
      guest_email     : $('#b-email').value.trim(),
      phone           : $('#b-phone').value.trim() || null,
      check_in        : $('#b-checkin').value,
      check_out       : $('#b-checkout').value,
      room_code       : $('#b-room').value,
      adults          : Number($('#b-adults').value||1),
      notes           : $('#b-notes').value.trim() || null,
      status          : 'confirmed',
      payment_status  : 'unpaid',
    };
    if(!payload.guest_first_name || !payload.guest_last_name || !payload.guest_email || !payload.check_in || !payload.check_out || !payload.room_code){
      toast('Please complete required fields.'); return;
    }
    await supabase.from('reservations').insert(payload);
    toast('Booking created'); closeModal('booking-modal');
    if($('#view-reservations').classList.contains('show')) loadReservations();
    loadStats(); loadRecent();
  }

  // Reservations
  async function initReservations(){
    const ysel=$('#res-year');
    if(ysel && !ysel.dataset.filled){
      const y=new Date().getFullYear();
      ysel.innerHTML = Array.from({length:6}).map((_,i)=>{const yr=y-3+i; return `<option value="${yr}" ${yr===y?'selected':''}>${yr}</option>`}).join('');
      ysel.dataset.filled='1';
    }
    await loadReservations();
    $('#res-search')?.addEventListener('input',()=>loadReservations($('#res-search').value.trim()),{once:true});
    $('#res-month')?.addEventListener('change',()=>loadReservations($('#res-search').value.trim()),{once:true});
    $('#res-year')?.addEventListener('change',()=>loadReservations($('#res-search').value.trim()),{once:true});
  }
  async function loadReservations(search=''){
    const list=$('#res-list'); list.textContent='Loading…';
    const mf=$('#res-month')?.value||''; const yf=$('#res-year')?.value||'';
    let q=supabase.from('reservations')
      .select('confirmation_code,guest_first_name,guest_last_name,guest_email,check_in,check_out,room_name,adults,nights,total,currency,status,payment_status,created_at')
      .order('created_at',{ascending:false}).limit(150);
    if(search) q=q.or(`guest_first_name.ilike.%${search}%,guest_last_name.ilike.%${search}%,guest_email.ilike.%${search}%,confirmation_code.ilike.%${search}%`);
    if(mf!=='' && yf){ const start=`${yf}-${String(Number(mf)+1).padStart(2,'0')}-01`; const end=`${yf}-${String(Number(mf)+1).padStart(2,'0')}-31`; q=q.gte('check_in',start).lte('check_in',end); }
    const { data, error } = await q; if(error){ list.innerHTML=`<div style="color:#b91c1c">Error: ${error.message}</div>`; return; }
    if(!data?.length){ list.innerHTML='<div style="color:#6b7280">No reservations found.</div>'; return; }
    list.innerHTML = data.map(r=>`
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${r.guest_first_name} ${r.guest_last_name}</div>
            <div class="meta">${r.guest_email||''}</div>
            <div class="meta" style="margin-top:6px"><strong>${r.room_name||''}</strong></div>
            <div class="meta">Check-in: <strong>${r.check_in}</strong> • Check-out: <strong>${r.check_out}</strong></div>
            <div class="meta">Guests: ${r.adults||1} • Nights: ${r.nights||1}</div>
          </div>
          <div style="text-align:right;min-width:200px">
            <div class="code">${r.confirmation_code}</div>
            <div style="margin:6px 0">
              <span class="badge ${r.status==='confirmed'?'ok':'err'}">${r.status}</span>
              <span class="badge ${r.payment_status==='paid'?'ok':'err'}" style="margin-left:6px">${r.payment_status||'unpaid'}</span>
            </div>
            <div class="price">${formatCurrency(r.total||0, r.currency||'GBP')}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Lists
  async function initRooms(){
    const el=$('#rooms-list'); el.textContent='Loading…';
    const { data, error } = await supabase.from('room_types').select('code,name,weekday_price,weekend_price,currency').order('code',{ascending:true});
    if(error){ el.innerHTML=`<div style="color:#b91c1c">Error: ${error.message}</div>`; return; }
    if(!data?.length){ el.innerHTML='<div style="color:#6b7280">No room types found.</div>'; return; }
    el.innerHTML = data.map(r=>`
      <div class="item">
        <div class="row">
          <div><span class="title">${r.code}</span> — ${r.name}</div>
          <div class="meta">Weekday: <strong>${formatCurrency(r.weekday_price||0, r.currency||'GBP')}</strong> • Weekend: <strong>${formatCurrency(r.weekend_price||0, r.currency||'GBP')}</strong></div>
        </div>
      </div>
    `).join('');
  }
  async function initExtras(){
    const el=$('#extras-list'); el.textContent='Loading…';
    const { data, error } = await supabase.from('extras').select('*').order('code',{ascending:true});
    if(error){ el.innerHTML=`<div style="color:#b91c1c">Error: ${error.message}</div>`; return; }
    if(!data?.length){ el.innerHTML='<div style="color:#6b7280">No extras found.</div>'; return; }
    el.innerHTML = data.map(x=>`
      <div class="item">
        <div class="row">
          <div style="flex:1">
            <div class="title">${x.name}</div>
            <div class="meta">${(x.code||'').toUpperCase()}${x.category?` • ${x.category}`:''}</div>
            ${x.description?`<div class="meta" style="margin-top:6px">${x.description}</div>`:''}
            <div class="price">${formatCurrency(x.price||0, x.currency || 'GBP')}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:start">
            <span class="badge ${x.active!==false?'ok':'err'}">${x.active!==false?'Active':'Inactive'}</span>
            <button class="btn light">Edit</button>
            <button class="btn warn">${x.active!==false?'Deactivate':'Activate'}</button>
          </div>
        </div>
      </div>
    `).join('');
  }
  async function initCoupons(){
    const el=$('#coupons-list'); el.textContent='Loading…';
    const { data, error } = await supabase.from('coupons').select('*').order('created_at',{ascending:false});
    if(error){ el.innerHTML=`<div style="color:#b91c1c">Error: ${error.message}</div>`; return; }
    if(!data?.length){ el.innerHTML='<div style="color:#6b7280">No coupons found.</div>'; return; }
    el.innerHTML = data.map(c=>`
      <div class="item">
        <div class="row">
          <div><div class="title">${c.code}</div><div class="meta">${c.description||''}</div></div>
          <div class="meta">${c.type} ${c.value}</div>
        </div>
      </div>
    `).join('');
  }
  async function initPackages(){
    const el=$('#packages-list'); el.textContent='Loading…';
    const { data, error } = await supabase.from('packages').select('*').order('created_at',{ascending:false});
    if(error){ el.innerHTML=`<div style="color:#b91c1c">Error: ${error.message}</div>`; return; }
    if(!data?.length){ el.innerHTML='<div style="color:#6b7280">No packages found.</div>'; return; }
    el.innerHTML = data.map(p=>`
      <div class="item">
        <div class="row">
          <div>
            <div class="title">${p.name}</div>
            <div class="meta">${(p.code||'').toUpperCase()}${p.featured?` • <span class="badge ok">featured</span>`:''}</div>
            ${p.description?`<div class="meta" style="margin-top:6px">${p.description}</div>`:''}
          </div>
          <div class="meta">Nights: <strong>${p.nights||1}</strong> • Price: <strong>${formatCurrency(p.price||0,'GBP')}</strong></div>
        </div>
      </div>
    `).join('');
  }
}
