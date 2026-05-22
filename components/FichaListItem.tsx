"use client";

import { useState } from "react";
import type { FichaRecord } from "@/lib/db";
import FichaDataView from "./FichaDataView";

type EstadoTono = "info" | "ok" | "warn" | "danger";

function describirEstado(f: FichaRecord): { texto: string; tono: EstadoTono } {
  if (f.estado === "capturada") {
    return { texto: "Capturada", tono: "info" };
  }
  if (f.estado === "error") {
    return { texto: "Con error", tono: "danger" };
  }
  // procesada
  const banderas = f.banderas;
  if (!banderas) {
    return { texto: "Procesada", tono: "ok" };
  }
  let n = 0;
  for (const v of Object.values(banderas)) {
    if (v) n++;
  }
  if (n === 0) return { texto: "Procesada", tono: "ok" };
  return {
    texto: `${n} ${n === 1 ? "celda" : "celdas"} a revisar`,
    tono: "warn",
  };
}

const TONO_CLASSES: Record<EstadoTono, string> = {
  info: "bg-sky-100 text-sky-800",
  ok: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  danger: "bg-rose-100 text-rose-800",
};

interface Props {
  ficha: FichaRecord;
  thumbUrl: string;
  procesandoEsta: boolean;
  puedeProcesar: boolean;
  onProcesar: () => void;
}

export default function FichaListItem({
  ficha,
  thumbUrl,
  procesandoEsta,
  puedeProcesar,
  onProcesar,
}: Props) {
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const { texto, tono } = describirEstado(ficha);
  const tieneDatos = ficha.estado === "procesada" && ficha.datos !== null;

  return (
    <li className="bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-md border border-slate-200 object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-900">
            Ficha #{ficha.id}
          </div>
          <div className="text-xs text-slate-500">
            {ficha.fechaCaptura.toLocaleString("es-CL", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {ficha.estado === "error" && ficha.errorMensaje && (
            <div className="mt-1 truncate text-[11px] text-rose-700">
              {ficha.errorMensaje}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${TONO_CLASSES[tono]}`}
          >
            {procesandoEsta ? "Procesando…" : texto}
          </span>
          {/* TEMPORAL (Fase E): se reemplaza por BatchActions en la Fase G. */}
          {puedeProcesar && (
            <button
              type="button"
              onClick={onProcesar}
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              Procesar
            </button>
          )}
          {tieneDatos && (
            <button
              type="button"
              onClick={() => setMostrarDatos((s) => !s)}
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              {mostrarDatos ? "Ocultar" : "Ver datos"}
            </button>
          )}
        </div>
      </div>
      {mostrarDatos && ficha.datos && <FichaDataView datos={ficha.datos} />}
    </li>
  );
}
