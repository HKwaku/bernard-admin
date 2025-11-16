// src/packages.js
// Package management (list, add/edit, activate/deactivate, delete)

import { supabase } from './config/supabase.js';
import { $, formatCurrency, toast } from './utils/helpers.js';

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
              <input id="pkg-currency" type="text" value="${p.currency || "GHS"}">
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
          <button class="btn btn-primary" id="pkg-save-btn">${mode === "edit" ? "Save Changes" : "Create Package"}</button>
        </div>
      </div>
    `;

    // Wire save button
    document.getElementById("pkg-save-btn").addEventListener("click", async () => {
      try {
        const payload = collectPackageForm();
        if (mode === "edit" && id) {
          const { error } = await supabase.from("packages").update(payload).eq("id", id);
          if (error) throw error;
          toast("Package updated");
        } else {
          const { error } = await supabase.from("packages").insert(payload);
          if (error) throw error;
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

export { initPackages };
