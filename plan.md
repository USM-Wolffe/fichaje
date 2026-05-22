# Plan de construcción — Fichaje

Hoja de ruta de la app. Acompaña a `CLAUDE.md`.
**Regla:** se construye UNA fase a la vez, y cada fase termina con un test antes de seguir.

---

## 1. Estructura de archivos

```
fichaje/
├── CLAUDE.md                 memoria del proyecto para la IA
├── plan.md                   este archivo
├── package.json              dependencias y scripts
├── next.config.js            configuración de Next.js + PWA
├── tailwind.config.ts        configuración de Tailwind
├── tsconfig.json             TypeScript estricto
├── .env.local                claves secretas (NO se sube a Git)
├── .gitignore
├── public/
│   ├── manifest.json         define la PWA instalable
│   └── icons/                íconos de la app
├── app/
│   ├── layout.tsx            estructura raíz de todas las pantallas
│   ├── globals.css           estilos base (Tailwind)
│   ├── page.tsx              PANTALLA 1: lista de control + acciones
│   ├── escanear/
│   │   └── page.tsx          PANTALLA 2: captura con cámara
│   └── api/
│       └── extract/
│           └── route.ts      backend: recibe imagen → llama al modelo
├── components/
│   ├── CameraCapture.tsx     cámara + marco guía + captura
│   ├── FichaList.tsx         lista de fichas con su estado
│   ├── BatchActions.tsx      botones Procesar / Exportar + progreso
│   └── AccessKeyGate.tsx     pide la clave de acceso la 1ª vez
└── lib/
    ├── fields.ts             los 17 campos definidos UNA vez
    ├── db.ts                 acceso a IndexedDB (Dexie)
    ├── vision.ts             prompt + llamada a Gemini
    ├── validation.ts         reglas + banderas de confianza
    ├── processing.ts         cola de procesamiento + checkpoints
    └── export.ts             genera Excel + .zip
```

Archivos de código que importan: ~15. Cabe holgado en el alcance de un MVP.

---

## 2. Qué hace cada archivo, cuándo se crea y de qué depende

### Configuración (Fase A)
- `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `.gitignore` — configuración base del proyecto. No dependen de nada.
- `.env.local` — guarda `GEMINI_API_KEY` y `APP_ACCESS_KEY`. Se crea vacío en la Fase A; la clave real de Gemini se pega en la Fase E.

### Carpeta `lib/` (la lógica — el cerebro de la app)
- `lib/fields.ts` — define los 17 campos de la ficha UNA sola vez, más los tipos relacionados. **Es la fuente de verdad**: extracción, validación y columnas del Excel lo importan de aquí. *Fase A.* Depende de: nada.
- `lib/db.ts` — todo el acceso a IndexedDB vía Dexie (guardar y leer fichas e imágenes). Ningún otro archivo toca IndexedDB. *Fase B.* Depende de: `fields.ts`.
- `lib/vision.ts` — arma el prompt de extracción y llama a Gemini. Corre en el servidor. Cambiar de modelo = editar solo este archivo. *Fase E.* Depende de: `fields.ts`.
- `lib/validation.ts` — reglas de validación por tipo de campo (RUT, email, teléfono…) y combina la confianza del modelo con esas reglas para decidir qué celda se marca. *Fase E.* Depende de: `fields.ts`.
- `lib/processing.ts` — cola de procesamiento en lote: manda cada ficha a la API, guarda cada resultado al instante (checkpoint) y permite reanudar tras un corte. *Fase F.* Depende de: `db.ts`, `validation.ts`.
- `lib/export.ts` — genera el Excel con ExcelJS (una fila por ficha, celdas marcadas resaltadas) y empaqueta el .zip con JSZip (Excel + carpeta de imágenes). *Fase G.* Depende de: `db.ts`, `fields.ts`.

### Carpeta `app/` (las pantallas y el backend)
- `app/layout.tsx` + `app/globals.css` — estructura raíz y estilos base. *Fase A.*
- `app/escanear/page.tsx` — PANTALLA 2: la captura con cámara. *Fase C.* Depende de: `CameraCapture`, `db.ts`.
- `app/page.tsx` — PANTALLA 1 (inicio): la lista de control y las acciones. *Fase D.* Depende de: `FichaList`, `BatchActions`, `db.ts`.
- `app/api/extract/route.ts` — la única API Route. Recibe una imagen, llama al modelo, devuelve los datos. La API key vive aquí, nunca en el celular. *Fase E.* Depende de: `vision.ts`, `fields.ts`.

### Carpeta `components/` (las piezas visuales)
- `components/CameraCapture.tsx` — cámara con marco guía, captura manual rápida y contador en vivo. El auto-disparo se le agrega en la Fase I. *Fase C.* Depende de: `db.ts`.
- `components/FichaList.tsx` — lista de fichas escaneadas con miniatura y estado (capturada / procesada / N celdas a revisar). *Fase D.* Depende de: `db.ts`, `fields.ts`.
- `components/BatchActions.tsx` — botones Procesar y Exportar con barra de progreso. *Fase F (procesar) y G (exportar).* Depende de: `processing.ts`, `export.ts`.
- `components/AccessKeyGate.tsx` — pide la clave de acceso la primera vez y la guarda localmente. *Fase H.* Depende de: nada.

### Carpeta `public/` (la PWA)
- `public/manifest.json` + `public/icons/` — hacen la app instalable en la pantalla de inicio del celular. *Fase H.*

---

## 3. Cómo fluyen los datos

1. La **cámara** (`CameraCapture`) captura imágenes y las guarda en **IndexedDB** (`db.ts`).
2. La **lista** (`FichaList`) lee IndexedDB y muestra cada ficha con su estado.
3. Al tocar **Procesar**, `processing.ts` toma cada imagen y la envía a la **API Route**, que llama a **Gemini** (`vision.ts`). El resultado pasa por `validation.ts` (banderas de confianza) y se guarda de inmediato en IndexedDB.
4. Al tocar **Exportar**, `export.ts` arma el Excel + .zip leyendo desde IndexedDB.

Todo el estado vive en **IndexedDB**. Por eso un corte de conexión o cerrar la pestaña no pierde trabajo: al volver, la app retoma desde lo último guardado.

---

## 4. Fases de construcción

**Reglas:** una fase a la vez · una sola feature por fase · una conversación de IA nueva
por fase (evita la contaminación de contexto) · al cerrar cada fase, pasar su test y
actualizar `CLAUDE.md` si algo estructural cambió.

Son 10 fases pequeñas. Varias son cortas (la A o la J pueden tomar 30–60 min). Cortar
fino es a propósito: nunca dejes que la IA construya más de una feature sin probarla.

### Fase A — Cimientos del proyecto
Crear el proyecto Next.js (App Router + TypeScript + Tailwind), la estructura de carpetas,
los archivos de configuración, `.env.local` vacío, `.gitignore` y `lib/fields.ts` con los
17 campos y sus tipos. Subir a GitHub y hacer un primer deploy en Vercel.
**Test:** `npm run dev` abre una página sin errores · `npm run lint` pasa limpio · la URL
de Vercel carga en el celular. *(El deploy temprano permite probar la cámara en tu teléfono
real desde la Fase C — la cámara necesita HTTPS.)*

### Fase B — Almacenamiento local
Crear `lib/db.ts` con Dexie: la tabla de fichas (id, imagen, fecha de captura, datos
extraídos, banderas de confianza, estado).
**Test:** con un botón temporal, guardar una ficha de prueba y volver a leerla; recargar
la página y confirmar que sigue ahí. Quitar el botón al terminar.

### Fase C — Captura de cámara en lote
Crear `components/CameraCapture.tsx` y `app/escanear/page.tsx`: cámara con marco guía,
botón de captura, contador en vivo; cada imagen se guarda en IndexedDB.
**Test:** en el celular, capturar 5 fichas seguidas; recargar y confirmar que las 5
imágenes siguen guardadas.

### Fase D — Lista de control
Crear `app/page.tsx` y `components/FichaList.tsx`: la pantalla de inicio muestra todas las
fichas con miniatura y estado, más un botón para ir a escanear.
**Test:** capturar fichas, volver al inicio, verlas listadas como "capturada"; el contador
coincide con lo capturado.

### Fase E — Extracción con el modelo (el corazón)
Crear `lib/vision.ts` (prompt de extracción + llamada a Gemini) y `app/api/extract/route.ts`
(la API Route). Pegar la `GEMINI_API_KEY` real en `.env.local`. Extraer los 17 campos de
UNA ficha.
**Test:** procesar una ficha; comparar los datos extraídos con la ficha real — los campos
en casillas (RUT, celular) deben salir correctos.

### Fase F — Confianza y validación
Crear `lib/validation.ts`: reglas por tipo de campo (RUT, email, teléfono, etc.) y la
lógica que combina la confianza del modelo con esas reglas para decidir qué celda se marca.
**Test:** una ficha bien escrita no genera banderas; un campo ilegible o inválido (ej. RUT
incompleto) sí queda marcado.

### Fase G — Procesamiento en lote con checkpoints
Crear `lib/processing.ts` y el botón "Procesar" en `components/BatchActions.tsx`: cola que
procesa todas las fichas capturadas, guarda cada resultado al instante y reanuda tras un corte.
**Test:** procesar 20+ fichas; a mitad de camino cerrar la pestaña o cortar el wifi;
reabrir y confirmar que reanuda sin perder ni repetir ninguna.

### Fase H — Exportación .zip
Crear `lib/export.ts` y el botón "Exportar" en `BatchActions.tsx`: Excel (una fila por
ficha, celdas marcadas resaltadas, columna con el nombre de la imagen) + carpeta de
imágenes, todo en un .zip.
**Test:** exportar; abrir el Excel en el PC; las celdas dudosas aparecen resaltadas y cada
fila referencia su imagen.

### Fase I — Clave de acceso + PWA + pulido
Crear `components/AccessKeyGate.tsx`, `public/manifest.json` e íconos; proteger la API
Route con `APP_ACCESS_KEY`; revisar que todo se vea bien en pantalla de celular.
**Test:** la app se instala en la pantalla de inicio del celular; la API rechaza llamadas
sin la clave; las pantallas se ven bien en móvil.

> **Al cerrar la Fase I tienes una app lanzable y completa.** La Fase J es un extra.

### Fase J — Auto-disparo (fase aislada — opcional)
Agregar detección de bordes y disparo automático a `CameraCapture.tsx`, encima de la
captura manual que ya funciona.
**Test:** al sostener una ficha alineada, se captura sola y nítida. Si falla muy seguido,
desactivar y mover a V2 — la app ya funciona sin esto.

---

## 5. Después de construir
Pruebas finales y publicación: ver la guía de testing y deploy (`testing-y-deploy.md`).
