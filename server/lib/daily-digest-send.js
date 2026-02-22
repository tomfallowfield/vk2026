/**
 * Send daily digest to Slack, email, and Notion.
 * Requires config: SLACK_WEBHOOK_URL, NOTIFICATION_EMAIL_TO + SMTP_*, NOTION_DAILY_DIGEST_DATABASE_ID + NOTION_TOKEN.
 */

const config = require('../config');
const { sendSlackMessage } = require('./slack');
const { formatDigestText } = require('./daily-digest');

async function sendDigestToSlack(digest) {
  const url = config.SLACK_WEBHOOK_URL && config.SLACK_WEBHOOK_URL.trim();
  if (!url) {
    console.warn('Slack: SLACK_WEBHOOK_URL not set – digest not sent');
    return;
  }
  const text = '```\n' + formatDigestText(digest) + '\n```';
  await sendSlackMessage(text);
}

async function sendDigestToEmail(digest) {
  const to = config.NOTIFICATION_EMAIL_TO && config.NOTIFICATION_EMAIL_TO.trim();
  if (!to || !config.SMTP_HOST) {
    console.warn('Email: NOTIFICATION_EMAIL_TO or SMTP not set – digest not sent');
    return;
  }
  try {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: (config.SMTP_USER && config.SMTP_PASS) ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
    });
    const subject = 'Daily digest · ' + (digest.date || 'Analytics');
    const text = formatDigestText(digest);
    await transport.sendMail({
      from: config.SMTP_USER || config.NOTIFICATION_EMAIL_TO || 'noreply@vanillakiller.com',
      to,
      subject,
      text,
      html: '<pre style="font-family:monospace;white-space:pre-wrap">' + text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>'
    });
    console.log('Daily digest email sent to', to);
  } catch (err) {
    console.error('Daily digest email:', err.message);
  }
}

/**
 * Add one row to the Notion daily digest database.
 * Expected DB columns: Date (date or title), and optionally number/rich_text for each metric.
 * We use: Date (title or date), then rich_text for a summary so we don't require many columns.
 */
async function sendDigestToNotion(digest) {
  const dbId = (config.NOTION_DAILY_DIGEST_DATABASE_ID || '').trim();
  if (!dbId || !config.NOTION_TOKEN) {
    console.warn('Notion: NOTION_DAILY_DIGEST_DATABASE_ID or NOTION_TOKEN not set – digest not sent');
    return;
  }
  try {
    const { Client } = require('@notionhq/client');
    const client = new Client({ auth: config.NOTION_TOKEN });
    const dateStr = digest.date || new Date().toISOString().slice(0, 10);
    const title = 'Digest · ' + dateStr;
    const body = formatDigestText(digest);

    await client.pages.create({
      parent: { database_id: dbId },
      properties: {
        Name: {
          title: [{ text: { content: title.slice(0, 2000) } }]
        },
        Date: {
          date: { start: dateStr }
        },
        Summary: {
          rich_text: [{ text: { content: body.slice(0, 2000) } }]
        }
      }
    });
    console.log('Daily digest added to Notion');
  } catch (err) {
    console.error('Daily digest Notion:', err.message);
  }
}

/**
 * Send digest to all configured channels (Slack, email, Notion).
 * @param {object} digest - Result of getDailyDigest()
 */
async function sendDailyDigest(digest) {
  if (digest.error) {
    console.error('Cannot send digest:', digest.error);
    return;
  }
  await Promise.all([
    sendDigestToSlack(digest),
    sendDigestToEmail(digest),
    sendDigestToNotion(digest)
  ]);
}

module.exports = {
  sendDigestToSlack,
  sendDigestToEmail,
  sendDigestToNotion,
  sendDailyDigest
};
