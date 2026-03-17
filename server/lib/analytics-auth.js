const crypto = require('crypto');
const { ANALYTICS_PASSWORD, ANALYTICS_SESSION_SECRET } = require('../config');

const COOKIE_NAME = 'vk_dash_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a signed session token: base64({ exp }) + '.' + hmac
 */
function createSessionToken() {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', ANALYTICS_SESSION_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}

/**
 * Verify a session token. Returns true if valid and not expired.
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', ANALYTICS_SESSION_SECRET).update(payload).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}

/**
 * Express handler for POST /api/analytics/login
 */
function handleLogin(req, res) {
  if (!ANALYTICS_PASSWORD) {
    return res.status(503).json({ error: 'Dashboard not configured' });
  }
  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (password !== ANALYTICS_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = createSessionToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });
  res.json({ ok: true });
}

/**
 * Middleware: require valid dashboard session.
 * For API requests (Accept: application/json or /api/ path) returns 401 JSON.
 * For page requests redirects to /analytics/login.html.
 */
function requireDashAuth(req, res, next) {
  if (!ANALYTICS_PASSWORD) {
    return res.status(503).send('Dashboard not configured');
  }
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (verifySessionToken(token)) return next();

  const isApi = req.path.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));
  if (isApi) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.redirect('/analytics/login.html');
}

module.exports = { handleLogin, requireDashAuth, COOKIE_NAME };
