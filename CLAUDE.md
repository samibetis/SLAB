# Slab: precio por grado de cartas Pokémon

Web para buscar cualquier carta Pokémon y ver su precio en raw y en PSA 7, 8, 9 y 10, con un visor 3D de la carta en funda gradeada y un analizador de fluctuación por periodos. Formato landing: hero con buscador y visor 3D, y debajo precios, fluctuación y "cómo funciona". Sin planes ni suscripciones en esta fase.

`prototype/slab.html` fue el punto de partida. Sigue valiendo como referencia de **contenido, textos y comportamiento** (fórmulas del analizador, interacción del visor), pero **ya no de diseño visual**: la interfaz se está rediseñando (ver "Diseño").

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript.
- Base de datos: Postgres con Drizzle. Con `DATABASE_URL` usa Neon (serverless HTTP); sin ella, en desarrollo usa PGlite (Postgres embebido en `.data/pglite`). Migraciones en `/drizzle` (`npm run db:generate` / `npm run db:migrate`); PGlite las aplica solo al arrancar.
- three.js (npm) para el visor. Tests con Vitest (`npm test`).
- Rediseño en curso: Tailwind CSS v4, `motion` (Framer Motion) e `@phosphor-icons/react`.

## Arquitectura

La lógica de datos vive en `src/lib` (sin React) para reutilizarla en la futura app móvil. Los componentes solo la consumen.

- `src/lib/catalog/` — catálogo. `CatalogProvider` con `TcgdexProvider` (principal, EN y JP) y `PokemonTcgProvider` (respaldo EN; ha estado caído con 500/502, no depender de él). `service.ts` orquesta: interpreta la búsqueda (`normalize.ts`: reparto nombre/colección, número, palabras de versión ignoradas), reconoce códigos de colección (`sets.ts`: "PAF", "SV4a"), cachea cartas en BD y ordena resultados.
- **Imágenes de respaldo** (`src/lib/catalog/fallback-images.ts`): las colecciones recién salidas llegan a TCGdex sin imágenes. Entonces se buscan en pokemontcg.io (su colección por fecha y nombre; las cartas por nombre, porque en reediciones la numeración cambia) y se sirven por `/api/img`. Las cartas guardadas sin imagen se vuelven a pedir (`isFreshCard`).
- `src/lib/cards/` — tipos y formato de carta, versiones (`variants.ts`: reverse, sellos, dónde cae el brillo) y reverso real según idioma/época (`back.ts`).
- `src/lib/prices/` — precios. `PriceProvider` con `CsvImportProvider` y `MockProvider` (sintético, solo desarrollo o `PRICE_MOCK=1`, la UI lo marca). Analizador puro (`analyzer.ts`), lectura automática (`reading.ts`), series mensuales, escalas de la gráfica, formato.
- `src/lib/db/` — esquema (`cards`, `price_points`, `sets`) y repositorios.
- `src/lib/viewer/engine.ts` — motor three.js del visor, sin React. El componente lo monta y le pasa estado. Fundas por empresa (`src/lib/grading/companies.ts`: PSA, BGS, CGC, SGC, TAG).
- `src/lib/collection/` — álbumes: tipos, lógica pura con tests (orden, páginas, progreso, marcar) y almacenamiento en el navegador.
- `src/lib/portfolio/` — portafolio de gradeadas: lógica pura con tests (precio de cada slab según su nota, valor, ganancia/pérdida, evolución mensual, mercado del periodo sin contar compras, reparto por empresa) y almacenamiento en el navegador. Ambos almacenes comparten la IndexedDB "slab" (`src/lib/browser-db.ts`; para añadir un almacén, subir `VERSION`).
- `src/lib/scan/` — escáner: interpretación pura del texto del OCR (`parse.ts`, con tests sobre salidas reales de Tesseract) y recortes de imagen (`image.ts`). La página es `/escaner`.
- `src/lib/i18n/es.ts` — todos los textos de la interfaz, centralizados para traducir.
- API: `GET /api/cards/search` (con `set=1` solo responde si hay código de colección reconocido), `GET /api/cards/[id]`, `GET /api/cards/[id]/prices?variant=`, `POST /api/portfolio/prices` (series de todo el portafolio en una petición, solo con las notas que usan tus slabs), `POST /api/scan/identify` (foto -> Claude, `claude-opus-5-5` con esfuerzo bajo, salida estructurada y respaldo ante rechazos), `GET /api/img` (proxy de imágenes sin CORS, lista blanca), `GET /api/cron/sync-sets` (refresca colecciones; protegido con `CRON_SECRET` en producción).

## Decisiones tomadas

- **Versiones (opción A):** una carta es una carta; la versión (unlimited, shadowless, 1ª edición, reverse holo, sellos) es una `VariantOption` aparte con su propio precio y su propio CSV. Se elige en el visor (tick de reverse + selector de versión) y en la cabecera de precios; es el mismo estado.
- **Grados como datos** (`src/lib/prices/grades.ts`): hoy raw y PSA 7-10; añadir BGS/CGC es añadir entradas.
- **Búsqueda:** nombre, colección, número (el cero inicial importa: "054" es el número impreso exacto) y código de colección. Si una palabra suelta es código y nombre a la vez ("MEW"), gana el nombre.
- **Precios:** histórico a base de instantáneas propias en `price_points`.
  - **Raw real, gratis (hecho):** TCGdex trae en el detalle de cada carta el precio de mercado de TCGplayer (USD) y la tendencia de Cardmarket (EUR, cubre japonesas y promos). `src/lib/prices/tcgdex-pricing.ts` saca un precio por versión (las especiales sin precio propio no copian el de la normal); `snapshot.ts` guarda la instantánea del día al consultar la carta y en el cron diario `GET /api/cron/snapshot-prices` (`vercel.json`). Solo hay precio de hoy: el histórico real crece día a día.
  - **Precios por nota: los pone el usuario a mano** (decisión: no hay dinero para la API de pago). En la ficha ("Tus precios", `ManualPrices`) y en el portafolio ("Poner valor" y "Valor hoy" al añadir un slab). Se guardan en la IndexedDB del navegador (almacén `prices`, `src/lib/prices/manual.ts` y `manual-store.ts`) y en cada nota mandan sobre lo del servidor. La UI explica por qué (`SupportNote`) y enlaza a donaciones con `NEXT_PUBLIC_DONATE_URL` (sin ella, dice que pronto habrá enlace).
  - **Proveedor de pago, preparado y apagado:** adaptador de Scrydex (`src/lib/prices/scrydex.ts`, sin probar contra la API real) que se activa con `SCRYDEX_API_KEY` + `SCRYDEX_TEAM_ID`; guarda el histórico por nota en `price_points` (un año la primera vez). `NEXT_PUBLIC_PAID_PRICES=1` quita el aviso de donación. Elegir el proveedor sigue siendo decisión del usuario (comparativa: Scrydex, PokemonPriceTracker, PriceCharting, JustTCG).
  - Los datos sintéticos (`MockProvider`) ya solo salen con `PRICE_MOCK=1`, también en desarrollo.
- **La UI siempre indica la fuente y la fecha** de los datos que muestra.
- **Reversos reales** en `public/backs/` (internacional, japonés antiguo hasta julio de 2001, japonés moderno). Son material con copyright de Nintendo/TPC (fair use en Bulbagarden): revisar antes de publicar; se sustituyen reemplazando los archivos.

## Analizador

Sobre la serie mensual de cada grado dentro del periodo: variación (último / primero − 1), mín y máx, volatilidad (desviación típica de las variaciones mensuales), peor caída desde un máximo previo, × raw (precio actual del grado / raw), matriz grado × periodo con "—" si el histórico no cubre el periodo, y lectura automática (mejor y peor grado, el más volátil, múltiplo PSA 10 / raw). Módulo puro con tests.

## Diseño

Rediseño completo en curso, siguiendo la skill de diseño frontend (variación 8, movimiento 6, densidad 4), con estas condiciones:

- **Se mantiene la tipografía:** Archivo con eje de anchura (`next/font`, variable `--font-archivo`).
- Se mantienen los tokens de color claro/oscuro y los colores por grado; un único acento (rojo).
- Layout asimétrico, sin filas de 3 tarjetas iguales. Esqueletos de carga, estados vacíos y de error compuestos, respuesta táctil al pulsar. Animaciones solo con `transform`/`opacity` y respetando `prefers-reduced-motion`.
- Visor: carta con grosor y esquinas reales, foil por tipo de versión, funda con reflejos, inclinación con el ratón. En móvil, calidad reducida.
- Etiqueta de la funda genérica (nombre, colección, número, nota y GEM MT/MINT/NM-MT/NM), sin logotipos de terceros.

## SEO y páginas

- `/` es la landing con el buscador.
- `/carta/[slug]` (pendiente, Hito 4): ficha renderizada en servidor con metadatos, Open Graph con la imagen de la carta y datos estructurados. Sitemap a partir de las cartas en BD.

## Legal

Pie con aviso de no afiliación a The Pokémon Company ni a Nintendo, y de que los precios son orientativos y no son asesoramiento de inversión. Revisar los términos de uso de cada API, sobre todo para imágenes.

## Funciones nuevas (tras los hitos originales)

1. ~~Visor fiel: foto de cada versión (TCGplayer vía proxy, riesgo legal pendiente) y fundas por empresa.~~ Hecho.
2. ~~Escáner con webcam (`/escaner`): OCR en el navegador (Tesseract) del código y número; si no basta, IA de Claude. Al confirmar abre `/?card=<id>` con la captura como "Tu escaneo".~~ Hecho. Límites: el número de cartas antiguas es demasiado pequeño para el OCR (se tira del nombre); las japonesas se identifican por código y número, no por nombre.
3. ~~Colección y álbumes (`/coleccion`): master sets por colección (`/api/sets`, `/api/sets/[key]/cards`) y álbumes libres, carpeta 3D de 9 bolsillos (`Binder`), cuadrícula con filtros y "Añadir a un álbum" en la ficha.~~ Hecho. Se guarda en IndexedDB del navegador (`src/lib/collection/store.ts`, interfaz `CollectionStore` lista para sincronizar con cuentas).
   - **Versiones en álbumes** (`src/lib/collection/versions.ts`): el usuario elige el tipo de master set al crearlo (y lo puede cambiar): "Solo cartas" (sirve cualquier versión), "Con reverse holo" o "Master set completo" (también sellos, 1ª edición, shadowless...). Todas las versiones de una carta comparten bolsillo y el progreso cuenta según el tipo. En los álbumes libres cada versión es un bolsillo propio. Las versiones de cada carta de la colección se piden a TCGdex carta a carta la primera vez y se cachean en BD (`listSetDetailed` en `service.ts`).
4. ~~Portafolio de gradeadas (`/portafolio`): valor de hoy frente a lo pagado, gráfica mensual, mercado del periodo, reparto por empresa y lista con fundas en miniatura (`SlabThumb`, CSS). Se añade desde la ficha ("Añadir al portafolio", con la empresa, nota y versión del visor) o desde la propia página.~~ Hecho. Las notas sin precio propio (PSA 6, BGS 7...) se guardan pero no suman; la Pristine 10 cotiza como el 10. Los enlaces abren la carta como el slab (`/?card=&grader=&grade=&variant=`).

## Estado de los hitos

1. ~~Scaffold, tokens y landing.~~ Hecho.
2. ~~Catálogo, autocompletado e imágenes reales en el visor.~~ Hecho (más códigos de colección).
3. Modelo de precios, CSV, gráfica y analizador con tests. Hecho; falta verificar a ojo la importación de CSV y los reversos japoneses.
4. Fichas de carta con SEO y sitemap. Pendiente.
5. Proveedor real de precios y job de instantáneas diarias, cuando esté decidida la fuente. Pendiente.

Antes de cada hito o cambio grande, propón el plan en pocas líneas y espera mi OK.

## Desarrollo

- `npm run dev` en el puerto 3000. **Tras una migración nueva hay que reiniciarlo**: PGlite se abre una vez por proceso y no aplica migraciones en caliente.
- Instancia aislada para pruebas: configuración `slab-test` en `.claude/launch.json` (puerto 3001, `PGLITE_DIR=.data/pglite-test`, `NEXT_DIST_DIR=.next-test`), para no pisar el servidor ni la BD principales.
- Variables: ver `.env.example` (`DATABASE_URL`, `POKEMONTCG_API_KEY`, `ANTHROPIC_API_KEY`, `VARIANT_PHOTOS`, `CRON_SECRET`, `PRICE_MOCK`).
- Fotos de versiones con sello: `GET /api/cards/[id]/variant-photo` busca el producto en el buscador web de TCGplayer (`src/lib/catalog/tcgplayer.ts`). Es solo demostración, pendiente de hablar con TCGplayer; en producción está apagado salvo `VARIANT_PHOTOS=tcgplayer`.

## Cómo trabajar conmigo

- Soy diseñador gráfico y de UI, con base en Java. Explícame lo que hace el código, no solo el resultado.
- Sé directo y ve al grano, de tú a tú.
- Cuando cambies algo, enséñame solo los bloques que cambian, no archivos enteros, con una línea sobre qué hace cada cambio.
