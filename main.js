// API base URL (same origin: /vk2026/api)
window.API_BASE = typeof window.API_BASE !== 'undefined' ? window.API_BASE : '/vk2026/api';

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
      utm: utm
    };
  } else {
    data.visit_count = (data.visit_count || 0) + 1;
    data.last_activity_ts = now;
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
  return {
    visitor_id: v ? v.visitor_id : null,
    visit_count: v ? v.visit_count : null,
    first_visit_ts: v ? v.first_visit_ts : null,
    last_activity_ts: now,
    first_referrer: v ? v.first_referrer : (document.referrer || null),
    referrers: v ? v.referrers : null,
    past_form_submissions: v ? v.past_form_submissions : null,
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

// Cookie bar UI
(function () {
  const bar = document.getElementById('cookie-bar');
  const acceptBtn = document.getElementById('cookie-accept');
  const declineBtn = document.getElementById('cookie-decline');
  if (!bar || !acceptBtn || !declineBtn) return;
  const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
  if (consent === 'accept' || consent === 'decline') {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  acceptBtn.addEventListener('click', function () {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accept');
    getOrCreateVisitor();
    bar.hidden = true;
  });
  declineBtn.addEventListener('click', function () {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'decline');
    bar.hidden = true;
  });
})();

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

document.querySelectorAll('.video-thumb').forEach(button => {
  button.addEventListener('click', () => {
    video.src = button.dataset.video;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    video.currentTime = 0;
    video.play();
  });
});

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

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-modal]');
  if (trigger) {
    e.preventDefault();
    lastTriggerButtonId = trigger.id || null;
    const panelId = trigger.getAttribute('data-modal');
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
  const panelId = params.get('modal');
  if (!panelId || !VALID_MODAL_IDS.has(panelId)) return;
  setTimeout(() => {
    openAppModal(panelId);
    if (panelId === 'website-review') {
      sessionStorage.setItem('appModalExitIntentShown', '1');
    }
  }, 0);
}

openModalFromUrl();

// Exit intent: show website review modal once per session (desktop only)
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

document.addEventListener('mouseout', e => {
  if (isTouchDevice()) return;
  if (e.relatedTarget) return;
  if (e.clientY > 10) return;
  if (sessionStorage.getItem('appModalExitIntentShown')) return;
  sessionStorage.setItem('appModalExitIntentShown', '1');
  openAppModal('website-review');
});

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

// Success: replace form area with animated success screen
function showSuccessScreen(panel, message) {
  const formWrap = panel.querySelector('.app-modal__panel-form');
  const messageBox = panel.querySelector('.app-modal__panel-message');
  const successEl = panel.querySelector('.app-modal__success');
  if (formWrap) formWrap.hidden = true;
  if (messageBox) messageBox.hidden = true;
  if (successEl) {
    successEl.innerHTML = '<div class="app-modal__success-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div><p class="app-modal__success-message">' + escapeHtml(message) + '</p>';
    successEl.hidden = false;
  }
}

function showPanelError(panel, text) {
  const formWrap = panel.querySelector('.app-modal__panel-form');
  const messageBox = panel.querySelector('.app-modal__panel-message');
  const successEl = panel.querySelector('.app-modal__success');
  if (successEl) successEl.hidden = true;
  if (formWrap) formWrap.hidden = false;
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
  const formWrap = panel.querySelector('.app-modal__panel-form');
  const messageBox = panel.querySelector('.app-modal__panel-message');
  const successEl = panel.querySelector('.app-modal__success');
  if (formWrap) formWrap.hidden = false;
  if (messageBox) {
    messageBox.hidden = true;
    messageBox.textContent = '';
    messageBox.className = 'app-modal__panel-message';
  }
  if (successEl) {
    successEl.hidden = true;
    successEl.innerHTML = '';
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
  payload.idempotency_key = idempotencyKey();
  payload._context = getContextForSubmit(payload.trigger_button_id);
  return payload;
}

// Website review form
const formWebsiteReview = document.getElementById('form-website-review');
if (formWebsiteReview) {
  formWebsiteReview.addEventListener('submit', function (e) {
    e.preventDefault();
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

// Lead magnet forms
['lead-50things', 'lead-offboarding', 'lead-socialproof'].forEach(id => {
  const form = document.getElementById('form-' + id);
  if (!form) return;
  const successMessages = {
    'lead-50things': 'Thanks! Check your email for the checklist.',
    'lead-offboarding': 'Thanks! Check your email for the offboarding guide.',
    'lead-socialproof': 'Thanks! Check your email to get started with the course.',
  };
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const payload = buildSubmitPayload(this);
    payload.source = this.getAttribute('data-source') || id;

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
            showSuccessScreen(panel, data.message || successMessages[id]);
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

