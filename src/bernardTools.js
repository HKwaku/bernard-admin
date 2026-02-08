// src/bernardTools.js
// --------------------
// Comprehensive Bernard AI tools covering ALL admin dashboard functionality.
// Organized by domain: Rooms, Extras, Packages, Coupons, Reservations, Analytics.

// src/bernardTools.js
// --------------------
// Tools are used server-side (Vercel). Do NOT import LangChain/LangGraph here.
// We keep the file structure the same by providing a tiny local `tool()` wrapper.
// Schemas are not enforced at runtime; they’re only documentation.

const tool = (definition) => definition;

// Minimal zod-like stub so the existing `schema:` blocks don’t crash.
// (We do NOT validate schemas here; the tools already do internal checks.)
const _chain = () => {
  const o = {};
  o.optional = () => o;
  o.default = () => o;
  o.describe = () => o;
  return o;
};
const z = {
  object: (_shape) => _chain(),
  string: () => _chain(),
  number: () => _chain(),
  boolean: () => _chain(),
  enum: (_vals) => _chain(),
};

import { createClient } from "@supabase/supabase-js";


// Server-safe env resolution (works on Vercel + locally)
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

  if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Supabase server configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your Vercel env vars."
  );
}

// Create a server-side Supabase client for Bernard tools
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// Date formatter - Centralized format: dd-Mmm-yyyy (e.g., 15 Jan 2025)
export function formatDate(dateInput) {
  if (!dateInput) return '';
  
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
    
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    return dateInput;
  }
}


// =====================
// UNIVERSAL TABLE FORMATTER
// =====================

export function formatTable(rows, options = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return "No data found.";

  const keys = Object.keys(rows[0]);
  const ths = keys.map(k => `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;white-space:nowrap">${k.replace(/_/g, ' ')}</th>`).join("");
  const trs = rows.map(r => `<tr>${keys.map(k => `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${r[k] ?? ''}</td>`).join("")}</tr>`).join("");

  return `<table style="border-collapse:collapse;font-size:0.85rem"><thead style="background:#f8fafc;"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// =====================
// ACTIVE PRICING MODEL HELPER
// =====================

async function getActivePricingModelId() {
  try {
    const { data: models } = await supabase
      .from("pricing_models")
      .select("id, name")
      .eq("is_active", true)
      .limit(1);
    return models?.[0]?.id || null;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// ROOM TYPES TOOLS
// ============================================================================

export const listRoomsTool = tool({
  name: "list_room_types",
  description: "List all room types (active and inactive) with their details including pricing, capacity, and status.",
  schema: z.object({}),
  async func(_input) {
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
        Image: r.image_url ? "Yes" : "No"
      })),
      { minWidth: "480px" }
    );
  },
});

export const getRoomDetailsTool = tool({
  name: "get_room_type_details",
  description: "Get full details of a specific room type by code or ID.",
  schema: z.object({
    identifier: z.string().describe("Room code or room ID")
  }),
  async func({ identifier }) {
    // Try by code first, then by ID
    let query = supabase.from("room_types").select("*");
    
    if (identifier.length < 10) {
      // Likely a code
      query = query.eq("code", identifier.toUpperCase());
    } else {
      // Likely an ID
      query = query.eq("id", identifier);
    }

    const { data, error } = await query.single();

    if (error) return `Error: ${error.message}`;
    if (!data) return `Room type '${identifier}' not found.`;

    return `
**${data.name}** (${data.code})
- **Status**: ${data.is_active ? 'Active ✓' : 'Inactive ✗'}
- **Capacity**: Sleeps up to ${data.max_adults || 2} adults
- **Pricing**: 
  - Weekday: ${data.currency || 'GHS'} ${data.base_price_per_night_weekday}
  - Weekend: ${data.currency || 'GHS'} ${data.base_price_per_night_weekend}
- **Description**: ${data.description || 'N/A'}
- **Image**: ${data.image_url || 'No image set'}
- **Room ID**: ${data.id}
`;
  },
});

export const createRoomTypeTool = tool({
  name: "create_room_type",
  description: "Create a new room type. Requires explicit user confirmation before executing.",
  schema: z.object({
    code: z.string().describe("Unique room code (e.g., 'SAND', 'SEA', 'SUN')"),
    name: z.string().describe("Display name (e.g., 'Sand Cabin')"),
    description: z.string().optional().describe("Room description"),
    weekday_price: z.number().describe("Base price per night on weekdays"),
    weekend_price: z.number().describe("Base price per night on weekends"),
    currency: z.string().default("GBP").describe("Currency code (GBP, USD, EUR, GHS)"),
    max_adults: z.number().default(2).describe("Maximum number of adults"),
    is_active: z.boolean().default(true).describe("Whether room is active"),
    image_url: z.string().optional().describe("Image URL"),
  }),
  async func(input) {
    const { error } = await supabase.from("room_types").insert({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      base_price_per_night_weekday: input.weekday_price,
      base_price_per_night_weekend: input.weekend_price,
      currency: input.currency,
      max_adults: input.max_adults,
      is_active: input.is_active,
      image_url: input.image_url || null,
    });

    if (error) return `Error creating room type: ${error.message}`;

    return `✓ Room type "${input.name}" (${input.code.toUpperCase()}) created successfully!
- Weekday: ${input.currency} ${input.weekday_price}
- Weekend: ${input.currency} ${input.weekend_price}
- Max Adults: ${input.max_adults}
- Status: ${input.is_active ? 'Active' : 'Inactive'}`;
  },
});

export const updateRoomTypeTool = tool({
  name: "update_room_type",
  description: "Update an existing room type. Requires explicit user confirmation before executing.",
  schema: z.object({
    identifier: z.string().describe("Room code or ID to update"),
    updates: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      weekday_price: z.number().optional(),
      weekend_price: z.number().optional(),
      currency: z.string().optional(),
      max_adults: z.number().optional(),
      is_active: z.boolean().optional(),
      image_url: z.string().optional(),
    }).describe("Fields to update"),
  }),
  async func({ identifier, updates }) {
    // Build update payload
    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.weekday_price) payload.base_price_per_night_weekday = updates.weekday_price;
    if (updates.weekend_price) payload.base_price_per_night_weekend = updates.weekend_price;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.max_adults) payload.max_adults = updates.max_adults;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.image_url !== undefined) payload.image_url = updates.image_url;

    // Determine if identifier is code or ID
    let query = supabase.from("room_types").update(payload);
    
    if (identifier.length < 10) {
      query = query.eq("code", identifier.toUpperCase());
    } else {
      query = query.eq("id", identifier);
    }

    const { error } = await query;

    if (error) return `Error updating room type: ${error.message}`;

    return `✓ Room type '${identifier}' updated successfully!
Updated fields: ${Object.keys(payload).join(', ')}`;
  },
});

export const deleteRoomTypeTool = tool({
  name: "delete_room_type",
  description: "Delete a room type. Requires explicit user confirmation before executing. WARNING: This is permanent!",
  schema: z.object({
    identifier: z.string().describe("Room code or ID to delete"),
  }),
  async func({ identifier }) {
    let query = supabase.from("room_types").delete();
    
    if (identifier.length < 10) {
      query = query.eq("code", identifier.toUpperCase()).select();
    } else {
      query = query.eq("id", identifier).select();
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '23503') {
        return `✗ Cannot delete room type '${identifier}': This room is being used in packages or reservations. You must delete or reassign those first.`;
      }
      return `Error deleting room type: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return `✗ Room type '${identifier}' not found or could not be deleted. It may be in use.`;
    }

    return `✓ Room type '${identifier}' deleted successfully. This action is permanent.`;
  },
});

// ============================================================================
// EXTRAS TOOLS
// ============================================================================

export const listExtrasTool = tool({
  name: "list_extras",
  description: "List all extras/add-ons with their ID, pricing, category, and unit type. Use the ID when adding extras to a reservation.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("extras")
      .select("*")
      .order("name", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No extras found.";

    // Only show active extras by default, keep output compact to avoid token limits
    const activeExtras = data.filter(e => e.is_active !== false);
    return formatTable(
      activeExtras.map(e => ({
        Code: e.code || '—',
        Name: e.name,
        Category: e.category || "N/A",
        Price: `${e.currency || 'GHS'} ${e.price}`,
        "Unit Type": e.unit_type?.replace(/_/g, ' ') || 'per booking',
      })),
      { minWidth: "400px" }
    );
  },
});

export const getExtraDetailsTool = tool({
  name: "get_extra_details",
  description: "Get full details of a specific extra by name or ID.",
  schema: z.object({
    identifier: z.string().describe("Extra name or ID")
  }),
  async func({ identifier }) {
    let query = supabase.from("extras").select("*");
    
    // Try by ID first, then by name
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }

    const { data, error } = await query;

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return `Extra '${identifier}' not found.`;

    const extra = data[0];

    return `
**${extra.name}** (${extra.code || '—'})
- **Code**: ${extra.code || '—'}
- **Category**: ${extra.category || 'N/A'}
- **Price**: ${extra.currency || 'GHS'} ${extra.price} ${extra.unit_type?.replace(/_/g, ' ') || 'per booking'}
- **Needs Guest Input**: ${extra.needs_guest_input ? 'Yes ✓' : 'No'}
- **Status**: ${extra.is_active ? 'Active ✓' : 'Inactive ✗'}
- **Description**: ${extra.description || 'N/A'}
- **Extra ID**: ${extra.id}
`;
  },
});

export const createExtraTool = tool({
  name: "create_extra",
  description: "Create a new extra/add-on. Requires explicit user confirmation before executing.",
  schema: z.object({
    name: z.string().describe("Extra name (e.g., 'Airport Transfer')"),
    code: z.string().describe("Unique code for the extra (e.g., 'AIRPORT_TRANSFER')"),
    category: z.string().optional().describe("Category (e.g., 'Transport', 'Food', 'Activity')"),
    description: z.string().optional().describe("Description"),
    price: z.number().describe("Price amount"),
    currency: z.string().default("GHS").describe("Currency code"),
    unit_type: z.enum(["per_booking", "per_night", "per_person", "per_person_per_night"]).default("per_booking"),
    is_active: z.boolean().default(true),
    needs_guest_input: z.boolean().default(false).describe("Whether the guest needs to provide input for this extra (e.g., choosing a date/time for an experience)"),
  }),
  async func(input) {
    const { error } = await supabase.from("extras").insert({
      name: input.name,
      code: input.code.toUpperCase(),
      category: input.category || null,
      description: input.description || null,
      price: input.price,
      currency: input.currency,
      unit_type: input.unit_type,
      is_active: input.is_active,
      needs_guest_input: input.needs_guest_input,
    });

    if (error) return `Error creating extra: ${error.message}`;

    return `✓ Extra "${input.name}" (${input.code.toUpperCase()}) created successfully!
- Price: ${input.currency} ${input.price} ${input.unit_type.replace(/_/g, ' ')}
- Category: ${input.category || 'N/A'}
- Needs Guest Input: ${input.needs_guest_input ? 'Yes' : 'No'}
- Status: ${input.is_active ? 'Active' : 'Inactive'}`;
  },
});

export const updateExtraTool = tool({
  name: "update_extra",
  description: "Update an existing extra. Requires explicit user confirmation before executing.",
  schema: z.object({
    identifier: z.string().describe("Extra name, code, or ID"),
    updates: z.object({
      name: z.string().optional(),
      code: z.string().optional().describe("Unique code for the extra"),
      category: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      currency: z.string().optional(),
      unit_type: z.enum(["per_booking", "per_night", "per_person", "per_person_per_night"]).optional(),
      is_active: z.boolean().optional(),
      needs_guest_input: z.boolean().optional().describe("Whether the guest needs to provide input for this extra"),
    }),
  }),
  async func({ identifier, updates }) {
    // First, find the extra by ID, code, or name
    let extra = null;
    if (identifier.length > 20 && identifier.includes('-')) {
      const { data } = await supabase.from("extras").select("*").eq("id", identifier).single();
      extra = data;
    }
    if (!extra) {
      const { data } = await supabase.from("extras").select("*").ilike("code", identifier).single();
      extra = data;
    }
    if (!extra) {
      const { data } = await supabase.from("extras").select("*").ilike("name", `%${identifier}%`).limit(1);
      extra = data?.[0] || null;
    }
    if (!extra) return `✗ Extra '${identifier}' not found. Please check the name or code and try again.`;

    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.code !== undefined) payload.code = updates.code.toUpperCase();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price !== undefined) payload.price = updates.price;
    if (updates.currency !== undefined) payload.currency = updates.currency;
    if (updates.unit_type !== undefined) payload.unit_type = updates.unit_type;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.needs_guest_input !== undefined) payload.needs_guest_input = updates.needs_guest_input;

    if (Object.keys(payload).length === 0) return `✗ No update fields provided.`;

    const { error } = await supabase.from("extras").update(payload).eq("id", extra.id);

    if (error) return `Error updating extra: ${error.message}`;

    return `✓ Extra "${extra.name}" (${extra.code}) updated successfully!
Updated fields: ${Object.keys(payload).join(', ')}`;
  },
});

export const deleteExtraTool = tool({
  name: "delete_extra",
  description: "Delete an extra. Requires explicit user confirmation before executing. WARNING: This is permanent!",
  schema: z.object({
    identifier: z.string().describe("Extra name or ID to delete"),
  }),
  async func({ identifier }) {
    let query = supabase.from("extras").delete();
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier).select();
    } else {
      query = query.ilike("name", `%${identifier}%`).select();
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '23503') {
        return `✗ Cannot delete extra '${identifier}': This extra is being used in packages or reservations. You must remove those associations first.`;
      }
      return `Error deleting extra: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return `✗ Extra '${identifier}' not found or could not be deleted. It may be in use.`;
    }

    return `✓ Extra '${identifier}' deleted successfully. This action is permanent.`;
  },
});

// ============================================================================
// PACKAGES TOOLS
// ============================================================================

export const listPackagesTool = tool({
  name: "list_packages",
  description: "List all packages (active and inactive) with their pricing, nights, and validity.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No packages found.";

    // Fetch room associations from junction table
    const packageIds = data.map(p => p.id);
    const { data: pkgRooms } = await supabase
      .from("packages_rooms")
      .select("package_id, room_type_id, room_types(name, code)")
      .in("package_id", packageIds);

    // Build room map per package
    const roomMap = {};
    (pkgRooms || []).forEach(pr => {
      if (!roomMap[pr.package_id]) roomMap[pr.package_id] = [];
      if (pr.room_types) roomMap[pr.package_id].push(pr.room_types.name || pr.room_types.code);
    });

    return formatTable(
      data.map(p => ({
        Code: (p.code || '').toUpperCase(),
        Name: p.name,
        Nights: p.nights || 'N/A',
        Price: `${p.currency || 'GHS'} ${p.package_price || 'N/A'}`,
        "Valid From": formatDate(p.valid_from) || '–',
        "Valid Until": formatDate(p.valid_until) || '–',
        Rooms: roomMap[p.id]?.join(', ') || 'All',
        Active: p.is_active ? "✓" : "✗",
        Featured: p.is_featured ? "⭐" : "",
      })),
      { minWidth: "500px" }
    );
  },
});

export const getPackageDetailsTool = tool({
  name: "get_package_details",
  description: "Get full details of a specific package including included extras and room associations.",
  schema: z.object({
    identifier: z.string().describe("Package name or ID")
  }),
  async func({ identifier }) {
    let query = supabase.from("packages").select(`
      *,
      package_extras (
        quantity,
        extras (name, price, currency, unit_type)
      )
    `);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }

    const { data, error } = await query;

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return `Package '${identifier}' not found.`;

    const pkg = data[0];

    // Fetch room associations from junction table
    let roomNames = [];
    try {
      const { data: pkgRooms } = await supabase
        .from("packages_rooms")
        .select("room_type_id, room_types(name, code)")
        .eq("package_id", pkg.id);
      roomNames = (pkgRooms || []).filter(pr => pr.room_types).map(pr => `${pr.room_types.name} (${pr.room_types.code})`);
    } catch (e) {
      // packages_rooms table may not exist
    }

    let response = `
**${pkg.name}**
- **Code**: ${(pkg.code || '').toUpperCase()}
- **Status**: ${pkg.is_active ? 'Active ✓' : 'Inactive ✗'}
- **Featured**: ${pkg.is_featured ? 'Yes ⭐' : 'No'}
- **Minimum Nights**: ${pkg.nights || 'N/A'}
- **Package Price**: ${pkg.currency || 'GHS'} ${pkg.package_price || 'N/A'}
- **Valid From**: ${formatDate(pkg.valid_from) || '–'}
- **Valid Until**: ${formatDate(pkg.valid_until) || '–'}
- **Rooms**: ${roomNames.length ? roomNames.join(', ') : 'All cabins'}
- **Description**: ${pkg.description || 'N/A'}
- **Package ID**: ${pkg.id}
`;

    if (pkg.package_extras?.length) {
      response += `\n**Included Extras**:\n`;
      pkg.package_extras.forEach(pe => {
        if (pe.extras) {
          response += `- ${pe.extras.name} (Qty: ${pe.quantity || 1}) — ${pe.extras.currency || 'GHS'} ${pe.extras.price} ${pe.extras.unit_type?.replace(/_/g, ' ') || ''}\n`;
        }
      });
    }

    return response;
  },
});

export const createPackageTool = tool({
  name: "create_package",
  description: "Create a new package with optional room associations and included extras. Requires explicit user confirmation before executing.",
  schema: z.object({
    code: z.string().describe("Unique package code (e.g., 'HONEYMOON')"),
    name: z.string().describe("Package name"),
    description: z.string().optional().describe("Package description"),
    nights: z.number().describe("Number of nights (must be >= 1)"),
    package_price: z.number().describe("Package price in GHS"),
    currency: z.string().default("GHS"),
    valid_from: z.string().optional().describe("Valid from date (YYYY-MM-DD)"),
    valid_until: z.string().optional().describe("Valid until date (YYYY-MM-DD)"),
    image_url: z.string().optional().describe("Image URL for the package"),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
    room_codes: z.string().optional().describe("JSON array of room codes this package is available for (e.g., '[\"SAND\",\"SEA\"]'). Omit for all rooms."),
    extras: z.string().optional().describe("JSON array of included extras with quantities (e.g., '[{\"name\":\"Private Chef\",\"quantity\":2}]')"),
  }),
  async func(input) {
    // Validate nights
    if (!input.nights || input.nights < 1) return "✗ Nights is required and must be at least 1.";
    if (!input.code || !input.name || input.package_price === undefined) return "✗ Code, Name, and Package Price are required.";

    console.log('📦 [createPackage] Input:', JSON.stringify({ code: input.code, name: input.name, nights: input.nights, price: input.package_price, room_codes: input.room_codes, extras: input.extras }));

    // Insert the package
    const { data: pkgRow, error } = await supabase.from("packages").insert({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description || null,
      nights: input.nights,
      package_price: input.package_price,
      currency: input.currency,
      valid_from: input.valid_from || null,
      valid_until: input.valid_until || null,
      image_url: input.image_url || null,
      is_active: input.is_active,
      is_featured: input.is_featured,
    }).select().single();

    if (error) {
      console.error('❌ [createPackage] Error:', error.message);
      return `Error creating package: ${error.message}`;
    }
    console.log('✅ [createPackage] Package created:', pkgRow.id);

    // Handle room associations
    let roomsLinked = 0;
    if (input.room_codes) {
      try {
        const codes = typeof input.room_codes === 'string' ? JSON.parse(input.room_codes) : input.room_codes;
        if (Array.isArray(codes) && codes.length) {
          const { data: rooms } = await supabase.from("room_types").select("id, code").in("code", codes.map(c => c.toUpperCase()));
          if (rooms?.length) {
            const roomLinks = rooms.map(r => ({ package_id: pkgRow.id, room_type_id: r.id }));
            await supabase.from("packages_rooms").insert(roomLinks);
            roomsLinked = rooms.length;
          }
        }
      } catch (e) { console.error('❌ [createPackage] Room codes parse error:', e.message); }
    }

    // Handle package extras
    let extrasLinked = 0;
    if (input.extras) {
      try {
        const extrasList = typeof input.extras === 'string' ? JSON.parse(input.extras) : input.extras;
        console.log('📦 [createPackage] Parsed extras list:', JSON.stringify(extrasList));
        if (Array.isArray(extrasList) && extrasList.length) {
          const extrasPayload = [];
          for (const item of extrasList) {
            let extra = null;
            // Try by ID
            if (item.extra_id) {
              const { data } = await supabase.from("extras").select("id, code").eq("id", item.extra_id).single();
              extra = data;
            }
            // Try by code
            if (!extra && (item.code || item.name)) {
              const searchCode = item.code || item.name;
              const { data } = await supabase.from("extras").select("id, code").ilike("code", searchCode).limit(1);
              extra = data?.[0] || null;
            }
            // Try by name
            if (!extra && item.name) {
              const { data } = await supabase.from("extras").select("id, code").ilike("name", `%${item.name}%`).limit(1);
              extra = data?.[0] || null;
            }
            if (extra) {
              extrasPayload.push({
                package_id: pkgRow.id,
                extra_id: extra.id,
                quantity: item.quantity || 1,
                code: extra.code || null,
              });
            } else {
              console.warn(`⚠ [createPackage] Extra not found: ${JSON.stringify(item)}`);
            }
          }
          if (extrasPayload.length) {
            const { error: extErr } = await supabase.from("package_extras").insert(extrasPayload);
            if (extErr) console.error('❌ [createPackage] package_extras insert error:', extErr.message);
            else extrasLinked = extrasPayload.length;
          }
        }
      } catch (e) { console.error('❌ [createPackage] Extras parse error:', e.message); }
    }

    console.log(`✅ [createPackage] Linked ${roomsLinked} rooms, ${extrasLinked} extras`);

    return `✓ Package "${input.name}" (${input.code.toUpperCase()}) created successfully!
- Nights: ${input.nights}
- Package Price: ${input.currency} ${input.package_price}
- Valid: ${input.valid_from || 'Now'} to ${input.valid_until || 'No expiry'}
- Rooms: ${roomsLinked > 0 ? `${roomsLinked} room(s) linked` : 'All rooms'}
- Extras: ${extrasLinked > 0 ? `${extrasLinked} extra(s) included` : 'None'}
- Status: ${input.is_active ? 'Active' : 'Inactive'}
- Featured: ${input.is_featured ? 'Yes' : 'No'}`;
  },
});

export const updatePackageTool = tool({
  name: "update_package",
  description: "Update an existing package. Can also update room associations and included extras (full replacement). Requires explicit user confirmation before executing.",
  schema: z.object({
    identifier: z.string().describe("Package name, code, or ID"),
    updates: z.object({
      code: z.string().optional().describe("Package code"),
      name: z.string().optional(),
      description: z.string().optional(),
      nights: z.number().optional(),
      package_price: z.number().optional(),
      currency: z.string().optional(),
      valid_from: z.string().optional().describe("Valid from date (YYYY-MM-DD), or empty string to clear"),
      valid_until: z.string().optional().describe("Valid until date (YYYY-MM-DD), or empty string to clear"),
      image_url: z.string().optional(),
      is_active: z.boolean().optional(),
      is_featured: z.boolean().optional(),
      room_codes: z.string().optional().describe("JSON array of room codes (replaces ALL current room associations). Use '[]' to clear all."),
      extras: z.string().optional().describe("JSON array of extras with quantities (replaces ALL current extras). E.g. '[{\"name\":\"Chef\",\"quantity\":2}]'. Use '[]' to clear all."),
    }),
  }),
  async func({ identifier, updates }) {
    // Find the package first
    let pkgQuery = supabase.from("packages").select("*");
    if (identifier.length > 20 && identifier.includes('-')) {
      pkgQuery = pkgQuery.eq("id", identifier);
    } else {
      // Try code first, then name
      pkgQuery = pkgQuery.or(`code.ilike.%${identifier}%,name.ilike.%${identifier}%`);
    }
    const { data: pkgs, error: findErr } = await pkgQuery;
    if (findErr) return `Error finding package: ${findErr.message}`;
    if (!pkgs?.length) return `✗ Package '${identifier}' not found.`;
    const pkg = pkgs[0];

    // Build update payload for the packages table
    const payload = {};
    if (updates.code) payload.code = updates.code.toUpperCase();
    if (updates.name) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description || null;
    if (updates.nights) payload.nights = updates.nights;
    if (updates.package_price !== undefined) payload.package_price = updates.package_price;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.valid_from !== undefined) payload.valid_from = updates.valid_from || null;
    if (updates.valid_until !== undefined) payload.valid_until = updates.valid_until || null;
    if (updates.image_url !== undefined) payload.image_url = updates.image_url || null;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.is_featured !== undefined) payload.is_featured = updates.is_featured;

    // Update the package row
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from("packages").update(payload).eq("id", pkg.id);
      if (error) return `Error updating package: ${error.message}`;
    }

    const changeLog = [];
    if (Object.keys(payload).length > 0) {
      changeLog.push(`Fields: ${Object.keys(payload).join(', ')}`);
    }

    // Handle room associations (full replacement, matching packages.js)
    if (updates.room_codes !== undefined) {
      // Delete all existing room associations
      await supabase.from("packages_rooms").delete().eq("package_id", pkg.id);

      try {
        const codes = typeof updates.room_codes === 'string' ? JSON.parse(updates.room_codes) : updates.room_codes;
        if (Array.isArray(codes) && codes.length) {
          const { data: rooms } = await supabase.from("room_types").select("id, code").in("code", codes.map(c => c.toUpperCase()));
          if (rooms?.length) {
            const roomLinks = rooms.map(r => ({ package_id: pkg.id, room_type_id: r.id }));
            await supabase.from("packages_rooms").insert(roomLinks);
            changeLog.push(`Rooms: ${rooms.length} linked`);
          } else {
            changeLog.push('Rooms: cleared (no matching codes)');
          }
        } else {
          changeLog.push('Rooms: cleared');
        }
      } catch (e) { changeLog.push('Rooms: cleared (invalid input)'); }
    }

    // Handle package extras (full replacement, matching packages.js)
    if (updates.extras !== undefined) {
      // Delete all existing extras
      await supabase.from("package_extras").delete().eq("package_id", pkg.id);

      try {
        const extrasList = typeof updates.extras === 'string' ? JSON.parse(updates.extras) : updates.extras;
        if (Array.isArray(extrasList) && extrasList.length) {
          const extrasPayload = [];
          for (const item of extrasList) {
            let extra = null;
            // Try by ID
            if (item.extra_id) {
              const { data } = await supabase.from("extras").select("id, code").eq("id", item.extra_id).single();
              extra = data;
            }
            // Try by code
            if (!extra && (item.code || item.name)) {
              const searchCode = item.code || item.name;
              const { data } = await supabase.from("extras").select("id, code").ilike("code", searchCode).limit(1);
              extra = data?.[0] || null;
            }
            // Try by name
            if (!extra && item.name) {
              const { data } = await supabase.from("extras").select("id, code").ilike("name", `%${item.name}%`).limit(1);
              extra = data?.[0] || null;
            }
            if (extra) {
              extrasPayload.push({
                package_id: pkg.id,
                extra_id: extra.id,
                quantity: item.quantity || 1,
                code: extra.code || null,
              });
            }
          }
          if (extrasPayload.length) {
            await supabase.from("package_extras").insert(extrasPayload);
            changeLog.push(`Extras: ${extrasPayload.length} included`);
          } else {
            changeLog.push('Extras: cleared (no matching extras)');
          }
        } else {
          changeLog.push('Extras: cleared');
        }
      } catch (e) { changeLog.push('Extras: cleared (invalid input)'); }
    }

    return `✓ Package '${pkg.name}' (${(pkg.code || '').toUpperCase()}) updated successfully!
${changeLog.join('\n')}`;
  },
});

export const deletePackageTool = tool({
  name: "delete_package",
  description: "Delete a package and its room/extras associations. Requires explicit user confirmation before executing. WARNING: This is permanent!",
  schema: z.object({
    identifier: z.string().describe("Package name, code, or ID to delete"),
  }),
  async func({ identifier }) {
    // Find the package first to get its ID
    let findQuery = supabase.from("packages").select("id, name, code");
    if (identifier.length > 20 && identifier.includes('-')) {
      findQuery = findQuery.eq("id", identifier);
    } else {
      findQuery = findQuery.or(`code.ilike.%${identifier}%,name.ilike.%${identifier}%`);
    }
    const { data: pkgs } = await findQuery;
    if (!pkgs?.length) return `✗ Package '${identifier}' not found.`;
    const pkg = pkgs[0];

    // Clean up junction tables first (in case no CASCADE)
    await supabase.from("packages_rooms").delete().eq("package_id", pkg.id);
    await supabase.from("package_extras").delete().eq("package_id", pkg.id);

    // Delete the package
    const { error } = await supabase.from("packages").delete().eq("id", pkg.id);

    if (error) {
      if (error.code === '23503') {
        return `✗ Cannot delete package '${pkg.name}': This package is being used in existing reservations. You must delete or reassign those reservations first, or deactivate the package instead.`;
      }
      return `Error deleting package: ${error.message}`;
    }

    return `✓ Package '${pkg.name}' (${(pkg.code || '').toUpperCase()}) deleted successfully. This action is permanent.`;
  },
});

// ============================================================================
// COUPONS TOOLS
// ============================================================================

export const listCouponsTool = tool({
  name: "list_coupons",
  description: "List all coupons with their discount type, value, and validity.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("code", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No coupons found.";

    const today = new Date().toISOString().split('T')[0];

    return formatTable(
      data.map(c => {
        const isValid = c.is_active && 
                       (!c.valid_from || c.valid_from <= today) && 
                       (!c.valid_until || c.valid_until >= today);
        
        return {
          Code: c.code,
          Type: c.discount_type,
          Value: c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.currency || 'GHS'} ${c.discount_value}`,
          "Applies To": c.applies_to || '–',
          "Valid Until": formatDate(c.valid_until) || 'No expiry',
          Active: c.is_active ? "✓" : "✗",
          Status: isValid ? "Valid ✓" : "Expired/Inactive",
        };
      }),
      { minWidth: "520px" }
    );
  },
});

export const getCouponDetailsTool = tool({
  name: "get_coupon_details",
  description: "Get full details of a specific coupon by code or ID.",
  schema: z.object({
    identifier: z.string().describe("Coupon code or ID")
  }),
  async func({ identifier }) {
    let query = supabase.from("coupons").select("*");
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("code", identifier.toUpperCase());
    }

    const { data, error } = await query.single();

    if (error) return `Error: ${error.message}`;
    if (!data) return `Coupon '${identifier}' not found.`;

    const today = new Date().toISOString().split('T')[0];
    const isValid = data.is_active && 
                   (!data.valid_from || data.valid_from <= today) && 
                   (!data.valid_until || data.valid_until >= today);

    // Resolve extra names if extra_ids exist
    let targetedExtrasLabel = 'All extras';
    if (Array.isArray(data.extra_ids) && data.extra_ids.length) {
      const { data: extras } = await supabase.from("extras").select("id, name").in("id", data.extra_ids);
      if (extras?.length) {
        targetedExtrasLabel = extras.map(e => e.name).join(', ');
      } else {
        targetedExtrasLabel = `${data.extra_ids.length} extras (IDs)`;
      }
    }

    return `
**${data.code}**
- **Discount**: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `${data.currency || 'GHS'} ${data.discount_value}`}
- **Type**: ${data.discount_type}
- **Applies To**: ${data.applies_to || 'N/A'}
- **Targeted Extras**: ${targetedExtrasLabel}
- **Valid From**: ${formatDate(data.valid_from) || 'N/A'}
- **Valid Until**: ${formatDate(data.valid_until) || 'No expiry'}
- **Usage Limit**: ${data.max_uses || 'Unlimited'}
- **Max per Guest**: ${data.max_uses_per_guest || 'Unlimited'}
- **Times Used**: ${data.current_uses || 0}
- **Min Booking Amount**: ${data.min_booking_amount ? `${data.currency || 'GHS'} ${data.min_booking_amount}` : 'None'}
- **Status**: ${data.is_active ? 'Active' : 'Inactive'}
- **Currently Valid**: ${isValid ? 'Yes ✓' : 'No ✗'}
- **Description**: ${data.description || 'N/A'}
- **Coupon ID**: ${data.id}
`;
  },
});

export const createCouponTool = tool({
  name: "create_coupon",
  description: "Create a new coupon. Requires explicit user confirmation before executing.",
  schema: z.object({
    code: z.string().describe("Coupon code (e.g., 'SUMMER2026')"),
    discount_type: z.enum(["percentage", "fixed"]).describe("Type of discount"),
    discount_value: z.number().describe("Discount amount (e.g., 20 for 20% or GHS 20)"),
    applies_to: z.enum(["both", "rooms", "extras"]).describe("What the coupon applies to: 'both' (room + extras), 'rooms' only, or 'extras' only"),
    currency: z.string().default("GHS").describe("Currency for fixed discounts"),
    description: z.string().optional(),
    extra_ids: z.string().optional().describe("JSON array of extra IDs to target (if applies_to is 'extras' or 'both'). Omit or null for all extras."),
    valid_from: z.string().optional().describe("Valid from date (YYYY-MM-DD)"),
    valid_until: z.string().optional().describe("Valid until date (YYYY-MM-DD)"),
    max_uses: z.number().optional().describe("Maximum number of total uses"),
    max_uses_per_guest: z.number().optional().describe("Maximum uses per individual guest"),
    min_booking_amount: z.number().optional().describe("Minimum booking amount (GHS) for coupon to apply"),
    is_active: z.boolean().default(true),
  }),
  async func(input) {
    // Parse extra_ids if provided as JSON string
    let parsedExtraIds = null;
    if (input.extra_ids) {
      try {
        parsedExtraIds = typeof input.extra_ids === 'string' ? JSON.parse(input.extra_ids) : input.extra_ids;
        if (!Array.isArray(parsedExtraIds)) parsedExtraIds = null;
      } catch (e) { parsedExtraIds = null; }
    }

    console.log('🎟️ [createCoupon] Input:', JSON.stringify({ code: input.code, discount_type: input.discount_type, discount_value: input.discount_value, applies_to: input.applies_to, extra_ids: parsedExtraIds, max_uses: input.max_uses }));

    const { error } = await supabase.from("coupons").insert({
      code: input.code.toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      applies_to: input.applies_to,
      currency: input.currency,
      description: input.description || null,
      extra_ids: parsedExtraIds,
      valid_from: input.valid_from || null,
      valid_until: input.valid_until || null,
      max_uses: input.max_uses || null,
      current_uses: 0,
      max_uses_per_guest: input.max_uses_per_guest || null,
      min_booking_amount: input.min_booking_amount || null,
      is_active: input.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('❌ [createCoupon] Error:', error.message);
      return `Error creating coupon: ${error.message}`;
    }

    console.log('✅ [createCoupon] Coupon created successfully:', input.code.toUpperCase());

    return `✓ Coupon "${input.code.toUpperCase()}" created successfully!
- Discount: ${input.discount_type === 'percentage' ? `${input.discount_value}%` : `${input.currency} ${input.discount_value}`}
- Applies to: ${input.applies_to}
- Valid: ${input.valid_from || 'Now'} to ${input.valid_until || 'No expiry'}
- Usage Limit: ${input.max_uses || 'Unlimited'}
- Max per Guest: ${input.max_uses_per_guest || 'Unlimited'}
- Min Booking: ${input.min_booking_amount ? `${input.currency} ${input.min_booking_amount}` : 'None'}
- Targeted Extras: ${parsedExtraIds ? parsedExtraIds.length + ' extras' : 'All'}
- Status: ${input.is_active ? 'Active' : 'Inactive'}`;
  },
});

export const updateCouponTool = tool({
  name: "update_coupon",
  description: "Update an existing coupon. Requires explicit user confirmation before executing.",
  schema: z.object({
    identifier: z.string().describe("Coupon code or ID"),
    updates: z.object({
      code: z.string().optional(),
      discount_type: z.enum(["percentage", "fixed"]).optional(),
      discount_value: z.number().optional(),
      applies_to: z.enum(["both", "rooms", "extras"]).optional().describe("What the coupon applies to"),
      currency: z.string().optional(),
      description: z.string().optional(),
      extra_ids: z.string().optional().describe("JSON array of extra IDs to target, or 'null' to clear targeting"),
      valid_from: z.string().optional(),
      valid_until: z.string().optional(),
      max_uses: z.number().optional().describe("Maximum number of total uses"),
      max_uses_per_guest: z.number().optional(),
      min_booking_amount: z.number().optional(),
      is_active: z.boolean().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    const payload = {};
    if (updates.code) payload.code = updates.code.toUpperCase();
    if (updates.discount_type) payload.discount_type = updates.discount_type;
    if (updates.discount_value !== undefined) payload.discount_value = updates.discount_value;
    if (updates.applies_to) payload.applies_to = updates.applies_to;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.extra_ids !== undefined) {
      if (updates.extra_ids === 'null' || updates.extra_ids === null) {
        payload.extra_ids = null;
      } else {
        try {
          const parsed = typeof updates.extra_ids === 'string' ? JSON.parse(updates.extra_ids) : updates.extra_ids;
          payload.extra_ids = Array.isArray(parsed) ? parsed : null;
        } catch (e) { payload.extra_ids = null; }
      }
    }
    if (updates.valid_from !== undefined) payload.valid_from = updates.valid_from;
    if (updates.valid_until !== undefined) payload.valid_until = updates.valid_until;
    if (updates.max_uses !== undefined) payload.max_uses = updates.max_uses;
    if (updates.max_uses_per_guest !== undefined) payload.max_uses_per_guest = updates.max_uses_per_guest;
    if (updates.min_booking_amount !== undefined) payload.min_booking_amount = updates.min_booking_amount;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    payload.updated_at = new Date().toISOString();

    let query = supabase.from("coupons").update(payload);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("code", identifier.toUpperCase());
    }

    const { error } = await query;

    if (error) return `Error updating coupon: ${error.message}`;

    return `✓ Coupon '${identifier}' updated successfully!
Updated fields: ${Object.keys(payload).filter(k => k !== 'updated_at').join(', ')}`;
  },
});

export const deleteCouponTool = tool({
  name: "delete_coupon",
  description: "Delete a coupon. Requires explicit user confirmation before executing. WARNING: This is permanent!",
  schema: z.object({
    identifier: z.string().describe("Coupon code or ID to delete"),
  }),
  async func({ identifier }) {
    let query = supabase.from("coupons").delete();
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier).select();
    } else {
      query = query.eq("code", identifier.toUpperCase()).select();
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '23503') {
        return `✗ Cannot delete coupon '${identifier}': This coupon is being used in reservations. You must remove those associations first.`;
      }
      return `Error deleting coupon: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return `✗ Coupon '${identifier}' not found or could not be deleted.`;
    }

    return `✓ Coupon '${identifier}' deleted successfully. This action is permanent.`;
  },
});

export const validateCouponTool = tool({
  name: "validate_coupon",
  description: "Validate a coupon and calculate its discount for a specific booking amount.",
  schema: z.object({
    code: z.string().describe("Coupon code to validate"),
    booking_total: z.number().describe("Booking total amount before discount"),
  }),
  async func({ code, booking_total }) {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (error) return `Coupon '${code}' not found.`;

    const today = new Date().toISOString().split('T')[0];
    const c = data;

    // Check if active
    if (!c.is_active) return `❌ Coupon '${code}' is inactive.`;

    // Check date validity
    if (c.valid_from && c.valid_from > today) {
      return `❌ Coupon '${code}' is not yet valid. Valid from: ${c.valid_from}`;
    }
    if (c.valid_until && c.valid_until < today) {
      return `❌ Coupon '${code}' has expired. Valid until: ${c.valid_until}`;
    }

    // Check usage limit
    if (c.max_uses && c.current_uses >= c.max_uses) {
      return `❌ Coupon '${code}' has reached its usage limit (${c.max_uses}).`;
    }

    // Calculate discount
    let discount = 0;
    if (c.discount_type === 'percentage') {
      discount = booking_total * (c.discount_value / 100);
    } else {
      discount = c.discount_value;
    }

    const final_total = Math.max(0, booking_total - discount);

    return `✓ Coupon '${code}' is valid!
- Discount: ${c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.currency} ${c.discount_value}`}
- Original Total: ${c.currency || 'GHS'} ${booking_total.toFixed(2)}
- Discount Amount: ${c.currency || 'GHS'} ${discount.toFixed(2)}
- Final Total: ${c.currency || 'GHS'} ${final_total.toFixed(2)}
- Uses Remaining: ${c.max_uses ? `${c.max_uses - (c.current_uses || 0)}` : 'Unlimited'}`;
  },
});

// ============================================================================
// RESERVATIONS TOOLS
// ============================================================================

export const searchReservationsTool = tool({
  name: "search_reservations",
  description: "Search for reservations by guest name, email, confirmation code, status, or date range. Use start_date/end_date to find reservations in a specific period (e.g., 'February reservations' → start_date=2026-02-01, end_date=2026-02-28). Overlap detection: any reservation whose stay overlaps the date range will be included.",
  schema: z.object({
    query: z.string().optional().describe("Search term - guest name, email, or confirmation code"),
    status: z.string().optional().describe("Filter by status (e.g., 'confirmed', 'cancelled', 'checked-in', 'checked-out', 'completed')"),
    start_date: z.string().optional().describe("Start of date range (YYYY-MM-DD). Finds reservations whose stay overlaps this range."),
    end_date: z.string().optional().describe("End of date range (YYYY-MM-DD). Finds reservations whose stay overlaps this range."),
    limit: z.number().default(20).describe("Maximum number of results"),
  }),
  async func({ query, status, start_date, end_date, limit }) {
    let dbQuery = supabase
      .from("reservations")
      .select(`
        id,
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        check_in,
        check_out,
        nights,
        status,
        total,
        currency,
        room_types (name, code)
      `)
      .order("check_in", { ascending: true })
      .limit(limit);

    // Date range filter — overlap detection (check_in <= end AND check_out >= start)
    if (start_date) {
      dbQuery = dbQuery.gte("check_out", start_date);
    }
    if (end_date) {
      dbQuery = dbQuery.lte("check_in", end_date);
    }

    if (query) {
      if (query.includes(' ')) {
        const parts = query.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
        dbQuery = dbQuery.or(`and(guest_first_name.ilike.%${firstName}%,guest_last_name.ilike.%${lastName}%),guest_email.ilike.%${query}%,confirmation_code.ilike.%${query}%`);
      } else {
        dbQuery = dbQuery.or(`guest_first_name.ilike.%${query}%,guest_last_name.ilike.%${query}%,guest_email.ilike.%${query}%,confirmation_code.ilike.%${query}%`);
      }
    }

    if (status) {
      dbQuery = dbQuery.eq("status", status.toLowerCase());
    }

    const { data, error } = await dbQuery;

    if (error) return `Error: ${error.message}`;
    if (!data?.length) {
      const period = start_date || end_date ? ` for ${start_date || '...'} to ${end_date || '...'}` : '';
      return `No reservations found${period}${query ? ` matching "${query}"` : ''}${status ? ` with status "${status}"` : ''}.`;
    }

    return `Found ${data.length} reservation(s):\n\n` + formatTable(
      data.map(r => ({
        Code: r.confirmation_code,
        Guest: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
        Room: r.room_types?.name || 'N/A',
        "Check-in": formatDate(r.check_in),
        "Check-out": formatDate(r.check_out),
        Nights: r.nights || '–',
        Status: r.status,
        Total: `${r.currency || 'GHS'} ${r.total || 0}`,
      })),
      { minWidth: "480px" }
    );
  },
});

export const getReservationDetailsTool = tool({
  name: "get_reservation_details",
  description: "Get full details of a specific reservation by confirmation code, group reservation code (GRP-XXXXXX), or ID.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code, group reservation code (GRP-XXXXXX), or reservation ID")
  }),
  async func({ identifier }) {
    const code = identifier.toUpperCase();
    const isGroupCode = code.startsWith('GRP-');

    if (isGroupCode) {
      // Fetch all reservations in the group
      const { data, error } = await supabase.from("reservations").select(`
        *,
        room_types (name, code),
        packages (name)
      `)
        .eq("group_reservation_code", code)
        .order("created_at", { ascending: true });

      if (error) return `Error: ${error.message}`;
      if (!data?.length) return `Group booking '${code}' not found.`;

      const first = data[0];
      let response = `**Group Booking ${code}** (${data.length} rooms)\n\n`;
      response += `**Guest Information:**\n`;
      response += `- Name: ${first.guest_first_name || ''} ${first.guest_last_name || ''}\n`;
      response += `- Email: ${first.guest_email}\n`;
      response += `- Phone: ${first.guest_phone || 'N/A'}\n`;
      response += `- Check-in: ${formatDate(first.check_in)}\n`;
      response += `- Check-out: ${formatDate(first.check_out)}\n\n`;

      let groupTotal = 0;
      let groupDiscount = 0;

      data.forEach((r, i) => {
        groupTotal += (r.total || 0);
        groupDiscount += (r.discount_amount || 0);
        response += `**Room ${i + 1}: ${r.room_types?.name || 'N/A'} (${r.room_types?.code || ''})**\n`;
        response += `- Confirmation Code: ${r.confirmation_code}\n`;
        response += `- Adults: ${r.adults || 1} | Children: ${r.children || 0}\n`;
        response += `- Room Subtotal: ${r.currency || 'GHS'} ${r.room_subtotal || 0}\n`;
        response += `- Extras: ${r.currency || 'GHS'} ${r.extras_total || 0}\n`;
        response += `- Discount: ${r.currency || 'GHS'} ${r.discount_amount || 0} (Room: ${r.room_discount || 0}, Extras: ${r.extras_discount || 0})\n`;
        response += `- Total: ${r.currency || 'GHS'} ${r.total || 0}\n`;
        response += `- Status: ${r.status} | Payment: ${r.payment_status || 'unpaid'}\n\n`;
      });

      response += `**Group Totals:**\n`;
      response += `- Total Discount: ${first.currency || 'GHS'} ${groupDiscount}\n`;
      response += `- Grand Total: ${first.currency || 'GHS'} ${groupTotal}\n`;
      if (first.notes) response += `- Special Requests: ${first.notes}\n`;

      return response;
    }

    // Single reservation lookup
    let query = supabase.from("reservations").select(`
      *,
      room_types (name, code),
      packages (name)
    `);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("confirmation_code", code);
    }

    const { data, error } = await query.single();

    if (error) return `Error: ${error.message}`;
    if (!data) return `Reservation '${identifier}' not found.`;

    const r = data;

    return `
**Reservation ${r.confirmation_code}**${r.group_reservation_code ? ` (Group: ${r.group_reservation_code})` : ''}

**Guest Information:**
- Name: ${r.guest_first_name || ''} ${r.guest_last_name || ''}
- Email: ${r.guest_email}
- Phone: ${r.guest_phone || 'N/A'}
- Adults: ${r.adults || 1}
- Children: ${r.children || 0}

**Booking Details:**
- Room: ${r.room_types?.name || 'N/A'} (${r.room_types?.code || ''})
- Package: ${r.packages?.name || 'Custom booking'}
- Check-in: ${formatDate(r.check_in)}
- Check-out: ${formatDate(r.check_out)}
- Status: ${r.status}

**Pricing:**
- Room Subtotal: ${r.currency || 'GHS'} ${r.room_subtotal || 0}
- Extras Subtotal: ${r.currency || 'GHS'} ${r.extras_total || 0}
- Discount: ${r.currency || 'GHS'} ${r.discount_amount || 0} (Room: ${r.room_discount || 0}, Extras: ${r.extras_discount || 0})
- Total: ${r.currency || 'GHS'} ${r.total || 0}

**Other:**
- Special Requests: ${r.notes || 'None'}
- Is Influencer: ${r.is_influencer ? 'Yes' : 'No'}
- Created: ${formatDate(r.created_at)}
- Reservation ID: ${r.id}
`;
  },
});

export const getTodayCheckInsTool = tool({
  name: "get_today_checkins",
  description: "Get all reservations checking in today.",
  schema: z.object({}),
  async func(_input) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("reservations")
      .select(`
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        adults,
        room_types (name, code)
      `)
      .eq("check_in", today)
      .in("status", ["confirmed", "checked-in"])
      .order("guest_first_name", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No check-ins scheduled for today.";

    return formatTable(
      data.map(r => ({
        Code: r.confirmation_code,
        Guest: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
        Email: r.guest_email,
        Phone: r.guest_phone || 'N/A',
        Room: r.room_types?.name || 'N/A',
        Adults: r.adults || 1,
      })),
      { minWidth: "480px" }
    );
  },
});

export const getTodayCheckOutsTool = tool({
  name: "get_today_checkouts",
  description: "Get all reservations checking out today.",
  schema: z.object({}),
  async func(_input) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("reservations")
      .select(`
        confirmation_code,
        guest_first_name,
        guest_last_name,
        guest_email,
        room_types (name, code)
      `)
      .eq("check_out", today)
      .in("status", ["confirmed", "checked-in"])
      .order("guest_first_name", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No check-outs scheduled for today.";

    return formatTable(
      data.map(r => ({
        Code: r.confirmation_code,
        Guest: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
        Email: r.guest_email,
        Room: r.room_types?.name || 'N/A',
      })),
      { minWidth: "500px" }
    );
  },
});

export const checkAvailabilityTool = tool({
  name: "check_availability",
  description: "Check if a room type is available for specific dates.",
  schema: z.object({
    room_code: z.string().describe("Room code (e.g., 'SAND')"),
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
  }),
  async func({ room_code, check_in, check_out }) {
    // Get room type ID
    const { data: room } = await supabase
      .from("room_types")
      .select("id, name")
      .eq("code", room_code.toUpperCase())
      .single();

    if (!room) return `Room '${room_code}' not found.`;

    // Check for conflicting reservations
    const { data: conflicts, error } = await supabase
      .from("reservations")
      .select("confirmation_code, check_in, check_out, status")
      .eq("room_type_id", room.id)
      .in("status", ["confirmed", "checked-in"])
      .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`);

    if (error) return `Error checking availability: ${error.message}`;

    if (!conflicts?.length) {
      // Room is available — calculate dynamic price (matching custom_booking.js — pass null for active model)
      const ciDate = new Date(check_in + 'T00:00:00');
      const coDate = new Date(check_out + 'T00:00:00');
      const nightsCount = Math.round((coDate - ciDate) / (1000 * 60 * 60 * 24));
      let dynamicTotal = 0;

      try {
        const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
          p_room_type_id: room.id,
          p_check_in: check_in,
          p_check_out: check_out,
          p_pricing_model_id: null
        });
        if (!pricingError && pricingData && pricingData.total) {
          dynamicTotal = parseFloat(pricingData.total);
        }
      } catch (e) { /* fallback below */ }

      // Fallback to base prices if dynamic pricing failed
      if (dynamicTotal === 0) {
        const { data: roomFull } = await supabase.from("room_types")
          .select("base_price_per_night_weekday, base_price_per_night_weekend, currency")
          .eq("id", room.id).single();
        if (roomFull) {
          const wkdPrice = Number(roomFull.base_price_per_night_weekday || 0);
          const wkePrice = Number(roomFull.base_price_per_night_weekend || 0);
          for (let d = new Date(ciDate); d < coDate; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            dynamicTotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
          }
        }
      }

      const perNight = nightsCount > 0 ? dynamicTotal / nightsCount : 0;
      return `✓ Room '${room.name}' (${room_code}) is AVAILABLE for ${formatDate(check_in)} to ${formatDate(check_out)}
- **${nightsCount} nights** — Total: **GHS ${dynamicTotal.toFixed(2)}** (avg GHS ${perNight.toFixed(2)}/night)
*Price calculated using the active dynamic pricing model.*`;
    }

    return `✗ Room '${room.name}' (${room_code}) is NOT available for ${formatDate(check_in)} to ${formatDate(check_out)}

**Conflicting Reservations:**
${conflicts.map(c => `- ${c.confirmation_code}: ${formatDate(c.check_in)} to ${formatDate(c.check_out)} (${c.status})`).join('\n')}`;
  },
});

export const checkAllAvailabilityTool = tool({
  name: "check_all_availability",
  description: "Check availability of ALL rooms for specific dates. Returns which rooms are available and which are booked. Use this when the user wants to book but hasn't specified a room.",
  schema: z.object({
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
  }),
  async func({ check_in, check_out }) {
    // Get all active room types
    const { data: rooms, error: roomErr } = await supabase
      .from("room_types")
      .select("id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, max_adults, currency")
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (roomErr) return `Error: ${roomErr.message}`;
    if (!rooms?.length) return "No active rooms found.";

    // Get all conflicting reservations for all rooms at once
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("room_type_id, confirmation_code, check_in, check_out")
      .in("room_type_id", rooms.map(r => r.id))
      .in("status", ["confirmed", "checked-in"])
      .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`);

    // Get blocked dates for all rooms
    const { data: blocked } = await supabase
      .from("blocked_dates")
      .select("room_type_id, blocked_date")
      .in("room_type_id", rooms.map(r => r.id))
      .gte("blocked_date", check_in)
      .lt("blocked_date", check_out);

    const conflictsByRoom = {};
    (conflicts || []).forEach(c => {
      if (!conflictsByRoom[c.room_type_id]) conflictsByRoom[c.room_type_id] = [];
      conflictsByRoom[c.room_type_id].push(c);
    });

    const blockedByRoom = {};
    (blocked || []).forEach(b => {
      if (!blockedByRoom[b.room_type_id]) blockedByRoom[b.room_type_id] = [];
      blockedByRoom[b.room_type_id].push(b.blocked_date);
    });

    const available = [];
    const unavailable = [];

    // Calculate nights for display
    const ciDate = new Date(check_in + 'T00:00:00');
    const coDate = new Date(check_out + 'T00:00:00');
    const nightsCount = Math.round((coDate - ciDate) / (1000 * 60 * 60 * 24));

    for (const room of rooms) {
      const roomConflicts = conflictsByRoom[room.id] || [];
      const roomBlocked = blockedByRoom[room.id] || [];
      const currency = room.currency || 'GHS';

      if (roomConflicts.length === 0 && roomBlocked.length === 0) {
        // Calculate dynamic price for this room (matching custom_booking.js — pass null for active model)
        let dynamicTotal = 0;
        let perNight = 0;
        try {
          const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
            p_room_type_id: room.id,
            p_check_in: check_in,
            p_check_out: check_out,
            p_pricing_model_id: null
          });
          if (!pricingError && pricingData && pricingData.total) {
            dynamicTotal = parseFloat(pricingData.total);
            perNight = nightsCount > 0 ? dynamicTotal / nightsCount : 0;
          }
        } catch (e) { /* fallback below */ }

        // Fallback to base prices if dynamic pricing failed
        if (dynamicTotal === 0) {
          const wkdPrice = Number(room.base_price_per_night_weekday || 0);
          const wkePrice = Number(room.base_price_per_night_weekend || 0);
          for (let d = new Date(ciDate); d < coDate; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            dynamicTotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
          }
          perNight = nightsCount > 0 ? dynamicTotal / nightsCount : 0;
        }

        available.push({
          Code: room.code,
          Name: room.name,
          "Total": `${currency} ${dynamicTotal.toFixed(2)}`,
          "Avg/Night": `${currency} ${perNight.toFixed(2)}`,
          Nights: nightsCount,
          "Max Adults": room.max_adults || 2,
        });
      } else {
        const reason = roomConflicts.length > 0
          ? `Booked (${roomConflicts[0].confirmation_code})`
          : `Blocked dates`;
        unavailable.push({ code: room.code, name: room.name, reason });
      }
    }

    let result = `**Availability for ${formatDate(check_in)} to ${formatDate(check_out)} (${nightsCount} nights):**\n\n`;

    if (available.length > 0) {
      result += `**✓ Available Rooms (${available.length}):**\n`;
      result += formatTable(available, { minWidth: "400px" });
      result += `\n*Prices shown use the active dynamic pricing model.*\n`;
    } else {
      result += `✗ No rooms available for these dates.\n`;
    }

    if (unavailable.length > 0) {
      result += `\n**✗ Unavailable:**\n`;
      unavailable.forEach(u => {
        result += `- ${u.name} (${u.code}) — ${u.reason}\n`;
      });
    }

    return result;
  },
});

// ============================================================================
// CREATE RESERVATION TOOL
// ============================================================================

export const createReservationTool = tool({
  name: "create_reservation",
  description: "Create a new reservation. MUST check availability first using check_availability. Requires: room_code, check_in, check_out, guest_first_name, guest_last_name, guest_email. Optional: guest_phone, adults, children, notes, extras, coupon_code, price_override_per_night. Uses the active pricing model by default; pass price_override_per_night to override.",
  schema: z.object({
    room_code: z.string().describe("Room code as found in the room_types table"),
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
    guest_first_name: z.string().describe("Guest first name"),
    guest_last_name: z.string().describe("Guest last name"),
    guest_email: z.string().describe("Guest email address"),
    guest_phone: z.string().optional().describe("Guest phone number"),
    country_code: z.string().optional().describe("Country dialling code (e.g., '+233')"),
    adults: z.number().default(2).describe("Number of adults (default 2)"),
    children: z.number().default(0).describe("Number of children"),
    notes: z.string().optional().describe("Special requests or notes"),
    extras: z.string().optional().describe("JSON array of extras by name and quantity, e.g. [{\"name\": \"Airport Transfer\", \"quantity\": 1}, {\"name\": \"Breakfast\", \"quantity\": 2}]"),
    coupon_code: z.string().optional().describe("Coupon code to apply"),
    price_override_per_night: z.number().optional().describe("Manual price override per night in GHS. If provided, bypasses dynamic pricing and uses this flat rate per night instead."),
  }),
  async func(input) {
    const { room_code, check_in, check_out, guest_first_name, guest_last_name,
            guest_email, guest_phone, country_code, adults, children, notes,
            extras, coupon_code, price_override_per_night } = input;

    // --- Validate dates ---
    const ci = new Date(check_in + 'T00:00:00');
    const co = new Date(check_out + 'T00:00:00');
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) return "✗ Invalid date format. Use YYYY-MM-DD.";
    if (co <= ci) return "✗ Check-out date must be after check-in date.";

    const msPerDay = 1000 * 60 * 60 * 24;
    const nightsCount = Math.round((co - ci) / msPerDay);

    // --- Get room type ---
    const { data: room, error: roomErr } = await supabase
      .from("room_types")
      .select("id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency, max_adults")
      .eq("code", room_code.toUpperCase())
      .single();

    if (roomErr || !room) return `✗ Room '${room_code}' not found.`;

    // --- Check capacity ---
    if (adults > (room.max_adults || 4)) {
      return `✗ ${room.name} supports max ${room.max_adults || 4} adults. You specified ${adults}.`;
    }

    // --- Availability check ---
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("confirmation_code, check_in, check_out")
      .eq("room_type_id", room.id)
      .in("status", ["confirmed", "checked-in"])
      .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`);

    if (conflicts?.length) {
      return `✗ ${room.name} is NOT available for ${formatDate(check_in)} – ${formatDate(check_out)}. Conflicting booking: ${conflicts[0].confirmation_code} (${formatDate(conflicts[0].check_in)} – ${formatDate(conflicts[0].check_out)}).`;
    }

    // --- Check blocked dates ---
    const { data: blocked } = await supabase
      .from("blocked_dates")
      .select("blocked_date")
      .eq("room_type_id", room.id)
      .gte("blocked_date", check_in)
      .lt("blocked_date", check_out);

    if (blocked?.length) {
      return `✗ ${room.name} has blocked dates in that range (${blocked.map(b => formatDate(b.blocked_date)).join(', ')}). Cannot book.`;
    }

    // --- Calculate pricing (manual override or active pricing model) ---
    let roomSubtotal = 0;

    if (price_override_per_night !== undefined && price_override_per_night > 0) {
      // Manual price override — flat rate per night (matching custom_booking.js)
      roomSubtotal = price_override_per_night * nightsCount;
      console.log('💰 [createReservation] Using manual price override:', price_override_per_night, '× ', nightsCount, 'nights =', roomSubtotal);
    } else {
      // Use dynamic pricing RPC with null model ID — lets the DB function use the active model
      // (matching custom_booking.js and edit reservation modal exactly)
      console.log('📊 [createReservation] Calling calculate_dynamic_price for room:', room.id, room.code, 'dates:', check_in, 'to', check_out, 'p_pricing_model_id: null');
      try {
        const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
          p_room_type_id: room.id,
          p_check_in: check_in,
          p_check_out: check_out,
          p_pricing_model_id: null
        });

        console.log('📊 [createReservation] Dynamic pricing response:', JSON.stringify(pricingData));
        console.log('📊 [createReservation] Dynamic pricing error:', pricingError);

        // Match custom_booking.js: pricingData.total != null (allows 0)
        if (!pricingError && pricingData && pricingData.total != null) {
          roomSubtotal = parseFloat(pricingData.total);
          console.log('✅ [createReservation] Using dynamic price:', roomSubtotal);
        } else {
          console.log('⚠ [createReservation] Dynamic pricing returned no usable total, will fallback to base prices');
        }
      } catch (e) {
        console.error('❌ [createReservation] Dynamic pricing RPC threw:', e.message);
      }

      // Fallback to base prices if dynamic pricing returned 0 or failed
      if (roomSubtotal === 0) {
        const wkdPrice = Number(room.base_price_per_night_weekday || 0);
        const wkePrice = Number(room.base_price_per_night_weekend || 0);
        console.log('⚠ [createReservation] Falling back to base prices: weekday=', wkdPrice, 'weekend=', wkePrice);
        for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          roomSubtotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
        }
        console.log('⚠ [createReservation] Base price total:', roomSubtotal);
      }
    }

    // --- Calculate extras ---
    let extrasTotal = 0;
    let selectedExtras = [];
    if (extras) {
      try {
        const extrasList = typeof extras === 'string' ? JSON.parse(extras) : extras;
        for (const item of extrasList) {
          let extra = null;

          // Look up by ID first, then by name
          if (item.extra_id) {
            const { data } = await supabase
              .from("extras")
              .select("id, name, code, price, currency, unit_type")
              .eq("id", item.extra_id)
              .single();
            extra = data;
          }

          if (!extra && item.name) {
            // Search by name (case-insensitive partial match)
            const { data } = await supabase
              .from("extras")
              .select("id, name, code, price, currency, unit_type")
              .ilike("name", `%${item.name}%`)
              .limit(1);
            extra = data?.[0] || null;
          }

          if (extra) {
            const qty = item.quantity || 1;
            extrasTotal += Number(extra.price || 0) * qty;
            selectedExtras.push({
              extra_id: extra.id,
              extra_code: extra.code || '',
              extra_name: extra.name || '',
              price: Number(extra.price || 0),
              quantity: qty,
              subtotal: Number(extra.price || 0) * qty,
              discount_amount: 0,
            });
          }
        }
      } catch (e) {
        // Invalid extras JSON, ignore
      }
    }

    // --- Apply coupon with proper discount allocation (matching custom_booking.js) ---
    let discountAmount = 0;
    let roomDiscount = 0;
    let extrasDiscount = 0;
    let appliedCouponCode = null;
    let extrasWithDiscounts = selectedExtras.map(e => ({ ...e, discount: 0 }));

    if (coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", coupon_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (coupon) {
        console.log('🎟️ [createReservation] Coupon found:', coupon.code, 'applies_to:', coupon.applies_to, 'discount_type:', coupon.discount_type, 'discount_value:', coupon.discount_value, 'extra_ids:', coupon.extra_ids);
        console.log('🎟️ [createReservation] roomSubtotal:', roomSubtotal, 'extrasTotal:', extrasTotal, 'selectedExtras count:', selectedExtras.length);

        const today = new Date().toISOString().split('T')[0];
        const isValid = (!coupon.valid_from || coupon.valid_from <= today) &&
                       (!coupon.valid_until || coupon.valid_until >= today) &&
                       (!coupon.max_uses || (coupon.current_uses || 0) < coupon.max_uses);

        if (isValid) {
          // Determine targeted extras (if coupon has extra_ids)
          let extrasTargetTotal = extrasTotal;
          let targetedExtras = selectedExtras;
          if (Array.isArray(coupon.extra_ids) && coupon.extra_ids.length) {
            const idSet = new Set(coupon.extra_ids.map(String));
            targetedExtras = selectedExtras.filter(e => idSet.has(String(e.extra_id)));
            extrasTargetTotal = targetedExtras.reduce((sum, e) => sum + e.price * e.quantity, 0);
            console.log('🎟️ [createReservation] Coupon targets specific extras. Targeted:', targetedExtras.length, 'of', selectedExtras.length, 'extrasTargetTotal:', extrasTargetTotal);
          }

          if (coupon.applies_to === 'both') {
            // Apply discount to both room and targeted extras (matching custom_booking.js)
            const base = roomSubtotal + extrasTargetTotal;
            const totalDiscount = coupon.discount_type === 'percentage'
              ? (base * coupon.discount_value) / 100
              : coupon.discount_value;

            // Proportionally split discount between room and extras
            if (base > 0) {
              const roomPortion = roomSubtotal / base;
              const extrasPortion = extrasTargetTotal / base;
              roomDiscount = totalDiscount * roomPortion;
              extrasDiscount = totalDiscount * extrasPortion;
            }
            console.log('🎟️ [createReservation] applies_to=both: base=', base, 'totalDiscount=', totalDiscount, 'roomDiscount=', roomDiscount, 'extrasDiscount=', extrasDiscount);
          } else if (coupon.applies_to === 'rooms') {
            // Apply discount only to rooms
            roomDiscount = coupon.discount_type === 'percentage'
              ? (roomSubtotal * coupon.discount_value) / 100
              : coupon.discount_value;
            extrasDiscount = 0;
            console.log('🎟️ [createReservation] applies_to=rooms: roomDiscount=', roomDiscount);
          } else if (coupon.applies_to === 'extras') {
            // Apply discount only to targeted extras
            roomDiscount = 0;
            extrasDiscount = coupon.discount_type === 'percentage'
              ? (extrasTargetTotal * coupon.discount_value) / 100
              : coupon.discount_value;
            console.log('🎟️ [createReservation] applies_to=extras: extrasDiscount=', extrasDiscount);
          } else {
            console.log('⚠ [createReservation] Unknown applies_to value:', coupon.applies_to, '— no discount split applied');
          }

          // Calculate per-extra discounts proportionally
          extrasWithDiscounts = selectedExtras.map(extra => {
            let extraDisc = 0;
            if (extrasDiscount > 0 && extrasTargetTotal > 0) {
              let isTargeted = true;
              if (Array.isArray(coupon.extra_ids) && coupon.extra_ids.length) {
                const idSet = new Set(coupon.extra_ids.map(String));
                isTargeted = idSet.has(String(extra.extra_id));
              }
              if (isTargeted && extra.quantity > 0) {
                const extraSub = extra.price * extra.quantity;
                extraDisc = (extraSub / extrasTargetTotal) * extrasDiscount;
              }
            }
            return { ...extra, discount: extraDisc };
          });

          discountAmount = roomDiscount + extrasDiscount;
          discountAmount = Math.min(discountAmount, roomSubtotal + extrasTotal);
          appliedCouponCode = coupon.code;
          console.log('🎟️ [createReservation] FINAL: discountAmount=', discountAmount, 'roomDiscount=', roomDiscount, 'extrasDiscount=', extrasDiscount);

          // Update coupon usage
          await supabase
            .from("coupons")
            .update({ current_uses: (coupon.current_uses || 0) + 1 })
            .eq("id", coupon.id);
        }
      }
    }

    const total = Math.max(0, roomSubtotal + extrasTotal - discountAmount);
    const currency = room.currency || 'GHS';

    // --- Generate confirmation code ---
    const confirmationCode = ('B' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)).toUpperCase();

    // --- Insert reservation ---
    const payload = {
      confirmation_code: confirmationCode,
      room_type_id: room.id,
      room_type_code: room.code,
      room_name: room.name,
      check_in,
      check_out,
      nights: nightsCount,
      guest_first_name: guest_first_name || null,
      guest_last_name: guest_last_name || null,
      guest_email: guest_email || null,
      guest_phone: guest_phone || null,
      country_code: country_code || null,
      adults: adults || 2,
      children: children || 0,
      room_subtotal: roomSubtotal,
      extras_total: extrasTotal,
      discount_amount: discountAmount,
      room_discount: roomDiscount,
      extras_discount: extrasDiscount,
      coupon_code: appliedCouponCode,
      total,
      currency,
      status: 'confirmed',
      payment_status: 'unpaid',
      is_influencer: false,
      notes: notes || null,
    };

    console.log('💾 [createReservation] Payload discount fields → discount_amount:', payload.discount_amount, 'room_discount:', payload.room_discount, 'extras_discount:', payload.extras_discount, 'total:', payload.total);

    const { data: reservation, error: insertErr } = await supabase
      .from("reservations")
      .insert(payload)
      .select()
      .single();

    if (insertErr) return `✗ Failed to create reservation: ${insertErr.message}`;

    // --- Insert extras with per-extra discount amounts ---
    if (extrasWithDiscounts.length > 0 && reservation) {
      const extrasPayload = extrasWithDiscounts
        .filter(e => e.quantity > 0)
        .map(e => ({
          reservation_id: reservation.id,
          extra_code: e.extra_code,
          extra_name: e.extra_name,
          price: e.price,
          quantity: e.quantity,
          subtotal: e.price * e.quantity,
          discount_amount: e.discount || 0,
        }));

      if (extrasPayload.length > 0) {
        await supabase.from("reservation_extras").insert(extrasPayload);
      }
    }

    // --- Return success ---
    let response = `✓ **Reservation Created Successfully!**

- **Confirmation Code**: ${confirmationCode}
- **Cabin**: ${room.name} (${room.code})
- **Guest**: ${guest_first_name} ${guest_last_name}
- **Email**: ${guest_email}
- **Check-in**: ${formatDate(check_in)}
- **Check-out**: ${formatDate(check_out)}
- **Nights**: ${nightsCount}
- **Adults**: ${adults || 2} | **Children**: ${children || 0}
- **Room Cost**: ${currency} ${roomSubtotal.toFixed(2)}`;

    if (selectedExtras.length > 0) {
      response += `\n- **Extras** (${currency} ${extrasTotal.toFixed(2)}):`;
      selectedExtras.forEach(e => {
        response += `\n  - ${e.extra_name} × ${e.quantity} = ${currency} ${e.subtotal.toFixed(2)}`;
      });
    }
    if (discountAmount > 0) {
      response += `\n- **Discount** (${appliedCouponCode}): -${currency} ${discountAmount.toFixed(2)}`;
    }

    response += `\n- **Total**: ${currency} ${total.toFixed(2)}`;
    response += `\n- **Status**: Confirmed | **Payment**: Unpaid`;

    if (notes) response += `\n- **Notes**: ${notes}`;

    return response;
  },
});

// ============================================================================
// EMAIL TOOLS
// ============================================================================

const SOJOURN_API_BASE_URL = 'https://sojourn-cabins.vercel.app';

export const sendBookingEmailTool = tool({
  name: "send_booking_email",
  description: "Send booking emails to the guest. Supports both single reservations and group bookings (GRP-XXXXXX codes). Can send: 'confirmation' (booking confirmation), 'extras' (extras selection email), or 'both'. Defaults to 'both'.",
  schema: z.object({
    confirmation_code: z.string().describe("The reservation confirmation code OR group reservation code (GRP-XXXXXX)"),
    email_type: z.enum(["confirmation", "extras", "both"]).default("both").describe("Which email to send: 'confirmation', 'extras', or 'both' (default)"),
  }),
  async func({ confirmation_code, email_type = "both" }) {
    const code = confirmation_code.toUpperCase();
    const isGroupCode = code.startsWith('GRP-');

    // --- Fetch reservation(s) ---
    let reservations = [];
    if (isGroupCode) {
      // Group booking: fetch all reservations with this group code
      const { data, error } = await supabase
        .from("reservations")
        .select("*, room_types(name, code)")
        .eq("group_reservation_code", code)
        .order("created_at", { ascending: true });
      if (error || !data?.length) return `✗ No reservations found for group code '${code}'.`;
      reservations = data;
    } else {
      // Single reservation
      const { data, error } = await supabase
        .from("reservations")
        .select("*, room_types(name, code)")
        .eq("confirmation_code", code)
        .single();
      if (error || !data) return `✗ Reservation '${code}' not found.`;
      reservations = [data];
    }

    const primaryRes = reservations[0];
    if (!primaryRes.guest_email) return `✗ No email address on file for reservation ${code}.`;

    const isGroupBooking = reservations.length > 1;
    const isPackage = !!(primaryRes.package_id || primaryRes.package_code || primaryRes.package_name);
    const currency = primaryRes.currency || 'GHS';

    // --- Fetch extras config for all extras across all reservations ---
    const allResIds = reservations.map(r => r.id);
    const { data: allResExtras } = await supabase
      .from("reservation_extras")
      .select("reservation_id, extra_name, extra_code, price, quantity, subtotal, discount_amount")
      .in("reservation_id", allResIds);

    // Build config map by BOTH code AND name for reliable lookup
    // (some extras may have empty/null codes in reservation_extras)
    const allExtraCodes = (allResExtras || []).map(e => e.extra_code).filter(Boolean);
    const allExtraNames = (allResExtras || []).map(e => e.extra_name).filter(Boolean);
    let extrasConfigByCode = {};
    let extrasConfigByName = {};

    // Fetch all extras that match either by code or name
    const uniqueCodes = [...new Set(allExtraCodes)];
    const uniqueNames = [...new Set(allExtraNames)];

    if (uniqueCodes.length || uniqueNames.length) {
      // Fetch by code
      if (uniqueCodes.length) {
        const { data: byCode } = await supabase
          .from("extras")
          .select("code, name, needs_guest_input")
          .in("code", uniqueCodes);
        (byCode || []).forEach(e => {
          extrasConfigByCode[e.code] = { name: e.name, needs_guest_input: !!e.needs_guest_input };
        });
      }
      // Fetch by name (for extras with missing codes)
      if (uniqueNames.length) {
        const { data: byName } = await supabase
          .from("extras")
          .select("code, name, needs_guest_input")
          .in("name", uniqueNames);
        (byName || []).forEach(e => {
          extrasConfigByName[e.name] = { name: e.name, needs_guest_input: !!e.needs_guest_input };
        });
      }
    }

    // --- Build rooms array and aggregate totals ---
    let aggregateRoomSubtotal = 0;
    let aggregateExtrasTotal = 0;
    let aggregateDiscountTotal = 0;
    let aggregateTotal = 0;
    let allExtrasFlat = [];

    const roomsForEmail = reservations.map(res => {
      aggregateRoomSubtotal += res.room_subtotal || 0;
      aggregateExtrasTotal += res.extras_total || 0;
      aggregateDiscountTotal += res.discount_amount || 0;
      aggregateTotal += res.total || 0;

      const roomExtras = (allResExtras || [])
        .filter(e => e.reservation_id === res.id)
        .map(e => {
          // Look up config by code first, then by name as fallback
          const config = (e.extra_code && extrasConfigByCode[e.extra_code])
            || (e.extra_name && extrasConfigByName[e.extra_name])
            || {};
          const extraName = e.extra_name || config.name || '';
          const mapped = {
            code: e.extra_code,
            name: extraName,
            extra_name: extraName,
            extra_code: e.extra_code,
            price: e.price,
            qty: e.quantity,
            quantity: e.quantity,
            subtotal: e.subtotal,
            discount_amount: e.discount_amount || 0,
            needs_selection: isPackage || config.needs_guest_input === true,
          };
          allExtrasFlat.push(mapped);
          return mapped;
        });

      return {
        room_name: res.room_name || res.room_types?.name || '',
        room_code: res.room_type_code || res.room_types?.code || '',
        check_in: res.check_in,
        check_out: res.check_out,
        nights: res.nights,
        adults: res.adults,
        room_subtotal: res.room_subtotal,
        extras_total: res.extras_total,
        discount_amount: res.discount_amount,
        total: res.total,
        currency: res.currency || 'GHS',
        extras: roomExtras,
      };
    });

    // --- Display confirmation code: group code for groups, normal code for singles ---
    const displayCode = isGroupBooking ? code : primaryRes.confirmation_code;

    // --- Build email data matching the webhook structure (same as custom_booking.js) ---
    const emailData = {
      booking: {
        confirmation_code: displayCode,
        group_reservation_code: isGroupBooking ? code : null,
        guest_first_name: primaryRes.guest_first_name,
        guest_last_name: primaryRes.guest_last_name,
        guest_email: primaryRes.guest_email,
        guest_phone: primaryRes.guest_phone,
        check_in: primaryRes.check_in,
        check_out: primaryRes.check_out,
        nights: primaryRes.nights,
        adults: primaryRes.adults,
        currency,
        room_name: primaryRes.room_name || primaryRes.room_types?.name || '',
        room_subtotal: primaryRes.room_subtotal,
        extras_total: primaryRes.extras_total,
        discount_amount: primaryRes.discount_amount,
        coupon_code: primaryRes.coupon_code,
        total: primaryRes.total,
        is_group_booking: isGroupBooking,
        group_room_subtotal: aggregateRoomSubtotal,
        group_extras_total: aggregateExtrasTotal,
        group_discount_total: aggregateDiscountTotal,
        group_total: aggregateTotal,
        rooms: roomsForEmail,
        package_code: primaryRes.package_code || null,
        package_name: primaryRes.package_name || null,
      },
    };

    const results = [];
    const hasExtrasNeedingSelection = allExtrasFlat.some(e => e.needs_selection);

    // --- Send confirmation email ---
    if (email_type === "confirmation" || email_type === "both") {
      try {
        const emailResp = await fetch(`${SOJOURN_API_BASE_URL}/api/send-booking-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData),
        });

        if (!emailResp.ok) {
          const errText = await emailResp.text().catch(() => '');
          results.push(`✗ Failed to send confirmation email (${emailResp.status}): ${errText}`);
        } else {
          results.push(`✓ Confirmation email sent to ${primaryRes.guest_email} for booking ${displayCode}.`);
        }
      } catch (err) {
        results.push(`✗ Failed to send confirmation email: ${err.message}`);
      }
    }

    // --- Send extras selection email ---
    if (email_type === "extras" || email_type === "both") {
      const hasExtras = allExtrasFlat.length > 0;
      const shouldSendExtras = email_type === "extras" ? hasExtras : hasExtrasNeedingSelection;

      if (!hasExtras && email_type === "extras") {
        results.push(`⚠ No extras found on this booking.`);
      } else if (shouldSendExtras) {
        try {
          // Use the primary reservation's confirmation code for the extras link
          const primaryCode = primaryRes.confirmation_code;
          const extrasLink = `${SOJOURN_API_BASE_URL}/extra-selections?code=${encodeURIComponent(primaryCode)}`;
          const extrasResp = await fetch(`${SOJOURN_API_BASE_URL}/api/send-extra-selections-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking: emailData.booking, extrasLink }),
          });

          if (!extrasResp.ok) {
            const errText = await extrasResp.text().catch(() => '');
            results.push(`✗ Failed to send extras selection email (${extrasResp.status}): ${errText}`);
          } else {
            results.push(`✓ Extras selection email sent to ${primaryRes.guest_email}.`);
          }
        } catch (err) {
          results.push(`✗ Failed to send extras selection email: ${err.message}`);
        }
      }
    }

    return results.length > 0 ? results.join('\n') : `✓ Email operation completed for ${displayCode}.`;
  },
});

// ============================================================================
// ANALYTICS TOOLS
// ============================================================================

export const getOccupancyStatsTool = tool({
  name: "get_occupancy_stats",
  description: "Get occupancy statistics for a date range. Returns overall and per-room occupancy percentages.",
  schema: z.object({
    // Allow the agent to call this without dates; we will default to the current month.
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD). If omitted, defaults to the first day of the current month."),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD). If omitted, defaults to the first day of next month."),
    room_code: z.string().optional().describe("Optional: specific room code to filter by"),
  }),
  async func({ start_date, end_date, room_code }) {
    // Defaults: current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month

    const startStr = start_date || defaultStart.toISOString().split('T')[0];
    const endStr = end_date || defaultEnd.toISOString().split('T')[0];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    const NUM_CABINS = 3;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysInPeriod = Math.ceil((end - start) / msPerDay) + 1;

    // Get all room types or specific room
    let roomQuery = supabase.from("room_types").select("id, code, name");
    if (room_code) roomQuery = roomQuery.eq("code", room_code.toUpperCase());
    const { data: rooms } = await roomQuery;
    if (!rooms?.length) return `No rooms found${room_code ? ` with code ${room_code}` : ''}.`;

    // Fetch reservations that OVERLAP with the period (same logic as analytics dashboard)
    const { data: reservations } = await supabase
      .from("reservations")
      .select("check_in, check_out, room_type_id")
      .lte("check_in", endStr)
      .gte("check_out", startStr)
      .in("status", ["confirmed", "completed", "checked-in", "checked-out"]);

    // Fetch blocked dates
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("blocked_date, room_type_id")
      .gte("blocked_date", startStr)
      .lte("blocked_date", endStr);

    const blockedNights = (blockedDates || []).length;
    const theoreticalCapacity = daysInPeriod * NUM_CABINS;
    const availableNights = theoreticalCapacity - blockedNights;

    let results = [];

    for (const room of rooms) {
      const roomReservations = (reservations || []).filter(r => r.room_type_id === room.id);
      let occupiedNights = 0;

      roomReservations.forEach(r => {
        if (!r.check_in || !r.check_out) return;
        const ci = new Date(r.check_in + 'T00:00:00');
        const co = new Date(r.check_out + 'T00:00:00');
        // Clip to period boundaries
        const overlapStart = new Date(Math.max(ci.getTime(), start.getTime()));
        const overlapEnd = new Date(Math.min(co.getTime(), end.getTime() + msPerDay));
        const nights = Math.max(0, (overlapEnd - overlapStart) / msPerDay);
        occupiedNights += nights;
      });

      occupiedNights = Math.round(occupiedNights);
      const roomAvail = daysInPeriod;
      const occupancyRate = roomAvail > 0 ? (occupiedNights / roomAvail) * 100 : 0;

      results.push({
        Room: `${room.name} (${room.code})`,
        "Occupied Nights": occupiedNights,
        "Available Nights": roomAvail,
        "Occupancy %": occupancyRate.toFixed(1) + "%",
      });
    }

    if (results.length === 0) return "No data available for the specified period.";

    // Overall summary
    const totalOccupied = results.reduce((sum, r) => sum + r["Occupied Nights"], 0);
    const overallRate = availableNights > 0 ? (totalOccupied / availableNights) * 100 : 0;
    const alos = (reservations || []).length > 0 ? totalOccupied / (reservations || []).length : 0;

    if (results.length > 1) {
      results.push({
        Room: "**OVERALL**",
        "Occupied Nights": totalOccupied,
        "Available Nights": availableNights,
        "Occupancy %": overallRate.toFixed(1) + "%",
      });
    }

    return `**Occupancy Report: ${formatDate(startStr)} – ${formatDate(endStr)}**
- Bookings in period: ${(reservations || []).length}
- Blocked nights: ${blockedNights}
- ALOS: ${alos.toFixed(1)} nights

${formatTable(results, { minWidth: "500px" })}`;
  },
});

export const getRevenueStatsTool = tool({
  name: "get_revenue_stats",
  description: "Get revenue statistics for a date range, broken down by source (rooms, extras, packages).",
  schema: z.object({
    start_date: z.string().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().describe("End date (YYYY-MM-DD)"),
  }),
  async func({ start_date, end_date }) {
    // Defaults: current month
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startStr = start_date || defaultStart.toISOString().split('T')[0];
    const endStr = end_date || defaultEnd.toISOString().split('T')[0];
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');

    // Overlap detection: reservations whose stay overlaps the period
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("room_subtotal, extras_total, discount_amount, total, currency, package_id, check_in, check_out")
      .lte("check_in", endStr)
      .gte("check_out", startStr)
      .in("status", ["confirmed", "completed", "checked-in", "checked-out"]);

    if (error) return `Error: ${error.message}`;
    if (!reservations?.length) return `No reservations found for ${formatDate(startStr)} – ${formatDate(endStr)}.`;

    // Fetch blocked dates for available nights
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("blocked_date")
      .gte("blocked_date", startStr)
      .lte("blocked_date", endStr);

    const NUM_CABINS = 3;
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysInPeriod = Math.ceil((end - start) / msPerDay) + 1;
    const blockedNights = (blockedDates || []).length;
    const availableNights = (daysInPeriod * NUM_CABINS) - blockedNights;

    let roomRevenue = 0, extrasRevenue = 0, totalDiscount = 0;
    let packageBookings = 0, customBookings = 0;
    let occupiedNights = 0;
    const currency = reservations[0]?.currency || "GHS";

    reservations.forEach(r => {
      roomRevenue += parseFloat(r.room_subtotal || 0);
      extrasRevenue += parseFloat(r.extras_total || 0);
      totalDiscount += parseFloat(r.discount_amount || 0);
      if (r.package_id) packageBookings++; else customBookings++;

      // Calculate occupied nights within period
      if (r.check_in && r.check_out) {
        const ci = new Date(r.check_in + 'T00:00:00');
        const co = new Date(r.check_out + 'T00:00:00');
        const overlapStart = new Date(Math.max(ci.getTime(), start.getTime()));
        const overlapEnd = new Date(Math.min(co.getTime(), end.getTime() + msPerDay));
        occupiedNights += Math.max(0, Math.ceil((overlapEnd - overlapStart) / msPerDay));
      }
    });

    const totalRevenue = roomRevenue + extrasRevenue - totalDiscount;
    const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;
    const adr = occupiedNights > 0 ? roomRevenue / occupiedNights : 0;
    const revPAR = availableNights > 0 ? roomRevenue / availableNights : 0;
    const trevpar = availableNights > 0 ? totalRevenue / availableNights : 0;

    return `**Revenue Report: ${formatDate(startStr)} – ${formatDate(endStr)}**

**Summary:**
- Total Revenue: ${currency} ${totalRevenue.toFixed(2)}
- Room Revenue: ${currency} ${roomRevenue.toFixed(2)}
- Extras Revenue: ${currency} ${extrasRevenue.toFixed(2)}
- Total Discounts: ${currency} ${totalDiscount.toFixed(2)}

**Bookings:**
- Total Bookings: ${reservations.length}
- Package Bookings: ${packageBookings}
- Custom Bookings: ${customBookings}
- Average Booking Value: ${currency} ${avgBookingValue.toFixed(2)}

**Performance Metrics:**
- ADR (Average Daily Rate): ${currency} ${adr.toFixed(2)}
- RevPAR: ${currency} ${revPAR.toFixed(2)}
- TRevPAR: ${currency} ${trevpar.toFixed(2)}
- Revenue Mix — Rooms: ${totalRevenue > 0 ? ((roomRevenue / totalRevenue) * 100).toFixed(1) : 0}% | Extras: ${totalRevenue > 0 ? ((extrasRevenue / totalRevenue) * 100).toFixed(1) : 0}%
`;
  },
});

export const getClientAnalyticsTool = tool({
  name: "get_client_analytics",
  description: "Get client/guest analytics including repeat guests, top spenders, and booking patterns.",
  schema: z.object({
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD) - optional"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD) - optional"),
    limit: z.number().default(10).describe("Number of top guests to return"),
  }),
  async func({ start_date, end_date, limit }) {
    let query = supabase
      .from("reservations")
      .select("guest_first_name, guest_last_name, guest_email, total, currency, check_in, check_out, created_at")
      .in("status", ["confirmed", "completed", "checked-in", "checked-out"]);

    // Overlap detection: check_in <= end AND check_out >= start
    if (start_date) query = query.gte("check_out", start_date);
    if (end_date) query = query.lte("check_in", end_date);

    const { data: reservations, error } = await query;

    if (error) return `Error: ${error.message}`;
    if (!reservations?.length) return "No guest data found.";

    // Aggregate by guest email
    const guestMap = {};
    
    reservations.forEach(r => {
      const email = r.guest_email?.toLowerCase();
      if (!email) return;

      if (!guestMap[email]) {
        guestMap[email] = {
          name: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
          bookings: 0,
          totalSpent: 0,
          currency: r.currency || "GHS",
        };
      }

      guestMap[email].bookings++;
      guestMap[email].totalSpent += parseFloat(r.total || 0);
    });

    // Convert to array and sort by total spent
    const guests = Object.entries(guestMap)
      .map(([email, data]) => ({
        Guest: data.name,
        Email: email,
        Bookings: data.bookings,
        "Total Spent": `${data.currency} ${data.totalSpent.toFixed(2)}`,
        "Avg per Booking": `${data.currency} ${(data.totalSpent / data.bookings).toFixed(2)}`,
        Type: data.bookings > 1 ? "Repeat" : "First-time",
      }))
      .sort((a, b) => {
        const aSpent = parseFloat(a["Total Spent"].split(' ')[1]);
        const bSpent = parseFloat(b["Total Spent"].split(' ')[1]);
        return bSpent - aSpent;
      })
      .slice(0, limit);

    const repeatGuests = Object.values(guestMap).filter(g => g.bookings > 1).length;
    const totalGuests = Object.keys(guestMap).length;

    return `**Client Analytics${start_date ? ` (${start_date} to ${end_date || 'now'})` : ''}**

**Overview:**
- Total Guests: ${totalGuests}
- Repeat Guests: ${repeatGuests} (${((repeatGuests / totalGuests) * 100).toFixed(1)}%)
- First-time Guests: ${totalGuests - repeatGuests}

**Top ${limit} Guests by Revenue:**

${formatTable(guests, { minWidth: "480px" })}
`;
  },
});

// ============================================================================
// PRICING MODEL TOOLS
// ============================================================================

export const listPricingModelsTool = tool({
  name: "list_pricing_models",
  description: "List all pricing models with their configuration and status.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("pricing_models")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No pricing models found.";

    return formatTable(
      data.map(m => ({
        Name: m.name,
        "History Mode": m.history_mode || "N/A",
        "Effective From": m.effective_from || "N/A",
        "Effective Until": m.effective_until || "Open-ended",
        Active: m.is_active ? "✓" : "✗",
      })),
      { minWidth: "480px" }
    );
  },
});

export const getPricingModelDetailsTool = tool({
  name: "get_pricing_model_details",
  description: "Get detailed configuration of a specific pricing model including tiers, rules, and curves.",
  schema: z.object({
    model_name: z.string().describe("Pricing model name or ID"),
  }),
  async func({ model_name }) {
    // Get model
    let query = supabase.from("pricing_models").select("*");
    
    if (model_name.length > 20 && model_name.includes('-')) {
      query = query.eq("id", model_name);
    } else {
      query = query.ilike("name", `%${model_name}%`);
    }

    const { data: models } = await query;
    
    if (!models?.length) return `Pricing model '${model_name}' not found.`;

    const model = models[0];

    // Get related configurations
    const { data: tiers } = await supabase
      .from("pricing_tier_templates")
      .select("*")
      .eq("pricing_model_id", model.id)
      .eq("is_active", true)
      .order("min_hist_occupancy");

    const { data: monthRules } = await supabase
      .from("pricing_model_month_rules")
      .select("*")
      .eq("pricing_model_id", model.id)
      .order("month");

    const { data: targets } = await supabase
      .from("pricing_targets")
      .select("*")
      .eq("pricing_model_id", model.id)
      .eq("is_active", true)
      .order("month");

    let response = `**${model.name}**

**Configuration:**
- Status: ${model.is_active ? 'Active ✓' : 'Inactive ✗'}
- History Mode: ${model.history_mode || 'N/A'}
- Effective: ${model.effective_from || 'N/A'} to ${model.effective_until || 'Open-ended'}
- Model ID: ${model.id}
`;

    if (tiers?.length) {
      response += `\n**Active Pricing Tiers:** (${tiers.length})\n`;
      tiers.forEach(t => {
        response += `- ${t.tier_name}: ${(t.min_hist_occupancy * 100).toFixed(0)}%-${(t.max_hist_occupancy * 100).toFixed(0)}% occupancy → ${t.multiplier}x multiplier\n`;
      });
    }

    if (monthRules?.length) {
      response += `\n**Month Rules:** (${monthRules.length} months configured)\n`;
      response += `Tier strengths and multiplier limits set for each month.\n`;
    }

    if (targets?.length) {
      response += `\n**Monthly Targets:** (${targets.length} targets set)\n`;
      response += `Revenue and occupancy targets configured for optimization.\n`;
    }

    return response;
  },
});

export const simulatePricingTool = tool({
  name: "simulate_dynamic_pricing",
  description: "Simulate dynamic pricing for a specific room and date range using a pricing model.",
  schema: z.object({
    room_code: z.string().describe("Room code (e.g., 'SAND')"),
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
    pricing_model: z.string().optional().describe("Pricing model name (uses active model if not specified)"),
  }),
  async func({ room_code, check_in, check_out, pricing_model }) {
    // Get room type
    const { data: room } = await supabase
      .from("room_types")
      .select("id, name, code, currency")
      .eq("code", room_code.toUpperCase())
      .single();

    if (!room) return `Room '${room_code}' not found.`;

    // Get pricing model
    let modelQuery = supabase.from("pricing_models").select("id, name");
    
    if (pricing_model) {
      modelQuery = modelQuery.ilike("name", `%${pricing_model}%`);
    } else {
      modelQuery = modelQuery.eq("is_active", true);
    }

    const { data: models } = await modelQuery;
    const model = models?.[0];

    if (!model) return `No ${pricing_model ? `'${pricing_model}'` : 'active'} pricing model found.`;

    // Call the calculate_dynamic_price function
    const { data, error } = await supabase.rpc("calculate_dynamic_price", {
      p_room_type_id: room.id,
      p_check_in: check_in,
      p_check_out: check_out,
      p_pricing_model_id: model.id,
    });

    if (error) return `Error calculating price: ${error.message}`;
    if (!data) return "No pricing data returned.";

    const nights = data.nights || 0;
    const total = data.total || 0;
    const currency = data.currency || room.currency || "GHS";
    const nightlyRates = data.nightly_rates || [];

    let response = `**Dynamic Pricing Simulation**

**Booking Details:**
- Room: ${room.name} (${room_code})
- Check-in: ${check_in}
- Check-out: ${check_out}
- Nights: ${nights}
- Pricing Model: ${model.name}

**Pricing:**
- Total: ${currency} ${total.toFixed(2)}
- Average per Night: ${currency} ${(total / nights).toFixed(2)}
`;

    if (nightlyRates.length > 0 && nightlyRates.length <= 7) {
      response += `\n**Nightly Breakdown:**\n`;
      nightlyRates.forEach((night, i) => {
        response += `- Night ${i + 1} (${night.date}): ${currency} ${night.rate?.toFixed(2) || '0.00'}\n`;
      });
    }

    return response;
  },
});

export const getSeasonalPricingTool = tool({
  name: "get_seasonal_pricing",
  description: "Get active seasonal pricing rules for a specific room or all rooms.",
  schema: z.object({
    room_code: z.string().optional().describe("Optional: specific room code"),
  }),
  async func({ room_code }) {
    let query = supabase
      .from("seasonal_pricing")
      .select(`
        *,
        room_types (name, code)
      `)
      .order("start_date");

    if (room_code) {
      const { data: room } = await supabase
        .from("room_types")
        .select("id")
        .eq("code", room_code.toUpperCase())
        .single();

      if (!room) return `Room '${room_code}' not found.`;
      query = query.eq("room_type_id", room.id);
    }

    const { data, error } = await query;

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return `No seasonal pricing found${room_code ? ` for ${room_code}` : ''}.`;

    return formatTable(
      data.map(sp => ({
        Room: sp.room_types?.name || 'N/A',
        "Start Date": sp.start_date,
        "End Date": sp.end_date,
        "Price per Night": `GHS ${sp.price_per_night}`,
      })),
      { minWidth: "480px" }
    );
  },
});

// ============================================================================
// COMPARISON & FORECASTING TOOLS
// ============================================================================

export const comparePeriodsAnalyticsTool = tool({
  name: "compare_periods",
  description: "Compare occupancy and revenue metrics between two time periods.",
  schema: z.object({
    period1_start: z.string().describe("Period 1 start date (YYYY-MM-DD)"),
    period1_end: z.string().describe("Period 1 end date (YYYY-MM-DD)"),
    period2_start: z.string().describe("Period 2 start date (YYYY-MM-DD)"),
    period2_end: z.string().describe("Period 2 end date (YYYY-MM-DD)"),
  }),
  async func({ period1_start, period1_end, period2_start, period2_end }) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const NUM_CABINS = 3;

    // Helper: get metrics for a period using overlap detection (matches analytics dashboard)
    async function getPeriodMetrics(startStr, endStr) {
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      const daysInPeriod = Math.ceil((end - start) / msPerDay) + 1;

      // Overlap detection: check_in <= end AND check_out >= start
      const { data: reservations } = await supabase
        .from("reservations")
        .select("check_in, check_out, total, room_subtotal, extras_total, currency")
        .lte("check_in", endStr)
        .gte("check_out", startStr)
        .in("status", ["confirmed", "completed", "checked-in", "checked-out"]);

      const { data: blockedDates } = await supabase
        .from("blocked_dates")
        .select("blocked_date")
        .gte("blocked_date", startStr)
        .lte("blocked_date", endStr);

      const blockedNights = (blockedDates || []).length;
      const availableNights = (daysInPeriod * NUM_CABINS) - blockedNights;

      if (!reservations?.length) {
        return { bookings: 0, revenue: 0, roomRevenue: 0, extrasRevenue: 0, occupiedNights: 0, availableNights, occupancyRate: 0, currency: "GHS" };
      }

      const bookings = reservations.length;
      const revenue = reservations.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
      const roomRevenue = reservations.reduce((sum, r) => sum + parseFloat(r.room_subtotal || 0), 0);
      const extrasRevenue = reservations.reduce((sum, r) => sum + parseFloat(r.extras_total || 0), 0);

      let occupiedNights = 0;
      reservations.forEach(r => {
        if (!r.check_in || !r.check_out) return;
        const ci = new Date(r.check_in + 'T00:00:00');
        const co = new Date(r.check_out + 'T00:00:00');
        const overlapStart = new Date(Math.max(ci.getTime(), start.getTime()));
        const overlapEnd = new Date(Math.min(co.getTime(), end.getTime() + msPerDay));
        occupiedNights += Math.max(0, (overlapEnd - overlapStart) / msPerDay);
      });
      occupiedNights = Math.round(occupiedNights);

      const occupancyRate = availableNights > 0 ? (occupiedNights / availableNights) * 100 : 0;
      const adr = occupiedNights > 0 ? roomRevenue / occupiedNights : 0;
      const revPAR = availableNights > 0 ? roomRevenue / availableNights : 0;

      return {
        bookings, revenue, roomRevenue, extrasRevenue, occupiedNights, availableNights,
        occupancyRate, adr, revPAR,
        currency: reservations[0]?.currency || "GHS",
      };
    }

    const p1 = await getPeriodMetrics(period1_start, period1_end);
    const p2 = await getPeriodMetrics(period2_start, period2_end);

    const fmtChg = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const chg = (a, b) => a > 0 ? ((b - a) / a * 100) : 0;
    const cur = p1.currency || p2.currency || "GHS";

    return `**Period Comparison**

| Metric | ${formatDate(period1_start)} – ${formatDate(period1_end)} | ${formatDate(period2_start)} – ${formatDate(period2_end)} | Change |
|--------|--------|--------|--------|
| Bookings | ${p1.bookings} | ${p2.bookings} | ${fmtChg(chg(p1.bookings, p2.bookings))} |
| Total Revenue | ${cur} ${p1.revenue.toFixed(2)} | ${cur} ${p2.revenue.toFixed(2)} | ${fmtChg(chg(p1.revenue, p2.revenue))} |
| Room Revenue | ${cur} ${p1.roomRevenue.toFixed(2)} | ${cur} ${p2.roomRevenue.toFixed(2)} | ${fmtChg(chg(p1.roomRevenue, p2.roomRevenue))} |
| Extras Revenue | ${cur} ${p1.extrasRevenue.toFixed(2)} | ${cur} ${p2.extrasRevenue.toFixed(2)} | ${fmtChg(chg(p1.extrasRevenue, p2.extrasRevenue))} |
| Occupied Nights | ${p1.occupiedNights} | ${p2.occupiedNights} | ${fmtChg(chg(p1.occupiedNights, p2.occupiedNights))} |
| Occupancy Rate | ${p1.occupancyRate.toFixed(1)}% | ${p2.occupancyRate.toFixed(1)}% | ${fmtChg(p2.occupancyRate - p1.occupancyRate)} |
| ADR | ${cur} ${(p1.adr||0).toFixed(2)} | ${cur} ${(p2.adr||0).toFixed(2)} | ${fmtChg(chg(p1.adr||0, p2.adr||0))} |
| RevPAR | ${cur} ${(p1.revPAR||0).toFixed(2)} | ${cur} ${(p2.revPAR||0).toFixed(2)} | ${fmtChg(chg(p1.revPAR||0, p2.revPAR||0))} |
`;
  },
});

// ============================================================================
// RESERVATION MANAGEMENT TOOLS
// ============================================================================

export const updateReservationStatusTool = tool({
  name: "update_reservation_status",
  description: "Update the status of a reservation. Requires explicit user confirmation.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code or reservation ID"),
    new_status: z.string().describe("New status: confirmed, checked-in, checked-out, or cancelled"),
  }),
  async func({ identifier, new_status }) {
    const validStatuses = ['confirmed', 'checked-in', 'checked-out', 'cancelled'];
    if (!validStatuses.includes(new_status.toLowerCase())) {
      return `Invalid status. Must be one of: ${validStatuses.join(', ')}`;
    }
    let query = supabase.from("reservations").update({ status: new_status.toLowerCase() });
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("confirmation_code", identifier.toUpperCase());
    }
    const { error } = await query;
    if (error) return `Error: ${error.message}`;
    return `✓ Reservation '${identifier}' status updated to '${new_status}' successfully!`;
  },
});

export const cancelReservationTool = tool({
  name: "cancel_reservation",
  description: "Cancel a reservation. Requires explicit user confirmation.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code or reservation ID"),
  }),
  async func({ identifier }) {
    let query = supabase.from("reservations").update({ status: 'cancelled' });
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("confirmation_code", identifier.toUpperCase());
    }
    const { error } = await query;
    if (error) return `Error: ${error.message}`;
    return `✓ Reservation '${identifier}' cancelled successfully!`;
  },
});

export const deleteReservationTool = tool({
  name: "delete_reservation",
  description: "Permanently delete a reservation. WARNING: Cannot be undone! Requires explicit user confirmation.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code or reservation ID"),
  }),
  async func({ identifier }) {
    let query = supabase.from("reservations").delete();
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier).select();
    } else {
      query = query.eq("confirmation_code", identifier.toUpperCase()).select();
    }
    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    
    if (!data || data.length === 0) {
      return `✗ Reservation '${identifier}' not found or could not be deleted.`;
    }
    
    return `✓ Reservation '${identifier}' permanently deleted.`;
  },
});

export const updateReservationDetailsTool = tool({
  name: "update_reservation_details",
  description: "Update reservation details. Requires explicit user confirmation.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code or reservation ID"),
    updates: z.object({
      check_in: z.string().optional(),
      check_out: z.string().optional(),
      adults: z.number().optional(),
      children: z.number().optional(),
      guest_first_name: z.string().optional(),
      guest_last_name: z.string().optional(),
      guest_email: z.string().optional(),
      guest_phone: z.string().optional(),
      country_code: z.string().optional(),
      notes: z.string().optional(),
      payment_status: z.string().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    const payload = {};
    if (updates.check_in) payload.check_in = updates.check_in;
    if (updates.check_out) payload.check_out = updates.check_out;
    if (updates.adults !== undefined) payload.adults = updates.adults;
    if (updates.children !== undefined) payload.children = updates.children;
    if (updates.guest_first_name) payload.guest_first_name = updates.guest_first_name;
    if (updates.guest_last_name) payload.guest_last_name = updates.guest_last_name;
    if (updates.guest_email) payload.guest_email = updates.guest_email;
    if (updates.guest_phone) payload.guest_phone = updates.guest_phone;
    if (updates.country_code) payload.country_code = updates.country_code;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.payment_status) payload.payment_status = updates.payment_status;

    let query = supabase.from("reservations").update(payload);
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("confirmation_code", identifier.toUpperCase());
    }
    const { error } = await query;
    if (error) return `Error: ${error.message}`;
    return `✓ Reservation '${identifier}' updated: ${Object.keys(payload).join(', ')}`;
  },
});

// ============================================================================
// COMPREHENSIVE EDIT RESERVATION TOOL (based on edit reservations modal)
// ============================================================================

export const editReservationTool = tool({
  name: "edit_reservation",
  description: "Comprehensively edit a reservation — change room, dates, guest info, extras, coupon, status, payment status, price override, and notes. Automatically recalculates pricing when room or dates change. Checks availability when room or dates change. Based on the edit reservations modal.",
  schema: z.object({
    confirmation_code: z.string().describe("The reservation confirmation code to edit"),
    // Guest info
    guest_first_name: z.string().optional().describe("New guest first name"),
    guest_last_name: z.string().optional().describe("New guest last name"),
    guest_email: z.string().optional().describe("New guest email"),
    guest_phone: z.string().optional().describe("New guest phone number (without country code)"),
    country_code: z.string().optional().describe("New country dialling code (e.g., '+233')"),
    // Dates
    check_in: z.string().optional().describe("New check-in date (YYYY-MM-DD)"),
    check_out: z.string().optional().describe("New check-out date (YYYY-MM-DD)"),
    // Room
    room_code: z.string().optional().describe("New room code to move the reservation to"),
    // Capacity
    adults: z.number().optional().describe("New number of adults"),
    children: z.number().optional().describe("New number of children"),
    // Extras — full replacement
    extras: z.string().optional().describe("JSON array of ALL extras for the reservation (replaces existing). e.g. [{\"name\": \"Airport Transfer\", \"quantity\": 1}]"),
    // Coupon
    coupon_code: z.string().optional().describe("Apply or change coupon code"),
    remove_coupon: z.boolean().optional().describe("Set true to remove the current coupon"),
    // Status
    status: z.string().optional().describe("New status: pending_payment, confirmed, checked-in, checked-out, cancelled"),
    payment_status: z.string().optional().describe("New payment status: unpaid, partial, paid, refunded"),
    // Price
    price_override_per_night: z.number().optional().describe("Manual price override per night (ignores dynamic pricing)"),
    // Other
    is_influencer: z.boolean().optional().describe("Whether guest is an influencer"),
    notes: z.string().optional().describe("New notes/special requests"),
    currency: z.string().optional().describe("Currency code (default GHS)"),
  }),
  async func(args) {
    const { confirmation_code } = args;

    // 1. Fetch current reservation
    const { data: current, error: fetchErr } = await supabase
      .from("reservations")
      .select("*")
      .eq("confirmation_code", confirmation_code.toUpperCase())
      .single();

    if (fetchErr || !current) return `✗ Reservation '${confirmation_code}' not found.`;

    // Determine effective values (use new if provided, else keep current)
    const newCheckIn = args.check_in || current.check_in;
    const newCheckOut = args.check_out || current.check_out;

    // Validate dates
    const ci = new Date(newCheckIn + 'T00:00:00');
    const co = new Date(newCheckOut + 'T00:00:00');
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) return "✗ Invalid date format. Use YYYY-MM-DD.";
    if (co <= ci) return "✗ Check-out date must be after check-in date.";

    const msPerDay = 1000 * 60 * 60 * 24;
    const nightsCount = Math.round((co - ci) / msPerDay);

    // 2. Determine target room
    let room = null;
    const roomChanged = args.room_code && args.room_code.toUpperCase() !== (current.room_type_code || '').toUpperCase();
    const datesChanged = args.check_in && args.check_in !== current.check_in || args.check_out && args.check_out !== current.check_out;

    if (args.room_code) {
      const { data: r } = await supabase.from("room_types")
        .select("id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency, max_adults")
        .eq("code", args.room_code.toUpperCase()).single();
      if (!r) return `✗ Room '${args.room_code}' not found.`;
      room = r;
    } else {
      const { data: r } = await supabase.from("room_types")
        .select("id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency, max_adults")
        .eq("id", current.room_type_id).single();
      room = r;
    }

    if (!room) return "✗ Could not resolve room type.";

    // 3. Check capacity
    const effectiveAdults = args.adults !== undefined ? args.adults : (current.adults || 2);
    if (effectiveAdults > (room.max_adults || 4)) {
      return `✗ ${room.name} supports max ${room.max_adults || 4} adults. You specified ${effectiveAdults}.`;
    }

    // 4. Availability check (if room or dates changed)
    if (roomChanged || datesChanged) {
      const { data: conflicts } = await supabase
        .from("reservations")
        .select("confirmation_code, check_in, check_out")
        .eq("room_type_id", room.id)
        .in("status", ["confirmed", "checked-in"])
        .neq("id", current.id)
        .or(`and(check_in.lt.${newCheckOut},check_out.gt.${newCheckIn})`);

      if (conflicts?.length) {
        return `✗ ${room.name} is NOT available for ${formatDate(newCheckIn)} – ${formatDate(newCheckOut)}. Conflicting booking: ${conflicts[0].confirmation_code}.`;
      }

      const { data: blocked } = await supabase
        .from("blocked_dates")
        .select("blocked_date")
        .eq("room_type_id", room.id)
        .gte("blocked_date", newCheckIn)
        .lt("blocked_date", newCheckOut);

      if (blocked?.length) {
        return `✗ ${room.name} has blocked dates in that range. Cannot book.`;
      }
    }

    // 5. Recalculate pricing if room/dates changed (or price override)
    let roomSubtotal = current.room_subtotal || 0;
    const needsReprice = roomChanged || datesChanged || args.price_override_per_night !== undefined;

    if (needsReprice) {
      if (args.price_override_per_night !== undefined) {
        roomSubtotal = args.price_override_per_night * nightsCount;
      } else {
        // Use dynamic pricing RPC with null model ID — lets the DB function use the active model
        // (matching custom_booking.js and edit reservation modal exactly)
        roomSubtotal = 0;
        try {
          const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
            p_room_type_id: room.id,
            p_check_in: newCheckIn,
            p_check_out: newCheckOut,
            p_pricing_model_id: null
          });
          // Match custom_booking.js: pricingData.total != null (allows 0)
          if (!pricingError && pricingData && pricingData.total != null) {
            roomSubtotal = parseFloat(pricingData.total);
          }
        } catch (e) { /* fallback below */ }

        if (roomSubtotal === 0) {
          const wkdPrice = Number(room.base_price_per_night_weekday || 0);
          const wkePrice = Number(room.base_price_per_night_weekend || 0);
          for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            roomSubtotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
          }
        }
      }
    }

    // 6. Handle extras if provided (full replacement)
    let extrasTotal = current.extras_total || 0;
    let selectedExtras = [];
    const extrasChanged = args.extras !== undefined;

    if (extrasChanged) {
      extrasTotal = 0;
      try {
        const extrasList = typeof args.extras === 'string' ? JSON.parse(args.extras) : args.extras;
        for (const item of extrasList) {
          let extra = null;
          if (item.extra_id) {
            const { data } = await supabase.from("extras")
              .select("id, name, code, price, currency, unit_type")
              .eq("id", item.extra_id).single();
            extra = data;
          }
          if (!extra && item.name) {
            const { data } = await supabase.from("extras")
              .select("id, name, code, price, currency, unit_type")
              .ilike("name", `%${item.name}%`).limit(1);
            extra = data?.[0] || null;
          }
          if (extra) {
            const qty = item.quantity || 1;
            extrasTotal += Number(extra.price || 0) * qty;
            selectedExtras.push({
              extra_id: extra.id,
              reservation_id: current.id,
              extra_code: extra.code || '',
              extra_name: extra.name || '',
              price: Number(extra.price || 0),
              quantity: qty,
              subtotal: Number(extra.price || 0) * qty,
              discount_amount: 0,
            });
          }
        }
      } catch (e) { /* ignore invalid JSON */ }
    } else {
      // Extras NOT changed — fetch existing reservation_extras so coupon allocation
      // can properly target them by extra_id (matching custom_booking.js behaviour)
      const { data: existingExtras } = await supabase
        .from("reservation_extras")
        .select("extra_code, extra_name, price, quantity, subtotal, discount_amount")
        .eq("reservation_id", current.id);

      if (existingExtras?.length) {
        // Resolve extra_id for each existing extra (needed for coupon extra_ids targeting)
        for (const re of existingExtras) {
          let extraId = null;
          if (re.extra_code) {
            const { data } = await supabase.from("extras").select("id").eq("code", re.extra_code).single();
            extraId = data?.id || null;
          }
          if (!extraId && re.extra_name) {
            const { data } = await supabase.from("extras").select("id").ilike("name", `%${re.extra_name}%`).limit(1);
            extraId = data?.[0]?.id || null;
          }
          selectedExtras.push({
            extra_id: extraId,
            reservation_id: current.id,
            extra_code: re.extra_code || '',
            extra_name: re.extra_name || '',
            price: Number(re.price || 0),
            quantity: Number(re.quantity || 1),
            subtotal: Number(re.subtotal || 0),
            discount_amount: Number(re.discount_amount || 0),
          });
        }
        // Recalculate extrasTotal from actual extras (more accurate than current.extras_total)
        extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price * e.quantity, 0);
      }
    }

    // 7. Coupon handling with proper discount allocation (matching custom_booking.js)
    let discountAmount = current.discount_amount || 0;
    let roomDiscount = current.room_discount || 0;
    let extrasDiscount = current.extras_discount || 0;
    let appliedCouponCode = current.coupon_code || null;
    let extrasWithDiscounts = selectedExtras.map(e => ({ ...e, discount: 0 }));

    console.log('🎟️ [editReservation] Before coupon: roomSubtotal=', roomSubtotal, 'extrasTotal=', extrasTotal, 'selectedExtras count=', selectedExtras.length, 'extrasChanged=', extrasChanged);

    // Helper to allocate discount for a given coupon
    const allocateDiscount = (coupon) => {
      let rDisc = 0, eDisc = 0;
      console.log('🎟️ [editReservation] allocateDiscount: coupon=', coupon.code, 'applies_to=', coupon.applies_to, 'discount_type=', coupon.discount_type, 'discount_value=', coupon.discount_value, 'extra_ids=', coupon.extra_ids);

      // Determine targeted extras
      let extrasTargetTotal = extrasTotal;
      let targetedExtras = selectedExtras;
      if (Array.isArray(coupon.extra_ids) && coupon.extra_ids.length) {
        const idSet = new Set(coupon.extra_ids.map(String));
        targetedExtras = selectedExtras.filter(e => idSet.has(String(e.extra_id)));
        extrasTargetTotal = targetedExtras.reduce((sum, e) => sum + e.price * e.quantity, 0);
      }

      if (coupon.applies_to === 'both') {
        // Apply discount to both room and targeted extras (matching custom_booking.js)
        const base = roomSubtotal + extrasTargetTotal;
        const totalDisc = coupon.discount_type === 'percentage'
          ? (base * coupon.discount_value) / 100
          : coupon.discount_value;
        if (base > 0) {
          rDisc = totalDisc * (roomSubtotal / base);
          eDisc = totalDisc * (extrasTargetTotal / base);
        }
      } else if (coupon.applies_to === 'rooms') {
        rDisc = coupon.discount_type === 'percentage'
          ? (roomSubtotal * coupon.discount_value) / 100
          : coupon.discount_value;
        eDisc = 0;
      } else if (coupon.applies_to === 'extras') {
        rDisc = 0;
        eDisc = coupon.discount_type === 'percentage'
          ? (extrasTargetTotal * coupon.discount_value) / 100
          : coupon.discount_value;
      }

      // Per-extra discount allocation
      const ewDisc = selectedExtras.map(extra => {
        let extraDisc = 0;
        if (eDisc > 0 && extrasTargetTotal > 0) {
          let isTargeted = true;
          if (Array.isArray(coupon.extra_ids) && coupon.extra_ids.length) {
            const idSet = new Set(coupon.extra_ids.map(String));
            isTargeted = idSet.has(String(extra.extra_id));
          }
          if (isTargeted && extra.quantity > 0) {
            const extraSub = extra.price * extra.quantity;
            extraDisc = (extraSub / extrasTargetTotal) * eDisc;
          }
        }
        return { ...extra, discount: extraDisc };
      });

      console.log('🎟️ [editReservation] allocateDiscount result: roomDiscount=', rDisc, 'extrasDiscount=', eDisc, 'perExtraDiscounts=', ewDisc.map(e => ({ name: e.extra_name, discount: e.discount })));
      return { roomDiscount: rDisc, extrasDiscount: eDisc, extrasWithDiscounts: ewDisc };
    };

    if (args.remove_coupon) {
      discountAmount = 0;
      roomDiscount = 0;
      extrasDiscount = 0;
      appliedCouponCode = null;
      extrasWithDiscounts = selectedExtras.map(e => ({ ...e, discount: 0 }));
    } else if (args.coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", args.coupon_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (!coupon) return `✗ Coupon '${args.coupon_code}' not found or inactive.`;

      const today = new Date().toISOString().split('T')[0];
      const isValid = (!coupon.valid_from || coupon.valid_from <= today) &&
                     (!coupon.valid_until || coupon.valid_until >= today) &&
                     (!coupon.max_uses || (coupon.current_uses || 0) < coupon.max_uses);

      if (!isValid) return `✗ Coupon '${args.coupon_code}' is expired or usage limit reached.`;

      const alloc = allocateDiscount(coupon);
      roomDiscount = alloc.roomDiscount;
      extrasDiscount = alloc.extrasDiscount;
      discountAmount = Math.min(roomDiscount + extrasDiscount, roomSubtotal + extrasTotal);
      extrasWithDiscounts = alloc.extrasWithDiscounts;
      appliedCouponCode = coupon.code;

      // Update coupon usage
      await supabase.from("coupons")
        .update({ current_uses: (coupon.current_uses || 0) + 1 })
        .eq("id", coupon.id);
    } else if ((needsReprice || extrasChanged) && appliedCouponCode) {
      // Recalculate existing coupon discount with new pricing/extras
      const { data: coupon } = await supabase
        .from("coupons").select("*")
        .eq("code", appliedCouponCode).single();

      if (coupon) {
        const alloc = allocateDiscount(coupon);
        roomDiscount = alloc.roomDiscount;
        extrasDiscount = alloc.extrasDiscount;
        discountAmount = Math.min(roomDiscount + extrasDiscount, roomSubtotal + extrasTotal);
        extrasWithDiscounts = alloc.extrasWithDiscounts;
      }
    }

    const total = Math.max(0, roomSubtotal + extrasTotal - discountAmount);
    const effectiveCurrency = args.currency || current.currency || room.currency || 'GHS';

    // 8. Build update payload
    const payload = {
      check_in: newCheckIn,
      check_out: newCheckOut,
      nights: nightsCount,
      room_type_id: room.id,
      room_type_code: room.code,
      room_name: room.name,
      guest_first_name: args.guest_first_name !== undefined ? args.guest_first_name : current.guest_first_name,
      guest_last_name: args.guest_last_name !== undefined ? args.guest_last_name : current.guest_last_name,
      guest_email: args.guest_email !== undefined ? args.guest_email : current.guest_email,
      guest_phone: args.guest_phone !== undefined ? args.guest_phone : current.guest_phone,
      country_code: args.country_code !== undefined ? args.country_code : current.country_code,
      adults: effectiveAdults,
      children: args.children !== undefined ? args.children : (current.children || 0),
      room_subtotal: roomSubtotal,
      extras_total: extrasTotal,
      discount_amount: discountAmount,
      room_discount: roomDiscount,
      extras_discount: extrasDiscount,
      coupon_code: appliedCouponCode,
      total,
      currency: effectiveCurrency,
      notes: args.notes !== undefined ? args.notes : current.notes,
    };

    if (args.status) payload.status = args.status;
    if (args.payment_status) payload.payment_status = args.payment_status;
    if (args.is_influencer !== undefined) payload.is_influencer = args.is_influencer;

    console.log('💾 [editReservation] Payload discount fields → discount_amount:', payload.discount_amount, 'room_discount:', payload.room_discount, 'extras_discount:', payload.extras_discount, 'total:', payload.total);

    // 9. Update reservation
    const { error: updateErr } = await supabase
      .from("reservations")
      .update(payload)
      .eq("id", current.id);

    if (updateErr) return `✗ Failed to update reservation: ${updateErr.message}`;

    // 10. Replace extras if changed, OR update per-extra discounts if coupon changed
    const couponChanged = args.coupon_code || args.remove_coupon || ((needsReprice || extrasChanged) && appliedCouponCode);

    if (extrasChanged || couponChanged) {
      // Delete old extras
      await supabase.from("reservation_extras").delete().eq("reservation_id", current.id);
      // Insert extras with updated discount allocation
      const filteredExtras = extrasWithDiscounts.filter(e => e.quantity > 0);
      if (filteredExtras.length > 0) {
        const extrasPayload = filteredExtras.map(e => ({
          reservation_id: current.id,
          extra_code: e.extra_code,
          extra_name: e.extra_name,
          price: e.price,
          quantity: e.quantity,
          subtotal: e.price * e.quantity,
          discount_amount: e.discount || 0,
        }));
        await supabase.from("reservation_extras").insert(extrasPayload);
      }
    }

    // 11. Build response
    const changes = [];
    if (roomChanged) changes.push(`Room → ${room.name} (${room.code})`);
    if (datesChanged) changes.push(`Dates → ${formatDate(newCheckIn)} – ${formatDate(newCheckOut)} (${nightsCount} nights)`);
    if (args.guest_first_name || args.guest_last_name) changes.push(`Guest name → ${payload.guest_first_name} ${payload.guest_last_name}`);
    if (args.guest_email) changes.push(`Email → ${payload.guest_email}`);
    if (args.guest_phone || args.country_code) changes.push(`Phone → ${payload.country_code || ''} ${payload.guest_phone || ''}`);
    if (args.adults !== undefined) changes.push(`Adults → ${payload.adults}`);
    if (args.children !== undefined) changes.push(`Children → ${payload.children}`);
    if (extrasChanged) changes.push(`Extras updated (${selectedExtras.length} items, ${effectiveCurrency} ${extrasTotal.toFixed(2)})`);
    if (args.coupon_code) changes.push(`Coupon → ${appliedCouponCode}`);
    if (args.remove_coupon) changes.push(`Coupon removed`);
    if (args.status) changes.push(`Status → ${args.status}`);
    if (args.payment_status) changes.push(`Payment → ${args.payment_status}`);
    if (args.notes !== undefined) changes.push(`Notes updated`);
    if (args.price_override_per_night !== undefined) changes.push(`Price override → ${effectiveCurrency} ${args.price_override_per_night}/night`);
    if (args.is_influencer !== undefined) changes.push(`Influencer → ${args.is_influencer}`);

    let response = `✓ **Reservation ${confirmation_code} Updated**\n\n`;
    response += `**Changes:**\n`;
    changes.forEach(c => { response += `- ${c}\n`; });
    response += `\n**Updated Summary:**\n`;
    response += `- **Cabin**: ${room.name} (${room.code})\n`;
    response += `- **Check-in**: ${formatDate(newCheckIn)}\n`;
    response += `- **Check-out**: ${formatDate(newCheckOut)} (${nightsCount} nights)\n`;
    response += `- **Guest**: ${payload.guest_first_name || ''} ${payload.guest_last_name || ''}\n`;
    response += `- **Room Cost**: ${effectiveCurrency} ${roomSubtotal.toFixed(2)}\n`;
    if (extrasTotal > 0) response += `- **Extras**: ${effectiveCurrency} ${extrasTotal.toFixed(2)}\n`;
    if (discountAmount > 0) response += `- **Discount**: -${effectiveCurrency} ${discountAmount.toFixed(2)}${appliedCouponCode ? ` (${appliedCouponCode})` : ''}\n`;
    response += `- **Total**: ${effectiveCurrency} ${total.toFixed(2)}\n`;
    response += `- **Status**: ${payload.status || current.status} | **Payment**: ${payload.payment_status || current.payment_status}`;

    return response;
  },
});

// ============================================================================
// CREATE GROUP RESERVATION TOOL (based on custom_booking modal)
// ============================================================================

export const createGroupReservationTool = tool({
  name: "create_group_reservation",
  description: "Create a group reservation for MULTIPLE rooms with shared guest info. All rooms share the same dates and guest details. Generates a GRP-XXXXXX group code. Extras are attached to the primary reservation only. Adults are distributed across rooms based on capacity. Uses active pricing model by default; pass price_override_per_night to override.",
  schema: z.object({
    room_codes: z.string().describe("JSON array of room codes, e.g. [\"SAND\", \"PALM\"]"),
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    check_out: z.string().describe("Check-out date (YYYY-MM-DD)"),
    guest_first_name: z.string().describe("Guest first name"),
    guest_last_name: z.string().describe("Guest last name"),
    guest_email: z.string().describe("Guest email address"),
    guest_phone: z.string().optional().describe("Guest phone number (without country code)"),
    country_code: z.string().optional().describe("Country dialling code (e.g., '+233')"),
    adults: z.number().default(2).describe("Total number of adults across all rooms"),
    children: z.number().default(0).describe("Number of children"),
    notes: z.string().optional().describe("Special requests or notes"),
    extras: z.string().optional().describe("JSON array of extras by name and quantity (attached to primary room only)"),
    coupon_code: z.string().optional().describe("Coupon code to apply"),
    price_override_per_night: z.number().optional().describe("Manual price override per night in GHS applied to ALL rooms. If provided, bypasses dynamic pricing."),
  }),
  async func(input) {
    const { check_in, check_out, guest_first_name, guest_last_name,
            guest_email, guest_phone, country_code, adults, children,
            notes, extras, coupon_code } = input;

    // Parse room codes
    let roomCodes;
    try {
      roomCodes = typeof input.room_codes === 'string' ? JSON.parse(input.room_codes) : input.room_codes;
    } catch (e) {
      return "✗ Invalid room_codes format. Provide a JSON array, e.g. [\"SAND\", \"PALM\"].";
    }

    if (!Array.isArray(roomCodes) || roomCodes.length < 2) {
      return "✗ Group bookings require at least 2 rooms. For single room, use create_reservation instead.";
    }

    // Validate dates
    const ci = new Date(check_in + 'T00:00:00');
    const co = new Date(check_out + 'T00:00:00');
    if (isNaN(ci.getTime()) || isNaN(co.getTime())) return "✗ Invalid date format. Use YYYY-MM-DD.";
    if (co <= ci) return "✗ Check-out date must be after check-in date.";

    const msPerDay = 1000 * 60 * 60 * 24;
    const nightsCount = Math.round((co - ci) / msPerDay);

    // Fetch all rooms
    const { data: rooms, error: roomsErr } = await supabase
      .from("room_types")
      .select("id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency, max_adults")
      .in("code", roomCodes.map(c => c.toUpperCase()));

    if (roomsErr || !rooms?.length) return "✗ Could not find the specified rooms.";

    const notFound = roomCodes.filter(c => !rooms.find(r => r.code === c.toUpperCase()));
    if (notFound.length > 0) return `✗ Rooms not found: ${notFound.join(', ')}`;

    // Order rooms to match requested order
    const orderedRooms = roomCodes.map(c => rooms.find(r => r.code === c.toUpperCase()));

    // Check total capacity
    const totalCapacity = orderedRooms.reduce((sum, r) => sum + (r.max_adults || 2), 0);
    const totalAdults = adults || 2;
    if (totalAdults > totalCapacity) {
      return `✗ Total capacity of selected rooms is ${totalCapacity} adults. You specified ${totalAdults}.`;
    }

    // Check availability for all rooms
    for (const room of orderedRooms) {
      const { data: conflicts } = await supabase
        .from("reservations")
        .select("confirmation_code")
        .eq("room_type_id", room.id)
        .in("status", ["confirmed", "checked-in"])
        .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`);

      if (conflicts?.length) {
        return `✗ ${room.name} (${room.code}) is NOT available for ${formatDate(check_in)} – ${formatDate(check_out)}. Conflicting booking: ${conflicts[0].confirmation_code}.`;
      }

      const { data: blocked } = await supabase
        .from("blocked_dates")
        .select("blocked_date")
        .eq("room_type_id", room.id)
        .gte("blocked_date", check_in)
        .lt("blocked_date", check_out);

      if (blocked?.length) {
        return `✗ ${room.name} (${room.code}) has blocked dates in that range.`;
      }
    }

    // Calculate pricing per room (manual override or active pricing model)
    // Matching custom_booking.js: perRoomSubtotals → roomPricing
    const roomPricing = [];
    let totalRoomPrice = 0;
    const useOverride = input.price_override_per_night !== undefined && input.price_override_per_night > 0;

    if (useOverride) {
      // Manual price override — flat rate per night per room (matching custom_booking.js)
      for (const room of orderedRooms) {
        const subtotal = input.price_override_per_night * nightsCount;
        roomPricing.push({ room, subtotal });
        totalRoomPrice += subtotal;
        console.log('💰 [createGroupReservation] Manual override for', room.code, ':', subtotal);
      }
    } else {
      // Use dynamic pricing RPC with null model ID — lets the DB function use the active model
      // (matching custom_booking.js: p_pricing_model_id: null)
      for (const room of orderedRooms) {
        let subtotal = 0;
        try {
          const { data: pricingData, error: pricingError } = await supabase.rpc('calculate_dynamic_price', {
            p_room_type_id: room.id, p_check_in: check_in, p_check_out: check_out, p_pricing_model_id: null
          });

          if (pricingError) {
            console.warn('⚠ [createGroupReservation] Dynamic pricing error for', room.code, ':', pricingError.message);
          }

          // Match custom_booking.js: pricingData.total != null (allows 0)
          if (!pricingError && pricingData && pricingData.total != null) {
            subtotal = parseFloat(pricingData.total);
            console.log('✅ [createGroupReservation] Dynamic price for', room.code, ':', subtotal);
          } else {
            // Fallback to base prices (matching custom_booking.js fallback)
            const wkdPrice = Number(room.base_price_per_night_weekday || 0);
            const wkePrice = Number(room.base_price_per_night_weekend || 0);
            for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
              const dow = d.getDay();
              subtotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
            }
            console.log('⚠ [createGroupReservation] Fallback base price for', room.code, ':', subtotal);
          }
        } catch (err) {
          // Fallback to base prices on error (matching custom_booking.js catch block)
          console.warn('❌ [createGroupReservation] Dynamic pricing threw for', room.code, ':', err.message);
          const wkdPrice = Number(room.base_price_per_night_weekday || 0);
          const wkePrice = Number(room.base_price_per_night_weekend || 0);
          for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            subtotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
          }
          console.log('⚠ [createGroupReservation] Fallback base price for', room.code, ':', subtotal);
        }

        roomPricing.push({ room, subtotal });
        totalRoomPrice += subtotal;
      }
    }
    console.log('📊 [createGroupReservation] totalRoomPrice:', totalRoomPrice, 'rooms:', roomPricing.map(r => ({ code: r.room.code, subtotal: r.subtotal })));

    // Distribute adults across rooms
    let remainingAdults = totalAdults;
    const adultsPerRoom = orderedRooms.map(r => {
      const maxA = r.max_adults || 2;
      const assign = Math.min(remainingAdults, maxA);
      remainingAdults -= assign;
      return assign;
    });

    // Calculate extras (attached to primary room only)
    let extrasTotal = 0;
    let selectedExtras = [];
    if (extras) {
      try {
        const extrasList = typeof extras === 'string' ? JSON.parse(extras) : extras;
        for (const item of extrasList) {
          let extra = null;
          if (item.extra_id) {
            const { data } = await supabase.from("extras")
              .select("id, name, code, price, currency, unit_type")
              .eq("id", item.extra_id).single();
            extra = data;
          }
          if (!extra && item.name) {
            const { data } = await supabase.from("extras")
              .select("id, name, code, price, currency, unit_type")
              .ilike("name", `%${item.name}%`).limit(1);
            extra = data?.[0] || null;
          }
          if (extra) {
            const qty = item.quantity || 1;
            extrasTotal += Number(extra.price || 0) * qty;
            selectedExtras.push({
              extra_id: extra.id,
              extra_code: extra.code || '',
              extra_name: extra.name || '',
              price: Number(extra.price || 0),
              quantity: qty,
              subtotal: Number(extra.price || 0) * qty,
              discount_amount: 0,
            });
          }
        }
      } catch (e) { /* ignore */ }
    }

    // ---- DISCOUNT with breakdown (matching custom_booking.js exactly) ----
    let discountAmount = 0;
    let roomDiscount = 0;
    let extrasDiscount = 0;
    let appliedCouponCode = null;
    let extrasWithDiscounts = [];
    let couponWarning = '';

    console.log('🎟️ [createGroupReservation] Coupon input:', coupon_code, 'totalRoomPrice:', totalRoomPrice, 'extrasTotal:', extrasTotal, 'selectedExtras count:', selectedExtras.length);

    if (coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons").select("*")
        .eq("code", coupon_code.toUpperCase()).eq("is_active", true).single();

      if (!coupon) {
        console.log('⚠ [createGroupReservation] Coupon not found or inactive:', coupon_code);
        couponWarning = `⚠ Coupon '${coupon_code}' was not found or is inactive. Booking created without discount.`;
      } else {
        console.log('🎟️ [createGroupReservation] Coupon found:', coupon.code, 'applies_to:', coupon.applies_to, 'discount_type:', coupon.discount_type, 'discount_value:', coupon.discount_value, 'extra_ids:', coupon.extra_ids);

        const today = new Date().toISOString().split('T')[0];
        const isValid = (!coupon.valid_from || coupon.valid_from <= today) &&
                       (!coupon.valid_until || coupon.valid_until >= today) &&
                       (!coupon.max_uses || (coupon.current_uses || 0) < coupon.max_uses);

        if (!isValid) {
          console.log('⚠ [createGroupReservation] Coupon is expired or usage limit reached');
          couponWarning = `⚠ Coupon '${coupon_code}' is expired or has reached its usage limit. Booking created without discount.`;
        } else {
          const subtotal = totalRoomPrice + extrasTotal;

          // Calculate total only for extras that this coupon targets (if defined)
          // (matching custom_booking.js: extrasTargetTotal logic)
          let extrasTargetTotal = extrasTotal;
          let targetedExtras = selectedExtras; // All extras by default

          if (Array.isArray(coupon.extra_ids) && coupon.extra_ids.length) {
            const idSet = new Set(coupon.extra_ids.map(String));
            targetedExtras = selectedExtras.filter(e => idSet.has(String(e.extra_id)));
            extrasTargetTotal = targetedExtras.reduce((sum, e) => sum + e.price * e.quantity, 0);
            console.log('🎟️ [createGroupReservation] Coupon targets specific extras. Targeted:', targetedExtras.length, 'of', selectedExtras.length, 'extrasTargetTotal:', extrasTargetTotal);
          }

          if (coupon.applies_to === 'both') {
            // Apply discount to both room and targeted extras (matching custom_booking.js)
            const base = totalRoomPrice + extrasTargetTotal;
            const totalDiscount = coupon.discount_type === 'percentage'
              ? (base * coupon.discount_value) / 100
              : coupon.discount_value;

            // Proportionally split discount between room and extras
            if (base > 0) {
              const roomPortion = totalRoomPrice / base;
              const extrasPortion = extrasTargetTotal / base;
              roomDiscount = totalDiscount * roomPortion;
              extrasDiscount = totalDiscount * extrasPortion;
            }
            console.log('🎟️ [createGroupReservation] applies_to=both: base=', base, 'totalDiscount=', totalDiscount, 'roomDiscount=', roomDiscount, 'extrasDiscount=', extrasDiscount);
          } else if (coupon.applies_to === 'rooms') {
            // Apply discount only to rooms
            roomDiscount = coupon.discount_type === 'percentage'
              ? (totalRoomPrice * coupon.discount_value) / 100
              : coupon.discount_value;
            extrasDiscount = 0;
            console.log('🎟️ [createGroupReservation] applies_to=rooms: roomDiscount=', roomDiscount);
          } else if (coupon.applies_to === 'extras') {
            // Apply discount only to targeted extras
            roomDiscount = 0;
            extrasDiscount = coupon.discount_type === 'percentage'
              ? (extrasTargetTotal * coupon.discount_value) / 100
              : coupon.discount_value;
            console.log('🎟️ [createGroupReservation] applies_to=extras: extrasDiscount=', extrasDiscount);
          } else {
            console.log('⚠ [createGroupReservation] Unknown applies_to value:', coupon.applies_to);
          }

          // Calculate per-extra discounts for extras that are targeted
          // (matching custom_booking.js per-extra discount allocation)
          extrasWithDiscounts = selectedExtras.map(extra => {
            let extraDisc = 0;
            if (extrasDiscount > 0 && extrasTargetTotal > 0) {
              let isTargeted = true;
              if (coupon.extra_ids && coupon.extra_ids.length) {
                const idSet = new Set(coupon.extra_ids.map(String));
                isTargeted = idSet.has(String(extra.extra_id));
              }
              if (isTargeted && extra.quantity > 0) {
                const extraSubtotal = extra.price * extra.quantity;
                extraDisc = (extraSubtotal / extrasTargetTotal) * extrasDiscount;
              }
            }
            return { ...extra, discount: extraDisc };
          });

          // Total discount (matching custom_booking.js: discount = roomDiscount + extrasDiscount, capped at subtotal)
          discountAmount = roomDiscount + extrasDiscount;
          discountAmount = Math.min(discountAmount, subtotal);
          appliedCouponCode = coupon.code;

          console.log('🎟️ [createGroupReservation] FINAL: discountAmount=', discountAmount, 'roomDiscount=', roomDiscount, 'extrasDiscount=', extrasDiscount);

          // Update coupon usage
          await supabase.from("coupons")
            .update({ current_uses: (coupon.current_uses || 0) + 1 })
            .eq("id", coupon.id);
        }
      }
    }

    // No coupon or coupon invalid: populate extrasWithDiscounts with zero discounts
    // (matching custom_booking.js: else block)
    if (extrasWithDiscounts.length === 0) {
      extrasWithDiscounts = selectedExtras.map(extra => ({ ...extra, discount: 0 }));
    }

    const groupTotal = Math.max(0, totalRoomPrice + extrasTotal - discountAmount);
    const currency = orderedRooms[0].currency || 'GHS';

    // Generate group reservation code
    const groupCode = `GRP-${Math.floor(100000 + Math.random() * 900000)}`;
    const genConfCode = () => ('B' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)).toUpperCase();

    // Create reservations for each room
    let primaryReservation = null;
    const createdReservations = [];

    for (let index = 0; index < orderedRooms.length; index++) {
      const room = orderedRooms[index];
      const isPrimary = index === 0;
      const { subtotal: perRoomSubtotal } = roomPricing[index];
      const adultsForThis = adultsPerRoom[index];

      // ⭐ Calculate proportional room discount for THIS room (like BookingWidget / custom_booking.js)
      let roomOnlyDiscount = 0;
      let extrasOnlyDiscount = 0;

      if (isPrimary) {
        // Primary room carries extras discount
        extrasOnlyDiscount = extrasDiscount;
      }

      // Distribute room discount proportionally across all rooms
      if (roomDiscount > 0 && totalRoomPrice > 0) {
        const roomProportion = perRoomSubtotal / totalRoomPrice;
        roomOnlyDiscount = roomDiscount * roomProportion;
      }

      const totalRoomDiscount = roomOnlyDiscount + extrasOnlyDiscount;
      const extrasForThis = isPrimary ? extrasTotal : 0;
      const totalForThis = Math.max(0, perRoomSubtotal + extrasForThis - totalRoomDiscount);

      console.log('💾 [createGroupReservation] Room', room.code, '(', isPrimary ? 'PRIMARY' : 'SECONDARY', '): roomSubtotal=', perRoomSubtotal, 'extrasForThis=', extrasForThis, 'roomOnlyDiscount=', roomOnlyDiscount, 'extrasOnlyDiscount=', extrasOnlyDiscount, 'totalRoomDiscount=', totalRoomDiscount, 'total=', totalForThis);

      const reservationPayload = {
        confirmation_code: genConfCode(),
        group_reservation_code: groupCode,
        group_reservation_id: isPrimary ? null : (primaryReservation?.id || null),
        room_type_id: room.id,
        room_type_code: room.code,
        room_name: room.name,
        check_in,
        check_out,
        nights: nightsCount,
        guest_first_name: guest_first_name || null,
        guest_last_name: guest_last_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        country_code: country_code || null,
        adults: adultsForThis,
        children: isPrimary ? (children || 0) : 0,
        room_subtotal: perRoomSubtotal,
        extras_total: extrasForThis,
        discount_amount: totalRoomDiscount,
        room_discount: roomOnlyDiscount,
        extras_discount: extrasOnlyDiscount,
        coupon_code: isPrimary && appliedCouponCode ? appliedCouponCode : null,
        total: totalForThis,
        currency,
        status: 'confirmed',
        payment_status: 'unpaid',
        is_influencer: false,
        notes: notes || null,
      };

      const { data: reservation, error: insertErr } = await supabase
        .from("reservations")
        .insert(reservationPayload)
        .select()
        .single();

      if (insertErr) return `✗ Failed to create reservation for ${room.name}: ${insertErr.message}`;

      if (isPrimary) {
        primaryReservation = reservation;
        // Update primary to point to itself
        await supabase.from("reservations")
          .update({ group_reservation_id: reservation.id })
          .eq("id", reservation.id);
      }

      createdReservations.push({ ...reservationPayload, id: reservation.id, room });

      // Insert extras for primary reservation only (with per-extra discount amounts)
      if (isPrimary && extrasWithDiscounts.length > 0) {
        const extrasPayload = extrasWithDiscounts
          .filter(e => e.quantity > 0)
          .map(e => ({
            reservation_id: reservation.id,
            extra_code: e.extra_code,
            extra_name: e.extra_name,
            price: e.price,
            quantity: e.quantity,
            subtotal: e.price * e.quantity,
            discount_amount: e.discount || 0,
          }));
        if (extrasPayload.length > 0) {
          await supabase.from("reservation_extras").insert(extrasPayload);
        }
      }
    }

    // Build response
    let response = `✓ **Group Reservation Created**\n\n`;
    response += `- **Group Code**: ${groupCode}\n`;
    response += `- **Check-in**: ${formatDate(check_in)}\n`;
    response += `- **Check-out**: ${formatDate(check_out)} (${nightsCount} nights)\n`;
    response += `- **Guest**: ${guest_first_name} ${guest_last_name}\n`;
    response += `- **Email**: ${guest_email}\n`;
    if (country_code || guest_phone) {
      response += `- **Phone**: ${country_code || ''} ${guest_phone || ''}\n`;
    }
    response += `- **Total Adults**: ${totalAdults} | **Children**: ${children || 0}\n\n`;

    response += `**Rooms Booked:**\n`;
    createdReservations.forEach((r, i) => {
      response += `- ${r.room.name} (${r.room.code}) — ${adultsPerRoom[i]} adults — ${currency} ${roomPricing[i].subtotal.toFixed(2)} — Code: ${r.confirmation_code}\n`;
    });

    if (selectedExtras.length > 0) {
      response += `\n**Extras** (${currency} ${extrasTotal.toFixed(2)}):\n`;
      selectedExtras.forEach(e => {
        response += `- ${e.extra_name} × ${e.quantity} = ${currency} ${e.subtotal.toFixed(2)}\n`;
      });
    }

    if (discountAmount > 0) {
      response += `\n**Discount** (${appliedCouponCode}):\n`;
      response += `- Room Discount: -${currency} ${roomDiscount.toFixed(2)}\n`;
      response += `- Extras Discount: -${currency} ${extrasDiscount.toFixed(2)}\n`;
      response += `- **Total Discount**: -${currency} ${discountAmount.toFixed(2)}\n`;
    }

    if (couponWarning) {
      response += `\n${couponWarning}\n`;
    }

    response += `\n- **Group Total**: ${currency} ${groupTotal.toFixed(2)}`;
    response += `\n- **Status**: Confirmed | **Payment**: Unpaid`;
    response += `\n\n⚠ **To send emails for this group booking, use group code ${groupCode} (NOT individual room codes). The email tool will aggregate all rooms into a single group booking email.**`;

    return response;
  },
});



// ============================================================================
// CHEF MENU TOOLS
// ============================================================================

const CHEF_CATEGORIES = {
  starters: "Starters",
  local_mains: "Local Mains",
  continental_mains: "Continental Mains",
  local_sides: "Local Sides",
  continental_sides: "Continental Sides",
};

export const listChefMenuItemsTool = tool({
  name: "list_chef_menu_items",
  description: "List all chef menu items, optionally filtered by category. Categories: starters, local_mains, continental_mains, local_sides, continental_sides.",
  schema: z.object({
    category: z.string().optional().describe("Filter by category (e.g., 'starters', 'local_mains')"),
  }),
  async func({ category } = {}) {
    let query = supabase.from("chef_menu_items")
      .select("id, category, name, description, available, created_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (category) query = query.eq("category", category);

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data?.length) return `No menu items found${category ? ` in category '${category}'` : ''}.`;

    const rows = data.map(item => ({
      Name: item.name,
      Category: CHEF_CATEGORIES[item.category] || item.category,
      Description: (item.description || '').substring(0, 50) + (item.description?.length > 50 ? '...' : ''),
      Available: item.available ? '✓ Yes' : '✗ No',
    }));

    return formatTable(rows, { minWidth: "500px" });
  },
});

export const getChefMenuItemDetailsTool = tool({
  name: "get_chef_menu_item_details",
  description: "Get details of a specific chef menu item by name or ID.",
  schema: z.object({
    identifier: z.string().describe("Menu item name or ID"),
  }),
  async func({ identifier }) {
    let query = supabase.from("chef_menu_items").select("*");
    if (identifier.match(/^[0-9a-f-]{36}$/i)) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }
    const { data, error } = await query.limit(1).single();
    if (error || !data) return `Menu item '${identifier}' not found.`;

    return `**${data.name}**\n- **Category**: ${CHEF_CATEGORIES[data.category] || data.category}\n- **Description**: ${data.description || 'N/A'}\n- **Available**: ${data.available ? '✓ Yes' : '✗ No'}\n- **ID**: ${data.id}`;
  },
});

export const createChefMenuItemTool = tool({
  name: "create_chef_menu_item",
  description: "Create a new chef menu item.",
  schema: z.object({
    name: z.string().describe("Menu item name"),
    category: z.string().describe("Category: starters, local_mains, continental_mains, local_sides, continental_sides"),
    description: z.string().optional().describe("Item description"),
    available: z.boolean().default(true).describe("Whether item is available"),
  }),
  async func({ name, category, description, available }) {
    if (!name?.trim()) return "✗ Name is required.";
    const validCats = Object.keys(CHEF_CATEGORIES);
    if (!validCats.includes(category)) return `✗ Invalid category. Use one of: ${validCats.join(', ')}`;

    const { error } = await supabase.from("chef_menu_items").insert([{
      name: name.trim(),
      category,
      description: description || null,
      available: available !== false,
    }]);
    if (error) return `✗ Error: ${error.message}`;
    return `✓ Menu item '${name}' created in ${CHEF_CATEGORIES[category]}.`;
  },
});

export const updateChefMenuItemTool = tool({
  name: "update_chef_menu_item",
  description: "Update an existing chef menu item.",
  schema: z.object({
    identifier: z.string().describe("Menu item name or ID"),
    updates: z.object({
      name: z.string().optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      available: z.boolean().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    let query = supabase.from("chef_menu_items").select("id");
    if (identifier.match(/^[0-9a-f-]{36}$/i)) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }
    const { data: found } = await query.limit(1).single();
    if (!found) return `✗ Menu item '${identifier}' not found.`;

    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.category) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.available !== undefined) payload.available = updates.available;

    const { error } = await supabase.from("chef_menu_items").update(payload).eq("id", found.id);
    if (error) return `✗ Error: ${error.message}`;
    return `✓ Menu item '${identifier}' updated: ${Object.keys(payload).join(', ')}`;
  },
});

export const deleteChefMenuItemTool = tool({
  name: "delete_chef_menu_item",
  description: "Delete a chef menu item.",
  schema: z.object({
    identifier: z.string().describe("Menu item name or ID"),
  }),
  async func({ identifier }) {
    let query = supabase.from("chef_menu_items").select("id, name");
    if (identifier.match(/^[0-9a-f-]{36}$/i)) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }
    const { data: found } = await query.limit(1).single();
    if (!found) return `✗ Menu item '${identifier}' not found.`;

    const { error } = await supabase.from("chef_menu_items").delete().eq("id", found.id);
    if (error) return `✗ Error: ${error.message}`;
    return `✓ Menu item '${found.name}' deleted.`;
  },
});

export const toggleChefMenuAvailabilityTool = tool({
  name: "toggle_chef_menu_availability",
  description: "Toggle a chef menu item's availability (available/unavailable).",
  schema: z.object({
    identifier: z.string().describe("Menu item name or ID"),
  }),
  async func({ identifier }) {
    let query = supabase.from("chef_menu_items").select("id, name, available");
    if (identifier.match(/^[0-9a-f-]{36}$/i)) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }
    const { data: found } = await query.limit(1).single();
    if (!found) return `✗ Menu item '${identifier}' not found.`;

    const newAvail = !found.available;
    const { error } = await supabase.from("chef_menu_items").update({ available: newAvail }).eq("id", found.id);
    if (error) return `✗ Error: ${error.message}`;
    return `✓ '${found.name}' is now ${newAvail ? 'available ✓' : 'unavailable ✗'}.`;
  },
});

// ============================================================================
// EXTRA SELECTIONS TOOLS
// ============================================================================

export const listExtraSelectionsTool = tool({
  name: "list_extra_selections",
  description: "List reservations that have extra selections, with their selection statuses. Optionally filter by status or search by guest/confirmation code.",
  schema: z.object({
    status: z.string().optional().describe("Filter by selection status: pending, completed, submitted"),
    search: z.string().optional().describe("Search by guest name or confirmation code"),
  }),
  async func({ status, search } = {}) {
    let query = supabase.from("reservations")
      .select("id, confirmation_code, group_reservation_code, guest_first_name, guest_last_name, guest_email, check_in, check_out, reservation_extras(id, extra_code, extra_name, quantity, selection_status, selected_at)")
      .not("reservation_extras", "is", null)
      .order("check_in", { ascending: false })
      .limit(30);

    if (search) {
      query = query.or(`confirmation_code.ilike.%${search}%,group_reservation_code.ilike.%${search}%,guest_first_name.ilike.%${search}%,guest_last_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No reservations with extra selections found.";

    // Filter to those that actually have extras
    const withExtras = data.filter(r => r.reservation_extras?.length > 0);
    if (!withExtras.length) return "No reservations with extra selections found.";

    // Optionally filter by status
    let filtered = withExtras;
    if (status) {
      filtered = withExtras.filter(r =>
        r.reservation_extras.some(e => e.selection_status === status)
      );
      if (!filtered.length) return `No extra selections with status '${status}' found.`;
    }

    const rows = filtered.map(r => {
      const statuses = r.reservation_extras.map(e => e.selection_status || 'pending');
      const uniqueStatuses = [...new Set(statuses)];
      return {
        Code: r.confirmation_code,
        Group: r.group_reservation_code || '–',
        Guest: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
        "Check-in": formatDate(r.check_in),
        Extras: r.reservation_extras.length,
        Status: uniqueStatuses.join(', '),
      };
    });

    return formatTable(rows, { minWidth: "500px" });
  },
});

export const getExtraSelectionDetailsTool = tool({
  name: "get_extra_selection_details",
  description: "Get full details of extra selections for a specific reservation or group booking, including selection data with resolved menu item names.",
  schema: z.object({
    confirmation_code: z.string().describe("Reservation confirmation code OR group reservation code (GRP-XXXXXX)"),
  }),
  async func({ confirmation_code }) {
    const code = confirmation_code.toUpperCase();
    const isGroupCode = code.startsWith('GRP-');

    // Fetch reservation(s)
    let reservations = [];
    if (isGroupCode) {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, confirmation_code, group_reservation_code, room_type_code, guest_first_name, guest_last_name, check_in, check_out, adults, children")
        .eq("group_reservation_code", code)
        .order("created_at", { ascending: true });
      if (error || !data?.length) return `✗ Group booking '${code}' not found.`;
      reservations = data;
    } else {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, confirmation_code, group_reservation_code, room_type_code, guest_first_name, guest_last_name, check_in, check_out, adults, children")
        .eq("confirmation_code", code)
        .single();
      if (error || !data) return `✗ Reservation '${code}' not found.`;
      reservations = [data];
    }

    // Fetch all reservation extras for all reservations
    const resIds = reservations.map(r => r.id);
    const { data: extras } = await supabase
      .from("reservation_extras")
      .select("id, reservation_id, extra_code, extra_name, quantity, selection_status, selection_data, selected_at")
      .in("reservation_id", resIds);

    if (!extras?.length) return `No extras found for ${isGroupCode ? 'group booking' : 'reservation'} ${code}.`;

    // Fetch chef menu items to resolve GUIDs
    const { data: menuItems } = await supabase.from("chef_menu_items").select("id, name");
    const menuMap = {};
    if (menuItems) menuItems.forEach(m => { menuMap[m.id] = m.name; });

    // Helper to format selection_data readably
    function formatSelectionData(sd) {
      if (!sd || typeof sd !== 'object') return '';
      let parts = [];

      // Handle dates/allocations structure (chef selections)
      const dateKeys = Object.keys(sd).filter(k => /^\d{4}-\d{2}-\d{2}/.test(k));
      if (dateKeys.length) {
        for (const dateKey of dateKeys) {
          const dayData = sd[dateKey];
          if (dayData && typeof dayData === 'object') {
            parts.push(`  **${formatDate(dateKey)}**:`);
            for (const [meal, items] of Object.entries(dayData)) {
              if (items && typeof items === 'object' && !Array.isArray(items)) {
                const resolved = Object.entries(items).map(([cat, val]) => {
                  const name = menuMap[val] || val;
                  return `${cat}: ${name}`;
                }).join(', ');
                parts.push(`    ${meal}: ${resolved}`);
              } else {
                parts.push(`    ${meal}: ${items}`);
              }
            }
          }
        }
      }

      // Handle allocations structure
      if (sd.allocations && typeof sd.allocations === 'object') {
        for (const [dateKey, dayData] of Object.entries(sd.allocations)) {
          parts.push(`  **${formatDate(dateKey)}**:`);
          if (dayData && typeof dayData === 'object') {
            for (const [meal, items] of Object.entries(dayData)) {
              if (items && typeof items === 'object' && !Array.isArray(items)) {
                const resolved = Object.entries(items).map(([cat, val]) => {
                  const name = menuMap[val] || val;
                  return `${cat}: ${name}`;
                }).join(', ');
                parts.push(`    ${meal}: ${resolved}`);
              }
            }
          }
        }
      }

      // Handle guests structure
      if (sd.guests && typeof sd.guests === 'object') {
        for (const [guestKey, guestData] of Object.entries(sd.guests)) {
          const guestLabel = guestKey.replace('guest_', 'Guest ').replace(/^Guest (\d+)$/, (_, n) => `Guest ${parseInt(n) + 1}`);
          parts.push(`  **${guestLabel}**:`);
          if (guestData && typeof guestData === 'object') {
            for (const [dateKey, meals] of Object.entries(guestData)) {
              const dateLabel = /^\d{4}-\d{2}-\d{2}/.test(dateKey) ? formatDate(dateKey) : dateKey;
              if (meals && typeof meals === 'object') {
                const resolved = Object.entries(meals).map(([meal, items]) => {
                  if (items && typeof items === 'object') {
                    return Object.entries(items).map(([cat, val]) => `${cat}: ${menuMap[val] || val}`).join(', ');
                  }
                  return `${meal}: ${items}`;
                }).join('; ');
                parts.push(`    ${dateLabel}: ${resolved}`);
              }
            }
          }
        }
      }

      // Handle shared_dates
      if (Array.isArray(sd.shared_dates) && sd.shared_dates.length) {
        parts.push(`  Dates: ${sd.shared_dates.map(d => formatDate(d) || d).join(', ')}`);
      }

      // Handle date/time (simple extras like spa, sip & paint)
      if (sd.date) parts.push(`  Date: ${formatDate(sd.date) || sd.date}`);
      if (sd.time) parts.push(`  Time: ${sd.time}`);
      if (sd.special_requests) parts.push(`  Special Requests: ${sd.special_requests}`);

      // Handle guest_names
      if (sd.guest_names && typeof sd.guest_names === 'object') {
        const names = Object.entries(sd.guest_names)
          .filter(([k]) => k.startsWith('guest_'))
          .map(([k, v]) => v || '(unnamed)')
          .join(', ');
        if (names) parts.push(`  Guests: ${names}`);
      }

      return parts.length ? '\n' + parts.join('\n') : '';
    }

    // Build response
    const firstRes = reservations[0];
    let response = `**Extra Selections — ${code}**\n`;
    response += `- **Guest**: ${firstRes.guest_first_name} ${firstRes.guest_last_name}\n`;
    response += `- **Stay**: ${formatDate(firstRes.check_in)} – ${formatDate(firstRes.check_out)}\n`;
    if (isGroupCode) {
      response += `- **Rooms**: ${reservations.map(r => r.room_type_code).join(', ')}\n`;
    }
    response += `\n**Extras Selected:**\n\n`;

    extras.forEach((e, i) => {
      // For group bookings, show which room
      if (isGroupCode) {
        const res = reservations.find(r => r.id === e.reservation_id);
        if (res) response += `*Room: ${res.room_type_code}*\n`;
      }
      response += `${i + 1}. **${e.extra_name}** (${e.extra_code}) × ${e.quantity}\n`;
      response += `- Status: ${e.selection_status || 'pending'}\n`;
      if (e.selection_data) {
        const formatted = formatSelectionData(e.selection_data);
        if (formatted) {
          response += `- Selection Data:${formatted}\n`;
        }
      }
      if (e.selected_at) response += `- Selected at: ${new Date(e.selected_at).toLocaleString()}\n`;
      response += `\n`;
    });

    return response;
  },
});

export const updateExtraSelectionStatusTool = tool({
  name: "update_extra_selection_status",
  description: "Update the selection status of a reservation extra. Valid statuses: pending, completed, submitted.",
  schema: z.object({
    reservation_extra_id: z.string().describe("The reservation_extras record ID"),
    new_status: z.string().describe("New status: pending, completed, or submitted"),
  }),
  async func({ reservation_extra_id, new_status }) {
    const validStatuses = ['pending', 'completed', 'submitted'];
    if (!validStatuses.includes(new_status)) {
      return `✗ Invalid status. Must be one of: ${validStatuses.join(', ')}`;
    }
    const { error } = await supabase
      .from("reservation_extras")
      .update({ selection_status: new_status })
      .eq("id", reservation_extra_id);

    if (error) return `✗ Error: ${error.message}`;
    return `✓ Extra selection status updated to '${new_status}'.`;
  },
});

// ============================================================================
// BLOCKED DATES TOOLS
// ============================================================================

export const blockDatesTool = tool({
  name: "block_dates",
  description: "Block a range of dates for one or more rooms. Creates one blocked_dates row per day per room. Replaces any existing blocks in the range for the specified rooms.",
  schema: z.object({
    room_codes: z.string().describe("JSON array of room codes to block, e.g. [\"SAND\", \"PALM\"], or [\"ALL\"] for all rooms"),
    start_date: z.string().describe("Start date of range to block (YYYY-MM-DD, inclusive)"),
    end_date: z.string().describe("End date of range to block (YYYY-MM-DD, exclusive)"),
    reason: z.string().optional().describe("Reason for blocking (e.g., 'maintenance', 'staff holiday', 'renovation')"),
  }),
  async func({ room_codes, start_date, end_date, reason }) {
    const sd = new Date(start_date + 'T00:00:00');
    const ed = new Date(end_date + 'T00:00:00');
    if (isNaN(sd.getTime()) || isNaN(ed.getTime())) return "✗ Invalid date format. Use YYYY-MM-DD.";
    if (ed <= sd) return "✗ End date must be after start date.";

    let codes;
    try {
      codes = typeof room_codes === 'string' ? JSON.parse(room_codes) : room_codes;
    } catch (e) {
      return "✗ Invalid room_codes format. Use a JSON array.";
    }

    // Resolve room IDs
    let rooms;
    if (codes.length === 1 && codes[0].toUpperCase() === 'ALL') {
      const { data } = await supabase.from("room_types").select("id, code, name");
      rooms = data || [];
    } else {
      const { data } = await supabase.from("room_types").select("id, code, name").in("code", codes.map(c => c.toUpperCase()));
      rooms = data || [];
    }

    if (!rooms.length) return "✗ No matching rooms found.";

    const roomIds = rooms.map(r => r.id);

    // Delete existing blocks in range for these rooms
    const dates = [];
    for (let d = new Date(sd); d < ed; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    if (dates.length > 365) return "✗ Cannot block more than 365 days at once.";

    await supabase.from("blocked_dates").delete()
      .in("room_type_id", roomIds)
      .in("blocked_date", dates);

    // Insert new blocks
    const rows = [];
    for (const roomId of roomIds) {
      for (const date of dates) {
        rows.push({ room_type_id: roomId, blocked_date: date, reason: reason || null });
      }
    }

    const { error } = await supabase.from("blocked_dates").insert(rows);
    if (error) return `✗ Error: ${error.message}`;

    const roomNames = rooms.map(r => r.name).join(', ');
    return `✓ Blocked ${dates.length} days for ${rooms.length} room(s) (${roomNames}).\n- **Range**: ${formatDate(start_date)} to ${formatDate(end_date)}\n- **Reason**: ${reason || 'Not specified'}`;
  },
});

export const unblockDatesTool = tool({
  name: "unblock_dates",
  description: "Remove blocked dates for specified rooms in a date range.",
  schema: z.object({
    room_codes: z.string().describe("JSON array of room codes to unblock, or [\"ALL\"] for all rooms"),
    start_date: z.string().describe("Start date (YYYY-MM-DD, inclusive)"),
    end_date: z.string().describe("End date (YYYY-MM-DD, exclusive)"),
  }),
  async func({ room_codes, start_date, end_date }) {
    let codes;
    try {
      codes = typeof room_codes === 'string' ? JSON.parse(room_codes) : room_codes;
    } catch (e) {
      return "✗ Invalid room_codes format.";
    }

    let rooms;
    if (codes.length === 1 && codes[0].toUpperCase() === 'ALL') {
      const { data } = await supabase.from("room_types").select("id, code, name");
      rooms = data || [];
    } else {
      const { data } = await supabase.from("room_types").select("id, code, name").in("code", codes.map(c => c.toUpperCase()));
      rooms = data || [];
    }

    if (!rooms.length) return "✗ No matching rooms found.";

    const dates = [];
    const sd = new Date(start_date + 'T00:00:00');
    const ed = new Date(end_date + 'T00:00:00');
    for (let d = new Date(sd); d < ed; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    const { error, count } = await supabase.from("blocked_dates").delete()
      .in("room_type_id", rooms.map(r => r.id))
      .in("blocked_date", dates);

    if (error) return `✗ Error: ${error.message}`;
    return `✓ Unblocked dates ${formatDate(start_date)} to ${formatDate(end_date)} for ${rooms.map(r => r.name).join(', ')}.`;
  },
});

export const listBlockedDatesTool = tool({
  name: "list_blocked_dates",
  description: "List currently blocked dates, optionally filtered by room and/or date range.",
  schema: z.object({
    room_code: z.string().optional().describe("Filter by room code"),
    start_date: z.string().optional().describe("Start of range (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End of range (YYYY-MM-DD)"),
  }),
  async func({ room_code, start_date, end_date } = {}) {
    let query = supabase.from("blocked_dates")
      .select("blocked_date, reason, room_types(code, name)")
      .order("blocked_date", { ascending: true })
      .limit(200);

    if (room_code) {
      const { data: room } = await supabase.from("room_types").select("id").eq("code", room_code.toUpperCase()).single();
      if (!room) return `✗ Room '${room_code}' not found.`;
      query = query.eq("room_type_id", room.id);
    }

    if (start_date) query = query.gte("blocked_date", start_date);
    if (end_date) query = query.lt("blocked_date", end_date);

    const { data, error } = await query;
    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No blocked dates found for the specified criteria.";

    const rows = data.map(d => ({
      Date: formatDate(d.blocked_date),
      Room: d.room_types?.name || 'Unknown',
      Code: d.room_types?.code || '',
      Reason: d.reason || '-',
    }));

    return formatTable(rows, { minWidth: "400px" });
  },
});

// ============================================================================
// PACKAGE RESERVATION TOOL (based on PackagesModal.js)
// ============================================================================

export const createPackageReservationTool = tool({
  name: "create_package_reservation",
  description: "Create a reservation using a package. Fetches package details (nights, price, included extras, allowed rooms), checks room availability, and creates the booking. Similar to PackagesModal.js flow.",
  schema: z.object({
    package_code: z.string().describe("Package code or name"),
    room_code: z.string().describe("Room code for the booking (must be one of the package's allowed rooms)"),
    check_in: z.string().describe("Check-in date (YYYY-MM-DD)"),
    guest_first_name: z.string().describe("Guest first name"),
    guest_last_name: z.string().describe("Guest last name"),
    guest_email: z.string().describe("Guest email"),
    guest_phone: z.string().optional().describe("Guest phone number"),
    country_code: z.string().optional().describe("Country dialling code (e.g., +233)"),
    adults: z.number().default(2).describe("Number of adults"),
    children: z.number().default(0).describe("Number of children"),
    notes: z.string().optional().describe("Special requests"),
    coupon_code: z.string().optional().describe("Coupon code to apply"),
  }),
  async func(input) {
    const { check_in, guest_first_name, guest_last_name, guest_email,
            guest_phone, country_code, adults, children, notes, coupon_code } = input;

    // --- Fetch package ---
    let pkgQuery = supabase.from("packages").select("*");
    if (input.package_code.match(/^[0-9a-f-]{36}$/i)) {
      pkgQuery = pkgQuery.eq("id", input.package_code);
    } else {
      pkgQuery = pkgQuery.or(`code.ilike.%${input.package_code}%,name.ilike.%${input.package_code}%`);
    }
    const { data: pkg } = await pkgQuery.limit(1).single();
    if (!pkg) return `✗ Package '${input.package_code}' not found.`;
    if (!pkg.is_active) return `✗ Package '${pkg.name}' is not active.`;

    // Check validity
    const today = new Date().toISOString().split('T')[0];
    if (pkg.valid_from && today < pkg.valid_from) return `✗ Package '${pkg.name}' is not yet valid (starts ${formatDate(pkg.valid_from)}).`;
    if (pkg.valid_until && today > pkg.valid_until) return `✗ Package '${pkg.name}' has expired (ended ${formatDate(pkg.valid_until)}).`;

    // Calculate check-out from package nights
    const ci = new Date(check_in + 'T00:00:00');
    const co = new Date(ci);
    co.setDate(co.getDate() + (pkg.nights || 1));
    const check_out = co.toISOString().split('T')[0];
    const nightsCount = pkg.nights || 1;

    // --- Check room is allowed for this package ---
    const { data: pkgRooms } = await supabase
      .from("packages_rooms")
      .select("room_type_id")
      .eq("package_id", pkg.id);

    const allowedRoomIds = (pkgRooms || []).map(r => r.room_type_id);

    const { data: room } = await supabase
      .from("room_types")
      .select("id, code, name, currency, max_adults")
      .eq("code", input.room_code.toUpperCase())
      .single();

    if (!room) return `✗ Room '${input.room_code}' not found.`;
    if (allowedRoomIds.length > 0 && !allowedRoomIds.includes(room.id)) {
      return `✗ Room '${room.name}' is not available for package '${pkg.name}'. Check package details for allowed rooms.`;
    }

    // --- Check capacity ---
    if (adults > (room.max_adults || 4)) {
      return `✗ ${room.name} supports max ${room.max_adults || 4} adults.`;
    }

    // --- Check availability ---
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("confirmation_code")
      .eq("room_type_id", room.id)
      .in("status", ["confirmed", "checked-in"])
      .or(`and(check_in.lt.${check_out},check_out.gt.${check_in})`);

    if (conflicts?.length) return `✗ ${room.name} is NOT available for ${formatDate(check_in)} – ${formatDate(check_out)}.`;

    const { data: blocked } = await supabase
      .from("blocked_dates")
      .select("blocked_date")
      .eq("room_type_id", room.id)
      .gte("blocked_date", check_in)
      .lt("blocked_date", check_out);

    if (blocked?.length) return `✗ ${room.name} has blocked dates in that range.`;

    // --- Package price ---
    const roomSubtotal = Number(pkg.package_price || 0);
    const currency = pkg.currency || room.currency || 'GHS';

    // --- Fetch package extras ---
    const { data: pkgExtras } = await supabase
      .from("package_extras")
      .select("extra_id, quantity, code")
      .eq("package_id", pkg.id);

    let extrasTotal = 0;
    let selectedExtras = [];
    if (pkgExtras?.length) {
      const extraIds = pkgExtras.map(pe => pe.extra_id).filter(Boolean);
      const extraCodes = pkgExtras.map(pe => pe.code).filter(Boolean);

      let extrasData = [];
      if (extraIds.length) {
        const { data } = await supabase.from("extras").select("id, name, code, price").in("id", extraIds);
        extrasData = data || [];
      } else if (extraCodes.length) {
        const { data } = await supabase.from("extras").select("id, name, code, price").in("code", extraCodes);
        extrasData = data || [];
      }

      const extrasMap = {};
      extrasData.forEach(e => { extrasMap[e.id] = e; extrasMap[e.code] = e; });

      for (const pe of pkgExtras) {
        const extra = extrasMap[pe.extra_id] || extrasMap[pe.code];
        if (extra) {
          const qty = pe.quantity || 1;
          // Package price includes extras, so don't add to total
          selectedExtras.push({
            extra_code: extra.code || '',
            extra_name: extra.name || '',
            price: Number(extra.price || 0),
            quantity: qty,
            subtotal: Number(extra.price || 0) * qty,
            discount_amount: 0,
          });
        }
      }
    }

    // --- Apply coupon ---
    let discountAmount = 0;
    let appliedCouponCode = null;
    if (coupon_code) {
      const { data: coupon } = await supabase.from("coupons").select("*").eq("code", coupon_code.toUpperCase()).eq("is_active", true).single();
      if (coupon) {
        const todayStr = new Date().toISOString().split('T')[0];
        const isValid = (!coupon.valid_from || coupon.valid_from <= todayStr) &&
                       (!coupon.valid_until || coupon.valid_until >= todayStr) &&
                       (!coupon.max_uses || (coupon.current_uses || 0) < coupon.max_uses);
        if (isValid) {
          discountAmount = coupon.discount_type === 'percentage'
            ? (roomSubtotal * coupon.discount_value) / 100
            : Math.min(coupon.discount_value, roomSubtotal);
          appliedCouponCode = coupon.code;
          await supabase.from("coupons").update({ current_uses: (coupon.current_uses || 0) + 1 }).eq("id", coupon.id);
        }
      }
    }

    const total = Math.max(0, roomSubtotal - discountAmount);
    const confirmationCode = ('B' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)).toUpperCase();

    // --- Insert reservation ---
    const payload = {
      confirmation_code: confirmationCode,
      room_type_id: room.id,
      room_type_code: room.code,
      room_name: room.name,
      check_in,
      check_out,
      nights: nightsCount,
      guest_first_name: guest_first_name || null,
      guest_last_name: guest_last_name || null,
      guest_email: guest_email || null,
      guest_phone: guest_phone || null,
      country_code: country_code || null,
      adults: adults || 2,
      children: children || 0,
      room_subtotal: roomSubtotal,
      extras_total: 0, // package price includes extras
      discount_amount: discountAmount,
      coupon_code: appliedCouponCode,
      total,
      currency,
      status: 'confirmed',
      payment_status: 'unpaid',
      is_influencer: false,
      notes: notes || null,
      package_id: pkg.id,
      package_code: pkg.code || null,
      package_name: pkg.name,
    };

    const { data: reservation, error: insertErr } = await supabase.from("reservations").insert(payload).select().single();
    if (insertErr) return `✗ Failed to create reservation: ${insertErr.message}`;

    // --- Insert package extras ---
    if (selectedExtras.length > 0 && reservation) {
      const extrasPayload = selectedExtras.map(e => ({ ...e, reservation_id: reservation.id }));
      await supabase.from("reservation_extras").insert(extrasPayload);
    }

    let response = `✓ **Package Booking Created**\n\n`;
    response += `- **Confirmation Code**: ${confirmationCode}\n`;
    response += `- **Package**: ${pkg.name} (${pkg.code || 'N/A'})\n`;
    response += `- **Cabin**: ${room.name} (${room.code})\n`;
    response += `- **Check-in**: ${formatDate(check_in)}\n`;
    response += `- **Check-out**: ${formatDate(check_out)} (${nightsCount} nights)\n`;
    response += `- **Guest**: ${guest_first_name} ${guest_last_name}\n`;
    response += `- **Email**: ${guest_email}\n`;
    response += `- **Package Price**: ${currency} ${roomSubtotal.toFixed(2)}\n`;

    if (selectedExtras.length > 0) {
      response += `- **Included Extras**: ${selectedExtras.map(e => e.extra_name).join(', ')}\n`;
    }
    if (discountAmount > 0) {
      response += `- **Discount** (${appliedCouponCode}): -${currency} ${discountAmount.toFixed(2)}\n`;
    }
    response += `- **Total**: ${currency} ${total.toFixed(2)}\n`;
    response += `- **Status**: Confirmed | **Payment**: Unpaid`;

    return response;
  },
});

// Export all tools
export const allTools = [
  // Rooms
  listRoomsTool,
  getRoomDetailsTool,
  createRoomTypeTool,
  updateRoomTypeTool,
  deleteRoomTypeTool,
  
  // Extras
  listExtrasTool,
  getExtraDetailsTool,
  createExtraTool,
  updateExtraTool,
  deleteExtraTool,
  
  // Packages
  listPackagesTool,
  getPackageDetailsTool,
  createPackageTool,
  updatePackageTool,
  deletePackageTool,
  
  // Coupons
  listCouponsTool,
  getCouponDetailsTool,
  createCouponTool,
  updateCouponTool,
  deleteCouponTool,
  validateCouponTool,
  
  // Reservations
  searchReservationsTool,
  getReservationDetailsTool,
  createReservationTool,
  createGroupReservationTool,
  editReservationTool,
  updateReservationStatusTool,
  updateReservationDetailsTool,
  cancelReservationTool,
  deleteReservationTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  checkAllAvailabilityTool,
  sendBookingEmailTool,
  
  // Analytics
  getOccupancyStatsTool,
  getRevenueStatsTool,
  getClientAnalyticsTool,
  comparePeriodsAnalyticsTool,
  
  // Pricing Models
  listPricingModelsTool,
  getPricingModelDetailsTool,
  simulatePricingTool,
  getSeasonalPricingTool,

  // Chef Menu
  listChefMenuItemsTool,
  getChefMenuItemDetailsTool,
  createChefMenuItemTool,
  updateChefMenuItemTool,
  deleteChefMenuItemTool,
  toggleChefMenuAvailabilityTool,

  // Extra Selections
  listExtraSelectionsTool,
  getExtraSelectionDetailsTool,
  updateExtraSelectionStatusTool,

  // Blocked Dates
  blockDatesTool,
  unblockDatesTool,
  listBlockedDatesTool,

  // Package Reservations
  createPackageReservationTool,
];