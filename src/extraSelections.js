// src/extraSelections.js
// Extra Selections – admin module (vanilla JS, same init* pattern as reservations.js)

import { supabase } from './config/supabase.js';
import { $, formatDate, toast } from './utils/helpers.js';

let _reservations = [];
let _menuItems = {};
let _search = '';
let _status = 'all';
let collapsedGroups = new Set();
let _rtChannel = null;
let _reloadTimer = null;


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
          <option value="submitted">Submitted</option>
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
      if (action === 'edit' && resId && extraId) {
        const res = _reservations.find((r) => String(r.id) === String(resId));
        const extra = res?.reservation_extras?.find((x) => String(x.id) === String(extraId));
        if (res && extra) openEditSelectionsModal(res, extra);
    }

    });
  }

    // refresh when entering view
  load();

  function wireRealtime() {
  // prevent multiple subscriptions
  if (_rtChannel) return;

  _rtChannel = supabase
    .channel('extra-selections-rt')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservation_extras' },
      () => {
        // debounce reloads
        clearTimeout(_reloadTimer);
        _reloadTimer = setTimeout(() => load(), 250);
      }
    )
    .subscribe();
}

  // realtime updates for submitted selections
  wireRealtime();

}

async function load() {
  const list = document.getElementById('extraselections-list');
  try {
    if (list) list.textContent = 'Loading…';

    // Load menu items
    const { data: menuData } = await supabase
      .from('chef_menu_items')
      .select('id, name');

    if (menuData) {
      _menuItems = {};
      menuData.forEach(m => (_menuItems[m.id] = m.name));
    }

    // Load reservations with extras
    const { data, error } = await supabase
      .from('reservations')
        .select(`
          id,
          created_at,
          confirmation_code,
          group_reservation_code,
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
    
    // Now fetch needs_guest_input for all extras
    if (_reservations.length > 0) {
      const allExtraCodes = new Set();
      _reservations.forEach(res => {
        if (res.reservation_extras) {
          res.reservation_extras.forEach(extra => {
            if (extra.extra_code) {
              allExtraCodes.add(extra.extra_code);
            }
          });
        }
      });
      
      if (allExtraCodes.size > 0) {
        const { data: extrasData } = await supabase
          .from('extras')
          .select('code, needs_guest_input')
          .in('code', Array.from(allExtraCodes));
        
        // Create a map for quick lookup
        const needsInputMap = {};
        if (extrasData) {
          extrasData.forEach(extra => {
            needsInputMap[extra.code] = extra.needs_guest_input;
          });
        }
        
        // Attach needs_guest_input to each reservation_extra
        _reservations.forEach(res => {
          if (res.reservation_extras) {
            res.reservation_extras.forEach(extra => {
              extra.needs_guest_input = needsInputMap[extra.extra_code];
            });
          }
        });
      }
    }

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

function getTotalGuestsForReservation(res) {
  // Base from reservation row
  const base = (Number(res?.adults || 0) + Number(res?.children || 0)) || 0;

  // If selection_data indicates more guests (group bookings), use that
  let maxFromSelections = 0;
  const extras = Array.isArray(res?.reservation_extras) ? res.reservation_extras : [];
  extras.forEach((ex) => {
    const d = ex?.selection_data;
    if (!d || typeof d !== 'object') return;

    // Prefer guest_names count if present
    if (d.guest_names && typeof d.guest_names === 'object') {
      const n = Object.keys(d.guest_names).filter(k => k.startsWith('guest_')).length;
      if (n > maxFromSelections) maxFromSelections = n;
    }

    // Otherwise infer from guests keys
    if (d.guests && typeof d.guests === 'object') {
      const n = Object.keys(d.guests).filter(k => k.startsWith('guest_')).length;
      if (n > maxFromSelections) maxFromSelections = n;
    }
  });

  return Math.max(base, maxFromSelections);
}


function render() {
  const list = document.getElementById('extraselections-list');
  if (!list) return;

  const q = (_search || '').trim().toLowerCase();

  const filtered = _reservations.filter((r) => {
    const name = `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim().toLowerCase();
    const code = String((r.group_reservation_code || r.confirmation_code) || '').toLowerCase();
    const matchSearch = !q || name.includes(q) || code.includes(q);
    
    if (!matchSearch) return false;

    if (_status === 'all') return true;
    const extras = Array.isArray(r.reservation_extras) ? r.reservation_extras : [];
    return extras.some(e => getEffectiveStatus(e) === _status);

  });

  if (!filtered.length) {
    list.innerHTML = '<div style="color:var(--muted)">No selections found.</div>';
    return;
  }

  const html = filtered.map(res => {
    const displayCode =
    res.group_reservation_code || res.confirmation_code;
    const totalGuests = getTotalGuestsForReservation(res);
    const fullName = `${res.guest_first_name || ''} ${res.guest_last_name || ''}`.trim() || 'Unknown guest';
    const totalExtras = res.reservation_extras.length;
    const isCollapsed = collapsedGroups.has(String(res.id));


    // Determine overall status color
    const allSubmitted = res.reservation_extras.every(e => getEffectiveStatus(e) === 'submitted');
    const someSubmitted = res.reservation_extras.some(e => getEffectiveStatus(e) === 'submitted');
    const allCompleted = res.reservation_extras.every(e => getEffectiveStatus(e) === 'completed');
    const someCompleted = res.reservation_extras.some(e => getEffectiveStatus(e) === 'completed');


    let borderColor = '#f59e0b'; // orange for pending
    let bgGradient = 'linear-gradient(to right, #fffbeb, white)';
    
    if (allSubmitted) {
      borderColor = '#10b981'; // green for all submitted
      bgGradient = 'linear-gradient(to right, #ecfdf5, white)';
    } else if (allCompleted) {
      borderColor = '#f59e0b'; // amber for all completed
      bgGradient = 'linear-gradient(to right, #fef3c7, white)';
    } else if (someSubmitted || someCompleted) {
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
                <span class="code">${escapeHtml(displayCode)}</span>
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
              <span class="code">${escapeHtml(displayCode)}</span>

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

function hasSubmittedSelectionData(selection_data) {
  if (!selection_data || typeof selection_data !== 'object') return false;

  // New model
  if (selection_data.allocations && Object.keys(selection_data.allocations).length) return true;
  if (Array.isArray(selection_data.shared_dates) && selection_data.shared_dates.length) return true;

  // New model guest structure: guests.guest_0["2026-01-01"]...
  if (selection_data.guests && typeof selection_data.guests === 'object') {
    const gKeys = Object.keys(selection_data.guests);
    for (const gk of gKeys) {
      const byDate = selection_data.guests[gk];
      if (byDate && typeof byDate === 'object' && Object.keys(byDate).length) return true;
    }
  }

  // Legacy
  if (selection_data.dates && typeof selection_data.dates === 'object' && Object.keys(selection_data.dates).length) return true;

  return false;
}

function getEffectiveStatus(extra) {
  // If needs_guest_input is false, always show "selection not required"
  if (extra.needs_guest_input === false) {
    return 'selection not required';
  }
  
  const st = String(extra.selection_status || 'pending').toLowerCase();
  // Return the actual status from the database column
  // Possible values: 'pending', 'completed', 'submitted', 'selection not required'
  return st;
}


function renderStatusBadges(extras) {
  const badges = extras.map(e => {
    const st = getEffectiveStatus(e);
    let badge = '';
    
    if (st === 'submitted') {
      // Green for submitted
      badge = '<span class="badge" style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7">Submitted</span>';
    } else if (st === 'completed') {
      // Amber for completed
      badge = '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">Completed</span>';
    } else if (st === 'selection not required') {
      // Grey for not required
      badge = '<span class="badge" style="background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db">Not Required</span>';
    } else {
      // Default pending (orange/amber)
      badge = '<span class="badge pending">Pending</span>';
    }
    
    return badge;
  });
  return badges.join(' ');
}

function renderExtraCard(extra, resId) {
  const st = getEffectiveStatus(extra);
  
  // Generate badge HTML and status text based on status
  let badgeHtml = '';
  let statusText = '';
  let isActionable = false;
  
  if (st === 'submitted') {
    badgeHtml = '<span class="badge" style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7">Submitted</span>';
    statusText = 'Submitted';
    isActionable = true;
  } else if (st === 'completed') {
    badgeHtml = '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">Completed</span>';
    statusText = 'Completed';
    isActionable = false;
  } else if (st === 'selection not required') {
    badgeHtml = '<span class="badge" style="background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db">Not Required</span>';
    statusText = 'Not Required';
    isActionable = false;
  } else {
    badgeHtml = '<span class="badge pending">Pending</span>';
    statusText = 'Pending';
    isActionable = true;
  }

  
  return `
    <div style="background:white;border:1px solid var(--ring);border-radius:8px;padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:800">${escapeHtml(extra.extra_name || extra.extra_code || 'Extra')}</div>
          <div style="color:var(--muted);font-size:0.9rem">Qty: ${Number(extra.quantity || 1)}</div>
          ${extra.selected_at ? `<div style="color:var(--muted);font-size:0.85rem">Selected: ${formatDate(extra.selected_at)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${badgeHtml}

          <button
            class="btn btn-sm"
            data-action="edit"
            data-res-id="${resId}"
            data-extra-id="${extra.id}"
          >
            Edit
          </button>

          <button
            class="btn btn-sm ${st === 'submitted' ? '' : 'btn-primary'}"
            data-action="toggle"
            data-extra-id="${extra.id}"
          >
            ${st === 'submitted' ? 'Mark Pending' : 'Mark Submitted'}
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
        currentStatus = getEffectiveStatus(extra);
        break;
      }
    }

    const newStatus = currentStatus === 'submitted' ? 'pending' : 'submitted';

    const { error } = await supabase
      .from('reservation_extras')
      .update({ selection_status: newStatus })
      .eq('id', extraId);

    if (error) throw error;
    
    toast(newStatus === 'submitted' ? 'Marked as submitted' : 'Marked as pending');

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
    console.error('toggle status error', e);
    alert('Failed to update status');
  }
}

function openDetailsModal(res) {
  document.getElementById('extra-selection-modal')?.remove();

  const totalGuests = getTotalGuestsForReservation(res);
  const fullName = `${res.guest_first_name || ''} ${res.guest_last_name || ''}`.trim() || 'Unknown guest';

  const wrap = document.createElement('div');
  wrap.id = 'extra-selection-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  const displayCode =
  res.group_reservation_code || res.confirmation_code;

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()" style="max-width:800px">
      <div class="hd">
        <h3>Extra Selections</h3>
        <button class="btn" onclick="document.getElementById('extra-selection-modal').remove()">×</button>
      </div>
      <div class="bd" style="max-height:70vh;overflow-y:auto">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--ring)">
          <div style="font-weight:800;font-size:1.1rem">${escapeHtml(fullName)}</div>
          <span class="code">${escapeHtml(displayCode)}</span>

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

  wrap.querySelectorAll('button[data-action="edit"]').forEach(btn => {
  btn.addEventListener('click', () => {
    const extraId = btn.getAttribute('data-extra-id');
    const extra = res.reservation_extras.find(x => String(x.id) === String(extraId));
    if (extra) openEditSelectionsModal(res, extra);
  });
});

}

function renderExtraDetail(extra, totalGuests, res) {
  const data = extra.selection_data || {};
  const st = getEffectiveStatus(extra);
  

  const effectiveTotalGuests = Math.max(
    totalGuests || 0,
    getGuestCountFromSelectionData(data, 0) || 0
  );

  let content = '';

  // Only treat as chef-style if payload actually looks like chef selections
  if (isChefSelectionData(data)) {
    const chefDays = normalizeChefDays(data, effectiveTotalGuests);

    if (chefDays.length > 0) {
      content = chefDays.map(day => {
        const header = `
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <div style="font-weight:800;color:#0369a1">${formatDate(day.date)}</div>
            ${day.allocationsCount ? `<div class="badge" style="background:#eef2ff;color:#3730a3;border:1px solid #c7d2fe">Units: ${day.allocationsCount}</div>` : ''}
          </div>
        `;

        const guestsHtml = (day.guests || []).map(g => {
          const labelName =
            g.name ||
            (data.guest_names && data.guest_names[`guest_${g.index}`]) ||
            ((g.index === 0 && res?.guest_first_name) ? `${res.guest_first_name} ${res.guest_last_name || ''}`.trim() : '');

          // Legacy guest shape
          if (g.legacy) {
            return `
              <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:12px;margin-top:10px;border-radius:8px">
                <div style="font-weight:700;color:#1e40af;margin-bottom:8px">
                  Guest ${g.index + 1}${labelName ? ` (${escapeHtml(labelName)})` : ''}
                </div>
                <div style="display:grid;grid-template-columns:1fr;gap:10px">
                  <div>
                    <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Starter</div>
                    <div style="font-weight:600">${escapeHtml(getMenuItemName(g.starter))}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Main</div>
                    <div style="font-weight:600">${escapeHtml(getMenuItemName(g.main))}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Side</div>
                    <div style="font-weight:600">${escapeHtml(getMenuItemName(g.side))}</div>
                  </div>
                </div>
                ${g.special_requests ? `
                  <div style="margin-top:10px;padding:10px;background:#fef3c7;border-radius:8px">
                    <div style="font-size:0.75rem;color:#92400e;font-weight:700">Special Requests</div>
                    <div style="color:#78350f">${escapeHtml(g.special_requests)}</div>
                  </div>
                ` : ''}
              </div>
            `;
          }

          // New model guest shape: lunch/dinner blocks
          return `
            <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:12px;margin-top:10px;border-radius:8px">
              <div style="font-weight:700;color:#1e40af;margin-bottom:8px">
                Guest ${g.index + 1}${labelName ? ` (${escapeHtml(labelName)})` : ''}
              </div>
              ${renderMealBlock('Lunch', g.lunch)}
              ${renderMealBlock('Dinner', g.dinner)}
              ${g.special_requests ? `
                <div style="margin-top:10px;padding:10px;background:#fef3c7;border-radius:8px">
                  <div style="font-size:0.75rem;color:#92400e;font-weight:700">Special Requests</div>
                  <div style="color:#78350f">${escapeHtml(g.special_requests)}</div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        const emptyNote = (!day.guests || day.guests.length === 0)
          ? `<div style="color:var(--muted);margin-top:10px">No per-guest menu details were found for this day.</div>`
          : '';

        return `
          <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb">
            ${header}
            ${guestsHtml}
            ${emptyNote}
          </div>
        `;
      }).join('');
    } else {
      content = `<div style="color:var(--muted);margin-top:8px">No chef selection days found.</div>` + renderSelectionDataFallback(data);
    }
  } else {
    // Non-chef extras: show human-readable summary (date/time) where possible
    content = renderNonChefSelectionSummary(data) + renderSelectionDataFallback(data);
  }

  return `
    <div style="background:white;border:1px solid var(--ring);border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;gap:8px;flex-wrap:wrap">
        <div>
          <div style="font-weight:900;font-size:1.05rem">${escapeHtml(extra.extra_name || extra.extra_code || 'Extra')}</div>
          <div style="color:var(--muted);margin-top:2px">Quantity: ${Number(extra.quantity || 1)}</div>
          ${extra.selected_at ? `<div style="color:var(--muted);font-size:0.85rem">Submitted: ${formatDate(extra.selected_at)}</div>` : ''}
        </div>
        ${(() => {
          if (st === 'submitted') {
            return '<span class="badge" style="background:#d1fae5;color:#065f46;border:1px solid #6ee7b7">Submitted</span>';
          } else if (st === 'completed') {
            return '<span class="badge" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d">Completed</span>';
          } else if (st === 'selection not required') {
            return '<span class="badge" style="background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db">Not Required</span>';
          } else {
            return '<span class="badge pending">Pending</span>';
          }
        })()}
      </div>
      ${content}
    </div>
  `;
}


function renderNonChefSelectionSummary(data) {
  if (!data || typeof data !== 'object') return '';

  // Common shape: { dates: { experience-0: {date:'YYYY-MM-DD', time:'HH:MM', ...}, ... } }
  const datesObj = data.dates && typeof data.dates === 'object' ? data.dates : null;
  if (!datesObj) return '';

  const rows = [];
  Object.entries(datesObj).forEach(([k, v]) => {
    if (!v || typeof v !== 'object') return;

    // If the key is a date, use it, otherwise look for v.date
    const d = isIsoDateKey(k) ? k : (isIsoDateKey(v.date) ? v.date : null);
    const t = (v.time || v.start_time || v.slot || '').toString().trim();

    if (d || t) {
      rows.push({ key: k, date: d, time: t });
    }
  });

  if (!rows.length) return '';

  // Sort by date then time
  rows.sort((a, b) => {
    const ad = a.date || '';
    const bd = b.date || '';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.time || '').localeCompare(b.time || '');
  });

  return `
    <div style="margin-top:8px;margin-bottom:10px">
      <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Selections</div>
      <div style="display:grid;gap:6px">
        ${rows.map(r => `
          <div style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">
            <div style="font-weight:800;color:#0f172a">${r.date ? formatDate(r.date) : 'Date not set'}</div>
            ${r.time ? `<div style="color:var(--muted);margin-top:2px">Time: ${escapeHtml(r.time)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSelectionDataFallback(data) {
  if (!data || typeof data !== 'object') return '';

  // Quick human-readable snippets for common keys
  let bits = '';

  if (Array.isArray(data.shared_dates) && data.shared_dates.length) {
    bits += `
      <div style="margin-top:10px">
        <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Shared dates</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${data.shared_dates.filter(isIsoDateKey).map(d => `<span class="badge" style="background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0">${formatDate(d)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  if (data.allocations && typeof data.allocations === 'object' && Object.keys(data.allocations).length) {
    const rows = Object.entries(data.allocations)
      .filter(([d]) => isIsoDateKey(d))
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([d, rooms]) => {
        const n = Array.isArray(rooms) ? rooms.length : 0;
        return `<div style="display:flex;justify-content:space-between;gap:10px">
          <div style="font-weight:700">${formatDate(d)}</div>
          <div style="color:var(--muted)">${n} unit(s)</div>
        </div>`;
      })
      .join('');
    if (rows) {
      bits += `
        <div style="margin-top:10px">
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Allocations</div>
          <div style="padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;display:grid;gap:6px">
            ${rows}
          </div>
        </div>
      `;
    }
  }

    return bits;

}



function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isIsoDateKey(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function getMenuItemName(itemId) {
  if (!itemId) return '';
  return _menuItems[itemId] || 'Unknown Item';
}

// Detect if selection_data is chef-style (new or legacy)
function isChefSelectionData(selection_data) {
  if (!selection_data || typeof selection_data !== 'object') return false;

  // --- New chef model: guests.guest_X has ISO date keys with meal objects ---
  const guests = selection_data.guests;
  if (guests && typeof guests === 'object') {
    for (const gk of Object.keys(guests)) {
      if (!gk.startsWith('guest_')) continue;
      const byDate = guests[gk];
      if (!byDate || typeof byDate !== 'object') continue;

      for (const d of Object.keys(byDate)) {
        if (!isIsoDateKey(d)) continue;
        const entry = byDate[d];
        if (!entry || typeof entry !== 'object') continue;

        // Must actually contain lunch/dinner payloads to be chef
        if (entry.lunch || entry.dinner) return true;
      }
    }
  }

  // allocations/shared_dates can exist for chef, but only if they look like chef payloads
  // (i.e. ISO date keys) AND we also have guest meal entries OR legacy guests array.
  const hasAllocations =
    selection_data.allocations &&
    typeof selection_data.allocations === 'object' &&
    Object.keys(selection_data.allocations).some(isIsoDateKey);

  const hasSharedDates =
    Array.isArray(selection_data.shared_dates) &&
    selection_data.shared_dates.some(isIsoDateKey);

  // --- Legacy chef model: dates has ISO date keys AND contains guests array ---
  const dates = selection_data.dates;
  if (dates && typeof dates === 'object') {
    // Legacy chef uses ISO dates as keys (not "experience-0")
    const isoKeys = Object.keys(dates).filter(isIsoDateKey);
    for (const d of isoKeys) {
      const v = dates[d];
      if (v && typeof v === 'object' && Array.isArray(v.guests) && v.guests.length) {
        return true;
      }
    }
  }

  // If we only have allocations/shared_dates without guest meal structure, do NOT treat as chef.
  // (Non-chef experiences also use selection_data.dates with experience-* keys.)
  return false;
}


// How many guests are implied by selection_data?
function getGuestCountFromSelectionData(selection_data, fallback = 0) {
  if (!selection_data || typeof selection_data !== 'object') return fallback;

  // Prefer guest_names (most reliable)
  if (selection_data.guest_names && typeof selection_data.guest_names === 'object') {
    const n = Object.keys(selection_data.guest_names).filter(k => k.startsWith('guest_')).length;
    if (n) return n;
  }

  // Otherwise infer from guests keys
  if (selection_data.guests && typeof selection_data.guests === 'object') {
    const n = Object.keys(selection_data.guests).filter(k => k.startsWith('guest_')).length;
    if (n) return n;
  }

  // Legacy: dates[date].guests length
  if (selection_data.dates && typeof selection_data.dates === 'object') {
    // find max length across dates
    let max = 0;
    Object.values(selection_data.dates).forEach(v => {
      if (v && typeof v === 'object' && Array.isArray(v.guests)) {
        if (v.guests.length > max) max = v.guests.length;
      }
    });
    if (max) return max;
  }

  return fallback;
}

// Normalize chef days from new or legacy selection_data into a common list
function normalizeChefDays(selection_data, totalGuests) {
  const data = selection_data || {};
  const dateSet = new Set();

  // Candidate dates from allocations/shared_dates/guests/legacy
  if (data.allocations && typeof data.allocations === 'object') {
    Object.keys(data.allocations).forEach(d => isIsoDateKey(d) && dateSet.add(d));
  }
  if (Array.isArray(data.shared_dates)) {
    data.shared_dates.forEach(d => isIsoDateKey(d) && dateSet.add(d));
  }
  if (data.guests && typeof data.guests === 'object') {
    Object.keys(data.guests).forEach(gk => {
      const byDate = data.guests[gk];
      if (byDate && typeof byDate === 'object') {
        Object.keys(byDate).forEach(d => isIsoDateKey(d) && dateSet.add(d));
      }
    });
  }
  if (data.dates && typeof data.dates === 'object') {
    Object.keys(data.dates).forEach(d => isIsoDateKey(d) && dateSet.add(d));
  }

  const dates = Array.from(dateSet).sort();
  const days = [];

  for (const date of dates) {
    const day = { date, allocationsCount: 0, guests: [] };

    if (data.allocations && Array.isArray(data.allocations[date])) {
      day.allocationsCount = data.allocations[date].length;
    }

    // New model guests
    if (data.guests && typeof data.guests === 'object') {
      for (let i = 0; i < totalGuests; i++) {
        const gk = `guest_${i}`;
        const byDate = data.guests[gk];
        const entry = byDate && byDate[date];
        if (!entry) continue;

        day.guests.push({
          index: i,
          name: data.guest_names ? data.guest_names[gk] : '',
          lunch: entry.lunch || null,
          dinner: entry.dinner || null,
          special_requests: entry.special_requests || entry.requests || ''
        });
      }
    }

    // Legacy model
    if (day.guests.length === 0 && data.dates && data.dates[date] && Array.isArray(data.dates[date].guests)) {
      data.dates[date].guests.forEach((g, idx) => {
        if (!g) return;
        day.guests.push({
          index: idx,
          legacy: true,
          starter: g.starter,
          main: g.main,
          side: g.side,
          special_requests: g.special_requests || ''
        });
      });
    }

    days.push(day);
  }

  return days;
}

function buildStayDates(checkIn, checkOut) {
  // checkOut is exclusive (nights)
  const dates = [];
  if (!checkIn || !checkOut) return dates;

  const start = new Date(checkIn + 'T00:00:00');
  const end = new Date(checkOut + 'T00:00:00');

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

function menuOptionsHtml(selectedId) {
  const ids = Object.keys(_menuItems || {});
  ids.sort((a, b) => String(_menuItems[a]).localeCompare(String(_menuItems[b])));
  return `
    <option value="">—</option>
    ${ids.map(id => `<option value="${id}" ${String(id) === String(selectedId || '') ? 'selected' : ''}>${escapeHtml(_menuItems[id])}</option>`).join('')}
  `;
}

function looksLikeChefExtra(extra) {
  const name = String(extra?.extra_name || '').toLowerCase();
  const code = String(extra?.extra_code || '').toLowerCase();
  const data = extra?.selection_data;
  return (
    isChefSelectionData(data) ||
    name.includes('chef') ||
    (name.includes('food') && name.includes('chef')) ||
    code.includes('chef')
  );
}

function openEditSelectionsModal(res, extra) {
  document.getElementById('extra-selection-edit-modal')?.remove();

  const stayDates = buildStayDates(res.check_in, res.check_out);
  const totalGuests = getTotalGuestsForReservation(res);
  const fullName = `${res.guest_first_name || ''} ${res.guest_last_name || ''}`.trim() || 'Unknown guest';

  const isChef = looksLikeChefExtra(extra);

  // clone existing data safely
  const existing = (extra.selection_data && typeof extra.selection_data === 'object')
    ? JSON.parse(JSON.stringify(extra.selection_data))
    : {};

  // ensure guest_names
  existing.guest_names = (existing.guest_names && typeof existing.guest_names === 'object') ? existing.guest_names : {};

  // default selected dates (chef uses shared_dates; non-chef uses dates.experience-*)
  let selectedDates = [];
  if (Array.isArray(existing.shared_dates) && existing.shared_dates.length) {
    selectedDates = existing.shared_dates.filter(isIsoDateKey);
  } else if (existing.dates && typeof existing.dates === 'object') {
    // non-chef model
    Object.values(existing.dates).forEach(v => {
      if (v && typeof v === 'object' && isIsoDateKey(v.date)) selectedDates.push(v.date);
    });
  }
  selectedDates = Array.from(new Set(selectedDates));

  const wrap = document.createElement('div');
  wrap.id = 'extra-selection-edit-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  const dateCheckboxes = stayDates.map(d => `
    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" class="edit-date" value="${d}" ${selectedDates.includes(d) ? 'checked' : ''} />
      <span>${formatDate(d)}</span>
    </label>
  `).join('');

  // guest name inputs
  const guestNameInputs = Array.from({ length: totalGuests }).map((_, i) => {
    const key = `guest_${i}`;
    const val = existing.guest_names[key] || (i === 0 ? fullName : '');
    return `
      <div style="display:flex;gap:10px;align-items:center">
        <div style="width:90px;color:var(--muted)">Guest ${i + 1}</div>
        <input class="input edit-guest-name" data-guest="${key}" value="${escapeHtml(val)}" placeholder="Guest name" style="flex:1" />
      </div>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()" style="max-width:900px">
      <div class="hd">
        <h3>Add / Edit</h3>
        <button class="btn" onclick="document.getElementById('extra-selection-edit-modal').remove()">×</button>
      </div>
      <div class="bd" style="max-height:70vh;overflow-y:auto">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--ring)">
          <div style="font-weight:800;font-size:1.05rem">${escapeHtml(fullName)}</div>
          <span class="code">${escapeHtml(res.group_reservation_code || res.confirmation_code)}</span>
          <span class="badge" style="background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0">${escapeHtml(extra.extra_name || extra.extra_code || 'Extra')}</span>
          <span class="badge" style="background:#f8fafc;color:#0f172a;border:1px solid #e5e7eb">Qty: ${Number(extra.quantity || 1)}</span>
        </div>

        <div style="margin-bottom:14px">
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:6px">Dates to apply</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">
            ${dateCheckboxes || '<div style="color:var(--muted)">No stay dates found.</div>'}
          </div>
        </div>

        <div style="margin-bottom:14px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:10px">Guest names</div>
          <div style="display:grid;gap:10px">
            ${guestNameInputs}
          </div>
        </div>

        <div id="edit-selection-form-area"></div>
      </div>

      <div class="ft" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <button class="btn" onclick="document.getElementById('extra-selection-edit-modal').remove()">Cancel</button>
        <button class="btn btn-primary" id="edit-selection-save">Save Selections</button>
      </div>
    </div>
  `;

  const formArea = wrap.querySelector('#edit-selection-form-area');

  function getCheckedDates() {
    return Array.from(wrap.querySelectorAll('.edit-date'))
      .filter(x => x.checked)
      .map(x => x.value)
      .filter(isIsoDateKey);
  }

  function readGuestNames() {
    const out = {};
    wrap.querySelectorAll('.edit-guest-name').forEach(inp => {
      const k = inp.getAttribute('data-guest');
      out[k] = (inp.value || '').trim();
    });
    return out;
  }

  // Build UI based on type
  if (isChef) {
    // ensure guests container
    existing.guests = (existing.guests && typeof existing.guests === 'object') ? existing.guests : {};

    // render meal pickers for selected dates
    const renderChefUi = () => {
      const dates = getCheckedDates();
      if (!dates.length) {
        formArea.innerHTML = `<div style="color:var(--muted)">Select at least one date above.</div>`;
        return;
      }

      const sections = dates.map(date => {
        const guestBlocks = Array.from({ length: totalGuests }).map((_, i) => {
          const gk = `guest_${i}`;
          existing.guests[gk] = (existing.guests[gk] && typeof existing.guests[gk] === 'object') ? existing.guests[gk] : {};
          const entry = existing.guests[gk][date] || {};
          const lunch = entry.lunch || {};
          const dinner = entry.dinner || {};

          return `
            <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-top:10px">
              <div style="font-weight:800;color:#1e40af;margin-bottom:10px">Guest ${i + 1}</div>

              <div style="font-weight:800;margin-bottom:6px">Lunch</div>
              <div style="display:grid;grid-template-columns:1fr;gap:10px">

                <label>Appetizer
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="lunch" data-field="starter">${menuOptionsHtml(lunch.appetizer)}</select>
                </label>
                <label>Main
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="lunch" data-field="main">${menuOptionsHtml(lunch.main)}</select>
                </label>
                <label>Side
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="lunch" data-field="side">${menuOptionsHtml(lunch.side)}</select>
                </label>
              </div>

              <div style="font-weight:800;margin:10px 0 6px">Dinner</div>
              <div style="display:grid;grid-template-columns:1fr;gap:10px">

                <label>Appetizer
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="dinner" data-field="starter">${menuOptionsHtml(dinner.appetizer)}</select>
                </label>
                <label>Main
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="dinner" data-field="main">${menuOptionsHtml(dinner.main)}</select>
                </label>
                <label>Side
                  <select class="select edit-meal" data-date="${date}" data-guest="${gk}" data-meal="dinner" data-field="side">${menuOptionsHtml(dinner.side)}</select>
                </label>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div style="background:white;border:1px solid var(--ring);border-radius:12px;padding:14px;margin-bottom:14px">
            <div style="font-weight:900;color:#0369a1">${formatDate(date)}</div>
            ${guestBlocks}
          </div>
        `;
      }).join('');

      formArea.innerHTML = sections;
    };

    // initial render + re-render when dates change
    wrap.querySelectorAll('.edit-date').forEach(cb => cb.addEventListener('change', renderChefUi));
    renderChefUi();

    // Save
    wrap.querySelector('#edit-selection-save').addEventListener('click', async () => {
      const dates = getCheckedDates();
      if (!dates.length) return toast('Select at least one date');

      const guest_names = readGuestNames();

      // Build new-model payload
      const guests = {};
      for (let i = 0; i < totalGuests; i++) {
        const gk = `guest_${i}`;
        guests[gk] = guests[gk] || {};
        dates.forEach(date => {
          // read from DOM selects
          const pick = (meal, field) => {
            const sel = wrap.querySelector(`select.edit-meal[data-date="${date}"][data-guest="${gk}"][data-meal="${meal}"][data-field="${field}"]`);
            return sel ? (sel.value || null) : null;
          };
          guests[gk][date] = {
            lunch: {
              appetizer: pick('lunch','starter'),
              main: pick('lunch','main'),
              side: pick('lunch','side')
            },
            dinner: {
              appetizer: pick('dinner','starter'),
              main: pick('dinner','main'),
              side: pick('dinner','side')
            }
          };
        });
      }

      const payload = {
        ...existing,
        guests,
        guest_names,
        shared_dates: dates
      };

      await saveExtraSelection(extra.id, payload);
      wrap.remove();
    });

  } else {
    // Non-chef: quantity occurrences with date + time
    const qty = Math.max(1, Number(extra.quantity || 1));
    existing.dates = (existing.dates && typeof existing.dates === 'object') ? existing.dates : {};

    const renderNonChefUi = () => {
      const dates = stayDates;
      const blocks = Array.from({ length: qty }).map((_, i) => {
        const key = `experience-${i}`;
        const cur = (existing.dates[key] && typeof existing.dates[key] === 'object') ? existing.dates[key] : {};
        return `
          <div style="background:white;border:1px solid var(--ring);border-radius:12px;padding:14px;margin-bottom:14px">
            <div style="font-weight:900;margin-bottom:10px">Selection ${i + 1}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
              <label>Date
                <select class="select edit-nonchef-date" data-key="${key}">
                  <option value="">—</option>
                  ${dates.map(d => `<option value="${d}" ${String(d) === String(cur.date || '') ? 'selected' : ''}>${formatDate(d)}</option>`).join('')}
                </select>
              </label>
              <label>Time
                <input type="time" class="input edit-nonchef-time" data-key="${key}" value="${escapeHtml(cur.time || '')}" placeholder="e.g. 16:00" />
              </label>
            </div>
          </div>
        `;
      }).join('');

      formArea.innerHTML = blocks || `<div style="color:var(--muted)">No selections.</div>`;
    };

    renderNonChefUi();

    wrap.querySelector('#edit-selection-save').addEventListener('click', async () => {
      const guest_names = readGuestNames();

      const datesObj = {};
      for (let i = 0; i < qty; i++) {
        const key = `experience-${i}`;
        const dSel = wrap.querySelector(`select.edit-nonchef-date[data-key="${key}"]`);
        const tInp = wrap.querySelector(`input.edit-nonchef-time[data-key="${key}"]`);
        const date = dSel ? (dSel.value || '') : '';
        const time = tInp ? (tInp.value || '').trim() : '';
        datesObj[key] = { date, time };
      }

      const payload = {
        ...existing,
        guest_names,
        dates: datesObj
      };

      await saveExtraSelection(extra.id, payload);
      wrap.remove();
    });
  }
}

async function saveExtraSelection(extraId, selection_data) {
  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('reservation_extras')
      .update({
        selection_data,
        selection_status: 'completed',
        selected_at: nowIso
      })
      .eq('id', extraId);

    if (error) throw error;

    // update local cache
    for (const r of _reservations) {
      const ex = r.reservation_extras?.find(x => String(x.id) === String(extraId));
      if (ex) {
        ex.selection_data = selection_data;
        ex.selection_status = 'completed';
        ex.selected_at = nowIso;
        break;
      }
    }

    toast('Selections saved');
    render();
  } catch (e) {
    console.error('saveExtraSelection error', e);
    alert('Failed to save selections');
  }
}

function renderMealBlock(title, meal) {
  if (!meal) return '';

  const a = meal.appetizer ? escapeHtml(getMenuItemName(meal.appetizer)) : '';
  const m = meal.main ? escapeHtml(getMenuItemName(meal.main)) : '';
  const s = meal.side ? escapeHtml(getMenuItemName(meal.side)) : '';

  // Only show block if something was chosen
  if (!a && !m && !s) return '';

  return `
    <div style="margin-top:8px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff">
      <div style="font-weight:800;margin-bottom:8px">${escapeHtml(title)}</div>
      <div style="display:grid;grid-template-columns:1fr;gap:10px">

        <div>
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Starter</div>
          <div style="font-weight:600">${a || '-'}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Main</div>
          <div style="font-weight:600">${m || '-'}</div>
        </div>
        <div>
          <div style="font-size:0.75rem;color:var(--muted);text-transform:uppercase">Side</div>
          <div style="font-weight:600">${s || '-'}</div>
        </div>
      </div>
    </div>
  `;
}