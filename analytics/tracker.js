/**
 * VK Analytics Tracker — standalone event tracking script.
 * Include on any page: <script src="/analytics/tracker.js" data-api="/api"></script>
 * Compatible with the main.js vk_visitor cookie format.
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'vk_visitor';
  var COOKIE_DAYS = 365;
  var scriptTag = document.currentScript;
  var apiBase = (scriptTag && scriptTag.getAttribute('data-api')) || '/api';
  var endpoint = apiBase + '/analytics/events';

  // --- Cookie helpers ---
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;SameSite=Lax;expires=' + d.toUTCString();
  }

  // --- Visitor ID (matches main.js format) ---
  function getOrCreateVisitor() {
    var raw = getCookie(COOKIE_NAME);
    var data;
    try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
    var now = Date.now();
    if (!data || !data.visitor_id) {
      data = {
        visitor_id: 'v_' + Math.random().toString(36).slice(2) + now.toString(36),
        visit_count: 1,
        first_visit_ts: now,
        last_activity_ts: now,
        first_referrer: document.referrer || '',
        referrers: document.referrer ? [document.referrer] : [],
        past_form_submissions: [],
        buttons_clicked: [],
        videos_watched: {}
      };
    } else {
      data.last_activity_ts = now;
    }
    setCookie(COOKIE_NAME, JSON.stringify(data), COOKIE_DAYS);
    return data;
  }

  var visitor = getOrCreateVisitor();
  if (!visitor || !visitor.visitor_id) return;

  var sent = {};

  // --- Send event ---
  function send(eventType, meta) {
    var payload = {
      visitor_id: visitor.visitor_id,
      events: [{
        event_type: eventType,
        timestamp: new Date().toISOString(),
        page_url: location.pathname + location.search,
        referrer: document.referrer || '',
        metadata: meta || null
      }]
    };
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    }
  }

  function sendOnce(eventType, meta) {
    if (sent[eventType]) return;
    sent[eventType] = true;
    send(eventType, meta);
  }

  // --- 1. Page view ---
  sendOnce('page_view');

  // --- 2. Scroll 50% ---
  var scrollHandler = function () {
    var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var viewHeight = window.innerHeight;
    var scrolled = window.scrollY || window.pageYOffset;
    if (docHeight - viewHeight > 0 && (scrolled / (docHeight - viewHeight)) >= 0.5) {
      sendOnce('scroll_50');
      window.removeEventListener('scroll', scrollHandler);
    }
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // --- 3. Time 60s ---
  var timeTimer = setTimeout(function () { sendOnce('time_60s'); }, 60000);

  // --- 4. Video play ---
  document.addEventListener('play', function (e) {
    if (e.target && e.target.tagName === 'VIDEO') {
      var src = e.target.getAttribute('src') || e.target.querySelector('source')?.getAttribute('src') || '';
      send('video_play', { src: src });
    }
  }, true);

  // --- 5. Service / scope open ---
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-service], [data-scope], .scope-trigger, .service-trigger');
    if (el) {
      var id = el.getAttribute('data-service') || el.getAttribute('data-scope') || el.id || '';
      send('service_open', { id: id });
    }
  });

  // --- 6. Form focus (email field) ---
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.tagName === 'INPUT' && (el.type === 'email' || el.name === 'email' || el.id === 'email')) {
      sendOnce('form_focus', { form_id: el.form ? (el.form.id || '') : '' });
    }
  });

  // --- 7. Form submit ---
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var emailInput = form.querySelector('input[type="email"], input[name="email"]');
    var nameInput = form.querySelector('input[name="name"], input[name="full_name"]');
    if (emailInput && emailInput.value) {
      send('form_submit', {
        form_id: form.id || '',
        email: emailInput.value,
        name: nameInput ? nameInput.value : ''
      });
    }
  });

  // Cleanup on unload
  window.addEventListener('pagehide', function () {
    clearTimeout(timeTimer);
    window.removeEventListener('scroll', scrollHandler);
  });
})();
