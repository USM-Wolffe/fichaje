"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREF_KEY = "fichascan.autoCapture";

// Lee/escribe la preferencia auto/manual en localStorage. Si localStorage
// no está disponible (modo privado, cuotas), seguimos en memoria sin crashear.
function readAutoPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeAutoPref(value: boolean): void {
  try {
    window.localStorage.setItem(PREF_KEY, value ? "on" : "off");
  } catch {
    // ignorar
  }
}

// Devuelve el estado actual del modo auto y un toggle persistido.
// La lectura ocurre en un useEffect (no en el primer render) para no romper
// la hidratación SSR.
export function useAutoCapturePref(): {
  enabled: boolean;
  toggle: () => void;
} {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    setEnabled(readAutoPref());
  }, []);
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      writeAutoPref(next);
      return next;
    });
  }, []);
  return { enabled, toggle };
}

// Cuántos frames consecutivos con detección válida hace falta antes de
// disparar. A ~30 fps, 15 frames ≈ 500 ms — suficiente para descartar
// "pasé la cámara por encima de una ficha sin querer" y corto para no
// frustrar al usuario que ya alineó.
const STABLE_FRAMES_NEEDED = 15;

// Bloqueo entre auto-disparos. Da tiempo a procesar la captura (flash
// blanco + IndexedDB) y a que el usuario cambie la ficha física.
const COOLDOWN_MS = 2000;

interface Options {
  enabled: boolean;
  busy: boolean;
  onFire: () => void;
}

interface Result {
  registerFrame: (detected: boolean) => void;
}

// Hook puro: recibe la señal "detectado/no detectado" por frame y decide
// cuándo llamar `onFire`. Sin DOM, sin refs externos, sin lógica de cámara.
export function useAutoCapture(opts: Options): Result {
  const { enabled, busy, onFire } = opts;
  const stableFramesRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const registerFrame = useCallback(
    (detected: boolean) => {
      if (!enabled || busy) {
        stableFramesRef.current = 0;
        return;
      }
      if (!detected) {
        stableFramesRef.current = 0;
        return;
      }
      const now = Date.now();
      if (now < cooldownUntilRef.current) {
        // En cooldown: no acumular para que cuando termine no dispare al primer frame.
        stableFramesRef.current = 0;
        return;
      }
      stableFramesRef.current += 1;
      if (stableFramesRef.current >= STABLE_FRAMES_NEEDED) {
        stableFramesRef.current = 0;
        cooldownUntilRef.current = now + COOLDOWN_MS;
        onFireRef.current();
      }
    },
    [enabled, busy],
  );

  return { registerFrame };
}
