/**
 * logic.js — Pure business logic, no DOM
 */

import { generateId, getGoals, upsertGoal, getUndoState, saveUndoState } from './storage.js';

// ── Goal Palette ──────────────────────────────────────────────
const PALETTE = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316'];

export function pickColor(goals) {
  const used = goals.map(g => g.color);
  return PALETTE.find(c => !used.includes(c)) || PALETTE[goals.length % PALETTE.length];
}

export const TIME_UNIT = 'hours';

// ── Time-unit display helpers ─────────────────────────────────
// timeDisplay: 'sec' | 'min' | 'hr'
export function convertTimeValue(seconds, timeDisplay) {
  if (timeDisplay === 'min') return seconds / 60;
  if (timeDisplay === 'hr')  return seconds / 3600;
  return seconds; // 'sec'
}

export function getTimeUnitLabel(timeDisplay) {
  if (timeDisplay === 'min') return 'min';
  if (timeDisplay === 'hr')  return 'hr';
  return 'sec';
}

export function formatTimeDisplayValue(seconds, timeDisplay) {
  const v = convertTimeValue(seconds, timeDisplay);
  const label = getTimeUnitLabel(timeDisplay);
  return `${parseFloat(v.toFixed(2))} ${label}`;
}
export function isTimeUnit(unit) { return unit === TIME_UNIT; }

export function parseTimeToSeconds(h = 0, m = 0, s = 0) {
  return (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
}

export function formatSeconds(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatValue(value, unit) {
  if (isTimeUnit(unit)) return formatSeconds(value);
  return `${Number(value).toLocaleString()} ${unit}`;
}

export function createGoal({ title, unit, target, startingProgress, color, dailyTarget, type }) {
  const goals = getGoals();
  const isHabit = type === 'habit';
  const goal = {
    id: generateId(),
    title: title.trim(),
    unit,
    type: isHabit ? 'habit' : 'goal',
    isTime: isTimeUnit(unit),
    target: isHabit ? Infinity : Number(target),
    startingProgress: Number(startingProgress) || 0,
    completed: Number(startingProgress) || 0,
    lastPosition: Number(startingProgress) || 0, // tracks where user is in content
    history: [],
    createdAt: new Date().toISOString(),
    isCompleted: false,
    color: color || pickColor(goals),
    dailyTarget: dailyTarget || null,
  };
  if (!isHabit && goal.completed >= goal.target) goal.isCompleted = true;
  upsertGoal(goal);
  return goal;
}

// ── Undo / Rollback System ────────────────────────────────────

export function clearUndo() { saveUndoState(null); }

export function getLastUndoInfo() {
  const state = getUndoState();
  if (!state) return null;
  // Expire undo after 30 seconds
  if (Date.now() - state.timestamp > 30000) {
    saveUndoState(null);
    return null;
  }
  return {
    goalId: state.goalId,
    goalTitle: state.goalTitle,
    value: state.value,
    unit: state.unit,
  };
}

export function undoLastLog() {
  const state = getUndoState();
  if (!state) return null;
  const info = state;
  saveUndoState(null); // consume the undo

  const goals = getGoals();
  const goal = goals.find(g => g.id === info.goalId);
  if (!goal) return null;

  // Restore from snapshot
  goal.completed = info.prevCompleted;
  goal.lastPosition = info.prevLastPosition;
  goal.isCompleted = info.prevIsCompleted;
  if (info.prevIsCompleted === false) {
    delete goal.completedAt;
  }

  // Restore history entry
  const historyEntry = goal.history.find(h => h.date === info.date);
  if (historyEntry) {
    historyEntry.value -= info.value;
    if (historyEntry.value <= 0) {
      goal.history = goal.history.filter(h => h.date !== info.date);
    }
  }

  upsertGoal(goal);
  return goal;
}

// Pass rawValue for duration logging, or { position } for position-based logging
export function logProgress(goalId, rawValue, opts = {}) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return null;

  // Save pre-log snapshot for undo
  const prevCompleted = goal.completed;
  const prevLastPosition = goal.lastPosition;
  const prevIsCompleted = goal.isCompleted;

  let value;
  if (opts.position !== undefined) {
    // Position-based: log the delta from lastPosition
    const from = goal.lastPosition || goal.startingProgress || 0;
    value = Number(opts.position) - from;
    if (value <= 0) return { ...goal, _positionError: true };
    goal.lastPosition = Number(opts.position);
  } else {
    value = Number(rawValue);
    if (!value || isNaN(value)) return null;
    goal.lastPosition = (goal.lastPosition || goal.startingProgress || 0) + value;
  }

  const today = todayStr();
  const existing = goal.history.find(h => h.date === today);
  if (existing) existing.value += value;
  else goal.history.push({ date: today, value });
  goal.completed += value;
  // Habits never auto-complete (no fixed target)
  if (goal.type !== 'habit' && !goal.isCompleted && goal.completed >= goal.target) {
    goal.isCompleted = true;
    goal.completedAt = new Date().toISOString();
  }
  upsertGoal(goal);

  // Store undo info
  saveUndoState({
    goalId: goal.id,
    goalTitle: goal.title,
    value,
    unit: goal.unit,
    date: today,
    prevCompleted,
    prevLastPosition,
    prevIsCompleted,
    timestamp: Date.now(),
  });

  return goal;
}

export function getStats(goal) {
  const percent = goal.target === Infinity
    ? 0
    : Math.min(100, Math.round((goal.completed / goal.target) * 100));
  const remaining = goal.target === Infinity
    ? 0
    : Math.max(0, goal.target - goal.completed);
  const streak = computeStreak(goal.history);
  // FIXED: pass createdAt so avg uses total calendar days, not just logged days
  const avgDaily = computeAvgDaily(goal.history, goal.createdAt);
  const daysLeft = avgDaily > 0 && goal.target !== Infinity
    ? Math.ceil(remaining / avgDaily)
    : null;
  return { percent, remaining, streak, avgDaily, daysLeft };
}

export function computeStreak(history) {
  if (!history.length) return 0;
  const dates = history.filter(h => h.value > 0).map(h => h.date).sort().reverse();
  if (!dates.length) return 0;
  let streak = 0;
  const today = todayStr();
  let cursor = dates[0] === today ? today : shiftDate(today, -1);
  for (const date of dates) {
    if (date === cursor) { streak++; cursor = shiftDate(cursor, -1); }
    else if (date < cursor) break;
  }
  return streak;
}

/**
 * FIXED: Compute average daily progress using TOTAL calendar days since
 * goal creation, not just the count of days with logs.
 *
 * This ensures predictions are realistic. If someone created a goal 10 days
 * ago but only logged on 2 of those days, the average reflects the actual
 * pace (total / 10) rather than the inflated (total / 2).
 *
 * Works retroactively for all existing goals since createdAt is already stored.
 */
export function computeAvgDaily(history, createdAt) {
  if (!history.length) return 0;
  const total = history.reduce((s, h) => s + h.value, 0);
  if (total <= 0) return 0;
  const totalDays = daysBetween(createdAt, todayStr());
  if (totalDays <= 0) return total; // created today — return total as avg
  return total / totalDays;
}

/**
 * Calculate the number of days between two date strings (YYYY-MM-DD or ISO).
 * Returns at least 1 if the dates are the same day.
 */
export function daysBetween(dateStrA, dateStrB) {
  if (!dateStrA) return 1;
  const a = new Date(typeof dateStrA === 'string' ? dateStrA.slice(0, 10) + 'T00:00:00' : dateStrA);
  const b = new Date(typeof dateStrB === 'string' ? dateStrB.slice(0, 10) + 'T00:00:00' : dateStrB);
  const diffMs = Math.abs(b - a);
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days); // at minimum 1 day
}

export function getGlobalAnalytics(days = 30) {
  const goals = getGoals();
  let dates;
  if (days === 'all') {
    dates = getAllDateRange(goals);
  } else {
    dates = pastDays(days);
  }

  // Only goals with a dailyTarget contribute to the combined chart
  const targetedGoals = goals.filter(g => g.dailyTarget > 0);

  const dailyTotals = dates.map(d => {
    if (!targetedGoals.length) return { date: d, value: 0 };
    // For each day: average completion % across all targeted goals
    const pct = targetedGoals.reduce((sum, goal) => {
      const entry = goal.history.find(h => h.date === d);
      const logged = entry ? entry.value : 0;
      return sum + Math.min(100, (logged / goal.dailyTarget) * 100);
    }, 0) / targetedGoals.length;
    return { date: d, value: Math.round(pct) };
  });

const validGoals = goals.filter(g => g.target > 0 && g.target !== Infinity);
  const overallPercent = validGoals.length > 0 
    ? Math.round(validGoals.reduce((sum, g) => sum + Math.min(100, (g.completed / g.target) * 100), 0) / validGoals.length)
    : 0;
  const bestStreak = goals.reduce((max, g) => Math.max(max, computeStreak(g.history)), 0);
  const today = todayStr();
  const todayTotal = goals.reduce((s, g) => {
    const h = g.history.find(h => h.date === today);
    return s + (h ? h.value : 0);
  }, 0);

  return {
    totalGoals: goals.length,
    activeCount: goals.filter(g => !g.isCompleted).length,
    completedCount: goals.filter(g => g.isCompleted).length,
    overallPercent, bestStreak, todayTotal,
    dailyTotals,
    hasTargetedGoals: targetedGoals.length > 0,
  };
}


export function getWeeklyData(history, weeks = 8) {
  const result = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = shiftDate(startOfWeek(new Date()), -w * 7);
    let total = 0;
    for (let d = 0; d < 7; d++) {
      const entry = history.find(h => h.date === shiftDate(start, d));
      if (entry) total += entry.value;
    }
    result.push({ label: `W${weeks - w}`, value: total });
  }
  return result;
}

/** days = number | 'all' */
export function getDailyData(history, days = 30) {
  if (days === 'all') return getAllDailyData(history);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = shiftDate(todayStr(), -i);
    const entry = history.find(h => h.date === d);
    result.push({ date: d, value: entry ? entry.value : 0 });
  }
  return result;
}

/** Returns daily data spanning all history entries, filled to today */
export function getAllDailyData(history) {
  if (!history.length) return getDailyData([], 30);
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sorted[0].date;
  const dates = [];
  let cur = earliest;
  const end = todayStr();
  while (cur <= end) { dates.push(cur); cur = shiftDate(cur, 1); }
  return dates.map(d => {
    const entry = history.find(h => h.date === d);
    return { date: d, value: entry ? entry.value : 0 };
  });
}

/** Build a date range from earliest goal creation to today */
function getAllDateRange(goals) {
  const allDates = goals.flatMap(g => g.history.map(h => h.date));
  if (!allDates.length) return pastDays(30);
  const earliest = allDates.sort()[0];
  const dates = [];
  let cur = earliest;
  const end = todayStr();
  while (cur <= end) { dates.push(cur); cur = shiftDate(cur, 1); }
  return dates;
}

export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function shiftDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function pastDays(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i--) result.push(shiftDate(todayStr(), -i));
  return result;
}

export function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

export function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function resetGoalProgress(goalId) {
  const goals = getGoals();
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  goal.completed = goal.startingProgress || 0;
  goal.history = [];
  goal.isCompleted = false;
  delete goal.completedAt;
  upsertGoal(goal);
  return goal;
}

// ── Habit Deficit / Surplus ───────────────────────────────────
// Calculates running cumulative behind/ahead vs dailyTarget.
// Per day: deficit += (dailyTarget - logged). Positive = behind.
// Example: target 5/day, days [4, 6, 4] → deficit = 1+(-1)+1 = 1 behind
export function getHabitDeficit(goal) {
  if (!goal.dailyTarget || goal.dailyTarget <= 0) return null;
  const createdDate = (goal.createdAt || new Date().toISOString()).slice(0, 10);
  const today = todayStr();
  let deficit = 0;
  let cur = createdDate;
  while (cur <= today) {
    const entry = goal.history.find(h => h.date === cur);
    const logged = entry ? entry.value : 0;
    deficit += (goal.dailyTarget - logged); // positive = behind that day
    cur = shiftDate(cur, 1);
  }
  return {
    raw: deficit,           // positive = behind, negative = ahead
    isAhead: deficit <= 0,
    isOnTrack: deficit === 0,
    value: Math.abs(deficit),
  };
}


// ── Daily Target helpers ──────────────────────────────────────

/** How much has been logged today (in base units) */
export function getTodayLogged(goal) {
  const today = todayStr();
  const entry = goal.history.find(h => h.date === today);
  return entry ? entry.value : 0;
}

/** Cumulative actual progress data, starting from the total progress before the window */
export function getCumulativeData(goal, days = 30) {
  const daily = getDailyData(goal.history, days);
  if (!daily.length) return [];

  // Calculate the starting value (cumulative sum before the first day of the window)
  const firstDate = daily[0].date;
  const sumBefore = goal.history
    .filter(h => h.date < firstDate)
    .reduce((sum, h) => sum + h.value, 0);
  const startVal = (goal.startingProgress || 0) + sumBefore;

  // Prepend Day 0 baseline so actual and expected start from the same point
  const dayBefore = shiftDate(firstDate, -1);
  const result = [{ date: dayBefore, value: startVal }];

  let running = startVal;
  daily.forEach(d => {
    running += d.value;
    result.push({ date: d.date, value: running });
  });

  return result;
}

/** Expected cumulative line starting from the same value at the beginning of the window */
export function getExpectedCumulative(goal, days = 30) {
  if (!goal.dailyTarget || goal.dailyTarget <= 0) return null;
  const daily = getDailyData(goal.history, days);
  if (!daily.length) return [];

  // Calculate the starting value (cumulative sum before the first day of the window)
  const firstDate = daily[0].date;
  const sumBefore = goal.history
    .filter(h => h.date < firstDate)
    .reduce((sum, h) => sum + h.value, 0);
  const startVal = (goal.startingProgress || 0) + sumBefore;

  // Prepend Day 0 baseline so actual and expected start from the same point
  const dayBefore = shiftDate(firstDate, -1);
  const result = [{ date: dayBefore, value: startVal }];

  let expected = startVal;
  daily.forEach(d => {
    expected += goal.dailyTarget;
    const val = goal.target !== Infinity ? Math.min(expected, goal.target) : expected;
    result.push({ date: d.date, value: val });
  });

  return result;
}
