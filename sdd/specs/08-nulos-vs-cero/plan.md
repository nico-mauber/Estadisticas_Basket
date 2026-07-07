# Plan — Feature 08: nulo vs cero en métricas de tasa

## 1. Enfoque
Cambiar el `default` de `_safe_div` de `0.0` a `None` en `stats_engine.py`: así toda tasa con denominador 0 pasa a valer `null` automáticamente (todas las tasas se calculan con `_safe_div`). Luego blindar los pocos consumos que hacen aritmética sobre una tasa (`net_rating`) y los dos `else 0.0` de `as_pct`. En `app.py`, los dos helpers `_avg()` (team y player) deben saltear `None` (como ya hace `league_averages()`). En el frontend, `_computeAvg()` ya saltea `null` pero devuelve `0` cuando no hay dato → devolver `null`, y hacer `net_rating` null-safe. Los sentinels intencionales (`ast_to`/`def_to_ratio` = 99.0 cuando no hay pérdidas) se conservan: no son el bug reportado (el equipo/jugador SÍ jugó, solo no perdió la pelota).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `_safe_div` default `None`; `net_rating` null-safe; `as_pct` (team+player) `else None`; verificar sentinels guardados | RF-1, RF-2, RF-4 |
| `backend/app.py` | route | `_avg()` de `team_stats` y `player_stats` saltean `None`; devuelven `None` si no hay dato válido | RF-3 |
| `frontend/js/app.js` | js-view | `_computeAvg()` devuelve `null` (no `0`) para métrica sin dato válido; `net_rating` null-safe | RF-3, RF-4, RF-5 |
| `docs/api.md` | doc | documentar el cambio de contrato (tasas pueden ser `null`) | — (cierre) |
| `docs/metrics.md` | doc | nota: tasas con denominador 0 = `null`, excluidas del promedio | — (cierre) |

## 3. Backend — rutas y modelos
Sin cambio de rutas ni de esquema. `GET /api/team/<code>`, `GET /api/player/<code>/<name>`, `GET /api/league`: **cambio de contrato** — campos de tasa en `averages` y `game_log[]` pueden devolver `null` donde antes devolvían `0`. Conteos sin cambio.

## 4. Backend — lógica
| Función | Módulo | Cambio | RF |
|---|---|---|---|
| `_safe_div(num, den, default=None)` | `stats_engine.py` | default `0.0` → `None`. Firma: `round(num/den, 4) if den else default`. Toda tasa con denominador 0 → `None`. | RF-1 |
| `calc_team_stats` `net` | `stats_engine.py` | `net = round(oer - der, 4) if (oer is not None and der is not None) else None` | RF-4 |
| `calc_team_stats` `as_pct` | `stats_engine.py` | `_safe_div(t["ast"], fgm) if fgm else None` (era `else 0.0`) | RF-1 |
| `calc_player_stats` `as_pct` | `stats_engine.py` | `_safe_div(p["ast"], fgm) if fgm else None` | RF-1 |
| `ast_to`, `def_to_ratio` (team+player) | `stats_engine.py` | **sin cambio** — sentinel 99.0 cuando `tov==0` es dato legítimo (jugó sin perder), no el bug. Al llamar `_safe_div` lo hacen con `tov != 0` (guardado), así que nunca reciben `None` de ahí. | (decisión §10) |
| `_avg(key)` en `team_stats` | `app.py` | `vals = [g[key] for g in game_stats if key in g and g[key] is not None]`; `return round(sum/len, 4) if vals else None` | RF-3 |
| `_avg(key)` en `player_stats` | `app.py` | idem (saltea `None`, devuelve `None` si vacío) | RF-3 |

`league_averages()` — **sin cambio**: ya filtra `s[k] is not None` y ya cae a `{avg:0,best:0}` si no hay vals (aceptable para contexto de liga; no rompe).

## 5. Frontend — capa API (api.js)
Sin cambios — `api.js` es passthrough; el `null` llega solo.

## 6. Frontend — UI (app.js / charts.js)
- `_computeAvg()`: ya hace `filter(v => v != null && !isNaN(v))`. Cambiar la línea de resultado: `result[k] = vals.length ? round(...) : null` (era `: 0`). Y `net_rating`: `result.net_rating = (result.oer != null && result.der != null) ? round(result.oer - result.der, 4) : null` (era `(result.oer||0) - (result.der||0)`).
- `statBox`/`PCT`/`DEC2`/`statClass` — **sin cambio**: ya muestran `"—"` y color neutral ante `null`.
- `charts.js` (`drawRadar`, `drawEvolution`, `drawPlayerEvolution`): verificar en Paso 4 que un `null` en los datos no dibuje un 0 falso ni tire error (Chart.js omite puntos `null`; si algún dataset mapea con `|| 0`, dejarlo documentado como deuda si arrastra el 0). Sin cambio salvo que la verificación lo exija.

## 7. Navegación
Sin cambios — no agrega vista ni hash.

## 8. Contratos de datos
`null` = "sin dato / sin intentos" (denominador 0). `0` = "valor real cero" (intentó y no convirtió, o conteo cero). Antes ambos colapsaban a `0`.

## 9. Manejo de errores y offline (sw.js)
Sin cambios — no agrega asset estático; no cambia versión de `CACHE`.

## 10. Riesgos / decisiones
- **Decisión:** cambiar `_safe_div` default a `None` global (no por-call). Auditado: el único consumo aritmético de una tasa es `net_rating` (blindado); el resto de tasas son terminales en el dict de retorno. Los conteos crudos no usan `_safe_div`, así que RF-2 (conteos conservan su 0) se cumple sin tocar nada.
- **Decisión:** conservar sentinels `ast_to`/`def_to_ratio` = 99.0 cuando `tov==0`. Justificación: representan "jugó y no perdió la pelota" (dato real excelente), distinto de "no intentó" (el bug). Cambiarlos a `null` sería una regresión de significado. Registrado; si el cliente prefiere `null` también ahí, es un ajuste posterior de 1 línea.
- **Riesgo:** algún dataset de `charts.js` podría mapear valores con `|| 0` y volver a meter el 0 falso en un gráfico. Mitigación: verificación en Paso 4 recorriendo radar/evolución; si aparece, se corrige o se documenta como deuda en `progress.md`.
- **Riesgo bajo:** consumidores externos del JSON que asumían `0`. No hay: el único consumidor es el propio frontend.
