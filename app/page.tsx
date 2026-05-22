import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-3xl font-bold">FichaScan</h1>
      <p className="max-w-md text-base text-gray-600">
        Cimientos del proyecto listos. Las pantallas se construyen en las
        siguientes fases del plan.
      </p>
      {/* Enlace temporal: la Fase D reescribe esta página con la lista real. */}
      <Link
        href="/escanear"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Ir a escanear
      </Link>
    </main>
  );
}
