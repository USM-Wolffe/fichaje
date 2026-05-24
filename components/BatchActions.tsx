"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { clearFichas, listFichasByEstado } from "@/lib/db";
import {
  getProgress,
  processAll,
  subscribe,
  type Progress,
} from "@/lib/processing";

export default function BatchActions() {
  const progress = useSyncExternalStore<Progress>(
    subscribe,
    getProgress,
    getProgress,
  );
  const [pendientesIniciales, setPendientesIniciales] = useState<number | null>(
    null,
  );
  const [procesadasCount, setProcesadasCount] = useState<number | null>(null);
  const [exportadasCount, setExportadasCount] = useState<number | null>(null);
  const [conErrorCount, setConErrorCount] = useState<number | null>(null);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [borrando, setBorrando] = useState(false);

  const refrescarConteos = useCallback(async () => {
    try {
      const [capturadas, procesadas, exportadas, conError] = await Promise.all([
        listFichasByEstado("capturada"),
        listFichasByEstado("procesada"),
        listFichasByEstado("exportada"),
        listFichasByEstado("error"),
      ]);
      setPendientesIniciales(capturadas.length);
      setProcesadasCount(procesadas.length);
      setExportadasCount(exportadas.length);
      setConErrorCount(conError.length);
      setErrorMsg("");
    } catch (e) {
      setErrorMsg(
        (e as Error).message || "No se pudo leer el conteo de fichas.",
      );
    }
  }, []);

  useEffect(() => {
    void refrescarConteos();
  }, [refrescarConteos]);

  useEffect(() => {
    if (progress.estado === "terminada") void refrescarConteos();
  }, [progress.estado, refrescarConteos]);

  const handleExportar = useCallback(async (modo?: "nuevas" | "todas") => {
    setExportando(true);
    setErrorExport("");
    try {
      const { exportarZip } = await import("@/lib/export");
      await exportarZip({ modo: modo ?? "nuevas" });
      await refrescarConteos();
    } catch (e) {
      setErrorExport(
        (e as Error).message || "No se pudo exportar el .zip.",
      );
    } finally {
      setExportando(false);
    }
  }, [refrescarConteos]);

  const handleBorrarTodas = useCallback(async () => {
    const total =
      (pendientesIniciales ?? 0) +
      (procesadasCount ?? 0) +
      (exportadasCount ?? 0) +
      (conErrorCount ?? 0);
    if (total === 0) return;
    const sinExportar = total - (exportadasCount ?? 0);
    const mensaje =
      sinExportar > 0
        ? `Vas a borrar ${total} fichas. ${sinExportar} todavía no se han exportado. ¿Continuar?`
        : `Vas a borrar ${total} fichas. ¿Continuar?`;
    if (!window.confirm(mensaje)) return;
    setBorrando(true);
    try {
      await clearFichas();
      await refrescarConteos();
      document.dispatchEvent(new Event("fichas-cleared"));
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "No se pudieron borrar las fichas.",
      );
    } finally {
      setBorrando(false);
    }
  }, [pendientesIniciales, procesadasCount, exportadasCount, conErrorCount, refrescarConteos]);

  if (errorMsg) {
    return (
      <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {errorMsg}
      </div>
    );
  }

  const corriendo = progress.estado === "corriendo";
  const totalCorrida = progress.procesadas + progress.pendientes + progress.conError;
  const completados = progress.procesadas + progress.conError;
  const porcentaje = corriendo && totalCorrida > 0
    ? Math.round((completados / totalCorrida) * 100)
    : progress.estado === "terminada" ? 100 : 0;
  const pendientesParaBoton = corriendo ? progress.pendientes : (pendientesIniciales ?? 0);
  const exportarDisabled = exportando || corriendo || (procesadasCount ?? 0) === 0;
  const totalReexportar = (procesadasCount ?? 0) + (exportadasCount ?? 0);
  const totalFichas = (pendientesIniciales ?? 0) + (procesadasCount ?? 0) + (exportadasCount ?? 0) + (conErrorCount ?? 0);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void processAll()}
          disabled={corriendo || pendientesParaBoton === 0}
          className="flex-1 rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Procesar todo ({pendientesParaBoton} pendiente
          {pendientesParaBoton === 1 ? "" : "s"})
        </button>
        {progress.conError > 0 && (
          <button
            type="button"
            onClick={() => void processAll({ modo: "reintentar-errores" })}
            disabled={corriendo}
            className="rounded-md border border-rose-300 bg-white px-3 py-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reintentar errores ({progress.conError})
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleExportar("nuevas")}
          disabled={exportarDisabled}
          className="rounded-md border border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exportando
            ? "Exportando…"
            : `Exportar Excel + imágenes (${procesadasCount ?? 0})`}
        </button>
        {(exportadasCount ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => void handleExportar("todas")}
            disabled={exportando || corriendo}
            className="rounded-md border border-slate-300 bg-white px-3 py-3 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Re-exportar todas ({totalReexportar})
          </button>
        )}
        {totalFichas > 0 && (
          <button
            type="button"
            onClick={() => void handleBorrarTodas()}
            disabled={corriendo || borrando}
            className="rounded-md border border-rose-300 bg-white px-3 py-3 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {borrando ? "Borrando…" : "Borrar todas"}
          </button>
        )}
      </div>

      {errorExport && (
        <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorExport}
        </div>
      )}

      {(corriendo || progress.estado === "terminada") && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span><strong className="text-emerald-700">{progress.procesadas}</strong> procesadas</span>
            <span><strong className="text-slate-900">{progress.pendientes}</strong> pendientes</span>
            <span><strong className="text-rose-700">{progress.conError}</strong> con error</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-slate-900 transition-[width] duration-200" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="text-xs text-slate-500">
            {corriendo && progress.actual ? `Procesando ficha #${progress.actual.id}…` : progress.estado === "terminada" ? "Procesamiento terminado." : ""}
          </div>
        </div>
      )}
    </div>
  );
}
