// Workflow Optimizer - js/api.js (v0.0.3)
// Decoupled GitHub REST API Client & Network Transport Engine

import { encryptStoreData, decryptStoreData, getStoreKey, hasStoreKey, CRYPTO_VERSION } from './crypto.js?v=0.0.2';

export const API_VERSION = "v0.0.3";

const REPO_OWNER = 'spamfan';
const REPO_NAME = 'workflowoptimizer';
const OFFLINE_QUEUE_KEY = 'wfo_offline_commit_queue';

/**
 * Robust Base64 decoder handling UTF-8 percent sequences.
 * @param {string} b64 
 * @returns {string}
 */
export function decodeUtf8Base64(b64) {
  const cleanB64 = b64.replace(/\s/g, '');
  return decodeURIComponent(escape(atob(cleanB64)));
}

/**
 * Robust Base64 encoder handling UTF-8 percent sequences.
 * @param {string} str 
 * @returns {string}
 */
export function encodeUtf8Base64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Fetches JSON file with zero-delay GitHub REST API and local fallback.
 * @param {string} path e.g. 'stats.json' or 'stocks.json'
 * @param {string} pat Optional personal access token
 * @returns {Promise<{ sha: string|null, data: Object }>}
 */
export async function fetchRemoteJson(path, pat = '') {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (pat) headers['Authorization'] = `token ${pat}`;

  try {
    const apiRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
      headers,
      cache: 'no-store'
    });

    if (apiRes.ok) {
      const fileJson = await apiRes.json();
      const decoded = decodeUtf8Base64(fileJson.content);
      return {
        sha: fileJson.sha,
        data: JSON.parse(decoded)
      };
    }
    if (apiRes.status === 404) {
      return { sha: null, data: null };
    }
    throw new Error(`GitHub API Error: ${apiRes.status}`);
  } catch (apiErr) {
    // Fallback: Local cache-busting fetch
    const localRes = await fetch(`./${path}?t=${Date.now()}`);
    if (!localRes.ok) {
      throw new Error(`Failed to load ${path} via API and local fallback (${localRes.status})`);
    }
    const localData = await localRes.json();
    return { sha: null, data: localData };
  }
}

/**
 * Fetches the canonical catalog (stats.json).
 * @returns {Promise<Object>}
 */
export async function fetchCatalog() {
  try {
    const { data } = await fetchRemoteJson('stats.json');
    return data || { devices: {}, colors: {} };
  } catch (err) {
    console.error("fetchCatalog error:", err);
    return { devices: {}, colors: {} };
  }
}

/**
 * Fetches store inventory and decrypts it using the provided secret key or local Store Key.
 * @param {string} storeNum 
 * @param {string} [secret] 
 * @returns {Promise<{ lastUpdated: string, inventory: Object }|null>}
 */
export async function fetchStoreInventory(storeNum, secret = '') {
  try {
    const { data } = await fetchRemoteJson('stocks.json');
    if (!data || !data.stores || !data.stores[storeNum]) {
      return null;
    }
    const rawStore = data.stores[storeNum];
    const effectiveSecret = secret || getStoreKey(storeNum);
    return await decryptStoreData(rawStore, storeNum, effectiveSecret);
  } catch (err) {
    console.error(`fetchStoreInventory failed for store ${storeNum}:`, err);
    throw err;
  }
}

/**
 * Commits updated store inventory to stocks.json via GitHub REST API.
 * Encrypts payload using the store's high-entropy Store Key.
 * @param {Object} options
 * @param {string} options.storeNum
 * @param {Object} options.inventoryObj { tmo: [], vzw: [], att: [] }
 * @param {string} options.pat GitHub Personal Access Token
 * @param {string} [options.storeSecret] Optional explicit key
 * @param {boolean} [options.encrypt] Default true
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function commitStoreInventory({ storeNum, inventoryObj, pat, storeSecret = '', encrypt = true }) {
  if (!pat) {
    throw new Error("Missing GitHub Personal Access Token (PAT).");
  }

  const path = 'stocks.json';
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`;

  let existingSha = null;
  let stocksData = { stores: {} };

  try {
    const getRes = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${pat}`
      },
      cache: 'no-store'
    });

    if (getRes.ok) {
      const fileJson = await getRes.json();
      existingSha = fileJson.sha;
      const decodedStr = decodeUtf8Base64(fileJson.content);
      stocksData = JSON.parse(decodedStr);
      if (!stocksData.stores) stocksData.stores = {};
    } else if (getRes.status === 404) {
      stocksData = { stores: {} };
    } else if (getRes.status === 401) {
      throw new Error("Invalid or expired GitHub Personal Access Token.");
    } else {
      throw new Error(`GitHub API error ${getRes.status}`);
    }
  } catch (err) {
    // If network fails entirely, queue for offline commit
    enqueueOfflineCommit(storeNum, inventoryObj);
    throw new Error(`Network unreachable. Commit queued locally for Store ${storeNum}: ${err.message}`);
  }

  const effectiveSecret = storeSecret || getStoreKey(storeNum);
  let storeRecord;
  if (encrypt && effectiveSecret) {
    storeRecord = await encryptStoreData(inventoryObj, storeNum, effectiveSecret);
  } else {
    storeRecord = {
      encrypted: false,
      lastUpdated: new Date().toISOString(),
      inventory: inventoryObj
    };
  }

  stocksData.stores[storeNum] = storeRecord;

  const contentStr = JSON.stringify(stocksData, null, 2);
  const contentB64 = encodeUtf8Base64(contentStr);

  const putBody = {
    message: `Update stocks.json for Store ${storeNum} (${storeRecord.encrypted ? 'Encrypted' : 'Plaintext'})`,
    content: contentB64
  };
  if (existingSha) putBody.sha = existingSha;

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(putBody)
  });

  if (!putRes.ok) {
    const errJson = await putRes.json().catch(() => ({}));
    enqueueOfflineCommit(storeNum, inventoryObj);
    throw new Error(`Commit failed (${putRes.status}): ${errJson.message || putRes.statusText}`);
  }

  removeOfflineCommit(storeNum);

  return { success: true, message: `Successfully committed Store ${storeNum} inventory.` };
}

// Offline Commit Queue Helpers
export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

export function enqueueOfflineCommit(storeNum, inventoryObj) {
  try {
    const q = getOfflineQueue();
    q[storeNum] = {
      timestamp: new Date().toISOString(),
      inventory: inventoryObj
    };
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  } catch (err) {
    console.error("Failed to enqueue offline commit:", err);
  }
}

export function removeOfflineCommit(storeNum) {
  try {
    const q = getOfflineQueue();
    delete q[storeNum];
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  } catch (_) {}
}

export function getOfflineQueueCount() {
  return Object.keys(getOfflineQueue()).length;
}
