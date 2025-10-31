export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function addMessage(html, isUser = false) {
  const box = $('#messages');
  if (!box) return;
  const row = document.createElement('div');
  row.style.margin = '8px 0';
  row.style.textAlign = isUser ? 'right' : 'left';
  row.innerHTML = `<span style="
    display:inline-block;
    padding:8px 12px;
    border-radius:12px;
    ${isUser
      ? 'background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff'
      : 'background:#f3f4f6;color:#111827;border:1px solid #e5e7eb'}
  ">${html}</span>`;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

export function showTyping() { addMessage('<em>Bernard is thinking…</em>'); }
export function hideTyping() {
  const box = $('#messages'); if (!box) return;
  const last = box.lastElementChild;
  if (last && last.textContent.includes('Bernard is thinking')) last.remove();
}

export function formatCurrency(amount, currency = 'GBP', locale = 'en-GB') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount || 0));
}

export function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('show'); }
export function closeModal(id){ const m = document.getElementById(id); if (m) m.classList.remove('show'); }

export function toast(msg) {
  let t = $('#__toast__');
  if (!t) {
    t = document.createElement('div'); t.id='__toast__';
    t.style.cssText='position:fixed;right:16px;bottom:16px;background:#111827;color:#fff;padding:10px 14px;border-radius:10px;z-index:1000';
    document.body.appendChild(t);
  }
  t.textContent = msg; setTimeout(()=>t.remove(), 2500);
}
