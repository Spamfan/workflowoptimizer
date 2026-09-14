// Workflow Optimizer - js/ocr.js (v0.0.1)

export const OCR_VERSION = "v0.0.1";

/**
 * Standard Levenshtein Distance metric.
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

// IRIS Pre-split Wildcard Expressions
const WILDCARD_GARBAGE = [
  /please.*?below/gi,
  /or \..*?d d d/gi,
  /or \..*?s w x/gi,
  /verizc.*?d d/gi,
  /prepai.*?k/gi,
  /\d+\s*total items.*?(out of stock|stock)/gi
];

// IRIS Cleaver Phrase Splits
const PHRASE_SPLITS = [
  /in order to view/gi, /detailed information/gi, /make changes/gi,
  /show show/gi, /out of stoc/gi, /family mobile/gi, /straight talk/gi,
  /ol t :/gi, /1 t t :/gi, /ou 1 :/gi, /x n metro/gi, /click any row/gi,
  /\(carrier\)/gi, /t-mobile/gi, /at&t/gi, /verizon/gi, /cricket/gi,
  /metro/gi, /u\.s\./gi, /prepai/gi, /what ty/gi, /what fe/gi,
  /feedb:/gi, /sele/gi, /capac/gi, /pacity/gi, /eedba/gi, /feedb/gi,
  /ventor/gi, /ct a r/gi, /of stoc/gi, /in stoc/gi, /board \//gi,
  /device m/gi, /lity sta/gi, /repaid/gi, /ellular/gi, /ceonly/gi,
  /view in/gi, /dash/gi, /devi/gi, /odel/gi, /ity :/gi, /show/gi,
  /tus i/gi, /ity i/gi
];

/**
 * Cleans and reconstructs wrapped inventory rows using IRIS Anchor & Stitcher logic.
 * @param {string} rawText 
 * @returns {string[]}
 */
export function cleaveAndStitch(rawText) {
  let text = rawText;

  // 1. Strip wildcard header/disclaimer noise
  for (const pattern of WILDCARD_GARBAGE) {
    text = text.replace(pattern, " ");
  }

  // 2. Inject line breaks on known noise anchors
  for (const phrase of PHRASE_SPLITS) {
    text = text.replace(phrase, "\n");
  }

  // 3. Typo Normalization
  text = text.replace(/Avallable|Avnitable|Avaltable|Atallabte|Availabie|Avalablel|Avalable/gi, "available");
  text = text.replace(/(\d)available/gi, "$1 available");
  text = text.replace(/\b[sS]\s+available/gi, "5 available");
  text = text.replace(/\b[iIlL]\s+available/gi, "1 available");
  text = text.replace(/([a-zA-Z])\s+available/gi, "$1 1 available");
  text = text.replace(/^[Il\-Uu]\s+/gm, "");
  text = text.replace(/IPhone/g, "iPhone");
  text = text.replace(/126G5/gi, "128GB");
  text = text.replace(/BGB/gi, "8GB");
  text = text.replace(/45G/gi, "4 5G");
  text = text.replace(/(\d+\s*(?:GB|TB))\s+(?:\d+\s*(?:GB|TB))/gi, "$1");

  // 4. Orphan Stitcher: stitch fragment until line ends with "available"
  const rawLines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const stitched = rawLines.reduce((acc, line) => {
    if (acc.length === 0) {
      acc.push(line);
    } else {
      const prev = acc[acc.length - 1];
      if (/available/i.test(prev)) {
        acc.push(line);
      } else {
        acc[acc.length - 1] = prev + " " + line;
      }
    }
    return acc;
  }, [])
  .map(l => l.replace(/(available).*$/i, "available").trim())
  .filter(l => /available$/i.test(l));

  return stitched;
}

/**
 * Resolves matched canonical device model and color code from a stitched row.
 * @param {string} line 
 * @param {Object} statsData stats.json dictionary
 * @returns {{ id: string, model: string, capacity: string, color: string, qty: number }}
 */
export function parseRowTokens(line, statsData = {}) {
  const devices = statsData.devices || {};
  const colorsMap = statsData.colors || {};

  // 1. Quantity Extraction (ending anchor)
  const qtyMatch = line.match(/(\d+)\s*available$/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  let working = line.replace(/(\d+)?\s*available$/i, "").trim();

  // 2. Capacity Extraction
  let capacity = "";
  const capMatch = working.match(/\b(\d{2,3}\s*(?:GB|TB)|1\s*TB|2\s*TB)\b/i);
  if (capMatch) {
    capacity = capMatch[1].replace(/\s+/g, "").toUpperCase();
    working = working.replace(capMatch[0], " ").trim();
  }

  // 3. Color Extraction
  let color = "BLK";
  let colorMatched = false;

  // Check known color codes first
  const knownCodes = Array.from(new Set(Object.values(colorsMap)));
  for (const code of knownCodes) {
    const codeRegex = new RegExp(`\\b${code}\\b`, "i");
    if (codeRegex.test(working)) {
      color = code;
      working = working.replace(codeRegex, " ").trim();
      colorMatched = true;
      break;
    }
  }

  // Check full color names if code not found
  if (!colorMatched) {
    for (const [colorName, colorCode] of Object.entries(colorsMap)) {
      const nameRegex = new RegExp(`\\b${colorName}\\b`, "i");
      if (nameRegex.test(working)) {
        color = colorCode;
        working = working.replace(nameRegex, " ").trim();
        colorMatched = true;
        break;
      }
    }
  }

  // 4. Model Matching via Levenshtein
  const cleanedModelCandidate = working.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  let bestModel = cleanedModelCandidate || "Unknown Device";
  let lowestDist = Infinity;

  for (const dev of Object.values(devices)) {
    const distName = getLevenshtein(cleanedModelCandidate, dev.name);
    const distAbbr = getLevenshtein(cleanedModelCandidate, dev.abbr);
    const minDist = Math.min(distName, distAbbr);

    if (minDist < lowestDist) {
      lowestDist = minDist;
      bestModel = dev.name;
    }
  }

  const id = "item_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);

  return {
    id,
    model: bestModel,
    capacity: capacity || "128GB",
    color,
    qty
  };
}

/**
 * Runs Tesseract client-side OCR on an image source and parses items.
 * @param {HTMLCanvasElement|string} imageSource 
 * @param {Object} statsData 
 * @param {Function} onProgress 
 * @returns {Promise<{ rawText: string, stitchedLines: string[], items: Array }>}
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
  const stitchedLines = cleaveAndStitch(rawText);
  const items = stitchedLines.map(line => parseRowTokens(line, statsData));

  return {
    rawText,
    stitchedLines,
    items
  };
}