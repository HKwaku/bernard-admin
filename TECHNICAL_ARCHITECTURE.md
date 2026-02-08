# Bernard AI — Multi-Agent System Technical Architecture

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack](#3-technology-stack)
4. [The Orchestrator (Router)](#4-the-orchestrator-router)
5. [Specialist Agents](#5-specialist-agents)
6. [Tool System](#6-tool-system)
7. [Request Lifecycle](#7-request-lifecycle)
8. [Technical Decisions & Rationale](#8-technical-decisions--rationale)
9. [Data Layer](#9-data-layer)
10. [Frontend Integration](#10-frontend-integration)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Appendix: Full Tool Inventory](#appendix-full-tool-inventory)

---

## 1. System Overview

Bernard is a **router-based multi-agent AI assistant** built for the Sojourn Cabins hospitality admin dashboard. It uses a central orchestrator to classify user intent and delegate to one of **8 specialist agents**, each equipped with domain-specific tools that execute operations against a **Supabase (PostgreSQL)** backend.

**Key characteristics:**

- **Router + specialists pattern** — not a single monolithic prompt
- **OpenAI function calling** — used for both routing decisions and tool execution
- **Stateless agents** — no persistent memory; full conversation history is passed per request
- **47 tools** across 10 functional domains
- **Serverless deployment** on Vercel with a single `/api/chat` endpoint

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (SPA)                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Chat UI  (src/chat.js)                                      │   │
│  │  ├── bernardHistory[] — full conversation state              │   │
│  │  ├── POST /api/chat  { messages }                            │   │
│  │  ├── markdownToHtml() — renders agent responses              │   │
│  │  └── wrapChatTables() — scrollable table containers          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP POST
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS FUNCTION  (api/chat.js)                          │
│  └── runBernardAgent(messages)                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ORCHESTRATOR / ROUTER  (src/bernardAgent.js)                       │
│                                                                     │
│  Model: gpt-4o-mini  |  Temp: 0.1  |  Max tokens: 200              │
│  Tool: route_to_agent({ agent, reasoning })                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Routing Logic                                               │   │
│  │  1. Take last 20 messages (context window management)        │   │
│  │  2. Classify intent via function call                        │   │
│  │  3. If no tool call → handle directly (greetings)            │   │
│  │  4. If tool call → delegate to specialist agent              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│         ┌────────┬───────┬───┴───┬────────┬───────┬────────┬──────┐│
│         ▼        ▼       ▼       ▼        ▼       ▼        ▼      ▼│
│    ┌─────── ┌─────── ┌─────── ┌─────── ┌────── ┌─────── ┌──────┐ ││
│    │Invent- │Reserv- │Edit    │Analyt- │Pric-  │Chef   │Extra  │ ││
│    │ory     │ations  │Reserv. │ics     │ing    │Menu   │Select.│ ││
│    │Agent   │Agent   │Agent   │Agent   │Agent  │Agent  │Agent  │ ││
│    └───┬─── └───┬─── └───┬─── └───┬─── └──┬─── └──┬─── └──┬───┘ ││
│        │        │        │        │       │       │       │       ││
│    ┌───┴───┐┌───┴───┐┌───┴───┐┌───┴──┐┌──┴──┐┌──┴──┐┌───┴──┐   ││
│    │24     ││17     ││9      ││4     ││4    ││6    ││5     │   ││
│    │tools  ││tools  ││tools  ││tools ││tools││tools││tools │   ││
│    └───┬───┘└───┬───┘└───┬───┘└───┬──┘└──┬──┘└──┬──┘└───┬──┘   ││
│        └────────┴────────┴────────┴──────┴──────┴───────┘       ││
│                              │                      Blocked Dates ││
│                              │                      Agent (4 tools)│
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  SUPABASE           │
                    │  (PostgreSQL)       │
                    │                     │
                    │  Tables:            │
                    │  - room_types       │
                    │  - reservations     │
                    │  - extras           │
                    │  - packages         │
                    │  - coupons          │
                    │  - blocked_dates    │
                    │  - chef_menu_items  │
                    │  - pricing_models   │
                    │  - seasonal_pricing │
                    │  - extra_selections │
                    │  - ...              │
                    └─────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **LLM** | OpenAI GPT-4o-mini | via `openai` ^4.20.0 | All routing and agent inference |
| **LLM SDK** | OpenAI Node SDK | ^4.20.0 | Direct API calls with function calling |
| **Database** | Supabase (PostgreSQL) | `@supabase/supabase-js` ^2.78.0 | All data persistence and queries |
| **Bundler** | Vite | ^7.1.12 | Build tool, dev server, HMR |
| **Runtime** | Vercel Serverless Functions | Node.js | API endpoint hosting |
| **Frontend** | Vanilla JavaScript (ES Modules) | — | SPA with tab-based navigation |
| **Spreadsheets** | SheetJS | `xlsx` ^0.18.5 | Excel export functionality |

### Installed but unused

| Package | Version | Notes |
|---|---|---|
| `@langchain/core` | ^1.0.5 | Installed during early prototyping; **not imported anywhere** |
| `@langchain/langgraph` | ^1.0.2 | Installed during early prototyping; **not imported anywhere** |
| `@langchain/openai` | ^1.1.1 | Installed during early prototyping; **not imported anywhere** |

> **Note:** The codebase explicitly states in `bernardTools.js`: *"Do NOT import LangChain/LangGraph here."* The system was migrated from a LangChain-based prototype to direct OpenAI SDK calls for simplicity and control. The LangChain packages remain in `package.json` as legacy dependencies.

---

## 4. The Orchestrator (Router)

**File:** `src/bernardAgent.js`

The orchestrator is the entry point for all user messages. It acts as an **intent classifier** — it does not answer questions itself (except greetings). Its sole purpose is to determine which specialist agent should handle the request.

### Configuration

| Parameter | Value | Rationale |
|---|---|---|
| Model | `gpt-4o-mini` | Fast, cheap, sufficient for classification |
| Temperature | `0.1` | Near-deterministic routing decisions |
| Max tokens | `200` | Only needs to output a tool call, not prose |
| Context window | Last 20 messages | Prevents context overflow on long conversations |
| Tool choice | `auto` | Allows router to handle greetings without routing |

### Routing Mechanism

The router uses a **single OpenAI function call** — `route_to_agent` — to make routing decisions:

```javascript
// Router tool schema
{
  name: "route_to_agent",
  parameters: {
    agent: {
      type: "string",
      enum: ["inventory", "reservations", "edit_reservations", "analytics",
             "pricing", "chef_menu", "extra_selections", "blocked_dates"]
    },
    reasoning: { type: "string" }  // Brief explanation for logging
  }
}
```

### Routing Flow

```
User message → Router (gpt-4o-mini)
  ├── tool_call: route_to_agent({ agent: "reservations", reasoning: "..." })
  │   └── Delegate to Reservations Agent with last 40 messages
  │
  └── no tool_call (greeting/ambiguous)
      └── Return router's direct response
```

### Agent Registry

The router maintains a flat registry mapping agent names to their runner functions:

```javascript
const AGENTS = {
  inventory:        { run: runInventoryAgent,        label: "Inventory Agent" },
  reservations:     { run: runReservationsAgent,      label: "Reservations Agent" },
  edit_reservations:{ run: runEditReservationsAgent,  label: "Edit Reservations Agent" },
  analytics:        { run: runAnalyticsAgent,         label: "Analytics Agent" },
  pricing:          { run: runPricingAgent,           label: "Pricing Agent" },
  chef_menu:        { run: runChefMenuAgent,          label: "Chef Menu Agent" },
  extra_selections: { run: runExtraSelectionsAgent,   label: "Extra Selections Agent" },
  blocked_dates:    { run: runBlockedDatesAgent,      label: "Blocked Dates Agent" },
};
```

### Multi-Turn Awareness

The router's system prompt explicitly instructs it to maintain conversational continuity:

> *"If the previous assistant message was from a specialist agent asking a follow-up question (like asking for a name, email, dates, etc.), route to the SAME agent."*

This ensures that a multi-step booking flow (e.g., the Reservations Agent asking for guest name, then dates, then extras) continues routing to the same agent even when the user's replies are ambiguous ("John Smith", "yes", "no extras").

### Critical Disambiguation

A key challenge in routing is distinguishing between similar-sounding operations:

| User says | Routes to | Why |
|---|---|---|
| "edit COCO cabin" | `inventory` | Editing a **room type** definition |
| "edit reservation ABC123" | `edit_reservations` | Modifying an existing **booking** |
| "change weekend price" | `inventory` | Room type pricing is inventory |
| "change check-in date" | `edit_reservations` | Reservation date is booking data |

---

## 5. Specialist Agents

All 8 specialist agents follow the **same architectural pattern**:

### Common Agent Pattern

```javascript
export async function runAgentName(messages) {
  // 1. Prepend system prompt
  const allMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

  // 2. Initial LLM call with tools
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

  // 3. Iterative tool execution loop (max N rounds)
  for (let i = 0; i < MAX_ROUNDS && message.tool_calls; i++) {
    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments);
      const result = await executeTool(tc.function.name, args);
      responseMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }

    // 4. Feed tool results back for next decision
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

  // 5. Return final text response
  return message.content || "Done.";
}
```

### Agent Specifications

#### 5.1 Inventory Agent

| Property | Value |
|---|---|
| **File** | `src/agents/inventoryAgent.js` |
| **Domain** | Room types, extras, packages, coupons |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 24 (CRUD for 4 entity types + coupon validation) |

**Key behaviors:**
- **Never guesses** — always calls a lookup tool before referencing any inventory item
- Handles all CRUD operations for rooms, extras, packages, and coupons
- Formats data using HTML tables via `formatTable()`
- Requires explicit confirmation before destructive operations (delete)

**Tool breakdown:**
- Room Types: `list_room_types`, `get_room_type_details`, `create_room_type`, `update_room_type`, `delete_room_type`
- Extras: `list_extras`, `get_extra_details`, `create_extra`, `update_extra`, `delete_extra`
- Packages: `list_packages`, `get_package_details`, `create_package`, `update_package`, `delete_package`
- Coupons: `list_coupons`, `get_coupon_details`, `create_coupon`, `update_coupon`, `delete_coupon`, `validate_coupon`

---

#### 5.2 Reservations Agent

| Property | Value |
|---|---|
| **File** | `src/agents/reservationsAgent.js` |
| **Domain** | New bookings, availability, check-ins/outs, guest lookups |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 17 |

**Key behaviors:**
- **Conversational booking flow** — guides users step-by-step through room selection, dates, guest info, and extras
- Always checks availability before creating a booking
- Supports **single**, **group** (multiple rooms, GRP-XXXXXX codes), and **package** bookings
- Can send confirmation emails after booking
- Cross-references room types, extras, and packages from inventory

**Tool breakdown:**
- Search: `search_reservations`, `get_reservation_details`
- Availability: `check_availability`, `check_all_availability`
- Create: `create_reservation`, `create_group_reservation`, `create_package_reservation`
- Manage: `update_reservation_status`, `update_reservation_details`, `cancel_reservation`, `delete_reservation`
- Daily ops: `get_today_checkins`, `get_today_checkouts`
- Cross-domain: `list_extras`, `list_room_types`, `list_packages`, `get_package_details`, `send_booking_email`

---

#### 5.3 Edit Reservations Agent

| Property | Value |
|---|---|
| **File** | `src/agents/editReservationsAgent.js` |
| **Domain** | Modifying existing reservations |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 9 |

**Key behaviors:**
- Follows a strict **editing workflow**: Identify → Show Current → Understand Changes → Validate → Confirm → Apply
- Always fetches current reservation details before making changes
- Validates availability before room or date changes
- Extras are **replaced entirely** (must pass full list, not a diff)
- Phone number and country code are separate fields

**Tool breakdown:**
- Lookup: `get_reservation_details`, `search_reservations`
- Edit: `edit_reservation` (single tool handles all field types)
- Validate: `check_availability`, `check_all_availability`, `validate_coupon`
- Support: `list_extras`, `list_room_types`, `send_booking_email`

---

#### 5.4 Analytics Agent

| Property | Value |
|---|---|
| **File** | `src/agents/analyticsAgent.js` |
| **Domain** | Occupancy, revenue, client analytics, period comparisons |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 5 |
| **Tools** | 4 |

**Key behaviors:**
- Defaults to **current month** if no dates specified
- Uses **overlap detection** for accurate occupancy counting (reservations whose stay period touches the date range)
- Returns HTML tables directly — instructed not to reformat or summarize tool output
- Understands hospitality KPIs: ADR, RevPAR, TRevPAR, ALOS

**Calculation methodology:**
- **Occupied Nights** = clipped to period boundaries using overlap detection
- **Available Nights** = (days in period × number of rooms) − blocked nights
- **Occupancy Rate** = occupied nights ÷ available nights × 100
- **ADR** = room revenue ÷ occupied nights
- **RevPAR** = room revenue ÷ available nights
- **TRevPAR** = total revenue ÷ available nights
- **ALOS** = total occupied nights ÷ number of bookings

**Tools:** `get_occupancy_stats`, `get_revenue_stats`, `get_client_analytics`, `compare_periods`

---

#### 5.5 Pricing Agent

| Property | Value |
|---|---|
| **File** | `src/agents/pricingAgent.js` |
| **Domain** | Dynamic pricing models, simulations, seasonal pricing |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 5 |
| **Tools** | 4 |

**Key behaviors:**
- Can simulate dynamic pricing for specific room + date combinations
- Explains tier logic and pricing calculations
- Manages seasonal pricing rules and overrides

**Tools:** `list_pricing_models`, `get_pricing_model_details`, `simulate_pricing`, `get_seasonal_pricing`

---

#### 5.6 Chef Menu Agent

| Property | Value |
|---|---|
| **File** | `src/agents/chefMenuAgent.js` |
| **Domain** | Chef menu items for the Private Chef experience |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 6 |

**Key behaviors:**
- Manages dishes across 5 categories: starters, local mains, continental mains, local sides, continental sides
- Can toggle item availability without deleting

**Tools:** `list_chef_menu_items`, `get_chef_menu_item_details`, `create_chef_menu_item`, `update_chef_menu_item`, `delete_chef_menu_item`, `toggle_chef_menu_availability`

---

#### 5.7 Extra Selections Agent

| Property | Value |
|---|---|
| **File** | `src/agents/extraSelectionsAgent.js` |
| **Domain** | Guest extra selections on reservations |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 5 |

**Key behaviors:**
- Tracks selection lifecycle: `pending` → `completed` → `submitted`
- Some extras have a "selection not required" status (no guest input needed)
- Can view detailed meal choices, dates, and preferences

**Tools:** `list_extra_selections`, `get_extra_selection_details`, `update_extra_selection_status`, `search_reservations`, `get_reservation_details`

---

#### 5.8 Blocked Dates Agent

| Property | Value |
|---|---|
| **File** | `src/agents/blockedDatesAgent.js` |
| **Domain** | Room blocking for maintenance, holidays, renovations |
| **Model** | gpt-4o-mini |
| **Temperature** | 0.3 |
| **Max tool rounds** | 8 |
| **Tools** | 4 |

**Key behaviors:**
- Follows a guided workflow: identify rooms → date range → reason → confirm
- Can block individual rooms or all rooms simultaneously (`["ALL"]`)
- Reasons categorized as: maintenance, staff holiday, renovation, other

**Tools:** `block_dates`, `unblock_dates`, `list_blocked_dates`, `list_room_types`

---

## 6. Tool System

### Architecture

Tools are defined in a single file (`src/bernardTools.js`, ~4,740 lines) using a **minimal custom wrapper** — not a framework:

```javascript
// Tiny identity wrapper — tools are plain objects
const tool = (definition) => definition;

// Zod-like stub for schema documentation (not enforced at runtime)
const z = { string: () => chain, number: () => chain, boolean: () => chain, ... };

// Tool definition pattern
export const listRoomsTool = tool({
  name: "list_room_types",
  description: "List all room types with details...",
  schema: z.object({
    include_inactive: z.boolean().optional().describe("Include inactive rooms")
  }),
  async func(input) {
    const { data, error } = await supabase
      .from("room_types")
      .select("*")
      .order("name");

    if (error) return `Error: ${error.message}`;
    return formatTable(data.map(r => ({ ... })));
  }
});
```

### Design Decisions

| Decision | Rationale |
|---|---|
| **Custom `tool()` wrapper** instead of LangChain | Simpler, no framework overhead, full control over tool execution |
| **Zod stubs** instead of real validation | Schemas serve as documentation for the LLM; runtime validation is done inside each tool |
| **Single file** for all tools | Centralized, easy to maintain, shared helpers (`formatTable`, `formatDate`, Supabase client) |
| **String return values** | Tools return formatted strings (text or HTML tables) that the LLM can pass directly to the user |

### Tool-to-Agent Mapping

Each agent imports only the tools it needs and registers them with OpenAI's function calling format:

```javascript
// In each agent file:
const tools = [
  { type: "function", function: { name: toolObj.name, description: toolObj.description, parameters: extractSchema(toolObj) } },
  // ...
];

// Execution dispatch
function executeTool(name, args) {
  const toolMap = { list_room_types: listRoomsTool, ... };
  return toolMap[name]?.func(args) ?? `Unknown tool: ${name}`;
}
```

### Shared Helpers

| Helper | Purpose |
|---|---|
| `formatTable(rows, options)` | Converts array of objects to compact HTML `<table>` with inline styles |
| `formatDate(dateStr)` | Formats dates as `dd-Mmm-yyyy` (e.g., "15-Jan-2026") |
| `supabase` | Shared Supabase client instance (service role key, no session persistence) |

---

## 7. Request Lifecycle

A complete request flows through 5 stages:

```
Stage 1: HTTP Request
├── User types message in chat UI
├── chat.js appends to bernardHistory[]
├── POST /api/chat { messages: bernardHistory }
└── Vercel serverless function receives request

Stage 2: Router Classification
├── runBernardAgent(messages) called
├── Last 20 messages sent to gpt-4o-mini with route_to_agent tool
├── Router returns: { agent: "reservations", reasoning: "User wants to book" }
└── If no tool call → return direct greeting response

Stage 3: Agent Execution
├── Specialist agent receives last 40 messages + system prompt
├── gpt-4o-mini decides which tools to call
├── Tools execute Supabase queries, return formatted results
├── Results fed back to LLM for next decision
└── Loop repeats up to N rounds (5-8 depending on agent)

Stage 4: Response Formatting
├── Agent returns final text (markdown + HTML)
├── Serverless function returns { reply, agent }
└── HTTP response to frontend

Stage 5: UI Rendering
├── chat.js receives response
├── markdownToHtml() converts markdown to formatted HTML
├── wrapChatTables() wraps tables in scroll containers
├── Agent badge displayed if specialist handled it
└── Response appended to chat UI
```

### Context Window Management

| Component | Message limit | Rationale |
|---|---|---|
| Router | Last 20 messages | Only needs recent context for classification |
| Specialist agents | Last 40 messages | Needs more context for multi-turn operations |
| Frontend | Full history (session) | Preserves conversation for re-sending |

---

## 8. Technical Decisions & Rationale

### 8.1 Why Router + Specialists (Not a Single Agent)

**Problem:** A single agent with 47 tools and a massive system prompt would suffer from:
- Tool selection confusion (too many choices)
- Prompt dilution (instructions for all domains compete for attention)
- Higher token costs (sending 47 tool schemas on every call)

**Solution:** Split into a lightweight router (1 tool, ~200 token responses) and domain-focused agents (4-24 tools each, focused prompts).

**Trade-off:** Adds one extra LLM call per request (router → agent), but the router call is cheap (~200 max tokens with gpt-4o-mini).

---

### 8.2 Why OpenAI SDK (Not LangChain/LangGraph)

**Initial approach:** The system was prototyped with LangChain and LangGraph (packages are still in `package.json`).

**Migration rationale:**
- **Simplicity** — the tool execution loop is only ~20 lines of code; a framework adds abstraction without proportional value
- **Control** — direct access to the OpenAI API gives full control over message construction, tool schemas, and error handling
- **Debugging** — no framework middleware between the code and the API; easier to trace issues
- **Bundle size** — LangChain adds significant dependency weight for a serverless function with cold starts
- **Serverless compatibility** — fewer moving parts reduces cold start latency on Vercel

**Result:** `bernardTools.js` includes an explicit comment: *"Do NOT import LangChain/LangGraph here."*

---

### 8.3 Why gpt-4o-mini for Everything

| Consideration | Decision |
|---|---|
| **Router** | gpt-4o-mini at temp 0.1 — classification is simple, speed matters |
| **Agents** | gpt-4o-mini at temp 0.3 — tool calling works well, cost-effective at scale |
| **Not gpt-4o** | The tasks are structured (CRUD + queries); mini handles them reliably |
| **Not gpt-3.5-turbo** | Insufficient function calling reliability for multi-step tool chains |

---

### 8.4 Why a Custom Tool Wrapper (Not a Framework)

```javascript
// The entire "framework" is a single line:
const tool = (definition) => definition;
```

Tools are **plain JavaScript objects** with a `func()` method. The "schema" fields use a Zod-like stub that creates no-op chainable methods (`z.string().optional().describe("...")` returns a dummy object). This provides:

- IDE autocompletion via the schema shapes
- Documentation for the LLM (descriptions are extracted and sent as function parameters)
- Zero runtime overhead — no schema validation, no parsing layer

---

### 8.5 Why Stateless (No Persistent Memory)

**Design:** The frontend stores `bernardHistory[]` in-memory. Each API request sends the full history. There is no server-side session store.

**Rationale:**
- **Simplicity** — no Redis/database for conversation state
- **Vercel compatibility** — serverless functions are ephemeral; no persistent process state
- **Predictability** — every request contains its full context; no hidden state bugs
- **Cost control** — conversations naturally expire when the browser tab closes

**Trade-off:** Very long conversations may hit token limits. Mitigated by the context windowing (20/40 message limits per component).

---

### 8.6 Why HTML Tables (Not Markdown Tables)

Tools return HTML tables via `formatTable()` with inline styles, rather than markdown tables:

```javascript
return `<table style="border-collapse:collapse;font-size:0.85rem">
  <thead style="background:#f8fafc;"><tr>${ths}</tr></thead>
  <tbody>${trs}</tbody>
</table>`;
```

**Rationale:**
- Markdown tables require the LLM to reformat tool output (risking data loss)
- HTML tables render directly in the chat with precise styling
- Inline styles avoid CSS dependency issues in the chat bubble context
- The analytics agent system prompt explicitly says: *"Show HTML tables returned by tools directly — do NOT reformat, summarize, or rewrite them as text"*

---

### 8.7 Why Separate Edit Reservations Agent

Most systems would combine reservations and editing into one agent. Bernard splits them because:

- **Different tool sets** — creating a reservation needs availability checks + creation tools; editing needs lookup + edit + validation
- **Different workflows** — creation is a guided flow (step-by-step); editing is a retrieve-modify-validate-apply flow
- **Routing clarity** — the LLM can cleanly distinguish "create a booking" from "modify booking ABC123"
- **Prompt focus** — the edit agent's system prompt contains detailed rules about field-level updates (e.g., "extras are replaced entirely, not merged")

---

## 9. Data Layer

### Supabase Configuration

```javascript
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }  // Serverless — no session persistence
});
```

- Uses the **service role key** (full database access, bypasses RLS)
- Single shared client instance across all tools
- Environment variables with fallbacks: `process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL`

### Database Schema (Key Tables)

| Table | Used by | Purpose |
|---|---|---|
| `room_types` | Inventory, Reservations, Analytics | Room/cabin definitions |
| `reservations` | Reservations, Edit Reservations, Analytics | Booking records |
| `extras` | Inventory, Reservations | Add-on services (chef, tours, etc.) |
| `packages` | Inventory, Reservations | Bundled offerings |
| `packages_rooms` | Inventory | Package ↔ room junction table |
| `coupons` | Inventory, Edit Reservations | Discount codes |
| `blocked_dates` | Blocked Dates, Analytics | Unavailability periods |
| `chef_menu_items` | Chef Menu | Dish definitions |
| `pricing_models` | Pricing | Dynamic pricing configurations |
| `pricing_tiers` | Pricing | Occupancy-based pricing tiers |
| `seasonal_pricing` | Pricing | Date-range price overrides |
| `extra_selections` | Extra Selections | Guest choices for extras |
| `reservation_extras` | Reservations, Edit Reservations | Reservation ↔ extra junction |

---

## 10. Frontend Integration

### Chat Module (`src/chat.js`)

The chat UI communicates with the backend via a simple HTTP POST:

```javascript
async function sendMessage(text) {
  bernardHistory.push({ role: "user", content: text });

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: bernardHistory }),
  });

  const { reply, agent } = await response.json();
  bernardHistory.push({ role: "assistant", content: reply });

  // Display with markdown rendering and agent badge
  displayMessage(reply, agent);
}
```

### Response Rendering Pipeline

```
Raw agent response (markdown + HTML)
  │
  ├── markdownToHtml()
  │   ├── Protect HTML blocks (<table>, <div>) as placeholders
  │   ├── Convert markdown: **bold**, ## headers, - lists, | tables |
  │   ├── Convert \n to <br>
  │   ├── Restore HTML blocks
  │   └── Clean up <br> adjacent to block elements
  │
  └── wrapChatTables()
      └── Wrap <table> elements in scrollable <div> containers
```

---

## 11. Deployment Architecture

### Vercel Configuration (`vercel.json`)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/chat.js": { "maxDuration": 60 }
  },
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

| Component | Hosting |
|---|---|
| Frontend (SPA) | Vercel Edge CDN (static files from `dist/`) |
| API endpoint | Vercel Serverless Function (`api/chat.js`, 60s timeout) |
| Database | Supabase Cloud (managed PostgreSQL) |
| AI inference | OpenAI API (external) |

### Environment Variables

| Variable | Context | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Server-side | OpenAI API access |
| `VITE_OPENAI_API_KEY` | Build-time fallback | Vite injects for dev server |
| `SUPABASE_URL` | Server-side | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side | Full database access |
| `VITE_SUPABASE_URL` | Client-side | Client-facing Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Client-side | Client-facing Supabase key (RLS) |

### PWA Support

The application includes a `manifest.json` for Progressive Web App installation with standalone display mode and branded icons.

---

## Appendix: Full Tool Inventory

### 47 Tools Across 10 Domains

| # | Domain | Tool Name | Operation | Agent(s) |
|---|---|---|---|---|
| 1 | Room Types | `list_room_types` | List all rooms | Inventory, Reservations, Edit Reservations, Blocked Dates |
| 2 | Room Types | `get_room_type_details` | Get room details | Inventory |
| 3 | Room Types | `create_room_type` | Create room | Inventory |
| 4 | Room Types | `update_room_type` | Update room | Inventory |
| 5 | Room Types | `delete_room_type` | Delete room | Inventory |
| 6 | Extras | `list_extras` | List all extras | Inventory, Reservations, Edit Reservations |
| 7 | Extras | `get_extra_details` | Get extra details | Inventory |
| 8 | Extras | `create_extra` | Create extra | Inventory |
| 9 | Extras | `update_extra` | Update extra | Inventory |
| 10 | Extras | `delete_extra` | Delete extra | Inventory |
| 11 | Packages | `list_packages` | List all packages | Inventory, Reservations |
| 12 | Packages | `get_package_details` | Get package details | Inventory, Reservations |
| 13 | Packages | `create_package` | Create package | Inventory |
| 14 | Packages | `update_package` | Update package | Inventory |
| 15 | Packages | `delete_package` | Delete package | Inventory |
| 16 | Coupons | `list_coupons` | List all coupons | Inventory |
| 17 | Coupons | `get_coupon_details` | Get coupon details | Inventory |
| 18 | Coupons | `create_coupon` | Create coupon | Inventory |
| 19 | Coupons | `update_coupon` | Update coupon | Inventory |
| 20 | Coupons | `delete_coupon` | Delete coupon | Inventory |
| 21 | Coupons | `validate_coupon` | Validate coupon code | Inventory, Edit Reservations |
| 22 | Reservations | `search_reservations` | Search bookings | Reservations, Edit Reservations, Extra Selections |
| 23 | Reservations | `get_reservation_details` | Get booking details | Reservations, Edit Reservations, Extra Selections |
| 24 | Reservations | `check_availability` | Check room availability | Reservations, Edit Reservations |
| 25 | Reservations | `check_all_availability` | Check all rooms availability | Reservations, Edit Reservations |
| 26 | Reservations | `create_reservation` | Create single booking | Reservations |
| 27 | Reservations | `create_group_reservation` | Create group booking | Reservations |
| 28 | Reservations | `create_package_reservation` | Create package booking | Reservations |
| 29 | Reservations | `update_reservation_status` | Update booking status | Reservations |
| 30 | Reservations | `update_reservation_details` | Update booking details | Reservations |
| 31 | Reservations | `cancel_reservation` | Cancel booking | Reservations |
| 32 | Reservations | `delete_reservation` | Delete booking | Reservations |
| 33 | Reservations | `get_today_checkins` | Today's check-ins | Reservations |
| 34 | Reservations | `get_today_checkouts` | Today's check-outs | Reservations |
| 35 | Reservations | `send_booking_email` | Send confirmation email | Reservations, Edit Reservations |
| 36 | Analytics | `get_occupancy_stats` | Occupancy report | Analytics |
| 37 | Analytics | `get_revenue_stats` | Revenue report | Analytics |
| 38 | Analytics | `get_client_analytics` | Client analytics | Analytics |
| 39 | Analytics | `compare_periods` | Period comparison | Analytics |
| 40 | Pricing | `list_pricing_models` | List pricing models | Pricing |
| 41 | Pricing | `get_pricing_model_details` | Get model details | Pricing |
| 42 | Pricing | `simulate_pricing` | Simulate dynamic price | Pricing |
| 43 | Pricing | `get_seasonal_pricing` | Seasonal pricing rules | Pricing |
| 44 | Chef Menu | `list_chef_menu_items` | List menu items | Chef Menu |
| 45 | Chef Menu | `get_chef_menu_item_details` | Get item details | Chef Menu |
| 46 | Chef Menu | `create_chef_menu_item` | Create menu item | Chef Menu |
| 47 | Chef Menu | `update_chef_menu_item` | Update menu item | Chef Menu |
| 48 | Chef Menu | `delete_chef_menu_item` | Delete menu item | Chef Menu |
| 49 | Chef Menu | `toggle_chef_menu_availability` | Toggle availability | Chef Menu |
| 50 | Extra Selections | `list_extra_selections` | List selections | Extra Selections |
| 51 | Extra Selections | `get_extra_selection_details` | Get selection details | Extra Selections |
| 52 | Extra Selections | `update_extra_selection_status` | Update selection status | Extra Selections |
| 53 | Blocked Dates | `block_dates` | Block date range | Blocked Dates |
| 54 | Blocked Dates | `unblock_dates` | Remove blocked dates | Blocked Dates |
| 55 | Blocked Dates | `list_blocked_dates` | List blocked dates | Blocked Dates |

> **Note:** Some tools appear in multiple agents (e.g., `list_room_types` is shared by 4 agents). The actual unique tool implementations total 55, with shared tools counted once.

---

*Document generated: February 2026*
*System version: bernard-admin (main branch)*
