// API base URL (same origin). Uses settings.api_base if set; else if page is under a path (e.g. /vk2026/) uses that + '/api' so forms and tracking work.
window.API_BASE = (function () {
  const s = window.SITE_SETTINGS || {};
  if (typeof s.api_base === 'string' && s.api_base.trim()) return s.api_base.trim();
  if (typeof window.API_BASE === 'string' && window.API_BASE.trim()) return window.API_BASE.trim();
  try {
    const pathname = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
    const segment = pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
    if (segment) return '/' + segment + '/api';
  } catch (_) {}
  return '/api';
})();

// Site settings (from settings.js); defaults if missing
function getSettings() {
  const s = window.SITE_SETTINGS || {};
  return {
    autodialog_form_to_show: s.autodialog_form_to_show ?? 'wrv',
    autodialog_to_be_shown_on_exit_intent: s.autodialog_to_be_shown_on_exit_intent !== false,
    autodialog_to_be_shown_after_delay_s: Math.max(0, Number(s.autodialog_to_be_shown_after_delay_s) || 0),
    site_env: s.site_env || 'temp',
    wrv_offer: s.wrv_offer !== false,
    book_call_offer: s.book_call_offer !== false,
    lead_magnets_enabled: s.lead_magnets_enabled !== false,
    show_pricing: s.show_pricing !== false,
    cookie_consent_enabled: s.cookie_consent_enabled !== false,
    show_email: s.show_email !== false,
    cta_primary_black: s.cta_primary_black === true,
    rescue_section_show_videos: s.rescue_section_show_videos === true,
    ga_id: typeof s.ga_id === 'string' ? s.ga_id.trim() : '',
    maintenance_mode: s.maintenance_mode === true,
    maintenance_message: typeof s.maintenance_message === 'string' ? s.maintenance_message : 'We\'ll be back shortly. Thanks for your patience.',
    default_modal: (s.default_modal && typeof s.default_modal === 'string') ? s.default_modal : null,
    api_base: typeof s.api_base === 'string' ? s.api_base.trim() : '',
    book_call_calendar_url: typeof s.book_call_calendar_url === 'string' ? s.book_call_calendar_url.trim() : '',
    lead_magnets: (s.lead_magnets && typeof s.lead_magnets === 'object') ? s.lead_magnets : {},
    easter_eggs_competition_showing: s.easter_eggs_competition_showing === true
  };
}

function getEnabledLeadMagnetIds() {
  const settings = getSettings();
  if (!settings.lead_magnets_enabled) return [];
  const lm = settings.lead_magnets;
  const ids = ['lead-50things', 'lead-offboarding', 'lead-socialproof'];
  if (!Object.keys(lm).length) return ids;
  return ids.filter(function (id) {
    const config = lm[id];
    return !config || config.enabled !== false;
  });
}

function getLeadMagnetConfig(id) {
  const lm = getSettings().lead_magnets[id];
  return lm && typeof lm === 'object' ? lm : {};
}

// Strapi richtext blocks to HTML (paragraph, text, link, bold, italic)
function blocksToHtml(blocks) {
  if (!blocks || !Array.isArray(blocks)) return '';
  function textNode(n) {
    if (!n) return '';
    if (n.type === 'text') {
      var t = (n.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (n.bold) t = '<strong>' + t + '</strong>';
      if (n.italic) t = '<em>' + t + '</em>';
      return t;
    }
    if (n.type === 'link') {
      var href = (n.url || '#').replace(/"/g, '&quot;');
      var children = (n.children || []).map(textNode).join('');
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + children + '</a>';
    }
    return (n.children || []).map(textNode).join('');
  }
  return blocks.map(function (b) {
    var children = (b.children || []).map(textNode).join('');
    if (b.type === 'paragraph') return '<p>' + children + '</p>';
    if (b.type === 'heading' && b.level) return '<h' + b.level + '>' + children + '</h' + b.level + '>';
    if (b.type === 'list') {
      var tag = b.format === 'ordered' ? 'ol' : 'ul';
      var items = (b.children || []).map(function (li) {
        var c = (li.children || []).map(textNode).join('');
        return '<li>' + c + '</li>';
      }).join('');
      return '<' + tag + '>' + items + '</' + tag + '>';
    }
    return '<p>' + children + '</p>';
  }).join('');
}

// CMS content render (FAQs, testimonials, lead magnets) – runs when window.FAQS etc from load-cms.js
(function () {
  var list = window.FAQS;
  if (Array.isArray(list) && list.length > 0) {
    var el = document.getElementById('faq-list');
    if (el) {
      el.innerHTML = '';
      list.forEach(function (item) {
        var q = (item.question || '').trim();
        var a = item.answer;
        var aHtml = typeof a === 'string' ? a : (Array.isArray(a) ? blocksToHtml(a) : '');
        var div = document.createElement('div');
        div.className = 'faq';
        div.innerHTML = '<button class="faq-trigger"><span>' + q.replace(/</g, '&lt;').replace(/&/g, '&amp;') + '</span><span>+</span></button><div class="faq-panel">' + aHtml + '</div>';
        el.appendChild(div);
      });
    }
  }

  var testimonials = window.TESTIMONIALS;
  if (testimonials && Array.isArray(testimonials) && testimonials.length > 0) {
    /* Hero uses hardcoded carousel (Mike, Matthew Creed, lorem) - no CMS overwrite */
    /* Hero testimonial is now a hardcoded carousel - skip hero CMS overwrite */
    var testimonialSection = document.querySelector('.testimonial-section .testimonial-wrap');
    if (testimonialSection && testimonials.length > 1) {
      var t2 = testimonials[1];
      var q2 = (t2.quote || '').trim().replace(/^["']|["']$/g, '');
      var img2 = t2.avatar_path ? ((t2.avatar_path.indexOf('images/') === 0 || t2.avatar_path.indexOf('http') === 0) ? t2.avatar_path : 'images/testimonial_mugs/' + t2.avatar_path.replace(/^.*\//, '')) : '';
      testimonialSection.innerHTML = '<img src="' + (img2 || 'images/testimonial_mugs/mike.png') + '" alt="' + (t2.author_name || '').replace(/"/g, '&quot;') + '" class="testimonial-avatar" /><blockquote class="testimonial">"' + q2.replace(/</g, '&lt;').replace(/"/g, '&quot;') + '"<br><strong>' + (t2.author_name || '').replace(/</g, '&lt;') + (t2.author_role ? ', ' + (t2.author_role || '').replace(/</g, '&lt;') : '') + '</strong></blockquote>';
    }
  }

  var magnets = window.LEAD_MAGNETS;
  if (magnets && Array.isArray(magnets) && magnets.length > 0) {
    var settings = getSettings();
    var enabledIds = getEnabledLeadMagnetIds();
    magnets = magnets.filter(function (m) {
      return m.enabled !== false && enabledIds.indexOf(m.slug) >= 0;
    });
    var grid = document.getElementById('resources-grid');
    if (grid) {
      grid.innerHTML = '';
      magnets.forEach(function (m) {
        var slug = (m.slug || '').trim();
        var title = (m.title || '').replace(/</g, '&lt;');
        var desc = m.description;
        var descHtml = typeof desc === 'string' ? desc : (Array.isArray(desc) ? blocksToHtml(desc) : '');
        var card = document.createElement('a');
        card.href = '#';
        card.id = 'button-' + slug + '-resources';
        card.className = 'resource-card';
        card.setAttribute('data-modal', slug);
        card.innerHTML = '<h3>' + title + '</h3><p>' + descHtml + '</p>';
        grid.appendChild(card);
      });
    }
  }
})();

// Cookie consent & visitor context (graceful degradation if declined)
const COOKIE_CONSENT_KEY = 'vk_cookie_consent';
const COOKIE_VISITOR_NAME = 'vk_visitor';
const COOKIE_VISITOR_DAYS = 365;

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;SameSite=Lax;expires=' + d.toUTCString();
}

function hasAcceptedCookies() {
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accept';
}

function getOrCreateVisitor() {
  if (!hasAcceptedCookies()) return null;
  let raw = getCookie(COOKIE_VISITOR_NAME);
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const now = Date.now();
  const referrer = document.referrer || '';
  const params = new URLSearchParams(window.location.search);
  var utmSource = params.get('utm_source') || params.get('utm') || '';
  const utm = {
    utm_source: utmSource,
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || ''
  };
  if (!data) {
    data = {
      visitor_id: 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      visit_count: 1,
      first_visit_ts: now,
      last_activity_ts: now,
      first_referrer: referrer,
      referrers: referrer ? [referrer] : [],
      past_form_submissions: [],
      buttons_clicked: [],
      videos_watched: {},
      utm: utm,
      first_utm: utm
    };
  } else {
    data.visit_count = (data.visit_count || 0) + 1;
    data.last_activity_ts = now;
    data.buttons_clicked = data.buttons_clicked || [];
    data.videos_watched = data.videos_watched || {};
    if (referrer && data.referrers && data.referrers.indexOf(referrer) === -1) {
      data.referrers = (data.referrers || []).slice(-4).concat(referrer);
    }
    if (params.has('utm_source') || params.has('utm_medium') || params.has('utm')) data.utm = utm;
  }
  setCookie(COOKIE_VISITOR_NAME, JSON.stringify(data), COOKIE_VISITOR_DAYS);
  return data;
}

function getContextForSubmit(triggerButtonId) {
  const v = getOrCreateVisitor();
  const now = Date.now();
  if (v) {
    v.last_activity_ts = now;
    setCookie(COOKIE_VISITOR_NAME, JSON.stringify(v), COOKIE_VISITOR_DAYS);
  }
  const params = new URLSearchParams(window.location.search);
  const buttons_clicked = (v && v.buttons_clicked && Array.isArray(v.buttons_clicked)) ? v.buttons_clicked : [];
  const videosObj = (v && v.videos_watched && typeof v.videos_watched === 'object') ? v.videos_watched : {};
  const videos_watched = Object.entries(videosObj).map(function (entry) {
    var src = entry[0];
    var val = entry[1];
    if (typeof val === 'number') {
      return { src: src, name: src, max_pct: val, events: [] };
    }
    var max_pct = (val && typeof val.max_pct === 'number') ? val.max_pct : 0;
    var events = (val && Array.isArray(val.events)) ? val.events : [];
    return { src: src, name: src, max_pct: max_pct, events: events };
  });
  var firstVisitUtm = (v && v.first_utm && typeof v.first_utm === 'object') ? v.first_utm : null;
  return {
    visitor_id: v ? v.visitor_id : null,
    visit_count: v ? v.visit_count : null,
    first_visit_ts: v ? v.first_visit_ts : null,
    last_activity_ts: now,
    first_referrer: v ? v.first_referrer : (document.referrer || null),
    referrers: v ? v.referrers : null,
    past_form_submissions: v ? v.past_form_submissions : null,
    buttons_clicked: buttons_clicked,
    videos_watched: videos_watched,
    first_visit_utm: firstVisitUtm,
    utm_source: params.get('utm_source') || params.get('utm') || null,
    utm_medium: params.get('utm_medium') || null,
    utm_campaign: params.get('utm_campaign') || null,
    utm_term: params.get('utm_term') || null,
    utm_content: params.get('utm_content') || null,
    current_url: window.location.href
  };
}

function recordFormSubmission(formId) {
  if (!hasAcceptedCookies()) return;
  const raw = getCookie(COOKIE_VISITOR_NAME);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    data.past_form_submissions = (data.past_form_submissions || []).concat({ formId, submittedAt: Date.now() }).slice(-20);
    setCookie(COOKIE_VISITOR_NAME, JSON.stringify(data), COOKIE_VISITOR_DAYS);
  } catch (_) {}
}

// Analytics: send event to server immediately (fire-and-forget). Only when cookie consent given.
function getAnalyticsContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    page_url: window.location.href,
    referrer: document.referrer || '',
    utm_source: params.get('utm_source') || params.get('utm') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_term: params.get('utm_term') || '',
    utm_content: params.get('utm_content') || ''
  };
}

function trackEvent(eventType, metadata) {
  if (!hasAcceptedCookies()) return;
  const v = getOrCreateVisitor();
  if (!v || !v.visitor_id) return;
  const ctx = getAnalyticsContext();
  const event = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    page_url: ctx.page_url,
    referrer: ctx.referrer,
    utm_source: ctx.utm_source,
    utm_medium: ctx.utm_medium,
    utm_campaign: ctx.utm_campaign,
    utm_term: ctx.utm_term,
    utm_content: ctx.utm_content,
    metadata: metadata && typeof metadata === 'object' ? metadata : null
  };
  const payload = { visitor_id: v.visitor_id, events: [event] };
  const url = window.API_BASE + '/analytics/events';
  const body = JSON.stringify(payload);
  var protocol = typeof window !== 'undefined' && window.location && window.location.protocol;
  var useBeacon = protocol === 'http:' || protocol === 'https:';
  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else if (useBeacon) {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
}

function trackEvents(events) {
  if (!hasAcceptedCookies() || !events || events.length === 0) return;
  const v = getOrCreateVisitor();
  if (!v || !v.visitor_id) return;
  const ctx = getAnalyticsContext();
  const payload = {
    visitor_id: v.visitor_id,
    events: events.map(function (ev) {
      return {
        event_type: ev.event_type,
        timestamp: (ev.timestamp && new Date(ev.timestamp).toISOString()) || new Date().toISOString(),
        page_url: ev.page_url != null ? ev.page_url : ctx.page_url,
        referrer: ev.referrer != null ? ev.referrer : ctx.referrer,
        utm_source: ev.utm_source != null ? ev.utm_source : ctx.utm_source,
        utm_medium: ev.utm_medium != null ? ev.utm_medium : ctx.utm_medium,
        utm_campaign: ev.utm_campaign != null ? ev.utm_campaign : ctx.utm_campaign,
        utm_term: ev.utm_term != null ? ev.utm_term : ctx.utm_term,
        utm_content: ev.utm_content != null ? ev.utm_content : ctx.utm_content,
        metadata: ev.metadata && typeof ev.metadata === 'object' ? ev.metadata : null
      };
    })
  };
  const url = window.API_BASE + '/analytics/events';
  const body = JSON.stringify(payload);
  var protocol = typeof window !== 'undefined' && window.location && window.location.protocol;
  var useBeacon = protocol === 'http:' || protocol === 'https:';
  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } else if (useBeacon) {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
  }
}

// Time on site: heartbeat every 30s, final send on visibility hidden / beforeunload
(function () {
  var sessionStart = Date.now();
  var heartbeatInterval = null;
  function sendTimeOnSite() {
    if (!hasAcceptedCookies()) return;
    var seconds = Math.round((Date.now() - sessionStart) / 1000);
    trackEvent('time_on_site', { seconds: seconds });
  }
  function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(sendTimeOnSite, 30000);
  }
  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
  if (typeof document.visibilityState !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        sendTimeOnSite();
        stopHeartbeat();
      } else {
        startHeartbeat();
      }
    });
  }
  window.addEventListener('beforeunload', function () { sendTimeOnSite(); });
  if (document.visibilityState === 'visible') startHeartbeat();
})();

// Cookie bar UI (only when cookie_consent_enabled is true)
(function () {
  const bar = document.getElementById('cookie-bar');
  const backdrop = document.getElementById('cookie-bar-backdrop');
  const acceptBtn = document.getElementById('cookie-accept');
  const declineBtn = document.getElementById('cookie-decline');
  if (!bar || !acceptBtn || !declineBtn) return;
  if (!getSettings().cookie_consent_enabled) {
    bar.hidden = true;
    if (backdrop) backdrop.hidden = true;
    return;
  }
  const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (consent === 'accept' || consent === 'decline') {
    bar.hidden = true;
    if (backdrop) backdrop.hidden = true;
    return;
  }
  function showBar() {
    bar.hidden = false;
    if (backdrop) backdrop.hidden = false;
  }
  function acceptAndHide() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accept');
    getOrCreateVisitor();
    bar.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }
  function declineAndHide() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'decline');
    bar.hidden = true;
    if (backdrop) backdrop.hidden = true;
  }
  showBar();
  acceptBtn.addEventListener('click', acceptAndHide);
  declineBtn.addEventListener('click', declineAndHide);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || bar.hidden) return;
    e.preventDefault();
    acceptAndHide();
  });
})();

// UTM / tracking params: store in visitor cookie (when consent given) then replace URL with clean one (no reload).
// Only tracking params are stripped; deeplink params (e.g. modal=website-review) are kept.
// Gives GA ~1.5s to send the page_view with UTM URL before we strip it from the address bar.
(function () {
  var TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];
  var params = new URLSearchParams(window.location.search);
  var hasTracking = TRACKING_PARAMS.some(function (k) { return params.has(k); });
  if (!hasTracking) return;
  if (hasAcceptedCookies()) getOrCreateVisitor();
  setTimeout(function () {
    var kept = new URLSearchParams();
    params.forEach(function (value, key) {
      if (TRACKING_PARAMS.indexOf(key) === -1) kept.set(key, value);
    });
    var qs = kept.toString();
    var clean = window.location.origin + window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
    if (clean !== window.location.href) window.history.replaceState(null, '', clean);
  }, 1500);
})();

// How the modal was opened (for logging on submit): 'button' | 'url' | 'exit_intent' | 'inactivity'
let lastModalTriggerType = null;
// Which button opened the modal (for trigger_button_id)
let lastTriggerButtonId = null;

// Header: hide on scroll down, show on scroll up (only for manual scroll; not when scrolling via menu/nav)
window._programmaticScrollActive = false;
(function () {
  const header = document.querySelector('header');
  let lastScrollY = window.scrollY;
  const scrollThreshold = 80;

  window.addEventListener('scroll', function () {
    if (window._programmaticScrollActive) {
      header.classList.remove('header--hidden');
      lastScrollY = window.scrollY;
      return;
    }
    const scrollY = window.scrollY;
    if (scrollY <= scrollThreshold) {
      header.classList.remove('header--hidden');
    } else if (scrollY > lastScrollY) {
      header.classList.add('header--hidden');
    } else {
      header.classList.remove('header--hidden');
    }
    lastScrollY = scrollY;
  }, { passive: true });
})();

// FAQ toggles (click and linger >1s to expand)
(function () {
  const faqs = document.querySelectorAll('.faq');
  const LINGER_MS = 1000;
  function getFaqQuestion(faqEl) {
    var t = faqEl && faqEl.querySelector('.faq-trigger');
    var span = t && t.firstElementChild;
    return (span && span.textContent ? span.textContent.trim() : '').slice(0, 200);
  }
  faqs.forEach((faq, index) => {
    const trigger = faq.querySelector('.faq-trigger');
    const panel = faq.querySelector('.faq-panel');
    if (!trigger || !panel) return;
    let lingerTimer = null;
    function openThis() {
      faqs.forEach((f) => f.classList.remove('open'));
      faq.classList.add('open');
      trackEvent('faq_open', { faq_question: getFaqQuestion(faq), faq_index: index, trigger: 'linger' });
    }
    trigger.addEventListener('click', () => {
      const isOpen = faq.classList.contains('open');
      faqs.forEach((f) => f.classList.remove('open'));
      if (!isOpen) {
        faq.classList.add('open');
        trackEvent('faq_open', { faq_question: getFaqQuestion(faq), faq_index: index, trigger: 'click' });
      }
    });
    trigger.addEventListener('mouseenter', () => {
      lingerTimer = setTimeout(openThis, LINGER_MS);
    });
    trigger.addEventListener('mouseleave', () => {
      if (lingerTimer) clearTimeout(lingerTimer);
      lingerTimer = null;
    });
  });
})();

// Pricing feature toggles (click or linger >1s to expand, one open at a time per list)
(function () {
  const featureLists = document.querySelectorAll('.pricing-features');
  const LINGER_MS = 1000;
  if (!featureLists.length) return;

  featureLists.forEach(list => {
    const toggles = list.querySelectorAll('.feature-toggle');
    toggles.forEach(button => {
      let lingerTimer = null;
      function openThisItem() {
        const item = button.closest('.feature-item');
        const desc = document.getElementById(button.getAttribute('aria-controls'));
        if (item.classList.contains('is-open')) return;
        list.querySelectorAll('.feature-item').forEach(other => {
          other.classList.remove('is-open');
          const otherBtn = other.querySelector('.feature-toggle');
          const otherDesc = otherBtn && document.getElementById(otherBtn.getAttribute('aria-controls'));
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherDesc) otherDesc.hidden = true;
        });
        item.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        if (desc) desc.hidden = false;
        trackEvent('scope_open', { scope_item_id: button.id || '', scope_item_label: (button.textContent || '').trim().slice(0, 200), trigger: 'linger' });
      }
      button.addEventListener('click', () => {
        const item = button.closest('.feature-item');
        const desc = document.getElementById(button.getAttribute('aria-controls'));
        const isOpen = item.classList.contains('is-open');

        list.querySelectorAll('.feature-item').forEach(other => {
          other.classList.remove('is-open');
          const otherBtn = other.querySelector('.feature-toggle');
          const otherDesc = otherBtn && document.getElementById(otherBtn.getAttribute('aria-controls'));
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
          if (otherDesc) otherDesc.hidden = true;
        });

        if (!isOpen) {
          item.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
          if (desc) desc.hidden = false;
          trackEvent('scope_open', { scope_item_id: button.id || '', scope_item_label: (button.textContent || '').trim().slice(0, 200), trigger: 'click' });
        }
      });
      button.addEventListener('mouseenter', () => {
        lingerTimer = setTimeout(openThisItem, LINGER_MS);
      });
      button.addEventListener('mouseleave', () => {
        if (lingerTimer) clearTimeout(lingerTimer);
        lingerTimer = null;
      });
    });
  });
})();

// Pricing guarantee expand/collapse
(function () {
  document.querySelectorAll('.pricing-guarantee-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const group = button.closest('.pricing-guarantee');
      const detail = document.getElementById(button.getAttribute('aria-controls'));
      const isOpen = group.classList.contains('is-open');

      if (isOpen) {
        group.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        if (detail) detail.setAttribute('aria-hidden', 'true');
      } else {
        group.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
        if (detail) detail.setAttribute('aria-hidden', 'false');
      }
    });
  });
})();

// Video lightbox
const modal = document.getElementById('videoModal');
const video = document.getElementById('modalVideo');
const closeBtn = modal.querySelector('.video-close');

// Load clouds.jpg for how-it-feels section after hero video has loaded; bg fades in on section hover (CSS)
(function () {
  var heroVideoSrc = 'vids/how-to-talk-about-your-business.mp4';
  var cloudsUrl = 'images/clouds.jpg';
  var bgEl = document.getElementById('how-it-feels-bg');
  if (!bgEl) return;
  var preloadVideo = document.createElement('video');
  preloadVideo.preload = 'auto';
  preloadVideo.src = heroVideoSrc;
  function onVideoReady() {
    preloadVideo.removeEventListener('canplaythrough', onVideoReady);
    preloadVideo.removeEventListener('error', onVideoError);
    var img = new Image();
    img.onload = function () {
      bgEl.style.backgroundImage = 'url(' + cloudsUrl + ')';
    };
    img.onerror = function () { /* clouds.jpg missing or failed */ };
    img.src = cloudsUrl;
  }
  function onVideoError() {
    preloadVideo.removeEventListener('canplaythrough', onVideoReady);
    preloadVideo.removeEventListener('error', onVideoError);
    var img = new Image();
    img.onload = function () {
      bgEl.style.backgroundImage = 'url(' + cloudsUrl + ')';
    };
    img.onerror = function () {};
    img.src = cloudsUrl;
  }
  preloadVideo.addEventListener('canplaythrough', onVideoReady);
  preloadVideo.addEventListener('error', onVideoError);
  preloadVideo.load();
})();

var videoProgressThrottle = null;
var MAX_VIDEO_EVENTS_PER_SRC = 30;

function ensureVideoEntry(v, src) {
  v.videos_watched = v.videos_watched || {};
  var entry = v.videos_watched[src];
  if (typeof entry === 'number') {
    entry = { max_pct: entry, events: [] };
    v.videos_watched[src] = entry;
  } else if (!entry || typeof entry !== 'object' || !Array.isArray(entry.events)) {
    entry = { max_pct: entry && typeof entry.max_pct === 'number' ? entry.max_pct : 0, events: [] };
    v.videos_watched[src] = entry;
  }
  return entry;
}

function recordVideoEvent(src, type, pct) {
  if (!src || !type) return;
  if (!hasAcceptedCookies()) return;
  var v = getOrCreateVisitor();
  if (!v) return;
  var entry = ensureVideoEntry(v, src);
  var pctNum = typeof pct === 'number' ? Math.round(Math.min(100, Math.max(0, pct))) : 0;
  if (pctNum > entry.max_pct) entry.max_pct = pctNum;
  entry.events.push({ type: type, ts: Date.now(), pct: pctNum });
  if (entry.events.length > MAX_VIDEO_EVENTS_PER_SRC) entry.events = entry.events.slice(-MAX_VIDEO_EVENTS_PER_SRC);
  setCookie(COOKIE_VISITOR_NAME, JSON.stringify(v), COOKIE_VISITOR_DAYS);
  var analyticsType = type === 'start' ? 'video_play' : type === 'pause' ? 'video_pause' : type === 'ended' ? 'video_ended' : null;
  if (analyticsType) trackEvent(analyticsType, { video_label: src, pct: pctNum });
}

function recordVideoProgressMax(src, progressPct) {
  if (!src || typeof progressPct !== 'number') return;
  if (!hasAcceptedCookies()) return;
  var v = getOrCreateVisitor();
  if (!v) return;
  var entry = ensureVideoEntry(v, src);
  var pct = Math.round(Math.min(100, progressPct));
  if (pct > entry.max_pct) entry.max_pct = pct;
  setCookie(COOKIE_VISITOR_NAME, JSON.stringify(v), COOKIE_VISITOR_DAYS);
  trackEvent('video_progress', { video_label: src, pct: pct });
}

document.querySelectorAll('.video-thumb').forEach(button => {
  button.addEventListener('click', () => {
    video.src = button.dataset.video;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    video.currentTime = 0;
    video.play();
  });
});

function getVideoLabel(src) {
  if (!src) return '';
  try {
    var path = src.indexOf('://') !== -1 ? new URL(src).pathname : src;
    return path.replace(/^\/+/, '').split('/').pop() || path;
  } catch {
    return src.replace(/^.*\//, '');
  }
}

if (video) {
  video.addEventListener('play', function () {
    if (!video.src) return;
    var label = getVideoLabel(video.src);
    var pct = (video.duration > 0 && !isNaN(video.duration)) ? (video.currentTime / video.duration) * 100 : 0;
    recordVideoEvent(label, 'start', pct);
  });
  video.addEventListener('timeupdate', function () {
    if (videoProgressThrottle) return;
    videoProgressThrottle = setTimeout(function () {
      videoProgressThrottle = null;
      if (!video.src || video.duration <= 0) return;
      var pct = (video.currentTime / video.duration) * 100;
      recordVideoProgressMax(getVideoLabel(video.src), pct);
    }, 2000);
  });
  video.addEventListener('pause', function () {
    if (!video.src) return;
    var label = getVideoLabel(video.src);
    var pct = (video.duration > 0 && !isNaN(video.duration)) ? (video.currentTime / video.duration) * 100 : 0;
    recordVideoEvent(label, 'pause', pct);
  });
  video.addEventListener('ended', function () {
    if (!video.src) return;
    var label = getVideoLabel(video.src);
    recordVideoEvent(label, 'ended', 100);
  });
}

function closeVideoModal(opts) {
  if (opts && opts.source) trackEvent('video_modal_close', { source: opts.source });
  modal.classList.remove('active');
  document.body.style.overflow = '';
  video.pause();
  video.src = '';
}

closeBtn.addEventListener('click', function () { closeVideoModal({ source: 'button' }); });

modal.addEventListener('click', e => {
  if (e.target === modal) closeVideoModal({ source: 'backdrop' });
});

// App modal (book a call, website review, lead magnets)
const appModal = document.getElementById('appModal');
const appModalDialog = appModal && appModal.querySelector('.app-modal__dialog');
const appModalCloseBtn = appModal && appModal.querySelector('.app-modal__close');
const appModalPanels = appModal && appModal.querySelectorAll('.app-modal__panel');

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]';

// Easter egg: placeholder hints cycle through glamorous female actors/megastars
const PLACEHOLDER_STARS = [
  { name: 'Meryl Streep', email: 'meryl@streep.com' },
  { name: 'Cate Blanchett', email: 'cate@blanchett.com' },
  { name: 'Viola Davis', email: 'viola@davis.com' },
  { name: 'Nicole Kidman', email: 'nicole@kidman.com' },
  { name: 'Charlize Theron', email: 'charlize@theron.com' },
  { name: 'Catherine Zeta-Jones', email: 'catherine@zetajones.com' },
  { name: 'Helen Mirren', email: 'helen@mirren.com' },
  { name: 'Dame Judi Dench', email: 'judi@dench.com' },
  { name: 'Jennifer Coolidge', email: 'jennifer@coolidge.com' },
  { name: 'Sandra Bullock', email: 'sandra@bullock.com' },
  { name: 'Julia Roberts', email: 'julia@roberts.com' },
  { name: 'Reese Witherspoon', email: 'reese@witherspoon.com' },
  { name: 'Scarlett Johansson', email: 'scarlett@johansson.com' },
  { name: 'Margot Robbie', email: 'margot@robbie.com' },
  { name: 'Lupita Nyong\'o', email: 'lupita@nyongo.com' },
  { name: 'Zendaya', email: 'zendaya@hollywood.com' },
  { name: 'Florence Pugh', email: 'florence@pugh.com' },
  { name: 'Emma Stone', email: 'emma@stone.com' },
  { name: 'Lady Gaga', email: 'gaga@haus.com' },
  { name: 'Rihanna', email: 'rihanna@fenty.com' }
];

function applyRandomStarPlaceholders() {
  if (!appModal) return;
  const star = PLACEHOLDER_STARS[Math.floor(Math.random() * PLACEHOLDER_STARS.length)];
  const namePlaceholder = 'e.g. ' + star.name;
  appModal.querySelectorAll('input[name="name"]').forEach(function (el) {
    el.placeholder = namePlaceholder;
    el.dataset.placeholderOrig = namePlaceholder;
  });
  appModal.querySelectorAll('input[name="email"]').forEach(function (el) {
    el.placeholder = star.email;
    el.dataset.placeholderOrig = star.email;
  });
  trackEvent('easter_egg_star', { star_name: star.name });
}

// --- Easter egg competition: 10 hidden communicators (when easter_eggs_competition_showing) ---
(function () {
  var EASTER_EGG_COPY = {
    formPlaceholder: 'e.g. [Name]',
    formPlaceholderNoName: 'e.g. Your name',
    rescueEyebrowTooltip: 'Why not let us turn your shit to [Name]?',
    successAppend: 'P.S. Broad, sunlit uplands, here we come. As [Name] may have put it.',
    guidePicTitle: 'Not exactly [Name]. But I\'ve come a long way.',
    termsClause: 'As [Name] said, clarity is the first virtue of persuasion.',
    mayaQuote: '"People will forget what you said, people will forget what you did, but people will never forget how you made them feel"',
    mayaAttribution: ' ~ [Name] (not a client)',
    deliverableAppend: 'In the spirit of [Name], we keep it clear and persuasive.',
    rescueEyebrowDelaySec: 1,
    menuFooterProud: '[Name] would be proud.'
  };

  var names = null;
  function getEasterEggNames() {
    if (names) return names;
    if (!getSettings().easter_eggs_competition_showing) return null;
    try {
      var b64 = 'WyJXaW5zdG9uIENodXJjaGlsbCIsIlNoYWtlc3BlYXJlIiwiRGF2aWQgT2dpbHZ5IiwiU2V0aCBHb2RpbiIsIlN0ZXZlIEpvYnMiLCJPcHJhaCBXaW5mcmV5IiwiQnJlbmUgQnJvd24iLCJNYXJ0aW4gTHV0aGVyIEtpbmcgSnIuIiwiTWF5YSBBbmdlbG91IiwiVG9tIFdhaXRzIl0=';
      names = JSON.parse(atob(b64));
      return names;
    } catch (e) {
      return null;
    }
  }

  function applyEasterEggPlaceholders() {
    if (!appModal) return;
    var n = getEasterEggNames();
    if (!n || n.length < 10) return;
    var formNames = {
      'form-book-call': n[5],
      'form-website-review': n[4],
      'form-lead-50things': n[6],
      'form-lead-offboarding': n[3],
      'form-lead-socialproof': null
    };
    appModal.querySelectorAll('input[name="name"]').forEach(function (el) {
      var form = el.closest('form');
      var formId = form && form.id ? form.id : '';
      var name = formNames[formId];
      var ph = (name != null)
        ? EASTER_EGG_COPY.formPlaceholder.replace('[Name]', name)
        : (EASTER_EGG_COPY.formPlaceholderNoName || 'e.g. Your name');
      el.placeholder = ph;
      el.dataset.placeholderOrig = ph;
    });
    appModal.querySelectorAll('input[name="email"]').forEach(function (el) {
      var form = el.closest('form');
      var formId = form && form.id ? form.id : '';
      el.placeholder = 'you@company.com';
      el.dataset.placeholderOrig = 'you@company.com';
    });
  }

  function runPlaceholders() {
    if (getSettings().easter_eggs_competition_showing && getEasterEggNames()) {
      applyEasterEggPlaceholders();
    } else {
      applyRandomStarPlaceholders();
    }
  }

  window.applyEasterEggPlaceholders = applyEasterEggPlaceholders;
  window.getEasterEggNames = getEasterEggNames;
  window.EASTER_EGG_COPY = EASTER_EGG_COPY;
  window.runPlaceholders = runPlaceholders;
})();

let lastAppModalTrigger = null;

function getBookCallPanel() {
  return appModal && appModal.querySelector('.app-modal__panel[data-panel="book-call"]');
}

function showBookCallCalendarView() {
  const panel = getBookCallPanel();
  if (panel) panel.classList.add('app-modal__panel--calendar-view');
  if (appModal) appModal.classList.add('app-modal--calendar-view');
  const wrap = document.getElementById('app-modal-calendar-wrap');
  if (wrap) wrap.setAttribute('aria-hidden', 'false');
}

function hideBookCallCalendarView() {
  const panel = getBookCallPanel();
  if (panel) panel.classList.remove('app-modal__panel--calendar-view');
  if (appModal) appModal.classList.remove('app-modal--calendar-view');
  const wrap = document.getElementById('app-modal-calendar-wrap');
  if (wrap) wrap.setAttribute('aria-hidden', 'true');
}

function openAppModal(panelId, opts) {
  if (!appModal || !appModalPanels) return;
  opts = opts || {};
  appModalPanels.forEach(panel => resetPanelForm(panel));
  hideBookCallCalendarView();

  if (typeof runPlaceholders === 'function') runPlaceholders();
  else applyRandomStarPlaceholders();

  lastAppModalTrigger = document.activeElement;
  appModal.classList.add('active');
  appModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  appModalPanels.forEach(panel => {
    const isActive = panel.getAttribute('data-panel') === panelId;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', !isActive);
  });

  if (panelId === 'book-call' && opts.showCalendar) showBookCallCalendarView();

  const activePanel = appModal.querySelector('.app-modal__panel.active');
  if (activePanel) {
    if (appModalDialog) appModalDialog.scrollTop = 0;
    const scrollCol = activePanel.querySelector('.app-modal__one-col');
    if (scrollCol && scrollCol.scrollHeight > scrollCol.clientHeight) scrollCol.scrollTop = 0;
    const privacyBody = activePanel.querySelector('.app-modal__privacy-body');
    if (privacyBody) privacyBody.scrollTop = 0;
  }
  if (panelId === 'privacy-policy') {
    trackEvent('privacy_open', {});
    history.replaceState(null, '', (window.location.pathname || '') + (window.location.search || '') + '#privacy');
  } else if (panelId === 'terms-and-conditions') {
    trackEvent('tc_open', {});
    history.replaceState(null, '', (window.location.pathname || '') + (window.location.search || '') + '#terms');
  } else if (['book-call', 'website-review', 'lead-50things', 'lead-offboarding', 'lead-socialproof'].indexOf(panelId) !== -1) {
    trackEvent('form_open', { form_id: panelId, trigger: lastModalTriggerType || '' });
  }

  const firstFocusable = activePanel
    ? (activePanel.querySelector(FOCUSABLE_SELECTOR) || appModalCloseBtn)
    : appModalCloseBtn;
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 50);
  }
}

function closeAppModal(opts) {
  if (!appModal) return;
  if (opts && opts.source) {
    var activePanel = appModal.querySelector('.app-modal__panel.active');
    trackEvent('modal_close', { source: opts.source, panel_id: activePanel ? activePanel.getAttribute('data-panel') : null });
  }
  hideBookCallCalendarView();
  appModal.classList.remove('active');
  appModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  appModalPanels.forEach(panel => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
  });
  if (window.location.hash === '#privacy' || window.location.hash === '#terms') {
    history.replaceState(null, '', (window.location.pathname || '') + (window.location.search || ''));
  }
  if (lastAppModalTrigger && typeof lastAppModalTrigger.focus === 'function') {
    lastAppModalTrigger.focus();
  }
  lastAppModalTrigger = null;
}

function recordButtonClick(buttonId, modalPanelId) {
  if (!hasAcceptedCookies()) return;
  const v = getOrCreateVisitor();
  if (!v) return;
  v.buttons_clicked = v.buttons_clicked || [];
  v.buttons_clicked.push({ id: buttonId || '', modal: modalPanelId || '', ts: Date.now() });
  if (v.buttons_clicked.length > 30) v.buttons_clicked = v.buttons_clicked.slice(-30);
  setCookie(COOKIE_VISITOR_NAME, JSON.stringify(v), COOKIE_VISITOR_DAYS);
  trackEvent('click', { button_id: buttonId || '', modal_panel: modalPanelId || '' });
}

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-modal]');
  if (trigger) {
    e.preventDefault();
    if (getSettings().maintenance_mode) return;
    lastModalTriggerType = 'button';
    lastTriggerButtonId = trigger.id || null;
    const panelId = trigger.getAttribute('data-modal');
    recordButtonClick(trigger.id || null, panelId || null);
    const showCalendar = trigger.getAttribute('data-show-calendar') === 'true';
    if (showCalendar && trigger.id === 'footer-calendar-link') {
      trackEvent('cal_link_click', { source: 'footer' });
    }
    if (panelId) openAppModal(panelId, { showCalendar: showCalendar });
  }
});

if (appModalCloseBtn) {
  appModalCloseBtn.addEventListener('click', function () { closeAppModal({ source: 'button' }); });
}

var appModalCalendarClose = document.querySelector('.app-modal__calendar-close');
if (appModalCalendarClose) {
  appModalCalendarClose.addEventListener('click', function () {
    hideBookCallCalendarView();
  });
}

var appModalShowCalendarLink = document.getElementById('app-modal-calendar-link');
if (appModalShowCalendarLink) {
  appModalShowCalendarLink.addEventListener('click', function (e) {
    e.preventDefault();
    trackEvent('cal_link_click', { source: 'modal' });
    showBookCallCalendarView();
  });
}

if (appModal) {
  appModal.addEventListener('click', e => {
    if (e.target === appModal) closeAppModal({ source: 'backdrop' });
  });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (modal && modal.classList.contains('active')) {
    closeVideoModal({ source: 'escape' });
    return;
  }
  if (appModal && appModal.classList.contains('active')) {
    closeAppModal({ source: 'escape' });
  }
});

// Open modal from URL (e.g. ?modal=website-review for shared links)
const VALID_MODAL_IDS = new Set([
  'book-call',
  'website-review',
  'lead-50things',
  'lead-offboarding',
  'lead-socialproof'
]);

function openModalFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let panelId = params.get('modal');
  const settings = getSettings();
  if ((!panelId || panelId === '') && settings.default_modal && VALID_MODAL_IDS.has(settings.default_modal)) {
    panelId = settings.default_modal;
  }
  if (!panelId || !VALID_MODAL_IDS.has(panelId)) return;
  if (panelId === 'website-review' && !settings.wrv_offer) return;
  if (panelId === 'book-call' && !settings.book_call_offer) return;
  if (VALID_MODAL_IDS.has(panelId) && getEnabledLeadMagnetIds().indexOf(panelId) === -1) return;
  lastModalTriggerType = 'url';
  setTimeout(() => {
    openAppModal(panelId);
    if (panelId === 'website-review') {
      sessionStorage.setItem('appModalAutodialogShown', '1');
    }
  }, 0);
}

function openAppModalFromHash() {
  const hash = window.location.hash;
  if (hash === '#privacy') {
    openAppModal('privacy-policy');
    return true;
  }
  if (hash === '#terms') {
    openAppModal('terms-and-conditions');
    return true;
  }
  return false;
}
if (!openAppModalFromHash()) {
  openModalFromUrl();
}

window.addEventListener('hashchange', function () {
  if (window.location.hash === '#privacy' || window.location.hash === '#terms') {
    openAppModalFromHash();
  } else if (appModal && appModal.classList.contains('active')) {
    const activePanel = appModal.querySelector('.app-modal__panel.active');
    if (activePanel && (activePanel.id === 'privacy' || activePanel.id === 'terms')) {
      closeAppModal();
    }
  }
});

// Auto dialog: one modal, two optional triggers (exit intent + inactivity). Shown at most once per session.
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function getAutodialogPanelId() {
  const settings = getSettings();
  let form = (settings.autodialog_form_to_show || 'wrv').toLowerCase();
  if (form === 'wrv') form = 'website-review';
  if (!VALID_MODAL_IDS.has(form)) return null;
  if (form === 'website-review' && !settings.wrv_offer) return null;
  if (form === 'book-call' && !settings.book_call_offer) return null;
  if (getEnabledLeadMagnetIds().indexOf(form) === -1) return null;
  return form;
}

// Trigger: exit intent (mouse leaving top of viewport, desktop only)
if (getSettings().autodialog_to_be_shown_on_exit_intent) {
  document.addEventListener('mouseout', e => {
    if (isTouchDevice()) return;
    if (e.relatedTarget) return;
    if (e.clientY > 10) return;
    if (sessionStorage.getItem('appModalAutodialogShown')) return;
    const panelId = getAutodialogPanelId();
    if (!panelId) return;
    sessionStorage.setItem('appModalAutodialogShown', '1');
    lastModalTriggerType = 'exit_intent';
    openAppModal(panelId);
  });
}

// Trigger: after N seconds of inactivity
(function () {
  const settings = getSettings();
  const seconds = settings.autodialog_to_be_shown_after_delay_s;
  if (seconds <= 0) return;
  const panelId = getAutodialogPanelId();
  if (!panelId) return;

  let inactivityTimer = null;
  function schedule() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(function () {
      if (sessionStorage.getItem('appModalAutodialogShown')) return;
      sessionStorage.setItem('appModalAutodialogShown', '1');
      lastModalTriggerType = 'inactivity';
      openAppModal(panelId);
    }, seconds * 1000);
  }
  function onActivity() {
    schedule();
  }
  schedule();
  document.addEventListener('mousemove', onActivity, { passive: true });
  document.addEventListener('keydown', onActivity, { passive: true });
  document.addEventListener('scroll', onActivity, { passive: true });
  document.addEventListener('touchstart', onActivity, { passive: true });
})();

// Apply offer toggles: hide CTAs when offers are disabled
(function applyOfferToggles() {
  const settings = getSettings();
  if (!settings.wrv_offer) {
    document.querySelectorAll('[data-modal="website-review"]').forEach(function (el) {
      el.style.setProperty('display', 'none');
    });
  }
  if (!settings.book_call_offer) {
    document.querySelectorAll('[data-modal="book-call"]').forEach(function (el) {
      el.style.setProperty('display', 'none');
    });
  }
  var enabledLmIds = getEnabledLeadMagnetIds();
  if (enabledLmIds.length === 0) {
    document.querySelectorAll('[data-modal="lead-50things"], [data-modal="lead-offboarding"], [data-modal="lead-socialproof"]').forEach(function (el) {
      el.style.setProperty('display', 'none');
    });
    var resourcesSection = document.getElementById('resources');
    if (resourcesSection) resourcesSection.style.setProperty('display', 'none');
  } else {
    ['lead-50things', 'lead-offboarding', 'lead-socialproof'].forEach(function (id) {
      if (enabledLmIds.indexOf(id) === -1) {
        document.querySelectorAll('[data-modal="' + id + '"]').forEach(function (el) {
          el.style.setProperty('display', 'none');
          var li = el.closest('li');
          if (li) li.style.setProperty('display', 'none');
        });
      }
    });
  }
  if (!settings.show_pricing) {
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) pricingSection.style.setProperty('display', 'none');
    document.querySelectorAll('a[href="#pricing"]').forEach(function (el) {
      el.style.setProperty('display', 'none');
    });
  }
})();

// Mobile menu: open/close, close on link click, body scroll lock
(function () {
  const menu = document.getElementById('mobile-menu');
  const hamburger = document.querySelector('.hamburger');
  const closeBtn = menu && menu.querySelector('.mobile-menu__close');
  if (!menu || !hamburger) return;

  function openMobileMenu() {
    menu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var yearEl = document.getElementById('mobile-menu-year');
    if (yearEl && !yearEl.textContent) yearEl.textContent = new Date().getFullYear();
    if (closeBtn) closeBtn.focus();
    trackEvent('menu_open', {});
  }

  function closeMobileMenu(source) {
    if (source) trackEvent('menu_close', { source: source });
    menu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', function () {
    openMobileMenu();
  });
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeMobileMenu('button');
    });
  }

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) closeMobileMenu('link');
  });

  // Close menu when any link inside it is clicked (capture phase so menu closes before modal/navigation)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('#mobile-menu a');
    if (link && menu.getAttribute('aria-hidden') === 'false') {
      closeMobileMenu('link');
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu.getAttribute('aria-hidden') === 'false') {
      closeMobileMenu('escape');
    }
  });
})();

// Problem & Rescue expanders (sub 900px): toggle on + or header click, track in analytics
(function () {
  document.addEventListener('click', function (e) {
    var block = e.target.closest('[data-expander]');
    if (!block) return;
    var btn = block.querySelector('[data-expander-toggle]');
    var clickedToggle = e.target.closest('[data-expander-toggle]');
    var clickedHeader = e.target.closest('.problem-card__header, .rescue-block__head, .pricing-features-expander__head');
    var interactive = e.target.closest('a, button:not(.expander-toggle), .video-thumb, input, textarea, select');
    if (!clickedToggle && !clickedHeader && interactive) return;
    e.preventDefault();
    var expanded = block.classList.toggle('is-expanded');
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (expanded) {
      var section = block.getAttribute('data-expander-section') ||
        (block.classList.contains('problem-card') ? 'problem' : block.classList.contains('pricing-features-expander') ? 'pricing' : 'rescue');
      var parent = block.parentNode;
      var siblings = parent ? parent.querySelectorAll('[data-expander]') : [];
      var index = 1 + Array.prototype.indexOf.call(siblings, block);
      trackEvent('expander_open', { section: section, index: index });
    }
  });
})();

// Nav anchor links: smooth scroll with ease-out (fast start, slow at end; no ease-in-out)
(function () {
  var duration = 700;
  function easeOut(t) {
    return 1 - (1 - t) * (1 - t) * (1 - t);
  }
  function smoothScrollTo(targetY) {
    window._programmaticScrollActive = true;
    var startY = window.scrollY || window.pageYOffset;
    var dist = targetY - startY;
    var start = performance.now();
    function step(now) {
      var elapsed = now - start;
      var t = Math.min(elapsed / duration, 1);
      var eased = easeOut(t);
      window.scrollTo(0, startY + dist * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        window._programmaticScrollActive = false;
      }
    }
    requestAnimationFrame(step);
  }
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link || !link.hash) return;
    var id = link.hash.slice(1);
    // #top = scroll all the way to the top (0) so logo click doesn't leave a gap
    if (id === 'top') {
      e.preventDefault();
      smoothScrollTo(0);
      if (history.replaceState) history.replaceState(null, '', link.hash);
      return;
    }
    // Only smooth-scroll other anchors when from main nav or mobile nav
    if (!link.matches('.main-nav a[href^="#"], .mobile-menu__nav a[href^="#"]')) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    var headerOffset = 72;
    var y = target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset) - headerOffset;
    smoothScrollTo(Math.max(0, y));
    if (history.replaceState) history.replaceState(null, '', link.hash);
  });
})();

// Book-a-call calendar link (from settings)
(function () {
  const url = getSettings().book_call_calendar_url || 'https://calendar.app.google/8jiSEYPb3YYouyXq9';
  const calLink = document.getElementById('app-modal-calendar-link');
  if (calLink && calLink.hasAttribute('href') && calLink.getAttribute('href') !== '#') calLink.href = url;
  const mobileCalLink = document.getElementById('mobile-menu-calendar-link');
  if (mobileCalLink) {
    mobileCalLink.href = url;
    mobileCalLink.addEventListener('click', function () { trackEvent('cal_link_click', { source: 'mobile' }); });
  }
  /* Footer calendar link opens modal with embedded calendar; do not set href */
})();

// Show/hide contact email; CTA style; rescue section layout
(function () {
  const g = getSettings();
  document.body.classList.toggle('show-email', g.show_email);
  document.body.classList.toggle('cta-primary-black', g.cta_primary_black);
  var rescue = document.getElementById('rescue');
  if (rescue) rescue.classList.toggle('rescue-no-videos', !g.rescue_section_show_videos);
})();

// Maintenance mode overlay
(function () {
  if (!getSettings().maintenance_mode) return;
  const msg = getSettings().maintenance_message;
  const esc = document.createElement('div');
  esc.textContent = msg;
  const safeMsg = esc.innerHTML;
  const overlay = document.createElement('div');
  overlay.id = 'maintenance-overlay';
  overlay.className = 'maintenance-overlay';
  overlay.setAttribute('role', 'alert');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = '<div class="maintenance-overlay__inner"><p class="maintenance-overlay__text">' + safeMsg + '</p></div>';
  document.body.appendChild(overlay);
})();

// Google Analytics loaded in index.html <head> (uses ga_id from settings.js / CMS)
// Keep gtag available for custom events; config is already applied in HTML
window.gtag = window.gtag || function () { (window.dataLayer = window.dataLayer || []).push(arguments); };

// Focus trap inside app modal
if (appModalDialog) {
  appModalDialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !appModal.classList.contains('active')) return;
    const focusable = appModalDialog.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

// Form validation: inline errors, no native tooltips
function isUrlValueValid(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (!t) return true;
  try {
    new URL(t);
    return true;
  } catch {
    try {
      new URL('https://' + t);
      return true;
    } catch {
      return false;
    }
  }
}

function validateForm(form) {
  let isValid = true;
  const fields = form.querySelectorAll('input[aria-describedby*="-error"], textarea[aria-describedby*="-error"]');

  fields.forEach((field) => {
    const errorId = field.getAttribute('aria-describedby');
    const errorEl = errorId ? document.getElementById(errorId) : null;
    const isUrlField = field.type === 'url';
    const urlValid = isUrlField ? isUrlValueValid(field.value) : true;
    const valid = isUrlField
      ? (field.validity.valueMissing ? !field.required : urlValid)
      : field.checkValidity();

    if (!valid) {
      isValid = false;
      field.classList.add('invalid');
      field.setAttribute('aria-invalid', 'true');
      var msg = field.validity.valueMissing && field.required ? 'This field is required.' : getTypeMessage(field);
      if (errorEl) errorEl.textContent = msg;
      field.placeholder = msg;
    } else {
      field.classList.remove('invalid');
      field.setAttribute('aria-invalid', 'false');
      if (errorEl) errorEl.textContent = '';
      field.placeholder = field.dataset.placeholderOrig || '';
    }
  });

  return isValid;
}

function getTypeMessage(field) {
  if (field.type === 'email') return 'Please enter a valid email address.';
  if (field.type === 'url') return 'Please enter a valid website address.';
  return 'This field is required.';
}

function setupFormValidation(form) {
  const fields = form.querySelectorAll('input[aria-describedby*="-error"], textarea[aria-describedby*="-error"]');
  fields.forEach((field) => {
    if (!field.dataset.placeholderOrig) field.dataset.placeholderOrig = field.getAttribute('placeholder') || '';
    field.addEventListener('input', clearFieldError);
    field.addEventListener('change', clearFieldError);
  });
}

function clearFieldError() {
  const field = this;
  const errorId = field.getAttribute('aria-describedby');
  const errorEl = errorId ? document.getElementById(errorId) : null;
  const isUrlField = field.type === 'url';
  const valid = isUrlField
    ? (field.validity.valueMissing ? !field.required : isUrlValueValid(field.value))
    : field.checkValidity();
  if (valid) {
    field.classList.remove('invalid');
    field.setAttribute('aria-invalid', 'false');
    if (errorEl) errorEl.textContent = '';
    field.placeholder = field.dataset.placeholderOrig || '';
  }
}

// Success: replace whole modal panel (both cols) with animated success screen
function showSuccessScreen(panel, message) {
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col, .app-modal__one-col');
  contentEls.forEach(function (el) { el.hidden = true; });
  const successFull = panel.querySelector('.app-modal__success-full');
  if (successFull) {
    var html = '<div class="app-modal__success-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div><p class="app-modal__success-message">' + escapeHtml(message) + '</p>';
    if (getSettings().easter_eggs_competition_showing && typeof getEasterEggNames === 'function') {
      var n = getEasterEggNames();
      if (n && n[0]) {
        var copy = (typeof EASTER_EGG_COPY !== 'undefined' && EASTER_EGG_COPY.successAppend) ? EASTER_EGG_COPY.successAppend : 'P.S. [Name] would approve.';
        html += '<p class="app-modal__success-easter">' + escapeHtml(copy.replace('[Name]', n[0])) + '</p>';
      }
    }
    successFull.innerHTML = html;
    successFull.hidden = false;
  }
}

function showPanelError(panel, text) {
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col, .app-modal__one-col');
  contentEls.forEach(function (el) { el.hidden = false; });
  const successFull = panel.querySelector('.app-modal__success-full');
  if (successFull) successFull.hidden = true;
  const messageBox = panel.querySelector('.app-modal__panel-message');
  if (messageBox) {
    messageBox.textContent = text;
    messageBox.className = 'app-modal__panel-message error';
    messageBox.hidden = false;
  }
}

// Clear, specific error messages (never show generic "Something went wrong")
function getSubmitErrorMessage(err, res, data) {
  if (err) {
    return 'We couldn\'t reach the server. Please check your connection and try again.';
  }
  if (res && res.status === 429) {
    return (data && data.error) ? data.error : 'Too many attempts. Please wait a minute and try again.';
  }
  if (data && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }
  if (res && !res.ok) {
    if (res.status >= 500) return 'Server error. Please try again — if it keeps happening, check server logs (pm2 logs vk-form-handler).';
    return 'The server couldn\'t process your request. Please try again.';
  }
  return 'Your request couldn\'t be completed. Please try again.';
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function resetPanelForm(panel) {
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col, .app-modal__one-col');
  contentEls.forEach(function (el) { el.hidden = false; });
  const messageBox = panel.querySelector('.app-modal__panel-message');
  if (messageBox) {
    messageBox.hidden = true;
    messageBox.textContent = '';
    messageBox.className = 'app-modal__panel-message';
  }
  const successFull = panel.querySelector('.app-modal__success-full');
  if (successFull) {
    successFull.hidden = true;
    successFull.innerHTML = '';
  }
  const form = panel.querySelector('form');
  if (form) {
    form.reset();
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.setAttribute('aria-invalid', 'false'));
    form.querySelectorAll('.error-message').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('input[data-placeholder-orig], textarea[data-placeholder-orig]').forEach(function (el) {
      el.placeholder = el.dataset.placeholderOrig || '';
    });
  }
}

function getActiveAppModalPanel() {
  return appModal && appModal.querySelector('.app-modal__panel.active');
}

// Setup validation on all forms with error elements
document.querySelectorAll('form[novalidate]').forEach(setupFormValidation);

function idempotencyKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'k_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

function buildSubmitPayload(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.form_id = form.id || '';
  payload.trigger_button_id = lastTriggerButtonId || (form.querySelector('button[type="submit"]') && form.querySelector('button[type="submit"]').id) || null;
  payload.modal_trigger_type = lastModalTriggerType || null;
  payload.idempotency_key = idempotencyKey();
  payload._context = getContextForSubmit(payload.trigger_button_id);
  return payload;
}

function guardMaintenance(e) {
  if (getSettings().maintenance_mode) {
    e.preventDefault();
    return true;
  }
  return false;
}

function setSubmitButtonLoading(form, loading) {
  const btn = form && form.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
  if (loading) {
    btn._loadingOriginalContent = btn.innerHTML;
    btn.innerHTML = '';
  } else if (btn._loadingOriginalContent !== undefined) {
    btn.innerHTML = btn._loadingOriginalContent;
    delete btn._loadingOriginalContent;
  }
}

// Website review form
const formWebsiteReview = document.getElementById('form-website-review');
if (formWebsiteReview) {
  formWebsiteReview.addEventListener('submit', function (e) {
    e.preventDefault();
    if (guardMaintenance(e)) return;
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const payload = buildSubmitPayload(this);
    setSubmitButtonLoading(this, true);
    trackEvent('form_submit', { form_id: this.id || 'form-website-review', has_email: true });

    fetch(window.API_BASE + '/website-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data, res })).catch(() => ({ ok: false, data: {}, res })))
      .then(({ ok, data, res }) => {
        if (panel) {
          if (ok) {
            recordFormSubmission(this.id);
            showSuccessScreen(panel, data.message || 'Thanks – we\'ll be in touch with your review soon.');
          } else {
            showPanelError(panel, getSubmitErrorMessage(null, res, data));
          }
        }
      })
      .catch((err) => {
        if (panel) showPanelError(panel, getSubmitErrorMessage(err));
      })
      .finally(() => { setSubmitButtonLoading(this, false); });
  });
}

// Book a call form
const formBookCall = document.getElementById('form-book-call');
if (formBookCall) {
  formBookCall.addEventListener('submit', function (e) {
    e.preventDefault();
    if (guardMaintenance(e)) return;
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const payload = buildSubmitPayload(this);
    setSubmitButtonLoading(this, true);
    trackEvent('form_submit', { form_id: this.id || 'form-book-call', has_email: true });

    fetch(window.API_BASE + '/book-a-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data, res })).catch(() => ({ ok: false, data: {}, res })))
      .then(({ ok, data, res }) => {
        if (panel) {
          if (ok) {
            recordFormSubmission(this.id);
            showSuccessScreen(panel, data.message || 'Thanks – we\'ll be in touch soon.');
          } else {
            showPanelError(panel, getSubmitErrorMessage(null, res, data));
          }
        }
      })
      .catch((err) => {
        if (panel) showPanelError(panel, getSubmitErrorMessage(err));
      })
      .finally(() => { setSubmitButtonLoading(this, false); });
  });
}

// #region agent log – text switcher overlap (H1/H3/H4)
(function () {
  const btnText = document.querySelector('.hero-ctas .btn-text');
  if (!btnText) return;
  const defaultSpan = btnText.querySelector('.btn-text-default');
  const hoverSpan = btnText.querySelector('.btn-text-hover');
  const btn = btnText.closest('.btn');
  if (!defaultSpan || !hoverSpan || !btn) return;
  function logWidths(source) {
    const r = btnText.getBoundingClientRect();
    const d = defaultSpan.getBoundingClientRect();
    const h = hoverSpan.getBoundingClientRect();
    const csDef = getComputedStyle(defaultSpan);
    const csHov = getComputedStyle(hoverSpan);
    fetch('http://127.0.0.1:7242/ingest/f2cf9272-f115-412f-aa66-bbf2deac994d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:text-switcher',message:'hero CTA text widths',data:{source,btnTextWidth:r.width,defaultWidth:d.width,hoverWidth:h.width,defaultTransform:csDef.transform,hoverTransform:csHov.transform,defaultNarrowerThanGrid:d.width<r.width},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
  }
  logWidths('load');
  btn.addEventListener('mouseenter', function once() {
    logWidths('mouseenter');
    btn.removeEventListener('mouseenter', once);
  }, { once: true });
})();
// #endregion

// Lead magnet forms (only enabled LMs from settings)
getEnabledLeadMagnetIds().forEach(function (id) {
  const form = document.getElementById('form-' + id);
  if (!form) return;
  const config = getLeadMagnetConfig(id);
  const successMessage = (config.success_message && config.success_message.trim()) ? config.success_message.trim() : 'Thanks! Check your email.';
  const mailchimpTag = (config.mailchimp_tag && config.mailchimp_tag.trim()) ? config.mailchimp_tag.trim() : id;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (guardMaintenance(e)) return;
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const payload = buildSubmitPayload(this);
    payload.source = this.getAttribute('data-source') || id;
    payload.mailchimp_tag = mailchimpTag;
    setSubmitButtonLoading(this, true);
    trackEvent('form_submit', { form_id: this.id || ('form-' + id), has_email: true });

    fetch(window.API_BASE + '/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data, res })).catch(() => ({ ok: false, data: {}, res })))
      .then(({ ok, data, res }) => {
        if (panel) {
          if (ok) {
            recordFormSubmission(this.id);
            showSuccessScreen(panel, data.message || successMessage);
          } else {
            showPanelError(panel, getSubmitErrorMessage(null, res, data));
          }
        }
      })
      .catch((err) => {
        if (panel) showPanelError(panel, getSubmitErrorMessage(err));
      })
      .finally(() => { setSubmitButtonLoading(this, false); });
  });
});

// Hero LinkedIn faces: populate from SITE_SETTINGS.linkedin_faces (name, role, photo) with hover tooltip
(function () {
  const container = document.getElementById('hero-linkedin-faces');
  if (!container) return;
  const list = window.SITE_SETTINGS && Array.isArray(window.SITE_SETTINGS.linkedin_faces) ? window.SITE_SETTINGS.linkedin_faces : [];
  const base = 'images/li_mugs/';
  list.forEach(function (person) {
    const name = (person.name && String(person.name).trim()) || '';
    const role = (person.role && String(person.role).trim()) || '';
    const photo = (person.photo && String(person.photo).trim()) || '';
    if (!photo) return;
    const span = document.createElement('span');
    span.className = 'avatar';
    const tooltipText = [name, role].filter(Boolean).join(' – ');
    if (tooltipText) {
      const tooltip = document.createElement('span');
      tooltip.className = 'avatar-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = tooltipText;
      span.appendChild(tooltip);
    }
    const img = document.createElement('img');
    img.src = base + encodeURIComponent(photo);
    img.alt = name || '';
    img.width = 36;
    img.height = 36;
    img.loading = 'lazy';
    img.decoding = 'async';
    const imgWrap = document.createElement('span');
    imgWrap.className = 'avatar-img';
    imgWrap.appendChild(img);
    span.appendChild(imgWrap);
    container.appendChild(span);
  });
})();

// Dark mode: detect system on first load, then allow switch to override; detect system changes when following system
(function () {
  var STORAGE_KEY = 'vk_theme';
  var OLD_KEY = 'vk_dark_mode';
  var html = document.documentElement;
  var input = document.getElementById('dark-mode-switch');
  if (!input) return;

  try {
    if (!localStorage.getItem(STORAGE_KEY) && localStorage.getItem(OLD_KEY) !== null) {
      var old = localStorage.getItem(OLD_KEY);
      localStorage.setItem(STORAGE_KEY, old === 'true' ? 'dark' : 'light');
      localStorage.removeItem(OLD_KEY);
    }
  } catch (e) {}

  function prefersDark() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  }

  function setDarkMode(on) {
    if (on) {
      html.classList.add('dark-mode');
      input.checked = true;
      input.setAttribute('aria-checked', 'true');
    } else {
      html.classList.remove('dark-mode');
      input.checked = false;
      input.setAttribute('aria-checked', 'false');
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  if (saved === 'dark' || saved === 'light') {
    setDarkMode(saved === 'dark');
  } else {
    setDarkMode(prefersDark());
  }

  input.addEventListener('change', function () {
    var on = input.checked;
    setDarkMode(on);
    try { localStorage.setItem(STORAGE_KEY, on ? 'dark' : 'light'); } catch (e) {}
    if (typeof trackEvent === 'function') trackEvent('theme_switch', { trigger: 'manual', to: on ? 'dark' : 'light' });
  });

  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      try {
        if (localStorage.getItem(STORAGE_KEY) === null || localStorage.getItem(STORAGE_KEY) === '') {
          var on = prefersDark();
          setDarkMode(on);
          if (typeof trackEvent === 'function') trackEvent('theme_switch', { trigger: 'system', to: on ? 'dark' : 'light' });
        }
      } catch (e) {}
    });
  } catch (e) {}
})();

// --- Light parallax and scroll-triggered reveal (cosmetic) ---
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var hero = document.querySelector('.hero');
    var heroHeader = hero && hero.querySelector('.hero-header');
    var heroLeft = hero && hero.querySelector('.hero-left');
    var heroRight = hero && hero.querySelector('.hero-right');

    // Parallax: subtle movement for hero layers while scrolling through hero
    var ticking = false;
    var lastScrollY = window.scrollY || window.pageYOffset;

    function updateParallax() {
      if (!hero || !heroHeader) return;
      var rect = hero.getBoundingClientRect();
      var heroH = hero.offsetHeight;
      var viewH = window.innerHeight;
      // Only apply when hero is in view (top of hero above bottom of viewport)
      if (rect.bottom < 0 || rect.top > viewH) {
        heroHeader.style.transform = '';
        if (heroLeft) heroLeft.style.transform = '';
        if (heroRight) heroRight.style.transform = '';
        ticking = false;
        return;
      }
      var scrollY = window.scrollY || window.pageYOffset;
      // How far through the hero we've scrolled (0 = top, 1 = bottom)
      var t = Math.max(0, Math.min(1, scrollY / (heroH * 0.6)));
      var drift = 52;
      var y1 = t * drift * 0.35;
      var y2 = t * drift * 0.7;
      var y3 = t * drift;
      heroHeader.style.transform = 'translate3d(0,' + y1 + 'px,0)';
      if (heroLeft) heroLeft.style.transform = 'translate3d(0,' + y2 + 'px,0)';
      if (heroRight) heroRight.style.transform = 'translate3d(0,' + y3 + 'px,0)';
      ticking = false;
    }

    function onScroll() {
      lastScrollY = window.scrollY || window.pageYOffset;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    }

    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hero && heroHeader && !prefersReducedMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      updateParallax();
    }

    // Scroll reveal: add .scroll-reveal to blocks, then .is-visible when in view
    var revealSelectors = [
      '.problem-card',
      '.rescue-block',
      '.testimonial-section .testimonial-wrap',
      '.pricing-panel',
      '.resource-card',
      '.rescue-guarantee-callout',
      'section#problem .container > h2',
      'section#problem .container > .eyebrow',
      'section#rescue .container > h2',
      'section#rescue .container > .eyebrow',
      'section#pricing .container > h2',
      'section#pricing .container > .eyebrow',
      'section#pricing .subhead',
      '.section-muted .container > h2',
      '.faq'
    ];
    var revealRoot = document.body;
    var seen = new Set();
    var els = [];
    revealSelectors.forEach(function (sel) {
      try {
        var nodes = revealRoot.querySelectorAll(sel);
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (!seen.has(el)) {
            seen.add(el);
            els.push(el);
          }
        }
      } catch (e) {}
    });

    function isInViewport(el) {
      var r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.85 && r.bottom > 0;
    }

    els.forEach(function (el) {
      el.classList.add('scroll-reveal');
      if (isInViewport(el)) el.classList.add('is-visible');
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0 }
    );
    els.forEach(function (el) {
      observer.observe(el);
    });

    if (typeof initEasterEggs === 'function') initEasterEggs();
  });
})();

// Easter egg competition: init all placements (tooltips, injects, attribution)
function initEasterEggs() {
  if (!getSettings().easter_eggs_competition_showing) return;
  var n = getEasterEggNames();
  if (!n || n.length < 10) return;
  var copy = typeof EASTER_EGG_COPY !== 'undefined' ? EASTER_EGG_COPY : {};
  var delayRescue = (copy.rescueEyebrowDelaySec != null ? copy.rescueEyebrowDelaySec : 1) * 1000;

  function showTooltip(el, text) {
    var tip = document.createElement('div');
    tip.className = 'easter-egg-tooltip';
    tip.textContent = text;
    tip.setAttribute('role', 'tooltip');
    el.appendChild(tip);
    requestAnimationFrame(function () {
      tip.classList.add('is-visible');
    });
    setTimeout(function () {
      if (tip.parentNode) tip.parentNode.removeChild(tip);
    }, 2500);
  }

  var rescueEyebrow = document.querySelector('#rescue .eyebrow');
  if (rescueEyebrow) {
    var rescueTimer = null;
    var rescueTipText = (copy.rescueEyebrowTooltip || 'Why not let us turn your shit to [Name]?').replace('[Name]', n[1]);
    rescueEyebrow.addEventListener('mouseenter', function () {
      rescueTimer = setTimeout(function () {
        rescueTimer = null;
        showTooltip(rescueEyebrow, rescueTipText);
      }, delayRescue);
    });
    rescueEyebrow.addEventListener('mouseleave', function () {
      if (rescueTimer) clearTimeout(rescueTimer);
    });
  }

  var guideImg = document.querySelector('#guide img');
  if (guideImg) {
    var guideTitle = (copy.guidePicTitle || 'Not exactly [Name]. But I\'ve come a long way.').replace('[Name]', n[2]);
    guideImg.setAttribute('title', guideTitle);
  }

  /* T&Cs: Tom Waits is already in plain text on the page; no extra clause injected (each name only once). */

  var footerMaya = document.getElementById('footer-maya-easter');
  if (footerMaya && !footerMaya.textContent.trim()) {
    var mayaLine = (copy.mayaQuote || '"People will forget what you said, people will forget what you did, but people will never forget how you made them feel"') + (copy.mayaAttribution || ' ~ [Name] (not a client)').replace('[Name]', n[8]);
    footerMaya.textContent = mayaLine;
  }

  var menuProud = document.getElementById('mobile-menu-easter-proud');
  if (menuProud) {
    var proudText = (copy.menuFooterProud || '[Name] would be proud.').replace('[Name]', n[0]);
    menuProud.textContent = ' · ' + proudText;
  }

  var featureDesc6 = document.getElementById('feature-desc-6');
  if (featureDesc6 && !featureDesc6.querySelector('.easter-egg-deliverable')) {
    var deliverableCopy = (copy.deliverableAppend || 'In the spirit of [Name], we keep it clear and persuasive.').replace('[Name]', n[7]);
    var addDeliverableEaster = function () {
      if (featureDesc6.querySelector('.easter-egg-deliverable')) return;
      var p = document.createElement('p');
      p.className = 'easter-egg-deliverable';
      p.textContent = deliverableCopy;
      featureDesc6.appendChild(p);
    };
    var btn6 = document.getElementById('feature-btn-6');
    if (btn6) {
      btn6.addEventListener('click', addDeliverableEaster);
      var list6 = btn6.closest('.feature-list');
      if (list6) {
        list6.querySelectorAll('.feature-toggle').forEach(function (b) {
          b.addEventListener('mouseenter', function () {
            if (b === btn6) setTimeout(addDeliverableEaster, 1100);
          });
        });
      }
    }
  }
}

