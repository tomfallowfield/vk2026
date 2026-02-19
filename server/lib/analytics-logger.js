const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const EVENTS_LOG_FILE = path.join(LOG_DIR, 'events.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Append one analytics event as a single NDJSON line for tail -f.
 * @param {object} event - { ts, visitor_id, event_type, page_url, referrer, utm_*, metadata }
 */
function logEvent(event) {
  ensureLogDir();
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(EVENTS_LOG_FILE, line, 'utf8');
}

/**
 * Append multiple events (one line per event).
 * @param {object[]} events
 */
function logEvents(events) {
  if (!events || events.length === 0) return;
  ensureLogDir();
  const lines = events.map(e => JSON.stringify(e) + '\n').join('');
  fs.appendFileSync(EVENTS_LOG_FILE, lines, 'utf8');
}

module.exports = { logEvent, logEvents, EVENTS_LOG_FILE };
