// config/openai.js
import { supabase } from './supabase.js';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const conversationHistory = [];

// Define available functions that the AI can call
const availableFunctions = {
  // ===== RESERVATIONS =====
  searchReservations: async (args) => {
    const { searchTerm, status, limit = 10 } = args;
    let query = supabase.from('reservations').select('*');
    
    if (searchTerm) {
      query = query.or(`guest_first_name.ilike.%${searchTerm}%,guest_last_name.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%,guest_phone.ilike.%${searchTerm}%,confirmation_code.ilike.%${searchTerm}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    
    if (error) throw error;
    
    if (data.length === 0) {
      return {
        count: 0,
        reservations: [],
        message: `No bookings found${searchTerm ? ` for "${searchTerm}"` : ''}`
      };
    }
    
    // Format as HTML table for better display
    const tableRows = data.map(res => ({
      code: res.confirmation_code,
      guest: `${res.guest_first_name} ${res.guest_last_name}`,
      email: res.guest_email,
      phone: res.guest_phone || 'N/A',
      room: res.room_name,
      checkIn: res.check_in,
      checkOut: res.check_out,
      nights: res.nights,
      adults: res.adults,
      status: res.status,
      payment: res.payment_status,
      total: `GHS ${res.total || 0}`
    }));
    
    return { 
      count: data.length,
      reservations: tableRows,
      searchTerm: searchTerm,
      message: `Found ${data.length} booking(s)${searchTerm ? ` matching "${searchTerm}"` : ''}`
    };
  },

  getBookingsByMonth: async (args) => {
    const { month, year } = args;
    
    // Construct date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Get last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('check_in', startDate)
      .lte('check_in', endDate)
      .order('check_in', { ascending: true });
    
    if (error) throw error;
    
    // Format for better readability
    const summary = data.map(res => ({
      confirmationCode: res.confirmation_code,
      guestName: `${res.guest_first_name} ${res.guest_last_name}`,
      email: res.guest_email,
      roomType: res.room_name,
      checkIn: res.check_in,
      checkOut: res.check_out,
      nights: res.nights,
      adults: res.adults,
      status: res.status,
      paymentStatus: res.payment_status,
      total: res.total ? `GHS ${res.total}` : 'N/A'
    }));
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    return { 
      count: data.length,
      reservations: summary,
      month: monthNames[month - 1],
      year: year,
      message: `Found ${data.length} booking(s) in ${monthNames[month - 1]} ${year}`
    };
  },

  getReservationByCode: async (args) => {
    const { confirmationCode } = args;
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('confirmation_code', confirmationCode)
      .single();
    
    if (error) throw error;
    return { reservation: data };
  },

  createReservation: async (args) => {
    const {
      guestFirstName,
      guestLastName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      roomName,
      adults,
      notes
    } = args;

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return { error: 'Invalid date format. Please use YYYY-MM-DD format.' };
    }
    
    if (checkOutDate <= checkInDate) {
      return { error: 'Check-out date must be after check-in date.' };
    }

    // Calculate nights
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // Generate confirmation code
    const confirmationCode = `BK${Date.now().toString(36).toUpperCase()}`;
    
    // Try to find the room type to get pricing
    let roomType = null;
    let total = 0;
    
    try {
      // Search for room type (case-insensitive, handle variations like "SAND" vs "SAND Cabin")
      const { data: rooms } = await supabase
        .from('room_types')
        .select('*')
        .or(`code.ilike.%${roomName}%,name.ilike.%${roomName}%`)
        .limit(1);
      
      if (rooms && rooms.length > 0) {
        roomType = rooms[0];
        // Calculate total (simplified - using weekday price for all nights)
        total = roomType.base_price_per_night_weekday * nights;
      } else {
        // If no room found, return error
        return { 
          error: `Room type "${roomName}" not found. Please choose from: SAND Cabin, SEA Cabin, or SUN Cabin.` 
        };
      }
    } catch (error) {
      console.log('Could not fetch room type:', error);
      return { 
        error: `Unable to validate room type. Please try again or choose from: SAND Cabin, SEA Cabin, or SUN Cabin.` 
      };
    }

    const reservationData = {
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_email: guestEmail,
      guest_phone: guestPhone || '',
      check_in: checkIn,
      check_out: checkOut,
      room_name: roomType.name,
      room_type_code: roomType.code,
      adults: adults || 1,
      nights,
      confirmation_code: confirmationCode,
      status: 'confirmed',
      payment_status: 'unpaid',
      notes: notes || '',
      room_subtotal: total,
      total: total,
      currency: roomType.currency
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert(reservationData)
      .select();

    if (error) {
      console.error('Reservation creation error:', error);
      console.error('Reservation data attempted:', reservationData);
      return { 
        error: `Failed to create reservation: ${error.message}`,
        details: error.details || error.hint || 'Please check all required fields are provided.'
      };
    }

    console.log('Reservation created successfully:', data);

    return { 
      success: true,
      reservation: {
        confirmationCode: confirmationCode,
        guestName: `${guestFirstName} ${guestLastName}`,
        email: guestEmail,
        roomType: reservationData.room_name,
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        adults: adults || 1,
        total: total ? `GHS ${total.toFixed(2)}` : 'TBD',
        status: 'confirmed'
      },
      message: `✅ Reservation successfully created! Confirmation code: ${confirmationCode}. A confirmation email will be sent to ${guestEmail}.`
    };
  },

  updateReservation: async (args) => {
    const { confirmationCode, updates } = args;
    
    const { data, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('confirmation_code', confirmationCode)
      .select();

    if (error) throw error;
    return { reservation: data[0], message: 'Reservation updated successfully' };
  },

  cancelReservation: async (args) => {
    const { confirmationCode } = args;
    
    const { data, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('confirmation_code', confirmationCode)
      .select();

    if (error) throw error;
    return { reservation: data[0], message: 'Reservation cancelled successfully' };
  },

  deleteReservation: async (args) => {
    const { confirmationCode } = args;
    
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('confirmation_code', confirmationCode);

    if (error) throw error;
    return { message: `Reservation ${confirmationCode} deleted successfully` };
  },

  // ===== ROOM TYPES =====
  getRoomTypes: async (args) => {
    const { available } = args;
    let query = supabase.from('room_types').select('*').order('code', { ascending: true });
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Format the response in a more user-friendly way
    const summary = data.map(room => ({
      code: room.code,
      name: room.name,
      description: room.description,
      maxAdults: room.max_adults,
      weekdayPrice: `GHS ${room.base_price_per_night_weekday}`,
      weekendPrice: `GHS ${room.base_price_per_night_weekend}`,
      currency: room.currency
    }));
    
    return { 
      totalRooms: data.length,
      rooms: summary,
      message: `Found ${data.length} room type(s)`
    };
  },

  getRoomTypeByCode: async (args) => {
    const { code } = args;
    const { data, error } = await supabase
      .from('room_types')
      .select('*')
      .eq('code', code)
      .single();
    
    if (error) throw error;
    return { roomType: data };
  },

  // ===== EXTRAS =====
  getExtras: async (args = {}) => {
    const { category, activeOnly = true } = args;
    let query = supabase.from('extras').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }
    // Skip activeOnly filter since your extras table schema may not have this field
    
    query = query.order('name', { ascending: true });
    
    try {
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching extras:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return {
          totalExtras: 0,
          extras: [],
          message: `No extras found${category ? ` in category "${category}"` : ''}`
        };
      }
      
      // Format for better display
      const formatted = data.map(extra => ({
        name: extra.name || 'Unnamed Extra',
        category: extra.category || 'Uncategorized',
        price: extra.price || extra.extra_price || 0,
        currency: extra.currency || 'GHS',
        description: extra.description || '',
        active: true // Default to true since we're not filtering
      }));
      
      return { 
        totalExtras: data.length,
        extras: formatted,
        message: `Found ${data.length} extra(s)${category ? ` in category "${category}"` : ''}`
      };
    } catch (error) {
      console.error('getExtras error:', error);
      return {
        error: `Unable to retrieve extras: ${error.message}`,
        totalExtras: 0,
        extras: []
      };
    }
  },

  // ===== COUPONS =====
  getCoupons: async (args) => {
    const { activeOnly = true } = args;
    let query = supabase.from('coupons').select('*');
    
    if (activeOnly) {
      query = query.eq('active', true);
    }
    
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    
    if (error) throw error;
    return { coupons: data };
  },

  validateCoupon: async (args) => {
    const { code } = args;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('active', true)
      .single();
    
    if (error) {
      return { valid: false, message: 'Coupon not found or inactive' };
    }
    
    // Check expiration if you have an expiry_date field
    return { valid: true, coupon: data };
  },

  // ===== PACKAGES =====
  getPackages: async (args = {}) => {
    const { activeOnly = true } = args;
    let query = supabase.from('packages').select('*');
    
    // Your packages table uses 'is_active' not 'active'
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    query = query.order('sort_order', { ascending: true });
    
    try {
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching packages:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return {
          totalPackages: 0,
          packages: [],
          message: 'No packages found'
        };
      }
      
      // Format for better display
      const formatted = data.map(pkg => ({
        name: pkg.name || 'Unnamed Package',
        code: (pkg.code || '').toUpperCase(),
        description: pkg.description || '',
        nights: pkg.nights || 1,
        price: pkg.price || pkg.package_price || 0, // Check both price and package_price
        currency: pkg.currency || 'GHS',
        active: pkg.is_active !== false
      }));
      
      return { 
        totalPackages: data.length,
        packages: formatted,
        message: `Found ${data.length} package(s)`
      };
    } catch (error) {
      console.error('getPackages error:', error);
      return {
        error: `Unable to retrieve packages: ${error.message}`,
        totalPackages: 0,
        packages: []
      };
    }
  },

  // ===== STATISTICS =====
  getStats: async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Today's check-ins
    const { data: todayCheckins } = await supabase
      .from('reservations')
      .select('id')
      .eq('check_in', today);
    
    // Active bookings
    const { data: activeBookings } = await supabase
      .from('reservations')
      .select('id')
      .eq('status', 'confirmed');
    
    // This month's bookings
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const { data: monthBookings } = await supabase
      .from('reservations')
      .select('id')
      .gte('check_in', `${year}-${month}-01`)
      .lte('check_in', `${year}-${month}-31`);
    
    // Total nights
    const { data: allReservations } = await supabase
      .from('reservations')
      .select('nights');
    const totalNights = (allReservations || []).reduce((sum, r) => sum + (r.nights || 0), 0);
    
    return {
      todayCheckins: todayCheckins?.length || 0,
      activeBookings: activeBookings?.length || 0,
      monthBookings: monthBookings?.length || 0,
      totalNights
    };
  }
};

// Function definitions for OpenAI
const functionDefinitions = [
  {
    name: 'searchReservations',
    description: 'Search for reservations by guest name, email, phone number, or confirmation code. Can filter by status.',
    parameters: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Search term for guest name, email, phone number, or confirmation code'
        },
        status: {
          type: 'string',
          enum: ['confirmed', 'cancelled', 'checked_in', 'checked_out'],
          description: 'Filter by reservation status'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)'
        }
      }
    }
  },
  {
    name: 'getBookingsByMonth',
    description: 'Get all bookings for a specific month and year. Use this when users ask for bookings in a particular month.',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'number',
          description: 'Month number (1-12, where 1=January, 12=December)',
          minimum: 1,
          maximum: 12
        },
        year: {
          type: 'number',
          description: 'Year (e.g., 2025)'
        }
      },
      required: ['month', 'year']
    }
  },
  {
    name: 'getReservationByCode',
    description: 'Get a specific reservation by its confirmation code',
    parameters: {
      type: 'object',
      properties: {
        confirmationCode: {
          type: 'string',
          description: 'The reservation confirmation code'
        }
      },
      required: ['confirmationCode']
    }
  },
  {
    name: 'createReservation',
    description: 'Create a new reservation/booking',
    parameters: {
      type: 'object',
      properties: {
        guestFirstName: { type: 'string', description: 'Guest first name' },
        guestLastName: { type: 'string', description: 'Guest last name' },
        guestEmail: { type: 'string', description: 'Guest email address' },
        guestPhone: { type: 'string', description: 'Guest phone number' },
        checkIn: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        checkOut: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        roomName: { type: 'string', description: 'Room type name (e.g., "SEA Cabin", "SAND Cabin")' },
        adults: { type: 'number', description: 'Number of adults (default 1)' },
        notes: { type: 'string', description: 'Additional notes or special requests' }
      },
      required: ['guestFirstName', 'guestLastName', 'guestEmail', 'checkIn', 'checkOut', 'roomName']
    }
  },
  {
    name: 'updateReservation',
    description: 'Update an existing reservation',
    parameters: {
      type: 'object',
      properties: {
        confirmationCode: { type: 'string', description: 'Confirmation code of reservation to update' },
        updates: {
          type: 'object',
          description: 'Fields to update (e.g., {"check_in": "2025-12-01", "adults": 2})'
        }
      },
      required: ['confirmationCode', 'updates']
    }
  },
  {
    name: 'cancelReservation',
    description: 'Cancel a reservation by setting its status to cancelled',
    parameters: {
      type: 'object',
      properties: {
        confirmationCode: { type: 'string', description: 'Confirmation code of reservation to cancel' }
      },
      required: ['confirmationCode']
    }
  },
  {
    name: 'deleteReservation',
    description: 'Permanently delete a reservation from the database. Use with caution.',
    parameters: {
      type: 'object',
      properties: {
        confirmationCode: { type: 'string', description: 'Confirmation code of reservation to delete' }
      },
      required: ['confirmationCode']
    }
  },
  {
    name: 'getRoomTypes',
    description: 'Get list of all room types with pricing and details',
    parameters: {
      type: 'object',
      properties: {
        available: { type: 'boolean', description: 'Filter for available rooms only' }
      }
    }
  },
  {
    name: 'getRoomTypeByCode',
    description: 'Get details of a specific room type by its code',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Room type code (e.g., "SAND", "SEA")' }
      },
      required: ['code']
    }
  },
  {
    name: 'getExtras',
    description: 'Get list of available extras/add-ons',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        activeOnly: { type: 'boolean', description: 'Show only active extras (default true)' }
      }
    }
  },
  {
    name: 'getCoupons',
    description: 'Get list of available discount coupons',
    parameters: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'Show only active coupons (default true)' }
      }
    }
  },
  {
    name: 'validateCoupon',
    description: 'Check if a coupon code is valid',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Coupon code to validate' }
      },
      required: ['code']
    }
  },
  {
    name: 'getPackages',
    description: 'Get list of available packages/deals',
    parameters: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'Show only active packages (default true)' }
      }
    }
  },
  {
    name: 'getStats',
    description: 'Get booking statistics including today\'s check-ins, active bookings, and monthly totals',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

export async function callOpenAI(history, userMessage, onStatusUpdate) {
  console.log('OpenAI API Key exists:', !!OPENAI_API_KEY);
  console.log('User message:', userMessage);
  
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
    console.error('OpenAI API key is not configured');
    return '⚠️ OpenAI API key is not configured. Please add VITE_OPENAI_API_KEY to your .env.local file.';
  }

  // Add user message to history
  history.push({
    role: 'user',
    content: userMessage
  });

  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 5; // Prevent infinite loops

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    
    try {
      if (onStatusUpdate) {
        onStatusUpdate('🤔 Thinking...');
      }
      
      console.log(`OpenAI API call #${loopCount}...`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are Bernard, a helpful hotel booking assistant with access to the reservation database. 

⚠️ CRITICAL: When displaying 2+ bookings, you MUST use HTML tables. Never show booking lists as continuous text.

You can:
- Search for reservations by name, email, phone, or confirmation code
- Get bookings for a specific month/year
- Create new bookings
- Update existing reservations  
- Cancel or delete reservations
- Check room availability and pricing
- Provide information about extras, packages, and coupons
- Get booking statistics

IMPORTANT BOOKING RULES:
1. When a user wants to book/reserve a room, ALWAYS call createReservation function
2. If user mentions booking but room type is unclear, first call getRoomTypes to show options, then when they choose, create the booking
3. For date formats, convert natural language ("December 7th to 10th") to YYYY-MM-DD format
4. Extract guest information from the conversation (name, email)
5. After creating a booking, provide the confirmation code clearly

IMPORTANT SEARCH RULES:
1. When user asks for "bookings in [Month]" or "show me [Month] bookings", use getBookingsByMonth function
2. When user searches by name, email, phone, or code, use searchReservations function
3. Convert month names to numbers (January=1, February=2, ..., December=12)
4. If year is not specified, use current year (2025)

IMPORTANT DISPLAY RULES:
1. When user asks about rooms/room types, call getRoomTypes and display as a table
2. When user asks about extras/add-ons, call getExtras and display as a table
3. When user asks about packages/deals, call getPackages and display as a table
4. ALWAYS format room types, extras, and packages as HTML tables - never as plain text
5. When user asks to see "all" or multiple things (e.g., "show me rooms, extras and packages"), call all relevant functions and display multiple tables

IMPORTANT FORMATTING RULES - CRITICAL:
- When showing 2 or more bookings, you MUST format as an HTML table
- NEVER show booking data as continuous text or bullet points when there are multiple bookings
- Use this exact table structure with inline CSS:

<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:0.9em;">
<thead>
<tr style="background:#f1f5f9;">
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Code</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Guest</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Room</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Check-in</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Nights</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Status</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Total</th>
</tr>
</thead>
<tbody>
<!-- Add rows here -->
</tbody>
</table>

For each booking, add a table row:
<tr>
<td style="border:1px solid #cbd5e1; padding:10px; font-family:monospace; font-weight:600;">CODE</td>
<td style="border:1px solid #cbd5e1; padding:10px;">Guest Name</td>
<td style="border:1px solid #cbd5e1; padding:10px;">Room Type</td>
<td style="border:1px solid #cbd5e1; padding:10px;">Date</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">X</td>
<td style="border:1px solid #cbd5e1; padding:10px;"><span style="background:#dcfce7; color:#14532d; padding:3px 8px; border-radius:12px; font-size:0.85em; font-weight:600;">Status</span></td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:600;">GHS X.XX</td>
</tr>

ROOM TYPES TABLE FORMAT:
<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:0.9em;">
<thead>
<tr style="background:#f1f5f9;">
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Code</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Room Type</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">Max Adults</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Weekday Price</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Weekend Price</th>
</tr>
</thead>
<tbody>
<!-- Row example: -->
<tr>
<td style="border:1px solid #cbd5e1; padding:10px; font-family:monospace; font-weight:600;">CODE</td>
<td style="border:1px solid #cbd5e1; padding:10px; line-height:1.6;">
  <strong>Room Name</strong><br/>
  <span style="font-size:0.85em; color:#64748b;">Description</span>
</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:center;">2 adults</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:600;">GHS 2600</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:600;">GHS 3200</td>
</tr>
</tbody>
</table>

EXTRAS TABLE FORMAT:
<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:0.9em;">
<thead>
<tr style="background:#f1f5f9;">
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Name</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Category</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Price</th>
</tr>
</thead>
<tbody>
<!-- Row example: -->
<tr>
<td style="border:1px solid #cbd5e1; padding:10px; line-height:1.6;">
  <strong>Extra Name</strong><br/>
  <span style="font-size:0.85em; color:#64748b;">Description if available</span>
</td>
<td style="border:1px solid #cbd5e1; padding:10px;">Category</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:600;">GHS 150</td>
</tr>
</tbody>
</table>

PACKAGES TABLE FORMAT:
<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:0.9em;">
<thead>
<tr style="background:#f1f5f9;">
<th style="border:1px solid #cbd5e1; padding:10px; text-align:left; font-weight:700;">Package</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:700;">Nights</th>
<th style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:700;">Price</th>
</tr>
</thead>
<tbody>
<!-- Row example: -->
<tr>
<td style="border:1px solid #cbd5e1; padding:10px; line-height:1.6;">
  <strong>Package Name</strong><br/>
  <span style="font-size:0.85em; color:#64748b;">CODE</span><br/>
  <span style="font-size:0.85em; color:#64748b;">Description if available</span>
</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:center; font-weight:600;">3</td>
<td style="border:1px solid #cbd5e1; padding:10px; text-align:right; font-weight:600;">GHS 8500</td>
</tr>
</tbody>
</table>

For single bookings, use clear formatting with line breaks between fields.
Format prices clearly with the currency (GHS)
Present dates in readable format (e.g., "Dec 16, 2025")
Never show raw JSON or continuous strings of data

Be friendly, professional, and concise. Always interpret and present the function results in natural language.

Current date: ${new Date().toISOString().split('T')[0]}`
            },
            ...history
          ],
          functions: functionDefinitions,
          function_call: 'auto',
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      console.log('OpenAI response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        
        if (response.status === 401) {
          return '🔑 Invalid API key. Please check your VITE_OPENAI_API_KEY.';
        } else if (response.status === 429) {
          return '⏱️ Rate limit exceeded. Please try again in a moment.';
        } else if (response.status === 403) {
          return '🚫 API access denied. Check your OpenAI account status and billing.';
        }
        
        throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const message = data.choices[0].message;
      
      // Add assistant message to history
      history.push(message);

      // Check if the assistant wants to call a function
      if (message.function_call) {
        const functionName = message.function_call.name;
        const functionArgs = JSON.parse(message.function_call.arguments);
        
        console.log(`Calling function: ${functionName}`, functionArgs);

        // Show user-friendly status based on function being called
        if (onStatusUpdate) {
          const statusMessages = {
            searchReservations: '🔍 Searching for reservations...',
            getBookingsByMonth: '📅 Loading bookings for the month...',
            getReservationByCode: '🔍 Looking up reservation...',
            createReservation: '📝 Creating new reservation...',
            updateReservation: '✏️ Updating reservation...',
            cancelReservation: '❌ Cancelling reservation...',
            deleteReservation: '🗑️ Deleting reservation...',
            getRoomTypes: '🏠 Checking available room types...',
            getRoomTypeByCode: '🏠 Getting room details...',
            getExtras: '✨ Loading extras and add-ons...',
            getCoupons: '🎟️ Checking available coupons...',
            validateCoupon: '🎟️ Validating coupon code...',
            getPackages: '📦 Loading package deals...',
            getStats: '📊 Gathering statistics...'
          };
          onStatusUpdate(statusMessages[functionName] || '⚙️ Processing...');
        }

        // Call the function
        const functionToCall = availableFunctions[functionName];
        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        try {
          const functionResponse = await functionToCall(functionArgs);
          console.log('Function response:', functionResponse);

          // Check if function returned an error
          if (functionResponse.error) {
            console.error('Function returned error:', functionResponse.error);
            // Add error as function response so AI can communicate it
            history.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify(functionResponse)
            });
            continueLoop = true;
          } else {
            // Show completion status
            if (onStatusUpdate) {
              const completionMessages = {
                createReservation: '✅ Reservation created!',
                updateReservation: '✅ Reservation updated!',
                cancelReservation: '✅ Reservation cancelled!',
                deleteReservation: '✅ Reservation deleted!'
              };
              if (completionMessages[functionName]) {
                onStatusUpdate(completionMessages[functionName]);
              }
            }

            // Add function response to history
            history.push({
              role: 'function',
              name: functionName,
              content: JSON.stringify(functionResponse)
            });

            // Continue the loop to get the final response
            continueLoop = true;
          }
        } catch (funcError) {
          console.error('Function execution error:', funcError);
          history.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify({ error: funcError.message })
          });
          continueLoop = true;
        }
      } else {
        // No function call, we have the final response
        continueLoop = false;
        if (onStatusUpdate) {
          onStatusUpdate(''); // Clear status
        }
        return message.content;
      }

    } catch (error) {
      console.error('Error calling OpenAI:', error);
      if (onStatusUpdate) {
        onStatusUpdate(''); // Clear status
      }
      return `❌ I'm having trouble connecting to my AI service. Error: ${error.message}`;
    }
  }

  if (onStatusUpdate) {
    onStatusUpdate(''); // Clear status
  }
  
  // If we hit max loops, return the last message
  return history[history.length - 1].content || 'I processed your request but encountered an issue generating a response.';
}