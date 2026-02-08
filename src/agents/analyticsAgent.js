// src/agents/analyticsAgent.js
// Specialist agent for occupancy, revenue, client analytics, and period comparisons

import OpenAI from "openai";
import {
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  get_occupancy_stats: getOccupancyStatsTool,
  get_revenue_stats: getRevenueStatsTool,
  get_client_analytics: getClientAnalyticsTool,
  compare_periods: comparePeriodsAnalyticsTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_occupancy_stats",
      description: "Get occupancy statistics for a date range: occupancy rate, nights sold, available nights, blocked nights, ALOS, and bookings count. Defaults to current month if no dates specified. Uses overlap detection so reservations that span across the date range are correctly counted.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 1st of current month." },
          end_date: { type: "string", description: "End date (YYYY-MM-DD). Defaults to last day of current month." },
          room_code: { type: "string", description: "Optional: specific room code from the database" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_stats",
      description: "Get revenue statistics for a date range: total revenue, room revenue, extras revenue, discounts, booking counts, ADR, RevPAR, TRevPAR. Defaults to current month if no dates specified. Uses overlap detection for accurate counting.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to 1st of current month." },
          end_date: { type: "string", description: "End date (YYYY-MM-DD). Defaults to last day of current month." }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_client_analytics",
      description: "Get client/guest analytics including repeat guests, top spenders, and booking patterns for a date range.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
          limit: { type: "number", description: "Number of top guests to return (default: 10)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_periods",
      description: "Compare occupancy and revenue metrics between two time periods. Shows a detailed comparison table with bookings, revenue, occupancy rate, ADR, RevPAR, and percentage changes.",
      parameters: {
        type: "object",
        properties: {
          period1_start: { type: "string", description: "Period 1 start date (YYYY-MM-DD)" },
          period1_end: { type: "string", description: "Period 1 end date (YYYY-MM-DD)" },
          period2_start: { type: "string", description: "Period 2 start date (YYYY-MM-DD)" },
          period2_end: { type: "string", description: "Period 2 end date (YYYY-MM-DD)" }
        },
        required: ["period1_start", "period1_end", "period2_start", "period2_end"]
      }
    }
  },
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

const today = new Date().toISOString().split('T')[0];
const now = new Date();
const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

const SYSTEM_PROMPT = `You are the Analytics Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in occupancy analysis, revenue reporting, client analytics, and period-over-period comparisons.

Today's date is: ${today}
Current month range: ${currentMonthStart} to ${currentMonthEnd}

IMPORTANT: Do NOT assume or hardcode room/cabin names. The actual rooms are in the database. Use room_code parameter when a specific room is requested.

CAPABILITIES:
- Occupancy statistics: rate, nights sold, available nights, blocked nights, ALOS, per-room breakdown
- Revenue reports: total, room, extras, discounts, ADR, RevPAR, TRevPAR
- Client analytics: repeat guests, top spenders, booking patterns
- Period-over-period comparison: side-by-side metrics with percentage changes

HOW THE CALCULATIONS WORK (for accurate context when explaining results):
- Occupancy uses OVERLAP DETECTION: reservations whose stay period touches the date range are counted
- Occupied nights are clipped to the period boundaries (a 5-night stay spanning a month boundary only counts nights within the range)
- Available nights = (days in period × number of rooms) minus blocked nights
- Occupancy Rate = occupied nights / available nights × 100
- ADR = room revenue / occupied nights
- RevPAR = room revenue / available nights
- TRevPAR = total revenue / available nights
- ALOS = total occupied nights / number of bookings

FORMATTING:
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and key metrics
- Use bullet lists (- item) for breakdowns
- Present metrics in a structured format like:

**Occupancy Summary — Feb 2026**
- **Occupancy Rate**: 78.5%
- **Nights Sold**: 47 / 60
- **ADR**: GHS 1,750.00
- **RevPAR**: GHS 1,373.25

- Show HTML tables returned by tools directly — do NOT reformat, summarize, or rewrite them as text
- When tool returns an HTML table, include it as-is in your response

RULES:
- If user doesn't specify dates, default to current month (${currentMonthStart} to ${currentMonthEnd})
- When user asks about "this year", use ${now.getFullYear()}-01-01 to ${today}
- Currency is GHS (Ghanaian Cedi)
- Be concise: 2-4 sentences of insight, then show the data
- NO filler phrases
- Format dates as: 15 Jan 2025
- Format currency as: GHS 1,250.00
- Offer insights when showing data (e.g., "Occupancy is strong at 78%, above the 70% industry benchmark")
- For comparisons, call compare_periods with both date ranges
- When user asks for both occupancy AND revenue, call BOTH tools in parallel`;

export async function runAnalyticsAgent(messages) {
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
