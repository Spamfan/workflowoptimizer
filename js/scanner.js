// Workflow Optimizer - js/scanner.js (v0.0.4)

export const SCANNER_VERSION = "v0.0.4";

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

/**
 * Loads a file directly into an HTMLImageElement for interactive framing.
 * @param {File} file 
 * @param {HTMLImageElement} imgEl 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadFileToImage(file, imgEl) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      imgEl.onload = () => resolve(imgEl);
      imgEl.onerror = () => reject(new Error("Failed to load uploaded image"));
      imgEl.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

let adjusterState = {
  curX: 0,
  curY: 0,
  scale: 1,
  startX: 0,
  startY: 0,
  isDragging: false,
  initialPinchDist: 0,
  initialScale: 1
};

/**
 * Resets the framing adjuster offsets and transform.
 * @param {HTMLImageElement} imgEl 
 */
export function resetAdjuster(imgEl) {
  adjusterState.curX = 0;
  adjusterState.curY = 0;
  adjusterState.scale = 1;
  adjusterState.isDragging = false;
  adjusterState.initialPinchDist = 0;
  if (imgEl) {
    imgEl.style.transform = "translate(0px, 0px) scale(1)";
  }
}

/**
 * Adjusts framing zoom by a relative delta.
 * @param {HTMLImageElement} imgEl 
 * @param {number} delta 
 */
export function setAdjusterZoom(imgEl, delta) {
  adjusterState.scale = Math.max(0.5, Math.min(4.0, adjusterState.scale + delta));
  if (imgEl) {
    imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale})`;
  }
}

/**
 * Binds pointer pan and multi-touch pinch-to-zoom to the framing container.
 * @param {HTMLImageElement} imgEl 
 * @param {HTMLElement} containerEl 
 */
export function initAdjuster(imgEl, containerEl) {
  resetAdjuster(imgEl);
  const activeTouches = new Map();

  containerEl.onpointerdown = (e) => {
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeTouches.size === 1) {
      adjusterState.isDragging = true;
      adjusterState.startX = e.clientX - adjusterState.curX;
      adjusterState.startY = e.clientY - adjusterState.curY;
    } else if (activeTouches.size === 2) {
      adjusterState.isDragging = false;
      const pts = Array.from(activeTouches.values());
      adjusterState.initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      adjusterState.initialScale = adjusterState.scale;
    }
    try {
      containerEl.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  containerEl.onpointermove = (e) => {
    if (!activeTouches.has(e.pointerId)) return;
    activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeTouches.size === 1 && adjusterState.isDragging) {
      adjusterState.curX = e.clientX - adjusterState.startX;
      adjusterState.curY = e.clientY - adjusterState.startY;
      imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale})`;
    } else if (activeTouches.size === 2) {
      const pts = Array.from(activeTouches.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (adjusterState.initialPinchDist > 0) {
        const factor = dist / adjusterState.initialPinchDist;
        adjusterState.scale = Math.max(0.5, Math.min(4.0, adjusterState.initialScale * factor));
        imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale})`;
      }
    }
  };

  const endPointer = (e) => {
    activeTouches.delete(e.pointerId);
    if (activeTouches.size === 1) {
      adjusterState.isDragging = true;
      const pt = activeTouches.values().next().value;
      adjusterState.startX = pt.x - adjusterState.curX;
      adjusterState.startY = pt.y - adjusterState.curY;
    } else {
      adjusterState.isDragging = false;
    }
  };

  containerEl.onpointerup = endPointer;
  containerEl.onpointercancel = endPointer;

  containerEl.onwheel = (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setAdjusterZoom(imgEl, zoomDelta);
  };
}

/**
 * Extracts the 8.5:11 framed viewport slice from the preview image at natural resolution.
 * @param {HTMLImageElement} imgEl 
 * @param {HTMLElement} containerEl 
 * @returns {{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }}
 */
export function captureAdjustedFrame(imgEl, containerEl) {
  const frameRect = containerEl.getBoundingClientRect();
  const imgRect = imgEl.getBoundingClientRect();

  if (!imgRect.width || !imgRect.height) {
    throw new Error("Invalid preview image bounds");
  }

  const scaleX = imgEl.naturalWidth / imgRect.width;
  const scaleY = imgEl.naturalHeight / imgRect.height;

  const cropX = (frameRect.left - imgRect.left) * scaleX;
  const cropY = (frameRect.top - imgRect.top) * scaleY;
  const cropW = frameRect.width * scaleX;
  const cropH = frameRect.height * scaleY;

  const finalCanvas = document.createElement("canvas");
  const targetW = Math.max(1275, Math.round(cropW));
  const targetH = Math.round(targetW * (11 / 8.5));
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;

  const ctx = finalCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(imgEl, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

  const fullDataUrl = finalCanvas.toDataURL("image/jpeg", 0.90);

  const thumbCanvas = document.createElement("canvas");
  const thumbScale = 160 / Math.max(targetW, targetH);
  thumbCanvas.width = Math.round(targetW * thumbScale);
  thumbCanvas.height = Math.round(targetH * thumbScale);
  const tCtx = thumbCanvas.getContext("2d");
  tCtx.drawImage(finalCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumbDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.70);

  return { fullDataUrl, thumbDataUrl, canvas: finalCanvas };
}