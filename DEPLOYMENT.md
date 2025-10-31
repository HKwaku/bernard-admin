# Bernard Admin - Deployment Guide

## Quick Start Guide for VS Code, GitHub, and Vercel

### Prerequisites Checklist
- [ ] VS Code installed
- [ ] Git installed
- [ ] Node.js 18+ installed
- [ ] GitHub account created
- [ ] Vercel account created
- [ ] Supabase project set up
- [ ] OpenAI API key obtained

---

## Step 1: Set Up Local Project

### 1.1 Open in VS Code
```bash
cd bernard-admin
code .
```

### 1.2 Install Dependencies
Open the integrated terminal in VS Code (`Ctrl+` ` or `Cmd+` `) and run:
```bash
npm install
```

### 1.3 Configure Environment Variables
Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=https://pqtedphijayclewljlkq.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here
VITE_OPENAI_API_KEY=your_openai_key_here
```

**⚠️ Security Note**: For production, you should:
1. Create a new Supabase project (don't use the hardcoded one)
2. Enable Row Level Security (RLS)
3. Add authentication
4. Update the configuration files to use environment variables

### 1.4 Test Locally
```bash
npm run dev
```

Visit `http://localhost:5173` to test the app.

---

## Step 2: Initialize Git Repository

### 2.1 Initialize Git
```bash
git init
git add .
git commit -m "Initial commit: Bernard Admin Dashboard"
```

### 2.2 Create GitHub Repository
1. Go to [GitHub](https://github.com/new)
2. Create a new repository named `bernard-admin`
3. Don't initialize with README (you already have one)

### 2.3 Connect and Push
```bash
git remote add origin https://github.com/YOUR_USERNAME/bernard-admin.git
git branch -M main
git push -u origin main
```

---

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Select your `bernard-admin` repository
5. Click "Import"

### 3.2 Configure Build Settings

Vercel should auto-detect Vite, but verify:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3.3 Add Environment Variables

In the Vercel project settings:

1. Go to "Settings" → "Environment Variables"
2. Add these variables:
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your_anon_key
   VITE_OPENAI_API_KEY = sk-proj-your_key
   ```
3. Make sure they're available for "Production", "Preview", and "Development"

### 3.4 Deploy

1. Click "Deploy"
2. Wait for the build to complete (usually 1-2 minutes)
3. Your app will be live at: `https://bernard-admin.vercel.app` (or your custom domain)

---

## Step 4: Set Up Supabase Database

### 4.1 Create Tables

Run these SQL queries in your Supabase SQL Editor:

```sql
-- Room Types Table
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price_per_night_weekday NUMERIC NOT NULL,
  base_price_per_night_weekend NUMERIC NOT NULL,
  max_adults INTEGER NOT NULL DEFAULT 2,
  currency TEXT NOT NULL DEFAULT 'GBP',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reservations Table
CREATE TABLE reservations (
  confirmation_code TEXT PRIMARY KEY,
  guest_first_name TEXT NOT NULL,
  guest_last_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER NOT NULL,
  adults INTEGER NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  room_type_code TEXT,
  room_name TEXT,
  room_subtotal NUMERIC NOT NULL,
  extras_total NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT DEFAULT 'unpaid',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extras Table
CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupons Table
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'both',
  valid_until DATE,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  min_booking_amount NUMERIC DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Packages Table
CREATE TABLE packages (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  package_price NUMERIC NOT NULL,
  nights INTEGER NOT NULL,
  room_type_id UUID REFERENCES room_types(id),
  currency TEXT NOT NULL DEFAULT 'GBP',
  image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blocked Dates Table
CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_type_id UUID REFERENCES room_types(id),
  blocked_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_reservations_check_in ON reservations(check_in);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_guest_name ON reservations(guest_first_name, guest_last_name);
CREATE INDEX idx_blocked_dates_room_date ON blocked_dates(room_type_id, blocked_date);
```

### 4.2 Enable Row Level Security (RLS)

For production, enable RLS on all tables:

```sql
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Create policies (example for authenticated users)
-- You'll want to customize these based on your auth setup
CREATE POLICY "Allow authenticated users full access to room_types"
  ON room_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Repeat for other tables...
```

### 4.3 Insert Sample Data

```sql
-- Sample room type
INSERT INTO room_types (code, name, description, base_price_per_night_weekday, base_price_per_night_weekend, max_adults, currency)
VALUES ('COZY', 'Cozy Cabin', 'A comfortable cabin perfect for couples', 150.00, 200.00, 2, 'GBP');
```

---

## Step 5: Configure Custom Domain (Optional)

### 5.1 In Vercel
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### 5.2 Update DNS
Add the records provided by Vercel to your domain registrar.

---

## Step 6: Continuous Deployment

Once set up, every push to the `main` branch automatically deploys to Vercel:

```bash
# Make changes
git add .
git commit -m "Update: description of changes"
git push origin main
# Vercel automatically deploys!
```

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Verify environment variables are set correctly

### App Doesn't Load
- Check browser console for errors
- Verify Supabase URL and keys are correct
- Check Supabase table structure matches schema

### API Errors
- Verify OpenAI API key is valid and has credits
- Check Supabase RLS policies if enabled
- Ensure CORS is configured in Supabase

---

## Monitoring and Maintenance

### Vercel Analytics
Enable analytics in Vercel dashboard to track:
- Page views
- Performance metrics
- Error rates

### Supabase Monitoring
Check Supabase dashboard for:
- Database usage
- API requests
- Query performance

### OpenAI Usage
Monitor API usage at [OpenAI Dashboard](https://platform.openai.com/usage)

---

## Security Checklist for Production

- [ ] Enable RLS on all Supabase tables
- [ ] Implement authentication (Supabase Auth)
- [ ] Rotate API keys regularly
- [ ] Use environment variables (never commit secrets)
- [ ] Enable HTTPS only
- [ ] Add rate limiting
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Regular database backups
- [ ] Monitor API usage and costs

---

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vite Docs**: https://vitejs.dev/guide/

---

## Next Steps

1. ✅ Deploy basic version
2. 🔐 Add authentication
3. 👥 Create admin roles/permissions  
4. 📧 Add email notifications
5. 📊 Enhanced analytics
6. 🎨 Custom branding
7. 🌍 Multi-language support
8. 📱 Native mobile app

---

**Congratulations!** Your Bernard Admin Dashboard is now live! 🎉
