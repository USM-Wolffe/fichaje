import { NextResponse } from "next/server";
import { rereadField } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_FIELDS = new Set(["rut", "celular", "correo"]);

export async function POST(req: Request) {
  const accessKey = req.headers.get("x-access-key");
  if (!accessKey || accessKey !== process.env.APP_ACCESS_KEY) {
    return NextResponse.json(
      { error: "Clave de acceso inválida." },
      { status: 401 },
    );
  }

  try {
    const formData = await req.formData();
    const crop = formData.get("crop");
    const field = formData.get("field");
    if (!(crop instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo 'crop' en el formulario." },
        { status: 400 },
      );
    }
    if (typeof field !== "string" || !VALID_FIELDS.has(field)) {
      return NextResponse.json(
        { error: "Campo 'field' inválido. Valores: rut, celular, correo." },
        { status: 400 },
      );
    }
    const bytes = await crop.arrayBuffer();
    const mimeType = crop.type || "image/png";
    const value = await rereadField(bytes, mimeType, field);
    return NextResponse.json({ value });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error desconocido en /api/reread";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
