/**
 * app.js — Bootstrap, routing
 */

import {
  renderActiveGoals, renderCompletedGoals, renderAnalytics,
  openAddModal, openSettings, switchTab,
  initGoalForm, initLogForm, initModals, initSettings, initChartControls, showToast
} from './ui.js';

function init() {
  // Modals and forms
  initModals();
  initGoalForm();
  initLogForm();
  initSettings();
  initChartControls();

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // FAB
  document.getElementById('fab-add').addEventListener('click', openAddModal);

  // Settings button
  document.getElementById('btn-settings').addEventListener('click', openSettings);

  // Initial render
  renderActiveGoals();

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const installBanner = document.getElementById('install-banner');
    if (installBanner) installBanner.style.display = 'flex';
  });

  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          showToast('App installed! 🎉', 'success');
          document.getElementById('install-banner').style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
