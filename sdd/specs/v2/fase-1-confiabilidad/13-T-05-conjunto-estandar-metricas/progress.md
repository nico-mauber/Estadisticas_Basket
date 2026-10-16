# Progress — T-05: Conjunto estándar de métricas — regla de completitud

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md) · Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md)
> Se cierra con: reproceso de los 13 partidos del seed (T-A6) y comparación antes/después de la conciliación (R-04) registradas aquí.

## Estado de tareas
Grupos A–F completos (T-A1…T-F17). Implementado en 4 tandas: Grupo A (datos/esquema/reproceso), Grupo B
(fórmulas puras en `stats_engine.py`), Grupo C (catálogo, cargadores, rutas), Grupo D+E (frontend).

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ✅ | `set(metrics.keys())` idéntico entre team/player/lineup/onoff/clutch y al catálogo (83 claves, 12 grupos), verificado con datos reales del seed (VER) |
| CA-2 | ✅ | Catálogo 83 claves/12 grupos coincide con los 5 tipos de entidad |
| CA-3 | ✅ | Quintetos y ON/OFF reales del seed muestran eFG%, FG2%, FG3%, FT%, TS%, PPT, uso de triple, FT Rate, AS/PER, TO%, OR%, DR%, tapones/faltas recibidas |
| CA-4 | ✅ | `ast_to` nulo `sin_perdidas` con 0 pérdidas; `fg3_pct` nulo `sin_intentos` con 0 triples intentados mientras `fgm3.value==0` |
| CA-5 | ✅ | `uso_pct`/`uso_2p`/`uso_3p` de quinteto: `value=null, reason="no_aplica"` |
| CA-6 | ✅ | Antes del reproceso, `blk_received`/`fouls_drawn` nulos `no_registrado` |
| CA-7 | ✅ | Tras reproceso (13/13 partidos): Σ jugadores = equipo = eventos pbp, 0 mismatches en 26 equipo-partido |
| CA-8 | ✅ | OER/eFG%/TO% de VER = cociente de totales (pooled), verificado a mano |
| CA-9 | ✅ | TO% equipo = PER/posesiones; Σ USO%×min/(5·40) ∈ [0,97;1,00]; Σ AST jugadores = AST equipo |
| CA-10 | ✅ | ON/OFF: ON+OFF = total del equipo en conteos; segundos ON+OFF = tiempo total de juego |
| CA-11 | ✅ | Jugador sin pbp: der/net_rating/pts_against/pace/sec_per_poss `sin_pbp`; possessions/orb_pos estimados |
| CA-12 | ✅ | DNP excluido de `games` y promedios |
| CA-13 | ✅ | Competencia inexistente → 400 `competencia_inexistente`; selección vacía → 200 `sin_datos` |
| CA-14 | ✅ | `base=partido` escala conteos/volumen; `base=por40`/`por100` → 400 |
| CA-15 (compatibilidad) | ✅ | Diffs legado confirmados vacíos: `/api/lineup`, `/api/onoff`, `/api/clutch` idénticos byte a byte antes/después |
| CA-16 (UI) | ⚠️ | Verificado por curl/código + arranque real del servidor; sin navegador gráfico en el entorno de desarrollo para captura visual a 360px — pendiente de un paso manual (abrir las 5 pantallas en un navegador real) |
| CA-17 (etiquetas) | ✅ | `ui.metric_labels` activa (F-13); `PUT /api/settings` cambia la etiqueta, catálogo la refleja, reset la restituye |
| CA-18 (idempotencia) | ✅ | `upgrade_db()` corrido dos veces sin error ni columnas duplicadas |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: ✅
- Endpoints probados manualmente (curl + `app.test_client()`, datos reales del seed): ✅
- Consola del navegador sin errores JS: ⚠️ no verificado visualmente (sin entorno gráfico); `node --check` sin errores de sintaxis en los 5 archivos JS tocados/creados

## Desviaciones respecto a docs/ o plan
- `apply_base` usa un `try/except ImportError` alrededor de `from metrics_catalog import METRICS` para evitar
  ciclo de imports; funciona correctamente ahora que `metrics_catalog.py` existe (sin cambios adicionales
  necesarios).
- `build_payload` distingue `competencia_inexistente` de `contexto_invalido` inspeccionando el texto del
  mensaje de `context.ContextError` (la excepción no trae un código separado hoy).
- `clutch_bundle.meta["games_excluded"]["sin_pbp"]` queda en 0 (ese conteo vive en `app.py`/`bundles` vía
  comparación de partidos con/sin pbp, no se propagó al bundle; no bloquea ningún CA de esta fase).
- `INGEST_VERSION` subió de 3 (ya estaba en 3 por C-08, no en 2 como asumía el borrador del plan) a 4.
- `database.py` en su bloque `__main__` solo llama `init_db`, no `upgrade_db` (comportamiento preexistente,
  no introducido por T-05); `upgrade_db` se invoca desde `app.py` al arrancar, donde sí corre siempre.

## Comparación antes/después — conciliación (R-04)
Verificado contra los totales reales de VER (2 partidos, seed reprocesado):
| Métrica | Legado | `standard` (T-05) | Motivo |
|---|---|---|---|
| `ppt` (PPT) | `(2·FGM2+3·FGM3)/FGA` = 0,8978 | igual (ya vigente desde C-07) | DA-03, sin cambio adicional |
| `to_pct` equipo | `TOV/plays` | `TOV/posesiones` = 0,1686 | DA-04 |
| `uso_pct` jugador | sobre partido completo | ponderado por minutos en cancha | DA-05 |
| `as_pct` jugador | `AST/FGM` propio | `AST/(TCc_equipo·peso − TCc_jugador)` | DA-06 |
| `der`/`net_rating` jugador | sobre equipo del partido completo | sobre posesiones del rival con el jugador en cancha | DA-34 |

Los endpoints legado (`/api/lineup`, `/api/onoff`, `/api/clutch`, `/api/team`, `/api/player` fuera del bloque
`standard`) no cambiaron: diffs confirmados vacíos.

## Docs actualizados
- [x] `docs/metrics.md` — sección "Conjunto estándar (T-05)"
- [x] `docs/api.md` — `GET /api/metrics-catalog`, `GET /api/metrics/<entity_type>`, bloque `standard`
- [x] `docs/database.md` — `blk_received`/`fouls_drawn` en ambas tablas
- [x] `docs/frontend.md` — `core/catalog.js`, `fmtMetric`, `components/standard-panel.js`, montaje en las 5 pantallas
- [x] `docs/architecture.md` — módulos `metrics_catalog.py` y `bundles.py`

## Deuda / TODO
- Verificación visual manual en navegador real (CA-16, T-F4) pendiente: abrir Equipo, Jugador, Combinación,
  ON/OFF y Cierres de un equipo del seed y confirmar consola sin errores JS, también a 360px.
- `clutch_bundle` no propaga `games_excluded.sin_pbp`; agregar si T-06/T-01 lo necesitan.
- Unificar `aggregate_games` (C-02) y `compute_standard` (T-05) queda como deuda técnica anotada en el plan
  (dos agregaciones pooled separadas); no se resuelve en esta fase.
