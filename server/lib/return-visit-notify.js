/**
 * When a visitor we know (have email from form submit) returns to the site,
 * send email + Slack + add row to Notion. Throttled to at most once per hour per visitor.
 */
const config = require('../config');
const { getVisitorForReturnCheck, setReturnVisitNotified } = require('./analytics-db');
const { sendSlackMessage } = require('./slack');

const RETURN_VISIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function shouldNotify(visitor) {
  if (!visitor || !(visitor.email && visitor.email.trim())) return false;
  const last = visitor.return_visit_notified_at;
  if (!last) return true;
  const lastMs = last instanceof Date ? last.getTime() : new Date(last).getTime();
  return Date.now() - lastMs >= RETURN_VISIT_COOLDOWN_MS;
}

async function sendEmail(payload) {
  const to = config.NOTIFICATION_EMAIL_TO && config.NOTIFICATION_EMAIL_TO.trim();
  if (!to || !config.SMTP_HOST) return;
  try {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: (config.SMTP_USER && config.SMTP_PASS) ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
    });
    const label = payload.name && payload.name.trim() ? payload.name.trim() + ' (' + payload.email + ')' : payload.email;
    await transport.sendMail({
      from: config.SMTP_USER || config.NOTIFICATION_EMAIL_TO || 'noreply@vanillakiller.com',
      to,
      subject: 'Return visit: ' + label,
      text: payload.text,
      html: payload.text.replace(/\n/g, '<br>\n')
    });
  } catch (err) {
    console.error('Return-visit email:', err.message);
  }
}

async function sendSlack(payload) {
  const label = payload.name && payload.name.trim() ? payload.name + ' (' + payload.email + ')' : payload.email;
  await sendSlackMessage('Return visit: ' + label + ' – ' + payload.text);
}

async function addToNotion(payload) {
  const dbId = config.NOTION_RETURN_VISITS_DATABASE_ID && config.NOTION_RETURN_VISITS_DATABASE_ID.trim();
  if (!dbId || !config.NOTION_TOKEN) return;
  try {
    const { Client } = require('@notionhq/client');
    const client = new Client({ auth: config.NOTION_TOKEN });
    const title = (payload.name && payload.name.trim()) || payload.email || payload.visitor_id;
    const returnedAt = payload.returned_at || new Date().toISOString();
    await client.pages.create({
      parent: { database_id: dbId },
      properties: {
        Name: {
          title: [{ text: { content: title.slice(0, 2000) } }]
        },
        Email: {
          rich_text: [{ text: { content: (payload.email || '').slice(0, 2000) } }]
        },
        'Visitor ID': {
          rich_text: [{ text: { content: (payload.visitor_id || '').slice(0, 2000) } }]
        },
        'Returned at': {
          date: { start: returnedAt.slice(0, 10) }
        }
      }
    });
  } catch (err) {
    console.error('Return-visit Notion:', err.message);
  }
}

/**
 * If this visitor has an email (enriched) and we haven't notified in the last hour, send email + Slack + Notion and mark notified.
 * Call after writing events for this visitor_id (fire-and-forget).
 * @param {string} visitor_id
 */
async function maybeNotifyReturnVisit(visitor_id) {
  if (!visitor_id) return;
  try {
    const visitor = await getVisitorForReturnCheck(visitor_id);
    if (!shouldNotify(visitor)) return;
    const label = visitor.name && visitor.name.trim() ? visitor.name.trim() + ' (' + visitor.email + ')' : visitor.email;
    const text = label + ' returned to the site just now. Visitor ID: ' + visitor_id;
    const payload = {
      email: visitor.email,
      name: visitor.name,
      visitor_id,
      text,
      returned_at: new Date().toISOString()
    };
    await Promise.all([
      sendEmail(payload),
      sendSlack(payload),
      addToNotion(payload)
    ]);
    await setReturnVisitNotified(visitor_id);
  } catch (err) {
    console.error('Return-visit notify:', err.message);
  }
}

module.exports = { maybeNotifyReturnVisit };
