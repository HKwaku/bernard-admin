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
      query = query.or(`guest_first_name.ilike.%${searchTerm}%,guest_last_name.ilike.%${searchTerm}%,guest_email.ilike.%${searchTerm}%,confirmation_code.ilike.%${searchTerm}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }
    
    query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    
    if (error) throw error;
    return { reservations: data };
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

    // Calculate nights
    const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
    
    // Generate confirmation code
    const confirmationCode = `BRN${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase.from('reservations').insert({
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_email: guestEmail,
      guest_phone: guestPhone,
      check_in: checkIn,
      check_out: checkOut,
      room_name: roomName,
      adults: adults || 1,
      nights,
      confirmation_code: confirmationCode,
      status: 'confirmed',
      payment_status: 'unpaid',
      notes
    }).select();

    if (error) throw error;
    return { reservation: data[0], message: `Reservation created with confirmation code: ${confirmationCode}` };
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
    return { roomTypes: data };
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
  getExtras: async (args) => {
    const { category, activeOnly = true } = args;
    let query = supabase.from('extras').select('*');
    
    if (category) {
      query = query.eq('category', category);
    }
    if (activeOnly) {
      query = query.eq('active', true);
    }
    
    query = query.order('name', { ascending: true });
    const { data, error } = await query;
    
    if (error) throw error;
    return { extras: data };
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
  getPackages: async (args) => {
    const { activeOnly = true } = args;
    let query = supabase.from('packages').select('*');
    
    if (activeOnly) {
      query = query.eq('active', true);
    }
    
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    
    if (error) throw error;
    return { packages: data };
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
    description: 'Search for reservations by guest name, email, or confirmation code. Can filter by status.',
    parameters: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Search term for guest name, email, or confirmation code'
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

export async function callOpenAI(history, userMessage) {
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

You can:
- Search for reservations by name, email, or confirmation code
- Create new bookings
- Update existing reservations
- Cancel or delete reservations
- Check room availability and pricing
- Provide information about extras, packages, and coupons
- Get booking statistics

When users ask about bookings, always search the database first. Be proactive in using your database functions to help users.
Be friendly, professional, and concise. Format prices in GHS currency when discussing costs.

Current date: ${new Date().toISOString().split('T')[0]}`
            },
            ...history
          ],
          functions: functionDefinitions,
          function_call: 'auto',
          temperature: 0.7,
          max_tokens: 800
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

        // Call the function
        const functionToCall = availableFunctions[functionName];
        if (!functionToCall) {
          throw new Error(`Function ${functionName} not found`);
        }

        try {
          const functionResponse = await functionToCall(functionArgs);
          console.log('Function response:', functionResponse);

          // Add function response to history
          history.push({
            role: 'function',
            name: functionName,
            content: JSON.stringify(functionResponse)
          });

          // Continue the loop to get the final response
          continueLoop = true;
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
        return message.content;
      }

    } catch (error) {
      console.error('Error calling OpenAI:', error);
      return `❌ I'm having trouble connecting to my AI service. Error: ${error.message}`;
    }
  }

  // If we hit max loops, return the last message
  return history[history.length - 1].content || 'I processed your request but encountered an issue generating a response.';
}