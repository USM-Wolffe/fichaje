"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFichas, type FichaRecord } from "@/lib/db";
import { getProgress, subscribe, type Progress } from "@/lib/processing";
import FichaListItem from "./FichaListItem";

type FichaConThumb = FichaRecord & { thumbUrl: string };

export default function FichaList() {
  const [fichas, setFichas] = useState<FichaConThumb[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [progress, setProgress] = useState<Progress>(getProgress);
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

  // Suscripción al progreso de la cola: cuando una corrida termina, refrescamos
  // la lista para reflejar los cambios (procesada/error). Durante la corrida
  // mantenemos el id de la ficha actual para que el badge muestre "Procesando…".
  // Usamos un ref para conocer el estado previo sin re-suscribirnos en cada
  // emisión (re-suscribir podría perder eventos del store).
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

  return (
    <ul className="divide-y divide-slate-200 border-t border-slate-200">
      {fichas.map((f) => (
        <FichaListItem
          key={f.id}
          ficha={f}
          thumbUrl={f.thumbUrl}
          procesandoEsta={procesandoId === f.id}
        />
      ))}
    </ul>
  );
}
