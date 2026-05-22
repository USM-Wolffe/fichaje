"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFichas, type FichaRecord } from "@/lib/db";

type FichaConThumb = FichaRecord & { thumbUrl: string };

type EstadoTono = "info" | "ok" | "warn" | "danger";

function describirEstado(f: FichaRecord): { texto: string; tono: EstadoTono } {
  if (f.estado === "capturada") {
    return { texto: "Capturada", tono: "info" };
  }
  if (f.estado === "error") {
    return {
      texto: f.errorMensaje ? "Con error" : "Con error",
      tono: "danger",
    };
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

export default function FichaList() {
  const [fichas, setFichas] = useState<FichaConThumb[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // Guardamos las URLs de la carga anterior para revocarlas cuando llega una
  // nueva carga: si no, cada refresh deja blobs huérfanos en memoria.
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
      setErrorMsg("");
    } catch (e) {
      setErrorMsg(
        (e as Error).message || "No se pudieron leer las fichas guardadas.",
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
    // Cuando el usuario vuelve desde /escanear, el router de Next.js puede
    // reutilizar esta pantalla cacheada. Recargamos al volver a ser visibles
    // para que las fichas recién capturadas aparezcan sin recargar a mano.
    function onVisible() {
      if (document.visibilityState === "visible") void cargar();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, [cargar]);

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

  return (
    <ul className="divide-y divide-slate-200 border-t border-slate-200">
      {fichas.map((f) => {
        const { texto, tono } = describirEstado(f);
        return (
          <li
            key={f.id}
            className="flex items-center gap-3 bg-white px-4 py-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.thumbUrl}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-md border border-slate-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">
                Ficha #{f.id}
              </div>
              <div className="text-xs text-slate-500">
                {f.fechaCaptura.toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${TONO_CLASSES[tono]}`}
            >
              {texto}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
