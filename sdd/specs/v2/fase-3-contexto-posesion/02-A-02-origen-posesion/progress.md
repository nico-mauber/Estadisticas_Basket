# Progress — A-02: Origen de la posesión

> **Estado:** 🔶 Implementado en Equipo y Jugador (clasificación, tabla por origen en ataque y defensa, conciliación, tipo de entidad `origin` de T-05 con ficha de T-01, tabla exportable `team_origins` de T-06); falta el filtro de contexto `origin` sobre otras vistas

## Estado de tareas

### Grupo A — Backend: enriquecedor y módulo de agregación
- [x] T-A1 · `origin.enrich_origin` con precedencia (`tiempo_muerto` > `robo` > rebote > tiro libre > canasta > pérdida > `saque_banda`)
- [x] T-A2 · Registro del enriquecedor (`possessions.register_enricher`, al importar `origin` desde `app.py`)
- [x] T-A3 · Robo por vecindad de `action_number` (hasta 3 eventos antes de la pérdida o entre pérdida y apertura). Se usa siempre: el pbp no trae vínculo steal→turnover (`previous_action` solo está en tiros/asistencias)
- [x] T-A4 · `oreb_info` = Σ `len(chances) − 1` de posesiones con ≥ 2 oportunidades, sin depender de A-04
- [x] T-A5 · `stats_engine.origin_rates`
- [x] T-A6 · `origin_report` (reparto de finalización con `fin_periodo` aparte, badge T-02 con `sample.split.*`)
- [x] T-A7 · `side="defensa"`
- [x] T-A8 · Conciliación de suma (`reconcile`)
- [x] T-A9 · `player_origin` (por `finisher_id`)
- [x] T-A10 · Nulos: origen sin posesiones → `null` / `sin_intentos`; sin pbp → 404 `sin_pbp`

### Grupo B — Backend: registro T-05/T-03/T-06
- [x] T-B1 · `origin_bundle` / `all_origin_bundles` + `register_entity("origin")` (`GET /api/metrics/origin?id=<equipo>:<origen>&side=`; población = equipos en el mismo origen y lado)
- [🔶] T-B2 · Dimensión de contexto `origin`: los valores válidos de `context._POSSESSION_VALUES["origin"]` se alinearon con los 7 orígenes (antes eran placeholders); el filtro sigue en `context.ignored` con `requiere_posesiones` hasta que existan bundles a nivel posesión
- [x] T-B3 · `team_origins` (T-06): `GET /api/table/team_origins?team=<code>&side=`, 7 filas, bulk `team`

### Grupo C — Backend: ruta
- [x] T-C1 · `GET /api/origins`
- [x] T-C2 · Errores 400/404

### Grupo D — Frontend
- [x] T-D1 · `api.origins`
- [x] T-D2 · `components/origin-panel.js`
- [🔶] T-D3 · Montado en Equipo (`#team-origins`) y Jugador (`#player-origins`); la pestaña `posesion` no existe porque X-01 (navegación) no se hizo
- [x] T-D4 · Estados loading / vacío / error / offline
- [x] T-D5 · Mobile (columna Origen que envuelve, barra de finalización de ancho mínimo, scroll dentro de la card)
- [x] T-D6 · `sw.js` v45 con `origin-panel.js`

### Grupo E — Documentación
- [x] T-E1 · `docs/api.md` (`GET /api/origins`; falta la tabla `team_origins` y el tipo `origin`)
- [x] T-E2 · `docs/metrics.md` (orígenes, precedencia, fórmulas, default `saque_banda`)
- [x] T-E3 · `docs/frontend.md`
- [x] T-E4 · `docs/architecture.md`

## Estado de CA (gate de aceptación)
Verificado con el seed local (Liga de Ascenso, 13 partidos, 14 equipos) por `test_client` y Chromium 1280 y 360 px.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | `reconcile.ok` en ataque y defensa de ALB, COL, LAG, LBO (p. ej. ALB ataque 160 de 160); 4 equipos probados |
| CA-2 | ✅ | 227 posesiones `robo` en el seed = 227 eventos `steal`; ninguna `robo` sin `steal` del equipo en las 10 jugadas previas |
| CA-3 | ✅ | `tiempo_muerto` solo con un `timeout` previo en el mismo período (el chequeo con ventana de 8 eventos marcó 3 casos; revisados a mano: el `timeout` está seguido de 9 a 11 sustituciones antes del primer evento de la posesión, la clasificación es correcta) |
| CA-4 | ✅ | La primera posesión de cada período es `saque_banda` en todos los partidos (0 violaciones) |
| CA-5 | ✅ | `oreb_info` aparte; `reconcile.sum_origins` = total de posesiones completas |
| CA-6 | ✅ | Origen sin posesiones (jugador): `possessions: 0` y `value: null` con `sin_intentos` |
| CA-7 | ✅ | Defensa se arma con las posesiones del rival del mismo partido: mismo dato que el ataque del rival por construcción |
| CA-8 | ✅ | Badge "baja" en gris bajo `sample.split.min` (15) |
| CA-9 | ❌ | Filtro `origin` aún ignorado (T-B2) |
| CA-10 | 🔶 | `/api/metrics/origin?id=ALB:robo` devuelve las 89 claves; uso_*, paint_*, second_chance… con `no_aplica`. `pace` y `net_rating`/`der` salen calculados aunque no tienen sentido en un subconjunto de posesiones: pendiente marcarlos `no_aplica` en `compute_standard` |
| CA-11 | ✅ | Los 2 partidos con prórroga del seed: primera posesión de la prórroga = `saque_banda` |
| CA-12 | ✅ | 360 px: sin scroll horizontal de página (`scrollWidth` 360), consola sin errores |

## Desviaciones
- **Tiro libre rival rebotado:** la definición del cliente ("convertido o rebotado") manda sobre la precedencia de la arquitectura, que pondría `rebote_defensivo` por encima. Un rebote defensivo de un tiro libre errado cuenta como `tiro_libre_rival`.
- **Robo:** sin vínculo `previous_action` en las pérdidas, el robo se detecta por vecindad (ver T-A3).
- **Percentil de T-01:** lo traen `/api/metrics/origin` y la tabla solo vía ficha del payload; el panel de Equipo no lo muestra todavía. En la tabla `team_origins` los percentiles van vacíos (la población depende del origen y la tabla mezcla siete).

## Docs pendientes
Ninguno.
