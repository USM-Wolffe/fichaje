// Único punto de acceso a IndexedDB. Ningún otro archivo debe usar Dexie
// ni `indexedDB` directamente: si necesitas leer o escribir fichas, agrega
// aquí la función que te falte.

import Dexie, { type Table } from "dexie";
import { ALL_FIELDS, type FichaData, type FieldKey } from "./fields";

export type FichaEstado = "capturada" | "procesada" | "error";

// Una bandera `true` significa "celda dudosa" (el modelo no estaba seguro o
// una regla de validación falló). Se usará en el Excel para resaltar.
export type FichaBanderas = Record<FieldKey, boolean>;

export interface FichaRecord {
  id?: number;
  imagen: Blob;
  fechaCaptura: Date;
  estado: FichaEstado;
  // `datos` y `banderas` son null hasta que la ficha pasa por el modelo.
  datos: FichaData | null;
  banderas: FichaBanderas | null;
  errorMensaje?: string;
}

class FichaScanDB extends Dexie {
  fichas!: Table<FichaRecord, number>;

  constructor() {
    super("fichascan");
    // Solo indexamos lo que vamos a consultar/ordenar. La imagen (Blob),
    // `datos` y `banderas` viven en el registro sin índice.
    this.version(1).stores({
      fichas: "++id, fechaCaptura, estado",
    });
  }
}

const db = new FichaScanDB();

// Pedimos persistencia al navegador para que Safari/iOS no descarte el
// IndexedDB cuando el sitio "no tiene suficiente engagement". Es best-effort:
// si el navegador no concede el permiso, seguimos funcionando igual.
if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  void navigator.storage.persist().catch(() => {
    // sin persistencia garantizada; nada más que hacer
  });
}

export async function createFicha(args: {
  imagen: Blob;
  fechaCaptura?: Date;
}): Promise<number> {
  return db.fichas.add({
    imagen: args.imagen,
    fechaCaptura: args.fechaCaptura ?? new Date(),
    estado: "capturada",
    datos: null,
    banderas: null,
  });
}

export async function getFicha(id: number): Promise<FichaRecord | undefined> {
  return db.fichas.get(id);
}

export async function listFichas(): Promise<FichaRecord[]> {
  return db.fichas.orderBy("fechaCaptura").toArray();
}

export async function countFichas(): Promise<number> {
  return db.fichas.count();
}

export type FichaUpdate = Partial<
  Pick<FichaRecord, "estado" | "datos" | "banderas" | "errorMensaje">
>;

export async function updateFicha(
  id: number,
  changes: FichaUpdate,
): Promise<void> {
  await db.fichas.update(id, changes);
}

export async function deleteFicha(id: number): Promise<void> {
  await db.fichas.delete(id);
}

export async function clearFichas(): Promise<void> {
  await db.fichas.clear();
}

// Banderas vacías (todo `false`) para inicializar el campo cuando aún no
// hay validación.
export function emptyBanderas(): FichaBanderas {
  const out = {} as FichaBanderas;
  for (const field of ALL_FIELDS) {
    out[field] = false;
  }
  return out;
}
