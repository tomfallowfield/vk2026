#!/bin/bash

set -e

echo "==== DEPLOY START ===="
date
echo "Deploy PID: $$"

# Run from the directory containing this script (works wherever the repo is cloned)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "Resetting local changes..."
git reset --hard HEAD
git clean -fd

echo "Fetching latest code..."
git fetch origin

echo "Checking out main..."
git checkout main

echo "Updating to origin/main..."
git reset --hard origin/main

echo "Installing dependencies..."
npm install --omit=dev

echo "Syncing wiki to Notion..."
node scripts/sync-wiki-to-notion.js || true

echo "Restarting app..."
if pm2 describe vk2026 &>/dev/null; then
  pm2 restart vk2026
else
  echo "vk2026 not in pm2; starting..."
  pm2 start server.js --name vk2026
fi

echo "Saving pm2 state..."
pm2 save

echo "==== DEPLOY COMPLETE ===="
date
