// ============================================================================
// Bernard Admin - Main Application Logic
// ============================================================================
// TODO: Copy your JavaScript from the original HTML file here
//
// Instructions:
// 1. Open your original HTML file
// 2. Find all code between <script> tags (around line 800-2300)
// 3. Copy everything
// 4. Paste below this comment
// 5. Make sure to keep the imports above
//
// Already imported for you:
// - supabase (database client)
// - callOpenAI (AI assistant)
// - $ (DOM selector)
// - formatCurrency, addMessage, showTyping, hideTyping, openModal, closeModal
// ============================================================================

import { supabase } from './config/supabase.js';
import { callOpenAI, conversationHistory } from './config/openai.js';
import { 
  $, 
  formatCurrency, 
  addMessage, 
  showTyping, 
  hideTyping, 
  openModal, 
  closeModal 
} from './utils/helpers.js';

// ============================================================================
// PASTE YOUR JAVASCRIPT CODE BELOW THIS LINE
// ============================================================================

(() => {
  /* ====== CONFIG ====== */
  const SUPABASE_URL = "https://pqtedphijayclewljlkq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdGVkcGhpamF5Y2xld2xqbGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzUxMzAsImV4cCI6MjA3NjgxMTEzMH0.a98g5NyfxlQIRMlIaVdj88CVE1dWP03J-XNgK-Sw_Ng";

  /* ====== SUPABASE CLIENT ====== */
  class SupabaseClient {
    constructor(url, key) {
      this.url = url;
      this.key = key;
      this.headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
    }

    async query(table, params = {}) {
      const qs = new URLSearchParams();
      if (params.select) qs.set('select', params.select);
      if (params.eq) Object.entries(params.eq).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      if (params.order) qs.set('order', params.order);
      if (params.limit) qs.set('limit', params.limit);
      if (params.like) Object.entries(params.like).forEach(([k, v]) => qs.set(k, `like.%${v}%`));
      if (params.gte) Object.entries(params.gte).forEach(([k, v]) => qs.set(k, `gte.${v}`));
      if (params.lte) Object.entries(params.lte).forEach(([k, v]) => qs.set(k, `lte.${v}`));

      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) throw new Error(`Query error: ${res.status}`);
      return res.json();
    }

    async rpc(functionName, params = {}) {
      const url = `${this.url}/rest/v1/rpc/${functionName}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`RPC error: ${res.status}`);
      return res.json();
    }

    async insert(table, data) {
      const url = `${this.url}/rest/v1/${table}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Insert error: ${res.status}`);
      return res.json();
    }

    async update(table, data, match) {
      const qs = new URLSearchParams();
      Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Update error: ${res.status}`);
      return res.json();
    }

    async delete(table, match) {
      const qs = new URLSearchParams();
      Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!res.ok) throw new Error(`Delete error: ${res.status}`);
      return res.json();
    }
  }

  const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ====== HELPERS ====== */
  const $ = s => document.querySelector(s);
  const messagesDiv = $("#messages");
  const userInput = $("#user-input");

  function formatCurrency(amount, currency = 'GBP') {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency
    }).format(Number(amount || 0));
  }

  function addMessage(text, isUser = false) {
    const msg = document.createElement("div");
    msg.className = `message ${isUser ? 'user' : 'bot'}`;
    if (!isUser) {
      msg.innerHTML = `<div class="avatar">🤖</div><div class="bubble">${text}</div>`;
    } else {
      msg.innerHTML = `<div class="bubble">${text}</div>`;
    }
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "message bot";
    typing.id = "typing-indicator";
    typing.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("typing-indicator");
    if (typing) typing.remove();
  }

  /* ====== VIEW SWITCHING ====== */
  let currentView = 'list';

  function switchView(viewName) {
    document.querySelectorAll('[id^="view-"]').forEach(panel => {
      panel.style.display = 'none';
    });
    const selectedView = document.getElementById(`view-${viewName}`);
    if (selectedView) selectedView.style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
  }

})();
(() => {
  /* ====== CONFIG ====== */
  const SUPABASE_URL = "https://pqtedphijayclewljlkq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdGVkcGhpamF5Y2xld2xqbGtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMzUxMzAsImV4cCI6MjA3NjgxMTEzMH0.a98g5NyfxlQIRMlIaVdj88CVE1dWP03J-XNgK-Sw_Ng";

  /* ====== SUPABASE CLIENT ====== */
  class SupabaseClient {
    constructor(url, key) {
      this.url = url;
      this.key = key;
      this.headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };
    }

    async query(table, params = {}) {
      const qs = new URLSearchParams();
      if (params.select) qs.set('select', params.select);
      if (params.eq) Object.entries(params.eq).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      if (params.order) qs.set('order', params.order);
      if (params.limit) qs.set('limit', params.limit);
      if (params.like) Object.entries(params.like).forEach(([k, v]) => qs.set(k, `like.%${v}%`));
      if (params.gte) Object.entries(params.gte).forEach(([k, v]) => qs.set(k, `gte.${v}`));
      if (params.lte) Object.entries(params.lte).forEach(([k, v]) => qs.set(k, `lte.${v}`));

      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, { headers: this.headers });
      if (!res.ok) throw new Error(`Query error: ${res.status}`);
      return res.json();
    }

    async rpc(functionName, params = {}) {
      const url = `${this.url}/rest/v1/rpc/${functionName}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error(`RPC error: ${res.status}`);
      return res.json();
    }

    async insert(table, data) {
      const url = `${this.url}/rest/v1/${table}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Insert error: ${res.status}`);
      return res.json();
    }

    async update(table, data, match) {
      const qs = new URLSearchParams();
      Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`Update error: ${res.status}`);
      return res.json();
    }

    async delete(table, match) {
      const qs = new URLSearchParams();
      Object.entries(match).forEach(([k, v]) => qs.set(k, `eq.${v}`));
      const url = `${this.url}/rest/v1/${table}?${qs.toString()}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!res.ok) throw new Error(`Delete error: ${res.status}`);
      return res.json();
    }
  }

  const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ====== HELPERS ====== */
  const $ = s => document.querySelector(s);
  const messagesDiv = $("#messages");
  const userInput = $("#user-input");

  function formatCurrency(amount, currency = 'GBP') {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency
    }).format(Number(amount || 0));
  }

  function addMessage(text, isUser = false) {
    const msg = document.createElement("div");
    msg.className = `message ${isUser ? 'user' : 'bot'}`;
    if (!isUser) {
      msg.innerHTML = `<div class="avatar">🤖</div><div class="bubble">${text}</div>`;
    } else {
      msg.innerHTML = `<div class="bubble">${text}</div>`;
    }
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "message bot";
    typing.id = "typing-indicator";
    typing.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    messagesDiv.appendChild(typing);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("typing-indicator");
    if (typing) typing.remove();
  }

  /* ====== VIEW SWITCHING ====== */
  let currentView = 'list';

  function switchView(viewName) {
    document.querySelectorAll('[id^="view-"]').forEach(panel => {
      panel.style.display = 'none';
    });
    const selectedView = document.getElementById(`view-${viewName}`);
    if (selectedView) selectedView.style.display = 'flex';
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
  }

})();


// ============================================================================
// PASTE YOUR JAVASCRIPT CODE ABOVE THIS LINE
// ============================================================================
