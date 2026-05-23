import Link from "next/link";
import CameraCapture from "@/components/CameraCapture";

export default function EscanearPage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <Link
          href="/"
          className="min-h-[44px] flex items-center text-sm text-slate-300 hover:text-white"
        >
          ← Volver
        </Link>
        <h1 className="text-base font-semibold">Escanear fichas</h1>
        <span aria-hidden="true" className="w-12" />
      </header>
      <CameraCapture />
    </main>
  );
}
