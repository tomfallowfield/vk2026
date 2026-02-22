/**
 * Daily analytics digest: midnight–midnight metrics for a single day.
 * Used by CLI (table output) and by senders (Slack, email, Notion).
 *
 * Metrics: unique visitors, avg time on site, bounce rate, overall conversions/CVR,
 * WRV count/CVR, contact form count/CVR, lead magnet count/CVR.
 * Google meeting bookings: placeholder (integration TBD).
 */

const { runReport } = require('./analytics-queries');

/**
 * @param {string|Date} start - Start of period (inclusive), e.g. midnight
 * @param {string|Date} end - End of period (exclusive), e.g. next midnight
 * @returns {Promise<object>} Digest with date, period, and all daily metrics
 */
async function getDailyDigest(start, end) {
  const report = await runReport(start, end, { groupBy: 'none' });
  if (report.error) {
    return { error: report.error, date: null, period: null };
  }

  const m = report.metrics || {};
  const overall = m.overall_cvr || {};
  const wrv = m.wrv_cvr || {};
  const contact = m.contact_cvr || {};
  const lm = m.lm_cvr || {};
  const timeOnSite = m.time_on_site || {};
  const bounce = m.bounce_rate || {};

  const uniqueVisitors = Number(overall.total_visitors) || 0;
  const conversionsTotal = Number(overall.conversions) || 0;
  const cvrPct = Number(overall.cvr_pct) || 0;

  const wrvCount = Number(wrv.wrv_conversions) || 0;
  const wrvCvrPct = Number(wrv.wrv_cvr_pct) || 0;

  const contactFormCount = Number(contact.contact_conversions) || 0;
  const contactFormCvrPct = Number(contact.contact_cvr_pct) || 0;

  const leadMagnetDownloads = Number(lm.lm_conversions) || 0;
  const leadMagnetCvrPct = Number(lm.lm_cvr_pct) || 0;

  const avgTimeSeconds = Number(timeOnSite.avg_seconds) || 0;
  const bounceRatePct = Number(bounce.bounce_rate_pct) || 0;

  // Google Calendar / meeting bookings: not integrated yet (pin)
  const googleMeetingsBooked = null;

  const dateStr = report.period && report.period.start ? report.period.start.slice(0, 10) : null;

  return {
    date: dateStr,
    period: report.period || { start: null, end: null },
    unique_visitors: uniqueVisitors,
    avg_time_on_site_seconds: avgTimeSeconds,
    bounce_rate_pct: bounceRatePct,
    conversions_total: conversionsTotal,
    cvr_pct: cvrPct,
    wrv_count: wrvCount,
    wrv_cvr_pct: wrvCvrPct,
    contact_form_count: contactFormCount,
    contact_form_cvr_pct: contactFormCvrPct,
    google_meetings_booked: googleMeetingsBooked,
    lead_magnet_downloads: leadMagnetDownloads,
    lead_magnet_cvr_pct: leadMagnetCvrPct
  };
}

/**
 * Format digest as plain text (for Slack and email body).
 * @param {object} d - Result of getDailyDigest
 */
function formatDigestText(d) {
  if (d.error) return 'Daily digest: ' + d.error;
  const lines = [
    'Daily digest · ' + (d.date || '—'),
    '',
    'Unique visitors:        ' + (d.unique_visitors ?? '—'),
    'Avg time on site:       ' + (d.avg_time_on_site_seconds != null ? d.avg_time_on_site_seconds + 's' : '—'),
    'Bounce rate:            ' + (d.bounce_rate_pct != null ? d.bounce_rate_pct + '%' : '—'),
    '',
    'Overall conversions:    ' + (d.conversions_total ?? '—'),
    'Overall CVR:            ' + (d.cvr_pct != null ? d.cvr_pct + '%' : '—'),
    '',
    'WRV submissions:        ' + (d.wrv_count ?? '—'),
    'WRV CVR:                ' + (d.wrv_cvr_pct != null ? d.wrv_cvr_pct + '%' : '—'),
    '',
    'Contact form submissions: ' + (d.contact_form_count ?? '—'),
    'Contact form CVR:       ' + (d.contact_form_cvr_pct != null ? d.contact_form_cvr_pct + '%' : '—'),
    '',
    'Google meetings booked: ' + (d.google_meetings_booked != null ? d.google_meetings_booked : '— (integration TBD)'),
    '',
    'Lead magnet downloads:  ' + (d.lead_magnet_downloads ?? '—'),
    'Lead magnet CVR:        ' + (d.lead_magnet_cvr_pct != null ? d.lead_magnet_cvr_pct + '%' : '—')
  ];
  return lines.join('\n');
}

module.exports = {
  getDailyDigest,
  formatDigestText
};
