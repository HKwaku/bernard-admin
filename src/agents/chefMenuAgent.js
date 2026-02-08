// src/agents/chefMenuAgent.js
// Specialist agent for managing chef menu items

import OpenAI from "openai";
import {
  listChefMenuItemsTool,
  getChefMenuItemDetailsTool,
  createChefMenuItemTool,
  updateChefMenuItemTool,
  deleteChefMenuItemTool,
  toggleChefMenuAvailabilityTool,
} from "../bernardTools.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY });

const toolMap = {
  list_chef_menu_items: listChefMenuItemsTool,
  get_chef_menu_item_details: getChefMenuItemDetailsTool,
  create_chef_menu_item: createChefMenuItemTool,
  update_chef_menu_item: updateChefMenuItemTool,
  delete_chef_menu_item: deleteChefMenuItemTool,
  toggle_chef_menu_availability: toggleChefMenuAvailabilityTool,
};

const tools = [
  {
    type: "function",
    function: {
      name: "list_chef_menu_items",
      description: "List all chef menu items, optionally filtered by category.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filter by category: starters, local_mains, continental_mains, local_sides, continental_sides" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_chef_menu_item_details",
      description: "Get details of a specific chef menu item by name or ID.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Menu item name or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_chef_menu_item",
      description: "Create a new chef menu item. Only call AFTER user confirms.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Menu item name" },
          category: { type: "string", description: "Category: starters, local_mains, continental_mains, local_sides, continental_sides" },
          description: { type: "string", description: "Item description" },
          available: { type: "boolean", description: "Whether item is available (default: true)" }
        },
        required: ["name", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_chef_menu_item",
      description: "Update an existing chef menu item. Only call AFTER user confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Menu item name or ID" },
          updates: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              description: { type: "string" },
              available: { type: "boolean" }
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
      name: "delete_chef_menu_item",
      description: "Delete a chef menu item. Only call AFTER user confirms.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Menu item name or ID" }
        },
        required: ["identifier"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_chef_menu_availability",
      description: "Toggle a menu item between available and unavailable.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Menu item name or ID" }
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

const SYSTEM_PROMPT = `You are the Chef Menu Agent for Sojourn Cabins admin dashboard in Ghana.
You manage the chef menu items — the dishes that guests can select when they book the Private Chef experience.

=== CATEGORIES ===
- starters — Starters
- local_mains — Local Mains
- continental_mains — Continental Mains
- local_sides — Local Sides
- continental_sides — Continental Sides

=== CAPABILITIES ===
- List all menu items (optionally filtered by category)
- View details of a specific item
- Create new menu items
- Update existing menu items (name, category, description, availability)
- Delete menu items
- Toggle availability (available/unavailable)

=== CREATING ITEMS ===
When creating a new menu item, guide the user step-by-step:
1. Ask: "What is the name of the dish?"
2. Ask: "Which category? (Starters, Local Mains, Continental Mains, Local Sides, Continental Sides)"
3. Ask: "Any description?" (optional)
4. Summarize and ask to confirm before creating.

=== FORMATTING ===
- Format ALL responses in clean, readable markdown
- Use **bold** for labels
- Show HTML tables returned by tools directly
- Use ✓ for success, ✗ for errors, ⚠ for warnings
- Be conversational but concise
- ALWAYS confirm with user before creating/updating/deleting`;

export async function runChefMenuAgent(messages) {
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
