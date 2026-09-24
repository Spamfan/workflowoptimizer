// Workflow Optimizer - js/ocr.js (v0.0.5)
// Optical Character Recognition & Resilient Token Parsing Engine

export const OCR_VERSION = "v0.0.5";

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
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = a.charAt(i - 1).toLowerCase() === b.charAt(j - 1).toLowerCase()
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}

/**
 * Preprocesses a canvas image for OCR: Grayscale conversion + Contrast Stretching + Adaptive Binarization.
 * Dramatically improves Tesseract character recognition under uneven retail store lighting.
 * @param {HTMLCanvasElement} sourceCanvas 
 * @returns {HTMLCanvasElement}
 */
export function preprocessOcrCanvas(sourceCanvas) {
  if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) return sourceCanvas;

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const processedCanvas = document.createElement("canvas");
  processedCanvas.width = width;
  processedCanvas.height = height;
  const ctx = processedCanvas.getContext("2d");

  ctx.drawImage(sourceCanvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Grayscale & luminosity histogram
  let minLum = 255;
  let maxLum = 0;
  const grayValues = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Standard perceptual luminance: 0.299R + 0.587G + 0.114B
    const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
    grayValues[p] = gray;
    if (gray < minLum) minLum = gray;
    if (gray > maxLum) maxLum = gray;
  }

  // 2. Contrast normalization & dynamic thresholding
  const range = (maxLum - minLum) || 1;
  const threshold = minLum + (range * 0.52); // Bias slightly toward darker text

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const normalized = ((grayValues[p] - minLum) * 255) / range;
    const finalVal = normalized < (threshold * 255 / (maxLum || 255)) ? 0 : 255;
    data[i] = finalVal;
    data[i + 1] = finalVal;
    data[i + 2] = finalVal;
    // Alpha remains untouched
  }

  ctx.putImageData(imgData, 0, 0);
  return processedCanvas;
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
    modelRaw = modelRaw.replace(/^Phone\b/i, "iPhone");
    modelRaw = modelRaw.replace(/\b(iPhone)(\d)/i, "$1 $2");
    modelRaw = modelRaw.replace(/(\d+)(Pro|Plus|Max|Air|FE|Mini)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/(Pro)(Max)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/[:|,\-_]+$/g, "").trim();

    // Fuzzy & prefix matching against canonical devices
    const calcCandidateDist = (raw, target) => {
      if (!raw || !target) return { dist: Infinity, matchLen: 0 };
      const r = raw.toLowerCase().trim();
      const t = target.toLowerCase().trim();
      if (r === t) return { dist: 0, matchLen: t.length };
      const isPrefix = r.startsWith(t) && (r.length === t.length || /[\s:|\-_]/.test(r.charAt(t.length)));
      if (isPrefix) return { dist: 0, matchLen: t.length };
      const fullDist = getLevenshtein(r, t);
      let prefixDist = Infinity;
      if (r.length > t.length) {
        const slice = r.substring(0, t.length).trim();
        prefixDist = getLevenshtein(slice, t);
      }
      return { dist: Math.min(fullDist, prefixDist), matchLen: t.length };
    };

    let model = modelRaw;
    let lowestDist = Infinity;
    let bestMatch = null;

    const candidateDistances = Object.values(devices).map(dev => {
      const scoreName = calcCandidateDist(modelRaw, dev.name);
      const scoreAbbr = dev.abbr ? calcCandidateDist(modelRaw, dev.abbr) : { dist: Infinity, matchLen: 0 };
      const best = scoreName.dist <= scoreAbbr.dist ? scoreName : scoreAbbr;
      return { name: dev.name, dist: best.dist, matchLen: best.matchLen };
    }).sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return b.matchLen - a.matchLen;
    });

    if (candidateDistances.length > 0) {
      lowestDist = candidateDistances[0].dist;
      if (lowestDist <= 3) {
        bestMatch = candidateDistances[0].name;
        model = bestMatch;
      }
    }

    // Color name cleaning and mapping
    let cleanColorRaw = colorRaw.replace(/^[:|\-_\s]+|[:|\-_\s]+$/g, "").trim();
    if (/^siver$/i.test(cleanColorRaw)) {
      cleanColorRaw = "Silver";
    }

    let color = cleanColorRaw || "BLK";
    let matchedColorCode = null;
    for (const [name, code] of Object.entries(colorsMap)) {
      if (name.toLowerCase() === cleanColorRaw.toLowerCase()) {
        matchedColorCode = code;
        break;
      }
    }
    if (!matchedColorCode && cleanColorRaw) {
      for (const [name, code] of Object.entries(colorsMap)) {
        if (getLevenshtein(cleanColorRaw, name) <= 1) {
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
 * Executes client-side OCR with canvas preprocessing and extracts report header and tabular inventory rows.
 * @param {HTMLCanvasElement|string} imageSource 
 * @param {Object} statsData 
 * @param {Function} onProgress 
 * @returns {Promise<{ carrier: string|null, store: string|null, items: Array, rawText: string }>}
 */
export async function runOcrPipeline(imageSource, statsData = {}, onProgress = () => {}) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract.js is not loaded");
  }

  // Apply automatic canvas contrast and binarization preprocessing if source is a canvas
  let inputSource = imageSource;
  if (imageSource instanceof HTMLCanvasElement) {
    try {
      inputSource = preprocessOcrCanvas(imageSource);
    } catch (e) {
      console.warn("Preprocessing failed; using original canvas", e);
      inputSource = imageSource;
    }
  }

  const result = await Tesseract.recognize(inputSource, "eng", {
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
