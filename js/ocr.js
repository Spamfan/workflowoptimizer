// Workflow Optimizer - js/ocr.js (v0.0.10)
// Optical Character Recognition & Resilient Token Parsing Engine

export const OCR_VERSION = "v0.0.10";

let lastOcrTelemetry = {
  timestamp: null,
  rawText: "",
  header: { carrier: null, store: null },
  lineLogs: [],
  itemCount: 0
};

/**
 * Returns latest OCR telemetry data for on-device diagnostics.
 */
export function getOcrTelemetry() {
  return lastOcrTelemetry;
}

/**
 * Standard Levenshtein Distance metric for typo tolerance.
 */
export function getLevenshtein(a, b) {
  if (!a || !b) return (a || b || "").length;
  const al = a.length;
  const bl = b.length;
  const m = Array.from({ length: bl + 1 }, (_, i) => [i]);
  for (let j = 0; j <= al; j++) m[0][j] = j;
  for (let i = 1; i <= bl; i++) {
    for (let j = 1; j <= al; j++) {
      m[i][j] = b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[bl][al];
}

/**
 * Parses header metadata from "Inventory View Report" sheets with fuzzy OCR tolerance.
 * @param {string} text 
 * @returns {{ carrier: string|null, store: string|null }}
 */
export function parseReportHeader(text) {
  let carrier = null;
  let store = null;

  // Resilient carrier regex matching OCR misreads (e.g. AI&T, AT&I, Verlzon)
  if (/Carrier\s*[-–:]\s*(?:AT&?T|AI&?T|ATT|AT\s*T)\b/i.test(text)) {
    carrier = 'att';
  } else if (/Carrier\s*[-–:]\s*T[- ]?Mobile\b/i.test(text)) {
    carrier = 'tmo';
  } else if (/Carrier\s*[-–:]\s*(?:Verizon|Verlzon|VZW)\b/i.test(text)) {
    carrier = 'vzw';
  }

  // Resilient store number regex (e.g. Slore: 1020, Storc: 1020, Store #1020)
  const storeMatch = text.match(/(?:Store|Slore|Storc|Store#|Store\s*No\.?)[:\s]*(\d+)/i);
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

  lastOcrTelemetry.lineLogs = [];

  const lines = text
    .replace(/Availab[a-z]*/gi, "Available")
    .replace(/Avallable|Avalable|Avallabie|Avallable/gi, "Available")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  const items = [];

  for (const line of lines) {
    const qtyRawMatch = line.match(/([0-9SOlIB|]+)\s*Available/i);
    if (!qtyRawMatch) {
      lastOcrTelemetry.lineLogs.push({
        line,
        status: "skipped",
        reason: "Missing 'Available' / quantity pattern"
      });
      continue;
    }

    const qtyStr = qtyRawMatch[1]
      .replace(/[Ss]/g, "5")
      .replace(/[Oo]/g, "0")
      .replace(/[lI|]/g, "1")
      .replace(/[B]/g, "8");
    const qty = parseInt(qtyStr, 10) || 1;
    const leftover = line.replace(/([0-9SOlIB|]+)\s*Available.*/i, "").trim();

    const capMatch = leftover.match(/\b(8|16|32|64|128|256|512|1024|1|2)(?:\s*(?:GB|TB|Gb|Tb|G8|68|6B|08)|(?:68|08|G8|6B))\b/i);
    if (!capMatch) {
      lastOcrTelemetry.lineLogs.push({
        line,
        status: "skipped",
        reason: "Missing capacity pattern (e.g. 128GB)"
      });
      continue;
    }

    const num = capMatch[1];
    const isTb = /TB|Tb/i.test(capMatch[0]) && (num === "1" || num === "2");
    const capacity = `${num}${isTb ? "TB" : "GB"}`;

    let modelRaw = leftover.substring(0, capMatch.index).trim();
    let colorRaw = leftover.substring(capMatch.index + capMatch[0].length).trim();

    // Model name cleanup and OCR spacing repair
    modelRaw = modelRaw.replace(/^[|~:;\-_.\s]+|[|~:;\-_.\s]+$/g, "").trim();
    modelRaw = modelRaw.replace(/^Phone\b/i, "iPhone");
    modelRaw = modelRaw.replace(/\b(iPhone)(\d)/i, "$1 $2");
    modelRaw = modelRaw.replace(/(\d+)(Pro|Plus|Max|Air|FE|Mini)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/(Pro)(Max)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/\bMo\s*0?G\b/gi, "Moto G");
    modelRaw = modelRaw.replace(/(Moto)(G)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/\b([a-zA-Z]+)(\d{4})\b/g, "$1 $2");
    modelRaw = modelRaw.replace(/\boto\b/gi, "Moto");
    modelRaw = modelRaw.replace(/^[|~:;\-_.\s]+|[|~:;\-_.\s]+$/g, "").trim();

    // Safe tiered matching against canonical devices
    const calcCandidateDist = (raw, target) => {
      if (!raw || !target) return { dist: Infinity, matchLen: 0 };
      const r = raw.toLowerCase().trim();
      const t = target.toLowerCase().trim();
      if (r === t) return { dist: 0, matchLen: t.length };
      const isPrefix = r.startsWith(t) && (r.length === t.length || /[\s:|\-_]/.test(r.charAt(t.length)));
      if (isPrefix) return { dist: 0, matchLen: t.length };

      // Whole-phrase word inclusion check for noisy line buffers
      const escapedT = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp("(?:^|[^a-z0-9])" + escapedT + "(?:$|[^a-z0-9])", "i").test(r)) {
        return { dist: 0, matchLen: t.length };
      }

      const fullDist = getLevenshtein(r, t);
      // Dynamic ceiling: short names (<6) require exact match; 6-10 allow 1; >10 allow 2
      const maxAllowed = t.length < 6 ? 0 : (t.length <= 10 ? 1 : 2);
      if (fullDist <= maxAllowed) {
        return { dist: fullDist, matchLen: t.length };
      }
      return { dist: Infinity, matchLen: 0 };
    };

    let model = modelRaw;
    let lowestDist = Infinity;
    let bestMatch = null;

    const candidateDistances = Object.values(devices).map(dev => {
      const scoreName = calcCandidateDist(modelRaw, dev.name);
      const scoreAbbr = dev.abbr ? calcCandidateDist(modelRaw, dev.abbr) : { dist: Infinity, matchLen: 0 };
      const best = scoreName.dist <= scoreAbbr.dist ? scoreName : scoreAbbr;
      return { name: dev.name, dist: best.dist, matchLen: best.matchLen };
    }).filter(c => c.dist !== Infinity).sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return b.matchLen - a.matchLen;
    });

    if (candidateDistances.length > 0) {
      lowestDist = candidateDistances[0].dist;
      bestMatch = candidateDistances[0].name;
      model = bestMatch;
    }

    // Color name cleaning and mapping
    let cleanColorRaw = colorRaw.replace(/^[|~:;\-_.\s]+|[|~:;\-_.\s]+$/g, "").trim();
    cleanColorRaw = cleanColorRaw.replace(/([a-z])([A-Z])/g, "$1 $2");
    if (/^siver$/i.test(cleanColorRaw)) {
      cleanColorRaw = "Silver";
    }

    let color = cleanColorRaw || "BLK";
    let matchedColorCode = null;

    // Direct match or embedded canonical color phrase check (longest color first)
    const sortedColorEntries = Object.entries(colorsMap).sort((a, b) => b[0].length - a[0].length);
    for (const [name, code] of sortedColorEntries) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const phraseRegex = new RegExp("(?:^|[^a-z0-9])" + escapedName + "(?:$|[^a-z0-9])", "i");
      if (phraseRegex.test(cleanColorRaw)) {
        matchedColorCode = code;
        break;
      }
    }

    // Levenshtein fallback for minor typos on isolated tokens
    if (!matchedColorCode && cleanColorRaw) {
      for (const [name, code] of sortedColorEntries) {
        if (cleanColorRaw.length > 4 && getLevenshtein(cleanColorRaw, name) <= 1) {
          matchedColorCode = code;
          break;
        }
      }
    }
    if (matchedColorCode) {
      color = matchedColorCode;
    }

    const newItem = {
      id: "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      model,
      capacity,
      color,
      qty
    };

    items.push(newItem);
    lastOcrTelemetry.lineLogs.push({
      line,
      status: "matched",
      item: newItem,
      modelRaw,
      colorRaw: cleanColorRaw,
      lowestDist,
      matchedCanonical: !!bestMatch,
      topCandidates: candidateDistances.slice(0, 3)
    });
  }

  return items;
}

/**
 * Executes client-side OCR on raw unmanipulated image source.
 * Passes clean camera/file intake directly into Tesseract.js native engine.
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
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    logger: m => {
      if (m.status === "recognizing text" && m.progress) {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const rawText = result.data.text || "";
  const { carrier, store } = parseReportHeader(rawText);
  const items = parseReportRows(rawText, statsData);

  lastOcrTelemetry.timestamp = new Date().toLocaleTimeString();
  lastOcrTelemetry.rawText = rawText;
  lastOcrTelemetry.header = { carrier, store };
  lastOcrTelemetry.itemCount = items.length;

  return {
    carrier,
    store,
    items,
    rawText
  };
}
