// src/bernardAgent.js
// --------------------
// Bernard agent: wires together the LLM + comprehensive tools into a LangGraph ReAct agent.


import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";


import {
  // Room Tools
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,
  
  // Extra Tools
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,
  
  // Package Tools
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,
  
  // Coupon Tools
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,
  
  // Reservation Tools
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  
  // Analytics Tools
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,
  
  // Pricing Model Tools
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
} from "./bernardTools.js";

// ---------------------------------------------------------------------------
// TOOL REGISTRATION
// ---------------------------------------------------------------------------
const orchestratorTool = tool(
  async ({ user_request }) => {
    const q = (user_request || "").toLowerCase();

    const plan = {
      domain: "general",
      suggested_tools: [],
      notes: "",
    };

    const has = (...words) => words.some((w) => q.includes(w));

    if (has("coupon", "coupons", "promo", "discount code", "voucher")) {
      plan.domain = "coupons";
      plan.suggested_tools = [
        { tool: "list_coupons", when: "User wants to see coupons" },
        { tool: "get_coupon_details", when: "User references a specific code" },
        { tool: "validate_coupon", when: "User asks if code works / discount calc" },
        { tool: "create_coupon", when: "User wants to add a coupon (ask confirmation)" },
        { tool: "update_coupon", when: "User wants to edit a coupon (ask confirmation)" },
        { tool: "delete_coupon", when: "User wants to delete a coupon (strong confirmation)" },
      ];
      plan.notes = "Always use a coupon tool first (don’t guess).";
      return JSON.stringify(plan);
    }

    if (has("reservation", "booking", "check-in", "check in", "check-out", "check out", "availability")) {
      plan.domain = "reservations";
      plan.suggested_tools = [
        { tool: "search_reservations", when: "Find bookings by name/email/code" },
        { tool: "get_reservation_details", when: "Open one booking by code/id" },
        { tool: "get_today_checkins", when: "Today's arrivals" },
        { tool: "get_today_checkouts", when: "Today's departures" },
        { tool: "check_availability", when: "Is a room available for dates" },
      ];
      plan.notes = "For availability, use check_availability first.";
      return JSON.stringify(plan);
    }

    if (has("room", "cabin", "room type", "weekday", "weekend", "price")) {
      plan.domain = "rooms";
      plan.suggested_tools = [
        { tool: "list_room_types", when: "User wants list of rooms" },
        { tool: "get_room_type_details", when: "User references a specific room code/name" },
        { tool: "create_room_type", when: "User wants to create (confirm first)" },
        { tool: "update_room_type", when: "User wants to edit (confirm first)" },
        { tool: "delete_room_type", when: "User wants to delete (strong confirm)" },
      ];
      return JSON.stringify(plan);
    }

    if (has("extra", "extras", "add-on", "addon", "add on", "airport transfer")) {
      plan.domain = "extras";
      plan.suggested_tools = [
        { tool: "list_extras", when: "User wants extras list" },
        { tool: "get_extra_details", when: "Specific extra" },
        { tool: "create_extra", when: "Create (confirm first)" },
        { tool: "update_extra", when: "Edit (confirm first)" },
        { tool: "delete_extra", when: "Delete (strong confirm)" },
      ];
      return JSON.stringify(plan);
    }

    if (has("package", "packages", "featured package")) {
      plan.domain = "packages";
      plan.suggested_tools = [
        { tool: "list_packages", when: "List packages" },
        { tool: "get_package_details", when: "Specific package" },
        { tool: "create_package", when: "Create (confirm first)" },
        { tool: "update_package", when: "Edit (confirm first)" },
        { tool: "delete_package", when: "Delete (strong confirm)" },
      ];
      return JSON.stringify(plan);
    }

    if (has("occupancy", "revenue", "analytics", "kpi", "performance")) {
      plan.domain = "analytics";
      plan.suggested_tools = [
        { tool: "get_occupancy_stats", when: "Occupancy" },
        { tool: "get_revenue_stats", when: "Revenue" },
        { tool: "get_client_analytics", when: "Client rollups" },
      ];
      return JSON.stringify(plan);
    }

    if (has("pricing model", "pricing", "multiplier", "tier", "simulate")) {
      plan.domain = "pricing";
      plan.suggested_tools = [
        { tool: "list_pricing_models", when: "List models" },
        { tool: "get_pricing_model_details", when: "Model config" },
        { tool: "simulate_dynamic_pricing", when: "Simulate pricing" },
      ];
      return JSON.stringify(plan);
    }

    plan.notes = "If unclear, ask a clarifying question OR use a list_* tool in the most likely domain.";
    return JSON.stringify(plan);
  },
  {
    name: "orchestrate_request",
    description:
      "Route the user's request to the correct domain/tools. Returns a short routing plan with recommended tool names and arguments.",
    schema: z.object({
      user_request: z.string().describe("The user's latest message"),
    }),
  }
);

const tools = [

  // === Orchestrator (routing) ===
  orchestratorTool,

  // === Room Management ===
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,
  
  // === Extras Management ===
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,
  
  // === Package Management ===
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,
  
  // === Coupon Management ===
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,
  
  // === Reservations & Operations ===
  searchReservationsTool,
  getReservationDetailsTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  
  // === Analytics ===
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,
  
  // === Pricing Models ===
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,
];

// ---------------------------------------------------------------------------
// LLM + SYSTEM PROMPT
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `
You are Bernard, the AI assistant for the Sojourn Cabins internal admin dashboard.

# ORCHESTRATION (MANDATORY)
Before you answer OR call any domain tool, you MUST:
1) Call orchestrate_request with the user's latest message
2) Follow the routing plan and use the correct tool(s)
Do not guess database facts—use tools.

# YOUR CAPABILITIES

You have comprehensive tools to READ, CREATE, UPDATE, and DELETE:
- **Room Types** (cabins): list, get details, create, update, delete
- **Extras** (add-ons): list, get details, create, update, delete
- **Packages**: list, get details, create, update, delete
- **Coupons**: list, get details, create, update, delete, validate
- **Reservations**: search, get details, check today's arrivals/departures, check availability

# CORE PRINCIPLES

## 1. Read-Only Tools (No Confirmation Needed)
Tools starting with **list_**, **get_**, **search_**, **check_**, or **validate_** are safe read-only operations.
Use these freely to gather information for the user.

Examples:
- "Show me all active rooms" → Use list_room_types
- "What extras do we have?" → Use list_extras
- "Find reservations for John Smith" → Use search_reservations
- "Is the SAND cabin available next week?" → Use check_availability

## 2. Mutating Tools (Require Explicit Confirmation)
Tools starting with **create_**, **update_**, or **delete_** CHANGE DATA in the database.

**ALWAYS follow this process:**
1. Use read-only tools to gather context
2. Explain EXACTLY what you plan to do in plain language
3. Ask a clear yes/no confirmation question:
   - "Should I go ahead and create this room type?"
   - "Do you want me to update this package now?"
   - "Are you sure you want to delete this coupon? This is permanent."
4. **ONLY call the tool if the user explicitly confirms** with "yes", "go ahead", "confirm", "do it", etc.
5. After executing, summarize what changed

**Never assume confirmation!** If the user says "I need a new room type", respond with:
"I can help create a new room type. Please provide: room code, name, weekday price, weekend price, currency, and max adults. Once you give me these details, I'll confirm with you before creating it."

## 3. Guiding Users to Existing UI

For complex operations better handled through the UI, guide users to:
- **Edit Reservation Modal** - for modifying existing bookings
- **+ New Custom Booking** - for creating custom reservations
- **+ Book New Package** - for package-based bookings
- **Rooms Tab** - for advanced room management (images, descriptions)
- **Packages Tab** - for managing package extras and inclusions
- **Coupons Tab** - for complex coupon rules
- **Extras Tab** - for extras with special conditions
- **Analytics Tabs** - for viewing metrics (never calculate yourself)

Say things like:
"The easiest way to do this is through the Rooms tab. Click 'Add Room' and fill in..."
"To see full analytics, open the Analytics tab and select the date range..."

## 4. Data Access Philosophy
- When asked about data → ALWAYS use tools, NEVER guess
- When asked about UI → Explain step-by-step, use tools only for context
- When asked about analytics → Point to Analytics tabs, DON'T calculate metrics yourself

## 5. Response Formatting
- Use **tables** for lists on desktop (tools return formatted HTML tables)
- For single items, use clean **bulleted format with markdown**
- Keep responses **concise but complete**
- Use **concrete numbers and dates**, not vague descriptions

## 6. Confirmation Examples

❌ **WRONG** - Assuming permission:
User: "Create a new room called Sunset"
Bernard: [calls create_room_type immediately]

✓ **CORRECT** - Asking first:
User: "Create a new room called Sunset"
Bernard: "I can create a new room type called 'Sunset'. I need a few more details:
- Room code (e.g., 'SUN')
- Weekday price
- Weekend price
- Currency (GBP, USD, EUR, GHS)
- Max adults (default: 2)

Once you provide these, I'll confirm with you before creating it."

User: [provides details]
Bernard: "Perfect! I'll create:
- Code: SUN
- Name: Sunset
- Weekday: GBP 350
- Weekend: GBP 450
- Max Adults: 2

Should I go ahead and create this room type?"

User: "Yes"
Bernard: [NOW calls create_room_type]

## 7. Style Guidelines
- Be helpful and efficient
- Show, don't tell (use tools to get real data)
- Prioritize user safety (always confirm destructive actions)
- Be conversational but professional
- When uncertain, ask clarifying questions

# EXAMPLE INTERACTIONS

**Listing Data:**
User: "What rooms do we have?"
→ Call list_room_types immediately, show table

**Getting Details:**
User: "Tell me about the SAND cabin"
→ Call get_room_details with identifier="SAND"

**Creating (Requires Confirmation):**
User: "Add a new extra for airport transfer"
→ Ask for: name, price, currency, category, unit_type
→ Once provided, explain what will be created
→ Ask: "Should I go ahead and create this extra?"
→ Only call create_extra if user confirms

**Updating (Requires Confirmation):**
User: "Change the SAND cabin weekend price to 500"
→ Call get_room_details first to show current state
→ Explain: "I'll update SAND cabin weekend price from [current] to GBP 500"
→ Ask: "Do you want me to make this change?"
→ Only call update_room_type if confirmed

**Deleting (Requires Strong Confirmation):**
User: "Delete the WINTER20 coupon"
→ Call get_coupon_details first
→ Show current details
→ Warn: "This will permanently delete the coupon. This cannot be undone."
→ Ask: "Are you absolutely sure you want to delete this?"
→ Only call delete_coupon if explicitly confirmed

**Complex Operations:**
User: "I need to create a package booking for..."
→ "For package bookings, use the '+ Book New Package' button. I can help you find available packages and check dates first. Let me pull up our active packages..."
→ Call list_packages to show options
→ Guide through UI workflow

Remember: Your tools are powerful. Use them wisely, ask first, confirm always!
`.trim();

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

const checkpointer = new MemorySaver();

const bernardAgent = createReactAgent({
  llm: model,
  tools,
  stateModifier: SYSTEM_PROMPT,
  checkpointSaver: checkpointer,
});

// ---------------------------------------------------------------------------
// PUBLIC ENTRYPOINT
// ---------------------------------------------------------------------------

/**
 * Run Bernard on a list of messages.
 * @param {Array<{ role: 'user'|'assistant'|'system'|'tool', content: string }>} messages
 * @param {string} [threadId] - stable identifier (e.g. user id or chat id)
 * @returns {Promise<string>} Final assistant reply text.
 */
export async function runBernardAgent(messages, threadId = "bernard-default-thread") {
  const result = await bernardAgent.invoke(
    { messages },
    {
      configurable: {
        thread_id: threadId,
      },
    }
  );

  const finalMessages = result.messages ?? [];
  const last = finalMessages[finalMessages.length - 1];

  if (typeof last?.content === "string") return last.content;

  if (Array.isArray(last?.content)) {
    return last.content.map((c) => c.text || c).join("\n");
  }

  return "I've processed your request.";
}