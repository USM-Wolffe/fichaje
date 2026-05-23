"use client";

// Hook genérico para "swipe-to-reveal" sobre un elemento horizontal: el
// usuario arrastra hacia la izquierda para destapar una zona de acción
// que vive *detrás* del contenido. Al soltar, snapea a abierto/cerrado
// según un umbral.
//
// Lo extrajimos de FichaListItem cuando el componente cruzó el límite
// de líneas de CLAUDE.md. Si en el futuro hay un segundo consumidor
// (otra lista con swipe), este es el lugar donde vivirá la lógica.

import { useEffect, useRef, useState, type PointerEvent } from "react";

type Lock = "none" | "horizontal" | "vertical";

interface Options {
  revealWidth: number; // ancho de la zona de acción (clamp del drag)
  threshold: number; // distancia mínima para snapear a abierto
  directionLockPx: number; // píxeles que deciden la dirección del gesto
  disabled: boolean; // si true, los pointer events se ignoran
  outsideRef: React.RefObject<HTMLElement>; // contenedor para detectar click-outside
}

export interface SwipeBindings {
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
}

export interface SwipeState {
  dx: number; // traslación actual (siempre ≤ 0)
  abierta: boolean; // si está snappeada en estado abierto
  arrastrando: boolean; // si hay un drag horizontal en curso
  bindings: SwipeBindings;
}

export function useSwipeToReveal(opts: Options): SwipeState {
  const { revealWidth, threshold, directionLockPx, disabled, outsideRef } = opts;
  const [dx, setDx] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockRef = useRef<Lock>("none");

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    lockRef.current = "none";
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (start === null) return;
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    if (lockRef.current === "none") {
      if (
        Math.abs(deltaX) > directionLockPx &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        lockRef.current = "horizontal";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(deltaY) > directionLockPx) {
        lockRef.current = "vertical";
        return;
      } else {
        return;
      }
    }
    if (lockRef.current === "horizontal") {
      e.preventDefault();
      const base = abierta ? -revealWidth : 0;
      setDx(Math.min(0, Math.max(-revealWidth, base + deltaX)));
    }
  }

  function onPointerEnd() {
    if (lockRef.current === "horizontal") {
      const debeAbrir = dx < -threshold;
      setAbierta(debeAbrir);
      setDx(debeAbrir ? -revealWidth : 0);
    }
    startRef.current = null;
    lockRef.current = "none";
  }

  // Click-outside: cuando está abierta, un pointerdown fuera del
  // contenedor (outsideRef) la cierra. Dentro del contenedor no.
  useEffect(() => {
    if (!abierta) return;
    function onDoc(e: globalThis.PointerEvent) {
      const t = e.target;
      const root = outsideRef.current;
      if (t instanceof Node && root !== null && root.contains(t)) return;
      setAbierta(false);
      setDx(0);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [abierta, outsideRef]);

  return {
    dx,
    abierta,
    arrastrando: startRef.current !== null && lockRef.current === "horizontal",
    bindings: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
