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

// Cuánto tiempo continuo de detección hace falta antes de disparar. Es
// por reloj (no por frames) porque la latencia de OpenCV en móvil hace
// que la tasa real del loop varíe mucho. 350 ms basta para descartar
// "pasé la cámara por encima" y no frustra al usuario que ya alineó.
const STABLE_MS_NEEDED = 350;

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
  const detectionStartRef = useRef(0);
  const cooldownUntilRef = useRef(0);
  const onFireRef = useRef(onFire);
  onFireRef.current = onFire;

  const registerFrame = useCallback(
    (detected: boolean) => {
      if (!enabled || busy || !detected) {
        detectionStartRef.current = 0;
        return;
      }
      const now = Date.now();
      if (now < cooldownUntilRef.current) {
        // En cooldown: no acumular para que cuando termine no dispare al primer frame.
        detectionStartRef.current = 0;
        return;
      }
      if (detectionStartRef.current === 0) {
        detectionStartRef.current = now;
        return;
      }
      if (now - detectionStartRef.current >= STABLE_MS_NEEDED) {
        detectionStartRef.current = 0;
        cooldownUntilRef.current = now + COOLDOWN_MS;
        onFireRef.current();
      }
    },
    [enabled, busy],
  );

  return { registerFrame };
}
