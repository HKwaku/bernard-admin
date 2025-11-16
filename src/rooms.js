// src/rooms.js
// Room Types Management Module
// Extracted from original app.js - preserves all functionality

import { supabase } from './config/supabase.js';
import { $, formatCurrency, toast } from './utils/helpers.js';

// ---- Shared helper: upload room image to Supabase Storage ----
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

// Main initialization function
export async function initRooms() {
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
          <div style="display:flex; gap:8px; align-items:center">
            <input id="r-image" type="url" placeholder="https://..." style="flex:1" />
            <input id="r-image-file" type="file" accept="image/*" style="width:auto" />
          </div>
          <div id="r-image-preview" style="margin-top:8px; display:none">
            <img id="r-image-preview-img" src="" alt="preview" style="max-width:100%; border-radius:10px"/>
          </div>
          <div id="r-image-help" class="muted" style="margin-top:6px">
            Choose an image to upload; the URL will be filled automatically.
          </div>
        </div>
      </div>

      <div class="ft">
        <button class="btn" id="room-cancel">Cancel</button>
        <button class="btn btn-primary" id="room-save">${id ? 'Update' : 'Create'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // ---- image upload wiring (rooms) ----
  const fileInput        = modal.querySelector('#r-image-file');
  const imageUrlInput    = modal.querySelector('#r-image');
  const imagePreview     = modal.querySelector('#r-image-preview');
  const imagePreviewImg  = modal.querySelector('#r-image-preview-img');

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const code = (modal.querySelector('#r-code')?.value || 'ROOM').toString().toUpperCase();
    try {
      const publicUrl = await uploadRoomImage(file, code);
      imageUrlInput.value = publicUrl;
      if (imagePreviewImg) {
        imagePreviewImg.src = publicUrl;
        imagePreview.style.display = 'block';
      }

      // If editing an existing room, persist immediately
      if (id) {
        const { error } = await supabase.from('room_types')
          .update({ image_url: publicUrl })
          .eq('id', id);
        if (error) throw error;
        toast('Image uploaded and room updated');
        await initRooms();
      } else {
        // In create mode, the URL will be saved when the user clicks "Create"
        toast('Image uploaded — URL filled. Save the room to persist.');
      }
    } catch (err) {
      alert('Upload failed: ' + (err.message || err));
    }
  });

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

  // Show preview if an image is set
  if (r.image_url) {
    const prev = document.getElementById('r-image-preview');
    const img  = document.getElementById('r-image-preview-img');
    if (img && prev) {
      img.src = r.image_url;
      prev.style.display = 'block';
    }
  }
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

// Export for use by other modules
export { initRooms as default };