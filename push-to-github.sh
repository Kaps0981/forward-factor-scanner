#!/bin/bash

echo "🚀 Pushing Forward Factor Scanner to GitHub..."

# Configure Git remote with authentication
git remote set-url origin https://Kaps0981:$GITHUB_PERSONAL_ACCESS_TOKEN@github.com/Kaps0981/forward-factor-scanner.git

# Add all files
git add .

# Create commit
git commit -m "Forward Factor Scanner v2.0 - Professional options volatility analysis tool with 100 stock universe, liquidity tracking, position sizing, and quality filters"

# Push to GitHub
git push -u origin main --force

echo "✅ Successfully pushed to GitHub!"
echo "📍 View your code at: https://github.com/Kaps0981/forward-factor-scanner"