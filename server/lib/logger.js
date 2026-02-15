const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'submissions.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/**
 * Append one submission as a single NDJSON line (timestamp, endpoint, payload).
 * @param {string} endpoint - e.g. 'book-a-call', 'website-review', 'lead'
 * @param {object} payload - full payload (form data + visitor context + server fields)
 */
function logSubmission(endpoint, payload) {
  ensureLogDir();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    endpoint,
    ...payload
  }) + '\n';
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

module.exports = { logSubmission };
