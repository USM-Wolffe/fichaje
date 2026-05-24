// TEMPORAL — vista de debug para verificar recortes de campos críticos.
// Borrar esta carpeta (app/debug/crops/) cuando ya no se necesite.
"use client";

import { useEffect, useState } from "react";
import { listFichas, type FichaRecord } from "@/lib/db";
import { cropCriticalFields, type CropFieldKey } from "@/lib/field-crops";

const LABELS: Record<CropFieldKey, string> = {
  rut: "RUT",
  celular: "Celular",
  correo: "Correo",
};

const CROP_KEYS: CropFieldKey[] = ["rut", "celular", "correo"];

export default function DebugCropsPage() {
  const [fichas, setFichas] = useState<FichaRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [crops, setCrops] = useState<Record<CropFieldKey, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const items = await listFichas();
        setFichas(items);
      } catch {
        setError("No se pudieron cargar las fichas.");
      }
    }
    void load();
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setCrops(null);
      return;
    }

    const ficha = fichas.find((f) => f.id === selectedId);
    if (!ficha) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCrops(null);

    async function run() {
      try {
        const result = await cropCriticalFields(ficha!.imagen);
        if (cancelled) return;
        const urls = {} as Record<CropFieldKey, string>;
        for (const key of CROP_KEYS) {
          urls[key] = URL.createObjectURL(result[key]!);
        }
        setCrops(urls);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Error al recortar la imagen.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedId, fichas]);

  useEffect(() => {
    return () => {
      if (crops) {
        for (const key of CROP_KEYS) {
          URL.revokeObjectURL(crops[key]!);
        }
      }
    };
  }, [crops]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Vista temporal de debug — solo para verificar recortes
      </div>

      <h1 className="mb-4 text-lg font-bold text-slate-900">
        Debug: Recortes de campos críticos
      </h1>

      {fichas.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No hay fichas capturadas. Escanea al menos una ficha primero.
        </p>
      )}

      {fichas.length > 0 && (
        <div className="mb-6">
          <label
            htmlFor="ficha-select"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Selecciona una ficha
          </label>
          <select
            id="ficha-select"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={selectedId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedId(val ? Number(val) : null);
            }}
          >
            <option value="">— Elige una ficha —</option>
            {fichas.map((f) => (
              <option key={f.id} value={f.id}>
                Ficha #{f.id} —{" "}
                {f.fechaCaptura.toLocaleString("es-CL")}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {loading && (
        <p className="text-sm text-slate-500">Recortando…</p>
      )}

      {crops && (
        <div className="space-y-4">
          {CROP_KEYS.map((key) => (
            <div key={key}>
              <h2 className="mb-1 text-sm font-semibold text-slate-700">
                {LABELS[key]}
              </h2>
              <img
                src={crops[key]}
                alt={`Recorte: ${LABELS[key]}`}
                className="w-full rounded-md border border-slate-200"
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
