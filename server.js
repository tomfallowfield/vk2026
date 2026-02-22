const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./server/config');
const { isConfigured: isVkCrmConfigured } = require('./server/lib/notion-vkcrm');
const submissionsRouter = require('./server/routes/submissions');
const webhooksRouter = require('./server/routes/webhooks');
const analyticsRouter = require('./server/routes/analytics');

const app = express();
const PORT = config.PORT;

// Behind Apache (or another reverse proxy): trust X-Forwarded-* so rate-limit sees real client IP
app.set('trust proxy', 1);

const allowedOrigins = config.getAllowedOrigins();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin === o || origin.startsWith(o + ':'))) return cb(null, true);
    cb(null, true);
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Optional: password-protect event viewer (Node alternative to .htaccess). Uses DEMO_VIEW_KEY as the Basic Auth password.
(function () {
  const viewKey = (process.env.DEMO_VIEW_KEY || '').trim();
  if (!viewKey) return;
  app.use(function demoEventsAuth(req, res, next) {
    const p = req.path;
    if (p !== '/demo-events.html' && p !== '/vk2026/demo-events.html') return next();
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
        const pass = decoded.includes(':') ? decoded.replace(/^[^:]*:/, '') : decoded;
        if (pass === viewKey) return next();
      } catch (_) {}
    }
    res.set('WWW-Authenticate', 'Basic realm="Event viewer"');
    res.status(401).send('Unauthorized');
  });
})();

app.use('/', express.static(path.join(__dirname), { index: 'index.html' }));
// Serve same static files under /vk2026 so /vk2026/demo-events.html and /vk2026/ work
app.use('/vk2026', express.static(path.join(__dirname), { index: 'index.html' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
// Analytics first so GET /analytics/events (viewer polling) uses 120/min, not 10/min
app.use('/api/analytics', analyticsLimiter, analyticsRouter);
// Also under /vk2026 so demo-events and main site work when served at /vk2026
app.use('/vk2026/api/analytics', analyticsLimiter, analyticsRouter);
app.use('/api', limiter);
app.use('/api', submissionsRouter);
app.use('/api/webhooks', webhooksRouter);
// Same API under /vk2026/api so forms and tracking work when site is at /vk2026/
app.use('/vk2026/api', limiter);
app.use('/vk2026/api', submissionsRouter);
app.use('/vk2026/api/webhooks', webhooksRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`API at http://localhost:${PORT}/api`);
  console.log(`Notion VKCRM: ${isVkCrmConfigured() ? 'configured' : 'NOT configured (set NOTION_TOKEN and NOTION_DATABASE_ID in .env)'}`);
});
