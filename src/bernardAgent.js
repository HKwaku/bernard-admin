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
  listExtrasTool,
  getExtraDetailsTool,
  listPackagesTool,
  getPackageDetailsTool,
  listCouponsTool,
  getCouponDetailsTool,
  validateCouponTool,
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  getOccupancyStatsTool,
  getRevenueStatsTool,
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "./bernardTools.js";

// Map tool names to their functions
const toolMap = {
  list_room_types: listRoomsTool,
  get_room_details: getRoomDetailsTool,
  list_extras: listExtrasTool,
  get_extra_details: getExtraDetailsTool,
  list_packages: listPackagesTool,
  get_package_details: getPackageDetailsTool,
  list_coupons: listCouponsTool,
  get_coupon_details: getCouponDetailsTool,
  validate_coupon: validateCouponTool,
  search_reservations: searchReservationsTool,
  get_reservation_details: getReservationDetailsTool,
  get_today_checkins: getTodayCheckInsTool,
  get_today_checkouts: getTodayCheckOutsTool,
  check_availability: checkAvailabilityTool,
  get_occupancy_stats: getOccupancyStatsTool,
  get_revenue_stats: getRevenueStatsTool,
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
      name: "get_room_details",
      description: "Get detailed information about a specific room type",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Room code (e.g., 'SAND') or room ID" }
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
          identifier: { type: "string", description: "Extra name or ID" }
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
          identifier: { type: "string", description: "Package code or ID" }
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
          identifier: { type: "string", description: "Coupon code" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_coupon",
      description: "Validate a coupon code and check if it's currently valid",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Coupon code to validate" }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_reservations",
      description: "Search for reservations by guest name, email, or confirmation code",
      parameters: {
        type: "object",
        properties: {
          searchTerm: { type: "string", description: "Search term (name, email, or confirmation code)" },
          status: { type: "string", description: "Optional: filter by status (confirmed, checked-in, checked-out, cancelled)" },
          limit: { type: "number", description: "Optional: maximum number of results (default 10)" }
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
      description: "Check room availability for specific dates",
      parameters: {
        type: "object",
        properties: {
          check_in: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          check_out: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
          room_code: { type: "string", description: "Optional: specific room code to check" }
        },
        required: ["check_in", "check_out"]
      }
    }
  },
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
- For analytics tools (occupancy/revenue stats), if the user doesn't specify dates, call without parameters to get current month data
- When users ask for "occupancy" or "revenue" without dates, assume they want current month stats
- Display HTML tables returned by tools directly
- Currency is GHS (Ghanaian Cedi)
- Be concise and helpful`
  };

  const allMessages = [systemMessage, ...messages];

  // Call OpenAI with function calling
  let response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: allMessages,
    tools: tools,
    tool_choice: "auto",
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
    });

    message = response.choices[0].message;
    responseMessages.push(message);
  }

  console.log('✅ Bernard completed');
  return message.content || "Done.";
}