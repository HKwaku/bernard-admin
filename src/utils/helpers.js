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
