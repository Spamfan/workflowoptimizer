// Prototype Crimson - js-app.js (v0.1.27)
// Master Router, Unified View Coordinator & Lifecycle Controller

import { initAuth, getSessionPin, logout, AUTH_VERSION } from './js-auth.js?v=0.1.2';
import { initDocsEngine, DOCS_VERSION } from './js-docs.js?v=0.1.5';
import { initGeneratorEngine, GENERATOR_VERSION } from './js-generator.js?v=0.1.4';
import { initPrintEngine, openPrintPreview, PRINT_VERSION } from './js-print.js?v=0.1.18';

export const APP_VERSION = "v0.1.27";

export function getRuntimeVersions() {
  let indexVer = 'v0.1.27';
  const metaVer = document.querySelector('meta[name="version"]');
  if (metaVer && metaVer.content) {
    indexVer = metaVer.content;
  } else if (document.documentElement && document.documentElement.dataset && document.documentElement.dataset.version) {
    indexVer = document.documentElement.dataset.version;
  }

  let cssVer = 'v0.1.21';
  const cssLink = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  if (cssLink) {
    const match = cssLink.getAttribute('href').match(/v=([^&]+)/);
    if (match && match[1]) cssVer = match[1].startsWith('v') ? match[1] : `v${match[1]}`;
  }

  return {
    "Prototype Crimson": APP_VERSION,
    "js-app.js": APP_VERSION,
    "js-auth.js": AUTH_VERSION,
    "js-docs.js": DOCS_VERSION,
    "js-generator.js": GENERATOR_VERSION,
    "js-print.js": PRINT_VERSION,
    "styles.css": cssVer,
    "index.html": indexVer
  };
}


const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const printView = document.getElementById('print-view');
const docsView = document.getElementById('docs-view');
const generatorView = document.getElementById('generator-view');
const btnLogout = document.getElementById('btn-logout');
const btnBack = document.getElementById('btn-back');
const btnPrintEdlps = document.getElementById('btn-print-edlps');
const cardPrintTitle = document.getElementById('card-print-title');
const versionText = document.getElementById('version-text');
if (versionText) versionText.innerHTML = `Crimson ${APP_VERSION} <span class="badge-chevron">▾</span>`;

let currentView = 'login-view';
let isAuthenticated = false;
let cachedStats = null;

export async function fetchCatalog() {
  try {
    const res = await fetch('./data-stats.json?t=' + Date.now());
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
  if (docsView) docsView.style.display = 'none';
  if (generatorView) generatorView.style.display = 'none';

  const targetEl = document.getElementById(targetViewId);
  if (targetEl) {
    targetEl.style.display = 'flex';
  }

  currentView = targetViewId;

  if (currentView === 'dashboard-view') {
    if (btnLogout) btnLogout.style.display = 'inline-flex';
    if (btnBack) btnBack.style.display = 'none';
  } else if (currentView === 'print-view' || currentView === 'docs-view' || currentView === 'generator-view') {
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
  if (!isAuthenticated && (dest === 'dashboard-view' || dest === 'print-view' || dest === 'docs-view' || dest === 'generator-view')) {
    dest = 'login-view';
  }
  switchView(dest, false);
});


// Live Ping Engine & Accordion Controller
const pingAccordionToggle = document.getElementById('ping-accordion-toggle');
const pingAccordionContent = document.getElementById('ping-accordion-content');
const pingLastCheckedText = document.getElementById('ping-last-checked-text');
const pingAccordionChevron = document.getElementById('ping-accordion-chevron');
const pingStatusText = document.getElementById('ping-status-text');
const btnCheckAgain = document.getElementById('btn-check-again');
let lastPingTimestamp = null;
let relativeTimeTimer = null;

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'never';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ago`;
}

function updateRelativeTimeDisplay() {
  if (!pingLastCheckedText) return;
  if (!lastPingTimestamp) {
    pingLastCheckedText.textContent = 'Checked for price updates just now';
    return;
  }
  const relStr = formatRelativeTime(lastPingTimestamp);
  pingLastCheckedText.textContent = `Checked for price updates ${relStr}`;
}

async function fetchPing() {
  if (btnCheckAgain) {
    btnCheckAgain.disabled = true;
    btnCheckAgain.textContent = 'Checking...';
  }
  if (pingStatusText) pingStatusText.textContent = 'Ping status: connecting...';

  try {
    const data = await fetchCatalog();
    cachedStats = data;
    lastPingTimestamp = Date.now();
    updateRelativeTimeDisplay();
    if (pingStatusText) {
      const pingVal = data.ping !== undefined ? String(data.ping) : 'connected';
      pingStatusText.textContent = `Ping status: ${pingVal}.`;
    }
  } catch (err) {
    if (pingStatusText) pingStatusText.textContent = 'Ping status: error';
  } finally {
    if (btnCheckAgain) {
      btnCheckAgain.disabled = false;
      btnCheckAgain.textContent = 'Check again';
    }
  }
}

function togglePingAccordion() {
  if (!pingAccordionContent) return;
  const isExpanded = pingAccordionContent.style.display === 'flex';
  pingAccordionContent.style.display = isExpanded ? 'none' : 'flex';
  if (pingAccordionChevron) pingAccordionChevron.textContent = isExpanded ? '▾' : '▴';
}

if (relativeTimeTimer) clearInterval(relativeTimeTimer);
relativeTimeTimer = setInterval(updateRelativeTimeDisplay, 10000);

function handleNavBack() {
  if (currentView === 'print-view' || currentView === 'docs-view' || currentView === 'generator-view') {
    switchView(isAuthenticated ? 'dashboard-view' : 'login-view');
  } else {
    switchView('login-view');
  }
}

initPrintEngine();
initDocsEngine();
initGeneratorEngine();



function showManifestModal() {
  const listBody = document.getElementById('manifest-list-body');
  if (listBody) {
    const liveVersions = getRuntimeVersions();
    listBody.innerHTML = Object.entries(liveVersions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mod, ver]) => `<tr><td>${mod}</td><td style="text-align: right;"><code>${ver}</code></td></tr>`)
      .join('');
  }
  openModal(document.getElementById('manifest-modal'));
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    if (e.target.id === 'print-reset-modal') {
      e.target.style.display = 'none';
    } else {
      closeModal(e.target);
    }
    return;
  }

  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const { action, viewTarget, modalTarget, actionIntent } = actionEl.dataset;
  if (action === 'view') {
    if (viewTarget) switchView(viewTarget);
    if (actionIntent === 'print-edlps') openPrintPreview('');
  } else if (action === 'open-modal') {
    if (modalTarget === 'manifest-modal') {
      showManifestModal();
    } else {
      const modalEl = document.getElementById(modalTarget);
      if (modalEl) openModal(modalEl);
    }
  } else if (action === 'close-modal') {
    const modalEl = actionEl.closest('.modal-overlay');
    if (modalEl) closeModal(modalEl);
  } else if (action === 'nav-back') {
    handleNavBack();
  } else if (action === 'logout') {
    logout();
  } else if (action === 'toggle-ping-accordion') {
    togglePingAccordion();
  } else if (action === 'check-ping') {
    fetchPing();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal(document.getElementById('terms-modal'));
    closeModal(document.getElementById('manifest-modal'));
    const resetModal = document.getElementById('print-reset-modal');
    if (resetModal) resetModal.style.display = 'none';
  }
});

// Bootstrap
initAuth({
  onSuccess: () => {
    isAuthenticated = true;
    if (cardPrintTitle) cardPrintTitle.textContent = "Recent EDLP Reports";
    if (btnPrintEdlps) btnPrintEdlps.disabled = false;
    switchView('dashboard-view');
    fetchPing();
  }
});

if (cardPrintTitle) cardPrintTitle.textContent = "Recent EDLP Reports";

history.replaceState({ view: 'login-view' }, '', '');
switchView('login-view', false);
