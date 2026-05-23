// Único punto que sabe qué modelo de visión usamos. Corre en el servidor.
//
// Enfoque actual: UNA sola pasada a Gemini con la imagen completa de la
// ficha. La pasada devuelve los 17 campos en un JSON con la MISMA estructura
// que esperan la API Route y el resto de la app.

import {
  CAMPUS_INTERES_OPTIONS,
  CONOCER_VIAS_ADMISION_OPTIONS,
  CURSO_OPTIONS,
  USM_ES_ALTERNATIVA_OPTIONS,
  type CampusInteresOption,
  type ConocerViasAdmisionOption,
  type CursoOption,
  type FichaData,
  type UsmEsAlternativaOption,
} from "./fields";

// =============================================================================
// Modelo de visión. Único punto que decide cuál se usa; el resto es agnóstico.
// Probar a "gemini-2.5-pro" si Flash empieza a fallar mucho sobre imágenes
// limpias (después de la Etapa 2 de plan-captura.md).
// =============================================================================
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = `Eres un asistente que extrae datos de una ficha de contacto
en papel del proceso de Admisión de la USM. La ficha está escrita a mano.
Extrae TODOS los campos siguientes.

DATOS PERSONALES — escritos en CASILLAS DE UN CARÁCTER (una cuadrícula
donde cada celda alberga EXACTAMENTE UN carácter):
- nombre, apellidoPaterno, apellidoMaterno
- rut: 8 dígitos + guion + 1 dígito verificador (o "K"), ej. "12345678-9"
- email: dirección completa (DEBE contener "@" y un dominio)
- telefonoFijo: número de teléfono fijo
- celular: número chileno de 9 dígitos (normalmente empieza por 9)

Reglas críticas para casillas de un carácter:
- Cada CASILLA contiene EXACTAMENTE UN carácter. No combines casillas. No
  inventes caracteres en casillas vacías.
- Lee carácter por carácter, casilla por casilla, de izquierda a derecha.
- Si una casilla está vacía, simplemente NO incluyas un carácter ahí.
- Letras de nombres y apellidos suelen ser MAYÚSCULAS; email suele ser
  MINÚSCULAS.

LÍNEA LIBRE (texto manuscrito sobre líneas, sin casillas):
establecimiento (colegio), ciudad, promedioNotas, carrera1, carrera2, carrera3.

CASILLAS DE SELECCIÓN (marcadas con cruz/ticket/relleno):
- curso (UNA opción): Iº, IIº, IIIº, IVº, Egresado
- usmEsAlternativa (UNA): primera, segunda, tercera, otra
- campusInteres (VARIAS posibles): Casa Central Valparaíso, San Joaquín,
  Vitacura, Concepción, Viña del Mar (JMC)
- conocerViasAdmision (UNA): Sí, No

NO extraigas el campo "Fecha".

Devuelve JSON ESTRICTO (sin markdown, sin texto extra) con EXACTAMENTE estas
claves:
{
  "nombre": string, "apellidoPaterno": string, "apellidoMaterno": string,
  "rut": string, "email": string,
  "telefonoFijo": string, "celular": string,
  "establecimiento": string, "ciudad": string, "promedioNotas": string,
  "carrera1": string, "carrera2": string, "carrera3": string,
  "curso": "I"|"II"|"III"|"IV"|"Egresado"|"",
  "usmEsAlternativa": "primera"|"segunda"|"tercera"|"otra"|"",
  "campusInteres": array de "casaCentralValparaiso"|"sanJoaquin"|"vitacura"|"concepcion"|"vinaJMC",
  "conocerViasAdmision": "si"|"no"|""
}

Reglas de formato:
- Si un campo no se ve o está vacío, devuelve "" (o [] para campusInteres).
- rut con guion (puntos opcionales).
- telefonoFijo y celular SOLO dígitos, sin espacios ni guiones.
- promedioNotas con coma decimal chilena ("6,2").
- email respeta lo escrito.
- campusInteres solo incluye los marcados.
- No agregues claves extra.`;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type RawFicha = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rut: string;
  email: string;
  telefonoFijo: string;
  celular: string;
  establecimiento: string;
  ciudad: string;
  promedioNotas: string;
  carrera1: string;
  carrera2: string;
  carrera3: string;
  curso: CursoOption | "";
  usmEsAlternativa: UsmEsAlternativaOption | "";
  campusInteres: CampusInteresOption[];
  conocerViasAdmision: ConocerViasAdmisionOption | "";
};

export async function extractFichaData(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<FichaData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en el entorno del servidor.");
  }
  const buffer = Buffer.from(imageBytes);
  return await runExtraction(apiKey, buffer, mimeType);
}

async function runExtraction(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<RawFicha> {
  try {
    const raw = await callGemini(apiKey, PROMPT, buffer, mimeType);
    const obj = ensureObject(raw);
    return {
      nombre: textVal(obj.nombre),
      apellidoPaterno: textVal(obj.apellidoPaterno),
      apellidoMaterno: textVal(obj.apellidoMaterno),
      rut: textVal(obj.rut),
      email: textVal(obj.email),
      telefonoFijo: textVal(obj.telefonoFijo),
      celular: textVal(obj.celular),
      establecimiento: textVal(obj.establecimiento),
      ciudad: textVal(obj.ciudad),
      promedioNotas: textVal(obj.promedioNotas),
      carrera1: textVal(obj.carrera1),
      carrera2: textVal(obj.carrera2),
      carrera3: textVal(obj.carrera3),
      curso: sanitizeEnum(obj.curso, CURSO_OPTIONS),
      usmEsAlternativa: sanitizeEnum(
        obj.usmEsAlternativa,
        USM_ES_ALTERNATIVA_OPTIONS,
      ),
      campusInteres: sanitizeEnumArray(
        obj.campusInteres,
        CAMPUS_INTERES_OPTIONS,
      ),
      conocerViasAdmision: sanitizeEnum(
        obj.conocerViasAdmision,
        CONOCER_VIAS_ADMISION_OPTIONS,
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Extracción de ficha (pasada única): ${msg}`);
  }
}

async function callGemini(
  apiKey: string,
  prompt: string,
  buffer: Buffer,
  mimeType: string,
): Promise<unknown> {
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
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

function ensureObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("El modelo devolvió un formato inesperado.");
  }
  return raw as Record<string, unknown>;
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
