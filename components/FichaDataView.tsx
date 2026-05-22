// TEMPORAL (Fase E): vista en pantalla de los datos extraídos para poder
// verificar la extracción sin DevTools (clave en el celular). El export real
// a Excel se construye en la Fase H.

import {
  ALL_FIELDS,
  FIELD_LABELS,
  type FichaData,
  type FieldKey,
} from "@/lib/fields";

interface Props {
  datos: FichaData;
}

function formatearValor(key: FieldKey, datos: FichaData): string {
  const v = datos[key];
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  return v === "" ? "—" : v;
}

export default function FichaDataView({ datos }: Props) {
  return (
    <dl className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs">
      {ALL_FIELDS.map((f) => {
        const valor = formatearValor(f, datos);
        const vacio = valor === "—";
        return (
          <div
            key={f}
            className="flex items-start justify-between gap-3 py-1"
          >
            <dt className="flex-shrink-0 font-medium text-slate-600">
              {FIELD_LABELS[f]}
            </dt>
            <dd
              className={`break-words text-right ${
                vacio ? "text-slate-400" : "text-slate-900"
              }`}
            >
              {valor}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
