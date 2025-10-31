export const conversationHistory = [
  { role: 'system', content: 'You are Bernard, a helpful hotel admin assistant.' },
];

// Start with a mock reply so you can test UI without serverless yet
export async function callOpenAI(history, userText) {
  await new Promise(r => setTimeout(r, 250));
  return `Echo: ${userText}`;
}

/* 
When ready, swap to your API route:

export async function callOpenAI(history, userText) {
  const messages = [...history, { role: 'user', content: userText }];
  const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'AI error');
  return j.reply;
}
*/
