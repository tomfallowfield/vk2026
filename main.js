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

// Form submit: AJAX and show success/error in modal
function showPanelMessage(panel, isSuccess, text) {
  const formWrap = panel.querySelector('.app-modal__panel-form');
  const messageBox = panel.querySelector('.app-modal__panel-message');
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.className = 'app-modal__panel-message ' + (isSuccess ? 'success' : 'error');
  messageBox.hidden = false;
  if (formWrap) formWrap.hidden = true;
}

function resetPanelForm(panel) {
  const formWrap = panel.querySelector('.app-modal__panel-form');
  const messageBox = panel.querySelector('.app-modal__panel-message');
  if (formWrap) formWrap.hidden = false;
  if (messageBox) {
    messageBox.hidden = true;
    messageBox.textContent = '';
    messageBox.className = 'app-modal__panel-message';
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

// Website review form
const formWebsiteReview = document.getElementById('form-website-review');
if (formWebsiteReview) {
  formWebsiteReview.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateForm(this)) return;
    const panel = getActiveAppModalPanel();
    const formData = new FormData(this);
    const payload = Object.fromEntries(formData.entries());

    fetch('/api/website-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (panel) {
          showPanelMessage(panel, ok, ok ? (data.message || 'Thanks — we’ll be in touch with your review soon.') : (data.error || 'Something went wrong. Please try again.'));
        }
      })
      .catch(() => {
        if (panel) showPanelMessage(panel, false, 'Something went wrong. Please try again.');
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
    const formData = new FormData(this);
    const payload = Object.fromEntries(formData.entries());

    fetch('/api/book-a-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (panel) {
          showPanelMessage(panel, ok, ok ? (data.message || 'Thanks — we’ll be in touch soon.') : (data.error || 'Something went wrong. Please try again.'));
        }
      })
      .catch(() => {
        if (panel) showPanelMessage(panel, false, 'Something went wrong. Please try again.');
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
    const formData = new FormData(this);
    const payload = Object.fromEntries(formData.entries());
    payload.source = this.getAttribute('data-source') || id;

    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (panel) {
          showPanelMessage(panel, ok, ok ? (data.message || successMessages[id]) : (data.error || 'Something went wrong. Please try again.'));
        }
      })
      .catch(() => {
        if (panel) showPanelMessage(panel, false, 'Something went wrong. Please try again.');
      });
  });
});

