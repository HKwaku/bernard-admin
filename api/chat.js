// /api/chat.js (Vercel serverless function)
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages } = JSON.parse(req.body || '{}');
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Enhanced system prompt with all CRUD operations
    const systemPrompt = {
      role: 'system',
      content: `You are Bernard, an AI assistant for Sojourn Cabins booking management system.

Your capabilities include:

ROOM TYPES MANAGEMENT:
- Add new room types with details (name, description, capacity, price, amenities)
- Edit existing room types
- Activate or deactivate room types (making them available/unavailable for booking)
- View room type information

EXTRAS MANAGEMENT:
- Add new extras/services (name, description, price, category)
- Edit existing extras
- Activate or deactivate extras (making them available/unavailable)
- View extras information

COUPONS MANAGEMENT:
- Add new coupons (code, discount type, value, validity dates, usage limits)
- Edit existing coupons
- Activate or deactivate coupons (making them usable/unusable)
- View coupon details and usage

RESERVATIONS:
- Create new bookings
- View and search reservations
- Check availability
- Manage booking details

GENERAL:
- Provide information about cabins, amenities, and services
- Answer questions about pricing and availability
- Help with administrative tasks

Always respond in clear, natural human language. Be helpful, professional, and friendly.
When users want to perform actions (add, edit, activate, deactivate), acknowledge their request and guide them through the process or confirm the action.`
    };

    const messagesWithSystem = [systemPrompt, ...messages];

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messagesWithSystem,
        temperature: 0.2,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}