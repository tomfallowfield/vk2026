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

echo "Pulling latest..."
git pull origin main

echo "Installing dependencies..."
npm install --omit=dev

echo "Syncing wiki to Notion..."
node scripts/sync-wiki-to-notion.js || true

echo "Restarting app..."
pm2 restart vk2026

echo "Saving pm2 state..."
pm2 save

echo "==== DEPLOY COMPLETE ===="
date
