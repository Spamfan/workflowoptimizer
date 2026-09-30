// Prototype Crimson - js/print.js (v0.1.6)
// Print Likely EDLP Price Engine

export const PRINT_VERSION = "v0.1.6";

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

// 10-Step In-Memory Undo / Redo History Stack
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 10;

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

const getLocalOverrideKey = (store) => `wfo_price_sheet_hidden_${store || 'default'}`;
const getLocalCommentKey = (store) => `wfo_saved_comment_${store || 'default'}`;

function saveSessionOverrides() {
  if (!activeStore) return;
  try {
    const payload = {
      hidden: Array.from(hiddenItemKeys),
      highlights: manualHighlights,
      prices: priceOverrides,
      comment: shiftComment,
      isEdited: isDocumentEdited,
      isCarriedOver: isCarriedOver
    };
    localStorage.setItem(getLocalOverrideKey(activeStore), JSON.stringify(payload));
    if (shiftComment) {
      localStorage.setItem(getLocalCommentKey(activeStore), shiftComment);
    } else {
      localStorage.removeItem(getLocalCommentKey(activeStore));
    }
  } catch (_) {}
}

function loadSessionOverrides(store) {
  try {
    const raw = localStorage.getItem(getLocalOverrideKey(store));
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
    // Fallback: check persistent localStorage for comments
    const savedComment = localStorage.getItem(getLocalCommentKey(store));
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

function clearSessionOverrides(store) {
  try {
    localStorage.removeItem(getLocalOverrideKey(store));
    localStorage.removeItem(getLocalCommentKey(store));
  } catch (_) {}
}

// Pricing Formatters
function getAttPrice(dev) {
  if (!dev || dev.attMO === null || dev.attMO === undefined || dev.attMO === 0) return null;
  return '$' + Math.round(dev.attMO * 36);
}

function getVzwPrice(dev) {
  if (!dev || dev.vzwMO === null || dev.vzwMO === undefined || dev.vzwMO === 0) return null;
  return '$' + Math.round(dev.vzwMO * 36);
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
  return `$${total} ($${dp ?? '___'} + $${mo ?? '___'}/mo)`;
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

  if (btnPrintReset) {
    btnPrintReset.addEventListener('click', () => {
      hiddenItemKeys.clear();
      manualHighlights = {};
      priceOverrides = {};
      shiftComment = '';
      isCarriedOver = false;
      isDocumentEdited = false;
      clearSessionOverrides(activeStore);
      pushHistoryState();
      renderPrintDocument();
    });
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

export async function openPrintPreview(storeNum, storeSecret = '') {
  activeStore = storeNum || '';
  isDocumentEdited = false;
  hiddenItemKeys.clear();
  manualHighlights = {};
  priceOverrides = {};
  historyStack = [];
  historyIndex = -1;

  loadSessionOverrides(activeStore);

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

  pushHistoryState();
  renderPrintDocument();
}

export function renderPrintDocument(pushToHistory = true) {
  const sheet = document.getElementById('print-preview-sheet');
  if (!sheet) return;

  const devicesObj = (catalogData && catalogData.devices) ? catalogData.devices : {};

  const isVaporized = (model) => /iPhone\s*(11|12|13)(?!\d)/i.test(model);
  const isApple = (model) => /iPhone|Apple Watch|AW\b/i.test(model);

  const attList = [];
  const vzwList = [];
  const tmoList = [];
  const appleList = [];
  const hiddenSummary = { att: [], vzw: [], tmo: [], apple: [] };

  for (const [key, dev] of Object.entries(devicesObj)) {
    const displayName = dev.abbr || dev.name || key;
    if (isVaporized(displayName)) continue;

    if (isApple(displayName)) {
      const pAtt = getAttPrice(dev);
      const pVzw = getVzwPrice(dev);
      const pTmo = getTmoPrice(dev);

      if (pAtt || pVzw || pTmo) {
        const uid = `apple_${key}`;
        if (hiddenItemKeys.has(uid)) {
          hiddenSummary.apple.push(displayName);
        }
        appleList.push({
          uid,
          model: displayName,
          intakeName: dev.name || displayName,
          dev,
          pAtt,
          pVzw,
          pTmo
        });
      }
      continue;
    }

    const pAtt = getAttPrice(dev);
    if (pAtt) {
      const uid = `att_${key}`;
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.att.push(displayName);
      }
      attList.push({ uid, model: displayName, intakeName: dev.name || displayName, dev });
    }

    const pVzw = getVzwPrice(dev);
    if (pVzw) {
      const uid = `vzw_${key}`;
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.vzw.push(displayName);
      }
      vzwList.push({ uid, model: displayName, intakeName: dev.name || displayName, dev });
    }

    const pTmo = getTmoPrice(dev);
    if (pTmo) {
      const uid = `tmo_${key}`;
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary.tmo.push(displayName);
      }
      tmoList.push({ uid, model: displayName, intakeName: dev.name || displayName, dev });
    }
  }

  const sortAlpha = (a, b) => a.intakeName.localeCompare(b.intakeName);
  attList.sort(sortAlpha);
  vzwList.sort(sortAlpha);
  tmoList.sort(sortAlpha);

  appleList.sort((a, b) => {
    const aWatch = /watch/i.test(a.intakeName);
    const bWatch = /watch/i.test(b.intakeName);
    if (aWatch && !bWatch) return -1;
    if (!aWatch && bWatch) return 1;
    return a.intakeName.localeCompare(b.intakeName);
  });

  const renderRows = (list, carrierType) => {
    if (list.length === 0) {
      return `<tr><td colspan="2" style="color: #888; font-style: italic; padding: 4px 0;">No items</td></tr>`;
    }

    return list.map(item => {
      const isHidden = hiddenItemKeys.has(item.uid);
      const hlClass = manualHighlights[item.uid] === 'full'
        ? 'hl-full'
        : (manualHighlights[item.uid] === 'partial' ? 'hl-partial' : '');
      const hiddenClass = isHidden ? 'is-hidden' : '';

      let priceCell = '';
      if (priceOverrides[item.uid]) {
        priceCell = priceOverrides[item.uid];
      } else if (carrierType === 'att') {
        priceCell = getAttPrice(item.dev) || '___';
      } else if (carrierType === 'vzw') {
        priceCell = getVzwPrice(item.dev) || '___';
      } else if (carrierType === 'tmo') {
        priceCell = getTmoPrice(item.dev) || '(___ + ___/mo)';
      } else if (carrierType === 'apple') {
        const pAtt = item.pAtt || '___';
        const pVzw = item.pVzw || '___';
        const pTmo = item.pTmo || '(___ + ___/mo)';
        priceCell = `${pAtt}, ${pVzw}, ${pTmo}`;
      }

      return `
        <tr class="print-row ${hlClass} ${hiddenClass}" data-uid="${item.uid}">
          <td class="col-item tap-item" data-uid="${item.uid}" title="Tap to toggle hide/show, right-click to highlight">${item.model}</td>
          <td class="col-price tap-price" data-uid="${item.uid}" title="Tap to override price">${priceCell}</td>
        </tr>
      `;
    }).join('');
  };

  const hiddenParts = [];
  if (hiddenSummary.att.length) hiddenParts.push(`ATT: ${hiddenSummary.att.join(', ')}`);
  if (hiddenSummary.vzw.length) hiddenParts.push(`VZW: ${hiddenSummary.vzw.join(', ')}`);
  if (hiddenSummary.tmo.length) hiddenParts.push(`TMO: ${hiddenSummary.tmo.join(', ')}`);
  if (hiddenSummary.apple.length) hiddenParts.push(`Apple: ${hiddenSummary.apple.join(', ')}`);
  const hiddenSummaryText = hiddenParts.length > 0
    ? 'Manually hidden devices: ' + hiddenParts.join('; ')
    : 'No phones were hidden for this report.';

  sheet.innerHTML = `
    <div class="print-doc-header">
      <div class="print-header-top-row">
        <div class="print-doc-title"><b>Recent EDLP reports</b></div>
        <div class="print-disclaimer-pill">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>This software is in early development and may make mistakes.</span>
        </div>
      </div>

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
          <div class="print-section-header">ATT</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">ITEM</th>
                <th class="col-price">Likely EDLPs</th>
              </tr>
            </thead>
            <tbody>${renderRows(attList, 'att')}</tbody>
          </table>
        </div>

        <div class="print-section">
          <div class="print-section-header">VZW</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">ITEM</th>
                <th class="col-price">Likely EDLPs</th>
              </tr>
            </thead>
            <tbody>${renderRows(vzwList, 'vzw')}</tbody>
          </table>
        </div>
      </div>

      <div class="print-col print-col-right">
        <div class="print-section">
          <div class="print-section-header">TMO</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">ITEM</th>
                <th class="col-price">Likely EDLPs (dp + /mo)</th>
              </tr>
            </thead>
            <tbody>${renderRows(tmoList, 'tmo')}</tbody>
          </table>
        </div>

        <div class="print-section">
          <div class="print-section-header">Apple Devices</div>
          <table class="print-table apple-table">
            <thead>
              <tr>
                <th class="col-item">ITEM</th>
                <th class="col-price">Likely EDLPs: ATT, VZW, TMO (dp + /mo)</th>
              </tr>
            </thead>
            <tbody>${renderRows(appleList, 'apple')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="print-doc-footer">
      <div class="footer-summary-row">${hiddenSummaryText}</div>
      ${isDocumentEdited ? '<div class="footer-audit-notice">[This document was edited from the original]</div>' : ''}
    </div>
  `;

  attachCommentEditorListeners();

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
      if (hiddenItemKeys.has(uid)) {
        hiddenItemKeys.delete(uid);
      } else {
        hiddenItemKeys.add(uid);
      }
      isDocumentEdited = true;
      saveSessionOverrides();
      pushHistoryState();
      renderPrintDocument();
    });

    td.addEventListener('contextmenu', (e) => {
      e.preventDefault();
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
  });

  updateHistoryButtons();
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
    }
  });

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
        <link rel="stylesheet" href="styles.css?v=0.1.2">
        <style>
          .print-row.is-hidden { display: none !important; }
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
