import {
  listFichasByEstado,
  updateFicha,
  type FichaRecord,
} from "./db";
import type { FichaData } from "./fields";
import { getAccessKey } from "./auth";
import { cropCriticalFields, type CropFieldKey } from "./field-crops";
import { validarFicha } from "./validation";

export type ProcessMode = "todas" | "reintentar-errores";

export type Progress = {
  procesadas: number;
  pendientes: number;
  conError: number;
  actual: { id: number } | null;
  estado: "idle" | "corriendo" | "terminada";
};

// ---------------------------------------------------------------------------
// Store interno. Vive a nivel de módulo para sobrevivir a la navegación entre
// rutas: aunque BatchActions se desmonte, la cola sigue corriendo y el
// componente recupera el estado al re-montarse con getProgress().
// ---------------------------------------------------------------------------
let currentProgress: Progress = {
  procesadas: 0,
  pendientes: 0,
  conError: 0,
  actual: null,
  estado: "idle",
};

const listeners = new Set<(p: Progress) => void>();

function progressEquals(a: Progress, b: Progress): boolean {
  return (
    a.procesadas === b.procesadas &&
    a.pendientes === b.pendientes &&
    a.conError === b.conError &&
    a.estado === b.estado &&
    (a.actual?.id ?? null) === (b.actual?.id ?? null)
  );
}

function emit(next: Progress): void {
  if (progressEquals(currentProgress, next)) return;
  currentProgress = next;
  for (const cb of listeners) cb(next);
}

export function subscribe(cb: (p: Progress) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getProgress(): Progress {
  return currentProgress;
}

// ---------------------------------------------------------------------------
// Single-flight: una sola corrida activa. Una segunda invocación retorna sin
// efecto (no se duplican llamadas al modelo).
// ---------------------------------------------------------------------------
let corriendo = false;

function mensajeCorto(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

async function callExtract(
  imagen: Blob,
  fichaId: number,
  crops?: Record<CropFieldKey, Blob>,
): Promise<FichaData> {
  const formData = new FormData();
  formData.append("image", imagen, `ficha-${fichaId}.jpg`);
  if (crops) {
    for (const [key, blob] of Object.entries(crops)) {
      formData.append(`crop-${key}`, blob, `crop-${key}-${fichaId}.png`);
    }
  }
  const headers: Record<string, string> = {};
  const key = getAccessKey();
  if (key) headers["x-access-key"] = key;
  const res = await fetch("/api/extract", { method: "POST", headers, body: formData });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json !== null &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Error ${res.status}`;
    throw new Error(msg);
  }
  if (json === null || typeof json !== "object" || !("datos" in json)) {
    throw new Error("Respuesta del servidor sin 'datos'.");
  }
  return (json as { datos: FichaData }).datos;
}

async function procesarUna(ficha: FichaRecord): Promise<"procesada" | "error"> {
  if (ficha.id === undefined) return "error";
  try {
    let crops: Record<CropFieldKey, Blob> | undefined;
    try {
      crops = await cropCriticalFields(ficha.imagen);
    } catch {
      // Fallo en el recorte no debe romper el procesamiento
    }
    const datosRaw = await callExtract(ficha.imagen, ficha.id, crops);
    let datos: FichaData = datosRaw;
    let banderas: import("./db").FichaBanderas | null = null;
    try {
      const resultado = validarFicha(datosRaw);
      datos = resultado.datos;
      banderas = resultado.banderas;
    } catch {
      // Validation failure must not break the queue
    }
    await updateFicha(ficha.id, { estado: "procesada", datos, banderas });
    return "procesada";
  } catch (e) {
    await updateFicha(ficha.id, {
      estado: "error",
      errorMensaje: mensajeCorto(e),
    });
    return "error";
  }
}

export async function processAll(opts?: { modo?: ProcessMode }): Promise<void> {
  if (corriendo) return;
  corriendo = true;
  const modo: ProcessMode = opts?.modo ?? "todas";
  try {
    const lote =
      modo === "reintentar-errores"
        ? await listFichasByEstado("error")
        : await listFichasByEstado("capturada");

    let procesadas = 0;
    let conError = 0;
    let pendientes = lote.length;
    emit({
      procesadas,
      pendientes,
      conError,
      actual: null,
      estado: pendientes === 0 ? "terminada" : "corriendo",
    });
    if (pendientes === 0) return;

    for (const ficha of lote) {
      if (ficha.id === undefined) continue;
      // Modo reintento: transición intermedia error → capturada (limpia el
      // mensaje viejo). Si la llamada al modelo vuelve a fallar, procesarUna
      // re-escribirá estado: "error" con el nuevo mensaje.
      if (modo === "reintentar-errores") {
        await updateFicha(ficha.id, {
          estado: "capturada",
          errorMensaje: undefined,
        });
      }
      emit({
        procesadas,
        pendientes,
        conError,
        actual: { id: ficha.id },
        estado: "corriendo",
      });
      const desenlace = await procesarUna(ficha);
      if (desenlace === "procesada") procesadas += 1;
      else conError += 1;
      pendientes -= 1;
      emit({
        procesadas,
        pendientes,
        conError,
        actual: { id: ficha.id },
        estado: "corriendo",
      });
    }

    emit({
      procesadas,
      pendientes: 0,
      conError,
      actual: null,
      estado: "terminada",
    });
  } finally {
    corriendo = false;
  }
}
