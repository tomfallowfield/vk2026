/**
 * Website wiki content – legacy structure (used by sync script).
 * The Notion wiki is now maintained via prompts: see docs/WIKI-PROMPT.md for
 * version, date, and the full Notion AI prompt (sync script is deprecated).
 * Exports: { rootBlocks, pages }.
 * Run: node scripts/sync-wiki-to-notion.js (not recommended – use WIKI-PROMPT.md).
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

/** Blocks shown on the root wiki page */
const rootBlocks = [
  h1('VK Website (vk2026) – Documentation Wiki'),
  rt('This wiki is synced from the repo. To update: edit docs/wiki-content.js and run node scripts/sync-wiki-to-notion.js (or run deploy).'),
  rt('Sync is add-only: existing content in Notion is never overwritten. New sections and empty pages get filled from the repo. To reset from repo, run with --force.'),
  rt('Use the subpages in the sidebar (or below) for each section.'),
];

/** Child pages: each { title, blocks } */
const pages = [
  {
    title: 'Overview',
    blocks: [
      rt('Vanilla Killer marketing site: single-page site with hero, pricing, testimonials, forms (book a call, website review, lead magnets), modals, and mobile menu. Served by Express; forms post to the same server and sync to Mailchimp and Notion VKCRM.'),
      h2('Tech stack'),
      ul('Frontend: static HTML/CSS/JS (index.html, styles.css, main.js). No framework.'),
      ul('Config: settings.js (window.SITE_SETTINGS) loaded before main.js.'),
      ul('Server: Node + Express (server.js). Static files under /vk2026, API under /vk2026/api.'),
      ul('Integrations: Mailchimp (contacts + tags), Notion (VKCRM database for enquiries).'),
    ],
  },
  {
    title: 'Environment',
    blocks: [
      rt('Copy .env.example to .env. Required for forms and integrations:'),
      ul('SITE_BASE_URL – e.g. https://vanillakiller.com or http://localhost:3000/vk2026'),
      ul('PORT – server port (e.g. 3000)'),
      ul('MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID – for contact + lead-magnet forms'),
      ul('NOTION_TOKEN, NOTION_DATABASE_ID – for VKCRM (book-a-call, website-review rows)'),
      ul('NOTION_WIKI_PAGE_ID – optional; for syncing this wiki (scripts/sync-wiki-to-notion.js)'),
      ul('BOOKING_WEBHOOK_SECRET – optional; for booking-confirmed webhook auth'),
    ],
  },
  {
    title: 'Settings',
    blocks: [
      rt('window.SITE_SETTINGS (settings.js) controls behaviour without touching main.js:'),
      ul('autodialog_form_to_show, autodialog_to_be_shown_on_exit_intent, autodialog_to_be_shown_after_delay_s – auto popup'),
      ul('wrv_offer, book_call_offer, lead_magnets_enabled – which CTAs/forms are on'),
      ul('book_call_calendar_url – link in book-a-call modal'),
      ul('lead_magnets – per-form enabled, success_message, mailchimp_tag (for automations)'),
      ul('show_pricing, show_email, cookie_consent_enabled, cta_primary_black, rescue_section_show_videos – UI toggles'),
      ul('ga_id – Google Analytics'),
      ul('maintenance_mode, maintenance_message – overlay when down'),
      ul('default_modal – which modal opens for ?modal= in URL'),
      ul('linkedin_faces – hero avatar stack (name, role, photo filename in images/li_mugs/)'),
    ],
  },
  {
    title: 'Forms & API',
    blocks: [
      rt('All forms POST to /vk2026/api. Endpoints:'),
      ul('/api/book-a-call – name, email, website, linkedin_url, company, phone, message. Syncs to Notion VKCRM + Mailchimp (tag: submitted website contact form).'),
      ul('/api/website-review – same as WRV; same Notion + Mailchimp behaviour.'),
      ul('/api/lead – lead magnets (form_id, email, etc.). Mailchimp only; tags from settings.js lead_magnets[].mailchimp_tag.'),
      rt('Submissions are logged to logs/submissions.log (NDJSON). Rate limit: 10 requests/min per IP on /vk2026/api.'),
    ],
  },
  {
    title: 'Notion VKCRM',
    blocks: [
      rt('server/lib/notion-vkcrm.js: creates or updates rows in the Notion database (NOTION_DATABASE_ID). Matches by website URL, then LinkedIn URL, then WRV title. Status: WRV Requested / Incoming Web Enquiry. General notes block includes session timeline (visits, button clicks, video progress).'),
      rt('Property names and structure must match your Notion database; edit notion-vkcrm.js if your schema differs.'),
    ],
  },
  {
    title: 'Deployment',
    blocks: [
      rt('deploy.sh (e.g. on server): git pull, npm install --production, wiki sync, pm2 restart vk2026. Static site is served from the same app; ensure SITE_BASE_URL and CORS (server/config.js) match your domain.'),
    ],
  },
  {
    title: 'Key files',
    blocks: [
      ul('index.html – page structure, sections, modals, mobile menu'),
      ul('main.js – modals, forms, nav smooth scroll, header hide-on-scroll, cookie consent, video tracking'),
      ul('styles.css – layout and components'),
      ul('server.js – Express app, static + API routes'),
      ul('server/routes/submissions.js – form handlers, Mailchimp + Notion'),
      ul('server/lib/notion-vkcrm.js – VKCRM create/update logic'),
      ul('server/lib/mailchimp.js – add/update contact, tags'),
      ul('README-API.md – form API and env setup'),
    ],
  },
  {
    title: 'Features & analytics',
    blocks: [
      h2('Analytics & visitor intelligence'),
      rt('First-party event pipeline: events and visitors are stored in your own MySQL (visitors + events tables), with optional NDJSON backup to logs/events.log when DB is configured.'),
      h3('Event types'),
      ul('Clicks, form_open/form_submit, video_play/pause/ended/progress, faq_open, scope_open, time_on_site, menu_open/close, modal_close, cal_link_click, tc_open, privacy_open, easter_egg_star, theme_switch. All sent only after cookie consent.'),
      h3('Visitor context'),
      ul('On each event batch the server derives device (e.g. Mac, iPhone), browser (e.g. Chrome, Safari), and location (city/country from IP via geoip-lite) and stores them on the visitor row for the event viewer.'),
      ul('First-touch referrer and UTM (source, medium, campaign, term, content) stored on both visitors and per event for attribution and reporting.'),
      ul('When someone submits a form (book-a-call, website-review, lead), their cookie visitor_id is linked to email/name in visitors so you see "who" in the event stream and in reports.'),
      h3('Time on site & return visits'),
      ul('Time on site: heartbeat every 30s plus final send on tab hide/beforeunload; metadata.seconds supports averages and bounce logic.'),
      ul('Return-visit alerts: when a known visitor (has email) comes back and sends an event, you get one notification per hour – email (SMTP), Slack message, and a row in a Notion "return visits" database.'),
      h3('Reports & event viewer'),
      ul('CLI report: node scripts/analytics-report.js [start] [end] --by utm|referrer --json for overall/LM/WRV/contact CVR, video views, time on site, bounce rate, with optional drill-down by referrer or UTM (first-touch).'),
      ul('Event viewer (demo-events.html): live event table with auto-refresh, filter by type (video, form, FAQ, scope, time on site, clicks, modal, menu, calendar, legal, easter egg, theme), search by UTM or email/visitor ID, "current users" (events in last 15 min), visitor labels like "email or #shortId Mac/Chrome nr Bristol via LinkedIn", bulk delete. Optional view_key protects the page.'),
      h3('Privacy & consent'),
      ul('Cookie bar: optional banner; tracking (visitor cookie + event sending) runs only if the user accepts. Consent stored in localStorage; no tracking cookie if they decline.'),
      ul('Visitor cookie stores visitor ID, visit count, referrer, button clicks, form submissions, and (if applicable) video progress; up to 365 days, only when consent is given.'),
      div(),
      h2('Forms & conversions'),
      ul('Book a call → Notion VKCRM (call booking), Mailchimp (tag: submitted website contact form), Slack notification, and analytics enrichment.'),
      ul('Website review → same Notion + Mailchimp + Slack + enrichment.'),
      ul('Lead magnets (e.g. 50 things, offboarding, social proof) → Mailchimp with per-form tags for automations; Slack + enrichment.'),
      ul('Honeypot (_hp) on forms to cut bot submissions.'),
      ul('Idempotency: optional idempotency_key with 24h cache so double-submits return the same success response without duplicate CRM/email actions.'),
      ul('Forms send _context.visitor_id (and optional referrer/UTM) so the server can enrich the analytics visitor and tie submissions to the same identity as events.'),
      div(),
      h2('Integrations & ops'),
      ul('Notion VKCRM: form submissions create/update pages (submission type, timestamps, form/trigger metadata, name, email, website, LinkedIn, company, phone, message).'),
      ul('Mailchimp: add/update contacts; contact forms get one tag, lead magnets get per-offer tags from settings.js.'),
      ul('Slack: incoming webhook for form submissions (book a call, website review, lead), return-visit notifications, and (optional) deploy started/completed/failed.'),
      ul('GitHub deploy webhook: POST /api/webhooks/deploy (secret-protected) runs deploy.sh (pull, install, optional wiki sync, PM2 restart); optional Slack deploy logging.'),
      ul('Optional: booking-confirmed webhook, Notion wiki sync script, Strapi/CMS-style settings (e.g. settings.js / loaders).'),
      div(),
      h2('Site experience'),
      ul('Modals: book a call, website review, lead magnets, terms, privacy; which modal and trigger are tracked as form_open / modal_close.'),
      ul('Videos: play/pause/ended/progress and modal-close tracked with video_label and pct where relevant.'),
      ul('Theme: light/dark with manual and system triggers, tracked as theme_switch.'),
      ul('Easter egg: star placeholders and easter_egg_star events.'),
      ul('Responsive: viewport and touch-friendly CTAs.'),
      rt('In short: first-party analytics (events, visitors, device/browser/location, UTM, time on site, enrichment, CVR reports, live event viewer), consent-aware tracking, return-visit notifications, and form handling wired into Notion, Mailchimp, Slack, and that same analytics pipeline.'),
    ],
  },
  {
    title: 'Server commands',
    blocks: [
      rt('Useful commands to run on the server (e.g. over SSH) to check that the app and deploy pipeline are up.'),
      h2('Quick “is it up?”'),
      rt('Check the site and API respond:'),
      code('curl -s -o /dev/null -w "%{http_code}" https://vanillakiller.com/vk2026/\n# Expect 200', 'bash'),
      code('curl -s -o /dev/null -w "%{http_code}" https://vanillakiller.com/vk2026/api/\n# Expect 404 (no route) or 200 – means API is reachable', 'bash'),
      rt('Or from the server:'),
      code('curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/vk2026/', 'bash'),
      h2('PM2 (app process)'),
      rt('See if the Node app is running and restart if needed:'),
      code('pm2 list', 'bash'),
      code('pm2 show vk2026', 'bash'),
      code('pm2 restart vk2026', 'bash'),
      code('pm2 logs vk2026 --lines 50', 'bash'),
      h2('Auto deploy'),
      rt('Deploy runs when you trigger it (e.g. webhook on push). To run manually from the server:'),
      code('cd /var/www/html/vk2026 && ./deploy.sh', 'bash'),
      rt('Deploy does: git pull, npm install --production, wiki sync to Notion, pm2 restart.'),
      h2('Form handling & logs'),
      rt('Recent form submissions (NDJSON):'),
      code('tail -n 20 /var/www/html/vk2026/logs/submissions.log', 'bash'),
      rt('Watch submissions in real time:'),
      code('tail -f /var/www/html/vk2026/logs/submissions.log', 'bash'),
      rt('If the API is behind Apache/nginx, check the reverse proxy is up:'),
      code('sudo systemctl status apache2   # or: sudo systemctl status nginx', 'bash'),
    ],
  },
];

module.exports = { rootBlocks, pages };
