"use client";

// Orquestador de la cola de procesamiento. NO contiene lógica de negocio:
// se suscribe al store de lib/processing.ts, lee el conteo de pendientes
// desde lib/db.ts y delega los disparadores a processAll(). Cualquier
// cambio en cómo se procesa una ficha vive en lib/processing.ts.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { listFichasByEstado } from "@/lib/db";
import { exportarZip } from "@/lib/export";
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
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const refrescarPendientes = useCallback(async () => {
    try {
      const lista = await listFichasByEstado("capturada");
      setPendientesIniciales(lista.length);
      setErrorMsg("");
    } catch (e) {
      setErrorMsg(
        (e as Error).message || "No se pudo leer el conteo de fichas.",
      );
    }
  }, []);

  const refrescarProcesadas = useCallback(async () => {
    try {
      const lista = await listFichasByEstado("procesada");
      setProcesadasCount(lista.length);
    } catch (e) {
      setErrorMsg(
        (e as Error).message || "No se pudo leer el conteo de fichas.",
      );
    }
  }, []);

  useEffect(() => {
    void refrescarPendientes();
    void refrescarProcesadas();
  }, [refrescarPendientes, refrescarProcesadas]);

  // Tras una corrida, el conteo de pendientes se vuelve a leer (algunas
  // pasaron a "procesada" o "error", y el botón debe reflejar el nuevo total).
  useEffect(() => {
    if (progress.estado === "terminada") {
      void refrescarPendientes();
      void refrescarProcesadas();
    }
  }, [progress.estado, refrescarPendientes, refrescarProcesadas]);

  const handleExportar = useCallback(async () => {
    setExportando(true);
    setErrorExport("");
    try {
      await exportarZip();
    } catch (e) {
      setErrorExport(
        (e as Error).message || "No se pudo exportar el .zip.",
      );
    } finally {
      setExportando(false);
    }
  }, []);

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
  const porcentaje =
    corriendo && totalCorrida > 0
      ? Math.round((completados / totalCorrida) * 100)
      : progress.estado === "terminada"
        ? 100
        : 0;
  const pendientesParaBoton = corriendo
    ? progress.pendientes
    : (pendientesIniciales ?? 0);
  const procesarDisabled = corriendo || pendientesParaBoton === 0;
  const reintentarVisible = progress.conError > 0;
  const reintentarDisabled = corriendo;
  const exportarDisabled =
    exportando || corriendo || (procesadasCount ?? 0) === 0;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void processAll()}
          disabled={procesarDisabled}
          className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Procesar todo ({pendientesParaBoton} pendiente
          {pendientesParaBoton === 1 ? "" : "s"})
        </button>
        {reintentarVisible && (
          <button
            type="button"
            onClick={() => void processAll({ modo: "reintentar-errores" })}
            disabled={reintentarDisabled}
            className="rounded-md border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reintentar errores ({progress.conError})
          </button>
        )}
        <button
          type="button"
          onClick={() => void handleExportar()}
          disabled={exportarDisabled}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exportando
            ? "Exportando…"
            : `Exportar Excel + imágenes (${procesadasCount ?? 0})`}
        </button>
      </div>

      {errorExport && (
        <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorExport}
        </div>
      )}

      {(corriendo || progress.estado === "terminada") && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600">
            <span>
              <strong className="text-emerald-700">{progress.procesadas}</strong>{" "}
              procesadas
            </span>
            <span>
              <strong className="text-slate-900">{progress.pendientes}</strong>{" "}
              pendientes
            </span>
            <span>
              <strong className="text-rose-700">{progress.conError}</strong>{" "}
              con error
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-slate-900 transition-[width] duration-200"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <div className="text-xs text-slate-500">
            {corriendo && progress.actual
              ? `Procesando ficha #${progress.actual.id}…`
              : progress.estado === "terminada"
                ? "Procesamiento terminado."
                : ""}
          </div>
        </div>
      )}
    </div>
  );
}
