#!/usr/bin/env node
/**
 * Copy API routes, controllers, and services from cms/src to cms/dist.
 * Strapi 5 TS compilation does not copy .js files; run this after strapi build.
 *
 * Run: node scripts/copy-api-to-dist.js
 */

const fs = require('fs');
const path = require('path');

const cmsRoot = path.resolve(__dirname, '..', 'cms');
const srcApi = path.join(cmsRoot, 'src', 'api');
const distApi = path.join(cmsRoot, 'dist', 'src', 'api');

if (!fs.existsSync(srcApi)) {
  console.error('Error: cms/src/api not found.');
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else if (src.endsWith('.js')) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('  copied', path.relative(cmsRoot, dest));
  }
}

// Copy routes, controllers, services (only .js files)
for (const apiName of fs.readdirSync(srcApi)) {
  const apiPath = path.join(srcApi, apiName);
  if (!fs.statSync(apiPath).isDirectory()) continue;
  for (const sub of ['routes', 'controllers', 'services']) {
    const subSrc = path.join(apiPath, sub);
    if (fs.existsSync(subSrc)) {
      copyRecursive(subSrc, path.join(distApi, apiName, sub));
    }
  }
}

console.log('Done. API .js files copied to dist.');
