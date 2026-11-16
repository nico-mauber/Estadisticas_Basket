# Progress — A-04: Segunda oportunidad

> **Estado:** 🔶 Implementado en Equipo (ataque y defensa) y Jugador, con conciliación contra el box oficial, entidad `chance` (T-05) y tabla `team_second_chance` (T-06); falta el filtro de contexto `chance` sobre otras vistas

## Estado de tareas
- [x] Enriquecedor `enrich_chances` (desenlace, modo, segundos, origen del rebote, captura y finalización) y campos nuevos en `Chance`
- [x] Claves `oreb.putback_secs` / `oreb.kickout_secs` activadas en `CONFIG_SPEC`
- [x] Ataque: PPP 1.ª vs 2.ª, puntos por RO, conversión, desenlaces, modos, origen del RO, cadenas, jugadores, coste, segundos al tiro
- [x] Defensa: OR% concedido, PPP concedido, segundos del rival; zona del rebote y rebote largo `no_registrado`
- [x] `reconcile` con `second_chance_pts` (informativo por partido)
- [x] `player_second_chance`, `GET /api/second-chance`
- [x] Panel `second-chance-panel.js` en Equipo y Jugador; `sw.js` v47
- [x] Docs: `api.md`, `metrics.md`, `frontend.md`, `architecture.md`
- [ ] Entidad `chance` (`/api/metrics/chance`), tabla `team_second_chance` y filtro `chance` — pendientes

## Estado de CA (gate de aceptación)
Seed local (13 partidos, todos con ingesta v5): `test_client` y Chromium 1280 px.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | 🔶 | 11 de 14 equipos coinciden exacto. ALB +2 (2849337), MON +2 (2849347), LAG −2 (2849331, con un rebote ofensivo en posesión incompleta). Sin causa identificada en ALB y MON: no son faltas antideportivas/técnicas en la cadena; criterio de FIBA distinto en algún caso de falta tras rebote ofensivo |
| CA-2 | ✅ | Suma de desenlaces = segundas oportunidades (ALB 19, COL 21, LAG 31) y suma de puntos = puntos calculados |
| CA-3 | ✅ | Segundas oportunidades = `orb` del box en posesiones completas (ALB 19 = 19, COL 21 = 21, LAG 31 = 31; LAG tiene 1 posesión incompleta aparte) |
| CA-4 | ✅ | `putback` exige que el tiro no tenga asistencia vinculada |
| CA-5 | ✅ | COL: `oreb.putback_secs` 3 → 2 deja los 7 putbacks y 21 en total; con 1 baja a 6 y el kick-out sube a 3; total constante; tras `reset` vuelve |
| CA-6 | ✅ | ALB: capturas por jugador + equipo = 19; puntos finalizados = 18 = puntos calculados |
| CA-7 | ✅ | Zona del rebote y rebote largo: `—` con explicación, nunca 0 |
| CA-8 | ✅ | Sin rebotes: el panel muestra "No hay rebotes ofensivos en esta selección."; tasas `null` / `sin_intentos` |
| CA-9 | ✅ | Badge "baja" y fila en gris bajo `sample.split.min` |
| CA-10 | ✅ | OR% concedido de ALB = 0,3176 = 1 − DR% (0,6824) |
| CA-11 / CA-12 | ❌ | Filtro `chance` y entidad `chance` pendientes |
| CA-13 | ✅ (por construcción) | Partidos sin ingesta actual quedan en `reconcile.excluded` con `no_registrado`; el origen del RO no depende de `previous_action` (usa el evento de cierre de la oportunidad anterior) |
| CA-14 | ⬜ | Móvil (360 px) no verificado para este panel (las tablas reutilizan los estilos de Origen y Transición, ya verificados) |

## Desviaciones
- El origen del rebote usa el evento que cerró la oportunidad anterior, no `previous_action`.
- Coste del rebote ofensivo: aproximación documentada (D-4).
- Diferencia de 2 puntos en 3 equipos-partido frente al box oficial (ver CA-1).

## Docs pendientes
`docs/api.md`: tabla `team_second_chance` y tipo `chance` cuando existan.

## Entidad `chance` y tabla `team_second_chance` (2026-11-16)
- T-B9 ✅ `GET /api/metrics/chance?id=<equipo>:primera|segunda&side=`: conjunto estándar completo, ficha con población de equipos en la misma oportunidad y lado.
- T-B11 ✅ `GET /api/table/team_second_chance?team=&side=&section=desenlaces|origen|jugadores`; en la pestaña Posesión como "Tabla completa" con selector de sección, exportable.
- Evidencia: `a04_sim.py` 18/18 (oportunidades y puntos = `GET /api/second-chance`, Σ filas = segundas oportunidades en las tres secciones, puntos por desenlace = reporte, primera = posesiones completas) y `tables_browser.py` en Chromium (1280 y 360 px, CSV con cabecera, inglés sin textos sin traducir).
- Desvío: los rebotes se asignan por estructura (el RO que abre la siguiente oportunidad es de la que termina) para que PPP/OER/OR% por oportunidad tengan sentido; sin percentiles por fila ni promedio de competencia en la tabla (las filas son subgrupos sin población propia).
- Pendiente: T-B10, la dimensión de contexto `chance` para filtrar otras vistas (va con el resto de filtros de posesión de T-03).
