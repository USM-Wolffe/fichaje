"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFichas, updateFicha, type FichaRecord } from "@/lib/db";
import type { FichaData } from "@/lib/fields";
import FichaListItem from "./FichaListItem";

type FichaConThumb = FichaRecord & { thumbUrl: string };

export default function FichaList() {
  const [fichas, setFichas] = useState<FichaConThumb[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  // TEMPORAL (Fase E): id de la ficha que se está procesando ahora mismo.
  // En la Fase G esto se reemplaza por la cola de BatchActions.
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
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

  // TEMPORAL (Fase E): manda la imagen al endpoint y guarda el resultado.
  // Sirve para verificar la extracción ficha por ficha; la cola real con
  // checkpoints llega en la Fase G.
  async function procesarUna(f: FichaConThumb) {
    if (f.id === undefined || procesandoId !== null) return;
    setProcesandoId(f.id);
    try {
      const formData = new FormData();
      formData.append("image", f.imagen, `ficha-${f.id}.jpg`);
      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === "object" &&
          json !== null &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : `Error ${res.status}`;
        throw new Error(msg);
      }
      if (typeof json !== "object" || json === null || !("datos" in json)) {
        throw new Error("Respuesta del servidor sin 'datos'.");
      }
      const datos = (json as { datos: FichaData }).datos;
      await updateFicha(f.id, { estado: "procesada", datos });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al procesar.";
      if (f.id !== undefined) {
        await updateFicha(f.id, { estado: "error", errorMensaje: msg });
      }
    } finally {
      setProcesandoId(null);
      await cargar();
    }
  }

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
      {fichas.map((f) => (
        <FichaListItem
          key={f.id}
          ficha={f}
          thumbUrl={f.thumbUrl}
          procesandoEsta={procesandoId === f.id}
          puedeProcesar={
            (f.estado === "capturada" || f.estado === "error") &&
            procesandoId === null
          }
          onProcesar={() => void procesarUna(f)}
        />
      ))}
    </ul>
  );
}
