"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFichas, type FichaRecord } from "@/lib/db";
import { getProgress, subscribe, type Progress } from "@/lib/processing";
import FichaListItem from "./FichaListItem";
import StatusSummary from "./StatusSummary";

type FichaConThumb = FichaRecord & { thumbUrl: string };

export default function FichaList() {
  const [fichas, setFichas] = useState<FichaConThumb[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<Progress>(getProgress);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState("");
  const urlsRef = useRef<string[]>([]);

  const cargar = useCallback(async () => {
    try {
      const lista = await listFichas();
      lista.sort(
        (a, b) => b.fechaCaptura.getTime() - a.fechaCaptura.getTime(),
      );
      const nuevasUrls: string[] = [];
      const conThumb: FichaConThumb[] = lista.map((f) => {
        const url = URL.createObjectURL(f.imagen);
        nuevasUrls.push(url);
        return { ...f, thumbUrl: url };
      });
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = nuevasUrls;
      setFichas(conThumb);
      setSelected(new Set());
      setErrorMsg("");
    } catch (e) {
      setErrorMsg(
        (e as Error).message || "No se pudieron leer las fichas guardadas.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
    function onVisible() {
      if (document.visibilityState === "visible") void cargar();
    }
    function onCleared() {
      void cargar();
    }
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("fichas-cleared", onCleared);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("fichas-cleared", onCleared);
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [cargar]);

  const estadoPrevioRef = useRef<Progress["estado"]>(getProgress().estado);
  useEffect(() => {
    const unsub = subscribe((p) => {
      const previo = estadoPrevioRef.current;
      estadoPrevioRef.current = p.estado;
      setProgress(p);
      if (previo === "corriendo" && p.estado === "terminada") {
        void cargar();
      }
    });
    return unsub;
  }, [cargar]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleExportarSeleccion = useCallback(async () => {
    if (selected.size === 0) return;
    setExportando(true);
    setErrorExport("");
    try {
      const { exportarZipByIds } = await import("@/lib/export");
      await exportarZipByIds([...selected]);
      setSelected(new Set());
      await cargar();
    } catch (e) {
      setErrorExport(
        e instanceof Error ? e.message : "No se pudo exportar la selección.",
      );
    } finally {
      setExportando(false);
    }
  }, [selected, cargar]);

  if (errorMsg) {
    return (
      <div className="mx-4 my-6 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {errorMsg}
      </div>
    );
  }

  if (fichas === null) {
    return (
      <p className="px-4 py-8 text-sm text-slate-500">Cargando fichas…</p>
    );
  }

  if (fichas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <div className="text-5xl" aria-hidden="true">
          📋
        </div>
        <h2 className="text-base font-semibold text-slate-700">
          Aún no hay fichas
        </h2>
        <p className="max-w-sm text-sm text-slate-500">
          Cuando captures fichas con la cámara, aparecerán aquí con su
          miniatura y estado.
        </p>
      </div>
    );
  }

  const procesandoId = progress.actual?.id ?? null;
  const swipeDeshabilitado = progress.estado === "corriendo";

  return (
    <div>
      <StatusSummary fichas={fichas} />
      {selected.size > 0 && (
        <div className="mx-4 mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExportarSeleccion()}
            disabled={exportando}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {exportando
              ? "Exportando…"
              : `Exportar selección (${selected.size})`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Deseleccionar
          </button>
        </div>
      )}
      {errorExport && (
        <div className="mx-4 mt-2 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorExport}
        </div>
      )}
      <ul className="mt-2 divide-y divide-slate-200 border-t border-slate-200">
        {fichas.map((f) => {
          const exportable =
            f.estado === "procesada" || f.estado === "exportada";
          return (
            <FichaListItem
              key={f.id}
              ficha={f}
              thumbUrl={f.thumbUrl}
              procesandoEsta={procesandoId === f.id}
              swipeDeshabilitado={swipeDeshabilitado}
              onEliminada={() => void cargar()}
              selected={exportable ? selected.has(f.id!) : false}
              onToggleSelect={exportable ? toggleSelect : null}
            />
          );
        })}
      </ul>
    </div>
  );
}
