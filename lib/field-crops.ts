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
  const sx = Math.round((region.x / 100) * img.naturalWidth);
  const sy = Math.round((region.y / 100) * img.naturalHeight);
  const sw = Math.round((region.w / 100) * img.naturalWidth);
  const sh = Math.round((region.h / 100) * img.naturalHeight);

  const canvas = createCanvas(sw, sh);
  const ctx = getContext(canvas);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

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
