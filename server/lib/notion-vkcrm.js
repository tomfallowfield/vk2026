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
 * @param {object} [context] - optional _context (utm, referrer, buttons_clicked, videos_watched, etc.)
 * @param {boolean} [includeRawPayload] - include Raw payload JSON
 * @param {boolean} [isUpdate] - true if this submission updated an existing record
 * @param {string} [matchedBy] - how we matched: 'website_url' | 'linkedin_url' | 'wrv_title'
 */
function formatTs(ts) {
  if (ts == null) return '—';
  const d = new Date(typeof ts === 'number' && ts < 1e12 ? ts : ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function buildSessionTimeline(context, submittedAt, submissionType) {
  const events = [];
  const firstVisit = context.first_visit_ts;
  if (firstVisit != null) {
    const ref = (context.first_referrer || '').trim() || 'direct';
    events.push({ ts: typeof firstVisit === 'number' ? firstVisit : new Date(firstVisit).getTime(), line: `First visit to website (from: ${ref})` });
  }
  const buttons = context.buttons_clicked;
  if (buttons && Array.isArray(buttons)) {
    buttons.forEach(b => {
      const ts = b.ts != null ? (typeof b.ts === 'number' ? b.ts : new Date(b.ts).getTime()) : null;
      if (ts == null) return;
      const id = (b.id || '').trim() || '—';
      const modal = (b.modal || '').trim() || '—';
      events.push({ ts, line: `Clicked ${id} (opened ${modal})` });
    });
  }
  const videos = context.videos_watched;
  if (videos && Array.isArray(videos) && videos.length > 0) {
    videos.forEach(v => {
      const name = v.name || v.src || '—';
      const evs = v.events && Array.isArray(v.events) ? v.events : [];
      evs.forEach(ev => {
        const ts = ev.ts != null ? (typeof ev.ts === 'number' ? ev.ts : new Date(ev.ts).getTime()) : null;
        if (ts == null) return;
        const pct = ev.pct != null ? ev.pct + '%' : '—';
        if (ev.type === 'start') {
          events.push({ ts, line: `Started ${name}` });
        } else if (ev.type === 'pause') {
          events.push({ ts, line: `Paused ${name} at ${pct}` });
        } else if (ev.type === 'ended') {
          events.push({ ts, line: `Finished ${name} (${pct})` });
        }
      });
      if (evs.length === 0 && (v.max_pct != null || v.progress_pct != null)) {
        const pct = (v.max_pct != null ? v.max_pct : v.progress_pct) + '%';
        const subMs = submittedAt ? new Date(submittedAt).getTime() : Date.now();
        events.push({ ts: subMs, line: `Watched ${name}: ${pct}` });
      }
    });
  }
  const subTs = submittedAt ? new Date(submittedAt).getTime() : Date.now();
  const subLabel = submissionType === 'call_booking' ? 'Book a call form submitted' : 'WRV requested';
  events.push({ ts: subTs, line: subLabel });
  events.sort((a, b) => a.ts - b.ts);
  return events.map(e => `[${formatTs(e.ts)}] ${e.line}`);
}

function buildGeneralNotes(payload, submissionType, submittedAt, context = {}, includeRawPayload = false, isUpdate = false, matchedBy = '') {
  const lines = [];
  if (isUpdate && matchedBy) {
    const label = matchedBy === 'website_url' ? 'Website URL' : matchedBy === 'linkedin_url' ? 'LinkedIn URL' : 'WRV (name)';
    lines.push(`Record: update (matched existing by ${label}).`);
    lines.push('');
  }
  const timeline = buildSessionTimeline(context, submittedAt, submissionType);
  if (timeline.length > 0) {
    lines.push('Session timeline:');
    timeline.forEach(t => lines.push('  ' + t));
    lines.push('');
  }
  lines.push('Source: Website');
  lines.push(submissionType === 'call_booking' ? 'Submission type: Call booking' : 'Submission type: WRV request');
  lines.push(`Submitted at: ${submittedAt || new Date().toISOString()}`);
  lines.push(`Form ID: ${(payload.form_id || '').trim() || '—'}`);
  lines.push(`Trigger button ID: ${(payload.trigger_button_id || '').trim() || '—'}`);
  lines.push(`Modal trigger type: ${(payload.modal_trigger_type || '').trim() || '—'}`);
  if (context.buttons_clicked && Array.isArray(context.buttons_clicked) && context.buttons_clicked.length > 0) {
    lines.push('Buttons clicked this session: ' + context.buttons_clicked.map(b => (b.id || b.modal || '') + (b.modal ? ' (' + b.modal + ')' : '')).filter(Boolean).join(', ') || '—');
  }
  lines.push(`Name: ${(payload.full_name || payload.name || '').trim() || '—'}`);
  lines.push(`Email: ${(payload.email || '').trim() || '—'}`);
  lines.push(`Company: ${(payload.company_name || payload.company || '').trim() || '—'}`);
  lines.push(`Website: ${(payload.website || '').trim() || '—'}`);
  lines.push(`LinkedIn: ${(payload.linkedin_url || '').trim() || '—'}`);
  const utm = context.utm_source || context.utm_medium || context.utm_campaign || context.utm_term || context.utm_content;
  if (utm || (context.utm_source && Object.keys(context).some(k => k.startsWith('utm_')))) {
    lines.push(`UTM (this page): ${[context.utm_source, context.utm_medium, context.utm_campaign, context.utm_term, context.utm_content].filter(Boolean).join(', ') || '—'}`);
  }
  const firstUtm = context.first_visit_utm;
  if (firstUtm && typeof firstUtm === 'object') {
    const parts = [firstUtm.utm_source, firstUtm.utm_medium, firstUtm.utm_campaign, firstUtm.utm_term, firstUtm.utm_content].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`First visit UTM: ${parts.join(', ')}`);
    }
  }
  if (context.videos_watched && Array.isArray(context.videos_watched) && context.videos_watched.length > 0) {
    lines.push('Videos watched (play history):');
    context.videos_watched.forEach(v => {
      const name = v.name || v.src || '—';
      const maxPct = v.max_pct != null ? v.max_pct + '%' : (v.progress_pct != null ? v.progress_pct + '%' : '—');
      lines.push(`  ${name}: max ${maxPct}`);
      const evs = v.events && Array.isArray(v.events) ? v.events : [];
      evs.forEach(ev => {
        const ts = formatTs(ev.ts);
        const pct = ev.pct != null ? ev.pct + '%' : '—';
        if (ev.type === 'start') lines.push(`    start ${ts}`);
        else if (ev.type === 'pause') lines.push(`    pause at ${pct} ${ts}`);
        else if (ev.type === 'ended') lines.push(`    finished ${ts}`);
      });
    });
  }
  if (submissionType === 'call_booking') {
    if (payload.event) lines.push(`Event: ${payload.event}`);
    if (payload.start_time) lines.push(`Start time: ${payload.start_time}`);
    if (payload.timezone) lines.push(`Timezone: ${payload.timezone}`);
    if (payload.meeting_link) lines.push(`Meeting link: ${payload.meeting_link}`);
    if (payload.booking_id) lines.push(`Booking ID: ${payload.booking_id}`);
  }
  lines.push('Form fields:');
  const omit = new Set(['submission_type', 'submitted_at', 'full_name', 'name', 'email', 'company_name', 'company', 'website', 'linkedin_url', 'event', 'start_time', 'timezone', 'meeting_link', 'booking_id', 'form_id', 'trigger_button_id', 'modal_trigger_type', '_context', '_server']);
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

/** Max characters per Notion rich_text item (API limit). */
const RICH_TEXT_CHUNK = 2000;

/**
 * Convert notes string into Notion block children for page body (paragraphs).
 * @param {string} notesText
 * @returns {Array<{ type: string, paragraph?: { rich_text: Array<{ type: string, text: { content: string } }> }, divider?: object }>}
 */
function notesToBodyBlocks(notesText) {
  if (!notesText || typeof notesText !== 'string') return [];
  const blocks = [];
  for (let i = 0; i < notesText.length; i += RICH_TEXT_CHUNK) {
    const content = notesText.slice(i, i + RICH_TEXT_CHUNK);
    blocks.push({
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content } }]
      }
    });
  }
  return blocks.length ? blocks : [];
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
 * @returns {Promise<{ id: string, matchedBy: string }|null>} page id and match reason, or null
 */
async function findExistingPage(normalisedWebsiteUrl, normalisedLinkedInUrl, wrvTitleValue) {
  if (!client || !NOTION_DATABASE_ID) return null;

  if (normalisedWebsiteUrl) {
    const res = await client.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'Website URL', url: { equals: normalisedWebsiteUrl } },
      page_size: 1
    });
    if (res.results && res.results.length > 0) return { id: res.results[0].id, matchedBy: 'website_url' };
  }

  if (normalisedLinkedInUrl) {
    const res = await client.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: { property: 'LinkedIn URL', url: { equals: normalisedLinkedInUrl } },
      page_size: 1
    });
    if (res.results && res.results.length > 0) return { id: res.results[0].id, matchedBy: 'linkedin_url' };
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
      const page = match || res.results[0];
      return { id: page.id, matchedBy: 'wrv_title' };
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

  const existing = await findExistingPage(normalisedWebsite, normalisedLinkedIn, title);
  const existingId = existing ? existing.id : null;
  const isUpdate = !!existingId;
  const matchedBy = existing ? existing.matchedBy : '';
  const payloadWithTrigger = {
    ...payload,
    form_id: payload.form_id || context.form_id,
    trigger_button_id: payload.trigger_button_id || context.trigger_button_id,
    modal_trigger_type: payload.modal_trigger_type || context.modal_trigger_type
  };
  const notesForBody = buildGeneralNotes(payloadWithTrigger, submissionType, submittedAt, context, false, isUpdate, matchedBy);
  const bodyBlocks = notesToBodyBlocks(notesForBody);

  const isDateTime = submittedAt.length > 10 && submittedAt.indexOf('T') !== -1;
  const dateStart = isDateTime ? submittedAt : submittedAt.slice(0, 10);

  const statusName = submissionType === 'call_booking' ? STATUS_INCOMING_WEB_ENQUIRY : STATUS_WRV_REQUESTED;

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
    'General notes': { rich_text: [{ type: 'text', text: { content: '' } }] }
  };

  const body = { properties: {} };
  for (const [key, value] of Object.entries(properties)) {
    if (value !== undefined) body.properties[key] = value;
  }

  try {
    if (existingId) {
      await client.pages.update({ page_id: existingId, ...body });
      if (bodyBlocks.length > 0) {
        const appendChildren = [
          { type: 'divider', divider: {} },
          ...bodyBlocks
        ];
        await client.blocks.children.append({ block_id: existingId, children: appendChildren });
      }
    } else {
      body.parent = { database_id: NOTION_DATABASE_ID };
      if (bodyBlocks.length > 0) {
        body.children = bodyBlocks;
      }
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
