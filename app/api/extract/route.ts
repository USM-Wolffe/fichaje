import { NextResponse } from "next/server";
import { extractFichaData } from "@/lib/vision";

// Necesitamos Node runtime para manejar el binario de la imagen con Buffer.
export const runtime = "nodejs";
// En Vercel Pro permite que el modelo se tome hasta 60s; en hobby (10s) Gemini
// Flash igual responde a tiempo en condiciones normales.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo 'image' en el formulario." },
        { status: 400 },
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || "image/jpeg";
    const datos = await extractFichaData(arrayBuffer, mimeType);
    return NextResponse.json({ datos });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error desconocido en /api/extract";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
