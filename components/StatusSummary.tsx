"use client";

import type { FichaRecord } from "@/lib/db";

interface Props {
  fichas: FichaRecord[];
}

export default function StatusSummary({ fichas }: Props) {
  if (fichas.length === 0) return null;

  let capturadas = 0;
  let procesadas = 0;
  let conError = 0;
  let exportadas = 0;

  for (const f of fichas) {
    switch (f.estado) {
      case "capturada":
        capturadas++;
        break;
      case "procesada":
        procesadas++;
        break;
      case "error":
        conError++;
        break;
      case "exportada":
        exportadas++;
        break;
    }
  }

  return (
    <div className="mx-4 flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
      <span>
        <strong className="text-sky-700">{capturadas}</strong> capturadas
      </span>
      <span>
        <strong className="text-emerald-700">{procesadas}</strong> procesadas
      </span>
      <span>
        <strong className="text-rose-700">{conError}</strong> con error
      </span>
      <span>
        <strong className="text-slate-700">{exportadas}</strong> exportadas
      </span>
    </div>
  );
}
