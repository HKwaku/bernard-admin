// /api/chat.js (Vercel serverless function)

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ✅ Make the root cause obvious instead of a mysterious 500
    const hasKey =
      !!process.env.OPENAI_API_KEY || !!process.env.VITE_OPENAI_API_KEY;

    if (!hasKey) {
      return res.status(500).json({
        error:
          "Missing OpenAI API key in server runtime. Set OPENAI_API_KEY (recommended) on Vercel.",
      });
    }

    // ✅ Safer parse for Vercel/node (handles string OR object body)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const { messages, threadId } = body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    // ✅ Dynamic import avoids ESM/CJS mismatches in Vercel functions
    const { runBernardAgent } = await import("../src/bernardAgent.js");

    const reply = await runBernardAgent(messages, threadId || "bernard-default-thread");

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("Bernard agent error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
