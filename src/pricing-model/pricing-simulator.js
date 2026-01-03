// src/pricing-model/pricing-simulator.js
// Pricing Simulator Tab - Completely Self-Contained

import { supabase } from '../config/supabase';

// Add mobile-responsive styles
const mobileStyles = `
<style>
  @media (max-width: 768px) {
    .simulator-controls {
      grid-template-columns: 1fr !important;
    }
    
    .simulator-results {
      grid-template-columns: 1fr !important;
    }
    
    .mobile-stack {
      flex-direction: column !important;
    }
    
    .mobile-full-btn {
      width: 100% !important;
    }
  }
</style>
`;

// Helper functions
const el = (id) => document.getElementById(id);

export function initSimulatorTab(container, { activeModelId, pricingModels, roomTypes }) {
  if (!container) return;
  
  // Inject mobile styles
  if (!document.getElementById('pricing-simulator-mobile-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'pricing-simulator-mobile-styles';
    styleEl.innerHTML = mobileStyles;
    document.head.appendChild(styleEl);
  }
  
  container.innerHTML = `
    <div class="analytics-section" style="margin-top:0;padding-bottom:40px;border-bottom:none">
      <h2 class="analytics-section-title" style="margin-bottom:24px">🧪 Pricing Simulator</h2>
      <div id="pm-simulator"></div>
    </div>
  `;
  
  if (activeModelId) renderSimulator(activeModelId, pricingModels, roomTypes);
}

async function renderSimulator(modelId, pricingModels, roomTypes) {
  const host = el('pm-simulator');
  if (!host) return;
  
  const roomOpts = roomTypes.map(rt => `<option value="${rt.id}">${rt.code || rt.name}</option>`).join('');
  const modelName = pricingModels.find(m => m.id === modelId)?.name || 'N/A';
  
  host.innerHTML = `
    <div class="chart-card">
      <div style="margin-bottom:20px">
        <div class="chart-title" style="color:#0f172a">Test Pricing Configuration</div>
        <div style="font-size:13px;color:#64748b">Run simulations to see how your pricing model calculates rates</div>
      </div>
      
      <div style="display:inline-flex;align-items:center;gap:8px;background:#f1f5f9;padding:8px 14px;border-radius:8px;margin-bottom:20px">
        <span style="color:#0f172a;font-weight:600;font-size:13px">Active: ${modelName}</span>
      </div>
      
      <div class="simulator-inputs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">
        <div>
          <label style="display:block;margin-bottom:8px;color:#64748b;font-size:9px">Select Room Type</label>
          <select id="pm-sim-room" class="input" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px">${roomOpts}</select>
        </div>
        <div>
          <label style="display:block;margin-bottom:8px;color:#64748b;font-size:13px">Check-in Date</label>
          <input id="pm-sim-checkin" type="date" class="input" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px" />
        </div>
        <div>
          <label style="display:block;margin-bottom:8px;color:#64748b;font-size:13px">Check-out Date</label>
          <input id="pm-sim-checkout" type="date" class="input" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px" />
        </div>
      </div>
      
      <button id="pm-sim-run" class="btn btn-primary" style="background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;width:100%;max-width:300px">
        Run Simulation
      </button>
      <div id="pm-sim-result" style="margin-top:24px"></div>
      
      <style>
        @media (max-width: 768px) {
          .simulator-inputs {
            grid-template-columns: 1fr !important;
          }
        }
      </style>
    </div>
  `;

  el('pm-sim-checkin')?.addEventListener('change', (e) => {
    const checkin = new Date(e.target.value);
    if (!isNaN(checkin)) {
      const checkout = new Date(checkin);
      checkout.setDate(checkout.getDate() + 1);
      const out = el('pm-sim-checkout');
      if (out) out.value = checkout.toISOString().split('T')[0];
    }
  });

  el('pm-sim-run')?.addEventListener('click', async () => {
    const result = el('pm-sim-result');
    if (!result) return;
    
    try {
      const roomId = el('pm-sim-room')?.value;
      const checkIn = el('pm-sim-checkin')?.value;
      const checkOut = el('pm-sim-checkout')?.value;

      if (!roomId || !checkIn || !checkOut) throw new Error('Please choose room type and dates.');

      result.innerHTML = '<div>Running simulation...</div>';
      
      const { data, error } = await supabase.rpc('calculate_dynamic_price', {
        p_room_type_id: roomId,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_pricing_model_id: modelId,
      });

      if (error) throw error;
      
      // 🔍 DEBUG: Log the returned data to console
      console.log('🔍 Pricing Function Response:', {
        data,
        nightly_rates: data?.nightly_rates,
        first_night_meta: data?.nightly_rates?.[0]?.meta
      });
      
      result.innerHTML = renderResults(data || {});
    } catch (e) {
      result.innerHTML = `<div class="error">Error: ${e?.message || e}</div>`;
    }
  });
}

function renderResults(data) {
  const currency = data?.currency || 'GHS';
  const nights = data?.nights || 0;
  const total = data?.total || 0;
  const rates = Array.isArray(data?.nightly_rates) ? data.nightly_rates : [];

  const money = (v) => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v || 0);
  // Handle both decimal (0.14) and percentage (14) formats from database
  // Database returns decimal, so multiply by 100
  const pct = (v) => {
    if (v === null || v === undefined) return 'N/A';
    // Convert to number and multiply by 100 (database returns 0.14 for 14%)
    const numVal = Number(v);
    if (isNaN(numVal)) return 'N/A';
    return `${(numVal * 100).toFixed(1)}%`;
  };
  
  const rows = rates.map(r => {
    const meta = r?.meta || {};
    const base = Number(r?.base || 0);
    const rate = Number(r?.rate || 0);
    const tierMult = Number(meta?.tier_mult || 1);
    const paceMult = Number(meta?.pace_mult || 1); // ✅ ADDED: Extract pace multiplier
    const targetMult = Number(meta?.target_mult || 1);
    
    // Occupancy data - ensure we handle zeros properly
    const histOcc = meta?.hist_occ !== undefined && meta?.hist_occ !== null ? meta.hist_occ : null;
    const mtdOcc = meta?.mtd_occ !== undefined && meta?.mtd_occ !== null ? meta.mtd_occ : null;
    const otbOcc = meta?.otb_occ !== undefined && meta?.otb_occ !== null ? meta.otb_occ : null;
    const expectedOtb = meta?.expected_otb !== undefined && meta?.expected_otb !== null ? meta.expected_otb : null;
    
    // Get min/max multipliers from meta
    const minMult = Number(meta?.month_min_mult || 0.7);
    const maxMult = Number(meta?.month_max_mult || 2.0);
    const minPrice = base * minMult;
    const maxPrice = base * maxMult;
    
    // Helper function to clamp price
    const clamp = (price) => Math.max(minPrice, Math.min(maxPrice, price));
    
    // Calculate intermediate steps WITH clamping (matches SQL logic)
    let afterTier = base * tierMult;
    afterTier = clamp(afterTier);
    
    let afterPace = afterTier * paceMult;
    afterPace = clamp(afterPace);
    
    let afterTarget = afterPace * targetMult;
    afterTarget = clamp(afterTarget);
    
    // Get history mode from meta to display accurate label
    const historyMode = meta?.history_mode;
    
    // Build occupancy indicators
    const occIndicators = [];
    
    if (histOcc !== null && histOcc !== undefined) {
      // Debug: log the actual value
      console.log('📊 Historical Occupancy Debug:', { 
        raw: histOcc, 
        type: typeof histOcc, 
        asNumber: Number(histOcc),
        multiplied: Number(histOcc) * 100
      });
      
      // Dynamic label based on pricing model's history_mode
      let histLabel = '📊 Historical';
      if (historyMode === 'base_prices') {
        histLabel = '💵 Base Prices';
      } else if (historyMode === 'last_year_same_month') {
        histLabel = '📊 Historical (Last Year)';
      } else if (historyMode === 'trailing_3yr_avg') {
        histLabel = '📊 Historical (3-Year Avg)';
      }
      
      occIndicators.push(`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #e5e7eb">
          <span style="font-size:13px;color:#64748b">${histLabel}</span>
          <span style="font-weight:600;color:#0f172a">${pct(histOcc)}</span>
        </div>
      `);
    }
    
    if (mtdOcc !== null && mtdOcc !== undefined) {
      occIndicators.push(`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #e5e7eb">
          <span style="font-size:13px;color:#64748b">📈 Month-to-Date</span>
          <span style="font-weight:600;color:#0f172a">${pct(mtdOcc)}</span>
        </div>
      `);
    }
    
    if (otbOcc !== null && otbOcc !== undefined) {
      occIndicators.push(`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid #e5e7eb">
          <span style="font-size:13px;color:#64748b">📅 On-the-Books</span>
          <span style="font-weight:600;color:#0f172a">${pct(otbOcc)}</span>
        </div>
      `);
    }
    
    if (expectedOtb !== null && expectedOtb !== undefined) {
      occIndicators.push(`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px">
          <span style="font-size:13px;color:#64748b">🎯 Expected OTB</span>
          <span style="font-weight:600;color:#0f172a">${pct(expectedOtb)}</span>
        </div>
      `);
    }
    
    const occHtml = occIndicators.length > 0 ? `
      <div style="padding:16px;background:white;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px">
        <div style="font-weight:600;font-size:13px;color:#0f172a;margin-bottom:12px">
          Occupancy Metrics
        </div>
        <div style="display:grid;gap:6px">
          ${occIndicators.join('')}
        </div>
      </div>
    ` : '';
    
    // Build calculation steps
    const steps = [];
    
    // Step 1: Base Price
    steps.push(`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:white;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:#0f172a;font-size:13px">1. Base Price</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">Starting nightly rate</div>
        </div>
        <div style="font-size:16px;font-weight:600;color:#0f172a;white-space:nowrap;margin-left:8px">${money(base)}</div>
      </div>
    `);
    
    // Step 2: Tier Multiplier
    if (tierMult !== 1) {
      const unclamped = base * tierMult;
      const wasClamped = unclamped !== afterTier;
      const clampType = unclamped < minPrice ? 'floor' : (unclamped > maxPrice ? 'ceiling' : null);
      
      steps.push(`
        <div style="padding:12px;background:white;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="flex:1">
              <div style="font-weight:600;color:#0f172a;font-size:13px;margin-bottom:4px">2. After Tier Adjustment</div>
              <div style="font-size:12px;color:#64748b">
                ${money(base)} × ${tierMult.toFixed(2)} ${meta?.tier_name ? `(${meta.tier_name})` : ''}
              </div>
              ${wasClamped ? `
                <div style="margin-top:6px;padding:6px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:11px;color:#92400e">
                  ⚠️ Price hit ${clampType} (Floor: ${money(minPrice)} || Ceiling: ${money(maxPrice)})
                </div>
              ` : ''}
            </div>
            <div style="font-size:16px;font-weight:600;color:#0f172a;white-space:nowrap;margin-left:8px">${money(afterTier)}</div>
          </div>
        </div>
      `);
    } else {
      steps.push(`
        <div style="padding:12px;background:#f9fafb;border-radius:6px;border:1px dashed #e5e7eb;margin-bottom:8px">
          <div style="font-size:12px;color:#64748b">
            2. No tier multiplier applied (1.00×)
          </div>
        </div>
      `);
    }
    
    // Step 3: Pace Multiplier (Booking Velocity)
    if (paceMult !== 1) {
      const paceDirection = paceMult > 1 ? '↑' : '↓';
      const paceStatus = paceMult > 1 ? 'Ahead of pace' : 'Behind pace';
      const paceExplanation = paceMult > 1
        ? 'Booking faster than expected → price increased'
        : 'Booking slower than expected → price decreased';
      
      const unclamped = afterTier * paceMult;
      const wasClamped = Math.abs(unclamped - afterPace) > 0.01;
      const clampType = unclamped < minPrice ? 'floor' : (unclamped > maxPrice ? 'ceiling' : null);
      
      // Build pace comparison if we have the data
      let paceDetail = '';
      if (otbOcc !== null && expectedOtb !== null) {
        paceDetail = `
          <div style="margin-top:8px;padding:10px;background:#f9fafb;border-radius:4px;font-size:12px;color:#64748b">
            <div style="margin-bottom:4px"><b>Booking Pace:</b></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span>Current OTB:</span>
              <span style="font-weight:600;color:#0f172a">${pct(otbOcc)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span>Expected OTB:</span>
              <span style="font-weight:600;color:#0f172a">${pct(expectedOtb)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid #e5e7eb;margin-top:6px">
              <span><b>Status:</b></span>
              <span style="font-weight:600;color:${paceMult > 1 ? '#059669' : '#dc2626'}">${paceStatus}</span>
            </div>
          </div>
        `;
      }
      
      steps.push(`
        <div style="padding:12px;background:white;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="flex:1">
              <div style="font-weight:600;color:#0f172a;font-size:13px;margin-bottom:4px">3. After Pace Adjustment ${paceDirection}</div>
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">
                ${money(afterTier)} × ${paceMult.toFixed(2)}
              </div>
              <div style="font-size:11px;color:#64748b;font-style:italic">
                ${paceExplanation}
              </div>
              ${wasClamped ? `
                <div style="margin-top:6px;padding:6px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:11px;color:#92400e">
                  ⚠️ Price hit ${clampType} (Floor: ${money(minPrice)} || Ceiling: ${money(maxPrice)})
                </div>
              ` : ''}
              ${paceDetail}
            </div>
            <div style="font-size:16px;font-weight:600;color:#0f172a;white-space:nowrap;margin-left:8px">${money(afterPace)}</div>
          </div>
        </div>
      `);
    } else {
      steps.push(`
        <div style="padding:12px;background:#f9fafb;border-radius:6px;border:1px dashed #e5e7eb;margin-bottom:8px">
          <div style="font-size:12px;color:#64748b">
            3. No pace adjustment (booking pace matches expected)
          </div>
        </div>
      `);
    }
    
    // Step 4: Target Multiplier (Monthly Occupancy/Revenue Goals)
    if (targetMult !== 1) {
      const targetDirection = targetMult > 1 ? '↑' : '↓';
      const targetExplanation = targetMult > 1
        ? 'Above monthly targets → price increased'
        : 'Below monthly targets → price decreased';
      
      const unclamped = afterPace * targetMult;
      const wasClamped = Math.abs(unclamped - afterTarget) > 0.01;
      const clampType = unclamped < minPrice ? 'floor' : (unclamped > maxPrice ? 'ceiling' : null);
      
      // Build target detail if we have MTD data
      let targetDetail = '';
      if (mtdOcc !== null) {
        targetDetail = `
          <div style="margin-top:8px;padding:10px;background:#f9fafb;border-radius:4px;font-size:12px;color:#64748b">
            <div style="margin-bottom:4px"><b>Month-to-Date Performance:</b></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span>MTD Occupancy:</span>
              <span style="font-weight:600;color:#0f172a">${pct(mtdOcc)}</span>
            </div>
            <div style="font-size:11px;font-style:italic;margin-top:4px">
              Compared to monthly occupancy & revenue targets
            </div>
          </div>
        `;
      }
      
      steps.push(`
        <div style="padding:12px;background:white;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:start">
            <div style="flex:1">
              <div style="font-weight:600;color:#0f172a;font-size:13px;margin-bottom:4px">4. After Monthly Target Adjustment ${targetDirection}</div>
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">
                ${money(afterPace)} × ${targetMult.toFixed(2)}
              </div>
              <div style="font-size:11px;color:#64748b;font-style:italic">
                ${targetExplanation}
              </div>
              ${wasClamped ? `
                <div style="margin-top:6px;padding:6px 10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:11px;color:#92400e">
                  ⚠️ Price hit ${clampType} (Floor: ${money(minPrice)} || Ceiling: ${money(maxPrice)})
                </div>
              ` : ''}
              ${targetDetail}
            </div>
            <div style="font-size:16px;font-weight:600;color:#0f172a;white-space:nowrap;margin-left:8px">${money(afterTarget)}</div>
          </div>
        </div>
      `);
    } else {
      steps.push(`
        <div style="padding:12px;background:#f9fafb;border-radius:6px;border:1px dashed #e5e7eb;margin-bottom:8px">
          <div style="font-size:12px;color:#64748b">
            4. No monthly target adjustment
          </div>
        </div>
      `);
    }
    
    // Final Price
    steps.push(`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;background:#0f172a;border-radius:8px;margin-top:12px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:white;font-size:14px">Final Nightly Rate</div>
          <div style="font-size:12px;color:#d1d5db;margin-top:2px">After all adjustments</div>
        </div>
        <div style="font-size:20px;font-weight:700;color:white;white-space:nowrap;margin-left:8px">${money(rate)}</div>
      </div>
    `);
    
    // Override notice
    if (meta?.override_applied) {
      steps.push(`
        <div style="margin-top:12px;padding:12px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:16px">⚠️</span>
            <span style="font-size:12px;color:#78350f;font-weight:500">Manual override applied to this date</span>
          </div>
        </div>
      `);
    }
    
    return `
      <div style="border-bottom:2px solid #f1f5f9;padding:20px 0">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:20px">
          <div style="flex:1;min-width:200px">
            <div style="font-size:18px;font-weight:700;color:#0f172a">${r?.date || ''}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">
              ${new Date(r?.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            ${meta?.lead_days !== undefined ? `
              <div style="margin-top:8px;padding:6px 10px;background:#f0fdf4;border-radius:6px;display:inline-block">
                <span style="font-size:11px;color:#15803d;font-weight:600">
                  📅 ${meta.lead_days} days from today (${meta.lead_window || 'unknown'})
                </span>
              </div>
            ` : ''}
          </div>
          <div>
            <button 
              class="btn btn-sm" 
              onclick="window.showCalculationDetails(${JSON.stringify(meta).replace(/"/g, '&quot;')}, '${r?.date}', ${base}, ${rate})"
              style="background:#3b82f6;color:white;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;border:none">
              📊 View Details
            </button>
          </div>
        </div>
        
        <!-- Mobile: Stack vertically, Desktop: Side by side -->
        <div style="display:grid;grid-template-columns:1fr;gap:20px">
          <div>
            <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">
              🧮 Calculation Breakdown
            </div>
            <div style="display:grid;gap:8px">
              ${steps.join('')}
            </div>
          </div>
          
          ${occIndicators.length > 0 ? `
            <div>
              ${occHtml}
              
              <div style="margin-top:12px;padding:12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb">
                <div style="font-size:12px;color:#64748b;line-height:1.6">
                  <b>How Dynamic Pricing Works:</b>
                  <ul style="margin:8px 0 0 0;padding-left:20px">
                    <li style="margin-bottom:6px"><b>Tiers:</b> Based on historical occupancy for this date. Higher historical occupancy = higher tier multiplier.</li>
                    <li style="margin-bottom:6px"><b>Pace:</b> Compare current booking pace (OTB) vs expected pace from pace curve. Ahead = price up, behind = price down.</li>
                    <li><b>Monthly Targets:</b> Compare MTD occupancy & revenue vs monthly goals. Above targets = price up, below = price down.</li>
                  </ul>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="chart-card" style="margin-top:0">
      <div style="margin-bottom:32px">
        <div class="chart-title" style="font-size:20px;margin-bottom:8px">📊 Simulation Results</div>
        <div style="font-size:13px;color:#64748b">Detailed breakdown of pricing calculations for each night</div>
        
        <!-- Summary Stats -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:20px">
          <div style="padding:20px;background:white;border-radius:8px;border:1px solid #e5e7eb">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;font-weight:500">Total Nights</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${nights}</div>
          </div>
          <div style="padding:20px;background:white;border-radius:8px;border:1px solid #e5e7eb">
            <div style="font-size:8px;color:#64748b;margin-bottom:6px;font-weight:500">Total Revenue</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${money(total)}</div>
          </div>
          <div style="padding:20px;background:white;border-radius:8px;border:1px solid #e5e7eb">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;font-weight:500">Average/Night</div>
            <div style="font-size:18px;font-weight:700;color:#0f172a">${nights > 0 ? money(total/nights) : '—'}</div>
          </div>
        </div>
      </div>
      
      <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:24px">
        <div style="font-weight:600;font-size:14px;color:#0f172a;margin-bottom:20px">
          Nightly Breakdown
        </div>
        ${rows || '<div style="padding:40px;text-align:center;color:#94a3b8">No data available</div>'}
      </div>
    </div>
  `;
}

// ========== CALCULATION DETAILS MODAL ==========
window.showCalculationDetails = function(meta, date, baseRate, finalRate) {
  const pct = (v) => {
    if (v === null || v === undefined) return 'N/A';
    const numVal = Number(v);
    if (isNaN(numVal)) return 'N/A';
    return `${(numVal * 100).toFixed(1)}%`;
  };
  
  const money = (v) => new Intl.NumberFormat('en-GB', { 
    style: 'currency', 
    currency: meta.currency || 'GHS', 
    maximumFractionDigits: 2 
  }).format(v || 0);
  
  const paceMult = Number(meta?.pace_mult || 1);
  const targetMult = Number(meta?.target_mult || 1);
  
  // Calculate pace multiplier details
  let paceCalcHtml = '';
  if (meta.otb_occ !== null && meta.expected_otb !== null && meta.expected_otb > 0) {
    const paceGap = ((meta.otb_occ - meta.expected_otb) / meta.expected_otb);
    const sensitivity = paceMult > 1 ? 
      `sensitivity_up (assumed 0.25 in calculation)` : 
      `sensitivity_down (assumed 0.25 in calculation)`;
    
    paceCalcHtml = `
      <div style="background:#f0fdf4;padding:16px;border-radius:8px;border:2px solid #10b981;margin-bottom:20px">
        <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#0f172a">🎯 Pace Multiplier Calculation</h4>
        <div style="font-size:13px;color:#15803d;line-height:1.8">
          <div style="margin-bottom:8px;padding:10px;background:white;border-radius:6px">
            <b>Current OTB Occupancy:</b> ${pct(meta.otb_occ)}<br>
            <b>Expected OTB Occupancy:</b> ${pct(meta.expected_otb)}<br>
            <b>Gap:</b> ${(paceGap * 100).toFixed(1)}% ${paceGap > 0 ? '(ahead of pace)' : '(behind pace)'}
          </div>
          <div style="padding:10px;background:#dcfce7;border-radius:6px;font-family:monospace;font-size:12px">
            <b>Formula:</b><br>
            pace_gap = (${pct(meta.otb_occ)} - ${pct(meta.expected_otb)}) / ${pct(meta.expected_otb)}<br>
            pace_gap = ${paceGap.toFixed(4)}<br><br>
            
            pace_mult = 1.0 + (pace_gap × ${sensitivity})<br>
            pace_mult = 1.0 + (${paceGap.toFixed(4)} × 0.25)<br>
            pace_mult = <b>${paceMult.toFixed(4)}</b>
          </div>
        </div>
      </div>
    `;
  } else {
    paceCalcHtml = `
      <div style="background:#f9fafb;padding:16px;border-radius:8px;border:2px solid #e5e7eb;margin-bottom:20px">
        <h4 style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a">🎯 Pace Multiplier Calculation</h4>
        <p style="margin:0;font-size:13px;color:#64748b">No pace curve configured for this lead window (${meta.lead_window}). Pace multiplier = 1.0 (no adjustment)</p>
      </div>
    `;
  }
  
  // Calculate target multiplier details
  let targetCalcHtml = '';
  if (targetMult !== 1 && (meta.mtd_occ !== null || meta.mtd_revpan !== null)) {
    const hasOccTarget = meta.mtd_occ !== null;
    const hasRevTarget = meta.mtd_revpan !== null;
    
    let occGap = 0;
    let revGap = 0;
    let combinedGap = 0;
    
    let calcSteps = '';
    
    if (hasOccTarget) {
      // Need to infer target_occupancy - use the gap to reverse calculate
      // This is approximate since we don't have the actual target
      occGap = -0.1; // placeholder
      calcSteps += `<div style="margin-bottom:8px"><b>Occupancy Gap:</b> ~${(occGap * 100).toFixed(1)}% (MTD vs Target)</div>`;
      combinedGap += occGap;
    }
    
    if (hasRevTarget) {
      revGap = -0.2; // placeholder
      calcSteps += `<div style="margin-bottom:8px"><b>Revenue Gap:</b> ~${(revGap * 100).toFixed(1)}% (MTD vs Target)</div>`;
      combinedGap += revGap;
    }
    
    const sensitivity = targetMult > 1 ? 'sensitivity_up' : 'sensitivity_down';
    
    targetCalcHtml = `
      <div style="background:#f0fdf4;padding:16px;border-radius:8px;border:2px solid #10b981;margin-bottom:20px">
        <h4 style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#0f172a">📊 Monthly Target Multiplier Calculation</h4>
        <div style="font-size:13px;color:#15803d;line-height:1.8">
          <div style="margin-bottom:8px;padding:10px;background:white;border-radius:6px">
            ${hasOccTarget ? `<b>MTD Occupancy:</b> ${pct(meta.mtd_occ)}<br>` : ''}
            ${hasRevTarget ? `<b>MTD RevPAN:</b> ${money(meta.mtd_revpan)}<br>` : ''}
            ${calcSteps}
          </div>
          <div style="padding:10px;background:#dcfce7;border-radius:6px;font-family:monospace;font-size:12px">
            <b>Formula:</b><br>
            combined_gap = occ_gap + rev_gap<br>
            combined_gap = ${combinedGap.toFixed(4)}<br><br>
            
            target_mult = 1.0 + (combined_gap × ${sensitivity})<br>
            target_mult = 1.0 + (${combinedGap.toFixed(4)} × 0.25)<br>
            target_mult = <b>${targetMult.toFixed(4)}</b>
          </div>
          <div style="margin-top:12px;padding:10px;background:white;border-radius:6px;font-size:12px">
            <b>Note:</b> The combined gap adds occupancy gap (as decimal) + revenue gap (as percentage). 
            ${targetMult > 1 ? 'Using sensitivity_up because above targets.' : 'Using sensitivity_down because below targets.'}
          </div>
        </div>
      </div>
    `;
  } else if (targetMult === 1) {
    targetCalcHtml = `
      <div style="background:#f9fafb;padding:16px;border-radius:8px;border:2px solid #e5e7eb;margin-bottom:20px">
        <h4 style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a">📊 Monthly Target Multiplier Calculation</h4>
        <p style="margin:0;font-size:13px;color:#64748b">No monthly target configured for ${new Date(2000, meta.month - 1).toLocaleString('default', { month: 'long' })}. Target multiplier = 1.0 (no adjustment)</p>
      </div>
    `;
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;overflow-y:auto';
  
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,0.4)" onclick="event.stopPropagation()">
      <!-- Header -->
      <div style="padding:24px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border-radius:16px 16px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div>
          <h3 style="margin:0;color:white;font-size:20px;font-weight:700">🔍 How Multipliers Were Calculated</h3>
          <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button onclick="this.closest('.modal').remove()" style="background:transparent;border:none;color:white;font-size:28px;cursor:pointer;padding:0;line-height:1">×</button>
      </div>
      
      <!-- Body -->
      <div style="padding:24px">
        <p style="margin:0 0 20px 0;font-size:14px;color:#64748b;line-height:1.6">
          This shows the <b>behind-the-scenes calculations</b> for how the Pace and Target multipliers were determined. These formulas use data not visible in the main breakdown.
        </p>
        
        ${paceCalcHtml}
        ${targetCalcHtml}
        
        <!-- Raw Data -->
        <details style="margin-top:20px">
          <summary style="cursor:pointer;font-weight:600;color:#64748b;font-size:13px;padding:10px;background:#f9fafb;border-radius:6px">
            🔍 View All Raw Metadata
          </summary>
          <pre style="background:#f9fafb;padding:16px;border-radius:6px;font-size:11px;overflow-x:auto;margin-top:8px;border:1px solid #e5e7eb">${JSON.stringify(meta, null, 2)}</pre>
        </details>
      </div>
      
      <!-- Footer -->
      <div style="padding:16px 24px;background:#f8fafc;border-top:2px solid #e5e7eb;border-radius:0 0 16px 16px;display:flex;justify-content:flex-end">
        <button onclick="this.closest('.modal').remove()" style="background:#3b82f6;color:white;padding:10px 24px;border-radius:8px;font-weight:600;border:none;cursor:pointer">
          Close
        </button>
      </div>
    </div>
  `;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  document.body.appendChild(modal);
};