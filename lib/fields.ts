// Fuente de verdad de los campos de la ficha.
// Extracción, validación y columnas del Excel importan desde aquí.

export const TEXT_FIELDS = [
  "nombre",
  "apellidoPaterno",
  "apellidoMaterno",
  "rut",
  "email",
  "telefonoFijo",
  "celular",
  "establecimiento",
  "ciudad",
  "promedioNotas",
  "carrera1",
  "carrera2",
  "carrera3",
] as const;

export type TextFieldKey = (typeof TEXT_FIELDS)[number];

export const CURSO_OPTIONS = ["I", "II", "III", "IV", "Egresado"] as const;
export type CursoOption = (typeof CURSO_OPTIONS)[number];

export const USM_ES_ALTERNATIVA_OPTIONS = [
  "primera",
  "segunda",
  "tercera",
  "otra",
] as const;
export type UsmEsAlternativaOption = (typeof USM_ES_ALTERNATIVA_OPTIONS)[number];

export const CAMPUS_INTERES_OPTIONS = [
  "casaCentralValparaiso",
  "sanJoaquin",
  "vitacura",
  "concepcion",
  "vinaJMC",
] as const;
export type CampusInteresOption = (typeof CAMPUS_INTERES_OPTIONS)[number];

export const CONOCER_VIAS_ADMISION_OPTIONS = ["si", "no"] as const;
export type ConocerViasAdmisionOption =
  (typeof CONOCER_VIAS_ADMISION_OPTIONS)[number];

export const CHECKBOX_FIELDS = [
  "curso",
  "usmEsAlternativa",
  "campusInteres",
  "conocerViasAdmision",
] as const;

export type CheckboxFieldKey = (typeof CHECKBOX_FIELDS)[number];

// Todas las claves de la ficha (13 + 4 = 17).
export const ALL_FIELDS = [...TEXT_FIELDS, ...CHECKBOX_FIELDS] as const;
export type FieldKey = (typeof ALL_FIELDS)[number];

// Mapa de opciones para cada grupo de casillas.
export const CHECKBOX_OPTIONS: {
  curso: typeof CURSO_OPTIONS;
  usmEsAlternativa: typeof USM_ES_ALTERNATIVA_OPTIONS;
  campusInteres: typeof CAMPUS_INTERES_OPTIONS;
  conocerViasAdmision: typeof CONOCER_VIAS_ADMISION_OPTIONS;
} = {
  curso: CURSO_OPTIONS,
  usmEsAlternativa: USM_ES_ALTERNATIVA_OPTIONS,
  campusInteres: CAMPUS_INTERES_OPTIONS,
  conocerViasAdmision: CONOCER_VIAS_ADMISION_OPTIONS,
};

// Etiquetas en español para mostrar en la UI y en el Excel.
export const FIELD_LABELS: Record<FieldKey, string> = {
  nombre: "Nombre",
  apellidoPaterno: "Apellido paterno",
  apellidoMaterno: "Apellido materno",
  rut: "RUT",
  email: "Email",
  telefonoFijo: "Teléfono fijo",
  celular: "Celular",
  establecimiento: "Establecimiento",
  ciudad: "Ciudad",
  promedioNotas: "Promedio de notas",
  carrera1: "Carrera 1",
  carrera2: "Carrera 2",
  carrera3: "Carrera 3",
  curso: "Curso",
  usmEsAlternativa: "USM es alternativa",
  campusInteres: "Campus de interés",
  conocerViasAdmision: "Conoce vías de admisión",
};

// Estructura de los datos extraídos de UNA ficha.
// Los campos de texto pueden venir vacíos si el modelo no los reconoce.
// Los grupos de casillas guardan la(s) opción(es) marcada(s).
export type FichaData = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  rut: string;
  email: string;
  telefonoFijo: string;
  celular: string;
  establecimiento: string;
  ciudad: string;
  promedioNotas: string;
  carrera1: string;
  carrera2: string;
  carrera3: string;
  curso: CursoOption | "";
  usmEsAlternativa: UsmEsAlternativaOption | "";
  campusInteres: CampusInteresOption[];
  conocerViasAdmision: ConocerViasAdmisionOption | "";
};
