// src/agents/reservationsAgent.js
// Specialist agent for managing reservations, check-ins/outs, availability, and booking creation

import OpenAI from "openai";
import {
  searchReservationsTool,
  getReservationDetailsTool,
  createReservationTool,
  updateReservationStatusTool,
  updateReservationDetailsTool,
  cancelReservationTool,
  deleteReservationTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  listExtrasTool,
  sendBookingEmailTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  search_reservations: searchReservationsTool,
  get_reservation_details: getReservationDetailsTool,
  create_reservation: createReservationTool,
  update_reservation_status: updateReservationStatusTool,
  update_reservation_details: updateReservationDetailsTool,
  cancel_reservation: cancelReservationTool,
  delete_reservation: deleteReservationTool,
  get_today_checkins: getTodayCheckInsTool,
  get_today_checkouts: getTodayCheckOutsTool,
  check_availability: checkAvailabilityTool,
  list_extras: listExtrasTool,
  send_booking_email: sendBookingEmailTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "search_reservations",
      description: "Search for reservations by guest name, email, confirmation code, status, or date range. Use start_date/end_date to find reservations in a specific period — any reservation whose stay overlaps the date range will be included.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term - guest name, email, or confirmation code" },
          status: { type: "string", description: "Filter by status: confirmed, cancelled, checked-in, checked-out, completed" },
          start_date: { type: "string", description: "Start of date range (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End of date range (YYYY-MM-DD)" },
          limit: { type: "number", description: "Max results (default 20)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_reservation_details",
      description: "Get full details of a specific reservation by confirmation code or ID",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Confirmation code or reservation ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check if a specific cabin is available for given dates. Also checks for blocked dates. Call this BEFORE creating any reservation.",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Room code: SAND, PALM, or COCO" },
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" }
        },
        required: ["room_code", "check_in", "check_out"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_extras",
      description: "List all available extras/add-ons that can be added to a reservation. Call this when asking the guest about extras.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "send_booking_email",
      description: "Send a booking confirmation email (and extras selection email if applicable) to the guest. Call this after a reservation is created, or when the user asks to send/resend a confirmation email.",
      parameters: {
        type: "object",
        properties: {
          confirmation_code: { type: "string", description: "The reservation confirmation code" }
        },
        required: ["confirmation_code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description: "Create a new reservation. Only call this after: (1) availability is confirmed, (2) all required guest information is collected. The tool calculates pricing automatically using dynamic pricing or base rates.",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Room code: SAND, PALM, or COCO" },
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
          guest_first_name: { type: "string", description: "Guest first name" },
          guest_last_name: { type: "string", description: "Guest last name" },
          guest_email: { type: "string", description: "Guest email address" },
          guest_phone: { type: "string", description: "Guest phone number" },
          country_code: { type: "string", description: "Country dialling code (e.g., +233)" },
          adults: { type: "number", description: "Number of adults (default 2)" },
          children: { type: "number", description: "Number of children (default 0)" },
          notes: { type: "string", description: "Special requests or notes" },
          extras: { type: "string", description: "JSON array of extras by name and quantity, e.g. [{\"name\": \"Airport Transfer\", \"quantity\": 1}, {\"name\": \"Breakfast\", \"quantity\": 2}]" },
          coupon_code: { type: "string", description: "Coupon code to apply" }
        },
        required: ["room_code", "check_in", "check_out", "guest_first_name", "guest_last_name", "guest_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reservation_status",
      description: "Update reservation status. IMPORTANT: Always confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after user explicitly confirms" },
          identifier: { type: "string", description: "Confirmation code or reservation ID" },
          new_status: { type: "string", description: "New status: confirmed, checked-in, checked-out, cancelled" }
        },
        required: ["identifier", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reservation_details",
      description: "Update reservation details. IMPORTANT: Always confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after user explicitly confirms" },
          identifier: { type: "string", description: "Confirmation code or reservation ID" },
          updates: {
            type: "object",
            properties: {
              check_in: { type: "string" }, check_out: { type: "string" },
              adults: { type: "number" }, children: { type: "number" },
              guest_first_name: { type: "string" }, guest_last_name: { type: "string" },
              guest_email: { type: "string" }, guest_phone: { type: "string" },
              notes: { type: "string" }, payment_status: { type: "string" }
            }
          }
        },
        required: ["identifier", "updates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_reservation",
      description: "Cancel a reservation. IMPORTANT: Always confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after user explicitly confirms" },
          identifier: { type: "string", description: "Confirmation code or reservation ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_reservation",
      description: "Permanently delete a reservation. WARNING: Cannot be undone! Always confirm with user first.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after user explicitly confirms" },
          identifier: { type: "string", description: "Confirmation code or reservation ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_today_checkins",
      description: "Get all reservations checking in today",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_today_checkouts",
      description: "Get all reservations checking out today",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
];

const MUTATING = new Set([
  "update_reservation_status", "update_reservation_details",
  "cancel_reservation", "delete_reservation",
]);

async function executeTool(name, args) {
  try {
    if (MUTATING.has(name) && !args?.confirm) {
      return `⚠️ Confirm required.\n\nReply "confirm" to proceed.\n\nPending action: ${name}\nArgs: ${JSON.stringify(args, null, 2)}`;
    }
    const toolFunc = toolMap[name];
    if (!toolFunc || !toolFunc.func) return `Tool '${name}' not found`;
    const result = await toolFunc.func(args);
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

const today = new Date().toISOString().split('T')[0];

const SYSTEM_PROMPT = `You are the Reservations Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in managing guest reservations, check-ins, check-outs, room availability, and creating new bookings.

Today's date is: ${today}
The property has 3 cabins: Sand Cabin (SAND), Palm Cabin (PALM), Coconut Cabin (COCO).

=== VIEWING RESERVATIONS ===
- When user asks for reservations in a period (e.g., "February reservations"), use start_date and end_date parameters
- Example: "show February reservations" → search with start_date="2026-02-01", end_date="2026-02-28"
- Show the full HTML table returned by tools — do NOT summarize, truncate, or reformat it
- IMPORTANT: Pass the tool's HTML output DIRECTLY. Do not rewrite the table.

=== CREATING A NEW RESERVATION (CONVERSATIONAL FLOW) ===
When a user wants to book/reserve a cabin, guide them step-by-step. Do NOT ask for everything at once.

**Step 1 — Cabin & Dates:**
If user provides a cabin and dates (e.g., "book Sand for Dec 1"), immediately check availability first.
If they only say "make a booking", ask: "Which cabin (Sand, Palm, or Coconut) and what dates?"

**Step 2 — Check Availability:**
ALWAYS call check_availability before proceeding. If not available, suggest alternative dates or cabins.

**Step 3 — Guest Name:**
Ask: "What is the guest's first and last name?"

**Step 4 — Contact Details:**
Ask: "What is the guest's email address and phone number?"

**Step 5 — Extras (optional):**
Ask: "Would you like to add any extras to this booking?" If they say yes, call list_extras to show what's available, then ask which ones and how many. When creating the reservation, pass extras by NAME (e.g. [{"name": "Airport Transfer", "quantity": 1}]). The tool will look them up automatically.

**Step 6 — Additional Info:**
Ask: "How many adults and children? Any special requests or notes?"

**Step 7 — Confirm & Create:**
Summarize the booking details and ask: "Shall I create this reservation?" When they confirm, call create_reservation with all collected information.

**Step 8 — Send Confirmation Email:**
After a reservation is created successfully, ask: "Would you like me to send a confirmation email to the guest?"
If the user says yes, call send_booking_email with the confirmation_code from the reservation.
You can also send/resend emails for existing reservations when asked — just use the confirmation code.

IMPORTANT: Remember information the user provides across messages. Build up the booking details progressively. You have access to the full conversation history.

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and headings
- Use bullet lists (- item) for details
- When showing a booking summary, use a clear structured format like:

**Booking Confirmation**
- **Confirmation Code**: B3FZ00M5QAQ
- **Cabin**: Sand Cabin (SAND)
- **Check-in**: 07 Dec 2026
- **Check-out**: 09 Dec 2026
- **Guest**: Sheila Ohene
- **Email**: guest@email.com
- **Total**: GHS 7,550.00

- Show HTML tables returned by tools directly — do NOT reformat or rewrite them as text
- When tool returns an HTML table, include it as-is in your response

=== RULES ===
- ALWAYS ask user to confirm before updating/cancelling/deleting
- Currency is GHS (Ghanaian Cedi)
- Be conversational but concise
- NO filler phrases
- Format dates as: 15 Jan 2025
- Format currency as: GHS 1,250.00
- Use symbols: ✓ for success, ✗ for errors, ⚠ for warnings
- For deletions, warn that the action is permanent
- Weekend nights are Friday and Saturday (for pricing context)`;

export async function runReservationsAgent(messages) {
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
