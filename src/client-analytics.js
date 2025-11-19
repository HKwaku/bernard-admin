// src/client-analytics.js
// Client Analytics Dashboard for Sojourn Cabins

import { supabase } from './config/supabase.js';
import { formatCurrency, toast } from './utils/helpers.js';

// Date range state (matches parent analytics.js)
let dateRange = {
  start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  end: new Date()
};

function sqlDate(d) {
  return d.toISOString().split('T')[0];
}

// Initialize Client Analytics
export function initClientAnalytics() {
  renderClientAnalytics();
}

// Update date range from parent
export function updateClientAnalyticsDateRange(start, end) {
  dateRange = { start, end };
  renderClientAnalyticsContent();
}

// Main render function
function renderClientAnalytics() {
  const view = document.getElementById('view-client-analytics');
  if (!view) return;

  view.innerHTML = `
    <div class="card-bd">
      <div class="card-bd client-analytics-container" style="max-width:100%; overflow-x:hidden;">
      
      <!-- Header -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Client Analytics</h2>
        <p style="font-size: 14px; color: #64748b;">Guest demographics, booking patterns, and loyalty insights</p>
      </div>

      <!-- Summary Metrics -->
      <div class="analytics-section">
        <div class="analytics-section-title">Client Overview</div>
        <div id="client-overview-metrics"></div>
      </div>

      <!-- Top Clients -->
      <div class="analytics-section">
        <div class="analytics-section-title">Top Clients</div>
        <div id="top-clients"></div>
      </div>

      <!-- Demographics -->
      <div class="analytics-section">
        <div class="analytics-section-title">Guest Demographics</div>
        <div class="two-column">
          <div class="chart-card">
            <div class="chart-title">Country Distribution</div>
            <div id="country-split"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">Gender Distribution</div>
            <div id="gender-split"></div>
          </div>
        </div>
      </div>

      <!-- Booking Patterns -->
      <div class="analytics-section">
        <div class="analytics-section-title">Booking Patterns</div>
        <div class="two-column">
          <div class="chart-card">
            <div class="chart-title">Guest Type Analysis</div>
            <div id="guest-type-analysis"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">Booking Lead Time</div>
            <div id="booking-lead-time"></div>
          </div>
        </div>
      </div>

      <!-- Room Preferences -->
      <div class="analytics-section">
        <div class="analytics-section-title">Room Preferences by Guest Type</div>
        <div id="room-preferences"></div>
      </div>

      <!-- Loyalty Insights -->
      <div class="analytics-section">
        <div class="analytics-section-title">Guest Loyalty</div>
        <div class="two-column">
          <div class="chart-card">
            <div class="chart-title">Repeat Guest Analysis</div>
            <div id="repeat-guest-analysis"></div>
          </div>
          <div class="chart-card">
            <div class="chart-title">Guest Lifetime Value</div>
            <div id="guest-lifetime-value"></div>
          </div>
        </div>
      </div>

    </div>
  `;

  renderClientAnalyticsContent();
}

// Render all client analytics content
async function renderClientAnalyticsContent() {
  await Promise.all([
    renderClientOverviewMetrics(),
    renderTopClients(),
    renderCountrySplit(),
    renderGenderSplit(),
    renderGuestTypeAnalysis(),
    renderBookingLeadTime(),
    renderRoomPreferences(),
    renderRepeatGuestAnalysis(),
    renderGuestLifetimeValue()
  ]);
}

// 1. Client Overview Metrics
async function renderClientOverviewMetrics() {
  const el = document.getElementById('client-overview-metrics');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, guest_first_name, guest_last_name, guest_email, created_at, total, status, adults, children')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    // Unique guests by email
    const uniqueEmails = new Set(
      reservations
        .filter(r => r.guest_email)
        .map(r => r.guest_email.toLowerCase())
    );
    const uniqueGuests = uniqueEmails.size;

    // New vs returning
    const emailBookingCounts = {};
    reservations.forEach(r => {
      if (r.guest_email) {
        const email = r.guest_email.toLowerCase();
        emailBookingCounts[email] = (emailBookingCounts[email] || 0) + 1;
      }
    });

    const returningGuests = Object.values(emailBookingCounts).filter(count => count > 1).length;
    const newGuests = uniqueGuests - returningGuests;

    // Total guests (adults + children)
    const totalGuestCount = reservations.reduce((sum, r) => {
      return sum + (r.adults || 0) + (r.children || 0);
    }, 0);

    // Average booking value
    const totalRevenue = reservations.reduce((sum, r) => sum + (r.total || 0), 0);
    const avgBookingValue = reservations.length > 0 ? totalRevenue / reservations.length : 0;

    const html = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Unique Guests</div>
          <div class="metric-value">${uniqueGuests}</div>
          <div class="metric-subtext">${reservations.length} total bookings</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">New Guests</div>
          <div class="metric-value">${newGuests}</div>
          <div class="metric-subtext">${uniqueGuests > 0 ? ((newGuests / uniqueGuests) * 100).toFixed(1) : 0}% of all guests</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Returning Guests</div>
          <div class="metric-value">${returningGuests}</div>
          <div class="metric-subtext">${uniqueGuests > 0 ? ((returningGuests / uniqueGuests) * 100).toFixed(1) : 0}% of all guests</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Booking Value</div>
          <div class="metric-value">${formatCurrency(avgBookingValue, 'GHS')}</div>
          <div class="metric-subtext">Per reservation</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Guests Hosted</div>
          <div class="metric-value">${totalGuestCount}</div>
          <div class="metric-subtext">${reservations.length > 0 ? (totalGuestCount / reservations.length).toFixed(1) : 0} avg per booking</div>
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering client overview:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading client overview</div>';
  }
}

// 2. Top Clients by Bookings
async function renderTopClients() {
  const el = document.getElementById('top-clients');
  if (!el) return;

  try {
    // Get all reservations (not just date range) to identify repeat customers
    const { data: allReservations, error } = await supabase
      .from('reservations')
      .select('guest_first_name, guest_last_name, guest_email, total, status, created_at')
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Group by email
    const guestData = {};
    allReservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      
      if (!guestData[email]) {
        guestData[email] = {
          name: [r.guest_first_name, r.guest_last_name].filter(Boolean).join(' ') || 'Guest',
          bookings: 0,
          totalSpent: 0,
          lastBooking: null
        };
      }
      
      guestData[email].bookings += 1;
      guestData[email].totalSpent += (r.total || 0);
      
      const bookingDate = new Date(r.created_at);
      if (!guestData[email].lastBooking || bookingDate > new Date(guestData[email].lastBooking)) {
        guestData[email].lastBooking = r.created_at;
      }
    });

    // Convert to array and sort by bookings
    const topClients = Object.entries(guestData)
      .map(([email, data]) => ({ email, ...data }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 10);

    if (topClients.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No client data available</div>';
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    
    topClients.forEach((client, idx) => {
      const lastBookingDate = new Date(client.lastBooking);
      const lastBookingLabel = lastBookingDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      html += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6c63ff, #5146ff); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0;">
              ${idx + 1}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: #0f172a; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${client.name}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Last booking: ${lastBookingLabel}</div>
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-weight: 700; color: #0f172a; font-size: 16px;">${client.bookings} booking${client.bookings > 1 ? 's' : ''}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${formatCurrency(client.totalSpent, 'GHS')}</div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering top clients:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading top clients</div>';
  }
}

// 3. Country Distribution
async function renderCountrySplit() {
  const el = document.getElementById('country-split');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('guest_country')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const countryCounts = {};
    reservations.forEach(r => {
      const country = r.guest_country || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    const countryData = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    const totalBookings = reservations.length;

    if (countryData.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No country data available</div>';
      return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    
    countryData.slice(0, 8).forEach(({ country, count }) => {
      const percentage = totalBookings > 0 ? (count / totalBookings) * 100 : 0;
      
      html += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="flex: 0 0 100px; font-size: 13px; font-weight: 500; color: #0f172a;">${country}</div>
          <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 20px; position: relative; overflow: hidden;">
            <div style="position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, #6c63ff, #5146ff); width: ${percentage}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="flex: 0 0 60px; text-align: right; font-size: 13px; font-weight: 600; color: #64748b;">${count} (${percentage.toFixed(1)}%)</div>
        </div>
      `;
    });

    if (countryData.length > 8) {
      const othersCount = countryData.slice(8).reduce((sum, c) => sum + c.count, 0);
      const othersPercentage = totalBookings > 0 ? (othersCount / totalBookings) * 100 : 0;
      
      html += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="flex: 0 0 100px; font-size: 13px; font-weight: 500; color: #0f172a;">Others</div>
          <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 20px; position: relative; overflow: hidden;">
            <div style="position: absolute; left: 0; top: 0; height: 100%; background: #94a3b8; width: ${othersPercentage}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="flex: 0 0 60px; text-align: right; font-size: 13px; font-weight: 600; color: #64748b;">${othersCount} (${othersPercentage.toFixed(1)}%)</div>
        </div>
      `;
    }

    html += '</div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering country split:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading country data</div>';
  }
}

// 4. Gender Distribution
async function renderGenderSplit() {
  const el = document.getElementById('gender-split');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('guest_gender')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const genderCounts = {
      'Male': 0,
      'Female': 0,
      'Other': 0,
      'Unknown': 0
    };

    reservations.forEach(r => {
      const gender = r.guest_gender || 'Unknown';
      if (genderCounts.hasOwnProperty(gender)) {
        genderCounts[gender]++;
      } else {
        genderCounts['Other']++;
      }
    });

    const totalBookings = reservations.length;
    const genderData = Object.entries(genderCounts)
      .filter(([_, count]) => count > 0)
      .map(([gender, count]) => ({ gender, count, percentage: totalBookings > 0 ? (count / totalBookings) * 100 : 0 }));

    if (genderData.length === 0 || totalBookings === 0) {
      el.innerHTML = '<div class="analytics-empty">No gender data available</div>';
      return;
    }

    const colors = {
      'Male': '#3b82f6',
      'Female': '#ec4899',
      'Other': '#8b5cf6',
      'Unknown': '#94a3b8'
    };

    let html = '<div style="display: flex; flex-direction: column; gap: 16px; align-items: center;">';
    
    // Donut chart
    html += '<div style="position: relative; width: 160px; height: 160px;">';
    
    let currentAngle = -90;
    genderData.forEach(({ gender, percentage }) => {
      const angle = (percentage / 100) * 360;
      const endAngle = currentAngle + angle;
      
      const x1 = 80 + 70 * Math.cos((currentAngle * Math.PI) / 180);
      const y1 = 80 + 70 * Math.sin((currentAngle * Math.PI) / 180);
      const x2 = 80 + 70 * Math.cos((endAngle * Math.PI) / 180);
      const y2 = 80 + 70 * Math.sin((endAngle * Math.PI) / 180);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      html += `
        <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
          <path d="M 80 80 L ${x1} ${y1} A 70 70 0 ${largeArc} 1 ${x2} ${y2} Z" 
                fill="${colors[gender]}" opacity="0.9" />
          <circle cx="80" cy="80" r="50" fill="white" />
        </svg>
      `;
      
      currentAngle = endAngle;
    });
    
    html += '</div>';
    
    // Legend
    html += '<div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">';
    genderData.forEach(({ gender, count, percentage }) => {
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; border-radius: 3px; background: ${colors[gender]};"></div>
            <span style="font-size: 13px; color: #0f172a; font-weight: 500;">${gender}</span>
          </div>
          <span style="font-size: 13px; font-weight: 600; color: #64748b;">${count} (${percentage.toFixed(1)}%)</span>
        </div>
      `;
    });
    html += '</div>';
    
    html += '</div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering gender split:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading gender data</div>';
  }
}

// 5. Guest Type Analysis (New vs Returning)
async function renderGuestTypeAnalysis() {
  const el = document.getElementById('guest-type-analysis');
  if (!el) return;

  try {
    // Get all reservations to identify guest history
    const { data: allReservations, error: allError } = await supabase
      .from('reservations')
      .select('guest_email, created_at, status')
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('created_at', { ascending: true });

    if (allError) throw allError;

    // Get current period reservations
    const { data: periodReservations, error: periodError } = await supabase
      .from('reservations')
      .select('guest_email, total')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (periodError) throw periodError;

    // Build guest history map
    const guestFirstBooking = {};
    allReservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      if (!guestFirstBooking[email]) {
        guestFirstBooking[email] = r.created_at;
      }
    });

    // Classify guests in current period
    let newGuestBookings = 0;
    let returningGuestBookings = 0;
    let newGuestRevenue = 0;
    let returningGuestRevenue = 0;

    periodReservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      const firstBooking = new Date(guestFirstBooking[email]);
      const periodStart = new Date(dateRange.start);
      
      if (firstBooking >= periodStart) {
        newGuestBookings++;
        newGuestRevenue += (r.total || 0);
      } else {
        returningGuestBookings++;
        returningGuestRevenue += (r.total || 0);
      }
    });

    const totalBookings = newGuestBookings + returningGuestBookings;
    const totalRevenue = newGuestRevenue + returningGuestRevenue;

    const html = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- New Guests -->
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: between; margin-bottom: 12px;">
            <div style="font-size: 14px; font-weight: 600; color: #15803d;">New Guests</div>
            <div style="font-size: 20px; font-weight: 700; color: #15803d; margin-left: auto;">${newGuestBookings}</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #166534; margin-bottom: 8px;">
            <span>${totalBookings > 0 ? ((newGuestBookings / totalBookings) * 100).toFixed(1) : 0}% of bookings</span>
            <span>${formatCurrency(newGuestRevenue, 'GHS')}</span>
          </div>
          <div style="background: #dcfce7; border-radius: 999px; height: 8px; overflow: hidden;">
            <div style="background: #22c55e; height: 100%; width: ${totalBookings > 0 ? (newGuestBookings / totalBookings) * 100 : 0}%; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Returning Guests -->
        <div style="background: #eff6ff; border: 1px solid #93c5fd; border-radius: 12px; padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 14px; font-weight: 600; color: #1e40af;">Returning Guests</div>
            <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${returningGuestBookings}</div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #1e40af; margin-bottom: 8px;">
            <span>${totalBookings > 0 ? ((returningGuestBookings / totalBookings) * 100).toFixed(1) : 0}% of bookings</span>
            <span>${formatCurrency(returningGuestRevenue, 'GHS')}</span>
          </div>
          <div style="background: #dbeafe; border-radius: 999px; height: 8px; overflow: hidden;">
            <div style="background: #3b82f6; height: 100%; width: ${totalBookings > 0 ? (returningGuestBookings / totalBookings) * 100 : 0}%; transition: width 0.3s ease;"></div>
          </div>
        </div>

        <!-- Summary -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center;">
          <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Avg Revenue per Guest Type</div>
          <div style="display: flex; justify-content: space-around; margin-top: 8px;">
            <div>
              <div style="font-size: 11px; color: #64748b;">New</div>
              <div style="font-size: 16px; font-weight: 700; color: #22c55e;">${newGuestBookings > 0 ? formatCurrency(newGuestRevenue / newGuestBookings, 'GHS') : formatCurrency(0, 'GHS')}</div>
            </div>
            <div>
              <div style="font-size: 11px; color: #64748b;">Returning</div>
              <div style="font-size: 16px; font-weight: 700; color: #3b82f6;">${returningGuestBookings > 0 ? formatCurrency(returningGuestRevenue / returningGuestBookings, 'GHS') : formatCurrency(0, 'GHS')}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering guest type analysis:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading guest type data</div>';
  }
}

// 6. Booking Lead Time Analysis
async function renderBookingLeadTime() {
  const el = document.getElementById('booking-lead-time');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('created_at, check_in')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const leadTimes = reservations.map(r => {
      const created = new Date(r.created_at);
      const checkIn = new Date(r.check_in);
      const diffDays = Math.round((checkIn - created) / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    });

    if (leadTimes.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No booking data available</div>';
      return;
    }

    // Categorize
    const categories = {
      'Same day': leadTimes.filter(d => d === 0).length,
      '1-7 days': leadTimes.filter(d => d >= 1 && d <= 7).length,
      '8-14 days': leadTimes.filter(d => d >= 8 && d <= 14).length,
      '15-30 days': leadTimes.filter(d => d >= 15 && d <= 30).length,
      '31-60 days': leadTimes.filter(d => d >= 31 && d <= 60).length,
      '60+ days': leadTimes.filter(d => d > 60).length
    };

    const avgLeadTime = leadTimes.reduce((sum, d) => sum + d, 0) / leadTimes.length;
    const medianLeadTime = leadTimes.sort((a, b) => a - b)[Math.floor(leadTimes.length / 2)];

    let html = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Summary Stats -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 8px;">
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Average</div>
            <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${avgLeadTime.toFixed(0)} days</div>
          </div>
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Median</div>
            <div style="font-size: 20px; font-weight: 700; color: #0f172a;">${medianLeadTime} days</div>
          </div>
        </div>

        <!-- Distribution -->
    `;

    Object.entries(categories).forEach(([label, count]) => {
      const percentage = leadTimes.length > 0 ? (count / leadTimes.length) * 100 : 0;
      
      html += `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="flex: 0 0 80px; font-size: 12px; font-weight: 500; color: #0f172a;">${label}</div>
          <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 18px; position: relative; overflow: hidden;">
            <div style="position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, #c9a86a, #d4b474); width: ${percentage}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="flex: 0 0 70px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b;">${count} (${percentage.toFixed(1)}%)</div>
        </div>
      `;
    });

    html += '</div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering booking lead time:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading lead time data</div>';
  }
}

// 7. Room Preferences by Guest Type
async function renderRoomPreferences() {
  const el = document.getElementById('room-preferences');
  if (!el) return;

  try {
    // Get all reservations to identify guest type
    const { data: allReservations, error: allError } = await supabase
      .from('reservations')
      .select('guest_email, created_at, status')
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
      .order('created_at', { ascending: true });

    if (allError) throw allError;

    // Build guest history
    const guestFirstBooking = {};
    allReservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      if (!guestFirstBooking[email]) {
        guestFirstBooking[email] = r.created_at;
      }
    });

    // Get current period with room data
    const { data: periodReservations, error: periodError } = await supabase
      .from('reservations')
      .select('guest_email, room_type_code, created_at')
      .gte('created_at', sqlDate(dateRange.start))
      .lte('created_at', sqlDate(dateRange.end))
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (periodError) throw periodError;

    // Classify and count
    const roomPrefs = {
      new: { SAND: 0, SEA: 0, SUN: 0 },
      returning: { SAND: 0, SEA: 0, SUN: 0 }
    };

    periodReservations.forEach(r => {
      if (!r.guest_email || !r.room_type_code) return;
      const email = r.guest_email.toLowerCase();
      const firstBooking = new Date(guestFirstBooking[email]);
      const periodStart = new Date(dateRange.start);
      const room = r.room_type_code;
      
      if (firstBooking >= periodStart) {
        if (roomPrefs.new[room] !== undefined) roomPrefs.new[room]++;
      } else {
        if (roomPrefs.returning[room] !== undefined) roomPrefs.returning[room]++;
      }
    });

    const newTotal = Object.values(roomPrefs.new).reduce((sum, c) => sum + c, 0);
    const returningTotal = Object.values(roomPrefs.returning).reduce((sum, c) => sum + c, 0);

    const html = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- New Guests -->
        <div class="chart-card">
          <div class="chart-subtitle">New Guests</div>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            ${['SAND', 'SEA', 'SUN'].map(room => {
              const count = roomPrefs.new[room];
              const percentage = newTotal > 0 ? (count / newTotal) * 100 : 0;
              return `
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="flex: 0 0 50px; font-size: 13px; font-weight: 600; color: #0f172a;">${room}</div>
                  <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 18px; overflow: hidden;">
                    <div style="background: #22c55e; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                  </div>
                  <div style="flex: 0 0 50px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b;">${count}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Returning Guests -->
        <div class="chart-card">
          <div class="chart-subtitle">Returning Guests</div>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 12px;">
            ${['SAND', 'SEA', 'SUN'].map(room => {
              const count = roomPrefs.returning[room];
              const percentage = returningTotal > 0 ? (count / returningTotal) * 100 : 0;
              return `
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="flex: 0 0 50px; font-size: 13px; font-weight: 600; color: #0f172a;">${room}</div>
                  <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 18px; overflow: hidden;">
                    <div style="background: #3b82f6; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                  </div>
                  <div style="flex: 0 0 50px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b;">${count}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering room preferences:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading room preference data</div>';
  }
}

// 8. Repeat Guest Analysis
async function renderRepeatGuestAnalysis() {
  const el = document.getElementById('repeat-guest-analysis');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('guest_email, status')
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const emailCounts = {};
    reservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    });

    const distribution = {
      '1 booking': 0,
      '2 bookings': 0,
      '3 bookings': 0,
      '4 bookings': 0,
      '5+ bookings': 0
    };

    Object.values(emailCounts).forEach(count => {
      if (count === 1) distribution['1 booking']++;
      else if (count === 2) distribution['2 bookings']++;
      else if (count === 3) distribution['3 bookings']++;
      else if (count === 4) distribution['4 bookings']++;
      else distribution['5+ bookings']++;
    });

    const totalGuests = Object.keys(emailCounts).length;
    const repeatGuests = totalGuests - distribution['1 booking'];
    const repeatRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;

    let html = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Key Metric -->
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #6c63ff, #5146ff); border-radius: 12px; color: white;">
          <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px; opacity: 0.9;">Repeat Guest Rate</div>
          <div style="font-size: 36px; font-weight: 700; margin-bottom: 4px;">${repeatRate.toFixed(1)}%</div>
          <div style="font-size: 12px; opacity: 0.8;">${repeatGuests} of ${totalGuests} guests</div>
        </div>

        <!-- Distribution -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    Object.entries(distribution).forEach(([label, count]) => {
      const percentage = totalGuests > 0 ? (count / totalGuests) * 100 : 0;
      
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="flex: 0 0 90px; font-size: 12px; font-weight: 500; color: #0f172a;">${label}</div>
          <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 16px; overflow: hidden;">
            <div style="background: #6c63ff; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="flex: 0 0 60px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b;">${count} (${percentage.toFixed(1)}%)</div>
        </div>
      `;
    });

    html += '</div></div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering repeat guest analysis:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading repeat guest data</div>';
  }
}

// 9. Guest Lifetime Value
async function renderGuestLifetimeValue() {
  const el = document.getElementById('guest-lifetime-value');
  if (!el) return;

  try {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('guest_email, total, status')
      .in('status', ['confirmed', 'checked-in', 'checked-out']);

    if (error) throw error;

    const guestLTV = {};
    reservations.forEach(r => {
      if (!r.guest_email) return;
      const email = r.guest_email.toLowerCase();
      guestLTV[email] = (guestLTV[email] || 0) + (r.total || 0);
    });

    const ltvValues = Object.values(guestLTV);
    
    if (ltvValues.length === 0) {
      el.innerHTML = '<div class="analytics-empty">No lifetime value data available</div>';
      return;
    }

    const avgLTV = ltvValues.reduce((sum, v) => sum + v, 0) / ltvValues.length;
    const maxLTV = Math.max(...ltvValues);
    const minLTV = Math.min(...ltvValues);

    // Distribution buckets
    const buckets = {
      'Under 5K': ltvValues.filter(v => v < 5000).length,
      '5K-10K': ltvValues.filter(v => v >= 5000 && v < 10000).length,
      '10K-20K': ltvValues.filter(v => v >= 10000 && v < 20000).length,
      '20K-50K': ltvValues.filter(v => v >= 20000 && v < 50000).length,
      '50K+': ltvValues.filter(v => v >= 50000).length
    };

    let html = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Key Metrics -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Average LTV</div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a;">${formatCurrency(avgLTV, 'GHS')}</div>
          </div>
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Highest LTV</div>
            <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${formatCurrency(maxLTV, 'GHS')}</div>
          </div>
          <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Lowest LTV</div>
            <div style="font-size: 18px; font-weight: 700; color: #94a3b8;">${formatCurrency(minLTV, 'GHS')}</div>
          </div>
        </div>

        <!-- Distribution -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    Object.entries(buckets).forEach(([label, count]) => {
      const percentage = ltvValues.length > 0 ? (count / ltvValues.length) * 100 : 0;
      
      html += `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="flex: 0 0 70px; font-size: 12px; font-weight: 500; color: #0f172a;">${label}</div>
          <div style="flex: 1; background: #f1f5f9; border-radius: 999px; height: 16px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #c9a86a, #d4b474); height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="flex: 0 0 60px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b;">${count} (${percentage.toFixed(1)}%)</div>
        </div>
      `;
    });

    html += '</div></div>';
    el.innerHTML = html;
  } catch (err) {
    console.error('Error rendering guest lifetime value:', err);
    el.innerHTML = '<div class="analytics-empty">Error loading lifetime value data</div>';
  }
}