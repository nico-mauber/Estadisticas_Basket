# Spec — Feature 08: nulo vs cero en métricas de tasa (fix de correctitud transversal)

> **Bug reportado por el cliente**, no cubierto por ningún spec previo: *"si en un partido no hay tiros libres no suma 0, suma nulo. Creo que pasa en todos los cálculos."* Es un fix de correctitud que afecta a la app EN PRODUCCIÓN (vistas Equipo/Jugador/Liga) y a las features nuevas que promedian métricas (03/04/05/06). Alta prioridad: idealmente va antes que el resto.

## 1. Objetivo
Que las métricas de **tasa** (porcentajes, ratios, puntos por posesión) valgan **null** cuando su denominador es 0 en un partido —no 0.0— y que los promedios entre partidos **excluyan** esos nulos en lugar de contarlos como cero, para que un partido sin intentos no distorsione el promedio del jugador/equipo.

## 2. Fuentes (trazabilidad)
- Reporte del cliente (esta feature): un partido sin tiros libres debe dar FT% nulo, no 0; sospecha que ocurre en todos los cálculos de tasa. Confirmado por lectura de código.
- `backend/stats_engine.py` `_safe_div(num, den, default=0.0)` (línea 7) — devuelve `0.0` cuando `den == 0`. Origen del bug: toda tasa con denominador 0 termina en 0.0.
- `backend/app.py` `team_stats` `_avg()` (líneas 418-420) y `player_stats` `_avg()` (líneas 559-561) — promedian `g[key]` sobre el game_log **incluyendo** esos 0.0.
- `backend/stats_engine.py` `league_averages()` (línea 287) — **ya** saltea `None` (`s[k] is not None`); si `_safe_div` devolviera `None`, ya lo excluiría.
- `frontend/js/app.js` `_computeAvg()` (línea 62) — **ya** saltea `null`/`NaN` (`filter(v => v != null && !isNaN(v))`).
- `frontend/js/app.js` `PCT`/`DEC2` (líneas 14-15) y `statClass` (línea 18) — **ya** renderizan `null` como `"—"` y color neutral.
- `docs/metrics.md` — todas las métricas de tasa (eFG%, TS%, OER, DER, FG%/FT%, USO%, OR%/DR%/TRB%, TO%, AST%, ratios, pesos) tienen un denominador que puede ser 0 en un partido.
- Constitución regla 4 (métricas on-the-fly, no persistidas) — implica que el fix NO requiere migración de datos: al recalcular en cada request, el cambio aplica retroactivamente a todo el histórico.

## 3. Historias de usuario
- US-1: Como analista, quiero que el FT% (y toda métrica de tasa) de un jugador sea el promedio solo de los partidos donde SÍ tuvo intentos, para que un partido sin tiros libres no le baje falsamente el porcentaje.
- US-2: Como analista, quiero que una métrica sin ningún dato válido se muestre como "—" (sin dato) y no como 0, para no confundir "no intentó" con "falló todo".

## 4. Requisitos funcionales
- RF-1: Las métricas de **tasa** DEBEN valer `null` (no 0) cuando su denominador es 0 en ese partido. Alcance: `efg_pct`, `ts_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `ft_rate`, `ft_rate_report`, `pps`, `ppp`, `oer`, `der`, `or_pct`, `dr_pct`, `trb_pct`, `to_pct`, `to_ratio`, `as_pct`, `ast_ratio`, `ast_to`, `uso_pct`, `fg2_uso`, `fg3_uso`, `peso_1p`, `peso_2p`, `peso_3p`, `opp_efg_pct`, `opp_ts_pct`, `opp_to_pct`, `opp_ft_rate`, `def_to_ratio`. · (US-1, `stats_engine.py` `_safe_div`) · Mecanismo sugerido (lo fija el Paso 2): que las tasas usen `default=None` en `_safe_div` en vez de `0.0`.
- RF-2: Las stats de **conteo** (no-tasa) DEBEN seguir valiendo su número real, incluido 0. Alcance: `pts`, `fgm/fga`, `fgm2/fga2`, `fgm3/fga3`, `ftm/fta`, `orb`, `drb`, `trb`, `ast`, `tov`, `stl`, `blk`, `pf`, `possessions`, `plays`, `stocks`, `def_playmaking`, `physical_impact`, y los desgloses (`paint_pts`, etc.). · (US-2) · Un jugador que tiró 0 tiros libres tiene `fta = 0` (real), pero `ft_pct = null`.
- RF-3: El promedio entre partidos DEBE **excluir** los valores `null` (promediar solo los partidos con dato válido); si no hay ningún dato válido para una métrica, el promedio es `null`. · (US-1) · `app.py` `_avg()` (team y player) debe saltear `None` como ya lo hace `league_averages()` y el frontend `_computeAvg()`.
- RF-4: Las métricas **derivadas** de tasas nulas DEBEN tolerar el null: `net_rating = oer − der` es `null` si `oer` o `der` son `null` (no `0 − 0`). · (US-2)
- RF-5: El frontend DEBE renderizar `null` como `"—"` con color neutral (comportamiento ya existente de `PCT`/`DEC2`/`statClass`); esta feature verifica que no se rompa al recibir más nulos que antes. · (US-2)
- RF-6: Las features nuevas que calculan o promedian tasas (03 lineups, 04 on/off, 05 clutch, 06 buscador) DEBEN adoptar la misma semántica null (tasa con denominador 0 → null; promedios/filtros excluyen null). · (US-1, coherencia con specs 03-06)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema — métricas on-the-fly (Constitución 4). Sin migración: aplica a todo el histórico al recalcular. | No |
| `GET /api/team/<code>`, `GET /api/player/<code>/<name>`, `GET /api/league` | endpoints existentes | **Cambio de contrato:** campos de tasa que antes devolvían `0`/`0.0` ahora pueden devolver `null`. `game_log[].{oer,der,efg_pct,...}` y `averages.{...}` incluyen `null`. Los conteos no cambian. | Cambio de contrato — se documenta en `docs/api.md` al cerrar |

> Contrato: `null` significa "sin dato / sin intentos"; `0` significa "intentó y no convirtió / valor real cero". Antes ambos se veían como `0` (bug).

## 6. Estados de UI
No agrega vista. Afecta el render de las vistas existentes (Equipo/Jugador/Liga/Comparar) y de las nuevas.
| Componente | Antes (bug) | Después (fix) |
|---|---|---|
| `statBox` / celdas de tasa | mostraba `0.0%`/`0.00` para partido sin intentos | muestra `"—"` (vía `PCT`/`DEC2`) y color neutral (vía `statClass`) |
| Promedios en cards y game log | promedio incluía los 0 espurios | promedio solo sobre partidos con dato |
| Radar / evolución (`charts.js`) | punto en 0 | debe saltear/omitir el null (verificar en Paso 4 que no dibuje 0 falso) |

Copy: `"—"` ya es el placeholder existente para "sin dato". Sin copy nuevo.

## 7. Criterios de aceptación
- CA-1: Given un jugador con un partido de 0 FTA y otro de 4/6 FT, When se consulta `GET /api/player/...`, Then el `ft_pct` del partido sin FTA es `null` y el `averages.ft_pct` = 0.6667 (solo el partido con intentos), no `0.3333` (promedio con el 0 espurio).
- CA-2: Given ese mismo jugador, When se ve la vista Jugador, Then la fila del partido sin FTA muestra `"—"` en FT% (no `0.0%`) y la card de FT% muestra el promedio correcto.
- CA-3: Given un jugador que nunca intentó triples en ningún partido, When se consulta, Then `averages.fg3_pct` es `null` y se renderiza `"—"` (no `0.0%`).
- CA-4: Given un partido donde un equipo tuvo 0 posesiones de un tipo que anula un denominador (caso borde), When se calcula, Then la tasa afectada es `null` y `net_rating` no explota (no `NaN`, no `TypeError`).
- CA-5: Given los conteos crudos (pts, fta, ast, ...), When un jugador tiene 0 en un partido, Then ese 0 SÍ cuenta en su promedio de conteo (no se excluye) — solo las tasas se anulan.
- CA-6: Given la consola del navegador al recorrer Equipo/Jugador/Liga tras el fix, When hay métricas nulas, Then no hay errores JS (nulls manejados por los helpers existentes).

## 8. Fuera de alcance
- **Persistir/migrar datos históricos** — innecesario: las métricas se calculan on-the-fly en cada request (Constitución 4), así que el fix aplica retroactivamente sin migración.
- **Redefinir qué métricas son "tasa" vs "conteo"** más allá de la lista de RF-1/RF-2 — la clasificación de esta feature es la de `stats_engine.py` actual.
- **Umbral mínimo de intentos para mostrar una tasa** (ej. exigir ≥5 FTA para mostrar FT%) — es un refinamiento estadístico distinto; esta feature solo separa null de 0.
- **Cambiar cómo los gráficos interpolan nulos** más allá de no dibujar un 0 falso — pulido de `charts.js` diferido si aparece.

## 9. Ambigüedades
- [RESUELTA] ¿Qué es "tasa" vs "conteo"? → **Decisión:** tasa = toda métrica con denominador (porcentajes, ratios, puntos por posesión/play/tiro) → null si denominador 0. Conteo = sumas/valores absolutos → 0 real se conserva. Lista explícita en RF-1/RF-2.
- [RESUELTA] ¿`_safe_div` global a `None` rompe aritmética downstream? → **Decisión:** el Paso 2 debe auditar cada uso de tasas en operaciones (ej. `net_rating`, `peso_*`, radar) y hacerlas null-safe (RF-4). No se cambia el default a `None` a ciegas; se aplica a las tasas y se blinda lo derivado. Justificación: evitar `TypeError`/`NaN`.
- [RESUELTA] ¿Impacto en filtros del Buscador (Feature 06)? → **Decisión:** un jugador con métrica `null` NO matchea filtros de rango (`>`, `<`) sobre esa métrica (null ≠ 0); se documenta como cruce con Feature 06 §9.
