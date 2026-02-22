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
    site_env: 'prod',

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

    // --- Lead magnets (per-LM settings; Mailchimp tags drive automations) ---
    // Each key = panel/form id (data-panel, form id). Mailchimp tag is what gets applied in Mailchimp so your automation can send the right lead-magnet email.
    lead_magnets: {
      'lead-50things': {
        enabled: true,
        success_message: 'Thanks! Check your email for the checklist.',
        mailchimp_tag: 'requested_2026cheatsheet'
      },
      'lead-offboarding': {
        enabled: true,
        success_message: 'Thanks! Check your email for the offboarding guide.',
        mailchimp_tag: 'requested_offboarding_guide'
      }
      // ,
      // 'lead-socialproof': {
      //   enabled: true,
      //   success_message: 'Thanks! Check your email to get started with the course.',
      //   mailchimp_tag: 'lead-socialproof'
      // }
    },

    // --- UI toggles ---
    show_pricing: true,
    cookie_consent_enabled: true,
    // Easter egg competition: 10 hidden communicator names. true = show; false = off (use random star placeholders, no tooltips/injections).
    easter_eggs_competition_showing: true,
    // Show contact email sitewide (footer, modals, mobile menu). false = hide everywhere.
    show_email: true,
    // Primary CTA: true = black button, secondary = white with black border. false = original pink primary.
    cta_primary_black: true,
    // How it works (rescue) section: true = show video placeholders, false = 3 boxes with icon + title + blurb only.
    rescue_section_show_videos: false,

    // --- Analytics ---
    // Google Analytics measurement ID (e.g. G-XXXXXXXXXX). Leave empty to disable.
    ga_id: 'G-9MXLM3T6SH',

    // --- Maintenance ---
    maintenance_mode: false,
    maintenance_message: 'We’ll be back shortly. Thanks for your patience.',

    // --- Modals ---
    // When URL has ?modal= with no value, open this modal (e.g. 'website-review', 'book-call'). Null = do nothing.
    default_modal: null,

    // --- Hero LinkedIn faces (avatar stack) ---
    // Each entry: name (tooltip), role (tooltip), photo (filename in images/li_mugs/).
    // Tooltip on hover shows "Name – Role". Rename image files to match photo values.
    linkedin_faces: [
      { name: 'Arthur Jones', role: 'CEO Maskew Media', photo: 'arthur jones.jpg' },
      { name: 'Dave Stubberfield', role: 'Director, Carter Consultancy', photo: 'dave stubberfield.jpg' },
      { name: 'Mike Hill', role: 'CEO, Total Ticketing', photo: 'mike.jpg' },
      { name: 'Paola Forsberg', role: 'The Leading Lady of LinkedIn Leadgen!', photo: 'paola forsberg.jpg' },
      { name: 'Rachel Coles', role: 'CEO Conv3rt Marketing', photo: 'rachel coles.jpg' },
      { name: 'Katie Skelton', role: 'Massive Email Wierdo', photo: 'katie.jpg' }
    ]
  };
})();
