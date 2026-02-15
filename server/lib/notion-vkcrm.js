/**
 * VKCRM Notion integration: create or update rows in the VKCRM database
 * for WRV requests and call bookings. De-duplicates by Website URL → LinkedIn URL → WRV (title).
 */
const { Client } = require('@notionhq/client');
const { NOTION_TOKEN, NOTION_DATABASE_ID } = require('../config');

const STATUS_WRV_REQUESTED = 'WRV Requested';
const STATUS_INCOMING_WEB_ENQUIRY = 'Incoming Web Enquiry';

let client = null;
if (NOTION_TOKEN) {
  client = new Client({ auth: NOTION_TOKEN });
}

function isConfigured() {
  return !!(NOTION_TOKEN && NOTION_DATABASE_ID);
}

/**
 * Normalise URL: trim, ensure https, strip trailing slash, optional strip tracking params.
 * @param {string} url
 * @returns {string|null} normalised URL or null if invalid/empty
 */
function normaliseUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  let s = url.trim();
  try {
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const u = new URL(s);
    u.searchParams.delete('utm_source');
    u.searchParams.delete('utm_medium');
    u.searchParams.delete('utm_campaign');
    u.searchParams.delete('utm_term');
    u.searchParams.delete('utm_content');
    u.searchParams.delete('fbclid');
    u.searchParams.delete('gclid');
    s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

/**
 * Build the WRV (title) value: full_name / name → company_name / company → fallback "Website lead - YYYY-MM-DD HH:mm"
 */
function wrvTitle(payload, submittedAt) {
  const name = (payload.full_name || payload.name || '').trim();
  if (name) return name.slice(0, 2000);
  const company = (payload.company_name || payload.company || '').trim();
  if (company) return company.slice(0, 2000);
  const d = submittedAt ? new Date(submittedAt) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `Website lead - ${dateStr}`;
}

/**
 * Build General notes block (single block of text per spec).
 * @param {object} payload - submission payload
 * @param {'wrv_request'|'call_booking'} submissionType
 * @param {string} submittedAt - ISO datetime
 * @param {object} [context] - optional _context (utm, referrer, etc.)
 * @param {boolean} [includeRawPayload] - include Raw payload JSON
 */
function buildGeneralNotes(payload, submissionType, submittedAt, context = {}, includeRawPayload = false) {
  const lines = [
    'Source: Website',
    submissionType === 'call_booking' ? 'Submission type: Call booking' : 'Submission type: WRV request',
    `Submitted at: ${submittedAt || new Date().toISOString()}`,
    `Name: ${(payload.full_name || payload.name || '').trim() || '—'}`,
    `Email: ${(payload.email || '').trim() || '—'}`,
    `Company: ${(payload.company_name || payload.company || '').trim() || '—'}`,
    `Website: ${(payload.website || '').trim() || '—'}`,
    `LinkedIn: ${(payload.linkedin_url || '').trim() || '—'}`
  ];
  const utm = context.utm_source || context.utm_medium || context.utm_campaign || context.utm_term || context.utm_content;
  if (utm || (context.utm_source && Object.keys(context).some(k => k.startsWith('utm_')))) {
    lines.push(`UTM: ${[context.utm_source, context.utm_medium, context.utm_campaign, context.utm_term, context.utm_content].filter(Boolean).join(', ') || '—'}`);
  }
  if (submissionType === 'call_booking') {
    if (payload.event) lines.push(`Event: ${payload.event}`);
    if (payload.start_time) lines.push(`Start time: ${payload.start_time}`);
    if (payload.timezone) lines.push(`Timezone: ${payload.timezone}`);
    if (payload.meeting_link) lines.push(`Meeting link: ${payload.meeting_link}`);
    if (payload.booking_id) lines.push(`Booking ID: ${payload.booking_id}`);
  }
  lines.push('Form fields:');
  const omit = new Set(['submission_type', 'submitted_at', 'full_name', 'name', 'email', 'company_name', 'company', 'website', 'linkedin_url', 'event', 'start_time', 'timezone', 'meeting_link', 'booking_id', '_context', '_server']);
  for (const [k, v] of Object.entries(payload)) {
    if (omit.has(k) || k.startsWith('_')) continue;
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      lines.push(`  ${k}: ${String(v).trim()}`);
    }
  }
  if (includeRawPayload) {
    try {
      lines.push('Raw payload: ' + JSON.stringify(payload));
    } catch (_) {}
  }
  return lines.join('\n');
}

/**
 * Extract plain text from a Notion rich_text property value (from API response).
 */
function richTextToPlain(prop) {
  if (!prop || !prop.rich_text) return '';
  return (prop.rich_text || []).map(t => t.plain_text || t.text?.content || '').join('');
}

/**
 * Find an existing page by Website URL, then LinkedIn URL, then WRV (title) case-insensitive.
 * @returns {Promise<string|null>} page id or null
 */
async function findExistingPage(normalisedWebsiteUrl, normalisedLinkedInUrl, wrvTitleValue) {
  if (!client || !NOTION_DATABASE_ID) return null;

  if (normalisedWebsiteUrl) {
    const res = await client.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'Website URL', url: { equals: normalisedWebsiteUrl } },
      page_size: 1
    });
    if (res.results && res.results.length > 0) return res.results[0].id;
  }

  if (normalisedLinkedInUrl) {
    const res = await client.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'LinkedIn URL', url: { equals: normalisedLinkedInUrl } },
      page_size: 1
    });
    if (res.results && res.results.length > 0) return res.results[0].id;
  }

  if (wrvTitleValue) {
    const res = await client.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'WRV', title: { equals: wrvTitleValue } },
      page_size: 20
    });
    if (res.results && res.results.length > 0) {
      const lower = wrvTitleValue.toLowerCase();
      const match = res.results.find(p => {
        const t = p.properties?.WRV?.title;
        const title = (t && t[0] && (t[0].plain_text || t[0].text?.content)) || '';
        return title.toLowerCase() === lower;
      });
      if (match) return match.id;
      return res.results[0].id;
    }
  }

  return null;
}

/**
 * Get current "General notes" content from a page (for appending on update).
 */
async function getCurrentGeneralNotes(pageId) {
  if (!client) return '';
  try {
    const page = await client.pages.retrieve({ page_id: pageId });
    const prop = page.properties?.['General notes'];
    return prop ? richTextToPlain(prop) : '';
  } catch {
    return '';
  }
}

/**
 * Create or update a VKCRM page.
 * @param {object} payload - { submission_type: 'wrv_request'|'call_booking', submitted_at, full_name/name, website, linkedin_url, email?, company_name?, ... }
 * @param {object} [context] - optional _context (utm_*, referrer, etc.)
 * @returns {{ success: boolean, error?: string }}
 */
async function createOrUpdateVkCrmPage(payload, context = {}) {
  if (!client || !NOTION_DATABASE_ID) {
    return { success: false, error: 'Notion VKCRM not configured' };
  }

  const submissionType = payload.submission_type === 'call_booking' ? 'call_booking' : 'wrv_request';
  const submittedAt = payload.submitted_at || new Date().toISOString();
  const title = wrvTitle(payload, submittedAt);
  const normalisedWebsite = normaliseUrl(payload.website);
  const normalisedLinkedIn = normaliseUrl(payload.linkedin_url);

  const existingId = await findExistingPage(normalisedWebsite, normalisedLinkedIn, title);
  let generalNotes = buildGeneralNotes(payload, submissionType, submittedAt, context, false);
  if (existingId) {
    const existingNotes = await getCurrentGeneralNotes(existingId);
    if (existingNotes.trim()) {
      generalNotes = existingNotes.trim() + '\n\n---\n\n' + generalNotes;
    }
  }

  const isDateTime = submittedAt.length > 10 && submittedAt.indexOf('T') !== -1;
  const dateStart = isDateTime ? submittedAt : submittedAt.slice(0, 10);

  const statusName = submissionType === 'call_booking' ? STATUS_INCOMING_WEB_ENQUIRY : STATUS_WRV_REQUESTED;

  const MAX_RICH_TEXT_CHARS = 2000;
  const richTextBlocks = [];
  for (let i = 0; i < generalNotes.length; i += MAX_RICH_TEXT_CHARS) {
    richTextBlocks.push({ type: 'text', text: { content: generalNotes.slice(i, i + MAX_RICH_TEXT_CHARS) } });
  }
  if (richTextBlocks.length === 0) richTextBlocks.push({ type: 'text', text: { content: '' } });

  const properties = {
    WRV: { title: [{ text: { content: title.slice(0, 2000) } }] },
    'Website URL': normalisedWebsite ? { url: normalisedWebsite } : undefined,
    'LinkedIn URL': normalisedLinkedIn ? { url: normalisedLinkedIn } : undefined,
    'WRV requested': {
      date: {
        start: dateStart,
        ...(isDateTime ? { end: null, time_zone: null } : {})
      }
    },
    'Lead source': { multi_select: [{ name: 'website' }] },
    Status: { status: { name: statusName } },
    'General notes': { rich_text: richTextBlocks }
  };

  const body = { properties: {} };
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) body.properties[key] = value;
  }

  try {
    if (existingId) {
      await client.pages.update({ page_id: existingId, ...body });
    } else {
      body.parent = { database_id: NOTION_DATABASE_ID };
      await client.pages.create(body);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  createOrUpdateVkCrmPage,
  isConfigured: isConfigured,
  normaliseUrl,
  wrvTitle,
  buildGeneralNotes
};
