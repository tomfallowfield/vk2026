const express = require('express');
const router = express.Router();
const { executeQuery, isConfigured } = require('../lib/analytics-db');
const { evaluateFunnel } = require('../lib/funnel');
const { disambiguateDisplayNames } = require('../lib/display-name');

/**
 * GET /visitors?limit=50&offset=0
 * Returns visitor cards with display name, visit count, funnel state, last_seen, converted flag.
 */
router.get('/visitors', async (req, res) => {
  if (!isConfigured()) return res.json({ visitors: [], total: 0 });

  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 200);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

  try {
    // Get visitors sorted by last_seen_at desc
    const visitors = await executeQuery(
      `SELECT v.visitor_id, v.name, v.email, v.enriched_at, v.first_seen_at, v.last_seen_at,
              v.device_display, v.browser_display, v.location_display,
              v.referrer, v.utm_source
       FROM visitors v
       ORDER BY v.last_seen_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [countRow] = await executeQuery('SELECT COUNT(*) AS total FROM visitors');
    const total = countRow ? countRow.total : 0;

    if (visitors.length === 0) return res.json({ visitors: [], total });

    // Get visit counts (distinct dates) and event types per visitor
    const vids = visitors.map(v => v.visitor_id);
    const placeholders = vids.map(() => '?').join(',');

    const visitCounts = await executeQuery(
      `SELECT visitor_id, COUNT(DISTINCT DATE(occurred_at)) AS visit_count
       FROM events WHERE visitor_id IN (${placeholders})
       GROUP BY visitor_id`,
      vids
    );
    const visitCountMap = {};
    for (const r of visitCounts) visitCountMap[r.visitor_id] = r.visit_count;

    const eventTypes = await executeQuery(
      `SELECT visitor_id, GROUP_CONCAT(DISTINCT event_type) AS types
       FROM events WHERE visitor_id IN (${placeholders})
       GROUP BY visitor_id`,
      vids
    );
    const eventTypeMap = {};
    for (const r of eventTypes) eventTypeMap[r.visitor_id] = (r.types || '').split(',');

    // Build response
    const result = visitors.map(v => {
      const types = eventTypeMap[v.visitor_id] || [];
      const funnel = evaluateFunnel(types);
      return {
        visitor_id: v.visitor_id,
        name: v.name,
        email: v.email,
        enriched_at: v.enriched_at,
        first_seen_at: v.first_seen_at,
        last_seen_at: v.last_seen_at,
        device_display: v.device_display,
        browser_display: v.browser_display,
        location_display: v.location_display,
        referrer: v.referrer,
        utm_source: v.utm_source,
        visit_count: visitCountMap[v.visitor_id] || 1,
        converted: !!(v.enriched_at || v.email),
        funnel
      };
    });

    disambiguateDisplayNames(result);
    res.json({ visitors: result, total });
  } catch (err) {
    console.error('Dashboard /visitors:', err.message);
    res.status(500).json({ error: 'Failed to load visitors' });
  }
});

/**
 * GET /visitors/:visitor_id
 * Returns full visitor detail + event timeline.
 */
router.get('/visitors/:visitor_id', async (req, res) => {
  if (!isConfigured()) return res.status(404).json({ error: 'Not found' });

  const vid = req.params.visitor_id;
  try {
    const [visitor] = await executeQuery(
      `SELECT visitor_id, name, email, enriched_at, first_seen_at, last_seen_at,
              device_display, browser_display, location_display,
              referrer, utm_source, utm_medium, utm_campaign
       FROM visitors WHERE visitor_id = ?`,
      [vid]
    );
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });

    const events = await executeQuery(
      `SELECT id, event_type, occurred_at, page_url, metadata
       FROM events WHERE visitor_id = ?
       ORDER BY occurred_at DESC
       LIMIT 500`,
      [vid]
    );

    // Parse metadata JSON
    for (const e of events) {
      if (e.metadata && typeof e.metadata === 'string') {
        try { e.metadata = JSON.parse(e.metadata); } catch { e.metadata = null; }
      }
    }

    const types = [...new Set(events.map(e => e.event_type))];
    const funnel = evaluateFunnel(types);

    const [countRow] = await executeQuery(
      'SELECT COUNT(DISTINCT DATE(occurred_at)) AS visit_count FROM events WHERE visitor_id = ?',
      [vid]
    );

    res.json({
      ...visitor,
      visit_count: countRow ? countRow.visit_count : 1,
      converted: !!(visitor.enriched_at || visitor.email),
      funnel,
      events
    });
  } catch (err) {
    console.error('Dashboard /visitors/:id:', err.message);
    res.status(500).json({ error: 'Failed to load visitor' });
  }
});

/**
 * GET /conversion?period_type=week&periods=12
 * Returns CVR stats and time-series data.
 */
router.get('/conversion', async (req, res) => {
  if (!isConfigured()) return res.json({ stats: {}, series: [] });

  const periodType = req.query.period_type === 'month' ? 'month' : 'week';
  const periods = Math.min(Math.max(1, parseInt(req.query.periods, 10) || 12), 52);

  try {
    // Overall stats
    const [allTime] = await executeQuery(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS converted
       FROM visitors`
    );

    const [thisMonth] = await executeQuery(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS converted
       FROM visitors
       WHERE first_seen_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );

    // Week = last 7 days
    const [thisWeek] = await executeQuery(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS converted
       FROM visitors
       WHERE first_seen_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
    );

    const cvr = (conv, tot) => tot > 0 ? Math.round((conv / tot) * 1000) / 10 : 0;

    const stats = {
      all_time: { total: allTime.total, converted: allTime.converted, rate: cvr(allTime.converted, allTime.total) },
      this_month: { total: thisMonth.total, converted: thisMonth.converted, rate: cvr(thisMonth.converted, thisMonth.total) },
      this_week: { total: thisWeek.total, converted: thisWeek.converted, rate: cvr(thisWeek.converted, thisWeek.total) }
    };

    // Time series
    let series;
    if (periodType === 'week') {
      series = await executeQuery(
        `SELECT YEARWEEK(first_seen_at, 3) AS period,
                MIN(DATE(first_seen_at)) AS period_start,
                COUNT(*) AS total,
                SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS converted
         FROM visitors
         WHERE first_seen_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
         GROUP BY YEARWEEK(first_seen_at, 3)
         ORDER BY period`,
        [periods]
      );
    } else {
      series = await executeQuery(
        `SELECT DATE_FORMAT(first_seen_at, '%Y-%m') AS period,
                MIN(DATE(first_seen_at)) AS period_start,
                COUNT(*) AS total,
                SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS converted
         FROM visitors
         WHERE first_seen_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         GROUP BY DATE_FORMAT(first_seen_at, '%Y-%m')
         ORDER BY period`,
        [periods]
      );
    }

    for (const s of series) {
      s.rate = cvr(s.converted, s.total);
    }

    res.json({ stats, series, period_type: periodType });
  } catch (err) {
    console.error('Dashboard /conversion:', err.message);
    res.status(500).json({ error: 'Failed to load conversion data' });
  }
});

/**
 * GET /annotations
 */
router.get('/annotations', async (req, res) => {
  if (!isConfigured()) return res.json([]);
  try {
    const rows = await executeQuery(
      'SELECT id, period, period_type, note, created_at FROM vk_annotations ORDER BY period DESC'
    );
    res.json(rows);
  } catch (err) {
    // Table might not exist yet
    if (err.code === 'ER_NO_SUCH_TABLE' || (err.message && err.message.includes("doesn't exist"))) {
      return res.json([]);
    }
    console.error('Dashboard /annotations:', err.message);
    res.status(500).json({ error: 'Failed to load annotations' });
  }
});

/**
 * POST /annotations { period, period_type, note }
 */
router.post('/annotations', async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'DB not configured' });

  const { period, period_type, note } = req.body || {};
  if (!period || !note || !['week', 'month'].includes(period_type)) {
    return res.status(400).json({ error: 'period, period_type (week|month), and note are required' });
  }

  try {
    await executeQuery(
      'INSERT INTO vk_annotations (period, period_type, note) VALUES (?, ?, ?)',
      [String(period).slice(0, 20), period_type, String(note).slice(0, 500)]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Dashboard POST /annotations:', err.message);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

/**
 * DELETE /annotations/:id
 */
router.delete('/annotations/:id', async (req, res) => {
  if (!isConfigured()) return res.status(503).json({ error: 'DB not configured' });

  const id = parseInt(req.params.id, 10);
  if (!id || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  try {
    await executeQuery('DELETE FROM vk_annotations WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error('Dashboard DELETE /annotations:', err.message);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

module.exports = router;
