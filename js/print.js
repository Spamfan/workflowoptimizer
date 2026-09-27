// Prototype Blue - js/print.js (v0.0.7)
// Print Inventory Engine & Store-Key Decryption Integration

import { fetchCatalog, fetchStoreInventory, API_VERSION } from './api.js?v=0.0.3';
import { getStoreKey, hasStoreKey, setStoreKey, CRYPTO_VERSION } from './crypto.js?v=0.0.2';

export const PRINT_VERSION = "v0.0.7";

let activeStore = '';
let currentMode = 'inventory'; // 'inventory' | 'pricing'
let shiftComment = '';
let isCarriedOver = false;
let isDocumentEdited = false;
let catalogData = null;
let storeInventoryData = null;
let hiddenItemKeys = new Set();
let manualHighlights = {}; // key -> 'partial' | 'full'
let quantityOverrides = {}; // key -> qty

// 10-Step In-Memory Undo / Redo History Stack
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 10;

function pushHistoryState() {
  const state = {
    hidden: Array.from(hiddenItemKeys),
    highlights: { ...manualHighlights },
    qtyOverrides: { ...quantityOverrides },
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
  quantityOverrides = state.qtyOverrides || {};
  shiftComment = state.comment || '';
  isDocumentEdited = Boolean(state.isEdited);
  isCarriedOver = Boolean(state.isCarriedOver);

  saveSessionOverrides();
  renderPrintDocument(false);
  updateHistoryButtons();
}

const getSessionOverrideKey = (store) => `wfo_print_overrides_${store || 'default'}`;
const getPersistentCommentKey = (store) => `wfo_saved_comment_${store || 'default'}`;

function saveSessionOverrides() {
  if (!activeStore) return;
  try {
    const payload = {
      hidden: Array.from(hiddenItemKeys),
      highlights: manualHighlights,
      qtyOverrides: quantityOverrides,
      comment: shiftComment,
      isEdited: isDocumentEdited,
      isCarriedOver: isCarriedOver
    };
    sessionStorage.setItem(getSessionOverrideKey(activeStore), JSON.stringify(payload));
    if (shiftComment) {
      localStorage.setItem(getPersistentCommentKey(activeStore), shiftComment);
    } else {
      localStorage.removeItem(getPersistentCommentKey(activeStore));
    }
  } catch (_) {}
}

function loadSessionOverrides(store) {
  try {
    const raw = sessionStorage.getItem(getSessionOverrideKey(store));
    if (raw) {
      const p = JSON.parse(raw);
      hiddenItemKeys = new Set(p.hidden || []);
      manualHighlights = p.highlights || {};
      quantityOverrides = p.qtyOverrides || {};
      shiftComment = p.comment || '';
      isDocumentEdited = Boolean(p.isEdited);
      isCarriedOver = Boolean(p.isCarriedOver);
      return true;
    }
    // Fallback: check persistent localStorage for comments
    const savedComment = localStorage.getItem(getPersistentCommentKey(store));
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
    sessionStorage.removeItem(getSessionOverrideKey(store));
    localStorage.removeItem(getPersistentCommentKey(store));
  } catch (_) {}
}

// Model Normalization & Lookup Index
function buildCatalogIndex(catalog) {
  const index = {};
  if (!catalog || !catalog.devices) return index;
  for (const [key, dev] of Object.entries(catalog.devices)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normName = (dev.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normAbbr = (dev.abbr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    index[normKey] = dev;
    if (normName) index[normName] = dev;
    if (normAbbr) index[normAbbr] = dev;
  }
  return index;
}

function resolveDevice(modelName, catalogIndex) {
  const norm = (modelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (catalogIndex[norm]) return catalogIndex[norm];

  for (const key of Object.keys(catalogIndex)) {
    if (norm.startsWith(key) || key.startsWith(norm)) {
      return catalogIndex[key];
    }
  }
  return null;
}

// Pricing Formatters
function getAttPrice(dev) {
  if (!dev || dev.attMO === null || dev.attMO === undefined || dev.attMO === 0) return '___';
  return '$' + Math.round(dev.attMO * 36);
}

function getVzwPrice(dev) {
  if (!dev || dev.vzwMO === null || dev.vzwMO === undefined || dev.vzwMO === 0) return '___';
  return '$' + Math.round(dev.vzwMO * 36);
}

function getTmoPrice(dev) {
  if (!dev) return '(___ + ___/mo)';
  const dp = dev.tmoDP;
  const mo = dev.tmoMOADP !== null && dev.tmoMOADP !== undefined ? dev.tmoMOADP : dev.tmoMO;
  if (dp === null && mo === null) return '(___ + ___/mo)';

  let total = 0;
  if (dev.tmoMO) {
    total = Math.round(dev.tmoMO * 24);
  } else if (dp !== null || mo !== null) {
    total = Math.round((dp || 0) + (mo || 0) * 24);
  }
  return `$${total} ($${dp ?? '___'} + $${mo ?? '___'}/mo)`;
}

// 30-Minute Clustering Engine
function formatClusteredTimestamps(timestampMap) {
  const entries = Object.entries(timestampMap).filter(([, ts]) => Boolean(ts));
  if (entries.length === 0) return 'Sources: None recorded';

  const dateObjs = entries.map(([c, ts]) => ({ carrier: c.toUpperCase(), time: new Date(ts) }))
    .sort((a, b) => a.time - b.time);

  const clusters = [];
  let cur = [dateObjs[0]];

  for (let i = 1; i < dateObjs.length; i++) {
    const prev = cur[cur.length - 1];
    const diffMin = (dateObjs[i].time - prev.time) / 60000;
    if (diffMin <= 30) {
      cur.push(dateObjs[i]);
    } else {
      clusters.push(cur);
      cur = [dateObjs[i]];
    }
  }
  clusters.push(cur);

  const clusterStrings = clusters.map(group => {
    const carriers = group.map(g => g.carrier).join(', ');
    const t0 = group[0].time;
    const t1 = group[group.length - 1].time;
    const month = t0.getMonth() + 1;
    const day = t0.getDate();
    const fmtTime = (d) => {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12 || 12;
      return `${h}:${m}${ampm}`;
    };

    if (group.length === 1 || t0.getTime() === t1.getTime()) {
      return `${month}/${day} ${fmtTime(t0)} (${carriers})`;
    }
    return `${month}/${day} ${fmtTime(t0)}-${fmtTime(t1)} (${carriers})`;
  });

  return `Sources: ${clusterStrings.join(', ')}`;
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
  const btnPrintModeToggle = document.getElementById('btn-print-mode-toggle');
  const btnPrintReset = document.getElementById('btn-print-reset');
  const btnPrintSheet = document.getElementById('btn-print-sheet');
  const btnPrintUndo = document.getElementById('btn-print-undo');
  const btnPrintRedo = document.getElementById('btn-print-redo');

  if (btnPrintModeToggle) {
    btnPrintModeToggle.addEventListener('click', () => {
      currentMode = currentMode === 'inventory' ? 'pricing' : 'inventory';
      btnPrintModeToggle.textContent = currentMode === 'inventory' ? 'Mode: Inventory' : 'Mode: Pricing Index';
      renderPrintDocument();
    });
  }

  if (btnPrintReset) {
    btnPrintReset.addEventListener('click', () => {
      hiddenItemKeys.clear();
      manualHighlights = {};
      quantityOverrides = {};
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
  activeStore = storeNum;
  currentMode = 'inventory';
  isDocumentEdited = false;
  hiddenItemKeys.clear();
  manualHighlights = {};
  quantityOverrides = {};
  historyStack = [];
  historyIndex = -1;

  loadSessionOverrides(storeNum);

  const sheetContainer = document.getElementById('print-preview-sheet');
  if (sheetContainer) {
    sheetContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--text-sub, #606770);">Loading catalog and decrypting inventory...</div>';
  }

  const effectiveSecret = storeSecret || getStoreKey(storeNum);

  try {
    const [catalog, storeRecord] = await Promise.all([
      fetchCatalog(),
      fetchStoreInventory(storeNum, effectiveSecret)
    ]);

    catalogData = catalog;
    storeInventoryData = storeRecord;
  } catch (err) {
    console.error("Failed to load print preview data:", err);
    if (sheetContainer) {
      renderPrintUnpairedCard(sheetContainer, storeNum, err.message);
    }
    return;
  }

  pushHistoryState();
  renderPrintDocument();
}

function renderPrintUnpairedCard(container, storeNum, errorMsg = '') {
  container.innerHTML = `
    <div class="print-setup-card">
      <div style="font-size: 2.2rem; line-height: 1;">🔑</div>
      <h3 class="print-setup-title">Store ${storeNum || '--'} Optimizer Key Required</h3>
      <p class="print-setup-desc">
        Workflow Optimizer encrypts daily stock counts locally for Store ${storeNum || '--'}.
        If an OSL associate has already set up a key, scan the barcode off their phone with the handheld scanner or enter it below to unlock this report.
      </p>
      <div style="display: flex; gap: 8px; width: 100%; max-width: 360px; margin: 6px 0 10px;">
        <input type="text" id="print-setup-scanner-input" class="pairing-input scanner-input-pulse" placeholder="Scan barcode or enter key..." style="flex: 1;">
        <button id="btn-print-setup-save" class="pill-btn btn-primary" style="width: auto; padding: 8px 18px;">Unlock</button>
      </div>
      <p id="print-setup-status-msg" class="pairing-status-msg" style="display: none;"></p>
      <div style="display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 6px;">
        <button id="btn-print-open-hub" class="pill-btn btn-secondary" style="width: auto; font-size: 0.85rem; padding: 8px 16px;">Open Pairing Hub</button>
      </div>
    </div>
  `;

  const input = container.querySelector('#print-setup-scanner-input');
  const btnSave = container.querySelector('#btn-print-setup-save');
  const btnOpenHub = container.querySelector('#btn-print-open-hub');
  const statusMsg = container.querySelector('#print-setup-status-msg');

  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  if (input && !isTouchDevice) {
    setTimeout(() => input.focus(), 100);
  }

  const handleUnlock = () => {
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    setStoreKey(storeNum, val);
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.style.color = '#10b981';
      statusMsg.textContent = '✓ Key saved! Decrypting inventory...';
    }
    setTimeout(() => {
      openPrintPreview(storeNum, val);
    }, 600);
  };

  if (btnSave) {
    btnSave.addEventListener('click', (e) => {
      e.preventDefault();
      handleUnlock();
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlock();
      }
    });
  }

  if (btnOpenHub) {
    btnOpenHub.addEventListener('click', (e) => {
      e.preventDefault();
      
      import('./app.js?v=0.0.25').then(mod => {
      const pairBtn = document.getElementById('btn-pair-device');
      if (pairBtn) {
        pairBtn.click();
      } else {
        window.dispatchEvent(new CustomEvent('wfo:open-pairing-modal'));
        import('./app.js?v=0.0.26').then(mod => {
          if (mod && mod.openPairingModal) mod.openPairingModal();
        }).catch(() => {});
      }
      }).catch(err => console.error(err));

    });
  }
}

export function renderPrintDocument(pushToHistory = true) {
  const sheet = document.getElementById('print-preview-sheet');
  if (!sheet) return;

  const catalogIndex = buildCatalogIndex(catalogData);
  const rawInventory = storeInventoryData ? (storeInventoryData.inventory || {}) : {};
  const lastUpdated = storeInventoryData ? storeInventoryData.lastUpdated : null;

  const timestampMap = {
    att: lastUpdated,
    vzw: lastUpdated,
    tmo: lastUpdated
  };

  const isVaporized = (model) => /iPhone\s*(11|12|13)(?!\d)/i.test(model);
  const isApple = (model) => /iPhone|Apple Watch|AW\b/i.test(model);
  const isUnlocked = (model) => /unlocked/i.test(model);

  const attList = [];
  const vzwList = [];
  const tmoList = [];
  const appleMap = {};
  const unlockedList = [];
  const hiddenSummary = { att: [], vzw: [], tmo: [], apple: [] };

  function processCarrierItems(carrierKey, targetList) {
    const items = rawInventory[carrierKey] || [];
    items.forEach((item, idx) => {
      if (isVaporized(item.model)) return;

      const uid = `${carrierKey}_${item.id || idx}_${item.model}`;
      const dev = resolveDevice(item.model, catalogIndex);
      const displayName = dev ? (dev.abbr || dev.name) : item.model;
      const qty = quantityOverrides[uid] !== undefined ? quantityOverrides[uid] : item.qty;

      if (isUnlocked(item.model)) {
        unlockedList.push({ name: displayName, qty });
        return;
      }

      if (isApple(item.model)) {
        if (!appleMap[displayName]) {
          appleMap[displayName] = {
            model: displayName,
            dev,
            counts: { att: 0, vzw: 0, tmo: 0 },
            uids: []
          };
        }
        appleMap[displayName].counts[carrierKey] += qty;
        appleMap[displayName].uids.push(uid);
        return;
      }

      const rowObj = { uid, model: displayName, rawModel: item.model, dev, qty, carrier: carrierKey };
      if (hiddenItemKeys.has(uid)) {
        hiddenSummary[carrierKey].push(displayName);
      } else {
        targetList.push(rowObj);
      }
    });
  }

  processCarrierItems('att', attList);
  processCarrierItems('vzw', vzwList);
  processCarrierItems('tmo', tmoList);

  const appleList = [];
  Object.values(appleMap).forEach(appItem => {
    const isHidden = appItem.uids.some(uid => hiddenItemKeys.has(uid));
    const effectiveQty = appItem.counts.att || appItem.counts.vzw || appItem.counts.tmo;
    if (isHidden) {
      hiddenSummary.apple.push(appItem.model);
    } else {
      appleList.push({
        uid: appItem.uids[0],
        model: appItem.model,
        dev: appItem.dev,
        qty: effectiveQty,
        counts: appItem.counts
      });
    }
  });

  appleList.sort((a, b) => {
    const aWatch = /watch/i.test(a.model);
    const bWatch = /watch/i.test(b.model);
    if (aWatch && !bWatch) return -1;
    if (!aWatch && bWatch) return 1;
    return a.model.localeCompare(b.model);
  });

  const now = new Date();
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
  let hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${mins}${ampm}`;

  const titleLine = currentMode === 'inventory'
    ? `${dateStr} ${timeStr} Store #${activeStore || '--'} Inventory Report - Made with Optimizer.`
    : `${dateStr} ${timeStr} likely EDLP price index`;

  const bannerText = currentMode === 'inventory'
    ? '[!] EXPERIMENTAL SOFTWARE. Stock counts may be inaccurate, pricing is not affected.'
    : '[!] NOT A STOCK REPORT, FOR PRICING REFERENCE ONLY.';

  const sourceClusterText = formatClusteredTimestamps(timestampMap);

  const renderRows = (list, carrierType) => {
    if (list.length === 0) {
      return `<tr><td colspan="${currentMode === 'inventory' ? 3 : 2}" style="color: #888; font-style: italic; padding: 4px 0;">No items</td></tr>`;
    }

    return list.map(item => {
      const hlClass = manualHighlights[item.uid] === 'full'
        ? 'hl-full'
        : (manualHighlights[item.uid] === 'partial' ? 'hl-partial' : '');

      let priceCell = '';
      if (carrierType === 'att') priceCell = getAttPrice(item.dev);
      else if (carrierType === 'vzw') priceCell = getVzwPrice(item.dev);
      else if (carrierType === 'tmo') priceCell = getTmoPrice(item.dev);
      else if (carrierType === 'apple') {
        const pAtt = getAttPrice(item.dev);
        const pVzw = getVzwPrice(item.dev);
        const pTmo = getTmoPrice(item.dev);
        priceCell = `${pAtt}, ${pVzw}, ${pTmo}`;
      }

      const qtyCell = currentMode === 'inventory'
        ? `<td class="col-qty tap-qty" data-uid="${item.uid}" title="Tap to edit qty">${item.qty}</td>`
        : '';

      return `
        <tr class="print-row ${hlClass}" data-uid="${item.uid}">
          <td class="col-item tap-item" data-uid="${item.uid}" title="Tap to toggle hide, right-click to highlight">${item.model}</td>
          <td class="col-price">${priceCell}</td>
          ${qtyCell}
        </tr>
      `;
    }).join('');
  };

  const unlockedSummaryText = unlockedList.length > 0
    ? 'Unlocked phones: ' + unlockedList.sort((a, b) => b.qty - a.qty).map(u => `${u.qty}x ${u.name}`).join(', ')
    : '';

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
      <div class="print-doc-title">${titleLine}</div>
      <div class="print-doc-sources">${sourceClusterText}</div>

      <!-- In-Document Comments Box (WYSIWYG between sources and banner) -->
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

      <div class="print-doc-banner">${bannerText}</div>
    </div>

    <div class="print-doc-body">
      <div class="print-col print-col-left">
        <div class="print-section">
          <div class="print-section-header">ATT</div>
          <table class="print-table">
            <thead>
              <tr>
                <th class="col-item">ITEM</th>
                <th class="col-price">Likely<br>EDLPs</th>
                ${currentMode === 'inventory' ? '<th class="col-qty">QTY</th>' : ''}
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
                <th class="col-price">Likely<br>EDLPs</th>
                ${currentMode === 'inventory' ? '<th class="col-qty">QTY</th>' : ''}
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
                <th class="col-price">Likely<br>EDLPs (dp + /mo)</th>
                ${currentMode === 'inventory' ? '<th class="col-qty">QTY</th>' : ''}
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
                <th class="col-price">Likely EDLPs<br>ATT, VZW, TMO (dp + /mo)</th>
                ${currentMode === 'inventory' ? '<th class="col-qty">QTY</th>' : ''}
              </tr>
            </thead>
            <tbody>${renderRows(appleList, 'apple')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="print-doc-footer">
      ${unlockedSummaryText ? `<div class="footer-summary-row">${unlockedSummaryText}</div>` : ''}
      <div class="footer-summary-row">${hiddenSummaryText}</div>
      ${isDocumentEdited ? '<div class="footer-audit-notice">[This document was edited from the original]</div>' : ''}
    </div>
  `;

  attachCommentEditorListeners();

  sheet.querySelectorAll('.tap-qty').forEach(td => {
    td.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = td.dataset.uid;
      const currentVal = td.textContent.trim();
      const newVal = prompt('Override Quantity:', currentVal);
      if (newVal !== null && !isNaN(parseInt(newVal, 10))) {
        quantityOverrides[uid] = parseInt(newVal, 10);
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
        <title>Inventory Report</title>
        <link rel="stylesheet" href="styles.css?v=0.0.13">
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
