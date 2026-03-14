import { startGame } from "./game";

const uploadScreen = document.getElementById("upload-screen")!;
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

let loadedImage: HTMLImageElement | null = null;

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
      ">Upload your face. Shoot lasers from your eyes.</p>

      <div id="drop-zone" style="
        width: 320px;
        height: 200px;
        border: 2px dashed #333;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.2s;
      ">
        <p style="
          color: #667;
          font-family: 'Courier New', monospace;
          font-size: 16px;
          margin: 0 0 8px 0;
          pointer-events: none;
        ">Drop image here</p>
        <p style="
          color: #445;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          margin: 0;
          pointer-events: none;
        ">or click to browse</p>
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

  const dropZone = document.getElementById("drop-zone")!;
  const fileInput = document.getElementById("file-input") as HTMLInputElement;

  // Click to browse
  dropZone.addEventListener("click", () => fileInput.click());

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
    img.onload = () => {
      loadedImage = img;
      launchGame();
    };
    img.src = reader.result as string;
  };
  reader.readAsDataURL(file);
}

function launchGame() {
  if (!loadedImage) return;
  uploadScreen.style.display = "none";
  canvas.style.display = "block";

  startGame(
    loadedImage,
    () => launchGame(), // restart
    () => showUploadScreen() // back to upload
  );
}

// Boot
showUploadScreen();
