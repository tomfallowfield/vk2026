/**
 * VK Analytics Dashboard — Client-side logic for the Visitors page.
 */
(function () {
  'use strict';

  var API = '/api/analytics/dashboard';
  var REFRESH_MS = 60000;
  var refreshTimer = null;

  // --- Relative time ---
  function relativeTime(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    var now = Date.now();
    var diff = Math.max(0, now - d.getTime());
    var s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var days = Math.floor(h / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // --- Format date for timeline ---
  function formatTimestamp(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    var day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    var time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return day + '  ' + time;
  }

  // --- Event type display name ---
  function eventLabel(type) {
    var labels = {
      page_view: 'Page view',
      scroll_50: 'Scrolled 50%',
      time_60s: '60s on page',
      time_on_site: 'Time on site',
      click: 'Click',
      video_play: 'Video play',
      video_pause: 'Video pause',
      video_ended: 'Video ended',
      video_progress: 'Video progress',
      form_open: 'Form opened',
      form_focus: 'Form focus',
      form_submit: 'Form submitted',
      service_open: 'Service opened',
      scope_open: 'Scope opened',
      faq_open: 'FAQ opened',
      cal_link_click: 'Cal link click',
      autodialog_triggered: 'Dialog triggered',
      menu_open: 'Menu opened',
      menu_close: 'Menu closed',
      modal_close: 'Modal closed',
      theme_switch: 'Theme switch'
    };
    return labels[type] || type;
  }

  // --- Build funnel bar HTML ---
  function funnelBarHTML(funnel, className) {
    var barClass = className || 'funnel-bar';
    var html = '<div class="' + barClass + '">';
    for (var i = 0; i < funnel.segments.length; i++) {
      var seg = funnel.segments[i];
      var cls = 'funnel-segment';
      if (seg.completed) cls += ' filled-' + (i + 1);
      html += '<div class="' + cls + '" title="' + seg.label + '"></div>';
    }
    html += '</div>';
    return html;
  }

  // --- Fetch with auth check ---
  function apiFetch(path) {
    return fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/analytics/login.html';
        throw new Error('Unauthorized');
      }
      return res.json();
    });
  }

  // --- Render visitors ---
  function renderVisitors(data) {
    var content = document.getElementById('content');
    var sub = document.getElementById('header-sub');

    if (!data.visitors || data.visitors.length === 0) {
      content.innerHTML = '<div class="empty-state"><h2>No visitors yet</h2><p>Visitors will appear here once the tracker starts capturing events.</p></div>';
      sub.textContent = '0 visitors';
      return;
    }

    sub.textContent = data.total + ' visitor' + (data.total !== 1 ? 's' : '');

    var html = '<div class="cards-grid">';
    for (var i = 0; i < data.visitors.length; i++) {
      var v = data.visitors[i];
      html += '<div class="visitor-card" data-vid="' + v.visitor_id + '">';
      html += '<div class="card-top">';
      html += '<div class="card-name">' + escapeHtml(v.display_name) + '</div>';
      html += '<div class="card-badges">';
      html += '<span class="badge badge-visits">' + v.visit_count + ' visit' + (v.visit_count !== 1 ? 's' : '') + '</span>';
      if (v.converted) {
        html += '<span class="badge badge-converted">Converted</span>';
      }
      html += '</div></div>';
      html += funnelBarHTML(v.funnel);
      html += '<div class="card-meta">';
      html += '<span>' + relativeTime(v.last_seen_at) + '</span>';
      if (v.utm_source) {
        html += '<span class="source">via ' + escapeHtml(v.utm_source) + '</span>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    content.innerHTML = html;

    // Attach click handlers
    var cards = content.querySelectorAll('.visitor-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        openSlideOver(this.getAttribute('data-vid'));
      });
    }
  }

  // --- Render stats bar ---
  function renderStats(data) {
    if (!data.visitors || data.visitors.length === 0) {
      document.getElementById('stats-bar').innerHTML = '';
      return;
    }
    var total = data.total;
    var converted = data.visitors.filter(function (v) { return v.converted; }).length;
    var active24h = data.visitors.filter(function (v) {
      return v.last_seen_at && (Date.now() - new Date(v.last_seen_at).getTime()) < 86400000;
    }).length;
    var cvr = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

    var html = '';
    html += statCardHTML('Total Visitors', total, '');
    html += statCardHTML('Active (24h)', active24h, '');
    html += statCardHTML('Converted', converted, cvr + '% CVR');
    document.getElementById('stats-bar').innerHTML = html;
  }

  function statCardHTML(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  // --- Slide-over ---
  function openSlideOver(visitorId) {
    var backdrop = document.getElementById('slide-over-backdrop');
    var body = document.getElementById('slide-over-body');
    var name = document.getElementById('slide-over-name');
    backdrop.classList.add('open');
    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    name.textContent = 'Loading...';

    apiFetch('/visitors/' + encodeURIComponent(visitorId)).then(function (v) {
      name.textContent = v.display_name || v.name || v.email || 'Unknown';

      var html = '';

      // Metadata
      html += '<div class="detail-meta">';
      html += metaItem('Browser', v.browser_display || '—');
      html += metaItem('Device', v.device_display || '—');
      html += metaItem('Location', v.location_display || '—');
      html += metaItem('First seen', formatTimestamp(v.first_seen_at));
      html += metaItem('Last seen', formatTimestamp(v.last_seen_at));
      html += metaItem('Visits', v.visit_count);
      if (v.email) html += metaItem('Email', v.email);
      if (v.name) html += metaItem('Name', v.name);
      if (v.referrer) html += metaItem('Referrer', v.referrer);
      if (v.utm_source) html += metaItem('Source', v.utm_source);
      html += '</div>';

      // Funnel
      html += '<div class="detail-funnel">';
      html += funnelBarHTML(v.funnel, 'detail-funnel-bar');
      html += '<div class="detail-funnel-labels">';
      for (var i = 0; i < v.funnel.segments.length; i++) {
        html += '<span>' + v.funnel.segments[i].label + '</span>';
      }
      html += '</div></div>';

      // Event timeline
      if (v.events && v.events.length > 0) {
        html += '<div class="timeline-header">Event Log (' + v.events.length + ')</div>';
        html += '<div class="timeline">';
        for (var j = 0; j < v.events.length; j++) {
          var e = v.events[j];
          var dotClass = 'dot-' + e.event_type;
          var page = e.page_url || '';
          html += '<div class="timeline-event">';
          html += '<div class="timeline-dot ' + dotClass + '"></div>';
          html += '<span class="event-time">' + formatTimestamp(e.occurred_at) + '</span>';
          html += '<span class="event-name">' + eventLabel(e.event_type) + '</span>';
          if (page) html += '<span class="event-page">— ' + escapeHtml(page) + '</span>';
          html += '</div>';
        }
        html += '</div>';
      }

      body.innerHTML = html;
    }).catch(function (err) {
      if (err.message !== 'Unauthorized') {
        body.innerHTML = '<div class="empty-state"><p>Failed to load visitor.</p></div>';
      }
    });
  }

  function metaItem(label, value) {
    return '<div class="detail-meta-item"><div class="meta-label">' + label + '</div><div class="meta-value">' + escapeHtml(String(value)) + '</div></div>';
  }

  function closeSlideOver() {
    document.getElementById('slide-over-backdrop').classList.remove('open');
  }

  // --- Escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Load data ---
  function loadVisitors() {
    apiFetch('/visitors?limit=200').then(function (data) {
      renderStats(data);
      renderVisitors(data);
    }).catch(function (err) {
      if (err.message !== 'Unauthorized') {
        document.getElementById('content').innerHTML = '<div class="empty-state"><p>Failed to load visitors. Check your connection.</p></div>';
      }
    });
  }

  // --- Init ---
  loadVisitors();
  refreshTimer = setInterval(loadVisitors, REFRESH_MS);

  // Close slide-over
  document.getElementById('slide-over-close').addEventListener('click', closeSlideOver);
  document.getElementById('slide-over-backdrop').addEventListener('click', function (e) {
    if (e.target === this) closeSlideOver();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSlideOver();
  });
})();
