require('dotenv').config();

const SITE_BASE_URL = process.env.SITE_BASE_URL || 'http://localhost:3000/vk2026';
const PORT = parseInt(process.env.PORT || '3000', 10);

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://139.59.113.186',
  'https://vanillakiller.com',
  'https://www.vanillakiller.com'
].filter(Boolean);

// Allow same-origin from any path (e.g. http://139.59.113.186/vk2026)
function getAllowedOrigins() {
  const extra = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [];
  return [...new Set([...allowedOrigins, ...extra])];
}

// Mailchimp Marketing API (for lead magnets)
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY || '';
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || ''; // e.g. us19
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID || '';

// Notion
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || 'a554b664bf984c0993b16ab4ac0b2a9d';
/** Optional: page ID for the website wiki (sync via scripts/sync-wiki-to-notion.js) */
const NOTION_WIKI_PAGE_ID = process.env.NOTION_WIKI_PAGE_ID || '';

// Booking-confirmed webhook (optional; if set, route requires matching secret)
const BOOKING_WEBHOOK_SECRET = process.env.BOOKING_WEBHOOK_SECRET || '';

module.exports = {
  SITE_BASE_URL,
  PORT,
  getAllowedOrigins,
  MAILCHIMP_API_KEY,
  MAILCHIMP_SERVER_PREFIX,
  MAILCHIMP_AUDIENCE_ID,
  NOTION_TOKEN,
  NOTION_DATABASE_ID,
  NOTION_WIKI_PAGE_ID,
  BOOKING_WEBHOOK_SECRET
};
