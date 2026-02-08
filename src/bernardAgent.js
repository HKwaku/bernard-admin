// src/bernardAgent.js
// Multi-agent orchestrator — classifies user intent and delegates to specialist agents

import OpenAI from "openai";
import { runInventoryAgent } from "./agents/inventoryAgent.js";
import { runReservationsAgent } from "./agents/reservationsAgent.js";
import { runAnalyticsAgent } from "./agents/analyticsAgent.js";
import { runPricingAgent } from "./agents/pricingAgent.js";

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
    description: "Manages bookings, check-ins, check-outs, and availability",
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
};

// Router tool definition — the orchestrator uses this to pick an agent
const routerTools = [
  {
    type: "function",
    function: {
      name: "route_to_agent",
      description: `Route the user's request to the appropriate specialist agent.

Available agents:
- "inventory": For rooms, extras, packages, coupons — listing, creating, updating, deleting
- "reservations": For bookings, guest lookups, check-ins/outs, availability checks, reservation status changes
- "analytics": For occupancy stats, revenue reports, client analytics, period comparisons
- "pricing": For pricing models, price simulations, seasonal pricing rules

Choose the agent whose domain best matches the user's request.`,
      parameters: {
        type: "object",
        properties: {
          agent: {
            type: "string",
            enum: ["inventory", "reservations", "analytics", "pricing"],
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
• inventory — rooms, extras, add-ons, packages, coupons (list, create, update, delete inventory items)
• reservations — bookings, guests, check-ins, check-outs, availability, creating reservations, reservation changes
• analytics — occupancy stats, revenue reports, client analytics, period comparisons, performance metrics
• pricing — pricing models, dynamic pricing, price simulations, seasonal pricing

ROUTING RULES:
- "show rooms" / "create a package" / "update extra" / "list coupons" → inventory
- "find reservation" / "book a cabin" / "make a booking" / "reserve sand" / "check-ins today" / "cancel booking" / "is SAND available" / "send confirmation email" / "send booking email" / "resend email" → reservations
- "occupancy this month" / "revenue stats" / "top clients" / "compare Q1 vs Q2" → analytics
- "show pricing models" / "simulate price" / "seasonal rates" → pricing

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
  const routerMessages = [
    { role: "system", content: ROUTER_SYSTEM },
    ...messages,
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

  // Step 3: Run the specialist agent with the full conversation
  try {
    const reply = await agent.run(messages);
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
