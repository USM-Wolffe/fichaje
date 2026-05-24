import {
  ALL_FIELDS,
  CAMPUS_INTERES_OPTIONS,
  CONOCER_VIAS_ADMISION_OPTIONS,
  CURSO_OPTIONS,
  USM_ES_ALTERNATIVA_OPTIONS,
} from "./fields";
import { EXTRACTION_PROMPT, rereadPrompt } from "./vision-prompt";
import type { CropImages, RawFicha } from "./vision-types";

const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0";
const DEFAULT_REGION = "us-east-2";
const ANTHROPIC_VERSION = "bedrock-2023-05-31";
const TOOL_NAME = "registrar_ficha";

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
  required: [...ALL_FIELDS],
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

const CROP_LABELS: Record<string, string> = {
  rut: "Recorte ampliado del campo RUT:",
  celular: "Recorte ampliado del campo celular:",
  correo: "Recorte ampliado del campo correo/email:",
};

function getBedrockConfig() {
  const token = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!token) throw new Error("Falta AWS_BEARER_TOKEN_BEDROCK en el entorno del servidor.");
  const region = process.env.AWS_REGION ?? DEFAULT_REGION;
  const modelId = process.env.BEDROCK_MODEL_ID ?? DEFAULT_MODEL;
  const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/invoke`;
  return { token, url };
}

export async function extractWithBedrock(
  imageBytes: ArrayBuffer,
  mimeType: string,
  crops?: CropImages,
): Promise<RawFicha> {
  const { token, url } = getBedrockConfig();
  try {
    const input = await callBedrock(token, url, imageBytes, mimeType, crops);
    return ensureRawFicha(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Extracción de ficha (Bedrock): ${msg}`);
  }
}

async function callBedrock(
  token: string,
  url: string,
  imageBytes: ArrayBuffer,
  mimeType: string,
  crops?: CropImages,
): Promise<Record<string, unknown>> {
  const base64 = Buffer.from(imageBytes).toString("base64");
  const content: Array<Record<string, unknown>> = [
    {
      type: "image",
      source: { type: "base64", media_type: mimeType, data: base64 },
    },
    { type: "text", text: EXTRACTION_PROMPT },
  ];
  if (crops) {
    for (const [key, label] of Object.entries(CROP_LABELS)) {
      const crop = crops[key as keyof CropImages];
      if (crop) {
        content.push({ type: "text", text: label });
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: crop.mimeType,
            data: Buffer.from(crop.bytes).toString("base64"),
          },
        });
      }
    }
  }
  const body = {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: 2048,
    temperature: 0,
    tools: [{
      name: TOOL_NAME,
      description: "Registra los 17 campos extraídos de una ficha de contacto de admisión USM.",
      input_schema: TOOL_SCHEMA,
    }],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content }],
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

export async function rereadFieldWithBedrock(
  cropBytes: ArrayBuffer,
  mimeType: string,
  fieldName: string,
): Promise<string> {
  const { token, url } = getBedrockConfig();
  const body = {
    anthropic_version: ANTHROPIC_VERSION,
    max_tokens: 256,
    temperature: 0.3,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType, data: Buffer.from(cropBytes).toString("base64") } },
        { type: "text", text: rereadPrompt(fieldName) },
      ],
    }],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Bedrock reread respondió ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as BedrockResponse;
  const textBlock = data.content?.find((c): c is BedrockTextBlock => c.type === "text");
  const raw = textBlock?.text ?? "";
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw.replace(/^"|"$/g, "").trim();
  } catch {
    return raw.replace(/^"|"$/g, "").trim();
  }
}

function ensureRawFicha(input: Record<string, unknown>): RawFicha {
  const out = {} as Record<string, unknown>;
  for (const key of ALL_FIELDS) out[key] = input[key];
  return out as unknown as RawFicha;
}
