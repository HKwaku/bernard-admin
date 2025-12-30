// /api/chat.js (Vercel serverless function)

import { runBernardAgent } from "../lib/bernardAgent.js"; // adjust relative path

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "messages array required" });
    }

    // We let the LangGraph agent handle system prompts through stateModifier,
    // so we just pass messages through as-is from the frontend
    const reply = await runBernardAgent(messages);

    return res.status(200).json({ reply });
  } catch (e) {
    console.error("Bernard agent error:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
