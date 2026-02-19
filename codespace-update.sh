#!/bin/bash
# codespace-update.sh
# Run this ONCE in your Codespaces terminal to apply all new features.
# Usage: bash codespace-update.sh

set -e

echo ""
echo "================================================"
echo "  PaperTrade - Applying all platform updates"
echo "================================================"
echo ""

# Step 1: Make sure we have the latest code from the feature branch
echo "1) Fetching latest code from GitHub..."
git fetch origin
git checkout copilot/fix-sidebar-and-add-platform-features
git pull origin copilot/fix-sidebar-and-add-platform-features
echo "   OK: Code is up to date"
echo ""

# Step 2: Install dependencies if needed
echo "2) Installing dependencies..."
npm install
echo "   OK: Dependencies installed"
echo ""

# Step 3: Kill any existing Next.js dev server on port 3000
echo "3) Stopping any existing dev server on port 3000..."
kill $(lsof -t -i:3000) 2>/dev/null || true
sleep 2
echo "   OK: Done"
echo ""

# Step 4: Start the dev server
echo "================================================"
echo "  ALL DONE! Starting the dev server..."
echo ""
echo "  New pages:"
echo "  /dashboard  (new 7-link sidebar)"
echo "  /wallet     (balance + demo funds)"
echo "  /history    (trade history + P&L)"
echo "  /settings   (click Claim Admin Access here)"
echo "  /admin      (visible after claiming admin)"
echo "================================================"
echo ""

npm run dev
