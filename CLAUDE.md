# Fichaje

## Descripción del proyecto
Fichaje es una web app móvil (PWA) que digitaliza fichas de contacto escritas a mano
(formato fijo: "Ficha de Contacto Admisión USM"). El usuario escanea fichas en lote con
la cámara del celular, un modelo de visión extrae los datos, y la app exporta un .zip con
un Excel (las celdas de baja confianza resaltadas) más la carpeta de imágenes originales.

Usuario: equipo de captación/admisión. Acción principal: escanear y reconocer los datos
de una ficha. La app termina en "Excel exportado"; subir esos datos a otros sistemas NO
es parte de este proyecto.

## Stack tecnológico
- Framework: Next.js (App Router) + React + TypeScript
- Estilos: Tailwind CSS (sin librerías de componentes extra)
- Almacenamiento: IndexedDB en el navegador, vía Dexie.js. NO hay base de datos en servidor.
- Backend: Next.js API Routes (serverless), solo para llamar al modelo de visión.
- Modelo de visión: Google Gemini API (Gemini Flash).
- Excel: ExcelJS. ZIP: JSZip. Ambos corren en el cliente (navegador).
- Deploy: Vercel. Gestor de paquetes: npm.

## Reglas de arquitectura
- Páginas en `/app`. Componentes de React en `/components`. Lógica y utilidades en `/lib`.
- Los componentes NO contienen lógica de negocio: la importan desde `/lib`.
- Todo acceso a IndexedDB vive solo en `/lib/db.ts` (vía Dexie). Ningún componente toca
  IndexedDB directamente.
- La llamada al modelo de visión vive solo en `/lib/vision.ts`. Cambiar de modelo = editar
  solo ese archivo. El resto de la app no sabe qué modelo se usa.
- La única API Route es `/app/api/extract/route.ts`. La API key NUNCA llega al cliente.
- Las reglas de validación por campo viven en `/lib/validation.ts`.
- Los campos de la ficha se definen UNA sola vez en `/lib/fields.ts`; todo lo demás
  (extracción, validación, columnas del Excel) los importa de ahí.

## Estilo de código
- TypeScript estricto. Prohibido `any`.
- Componentes funcionales con hooks. Sin componentes de clase.
- async/await siempre; nunca `.then()` encadenado.
- Toda llamada a API o a IndexedDB va dentro de try/catch, con un mensaje de error claro
  para el usuario.
- Archivos de menos de 200 líneas. Si crece más, dividir.
- Identificadores de código en inglés; todos los textos de interfaz en español.
- Comentarios solo donde el "por qué" no sea obvio.

## Reglas del producto (no romper)
- NO hay pantalla de revisión ficha por ficha. Flujo: capturar en lote → procesar →
  exportar Excel con las celdas dudosas marcadas.
- Cada ficha procesada se guarda en IndexedDB de inmediato (checkpoint). Una caída de
  conexión o el cierre de la pestaña NO deben perder trabajo; el proceso debe poder reanudar.
- Cada celda recibe una bandera de confianza que combina (a) la confianza reportada por el
  modelo y (b) las reglas de validación. Si hay bandera → la celda se resalta en el Excel.
- El campo "Fecha" de la ficha NO se extrae.
- La exportación es un .zip: un Excel (una fila por ficha) + carpeta de imágenes. Cada
  fila referencia el nombre de archivo de su imagen.
- Sin cuentas de usuario ni login. Una clave de acceso simple (APP_ACCESS_KEY) protege la
  API Route para que nadie externo gaste el presupuesto del modelo.

## Campos de la ficha
13 campos de texto: `nombre`, `apellidoPaterno`, `apellidoMaterno`, `rut`, `email`,
`telefonoFijo`, `celular`, `establecimiento`, `ciudad`, `promedioNotas`, `carrera1`,
`carrera2`, `carrera3`.
4 grupos de casillas: `curso` (Iº/IIº/IIIº/IVº/Egresado), `usmEsAlternativa` (4 opciones),
`campusInteres` (5 opciones), `conocerViasAdmision` (Sí/No).

## Variables de entorno (archivo .env.local, nunca subir a Git)
- `GEMINI_API_KEY` — clave del modelo de visión.
- `APP_ACCESS_KEY` — clave de acceso simple compartida por el equipo.

## Cómo construir
- Seguir `plan.md`, UNA fase a la vez. No adelantar fases.
- Al terminar cada fase, ejecutar su test antes de continuar.
- Comandos: `npm run dev` (desarrollo) · `npm run build` (producción) · `npm run lint`.
