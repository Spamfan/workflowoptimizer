// Workflow Optimizer - js/scanner.js (v0.0.3)

export const SCANNER_VERSION = "v0.0.3";

let activeStream = null;

/**
 * Initializes and starts the camera stream on the target video element.
 * @param {HTMLVideoElement} videoEl 
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl) {
  stopCamera(videoEl);

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  };

  try {
    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = activeStream;
    videoEl.setAttribute("playsinline", "true");
    await videoEl.play();
    return activeStream;
  } catch (err) {
    console.error("Camera access failed:", err);
    throw err;
  }
}

/**
 * Stops any active media stream and resets the video element.
 * @param {HTMLVideoElement} videoEl 
 */
export function stopCamera(videoEl) {
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

/**
 * Crops image/video frame strictly to 8.5:11 (US Letter portrait) aspect ratio.
 * @param {HTMLVideoElement|HTMLImageElement} sourceEl 
 * @param {number} rotationAngle 
 * @returns {{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }}
 */
export function captureFrame(sourceEl, rotationAngle = 0) {
  const isVideo = sourceEl instanceof HTMLVideoElement;
  const sw = isVideo ? sourceEl.videoWidth : sourceEl.naturalWidth;
  const sh = isVideo ? sourceEl.videoHeight : sourceEl.naturalHeight;

  if (!sw || !sh) {
    throw new Error("Invalid source dimensions for capture");
  }

  // Standard US Letter Portrait ratio (8.5 / 11 = ~0.7727)
  const targetRatio = 8.5 / 11;
  let cropW = sw;
  let cropH = sw / targetRatio;

  if (cropH > sh) {
    cropH = sh;
    cropW = sh * targetRatio;
  }

  const sx = (sw - cropW) / 2;
  const sy = (sh - cropH) / 2;

  // Offscreen unrotated canvas
  const offCanvas = document.createElement("canvas");
  offCanvas.width = cropW;
  offCanvas.height = cropH;
  const offCtx = offCanvas.getContext("2d");
  offCtx.drawImage(sourceEl, sx, sy, cropW, cropH, 0, 0, cropW, cropH);

  // Output canvas handling optional rotation
  const rads = (rotationAngle * Math.PI) / 180;
  const isPerpendicular = rotationAngle === 90 || rotationAngle === 270;
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = isPerpendicular ? cropH : cropW;
  finalCanvas.height = isPerpendicular ? cropW : cropH;

  const fCtx = finalCanvas.getContext("2d");
  if (rotationAngle !== 0) {
    fCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    fCtx.rotate(rads);
    fCtx.drawImage(offCanvas, -cropW / 2, -cropH / 2);
  } else {
    fCtx.drawImage(offCanvas, 0, 0);
  }

  // High-res JPEG for OCR
  const fullDataUrl = finalCanvas.toDataURL("image/jpeg", 0.90);

  // Compact thumbnail for review metadata card
  const thumbCanvas = document.createElement("canvas");
  const thumbScale = 160 / Math.max(finalCanvas.width, finalCanvas.height);
  thumbCanvas.width = Math.round(finalCanvas.width * thumbScale);
  thumbCanvas.height = Math.round(finalCanvas.height * thumbScale);
  const tCtx = thumbCanvas.getContext("2d");
  tCtx.drawImage(finalCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumbDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.70);

  return { fullDataUrl, thumbDataUrl, canvas: finalCanvas };
}

/**
 * Loads a selected image file into an Image element and crops to 8.5:11.
 * @param {File} file 
 * @param {number} rotationAngle 
 * @returns {Promise<{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }>}
 */
export function processUploadedFile(file, rotationAngle = 0) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(captureFrame(img, rotationAngle));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load uploaded image file"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}