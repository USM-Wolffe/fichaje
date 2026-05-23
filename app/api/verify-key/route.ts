import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const key =
      body !== null && typeof body === "object" && "key" in body
        ? (body as { key: unknown }).key
        : null;

    if (typeof key !== "string" || key !== process.env.APP_ACCESS_KEY) {
      return NextResponse.json(
        { error: "Clave de acceso inválida." },
        { status: 401 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Clave de acceso inválida." },
      { status: 401 },
    );
  }
}
