// Detección de contorno y corrección de perspectiva. Encapsula jscanify y
// OpenCV.js para que el resto de la app no sepa qué librería se usa: si
// mañana cambiamos a otra, sólo se toca este archivo.
//
// OpenCV.js (~8 MB) se carga desde CDN al primer `loadScanner()`. jscanify
// es una dependencia npm liviana (wrapper sobre `window.cv`).

const OPENCV_CDN = "https://docs.opencv.org/4.x/opencv.js";
const OPENCV_TIMEOUT_MS = 30_000;
const OPENCV_POLL_MS = 150;
const RESULT_WIDTH = 2400;
const RESULT_HEIGHT = 1600;
const JPEG_QUALITY = 0.92;

// Tipos mínimos de OpenCV.js y jscanify, sólo de los métodos que usamos.
// Sin `any`: si la API se mueve, fallará el compilador en este archivo.

interface CornerPoint {
  x: number;
  y: number;
}

interface PaperCorners {
  topLeftCorner?: CornerPoint;
  topRightCorner?: CornerPoint;
  bottomLeftCorner?: CornerPoint;
  bottomRightCorner?: CornerPoint;
}

interface CvMat {
  delete(): void;
}

interface CvNamespace {
  imread(source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement): CvMat;
  Mat: unknown;
}

interface JScanifyInstance {
  findPaperContour(img: CvMat): CvMat | null;
  getCornerPoints(contour: CvMat): PaperCorners;
  extractPaper(
    image: HTMLCanvasElement,
    resultWidth: number,
    resultHeight: number,
  ): HTMLCanvasElement | null;
}

type JScanifyClass = new () => JScanifyInstance;

type WindowWithCv = Window & { cv?: CvNamespace };

export interface Scanner {
  drawContour(video: HTMLVideoElement, overlay: HTMLCanvasElement): boolean;
  extractFicha(video: HTMLVideoElement): Promise<Blob | null>;
}

function isCvReady(): boolean {
  if (typeof window === "undefined") return false;
  const cv = (window as WindowWithCv).cv;
  return (
    !!cv &&
    typeof cv.imread === "function" &&
    typeof (cv as { Mat: unknown }).Mat === "function"
  );
}

let openCvPromise: Promise<void> | null = null;

function loadOpenCv(): Promise<void> {
  if (openCvPromise) return openCvPromise;
  openCvPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("OpenCV sólo se puede cargar en el navegador."));
      return;
    }
    if (isCvReady()) {
      resolve();
      return;
    }
    if (!document.querySelector('script[data-opencv="true"]')) {
      const script = document.createElement("script");
      script.src = OPENCV_CDN;
      script.async = true;
      script.dataset.opencv = "true";
      script.onerror = () =>
        reject(new Error("No se pudo descargar OpenCV.js."));
      document.head.appendChild(script);
    }
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      if (isCvReady()) {
        window.clearInterval(poll);
        resolve();
      } else if (Date.now() - startedAt > OPENCV_TIMEOUT_MS) {
        window.clearInterval(poll);
        reject(new Error("OpenCV.js tardó demasiado en iniciar."));
      }
    }, OPENCV_POLL_MS);
  });
  return openCvPromise;
}

function drawVideoTo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): boolean {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return false;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(video, 0, 0, w, h);
  return true;
}

export async function loadScanner(): Promise<Scanner> {
  await loadOpenCv();
  const mod = (await import("jscanify/client")) as
    | { default: JScanifyClass }
    | JScanifyClass;
  const Cls: JScanifyClass =
    typeof mod === "function" ? mod : (mod as { default: JScanifyClass }).default;
  const jscanify = new Cls();

  // Canvases reutilizables (evita asignar memoria por frame).
  const frameCanvas = document.createElement("canvas");

  function drawContour(
    video: HTMLVideoElement,
    overlay: HTMLCanvasElement,
  ): boolean {
    if (!drawVideoTo(video, frameCanvas)) return false;
    const cv = (window as WindowWithCv).cv;
    if (!cv) return false;

    const w = frameCanvas.width;
    const h = frameCanvas.height;
    if (overlay.width !== w) overlay.width = w;
    if (overlay.height !== h) overlay.height = h;
    const ctx = overlay.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, w, h);

    const mat = cv.imread(frameCanvas);
    let contour: CvMat | null = null;
    try {
      contour = jscanify.findPaperContour(mat);
      if (!contour) return false;
      const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } =
        jscanify.getCornerPoints(contour);
      if (
        !topLeftCorner ||
        !topRightCorner ||
        !bottomLeftCorner ||
        !bottomRightCorner
      ) {
        return false;
      }
      ctx.strokeStyle = "#22d3ee"; // cyan-400: visible sobre cámara y blanco
      ctx.lineWidth = Math.max(4, Math.round(w / 400));
      ctx.beginPath();
      ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
      ctx.lineTo(topRightCorner.x, topRightCorner.y);
      ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
      ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
      ctx.closePath();
      ctx.stroke();
      return true;
    } finally {
      contour?.delete();
      mat.delete();
    }
  }

  async function extractFicha(video: HTMLVideoElement): Promise<Blob | null> {
    if (!drawVideoTo(video, frameCanvas)) return null;
    const result = jscanify.extractPaper(frameCanvas, RESULT_WIDTH, RESULT_HEIGHT);
    if (!result) return null;
    return new Promise<Blob | null>((resolve, reject) => {
      result.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("No se pudo crear la imagen enderezada.")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    });
  }

  return { drawContour, extractFicha };
}
