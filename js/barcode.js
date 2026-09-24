// Workflow Optimizer - js/barcode.js (v0.0.1)
// Vanilla Code 128 (Subset B) Linear Barcode SVG Generator

export const BARCODE_VERSION = "v0.0.1";

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
