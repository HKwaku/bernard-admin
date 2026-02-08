// src/chat.js
// Chat module for Bernard Admin

import { $, addMessage, showTyping, hideTyping } from './utils/helpers.js';

/* ---------------------------
   UI HELPERS
----------------------------*/

/**
 * Convert markdown-like text from agent responses into readable HTML.
 * Handles: **bold**, headers, lists, line breaks, and preserves existing HTML.
 */
function markdownToHtml(text) {
  if (!text || typeof text !== "string") return text;

  // Don't process if it's already mostly HTML (has table tags, div tags, etc.)
  const htmlTagCount = (text.match(/<\/?(?:table|thead|tbody|tr|th|td|div|span|strong|br|ul|ol|li|h[1-6])\b/gi) || []).length;
  const mdMarkerCount = (text.match(/\*\*|^- |^#{1,3} /gm) || []).length;

  // If it already has lots of HTML and few markdown markers, skip conversion
  if (htmlTagCount > 5 && mdMarkerCount < 3) return text;

  let result = text;

  // Protect existing HTML tags from being broken
  const htmlBlocks = [];
  // First pass: protect complete <table>...</table> blocks (greedy, so nested tags stay intact)
  result = result.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    htmlBlocks.push(match);
    return `__HTML_BLOCK_${htmlBlocks.length - 1}__`;
  });
  // Second pass: protect complete <div>...</div> blocks
  result = result.replace(/<div[\s\S]*?<\/div>/gi, (match) => {
    htmlBlocks.push(match);
    return `__HTML_BLOCK_${htmlBlocks.length - 1}__`;
  });
  // Third pass: protect remaining paired HTML tags
  result = result.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, (match) => {
    htmlBlocks.push(match);
    return `__HTML_BLOCK_${htmlBlocks.length - 1}__`;
  });
  // Also protect self-closing / void tags
  result = result.replace(/<[^>]+\/?>(?![\s\S]*<\/)/g, (match) => {
    htmlBlocks.push(match);
    return `__HTML_BLOCK_${htmlBlocks.length - 1}__`;
  });

  // Headers: ## Header → <strong style="...">Header</strong>
  result = result.replace(/^### (.+)$/gm, '<strong style="font-size:0.95em;display:block;margin:12px 0 4px">$1</strong>');
  result = result.replace(/^## (.+)$/gm, '<strong style="font-size:1.05em;display:block;margin:14px 0 6px">$1</strong>');

  // Bold: **text** → <strong>text</strong>
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* → <em>text</em> (but not inside HTML attributes)
  result = result.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>');

  // Bullet lists: lines starting with "- " → <li>
  // Group consecutive list items into <ul>
  result = result.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n')
      .filter(line => line.trim().startsWith('- '))
      .map(line => `<li style="margin:2px 0;padding-left:4px">${line.replace(/^- /, '').trim()}</li>`)
      .join('');
    return `<ul style="list-style:disc;padding-left:20px;margin:6px 0">${items}</ul>`;
  });

  // Indented sub-items: "  - text" → nested items (already handled above, but let's clean up)
  result = result.replace(/<li([^>]*)>\s*<ul/g, '<li$1 style="margin:0"><ul');

  // Markdown tables: | col | col | → HTML table
  const tableRegex = /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/g;
  result = result.replace(tableRegex, (match, headerRow, separatorRow, bodyRows) => {
    const headers = headerRow.split('|').filter(c => c.trim()).map(c => `<th style="padding:6px 10px;text-align:left;border-bottom:2px solid #e5e7eb;font-weight:600;font-size:0.8rem">${c.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td style="padding:5px 10px;border-bottom:1px solid #f0f0f0;font-size:0.8rem">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:0.85rem"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Line breaks: \n → <br> (but not inside <ul> or <table>)
  result = result.replace(/\n/g, '<br>');
  // Clean up excess <br> after block elements
  result = result.replace(/(<\/ul>)<br>/g, '$1');
  result = result.replace(/(<\/table>)<br>/g, '$1');
  result = result.replace(/<br>(<ul|<table)/g, '$1');

  // Restore protected HTML blocks
  htmlBlocks.forEach((block, i) => {
    result = result.replace(`__HTML_BLOCK_${i}__`, block);
  });

  // Clean up <br> tags adjacent to block-level HTML elements (tables, divs, uls)
  result = result.replace(/(<br\s*\/?>)+\s*(<table|<div|<ul)/gi, '$2');
  result = result.replace(/(<\/table>|<\/div>|<\/ul>)\s*(<br\s*\/?>)+/gi, '$1');
  // Reduce excessive <br> between a heading/bold and a block element to a single <br>
  result = result.replace(/(<\/strong>)\s*(<br\s*\/?>){2,}\s*(<table|<div)/gi, '$1<br>$3');
  // Collapse multiple consecutive <br> into max 2
  result = result.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');

  return result;
}

function wrapChatTables(html) {
  if (!html || typeof html !== "string") return html;

  // Convert markdown to HTML first
  html = markdownToHtml(html);

  // Wrap any rendered HTML tables in a scroll container
  return html.replace(
    /<table[\s\S]*?<\/table>/gi,
    (tbl) => `<div class="chat-table-scroll">${tbl}</div>`
  );
}


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

  // Status bubble with routing indicator
  const statusBubble = appendStatusBubble("🔀 Routing to specialist...");

  try {
    // Push user message into Bernard history
    bernardHistory.push({ role: "user", content: text });

    const startTime = Date.now();

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
    const agent = data?.agent;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Bernard response time: ${elapsed}s (via ${agent || 'router'})`);

    hideTyping();
    $("#status-indicator")?.remove();

    const finalReply = reply || "Done.";

    // Show agent badge before the reply if a specialist handled it
    const agentBadge = agent
      ? `<div style="display:inline-block;font-size:0.7rem;padding:2px 8px;margin-bottom:6px;border-radius:10px;background:#f0f4ff;color:#3b5998;font-weight:600;letter-spacing:0.3px;">🤖 ${agent}</div><br/>`
      : '';
    addMessage(agentBadge + wrapChatTables(finalReply));

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