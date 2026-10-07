# Spec — C-03: Mapas de tiro: PPT y detalle por zona

> **ID:** C-03 · **Prioridad:** P1 · **Fase y orden:** 1·17
> **Depende de:** C-07 — [`../10-C-07-detalle-tiro-completo/spec.md`](../10-C-07-detalle-tiro-completo/spec.md) · T-01 — [`../15-T-01-ficha-de-metrica/spec.md`](../15-T-01-ficha-de-metrica/spec.md) · T-02 — [`../14-T-02-confiabilidad-muestra/spec.md`](../14-T-02-confiabilidad-muestra/spec.md)
> **Habilita:** A-05, F-07, A-09
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-03 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0 (fila C-03/C-07), §1.5 D-06/D-07, §1.6, §2.2 (DA-03, DA-35), §3.5, §3.6, §4, §5, §6, §8, §9.1 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §2 C-03):**
- *"En la etiqueta fija de cada zona mostrar: % de acierto, eFG% de la zona y PPT (puntos por tiro)."*
- *"Eliminar el indicador P/F de las etiquetas por zona y del encabezado."*
- *"Aplica al mapa de tiro de equipo y al shot chart por zonas de jugador."*
- Tooltip (tap en móvil) con 7 datos: convertidos/intentados (c/i), FG% de la zona (1 decimal), eFG% de la zona
  (1 decimal), PPT de la zona (2 decimales), peso de la zona (% de los tiros del equipo o jugador), percentil
  (comparación con la competencia, T-01), muestra (badge de T-02 cuando hay pocos intentos).
- *"El tooltip respeta la barra de contexto (T-03): si hay filtro de tramo de reloj, cuarto o rival aplicado, muestra
  los datos de ese subconjunto."*
- *"Zonas sin intentos: el tooltip indica que no hay tiros registrados, no muestra 0% ni PPT 0,00 (C-11)."*
- **Criterio de aceptación:** *"ninguna etiqueta muestra "P/F", y al posarse sobre cualquier zona aparecen los siete
  datos de la tabla anterior."*
- En §1.3 el requisito aparece en S3 · Equipo → pestaña Tiro (*"Mapa por zonas con PPT, detalle T2/T3/TL en promedio y
  totales"*, junto con C-07) y en S4 · Jugador → pestaña Tiro (*"Shot chart por zonas con PPT, detalle T2/T3/TL"*).

**Qué existe hoy (verificado en código, working tree = integración de `dev` vía C-11 Grupo 0):**
- **Backend.** `backend/app.py`: `ZONE_KEYS_11` (l.111–117, 11 zonas fijas), `ZONE_POINTS` (l.119–124),
  `_classify_zone_11(action_type, sub_type, x=0, y=0)` (l.132–181, clasifica por palabras clave de `sub_type` para 2pt
  de pintura y por umbrales de `x`/`y` normalizados 0–100 cuando hay coordenadas; sin coordenadas, cae a zonas por
  defecto `top_key_3`/`mid_top`), `_zones_from_shots(rows)` (l.598–627, agrupa una lista de `Shot` en las 11 zonas +
  totales del conjunto: `made`, `attempts`, `pct`, **`ppt`** (l.617, ya renombrado de `pf`: puntos de la zona /
  intentos de la zona — la fórmula no cambió, solo la etiqueta, según el comentario del propio código) y **`efg`**
  (l.618–621, `(made × factor)/attempts`, `factor` 1,0 en zonas de 2 y 1,5 en zonas de 3). Rutas `GET
  /api/shots/<team_code>/<player_name>` (l.630) y `GET /api/shots/<team_code>` (l.667): responden
  `{zones, total_shots, has_coordinates, summary: {ppt, efg_pct, ppp, games}}` — **`summary.ppt`** ya reemplazó a
  `global_pf`/`pf` (verificado: no hay ninguna clave `pf` ni `global_pf` en la respuesta actual).
- **Coordenadas de tiro:** `Shot.x`/`Shot.y` existen en el esquema (`backend/database.py`) pero **hoy siempre son 0**
  (Arquitectura D-06/§1.6): el parser de `fiba_fetcher.py` lee `raw["shot"]` (nivel raíz), que no existe en el JSON de
  FIBA; las coordenadas reales están en `tm[n].shot[]` (nivel de equipo), con 1.769 tiros verificados en los 13
  partidos del seed = 100 % de los tiros del pbp, geometría confirmada (Arquitectura §1.6: transformación de cancha
  completa, aro en `(lat 7,5 m, prof 1,575 m)`, triples de esquina a 0,5–0,7 m del lateral). **F-11 (orden 02, antes
  que C-03 en la fase) captura esas coordenadas reales** en `shots.court_x`/`shots.court_y` y reprocesa los partidos
  del seed (DA-32); hasta entonces, `_classify_zone_11` cae a su rama `has_coord = False` (siempre `top_key_3` para
  3pt y `mid_top` para 2pt fuera de pintura), lo que hoy **degrada el mapa de 11 zonas a casi 3 zonas reales** con
  datos concentrados en 3 cajas.
- **Frontend.** `frontend/js/app.js`: `_scBoxFill(ppt)` (l.1620, heatmap por umbrales fijos `1,00`/`0,85`, comentario
  explícito "la fórmula no cambió con C-03 — solo el nombre"), `_scLbl(zones, totalShots, key, lx, ly)` (l.1666–1684,
  etiqueta fija de cada zona: ya muestra `share%` = peso de la zona sobre `totalShots`, `PPT {valor}`, `{fg}%` en
  grande y `eFG {valor}%` — **los 4 primeros de los 7 datos del tooltip ya están en la etiqueta fija, no en un
  tooltip separado**), `_scBadge(summary)` (l.1686–1698, caja "PPT" + "eFG%" del conjunto completo, comentario
  "C-03: era P/F"), `_courtLinesSVG` (l.1700–1720), `_shotChart11SVG`/`_shotChart3SVG`/`_shotChartSVG` (l.1733–1769,
  dispatcher por `has_coordinates`). **Verificado con búsqueda: cero apariciones de `"P/F"`, `"PEP"`, `pf:` o
  `global_pf` en `_scLbl`/`_scBadge`/las rutas de shots** — el CA literal del cliente ("ninguna etiqueta muestra
  P/F") **ya se cumple hoy**. Lo que **no existe**: ningún manejador de `mouseenter`/`touchstart`/`click` sobre las
  cajas SVG (`_scLbl` no adjunta ningún atributo `data-*` ni evento; es solo texto SVG estático dentro de un
  `<svg>` inyectado por `innerHTML`), ningún tooltip flotante, ninguna referencia a percentil o a badge de muestra en
  el payload de zonas, y ningún estado "sin tiros registrados" (una zona sin intentos hoy simplemente **no se
  dibuja** — `_scLbl` retorna `''` si `!z?.attempts`, l.1668 — en vez de mostrarse con ese mensaje).
- **Nulos (C-11):** ya aplicado en el cálculo de zona (`_zones_from_shots` deja `pct`/`ppt`/`efg` en `None` si
  `attempts == 0`, l.622–625) y en el resumen (`summary.ppt`/`efg_pct` `None` si `total_fga == 0`, l.659–660); pero la
  UI **oculta** la zona sin intentos en vez de mostrarla con el mensaje del cliente (la regla de C-11 es "nunca 0%,
  nunca PPT 0,00", no "nunca mostrar la zona").

**Qué ya resolvieron features anteriores:**
- `sdd/specs/10-mapa-tiro-equipo` (Feature 10, existente): construyó el mapa SVG agregado de equipo reusando
  `_shotChartSVG`, con el fallback de 3 zonas cuando `has_coordinates` es falso (`sdd/specs/01-shot-chart-fallback-visual`,
  anterior a la numeración v2).
- La feature 16 de `dev` (`16-detalle-tiro-y-ppt`, integrada en C-11 Grupo 0): agregó `zones[].ppt`/`zones[].efg`,
  retiró `pf`/`global_pf`, agregó `summary.ppt`, `summary`/`totals` de C-07 y `_shotDetailGrid()` — es decir, ya
  resolvió el renombrado P/F→PPT y el detalle T2/T3/TL de C-07 (spec separada). El propio código de la feature 16
  deja comentado "Tooltip de 7 datos (C-03)" como pendiente.

**Qué queda para C-03 (delta sobre el estado actual):**
1. Reemplazar el modelo de "etiqueta fija con 4 datos" por "etiqueta fija reducida + tooltip/hoja de 7 datos" (hover
   en desktop, tap en móvil/tablet), agregando los 3 datos que faltan: convertidos/intentados exactos, percentil
   (T-01) y badge de muestra (T-02).
2. Estado "sin tiros registrados" visible en vez de zona oculta.
3. Endpoint propio `GET /api/shot-zones` (arquitectura §6, dueño C-03) que agregue `share`, `percentile` y `sample`
   por zona — hoy `/api/shots/...` no los calcula porque T-01/T-02 (poblaciones y muestra) todavía no existen en la
   fase 1 hasta llegar a C-03 (orden 17, el último de la fase, después de T-01 orden 15 y T-02 orden 14).
4. Respetar el contexto de la barra (T-03) — en fase 1, antes de que T-03 exista, solo `competition` y `last`
   (Arquitectura I-07: "C-03 usa `context.parse_context` desde el día 1, en fase 1 solo `competition` y `last`").
5. Color del mapa por percentil de PPT de la zona (DA-35), reemplazando `_scBoxFill` por umbrales fijos.
6. Coordenadas reales de tiro: **incremento diferido hacia F-11** (DA-32) — C-03 se especifica para funcionar con
   las coordenadas que F-11 entregue (reales cuando F-11 esté integrado; degradadas a 3 zonas reales mientras tanto,
   comportamiento ya presente y sin regresión).

## 1. Objetivo
Que cada zona del mapa de tiro (equipo y jugador) muestre, al pasar el cursor o tocarla, los siete datos que permiten
juzgar si esa zona es una fortaleza o una debilidad real — no solo el número, sino cuántos tiros la sostienen y cómo
se compara con la competencia — y que ninguna etiqueta hable de "P/F" ni invente un 0% donde no hay tiros.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 · C-03 (texto completo y CA), §1.3 S3 (pestaña Tiro de Equipo) y S4 (pestaña Tiro de Jugador).
- Arquitectura §1.0 (tabla C-03/C-07 de `dev`), §1.5 D-06 (coordenadas en `tm[n].shot[]`, parser roto), D-07
  (geometría de `_classify_zone_11` a corregir a cancha completa), §1.6 (geometría verificada, transformación de
  coordenadas), §2.2 (DA-03 PPT del glosario, DA-35 color por percentil), §3.5 (T-05, tipo de entidad `zone`), §3.6
  (T-01, `population.py`, `ficha`, `percentileColor`), §3.7 (T-02, `sample.py`, `sample_level`), §3.8 (T-03, contexto
  — en fase 1 solo `competition`/`last`), §4 (`shot_zones.py`, dueño C-03), §5 (`shots.court_x`/`court_y`, dueño
  F-11), §6 (`GET /api/shot-zones`, dueño C-03; `GET /api/shots/...` mod., delega en `shot_zones`), §8 (componente
  `components/shot-chart.js`, dueño C-03), §9.1 (dependencias C-07/T-01/T-02/F-11, estimación L 12–18 h).
- `docs/api.md` — `GET /api/shots/<team>/<player>` y `GET /api/shots/<team>` (shape actual, `zones{11}`,
  `has_coordinates`, `summary`).
- `docs/database.md` — `shots` (`x`, `y`, `action_type`, `sub_type`, `period`, `action_number`).
- `docs/metrics.md` — eFG%, PPT (glosario v2 §6, conciliación DA-03: puntos de campo / TCi).
- Código verificado: `backend/app.py` (`_classify_zone_11`, `_zones_from_shots`, rutas de shots), `frontend/js/app.js`
  (`_scLbl`, `_scBadge`, `_shotChart11SVG`/`_shotChart3SVG`, `_scBoxFill`).
- Specs relacionadas: `sdd/specs/10-mapa-tiro-equipo` (mapa de equipo existente), spec de `dev`
  `git show dev:sdd/specs/16-detalle-tiro-y-ppt/spec.md` (PPT y detalle T2/T3/TL, predecesor directo).

## 3. Historias de usuario
- **US-1**: Como entrenador, quiero ver en cada zona del mapa el % de acierto, el eFG% y el PPT sin la etiqueta "P/F"
  heredada, para leer el mapa con las métricas correctas de un vistazo.
- **US-2**: Como analista, quiero tocar o pasar el cursor sobre una zona y ver cuántos tiros la sostienen, su peso
  sobre el total y cómo se compara con la competencia, para no confundir una racha de 2/2 con una fortaleza real.
- **US-3**: Como entrenador, quiero que una zona sin tiros registrados lo diga explícitamente, para no leerla como un
  0% real.
- **US-4**: Como analista, quiero que el color del mapa refleje qué tan buena es la zona respecto de la competencia
  (no un umbral fijo arbitrario), para comparar equipos y jugadores de forma consistente.
- **US-5**: Como entrenador, quiero que el tooltip respete el filtro de contexto activo (competencia, últimos N
  partidos), para leer el mapa del período que me interesa.

## 4. Requisitos funcionales
- **RF-1**: La etiqueta fija de cada zona DEBE mostrar % de acierto, eFG% de la zona y PPT de la zona, y NO DEBE
  mostrar ningún indicador etiquetado "P/F" en ninguna zona ni en el encabezado/badge del conjunto. (US-1) (Esp. v2
  §C-03) — Ya cumplido hoy (`_scLbl`/`_scBadge` muestran PPT/eFG/FG% sin rastro de "P/F"); RF de no-regresión.
- **RF-2**: Al pasar el cursor sobre una zona en escritorio, o al tocarla en móvil/tablet, el sistema DEBE mostrar un
  tooltip (o, en pantallas ≤768 px, una hoja/panel) con los siete datos: convertidos/intentados (`"3/5"`), FG% (1
  decimal, `"60,0%"`), eFG% (1 decimal, `"70,0%"`), PPT (2 decimales, `"1,40"`), peso de la zona (`"12,3% de los
  tiros"`), percentil de competencia (T-01) y badge de muestra (T-02, cuando los intentos son pocos). (US-2) (Esp.
  v2 §C-03, tabla de 7 datos) (Arquitectura §3.6, §3.7) · Aplica al mapa de equipo y al shot chart de jugador.
- **RF-3**: Una zona sin intentos DEBE mostrarse (no ocultarse) con un mensaje que indique que no hay tiros
  registrados; NO DEBE mostrar "0%" ni "PPT 0,00". (US-3) (Esp. v2 §C-03 "Zonas sin intentos") (Esp. v2 §C-11)
- **RF-4**: El tooltip DEBE calcular sus 7 datos sobre el mismo subconjunto de tiros que aplica el contexto activo
  (en fase 1: `competition`, `last`; T-03 en fase 2 agrega el resto de dimensiones sin que C-03 cambie). (US-5) (Esp.
  v2 §C-03 "respeta la barra de contexto") (Arquitectura §3.8, I-07)
- **RF-5**: El percentil de cada zona DEBE calcularse sobre la población de referencia de T-01 (entidades de la
  misma competencia, mismo tipo — equipo o jugador — y mismo contexto), usando el PPT de esa zona como métrica.
  (US-2, US-4) (Arquitectura §3.5 tipo de entidad `zone`, §3.6) · Sin universo o sin población suficiente → percentil
  `null` con razón (`sin_universo`, `poblacion_insuficiente`), nunca un número inventado.
- **RF-6**: El color de fondo de cada caja de zona DEBE reflejar el percentil de PPT de la zona (escala continua de
  T-01), reemplazando los umbrales fijos actuales (1,00/0,85). Una zona sin percentil (sin universo, sin intentos)
  DEBE mostrarse sin color de rendimiento. (US-4) (Arquitectura §2.2 DA-35, §3.6 `percentileColor`)
- **RF-7**: El badge de muestra DEBE aparecer en el tooltip cuando el nivel de confiabilidad de la zona (T-02, unidad
  "intentos") sea `baja`, con el mismo criterio que el resto de la app. (US-2) (Esp. v2 §C-03 "Muestra: Badge de T-02
  cuando hay pocos intentos") (Arquitectura §3.7)
- **RF-8**: El sistema DEBE seguir clasificando cada tiro en una de las 11 zonas fijas existentes
  (`ZONE_KEYS_11`), usando las coordenadas reales que F-11 capture cuando estén disponibles, y degradando de forma
  honesta (zonas por defecto, `has_coordinates: false`) cuando un partido no las tiene. (US-1) (Arquitectura §1.5
  D-06/D-07, DA-32) · Corregir la geometría a cancha completa (D-07: `_classify_zone_11` asume media cancha
  normalizada; FIBA da cancha completa con lados alternando al descanso) es responsabilidad de C-03 sobre las
  coordenadas que F-11 ya transforma a media cancha (Arquitectura §1.6 fórmula de transformación) — ver §9.
- **RF-9**: El sistema DEBE seguir mostrando el mapa de 3 zonas agregadas (triple / media distancia / pintura) como
  fallback cuando el partido no tiene coordenadas de tiro (`has_coordinates: false`), sin RF-2 a RF-7 salvo que se
  puedan calcular con los datos disponibles (peso, percentil y muestra sí; FG%/eFG%/PPT de la zona agregada también
  sí). (US-1) — RF de no-regresión sobre el comportamiento actual (`_shotChart3SVG`).
- **RF-10**: Las fórmulas de FG%, eFG% y PPT de zona DEBEN mantenerse exactamente como están hoy (verificadas en
  `_zones_from_shots`): `pct = made/attempts`, `ppt = made × ZONE_POINTS[zona] / attempts`, `efg = made × factor /
  attempts` (`factor` 1,0 en zonas de 2, 1,5 en zonas de 3). (US-1) (docs/metrics.md, Arquitectura §2.2 conciliación
  de PPT/eFG%) · RF de no-regresión: C-03 no cambia las fórmulas de zona, solo agrega datos y visualización.

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `shots` (`x`, `y`, `action_type`, `sub_type`, `period`, `action_number`) | tabla existente | Solo lectura | No |
| `shots.court_x` / `.court_y` | columnas | Coordenadas reales de cancha completa (F-11 las agrega y reprocesa) | No (F-11); C-03 las **usa** cuando estén disponibles |
| `GET /api/shot-zones` | endpoint | Query `entity=team\|player&id=<code o player_id>&competition=<id>&last=<n>` → `{zones: {clave: {made, attempts, fg_pct, efg_pct, ppt, share, percentile, sample}}, summary, has_coordinates, context}` | **NUEVO** (Arquitectura §6, dueño C-03) |
| `GET /api/shots/<team_code>` · `/<team_code>/<player_name>` | endpoint existente (mod.) | Delega en `shot_zones` internamente; shape actual + `share` por zona (compatibilidad con las vistas que aún no migraron a `/api/shot-zones`) | Cambio de contrato (agrega `share`; el resto sin cambio) |

Errores (formato arquitectura §7.8): 404 `no_encontrado` "Equipo no encontrado" / "Jugador no encontrado" (según
`entity`) · 400 `parametro_invalido` "El parámetro entity debe ser 'team' o 'player'" (**NUEVO**) · 400
`competencia_inexistente` (resolución compartida). Sin cambios de esquema (Arquitectura §5: "Sin cambios de esquema:
… C-03 …" — las columnas de coordenadas son de F-11, no de C-03).

## 6. Estados de UI

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Mapa de tiro (Equipo, pestaña Tiro) | `"Cargando mapa de tiro..."` (existente) | `"Sin tiros registrados para este equipo."` (nuevo, si 0 intentos en todas las zonas) | `"No se pudo cargar el mapa de tiro"` (existente) | mensaje de error de red de `api.js` (existente) | 11 (u 3) cajas con FG%/eFG%/PPT; tooltip con los 7 datos al hover/tap; zonas sin intentos con "Sin tiros registrados" en vez de la caja de color |
| Shot chart (Jugador, pestaña Tiro) | ídem | `"Este jugador no tiene tiros registrados."` (nuevo) | ídem | ídem | ídem |
| Tooltip / hoja de zona (móvil) | — | — | — | — | c/i, FG%, eFG%, PPT, peso, percentil, muestra; badge de muestra si nivel `baja` (T-02); en zona sin intentos: solo el mensaje "Sin tiros registrados en esta zona." (sin los otros 6 datos) |

Copy nuevo (español directo, sin `t()` por DA-21; a `docs/frontend.md`): `"Sin tiros registrados"` (badge/etiqueta de zona vacía), `"Sin tiros
registrados en esta zona."` (tooltip de zona vacía), `"Sin tiros registrados para este equipo."` / `"...este
jugador."` (vacío de sección), `"{c}/{i}"` (formato convertidos/intentados), `"{n}% de los tiros"` (peso de zona).

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given el mapa de tiro de equipo o el shot chart de jugador, When se observan las
  etiquetas de zona y el encabezado, Then ninguna muestra "P/F"; and When se posa el cursor (o se toca en móvil)
  sobre cualquier zona con al menos un intento, Then aparecen los siete datos: c/i, FG%, eFG%, PPT, peso, percentil y
  muestra.
- **CA-2**: Given una zona sin intentos, When se la observa en el mapa, Then no muestra "0%" ni "PPT 0,00"; el
  tooltip/hoja indica que no hay tiros registrados en esa zona.
- **CA-3**: Given el mismo equipo consultado con `competition=<id>&last=5` y sin filtro, When se comparan los
  tooltips de una misma zona, Then los 7 datos reflejan cada subconjunto por separado (distintos `attempts` si el
  filtro cambia la muestra).
- **CA-4**: Given una zona con pocos intentos (por debajo del umbral de T-02 para la entidad `zone`), When se abre su
  tooltip, Then muestra el badge de muestra "baja" junto a los demás datos.
- **CA-5**: Given una competencia con al menos 3 equipos con datos (población mínima de T-01), When se consulta el
  percentil de una zona de un equipo, Then el valor está entre 0 y 100 y coincide con el cálculo manual (posición
  relativa de su PPT de zona entre los PPT de zona de los demás equipos de la población).
- **CA-6**: Given una competencia con menos entidades que `population.min_size`, When se consulta el percentil de una
  zona, Then el valor es `null` con razón `poblacion_insuficiente`, y el tooltip lo muestra sin inventar un número.
- **CA-7**: Given un partido sin coordenadas de tiro (`has_coordinates: false`), When se abre su mapa de tiro
  agregado, Then se muestra el fallback de 3 zonas (triple/media/pintura) con FG%/eFG%/PPT/peso/percentil/muestra
  calculables sobre esas 3 zonas, sin error.
- **CA-8**: Given el color de las cajas del mapa, When se compara una zona con percentil alto (≥ 80) contra una con
  percentil bajo (≤ 20) de la misma competencia, Then sus colores son visualmente distintos según la escala de
  percentil de T-01 (verde tendiendo a rojo), no según los umbrales fijos 1,00/0,85 anteriores.
- **CA-9**: Given el recorrido de las pestañas Tiro de Equipo y Jugador (desktop y 360 px), When se interactúa con
  el mapa, Then no hay errores en consola, el tooltip no se corta contra el borde de la pantalla y en móvil se abre
  con un toque (no requiere hover).

## 8. Fuera de alcance
- **Coordenadas reales de tiro** (captura desde `tm[n].shot[]`, transformación a media cancha, reproceso de
  partidos): responsabilidad de F-11 (DA-32); C-03 consume `shots.court_x`/`court_y` cuando existan y sigue
  degradando con honestidad mientras no existan. Mientras F-11 no esté integrado, C-03 se verifica contra el estado
  actual (coordenadas en 0, mapa degradado a zonas por defecto) sin que eso bloquee el resto del requisito.
- **Filtros de contexto más allá de `competition`/`last`** (sede, rival, cuarto, marcador, tramo de reloj, con/sin
  jugador): **INCREMENTO DIFERIDO (→ T-03)** —
  [`../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/`](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/).
  El tooltip ya queda preparado para recibir más parámetros de contexto sin cambiar su forma (RF-4).
- **Percentil por tramo de reloj cruzado con zona** (matriz zona × tramo, mencionada en la especificación §5 para
  A-06): **INCREMENTO DIFERIDO (→ A-06)** —
  [`../../fase-5-analitica-exploracion/07-A-06-contextos-cruzados/`](../../fase-5-analitica-exploracion/07-A-06-contextos-cruzados/).
  C-03 solo expone el percentil de zona simple (sin cruce de dimensiones).
- **Exportación del mapa de tiro** (PNG/PDF/CSV): T-06.
- **Migración completa de las vistas actuales a `GET /api/shot-zones`**: C-03 crea el endpoint nuevo y lo usa desde
  el mapa/shot chart; las rutas legado `GET /api/shots/...` siguen respondiendo (con `share` agregado) para no romper
  otros consumidores mientras no se verifique cada uno.
- **Migrar `_scBoxFill`/el color de zona a un componente compartido `shot-chart.js`**: la arquitectura (§8) fija ese
  componente como dueño de C-03; se implementa dentro de este mismo requisito (no es un incremento diferido, es
  parte del alcance normal — se aclara para que no se lea como pendiente).

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] Alcance de la corrección de geometría D-07.** La arquitectura marca D-07
  ("`_classify_zone_11` asume media cancha normalizada; FIBA da cancha completa") como responsabilidad de C-03
  (`shot_zones.py`), pero la transformación de coordenadas crudas de FIBA a media cancha (`to_half_court`) la crea
  F-11 según el mapa de módulos (§4: `shot_zones.py` con `to_half_court`, dueño C-03 según la tabla, pero
  consumidor de `shots.court_x/court_y` que arma F-11). Se adopta: **F-11 transforma y persiste `court_x`/`court_y`
  ya en media cancha** (según la fórmula de Arquitectura §1.6); **C-03 solo ajusta los umbrales de
  `_classify_zone_11`** para que coincidan con esa media cancha ya transformada (no rehace la transformación). Si al
  implementar F-11 no entrega la transformación completa, C-03 documenta el hueco en progress.md y trabaja sobre
  coordenadas crudas con una nota de precisión reducida.
- **[DECISIÓN PROPUESTA — confirmar] Población de referencia del percentil de zona.** La arquitectura no detalla
  explícitamente los criterios de población para el tipo de entidad `zone` (T-05 §3.5 solo dice que C-03 registra
  ese tipo). Se adopta: la población de una zona de **equipo** son todos los equipos de la competencia con al menos
  `sample.team.min` partidos (mismo criterio que T-01 para equipos, aplicado a su PPT de esa zona); la población de
  una zona de **jugador** son todos los jugadores con `minutes ≥ sample.player.min` (mismo criterio que T-01 para
  jugadores). Sin T-01 implementado todavía en el momento de escribir este spec, C-03 declara esta regla y la
  aplica llamando a `population()`/`ficha()` de `population.py` (dueño T-01, orden 15, anterior a C-03 en la fase).
- **[DECISIÓN PROPUESTA — confirmar] "Peso de la zona" — sobre qué universo.** El cliente dice "% de los tiros del
  equipo o jugador"; se adopta: peso = intentos de la zona / intentos totales del **mismo contexto** que el resto
  del tooltip (mismo `competition`/`last` aplicado), no del histórico completo sin filtrar — así es coherente con
  RF-4 ("respeta la barra de contexto").
- **[DECISIÓN PROPUESTA — confirmar] Umbral de muestra para zonas (T-02).** La arquitectura fija `sample.clock_zone.min`
  (10 intentos) / `.high` (30) en `CONFIG_SPEC` (§3.2), bajo el consumidor "T-02, C-03, A-05" — se adopta esa clave
  también para la unidad "intentos" de zona de tiro (no crea una clave nueva), aunque su nombre menciona "clock_zone"
  (compartida con A-05, que también usa zonas del reloj de posesión).
- **[DECISIÓN PROPUESTA — confirmar] `GET /api/shot-zones` vs. migrar `/api/shots/...`.** Se crea el endpoint nuevo
  (arquitectura §6 lo fija como dueño C-03) y las rutas legado delegan en él para no duplicar lógica, agregando
  `share` a su respuesta actual sin retirar ningún campo — así ninguna vista que ya usa `/api/shots/...` se rompe
  mientras no se la migre explícitamente al nuevo endpoint.
