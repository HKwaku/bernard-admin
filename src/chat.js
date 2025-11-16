// src/chat.js
// Chat module for Bernard Admin

import { $, addMessage, showTyping, hideTyping } from './utils/helpers.js';
import { callOpenAI, conversationHistory } from './config/openai.js';

/* ---------------------------
   UI HELPERS
----------------------------*/

function appendStatusBubble(text = "Thinking...") {
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

/* ---------------------------
   SEND HANDLER
----------------------------*/

async function sendMessage() {
  const input = $("#user-input");
  if (!input) return;

  const text = (input.value || "").trim();
  if (!text) return;

  // Add the user message to UI + memory
  addMessage(text, true);
  input.value = "";

  showTyping();

  // Status bubble (updated dynamically)
  const statusBubble = appendStatusBubble("🤔 Thinking...");

  try {
    const reply = await callOpenAI(conversationHistory, text, (status) => {
      if (status && statusBubble) statusBubble.textContent = status;
    });

    hideTyping();
    $("#status-indicator")?.remove();

    addMessage(reply || "Done.");
  } catch (err) {
    hideTyping();
    $("#status-indicator")?.remove();
    addMessage(`<span style="color:#b91c1c">✖ AI service temporarily unavailable.</span>`);
    console.error(err);
  }
}

/* ---------------------------
   PUBLIC: initChat()
----------------------------*/

function initChat() {
  // Clear old listeners by cloning the button
  const sendBtn = $("#send-btn");
  if (sendBtn) {
    const newBtn = sendBtn.cloneNode(true);
    sendBtn.replaceWith(newBtn);
    newBtn.addEventListener("click", sendMessage);
  }

  const input = $("#user-input");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Intro message shown once when the Chat tab is first loaded
  addMessage(`Hello! My name is <strong>Bernard</strong>. What would you like to do today?`);
}

export { initChat };
