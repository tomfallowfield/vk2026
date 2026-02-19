#!/usr/bin/env node
/**
 * Migrate content from settings.js and index.html into Strapi.
 * Run after Strapi is set up and running.
 *
 * STRAPI_URL=http://localhost:1337 STRAPI_TOKEN=your-token node scripts/migrate-to-strapi.js
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const root = path.resolve(__dirname, '..');
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

if (!STRAPI_TOKEN) {
  console.error('Error: STRAPI_TOKEN required. Create one in Strapi Admin → Settings → API Tokens');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_TOKEN}`
};

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url}: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function extractSettings() {
  const content = fs.readFileSync(path.join(root, 'settings.js'), 'utf8');
  const match = content.match(/window\.SITE_SETTINGS\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error('Could not parse SITE_SETTINGS from settings.js');
  let obj;
  try {
    obj = Function('return ' + match[1])();
  } catch {
    throw new Error('Could not eval SITE_SETTINGS');
  }
  const lm = obj.lead_magnets || {};
  const lead_magnets = Object.entries(lm).map(([form_id, c]) => ({
    form_id,
    enabled: c.enabled !== false,
    success_message: c.success_message || '',
    mailchimp_tag: c.mailchimp_tag || ''
  }));
  const linkedin_faces = (obj.linkedin_faces || []).map(f => ({
    name: f.name || '',
    role: f.role || '',
    photo: f.photo || ''
  }));
  return {
    autodialog_form_to_show: obj.autodialog_form_to_show ?? 'wrv',
    autodialog_to_be_shown_on_exit_intent: obj.autodialog_to_be_shown_on_exit_intent !== false,
    autodialog_to_be_shown_after_delay_s: Math.max(0, Number(obj.autodialog_to_be_shown_after_delay_s) || 30),
    site_env: obj.site_env || 'temp',
    api_base: typeof obj.api_base === 'string' ? obj.api_base : '',
    wrv_offer: obj.wrv_offer !== false,
    book_call_offer: obj.book_call_offer !== false,
    book_call_calendar_url: typeof obj.book_call_calendar_url === 'string' ? obj.book_call_calendar_url : '',
    lead_magnets_enabled: obj.lead_magnets_enabled !== false,
    lead_magnets,
    show_pricing: obj.show_pricing !== false,
    cookie_consent_enabled: obj.cookie_consent_enabled !== false,
    show_email: obj.show_email !== false,
    cta_primary_black: obj.cta_primary_black === true,
    rescue_section_show_videos: obj.rescue_section_show_videos === true,
    ga_id: typeof obj.ga_id === 'string' ? obj.ga_id.trim() : '',
    maintenance_mode: obj.maintenance_mode === true,
    maintenance_message: typeof obj.maintenance_message === 'string' ? obj.maintenance_message : '',
    default_modal: obj.default_modal && typeof obj.default_modal === 'string' ? obj.default_modal : null,
    linkedin_faces
  };
}

function extractFaqs(html) {
  const faqs = [];
  const faqRegex = /<div class="faq">\s*<button[^>]*>\s*<span>([^<]+)<\/span>[\s\S]*?<\/button>\s*<div class="faq-panel">([\s\S]*?)<\/div>\s*<\/div>/g;
  let m;
  let i = 0;
  while ((m = faqRegex.exec(html)) !== null) {
    const question = m[1].trim();
    let answer = m[2].replace(/<\/?p>/g, '\n').replace(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)').trim();
    if (answer) answer = '<p>' + answer.replace(/\n+/g, '</p><p>') + '</p>';
    faqs.push({ question, answer, order: i++ });
  }
  return faqs;
}

function extractTestimonials(html) {
  const testimonials = [];
  const wrapRegex = /<div class="testimonial-wrap">\s*<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/>\s*<blockquote[^>]*>([\s\S]*?)<\/blockquote>\s*<\/div>/g;
  let m;
  let i = 0;
  while ((m = wrapRegex.exec(html)) !== null) {
    const avatar_path = m[1];
    const alt = m[2];
    let content = m[3];
    const strongMatch = content.match(/<strong>([^<]+)<\/strong>/);
    const author = strongMatch ? strongMatch[1].trim() : alt;
    content = content.replace(/<br\s*\/?>/g, '\n').replace(/<strong>[^<]+<\/strong>/, '').trim();
    const quote = content.replace(/^\s*[""]|[""]\s*$/g, '').trim();
    testimonials.push({
      quote,
      author_name: author.split(',').map(s => s.trim())[0] || author,
      author_role: author.includes(',') ? author.split(',').slice(1).join(',').trim() : '',
      avatar_path,
      order: i++
    });
  }
  return testimonials;
}

function extractLeadMagnets(html) {
  const magnets = [];
  const slugMap = {
    'lead-50things': { title: '50 Things You Can Fix on Your Website Today', desc: 'A practical checklist to help you spot weak messaging, missed conversion opportunities, and unclear positioning. Use it to stress-test your homepage, sharpen your offer, and increase enquiries without touching your ad budget.' },
    'lead-offboarding': { title: 'Offboarding Clients - A Guide', desc: 'Most businesses treat client offboarding as admin. It is actually a goldmine. This detailed guide shows you how to extract testimonials, sharpen your messaging, surface objections, and unlock referrals before the relationship closes.' },
    'lead-socialproof': { title: 'The Social Proof Advantage', desc: 'A short email course on how to collect, shape, and deploy social proof so it actually persuades. Learn how to turn vague praise into belief-shifting evidence that moves people from sceptical to ready.' }
  };
  let i = 0;
  for (const [slug, { title, desc }] of Object.entries(slugMap)) {
    magnets.push({ slug, title, description: desc, enabled: true, order: i++ });
  }
  return magnets;
}

async function main() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  console.log('Extracting content...');
  const settings = extractSettings();
  const faqs = extractFaqs(html);
  const testimonials = extractTestimonials(html);
  const leadMagnets = extractLeadMagnets(html);

  console.log('Migrating to Strapi at', STRAPI_URL);

  try {
    await request('PUT', `${STRAPI_URL}/api/site-setting`, { data: settings });
    console.log('  Created/updated site-setting');
  } catch (e) {
    console.error('  site-setting:', e.message);
  }

  for (const faq of faqs) {
    try {
      await request('POST', `${STRAPI_URL}/api/faqs`, { data: faq });
      console.log('  Created FAQ:', faq.question.slice(0, 40) + '...');
    } catch (e) {
      console.error('  FAQ:', e.message);
    }
  }

  for (const t of testimonials) {
    try {
      await request('POST', `${STRAPI_URL}/api/testimonials`, { data: t });
      console.log('  Created testimonial:', t.author_name);
    } catch (e) {
      console.error('  Testimonial:', e.message);
    }
  }

  for (const lm of leadMagnets) {
    try {
      await request('POST', `${STRAPI_URL}/api/lead-magnets`, { data: lm });
      console.log('  Created lead-magnet:', lm.slug);
    } catch (e) {
      console.error('  Lead magnet:', e.message);
    }
  }

  console.log('Done. Spot-check in Strapi Admin.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
