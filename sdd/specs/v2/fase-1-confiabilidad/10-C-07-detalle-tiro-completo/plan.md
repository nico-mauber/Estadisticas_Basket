# Plan — C-07: Detalle de tiro completo en equipo y jugador

> **ID:** C-07 · **Prioridad:** P1 · **Fase y orden:** 1·10 (se propone ejecutarlo después de C-02, ver §10 D-1)
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)) · C-02 ([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)) · **Habilita:** T-05, C-03
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 C-07 · Arquitectura §2.1, §2.2, §3.5, §3.8, §7.4
> **Estimación:** M · 4–7 h

## 1. Enfoque
Delta sobre la Feature 16 de `dev` (integrada por el Grupo 0 de C-11). Tres movimientos:
1. **Fórmula** — `stats_engine` agrega la clave `ppt` (glosario, DA-03) a `calc_team_stats` y `calc_player_stats` y una
   función de agregación pooled de la familia de tiro sobre totales (`season_shooting`), que la agregación única de
   temporada creada por C-02 (`stats_engine.aggregate_games`) invoca. `pps` queda como legado.
2. **Selección** — como C-02 ya hace que `/api/team` y `/api/player` reciban `competition`/`last` y agreguen en el
   backend, `totals` y las tasas pooled salen de la misma selección que el resto de la pantalla; el frontend deja de
   recalcular (no se toca `_computeAvg`, que C-02 elimina).
3. **UI** — `_shotDetailGrid` se reescribe en un componente pequeño con filas T2/T3/TL "por partido · total" y los cuatro
   PPT leyendo `ppt`; todas las etiquetas "PPT" de la app pasan a `ppt` (cards, Buscador).
Sin esquema, sin endpoints nuevos, sin dependencias.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `calc_team_stats`/`calc_player_stats`: clave `ppt` por partido; `season_shooting(totals)` pooled; `aggregate_games` (de C-02) llama a `season_shooting` y amplía `totals`; `league_averages`: `ppt` en `keys` | RF-2, RF-3, RF-4, RF-5, RF-9, RF-10 |
| `backend/app.py` | route | `team_stats`, `player_stats`: incluir `ppt` en las claves promediadas y en `null_reasons` (sin lógica nueva: delegan en `aggregate_games`); `search_players`: `ppt` en `metric_keys` | RF-1, RF-6, RF-7, RF-8 |
| `backend/population.py` (de C-02) | module | Sin cambio de código: las poblaciones de `team`/`player` toman `ppt` del mismo `aggregate_games` → `league.ppt` | RF-9 |
| `frontend/js/components/shot-detail.js` | js-component **NUEVO** (PROPUESTA, ver §10 D-4) | `renderShotDetail(av, totals, games, league, reasons) -> string`: tabla T2/T3/TL y grilla de 4 PPT | RF-1, RF-2, RF-3, RF-5 |
| `frontend/js/app.js` | js-view | `_renderTeamContent`/`_renderPlayerContent`: reemplazar `_shotDetailGrid` por `renderShotDetail`; cards Eficiencia/Producción: `PPT` → `av.ppt` con `leagueKey "ppt"`; tabla del Buscador: columna PPT → `ppt`; eliminar `_shotDetailGrid` | RF-1, RF-7 |
| `frontend/css/style.css` | css | Sección `/* ── shot-detail (C-07) ── */`: `.shot-detail-table` (3 filas, columnas fijas, mobile 360 px) | RF-1 |
| `frontend/sw.js` | sw | Agregar `/js/components/shot-detail.js` a `STATIC` y subir `CACHE` al siguiente entero (número asignado al integrar) | RF-1 |
| `docs/metrics.md` | doc (cierre) | PPT = `(2·2PM + 3·3PM)/FGA` (glosario); `pps` = PTS/FGA legado; tasas de la sección Tiro pooled | RF-2, RF-4, RF-8 |
| `docs/api.md` | doc (cierre) | `averages.ppt`, `game_log[].ppt`, `totals` sobre la selección, `null_reasons`, `search/players.ppt` | RF-1, RF-6, RF-10 |
| `docs/frontend.md` | doc (cierre) | §"Mapa de tiro y card Tiro": `renderShotDetail`, copy nuevo, "PPT" = `ppt` en toda la app | RF-1, RF-7 |

**Matriz RF → archivo:** RF-1 ✔ (app.py, shot-detail.js, app.js, css, sw) · RF-2 ✔ (stats_engine) · RF-3 ✔ (stats_engine,
shot-detail) · RF-4 ✔ (stats_engine `season_shooting`) · RF-5 ✔ (stats_engine + shot-detail) · RF-6 ✔ (app.py vía C-02) ·
RF-7 ✔ (app.js, app.py search) · RF-8 ✔ (stats_engine conserva `pps`) · RF-9 ✔ (league_averages + population) · RF-10 ✔
(calc_* por partido).

## 3. Backend — rutas y modelos
**Sin tablas ni columnas nuevas. Sin `upgrade_db()`. Sin endpoints nuevos.**

| Método + ruta | Parámetros | Cambio de C-07 | Errores |
|---|---|---|---|
| `GET /api/team/<team_code>` | `competition` (id \| `all` \| string legado), `last` (entero > 0) — contrato de C-02 | `averages.ppt` NUEVO; `averages.{ppt, ppt_2, ppt_3, ppt_ft, fg2_pct, fg3_pct, ft_pct, fg2_uso, fg3_uso}` pooled sobre `totals`; `totals` conserva sus 6 claves, ahora sobre la selección (ver §8); `null_reasons` agrega las razones de esas claves; `game_log[].ppt` NUEVO; `league.ppt` NUEVO | 404 "Equipo no encontrado" (existente); 400 de C-02 |
| `GET /api/player/<team_code>/<player_name>` · `GET /api/player/<int:player_id>` | ídem | ídem (jugador: solo partidos jugados) | 404 "Jugador no encontrado" |
| `GET /api/search/players` | `competition` (C-08) | fila + `ppt` (media de la política vigente del buscador, que T-06 migra) | sin cambio |

Ejemplo de response (extracto, `GET /api/team/CNF?competition=3`):
```json
{
  "team_code": "CNF", "team_name": "Nacional", "games": 2,
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
              "applied": {}, "ignored": [], "level": "partido", "population_mode": "apply_all",
              "games_used": 2, "games_total": 2, "games_excluded": {}, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "averages": {
    "fga2": 45.0, "fgm2": 26.0, "fga3": 26.5, "fgm3": 11.5, "fta": 25.0, "ftm": 17.0,
    "fg2_pct": 0.5778, "fg3_pct": 0.434, "ft_pct": 0.68, "fg2_uso": 0.6294, "fg3_uso": 0.3706,
    "ppt": 1.2098, "ppt_2": 1.1556, "ppt_3": 1.3019, "ppt_ft": 0.68,
    "pps": 1.4336
  },
  "totals": {"fga2": 90, "fgm2": 52, "fga3": 53, "fgm3": 23, "fta": 50, "ftm": 34},
  "null_reasons": {},
  "league": {"ppt": {"avg": 1.0912, "best": 1.2098, "reason": null}, "ppt_3": {"avg": 1.01, "best": 1.3019, "reason": null}},
  "game_log": [{"game_id": "2345678", "date": "2026-04-02", "ppt": 1.18, "ppt_2": 1.09, "ppt_3": 1.35, "ppt_ft": 0.7, "pps": 1.41}]
}
```
(`ppt` = (2·52 + 3·23)/(90 + 53) = 173/143 = 1,2098; `ppt_3` = 69/53 = 1,3019.)

Jugador sin triples: `"averages": {"fga3": 0.0, "fgm3": 0.0, "fg3_pct": null, "ppt_3": null, "fg3_uso": 0.0}`,
`"null_reasons": {"fg3_pct": "sin_intentos", "ppt_3": "sin_intentos"}`, `"totals": {"fga3": 0, "fgm3": 0, …}`.

## 4. Backend — lógica
| Función | Módulo | Fórmula / entrada | RF |
|---|---|---|---|
| `calc_team_stats(t, opp)` (mod.) | `stats_engine.py` | agrega `"ppt": _safe_div(2*t["fgm2"] + 3*t["fgm3"], t["fga2"] + t["fga3"])` | RF-2, RF-10 |
| `calc_player_stats(p, team_pos, team=None, game_minutes=40, opp=None)` (mod.) | `stats_engine.py` | agrega `"ppt": _safe_div(2*p["fgm2"] + 3*p["fgm3"], p["fga2"] + p["fga3"])`; `pps` sin cambio | RF-2, RF-8, RF-10 |
| `season_shooting(totals: dict) -> tuple[dict, dict]` **NUEVO** (PROPUESTA, no está en 00-arquitectura-transversal.md) | `stats_engine.py` | ver pseudo-código abajo; devuelve `(valores, razones)` | RF-2, RF-3, RF-4, RF-5 |
| `aggregate_games(per_game, keys)` (creada por C-02; C-07 la extiende) | `stats_engine.py` | después de promediar/sumar, sobrescribe las 9 tasas de tiro con `season_shooting(totals)` (mismo patrón que `ast_to` con `season_ast_to`) y fusiona las razones en `null_reasons` | RF-4, RF-6 |
| `league_averages(all_stats)` (mod.) | `stats_engine.py` | agrega `"ppt"` a `keys` (dirección higher) | RF-9 |
| `search_players` (mod.) | `app.py` | agrega `"ppt"` a `metric_keys` | RF-7 |

**`season_shooting(totals)`** (pseudo-código; entradas: Σ de `fga2, fgm2, fga3, fgm3, fta, ftm` de la selección, ya
calculados por `aggregate_games` sobre los partidos jugados):
```
fga = fga2 + fga3
vals = {
  "ppt":     _safe_div(2*fgm2 + 3*fgm3, fga),
  "ppt_2":   _safe_div(2*fgm2, fga2),
  "ppt_3":   _safe_div(3*fgm3, fga3),
  "ppt_ft":  _safe_div(ftm, fta),
  "fg2_pct": _safe_div(fgm2, fga2),
  "fg3_pct": _safe_div(fgm3, fga3),
  "ft_pct":  _safe_div(ftm, fta),
  "fg2_uso": _safe_div(fga2, fga),
  "fg3_uso": _safe_div(fga3, fga),
}
reasons = {k: "sin_intentos" for k, v in vals.items() if v is None}
return vals, reasons
```
Manejo de nulos (C-11): `_safe_div` devuelve `None` con denominador 0; las razones van al mapa `null_reasons` del contrato
§7.4. Selección vacía (0 partidos jugados): `aggregate_games` devuelve todas las tasas `None` con razón `sin_datos` y
`totals` en 0 (C-02); el frontend muestra el estado vacío. Casos borde: equipo con 0 TL → `ppt_ft`/`ft_pct` nulos;
`fga2 + fga3 = 0` (jugador que solo tiró libres) → `ppt`, usos nulos, `ppt_ft` con valor. Redondeo: `_safe_div` (4 decimales).

**`totals`**: C-02 ya los calcula sobre la selección (partidos jugados). C-07 no agrega claves (T-05 agrega `fga`/`fgm`
en el conjunto estándar). Promedio por partido de un conteo = `total / games` (sin nulos posibles en conteos del box).

**Consistencia con `Ø` (C-02):** las poblaciones de `population.py` calculan cada miembro con `aggregate_games`, así que
el valor pooled de `ppt_3` de cada equipo es el que entra en la media de entidades (DA-08) → `league.ppt_3.avg`.

## 5. Frontend — capa API (api.js)
Sin métodos nuevos. `api.team(code, params)` y `api.player(code, name, params)` con `{competition, last}` los crea C-02.

## 6. Frontend — UI
**Dónde vive.** Fase 1 (antes de X-01): card "Tiro" de `_renderTeamContent` (vista Equipo, `#sec-team`) y de
`_renderPlayerContent` (vista Jugador, `#sec-player`). Fase 2: X-01 la reubica en `#/equipo/<code>/tiro` y
`#/jugador/<id>/tiro` sin cambiar el componente. C-03 comparte la pestaña con el mapa.

**`components/shot-detail.js` → `renderShotDetail(av, totals, games, league, reasons)`** (devuelve HTML):
```
Detalle de tiro                         (t('tiro.detalle.titulo', 'Detalle de tiro'))
            Por partido          Total
         Int.   Conv.  %      Int.  Conv.
T2       45,0   26,0  57,8 %   90    52
T3       26,5   11,5  43,4 %   53    23
TL       25,0   17,0  68,0 %   50    34

[PPT 1,21 Ø 1,09] [PPT 2 1,16 Ø …] [PPT 3 1,30 Ø …] [PPT TL 0,68 Ø …]
```
- Filas: por partido = `av.fga2`… (1 decimal, `DEC1` de `core/format.js`), total = `totals.*` (entero), `%` = `av.fg2_pct`
  (`PCT`). Encabezados con las siglas del cliente (T2i/T2c… como `title` de cada columna: "T2i = tiros de 2 intentados").
- PPT: cuatro `statBox(label, av.ppt, DEC2(av.ppt), "ppt", league)` (reusa `statBox` existente: `Ø` de C-02, sin `↑`).
- Nulos: `nullDisplay(reasons[key])` de `core/format.js` (C-11) → "—" con `title` = etiqueta de la razón; sin clase de color.
- Uso 2P / Uso 3P siguen en la grilla superior de la card (valores ahora pooled).
- Estado vacío: `games === 0` → `<p class="empty">` "Sin partidos jugados en la selección".
- Mobile (<768 px): la tabla usa `font-size` 12 px y columnas de ancho fijo (≈ 7 columnas × 44 px = 308 px ≤ 360 − 2·16);
  sin scroll horizontal; la grilla de PPT usa `.stat-grid` (wrap existente).

**Cards "Eficiencia" (Equipo) y "Producción ofensiva" (Jugador):** `statBox("PPT", av.ppt, DEC2(av.ppt), "ppt", lg)`.
**Buscador:** en la definición de columnas `{ key: "pps", label: "PPT" }` → `{ key: "ppt", label: "PPT" }`; orden con
`cmpNullsLast` (C-11).

## 7. Navegación
Sin vistas ni rutas nuevas. En X-01 la sección vive en la pestaña `tiro` (slug fijado en Arquitectura §3.12).

## 8. Contratos de datos
```
GET /api/team/<code>  ·  GET /api/player/<team>/<name>  ·  GET /api/player/<int:player_id>
  averages.{fga2, fgm2, fga3, fgm3, fta, ftm}                     // promedio por partido de la selección
  averages.{ppt, ppt_2, ppt_3, ppt_ft, fg2_pct, fg3_pct, ft_pct,
            fg2_uso, fg3_uso}                                     // pooled sobre totals (null + razón)
  averages.pps                                                    // legado PTS/FGA, sin etiqueta "PPT"
  totals = {fga2, fgm2, fga3, fgm3, fta, ftm}                     // Σ de la selección (enteros)
  null_reasons = {"<clave>": "sin_intentos" | "sin_datos"}        // contrato §7.4 (C-11)
  league.ppt = {avg, best, reason}                                // C-02
  game_log[i].ppt                                                 // tasa del partido
GET /api/search/players
  [ { …, "ppt": 1.05, "pps": 1.31 } ]
```
Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
- Sin códigos HTTP nuevos. 404 y 400 los manejan las vistas como hoy (toast con `error`).
- Denominador 0 → `null` + `sin_intentos` (nunca 0). Selección sin partidos → estado vacío.
- `sw.js`: agregar `/js/components/shot-detail.js` a `STATIC` y subir `CACHE` (sin esto el módulo no carga offline).

## 10. Riesgos / decisiones
- **D-1 · Orden C-02 → C-07 (desviación del orden del orquestador; el grafo §9 de la arquitectura no lo exige).** RF-6
  necesita que el backend agregue la selección `competition`/`last`, mecanismo que crea C-02 (`context.py`,
  `aggregate_games`). Sin C-02, las tasas pooled con filtro obligarían a calcular en el frontend (regla 4). C-02 no depende
  de C-07. Si el humano mantiene el orden 10→11, el Grupo B de C-07 se ejecuta igual pero RF-6/CA-6 quedan pendientes hasta
  cerrar C-02 (registrar en progress).
- **D-2 · Pooled solo en la familia de tiro (adelanto parcial de DA-02).** Mezcla dos políticas en la misma pantalla
  (eFG%, TS%, FT Rate siguen como media de tasas hasta T-05). Se acepta porque la sección debe cuadrar con sus totales;
  T-05 unifica. Los números de FG2%/FG3%/FT%/PPT cambian respecto de `dev` (R-04): registrar antes/después en progress.
- **D-3 · `ppt` baja respecto de `pps`.** El PPT visible disminuye (se quitan los puntos de TL). Nota en `docs/metrics.md`.
- **D-4 · Componente nuevo `components/shot-detail.js`** — PROPUESTA (no está en 00-arquitectura-transversal.md §8).
  Justificación: la Arquitectura §3.13 pide que el código nuevo de fase 1 vaya en `components/`; `_shotDetailGrid` lo
  consumen Equipo y Jugador (y después F-07). T-05 puede absorberlo en `standard-panel.js` (grupos `tiro_volumen`/`tiro_valor`).
- **D-5 · `season_shooting`** — PROPUESTA (no está en la arquitectura): helper transitorio con el mismo patrón que
  `season_ast_to` (C-04); lo reemplaza `compute_standard` de T-05, con idénticas fórmulas (Arquitectura §3.5).
- **D-6 · Encabezado del mapa de tiro vs sección Tiro.** `summary.ppt` (desde `shots`) y `averages.ppt` (desde el box)
  pueden diferir si hay partidos sin pbp o si el mapa no filtra por competencia; unificarlo es C-03 (`/api/shot-zones` con Ctx).

**Desviaciones respecto de la arquitectura:** ninguna de contrato; D-1 es de orden. **Dependencias técnicas:**
`core/format.js` (`DEC1`, `DEC2`, `PCT`, `nullDisplay`, `NULL_REASON_LABELS`) y `core/i18n.js` `t()` de C-11
([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)); `context.parse_context`,
`stats_engine.aggregate_games`, `population.league_reference`, `api.team/player(…, params)` de C-02
([../11-C-02-promedios-de-liga/plan.md](../11-C-02-promedios-de-liga/plan.md)); `GET /api/player/<int:player_id>` de C-08
([../07-C-08-jugadores-duplicados/plan.md](../07-C-08-jugadores-duplicados/plan.md)). Consumidores: T-05 (claves `ppt*`),
C-03 (PPT por zona coherente con `ppt`).

**Estimación: M · 4–7 h** (backend 1–2 h, componente + cards 2–3 h, verificación y docs 1–2 h).
