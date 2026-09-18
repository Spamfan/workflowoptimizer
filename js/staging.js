// Workflow Optimizer - js/staging.js (v0.0.3)

export const STAGING_VERSION = "v0.0.3";
export const STAGING_STORAGE_KEY = "wfo_staged_inventory";

export const CARRIERS = [
  { key: "tmo", label: "T-Mobile" },
  { key: "vzw", label: "Verizon" },
  { key: "att", label: "AT&T" }
];

/**
 * Creates a fresh staged inventory state object.
 * @param {string} storeNum 
 */
export function createEmptyState(storeNum = "") {
  return {
    store: storeNum,
    activeCarrier: "tmo",
    sheets: {
      tmo: { carrier: "T-Mobile", timestamp: "", thumb: "", items: [], telemetry: null },
      vzw: { carrier: "Verizon", timestamp: "", thumb: "", items: [], telemetry: null },
      att: { carrier: "AT&T", timestamp: "", thumb: "", items: [], telemetry: null }
    }
  };
}

/**
 * Retrieves staged state from localStorage.
 * @param {string} storeNum 
 * @returns {Object}
 */
export function getStagedData(storeNum = "") {
  try {
    const raw = localStorage.getItem(STAGING_STORAGE_KEY);
    if (!raw) return createEmptyState(storeNum);
    const parsed = JSON.parse(raw);
    if (storeNum && parsed.store !== storeNum) {
      return createEmptyState(storeNum);
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse staged data:", err);
    return createEmptyState(storeNum);
  }
}

/**
 * Persists staged state to localStorage.
 * @param {Object} state 
 */
export function saveStagedData(state) {
  try {
    localStorage.setItem(STAGING_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Failed to save staged data:", err);
  }
}

/**
 * Clears all staged inventory from storage.
 * @param {string} storeNum 
 */
export function clearAllStaged(storeNum = "") {
  const empty = createEmptyState(storeNum);
  saveStagedData(empty);
  return empty;
}

/**
 * Saves a completed scan into the target carrier sheet with optional telemetry.
 * @param {string} storeNum 
 * @param {string} carrierKey 'tmo' | 'vzw' | 'att'
 * @param {Array} items 
 * @param {string} thumbUrl 
 * @param {Object} telemetry 
 */
export function commitScanToCarrier(storeNum, carrierKey, items, thumbUrl, telemetry = null) {
  const state = getStagedData(storeNum);
  if (!state.sheets[carrierKey]) return state;

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  state.activeCarrier = carrierKey;
  state.sheets[carrierKey].timestamp = dateStr;
  state.sheets[carrierKey].thumb = thumbUrl || "";
  state.sheets[carrierKey].items = items;
  state.sheets[carrierKey].telemetry = telemetry || null;

  saveStagedData(state);
  return state;
}

/**
 * Inline edit: Updates a single row item.
 */
export function updateStagedItem(storeNum, carrierKey, itemId, updatedFields) {
  const state = getStagedData(storeNum);
  const sheet = state.sheets[carrierKey];
  if (!sheet) return state;

  sheet.items = sheet.items.map(item => {
    if (item.id === itemId) {
      return { ...item, ...updatedFields };
    }
    return item;
  });

  saveStagedData(state);
  return state;
}

/**
 * Inline edit: Deletes a single row item.
 */
export function deleteStagedItem(storeNum, carrierKey, itemId) {
  const state = getStagedData(storeNum);
  const sheet = state.sheets[carrierKey];
  if (!sheet) return state;

  sheet.items = sheet.items.filter(item => item.id !== itemId);
  saveStagedData(state);
  return state;
}

/**
 * Adds a new blank row item to a carrier sheet.
 */
export function addStagedItem(storeNum, carrierKey) {
  const state = getStagedData(storeNum);
  const sheet = state.sheets[carrierKey];
  if (!sheet) return state;

  const newItem = {
    id: "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
    model: "New Device",
    capacity: "128GB",
    color: "BLK",
    qty: 1
  };

  sheet.items.push(newItem);
  saveStagedData(state);
  return state;
}

/**
 * Returns the next carrier key in cycle: TMO -> VZW -> ATT.
 * @param {string} currentKey 
 */
export function getNextCarrier(currentKey) {
  const idx = CARRIERS.findIndex(c => c.key === currentKey);
  const nextIdx = (idx + 1) % CARRIERS.length;
  return CARRIERS[nextIdx].key;
}