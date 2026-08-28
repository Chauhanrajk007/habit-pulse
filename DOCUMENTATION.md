# HabitPulse — Documentation

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

## 1. Overview
HabitPulse is a modern, privacy-first web application designed to help users build habits and track goals without relying on a backend server.
- **Key Features**: Supports both "Habits" (daily repeating targets) and "Goals" (fixed targets over time), rich charting and analytics, a premium dark-mode UI with glassmorphism, completely offline functionality (PWA), and robust data export/import capabilities.
- **Technology Stack**: HTML5, Vanilla JavaScript (ES6 Modules), CSS3 (Variables, Animations), Chart.js (via CDN) for analytics, and Service Workers for offline PWA capabilities.

## 2. Architecture
The app follows a modular frontend architecture.
- `index.html`: The core markup, layout, and entry point.
- `js/app.js`: Application bootstrapper. It initializes all modals, components, and event listeners, and registers the PWA Service Worker.
- `js/storage.js`: The persistence layer. It handles all `localStorage` interactions, backups, parsing, and data validation.
- `js/logic.js`: The business logic layer. Calculates statistics, daily averages, target completion, streaks, and handles the rollback/undo system.
- `js/ui.js`: The view layer. Manages DOM manipulation, rendering goals, populating modals, parsing user input, and coordinating state changes.
- `js/charts.js`: The visualization layer. Acts as a wrapper around Chart.js to render the Daily, Weekly, Global, and Cumulative charts.
- `css/*.css`: The design system split into `design-system.css` (variables and utilities), `components.css` (cards, buttons, modals), `animations.css` (keyframes), and `pages.css` (layouts).
- `sw.js`: The Service Worker script caching static assets to ensure offline availability.

**Data Flow**: `storage.js` provides the source of truth -> `logic.js` processes raw data into statistics -> `ui.js` calls these functions and updates the DOM -> user interactions trigger functions in `ui.js` which modify data via `storage.js` and immediately re-render.

## 3. Data Model
All data is stored locally in the browser's `localStorage` under specific keys.

### Goal Object Schema
```javascript
{
  id: "goal_1623..._a1b2c3", // Unique ID
  title: "Read a Book",     // Display name
  type: "habit",            // "habit" | "goal"
  unit: "pages",            // e.g., pages, kg, steps
  isTime: false,            // Boolean indicating if unit is time-based
  target: 500,              // Total target (Infinity for habits)
  dailyTarget: 20,          // Expected daily increment (null if unset)
  color: "#7c3aed",         // CSS color hex
  createdAt: "2023-10-01",  // ISO Date string
  completed: 120,           // Total amount completed
  history: [                // Array of history objects
    { date: "2023-10-01", value: 20 },
    { date: "2023-10-02", value: 40 }
  ]
}
```

### History Entry
- `date` (String): YYYY-MM-DD representation.
- `value` (Number): The accumulated progress for that specific day.

### Storage Keys
- `habitpulse_goals_v1`: JSON string array of the Goal objects.
- `habitpulse_settings_v1`: JSON string of the user settings (e.g., `{ theme: 'dark', notifications: false }`).

## 4. Features Guide
### 4.1 Goals vs Habits
- **Goals**: Have a fixed total `target`. The progress ring completes when `completed >= target`.
- **Habits**: Have an infinite (`Infinity`) target. Progress is tracked day-to-day, and there is no global completion state.

### 4.2 Logging Progress
- **How Much**: Standard duration logging (e.g., "Read 20 pages"). The entered value is added to `completed` and today's `history` entry.
- **Till Where**: Position-based logging. If the user previously logged "page 20" and now logs "page 50", the system calculates the delta (30 pages) and adds it to the current day. This position state is temporarily tracked in the modal.

### 4.3 Undo / Rollback
The app provides a single-step undo system in the session memory. When a user logs a value, the delta is temporarily stored. Clicking "Undo" subtracts the delta from `completed` and the current day's `history`. Note: The undo state is lost when the page is refreshed.

### 4.4 Daily Focus Banner
A banner at the top of the app lists goals/habits that have a `dailyTarget`. If today's logged value is less than the `dailyTarget`, it shows as pending. When met, it disappears from the pending list.

### 4.5 Analytics
The analytics view provides comprehensive statistics:
- **Global**: A line chart showing overall percentage completion for all goals over time.
- **Per Goal**: Individual goal breakdowns.
- **Time Toggle**: If a goal is time-based, the UI provides pills to toggle viewing the values in Seconds, Minutes, or Hours.

## 5. How Calculations Work
### 5.1 Average Per Day
`Avg = Total Completed / Days Since Creation`.
The logic uses absolute calendar days elapsed rather than active days logged. This ensures realistic pacing estimates. (e.g. 50 pages over 10 days = 5 pages/day, even if you only logged on 2 of those days).

### 5.2 Streak
A streak counts consecutive calendar days where `history` value > 0. It checks starting from today; if today is 0, it falls back to checking from yesterday. If yesterday is also 0, the streak breaks.

### 5.3 Estimated Days to Finish
`Days Left = Remaining Target / Average Per Day`.
If `Avg === 0`, it defaults to `Infinity`.

### 5.4 Habit Deficit/Surplus
Habits calculate a deficit to determine pacing:
`Expected = Days Since Creation * Daily Target`.
`Status = Total Completed - Expected`.
If Status > 0, the user is ahead. If Status < 0, the user is behind.

### 5.5 Daily Target Completion %
- **Per Goal**: `(Today's Value / Daily Target) * 100` (Capped at 100%).
- **Global Average**: The mean percentage of all active goals with a `dailyTarget`.

## 6. UI/UX Design System
The app uses a premium, highly-polished dark mode interface using CSS variables.
- **Colors**: Uses specific HSL/hex palettes such as `purple-500` (#8b5cf6), `emerald` (#10b981), and deep dark backgrounds (`#0a0a0f`).
- **Typography**: Uses `Inter` for highly readable body text, and `Outfit` for bold, stylized display numbers and headings.
- **Glassmorphism**: Cards and modals utilize `backdrop-filter: blur(12px)` and subtle white transparent borders (`rgba(255,255,255,0.05)`) to create depth over a dark, subtly textured background.

## 7. PWA Support
- **Service Worker (`sw.js`)**: Caches critical assets (`index.html`, CSS, JS, fonts) in a named cache (`v2.0.4`).
- **Manifest (`manifest.json`)**: Configures the app name, icons, theme color, and standalone display mode for native-like installation on mobile/desktop.

## 8. Data Management
- **Export**: Exports the current `localStorage` payload to a JSON file format containing the `version`, `exportedAt`, `goals`, and `settings`.
- **Import**: Validates and imports the JSON schema back into `localStorage`. 
- **Storage Limits**: Standard `localStorage` limit is ~5MB, which is virtually impossible to hit with simple JSON history entries.

## 9. Developer Guide
- **Running Locally**: Simply double-click `index.html` or run any standard local server (e.g., `python -m http.server`). There is no build step.
- **Adding Units**: Expand the unit dropdowns in `index.html` and the format checks in `js/ui.js` and `js/logic.js`.
- **Modifying Colors**: Update the CSS variables in `:root` of `css/design-system.css`.
- **Charts**: Chart configurations are self-contained in `js/charts.js`. Modification requires understanding Chart.js v4.
