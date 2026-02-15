const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./server/config');
const submissionsRouter = require('./server/routes/submissions');

const app = express();
const PORT = config.PORT;

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

app.use('/vk2026', express.static(path.join(__dirname), { index: 'index.html' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/vk2026/api', limiter);
app.use('/vk2026/api', submissionsRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/vk2026`);
  console.log(`API at http://localhost:${PORT}/vk2026/api`);
});
