#!/bin/bash

# Bernard Admin - Quick Setup Script
# This script helps you set up the Bernard Admin Dashboard quickly

echo "🤖 Bernard Admin Dashboard - Setup Script"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOL'
# Supabase Configuration
VITE_SUPABASE_URL=https://pqtedphijayclewljlkq.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI Configuration
VITE_OPENAI_API_KEY=your_openai_api_key_here
EOL
    echo "✅ .env file created"
    echo "⚠️  Please update the .env file with your actual API keys"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "=========================================="
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your API keys"
echo "2. Copy JavaScript from your original HTML to src/app.js"
echo "3. Run 'npm run dev' to start the development server"
echo ""
echo "For detailed instructions, see:"
echo "  - README.md for overview"
echo "  - TODO.md for implementation steps"
echo "  - DEPLOYMENT.md for deployment guide"
echo ""
echo "Happy coding! 🚀"
