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
      description: "Create a new room type. IMPORTANT: Always confirm with user before creating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after user explicitly confirms" },
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
      description: "Update an existing room type. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
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
      description: "Delete a room type. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
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
      description: "Create a new extra/add-on. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          name: { type: "string", description: "Extra name (e.g., Airport Transfer)" },
          category: { type: "string", description: "Category (e.g., transport, food, activity)" },
          description: { type: "string", description: "Description" },
          price: { type: "number", description: "Price in GHS" },
          currency: { type: "string", description: "Currency (default: GHS)" },
          unit_type: { type: "string", description: "Pricing unit: per_booking, per_night, per_person, or per_person_per_night" },
          is_active: { type: "boolean", description: "Active status (default: true)" }
        },
        required: ["name", "price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_extra",
      description: "Update an existing extra. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          identifier: { type: "string" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" }, category: { type: "string" },
              description: { type: "string" }, price: { type: "number" },
              currency: { type: "string" }, unit_type: { type: "string" },
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
      name: "delete_extra",
      description: "Delete an extra. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: { confirm: { type: "boolean" }, identifier: { type: "string" } },
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
      description: "Create a new package. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          name: { type: "string", description: "Package name" },
          description: { type: "string", description: "Package description" },
          nights: { type: "number", description: "Minimum nights" },
          package_price: { type: "number", description: "Package price in GHS" },
          currency: { type: "string", description: "Currency (default: GHS)" },
          is_active: { type: "boolean" },
          is_featured: { type: "boolean" }
        },
        required: ["name", "nights"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_package",
      description: "Update an existing package. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          identifier: { type: "string", description: "Package name or ID" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" }, description: { type: "string" },
              nights: { type: "number" }, package_price: { type: "number" },
              currency: { type: "string" }, is_active: { type: "boolean" },
              is_featured: { type: "boolean" }
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
      description: "Delete a package. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: { confirm: { type: "boolean" }, identifier: { type: "string" } },
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
      description: "Create a new coupon. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          code: { type: "string", description: "Coupon code (e.g., SUMMER2026)" },
          description: { type: "string" },
          discount_type: { type: "string", description: "percentage or fixed" },
          discount_value: { type: "number", description: "Discount amount" },
          applies_to: { type: "string", description: "rooms, extras, or both" },
          valid_from: { type: "string", description: "YYYY-MM-DD" },
          valid_until: { type: "string", description: "YYYY-MM-DD" },
          max_uses: { type: "number", description: "Max number of uses" },
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
      description: "Update an existing coupon. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
          identifier: { type: "string", description: "Coupon code or ID" },
          updates: {
            type: "object",
            properties: {
              description: { type: "string" }, discount_type: { type: "string" },
              discount_value: { type: "number" }, applies_to: { type: "string" },
              valid_from: { type: "string" }, valid_until: { type: "string" },
              max_uses: { type: "number" }, is_active: { type: "boolean" }
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
      description: "Delete a coupon. IMPORTANT: Always confirm with user.",
      parameters: {
        type: "object",
        properties: { confirm: { type: "boolean" }, identifier: { type: "string" } },
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

const MUTATING = new Set([
  "create_room_type", "update_room_type", "delete_room_type",
  "create_extra", "update_extra", "delete_extra",
  "create_package", "update_package", "delete_package",
  "create_coupon", "update_coupon", "delete_coupon",
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

const SYSTEM_PROMPT = `You are the Inventory Agent for Sojourn Cabins admin dashboard in Ghana.
You specialize in managing rooms/cabins, extras/add-ons, packages, and coupons.

The property has 3 cabins: Sand Cabin (SAND), Palm Cabin (PALM), Coconut Cabin (COCO).

=== LISTING ITEMS ===
- When user asks to list/show items, call the appropriate list tool
- Show HTML tables returned by tools DIRECTLY — do NOT summarize, truncate, or reformat
- IMPORTANT: Pass the tool's output as-is in your response

=== CREATING NEW ITEMS (CONVERSATIONAL FLOW) ===
When a user wants to create a new room, extra, package, or coupon, guide them through it step-by-step.
Do NOT ask for everything at once. Ask one or two related questions at a time.

**Creating a Room Type:**
1. Ask: "What should the room code and name be?" (e.g., code: LAKE, name: Lake Cabin)
2. Ask: "What is the weekday price and weekend price per night (in GHS)?"
3. Ask: "What is the maximum number of adults? Any description?"
4. Summarize and ask to confirm.

**Creating an Extra/Add-on:**
1. Ask: "What is the name and category of the extra?" (categories: transport, food, activity, amenity)
2. Ask: "What is the price (GHS)? And how is it charged: per booking, per night, per person, or per person per night?"
3. Summarize and ask to confirm.

**Creating a Package:**
1. Ask: "What is the package name and how many nights minimum?"
2. Ask: "What is the package price (GHS)? Any description?"
3. Ask: "Should it be active and/or featured?"
4. Summarize and ask to confirm.

**Creating a Coupon:**
1. Ask: "What code should the coupon have?" (e.g., SUMMER2026)
2. Ask: "What type of discount — percentage or fixed amount? And what value?"
3. Ask: "Does it apply to rooms, extras, or both?"
4. Ask: "Any validity dates or usage limits?"
5. Summarize and ask to confirm.

IMPORTANT: Remember information the user provides across messages. Build up the creation details progressively.

=== RULES ===
- ALWAYS ask user to confirm before creating/updating/deleting
- Currency is GHS (Ghanaian Cedi)
- Show HTML tables returned by tools directly — do NOT reformat them
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
