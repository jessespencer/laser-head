import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";
import { startGame } from "./game";
import { PLAYER_SIZE } from "./types";

const uploadScreen = document.getElementById("upload-screen")!;
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

let loadedImage: HTMLImageElement | null = null;

// ── Background Removal ─────────────────────────────────────────────

async function removeBackground(img: HTMLImageElement): Promise<HTMLImageElement> {
  const blob = await imglyRemoveBackground(img.src, {
    model: "isnet_fp16",
    output: { format: "image/png" },
    progress: (_key, current, total) => {
      updateProgress(total > 0 ? current / total : 0);
    },
  });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const result = new Image();
    result.onload = () => resolve(result);
    result.onerror = reject;
    result.src = url;
  });
}

function showLoadingState(message: string) {
  uploadScreen.innerHTML = `
    <p style="
      color: #889;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      text-align: center;
    ">${message}</p>
    <div id="progress-bar" style="width:280px; height:6px; background:#222; border-radius:3px; overflow:hidden; margin-top:12px">
      <div id="progress-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#ff2020,#ff6600); transition:width 0.2s"></div>
    </div>
  `;
}

function updateProgress(fraction: number) {
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = `${Math.round(fraction * 100)}%`;
}

function showUploadScreen() {
  canvas.style.display = "none";
  uploadScreen.style.display = "flex";

  uploadScreen.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
      user-select: none;
    ">
      <h1 style="
        font-family: 'Courier New', monospace;
        font-size: 56px;
        font-weight: bold;
        background: linear-gradient(180deg, #ff2020, #ff6600);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: none;
        letter-spacing: 8px;
        margin: 0;
      ">LASER HEAD</h1>

      <p style="
        color: #556;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        margin: 0;
      ">Shoot lasers from your eyes.</p>

      <div style="
        display: flex;
        gap: 32px;
        align-items: stretch;
      ">
        <!-- Left: Play with default -->
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 24px;
          border: 2px solid #222;
          border-radius: 12px;
          width: 220px;
        ">
          <img src="${import.meta.env.BASE_URL}default-preview.gif" style="
            width: 140px;
            height: 140px;
            object-fit: contain;
          " />
          <button id="play-btn" style="
            font-family: 'Courier New', monospace;
            font-size: 18px;
            font-weight: bold;
            padding: 12px 40px;
            background: linear-gradient(180deg, #ff2020, #cc1100);
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 4px;
            width: 100%;
          ">PLAY</button>
        </div>

        <!-- Right: Use your own -->
        <div id="drop-zone" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 24px;
          border: 2px dashed #333;
          border-radius: 12px;
          width: 220px;
          cursor: pointer;
          transition: border-color 0.2s;
        ">
          <p style="
            color: #556;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            margin: 0;
            pointer-events: none;
            text-align: center;
            flex: 1;
            display: flex;
            align-items: center;
          ">Drop image here<br/>or click to browse</p>
          <button id="upload-btn" style="
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            padding: 12px 24px;
            background: transparent;
            color: #667;
            border: 2px solid #333;
            border-radius: 8px;
            cursor: pointer;
            letter-spacing: 2px;
            transition: border-color 0.2s, color 0.2s;
            width: 100%;
            pointer-events: none;
          ">UPLOAD</button>
        </div>
      </div>

      <input type="file" id="file-input" accept="image/*" style="display:none" />
    </div>
  `;

  // Style the upload screen container
  uploadScreen.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  `;

  const fileInput = document.getElementById("file-input") as HTMLInputElement;
  const uploadBtn = document.getElementById("upload-btn")!;
  const playBtn = document.getElementById("play-btn")!;

  // Play with default head — skip straight to game
  playBtn.addEventListener("click", () => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      showControlsScreen(() => launchGame());
    };
    img.src = `${import.meta.env.BASE_URL}default-head.png`;
  });

  // Upload your own — entire container is the target
  const dropZone = document.getElementById("drop-zone")!;
  dropZone.addEventListener("click", () => fileInput.click());

  // Hover state
  dropZone.addEventListener("mouseenter", () => {
    dropZone.style.borderColor = "#f44";
    uploadBtn.style.borderColor = "#f44";
    uploadBtn.style.color = "#aab";
  });
  dropZone.addEventListener("mouseleave", () => {
    dropZone.style.borderColor = "#333";
    uploadBtn.style.borderColor = "#333";
    uploadBtn.style.color = "#667";
  });

  // File input change
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.[0]) handleFile(fileInput.files[0]);
  });

  // Drag & drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#f44";
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "#333";
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#333";
    if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
  });
}

function handleFile(file: File) {
  if (!file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = async () => {
      showLoadingState("Removing background...");
      try {
        const bgRemoved = await removeBackground(img);
        showAlignScreen(bgRemoved);
      } catch {
        // Fall back to original image if segmentation fails
        showAlignScreen(img);
      }
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

// ── Align / Crop Screen ──────────────────────────────────────────────

const PREVIEW_SIZE = 300;

function showAlignScreen(img: HTMLImageElement) {
  canvas.style.display = "none";
  uploadScreen.style.display = "flex";

  // Initial scale: fit the smaller dimension to the preview
  const minDim = Math.min(img.width, img.height);
  let scale = PREVIEW_SIZE / minDim;
  let offsetX = (PREVIEW_SIZE - img.width * scale) / 2;
  let offsetY = (PREVIEW_SIZE - img.height * scale) / 2;

  uploadScreen.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      user-select: none;
    ">
      <h1 style="
        font-family: 'Courier New', monospace;
        font-size: 36px;
        font-weight: bold;
        background: linear-gradient(180deg, #ff2020, #ff6600);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: 4px;
        margin: 0;
      ">ALIGN FACE</h1>

      <p style="
        color: #889;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        margin: 0;
      ">Align your eyes with the red zone</p>

      <p style="
        color: #556;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        margin: 0;
      ">Drag to pan · Scroll to zoom</p>

      <canvas id="align-canvas" width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" style="
        width: ${PREVIEW_SIZE}px;
        height: ${PREVIEW_SIZE}px;
        border: 2px solid #ff4422;
        border-radius: 8px;
        cursor: grab;
        background: #111;
        display: block;
      "></canvas>

      <button id="lock-in-btn" style="
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        padding: 12px 48px;
        background: linear-gradient(180deg, #ff2020, #cc1100);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        letter-spacing: 4px;
      ">LOCK IN</button>
    </div>
  `;

  uploadScreen.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  `;

  const alignCanvas = document.getElementById("align-canvas") as HTMLCanvasElement;
  const alignCtx = alignCanvas.getContext("2d")!;

  // ── Drawing ──

  function draw() {
    alignCtx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Dark background
    alignCtx.fillStyle = "#05060f";
    alignCtx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

    // Draw user photo with current pan/zoom
    alignCtx.drawImage(
      img,
      offsetX, offsetY,
      img.width * scale, img.height * scale
    );

    // ── Template overlay ──

    // Faint head outline (ellipse)
    alignCtx.save();
    alignCtx.strokeStyle = "rgba(255, 60, 40, 0.25)";
    alignCtx.lineWidth = 2;
    alignCtx.beginPath();
    alignCtx.ellipse(
      PREVIEW_SIZE / 2,
      PREVIEW_SIZE * 0.46,
      PREVIEW_SIZE * 0.28,
      PREVIEW_SIZE * 0.38,
      0, 0, Math.PI * 2
    );
    alignCtx.stroke();
    alignCtx.restore();

    // Red eye-zone band (40–59% of preview height)
    const bandTop = PREVIEW_SIZE * 0.40;
    const bandBottom = PREVIEW_SIZE * 0.59;
    alignCtx.fillStyle = "rgba(255, 30, 0, 0.18)";
    alignCtx.fillRect(0, bandTop, PREVIEW_SIZE, bandBottom - bandTop);

    // Band border lines
    alignCtx.strokeStyle = "rgba(255, 50, 20, 0.4)";
    alignCtx.lineWidth = 1;
    alignCtx.beginPath();
    alignCtx.moveTo(0, bandTop);
    alignCtx.lineTo(PREVIEW_SIZE, bandTop);
    alignCtx.moveTo(0, bandBottom);
    alignCtx.lineTo(PREVIEW_SIZE, bandBottom);
    alignCtx.stroke();

    // Eye crosshair dots
    const eyeY = (bandTop + bandBottom) / 2;
    const leftEyeX = PREVIEW_SIZE * 0.38;
    const rightEyeX = PREVIEW_SIZE * 0.62;
    alignCtx.fillStyle = "rgba(255, 80, 40, 0.6)";
    for (const ex of [leftEyeX, rightEyeX]) {
      alignCtx.beginPath();
      alignCtx.arc(ex, eyeY, 4, 0, Math.PI * 2);
      alignCtx.fill();

      // Crosshair lines
      alignCtx.strokeStyle = "rgba(255, 80, 40, 0.35)";
      alignCtx.lineWidth = 1;
      alignCtx.beginPath();
      alignCtx.moveTo(ex - 10, eyeY);
      alignCtx.lineTo(ex + 10, eyeY);
      alignCtx.moveTo(ex, eyeY - 10);
      alignCtx.lineTo(ex, eyeY + 10);
      alignCtx.stroke();
    }
  }

  draw();

  // ── Drag to pan ──

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;

  alignCanvas.addEventListener("mousedown", (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    alignCanvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    offsetX = startOffsetX + (e.clientX - dragStartX);
    offsetY = startOffsetY + (e.clientY - dragStartY);
    draw();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    alignCanvas.style.cursor = "grab";
  });

  // ── Scroll to zoom ──

  alignCanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;

    // Zoom centered on the preview center
    const cx = PREVIEW_SIZE / 2;
    const cy = PREVIEW_SIZE / 2;

    offsetX = cx - (cx - offsetX) * zoomFactor;
    offsetY = cy - (cy - offsetY) * zoomFactor;
    scale *= zoomFactor;

    draw();
  }, { passive: false });

  // ── Touch support for drag ──

  let touchId: number | null = null;

  alignCanvas.addEventListener("touchstart", (e) => {
    if (touchId !== null) return;
    const touch = e.touches[0];
    touchId = touch.identifier;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
    e.preventDefault();
  }, { passive: false });

  alignCanvas.addEventListener("touchmove", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchId) {
        offsetX = startOffsetX + (touch.clientX - dragStartX);
        offsetY = startOffsetY + (touch.clientY - dragStartY);
        draw();
        e.preventDefault();
        break;
      }
    }
  }, { passive: false });

  alignCanvas.addEventListener("touchend", (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchId) {
        touchId = null;
        break;
      }
    }
  });

  // ── Lock in ──

  document.getElementById("lock-in-btn")!.addEventListener("click", () => {
    const cropped = cropImage(img, offsetX, offsetY, scale);
    cropped.onload = () => {
      loadedImage = cropped;
      showControlsScreen(() => launchGame());
    };
  });
}

function cropImage(
  img: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number
): HTMLImageElement {
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = PLAYER_SIZE;
  cropCanvas.height = PLAYER_SIZE;
  const ctx = cropCanvas.getContext("2d")!;

  // Map the preview-space transform to the crop canvas
  // The preview is PREVIEW_SIZE x PREVIEW_SIZE, crop is PLAYER_SIZE x PLAYER_SIZE
  const ratio = PLAYER_SIZE / PREVIEW_SIZE;
  ctx.drawImage(
    img,
    offsetX * ratio,
    offsetY * ratio,
    img.width * scale * ratio,
    img.height * scale * ratio
  );

  const result = new Image();
  result.src = cropCanvas.toDataURL();
  return result;
}

function showControlsScreen(onDone: () => void) {
  canvas.style.display = "none";
  uploadScreen.style.display = "flex";

  uploadScreen.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      user-select: none;
    ">
      <h1 style="
        font-family: 'Courier New', monospace;
        font-size: 32px;
        font-weight: bold;
        background: linear-gradient(180deg, #ff2020, #ff6600);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: 4px;
        margin: 0;
      ">CONTROLS</h1>

      <div style="
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-family: 'Courier New', monospace;
      ">
        <div style="display:flex; align-items:center; gap:16px">
          <span style="color:#f44; font-size:20px; width:120px; text-align:right">WASD / Arrows</span>
          <span style="color:#889; font-size:16px">Move</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px">
          <span style="color:#f44; font-size:20px; width:120px; text-align:right">SPACE</span>
          <span style="color:#889; font-size:16px">Shoot lasers</span>
        </div>
        <div style="display:flex; align-items:center; gap:16px">
          <span style="color:#f44; font-size:20px; width:120px; text-align:right">ESC</span>
          <span style="color:#889; font-size:16px">Quit</span>
        </div>
      </div>

      <p style="
        color: #445;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        margin: 0;
        animation: blink 1.2s step-end infinite;
      ">Press any key to start</p>

      <style>
        @keyframes blink {
          50% { opacity: 0; }
        }
      </style>
    </div>
  `;

  uploadScreen.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100%;
  `;

  function dismiss() {
    window.removeEventListener("keydown", dismiss);
    uploadScreen.removeEventListener("click", dismiss);
    onDone();
  }
  window.addEventListener("keydown", dismiss);
  uploadScreen.addEventListener("click", dismiss);
}

function launchGame() {
  if (!loadedImage) return;
  uploadScreen.style.display = "none";
  canvas.style.display = "block";

  startGame(
    loadedImage,
    () => launchGame(), // restart
    () => showUploadScreen() // back to upload (ESC skips align screen)
  );
}

// Boot
showUploadScreen();
