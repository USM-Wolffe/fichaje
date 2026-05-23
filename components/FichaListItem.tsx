"use client";

import { useRef, useState } from "react";
import { deleteFicha, type FichaRecord } from "@/lib/db";
import { useSwipeToReveal } from "@/lib/hooks/use-swipe-to-reveal";
import FichaDataView from "./FichaDataView";

type EstadoTono = "info" | "ok" | "warn" | "danger" | "neutral";

const REVEAL_WIDTH = 96;
const REVEAL_THRESHOLD = 80;
const DIRECTION_LOCK_PX = 8;

function describirEstado(f: FichaRecord): { texto: string; tono: EstadoTono } {
  if (f.estado === "capturada") return { texto: "Capturada", tono: "info" };
  if (f.estado === "error") return { texto: "Con error", tono: "danger" };
  if (f.estado === "exportada") return { texto: "Exportada", tono: "neutral" };
  const banderas = f.banderas;
  if (!banderas) return { texto: "Procesada", tono: "ok" };
  let n = 0;
  for (const v of Object.values(banderas)) if (v) n++;
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
  neutral: "bg-slate-100 text-slate-600",
};

interface Props {
  ficha: FichaRecord;
  thumbUrl: string;
  procesandoEsta: boolean;
  swipeDeshabilitado: boolean;
  onEliminada: () => void;
}

export default function FichaListItem({
  ficha,
  thumbUrl,
  procesandoEsta,
  swipeDeshabilitado,
  onEliminada,
}: Props) {
  const [mostrarDatos, setMostrarDatos] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string>("");
  const liRef = useRef<HTMLLIElement>(null);

  const swipeOff = swipeDeshabilitado || procesandoEsta;
  const swipe = useSwipeToReveal({
    revealWidth: REVEAL_WIDTH,
    threshold: REVEAL_THRESHOLD,
    directionLockPx: DIRECTION_LOCK_PX,
    disabled: swipeOff,
    outsideRef: liRef,
  });

  const { texto, tono } = describirEstado(ficha);
  const tieneDatos =
    (ficha.estado === "procesada" || ficha.estado === "exportada") &&
    ficha.datos !== null;

  async function confirmarEliminar() {
    if (ficha.id === undefined) return;
    try {
      await deleteFicha(ficha.id);
      onEliminada();
    } catch (e) {
      setErrorEliminar(
        e instanceof Error ? e.message : "No se pudo eliminar la ficha.",
      );
    }
  }

  return (
    <li ref={liRef} className="bg-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          <button
            type="button"
            onClick={() => void confirmarEliminar()}
            disabled={swipeOff}
            className="w-24 bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
        <div
          {...swipe.bindings}
          style={{
            transform: `translateX(${swipe.dx}px)`,
            transition: swipe.arrastrando ? "none" : "transform 180ms ease-out",
            touchAction: "pan-y",
          }}
          className="flex items-center gap-3 bg-white px-4 py-3"
        >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt=""
          draggable={false}
          className="h-16 w-16 flex-shrink-0 select-none rounded-md border border-slate-200 object-cover"
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
          {errorEliminar && (
            <div className="mt-1 truncate text-[11px] text-rose-700">
              {errorEliminar}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${TONO_CLASSES[tono]}`}
          >
            {procesandoEsta ? "Procesando…" : texto}
          </span>
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
      </div>
      {mostrarDatos && ficha.datos && <FichaDataView datos={ficha.datos} />}
    </li>
  );
}
