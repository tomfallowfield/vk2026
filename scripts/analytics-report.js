#!/usr/bin/env node
/**
 * Run analytics report: overall CVR, LM CVR, WRV CVR, contact CVR,
 * video views, time on site, bounce rate. Optional drill-down by referrer or UTM.
 *
 * Usage:
 *   node scripts/analytics-report.js [start] [end] [--by utm|referrer] [--json]
 *
 * Dates: ISO date or YYYY-MM-DD. Default: last 30 days.
 * Requires: DB_* env (see docs/ANALYTICS.md).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { runReport } = require('../server/lib/analytics-queries');

function lastNDays(n) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - n);
  return { start, end };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let start = null;
  let end = null;
  let groupBy = 'none';
  let json = false;
  for (const a of args) {
    if (a === '--by' || a === '-b') {
      const next = args[args.indexOf(a) + 1];
      if (next === 'utm' || next === 'referrer') groupBy = next;
      continue;
    }
    if (a === '--json' || a === '-j') {
      json = true;
      continue;
    }
    if (a.startsWith('--')) continue;
    if (!start) start = new Date(a);
    else if (!end) end = new Date(a);
  }
  if (!start || !end) {
    const range = lastNDays(30);
    start = start || range.start;
    end = end || range.end;
  }
  if (start > end) [start, end] = [end, start];
  return { start, end, groupBy, json };
}

function formatReport(report) {
  if (report.error) return JSON.stringify(report, null, 2);
  const lines = [];
  lines.push(`Period: ${report.period.start} → ${report.period.end}`);
  if (report.groupBy !== 'none') lines.push(`Group by: ${report.groupBy}`);
  lines.push('');
  const m = report.metrics;
  const isGrouped = Array.isArray(m.overall_cvr);

  if (!isGrouped) {
    lines.push('Overall CVR:  ' + (m.overall_cvr?.total_visitors ?? 0) + ' visitors, ' + (m.overall_cvr?.conversions ?? 0) + ' conversions, ' + (m.overall_cvr?.cvr_pct ?? 0) + '%');
    lines.push('LM CVR:       ' + (m.lm_cvr?.lm_conversions ?? 0) + ' conversions, ' + (m.lm_cvr?.lm_cvr_pct ?? 0) + '%');
    lines.push('WRV CVR:      ' + (m.wrv_cvr?.wrv_conversions ?? 0) + ' conversions, ' + (m.wrv_cvr?.wrv_cvr_pct ?? 0) + '%');
    lines.push('Contact CVR:  ' + (m.contact_cvr?.contact_conversions ?? 0) + ' conversions, ' + (m.contact_cvr?.contact_cvr_pct ?? 0) + '%');
    lines.push('Video views:  ' + (m.video_views?.video_events ?? 0) + ' events, ' + (m.video_views?.unique_viewers ?? 0) + ' unique viewers');
    lines.push('Time on site: ' + (m.time_on_site?.avg_seconds ?? 0) + 's avg, ' + (m.time_on_site?.visitors_with_time ?? 0) + ' visitors');
    lines.push('Bounce rate:  ' + (m.bounce_rate?.bounces ?? 0) + ' bounces / ' + (m.bounce_rate?.total_visitors ?? 0) + ' visitors, ' + (m.bounce_rate?.bounce_rate_pct ?? 0) + '%');
  } else {
    lines.push('(Grouped breakdown – use --json for full data)');
    lines.push('Overall CVR rows: ' + (m.overall_cvr?.length ?? 0));
    lines.push('LM CVR rows:      ' + (m.lm_cvr?.length ?? 0));
    lines.push('WRV CVR rows:     ' + (m.wrv_cvr?.length ?? 0));
    lines.push('Contact CVR rows: ' + (m.contact_cvr?.length ?? 0));
    lines.push('Video views rows: ' + (m.video_views?.length ?? 0));
    lines.push('Time on site rows:' + (m.time_on_site?.length ?? 0));
    lines.push('Bounce rate rows: ' + (m.bounce_rate?.length ?? 0));
  }
  return lines.join('\n');
}

async function main() {
  const { start, end, groupBy, json } = parseArgs();
  const report = await runReport(start, end, { groupBy });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
