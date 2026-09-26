// Workflow Optimizer - js/ocr.js (v0.0.12)
// Optical Character Recognition & Resilient Token Parsing Engine

export const OCR_VERSION = "v0.0.12";

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
 * Preprocesses a canvas using illumination-leveling flat-field correction.
 * Eliminates soft gradients, hand shadows, and lighting falloff across document.
 * @param {HTMLCanvasElement} srcCanvas 
 * @returns {HTMLCanvasElement}
 */
export function preprocessCanvasForOcr(srcCanvas) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  if (!w || !h) return srcCanvas;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext("2d");
  outCtx.drawImage(srcCanvas, 0, 0);

  const imgData = outCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Grayscale buffer
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  // Estimate local background illumination using a downscaled grid (~32px blocks)
  const blockSize = Math.max(16, Math.round(w / 40));
  const gw = Math.ceil(w / blockSize);
  const gh = Math.ceil(h / blockSize);
  const bgGrid = new Float32Array(gw * gh);

  for (let gy = 0; gy < gh; gy++) {
    const y0 = gy * blockSize;
    const y1 = Math.min(h, y0 + blockSize);
    for (let gx = 0; gx < gw; gx++) {
      const x0 = gx * blockSize;
      const x1 = Math.min(w, x0 + blockSize);
      let sum = 0;
      let count = 0;
      let maxVal = 0;
      for (let y = y0; y < y1; y += 2) {
        const rowOff = y * w;
        for (let x = x0; x < x1; x += 2) {
          const val = gray[rowOff + x];
          if (val > maxVal) maxVal = val;
          sum += val;
          count++;
        }
      }
      const avg = count ? sum / count : 200;
      bgGrid[gy * gw + gx] = Math.max(50, (maxVal * 0.7) + (avg * 0.3));
    }
  }

  // Flat-field correction against bilinearly interpolated background
  for (let y = 0; y < h; y++) {
    const gy = (y / blockSize) - 0.5;
    const gy0 = Math.max(0, Math.min(gh - 1, Math.floor(gy)));
    const gy1 = Math.max(0, Math.min(gh - 1, gy0 + 1));
    const yf = Math.max(0, Math.min(1, gy - gy0));
    const rowOff = y * w;

    for (let x = 0; x < w; x++) {
      const gx = (x / blockSize) - 0.5;
      const gx0 = Math.max(0, Math.min(gw - 1, Math.floor(gx)));
      const gx1 = Math.max(0, Math.min(gw - 1, gx0 + 1));
      const xf = Math.max(0, Math.min(1, gx - gx0));

      const b00 = bgGrid[gy0 * gw + gx0];
      const b10 = bgGrid[gy0 * gw + gx1];
      const b01 = bgGrid[gy1 * gw + gx0];
      const b11 = bgGrid[gy1 * gw + gx1];

      const bgTop = b00 + xf * (b10 - b00);
      const bgBot = b01 + xf * (b11 - b01);
      const bg = bgTop + yf * (bgBot - bgTop);

      const pIdx = rowOff + x;
      const val = gray[pIdx];

      let normalized = (val / bg) * 235;
      if (normalized < 140) {
        normalized = Math.max(0, normalized * 0.7);
      } else {
        normalized = Math.min(255, 140 + (normalized - 140) * 1.4);
      }

      const dIdx = pIdx * 4;
      data[dIdx] = normalized;
      data[dIdx + 1] = normalized;
      data[dIdx + 2] = normalized;
    }
  }

  outCtx.putImageData(imgData, 0, 0);
  return outCanvas;
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

    // Resilient capacity matching including common OCR misreads (CB, C8, OB, 6B, G8, 68)
    const capMatch = leftover.match(/\b(8|16|32|64|128|256|512|1024|1|2)(?:\s*(?:GB|TB|Gb|Tb|G8|68|6B|08|CB|C8|OB|8B)|(?:68|08|G8|6B|CB|C8|OB|8B))\b/i);
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
    modelRaw = modelRaw.replace(/^[\[\]{}()|~:;\-_.\s]+|[\[\]{}()|~:;\-_.\s]+$/g, "").trim();
    modelRaw = modelRaw.replace(/^(?:ge|ps|at|en|ek|he)\s*[|~:\-_.]*\s*/i, "").trim();
    modelRaw = modelRaw.replace(/\b(?:ot\s*)?Phone\b/gi, "iPhone");
    modelRaw = modelRaw.replace(/\b(iPhone)(\d)/i, "$1 $2");
    modelRaw = modelRaw.replace(/\bAira\b/gi, "Air");
    modelRaw = modelRaw.replace(/\bG\s*P\s*ower/gi, "G Power");
    modelRaw = modelRaw.replace(/\b(?:Mo\s*0?G|oto\s*G|[Ee]oio\s*G[iI]?R?I?ay?)\b/gi, "Moto G");
    modelRaw = modelRaw.replace(/\bMote\b/gi, "Moto");
    modelRaw = modelRaw.replace(/\b(?:ooze|20268)\b/gi, "2026");
    modelRaw = modelRaw.replace(/(Moto)(G)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/\b([a-zA-Z]+)(\d{4})\b/g, "$1 $2");
    modelRaw = modelRaw.replace(/\boto\b/gi, "Moto");
    modelRaw = modelRaw.replace(/\bICL\b/gi, "TCL");
    modelRaw = modelRaw.replace(/(\d+)(Pro|Plus|Max|Air|FE|Mini)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/(Pro)(Max)/gi, "$1 $2");
    modelRaw = modelRaw.replace(/\s+[0-9~|:_.\-]$/, "").trim();
    modelRaw = modelRaw.replace(/^[\[\]{}()|~:;\-_.\s]+|[\[\]{}()|~:;\-_.\s]+$/g, "").trim();

    // Multi-tier token-based fuzzy matching prioritizing longest candidates
    const rNorm = modelRaw.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const rTokens = rNorm.split(" ").filter(Boolean);

    let model = modelRaw;
    let lowestDist = Infinity;
    let bestMatch = null;
    const candidates = [];

    for (const dev of Object.values(devices)) {
      for (const targetStr of [dev.name, dev.abbr]) {
        if (!targetStr) continue;
        const tNorm = targetStr.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const tTokens = tNorm.split(" ").filter(Boolean);

        // Exact match or prefix match
        if (rNorm === tNorm || rNorm.startsWith(tNorm)) {
          candidates.push({ dist: 0, tokenCount: tTokens.length, matchLen: tNorm.length, name: dev.name });
          continue;
        }

        // Token match with tolerance (e.g. Mote -> Moto, Aira -> Air)
        let matchedCount = 0;
        let totalTokenDist = 0;
        for (const tt of tTokens) {
          let bestDist = Infinity;
          for (const rt of rTokens) {
            const d = getLevenshtein(tt, rt);
            if (d < bestDist) bestDist = d;
          }
          const maxAllowed = tt.length <= 2 ? 0 : 1;
          if (bestDist <= maxAllowed) {
            matchedCount++;
            totalTokenDist += bestDist;
          }
        }

        if (matchedCount === tTokens.length) {
          candidates.push({ dist: totalTokenDist, tokenCount: tTokens.length, matchLen: tNorm.length, name: dev.name });
          continue;
        }

        // Full string Levenshtein fallback
        const fullDist = getLevenshtein(rNorm, tNorm);
        const maxFullAllowed = tNorm.length < 6 ? 0 : (tNorm.length <= 10 ? 1 : 2);
        if (fullDist <= maxFullAllowed) {
          candidates.push({ dist: fullDist, tokenCount: tTokens.length, matchLen: tNorm.length, name: dev.name });
        }
      }
    }

    if (candidates.length > 0) {
      // Sort: lowest edit distance first, then HIGHEST token count, then HIGHEST match length
      candidates.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        if (a.tokenCount !== b.tokenCount) return b.tokenCount - a.tokenCount;
        return b.matchLen - a.matchLen;
      });
      lowestDist = candidates[0].dist;
      bestMatch = candidates[0].name;
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
      topCandidates: candidates.slice(0, 3)
    });
  }

  return items;
}

/**
 * Executes client-side OCR on preprocessed image source.
 * Passes illumination-normalized canvas into Tesseract.js engine.
 * @param {HTMLCanvasElement|string} imageSource 
 * @param {Object} statsData 
 * @param {Function} onProgress 
 * @returns {Promise<{ carrier: string|null, store: string|null, items: Array, rawText: string }>}
 */
export async function runOcrPipeline(imageSource, statsData = {}, onProgress = () => {}) {
  if (typeof Tesseract === "undefined") {
    throw new Error("Tesseract.js is not loaded");
  }

  // Normalize oversized image inputs to ~300 DPI sweet spot (max width 2048px)
  let processedSource = imageSource;
  try {
    const srcW = imageSource.naturalWidth || imageSource.width;
    const srcH = imageSource.naturalHeight || imageSource.height;
    if (srcW && srcH) {
      const scale = srcW > 2048 ? (2048 / srcW) : 1;
      const normCanvas = document.createElement("canvas");
      normCanvas.width = Math.round(srcW * scale);
      normCanvas.height = Math.round(srcH * scale);
      const nCtx = normCanvas.getContext("2d");
      nCtx.imageSmoothingEnabled = true;
      nCtx.imageSmoothingQuality = "high";
      nCtx.drawImage(imageSource, 0, 0, normCanvas.width, normCanvas.height);
      
      // Apply illumination leveling to remove shadows before Tesseract
      processedSource = preprocessCanvasForOcr(normCanvas);
    }
  } catch (_) {}

  const result = await Tesseract.recognize(processedSource, "eng", {
    tessedit_pageseg_mode: "4",
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
