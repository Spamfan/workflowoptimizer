// Prototype Blue - js/app.js (v0.0.4)

import { initAuth, getSavedStore, logout, AUTH_VERSION } from './auth.js?v=0.0.2';
import { startCamera, stopCamera, captureFrame, processUploadedFile, SCANNER_VERSION } from './scanner.js?v=0.0.1';
import { runOcrPipeline, OCR_VERSION } from './ocr.js?v=0.0.1';
import {
  getStagedData,
  commitScanToCarrier,
  updateStagedItem,
  deleteStagedItem,
  addStagedItem,
  getNextCarrier,
  STAGING_VERSION
} from './staging.js?v=0.0.1';

export const APP_VERSION = "v0.0.4";
export const MODULE_VERSIONS = {
  "Prototype Blue": APP_VERSION,
  "app.js": APP_VERSION,
  "auth.js": AUTH_VERSION,
  "scanner.js": SCANNER_VERSION,
  "ocr.js": OCR_VERSION,
  "staging.js": STAGING_VERSION,
  "styles.css": "v0.0.2",
  "index.html": "v0.0.4"
};

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const scannerView = document.getElementById('scanner-view');
const reviewView = document.getElementById('review-view');
const btnLogout = document.getElementById('btn-logout');
const btnBack = document.getElementById('btn-back');
const cardPrintTitle = document.getElementById('card-print-title');
const versionText = document.getElementById('version-text');
if (versionText) versionText.textContent = `BLUE ${APP_VERSION}`;

let currentView = 'login-view';
let isAuthenticated = false;
let currentStore = '';
let activeCarrier = 'tmo';
let cachedStats = null;
let scannerRotation = 0;

export function switchView(targetViewId, pushState = true) {
  loginView.style.display = 'none';
  dashboardView.style.display = 'none';
  if (scannerView) scannerView.style.display = 'none';
  if (reviewView) reviewView.style.display = 'none';

  const targetEl = document.getElementById(targetViewId);
  if (targetEl) {
    targetEl.style.display = 'flex';
  }

  currentView = targetViewId;

  if (currentView === 'dashboard-view') {
    btnLogout.style.display = 'inline-flex';
    btnBack.style.display = 'none';
  } else if (currentView === 'scanner-view' || currentView === 'review-view') {
    btnLogout.style.display = 'none';
    btnBack.style.display = 'inline-flex';
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

    cachedStats = data;
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

// Scanner & Review DOM bindings
const scannerVideo = document.getElementById('scanner-video');
const btnScannerRotate = document.getElementById('btn-scanner-rotate');
const btnScannerShutter = document.getElementById('btn-scanner-shutter');
const scannerFileInput = document.getElementById('scanner-file-input');
const scannerProgressOverlay = document.getElementById('scanner-progress-overlay');
const ocrProgressText = document.getElementById('ocr-progress-text');

const reviewMetaThumb = document.getElementById('review-meta-thumb');
const reviewCarrierTitle = document.getElementById('review-carrier-title');
const reviewStoreText = document.getElementById('review-store-text');
const reviewTimestampText = document.getElementById('review-timestamp-text');
const carrierTabs = document.querySelectorAll('.carrier-tab');
const stagedItemsContainer = document.getElementById('staged-items-container');
const btnAddItem = document.getElementById('btn-add-item');
const btnScanNext = document.getElementById('btn-scan-next');
const btnPublishAll = document.getElementById('btn-publish-all');

// Review View Renderer
function renderReview(carrierKey) {
  activeCarrier = carrierKey;
  carrierTabs.forEach(t => t.classList.toggle('active', t.dataset.carrier === carrierKey));

  const state = getStagedData(currentStore);
  const sheet = state.sheets[carrierKey] || { carrier: carrierKey.toUpperCase(), timestamp: '', thumb: '', items: [] };

  reviewCarrierTitle.textContent = `${sheet.carrier} Inventory`;
  reviewStoreText.textContent = `Store ${currentStore || '--'}`;
  reviewTimestampText.textContent = sheet.timestamp || 'Not scanned yet';

  if (sheet.thumb) {
    reviewMetaThumb.src = sheet.thumb;
    reviewMetaThumb.style.display = 'block';
  } else {
    reviewMetaThumb.style.display = 'none';
  }

  stagedItemsContainer.innerHTML = '';
  if (!sheet.items || sheet.items.length === 0) {
    stagedItemsContainer.innerHTML = '<p class="placeholder-text" style="text-align: center; padding: 24px;">No items scanned yet for this carrier.</p>';
    return;
  }

  sheet.items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-row-card';
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="item-main-info">
        <span class="item-title">${item.model}</span>
        <div class="item-badge-group">
          <span class="item-cap">${item.capacity}</span>
          <span class="color-chip">${item.color}</span>
        </div>
      </div>
      <div class="row-actions">
        <span class="item-qty-badge">${item.qty}</span>
        <button class="btn-row-action btn-edit-row" title="Edit row">✎</button>
        <button class="btn-row-action danger btn-delete-row" title="Delete row">✕</button>
      </div>
    `;

    // Row Edit Handler
    card.querySelector('.btn-edit-row').addEventListener('click', () => {
      card.innerHTML = `
        <div class="row-edit-form">
          <input type="text" class="row-input input-model" value="${item.model}">
          <input type="text" class="row-input input-cap" value="${item.capacity}">
          <input type="text" class="row-input input-color" value="${item.color}">
          <input type="number" class="row-input input-qty" value="${item.qty}" min="0">
          <button class="btn-row-action btn-save-row" title="Save" style="color: var(--primary);">✓</button>
          <button class="btn-row-action btn-cancel-row" title="Cancel">✕</button>
        </div>
      `;

      card.querySelector('.btn-save-row').addEventListener('click', () => {
        const model = card.querySelector('.input-model').value.trim();
        const capacity = card.querySelector('.input-cap').value.trim();
        const color = card.querySelector('.input-color').value.trim().toUpperCase();
        const qty = parseInt(card.querySelector('.input-qty').value, 10) || 0;

        updateStagedItem(currentStore, activeCarrier, item.id, { model, capacity, color, qty });
        renderReview(activeCarrier);
      });

      card.querySelector('.btn-cancel-row').addEventListener('click', () => renderReview(activeCarrier));
    });

    // Row Delete Handler
    card.querySelector('.btn-delete-row').addEventListener('click', () => {
      deleteStagedItem(currentStore, activeCarrier, item.id);
      renderReview(activeCarrier);
    });

    stagedItemsContainer.appendChild(card);
  });
}

// Carrier switcher tabs
carrierTabs.forEach(tab => {
  tab.addEventListener('click', () => renderReview(tab.dataset.carrier));
});

// Add item manually
if (btnAddItem) {
  btnAddItem.addEventListener('click', () => {
    addStagedItem(currentStore, activeCarrier);
    renderReview(activeCarrier);
  });
}

// Lightbox preview on thumbnail tap
if (reviewMetaThumb) {
  reviewMetaThumb.addEventListener('click', () => {
    if (reviewMetaThumb.src) {
      lightboxImg.src = reviewMetaThumb.src;
      lightboxModal.style.display = 'flex';
    }
  });
}

// Process captured frame through OCR and Staging
async function handleCapturedImage(captureResult) {
  scannerProgressOverlay.style.display = 'flex';
  ocrProgressText.textContent = 'Reading sheet (0%)...';

  try {
    stopCamera(scannerVideo);
    const { items } = await runOcrPipeline(captureResult.canvas, cachedStats || {}, pct => {
      ocrProgressText.textContent = `Reading sheet (${pct}%)...`;
    });

    commitScanToCarrier(currentStore, activeCarrier, items, captureResult.thumbDataUrl);
    scannerProgressOverlay.style.display = 'none';
    renderReview(activeCarrier);
    switchView('review-view');
  } catch (err) {
    console.error(err);
    alert('Scan processing failed: ' + err.message);
    scannerProgressOverlay.style.display = 'none';
    switchView('dashboard-view');
  }
}

// Shutter Click Handler
if (btnScannerShutter) {
  btnScannerShutter.addEventListener('click', () => {
    try {
      const capture = captureFrame(scannerVideo, scannerRotation);
      handleCapturedImage(capture);
    } catch (err) {
      alert('Capture error: ' + err.message);
    }
  });
}

// Rotate Shutter Handler
if (btnScannerRotate) {
  btnScannerRotate.addEventListener('click', () => {
    scannerRotation = (scannerRotation + 90) % 360;
    scannerVideo.style.transform = `rotate(${scannerRotation}deg)`;
  });
}

// File Upload Fallback
if (scannerFileInput) {
  scannerFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const capture = await processUploadedFile(file, scannerRotation);
      handleCapturedImage(capture);
    } catch (err) {
      alert('Image processing error: ' + err.message);
    }
  });
}

// Floating Bar: Next Sheet & Publish
if (btnScanNext) {
  btnScanNext.addEventListener('click', async () => {
    activeCarrier = getNextCarrier(activeCarrier);
    scannerRotation = 0;
    scannerVideo.style.transform = 'none';
    switchView('scanner-view');
    try {
      await startCamera(scannerVideo);
    } catch (err) {
      alert('Unable to access camera: ' + err.message);
    }
  });
}

if (btnPublishAll) {
  btnPublishAll.addEventListener('click', () => {
    const state = getStagedData(currentStore);
    const totalItems = Object.values(state.sheets).reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
    if (totalItems === 0) {
      alert('No scanned inventory items to publish.');
      return;
    }
    alert(`Publishing ${totalItems} staged items across 3 carriers. Batch payload staged and ready.`);
  });
}

// Back Button Context Router
btnBack.addEventListener('click', () => {
  if (currentView === 'scanner-view') {
    stopCamera(scannerVideo);
    const state = getStagedData(currentStore);
    const hasItems = Object.values(state.sheets).some(s => s.items && s.items.length > 0);
    switchView(hasItems ? 'review-view' : 'dashboard-view');
  } else if (currentView === 'review-view') {
    switchView('dashboard-view');
  }
});

// Hook "Upload inventory" on dashboard to Scanner View
document.getElementById('btn-upload-inv').addEventListener('click', async () => {
  scannerRotation = 0;
  scannerVideo.style.transform = 'none';
  switchView('scanner-view');
  try {
    await startCamera(scannerVideo);
  } catch (err) {
    alert('Unable to access camera: ' + err.message);
  }
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

const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const btnLightboxClose = document.getElementById('btn-lightbox-close');

if (btnLightboxClose) {
  btnLightboxClose.addEventListener('click', () => { lightboxModal.style.display = 'none'; });
}
if (lightboxModal) {
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) lightboxModal.style.display = 'none';
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    termsModal.style.display = 'none';
    manifestModal.style.display = 'none';
    if (lightboxModal) lightboxModal.style.display = 'none';
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