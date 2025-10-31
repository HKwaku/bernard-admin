// Utility Helper Functions

export const $ = (selector) => document.querySelector(selector);

export function formatCurrency(amount, currency = 'GBP') {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency
  }).format(Number(amount || 0));
}

export function openModal(id) {
  $(`#${id}-modal`)?.classList.add('show');
}

export function closeModal(id) {
  $(`#${id}-modal`)?.classList.remove('show');
}

export function addMessage(text, isUser = false) {
  const messagesDiv = $("#messages");
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

export function showTyping() {
  const messagesDiv = $("#messages");
  const typing = document.createElement("div");
  typing.className = "message bot";
  typing.id = "typing-indicator";
  typing.innerHTML = `<div class="avatar">🤖</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  messagesDiv.appendChild(typing);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function hideTyping() {
  const typing = document.getElementById("typing-indicator");
  if (typing) typing.remove();
}
