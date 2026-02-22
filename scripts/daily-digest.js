#!/usr/bin/env node
/**
 * Daily analytics digest: print stats in a table or send to Slack / email / Notion.
 *
 * Usage:
 *   node scripts/daily-digest.js                    # Today so far (midnight → now)
 *   node scripts/daily-digest.js yesterday          # Full day yesterday
 *   node scripts/daily-digest.js 2025-02-21         # Specific date (midnight–midnight)
 *   node scripts/daily-digest.js --send              # Today so far, then send to Slack + email + Notion
 *   node scripts/daily-digest.js yesterday --send    # Yesterday's full day, then send
 *   node scripts/daily-digest.js --json             # Output raw digest JSON
 *
 * Requires: DB_* in .env (see docs/ANALYTICS.md).
 * Sending requires: SLACK_WEBHOOK_URL, NOTIFICATION_EMAIL_TO + SMTP_*, NOTION_DAILY_DIGEST_DATABASE_ID (optional).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { getDailyDigest } = require('../server/lib/daily-digest');
const { sendDailyDigest } = require('../server/lib/daily-digest-send');

function toUTCMidnight(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function nextUTCMidnight(date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dateArg = null;
  let send = false;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--send' || a === '-s') {
      send = true;
      continue;
    }
    if (a === '--json' || a === '-j') {
      json = true;
      continue;
    }
    if (a.startsWith('--')) continue;
    if (!dateArg) dateArg = a;
  }
  return { dateArg, send, json };
}

function getRange(dateArg) {
  const now = new Date();
  let start;
  let end;
  if (!dateArg || dateArg === 'today') {
    start = toUTCMidnight(now);
    end = new Date(now);
  } else if (dateArg === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    start = toUTCMidnight(yesterday);
    end = nextUTCMidnight(yesterday);
  } else {
    const d = new Date(dateArg);
    if (Number.isNaN(d.getTime())) {
      console.error('Invalid date:', dateArg);
      process.exit(1);
    }
    start = toUTCMidnight(d);
    end = nextUTCMidnight(d);
  }
  return { start, end };
}

function tableRow(label, value) {
  const l = String(label).padEnd(28);
  const v = value == null || value === '' ? '—' : String(value);
  return '  ' + l + '  ' + v;
}

function formatTable(digest) {
  if (digest.error) {
    return 'Error: ' + digest.error;
  }
  const lines = [
    '',
    '  Daily digest · ' + (digest.date || '—') + '  ' + (digest.period && digest.period.start ? '(' + digest.period.start + ' → ' + digest.period.end + ')' : ''),
    '  ' + '—'.repeat(58),
    tableRow('Unique visitors', digest.unique_visitors),
    tableRow('Avg time on site', digest.avg_time_on_site_seconds != null ? digest.avg_time_on_site_seconds + 's' : null),
    tableRow('Bounce rate', digest.bounce_rate_pct != null ? digest.bounce_rate_pct + '%' : null),
    '  ' + '—'.repeat(58),
    tableRow('Overall conversions', digest.conversions_total),
    tableRow('Overall CVR', digest.cvr_pct != null ? digest.cvr_pct + '%' : null),
    '  ' + '—'.repeat(58),
    tableRow('WRV submissions', digest.wrv_count),
    tableRow('WRV CVR', digest.wrv_cvr_pct != null ? digest.wrv_cvr_pct + '%' : null),
    tableRow('Contact form submissions', digest.contact_form_count),
    tableRow('Contact form CVR', digest.contact_form_cvr_pct != null ? digest.contact_form_cvr_pct + '%' : null),
    tableRow('Google meetings booked', digest.google_meetings_booked != null ? digest.google_meetings_booked : '— (integration TBD)'),
    tableRow('Lead magnet downloads', digest.lead_magnet_downloads),
    tableRow('Lead magnet CVR', digest.lead_magnet_cvr_pct != null ? digest.lead_magnet_cvr_pct + '%' : null),
    '  ' + '—'.repeat(58),
    ''
  ];
  return lines.join('\n');
}

async function main() {
  const { dateArg, send, json } = parseArgs();
  const { start, end } = getRange(dateArg);

  const digest = await getDailyDigest(start, end);

  if (json) {
    console.log(JSON.stringify(digest, null, 2));
  } else {
    console.log(formatTable(digest));
  }

  if (send) {
    await sendDailyDigest(digest);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
