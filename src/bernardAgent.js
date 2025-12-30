// src/bernardAgent.js
// OpenAI function calling with proper parameter extraction

import OpenAI from "openai";
import { supabase, formatTable } from "./bernardTools.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Import all tool functions from bernardTools
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
  searchReservationsTool,
  getReservationDetailsTool,
  updateReservationStatusTool,
  updateReservationDetailsTool,
  cancelReservationTool,
  deleteReservationTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "./bernardTools.js";

// Map tool names to their functions
const toolMap = {
  list_room_types: listRoomsTool,
  get_room_details: getRoomDetailsTool,
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
  search_reservations: searchReservationsTool,
  get_reservation_details: getReservationDetailsTool,
  update_reservation_status: updateReservationStatusTool,
  update_reservation_details: updateReservationDetailsTool,
  cancel_reservation: cancelReservationTool,
  delete_reservation: deleteReservationTool,
  get_today_checkins: getTodayCheckInsTool,
  get_today_checkouts: getTodayCheckOutsTool,
  check_availability: checkAvailabilityTool,
  get_occupancy_stats: getOccupancyStatsTool,
  get_revenue_stats: getRevenueStatsTool,
  get_client_analytics: getClientAnalyticsTool,
  compare_periods: comparePeriodsAnalyticsTool,
  list_pricing_models: listPricingModelsTool,
  get_pricing_model_details: getPricingModelDetailsTool,
  simulate_pricing: simulatePricingTool,
  get_seasonal_pricing: getSeasonalPricingTool,
};

// OpenAI function definitions
const tools = [
  {
    type: "function",
    function: {
      name: "list_room_types",
      description: "List all room types with pricing, capacity, and status",
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
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Room code (e.g., 'SAND') or room ID" }
        },
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
          code: { type: "string", description: "Unique room code (e.g., 'SAND', 'SEA')" },
          name: { type: "string", description: "Display name (e.g., 'Sand Cabin')" },
          description: { type: "string", description: "Optional room description" },
          weekday_price: { type: "number", description: "Base price per night on weekdays" },
          weekend_price: { type: "number", description: "Base price per night on weekends" },
          currency: { type: "string", description: "Currency code (GBP, USD, EUR, GHS)" },
          max_adults: { type: "number", description: "Maximum number of adults (default: 2)" },
          is_active: { type: "boolean", description: "Whether room is active (default: true)" },
          image_url: { type: "string", description: "Optional image URL" }
        },
        required: ["code", "name", "weekday_price", "weekend_price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_room_type",
      description: "Update an existing room type. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Room code or ID to update" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              weekday_price: { type: "number" },
              weekend_price: { type: "number" },
              currency: { type: "string" },
              max_adults: { type: "number" },
              is_active: { type: "boolean" },
              image_url: { type: "string" }
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
      description: "Delete a room type. IMPORTANT: Always confirm with user before deleting.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Room code or ID to delete" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_extras",
      description: "List all extras/add-ons with pricing",
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
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Extra name or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_extra",
      description: "Create a new extra/add-on. IMPORTANT: Always confirm with user before creating.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Extra name" },
          category: { type: "string", description: "Category (e.g., Food, Activity, Service)" },
          description: { type: "string", description: "Optional description" },
          price: { type: "number", description: "Price" },
          currency: { type: "string", description: "Currency code (default: GBP)" },
          unit_type: { type: "string", description: "Unit type (per_booking, per_night, per_person, per_person_per_night)" },
          is_active: { type: "boolean", description: "Whether extra is active (default: true)" }
        },
        required: ["name", "price"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_extra",
      description: "Update an existing extra. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Extra name or ID" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              description: { type: "string" },
              price: { type: "number" },
              currency: { type: "string" },
              unit_type: { type: "string" },
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
      description: "Delete an extra. IMPORTANT: Always confirm with user before deleting.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Extra name or ID to delete" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_packages",
      description: "List all packages with pricing and details",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_package_details",
      description: "Get details about a specific package",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Package code or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_package",
      description: "Create a new package. IMPORTANT: Always confirm with user before creating.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Package name" },
          description: { type: "string", description: "Optional description" },
          nights: { type: "number", description: "Number of nights required" },
          package_price: { type: "number", description: "Package price" },
          currency: { type: "string", description: "Currency code (default: GBP)" },
          is_active: { type: "boolean", description: "Whether package is active (default: true)" },
          is_featured: { type: "boolean", description: "Whether package is featured (default: false)" }
        },
        required: ["name", "nights"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_package",
      description: "Update an existing package. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              nights: { type: "number" },
              package_price: { type: "number" },
              currency: { type: "string" },
              is_active: { type: "boolean" },
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
      description: "Delete a package. IMPORTANT: Always confirm with user before deleting.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Package name or ID to delete" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_coupons",
      description: "List all coupons with discount details",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_coupon_details",
      description: "Get details about a specific coupon",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Coupon code" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_coupon",
      description: "Create a new coupon. IMPORTANT: Always confirm with user before creating.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Unique coupon code" },
          description: { type: "string", description: "Optional description" },
          discount_type: { type: "string", description: "Type: 'percentage' or 'fixed'" },
          discount_value: { type: "number", description: "Discount value (e.g., 20 for 20%)" },
          applies_to: { type: "string", description: "'rooms', 'extras', or 'both'" },
          valid_from: { type: "string", description: "Optional start date (YYYY-MM-DD)" },
          valid_until: { type: "string", description: "Optional end date (YYYY-MM-DD)" },
          max_uses: { type: "number", description: "Optional maximum uses" },
          is_active: { type: "boolean", description: "Whether coupon is active (default: true)" }
        },
        required: ["code", "discount_type", "discount_value", "applies_to"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_coupon",
      description: "Update an existing coupon. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          updates: {
            type: "object",
            properties: {
              description: { type: "string" },
              discount_type: { type: "string" },
              discount_value: { type: "number" },
              applies_to: { type: "string" },
              valid_from: { type: "string" },
              valid_until: { type: "string" },
              max_uses: { type: "number" },
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
      description: "Delete a coupon. IMPORTANT: Always confirm with user before deleting.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Coupon code to delete" }
        },
        required: ["identifier"]
      }
    }
  },
  {
  type: "function",
  function: {
    name: "validate_coupon",
    description: "Validate a coupon and calculate discount for a booking total.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Coupon code to validate" },
        booking_total: { type: "number", description: "Booking total before discount" }
      },
      required: ["code", "booking_total"]
    }
  }
}
,
  {
  type: "function",
  function: {
    name: "search_reservations",
    description: "Search for reservations by guest name, email, confirmation code, or status.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (name, email, or confirmation code)" },
        status: { type: "string", description: "Optional: filter by status (confirmed, cancelled, etc.)" },
        limit: { type: "number", description: "Maximum number of results (default 10)" }
      },
      required: []
    }
  }
},
  {
    type: "function",
    function: {
      name: "get_reservation_details",
      description: "Get full details of a specific reservation",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Confirmation code or reservation ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reservation_status",
      description: "Update reservation status. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
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
      description: "Update reservation details. IMPORTANT: Always confirm with user before updating.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Confirmation code or reservation ID" },
          updates: {
            type: "object",
            properties: {
              check_in: { type: "string", description: "New check-in date (YYYY-MM-DD)" },
              check_out: { type: "string", description: "New check-out date (YYYY-MM-DD)" },
              adults: { type: "number", description: "Number of adults" },
              children: { type: "number", description: "Number of children" },
              guest_first_name: { type: "string" },
              guest_last_name: { type: "string" },
              guest_email: { type: "string" },
              guest_phone: { type: "string" },
              notes: { type: "string" },
              payment_status: { type: "string", description: "paid, unpaid, or partial" }
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
      description: "Cancel a reservation. IMPORTANT: Always confirm with user before cancelling.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
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
      description: "Permanently delete a reservation. WARNING: Cannot be undone! IMPORTANT: Always confirm with user before deleting.",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
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
    name: "check_availability",
    description: "Check if a room type is available for specific dates.",
    parameters: {
      type: "object",
      properties: {
        room_code: { type: "string", description: "Room code (e.g., 'SAND')" },
        check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
        check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" }
      },
      required: ["room_code", "check_in", "check_out"]
    }
  }
}
,
  {
    type: "function",
    function: {
      name: "get_occupancy_stats",
      description: "Get occupancy statistics for a date range. Defaults to current month if no dates provided.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD). Optional, defaults to first day of current month." },
          end_date: { type: "string", description: "End date (YYYY-MM-DD). Optional, defaults to first day of next month." },
          room_code: { type: "string", description: "Optional: specific room code to filter by" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_stats",
      description: "Get revenue statistics for a date range. Defaults to current month if no dates provided.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date (YYYY-MM-DD). Optional, defaults to first day of current month." },
          end_date: { type: "string", description: "End date (YYYY-MM-DD). Optional, defaults to first day of next month." }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_client_analytics",
      description: "Get client/guest analytics including repeat guests, top spenders, and booking patterns",
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
      description: "Compare occupancy and revenue metrics between two time periods",
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
  {
    type: "function",
    function: {
      name: "list_pricing_models",
      description: "List all pricing models with their configuration",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_pricing_model_details",
      description: "Get details about a specific pricing model",
      parameters: {
        type: "object",
        properties: {
          confirm: { type: "boolean", description: "Set true only after the user explicitly confirms." },
          identifier: { type: "string", description: "Pricing model name or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "simulate_pricing",
      description: "Simulate dynamic pricing for a specific booking scenario",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Room code (e.g., 'SAND')" },
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
      name: "get_seasonal_pricing",
      description: "Get seasonal pricing rules for rooms",
      parameters: {
        type: "object",
        properties: {
          room_code: { type: "string", description: "Optional: specific room code" }
        },
        required: []
      }
    }
  }
];

// Execute tool by name
async function executeTool(name, args) {
  try {
    console.log(`🔧 Executing tool: ${name}`, args);

    const MUTATING = new Set([
      "create_room_type","update_room_type","delete_room_type",
      "create_extra","update_extra","delete_extra",
      "create_package","update_package","delete_package",
      "create_coupon","update_coupon","delete_coupon",
      "update_reservation_status","update_reservation_details","cancel_reservation","delete_reservation",
    ]);

    if (MUTATING.has(name) && !args?.confirm) {
      return `⚠️ Confirm required.\n\nReply: "confirm" to proceed.\n\nPending action: ${name}\nArgs: ${JSON.stringify(args, null, 2)}`;
    }

    
    const toolFunc = toolMap[name];
    if (!toolFunc || !toolFunc.func) {
      return `Tool '${name}' not found`;
    }
    
    const result = await toolFunc.func(args);
    return typeof result === "string" ? result : JSON.stringify(result);
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return `Error: ${error.message}`;
  }
}

// Main agent function
export async function runBernardAgent(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  console.log('🤖 Bernard starting with', messages.length, 'messages');

  const systemMessage = {
    role: "system",
    content: `You are Bernard, the AI assistant for Sojourn Cabins admin dashboard in Ghana.

You help manage rooms, packages, extras, coupons, reservations, and analytics.

IMPORTANT:
- Use tools to get accurate data from the database
- You can CREATE, UPDATE, and DELETE items. ALWAYS ask user to confirm before creating/updating/deleting
- For analytics tools (occupancy/revenue stats), if the user doesn't specify dates, call without parameters to get current month data
- When users ask for "occupancy" or "revenue" without dates, assume they want current month stats
- Display HTML tables returned by tools directly
- Currency is GHS (Ghanaian Cedi)
- Be concise and helpful

RESPONSE FORMATTING (CRITICAL):
- Keep responses SHORT and DIRECT (2-4 sentences for simple queries)
- NO filler phrases like "I'd be happy to", "Certainly!", "Let me help you with that"
- Use line breaks to separate information
- Use bullets ONLY for lists of 3+ items
- Format dates as: 15 Jan 2025 (dd Mmm yyyy)
- Format currency as: GHS 1,250.00
- Use symbols: ✓ for success, ✗ for errors, ⚠ for warnings
- For confirmations, be direct: "Delete 'X'? Cannot be undone." (not "Would you like me to...")
- Show tool-returned HTML tables as-is without reformatting
- NEVER use excessive bold, italics, or nested lists

EXAMPLES:
Query: "Show check-ins"
Good: "3 guests checking in today: John (SAND), Mary (SEA), David (SUN)"
Bad: "Certainly! I'd be happy to help you see today's check-ins. Let me retrieve that information for you..."

Query: "Delete test package"
Good: "Delete 'Test Package'? Cannot be undone."
Bad: "I can help you delete that package. Would you like me to proceed with deleting the package called 'Test Package'? Please note this is permanent."`
  };

  const allMessages = [systemMessage, ...messages];

  // Call OpenAI with function calling - optimized for speed
  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: allMessages,
    tools: tools,
    tool_choice: "auto",
    temperature: 0.3, // Lower temperature for faster, more consistent responses
    max_tokens: 1500, // Limit token usage for faster responses
  });

  let message = response.choices[0].message;
  const responseMessages = [message];

  // Handle tool calls (max 5 iterations)
  for (let iteration = 0; iteration < 5 && message.tool_calls; iteration++) {
    console.log(`🔄 Iteration ${iteration + 1}: ${message.tool_calls.length} tool calls`);
    
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const result = await executeTool(toolCall.function.name, args);
      
      responseMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result
      });
    }

    // Get next response from OpenAI
    response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [...allMessages, ...responseMessages],
      tools: tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 1500,
    });

    message = response.choices[0].message;
    responseMessages.push(message);
  }

  console.log('✅ Bernard completed');
  return message.content || "Done.";
}