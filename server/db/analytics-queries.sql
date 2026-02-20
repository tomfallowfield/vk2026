-- Analytics report queries (use with date range params: ?start, ?end).
-- Bounce definition: visitor has only one event in period OR max time_on_site seconds < 30.
-- Form IDs: form-website-review (WRV), form-book-call (contact), form-lead-50things, form-lead-offboarding, form-lead-socialproof (LM).

-- ---------------------------------------------------------------------------
-- 1. Overall CVR (visitor-level, optional group by first-touch referrer/UTM)
-- Conversion = visitor has email (enriched) or at least one form_submit in events.
-- ---------------------------------------------------------------------------

-- Overall (no breakdown): total visitors, conversions, CVR in period
-- Params: start, end (DATETIME or DATE)
/*
SELECT
  COUNT(DISTINCT v.visitor_id) AS total_visitors,
  COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) AS conversions,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN v.email IS NOT NULL AND v.email != '' THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS cvr_pct
FROM visitors v
WHERE v.first_seen_at >= ? AND v.first_seen_at < ?;
*/

-- By first-touch UTM (referrer available in SELECT for grouping)
/*
SELECT
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
ORDER BY total_visitors DESC;
*/

-- ---------------------------------------------------------------------------
-- 2. LM CVR (form_submit with form_id like form-lead-%)
-- ---------------------------------------------------------------------------

-- LM conversions count (unique visitors who submitted any lead-magnet form)
/*
SELECT COUNT(DISTINCT e.visitor_id) AS lm_conversions
FROM events e
WHERE e.event_type = 'form_submit'
  AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) LIKE 'form-lead-%'
  AND e.occurred_at >= ? AND e.occurred_at < ?;
*/

-- LM CVR by first-touch UTM (visitors who opened LM form as denominator would need form_open; here denominator = all visitors in period)
/*
SELECT
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
ORDER BY visitors DESC;
*/

-- ---------------------------------------------------------------------------
-- 3. WRV CVR (form_submit with form_id = 'form-website-review')
-- ---------------------------------------------------------------------------

/*
SELECT COUNT(DISTINCT e.visitor_id) AS wrv_conversions
FROM events e
WHERE e.event_type = 'form_submit'
  AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-website-review'
  AND e.occurred_at >= ? AND e.occurred_at < ?;
*/

-- ---------------------------------------------------------------------------
-- 4. Contact CVR (form_submit with form_id = 'form-book-call')
-- ---------------------------------------------------------------------------

/*
SELECT COUNT(DISTINCT e.visitor_id) AS contact_conversions
FROM events e
WHERE e.event_type = 'form_submit'
  AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.form_id')) = 'form-book-call'
  AND e.occurred_at >= ? AND e.occurred_at < ?;
*/

-- ---------------------------------------------------------------------------
-- 5. Video views (event count and unique visitors; optional video_label filter)
-- ---------------------------------------------------------------------------

/*
SELECT
  COUNT(*) AS video_events,
  COUNT(DISTINCT visitor_id) AS unique_viewers
FROM events
WHERE event_type IN ('video_play', 'video_ended', 'video_progress')
  AND occurred_at >= ? AND occurred_at < ?;
*/

-- By first-touch UTM
/*
SELECT
  COALESCE(v.utm_source, '') AS utm_source,
  COALESCE(v.utm_medium, '') AS utm_medium,
  COUNT(*) AS video_events,
  COUNT(DISTINCT e.visitor_id) AS unique_viewers
FROM events e
JOIN visitors v ON v.visitor_id = e.visitor_id
WHERE e.event_type IN ('video_play', 'video_ended', 'video_progress')
  AND e.occurred_at >= ? AND e.occurred_at < ?
GROUP BY v.utm_source, v.utm_medium
ORDER BY video_events DESC;
*/

-- ---------------------------------------------------------------------------
-- 6. Time on site (from time_on_site events, metadata.seconds)
-- ---------------------------------------------------------------------------

-- Per-visitor max seconds in period, then we can AVG in app
/*
SELECT
  e.visitor_id,
  MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(e.metadata, '$.seconds')) AS UNSIGNED)) AS max_seconds
FROM events e
WHERE e.event_type = 'time_on_site'
  AND e.occurred_at >= ? AND e.occurred_at < ?
GROUP BY e.visitor_id;
*/

-- Aggregate: avg time on site (seconds) by first-touch UTM
/*
SELECT
  COALESCE(v.utm_source, '') AS utm_source,
  COALESCE(v.utm_medium, '') AS utm_medium,
  COUNT(DISTINCT e.visitor_id) AS visitors_with_time,
  ROUND(AVG(secs.max_seconds), 0) AS avg_seconds
FROM (
  SELECT visitor_id, MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED)) AS max_seconds
  FROM events
  WHERE event_type = 'time_on_site' AND occurred_at >= ? AND occurred_at < ?
  GROUP BY visitor_id
) secs
JOIN events e ON e.visitor_id = secs.visitor_id AND e.occurred_at >= ? AND e.occurred_at < ?
JOIN visitors v ON v.visitor_id = e.visitor_id
GROUP BY v.utm_source, v.utm_medium
ORDER BY visitors_with_time DESC;
*/

-- ---------------------------------------------------------------------------
-- 7. Bounce rate (bounce = single event in period OR max time_on_site < 30 seconds)
-- ---------------------------------------------------------------------------

-- Overall bounce rate in period
/*
SELECT
  COUNT(DISTINCT v.visitor_id) AS total_visitors,
  COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) AS bounces,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS bounce_rate_pct
FROM visitors v
LEFT JOIN (
  SELECT visitor_id
  FROM (
    SELECT visitor_id,
      COUNT(*) AS ev_count,
      MAX(CASE WHEN event_type = 'time_on_site' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED) ELSE 0 END) AS max_seconds
    FROM events
    WHERE occurred_at >= ? AND occurred_at < ?
    GROUP BY visitor_id
  ) x
  WHERE ev_count = 1 OR max_seconds < 30
) b ON b.visitor_id = v.visitor_id
WHERE v.first_seen_at >= ? AND v.first_seen_at < ?;
*/

-- Bounce rate by first-touch referrer/UTM
/*
SELECT
  COALESCE(v.referrer, '(direct)') AS referrer,
  COALESCE(v.utm_source, '') AS utm_source,
  COALESCE(v.utm_medium, '') AS utm_medium,
  COUNT(DISTINCT v.visitor_id) AS total_visitors,
  COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) AS bounces,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN b.visitor_id IS NOT NULL THEN v.visitor_id END) / NULLIF(COUNT(DISTINCT v.visitor_id), 0), 2) AS bounce_rate_pct
FROM visitors v
LEFT JOIN (
  SELECT visitor_id
  FROM (
    SELECT visitor_id,
      COUNT(*) AS ev_count,
      MAX(CASE WHEN event_type = 'time_on_site' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.seconds')) AS UNSIGNED) ELSE 0 END) AS max_seconds
    FROM events
    WHERE occurred_at >= ? AND occurred_at < ?
    GROUP BY visitor_id
  ) x
  WHERE ev_count = 1 OR max_seconds < 30
) b ON b.visitor_id = v.visitor_id
WHERE v.first_seen_at >= ? AND v.first_seen_at < ?
GROUP BY v.referrer, v.utm_source, v.utm_medium
ORDER BY total_visitors DESC;
*/
