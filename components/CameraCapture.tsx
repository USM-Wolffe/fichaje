"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createFicha } from "@/lib/db";
import type { Scanner } from "@/lib/scanner";
import OrientationGate from "./OrientationGate";
import CaptureControls from "./CaptureControls";
import CameraStatusOverlay from "./CameraStatusOverlay";
import { useCameraStream } from "./useCameraStream";
import { useAutoCapture, useAutoCapturePref } from "./useAutoCapture";

const JPEG_QUALITY = 0.92;
const FALLBACK_NOTICE_MS = 2000;
const CONTAINER_STYLE: CSSProperties = { containerType: "size" };

export default function CameraCapture() {
  const { videoRef, estado, errorMsg, setErrorMsg, totalGuardadas, setTotalGuardadas } =
    useCameraStream();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Scanner | null>(null);

  const [capturadasSesion, setCapturadasSesion] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [flash, setFlash] = useState(false);
  const [prepWaiting, setPrepWaiting] = useState(true);
  const [scannerError, setScannerError] = useState(false);
  const [fallbackNotice, setFallbackNotice] = useState<string>("");
  const { enabled: autoEnabled, toggle: toggleAuto } = useAutoCapturePref();

  // Carga diferida del scanner (OpenCV.js + jscanify). Si falla, caemos al
  // modo Etapa 1: marco guía estático + captura del frame completo.
  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      try {
        const mod = await import("@/lib/scanner");
        const scanner = await mod.loadScanner();
        if (cancelado) return;
        scannerRef.current = scanner;
      } catch {
        if (cancelado) return;
        setScannerError(true);
      } finally {
        if (!cancelado) setPrepWaiting(false);
      }
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  const capturarRef = useRef<() => void>(() => {});
  const { registerFrame } = useAutoCapture({
    enabled: autoEnabled,
    busy: guardando,
    onFire: () => capturarRef.current(),
  });

  // Loop de detección en vivo. Sólo corre con scanner cargado y cámara lista.
  useEffect(() => {
    if (prepWaiting || scannerError || estado !== "lista") return;
    const scanner = scannerRef.current;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!scanner || !video || !overlay) return;
    let rafId = 0;
    const tick = () => {
      let detected = false;
      try {
        detected = scanner.drawContour(video, overlay);
      } catch {
        // un frame fallido no debe matar el loop
      }
      registerFrame(detected);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [estado, prepWaiting, scannerError, videoRef, registerFrame]);

  async function capturar() {
    if (estado !== "lista" || guardando || prepWaiting) return;
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

      let blob: Blob | null = null;
      let fallback = false;
      const scanner = scannerRef.current;
      if (scanner && !scannerError) {
        try {
          blob = await scanner.extractFicha(video);
        } catch {
          blob = null;
        }
        if (!blob) fallback = true;
      }

      if (!blob) {
        canvas.width = videoW;
        canvas.height = videoH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No se pudo preparar el lienzo de captura.");
        ctx.drawImage(video, 0, 0, videoW, videoH);
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error("No se pudo crear la imagen.")),
            "image/jpeg",
            JPEG_QUALITY,
          );
        });
      }

      await createFicha({ imagen: blob });
      setCapturadasSesion((n) => n + 1);
      setTotalGuardadas((n) => (n ?? 0) + 1);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);
      if (fallback) {
        setFallbackNotice("Ficha sin detectar — se guardó la foto completa.");
        window.setTimeout(() => setFallbackNotice(""), FALLBACK_NOTICE_MS);
      }
    } catch (e) {
      setErrorMsg((e as Error).message || "Error al guardar la ficha.");
    } finally {
      setGuardando(false);
    }
  }
  capturarRef.current = capturar;

  return (
    <div
      className="relative flex-1 overflow-hidden bg-black"
      style={CONTAINER_STYLE}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />
      <canvas
        ref={overlayRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ display: scannerError || prepWaiting ? "none" : undefined }}
      />

      <OrientationGate />

      {estado === "lista" && (
        <CaptureControls
          prepWaiting={prepWaiting}
          guardando={guardando}
          totalGuardadas={totalGuardadas}
          capturadasSesion={capturadasSesion}
          flash={flash}
          fallbackNotice={fallbackNotice}
          autoEnabled={autoEnabled}
          onToggleAuto={toggleAuto}
          onCapturar={capturar}
        />
      )}

      <CameraStatusOverlay estado={estado} errorMsg={errorMsg} />

      {errorMsg && estado === "lista" && (
        <div className="absolute bottom-36 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-rose-900/90 px-3 py-2 text-center text-xs text-white">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
