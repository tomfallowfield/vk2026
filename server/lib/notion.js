const { Client } = require('@notionhq/client');
const { NOTION_TOKEN, NOTION_DATABASE_ID, SITE_BASE_URL } = require('../config');

let client = null;
if (NOTION_TOKEN) {
  client = new Client({ auth: NOTION_TOKEN });
}

function isConfigured() {
  return !!(NOTION_TOKEN && NOTION_DATABASE_ID);
}

/**
 * Create a Notion database page (row) for a submission.
 * Maps common fields to Notion properties. Property names must match your CRM.
 * @param {object} payload - full submission payload (type, form fields, visitor context, etc.)
 * @returns {{ success: boolean, error?: string }}
 */
async function createSubmissionPage(payload) {
  if (!client || !NOTION_DATABASE_ID) {
    return { success: false, error: 'Notion not configured' };
  }
  const type = payload.type || 'submission'; // book-a-call | website-review | lead
  const triggerType = payload.modal_trigger_type || null;
  const props = {
    Name: payload.name ? { title: [{ text: { content: String(payload.name).slice(0, 2000) } }] } : undefined,
    Email: payload.email ? { email: payload.email } : undefined,
    Type: type ? { select: { name: type } } : undefined,
    Source: payload.source || payload.form_id ? { rich_text: [{ text: { content: String(payload.source || payload.form_id || '').slice(0, 2000) } }] } : undefined,
    Trigger: triggerType ? { rich_text: [{ text: { content: String(triggerType).slice(0, 100) } }] } : undefined,
    'Submitted At': { date: { start: new Date().toISOString().slice(0, 10) } },
    'Source URL': SITE_BASE_URL ? { url: SITE_BASE_URL } : undefined,
    Message: payload.message ? { rich_text: [{ text: { content: String(payload.message).slice(0, 2000) } }] } : undefined,
    Website: payload.website ? { url: payload.website } : undefined,
    'LinkedIn URL': payload.linkedin_url ? { url: payload.linkedin_url } : undefined
  };
  const body = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {}
  };
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) body.properties[key] = value;
  }
  try {
    await client.pages.create(body);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = { createSubmissionPage, isConfigured };
