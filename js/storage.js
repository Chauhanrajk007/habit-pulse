/**
 * storage.js — localStorage persistence layer
 * Schema version: 1
 */

const STORAGE_KEY = 'habitpulse_goals_v1';
const SETTINGS_KEY = 'habitpulse_settings_v1';

// ── Goal CRUD ─────────────────────────────────────────────────

export function getGoals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveGoals(goals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

export function getGoalById(id) {
  return getGoals().find(g => g.id === id) || null;
}

export function upsertGoal(goal) {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goal.id);
  if (idx === -1) {
    goals.unshift(goal);
  } else {
    goals[idx] = goal;
  }
  saveGoals(goals);
}

export function deleteGoal(id) {
  const goals = getGoals().filter(g => g.id !== id);
  saveGoals(goals);
}

// ── Settings ──────────────────────────────────────────────────

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { theme: 'dark', notifications: false };
  } catch {
    return { theme: 'dark', notifications: false };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── Backup / Restore ──────────────────────────────────────────

export function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    goals: getGoals(),
    settings: getSettings(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habitpulse-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!payload.goals || !Array.isArray(payload.goals)) {
          reject(new Error('Invalid backup file'));
          return;
        }
        saveGoals(payload.goals);
        if (payload.settings) saveSettings(payload.settings);
        resolve(payload.goals.length);
      } catch {
        reject(new Error('Failed to parse backup file'));
      }
    };
    reader.readAsText(file);
  });
}

// ── ID Generation ─────────────────────────────────────────────

export function generateId() {
  return `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
