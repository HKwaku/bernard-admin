// src/extraSelections.js
// Extra Selections – admin module (vanilla JS, same init* pattern as reservations.js)

import { supabase } from './config/supabase.js';
import { $, formatDate, toast } from './utils/helpers.js';

let _reservations = [];
let _menuItems = {};
let _search = '';
let _status = 'all';
let collapsedGroups = new Set();

export function initExtraSelections() {
  const host = document.getElementById('extra-selections-root');
  if (!host) return;

  if (!host.dataset._wired) {
    host.dataset._wired = '1';
    host.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:1.25rem;font-weight:800">Extra Selections</div>
        <div style="color:var(--muted);font-size:0.9rem">View guest extra selections and preferences</div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <input id="extraselections-search" class="input" placeholder="Search by confirmation or guest name…" style="flex:1;min-width:220px" />
        <select id="extraselections-status" class="select">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
        </select>
        <button id="extraselections-refresh" class="btn">Refresh</button>
      </div>

      <div id="extraselections-list" class="list">Loading…</div>
    `;

    const s = document.getElementById('extraselections-search');
    const st = document.getElementById('extraselections-status');

    s?.addEventListener('input', () => {
      _search = s.value || '';
      render();
    });

    st?.addEventListener('change', () => {
      _status = st.value || 'all';
      render();
    });

    document.getElementById('extraselections-refresh')?.addEventListener('click', () => {
      load();
    });

    // delegated actions
    host.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const resId = btn.getAttribute('data-res-id');
      const extraId = btn.getAttribute('data-extra-id');
      const action = btn.getAttribute('data-action');

      if (!action) return;

      if (action === 'view' && resId) {
        const res = _reservations.find((r) => String(r.id) === String(resId));
        if (res) openDetailsModal(res);
        return;
      }

      if (action === 'toggle' && extraId) {
        await toggleStatus(extraId);
      }
    });
  }

  // refresh when entering view
  load();
}

async function load() {
  const list = document.getElementById('extraselections-list');
  if (list) list.textContent = 'Loading…';

  try {
    // Load menu items first
    const { data: menuData } = await supabase
      .from('chef_menu_items')
      .select('id, name');

    _menuItems = {};
    menuData?.forEach(item => {
      _menuItems[item.id] = item.name;
    });

    // Load reservations with extras
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        check_in,
        check_out,
        adults,
        children,
        reservation_extras!inner (
          id,
          extra_code,
          extra_name,
          quantity,
          selection_status,
          selection_data,
          selected_at
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    _reservations = data || [];

    // Default all to collapsed
    if (collapsedGroups.size === 0) {
      _reservations.forEach(r => {
        collapsedGroups.add(String(r.id));
      });
    }

    render();
  } catch (e) {
    console.error('extra selections load error', e);
    if (list) list.textContent = 'Failed to load';
  }
}

function render() {
  const list = document.getElementById('extraselections-list');
  if (!list) return;

  const q = (_search || '').trim().toLowerCase();

  const filtered = _reservations.filter((r) => {
    const name = `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim().toLowerCase();
    const code = String(r.confirmation_code || '').toLowerCase();

    const matchSearch = !q || name.includes(q) || code.includes(q);
    if (!matchSearch) return false;

    if (_status === 'all') return true;
    return r.reservation_extras.some(e => String(e.selection_status || '').toLowerCase() === _status);
  });

  if (!filtered.length) {
    list.innerHTML = '<div style="color:var(--muted)">No selections found.</div>';
    return;
  }

  const html = filtered.map(res => {
    const totalGuests = (res.adults || 1) + (res.children || 0);
    const fullName = `${res.guest_first_name || ''} ${res.guest_last_name || ''}`.trim() || 'Unknown guest';
    const totalExtras = res.reservation_extras.length;
    const isCollapsed = collapsedGroups.has(String(res.id));

    // Determine overall status color
    const allCompleted = res.reservation_extras.every(e => e.selection_status === 'completed');
    const someCompleted = res.reservation_extras.some(e => e.selection_status === 'completed');

    let borderColor = '#f59e0b'; // orange for pending
    let bgGradient = 'linear-gradient(to right, #fffbeb, white)';
    
    if (allCompleted) {
      borderColor = '#10b981'; // green for completed
      bgGradient = 'linear-gradient(to right, #ecfdf5, white)';
    } else if (someCompleted) {
      borderColor = '#3b82f6'; // blue for mixed
      bgGradient = 'linear-gradient(to right, #eff6ff, white)';
    }

    if (isCollapsed) {
      // Collapsed view - summary card
      return `
        <div class="item" style="border-left: 4px solid ${borderColor}; background: ${bgGradient};">
          <div class="row" style="align-items:flex-start;gap:12px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <div class="title">${escapeHtml(fullName)}</div>
                <span class="code">${escapeHtml(res.confirmation_code)}</span>
              </div>
              <div class="meta">${escapeHtml(res.guest_email || '')}</div>
              <div class="meta">${formatDate(res.check_in)} → ${formatDate(res.check_out)}</div>
              <div class="meta">
                <strong>${totalExtras} extra${totalExtras !== 1 ? 's' : ''}</strong> • 
                ${totalGuests} guest${totalGuests !== 1 ? 's' : ''}
              </div>
            </div>
            <div style="text-align:right;display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              ${renderStatusBadges(res.reservation_extras)}
            </div>
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-sm" data-res-toggle="${res.id}">
              ▼ Expand ${totalExtras} Extra${totalExtras !== 1 ? 's' : ''}
            </button>
            <button class="btn btn-sm btn-primary" data-action="view" data-res-id="${res.id}">
              View Details
            </button>
          </div>
        </div>
      `;
    } else {
      // Expanded view - show all extras
      return `
        <div style="border: 2px solid ${borderColor}; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: ${bgGradient};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;flex-wrap:wrap">
              <span style="background: ${borderColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                ${allCompleted ? 'COMPLETED' : someCompleted ? 'IN PROGRESS' : 'PENDING'}
              </span>
              <strong>${escapeHtml(fullName)}</strong>
              <span class="code">${escapeHtml(res.confirmation_code)}</span>
            </div>
            <button class="btn btn-sm" data-res-toggle="${res.id}">
              ▲ Collapse
            </button>
          </div>
          <div style="color:var(--muted);margin-bottom:12px">
            ${escapeHtml(res.guest_email || '')} • ${formatDate(res.check_in)} → ${formatDate(res.check_out)} • ${totalGuests} guest${totalGuests !== 1 ? 's' : ''}
          </div>
          <div style="display:grid;gap:12px">
            ${res.reservation_extras.map(extra => renderExtraCard(extra, res.id)).join('')}
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <button class="btn btn-sm btn-primary" data-action="view" data-res-id="${res.id}">
              View Full Details
            </button>
          </div>
        </div>
      `;
    }
  }).join('');

  list.innerHTML = html;

  // Attach toggle listeners
  list.querySelectorAll('[data-res-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const resId = btn.getAttribute('data-res-toggle');
      if (collapsedGroups.has(resId)) {
        collapsedGroups.delete(resId);
      } else {
        collapsedGroups.add(resId);
      }
      render();
    });
  });
}

function renderStatusBadges(extras) {
  const badges = extras.map(e => {
    const st = String(e.selection_status || 'pending').toLowerCase();
    const badge = st === 'completed'
      ? '<span class="badge ok">Completed</span>'
      : '<span class="badge pending">Pending</span>';
    return badge;
  });
  return badges.join(' ');
}

function renderExtraCard(extra, resId) {
  const st = String(extra.selection_status || 'pending').toLowerCase();
  const isCompleted = st === 'completed';
  
  return `
    <div style="background:white;border:1px solid var(--ring);border-radius:8px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">${escapeHtml(extra.extra_name || extra.extra_code || 'Extra')}</div>
          <div style="color:var(--muted);font-size:0.9rem">Qty: ${Number(extra.quantity || 1)}</div>
          ${extra.selected_at ? `<div style="color:var(--muted);font-size:0.85rem">Selected: ${formatDate(extra.selected_at)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge ${isCompleted ? 'ok' : 'pending'}">
            ${isCompleted ? 'Completed' : 'Pending'}
          </span>
          <button 
            class="btn btn-sm ${isCompleted ? '' : 'btn-primary'}" 
            data-action="toggle" 
            data-extra-id="${extra.id}"
          >
            ${isCompleted ? 'Mark Pending' : 'Mark Completed'}
          </button>
        </div>
      </div>
    </div>
  `;
}

async function toggleStatus(extraId) {
  try {
    // Find current status
    let currentStatus = 'pending';
    for (const res of _reservations) {
      const extra = res.reservation_extras.find(e => String(e.id) === String(extraId));
      if (extra) {
        currentStatus = extra.selection_status || 'pending';
        break;
      }
    }

    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';

    const { error } = await supabase
      .from('reservation_extras')
      .update({ selection_status: newStatus })
      .eq('id', extraId);

    if (error) throw error;
    
    toast(newStatus === 'completed' ? 'Marked as completed' : 'Marked as pending');

    // Update local state
    for (const res of _reservations) {
      const extra = res.reservation_extras.find(e => String(e.id) === String(extraId));
      if (extra) {
        extra.selection_status = newStatus;
        break;
      }
    }
    
    render();
  } catch (e) {
    console.error('toggle status error', e);
    alert('Failed to update status');
  }
}

function openDetailsModal(res) {
  document.getElementById('extra-selection-modal')?.remove();

  const totalGuests = (res.adults || 1) + (res.children || 0);
  const fullName = `${res.guest_first_name || ''} ${res.guest_last_name || ''}`.trim() || 'Unknown guest';

  const wrap = document.createElement('div');
  wrap.id = 'extra-selection-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()" style="max-width:800px">
      <div class="hd">
        <h3>Extra Selections</h3>
        <button class="btn" onclick="document.getElementById('extra-selection-modal').remove()">×</button>
      </div>
      <div class="bd" style="max-height:70vh;overflow-y:auto">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--ring)">
          <div style="font-weight:800;font-size:1.1rem">${escapeHtml(fullName)}</div>
          <span class="code">${escapeHtml(res.confirmation_code)}</span>
        </div>

        <div style="background:#f8fafc;border:1px solid var(--ring);border-radius:8px;padding:12px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
            <div>
              <div style="color:var(--muted);font-size:0.85rem">Email</div>
              <div style="font-weight:600">${escapeHtml(res.guest_email || 'N/A')}</div>
            </div>
            <div>
              <div style="color:var(--muted);font-size:0.85rem">Check-in</div>
              <div style="font-weight:600">${formatDate(res.check_in)}</div>
            </div>
            <div>
              <div style="color:var(--muted);font-size:0.85rem">Check-out</div>
              <div style="font-weight:600">${formatDate(res.check_out)}</div>
            </div>
            <div>
              <div style="color:var(--muted);font-size:0.85rem">Guests</div>
              <div style="font-weight:600">${totalGuests} (${res.adults || 1}A, ${res.children || 0}C)</div>
            </div>
          </div>
        </div>

        ${res.reservation_extras.map(extra => renderExtraDetail(extra, totalGuests, res)).join('')}
      </div>

      <div class="ft">
        <button class="btn" onclick="document.getElementById('extra-selection-modal').remove()">Close</button>
      </div>
    </div>
  `;
}

function renderExtraDetail(extra, totalGuests, res) {
  const data = extra.selection_data || {};
  const dates = data.dates || {};
  const st = String(extra.selection_status || 'pending').toLowerCase();

  let content = `
  <div style="color:var(--muted);margin-top:8px">
    No structured selections found.
  </div>
  ${renderSelectionDataFallback(data)}
`;


  if (Object.keys(dates).length > 0) {
    content = Object.entries(dates).map(([date, dateData]) => {
      let dayHtml = `<div style="font-weight:600;margin-bottom:8px;color:#0369a1">${formatDate(date)}</div>`;

      if (dateData.meal_type) {
        dayHtml += `<div style="color:var(--muted);margin-bottom:8px">Meal: <strong>${dateData.meal_type}</strong></div>`;
      }

      // Handle per-guest selections
      if (dateData.guests && Array.isArray(dateData.guests)) {
        dayHtml += dateData.guests.map((guest, idx) => {
          if (!guest) return '';

          let guestHtml = `
            <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:10px;margin-bottom:8px;border-radius:4px">
              <div style="font-weight:600;color:#1e40af;margin-bottom:6px">
                Guest ${idx + 1}${idx === 0 ? ` (${res.guest_first_name})` : ''}
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
          `;

          if (guest.starter) {
            guestHtml += `
              <div>
                <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Starter</div>
                <div style="font-weight:600">${escapeHtml(getMenuItemName(guest.starter))}</div>
              </div>
            `;
          }

          if (guest.main) {
            guestHtml += `
              <div>
                <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Main</div>
                <div style="font-weight:600">${escapeHtml(getMenuItemName(guest.main))}</div>
              </div>
            `;
          }

          if (guest.side) {
            guestHtml += `
              <div>
                <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Side</div>
                <div style="font-weight:600">${escapeHtml(getMenuItemName(guest.side))}</div>
              </div>
            `;
          }

          guestHtml += '</div>';

          if (guest.special_requests) {
            guestHtml += `
              <div style="margin-top:8px;padding:8px;background:#fef3c7;border-radius:4px">
                <div style="font-size:0.75rem;color:#92400e;font-weight:600">Special Requests</div>
                <div style="color:#78350f">${escapeHtml(guest.special_requests)}</div>
              </div>
            `;
          }

          guestHtml += '</div>';
          return guestHtml;
        }).join('');
      }

      // Handle legacy/other formats
      if (dateData.time) {
        dayHtml += `<div style="color:var(--muted)">Time: <strong>${dateData.time}</strong></div>`;
      }

      if (dateData.special_requests && !dateData.guests) {
        dayHtml += `
          <div style="margin-top:8px;padding:8px;background:#fef3c7;border-radius:4px">
            <div style="font-size:0.75rem;color:#92400e;font-weight:600">Special Requests</div>
            <div style="color:#78350f">${escapeHtml(dateData.special_requests)}</div>
          </div>
        `;
      }

      return `<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">${dayHtml}</div>`;
    }).join('');
  }

  return `
    <div style="background:white;border:1px solid var(--ring);border-radius:8px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
        <div>
          <div style="font-weight:800;font-size:1.1rem">${escapeHtml(extra.extra_name || extra.extra_code || 'Extra')}</div>
          <div style="color:var(--muted);margin-top:2px">Quantity: ${Number(extra.quantity || 1)}</div>
        </div>
        <span class="badge ${st === 'completed' ? 'ok' : 'pending'}">
          ${st === 'completed' ? 'Completed' : 'Pending'}
        </span>
      </div>
      ${content}
    </div>
  `;
}

function renderSelectionDataFallback(data) {
  if (!data || typeof data !== 'object') return '';

  // Remove huge/known keys if you want (optional)
  const pretty = JSON.stringify(data, null, 2);

  // If it's empty, don't show anything
  if (pretty === '{}' ) return '';

  return `
    <div style="margin-top:10px">
      <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:6px">
        Raw selection_data
      </div>
      <pre style="background:#0b1020;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto;font-size:12px;line-height:1.4">
${escapeHtml(pretty)}
      </pre>
    </div>
  `;
}


function getMenuItemName(itemId) {
  return _menuItems[itemId] || 'Unknown Item';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}