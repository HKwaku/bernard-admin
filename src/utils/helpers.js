// utils/helpers.js

// DOM selection helpers
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Chat helpers
export function addMessage(text, isUser = false) {
  const messagesDiv = $('#messages');
  if (!messagesDiv) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = isUser ? 'msg user' : 'msg bot';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = text;
  
  msgDiv.appendChild(bubble);
  messagesDiv.appendChild(msgDiv);
  
  // Scroll to bottom
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function showTyping() {
  const messagesDiv = $('#messages');
  if (!messagesDiv) return;

  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg bot';
  typingDiv.id = 'typing-indicator';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble typing';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  
  typingDiv.appendChild(bubble);
  messagesDiv.appendChild(typingDiv);
  
  // Scroll to bottom
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function hideTyping() {
  const typingIndicator = $('#typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Modal helpers
export function openModal(modalId) {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.add('show');
  }
}

export function closeModal(modalId) {
  const modal = $(`#${modalId}`);
  if (modal) {
    modal.classList.remove('show');
  }
}

// Currency formatter
export function formatCurrency(amount, currency = 'GBP') {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    // Fallback if currency is invalid
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

// Toast notification (simple version)
export function toast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  alert(message); // Simple fallback, replace with better toast UI if needed
}
// ---------- Coupon Helpers ----------
async function fetchCoupons() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    toast('Failed to load coupons', 'error');
    return [];
  }
  return data || [];
}

async function onCouponAdd() {
  const code = prompt('Coupon code (e.g. SUMMER25)');
  if (!code) return;

  const type = prompt('Type: "percent" or "amount"', 'percent') || 'percent';
  const valueStr = prompt(type === 'percent' ? 'Percent off (e.g. 15)' : 'Amount off (e.g. 50.00)', '10');
  if (valueStr == null) return;
  const value = Number(valueStr);
  if (Number.isNaN(value)) { toast('Invalid discount value', 'error'); return; }

  const description = prompt('Description (optional)', '') || '';
  const active = confirm('Mark active? OK = Yes, Cancel = No');

  const payload = {
    code: code.trim(),
    type,
    value,
    description,
    active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('coupons').insert(payload);
  if (error) { console.error(error); toast('Failed to create coupon', 'error'); return; }

  toast('Coupon created');
  initCoupons();
}

async function onCouponEdit(id) {
  if (!id) return;
  const { data, error } = await supabase.from('coupons').select('*').eq('id', id).single();
  if (error || !data) { console.error(error); toast('Failed to load coupon', 'error'); return; }

  const code = prompt('Coupon code', data.code);
  if (!code) return;

  const type = prompt('Type: "percent" or "amount"', data.type || 'percent') || 'percent';
  const valueStr = prompt(type === 'percent' ? 'Percent off' : 'Amount off', String(data.value ?? ''));
  if (valueStr == null) return;
  const value = Number(valueStr);
  if (Number.isNaN(value)) { toast('Invalid discount value', 'error'); return; }

  const description = prompt('Description (optional)', data.description || '') || '';
  const active = confirm('Active? OK = Yes, Cancel = No');

  const payload = {
    code: code.trim(),
    type,
    value,
    description,
    active,
    updated_at: new Date().toISOString(),
  };

  const { error: uErr } = await supabase.from('coupons').update(payload).eq('id', id);
  if (uErr) { console.error(uErr); toast('Failed to save coupon', 'error'); return; }

  toast('Coupon updated');
  initCoupons();
}

async function onCouponDeactivate(id) {
  if (!id) return;
  if (!confirm('Deactivate this coupon?')) return;

  const { error } = await supabase
    .from('coupons')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) { console.error(error); toast('Could not deactivate coupon', 'error'); return; }
  toast('Coupon deactivated');
  initCoupons();
}
