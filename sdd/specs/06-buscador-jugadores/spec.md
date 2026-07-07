# Spec — Feature 06 (tarea 8): Buscador avanzado de jugadores

> **No depende de pbp.** Trabaja sobre las stats agregadas de jugador que ya existen. MVP: filtros combinables sobre las métricas disponibles hoy (+ Posición y Plus/Minus, que están en el feed FIBA y requieren un parseo chico). Métricas sin definir o sin dato (Edad, Chaos, Offensive Dependency, Win Shares) quedan en §8/§9.

## 1. Objetivo
Un buscador de jugadores con filtros múltiples combinables (nombre, equipo, competencia, posición y umbrales sobre métricas avanzadas) que permita consultas del tipo "bases con más de 60% eFG, más de 20% de uso y más de 6 asistencias por partido".

## 2. Fuentes (trazabilidad)
- `docs/api.md` §`GET /api/players/<team_code>` y §`GET /api/player/<team_code>/<player_name>` — hoy la búsqueda es por equipo; no existe un buscador cross-equipo (será NUEVO).
- `backend/stats_engine.py` `calc_player_stats()` — provee eFG%, TS%, OER, USO%, PPP, PPT, FG2%/FG3%/FT%, AST ratio, TO%, STL/BLK, `reb_share`/`oreb_share`/`dreb_share`, `physical_impact`, `def_playmaking`, `stocks` — todas ya calculadas on-the-fly.
- `docs/database.md` §`player_game_stats` — columnas crudas por jugador-partido (pts, ast, tov, stl, blk, minutes, etc.); §`games.competition` — la competencia vive en `games`.
- `backend/fiba_fetcher.py` + fetch real: el objeto jugador FIBA trae `playingPosition` (ej. `"G"`) y `sPlusMinusPoints` — hoy NO se parsean ni guardan. NO trae edad ni fecha de nacimiento.
- `docs/frontend.md` §Vistas, §"app.js" (`NAV_ITEMS`, `sections`, helpers `statClass`/`_colorCell`) — para agregar una vista nueva.
- `docs/metrics.md` §USO%, §Eficiencia de tiro, §Rebotes — fórmulas EXACTAS de las métricas filtrables.
- Constitución 3 (endpoint `/api/*`), 4 (métricas on-the-fly), 7 (mobile-first), 9 (reuso de helpers).

## 3. Historias de usuario
- US-1: Como analista, quiero buscar jugadores de toda la base (no de un solo equipo) combinando filtros, para armar listas de scouting.
- US-2: Como analista, quiero filtrar por posición y por umbrales de métricas avanzadas (eFG%, USO%, asistencias/partido, etc.) simultáneamente, para consultas específicas.
- US-3: Como analista, quiero que los resultados se muestren en una tabla ordenable con las métricas que filtré, para comparar candidatos.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE exponer un endpoint NUEVO que devuelve **todos los jugadores de la base** con: nombre, equipo (código + nombre), competencia(s) en que jugó, partidos jugados, minutos promedio, y las métricas promedio ya calculadas por `calc_player_stats` (eFG%, TS%, OER, USO%, PPP, PPT, FG2%/FG3%/FT%, AST/partido, TOV/partido, STL/partido, BLK/partido, `reb_share`/`oreb_share`/`dreb_share`, `physical_impact`, `stocks`, `def_playmaking`). · (US-1, `stats_engine.py` `calc_player_stats`, `docs/api.md`)
- RF-2: El sistema DEBE incluir la **Posición** de cada jugador (`playingPosition` de FIBA) — requiere parsear y persistir la columna NUEVA `player_game_stats.position` (última no vacía observada). · (US-2, `fiba_fetcher.py`)
- RF-3: El sistema DEBE incluir el **Plus/Minus** promedio (`sPlusMinusPoints` de FIBA) — requiere parsear y persistir la columna NUEVA `player_game_stats.plus_minus` (INTEGER, por partido; el buscador promedia). · (US-2, `fiba_fetcher.py`)
- RF-4: El buscador (frontend) DEBE permitir **combinar** filtros, todos aplicados en conjunto (AND): texto (nombre contiene), selección (equipo, competencia, posición) y rango (mín/máx) sobre cada métrica numérica de RF-1/RF-3. · (US-2)
- RF-5: El sistema DEBE resolver el ejemplo canónico del usuario: "bases (posición G) con eFG% > 60%, USO% > 20% y AST/partido > 6" devolviendo exactamente los jugadores que cumplen los tres umbrales a la vez. · (US-2)
- RF-6: Los resultados DEBEN mostrarse en una tabla ordenable por cualquier columna (reusa el patrón de orden de la tabla de Liga) y cada fila DEBE poder abrir la vista Jugador de ese jugador (reusa `renderPlayer`). · (US-3, `docs/frontend.md` §app.js `_bindLeagueRowClicks`)
- RF-7: El buscador DEBE ser una vista nueva accesible desde la navegación principal (`NAV_ITEMS` + `sections`), con su hash de sección. · (US-1, `docs/frontend.md` §Vistas)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `player_game_stats.position` | columna | TEXT DEFAULT `""` — `playingPosition` FIBA. Vía `upgrade_db()`. | **NUEVO** |
| `player_game_stats.plus_minus` | columna | INTEGER DEFAULT 0 — `sPlusMinusPoints` FIBA (por partido). Vía `upgrade_db()`. | **NUEVO** |
| `GET /api/search/players` | endpoint | Response: `[ { "player", "team_code", "team_name", "competitions": ["Liga X"], "games", "position", "minutes", "plus_minus", "efg_pct", "ts_pct", "oer", "uso_pct", "ppp", "pps", "fg2_pct", "fg3_pct", "ft_pct", "ast", "tov", "stl", "blk", "reb_share", "oreb_share", "dreb_share", "physical_impact", "stocks", "def_playmaking" } ]`. Sin parámetros: devuelve todos. Filtrado y orden en el frontend (dataset chico). | **NUEVO** — irá a `docs/api.md` |

> Decisión de arquitectura (Paso 2 la confirma): el filtrado combinable se hace en el frontend sobre el dataset completo (la base tiene ~decenas–cientos de jugadores). Si el volumen creciera, se migra a filtros server-side por query params (documentado en §8).

## 6. Estados de UI
Vista nueva "Buscar" (`#sec-search`, ícono a definir en el plan, ej. 🔎) en la navegación.
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Panel de filtros (texto nombre, selects equipo/competencia/posición, pares mín/máx por métrica) + tabla de resultados | spinner al cargar el dataset | Sin jugadores en la base: `"No hay jugadores importados todavía"` (copy nuevo); Filtros sin coincidencias: `"Ningún jugador cumple los filtros"` (copy nuevo) | Error de red: `"No se pudo cargar el buscador"` (copy nuevo) | `/api/*` siempre a red (SW) | Tabla ordenable con las métricas filtradas; contador "N jugadores"; fila clickeable → vista Jugador |
| Botón "Limpiar filtros" | — | — | — | — | resetea todos los filtros y muestra el set completo |

## 7. Criterios de aceptación
- CA-1: Given jugadores importados, When se pide `GET /api/search/players`, Then devuelve una fila por jugador único (nombre+equipo) con `position`, `plus_minus` y las métricas promedio, y `games` = cantidad de partidos de ese jugador.
- CA-2: Given el filtro del ejemplo canónico (posición G, eFG% > 0.60, USO% > 0.20, AST/partido > 6), When se aplica, Then la tabla muestra solo los jugadores que cumplen los tres umbrales simultáneamente (verificable contra los datos crudos).
- CA-3: Given dos filtros de rango sobre distintas métricas, When se aplican juntos, Then el resultado es la intersección (AND), no la unión.
- CA-4: Given una fila de resultado, When se hace click, Then se abre la vista Jugador correspondiente (equipo + nombre correctos).
- CA-5: Given la tabla de resultados, When se clickea un encabezado de columna, Then se ordena por esa métrica (asc/desc alternado).
- CA-6: Given "Limpiar filtros", When se pulsa, Then se muestran todos los jugadores y los controles quedan vacíos.
- CA-7: Given `player_game_stats` migrada, When se corre `python backend/database.py` dos veces, Then `position` y `plus_minus` existen y `upgrade_db` no falla (idempotencia).

## 8. Fuera de alcance (backlog documentado)
Filtros pedidos por el usuario fuera del MVP:
- **Edad** — el feed FIBA (`data.json`) NO trae edad ni fecha de nacimiento; no hay fuente. Requiere un origen de datos externo (carga manual o roster aparte). Bloqueado por datos.
- **Chaos**, **Offensive Dependency**, **Win Shares** — sin fórmula en `docs/metrics.md` (ver §9). No se implementan hasta definirlas.
- **Defensive Rating por jugador**, **Pace por jugador** — no se calculan hoy (Pace es métrica de equipo; DER de jugador no está definido). Diferido.
- **% Rebotes Totales/Ofensivos/Defensivos vs rival** (TRB%/OR%/DR% estilo equipo) — a nivel jugador solo existen los *shares* del equipo (`reb_share`, etc.), que el MVP sí incluye; la versión vs-rival es de equipo. Diferido.
- **"Rating"** genérico — ambiguo (ver §9); no se implementa hasta definir qué rating.
- **Filtrado server-side** por query params (para bases grandes) — el MVP filtra en frontend.
- **Guardar/compartir búsquedas** (presets de scouting).

## 9. Ambigüedades
- [NEEDS CLARIFICATION — difiere el filtro, no bloquea el MVP] **"Chaos"**, **"Offensive Dependency"**, **"Win Shares"**, **"Rating"**: el usuario los listó como filtros pero ninguno existe en `docs/metrics.md`. **Decisión:** fuera del MVP hasta definir fórmula y stats de entrada. Notas: "Win Shares" (Oliver) requiere marco de posesiones/valor por victoria no implementado; "Rating" podría ser PIR/EFF de FIBA (el feed trae `eff_1..7` a nivel equipo y `sEfficiency`-like a nivel jugador — a confirmar). Requiere decisión del usuario antes de agregar a `docs/metrics.md`.
- [RESUELTA] "Edad" → **Decisión:** no disponible en el feed FIBA; se documenta en §8 como bloqueado por datos, no se marca como implementable.
- [RESUELTA] ¿Filtrado en front o back? → **Decisión MVP:** frontend sobre dataset completo (volumen chico). Justificación: simplicidad y respuesta instantánea; migrable a server-side si crece (§8).
- [RESUELTA] Posición cuando un jugador tiene registros con `playingPosition` distinto o vacío entre partidos → **Decisión:** tomar la última posición no vacía observada; si nunca hay dato, `position=""` y el jugador no matchea filtros de posición (pero sí los demás).
- [RESUELTA] Nulo vs cero en los promedios que alimentan el buscador → **Decisión:** los promedios de tasa provienen de la **Feature 08** (`spec.md`): excluyen partidos con denominador 0 y valen `null` si no hay dato. Un jugador con métrica `null` NO matchea filtros de rango (`>`/`<`) sobre esa métrica (null ≠ 0), pero sí los demás filtros. Es dependencia recomendada: idealmente Feature 08 se implementa antes que 06 para que los umbrales del buscador operen sobre promedios correctos.
