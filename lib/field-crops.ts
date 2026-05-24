export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropFieldKey = "rut" | "celular" | "correo";

export const CROP_REGIONS: Record<CropFieldKey, CropRegion> = {
  rut: { x: 5.2, y: 44.6, w: 20.5, h: 5.6 },
  celular: { x: 30.7, y: 67.4, w: 17.9, h: 5.6 },
  correo: { x: 5.0, y: 53.6, w: 44.0, h: 9.8 },
};

const CROP_KEYS = Object.keys(CROP_REGIONS) as CropFieldKey[];

const MARGIN_FACTOR = 0.15;
const PERCENTILE_LOW = 3;
const PERCENTILE_HIGH = 97;

function inflateRegion(r: CropRegion): CropRegion {
  const mx = r.w * MARGIN_FACTOR;
  const my = r.h * MARGIN_FACTOR;
  let x = r.x - mx;
  let y = r.y - my;
  let w = r.w + 2 * mx;
  let h = r.h + 2 * my;
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(w, 100 - x);
  h = Math.min(h, 100 - y);
  return { x, y, w, h };
}

function enhanceContrast(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const totalPixels = width * height;

  const histogram = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
    histogram[gray]!++;
  }

  const lowThreshold = Math.floor((PERCENTILE_LOW / 100) * totalPixels);
  const highThreshold = Math.floor((PERCENTILE_HIGH / 100) * totalPixels);
  let cumulative = 0;
  let pLow = 0;
  let pHigh = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v]!;
    if (cumulative <= lowThreshold) pLow = v;
    if (cumulative < highThreshold) pHigh = v;
  }

  const range = pHigh - pLow || 1;
  for (let i = 0; i < d.length; i += 4) {
    const stretched = Math.round(Math.min(255, Math.max(0, ((d[i]! - pLow) / range) * 255)));
    d[i] = stretched;
    d[i + 1] = stretched;
    d[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
}

function createCanvas(
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function getContext(
  canvas: OffscreenCanvas | HTMLCanvasElement,
): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas.");
  }
  return ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("No se pudo decodificar la imagen de la ficha."));
      img.src = url;
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function cropRegion(
  img: HTMLImageElement,
  region: CropRegion,
): Promise<Blob> {
  const inflated = inflateRegion(region);
  const sx = Math.round((inflated.x / 100) * img.naturalWidth);
  const sy = Math.round((inflated.y / 100) * img.naturalHeight);
  const sw = Math.round((inflated.w / 100) * img.naturalWidth);
  const sh = Math.round((inflated.h / 100) * img.naturalHeight);

  const canvas = createCanvas(sw, sh);
  const ctx = getContext(canvas);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  enhanceContrast(ctx, sw, sh);

  if (canvas instanceof OffscreenCanvas) {
    return await canvas.convertToBlob({ type: "image/png" });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("No se pudo exportar el recorte como imagen."));
    }, "image/png");
  });
}

export async function cropCriticalFields(
  image: Blob,
): Promise<Record<CropFieldKey, Blob>> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(image);
  } catch {
    throw new Error(
      "No se pudo decodificar la imagen de la ficha. Verifica que el archivo sea una imagen válida.",
    );
  }

  try {
    const result = {} as Record<CropFieldKey, Blob>;
    for (const key of CROP_KEYS) {
      result[key] = await cropRegion(img, CROP_REGIONS[key]!);
    }
    return result;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}
