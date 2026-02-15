// API base URL (same origin: /vk2026/api) – can be overridden by settings.api_base
window.API_BASE = (function () {
  const s = window.SITE_SETTINGS || {};
  if (typeof s.api_base === 'string' && s.api_base.trim()) return s.api_base.trim();
  return typeof window.API_BASE !== 'undefined' ? window.API_BASE : '/vk2026/api';
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
    ga_id: typeof s.ga_id === 'string' ? s.ga_id.trim() : '',
    maintenance_mode: s.maintenance_mode === true,
    maintenance_message: typeof s.maintenance_message === 'string' ? s.maintenance_message : 'We\'ll be back shortly. Thanks for your patience.',
    default_modal: (s.default_modal && typeof s.default_modal === 'string') ? s.default_modal : null,
    api_base: typeof s.api_base === 'string' ? s.api_base.trim() : '',
    book_call_calendar_url: typeof s.book_call_calendar_url === 'string' ? s.book_call_calendar_url.trim() : '',
    lead_magnets: (s.lead_magnets && typeof s.lead_magnets === 'object') ? s.lead_magnets : {}
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
  const utm = {
    utm_source: params.get('utm_source') || '',
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
    if (params.has('utm_source') || params.has('utm_medium')) data.utm = utm;
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
    utm_source: params.get('utm_source') || null,
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

// How the modal was opened (for logging on submit): 'button' | 'url' | 'exit_intent' | 'inactivity'
let lastModalTriggerType = null;
// Which button opened the modal (for trigger_button_id)
let lastTriggerButtonId = null;

// Header: hide on scroll down, show on scroll up
(function () {
  const header = document.querySelector('header');
  let lastScrollY = window.scrollY;
  const scrollThreshold = 80;

  window.addEventListener('scroll', function () {
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

// FAQ toggles
(function () {
  const faqs = document.querySelectorAll('.faq');
  faqs.forEach((faq) => {
    const trigger = faq.querySelector('.faq-trigger');
    const panel = faq.querySelector('.faq-panel');
    if (!trigger || !panel) return;
    trigger.addEventListener('click', () => {
      const isOpen = faq.classList.contains('open');
      faqs.forEach((f) => f.classList.remove('open'));
      if (!isOpen) faq.classList.add('open');
    });
  });
})();

// Pricing feature toggles (click to expand/collapse, one open at a time per list)
(function () {
  const featureLists = document.querySelectorAll('.pricing-features');
  if (!featureLists.length) return;

  featureLists.forEach(list => {
    const toggles = list.querySelectorAll('.feature-toggle');
    toggles.forEach(button => {
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
        }
      });
    });
  });
})();

// Video lightbox
const modal = document.getElementById('videoModal');
const video = document.getElementById('modalVideo');
const closeBtn = modal.querySelector('.video-close');

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

function closeVideoModal() {
  modal.classList.remove('active');
  document.body.style.overflow = '';
  video.pause();
  video.src = '';
}

closeBtn.addEventListener('click', closeVideoModal);

modal.addEventListener('click', e => {
  if (e.target === modal) closeVideoModal();
});

// App modal (book a call, website review, lead magnets)
const appModal = document.getElementById('appModal');
const appModalDialog = appModal && appModal.querySelector('.app-modal__dialog');
const appModalCloseBtn = appModal && appModal.querySelector('.app-modal__close');
const appModalPanels = appModal && appModal.querySelectorAll('.app-modal__panel');

const FOCUSABLE_SELECTOR = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]';

let lastAppModalTrigger = null;

function openAppModal(panelId) {
  if (!appModal || !appModalPanels) return;
  appModalPanels.forEach(panel => resetPanelForm(panel));

  lastAppModalTrigger = document.activeElement;
  appModal.classList.add('active');
  appModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  appModalPanels.forEach(panel => {
    const isActive = panel.getAttribute('data-panel') === panelId;
    panel.classList.toggle('active', isActive);
    panel.setAttribute('aria-hidden', !isActive);
  });

  const activePanel = appModal.querySelector('.app-modal__panel.active');
  const firstFocusable = activePanel
    ? (activePanel.querySelector(FOCUSABLE_SELECTOR) || appModalCloseBtn)
    : appModalCloseBtn;
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 50);
  }
}

function closeAppModal() {
  if (!appModal) return;
  appModal.classList.remove('active');
  appModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  appModalPanels.forEach(panel => {
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
  });
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
    if (panelId) openAppModal(panelId);
  }
});

if (appModalCloseBtn) {
  appModalCloseBtn.addEventListener('click', closeAppModal);
}

if (appModal) {
  appModal.addEventListener('click', e => {
    if (e.target === appModal) closeAppModal();
  });
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (modal && modal.classList.contains('active')) {
    closeVideoModal();
    return;
  }
  if (appModal && appModal.classList.contains('active')) {
    closeAppModal();
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

openModalFromUrl();

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

// Book-a-call calendar link (from settings)
(function () {
  const url = getSettings().book_call_calendar_url;
  if (!url) return;
  const calLink = document.getElementById('app-modal-calendar-link');
  if (calLink) calLink.href = url;
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

// Google Analytics (when ga_id is set)
(function () {
  const gaId = getSettings().ga_id;
  if (!gaId) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', gaId);
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
  document.head.appendChild(script);
})();

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
function validateForm(form) {
  let isValid = true;
  const fields = form.querySelectorAll('input[aria-describedby*="-error"], textarea[aria-describedby*="-error"]');

  fields.forEach((field) => {
    const errorId = field.getAttribute('aria-describedby');
    const errorEl = errorId ? document.getElementById(errorId) : null;

    if (!field.checkValidity()) {
      isValid = false;
      field.classList.add('invalid');
      field.setAttribute('aria-invalid', 'true');
      if (errorEl) {
        if (field.validity.valueMissing) {
          errorEl.textContent = field.required ? 'This field is required.' : getTypeMessage(field);
        } else {
          errorEl.textContent = getTypeMessage(field);
        }
      }
    } else {
      field.classList.remove('invalid');
      field.setAttribute('aria-invalid', 'false');
      if (errorEl) errorEl.textContent = '';
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
    field.addEventListener('input', clearFieldError);
    field.addEventListener('change', clearFieldError);
  });
}

function clearFieldError() {
  const field = this;
  const errorId = field.getAttribute('aria-describedby');
  const errorEl = errorId ? document.getElementById(errorId) : null;
  if (field.checkValidity()) {
    field.classList.remove('invalid');
    field.setAttribute('aria-invalid', 'false');
    if (errorEl) errorEl.textContent = '';
  }
}

// Success: replace whole modal panel (both cols) with animated success screen
function showSuccessScreen(panel, message) {
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col');
  contentEls.forEach(function (el) { el.hidden = true; });
  const successFull = panel.querySelector('.app-modal__success-full');
  if (successFull) {
    successFull.innerHTML = '<div class="app-modal__success-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div><p class="app-modal__success-message">' + escapeHtml(message) + '</p>';
    successFull.hidden = false;
  }
}

function showPanelError(panel, text) {
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col');
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
  const contentEls = panel.querySelectorAll('.app-modal__eyebrow, .app-modal__title, .app-modal__book-call, .app-modal__two-col');
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

// Website review form
const formWebsiteReview = document.getElementById('form-website-review');
if (formWebsiteReview) {
  formWebsiteReview.addEventListener('submit', function (e) {
    e.preventDefault();
    if (guardMaintenance(e)) return;
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const payload = buildSubmitPayload(this);

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
            showSuccessScreen(panel, data.message || 'Thanks — we\'ll be in touch with your review soon.');
          } else {
            showPanelError(panel, getSubmitErrorMessage(null, res, data));
          }
        }
      })
      .catch((err) => {
        if (panel) showPanelError(panel, getSubmitErrorMessage(err));
      });
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
            showSuccessScreen(panel, data.message || 'Thanks — we\'ll be in touch soon.');
          } else {
            showPanelError(panel, getSubmitErrorMessage(null, res, data));
          }
        }
      })
      .catch((err) => {
        if (panel) showPanelError(panel, getSubmitErrorMessage(err));
      });
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
      });
  });
});

