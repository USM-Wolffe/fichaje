"use client";

// Estados visuales no felices de la cámara: cargando o con error de
// permisos / HTTPS. El estado "lista" lo maneja `CaptureControls`.

interface Props {
  estado: "iniciando" | "lista" | "error";
  errorMsg: string;
}

export default function CameraStatusOverlay({ estado, errorMsg }: Props) {
  if (estado === "iniciando") {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
        Abriendo la cámara…
      </div>
    );
  }
  if (estado === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 px-6 text-center text-white">
        <p className="mb-2 text-base font-semibold">No se pudo abrir la cámara</p>
        <p className="text-sm text-slate-300">{errorMsg}</p>
        <p className="mt-3 text-xs text-slate-400">
          Verifica los permisos del navegador y que el sitio se cargue por HTTPS.
        </p>
      </div>
    );
  }
  return null;
}
