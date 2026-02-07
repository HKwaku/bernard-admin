// This file should be saved as: api/chat.js
// (create an 'api' folder at your project root if it doesn't exist)

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

  // Log for debugging
  console.log('📨 Received request:', {
    method: req.method,
    path: req.url,
    hasBody: !!req.body
  });

  if (req.method !== 'POST') {
    console.error('❌ Wrong method:', req.method);
    return res.status(405).json({ 
      error: `Method ${req.method} not allowed. Use POST.`,
      hint: 'The chat endpoint only accepts POST requests with a JSON body containing messages array.'
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
        console.error('❌ Failed to parse body as JSON:', e.message);
        return res.status(400).json({ error: 'Invalid JSON in request body' });
      }
    } else {
      body = req.body || {};
    }

    console.log('📦 Parsed body:', { hasMessages: !!body.messages, messageCount: body.messages?.length });

    const { messages, threadId } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      console.error('❌ Invalid messages:', messages);
      return res.status(400).json({ 
        error: 'Invalid request: messages array required',
        received: typeof messages,
        hint: 'Send POST request with body: { messages: [{role: "user", content: "..."}] }'
      });
    }

    console.log('✅ Valid request, calling Bernard agent...');

    // Import and run Bernard (multi-agent orchestrator)
    const { runBernardAgent } = await import('../src/bernardAgent.js');
    const result = await runBernardAgent(
      messages, 
      threadId || `thread-${Date.now()}`
    );

    // result is { reply, agent } from the orchestrator
    const reply = typeof result === 'string' ? result : result.reply;
    const agent = typeof result === 'string' ? null : result.agent;

    console.log(`✅ Bernard replied via ${agent || 'router'}`);

    return res.status(200).json({ reply, agent });

  } catch (error) {
    console.error('💥 Bernard agent error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}