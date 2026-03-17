/**
 * VK Analytics Dashboard — Client-side logic for the Visitors page.
 */
(function () {
  'use strict';

  var API = '/api/analytics/dashboard';
  var REFRESH_MS = 60000;
  var refreshTimer = null;
  var allVisitors = [];
  var currentFilters = { status: 'all', visits: 'all' };

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
      theme_switch: 'Theme switch',
      expander_open: 'Expander opened'
    };
    return labels[type] || type;
  }

  // --- Extract useful detail from event metadata ---
  function eventMetaDetail(event) {
    var m = event.metadata;
    if (!m || typeof m !== 'object') return '';
    var parts = [];
    var type = event.event_type;

    if (type === 'faq_open' || type === 'scope_open' || type === 'service_open' || type === 'expander_open') {
      if (m.id) parts.push(m.id);
      if (m.title) parts.push(m.title);
      if (m.label) parts.push(m.label);
      if (m.text) parts.push(m.text.length > 60 ? m.text.slice(0, 60) + '…' : m.text);
    } else if (type === 'click') {
      if (m.id) parts.push(m.id);
      if (m.modal) parts.push('→ ' + m.modal);
      if (m.text) parts.push(m.text.length > 40 ? m.text.slice(0, 40) + '…' : m.text);
    } else if (type === 'video_play' || type === 'video_pause' || type === 'video_ended' || type === 'video_progress') {
      if (m.name) parts.push(m.name);
      if (m.src) parts.push(m.src.split('/').pop());
      if (m.pct != null) parts.push(m.pct + '%');
    } else if (type === 'form_open' || type === 'form_focus' || type === 'form_submit') {
      if (m.form_id) parts.push(m.form_id);
      if (m.trigger) parts.push(m.trigger);
    } else if (type === 'time_on_site' || type === 'time_60s') {
      if (m.seconds) parts.push(m.seconds + 's');
      if (m.duration) parts.push(m.duration + 's');
    } else if (type === 'autodialog_triggered') {
      if (m.trigger) parts.push(m.trigger);
      if (m.reason) parts.push(m.reason);
    } else if (type === 'cal_link_click') {
      if (m.url) parts.push(m.url);
    }

    // Fallback: show any string/number values for unknown types
    if (parts.length === 0) {
      for (var key in m) {
        if (m.hasOwnProperty(key)) {
          var val = m[key];
          if (typeof val === 'string' || typeof val === 'number') {
            var sv = String(val);
            if (sv.length > 60) sv = sv.slice(0, 60) + '…';
            parts.push(sv);
            if (parts.length >= 3) break;
          }
        }
      }
    }

    return parts.length > 0 ? parts.join(' · ') : '';
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

  // --- Filter visitors ---
  function filterVisitors(visitors) {
    return visitors.filter(function (v) {
      // Status filter
      if (currentFilters.status === 'converted' && !v.converted) return false;
      if (currentFilters.status === 'unconverted' && v.converted) return false;

      // Visit count filter
      var vc = v.visit_count || 1;
      if (currentFilters.visits === '1' && vc !== 1) return false;
      if (currentFilters.visits === '2' && vc !== 2) return false;
      if (currentFilters.visits === '3' && vc !== 3) return false;
      if (currentFilters.visits === 'gt1' && vc <= 1) return false;

      return true;
    });
  }

  // --- Render visitors ---
  function renderVisitors(visitors, total) {
    var content = document.getElementById('content');
    var sub = document.getElementById('header-sub');
    var filtered = filterVisitors(visitors);

    if (visitors.length === 0) {
      content.innerHTML = '<div class="empty-state"><h2>No visitors yet</h2><p>Visitors will appear here once the tracker starts capturing events.</p></div>';
      sub.textContent = '0 visitors';
      return;
    }

    var filterNote = filtered.length !== visitors.length ? ' (showing ' + filtered.length + ')' : '';
    sub.textContent = total + ' visitor' + (total !== 1 ? 's' : '') + filterNote;

    if (filtered.length === 0) {
      content.innerHTML = '<div class="empty-state"><h2>No matches</h2><p>No visitors match the current filters.</p></div>';
      return;
    }

    // Group by date (today, yesterday, then by date)
    var groups = groupByDate(filtered);
    var html = '';
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      html += '<div class="date-group">';
      html += '<div class="date-group-label">' + escapeHtml(group.label) + '<span class="date-group-count">' + group.visitors.length + '</span></div>';
      html += '<div class="cards-grid">';
      for (var i = 0; i < group.visitors.length; i++) {
        var v = group.visitors[i];
        html += visitorCardHTML(v);
      }
      html += '</div></div>';
    }
    content.innerHTML = html;

    // Attach click handlers
    var cards = content.querySelectorAll('.visitor-card');
    for (var j = 0; j < cards.length; j++) {
      cards[j].addEventListener('click', function () {
        openSlideOver(this.getAttribute('data-vid'));
      });
    }
  }

  function visitorCardHTML(v) {
    var html = '<div class="visitor-card" data-vid="' + v.visitor_id + '">';
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
    return html;
  }

  function groupByDate(visitors) {
    var now = new Date();
    var todayStr = now.toDateString();
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.toDateString();

    var groups = {};
    var order = [];

    for (var i = 0; i < visitors.length; i++) {
      var v = visitors[i];
      var d = v.last_seen_at ? new Date(v.last_seen_at) : new Date(0);
      var ds = d.toDateString();
      var label;
      if (ds === todayStr) {
        label = 'Today';
      } else if (ds === yesterdayStr) {
        label = 'Yesterday';
      } else {
        label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      }
      if (!groups[label]) {
        groups[label] = [];
        order.push(label);
      }
      groups[label].push(v);
    }

    return order.map(function (label) {
      return { label: label, visitors: groups[label] };
    });
  }

  // --- Render stats bar ---
  function renderStats(visitors, total) {
    if (!visitors || visitors.length === 0) {
      document.getElementById('stats-bar').innerHTML = '';
      return;
    }
    var converted = visitors.filter(function (v) { return v.converted; }).length;
    var active24h = visitors.filter(function (v) {
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
    var nameEl = document.getElementById('slide-over-name');
    backdrop.classList.add('open');
    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    nameEl.textContent = 'Loading...';

    apiFetch('/visitors/' + encodeURIComponent(visitorId)).then(function (v) {
      nameEl.textContent = v.display_name || v.name || v.email || 'Unknown';

      // Collect event type counts for the filter
      var typeCounts = {};
      var events = v.events || [];
      for (var k = 0; k < events.length; k++) {
        var t = events[k].event_type;
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
      var eventTypes = Object.keys(typeCounts).sort();
      var enabledTypes = new Set(eventTypes); // all enabled by default

      renderSlideOverContent(v, events, eventTypes, typeCounts, enabledTypes, body);
    }).catch(function (err) {
      if (err.message !== 'Unauthorized') {
        body.innerHTML = '<div class="empty-state"><p>Failed to load visitor.</p></div>';
      }
    });
  }

  function renderSlideOverContent(v, events, eventTypes, typeCounts, enabledTypes, body) {
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

    // Event filter
    if (events.length > 0 && eventTypes.length > 1) {
      html += '<div class="event-filter" id="event-filter">';
      html += '<button class="event-filter-toggle" id="ef-toggle">';
      html += 'Filter events (' + enabledTypes.size + '/' + eventTypes.length + ' types)';
      html += '<span class="chevron">&#9660;</span></button>';
      html += '<div class="event-filter-options" id="ef-options">';
      for (var fi = 0; fi < eventTypes.length; fi++) {
        var et = eventTypes[fi];
        var checked = enabledTypes.has(et) ? ' checked' : '';
        html += '<label class="event-filter-option">';
        html += '<input type="checkbox" data-event-type="' + et + '"' + checked + '>';
        html += '<span>' + eventLabel(et) + '</span>';
        html += '<span class="ef-count">' + typeCounts[et] + '</span>';
        html += '</label>';
      }
      html += '</div></div>';
    }

    // Filtered events
    var filteredEvents = events.filter(function (e) { return enabledTypes.has(e.event_type); });

    // Event timeline
    html += '<div class="timeline-header">Event Log (' + filteredEvents.length;
    if (filteredEvents.length !== events.length) html += ' / ' + events.length;
    html += ')</div>';

    if (filteredEvents.length > 0) {
      html += '<div class="timeline" id="timeline">';
      for (var j = 0; j < filteredEvents.length; j++) {
        var e = filteredEvents[j];
        html += timelineEventHTML(e);
      }
      html += '</div>';
    } else {
      html += '<div class="empty-state"><p>No events match the selected filters.</p></div>';
    }

    body.innerHTML = html;

    // Wire up event filter toggle
    var toggle = document.getElementById('ef-toggle');
    var options = document.getElementById('ef-options');
    if (toggle && options) {
      toggle.addEventListener('click', function () {
        toggle.classList.toggle('open');
        options.classList.toggle('open');
      });

      // Wire up checkboxes
      var checkboxes = options.querySelectorAll('input[type="checkbox"]');
      for (var ci = 0; ci < checkboxes.length; ci++) {
        checkboxes[ci].addEventListener('change', function () {
          var type = this.getAttribute('data-event-type');
          if (this.checked) {
            enabledTypes.add(type);
          } else {
            enabledTypes.delete(type);
          }
          renderSlideOverContent(v, events, eventTypes, typeCounts, enabledTypes, body);
        });
      }
    }
  }

  function timelineEventHTML(e) {
    var dotClass = 'dot-' + e.event_type;
    var page = e.page_url || '';
    var meta = eventMetaDetail(e);
    var html = '<div class="timeline-event">';
    html += '<div class="timeline-dot ' + dotClass + '"></div>';
    html += '<span class="event-time">' + formatTimestamp(e.occurred_at) + '</span>';
    html += '<span class="event-name">' + eventLabel(e.event_type) + '</span>';
    if (page) html += '<span class="event-page">— ' + escapeHtml(page) + '</span>';
    if (meta) html += '<div class="event-meta"><span>' + escapeHtml(meta) + '</span></div>';
    html += '</div>';
    return html;
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
  var lastTotal = 0;
  function loadVisitors() {
    apiFetch('/visitors?limit=200').then(function (data) {
      allVisitors = data.visitors || [];
      lastTotal = data.total || 0;
      renderStats(allVisitors, lastTotal);
      renderVisitors(allVisitors, lastTotal);
    }).catch(function (err) {
      if (err.message !== 'Unauthorized') {
        document.getElementById('content').innerHTML = '<div class="empty-state"><p>Failed to load visitors. Check your connection.</p></div>';
      }
    });
  }

  // --- Filter bar handlers ---
  var filterBtns = document.querySelectorAll('.filter-bar [data-filter]');
  for (var i = 0; i < filterBtns.length; i++) {
    filterBtns[i].addEventListener('click', function () {
      var filterKey = this.getAttribute('data-filter');
      var filterVal = this.getAttribute('data-value');
      currentFilters[filterKey] = filterVal;

      // Update active state within the same toggle group
      var siblings = this.parentElement.querySelectorAll('button');
      for (var s = 0; s < siblings.length; s++) siblings[s].classList.remove('active');
      this.classList.add('active');

      renderVisitors(allVisitors, lastTotal);
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
