// src/extras.js
// Extras & Add-ons Management Module
// Extracted from original app.js - preserves all functionality

import { supabase } from './config/supabase.js';
import { $, formatCurrency, toast } from './utils/helpers.js';

// Main initialization function
export async function initExtras() {
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

// Export for use by other modules
export { initExtras as default };