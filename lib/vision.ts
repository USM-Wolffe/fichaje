// Orquestador: selecciona el provider LLM (Gemini o Bedrock) según la
// env var LLM_PROVIDER y aplica el sanitizado común sobre la respuesta
// cruda. El resto de la app (API Route, cola de procesamiento) consume
// extractFichaData sin saber qué provider hay debajo.

import {
  CAMPUS_INTERES_OPTIONS,
  CONOCER_VIAS_ADMISION_OPTIONS,
  CURSO_OPTIONS,
  USM_ES_ALTERNATIVA_OPTIONS,
  type CampusInteresOption,
  type FichaData,
} from "./fields";
import { extractWithBedrock } from "./vision-bedrock";
import { extractWithGemini } from "./vision-gemini";
import type { RawFicha } from "./vision-types";

type Provider = "gemini" | "bedrock";

function selectProvider(): Provider {
  const raw = process.env.LLM_PROVIDER;
  if (!raw) return "bedrock";
  if (raw === "gemini" || raw === "bedrock") return raw;
  throw new Error(
    `LLM_PROVIDER desconocido: ${raw}. Valores aceptados: "gemini", "bedrock".`,
  );
}

export async function extractFichaData(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<FichaData> {
  const provider = selectProvider();
  const raw =
    provider === "gemini"
      ? await extractWithGemini(imageBytes, mimeType)
      : await extractWithBedrock(imageBytes, mimeType);
  return sanitize(raw);
}

// ---------------------------------------------------------------------------
// Sanitizado compartido: convierte un RawFicha (campos `unknown`) en un
// FichaData estricto. Trimea strings, fuerza enums al rango permitido y
// deduplica el array de campusInteres.
// ---------------------------------------------------------------------------

function sanitize(raw: RawFicha): FichaData {
  return {
    nombre: textVal(raw.nombre),
    apellidoPaterno: textVal(raw.apellidoPaterno),
    apellidoMaterno: textVal(raw.apellidoMaterno),
    rut: textVal(raw.rut),
    email: textVal(raw.email),
    telefonoFijo: textVal(raw.telefonoFijo),
    celular: textVal(raw.celular),
    establecimiento: textVal(raw.establecimiento),
    ciudad: textVal(raw.ciudad),
    promedioNotas: textVal(raw.promedioNotas),
    carrera1: textVal(raw.carrera1),
    carrera2: textVal(raw.carrera2),
    carrera3: textVal(raw.carrera3),
    curso: sanitizeEnum(raw.curso, CURSO_OPTIONS),
    usmEsAlternativa: sanitizeEnum(
      raw.usmEsAlternativa,
      USM_ES_ALTERNATIVA_OPTIONS,
    ),
    campusInteres: sanitizeEnumArray<CampusInteresOption>(
      raw.campusInteres,
      CAMPUS_INTERES_OPTIONS,
    ),
    conocerViasAdmision: sanitizeEnum(
      raw.conocerViasAdmision,
      CONOCER_VIAS_ADMISION_OPTIONS,
    ),
  };
}

function textVal(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function sanitizeEnum<T extends string>(
  value: unknown,
  options: readonly T[],
): T | "" {
  if (typeof value !== "string" || value === "") return "";
  return (options as readonly string[]).includes(value) ? (value as T) : "";
}

function sanitizeEnumArray<T extends string>(
  value: unknown,
  options: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(options);
  const out: T[] = [];
  for (const v of value) {
    if (typeof v === "string" && valid.has(v) && !out.includes(v as T)) {
      out.push(v as T);
    }
  }
  return out;
}
