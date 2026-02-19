/**
 * Bootstrap: fetch site settings from Strapi, set window.SITE_SETTINGS, then load main.js.
 * Falls back to settings.js if Strapi is unreachable.
 *
 * Usage: <script src="load-cms.js" data-strapi-url="http://localhost:1337"></script>
 * Omit data-strapi-url to skip fetch (use settings.js only).
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var strapiUrl = (script && script.getAttribute('data-strapi-url')) || '';
  var fallbackScript = document.createElement('script');
  fallbackScript.src = 'settings.js';

  function injectGa() {
    var s = window.SITE_SETTINGS;
    var gaId = (s && typeof s.ga_id === 'string') ? s.ga_id.trim() : '';
    if (!gaId) return;
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId);
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(script);
  }

  function loadMain() {
    injectGa();
    var m = document.createElement('script');
    m.src = 'main.js';
    document.body.appendChild(m);
  }

  function applySettings(data) {
    var d = data && (data.data || data);
    if (!d) return;
    var lm = d.lead_magnets;
    var leadMagnets = {};
    if (Array.isArray(lm)) {
      lm.forEach(function (c) {
        var key = c && (c.form_id || c.id);
        if (key) leadMagnets[key] = { enabled: c.enabled !== false, success_message: c.success_message || '', mailchimp_tag: c.mailchimp_tag || '' };
      });
    }
    window.SITE_SETTINGS = {
      autodialog_form_to_show: d.autodialog_form_to_show,
      autodialog_to_be_shown_on_exit_intent: d.autodialog_to_be_shown_on_exit_intent,
      autodialog_to_be_shown_after_delay_s: d.autodialog_to_be_shown_after_delay_s,
      site_env: d.site_env,
      api_base: d.api_base,
      wrv_offer: d.wrv_offer,
      book_call_offer: d.book_call_offer,
      book_call_calendar_url: d.book_call_calendar_url,
      lead_magnets_enabled: d.lead_magnets_enabled,
      lead_magnets: leadMagnets,
      show_pricing: d.show_pricing,
      cookie_consent_enabled: d.cookie_consent_enabled,
      show_email: d.show_email,
      cta_primary_black: d.cta_primary_black,
      rescue_section_show_videos: d.rescue_section_show_videos,
      ga_id: d.ga_id,
      maintenance_mode: d.maintenance_mode,
      maintenance_message: d.maintenance_message,
      default_modal: d.default_modal,
      linkedin_faces: Array.isArray(d.linkedin_faces) ? d.linkedin_faces : [],
      easter_eggs_competition_showing: d.easter_eggs_competition_showing === true
    };
  }

  function useFallback() {
    if (window.SITE_SETTINGS) {
      loadMain();
      return;
    }
    fallbackScript.onload = loadMain;
    document.body.appendChild(fallbackScript);
  }

  if (!strapiUrl) {
    useFallback();
    return;
  }

  var base = strapiUrl.replace(/\/$/, '');
  Promise.all([
    fetch(base + '/api/site-setting?populate=*').then(function (r) { return r.json(); }),
    fetch(base + '/api/faqs?sort=order:asc').then(function (r) { return r.json(); }),
    fetch(base + '/api/testimonials?sort=order:asc').then(function (r) { return r.json(); }),
    fetch(base + '/api/lead-magnets?sort=order:asc').then(function (r) { return r.json(); })
  ])
    .then(function (results) {
      applySettings(results[0]);
      window.FAQS = (results[1] && results[1].data && Array.isArray(results[1].data)) ? results[1].data : [];
      window.TESTIMONIALS = (results[2] && results[2].data && Array.isArray(results[2].data)) ? results[2].data : [];
      window.LEAD_MAGNETS = (results[3] && results[3].data && Array.isArray(results[3].data)) ? results[3].data : [];
      loadMain();
    })
    .catch(function () {
      useFallback();
    });
})();
