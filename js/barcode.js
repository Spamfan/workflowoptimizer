// Workflow Optimizer - js/barcode.js (v0.0.2)
// Unified Code 128 (Subset B) Barcode & Standalone SVG QR Code Generator

export const BARCODE_VERSION = "v0.0.2";

// --- CODE 128 (SUBSET B) 1D BARCODE ENGINE ---
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

export function encodeCode128B(text) {
  const codes = [104];
  let checkSum = 104;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 95) {
      throw new Error(`Character ${text[i]} cannot be encoded in Code 128 Subset B`);
    }
    codes.push(code);
    checkSum += code * (i + 1);
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(106);

  let modules = "";
  for (const c of codes) {
    const pattern = PATTERNS[c];
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      const isBar = j % 2 === 0;
      modules += (isBar ? "1" : "0").repeat(width);
    }
  }

  return modules;
}

export function renderCode128Svg(text, options = {}) {
  const barWidth = options.barWidth || 2.4;
  const height = options.height || 90;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 25;
  const showText = options.showText !== false;
  const fontSize = 14;
  const textPadding = 18;

  const modules = encodeCode128B(text);
  const barcodeContentWidth = modules.length * barWidth;
  const totalWidth = barcodeContentWidth + (quietZone * 2);
  const totalHeight = height + (showText ? textPadding + fontSize : 0) + 16;

  let rectsSvg = "";
  let curX = quietZone;
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    const bit = modules[i];
    if (bit === "1" && !inBar) {
      inBar = true;
      barStart = curX;
    } else if (bit === "0" && inBar) {
      inBar = false;
      const w = curX - barStart;
      rectsSvg += `<rect x="${barStart.toFixed(1)}" y="8" width="${w.toFixed(1)}" height="${height}" fill="#000000" />`;
    }
    curX += barWidth;
  }

  if (inBar) {
    const w = curX - barStart;
    rectsSvg += `<rect x="${barStart.toFixed(1)}" y="8" width="${w.toFixed(1)}" height="${height}" fill="#000000" />`;
  }

  const textSvg = showText
    ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${height + textPadding + 4}" font-family="monospace" font-size="${fontSize}" font-weight="700" fill="#111111" text-anchor="middle" letter-spacing="2">${text}</text>`
    : "";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" style="max-width: ${totalWidth}px; background: #ffffff; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff" />
      ${rectsSvg}
      ${textSvg}
    </svg>
  `.trim();
}

// --- STANDALONE 2D QR CODE (MODEL 2) SVG ENGINE ---
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
for (let i = 0, x = 1; i < 256; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
}

function gMult(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function getGeneratorPoly(numEc) {
  let poly = [1];
  for (let i = 0; i < numEc; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMult(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function calculateEcc(dataBytes, numEc) {
  const poly = getGeneratorPoly(numEc);
  const remainder = new Array(numEc).fill(0);
  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let j = 0; j < numEc; j++) {
      remainder[j] ^= gMult(poly[j], factor);
    }
  }
  return remainder;
}

const VERSIONS_L = [
  null,
  { v: 1, size: 21, dataCap: 19, ecPerBlock: 7, b1: { data: 19, blocks: 1 }, b2: null, align: [] },
  { v: 2, size: 25, dataCap: 34, ecPerBlock: 10, b1: { data: 34, blocks: 1 }, b2: null, align: [6, 18] },
  { v: 3, size: 29, dataCap: 55, ecPerBlock: 15, b1: { data: 55, blocks: 1 }, b2: null, align: [6, 22] },
  { v: 4, size: 33, dataCap: 80, ecPerBlock: 20, b1: { data: 80, blocks: 1 }, b2: null, align: [6, 26] },
  { v: 5, size: 37, dataCap: 108, ecPerBlock: 26, b1: { data: 108, blocks: 1 }, b2: null, align: [6, 30] },
  { v: 6, size: 41, dataCap: 136, ecPerBlock: 18, b1: { data: 68, blocks: 2 }, b2: null, align: [6, 34] },
  { v: 7, size: 45, dataCap: 156, ecPerBlock: 20, b1: { data: 78, blocks: 2 }, b2: null, align: [6, 22, 38] },
  { v: 8, size: 49, dataCap: 194, ecPerBlock: 24, b1: { data: 97, blocks: 2 }, b2: null, align: [6, 24, 42] }
];

export function createQrMatrix(text) {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(text);

  let ver = null;
  for (let i = 1; i < VERSIONS_L.length; i++) {
    if (VERSIONS_L[i].dataCap >= rawBytes.length + 3) {
      ver = VERSIONS_L[i];
      break;
    }
  }
  if (!ver) {
    ver = VERSIONS_L[VERSIONS_L.length - 1];
  }

  let bitBuffer = '0100'; // Byte mode
  bitBuffer += rawBytes.length.toString(2).padStart(8, '0');
  for (let i = 0; i < rawBytes.length; i++) {
    bitBuffer += rawBytes[i].toString(2).padStart(8, '0');
  }

  const maxBits = ver.dataCap * 8;
  const padZeros = Math.min(4, maxBits - bitBuffer.length);
  bitBuffer += '0'.repeat(Math.max(0, padZeros));
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer += '0';
  }
  const padBytes = ['11101100', '00010001'];
  let pIdx = 0;
  while (bitBuffer.length < maxBits) {
    bitBuffer += padBytes[pIdx % 2];
    pIdx++;
  }

  const dataBytes = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    dataBytes.push(parseInt(bitBuffer.slice(i, i + 8), 2));
  }

  const blocks = [];
  const eccBlocks = [];
  let dOffset = 0;

  const b1 = ver.b1;
  for (let b = 0; b < b1.blocks; b++) {
    const chunk = dataBytes.slice(dOffset, dOffset + b1.data);
    blocks.push(chunk);
    eccBlocks.push(calculateEcc(chunk, ver.ecPerBlock));
    dOffset += b1.data;
  }
  if (ver.b2) {
    for (let b = 0; b < ver.b2.blocks; b++) {
      const chunk = dataBytes.slice(dOffset, dOffset + ver.b2.data);
      blocks.push(chunk);
      eccBlocks.push(calculateEcc(chunk, ver.ecPerBlock));
      dOffset += ver.b2.data;
    }
  }

  const finalSequence = [];
  const maxBlockLen = Math.max(...blocks.map(b => b.length));
  for (let col = 0; col < maxBlockLen; col++) {
    for (let b = 0; b < blocks.length; b++) {
      if (col < blocks[b].length) {
        finalSequence.push(blocks[b][col]);
      }
    }
  }
  for (let col = 0; col < ver.ecPerBlock; col++) {
    for (let b = 0; b < eccBlocks.length; b++) {
      finalSequence.push(eccBlocks[b][col]);
    }
  }

  let allBits = '';
  for (const byte of finalSequence) {
    allBits += byte.toString(2).padStart(8, '0');
  }

  const N = ver.size;
  const matrix = Array.from({ length: N }, () => new Array(N).fill(-1));
  const isFunction = Array.from({ length: N }, () => new Array(N).fill(false));

  function setFunc(r, c, val) {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      matrix[r][c] = val;
      isFunction[r][c] = true;
    }
  }

  function placeFinder(r0, c0) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = r0 + r;
        const col = c0 + c;
        if (row < 0 || row >= N || col < 0 || col >= N) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            setFunc(row, col, 1);
          } else {
            setFunc(row, col, 0);
          }
        } else {
          setFunc(row, col, 0);
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    if (!isFunction[6][i]) setFunc(6, i, i % 2 === 0 ? 1 : 0);
    if (!isFunction[i][6]) setFunc(i, 6, i % 2 === 0 ? 1 : 0);
  }

  setFunc(4 * ver.v + 9, 8, 1);

  const coords = ver.align;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const r0 = coords[i];
      const c0 = coords[j];
      if ((r0 < 9 && c0 < 9) || (r0 < 9 && c0 > N - 9) || (r0 > N - 9 && c0 < 9)) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
          const isCenter = r === 0 && c === 0;
          setFunc(r0 + r, c0 + c, isBorder || isCenter ? 1 : 0);
        }
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setFunc(8, i, 0);
    if (!isFunction[i][8]) setFunc(i, 8, 0);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][N - 1 - i]) setFunc(8, N - 1 - i, 0);
    if (!isFunction[N - 1 - i][8]) setFunc(N - 1 - i, 8, 0);
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = N - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const left = right - 1;
    const rows = upwards
      ? Array.from({ length: N }, (_, idx) => N - 1 - idx)
      : Array.from({ length: N }, (_, idx) => idx);

    for (const r of rows) {
      for (const c of [right, left]) {
        if (!isFunction[r][c]) {
          let bit = 0;
          if (bitIdx < allBits.length) {
            bit = allBits[bitIdx] === '1' ? 1 : 0;
            bitIdx++;
          }
          const mask = ((r + c) % 2 === 0) ? 1 : 0;
          matrix[r][c] = bit ^ mask;
        }
      }
    }
    upwards = !upwards;
  }

  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  setFunc(8, 0, formatBits[0]);
  setFunc(8, 1, formatBits[1]);
  setFunc(8, 2, formatBits[2]);
  setFunc(8, 3, formatBits[3]);
  setFunc(8, 4, formatBits[4]);
  setFunc(8, 5, formatBits[5]);
  setFunc(8, 7, formatBits[6]);
  setFunc(8, 8, formatBits[7]);
  setFunc(7, 8, formatBits[8]);
  setFunc(5, 8, formatBits[9]);
  setFunc(4, 8, formatBits[10]);
  setFunc(3, 8, formatBits[11]);
  setFunc(2, 8, formatBits[12]);
  setFunc(1, 8, formatBits[13]);
  setFunc(0, 8, formatBits[14]);

  for (let i = 0; i < 7; i++) {
    setFunc(8, N - 1 - i, formatBits[14 - i]);
  }
  for (let i = 0; i < 8; i++) {
    setFunc(N - 8 + i, 8, formatBits[7 - i]);
  }

  return { matrix, size: N };
}

export function renderQrSvg(text, options = {}) {
  const { matrix, size } = createQrMatrix(text);
  const margin = options.margin !== undefined ? options.margin : 4;
  const cellSize = options.cellSize || 5;
  const totalDim = (size + margin * 2) * cellSize;

  let pathData = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        pathData += `M${x},${y}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="100%" style="max-width: ${options.maxWidth || '210px'}; display: block; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
      <rect width="${totalDim}" height="${totalDim}" fill="#ffffff" rx="12" />
      <path d="${pathData.trim()}" fill="#000000" />
    </svg>
  `.trim();
}
