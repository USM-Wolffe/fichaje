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
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

function validateRut(raw: string): { status: RutResult; normalized: string } {
  const cleaned = raw.replace(/[\s.\-]/g, "").toUpperCase();
  if (cleaned === "") return { status: "empty", normalized: raw };
  if (cleaned.length < 2) return { status: "invalid", normalized: raw };
  const body = cleaned.slice(0, -1);
  const dvGiven = cleaned.slice(-1);
  if (!/^\d+$/.test(body)) return { status: "invalid", normalized: raw };
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  const digits = body.split("").reverse();
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * weights[i % weights.length];
  }
  const remainder = sum % 11;
  const expected = 11 - remainder;
  let dvExpected: string;
  if (expected === 11) dvExpected = "0";
  else if (expected === 10) dvExpected = "K";
  else dvExpected = String(expected);
  if (dvGiven === dvExpected) {
    return { status: "valid", normalized: body + dvExpected };
  }
  return { status: "invalid", normalized: raw };
}

function validateEmail(raw: string): { flagged: boolean; corrected: string } {
  if (raw.trim() === "") return { flagged: false, corrected: raw };
  if (/\s/.test(raw.trim())) return { flagged: true, corrected: raw };
  const parts = raw.trim().split("@");
  if (parts.length !== 2) return { flagged: true, corrected: raw };
  const [local, domain] = parts;
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
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("56") && digits.length === 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length === 10) {
    digits = digits.slice(1);
  }
  if (digits.length !== 9 || !digits.startsWith("9")) {
    return { flagged: true, normalized: raw };
  }
  return { flagged: false, normalized: digits };
}

function validateTelefonoFijo(raw: string): { flagged: boolean; normalized: string } {
  if (raw.trim() === "") return { flagged: false, normalized: raw };
  if (/[a-zA-Z]/.test(raw)) return { flagged: true, normalized: raw };
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 11) {
    return { flagged: true, normalized: raw };
  }
  return { flagged: false, normalized: digits };
}

function validatePromedioNotas(raw: string): { flagged: boolean; normalized: string } {
  if (raw.trim() === "") return { flagged: false, normalized: raw };
  const sanitized = raw.trim().replace(",", ".");
  const num = parseFloat(sanitized);
  if (isNaN(num)) return { flagged: true, normalized: raw };
  if (num < 1.0 || num > 7.0) return { flagged: true, normalized: raw };
  return { flagged: false, normalized: sanitized };
}

function isBlank(val: string): boolean {
  return val.trim() === "";
}

type SingleSelectField = "curso" | "usmEsAlternativa" | "conocerViasAdmision";

function validateSingleSelect(
  value: string,
  field: SingleSelectField,
): boolean {
  if (value === "") return false;
  const options = CHECKBOX_OPTIONS[field] as readonly string[];
  return !options.includes(value);
}

function validateCampusInteres(value: CampusInteresOption[]): boolean {
  if (value.length === 0) return false;
  const valid = CAMPUS_INTERES_OPTIONS as readonly string[];
  return value.some((v) => !valid.includes(v));
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

  b.nombre = isBlank(d.nombre);
  b.apellidoPaterno = isBlank(d.apellidoPaterno);
  b.apellidoMaterno = isBlank(d.apellidoMaterno);

  b.establecimiento = false;
  b.ciudad = false;
  b.carrera1 = false;
  b.carrera2 = false;
  b.carrera3 = false;

  b.curso = validateSingleSelect(d.curso, "curso");
  b.usmEsAlternativa = validateSingleSelect(d.usmEsAlternativa, "usmEsAlternativa");
  b.campusInteres = validateCampusInteres(d.campusInteres);
  b.conocerViasAdmision = validateSingleSelect(d.conocerViasAdmision, "conocerViasAdmision");

  return { datos: d, banderas: b };
}
