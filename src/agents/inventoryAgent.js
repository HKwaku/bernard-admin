// src/agents/inventoryAgent.js
// Specialist agent for managing rooms, extras, packages, and coupons

import OpenAI from "openai";
import {
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  list_room_types: listRoomsTool,
  get_room_type_details: getRoomDetailsTool,
  create_room_type: createRoomTypeTool,
  update_room_type: updateRoomTypeTool,
  delete_room_type: deleteRoomTypeTool,
  list_extras: listExtrasTool,
  get_extra_details: getExtraDetailsTool,
  create_extra: createExtraTool,
  update_extra: updateExtraTool,
  delete_extra: deleteExtraTool,
  list_packages: listPackagesTool,
  get_package_details: getPackageDetailsTool,
  create_package: createPackageTool,
  update_package: updatePackageTool,
  delete_package: deletePackageTool,
  list_coupons: listCouponsTool,
  get_coupon_details: getCouponDetailsTool,
  create_coupon: createCouponTool,
  update_coupon: updateCouponTool,
  delete_coupon: deleteCouponTool,
  validate_coupon: validateCouponTool,
};

const tools = [
  // --- Rooms ---
  {
    type: "function",
    function: {
      name: "list_room_types",
      description: "List all room/cabin types with pricing, capacity, and status",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_room_type_details",
      description: "Get detailed information about a specific room type",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "Room code (e.g., SAND) or room ID" } },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_room_type",
      description: "Create a new room type. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Unique room code (e.g., LAKE)" },
          name: { type: "string", description: "Display name (e.g., Lake Cabin)" },
          description: { type: "string", description: "Room description" },
          weekday_price: { type: "number", description: "Base price per weekday night in GHS" },
          weekend_price: { type: "number", description: "Base price per weekend night in GHS" },
          currency: { type: "string", description: "Currency (default: GHS)" },
          max_adults: { type: "number", description: "Maximum adults (default: 2)" },
          is_active: { type: "boolean", description: "Active status (default: true)" },
          image_url: { type: "string", description: "Image URL" }
        },
        required: ["code", "name", "weekday_price", "weekend_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_room_type",
      description: "Update an existing room type. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Room code or ID" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" }, description: { type: "string" },
              weekday_price: { type: "number" }, weekend_price: { type: "number" },
              currency: { type: "string" }, max_adults: { type: "number" },
              is_active: { type: "boolean" }, image_url: { type: "string" }
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
      name: "delete_room_type",
      description: "Delete a room type. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Room code or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  // --- Extras ---
  {
    type: "function",
    function: {
      name: "list_extras",
      description: "List all extras/add-ons with pricing and categories",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_extra_details",
      description: "Get details about a specific extra/add-on",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "Extra name or ID" } },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_extra",
      description: "Create a new extra/add-on. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Extra name (e.g., Airport Transfer)" },
          code: { type: "string", description: "Unique code (e.g., AIRPORT_TRANSFER). Will be uppercased." },
          category: { type: "string", description: "Category (e.g., Food, Activity, Service)" },
          description: { type: "string", description: "Description" },
          price: { type: "number", description: "Price in GHS" },
          currency: { type: "string", description: "Currency (default: GHS)" },
          unit_type: { type: "string", description: "Pricing unit: per_booking, per_night, per_person, or per_person_per_night" },
          needs_guest_input: { type: "boolean", description: "Whether the guest needs to provide input (e.g., choose date/time). Default: false" },
          is_active: { type: "boolean", description: "Active status (default: true)" }
        },
        required: ["name", "code", "price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_extra",
      description: "Update an existing extra. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Extra name or ID" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" }, code: { type: "string", description: "Unique code" },
              category: { type: "string" }, description: { type: "string" },
              price: { type: "number" }, currency: { type: "string" },
              unit_type: { type: "string" }, is_active: { type: "boolean" },
              needs_guest_input: { type: "boolean", description: "Whether guest needs to provide input" }
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
      name: "delete_extra",
      description: "Delete an extra. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string" } },
        required: ["identifier"]
      }
    }
  },
  // --- Packages ---
  {
    type: "function",
    function: {
      name: "list_packages",
      description: "List all packages with pricing, nights, validity dates, room associations, and status",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_package_details",
      description: "Get full details of a specific package including included extras and room associations",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "Package name or ID" } },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_package",
      description: "Create a new package with optional room associations and included extras. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Unique package code (e.g., HONEYMOON)" },
          name: { type: "string", description: "Package name" },
          description: { type: "string", description: "Package description" },
          nights: { type: "number", description: "Number of nights (must be >= 1)" },
          package_price: { type: "number", description: "Package price in GHS" },
          currency: { type: "string", description: "Currency (default: GHS)" },
          valid_from: { type: "string", description: "Valid from date (YYYY-MM-DD)" },
          valid_until: { type: "string", description: "Valid until date (YYYY-MM-DD)" },
          image_url: { type: "string", description: "Image URL for the package" },
          is_active: { type: "boolean" },
          is_featured: { type: "boolean" },
          room_codes: { type: "string", description: "JSON array of room codes (e.g., '[\"SAND\",\"SEA\"]'). Omit for all rooms." },
          extras: { type: "string", description: "JSON array of extras with quantities (e.g., '[{\"name\":\"Private Chef\",\"quantity\":2}]')" }
        },
        required: ["code", "name", "nights", "package_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_package",
      description: "Update an existing package. Can also update room associations and included extras (full replacement). Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Package name, code, or ID" },
          updates: {
            type: "object",
            properties: {
              code: { type: "string", description: "Package code" },
              name: { type: "string" }, description: { type: "string" },
              nights: { type: "number" }, package_price: { type: "number" },
              currency: { type: "string" },
              valid_from: { type: "string", description: "YYYY-MM-DD or empty to clear" },
              valid_until: { type: "string", description: "YYYY-MM-DD or empty to clear" },
              image_url: { type: "string" },
              is_active: { type: "boolean" }, is_featured: { type: "boolean" },
              room_codes: { type: "string", description: "JSON array of room codes (replaces all). Use '[]' to clear." },
              extras: { type: "string", description: "JSON array of extras with quantities (replaces all). E.g., '[{\"name\":\"Chef\",\"quantity\":2}]'" }
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
      name: "delete_package",
      description: "Delete a package and its room/extras associations. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "Package name, code, or ID" } },
        required: ["identifier"]
      }
    }
  },
  // --- Coupons ---
  {
    type: "function",
    function: {
      name: "list_coupons",
      description: "List all coupons with discount type, value, validity dates, and active/expired status",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_coupon_details",
      description: "Get full details of a specific coupon including usage stats",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string", description: "Coupon code or ID" } },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_coupon",
      description: "Create a new coupon. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Coupon code (e.g., SUMMER2026)" },
          discount_type: { type: "string", description: "percentage or fixed" },
          discount_value: { type: "number", description: "Discount amount (e.g., 20 for 20% or GHS 20)" },
          applies_to: { type: "string", description: "What it applies to: 'both' (room + extras), 'rooms' only, or 'extras' only" },
          description: { type: "string" },
          currency: { type: "string", description: "Currency for fixed discounts (default: GHS)" },
          extra_ids: { type: "string", description: "JSON array of extra IDs to target. Omit for all extras." },
          valid_from: { type: "string", description: "YYYY-MM-DD" },
          valid_until: { type: "string", description: "YYYY-MM-DD" },
          max_uses: { type: "number", description: "Max number of total uses" },
          max_uses_per_guest: { type: "number", description: "Max uses per individual guest" },
          min_booking_amount: { type: "number", description: "Minimum booking amount (GHS) for coupon to apply" },
          is_active: { type: "boolean" }
        },
        required: ["code", "discount_type", "discount_value", "applies_to"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_coupon",
      description: "Update an existing coupon. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Coupon code or ID" },
          updates: {
            type: "object",
            properties: {
              code: { type: "string" },
              description: { type: "string" },
              discount_type: { type: "string", description: "percentage or fixed" },
              discount_value: { type: "number" },
              applies_to: { type: "string", description: "both, rooms, or extras" },
              currency: { type: "string" },
              extra_ids: { type: "string", description: "JSON array of extra IDs, or 'null' to clear" },
              valid_from: { type: "string" }, valid_until: { type: "string" },
              max_uses: { type: "number" },
              max_uses_per_guest: { type: "number" },
              min_booking_amount: { type: "number" },
              is_active: { type: "boolean" }
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
      name: "delete_coupon",
      description: "Delete a coupon. Only call AFTER user explicitly confirms.",
      parameters: {
        type: "object",
        properties: { identifier: { type: "string" } },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_coupon",
      description: "Validate a coupon and calculate the discount for a given booking total",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Coupon code" },
          booking_total: { type: "number", description: "Booking total to apply discount to" }
        },
        required: ["code", "booking_total"]
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

const SYSTEM_PROMPT = `You are the Inventory Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in managing rooms/cabins, extras/add-ons, packages, and coupons.

CRITICAL RULE — NEVER GUESS, ALWAYS LOOK UP:
Do NOT assume or hardcode ANY inventory details (names, codes, prices, categories, statuses, descriptions).
You MUST call the appropriate database lookup tool BEFORE referencing any item:

| When you need to know about… | FIRST call this tool         |
|------------------------------|------------------------------|
| Rooms / Cabins               | list_room_types              |
| A specific room              | get_room_type_details        |
| Extras / Add-ons             | list_extras                  |
| A specific extra             | get_extra_details            |
| Packages                     | list_packages                |
| A specific package           | get_package_details          |
| Coupons                      | list_coupons                 |
| A specific coupon            | get_coupon_details           |

If the user mentions an item by name or code, look it up FIRST — do not echo back details you have not fetched.

=== LISTING ITEMS ===
- When user asks to list/show items, call the appropriate list tool
- Show HTML tables returned by tools DIRECTLY — do NOT summarize, truncate, or reformat
- IMPORTANT: Pass the tool's output as-is in your response

=== EDITING ITEMS ===
When a user wants to edit/update any item, you MUST follow this exact flow:
1. FIRST call the get-details tool to fetch the item's CURRENT values from the database:
   - Room → get_room_type_details
   - Extra → get_extra_details
   - Package → get_package_details
   - Coupon → get_coupon_details
2. Show the user the current values you fetched
3. Ask what they want to change (if not already specified)
4. Summarize the proposed change and ask to confirm
5. ONLY THEN call the update tool
NEVER guess or assume current values — always look them up first.

=== DELETING ITEMS ===
When a user wants to delete an item:
1. FIRST look up the item to confirm it exists
2. Show the item details and warn this is permanent
3. Ask for explicit confirmation
4. ONLY THEN call the delete tool

=== CREATING NEW ITEMS (CONVERSATIONAL FLOW) ===
When a user wants to create a new room, extra, package, or coupon, guide them through it step-by-step.
Do NOT ask for everything at once. Ask one or two related questions at a time.

**Creating a Room Type:**
1. Ask: "What should the room code and name be?" (e.g., code: LAKE, name: Lake Cabin)
2. Ask: "What is the weekday price and weekend price per night (in GHS)?"
3. Ask: "What is the maximum number of adults? Any description?"
4. Summarize and ask to confirm.

**Creating an Extra/Add-on:**
1. Ask: "What is the name and code of the extra?" (e.g., name: Private Chef and Food, code: CHEF)
2. Ask: "What category? (e.g., Food, Activity, Service) And what is the price (GHS)?"
3. Ask: "How is it charged: per booking, per night, per person, or per person per night?"
4. Ask: "Does the guest need to provide input for this extra (e.g., choosing a date/time)?"
5. Summarize and ask to confirm.

**Creating a Package:**
1. Ask: "What is the package code and name?" (e.g., code: HONEYMOON, name: Honeymoon Package)
2. Ask: "How many nights? And what is the package price (GHS)?"
3. Ask: "Which rooms/cabins should this package be available for?" (Call list_room_types to show options. Omit for all rooms.)
4. Ask: "Any extras included in this package?" (Call list_extras to show options. Include quantity for each.)
5. Ask: "Any validity dates? Should it be active and/or featured?"
6. Summarize and ask to confirm.

**Creating a Coupon:**
1. Ask: "What code should the coupon have?" (e.g., SUMMER2026)
2. Ask: "What type of discount — percentage or fixed amount? And what value?"
3. Ask: "Does it apply to rooms, extras, or both?"
4. Ask: "Should it target specific extras only?" (If yes, call list_extras to let user choose, then pass the extra IDs.)
5. Ask: "Any validity dates, usage limits, max uses per guest, or minimum booking amount?"
6. Summarize and ask to confirm.

IMPORTANT: Remember information the user provides across messages. Build up the creation details progressively.

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels and headings
- Use bullet lists (- item) for details
- When presenting item details, use structured format:

**[Room Name] ([CODE])**
- **Weekday Price**: GHS [amount]
- **Weekend Price**: GHS [amount]
- **Max Adults**: [number]
- **Status**: Active

- Show HTML tables returned by tools directly — do NOT reformat them
- When tool returns an HTML table, include it as-is in your response

=== RULES ===
- ALWAYS ask user to confirm before creating/updating/deleting
- Currency is GHS (Ghanaian Cedi)
- Be conversational but concise
- NO filler phrases like "I'd be happy to", "Certainly!"
- Format dates as: 15 Jan 2025
- Format currency as: GHS 1,250.00
- Use symbols: ✓ for success, ✗ for errors, ⚠ for warnings`;

export async function runInventoryAgent(messages) {
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
