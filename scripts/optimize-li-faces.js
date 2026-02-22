#!/usr/bin/env node
/**
 * Resize LinkedIn face images to small thumbnails for the hero avatar stack (32–36px display).
 * Reads from images/li_mugs/, writes to images/li_mugs/thumbs/ (64×64 cover, JPEG ~80%).
 * Run after adding or replacing faces: npm run optimize-li-faces
 * Requires: sharp (devDependency).
 */

const path = require('path');
const fs = require('fs');

const LI_MUGS = path.join(__dirname, '..', 'images', 'li_mugs');
const THUMBS_DIR = path.join(LI_MUGS, 'thumbs');
const SIZE = 64;
const JPEG_QUALITY = 82;
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;

if (!fs.existsSync(LI_MUGS)) {
  console.error('Directory not found:', LI_MUGS);
  console.error('Create it and add your LinkedIn face images (e.g. arthur jones.jpg), then run this script.');
  process.exit(1);
}

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('This script requires "sharp". Install with: npm install --save-dev sharp');
    process.exit(1);
  }

  if (!fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
    console.log('Created', THUMBS_DIR);
  }

  const files = fs.readdirSync(LI_MUGS).filter((f) => EXTENSIONS.test(f) && !f.startsWith('.'));
  if (files.length === 0) {
    console.log('No images found in', LI_MUGS);
    process.exit(0);
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const file of files) {
    const src = path.join(LI_MUGS, file);
    const outName = file.replace(/\.(png|webp)$/i, '.jpg');
    const dest = path.join(THUMBS_DIR, outName);

    try {
      const stat = fs.statSync(src);
      totalIn += stat.size;

      await sharp(src)
        .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(dest);

      const outStat = fs.statSync(dest);
      totalOut += outStat.size;
      console.log(
        file.padEnd(28),
        (stat.size / 1024).toFixed(1).padStart(6),
        'KB ->',
        (outStat.size / 1024).toFixed(1).padStart(5),
        'KB',
        dest
      );
    } catch (err) {
      console.error('Error processing', file, err.message);
    }
  }

  console.log('---');
  console.log('Total:', (totalIn / 1024).toFixed(1), 'KB ->', (totalOut / 1024).toFixed(1), 'KB');
  console.log('Thumbs written to', THUMBS_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
