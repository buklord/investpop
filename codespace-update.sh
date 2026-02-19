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
echo "   ✅ Code is up to date"
echo ""

# Step 2: Install dependencies if needed
echo "2) Installing dependencies..."
if command -v yarn &> /dev/null; then
  yarn install --frozen-lockfile 2>/dev/null || yarn install
else
  npm install
fi
echo "   ✅ Dependencies installed"
echo ""

# Step 3: Kill any existing Next.js dev server
echo "3) Stopping any existing dev server..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
echo "   ✅ Done"
echo ""

# Step 4: Start the dev server in the background
echo "4) Starting the dev server..."
echo ""
echo "================================================"
echo "  ✅ ALL DONE! Starting yarn dev..."
echo ""
echo "  New pages available:"
echo "  → /dashboard  (now with full 7-link sidebar)"
echo "  → /wallet     (balance + demo funds)"
echo "  → /history    (trade history + P&L)"
echo "  → /settings   (profile + Claim Admin button)"
echo "  → /admin      (after claiming admin)"
echo ""
echo "  To become admin: go to /settings and click"
echo "  'Claim Admin Access'"
echo "================================================"
echo ""

# Start the dev server (this takes over the terminal)
if command -v yarn &> /dev/null; then
  yarn dev
else
  npm run dev
fi
