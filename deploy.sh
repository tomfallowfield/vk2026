#!/bin/bash

set -e

echo "==== DEPLOY START ===="
date
echo "Deploy PID: $$"

cd /var/www/html/vk2026 || exit 1

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
npm install --production

echo "Restarting app..."
pm2 restart vk2026

echo "Saving pm2 state..."
pm2 save

echo "==== DEPLOY COMPLETE ===="
date
