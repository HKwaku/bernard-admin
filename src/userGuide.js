// src/userGuide.js
// Bernard Admin – Interactive User Guide

export function openUserGuide() {
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
      <div class="guide-header">
        <div class="guide-header-content">
          <div class="guide-logo">🤖</div>
          <div>
            <h1 class="guide-title">Bernard Admin Guide</h1>
            <p class="guide-subtitle">Your complete reference for Sojourn Cabins</p>
          </div>
        </div>
        <button class="guide-close" id="guide-close-btn" title="Close">&times;</button>
      </div>

      <div class="guide-nav">
        <button class="guide-nav-btn active" data-section="overview">Overview</button>
        <button class="guide-nav-btn" data-section="chat">AI Chat</button>
        <button class="guide-nav-btn" data-section="reservations">Reservations</button>
        <button class="guide-nav-btn" data-section="rooms">Room Types</button>
        <button class="guide-nav-btn" data-section="extras">Extras</button>
        <button class="guide-nav-btn" data-section="chef-menu">Chef Menu</button>
        <button class="guide-nav-btn" data-section="extra-selections">Selections</button>
        <button class="guide-nav-btn" data-section="coupons">Coupons</button>
        <button class="guide-nav-btn" data-section="packages">Packages</button>
        <button class="guide-nav-btn" data-section="analytics">Analytics</button>
        <button class="guide-nav-btn" data-section="pricing">Pricing</button>
        <button class="guide-nav-btn" data-section="tips">Tips</button>
      </div>

      <div class="guide-body">

        <!-- ============ OVERVIEW ============ -->
        <div class="guide-section active" id="guide-overview">
          <div class="guide-hero">
            <h2>Welcome to Bernard Admin</h2>
            <p class="guide-hero-sub">Your all-in-one AI-powered dashboard for managing <strong>Sojourn Cabins</strong>. Tap any card below to learn more.</p>
          </div>

          <div class="guide-feature-grid">
            <div class="guide-feature-card" data-goto="chat">
              <div class="guide-feature-icon">💬</div>
              <div class="guide-feature-text">
                <h3>AI Chat Assistant</h3>
                <p>Manage everything through natural language — bookings, inventory, reports, and more.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="reservations">
              <div class="guide-feature-icon">🗓️</div>
              <div class="guide-feature-text">
                <h3>Reservations</h3>
                <p>List &amp; calendar views. Single, group, and package bookings.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="rooms">
              <div class="guide-feature-icon">🏠</div>
              <div class="guide-feature-text">
                <h3>Room Types</h3>
                <p>Cabin pricing, capacity, images, and availability.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="extras">
              <div class="guide-feature-icon">✨</div>
              <div class="guide-feature-text">
                <h3>Extras &amp; Add-ons</h3>
                <p>Spa, chef, activities — flexible pricing models.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="chef-menu">
              <div class="guide-feature-icon">👨‍🍳</div>
              <div class="guide-feature-text">
                <h3>Chef Menu</h3>
                <p>Meal options by category with availability toggles.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="packages">
              <div class="guide-feature-icon">📦</div>
              <div class="guide-feature-text">
                <h3>Packages</h3>
                <p>Bundled offers with rooms, extras, and special pricing.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="coupons">
              <div class="guide-feature-icon">🎟️</div>
              <div class="guide-feature-text">
                <h3>Coupons</h3>
                <p>Discount codes with usage limits and targeting rules.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="analytics">
              <div class="guide-feature-icon">📊</div>
              <div class="guide-feature-text">
                <h3>Analytics</h3>
                <p>Occupancy, revenue, extras, and coupon performance.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
            <div class="guide-feature-card" data-goto="pricing">
              <div class="guide-feature-icon">💷</div>
              <div class="guide-feature-text">
                <h3>Pricing Model</h3>
                <p>Dynamic pricing with tiers, seasons, and lead-time rules.</p>
              </div>
              <span class="guide-feature-arrow">&rsaquo;</span>
            </div>
          </div>

          <div class="guide-callout info">
            <strong>💡 Quick Start</strong>
            <span>The <strong>Chat</strong> tab is your home screen. Just type what you need — Bernard handles the rest.</span>
          </div>
        </div>

        <!-- ============ AI CHAT ============ -->
        <div class="guide-section" id="guide-chat">
          <h2>💬 AI Chat Assistant</h2>
          <p class="guide-intro">Bernard understands natural language and routes your requests to specialist agents automatically.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🔀</span>
              <span>How It Works</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <p>When you type a message, Bernard's router analyses your intent and delegates to the right agent:</p>
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Agent</th><th>Handles</th><th>Example</th></tr></thead>
                  <tbody>
                    <tr><td>Inventory</td><td>Rooms, extras, coupons, packages</td><td>"Change COCO's weekend price to £250"</td></tr>
                    <tr><td>Reservations</td><td>New bookings, availability</td><td>"Book COCO for John Smith, 15–18 Mar"</td></tr>
                    <tr><td>Edit Reservations</td><td>Modifying existing bookings</td><td>"Change check-in on ABC123 to March 20"</td></tr>
                    <tr><td>Analytics</td><td>Reports &amp; statistics</td><td>"Show occupancy for January"</td></tr>
                    <tr><td>Pricing</td><td>Rates &amp; pricing models</td><td>"What's the price for COCO next Friday?"</td></tr>
                    <tr><td>Chef Menu</td><td>Menu items</td><td>"Add jollof rice to the mains"</td></tr>
                    <tr><td>Extra Selections</td><td>Guest selection tracking</td><td>"Show selections for GRP-ABC123"</td></tr>
                    <tr><td>Blocked Dates</td><td>Room blocking</td><td>"Block COCO Dec 20–25 for maintenance"</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">💡</span>
              <span>Chat Tips</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Be specific:</strong> Include names, dates, codes, and amounts.</li>
                <li><strong>Use confirmation codes:</strong> Reference bookings like "Look up SC-ABC123".</li>
                <li><strong>Group bookings:</strong> Use the GRP- prefix (e.g., "Show GRP-XYZ789").</li>
                <li><strong>Follow-up naturally:</strong> Say "change the price to £200" after viewing an item.</li>
                <li><strong>Ask for tables:</strong> Request table format for cleaner data views.</li>
              </ul>
            </div>
          </div>

          <div class="guide-callout warning">
            <strong>⚠️ Good to Know</strong>
            <span>Bernard always checks the database before making changes — it never guesses. If something seems off, ask it to list current items first.</span>
          </div>
        </div>

        <!-- ============ RESERVATIONS ============ -->
        <div class="guide-section" id="guide-reservations">
          <h2>🗓️ Reservations</h2>
          <p class="guide-intro">Complete booking management with search, filtering, and two display modes.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">👁️</span>
              <span>Views</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-two-col">
                <div>
                  <h4>📋 List View</h4>
                  <p>Card-based display showing guest name, dates, room, status, and payment. Group bookings expand to show individual rooms.</p>
                </div>
                <div>
                  <h4>📅 Calendar View</h4>
                  <p>Monthly grid with colour-coded days:</p>
                  <ul class="guide-list">
                    <li><span style="color:#16a34a;font-weight:700">Green</span> = All cabins free</li>
                    <li><span style="color:#f59e0b;font-weight:700">Amber</span> = Partially booked</li>
                    <li><span style="color:#6b7280;font-weight:700">Grey</span> = Fully booked/blocked</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🔍</span>
              <span>Search &amp; Filter</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Search box:</strong> Filter by guest name, email, or confirmation code.</li>
                <li><strong>Month dropdown:</strong> Filter to a specific month.</li>
                <li><strong>Year dropdown:</strong> Filter to a specific year.</li>
              </ul>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">➕</span>
              <span>Creating Bookings</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <h4>1. Custom Booking</h4>
              <ol class="guide-list">
                <li>Select adults and dates, then search available cabins.</li>
                <li>Pick cabin(s) — multiple = group booking.</li>
                <li>Fill in guest details, add extras, apply coupon.</li>
                <li>Set status, send emails, and create.</li>
              </ol>
              <h4>2. Package Booking</h4>
              <ol class="guide-list">
                <li>Select package → room → check-in date (check-out auto-calculated).</li>
                <li>Fill guest details, review price breakdown, and save.</li>
              </ol>
              <h4>3. Via AI Chat</h4>
              <p>Just say: <em>"Book COCO for Jane Doe from March 15 to 18, email jane@example.com"</em></p>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">✏️</span>
              <span>Editing &amp; Statuses</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <p>Click any reservation card to edit guest info, dates, room, extras, pricing, status, or payment.</p>
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
                  <tbody>
                    <tr><td><span class="guide-badge ok">Confirmed</span></td><td>Active booking</td></tr>
                    <tr><td><span class="guide-badge pending">Pending</span></td><td>Awaiting confirmation</td></tr>
                    <tr><td><span class="guide-badge warning">Checked In</span></td><td>Guest has arrived</td></tr>
                    <tr><td><span class="guide-badge info">Checked Out</span></td><td>Guest has departed</td></tr>
                    <tr><td><span class="guide-badge err">Cancelled</span></td><td>Booking cancelled</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🚫</span>
              <span>Blocked Dates</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <p>Block cabins for maintenance, staff holidays, or private events. Blocked dates appear in the calendar and prevent bookings.</p>
            </div>
          </div>
        </div>

        <!-- ============ ROOM TYPES ============ -->
        <div class="guide-section" id="guide-rooms">
          <h2>🏠 Room Types</h2>
          <p class="guide-intro">Manage your cabin inventory — each room type has its own pricing, capacity, and images.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📋</span>
              <span>Properties</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Property</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td>Name</td><td>Display name (e.g., "COCO", "TEAK")</td></tr>
                    <tr><td>Code</td><td>Short internal reference code</td></tr>
                    <tr><td>Weekday Price</td><td>Nightly rate Mon–Thu</td></tr>
                    <tr><td>Weekend Price</td><td>Nightly rate Fri–Sun</td></tr>
                    <tr><td>Max Adults</td><td>Maximum occupancy</td></tr>
                    <tr><td>Status</td><td>Active or Inactive</td></tr>
                    <tr><td>Image</td><td>Photo uploaded to storage</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">⚡</span>
              <span>Actions</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>+ Add Room Type:</strong> Open the creation form.</li>
                <li><strong>Edit:</strong> Modify any property including image.</li>
                <li><strong>Toggle:</strong> Enable/disable a room type.</li>
                <li><strong>Delete:</strong> Permanently remove (with confirmation).</li>
              </ul>
              <div class="guide-callout info">
                <strong>💡 Note</strong>
                <span>Prices shown are base rates. The active pricing model may adjust them dynamically.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ EXTRAS ============ -->
        <div class="guide-section" id="guide-extras">
          <h2>✨ Extras &amp; Add-ons</h2>
          <p class="guide-intro">Additional services and experiences guests can add to their booking.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📋</span>
              <span>Properties</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Property</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td>Name / Code</td><td>Display name and short code (e.g., "SPA1")</td></tr>
                    <tr><td>Category</td><td>Grouping category</td></tr>
                    <tr><td>Price</td><td>Cost per unit</td></tr>
                    <tr><td>Unit Type</td><td>How pricing is calculated</td></tr>
                    <tr><td>Needs Guest Input</td><td>Whether guests make selections</td></tr>
                    <tr><td>Status</td><td>Active or Inactive</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🧮</span>
              <span>Pricing Unit Types</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Type</th><th>Calculation</th><th>Example</th></tr></thead>
                  <tbody>
                    <tr><td>Per Booking</td><td>Flat fee</td><td>Transfer: £50</td></tr>
                    <tr><td>Per Night</td><td>&times; nights</td><td>Hot tub: £20 &times; 3 = £60</td></tr>
                    <tr><td>Per Person</td><td>&times; guests</td><td>Spa: £40 &times; 2 = £80</td></tr>
                    <tr><td>Per Person/Night</td><td>&times; guests &times; nights</td><td>Chef: £30 &times; 2 &times; 3 = £180</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📧</span>
              <span>Guest Input Extras</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <p>When <em>Needs Guest Input</em> is enabled, guests receive an email to choose options (e.g., chef menu). Selections appear in the <strong>Extra Selections</strong> tab.</p>
            </div>
          </div>
        </div>

        <!-- ============ CHEF MENU ============ -->
        <div class="guide-section" id="guide-chef-menu">
          <h2>👨‍🍳 Chef Menu</h2>
          <p class="guide-intro">Manage dishes for the private chef experience across five categories.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📂</span>
              <span>Categories</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-chip-row">
                <span class="guide-chip">Starters</span>
                <span class="guide-chip">Local Mains</span>
                <span class="guide-chip">Continental Mains</span>
                <span class="guide-chip">Local Sides</span>
                <span class="guide-chip">Continental Sides</span>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">⚡</span>
              <span>Managing Items</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Add:</strong> New items with name, description, and category.</li>
                <li><strong>Edit:</strong> Update details at any time.</li>
                <li><strong>Toggle:</strong> Mark available/unavailable without deleting.</li>
                <li><strong>Delete:</strong> Permanently remove items.</li>
                <li><strong>Filter:</strong> View specific menu categories.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- ============ EXTRA SELECTIONS ============ -->
        <div class="guide-section" id="guide-extra-selections">
          <h2>🧾 Extra Selections</h2>
          <p class="guide-intro">Track what guests have selected for their extras — meal choices, experience preferences, and more.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🔄</span>
              <span>Status Workflow</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-workflow">
                <div class="guide-workflow-step">
                  <div class="guide-workflow-dot pending"></div>
                  <div><strong>Pending</strong><p>Email sent, awaiting guest</p></div>
                </div>
                <div class="guide-workflow-arrow">&rsaquo;</div>
                <div class="guide-workflow-step">
                  <div class="guide-workflow-dot submitted"></div>
                  <div><strong>Submitted</strong><p>Guest made selections</p></div>
                </div>
                <div class="guide-workflow-arrow">&rsaquo;</div>
                <div class="guide-workflow-step">
                  <div class="guide-workflow-dot completed"></div>
                  <div><strong>Completed</strong><p>Admin reviewed &amp; actioned</p></div>
                </div>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">👀</span>
              <span>What You Can See</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Chef Selections:</strong> Per-guest meals for each day.</li>
                <li><strong>Experiences:</strong> Date, time, quantity for activities.</li>
                <li><strong>Group Bookings:</strong> Selections grouped by room (GRP codes).</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- ============ COUPONS ============ -->
        <div class="guide-section" id="guide-coupons">
          <h2>🎟️ Coupons</h2>
          <p class="guide-intro">Create and manage discount codes for guest bookings.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📋</span>
              <span>Coupon Properties</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Property</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td>Code</td><td>Discount code (e.g., "SUMMER20")</td></tr>
                    <tr><td>Type &amp; Value</td><td>Percentage (%) or Fixed Amount (£)</td></tr>
                    <tr><td>Applies To</td><td>Room only, Extras only, or Both</td></tr>
                    <tr><td>Valid Period</td><td>Start and end dates</td></tr>
                    <tr><td>Max Uses</td><td>Total and per-guest limits</td></tr>
                    <tr><td>Min Amount</td><td>Minimum booking value required</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📊</span>
              <span>Usage Tracking</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <p>Each coupon tracks usage count vs. maximum. Monitor this in the list view.</p>
              <div class="guide-callout info">
                <strong>💡 Tip</strong>
                <span>"Applies To: Both" discounts room + extras. "Room Only" keeps extras at full price.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ PACKAGES ============ -->
        <div class="guide-section" id="guide-packages">
          <h2>📦 Packages</h2>
          <p class="guide-intro">Bundle rooms and extras at a special price for curated guest experiences.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📋</span>
              <span>Package Properties</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-table-wrap">
                <table class="guide-table">
                  <thead><tr><th>Property</th><th>Description</th></tr></thead>
                  <tbody>
                    <tr><td>Name</td><td>e.g., "Romantic Getaway"</td></tr>
                    <tr><td>Price &amp; Nights</td><td>Total price and included nights</td></tr>
                    <tr><td>Room Types</td><td>Available cabins</td></tr>
                    <tr><td>Extras</td><td>Included extras with quantities</td></tr>
                    <tr><td>Valid Period</td><td>Booking window dates</td></tr>
                    <tr><td>Featured</td><td>Highlighted on website</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🛠️</span>
              <span>Creating &amp; Booking</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <h4>Creating</h4>
              <ol class="guide-list">
                <li>Click <strong>+ Add Package</strong>.</li>
                <li>Set name, price, nights, rooms, and extras.</li>
                <li>Configure validity dates and featured status.</li>
                <li>Upload image and save.</li>
              </ol>
              <h4>Booking</h4>
              <p>Use <strong>+New Package</strong> button or ask Bernard: <em>"Book the Romantic Getaway for Jane Doe in COCO starting March 15"</em></p>
            </div>
          </div>
        </div>

        <!-- ============ ANALYTICS ============ -->
        <div class="guide-section" id="guide-analytics">
          <h2>📊 Analytics</h2>
          <p class="guide-intro">Comprehensive business insights with interactive charts and breakdowns.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📈</span>
              <span>Dashboard Sections</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-mini-cards">
                <div class="guide-mini-card">
                  <strong>🔮 Upcoming</strong>
                  <p>Next 7 days — check-ins, check-outs, cabin status</p>
                </div>
                <div class="guide-mini-card">
                  <strong>🛏️ Occupancy</strong>
                  <p>Nights booked, rates, trends, breakdown by cabin</p>
                </div>
                <div class="guide-mini-card">
                  <strong>💰 Revenue</strong>
                  <p>Total revenue, per booking, per night, by source</p>
                </div>
                <div class="guide-mini-card">
                  <strong>✨ Extras</strong>
                  <p>Extras revenue, popularity, pairing analysis</p>
                </div>
                <div class="guide-mini-card">
                  <strong>📦 Packages</strong>
                  <p>Package bookings, revenue, performance</p>
                </div>
                <div class="guide-mini-card">
                  <strong>🎟️ Coupons</strong>
                  <p>Total discounts, usage count, top coupons</p>
                </div>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">⚙️</span>
              <span>Filtering &amp; Comparison</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Date Range:</strong> Select months/years or custom dates.</li>
                <li><strong>Comparison:</strong> Compare two periods side-by-side.</li>
                <li><strong>Client Analytics:</strong> Guest demographics and behaviour.</li>
                <li><strong>Granularity:</strong> Daily, weekly, or monthly chart views.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- ============ PRICING ============ -->
        <div class="guide-section" id="guide-pricing">
          <h2>💷 Pricing Model</h2>
          <p class="guide-intro">Dynamic pricing that adjusts rates based on demand, seasonality, and lead time.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">⚙️</span>
              <span>Configuration</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Room Groups:</strong> Assign cabins to pricing groups.</li>
                <li><strong>Tier Templates:</strong> Occupancy-based multipliers (e.g., 80%+ → 1.3x).</li>
                <li><strong>Month Rules:</strong> Seasonal premiums/discounts.</li>
                <li><strong>Lead Window:</strong> Pricing by advance booking time.</li>
                <li><strong>Min/Max:</strong> Floor and ceiling prices.</li>
              </ul>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🧪</span>
              <span>Simulator</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ol class="guide-list">
                <li>Select a room type.</li>
                <li>Choose check-in and check-out dates.</li>
                <li>View step-by-step calculation: base → tier → pace → final.</li>
                <li>See nightly rate breakdown.</li>
              </ol>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🎯</span>
              <span>Revenue Model</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li>Set revenue targets per room type.</li>
                <li>Monitor actual vs. target revenue.</li>
                <li>View sensitivity analysis.</li>
              </ul>
              <div class="guide-callout warning">
                <strong>⚠️ Important</strong>
                <span>Only one pricing model can be active at a time. It applies to all new bookings unless manually overridden.</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============ TIPS ============ -->
        <div class="guide-section" id="guide-tips">
          <h2>💡 Tips &amp; Shortcuts</h2>
          <p class="guide-intro">Get the most out of Bernard Admin with these power-user tips.</p>

          <div class="guide-accordion" data-open="false">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">⌨️</span>
              <span>Navigation</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li>Press <kbd>Enter</kbd> to send a chat message.</li>
                <li>Use tab buttons (desktop) or <strong>☰ menu</strong> (mobile) to switch views.</li>
                <li>Click any reservation card to view/edit it.</li>
              </ul>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">🚀</span>
              <span>Chat Power Tips</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li><strong>Bulk ops:</strong> "List all reservations for March" then follow up.</li>
                <li><strong>Quick lookup:</strong> "What's in COCO this weekend?"</li>
                <li><strong>Price check:</strong> "How much is TEAK for 3 nights starting Friday?"</li>
                <li><strong>Group booking:</strong> "Book 3 cabins for the Smith party"</li>
                <li><strong>Validate:</strong> "Is coupon SUMMER20 still valid?"</li>
              </ul>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📱</span>
              <span>Common Workflows</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <div class="guide-callout info">
                <strong>🔍 New Guest Enquiry</strong>
                <span>1. "Is COCO available March 15–18?" → 2. "Book it for John Smith, email john@email.com" → 3. Bernard creates booking and offers to send confirmation.</span>
              </div>
              <div class="guide-callout info">
                <strong>✏️ Editing Inventory</strong>
                <span>1. "Show me all extras" → 2. "Update Spa Treatment price to £60" → 3. Done.</span>
              </div>
              <div class="guide-callout info">
                <strong>📋 Reviewing Selections</strong>
                <span>1. "Show selections for GRP-ABC123" → 2. View per-guest meal choices → 3. Mark as completed.</span>
              </div>
            </div>
          </div>

          <div class="guide-accordion">
            <button class="guide-acc-trigger">
              <span class="guide-acc-icon">📱</span>
              <span>Mobile Usage</span>
              <span class="guide-acc-chevron"></span>
            </button>
            <div class="guide-acc-panel">
              <ul class="guide-list">
                <li>Use <strong>☰ menu</strong> for all tabs and booking actions.</li>
                <li>Calendar adapts to mobile with colour-coded availability.</li>
                <li>All modals are mobile-optimised with scrollable content.</li>
                <li><strong>Chat is the fastest way</strong> to manage tasks on mobile.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Wire close
  overlay.querySelector('#guide-close-btn').addEventListener('click', () => overlay.remove());

  // Wire nav tabs
  const navBtns = overlay.querySelectorAll('.guide-nav-btn');
  const sections = overlay.querySelectorAll('.guide-section');

  function navigateTo(sectionName) {
    navBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.section === sectionName);
    });
    sections.forEach(s => s.classList.remove('active'));
    const target = overlay.querySelector(`#guide-${sectionName}`);
    if (target) target.classList.add('active');
    overlay.querySelector('.guide-body').scrollTop = 0;
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  // Wire feature cards → navigate to section
  overlay.querySelectorAll('.guide-feature-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.goto));
  });

  // Wire accordions
  overlay.querySelectorAll('.guide-accordion').forEach(acc => {
    const trigger = acc.querySelector('.guide-acc-trigger');
    const panel = acc.querySelector('.guide-acc-panel');

    // Set initial state
    if (acc.dataset.open === 'true') {
      acc.classList.add('open');
      panel.style.maxHeight = panel.scrollHeight + 'px';
    }

    trigger.addEventListener('click', () => {
      const isOpen = acc.classList.contains('open');
      if (isOpen) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        requestAnimationFrame(() => { panel.style.maxHeight = '0px'; });
        acc.classList.remove('open');
      } else {
        acc.classList.add('open');
        panel.style.maxHeight = panel.scrollHeight + 'px';
        panel.addEventListener('transitionend', function handler() {
          if (acc.classList.contains('open')) panel.style.maxHeight = 'none';
          panel.removeEventListener('transitionend', handler);
        });
      }
    });
  });

  // Escape key to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
