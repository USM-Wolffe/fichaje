// Tipo compartido por los clientes LLM. RawFicha es lo que devuelve un
// cliente antes de pasar por el sanitizado del orquestador. Los valores
// llegan como `unknown` porque el modelo puede mandar tipos inesperados
// (un número en vez de string, un enum inválido, un campo faltante);
// el orquestador los normaliza a `FichaData`.

export interface RawFicha {
  nombre: unknown;
  apellidoPaterno: unknown;
  apellidoMaterno: unknown;
  rut: unknown;
  email: unknown;
  telefonoFijo: unknown;
  celular: unknown;
  establecimiento: unknown;
  ciudad: unknown;
  promedioNotas: unknown;
  carrera1: unknown;
  carrera2: unknown;
  carrera3: unknown;
  curso: unknown;
  usmEsAlternativa: unknown;
  campusInteres: unknown;
  conocerViasAdmision: unknown;
}

export interface CropImage {
  bytes: ArrayBuffer;
  mimeType: string;
}

export interface CropImages {
  rut?: CropImage;
  celular?: CropImage;
  correo?: CropImage;
}
