// Cliente Gemini. Mantiene el comportamiento exacto que tenía
// lib/vision.ts antes del refactor: endpoint generativelanguage,
// auth via ?key=, JSON forzado con responseMimeType.

import { EXTRACTION_PROMPT } from "./vision-prompt";
import type { RawFicha } from "./vision-types";

// Probar a "gemini-2.5-pro" si Flash empieza a fallar mucho sobre imágenes
// limpias.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export async function extractWithGemini(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<RawFicha> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en el entorno del servidor.");
  }
  try {
    const buffer = Buffer.from(imageBytes);
    const raw = await callGemini(apiKey, buffer, mimeType);
    return ensureRawFicha(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Extracción de ficha (Gemini): ${msg}`);
  }
}

async function callGemini(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<unknown> {
  const body = {
    contents: [
      {
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini respondió ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("La respuesta del modelo no contiene texto.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("El modelo no devolvió JSON válido.");
  }
}

// Convierte un objeto desconocido a RawFicha rellenando los campos
// faltantes con sus defaults. No hace sanitizado fino — eso es trabajo
// del orquestador.
function ensureRawFicha(raw: unknown): RawFicha {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("El modelo devolvió un formato inesperado.");
  }
  const obj = raw as Record<string, unknown>;
  return {
    nombre: obj.nombre,
    apellidoPaterno: obj.apellidoPaterno,
    apellidoMaterno: obj.apellidoMaterno,
    rut: obj.rut,
    email: obj.email,
    telefonoFijo: obj.telefonoFijo,
    celular: obj.celular,
    establecimiento: obj.establecimiento,
    ciudad: obj.ciudad,
    promedioNotas: obj.promedioNotas,
    carrera1: obj.carrera1,
    carrera2: obj.carrera2,
    carrera3: obj.carrera3,
    curso: obj.curso,
    usmEsAlternativa: obj.usmEsAlternativa,
    campusInteres: obj.campusInteres,
    conocerViasAdmision: obj.conocerViasAdmision,
  };
}
