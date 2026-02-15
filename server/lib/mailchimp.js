const fetch = require('node-fetch');
const crypto = require('crypto');
const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_AUDIENCE_ID } = require('../config');

const BASE = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;

function isConfigured() {
  return !!(MAILCHIMP_API_KEY && MAILCHIMP_SERVER_PREFIX && MAILCHIMP_AUDIENCE_ID);
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from('anystring:' + MAILCHIMP_API_KEY).toString('base64')
  };
}

function subscriberHash(email) {
  return crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
}

/**
 * Add or update a contact in the audience with merge fields, then add a tag (without removing existing tags).
 * Use for both lead magnets (per-LM tag) and contact forms (e.g. "submitted website contact form").
 * @param {{ email: string, name?: string, source: string, mailchimp_tag?: string }} data - source = form id; mailchimp_tag = tag to apply (defaults to source)
 * @returns {{ success: boolean, error?: string }}
 */
async function addOrUpdateContact(data) {
  if (!isConfigured()) {
    return { success: false, error: 'Mailchimp not configured' };
  }
  const { email, name, source, mailchimp_tag } = data;
  const tag = (mailchimp_tag && String(mailchimp_tag).trim()) ? String(mailchimp_tag).trim() : source;
  const hash = subscriberHash(email);
  const memberUrl = `${BASE}/lists/${MAILCHIMP_AUDIENCE_ID}/members/${hash}`;
  const memberBody = {
    email_address: email.trim(),
    status_if_new: 'subscribed',
    merge_fields: { FNAME: (name || '').split(/\s+/)[0] || '', LNAME: (name || '').split(/\s+/).slice(1).join(' ') || '' }
    // Do not send tags here: we add via POST /tags so we don't overwrite existing tags (e.g. lead-magnet + contact-form).
  };
  try {
    const putRes = await fetch(memberUrl, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(memberBody)
    });
    if (!putRes.ok) {
      const errBody = await putRes.text();
      return { success: false, error: errBody || putRes.statusText };
    }
    const tagsUrl = `${BASE}/lists/${MAILCHIMP_AUDIENCE_ID}/members/${hash}/tags`;
    const tagsRes = await fetch(tagsUrl, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tags: [{ name: tag, status: 'active' }] })
    });
    if (!tagsRes.ok) {
      const errBody = await tagsRes.text();
      return { success: false, error: errBody || tagsRes.statusText };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { addOrUpdateContact, isConfigured };
