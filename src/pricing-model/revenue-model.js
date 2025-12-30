// src/pricing-model/revenue-model.js
// Revenue Model Tab - Revenue Targets & Analysis per Room Type

import { supabase } from '../config/supabase';
import { openSharedModal, closeModal } from './pricing_model';

const el = (id) => document.getElementById(id);

// Add mobile-responsive styles
const mobileStyles = `
<style>
  /* ========================================
     NUCLEAR OVERFLOW PREVENTION - MOBILE
     ======================================== */
  
  /* CRITICAL: Universal box-sizing */
  *, *::before, *::after {
    box-sizing: border-box !important;
  }
  
  /* CRITICAL: Prevent page-level overflow */
  html {
    overflow-x: hidden !important;
    max-width: 100vw !important;
    width: 100vw !important;
  }
  
  body {
    overflow-x: hidden !important;
    max-width: 100vw !important;
    width: 100vw !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* CRITICAL: Every single element respects boundaries */
  div, section, article, main, header, footer,
  table, form, fieldset, select, input, button,
  h1, h2, h3, h4, h5, h6, p, span, label {
    max-width: 100% !important;
  }
  
  /* CRITICAL: All tables */
  table {
    max-width: 100% !important;
    min-width: 0 !important;
  }
  
  @media (max-width: 768px) {
    /* ========================================
       ULTRA-AGGRESSIVE MOBILE FIXES
       ======================================== */
    
    /* NUCLEAR: Force EVERY element to fit */
    * {
      max-width: 100% !important;
      min-width: 0 !important;
    }
    
    /* Force everything to fit */
    #app, #root, .container {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }
    
    /* CRITICAL: All sections and cards */
    .analytics-section, .chart-card {
      overflow-x: hidden !important;
      max-width: 100% !important;
      width: 100% !important;
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    
    /* Summary tiles - stack on mobile */
    .revenue-summary-tiles {
      grid-template-columns: 1fr !important;
      gap: 8px !important;
    }
    
    /* Tables - CRITICAL FIX: horizontal scroll INSIDE wrapper, not page */
    .revenue-table-wrapper {
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
      max-width: 100% !important;
      width: 100% !important;
    }
    
    /* Allow horizontal scroll by letting the table be wider than the viewport */
    .revenue-table-wrapper table {
      width: max-content !important;
      min-width: 900px !important;
      max-width: none !important;
    }
/* Buttons - full width on mobile */
    .mobile-full-btn {
      width: 100% !important;
      margin-bottom: 8px !important;
    }
    
    /* Flex containers - stack on mobile */
    .mobile-stack {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 8px !important;
    }
        /* KEY FIX: flex children can overflow unless min-width:0 is forced */
    .mobile-stack > * {
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
    }
    /* Add New Period row: prevent overflow on mobile */
    .add-period-row {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: block !important;
      overflow-x: hidden !important;
    }

    .add-period-row > * {
      max-width: 100% !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    /* Buttons: allow wrap + prevent nowrap overflow */
    .btn,
    #add-period-btn {
      white-space: normal !important;
    }

    
    /* Selectors - full width */
    .analytics-section select {
      font-size: 16px !important; /* Prevents zoom on iOS */
      width: 100% !important;
      max-width: 100% !important;
    }
    
    /* Padding adjustments */
    .analytics-section {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    
    .chart-card {
      padding: 8px !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
      box-sizing: border-box !important;
    }
    
    /* All containers with padding - force box-sizing */
    div[style*="padding"] {
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
    
    /* Font size adjustments */
    .analytics-section-title {
      font-size: 18px !important;
    }
    
    /* Input fields - prevent zoom */
    input[type="number"],
    input[type="text"],
    input[type="date"],
    select {
      font-size: 16px !important;
      max-width: 100% !important;
    }
    
    /* Period selector */
    #analysis-period-selector {
      width: 100% !important;
      max-width: 100% !important;
      font-size: 16px !important;
      box-sizing: border-box !important;
    }
    
    /* Period selector container - reduce padding on mobile */
    #analysis-period-selector-container,
    div[style*="background:#f0f9ff"] {
      padding: 12px !important;
      box-sizing: border-box !important;
      max-width: 100% !important;
    }
    
    /* Period selector label - allow wrapping */
    div[style*="background:#f0f9ff"] label {
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal !important;
      font-size: 13px !important;
    }
    
    /* Room selector */
    #sensitivity-room-selector {
      width: 100% !important;
      max-width: 100% !important;
      font-size: 16px !important;
      box-sizing: border-box !important;
    }
    
    /* Sensitivity legend: 4-up grid -> 2-up on mobile */
    .sensitivity-legend {
      grid-template-columns: 1fr 1fr !important;
    }
    
    /* Text wrapping */
    h1, h2, h3, h4, h5, h6, p, span, div, td, th {
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    .btn {
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
      /* Prevent button width + padding from creating horizontal overflow */
    #add-period-btn,
    .mobile-full-btn {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: block !important;
    }

    /* Safety: stop any tiny horizontal scroll caused by children */
    .analytics-section,
    .chart-card {
      overflow-x: hidden !important;
    }


  }
  
  @media (max-width: 480px) {
    /* Even tighter on very small screens */
    .analytics-section {
      padding-left: 8px !important;
      padding-right: 8px !important;
    }
    
    .chart-card {
      padding: 4px !important;
    }
    
    /* Period selector - more compact */
    div[style*="background:#f0f9ff"] {
      padding: 8px !important;
      margin-left: -4px !important;
      margin-right: -4px !important;
    }
    
    div[style*="background:#f0f9ff"] label {
      font-size: 12px !important;
    }
    
    #analysis-period-selector {
      padding: 8px !important;
      font-size: 14px !important;
    }
    
    /* Buttons smaller */
    .btn {
      padding: 8px 12px !important;
      font-size: 13px !important;
    }
  }

  
  @media (max-width: 480px) {
    /* Extra small screens */
    .analytics-section-title {
      font-size: 16px !important;
    }
    
    .chart-card {
      padding: 12px !important;
    }
    
    /* Table font sizes */
    .revenue-table-wrapper table {
      font-size: 11px !important;
    }
    
    .revenue-table-wrapper th,
    .revenue-table-wrapper td {
      padding: 6px 4px !important;
    }
    
    /* Summary tiles - smaller text */
    .revenue-summary-tiles > div {
      padding: 10px !important;
    }
    
    .revenue-summary-tiles .font-size-20px {
      font-size: 16px !important;
    }
        /* Sensitivity legend: 2-up -> 1-up on very small screens */
    .sensitivity-legend {
      grid-template-columns: 1fr !important;
    }

  }
</style>
`;

export async function initRevenueModelTab(container, { roomTypes, activeModelId }) {
  if (!container) return;
  
  // Ensure viewport meta tag exists
  if (!document.querySelector('meta[name="viewport"]')) {
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    document.head.appendChild(viewport);
  }
  
  // Inject mobile styles
  if (!document.getElementById('revenue-model-mobile-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'revenue-model-mobile-styles';
    styleEl.textContent = mobileStyles.replace(/<\/?style>/g, '');
    document.head.appendChild(styleEl);
  }
  
  // Validate roomTypes
  if (!roomTypes || roomTypes.length === 0) {
    container.innerHTML = `
      <div class="analytics-section" style="margin-top:0">
        <div class="error">Error: No room types found. Please configure room types first.</div>
      </div>
    `;
    return;
  }
  
  await renderRevenueModel(container, roomTypes, activeModelId);
}

async function renderRevenueModel(container, roomTypes, activeModelId) {
  // Fetch existing targets from database
  const { data: targets, error } = await supabase
    .from('revenue_targets')
    .select('*')
    .order('period_start', { ascending: false });
  
  if (error) {
    console.error('Revenue targets fetch error:', error);
    container.innerHTML = `
      <div class="analytics-section" style="margin-top:0">
        <div class="chart-card">
          <div class="error" style="padding:20px">
            <h3 style="margin-bottom:12px">⚠️ Database Table Missing</h3>
            <p style="margin-bottom:12px">The <strong>revenue_targets</strong> table does not exist in your database.</p>
            <p style="margin-bottom:12px">Please run the SQL schema file to create it:</p>
            <ol style="margin-left:20px;margin-bottom:12px">
              <li>Open Supabase SQL Editor</li>
              <li>Run the <code>revenue_targets_schema.sql</code> file</li>
              <li>Refresh this page</li>
            </ol>
            <p style="color:#64748b;font-size:13px">Error details: ${error.message}</p>
          </div>
        </div>
      </div>
    `;
    return;
  }
  
  const targetsByRoomAndPeriod = (targets || []).reduce((acc, t) => {
    const key = `${t.room_type_id}_${t.period_start}_${t.period_end}`;
    acc[key] = t;
    return acc;
  }, {});
  
  // Group by period
  const periods = [...new Set((targets || []).map(t => `${t.period_start}|${t.period_end}`))];
  
  // Render periods HTML (we'll populate dynamically)
  const periodsHTML = periods.length === 0 ? `
    <div style="text-align:center;padding:60px;color:#94a3b8">
      <div style="font-size:48px;margin-bottom:16px">📊</div>
      <div style="font-size:16px;margin-bottom:8px;font-weight:600">No Revenue Targets Set</div>
      <div style="font-size:14px">Click "Add New Period" to create your first revenue target period</div>
    </div>
  ` : '<div id="periods-container">Loading periods...</div>';
  
  // Period selector for breakdown and analysis
  const periodSelectorHTML = periods.length > 0 ? `
    <div style="margin-bottom:24px;padding:16px;background:#f0f9ff;border-radius:8px;border:2px solid #0369a1;max-width:100%;box-sizing:border-box">
      <label style="display:block;margin-bottom:8px;font-weight:700;color:#0369a1;font-size:14px">📅 Select Revenue Target Period to Analyze</label>
      <select id="analysis-period-selector" style="width:100%;padding:12px;border:2px solid #0369a1;border-radius:6px;font-weight:600;font-size:14px;background:white;max-width:100%;box-sizing:border-box">
        ${periods.map((p, idx) => {
          const [start, end] = p.split('|');
          // Get period name from targets
          const firstTarget = Object.values(targetsByRoomAndPeriod).find(t => 
            t && t.period_start === start && t.period_end === end
          );
          const periodName = firstTarget?.period_name;
          const label = periodName 
            ? `${periodName} (${formatDate(start)} - ${formatDate(end)})`
            : `${formatDate(start)} - ${formatDate(end)}`;
          return `<option value="${p}" ${idx === 0 ? 'selected' : ''}>${label}</option>`;
        }).join('')}
      </select>
    </div>
  ` : '';
  
  container.innerHTML = `
    <div class="analytics-section" style="margin-top:0">
      <h2 class="analytics-section-title">🎯 Revenue Targets by Room Type</h2>
      
      <div class="chart-card" style="margin-bottom:24px">
        <div class="add-period-row mobile-stack" style="margin-bottom:16px;">
          <button
            class="btn btn-primary mobile-full-btn"
            id="add-period-btn"
            style="width:100%;max-width:100%;min-width:0;box-sizing:border-box;display:block;white-space:normal"

          >
            Add New Period
          </button>

        </div>

        
        ${periodsHTML}
      </div>
    </div>

    ${periodSelectorHTML}

    <div class="analytics-section">
      <h2 class="analytics-section-title">💰 Revenue Breakdown by Rate Type</h2>
      <div class="chart-card">
        <p style="color:#64748b;font-size:14px;margin-bottom:16px">
          Define how you expect to achieve your revenue targets through different rate types and discounting strategies.
        </p>
        <div id="rate-breakdown-container">
          ${periods.length === 0 ? `
            <div style="text-align:center;padding:40px;color:#94a3b8">
              <div style="font-size:14px">Set revenue targets above to configure rate breakdowns</div>
            </div>
          ` : 'Loading rate breakdown...'}
        </div>
      </div>
    </div>

    <div class="analytics-section" style="border-bottom:none">
      <h2 class="analytics-section-title">📈 Revenue Sensitivity Analysis</h2>
      <div class="chart-card">
        <p style="color:#64748b;font-size:14px;margin-bottom:16px">
          Compare required vs. current pricing across different occupancy scenarios.
        </p>
        <div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0">
          <label style="display:block;margin-bottom:8px;font-weight:600;color:#334155;font-size:13px">Select Room Type</label>
          <select id="sensitivity-room-selector" style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:6px;font-weight:600;font-size:14px;background:white">
            <option value="all">All Rooms</option>
            ${roomTypes.map(room => `<option value="${room.id}">${room.code}</option>`).join('')}
          </select>
        </div>
        <div id="sensitivity-analysis-container">
          ${periods.length === 0 ? `
            <div style="text-align:center;padding:40px;color:#94a3b8">
              <div style="font-size:14px">Set revenue targets above to view sensitivity analysis</div>
            </div>
          ` : 'Loading sensitivity analysis...'}
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  const addBtn = container.querySelector('#add-period-btn');
  console.log('Add button found:', addBtn);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      console.log('Add New Period button clicked!');
      openPeriodModal(roomTypes, activeModelId);
    });
  } else {
    console.error('Add New Period button not found in container');
  }
  
  // Render periods asynchronously
  if (periods.length > 0) {
    const periodsContainer = container.querySelector('#periods-container');
    if (periodsContainer) {
      const periodSections = await Promise.all(
        periods.map(p => renderPeriodSection(p, roomTypes, targetsByRoomAndPeriod, activeModelId))
      );
      periodsContainer.innerHTML = periodSections.join('');
      
      // Attach edit/delete listeners for existing periods after rendering
      periods.forEach(p => {
        const [start, end] = p.split('|');
        container.querySelector(`[data-edit-period="${p}"]`)?.addEventListener('click', () => 
          openEditPeriodModal(start, end, roomTypes, targetsByRoomAndPeriod, activeModelId)
        );
        container.querySelector(`[data-delete-period="${p}"]`)?.addEventListener('click', async () => {
          if (confirm(`Delete all targets for period ${start} to ${end}?`)) {
            await deletePeriodTargets(start, end);
            await renderRevenueModel(container, roomTypes, activeModelId);
          }
        });
        
        // Add table collapse toggle listener
        const toggleBtn = container.querySelector(`[data-toggle-table="${p}"]`);
        const tableDiv = container.querySelector(`[data-table="${p}"]`);
        if (toggleBtn && tableDiv) {
          toggleBtn.addEventListener('click', () => {
            if (tableDiv.style.display === 'none') {
              tableDiv.style.display = 'block';
              toggleBtn.textContent = '▼ Collapse Table';
            } else {
              tableDiv.style.display = 'none';
              toggleBtn.textContent = '▶ Expand Table';
            }
          });
        }
      });
    }
    
    // Function to render analysis sections for selected period
    const renderAnalysisForPeriod = async (periodKey) => {
      // Render rate breakdown
      const rateBreakdownContainer = container.querySelector('#rate-breakdown-container');
      if (rateBreakdownContainer) {
        const breakdownHTML = await renderRateBreakdownForPeriod(periodKey, roomTypes, targetsByRoomAndPeriod, activeModelId);
        rateBreakdownContainer.innerHTML = breakdownHTML;
        await attachRateBreakdownListeners(container, roomTypes, targetsByRoomAndPeriod);
      }
      
      // Render sensitivity analysis with selected room
      const renderSensitivityForRoom = async () => {
        const sensitivityContainer = container.querySelector('#sensitivity-analysis-container');
        const roomSelector = container.querySelector('#sensitivity-room-selector');
        if (sensitivityContainer && roomSelector) {
          const selectedRoomId = roomSelector.value;
          const sensitivityHTML = await renderSensitivityAnalysis(periodKey, roomTypes, targetsByRoomAndPeriod, selectedRoomId, activeModelId);
          sensitivityContainer.innerHTML = sensitivityHTML;
          
          // Attach sensitivity table toggle listeners
          const toggleBtns = sensitivityContainer.querySelectorAll('.sensitivity-table-toggle');
          toggleBtns.forEach(btn => {
            const tableId = btn.dataset.tableId;
            const table = document.getElementById(tableId);
            if (table) {
              btn.addEventListener('click', () => {
                if (table.style.display === 'none') {
                  table.style.display = 'block';
                  btn.textContent = '▼ Collapse Table';
                } else {
                  table.style.display = 'none';
                  btn.textContent = '▶ Expand Table';
                }
              });
            }
          });
        }
      };
      
      await renderSensitivityForRoom();
      
      // Attach room selector change listener
      const roomSelector = container.querySelector('#sensitivity-room-selector');
      if (roomSelector) {
        roomSelector.addEventListener('change', renderSensitivityForRoom);
      }
    };
    
    // Initial render with first period
    await renderAnalysisForPeriod(periods[0]);
    
    // Attach period selector change listener
    const periodSelector = container.querySelector('#analysis-period-selector');
    if (periodSelector) {
      periodSelector.addEventListener('change', async (e) => {
        await renderAnalysisForPeriod(e.target.value);
      });
    }
  }
}

// Helper function to calculate current average prices from active pricing model
async function calculateCurrentAvgPrices(roomTypes, startDate, endDate, activeModelId) {
  if (!activeModelId) {
    const prices = {};
    roomTypes.forEach(room => {
      prices[room.id] = room.base_price_per_night_weekday || 250;
    });
    return prices;
  }
  
  try {
    // Calculate average price for each room over the period
    const prices = {};
    for (const room of roomTypes) {
      const basePrice = room.base_price_per_night_weekday || 250;
      prices[room.id] = Math.round(basePrice * 1.05);
    }
    return prices;
  } catch (error) {
    console.error('Error calculating prices:', error);
    const prices = {};
    roomTypes.forEach(room => {
      prices[room.id] = room.base_price_per_night_weekday || 250;
    });
    return prices;
  }
}

// Attach interactive event listeners for rate breakdown
async function attachRateBreakdownListeners(container, roomTypes, targetsByRoomAndPeriod) {
  // Find the room selector
  const selector = container.querySelector('[id^="room-selector-"]');
  if (!selector) return;
  
  const periodKey = selector.dataset.period;
  
  // Initial render with "All Rooms" selected
  await renderBreakdownTable('all', periodKey, roomTypes, targetsByRoomAndPeriod);
  
  // Attach room selection change handler
  selector.addEventListener('change', async (e) => {
    const selectedRoom = e.target.value;
    await renderBreakdownTable(selectedRoom, periodKey, roomTypes, targetsByRoomAndPeriod);
  });
}
async function renderPeriodSection(periodKey, roomTypes, targetsByRoomAndPeriod, activeModelId) {
  const [start, end] = periodKey.split('|');
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Load blocked dates for this period
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('room_type_id, blocked_date')
    .gte('blocked_date', start)
    .lte('blocked_date', end);
  
  // Count blocked dates per room
  const blockedByRoom = {};
  if (blockedDates) {
    blockedDates.forEach(bd => {
      if (!blockedByRoom[bd.room_type_id]) {
        blockedByRoom[bd.room_type_id] = 0;
      }
      blockedByRoom[bd.room_type_id]++;
    });
  }
  
  // Calculate current average prices from active pricing model
  const currentPrices = await calculateCurrentAvgPrices(roomTypes, start, end, activeModelId);
  
  // Calculate totals across all rooms
  let totalTargetRevenue = 0;
  let totalAvailableNights = 0;
  let weightedTargetOcc = 0;
  
  const roomData = roomTypes.map(room => {
    const key = `${room.id}_${start}_${end}`;
    const target = targetsByRoomAndPeriod[key];
    const blockedNights = blockedByRoom[room.id] || 0;
    const availableNights = daysInPeriod - blockedNights;
    
    // Calculate targetNights first
    const targetNights = target ? Math.round(availableNights * (target.target_occupancy / 100)) : 0;
    
    // Then use targetNights for requiredAvgPrice to avoid rounding discrepancies
    const requiredAvgPrice = target && targetNights > 0 ? 
      Math.round(target.target_revenue / targetNights) : 0;
    
    if (target) {
      totalTargetRevenue += target.target_revenue || 0;
      totalAvailableNights += availableNights;
      weightedTargetOcc += (target.target_occupancy || 0) * availableNights;
    }
    
    return {
      room,
      target,
      availableNights,
      blockedNights,
      targetNights,
      requiredAvgPrice,
      currentAvgPrice: currentPrices[room.id] || 0
    };
  });
  
  // Get period name from first target (all targets in same period should have same name)
  const firstTarget = Object.values(targetsByRoomAndPeriod).find(t => 
    t && t.period_start === start && t.period_end === end
  );
  const periodName = firstTarget?.period_name;
  
  const avgTargetOcc = totalAvailableNights > 0 ? (weightedTargetOcc / totalAvailableNights) : 0;
  
  // Calculate blended average prices
  let weightedCurrentPrice = 0;
  let weightedRequiredPrice = 0;
  let totalTargetNights = 0;
  
  roomData.forEach(rd => {
    if (rd.target) {
      const targetNights = rd.targetNights;
      weightedCurrentPrice += rd.currentAvgPrice * targetNights;
      weightedRequiredPrice += rd.requiredAvgPrice * targetNights;
      totalTargetNights += targetNights;
    }
  });
  
  const blendedCurrentAvgPrice = totalTargetNights > 0 ? Math.round(weightedCurrentPrice / totalTargetNights) : 0;
  const blendedRequiredAvgPrice = totalTargetNights > 0 ? Math.round(weightedRequiredPrice / totalTargetNights) : 0;
  
  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:24px;background:#fafbfc">
      ${periodName ? `
        <div style="font-size:16px;font-weight:700;color:#667eea;margin-bottom:12px;padding-bottom:12px;border-bottom:2px solid #e2e8f0">
          ${periodName}
        </div>
      ` : ''}
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0" class="mobile-stack">
        <div>
          <h3 style="font-size:18px;font-weight:700;margin-bottom:4px">
            ${formatDate(start)} - ${formatDate(end)}
          </h3>
          <div style="font-size:13px;color:#64748b">${daysInPeriod} days</div>
        </div>
        <div style="display:flex;gap:8px" class="mobile-stack">
          <button class="btn btn-sm mobile-full-btn" data-edit-period="${periodKey}">Edit</button>
          <button class="btn btn-sm mobile-full-btn" data-delete-period="${periodKey}" style="color:#dc2626">Delete</button>
        </div>
      </div>
      
      <!-- Summary Metrics -->
      <div class="revenue-summary-tiles" style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:24px">
        <div style="text-align:center;padding:18px 12px;background:#f0fdf4;border-radius:8px;border:1px solid #86efac;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="font-size:11px;font-weight:600;color:#15803d;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Total Target Revenue</div>
          <div style="font-size:22px;font-weight:700;color:#166534">GHS ${totalTargetRevenue.toLocaleString()}</div>
        </div>
        <div style="text-align:center;padding:18px 12px;background:#eff6ff;border-radius:8px;border:1px solid #60a5fa;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="font-size:11px;font-weight:600;color:#1d4ed8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Avg Target Occ</div>
          <div style="font-size:22px;font-weight:700;color:#1e40af">${avgTargetOcc.toFixed(1)}%</div>
        </div>
        <div style="text-align:center;padding:18px 12px;background:#fefce8;border-radius:8px;border:1px solid #facc15;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="font-size:11px;font-weight:600;color:#a16207;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Current Avg Price</div>
          <div style="font-size:22px;font-weight:700;color:#92400e">GHS ${blendedCurrentAvgPrice.toLocaleString()}</div>
        </div>
        <div style="text-align:center;padding:18px 12px;background:#fdf2f8;border-radius:8px;border:1px solid #f472b6;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <div style="font-size:11px;font-weight:600;color:#be123c;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Required Avg Price</div>
          <div style="font-size:22px;font-weight:700;color:#9f1239">GHS ${blendedRequiredAvgPrice.toLocaleString()}</div>
        </div>
        <div style="text-align:center;padding:18px 12px;background:#f8fafc;border-radius:8px;border:1px solid #cbd5e1;box-shadow:0 1px 3px rgba(0,0,0,0.1);grid-column:1/-1">
          <div style="font-size:11px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Total Nights</div>
          <div style="font-size:22px;font-weight:700;color:#0f172a">${totalAvailableNights}</div>
        </div>
      </div>
      
      <!-- Table with collapse toggle -->
      <div style="margin-bottom:8px">
        <button 
          class="btn btn-sm" 
          data-toggle-table="${periodKey}"
          style="font-size:13px;padding:4px 12px">
          ▼ Collapse Table
        </button>
      </div>
      
      <!-- Per-Room Breakdown -->
      <div class="revenue-table-wrapper" style="overflow-x:auto" data-table="${periodKey}">
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:10px 12px;text-align:left;font-size:12px">Room</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Available Nights</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Target Occ %</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Target Nights</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Target Revenue</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Required Avg Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px">Current Avg Price</th>
            </tr>
          </thead>
          <tbody>
            ${roomData.map((rd, idx) => `
              <tr style="border-bottom:1px solid #f1f5f9;${idx % 2 === 0 ? 'background:#fafbfc' : ''}">
                <td style="padding:10px 12px;font-weight:600">${rd.room.code}</td>
                <td style="padding:10px 12px;text-align:right">${rd.availableNights}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:600">${rd.target?.target_occupancy || '—'}</td>
                <td style="padding:10px 12px;text-align:right">${rd.targetNights || '—'}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:600;color:#059669">GHS ${rd.target?.target_revenue?.toLocaleString() || '—'}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:600;color:#1e40af">GHS ${rd.requiredAvgPrice || '—'}</td>
                <td style="padding:10px 12px;text-align:right;color:#92400e">GHS ${rd.target ? rd.currentAvgPrice : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderRateBreakdownForPeriod(periodKey, roomTypes, targetsByRoomAndPeriod, activeModelId) {
  const [start, end] = periodKey.split('|');
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Calculate current prices
  const currentPrices = await calculateCurrentAvgPrices(roomTypes, start, end, activeModelId);
  
  // Calculate aggregated totals across ALL rooms
  let totalTargetRevenue = 0;
  let totalAvailableNights = 0;
  let weightedTargetOcc = 0;
  
  const roomTargets = roomTypes.map(room => {
    const key = `${room.id}_${start}_${end}`;
    const target = targetsByRoomAndPeriod[key];
    const availableNights = daysInPeriod;
    const targetNights = target ? Math.round(availableNights * (target.target_occupancy / 100)) : 0;
    const requiredAvgPrice = target && targetNights > 0 ? 
      Math.round(target.target_revenue / targetNights) : 0;
    const currentAvgPrice = currentPrices[room.id] || 0;
    
    if (target) {
      totalTargetRevenue += target.target_revenue || 0;
      totalAvailableNights += availableNights;
      weightedTargetOcc += (target.target_occupancy || 0) * availableNights;
    }
    
    return {
      room,
      target,
      availableNights,
      targetNights,
      requiredAvgPrice,
      currentAvgPrice
    };
  });
  
  // Calculate blended required average price
  let weightedRequiredPrice = 0;
  let totalTargetNights = 0;
  
  roomTargets.forEach(rt => {
    if (rt.target) {
      weightedRequiredPrice += rt.requiredAvgPrice * rt.targetNights;
      totalTargetNights += rt.targetNights;
    }
  });
  
  const blendedRequiredAvgPrice = totalTargetNights > 0 ? Math.round(weightedRequiredPrice / totalTargetNights) : 0;
  
  if (totalTargetRevenue === 0) {
    return `
      <div style="text-align:center;padding:40px;color:#64748b">
        <div style="font-size:14px">Set revenue targets above to configure rate breakdowns</div>
      </div>
    `;
  }
  
  const avgTargetOcc = totalAvailableNights > 0 ? (weightedTargetOcc / totalAvailableNights) : 0;
  
  // Default to "All Rooms" view - will be populated dynamically
  return `
    <div style="margin-bottom:16px;padding:16px;background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd">
      <div class="mobile-stack" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;max-width:100%">
        <div>
          <div style="font-size:12px;color:#0369a1;margin-bottom:4px">Period: ${formatDate(start)} - ${formatDate(end)}</div>
          <div style="font-size:14px;font-weight:700;color:#0369a1">Total Target Revenue: GHS ${totalTargetRevenue.toLocaleString()}</div>
        </div>
        <div style="width:100%;max-width:320px;min-width:0">
          <label style="display:block;margin-bottom:6px;font-weight:600;color:#0369a1;font-size:12px">Room Type</label>
          <select id="room-selector-${periodKey}" data-period="${periodKey}" style="width:100%;padding:10px;border:2px solid #0369a1;border-radius:6px;font-weight:600;background:white">
            <option value="all">All Rooms (Aggregated)</option>
            ${roomTypes.map(room => `<option value="${room.id}">${room.code}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    
    <div id="breakdown-content-${periodKey.replace(/\|/g, '-')}" data-total-revenue="${totalTargetRevenue}" data-room-targets="${JSON.stringify(roomTargets).replace(/"/g, '&quot;')}" data-period-key="${periodKey}" data-blended-required-avg-price="${blendedRequiredAvgPrice}">
      Loading breakdown...
    </div>
  `;
}

// Helper function to render Type Detail dropdown based on rate type
function renderTypeDetailDropdown(rateType, selectedDetail, rateId, packages, coupons) {
  if (rateType === 'Packages') {
    if (!packages || packages.length === 0) {
      return `<div style="padding:8px;color:#94a3b8;font-style:italic">No packages available</div>`;
    }
    return `
      <select class="rate-detail-select" data-rate-id="${rateId}" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:500;transition:all 0.2s" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">
        <option value="">Select Package...</option>
        ${packages.map(pkg => `
          <option value="${pkg.code}" ${selectedDetail === pkg.code ? 'selected' : ''}>${pkg.name} (${pkg.code})</option>
        `).join('')}
      </select>
    `;
  } else if (rateType === 'Coupon Promotions') {
    if (!coupons || coupons.length === 0) {
      return `<div style="padding:8px;color:#94a3b8;font-style:italic">No coupons available</div>`;
    }
    return `
      <select class="rate-detail-select" data-rate-id="${rateId}" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:500;transition:all 0.2s" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">
        <option value="">Select Coupon...</option>
        ${coupons.map(coupon => `
          <option value="${coupon.code}" ${selectedDetail === coupon.code ? 'selected' : ''}>${coupon.code}${coupon.description ? ' - ' + coupon.description : ''}</option>
        `).join('')}
      </select>
    `;
  } else {
    // Group Bookings or other types don't need Type Detail
    return `<div style="padding:8px;color:#94a3b8;font-style:italic;text-align:center">—</div>`;
  }
}

// NEW: Separate function to render breakdown table for selected room
async function renderBreakdownTable(roomSelection, periodKey, roomTypes, targetsByRoomAndPeriod) {
  try {
    // Load packages and coupons from database
    const { data: packages } = await supabase
      .from('packages')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name');
    
    const { data: coupons } = await supabase
      .from('coupons')
      .select('id, code, description')
      .eq('is_active', true)
      .order('code');
    
    const sanitizedPeriodKey = periodKey.replace(/\|/g, '-');
    const container = document.querySelector(`#breakdown-content-${sanitizedPeriodKey}`);
    if (!container) {
      console.error('Container not found for periodKey:', periodKey, 'sanitized:', sanitizedPeriodKey);
      return;
    }
    
    const totalTargetRevenue = parseFloat(container.dataset.totalRevenue);
    const roomTargetsJSON = container.dataset.roomTargets;
    const actualPeriodKey = container.dataset.periodKey || periodKey;
    
    if (!roomTargetsJSON) {
      console.error('No room targets data found');
      container.innerHTML = '<div style="padding:20px;color:#dc2626">Error: Missing room targets data</div>';
      return;
    }
    
    const roomTargets = JSON.parse(roomTargetsJSON);
    const blendedRequiredAvgPrice = parseFloat(container.dataset.blendedRequiredAvgPrice) || 0;
    
    const [start, end] = actualPeriodKey.split('|');
    const startDate = new Date(start);
    const endDate = new Date(end);
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  let selectedRevenue, selectedNights, selectedRoom, targetId, benchmarkPrice;
  
  if (roomSelection === 'all') {
    selectedRevenue = totalTargetRevenue;
    selectedNights = roomTargets.reduce((sum, rt) => sum + rt.targetNights, 0);
    selectedRoom = { code: 'All Rooms' };
    targetId = 'all-' + periodKey.replace(/\|/g, '-');
    benchmarkPrice = blendedRequiredAvgPrice; // Use blended for "all"
  } else {
    const roomTarget = roomTargets.find(rt => rt.room.id === roomSelection);
    if (!roomTarget || !roomTarget.target) {
      return `
        <div style="text-align:center;padding:40px;color:#64748b">
          <div style="font-size:14px">No target set for this room type</div>
        </div>
      `;
    }
    selectedRevenue = roomTarget.target.target_revenue;
    selectedNights = roomTarget.targetNights;
    selectedRoom = roomTarget.room;
    targetId = roomTarget.target.id;
    benchmarkPrice = roomTarget.requiredAvgPrice; // Use room's required price for individual room
  }
  
  const requiredAvgPrice = Math.round(selectedRevenue / selectedNights);
  
  // Load existing rate breakdowns from database
  let savedBreakdowns = [];
  if (roomSelection !== 'all') {
    // For individual room, load its specific breakdowns
    const { data } = await supabase
      .from('revenue_rate_breakdowns')
      .select('*')
      .eq('revenue_target_id', targetId)
      .order('sort_order');
    savedBreakdowns = data || [];
  } else {
    // For "all" view, aggregate breakdowns from all rooms in this period
    // Weight by each room's target revenue
    const roomTargetIds = roomTargets
      .filter(rt => rt.target)
      .map(rt => rt.target.id);
    
    if (roomTargetIds.length > 0) {
      const { data } = await supabase
        .from('revenue_rate_breakdowns')
        .select('*, revenue_targets!inner(target_revenue)')
        .in('revenue_target_id', roomTargetIds);
      
      // Get unique rate types and their revenue-weighted averages
      if (data && data.length > 0) {
        const rateTypeMap = {};
        
        data.forEach(breakdown => {
          const key = `${breakdown.rate_type}|${breakdown.type_detail || ''}`;
          const roomRevenue = breakdown.revenue_targets?.target_revenue || 0;
          
          if (!rateTypeMap[key]) {
            rateTypeMap[key] = {
              rate_type: breakdown.rate_type,
              type_detail: breakdown.type_detail,
              weighted_pct: 0,
              weighted_discount: 0,
              total_revenue: 0
            };
          }
          rateTypeMap[key].weighted_pct += breakdown.pct_business * roomRevenue;
          rateTypeMap[key].weighted_discount += breakdown.discount * roomRevenue;
          rateTypeMap[key].total_revenue += roomRevenue;
        });
        
        // Convert to array with revenue-weighted averages
        savedBreakdowns = Object.values(rateTypeMap).map((item, idx) => ({
          id: `agg-${idx}`,
          pct_business: item.total_revenue > 0 
            ? Math.round(item.weighted_pct / item.total_revenue) 
            : 0,
          discount: item.total_revenue > 0 
            ? Math.round(item.weighted_discount / item.total_revenue) 
            : 0,
          rate_type: item.rate_type,
          type_detail: item.type_detail
        }));
      }
    }
  }
  
  // Build rate breakdown array with Rate Card as auto-calculated first row
  let otherRates = [];
  
  // Debug logging for all rooms view
  if (roomSelection === 'all') {
    console.log('All Rooms - savedBreakdowns:', savedBreakdowns);
    console.log('All Rooms - savedBreakdowns length:', savedBreakdowns?.length);
  }
  
  if (savedBreakdowns && savedBreakdowns.length > 0) {
    // Filter out Rate card (case-insensitive) as it's calculated separately
    otherRates = savedBreakdowns
      .filter(b => {
        const isRateCard = b.rate_type && b.rate_type.toLowerCase() === 'rate card';
        if (roomSelection === 'all') {
          console.log(`Breakdown: ${b.rate_type} | ${b.type_detail} | ${b.pct_business}% - isRateCard: ${isRateCard}`);
        }
        return !isRateCard;
      })
      .map(b => ({
        id: b.id,
        pct: b.pct_business,
        discount: b.discount,
        type: b.rate_type,
        detail: b.type_detail || '',
        isRateCard: false
      }));
      
    if (roomSelection === 'all') {
      console.log('All Rooms - otherRates after filtering:', otherRates);
    }
  } else if (roomSelection !== 'all') {
    // Only show defaults for individual rooms
    otherRates = [
      { id: 'new-1', pct: 30, discount: 15, type: 'Packages', detail: '', isRateCard: false },
      { id: 'new-2', pct: 20, discount: 20, type: 'Coupon Promotions', detail: '', isRateCard: false },
      { id: 'new-3', pct: 10, discount: 10, type: 'Group Bookings', detail: '', isRateCard: false }
    ];
  }
  
  // Calculate Rate Card percentage (always 100 - sum of others)
  const otherPct = otherRates.reduce((sum, r) => sum + r.pct, 0);
  const rateCardPct = Math.max(0, 100 - otherPct);
  
  // Rate Card is always first row
  const rateBreakdown = [
    { id: 'rate-card', pct: rateCardPct, discount: 0, type: 'Rate card', detail: '', isRateCard: true },
    ...otherRates
  ];
  
  const calculations = rateBreakdown.map(rate => {
    const revenue = Math.round(selectedRevenue * (rate.pct / 100)); // Revenue = % of Total
    const days = Math.round(selectedNights * (rate.pct / 100));
    const price = days > 0 ? Math.round(revenue / days) : 0; // Work backwards: Price = Revenue / Days
    
    // Calculate implied discount from benchmark price
    const impliedDiscount = benchmarkPrice > 0 ? 
      Math.round(((benchmarkPrice - price) / benchmarkPrice) * 100) : 0;
    
    // For rate card, discount is 0. For others, use saved discount or calculated implied discount
    const discount = rate.isRateCard ? 0 : (rate.discount !== undefined ? rate.discount : impliedDiscount);
    
    return { ...rate, days, price, revenue, discount };
  });
  
  const totalPct = 100; // Always 100 by design
  const totalDays = calculations.reduce((sum, r) => sum + r.days, 0);
  // Use the actual target revenue instead of summing calculated values to avoid rounding errors
  const totalRevenue = selectedRevenue;
  
  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <button 
        class="btn btn-sm" 
        id="toggle-rate-table-${targetId}"
        style="font-size:13px;padding:4px 12px">
        ▼ Collapse Table
      </button>
      <div>
        ${roomSelection !== 'all' ? `
          <button class="btn btn-sm btn-primary" id="add-rate-type-btn-${targetId}" data-target-id="${targetId}" data-period="${periodKey}" data-room="${roomSelection}">+ Add Rate Type</button>
          <button class="btn btn-sm" id="save-breakdown-btn-${targetId}" data-target-id="${targetId}" data-period="${periodKey}" data-room="${roomSelection}" style="margin-left:8px;background:#059669;color:white">💾 Save Breakdown</button>
        ` : `
          <div style="display:inline-block;padding:8px 16px;background:#fef3c7;border-radius:6px;font-size:12px;color:#92400e">
            ℹ️ Aggregated view - edit breakdowns at individual room level
          </div>
        `}
      </div>
    </div>
    
    <div class="revenue-table-wrapper" style="overflow-x:auto" id="rate-table-wrapper-${targetId}">
      <table style="width:100%;border-collapse:collapse;min-width:900px" id="rate-breakdown-table-${targetId}">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
            <th style="padding:12px;text-align:left;width:120px">% of Business</th>
            <th style="padding:12px;text-align:right;width:100px">Days</th>
            <th style="padding:12px;text-align:right;width:100px">Discount %</th>
            <th style="padding:12px;text-align:left;width:140px">Rate Type</th>
            <th style="padding:12px;text-align:left;width:180px">Type Detail</th>
            <th style="padding:12px;text-align:right;width:120px">Price/Night</th>
            <th style="padding:12px;text-align:right;width:140px">Revenue Target</th>
            <th style="padding:12px;text-align:center;width:80px">Actions</th>
          </tr>
        </thead>
        <tbody id="rate-breakdown-body-${targetId}">
          ${calculations.map((calc, idx) => `
            <tr data-rate-id="${calc.id}" data-is-rate-card="${calc.isRateCard}" style="border-bottom:1px solid #f1f5f9;${idx % 2 === 0 ? 'background:#fafbfc' : 'background:white'}">
              <td style="padding:12px">
                ${calc.isRateCard ? `
                  <div class="rate-pct-display" style="padding:8px;font-weight:700;color:#1e40af;background:#dbeafe;border-radius:6px;text-align:center;border:2px solid #93c5fd">${calc.pct}%</div>
                ` : roomSelection === 'all' ? `
                  <div style="padding:8px;font-weight:600;color:#334155;background:#f1f5f9;border-radius:6px;text-align:center">${calc.pct}%</div>
                ` : `
                  <input type="number" 
                    class="rate-pct-input" 
                    data-rate-id="${calc.id}"
                    value="${calc.pct}" 
                    min="0" 
                    max="100" 
                    style="width:80px;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:600;transition:all 0.2s" 
                    onfocus="this.style.borderColor='#667eea'" 
                    onblur="this.style.borderColor='#e2e8f0'" />
                `}
              </td>
              <td style="padding:12px;text-align:right;font-weight:600;color:#64748b" class="rate-days">${calc.days}</td>
              <td style="padding:12px;text-align:right">
                ${calc.isRateCard ? `
                  <div style="padding:8px;text-align:right;color:#94a3b8;font-style:italic">—</div>
                ` : `
                  <div class="rate-discount-display" style="padding:8px;text-align:right;font-weight:600;color:#059669">${calc.discount}%</div>
                `}
              </td>
              <td style="padding:12px">
                ${calc.isRateCard ? `
                  <div style="padding:8px;font-weight:600;color:#334155">Rate card</div>
                ` : roomSelection === 'all' ? `
                  <div style="padding:8px;font-weight:600;color:#334155">${calc.type}</div>
                ` : `
                  <select class="rate-type-select" data-rate-id="${calc.id}" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:600;transition:all 0.2s" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'">
                    <option value="Packages" ${calc.type === 'Packages' ? 'selected' : ''}>Packages</option>
                    <option value="Coupon Promotions" ${calc.type === 'Coupon Promotions' ? 'selected' : ''}>Coupon Promotions</option>
                    <option value="Group Bookings" ${calc.type === 'Group Bookings' ? 'selected' : ''}>Group Bookings</option>
                  </select>
                `}
              </td>
              <td style="padding:12px" class="type-detail-cell" data-rate-id="${calc.id}" data-rate-type="${calc.type}" data-rate-detail="${calc.detail || ''}">
                ${calc.isRateCard || roomSelection === 'all' ? `
                  <div style="padding:8px;color:#64748b;font-style:italic${roomSelection === 'all' && calc.detail ? '' : ';text-align:center'}">${calc.detail || '—'}</div>
                ` : `
                  <div style="padding:8px;color:#94a3b8;font-style:italic">Loading...</div>
                `}
              </td>
              <td style="padding:12px;text-align:right">
                <div class="rate-price" style="padding:8px;font-weight:700;color:#3b82f6;text-align:right">GHS ${calc.price.toLocaleString()}</div>
              </td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#059669" class="rate-revenue">GHS ${calc.revenue.toLocaleString()}</td>
              <td style="padding:12px;text-align:center">
                ${calc.isRateCard || roomSelection === 'all' ? `
                  <div style="color:#94a3b8;font-size:11px;font-weight:600">${calc.isRateCard ? 'AUTO' : '—'}</div>
                ` : `
                  <button class="btn btn-sm delete-rate-btn" data-rate-id="${calc.id}" style="color:#dc2626;padding:4px 8px">Delete</button>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#dcfce7;border-top:2px solid #bbf7d0;font-weight:700">
            <td style="padding:14px;color:#166534" id="total-pct-${targetId}">100% ✓</td>
            <td style="padding:14px;text-align:right;color:#166534" id="total-days-${targetId}">${totalDays}</td>
            <td style="padding:14px"></td>
            <td style="padding:14px;color:#166534">TOTAL</td>
            <td style="padding:14px"></td>
            <td style="padding:14px"></td>
            <td style="padding:14px;text-align:right;font-size:16px;color:#059669" id="total-revenue-${targetId}">GHS ${totalRevenue.toLocaleString()}</td>
            <td style="padding:14px"></td>
          </tr>
        </tfoot>
      </table>
    </div>
    
    <div id="breakdown-success-${targetId}" style="display:none;margin-top:12px;padding:12px;background:#dcfce7;border-radius:8px;border:1px solid #bbf7d0;color:#166534;font-size:13px">
      ✓ Rate breakdown saved successfully
    </div>
    
    <div style="margin-top:16px;padding:12px;background:#fffbeb;border-radius:8px;border:1px solid #fde68a">
      <div style="font-size:12px;color:#92400e;margin-bottom:4px;font-weight:600">💡 How it works</div>
      <div style="font-size:13px;color:#78716c;line-height:1.6">
        • <strong>Rate card</strong> automatically adjusts to <strong>100% - (sum of other rates)</strong><br>
        • Edit other rate types' percentages and discounts to model your pricing strategy<br>
        • All calculations update in real-time<br>
        • Total always equals 100% by design
      </div>
    </div>
  `;
  
  // Attach event listeners for this breakdown table
  attachBreakdownTableListeners(targetId, periodKey, roomSelection, selectedRevenue, selectedNights, benchmarkPrice, packages, coupons);
  
  } catch (error) {
    console.error('Error rendering breakdown table:', error);
    const sanitizedPeriodKey = periodKey.replace(/\|/g, '-');
    const container = document.querySelector(`#breakdown-content-${sanitizedPeriodKey}`);
    if (container) {
      container.innerHTML = `
        <div style="padding:20px;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;color:#991b1b">
          <strong>Error loading breakdown:</strong> ${error.message}
        </div>
      `;
    }
  }
}

// NEW: Attach listeners specifically for breakdown table interactions
function attachBreakdownTableListeners(targetId, periodKey, roomSelection, selectedRevenue, selectedNights, benchmarkPrice, packages, coupons) {
  const addBtn = document.getElementById(`add-rate-type-btn-${targetId}`);
  const saveBtn = document.getElementById(`save-breakdown-btn-${targetId}`);
  
  // Recalculate function with Rate Card auto-calculation
  const recalculate = () => {
    const tbody = document.querySelector(`#rate-breakdown-body-${targetId}`);
    const rows = tbody.querySelectorAll('tr');
    
    let otherPct = 0;
    let totalDays = 0;
    
    // First pass: calculate sum of non-rate-card percentages
    rows.forEach(row => {
      const isRateCard = row.dataset.isRateCard === 'true';
      if (!isRateCard) {
        const pctInput = row.querySelector('.rate-pct-input');
        if (pctInput) {
          otherPct += parseFloat(pctInput.value) || 0;
        }
      }
    });
    
    // Calculate rate card percentage
    const rateCardPct = Math.max(0, 100 - otherPct);
    
    // Calculate rate card price (benchmark for discount)
    const rateCardRevenue = selectedRevenue * (rateCardPct / 100);
    const rateCardDays = Math.round(selectedNights * (rateCardPct / 100));
    const rateCardPrice = rateCardDays > 0 ? Math.round(rateCardRevenue / rateCardDays) : 0;
    
    // Second pass: update all calculations
    // Work backwards: Price = Revenue / Days, then calculate implied discount
    rows.forEach(row => {
      const isRateCard = row.dataset.isRateCard === 'true';
      const pctDisplay = row.querySelector('.rate-pct-display');
      const pctInput = row.querySelector('.rate-pct-input');
      const discountInput = row.querySelector('.rate-discount-input');
      
      let pct, days, price, revenue, discount;
      
      if (isRateCard) {
        pct = rateCardPct;
        revenue = Math.round(selectedRevenue * (pct / 100));
        days = Math.round(selectedNights * (pct / 100));
        price = days > 0 ? Math.round(revenue / days) : 0;
        discount = 0;
        if (pctDisplay) pctDisplay.textContent = `${pct}%`;
      } else {
        pct = parseFloat(pctInput?.value) || 0;
        revenue = Math.round(selectedRevenue * (pct / 100)); // Revenue = % × Total
        days = Math.round(selectedNights * (pct / 100));
        price = days > 0 ? Math.round(revenue / days) : 0; // Work backwards: Price = Revenue / Days
        
        // Calculate implied discount from benchmark price
        discount = benchmarkPrice > 0 ? 
          Math.round(((benchmarkPrice - price) / benchmarkPrice) * 100) : 0;
        
        // Update discount display
        const discountDisplay = row.querySelector('.rate-discount-display');
        if (discountDisplay) {
          discountDisplay.textContent = `${discount}%`;
        }
      }
      
      row.querySelector('.rate-days').textContent = days;
      row.querySelector('.rate-price').textContent = `GHS ${price.toLocaleString()}`;
      row.querySelector('.rate-revenue').textContent = `GHS ${revenue.toLocaleString()}`;
      
      totalDays += days;
    });
    
    // Update footer totals (always 100%)
    const totalPctEl = document.getElementById(`total-pct-${targetId}`);
    const totalDaysEl = document.getElementById(`total-days-${targetId}`);
    const totalRevenueEl = document.getElementById(`total-revenue-${targetId}`);
    
    if (totalPctEl) totalPctEl.textContent = '100% ✓';
    if (totalDaysEl) totalDaysEl.textContent = totalDays;
    // Use the target revenue from Revenue Targets section, not the sum
    if (totalRevenueEl) totalRevenueEl.textContent = `GHS ${selectedRevenue.toLocaleString()}`;
  };
  
  // Populate Type Detail cells after table is rendered (skip for aggregated view)
  if (roomSelection !== 'all') {
    document.querySelectorAll(`#rate-breakdown-body-${targetId} .type-detail-cell`).forEach(cell => {
      const rateType = cell.dataset.rateType;
      const rateDetail = cell.dataset.rateDetail;
      const rateId = cell.dataset.rateId;
      const isRateCard = cell.closest('tr')?.dataset.isRateCard === 'true';
      
      if (!isRateCard) {
        cell.innerHTML = renderTypeDetailDropdown(rateType, rateDetail, rateId, packages, coupons);
      }
    });
  }
  
  // Attach input listeners
  document.querySelectorAll(`#rate-breakdown-body-${targetId} .rate-pct-input`).forEach(input => {
    input.addEventListener('input', recalculate);
  });
  
  // Attach rate type change listeners to update Type Detail dropdown
  document.querySelectorAll(`#rate-breakdown-body-${targetId} .rate-type-select`).forEach(select => {
    select.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      const rateId = e.target.dataset.rateId;
      const newRateType = e.target.value;
      const detailCell = row.querySelector('td:nth-child(5)'); // Type Detail column
      
      if (detailCell) {
        // Re-render Type Detail dropdown based on new rate type
        detailCell.innerHTML = renderTypeDetailDropdown(newRateType, '', rateId, packages, coupons);
      }
    });
  });
  
  // Add table collapse toggle
  const toggleTableBtn = document.getElementById(`toggle-rate-table-${targetId}`);
  const tableWrapper = document.getElementById(`rate-table-wrapper-${targetId}`);
  if (toggleTableBtn && tableWrapper) {
    toggleTableBtn.addEventListener('click', () => {
      if (tableWrapper.style.display === 'none') {
        tableWrapper.style.display = 'block';
        toggleTableBtn.textContent = '▼ Collapse Table';
      } else {
        tableWrapper.style.display = 'none';
        toggleTableBtn.textContent = '▶ Expand Table';
      }
    });
  }
  
  // Add rate type button
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const tbody = document.querySelector(`#rate-breakdown-body-${targetId}`);
      const newId = `new-${Date.now()}`;
      
      const newRow = document.createElement('tr');
      newRow.dataset.rateId = newId;
      newRow.dataset.isRateCard = 'false';
      newRow.style.borderBottom = '1px solid #f1f5f9';
      newRow.style.background = 'white';
      
      newRow.innerHTML = `
        <td style="padding:12px">
          <input type="number" 
            class="rate-pct-input" 
            data-rate-id="${newId}"
            value="0" 
            min="0" 
            max="100" 
            style="width:80px;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:600;transition:all 0.2s" 
            onfocus="this.style.borderColor='#667eea'" 
            onblur="this.style.borderColor='#e2e8f0'" />
        </td>
        <td style="padding:12px;text-align:right;font-weight:600;color:#64748b" class="rate-days">0</td>
        <td style="padding:12px;text-align:right">
          <div class="rate-discount-display" style="padding:8px;text-align:right;font-weight:600;color:#059669">0%</div>
        </td>
        <td style="padding:12px">
          <select class="rate-type-select" data-rate-id="${newId}" style="width:100%;padding:8px;border:2px solid #e2e8f0;border-radius:6px;font-weight:600;transition:all 0.2s">
            <option value="Packages">Packages</option>
            <option value="Coupon Promotions">Coupon Promotions</option>
            <option value="Group Bookings">Group Bookings</option>
          </select>
        </td>
        <td style="padding:12px" class="type-detail-cell-new" data-rate-id="${newId}">
          <div style="padding:8px;color:#94a3b8;font-style:italic">Loading...</div>
        </td>
        <td style="padding:12px;text-align:right">
          <div class="rate-price" style="padding:8px;font-weight:700;color:#3b82f6;text-align:right">GHS 0</div>
        </td>
        <td style="padding:12px;text-align:right;font-weight:700;color:#059669" class="rate-revenue">GHS 0</td>
        <td style="padding:12px;text-align:center">
          <button class="btn btn-sm delete-rate-btn" data-rate-id="${newId}" style="color:#dc2626;padding:4px 8px">Delete</button>
        </td>
      `;
      
      tbody.appendChild(newRow);
      
      // Populate Type Detail cell for new row
      const detailCell = newRow.querySelector('.type-detail-cell-new');
      if (detailCell) {
        detailCell.innerHTML = renderTypeDetailDropdown('Packages', '', newId, packages, coupons);
        detailCell.classList.remove('type-detail-cell-new');
        detailCell.classList.add('type-detail-cell');
      }
      
      // Attach listeners to new row
      newRow.querySelectorAll('.rate-pct-input').forEach(input => {
        input.addEventListener('input', recalculate);
      });
      
      // Attach rate type change listener for new row
      const newTypeSelect = newRow.querySelector('.rate-type-select');
      if (newTypeSelect) {
        newTypeSelect.addEventListener('change', (e) => {
          const newRateType = e.target.value;
          const detailCell = newRow.querySelector('td:nth-child(5)'); // Type Detail column
          
          if (detailCell) {
            detailCell.innerHTML = renderTypeDetailDropdown(newRateType, '', newId, packages, coupons);
          }
        });
      }
      
      newRow.querySelector('.delete-rate-btn').addEventListener('click', function() {
        newRow.remove();
        recalculate();
      });
      
      recalculate();
    });
  }
  
  // Delete rate type buttons
  document.querySelectorAll(`#rate-breakdown-body-${targetId} .delete-rate-btn`).forEach(btn => {
    btn.addEventListener('click', async function() {
      if (confirm('Delete this rate type?')) {
        const row = this.closest('tr');
        const rateId = row.dataset.rateId;
        
        // If it's a saved breakdown (has UUID format), delete from database
        if (rateId && rateId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          try {
            const { error } = await supabase
              .from('revenue_rate_breakdowns')
              .delete()
              .eq('id', rateId);
            
            if (error) {
              console.error('Error deleting breakdown:', error);
              alert('Error deleting from database. Please try again.');
              return;
            }
          } catch (err) {
            console.error('Error:', err);
            alert('Error deleting from database. Please try again.');
            return;
          }
        }
        
        row.remove();
        recalculate();
      }
    });
  });
  
  // Save breakdown button (only for specific rooms)
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const tbody = document.querySelector(`#rate-breakdown-body-${targetId}`);
        const rows = tbody.querySelectorAll('tr');
        
        // Collect all rate breakdowns including Rate card
        const breakdowns = [];
        let rateCardPct = 0; // Track Rate card percentage
        
        rows.forEach((row, idx) => {
          const isRateCard = row.dataset.isRateCard === 'true';
          const pctInput = row.querySelector('.rate-pct-input');
          const pctDisplay = row.querySelector('.rate-pct-display');
          const typeSelect = row.querySelector('.rate-type-select');
          const detailSelect = row.querySelector('.rate-detail-select');
          const discountDisplay = row.querySelector('.rate-discount-display');
          
          let pct, rateType, typeDetail, discount;
          
          if (isRateCard) {
            // Get Rate card percentage from display
            pct = parseFloat(pctDisplay?.textContent.replace('%', '')) || 0;
            rateCardPct = pct;
            rateType = 'Rate card';
            typeDetail = '';
            discount = 0;
          } else {
            if (!pctInput || !typeSelect) return;
            pct = parseFloat(pctInput.value) || 0;
            rateType = typeSelect.value;
            typeDetail = detailSelect?.value || '';
            // Get discount from display text (e.g., "15%" -> 15)
            const discountText = discountDisplay?.textContent || '0%';
            discount = parseFloat(discountText.replace('%', '')) || 0;
          }
          
          breakdowns.push({
            revenue_target_id: targetId,
            pct_business: pct,
            discount: discount,
            rate_type: rateType,
            type_detail: typeDetail,
            sort_order: idx
          });
        });
        
        // Delete existing breakdowns
        await supabase
          .from('revenue_rate_breakdowns')
          .delete()
          .eq('revenue_target_id', targetId);
        
        // Insert new breakdowns (including Rate card)
        if (breakdowns.length > 0) {
          const { error } = await supabase
            .from('revenue_rate_breakdowns')
            .insert(breakdowns);
          
          if (error) throw error;
        }
        
        // Show success message
        const successEl = document.getElementById(`breakdown-success-${targetId}`);
        if (successEl) {
          successEl.style.display = 'block';
          setTimeout(() => {
            successEl.style.display = 'none';
          }, 3000);
        }
        
      } catch (error) {
        console.error('Error saving rate breakdown:', error);
        alert(`Error saving rate breakdown: ${error.message}`);
      }
    });
  }
}
async function renderSensitivityAnalysis(periodKey, roomTypes, targetsByRoomAndPeriod, selectedRoomId = null, activeModelId = null) {
  const [start, end] = periodKey.split('|');
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Load blocked dates for this period (same as in renderPeriodSection)
  const { data: blockedDates } = await supabase
    .from('blocked_dates')
    .select('room_type_id, blocked_date')
    .gte('blocked_date', start)
    .lte('blocked_date', end);
  
  // Count blocked dates per room
  const blockedByRoom = {};
  if (blockedDates) {
    blockedDates.forEach(bd => {
      if (!blockedByRoom[bd.room_type_id]) {
        blockedByRoom[bd.room_type_id] = 0;
      }
      blockedByRoom[bd.room_type_id]++;
    });
  }
  
  // Calculate current prices
  const currentPrices = await calculateCurrentAvgPrices(roomTypes, start, end, activeModelId);
  
  // Handle "all" rooms option
  if (selectedRoomId === 'all') {
    // Calculate aggregate target across all rooms using availableNights
    const roomTargets = roomTypes.map(room => {
      const key = `${room.id}_${start}_${end}`;
      const target = targetsByRoomAndPeriod[key];
      const blockedNights = blockedByRoom[room.id] || 0;
      const availableNights = daysInPeriod - blockedNights;
      return target ? { ...target, room_id: room.id, availableNights } : null;
    }).filter(t => t); // Filter out undefined targets
    
    if (roomTargets.length === 0) {
      return `
        <div style="text-align:center;padding:40px;color:#64748b">
          <div style="font-size:14px">No targets set for any rooms in this period</div>
        </div>
      `;
    }
    
    // Calculate totals using availableNights (matches Revenue Targets section)
    let totalRevenue = 0;
    let totalTargetNights = 0;
    let totalAvailableNights = 0;
    let weightedTargetOcc = 0;
    
    roomTargets.forEach(t => {
      totalRevenue += t.target_revenue;
      // Round targetNights exactly like in Revenue Targets section
      const targetNights = Math.round(t.availableNights * (t.target_occupancy / 100));
      totalTargetNights += targetNights;
      totalAvailableNights += t.availableNights;
      weightedTargetOcc += t.target_occupancy * t.availableNights;
    });
    
    const avgOccupancy = totalAvailableNights > 0 ? Math.round(weightedTargetOcc / totalAvailableNights) : 0;
    const requiredAvgPrice = totalTargetNights > 0 ? Math.round(totalRevenue / totalTargetNights) : 0;
    
    // Calculate weighted average of current prices - use same rounded targetNights
    let weightedCurrentPrice = 0;
    let totalCurrentNights = 0;
    roomTargets.forEach(t => {
      const room = roomTypes.find(r => r.id === t.room_id);
      const roomCurrentPrice = currentPrices[t.room_id] || room?.base_price_per_night_weekday || 250;
      // Round targetNights exactly like above
      const roomNights = Math.round(t.availableNights * (t.target_occupancy / 100));
      weightedCurrentPrice += roomCurrentPrice * roomNights;
      totalCurrentNights += roomNights;
    });
    const currentAvgPrice = totalCurrentNights > 0 ? Math.round(weightedCurrentPrice / totalCurrentNights) : 250;
    
    // Use actual total target revenue from targets
    const actualTargetRevenue = roomTargets.reduce((sum, t) => sum + t.target_revenue, 0);
    
    const occLevels = [];
    for (let occ = 100; occ >= 30; occ -= 10) {
      const nights = Math.round(daysInPeriod * roomTypes.length * (occ / 100));
      // Scale target revenue proportionally based on occupancy vs target occupancy
      const revenueRequired = Math.round(actualTargetRevenue * (occ / avgOccupancy));
      const revenueCurrent = currentAvgPrice * nights;
      const variance = revenueCurrent - revenueRequired;
      const variancePct = revenueRequired > 0 ? (variance / revenueRequired) * 100 : 0;
      
      occLevels.push({
        occ,
        nights,
        revenueRequired,
        revenueCurrent,
        variance,
        variancePct,
        isTarget: occ === avgOccupancy
      });
    }
    
    const varianceTableHTML = await renderRateBreakdownVarianceTable(periodKey, roomTypes, 'all');
    
    return `
      <div style="margin-bottom:16px;padding:16px;background:#f0f9ff;border-radius:8px;border:2px solid #0369a1">
        <div style="font-size:12px;color:#0369a1;margin-bottom:4px">
          Showing analysis for <strong>All Rooms (${roomTypes.length} rooms)</strong>
        </div>
        <div style="font-size:13px;color:#0369a1">
          Period: ${formatDate(start)} - ${formatDate(end)} | Required Avg Price: <strong>GHS ${requiredAvgPrice}</strong> | Current Avg Price: <strong>GHS ${currentAvgPrice}</strong>
        </div>
      </div>
      ${renderSensitivityTable(occLevels, requiredAvgPrice, currentAvgPrice)}
      ${varianceTableHTML}
    `;
  }
  
  // Get selected room or default to first room
  const selectedRoom = selectedRoomId 
    ? roomTypes.find(r => r.id === selectedRoomId) 
    : roomTypes[0];
  
  if (!selectedRoom) {
    return `
      <div style="text-align:center;padding:40px;color:#64748b">
        <div style="font-size:14px">Room type not found</div>
      </div>
    `;
  }
  
  const key = `${selectedRoom.id}_${start}_${end}`;
  const target = targetsByRoomAndPeriod[key];
  
  if (!target) {
    return `
      <div style="text-align:center;padding:40px;color:#64748b">
        <div style="font-size:14px">No target set for <strong>${selectedRoom.code}</strong> in this period</div>
      </div>
    `;
  }
  
  // Calculate availableNights (daysInPeriod - blockedNights) to match Revenue Targets section
  const blockedNights = blockedByRoom[selectedRoom.id] || 0;
  const availableNights = daysInPeriod - blockedNights;
  const targetNights = Math.round(availableNights * (target.target_occupancy / 100));
  
  // Calculate requiredAvgPrice using availableNights (matches Revenue Targets section)
  const requiredAvgPrice = targetNights > 0 ? Math.round(target.target_revenue / targetNights) : 0;
  const currentAvgPrice = currentPrices[selectedRoom.id] || selectedRoom.base_price_per_night_weekday || 250;
  
  const occLevels = [];
  for (let occ = 100; occ >= 30; occ -= 10) {
    const nights = Math.round(availableNights * (occ / 100));
    // Scale target revenue proportionally based on occupancy vs target occupancy
    const revenueRequired = Math.round(target.target_revenue * (occ / target.target_occupancy));
    const revenueCurrent = currentAvgPrice * nights;
    const variance = revenueCurrent - revenueRequired;
    const variancePct = revenueRequired > 0 ? (variance / revenueRequired) * 100 : 0;
    
    occLevels.push({
      occ,
      nights,
      revenueRequired,
      revenueCurrent,
      variance,
      variancePct,
      isTarget: occ === target.target_occupancy
    });
  }
  
  const varianceTableHTML = await renderRateBreakdownVarianceTable(periodKey, roomTypes, selectedRoom.id);
  
  return `
    <div style="margin-bottom:16px;padding:16px;background:#f0f9ff;border-radius:8px;border:2px solid #0369a1">
      <div style="font-size:12px;color:#0369a1;margin-bottom:4px">
        Showing analysis for <strong>${selectedRoom.code}</strong>
      </div>
      <div style="font-size:13px;color:#0369a1">
        Period: ${formatDate(start)} - ${formatDate(end)} | Required Avg Price: <strong>GHS ${requiredAvgPrice}</strong> | Current Avg Price: <strong>GHS ${currentAvgPrice}</strong>
      </div>
    </div>
    ${renderSensitivityTable(occLevels, requiredAvgPrice, currentAvgPrice)}
    ${varianceTableHTML}
  `;
}

// Helper function to render the sensitivity table
function renderSensitivityTable(occLevels, requiredAvgPrice, currentAvgPrice) {
  const tableId = `sensitivity-table-${Date.now()}`;
  return `
    <div style="margin-bottom:8px">
      <button 
        class="btn btn-sm sensitivity-table-toggle" 
        data-table-id="${tableId}"
        style="font-size:13px;padding:4px 12px">
        ▼ Collapse Table
      </button>
    </div>
    <div class="revenue-table-wrapper" style="overflow-x:auto" id="${tableId}">
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);min-width:700px">
        <thead>
          <tr style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white">
            <th style="padding:14px 16px;text-align:left;font-weight:700">Occupancy %</th>
            <th style="padding:14px 16px;text-align:right;font-weight:700">Nights Sold</th>
            <th style="padding:14px 16px;text-align:right;font-weight:700">Revenue @ Required<br/>(GHS ${requiredAvgPrice})</th>
            <th style="padding:14px 16px;text-align:right;font-weight:700">Revenue @ Current<br/>(GHS ${currentAvgPrice})</th>
            <th style="padding:14px 16px;text-align:right;font-weight:700">Variance</th>
          </tr>
        </thead>
        <tbody>
          ${occLevels.map((level, idx) => {
            // Conditional formatting based on variance percentage
            let bgColor, borderColor, varianceColor, varianceBg;
            
            if (level.variancePct >= 10) {
              // Strong positive (>10%)
              bgColor = '#dcfce7';
              borderColor = '#10b981';
              varianceColor = '#065f46';
              varianceBg = '#a7f3d0';
            } else if (level.variancePct >= 0) {
              // Slight positive (0-10%)
              bgColor = '#f0fdf4';
              borderColor = '#22c55e';
              varianceColor = '#166534';
              varianceBg = '#bbf7d0';
            } else if (level.variancePct >= -10) {
              // Slight negative (0 to -10%)
              bgColor = '#fef3c7';
              borderColor = '#f59e0b';
              varianceColor = '#92400e';
              varianceBg = '#fde68a';
            } else {
              // Strong negative (<-10%)
              bgColor = '#fee2e2';
              borderColor = '#ef4444';
              varianceColor = '#991b1b';
              varianceBg = '#fecaca';
            }
            
            const varianceSign = level.variance >= 0 ? '+' : '';
            const targetStyle = level.isTarget ? `border:3px solid ${borderColor};box-shadow:0 0 0 3px ${bgColor}` : '';
            const targetMarker = level.isTarget ? ' ⭐ TARGET' : '';
            
            return `
              <tr style="background:${bgColor};border-bottom:1px solid #e5e7eb;transition:all 0.2s;${targetStyle}" onmouseover="this.style.transform='scale(1.01)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='${level.isTarget ? '0 0 0 3px ' + bgColor : 'none'}'">
                <td style="padding:14px 16px;font-weight:700;font-size:15px;color:#1e293b">
                  ${level.occ}%${targetMarker}
                </td>
                <td style="padding:14px 16px;text-align:right;font-weight:600;color:#475569;font-size:14px">
                  ${level.nights.toLocaleString()}
                </td>
                <td style="padding:14px 16px;text-align:right;font-weight:700;color:#64748b;font-size:14px">
                  GHS ${level.revenueRequired.toLocaleString()}
                </td>
                <td style="padding:14px 16px;text-align:right;font-weight:700;color:#3b82f6;font-size:14px">
                  GHS ${level.revenueCurrent.toLocaleString()}
                </td>
                <td style="padding:14px 16px;text-align:right">
                  <div style="display:inline-block;padding:6px 12px;background:${varianceBg};border-radius:6px;font-weight:700;color:${varianceColor};font-size:14px">
                    ${varianceSign}GHS ${Math.abs(level.variance).toLocaleString()}
                    <div style="font-size:11px;margin-top:2px">(${varianceSign}${level.variancePct.toFixed(1)}%)</div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="sensitivity-legend" style="margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      <div style="padding:12px;background:#dcfce7;border-radius:6px;border:2px solid #10b981">
        <div style="font-size:11px;color:#065f46;font-weight:600">Strong Positive</div>
        <div style="font-size:10px;color:#166534">Variance > +10%</div>
      </div>
      <div style="padding:12px;background:#f0fdf4;border-radius:6px;border:2px solid #22c55e">
        <div style="font-size:11px;color:#166534;font-weight:600">Slight Positive</div>
        <div style="font-size:10px;color:#16a34a">Variance 0% to +10%</div>
      </div>
      <div style="padding:12px;background:#fef3c7;border-radius:6px;border:2px solid #f59e0b">
        <div style="font-size:11px;color:#92400e;font-weight:600">Slight Negative</div>
        <div style="font-size:10px;color:#b45309">Variance 0% to -10%</div>
      </div>
      <div style="padding:12px;background:#fee2e2;border-radius:6px;border:2px solid #ef4444">
        <div style="font-size:11px;color:#991b1b;font-weight:600">Strong Negative</div>
        <div style="font-size:10px;color:#dc2626">Variance < -10%</div>
      </div>
    </div>
  `;
}

async function renderRateBreakdownVarianceTable(periodKey, roomTypes, selectedRoomId) {
  const [start, end] = periodKey.split('|');
  
  // Load reservations for this period
  const { data: reservations } = await supabase
    .from('reservations')
    .select('*')
    .gte('check_in', start)
    .lte('check_out', end)
    .in('status', ['confirmed', 'checked_in', 'checked_out']);
  
  if (!reservations || reservations.length === 0) {
    return `
      <div style="margin-top:24px">
        <h3 style="font-size:16px;font-weight:700;color:#334155;margin-bottom:12px">📊 Rate Type Performance: Target vs Actual</h3>
        <div style="padding:20px;background:#fef3c7;border-radius:8px;border:1px solid #fcd34d;text-align:center;color:#92400e">
          No reservations found for this period
        </div>
      </div>
    `;
  }
  
  // Filter by room if specific room selected
  let filteredReservations = reservations;
  if (selectedRoomId && selectedRoomId !== 'all') {
    filteredReservations = reservations.filter(r => r.room_type_id === selectedRoomId);
  }
  
  // Load target breakdowns
  let targetBreakdowns = {};
  let periodTargetRevenue = 0; // Track the total target revenue for this period
  
  if (selectedRoomId && selectedRoomId !== 'all') {
    const { data: breakdowns } = await supabase
      .from('revenue_rate_breakdowns')
      .select('*, revenue_targets!inner(room_type_id, period_start, period_end, target_revenue)')
      .eq('revenue_targets.room_type_id', selectedRoomId)
      .eq('revenue_targets.period_start', start)
      .eq('revenue_targets.period_end', end);
    
    if (breakdowns) {
      // Get target revenue from first breakdown (all should have same target)
      periodTargetRevenue = breakdowns[0]?.revenue_targets?.target_revenue || 0;
      
      breakdowns.forEach(b => {
        const key = b.rate_type;
        targetBreakdowns[key] = {
          pct: b.pct_business,
          type: b.rate_type,
          detail: b.type_detail
        };
      });
    }
  } else {
    // Aggregate across all rooms - weight by target revenue
    const roomIds = roomTypes.map(r => r.id);
    const { data: breakdowns } = await supabase
      .from('revenue_rate_breakdowns')
      .select('*, revenue_targets!inner(room_type_id, period_start, period_end, target_revenue)')
      .in('revenue_targets.room_type_id', roomIds)
      .eq('revenue_targets.period_start', start)
      .eq('revenue_targets.period_end', end);
    
    if (breakdowns && breakdowns.length > 0) {
      // Calculate total target revenue across all rooms (avoid double-counting)
      const seenTargets = new Set();
      periodTargetRevenue = breakdowns.reduce((sum, b) => {
        const targetId = b.revenue_target_id;
        const targetRev = b.revenue_targets?.target_revenue || 0;
        if (!seenTargets.has(targetId)) {
          seenTargets.add(targetId);
          return sum + targetRev;
        }
        return sum;
      }, 0);
      
      // Group by rate type and weight by revenue
      const typeMap = {};
      breakdowns.forEach(b => {
        const key = b.rate_type;
        const roomTargetRevenue = b.revenue_targets?.target_revenue || 0;
        const weightedPct = b.pct_business * roomTargetRevenue;
        
        if (!typeMap[key]) {
          typeMap[key] = { 
            totalWeightedPct: 0, 
            totalRevenue: 0,
            type: b.rate_type 
          };
        }
        typeMap[key].totalWeightedPct += weightedPct;
        typeMap[key].totalRevenue += roomTargetRevenue;
      });
      
      // Calculate weighted average percentage for each rate type
      Object.keys(typeMap).forEach(key => {
        const avgPct = typeMap[key].totalRevenue > 0 
          ? typeMap[key].totalWeightedPct / typeMap[key].totalRevenue
          : 0;
        
        targetBreakdowns[key] = {
          pct: Math.round(avgPct),
          type: typeMap[key].type
        };
      });
    }
  }
  
  // Calculate actuals from reservations
  const totalRevenue = filteredReservations.reduce((sum, r) => sum + (r.total || 0), 0);
  const actualsByType = {};
  
  filteredReservations.forEach(res => {
    let rateType = 'Rate card'; // default
    
    if (res.package_code || res.package_name) {
      rateType = 'Packages';
    } else if (res.coupon_code) {
      rateType = 'Coupon Promotions';
    } else if (res.group_reservation_code) {
      rateType = 'Group Bookings';
    }
    
    if (!actualsByType[rateType]) {
      actualsByType[rateType] = { revenue: 0, count: 0 };
    }
    actualsByType[rateType].revenue += res.total || 0;
    actualsByType[rateType].count++;
  });
  
  // Combine targets and actuals
  const allTypes = new Set([...Object.keys(targetBreakdowns), ...Object.keys(actualsByType)]);
  const varianceData = [];
  
  allTypes.forEach(type => {
    const target = targetBreakdowns[type];
    const actual = actualsByType[type];
    
    const targetPct = target ? target.pct : 0;
    // Use period's TARGET revenue, not actual revenue from reservations
    const targetRevenue = Math.round((targetPct / 100) * periodTargetRevenue);
    const actualRevenue = actual ? actual.revenue : 0;
    const actualPct = totalRevenue > 0 ? Math.round((actualRevenue / totalRevenue) * 100) : 0;
    const variance = actualRevenue - targetRevenue;
    const variancePct = targetRevenue > 0 ? ((variance / targetRevenue) * 100) : 0;
    
    varianceData.push({
      type,
      targetPct,
      targetRevenue,
      actualPct,
      actualRevenue,
      actualCount: actual ? actual.count : 0,
      variance,
      variancePct
    });
  });
  
  // Sort by target percentage
  varianceData.sort((a, b) => b.targetPct - a.targetPct);
  
  return `
    <div style="margin-top:24px">
      <h3 style="font-size:16px;font-weight:700;color:#334155;margin-bottom:12px">📊 Rate Type Performance: Target vs Actual</h3>
      <div class="revenue-table-wrapper">
        <table style="width:100%;border-collapse:separate;border-spacing:0;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);min-width:800px">
        <thead>
          <tr style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)">
            <th style="padding:14px 16px;text-align:left;color:white;font-weight:700;font-size:13px">Rate Type</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Target %</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Actual %</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">% Variance</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Target Revenue</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Actual Revenue</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Revenue Variance</th>
            <th style="padding:14px 16px;text-align:right;color:white;font-weight:700;font-size:13px">Bookings</th>
          </tr>
        </thead>
        <tbody>
          ${varianceData.map((row, idx) => {
            const varianceColor = row.variance >= 0 ? '#059669' : '#dc2626';
            const varianceBg = row.variance >= 0 ? '#d1fae5' : '#fee2e2';
            const varianceSign = row.variance >= 0 ? '+' : '';
            
            // Calculate percentage point variance (Actual % - Target %)
            const pctVariance = row.actualPct - row.targetPct;
            const pctVarianceSign = pctVariance >= 0 ? '+' : '';
            const pctVarianceColor = pctVariance >= 0 ? '#059669' : '#dc2626';
            const pctVarianceBg = pctVariance >= 0 ? '#d1fae5' : '#fee2e2';
            
            return `
              <tr style="border-bottom:1px solid #e2e8f0;${idx % 2 === 0 ? 'background:#fafbfc' : 'background:white'}">
                <td style="padding:12px 16px;font-weight:600;color:#334155">${row.type}</td>
                <td style="padding:12px 16px;text-align:right;color:#64748b">${row.targetPct}%</td>
                <td style="padding:12px 16px;text-align:right;font-weight:600;color:#64748b">GHS ${row.targetRevenue.toLocaleString()}</td>
                <td style="padding:12px 16px;text-align:right;color:#3b82f6;font-weight:600">${row.actualPct}%</td>
                <td style="padding:12px 16px;text-align:right">
                  <div style="display:inline-block;padding:6px 10px;background:${pctVarianceBg};border-radius:6px;font-weight:700;color:${pctVarianceColor}">
                    ${pctVarianceSign}${pctVariance}pp
                  </div>
                </td>
                <td style="padding:12px 16px;text-align:right;font-weight:700;color:#3b82f6">GHS ${row.actualRevenue.toLocaleString()}</td>
                <td style="padding:12px 16px;text-align:right;color:#64748b">${row.actualCount}</td>
                <td style="padding:12px 16px;text-align:right">
                  <div style="display:inline-block;padding:6px 12px;background:${varianceBg};border-radius:6px;font-weight:700;color:${varianceColor}">
                    ${varianceSign}GHS ${Math.abs(row.variance).toLocaleString()}
                    <div style="font-size:11px;margin-top:2px">(${varianceSign}${row.variancePct.toFixed(1)}%)</div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
}

function openPeriodModal(roomTypes, activeModelId) {
  console.log('openPeriodModal called with roomTypes:', roomTypes);
  
  const modalId = 'period-modal';
  const existingModal = document.getElementById(modalId);
  if (existingModal) {
    console.log('Modal already exists, removing it first');
    existingModal.remove();
  }
  
  const now = new Date();
  const year = now.getFullYear();
  const defaultStart = `${year}-01-01`;
  const defaultEnd = `${year}-12-31`;
  
  const wrap = document.createElement('div');
  wrap.id = modalId;
  wrap.className = 'modal-backdrop';
  wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  wrap.innerHTML = `
    <div class="modal-dialog" style="background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="hd" style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h3 style="margin:0;color:white;font-size:20px;font-weight:700;">Add Revenue Target Period</h3>
        <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Set revenue targets for each room type</p>
        <button class="btn" onclick="document.getElementById('period-modal').remove()">×</button>
      </div>
      
      <div class="bd" style="padding:24px;overflow-y:auto;flex:1;">
        <div style="margin-bottom:28px;padding:20px;background:#f0f9ff;border-radius:12px;border:2px solid #0369a1;">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:700;color:#0369a1;font-size:14px;">Period Name *</label>
            <input type="text" id="period-name" placeholder="e.g., FY25 Management Targets" required style="width:100%;padding:12px 14px;border:2px solid #0ea5e9;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" onfocus="this.style.borderColor='#0369a1';this.style.boxShadow='0 0 0 3px rgba(3,105,161,0.1)'" onblur="this.style.borderColor='#0ea5e9';this.style.boxShadow='none'" />
            <p style="margin:6px 0 0 0;font-size:12px;color:#0369a1;">Give this revenue target period a descriptive name</p>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px;padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Period Start *</label>
            <input type="date" id="period-start" value="${defaultStart}" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'" />
          </div>
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#334155;font-size:13px;">Period End *</label>
            <input type="date" id="period-end" value="${defaultEnd}" required style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;transition:all 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#e2e8f0'" />
          </div>
        </div>
        
        <h4 style="margin:0 0 16px 0;padding-bottom:12px;border-bottom:2px solid #e2e8f0;font-size:16px;font-weight:700;color:#1e293b;">Targets by Room Type</h4>
        
        <div style="display:grid;gap:20px;">
          ${roomTypes.map((room, idx) => `
            <div style="padding:20px;background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};border-radius:12px;border:2px solid #e2e8f0;transition:all 0.2s;" onmouseover="this.style.borderColor='#667eea';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.15)'" onmouseout="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
              <h5 style="margin:0 0 16px 0;font-weight:700;font-size:15px;color:#1e293b;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">${room.code}</h5>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group">
                  <label style="display:block;margin-bottom:6px;font-weight:600;color:#64748b;font-size:12px;">Target Occupancy % *</label>
                  <input type="number" 
                    class="room-target-occ" 
                    data-room-id="${room.id}" 
                    min="0" 
                    max="100" 
                    value="70" 
                    required 
                    style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" 
                    onfocus="this.style.borderColor='#667eea';this.style.background='#f0f4ff'" 
                    onblur="this.style.borderColor='#e2e8f0';this.style.background='white'" />
                </div>
                <div class="form-group">
                  <label style="display:block;margin-bottom:6px;font-weight:600;color:#64748b;font-size:12px;">Target Revenue (GHS) *</label>
                  <input type="number" 
                    class="room-target-revenue" 
                    data-room-id="${room.id}" 
                    min="0" 
                    step="1000" 
                    value="35000" 
                    required 
                    style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" 
                    onfocus="this.style.borderColor='#667eea';this.style.background='#f0f4ff'" 
                    onblur="this.style.borderColor='#e2e8f0';this.style.background='white'" />
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div id="period-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>
      </div>
      
      <div class="ft" style="padding:20px 24px;border-top:2px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
        <button class="btn" onclick="document.getElementById('${modalId}').remove()" style="padding:12px 24px;border:2px solid #e2e8f0;background:white;border-radius:8px;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='#f1f5f9';this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">Cancel</button>
        <button class="btn btn-primary" id="period-save" style="padding:12px 32px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(102,126,234,0.4);transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(102,126,234,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'">💾 Save Targets</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(wrap);
  
  // Add click outside to close
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) {
      wrap.remove();
    }
  });
  
  const saveBtn = document.getElementById('period-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
    try {
      const periodName = el('period-name').value.trim();
      const periodStart = el('period-start').value;
      const periodEnd = el('period-end').value;
      
      if (!periodName) {
        throw new Error('Period name is required');
      }
      
      if (!periodStart || !periodEnd) {
        throw new Error('Period start and end dates are required');
      }
      
      const targets = roomTypes.map(room => {
        const occ = document.querySelector(`.room-target-occ[data-room-id="${room.id}"]`)?.value;
        const revenue = document.querySelector(`.room-target-revenue[data-room-id="${room.id}"]`)?.value;
        
        if (!occ || !revenue) {
          throw new Error(`Missing targets for ${room.code}`);
        }
        
        return {
          room_type_id: room.id,
          period_start: periodStart,
          period_end: periodEnd,
          period_name: periodName,
          target_occupancy: parseFloat(occ),
          target_revenue: parseFloat(revenue)
        };
      });
      
      const { error } = await supabase
        .from('revenue_targets')
        .insert(targets);
      
      if (error) throw error;
      
      wrap.remove();
      const container = document.querySelector('.analytics-section')?.parentElement;
      if (container) await renderRevenueModel(container, roomTypes, activeModelId);
    } catch (e) {
      showError('period-error', e);
    }
    });
  }
}

async function openEditPeriodModal(start, end, roomTypes, targetsByRoomAndPeriod, activeModelId) {
  const modalId = 'edit-period-modal';
  if (document.getElementById(modalId)) return;
  
  // Get existing period name
  const firstTarget = Object.values(targetsByRoomAndPeriod).find(t => 
    t && t.period_start === start && t.period_end === end
  );
  const existingPeriodName = firstTarget?.period_name || '';
  
  const wrap = document.createElement('div');
  wrap.id = modalId;
  wrap.className = 'modal-backdrop';
  wrap.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
  wrap.innerHTML = `
    <div class="modal-dialog" style="background:white;border-radius:16px;box-shadow:0 25px 80px rgba(0,0,0,0.4);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
      <div class="hd" style="padding:24px;border-bottom:2px solid #e2e8f0;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
        <h3 style="margin:0;color:white;font-size:20px;font-weight:700;">Edit Revenue Targets</h3>
        <div style="margin:4px 0 0 0;color:rgba(255,255,255,0.9);font-size:13px;">${formatDate(start)} - ${formatDate(end)}</div>
        <button class="btn" onclick="document.getElementById('edit-period-modal').remove()">×</button>
      </div>
      
      <div class="bd" style="padding:24px;overflow-y:auto;flex:1;">
        <div style="margin-bottom:28px;padding:20px;background:#fef3c7;border-radius:12px;border:2px solid #f59e0b;">
          <div class="form-group">
            <label style="display:block;margin-bottom:6px;font-weight:700;color:#92400e;font-size:14px;">Period Name *</label>
            <input type="text" id="edit-period-name" value="${existingPeriodName}" placeholder="e.g., FY25 Management Targets" required style="width:100%;padding:12px 14px;border:2px solid #f59e0b;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" onfocus="this.style.borderColor='#d97706';this.style.boxShadow='0 0 0 3px rgba(245,158,11,0.1)'" onblur="this.style.borderColor='#f59e0b';this.style.boxShadow='none'" />
            <p style="margin:6px 0 0 0;font-size:12px;color:#92400e;">Give this revenue target period a descriptive name</p>
          </div>
        </div>
        
        <div style="display:grid;gap:20px;">
          ${roomTypes.map((room, idx) => {
            const key = `${room.id}_${start}_${end}`;
            const target = targetsByRoomAndPeriod[key];
            
            return `
              <div style="padding:20px;background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};border-radius:12px;border:2px solid #e2e8f0;transition:all 0.2s;" onmouseover="this.style.borderColor='#f59e0b';this.style.boxShadow='0 4px 12px rgba(245,158,11,0.15)'" onmouseout="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
                <h5 style="margin:0 0 16px 0;font-weight:700;font-size:15px;color:#1e293b;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">${room.code}</h5>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                  <div class="form-group">
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#64748b;font-size:12px;">Target Occupancy % *</label>
                    <input type="number" 
                      class="room-target-occ" 
                      data-room-id="${room.id}" 
                      min="0" 
                      max="100" 
                      value="${target?.target_occupancy || 70}" 
                      required 
                      style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" 
                      onfocus="this.style.borderColor='#f59e0b';this.style.background='#fffbeb'" 
                      onblur="this.style.borderColor='#e2e8f0';this.style.background='white'" />
                  </div>
                  <div class="form-group">
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#64748b;font-size:12px;">Target Revenue (GHS) *</label>
                    <input type="number" 
                      class="room-target-revenue" 
                      data-room-id="${room.id}" 
                      min="0" 
                      step="1000" 
                      value="${target?.target_revenue || 35000}" 
                      required 
                      style="width:100%;padding:10px 12px;border:2px solid #e2e8f0;border-radius:8px;font-size:14px;font-weight:600;transition:all 0.2s;" 
                      onfocus="this.style.borderColor='#f59e0b';this.style.background='#fffbeb'" 
                      onblur="this.style.borderColor='#e2e8f0';this.style.background='white'" />
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <div id="edit-period-error" class="error" style="display:none;margin-top:16px;padding:12px;background:#fef2f2;border:2px solid #fecaca;border-radius:8px;color:#991b1b;font-size:13px;"></div>
      </div>
      
      <div class="ft" style="padding:20px 24px;border-top:2px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:flex-end;gap:12px;">
        <button class="btn" onclick="document.getElementById('${modalId}').remove()" style="padding:12px 24px;border:2px solid #e2e8f0;background:white;border-radius:8px;font-weight:600;color:#64748b;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='#f1f5f9';this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white';this.style.borderColor='#e2e8f0'">Cancel</button>
        <button class="btn btn-primary" id="edit-period-save" style="padding:12px 32px;background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%);color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(245,158,11,0.4);transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(245,158,11,0.5)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(245,158,11,0.4)'">✏️ Update Targets</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(wrap);
  
  el('edit-period-save')?.addEventListener('click', async () => {
    try {
      const periodName = el('edit-period-name').value.trim();
      
      if (!periodName) {
        throw new Error('Period name is required');
      }
      
      // Delete existing targets for this period
      await supabase
        .from('revenue_targets')
        .delete()
        .eq('period_start', start)
        .eq('period_end', end);
      
      // Insert updated targets
      const targets = roomTypes.map(room => {
        const occ = document.querySelector(`.room-target-occ[data-room-id="${room.id}"]`)?.value;
        const revenue = document.querySelector(`.room-target-revenue[data-room-id="${room.id}"]`)?.value;
        
        if (!occ || !revenue) {
          throw new Error(`Missing targets for ${room.code}`);
        }
        
        return {
          room_type_id: room.id,
          period_start: start,
          period_end: end,
          period_name: periodName,
          target_occupancy: parseFloat(occ),
          target_revenue: parseFloat(revenue)
        };
      });
      
      const { error } = await supabase
        .from('revenue_targets')
        .insert(targets);
      
      if (error) throw error;
      
      wrap.remove();
      const container = document.querySelector('.analytics-section')?.parentElement;
      if (container) await renderRevenueModel(container, roomTypes, activeModelId);
    } catch (e) {
      showError('edit-period-error', e);
    }
  });
}

async function deletePeriodTargets(start, end) {
  await supabase
    .from('revenue_targets')
    .delete()
    .eq('period_start', start)
    .eq('period_end', end);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showError(elementId, error) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = error.message || error;
    el.style.display = 'block';
  }
}