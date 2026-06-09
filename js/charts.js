/**
 * charts.js — Chart.js wrappers with dynamic range and time-unit support
 * Enhanced v2 — premium dark-mode styling with gradients, animations, better tooltips
 */

const gridColor = 'rgba(255,255,255,0.04)';
const tickColor = 'rgba(160,160,192,0.6)';
const fontFamily = "'Inter', sans-serif";

function tooltipStyle(accentColor) {
  return {
    backgroundColor: 'rgba(12,12,24,0.96)',
    borderColor: accentColor || 'rgba(124,58,237,0.35)',
    borderWidth: 1,
    titleColor: '#F0F0FF',
    bodyColor: '#C0C0D8',
    padding: { top: 10, bottom: 10, left: 14, right: 14 },
    cornerRadius: 12,
    titleFont: { family: fontFamily, size: 12, weight: '600' },
    bodyFont: { family: fontFamily, size: 12, weight: '500' },
    displayColors: false,
    caretSize: 6,
    caretPadding: 8,
  };
}

function commonScaleOpts() {
  return {
    x: {
      grid: { color: gridColor, drawBorder: false },
      ticks: { color: tickColor, font: { size: 10, family: fontFamily }, maxRotation: 45 },
      border: { display: false },
    },
    y: {
      grid: { color: gridColor, drawBorder: false },
      beginAtZero: true,
      border: { display: false },
      ticks: { color: tickColor, font: { size: 11, family: fontFamily } },
    },
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

  const context = ctx.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, ctx.offsetHeight || 200);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(0.7, color + '10');
  gradient.addColorStop(1, color + '00');

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: color,
        pointBorderColor: 'transparent',
        pointRadius: dailyData.length > 90 ? 0 : dailyData.length > 30 ? 2 : 3,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color,
        pointHoverBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(color + '50'),
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
        ...commonScaleOpts(),
        y: {
          ...commonScaleOpts().y,
          ticks: {
            ...commonScaleOpts().y.ticks,
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

  const context = ctx.getContext('2d');
  const barGradient = context.createLinearGradient(0, 0, 0, ctx.offsetHeight || 200);
  barGradient.addColorStop(0, color);
  barGradient.addColorStop(1, color + '66');

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeklyData.map(d => d.label),
      datasets: [{
        data,
        backgroundColor: barGradient,
        hoverBackgroundColor: color,
        borderColor: color + 'CC',
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 40,
        hoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipStyle(color + '50'),
          callbacks: {
            label: (c) => ` ${roundVal(c.parsed.y)} ${displayUnit}`,
          },
        },
      },
      scales: {
        ...commonScaleOpts(),
        y: {
          ...commonScaleOpts().y,
          ticks: {
            ...commonScaleOpts().y.ticks,
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

  const context = ctx.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(124,58,237,0.35)');
  gradient.addColorStop(0.6, 'rgba(124,58,237,0.10)');
  gradient.addColorStop(1, 'rgba(124,58,237,0.0)');

  const datasets = [{
    label: 'Completion',
    data,
    borderColor: '#8b5cf6',
    backgroundColor: gradient,
    borderWidth: 2.5,
    fill: true,
    tension: 0.4,
    pointBackgroundColor: '#8b5cf6',
    pointBorderColor: 'transparent',
    pointRadius: dailyTotals.length > 90 ? 0 : 2,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#fff',
    pointHoverBorderColor: '#8b5cf6',
    pointHoverBorderWidth: 3,
  }];

  // Add 7-day moving average if enough data points
  if (data.length > 7) {
    const movingAvg = [];
    for (let i = 0; i < data.length; i++) {
      if (i < 6) { movingAvg.push(null); continue; }
      const slice = data.slice(i - 6, i + 1);
      movingAvg.push(Math.round(slice.reduce((a, b) => a + b, 0) / 7));
    }
    datasets.push({
      label: '7-day avg',
      data: movingAvg,
      borderColor: 'rgba(167,139,250,0.5)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [5, 3],
      fill: false,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#a78bfa',
    });
  }

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: 'rgba(160,160,192,0.85)',
            font: { size: 11, family: fontFamily },
            usePointStyle: true,
            pointStyleWidth: 12,
            padding: 12,
          },
        },
        tooltip: {
          ...tooltipStyle('rgba(139,92,246,0.5)'),
          callbacks: {
            title: (items) => {
              const d = dailyTotals[items[0].dataIndex];
              if (!d) return '';
              return new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
            },
            label: (item) => ` ${item.dataset.label}: ${roundVal(item.parsed.y)}${unit}`,
          },
        },
      },
      scales: {
        ...commonScaleOpts(),
        y: {
          ...commonScaleOpts().y,
          ...(isPct ? { max: 100 } : {}),
          ticks: {
            ...commonScaleOpts().y.ticks,
            callback: v => `${roundVal(v)}${unit}`,
          },
        },
      },
    },
  });
}


// ── Active vs Completed Doughnut ──────────────────────────────

// Center text plugin for donut chart
const donutCenterPlugin = {
  id: 'donutCenterText',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data.length) return;
    
    const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Total number
    ctx.font = "800 1.5rem 'Outfit', sans-serif";
    ctx.fillStyle = '#F0F0FF';
    ctx.fillText(total, centerX, centerY - 6);
    
    // Label
    ctx.font = "600 0.6rem 'Inter', sans-serif";
    ctx.fillStyle = '#60607A';
    ctx.fillText('TOTAL', centerX, centerY + 14);
    
    ctx.restore();
  }
};

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
        backgroundColor: ['#8b5cf6', '#10b981'],
        hoverBackgroundColor: ['#a78bfa', '#34d399'],
        borderColor: ['rgba(139,92,246,0.3)', 'rgba(16,185,129,0.3)'],
        borderWidth: 2,
        hoverOffset: 12,
        spacing: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      animation: { duration: 800, easing: 'easeOutQuart', animateRotate: true },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: tickColor,
            padding: 16,
            font: { size: 12, family: fontFamily, weight: '600' },
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: tooltipStyle(),
      },
    },
    plugins: [donutCenterPlugin],
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

  const context = ctx.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, color + '35');
  gradient.addColorStop(0.7, color + '10');
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
    pointBorderColor: 'transparent',
    pointRadius: actualData.length > 90 ? 0 : 3,
    pointHoverRadius: 7,
    pointHoverBackgroundColor: '#fff',
    pointHoverBorderColor: color,
    pointHoverBorderWidth: 3,
    pointStyle: 'circle',
  }];

  if (expectedData && expectedData.length) {
    datasets.push({
      label: 'Expected Pace',
      data: expectedData.map(d => toVal(d.value)),
      borderColor: 'rgba(180,180,200,0.4)',
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderDash: [7, 4],
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: 'rgba(180,180,200,0.7)',
    });
  }

  chartRegistry[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: !!expectedData,
          labels: {
            color: 'rgba(160,160,192,0.85)',
            font: { size: 11, family: fontFamily },
            usePointStyle: true,
            pointStyleWidth: 14,
            padding: 12,
          },
        },
        tooltip: {
          ...tooltipStyle(color + '40'),
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
        ...commonScaleOpts(),
        y: {
          ...commonScaleOpts().y,
          beginAtZero: false,
          ticks: {
            ...commonScaleOpts().y.ticks,
            callback: v => `${roundVal(v)} ${displayUnit}`,
          },
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
  if (v == null || isNaN(v)) return 0;
  if (v === 0) return 0;
  if (Math.abs(v) >= 100) return Math.round(v);
  if (Math.abs(v) >= 10)  return parseFloat(v.toFixed(1));
  return parseFloat(v.toFixed(2));
}
