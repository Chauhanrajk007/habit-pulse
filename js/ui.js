/**
 * ui.js — All DOM rendering and event binding
 */

import {
  getGoals, deleteGoal, upsertGoal, exportBackup, importBackup
} from './storage.js';
import {
  createGoal, logProgress, getStats, formatValue, formatSeconds,
  isTimeUnit, parseTimeToSeconds, resetGoalProgress, getDailyData,
  getWeeklyData, getGlobalAnalytics, TIME_UNIT, convertTimeValue, getTimeUnitLabel,
  getTodayLogged, getCumulativeData, getExpectedCumulative, getHabitDeficit
} from './logic.js';
import {
  renderDailyLineChart, renderWeeklyBarChart,
  renderGlobalLineChart, renderDonutChart, renderCumulativeChart
} from './charts.js';

// ── Palette ──────────────────────────────────────────────────
const PALETTE = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316'];
const UNIT_OPTS = ['hours', 'videos', 'pages', 'problems', 'custom'];

// ── Per-context chart state ───────────────────────────────────
// Persists range + timeDisplay across re-renders within a session
const chartState = {
  global:  { range: 30 },
  pergoal: { range: 30, timeDisplay: 'sec', goalId: null },
  detail:  { range: 30, timeDisplay: 'sec', goalId: null, view: 'daily' },
};

// ── Toast ─────────────────────────────────────────────────────
export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  t.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

// ── Confirm ───────────────────────────────────────────────────
export function showConfirm({ icon, title, msg, confirmText = 'Confirm', onConfirm }) {
  const overlay = document.getElementById('confirm-overlay');
  document.getElementById('confirm-icon').textContent = icon || '⚠️';
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('btn-confirm-action').textContent = confirmText;
  overlay.classList.add('open');
  const handler = () => {
    overlay.classList.remove('open');
    document.getElementById('btn-confirm-action').removeEventListener('click', handler);
    onConfirm();
  };
  document.getElementById('btn-confirm-action').addEventListener('click', handler);
}

// ── SVG Progress Ring ─────────────────────────────────────────
function buildRing(percent, color) {
  const R = 30;
  const C = 2 * Math.PI * R;
  const offset = C - (percent / 100) * C;
  return `
    <svg viewBox="0 0 72 72" width="72" height="72">
      <circle class="ring-bg" cx="36" cy="36" r="${R}"/>
      <circle class="ring-progress" cx="36" cy="36" r="${R}"
        stroke="${color}"
        stroke-dasharray="${C}"
        stroke-dashoffset="${offset}"
        style="--dash-total:${C};--dash-offset:${offset}"
      />
    </svg>`;
}

// ── Goal Card ─────────────────────────────────────────────────
function buildGoalCard(goal, completed = false) {
  // Route habit cards to their own renderer
  if (goal.type === 'habit' && !completed) return buildHabitCard(goal);

  const stats = getStats(goal);
  const ring = buildRing(stats.percent, goal.color);
  const unitLabel = goal.isTime ? 'hours' : goal.unit;
  const completedStr = formatValue(goal.completed, goal.unit);
  const targetStr = formatValue(goal.target, goal.unit);
  const remainStr = formatValue(stats.remaining, goal.unit);

  const streakHtml = stats.streak > 0
    ? `<span class="pill pill-streak">🔥 ${stats.streak}d streak</span>`
    : '';
  const doneHtml = completed
    ? `<span class="pill pill-done badge-pop">✓ Done</span>`
    : '';

  const actionsHtml = !completed ? `
    <div class="goal-actions">
      <button class="btn-log" data-log="${goal.id}" id="btn-log-${goal.id}">+ Log Progress</button>
      <button class="btn-icon" data-detail="${goal.id}" title="Details">📊</button>
      <button class="btn-icon" data-edit="${goal.id}" title="Edit">✏️</button>
    </div>` : `
    <div class="goal-actions">
      <button class="btn-icon" data-detail="${goal.id}" title="Details" style="flex:1">📊 View Stats</button>
    </div>`;

  const card = document.createElement('div');
  card.className = 'card card-enter';
  card.dataset.goalId = goal.id;
  card.innerHTML = `
    <div class="goal-card">
      <div class="goal-ring-wrap">
        ${ring}
        <div class="ring-pct" style="color:${goal.color}">${stats.percent}%</div>
      </div>
      <div class="goal-meta">
        <div class="goal-title">${escHtml(goal.title)}</div>
        <div class="goal-subtitle">${completedStr} / ${targetStr} · ${remainStr} left</div>
        <div class="goal-footer">
          <span class="pill pill-unit">${escHtml(unitLabel)}</span>
          ${streakHtml}
          ${doneHtml}
        </div>
      </div>
    </div>
    ${actionsHtml}`;
  return card;
}

// ── Habit Card ────────────────────────────────────────────────
function buildHabitCard(goal) {
  const stats = getStats(goal);
  const deficit = getHabitDeficit(goal);
  const unitLabel = goal.isTime ? 'hours' : goal.unit;
  const totalStr = formatValue(goal.completed - (goal.startingProgress || 0), goal.unit);

  // Deficit badge
  let deficitHtml = '';
  if (deficit) {
    const valStr = formatValue(deficit.value, goal.unit);
    if (deficit.isOnTrack) {
      deficitHtml = `<span class="pill pill-ontrack">✓ On track</span>`;
    } else if (deficit.isAhead) {
      deficitHtml = `<span class="pill pill-ahead">+${valStr} ahead</span>`;
    } else {
      deficitHtml = `<span class="pill pill-behind">${valStr} behind</span>`;
    }
  }

  const streakHtml = stats.streak > 0
    ? `<span class="pill pill-streak">🔥 ${stats.streak}d</span>`
    : '';

  const card = document.createElement('div');
  card.className = 'card card-enter';
  card.dataset.goalId = goal.id;
  card.innerHTML = `
    <div class="goal-card">
      <div class="habit-icon-circle" style="background:${goal.color}22;border-color:${goal.color}44">
        <span style="font-size:1.3rem">🔁</span>
      </div>
      <div class="goal-meta">
        <div class="goal-title">${escHtml(goal.title)}</div>
        <div class="goal-subtitle">${totalStr} logged total</div>
        <div class="goal-footer">
          <span class="pill pill-unit">${escHtml(unitLabel)}</span>
          ${streakHtml}
          ${deficitHtml}
        </div>
      </div>
    </div>
    <div class="goal-actions">
      <button class="btn-log" data-log="${goal.id}" id="btn-log-${goal.id}">+ Log</button>
      <button class="btn-icon" data-detail="${goal.id}" title="Details">📊</button>
      <button class="btn-icon" data-edit="${goal.id}" title="Edit">✏️</button>
    </div>`;
  return card;
}

// ── Render Active Goals ───────────────────────────────────────
export function renderActiveGoals() {
  const goals = getGoals().filter(g => !g.isCompleted);
  const list = document.getElementById('active-goal-list');
  list.innerHTML = '';

  // Toggle FAB pulse
  document.getElementById('fab-add').classList.toggle('pulse', goals.length === 0);

  if (!goals.length) {
    list.appendChild(buildEmptyState('🎯', 'No active goals', 'Tap the + button to create your first goal'));
    renderDailyWidget();
    return;
  }
  goals.forEach(g => list.appendChild(buildGoalCard(g, false)));
  bindGoalCardEvents(list);
  renderDailyWidget();
}


// ── Render Completed Goals ────────────────────────────────────
export function renderCompletedGoals() {
  const goals = getGoals().filter(g => g.isCompleted);
  const list = document.getElementById('completed-goal-list');
  list.innerHTML = '';

  const banner = document.getElementById('completed-banner');
  if (goals.length) {
    banner.style.display = 'flex';
    document.getElementById('completed-count-text').textContent =
      `${goals.length} goal${goals.length > 1 ? 's' : ''} completed — amazing work!`;
  } else {
    banner.style.display = 'none';
    list.appendChild(buildEmptyState('✅', 'No completed goals yet', 'Keep going — you\'ve got this!'));
    return;
  }
  goals.forEach(g => list.appendChild(buildGoalCard(g, true)));
  bindGoalCardEvents(list);
}

// ── Render Analytics ─────────────────────────────────────────
export function renderAnalytics() {
  const analytics = getGlobalAnalytics(chartState.global.range);
  const goals = getGoals();

  // Hero
  document.getElementById('analytics-pct').textContent = analytics.overallPercent + '%';
  document.getElementById('analytics-progress-fill').style.width = analytics.overallPercent + '%';

  // Stat grid
  document.getElementById('stat-total-goals').textContent = analytics.totalGoals;
  document.getElementById('stat-active').textContent = analytics.activeCount;
  document.getElementById('stat-completed').textContent = analytics.completedCount;
  document.getElementById('stat-best-streak').textContent = analytics.bestStreak + 'd';

  // Global line chart — y-axis is now daily target completion %
  const globalChartNote = document.getElementById('global-chart-note');
  if (!analytics.hasTargetedGoals) {
    if (globalChartNote) globalChartNote.style.display = 'block';
  } else {
    if (globalChartNote) globalChartNote.style.display = 'none';
  }
  renderGlobalLineChart('chart-global-daily', analytics.dailyTotals, '%');

  // Donut
  renderDonutChart('chart-donut', analytics.activeCount, analytics.completedCount);

  // Per-goal chip selector
  buildGoalChips(goals);
}

function buildGoalChips(goals) {
  const row = document.getElementById('goal-chip-row');
  row.innerHTML = '';
  if (!goals.length) return;

  // Restore or init
  const initGoal = chartState.pergoal.goalId
    ? goals.find(g => g.id === chartState.pergoal.goalId) || goals[0]
    : goals[0];
  chartState.pergoal.goalId = initGoal.id;

  renderPerGoalCharts(initGoal);

  goals.forEach((g, i) => {
    const isActive = g.id === initGoal.id;
    const chip = document.createElement('button');
    chip.className = 'goal-chip' + (isActive ? ' active' : '');
    chip.dataset.goalId = g.id;
    chip.style.backgroundColor = isActive ? g.color + '22' : '';
    chip.style.borderColor = isActive ? g.color : '';
    chip.style.color = isActive ? g.color : '';
    chip.innerHTML = `
      <span class="goal-chip-dot" style="background:${g.color}"></span>
      ${escHtml(g.title)}`;
    chip.addEventListener('click', () => {
      row.querySelectorAll('.goal-chip').forEach(c => {
        c.classList.remove('active');
        c.style.backgroundColor = '';
        c.style.borderColor = '';
        c.style.color = '';
      });
      chip.classList.add('active');
      chip.style.backgroundColor = g.color + '22';
      chip.style.borderColor = g.color;
      chip.style.color = g.color;
      chartState.pergoal.goalId = g.id;
      chartState.pergoal.timeDisplay = 'sec'; // reset unit on goal change
      syncUnitPills('per-goal-unit-row', 'sec');
      renderPerGoalCharts(g);
    });
    row.appendChild(chip);
  });
}

function renderPerGoalCharts(goal, range, timeDisplay) {
  // Use args if provided, else fall back to persisted state
  const r = range !== undefined ? range : chartState.pergoal.range;
  const td = timeDisplay !== undefined ? timeDisplay : chartState.pergoal.timeDisplay;

  // Show/hide time-unit toggle
  const unitRow = document.getElementById('per-goal-unit-row');
  if (unitRow) unitRow.style.display = goal.isTime ? 'flex' : 'none';

  const daily  = getDailyData(goal.history, r);
  const weekly = getWeeklyData(goal.history, r === 'all' ? 52 : Math.ceil((r === 7 ? 7 : r) / 7));
  const unitLabel = goal.isTime ? getTimeUnitLabel(td) : goal.unit;
  const timeDsp   = goal.isTime ? td : null;

  document.getElementById('per-goal-chart-title').textContent = goal.title;
  renderDailyLineChart('chart-per-goal-daily',  daily,  goal.color, unitLabel, timeDsp);
  renderWeeklyBarChart('chart-per-goal-weekly', weekly, goal.color, unitLabel, timeDsp);
}

// ── Bind Card Events ──────────────────────────────────────────
function bindGoalCardEvents(container) {
  container.addEventListener('click', e => {
    const logBtn = e.target.closest('[data-log]');
    const detailBtn = e.target.closest('[data-detail]');
    const editBtn = e.target.closest('[data-edit]');
    if (logBtn) openLogModal(logBtn.dataset.log);
    if (detailBtn) openDetailModal(detailBtn.dataset.detail);
    if (editBtn) openEditModal(editBtn.dataset.edit);
  });
}

// ── Empty State ───────────────────────────────────────────────
function buildEmptyState(icon, title, desc) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>`;
  return div;
}

// ── Add Goal Modal ────────────────────────────────────────────
export function openAddModal() {
  populateGoalModal(null);
  openModal('modal-goal');
}

export function openEditModal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  populateGoalModal(goal);
  openModal('modal-goal');
}

function populateGoalModal(goal) {
  const form = document.getElementById('goal-form');
  form.dataset.editId = goal ? goal.id : '';
  document.getElementById('modal-goal-title').textContent = goal ? 'Edit Goal' : 'New Goal';
  document.getElementById('goal-submit-btn').textContent = goal ? 'Save Changes ✓' : 'Create Goal 🎯';

  // Type toggle
  const isHabit = goal && goal.type === 'habit';
  document.getElementById('goal-type-input').value = isHabit ? 'habit' : 'goal';
  document.getElementById('type-btn-goal').classList.toggle('active', !isHabit);
  document.getElementById('type-btn-habit').classList.toggle('active', isHabit);
  document.getElementById('goal-only-wrap').style.display = isHabit ? 'none' : '';
  document.getElementById('goal-title-label').textContent = isHabit ? 'Habit Name' : 'Goal Title';

  document.getElementById('goal-title-input').value = goal ? goal.title : '';
  document.getElementById('goal-target-input').value = goal ? goal.target : '';
  document.getElementById('goal-start-input').value = goal ? (goal.startingProgress || 0) : 0;

  // Daily target
  document.getElementById('goal-daily-target-input').value =
    (goal && goal.dailyTarget) ? goal.dailyTarget : '';

  // Unit
  const unitSel = document.getElementById('goal-unit-select');
  const customWrap = document.getElementById('custom-unit-wrap');
  const customInput = document.getElementById('goal-custom-unit');
  if (goal) {
    if (UNIT_OPTS.includes(goal.unit) || goal.unit === 'hours') {
      unitSel.value = goal.unit;
      customWrap.style.display = 'none';
    } else {
      unitSel.value = 'custom';
      customInput.value = goal.unit;
      customWrap.style.display = 'block';
    }
  } else {
    unitSel.value = 'videos';
    customWrap.style.display = 'none';
  }
  toggleTimeInputs();

  // Color
  const selected = goal ? goal.color : PALETTE[0];
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.dataset.color === selected);
  });
  form.dataset.color = selected;
}

export function initGoalForm() {
  // Type toggle
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      document.getElementById('goal-type-input').value = type;
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isHabit = type === 'habit';
      document.getElementById('goal-only-wrap').style.display = isHabit ? 'none' : '';
      document.getElementById('goal-title-label').textContent = isHabit ? 'Habit Name' : 'Goal Title';
      document.getElementById('goal-submit-btn').textContent = isHabit ? 'Create Habit 🔁' : 'Create Goal 🎯';
    });
  });

  // Unit change
  document.getElementById('goal-unit-select').addEventListener('change', toggleTimeInputs);

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('goal-form').dataset.color = sw.dataset.color;
    });
  });

  // Form submit
  document.getElementById('goal-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const title = document.getElementById('goal-title-input').value.trim();
    const type = document.getElementById('goal-type-input').value || 'goal';
    const isHabit = type === 'habit';
    const unitSel = document.getElementById('goal-unit-select').value;
    const unit = unitSel === 'custom'
      ? (document.getElementById('goal-custom-unit').value.trim() || 'units')
      : unitSel;

    let target = null;
    if (!isHabit) {
      if (isTimeUnit(unit)) {
        target = parseTimeToSeconds(
          document.getElementById('goal-time-h').value,
          document.getElementById('goal-time-m').value,
          document.getElementById('goal-time-s').value
        );
      } else {
        target = parseFloat(document.getElementById('goal-target-input').value);
      }
    }

    let startingProgress = 0;
    if (isTimeUnit(unit)) {
      startingProgress = parseTimeToSeconds(
        document.getElementById('goal-start-h').value || 0,
        document.getElementById('goal-start-m').value || 0,
        document.getElementById('goal-start-s').value || 0
      );
    } else {
      startingProgress = parseFloat(document.getElementById('goal-start-input').value) || 0;
    }

    // Daily target
    let dailyTarget = null;
    if (isTimeUnit(unit)) {
      const dt = parseTimeToSeconds(
        document.getElementById('goal-daily-h').value,
        document.getElementById('goal-daily-m').value,
        document.getElementById('goal-daily-s').value
      );
      if (dt > 0) dailyTarget = dt;
    } else {
      const dt = parseFloat(document.getElementById('goal-daily-target-input').value);
      if (dt > 0) dailyTarget = dt;
    }

    if (!title) { showToast('Please enter a title', 'error'); return; }
    if (!isHabit && (!target || target <= 0)) { showToast('Please enter a valid target', 'error'); return; }
    if (isHabit && !dailyTarget) { showToast('Habits need a Daily Target to track deficit', 'warning'); }

    const editId = form.dataset.editId;
    if (editId) {
      const goals = getGoals();
      const goal = goals.find(g => g.id === editId);
      if (goal) {
        goal.title = title;
        goal.unit = unit;
        goal.type = type;
        goal.isTime = isTimeUnit(unit);
        if (!isHabit) goal.target = target;
        goal.color = form.dataset.color || goal.color;
        goal.dailyTarget = dailyTarget;
        upsertGoal(goal);
        showToast('Updated!', 'success');
      }
    } else {
      createGoal({ title, unit, target, startingProgress, color: form.dataset.color, dailyTarget, type });
      showToast(isHabit ? 'Habit created! 🔁' : 'Goal created! 🎯', 'success');
    }

    closeModal('modal-goal');
    renderActiveGoals();
  });
}

function toggleTimeInputs() {
  const unit = document.getElementById('goal-unit-select').value;
  const isTime = unit === TIME_UNIT;
  const customWrap = document.getElementById('custom-unit-wrap');

  document.getElementById('target-number-wrap').style.display = isTime ? 'none' : 'block';
  document.getElementById('target-time-wrap').style.display = isTime ? 'block' : 'none';
  document.getElementById('start-number-wrap').style.display = isTime ? 'none' : 'block';
  document.getElementById('start-time-wrap').style.display = isTime ? 'block' : 'none';
  document.getElementById('daily-target-number-wrap').style.display = isTime ? 'none' : 'block';
  document.getElementById('daily-target-time-wrap').style.display = isTime ? 'block' : 'none';
  customWrap.style.display = unit === 'custom' ? 'block' : 'none';
}

// ── Log Progress Modal ────────────────────────────────────────
export function openLogModal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  document.getElementById('modal-log-title').textContent = `Log: ${goal.title}`;
  document.getElementById('log-form').dataset.goalId = goalId;
  document.getElementById('log-form').dataset.unit = goal.unit;
  document.getElementById('log-form').dataset.logMode = 'duration';

  const isTime = goal.isTime;
  document.getElementById('log-number-wrap').style.display = isTime ? 'none' : 'block';
  document.getElementById('log-time-wrap').style.display = isTime ? 'block' : 'none';
  document.getElementById('log-unit-label').textContent = goal.isTime ? '' : goal.unit;

  // Reset to duration mode
  document.getElementById('log-duration-inputs').style.display = '';
  document.getElementById('log-fromto-inputs').style.display = 'none';
  document.getElementById('log-mode-duration').classList.add('active');
  document.getElementById('log-mode-fromto').classList.remove('active');
  document.getElementById('log-fromto-preview').textContent = '';

  // Clear all fields
  ['log-value', 'log-h', 'log-m', 'log-s', 'log-from-time', 'log-to-time'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.getElementById('log-date-display').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  openModal('modal-log');
}

export function initLogForm() {
  // Duration / From→To tab toggle
  document.getElementById('log-mode-duration').addEventListener('click', () => {
    document.getElementById('log-form').dataset.logMode = 'duration';
    document.getElementById('log-duration-inputs').style.display = '';
    document.getElementById('log-fromto-inputs').style.display = 'none';
    document.getElementById('log-mode-duration').classList.add('active');
    document.getElementById('log-mode-fromto').classList.remove('active');
  });
  document.getElementById('log-mode-fromto').addEventListener('click', () => {
    document.getElementById('log-form').dataset.logMode = 'fromto';
    document.getElementById('log-duration-inputs').style.display = 'none';
    document.getElementById('log-fromto-inputs').style.display = '';
    document.getElementById('log-mode-duration').classList.remove('active');
    document.getElementById('log-mode-fromto').classList.add('active');
  });
  // Live preview
  ['log-from-time', 'log-to-time'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateFromToPreview);
  });

  document.getElementById('log-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const goalId = form.dataset.goalId;
    const unit = form.dataset.unit;
    const isTime = isTimeUnit(unit);
    const logMode = form.dataset.logMode || 'duration';

    let value;
    if (isTime && logMode === 'fromto') {
      value = calcFromToSeconds();
      if (!value || value <= 0) { showToast('Invalid time range — check start/end times', 'error'); return; }
    } else if (isTime) {
      value = parseTimeToSeconds(
        document.getElementById('log-h').value,
        document.getElementById('log-m').value,
        document.getElementById('log-s').value
      );
    } else {
      value = parseFloat(document.getElementById('log-value').value);
    }

    if (!value || isNaN(value) || value <= 0) {
      showToast('Enter a valid value', 'error');
      return;
    }

    const updated = logProgress(goalId, value);
    if (!updated) { showToast('Something went wrong', 'error'); return; }

    const wasCompleted = updated.isCompleted;
    closeModal('modal-log');
    renderActiveGoals();
    renderCompletedGoals();

    if (wasCompleted && updated.completedAt &&
        new Date(updated.completedAt) > new Date(Date.now() - 5000)) {
      triggerConfetti();
      showToast(`🎉 "${updated.title}" completed!`, 'success');
      setTimeout(() => switchTab('completed'), 1200);
    } else {
      showToast(`Logged ${isTime ? formatSeconds(value) : value + ' ' + unit}!`, 'success');
    }
  });
}

function calcFromToSeconds() {
  const fromVal = document.getElementById('log-from-time').value;
  const toVal   = document.getElementById('log-to-time').value;
  if (!fromVal || !toVal) return 0;
  const toSecs = t => { const p = t.split(':').map(Number); return p[0]*3600 + p[1]*60 + (p[2]||0); };
  let diff = toSecs(toVal) - toSecs(fromVal);
  if (diff < 0) diff += 86400; // midnight crossing
  return diff;
}

function updateFromToPreview() {
  const secs = calcFromToSeconds();
  const el = document.getElementById('log-fromto-preview');
  if (el) el.textContent = secs > 0 ? `≈ ${formatSeconds(secs)} will be logged` : '';
}



// ── Daily Focus Banner (sticky, non-dismissable) ──────────────

export function renderDailyWidget() {
  const container = document.getElementById('daily-widget');
  if (!container) return;

  const goals = getGoals().filter(g => !g.isCompleted);
  const withTarget = goals.filter(g => g.dailyTarget > 0);

  // Hide banner entirely if no goals have daily targets set
  if (!withTarget.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const pending = withTarget.filter(g => getTodayLogged(g) < g.dailyTarget);
  const allDone = pending.length === 0;

  if (allDone) {
    // ✅ Collapsed "all done" success state
    container.innerHTML = `
      <div class="db-done">
        <span class="db-done-icon">🎉</span>
        <div>
          <div class="db-done-title">All daily targets hit!</div>
          <div class="db-done-sub">${today}</div>
        </div>
      </div>`;
    return;
  }

  // Build pending goal rows
  let rows = '';
  withTarget.forEach(goal => {
    const logged    = getTodayLogged(goal);
    const remaining = Math.max(0, goal.dailyTarget - logged);
    const pct       = Math.min(100, Math.round((logged / goal.dailyTarget) * 100));
    const remStr    = formatValue(remaining, goal.unit);
    const loggedStr = formatValue(logged, goal.unit);
    const targStr   = formatValue(goal.dailyTarget, goal.unit);
    const done      = pct >= 100;

    rows += `
      <div class="db-row ${done ? 'db-row-done' : ''}">
        <div class="db-row-accent" style="background:${goal.color}"></div>
        <div class="db-row-body">
          <div class="db-row-top">
            <span class="db-goal-name">${escHtml(goal.title)}</span>
            <span class="db-goal-stat" style="color:${goal.color}">${done ? '✓ Done' : remStr + ' left'}</span>
          </div>
          <div class="db-bar"><div class="db-bar-fill" style="width:${pct}%;background:${goal.color}"></div></div>
          <div class="db-row-sub">${loggedStr} / ${targStr}</div>
        </div>
        ${!done ? `<button class="db-log-btn" data-log="${goal.id}" style="color:${goal.color}" title="Log progress">+</button>` : ''}
      </div>`;
  });

  const pendingCount = pending.length;
  const totalCount   = withTarget.length;

  container.innerHTML = `
    <div class="db-header">
      <div class="db-header-left">
        <span class="db-icon">📋</span>
        <div>
          <div class="db-title">Today's Focus</div>
          <div class="db-subtitle">${pendingCount} of ${totalCount} task${totalCount > 1 ? 's' : ''} remaining · ${today}</div>
        </div>
      </div>
    </div>
    <div class="db-rows">${rows}</div>`;

  // Wire quick-log buttons
  container.querySelectorAll('.db-log-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openLogModal(btn.dataset.log);
    });
  });
}


// ── Detail Modal ──────────────────────────────────────────────
export function openDetailModal(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;

  const stats = getStats(goal);
  const isTime = goal.isTime;

  document.getElementById('detail-color-dot').style.backgroundColor = goal.color;
  document.getElementById('detail-title').textContent = goal.title;
  document.getElementById('detail-completed').textContent = formatValue(goal.completed, goal.unit);
  document.getElementById('detail-target').textContent = formatValue(goal.target, goal.unit);
  document.getElementById('detail-remaining').textContent = formatValue(stats.remaining, goal.unit);
  document.getElementById('detail-pct').textContent = stats.percent + '%';
  document.getElementById('detail-streak').textContent = stats.streak + ' days';
  document.getElementById('detail-avg').textContent = isTime
    ? formatSeconds(Math.round(stats.avgDaily))
    : Math.round(stats.avgDaily) + ' ' + goal.unit + '/day';
  document.getElementById('detail-days-left').textContent = stats.daysLeft
    ? stats.daysLeft + ' days'
    : stats.remaining === 0 ? 'Done!' : 'N/A';

  // Progress bar
  const bar = document.getElementById('detail-progress-fill');
  bar.style.width = '0%';
  bar.style.backgroundColor = goal.color;
  setTimeout(() => { bar.style.width = stats.percent + '%'; }, 50);

  // Charts — initial render with current state
  chartState.detail.goalId = goalId;
  const detailUnitRow = document.getElementById('detail-unit-row');
  if (detailUnitRow) {
    detailUnitRow.style.display = isTime ? 'flex' : 'none';
    syncUnitPills('detail-unit-row', chartState.detail.timeDisplay);
  }
  syncRangePills('detail-range-row', chartState.detail.range);

  function redrawDetailCharts() {
    const r   = chartState.detail.range;
    const view = chartState.detail.view || 'daily';
    const td  = isTime ? chartState.detail.timeDisplay : null;
    const unitLabel = isTime ? getTimeUnitLabel(td) : goal.unit;

    if (view === 'cumulative') {
      const actual   = getCumulativeData(goal, r);
      const expected = getExpectedCumulative(goal, r);
      renderCumulativeChart('chart-detail-daily', actual, expected, goal.color, unitLabel, td);
      // hide weekly bar in cumulative mode (not meaningful)
      const wrapWeekly = document.getElementById('chart-detail-weekly').parentElement;
      if (wrapWeekly) wrapWeekly.style.opacity = '0.3';
    } else {
      const daily  = getDailyData(goal.history, r);
      const weekly = getWeeklyData(goal.history, r === 'all' ? 52 : Math.ceil((r === 7 ? 7 : r) / 7));
      renderDailyLineChart('chart-detail-daily',  daily,  goal.color, unitLabel, td);
      renderWeeklyBarChart('chart-detail-weekly', weekly, goal.color, unitLabel, td);
      const wrapWeekly = document.getElementById('chart-detail-weekly').parentElement;
      if (wrapWeekly) wrapWeekly.style.opacity = '1';
    }

    // Sync view toggle buttons
    document.querySelectorAll('[data-view][data-ctx="detail"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
  }

  setTimeout(redrawDetailCharts, 150);

  // Store redraw fn so range/unit pills can call it
  chartState.detail._redraw = redrawDetailCharts;

  // Action buttons
  document.getElementById('detail-btn-log').onclick = () => {
    closeModal('modal-detail');
    setTimeout(() => openLogModal(goalId), 200);
  };
  document.getElementById('detail-btn-edit').onclick = () => {
    closeModal('modal-detail');
    setTimeout(() => openEditModal(goalId), 200);
  };
  document.getElementById('detail-btn-reset').onclick = () => {
    closeModal('modal-detail');
    showConfirm({
      icon: '🔄', title: 'Reset Progress',
      msg: `Reset all progress for "${goal.title}"? History will be cleared.`,
      confirmText: 'Reset',
      onConfirm: () => {
        resetGoalProgress(goalId);
        renderActiveGoals();
        renderCompletedGoals();
        showToast('Progress reset', 'info');
      }
    });
  };
  document.getElementById('detail-btn-delete').onclick = () => {
    closeModal('modal-detail');
    showConfirm({
      icon: '🗑️', title: 'Delete Goal',
      msg: `Permanently delete "${goal.title}"? This cannot be undone.`,
      confirmText: 'Delete',
      onConfirm: () => {
        deleteGoal(goalId);
        renderActiveGoals();
        renderCompletedGoals();
        showToast('Goal deleted', 'info');
      }
    });
  };

  openModal('modal-detail');
}

// ── Settings Modal ────────────────────────────────────────────
export function openSettings() {
  openModal('modal-settings');
}

export function initSettings() {
  document.getElementById('settings-export-btn').addEventListener('click', () => {
    exportBackup();
    showToast('Backup exported!', 'success');
  });

  document.getElementById('settings-import-btn').addEventListener('click', () => {
    document.getElementById('settings-import-file').click();
  });

  document.getElementById('settings-import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const count = await importBackup(file);
      showToast(`Imported ${count} goals!`, 'success');
      renderActiveGoals();
      renderCompletedGoals();
      renderAnalytics();
      closeModal('modal-settings');
    } catch (err) {
      showToast(err.message, 'error');
    }
    e.target.value = '';
  });
}

// ── Modal open/close ──────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

export function initModals() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
  // Confirm cancel
  document.getElementById('btn-cancel-confirm').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.remove('open');
  });
}

// ── Tab Switch ────────────────────────────────────────────────
export function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'analytics') renderAnalytics();
  if (tab === 'completed') renderCompletedGoals();
}

// ── Chart Control Initialization ─────────────────────────────
export function initChartControls() {
  // Range pills — event delegation on document
  document.addEventListener('click', e => {
    const pill = e.target.closest('.range-pill');
    if (!pill) return;
    const ctx   = pill.dataset.ctx;   // 'global' | 'pergoal' | 'detail'
    const range = pill.dataset.range === 'all' ? 'all' : parseInt(pill.dataset.range);

    if (ctx === 'global') {
      chartState.global.range = range;
      syncRangePills('global-range-row', range);
      const analytics = getGlobalAnalytics(range);
      renderGlobalLineChart('chart-global-daily', analytics.dailyTotals);
    }

    if (ctx === 'pergoal') {
      chartState.pergoal.range = range;
      syncRangePills('per-goal-range-row', range);
      const goals = getGoals();
      const goal = chartState.pergoal.goalId
        ? goals.find(g => g.id === chartState.pergoal.goalId)
        : goals[0];
      if (goal) renderPerGoalCharts(goal, range, chartState.pergoal.timeDisplay);
    }

    if (ctx === 'detail') {
      chartState.detail.range = range;
      syncRangePills('detail-range-row', range);
      if (chartState.detail._redraw) chartState.detail._redraw();
    }
  });

  // Unit toggle pills
  document.addEventListener('click', e => {
    const pill = e.target.closest('.unit-pill');
    if (!pill) return;
    const ctx  = pill.dataset.ctx;
    const unit = pill.dataset.unit;  // 'sec' | 'min' | 'hr'

    if (ctx === 'pergoal') {
      chartState.pergoal.timeDisplay = unit;
      syncUnitPills('per-goal-unit-row', unit);
      const goals = getGoals();
      const goal = chartState.pergoal.goalId
        ? goals.find(g => g.id === chartState.pergoal.goalId)
        : goals[0];
      if (goal) renderPerGoalCharts(goal, chartState.pergoal.range, unit);
    }

    if (ctx === 'detail') {
      chartState.detail.timeDisplay = unit;
      syncUnitPills('detail-unit-row', unit);
      if (chartState.detail._redraw) chartState.detail._redraw();
    }
  });

  // Chart view toggle (Daily | Cumulative)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-view][data-ctx]');
    if (!btn) return;
    const ctx  = btn.dataset.ctx;
    const view = btn.dataset.view;
    if (ctx === 'detail') {
      chartState.detail.view = view;
      if (chartState.detail._redraw) chartState.detail._redraw();
    }
  });
}

// ── Pill sync helpers ─────────────────────────────────────────
function syncRangePills(rowId, activeRange) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.querySelectorAll('.range-pill').forEach(p => {
    const v = p.dataset.range === 'all' ? 'all' : parseInt(p.dataset.range);
    p.classList.toggle('active', v === activeRange);
    p.setAttribute('aria-pressed', v === activeRange ? 'true' : 'false');
  });
}

function syncUnitPills(rowId, activeUnit) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.querySelectorAll('.unit-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.unit === activeUnit);
  });
}

// ── Confetti ──────────────────────────────────────────────────
export function triggerConfetti() {
  const colors = ['#7c3aed','#10b981','#f59e0b','#ec4899','#0ea5e9'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const tx = (Math.random() - 0.5) * window.innerWidth;
    const ty = -(Math.random() * 500 + 200);
    const r = Math.random() * 720 - 360;
    piece.style.cssText = `
      left:${Math.random() * 100}vw;
      top:${Math.random() * 40 + 30}%;
      background:${colors[i % colors.length]};
      --tx:${tx}px;--ty:${ty}px;--r:${r}deg;
      animation-duration:${0.6 + Math.random() * 0.6}s;
      animation-delay:${Math.random() * 0.3}s;
      width:${6 + Math.random() * 6}px;
      height:${6 + Math.random() * 6}px;
    `;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1500);
  }
}

// ── Utility ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
