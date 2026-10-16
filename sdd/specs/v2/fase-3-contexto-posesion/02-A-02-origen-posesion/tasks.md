# Tasks — A-02: Origen de la posesión

> **ID:** A-02 · **Prioridad:** P1 · **Fase y orden:** 3·02
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: enriquecedor y módulo de agregación
- [ ] T-A1 · Crear `backend/origin.py` con `enrich_origin(possessions, events, game)` (precedencia `tiempo_muerto` >
  `robo` > `rebote_defensivo` > `tiro_libre_rival` > `canasta_rival` > `perdida_rival` > `saque_banda`; inicio de
  período/salto inicial → `saque_banda`) · `backend/origin.py` · cubre RF-1, RF-2, RF-3
- [ ] T-A2 · Registrar `enrich_origin` con `possessions.register_enricher("origin", enrich_origin)` al importar el módulo
  · `backend/origin.py` · cubre RF-1
- [ ] T-A3 [P] · Implementar fallback de robo sin `previous_action` (vecindad de `action_number`, D-1 del spec) ·
  `backend/origin.py` · cubre RF-2 (CA-2)
- [ ] T-A4 · Calcular `oreb_info` (fila informativa de rebote ofensivo, fuera de la suma) contando `Chance.n >= 2` de
  A-01 directamente (sin depender de A-04) · `backend/origin.py` · cubre RF-4 (CA-5)
- [ ] T-A5 [P] · `stats_engine.origin_rates(counts)` (PPP, eFG%, TO%, FT Rate, duración media, fórmulas del glosario v2
  §6) · `backend/stats_engine.py` · cubre RF-5
- [ ] T-A6 · `origin_report(entity_type, entity_id, comp_id, ctx, *, side="ataque")` (agrupa posesiones completas por
  origen, aplica `origin_rates`, reparto de finalización T2/T3/TL/Pérdida con `fin_periodo` aparte, badge T-02, fichas
  T-01 si están disponibles) · `backend/origin.py` · cubre RF-5, RF-6, RF-11, RF-12
- [ ] T-A7 · `side="defensa"` sobre `team_possessions(..., side="defensa")` · `backend/origin.py` · cubre RF-7 (CA-7)
- [ ] T-A8 · Conciliación de suma (`reconcile.sum_origins == reconcile.total_possessions`) · `backend/origin.py` ·
  cubre RF-8 (CA-1)
- [ ] T-A9 · `player_origin(player_id, comp_id, ctx)` (orígenes de posesiones que finaliza el jugador vía
  `finisher_id`) · `backend/origin.py` · cubre RF-14
- [ ] T-A10 · Manejo de nulos: sin posesiones de un origen → `null` con razón `sin_intentos`; partidos sin pbp →
  `games_excluded.sin_pbp` · `backend/origin.py` · cubre RF-15 (CA-6)

### Grupo B — Backend: registro T-05/T-03/T-06
- [ ] T-B1 [P] · `origin_bundles(req)` (loader del tipo de entidad `origin`) + `metrics_catalog.register_entity("origin",
  origin_bundles)` · `backend/origin.py`, `backend/metrics_catalog.py` · cubre RF-10 (CA-10)
- [ ] T-B2 [P] · `context.register_dimension("origin", level="posesion", values=(8 claves), parser=_parse_origin)` ·
  `backend/origin.py`, `backend/context.py` · cubre RF-10, RF-12 (CA-9)
- [ ] T-B3 [P] · `table_rows(req)` + `tables.register_table("team_origins", entity_type="origin", …)` ·
  `backend/origin.py`, `backend/tables.py` · cubre RF-13

### Grupo C — Backend: ruta
- [ ] T-C1 · `GET /api/origins` (fina: `parse_context`, valida `team` xor `player`, `side`, llama a `origin_report` o
  `player_origin`) · `backend/app.py` · cubre RF-5…RF-9, RF-14
- [ ] T-C2 [P] · Errores 400/404 según plan §9 · `backend/app.py` · cubre manejo de errores

### Grupo D — Frontend
- [ ] T-D1 · `api.origins(params)` · `frontend/js/api.js`
- [ ] T-D2 · `components/origin-panel.js` con `renderOriginPanel(el, payload, {mode})` (tabla T-06 + fila informativa +
  selector Ataque/Defensa + leyenda de conciliación) · `frontend/js/components/origin-panel.js`
- [ ] T-D3 · Montar el panel en la pestaña `posesion` de S3 Equipo y S4 Jugador (habilitar la pestaña si ningún
  requisito anterior lo hizo) · `frontend/js/views/equipo.js`, `frontend/js/views/jugador.js` · cubre RF-6, RF-14
- [ ] T-D4 [P] · Estados loading/vacío/error/offline según spec §6 · `frontend/js/components/origin-panel.js`
- [ ] T-D5 [P] · Estilos mobile (columna Origen fija, barra apilada de finalización a ancho completo) ·
  `frontend/css/style.css`
- [ ] T-D6 · Bump `sw.js` (`STATIC` + `CACHE`) si X-01 no pasó a runtime caching aún · `frontend/sw.js`

### Grupo E — Documentación (cierre)
- [ ] T-E1 · Actualizar `docs/api.md` (`GET /api/origins`, tabla `team_origins`, tipo `origin`, filtro `origin`)
- [ ] T-E2 · Actualizar `docs/metrics.md` (8 orígenes, precedencia, fórmulas, fallback de robo, `saque_banda` como
  default conservador)
- [ ] T-E3 · Actualizar `docs/frontend.md` (bloque "Origen de la posesión", copy nuevo)
- [ ] T-E4 · Actualizar `docs/architecture.md` (módulo `origin.py`)

### Grupo F — Verificación de feature (manual, Constitución 8)
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · No hay cambio de esquema: sin verificación de `upgrade_db()` adicional
- [ ] T-F3 · `GET /api/origins?team=<code>&competition=<id>` contra los 13 partidos del seed reprocesados: response
  shape verificado, 7 filas de origen + fila informativa
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo → Posesión → Origen (ambos lados)
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅/❌
- [ ] T-F6 · CA-1: `curl "http://localhost:5000/api/origins?team=<code>&competition=<id>"` y verificar
  `reconcile.sum_origins == reconcile.total_possessions` para al menos 3 equipos
- [ ] T-F7 · CA-2: inspeccionar con `GET /api/game/<game_id>/possessions` una posesión que empieza con robo vinculado y
  confirmar `origin == "robo"` en `GET /api/origins` (cruzar por `poss_id`/evento)
- [ ] T-F8 · CA-3: identificar en el pbp un tiempo muerto pedido tras canasta rival y confirmar que la posesión
  siguiente clasifica como `tiempo_muerto`, no `canasta_rival`
- [ ] T-F9 · CA-4: confirmar que la primera posesión del primer cuarto y la primera de cada cuarto siguiente (y de la
  prórroga en los 2 partidos con OT del seed) clasifican como `saque_banda`
- [ ] T-F10 · CA-5: confirmar que una posesión que sigue a un rebote ofensivo propio no aparece como noveno origen ni
  en `reconcile.sum_origins`, solo en `oreb_info.possessions`
- [ ] T-F11 · CA-6: un equipo/selección sin posesiones de `tiempo_muerto` (o `tiro_libre_rival`) devuelve
  `metrics.*.value == null` con `reason: "sin_intentos"` y `possessions: 0`
- [ ] T-F12 · CA-7: `side=defensa` de A vs B y comparar con `side=defensa` de B vs A en los mismos partidos (PPP
  concedido de A por origen X == PPP concedido de B por origen X calculado sobre A) — control cruzado
- [ ] T-F13 · CA-8: forzar una selección con menos posesiones que `sample.split.min` en un origen y confirmar badge
  "baja" en gris
- [ ] T-F14 · CA-9: `GET /api/metrics/team?id=<code>&origin=robo&competition=<id>` — `context.ignored` vacío de ese
  parámetro y `possessions_counted` coincide con la cantidad de posesiones de origen `robo`
- [ ] T-F15 · CA-10: `GET /api/metrics/origin?id=<code>:robo` — todas las claves del conjunto estándar presentes (no
  aplicables con `reason: "no_aplica"`)
- [ ] T-F16 · CA-11: partido con prórroga del seed — primera posesión de la prórroga clasifica `saque_banda`
- [ ] T-F17 · CA-12: recorrer Equipo → Posesión → Origen en viewport < 768 px, sin scroll horizontal ni errores de
  consola

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (CA del cliente) | T-A6, T-A8, T-F6 |
| CA-2 | T-A1, T-A3, T-F7 |
| CA-3 | T-A1, T-F8 |
| CA-4 | T-A1, T-F9 |
| CA-5 | T-A4, T-F10 |
| CA-6 | T-A10, T-F11 |
| CA-7 | T-A7, T-F12 |
| CA-8 | T-A6 (badge vía `sample.sample_level`), T-F13 |
| CA-9 | T-B2, T-F14 |
| CA-10 | T-B1, T-F15 |
| CA-11 | T-A1 (posesión alterna → `saque_banda`), T-F16 |
| CA-12 | T-D5, T-F17 |

## Dependencias externas
- Competencia del seed (13 partidos) reprocesada con ingesta v2 (F-11): necesaria para `previous_action`/`qualifiers`
  que resuelven robo→pérdida con precisión (sin ellos, el fallback de vecindad de `action_number` se usa siempre y las
  CA-2/CA-7 pueden requerir revisión manual caso por caso).
- Módulo `possessions.py` de A-01 disponible con `register_enricher` operativo (misma fase, orden anterior).
- `sample.split.min`/`.high`/`.rel_pct` en `CONFIG_SPEC` (F-13, ya cerrado en fase 1).
- Pestaña `posesion` de X-01 registrada (X-01 cerrado en fase 2, previo a esta fase).
