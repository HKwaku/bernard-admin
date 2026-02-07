// src/pricing-model/pricing-configuration.js  
// UPDATED VERSION - Dec 28 2024 - Dynamic Lead Windows
console.log('✅ Pricing Configuration v2.2 loaded - Lead windows implemented');
// Configuration Tab - Completely Self-Contained with Full CRUD

import { supabase } from '../config/supabase';
import * as XLSX from 'xlsx';
import { openSharedModal, closeModal } from './pricing_model';


// Shared toggle function for all collapsible sections
function initializeToggles() {
  // Remove existing listeners by cloning (prevents duplicate listeners)
  document.querySelectorAll('[data-toggle]').forEach(element => {
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);
  });
  
  // Add fresh listeners
  document.querySelectorAll('[data-toggle]').forEach(element => {
    element.addEventListener('click', (e) => {
      // Don't toggle if clicking on a button inside the header
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        return;
      }
      
      const targetId = element.getAttribute('data-toggle');
      const content = document.getElementById(targetId);
      const icon = element.querySelector('.toggle-icon');
      
      if (content && icon) {
        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.textContent = '▼';
        } else {
          content.style.display = 'none';
          icon.textContent = '▶';
        }
      }
    });
  });
}

// Add mobile-responsive styles
const mobileStyles = `
<style>
  /* Global overflow prevention */
  * {
    box-sizing: border-box;
  }
  
  body, html {
    overflow-x: hidden;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  
  /* Prevent any element from causing horizontal scroll */
  .analytics-section,
  .chart-card,
  .revenue-table-wrapper,
  div[style*="display:flex"],
  div[style*="grid"] {
    max-width: 100%;
  }
  
  @media (max-width: 768px) {
    /* Force everything to fit */
    body, html {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }
    
    #app, #root, .container {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }
    
    /* Prevent EVERY div from overflowing */
    div {
      max-width: 100% !important;
    }
    
    /* But allow table wrappers to scroll internally */
    .revenue-table-wrapper {
      max-width: 100% !important;
      overflow-x: auto !important;
    }
    
    /* Stacking and layout */
    .mobile-stack {
      flex-direction: column !important;
      align-items: stretch !important;
    }
    
    .mobile-full-btn {
      width: 100% !important;
      margin-bottom: 8px !important;
    }
    
    /* Tables - horizontal scroll */
    .revenue-table-wrapper {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
      max-width: 100% !important;
      margin: 0 !important;
      display: block !important;
    }
    
    .revenue-table-wrapper {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
      max-width: 100% !important;
      width: 100% !important;
      display: block !important;
    }
    
    /* Make scrollbar always visible when needed */
    .revenue-table-wrapper::-webkit-scrollbar {
      height: 8px !important;
      -webkit-appearance: none;
    }
    
    .revenue-table-wrapper::-webkit-scrollbar-thumb {
      background: #cbd5e1 !important;
      border-radius: 4px !important;
    }
    
    .revenue-table-wrapper::-webkit-scrollbar-track {
      background: #f1f5f9 !important;
    }

    /* Let tables inside wrappers be wider than viewport to force scroll */
    .revenue-table-wrapper table {
      width: max-content !important;
      /* DO NOT override min-width - let HTML inline styles work */
    }

    .revenue-table-wrapper th,
    .revenue-table-wrapper td {
      padding: 8px 12px !important;
      white-space: nowrap;
    }
    #pm-configuration-root,
    #pm-configuration-root * {
      max-width: 100% !important;
    }

    #pm-configuration-root {
      overflow-x: hidden !important;
    }

    
    /* Sections and cards */
    .analytics-section {
      padding-left: 12px !important;
      padding-right: 12px !important;
      border-left-width: 2px !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
    
    .chart-card {
      padding: 0 !important;
      margin: 0 0 16px 0 !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
    
    /* CRITICAL: All collapsible content areas */
    .room-group-content,
    #tier-templates-content,
    #month-rules-content {
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
    
    .analytics-section-title {
      font-size: 18px !important;
      padding-right: 12px !important;
    }
    
    /* Pricing header */
    .pricing-header {
      padding: 16px !important;
      flex-direction: column !important;
      max-width: 100% !important;
    }
    
    .pricing-header > div {
      width: 100% !important;
      max-width: 100% !important;
    }
    
    /* Chart controls */
    .chart-controls {
      width: 100% !important;
      display: flex !important;
      max-width: 100% !important;
    }
    
    .chart-btn {
      flex: 1 !important;
      font-size: 11px !important;
      padding: 8px 6px !important;
      white-space: nowrap !important;
    }
    
    /* Form grids */
    .form-grid,
    .form-grid-3 {
      grid-template-columns: 1fr !important;
    }
    
    /* Collapsible headers - make mobile friendly */
    .room-group-header,
    [data-toggle] {
      padding: 12px !important;
      flex-wrap: wrap !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }
    
    .room-group-header > div:first-child,
    [data-toggle] > div:first-child {
      flex-wrap: wrap !important;
      gap: 8px !important;
      max-width: 100% !important;
    }
    
    /* Buttons in collapsible headers */
    .room-group-header button,
    [data-toggle] button {
      width: 100% !important;
      margin-top: 8px !important;
    }
    
    /* Toggle icons */
    .toggle-icon {
      font-size: 16px !important;
      flex-shrink: 0 !important;
    }
    
    /* Table cells - tighter padding on mobile */
    table td,
    table th {
      padding: 8px 12px !important;
      font-size: 13px !important;
    }
    
    /* Excel upload section */
    .chart-card > div {
      padding: 16px !important;
      max-width: 100% !important;
    }
    
    /* Lead window legend */
    .chart-card [style*="gap:12px"] {
      gap: 8px !important;
    }
    
    /* Text that might overflow */
    h1, h2, h3, h4, h5, h6,
    p, span, div {
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    
    /* Flex containers */
    [style*="display:flex"] {
      flex-wrap: wrap !important;
    }
    
    /* Prevent iOS zoom */
    input[type="number"],
    input[type="text"],
    input[type="date"],
    select {
      font-size: 16px !important;
      max-width: 100% !important;
    }
      /* Mobile modal fixes: prevent distorted layouts + ensure Save/Cancel always visible */
    .modal-overlay { align-items: flex-start !important; padding: 12px !important; }
    .modal { max-width: 100% !important; max-height: 92vh !important; }
    .modal .inner { width: 100% !important; max-width: 100% !important; }
    .modal .bd { overflow-y: auto !important; -webkit-overflow-scrolling: touch; }

    /* Sticky footer so Save/Cancel never disappear off-screen */
    .modal .ft {
      position: sticky !important;
      bottom: 0 !important;
      background: #fff !important;
      z-index: 3 !important;
      box-shadow: 0 -8px 16px rgba(0,0,0,0.06);
    }

    /* Critical: allow inputs/grids to shrink instead of pushing layout sideways */
    .modal input, .modal select, .modal textarea {
      width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }
    .modal .form-grid > * { min-width: 0 !important; }

  }
  
  @media (max-width: 480px) {
    .analytics-section-title {
      font-size: 16px !important;
    }
    
    .chart-card {
      padding: 0 !important;
      margin: 0 0 12px 0 !important;
    }
    
    .analytics-section {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    
    /* Even tighter on very small screens */
    table td,
    table th {
      padding: 6px 8px !important;
      font-size: 12px !important;
    }
    
    /* Smaller buttons */
    .btn-sm {
      padding: 4px 8px !important;
      font-size: 11px !important;
    }
    
    /* Compact headers */
    h3 {
      font-size: 14px !important;
    }
    
    /* Collapsible headers - even more compact */
    .room-group-header,
    [data-toggle] {
      padding: 8px !important;
    }
    
    /* Hide less critical badges on very small screens */
    [style*="padding:2px 8px"] {
      font-size: 10px !important;
      padding: 2px 6px !important;
    }
  }
    
    .chart-btn {
      font-size: 10px !important;
      padding: 6px 4px !important;
    }
    
    .revenue-table-wrapper table {
      font-size: 12px !important;
    }
  }
</style>
`;

// ===== HELPER FUNCTIONS =====
const el = (id) => document.getElementById(id);

// ===== MAIN EXPORT FUNCTION =====
export function initConfigurationTab(container, { activeModelId, pricingModels, roomTypes, onDataChange }) {
  if (!container) return;
  
  // Ensure viewport meta tag exists
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
  }
  
  // Inject mobile styles
  if (!document.getElementById('pricing-config-mobile-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'pricing-config-mobile-styles';
    styleEl.textContent = mobileStyles.replace(/<\/?style>/g, '');
    document.head.appendChild(styleEl);
  }
  
  container.innerHTML = `
    <div class="analytics-section" style="margin-top:0;border-left:4px solid #667eea;padding-left:20px">
      <h2 class="analytics-section-title" style="color:#667eea">⚙️ Model Management</h2>
      <div id="pm-pricing-models"></div>
    </div>
    
    <div class="analytics-section" style="border-left:4px solid #3b82f6;padding-left:20px">
      <h2 class="analytics-section-title" style="color:#3b82f6">📊 Pricing Rules & Tiers</h2>
      <div id="pm-tier-templates" style="margin-bottom:24px"></div>
      <div id="pm-month-rules"></div>
    </div>
    
    <div class="analytics-section" style="border-left:4px solid #10b981;padding-left:20px">
      <h2 class="analytics-section-title" style="color:#10b981">🎯 Targets & Dynamic Adjustments</h2>
      <div id="pm-targets" style="margin-bottom:24px"></div>
      <div id="pm-pace"></div>
    </div>
    
    <div class="analytics-section" style="border-bottom:none;border-left:4px solid #f59e0b;padding-left:20px">
      <h2 class="analytics-section-title" style="color:#f59e0b">🔧 Manual Overrides</h2>
      <div id="pm-overrides"></div>
    </div>
  `;
  
  // Render all sections
  renderPricingModels(pricingModels, activeModelId, onDataChange);
  
  if (activeModelId) {
    renderTierTemplates(activeModelId);
    renderMonthRules(activeModelId);
    renderTargets(activeModelId, roomTypes);
    renderPaceCurves(activeModelId, roomTypes);
    renderOverrides(activeModelId, roomTypes);
  }
}

// ===== PRICING MODELS SECTION =====
async function renderPricingModels(models, activeModelId, onDataChange) {
  const host = el('pm-pricing-models');
  if (!host) return;
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:12px" class="mobile-stack">
        <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Pricing Models</h3>
        <button class="btn btn-primary mobile-full-btn" id="add-model-btn">+ Add Model</button>
      </div>
      <div class="revenue-table-wrapper" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:12px;text-align:left">Name</th>
            <th style="padding:12px;text-align:left">Active</th>
            <th style="padding:12px;text-align:left">Effective From</th>
            <th style="padding:12px;text-align:left">Effective Until</th>
            <th style="padding:12px;text-align:left">History Mode</th>
            <th style="padding:12px;text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${models.map(m => `
            <tr style="border-bottom:1px solid #f1f5f9">
              <td style="padding:12px">${m.name}</td>
              <td style="padding:12px">${m.is_active ? 'Yes' : 'No'}</td>
              <td style="padding:12px">${m.effective_from || '—'}</td>
              <td style="padding:12px">${m.effective_until || '—'}</td>
              <td style="padding:12px">${m.history_mode || '—'}</td>
              <td style="padding:12px;text-align:right">
                <button class="btn btn-sm" data-edit-model="${m.id}">Edit</button>
                <button class="btn btn-sm" style="background:#10b981;color:white" data-copy-model="${m.id}">Copy Config</button>
                <button class="btn btn-sm" data-delete-model="${m.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
  
  el('add-model-btn')?.addEventListener('click', () => openModelModal(null, onDataChange));
  
  models.forEach(m => {
    document.querySelector(`[data-edit-model="${m.id}"]`)?.addEventListener('click', () => openModelModal(m, onDataChange));
    document.querySelector(`[data-copy-model="${m.id}"]`)?.addEventListener('click', () => openCopyConfigModal(m, models, onDataChange));
    document.querySelector(`[data-delete-model="${m.id}"]`)?.addEventListener('click', async () => {
      if (confirm(`Delete pricing model "${m.name}"?`)) {
        await deleteRecord('pricing_models', m.id);
        onDataChange();
      }
    });
  });
}

function openModelModal(model, onDataChange) {
  const isEdit = !!model;
  
  // Remove any existing modal
  openSharedModal({
    id: 'model-modal',
    title: `${isEdit ? 'Edit' : 'New'} Pricing Model`,
    subtitle: 'Configure pricing model settings and behavior',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Name *</label>
            <input id="model-name" value="${model?.name || ''}" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="model-active" ${model?.is_active ? 'checked' : ''} style="width:auto;" />
              <span>Is Active</span>
            </label>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Effective From</label>
            <input id="model-from" type="date" value="${model?.effective_from || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Effective Until</label>
            <input id="model-until" type="date" value="${model?.effective_until || ''}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">History Mode</label>
            <select id="model-history" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'">
              <option value="base_prices" ${model?.history_mode === 'base_prices' ? 'selected' : '' }>Base Prices</option>
              <option value="base_only" ${model?.history_mode === 'base_only' ? 'selected' : '' }>Base Prices Only</option>
              <option value="last_year_same_month" ${model?.history_mode === 'last_year_same_month' ? 'selected' : ''}>Last Year Same Month</option>
              <option value="trailing_3yr_avg" ${model?.history_mode === 'trailing_3yr_avg' ? 'selected' : ''}>Trailing 3-Year Average</option>
            </select>
          </div>
        </div>
        <div id="model-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('model-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;">Cancel</button>
        <button class="btn cta" id="model-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  el('model-save')?.addEventListener('click', async () => {
    try {
      const data = {
        name: el('model-name').value.trim(),
        is_active: el('model-active').checked,
        effective_from: el('model-from').value || null,
        effective_until: el('model-until').value || null,
        history_mode: el('model-history').value
      };
      
      if (!data.name) throw new Error('Name is required');
      
      // If marking this model as active, deactivate all other models first
      if (data.is_active) {
        const { error: deactivateError } = await supabase
          .from('pricing_models')
          .update({ is_active: false })
          .neq('id', model?.id || 0); // Don't deactivate current model if editing
        
        if (deactivateError) throw deactivateError;
      }
      
      if (isEdit) {
        const { error } = await supabase.from('pricing_models').update(data).eq('id', model.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pricing_models').insert(data);
        if (error) throw error;
      }
      
      wrap.remove();
      onDataChange();
    } catch (e) {
      showError('model-error', e);
    }
  });
    }
  });
}

// ===== COPY CONFIG MODAL =====
function openCopyConfigModal(sourceModel, allModels, onDataChange) {
  const targetModels = allModels.filter(m => m.id !== sourceModel.id);
  
  if (targetModels.length === 0) {
    alert('No other pricing models available to copy to. Please create another model first.');
    return;
  }
  
  const modelOptions = targetModels.map(m => 
    `<option value="${m.id}">${m.name} (${m.history_mode || 'unknown'})</option>`
  ).join('');
  
  openSharedModal({
    id: 'copy-config-modal',
    title: `📋 Copy Configuration from "${sourceModel.name}"`,
    subtitle: 'Select target model and which sections to copy',
    bodyHtml: `
      <div style="display:grid;gap:20px">
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:8px">
          <div style="font-weight:600;color:#166534;margin-bottom:8px">📤 Source Model</div>
          <div style="color:#15803d">${sourceModel.name}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px">History Mode: ${sourceModel.history_mode || 'N/A'}</div>
        </div>
        
        <div class="form-group">
          <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">📥 Target Model *</label>
          <select id="copy-target-model" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px">
            <option value="">Select target model...</option>
            ${modelOptions}
          </select>
          <small style="display:block;margin-top:4px;color:#64748b;font-size:12px">
            All selected configurations will be copied to this model
          </small>
        </div>
        
        <div style="background:#fafbfc;border-radius:8px;padding:16px">
          <div style="font-weight:600;color:#0f172a;margin-bottom:12px">Select Sections to Copy:</div>
          <div style="display:grid;gap:12px">
            <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" id="copy-tiers" checked style="width:auto;" />
              <span><b>Tier Templates</b> - Historical occupancy tiers and multipliers</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" id="copy-month-rules" checked style="width:auto;" />
              <span><b>Month Rules</b> - Min/max multipliers and tier strength per month</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" id="copy-targets" checked style="width:auto;" />
              <span><b>Monthly Targets</b> - Target occupancy and revenue per month</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
              <input type="checkbox" id="copy-pace" checked style="width:auto;" />
              <span><b>Pace Curves</b> - Expected OTB and sensitivities by lead window</span>
            </label>
          </div>
        </div>
        
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:8px">
          <div style="font-weight:600;color:#92400e;margin-bottom:4px">⚠️ Warning</div>
          <div style="font-size:13px;color:#78350f">
            This will DELETE existing configurations in the target model for selected sections and replace them with copies from the source model.
          </div>
        </div>
        
        <div id="copy-error" style="color:#dc2626;font-size:13px;display:none"></div>
        
        <div style="display:flex;justify-content:flex-end;gap:12px;padding-top:16px;border-top:2px solid #e5e7eb">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-wrapper').remove()">Cancel</button>
          <button type="button" id="save-copy-config-btn" class="btn btn-primary" style="background:#3b82f6">Copy Configuration</button>
        </div>
      </div>
    `
  });
  
  // Manually attach save button listener after modal is created
  setTimeout(() => {
    el('save-copy-config-btn')?.addEventListener('click', async () => {
      try {
        const targetModelId = el('copy-target-model').value;
        if (!targetModelId) {
          throw new Error('Please select a target model');
        }
        
        const copyTiers = el('copy-tiers').checked;
        const copyMonthRules = el('copy-month-rules').checked;
        const copyTargets = el('copy-targets').checked;
        const copyPace = el('copy-pace').checked;
        
        if (!copyTiers && !copyMonthRules && !copyTargets && !copyPace) {
          throw new Error('Please select at least one section to copy');
        }
        
        let copiedCount = 0;
        
        // Copy Tier Templates
        if (copyTiers) {
          const { data: tiers } = await supabase
            .from('pricing_tier_templates')
            .select('*')
            .eq('pricing_model_id', sourceModel.id);
          
          if (tiers && tiers.length > 0) {
            // Delete existing
            await supabase
              .from('pricing_tier_templates')
              .delete()
              .eq('pricing_model_id', targetModelId);
            
            // Insert copies
            const copies = tiers.map(t => ({
              pricing_model_id: targetModelId,
              tier_name: t.tier_name,
              min_hist_occupancy: t.min_hist_occupancy,
              max_hist_occupancy: t.max_hist_occupancy,
              multiplier: t.multiplier,
              priority: t.priority,
              is_active: t.is_active
            }));
            await supabase.from('pricing_tier_templates').insert(copies);
            copiedCount += copies.length;
          }
        }
        
        // Copy Month Rules
        if (copyMonthRules) {
          const { data: rules } = await supabase
            .from('pricing_model_month_rules')
            .select('*')
            .eq('pricing_model_id', sourceModel.id);
          
          if (rules && rules.length > 0) {
            await supabase
              .from('pricing_model_month_rules')
              .delete()
              .eq('pricing_model_id', targetModelId);
            
            const copies = rules.map(r => ({
              pricing_model_id: targetModelId,
              month: r.month,
              tier_strength: r.tier_strength,
              min_multiplier: r.min_multiplier,
              max_multiplier: r.max_multiplier
            }));
            await supabase.from('pricing_model_month_rules').insert(copies);
            copiedCount += copies.length;
          }
        }
        
        // Copy Targets
        if (copyTargets) {
          const { data: targets } = await supabase
            .from('pricing_targets')
            .select('*')
            .eq('pricing_model_id', sourceModel.id);
          
          if (targets && targets.length > 0) {
            await supabase
              .from('pricing_targets')
              .delete()
              .eq('pricing_model_id', targetModelId);
            
            const copies = targets.map(t => ({
              pricing_model_id: targetModelId,
              room_type_id: t.room_type_id,
              month: t.month,
              target_occupancy: t.target_occupancy,
              target_revpan: t.target_revpan,
              sensitivity_up: t.sensitivity_up,
              sensitivity_down: t.sensitivity_down,
              is_active: t.is_active
            }));
            await supabase.from('pricing_targets').insert(copies);
            copiedCount += copies.length;
          }
        }
        
        // Copy Pace Curves
        if (copyPace) {
          const { data: curves } = await supabase
            .from('pricing_pace_curves')
            .select('*')
            .eq('pricing_model_id', sourceModel.id);
          
          if (curves && curves.length > 0) {
            await supabase
              .from('pricing_pace_curves')
              .delete()
              .eq('pricing_model_id', targetModelId);
            
            const copies = curves.map(c => ({
              pricing_model_id: targetModelId,
              room_type_id: c.room_type_id,
              month: c.month,
              lead_window: c.lead_window,
              expected_otb_occ: c.expected_otb_occ,
              pace_sensitivity_up: c.pace_sensitivity_up,
              pace_sensitivity_down: c.pace_sensitivity_down,
              is_active: c.is_active
            }));
            await supabase.from('pricing_pace_curves').insert(copies);
            copiedCount += copies.length;
          }
        }
        
        // Close modal
        closeModal();
        
        alert(`✅ Successfully copied ${copiedCount} configuration items!`);
        onDataChange();
      } catch (e) {
        showError('copy-error', e);
      }
    });
  }, 100);
}

// ===== SECTION-LEVEL COPY MODAL =====
async function openSectionCopyModal(sectionType, currentModelId, onComplete) {
  // Get all models
  const { data: models } = await supabase
    .from('pricing_models')
    .select('id, name, history_mode')
    .order('created_at', { ascending: false });
  
  const sourceModels = models.filter(m => m.id !== currentModelId);
  
  if (sourceModels.length === 0) {
    alert('No other pricing models available to copy from. Please create another model first.');
    return;
  }
  
  const modelOptions = sourceModels.map(m => 
    `<option value="${m.id}">${m.name} (${m.history_mode || 'unknown'})</option>`
  ).join('');
  
  const sectionInfo = {
    tiers: {
      title: 'Tier Templates',
      description: 'Historical occupancy tiers and multipliers',
      table: 'pricing_tier_templates',
      fields: ['tier_name', 'min_hist_occupancy', 'max_hist_occupancy', 'multiplier', 'priority', 'is_active']
    },
    'month-rules': {
      title: 'Month Rules',
      description: 'Min/max multipliers and tier strength per month',
      table: 'pricing_model_month_rules',
      fields: ['month', 'tier_strength', 'min_multiplier', 'max_multiplier']
    },
    targets: {
      title: 'Monthly Targets',
      description: 'Target occupancy and revenue per month',
      table: 'pricing_targets',
      fields: ['room_type_id', 'month', 'target_occupancy', 'target_revpan', 'sensitivity_up', 'sensitivity_down', 'is_active']
    },
    pace: {
      title: 'Pace Curves',
      description: 'Expected OTB and sensitivities by lead window',
      table: 'pricing_pace_curves',
      fields: ['room_type_id', 'month', 'lead_window', 'expected_otb_occ', 'pace_sensitivity_up', 'pace_sensitivity_down', 'is_active']
    }
  };
  
  const section = sectionInfo[sectionType];
  
  openSharedModal({
    id: 'section-copy-modal',
    title: `📋 Copy ${section.title}`,
    subtitle: section.description,
    bodyHtml: `
      <div style="display:grid;gap:20px">
        <div class="form-group">
          <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">📤 Copy From Model *</label>
          <select id="copy-source-model" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px">
            <option value="">Select source model...</option>
            ${modelOptions}
          </select>
          <small style="display:block;margin-top:4px;color:#64748b;font-size:12px">
            ${section.title} will be copied FROM this model TO the current model
          </small>
        </div>
        
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:8px">
          <div style="font-weight:600;color:#92400e;margin-bottom:4px">⚠️ Warning</div>
          <div style="font-size:13px;color:#78350f">
            This will DELETE all existing ${section.title.toLowerCase()} in the current model and replace them with copies from the source model.
          </div>
        </div>
        
        <div id="section-copy-error" style="color:#dc2626;font-size:13px;display:none"></div>
        
        <div style="display:flex;justify-content:flex-end;gap:12px;padding-top:16px;border-top:2px solid #e5e7eb">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-wrapper').remove()">Cancel</button>
          <button type="button" id="save-section-copy-btn" class="btn btn-primary" style="background:#3b82f6">Copy</button>
        </div>
      </div>
    `
  });
  
  // Manually attach save button listener after modal is created
  setTimeout(() => {
    el('save-section-copy-btn')?.addEventListener('click', async () => {
      try {
        const sourceModelId = el('copy-source-model').value;
        if (!sourceModelId) {
          throw new Error('Please select a source model');
        }
        
        // Fetch data from source
        const { data: sourceData } = await supabase
          .from(section.table)
          .select('*')
          .eq('pricing_model_id', sourceModelId);
        
        if (!sourceData || sourceData.length === 0) {
          throw new Error(`No ${section.title.toLowerCase()} found in source model`);
        }
        
        // Delete existing in current model
        await supabase
          .from(section.table)
          .delete()
          .eq('pricing_model_id', currentModelId);
        
        // Insert copies
        const copies = sourceData.map(item => {
          const copy = { pricing_model_id: currentModelId };
          section.fields.forEach(field => {
            copy[field] = item[field];
          });
          return copy;
        });
        
        await supabase.from(section.table).insert(copies);
        
        // Close modal
        closeModal();
        
        alert(`✅ Successfully copied ${copies.length} ${section.title.toLowerCase()}!`);
        if (onComplete) onComplete();
      } catch (e) {
        showError('section-copy-error', e);
      }
    });
  }, 100);
}

// ===== TIER TEMPLATES SECTION =====
async function renderTierTemplates(modelId) {
  const host = el('pm-tier-templates');
  if (!host) return;
  
  const { data, error } = await supabase
    .from('pricing_tier_templates')
    .select('*')
    .eq('pricing_model_id', modelId)
    .order('priority', { ascending: false });
  
  if (error) {
    host.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return;
  }
  
  const rows = data || [];
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="border-bottom:2px solid #e2e8f0">
        <div 
          style="padding:16px 20px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;"
          data-toggle="tier-templates-content"
          onmouseover="this.style.background='#f1f5f9'"
          onmouseout="this.style.background='#f8fafc'"
        >
          <div style="display:flex;align-items:center;gap:12px">
            <span class="toggle-icon" style="font-size:18px;transition:transform 0.2s">▶</span>
            <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Tier Templates</h3>
            <span style="padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:4px;font-size:12px;font-weight:500">
              ${rows.length} tier${rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <button class="btn btn-sm" id="copy-tiers-section-btn" style="background:#10b981;color:white;padding:6px 12px;font-size:12px" onclick="event.stopPropagation()">
            📋 Copy from Model
          </button>
        </div>
        <div style="padding:12px 20px;background:white;border-top:1px solid #e2e8f0">
          <button class="btn btn-primary mobile-full-btn" id="add-tier-btn" style="width:100%">+ Add Tier</button>
        </div>
      </div>
      
      <div id="tier-templates-content" style="display:none">
        <div class="revenue-table-wrapper" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:700px">
            <thead>
              <tr style="background:#fafbfc">
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Tier Name</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Min Occ %</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Max Occ %</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Multiplier</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Priority</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Active</th>
                <th style="padding:12px 20px;text-align:right;font-weight:600;color:#64748b;font-size:13px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="7" style="padding:40px 20px;text-align:center;color:#94a3b8">No tier templates configured</td></tr>
              ` : rows.map(row => `
                <tr style="border-bottom:1px solid #f1f5f9">
                  <td style="padding:12px 20px;color:#334155">${row.tier_name}</td>
                  <td style="padding:12px 20px;color:#334155">${(row.min_hist_occupancy * 100).toFixed(0)}%</td>
                  <td style="padding:12px 20px;color:#334155">${(row.max_hist_occupancy * 100).toFixed(0)}%</td>
                  <td style="padding:12px 20px;color:#334155">${row.multiplier}</td>
                  <td style="padding:12px 20px;color:#334155">${row.priority}</td>
                  <td style="padding:12px 20px;color:#334155">${row.is_active !== false ? 'Yes' : 'No'}</td>
                  <td style="padding:12px 20px;text-align:right">
                    <button class="btn btn-sm" data-edit-tier="${row.id}">Edit</button>
                    <button class="btn btn-sm" data-delete-tier="${row.id}">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Initialize toggles
  initializeToggles();
  
  el('add-tier-btn')?.addEventListener('click', () => openTierModal(modelId, null));
  el('copy-tiers-section-btn')?.addEventListener('click', () => openSectionCopyModal('tiers', modelId, () => renderTierTemplates(modelId)));
  
  rows.forEach(row => {
    document.querySelector(`[data-edit-tier="${row.id}"]`)?.addEventListener('click', () => openTierModal(modelId, row));
    document.querySelector(`[data-delete-tier="${row.id}"]`)?.addEventListener('click', async () => {
      if (confirm('Delete this tier template?')) {
        await deleteRecord('pricing_tier_templates', row.id);
        renderTierTemplates(modelId);
      }
    });
  });
}

function openTierModal(modelId, tier) {
  const isEdit = !!tier;
  
  openSharedModal({
    id: 'tier-modal',
    title: `${isEdit ? 'Edit' : 'New'} Tier Template`,
    subtitle: 'Define occupancy-based pricing tiers',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Tier Name *</label>
            <input id="tier-name" value="${tier?.tier_name || ''}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Min Historical Occupancy (0-1) *</label>
            <input id="tier-min-occ" type="number" step="0.01" value="${tier?.min_hist_occupancy || 0}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Max Historical Occupancy (0-1) *</label>
            <input id="tier-max-occ" type="number" step="0.01" value="${tier?.max_hist_occupancy || 1}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Multiplier *</label>
            <input id="tier-mult" type="number" step="0.01" value="${tier?.multiplier || 1}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Priority *</label>
            <input id="tier-priority" type="number" value="${tier?.priority || 0}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="tier-active" ${tier?.is_active !== false ? 'checked' : ''} style="width:auto;" />
              <span>Is Active</span>
            </label>
          </div>
        </div>
        <div id="tier-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('tier-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#f1f5f9;color:#334155;border:none;cursor:pointer;">Cancel</button>
        <button class="btn cta" id="tier-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  el('tier-save')?.addEventListener('click', async () => {
    try {
      const data = {
        pricing_model_id: modelId,
        tier_name: el('tier-name').value.trim(),
        min_hist_occupancy: parseFloat(el('tier-min-occ').value),
        max_hist_occupancy: parseFloat(el('tier-max-occ').value),
        multiplier: parseFloat(el('tier-mult').value),
        priority: parseInt(el('tier-priority').value),
        is_active: el('tier-active').checked
      };
      
      if (!data.tier_name) throw new Error('Tier name is required');
      
      if (isEdit) {
        await supabase.from('pricing_tier_templates').update(data).eq('id', tier.id);
      } else {
        await supabase.from('pricing_tier_templates').insert(data);
      }
      
      wrap.remove();
      renderTierTemplates(modelId);
    } catch (e) {
      showError('tier-error', e);
    }
  });
    }
  });
}

// ===== MONTH RULES SECTION =====
async function renderMonthRules(modelId) {
  const host = el('pm-month-rules');
  if (!host) return;
  
  const { data, error } = await supabase
    .from('pricing_model_month_rules')
    .select('*')
    .eq('pricing_model_id', modelId)
    .order('month', { ascending: true });
  
  if (error) {
    host.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return;
  }
  
  const rows = data || [];
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="border-bottom:2px solid #e2e8f0">
        <div 
          style="padding:16px 20px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s;"
          data-toggle="month-rules-content"
          onmouseover="this.style.background='#f1f5f9'"
          onmouseout="this.style.background='#f8fafc'"
        >
          <div style="display:flex;align-items:center;gap:12px">
            <span class="toggle-icon" style="font-size:18px;transition:transform 0.2s">▶</span>
            <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Month Rules</h3>
            <span style="padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:4px;font-size:12px;font-weight:500">
              ${rows.length} rule${rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <button class="btn btn-sm" id="copy-month-rules-section-btn" style="background:#10b981;color:white;padding:6px 12px;font-size:12px" onclick="event.stopPropagation()">
            📋 Copy from Model
          </button>
        </div>
        <div style="padding:12px 20px;background:white;border-top:1px solid #e2e8f0">
          <button class="btn btn-primary mobile-full-btn" id="add-month-btn" style="width:100%">+ Add Rule</button>
        </div>
      </div>
      
      <div id="month-rules-content" style="display:none">
        <div class="revenue-table-wrapper" style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:600px">
            <thead>
              <tr style="background:#fafbfc">
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Month</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Tier Strength</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Min Multiplier</th>
                <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Max Multiplier</th>
                <th style="padding:12px 20px;text-align:right;font-weight:600;color:#64748b;font-size:13px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? `
                <tr><td colspan="5" style="padding:40px 20px;text-align:center;color:#94a3b8">No month rules configured</td></tr>
              ` : rows.map(row => {
                const monthName = new Date(2000, row.month - 1).toLocaleString('default', { month: 'long' });
                return `
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:12px 20px;color:#334155">${monthName}</td>
                    <td style="padding:12px 20px;color:#334155">${row.tier_strength}</td>
                    <td style="padding:12px 20px;color:#334155">${row.min_multiplier}</td>
                    <td style="padding:12px 20px;color:#334155">${row.max_multiplier}</td>
                    <td style="padding:12px 20px;text-align:right">
                      <button class="btn btn-sm" data-edit-month="${row.id}">Edit</button>
                      <button class="btn btn-sm" data-delete-month="${row.id}">Delete</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  // Initialize toggles
  initializeToggles();
  
  el('add-month-btn')?.addEventListener('click', () => openMonthModal(modelId, null));
  el('copy-month-rules-section-btn')?.addEventListener('click', () => openSectionCopyModal('month-rules', modelId, () => renderMonthRules(modelId)));
  
  rows.forEach(row => {
    document.querySelector(`[data-edit-month="${row.id}"]`)?.addEventListener('click', () => openMonthModal(modelId, row));
    document.querySelector(`[data-delete-month="${row.id}"]`)?.addEventListener('click', async () => {
      if (confirm('Delete this month rule?')) {
        await deleteRecord('pricing_model_month_rules', row.id);
        renderMonthRules(modelId);
      }
    });
  });
}

function openMonthModal(modelId, rule) {
  const isEdit = !!rule;
  const monthOptions = Array.from({length: 12}, (_, i) => {
    const month = i + 1;
    const name = new Date(2000, i).toLocaleString('default', { month: 'long' });
    return `<option value="${month}" ${rule?.month === month ? 'selected' : ''}>${name}</option>`;
  }).join('');
  
  openSharedModal({
    id: 'month-modal',
    title: `${isEdit ? 'Edit' : 'New'} Month Rule`,
    subtitle: 'Configure month-specific pricing rules',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Month *</label>
            <select id="month-month" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'">${monthOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Tier Strength *</label>
            <input id="month-strength" type="number" step="0.01" value="${rule?.tier_strength || 1}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Min Multiplier *</label>
            <input id="month-min" type="number" step="0.01" value="${rule?.min_multiplier || 0.8}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Max Multiplier *</label>
            <input id="month-max" type="number" step="0.01" value="${rule?.max_multiplier || 1.2}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
        </div>
        <div id="month-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('month-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#f1f5f9;color:#334155;border:none;cursor:pointer;">Cancel</button>
        <button class="btn cta" id="month-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  el('month-save')?.addEventListener('click', async () => {
    try {
      const data = {
        pricing_model_id: modelId,
        month: parseInt(el('month-month').value),
        tier_strength: parseFloat(el('month-strength').value),
        min_multiplier: parseFloat(el('month-min').value),
        max_multiplier: parseFloat(el('month-max').value)
      };
      
      if (isEdit) {
        await supabase.from('pricing_model_month_rules').update(data).eq('id', rule.id);
      } else {
        await supabase.from('pricing_model_month_rules').insert(data);
      }
      
      wrap.remove();
      renderMonthRules(modelId);
    } catch (e) {
      showError('month-error', e);
    }
  });
    }
  });
}


// ===== TARGETS SECTION =====
async function renderTargets(modelId, roomTypes) {
  const host = el('pm-targets');
  if (!host) return;
  
  const { data, error } = await supabase
    .from('pricing_targets')
    .select('*')
    .eq('pricing_model_id', modelId)
    .order('month', { ascending: true });
  
  if (error) {
    host.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return;
  }
  
  const rows = data || [];
  
  // Group by room type
  const groupedRows = {};
  rows.forEach(row => {
    const roomKey = row.room_type_id || 'all_rooms';
    if (!groupedRows[roomKey]) {
      groupedRows[roomKey] = [];
    }
    groupedRows[roomKey].push(row);
  });
  
  const windowLabels = {
    'last_minute': '🔴 Last Minute',
    'walk_in': '🟡 Walk-in',
    'short_term': '🟢 Short Term',
    'medium_term': '🔵 Medium Term',
    'long_term': '🟣 Long Term'
  };
  
  host.innerHTML = `
    <!-- Excel Upload Component -->
    <div class="chart-card" style="margin-bottom:24px">
      <div style="padding:20px">
        <h3 style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#0f172a">
          📤 Bulk Upload Targets & Pace Curves
        </h3>
        <p style="margin:0 0 16px 0;font-size:13px;color:#64748b">
          Upload an Excel file to configure multiple targets and pace curves at once
        </p>

        <!-- Step 1: Download Template -->
        <div style="margin-bottom:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:20px">📋</span>
            <div>
              <div style="font-weight:600;color:#0f172a;font-size:14px;margin-bottom:2px">Step 1: Download Template</div>
              <div style="font-size:12px;color:#64748b">Get the Excel template with correct format</div>
            </div>
          </div>
          <button 
            id="download-targets-template" 
            class="btn btn-secondary"
            style="padding:8px 16px;background:white;border:1px solid #d1d5db;border-radius:6px;font-weight:500;font-size:13px"
          >
            📥 Download Template
          </button>
        </div>

        <!-- Step 2: Upload File -->
        <div style="margin-bottom:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:20px">📁</span>
            <div>
              <div style="font-weight:600;color:#0f172a;font-size:14px;margin-bottom:2px">Step 2: Upload Filled Template</div>
              <div style="font-size:12px;color:#64748b">Select your completed Excel file</div>
            </div>
          </div>
          <input 
            type="file" 
            id="upload-targets-excel" 
            accept=".xlsx,.xls"
            style="display:block;padding:8px;border:1px solid #d1d5db;border-radius:6px;width:100%;max-width:400px;font-size:13px"
           style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
        </div>

        <!-- Progress/Results -->
        <div id="upload-results" style="display:none;margin-bottom:12px"></div>

        <!-- Step 3: Process -->
        <button 
          id="process-targets-upload" 
          class="btn btn-primary"
          style="padding:10px 20px;background:#3b82f6;color:white;border-radius:6px;font-weight:600;font-size:13px;display:none"
        >
          ⚡ Process Upload
        </button>
      </div>
    </div>

    <!-- Lead Window Legend -->
    <div class="chart-card" style="margin-bottom:24px">
      <div style="padding:20px">
        <h3 style="margin:0 0 12px 0;font-size:16px;font-weight:600;color:#0f172a;display:flex;align-items:center;gap:8px">
          <span>📅</span> Lead Window Reference
        </h3>
        <p style="margin:0 0 16px 0;font-size:13px;color:#64748b">
          Lead windows automatically adjust pricing based on how far in advance guests are booking. 
          The system calculates the booking window and applies the appropriate target.
        </p>
        <div style="display:grid;gap:10px">
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:8px;border:1px solid #fecaca">
            <span style="font-size:24px">🔴</span>
            <div style="flex:1">
              <div style="font-weight:600;color:#991b1b;font-size:14px">Last Minute</div>
              <div style="font-size:12px;color:#64748b">Less than 7 days before arrival</div>
            </div>
            <div style="padding:4px 12px;background:#fee2e2;border-radius:6px;font-size:11px;font-weight:600;color:#991b1b">
              < 7 days
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:8px;border:1px solid #fef3c7">
            <span style="font-size:24px">🟡</span>
            <div style="flex:1">
              <div style="font-weight:600;color:#92400e;font-size:14px">Walk-in</div>
              <div style="font-size:12px;color:#64748b">7 to 14 days before arrival</div>
            </div>
            <div style="padding:4px 12px;background:#fef3c7;border-radius:6px;font-size:11px;font-weight:600;color:#92400e">
              7-14 days
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:8px;border:1px solid #d1fae5">
            <span style="font-size:24px">🟢</span>
            <div style="flex:1">
              <div style="font-weight:600;color:#065f46;font-size:14px">Short Term</div>
              <div style="font-size:12px;color:#64748b">14 to 30 days before arrival</div>
            </div>
            <div style="padding:4px 12px;background:#d1fae5;border-radius:6px;font-size:11px;font-weight:600;color:#065f46">
              14-30 days
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:8px;border:1px solid #dbeafe">
            <span style="font-size:24px">🔵</span>
            <div style="flex:1">
              <div style="font-weight:600;color:#1e40af;font-size:14px">Medium Term</div>
              <div style="font-size:12px;color:#64748b">30 to 90 days before arrival</div>
            </div>
            <div style="padding:4px 12px;background:#dbeafe;border-radius:6px;font-size:11px;font-weight:600;color:#1e40af">
              30-90 days
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding:10px;background:white;border-radius:8px;border:1px solid #e9d5ff">
            <span style="font-size:24px">🟣</span>
            <div style="flex:1">
              <div style="font-weight:600;color:#6b21a8;font-size:14px">Long Term</div>
              <div style="font-size:12px;color:#64748b">90 or more days before arrival</div>
            </div>
            <div style="padding:4px 12px;background:#e9d5ff;border-radius:6px;font-size:11px;font-weight:600;color:#6b21a8">
              90+ days
            </div>
          </div>
        </div>
        <div style="margin-top:12px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
          <div style="font-size:12px;color:#475569">
            <strong>💡 Pro Tip:</strong> Set aggressive targets for last-minute bookings (higher occupancy, higher prices) 
            and conservative targets for long-term bookings (allow room for early-bird deals).
          </div>
        </div>
      </div>
    </div>
    
    <!-- Targets Table -->
    <div class="chart-card">
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;padding:20px 20px 16px 20px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:12px" class="mobile-stack">
        <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Targets</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" id="copy-targets-section-btn" style="background:#10b981;color:white">📋 Copy from Model</button>
          <button class="btn btn-primary mobile-full-btn" id="add-target-btn">+ Add Target</button>
        </div>
      </div>
      
      ${Object.keys(groupedRows).length === 0 ? `
        <div style="padding:40px 20px;text-align:center;color:#94a3b8">
          No targets configured
        </div>
      ` : Object.keys(groupedRows).map(roomKey => {
        const roomRows = groupedRows[roomKey];
        const roomName = roomKey === 'all_rooms' 
          ? '🌐 All Rooms' 
          : (roomTypes.find(r => r.id === roomKey)?.code || 'Unknown Room');
        const roomId = `target-room-${roomKey}`;
        
        return `
          <div style="border-bottom:1px solid #f1f5f9">
            <!-- Group Header -->
            <div 
              style="padding:16px 20px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s"
              class="room-group-header"
              data-toggle="${roomId}"
              onmouseover="this.style.background='#f1f5f9'"
              onmouseout="this.style.background='#f8fafc'"
            >
              <div style="display:flex;align-items:center;gap:12px">
                <span class="toggle-icon" style="font-size:18px;transition:transform 0.2s">▶</span>
                <span style="font-weight:600;color:#0f172a;font-size:15px">${roomName}</span>
                <span style="padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:4px;font-size:12px;font-weight:500">
                  ${roomRows.length} target${roomRows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            
            <!-- Group Content -->
            <div id="${roomId}" class="room-group-content" style="display:none">
              <div class="revenue-table-wrapper" style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;min-width:700px">
                  <thead>
                    <tr style="background:#fafbfc">
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Month</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Target Occ %</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Target Rev</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Sens. ↑</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Sens. ↓</th>
                      <th style="padding:12px 20px;text-align:right;font-weight:600;color:#64748b;font-size:13px">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${roomRows.map(row => {
                      const monthName = new Date(2000, row.month - 1).toLocaleString('default', { month: 'short' });
                      const revDisplay = row.target_revpan ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(row.target_revpan) : '—';
                      return `
                        <tr style="border-bottom:1px solid #f1f5f9">
                          <td style="padding:12px 20px;color:#334155">${monthName}</td>
                          <td style="padding:12px 20px;color:#334155">${row.target_occupancy ? (row.target_occupancy * 100).toFixed(0) + '%' : '—'}</td>
                          <td style="padding:12px 20px;color:#334155">${revDisplay}</td>
                          <td style="padding:12px 20px;color:#334155">${((row.sensitivity_up || 0.25) * 100).toFixed(0)}%</td>
                          <td style="padding:12px 20px;color:#334155">${((row.sensitivity_down || 0.25) * 100).toFixed(0)}%</td>
                          <td style="padding:12px 20px;text-align:right">
                            <button class="btn btn-sm" data-edit-target="${row.id}">Edit</button>
                            <button class="btn btn-sm" data-delete-target="${row.id}">Delete</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Initialize toggles for room groups
  initializeToggles();
  
  el('add-target-btn')?.addEventListener('click', () => openTargetModal(modelId, roomTypes, null));
  el('copy-targets-section-btn')?.addEventListener('click', () => openSectionCopyModal('targets', modelId, () => renderTargets(modelId, roomTypes)));
  
  // Excel upload event listeners
  el('download-targets-template')?.addEventListener('click', () => downloadTargetsTemplate(roomTypes));
  
  el('upload-targets-excel')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      el('process-targets-upload').style.display = 'block';
      el('upload-results').style.display = 'none';
    }
  });
  
  el('process-targets-upload')?.addEventListener('click', () => processTargetsUpload(modelId, roomTypes));
  
  rows.forEach(row => {
    document.querySelector(`[data-edit-target="${row.id}"]`)?.addEventListener('click', () => openTargetModal(modelId, roomTypes, row));
    document.querySelector(`[data-delete-target="${row.id}"]`)?.addEventListener('click', async () => {
      if (confirm('Delete this target?')) {
        await deleteRecord('pricing_targets', row.id);
        renderTargets(modelId, roomTypes);
      }
    });
  });
}
function openTargetModal(modelId, roomTypes, target) {
  const isEdit = !!target;
  const roomOptions = [
    '<option value="">All Rooms</option>',
    ...roomTypes.map(r => `<option value="${r.id}" ${target?.room_type_id === r.id ? 'selected' : ''}>${r.code || r.name}</option>`)
  ].join('');
  
  const monthOptions = Array.from({length: 12}, (_, i) => {
    const month = i + 1;
    const name = new Date(2000, i).toLocaleString('default', { month: 'long' });
    return `<option value="${month}" ${target?.month === month ? 'selected' : ''}>${name}</option>`;
  }).join('');
  
  const leadWindowOptions = [
    { value: 'last_minute', label: '🔴 Last Minute', desc: '(< 7 days)' },
    { value: 'walk_in', label: '🟡 Walk-in', desc: '(7-14 days)' },
    { value: 'short_term', label: '🟢 Short Term', desc: '(14-30 days)' },
    { value: 'medium_term', label: '🔵 Medium Term', desc: '(30-90 days)' },
    { value: 'long_term', label: '🟣 Long Term', desc: '(90+ days)' }
  ].map(w => `
    <option value="${w.value}" ${target?.lead_window === w.value ? 'selected' : ''}>
      ${w.label} ${w.desc}
    </option>
  `).join('');
  
  openSharedModal({
    id: 'target-modal',
    title: `${isEdit ? 'Edit' : 'New'} Target`,
    subtitle: 'Set monthly occupancy and revenue targets',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Room Type</label>
            <select id="target-room" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">${roomOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Month *</label>
            <select id="target-month" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">${monthOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Target Occupancy (0-1)</label>
            <input id="target-occ" type="number" step="0.01" value="${target?.target_occupancy ?? ''}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Target Revenue</label>
            <input id="target-rev" type="number" step="0.01" value="${target?.target_revenue ?? ''}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Sensitivity Up (0-1)</label>
              <input id="target-sens-up" type="number" step="0.01" min="0" max="1" value="${target?.sensitivity_up ?? 0.25}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
              <small style="color:#64748b">Price increase when above targets</small>
            </div>
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Sensitivity Down (0-1)</label>
              <input id="target-sens-down" type="number" step="0.01" min="0" max="1" value="${target?.sensitivity_down ?? 0.25}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
              <small style="color:#64748b">Price decrease when below targets</small>
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="target-active" ${target?.is_active !== false ? 'checked' : ''} style="width:auto;" />
              <span>Is Active</span>
            </label>
          </div>
        </div>
        <div id="target-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('target-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#f1f5f9;color:#334155;border:none;cursor:pointer;">Cancel</button>
        <button class="btn cta" id="target-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  el('target-save')?.addEventListener('click', async () => {
    try {
      const roomValue = el('target-room').value;
      const occValue = el('target-occ').value;
      const revValue = el('target-rev').value;
      
      const data = {
        pricing_model_id: modelId,
        room_type_id: roomValue ? roomValue : null,
        month: parseInt(el('target-month').value),
        target_occupancy: occValue ? parseFloat(occValue) : null,
        target_revpan: revValue ? parseFloat(revValue) : null,
        sensitivity_up: parseFloat(el('target-sens-up').value),
        sensitivity_down: parseFloat(el('target-sens-down').value),
        is_active: el('target-active').checked
      };
      
      if (isEdit) {
        await supabase.from('pricing_targets').update(data).eq('id', target.id);
      } else {
        await supabase.from('pricing_targets').insert(data);
      }
      
      wrap.remove();
      renderTargets(modelId, roomTypes);
    } catch (e) {
      showError('target-error', e);
    }
  });
    }
  });
}

// ===== PACE CURVES SECTION =====
async function renderPaceCurves(modelId, roomTypes) {
  const host = el('pm-pace');
  if (!host) return;
  
  const { data, error } = await supabase
    .from('pricing_pace_curves')
    .select('*')
    .eq('pricing_model_id', modelId)
    .order('month', { ascending: true });
  
  if (error) {
    host.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return;
  }
  
  const rows = data || [];
  
  // Group by room type
  const groupedRows = {};
  rows.forEach(row => {
    const roomKey = row.room_type_id;
    if (!groupedRows[roomKey]) {
      groupedRows[roomKey] = [];
    }
    groupedRows[roomKey].push(row);
  });
  
  const windowLabels = {
    'last_minute': '🔴 Last Minute',
    'walk_in': '🟡 Walk-in',
    'short_term': '🟢 Short Term',
    'medium_term': '🔵 Medium Term',
    'long_term': '🟣 Long Term'
  };
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;padding:20px 20px 16px 20px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:12px" class="mobile-stack">
        <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Pace Curves</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-sm" id="copy-pace-section-btn" style="background:#10b981;color:white">📋 Copy from Model</button>
          <button class="btn btn-primary mobile-full-btn" id="add-pace-btn">+ Add Pace Curve</button>
        </div>
      </div>
      
      ${Object.keys(groupedRows).length === 0 ? `
        <div style="padding:40px 20px;text-align:center;color:#94a3b8">
          No pace curves configured
        </div>
      ` : Object.keys(groupedRows).map(roomKey => {
        const roomRows = groupedRows[roomKey];
        const roomName = roomTypes.find(r => r.id === roomKey)?.code || 'Unknown Room';
        const roomId = `pace-room-${roomKey}`;
        
        return `
          <div style="border-bottom:1px solid #f1f5f9">
            <!-- Group Header -->
            <div 
              style="padding:16px 20px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s"
              class="room-group-header"
              data-toggle="${roomId}"
              onmouseover="this.style.background='#f1f5f9'"
              onmouseout="this.style.background='#f8fafc'"
            >
              <div style="display:flex;align-items:center;gap:12px">
                <span class="toggle-icon" style="font-size:18px;transition:transform 0.2s">▶</span>
                <span style="font-weight:600;color:#0f172a;font-size:15px">${roomName}</span>
                <span style="padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:4px;font-size:12px;font-weight:500">
                  ${roomRows.length} curve${roomRows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            
            <!-- Group Content -->
            <div id="${roomId}" class="room-group-content" style="display:none">
              <div class="revenue-table-wrapper" style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;min-width:800px">
                  <thead>
                    <tr style="background:#fafbfc">
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Month</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Lead Window</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Expected OTB %</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Sens. Up</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Sens. Down</th>
                      <th style="padding:12px 20px;text-align:right;font-weight:600;color:#64748b;font-size:13px">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${roomRows.map(row => {
                      const monthName = new Date(2000, row.month - 1).toLocaleString('default', { month: 'short' });
                      return `
                        <tr style="border-bottom:1px solid #f1f5f9">
                          <td style="padding:12px 20px;color:#334155">${monthName}</td>
                          <td style="padding:12px 20px;color:#334155">${windowLabels[row.lead_window] || row.lead_window || '—'}</td>
                          <td style="padding:12px 20px;color:#334155">${(row.expected_otb_occ * 100).toFixed(0)}%</td>
                          <td style="padding:12px 20px;color:#334155">${((row.pace_sensitivity_up || 0.25) * 100).toFixed(0)}%</td>
                          <td style="padding:12px 20px;color:#334155">${((row.pace_sensitivity_down || 0.25) * 100).toFixed(0)}%</td>
                          <td style="padding:12px 20px;text-align:right">
                            <button class="btn btn-sm" data-edit-pace="${row.id}">Edit</button>
                            <button class="btn btn-sm" data-delete-pace="${row.id}">Delete</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Initialize toggles for room groups
  initializeToggles();
  
  el('add-pace-btn')?.addEventListener('click', () => openPaceModal(modelId, roomTypes, null));
  el('copy-pace-section-btn')?.addEventListener('click', () => openSectionCopyModal('pace', modelId, () => renderPaceCurves(modelId, roomTypes)));
  
  rows.forEach(row => {
    document.querySelector(`[data-edit-pace="${row.id}"]`)?.addEventListener('click', () => openPaceModal(modelId, roomTypes, row));
    document.querySelector(`[data-delete-pace="${row.id}"]`)?.addEventListener('click', async () => {
      if (confirm('Delete this pace curve entry?')) {
        await deleteRecord('pricing_pace_curves', row.id);
        renderPaceCurves(modelId, roomTypes);
      }
    });
  });
}
function openPaceModal(modelId, roomTypes, pace) {
  const isEdit = !!pace;
  const roomOptions = roomTypes.map(r => 
    `<option value="${r.id}" ${pace?.room_type_id === r.id ? 'selected' : ''}>${r.code || r.name}</option>`
  ).join('');
  
  const monthOptions = Array.from({length: 12}, (_, i) => {
    const month = i + 1;
    const name = new Date(2000, i).toLocaleString('default', { month: 'long' });
    return `<option value="${month}" ${pace?.month === month ? 'selected' : ''}>${name}</option>`;
  }).join('');
  
  const leadWindowOptions = [
    { value: 'last_minute', label: '🔴 Last Minute', desc: '(< 7 days)' },
    { value: 'walk_in', label: '🟡 Walk-in', desc: '(7-14 days)' },
    { value: 'short_term', label: '🟢 Short Term', desc: '(14-30 days)' },
    { value: 'medium_term', label: '🔵 Medium Term', desc: '(30-90 days)' },
    { value: 'long_term', label: '🟣 Long Term', desc: '(90+ days)' }
  ].map(w => `
    <option value="${w.value}" ${pace?.lead_window === w.value ? 'selected' : ''}>
      ${w.label} ${w.desc}
    </option>
  `).join('');
  
  openSharedModal({
    id: 'pace-modal',
    title: `${isEdit ? 'Edit' : 'New'} Pace Curve`,
    subtitle: 'Define expected booking pace by lead time',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Room Type *</label>
            <select id="pace-room" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">${roomOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Month *</label>
            <select id="pace-month" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">${monthOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Lead Time Window *</label>
            <select id="pace-lead-window" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">
              ${leadWindowOptions}
            </select>
            <small style="display:block;margin-top:4px;color:#64748b;font-size:12px">
              Expected occupancy booking pattern for this lead window
            </small>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Expected OTB Occupancy (0-1) *</label>
            <input id="pace-occ" type="number" step="0.01" value="${pace?.expected_otb_occ ?? 0}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
            <small style="color:#64748b">Expected on-the-books occupancy at this lead time</small>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Sensitivity Up (0-1)</label>
              <input id="pace-sens-up" type="number" step="0.01" min="0" max="1" value="${pace?.pace_sensitivity_up ?? 0.25}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
              <small style="color:#64748b">Price increase when ahead of pace</small>
            </div>
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Sensitivity Down (0-1)</label>
              <input id="pace-sens-down" type="number" step="0.01" min="0" max="1" value="${pace?.pace_sensitivity_down ?? 0.25}" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'"/>
              <small style="color:#64748b">Price decrease when behind pace</small>
            </div>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="pace-active" ${pace?.is_active !== false ? 'checked' : ''} style="width:auto;" />
              <span>Is Active</span>
            </label>
          </div>
        </div>
        <div id="pace-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('pace-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#f1f5f9;color:#334155;border:none;cursor:pointer;">Cancel</button>
        <button class="btn cta" id="pace-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  el('pace-save')?.addEventListener('click', async () => {
    try {
      const data = {
        pricing_model_id: modelId,
        room_type_id: el('pace-room').value,
        month: parseInt(el('pace-month').value),
        lead_window: el('pace-lead-window').value,
        expected_otb_occ: parseFloat(el('pace-occ').value),
        pace_sensitivity_up: parseFloat(el('pace-sens-up').value),
        pace_sensitivity_down: parseFloat(el('pace-sens-down').value),
        is_active: el('pace-active').checked
      };
      
      if (isEdit) {
        await supabase.from('pricing_pace_curves').update(data).eq('id', pace.id);
      } else {
        await supabase.from('pricing_pace_curves').insert(data);
      }
      
      wrap.remove();
      renderPaceCurves(modelId, roomTypes);
    } catch (e) {
      showError('pace-error', e);
    }
  });
    }
  });
}

// ===== OVERRIDES SECTION =====
async function renderOverrides(modelId, roomTypes) {
  const host = el('pm-overrides');
  if (!host) return;
  
  const { data, error } = await supabase
    .from('pricing_overrides')
    .select('*')
    .order('start_date', { ascending: false });
  
  if (error) {
    host.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    return;
  }
  
  const rows = data || [];
  
  // Group by room type
  const groupedRows = {};
  rows.forEach(row => {
    const roomKey = row.room_type_id || 'all_rooms';
    if (!groupedRows[roomKey]) {
      groupedRows[roomKey] = [];
    }
    groupedRows[roomKey].push(row);
  });
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;padding:20px 20px 16px 20px;border-bottom:2px solid #e2e8f0;flex-wrap:wrap;gap:12px" class="mobile-stack">
        <h3 style="font-weight:700;font-size:16px;color:#334155;margin:0">Manual Overrides</h3>
        <button class="btn btn-primary mobile-full-btn" id="add-override-btn">+ Add Override</button>
      </div>
      
      ${Object.keys(groupedRows).length === 0 ? `
        <div style="padding:40px 20px;text-align:center;color:#94a3b8">
          No overrides configured
        </div>
      ` : Object.keys(groupedRows).map(roomKey => {
        const roomRows = groupedRows[roomKey];
        const roomName = roomKey === 'all_rooms' 
          ? '🌐 All Rooms' 
          : (roomTypes.find(r => r.id === roomKey)?.code || 'Unknown Room');
        const roomId = `override-room-${roomKey}`;
        
        return `
          <div style="border-bottom:1px solid #f1f5f9">
            <!-- Group Header -->
            <div 
              style="padding:16px 20px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:background 0.2s"
              class="room-group-header"
              data-toggle="${roomId}"
              onmouseover="this.style.background='#f1f5f9'"
              onmouseout="this.style.background='#f8fafc'"
            >
              <div style="display:flex;align-items:center;gap:12px">
                <span class="toggle-icon" style="font-size:18px;transition:transform 0.2s">▶</span>
                <span style="font-weight:600;color:#0f172a;font-size:15px">${roomName}</span>
                <span style="padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:4px;font-size:12px;font-weight:500">
                  ${roomRows.length} override${roomRows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            
            <!-- Group Content -->
            <div id="${roomId}" class="room-group-content" style="display:none">
              <div class="revenue-table-wrapper" style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;min-width:700px">
                  <thead>
                    <tr style="background:#fafbfc">
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Start Date</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">End Date</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Days</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Type</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Value</th>
                      <th style="padding:12px 20px;text-align:left;font-weight:600;color:#64748b;font-size:13px">Reason</th>
                      <th style="padding:12px 20px;text-align:right;font-weight:600;color:#64748b;font-size:13px">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${roomRows.map(row => {
                      const value = row.override_type === 'fixed_price' ? `GHS ${row.fixed_price}` : `${row.multiplier}x`;
                      const dayTypeLabel = row.day_type === 'weekday' ? '📅 Weekdays' : row.day_type === 'weekend' ? '🌙 Weekends' : '📆 All Days';
                      return `
                        <tr style="border-bottom:1px solid #f1f5f9">
                          <td style="padding:12px 20px;color:#334155">${row.start_date}</td>
                          <td style="padding:12px 20px;color:#334155">${row.end_date}</td>
                          <td style="padding:12px 20px;color:#334155">${dayTypeLabel}</td>
                          <td style="padding:12px 20px;color:#334155">${row.override_type === 'fixed_price' ? 'Fixed Price' : 'Multiplier'}</td>
                          <td style="padding:12px 20px;color:#334155">${value}</td>
                          <td style="padding:12px 20px;color:#334155">${row.reason || '—'}</td>
                          <td style="padding:12px 20px;text-align:right">
                            <button class="btn btn-sm" data-edit-override="${row.id}">Edit</button>
                            <button class="btn btn-sm" data-delete-override="${row.id}">Delete</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Initialize toggles for room groups
  initializeToggles();
  
  el('add-override-btn')?.addEventListener('click', () => openOverrideModal(modelId, roomTypes, null));
  
  rows.forEach(row => {
    document.querySelector(`[data-edit-override="${row.id}"]`)?.addEventListener('click', () => openOverrideModal(modelId, roomTypes, row));
    document.querySelector(`[data-delete-override="${row.id}"]`)?.addEventListener('click', async () => {
      if (confirm('Delete this override?')) {
        await deleteRecord('pricing_overrides', row.id);
        renderOverrides(modelId, roomTypes);
      }
    });
  });
}

function openOverrideModal(modelId, roomTypes, override) {
  const isEdit = !!override;
  const roomOptions = [
    '<option value="">All Rooms</option>',
    ...roomTypes.map(r => `<option value="${r.id}" ${override?.room_type_id === r.id ? 'selected' : ''}>${r.code || r.name}</option>`)
  ].join('');
  
  openSharedModal({
    id: 'override-modal',
    title: `${isEdit ? 'Edit' : 'New'} Override`,
    subtitle: 'Manually override pricing for specific dates',
    bodyHtml: `<div style="display:grid;gap:16px">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Room Type</label>
            <select id="override-room" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'">${roomOptions}</select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Start Date *</label>
              <input id="override-start" type="date" value="${override?.start_date || ''}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
            </div>
            <div class="form-group">
              <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">End Date *</label>
              <input id="override-end" type="date" value="${override?.end_date || ''}" required  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
            </div>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Day Type *</label>
            <select id="override-day-type" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'">
              <option value="all" ${!override?.day_type || override?.day_type === 'all' ? 'selected' : ''}>All Days</option>
              <option value="weekday" ${override?.day_type === 'weekday' ? 'selected' : ''}>Weekdays Only</option>
              <option value="weekend" ${override?.day_type === 'weekend' ? 'selected' : ''}>Weekends Only</option>
            </select>
            <small style="color:#64748b">Choose which days within the date range this override applies to</small>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Override Type *</label>
            <select id="override-type" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'">
              <option value="fixed_price" ${override?.override_type === 'fixed_price' ? 'selected' : ''}>Fixed Price</option>
              <option value="multiplier" ${override?.override_type === 'multiplier' ? 'selected' : ''}>Multiplier</option>
            </select>
          </div>
          <div id="fixed-price-field" class="form-group" style="${override?.override_type === 'multiplier' ? 'display:none' : ''}">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Fixed Price</label>
            <input id="override-fixed" type="number" step="0.01" value="${override?.fixed_price || ''}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div id="multiplier-field" class="form-group" style="${override?.override_type === 'fixed_price' || !override ? 'display:none' : ''}">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Multiplier</label>
            <input id="override-mult" type="number" step="0.01" value="${override?.multiplier || ''}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Reason</label>
            <textarea id="override-reason" rows="3" style="width:100%;box-sizing:border-box;max-width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;">${override?.reason || ''}</textarea>
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Priority</label>
            <input id="override-priority" type="number" value="${override?.priority ?? 0}"  style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor=\'#667eea\'" onblur="this.style.borderColor=\'#e2e8f0\'"/>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;">
              <input type="checkbox" id="override-active" ${override?.is_active !== false ? 'checked' : ''} style="width:auto;" />
              <span>Is Active</span>
            </label>
          </div>
        </div>
        <div id="override-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>`,
    footerHtml: `<button class="btn" onclick="document.getElementById('override-modal').remove()" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#f1f5f9;color:#334155;border:none;cursor:pointer;">Cancel</button>
        <button class="btn cta" id="override-save" style="padding:10px 20px;border-radius:8px;font-weight:600;transition:all 0.2s;background:#3b82f6;color:white;border:none;cursor:pointer;">Save</button>`,
    onMount: (wrap) => {
  
  // Toggle fields based on override type
  el('override-type')?.addEventListener('change', (e) => {
    const fixedField = el('fixed-price-field');
    const multField = el('multiplier-field');
    if (e.target.value === 'fixed_price') {
      fixedField.style.display = 'block';
      multField.style.display = 'none';
    } else {
      fixedField.style.display = 'none';
      multField.style.display = 'block';
    }
  });
  
  const saveBtn = el('override-save');
  console.log('🔍 Override save button found:', !!saveBtn);
  
  saveBtn?.addEventListener('click', async () => {
    console.log('🔍 Override save clicked');
    try {
      const roomValue = el('override-room').value;
      const overrideType = el('override-type').value;
      const fixedPrice = el('override-fixed').value;
      const multiplier = el('override-mult').value;
      
      const data = {
        pricing_model_id: modelId,
        room_type_id: roomValue ? roomValue : null,
        start_date: el('override-start').value,
        end_date: el('override-end').value,
        day_type: el('override-day-type')?.value || 'all',
        override_type: overrideType,
        fixed_price: overrideType === 'fixed_price' && fixedPrice ? parseFloat(fixedPrice) : null,
        multiplier: overrideType === 'multiplier' && multiplier ? parseFloat(multiplier) : null,
        reason: el('override-reason').value || null,
        priority: parseInt(el('override-priority').value),
        is_active: el('override-active').checked
      };
      
      console.log('🔍 Override data to save:', JSON.stringify(data, null, 2));
      
      if (!data.start_date || !data.end_date) throw new Error('Start and end dates are required');
      if (overrideType === 'fixed_price' && !data.fixed_price) throw new Error('Fixed price is required');
      if (overrideType === 'multiplier' && !data.multiplier) throw new Error('Multiplier is required');
      
      if (isEdit) {
        const { error } = await supabase.from('pricing_overrides').update(data).eq('id', override.id);
        if (error) {
          console.error('❌ Override update error:', error);
          throw new Error(error.message);
        }
      } else {
        const { error } = await supabase.from('pricing_overrides').insert(data);
        if (error) {
          console.error('❌ Override insert error:', error);
          throw new Error(error.message);
        }
      }
      
      console.log('✅ Override saved successfully');
      wrap.remove();
      renderOverrides(modelId, roomTypes);
    } catch (e) {
      console.error('❌ Override save failed:', e);
      showError('override-error', e);
    }
  });
    }
  });
}

// ===== SHARED UTILITIES =====
async function deleteRecord(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

function showError(elementId, error) {
  const errorEl = el(elementId);
  if (errorEl) {
    errorEl.style.display = 'block';
    errorEl.textContent = error?.message || String(error);
  }
  console.error(error);
}

// ===== EXCEL UPLOAD FUNCTIONS =====

function downloadTargetsTemplate(roomTypes) {
  const workbook = XLSX.utils.book_new();

  // TARGETS SHEET
  const targetsData = [
    ['PRICING TARGETS - Fill in the rows below'],
    [],
    ['Instructions:'],
    ['- Each row represents one pricing target rule'],
    ['- room_code: Leave blank for "all rooms", or enter SAND/SEA/SUN for specific room'],
    ['- month: Enter month number (1-12)'],
    ['- target_occupancy: Target occupancy as decimal (0.75 = 75%)'],
    ['- target_revpan: Target revenue per available night (optional)'],
    ['- sensitivity_up: Price increase sensitivity when above targets (0-1, default 0.25)'],
    ['- sensitivity_down: Price decrease sensitivity when below targets (0-1, default 0.25)'],
    [],
    ['room_code', 'month', 'target_occupancy', 'target_revpan', 'sensitivity_up', 'sensitivity_down'],
    ['', 1, 0.60, 2500, 0.25, 0.25],
    ['', 1, 0.70, 2700, 0.25, 0.25],
    ['', 1, 0.80, 3000, 0.30, 0.25],
    ['SAND', 7, 0.85, 3200, 0.35, 0.30],
    ['', 7, 0.90, 3500, 0.40, 0.35],
  ];

  const targetsWS = XLSX.utils.aoa_to_sheet(targetsData);
  targetsWS['!cols'] = [
    { wch: 12 }, // room_code
    { wch: 8 },  // month
    { wch: 18 }, // target_occupancy
    { wch: 15 }, // target_revpan
    { wch: 16 }, // sensitivity_up
    { wch: 16 }  // sensitivity_down
  ];

  XLSX.utils.book_append_sheet(workbook, targetsWS, 'Targets');

  // PACE CURVES SHEET
  const paceData = [
    ['PACE CURVES - Fill in the rows below'],
    [],
    ['Instructions:'],
    ['- Each row represents one pace curve data point'],
    ['- room_code: Must match a room (SAND/SEA/SUN)'],
    ['- month: Enter month number (1-12)'],
    ['- lead_window: Choose from: last_minute, walk_in, short_term, medium_term, long_term'],
    ['- expected_otb_occ: Expected on-the-books occupancy at this lead time (0.40 = 40%)'],
    ['- pace_sensitivity_up: Price increase sensitivity when ahead of pace (0-1, default 0.25)'],
    ['- pace_sensitivity_down: Price decrease sensitivity when behind pace (0-1, default 0.25)'],
    ['- You need one row per room/month/window combination'],
    [],
    ['room_code', 'month', 'lead_window', 'expected_otb_occ', 'pace_sensitivity_up', 'pace_sensitivity_down'],
    ['SAND', 1, 'long_term', 0.30, 0.25, 0.25],
    ['SAND', 1, 'medium_term', 0.45, 0.25, 0.25],
    ['SAND', 1, 'short_term', 0.60, 0.25, 0.25],
    ['SAND', 1, 'walk_in', 0.75, 0.25, 0.25],
    ['SAND', 1, 'last_minute', 0.85, 0.25, 0.25],
    ['SEA', 7, 'long_term', 0.50, 0.25, 0.25],
    ['SEA', 7, 'medium_term', 0.65, 0.25, 0.25],
    ['SEA', 7, 'short_term', 0.75, 0.25, 0.25],
    ['SEA', 7, 'walk_in', 0.85, 0.25, 0.25],
    ['SEA', 7, 'last_minute', 0.90, 0.25, 0.25],
  ];

  const paceWS = XLSX.utils.aoa_to_sheet(paceData);
  paceWS['!cols'] = [
    { wch: 12 }, // room_code
    { wch: 8 },  // month
    { wch: 15 }, // lead_window
    { wch: 18 }, // expected_otb_occ
    { wch: 20 }, // pace_sensitivity_up
    { wch: 20 }  // pace_sensitivity_down
  ];

  XLSX.utils.book_append_sheet(workbook, paceWS, 'Pace Curves');

  // Download
  XLSX.writeFile(workbook, 'sojourn_pricing_targets_template.xlsx');
  console.log('✅ Template downloaded');
}

async function processTargetsUpload(modelId, roomTypes) {
  const fileInput = el('upload-targets-excel');
  const file = fileInput?.files[0];
  
  if (!file) {
    alert('Please select a file first');
    return;
  }

  const resultsDiv = el('upload-results');
  resultsDiv.style.display = 'block';
  resultsDiv.innerHTML = '<div style="padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;color:#0c4a6e">⏳ Processing file...</div>';

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    let targetsSuccess = 0;
    let targetsErrors = [];
    let paceSuccess = 0;
    let paceErrors = [];

    const hasTargetsSheet = workbook.SheetNames.includes('Targets');
    const hasPaceSheet = workbook.SheetNames.includes('Pace Curves');

    // Process Targets Sheet
    if (hasTargetsSheet) {
      const targetsSheet = workbook.Sheets['Targets'];
      const targetsJson = XLSX.utils.sheet_to_json(targetsSheet);

      // Parse and validate all rows first
      const validTargets = [];
      for (const row of targetsJson) {
        // Skip instruction rows
        if (!row.month) continue;

        // Find room type ID
        let roomTypeId = null;
        if (row.room_code) {
          const rt = roomTypes.find(r => r.code?.toUpperCase() === row.room_code.toString().toUpperCase());
          if (!rt) {
            targetsErrors.push(`Unknown room code: ${row.room_code}`);
            continue;
          }
          roomTypeId = rt.id;
        }

        // Build target data
        const targetData = {
          pricing_model_id: modelId,
          room_type_id: roomTypeId,
          month: parseInt(row.month),
          target_occupancy: parseFloat(row.target_occupancy),
          target_revpan: row.target_revpan ? parseFloat(row.target_revpan) : null,
          sensitivity_up: parseFloat(row.sensitivity_up || 0.25),
          sensitivity_down: parseFloat(row.sensitivity_down || 0.25),
          is_active: true
        };

        // Validate month
        if (targetData.month < 1 || targetData.month > 12) {
          targetsErrors.push(`Invalid month: ${row.month}. Must be 1-12`);
          continue;
        }

        // Validate occupancy
        if (isNaN(targetData.target_occupancy) || targetData.target_occupancy < 0 || targetData.target_occupancy > 1) {
          targetsErrors.push(`Invalid target_occupancy: ${row.target_occupancy}. Must be 0-1`);
          continue;
        }

        validTargets.push(targetData);
      }

      // Delete existing targets for this model, then insert new ones
      if (validTargets.length > 0) {
        const { error: deleteError } = await supabase
          .from('pricing_targets')
          .delete()
          .eq('pricing_model_id', modelId);

        if (deleteError) {
          targetsErrors.push(`Failed to clear existing targets: ${deleteError.message}`);
        } else {
          const { error: insertError } = await supabase
            .from('pricing_targets')
            .insert(validTargets);

          if (insertError) {
            targetsErrors.push(`Failed to insert targets: ${insertError.message}`);
          } else {
            targetsSuccess = validTargets.length;
          }
        }
      }
    }

    // Process Pace Curves Sheet
    if (hasPaceSheet) {
      const paceSheet = workbook.Sheets['Pace Curves'];
      const paceJson = XLSX.utils.sheet_to_json(paceSheet);

      // Parse and validate all rows first
      const validPaceCurves = [];
      for (const row of paceJson) {
        // Skip instruction rows
        if (!row.room_code || !row.month || !row.lead_window) continue;

        // Find room type ID (required for pace curves)
        const rt = roomTypes.find(r => r.code?.toUpperCase() === row.room_code.toString().toUpperCase());
        if (!rt) {
          paceErrors.push(`Unknown room code: ${row.room_code}`);
          continue;
        }

        // Build pace curve data
        const paceData = {
          pricing_model_id: modelId,
          room_type_id: rt.id,
          month: parseInt(row.month),
          lead_window: row.lead_window?.toString().trim().toLowerCase(),
          expected_otb_occ: parseFloat(row.expected_otb_occ),
          pace_sensitivity_up: parseFloat(row.pace_sensitivity_up || 0.25),
          pace_sensitivity_down: parseFloat(row.pace_sensitivity_down || 0.25),
          is_active: true
        };

        // Validate month
        if (paceData.month < 1 || paceData.month > 12) {
          paceErrors.push(`Invalid month: ${row.month}. Must be 1-12`);
          continue;
        }

        // Validate lead_window
        const validWindows = ['last_minute', 'walk_in', 'short_term', 'medium_term', 'long_term'];
        if (!validWindows.includes(paceData.lead_window)) {
          paceErrors.push(`Invalid lead_window: "${row.lead_window}". Must be one of: ${validWindows.join(', ')}`);
          continue;
        }

        // Validate expected_otb_occ
        if (isNaN(paceData.expected_otb_occ) || paceData.expected_otb_occ < 0 || paceData.expected_otb_occ > 1) {
          paceErrors.push(`Invalid expected_otb_occ: ${row.expected_otb_occ}. Must be 0-1`);
          continue;
        }

        validPaceCurves.push(paceData);
      }

      // Delete existing pace curves for this model, then insert new ones
      if (validPaceCurves.length > 0) {
        const { error: deleteError } = await supabase
          .from('pricing_pace_curves')
          .delete()
          .eq('pricing_model_id', modelId);

        if (deleteError) {
          paceErrors.push(`Failed to clear existing pace curves: ${deleteError.message}`);
        } else {
          const { error: insertError } = await supabase
            .from('pricing_pace_curves')
            .insert(validPaceCurves);

          if (insertError) {
            paceErrors.push(`Failed to insert pace curves: ${insertError.message}`);
          } else {
            paceSuccess = validPaceCurves.length;
          }
        }
      }
    }

    // Display results
    let html = '<div style="padding:16px;background:white;border:1px solid #e5e7eb;border-radius:8px">';
    
    if (targetsSuccess > 0) {
      html += `<div style="padding:12px;margin-bottom:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;color:#166534">
        ✅ Successfully imported ${targetsSuccess} target(s)
      </div>`;
    }
    
    if (paceSuccess > 0) {
      html += `<div style="padding:12px;margin-bottom:8px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;color:#166534">
        ✅ Successfully imported ${paceSuccess} pace curve(s)
      </div>`;
    }
    
    if (targetsErrors.length > 0) {
      html += `<div style="padding:12px;margin-bottom:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b">
        ❌ Target errors:<br>
        <ul style="margin:8px 0 0 0;padding-left:20px;font-size:12px">
          ${targetsErrors.slice(0, 10).map(e => `<li>${e}</li>`).join('')}
          ${targetsErrors.length > 10 ? `<li>...and ${targetsErrors.length - 10} more</li>` : ''}
        </ul>
      </div>`;
    }
    
    if (paceErrors.length > 0) {
      html += `<div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b">
        ❌ Pace curve errors:<br>
        <ul style="margin:8px 0 0 0;padding-left:20px;font-size:12px">
          ${paceErrors.slice(0, 10).map(e => `<li>${e}</li>`).join('')}
          ${paceErrors.length > 10 ? `<li>...and ${paceErrors.length - 10} more</li>` : ''}
        </ul>
      </div>`;
    }
    
    html += '</div>';
    
    resultsDiv.innerHTML = html;

    // Reset file input
    fileInput.value = '';
    el('process-targets-upload').style.display = 'none';

    // Refresh the displays
    if (targetsSuccess > 0 || paceSuccess > 0) {
      setTimeout(() => {
        if (targetsSuccess > 0) renderTargets(modelId, roomTypes);
        if (paceSuccess > 0) renderPaceCurves(modelId, roomTypes);
      }, 2000);
    }

  } catch (error) {
    resultsDiv.innerHTML = `<div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b">
      ❌ Error processing file: ${error.message}
    </div>`;
    console.error('Upload error:', error);
  }
}