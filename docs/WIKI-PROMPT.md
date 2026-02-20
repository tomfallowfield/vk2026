# VK Website Wiki – Notion AI prompt

**Version:** 1.0.0  
**Date:** 2026-02-20

This file is the single source for building and updating the VK Website documentation wiki in Notion. The sync script is deprecated (it caused duplicated pages). Instead, use the prompt below with Notion AI to create or refresh the wiki.

---

## How to use

1. Open your VK Website wiki in Notion (root page or the page that should contain all child pages).
2. Use Notion AI (e.g. “Ask AI” or paste into a block) with the **PROMPT** below.
3. Ask it to create the structure and content: one root section plus child pages/sections as specified.
4. If the wiki already exists and you only need changes, use a **delta prompt** (see “Future updates” below) and paste that instead.

---

## PROMPT (full wiki build)

Copy everything between the lines below and paste into Notion AI.

```
Build or replace the VK Website documentation wiki with this exact structure and content. Use a clear hierarchy: one main wiki page and subpages (or toggles/sections) for each of the page titles below. Version: 1.0.0. Date: 2026-02-20.

---

ROOT PAGE

# VK Website (vk2026) – Documentation Wiki

This wiki is maintained from the repo. To update: see docs/WIKI-PROMPT.md for the current version, date, and prompt (or a delta prompt for small changes). No automated sync.

Use the subpages/sections below for each topic.

---

PAGE: Overview

Vanilla Killer marketing site: single-page site with hero, pricing, testimonials, forms (book a call, website review, lead magnets), modals, and mobile menu. Served by Express; forms post to the same server and sync to Mailchimp and Notion VKCRM.

## Tech stack
- Frontend: static HTML/CSS/JS (index.html, styles.css, main.js). No framework.
- Config: settings.js (window.SITE_SETTINGS) loaded before main.js.
- Server: Node + Express (server.js). Static files under /vk2026, API under /vk2026/api.
- Integrations: Mailchimp (contacts + tags), Notion (VKCRM database for enquiries).

---

PAGE: Environment

Copy .env.example to .env. Required for forms and integrations:
- SITE_BASE_URL – e.g. https://vanillakiller.com or http://localhost:3000/vk2026
- PORT – server port (e.g. 3000)
- MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID – for contact + lead-magnet forms
- NOTION_TOKEN, NOTION_DATABASE_ID – for VKCRM (book-a-call, website-review rows)
- NOTION_WIKI_PAGE_ID – optional; for syncing this wiki (scripts/sync-wiki-to-notion.js)
- BOOKING_WEBHOOK_SECRET – optional; for booking-confirmed webhook auth

---

PAGE: Settings

window.SITE_SETTINGS (settings.js) controls behaviour without touching main.js:
- autodialog_form_to_show, autodialog_to_be_shown_on_exit_intent, autodialog_to_be_shown_after_delay_s – auto popup
- wrv_offer, book_call_offer, lead_magnets_enabled – which CTAs/forms are on
- book_call_calendar_url – link in book-a-call modal
- lead_magnets – per-form enabled, success_message, mailchimp_tag (for automations)
- show_pricing, show_email, cookie_consent_enabled, cta_primary_black, rescue_section_show_videos – UI toggles
- ga_id – Google Analytics
- maintenance_mode, maintenance_message – overlay when down
- default_modal – which modal opens for ?modal= in URL
- linkedin_faces – hero avatar stack (name, role, photo filename in images/li_mugs/)

---

PAGE: Forms & API

All forms POST to /vk2026/api. Endpoints:
- /api/book-a-call – name, email, website, linkedin_url, company, phone, message. Syncs to Notion VKCRM + Mailchimp (tag: submitted website contact form).
- /api/website-review – same as WRV; same Notion + Mailchimp behaviour.
- /api/lead – lead magnets (form_id, email, etc.). Mailchimp only; tags from settings.js lead_magnets[].mailchimp_tag.

Submissions are logged to logs/submissions.log (NDJSON). Rate limit: 10 requests/min per IP on /vk2026/api.

---

PAGE: Notion VKCRM

server/lib/notion-vkcrm.js: creates or updates rows in the Notion database (NOTION_DATABASE_ID). Matches by website URL, then LinkedIn URL, then WRV title. Status: WRV Requested / Incoming Web Enquiry. General notes block includes session timeline (visits, button clicks, video progress).

Property names and structure must match your Notion database; edit notion-vkcrm.js if your schema differs.

---

PAGE: Deployment

deploy.sh (e.g. on server): git pull, npm install --production, wiki sync, pm2 restart vk2026. Static site is served from the same app; ensure SITE_BASE_URL and CORS (server/config.js) match your domain.

---

PAGE: Key files

- index.html – page structure, sections, modals, mobile menu
- main.js – modals, forms, nav smooth scroll, header hide-on-scroll, cookie consent, video tracking
- styles.css – layout and components
- server.js – Express app, static + API routes
- server/routes/submissions.js – form handlers, Mailchimp + Notion
- server/lib/notion-vkcrm.js – VKCRM create/update logic
- server/lib/mailchimp.js – add/update contact, tags
- README-API.md – form API and env setup

---

PAGE: Features & analytics

## Analytics & visitor intelligence

First-party event pipeline: events and visitors are stored in your own MySQL (visitors + events tables), with optional NDJSON backup to logs/events.log when DB is configured.

### Event types
- Clicks, form_open/form_submit, video_play/pause/ended/progress, faq_open, scope_open, time_on_site, menu_open/close, modal_close, cal_link_click, tc_open, privacy_open, easter_egg_star, theme_switch. All sent only after cookie consent.

### Visitor context
- On each event batch the server derives device (e.g. Mac, iPhone), browser (e.g. Chrome, Safari), and location (city/country from IP via geoip-lite) and stores them on the visitor row for the event viewer.
- First-touch referrer and UTM (source, medium, campaign, term, content) stored on both visitors and per event for attribution and reporting.
- When someone submits a form (book-a-call, website-review, lead), their cookie visitor_id is linked to email/name in visitors so you see "who" in the event stream and in reports.

### Time on site & return visits
- Time on site: heartbeat every 30s plus final send on tab hide/beforeunload; metadata.seconds supports averages and bounce logic.
- Return-visit alerts: when a known visitor (has email) comes back and sends an event, you get one notification per hour – email (SMTP), Slack message, and a row in a Notion "return visits" database.

### Reports & event viewer
- CLI report: node scripts/analytics-report.js [start] [end] --by utm|referrer --json for overall/LM/WRV/contact CVR, video views, time on site, bounce rate, with optional drill-down by referrer or UTM (first-touch).
- Event viewer (demo-events.html): live event table with auto-refresh, filter by type (video, form, FAQ, scope, time on site, clicks, modal, menu, calendar, legal, easter egg, theme), search by UTM or email/visitor ID, "current users" (events in last 15 min), visitor labels like "email or #shortId Mac/Chrome nr Bristol via LinkedIn", bulk delete. Optional view_key protects the page.

### Privacy & consent
- Cookie bar: optional banner; tracking (visitor cookie + event sending) runs only if the user accepts. Consent stored in localStorage; no tracking cookie if they decline.
- Visitor cookie stores visitor ID, visit count, referrer, button clicks, form submissions, and (if applicable) video progress; up to 365 days, only when consent is given.

## Forms & conversions
- Book a call → Notion VKCRM (call booking), Mailchimp (tag: submitted website contact form), Slack notification, and analytics enrichment.
- Website review → same Notion + Mailchimp + Slack + enrichment.
- Lead magnets (e.g. 50 things, offboarding, social proof) → Mailchimp with per-form tags for automations; Slack + enrichment.
- Honeypot (_hp) on forms to cut bot submissions.
- Idempotency: optional idempotency_key with 24h cache so double-submits return the same success response without duplicate CRM/email actions.
- Forms send _context.visitor_id (and optional referrer/UTM) so the server can enrich the analytics visitor and tie submissions to the same identity as events.

## Integrations & ops
- Notion VKCRM: form submissions create/update pages (submission type, timestamps, form/trigger metadata, name, email, website, LinkedIn, company, phone, message).
- Mailchimp: add/update contacts; contact forms get one tag, lead magnets get per-offer tags from settings.js.
- Slack: incoming webhook for form submissions (book a call, website review, lead), return-visit notifications, and (optional) deploy started/completed/failed.
- GitHub deploy webhook: POST /api/webhooks/deploy (secret-protected) runs deploy.sh (pull, install, optional wiki sync, PM2 restart); optional Slack deploy logging.
- Optional: booking-confirmed webhook, Notion wiki sync script, Strapi/CMS-style settings (e.g. settings.js / loaders).

## Site experience
- Modals: book a call, website review, lead magnets, terms, privacy; which modal and trigger are tracked as form_open / modal_close.
- Videos: play/pause/ended/progress and modal-close tracked with video_label and pct where relevant.
- Theme: light/dark with manual and system triggers, tracked as theme_switch.
- Easter egg: star placeholders and easter_egg_star events.
- Responsive: viewport and touch-friendly CTAs.

In short: first-party analytics (events, visitors, device/browser/location, UTM, time on site, enrichment, CVR reports, live event viewer), consent-aware tracking, return-visit notifications, and form handling wired into Notion, Mailchimp, Slack, and that same analytics pipeline.

---

PAGE: Server commands

Useful commands to run on the server (e.g. over SSH) to check that the app and deploy pipeline are up.

## Quick "is it up?"
Check the site and API respond:

```bash
curl -s -o /dev/null -w "%{http_code}" https://vanillakiller.com/vk2026/
# Expect 200
```

```bash
curl -s -o /dev/null -w "%{http_code}" https://vanillakiller.com/vk2026/api/
# Expect 404 (no route) or 200 – means API is reachable
```

Or from the server:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/vk2026/
```

## PM2 (app process)
See if the Node app is running and restart if needed:

```bash
pm2 list
pm2 show vk2026
pm2 restart vk2026
pm2 logs vk2026 --lines 50
```

## Auto deploy
Deploy runs when you trigger it (e.g. webhook on push). To run manually from the server:

```bash
cd /var/www/html/vk2026 && ./deploy.sh
```

Deploy does: git pull, npm install --production, wiki sync to Notion, pm2 restart.

## Form handling & logs
Recent form submissions (NDJSON):

```bash
tail -n 20 /var/www/html/vk2026/logs/submissions.log
```

Watch submissions in real time:

```bash
tail -f /var/www/html/vk2026/logs/submissions.log
```

If the API is behind Apache/nginx, check the reverse proxy is up:

```bash
sudo systemctl status apache2   # or: sudo systemctl status nginx
```
```

---

## Future updates

When you need to change the wiki without rebuilding everything:

1. Tell the AI (or the developer) what should change, e.g.:
   - "Change all references from PM2 vk2026 to vk-form-handler"
   - "Update the Deployment page to say we no longer run wiki sync in deploy.sh"
   - "Add a new subsection under Features & analytics about X"
2. The repo will be updated with:
   - A new **version** (e.g. 1.1.0) and **date**
   - A short **delta prompt** you can paste into Notion AI, e.g.:

     "Apply these changes to the VK Website wiki (version 1.1.0, 2026-03-01): Replace every mention of 'pm2 vk2026' and 'vk2026' as the process name with 'vk-form-handler'. Update Server commands page paths from /var/www/html/vk2026 to /var/www/vanillakiller.com/public_html where appropriate."

3. Paste the delta prompt into Notion AI on the wiki; it will apply only those edits.
4. Optionally, a new full prompt (version 1.1.0) can be stored in docs/WIKI-PROMPT.md if you prefer to rebuild from scratch later.

---

## Changelog

| Version | Date       | Change |
|---------|------------|--------|
| 1.0.0   | 2026-02-20 | Initial prompt: full wiki (Overview, Environment, Settings, Forms & API, Notion VKCRM, Deployment, Key files, Features & analytics, Server commands). Switched from sync script to Notion AI prompt. |
