#!/usr/bin/env node
/**
 * Copy cms-schema into cms/src/ after create-strapi-app has been run.
 * Run: node scripts/copy-cms-schema.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schemaDir = path.join(root, 'cms-schema');
const destDir = path.join(root, 'cms', 'src');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('  copied', path.relative(root, dest));
  }
}

if (!fs.existsSync(path.join(root, 'cms'))) {
  console.error('Error: cms/ folder not found. Run create-strapi-app first:');
  console.error('  npx create-strapi-app@latest cms --quickstart');
  console.error('See docs/STRAPI-SETUP.md for Node 20+ requirement.');
  process.exit(1);
}

if (!fs.existsSync(schemaDir)) {
  console.error('Error: cms-schema/ folder not found.');
  process.exit(1);
}

console.log('Copying cms-schema into cms/src/...');
copyRecursive(path.join(schemaDir, 'components'), path.join(destDir, 'components'));
copyRecursive(path.join(schemaDir, 'api'), path.join(destDir, 'api'));
console.log('Done. Restart Strapi (cd cms && npm run develop) to load the schema.');
