// src/bernardTools.js
// --------------------
// All Bernard tools live here.
// Each tool is a small, focused capability that the LangGraph agent can call.
// Grouped by domain: reservations, operations, packages, coupons, analytics.

import { tool } from "@langchain/core/tools";
import { supabase } from "../src/config/supabase.js"; // adjust path if needed

// ============================================================================
// RESERVATION / OPERATIONS TOOLS
// ============================================================================

// List active room types (cabins) with pricing.
// Used when the user asks about cabins, room types or room prices.
export const listRoomsTool = tool({
  name: "list_active_room_types",
  description:
    "List all active room types with prices and capacity. Use when the user asks about cabins, rooms, or room prices.",
  async func(_input) {
    const { data, error } = await supabase
      .from("room_types")
      .select(
        "code, name, max_adults, base_price_per_night_weekday, base_price_per_night_weekend, currency, is_active"
      )
      .order("code", { ascending: true });

    if (error) return { error: error.message };

    const active = (data || []).filter((r) => r.is_active !== false);
    return {
      rooms: active.map((r) => ({
        code: r.code,
        name: r.name,
        max_adults: r.max_adults,
        weekday_price: r.base_price_per_night_weekday,
        weekend_price: r.base_price_per_night_weekend,
        currency: r.currency || "GHS",
      })),
    };
  },
});

// List active extras (add-ons) with pricing.
// Used when the user asks about extras, add-ons or services.
export const listExtrasTool = tool({
  name: "list_active_extras",
  description:
    "List all active extras with their price, currency and category. Use when asked about extras, add-ons, or services.",
  async func(_input) {
    const { data, error } = await supabase
      .from("extras")
      .select("name, category, price, currency, unit_type, is_active")
      .order("name", { ascending: true });

    if (error) return { error: error.message };

    const active = (data || []).filter((x) => x.is_active !== false);
    return {
      extras: active.map((x) => ({
        name: x.name,
        category: x.category,
        unit_type: x.unit_type,
        price: x.price,
        currency: x.currency || "GHS",
      })),
    };
  },
});

// Search reservations by guest name, email or confirmation code.
// Used for: "Find bookings for Ama", "Show booking B1234", etc.
export const searchReservationsTool = tool({
  name: "search_reservations",
  description:
    "Search reservations by guest name, email or confirmation code. Input: { query: string }.",
  async func(input) {
    const q = (input?.query || "").trim();
    if (!q) return { reservations: [] };

    // Simple 'or' search across main fields
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id, guest_first_name, guest_last_name, guest_email, confirmation_code, status, check_in, check_out, room_name"
      )
      .or(
        [
          `guest_first_name.ilike.%${q}%`,
          `guest_last_name.ilike.%${q}%`,
          `guest_email.ilike.%${q}%`,
          `confirmation_code.ilike.%${q}%`,
        ].join(",")
      )
      .order("check_in", { ascending: true })
      .limit(20);

    if (error) return { error: error.message };

    return {
      reservations: (data || []).map((r) => ({
        id: r.id,
        guest_name: `${r.guest_first_name || ""} ${
          r.guest_last_name || ""
        }`.trim(),
        email: r.guest_email,
        confirmation_code: r.confirmation_code,
        status: r.status,
        room_name: r.room_name,
        check_in: r.check_in,
        check_out: r.check_out,
      })),
    };
  },
});

// Get today's check-ins and basic booking stats.
// Used for: "What are today's check-ins?", "How many check-ins today?"
export const todayStatsTool = tool({
  name: "get_today_checkin_stats",
  description:
    "Get today's check-ins and a summary of active bookings. Use when asked about today's operations or quick stats.",
  async func(_input) {
    const today = new Date().toISOString().slice(0, 10);

    const [checkins, confirmed] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, guest_first_name, guest_last_name, room_name, check_in", {
          count: "exact",
        })
        .gte("check_in", today)
        .lte("check_in", today),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
    ]);

    if (checkins.error) return { error: checkins.error.message };

    return {
      today_checkins_count: checkins.count ?? 0,
      today_checkins: (checkins.data || []).map((r) => ({
        guest_name: `${r.guest_first_name || ""} ${
          r.guest_last_name || ""
        }`.trim(),
        room_name: r.room_name,
        check_in: r.check_in,
      })),
      total_confirmed_bookings: confirmed.count ?? 0,
    };
  },
});

// Check availability for a given room type and date range.
// Used when user asks: "Is SAND available from X to Y?"
export const checkAvailabilityTool = tool({
  name: "check_room_availability",
  description:
    "Check if a given room type is available between two dates. Input: { room_type_code: string, check_in: 'YYYY-MM-DD', check_out: 'YYYY-MM-DD' }.",
  async func(input) {
    const code = input?.room_type_code;
    const checkIn = input?.check_in;
    const checkOut = input?.check_out;

    if (!code || !checkIn || !checkOut) {
      return {
        error: "room_type_code, check_in, and check_out are required.",
      };
    }

    // Fetch reservations for that room code
    const { data, error } = await supabase
      .from("reservations")
      .select("check_in, check_out, status, room_type_code")
      .eq("room_type_code", code)
      .not("status", "in", '("cancelled","no_show")');

    if (error) return { error: error.message };

    const newStart = new Date(checkIn);
    const newEnd = new Date(checkOut);

    let hasOverlap = false;
    for (const r of data || []) {
      if (!r.check_in || !r.check_out) continue;
      const existingStart = new Date(r.check_in);
      const existingEnd = new Date(r.check_out);

      // half-open range [start, end)
      const overlap = existingStart < newEnd && existingEnd > newStart;
      if (overlap) {
        hasOverlap = true;
        break;
      }
    }

    return {
      room_type_code: code,
      check_in: checkIn,
      check_out: checkOut,
      available: !hasOverlap,
    };
  },
});

// ============================================================================
// PACKAGE TOOLS
// ============================================================================

// List all active packages with basic info and pricing.
// Used when user asks: "What packages do we offer?"
export const listActivePackagesTool = tool({
  name: "list_active_packages",
  description:
    "List all active packages with price, nights, currency and validity. Use when the user asks what packages exist or wants a list of deals.",
  async func(_input) {
    const { data, error } = await supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };

    return {
      packages: (data || []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        price: p.package_price,
        currency: p.currency || "GHS",
        nights: p.nights,
        valid_from: p.valid_from,
        valid_until: p.valid_until,
        is_featured: !!p.is_featured,
      })),
    };
  },
});

// Get full details of a package: rooms, extras, price, validity.
// Used when user asks: "What does ROMANCE package include?"
export const getPackageDetailsTool = tool({
  name: "get_package_details",
  description:
    "Get full details of a package (rooms, extras, price, nights, validity). Input: { identifier: string } where identifier can be a package code or name.",
  async func(input) {
    const ident = (input?.identifier || "").trim();
    if (!ident) {
      return { error: "identifier (code or name) is required." };
    }

    // 1) Find package by code or name (case-insensitive)
    const { data: pkg, error: pkgErr } = await supabase
      .from("packages")
      .select("*")
      .or(
        `code.ilike.${ident.toUpperCase()},name.ilike.%${ident.replace(
          /%/g,
          ""
        )}%`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pkgErr || !pkg) {
      return { error: "Package not found." };
    }

    // 2) Fetch rooms linked via packages_rooms → room_types
    let rooms = [];
    try {
      const { data: pkgRooms } = await supabase
        .from("packages_rooms")
        .select("room_type_id")
        .eq("package_id", pkg.id);

      const roomIds = (pkgRooms || []).map((r) => r.room_type_id).filter(Boolean);

      if (roomIds.length) {
        const { data: roomRows } = await supabase
          .from("room_types")
          .select("id, code, name, max_adults")
          .in("id", roomIds);

        rooms = roomRows || [];
      }
    } catch (e) {
      console.warn("get_package_details: rooms lookup failed", e);
    }

    // 3) Fetch extras linked via package_extras → extras
    let extras = [];
    try {
      const { data: pkgExtras } = await supabase
        .from("package_extras")
        .select("extra_id, quantity, code")
        .eq("package_id", pkg.id);

      const extraIds = (pkgExtras || []).map((x) => x.extra_id).filter(Boolean);

      if (extraIds.length) {
        const { data: extraRows } = await supabase
          .from("extras")
          .select("id, name, price, currency")
          .in("id", extraIds);

        const extrasById = new Map((extraRows || []).map((e) => [e.id, e]));

        extras = (pkgExtras || []).map((px) => {
          const ex = extrasById.get(px.extra_id);
          const qty = px.quantity ?? 1;
          const code = px.code || ex?.code || "";
          const name = ex?.name || code || "Extra";

          return {
            extra_id: px.extra_id,
            quantity: qty,
            code,
            name,
            price: ex?.price ?? null,
            currency: ex?.currency || pkg.currency || "GHS",
          };
        });
      }
    } catch (e) {
      console.warn("get_package_details: extras lookup failed", e);
    }

    return {
      package: {
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        description: pkg.description,
        price: pkg.package_price,
        currency: pkg.currency || "GHS",
        nights: pkg.nights,
        valid_from: pkg.valid_from,
        valid_until: pkg.valid_until,
        is_active: pkg.is_active !== false,
        is_featured: !!pkg.is_featured,
        image_url: pkg.image_url,
      },
      rooms: rooms.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        max_adults: r.max_adults,
      })),
      extras,
    };
  },
});

// Check if a package is available for a given room type & date range,
// and return a price breakdown.
// Used when user asks: "Is ROMANCE in SAND available 24–27 Dec and how much?"
export const checkPackageAvailabilityTool = tool({
  name: "check_package_availability_and_price",
  description:
    "Check if a package is available for a given room type and date range, and return a price breakdown. " +
    "Input: { package_identifier: string, room_type_code?: string, room_type_id?: number, check_in: 'YYYY-MM-DD', check_out?: 'YYYY-MM-DD' }",
  async func(input) {
    const ident = (input?.package_identifier || "").trim();
    const checkIn = input?.check_in;
    let checkOut = input?.check_out || null;
    const roomTypeCode = input?.room_type_code || null;
    const roomTypeId = input?.room_type_id ?? null;

    if (!ident || !checkIn) {
      return {
        error:
          "package_identifier and check_in are required. Optionally pass room_type_code or room_type_id and check_out.",
      };
    }

    // ---------- Load package ----------
    const { data: pkg, error: pkgErr } = await supabase
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .or(
        `code.ilike.${ident.toUpperCase()},name.ilike.%${ident.replace(
          /%/g,
          ""
        )}%`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pkgErr || !pkg) return { error: "Active package not found." };

    const baseNights = pkg.nights || 1;

    // ---------- Date helpers ----------
    const toDate = (iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const diffNights = (ci, co) => {
      const ciD = toDate(ci);
      const coD = toDate(co);
      if (!ciD || !coD || coD <= ciD) return 0;
      return Math.round((coD - ciD) / (1000 * 60 * 60 * 24));
    };
    const addDaysISO = (iso, nights) => {
      const d = toDate(iso);
      if (!d) return null;
      d.setDate(d.getDate() + (Number(nights) || 0));
      return d.toISOString().slice(0, 10);
    };

    // If no check_out provided, derive from package nights
    if (!checkOut) {
      checkOut = addDaysISO(checkIn, baseNights);
    }

    const nights = diffNights(checkIn, checkOut);
    if (nights <= 0) {
      return { error: "check_out must be after check_in." };
    }

    if (nights % baseNights !== 0) {
      return {
        error: `This package is valid only for multiples of ${baseNights} night(s).`,
        nights_selected: nights,
        base_nights: baseNights,
      };
    }

    // ---------- Load rooms linked to this package ----------
    const { data: pkgRooms } = await supabase
      .from("packages_rooms")
      .select("room_type_id")
      .eq("package_id", pkg.id);

    const roomIds = (pkgRooms || []).map((r) => r.room_type_id).filter(Boolean);

    if (!roomIds.length) {
      return { error: "This package has no room types linked." };
    }

    const { data: roomRows } = await supabase
      .from("room_types")
      .select("id, code, name")
      .in("id", roomIds);

    const rooms = roomRows || [];

    // Pick the room for availability check
    let chosenRoom = null;
    if (roomTypeId != null) {
      chosenRoom = rooms.find((r) => r.id === Number(roomTypeId)) || null;
    } else if (roomTypeCode) {
      const codeUpper = roomTypeCode.toUpperCase();
      chosenRoom =
        rooms.find((r) => (r.code || "").toUpperCase() === codeUpper) || null;
    } else {
      // default to first linked room
      chosenRoom = rooms[0] || null;
    }

    if (!chosenRoom) {
      return {
        error:
          "No matching room type for this package. Specify a valid room_type_code or room_type_id.",
        available_rooms: rooms.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
        })),
      };
    }

    // ---------- Load extras included in this package ----------
    const { data: pkgExtras } = await supabase
      .from("package_extras")
      .select("extra_id, quantity, code")
      .eq("package_id", pkg.id);

    const extraIds = (pkgExtras || []).map((x) => x.extra_id).filter(Boolean);

    let extras = [];
    if (extraIds.length) {
      const { data: extraRows } = await supabase
        .from("extras")
        .select("id, name, price, currency")
        .in("id", extraIds);

      const extrasById = new Map((extraRows || []).map((e) => [e.id, e]));

      extras = (pkgExtras || []).map((px) => {
        const ex = extrasById.get(px.extra_id);
        const qty = px.quantity ?? 1;
        const name = ex?.name || px.code || "Extra";
        const price = ex?.price || 0;
        const cur = ex?.currency || pkg.currency || "GHS";

        return {
          extra_id: px.extra_id,
          quantity: qty,
          name,
          price,
          currency: cur,
          subtotal: price * qty,
        };
      });
    }

    // ---------- Price breakdown ----------
    const extrasTotal = extras.reduce((sum, e) => sum + (e.subtotal || 0), 0);
    const packagePrice = Number(pkg.package_price || 0);
    let roomSubtotal = packagePrice - extrasTotal;
    if (roomSubtotal < 0) roomSubtotal = 0;

    const currency = pkg.currency || "GHS";

    // ---------- Availability (room-level) ----------
    let data, error;
    try {
      const res = await supabase
        .from("reservations")
        .select(
          "id, check_in, check_out, status, room_type_id, room_type_code"
        )
        .not("status", "in", '("cancelled","no_show")');

      data = res.data || [];
      error = res.error;
    } catch (err) {
      console.error("Availability check exception:", err);
      return { error: "Availability check failed." };
    }

    if (error) return { error: error.message };

    const idNum = chosenRoom.id != null ? Number(chosenRoom.id) : null;
    const newStart = new Date(checkIn);
    const newEnd = new Date(checkOut);

    const relevant = data.filter((r) => {
      const sameId = idNum !== null && Number(r.room_type_id) === idNum;
      const sameCode = chosenRoom.code && r.room_type_code === chosenRoom.code;
      return sameId || sameCode;
    });

    const hasOverlap = relevant.some((r) => {
      if (!r.check_in || !r.check_out) return false;
      const es = new Date(r.check_in);
      const ee = new Date(r.check_out);
      if (Number.isNaN(es.getTime()) || Number.isNaN(ee.getTime())) {
        return false;
      }
      return es < newEnd && ee > newStart;
    });

    const available = !hasOverlap;

    return {
      package: {
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
      },
      room: {
        id: chosenRoom.id,
        code: chosenRoom.code,
        name: chosenRoom.name,
      },
      check_in: checkIn,
      check_out: checkOut,
      nights,
      base_nights: baseNights,
      available,
      breakdown: {
        currency,
        room_subtotal,
        extras_total: extrasTotal,
        total: packagePrice,
        extras,
      },
    };
  },
});

// ============================================================================
// COUPON TOOLS
// ============================================================================

// List active coupons with rules.
// Used when user asks: "What promo codes exist?"
export const listActiveCouponsTool = tool({
  name: "list_active_coupons",
  description:
    "List all active coupons with discount type, value, scope and basic rules. Use when the user asks what promo codes exist.",
  async func(_input) {
    const { data, error } = await supabase
      .from("coupons")
      .select(
        "id, code, description, discount_type, discount_value, applies_to, " +
          "extra_ids, valid_from, valid_until, max_uses, current_uses, " +
          "max_uses_per_guest, min_booking_amount, is_active"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };

    return {
      coupons: (data || []).map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        applies_to: c.applies_to,
        extra_ids: c.extra_ids,
        valid_from: c.valid_from,
        valid_until: c.valid_until,
        max_uses: c.max_uses,
        current_uses: c.current_uses,
        max_uses_per_guest: c.max_uses_per_guest,
        min_booking_amount: c.min_booking_amount,
      })),
    };
  },
});

// Validate a coupon against a booking and compute discount.
// Used when user asks: "Does LOVE10 apply here and how much does it take off?"
export const validateCouponForBookingTool = tool({
  name: "validate_coupon_for_booking",
  description:
    "Validate a coupon for a booking and compute the discount amount. " +
    "Input: { code: string, room_amount: number, extras_amount: number, extras_ids?: string[]|number[], booking_total?: number }",
  async func(input) {
    const code = (input?.code || "").trim().toUpperCase();
    if (!code) return { valid: false, reason: "Coupon code is required." };

    const roomAmount = Number(input?.room_amount || 0);
    const extrasAmount = Number(input?.extras_amount || 0);
    const totalAmount =
      input?.booking_total != null
        ? Number(input.booking_total)
        : roomAmount + extrasAmount;

    const extrasIds = Array.isArray(input?.extras_ids)
      ? input.extras_ids.map((x) => String(x))
      : [];

    // 1) Fetch coupon by code
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (error || !coupon) {
      return { valid: false, reason: "Coupon not found or inactive." };
    }

    const now = new Date();

    // 2) Date validity
    if (coupon.valid_from) {
      const from = new Date(coupon.valid_from);
      if (now < from) {
        return { valid: false, reason: "Coupon is not valid yet." };
      }
    }
    if (coupon.valid_until) {
      const until = new Date(coupon.valid_until);
      until.setHours(23, 59, 59, 999); // inclusive
      if (now > until) {
        return { valid: false, reason: "Coupon has expired." };
      }
    }

    // 3) Max uses globally
    if (
      coupon.max_uses != null &&
      coupon.current_uses != null &&
      coupon.current_uses >= coupon.max_uses
    ) {
      return { valid: false, reason: "Coupon usage limit reached." };
    }

    // 4) Min booking amount
    if (
      coupon.min_booking_amount != null &&
      totalAmount < coupon.min_booking_amount
    ) {
      return {
        valid: false,
        reason: `Minimum booking amount is ${coupon.min_booking_amount}.`,
      };
    }

    // 5) Determine base amount to discount
    let base = 0;
    const appliesTo = (coupon.applies_to || "both").toLowerCase();
    const extraTargetIds = Array.isArray(coupon.extra_ids)
      ? coupon.extra_ids.map((x) => String(x))
      : [];

    if (appliesTo === "rooms") {
      base = roomAmount;
    } else if (appliesTo === "extras") {
      // if coupon targets specific extras and extras_ids passed, only apply on overlapping extras
      if (extraTargetIds.length && extrasIds.length) {
        const hasOverlap = extrasIds.some((id) =>
          extraTargetIds.includes(String(id))
        );
        if (!hasOverlap) {
          return {
            valid: false,
            reason:
              "Coupon only applies to specific extras which are not in this booking.",
          };
        }
      }
      base = extrasAmount;
    } else {
      // 'both' or anything else → whole booking
      base = roomAmount + extrasAmount;
    }

    if (base <= 0) {
      return {
        valid: false,
        reason: "Nothing in this booking is eligible for this coupon.",
      };
    }

    // 6) Compute discount
    const type = coupon.discount_type || "percentage";
    const value = Number(coupon.discount_value || 0);
    let discount = 0;

    if (type === "percentage") {
      discount = (base * value) / 100;
    } else {
      discount = Math.min(value, base); // fixed
    }

    if (discount <= 0) {
      return {
        valid: false,
        reason: "Coupon calculates to zero discount for this booking.",
      };
    }

    return {
      valid: true,
      code,
      applies_to: appliesTo,
      discount_type: type,
      discount_value: value,
      base_amount: base,
      discount_amount: discount,
      booking_total_before: totalAmount,
      booking_total_after: Math.max(totalAmount - discount, 0),
      min_booking_amount: coupon.min_booking_amount,
    };
  },
});

// ============================================================================
// ANALYTICS TOOLS
// ============================================================================

// Simple helper to format dates as YYYY-MM-DD for SQL.
function sqlDate(d) {
  return d.toISOString().split("T")[0];
}

// Get occupancy + revenue overview for a date range.
// Used when user asks: "Give me an overview for last 30 days", etc.
export const getAnalyticsOverviewTool = tool({
  name: "get_analytics_overview",
  description:
    "Get occupancy and revenue metrics for a date range. " +
    "Input: { start_date?: 'YYYY-MM-DD', end_date?: 'YYYY-MM-DD' }. " +
    "Uses check_in date and reservations with status confirmed/checked-in/checked-out.",
  async func(input) {
    // ---- Date range setup ----
    let end = input?.end_date ? new Date(input.end_date) : new Date();
    let start = input?.start_date
      ? new Date(input.start_date)
      : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000); // last 30 days by default

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { error: "Invalid start_date or end_date." };
    }
    if (end < start) {
      [start, end] = [end, start];
    }

    const startStr = sqlDate(start);
    const endStr = sqlDate(end);

    // ---- Occupancy metrics ----
    const { data: occRes, error: occErr } = await supabase
      .from("reservations")
      .select("check_in, check_out, nights, room_type_code")
      .gte("check_in", startStr)
      .lte("check_in", endStr)
      .in("status", ["confirmed", "checked-in", "checked-out"]);

    if (occErr) return { error: occErr.message };

    const occReservations = occRes || [];

    const totalNightsSold = occReservations.reduce((sum, r) => {
      if (r.nights && r.nights > 0) return sum + r.nights;
      if (r.check_in && r.check_out) {
        const inDate = new Date(r.check_in);
        const outDate = new Date(r.check_out);
        const diff = Math.round(
          (outDate - inDate) / (1000 * 60 * 60 * 24)
        );
        return sum + Math.max(diff, 0);
      }
      return sum;
    }, 0);

    const daysInPeriod = Math.max(
      1,
      Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    );

    const NUM_CABINS = 3; // SAND, SEA, SUN
    const totalAvailableNights = daysInPeriod * NUM_CABINS;

    const occupancyRate =
      totalAvailableNights > 0
        ? (totalNightsSold / totalAvailableNights) * 100
        : 0;

    const avgLOS =
      occReservations.length > 0
        ? totalNightsSold / occReservations.length
        : 0;

    const bookingsCount = occReservations.length;

    // ---- Revenue metrics ----
    const { data: revRes, error: revErr } = await supabase
      .from("reservations")
      .select("total, room_subtotal, extras_total, check_in, nights")
      .gte("check_in", startStr)
      .lte("check_in", endStr)
      .in("status", ["confirmed", "checked-in", "checked-out"]);

    if (revErr) return { error: revErr.message };

    const revReservations = revRes || [];

    const totalRevenue = revReservations.reduce(
      (sum, r) => sum + (parseFloat(r.total) || 0),
      0
    );
    const roomRevenue = revReservations.reduce(
      (sum, r) => sum + (parseFloat(r.room_subtotal) || 0),
      0
    );
    const extrasRevenue = revReservations.reduce(
      (sum, r) => sum + (parseFloat(r.extras_total) || 0),
      0
    );

    const totalNights = revReservations.reduce(
      (sum, r) => sum + (r.nights || 0),
      0
    );

    const avgBookingValue =
      revReservations.length > 0
        ? totalRevenue / revReservations.length
        : 0;

    const revPAR = totalNights > 0 ? totalRevenue / totalNights : 0;
    const adr = totalNights > 0 ? roomRevenue / totalNights : 0;

    return {
      range: {
        start_date: startStr,
        end_date: endStr,
        days: daysInPeriod,
      },
      occupancy: {
        occupancy_rate_pct: Number(occupancyRate.toFixed(1)),
        nights_sold: totalNightsSold,
        available_nights: totalAvailableNights,
        avg_los_nights: Number(avgLOS.toFixed(1)),
        bookings_count: bookingsCount,
      },
      revenue: {
        total_revenue: totalRevenue,
        room_revenue: roomRevenue,
        extras_revenue: extrasRevenue,
        avg_booking_value: avgBookingValue,
        revpar: revPAR,
        adr,
      },
    };
  },
});
// ============================================================================
// INTERNAL HELPERS FOR MUTATING TOOLS
// ============================================================================

function parseISODate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Friday + Saturday are weekend nights (same as widget logic)
function isWeekendDate(d) {
  const dow = d.getDay();
  return dow === 5 || dow === 6;
}

/**
 * Compute room pricing for a date range based on weekday/weekend split.
 * Mirrors the widget's computeRoomSubtotal logic.
 */
function computeRoomPricingForRange(roomRow, checkInISO, checkOutISO) {
  const ci = parseISODate(checkInISO);
  const co = parseISODate(checkOutISO);
  if (!ci || !co || !(co > ci)) {
    return { nights: 0, weekdayN: 0, weekendN: 0, room_subtotal: 0 };
  }

  let weekdayN = 0;
  let weekendN = 0;

  // Count each *night* starting from check-in date up to night before check-out
  for (let d = new Date(ci); d < co; d.setDate(d.getDate() + 1)) {
    if (isWeekendDate(d)) {
      weekendN++;
    } else {
      weekdayN++;
    }
  }

  const wkdPrice = Number(roomRow.base_price_per_night_weekday || 0);
  const wkePrice = Number(roomRow.base_price_per_night_weekend || 0);
  const subtotal = weekdayN * wkdPrice + weekendN * wkePrice;
  const nights = weekdayN + weekendN;

  return { nights, weekdayN, weekendN, room_subtotal: subtotal };
}

/**
 * Generate confirmation code (same pattern as app.js / package_booking.js)
 */
function genConfCode() {
  return (
    "B" +
    Math.random().toString(36).slice(2, 8) +
    Date.now().toString(36).slice(-4)
  ).toUpperCase();
}

/**
 * Simple overlap check for [checkIn, checkOut) ranges.
 */
function rangesOverlap(existingStartISO, existingEndISO, newStart, newEnd) {
  const es = parseISODate(existingStartISO);
  const ee = parseISODate(existingEndISO);
  if (!es || !ee) return false;
  return es < newEnd && ee > newStart;
}

// ============================================================================
// MUTATING TOOLS: CREATE / UPDATE / CANCEL RESERVATIONS
// IMPORTANT: Agent should ONLY use these after explicit user confirmation.
// ============================================================================

/**
 * Create a simple reservation (no extras, no package).
 * - Computes nights + room_subtotal using weekday/weekend pricing.
 * - Checks basic availability for the selected room type.
 */
export const createSimpleReservationTool = tool({
  name: "create_simple_reservation",
  description:
    "Create a simple reservation (no package, no extras). " +
    "Input: { guest_first_name, guest_last_name?, guest_email?, guest_phone?, country_code?, " +
    "room_type_code, check_in: 'YYYY-MM-DD', check_out: 'YYYY-MM-DD', adults?: number, children?: number, " +
    "status?: 'pending'|'confirmed', payment_status?: 'unpaid'|'paid', currency?: string, notes?: string }. " +
    "Use ONLY after the user has explicitly confirmed they want to create the booking.",
  async func(input) {
    try {
      const roomCode = (input?.room_type_code || "").trim().toUpperCase();
      const checkIn = input?.check_in;
      const checkOut = input?.check_out;

      if (!roomCode || !checkIn || !checkOut) {
        return {
          error:
            "room_type_code, check_in and check_out are required to create a reservation.",
        };
      }

      const ci = parseISODate(checkIn);
      const co = parseISODate(checkOut);
      if (!ci || !co || !(co > ci)) {
        return { error: "Invalid date range. Ensure check_out > check_in." };
      }

      // 1) Load room type
      const { data: room, error: roomErr } = await supabase
        .from("room_types")
        .select(
          "id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency, is_active"
        )
        .eq("code", roomCode)
        .maybeSingle?.() ?? {};

      // Fallback for older Supabase clients without maybeSingle
      const finalRoom =
        room ||
        (Array.isArray(room) && room.length > 0 ? room[0] : null);

      if (roomErr || !finalRoom) {
        return { error: `Room type with code ${roomCode} not found.` };
      }
      if (finalRoom.is_active === false) {
        return { error: `Room type ${roomCode} is not active.` };
      }

      // 2) Check availability for this room type
      const { data: existingRes, error: resErr } = await supabase
        .from("reservations")
        .select("id, check_in, check_out, status, room_type_code")
        .eq("room_type_code", roomCode)
        .not("status", "in", '("cancelled","no_show")');

      if (resErr) {
        return { error: "Error checking availability: " + resErr.message };
      }

      const hasOverlap = (existingRes || []).some((r) =>
        rangesOverlap(r.check_in, r.check_out, ci, co)
      );
      if (hasOverlap) {
        return {
          error: `Room type ${roomCode} is not available for ${checkIn} → ${checkOut}.`,
          available: false,
        };
      }

      // 3) Compute pricing (weekday/weekend split)
      const pricing = computeRoomPricingForRange(finalRoom, checkIn, checkOut);
      if (pricing.nights <= 0) {
        return { error: "Could not compute a positive number of nights." };
      }

      const currency =
        input?.currency || finalRoom.currency || "GHS";
      const adults = Number(input?.adults ?? 0) || 0;
      const children = Number(input?.children ?? 0) || 0;

      const status = input?.status || "pending";
      const paymentStatus = input?.payment_status || "unpaid";

      const payload = {
        confirmation_code: genConfCode(),
        guest_first_name:
          (input?.guest_first_name || "").trim() || null,
        guest_last_name:
          (input?.guest_last_name || "").trim() || null,
        guest_email: (input?.guest_email || "").trim() || null,
        guest_phone: (input?.guest_phone || "").trim() || null,
        country_code: (input?.country_code || "").trim() || null,
        is_influencer: false,
        room_type_id: finalRoom.id,
        room_type_code: finalRoom.code,
        room_name: finalRoom.name,
        check_in: checkIn,
        check_out: checkOut,
        nights: pricing.nights,
        adults,
        children,
        status,
        payment_status: paymentStatus,
        currency,
        room_subtotal: pricing.room_subtotal,
        extras_total: 0,
        discount_amount: 0,
        coupon_code: null,
        total: pricing.room_subtotal,
        notes: (input?.notes || "").trim() || null,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("reservations")
        .insert(payload)
        .select(
          "id, confirmation_code, status, check_in, check_out, room_name, total, currency"
        )
        .single();

      if (insErr) {
        return { error: "Error creating reservation: " + insErr.message };
      }

      return {
        success: true,
        reservation: inserted,
        pricing: {
          nights: pricing.nights,
          room_subtotal: pricing.room_subtotal,
        },
      };
    } catch (e) {
      return { error: "Unexpected error creating reservation: " + e.message };
    }
  },
});

/**
 * Cancel a reservation (by id or confirmation code).
 */
export const cancelReservationTool = tool({
  name: "cancel_reservation",
  description:
    "Cancel a reservation by id or confirmation_code. " +
    "Input: { reservation_id?: number, confirmation_code?: string, reason?: string }. " +
    "Use ONLY after the user explicitly confirms cancellation.",
  async func(input) {
    const id = input?.reservation_id;
    const code = (input?.confirmation_code || "").trim();

    if (!id && !code) {
      return {
        error: "Provide reservation_id or confirmation_code to cancel.",
      };
    }

    // 1) Load reservation
    let query = supabase
      .from("reservations")
      .select("id, confirmation_code, status, notes")
      .limit(1);

    if (id) query = query.eq("id", id);
    if (!id && code) query = query.eq("confirmation_code", code);

    const { data, error } = await query;
    if (error) return { error: error.message };

    const res =
      data && data.length ? data[0] : null;

    if (!res) {
      return { error: "Reservation not found." };
    }

    if (res.status === "cancelled") {
      return {
        success: true,
        already_cancelled: true,
        reservation_id: res.id,
        confirmation_code: res.confirmation_code,
      };
    }

    const reason = (input?.reason || "").trim();
    const now = new Date().toISOString();
    const existingNotes = res.notes || "";
    const cancelNote = `Cancelled via Bernard agent on ${now}${
      reason ? " — " + reason : ""
    }`;
    const newNotes = existingNotes
      ? `${existingNotes}\n${cancelNote}`
      : cancelNote;

    const { error: upErr } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        notes: newNotes,
      })
      .eq("id", res.id);

    if (upErr) {
      return { error: "Error cancelling reservation: " + upErr.message };
    }

    return {
      success: true,
      reservation_id: res.id,
      confirmation_code: res.confirmation_code,
      previous_status: res.status,
      new_status: "cancelled",
    };
  },
});

/**
 * Modify reservation dates and reprice room_subtotal.
 * - Uses weekday/weekend pricing like the widget.
 * - Checks room availability excluding the current reservation.
 * - Does NOT currently support package bookings (those should be changed via package flow).
 */
export const updateReservationDatesTool = tool({
  name: "update_reservation_dates",
  description:
    "Update a reservation's check-in / check-out and reprice room_subtotal. " +
    "Input: { reservation_id?: number, confirmation_code?: string, new_check_in: 'YYYY-MM-DD', new_check_out: 'YYYY-MM-DD' }. " +
    "Does NOT support package bookings. Use ONLY after explicit user confirmation.",
  async func(input) {
    const id = input?.reservation_id;
    const code = (input?.confirmation_code || "").trim();
    const newCheckIn = input?.new_check_in;
    const newCheckOut = input?.new_check_out;

    if (!id && !code) {
      return {
        error:
          "Provide reservation_id or confirmation_code to modify a reservation.",
      };
    }
    if (!newCheckIn || !newCheckOut) {
      return {
        error: "new_check_in and new_check_out are required.",
      };
    }

    const ci = parseISODate(newCheckIn);
    const co = parseISODate(newCheckOut);
    if (!ci || !co || !(co > ci)) {
      return { error: "Invalid date range. Ensure new_check_out > new_check_in." };
    }

    // 1) Load reservation (including room_type info + extras/discounts)
    let query = supabase
      .from("reservations")
      .select(
        "id, confirmation_code, status, room_type_id, room_type_code, package_id, " +
          "room_subtotal, extras_total, discount_amount"
      )
      .limit(1);

    if (id) query = query.eq("id", id);
    if (!id && code) query = query.eq("confirmation_code", code);

    const { data, error } = await query;
    if (error) return { error: error.message };

    const res =
      data && data.length ? data[0] : null;
    if (!res) {
      return { error: "Reservation not found." };
    }

    if (res.package_id) {
      return {
        error:
          "This reservation is linked to a package. Please adjust it via the package booking flow instead.",
      };
    }

    const roomTypeCode = (res.room_type_code || "").trim();
    const roomTypeId = res.room_type_id;

    if (!roomTypeCode && !roomTypeId) {
      return {
        error:
          "Reservation has no room_type_code / room_type_id. Cannot safely reprice.",
      };
    }

    // 2) Load room_type for pricing
    let roomQuery = supabase
      .from("room_types")
      .select(
        "id, code, name, base_price_per_night_weekday, base_price_per_night_weekend, currency"
      )
      .limit(1);

    if (roomTypeId) roomQuery = roomQuery.eq("id", roomTypeId);
    else roomQuery = roomQuery.eq("code", roomTypeCode);

    const { data: roomRows, error: roomErr } = await roomQuery;
    if (roomErr) return { error: roomErr.message };

    const room =
      roomRows && roomRows.length ? roomRows[0] : null;
    if (!room) {
      return {
        error: "Room type for this reservation could not be found.",
      };
    }

    // 3) Check availability for new range (exclude current reservation)
    const { data: others, error: othersErr } = await supabase
      .from("reservations")
      .select("id, check_in, check_out, status, room_type_id, room_type_code")
      .not("status", "in", '("cancelled","no_show")');

    if (othersErr) return { error: othersErr.message };

    const newStart = ci;
    const newEnd = co;

    const relevant = (others || []).filter((r) => {
      if (r.id === res.id) return false; // exclude self
      const sameId =
        roomTypeId != null && r.room_type_id === roomTypeId;
      const sameCode =
        roomTypeCode && r.room_type_code === roomTypeCode;
      return sameId || sameCode;
    });

    const hasOverlap = relevant.some((r) =>
      rangesOverlap(r.check_in, r.check_out, newStart, newEnd)
    );
    if (hasOverlap) {
      return {
        error:
          "New dates are not available for this room type (conflict with another booking).",
      };
    }

    // 4) Recompute nights + room_subtotal
    const pricing = computeRoomPricingForRange(
      room,
      newCheckIn,
      newCheckOut
    );
    if (pricing.nights <= 0) {
      return {
        error:
          "Could not compute a positive number of nights for the new dates.",
      };
    }

    const extrasTotal = Number(res.extras_total || 0);
    const discountAmount = Number(res.discount_amount || 0);
    const newTotal = Math.max(
      0,
      pricing.room_subtotal + extrasTotal - discountAmount
    );

    const { error: upErr } = await supabase
      .from("reservations")
      .update({
        check_in: newCheckIn,
        check_out: newCheckOut,
        nights: pricing.nights,
        room_subtotal: pricing.room_subtotal,
        total: newTotal,
      })
      .eq("id", res.id);

    if (upErr) {
      return {
        error: "Error updating reservation: " + upErr.message,
      };
    }

    return {
      success: true,
      reservation_id: res.id,
      confirmation_code: res.confirmation_code,
      new_check_in: newCheckIn,
      new_check_out: newCheckOut,
      nights: pricing.nights,
      room_subtotal: pricing.room_subtotal,
      total: newTotal,
    };
  },
});
