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

// Date formatter - Centralized format: dd-Mmm-yyyy (e.g., 15 Jan 2025)
export function formatDate(dateInput) {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    
    // Check if valid date
    if (isNaN(date.getTime())) return dateInput;
    
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return dateInput;
  }
}

// Parse SQL date (YYYY-MM-DD) to Date object
export function parseDate(dateString) {
  if (!dateString) return null;
  return new Date(dateString + 'T00:00:00');
}

// Format date for SQL/database (YYYY-MM-DD)
export function formatDateForDB(dateInput) {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Date DB formatting error:', error);
    return '';
  }
}

// Toast notification (simple version)
export function toast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  alert(message); // Simple fallback, replace with better toast UI if needed
}