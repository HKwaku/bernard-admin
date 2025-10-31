# ✅ Bernard Admin - Complete Setup Checklist

## Pre-Deployment Checklist

### 🔧 Initial Setup
- [ ] Download/clone this project folder
- [ ] Open folder in VS Code
- [ ] Run `./setup.sh` (or `npm install`)
- [ ] Create `.env` file with your API keys

### 📝 Code Migration
- [ ] Open your original HTML file
- [ ] Copy ALL JavaScript from `<script>` tags
- [ ] Create `src/app.js`
- [ ] Paste JavaScript into `src/app.js`
- [ ] Add necessary imports to top of file:
  ```javascript
  import { supabase } from './config/supabase.js';
  import { callOpenAI } from './config/openai.js';
  import { $ } from './utils/helpers.js';
  ```
- [ ] Export main initialization function
- [ ] Update `src/main.js` to import and call your init function

### 🧪 Local Testing
- [ ] Run `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Test chat functionality
- [ ] Test reservation management
- [ ] Test room management
- [ ] Test all CRUD operations
- [ ] Check mobile responsiveness
- [ ] Verify no console errors

### 🗄️ Database Setup
- [ ] Log into Supabase dashboard
- [ ] Navigate to SQL Editor
- [ ] Run SQL from DEPLOYMENT.md Section 4.1
- [ ] Verify all 6 tables created:
  - [ ] room_types
  - [ ] reservations
  - [ ] extras
  - [ ] coupons
  - [ ] packages
  - [ ] blocked_dates
- [ ] Add sample data for testing
- [ ] Test database connection from app

### 🔐 Environment Variables
- [ ] Create `.env` file locally
- [ ] Add `VITE_SUPABASE_URL`
- [ ] Add `VITE_SUPABASE_ANON_KEY`
- [ ] Add `VITE_OPENAI_API_KEY`
- [ ] Update `src/config/supabase.js` to use env vars
- [ ] Update `src/config/openai.js` to use env vars
- [ ] Test that app works with env vars

### 📦 Git Repository
- [ ] Run `git init`
- [ ] Verify `.gitignore` is present
- [ ] Run `git add .`
- [ ] Run `git commit -m "Initial commit"`
- [ ] Create new GitHub repository
- [ ] Copy repository URL
- [ ] Run `git remote add origin <URL>`
- [ ] Run `git push -u origin main`
- [ ] Verify code is on GitHub

### 🚀 Vercel Deployment
- [ ] Go to vercel.com/dashboard
- [ ] Click "New Project"
- [ ] Import GitHub repository
- [ ] Verify build settings:
  - [ ] Framework: Vite
  - [ ] Build Command: `npm run build`
  - [ ] Output Directory: `dist`
- [ ] Add Environment Variables in Vercel:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_OPENAI_API_KEY
- [ ] Click "Deploy"
- [ ] Wait for deployment to complete
- [ ] Visit your live URL
- [ ] Test all functionality on production

### ✨ Post-Deployment Testing
- [ ] Test on desktop browser
- [ ] Test on mobile device
- [ ] Test all chat commands
- [ ] Create a test booking
- [ ] Edit a booking
- [ ] Cancel a booking
- [ ] Add a room type
- [ ] Add an extra
- [ ] Create a coupon
- [ ] Create a package
- [ ] Check stats are updating
- [ ] Test calendar view
- [ ] Test search functionality

## Security Checklist (Before Going Live)

### 🔒 Supabase Security
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create admin-only policies
- [ ] Set up authentication (Supabase Auth)
- [ ] Create user roles (admin, staff, etc.)
- [ ] Test that unauthenticated users can't access data
- [ ] Rotate your anon key if it was exposed

### 🔑 API Keys
- [ ] Verify API keys are in environment variables
- [ ] Confirm API keys are NOT in code
- [ ] Rotate OpenAI API key if exposed
- [ ] Set up API key rotation schedule
- [ ] Monitor API usage limits

### 🛡️ General Security
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set up CORS properly in Supabase
- [ ] Add rate limiting for API calls
- [ ] Set up error tracking (optional: Sentry)
- [ ] Configure content security policy
- [ ] Add input validation on all forms

## Optional Enhancements

### 🎨 Customization
- [ ] Update logo and branding
- [ ] Change color scheme if desired
- [ ] Add custom domain
- [ ] Add favicon
- [ ] Customize email templates

### 📊 Monitoring
- [ ] Set up Vercel Analytics
- [ ] Configure Supabase monitoring
- [ ] Set up error alerts
- [ ] Monitor OpenAI usage/costs
- [ ] Set up uptime monitoring

### 🔔 Features
- [ ] Email notifications for bookings
- [ ] SMS confirmations
- [ ] PDF invoice generation
- [ ] Export data functionality
- [ ] Advanced reporting
- [ ] Multi-user support
- [ ] Activity logs

## Troubleshooting Checklist

### Build Fails
- [ ] Check Vercel build logs
- [ ] Verify all imports are correct
- [ ] Confirm package.json has all dependencies
- [ ] Check for syntax errors
- [ ] Verify environment variables are set

### App Doesn't Load
- [ ] Check browser console
- [ ] Verify network requests
- [ ] Check Supabase connection
- [ ] Verify OpenAI API key
- [ ] Test with dev tools open

### Features Don't Work
- [ ] Check for JavaScript errors
- [ ] Verify database tables exist
- [ ] Check Supabase policies
- [ ] Test API keys
- [ ] Review network tab for failed requests

## Documentation Checklist

- [ ] Read README.md
- [ ] Review DEPLOYMENT.md
- [ ] Check QUICKSTART.md
- [ ] Review TODO.md
- [ ] Read PROJECT_SUMMARY.md
- [ ] Review INTEGRATION_GUIDE.js

## Final Launch Checklist

### Before Public Launch
- [ ] All features tested and working
- [ ] Security measures in place
- [ ] Authentication implemented
- [ ] Error handling tested
- [ ] Mobile experience verified
- [ ] Performance optimized
- [ ] Backup procedures established
- [ ] Support email/system set up

### Communication
- [ ] Notify team of launch
- [ ] Share login credentials securely
- [ ] Document any known issues
- [ ] Create user guide if needed
- [ ] Set up support channels

### Monitoring
- [ ] Verify analytics are tracking
- [ ] Check error rates
- [ ] Monitor API usage
- [ ] Watch database performance
- [ ] Review user feedback

## Maintenance Schedule

### Daily
- [ ] Check error logs
- [ ] Monitor API usage
- [ ] Review new bookings

### Weekly
- [ ] Database backup verification
- [ ] Performance review
- [ ] User feedback review

### Monthly
- [ ] Security audit
- [ ] API key rotation
- [ ] Feature requests review
- [ ] Analytics review

## Success Metrics

Track these to measure success:
- [ ] Zero build failures
- [ ] <1% error rate
- [ ] <2s page load time
- [ ] 100% mobile compatibility
- [ ] All core features working
- [ ] Positive user feedback

---

## 🎉 Completion

Once all items are checked:
1. Celebrate! 🎉
2. Share with your team
3. Start using it for real bookings
4. Gather feedback
5. Iterate and improve

**Remember**: This is a living checklist. Update it as you learn what works best for your team!

---

**Questions or issues?** Review the documentation files:
- QUICKSTART.md for quick help
- TROUBLESHOOTING section in README.md
- DEPLOYMENT.md for deployment issues
