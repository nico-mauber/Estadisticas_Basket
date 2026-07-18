# Spec — Feature 05 (tarea 7): Estadísticas "Clutch" (últimos 5 minutos)

> **Depende de Feature 02** (pbp con `clock_secs` + `period`). Sin reloj persistido no se puede aislar el cierre. MVP: tabla de cierres en la vista Liga con columnas adaptadas; usage/pace por jugador quedan en §8.

> ⚠️ **REVISIÓN v2 (feedback del cliente, 2026-07-08).** El MVP original puso los cierres en la vista **Liga**, una fila por equipo-partido, sin filtro de margen. El cliente pidió mover el análisis a la vista **Equipo**, agregarlo como un "mini-partido" del equipo (todos sus cierres sumados) **más** un desglose por partido, y filtrar los cierres por **margen ≤ 15 puntos al minuto 5:00** (solo partidos que estaban apretados al entrar al cierre). Ver **§10** para la especificación autoritativa de la v2; las secciones §1-§9 abajo describen el MVP v1 (superado en lo que §10 contradice, vigente en lo demás — ventana temporal, fórmulas, semántica null).

## 1. Objetivo
**(v2 — ver §10)** En la vista **Equipo**, mostrar el rendimiento del equipo seleccionado únicamente en los cierres de partido apretados (últimos 5 minutos con diferencia ≤ 15 al entrar), agregado como un "mini-partido" acumulado más un desglose por partido, para que el entrenador evalúe cómo ejecuta su equipo los finales cerrados.

**(v1 — superado)** En la sección Liga, agregar un apartado que analiza únicamente los últimos 5 minutos del partido (más prórrogas), para que el entrenador evalúe cómo juega un equipo en situaciones de cierre — con columnas pensadas para ese contexto, no para el partido completo.

## 2. Fuentes (trazabilidad)
- Feature 02 `spec.md` — `pbp_events` con `period`, `period_type` (`REGULAR`/`OT`), `clock_secs` (segundos restantes en el período), `s1`/`s2` (marcador corrido), `action_type`, `sub_type`, `success`, `team_code`, `player_name`.
- `docs/metrics.md` §Posesiones, §Eficiencia (OER/DER), §Eficiencia de tiro (eFG%/TS%) — fórmulas EXACTAS aplicadas al subconjunto clutch.
- `docs/frontend.md` §Vistas → "Liga" (tabla ranking + scatter) y §"app.js" `_renderLeague()`; §Vistas → "Equipo" nota del Game Log como referencia visual.
- `docs/database.md` §`team_game_stats` — `opp_pf` = faltas del rival = faltas recibidas por el equipo; `pf` = faltas cometidas (referencia de nomenclatura; en clutch se cuentan desde `pbp_events` `foul`/`foulon`).
- `docs/api.md` — no existe endpoint clutch (NUEVO).
- Constitución 3, 4, 7 (mobile-first), 9.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver el rendimiento de los equipos únicamente en los últimos 5 minutos, para saber quién ejecuta bien los cierres.
- US-2: Como entrenador, quiero ver, en el cierre, la diferencia de puntos, la eficiencia de tiro, pérdidas, asistencias y faltas, para entender la dinámica del final.
- US-3: Como entrenador, quiero saber qué jugador finaliza más y qué jugador crea más juego en el cierre, para decidir a quién darle la pelota.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE definir la ventana "clutch" como: eventos del último período REGULAR jugado (el de mayor número entre los `period_type="REGULAR"`, típicamente el 4º) con `clock_secs <= 300`, **más** todos los eventos de cualquier período `period_type="OT"`. · (US-1, Feature 02 RF-2, §9 decisión)
- RF-2: El sistema DEBE, por cada partido y cada equipo, agregar sobre los eventos clutch las stats crudas: 2PA/2PM, 3PA/3PM, FTA/FTM, OR, DR, AST, TOV, STL, BLK, faltas cometidas (`foul` del equipo), faltas recibidas (`foulon` del equipo), y puntos a favor / en contra (de `s1`/`s2` al inicio y fin de la ventana). · (US-2)
- RF-3: El sistema DEBE calcular por equipo-partido, con fórmulas EXACTAS de `docs/metrics.md` sobre el subconjunto clutch: `Diferencia de puntos = PTS − PTS_rival`, `Offensive Rating = OER = PTS/POS`, `Defensive Rating = DER = PTS_rival/POS_rival`, `eFG%`, `TS%`. · (US-2, `docs/metrics.md`)
- RF-4: El sistema DEBE identificar, por partido, el jugador que más finaliza (mayor puntos clutch) y el que más crea juego (mayor AST clutch), globalmente y/o por equipo. · (US-3)
- RF-5: El sistema DEBE exponer estos datos vía endpoint NUEVO `GET /api/clutch` (todos los partidos, una fila por equipo-partido) con filtro opcional `?team=<code>`. · (US-1)
- RF-6: La vista DEBE presentar los datos como una **tabla tipo Game Log** (una fila por equipo-partido en el cierre), ordenable, filtrable por equipo, con columnas adaptadas al cierre (ver §6) — reusando el estilo de tabla existente de la vista Liga. · (US-1, `docs/frontend.md` §Liga)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `pbp_events` | consumido | (Feature 02) | — |
| `GET /api/clutch` (`?team=<code>` opcional) | endpoint | Response: `[ { "game_id", "date", "team_code", "team_name", "opponent_code", "home_away", "pts", "opp_pts", "point_diff", "off_rating", "def_rating", "efg_pct", "ts_pct", "tov", "ast", "reb", "fouls_committed", "fouls_drawn", "top_finisher": {"name","pts"}, "top_creator": {"name","ast"}, "possessions" } ]`. `[]` si ningún partido tiene pbp. | **NUEVO** — irá a `docs/api.md` |

Lógica de ventana clutch + agregación en módulo backend (candidato `clutch.py` o `stats_engine.py`; lo decide el Paso 2). Sin cambios de esquema (usa `pbp_events` de Feature 02).

## 6. Estados de UI — estructura propuesta de la pantalla
Apartado nuevo dentro de la vista Liga (`#sec-league`), debajo de la tabla de ranking existente, con su propio título "Cierres (últimos 5 min)".

**Estructura elegida (MVP):** una tabla tipo Game Log, **una fila por equipo-partido**, con filtro por equipo (reusa el patrón de selección de la Liga) y orden por columnas (reusa `_bindLeagueTableEvents`). Columnas:

| Fecha | Rival | L/V | Dif | Pts | Off | Def | eFG% | TS% | TOV | AST | REB | FR | FC |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

(Dif = diferencia de puntos en el cierre; Off/Def = Offensive/Defensive Rating clutch; FR/FC = faltas recibidas/cometidas). Los líderes "más finaliza / más crea" se muestran como tooltip o subfila por partido (o tarjeta resumen league-wide en una iteración — ver §8).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tabla Cierres | spinner existente de Liga | Ningún partido con pbp: `"Sin datos de cierre. Reimportá partidos para traer el play-by-play."` (copy nuevo) | Error de red: `"No se pudieron cargar los cierres"` (copy nuevo) | `/api/*` siempre a red (SW) | Tabla ordenable con las columnas de cierre; color-coding de Dif (verde >0 / rojo <0) vía `_colorCell` |

## 7. Criterios de aceptación
- CA-1: Given partidos con pbp, When se pide `GET /api/clutch`, Then devuelve una fila por equipo-partido y cada fila tiene `point_diff == pts − opp_pts` (verificable numéricamente).
- CA-2: Given un partido cuyo 4º período tiene eventos con `clock_secs <= 300`, When se calcula el clutch de ese partido, Then solo esos eventos (más OT si hubo) entran en la agregación (ningún evento con `clock_secs > 300` del período final influye en los totales).
- CA-3: Given `?team=<code>`, When se consulta, Then solo aparecen filas de ese equipo.
- CA-4: Given un partido con prórroga (`period_type="OT"`), When se calcula el clutch, Then todos los eventos de la OT entran en la ventana clutch (además de los últimos 5:00 del período REGULAR final).
- CA-5: Given la vista Liga, When se abre el apartado Cierres, Then se muestra la tabla con las columnas adaptadas, ordenable, y la fila del equipo ganador del cierre resalta su Dif en verde — sin errores en consola.
- CA-6: Given un partido, When se lee `top_finisher`/`top_creator`, Then corresponden al jugador con más puntos / más asistencias **dentro de la ventana clutch** (no del partido completo).

## 8. Fuera de alcance (backlog documentado)
Indicadores pedidos por el usuario fuera del MVP:
- **Uso de jugadores (USO%) en el cierre** — requiere totales de equipo restringidos al clutch por jugador; diferido.
- **Ritmo (Pace) del cierre** — requiere proyectar posesiones clutch a 40'/minutos de ventana; diferido (se expone `possessions` como proxy de muestra).
- **Tarjetas resumen league-wide** de "quién finaliza / crea más en cierres" agregando todos los partidos — el MVP los da por partido; la agregación cross-partido se difiere.
- **Definición alternativa de clutch por margen** (ej. partido dentro de 5 puntos en los últimos 5 min, estilo NBA) — el MVP usa la definición temporal pura pedida por el usuario ("únicamente los últimos 5 minutos"); el filtro por margen se difiere.
- **Drill-down** a la secuencia de jugadas del cierre (mini play-by-play) — diferido.

## 9. Ambigüedades
- [RESUELTA] Definición exacta de "últimos 5 minutos del partido" → **Decisión:** último período REGULAR con `clock_secs <= 300` + prórrogas completas (RF-1). Justificación: el usuario pidió "únicamente los últimos 5 minutos del partido"; incluir la OT entera es lo estándar en análisis de cierres (la prórroga ES un cierre) y evita dejar afuera finales dramáticos. Registrado como decisión de producto.
- [RESUELTA] "Offensive Rating / Defensive Rating" vs OER/DER → **Decisión:** son OER/DER de `docs/metrics.md` aplicados al subconjunto clutch (mismo criterio que Feature 03 §9). No se inventa fórmula.
- [RESUELTA] Faltas recibidas/cometidas en clutch → **Decisión:** se cuentan desde `pbp_events` (`foulon` = recibida por el jugador/equipo, `foul` = cometida), no desde el box score `pf`/`opp_pf` (que es del partido completo). Consistente con el resto de agregados clutch.
- [RESUELTA] Nulo vs cero en el cierre → **Decisión:** las tasas clutch (Off/Def Rating, eFG%, TS%) valen `null` (no 0) si en la ventana clutch el denominador es 0 (ej. un cierre sin ningún tiro de campo del equipo), con la semántica de la **Feature 08** (`spec.md`). La UI muestra `"—"` en esas celdas.

---

## 10. REVISIÓN v2 — cierre por equipo, agregado + margen (autoritativa)

Feedback del cliente (2026-07-08): *"mover la tabla de liga a equipo y ver las estadísticas del equipo faltando 5 minutos y ±15, en vez de por partido, por el mini partido de últimos 5 minutos y diferencia de menos de 15 pts"*. Decisiones confirmadas por el cliente vía preguntas: **filtro ±15 por ventana** y **vista agregado + desglose por partido**.

### 10.1 Ventana clutch calificada
- La **ventana temporal** no cambia respecto de v1 (RF-1): último período REGULAR con `clock_secs ≤ 300` + todos los eventos `OT`.
- **NUEVO — calificación por margen (por ventana):** un partido entra al análisis clutch del equipo **solo si** al minuto **5:00** del último período REGULAR (al abrir la ventana) la diferencia absoluta de marcador era **≤ 15 puntos**. La diferencia se toma del `s1`/`s2` corrido del último evento con `clock_secs > 300` del período REGULAR final (marcador al entrar al cierre); si no hay evento previo, se asume 0-0 (califica). Si el partido **no** califica (paliza), **no aporta** nada al clutch del equipo y se cuenta en `games_excluded`.
- Si el partido llegó a `OT`, califica por definición (estaba empatado al final del 4º) — la calificación se evalúa al 5:00 del REGULAR final igual que el resto.
- Umbral inclusivo: `abs(margen) <= 15`.

### 10.2 Agregación por equipo ("mini-partido")
- Para el equipo seleccionado, se **suman** las stats crudas de TODOS sus cierres calificados (todos los partidos) en un único box de equipo + un box de rival → se calculan las mismas métricas de v1 (RF-3) sobre esa suma: `point_diff`, `off_rating` (OER), `def_rating` (DER), `efg_pct`, `ts_pct`, y **conteos crudos** (pts a favor/contra, REB, AST, TOV, STL, BLK, faltas cometidas/recibidas), `possessions`.
- **NUEVO — récord de cierres:** por cada partido calificado, si el equipo superó al rival en su ventana (`pts > opp_pts`) cuenta como cierre ganado; se reporta `clutch_record` (`ganados-perdidos-empatados`).

### 10.3 Desglose por partido
- Además del agregado, se devuelve **una fila por partido calificado** del equipo, con las mismas columnas de v1 (fecha, rival, L/V, dif, pts, off/def, eFG%, TS%, TOV, AST, REB, FR, FC, líderes) — pero **solo del equipo seleccionado** (no ambos equipos) y **solo partidos calificados**. Se incluye `entry_margin` (diferencia al 5:00) por transparencia.

### 10.4 API (reemplaza a v1)
- **NUEVO** `GET /api/clutch/<team_code>` (reemplaza `GET /api/clutch` con `?team=`). `?margin=<n>` opcional (default 15). Shape:
  ```
  { "team_code", "team_name", "margin": 15,
    "games_qualified": int, "games_excluded": int,
    "clutch_record": "G-P-E",
    "aggregate": { "pts_for","pts_against","point_diff","off_rating","def_rating",
                   "efg_pct","ts_pct","possessions",
                   "reb","ast","tov","stl","blk","fouls_committed","fouls_drawn" },
    "per_game": [ { "game_id","date","opponent_code","home_away","entry_margin",
                    "pts","opp_pts","point_diff","off_rating","def_rating","efg_pct","ts_pct",
                    "tov","ast","reb","fouls_committed","fouls_drawn",
                    "top_finisher","top_creator" } ] }
  ```
  - `404` si el equipo no existe o no tiene pbp. `aggregate` con conteos 0 y tasas `null` si `games_qualified == 0`.

### 10.5 UI (reemplaza §6)
- Se **quita** el apartado Cierres de la vista Liga (`_renderClutch`/`league-clutch` fuera de `renderLeague`).
- Se **agrega** a la vista Equipo (`#sec-team`), como una card "Cierres (últimos 5 min, dif ≤ 15)": arriba una **tarjeta agregada** (mini-partido: dif, off/def, eFG%, TS%, conteos, récord de cierres, N partidos calificados/excluidos); abajo la **tabla por partido** (ordenable), scopeada al equipo seleccionado. Se refresca al cambiar de equipo (junto con `team-shotmap`/`team-onoff`/`team-lineup`).

### 10.6 CA v2 (reemplazan/añaden a §7)
- CA-v2-1: `GET /api/clutch/<team>` → `aggregate.point_diff == pts_for − pts_against` (suma de cierres calificados).
- CA-v2-2: Un partido con margen > 15 al 5:00 **no** aparece en `per_game` y suma 1 a `games_excluded`.
- CA-v2-3: Un partido con margen ≤ 15 al 5:00 aparece en `per_game` y sus crudos suman en `aggregate` (verificable: `aggregate.reb == Σ per_game[].reb`).
- CA-v2-4: `clutch_record` = conteo de partidos calificados con `pts > opp_pts` / `<` / `==`.
- CA-v2-5: La vista Equipo muestra la tarjeta agregada + la tabla por partido del equipo seleccionado, sin errores de consola; la Liga ya **no** muestra Cierres.
- CA-v2-6 (hereda CA-4 v1): un partido con OT califica y todos sus eventos OT entran en la ventana.

### 10.7 Backlog v2 (además de §8)
- Umbral de margen configurable desde la UI (hoy fijo 15, `?margin=` en API).
- Récord de cierres ponderado por diferencia / "clutch net rating" league-wide para comparar equipos (perdimos la comparación cross-equipo al mover a Equipo; se puede reponer como ranking en Liga en otra iteración).
