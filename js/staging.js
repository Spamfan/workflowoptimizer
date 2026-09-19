// Workflow Optimizer - js/staging.js (v0.0.4)

export const STAGING_VERSION = "v0.0.4";
export const STAGING_STORAGE_KEY = "wfo_staged_inventory";

export const CARRIERS = [
  { key: "tmo", label: "T-Mobile" },
  { key: "vzw", label: "Verizon" },
  { key: "att", label: "AT&T" }
];

const sessionMedia = {
  tmo: { thumb: "", telemetry: null },
  vzw: { thumb: "", telemetry: null },
  att: { thumb: "", telemetry: null }
};

export function getSessionMedia(carrierKey) {
  return sessionMedia[carrierKey] || { thumb: "", telemetry: null };
}

export function setSessionMedia(carrierKey, thumb, telemetry) {
  if (!sessionMedia[carrierKey]) sessionMedia[carrierKey] = {};
  if (thumb !== undefined) sessionMedia[carrierKey].thumb = thumb;
  if (telemetry !== undefined) sessionMedia[carrierKey].telemetry = telemetry;
}

/**
 * Creates a fresh staged inventory state object.
 * @param {string} storeNum 
 */
export function createEmptyState(storeNum = "") {
  return {
    store: storeNum,
    activeCarrier: "tmo",
    sheets: {
      tmo: { carrier: "T-Mobile", timestamp: "", pageCount: 0, items: [] },
      vzw: { carrier: "Verizon", timestamp: "", pageCount: 0, items: [] },
      att: { carrier: "AT&T", timestamp: "", pageCount: 0, items: [] }
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
    const cleanState = {
      ...state,
      sheets: { ...state.sheets }
    };
    Object.keys(cleanState.sheets).forEach(k => {
      const sheet = { ...cleanState.sheets[k] };
      delete sheet.thumb;
      delete sheet.telemetry;
      cleanState.sheets[k] = sheet;
    });
    localStorage.setItem(STAGING_STORAGE_KEY, JSON.stringify(cleanState));
  } catch (err) {
    console.error("Failed to save staged data:", err);
  }
}

/**
 * Clears all staged inventory from storage.
 * @param {string} storeNum 
 */
export function clearAllStaged(storeNum = "") {
  ['tmo', 'vzw', 'att'].forEach(k => setSessionMedia(k, "", null));
  const empty = createEmptyState(storeNum);
  saveStagedData(empty);
  return empty;
}

/**
 * Clears staged items for a single carrier sheet.
 */
export function clearCarrierStaged(storeNum, carrierKey) {
  const state = getStagedData(storeNum);
  if (state.sheets[carrierKey]) {
    state.sheets[carrierKey].items = [];
    state.sheets[carrierKey].timestamp = "";
    state.sheets[carrierKey].pageCount = 0;
    setSessionMedia(carrierKey, "", null);
    saveStagedData(state);
  }
  return state;
}

/**
 * Saves a completed scan into the target carrier sheet with optional telemetry.
 * @param {string} storeNum 
 * @param {string} carrierKey 'tmo' | 'vzw' | 'att'
 * @param {Array} items 
 * @param {string} thumbUrl 
 * @param {Object} telemetry 
 */
export function commitScanToCarrier(storeNum, carrierKey, items, thumbUrl, telemetry = null, mode = "append") {
  const state = getStagedData(storeNum);
  if (!state.sheets[carrierKey]) return state;

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  state.activeCarrier = carrierKey;
  const sheet = state.sheets[carrierKey];
  sheet.timestamp = dateStr;

  setSessionMedia(carrierKey, thumbUrl || "", telemetry || null);

  const currentPageCount = sheet.pageCount || (sheet.items && sheet.items.length > 0 ? 1 : 0);

  if (mode === "replace" || currentPageCount === 0) {
    sheet.items = items.map(it => ({ ...it }));
    sheet.pageCount = items.length > 0 ? 1 : 0;
  } else {
    if (currentPageCount < 5) {
      sheet.pageCount = currentPageCount + 1;
    }
    items.forEach(incoming => {
      const match = sheet.items.find(existing =>
        existing.model.trim().toLowerCase() === incoming.model.trim().toLowerCase() &&
        existing.capacity.trim().toLowerCase() === incoming.capacity.trim().toLowerCase() &&
        existing.color.trim().toUpperCase() === incoming.color.trim().toUpperCase()
      );
      if (match) {
        match.qty = (parseInt(match.qty, 10) || 0) + (parseInt(incoming.qty, 10) || 0);
      } else {
        sheet.items.push({ ...incoming });
      }
    });
  }

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