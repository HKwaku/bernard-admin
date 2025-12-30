// /api/chat.js (Vercel serverless function)

import { runBernardAgent } from "../src/bernardAgent.js"; // adjust relative path

// /api/chat.js
// Vercel Serverless Function (Node) — runs Bernard server-side only

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Body can be string or object depending on environment
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const threadId = body.threadId || "bernard-default-thread";

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error:
          "Server missing OPENAI_API_KEY. Add it to Vercel environment variables.",
      });
    }

    // IMPORTANT:
    // Use dynamic import so this function works whether your project is ESM or CJS.
    // Also ensures LangGraph never ends up in the browser bundle.
    const mod = await import("../src/bernardAgent.js");
    const runBernardAgent = mod.runBernardAgent;

    if (typeof runBernardAgent !== "function") {
      return res.status(500).json({
        error:
          "runBernardAgent export not found. Check ../src/bernardAgent.js exports.",
      });
    }

    const reply = await runBernardAgent(messages, threadId);
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("API /chat error:", err);
    return res.status(500).json({
      error: err?.message || "Bernard API failed (500)",
    });
  }
}
