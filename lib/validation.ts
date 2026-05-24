import {
  CAMPUS_INTERES_OPTIONS,
  CHECKBOX_OPTIONS,
  type CampusInteresOption,
  type FichaData,
} from "./fields";
import type { FichaBanderas } from "./db";

type RutResult = "valid" | "invalid" | "empty";

const KNOWN_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.es",
  "live.com",
  "usm.cl",
  "sansano.usm.cl",
  "icloud.com",
  "protonmail.com",
] as const;

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  const curr: number[] = Array.from({ length: n + 1 }, () => 0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

const CONFUSED_DIGITS: Record<string, string[]> = {
  "1": ["4", "7"],
  "4": ["1", "9"],
  "9": ["4", "1"],
  "7": ["1"],
};

function computeDv(body: string): string {
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  const digits = body.split("").reverse();
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i % weights.length]!;
  }
  const expected = 11 - (sum % 11);
  if (expected === 11) return "0";
  if (expected === 10) return "K";
  return String(expected);
}

function tryFixRut(body: string, dvGiven: string): string | null {
  for (let pos = 0; pos < body.length; pos++) {
    const original = body[pos]!;
    const swaps = CONFUSED_DIGITS[original];
    if (!swaps) continue;
    for (const replacement of swaps) {
      const candidate = body.slice(0, pos) + replacement + body.slice(pos + 1);
      if (computeDv(candidate) === dvGiven) return candidate;
    }
  }
  return null;
}

function validateRut(raw: string): { status: RutResult; normalized: string } {
  const cleaned = raw.replace(/[\s.\-]/g, "").toUpperCase();
  if (cleaned === "") return { status: "empty", normalized: raw };
  if (cleaned.length < 2) return { status: "invalid", normalized: raw };
  const body = cleaned.slice(0, -1);
  const dvGiven = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return { status: "invalid", normalized: raw };

  if (computeDv(body) === dvGiven) {
    return { status: "valid", normalized: body + dvGiven };
  }

  const fixed = tryFixRut(body, dvGiven);
  if (fixed) {
    return { status: "valid", normalized: fixed + dvGiven };
  }

  return { status: "invalid", normalized: raw };
}

function validateEmail(raw: string): { flagged: boolean; corrected: string } {
  if (raw.trim() === "") return { flagged: false, corrected: raw };
  if (/\s/.test(raw.trim())) return { flagged: true, corrected: raw };
  const parts = raw.trim().split("@");
  if (parts.length !== 2) return { flagged: true, corrected: raw };
  const local = parts[0]!;
  const domain = parts[1]!;
  if (local === "" || domain === "") return { flagged: true, corrected: raw };
  const dotIdx = domain.lastIndexOf(".");
  if (dotIdx < 1) return { flagged: true, corrected: raw };
  const tld = domain.slice(dotIdx + 1);
  if (tld.length < 2) return { flagged: true, corrected: raw };

  const domainLower = domain.toLowerCase();
  let bestDomain = domainLower;
  let bestDist = Infinity;
  for (const known of KNOWN_DOMAINS) {
    const dist = levenshtein(domainLower, known);
    if (dist < bestDist) {
      bestDist = dist;
      bestDomain = known;
    }
  }
  if (bestDist > 0 && bestDist <= 2) {
    return { flagged: false, corrected: `${local}@${bestDomain}` };
  }
  return { flagged: false, corrected: raw.trim() };
}

function validateCelular(raw: string): { flagged: boolean; normalized: string } {
  if (raw.trim() === "") return { flagged: false, normalized: raw };
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("56") && d.length === 11) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = d.slice(1);
  return d.length === 9 && d.startsWith("9")
    ? { flagged: false, normalized: d }
    : { flagged: true, normalized: raw };
}

function validateTelefonoFijo(raw: string): { flagged: boolean; normalized: string } {
  if (raw.trim() === "") return { flagged: false, normalized: raw };
  if (/[a-zA-Z]/.test(raw)) return { flagged: true, normalized: raw };
  const d = raw.replace(/\D/g, "");
  return d.length >= 7 && d.length <= 11
    ? { flagged: false, normalized: d }
    : { flagged: true, normalized: raw };
}

function validatePromedioNotas(raw: string): { flagged: boolean; normalized: string } {
  if (raw.trim() === "") return { flagged: false, normalized: raw };
  const s = raw.trim().replace(",", ".");
  const n = parseFloat(s);
  return !isNaN(n) && n >= 1.0 && n <= 7.0
    ? { flagged: false, normalized: s }
    : { flagged: true, normalized: raw };
}

type SingleSelectField = "curso" | "usmEsAlternativa" | "conocerViasAdmision";

function badSelect(value: string, field: SingleSelectField): boolean {
  return value !== "" && !(CHECKBOX_OPTIONS[field] as readonly string[]).includes(value);
}

function badCampus(value: CampusInteresOption[]): boolean {
  return value.some((v) => !(CAMPUS_INTERES_OPTIONS as readonly string[]).includes(v));
}

export function validarFicha(datos: FichaData): {
  datos: FichaData;
  banderas: FichaBanderas;
} {
  const d = { ...datos, campusInteres: [...datos.campusInteres] };
  const b = {} as FichaBanderas;

  const rut = validateRut(d.rut);
  b.rut = rut.status === "empty" || rut.status === "invalid";
  if (rut.status === "valid") d.rut = rut.normalized;

  const email = validateEmail(d.email);
  b.email = email.flagged;
  d.email = email.corrected;

  const cel = validateCelular(d.celular);
  b.celular = cel.flagged;
  if (!cel.flagged) d.celular = cel.normalized;

  const tel = validateTelefonoFijo(d.telefonoFijo);
  b.telefonoFijo = tel.flagged;
  if (!tel.flagged) d.telefonoFijo = tel.normalized;

  const nota = validatePromedioNotas(d.promedioNotas);
  b.promedioNotas = nota.flagged;
  if (!nota.flagged) d.promedioNotas = nota.normalized;

  b.nombre = d.nombre.trim() === "";
  b.apellidoPaterno = d.apellidoPaterno.trim() === "";
  b.apellidoMaterno = d.apellidoMaterno.trim() === "";
  b.establecimiento = b.ciudad = b.carrera1 = b.carrera2 = b.carrera3 = false;
  b.curso = badSelect(d.curso, "curso");
  b.usmEsAlternativa = badSelect(d.usmEsAlternativa, "usmEsAlternativa");
  b.campusInteres = badCampus(d.campusInteres);
  b.conocerViasAdmision = badSelect(d.conocerViasAdmision, "conocerViasAdmision");

  return { datos: d, banderas: b };
}
