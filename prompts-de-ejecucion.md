# Prompts de ejecución — Fichaje

Estos son los prompts para construir la app con Claude Code, listos para copiar y pegar.

## Cómo usar este archivo
- **Una fase = una conversación NUEVA de Claude Code.** No reutilices la misma conversación
  entre fases: el contexto se ensucia y es la causa #1 de errores.
- Copia el prompt de la fase, pégalo, deja que Claude Code trabaje.
- Cuando termine, haz el **test de esa fase** (está en `plan.md`). Si pasa → siguiente fase.
- Si algo se rompe, usa el **Prompt de recuperación** (al final).
- Trabaja siempre dentro de la carpeta del proyecto.

## Requisitos previos (consíguelos antes de empezar)
- Cuenta de **GitHub** (gratis) — para guardar el código.
- Cuenta de **Vercel** (gratis) — para publicar la app. Entra con tu GitHub.
- Una **API key de Google Gemini** — gratis en aistudio.google.com → "Get API key".
  La necesitas recién en la Fase E; tenla a mano para entonces.

---

## Prompt inicial — Fase A: Cimientos del proyecto

```
Lee CLAUDE.md y plan.md completos antes de empezar. Son la fuente de verdad del proyecto.

Esta carpeta YA contiene CLAUDE.md y plan.md — no los borres ni los sobrescribas.

Construye SOLO la Fase A del plan: los cimientos del proyecto.
- Crea aquí mismo un proyecto Next.js con App Router, TypeScript estricto y Tailwind CSS.
- Crea la estructura de carpetas /app, /components y /lib según plan.md.
- Crea lib/fields.ts con los 17 campos de la ficha y sus tipos TypeScript, tal como
  los lista CLAUDE.md. Este archivo es la fuente de verdad de los campos.
- Crea .env.local con GEMINI_API_KEY="" y APP_ACCESS_KEY="" (vacíos por ahora).
- Crea .gitignore que ignore .env.local, node_modules y .next.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run dev" levanta sin errores y que "npm run lint" pasa limpio.
2. Guíame paso a paso, en lenguaje simple, para: subir el proyecto a GitHub y hacer
   el primer deploy en Vercel.
3. Dime cómo confirmar que la URL de Vercel carga en mi celular.
```

---

## Prompt — Fase B: Almacenamiento local

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase B: el almacenamiento local.
- Crea lib/db.ts usando Dexie (IndexedDB). Define la tabla de fichas con: id, imagen,
  fecha de captura, estado, los datos extraídos de los 17 campos y las banderas de
  confianza por campo. Importa los campos desde lib/fields.ts.
- Todo el acceso a IndexedDB debe vivir solo en este archivo.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Agrega un botón temporal que guarde una ficha de prueba y la lea de vuelta, para que
   yo pueda probar la Fase B. Dime cómo usarlo y recuérdame quitarlo después.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase C: Captura de cámara en lote

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase C: la captura de cámara en lote.
- Crea components/CameraCapture.tsx: usa la cámara del navegador (getUserMedia), muestra
  un marco guía con la forma de la ficha, un botón de captura grande y un contador en vivo
  de fichas capturadas en esta sesión.
- Captura MANUAL: un toque captura y queda listo para la siguiente. Sin auto-disparo.
- Cada imagen capturada se guarda en IndexedDB usando lib/db.ts.
- Crea app/escanear/page.tsx que use ese componente.
- Si la cámara falla o se niega el permiso, muestra un mensaje claro en español.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo probar la Fase C en mi celular usando la URL de Vercel.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase D: Lista de control

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase D: la lista de control.
- Crea app/page.tsx (pantalla de inicio) y components/FichaList.tsx.
- Muestra todas las fichas guardadas en IndexedDB, cada una con su miniatura y su estado
  (capturada / procesada / con celdas a revisar).
- Incluye un botón claro para ir a la pantalla de escaneo.
- Muestra un estado vacío amable cuando no hay fichas.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo probar la Fase D.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase E: Extracción con el modelo (el corazón)

> Antes de pegar este prompt, ten lista tu API key de Google Gemini.

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase E: la extracción con el modelo de visión.
- Crea lib/vision.ts: arma el prompt de extracción y llama a la API de Google Gemini
  (Gemini Flash). El prompt debe pedir los 17 campos definidos en lib/fields.ts, incluidos
  los 4 grupos de casillas con sus opciones exactas. Debe pedir el resultado en JSON
  estructurado, NO extraer el campo "Fecha", y devolver por cada campo una valoración de
  legibilidad (alta / media / baja).
- Mantén vision.ts aislado: el resto de la app no debe saber qué modelo se usa.
- Crea app/api/extract/route.ts: recibe una imagen, usa vision.ts y devuelve los datos.
  La API key se lee de process.env, nunca se expone al cliente.
- Toda llamada va en try/catch con un mensaje de error claro.

Voy a pegar mi GEMINI_API_KEY en .env.local — dime exactamente dónde y cómo.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo procesar UNA ficha de prueba y ver los datos extraídos.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase F: Confianza y validación

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase F: confianza y validación.
- Crea lib/validation.ts con reglas de validación por tipo de campo: RUT chileno (formato
  y dígito verificador), email (formato válido), teléfono y celular (cantidad de dígitos),
  promedio de notas (número en rango razonable), y campos de texto no vacíos.
- Agrega la lógica que combina (a) la legibilidad reportada por el modelo y (b) el
  resultado de las reglas, y produce una bandera por celda: si la legibilidad es media/baja
  O la validación falla, la celda queda marcada.
- Importa los campos desde lib/fields.ts.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo probar que una ficha clara no genera banderas y una con un campo
   inválido sí las genera.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase G: Procesamiento en lote con checkpoints

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase G: el procesamiento en lote con checkpoints.
- Crea lib/processing.ts: una cola que procesa todas las fichas capturadas pendientes,
  enviando cada una a la API de extracción y pasándola por la validación de la Fase F.
- CRÍTICO: cada ficha procesada se guarda en IndexedDB de inmediato (checkpoint). Si se
  corta la conexión o se cierra la pestaña, al volver debe reanudar desde la última ficha
  guardada, sin perder ni reprocesar ninguna.
- Si una ficha individual falla, márcala con error y sigue con las demás; no detengas
  todo el lote.
- Crea components/BatchActions.tsx con el botón "Procesar" y una barra de progreso.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo probar la reanudación: procesar varias fichas, cortar a mitad, y
   confirmar que retoma bien.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase H: Exportación .zip

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase H: la exportación a .zip.
- Crea lib/export.ts:
  - Con ExcelJS, genera un Excel con una fila por ficha y una columna por campo (en el
    orden de lib/fields.ts). Las celdas marcadas en la Fase F se resaltan con color de
    fondo. Incluye una columna con el nombre del archivo de imagen de cada ficha.
  - Con JSZip, empaqueta el Excel + una carpeta "imagenes" con todas las fotos, nombradas
    para que coincidan con la columna del Excel.
- Agrega el botón "Exportar" a components/BatchActions.tsx, que descarga el .zip.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo exportar y verificar el Excel en el PC (celdas resaltadas + imágenes).
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase I: Clave de acceso + PWA + pulido

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase I: clave de acceso, PWA y pulido.
- Crea components/AccessKeyGate.tsx: pide la clave de acceso la primera vez y la guarda
  localmente; la app la envía en cada llamada a la API.
- Protege app/api/extract/route.ts: rechaza con un mensaje claro toda llamada que no traiga
  la clave correcta (comparada con APP_ACCESS_KEY de las variables de entorno).
- Crea public/manifest.json y los íconos para que la app sea una PWA instalable en la
  pantalla de inicio del celular.
- Revisa que todas las pantallas se vean bien en tamaño de celular.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo: instalar la app en el celular y confirmar que la API rechaza llamadas
   sin la clave.
3. Si cambiaste algo estructural, actualiza CLAUDE.md.
```

---

## Prompt — Fase J: Auto-disparo (opcional)

> La app ya está completa sin esta fase. Hazla solo si quieres el extra.

```
Lee CLAUDE.md y plan.md completos antes de empezar.

Construye SOLO la Fase J: el auto-disparo de la cámara.
- Agrega a components/CameraCapture.tsx la detección del borde de la ficha en tiempo real
  y el disparo automático cuando la ficha está bien alineada y enfocada.
- Constrúyelo ENCIMA de la captura manual que ya funciona, sin romperla. Debe haber un
  interruptor para activar o desactivar el auto-disparo.

No empieces ninguna otra fase.

Cuando termines:
1. Verifica que "npm run lint" pasa limpio.
2. Explícame cómo probar el auto-disparo en el celular.
3. Si el auto-disparo falla seguido (capturas borrosas o a destiempo), recomiéndame
   dejarlo desactivado por defecto.
```

---

## Prompt de recuperación (si algo se rompe)

```
Algo dejó de funcionar. Antes de cambiar código:

1. Diagnostica primero. Explícame en lenguaje simple qué está fallando y por qué.
2. NO reescribas archivos completos ni toques otras fases. Haz el cambio MÍNIMO que
   arregla este problema puntual.
3. Respeta CLAUDE.md y plan.md.

El problema es: [DESCRIBE QUÉ PASA: qué hiciste, qué esperabas, qué pasó en su lugar,
y cualquier mensaje de error que aparezca].

Cuando lo arregles, explícame cómo verificar que quedó resuelto.
```

---

## Prompt final — Mejorar el diseño

> Úsalo solo cuando la app ya funcione completa, al final.

```
Lee CLAUDE.md antes de empezar.

La app funciona. Ahora mejora SOLO el diseño visual, sin cambiar ninguna funcionalidad
ni romper ninguna fase.
- Interfaz limpia y profesional, pensada para usarse en celular con una mano.
- Espaciado y tipografía consistentes; botones grandes y fáciles de tocar.
- Estados claros: cargando, vacío, error, éxito.
- Todos los textos en español, claros y breves.

No cambies la lógica de negocio. Cuando termines, dime qué ajustaste.
```
