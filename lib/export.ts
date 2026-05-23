// Genera el .zip final del MVP: un Excel (una fila por ficha procesada,
// celdas dudosas resaltadas en amarillo) + carpeta de imágenes originales.
// Ningún otro archivo debe importar ExcelJS, JSZip ni tocar APIs de descarga
// directamente: pasan por aquí.

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { listFichasByEstado, type FichaRecord } from "./db";
import {
  ALL_FIELDS,
  CHECKBOX_FIELDS,
  FIELD_LABELS,
  type FichaData,
  type FieldKey,
} from "./fields";

const ARCHIVO_COLUMN_LABEL = "Archivo";
const BANDERA_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

function extensionDesdeMime(mime: string): "jpg" | "png" | "bin" {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

function nombreArchivoImagen(ficha: FichaRecord): string {
  const idPad = String(ficha.id ?? 0).padStart(3, "0");
  const ext = extensionDesdeMime(ficha.imagen.type);
  return `ficha-${idPad}.${ext}`;
}

// Convierte el valor extraído de `ficha.datos[campo]` en el string que va en
// la celda del Excel. Los campos uno-de devuelven la opción tal cual (o ""),
// y `campusInteres` (varios-de) se une con ", ".
function serializarCampo(datos: FichaData, campo: FieldKey): string {
  const valor = datos[campo];
  if (campo === "campusInteres") {
    return Array.isArray(valor) ? valor.join(", ") : "";
  }
  if ((CHECKBOX_FIELDS as readonly string[]).includes(campo)) {
    return typeof valor === "string" ? valor : "";
  }
  return typeof valor === "string" ? valor : "";
}

function nombreZipParaHoy(): string {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = String(hoy.getMonth() + 1).padStart(2, "0");
  const d = String(hoy.getDate()).padStart(2, "0");
  return `fichas-${y}-${m}-${d}.zip`;
}

function construirWorkbook(fichas: FichaRecord[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fichas");

  const headerRow = [...ALL_FIELDS.map((f) => FIELD_LABELS[f]), ARCHIVO_COLUMN_LABEL];
  sheet.addRow(headerRow);
  sheet.getRow(1).font = { bold: true };

  for (const ficha of fichas) {
    const datos = ficha.datos;
    if (!datos) continue;
    const fila = [
      ...ALL_FIELDS.map((campo) => serializarCampo(datos, campo)),
      nombreArchivoImagen(ficha),
    ];
    const excelRow = sheet.addRow(fila);
    // Resaltado de banderas: amarillo sobre las celdas marcadas. La columna
    // "Archivo" (última) nunca se resalta porque no es un campo extraído.
    if (ficha.banderas) {
      ALL_FIELDS.forEach((campo, idx) => {
        if (ficha.banderas?.[campo]) {
          excelRow.getCell(idx + 1).fill = BANDERA_FILL;
        }
      });
    }
  }

  return workbook;
}

async function construirZipBlob(
  workbook: ExcelJS.Workbook,
  fichas: FichaRecord[],
): Promise<Blob> {
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const zip = new JSZip();
  zip.file("fichas.xlsx", xlsxBuffer);
  const carpeta = zip.folder("imagenes");
  if (!carpeta) {
    throw new Error("No se pudo crear la carpeta de imágenes dentro del zip.");
  }
  for (const ficha of fichas) {
    carpeta.file(nombreArchivoImagen(ficha), ficha.imagen);
  }
  return zip.generateAsync({ type: "blob" });
}

function dispararDescarga(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportarZip(): Promise<void> {
  try {
    const fichas = await listFichasByEstado("procesada");
    if (fichas.length === 0) return;
    const workbook = construirWorkbook(fichas);
    const blob = await construirZipBlob(workbook, fichas);
    dispararDescarga(blob, nombreZipParaHoy());
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo generar el .zip de exportación: ${detalle}`);
  }
}
