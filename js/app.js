// Prototype Blue - js/app.js (v0.0.18)
// Master Router, Unified View Coordinator & Lifecycle Controller

import { initAuth, getSavedStore, getSessionPin, logout, AUTH_VERSION } from './auth.js?v=0.0.5';
import { initPrintEngine, openPrintPreview, PRINT_VERSION } from './print.js?v=0.0.4';
import {
  startCamera,
  stopCamera,
  takePhotoFromCamera,
  loadFileToImage,
  initAdjuster,
  resetAdjuster,
  setAdjusterRotation,
  captureAdjustedFrame,
  SCANNER_VERSION
} from './scanner.js?v=0.0.12';
import { runOcrPipeline, getOcrTelemetry, OCR_VERSION } from './ocr.js?v=0.0.12';
import {
  getStagedData,
  getStagedInventoryPayload,
  commitScanToCarrier,
  updateStagedItem,
  deleteStagedItem,
  addStagedItem,
  clearAllStaged,
  clearCarrierStaged,
  getSessionMedia,
  getNextCarrier,
  STAGING_VERSION
} from './staging.js?v=0.0.5';
import {
  fetchCatalog,
  commitStoreInventory,
  getOfflineQueueCount,
  API_VERSION
} from './api.js?v=0.0.3';
import {
  getStoreKey,
  setStoreKey,
  generateStoreKey,
  hasStoreKey,
  CRYPTO_VERSION
} from './crypto.js?v=0.0.2';
import { renderCode128Svg, BARCODE_VERSION } from './barcode.js?v=0.0.1';

export const APP_VERSION = "v0.0.21";
export const MODULE_VERSIONS = {
  "Prototype Blue": APP_VERSION,
  "app.js": APP_VERSION,
  "barcode.js": BARCODE_VERSION,
  "crypto.js": CRYPTO_VERSION,
  "api.js": API_VERSION,
  "auth.js": AUTH_VERSION,
  "scanner.js": SCANNER_VERSION,
  "ocr.js": OCR_VERSION,
  "staging.js": STAGING_VERSION,
  "print.js": PRINT_VERSION,
  "styles.css": "v0.0.9",
  "index.html": "v0.0.10"
};

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const scannerView = document.getElementById('scanner-view');
const reviewView = document.getElementById('review-view');
const printView = document.getElementById('print-view');
const btnLogout = document.getElementById('btn-logout');
const btnBack = document.getElementById('btn-back');
const btnUploadInv = document.getElementById('btn-upload-inv');
const btnPrintInv = document.getElementById('btn-print-inv');
const btnClearStaged = document.getElementById('btn-clear-staged');
const cardPrintTitle = document.getElementById('card-print-title');
const versionText = document.getElementById('version-text');
if (versionText) versionText.textContent = `BLUE ${APP_VERSION}`;

let currentView = 'login-view';
let isAuthenticated = false;
let currentStore = '';
let currentStoreSecret = '';
let activeCarrier = 'tmo';
let cachedStats = null;
let scannerRotation = 0;
let latestFullCaptureUrl = null;

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
  const offlineCount = getOfflineQueueCount();

  if (total > 0) {
    btnViewStaged.textContent = `View Staged (${total})${offlineCount > 0 ? ` • ${offlineCount} Offline` : ''}`;
    btnViewStaged.style.display = 'inline-flex';
  } else if (offlineCount > 0) {
    btnViewStaged.textContent = `${offlineCount} Offline Pending`;
    btnViewStaged.style.display = 'inline-flex';
  } else {
    btnViewStaged.style.display = 'none';
  }
}

// Add Pair Device Button to Dashboard Card Actions Row
function ensurePairingButtonOnDashboard() {
  if (document.getElementById('btn-pair-device')) return;
  const targetContainer = document.querySelector('#dashboard-view .card-actions-row')
    || document.querySelector('#dashboard-view .dash-card .card-body')
    || document.querySelector('#dashboard-view .dash-card');

  if (targetContainer) {
    const btnPair = document.createElement('button');
    btnPair.id = 'btn-pair-device';
    btnPair.className = 'pill-btn btn-action-pair';
    btnPair.style.display = 'inline-flex';
    btnPair.textContent = '🔑 Store Key / Pair';
    btnPair.addEventListener('click', openPairingModal);
    targetContainer.appendChild(btnPair);
  }
}

export function switchView(targetViewId, pushState = true) {
  if (targetViewId !== 'scanner-view' && scannerVideo) {
    stopCamera(scannerVideo);
  }
  loginView.style.display = 'none';
  dashboardView.style.display = 'none';
  if (scannerView) scannerView.style.display = 'none';
  if (reviewView) reviewView.style.display = 'none';
  if (printView) printView.style.display = 'none';

  const targetEl = document.getElementById(targetViewId);
  if (targetEl) {
    targetEl.style.display = 'flex';
  }

  currentView = targetViewId;

  if (currentView === 'dashboard-view') {
    btnLogout.style.display = 'inline-flex';
    btnBack.style.display = 'none';
    ensurePairingButtonOnDashboard();
    updateDashboardStagedButton();
  } else if (currentView === 'scanner-view' || currentView === 'review-view' || currentView === 'print-view') {
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
    const data = await fetchCatalog();
    cachedStats = data;
    pingValueEl.textContent = data.ping !== undefined ? String(data.ping) : 'Connected.';
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

btnBack.addEventListener('click', () => {
  if (currentView === 'scanner-view' || currentView === 'review-view' || currentView === 'print-view') {
    switchView(isAuthenticated ? 'dashboard-view' : 'login-view');
  } else {
    switchView('login-view');
  }
});

initPrintEngine();

if (btnPrintInv) {
  btnPrintInv.addEventListener('click', () => {
    switchView('print-view');
    openPrintPreview(currentStore, getStoreKey(currentStore));
  });
}

async function openScanner() {
  exitCropMode();
  switchView('scanner-view');
  try {
    await startCamera(scannerVideo);
  } catch (err) {
    alert('Unable to access camera: ' + err.message);
  }
}

if (btnUploadInv) {
  btnUploadInv.addEventListener('click', openScanner);
}

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

if (btnScannerShutter) {
  btnScannerShutter.addEventListener('click', async () => {
    try {
      btnScannerShutter.disabled = true;
      const capture = await takePhotoFromCamera(scannerVideo, scannerRotation);
      handleCapturedImage(capture);
    } catch (err) {
      alert('Photo capture failed: ' + err.message);
    } finally {
      btnScannerShutter.disabled = false;
    }
  });
}

if (scannerFileInput) {
  scannerFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      enterCropMode(file);
    }
    scannerFileInput.value = '';
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

  const pageBadge = document.getElementById('review-page-badge');
  const pageCount = sheet.pageCount || (sheet.items && sheet.items.length > 0 ? 1 : 0);
  if (pageBadge) {
    if (pageCount > 0) {
      pageBadge.textContent = `Page ${pageCount}/5`;
      pageBadge.style.display = 'inline-block';
    } else {
      pageBadge.style.display = 'none';
    }
  }

  const media = getSessionMedia(carrierKey);
  if (media.thumb) {
    reviewMetaThumb.src = media.thumb;
    reviewMetaThumb.style.display = 'block';
  } else {
    reviewMetaThumb.style.display = 'none';
  }

  if (reviewLoadingState) reviewLoadingState.style.display = 'none';
  stagedItemsContainer.style.display = 'flex';
  if (btnAddItem) btnAddItem.style.display = 'inline-flex';
  if (btnClearStaged) btnClearStaged.style.display = 'inline-flex';

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

if (btnScanNext) {
  btnScanNext.addEventListener('click', openScanner);
}

if (btnClearStaged) {
  btnClearStaged.addEventListener('click', () => {
    if (confirm('Clear all staged scans for this store?')) {
      clearAllStaged(currentStore);
      renderReview(activeCarrier);
      updateDashboardStagedButton();
    }
  });
}

// Lightbox preview on thumbnail tap
if (reviewMetaThumb) {
  reviewMetaThumb.addEventListener('click', () => {
    const src = latestFullCaptureUrl || reviewMetaThumb.src;
    if (src) {
      lightboxImg.src = src;
      openModal(lightboxModal);
    }
  });
}

// Process captured frame through OCR and Staging

// Global hook for test presets and headless triggers
window.wfoHandleCapturedImage = handleCapturedImage;
window.addEventListener('wfo:test_image_loaded', (e) => {
  if (e.detail) {
    handleCapturedImage(e.detail);
  }
});

async function handleCapturedImage(captureResult) {
  latestFullCaptureUrl = captureResult.fullDataUrl;
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
  if (btnClearStaged) btnClearStaged.style.display = 'none';
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
    commitScanToCarrier(currentStore, activeCarrier, items, captureResult.thumbDataUrl, telem, "append");
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
const btnOcrCopyJson = document.getElementById('btn-ocr-copy-json');
const btnOcrDownloadImg = document.getElementById('btn-ocr-download-img');
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
    const media = getSessionMedia(activeCarrier);
    const telem = media.telemetry || getOcrTelemetry();

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

if (btnOcrCopyJson) {
  btnOcrCopyJson.addEventListener('click', async () => {
    const state = getStagedData(currentStore);
    const sheet = state.sheets[activeCarrier];
    const payload = {
      store: currentStore,
      carrier: activeCarrier,
      timestamp: (sheet && sheet.timestamp) || new Date().toISOString(),
      items: (sheet && sheet.items) || [],
      telemetry: (sheet && sheet.telemetry) || getOcrTelemetry()
    };
    const jsonText = JSON.stringify(payload, null, 2);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = jsonText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const origText = btnOcrCopyJson.textContent;
      btnOcrCopyJson.textContent = 'Copied!';
      setTimeout(() => { btnOcrCopyJson.textContent = origText; }, 2000);
    } catch (err) {
      alert('Failed to copy telemetry: ' + err.message);
    }
  });
}

if (btnOcrDownloadImg) {
  btnOcrDownloadImg.addEventListener('click', () => {
    const state = getStagedData(currentStore);
    const sheet = state.sheets[activeCarrier];
    const media = getSessionMedia(activeCarrier);
    const targetSrc = latestFullCaptureUrl || media.thumb;
    if (!targetSrc) {
      alert('No capture image available to download.');
      return;
    }
    const a = document.createElement('a');
    a.href = targetSrc;
    a.download = `wfo_scan_${currentStore || 'store'}_${activeCarrier}_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

// Store Key Pairing Modal & Code 128 Barcode Engine
function initPairingModal() {
  const modalEl = document.getElementById('pairing-modal');
  if (!modalEl) return null;

  if (modalEl.dataset.bound === 'true') {
    return modalEl;
  }
  modalEl.dataset.bound = 'true';

  // Backdrop click dismissal
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal(modalEl);
  });

  // Close button
  const btnClose = modalEl.querySelector('#btn-close-pairing-modal')
    || modalEl.querySelector('#btn-pairing-close')
    || modalEl.querySelector('.btn-close-modal')
    || modalEl.querySelector('.close');
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(modalEl);
    });
  }

  // Copy button
  const btnCopy = modalEl.querySelector('#btn-copy-pairing-code');
  if (btnCopy) {
    btnCopy.addEventListener('click', async (e) => {
      e.preventDefault();
      const textEl = modalEl.querySelector('#pairing-code-text');
      const code = textEl ? textEl.textContent.trim() : '';
      if (code && code !== 'UNPAIRED') {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
          } else {
            const ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          btnCopy.textContent = 'Copied!';
          setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
        } catch (_) {
          alert('Failed to copy code');
        }
      }
    });
  }

  // Save button & manual input
  const manualInput = modalEl.querySelector('#input-pairing-manual') || modalEl.querySelector('#pairing-input');
  const btnSave = modalEl.querySelector('#btn-save-pairing-manual')
    || modalEl.querySelector('#btn-save-pairing-key')
    || modalEl.querySelector('#btn-pairing-save');
  const statusMsg = modalEl.querySelector('#pairing-status-msg');

  const handleSaveKey = () => {
    if (!manualInput) return;
    const val = manualInput.value.trim();
    if (!val) return;
    setStoreKey(currentStore, val);
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#10b981';
      statusMsg.textContent = '✓ Store Key saved successfully!';
      setTimeout(() => {
        closeModal(modalEl);
        statusMsg.style.display = 'none';
      }, 1200);
    }
    refreshPairingDisplay();
  };

  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      handleSaveKey();
    });
  }
  if (manualInput) {
    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveKey();
      }
    });
  }

  // Generate New Key button
  const btnGen = modalEl.querySelector('#btn-generate-new-key');
  if (btnGen) {
    btnGen.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm(`Generate a brand new Store Key for Store ${currentStore || '--'}?\n\nWarning: All other devices at this store will need to scan this new barcode to decrypt future reports.`)) {
        const freshKey = generateStoreKey();
        setStoreKey(currentStore, freshKey);
        refreshPairingDisplay();
      }
    });
  }

  return modalEl;
}

function refreshPairingDisplay() {
  const modalEl = initPairingModal();
  const key = getStoreKey(currentStore);

  const barcodeContainer = modalEl.querySelector('#pairing-barcode-container');
  const codeText = modalEl.querySelector('#pairing-code-text');
  const manualInput = modalEl.querySelector('#input-pairing-manual');
  const btnCopy = modalEl.querySelector('#btn-copy-pairing-code');

  if (manualInput) manualInput.value = '';

  if (key) {
    if (codeText) {
      codeText.textContent = key;
      codeText.style.color = '#111827';
    }
    if (btnCopy) btnCopy.disabled = false;
    if (barcodeContainer) {
      barcodeContainer.innerHTML = renderCode128Svg(key, { barWidth: 2.2, height: 80, quietZone: 25 });
    }
  } else {
    if (codeText) {
      codeText.textContent = 'UNPAIRED';
      codeText.style.color = '#dc2626';
    }
    if (btnCopy) btnCopy.disabled = true;
    if (barcodeContainer) {
      barcodeContainer.innerHTML = `
        <div style="padding: 20px; color: #dc2626; font-size: 0.85rem; line-height: 1.4;">
          <strong>⚠️ Terminal Not Paired</strong><br>
          <span style="color: #6b7280; font-size: 0.78rem;">
            No Store Key enrolled for Store ${currentStore || '--'}.<br>
            Scan barcode from your paired mobile phone or enter key below.
          </span>
        </div>
      `;
    }
  }
}

export function openPairingModal() {
  refreshPairingDisplay();
  const modalEl = document.getElementById('pairing-modal');
  openModal(modalEl);
  const input = modalEl.querySelector('#input-pairing-manual');
  if (input) setTimeout(() => input.focus(), 150);
}

// GitHub REST API Publish Engine (stocks.json with AES-GCM Encryption)
const patModal = document.getElementById('pat-modal');
const patInput = document.getElementById('pat-input');
const btnPatCancel = document.getElementById('btn-pat-cancel');
const btnPatSave = document.getElementById('btn-pat-save');

async function publishAllToGitHub() {
  const inventoryPayload = getStagedInventoryPayload(currentStore);
  const totalItems = Object.values(inventoryPayload).reduce((sum, list) => sum + list.length, 0);

  if (totalItems === 0) {
    alert('No staged items to publish.');
    return;
  }

  const pat = localStorage.getItem('wfo_admin_pat') || '';
  if (!pat) {
    if (patInput) patInput.value = '';
    openModal(patModal);
    return;
  }

  if (btnPublishAll) {
    btnPublishAll.disabled = true;
    btnPublishAll.textContent = 'Encrypting & Publishing...';
  }

  try {
    const storeKey = getStoreKey(currentStore);
    if (!storeKey) {
      openPairingModal();
      throw new Error(`Store Key missing for Store ${currentStore}. Please pair device.`);
    }

    const res = await commitStoreInventory({
      storeNum: currentStore,
      inventoryObj: inventoryPayload,
      pat,
      storeSecret: storeKey,
      encrypt: true
    });

    alert(`Success: ${res.message}`);
    clearAllStaged(currentStore);
    renderReview(activeCarrier);
    updateDashboardStagedButton();
  } catch (err) {
    alert('Publish status: ' + err.message);
    if (err.message.includes('Invalid or expired GitHub Personal Access Token')) {
      if (patInput) patInput.value = '';
      openModal(patModal);
    }
  } finally {
    if (btnPublishAll) {
      btnPublishAll.disabled = false;
      btnPublishAll.textContent = 'Publish All';
    }
  }
}

if (btnPublishAll) {
  btnPublishAll.addEventListener('click', publishAllToGitHub);
}

if (btnPatCancel) {
  btnPatCancel.addEventListener('click', () => { closeModal(patModal); });
}
if (patModal) {
  patModal.addEventListener('click', (e) => {
    if (e.target === patModal) closeModal(patModal);
  });
}
if (btnPatSave) {
  btnPatSave.addEventListener('click', () => {
    const val = patInput ? patInput.value.trim() : '';
    if (!val) {
      alert('Please enter a valid GitHub token.');
      return;
    }
    localStorage.setItem('wfo_admin_pat', val);
    closeModal(patModal);
    publishAllToGitHub();
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal(termsModal);
    closeModal(manifestModal);
    closeModal(lightboxModal);
    closeModal(ocrDebugModal);
    closeModal(patModal);
    const pairModal = document.getElementById('pairing-modal');
    if (pairModal) closeModal(pairModal);
  }
});

// Bootstrap
initAuth({
  onSuccess: (storeVal, pinVal) => {
    isAuthenticated = true;
    currentStore = storeVal;
    currentStoreSecret = pinVal;
    cardPrintTitle.textContent = `Print inventory (${storeVal})`;
    ensurePairingButtonOnDashboard();
    switchView('dashboard-view');
    fetchPing();
  }
});

switchView('login-view');
