/**
 * When a new visitor lands (first event batch), send a Slack message with
 * "Browser/Device nr Location from UTM" and a link to demo-events filtered to that visitor.
 */

const config = require('../config');
const { sendSlackMessage } = require('./slack');

/**
 * @param {object} opts
 * @param {string} opts.visitor_id
 * @param {string|null} opts.browser_display - e.g. "Mac/Chrome"
 * @param {string|null} opts.location_display - e.g. "Leeds, UK"
 * @param {string|null} opts.utm_source - e.g. "LinkedIn"
 * @param {string} [opts.baseUrl] - SITE_BASE_URL (default from config)
 * @param {string} [opts.viewKey] - DEMO_VIEW_KEY for the link (optional)
 */
async function notifyNewVisitor(opts) {
  const baseUrl = (opts.baseUrl || config.SITE_BASE_URL || '').replace(/\/$/, '');
  const viewKey = opts.viewKey || (process.env.DEMO_VIEW_KEY || '').trim();
  const visitorId = opts.visitor_id && String(opts.visitor_id).trim();
  if (!visitorId) return;

  const browser = (opts.browser_display && String(opts.browser_display).trim()) || 'unknown';
  const location = (opts.location_display && String(opts.location_display).trim()) || 'unknown';
  const source = (opts.utm_source && String(opts.utm_source).trim()) ? opts.utm_source : 'direct';

  const label = browser + ' nr ' + location + ' from ' + source;

  let link = baseUrl + '/demo-events.html';
  const params = new URLSearchParams();
  if (viewKey) params.set('view_key', viewKey);
  params.set('visitor', visitorId);
  link += '?' + params.toString();

  const text = '<' + link + '|' + label + '>';
  await sendSlackMessage(text).catch((err) => {
    console.error('New-visitor Slack:', err.message);
  });
}

module.exports = { notifyNewVisitor };
