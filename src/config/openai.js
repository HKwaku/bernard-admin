// OpenAI Configuration and Helper
const OPENAI_API_KEY = "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";

export let conversationHistory = [];

export async function callOpenAI(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });
  
  const systemPrompt = {
    role: 'system',
    content: `You are Bernard, a helpful admin assistant for Sojourn Cabins in Ghana. Be concise, friendly, and professional. Help with bookings, rooms, and statistics. Location: Kokrobite, Accra. Currency: GHS and £.`
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [systemPrompt, ...conversationHistory.slice(-10)],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) throw new Error('AI service error');

    const data = await response.json();
    const reply = data.choices[0].message.content;
    conversationHistory.push({ role: 'assistant', content: reply });
    
    return reply;
  } catch (error) {
    console.error('OpenAI error:', error);
    return '❌ AI service temporarily unavailable. Please try again.';
  }
}
