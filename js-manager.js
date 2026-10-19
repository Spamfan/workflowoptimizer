// Prototype Crimson - js-manager.js (v0.1.2)
// Catalog & Installment Manager Subsystem

import { fetchCatalog, setCachedCatalog } from './js-app.js?v=0.1.33';
import { updatePrintCatalogCache } from './js-print.js?v=0.1.19';

export const MANAGER_VERSION = "v0.1.2";
const STORAGE_GH_KEY = 'crimson_gh_config';
const STORAGE_LAST_COMMIT_KEY = 'crimson_last_commit';

let workingCatalog = {};
let originalCatalog = {};
const dirtyKeys = new Set();
const rowLocks = new Map();

export function getGhConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_GH_KEY) || '{}'); }
  catch { return {}; }
}

export function saveGhConfig(cfg) {
  localStorage.setItem(STORAGE_GH_KEY, JSON.stringify(cfg));
  updateCloudStatus();
}

function updateCloudStatus(status = 'idle') {
  const pill = document.getElementById('btn-cloud-status');
  const textEl = document.getElementById('cloud-status-text');
  if (!pill) return;
  const cfg = getGhConfig();

  const svgCloud = `<svg class="svg-icon icon-cloud" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
  const svgSynced = `<svg class="svg-icon icon-synced" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><polyline points="9 13 12 16 16 11"/></svg>`;
  const svgSpinner = `<svg class="svg-icon icon-pending spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;
  const svgAlert = `<svg class="svg-icon icon-alert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  if (!cfg.token) {
    pill.className = 'pill-btn btn-cloud-status status-noconfig';
    pill.innerHTML = `${svgCloud} <span id="cloud-status-text">Connect GitHub</span>`;
    return;
  }
  if (status === 'committing') {
    pill.className = 'pill-btn btn-cloud-status status-committing';
    pill.innerHTML = `${svgSpinner} <span id="cloud-status-text">Committing...</span>`;
    return;
  }
  if (status === 'error') {
    pill.className = 'pill-btn btn-cloud-status status-error';
    pill.innerHTML = `${svgAlert} <span id="cloud-status-text">Commit Error</span>`;
    return;
  }
  if (dirtyKeys.size > 0) {
    pill.className = 'pill-btn btn-cloud-status status-pending';
    pill.innerHTML = `${svgSpinner} <span id="cloud-status-text">${dirtyKeys.size} Pending</span>`;
  } else {
    pill.className = 'pill-btn btn-cloud-status status-synced';
    pill.innerHTML = `${svgSynced} <span id="cloud-status-text">Synced</span>`;
  }
}

function getLocks(key) {
  if (!rowLocks.has(key)) {
    rowLocks.set(key, { tmoRed: false, tmoDp: false, tmoMo: false, tmoTot: false });
  }
  return rowLocks.get(key);
}

function calc36Mo(tot) { return tot > 0 ? (tot / 36).toFixed(2) : ''; }
function calc36Tot(mo) { return mo > 0 ? Math.round(mo * 36) : ''; }

function solveTmoRow(rowEl, key, triggerField) {
  const locks = getLocks(key);
  const redIn = rowEl.querySelector('.mgr-tmo-red');
  const dpIn = rowEl.querySelector('.mgr-tmo-dp');
  const moIn = rowEl.querySelector('.mgr-tmo-mo');
  const totIn = rowEl.querySelector('.mgr-tmo-tot');

  const getV = (inp) => parseFloat(inp.value) || 0;

  if (triggerField === 'red') {
    const r = getV(redIn);
    if (!locks.tmoTot) totIn.value = r > 0 ? Math.round(r * 24) : '';
    if (!locks.tmoDp && !locks.tmoMo) { dpIn.value = ''; moIn.value = ''; }
  } else if (triggerField === 'tot') {
    const t = getV(totIn);
    if (!locks.tmoRed) redIn.value = t > 0 ? (t / 24).toFixed(2) : '';
    if (!locks.tmoDp && !locks.tmoMo) { dpIn.value = ''; moIn.value = ''; }
  } else if (triggerField === 'dp') {
    const dp = getV(dpIn);
    const tot = getV(totIn);
    if (tot > 0) {
      moIn.value = (tot - dp) > 0 ? ((tot - dp) / 24).toFixed(2) : '';
    }
  } else if (triggerField === 'mo') {
    const mo = getV(moIn);
    const tot = getV(totIn);
    if (tot > 0) {
      const newDp = tot - (mo * 24);
      dpIn.value = newDp > 0 ? Math.round(newDp * 100) / 100 : '';
    }
  }
  validateTmoMath(rowEl);
}

function validateTmoMath(rowEl) {
  const red = parseFloat(rowEl.querySelector('.mgr-tmo-red').value) || 0;
  const dp = parseFloat(rowEl.querySelector('.mgr-tmo-dp').value) || 0;
  const mo = parseFloat(rowEl.querySelector('.mgr-tmo-mo').value) || 0;
  const tot = parseFloat(rowEl.querySelector('.mgr-tmo-tot').value) || 0;
  const warn = rowEl.querySelector('.mgr-warn-badge');
  if (!warn) return;

  if (tot === 0) { warn.classList.remove('visible'); return; }
  const redMismatch = red > 0 && Math.abs(tot - (red * 24)) > 0.24;
  const partsMismatch = (dp > 0 || mo > 0) && Math.abs(tot - (dp + (mo * 24))) > 0.24;
  warn.classList.toggle('visible', redMismatch || partsMismatch);
}

function renderManagerTable() {
  const tbody = document.getElementById('mgr-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const search = (document.getElementById('mgr-search')?.value || '').toLowerCase().trim();
  const showAtt = document.getElementById('mgr-filter-att')?.checked ?? true;
  const showVzw = document.getElementById('mgr-filter-vzw')?.checked ?? true;
  const showTmo = document.getElementById('mgr-filter-tmo')?.checked ?? true;

  const sortedKeys = Object.keys(workingCatalog).sort((a, b) =>
    (workingCatalog[a].name || '').localeCompare(workingCatalog[b].name || '')
  );

  for (const key of sortedKeys) {
    const dev = workingCatalog[key];
    if (search && !dev.name.toLowerCase().includes(search) && !(dev.abbr || '').toLowerCase().includes(search)) {
      continue;
    }

    const attActive = dev.attMO !== null;
    const vzwActive = dev.vzwMO !== null;
    const tmoActive = dev.tmoMO !== null;

    const attTot = attActive && dev.attMO ? Math.round(dev.attMO * 36) : '';
    const vzwTot = vzwActive && dev.vzwMO ? Math.round(dev.vzwMO * 36) : '';
    const tmoTot = tmoActive && dev.tmoDP !== null && dev.tmoMOADP !== null
      ? Math.round((dev.tmoDP || 0) + ((dev.tmoMOADP || 0) * 24))
      : (tmoActive && dev.tmoMO ? Math.round(dev.tmoMO * 24) : '');

    const row = document.createElement('tr');
    row.dataset.key = key;

    row.innerHTML = `
      <td class="col-dev-sticky">
        <div style="font-weight: 700;">${dev.name}</div>
        <div style="font-size: 0.72rem; color: var(--text-sub); display: flex; gap: 4px; align-items: center; margin-top: 2px;">
          <span>Abbr:</span>
          <input type="text" class="mgr-input-abbr" value="${dev.abbr || ''}" style="width: 55px; font-size: 0.72rem; padding: 1px 3px; border: 1px solid var(--border); border-radius: 4px;">
        </div>
      </td>
      <td class="group-att">
        <button type="button" class="mgr-carrier-toggle ${attActive ? 'active' : 'inactive'}" data-carrier="att">${attActive ? 'ON' : 'OFF'}</button>
        <div class="mgr-input-wrap">
          <input type="number" step="0.01" class="mgr-num-input mgr-att-mo" value="${attActive ? (dev.attMO || '') : ''}" ${!attActive ? 'disabled' : ''}>
        </div>
      </td>
      <td class="group-att">
        <div class="mgr-input-wrap">
          <input type="number" class="mgr-num-input mgr-att-tot" value="${attActive ? attTot : ''}" ${!attActive ? 'disabled' : ''}>
        </div>
      </td>
      <td class="group-vzw">
        <button type="button" class="mgr-carrier-toggle ${vzwActive ? 'active' : 'inactive'}" data-carrier="vzw">${vzwActive ? 'ON' : 'OFF'}</button>
        <div class="mgr-input-wrap">
          <input type="number" step="0.01" class="mgr-num-input mgr-vzw-mo" value="${vzwActive ? (dev.vzwMO || '') : ''}" ${!vzwActive ? 'disabled' : ''}>
        </div>
      </td>
      <td class="group-vzw">
        <div class="mgr-input-wrap">
          <input type="number" class="mgr-num-input mgr-vzw-tot" value="${vzwActive ? vzwTot : ''}" ${!vzwActive ? 'disabled' : ''}>
        </div>
      </td>
      <td class="group-tmo">
        <button type="button" class="mgr-carrier-toggle ${tmoActive ? 'active' : 'inactive'}" data-carrier="tmo">${tmoActive ? 'ON' : 'OFF'}</button>
        <div class="mgr-input-wrap">
          <input type="number" step="0.01" class="mgr-num-input mgr-tmo-red" value="${tmoActive ? (dev.tmoMO || '') : ''}" ${!tmoActive ? 'disabled' : ''}>
          <button type="button" class="mgr-lock-btn ${getLocks(key).tmoRed ? 'locked' : ''}" data-field="tmoRed">🔒</button>
        </div>
      </td>
      <td class="group-tmo">
        <div class="mgr-input-wrap">
          <input type="number" class="mgr-num-input mgr-tmo-dp" value="${tmoActive ? (dev.tmoDP ?? '') : ''}" ${!tmoActive ? 'disabled' : ''}>
          <button type="button" class="mgr-lock-btn ${getLocks(key).tmoDp ? 'locked' : ''}" data-field="tmoDp">🔒</button>
        </div>
      </td>
      <td class="group-tmo">
        <div class="mgr-input-wrap">
          <input type="number" step="0.01" class="mgr-num-input mgr-tmo-mo" value="${tmoActive ? (dev.tmoMOADP ?? '') : ''}" ${!tmoActive ? 'disabled' : ''}>
          <button type="button" class="mgr-lock-btn ${getLocks(key).tmoMo ? 'locked' : ''}" data-field="tmoMo">🔒</button>
        </div>
      </td>
      <td class="group-tmo">
        <div class="mgr-input-wrap">
          <input type="number" class="mgr-num-input mgr-tmo-tot" value="${tmoActive ? tmoTot : ''}" ${!tmoActive ? 'disabled' : ''}>
          <button type="button" class="mgr-lock-btn ${getLocks(key).tmoTot ? 'locked' : ''}" data-field="tmoTot">🔒</button>
        </div>
        <span class="mgr-warn-badge" title="T-Mobile math mismatch > $0.24">⚠️</span>
      </td>
      <td>
        <button type="button" class="pill-btn btn-secondary btn-bic-toggle" style="padding: 3px 8px; font-size: 0.72rem; width: auto;">Promos</button>
      </td>
      <td>
        <div style="display: flex; gap: 4px; justify-content: center;">
          <button type="button" class="pill-btn btn-primary btn-row-save" style="padding: 3px 6px; font-size: 0.75rem; width: auto;" title="Save single device">💾</button>
          <button type="button" class="pill-btn btn-logout btn-row-del" style="padding: 3px 6px; font-size: 0.75rem; width: auto;" title="Delete device">🗑️</button>
        </div>
      </td>
    `;

    const bicRow = document.createElement('tr');
    bicRow.className = 'mgr-bic-container';
    bicRow.innerHTML = `
      <td colspan="11" style="padding: 0;">
        <div class="mgr-bic-drawer">
          <strong>Promotional BICs:</strong>
          <label>ATT BIC ($/mo): <input type="number" step="0.01" class="mgr-bic-att" value="${dev.attBIC ?? ''}" style="width: 55px;"></label>
          <label>VZW BIC ($/mo): <input type="number" step="0.01" class="mgr-bic-vzw" value="${dev.vzwBIC ?? ''}" style="width: 55px;"></label>
          <label>TMO BIC ($/mo): <input type="number" step="0.01" class="mgr-bic-tmo" value="${dev.tmoBIC ?? ''}" style="width: 55px;"></label>
        </div>
      </td>
    `;

    tbody.appendChild(row);
    tbody.appendChild(bicRow);
    validateTmoMath(row);
  }

  // Column visibility
  document.querySelectorAll('.group-att').forEach(el => el.style.display = showAtt ? '' : 'none');
  document.querySelectorAll('.group-vzw').forEach(el => el.style.display = showVzw ? '' : 'none');
  document.querySelectorAll('.group-tmo').forEach(el => el.style.display = showTmo ? '' : 'none');
}

function parseNumOrNull(val) {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  if (trimmed === '') return null;
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

function scrapeRow(key, rowEl, bicDrawerEl) {
  const d = workingCatalog[key] || {};
  d.abbr = rowEl.querySelector('.mgr-input-abbr').value.trim();

  const attActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="att"]').classList.contains('active');
  const vzwActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="vzw"]').classList.contains('active');
  const tmoActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="tmo"]').classList.contains('active');

  d.attMO = attActive ? (parseNumOrNull(rowEl.querySelector('.mgr-att-mo').value) ?? 0) : null;
  d.vzwMO = vzwActive ? (parseNumOrNull(rowEl.querySelector('.mgr-vzw-mo').value) ?? 0) : null;

  if (tmoActive) {
    const rVal = parseNumOrNull(rowEl.querySelector('.mgr-tmo-red').value);
    const dpVal = parseNumOrNull(rowEl.querySelector('.mgr-tmo-dp').value);
    const moVal = parseNumOrNull(rowEl.querySelector('.mgr-tmo-mo').value);
    d.tmoMO = rVal ?? 0;
    d.tmoDP = dpVal ?? 0;
    d.tmoMOADP = moVal ?? 0;
  } else {
    d.tmoMO = null;
    d.tmoDP = null;
    d.tmoMOADP = null;
  }

  if (bicDrawerEl) {
    d.attBIC = parseNumOrNull(bicDrawerEl.querySelector('.mgr-bic-att').value);
    d.vzwBIC = parseNumOrNull(bicDrawerEl.querySelector('.mgr-bic-vzw').value);
    d.tmoBIC = parseNumOrNull(bicDrawerEl.querySelector('.mgr-bic-tmo').value);
  }
  return d;
}

function getLastCommitInfo() {
  try { return JSON.parse(localStorage.getItem(STORAGE_LAST_COMMIT_KEY) || 'null'); }
  catch { return null; }
}

function saveLastCommitInfo(info) {
  try { localStorage.setItem(STORAGE_LAST_COMMIT_KEY, JSON.stringify(info)); }
  catch {}
  renderTraceBar();
}

function renderTraceBar() {
  const linkEl = document.getElementById('mgr-last-commit-link');
  const timeEl = document.getElementById('mgr-trace-time');
  const info = getLastCommitInfo();
  if (!info) {
    if (linkEl) { linkEl.textContent = 'None'; linkEl.removeAttribute('href'); }
    if (timeEl) timeEl.textContent = '';
    return;
  }
  if (linkEl) {
    linkEl.textContent = info.sha ? info.sha.substring(0, 7) : 'View Commit';
    linkEl.href = info.url || '#';
  }
  if (timeEl && info.timestamp) {
    const mins = Math.max(0, Math.floor((Date.now() - info.timestamp) / 60000));
    timeEl.textContent = mins < 1 ? '• just now' : `• ${mins}m ago`;
  }
}

export async function commitCatalog(targetKey = null) {
  const cfg = getGhConfig();
  if (!cfg.token || !cfg.user || !cfg.repo) {
    const modal = document.getElementById('mgr-settings-modal');
    if (modal) modal.style.display = 'flex';
    alert('Please configure GitHub repository settings and Personal Access Token first.');
    return;
  }

  // Scrape all rows to workingCatalog
  const rows = document.querySelectorAll('#mgr-tbody tr:not(.mgr-bic-container)');
  rows.forEach(r => {
    const k = r.dataset.key;
    const bicDrawer = r.nextElementSibling?.querySelector('.mgr-bic-drawer');
    scrapeRow(k, r, bicDrawer);
  });

  updateCloudStatus('committing');

  try {
    const branch = cfg.branch || 'main';
    const path = cfg.path || 'data-stats.json';
    const getUrl = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/${path}?ref=${branch}`;

    const getRes = await fetch(getUrl, {
      headers: { 'Authorization': `token ${cfg.token}` }
    });
    if (!getRes.ok) throw new Error(`Fetch failed: ${getRes.statusText}`);
    const getData = await getRes.json();
    const sha = getData.sha;

    // Alphabetical sort by name
    const sorted = {};
    Object.keys(workingCatalog)
      .sort((a, b) => (workingCatalog[a].name || '').localeCompare(workingCatalog[b].name || ''))
      .forEach(k => sorted[k] = workingCatalog[k]);

    const payload = { ping: "working properly", devices: sorted };
    const jsonStr = JSON.stringify(payload, null, 2);
    const content = btoa(unescape(encodeURIComponent(jsonStr)));

    const putRes = await fetch(`https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${cfg.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: targetKey ? `Update ${workingCatalog[targetKey]?.name || targetKey} [Crimson]` : `Update catalog (${dirtyKeys.size} devices) [Crimson]`,
        content: content,
        sha: sha,
        branch: branch
      })
    });

    if (!putRes.ok) throw new Error(`Commit failed: ${putRes.statusText}`);
    const putData = await putRes.json();
    const commitSha = putData?.commit?.sha || sha;
    const commitUrl = `https://github.com/${cfg.user}/${cfg.repo}/commit/${commitSha}`;

    saveLastCommitInfo({
      sha: commitSha,
      url: commitUrl,
      timestamp: Date.now()
    });

    // Instant In-Memory Cross-Module Sync
    const newCatalog = { ping: "working properly", devices: sorted };
    setCachedCatalog(newCatalog);
    updatePrintCatalogCache(newCatalog);
    originalCatalog = JSON.parse(JSON.stringify(sorted));

    if (targetKey) dirtyKeys.delete(targetKey);
    else dirtyKeys.clear();

    const pill = document.getElementById('btn-cloud-status');
    if (pill) {
      pill.className = 'pill-btn btn-cloud-status status-synced';
      pill.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span id="cloud-status-text">Committed</span>`;
      setTimeout(() => updateCloudStatus('idle'), 4000);
    }
  } catch (err) {
    updateCloudStatus('error');
    alert(`GitHub Commit Error: ${err.message}`);
  }
}

function scrapeAllRows() {
  const rows = document.querySelectorAll('#mgr-tbody tr:not(.mgr-bic-container)');
  rows.forEach(r => {
    const k = r.dataset.key;
    const bicDrawer = r.nextElementSibling?.querySelector('.mgr-bic-drawer');
    scrapeRow(k, r, bicDrawer);
  });
}

export async function openManagerView() {
  try {
    const stats = await fetchCatalog();
    originalCatalog = JSON.parse(JSON.stringify(stats.devices || {}));
    workingCatalog = JSON.parse(JSON.stringify(stats.devices || {}));
    dirtyKeys.clear();
    rowLocks.clear();
    updateCloudStatus();
    renderTraceBar();
    renderManagerTable();
  } catch (e) {
    alert('Unable to load catalog: ' + e.message);
  }
}

async function verifyLiveDeploy() {
  const badge = document.getElementById('mgr-deploy-status');
  if (!badge) return;
  badge.style.display = 'inline-flex';
  badge.className = 'mgr-deploy-badge pending';
  badge.innerHTML = `<svg class="svg-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> <span>Checking Pages...</span>`;

  try {
    const res = await fetch('./data-stats.json?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const live = await res.json();
    const liveDevs = live.devices || {};

    let isLive = true;
    for (const k of Object.keys(originalCatalog)) {
      if (!liveDevs[k] || JSON.stringify(liveDevs[k]) !== JSON.stringify(originalCatalog[k])) {
        isLive = false;
        break;
      }
    }

    if (isLive) {
      badge.className = 'mgr-deploy-badge live';
      badge.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Live on GitHub Pages</span>`;
    } else {
      badge.className = 'mgr-deploy-badge pending';
      badge.innerHTML = `<svg class="svg-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <span>Deploying (~1m)</span>`;
    }
  } catch (err) {
    badge.className = 'mgr-deploy-badge alert';
    badge.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> <span>Check Failed</span>`;
  }
}

function showDiffModal() {
  const modal = document.getElementById('mgr-diff-modal');
  const pre = document.getElementById('mgr-diff-pre');
  if (!modal || !pre) return;
  scrapeAllRows();

  const diffs = [];
  const allKeys = new Set([...Object.keys(originalCatalog), ...Object.keys(workingCatalog)]);

  for (const k of allKeys) {
    const orig = originalCatalog[k];
    const curr = workingCatalog[k];
    if (!orig && curr) {
      diffs.push(`+ [ADDED] ${curr.name} (${k}):\n  ${JSON.stringify(curr, null, 2)}`);
    } else if (orig && !curr) {
      diffs.push(`- [DELETED] ${orig.name} (${k})`);
    } else if (JSON.stringify(orig) !== JSON.stringify(curr)) {
      diffs.push(`~ [MODIFIED] ${curr.name} (${k}):\n  FROM: ${JSON.stringify(orig)}\n  TO:   ${JSON.stringify(curr)}`);
    }
  }

  pre.textContent = diffs.length > 0 ? diffs.join('\n\n') : 'No pending memory changes detected.';
  modal.style.display = 'flex';
}

export function initManagerEngine() {
  const table = document.getElementById('mgr-table');
  if (table) {
    table.addEventListener('input', (e) => {
      const row = e.target.closest('tr');
      if (!row || !row.dataset.key) return;
      const key = row.dataset.key;
      dirtyKeys.add(key);
      updateCloudStatus();

      const t = e.target;
      if (t.classList.contains('mgr-att-mo')) {
        const tot = row.querySelector('.mgr-att-tot');
        if (tot) tot.value = calc36Tot(parseFloat(t.value) || 0);
      } else if (t.classList.contains('mgr-att-tot')) {
        const mo = row.querySelector('.mgr-att-mo');
        if (mo) mo.value = calc36Mo(parseFloat(t.value) || 0);
      } else if (t.classList.contains('mgr-vzw-mo')) {
        const tot = row.querySelector('.mgr-vzw-tot');
        if (tot) tot.value = calc36Tot(parseFloat(t.value) || 0);
      } else if (t.classList.contains('mgr-vzw-tot')) {
        const mo = row.querySelector('.mgr-vzw-mo');
        if (mo) mo.value = calc36Mo(parseFloat(t.value) || 0);
      } else if (t.classList.contains('mgr-tmo-red')) {
        solveTmoRow(row, key, 'red');
      } else if (t.classList.contains('mgr-tmo-tot')) {
        solveTmoRow(row, key, 'tot');
      } else if (t.classList.contains('mgr-tmo-dp')) {
        solveTmoRow(row, key, 'dp');
      } else if (t.classList.contains('mgr-tmo-mo')) {
        solveTmoRow(row, key, 'mo');
      }
    });

    table.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row || !row.dataset.key) return;
      const key = row.dataset.key;

      // Lock buttons
      if (e.target.classList.contains('mgr-lock-btn')) {
        const field = e.target.dataset.field;
        const locks = getLocks(key);
        locks[field] = !locks[field];
        e.target.classList.toggle('locked', locks[field]);
        return;
      }

      // Carrier toggles
      if (e.target.classList.contains('mgr-carrier-toggle')) {
        const c = e.target.dataset.carrier;
        const isActive = e.target.classList.contains('active');
        e.target.classList.toggle('active', !isActive);
        e.target.classList.toggle('inactive', isActive);
        e.target.textContent = isActive ? 'OFF' : 'ON';
        dirtyKeys.add(key);
        updateCloudStatus();

        if (c === 'att') {
          row.querySelector('.mgr-att-mo').disabled = isActive;
          row.querySelector('.mgr-att-tot').disabled = isActive;
          if (isActive) { row.querySelector('.mgr-att-mo').value = ''; row.querySelector('.mgr-att-tot').value = ''; }
        } else if (c === 'vzw') {
          row.querySelector('.mgr-vzw-mo').disabled = isActive;
          row.querySelector('.mgr-vzw-tot').disabled = isActive;
          if (isActive) { row.querySelector('.mgr-vzw-mo').value = ''; row.querySelector('.mgr-vzw-tot').value = ''; }
        } else if (c === 'tmo') {
          ['.mgr-tmo-red', '.mgr-tmo-dp', '.mgr-tmo-mo', '.mgr-tmo-tot'].forEach(sel => {
            const inp = row.querySelector(sel);
            if (inp) { inp.disabled = isActive; if (isActive) inp.value = ''; }
          });
        }
        return;
      }

      // BIC promo toggle
      if (e.target.classList.contains('btn-bic-toggle')) {
        const bicRow = row.nextElementSibling;
        const drawer = bicRow?.querySelector('.mgr-bic-drawer');
        if (drawer) drawer.classList.toggle('open');
        return;
      }

      // Single row save
      if (e.target.classList.contains('btn-row-save')) {
        commitCatalog(key);
        return;
      }

      // Delete row
      if (e.target.classList.contains('btn-row-del')) {
        if (confirm(`Delete ${workingCatalog[key]?.name || key} from catalog?`)) {
          delete workingCatalog[key];
          dirtyKeys.add(key);
          updateCloudStatus();
          renderManagerTable();
        }
        return;
      }
    });
  }

  // Filters & Search
  document.getElementById('mgr-search')?.addEventListener('input', renderManagerTable);
  document.getElementById('mgr-filter-att')?.addEventListener('change', renderManagerTable);
  document.getElementById('mgr-filter-vzw')?.addEventListener('change', renderManagerTable);
  document.getElementById('mgr-filter-tmo')?.addEventListener('change', renderManagerTable);

  // Status & Settings Modal
  document.getElementById('btn-cloud-status')?.addEventListener('click', () => {
    const modal = document.getElementById('mgr-settings-modal');
    if (!modal) return;
    const cfg = getGhConfig();
    document.getElementById('gh-user').value = cfg.user || '';
    document.getElementById('gh-repo').value = cfg.repo || '';
    document.getElementById('gh-branch').value = cfg.branch || 'main';
    document.getElementById('gh-path').value = cfg.path || 'data-stats.json';
    document.getElementById('gh-token').value = cfg.token || '';
    modal.style.display = 'flex';
  });

  document.getElementById('btn-close-gh')?.addEventListener('click', () => {
    document.getElementById('mgr-settings-modal').style.display = 'none';
  });

  document.getElementById('btn-save-gh')?.addEventListener('click', () => {
    const cfg = {
      user: document.getElementById('gh-user').value.trim(),
      repo: document.getElementById('gh-repo').value.trim(),
      branch: document.getElementById('gh-branch').value.trim() || 'main',
      path: document.getElementById('gh-path').value.trim() || 'data-stats.json',
      token: document.getElementById('gh-token').value.trim()
    };
    saveGhConfig(cfg);
    document.getElementById('mgr-settings-modal').style.display = 'none';
  });

  // Add Device Modal
  document.getElementById('btn-mgr-add')?.addEventListener('click', () => {
    document.getElementById('new-dev-name').value = '';
    document.getElementById('new-dev-abbr').value = '';
    document.getElementById('mgr-add-modal').style.display = 'flex';
  });

  document.getElementById('btn-close-add-dev')?.addEventListener('click', () => {
    document.getElementById('mgr-add-modal').style.display = 'none';
  });

  document.getElementById('btn-confirm-add-dev')?.addEventListener('click', () => {
    const name = document.getElementById('new-dev-name').value.trim();
    const abbr = document.getElementById('new-dev-abbr').value.trim();
    if (!name) return alert('Name required');
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (workingCatalog[key]) return alert('Device already exists');

    workingCatalog[key] = {
      name: name,
      abbr: abbr || name,
      vzwMO: 0,
      attMO: 0,
      tmoDP: 0,
      tmoMOADP: 0,
      tmoMO: 0,
      attBIC: null,
      vzwBIC: null,
      tmoBIC: null
    };
    dirtyKeys.add(key);
    updateCloudStatus();
    document.getElementById('mgr-add-modal').style.display = 'none';
    renderManagerTable();
  });

  // Publish All
  document.getElementById('btn-mgr-publish')?.addEventListener('click', () => {
    commitCatalog();
  });

  // Trace & Deploy Verifier
  document.getElementById('btn-mgr-check-deploy')?.addEventListener('click', verifyLiveDeploy);
  document.getElementById('btn-mgr-diff')?.addEventListener('click', showDiffModal);
  document.getElementById('btn-close-diff')?.addEventListener('click', () => {
    const m = document.getElementById('mgr-diff-modal');
    if (m) m.style.display = 'none';
  });
}