// src/chefMenu.js
// Chef Menu – admin module (vanilla JS, same init* pattern as reservations.js)

import { supabase } from './config/supabase.js';
import { $, toast } from './utils/helpers.js';

const CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'local_mains', label: 'Local Mains' },
  { value: 'continental_mains', label: 'Continental Mains' },
  { value: 'local_sides', label: 'Local Sides' },
  { value: 'continental_sides', label: 'Continental Sides' },
];

let _items = [];
let _filter = 'all';

export function initChefMenu() {
  const host = document.getElementById('chef-menu-root');
  if (!host) return;

  // inject toolbar once
  if (!host.dataset._wired) {
    host.dataset._wired = '1';
    host.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <div style="font-size:1.25rem;font-weight:800">Chef Menu</div>
          <div style="color:var(--muted);font-size:0.9rem">Manage menu items for chef service</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="chefmenu-filter" class="select"></select>
          <button id="chefmenu-add" class="btn btn-primary">+ Add Item</button>
        </div>
      </div>
      <div id="chefmenu-list" class="list">Loading…</div>
    `;

    const filterSel = document.getElementById('chefmenu-filter');
    if (filterSel) {
      filterSel.innerHTML = [
        `<option value="all">All categories</option>`,
        ...CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`),
      ].join('');
      filterSel.addEventListener('change', () => {
        _filter = filterSel.value || 'all';
        renderChefMenu();
      });
    }

    document.getElementById('chefmenu-add')?.addEventListener('click', () => {
      openChefMenuModal(null);
    });
  }

  loadChefMenu();
}

async function loadChefMenu() {
  const list = document.getElementById('chefmenu-list');
  if (list) list.textContent = 'Loading…';

  try {
    const { data, error } = await supabase
      .from('chef_menu_items')
      .select('id, category, name, description, available, created_at')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    _items = data || [];
    renderChefMenu();
  } catch (e) {
    console.error('chefMenu load error', e);
    if (list) list.innerHTML = `<div style="color:#b91c1c">Failed to load chef menu.</div>`;
  }
}

function renderChefMenu() {
  const list = document.getElementById('chefmenu-list');
  if (!list) return;

  const items = _filter === 'all' ? _items : _items.filter((x) => x.category === _filter);

  if (!items.length) {
    list.innerHTML = '<div style="color:var(--muted)">No menu items.</div>';
    return;
  }

  const catLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v || '';

  list.innerHTML = items
    .map((it) => {
      const badge = it.available
        ? '<span class="badge ok">Available</span>'
        : '<span class="badge err">Unavailable</span>';

      const desc = it.description ? String(it.description) : '';

      return `
        <div class="item" style="margin-bottom:10px">
          <div class="row" style="gap:12px;align-items:flex-start">
            <div style="flex:1">
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <div style="font-weight:800">${escapeHtml(it.name || '')}</div>
                ${badge}
                <span style="color:var(--muted);font-size:0.85rem">${escapeHtml(catLabel(it.category))}</span>
              </div>
              ${desc ? `<div style="color:#475569;margin-top:6px;white-space:pre-wrap">${escapeHtml(desc)}</div>` : ''}
            </div>
            <div class="room-card-footer" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn btn-sm ${it.available ? '' : 'btn-primary'}" data-cm-toggle="${it.id}">
                ${it.available ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn btn-sm" data-cm-edit="${it.id}">Edit</button>
              <button class="btn btn-sm" data-cm-del="${it.id}" style="color:#b91c1c">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-cm-toggle]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-cm-toggle');
      const it = _items.find((x) => String(x.id) === String(id));
      if (!it) return;
      await toggleAvailable(it);
    });
  });

  list.querySelectorAll('[data-cm-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-cm-edit');
      const it = _items.find((x) => String(x.id) === String(id));
      if (!it) return;
      openChefMenuModal(it);
    });
  });

  list.querySelectorAll('[data-cm-del]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-cm-del');
      if (!id) return;
      if (!confirm('Delete this item?')) return;
      await deleteItem(id);
    });
  });
}

async function toggleAvailable(it) {
  const next = !it.available;

  // Optimistic UI update so the button reflects immediately
  it.available = next;
  renderChefMenu();

  try {
    const { data, error } = await supabase
      .from('chef_menu_items')
      .update({ available: next })
      .eq('id', it.id)
      .select('id, available')
      .single();

    if (error) throw error;

    // Sync local state to what DB actually returned
    const updated = _items.find(x => String(x.id) === String(it.id));
    if (updated && data) updated.available = !!data.available;

    toast(next ? 'Activated' : 'Deactivated');
    renderChefMenu();
  } catch (e) {
    console.error('toggleAvailable error', e);

    // Revert optimistic update on failure
    it.available = !next;
    renderChefMenu();

    alert(`Failed to update: ${e?.message || e}`);
  }
}


async function deleteItem(id) {
  try {
    const { error } = await supabase.from('chef_menu_items').delete().eq('id', id);
    if (error) throw error;
    toast('Deleted');
    await loadChefMenu();
  } catch (e) {
    console.error('deleteItem error', e);
    alert('Failed to delete');
  }
}

function openChefMenuModal(item) {
  // remove any existing
  document.getElementById('chefmenu-modal')?.remove();

  const wrap = document.createElement('div');
  wrap.id = 'chefmenu-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  // close on backdrop click
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  const isEdit = !!item;
  const cat = item?.category || 'starters';
  const name = item?.name || '';
  const desc = item?.description || '';
  const available = item?.available ?? true;

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()">
      <div class="hd">
        <h3>${isEdit ? 'Edit' : 'Add'} Menu Item</h3>
        <button class="btn" id="chefmenu-close">×</button>
      </div>

      <div class="bd">
        <div class="form-group">
          <label>Category</label>
          <select id="cm-cat" class="select">
            ${CATEGORIES.map((c) => `<option value="${c.value}" ${c.value === cat ? 'selected' : ''}>${c.label}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>Name</label>
          <input id="cm-name" type="text" class="input" value="${escapeAttr(name)}" />
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea id="cm-desc" rows="4" class="input">${escapeHtml(desc)}</textarea>
        </div>

        <label class="checkbox-row" style="padding-top:6px">
          <input id="cm-available" type="checkbox" ${available ? 'checked' : ''} />
          <span>Available for selection</span>
        </label>
      </div>

      <div class="ft">
        <button class="btn" id="cm-cancel">Cancel</button>
        <button class="btn btn-primary" id="cm-save">Save</button>
      </div>
    </div>
  `;

  wrap.querySelector('#chefmenu-close')?.addEventListener('click', () => wrap.remove());
  wrap.querySelector('#cm-cancel')?.addEventListener('click', () => wrap.remove());

  wrap.querySelector('#cm-save')?.addEventListener('click', async () => {
    const payload = {
      category: wrap.querySelector('#cm-cat')?.value || 'starters',
      name: (wrap.querySelector('#cm-name')?.value || '').trim(),
      description: (wrap.querySelector('#cm-desc')?.value || '').trim(),
      available: !!wrap.querySelector('#cm-available')?.checked,
    };

    if (!payload.name) {
      alert('Name is required');
      return;
    }

    try {
      if (isEdit) {
        const { error } = await supabase
          .from('chef_menu_items')
          .update(payload)
          .eq('id', item.id);
        if (error) throw error;
        toast('Updated');
      } else {
        const { error } = await supabase.from('chef_menu_items').insert([payload]);
        if (error) throw error;
        toast('Added');
      }

      wrap.remove();
      await loadChefMenu();
    } catch (e) {
      console.error('save chef menu error', e);
      alert('Failed to save');
    }
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  // for use inside value=""
  return escapeHtml(str).replace(/\n/g, ' ');
}