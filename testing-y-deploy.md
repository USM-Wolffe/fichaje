# Testing y deploy — Fichaje

La última pieza del plan: cómo probar la app, publicarla y qué viene después.

---

## 1. Checklist antes de publicar

Marca cada punto antes de considerar la app lista:

- [ ] Sin errores en la consola del navegador (F12 → pestaña "Console").
- [ ] Se ve y funciona bien en pantalla de celular — es una app móvil.
- [ ] La cámara captura fichas y las guarda; sobreviven a recargar la página.
- [ ] La lista de control muestra las fichas con su estado correcto.
- [ ] La extracción devuelve datos correctos en una ficha de prueba real.
- [ ] Las celdas dudosas se marcan; las claras no.
- [ ] El procesamiento en lote **reanuda tras un corte** sin perder ni repetir fichas.
- [ ] La exportación genera el .zip con el Excel (celdas resaltadas) + las imágenes.
- [ ] Las variables de entorno están cargadas en Vercel (no solo en `.env.local`).
- [ ] La API rechaza llamadas que no traen la clave de acceso.
- [ ] `.env.local` NO aparece en tu repositorio de GitHub.
- [ ] Hay un **tope de gasto** configurado en tu cuenta de Google Gemini.
- [ ] La app se instala en la pantalla de inicio del celular (PWA).

---

## 2. Prueba de calibración (la más importante)

No confíes en la app a ciegas con miles de fichas. Antes, haz esto:

1. Escanea **20–30 fichas reales y variadas** — incluye letra de imprenta, cursiva difícil
   y alguna con algo tachado.
2. Procésalas y exporta el Excel.
3. Compara fila por fila contra las fichas originales. Cuenta: ¿cuántos campos salieron
   bien? ¿La app marcó las celdas que de verdad estaban mal?
4. Ajusta el umbral de confianza si hace falta: si deja pasar errores sin marcar, hazlo
   más estricto; si marca demasiado, aflójalo. (Es un cambio en `lib/validation.ts`.)

El objetivo no es perfección — es que **lo que la app marca cubra lo que de verdad está
mal**. Cuando eso se cumple, ya puedes confiar en ella a escala.

---

## 3. Publicar en Vercel

La app ya se desplegó por primera vez en la Fase A. Para la versión final:

**Variables de entorno (paso manual, importante).** `.env.local` no se sube a Git, así que
Vercel no conoce tus claves hasta que se las das:
1. Entra a vercel.com → tu proyecto → **Settings → Environment Variables**.
2. Agrega `GEMINI_API_KEY` con tu clave de Gemini.
3. Agrega `APP_ACCESS_KEY` con la clave que compartirás con tu equipo.
4. Vuelve a desplegar (**Deployments → Redeploy**) para que tomen efecto.

**Prompt para Claude Code** (revisa el código y te guía con el resto):

```
Lee CLAUDE.md antes de empezar.

Quiero publicar la versión final de la app en Vercel.
1. Corre "npm run build" y arregla cualquier error que aparezca.
2. Confirma que .env.local está en .gitignore y que NUNCA se subió a GitHub.
3. Guíame paso a paso para subir los últimos cambios a GitHub.
4. Recuérdame configurar GEMINI_API_KEY y APP_ACCESS_KEY en el panel de Vercel.
5. Dime cómo verificar que la app publicada funciona de punta a punta en mi celular.
```

---

## 4. Revisa el costo real

Después de tu primer lote grande, entra al panel de uso de Google AI Studio y mira cuánto
costó. Divídelo por la cantidad de fichas: ese es tu costo real por ficha. Te servirá para
presupuestar los próximos lotes — y para confirmar que el tope de gasto es el adecuado.

---

## 5. Próximos pasos

**Itera rápido.** Usa la app tú primero con un lote real. Anota lo que te moleste o te haga
perder tiempo. Arregla las 1–2 cosas más importantes antes de pasársela al equipo.

**Recoge feedback.** Cuando tu equipo la use, pregunta dónde se traban. Esos comentarios
valen más que cualquier idea de feature.

**Parking Lot V2** (cuando la V1 esté sólida y solo si el uso lo pide):
- Base de datos compartida del equipo (todos los escaneos en un solo lugar).
- Auto-disparo de cámara, si quedó pendiente o frágil en la Fase J.
- Importar fotos ya tomadas en lote, como alternativa a la cámara.
- Detección de duplicados (misma ficha o mismo RUT escaneados dos veces).
- App nativa / publicación en tiendas de apps.

Cada función nueva: una fase, un test, una conversación nueva. Las mismas reglas de
siempre. La disciplina que te trajo hasta aquí es la que mantiene la app sana.
