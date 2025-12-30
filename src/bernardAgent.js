// src/bernardAgent.js
// --------------------
// Server-side Bernard agent (NO LangChain/LangGraph dependencies).
// Fixes Vercel: "Cannot find module @langchain/langgraph/dist/index.cjs"
// and prevents tool schema wiring crashes.

import {
  // Rooms
  listRoomsTool,
  getRoomDetailsTool,

  // Extras
  listExtrasTool,
  getExtraDetailsTool,

  // Packages
  listPackagesTool,
  getPackageDetailsTool,

  // Coupons
  listCouponsTool,
  getCouponDetailsTool,
  validateCouponTool,

  // Reservations
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,

  // Analytics
  getOccupancyStatsTool,
  getRevenueStatsTool,

  // Pricing
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "./bernardTools.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "";

const SYSTEM_PROMPT = `
You are Bernard, the AI assistant for the Sojourn Cabins internal admin dashboard.

Rules:
- Do NOT guess database facts. Use tools when the user is asking for admin data.
- For CREATE/UPDATE/DELETE operations: ask for explicit confirmation before you execute.
- Prefer returning tool results (tables / structured outputs) for lists.
- Be concise and helpful.
`.trim();

function lastUserMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return String(messages[i]?.content || "");
  }
  return "";
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function route(userText) {
  const q = normalize(userText);
  const has = (...words) => words.some((w) => q.includes(w));

  // LISTS
  if (has("list rooms", "show rooms", "room types", "cabins")) {
    return { tool: listRoomsTool, args: {} };
  }
  if (has("list extras", "show extras", "add-ons", "addons")) {
    return { tool: listExtrasTool, args: {} };
  }
  if (has("list packages", "show packages")) {
    return { tool: listPackagesTool, args: {} };
  }
  if (has("list coupons", "show coupons", "promo codes", "discount codes")) {
    return { tool: listCouponsTool, args: {} };
  }
  if (has("list pricing models", "show pricing models")) {
    return { tool: listPricingModelsTool, args: {} };
  }

  // DETAILS (pass raw userText; tools already fuzzy-match with ilike)
  if (has("room details", "details for room", "tell me about") && has("room", "cabin")) {
    return { tool: getRoomDetailsTool, args: { identifier: userText } };
  }
  if (has("extra details", "details for extra") && has("extra")) {
    return { tool: getExtraDetailsTool, args: { identifier: userText } };
  }
  if (has("package details", "details for package") && has("package")) {
    return { tool: getPackageDetailsTool, args: { identifier: userText } };
  }
  if (has("coupon details", "details for coupon") && has("coupon")) {
    return { tool: getCouponDetailsTool, args: { identifier: userText } };
  }

  // COUPON VALIDATION
  if (has("validate", "check") && has("coupon", "code", "promo")) {
    return { tool: validateCouponTool, args: { code: userText } };
  }

  // RESERVATIONS
  if (has("search reservation", "find reservation", "find booking", "search booking")) {
    return { tool: searchReservationsTool, args: { searchTerm: userText } };
  }
  if (has("reservation details", "booking details") && has("reservation", "booking")) {
    return { tool: getReservationDetailsTool, args: { identifier: userText } };
  }
  if (has("arrivals today", "today check in", "today check-in")) {
    return { tool: getTodayCheckInsTool, args: {} };
  }
  if (has("departures today", "today check out", "today check-out")) {
    return { tool: getTodayCheckOutsTool, args: {} };
  }
  if (has("availability", "available") && has("check-in", "checkin", "check in")) {
    return { tool: checkAvailabilityTool, args: { query: userText } };
  }

  // ANALYTICS
  if (has("occupancy")) return { tool: getOccupancyStatsTool, args: { query: userText } };
  if (has("revenue")) return { tool: getRevenueStatsTool, args: { query: userText } };

  // PRICING
  if (has("pricing model details", "pricing model") && has("details")) {
    return { tool: getPricingModelDetailsTool, args: { identifier: userText } };
  }
  if (has("simulate", "simulation") && has("pricing")) {
    return { tool: simulatePricingTool, args: { query: userText } };
  }
  if (has("season", "seasonal")) {
    return { tool: getSeasonalPricingTool, args: { query: userText } };
  }

  return null; // fallback to OpenAI text response
}

async function callOpenAI(messages) {
  if (!OPENAI_KEY) {
    return "Missing OPENAI_API_KEY in server runtime. Set OPENAI_API_KEY on Vercel.";
  }

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: String(m.content ?? "") })),
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`OpenAI error (${resp.status}): ${txt || resp.statusText}`);
  }

  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "No response.";
}

// PUBLIC ENTRYPOINT used by /api/chat.js
export async function runBernardAgent(messages, threadId = "bernard-default-thread") {
  const userText = lastUserMessage(messages);

  const planned = route(userText);

  if (planned?.tool?.func) {
    try {
      const out = await planned.tool.func(planned.args || {});
      return typeof out === "string" ? out : JSON.stringify(out);
    } catch (e) {
      return `Tool error: ${e?.message || String(e)}`;
    }
  }

  return await callOpenAI(messages);
}
