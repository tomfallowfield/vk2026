#!/usr/bin/env node
/**
 * Optimise the Matthew Creed hero testimonial avatar (56px display, 2x = 112px).
 * Run: node scripts/optimize-creed-img.js
 * Requires: npm install --save-dev sharp
 *
 * Reads: images/testimonial_mugs/matthew.jpg
 * Writes: matthew.webp, matthew.jpg (resized 112×112 cover, overwrites .jpg).
 * Backup the original matthew.jpg first if you need to keep it.
 */

const path = require('path');
const fs = require('fs');

const MUGS_DIR = path.join(__dirname, '..', 'images', 'testimonial_mugs');
const INPUT = path.join(MUGS_DIR, 'matthew.jpg');
const SIZE = 112;  // 56px × 2 for retina
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 85;

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('This script requires "sharp". Install with: npm install --save-dev sharp');
    process.exit(1);
  }

  if (!fs.existsSync(INPUT)) {
    console.error('Input not found:', INPUT);
    process.exit(1);
  }

  const stat = fs.statSync(INPUT);
  console.log('Input:', INPUT, (stat.size / 1024).toFixed(1), 'KB');

  const pipeline = sharp(INPUT)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' });

  const webpPath = path.join(MUGS_DIR, 'matthew.webp');
  const jpgPath = path.join(MUGS_DIR, 'matthew.jpg');
  const jpgTmp = path.join(MUGS_DIR, 'matthew.tmp.jpg');

  await pipeline
    .clone()
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);
  console.log('WebP:', (fs.statSync(webpPath).size / 1024).toFixed(1), 'KB', webpPath);

  await pipeline
    .clone()
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(jpgTmp);
  fs.renameSync(jpgTmp, jpgPath);
  console.log('JPEG:', (fs.statSync(jpgPath).size / 1024).toFixed(1), 'KB', jpgPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
