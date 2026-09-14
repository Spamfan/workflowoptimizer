// Prototype Blue - js/app.js (v0.0.3)

import { initAuth, getSavedStore, logout, AUTH_VERSION } from './auth.js?v=0.0.2';

export const APP_VERSION = "v0.0.3";
export const MODULE_VERSIONS = {
  "Prototype Blue": APP_VERSION,
  "app.js": APP_VERSION,
  "auth.js": AUTH_VERSION,
  "styles.css": "v0.0.1",
  "index.html": "v0.0.1"
};

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const btnLogout = document.getElementById('btn-logout');
const btnBack = document.getElementById('btn-back');
const cardPrintTitle = document.getElementById('card-print-title');
const versionText = document.getElementById('version-text');

let currentView = 'login-view';
let isAuthenticated = false;

export function switchView(targetViewId, pushState = true) {
  loginView.style.display = 'none';
  dashboardView.style.display = 'none';

  const targetEl = document.getElementById(targetViewId);
  if (targetEl) {
    targetEl.style.display = 'flex';
  }

  currentView = targetViewId;

  if (currentView === 'dashboard-view') {
    btnLogout.style.display = 'inline-flex';
    btnBack.style.display = 'none';
  } else {
    btnLogout.style.display = 'none';
    btnBack.style.display = 'none';
  }

  if (pushState) {
    history.pushState({ view: targetViewId }, '', '');
  }
}

// History Navigation
window.addEventListener('popstate', (e) => {
  if (termsModal.style.display === 'flex') {
    termsModal.style.display = 'none';
    return;
  }
  if (manifestModal.style.display === 'flex') {
    manifestModal.style.display = 'none';
    return;
  }
  let dest = (e.state && e.state.view) ? e.state.view : 'login-view';
  if (!isAuthenticated && dest === 'dashboard-view') {
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
  refreshSvg.classList.add('spinning');
  pingStatusEl.textContent = 'Checking...';

  try {
    let data;
    try {
      const apiRes = await fetch('https://api.github.com/repos/spamfan/workflowoptimizer/contents/stats.json', {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        cache: 'no-store'
      });
      if (!apiRes.ok) throw new Error('API ' + apiRes.status);
      const rawApi = await apiRes.json();
      const decodedStr = decodeURIComponent(escape(atob(rawApi.content.replace(/\s/g, ''))));
      data = JSON.parse(decodedStr);
    } catch (apiErr) {
      const localRes = await fetch('./stats.json?t=' + Date.now());
      if (!localRes.ok) throw new Error('Local ' + localRes.status);
      data = await localRes.json();
    }

    pingValueEl.textContent = data.ping !== undefined ? String(data.ping) : 'N/A';
    pingStatusEl.textContent = 'Refresh complete';
    statusTimer = setTimeout(() => { pingStatusEl.textContent = ''; }, 2000);
  } catch (err) {
    pingValueEl.textContent = 'Error';
    pingStatusEl.textContent = 'Error';
  } finally {
    setTimeout(() => { refreshSvg.classList.remove('spinning'); }, 300);
  }
}

btnRefresh.addEventListener('click', fetchPing);
btnLogout.addEventListener('click', logout);

// Placeholder Upload Button Hook
document.getElementById('btn-upload-inv').addEventListener('click', () => {
  alert('Upload Inventory pipeline module will be mounted here next.');
});

// Modals: Manifest & Terms
const manifestModal = document.getElementById('manifest-modal');
const manifestListBody = document.getElementById('manifest-list-body');
const btnManifestClose = document.getElementById('btn-manifest-close');

versionText.addEventListener('click', () => {
  manifestListBody.innerHTML = Object.entries(MODULE_VERSIONS)
    .map(([mod, ver]) => `<tr><td>${mod}</td><td style="text-align: right;"><code>${ver}</code></td></tr>`)
    .join('');
  manifestModal.style.display = 'flex';
});

btnManifestClose.addEventListener('click', () => { manifestModal.style.display = 'none'; });
manifestModal.addEventListener('click', (e) => {
  if (e.target === manifestModal) manifestModal.style.display = 'none';
});

const termsModal = document.getElementById('terms-modal');
const btnTerms = document.getElementById('btn-terms');
const btnTermsClose = document.getElementById('btn-terms-close');

btnTerms.addEventListener('click', () => { termsModal.style.display = 'flex'; });
btnTermsClose.addEventListener('click', () => { termsModal.style.display = 'none'; });
termsModal.addEventListener('click', (e) => {
  if (e.target === termsModal) termsModal.style.display = 'none';
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    termsModal.style.display = 'none';
    manifestModal.style.display = 'none';
  }
});

// Bootstrap
initAuth({
  onSuccess: (storeVal) => {
    isAuthenticated = true;
    cardPrintTitle.textContent = `Print inventory (${storeVal})`;
    switchView('dashboard-view');
    fetchPing();
  }
});

switchView('login-view');