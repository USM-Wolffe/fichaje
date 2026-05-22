// Único punto que sabe qué modelo de visión usamos. Cambiar de modelo o de
// proveedor = editar solo este archivo. Corre en el servidor (API Route).

import {
  CAMPUS_INTERES_OPTIONS,
  CONOCER_VIAS_ADMISION_OPTIONS,
  CURSO_OPTIONS,
  TEXT_FIELDS,
  USM_ES_ALTERNATIVA_OPTIONS,
  type CampusInteresOption,
  type ConocerViasAdmisionOption,
  type CursoOption,
  type FichaData,
  type TextFieldKey,
  type UsmEsAlternativaOption,
} from "./fields";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `Eres un asistente que extrae datos de una ficha de contacto en papel del
proceso de Admisión de la Universidad Técnica Federico Santa María (USM).
La ficha está escrita a mano y siempre tiene el mismo formato:

DATOS DE TEXTO (líneas o casillas con letra a mano):
- nombre, apellidoPaterno, apellidoMaterno
- rut, email, telefonoFijo, celular
- establecimiento (colegio), ciudad
- promedioNotas
- carrera1, carrera2, carrera3

GRUPOS DE CASILLAS (marcadas con cruz, ticket o relleno):
- curso (UNA opción): Iº, IIº, IIIº, IVº, Egresado.
- usmEsAlternativa (UNA opción, "¿La USM es tu alternativa?"): primera, segunda, tercera, otra.
- campusInteres (PUEDEN ser varias, "Campus de interés"):
  Casa Central Valparaíso, San Joaquín, Vitacura, Concepción, Viña del Mar (JMC).
- conocerViasAdmision (UNA opción, "¿Conoce las vías de admisión?"): Sí, No.

NO extraigas el campo "Fecha" de la ficha.

Devuelve ESTRICTAMENTE un objeto JSON (sin markdown, sin texto extra) con estas
claves exactas y estos valores:

{
  "nombre": string,
  "apellidoPaterno": string,
  "apellidoMaterno": string,
  "rut": string,
  "email": string,
  "telefonoFijo": string,
  "celular": string,
  "establecimiento": string,
  "ciudad": string,
  "promedioNotas": string,
  "carrera1": string,
  "carrera2": string,
  "carrera3": string,
  "curso": "I" | "II" | "III" | "IV" | "Egresado" | "",
  "usmEsAlternativa": "primera" | "segunda" | "tercera" | "otra" | "",
  "campusInteres": array de "casaCentralValparaiso" | "sanJoaquin" | "vitacura" | "concepcion" | "vinaJMC",
  "conocerViasAdmision": "si" | "no" | ""
}

Reglas:
- Si un campo no se ve, está vacío o no se puede leer, devuelve "" (o [] para campusInteres).
- RUT: incluye puntos y guión tal como aparezcan (ej. "12.345.678-9").
- promedioNotas: usa coma decimal chilena (ej. "6,2").
- email: respeta exactamente lo escrito, sin agregar dominios.
- telefonoFijo y celular: solo dígitos, sin espacios ni guiones.
- campusInteres: incluye SOLO los campus con la casilla marcada; usa los códigos
  exactos del esquema (no los nombres en español).
- curso, usmEsAlternativa, conocerViasAdmision: devuelve UNA sola opción; si hay
  ambigüedad o ninguna marcada, devuelve "".
- No agregues claves extra.`;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export async function extractFichaData(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<FichaData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en el entorno del servidor.");
  }

  const base64 = Buffer.from(imageBytes).toString("base64");

  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Gemini respondió ${res.status}: ${errText.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("La respuesta del modelo no contiene texto.");
  }
  return parseFichaJson(text);
}

function parseFichaJson(text: string): FichaData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("El modelo no devolvió JSON válido.");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new Error("El modelo devolvió un formato inesperado.");
  }
  const obj = raw as Record<string, unknown>;

  const textOut = {} as Record<TextFieldKey, string>;
  for (const f of TEXT_FIELDS) {
    const v = obj[f];
    textOut[f] = typeof v === "string" ? v.trim() : "";
  }

  return {
    ...textOut,
    curso: sanitizeEnum<CursoOption>(obj.curso, CURSO_OPTIONS),
    usmEsAlternativa: sanitizeEnum<UsmEsAlternativaOption>(
      obj.usmEsAlternativa,
      USM_ES_ALTERNATIVA_OPTIONS,
    ),
    conocerViasAdmision: sanitizeEnum<ConocerViasAdmisionOption>(
      obj.conocerViasAdmision,
      CONOCER_VIAS_ADMISION_OPTIONS,
    ),
    campusInteres: sanitizeEnumArray<CampusInteresOption>(
      obj.campusInteres,
      CAMPUS_INTERES_OPTIONS,
    ),
  };
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
