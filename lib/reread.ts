import { getAccessKey } from "./auth";

const REREAD_COUNT = 3;

async function callReread(crop: Blob, fieldName: string): Promise<string> {
  const formData = new FormData();
  formData.append("crop", crop, `crop-${fieldName}.png`);
  formData.append("field", fieldName);
  const headers: Record<string, string> = {};
  const key = getAccessKey();
  if (key) headers["x-access-key"] = key;
  const res = await fetch("/api/reread", {
    method: "POST",
    headers,
    body: formData,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json !== null &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
        ? (json as { error: string }).error
        : `Error ${res.status}`;
    throw new Error(msg);
  }
  if (json === null || typeof json !== "object" || !("value" in json)) {
    throw new Error("Respuesta del servidor sin 'value'.");
  }
  return (json as { value: string }).value;
}

function majority(values: string[]): { value: string; confident: boolean } {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = values[0]!;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = val;
    }
  }
  return { value: best, confident: bestCount >= 2 };
}

export async function rereadWithVoting(
  crop: Blob,
  fieldName: string,
): Promise<{ value: string; confident: boolean }> {
  const readings: string[] = [];
  for (let i = 0; i < REREAD_COUNT; i++) {
    try {
      readings.push(await callReread(crop, fieldName));
    } catch {
      // Una lectura fallida no rompe la votación
    }
  }
  if (readings.length === 0) {
    return { value: "", confident: false };
  }
  return majority(readings);
}
