// src/agents/blockedDatesAgent.js
// Specialist agent for managing blocked dates (maintenance, holidays, etc.)

import OpenAI from "openai";
import {
  blockDatesTool,
  unblockDatesTool,
  listBlockedDatesTool,
  listRoomsTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  block_dates: blockDatesTool,
  unblock_dates: unblockDatesTool,
  list_blocked_dates: listBlockedDatesTool,
  list_room_types: listRoomsTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "block_dates",
      description: "Block a range of dates for one or more rooms. Pass room codes as a JSON array. Use [\"ALL\"] to block all rooms. Replaces existing blocks in the range.",
      parameters: {
        type: "object",
        properties: {
          room_codes: { type: "string", description: "JSON array of room codes, e.g. [\"SAND\", \"PALM\"] or [\"ALL\"]" },
          start_date: { type: "string", description: "Start date (YYYY-MM-DD, inclusive)" },
          end_date: { type: "string", description: "End date (YYYY-MM-DD, exclusive)" },
          reason: { type: "string", description: "Reason: maintenance, staff holiday, renovation, other" }
        },
        required: ["room_codes", "start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "unblock_dates",
      description: "Remove blocked dates for specified rooms in a date range.",
      parameters: {
        type: "object",
        properties: {
          room_codes: { type: "string", description: "JSON array of room codes or [\"ALL\"]" },
          start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date (YYYY-MM-DD)" }
        },
        required: ["room_codes", "start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_blocked_dates",
      description: "List currently blocked dates. Can filter by room and/or date range.",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Filter by room code" },
          start_date: { type: "string", description: "Start of range (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End of range (YYYY-MM-DD)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_room_types",
      description: "List all rooms/cabins to see available room codes.",
      parameters: { type: "object", properties: {}, required: [] }
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

const SYSTEM_PROMPT = `You are the Blocked Dates Agent for Sojourn Cabins admin dashboard in Ghana.
You manage blocked dates — periods when rooms/cabins are unavailable for booking (maintenance, staff holidays, renovations, etc.).

Today's date is: ${today}

IMPORTANT: Do NOT assume or hardcode room/cabin names. Call list_room_types when you need to reference rooms.

=== CAPABILITIES ===
- **Block dates**: Block a range of dates for one or more rooms
- **Unblock dates**: Remove blocked dates to make rooms available again
- **List blocked dates**: View current blocks, filtered by room and/or date range

=== BLOCKING WORKFLOW ===
1. Ask: "Which room(s) should be blocked?" (or "all rooms")
2. Ask: "What date range? (start and end dates)"
3. Ask: "What is the reason? (maintenance, staff holiday, renovation, other)"
4. Summarize and confirm before blocking.

Pass room codes as a JSON array: ["SAND", "PALM"] or ["ALL"] for all rooms.
The end date is EXCLUSIVE (e.g., blocking Jan 1–Jan 5 blocks Jan 1, 2, 3, 4).

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels
- Show HTML tables from tools directly
- Format dates as: 15 Jan 2025
- Use ✓ for success, ✗ for errors, ⚠ for warnings
- Be conversational but concise
- ALWAYS confirm with user before blocking/unblocking`;

export async function runBlockedDatesAgent(messages) {
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

  for (let i = 0; i < 8 && message.tool_calls; i++) {
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
