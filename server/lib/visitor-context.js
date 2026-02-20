/**
 * Derive device and browser display strings from User-Agent.
 * @param {string} ua - req.get('user-agent') or navigator.userAgent
 * @returns {{ device_display: string|null, browser_display: string|null }}
 */
function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return { device_display: null, browser_display: null };
  const s = ua;

  // Device / OS (order matters: check mobile first)
  let device = null;
  const deviceMatch = s.match(/\b(iPhone|iPod|iPad|Android|Windows|Macintosh|Mac OS X|Linux)\b/i);
  if (deviceMatch) {
    const d = deviceMatch[1].toLowerCase();
    if (d === 'macintosh' || d === 'mac os x') device = 'Mac';
    else device = deviceMatch[1].charAt(0).toUpperCase() + deviceMatch[1].slice(1).toLowerCase();
  }
  // Normalize "Mac OS X" (space in pattern may not match in some UAs; fallback)
  if (!device && /Mac OS X/i.test(s)) device = 'Mac';

  // Browser (order matters: Edge and Edg before Chrome)
  let browser = null;
  if (/\bEdg\//i.test(s)) browser = 'Edge';
  else if (/\bOPR\//i.test(s) || /\bOpera\b/i.test(s)) browser = 'Opera';
  else if (/\bChrome\//i.test(s) && !/\bChromium\b/i.test(s)) browser = 'Chrome';
  else if (/\bFirefox\//i.test(s)) browser = 'Firefox';
  else if (/\bSafari\//i.test(s) && !/\bChrome\b/i.test(s)) browser = 'Safari';

  const browserDisplay = device && browser ? device + '/' + browser : (browser || device);

  return {
    device_display: device,
    browser_display: browserDisplay || null
  };
}

/**
 * Get location string from IP (e.g. "Bristol" or "Bristol, UK").
 * Uses geoip-lite if available; skips private/local IPs.
 * @param {string} ip - Client IP (e.g. req.ip)
 * @returns {string|null}
 */
function getLocationFromIp(ip) {
  if (!ip || typeof ip !== 'string') return null;
  const trimmed = ip.trim();
  if (!trimmed || trimmed === '::1' || /^127\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^192\.168\./i.test(trimmed)) return null;
  try {
    const geoip = require('geoip-lite');
    const geo = geoip.lookup(trimmed);
    if (!geo || (!geo.city && !geo.country)) return null;
    const city = geo.city || '';
    const country = geo.country || '';
    if (city && country) return city + ', ' + country;
    return city || country || null;
  } catch (_) {
    return null;
  }
}

/**
 * Build device_display, browser_display, location_display for a request.
 * @param {{ userAgent?: string, ip?: string }} reqContext - { userAgent: req.get('user-agent'), ip: req.ip }
 * @returns {{ device_display: string|null, browser_display: string|null, location_display: string|null }}
 */
function getVisitorContext(reqContext) {
  const ua = reqContext && reqContext.userAgent;
  const { device_display, browser_display } = parseUserAgent(ua);
  const location_display = getLocationFromIp(reqContext && reqContext.ip);
  return {
    device_display: device_display || null,
    browser_display: browser_display || null,
    location_display: location_display || null
  };
}

module.exports = { parseUserAgent, getLocationFromIp, getVisitorContext };
