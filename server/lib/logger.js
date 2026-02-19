const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'submissions.log');
const FORM_SUBMISSIONS_LOG_FILE = path.join(LOG_DIR, 'form-submissions.log');

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

/**
 * Append one form submission to form-submissions.log (all form submissions in one place).
 * Format: timestamp | email | from_type | json_obj_all_form_data
 * @param {string} timestamp - ISO timestamp
 * @param {string} email - submitter email (or '')
 * @param {string} fromType - e.g. 'book-a-call', 'website-review', 'lead'
 * @param {object} formData - full form payload (all fields) to log as JSON
 */
function logFormSubmissionLine(timestamp, email, fromType, formData) {
  ensureLogDir();
  const json = JSON.stringify(formData);
  const line = `${timestamp} | ${email} | ${fromType} | ${json}\n`;
  fs.appendFileSync(FORM_SUBMISSIONS_LOG_FILE, line, 'utf8');
}

module.exports = { logSubmission, logFormSubmissionLine, FORM_SUBMISSIONS_LOG_FILE };
