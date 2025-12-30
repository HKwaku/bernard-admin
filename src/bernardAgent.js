// src/bernardAgent.js
// Bernard agent with robust tool loading

import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { z } from "zod";

// Import the supabase client and helper functions from bernardTools
import { supabase, formatTable } from "./bernardTools.js";

// ---------------------------------------------------------------------------
// DEFINE ALL TOOLS INLINE (avoid import issues)
// ---------------------------------------------------------------------------

// ROOM TOOLS
const listRoomsTool = tool({
  name: "list_room_types",
  description: "List all room types with details including pricing, capacity, and status.",
  schema: z.object({}),
  async func() {
    const { data, error } = await supabase
      .from("room_types")
      .select("*")
      .order("code", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No room types found.";

    return formatTable(
      data.map(r => ({
        Code: r.code,
        Name: r.name,
        "Max Adults": r.max_adults || 2,
        "Weekday Price": `${r.currency || 'GHS'} ${r.base_price_per_night_weekday}`,
        "Weekend Price": `${r.currency || 'GHS'} ${r.base_price_per_night_weekend}`,
        Active: r.is_active ? "✓" : "✗",
      })),
      { minWidth: "600px" }
    );
  },
});

const getRoomDetailsTool = tool({
  name: "get_room_details",
  description: "Get detailed information about a specific room type by code.",
  schema: z.object({
    code: z.string().describe("Room code (e.g., 'SAND', 'SEA', 'SUN')"),
  }),
  async func({ code }) {
    const { data, error } = await supabase
      .from("room_types")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (error) return `Error: ${error.message}`;
    if (!data) return `Room type '${code}' not found.`;

    return `**${data.name}** (${data.code})
- Status: ${data.is_active ? 'Active ✓' : 'Inactive ✗'}
- Capacity: Up to ${data.max_adults || 2} adults
- Weekday Price: ${data.currency} ${data.base_price_per_night_weekday}
- Weekend Price: ${data.currency} ${data.base_price_per_night_weekend}
- Description: ${data.description || 'N/A'}`;
  },
});

// EXTRAS TOOLS
const listExtrasTool = tool({
  name: "list_extras",
  description: "List all extras/add-ons with pricing and details.",
  schema: z.object({}),
  async func() {
    const { data, error } = await supabase
      .from("extras")
      .select("*")
      .order("category, name");

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No extras found.";

    return formatTable(
      data.map(e => ({
        Name: e.name,
        Category: e.category,
        Price: `${e.currency} ${e.price_per_unit}`,
        Unit: e.unit_type,
        Active: e.is_active ? "✓" : "✗",
      }))
    );
  },
});

// PACKAGES TOOLS
const listPackagesTool = tool({
  name: "list_packages",
  description: "List all packages with pricing and details.",
  schema: z.object({}),
  async func() {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .order("code");

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No packages found.";

    return formatTable(
      data.map(p => ({
        Code: p.code,
        Name: p.name,
        Price: `${p.currency} ${p.price}`,
        "Min Nights": p.min_nights,
        Active: p.is_active ? "✓" : "✗",
      }))
    );
  },
});

// COUPON TOOLS
const listCouponsTool = tool({
  name: "list_coupons",
  description: "List all coupons with discount details.",
  schema: z.object({}),
  async func() {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("code");

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No coupons found.";

    return formatTable(
      data.map(c => ({
        Code: c.code,
        Type: c.discount_type,
        Value: c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.currency} ${c.discount_value}`,
        "Valid Until": c.valid_until || 'No expiry',
        Active: c.is_active ? "✓" : "✗",
      }))
    );
  },
});

// RESERVATION TOOLS
const searchReservationsTool = tool({
  name: "search_reservations",
  description: "Search for reservations by guest name, email, or confirmation code.",
  schema: z.object({
    search: z.string().describe("Search term (name, email, or confirmation code)"),
  }),
  async func({ search }) {
    let query = supabase.from("reservations").select("*");
    
    if (search) {
      query = query.or(`guest_first_name.ilike.%${search}%,guest_last_name.ilike.%${search}%,guest_email.ilike.%${search}%,confirmation_code.ilike.%${search}%`);
    }
    
    const { data, error } = await query
      .order("check_in", { ascending: false })
      .limit(20);

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return `No reservations found${search ? ` for "${search}"` : ""}.`;

    return formatTable(
      data.map(r => ({
        Code: r.confirmation_code,
        Guest: `${r.guest_first_name} ${r.guest_last_name}`,
        Room: r.room_name,
        "Check In": r.check_in,
        "Check Out": r.check_out,
        Status: r.status,
        Total: `${r.currency} ${r.total}`,
      }))
    );
  },
});

const getTodayCheckInsTool = tool({
  name: "get_today_checkins",
  description: "Get all reservations checking in today.",
  schema: z.object({}),
  async func() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("check_in", today)
      .order("guest_last_name");

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No check-ins scheduled for today.";

    return formatTable(
      data.map(r => ({
        Guest: `${r.guest_first_name} ${r.guest_last_name}`,
        Room: r.room_name,
        Nights: r.nights,
        Adults: r.adults,
        Status: r.status,
      }))
    );
  },
});

const getTodayCheckOutsTool = tool({
  name: "get_today_checkouts",
  description: "Get all reservations checking out today.",
  schema: z.object({}),
  async func() {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("check_out", today)
      .order("guest_last_name");

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No check-outs scheduled for today.";

    return formatTable(
      data.map(r => ({
        Guest: `${r.guest_first_name} ${r.guest_last_name}`,
        Room: r.room_name,
        Status: r.status,
      }))
    );
  },
});

const checkAvailabilityTool = tool({
  name: "check_availability",
  description: "Check room availability for specific dates.",
  schema: z.object({
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
    room_code: z.string().optional().describe("Optional: specific room code to check"),
  }),
  async func({ check_in, check_out, room_code }) {
    const { data, error } = await supabase.rpc('check_availability', {
      p_check_in: check_in,
      p_check_out: check_out,
      p_room_type_code: room_code || null,
    });

    if (error) return `Error: ${error.message}`;
    
    if (data && data.length > 0) {
      return formatTable(
        data.map(r => ({
          Room: r.room_name,
          Code: r.room_code,
          Available: r.is_available ? "✓ Yes" : "✗ No",
        }))
      );
    }
    
    return "No availability information found.";
  },
});

// ANALYTICS TOOLS
const getOccupancyStatsTool = tool({
  name: "get_occupancy_stats",
  description: "Get occupancy statistics for a date range.",
  schema: z.object({
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
  }),
  async func({ start_date, end_date }) {
    const { data, error } = await supabase.rpc('get_occupancy_stats', {
      p_start_date: start_date,
      p_end_date: end_date,
    });

    if (error) return `Error: ${error.message}`;
    if (!data) return "No data available for this period.";

    return `**Occupancy Statistics** (${start_date} to ${end_date})
- Total Bookings: ${data.total_bookings || 0}
- Occupancy Rate: ${data.occupancy_rate || 0}%
- Total Nights: ${data.total_nights || 0}`;
  },
});

const getRevenueStatsTool = tool({
  name: "get_revenue_stats",
  description: "Get revenue statistics for a date range.",
  schema: z.object({
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
  }),
  async func({ start_date, end_date }) {
    const { data, error } = await supabase.rpc('get_revenue_stats', {
      p_start_date: start_date,
      p_end_date: end_date,
    });

    if (error) return `Error: ${error.message}`;
    if (!data) return "No data available for this period.";

    return `**Revenue Statistics** (${start_date} to ${end_date})
- Total Revenue: GHS ${data.total_revenue || 0}
- Room Revenue: GHS ${data.room_revenue || 0}
- Extras Revenue: GHS ${data.extras_revenue || 0}
- Average Booking Value: GHS ${data.avg_booking_value || 0}`;
  },
});

// ---------------------------------------------------------------------------
// TOOL REGISTRATION
// ---------------------------------------------------------------------------

const tools = [
  // Room Management
  listRoomsTool,
  getRoomDetailsTool,
  
  // Extras Management
  listExtrasTool,
  
  // Package Management
  listPackagesTool,
  
  // Coupon Management
  listCouponsTool,
  
  // Reservation Management
  searchReservationsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  
  // Analytics
  getOccupancyStatsTool,
  getRevenueStatsTool,
];

const TOOL_BY_NAME = new Map(tools.map((t) => [t.name, t]));

console.log(`✅ Bernard loaded ${tools.length} tools successfully`);

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Bernard, the AI assistant for the Sojourn Cabins admin dashboard.

You help manage:
- Room types, packages, extras, and coupons
- Reservations and bookings
- Check-ins and check-outs
- Occupancy and revenue analytics

Use the available tools to fetch accurate data from the database. Be concise and helpful.

When showing data, the tools return formatted HTML tables - display them directly.`;

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY,
});

const modelWithTools = model.bindTools(tools);

// ---------------------------------------------------------------------------
// PUBLIC ENTRYPOINT
// ---------------------------------------------------------------------------

function toLcMessage(m) {
  if (!m || typeof m !== "object") return null;
  const role = m.role;
  const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");

  if (role === "system") return new SystemMessage(content);
  if (role === "assistant") return new AIMessage(content);
  if (role === "tool") {
    return new ToolMessage({ content, tool_call_id: m.tool_call_id || "unknown" });
  }
  return new HumanMessage(content);
}

export async function runBernardAgent(messages, threadId = "bernard-default-thread") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing in server env vars.");
  }

  const lcMessages = [new SystemMessage(SYSTEM_PROMPT)];
  for (const m of messages || []) {
    const lm = toLcMessage(m);
    if (lm) lcMessages.push(lm);
  }

  // Tool-calling loop
  for (let step = 0; step < 8; step++) {
    const ai = await modelWithTools.invoke(lcMessages, {
      configurable: { thread_id: threadId },
    });

    lcMessages.push(ai);

    const toolCalls = ai.tool_calls || [];
    if (!toolCalls.length) {
      return typeof ai.content === "string" ? ai.content : JSON.stringify(ai.content ?? "");
    }

    for (const call of toolCalls) {
      const toolName = call.name;
      const toolObj = TOOL_BY_NAME.get(toolName);

      if (!toolObj) {
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Error: tool '${toolName}' is not registered.`,
          })
        );
        continue;
      }

      try {
        const result = await toolObj.invoke(call.args ?? {});
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          })
        );
      } catch (e) {
        lcMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: `Error running tool '${toolName}': ${e?.message || String(e)}`,
          })
        );
      }
    }
  }

  return "I started working on that, but hit the tool-call limit. Can you rephrase or narrow the request?";
}