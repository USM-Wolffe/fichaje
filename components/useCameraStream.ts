"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { countFichas } from "@/lib/db";

export type EstadoCamara = "iniciando" | "lista" | "error";

interface Result {
  videoRef: RefObject<HTMLVideoElement>;
  estado: EstadoCamara;
  errorMsg: string;
  setErrorMsg: (msg: string) => void;
  totalGuardadas: number | null;
  setTotalGuardadas: (updater: (n: number | null) => number | null) => void;
}

// Hook: abre la cámara trasera en la mayor resolución que el dispositivo
// entregue, cuenta las fichas ya guardadas y deja el `videoRef` listo para
// la captura. La detención del stream ocurre en el cleanup del effect.
export function useCameraStream(): Result {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<EstadoCamara>("iniciando");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [totalGuardadas, setTotalGuardadasState] = useState<number | null>(null);

  function setTotalGuardadas(updater: (n: number | null) => number | null) {
    setTotalGuardadasState((prev) => updater(prev));
  }

  useEffect(() => {
    let cancelado = false;
    async function iniciar() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Este navegador no soporta acceso a la cámara.");
        }
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
        setTotalGuardadasState(total);
        setEstado("lista");
      } catch (e) {
        if (cancelado) return;
        setErrorMsg(
          (e as Error).message ||
            "No se pudo abrir la cámara. Revisa los permisos.",
        );
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

  return {
    videoRef,
    estado,
    errorMsg,
    setErrorMsg,
    totalGuardadas,
    setTotalGuardadas,
  };
}
