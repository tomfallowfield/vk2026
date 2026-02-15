/**
 * Site settings – edit these to change behaviour without touching main.js.
 * Loaded before main.js; main.js reads window.SITE_SETTINGS.
 */
(function () {
  'use strict';

  
  window.SITE_SETTINGS = {
    // --- Auto dialog ---
    // Which modal to show when an auto-dialog trigger fires (e.g. 'wrv' = website-review).
    autodialog_form_to_show: 'wrv',
    // Show the auto dialog when user triggers exit intent (mouse leaving top of viewport, desktop only).
    autodialog_to_be_shown_on_exit_intent: true,
    // Show the auto dialog after this many seconds of inactivity. 0 = do not show on delay.
    autodialog_to_be_shown_after_delay_s: 30,

    // --- Environment ---
    site_env: 'temp',

    // --- API ---
    // Override API base URL (e.g. per environment). If set, used instead of default /vk2026/api.
    api_base: '',

    // --- Offers ---
    // WRV = website review. false = hide all WRV CTAs and block WRV from URL, auto dialog (exit intent + delay).
    wrv_offer: true,
    book_call_offer: true,
    // Sales call calendar link (used for "Book via calendar" in book-a-call modal). Leave empty to use link in HTML.
    book_call_calendar_url: 'https://calendar.app.google/8jiSEYPb3YYouyXq9',
    lead_magnets_enabled: true,

    // --- UI toggles ---
    show_pricing: true,
    cookie_consent_enabled: true,

    // --- Analytics ---
    // Google Analytics measurement ID (e.g. G-XXXXXXXXXX). Leave empty to disable.
    ga_id: '',

    // --- Maintenance ---
    maintenance_mode: false,
    maintenance_message: 'We’ll be back shortly. Thanks for your patience.',

    // --- Modals ---
    // When URL has ?modal= with no value, open this modal (e.g. 'website-review', 'book-call'). Null = do nothing.
    default_modal: null
  };
})();
