// Prototype Crimson - js-manager.js (v0.1.0)
// Catalog & Installment Manager Subsystem

import { fetchCatalog } from './js-app.js?v=0.1.31';

export const MANAGER_VERSION = "v0.1.0";
const STORAGE_GH_KEY = 'crimson_gh_config';

let workingCatalog = {};
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
  if (!pill) return;
  const cfg = getGhConfig();
  if (!cfg.token) {
    pill.className = 'pill-btn btn-cloud-status status-noconfig';
    pill.textContent = '☁️ Connect GitHub';
    return;
  }
  if (status === 'committing') {
    pill.className = 'pill-btn btn-cloud-status status-committing';
    pill.textContent = '☁️ Committing...';
    return;
  }
  if (status === 'error') {
    pill.className = 'pill-btn btn-cloud-status status-error';
    pill.textContent = '⚠️ Commit Error';
    return;
  }
  if (dirtyKeys.size > 0) {
    pill.className = 'pill-btn btn-cloud-status status-pending';
    pill.textContent = `☁️ ${dirtyKeys.size} Pending`;
  } else {
    pill.className = 'pill-btn btn-cloud-status status-synced';
    pill.textContent = '☁️ Synced';
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

function scrapeRow(key, rowEl, bicDrawerEl) {
  const d = workingCatalog[key] || {};
  d.abbr = rowEl.querySelector('.mgr-input-abbr').value.trim();

  const attActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="att"]').classList.contains('active');
  const vzwActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="vzw"]').classList.contains('active');
  const tmoActive = rowEl.querySelector('.mgr-carrier-toggle[data-carrier="tmo"]').classList.contains('active');

  d.attMO = attActive ? (parseFloat(rowEl.querySelector('.mgr-att-mo').value) || 0) : null;
  d.vzwMO = vzwActive ? (parseFloat(rowEl.querySelector('.mgr-vzw-mo').value) || 0) : null;

  if (tmoActive) {
    d.tmoMO = parseFloat(rowEl.querySelector('.mgr-tmo-red').value) || 0;
    d.tmoDP = parseFloat(rowEl.querySelector('.mgr-tmo-dp').value) || 0;
    d.tmoMOADP = parseFloat(rowEl.querySelector('.mgr-tmo-mo').value) || 0;
  } else {
    d.tmoMO = null;
    d.tmoDP = null;
    d.tmoMOADP = null;
  }

  if (bicDrawerEl) {
    const aB = bicDrawerEl.querySelector('.mgr-bic-att').value;
    const vB = bicDrawerEl.querySelector('.mgr-bic-vzw').value;
    const tB = bicDrawerEl.querySelector('.mgr-bic-tmo').value;
    d.attBIC = aB !== '' ? parseFloat(aB) : null;
    d.vzwBIC = vB !== '' ? parseFloat(vB) : null;
    d.tmoBIC = tB !== '' ? parseFloat(tB) : null;
  }
  return d;
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

    if (targetKey) dirtyKeys.delete(targetKey);
    else dirtyKeys.clear();

    const pill = document.getElementById('btn-cloud-status');
    if (pill) {
      pill.className = 'pill-btn btn-cloud-status status-synced';
      pill.textContent = '✓ Committed';
      setTimeout(() => updateCloudStatus('idle'), 4000);
    }
  } catch (err) {
    updateCloudStatus('error');
    alert(`GitHub Commit Error: ${err.message}`);
  }
}

export async function openManagerView() {
  try {
    const stats = await fetchCatalog();
    workingCatalog = JSON.parse(JSON.stringify(stats.devices || {}));
    dirtyKeys.clear();
    rowLocks.clear();
    updateCloudStatus();
    renderManagerTable();
  } catch (e) {
    alert('Unable to load catalog: ' + e.message);
  }
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
}