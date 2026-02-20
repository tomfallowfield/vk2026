/**
 * Analytics report queries: CVR (overall, LM, WRV, contact), video views,
 * time on site, bounce rate. Optional drill-down by first-touch referrer/UTM.
 *
 * Bounce definition: visitor has only one event in period OR max time_on_site
 * seconds < 30. Form IDs: form-website-review (WRV), form-book-call (contact),
 * form-lead-* (LM).
 */

const { executeQuery, isConfigured } = require('./analytics-db');

function toMysqlDatetime(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * @param {string|Date} start - Start of period (inclusive)
 * @param {string|Date} end - End of period (exclusive)
 * @returns {{ start: string, end: string }} MySQL datetime strings
 */
function normalizeRange(start, end) {
  const s = toMysqlDatetime(start);
  const e = toMysqlDatetime(end);
  return { start: s, end: e };
}

/**
 * Overall CVR: total visitors, conversions (have email), CVR %.
 * Optionally grouped by first-touch referrer/UTM.
 *
 * @param {string|Date} start
 * @param {string|Date} end
 * @param {{ groupBy?: 'none'|'referrer'|'utm' }} opts
 */
async function overallCvr(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { total_visitors: 0, conversions: 0, cvr_pct: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.referrer, '(direct)') AS referrer,
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COALESCE(v.utm_campaign, '') AS utm_campaign,
        COUNT(DISTINCT v.visitor_id) AS total_visitors,
        COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) AS conversions,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS cvr_pct
      FROM visitors v
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.referrer, v.utm_source, v.utm_medium, v.utm_campaign
      ORDER BY total_visitors DESC`,
      [s, e]
    );
    return rows;
  }

  if (opts.groupBy === 'referrer') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.referrer, '(direct)') AS referrer,
        COUNT(DISTINCT v.visitor_id) AS total_visitors,
        COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) AS conversions,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS cvr_pct
      FROM visitors v
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.referrer
      ORDER BY total_visitors DESC`,
      [s, e]
    );
    return rows;
  }

  const rows = await executeQuery(
    `SELECT
      COUNT(DISTINCT v.visitor_id) AS total_visitors,
      COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) AS conversions,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS cvr_pct
    FROM visitors v
    WHERE v.first_seen_at >= ? AND v.first_seen_at < ?`,
    [s, e]
  );
  return rows[0] || { total_visitors: 0, conversions: 0, cvr_pct: 0 };
}

/**
 * LM CVR: conversions = form_submit with form_id like 'form-lead-%'.
 * Returns overall counts or rows by first-touch UTM.
 */
async function lmCvr(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { lm_conversions: 0, visitors: 0, lm_cvr_pct: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(DISTINCT v.visitor_id) AS visitors,
        COUNT(DISTINCT CASE WHEN lm.visitor_id IS NOT NULL THEN v.visitor_id END) AS lm_conversions,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN lm.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS lm_cvr_pct
      FROM visitors v
      LEFT JOIN (
        SELECT DISTINCT e.visitor_id
        FROM events e
        WHERE e.event_type = 'form_submit'
          AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) LIKE 'form-lead-%'
          AND e.occurred_at >= ? AND e.occurred_at < ?
      ) lm ON lm.visitor_id = v.visitor_id
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.utm_source, v.utm_medium
      ORDER BY visitors DESC`,
      [s, e, s, e]
    );
    return rows;
  }

  const conv = await executeQuery(
    `SELECT COUNT(DISTINCT e.visitor_id) AS lm_conversions
     FROM events e
     WHERE e.event_type = 'form_submit'
       AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) LIKE 'form-lead-%'
       AND e.occurred_at >= ? AND e.occurred_at < ?`,
    [s, e]
  );
  const total = await executeQuery(
    `SELECT COUNT(DISTINCT visitor_id) AS visitors FROM visitors WHERE first_seen_at >= ? AND first_seen_at < ?`,
    [s, e]
  );
  const conversions = (conv[0] && Number(conv[0].lm_conversions)) || 0;
  const visitors = (total[0] && Number(total[0].visitors)) || 0;
  const cvr = visitors ? Math.round(100 * conversions / visitors * 100) / 100 : 0;
  return { lm_conversions: conversions, visitors, lm_cvr_pct: cvr };
}

/**
 * WRV CVR: form_submit with form_id = 'form-website-review'.
 */
async function wrvCvr(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { wrv_conversions: 0, visitors: 0, wrv_cvr_pct: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(DISTINCT v.visitor_id) AS visitors,
        COUNT(DISTINCT CASE WHEN wrv.visitor_id IS NOT NULL THEN v.visitor_id END) AS wrv_conversions,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN wrv.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS wrv_cvr_pct
      FROM visitors v
      LEFT JOIN (
        SELECT DISTINCT e.visitor_id
        FROM events e
        WHERE e.event_type = 'form_submit'
          AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-website-review'
          AND e.occurred_at >= ? AND e.occurred_at < ?
      ) wrv ON wrv.visitor_id = v.visitor_id
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.utm_source, v.utm_medium
      ORDER BY visitors DESC`,
      [s, e, s, e]
    );
    return rows;
  }

  const conv = await executeQuery(
    `SELECT COUNT(DISTINCT e.visitor_id) AS wrv_conversions
     FROM events e
     WHERE e.event_type = 'form_submit'
       AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-website-review'
       AND e.occurred_at >= ? AND e.occurred_at < ?`,
    [s, e]
  );
  const total = await executeQuery(
    `SELECT COUNT(DISTINCT visitor_id) AS visitors FROM visitors WHERE first_seen_at >= ? AND first_seen_at < ?`,
    [s, e]
  );
  const conversions = (conv[0] && Number(conv[0].wrv_conversions)) || 0;
  const visitors = (total[0] && Number(total[0].visitors)) || 0;
  const cvr = visitors ? Math.round(100 * conversions / visitors * 100) / 100 : 0;
  return { wrv_conversions: conversions, visitors, wrv_cvr_pct: cvr };
}

/**
 * Contact CVR: form_submit with form_id = 'form-book-call'.
 */
async function contactCvr(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { contact_conversions: 0, visitors: 0, contact_cvr_pct: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(DISTINCT v.visitor_id) AS visitors,
        COUNT(DISTINCT CASE WHEN c.visitor_id IS NOT NULL THEN v.visitor_id END) AS contact_conversions,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN c.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS contact_cvr_pct
      FROM visitors v
      LEFT JOIN (
        SELECT DISTINCT e.visitor_id
        FROM events e
        WHERE e.event_type = 'form_submit'
          AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-book-call'
          AND e.occurred_at >= ? AND e.occurred_at < ?
      ) c ON c.visitor_id = v.visitor_id
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.utm_source, v.utm_medium
      ORDER BY visitors DESC`,
      [s, e, s, e]
    );
    return rows;
  }

  const conv = await executeQuery(
    `SELECT COUNT(DISTINCT e.visitor_id) AS contact_conversions
     FROM events e
     WHERE e.event_type = 'form_submit'
       AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-book-call'
       AND e.occurred_at >= ? AND e.occurred_at < ?`,
    [s, e]
  );
  const total = await executeQuery(
    `SELECT COUNT(DISTINCT visitor_id) AS visitors FROM visitors WHERE first_seen_at >= ? AND first_seen_at < ?`,
    [s, e]
  );
  const conversions = (conv[0] && Number(conv[0].contact_conversions)) || 0;
  const visitors = (total[0] && Number(total[0].visitors)) || 0;
  const cvr = visitors ? Math.round(100 * conversions / visitors * 100) / 100 : 0;
  return { contact_conversions: conversions, visitors, contact_cvr_pct: cvr };
}

/**
 * Video views: event count and unique viewers. Optional groupBy utm.
 */
async function videoViews(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { video_events: 0, unique_viewers: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(*) AS video_events,
        COUNT(DISTINCT e.visitor_id) AS unique_viewers
      FROM events e
      JOIN visitors v ON v.visitor_id = e.visitor_id
      WHERE e.event_type IN ('video_play', 'video_ended', 'video_progress')
        AND e.occurred_at >= ? AND e.occurred_at < ?
      GROUP BY v.utm_source, v.utm_medium
      ORDER BY video_events DESC`,
      [s, e]
    );
    return rows;
  }

  const rows = await executeQuery(
    `SELECT
      COUNT(*) AS video_events,
      COUNT(DISTINCT visitor_id) AS unique_viewers
    FROM events
    WHERE event_type IN ('video_play', 'video_ended', 'video_progress')
      AND occurred_at >= ? AND occurred_at < ?`,
    [s, e]
  );
  return rows[0] || { video_events: 0, unique_viewers: 0 };
}

/**
 * Time on site: per-visitor max seconds from time_on_site events.
 * Returns aggregate (avg_seconds, visitors_with_time) or rows by UTM.
 */
async function timeOnSite(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { avg_seconds: 0, visitors_with_time: 0 };

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(DISTINCT secs.visitor_id) AS visitors_with_time,
        ROUND(AVG(secs.max_seconds), 0) AS avg_seconds
      FROM (
        SELECT visitor_id, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED)) AS max_seconds
        FROM events
        WHERE event_type = 'time_on_site' AND occurred_at >= ? AND occurred_at < ?
        GROUP BY visitor_id
      ) secs
      JOIN visitors v ON v.visitor_id = secs.visitor_id
      GROUP BY v.utm_source, v.utm_medium
      ORDER BY visitors_with_time DESC`,
      [s, e]
    );
    return rows;
  }

  const rows = await executeQuery(
    `SELECT
      COUNT(DISTINCT visitor_id) AS visitors_with_time,
      ROUND(AVG(max_seconds), 0) AS avg_seconds
    FROM (
      SELECT visitor_id, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED)) AS max_seconds
      FROM events
      WHERE event_type = 'time_on_site' AND occurred_at >= ? AND occurred_at < ?
      GROUP BY visitor_id
    ) x`,
    [s, e]
  );
  return rows[0] || { avg_seconds: 0, visitors_with_time: 0 };
}

/**
 * Bounce rate. Bounce = visitor has exactly one event in period OR max time_on_site < 30 seconds.
 * Returns overall or by referrer/UTM.
 */
async function bounceRate(start, end, opts = {}) {
  const { start: s, end: e } = normalizeRange(start, end);
  if (!s || !e) return opts.groupBy ? [] : { total_visitors: 0, bounces: 0, bounce_rate_pct: 0 };

  const bounceSubquery = `SELECT visitor_id
    FROM (
      SELECT visitor_id,
        COUNT(*) AS ev_count,
        MAX(CASE WHEN event_type = 'time_on_site' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED) ELSE 0 END) AS max_seconds
      FROM events
      WHERE occurred_at >= ? AND occurred_at < ?
      GROUP BY visitor_id
    ) x
    WHERE ev_count = 1 OR max_seconds < 30`;

  if (opts.groupBy === 'utm') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.referrer, '(direct)') AS referrer,
        COALESCE(v.utm_source, '') AS utm_source,
        COALESCE(v.utm_medium, '') AS utm_medium,
        COUNT(DISTINCT v.visitor_id) AS total_visitors,
        COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) AS bounces,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS bounce_rate_pct
      FROM visitors v
      LEFT JOIN (${bounceSubquery}) b ON b.visitor_id = v.visitor_id
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.referrer, v.utm_source, v.utm_medium
      ORDER BY total_visitors DESC`,
      [s, e, s, e]
    );
    return rows;
  }

  if (opts.groupBy === 'referrer') {
    const rows = await executeQuery(
      `SELECT
        COALESCE(v.referrer, '(direct)') AS referrer,
        COUNT(DISTINCT v.visitor_id) AS total_visitors,
        COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) AS bounces,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS bounce_rate_pct
      FROM visitors v
      LEFT JOIN (${bounceSubquery}) b ON b.visitor_id = v.visitor_id
      WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
      GROUP BY v.referrer
      ORDER BY total_visitors DESC`,
      [s, e, s, e]
    );
    return rows;
  }

  const rows = await executeQuery(
    `SELECT
      COUNT(DISTINCT v.visitor_id) AS total_visitors,
      COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) AS bounces,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS bounce_rate_pct
    FROM visitors v
    LEFT JOIN (${bounceSubquery}) b ON b.visitor_id = v.visitor_id
    WHERE v.first_seen_at >= ? AND v.first_seen_at < ?`,
    [s, e, s, e]
  );
  return rows[0] || { total_visitors: 0, bounces: 0, bounce_rate_pct: 0 };
}

/**
 * Run all report metrics for a date range. Optionally with drill-down.
 * @param {string|Date} start
 * @param {string|Date} end
 * @param {{ groupBy?: 'none'|'referrer'|'utm' }} opts
 */
async function runReport(start, end, opts = {}) {
  if (!isConfigured()) {
    return { error: 'Analytics DB not configured', metrics: {} };
  }
  const groupBy = opts.groupBy || 'none';
  const [overall, lm, wrv, contact, video, timeOnSiteResult, bounce] = await Promise.all([
    overallCvr(start, end, { groupBy }),
    lmCvr(start, end, { groupBy }),
    wrvCvr(start, end, { groupBy }),
    contactCvr(start, end, { groupBy }),
    videoViews(start, end, { groupBy }),
    timeOnSite(start, end, { groupBy }),
    bounceRate(start, end, { groupBy })
  ]);
  return {
    period: { start: toMysqlDatetime(start), end: toMysqlDatetime(end) },
    groupBy,
    metrics: {
      overall_cvr: overall,
      lm_cvr: lm,
      wrv_cvr: wrv,
      contact_cvr: contact,
      video_views: video,
      time_on_site: timeOnSiteResult,
      bounce_rate: bounce
    }
  };
}

module.exports = {
  overallCvr,
  lmCvr,
  wrvCvr,
  contactCvr,
  videoViews,
  timeOnSite,
  bounceRate,
  runReport,
  isConfigured: () => isConfigured()
};
