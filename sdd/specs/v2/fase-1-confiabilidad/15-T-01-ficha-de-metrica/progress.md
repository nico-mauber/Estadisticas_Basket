# Progress — T-01: Ficha de métrica: valor, ranking y distancias

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)

## Estado de tareas
Grupos A, B, C, D, E completos (T-A1…T-A3, T-B1…T-B6, T-C1…T-C3, T-D1…T-D6, T-E1…T-E8). Grupo G diferido
(T-03, T-04, T-06, dueños de entidad).

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ✅ | Coherencia ficha↔Liga verificada en vivo: VER oer rank 9/12 pct 27 líder ALBATROS idéntico en `/api/metrics/team`, `/api/team/VER` y `/api/league?include=summary` |
| CA-2 (cinco elementos) | ✅ | Card OER de VER: valor, "9.º de 12", líder con nombre+distancia, Ø con signo, chip percentil coloreado |
| CA-3 (inversión) | ✅ | DER (lower): líder = DER más bajo (TROUVILLE), rank 1 al más bajo, dist_avg negativo si peor que Ø, dist_leader ≤ 0 |
| CA-4 (empates) | ✅ | `games` (todos con 2 PJ): rank 1, tied:true, percentil 50 en los 12; empate sintético 1,2,2,4 vía `population.rank` |
| CA-5 (percentil) | ✅ | 5 peores/1 igual/5 mejores = 50; líder único = 100 (mid-rank sin la propia entidad) |
| CA-6 (color) | ✅ (lógica) / ⚠️ (visual) | `percentileColor` 0/50/100 = anclas exactas, 25/75 puntos medios, null/neutral sin color; contraste visual no verificado en navegador |
| CA-7 (muestra baja) | ✅ | LBO/MNE (<min) `in_population:false`, ranking hipotético; agregar/quitar no cambia avg/leader de los demás |
| CA-8 (población insuf./sin universo) | ✅ | `population.min_size=13` → `poblacion_insuficiente`; `competition=all` → `sin_universo`; valor siempre visible |
| CA-9 (selección) | ✅ | `last=N` recalcula población/líder/promedio; ficha rotula la referencia |
| CA-10 (hover/tap) | ⚠️ | `api.ranking` y contenido verificados en vivo; eventos DOM hover/popover/hoja inferior solo revisión de código (sin navegador gráfico) |
| CA-11 (reemplazo) | ✅ | `grep "stat-context\|NOT_PCT\|isPct\|statClass\|9900\|1050"` sin resultados sobrantes; Equipo/Jugador sin "Ø"/"↑" sueltos |
| CA-12 (nulos) | ✅ | Valor nulo (blk_received pre-reproceso / ast_to sin pérdidas): "—" con razón, sin ranking/color, no cuenta en el total |
| CA-13 (ajustado) | ✅ | Quinteto con `net_rating.adj`: rank/percentile sobre `adj.value`; `/api/rankings` ordena por ajustado |
| CA-14 (consistencia) | ✅ | OER de VER: mismo puesto/total/líder/promedio en `/api/metrics/team`, `standard` y `/api/rankings/team/oer` |
| CA-15 (conteos por partido) | ✅ | `pts` base total: `value=149` con `basis:"partido"`, `avg`/`dist_avg` en por partido |
| CA-16 (configuración) | ✅ | `sample.team.min` 2→3→2 cambia el total de `/api/rankings/team/oer` (12→0→12) sin reiniciar (invalidación de caché por `config_version`) |
| CA-17 (UI móvil) | ⚠️ | CSS mobile-first agregado; sin verificación visual a 360px (sin navegador gráfico) |
| CA-18 (Liga) | ✅ (datos) / ⚠️ (visual) | `/api/league?include=summary` trae rank/pct/in_population, leaders, avg, population; atenuado y pie verificados por shape, no visualmente |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `python backend/database.py` 2× sin error (tabla `app_meta` idempotente): ✅
- Endpoints probados (curl + `app.test_client()`, datos reales del seed): ✅
- Consola del navegador sin errores JS: ⚠️ no verificado visualmente; `node --check` sin errores de sintaxis en los 8 JS tocados/creados

## Comparación antes/después — tabla de Liga (R-04)
competition=1, `sample.team.min=2`. ANTES = promedio de tasas por partido; DESPUÉS = cociente de totales (pooled); TO% ahora PER/POS (DA-04).
| Equipo | métrica | ANTES | DESPUÉS |
|---|---|---|---|
| ALB | oer/der/nrtg/to%/pace | 1.1232 / 1.0011 / 0.122 / 0.1296 / 80.43 | 1.1197 / 0.9982 / 0.1215 / 0.1468 / 80.43 |
| TRO | oer/der/nrtg/to%/pace | 1.0555 / 0.8494 / 0.2061 / 0.2233 / 80.13 | 1.057 / 0.8528 / 0.2042 / 0.2439 / 80.13 |
| VER | oer/der/nrtg/to%/pace | 0.9673 / 1.0323 / -0.065 / 0.1419 / 77.34 | 0.966 / 1.0315 / -0.0655 / 0.1686 / 77.34 |
PACE no cambia (fixed). TO% sube notablemente (PER/POS pooled vs promedio de tasas).

## Rendimiento
Población de equipos ~0,016 s en frío, instantánea cacheada. Jugadores/quintetos no medidos formalmente;
caché por `(data_version, config_version)` vía `cache.memo`.

## Desviaciones respecto a docs/ o plan
- `cache.py` no existía (F-11 lo difirió): creado con la firma de arquitectura §3.14 + tabla `app_meta` (modelo
  `AppMeta`). Escrituras de datos (ingesta, borrado, competencias, identidad) suben `data_version`; cambios de
  config suben `config_version`. Bumps tras el commit, no dentro de `persist_game`.
- Enumerador de jugador = 152 (jugadores con ≥ 1 partido jugado), no 187 (fichas brutas): fiel a plan §4.2 y
  RF-3 (un DNP no es partido jugado). El done-check de tasks decía 187 (conteo bruto).
- `all_onoff_bundles`: universo = unión de planteles + on_court de todos los partidos (no plantel por partido),
  necesario para paridad exacta con `onoff_stats` (un jugador no rosterizado en un partido cuenta como OFF).
- `context.population_mode()` no existe; `contexto_no_comparable` no se dispara en fase 1 (contexto = competition
  + last, siempre comparable); el gancho queda vía `comp_id is None` → `sin_universo`.
- Camino legado de C-02 preservado (`_legacy_population`, `aggregate_games`): el bloque `league`/`leagues` de
  `/api/team`/`/api/player` y el radar no cambian. La ficha y `/api/league` usan población pooled con umbrales.
- `min_size` para el copy "menos de N entidades": el payload no lo trae; el frontend lo lee de `/api/settings`
  (`population.min_size`) una vez al arrancar (`catalog.js`).
- No existe `t()`/i18n: copy en español directo. `_colorCell` nunca existió (arquitectura §1.5 D-04); documentado.

## Docs actualizados
- [x] `docs/metrics.md` — "Ficha de métrica (T-01)"
- [x] `docs/api.md` — campos de ficha, `GET /api/rankings/<entity_type>/<metric_key>`, `/api/league` modificado
- [x] `docs/frontend.md` — `core/colors.js`, `components/metric-card.js`, retiro de `Ø`, corrección de `_colorCell`
- [x] `docs/architecture.md` — módulos `population.py` (extendido) y `cache.py`

## Deuda / TODO
- Verificación visual en navegador real pendiente (CA-6 contraste, CA-10 hover/hoja inferior, CA-17 360px,
  CA-18 atenuado/pie): sin entorno gráfico en este ambiente.
- Rendimiento de poblaciones de jugadores/quintetos no medido formalmente.
- `_colorCell` sigue mencionado en la regla 9 de `sdd/README.md` y en `CLAUDE.md` como pendiente de decisión
  humana (no se corrigió fuera de `docs/frontend.md`, ya que son documentos de proceso/instrucción).
