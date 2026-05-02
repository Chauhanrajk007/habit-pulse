/**
 * charts.js — Chart.js wrappers with dynamic range and time-unit support
 */

const gridColor = 'rgba(255,255,255,0.05)';
const tickColor = 'rgba(160,160,192,0.6)';

function tooltipStyle() {
  return {
    backgroundColor: 'rgba(19,19,31,0.95)',
    borderColor: 'rgba(124,58,237,0.4)',
    borderWidth: 1,
    titleColor: '#F0F0FF',
    bodyColor: '#A0A0C0',
    padding: 10,
    cornerRadius: 8,
  };
}

/** Smart x-axis label: skip labels when there are too many data points */
function makeXLabels(dailyData) {
  const n = dailyData.length;
  return dailyData.map((d, i) => {
    // Show fewer labels when range is large
    if (n > 180 && i % 30 !== 0) return '';
    if (n > 60  && i % 7  !== 0) return '';
    if (n > 30  && i % 3  !== 0) return '';
    const date = new Date(d.date + 'T00:00:00');
    if (n > 60) return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
}

const chartRegistry = {};

function destroyChart(id) {
  if (chartRegistry[id]) { chartRegistry[id].destroy(); delete chartRegistry[id]; }
}

// ── Daily Line Chart ──────────────────────────────────────────
// timeDisplay: 'sec'|'min'|'hr'|null  (null = not a time unit)

export function renderDailyLineChart(canvasId, dailyData, color = '#7c3aed', unit = '', timeDisplay = null) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = makeXLabels(dailyData);
  // Convert values if time display requested
  const data = dailyData.map(d => {
    if (!timeDisplay) return d.value;
    return convertForDisplay(d.value, timeDisplay);
  });

  const displayUnit = timeDisplay || unit;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, ctx.offsetHeight || 200);
  gradient.addColorStop(0, color + '55');
  gradient.addColorStop(1, color + '00');

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: color,
        pointRadius: dailyData.length > 90 ? 1 : 3,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const d = dailyData[idx];
              if (!d) return '';
              const date = new Date(d.date + 'T00:00:00');
              return date.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
            },
            label: (item) => ` ${roundVal(item.parsed.y)} ${displayUnit}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 },
        },
        y: {
          grid: { color: gridColor },
          beginAtZero: true,
          ticks: {
            color: tickColor,
            font: { size: 11 },
            callback: (v) => `${roundVal(v)} ${displayUnit}`,
          },
        },
      },
    },
  });
}

// ── Weekly Bar Chart ──────────────────────────────────────────

export function renderWeeklyBarChart(canvasId, weeklyData, color = '#7c3aed', unit = '', timeDisplay = null) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const data = weeklyData.map(d => timeDisplay ? convertForDisplay(d.value, timeDisplay) : d.value);
  const displayUnit = timeDisplay || unit;

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklyData.map(d => d.label),
      datasets: [{
        data,
        backgroundColor: color + 'AA',
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            label: (c) => ` ${roundVal(c.parsed.y)} ${displayUnit}`,
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
        y: {
          grid: { color: gridColor },
          beginAtZero: true,
          ticks: {
            color: tickColor, font: { size: 11 },
            callback: (v) => `${roundVal(v)} ${displayUnit}`,
          },
        },
      },
    },
  });
}

// ── Global Combined Line ──────────────────────────────────────

export function renderGlobalLineChart(canvasId, dailyTotals, unit = '') {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const isPct = unit === '%';
  const labels = makeXLabels(dailyTotals);
  const data = dailyTotals.map(d => d.value);

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(124,58,237,0.5)');
  gradient.addColorStop(1, 'rgba(124,58,237,0.0)');

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#7c3aed',
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#7c3aed',
        pointRadius: dailyTotals.length > 90 ? 1 : 2,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            title: (items) => {
              const d = dailyTotals[items[0].dataIndex];
              if (!d) return '';
              return new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
            },
            label: (item) => ` ${roundVal(item.parsed.y)}${unit}`,
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 } },
        y: {
          grid: { color: gridColor },
          beginAtZero: true,
          ...(isPct ? { max: 100 } : {}),
          ticks: {
            color: tickColor, font: { size: 11 },
            callback: v => `${roundVal(v)}${unit}`,
          },
        },
      },
    },
  });
}


// ── Active vs Completed Doughnut ──────────────────────────────

export function renderDonutChart(canvasId, active, completed) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Completed'],
      datasets: [{
        data: [active || 0, completed || 0],
        backgroundColor: ['rgba(124,58,237,0.8)', 'rgba(16,185,129,0.8)'],
        borderColor: ['#7c3aed', '#10b981'],
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: tickColor, padding: 16, font: { size: 12 } },
        },
        tooltip: tooltipStyle(),
      },
    },
  });
}

// ── Cumulative Chart with Expected Pace Line ─────────────────
// actualData / expectedData: [{date, value}]
// expectedData may be null if no dailyTarget set

export function renderCumulativeChart(canvasId, actualData, expectedData, color = '#7c3aed', unit = '', timeDisplay = null) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = makeXLabels(actualData);
  const toVal = v => timeDisplay ? convertForDisplay(v, timeDisplay) : v;
  const displayUnit = timeDisplay || unit;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, color + '44');
  gradient.addColorStop(1, color + '00');

  const datasets = [{
    label: 'Actual',
    data: actualData.map(d => toVal(d.value)),
    borderColor: color,
    backgroundColor: gradient,
    borderWidth: 2.5,
    fill: true,
    tension: 0.4,
    pointBackgroundColor: color,
    pointRadius: actualData.length > 90 ? 1 : 3,
    pointHoverRadius: 6,
  }];

  if (expectedData && expectedData.length) {
    datasets.push({
      label: 'Expected Pace',
      data: expectedData.map(d => toVal(d.value)),
      borderColor: 'rgba(180,180,200,0.65)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [7, 4],
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 4,
    });
  }

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: !!expectedData,
          labels: { color: 'rgba(160,160,192,0.85)', font: { size: 11 }, usePointStyle: true, pointStyleWidth: 16 },
        },
        tooltip: {
          ...tooltipStyle(),
          callbacks: {
            title: (items) => {
              const d = actualData[items[0].dataIndex];
              return d ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '';
            },
            label: (item) => ` ${item.dataset.label}: ${roundVal(item.parsed.y)} ${displayUnit}`,
          },
        },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 }, maxRotation: 45 } },
        y: {
          grid: { color: gridColor },
          beginAtZero: false,
          ticks: { color: tickColor, font: { size: 11 }, callback: v => `${roundVal(v)} ${displayUnit}` },
        },
      },
    },
  });
}

export function destroyAllCharts() {
  Object.keys(chartRegistry).forEach(destroyChart);
}


// ── Internal helpers ──────────────────────────────────────────

function convertForDisplay(seconds, timeDisplay) {
  if (timeDisplay === 'min') return seconds / 60;
  if (timeDisplay === 'hr')  return seconds / 3600;
  return seconds;
}

function roundVal(v) {
  if (v === 0) return 0;
  if (Math.abs(v) >= 100) return Math.round(v);
  if (Math.abs(v) >= 10)  return parseFloat(v.toFixed(1));
  return parseFloat(v.toFixed(2));
}
