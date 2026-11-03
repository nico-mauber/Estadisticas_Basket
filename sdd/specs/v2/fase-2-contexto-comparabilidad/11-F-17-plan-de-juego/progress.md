# Progress — F-17: Plan de juego

> **Estado:** 🔶 Implementado en Equipo (motor de frases, `GET /api/game-plan`, panel con referencias competencia, rival y período anterior). Quedan la presencia en Mi equipo y la referencia "rival del próximo partido" (→ F-12), el bloque del informe (→ F-03) y la integración con la pestaña Resumen de X-01.
> **Fecha:** 2026-11-03

## Estado de tareas
- [x] T-A1 · claves `gameplan.items_min`, `gameplan.items_max` y `gameplan.min_z` activas en `config.py` (consumidor "F-17, F-03")
- [x] T-A2 · `backend/phrases/rules.json` (15 métricas del plan, familias `tiro` y `circulacion`)
- [x] T-A3 · `backend/phrases/es.json` (30 plantillas, sin dígitos)
- [x] T-B1 · `backend/phrases.py`: `load_rules`, `load_templates`, `validate_templates`, `python phrases.py` imprime `OK: 30 plantillas`
- [x] T-B2 · `pick_template`, `format_value` (coma decimal, half-up, delta con signo y "pp"), `render`
- [x] T-B3 · `game_plan` con referencia competencia (candidatos, `z`, `_select` con familias y relleno `minor`, ficha de T-01)
- [x] T-B4 · referencia rival (`sample.ref`, `sample_warning` si el rival tiene muestra baja)
- [x] T-B5 · referencia período anterior (valor agregado de los partidos anteriores a los últimos N)
- [x] T-B6 · modo `matchup` para F-03
- [x] T-B7 · payload, eco de contexto, `rule`, `items` y caché `gplan` (la versión de configuración invalida)
- [x] T-B8 · ruta `GET /api/game-plan`
- [x] T-C1 · `api.gamePlan`
- [x] T-D1 · `renderPlanItem` y `fmtPlanDelta`
- [x] T-D2 · `renderGamePlan` (controles, encabezado, columnas, estados, plegado)
- [x] T-D3 · montaje en Equipo (`#team-gameplan`)
- [x] T-D4 · CSS
- [x] T-E1 · errores, sin conexión y motivos sin ítems
- [x] T-E2 · `sw.js` v51 con `game-plan.js`
- [x] T-F1 … T-F19 · verificación con `f17_sim.py` (61 chequeos) y `f17_browser.py` (58 chequeos, 1280 y 360 px)
- [ ] T-G1 … T-G3 · incrementos diferidos (→ F-12, → F-03)

## Estado de CA
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | `own`, `ref`, `percentile`, `rank` y `delta` de cada ítem son iguales a `value`, `avg`, `percentile`, `rank` y `dist_avg` de la ficha en `/api/metrics/team`; en pantalla el valor propio del primer ítem figura en la tabla de Equipo |
| CA-2 | ✅ | hasta 5 ítems por columna, orden por `|z|` decreciente, una métrica por familia |
| CA-3 | ✅ | en "menos es mejor" `delta = −delta_raw`; la ventaja tiene `delta_raw < 0` |
| CA-4 | ✅ | `ref` = valor del rival en su ficha; rival igual al equipo → 400; rival inexistente → 404 |
| CA-5 | ✅ | `ref` = valor de los partidos anteriores a los últimos N, contrastado con el filtro por rival sobre el único partido anterior; sin `last` → 400; sin partidos suficientes → `periodo_anterior_insuficiente` |
| CA-6 | ✅ | con el mínimo por defecto: "Muestra insuficiente…" y badge BAJA; bajando `sample.team.min` aparecen los ítems |
| CA-7 | ✅ | el plegado queda en `panel.collapsed` / `equipo.game_plan` y sobrevive a la recarga |
| CA-8 | ✅ | en los 14 equipos del seed, texto = plantilla, ventaja con `delta > 0`, riesgo con `delta < 0`, sin dígitos |
| CA-9 | ✅ | con `ast_to` nulo forzado en la población, la métrica no aparece (14 de 15 puntuadas) |
| CA-10 | ✅ | `on=<jugador>` → `contexto_no_comparable`; `competition=all` → `sin_universo` |
| CA-11 | ✅ | con `gameplan.items_max = 3` y `gameplan.min_z = 1` cambia la respuesta sin reiniciar; `items_min > items_max` se rechaza |
| CA-12 | ✅ | a 360 px las columnas se apilan, sin scroll horizontal y la frase no se trunca |
| CA-13 | ✅ | `rival_proximo` → 400 `referencia_no_disponible`; `xyz` → 400 `parametro_invalido`; `ZZZ` → 404 |
| CA-14 | ✅ | `phrases.game_plan(..., mode="matchup")` con muestra baja devuelve ítems con `sample_warning`; en `perfil` devuelve `muestra_baja` |

## Desviaciones
- **Sin X-01:** la app sigue siendo un `app.js` y no tiene `views/equipo.js` ni la pestaña Resumen. El panel se monta en `#team-gameplan`, arriba de las estadísticas del equipo. Cuando X-01 llegue, el panel pasa a Resumen sin cambios.
- **Plegado:** usa `core/prefs.js` (F-13) con el ámbito `panel.collapsed`, no `components/collapsible.js` (no existe).
- **`metrics_catalog.load_bundles`:** no se agregó. El período anterior usa `bundles.team_game_bundles` y `sum_bundles`, que ya existen.
- **Modo `matchup`:** usa la población de la competencia sin mínimos de muestra (como Preparar), para que el equipo con muestra baja tenga con qué compararse.
- **Orden de los motivos:** `muestra_baja` se evalúa antes que `poblacion_insuficiente`, para que un equipo con pocos partidos vea su propio motivo.
- **Filtros de evento:** el período anterior no se calcula con cuarto o marcador activos (`contexto_no_comparable`). `quarter` y `score` sí se aplican a la población, con el mismo costo que `/api/metrics/team`.
- **`games_excluded` del eco de contexto:** vacío (la cabecera de F-19 ya informa los partidos excluidos).
- **Copy sin `t()`:** el texto del panel va en constantes al inicio de `game-plan.js` para que F-21 lo extraiga.
- **Convive con "Análisis del equipo":** el panel anterior (`team-insights`) sigue en Equipo, con 19 métricas y percentiles fijos. Falta decidir si el plan de juego lo reemplaza.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/frontend.md` · ✅ `docs/architecture.md` · ✅ `docs/metrics.md`
