// /api/chat.js (Vercel serverless function)

import { runBernardAgent } from "../src/bernardAgent.js"; // ✅ FIX: correct path to your agent

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // ✅ Safer parse for Vercel/node (handles string OR object body)
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const { messages } = body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    const reply = await runBernardAgent(messages);

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("Bernard agent error:", e);
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
