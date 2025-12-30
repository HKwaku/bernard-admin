// src/bernardAgent.js
// --------------------
// Bernard agent: server-side tool-using assistant for Bernard Admin.
//
// NOTE:
// The previous implementation used @langchain/langgraph. That package is not
// present in your Vercel runtime (see: "Cannot find module ...@langchain/langgraph...").
// This version removes LangGraph entirely and runs a lightweight tool-calling loop
// using ChatOpenAI + the same Bernard tools.

import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";

import {
  // Room Tools
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,

  // Extra Tools
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,

  // Package Tools
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,

  // Coupon Tools
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,

  // Reservation Tools
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,

  // Analytics Tools
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,

  // Pricing Model Tools
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "./bernardTools.js";

// ---------------------------------------------------------------------------
// ORCHESTRATOR (lightweight planner)
// ---------------------------------------------------------------------------

// This tool is intentionally simple: it helps the model decide which domain to hit.
// It does NOT call any DB itself.
const orchestratorTool = tool({
  name: "orchestrate_request",
  description:
    "Route the user request to the right domain/tools. Return a short plan with domains and suggested tools.",
  schema: z.object({
    message: z.string().describe("The user's latest message"),
  }),
  async func({ message }) {
    const m = (message || "").toLowerCase();
    const domains = [];

    if (/(coupon|discount|promo|voucher|code)/.test(m)) domains.push("coupons");
    if (/(room|cabin|room type|availability)/.test(m)) domains.push("rooms");
    if (/(extra|add\-on|addon)/.test(m)) domains.push("extras");
    if (/(package)/.test(m)) domains.push("packages");
    if (
      /(reservation|booking|check\-in|check in|check\-out|check out|guest|confirmation)/.test(m)
    )
      domains.push("reservations");
    if (/(analytics|revenue|occupancy|stats|performance)/.test(m)) domains.push("analytics");
    if (/(pricing model|tier|override|pricing)/.test(m)) domains.push("pricing");

    if (!domains.length) domains.push("general");

    return JSON.stringify(
      {
        domains,
        guidance:
          "Use list_/get_/search_/check_/validate_ tools for facts. For create_/update_/delete_ tools, ask for explicit confirmation before executing.",
      },
      null,
      2
    );
  },
});

// ---------------------------------------------------------------------------
// TOOL REGISTRATION
// ---------------------------------------------------------------------------

const tools = [
  orchestratorTool,

  // === Room Management ===
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,

  // === Extras Management ===
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,

  // === Package Management ===
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,

  // === Coupon Management ===
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,

  // === Reservation Management ===
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,

  // === Analytics ===
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,

  // === Pricing Models ===
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
];

const TOOL_BY_NAME = new Map(tools.map((t) => [t.name, t]));

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are Bernard, the AI assistant for the Sojourn Cabins internal admin dashboard.

You have access to tools that read and (with confirmation) modify admin data.

ORCHESTRATION (MANDATORY)
1) For each new user message, first call orchestrate_request with that message.
2) Use the suggested domain tools to fetch facts.
3) Do NOT guess database facts — use tools.

MUTATIONS REQUIRE CONFIRMATION
- Any create_, update_, or delete_ tool changes data.
- Always explain what you will change and ask for explicit yes/no confirmation.

RESPONSE FORMAT
- Use the tool output directly (many tools return HTML tables).
- Keep answers short, accurate, and actionable.
`.trim();

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY,
});

const modelWithTools = model.bindTools(tools);

// ---------------------------------------------------------------------------
// PUBLIC ENTRYPOINT
// ---------------------------------------------------------------------------

function toLcMessage(m) {
  if (!m || typeof m !== "object") return null;
  const role = m.role;
  const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");

  if (role === "system") return new SystemMessage(content);
  if (role === "assistant") return new AIMessage(content);
  if (role === "tool") {
    return new ToolMessage({ content, tool_call_id: m.tool_call_id || "unknown" });
  }
  return new HumanMessage(content);
}

/**
 * Run Bernard on a list of messages.
 * @param {Array<{ role: 'user'|'assistant'|'system'|'tool', content: string }>} messages
 * @param {string} [threadId]
 * @returns {Promise<string>}
 */
export async function runBernardAgent(messages, threadId = "bernard-default-thread") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing in server env vars.");
  }

  const lcMessages = [new SystemMessage(SYSTEM_PROMPT)];
  for (const m of messages || []) {
    const lm = toLcMessage(m);
    if (lm) lcMessages.push(lm);
  }

  // Tool-calling loop (no LangGraph dependency)
  for (let step = 0; step < 8; step++) {
    const ai = await modelWithTools.invoke(lcMessages, {
      configurable: { thread_id: threadId },
    });

    lcMessages.push(ai);

    const toolCalls = ai.tool_calls || [];
    if (!toolCalls.length) {
      return typeof ai.content === "string" ? ai.content : JSON.stringify(ai.content ?? "");
    }

    for (const call of toolCalls) {
      const toolName = call.name;
      const toolObj = TOOL_BY_NAME.get(toolName);

      if (!toolObj) {
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Error: tool '${toolName}' is not registered.`,
          })
        );
        continue;
      }

      try {
        const result = await toolObj.invoke(call.args ?? {});
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          })
        );
      } catch (e) {
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Error running tool '${toolName}': ${e?.message || String(e)}`,
          })
        );
      }
    }
  }

  return "I started working on that, but hit the tool-call limit. Can you rephrase or narrow the request?";
}
