// src/userGuide.js
// Bernard Admin – Comprehensive User Guide

export function openUserGuide() {
  // Remove existing guide if open
  const existing = document.getElementById('user-guide-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'user-guide-modal';
  overlay.className = 'guide-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.innerHTML = `
    <div class="guide-container">
      <!-- Header -->
      <div class="guide-header">
        <div class="guide-header-content">
          <div class="guide-logo">🤖</div>
          <div>
            <h1 class="guide-title">Bernard Admin User Guide</h1>
            <p class="guide-subtitle">Complete reference for managing your Sojourn Cabins business</p>
          </div>
        </div>
        <button class="guide-close" id="guide-close-btn" title="Close">&times;</button>
      </div>

      <!-- Navigation -->
      <div class="guide-nav">
        <button class="guide-nav-btn active" data-section="overview">Overview</button>
        <button class="guide-nav-btn" data-section="chat">AI Chat</button>
        <button class="guide-nav-btn" data-section="reservations">Reservations</button>
        <button class="guide-nav-btn" data-section="rooms">Room Types</button>
        <button class="guide-nav-btn" data-section="extras">Extras</button>
        <button class="guide-nav-btn" data-section="chef-menu">Chef Menu</button>
        <button class="guide-nav-btn" data-section="extra-selections">Extra Selections</button>
        <button class="guide-nav-btn" data-section="coupons">Coupons</button>
        <button class="guide-nav-btn" data-section="packages">Packages</button>
        <button class="guide-nav-btn" data-section="analytics">Analytics</button>
        <button class="guide-nav-btn" data-section="pricing">Pricing Model</button>
        <button class="guide-nav-btn" data-section="tips">Tips &amp; Shortcuts</button>
      </div>

      <!-- Content -->
      <div class="guide-body">

        <!-- ============ OVERVIEW ============ -->
        <div class="guide-section active" id="guide-overview">
          <h2>Welcome to Bernard Admin</h2>
          <p>Bernard Admin is your all-in-one dashboard for managing <strong>Sojourn Cabins</strong>. It combines a powerful AI chat assistant with a full suite of management tools for reservations, inventory, pricing, analytics, and more.</p>

          <div class="guide-feature-grid">
            <div class="guide-feature-card">
              <div class="guide-feature-icon">💬</div>
              <h3>AI Chat Assistant</h3>
              <p>Manage everything through natural language. Ask Bernard to create bookings, look up reservations, edit inventory, generate reports, and more.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">🗓️</div>
              <h3>Reservations</h3>
              <p>View, create, edit, and manage bookings with list and calendar views. Supports single, group, and package bookings.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">🏠</div>
              <h3>Room Types</h3>
              <p>Manage cabin types with images, pricing (weekday/weekend), capacity, and availability status.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">✨</div>
              <h3>Extras &amp; Add-ons</h3>
              <p>Configure extras like spa treatments, chef experiences, and activities with flexible pricing models.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">👨‍🍳</div>
              <h3>Chef Menu</h3>
              <p>Manage meal options for guests, organised by category (starters, mains, sides) with availability toggles.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">📦</div>
              <h3>Packages</h3>
              <p>Create bundled offers with rooms, extras, and special pricing. Set validity periods and featured status.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">🎟️</div>
              <h3>Coupons</h3>
              <p>Create discount codes with percentage or fixed amounts, usage limits, and targeted application rules.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">📊</div>
              <h3>Analytics</h3>
              <p>Track occupancy, revenue, extras performance, package bookings, and coupon usage with interactive charts.</p>
            </div>
            <div class="guide-feature-card">
              <div class="guide-feature-icon">💷</div>
              <h3>Pricing Model</h3>
              <p>Configure dynamic pricing with occupancy tiers, seasonal rules, lead-time adjustments, and revenue targets.</p>
            </div>
          </div>

          <div class="guide-callout info">
            <strong>Getting Started:</strong> The Chat tab is your home screen. You can accomplish most tasks by simply typing what you need. Use the navigation tabs at the top to access specific management views directly.
          </div>
        </div>

        <!-- ============ AI CHAT ============ -->
        <div class="guide-section" id="guide-chat">
          <h2>💬 AI Chat Assistant</h2>
          <p>Bernard is your AI-powered assistant that understands natural language. It routes your requests to specialised agents that handle different areas of the business.</p>

          <h3>How It Works</h3>
          <p>When you type a message, Bernard's router analyses your intent and delegates to the appropriate specialist agent:</p>

          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead>
                <tr><th>Agent</th><th>Handles</th><th>Example Requests</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Inventory Agent</strong></td><td>Room types, extras, coupons, packages</td><td>"Add a new cabin called Bamboo", "Change COCO's weekend price to £250", "Create a 10% off coupon"</td></tr>
                <tr><td><strong>Reservations Agent</strong></td><td>Creating bookings, checking availability</td><td>"Book COCO for John Smith from 15 Mar to 18 Mar", "Is there availability next weekend?", "Create a group booking for 3 cabins"</td></tr>
                <tr><td><strong>Edit Reservations Agent</strong></td><td>Modifying existing bookings</td><td>"Change confirmation ABC123 check-in to March 20", "Cancel reservation XYZ789", "Update payment status to paid"</td></tr>
                <tr><td><strong>Analytics Agent</strong></td><td>Reports, statistics, trends</td><td>"Show me occupancy for January", "What's the revenue this month?", "Compare Q1 vs Q2"</td></tr>
                <tr><td><strong>Pricing Agent</strong></td><td>Pricing models, rate calculations</td><td>"What's the price for COCO next Friday?", "Show me the active pricing model"</td></tr>
                <tr><td><strong>Chef Menu Agent</strong></td><td>Menu items management</td><td>"Add jollof rice to the mains", "Make the fish starter unavailable"</td></tr>
                <tr><td><strong>Extra Selections Agent</strong></td><td>Guest selection tracking</td><td>"Show me selections for GRP-ABC123", "What has the guest in COCO selected?"</td></tr>
                <tr><td><strong>Blocked Dates Agent</strong></td><td>Blocking/unblocking dates</td><td>"Block COCO from Dec 20 to Dec 25 for maintenance", "Show all blocked dates"</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Chat Tips</h3>
          <ul class="guide-list">
            <li><strong>Be specific:</strong> Include names, dates, codes, and amounts for the best results.</li>
            <li><strong>Use confirmation codes:</strong> Reference bookings by their code (e.g., "Look up SC-ABC123").</li>
            <li><strong>Group booking codes:</strong> Use the GRP- prefix for group bookings (e.g., "Show details for GRP-XYZ789").</li>
            <li><strong>Follow-up naturally:</strong> You can say "change the price to £200" after viewing an item — Bernard remembers context.</li>
            <li><strong>Ask for tables:</strong> Request information in table format for a cleaner view.</li>
          </ul>

          <div class="guide-callout warning">
            <strong>Important:</strong> Bernard always looks up the database before making changes. It will never guess or hallucinate details about your inventory. If something seems off, ask it to list the current items first.
          </div>
        </div>

        <!-- ============ RESERVATIONS ============ -->
        <div class="guide-section" id="guide-reservations">
          <h2>🗓️ Reservations</h2>
          <p>The Reservations tab provides a complete view of all bookings with powerful search, filtering, and two display modes.</p>

          <h3>Views</h3>
          <div class="guide-two-col">
            <div>
              <h4>📋 List View</h4>
              <p>Card-based display showing guest name, dates, room, status, and payment information. Group bookings can be expanded/collapsed to show individual rooms.</p>
            </div>
            <div>
              <h4>📅 Calendar View</h4>
              <p>Monthly grid showing bookings by date. Days are colour-coded:</p>
              <ul class="guide-list">
                <li><span style="color:#16a34a;font-weight:700">Green</span> = Available (all cabins free)</li>
                <li><span style="color:#f59e0b;font-weight:700">Amber</span> = Partially booked</li>
                <li><span style="color:#6b7280;font-weight:700">Grey</span> = Fully booked or blocked</li>
              </ul>
            </div>
          </div>

          <h3>Search &amp; Filter</h3>
          <ul class="guide-list">
            <li><strong>Search box:</strong> Filter by guest name, email, or confirmation code.</li>
            <li><strong>Month dropdown:</strong> Filter to a specific month.</li>
            <li><strong>Year dropdown:</strong> Filter to a specific year.</li>
          </ul>

          <h3>Creating Bookings</h3>
          <p>There are three ways to create a booking:</p>

          <h4>1. Custom Booking (via mobile menu "+New Booking")</h4>
          <ol class="guide-list">
            <li>Select number of adults and dates.</li>
            <li>Click "Search Available Cabins" to see what's free.</li>
            <li>Select one or more cabins (multiple = group booking).</li>
            <li>Fill in guest details (name, email, phone with country code).</li>
            <li>Optionally add extras and apply a coupon code.</li>
            <li>Set booking status and payment status.</li>
            <li>Optionally send confirmation and extras selection emails.</li>
            <li>Click "Create Booking" to save.</li>
          </ol>

          <h4>2. Package Booking (via mobile menu "+New Package")</h4>
          <ol class="guide-list">
            <li>Select a package from the dropdown.</li>
            <li>Choose an available room type (filtered to package's rooms).</li>
            <li>Select a check-in date (check-out auto-calculated from package nights).</li>
            <li>Fill in guest details.</li>
            <li>Review price breakdown and save.</li>
          </ol>

          <h4>3. Via AI Chat</h4>
          <p>Simply tell Bernard: <em>"Book COCO for Jane Doe from March 15 to March 18, email jane@example.com"</em></p>

          <h3>Editing Reservations</h3>
          <p>Click on any reservation in the list to open the edit modal. You can modify:</p>
          <ul class="guide-list">
            <li>Guest information (name, email, phone)</li>
            <li>Dates (check-in, check-out)</li>
            <li>Room assignment</li>
            <li>Extras (add or remove)</li>
            <li>Coupon codes</li>
            <li>Pricing (room price, extras price, discounts)</li>
            <li>Status (Confirmed, Checked In, Checked Out, Cancelled)</li>
            <li>Payment status (Paid, Unpaid, Partial, Refunded)</li>
            <li>Notes</li>
          </ul>

          <h3>Booking Statuses</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><span class="guide-badge ok">Confirmed</span></td><td>Booking is confirmed and active</td></tr>
                <tr><td><span class="guide-badge pending">Pending</span></td><td>Booking is awaiting confirmation</td></tr>
                <tr><td><span class="guide-badge warning">Checked In</span></td><td>Guest has arrived</td></tr>
                <tr><td><span class="guide-badge info">Checked Out</span></td><td>Guest has departed</td></tr>
                <tr><td><span class="guide-badge err">Cancelled</span></td><td>Booking has been cancelled</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Blocked Dates</h3>
          <p>Use the "Block Dates" button (mobile menu) to block cabins for maintenance, staff holidays, private events, or other reasons. Blocked dates appear in the calendar view and prevent bookings for those dates.</p>
        </div>

        <!-- ============ ROOM TYPES ============ -->
        <div class="guide-section" id="guide-rooms">
          <h2>🏠 Room Types</h2>
          <p>Manage your cabin inventory — each room type represents a category of accommodation with its own pricing and capacity.</p>

          <h3>Room Type Properties</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Property</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><strong>Name</strong></td><td>Display name (e.g., "COCO", "TEAK")</td></tr>
                <tr><td><strong>Code</strong></td><td>Short code for internal reference</td></tr>
                <tr><td><strong>Description</strong></td><td>Detailed description of the cabin</td></tr>
                <tr><td><strong>Weekday Price</strong></td><td>Nightly rate for Mon–Thu</td></tr>
                <tr><td><strong>Weekend Price</strong></td><td>Nightly rate for Fri–Sun</td></tr>
                <tr><td><strong>Currency</strong></td><td>GBP, USD, EUR, or GHS</td></tr>
                <tr><td><strong>Max Adults</strong></td><td>Maximum occupancy</td></tr>
                <tr><td><strong>Status</strong></td><td>Active or Inactive</td></tr>
                <tr><td><strong>Image</strong></td><td>Photo of the cabin (uploaded to storage)</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Actions</h3>
          <ul class="guide-list">
            <li><strong>+ Add Room Type:</strong> Click to open the form modal.</li>
            <li><strong>Edit:</strong> Modify any property including image.</li>
            <li><strong>Toggle:</strong> Quickly enable/disable a room type.</li>
            <li><strong>Delete:</strong> Permanently remove (with confirmation).</li>
          </ul>

          <div class="guide-callout info">
            <strong>Note:</strong> Prices shown are base (listed) prices. The active pricing model may dynamically adjust these based on occupancy, seasonality, and lead time. See the <em>Pricing Model</em> section for details.
          </div>
        </div>

        <!-- ============ EXTRAS ============ -->
        <div class="guide-section" id="guide-extras">
          <h2>✨ Extras &amp; Add-ons</h2>
          <p>Extras are additional services, experiences, or amenities that guests can add to their booking.</p>

          <h3>Extra Properties</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Property</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><strong>Name</strong></td><td>Display name of the extra</td></tr>
                <tr><td><strong>Code</strong></td><td>Short code (e.g., "SPA1", "CHEF")</td></tr>
                <tr><td><strong>Category</strong></td><td>Grouping category</td></tr>
                <tr><td><strong>Price</strong></td><td>Cost per unit</td></tr>
                <tr><td><strong>Unit Type</strong></td><td>How pricing is calculated</td></tr>
                <tr><td><strong>Needs Guest Input</strong></td><td>Whether guests need to make selections (e.g., menu choices)</td></tr>
                <tr><td><strong>Status</strong></td><td>Active or Inactive</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Pricing Unit Types</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Unit Type</th><th>How It's Calculated</th><th>Example</th></tr></thead>
              <tbody>
                <tr><td><strong>Per Booking</strong></td><td>Flat fee for the entire stay</td><td>Airport transfer: £50 per booking</td></tr>
                <tr><td><strong>Per Night</strong></td><td>Multiplied by number of nights</td><td>Hot tub access: £20/night &times; 3 nights = £60</td></tr>
                <tr><td><strong>Per Person</strong></td><td>Multiplied by number of guests</td><td>Spa treatment: £40/person &times; 2 guests = £80</td></tr>
                <tr><td><strong>Per Person/Night</strong></td><td>Multiplied by guests AND nights</td><td>Chef menu: £30/person/night &times; 2 guests &times; 3 nights = £180</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Guest Input Extras</h3>
          <p>When <em>Needs Guest Input</em> is enabled, guests receive an extras selection email where they can choose specific options (e.g., meal choices from the chef menu). Their selections appear in the <strong>Extra Selections</strong> tab.</p>
        </div>

        <!-- ============ CHEF MENU ============ -->
        <div class="guide-section" id="guide-chef-menu">
          <h2>👨‍🍳 Chef Menu</h2>
          <p>Manage the menu items available for the private chef experience. Guests who book the chef extra will select from these items.</p>

          <h3>Categories</h3>
          <ul class="guide-list">
            <li><strong>Starters</strong> — Appetiser options</li>
            <li><strong>Local Mains</strong> — Traditional/local main courses</li>
            <li><strong>Continental Mains</strong> — International main courses</li>
            <li><strong>Local Sides</strong> — Traditional/local side dishes</li>
            <li><strong>Continental Sides</strong> — International side dishes</li>
          </ul>

          <h3>Managing Items</h3>
          <ul class="guide-list">
            <li><strong>Add:</strong> Create new menu items with a name, description, and category.</li>
            <li><strong>Edit:</strong> Update item details at any time.</li>
            <li><strong>Toggle Availability:</strong> Quickly mark items as available or unavailable without deleting them.</li>
            <li><strong>Delete:</strong> Permanently remove items.</li>
            <li><strong>Filter:</strong> Use the category filter to view specific sections of the menu.</li>
          </ul>
        </div>

        <!-- ============ EXTRA SELECTIONS ============ -->
        <div class="guide-section" id="guide-extra-selections">
          <h2>🧾 Extra Selections</h2>
          <p>Track and manage what guests have selected for their extras (e.g., chef menu choices, experience preferences).</p>

          <h3>Status Workflow</h3>
          <div class="guide-workflow">
            <div class="guide-workflow-step">
              <div class="guide-workflow-dot pending"></div>
              <div>
                <strong>Pending</strong>
                <p>Extras selection email sent; guest hasn't submitted yet.</p>
              </div>
            </div>
            <div class="guide-workflow-arrow">&rarr;</div>
            <div class="guide-workflow-step">
              <div class="guide-workflow-dot submitted"></div>
              <div>
                <strong>Submitted</strong>
                <p>Guest has made their selections.</p>
              </div>
            </div>
            <div class="guide-workflow-arrow">&rarr;</div>
            <div class="guide-workflow-step">
              <div class="guide-workflow-dot completed"></div>
              <div>
                <strong>Completed</strong>
                <p>Admin has reviewed and actioned the selections.</p>
              </div>
            </div>
          </div>

          <h3>What You Can See</h3>
          <ul class="guide-list">
            <li><strong>Chef Menu Selections:</strong> Per-guest meal choices for each day (appetiser, main, side, special requests).</li>
            <li><strong>Experience Selections:</strong> Date, time, and quantity for booked experiences.</li>
            <li><strong>Group Bookings:</strong> Selections are grouped by room for group reservations (GRP-XXXXXX codes).</li>
          </ul>

          <h3>Actions</h3>
          <ul class="guide-list">
            <li><strong>View Details:</strong> See the full breakdown of a guest's selections.</li>
            <li><strong>Edit:</strong> Modify selections on behalf of the guest.</li>
            <li><strong>Update Status:</strong> Toggle between Pending, Submitted, and Completed.</li>
            <li><strong>Filter:</strong> Filter by status or search by confirmation code / guest name.</li>
          </ul>
        </div>

        <!-- ============ COUPONS ============ -->
        <div class="guide-section" id="guide-coupons">
          <h2>🎟️ Coupons</h2>
          <p>Create and manage discount codes that guests can apply to their bookings.</p>

          <h3>Coupon Properties</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Property</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><strong>Code</strong></td><td>The discount code guests enter (e.g., "SUMMER20")</td></tr>
                <tr><td><strong>Discount Type</strong></td><td>Percentage (%) or Fixed Amount (£)</td></tr>
                <tr><td><strong>Discount Value</strong></td><td>Amount or percentage of discount</td></tr>
                <tr><td><strong>Applies To</strong></td><td>Room only, Extras only, or Both</td></tr>
                <tr><td><strong>Specific Extras</strong></td><td>Optionally target specific extras only</td></tr>
                <tr><td><strong>Valid From / Until</strong></td><td>Date range when the coupon is active</td></tr>
                <tr><td><strong>Max Uses</strong></td><td>Total number of times the coupon can be used</td></tr>
                <tr><td><strong>Max Per Guest</strong></td><td>Maximum uses per individual guest</td></tr>
                <tr><td><strong>Min Booking Amount</strong></td><td>Minimum booking value required to use the coupon</td></tr>
                <tr><td><strong>Status</strong></td><td>Active or Inactive</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Usage Tracking</h3>
          <p>Each coupon tracks its current usage count against the maximum allowed uses. You can monitor this in the coupon list view.</p>

          <div class="guide-callout info">
            <strong>Tip:</strong> Use the "Applies To" field strategically. A coupon that applies to "Both" will discount both the room rate and any extras, while "Room Only" keeps extras at full price.
          </div>
        </div>

        <!-- ============ PACKAGES ============ -->
        <div class="guide-section" id="guide-packages">
          <h2>📦 Packages</h2>
          <p>Packages bundle rooms and extras together at a special price, making it easy for guests to book curated experiences.</p>

          <h3>Package Properties</h3>
          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead><tr><th>Property</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><strong>Name</strong></td><td>Package name (e.g., "Romantic Getaway")</td></tr>
                <tr><td><strong>Description</strong></td><td>What's included and any special details</td></tr>
                <tr><td><strong>Price</strong></td><td>Total package price</td></tr>
                <tr><td><strong>Nights</strong></td><td>Number of nights included</td></tr>
                <tr><td><strong>Room Types</strong></td><td>Which cabins this package can be booked for</td></tr>
                <tr><td><strong>Extras</strong></td><td>Included extras with quantities</td></tr>
                <tr><td><strong>Valid From / Until</strong></td><td>Booking window</td></tr>
                <tr><td><strong>Featured</strong></td><td>Highlighted on the website</td></tr>
                <tr><td><strong>Image</strong></td><td>Package thumbnail</td></tr>
                <tr><td><strong>Sort Order</strong></td><td>Display order in lists</td></tr>
                <tr><td><strong>Status</strong></td><td>Active or Inactive</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Creating a Package</h3>
          <ol class="guide-list">
            <li>Click <strong>+ Add Package</strong>.</li>
            <li>Enter name, description, price, and number of nights.</li>
            <li>Select which room types the package is available for.</li>
            <li>Add extras to include (with quantities).</li>
            <li>Set validity dates and featured status.</li>
            <li>Upload an image and save.</li>
          </ol>

          <h3>Booking a Package</h3>
          <p>Use the <strong>+New Package</strong> button from the mobile menu or ask Bernard: <em>"Book the Romantic Getaway package for Jane Doe in COCO starting March 15"</em></p>
        </div>

        <!-- ============ ANALYTICS ============ -->
        <div class="guide-section" id="guide-analytics">
          <h2>📊 Analytics</h2>
          <p>The Analytics tab provides comprehensive insights into your business performance with interactive charts and detailed breakdowns.</p>

          <h3>Analytics Sections</h3>

          <h4>Upcoming &amp; Operational</h4>
          <p>Quick overview of the next 7 days — check-ins, check-outs, and current cabin status.</p>

          <h4>Occupancy Analytics</h4>
          <ul class="guide-list">
            <li>Total nights booked, average occupancy rate, peak periods</li>
            <li>Occupancy trend charts (daily / weekly / monthly granularity)</li>
            <li>Occupancy breakdown by cabin</li>
            <li>Booking source analysis</li>
          </ul>

          <h4>Revenue Analytics</h4>
          <ul class="guide-list">
            <li>Total revenue, average per booking, average per night</li>
            <li>Revenue trend charts</li>
            <li>Revenue breakdown by cabin and source</li>
          </ul>

          <h4>Extras Performance</h4>
          <ul class="guide-list">
            <li>Total extras revenue, number of bookings with extras</li>
            <li>Top extras by popularity</li>
            <li>Extras revenue breakdown</li>
            <li>Extras pairing analysis (which extras are booked together)</li>
          </ul>

          <h4>Package Performance</h4>
          <ul class="guide-list">
            <li>Package bookings count and revenue</li>
            <li>Performance by package type</li>
          </ul>

          <h4>Coupon Analytics</h4>
          <ul class="guide-list">
            <li>Total discounts given, usage count, average discount value</li>
            <li>Top coupons by usage</li>
          </ul>

          <h3>Filtering &amp; Comparison</h3>
          <ul class="guide-list">
            <li><strong>Date Range:</strong> Select months and years, or use custom date range (DD/MM/YYYY format).</li>
            <li><strong>Comparison Mode:</strong> Compare two time periods side-by-side.</li>
            <li><strong>Client Analytics:</strong> View guest demographics and booking behaviour.</li>
            <li><strong>Chart Granularity:</strong> Toggle between daily, weekly, and monthly views.</li>
          </ul>
        </div>

        <!-- ============ PRICING MODEL ============ -->
        <div class="guide-section" id="guide-pricing">
          <h2>💷 Pricing Model</h2>
          <p>Dynamic pricing allows rates to automatically adjust based on demand, seasonality, and booking lead time.</p>

          <h3>Tabs</h3>

          <h4>Configuration</h4>
          <p>Set up and manage your pricing models:</p>
          <ul class="guide-list">
            <li><strong>Room Type Groups:</strong> Assign cabins to pricing groups.</li>
            <li><strong>Tier Templates:</strong> Define occupancy-based pricing tiers (e.g., "When 80%+ occupied, multiply by 1.3x").</li>
            <li><strong>Month Rules:</strong> Set seasonal adjustments (e.g., summer premium, winter discount).</li>
            <li><strong>Lead Window Rules:</strong> Adjust pricing based on how far in advance a booking is made.</li>
            <li><strong>Min/Max Price:</strong> Set floor and ceiling prices.</li>
          </ul>

          <h4>Simulator</h4>
          <p>Test how your pricing model works:</p>
          <ol class="guide-list">
            <li>Select a room type.</li>
            <li>Choose check-in and check-out dates.</li>
            <li>View the step-by-step price calculation (base price &rarr; tier adjustment &rarr; pace multiplier &rarr; final price).</li>
            <li>See nightly rate breakdown.</li>
          </ol>

          <h4>Revenue Model</h4>
          <p>Track performance against revenue targets:</p>
          <ul class="guide-list">
            <li>Set revenue targets per room type.</li>
            <li>Monitor actual vs. target revenue.</li>
            <li>View sensitivity analysis.</li>
          </ul>

          <div class="guide-callout warning">
            <strong>Important:</strong> Only one pricing model can be active at a time. The active model is used for all new bookings unless the admin overrides the price manually.
          </div>
        </div>

        <!-- ============ TIPS ============ -->
        <div class="guide-section" id="guide-tips">
          <h2>💡 Tips &amp; Shortcuts</h2>

          <h3>Keyboard &amp; Navigation</h3>
          <ul class="guide-list">
            <li>Press <kbd>Enter</kbd> in the chat input to send a message.</li>
            <li>Use the tab buttons at the top (desktop) or the ☰ menu (mobile) to switch views.</li>
            <li>Click any reservation card to view/edit it.</li>
          </ul>

          <h3>Chat Power Tips</h3>
          <ul class="guide-list">
            <li><strong>Bulk operations:</strong> "List all reservations for March" then follow up with specific actions.</li>
            <li><strong>Quick lookups:</strong> "What's in COCO this weekend?" for fast availability checks.</li>
            <li><strong>Price checks:</strong> "How much is TEAK for 3 nights starting Friday?" uses the active pricing model.</li>
            <li><strong>Group bookings:</strong> "Create a group booking for 3 cabins for the Smith party" handles multiple rooms.</li>
            <li><strong>Coupon validation:</strong> "Is coupon SUMMER20 still valid?" checks usage limits and dates.</li>
          </ul>

          <h3>Common Workflows</h3>

          <div class="guide-callout info">
            <strong>New Guest Enquiry:</strong><br>
            1. Ask Bernard: "Is COCO available from March 15 to 18?"<br>
            2. If available: "Book it for John Smith, email john@email.com, phone +44 7700 123456"<br>
            3. Bernard creates the booking and offers to send confirmation email.
          </div>

          <div class="guide-callout info">
            <strong>Editing Inventory:</strong><br>
            1. Ask: "Show me all extras" to see current items.<br>
            2. Then: "Update the Spa Treatment price to £60"<br>
            3. Bernard finds the item by name or code and updates it.
          </div>

          <div class="guide-callout info">
            <strong>Reviewing Selections:</strong><br>
            1. Go to Extra Selections tab or ask: "Show selections for GRP-ABC123"<br>
            2. View per-guest meal choices with menu item names (not raw IDs).<br>
            3. Mark as completed once actioned.
          </div>

          <h3>Mobile Usage</h3>
          <ul class="guide-list">
            <li>Use the <strong>☰ menu</strong> button to access all tabs and booking actions.</li>
            <li>The calendar view adapts to show colour-coded availability on small screens.</li>
            <li>All modals are optimised for mobile with scrollable content and sticky footers.</li>
            <li>The chat is the most efficient way to manage tasks on mobile — just type what you need.</li>
          </ul>
        </div>

      </div><!-- end guide-body -->
    </div><!-- end guide-container -->
  `;

  document.body.appendChild(overlay);

  // Wire close button
  overlay.querySelector('#guide-close-btn').addEventListener('click', () => overlay.remove());

  // Wire navigation
  const navBtns = overlay.querySelectorAll('.guide-nav-btn');
  const sections = overlay.querySelectorAll('.guide-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => s.classList.remove('active'));
      overlay.querySelector(`#guide-${target}`).classList.add('active');

      // Scroll to top of content
      overlay.querySelector('.guide-body').scrollTop = 0;
    });
  });
}
