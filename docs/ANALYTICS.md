# Analytics: tables, logs, and report queries

Analytics are stored in **both** MySQL tables and a log file.

## Where data lives

- **MySQL** (when `DB_USER` and `DB_NAME` are set in `.env`):
  - **`visitors`**: one row per cookie `visitor_id`; `first_seen_at`, `last_seen_at`, `referrer`, `utm_source`–`utm_content`, `email`, `name`, `enriched_at`, `return_visit_notified_at`.
  - **`events`**: one row per event; `visitor_id`, `event_type`, `occurred_at`, `page_url`, `referrer`, `utm_*`, `metadata` (JSON).
  - Schema: [server/db/schema.sql](../server/db/schema.sql).

- **Logs**:
  - [server/lib/analytics-logger.js](../server/lib/analytics-logger.js) appends NDJSON to **`logs/events.log`**.
  - When the DB is configured, each request writes to MySQL **then** appends the same events to the log. When the DB is not configured, only the log is written.
  - For building queries and reports, use the **tables**; logs are for tail/debug/backup.

Referrer and UTM are stored on both tables. **visitors** holds first-touch (first visit) referrer/UTM; **events** holds referrer/UTM per event, so you can drill down by first-touch or by event.

## Metric definitions

| Metric | Definition |
|--------|------------|
| **Overall CVR** | Visitors who converted / total visitors. Converted = have `email` (enriched) or at least one `form_submit`. |
| **LM CVR** | Conversions = `form_submit` with `metadata.form_id` like `form-lead-%` (e.g. form-lead-50things, form-lead-offboarding, form-lead-socialproof). Denominator: all visitors in period. |
| **WRV CVR** | Conversions = `form_submit` with `metadata.form_id` = `form-website-review`. |
| **Contact CVR** | Conversions = `form_submit` with `metadata.form_id` = `form-book-call`. |
| **Video views** | Events with `event_type` in `video_play`, `video_ended`, `video_progress`; count events or distinct `visitor_id`. `metadata` has `video_label`, `pct`. |
| **Time on site** | From `event_type = 'time_on_site'`; `metadata.seconds`. Per-visitor max seconds in period; report as average or percentiles. |
| **Bounce rate** | **Bounce** = visitor has exactly one event in period OR max `time_on_site` seconds &lt; 30. Bounce rate = bounces / total visitors. |

Form submissions are recorded **server-side** when a form is submitted via the API (book-a-call, website-review, lead), so the digest counts conversions even when the client didn’t send an analytics event (e.g. cookie declined).

## Running the report

Requires MySQL configured (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`).

```bash
# Last 30 days (default), summary
node scripts/analytics-report.js

# Custom date range
node scripts/analytics-report.js 2025-01-01 2025-02-01

# Drill down by UTM (first-touch)
node scripts/analytics-report.js --by utm

# Drill down by referrer
node scripts/analytics-report.js --by referrer

# Full JSON output (for grouped breakdowns or piping)
node scripts/analytics-report.js --json
node scripts/analytics-report.js 2025-01-01 2025-02-01 --by utm --json
```

## Query module

The report uses [server/lib/analytics-queries.js](../server/lib/analytics-queries.js), which you can call from other code:

- `overallCvr(start, end, { groupBy: 'none'|'referrer'|'utm' })`
- `lmCvr(start, end, { groupBy })`
- `wrvCvr(start, end, { groupBy })`
- `contactCvr(start, end, { groupBy })`
- `videoViews(start, end, { groupBy })`
- `timeOnSite(start, end, { groupBy })`
- `bounceRate(start, end, { groupBy })`
- `runReport(start, end, { groupBy })` – runs all of the above.

Raw SQL patterns (for ad-hoc use or different tools) are in [server/db/analytics-queries.sql](../server/db/analytics-queries.sql).

## Demo events viewer & new-visitor Slack

### Protecting the demo-events page (secret key)

To restrict the event viewer so only you can open it:

1. **Set a secret in `.env`:**
   ```bash
   DEMO_VIEW_KEY=your-secret-string
   ```
   Use a long random string (e.g. from a password manager).

2. **What this does:**
   - **Page:** Opening `https://yoursite.com/demo-events.html` (or `/vk2026/demo-events.html`) will prompt for **HTTP Basic Auth**. Use any username and your `DEMO_VIEW_KEY` as the password.
   - **API:** `GET /api/analytics/events` and `POST /api/analytics/events/delete` require `?view_key=your-secret-string` in the URL. The demo-events page appends this from the current URL when you open it with `?view_key=...`.

3. **How to open the viewer:**  
   Use a bookmarked URL that includes the key so you don’t type it each time:
   - Production: `https://vanillakiller.com/demo-events.html?view_key=YOUR_SECRET`
   - You’ll still get one Basic Auth prompt (same password: `DEMO_VIEW_KEY`). After that, the page will pass `view_key` to the API automatically.

### New-visitor Slack notifications

When a **new** visitor lands (first event batch for that `visitor_id`), the server sends a Slack message like:

**Chrome/Mac nr Leeds from LinkedIn** ← link to demo-events filtered to that visitor

- **Browser/device** and **location** come from User-Agent and IP (geoip-lite). **Source** is UTM (e.g. LinkedIn) or “direct”.
- The message is a link: clicking it opens the demo-events page with that visitor’s ID in the “Email or visitor” filter, so you see only their events.

Requires `SLACK_WEBHOOK_URL` in `.env`. The link includes `view_key` when `DEMO_VIEW_KEY` is set, so the URL works when the viewer is protected.

## Daily digest

A **midnight–midnight** daily digest includes: unique visitors, avg time on site, bounce rate, overall conversions & CVR%, WRV count & CVR%, contact form submissions & CVR%, lead magnet downloads & CVR%. Google meeting bookings are planned (integration TBD).

### CLI (table output)

Requires MySQL configured. From the project root:

```bash
# Today so far (midnight → now)
npm run digest
# or
node scripts/daily-digest.js

# Full day yesterday
node scripts/daily-digest.js yesterday

# Specific date
node scripts/daily-digest.js 2025-02-21

# Send to Slack + email + Notion (yesterday's full day)
npm run digest:send
# or
node scripts/daily-digest.js yesterday --send

# Raw JSON
node scripts/daily-digest.js yesterday --json
```

### Sending (Slack, email, Notion)

Use `--send` (or `-s`) to post the digest to all configured channels:

- **Slack**: set `SLACK_WEBHOOK_URL` (incoming webhook).
- **Email**: set `NOTIFICATION_EMAIL_TO` and SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
- **Notion**: create a database with properties **Name** (title), **Date** (date), **Summary** (rich text), then set `NOTION_DAILY_DIGEST_DATABASE_ID` and `NOTION_TOKEN`. Each run adds one row.

To run the digest every day (e.g. 00:05 UTC), add a cron job:

```bash
5 0 * * * cd /path/to/vk2026 && node scripts/daily-digest.js yesterday --send
```

### Google meeting bookings

Count of "book a call" / Google Meet bookings from the site is not yet available; integration is planned. The digest shows "— (integration TBD)" for that metric until implemented.

## Decisions

- **Bounce**: We use a single definition (one event in period OR max time_on_site &lt; 30s). Document any change if you adjust it.
- **Attribution**: Report uses **first-touch** (visitors.referrer / utm_*) when grouping by referrer/UTM. For last-touch you’d join on the conversion event’s UTM.
- **Sessions**: Time on site and bounce are computed per visitor in the selected period; the schema supports per-session logic if you add it later.
