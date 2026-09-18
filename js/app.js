// Prototype Blue - js/app.js (v0.0.9)

import { initAuth, getSavedStore, logout, AUTH_VERSION } from './auth.js?v=0.0.2';
import {
  startCamera,
  stopCamera,
  captureFrame,
  loadFileToImage,
  initAdjuster,
  resetAdjuster,
  setAdjusterRotation,
  captureAdjustedFrame,
  SCANNER_VERSION
} from './scanner.js?v=0.0.5';
import { runOcrPipeline, getOcrTelemetry, OCR_VERSION } from './ocr.js?v=0.0.3';
import {
  getStagedData,
  commitScanToCarrier,
  updateStagedItem,
  deleteStagedItem,
  addStagedItem,
  getNextCarrier,
  STAGING_VERSION
} from './staging.js?v=0.0.3';

export const APP_VERSION = "v0.0.9";
export const MODULE_VERSIONS = {
  "Prototype Blue": APP_VERSION,
  "app.js": APP_VERSION,
  "auth.js": AUTH_VERSION,
  "scanner.js": SCANNER_VERSION,
  "ocr.js": OCR_VERSION,
  "staging.js": STAGING_VERSION,
  "styles.css": "v0.0.7",
  "index.html": "v0.0.6"
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

export function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  history.pushState({ modalId: modalEl.id }, '', '');
}

export function closeModal(modalEl) {
  if (!modalEl || modalEl.style.display !== 'flex') return;
  modalEl.style.display = 'none';
  if (history.state && history.state.modalId === modalEl.id) {
    history.back();
  }
}

function updateDashboardStagedButton() {
  const btnViewStaged = document.getElementById('btn-view-staged');
  if (!btnViewStaged) return;
  const state = getStagedData(currentStore);
  const total = Object.values(state.sheets).reduce((sum, s) => sum + (s.items ? s.items.length : 0), 0);
  if (total > 0) {
    btnViewStaged.textContent = `View Staged (${total})`;
    btnViewStaged.style.display = 'inline-flex';
  } else {
    btnViewStaged.style.display = 'none';
  }
}

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
    updateDashboardStagedButton();
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

// History Navigation (Universal Modal & View router)
window.addEventListener('popstate', (e) => {
  const openModals = document.querySelectorAll('.modal-overlay');
  for (const modal of openModals) {
    if (modal.style.display === 'flex') {
      modal.style.display = 'none';
      return;
    }
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
const scannerFrame = document.getElementById('scanner-frame');
const scannerPreviewImg = document.getElementById('scanner-preview-img');
const scannerAdjusterBar = document.getElementById('scanner-adjuster-bar');
const scannerInstructionBanner = document.getElementById('scanner-instruction-banner');
const tiltSlider = document.getElementById('tilt-slider');
const tiltAngleDisplay = document.getElementById('tilt-angle-display');
const btnAdjustReset = document.getElementById('btn-adjust-reset');
const cameraControlsDeck = document.getElementById('camera-controls-deck');
const cropControlsDeck = document.getElementById('crop-controls-deck');
const btnCropCamera = document.getElementById('btn-crop-camera');
const btnCropConfirm = document.getElementById('btn-crop-confirm');
const btnCropFile = document.getElementById('btn-crop-file');
const btnScannerShutter = document.getElementById('btn-scanner-shutter');
const scannerFileInput = document.getElementById('scanner-file-input');
const reviewLoadingState = document.getElementById('review-loading-state');
const ocrProgressText = document.getElementById('ocr-progress-text');

let isCropMode = false;

async function enterCropMode(file) {
  isCropMode = true;
  stopCamera(scannerVideo);
  if (scannerVideo) scannerVideo.style.display = 'none';
  if (scannerPreviewImg) scannerPreviewImg.style.display = 'block';
  if (scannerAdjusterBar) scannerAdjusterBar.style.display = 'flex';
  if (cameraControlsDeck) cameraControlsDeck.style.display = 'none';
  if (cropControlsDeck) cropControlsDeck.style.display = 'flex';
  if (tiltSlider) tiltSlider.value = '0';
  if (tiltAngleDisplay) tiltAngleDisplay.textContent = '0.00°';
  if (scannerInstructionBanner) {
    scannerInstructionBanner.textContent = "Drag and tilt to align paper to frame, then tap ✓";
  }
  await loadFileToImage(file, scannerPreviewImg);
  if (scannerFrame && scannerPreviewImg) {
    initAdjuster(scannerPreviewImg, scannerFrame);
  }
}

function exitCropMode() {
  isCropMode = false;
  if (scannerPreviewImg) {
    scannerPreviewImg.style.display = 'none';
    resetAdjuster(scannerPreviewImg);
  }
  if (scannerAdjusterBar) scannerAdjusterBar.style.display = 'none';
  if (cropControlsDeck) cropControlsDeck.style.display = 'none';
  if (cameraControlsDeck) cameraControlsDeck.style.display = 'flex';
  if (scannerVideo) scannerVideo.style.display = 'block';
  if (tiltSlider) tiltSlider.value = '0';
  if (tiltAngleDisplay) tiltAngleDisplay.textContent = '0.00°';
  if (scannerInstructionBanner) {
    scannerInstructionBanner.textContent = "Place corners of the viewfinder just within the paper's borders.";
  }
}

if (tiltSlider) {
  tiltSlider.addEventListener('input', (e) => {
    const deg = parseFloat(e.target.value) || 0;
    if (tiltAngleDisplay) {
      tiltAngleDisplay.textContent = `${deg >= 0 ? '+' : ''}${deg.toFixed(2)}°`;
    }
    setAdjusterRotation(scannerPreviewImg, deg);
  });
}

if (btnAdjustReset) {
  btnAdjustReset.addEventListener('click', () => {
    resetAdjuster(scannerPreviewImg);
    if (tiltSlider) tiltSlider.value = '0';
    if (tiltAngleDisplay) tiltAngleDisplay.textContent = '0.00°';
  });
}

if (btnCropCamera) {
  btnCropCamera.addEventListener('click', async () => {
    exitCropMode();
    try {
      await startCamera(scannerVideo);
    } catch (err) {
      alert('Unable to access camera: ' + err.message);
    }
  });
}

if (btnCropFile) {
  btnCropFile.addEventListener('click', () => {
    if (scannerFileInput) scannerFileInput.click();
  });
}

if (btnCropConfirm) {
  btnCropConfirm.addEventListener('click', () => {
    try {
      if (scannerPreviewImg && scannerFrame) {
        const capture = captureAdjustedFrame(scannerPreviewImg, scannerFrame);
        exitCropMode();
        handleCapturedImage(capture);
      }
    } catch (err) {
      alert('Capture error: ' + err.message);
    }
  });
}

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

  if (reviewLoadingState) reviewLoadingState.style.display = 'none';
  stagedItemsContainer.style.display = 'flex';
  if (btnAddItem) btnAddItem.style.display = 'inline-flex';

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
      <div class="item-main-info tap-editable" title="Tap to edit row">
        <span class="item-title">${item.model}</span>
        <div class="item-badge-group">
          <span class="item-cap-pill">${item.capacity}</span>
          <span class="color-chip-pill">${item.color}</span>
        </div>
      </div>
      <div class="row-actions">
        <span class="item-qty-badge tap-editable" title="Tap to edit row">${item.qty}</span>
        <button class="btn-row-action danger btn-delete-row" title="Delete row">✕</button>
      </div>
    `;

    const activateEdit = () => {
      card.innerHTML = `
        <div class="row-edit-form">
          <input type="text" class="row-input input-model" value="${item.model}" placeholder="Model">
          <input type="text" class="row-input input-cap" value="${item.capacity}" placeholder="Capacity">
          <input type="text" class="row-input input-color" value="${item.color}" placeholder="Color">
          <input type="number" class="row-input input-qty" value="${item.qty}" min="0" placeholder="Qty">
          <div class="edit-btn-group">
            <button class="btn-row-action btn-save-row" title="Save" style="color: var(--primary); font-weight: 700;">✓</button>
            <button class="btn-row-action btn-cancel-row" title="Cancel">✕</button>
          </div>
        </div>
      `;

      const modelInput = card.querySelector('.input-model');
      if (modelInput) modelInput.focus();

      const saveChanges = () => {
        const model = card.querySelector('.input-model').value.trim();
        const capacity = card.querySelector('.input-cap').value.trim();
        const color = card.querySelector('.input-color').value.trim().toUpperCase();
        const qty = parseInt(card.querySelector('.input-qty').value, 10) || 0;

        updateStagedItem(currentStore, activeCarrier, item.id, { model, capacity, color, qty });
        renderReview(activeCarrier);
      };

      card.querySelector('.btn-save-row').addEventListener('click', saveChanges);
      card.querySelector('.btn-cancel-row').addEventListener('click', () => renderReview(activeCarrier));
      card.querySelectorAll('.row-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveChanges();
          if (e.key === 'Escape') renderReview(activeCarrier);
        });
      });
    };

    card.querySelectorAll('.tap-editable').forEach(el => {
      el.addEventListener('click', activateEdit);
    });

    card.querySelector('.btn-delete-row').addEventListener('click', (e) => {
      e.stopPropagation();
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
  stopCamera(scannerVideo);
  switchView('review-view');

  if (reviewMetaThumb) {
    reviewMetaThumb.src = captureResult.thumbDataUrl;
    reviewMetaThumb.style.display = 'block';
  }
  reviewCarrierTitle.textContent = 'Analyzing sheet...';
  reviewStoreText.textContent = `Store ${currentStore || '--'}`;
  reviewTimestampText.textContent = 'Processing OCR...';
  stagedItemsContainer.style.display = 'none';
  if (btnAddItem) btnAddItem.style.display = 'none';
  if (reviewLoadingState) reviewLoadingState.style.display = 'flex';
  if (ocrProgressText) ocrProgressText.textContent = 'Reading sheet (0%)...';

  try {
    const { carrier, store, items } = await runOcrPipeline(captureResult.canvas, cachedStats || {}, pct => {
      if (ocrProgressText) ocrProgressText.textContent = `Reading sheet (${pct}%)...`;
    });

    if (carrier && ['tmo', 'vzw', 'att'].includes(carrier)) {
      activeCarrier = carrier;
    }

    const telem = getOcrTelemetry();
    commitScanToCarrier(currentStore, activeCarrier, items, captureResult.thumbDataUrl, telem);
    renderReview(activeCarrier);
  } catch (err) {
    console.error(err);
    alert('Scan processing failed: ' + err.message);
    if (reviewLoadingState) reviewLoadingState.style.display = 'none';
    stagedItemsContainer.style.display = 'flex';
    if (btnAddItem) btnAddItem.style.display = 'inline-flex';
    renderReview(activeCarrier);
  }
}

// Direct staged view navigation from dashboard
const btnViewStaged = document.getElementById('btn-view-staged');
if (btnViewStaged) {
  btnViewStaged.addEventListener('click', () => {
    renderReview(activeCarrier);
    switchView('review-view');
  });
}

// Lightbox preview on thumbnail tap
if (reviewMetaThumb) {
  reviewMetaThumb.addEventListener('click', () => {
    if (reviewMetaThumb.src) {
      lightboxImg.src = reviewMetaThumb.src;
      openModal(lightboxModal);
    }
  });
}

// Modals: Manifest & Terms
const manifestModal = document.getElementById('manifest-modal');
const manifestListBody = document.getElementById('manifest-list-body');
const btnManifestClose = document.getElementById('btn-manifest-close');

versionText.addEventListener('click', () => {
  manifestListBody.innerHTML = Object.entries(MODULE_VERSIONS)
    .map(([mod, ver]) => `<tr><td>${mod}</td><td style="text-align: right;"><code>${ver}</code></td></tr>`)
    .join('');
  openModal(manifestModal);
});

btnManifestClose.addEventListener('click', () => { closeModal(manifestModal); });
manifestModal.addEventListener('click', (e) => {
  if (e.target === manifestModal) closeModal(manifestModal);
});

const termsModal = document.getElementById('terms-modal');
const btnTerms = document.getElementById('btn-terms');
const btnTermsClose = document.getElementById('btn-terms-close');

btnTerms.addEventListener('click', () => { openModal(termsModal); });
btnTermsClose.addEventListener('click', () => { closeModal(termsModal); });
termsModal.addEventListener('click', (e) => {
  if (e.target === termsModal) closeModal(termsModal);
});

const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const btnLightboxClose = document.getElementById('btn-lightbox-close');

if (btnLightboxClose) {
  btnLightboxClose.addEventListener('click', () => { closeModal(lightboxModal); });
}
if (lightboxModal) {
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeModal(lightboxModal);
  });
}

// OCR Diagnostics Modal Binding
const ocrDebugModal = document.getElementById('ocr-debug-modal');
const btnOcrDebug = document.getElementById('btn-ocr-debug');
const btnOcrDebugClose = document.getElementById('btn-ocr-debug-close');
const ocrDebugTimestamp = document.getElementById('ocr-debug-timestamp');
const ocrDebugCarrier = document.getElementById('ocr-debug-carrier');
const ocrDebugStore = document.getElementById('ocr-debug-store');
const ocrDebugCount = document.getElementById('ocr-debug-count');
const ocrDebugLinesList = document.getElementById('ocr-debug-lines-list');
const ocrDebugRawText = document.getElementById('ocr-debug-raw-text');

if (btnOcrDebug) {
  btnOcrDebug.addEventListener('click', () => {
    const state = getStagedData(currentStore);
    const sheet = state.sheets[activeCarrier];
    const telem = (sheet && sheet.telemetry) ? sheet.telemetry : getOcrTelemetry();

    if (ocrDebugTimestamp) {
      ocrDebugTimestamp.textContent = telem.timestamp
        ? `Captured at ${telem.timestamp} (${sheet ? sheet.carrier : activeCarrier.toUpperCase()})`
        : 'No scan telemetry recorded for this carrier';
    }
    if (ocrDebugCarrier) {
      ocrDebugCarrier.textContent = telem.header && telem.header.carrier
        ? telem.header.carrier.toUpperCase()
        : (sheet ? sheet.carrier : '--');
    }
    if (ocrDebugStore) {
      ocrDebugStore.textContent = (telem.header && telem.header.store) || currentStore || '--';
    }
    if (ocrDebugCount) {
      ocrDebugCount.textContent = String(telem.itemCount || (sheet && sheet.items ? sheet.items.length : 0));
    }

    if (ocrDebugLinesList) {
      ocrDebugLinesList.innerHTML = '';
      if (!telem.lineLogs || telem.lineLogs.length === 0) {
        ocrDebugLinesList.innerHTML = '<p class="placeholder-text" style="padding: 10px; text-align: center;">No telemetry recorded for this sheet yet.</p>';
      } else {
        telem.lineLogs.forEach((log, idx) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'debug-line-item';
          const isMatched = log.status === 'matched';
          const badgeHtml = `<span class="debug-badge ${isMatched ? 'matched' : 'skipped'}">${isMatched ? 'MATCHED' : 'SKIPPED'}</span>`;
          const topCandidates = log.topCandidates && log.topCandidates.length > 0
            ? log.topCandidates.map(c => `${c.name} (dist: ${c.dist})`).join(', ')
            : '';
          const details = isMatched
            ? `Parsed: <strong>${log.item.model}</strong> • ${log.item.capacity} • ${log.item.color} • Qty: ${log.item.qty}${topCandidates ? `<br><span class="debug-line-note">Candidates: ${topCandidates}</span>` : ''}`
            : `<span style="color: var(--danger);">${log.reason || 'Not matched'}</span>`;

          itemEl.innerHTML = `
            <div class="debug-line-header">
              <span style="font-weight: 700; font-size: 0.75rem;">Row #${idx + 1}</span>
              ${badgeHtml}
            </div>
            <div class="debug-line-raw">${log.line}</div>
            <div style="font-size: 0.76rem;">${details}</div>
          `;
          ocrDebugLinesList.appendChild(itemEl);
        });
      }
    }

    if (ocrDebugRawText) {
      ocrDebugRawText.textContent = telem.rawText || '(No raw OCR text captured for this sheet)';
    }

    openModal(ocrDebugModal);
  });
}

if (btnOcrDebugClose) {
  btnOcrDebugClose.addEventListener('click', () => { closeModal(ocrDebugModal); });
}
if (ocrDebugModal) {
  ocrDebugModal.addEventListener('click', (e) => {
    if (e.target === ocrDebugModal) closeModal(ocrDebugModal);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal(termsModal);
    closeModal(manifestModal);
    closeModal(lightboxModal);
    closeModal(ocrDebugModal);
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