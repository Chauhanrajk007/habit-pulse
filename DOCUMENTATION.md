# HabitPulse — Documentation

> **Version 2.0** · PWA Goal & Habit Tracker with Rollback, Smart Predictions & Analytics

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Features Guide](#4-features-guide)
5. [How Calculations Work](#5-how-calculations-work)
6. [UI/UX Design System](#6-uiux-design-system)
7. [PWA Support](#7-pwa-support)
8. [Data Management](#8-data-management)
9. [Developer Guide](#9-developer-guide)

---

## 1. Overview

### What is HabitPulse?

HabitPulse is a **Progressive Web App (PWA)** for tracking customizable goals and habits. It runs entirely in the browser with no backend — all data is stored in `localStorage`.

### Key Features

- **Goals** — Fixed-target tracking (e.g., "Read 400 pages")
- **Habits** — Ongoing daily tracking with no end date (e.g., "Study daily")
- **Flexible Units** — Hours (h:m:s), videos, pages, problems, or custom units
- **Two Logging Modes** — "How much" (amount) or "Till where" (position-based auto-calc)
- **Undo / Rollback** — Single-entry undo via toast or detail modal
- **Daily Focus Banner** — Shows today's remaining tasks at a glance
- **Streak Tracking** — Consecutive day counting
- **Smart Predictions** — Estimated days to finish based on actual pace
- **Deficit/Surplus** — How far ahead or behind on daily targets
- **Analytics Dashboard** — Global stats, per-goal charts, donut chart
- **Charts** — Daily line, weekly bar, cumulative vs expected, time-unit toggle
- **Export/Import** — JSON backup and restore
- **Offline Support** — Service worker caches all assets
- **Install as App** — PWA install prompt

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (single `index.html`) |
| Logic | Vanilla JavaScript (ES modules) |
| Styling | Vanilla CSS (4 files, custom properties) |
| Charts | Chart.js v4 (CDN) |
| Storage | `localStorage` |
| PWA | Service Worker + Web App Manifest |
| Fonts | Google Fonts (Inter + Outfit) |

---

## 2. Architecture

### File Structure

```
habit-pulse-main/
├── index.html              # Single-page app shell, all HTML
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (network-first)
├── DOCUMENTATION.md        # This file
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── css/
│   ├── design-system.css   # Variables, reset, utilities, ambient bg
│   ├── components.css      # Cards, buttons, modals, forms, toasts
│   ├── animations.css      # Keyframes, transitions, confetti
│   └── pages.css           # Page layouts, header, analytics, settings
└── js/
    ├── app.js              # Bootstrap, routing, event wiring
    ├── logic.js            # Pure business logic (no DOM)
    ├── storage.js          # localStorage CRUD layer
    ├── ui.js               # All DOM rendering and event binding
    └── charts.js           # Chart.js wrapper functions
```

### Module Responsibilities

| Module | Role |
|--------|------|
| **app.js** | Entry point. Initializes modals, forms, navigation, service worker, install prompt. |
| **logic.js** | Pure functions: create goals, log progress, compute stats/streaks/predictions, undo system. No DOM access. |
| **storage.js** | `localStorage` persistence: get/save/delete goals, settings, export/import backup, ID generation. |
| **ui.js** | All DOM rendering: goal cards, modals, daily widget, analytics, toasts, confetti. Imports from logic + storage + charts. |
| **charts.js** | Chart.js wrappers: daily line, weekly bar, global line, donut, cumulative. Handles chart lifecycle (create/destroy). |

### Data Flow

```
User Action → ui.js (DOM event)
  → logic.js (compute/validate)
    → storage.js (persist to localStorage)
  → ui.js (re-render DOM)
  → charts.js (re-render charts)
```

---

## 3. Data Model

### Goal Object Schema

```javascript
{
  id: "goal_1718000000000_abc123",  // Unique ID (timestamp + random)
  title: "DSA Course",              // Display name (max 60 chars)
  unit: "videos",                   // Unit type: "hours"|"videos"|"pages"|"problems"|custom string
  type: "goal",                     // "goal" (fixed target) or "habit" (no end)
  isTime: false,                    // true if unit === "hours"
  target: 400,                      // Total target (Infinity for habits)
  startingProgress: 50,             // Already completed before tracking
  completed: 125,                   // Current cumulative progress
  lastPosition: 125,                // Position tracking for "Till where" mode
  history: [                        // Daily log entries
    { date: "2025-06-01", value: 10 },
    { date: "2025-06-02", value: 15 },
  ],
  createdAt: "2025-06-01T10:00:00.000Z",  // ISO timestamp
  isCompleted: false,               // Auto-set when completed >= target
  completedAt: null,                // ISO timestamp when completed
  color: "#7c3aed",                 // Accent color from palette
  dailyTarget: 5,                   // Optional daily target (null if not set)
}
```

### History Entry Format

```javascript
{ date: "YYYY-MM-DD", value: <number> }
```

- `date` — ISO date string (local date)
- `value` — Amount logged that day (in base units: raw count or seconds for time)
- Multiple logs on the same day are **summed** into one entry

### localStorage Keys

| Key | Content |
|-----|---------|
| `habitpulse_goals_v1` | Array of goal objects (JSON) |
| `habitpulse_settings_v1` | Settings object (JSON) |

### Settings Object

```javascript
{
  theme: "dark",           // Currently only dark mode
  notifications: false     // Reserved for future use
}
```

---

## 4. Features Guide

### 4.1 Goals vs Habits

**Goals** have a fixed target and auto-complete when reached:
- Progress ring shows percentage
- "Remaining" count shown
- Confetti celebration on completion

**Habits** track indefinitely with no end date:
- No progress ring — shows icon circle instead
- Deficit/surplus tracking against daily target
- Shows "X logged total" instead of remaining

### 4.2 Logging Progress

Two modes available via segmented toggle:

**"How much" mode** (default):
- Enter the amount done today (e.g., "5 videos")
- Added to today's history entry

**"Till where" mode**:
- Enter your current position (e.g., "video 125")
- App auto-calculates delta from `lastPosition`
- Prevents logging if position <= last known position
- Live preview shows the calculated amount

### 4.3 Undo / Rollback

**Single-entry undo system** — roll back the most recent log:

- After every successful log, an **"Undo" toast** appears for 8 seconds
- Clicking "Undo" reverses: `completed`, `lastPosition`, `history`, `isCompleted`
- Also available via ↩️ button in the goal detail modal
- Undo expires after 30 seconds or when another log is made
- State is stored in memory (module-level variable), not persisted across page refreshes

**What gets rolled back:**
- `goal.completed` restored to pre-log value
- `goal.lastPosition` restored
- `goal.isCompleted` restored (un-completes if needed)
- Today's history entry reduced or removed

### 4.4 Daily Focus Banner

Appears on the Active tab when any goal has a `dailyTarget` set:

- Shows each goal's daily progress bar
- Quick-log (+) buttons per goal
- Collapses to "🎉 All daily targets hit!" when all done
- Automatically hides if no goals have daily targets

### 4.5 Analytics

**Global Analytics:**
- Overall completion % (average across all finite goals)
- Total/Active/Completed counts
- Best streak across all goals
- Daily target completion % chart (% of daily targets hit)
- 7-day moving average trendline
- Active vs Completed donut chart

**Per-Goal Analytics:**
- Goal selector chip row
- Daily progress line chart
- Weekly consistency bar chart
- Time-range filters: 7D, 1M, 3M, 6M, 1Y, All
- Time-unit toggle for time goals: Sec/Min/Hr

**Detail Modal Charts:**
- Daily view or Cumulative view toggle
- Cumulative shows actual progress vs expected pace line
- Range and unit controls

---

## 5. How Calculations Work

### 5.1 Average Per Day

```
avgDaily = totalLogged / calendarDaysSinceCreation
```

**Why total calendar days?**
Previous versions divided by only days with logs, which inflated the average. Example:
- Goal created 10 days ago, logged on 2 days: 10 + 10 = 20 total
- **Old**: 20 / 2 = **10/day** (misleading)
- **New**: 20 / 10 = **2/day** (accurate)

This uses the `createdAt` timestamp stored on each goal, so it works correctly for all existing data — even entries logged before the v2 update.

### 5.2 Streak

Counts consecutive days with `value > 0`, working backwards from today:

```
1. Get all dates with positive values, sorted descending
2. Start cursor at today (if logged today) or yesterday
3. Walk backwards: if date matches cursor, increment streak and move cursor back 1 day
4. Break on first gap
```

### 5.3 Estimated Days to Finish

```
daysLeft = remaining / avgDaily
```

Returns `null` if `avgDaily` is 0 or goal is a habit (infinite target).

### 5.4 Habit Deficit/Surplus

Accumulates daily deficit from goal creation to today:

```
For each day from createdAt to today:
  deficit += (dailyTarget - loggedThatDay)
```

- `deficit > 0` → behind schedule
- `deficit < 0` → ahead of schedule  
- `deficit = 0` → perfectly on track

### 5.5 Daily Target Completion %

**Per goal:** `min(100, (todayLogged / dailyTarget) * 100)`

**Global chart:** Average of per-goal percentages across all goals with daily targets.

---

## 6. UI/UX Design System

### Color Palette

| Variable | Hex | Usage |
|----------|-----|-------|
| `--bg-base` | `#07070F` | Page background |
| `--bg-surface` | `#0E0E1A` | Modal background |
| `--bg-card` | `rgba(19,19,31,0.75)` | Card background (with blur) |
| `--bg-elevated` | `#1A1A2A` | Input backgrounds |
| `--purple-600` | `#7c3aed` | Primary brand color |
| `--indigo-500` | `#6366f1` | Secondary brand |
| `--success` | `#10b981` | Completed, on-track |
| `--warning` | `#f59e0b` | Streak badge |
| `--danger` | `#ef4444` | Delete, behind, errors |

### Goal Color Palette (auto-assigned)

`#7c3aed` → `#0ea5e9` → `#10b981` → `#f59e0b` → `#ef4444` → `#ec4899` → `#14b8a6` → `#f97316`

### Typography

| Font | Weight | Usage |
|------|--------|-------|
| **Outfit** | 700–900 | Headlines, stats, logo |
| **Inter** | 300–700 | Body text, labels, UI |

### Key Components

- **Glass Cards** — `backdrop-filter: blur(16px)` with gradient border shimmer
- **Progress Ring** — SVG circle with animated stroke-dashoffset and glow
- **Bottom Nav** — Frosted glass with animated top indicator pill
- **Modals** — Bottom sheet with spring animation, drag handle
- **Toasts** — Glassmorphism with left accent border, optional undo button
- **Ambient Mesh** — Subtle animated gradient blobs behind content

---

## 7. PWA Support

### Service Worker Strategy

- **App files** (HTML, CSS, JS): **Network-first** — always tries to fetch latest version, falls back to cache offline
- **CDN assets** (Chart.js, fonts): **Cache-first** — serves from cache, fetches on miss

This ensures updates are picked up immediately while maintaining offline support.

### Manifest Configuration

```json
{
  "name": "HabitPulse",
  "display": "standalone",
  "background_color": "#07070F",
  "theme_color": "#7c3aed",
  "orientation": "portrait"
}
```

### Install Prompt

A banner appears when the browser fires `beforeinstallprompt`, allowing users to install the PWA to their home screen.

---

## 8. Data Management

### Export/Import

- **Export**: Downloads a JSON file containing all goals and settings
- **Import**: Reads a JSON file, validates structure, replaces all data
- Backup filename format: `habitpulse-backup-YYYY-MM-DD.json`

### Data Safety on Updates

- All data lives in `localStorage` which is **never cleared** by file updates
- The service worker uses network-first for app files, so new code is loaded immediately
- The storage key `habitpulse_goals_v1` remains unchanged across versions

### localStorage Limits

- Typical limit: ~5-10MB per origin
- Each goal with 365 days of history ≈ 3KB
- Safe for hundreds of goals with years of history

---

## 9. Developer Guide

### Running Locally

```bash
# Option 1: Simple file server (Python)
cd habit-pulse-main
python -m http.server 8000

# Option 2: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"

# Option 3: Direct file open (limited — SW won't work)
# Just open index.html in browser
```

> **Note**: Service worker requires a server (localhost or HTTPS). Direct file:// opens won't register the SW.

### Adding a New Unit Type

1. In `index.html`, add an `<option>` to `#goal-unit-select`:
   ```html
   <option value="chapters">📖 Chapters</option>
   ```
2. That's it! The unit string is stored as-is. No JS changes needed for basic units.

### Adding a New Chart

1. In `charts.js`, create a new export function:
   ```javascript
   export function renderMyChart(canvasId, data, color) {
     destroyChart(canvasId);
     // ... Chart.js config
     chartRegistry[canvasId] = new Chart(...);
   }
   ```
2. Add a `<canvas>` in `index.html`
3. Import and call from `ui.js`

### Modifying the Color Palette

Update both locations:
- `logic.js` line 8: `const PALETTE = [...]`
- `ui.js` line 20: `const PALETTE = [...]`
- `css/design-system.css`: `--goal-0` through `--goal-7` variables
- `index.html`: `.color-swatch` elements in the goal form

### Key Files to Modify

| Want to change... | Edit... |
|-------------------|---------|
| Business logic, calculations | `js/logic.js` |
| UI rendering, modals, events | `js/ui.js` |
| Data persistence | `js/storage.js` |
| Chart appearance | `js/charts.js` |
| Colors, fonts, variables | `css/design-system.css` |
| Component styles | `css/components.css` |
| Animations | `css/animations.css` |
| Page layouts | `css/pages.css` |
| HTML structure | `index.html` |

---

*Last updated: v2.0 — June 2026*
