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

  return `<div class="chat-table-scroll"><table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:${options.minWidth || '480px'}"><thead style="background:#f8fafc;"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
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
    identifier: z.string().describe("Extra name or ID"),
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
    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.code) payload.code = updates.code.toUpperCase();
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price) payload.price = updates.price;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.unit_type) payload.unit_type = updates.unit_type;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.needs_guest_input !== undefined) payload.needs_guest_input = updates.needs_guest_input;

    let query = supabase.from("extras").update(payload);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }

    const { error } = await query;

    if (error) return `Error updating extra: ${error.message}`;

    return `✓ Extra '${identifier}' updated successfully!
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
  description: "Create a new package. Requires explicit user confirmation before executing.",
  schema: z.object({
    name: z.string().describe("Package name"),
    description: z.string().optional().describe("Package description"),
    nights: z.number().describe("Number of nights required"),
    package_price: z.number().optional().describe("Package price"),
    currency: z.string().default("GBP"),
    is_active: z.boolean().default(true),
    is_featured: z.boolean().default(false),
  }),
  async func(input) {
    const { error } = await supabase.from("packages").insert({
      name: input.name,
      description: input.description || null,
      nights: input.nights,
      package_price: input.package_price || null,
      currency: input.currency,
      is_active: input.is_active,
      is_featured: input.is_featured,
    });

    if (error) return `Error creating package: ${error.message}`;

    return `✓ Package "${input.name}" created successfully!
- Nights: ${input.nights}
- Package Price: ${input.currency} ${input.package_price || 'Not set'}
- Status: ${input.is_active ? 'Active' : 'Inactive'}
- Featured: ${input.is_featured ? 'Yes' : 'No'}`;
  },
});

export const updatePackageTool = tool({
  name: "update_package",
  description: "Update an existing package. Requires explicit user confirmation before executing.",
  schema: z.object({
    identifier: z.string().describe("Package name or ID"),
    updates: z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      nights: z.number().optional(),
      package_price: z.number().optional(),
      currency: z.string().optional(),
      is_active: z.boolean().optional(),
      is_featured: z.boolean().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.nights) payload.nights = updates.nights;
    if (updates.package_price !== undefined) payload.package_price = updates.package_price;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;
    if (updates.is_featured !== undefined) payload.is_featured = updates.is_featured;

    let query = supabase.from("packages").update(payload);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.ilike("name", `%${identifier}%`);
    }

    const { error } = await query;

    if (error) return `Error updating package: ${error.message}`;

    return `✓ Package '${identifier}' updated successfully!
Updated fields: ${Object.keys(payload).join(', ')}`;
  },
});

export const deletePackageTool = tool({
  name: "delete_package",
  description: "Delete a package. Requires explicit user confirmation before executing. WARNING: This is permanent!",
  schema: z.object({
    identifier: z.string().describe("Package name or ID to delete"),
  }),
  async func({ identifier }) {
    let query = supabase.from("packages").delete();
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier).select();
    } else {
      query = query.ilike("name", `%${identifier}%`).select();
    }

    const { data, error } = await query;

    if (error) {
      // Check for foreign key constraint error
      if (error.code === '23503') {
        return `✗ Cannot delete package '${identifier}': This package is being used in existing reservations. You must delete or reassign those reservations first.`;
      }
      return `Error deleting package: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return `✗ Package '${identifier}' not found or could not be deleted. It may be in use by reservations.`;
    }

    return `✓ Package '${identifier}' deleted successfully. This action is permanent.`;
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
          "Valid Until": formatDate(c.valid_until) || 'No expiry',
          Active: c.is_active ? "✓" : "✗",
          Status: isValid ? "Valid ✓" : "Expired/Inactive",
        };
      }),
      { minWidth: "480px" }
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

    return `
**${data.code}**
- **Discount**: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `${data.currency || 'GHS'} ${data.discount_value}`}
- **Type**: ${data.discount_type}
- **Valid From**: ${formatDate(data.valid_from) || 'N/A'}
- **Valid Until**: ${formatDate(data.valid_until) || 'No expiry'}
- **Usage Limit**: ${data.usage_limit || 'Unlimited'}
- **Times Used**: ${data.usage_count || 0}
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
    code: z.string().describe("Coupon code (e.g., 'SUMMER2025')"),
    discount_type: z.enum(["percentage", "fixed"]).describe("Type of discount"),
    discount_value: z.number().describe("Discount amount (e.g., 20 for 20% or $20)"),
    currency: z.string().default("GBP").describe("Currency for fixed discounts"),
    description: z.string().optional(),
    valid_from: z.string().optional().describe("Valid from date (YYYY-MM-DD)"),
    valid_until: z.string().optional().describe("Valid until date (YYYY-MM-DD)"),
    usage_limit: z.number().optional().describe("Maximum number of uses"),
    is_active: z.boolean().default(true),
  }),
  async func(input) {
    const { error } = await supabase.from("coupons").insert({
      code: input.code.toUpperCase(),
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      currency: input.currency,
      description: input.description || null,
      valid_from: input.valid_from || null,
      valid_until: input.valid_until || null,
      usage_limit: input.usage_limit || null,
      usage_count: 0,
      is_active: input.is_active,
    });

    if (error) return `Error creating coupon: ${error.message}`;

    return `✓ Coupon "${input.code.toUpperCase()}" created successfully!
- Discount: ${input.discount_type === 'percentage' ? `${input.discount_value}%` : `${input.currency} ${input.discount_value}`}
- Valid: ${input.valid_from || 'Now'} to ${input.valid_until || 'No expiry'}
- Usage Limit: ${input.usage_limit || 'Unlimited'}
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
      currency: z.string().optional(),
      description: z.string().optional(),
      valid_from: z.string().optional(),
      valid_until: z.string().optional(),
      usage_limit: z.number().optional(),
      is_active: z.boolean().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    const payload = {};
    if (updates.code) payload.code = updates.code.toUpperCase();
    if (updates.discount_type) payload.discount_type = updates.discount_type;
    if (updates.discount_value) payload.discount_value = updates.discount_value;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.valid_from !== undefined) payload.valid_from = updates.valid_from;
    if (updates.valid_until !== undefined) payload.valid_until = updates.valid_until;
    if (updates.usage_limit !== undefined) payload.usage_limit = updates.usage_limit;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;

    let query = supabase.from("coupons").update(payload);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("code", identifier.toUpperCase());
    }

    const { error } = await query;

    if (error) return `Error updating coupon: ${error.message}`;

    return `✓ Coupon '${identifier}' updated successfully!
Updated fields: ${Object.keys(payload).join(', ')}`;
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
    if (c.usage_limit && c.usage_count >= c.usage_limit) {
      return `❌ Coupon '${code}' has reached its usage limit (${c.usage_limit}).`;
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
- Uses Remaining: ${c.usage_limit ? `${c.usage_limit - c.usage_count}` : 'Unlimited'}`;
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
  description: "Get full details of a specific reservation by confirmation code or ID.",
  schema: z.object({
    identifier: z.string().describe("Confirmation code or reservation ID")
  }),
  async func({ identifier }) {
    let query = supabase.from("reservations").select(`
      *,
      room_types (name, code),
      packages (name)
    `);
    
    if (identifier.length > 20 && identifier.includes('-')) {
      query = query.eq("id", identifier);
    } else {
      query = query.eq("confirmation_code", identifier.toUpperCase());
    }

    const { data, error } = await query.single();

    if (error) return `Error: ${error.message}`;
    if (!data) return `Reservation '${identifier}' not found.`;

    const r = data;

    return `
**Reservation ${r.confirmation_code}**

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
- Discount: ${r.currency || 'GHS'} ${r.discount_amount || 0}
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
      return `✓ Room '${room.name}' (${room_code}) is AVAILABLE for ${formatDate(check_in)} to ${formatDate(check_out)}`;
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

    rooms.forEach(room => {
      const roomConflicts = conflictsByRoom[room.id] || [];
      const roomBlocked = blockedByRoom[room.id] || [];
      const currency = room.currency || 'GHS';

      if (roomConflicts.length === 0 && roomBlocked.length === 0) {
        available.push({
          Code: room.code,
          Name: room.name,
          "Weekday Price": `${currency} ${room.base_price_per_night_weekday}`,
          "Weekend Price": `${currency} ${room.base_price_per_night_weekend}`,
          "Max Adults": room.max_adults || 2,
        });
      } else {
        const reason = roomConflicts.length > 0
          ? `Booked (${roomConflicts[0].confirmation_code})`
          : `Blocked dates`;
        unavailable.push({ code: room.code, name: room.name, reason });
      }
    });

    let result = `**Availability for ${formatDate(check_in)} to ${formatDate(check_out)}:**\n\n`;

    if (available.length > 0) {
      result += `**✓ Available Rooms (${available.length}):**\n`;
      result += formatTable(available, { minWidth: "400px" });
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
  description: "Create a new reservation. MUST check availability first using check_availability. Requires: room_code, check_in, check_out, guest_first_name, guest_last_name, guest_email. Optional: guest_phone, adults, children, notes, extras, coupon_code. The tool handles pricing calculation automatically.",
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
  }),
  async func(input) {
    const { room_code, check_in, check_out, guest_first_name, guest_last_name,
            guest_email, guest_phone, country_code, adults, children, notes,
            extras, coupon_code } = input;

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

    // --- Calculate pricing ---
    let roomSubtotal = 0;

    // Try dynamic pricing first
    try {
      const { data: pricingData } = await supabase.rpc('calculate_dynamic_price', {
        p_room_type_id: room.id,
        p_check_in: check_in,
        p_check_out: check_out,
        p_pricing_model_id: null
      });

      if (pricingData && pricingData.total) {
        roomSubtotal = parseFloat(pricingData.total);
      }
    } catch (e) {
      // Dynamic pricing not available, fallback below
    }

    // Fallback to base prices
    if (roomSubtotal === 0) {
      const wkdPrice = Number(room.base_price_per_night_weekday || 0);
      const wkePrice = Number(room.base_price_per_night_weekend || 0);
      for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        roomSubtotal += (dow === 5 || dow === 6) ? wkePrice : wkdPrice;
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

    // --- Apply coupon ---
    let discountAmount = 0;
    let appliedCouponCode = null;
    if (coupon_code) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", coupon_code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (coupon) {
        const today = new Date().toISOString().split('T')[0];
        const isValid = (!coupon.valid_from || coupon.valid_from <= today) &&
                       (!coupon.valid_until || coupon.valid_until >= today) &&
                       (!coupon.usage_limit || coupon.usage_count < coupon.usage_limit);

        if (isValid) {
          const base = coupon.applies_to === 'rooms' ? roomSubtotal
                     : coupon.applies_to === 'extras' ? extrasTotal
                     : roomSubtotal + extrasTotal;

          discountAmount = coupon.discount_type === 'percentage'
            ? (base * coupon.discount_value) / 100
            : Math.min(coupon.discount_value, base);

          appliedCouponCode = coupon.code;

          // Update coupon usage
          await supabase
            .from("coupons")
            .update({ usage_count: (coupon.usage_count || 0) + 1 })
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
      coupon_code: appliedCouponCode,
      total,
      currency,
      status: 'confirmed',
      payment_status: 'unpaid',
      is_influencer: false,
      notes: notes || null,
    };

    const { data: reservation, error: insertErr } = await supabase
      .from("reservations")
      .insert(payload)
      .select()
      .single();

    if (insertErr) return `✗ Failed to create reservation: ${insertErr.message}`;

    // --- Insert extras ---
    if (selectedExtras.length > 0 && reservation) {
      const extrasPayload = selectedExtras.map(e => ({
        reservation_id: reservation.id,
        extra_code: e.extra_code,
        extra_name: e.extra_name,
        price: e.price,
        quantity: e.quantity,
        subtotal: e.subtotal,
        discount_amount: e.discount_amount,
      }));

      await supabase.from("reservation_extras").insert(extrasPayload);
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
  description: "Send booking emails to the guest. Can send: 'confirmation' (booking confirmation), 'extras' (extras selection email), or 'both'. Defaults to 'both'.",
  schema: z.object({
    confirmation_code: z.string().describe("The reservation confirmation code"),
    email_type: z.enum(["confirmation", "extras", "both"]).default("both").describe("Which email to send: 'confirmation', 'extras', or 'both' (default)"),
  }),
  async func({ confirmation_code, email_type = "both" }) {
    // Fetch reservation
    const { data: res, error } = await supabase
      .from("reservations")
      .select("*, room_types(name, code)")
      .eq("confirmation_code", confirmation_code.toUpperCase())
      .single();

    if (error || !res) return `✗ Reservation '${confirmation_code}' not found.`;
    if (!res.guest_email) return `✗ No email address on file for reservation ${confirmation_code}.`;

    // Fetch reservation extras
    const { data: resExtras } = await supabase
      .from("reservation_extras")
      .select("extra_name, extra_code, price, quantity, subtotal, discount_amount")
      .eq("reservation_id", res.id);

    // Fetch full extras config from the extras table (name, code, needs_guest_input)
    const extraCodes = (resExtras || []).map(e => e.extra_code).filter(Boolean);
    let extrasConfigMap = {};
    if (extraCodes.length) {
      const { data: extrasConfig } = await supabase
        .from("extras")
        .select("code, name, needs_guest_input")
        .in("code", extraCodes);
      (extrasConfig || []).forEach(e => {
        extrasConfigMap[e.code] = { name: e.name, needs_guest_input: !!e.needs_guest_input };
      });
    }

    // Check if this is a package booking (all extras need selection for packages)
    const isPackage = !!(res.package_id || res.package_code || res.package_name);

    const extras = (resExtras || []).map(e => {
      const config = extrasConfigMap[e.extra_code] || {};
      // Use extras table name as fallback if reservation_extras.extra_name is empty
      const extraName = e.extra_name || config.name || '';
      return {
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
    });

    // Build email data matching the webhook structure
    const emailData = {
      booking: {
        confirmation_code: res.confirmation_code,
        group_reservation_code: null,
        guest_first_name: res.guest_first_name,
        guest_last_name: res.guest_last_name,
        guest_email: res.guest_email,
        guest_phone: res.guest_phone,
        check_in: res.check_in,
        check_out: res.check_out,
        nights: res.nights,
        adults: res.adults,
        currency: res.currency || 'GHS',
        room_name: res.room_name || res.room_types?.name || '',
        room_subtotal: res.room_subtotal,
        extras_total: res.extras_total,
        discount_amount: res.discount_amount,
        coupon_code: res.coupon_code,
        total: res.total,
        is_group_booking: false,
        rooms: [{
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
          extras,
        }],
      },
    };

    const results = [];
    const hasExtrasNeedingSelection = extras.some(e => e.needs_selection);

    // Send confirmation email
    if (email_type === "confirmation" || email_type === "both") {
      try {
        const emailResp = await fetch(`${SOJOURN_API_BASE_URL}/api/send-booking-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailData),
        });

        if (!emailResp.ok) {
          const errText = await emailResp.text().catch(() => '');
          return `✗ Failed to send confirmation email (${emailResp.status}): ${errText}`;
        }
        results.push(`✓ Confirmation email sent to ${res.guest_email} for booking ${confirmation_code}.`);
      } catch (err) {
        return `✗ Failed to send confirmation email: ${err.message}`;
      }
    }

    // Send extras selection email
    if (email_type === "extras" || email_type === "both") {
      const hasExtras = extras.length > 0;
      // For explicit "extras" request: send if there are any extras at all
      // For "both": only send if extras need guest selection
      const shouldSendExtras = email_type === "extras" ? hasExtras : hasExtrasNeedingSelection;

      if (!hasExtras && email_type === "extras") {
        results.push(`⚠ No extras found on this booking.`);
      } else if (shouldSendExtras) {
        try {
          const extrasLink = `${SOJOURN_API_BASE_URL}/extra-selections?code=${encodeURIComponent(confirmation_code)}`;
          const extrasResp = await fetch(`${SOJOURN_API_BASE_URL}/api/send-extra-selections-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ booking: emailData.booking, extrasLink }),
          });

          if (!extrasResp.ok) {
            const errText = await extrasResp.text().catch(() => '');
            results.push(`✗ Failed to send extras selection email (${extrasResp.status}): ${errText}`);
          } else {
            results.push(`✓ Extras selection email sent to ${res.guest_email}.`);
          }
        } catch (err) {
          results.push(`✗ Failed to send extras selection email: ${err.message}`);
        }
      }
    }

    return results.join('\n');
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
];