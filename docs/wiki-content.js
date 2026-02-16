/**
 * Website wiki content – single source of truth for the Notion wiki.
 * Run: node scripts/sync-wiki-to-notion.js
 * to push this content to your Notion wiki page.
 */

function rt(text) {
  return { type: 'paragraph', text: text || '' };
}
function h1(text) {
  return { type: 'heading_1', text: text || '' };
}
function h2(text) {
  return { type: 'heading_2', text: text || '' };
}
function h3(text) {
  return { type: 'heading_3', text: text || '' };
}
function ul(text) {
  return { type: 'bulleted_list_item', text: text || '' };
}
function code(text, lang = 'plain text') {
  return { type: 'code', text: text || '', language: lang };
}
function div() {
  return { type: 'divider' };
}

module.exports = [
  h1('VK Website (vk2026) – Documentation Wiki'),
  rt('This wiki is synced from the repo. To update: edit docs/wiki-content.js and run node scripts/sync-wiki-to-notion.js'),
  div(),

  h2('Overview'),
  rt('Vanilla Killer marketing site: single-page site with hero, pricing, testimonials, forms (book a call, website review, lead magnets), modals, and mobile menu. Served by Express; forms post to the same server and sync to Mailchimp and Notion VKCRM.'),
  h3('Tech stack'),
  ul('Frontend: static HTML/CSS/JS (index.html, styles.css, main.js). No framework.'),
  ul('Config: settings.js (window.SITE_SETTINGS) loaded before main.js.'),
  ul('Server: Node + Express (server.js). Static files under /vk2026, API under /vk2026/api.'),
  ul('Integrations: Mailchimp (contacts + tags), Notion (VKCRM database for enquiries).'),
  div(),

  h2('Environment (.env)'),
  rt('Copy .env.example to .env. Required for forms and integrations:'),
  ul('SITE_BASE_URL – e.g. https://vanillakiller.com or http://localhost:3000/vk2026'),
  ul('PORT – server port (e.g. 3000)'),
  ul('MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID – for contact + lead-magnet forms'),
  ul('NOTION_TOKEN, NOTION_DATABASE_ID – for VKCRM (book-a-call, website-review rows)'),
  ul('NOTION_WIKI_PAGE_ID – optional; for syncing this wiki to a Notion page (see scripts/sync-wiki-to-notion.js)'),
  ul('BOOKING_WEBHOOK_SECRET – optional; for booking-confirmed webhook auth'),
  div(),

  h2('Settings (settings.js)'),
  rt('window.SITE_SETTINGS controls behaviour without touching main.js:'),
  ul('autodialog_form_to_show, autodialog_to_be_shown_on_exit_intent, autodialog_to_be_shown_after_delay_s – auto popup'),
  ul('wrv_offer, book_call_offer, lead_magnets_enabled – which CTAs/forms are on'),
  ul('book_call_calendar_url – link in book-a-call modal'),
  ul('lead_magnets – per-form enabled, success_message, mailchimp_tag (for automations)'),
  ul('show_pricing, show_email, cookie_consent_enabled, cta_primary_black, rescue_section_show_videos – UI toggles'),
  ul('ga_id – Google Analytics'),
  ul('maintenance_mode, maintenance_message – overlay when down'),
  ul('default_modal – which modal opens for ?modal= in URL'),
  ul('linkedin_faces – hero avatar stack (name, role, photo filename in images/li_mugs/)'),
  div(),

  h2('Forms & API'),
  rt('All forms POST to /vk2026/api. Endpoints:'),
  ul('/api/book-a-call – name, email, website, linkedin_url, company, phone, message. Syncs to Notion VKCRM + Mailchimp (tag: submitted website contact form).'),
  ul('/api/website-review – same as WRV; same Notion + Mailchimp behaviour.'),
  ul('/api/lead – lead magnets (form_id, email, etc.). Mailchimp only; tags from settings.js lead_magnets[].mailchimp_tag.'),
  rt('Submissions are logged to logs/submissions.log (NDJSON). Rate limit: 10 requests/min per IP on /vk2026/api.'),
  div(),

  h2('Notion VKCRM'),
  rt('server/lib/notion-vkcrm.js: creates or updates rows in the Notion database (NOTION_DATABASE_ID). Matches by website URL, then LinkedIn URL, then WRV title. Status: WRV Requested / Incoming Web Enquiry. General notes block includes session timeline (visits, button clicks, video progress).'),
  rt('Property names and structure must match your Notion database; edit notion-vkcrm.js if your schema differs.'),
  div(),

  h2('Deployment'),
  rt('deploy.sh (e.g. on server): git pull, npm install --production, pm2 restart vk2026. Static site is served from the same app; ensure SITE_BASE_URL and CORS (server/config.js) match your domain.'),
  div(),

  h2('Key files'),
  ul('index.html – page structure, sections, modals, mobile menu'),
  ul('main.js – modals, forms, nav smooth scroll, header hide-on-scroll, cookie consent, video tracking'),
  ul('styles.css – layout and components'),
  ul('server.js – Express app, static + API routes'),
  ul('server/routes/submissions.js – form handlers, Mailchimp + Notion'),
  ul('server/lib/notion-vkcrm.js – VKCRM create/update logic'),
  ul('server/lib/mailchimp.js – add/update contact, tags'),
  ul('README-API.md – form API and env setup'),
  div(),

  rt('Last synced from repo. For edits, update docs/wiki-content.js and run the sync script.'),
];
