import Link from "next/link";
import FichaList from "@/components/FichaList";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900">FichaScan</h1>
        <p className="text-xs text-slate-500">
          Fichas de Contacto Admisión USM
        </p>
      </header>

      <div className="px-4 py-4">
        <Link
          href="/escanear"
          className="block w-full rounded-lg bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-slate-700"
        >
          Escanear fichas
        </Link>
      </div>

      <section aria-label="Fichas guardadas" className="pb-12">
        <FichaList />
      </section>
    </main>
  );
}
