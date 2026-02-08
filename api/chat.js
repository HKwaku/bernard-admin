// api/chat.js — Vercel serverless function for Bernard multi-agent chatbot
// Static import ensures Vercel's bundler includes all agent dependencies

import { runBernardAgent } from '../src/bernardAgent.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: `Method ${req.method} not allowed. Use POST.`
    });
  }

  try {
    // Check API key
    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ Missing OpenAI API key');
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        hint: 'Set OPENAI_API_KEY in Vercel environment variables'
      });
    }

    // Parse request body
    let body;
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    } else {
      body = req.body || {};
    }

    const { messages, threadId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required',
        hint: 'Send POST with body: { messages: [{role: "user", content: "..."}] }'
      });
    }

    console.log(`📨 Bernard request: ${messages.length} messages`);

    const result = await runBernardAgent(
      messages, 
      threadId || `thread-${Date.now()}`
    );

    const reply = typeof result === 'string' ? result : result.reply;
    const agent = typeof result === 'string' ? null : result.agent;

    console.log(`✅ Bernard replied via ${agent || 'router'}`);

    return res.status(200).json({ reply, agent });

  } catch (error) {
    console.error('💥 Bernard agent error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      type: error.name,
    });
  }
}
