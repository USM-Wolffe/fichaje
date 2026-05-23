// Cliente Bedrock (Claude). Usa la API key bearer reciente de AWS
// (no SigV4, no SDK) y la Anthropic Messages API vía Bedrock.
//
// Para forzar JSON estructurado usamos TOOL USE (function calling) en
// lugar de pre-fill `{`. El tool_choice forzado obliga a Claude a llamar
// la herramienta `registrar_ficha` con un input que ya viene parseado
// como objeto — sin necesidad de JSON.parse. Esto permite que Claude
// razone internamente antes de devolver la respuesta, en vez de
// arrancar inmediatamente con `{` (lo que daba peor calidad en OCR
// fino de manuscritos).

import {
  CAMPUS_INTERES_OPTIONS,
  CONOCER_VIAS_ADMISION_OPTIONS,
  CURSO_OPTIONS,
  USM_ES_ALTERNATIVA_OPTIONS,
} from "./fields";
import { EXTRACTION_PROMPT } from "./vision-prompt";
import type { RawFicha } from "./vision-types";

const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const DEFAULT_REGION = "us-east-2";
const ANTHROPIC_VERSION = "bedrock-2023-05-31";
const TOOL_NAME = "registrar_ficha";

// JSON Schema derivado de lib/fields.ts (fuente única de verdad). Las
// opciones de los enums se spreadean desde las constantes del archivo
// de campos para que un cambio en `fields.ts` propague aquí
// automáticamente. Los campos de texto pueden ser "" (vacío); los
// enums de selección única incluyen "" en el enum porque el campo es
// opcional. `campusInteres` es un array que puede estar vacío.
const TEXT_FIELD = { type: "string" } as const;
const TOOL_SCHEMA = {
  type: "object",
  properties: {
    nombre: TEXT_FIELD,
    apellidoPaterno: TEXT_FIELD,
    apellidoMaterno: TEXT_FIELD,
    rut: TEXT_FIELD,
    email: TEXT_FIELD,
    telefonoFijo: TEXT_FIELD,
    celular: TEXT_FIELD,
    establecimiento: TEXT_FIELD,
    ciudad: TEXT_FIELD,
    promedioNotas: TEXT_FIELD,
    carrera1: TEXT_FIELD,
    carrera2: TEXT_FIELD,
    carrera3: TEXT_FIELD,
    curso: { type: "string", enum: [...CURSO_OPTIONS, ""] },
    usmEsAlternativa: {
      type: "string",
      enum: [...USM_ES_ALTERNATIVA_OPTIONS, ""],
    },
    campusInteres: {
      type: "array",
      items: { type: "string", enum: [...CAMPUS_INTERES_OPTIONS] },
    },
    conocerViasAdmision: {
      type: "string",
      enum: [...CONOCER_VIAS_ADMISION_OPTIONS, ""],
    },
  },
  required: [
    "nombre",
    "apellidoPaterno",
    "apellidoMaterno",
    "rut",
    "email",
    "telefonoFijo",
    "celular",
    "establecimiento",
    "ciudad",
    "promedioNotas",
    "carrera1",
    "carrera2",
    "carrera3",
    "curso",
    "usmEsAlternativa",
    "campusInteres",
    "conocerViasAdmision",
  ],
} as const;

type BedrockToolUseBlock = {
  type: "tool_use";
  name: string;
  input: Record<string, unknown>;
};
type BedrockTextBlock = { type: "text"; text: string };
type BedrockResponse = {
  content?: Array<BedrockToolUseBlock | BedrockTextBlock>;
};

export async function extractWithBedrock(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<RawFicha> {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) {
    throw new Error(
      "Falta AWS_BEARER_TOKEN_BEDROCK en el entorno del servidor.",
    );
  }
  const region = process.env.AWS_REGION ?? DEFAULT_REGION;
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  try {
    const input = await callBedrock(token, region, modelId, imageBytes, mimeType);
    return ensureRawFicha(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Extracción de ficha (Bedrock): ${msg}`);
  }
}

async function callBedrock(
  token: string,
  region: string,
  modelId: string,
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
  const base64 = Buffer.from(imageBytes).toString("base64");
  const body = {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: 2048,
    temperature: 0,
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Registra los 17 campos extraídos de una ficha de contacto de admisión USM. Devolvé cada campo con el valor leído de la imagen, o cadena vacía si no se ve o está tachado sin reemplazo.",
        input_schema: TOOL_SCHEMA,
      },
    ],
    // Fuerza a Claude a llamar la herramienta — no emite texto libre.
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType, data: base64 },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Bedrock respondió ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as BedrockResponse;
  const toolUse = data.content?.find(
    (c): c is BedrockToolUseBlock =>
      c.type === "tool_use" && c.name === TOOL_NAME,
  );
  if (!toolUse) {
    throw new Error("el modelo no llamó a la herramienta esperada.");
  }
  return toolUse.input;
}

function ensureRawFicha(input: Record<string, unknown>): RawFicha {
  return {
    nombre: input.nombre,
    apellidoPaterno: input.apellidoPaterno,
    apellidoMaterno: input.apellidoMaterno,
    rut: input.rut,
    email: input.email,
    telefonoFijo: input.telefonoFijo,
    celular: input.celular,
    establecimiento: input.establecimiento,
    ciudad: input.ciudad,
    promedioNotas: input.promedioNotas,
    carrera1: input.carrera1,
    carrera2: input.carrera2,
    carrera3: input.carrera3,
    curso: input.curso,
    usmEsAlternativa: input.usmEsAlternativa,
    campusInteres: input.campusInteres,
    conocerViasAdmision: input.conocerViasAdmision,
  };
}
