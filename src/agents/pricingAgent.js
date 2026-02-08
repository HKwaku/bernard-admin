// src/agents/pricingAgent.js
// Specialist agent for pricing models, simulations, and seasonal pricing

import OpenAI from "openai";
import {
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  list_pricing_models: listPricingModelsTool,
  get_pricing_model_details: getPricingModelDetailsTool,
  simulate_pricing: simulatePricingTool,
  get_seasonal_pricing: getSeasonalPricingTool,
};

const tools = [
  { type: "function", function: { name: "list_pricing_models", description: "List all pricing models with their configuration", parameters: { type: "object", properties: {}, required: [] } } },
  { type: "function", function: { name: "get_pricing_model_details", description: "Get details about a specific pricing model including tiers and rules", parameters: { type: "object", properties: { identifier: { type: "string", description: "Pricing model name or ID" } }, required: ["identifier"] } } },
  { type: "function", function: { name: "simulate_pricing", description: "Simulate dynamic pricing for a specific room and date range", parameters: { type: "object", properties: { room_code: { type: "string", description: "Room code (e.g., 'SAND')" }, check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" }, check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" } }, required: ["room_code", "check_in", "check_out"] } } },
  { type: "function", function: { name: "get_seasonal_pricing", description: "Get seasonal pricing rules for rooms", parameters: { type: "object", properties: { room_code: { type: "string", description: "Optional: specific room code" } }, required: [] } } },
];

async function executeTool(name, args) {
  try {
    const toolFunc = toolMap[name];
    if (!toolFunc || !toolFunc.func) return `Tool '${name}' not found`;
    const result = await toolFunc.func(args);
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

const SYSTEM_PROMPT = `You are the Pricing Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in dynamic pricing models, price simulations, and seasonal pricing rules.

CAPABILITIES:
- List and inspect pricing models (tiers, month rules, targets)
- Simulate dynamic pricing for specific room + date combinations
- View seasonal pricing rules and overrides
- Explain pricing calculations and tier logic

FORMATTING:
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and key metrics
- Use bullet lists (- item) for breakdowns
- When showing pricing, use a structured format like:

**Price Simulation — Sand Cabin**
- **Check-in**: 07 Dec 2026
- **Check-out**: 09 Dec 2026 (2 nights)
- **Weekday Rate**: GHS 2,500.00
- **Weekend Rate**: GHS 3,000.00
- **Total**: GHS 5,500.00

- Show HTML tables returned by tools directly — do NOT reformat them
- When tool returns an HTML table, include it as-is in your response

RULES:
- Currency is GHS (Ghanaian Cedi)
- Be concise but explain pricing logic clearly
- NO filler phrases
- Format dates as: 15 Jan 2025
- Format currency as: GHS 1,250.00
- When simulating, show the nightly breakdown if available
- Explain which tier/multiplier applied to the price`;

export async function runPricingAgent(messages) {
  const allMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: allMessages,
    tools,
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 4096,
  });

  let message = response.choices[0].message;
  const responseMessages = [message];

  for (let i = 0; i < 5 && message.tool_calls; i++) {
    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments || "{}");
      const result = await executeTool(tc.function.name, args);
      responseMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }

    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...allMessages, ...responseMessages],
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 4096,
    });

    message = response.choices[0].message;
    responseMessages.push(message);
  }

  return message.content || "Done.";
}
