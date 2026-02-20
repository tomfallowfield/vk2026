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

## Decisions

- **Bounce**: We use a single definition (one event in period OR max time_on_site &lt; 30s). Document any change if you adjust it.
- **Attribution**: Report uses **first-touch** (visitors.referrer / utm_*) when grouping by referrer/UTM. For last-touch you’d join on the conversion event’s UTM.
- **Sessions**: Time on site and bounce are computed per visitor in the selected period; the schema supports per-session logic if you add it later.
