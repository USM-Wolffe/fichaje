"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { countFichas, createFicha } from "@/lib/db";

// =============================================================================
// Proporción ancho:alto de la "Ficha de Contacto Admisión USM" en horizontal
// (21 × 14 cm → razón 3:2). Solo importa la razón entre los dos números.
// El marco es SOLO una ayuda visual de alineación: NO recorta la captura.
// La foto guardada es siempre el frame completo del video.
// =============================================================================
const FICHA_ASPECT_RATIO = { width: 210, height: 140 } as const;

// Cuánto del contenedor (ancho o alto, lo que limite) ocupa el marco guía.
// 0.95 = 95% → la ficha se captura cerca y grande, dejando un pequeño borde
// para los controles (botón de captura, contador).
const FRAME_FILL = 0.95;

type EstadoCamara = "iniciando" | "lista" | "error";

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
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
        // Pedimos la cámara trasera y la mayor resolución que el dispositivo
        // pueda entregar; el navegador elige lo más cercano disponible.
        // Más píxeles = el modelo lee mejor las casillas y letras chicas.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
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
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      if (videoW === 0 || videoH === 0) {
        throw new Error("La cámara aún no entrega imagen.");
      }

      // Guardar el frame completo del video, sin recortar al marco guía.
      // El marco es solo una ayuda visual de alineación; el modelo recibe la
      // mayor resolución que el dispositivo entregue.
      canvas.width = videoW;
      canvas.height = videoH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar el lienzo de captura.");
      ctx.drawImage(video, 0, 0, videoW, videoH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("No se pudo crear la imagen.")),
          "image/jpeg",
          0.92,
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

  // Tamaño máximo del marco manteniendo la proporción de la ficha. Las
  // unidades cqw/cqh refieren al contenedor con containerType: "size"; el
  // marco crece hasta tocar el lado más estrecho del contenedor.
  const fillPct = FRAME_FILL * 100;
  const ratioWH = `${FICHA_ASPECT_RATIO.width} / ${FICHA_ASPECT_RATIO.height}`;
  const ratioHW = `${FICHA_ASPECT_RATIO.height} / ${FICHA_ASPECT_RATIO.width}`;
  const frameStyle: CSSProperties = {
    width: `min(${fillPct}cqw, calc(${fillPct}cqh * ${ratioWH}))`,
    height: `min(${fillPct}cqh, calc(${fillPct}cqw * ${ratioHW}))`,
  };

  const containerStyle: CSSProperties = { containerType: "size" };

  return (
    <div
      className="relative flex-1 overflow-hidden bg-black"
      style={containerStyle}
    >
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
            <div
              ref={frameRef}
              className="rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={frameStyle}
            />
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
