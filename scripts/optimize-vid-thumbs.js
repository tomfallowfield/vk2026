#!/usr/bin/env node
/**
 * Generate WebP version of the hero video thumbnail for smaller payload.
 * Run: node scripts/optimize-vid-thumbs.js
 * Requires: npm install sharp (or run with npx: npx sharp-cli ...)
 *
 * If you don't have sharp, you can generate WebP manually with:
 *   cwebp -q 80 vids/how-to-talk-about-your-business.png -o vids/how-to-talk-about-your-business.webp
 * or use an online converter / Squoosh.
 */

const path = require('path');
const fs = require('fs');

const inputPath = path.join(__dirname, '..', 'vids', 'how-to-talk-about-your-business.png');
const outputPath = path.join(__dirname, '..', 'vids', 'how-to-talk-about-your-business.webp');

if (!fs.existsSync(inputPath)) {
  console.error('Input not found:', inputPath);
  process.exit(1);
}

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('This script requires "sharp". Install with: npm install --save-dev sharp');
    console.error('Alternatively generate WebP manually:');
    console.error('  cwebp -q 80 vids/how-to-talk-about-your-business.png -o vids/how-to-talk-about-your-business.webp');
    process.exit(1);
  }

  const stat = fs.statSync(inputPath);
  console.log('Input PNG size:', (stat.size / 1024).toFixed(1), 'KB');

  await sharp(inputPath)
    .webp({ quality: 82 })
    .toFile(outputPath);

  const outStat = fs.statSync(outputPath);
  console.log('Output WebP size:', (outStat.size / 1024).toFixed(1), 'KB');
  console.log('Saved:', outputPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
