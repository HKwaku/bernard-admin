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

  return `
  <div style="
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
    margin:8px 0;
    border:1px solid #e5e7eb;
    border-radius:8px;
  ">
    <table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:${options.minWidth || '480px'}">
      <thead style="background:#f8fafc;">
        <tr>
          ${keys
            .map(
              (k) =>
                `<th style="text-align:left;padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;white-space:nowrap">${k.replace(/_/g, ' ')}</th>`
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            ${keys
              .map(
                (k) =>
                  `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;">${r[k] ?? ''}</td>`
              )
              .join("")}
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
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
        "Weekday Price": `${r.currency || 'GBP'} ${r.base_price_per_night_weekday}`,
        "Weekend Price": `${r.currency || 'GBP'} ${r.base_price_per_night_weekend}`,
        Active: r.is_active ? "✓" : "✗",
        Image: r.image_url ? "Yes" : "No"
      })),
      { minWidth: "600px" }
    );
  },
});

export const getRoomDetailsTool = tool({
  name: "get_room_type_details",
  description: "Get full details of a specific room type by code or ID.",
  schema: z.object({
    identifier: z.string().describe("Room code (e.g., 'SAND') or room ID")
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
  - Weekday: ${data.currency || 'GBP'} ${data.base_price_per_night_weekday}
  - Weekend: ${data.currency || 'GBP'} ${data.base_price_per_night_weekend}
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
  description: "List all extras/add-ons with their pricing, category, and unit type.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("extras")
      .select("*")
      .order("name", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No extras found.";

    return formatTable(
      data.map(e => ({
        Name: e.name,
        Category: e.category || "N/A",
        Price: `${e.currency || 'GBP'} ${e.price}`,
        "Unit Type": e.unit_type?.replace(/_/g, ' ') || 'per booking',
        Active: e.is_active ? "✓" : "✗",
      })),
      { minWidth: "520px" }
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
**${extra.name}**
- **Category**: ${extra.category || 'N/A'}
- **Price**: ${extra.currency || 'GBP'} ${extra.price} ${extra.unit_type?.replace(/_/g, ' ') || 'per booking'}
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
    category: z.string().optional().describe("Category (e.g., 'Transport', 'Food', 'Activity')"),
    description: z.string().optional().describe("Description"),
    price: z.number().describe("Price amount"),
    currency: z.string().default("GBP").describe("Currency code"),
    unit_type: z.enum(["per_booking", "per_night", "per_person", "per_person_per_night"]).default("per_booking"),
    is_active: z.boolean().default(true),
  }),
  async func(input) {
    const { error } = await supabase.from("extras").insert({
      name: input.name,
      category: input.category || null,
      description: input.description || null,
      price: input.price,
      currency: input.currency,
      unit_type: input.unit_type,
      is_active: input.is_active,
    });

    if (error) return `Error creating extra: ${error.message}`;

    return `✓ Extra "${input.name}" created successfully!
- Price: ${input.currency} ${input.price} ${input.unit_type.replace(/_/g, ' ')}
- Category: ${input.category || 'N/A'}
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
      category: z.string().optional(),
      description: z.string().optional(),
      price: z.number().optional(),
      currency: z.string().optional(),
      unit_type: z.enum(["per_booking", "per_night", "per_person", "per_person_per_night"]).optional(),
      is_active: z.boolean().optional(),
    }),
  }),
  async func({ identifier, updates }) {
    const payload = {};
    if (updates.name) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.price) payload.price = updates.price;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.unit_type) payload.unit_type = updates.unit_type;
    if (updates.is_active !== undefined) payload.is_active = updates.is_active;

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
  description: "List all packages (active and inactive) with their pricing and minimum nights.",
  schema: z.object({}),
  async func(_input) {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .order("name", { ascending: true });

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No packages found.";

    return formatTable(
      data.map(p => ({
        Name: p.name,
        "Min Nights": p.nights || 'N/A',
        "Package Price": `${p.currency || 'GHS'} ${p.package_price || 'N/A'}`,
        "Valid From": formatDate(p.valid_from) || 'N/A',
        "Valid Until": formatDate(p.valid_until) || 'N/A',
        "Cabin": p.room_name || 'N/A',
        Active: p.is_active ? "✓" : "✗",
        Featured: p.is_featured ? "⭐" : "",
      })),
      { minWidth: "500px" }
    );
  },
});

export const getPackageDetailsTool = tool({
  name: "get_package_details",
  description: "Get full details of a specific package including included extras.",
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

    let response = `
**${pkg.name}**
- **Status**: ${pkg.is_active ? 'Active ✓' : 'Inactive ✗'}
- **Featured**: ${pkg.is_featured ? 'Yes ⭐' : 'No'}
- **Minimum Nights**: ${pkg.nights || 'N/A'}
- **Package Price**: ${pkg.currency || 'GHS'} ${pkg.package_price || 'N/A'}
- **Description**: ${pkg.description || 'N/A'}
- **Package ID**: ${pkg.id}
`;

    if (pkg.package_extras?.length) {
      response += `\n**Included Extras**:\n`;
      pkg.package_extras.forEach(pe => {
        if (pe.extras) {
          response += `- ${pe.extras.name} (Qty: ${pe.quantity || 1})\n`;
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
          Value: c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.currency || 'GBP'} ${c.discount_value}`,
          "Valid Until": formatDate(c.valid_until) || 'No expiry',
          Active: c.is_active ? "✓" : "✗",
          Status: isValid ? "Valid ✓" : "Expired/Inactive",
        };
      }),
      { minWidth: "600px" }
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
- **Discount**: ${data.discount_type === 'percentage' ? `${data.discount_value}%` : `${data.currency || 'GBP'} ${data.discount_value}`}
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
- Original Total: ${c.currency || 'GBP'} ${booking_total.toFixed(2)}
- Discount Amount: ${c.currency || 'GBP'} ${discount.toFixed(2)}
- Final Total: ${c.currency || 'GBP'} ${final_total.toFixed(2)}
- Uses Remaining: ${c.usage_limit ? `${c.usage_limit - c.usage_count}` : 'Unlimited'}`;
  },
});

// ============================================================================
// RESERVATIONS TOOLS
// ============================================================================

export const searchReservationsTool = tool({
  name: "search_reservations",
  description: "Search for reservations by guest name, email, confirmation code, or status.",
  schema: z.object({
    query: z.string().optional().describe("Search term (name, email, or confirmation code)"),
    status: z.string().optional().describe("Filter by status (e.g., 'confirmed', 'cancelled')"),
    limit: z.number().default(10).describe("Maximum number of results"),
  }),
  async func({ query, status, limit }) {
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
        status,
        total,
        currency,
        room_types (name, code)
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (query) {
      dbQuery = dbQuery.or(`guest_first_name.ilike.%${query}%,guest_last_name.ilike.%${query}%,guest_email.ilike.%${query}%,confirmation_code.ilike.%${query}%`);
    }

    if (status) {
      dbQuery = dbQuery.eq("status", status.toLowerCase());
    }

    const { data, error } = await dbQuery;

    if (error) return `Error: ${error.message}`;
    if (!data?.length) return "No reservations found matching the criteria.";

    return formatTable(
      data.map(r => ({
        Code: r.confirmation_code,
        Guest: `${r.guest_first_name || ''} ${r.guest_last_name || ''}`.trim(),
        Email: r.guest_email,
        Room: r.room_types?.name || 'N/A',
        "Check-in": formatDate(r.check_in),
        "Check-out": formatDate(r.check_out),
        Status: r.status,
        Total: `${r.currency || 'GBP'} ${r.total || 0}`,
      })),
      { minWidth: "700px" }
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
- Room Subtotal: ${r.currency || 'GBP'} ${r.room_subtotal || 0}
- Extras Subtotal: ${r.currency || 'GBP'} ${r.extras_total || 0}
- Discount: ${r.currency || 'GBP'} ${r.discount_amount || 0}
- Total: ${r.currency || 'GBP'} ${r.total || 0}

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
      { minWidth: "600px" }
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
    // Defaults: current month (start = 1st of month, end = 1st of next month)
    const now = new Date();
    const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const start_date_safe = start_date || defaultStart.toISOString().slice(0, 10);
    const end_date_safe = end_date || defaultEnd.toISOString().slice(0, 10);

    // Get all room types or specific room
    let roomQuery = supabase.from("room_types").select("id, code, name");
    if (room_code) {
      roomQuery = roomQuery.eq("code", room_code.toUpperCase());
    }
    const { data: rooms } = await roomQuery;
    
    if (!rooms?.length) return `No rooms found${room_code ? ` with code ${room_code}` : ''}.`;

    // Calculate days in range
    const start = new Date(start_date);
    const end = new Date(end_date);
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    let results = [];

    for (const room of rooms) {
      // Get reservations for this room in date range
      const { data: reservations } = await supabase
        .from("reservations")
        .select("check_in, check_out")
        .eq("room_type_id", room.id)
        .in("status", ["confirmed", "checked-in", "checked-out"])
        .not("is_influencer", "eq", true);

      // Count occupied nights
      let occupiedNights = 0;
      
      if (reservations) {
        for (const res of reservations) {
          const checkIn = new Date(res.check_in);
          const checkOut = new Date(res.check_out);
          
          // Calculate overlap with date range
          const overlapStart = checkIn > start ? checkIn : start;
          const overlapEnd = checkOut < end ? checkOut : end;
          
          if (overlapStart < overlapEnd) {
            occupiedNights += Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
          }
        }
      }

      const occupancyRate = totalDays > 0 ? (occupiedNights / totalDays) * 100 : 0;

      results.push({
        Room: `${room.name} (${room.code})`,
        "Occupied Nights": occupiedNights,
        "Total Nights": totalDays,
        "Occupancy %": occupancyRate.toFixed(1) + "%",
      });
    }

    if (results.length === 0) return "No data available for the specified period.";

    // Calculate overall if multiple rooms
    if (results.length > 1) {
      const totalOccupied = results.reduce((sum, r) => sum + parseInt(r["Occupied Nights"]), 0);
      const totalAvailable = results.reduce((sum, r) => sum + parseInt(r["Total Nights"]), 0);
      const overallRate = (totalOccupied / totalAvailable) * 100;

      results.push({
        Room: "**OVERALL**",
        "Occupied Nights": totalOccupied,
        "Total Nights": totalAvailable,
        "Occupancy %": overallRate.toFixed(1) + "%",
      });
    }

    return `**Occupancy Report: ${start_date} to ${end_date}**\n\n${formatTable(results, { minWidth: "500px" })}`;
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
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select(`
        room_subtotal,
        extras_total,
        discount_amount,
        total,
        currency,
        package_id,
        packages (name)
      `)
      .gte("check_in", start_date)
      .lte("check_in", end_date)
      .in("status", ["confirmed", "checked-in", "checked-out"])
      .not("is_influencer", "eq", true);

    if (error) return `Error: ${error.message}`;
    if (!reservations?.length) return "No reservations found in the specified period.";

    // Aggregate data
    let roomRevenue = 0;
    let extrasRevenue = 0;
    let totalDiscount = 0;
    let packageBookings = 0;
    let customBookings = 0;
    const currency = reservations[0]?.currency || "GBP";

    reservations.forEach(r => {
      roomRevenue += parseFloat(r.room_subtotal || 0);
      extrasRevenue += parseFloat(r.extras_total || 0);
      totalDiscount += parseFloat(r.discount_amount || 0);
      
      if (r.package_id) packageBookings++;
      else customBookings++;
    });

    const totalRevenue = roomRevenue + extrasRevenue - totalDiscount;
    const avgBookingValue = totalRevenue / reservations.length;

    return `**Revenue Report: ${start_date} to ${end_date}**

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

**Revenue Mix:**
- Rooms: ${((roomRevenue / totalRevenue) * 100).toFixed(1)}%
- Extras: ${((extrasRevenue / totalRevenue) * 100).toFixed(1)}%
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
      .select("guest_first_name, guest_last_name, guest_email, total, currency, created_at")
      .in("status", ["confirmed", "checked-in", "checked-out"])
      .not("is_influencer", "eq", true);

    if (start_date) query = query.gte("check_in", start_date);
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
          currency: r.currency || "GBP",
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

${formatTable(guests, { minWidth: "700px" })}
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
      { minWidth: "600px" }
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
    const currency = data.currency || room.currency || "GBP";
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
        "Price per Night": `GBP ${sp.price_per_night}`,
      })),
      { minWidth: "550px" }
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
    // Helper function to get metrics for a period
    async function getPeriodMetrics(start, end) {
      const { data: reservations } = await supabase
        .from("reservations")
        .select(`
          check_in,
          check_out,
          total,
          room_subtotal,
          extras_total,
          currency,
          room_type_id
        `)
        .gte("check_in", start)
        .lte("check_in", end)
        .in("status", ["confirmed", "checked-in", "checked-out"])
        .not("is_influencer", "eq", true);

      if (!reservations?.length) {
        return { bookings: 0, revenue: 0, roomRevenue: 0, extrasRevenue: 0, occupiedNights: 0 };
      }

      const bookings = reservations.length;
      const revenue = reservations.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
      const roomRevenue = reservations.reduce((sum, r) => sum + parseFloat(r.room_subtotal || 0), 0);
      const extrasRevenue = reservations.reduce((sum, r) => sum + parseFloat(r.extras_total || 0), 0);

      // Calculate occupied nights
      let occupiedNights = 0;
      const startDate = new Date(start);
      const endDate = new Date(end);

      reservations.forEach(r => {
        const checkIn = new Date(r.check_in);
        const checkOut = new Date(r.check_out);
        const overlapStart = checkIn > startDate ? checkIn : startDate;
        const overlapEnd = checkOut < endDate ? checkOut : endDate;
        
        if (overlapStart < overlapEnd) {
          occupiedNights += Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));
        }
      });

      return {
        bookings,
        revenue,
        roomRevenue,
        extrasRevenue,
        occupiedNights,
        currency: reservations[0]?.currency || "GBP",
      };
    }

    const period1 = await getPeriodMetrics(period1_start, period1_end);
    const period2 = await getPeriodMetrics(period2_start, period2_end);

    // Calculate changes
    const bookingsChange = period1.bookings > 0 ? ((period2.bookings - period1.bookings) / period1.bookings * 100) : 0;
    const revenueChange = period1.revenue > 0 ? ((period2.revenue - period1.revenue) / period1.revenue * 100) : 0;
    const nightsChange = period1.occupiedNights > 0 ? ((period2.occupiedNights - period1.occupiedNights) / period1.occupiedNights * 100) : 0;

    const formatChange = (val) => {
      const sign = val >= 0 ? '+' : '';
      return `${sign}${val.toFixed(1)}%`;
    };

    return `**Period Comparison**

**Period 1:** ${period1_start} to ${period1_end}
- Bookings: ${period1.bookings}
- Revenue: ${period1.currency} ${period1.revenue.toFixed(2)}
- Room Revenue: ${period1.currency} ${period1.roomRevenue.toFixed(2)}
- Extras Revenue: ${period1.currency} ${period1.extrasRevenue.toFixed(2)}
- Occupied Nights: ${period1.occupiedNights}

**Period 2:** ${period2_start} to ${period2_end}
- Bookings: ${period2.bookings}
- Revenue: ${period2.currency} ${period2.revenue.toFixed(2)}
- Room Revenue: ${period2.currency} ${period2.roomRevenue.toFixed(2)}
- Extras Revenue: ${period2.currency} ${period2.extrasRevenue.toFixed(2)}
- Occupied Nights: ${period2.occupiedNights}

**Change:**
- Bookings: ${formatChange(bookingsChange)}
- Revenue: ${formatChange(revenueChange)}
- Occupied Nights: ${formatChange(nightsChange)}
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
  updateReservationStatusTool,
  updateReservationDetailsTool,
  cancelReservationTool,
  deleteReservationTool,
  getTodayCheckInsTool,
  getTodayCheckOutsTool,
  checkAvailabilityTool,
  
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