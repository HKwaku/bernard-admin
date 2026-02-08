// src/agents/editReservationsAgent.js
// Specialist agent for editing existing reservations — mirrors the edit reservation modal

import OpenAI from "openai";
import {
  getReservationDetailsTool,
  editReservationTool,
  searchReservationsTool,
  checkAvailabilityTool,
  checkAllAvailabilityTool,
  listExtrasTool,
  listRoomsTool,
  sendBookingEmailTool,
  validateCouponTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  get_reservation_details: getReservationDetailsTool,
  edit_reservation: editReservationTool,
  search_reservations: searchReservationsTool,
  check_availability: checkAvailabilityTool,
  check_all_availability: checkAllAvailabilityTool,
  list_extras: listExtrasTool,
  list_room_types: listRoomsTool,
  send_booking_email: sendBookingEmailTool,
  validate_coupon: validateCouponTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_reservation_details",
      description: "Get full details of a reservation by confirmation code or ID. Always call this first to see current state before making edits.",
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
      name: "search_reservations",
      description: "Search for reservations by guest name, email, confirmation code, status, or date range.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term - guest name, email, or confirmation code" },
          status: { type: "string", description: "Filter by status" },
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
      name: "edit_reservation",
      description: "Apply changes to a reservation. Handles room changes, date changes, extras, coupons, pricing recalculation, guest info, status, and payment. Only include fields you want to change — omitted fields keep their current values. For extras, pass the FULL list of desired extras (replaces existing).",
      parameters: {
        type: "object",
        properties: {
          confirmation_code: { type: "string", description: "Confirmation code of the reservation to edit" },
          guest_first_name: { type: "string", description: "New guest first name" },
          guest_last_name: { type: "string", description: "New guest last name" },
          guest_email: { type: "string", description: "New guest email" },
          guest_phone: { type: "string", description: "New guest phone number (digits only, no country code)" },
          country_code: { type: "string", description: "New country dialling code (e.g., +233)" },
          check_in: { type: "string", description: "New check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "New check-out date (YYYY-MM-DD)" },
          room_code: { type: "string", description: "New room code — triggers availability check + price recalculation" },
          adults: { type: "number", description: "New number of adults" },
          children: { type: "number", description: "New number of children" },
          extras: { type: "string", description: "JSON array of ALL extras (replaces existing). e.g. [{\"name\": \"Airport Transfer\", \"quantity\": 1}]. Pass [] to remove all." },
          coupon_code: { type: "string", description: "Apply or change coupon" },
          remove_coupon: { type: "boolean", description: "Set true to remove current coupon" },
          status: { type: "string", description: "New status: pending_payment, confirmed, checked-in, checked-out, cancelled" },
          payment_status: { type: "string", description: "New payment status: unpaid, partial, paid, refunded" },
          price_override_per_night: { type: "number", description: "Manual price per night (overrides dynamic pricing)" },
          is_influencer: { type: "boolean", description: "Influencer flag" },
          notes: { type: "string", description: "New notes/special requests" },
          currency: { type: "string", description: "Currency code (default GHS)" }
        },
        required: ["confirmation_code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check if a specific room is available for given dates.",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Room code" },
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
      name: "check_all_availability",
      description: "Check availability of ALL rooms for specific dates.",
      parameters: {
        type: "object",
        properties: {
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" }
        },
        required: ["check_in", "check_out"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_extras",
      description: "List all available extras/add-ons.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "list_room_types",
      description: "List all available rooms/cabins with pricing and capacity.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "send_booking_email",
      description: "Send booking emails to the guest after editing. Supports single reservations and group bookings (GRP-XXXXXX codes).",
      parameters: {
        type: "object",
        properties: {
          confirmation_code: { type: "string", description: "The reservation confirmation code or group code (GRP-XXXXXX)" },
          email_type: { type: "string", enum: ["confirmation", "extras", "both"], description: "Which email to send" }
        },
        required: ["confirmation_code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_coupon",
      description: "Validate a coupon code before applying it.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Coupon code to validate" },
          booking_total: { type: "number", description: "Current booking total" }
        },
        required: ["code"]
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

const SYSTEM_PROMPT = `You are the Edit Reservations Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in modifying existing reservations. You mirror the functionality of the Edit Reservation modal in the admin dashboard.

Today's date is: ${today}

IMPORTANT: Do NOT assume or hardcode room/cabin names. ALWAYS call list_room_types to get the actual available rooms from the database when needed.

=== EDITING WORKFLOW ===

**Step 1 — Identify Reservation:**
If the user provides a confirmation code, call get_reservation_details to fetch the current state.
If the user describes the reservation (e.g., "John's booking next week"), call search_reservations to find it, then get_reservation_details for full info.

**Step 2 — Show Current State:**
Display the current reservation details clearly so the user can see what they're working with.

**Step 3 — Understand Changes:**
Ask the user what they'd like to change. Common edits include:
- **Guest info**: name, email, phone (country code + number separately), influencer status
- **Dates**: check-in, check-out (triggers availability check + price recalculation)
- **Room**: move to a different cabin (triggers availability check + price recalculation)
- **Extras**: add, remove, or change extras (MUST call list_extras — NEVER guess what extras exist)
- **Coupon**: apply, change, or remove a coupon
- **Pricing**: manual price override per night
- **Status**: pending_payment, confirmed, checked-in, checked-out, cancelled
- **Payment**: unpaid, partial, paid, refunded
- **Notes**: special requests or internal notes

**Step 4 — Validate Before Applying:**
- If changing room or dates, check availability first using check_availability or check_all_availability
- If applying a coupon, optionally validate it first
- If changing extras, call list_extras to show options

**Step 5 — Confirm & Apply:**
Summarize the proposed changes and ask: "Shall I apply these changes?"
When confirmed, call edit_reservation with ONLY the fields being changed (plus the confirmation_code).

**Step 6 — Send Updated Email (Optional):**
After editing, ask: "Would you like me to send an updated confirmation email to the guest?"

=== IMPORTANT RULES ===
- ALWAYS fetch reservation details FIRST before making any edit
- Phone number and country code are SEPARATE fields — always pass them individually
- For extras: the edit_reservation tool REPLACES all extras. If the user wants to ADD an extra, you must include ALL existing extras PLUS the new one
- For extras: ALWAYS call list_extras to show actual extras from the database. NEVER guess, invent, or name any extras from memory. If you haven't called list_extras in this conversation, call it NOW before mentioning any extra by name.
- NEVER hardcode, guess, or invent room names or codes. ALWAYS call list_room_types to know what rooms exist.
- Currency is GHS (Ghanaian Cedi)
- Be conversational but concise
- Format dates as: 15 Jan 2025
- Format currency as: GHS 1,250.00
- Use symbols: ✓ for success, ✗ for errors, ⚠ for warnings
- Show HTML tables returned by tools directly — do NOT reformat them

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and headings
- Use bullet lists (- item) for details
- When showing current reservation state, use a clear structured format:

**Current Reservation — [CODE]**
- **Cabin**: [room name]
- **Check-in**: [date]
- **Check-out**: [date]
- **Guest**: [name]
- **Email**: [email]
- **Phone**: [country_code] [phone]
- **Adults**: [n] | **Children**: [n]
- **Room Cost**: GHS [amount]
- **Extras**: GHS [amount]
- **Discount**: -GHS [amount]
- **Total**: GHS [amount]
- **Status**: [status] | **Payment**: [payment_status]`;

export async function runEditReservationsAgent(messages) {
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
