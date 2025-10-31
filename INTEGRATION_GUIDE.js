// EXAMPLE: How to integrate your original JavaScript into the new structure
// This file shows you exactly where to put your code

// ============================================================================
// METHOD 1: QUICK & SIMPLE - Single App File
// ============================================================================
// Create: src/app.js

import { supabase } from './config/supabase.js';
import { callOpenAI, conversationHistory } from './config/openai.js';
import { $, formatCurrency, addMessage, showTyping, hideTyping, openModal, closeModal } from './utils/helpers.js';

// 1. COPY ALL YOUR ORIGINAL JAVASCRIPT HERE
// Just paste everything from between the <script> tags in your original HTML

// For example, your processCommand function:
export async function processCommand(input) {
  const lower = input.toLowerCase();
  
  // Cancel booking
  if (lower.includes('cancel') && (lower.includes('booking') || lower.includes('bk'))) {
    const codeMatch = input.match(/BK\d{6}/i);
    if (codeMatch) {
      try {
        const code = codeMatch[0].toUpperCase();
        await supabase.update('reservations', { status: 'cancelled' }, { confirmation_code: code });
        const aiResponse = await callOpenAI(`Booking ${code} has been cancelled successfully.`);
        return `✅ ${aiResponse}`;
      } catch (e) {
        return `❌ Error: ${e.message}`;
      }
    }
    // ... rest of your logic
  }
  
  // ... all your other command handling logic
}

// 2. EXPORT ANY FUNCTIONS YOU NEED TO CALL FROM OTHER FILES
export { loadReservationsList, loadRoomsList, loadStats, /* etc */ };

// 3. ADD INITIALIZATION CODE
export function initApp() {
  // Set up event listeners
  $("#send-btn")?.addEventListener("click", handleSend);
  // ... all your other initialization
}

// ============================================================================
// METHOD 2: MODULAR - Split by Feature (Recommended for larger projects)
// ============================================================================

// ----- src/components/chat.js -----
import { supabase } from '../config/supabase.js';
import { callOpenAI } from '../config/openai.js';
import { $, addMessage, showTyping, hideTyping } from '../utils/helpers.js';

export async function initChat() {
  const userInput = $("#user-input");
  const sendBtn = $("#send-btn");
  
  sendBtn?.addEventListener("click", handleSend);
  userInput?.addEventListener("keypress", e => {
    if (e.key === "Enter") handleSend();
  });
  
  // Quick action buttons
  document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      userInput.value = btn.dataset.action;
      handleSend();
    });
  });
}

async function handleSend() {
  const userInput = $("#user-input");
  const text = userInput?.value.trim();
  if (!text) return;
  
  addMessage(text, true);
  userInput.value = "";
  showTyping();
  
  setTimeout(async () => {
    hideTyping();
    const response = await processCommand(text);
    addMessage(response);
  }, 600);
}

export async function processCommand(input) {
  // Your command processing logic here
  // This is where you paste all your bot command handlers
}

// ----- src/components/reservations.js -----
import { supabase } from '../config/supabase.js';
import { formatCurrency } from '../utils/helpers.js';

export async function initReservations() {
  // Set up reservation view event listeners
  $("#search-reservations")?.addEventListener('input', (e) => {
    loadReservationsList(e.target.value);
  });
  
  $("#list-view-btn")?.addEventListener('click', () => {
    loadReservationsList();
  });
  
  $("#calendar-view-btn")?.addEventListener('click', () => {
    loadCalendarView();
  });
}

export async function loadReservationsList(searchTerm = '', selectedYear = null, selectedMonth = null) {
  // Your reservations list loading logic here
}

export async function loadCalendarView(selectedYear, selectedMonth) {
  // Your calendar view logic here
}

// ----- src/components/rooms.js -----
import { supabase } from '../config/supabase.js';
import { formatCurrency, openModal } from '../utils/helpers.js';

export async function initRooms() {
  $("#add-room-btn")?.addEventListener("click", () => {
    openModal('room');
  });
  
  $("#save-room-btn")?.addEventListener("click", saveRoom);
  
  // Load initial room list
  loadRoomsList();
}

export async function loadRoomsList() {
  // Your rooms list loading logic here
}

async function saveRoom() {
  // Your save room logic here
}

// ----- src/services/stats.js -----
import { supabase } from '../config/supabase.js';
import { $ } from '../utils/helpers.js';

export async function loadStats() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    const [ci, all, mon, nights] = await Promise.all([
      supabase.query('reservations', { select: 'id', eq: { check_in: today, status: 'confirmed' } }),
      supabase.query('reservations', { select: 'id', eq: { status: 'confirmed' } }),
      supabase.query('reservations', { select: 'id', eq: { status: 'confirmed' }, gte: { check_in: month } }),
      supabase.query('reservations', { select: 'nights', eq: { status: 'confirmed' } })
    ]);
    
    $("#stat-checkins").textContent = ci.length;
    $("#stat-total").textContent = all.length;
    $("#stat-month").textContent = mon.length;
    $("#stat-nights").textContent = nights.reduce((s, r) => s + (r.nights || 0), 0);
    
    // Load recent bookings
    const recent = await supabase.query('reservations', {
      select: 'guest_first_name,guest_last_name,room_name,status,check_in,confirmation_code',
      order: 'created_at.desc',
      limit: 5
    });
    
    $("#recent-bookings").innerHTML = recent.map(r => `
      <div class="data-row" style="flex-direction:column;align-items:flex-start">
        <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:4px">
          <strong>${r.guest_first_name} ${r.guest_last_name}</strong>
          <span class="badge ${r.status}">${r.status}</span>
        </div>
        <span style="font-size:12px;color:#94a3b8">${r.room_name} • ${r.check_in}</span>
        <span style="font-size:11px;color:#64748b">${r.confirmation_code}</span>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error loading stats:', e);
  }
}

// ============================================================================
// UPDATE: src/main.js - Main Entry Point
// ============================================================================

import './styles.css';

// METHOD 1: If using single app.js file
import { initApp } from './app.js';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

// METHOD 2: If using modular approach
/*
import { initChat } from './components/chat.js';
import { initReservations } from './components/reservations.js';
import { initRooms } from './components/rooms.js';
import { initExtras } from './components/extras.js';
import { initCoupons } from './components/coupons.js';
import { initPackages } from './components/packages.js';
import { loadStats } from './services/stats.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all components
  initChat();
  initReservations();
  initRooms();
  initExtras();
  initCoupons();
  initPackages();
  
  // Load initial stats
  loadStats();
  
  // Refresh stats every 30 seconds
  setInterval(loadStats, 30000);
  
  // Update current time
  setInterval(() => {
    const timeEl = document.getElementById("current-time");
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleString('en-GB', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  }, 1000);
  
  // Set default dates for booking form
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  const checkInInput = document.getElementById("b-checkin");
  const checkOutInput = document.getElementById("b-checkout");
  
  if (checkInInput) checkInInput.value = tomorrow.toISOString().split('T')[0];
  if (checkOutInput) checkOutInput.value = dayAfter.toISOString().split('T')[0];
});
*/

// ============================================================================
// TIPS FOR MIGRATION
// ============================================================================

/*
1. START SIMPLE:
   - Use Method 1 first (single app.js file)
   - Get everything working
   - Then refactor to Method 2 if needed

2. COMMON ISSUES:
   - Make sure to export/import functions properly
   - Watch for `this` context issues
   - Check that $ selector is imported where needed

3. TESTING:
   - Test each feature as you migrate
   - Check browser console for errors
   - Use `npm run dev` to see changes in real-time

4. DEBUGGING:
   - Add console.log() statements liberally
   - Check Network tab for API calls
   - Verify Supabase and OpenAI connections

5. BEST PRACTICES:
   - Keep related functions together
   - Export only what's needed
   - Use meaningful file names
   - Add comments for complex logic
*/

// ============================================================================
// READY TO START?
// ============================================================================

/*
STEP 1: Copy your original JavaScript
  1. Open your original HTML file
  2. Find all code between <script> tags
  3. Copy it

STEP 2: Create src/app.js
  1. Paste your JavaScript
  2. Add imports at the top (see above)
  3. Export functions that need to be called from main.js

STEP 3: Update src/main.js
  1. Import from app.js
  2. Call initialization functions in DOMContentLoaded

STEP 4: Test
  npm run dev

STEP 5: Debug
  - Check console for errors
  - Fix import/export issues
  - Test all features

That's it! Your app is now modular and deployable! 🎉
*/
