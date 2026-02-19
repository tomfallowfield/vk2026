/**
 * Send a plain text message to Slack via incoming webhook.
 * No-op if SLACK_WEBHOOK_URL is not set.
 * @param {string} text - Message to post
 */
async function sendSlackMessage(text) {
  const config = require('../config');
  const url = config.SLACK_WEBHOOK_URL && config.SLACK_WEBHOOK_URL.trim();
  if (!url) {
    console.warn('Slack: SLACK_WEBHOOK_URL not set – notification skipped');
    return;
  }
  try {
    console.log('Slack: sending notification…');
    const fetch = require('node-fetch');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      console.log('Slack: sent OK', res.status);
    } else {
      const body = await res.text();
      console.error('Slack webhook error:', res.status, body || res.statusText);
    }
  } catch (err) {
    console.error('Slack:', err.message);
  }
}

module.exports = { sendSlackMessage };
