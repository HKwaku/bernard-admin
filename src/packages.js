// src/packages.js
// Package management (list, add/edit, view, activate/deactivate, delete)

import { supabase } from './config/supabase.js';
import { $, formatCurrency, formatDate, toast } from './utils/helpers.js';

// ---- Shared helper: upload package image to Supabase Storage ----
async function uploadPackageImage(file, code) {
  const bucket = 'cabin-images'; // your existing bucket
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `packages/${String(code || 'PACKAGE').toUpperCase()}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, cacheControl: '3600' });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl; // final public URL
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

  const list = document.getElementById('packages-list');
  if (!list) return;

  list.innerHTML = `<div class="muted">Loading…</div>`;

  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

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

      const validity =
        p.valid_from || p.valid_until
          ? `<span>Valid: <strong>${formatDate(p.valid_from) || '—'}</strong> → <strong>${
              formatDate(p.valid_until) || '—'
            }</strong></span>`
          : '';

      return `
        <div class="item" data-pkg-id="${p.id}">
          <div class="row" style="align-items:flex-start;gap:12px">
            ${
              p.image_url
                ? `<img class="pkg-thumb" src="${p.image_url}" alt="${p.name || ''}">`
                : ''
            }
            <div style="flex:1">
              <div class="title">${p.name || ''}</div>
              ${
                p.description
                  ? `<div class="pkg-meta" style="margin-top:4px">${p.description}</div>`
                  : ''
              }
              <div class="meta" style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap">
                <span>Code: <strong>${(p.code || '').toUpperCase()}</strong></span>
                <span>Price: <strong>${formatCurrency(
                  p.package_price || 0,
                  p.currency || 'GHS'
                )}</strong></span>
                ${p.nights ? `<span>Nights: <strong>${p.nights}</strong></span>` : ''}
                ${validity}
                ${p.is_featured ? `<span>Featured</span>` : ''}
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${isActive ? 'ok' : 'err'}">
                ${isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div class="room-card-footer">
            <button class="btn btn-sm" data-pkg-edit="${p.id}">Edit</button>
            <button class="btn btn-sm" data-pkg-toggle="${p.id}" data-pkg-active="${isActive}">
              ${isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn btn-sm" data-pkg-delete="${p.id}" style="color:#b91c1c">
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  list.innerHTML = html;

  // --- wire actions inside cards ---
  list.querySelectorAll('[data-pkg-edit]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openPackageModal('edit', b.getAttribute('data-pkg-edit'));
    })
  );

  list.querySelectorAll('[data-pkg-toggle]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = b.getAttribute('data-pkg-toggle');
      const isActive = b.getAttribute('data-pkg-active') === 'true';
      await togglePackageStatus(id, !isActive);
    })
  );

  list.querySelectorAll('[data-pkg-delete]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deletePackage(b.getAttribute('data-pkg-delete'));
    })
  );

  // --- clicking the card opens view modal ---
  list.querySelectorAll('.item').forEach((card) => {
    const id = card.getAttribute('data-pkg-id');
    if (!id) return;
    card.addEventListener('click', () => openPackageViewModal(id));
  });
}

function openPackageModal(mode = 'add', id = null) {
  const wrap = document.createElement('div');
  wrap.id = 'package-modal';
  wrap.className = 'modal show';
  document.body.appendChild(wrap);

  const toDateInput = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  };

  const loadExisting = async () => {
    if (mode !== 'edit' || !id) return null;
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      alert('Error loading package: ' + error.message);
      return null;
    }
    return data;
  };

  (async () => {
    const p = (await loadExisting()) || {};

    // room types
    const { data: rooms } = await supabase
      .from('room_types')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // existing packages_rooms
    let selectedRoomIds = [];
    if (mode === 'edit' && id) {
      try {
        const { data: pkgRooms } = await supabase
          .from('packages_rooms')
          .select('room_type_id')
          .eq('package_id', id);
        selectedRoomIds = (pkgRooms || []).map((r) => r.room_type_id);
      } catch (e) {
        console.warn('packages_rooms lookup failed (table may not exist yet):', e);
      }
    }

        // existing package_extras
    const selectedExtraQuantities = {};
    if (mode === 'edit' && id) {
      try {
        const { data: pkgExtras } = await supabase
          .from('package_extras')
          .select('extra_id, quantity')
          .eq('package_id', id);
        (pkgExtras || []).forEach((x) => {
          selectedExtraQuantities[x.extra_id] = x.quantity ?? 1;
        });
      } catch (e) {
        console.warn('package_extras lookup failed (table may not exist yet):', e);
      }
    }


    // extras list
    const { data: extras } = await supabase
      .from('extras')
      .select('id, code, name, price, category')
      .order('name', { ascending: true });

    const roomCheckboxesHtml = (rooms || [])
      .map((r) => {
        const isSelected = selectedRoomIds.includes(r.id);
        return `
          <label style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
            <input
              type="checkbox"
              class="pkg-room-code"
              value="${r.id}"
              data-code="${r.code || ''}"
              data-name="${r.name || ''}"
              ${isSelected ? 'checked' : ''}
              style="width:auto"
            />
            <span>${(r.code || '').toUpperCase()} – ${r.name || ''}</span>
          </label>
        `;
      })
      .join('');

        const extrasHtml = (extras || [])
      .map((e) => {
        const qty =
          selectedExtraQuantities && selectedExtraQuantities[e.id] != null
            ? selectedExtraQuantities[e.id]
            : 0;

        return `
        <div class="pkg-extra-row" data-extra-id="${e.id}" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;padding:8px;border:1px solid var(--ring);border-radius:10px;">
          <div>
            <div style="font-weight:700">${e.name}</div>
            <div style="color:#64748b;font-size:0.85rem">GHS ${e.price ?? 0}</div>
          </div>

          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-sm pkg-extra-dec" data-id="${e.id}">−</button>
            <span class="pkg-extra-qty" id="pkg-extra-qty-${e.id}">${qty}</span>
            <button class="btn btn-sm pkg-extra-inc" data-id="${e.id}">+</button>
          </div>
        </div>`;
      })
      .join('');


    wrap.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3>${mode === 'edit' ? 'Edit' : 'Add'} Package</h3>
          <button class="btn" onclick="document.getElementById('package-modal').remove()">×</button>
        </div>

        <div class="bd">
          <div class="form-grid">
            <div class="form-group">
              <label>Code *</label>
              <input id="pkg-code" type="text" value="${p.code || ''}">
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input id="pkg-name" type="text" value="${p.name || ''}">
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea id="pkg-desc" rows="3">${p.description || ''}</textarea>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Package Price *</label>
              <input id="pkg-price" type="number" step="0.01" value="${p.package_price ?? ''}">
            </div>
            <div class="form-group">
              <label>Currency *</label>
              <input id="pkg-currency" type="text" value="${p.currency || 'GHS'}">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Room Types</label>
              <div id="pkg-room-types">
                ${
                  roomCheckboxesHtml ||
                  '<div class="muted">No active room types. Create room types first.</div>'
                }
              </div>
              <div class="muted" style="margin-top:4px;font-size:12px">
                Tick one or more room types.
              </div>
            </div>
            <div class="form-group">
              <label>Nights</label>
              <input id="pkg-nights" type="number" min="1" step="1" value="${p.nights ?? ''}">
            </div>
          </div>

          <div class="form-group">
            <label>Extras included in this package</label>
            <div id="pkg-extras-list">
              ${
                extrasHtml ||
                '<div class="muted">No extras defined yet. Create extras first in the Extras tab.</div>'
              }
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

          <div class="form-group">
            <label>Image URL</label>
            <div style="display:flex; gap:8px; align-items:center">
              <input id="pkg-image" type="url" placeholder="https://..." style="flex:1" value="${p.image_url || ''}">
              <input id="pkg-image-file" type="file" accept="image/*" />
            </div>
            <div id="pkg-image-preview" style="margin-top:8px; display:none">
              <img id="pkg-image-preview-img" src="" alt="preview" style="max-width:100%; border-radius:10px"/>
            </div>
            <div id="pkg-image-help" class="muted" style="margin-top:6px">
              Choose an image to upload; the URL will be filled automatically.
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Featured</label>
              <select id="pkg-featured">
                <option value="false" ${p.is_featured ? '' : 'selected'}>No</option>
                <option value="true" ${p.is_featured ? 'selected' : ''}>Yes</option>
              </select>
            </div>
            <div class="form-group">
              <label>Active</label>
              <select id="pkg-active">
                <option value="false" ${p.is_active ? '' : 'selected'}>No</option>
                <option value="true" ${p.is_active ? 'selected' : ''}>Yes</option>
              </select>
            </div>
          </div>
        </div>

        <div class="ft">
          <button class="btn" onclick="document.getElementById('package-modal').remove()">
            Cancel
          </button>
          <button class="btn btn-primary" id="pkg-save-btn">
            ${mode === 'edit' ? 'Save Changes' : 'Create Package'}
          </button>
        </div>
      </div>
    `;
        const pkgExtraQuantities = {};

    (extras || []).forEach((e) => {
      const q =
        selectedExtraQuantities && selectedExtraQuantities[e.id] != null
          ? selectedExtraQuantities[e.id]
          : 0;
      if (q > 0) {
        pkgExtraQuantities[e.id] = q;
      }
    });

    wrap.querySelectorAll('.pkg-extra-inc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = pkgExtraQuantities[id] || 0;
        const next = current + 1;
        pkgExtraQuantities[id] = next;
        const span = wrap.querySelector(`#pkg-extra-qty-${id}`);
        if (span) span.textContent = String(next);
      });
    });

    wrap.querySelectorAll('.pkg-extra-dec').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const current = pkgExtraQuantities[id] || 0;
        const next = current > 0 ? current - 1 : 0;
        pkgExtraQuantities[id] = next;
        const span = wrap.querySelector(`#pkg-extra-qty-${id}`);
        if (span) span.textContent = String(next);
      });
    });

    // ---- image upload wiring (packages) ----
    const fileInput        = wrap.querySelector('#pkg-image-file');
    const imageUrlInput    = wrap.querySelector('#pkg-image');
    const imagePreview     = wrap.querySelector('#pkg-image-preview');
    const imagePreviewImg  = wrap.querySelector('#pkg-image-preview-img');

    // Show preview if an image is already set
    if (p.image_url) {
      imagePreviewImg.src = p.image_url;
      imagePreview.style.display = 'block';
    }

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const code = (wrap.querySelector('#pkg-code')?.value || 'PACKAGE').toString().toUpperCase();
      try {
        const publicUrl = await uploadPackageImage(file, code);
        imageUrlInput.value = publicUrl;
        if (imagePreviewImg) {
          imagePreviewImg.src = publicUrl;
          imagePreview.style.display = 'block';
        }

        // If editing an existing package, persist immediately
        if (mode === 'edit' && id) {
          const { error } = await supabase.from('packages')
            .update({ image_url: publicUrl })
            .eq('id', id);
          if (error) throw error;
          toast('Image uploaded and package updated');
          await initPackages();
        } else {
          // In create mode, the URL will be saved when the user clicks "Create Package"
          toast('Image uploaded — URL filled. Save the package to persist.');
        }
      } catch (err) {
        alert('Upload failed: ' + (err.message || err));
      }
    });

    // Wire save button
    document.getElementById('pkg-save-btn').addEventListener('click', async () => {
      try {
        const payload = collectPackageForm();

        // all selected room checkboxes
        const roomCheckboxes = Array.from(
          wrap.querySelectorAll('.pkg-room-code:checked') || []
        );

        // ---- save package row ----
        let pkgRow = null;

        if (mode === 'edit' && id) {
          const { data, error } = await supabase
            .from('packages')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          pkgRow = data;
          toast('Package updated');
        } else {
          const { data, error } = await supabase
            .from('packages')
            .insert(payload)
            .select()
            .single();
          if (error) throw error;
          pkgRow = data;
          toast('Package created');
        }

        if (pkgRow && pkgRow.id) {
          // ---- upsert packages_rooms (many-to-many rooms) ----
          try {
            await supabase.from('packages_rooms').delete().eq('package_id', pkgRow.id);

            if (roomCheckboxes.length > 0) {
              const roomRows = roomCheckboxes.map((cb) => ({
                package_id: pkgRow.id,
                room_type_id: cb.value,
              }));

              const { error: roomErr } = await supabase
                .from('packages_rooms')
                .insert(roomRows);

              if (roomErr) {
                console.error('Error saving packages_rooms:', roomErr);
              }
            }
          } catch (err) {
            console.warn('packages_rooms update failed (table may not exist yet):', err);
          }

                    // ---- upsert package_extras (many-to-many extras) ----
          try {
            await supabase.from('package_extras').delete().eq('package_id', pkgRow.id);

            const qtyEntries = Object.entries(pkgExtraQuantities || {}).filter(
              ([_, qty]) => qty > 0
            );

            if (qtyEntries.length > 0) {
              const extrasPayload = qtyEntries.map(([id, qty]) => {
                const ex =
                  (extras || []).find((e) => String(e.id) === String(id)) || {};
                return {
                  package_id: pkgRow.id,
                  extra_id: id,
                  quantity: qty,
                  code: ex.code || null,
                };
              });

              const { error: extrasError } = await supabase
                .from('package_extras')
                .insert(extrasPayload);

              if (extrasError) {
                console.error('Error saving package_extras:', extrasError);
              }
            }
          } catch (err) {
            console.warn('package_extras update failed (table may not exist yet):', err);
          }
        }

        wrap.remove();
        initPackages();
      } catch (e) {
        alert(e.message || e);
      }
    });
  })();
}

function collectPackageForm() {
  const root = document.getElementById('package-modal') || document;
  const code = root.querySelector('#pkg-code').value.trim();
  const name = root.querySelector('#pkg-name').value.trim();
  const description = root.querySelector('#pkg-desc').value.trim() || null;

  const priceEl = root.querySelector('#pkg-price').value;
  const package_price = priceEl === '' ? null : parseFloat(priceEl);

  const currency = root.querySelector('#pkg-currency').value;

  const nightsEl = root.querySelector('#pkg-nights').value;
  const nights = nightsEl === '' ? null : Number.parseInt(nightsEl, 10);

  const valid_from = root.querySelector('#pkg-from').value || null;
  const valid_until = root.querySelector('#pkg-until').value || null;
  const image_url = root.querySelector('#pkg-image').value.trim() || null;
  const is_featured = root.querySelector('#pkg-featured').value === 'true';
  const is_active = root.querySelector('#pkg-active').value === 'true';

  if (!code || !name || package_price == null || !currency) {
    throw new Error('Code, Name, Price and Currency are required.');
  }

  if (nights == null || Number.isNaN(nights) || nights <= 0) {
    throw new Error('Nights is required and must be at least 1.');
  }

  return {
    code,
    name,
    description,
    package_price,
    currency,
    nights,
    valid_from,
    valid_until,
    image_url,
    is_featured,
    is_active,
  };
}

// ---------- View Package Details ----------
async function openPackageViewModal(packageId) {
  const wrap = document.createElement('div');
  wrap.id = 'package-view-modal';
  wrap.className = 'modal show';
  wrap.addEventListener('click', () => wrap.remove());
  document.body.appendChild(wrap);

  wrap.innerHTML = `
    <div class="content" onclick="event.stopPropagation()">
      <div class="bd">
        <div class="muted">Loading package…</div>
      </div>
    </div>
  `;

  try {
    // Base package
    const { data: pkg, error } = await supabase
      .from('packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error || !pkg) {
      wrap.innerHTML = `
        <div class="content" onclick="event.stopPropagation()">
          <div class="hd">
            <h3>Package Details</h3>
            <button class="btn" onclick="document.getElementById('package-view-modal').remove()">×</button>
          </div>
          <div class="bd">
            <div class="muted">Error loading package.</div>
          </div>
        </div>
      `;
      return;
    }

    // Rooms
    let roomsHtml = '<div class="muted">No rooms linked.</div>';
    try {
      const { data: pkgRooms } = await supabase
        .from('packages_rooms')
        .select('room_type_id')
        .eq('package_id', packageId);

      const roomIds = (pkgRooms || []).map((r) => r.room_type_id).filter(Boolean);

      if (roomIds.length) {
        const { data: rooms } = await supabase
          .from('room_types')
          .select('id, code, name')
          .in('id', roomIds);

        if (rooms && rooms.length) {
          roomsHtml =
            '<ul class="plain-list" style="padding-left:18px;margin:4px 0;">' +
            rooms
              .map(
                (r) =>
                  `<li>${(r.code || '').toUpperCase()} – ${r.name || ''}</li>`
              )
              .join('') +
            '</ul>';
        }
      }
    } catch (e) {
      console.warn('Error loading package rooms:', e);
    }

    // Extras
    let extrasHtml = '<div class="muted">No extras linked.</div>';
    try {
      const { data: pkgExtras } = await supabase
        .from('package_extras')
        .select('extra_id, quantity, code')
        .eq('package_id', packageId);

      const extraIds = (pkgExtras || []).map((x) => x.extra_id).filter(Boolean);

      if (extraIds.length) {
        const { data: extras } = await supabase
          .from('extras')
          .select('id, name, price, currency')
          .in('id', extraIds);

        if (extras && extras.length) {
          const extrasById = new Map(extras.map((e) => [e.id, e]));
          extrasHtml =
            '<ul class="plain-list" style="padding-left:18px;margin:4px 0;">' +
            (pkgExtras || [])
              .map((px) => {
                const ex = extrasById.get(px.extra_id);
                const qty = px.quantity ?? 1;
                const code = px.code || ex?.code || '';
                const name = ex?.name || code || 'Extra';
                const priceText =
                  ex && ex.price != null
                    ? ` – ${formatCurrency(
                        ex.price,
                        ex.currency || pkg.currency || 'GHS'
                      )}`
                    : '';
                return `<li>${qty} × ${name}${priceText}</li>`;
              })
              .join('') +
            '</ul>';
        }
      }
    } catch (e) {
      console.warn('Error loading package extras:', e);
    }

    const isActive = pkg.is_active !== false;
    const isFeatured = !!pkg.is_featured;

    const validity =
      pkg.valid_from || pkg.valid_until
        ? `${pkg.valid_from || '—'} → ${pkg.valid_until || '—'}`
        : 'N/A';

    wrap.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3>Package: ${pkg.name || ''}</h3>
          <button class="btn" onclick="document.getElementById('package-view-modal').remove()">×</button>
        </div>
        <div class="bd">
          ${
            pkg.image_url
              ? `<img src="${pkg.image_url}" alt="${pkg.name || ''}" style="max-width:100%;border-radius:12px;margin-bottom:12px;">`
              : ''
          }
          <p><strong>Code:</strong> ${(pkg.code || '').toUpperCase()}</p>
          <p><strong>Description:</strong> ${pkg.description || 'N/A'}</p>
          <p><strong>Price:</strong> ${formatCurrency(
            pkg.package_price || 0,
            pkg.currency || 'GHS'
          )}</p>
          <p><strong>Nights:</strong> ${pkg.nights || 'N/A'}</p>
          <p><strong>Validity:</strong> ${validity}</p>
          <p><strong>Status:</strong>
            <span class="badge ${isActive ? 'ok' : 'err'}">
              ${isActive ? 'Active' : 'Inactive'}
            </span>
            ${
              isFeatured
                ? '<span class="badge ok" style="margin-left:6px;">Featured</span>'
                : ''
            }
          </p>

          <hr style="margin:12px 0;opacity:0.2;">

          <h4 style="margin-bottom:4px;">Rooms</h4>
          ${roomsHtml}

          <h4 style="margin:12px 0 4px;">Extras</h4>
          ${extrasHtml}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error in openPackageViewModal:', err);
  }
}

// ---------- Toggle & delete ----------
async function togglePackageStatus(id, newStatus) {
  try {
    const { error } = await supabase
      .from('packages')
      .update({ is_active: newStatus })
      .eq('id', id);
    if (error) throw error;
    toast(newStatus ? 'Package activated' : 'Package deactivated');
    initPackages();
  } catch (e) {
    alert('Error updating: ' + (e.message || e));
  }
}

async function deletePackage(id) {
  if (!confirm('Delete this package? This cannot be undone.')) return;
  try {
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) {
      // Check if it's a foreign key constraint error
      if (error.message && error.message.includes('reservations_package_id_fkey')) {
        alert('Cannot delete this package because it has existing reservations. Please delete or update those reservations first, or deactivate the package instead.');
        return;
      }
      throw error;
    }
    toast('Package deleted');
    initPackages();
  } catch (e) {
    alert('Error deleting: ' + (e.message || e));
  }
}

export { initPackages };