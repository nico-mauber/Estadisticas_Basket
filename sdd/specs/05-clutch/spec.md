# Spec — Feature 05 (tarea 7): Estadísticas "Clutch" (últimos 5 minutos)

> **Depende de Feature 02** (pbp con `clock_secs` + `period`). Sin reloj persistido no se puede aislar el cierre. MVP: tabla de cierres en la vista Liga con columnas adaptadas; usage/pace por jugador quedan en §8.

## 1. Objetivo
En la sección Liga, agregar un apartado que analiza únicamente los últimos 5 minutos del partido (más prórrogas), para que el entrenador evalúe cómo juega un equipo en situaciones de cierre — con columnas pensadas para ese contexto, no para el partido completo.

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
