// src/pricing-model/pricing_model.js
// Main coordinator - shared state and navigation only

import { supabase } from '../config/supabase';
import { initConfigurationTab } from './pricing-configuration';
import { initSimulatorTab } from './pricing-simulator';
import { initRevenueModelTab } from './revenue-model';

// Add mobile-responsive styles
const mobileStyles = `
<style>
  @media (max-width: 768px) {
    .pricing-header {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 16px !important;
    }
    
    .pricing-header > div:first-child {
      width: 100%;
    }
    
    .pricing-header select {
      width: 100% !important;
      font-size: 16px !important;
    }
    
    .chart-controls {
      width: 100%;
      display: flex;
      gap: 8px;
    }
    
    .chart-btn {
      flex: 1;
      font-size: 11px !important;
      padding: 10px 8px !important;
      white-space: nowrap;
    }
  }
  
  @media (max-width: 480px) {
    .chart-btn {
      font-size: 10px !important;
      padding: 8px 6px !important;
    }
  }
</style>
`;

// ===== SHARED MODAL HELPERS (used across Pricing Model tabs) =====
export function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.remove();
}

export function openSharedModal({
  id,
  title,
  subtitle,
  bodyHtml = '',
  footerHtml = '',
  onMount = () => {}
}) {
  // Remove any existing modal with same id
  closeModal(id);

  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'modal-backdrop';
  wrap.style.cssText =
    'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  document.body.appendChild(wrap);

  // Click outside closes
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) wrap.remove();
  });

  wrap.innerHTML = `
    <div class="modal-dialog" style="background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="hd" style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div style="min-width:0">
            <h3 style="margin:0;color:white;font-size:20px;font-weight:700;">${title || ''}</h3>
            ${subtitle ? `<p style="margin:4px 0 0 0;color:rgba(255,255,255,0.9);font-size:13px;">${subtitle}</p>` : ''}
          </div>
          <button type="button" aria-label="Close" class="btn" data-modal-close style="background:transparent;border:none;color:white;font-size:26px;line-height:1;cursor:pointer;padding:0 6px;">
            ×
          </button>
        </div>
      </div>

      <div class="bd" style="padding:24px;overflow-y:auto;flex:1;">
        ${bodyHtml}
      </div>

      <div class="ft" style="padding:20px 24px;border-top:2px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;flex-wrap:wrap;">
        ${footerHtml}
      </div>
    </div>
  `;

  // CRITICAL: Force width on mobile with JavaScript (overrides everything)
  const modalDialog = wrap.querySelector('.modal-dialog');
  if (modalDialog && window.innerWidth <= 768) {
    modalDialog.style.maxWidth = 'calc(100vw - 20px)';
    modalDialog.style.width = 'calc(100vw - 20px)';
    modalDialog.style.minWidth = '0';
    modalDialog.style.margin = '0 auto';
    modalDialog.style.boxSizing = 'border-box';
  }

  // Wire close button
  wrap.querySelector('[data-modal-close]')?.addEventListener('click', () => wrap.remove());

  // Let caller attach listeners
  onMount(wrap);

  return wrap;
}

export async function initPricingModel() {
  const view = document.getElementById('view-pricing-model');
  if (!view) return;
  
  // Ensure viewport meta tag exists
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
  }
  
  // Inject mobile styles
  if (!document.getElementById('pricing-model-mobile-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'pricing-model-mobile-styles';
    styleEl.textContent = mobileStyles.replace(/<\/?style>/g, '');
    document.head.appendChild(styleEl);
  }

  // Shared state
  let roomTypes = [];
  let pricingModels = [];
  let activeModelId = null;
  let viewMode = 'simulator';

  // Layout
  view.innerHTML = `
    <div class="pricing-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;flex-wrap:wrap;gap:16px;padding:20px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1)">
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:0.5px">Active Pricing Model</label>
        <select id="pm-model-select" class="select" style="min-width:320px;padding:12px 16px;border:2px solid rgba(255,255,255,0.2);border-radius:8px;background:rgba(255,255,255,0.95);font-size:15px;font-weight:600;color:#334155;box-shadow:0 2px 4px rgba(0,0,0,0.1)"></select>
      </div>
      <div class="chart-controls">
        <button class="chart-btn active" id="view-simulator" style="padding:10px 20px">📊 Simulator</button>
        <button class="chart-btn" id="view-configuration" style="padding:10px 20px">⚙️ Configuration</button>
        <button class="chart-btn" id="view-revenue-model" style="padding:10px 20px">💰 Revenue Model</button>
      </div>
    </div>
    <div id="pricing-content"></div>
  `;

  async function loadData() {
    const { data: rt } = await supabase.from('room_types').select('*').order('code');
    roomTypes = rt || [];
    const { data: pm } = await supabase.from('pricing_models').select('*').order('created_at', { ascending: false });
    pricingModels = pm || [];
    activeModelId = pricingModels.find(m => m.is_active)?.id || pricingModels[0]?.id;
    renderModelSelector();
  }

  function renderModelSelector() {
    const select = document.getElementById('pm-model-select');
    if (!select) return;
    select.innerHTML = pricingModels.map(m => `<option value="${m.id}">${m.name}${m.is_active ? ' (active)' : ''}</option>`).join('');
    if (activeModelId) select.value = activeModelId;
  }

  function switchTab(mode) {
    viewMode = mode;
    document.querySelectorAll('.chart-btn').forEach((btn, i) => {
      btn.classList.toggle('active', ['simulator', 'configuration', 'revenue-model'][i] === mode);
    });
    renderTab();
  }

  function renderTab() {
    const container = document.getElementById('pricing-content');
    if (viewMode === 'simulator') initSimulatorTab(container, { activeModelId, pricingModels, roomTypes });
    else if (viewMode === 'configuration') initConfigurationTab(container, { activeModelId, pricingModels, roomTypes, onDataChange: loadData });
    else initRevenueModelTab(container, { roomTypes, activeModelId });
  }

  document.getElementById('view-simulator')?.addEventListener('click', () => switchTab('simulator'));
  document.getElementById('view-configuration')?.addEventListener('click', () => switchTab('configuration'));
  document.getElementById('view-revenue-model')?.addEventListener('click', () => switchTab('revenue-model'));
  document.getElementById('pm-model-select')?.addEventListener('change', (e) => { activeModelId = e.target.value; renderTab(); });

  await loadData();
  renderTab();
}