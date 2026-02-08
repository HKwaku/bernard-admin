// src/agents/extraSelectionsAgent.js
// Specialist agent for managing guest extra selections on reservations

import OpenAI from "openai";
import {
  listExtraSelectionsTool,
  getExtraSelectionDetailsTool,
  updateExtraSelectionStatusTool,
  searchReservationsTool,
  getReservationDetailsTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  list_extra_selections: listExtraSelectionsTool,
  get_extra_selection_details: getExtraSelectionDetailsTool,
  update_extra_selection_status: updateExtraSelectionStatusTool,
  search_reservations: searchReservationsTool,
  get_reservation_details: getReservationDetailsTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "list_extra_selections",
      description: "List reservations with extra selections and their statuses. Can filter by status (pending, completed, submitted) or search by guest name/confirmation code.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: pending, completed, submitted" },
          search: { type: "string", description: "Search by guest name or confirmation code" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_extra_selection_details",
      description: "Get full details of extra selections for a specific reservation, including selection data (meal choices, dates, etc.).",
      parameters: {
        type: "object",
        properties: {
          confirmation_code: { type: "string", description: "Reservation confirmation code" }
        },
        required: ["confirmation_code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_extra_selection_status",
      description: "Update the selection status of a reservation extra. Only call AFTER user confirms.",
      parameters: {
        type: "object",
        properties: {
          reservation_extra_id: { type: "string", description: "The reservation_extras record ID" },
          new_status: { type: "string", description: "New status: pending, completed, or submitted" }
        },
        required: ["reservation_extra_id", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_reservations",
      description: "Search for reservations by guest name, email, or confirmation code.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term" },
          limit: { type: "number", description: "Max results (default 10)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_reservation_details",
      description: "Get full details of a reservation.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Confirmation code or ID" }
        },
        required: ["identifier"]
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

const SYSTEM_PROMPT = `You are the Extra Selections Agent for Sojourn Cabins admin dashboard in Ghana.
You manage guest extra selections — viewing, tracking, and updating the status of extras that guests have chosen for their reservations.

=== SELECTION STATUSES ===
- **pending** — Guest hasn't made their selections yet
- **completed** — Guest has submitted their selections
- **submitted** — Admin has reviewed and finalized
- **selection not required** — This extra doesn't need guest input

=== CAPABILITIES ===
- List all reservations with extra selections (filter by status or search)
- View detailed selection data for a specific reservation (meal choices, dates, etc.)
- Update selection status (pending → completed → submitted)
- Look up reservation details

=== COMMON TASKS ===
- "Show pending selections" → list with status filter
- "Show selections for booking ABC123" → get details by confirmation code
- "Mark selection as submitted" → update status

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels
- Show HTML tables returned by tools directly
- Use ✓ for success, ✗ for errors, ⚠ for warnings
- Be conversational but concise
- ALWAYS confirm with user before updating statuses`;

export async function runExtraSelectionsAgent(messages) {
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
