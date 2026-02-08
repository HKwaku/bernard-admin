// src/bernardAgent.js
// Multi-agent orchestrator — classifies user intent and delegates to specialist agents

import OpenAI from "openai";
import { runInventoryAgent } from "./agents/inventoryAgent.js";
import { runReservationsAgent } from "./agents/reservationsAgent.js";
import { runEditReservationsAgent } from "./agents/editReservationsAgent.js";
import { runAnalyticsAgent } from "./agents/analyticsAgent.js";
import { runPricingAgent } from "./agents/pricingAgent.js";
import { runChefMenuAgent } from "./agents/chefMenuAgent.js";
import { runExtraSelectionsAgent } from "./agents/extraSelectionsAgent.js";
import { runBlockedDatesAgent } from "./agents/blockedDatesAgent.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

// Agent registry — maps agent names to their runner functions
const AGENTS = {
  inventory: {
    run: runInventoryAgent,
    label: "Inventory Agent",
    description: "Manages rooms, extras, packages, and coupons",
  },
  reservations: {
    run: runReservationsAgent,
    label: "Reservations Agent",
    description: "Manages bookings, check-ins, check-outs, availability, and creating new reservations (single or group)",
  },
  edit_reservations: {
    run: runEditReservationsAgent,
    label: "Edit Reservations Agent",
    description: "Edits existing reservations — changes room, dates, guest info, extras, coupons, pricing, status, and payment",
  },
  analytics: {
    run: runAnalyticsAgent,
    label: "Analytics Agent",
    description: "Provides occupancy, revenue, client stats, and comparisons",
  },
  pricing: {
    run: runPricingAgent,
    label: "Pricing Agent",
    description: "Handles pricing models, simulations, and seasonal pricing",
  },
  chef_menu: {
    run: runChefMenuAgent,
    label: "Chef Menu Agent",
    description: "Manages chef menu items (dishes for the Private Chef experience)",
  },
  extra_selections: {
    run: runExtraSelectionsAgent,
    label: "Extra Selections Agent",
    description: "Views and manages guest extra selections on reservations",
  },
  blocked_dates: {
    run: runBlockedDatesAgent,
    label: "Blocked Dates Agent",
    description: "Manages blocked dates for rooms (maintenance, holidays, etc.)",
  },
};

// Router tool definition — the orchestrator uses this to pick an agent
const routerTools = [
  {
    type: "function",
    function: {
      name: "route_to_agent",
      description: `Route the user's request to the appropriate specialist agent.

Available agents:
- "inventory": For rooms/cabins, extras, packages, coupons — listing, creating, EDITING, deleting inventory items (including editing room type prices, names, capacity)
- "reservations": For NEW bookings (single, group, or package), guest lookups, check-ins/outs, availability, status changes
- "edit_reservations": For EDITING/MODIFYING existing reservations/bookings ONLY — changing room assignment, dates, guest info, extras on a booking, coupons, pricing, payment. NOT for editing room types or inventory.
- "analytics": For occupancy stats, revenue reports, client analytics, period comparisons
- "pricing": For pricing models, price simulations, seasonal pricing rules
- "chef_menu": For managing chef menu items — dishes, categories, availability
- "extra_selections": For viewing and managing guest extra selections on reservations
- "blocked_dates": For blocking/unblocking dates for rooms (maintenance, holidays, etc.)

IMPORTANT: "edit COCO" or "change weekend price" refers to editing a ROOM TYPE → inventory. "edit reservation" or "modify booking XYZ" → edit_reservations.

Choose the agent whose domain best matches the user's request.`,
      parameters: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            enum: ["inventory", "reservations", "edit_reservations", "analytics", "pricing", "chef_menu", "extra_selections", "blocked_dates"],
            description: "The specialist agent to handle this request",
          },
          reasoning: {
            type: "string",
            description: "Brief reason for choosing this agent (1 sentence)",
          },
        },
        required: ["agent"],
      },
    },
  },
];

const ROUTER_SYSTEM = `You are Bernard, the AI routing assistant for Sojourn Cabins admin dashboard.

Your ONLY job is to classify the user's request and route it to the correct specialist agent using the route_to_agent tool.

AGENT DOMAINS:
• inventory — rooms/cabins, extras/add-ons, packages, coupons (list, create, UPDATE, delete inventory items). This includes editing room type details like prices, names, capacity, images, and active status.
• reservations — NEW bookings (single, group, or package), guest lookups, check-ins/outs, availability, sending emails
• edit_reservations — EDITING/MODIFYING existing reservations/bookings ONLY (change room assignment, dates, guest info, extras on a booking, apply coupon to a booking, pricing, status, payment). Does NOT handle editing room types or inventory items.
• analytics — occupancy stats, revenue reports, client analytics, period comparisons, performance metrics
• pricing — pricing models, dynamic pricing, price simulations, seasonal pricing
• chef_menu — chef menu items: dishes, categories, availability (for the Private Chef experience)
• extra_selections — viewing/managing guest extra selections on reservations (selection statuses, meal choices)
• blocked_dates — blocking/unblocking dates for rooms (maintenance, holidays, renovations)

CRITICAL DISTINCTION:
- Editing a ROOM TYPE (e.g. "edit COCO", "change weekend price of SAND", "update room capacity") → inventory
- Editing a RESERVATION/BOOKING (e.g. "edit reservation ABC123", "change check-in date on booking") → edit_reservations
- Editing an EXTRA, COUPON, or PACKAGE (inventory items) → inventory

ROUTING RULES:
- "show rooms" / "create a package" / "update extra" / "list coupons" / "edit room type" / "change room price" / "update COCO" / "edit SAND cabin" / "delete extra" / "update coupon" / "edit package" / "create room" / "add extra" / "create coupon" → inventory
- "find reservation" / "book a cabin" / "make a booking" / "make a group booking" / "book a package" / "reserve sand" / "check-ins today" / "cancel booking" / "is SAND available" / "send confirmation email" / "send booking email" / "resend email" → reservations
- "edit reservation ABC123" / "change check-in date on booking" / "move booking to another room" / "update guest email on reservation" / "change payment status" / "apply coupon to booking" / "modify booking" / "update reservation" → edit_reservations
- "occupancy this month" / "revenue stats" / "top clients" / "compare Q1 vs Q2" → analytics
- "show pricing models" / "simulate price" / "seasonal rates" → pricing
- "show menu" / "add dish" / "update menu item" / "chef menu" / "menu items" / "starters" / "mains" / "sides" → chef_menu
- "show selections" / "pending selections" / "guest selections" / "extra selections" / "meal choices" / "selection status" → extra_selections
- "block dates" / "unblock dates" / "blocked dates" / "maintenance period" / "close room" / "blocked bookings" → blocked_dates

MULTI-TURN CONVERSATIONS (IMPORTANT):
- Look at the conversation history to understand context
- If the previous assistant message was from a specialist agent asking a follow-up question (like asking for a name, email, dates, etc.), route to the SAME agent
- If user says "confirm" or "yes" or provides information requested by the previous agent response, route to that same agent
- User replies like "John Smith", "john@email.com", "+233 555 1234", "2 adults", "yes", "no extras" are follow-up responses → route to the same agent that was handling the conversation

For greetings or ambiguous queries with no conversation context, respond directly without routing.

ALWAYS call route_to_agent unless it's a simple greeting or you genuinely can't classify the intent.`;

// Main orchestrator function
export async function runBernardAgent(messages) {
  if (!process.env.OPENAI_API_KEY && !process.env.VITE_OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Set OPENAI_API_KEY or VITE_OPENAI_API_KEY in your .env.local");
  }

  console.log("🤖 Bernard orchestrator starting with", messages.length, "messages");

  // Step 1: Classify intent with the router
  // Only send the last ~20 messages to the router to prevent context overload
  const MAX_ROUTER_MESSAGES = 20;
  const recentMessages = messages.length > MAX_ROUTER_MESSAGES
    ? messages.slice(-MAX_ROUTER_MESSAGES)
    : messages;

  const routerMessages = [
    { role: "system", content: ROUTER_SYSTEM },
    ...recentMessages,
  ];

  const routerResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: routerMessages,
    tools: routerTools,
    tool_choice: "auto",
    temperature: 0.1,
    max_tokens: 200,
  });

  const routerMessage = routerResponse.choices[0].message;

  // If the router didn't call a tool, it's handling directly (greeting, etc.)
  if (!routerMessage.tool_calls || routerMessage.tool_calls.length === 0) {
    console.log("💬 Router handled directly (no delegation)");
    return {
      reply: routerMessage.content || "Hello! I'm Bernard. How can I help you today?",
      agent: null,
    };
  }

  // Step 2: Extract the routing decision
  const toolCall = routerMessage.tool_calls[0];
  const routeArgs = JSON.parse(toolCall.function.arguments || "{}");
  const agentName = routeArgs.agent;
  const reasoning = routeArgs.reasoning || "";

  const agent = AGENTS[agentName];
  if (!agent) {
    console.error(`❌ Unknown agent: ${agentName}`);
    return {
      reply: "I couldn't determine the right specialist for that request. Could you rephrase?",
      agent: null,
    };
  }

  console.log(`🔀 Routing to ${agent.label}: ${reasoning}`);

  // Step 3: Run the specialist agent with recent conversation (limit to prevent context overflow)
  const MAX_AGENT_MESSAGES = 40;
  const agentMessages = messages.length > MAX_AGENT_MESSAGES
    ? messages.slice(-MAX_AGENT_MESSAGES)
    : messages;

  try {
    const reply = await agent.run(agentMessages);
    return {
      reply,
      agent: agent.label,
    };
  } catch (error) {
    console.error(`❌ ${agent.label} error:`, error);
    return {
      reply: `The ${agent.label} encountered an error: ${error.message}`,
      agent: agent.label,
    };
  }
}
