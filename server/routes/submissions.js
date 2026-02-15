const express = require('express');
const router = express.Router();
const { logSubmission } = require('../lib/logger');
const { validateBookACall, validateWebsiteReview, validateLead } = require('../lib/validate');
const { addOrUpdateContact } = require('../lib/mailchimp');
const { createOrUpdateVkCrmPage } = require('../lib/notion-vkcrm');
const config = require('../config');

const HONEYPOT_FIELD = '_hp';
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
const idempotencyCache = new Map();

function pruneIdempotency() {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache.entries()) {
    if (entry.expiry < now) idempotencyCache.delete(key);
  }
}

function enrichPayload(req, formData, endpoint, type) {
  const visitor = req.body._context || {};
  return {
    ...formData,
    type,
    form_id: req.body.form_id,
    trigger_button_id: req.body.trigger_button_id,
    modal_trigger_type: req.body.modal_trigger_type || null,
    idempotency_key: req.body.idempotency_key,
    _context: visitor,
    _server: {
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent') || '',
      siteBaseUrl: config.SITE_BASE_URL
    }
  };
}

function honeypotReject(body) {
  const val = body[HONEYPOT_FIELD];
  return val !== undefined && val !== null && String(val).trim() !== '';
}

router.use(express.json({ limit: '100kb' }));

router.post('/book-a-call', async (req, res) => {
  if (honeypotReject(req.body)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  const key = req.body.idempotency_key;
  if (key) {
    pruneIdempotency();
    const cached = idempotencyCache.get(key);
    if (cached) {
      return res.status(200).json(cached.response);
    }
  }
  const { errors, data } = validateBookACall(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0] });
  }
  const payload = enrichPayload(req, data, 'book-a-call', 'book-a-call');
  logSubmission('book-a-call', payload);
  console.log('Book a call received:', data.name || '(no name)');
  const vkcrmPayload = {
    submission_type: 'call_booking',
    submitted_at: payload._server?.timestamp || new Date().toISOString(),
    form_id: payload.form_id,
    trigger_button_id: payload.trigger_button_id,
    modal_trigger_type: payload.modal_trigger_type,
    name: data.name,
    email: data.email,
    website: data.website,
    linkedin_url: data.linkedin_url,
    company_name: data.company,
    phone: data.phone,
    message: data.message,
    notes: data.message
  };
  const notionResult = await createOrUpdateVkCrmPage(vkcrmPayload, payload._context || {});
  if (!notionResult.success) {
    console.error('Notion VKCRM book-a-call:', notionResult.error);
  }
  const response = { message: 'Thanks — we\'ll be in touch soon.' };
  if (key) {
    idempotencyCache.set(key, { response, expiry: Date.now() + IDEMPOTENCY_WINDOW_MS });
  }
  res.status(200).json(response);
});

router.post('/website-review', async (req, res) => {
  if (honeypotReject(req.body)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  const key = req.body.idempotency_key;
  if (key) {
    pruneIdempotency();
    const cached = idempotencyCache.get(key);
    if (cached) {
      return res.status(200).json(cached.response);
    }
  }
  const { errors, data } = validateWebsiteReview(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0] });
  }
  const payload = enrichPayload(req, data, 'website-review', 'website-review');
  logSubmission('website-review', payload);
  console.log('WRV received:', data.name || '(no name)');
  const vkcrmPayload = {
    submission_type: 'wrv_request',
    submitted_at: payload._server?.timestamp || new Date().toISOString(),
    form_id: payload.form_id,
    trigger_button_id: payload.trigger_button_id,
    modal_trigger_type: payload.modal_trigger_type,
    name: data.name,
    website: data.website,
    linkedin_url: data.linkedin_url,
    email: data.email,
    company_name: data.company,
    comments: data.comments
  };
  const notionResult = await createOrUpdateVkCrmPage(vkcrmPayload, payload._context || {});
  if (!notionResult.success) {
    console.error('Notion VKCRM website-review:', notionResult.error);
  }
  const response = { message: 'Thanks — we\'ll be in touch with your review soon.' };
  if (key) {
    idempotencyCache.set(key, { response, expiry: Date.now() + IDEMPOTENCY_WINDOW_MS });
  }
  res.status(200).json(response);
});

router.post('/lead', async (req, res) => {
  if (honeypotReject(req.body)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  const key = req.body.idempotency_key;
  if (key) {
    pruneIdempotency();
    const cached = idempotencyCache.get(key);
    if (cached) {
      return res.status(200).json(cached.response);
    }
  }
  const { errors, data } = validateLead(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors[0] });
  }
  const payload = enrichPayload(req, data, 'lead', 'lead');
  logSubmission('lead', payload);
  const mcResult = await addOrUpdateContact({ email: data.email, name: data.name, source: data.source, mailchimp_tag: data.mailchimp_tag });
  if (!mcResult.success && config.MAILCHIMP_API_KEY) {
    console.error('Mailchimp lead:', mcResult.error);
  }
  const successMessages = {
    'lead-50things': 'Thanks! Check your email for the checklist.',
    'lead-offboarding': 'Thanks! Check your email for the offboarding guide.',
    'lead-socialproof': 'Thanks! Check your email to get started with the course.'
  };
  const response = { message: successMessages[data.source] || 'Thanks! Check your email.' };
  if (key) {
    idempotencyCache.set(key, { response, expiry: Date.now() + IDEMPOTENCY_WINDOW_MS });
  }
  res.status(200).json(response);
});

module.exports = router;
