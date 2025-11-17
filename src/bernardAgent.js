// src/bernardAgent.js
// --------------------
// Bernard agent: wires together the LLM + tools into a LangGraph ReAct agent.
// This file should NOT contain tool definitions – it only imports and registers them.

import { MemorySaver } from "@langchain/langgraph";

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

import {
  // Reservation / ops tools
  listRoomsTool,
  listExtrasTool,
  searchReservationsTool,
  todayStatsTool,
  checkAvailabilityTool,
  // Package tools
  listActivePackagesTool,
  getPackageDetailsTool,
  checkPackageAvailabilityTool,
  // Coupon tools
  listActiveCouponsTool,
  validateCouponForBookingTool,
  // Analytics tools
  getAnalyticsOverviewTool,
  // NEW: mutating tools
  createSimpleReservationTool,
  cancelReservationTool,
  updateReservationDatesTool,
} from "./bernardTools.js";

// ---------------------------------------------------------------------------
// TOOL REGISTRATION
// ---------------------------------------------------------------------------

const tools = [
  // === Reservation & operations (read-only) ===
  listRoomsTool,
  listExtrasTool,
  searchReservationsTool,
  todayStatsTool,
  checkAvailabilityTool,

  // === Packages (read-only) ===
  listActivePackagesTool,
  getPackageDetailsTool,
  checkPackageAvailabilityTool,

  // === Coupons (read-only / compute) ===
  listActiveCouponsTool,
  validateCouponForBookingTool,

  // === Analytics (read-only) ===
  getAnalyticsOverviewTool,

  // === Mutating tools: use only after explicit confirmation ===
  createSimpleReservationTool,
  cancelReservationTool,
  updateReservationDatesTool,
];


// ---------------------------------------------------------------------------
// LLM + SYSTEM PROMPT
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are Bernard, the AI assistant for the Sojourn Cabins internal admin dashboard.

You can call tools to:
- Look up rooms, extras and reservations
- Check availability and packages
- Inspect coupons and validate discounts
- Summarise occupancy and revenue for a period
- Create, cancel, or modify reservations

GUIDELINES

1) Read-only vs mutating tools
- Tools whose names start with "list_", "get_", "search_", "check_", or "validate_" are READ-ONLY.
- Tools whose names start with "create_", "update_", or "cancel_" CHANGE DATA in the database.

2) Human-in-the-loop for mutating actions
- BEFORE calling any mutating tool (create_simple_reservation, cancel_reservation, update_reservation_dates):
  - Explain in plain language exactly what you intend to do.
  - Ask the user a clear yes/no question like:
    "Do you want me to go ahead and create this booking?"
  - ONLY call the tool if the user explicitly confirms (e.g. "yes", "go ahead", "confirm").
- After calling a mutating tool, summarise the changes (id, confirmation code, dates, status, price).

3) Data access
- When the user asks about real data (bookings, packages, coupons, metrics), ALWAYS call the appropriate READ-ONLY tool instead of guessing.
- When the user asks how the UI works, explain step-by-step and DO NOT call tools.

4) Style
- Be concise but clear.
- Prefer concrete numbers and dates over vague descriptions.
`.trim();

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY,
});

const checkpointer = new MemorySaver();
// Build a ReAct-style agent graph using LangGraph's prebuilt helper.

const bernardAgent = createReactAgent({
  llm: model,
  tools,
  // This behaves like a system message that conditions the agent's behaviour.
  stateModifier: SYSTEM_PROMPT,
  checkpointSaver: checkpointer, // <-- enables state-store & human-in-loop patterns
});

// ---------------------------------------------------------------------------
// PUBLIC ENTRYPOINT
// ---------------------------------------------------------------------------

/**
 * Run Bernard on a list of messages.
 * @param {Array<{ role: 'user'|'assistant'|'system'|'tool', content: string }>} messages
 * @param {string} [threadId] - stable identifier (e.g. user id or chat id)
 * @returns {Promise<string>} Final assistant reply text.
 */
export async function runBernardAgent(messages, threadId = "bernard-default-thread") {
  const result = await bernardAgent.invoke(
    { messages },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

  const finalMessages = result.messages ?? [];
  const last = finalMessages[finalMessages.length - 1];

  if (typeof last?.content === "string") return last.content;

  if (Array.isArray(last?.content)) {
    return last.content.map((c) => c.text || c).join("\n");
  }

  return "I’ve processed your request.";
}
