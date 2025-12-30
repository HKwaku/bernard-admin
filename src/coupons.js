// src/coupons.js
// Coupon management (list, add, edit, toggle, delete)

import { supabase } from './config/supabase.js';
import { formatDate } from './utils/helpers.js';

// --- tiny DOM helpers local to this module ---
function $$sel(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}
function $sel(selector, root = document) {
  return root.querySelector(selector);
}
function coupons_nowISO() {
  return new Date().toISOString();
}

// Global map of extra_id -> extra name for coupon labels in the list
let extrasNameMap = {};

/* =========================
   Public entry point
   ========================= */

export async function initCoupons() {
  const panel = $sel('#view-coupons');
  if (!panel) return;

  panel.innerHTML = `
    <div class="card-bd">
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <button class="btn" id="coupon-add-btn">+ Add Coupon</button>
      </div>
      <div id="coupons-list" class="list">
        <div class="muted">Loading…</div>
      </div>
    </div>
  `;

  $sel('#coupon-add-btn')?.addEventListener('click', () => coupons_openForm());

  await coupons_renderList();
}

/* =========================
   List view + actions
   ========================= */

async function coupons_renderList() {
  const r = $sel('#coupons-list');
  if (!r) return;

  r.innerHTML = '<div class="muted" style="padding:12px">Loading…</div>';

  try {
    const { data, error } = await supabase
      .from('coupons')
      .select(
        'id,code,description,discount_type,discount_value,applies_to,extra_ids,valid_from,valid_until,max_uses,current_uses,max_uses_per_guest,min_booking_amount,is_active,created_at,updated_at'
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = data ?? [];
    if (!rows.length) {
      r.innerHTML = '<div class="muted" style="padding:20px">No coupons found.</div>';
      return;
    }

    // Build a map of extra_id -> extra_name so we can show friendly labels
    extrasNameMap = {};
    try {
      const { data: extrasData } = await supabase
        .from('extras')
        .select('id,name')
        .eq('is_active', true);

      extrasNameMap = Object.fromEntries(
        (extrasData || []).map((e) => [String(e.id), e.name])
      );
    } catch (e) {
      console.warn('Could not load extras for coupon labels', e);
      extrasNameMap = {};
    }

    r.innerHTML = rows
      .map((c) => {
        const discountLabel =
          c.discount_type === 'percentage'
            ? `${c.discount_value}%`
            : `GHS${c.discount_value}`;

        const appliesScopeLabel = (() => {
          const applies = (c.applies_to || '').toLowerCase();

          const getNames = () =>
            Array.isArray(c.extra_ids)
              ? c.extra_ids
                  .map((id) => extrasNameMap[String(id)])
                  .filter(Boolean)
              : [];

          if (applies === 'both') {
            const labels = getNames();

            if (labels.length === 0) return 'Room and Extras';
            if (labels.length === 1) return `Room and ${labels[0]}`;
            if (labels.length === 2) return `Room and ${labels[0]} and ${labels[1]}`;
            return `Room and ${labels.slice(0, 2).join(', ')} and others`;
          }

          if (applies === 'rooms') return 'Room Only';

          if (applies === 'extras') {
            const labels = getNames();
            if (!labels.length) return 'Extras';
            if (labels.length === 1) return labels[0];
            if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
            return `${labels.slice(0, 2).join(', ')} and others`;
          }

          return c.applies_to || '';
        })();

        const isActive = c.is_active;

        return `
          <div class="item coupon-card" data-id="${c.id}">
            <div class="row">
              <div style="flex:1">
                <div class="title">${(c.code || '').toUpperCase()}</div>
                <div class="meta">
                  <strong style="color:#0f172a">${discountLabel} off</strong> · ${appliesScopeLabel}
                </div>
                ${
                  c.description
                    ? `<div class="meta" style="margin-top:6px;color:#6b7280">${c.description}</div>`
                    : ''
                }
                <div class="meta" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:16px">
                  <span>
                    Used <strong style="color:#0f172a">${c.current_uses ?? 0}${
          c.max_uses ? `/${c.max_uses}` : ''
        }</strong>
                  </span>
                  ${
                    c.max_uses_per_guest
                      ? `<span>Max <strong style="color:#0f172a">${c.max_uses_per_guest}</strong>/guest</span>`
                      : ''
                  }
                  ${
                    c.min_booking_amount
                      ? `<span>Min <strong style="color:#0f172a">£${c.min_booking_amount}</strong></span>`
                      : ''
                  }
                  ${
                    c.valid_from || c.valid_until
                      ? `<span>${
                          c.valid_from
                            ? formatDate(c.valid_from)
                            : '∞'
                        } → ${
                          c.valid_until
                            ? formatDate(c.valid_until)
                            : '∞'
                        }</span>`
                      : ''
                  }
                </div>
              </div>
              <div style="text-align:right">
                <span class="badge ${isActive ? 'ok' : 'err'}">
                  ${isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div class="room-card-footer">
              <button class="btn btn-sm" data-action="edit" data-id="${c.id}">Edit</button>
              <button class="btn btn-sm" data-action="toggle" data-id="${c.id}" data-active="${isActive}">
                ${isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn btn-sm" data-action="delete" data-id="${c.id}" style="color:#b91c1c">
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    // wire row actions
    $$sel('button[data-action="edit"]', r).forEach((btn) =>
      btn.addEventListener('click', () => coupons_openForm(btn.dataset.id))
    );
    $$sel('button[data-action="toggle"]', r).forEach((btn) =>
      btn.addEventListener('click', () =>
        coupons_toggleStatus(btn.dataset.id, btn.dataset.active === 'true')
      )
    );
    $$sel('button[data-action="delete"]', r).forEach((btn) =>
      btn.addEventListener('click', () => coupons_delete(btn.dataset.id))
    );
  } catch (e) {
    console.error(e);
    r.innerHTML = `<div style="color:#b91c1c">Error: ${e.message || e}</div>`;
  }
}

// Toggle status (activate/deactivate)
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

// Delete coupon
async function coupons_delete(id) {
  if (!id) return;
  if (
    !confirm(
      'Are you sure you want to delete this coupon? This action cannot be undone.'
    )
  )
    return;

  try {
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) throw error;
    await coupons_renderList();
  } catch (e) {
    alert('Failed to delete: ' + (e.message || e));
  }
}

/* =========================
   Modal form (add / edit)
   ========================= */

async function coupons_openForm(id /* optional */) {
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.id = 'coupon-modal';

  // --- fetch active extras so coupon can target them ---
  let extrasList = [];
  try {
    const { data } = await supabase
      .from('extras')
      .select('id,name,price,currency,is_active')
      .eq('is_active', true)
      .order('name', { ascending: true });

    extrasList = data || [];
  } catch (e) {
    console.warn('Error loading extras for coupon modal:', e);
  }

  const extrasHtml = extrasList.length
    ? extrasList
        .map((ex) => {
          const price = ex.price != null ? ex.price : 0;
          const cur = ex.currency || 'GHS';
          return `
            <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem">
              <input
                type="checkbox"
                name="c-extra-target"
                id="c-extra-${ex.id}"
                value="${ex.id}"
                style="width:auto"
              />
              <span>${ex.name || ''} <span style="color:#6b7280">(${cur} ${price})</span></span>
            </label>
          `;
        })
        .join('')
    : `<div class="muted">No active extras available to target.</div>`;

  // Inline styles for the coupon modal (added once)
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

        <div class="form-group">
          <label>Limit coupon to specific extras (optional)</label>
          <div id="c-extra-list" style="border:1px solid #e5e7eb;border-radius:10px;padding:10px;max-height:160px;overflow-y:auto;display:grid;gap:4px">
            ${extrasHtml}
          </div>
          <div class="muted" style="margin-top:4px;font-size:0.8rem">
            If none are selected, the coupon will apply to all eligible extras (when "Applies To" includes extras).
          </div>
        </div>
      </div>
      <div class="ft">
        <button class="btn" id="coupon-cancel">Cancel</button>
        <button class="btn btn-primary" id="coupon-save">${id ? 'Update' : 'Create'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  $sel('#coupon-close', modal).addEventListener('click', close);
  $sel('#coupon-cancel', modal).addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  if (id) {
    coupons_fillForm(id).catch((err) => {
      $sel('#coupon-error').textContent =
        'Error loading coupon: ' + (err.message || err);
    });
  }

  $sel('#coupon-save', modal).addEventListener('click', async () => {
    try {
      const payload = coupons_collectForm();
      let result;
      if (id) {
        result = await supabase
          .from('coupons')
          .update({ ...payload, updated_at: coupons_nowISO() })
          .eq('id', id);
      } else {
        result = await supabase.from('coupons').insert({
          ...payload,
          created_at: coupons_nowISO(),
          updated_at: coupons_nowISO(),
          current_uses: 0,
        });
      }
      if (result.error) throw result.error;
      close();
      await coupons_renderList();
    } catch (e) {
      $sel('#coupon-error').textContent =
        'Error saving: ' + (e.message || e);
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
  const max_uses = $sel('#c-max').value
    ? parseInt($sel('#c-max').value, 10)
    : null;
  const max_uses_per_guest = $sel('#c-max-guest').value
    ? parseInt($sel('#c-max-guest').value, 10)
    : null;
  const min_booking_amount = $sel('#c-min').value
    ? parseFloat($sel('#c-min').value)
    : null;

  const extra_ids = $$sel('input[name="c-extra-target"]:checked').map(
    (cb) => cb.value
  );

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
    min_booking_amount,
    extra_ids: extra_ids.length ? extra_ids : null,
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

  if (Array.isArray(c.extra_ids) && c.extra_ids.length) {
    c.extra_ids.forEach((eid) => {
      const cb = document.querySelector(`#c-extra-${eid}`);
      if (cb) cb.checked = true;
    });
  }
}