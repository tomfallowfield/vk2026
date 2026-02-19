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
// Deploy webhook: when set, POST /api/webhooks/deploy requires this secret (X-Deploy-Secret header or ?secret=)
const DEPLOY_WEBHOOK_SECRET = process.env.DEPLOY_WEBHOOK_SECRET || '';

// MySQL (analytics: visitors, events)
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'vk2026_analytics';

// Return-visit notifications (email + Slack + Notion when someone with email comes back)
const NOTIFICATION_EMAIL_TO = process.env.NOTIFICATION_EMAIL_TO || '';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const NOTION_RETURN_VISITS_DATABASE_ID = process.env.NOTION_RETURN_VISITS_DATABASE_ID || '';
// SMTP for return-visit email (e.g. SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER= SMTP_PASS=)
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

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
  BOOKING_WEBHOOK_SECRET,
  DEPLOY_WEBHOOK_SECRET,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  NOTIFICATION_EMAIL_TO,
  SLACK_WEBHOOK_URL,
  NOTION_RETURN_VISITS_DATABASE_ID,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS
};
