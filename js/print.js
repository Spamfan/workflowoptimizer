// Prototype Blue - js/print.js (v0.0.4)
// Print Inventory Engine & Store-Key Decryption Integration

import { fetchCatalog, fetchStoreInventory, API_VERSION } from './api.js?v=0.0.3';
import { getStoreKey, hasStoreKey, CRYPTO_VERSION } from './crypto.js?v=0.0.2';

export const PRINT_VERSION = "v0.0.4";

let activeStore = '';
let currentMode = 'inventory'; // 'inventory' | 'pricing'
let shiftComment = '';
let isDocumentEdited = false;
let catalogData = null;
let storeInventoryData = null;
let hiddenItemKeys = new Set();
let manualHighlights = {}; // key -> 'partial' | 'full'
let quantityOverrides = {}; // key -> qty

const getSessionOverrideKey = (store) => `wfo_print_overrides_${store || 'default'}`;

function saveSessionOverrides() {
  if (!activeStore) return;
  try {
    const payload = {
      hidden: Array.from(hiddenItemKeys),
      highlights: manualHighlights,
      qtyOverrides: quantityOverrides,
      comment: shiftComment,
      isEdited: isDocumentEdited
    };
    sessionStorage.setItem(getSessionOverrideKey(activeStore), JSON.stringify(payload));
  } catch (_) {}
}

function loadSessionOverrides(store) {
  try {
    const raw = sessionStorage.getItem(getSessionOverrideKey(store));
    if (!raw) return false;
    const p = JSON.parse(raw);
    hiddenItemKeys = new Set(p.hidden || []);
    manualHighlights = p.highlights || {};
    quantityOverrides = p.qtyOverrides || {};
    shiftComment = p.comment || '';
    isDocumentEdited = Boolean(p.isEdited);
    return true;
  } catch (_) {
    return false;
  }
}

function clearSessionOverrides(store) {
  try {
    sessionStorage.removeItem(getSessionOverrideKey(store));
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

  // Prefix fallback matching
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

// View Initializer
export function initPrintEngine() {
  const btnPrintModeToggle = document.getElementById('btn-print-mode-toggle');
  const btnPrintReset = document.getElementById('btn-print-reset');
  const btnPrintSheet = document.getElementById('btn-print-sheet');
  const commentInput = document.getElementById('print-comment-input');

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
      isDocumentEdited = false;
      clearSessionOverrides(activeStore);
      if (commentInput) commentInput.value = '';
      renderPrintDocument();
    });
  }

  if (btnPrintSheet) {
    btnPrintSheet.addEventListener('click', triggerSilentPrint);
  }

  if (commentInput) {
    commentInput.addEventListener('input', (e) => {
      shiftComment = e.target.value;
      saveSessionOverrides();
      renderPrintDocument();
    });
  }
}

export async function openPrintPreview(storeNum, storeSecret = '') {
  activeStore = storeNum;
  currentMode = 'inventory';
  isDocumentEdited = false;
  hiddenItemKeys.clear();
  manualHighlights = {};
  quantityOverrides = {};

  const hasSavedOverrides = loadSessionOverrides(storeNum);
  const commentInput = document.getElementById('print-comment-input');
  if (commentInput && hasSavedOverrides) {
    commentInput.value = shiftComment;
  }

  const sheetContainer = document.getElementById('print-preview-sheet');
  if (sheetContainer) {
    sheetContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #606770;">Loading catalog and decrypting inventory...</div>';
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
      sheetContainer.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--danger, #d93025);">
          <p style="font-weight: 700; margin-bottom: 8px;">Error loading inventory:</p>
          <p style="margin-bottom: 16px;">${err.message}</p>
          <button id="btn-print-pair-prompt" class="btn-pill secondary" style="margin: 0 auto; display: inline-flex;">Pair Device / Enter Store Key</button>
        </div>
      `;
      const btnPair = document.getElementById('btn-print-pair-prompt');
      if (btnPair) {
        btnPair.addEventListener('click', () => {
          const pairModal = document.getElementById('pairing-modal');
          if (pairModal) pairModal.style.display = 'flex';
        });
      }
    }
    return;
  }

  renderPrintDocument();
}

export function renderPrintDocument() {
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
      <div class="print-doc-banner">${bannerText}</div>
      ${shiftComment ? `<div class="print-doc-comment">${shiftComment}</div>` : ''}
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
          <table class="print-table">
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

  // Attach WYSIWYG Cell Overrides
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
      renderPrintDocument();
    });
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
        <link rel="stylesheet" href="styles.css?v=0.0.9">
      </head>
      <body>
        <div id="print-preview-sheet" style="border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important;">
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
