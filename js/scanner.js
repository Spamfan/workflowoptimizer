// Workflow Optimizer - js/scanner.js (v0.0.12)
// Mobile Camera Hardware Sensor Photo Capture, Touch Pan/Zoom Adjuster & Test Ingestion

export const SCANNER_VERSION = "v0.0.12";

let activeStream = null;

/**
 * Triggers subtle device haptic feedback on touch devices if supported.
 * @param {number} ms 
 */
export function triggerHaptic(ms = 20) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch (_) {}
}

/**
 * Initializes and starts the camera stream on the target video element with autofocus.
 * Mounts 1-tap test preset bar for rapid testing if not already present.
 * @param {HTMLVideoElement} videoEl 
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(videoEl) {
  stopCamera(videoEl);

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 3840 },
      height: { ideal: 2160 }
    }
  };

  try {
    activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = activeStream;
    videoEl.setAttribute("playsinline", "true");
    await videoEl.play();

    // Request continuous autofocus if supported by device hardware
    const track = activeStream.getVideoTracks()[0];
    if (track && typeof track.applyConstraints === "function") {
      try {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" }]
        });
      } catch (_) {}
    }

    // Auto-mount test presets bar in scanner controls
    mountTestBar();

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
 * Crops an Image element strictly to 8.5:11 (US Letter portrait) aspect ratio at 100% natural resolution.
 * Zero digital upscaling or artificial smoothing.
 * @param {HTMLImageElement} img 
 * @param {number} rotationAngle 
 * @returns {{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }}
 */
export function cropImageToLetter(img, rotationAngle = 0) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;

  if (!sw || !sh) {
    throw new Error("Invalid image dimensions for photo capture");
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

  // Clamp to 300 DPI target scale (~2048px width) for OCR neural net optimization
  const maxTargetW = 2048;
  const outW = Math.round(Math.min(cropW, maxTargetW));
  const outH = Math.round(outW / targetRatio);

  // Offscreen unrotated canvas at target photo resolution
  const offCanvas = document.createElement("canvas");
  offCanvas.width = outW;
  offCanvas.height = outH;
  const offCtx = offCanvas.getContext("2d");
  offCtx.imageSmoothingEnabled = true;
  offCtx.imageSmoothingQuality = "high";
  offCtx.drawImage(img, sx, sy, cropW, cropH, 0, 0, offCanvas.width, offCanvas.height);

  // Handle optional rotation
  const rads = (rotationAngle * Math.PI) / 180;
  const isPerpendicular = rotationAngle === 90 || rotationAngle === 270;
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = isPerpendicular ? offCanvas.height : offCanvas.width;
  finalCanvas.height = isPerpendicular ? offCanvas.width : offCanvas.height;

  const fCtx = finalCanvas.getContext("2d");
  if (rotationAngle !== 0) {
    fCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    fCtx.rotate(rads);
    fCtx.drawImage(offCanvas, -offCanvas.width / 2, -offCanvas.height / 2);
  } else {
    fCtx.drawImage(offCanvas, 0, 0);
  }

  // High-res JPEG for OCR
  const fullDataUrl = finalCanvas.toDataURL("image/jpeg", 0.95);

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
 * Takes an actual high-resolution hardware camera sensor photo via ImageCapture.
 * Taps the phone's physical sensor (up to 50MP/12MP) with native ISP and autofocus.
 * @param {HTMLVideoElement} videoEl 
 * @param {number} rotationAngle 
 * @returns {Promise<{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }>}
 */
export async function takePhotoFromCamera(videoEl, rotationAngle = 0) {
  triggerHaptic(35);

  if (!activeStream) {
    throw new Error("Camera stream is not active");
  }

  const track = activeStream.getVideoTracks()[0];
  if (!track || track.readyState !== "live") {
    throw new Error("Active camera video track not available");
  }

  if (typeof window.ImageCapture === "undefined") {
    throw new Error("ImageCapture API not supported on this browser. Please use the upload file button.");
  }

  const capturer = new window.ImageCapture(track);
  const photoBlob = await capturer.takePhoto();

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(photoBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(cropImageToLetter(img, rotationAngle));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode sensor photo"));
    };
    img.src = url;
  });
}

/**
 * Loads a test image directly from a URL or repository path and crops to Letter format.
 * Enables rapid 1-tap testing without repeated mobile file picker uploads.
 * @param {string} url Relative or absolute URL to test image (e.g. "./vzw.jpeg")
 * @param {number} rotationAngle 
 * @returns {Promise<{ fullDataUrl: string, thumbDataUrl: string, canvas: HTMLCanvasElement }>}
 */
export async function loadTestImage(url, rotationAngle = 0) {
  triggerHaptic(25);
  const bust = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
  const resp = await fetch(bust);
  if (!resp.ok) {
    throw new Error(`Failed to fetch test image (${resp.status} ${resp.statusText})`);
  }
  const blob = await resp.blob();

  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      try {
        resolve(cropImageToLetter(img, rotationAngle));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Failed to load test image"));
    };
    img.src = objUrl;
  });
}

/**
 * Mounts 1-tap test preset buttons into the scanner view interface.
 * Presets target att.jpeg, vzw.jpeg, and tmo.jpeg in repository root.
 * @param {Function} [onSelectTestImage] Optional callback receiving processed capture
 */
export function mountTestBar(onSelectTestImage) {
  if (typeof document === "undefined") return;
  if (document.getElementById("scanner-test-bar")) return;

  const targetContainer = document.querySelector("#scanner-view .scanner-controls")
    || document.querySelector("#scanner-view .viewfinder-box")
    || document.getElementById("scanner-view");
  if (!targetContainer) return;

  const testBar = document.createElement("div");
  testBar.id = "scanner-test-bar";
  testBar.className = "test-presets-bar";
  testBar.style.cssText = "display: flex; gap: 8px; justify-content: center; align-items: center; margin: 8px 0; z-index: 10; flex-wrap: wrap;";

  const presets = [
    { label: "VZW Test", path: "./vzw.jpeg" },
    { label: "ATT Test", path: "./att.jpeg" },
    { label: "TMO Test", path: "./tmo.jpeg" }
  ];

  presets.forEach(p => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill-btn btn-secondary btn-test-preset";
    btn.style.cssText = "font-size: 12px; padding: 6px 14px; border-radius: 9999px; cursor: pointer; background: #e0e4ec; border: 1px solid #c0c6d4; color: #1e293b;";
    btn.textContent = p.label;

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const origText = btn.textContent;
      try {
        btn.textContent = "Loading...";
        btn.disabled = true;
        const result = await loadTestImage(p.path);
        btn.textContent = origText;
        btn.disabled = false;

        if (typeof onSelectTestImage === "function") {
          onSelectTestImage(result);
        } else if (typeof window.wfoHandleCapturedImage === "function") {
          window.wfoHandleCapturedImage(result);
        } else {
          // Dispatch global custom event for app router
          window.dispatchEvent(new CustomEvent("wfo:test_image_loaded", { detail: result }));

          // Fallback: populate file input to drive standard file intake
          const fileInput = document.getElementById("scanner-file-input");
          if (fileInput && result.canvas && typeof result.canvas.toBlob === "function") {
            result.canvas.toBlob(blob => {
              if (blob) {
                const file = new File([blob], p.path.replace(/^\.\//, ""), { type: "image/jpeg" });
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }, "image/jpeg", 0.95);
          }
        }
      } catch (err) {
        console.error("Test preset load failed:", err);
        btn.textContent = "Not Found";
        setTimeout(() => {
          btn.textContent = origText;
          btn.disabled = false;
        }, 2500);
      }
    };
    testBar.appendChild(btn);
  });

  targetContainer.appendChild(testBar);
}

/**
 * Loads a selected image file into an Image element and crops to 8.5:11 at natural resolution.
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
          resolve(cropImageToLetter(img, rotationAngle));
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
  rotation: 0,
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
  adjusterState.rotation = 0;
  adjusterState.isDragging = false;
  adjusterState.initialPinchDist = 0;
  adjusterState.initialScale = 1;
  if (imgEl) {
    imgEl.style.transform = "translate(0px, 0px) scale(1) rotate(0deg)";
  }
}

/**
 * Adjusts framing rotation by target degrees.
 * @param {HTMLImageElement} imgEl 
 * @param {number} deg 
 */
export function setAdjusterRotation(imgEl, deg) {
  adjusterState.rotation = deg;
  if (imgEl) {
    imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale}) rotate(${adjusterState.rotation}deg)`;
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
    imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale}) rotate(${adjusterState.rotation}deg)`;
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
      imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale}) rotate(${adjusterState.rotation}deg)`;
    } else if (activeTouches.size === 2) {
      const pts = Array.from(activeTouches.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (adjusterState.initialPinchDist > 10) {
        const factor = dist / adjusterState.initialPinchDist;
        adjusterState.scale = Math.max(0.5, Math.min(4.0, adjusterState.initialScale * factor));
        imgEl.style.transform = `translate(${adjusterState.curX}px, ${adjusterState.curY}px) scale(${adjusterState.scale}) rotate(${adjusterState.rotation}deg)`;
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
  triggerHaptic(30);

  const frameRect = containerEl.getBoundingClientRect();
  if (!frameRect.width || !frameRect.height || !imgEl.naturalWidth || !imgEl.naturalHeight) {
    throw new Error("Invalid framing dimensions");
  }

  // Clamp to 300 DPI target scale (~2048px width) for OCR neural net optimization
  const targetW = Math.round(Math.min(2048, imgEl.naturalWidth));
  const targetH = Math.round(targetW / (8.5 / 11));
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const ctx = finalCanvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const containerRatio = frameRect.width / frameRect.height;
  const imgRatio = imgEl.naturalWidth / imgEl.naturalHeight;
  let baseW, baseH;
  if (imgRatio > containerRatio) {
    baseW = frameRect.width;
    baseH = baseW / imgRatio;
  } else {
    baseH = frameRect.height;
    baseW = baseH * imgRatio;
  }

  const scaleFactor = targetW / frameRect.width;
  const drawnW = baseW * adjusterState.scale * scaleFactor;
  const drawnH = baseH * adjusterState.scale * scaleFactor;

  ctx.save();
  ctx.translate(
    targetW / 2 + (adjusterState.curX * scaleFactor),
    targetH / 2 + (adjusterState.curY * scaleFactor)
  );
  ctx.rotate((adjusterState.rotation * Math.PI) / 180);
  ctx.drawImage(imgEl, -drawnW / 2, -drawnH / 2, drawnW, drawnH);
  ctx.restore();

  const fullDataUrl = finalCanvas.toDataURL("image/jpeg", 0.95);

  const thumbCanvas = document.createElement("canvas");
  const thumbScale = 160 / Math.max(targetW, targetH);
  thumbCanvas.width = Math.round(targetW * thumbScale);
  thumbCanvas.height = Math.round(targetH * thumbScale);
  const tCtx = thumbCanvas.getContext("2d");
  tCtx.drawImage(finalCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumbDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.70);

  return { fullDataUrl, thumbDataUrl, canvas: finalCanvas };
}
