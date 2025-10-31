# Bernard Admin - Quick Reference

## 📁 Project Structure
```
bernard-admin/
├── index.html              # Entry point
├── package.json            # Dependencies
├── .env                    # Environment variables (create this!)
├── .gitignore             # Git ignore rules
├── vercel.json            # Vercel config
├── setup.sh               # Quick setup script
├── README.md              # Full documentation
├── DEPLOYMENT.md          # Deployment guide
├── TODO.md                # Implementation checklist
└── src/
    ├── main.js            # App entry point
    ├── styles.css         # Global styles
    ├── config/
    │   ├── supabase.js    # Database client
    │   └── openai.js      # AI client
    └── utils/
        └── helpers.js     # Utility functions
```

## 🚀 Common Commands

```bash
# Setup
./setup.sh              # Run quick setup
npm install             # Install dependencies

# Development
npm run dev             # Start dev server (http://localhost:5173)
npm run build           # Build for production
npm run preview         # Preview production build

# Git
git init                # Initialize repository
git add .               # Stage all changes
git commit -m "msg"     # Commit changes
git push origin main    # Push to GitHub

# Vercel CLI (optional)
npm i -g vercel         # Install Vercel CLI
vercel                  # Deploy to Vercel
vercel --prod           # Deploy to production
```

## 🔑 Environment Variables

Create `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_OPENAI_API_KEY=sk-proj-your_key_here
```

## 📋 Implementation Checklist

- [ ] Run `./setup.sh` or `npm install`
- [ ] Create `.env` with your API keys
- [ ] Extract JavaScript from original HTML
- [ ] Put JavaScript in `src/app.js`
- [ ] Update `src/main.js` to import app.js
- [ ] Test locally with `npm run dev`
- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Connect to Vercel
- [ ] Add environment variables in Vercel
- [ ] Deploy!

## 🗄️ Database Setup

Run this in Supabase SQL Editor:

```sql
-- See DEPLOYMENT.md for full schema
-- Quick start: room_types table
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_price_per_night_weekday NUMERIC NOT NULL,
  base_price_per_night_weekend NUMERIC NOT NULL,
  max_adults INTEGER NOT NULL DEFAULT 2,
  currency TEXT NOT NULL DEFAULT 'GBP',
  is_active BOOLEAN DEFAULT true
);
```

## 🤖 Bernard Chat Commands

```
"Search for John"
"Cancel booking BK123456"
"Block COZY from 2025-11-01 to 2025-11-05"
"Show today's check-ins"
"Mark payment BK123456 as paid"
"Add extra 'Hot Tub' for £50"
"Show room availability"
"Update status BK123456 to checked in"
```

## 🐛 Troubleshooting

**Build fails**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Port already in use**
```bash
# Kill process on port 5173
npx kill-port 5173
npm run dev
```

**Supabase connection error**
- Check URL and key in `.env`
- Verify Supabase project is active
- Check network tab in browser DevTools

**OpenAI API error**
- Verify API key is correct
- Check you have credits
- Look for rate limiting errors

## 📱 Mobile Testing

```bash
# Get your local IP
ipconfig getifaddress en0  # Mac
ip addr show               # Linux

# Access from phone on same network
http://YOUR_IP:5173
```

## 🔒 Security Checklist

Before going live:
- [ ] Enable RLS on all Supabase tables
- [ ] Add authentication
- [ ] Use environment variables
- [ ] Rotate API keys
- [ ] Enable HTTPS
- [ ] Add rate limiting
- [ ] Set up monitoring

## 📚 Documentation Links

- **Vite**: https://vitejs.dev/guide/
- **Supabase**: https://supabase.com/docs
- **OpenAI**: https://platform.openai.com/docs
- **Vercel**: https://vercel.com/docs

## 🆘 Getting Help

1. Check browser console (F12)
2. Review error in Vercel build logs
3. Check Supabase logs
4. Verify environment variables
5. Test API keys separately

## ⚡ Quick Deploy

```bash
# One-liner to deploy (after initial setup)
git add . && git commit -m "Update" && git push
# Vercel auto-deploys!
```

---

**Pro Tip**: Keep this file open while developing for quick reference!
