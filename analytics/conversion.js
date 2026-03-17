/**
 * VK Analytics — Conversion Rate page logic.
 */
(function () {
  'use strict';

  var API = '/api/analytics/dashboard';
  var chart = null;
  var currentPeriod = 'week';
  var conversionData = null;
  var annotations = [];

  function apiFetch(path, opts) {
    return fetch(API + path, Object.assign({
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    }, opts || {})).then(function (res) {
      if (res.status === 401) {
        window.location.href = '/analytics/login.html';
        throw new Error('Unauthorized');
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- Stats bar ---
  function renderStats(stats) {
    if (!stats) return;
    var bar = document.getElementById('stats-bar');
    bar.innerHTML =
      statCard('All-time CVR', stats.all_time.rate + '%', stats.all_time.converted + ' / ' + stats.all_time.total) +
      statCard('This Month', stats.this_month.rate + '%', stats.this_month.converted + ' / ' + stats.this_month.total) +
      statCard('This Week', stats.this_week.rate + '%', stats.this_week.converted + ' / ' + stats.this_week.total);
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + label + '</div><div class="stat-value">' + value + '</div><div class="stat-sub">' + sub + '</div></div>';
  }

  // --- Chart ---
  function renderChart(series, periodType) {
    var ctx = document.getElementById('cvr-chart');
    if (!ctx) return;

    var labels = series.map(function (s) {
      if (periodType === 'week' && s.period_start) {
        var d = new Date(s.period_start);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      return String(s.period);
    });
    var rates = series.map(function (s) { return s.rate; });
    var totals = series.map(function (s) { return s.total; });
    var converted = series.map(function (s) { return s.converted; });

    if (chart) chart.destroy();

    var maxVisitors = Math.max.apply(null, totals.concat([1]));

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Conversion Rate %',
            data: rates,
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1.5,
            borderRadius: 4,
            maxBarThickness: 40,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Unique Visitors',
            data: totals,
            type: 'line',
            borderColor: '#666',
            backgroundColor: 'rgba(102, 102, 102, 0.08)',
            borderWidth: 1.5,
            pointRadius: 3,
            pointBackgroundColor: '#666',
            fill: true,
            tension: 0.3,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              boxHeight: 12,
              padding: 16,
              font: { family: "'DM Sans', sans-serif", size: 11 },
              color: '#666'
            }
          },
          tooltip: {
            callbacks: {
              afterLabel: function (ctx) {
                if (ctx.datasetIndex === 0) {
                  var i = ctx.dataIndex;
                  return converted[i] + ' converted / ' + totals[i] + ' visitors';
                }
                return '';
              }
            }
          }
        },
        scales: {
          y: {
            position: 'left',
            beginAtZero: true,
            max: Math.max(Math.ceil(Math.max.apply(null, rates.concat([10])) / 5) * 5, 10),
            ticks: {
              callback: function (v) { return v + '%'; },
              font: { family: "'DM Sans', sans-serif", size: 11 },
              color: '#999'
            },
            grid: { color: '#F0F0F0' },
            border: { display: false }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            max: Math.ceil(maxVisitors * 1.2),
            ticks: {
              font: { family: "'DM Sans', sans-serif", size: 11 },
              color: '#999'
            },
            grid: { display: false },
            border: { display: false }
          },
          x: {
            ticks: {
              font: { family: "'DM Sans', sans-serif", size: 11 },
              color: '#999'
            },
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });
  }

  // --- Annotations ---
  function renderAnnotations() {
    var list = document.getElementById('annotations-list');
    if (!annotations || annotations.length === 0) {
      list.innerHTML = '';
      return;
    }
    var html = '';
    for (var i = 0; i < annotations.length; i++) {
      var a = annotations[i];
      html += '<div class="annotation-item">';
      html += '<span class="ann-period">' + escapeHtml(a.period) + '</span>';
      html += '<span class="ann-note">' + escapeHtml(a.note) + '</span>';
      html += '<button class="ann-delete" data-id="' + a.id + '" title="Delete">&times;</button>';
      html += '</div>';
    }
    list.innerHTML = html;

    // Delete handlers
    var btns = list.querySelectorAll('.ann-delete');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        apiFetch('/annotations/' + id, { method: 'DELETE' }).then(loadAll);
      });
    }
  }

  function getCurrentPeriod() {
    if (!conversionData || !conversionData.series || conversionData.series.length === 0) return '';
    return conversionData.series[conversionData.series.length - 1].period;
  }

  // --- Toggle ---
  var toggleBtns = document.querySelectorAll('.toggle-group button');
  for (var i = 0; i < toggleBtns.length; i++) {
    toggleBtns[i].addEventListener('click', function () {
      currentPeriod = this.getAttribute('data-period');
      for (var k = 0; k < toggleBtns.length; k++) toggleBtns[k].classList.remove('active');
      this.classList.add('active');
      loadConversion();
    });
  }

  // --- Add annotation ---
  document.getElementById('annotation-submit').addEventListener('click', function () {
    var input = document.getElementById('annotation-note');
    var note = input.value.trim();
    if (!note) return;
    var period = getCurrentPeriod();
    if (!period) return;

    apiFetch('/annotations', {
      method: 'POST',
      body: JSON.stringify({ period: String(period), period_type: currentPeriod, note: note })
    }).then(function () {
      input.value = '';
      loadAnnotations();
    });
  });

  document.getElementById('annotation-note').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('annotation-submit').click();
  });

  // --- Load ---
  function loadConversion() {
    apiFetch('/conversion?period_type=' + currentPeriod + '&periods=12').then(function (data) {
      conversionData = data;
      renderStats(data.stats);
      renderChart(data.series || [], data.period_type);
    });
  }

  function loadAnnotations() {
    apiFetch('/annotations').then(function (data) {
      annotations = data || [];
      renderAnnotations();
    });
  }

  function loadAll() {
    loadConversion();
    loadAnnotations();
  }

  loadAll();
})();
