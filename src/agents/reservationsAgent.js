// src/agents/reservationsAgent.js
// Specialist agent for managing reservations, check-ins/outs, availability, and booking creation

import OpenAI from "openai";
import {
  searchReservationsTool,
  getReservationDetailsTool,
  createReservationTool,
  createGroupReservationTool,
  createPackageReservationTool,
  updateReservationStatusTool,
  updateReservationDetailsTool,
  cancelReservationTool,
  deleteReservationTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  listExtrasTool,
  sendBookingEmailTool,
  listRoomsTool,
  checkAllAvailabilityTool,
  listPackagesTool,
  getPackageDetailsTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  search_reservations: searchReservationsTool,
  get_reservation_details: getReservationDetailsTool,
  create_reservation: createReservationTool,
  create_group_reservation: createGroupReservationTool,
  create_package_reservation: createPackageReservationTool,
  update_reservation_status: updateReservationStatusTool,
  update_reservation_details: updateReservationDetailsTool,
  cancel_reservation: cancelReservationTool,
  delete_reservation: deleteReservationTool,
  get_today_checkins: getTodayCheckInsTool,
  get_today_checkouts: getTodayCheckOutsTool,
  check_availability: checkAvailabilityTool,
  check_all_availability: checkAllAvailabilityTool,
  list_extras: listExtrasTool,
  send_booking_email: sendBookingEmailTool,
  list_room_types: listRoomsTool,
  list_packages: listPackagesTool,
  get_package_details: getPackageDetailsTool,
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
          room_code: { type: "string", description: "Room code as returned by list_room_types (e.g., 'SAND')" },
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
      description: "Check availability of ALL rooms for specific dates. Returns which rooms are available and which are booked. Use this when the user wants to book but hasn't specified a room — much faster than checking each room individually.",
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
      description: "List all available extras/add-ons that can be added to a reservation. Call this when asking the guest about extras.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "send_booking_email",
      description: "Send booking emails to the guest. Supports single reservations AND group bookings (GRP-XXXXXX codes). Can send confirmation email, extras selection email, or both.",
      parameters: {
        type: "object",
        properties: {
          confirmation_code: { type: "string", description: "The reservation confirmation code OR group reservation code (GRP-XXXXXX for group bookings)" },
          email_type: { type: "string", enum: ["confirmation", "extras", "both"], description: "Which email to send: 'confirmation' for booking confirmation only, 'extras' for extras selection email only, 'both' for both (default)" }
        },
        required: ["confirmation_code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description: "Create a new reservation. Only call this after: (1) availability is confirmed, (2) all required guest information is collected. Uses the active pricing model by default. Only pass price_override_per_night if the user explicitly requests a custom/manual price.",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Room code as returned by list_room_types (e.g., 'SAND')" },
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
          coupon_code: { type: "string", description: "Coupon code to apply" },
          price_override_per_night: { type: "number", description: "Manual price override per night in GHS. Only use if user explicitly requests a custom price. Omit to use the active pricing model." }
        },
        required: ["room_code", "check_in", "check_out", "guest_first_name", "guest_last_name", "guest_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reservation_status",
      description: "Update reservation status. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
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
      description: "Update reservation details. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
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
      description: "Cancel a reservation. Only call AFTER user explicitly confirms.",
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
      name: "delete_reservation",
      description: "Permanently delete a reservation. WARNING: Cannot be undone! Only call AFTER user explicitly confirms.",
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
  {
    type: "function",
    function: {
      name: "list_room_types",
      description: "List all available rooms/cabins with their codes, names, pricing, and capacity. Call this when you need to know what rooms exist or to show the user the available options.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "create_group_reservation",
      description: "Create a GROUP booking with MULTIPLE rooms. All rooms share the same guest info and dates. Generates a GRP-XXXXXX group code. Uses active pricing model by default. Only pass price_override_per_night if user explicitly requests a custom price.",
      parameters: {
        type: "object",
        properties: {
          room_codes: { type: "string", description: "JSON array of room codes, e.g. [\"SAND\", \"PALM\"]" },
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
          guest_first_name: { type: "string", description: "Guest first name" },
          guest_last_name: { type: "string", description: "Guest last name" },
          guest_email: { type: "string", description: "Guest email address" },
          guest_phone: { type: "string", description: "Guest phone number (digits only)" },
          country_code: { type: "string", description: "Country dialling code (e.g., +233)" },
          adults: { type: "number", description: "Total adults across all rooms" },
          children: { type: "number", description: "Number of children (default 0)" },
          notes: { type: "string", description: "Special requests or notes" },
          extras: { type: "string", description: "JSON array of extras by name, e.g. [{\"name\": \"Airport Transfer\", \"quantity\": 1}]" },
          coupon_code: { type: "string", description: "Coupon code to apply" },
          price_override_per_night: { type: "number", description: "Manual price override per night in GHS applied to ALL rooms. Only use if user explicitly requests a custom price. Omit to use the active pricing model." }
        },
        required: ["room_codes", "check_in", "check_out", "guest_first_name", "guest_last_name", "guest_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_package_reservation",
      description: "Create a reservation using a PACKAGE. Fetches package details (nights, price, included extras, allowed rooms), checks availability, and creates the booking. Use when user specifically wants to book a package.",
      parameters: {
        type: "object",
        properties: {
          package_code: { type: "string", description: "Package code or name" },
          room_code: { type: "string", description: "Room code (must be one of the package's allowed rooms)" },
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD). Check-out is calculated from package nights." },
          guest_first_name: { type: "string", description: "Guest first name" },
          guest_last_name: { type: "string", description: "Guest last name" },
          guest_email: { type: "string", description: "Guest email address" },
          guest_phone: { type: "string", description: "Guest phone number" },
          country_code: { type: "string", description: "Country dialling code (e.g., +233)" },
          adults: { type: "number", description: "Number of adults (default 2)" },
          children: { type: "number", description: "Number of children (default 0)" },
          notes: { type: "string", description: "Special requests" },
          coupon_code: { type: "string", description: "Coupon code to apply" }
        },
        required: ["package_code", "room_code", "check_in", "guest_first_name", "guest_last_name", "guest_email"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_packages",
      description: "List all available packages with pricing, nights, and validity dates.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_package_details",
      description: "Get full details of a package including included extras and allowed rooms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Package name or ID" }
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

const today = new Date().toISOString().split('T')[0];

const SYSTEM_PROMPT = `You are the Reservations Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in managing guest reservations, check-ins, check-outs, room availability, and creating new bookings.

Today's date is: ${today}

IMPORTANT: Do NOT assume or hardcode room/cabin names. ALWAYS call list_room_types to get the actual available rooms from the database when you need to present options to the user.

=== VIEWING RESERVATIONS ===
- When user asks for reservations in a period (e.g., "February reservations"), use start_date and end_date parameters
- Example: "show February reservations" → search with start_date="2026-02-01", end_date="2026-02-28"
- Show the full HTML table returned by tools — do NOT summarize, truncate, or reformat it
- IMPORTANT: Pass the tool's HTML output DIRECTLY. Do not rewrite the table.

=== CREATING A NEW RESERVATION (CONVERSATIONAL FLOW) ===
When a user wants to book/reserve a cabin, guide them step-by-step. Do NOT ask for everything at once.

**Step 1 — Cabin & Dates:**
If user provides a cabin and dates, call check_availability for that specific room to verify it's free.
If user provides dates but NO specific cabin, call check_all_availability with those dates. This checks ALL rooms at once and returns which are available and which are booked. Only present the available rooms to the user.
If user only says "make a booking" with no dates, ask for dates first, then call check_all_availability.
IMPORTANT: NEVER just list rooms without checking availability when dates are provided. Always use check_all_availability or check_availability.

**Step 2 — Check Availability:**
ALWAYS call check_availability (or check_all_availability) before proceeding with a booking. If the selected room is not available, show which other rooms ARE available using check_all_availability.

**Step 3 — Guest Name:**
Ask: "What is the guest's first and last name?"

**Step 4 — Contact Details:**
Ask: "What is the guest's email address?" Then ask: "What is the guest's country code (e.g., +233 for Ghana, +44 for UK) and phone number?" Always collect country_code and guest_phone as SEPARATE values. Pass them separately to create_reservation.

**Step 5 — Extras (optional):**
Ask: "Would you like to add any extras to this booking?"
If they say yes or ask what's available, you MUST call the list_extras tool IMMEDIATELY to fetch the actual extras from the database. Show the table returned by the tool directly.
⚠ CRITICAL: You do NOT know what extras exist. You MUST call list_extras every time extras are discussed. NEVER list, suggest, or name any extras from memory. If you have not called list_extras in this conversation, call it NOW before mentioning any extra by name.
When creating the reservation, pass extras by NAME exactly as returned by list_extras (e.g. [{"name": "Airport Transfer", "quantity": 1}]).

**Step 6 — Additional Info:**
Ask: "How many adults and children? Any special requests or notes?"

**Step 7 — Pricing:**
By default, the tool uses the active pricing model to calculate room cost automatically. Do NOT pass price_override_per_night unless the user explicitly asks to set a custom/manual price per night.
If the user says something like "charge GHS 500 per night" or "override the price to 300/night", THEN pass price_override_per_night with that value.

**Step 8 — Confirm & Create:**
Summarize the booking details and ask: "Shall I create this reservation?" When they confirm, call create_reservation with all collected information.

**Step 9 — Send Emails:**
After a reservation is created successfully, ask: "Would you like me to send a confirmation email to the guest?"
If the user says yes, call send_booking_email with the confirmation_code and email_type="both".
- For just the booking confirmation: email_type="confirmation"
- For just the extras selection email: email_type="extras"
- For both: email_type="both" (default)
You can also send/resend emails for existing reservations when asked — just use the confirmation code.
When user specifically asks to "send extras selection email" or "send extras email", use email_type="extras".

IMPORTANT: Remember information the user provides across messages. Build up the booking details progressively. You have access to the full conversation history.

=== GROUP BOOKINGS ===
When a user wants to book MULTIPLE rooms at once (e.g., "book 2 cabins", "group booking for 6 people", "reserve Sand and Palm together"):

**Step 1 — Dates & Availability:**
Ask for dates, then call check_all_availability to see which rooms are free.

**Step 2 — Room Selection:**
Show available rooms and ask which rooms to include. The user may select 2 or more rooms.

**Step 3 — Guest Info:**
Same as single booking: name, email, country code + phone (separately).

**Step 4 — Total Adults:**
Ask: "How many adults in total across all rooms?" The tool distributes them automatically based on room capacity.

**Step 5 — Extras & Notes:**
Same as single booking. Extras are attached to the primary (first) room.

**Step 6 — Confirm & Create:**
Summarize ALL rooms, pricing per room, and the group total. Ask: "Shall I create this group booking?"
When confirmed, call create_group_reservation with the room_codes as a JSON array (e.g., ["SAND", "PALM"]).

**Step 7 — Send Emails:**
⚠ CRITICAL: For group bookings, you MUST use the GROUP CODE (GRP-XXXXXX) when calling send_booking_email. Call it ONCE with the group code — NOT once per room. The tool aggregates all rooms into a single consolidated group booking email. NEVER use individual room confirmation codes for group booking emails.

IMPORTANT: Group bookings require at least 2 rooms. For a single room, always use create_reservation.

=== PACKAGE BOOKINGS ===
When a user wants to book a PACKAGE (e.g., "book the honeymoon package", "package booking"):

**Step 1 — Package Selection:**
If user doesn't specify which package, call list_packages to show available packages. If they mention a package name, call get_package_details to show its details (included extras, allowed rooms, nights, price).

**Step 2 — Check-in Date:**
Ask for the check-in date. The check-out is automatically calculated from the package's number of nights.

**Step 3 — Room Selection:**
The package determines which rooms are allowed. Call get_package_details to see allowed rooms, then ask which room to book.

**Step 4 — Guest Info:**
Same as regular booking: name, email, country code + phone.

**Step 5 — Confirm & Create:**
Summarize: package name, room, dates (check-in + auto check-out), price, included extras. Ask to confirm.
When confirmed, call create_package_reservation. The tool automatically:
- Uses the package price (not dynamic pricing)
- Adds package extras to the reservation
- Sets package_id, package_code, package_name on the reservation

**Step 6 — Send Emails:**
Same as regular booking.

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and headings
- Use bullet lists (- item) for details
- When showing a booking summary, use a clear structured format like:

**Booking Confirmation**
- **Confirmation Code**: [code]
- **Cabin**: [room name from database]
- **Check-in**: 07 Dec 2026
- **Check-out**: 09 Dec 2026
- **Guest**: [name]
- **Email**: [email]
- **Total**: GHS [amount]

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
- Weekend nights are Friday and Saturday (for pricing context)
- NEVER hardcode, guess, or invent extras. You MUST call list_extras to know what extras exist. If you haven't called it yet, call it before naming any extra.
- NEVER hardcode, guess, or invent room names or codes. You MUST call list_room_types to know what rooms exist.`;

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
