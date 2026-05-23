// Cliente Bedrock (Claude). Usa la API key bearer reciente de AWS
// (no SigV4, no SDK) y la Anthropic Messages API expuesta vía Bedrock.
//
// JSON estricto se fuerza con el patrón pre-fill: el último mensaje es
// { role: "assistant", content: "{" }, lo que hace que Claude continúe
// el objeto JSON sin texto preámbulo. Al parsear concatenamos "{" al
// inicio de la respuesta y pasamos por JSON.parse.

import { EXTRACTION_PROMPT } from "./vision-prompt";
import type { RawFicha } from "./vision-types";

const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const DEFAULT_REGION = "us-east-2";
const ANTHROPIC_VERSION = "bedrock-2023-05-31";

type BedrockResponse = {
  content?: Array<{ type?: string; text?: string }>;
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
    const text = await callBedrock(token, region, modelId, imageBytes, mimeType);
    const obj = parsePrefilledJson(text);
    return ensureRawFicha(obj);
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
): Promise<string> {
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
  const base64 = Buffer.from(imageBytes).toString("base64");
  const body = {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: 2048,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64,
            },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
      // Pre-fill: forzamos que la respuesta empiece con "{". Claude
      // continúa el objeto JSON sin agregar markdown ni texto.
      { role: "assistant", content: "{" },
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
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("respuesta sin contenido textual.");
  }
  return text;
}

function parsePrefilledJson(text: string): unknown {
  // Pre-fill: la respuesta empieza con lo que viene DESPUÉS del "{".
  // Lo reconstruimos antes de parsear.
  const candidato = "{" + text;
  try {
    return JSON.parse(candidato);
  } catch {
    throw new Error("el modelo no devolvió JSON válido.");
  }
}

function ensureRawFicha(raw: unknown): RawFicha {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("el modelo devolvió un formato inesperado.");
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
