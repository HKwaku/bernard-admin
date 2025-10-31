# 🚀 Quick Start - Bernard Admin

## Step 1: Copy to GitHub (5 minutes)

```bash
# Create a new repository on GitHub (github.com/new)
# Then run these commands:

git init
git add .
git commit -m "Initial commit: Bernard Admin Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bernard-admin.git
git push -u origin main
```

## Step 2: Add Your JavaScript (15-30 minutes)

1. Open your original HTML file
2. Copy everything between `<script>` tags (lines ~800-2300)
3. Open `src/app.js`
4. Paste your code where it says "PASTE YOUR JAVASCRIPT CODE BELOW THIS LINE"
5. Save the file

## Step 3: Test Locally (10 minutes)

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and add your actual API keys

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

## Step 4: Deploy to Vercel (30 minutes)

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OPENAI_API_KEY`
4. Click "Deploy"
5. Done! Your app is live! 🎉

## Need Help?

- Read `START_HERE.md` for detailed instructions
- Check `DEPLOYMENT.md` for full deployment guide
- See `INTEGRATION_GUIDE.js` for code examples

**Total time from zero to deployed: 1-2 hours**
