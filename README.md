# Bernard Admin Dashboard

A modern, responsive admin dashboard for Sojourn Cabins reservations management, powered by AI assistance.

## Features

- 🤖 AI-powered chat assistant (Bernard) using OpenAI
- 📅 Comprehensive reservations management
- 🏠 Room types configuration
- ✨ Extras and add-ons management
- 🎟️ Coupon system
- 📦 Package deals
- 📱 Fully responsive mobile design
- 📊 Real-time statistics

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Build Tool**: Vite
- **Database**: Supabase
- **AI**: OpenAI GPT-4
- **Styling**: Pure CSS with modern features
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- OpenAI API key
- Vercel account (for deployment)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/bernard-admin.git
cd bernard-admin
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

**Note**: You'll need to update `src/config/supabase.js` and `src/config/openai.js` to use these environment variables instead of hardcoded values for production.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
bernard-admin/
├── index.html              # Entry HTML file
├── package.json            # Dependencies
├── vite.config.js          # Vite configuration (optional)
├── vercel.json            # Vercel deployment config
├── .gitignore             # Git ignore rules
├── README.md              # This file
└── src/
    ├── main.js            # Main application entry
    ├── styles.css         # Global styles
    ├── config/
    │   ├── supabase.js    # Supabase client
    │   └── openai.js      # OpenAI configuration
    ├── utils/
    │   └── helpers.js     # Utility functions
    ├── components/
    │   ├── ui.js          # UI rendering
    │   ├── chat.js        # Chat functionality
    │   ├── reservations.js # Reservations management
    │   ├── rooms.js       # Room types management
    │   ├── extras.js      # Extras management
    │   ├── coupons.js     # Coupons management
    │   └── packages.js    # Packages management
    └── services/
        └── stats.js       # Statistics service
```

## Database Schema

### Required Supabase Tables

1. **reservations**
   - confirmation_code (text, primary key)
   - guest_first_name (text)
   - guest_last_name (text)
   - guest_email (text)
   - guest_phone (text)
   - check_in (date)
   - check_out (date)
   - nights (integer)
   - adults (integer)
   - room_type_id (uuid)
   - room_type_code (text)
   - room_name (text)
   - room_subtotal (numeric)
   - extras_total (numeric)
   - total (numeric)
   - currency (text)
   - status (text)
   - payment_status (text)
   - created_at (timestamp)

2. **room_types**
   - id (uuid, primary key)
   - code (text, unique)
   - name (text)
   - description (text)
   - base_price_per_night_weekday (numeric)
   - base_price_per_night_weekend (numeric)
   - max_adults (integer)
   - currency (text)
   - image_url (text)
   - is_active (boolean)

3. **extras**
   - id (uuid, primary key)
   - code (text, unique)
   - name (text)
   - description (text)
   - price (numeric)
   - category (text)
   - is_active (boolean)

4. **coupons**
   - id (uuid, primary key)
   - code (text, unique)
   - description (text)
   - discount_type (text)
   - discount_value (numeric)
   - applies_to (text)
   - valid_until (date)
   - max_uses (integer)
   - current_uses (integer)
   - min_booking_amount (numeric)
   - currency (text)
   - is_active (boolean)
   - created_at (timestamp)

5. **packages**
   - code (text, primary key)
   - name (text)
   - description (text)
   - package_price (numeric)
   - nights (integer)
   - room_type_id (uuid)
   - currency (text)
   - image_url (text)
   - is_featured (boolean)
   - is_active (boolean)
   - created_at (timestamp)

6. **blocked_dates**
   - id (uuid, primary key)
   - room_type_id (uuid)
   - blocked_date (date)
   - reason (text)

## Deployment

### Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite configuration

3. **Configure Environment Variables**:
   - In Vercel project settings, add:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_OPENAI_API_KEY`

4. **Deploy**:
   - Click "Deploy"
   - Your app will be live at `https://your-project.vercel.app`

### Manual Deployment

```bash
npm run build
# Upload the 'dist' folder to your hosting provider
```

## Features Guide

### Chat Assistant (Bernard)

Bernard can help you with:
- Search bookings by name or confirmation code
- Cancel reservations
- Block dates for maintenance
- View today's check-ins
- Add extras
- Edit room prices
- Manage coupons and packages
- Natural language queries

**Example commands**:
- "Search for John"
- "Cancel booking BK123456"
- "Block COZY from 2025-11-01 to 2025-11-05"
- "Show today's check-ins"
- "Mark payment BK123456 as paid"

### Reservations Management

- View all reservations in list or calendar view
- Filter by month/year
- Search by guest name, email, or confirmation code
- Edit reservation details
- Update payment status
- Cancel bookings

### Room Types

- Add new room types
- Set weekday/weekend pricing
- Upload room images
- Activate/deactivate rooms
- Edit room details

### Extras & Add-ons

- Create extras (hot tub, breakfast, etc.)
- Set pricing
- Categorize extras
- Toggle availability

### Coupons

- Create percentage or fixed amount discounts
- Set validity periods
- Limit usage
- Apply to rooms, extras, or both
- Set minimum booking amounts

### Packages

- Bundle rooms with specific night counts
- Feature packages
- Set package pricing
- Link to room types

## Security Considerations

⚠️ **Important**: Before deploying to production:

1. **Move API keys to environment variables**
2. **Enable Row Level Security (RLS)** in Supabase
3. **Create admin-only policies** for tables
4. **Implement authentication** (Supabase Auth recommended)
5. **Add rate limiting** for API calls
6. **Use HTTPS only**

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues and questions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

## Acknowledgments

- Built for Sojourn Cabins, Ghana
- Powered by Supabase and OpenAI
- Designed with mobile-first approach

---

Made with ❤️ for hospitality management
