const express = require('express');
const router = express.Router();
const { writeEvents, enrichVisitor, getRecentEvents, isConfigured, isValidEventType } = require('../lib/analytics-db');
const { logEvents } = require('../lib/analytics-logger');

const MAX_EVENTS_PER_REQUEST = 20;

/**
 * GET /events?limit=200&view_key=...
 * Returns recent events (newest first) for demo/viewer. Requires MySQL. If DEMO_VIEW_KEY is set in env, ?view_key must match.
 */
router.get('/events', async (req, res) => {
  const viewKey = process.env.DEMO_VIEW_KEY || '';
  if (viewKey && req.query.view_key !== viewKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isConfigured()) {
    return res.status(200).json([]);
  }
  try {
    const events = await getRecentEvents(req.query.limit);
    res.set('Cache-Control', 'no-store');
    res.json(events);
  } catch (err) {
    console.error('Analytics getRecentEvents:', err.message);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

/**
 * POST /events
 * Body: { visitor_id: string, events: [{ event_type, timestamp?, page_url?, referrer?, utm_source?, utm_medium?, utm_campaign?, utm_term?, utm_content?, metadata? }, ...] }
 * Mounted at /vk2026/api/analytics so full path is POST /vk2026/api/analytics/events
 */
router.post('/events', async (req, res) => {
  const visitor_id = req.body && typeof req.body.visitor_id === 'string' ? req.body.visitor_id.trim() : null;
  const events = Array.isArray(req.body?.events) ? req.body.events : [];

  if (!visitor_id || visitor_id.length > 64) {
    return res.status(400).json({ error: 'Missing or invalid visitor_id' });
  }
  if (events.length === 0 || events.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(400).json({ error: 'events must be a non-empty array (max ' + MAX_EVENTS_PER_REQUEST + ')' });
  }

  const valid = events.filter(e => isValidEventType(e && e.event_type));
  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid event_type in events' });
  }

  if (!isConfigured()) {
    // No DB: still log to file, return 204
    const logLines = valid.map(e => ({
      ts: new Date().toISOString(),
      visitor_id,
      event_type: e.event_type,
      timestamp: e.timestamp,
      page_url: e.page_url,
      referrer: e.referrer,
      utm_source: e.utm_source,
      utm_medium: e.utm_medium,
      utm_campaign: e.utm_campaign,
      utm_term: e.utm_term,
      utm_content: e.utm_content,
      metadata: e.metadata
    }));
    logEvents(logLines);
    return res.status(204).end();
  }

  try {
    await writeEvents(valid, visitor_id);
  } catch (err) {
    console.error('Analytics writeEvents:', err.message);
    // Still log to file on DB error
    const logLines = valid.map(e => ({
      ts: new Date().toISOString(),
      visitor_id,
      event_type: e.event_type,
      timestamp: e.timestamp,
      page_url: e.page_url,
      referrer: e.referrer,
      utm_source: e.utm_source,
      utm_medium: e.utm_medium,
      utm_campaign: e.utm_campaign,
      utm_term: e.utm_term,
      utm_content: e.utm_content,
      metadata: e.metadata,
      _error: err.message
    }));
    logEvents(logLines);
    return res.status(500).json({ error: 'Failed to store events' });
  }

  // Append to events.log for tail -f
  const logLines = valid.map(e => ({
    ts: new Date().toISOString(),
    visitor_id,
    event_type: e.event_type,
    timestamp: e.timestamp,
    page_url: e.page_url,
    referrer: e.referrer,
    utm_source: e.utm_source,
    utm_medium: e.utm_medium,
    utm_campaign: e.utm_campaign,
    utm_term: e.utm_term,
    utm_content: e.utm_content,
    metadata: e.metadata
  }));
  logEvents(logLines);

  res.status(204).end();
});

/**
 * PATCH /visitors/:visitor_id
 * Body: { email?: string, name?: string }
 * Used server-side when a form with email is submitted (enrich visitor record).
 */
router.patch('/visitors/:visitor_id', async (req, res) => {
  const visitor_id = req.params.visitor_id && req.params.visitor_id.trim();
  if (!visitor_id) {
    return res.status(400).json({ error: 'Missing visitor_id' });
  }

  if (!isConfigured()) {
    return res.status(204).end();
  }

  const email = req.body && typeof req.body.email === 'string' ? req.body.email.trim() : null;
  const name = req.body && typeof req.body.name === 'string' ? req.body.name.trim() : null;
  if (!email && !name) {
    return res.status(400).json({ error: 'Provide email and/or name' });
  }

  try {
    await enrichVisitor(visitor_id, { email, name });
  } catch (err) {
    console.error('Analytics enrichVisitor:', err.message);
    return res.status(500).json({ error: 'Failed to update visitor' });
  }
  res.status(204).end();
});

module.exports = router;
