const express = require('express');
const router = express.Router();
const { createOrUpdateVkCrmPage } = require('../lib/notion-vkcrm');
const config = require('../config');

function checkWebhookAuth(req) {
  const secret = config.BOOKING_WEBHOOK_SECRET;
  if (!secret) return true;
  const authHeader = req.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = req.get('X-Webhook-Secret') || '';
  return bearer === secret || headerSecret === secret;
}

router.use(express.json({ limit: '100kb' }));

router.post('/booking-confirmed', async (req, res) => {
  if (!checkWebhookAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const body = req.body || {};
  const submissionType = body.submission_type;
  const submittedAt = body.submitted_at;
  const fullName = (body.full_name || body.name || '').trim();
  const website = (body.website || '').trim();
  const linkedinUrl = (body.linkedin_url || '').trim();

  if (submissionType !== 'call_booking') {
    return res.status(400).json({ error: 'submission_type must be "call_booking"' });
  }
  if (!submittedAt || typeof submittedAt !== 'string') {
    return res.status(400).json({ error: 'submitted_at (ISO datetime) is required' });
  }
  if (!fullName && !website && !linkedinUrl) {
    return res.status(400).json({ error: 'At least one of full_name, website, or linkedin_url is required' });
  }

  const payload = {
    submission_type: 'call_booking',
    submitted_at: submittedAt,
    full_name: fullName || body.name,
    name: fullName || body.name,
    website: website || body.website,
    linkedin_url: linkedinUrl || body.linkedin_url,
    email: (body.email || '').trim() || undefined,
    company_name: (body.company_name || body.company || '').trim() || undefined,
    company: (body.company_name || body.company || '').trim() || undefined,
    phone: (body.phone || '').trim() || undefined,
    notes: (body.notes || '').trim() || undefined,
    event: (body.event || '').trim() || undefined,
    start_time: body.start_time != null ? String(body.start_time) : undefined,
    timezone: (body.timezone || '').trim() || undefined,
    meeting_link: (body.meeting_link || '').trim() || undefined,
    booking_id: (body.booking_id || '').trim() || undefined
  };
  const context = {
    utm_source: body.utm_source,
    utm_medium: body.utm_medium,
    utm_campaign: body.utm_campaign,
    utm_term: body.utm_term,
    utm_content: body.utm_content
  };

  const result = await createOrUpdateVkCrmPage(payload, context);
  if (!result.success && config.NOTION_TOKEN) {
    console.error('Notion VKCRM booking-confirmed:', result.error);
  }
  res.status(200).json({ ok: true });
});

module.exports = router;
