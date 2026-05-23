"use client";

import type { CSSProperties } from "react";

// Marco guía 3:2 (21 × 14 cm): referencia ESTÁTICA siempre visible para que
// el usuario sepa dónde apuntar la cámara antes de que la detección se
// active. El contorno detectado en vivo se dibuja encima como confirmación
// dinámica, pero NO reemplaza al marco como guía de posicionamiento.
const FRAME_RATIO_WH = "210 / 140";
const FRAME_RATIO_HW = "140 / 210";
const FRAME_FILL_PCT = 95;
const FRAME_STYLE: CSSProperties = {
  width: `min(${FRAME_FILL_PCT}cqw, calc(${FRAME_FILL_PCT}cqh * ${FRAME_RATIO_WH}))`,
  height: `min(${FRAME_FILL_PCT}cqh, calc(${FRAME_FILL_PCT}cqw * ${FRAME_RATIO_HW}))`,
};

interface Props {
  prepWaiting: boolean;
  guardando: boolean;
  totalGuardadas: number | null;
  capturadasSesion: number;
  flash: boolean;
  fallbackNotice: string;
  autoEnabled: boolean;
  onToggleAuto: () => void;
  onCapturar: () => void;
}

export default function CaptureControls(props: Props) {
  const {
    prepWaiting,
    guardando,
    totalGuardadas,
    capturadasSesion,
    flash,
    fallbackNotice,
    autoEnabled,
    onToggleAuto,
    onCapturar,
  } = props;

  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-md border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={FRAME_STYLE}
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
        onClick={onToggleAuto}
        aria-pressed={autoEnabled}
        className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md transition ${
          autoEnabled ? "bg-emerald-600/90" : "bg-black/70 text-slate-200"
        }`}
      >
        {autoEnabled ? "Auto" : "Manual"}
      </button>

      {prepWaiting && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-white/90">
          Preparando cámara…
        </div>
      )}

      <button
        type="button"
        onClick={onCapturar}
        disabled={guardando || prepWaiting}
        aria-label="Capturar ficha"
        className="absolute bottom-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border-4 border-white bg-white/95 shadow-lg active:scale-95 disabled:opacity-50"
      />

      {flash && (
        <div className="pointer-events-none absolute inset-0 bg-white opacity-60" />
      )}

      {fallbackNotice && (
        <div className="absolute bottom-36 left-1/2 max-w-[90%] -translate-x-1/2 rounded bg-amber-700/90 px-3 py-2 text-center text-xs text-white">
          {fallbackNotice}
        </div>
      )}
    </>
  );
}
