// Workflow Optimizer - js/ocr.js (v0.0.2)

export const OCR_VERSION = "v0.0.2";

/**
 * Standard Levenshtein Distance metric for typo tolerance.
 */
export function getLevenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

/**
 * Parses header metadata from "Inventory View Report" sheets.
 * @param {string} text 
 * @returns {{ carrier: string|null, store: string|null }}
 */
export function parseReportHeader(text) {
  let carrier = null;
  let store = null;

  if (/Carrier\s*[-–:]\s*AT&T/i.test(text)) {
    carrier = 'att';
  } else if (/Carrier\s*[-–:]\s*T-Mobile/i.test(text)) {
    carrier = 'tmo';
  } else if (/Carrier\s*[-–:]\s*Verizon/i.test(text)) {
    carrier = 'vzw';
  }

  const storeMatch = text.match(/Store:\s*(\d+)/i);
  if (storeMatch) {
    store = storeMatch[1];
  }

  return { carrier, store };
}

/**
 * Parses 4-column tabular rows from "Inventory View Report" sheets.
 * Format: [Model] [Capacity] [Color] [Quantity Available]
 * @param {string} text 
 * @param {Object} statsData stats.json dictionary
 * @returns {Array<{ id: string, model: string, capacity: string, color: string, qty: number }>}
 */
export function parseReportRows(text, statsData = {}) {
  const devices = statsData.devices || {};
  const colorsMap = statsData.colors || {};

  const lines = text
    .replace(/Availab[a-z]*/gi, "Available")
    .replace(/Avallable|Avalable|Avallabie/gi, "Available")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    const qtyMatch = line.match(/(\d+)\s*Available/i);
    if (!qtyMatch) continue;

    const qty = parseInt(qtyMatch[1], 10) || 1;
    const leftover = line.replace(/(\d+)\s*Available.*/i, "").trim();

    const capMatch = leftover.match(/\b(\d{1,3}\s*(?:GB|TB))\b/i);
    if (!capMatch) continue;

    const capacity = capMatch[1].replace(/\s+/g, "").toUpperCase();
    let modelRaw = leftover.substring(0, capMatch.index).trim();
    let colorRaw = leftover.substring(capMatch.index + capMatch[0].length).trim();

    // Fuzzy snap to canonical device name if within typo tolerance
    let model = modelRaw;
    let lowestDist = Infinity;
    let bestMatch = null;

    for (const dev of Object.values(devices)) {
      const dName = getLevenshtein(modelRaw, dev.name);
      const dAbbr = dev.abbr ? getLevenshtein(modelRaw, dev.abbr) : Infinity;
      const minDist = Math.min(dName, dAbbr);
      if (minDist < lowestDist && minDist <= 3) {
        lowestDist = minDist;
        bestMatch = dev.name;
      }
    }
    if (bestMatch) {
      model = bestMatch;
    }

    // Color name to abbreviation mapping
    let color = colorRaw || "BLK";
    for (const [name, code] of Object.entries(colorsMap)) {
      if (name.toLowerCase() === colorRaw.toLowerCase()) {
        color = code;
        break;
      }
    }

    items.push({
      id: "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      model,
      capacity,
      color,
      qty
    });
  }

  return items;
}

/**
 * Executes client-side OCR and extracts report header and tabular inventory rows.
 * @param {HTMLCanvasElement|string} imageSource 
 * @param {Object} statsData 
 * @param {Function} onProgress 
 * @returns {Promise<{ carrier: string|null, store: string|null, items: Array, rawText: string }>}
 */
export async function runOcrPipeline(imageSource, statsData = {}, onProgress = () => {}) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract.js is not loaded");
  }

  const result = await Tesseract.recognize(imageSource, "eng", {
    logger: m => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const rawText = result.data.text || "";
  const { carrier, store } = parseReportHeader(rawText);
  const items = parseReportRows(rawText, statsData);

  return {
    carrier,
    store,
    items,
    rawText
  };
}