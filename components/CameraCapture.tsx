"use client";

import { useEffect, useRef, useState } from "react";
import { countFichas, createFicha } from "@/lib/db";

type EstadoCamara = "iniciando" | "lista" | "error";

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [estado, setEstado] = useState<EstadoCamara>("iniciando");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [capturadasSesion, setCapturadasSesion] = useState(0);
  const [totalGuardadas, setTotalGuardadas] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador no soporta acceso a la cámara.");
        }
        // Pedimos la cámara trasera y la mayor resolución razonable, para
        // que el modelo de visión tenga texto nítido en la Fase E.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const total = await countFichas();
        if (cancelado) return;
        setTotalGuardadas(total);
        setEstado("lista");
      } catch (e) {
        if (cancelado) return;
        const msg =
          (e as Error).message ||
          "No se pudo abrir la cámara. Revisa los permisos.";
        setErrorMsg(msg);
        setEstado("error");
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function capturar() {
    if (estado !== "lista" || guardando) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setGuardando(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) {
        throw new Error("La cámara aún no entrega imagen.");
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar el lienzo de captura.");
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("No se pudo crear la imagen.")),
          "image/jpeg",
          0.9,
        );
      });

      await createFicha({ imagen: blob });
      setCapturadasSesion((n) => n + 1);
      setTotalGuardadas((n) => (n ?? 0) + 1);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);
    } catch (e) {
      setErrorMsg((e as Error).message || "Error al guardar la ficha.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {estado === "lista" && (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[78%] w-[72%] rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          </div>

          <div className="absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-white">
            <div className="text-[10px] uppercase tracking-wide text-slate-300">
              Guardadas en total
            </div>
            <div className="text-3xl font-bold leading-none">
              {totalGuardadas ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-emerald-300">
              +{capturadasSesion} esta sesión
            </div>
          </div>

          <button
            type="button"
            onClick={capturar}
            disabled={guardando}
            aria-label="Capturar ficha"
            className="absolute bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-4 border-white bg-white/95 shadow-lg active:scale-95 disabled:opacity-50"
          />

          {flash && (
            <div className="pointer-events-none absolute inset-0 bg-white opacity-60" />
          )}
        </>
      )}

      {estado === "iniciando" && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
          Abriendo la cámara…
        </div>
      )}

      {estado === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 px-6 text-center text-white">
          <p className="mb-2 text-base font-semibold">
            No se pudo abrir la cámara
          </p>
          <p className="text-sm text-slate-300">{errorMsg}</p>
          <p className="mt-3 text-xs text-slate-400">
            Verifica los permisos del navegador y que el sitio se cargue por
            HTTPS.
          </p>
        </div>
      )}

      {errorMsg && estado === "lista" && (
        <div className="absolute bottom-36 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-rose-900/90 px-3 py-2 text-center text-xs text-white">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
