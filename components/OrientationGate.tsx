"use client";

import { useEffect, useState } from "react";

// Overlay opaco que pide al usuario rotar a horizontal. Cumple de respaldo
// el rol del `screen.orientation.lock` en navegadores que no lo soportan
// (iOS Safari fuera de PWA instalada). Sólo renderiza algo cuando el
// dispositivo está en orientación vertical.
export default function OrientationGate() {
  const [esHorizontal, setEsHorizontal] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const actualizar = () => setEsHorizontal(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    const so = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    so.lock?.("landscape").catch(() => {});
    return () => {
      mq.removeEventListener("change", actualizar);
    };
  }, []);

  if (esHorizontal) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 px-6 text-center text-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-14 w-14 text-slate-300"
        aria-hidden="true"
      >
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path strokeLinecap="round" d="M8 21l3-3M16 21l-3-3" />
      </svg>
      <p className="text-base font-semibold">Gira el celular a horizontal</p>
      <p className="max-w-xs text-sm text-slate-400">
        La pantalla de escaneo se usa con el celular apaisado y la ficha
        horizontal sobre la mesa.
      </p>
    </div>
  );
}
