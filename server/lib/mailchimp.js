const fetch = require('node-fetch');
const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID } = require('../config');

const BASE = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;

function isConfigured() {
  return !!(MAILCHIMP_API_KEY && MAILCHIMP_SERVER_PREFIX && MAILCHIMP_AUDIENCE_ID);
}

/**
 * Add or update a contact in the audience with merge fields and a tag.
 * Tag is used by Mailchimp automations to send the correct lead-magnet email.
 * @param {{ email: string, name?: string, source: string }} data - source e.g. lead-50things
 * @returns {{ success: boolean, error?: string }}
 */
async function addOrUpdateContact(data) {
  if (!isConfigured()) {
    return { success: false, error: 'Mailchimp not configured' };
  }
  const { email, name, source } = data;
  const tag = source; // e.g. lead-50things
  const subscriberHash = require('crypto').createHash('md5').update(email.toLowerCase()).digest('hex');
  const url = `${BASE}/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;
  const body = {
    email_address: email,
    status_if_new: 'subscribed',
    merge_fields: { FNAME: (name || '').split(/\s+/)[0] || '', LNAME: (name || '').split(/\s+/).slice(1).join(' ') || '' },
    tags: [{ name: tag, status: 'active' }]
  };
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('anystring:' + MAILCHIMP_API_KEY).toString('base64')
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { success: false, error: errBody || res.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { addOrUpdateContact, isConfigured };
