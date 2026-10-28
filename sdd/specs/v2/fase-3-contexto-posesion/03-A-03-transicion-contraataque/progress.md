# Progress — A-03: Transición y contraataque

> **Estado:** 🔶 Implementado en Equipo (ataque y defensa) y Jugador, con entidad `ptype` (T-05) y tabla `team_ptypes` (T-06); falta el filtro de contexto `ptype` sobre otras vistas

## Estado de tareas
- [x] Enriquecedor `enrich_ptype` (tipo, motivo, finalización, iniciador y finalizador), registrado después de `origin`
- [x] Cortes de `transition.max_secs` / `early_offense.max_secs` activados en `CONFIG_SPEC` (`status="activa"`)
- [x] `transition_report` ataque: tipos, diferencial de PPP, primer tiro, origen del contraataque, finalización, rebote → transición, corredores, primer pase `no_registrado`
- [x] `transition_report` defensa: concedidas por 100, origen concedido, pérdidas propias → transición rival, balance defensivo
- [x] `player_transition` y `GET /api/transition`
- [x] `reconcile_fastbreak` (RF-21, informativo)
- [x] Entidad `ptype` (`/api/metrics/ptype?id=<equipo>:<tipo>&side=`) y tabla `team_ptypes`
- [x] Panel `transition-panel.js` en Equipo y Jugador; `sw.js` v46
- [x] Docs: `api.md`, `metrics.md`, `frontend.md`, `architecture.md`
- [ ] Filtro de contexto `ptype` en otras vistas (CA-17): los valores válidos se alinearon con `transicion|early|media_cancha`, el filtro sigue en `context.ignored`

## Estado de CA (gate de aceptación)
Seed local (Liga de Ascenso, 13 partidos): `test_client` y Chromium 1280 y 360 px.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | ALB ataque 39 + 31 + 87 = 157 = `classified`; `reconciled: true` en ALB y COL, ataque y defensa |
| CA-2 | ✅ | ALB: local 73 + visitante 84 = 157 clasificadas; transiciones 12 + 27 = 39 |
| CA-3 | ✅ (por construcción) | `_ptype_of`: ≤ 7 transición, ≤ 12 early, resto media cancha |
| CA-4 | ✅ | `transition.max_secs` 7 → 6 por `PUT /api/settings`: transiciones 39 → 34, early 31 → 36; tras `reset` vuelve a 39/31/87 sin reiniciar. 13 (≥ `early_offense.max_secs`) rechazado por la regla de coherencia |
| CA-5 | ✅ | el tipo sale del reloj, el origen del evento previo: se calculan por separado |
| CA-6 | ✅ | `summary.unclassified` cuenta `incompleta`, `sin_accion`, `reloj_no_derivable` (ALB defensa: 151 clasificadas de 159 = 6 + 2) |
| CA-8 | ✅ | origen del contraataque ALB: 20 + 5 + 6 + 4 + 4 = 39 = transiciones |
| CA-9 | ✅ | histograma 13 + 15 + 21 + 42 + 26 = 117 posesiones con tiro; 40 sin tiro |
| CA-10 | ✅ | 15 + 1 + 4 + 7 + 5 + 6 = 38 = transiciones no `fin_periodo` |
| CA-11 | ✅ | 53 rebotes defensivos, 20 a transición (37,7 %), 9 con puntos |
| CA-12 | ✅ | iniciadores identificados 24 de 39 (cobertura explícita) |
| CA-13 | ✅ | `pass_out` = `null` / `no_registrado` con la nota |
| CA-14 | ✅ | defensa usa las posesiones del rival del mismo partido |
| CA-15 / CA-16 | ✅ | ALB: 24 pérdidas, 13 seguidas de transición rival, 8 con puntos; balance 9 de 74 tiros fallados |
| CA-17 | ❌ | filtro `ptype` pendiente |
| CA-18 | ✅ | `/api/metrics/ptype?id=ALB:transicion` devuelve las 89 claves, población de 13 equipos |
| CA-19 | ✅ | sin posesiones: `null` / `sin_intentos`; equipo inexistente 404 `no_encontrado` |
| CA-20 | ✅ | badge "baja" y fila en gris bajo `sample.split.min` |
| CA-21 | ✅ | las prórrogas entran con el mismo criterio (reloj dentro del período) |
| CA-22 | ✅ | `reconcile_fastbreak` informa por partido (p. ej. 26 reconstruidos vs 16 oficiales); sin error |
| CA-23 | ✅ | 360 px: `scrollWidth` 360, consola sin errores |

## Desviaciones
- El calificador `fastbreak` de FIBA no se guarda (no hay columna `qualifiers`): la validación cruzada usa solo `fast_break_pts`.
- Balance defensivo: cuenta posesiones rivales de origen `rebote_defensivo` en transición con puntos; no revisa si el tiro fallado era de campo (los rebotes de tiro libre ya caen en `tiro_libre_rival` de A-02).
- La reconstrucción da más puntos de transición que el box oficial (26 vs 16 en un partido): el criterio del cliente (primeros 7 s) es más amplio que el de FIBA.
- `pace`, `net_rating` y `der` de `/api/metrics/ptype` se calculan sin sentido sobre un subconjunto (igual que en `origin`).

## Docs pendientes
Ninguno.
