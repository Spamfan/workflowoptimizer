// Prototype Crimson - app.js (v0.1.12)
// Master Router, Unified View Coordinator & Lifecycle Controller

import { initAuth, getSessionPin, logout, AUTH_VERSION } from './auth.js?v=0.1.0';
import { initPrintEngine, openPrintPreview, PRINT_VERSION } from './print.js?v=0.1.15';

export const APP_VERSION = "v0.1.12";

export function getRuntimeVersions() {
  let indexVer = 'v0.1.12';
  const metaVer = document.querySelector('meta[name="version"]');
  if (metaVer && metaVer.content) {
    indexVer = metaVer.content;
  } else if (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.version) {
    indexVer = document.documentElement.dataset.version;
  }

  let cssVer = 'v0.1.11';
  const cssLink = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  if (cssLink) {
    const match = cssLink.getAttribute('href').match(/v=([^&]+)/);
    if (match && match[1]) cssVer = match[1].startsWith('v') ? match[1] : `v${match[1]}`;
  }

  return {
    "Prototype Crimson": APP_VERSION,
    "app.js": APP_VERSION,
    "auth.js": AUTH_VERSION,
    "print.js": PRINT_VERSION,
    "styles.css": cssVer,
    "index.html": indexVer
  };
}


const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const printView = document.getElementById('print-view');
const btnLogout = document.getElementById('btn-logout');
const btnBack = document.getElementById('btn-back');
const btnPrintEdlps = document.getElementById('btn-print-edlps');
const cardPrintTitle = document.getElementById('card-print-title');
const versionText = document.getElementById('version-text');
if (versionText) versionText.textContent = `Crimson ${APP_VERSION}`;

let currentView = 'login-view';
let isAuthenticated = false;
let cachedStats = null;

export async function fetchCatalog() {
  try {
    const res = await fetch('./stats.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedStats = data;
    return data;
  } catch (err) {
    if (cachedStats) return cachedStats;
    throw err;
  }
}


export function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  history.pushState({ modalId: modalEl.id }, '', '');
}

export function closeModal(modalEl) {
  if (!modalEl || modalEl.style.display === 'none') return;
  modalEl.style.display = 'none';
  if (history.state && history.state.modalId === modalEl.id) {
    history.back();
  }
}

export function switchView(targetViewId, pushState = true) {
  if (loginView) loginView.style.display = 'none';
  if (dashboardView) dashboardView.style.display = 'none';
  if (printView) printView.style.display = 'none';

  const targetEl = document.getElementById(targetViewId);
  if (targetEl) {
    targetEl.style.display = 'flex';
  }

  currentView = targetViewId;

  if (currentView === 'dashboard-view') {
    if (btnLogout) btnLogout.style.display = 'inline-flex';
    if (btnBack) btnBack.style.display = 'none';
  } else if (currentView === 'print-view') {
    if (btnLogout) btnLogout.style.display = 'none';
    if (btnBack) btnBack.style.display = 'inline-flex';
  } else {
    if (btnLogout) btnLogout.style.display = 'none';
    if (btnBack) btnBack.style.display = 'none';
  }

  if (pushState) {
    history.pushState({ view: targetViewId }, '', '');
  }
}

window.addEventListener('popstate', (e) => {
  let modalDismissed = false;
  const openModals = document.querySelectorAll('.modal-overlay');
  for (const modal of openModals) {
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
      modalDismissed = true;
    }
  }
  if (modalDismissed) return;

  let dest = (e.state && e.state.view) ? e.state.view : 'login-view';
  if (!isAuthenticated && (dest === 'dashboard-view' || dest === 'print-view')) {
    dest = 'login-view';
  }
  switchView(dest, false);
});


// Live Ping Engine
const btnRefresh = document.getElementById('btn-refresh-ping');
const refreshSvg = document.getElementById('refresh-svg');
const pingValueEl = document.getElementById('ping-value');
const pingStatusEl = document.getElementById('ping-status');
let statusTimer = null;


async function fetchPing() {
  if (statusTimer) clearTimeout(statusTimer);
  if (refreshSvg) refreshSvg.classList.add('spinning');
  if (pingStatusEl) pingStatusEl.textContent = 'Checking...';


  try {
    const data = await fetchCatalog();
    cachedStats = data;
    if (pingValueEl) pingValueEl.textContent = data.ping !== undefined ? String(data.ping) : 'Connected.';
    if (pingStatusEl) pingStatusEl.textContent = 'Refresh complete';
    statusTimer = setTimeout(() => { if (pingStatusEl) pingStatusEl.textContent = ''; }, 2000);
  } catch (err) {
    if (pingValueEl) pingValueEl.textContent = 'Error';
    if (pingStatusEl) pingStatusEl.textContent = 'Error';
  } finally {
    setTimeout(() => { if (refreshSvg) refreshSvg.classList.remove('spinning'); }, 300);
  }
}


if (btnRefresh) btnRefresh.addEventListener('click', fetchPing);
if (btnLogout) btnLogout.addEventListener('click', logout);


if (btnBack) {
  btnBack.addEventListener('click', () => {
    if (currentView === 'print-view') {
      switchView(isAuthenticated ? 'dashboard-view' : 'login-view');
    } else {
      switchView('login-view');
    }
  });
}

initPrintEngine();

if (btnPrintEdlps) {
  btnPrintEdlps.addEventListener('click', () => {
    switchView('print-view');
    openPrintPreview('');
  });
}

// Modals: Manifest & Terms
const manifestModal = document.getElementById('manifest-modal');
const manifestListBody = document.getElementById('manifest-list-body');
const btnManifestClose = document.getElementById('btn-manifest-close');

if (versionText) {
  versionText.addEventListener('click', () => {
    if (manifestListBody) {
      const liveVersions = getRuntimeVersions();
      manifestListBody.innerHTML = Object.entries(liveVersions)
        .map(([mod, ver]) => `<tr><td>${mod}</td><td style="text-align: right;"><code>${ver}</code></td></tr>`)
        .join('');
    }
    openModal(manifestModal);
  });
}

if (btnManifestClose) btnManifestClose.addEventListener('click', () => { closeModal(manifestModal); });
if (manifestModal) {
  manifestModal.addEventListener('click', (e) => {
    if (e.target === manifestModal) closeModal(manifestModal);
  });
}

const termsModal = document.getElementById('terms-modal');
const btnTerms = document.getElementById('btn-terms');
const btnTermsClose = document.getElementById('btn-terms-close');

if (btnTerms) btnTerms.addEventListener('click', () => { openModal(termsModal); });
if (btnTermsClose) btnTermsClose.addEventListener('click', () => { closeModal(termsModal); });
if (termsModal) {
  termsModal.addEventListener('click', (e) => {
    if (e.target === termsModal) closeModal(termsModal);
  });
}

const printResetModal = document.getElementById('print-reset-modal');
if (printResetModal) {
  printResetModal.addEventListener('click', (e) => {
    if (e.target === printResetModal) {
      printResetModal.style.display = 'none';
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal(termsModal);
    closeModal(manifestModal);
    const resetModal = document.getElementById('print-reset-modal');
    if (resetModal) resetModal.style.display = 'none';
  }
});

// Bootstrap
initAuth({
  onSuccess: () => {
    isAuthenticated = true;
    if (cardPrintTitle) cardPrintTitle.textContent = "Print EDLPs";
    if (btnPrintEdlps) btnPrintEdlps.disabled = false;
    switchView('dashboard-view');
    fetchPing();
  }
});

history.replaceState({ view: 'login-view' }, '', '');
switchView('login-view', false);
