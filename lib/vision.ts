// Único punto que sabe qué modelo de visión usamos. Corre en el servidor.
//
// Estrategia: DOS pasadas a Gemini sobre la misma ficha, en paralelo.
//   Pasada 1 — imagen completa → campos de línea libre + casillas de selección.
//   Pasada 2 — recorte AMPLIADO de la zona de casillas de un carácter
//              → nombre, apellidos, RUT, email, teléfonos.
// Ambas devuelven JSON; se unen en un único FichaData con la MISMA estructura
// que esperan la API Route y el resto de la app.

import sharp from "sharp";
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

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// =============================================================================
// CALIBRAR AQUÍ si la pasada 2 lee mal: ajusta esta región hasta que el recorte
// contenga SOLO las casillas de un carácter (nombre, apellidos, RUT, email,
// teléfonos) y nada más. Los valores son fracciones (0-1) del ancho/alto de
// la imagen original — así funcionan con cualquier resolución de cámara.
//   xStart, yStart → esquina superior izquierda del recorte
//   xEnd,   yEnd   → esquina inferior derecha
//   upscale        → veces que se amplía el recorte (2-3 recomendado) para que
//                    cada casilla llegue al modelo con más píxeles
// =============================================================================
const CHARACTER_BOX_CROP = {
  xStart: 0.16,
  yStart: 0.17,
  xEnd: 0.76,
  yEnd: 0.5,
  upscale: 3,
};

const PROMPT_PASADA_1 = `Eres un asistente que extrae datos de una ficha de contacto en papel del
proceso de Admisión de la USM. La ficha está escrita a mano.

Extrae SOLO estos campos:

LÍNEA LIBRE (texto manuscrito en líneas):
establecimiento (colegio), ciudad, promedioNotas, carrera1, carrera2, carrera3.

CASILLAS DE SELECCIÓN (marcadas con cruz/ticket/relleno):
- curso (UNA opción): Iº, IIº, IIIº, IVº, Egresado
- usmEsAlternativa (UNA): primera, segunda, tercera, otra
- campusInteres (VARIAS posibles): Casa Central Valparaíso, San Joaquín,
  Vitacura, Concepción, Viña del Mar (JMC)
- conocerViasAdmision (UNA): Sí, No

NO extraigas: nombre, apellidos, RUT, email, teléfonos (vienen por otra pasada).
NO extraigas el campo "Fecha".

Devuelve JSON ESTRICTO (sin markdown, sin texto extra) con estas claves:
{
  "establecimiento": string, "ciudad": string, "promedioNotas": string,
  "carrera1": string, "carrera2": string, "carrera3": string,
  "curso": "I"|"II"|"III"|"IV"|"Egresado"|"",
  "usmEsAlternativa": "primera"|"segunda"|"tercera"|"otra"|"",
  "campusInteres": array de "casaCentralValparaiso"|"sanJoaquin"|"vitacura"|"concepcion"|"vinaJMC",
  "conocerViasAdmision": "si"|"no"|""
}

Reglas: si un campo no se ve o está vacío, devuelve "" (o [] para
campusInteres); promedioNotas con coma decimal chilena ("6,2"); campusInteres
solo incluye los marcados; no agregues claves extra.`;

const PROMPT_PASADA_2 = `Esta imagen es un RECORTE AMPLIADO de una ficha de
admisión USM. Contiene los datos personales escritos a mano DENTRO DE CASILLAS
DE UN CARÁCTER: una cuadrícula donde cada celda alberga exactamente UNA letra
o UN dígito.

INSTRUCCIONES CRÍTICAS:
- Cada CASILLA contiene EXACTAMENTE UN CARÁCTER. No combines casillas. No
  inventes caracteres en casillas vacías.
- Lee carácter por carácter, casilla por casilla, de izquierda a derecha.
- Si una casilla está vacía, simplemente NO incluyas un carácter en esa posición.
- Letras de nombres y apellidos suelen ser MAYÚSCULAS; email suele ser
  MINÚSCULAS.

Lee SOLO estos campos:
- nombre, apellidoPaterno, apellidoMaterno
- rut: 8 dígitos numéricos + guion + 1 dígito verificador (o "K"),
  ej. "12345678-9"
- email: dirección de correo (DEBE contener "@" y un dominio,
  ej. "ejemplo@gmail.com")
- telefonoFijo: número de teléfono fijo
- celular: número chileno de 9 dígitos (normalmente empieza por 9)

Devuelve JSON ESTRICTO (sin markdown, sin texto extra) con estas claves:
{
  "nombre": string, "apellidoPaterno": string, "apellidoMaterno": string,
  "rut": string, "email": string,
  "telefonoFijo": string, "celular": string
}

Reglas: si un campo no se ve, devuelve ""; rut con guion (puntos opcionales);
telefonoFijo y celular SOLO dígitos, sin espacios ni guiones; email respeta lo
escrito; no agregues claves extra.`;

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

type Pasada1 = {
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

type Pasada2 = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rut: string;
  email: string;
  telefonoFijo: string;
  celular: string;
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
  const recorte = await cropCharacterBoxes(buffer);
  const [p1, p2] = await Promise.all([
    runPasada1(apiKey, buffer, mimeType),
    runPasada2(apiKey, recorte),
  ]);
  return { ...p1, ...p2 };
}

async function cropCharacterBoxes(buffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h) {
      throw new Error("No se pudo leer el tamaño de la imagen.");
    }
    const left = Math.round(CHARACTER_BOX_CROP.xStart * w);
    const top = Math.round(CHARACTER_BOX_CROP.yStart * h);
    const width = Math.max(
      1,
      Math.round((CHARACTER_BOX_CROP.xEnd - CHARACTER_BOX_CROP.xStart) * w),
    );
    const height = Math.max(
      1,
      Math.round((CHARACTER_BOX_CROP.yEnd - CHARACTER_BOX_CROP.yStart) * h),
    );
    return await sharp(buffer)
      .extract({ left, top, width, height })
      .resize({ width: width * CHARACTER_BOX_CROP.upscale })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo recortar la zona de casillas: ${msg}`);
  }
}

async function runPasada1(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<Pasada1> {
  try {
    const raw = await callGemini(apiKey, PROMPT_PASADA_1, buffer, mimeType);
    const obj = ensureObject(raw);
    return {
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
    throw new Error(`Pasada 1 (campos libres + casillas de selección): ${msg}`);
  }
}

async function runPasada2(apiKey: string, croppedBuffer: Buffer): Promise<Pasada2> {
  try {
    const raw = await callGemini(
      apiKey,
      PROMPT_PASADA_2,
      croppedBuffer,
      "image/jpeg",
    );
    const obj = ensureObject(raw);
    return {
      nombre: textVal(obj.nombre),
      apellidoPaterno: textVal(obj.apellidoPaterno),
      apellidoMaterno: textVal(obj.apellidoMaterno),
      rut: textVal(obj.rut),
      email: textVal(obj.email),
      telefonoFijo: textVal(obj.telefonoFijo),
      celular: textVal(obj.celular),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Pasada 2 (casillas de un carácter): ${msg}`);
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
