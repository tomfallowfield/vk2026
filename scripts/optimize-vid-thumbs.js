#!/usr/bin/env node
/**
 * Optimise the hero video thumbnail: resize to display size (1120×630 for 2x), then output WebP + JPEG.
 * Run: node scripts/optimize-vid-thumbs.js
 * Requires: npm install --save-dev sharp
 *
 * Reads: vids/how-to-talk-about-your-business.jpg (or .png)
 * Writes: same base name .webp and .jpg (overwrites .jpg with resized version).
 */

const path = require('path');
const fs = require('fs');

const VIDS_DIR = path.join(__dirname, '..', 'vids');
const BASE = 'how-to-talk-about-your-business';
const WIDTH = 1120;  // 2× display width (560px)
const HEIGHT = 630;  // 2× display height (315px)
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 85;

function findInput() {
  const jpg = path.join(VIDS_DIR, BASE + '.jpg');
  const png = path.join(VIDS_DIR, BASE + '.png');
  if (fs.existsSync(jpg)) return jpg;
  if (fs.existsSync(png)) return png;
  return null;
}

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('This script requires "sharp". Install with: npm install --save-dev sharp');
    process.exit(1);
  }

  const inputPath = findInput();
  if (!inputPath) {
    console.error('Input not found: ' + BASE + '.jpg or .png in vids/');
    process.exit(1);
  }

  const stat = fs.statSync(inputPath);
  console.log('Input:', inputPath, (stat.size / 1024).toFixed(1), 'KB');

  const pipeline = sharp(inputPath)
    .resize(WIDTH, HEIGHT, { fit: 'inside', withoutEnlargement: true });

  const webpPath = path.join(VIDS_DIR, BASE + '.webp');
  const jpgPath = path.join(VIDS_DIR, BASE + '.jpg');
  const jpgTmp = path.join(VIDS_DIR, BASE + '.tmp.jpg');

  await pipeline
    .clone()
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);
  console.log('WebP:', (fs.statSync(webpPath).size / 1024).toFixed(1), 'KB', webpPath);

  await pipeline
    .clone()
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(jpgPath === inputPath ? jpgTmp : jpgPath);
  if (jpgPath === inputPath) {
    fs.renameSync(jpgTmp, jpgPath);
  }
  console.log('JPEG:', (fs.statSync(jpgPath).size / 1024).toFixed(1), 'KB', jpgPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
