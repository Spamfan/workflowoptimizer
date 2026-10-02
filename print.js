// Prototype Crimson - print.js (v0.1.13)
// Print Likely EDLP Price Engine

export const PRINT_VERSION = "v0.1.13";

let sessionCatalogCache = null;

async function fetchStatsCatalog() {
  try {
    const res = await fetch('./stats.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    sessionCatalogCache = data;
    return data;
  } catch (err) {
    if (sessionCatalogCache) return sessionCatalogCache;
    throw err;
  }
}

let activeStore = '';
let shiftComment = '';
let isCarriedOver = false;
let isDocumentEdited = false;
let catalogData = null;
let hiddenItemKeys = new Set();
let manualHighlights = {}; // key -> 'partial' | 'full'
let priceOverrides = {}; // key -> price string

let isDrawerOpen = false;

// 50-Step In-Memory Undo / Redo History Stack
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

function pushHistoryState() {
  const state = {
    hidden: Array.from(hiddenItemKeys),
    highlights: { ...manualHighlights },
    prices: { ...priceOverrides },
    comment: shiftComment,
    isEdited: isDocumentEdited,
    isCarriedOver: isCarriedOver
  };

  if (historyIndex < historyStack.length - 1) {
    historyStack = historyStack.slice(0, historyIndex + 1);
  }

  historyStack.push(JSON.stringify(state));
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  }
  historyIndex = historyStack.length - 1;
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const btnUndo = document.getElementById('btn-print-undo');
  const btnRedo = document.getElementById('btn-print-redo');
  if (btnUndo) btnUndo.disabled = (historyIndex <= 0);
  if (btnRedo) btnRedo.disabled = (historyIndex >= historyStack.length - 1);
}

export function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    applyHistoryState(JSON.parse(historyStack[historyIndex]));
  }
}

export function redo() {
  if (historyIndex < historyStack.length - 1) {
    historyIndex++;
    applyHistoryState(JSON.parse(historyStack[historyIndex]));
  }
}

function applyHistoryState(state) {
  hiddenItemKeys = new Set(state.hidden || []);
  manualHighlights = state.highlights || {};
  priceOverrides = state.prices || {};
  shiftComment = state.comment || '';
  isDocumentEdited = Boolean(state.isEdited);
  isCarriedOver = Boolean(state.isCarriedOver);

  saveSessionOverrides();
  renderPrintDocument(false);
  updateHistoryButtons();
}

const STORAGE_OVERRIDE_KEY = 'wfo_price_sheet_state';
const STORAGE_COMMENT_KEY = 'wfo_saved_comment';

function saveSessionOverrides() {
  try {
    const payload = {
      hidden: Array.from(hiddenItemKeys),
      highlights: manualHighlights,
      prices: priceOverrides,
      comment: shiftComment,
      isEdited: isDocumentEdited,
      isCarriedOver: isCarriedOver
    };
    localStorage.setItem(STORAGE_OVERRIDE_KEY, JSON.stringify(payload));
    if (shiftComment) {
      localStorage.setItem(STORAGE_COMMENT_KEY, shiftComment);
    } else {
      localStorage.removeItem(STORAGE_COMMENT_KEY);
    }
  } catch (_) {}
}

function loadSessionOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_OVERRIDE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      hiddenItemKeys = new Set(p.hidden || []);
      manualHighlights = p.highlights || {};
      priceOverrides = p.prices || {};
      shiftComment = p.comment || '';
      isDocumentEdited = Boolean(p.isEdited);
      isCarriedOver = Boolean(p.isCarriedOver);
      return true;
    }
    const savedComment = localStorage.getItem(STORAGE_COMMENT_KEY);
    if (savedComment) {
      shiftComment = savedComment;
      isCarriedOver = true;
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function clearSessionOverrides() {
  try {
    localStorage.removeItem(STORAGE_OVERRIDE_KEY);
    localStorage.removeItem(STORAGE_COMMENT_KEY);
  } catch (_) {}
}

function getAttPrice(dev) {
  if (!dev || dev.attMO === null || dev.attMO === undefined || dev.attMO === 0) return null;
  const total = Math.round(dev.attMO * 36);
  return `${total}`;
}

function getVzwPrice(dev) {
  if (!dev || dev.vzwMO === null || dev.vzwMO === undefined || dev.vzwMO === 0) return null;
  const total = Math.round(dev.vzwMO * 36);
  return `${total}`;
}

function getTmoPrice(dev) {
  if (!dev) return null;
  const dp = dev.tmoDP;
  const mo = dev.tmoMOADP !== null && dev.tmoMOADP !== undefined ? dev.tmoMOADP : dev.tmoMO;
  const hasDP = dp !== null && dp !== undefined;
  const hasMO = mo !== null && mo !== undefined;
  const hasBaseMO = dev.tmoMO !== null && dev.tmoMO !== undefined;

  if (!hasDP && !hasMO && !hasBaseMO) return null;
  if ((dp === 0 || !hasDP) && (mo === 0 || !hasMO) && (dev.tmoMO === 0 || !hasBaseMO)) return null;

  let total = 0;
  if (dev.tmoMO) {
    total = Math.round(dev.tmoMO * 24);
  } else if (hasDP || hasMO) {
    total = Math.round((dp || 0) + (mo || 0) * 24);
  }
  const dpStr = hasDP ? `${dp}` : '$___';
  const moStr = hasMO ? `${mo}` : '$___';
  return `${total} (${dpStr} + ${moStr}/mo)`;
}

const DEFAULT_VISIBLE_KEYS = {
  att: new Set(['classic', 'galaxya175g', 'galaxya235g', 'galaxys25plus5g', 'galaxys25ultra5g', 'galaxys26fe5g', 'galaxys26ultra5g', 'motog5g2026', 'motogpower2026', 'motogstylus2025', 'motogstylus2026']),
  vzw: new Set(['galaxya175g', 'galaxys26fe5g', 'galaxys26ultra5g', 'motog5g2026', 'motogplay2026', 'motogpower2026', 'motogstylus2026', 'tclflip3']),
  tmo: new Set(['flip45g', 'galaxya175g', 'motog5g2026', 'motogplay2026']),
  apple: new Set(['iphone17', 'iphone17pro', 'iphone17promax', 'iphone17e', 'iphone18pro', 'iphone18promax', 'iphoneair'])
};

function applyDefaultVisibleKeys(catalog) {
  hiddenItemKeys.clear();
  const devices = (catalog && catalog.devices) ? catalog.devices : {};

  for (const [key, dev] of Object.entries(devices)) {
    const displayName = dev.abbr || dev.name || key;
    const fullName = (dev?.name || displayName || '').toLowerCase();
    const abbr = (dev?.abbr || '').toLowerCase();
    const isApple = fullName.includes('iphone') || fullName.includes('somm') || abbr.startsWith('ip') || abbr.startsWith('se');

    if (isApple) {
      const uid = `apple_${key}`;
      if ((getAttPrice(dev) || getVzwPrice(dev) || getTmoPrice(dev)) && !DEFAULT_VISIBLE_KEYS.apple.has(key)) {
        hiddenItemKeys.add(uid);
      }
    } else {
      if (getAttPrice(dev) && !DEFAULT_VISIBLE_KEYS.att.has(key)) {
        hiddenItemKeys.add(`att_${key}`);
      }
      if (getVzwPrice(dev) && !DEFAULT_VISIBLE_KEYS.vzw.has(key)) {
        hiddenItemKeys.add(`vzw_${key}`);
      }
      if (getTmoPrice(dev) && !DEFAULT_VISIBLE_KEYS.tmo.has(key)) {
        hiddenItemKeys.add(`tmo_${key}`);
      }
    }
  }
}

// Global Keydown Handler for Undo / Redo in Print View
window.addEventListener('keydown', (e) => {
  const printView = document.getElementById('print-view');
  if (!printView || printView.style.display === 'none') return;

  const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
  const isRedo = (e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey));

  if (isUndo) {
    if (e.target && e.target.id === 'print-comment-editor') {
      return; // allow contenteditable native undo
    }
    e.preventDefault();
    undo();
  } else if (isRedo) {
    if (e.target && e.target.id === 'print-comment-editor') {
      return;
    }
    e.preventDefault();
    redo();
  }
});

// View Initializer
export function initPrintEngine() {
  const btnPrintReset = document.getElementById('btn-print-reset');
  const btnPrintSheet = document.getElementById('btn-print-sheet');
  const btnPrintUndo = document.getElementById('btn-print-undo');
  const btnPrintRedo = document.getElementById('btn-print-redo');
  const btnToggleDrawer = document.getElementById('btn-toggle-other-devices');
  const drawerTabBtn = document.getElementById('drawer-tab-btn');
  const resetModal = document.getElementById('print-reset-modal');
  const btnResetCancel = document.getElementById('btn-reset-cancel');
  const btnResetConfirm = document.getElementById('btn-reset-confirm');

  if (btnPrintReset) {
    btnPrintReset.addEventListener('click', () => {
      if (resetModal) resetModal.style.display = 'flex';
    });
  }

  if (resetModal) {
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) {
        resetModal.style.display = 'none';
      }
    });
  }

  if (btnResetCancel) {
    btnResetCancel.addEventListener('click', () => {
      if (resetModal) resetModal.style.display = 'none';
    });
  }

  if (btnResetConfirm) {
    btnResetConfirm.addEventListener('click', () => {
      hiddenItemKeys.clear();
      manualHighlights = {};
      priceOverrides = {};
      shiftComment = '';
      isCarriedOver = false;
      isDocumentEdited = false;
      clearSessionOverrides();
      applyDefaultVisibleKeys(catalogData);
      if (resetModal) resetModal.style.display = 'none';
      pushHistoryState();
      renderPrintDocument();
    });
  }

  if (btnToggleDrawer) {
    btnToggleDrawer.addEventListener('click', toggleDrawer);
  }

  if (drawerTabBtn) {
    drawerTabBtn.addEventListener('click', toggleDrawer);
  }

  if (btnPrintUndo) {
    btnPrintUndo.addEventListener('click', undo);
  }

  if (btnPrintRedo) {
    btnPrintRedo.addEventListener('click', redo);
  }

  if (btnPrintSheet) {
    btnPrintSheet.addEventListener('click', triggerSilentPrint);
  }
}

function toggleDrawer() {
  isDrawerOpen = !isDrawerOpen;
  syncDrawerUI();
}

function syncDrawerUI() {
  const drawer = document.getElementById('other-devices-drawer');
  const toggleBtn = document.getElementById('btn-toggle-other-devices');

  if (drawer) {
    if (isDrawerOpen) {
      drawer.classList.remove('collapsed');
    } else {
      drawer.classList.add('collapsed');
    }
  }

  if (toggleBtn) {
    toggleBtn.textContent = isDrawerOpen ? 'Hide other devices' : 'Show other devices';
  }
}

export async function openPrintPreview(storeNum, storeSecret = '') {
  activeStore = storeNum || '';
  isDocumentEdited = false;
  hiddenItemKeys.clear();
  manualHighlights = {};
  priceOverrides = {};
  historyStack = [];
  historyIndex = -1;

  const hasSavedOverrides = loadSessionOverrides();

  const sheetContainer = document.getElementById('print-preview-sheet');
  if (sheetContainer) {
    sheetContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-sub, #606770);">Loading device catalog...</div>';
  }

  try {
    catalogData = await fetchStatsCatalog();
  } catch (err) {
    console.error("Failed to load catalog for print preview:", err);
    if (sheetContainer) {
      sheetContainer.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger, #d93025);">Failed to load device catalog: ${err.message || err}</div>`;
    }
    return;
  }

  if (!hasSavedOverrides) {
    applyDefaultVisibleKeys(catalogData);
  }

  pushHistoryState();
  renderPrintDocument();
}

export function renderPrintDocument(pushToHistory = true) {
  const sheet = document.getElementById('print-preview-sheet');
  if (!sheet) return;

  const devicesObj = (catalogData && catalogData.devices) ? catalogData.devices : {};

  const isVaporized = (dev, name) => /iPhone\s*(11|12|13)(?!\d)/i.test(dev?.name || name);
  const isAppleDevice = (dev, name) => {
    const fullName = (dev?.name || name || '').toLowerCase();
    const abbr = (dev?.abbr || '').toLowerCase();
    return fullName.includes('iphone') || fullName.includes('somm') || abbr.startsWith('ip') || abbr.startsWith('se');
  };

  const attList = [];
  const vzwList = [];
  const tmoList = [];
  const appleList = [];
  const hiddenSummary = { att: [], vzw: [], tmo: [], apple: [] };
  const hiddenDrawerItems = { att: [], vzw: [], tmo: [], apple: [] };

  for (const [key, dev] of Object.entries(devicesObj)) {
    const displayName = dev.abbr || dev.name || key;
    if (isVaporized(dev, displayName)) continue;

    if (isAppleDevice(dev, displayName)) {
      const pAtt = getAttPrice(dev);
      const pVzw = getVzwPrice(dev);
      const pTmo = getTmoPrice(dev);

      if (pAtt || pVzw || pTmo) {
        const uid = `apple_${key}`;
        const itemObj = { uid, model: displayName, intakeName: dev.name || displayName, dev, pAtt, pVzw, pTmo };
        if (hiddenItemKeys.has(uid)) {
          hiddenSummary.apple.push(displayName);
          hiddenDrawerItems.apple.push(itemObj);
        } else {
          appleList.push(itemObj);
        }
      }
      continue;
    }

    const pAtt = getAttPrice(dev);
    if (pAtt) {
      const uid = `att_${key}`;
      const itemObj = { uid, model: displayName, intakeName: dev.name || displayName, dev };
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.att.push(displayName);
        hiddenDrawerItems.att.push(itemObj);
      } else {
        attList.push(itemObj);
      }
    }

    const pVzw = getVzwPrice(dev);
    if (pVzw) {
      const uid = `vzw_${key}`;
      const itemObj = { uid, model: displayName, intakeName: dev.name || displayName, dev };
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.vzw.push(displayName);
        hiddenDrawerItems.vzw.push(itemObj);
      } else {
        vzwList.push(itemObj);
      }
    }

    const pTmo = getTmoPrice(dev);
    if (pTmo) {
      const uid = `tmo_${key}`;
      const itemObj = { uid, model: displayName, intakeName: dev.name || displayName, dev };
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.tmo.push(displayName);
        hiddenDrawerItems.tmo.push(itemObj);
      } else {
        tmoList.push(itemObj);
      }
    }
  }

  const sortAlpha = (a, b) => a.intakeName.localeCompare(b.intakeName);
  attList.sort(sortAlpha);
  vzwList.sort(sortAlpha);
  tmoList.sort(sortAlpha);
  appleList.sort(sortAlpha);

  hiddenDrawerItems.att.sort(sortAlpha);
  hiddenDrawerItems.vzw.sort(sortAlpha);
  hiddenDrawerItems.tmo.sort(sortAlpha);
  hiddenDrawerItems.apple.sort(sortAlpha);

  const renderRows = (list, carrierType) => {
    if (list.length === 0) {
      return `<tr><td colspan="2" style="color: #888; font-style: italic; padding: 4px 0;">No items</td></tr>`;
    }

    return list.map(item => {
      const hlClass = manualHighlights[item.uid] === 'full'
        ? 'hl-full'
        : (manualHighlights[item.uid] === 'partial' ? 'hl-partial' : '');

      let priceCell = '';
      if (priceOverrides[item.uid]) {
        priceCell = priceOverrides[item.uid];
      } else if (carrierType === 'att') {
        priceCell = getAttPrice(item.dev) || '___';
      } else if (carrierType === 'vzw') {
        priceCell = getVzwPrice(item.dev) || '___';
      } else if (carrierType === 'tmo') {
        priceCell = getTmoPrice(item.dev) || '$___ ($___ + $___/mo)';
      } else if (carrierType === 'apple') {
        const pAtt = item.pAtt || '$___';
        const pVzw = item.pVzw || '$___';
        const pTmo = item.pTmo || '$___ ($___ + $___/mo)';
        priceCell = `${pAtt}, ${pVzw}, ${pTmo}`;
      }

      return `
        <tr class="print-row ${hlClass}" data-uid="${item.uid}">
          <td class="col-item tap-item" data-uid="${item.uid}" data-model="${item.model}" title="Click to highlight, right-click to move to other">${item.model}</td>
          <td class="col-price tap-price" data-uid="${item.uid}" title="Tap to override price">${priceCell}</td>
        </tr>
      `;
    }).join('');
  };

  const hasManualOverrides = Object.keys(priceOverrides).length > 0;
  const showEditedNotice = isDocumentEdited && hasManualOverrides;

  sheet.innerHTML = `
    <div class="print-doc-header">
      <div class="print-doc-title">Recent EDLP Reports (internal use only)</div>
      <div class="print-doc-disclaimer">This software is in early development and may make mistakes; always verify pricing first in ESP.</div>

      <!-- In-Document Comments Box (WYSIWYG) -->
      <div class="print-comment-container" id="print-comment-container">
        ${isCarriedOver && shiftComment ? `
          <div class="comment-carryover-badge" id="comment-carryover-badge">
            Previous report comments saved • <span class="comment-carryover-clear" id="btn-clear-comment">Clear</span>
          </div>
        ` : ''}
        <div id="print-comment-editor" class="print-comment-editor" contenteditable="true" data-placeholder="You can type comments for today's report here...">${shiftComment || ''}</div>
        <div id="rt-toolbar" class="rt-toolbar" style="display: none;">
          <button type="button" class="rt-btn" data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>
          <button type="button" class="rt-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>
          <button type="button" class="rt-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>
        </div>
      </div>
    </div>

    <div class="print-doc-body">
      <div class="print-col print-col-left">
        <div class="print-section">
          <div class="print-section-header">AT&T</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">Device name</th>
                <th class="col-price">Likely EDLPs</th>
              </tr>
            </thead>
            <tbody>${renderRows(attList, 'att')}</tbody>
          </table>
        </div>

        <div class="print-section">
          <div class="print-section-header">Verizon Wireless</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">Device name</th>
                <th class="col-price">Likely EDLPs</th>
              </tr>
            </thead>
            <tbody>${renderRows(vzwList, 'vzw')}</tbody>
          </table>
        </div>
      </div>

      <div class="print-col print-col-right">
        <div class="print-section">
          <table class="print-table">
            <thead>
              <tr class="header-carrier-row">
                <th class="col-item section-title">T-Mobile</th>
                <th class="col-price section-subtitle">Likely</th>
              </tr>
              <tr>
                <th class="col-item">Device name</th>
                <th class="col-price">EDLPs (dp + /mo)</th>
              </tr>
            </thead>
            <tbody>${renderRows(tmoList, 'tmo')}</tbody>
          </table>
        </div>

        <div class="print-section">
          <table class="print-table apple-table">
            <thead>
              <tr class="header-carrier-row">
                <th class="col-item section-title">Apple Devices</th>
                <th class="col-price section-subtitle">Likely EDLPs:</th>
              </tr>
              <tr>
                <th class="col-item">Device name</th>
                <th class="col-price">ATT, VZW, TMO (dp + /mo)</th>
              </tr>
            </thead>
            <tbody>${renderRows(appleList, 'apple')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="print-doc-footer">
      ${showEditedNotice ? '<div class="footer-audit-notice">[This document was edited from the original]</div>' : ''}
    </div>
  `;

  attachCommentEditorListeners();
  renderOtherDevicesDrawer(hiddenDrawerItems);

  sheet.querySelectorAll('.tap-price').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = td.dataset.uid;
      const currentVal = td.textContent.trim();
      const newVal = prompt('Override Price:', currentVal);
      if (newVal !== null) {
        if (newVal.trim() === '') {
          delete priceOverrides[uid];
        } else {
          priceOverrides[uid] = newVal.trim();
        }
        isDocumentEdited = true;
        saveSessionOverrides();
        pushHistoryState();
        renderPrintDocument();
      }
    });
  });

  sheet.querySelectorAll('.tap-item').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = td.dataset.uid;
      const cur = manualHighlights[uid];
      if (!cur) manualHighlights[uid] = 'partial';
      else if (cur === 'partial') manualHighlights[uid] = 'full';
      else delete manualHighlights[uid];
      isDocumentEdited = true;
      saveSessionOverrides();
      pushHistoryState();
      renderPrintDocument();
    });

    td.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const uid = td.dataset.uid;
      const modelName = td.dataset.model || td.textContent.trim();
      hiddenItemKeys.add(uid);
      isDocumentEdited = true;
      saveSessionOverrides();
      pushHistoryState();
      renderPrintDocument();
      spawnHideToast(modelName);
    });

    let touchTimer = null;
    td.addEventListener('touchstart', () => {
      touchTimer = setTimeout(() => {
        touchTimer = null;
        const uid = td.dataset.uid;
        const modelName = td.dataset.model || td.textContent.trim();
        hiddenItemKeys.add(uid);
        isDocumentEdited = true;
        saveSessionOverrides();
        pushHistoryState();
        renderPrintDocument();
        spawnHideToast(modelName);
      }, 500);
    }, { passive: true });
    td.addEventListener('touchend', () => {
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });
    td.addEventListener('touchmove', () => {
      if (touchTimer) clearTimeout(touchTimer);
    }, { passive: true });
  });

  updateHistoryButtons();
  syncDrawerUI();
}

function renderOtherDevicesDrawer(hiddenGroups) {
  const carriersContainer = document.getElementById('drawer-carriers-container');
  const countBadge = document.getElementById('drawer-hidden-count');
  if (!carriersContainer) return;

  const totalHidden = hiddenGroups.att.length + hiddenGroups.vzw.length + hiddenGroups.tmo.length + hiddenGroups.apple.length;
  if (countBadge) countBadge.textContent = String(totalHidden);

  if (totalHidden === 0) {
    carriersContainer.innerHTML = '<div class="drawer-empty-notice">All available catalog devices are currently on your report.</div>';
    return;
  }

  const sectionsConfig = [
    { label: 'AT&T', list: hiddenGroups.att },
    { label: 'Verizon', list: hiddenGroups.vzw },
    { label: 'T-Mobile', list: hiddenGroups.tmo },
    { label: 'Apple Devices', list: hiddenGroups.apple }
  ];

  let html = '';
  sectionsConfig.forEach(sec => {
    if (sec.list && sec.list.length > 0) {
      html += `
        <div class="drawer-carrier-section">
          <div class="drawer-carrier-title">${sec.label}</div>
          <div class="drawer-items-list">
            ${sec.list.map(item => `
              <div class="drawer-item-chip" data-uid="${item.uid}" title="Click to put back on report">
                <span>${item.model}</span>
                <span style="font-size: 0.8rem; color: var(--primary);">+ Add</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });

  carriersContainer.innerHTML = html;

  carriersContainer.querySelectorAll('.drawer-item-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const uid = chip.dataset.uid;
      if (uid && hiddenItemKeys.has(uid)) {
        hiddenItemKeys.delete(uid);
        isDocumentEdited = true;
        saveSessionOverrides();
        pushHistoryState();
        renderPrintDocument();
      }
    });
  });
}

function spawnHideToast(deviceName) {
  const container = document.getElementById('print-toast-container');
  if (!container) return;

  while (container.children.length >= 5) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = 'print-toast';
  toast.innerHTML = `
    <span>Hidden <b>${escapeHtml(deviceName)}</b></span>
    <button type="button" class="btn-toast-undo">Undo</button>
  `;

  const btnUndo = toast.querySelector('.btn-toast-undo');
  if (btnUndo) {
    btnUndo.addEventListener('click', (e) => {
      e.stopPropagation();
      undo();
      toast.remove();
    });
  }

  let touchStartX = 0;
  toast.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) {
      touchStartX = e.touches[0].clientX;
    }
  }, { passive: true });

  toast.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 40) {
        toast.classList.add('dismissing');
        setTimeout(() => { toast.remove(); }, 200);
      }
    }
  }, { passive: true });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('dismissing');
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 200);
    }
  }, 3000);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attachCommentEditorListeners() {
  const container = document.getElementById('print-comment-container');
  const editor = document.getElementById('print-comment-editor');
  const toolbar = document.getElementById('rt-toolbar');
  const btnClear = document.getElementById('btn-clear-comment');
  const carryoverBadge = document.getElementById('comment-carryover-badge');

  if (!editor || !toolbar) return;

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  if (btnClear) {
    btnClear.addEventListener('click', (e) => {
      e.preventDefault();
      editor.innerHTML = '';
      shiftComment = '';
      isCarriedOver = false;
      if (carryoverBadge) carryoverBadge.style.display = 'none';
      saveSessionOverrides();
      pushHistoryState();
    });
  }

  const updateToolbarPosition = () => {
    if (isTouchDevice) {
      toolbar.classList.add('mobile-docked');
      toolbar.style.display = 'flex';
      if (window.visualViewport) {
        const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
        toolbar.style.bottom = `${offset}px`;
      }
      return;
    }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editor.contains(sel.anchorNode)) {
      toolbar.style.display = 'none';
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    toolbar.classList.remove('mobile-docked');
    toolbar.style.display = 'flex';

    const top = rect.top - containerRect.top - 38;
    const left = Math.max(0, rect.left - containerRect.left + (rect.width / 2) - 60);

    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
  };

  editor.addEventListener('focus', () => {
    if (isTouchDevice) {
      toolbar.classList.add('mobile-docked');
      toolbar.style.display = 'flex';
      if (window.visualViewport) {
        const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
        toolbar.style.bottom = `${offset}px`;
      }
    }
  });

  if (isTouchDevice && window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateToolbarPosition);
    window.visualViewport.addEventListener('scroll', updateToolbarPosition);
  }

  editor.addEventListener('blur', () => {
    setTimeout(() => {
      if (!isTouchDevice) {
        toolbar.style.display = 'none';
      }
    }, 250);
  });

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode && editor.contains(sel.anchorNode)) {
      updateToolbarPosition();
      updateButtonStates();
    } else if (!isTouchDevice && toolbar.style.display !== 'none') {
      toolbar.style.display = 'none';
    }
  });

  function updateButtonStates() {
    toolbar.querySelectorAll('.rt-btn').forEach(btn => {
      const cmd = btn.dataset.cmd;
      if (cmd && document.queryCommandState && document.queryCommandState(cmd)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  toolbar.querySelectorAll('.rt-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd) {
        document.execCommand(cmd, false, null);
        shiftComment = editor.innerHTML;
        isDocumentEdited = true;
        isCarriedOver = false;
        if (carryoverBadge) carryoverBadge.style.display = 'none';
        saveSessionOverrides();
        pushHistoryState();
        updateButtonStates();
      }
    });
  });

  editor.addEventListener('input', () => {
    shiftComment = editor.innerHTML;
    isDocumentEdited = true;
    isCarriedOver = false;
    if (carryoverBadge) carryoverBadge.style.display = 'none';
    saveSessionOverrides();
  });

  editor.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false, null);
        updateButtonStates();
      } else if (key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false, null);
        updateButtonStates();
      } else if (key === 'u') {
        e.preventDefault();
        document.execCommand('underline', false, null);
        updateButtonStates();
      }
    }
  });
}

export function triggerSilentPrint() {
  const sheet = document.getElementById('print-preview-sheet');
  if (!sheet) return;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.print();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Likely EDLPs</title>
        <link rel="stylesheet" href="styles.css?v=0.1.9">
        <style>
          .print-row.is-hidden { display: none !important; }
          @page { size: letter portrait; margin: 0.35in 0.4in; }
          #print-preview-sheet {
            padding: 0.35in 0.4in !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
          }
        </style>
      </head>
      <body>
        <div id="print-preview-sheet" class="print-preview-sheet" style="border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important;">
          ${sheet.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => { iframe.remove(); }, 5000);
  }, 400);
}
