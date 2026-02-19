const mysql = require('mysql2/promise');
const config = require('../config');

const ALLOWED_EVENT_TYPES = new Set([
  'click',
  'video_play',
  'video_pause',
  'video_ended',
  'video_progress',
  'form_open',
  'form_submit',
  'faq_open',
  'scope_open',
  'easter_egg_star',
  'tc_open',
  'privacy_open',
  'cal_link_click',
  'time_on_site'
]);

let pool = null;

function getPool() {
  if (!config.DB_USER || !config.DB_NAME) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: config.DB_HOST,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
}

function isConfigured() {
  return !!(config.DB_USER && config.DB_NAME);
}

function isValidEventType(type) {
  return typeof type === 'string' && ALLOWED_EVENT_TYPES.has(type);
}

function truncate(str, maxLen) {
  if (str == null) return null;
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Upsert visitor (insert or update last_seen_at; set first_seen/referrer/utm on insert).
 * @param {object} conn - mysql2 connection
 * @param {object} params - { visitor_id, occurred_at, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content }
 */
async function upsertVisitor(conn, params) {
  const vid = truncate(params.visitor_id, 64);
  const at = params.occurred_at instanceof Date ? params.occurred_at : new Date(params.occurred_at);
  const ref = truncate(params.referrer, 512);
  const uSource = truncate(params.utm_source, 128);
  const uMedium = truncate(params.utm_medium, 128);
  const uCampaign = truncate(params.utm_campaign, 256);
  const uTerm = truncate(params.utm_term, 256);
  const uContent = truncate(params.utm_content, 256);

  await conn.execute(
    `INSERT INTO visitors (visitor_id, first_seen_at, last_seen_at, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seen_at = VALUES(last_seen_at)`,
    [vid, at, at, ref, uSource, uMedium, uCampaign, uTerm, uContent]
  );
}

/**
 * Insert one event.
 * @param {object} conn - mysql2 connection
 * @param {object} row - { visitor_id, event_type, occurred_at, page_url, referrer, utm_*, metadata }
 */
async function insertEvent(conn, row) {
  const metadataJson = row.metadata != null ? JSON.stringify(row.metadata) : null;
  await conn.execute(
    `INSERT INTO events (visitor_id, event_type, occurred_at, page_url, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      truncate(row.visitor_id, 64),
      truncate(row.event_type, 64),
      row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at),
      truncate(row.page_url, 512),
      truncate(row.referrer, 512),
      truncate(row.utm_source, 128),
      truncate(row.utm_medium, 128),
      truncate(row.utm_campaign, 256),
      truncate(row.utm_term, 256),
      truncate(row.utm_content, 256),
      metadataJson
    ]
  );
}

/**
 * Process payload: upsert visitor for first event, insert all events.
 * @param {object[]} events - array of { event_type, timestamp, page_url, referrer, utm_*, metadata }
 * @param {string} visitor_id
 * @returns {Promise<number>} number of events written
 */
async function writeEvents(events, visitor_id) {
  const p = getPool();
  if (!p || !visitor_id || !events || events.length === 0) return 0;

  const valid = events.filter(e => isValidEventType(e.event_type));
  if (valid.length === 0) return 0;

  const conn = await p.getConnection();
  try {
    const first = valid[0];
    const occurredAt = first.timestamp ? new Date(first.timestamp) : new Date();
    await upsertVisitor(conn, {
      visitor_id,
      occurred_at: occurredAt,
      referrer: first.referrer,
      utm_source: first.utm_source,
      utm_medium: first.utm_medium,
      utm_campaign: first.utm_campaign,
      utm_term: first.utm_term,
      utm_content: first.utm_content
    });

    for (const e of valid) {
      const occurredAtEv = e.timestamp ? new Date(e.timestamp) : new Date();
      await insertEvent(conn, {
        visitor_id,
        event_type: e.event_type,
        occurred_at: occurredAtEv,
        page_url: e.page_url,
        referrer: e.referrer,
        utm_source: e.utm_source,
        utm_medium: e.utm_medium,
        utm_campaign: e.utm_campaign,
        utm_term: e.utm_term,
        utm_content: e.utm_content,
        metadata: e.metadata && typeof e.metadata === 'object' ? e.metadata : null
      });
    }
    await conn.commit();
    return valid.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Enrich visitor with email/name.
 * @param {string} visitor_id
 * @param {object} data - { email, name }
 */
async function enrichVisitor(visitor_id, data) {
  const p = getPool();
  if (!p || !visitor_id) return false;
  const email = truncate(data.email, 255);
  const name = truncate(data.name, 255);
  await p.execute(
    'UPDATE visitors SET email = ?, name = ?, enriched_at = NOW() WHERE visitor_id = ?',
    [email || null, name || null, truncate(visitor_id, 64)]
  );
  return true;
}

module.exports = {
  isConfigured,
  isValidEventType,
  writeEvents,
  enrichVisitor,
  ALLOWED_EVENT_TYPES
};
