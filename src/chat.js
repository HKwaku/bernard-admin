// src/chat.js
// Chat module for Bernard Admin

import { $, addMessage, showTyping, hideTyping } from './utils/helpers.js';

/* ---------------------------
   UI HELPERS
----------------------------*/

function appendStatusBubble(text = "Thinking.") {
  const messagesDiv = $("#messages");
  const statusDiv = document.createElement("div");
  statusDiv.className = "msg bot";
  statusDiv.id = "status-indicator";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.style.fontStyle = "italic";
  bubble.style.opacity = "0.8";
  bubble.textContent = text;

  statusDiv.appendChild(bubble);
  messagesDiv.appendChild(statusDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return bubble;
}

// Bernard conversation state for the agent
let bernardHistory = [];

/* ---------------------------
   SEND HANDLER
----------------------------*/

async function sendMessage() {
  const input = $("#user-input");
  if (!input) return;

  const text = (input.value || "").trim();
  if (!text) return;

  // Add the user message to UI
  addMessage(text, true);
  input.value = "";

  showTyping();

  // Status bubble
  const statusBubble = appendStatusBubble("🤔 Thinking (using tools)…");

  try {
    // Push user message into Bernard history
    bernardHistory.push({ role: "user", content: text });

    // SAME-ORIGIN in production (Vercel), and also works locally if you run the API
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: bernardHistory }),
    });

    let data = null;
    try { data = await resp.json(); } catch (_) {}

    if (!resp.ok) {
      throw new Error(data?.error || `Bernard API failed (${resp.status})`);
    }

    const reply = data?.reply;

    hideTyping();
    $("#status-indicator")?.remove();

    const finalReply = reply || "Done.";
    addMessage(finalReply);

    // Push assistant reply into Bernard history
    bernardHistory.push({ role: "assistant", content: finalReply });
  } catch (err) {
    hideTyping();
    $("#status-indicator")?.remove();
    addMessage(`<span style="color:#b91c1c">✖ ${err?.message || "Bernard is temporarily unavailable."}</span>`);
    console.error(err);
  }
}

/* ---------------------------
   PUBLIC: initChat()
----------------------------*/

function initChat() {
  // Clear messages so the welcome appears immediately on Chat tab click
  const messagesDiv = $("#messages");
  if (messagesDiv) messagesDiv.innerHTML = "";

  // Reset Bernard memory for the UI session
  bernardHistory = [];

  // Clear old listeners by cloning the button
  const sendBtn = $("#send-btn");
  if (sendBtn) {
    const newBtn = sendBtn.cloneNode(true);
    sendBtn.replaceWith(newBtn);
    newBtn.addEventListener("click", sendMessage);
  }

  const input = $("#user-input");
  if (input) {
    input.value = "";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Welcome message should pop immediately when user clicks Chat tab
  addMessage(`Hello! My name is <strong>Bernard</strong>. What would you like to do today?`);
}

export { initChat };
