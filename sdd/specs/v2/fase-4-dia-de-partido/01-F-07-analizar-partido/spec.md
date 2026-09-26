# Spec — F-07: Analizar partido

> **ID:** F-07 · **Prioridad:** P1 · **Fase y orden:** Fase 4 — Día de partido · 01
> **Depende de:** X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)) · T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)) · A-05 ([../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/](../../fase-3-contexto-posesion/05-A-05-tramo-reloj-posesion/spec.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md)) · C-03 ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/spec.md)) · A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md))
> **Habilita:** F-03, F-01, F-02 (componente de partido), A-08, A-11 (`matchups.py`)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.1 · F-07 y §1.3 S5 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.9, §3.10, §3.11, §3.12, §4 (`game_analysis.py`, `matchups.py`), §6, §8 (`components/game-view.js`), §9 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-07):**
- "Vista completa de un partido ya finalizado, dentro de la sección Partido."
- "Boxscore con métricas avanzadas de tiro por jugador y equipo."
- "Mapa de tiros filtrable por zona, cuarto y tramo de reloj."
- "Jugada a jugada con filtros por jugador, tipo de evento y período."
- "Línea de tiempo del marcador con los parciales y los tiempos muertos marcados."
- "Parciales por cuarto y ratings avanzados de ambos equipos."
- "Quintetos utilizados en el partido y tabla de matchups contra los quintetos rivales."
- "Exportación a CSV y a informe de scouting."
- Criterio: "Cualquier partido del catálogo se abre en esta vista y sus totales coinciden con el box score oficial. Es la base técnica sobre la que se construye F-01."

Y §1.3 S5: "Un mismo partido visto en cuatro estados. La sección se abre desde el catálogo, desde el game log de un equipo o desde el calendario de S8. […] Los cuatro modos comparten el mismo componente de partido: cambia la fuente de datos (en curso o cerrado), no la estructura. Conviene construir primero 'Analizar', que trabaja sobre datos ya cargados, y derivar de ahí 'En vivo'."

**Por qué:** hoy la app es "una herramienta de temporada y no acompaña el día del partido" (§1.2). No existe ninguna vista centrada en un partido.

**Qué existe HOY (verificado en `main`):**
- No hay vista ni endpoint de partido individual. `backend/app.py:list_games` (`GET /api/games`) devuelve la lista de `games` (fila completa vía `_to_dict`). `backend/app.py:game_pbp` (`GET /api/pbp/<game_id>`) es solo de verificación: devuelve `{game_id, events, by_action_type, first, last}` y 404 `"Partido sin play-by-play. Reimportá el partido."` si no hay eventos.
- El box oficial por equipo está en `team_game_stats` y por jugador en `player_game_stats` (valores de FIBA, `backend/fiba_fetcher.py:_parse_fiba_json`); el marcador final en `games.home_score/away_score`.
- `pbp_events` guarda todos los eventos (incluidos `timeout`, `period`, `substitution`) con `s1`/`s2` (marcador corrido), `clock_secs`, `period`, `period_type` (`REGULAR`/`OVERTIME`, con `period` reiniciado en 1 en prórroga — Arquitectura §1.5 D-09).
- `backend/lineups.py:build_segments(events, team_code, starters)` reconstruye los tramos de un equipo; `lineups.py:_agg` agrega conteos desde eventos; `PERIOD_LEN = {"REGULAR": 600, "OT": 300}` (defecto D-09, lo corrige F-11).
- El catálogo de partidos (`frontend/js/app.js:_gamesTable`) ya renderiza cada fila con `data-game-id`, pero no navega a ningún lado.
- Mapa de tiro: `frontend/js/app.js:_shotChartSVG` (lo mueve C-03 a `components/shot-chart.js`); las coordenadas reales llegan con F-11/C-03 (hoy `x = y = 0`, Arquitectura §1.6).

**Qué resuelven requisitos anteriores (supuestos de esta spec):** F-11 (ingesta v2: `period_pts`, `team_orb/team_drb/team_tov`, `court_x/court_y`, `previous_action`, `qualifiers`, `games.minutes`, `player_id`, `repository`, `cache`); T-05 (conjunto estándar, `compute_standard`); T-02 (badge, regresión, banda); T-06 (tabla completa + exportación); C-03 (`shot_zones.py`, `shot-chart.js`); F-06 (quintetos con conjunto estándar); A-01 (`possessions.py`, `lineups.build_segments_both`); A-05 (tramo de reloj por tiro); X-01 (router y sección S5 con bandera `enabled`). Las features 03-lineups y 04-on-off (motor de quintetos) y 05-clutch son la base del cálculo por tramos.

**Qué queda (esta spec):** la vista Analizar de S5, el componente de partido reutilizable por En vivo/Momentum/Preparar, el cálculo de emparejamientos (coincidencia en cancha) de un partido y la exportación del informe de scouting.

## 1. Objetivo
Abrir cualquier partido finalizado del catálogo en una vista única (S5 · Analizar) que muestre su box avanzado, parciales y ratings, línea de tiempo del marcador, mapa de tiros y jugada a jugada filtrables, quintetos y emparejamientos entre quintetos, exportable como CSV/XLSX e informe de scouting, con totales idénticos al box score oficial.

## 2. Fuentes (trazabilidad)
- Especificación v2 §4.1 F-07 (requisito), §1.3 S5 (modos y componente compartido), §3 T-02 (umbral de emparejamiento 8/25), T-05 (el emparejamiento es entidad del conjunto estándar), T-06 (tablas y exportación), §5 A-05 (tramo de reloj), §6 glosario (fórmulas).
- `docs/database.md` §`games`, §`team_game_stats`, §`player_game_stats`, §`shots`, §`pbp_events` (tipos de `action_type`, l.133).
- `docs/api.md` §`GET /api/games`, §`GET /api/pbp/<game_id>`.
- `docs/metrics.md` §Posesiones, §Eficiencia, §Eficiencia de tiro (conciliadas por Arquitectura §2.2).
- `docs/frontend.md` §Vistas (Importar: tabla de partidos; Equipo: game log).
- Arquitectura §1.5 (D-09 prórrogas), §1.6 (pbp real, calificadores, vínculos), §2.1 (agregación pooled), §3.5 (conjunto estándar), §3.7 (T-02), §3.9 (A-01/A-05), §3.10 (emparejamientos), §3.11 (T-06), §3.12 (S5), §4, §6, §7.1–§7.8, §8.
- Specs previas: `sdd/specs/03-lineups/spec.md` (motor de quintetos), `sdd/specs/04-on-off/spec.md`, `sdd/specs/05-clutch/spec.md`, `sdd/specs/08-nulos-vs-cero/spec.md`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero abrir un partido ya jugado desde el catálogo o desde el game log, para analizarlo completo en un solo lugar.
- US-2: Como entrenador, quiero el box score con métricas avanzadas de tiro por jugador y por equipo, para evaluar la eficiencia de cada uno en ese partido.
- US-3: Como analista, quiero ver la línea de tiempo del marcador con los parciales y los tiempos muertos, para entender cuándo y cómo cambió el partido.
- US-4: Como entrenador, quiero los parciales por cuarto con los ratings avanzados de ambos equipos, para detectar en qué cuarto se ganó o perdió.
- US-5: Como analista, quiero el mapa de tiros filtrable por zona, cuarto y tramo de reloj, para ver desde dónde y en qué momento de la posesión tiró cada equipo.
- US-6: Como analista, quiero el jugada a jugada filtrable por jugador, tipo de evento y período, para revisar secuencias concretas.
- US-7: Como entrenador, quiero los quintetos usados y cómo rindió cada uno contra los quintetos rivales, para evaluar mis decisiones de rotación.
- US-8: Como analista, quiero exportar los datos del partido y un informe de scouting, para compartirlo con el cuerpo técnico.
- US-9: Como equipo de desarrollo, queremos un componente de partido reutilizable, para construir En vivo, Momentum y Preparar sobre la misma estructura.

## 4. Requisitos funcionales

**Acceso y encabezado**
- RF-1: El sistema DEBE abrir la vista Analizar de un partido para **cualquier** partido del catálogo (con o sin play-by-play, con o sin coordenadas), identificándolo por su `game_id`, dentro de la sección Partido (S5), modo "Analizar". · (US-1) (Esp. v2 §F-07, §1.3 S5)
- RF-2: El sistema DEBE ofrecer acceso a la vista desde cada fila del catálogo de partidos (S1 · Partidos), desde cada fila del game log de Equipo (S3) y del game log de Jugador (S4). · (US-1) (Esp. v2 §1.3 S5 "se abre desde el catálogo, desde el game log de un equipo"; §1.3 S4 "Game log · Partido a partido con enlace al partido en S5")
- RF-3: El sistema DEBE mostrar un encabezado del partido con: equipos local y visitante, marcador final, fecha, competencia y temporada, cantidad de prórrogas y el estado de los datos (con/sin play-by-play, con/sin coordenadas, necesita reproceso). · (US-1) (docs/database.md §games; Arquitectura §6 `GET /api/games` campos `has_pbp`, `has_coords`, `needs_reprocess`)

**Box score avanzado**
- RF-4: El sistema DEBE mostrar, para cada equipo, el box score oficial del partido (conteos tal como los publica FIBA: PTS, T2c/T2i, T3c/T3i, TLc/TLi, RO, RD, REB, AS, PER, ROB, TAP, FC) y, junto a él, el conjunto estándar completo de T-05 del equipo en el partido. · (US-2) (Esp. v2 §F-07 "Boxscore con métricas avanzadas de tiro por jugador y equipo"; §T-05)
- RF-5: El sistema DEBE mostrar una fila por jugador que figure en el box del partido (incluidos los que no jugaron, marcados "No jugó"), con sus conteos oficiales y el conjunto estándar de T-05 de jugador calculado sobre ese partido, en una tabla completa según T-06 (orden por cualquier columna con nulos al final, selector de columnas, fila de totales del equipo). · (US-2) (Esp. v2 §F-07, §T-06, §C-11)
- RF-6: Las métricas de tiro del box DEBEN usar las fórmulas del glosario conciliadas en Arquitectura §2.2: `eFG% = (T2c + T3c + 0,5 × T3c) / (T2i + T3i)`; `TS% = Puntos / (2 × (T2i + T3i + 0,44 × TLi))`; `PPT = Puntos anotados desde tiros de campo / tiros de campo intentados` (clave `ppt` = `(2·T2c + 3·T3c)/TCi`); `PPT 2 = 2·T2c/T2i`, `PPT 3 = 3·T3c/T3i`, `PPT TL = TLc/TLi`; `FG% = TCc/TCi`; `Uso de triple = T3i/TCi`; `FT Rate = TLi/TCi`. Denominador 0 → nulo con razón `sin_intentos` (C-11). · (US-2) (Esp. v2 §6; Arquitectura §2.2, §3.5)
- RF-7: El sistema DEBE garantizar que los totales mostrados del partido coincidan con el box score oficial: (a) PTS de cada equipo = marcador final del partido; (b) suma por jugador de cada conteo + rebotes/pérdidas de equipo (cuando FIBA los informa) = total del equipo; (c) suma de los parciales por período = PTS del equipo; (d) marcador final de la línea de tiempo = marcador final. Toda discrepancia DEBE mostrarse en la vista como aviso de calidad de datos (sin corregir los números). · (US-2) (Esp. v2 §F-07 CA; §F-11)

**Parciales y ratings por período**
- RF-8: El sistema DEBE mostrar los puntos de cada equipo por cuarto y por cada prórroga (parciales) y, por cada período, los ratings avanzados de ambos equipos: posesiones, OER, DER, Net Rating, PACE, eFG%, TS%, TO%, OR% y FT Rate (fórmulas del conjunto estándar, Arquitectura §3.5). · (US-4) (Esp. v2 §F-07 "Parciales por cuarto y ratings avanzados de ambos equipos")
- RF-9: Los parciales DEBEN salir del dato oficial por período (cuando la ingesta v2 lo trae) y, si no está, del marcador corrido del play-by-play; los ratings por período requieren play-by-play y, si falta, se muestran nulos con razón `sin_pbp`. · (US-4) (Arquitectura §5 `team_game_stats.period_pts`; §7.4)

**Línea de tiempo del marcador**
- RF-10: El sistema DEBE mostrar la evolución del marcador a lo largo del partido (tiempo de juego transcurrido en el eje horizontal, incluidas las prórrogas de 5 minutos) con: diferencia de puntos en cada momento, separadores de período, tiempos muertos marcados con el equipo que los pidió y las rachas de anotación ("parciales") destacadas. · (US-3) (Esp. v2 §F-07 "Línea de tiempo del marcador con los parciales y los tiempos muertos marcados")
- RF-11: Una racha ("parcial") DEBE definirse como una secuencia de puntos consecutivos de un mismo equipo sin puntos del rival, y se destaca si suma al menos el mínimo configurable de puntos (default 8). La vista DEBE informar además: cambios de liderazgo, empates y máxima ventaja de cada equipo. · (US-3) (Esp. v2 §F-07; §F-13 "ningún umbral fijo en el código")
- RF-12: El tiempo transcurrido DEBE calcularse con la duración real de cada período: 600 s por cuarto regular y 300 s por prórroga (FIBA envía `OVERTIME`, con período reiniciado en 1). · (US-3) (Arquitectura §1.5 D-09, §3.9 `PERIOD_LEN`)

**Mapa de tiros**
- RF-13: El sistema DEBE mostrar el mapa de tiros del partido por equipo (y opcionalmente por jugador) con el mapa de zonas de C-03 y su tooltip de datos por zona, filtrable por: cuarto (1–4, prórroga), tramo de reloj de posesión (temprano 0–8, medio 9–16, tardío 17–24) y zona (al elegir una zona se listan sus tiros). Los filtros se combinan. · (US-5) (Esp. v2 §F-07 "Mapa de tiros filtrable por zona, cuarto y tramo de reloj"; §C-03; §A-05)
- RF-14: Los tiros sin tramo de reloj derivable (posesión incompleta, partido sin play-by-play) DEBEN contarse como "sin tramo" y excluirse cuando hay un filtro de tramo activo, nunca asignarse al tramo temprano; las posesiones con reloj reiniciado a 14 s DEBEN identificarse aparte (no existe tramo tardío en ellas). · (US-5) (Esp. v2 §A-05 "Las posesiones incompletas o con reloj no derivable quedan como NULL, nunca como tramo temprano"; "Reset de 14")
- RF-15: Sin coordenadas de tiro (partido no reprocesado), el mapa DEBE caer al modo de 3 zonas de C-03 con el aviso de reprocesar, y el filtro de zona opera sobre esas 3 zonas. · (US-5) (Arquitectura §8 `shot-chart.js` "modo 3 zonas solo si `has_coordinates` es falso")
- RF-16: En el mapa de un solo partido, el color por percentil de zona NO aplica (no hay población comparable de un partido): las zonas se muestran sin color de rendimiento y el tooltip indica la razón `contexto_no_comparable`; los 7 datos del tooltip de C-03 (tiros convertidos, intentados, FG%, eFG%, PPT, % del total, muestra) sí se muestran. · (US-5) (Esp. v2 §C-03; Arquitectura §3.6, §7.4)

**Jugada a jugada**
- RF-17: El sistema DEBE listar todos los eventos del play-by-play del partido en orden, con: período, reloj de partido (MM:SS), equipo, jugador, tipo de evento en español, resultado (convertido/fallado cuando aplica) y marcador corrido tras el evento. · (US-6) (Esp. v2 §F-07 "Jugada a jugada")
- RF-18: El jugada a jugada DEBE poder filtrarse por jugador (cualquiera de los dos equipos), por tipo de evento (grupos: tiro de campo, tiro libre, rebote, asistencia, pérdida, robo, tapón, falta, cambio, tiempo muerto, otros) —selección múltiple— y por período (1–4, prórroga); los filtros se combinan y la vista indica cuántos eventos quedan. · (US-6) (Esp. v2 §F-07 "con filtros por jugador, tipo de evento y período")
- RF-19: Un partido sin play-by-play DEBE mostrar el jugada a jugada vacío con la indicación de reimportar, sin romper el resto de la vista. · (US-6) (docs/api.md §`GET /api/pbp/<game_id>` copy existente; Esp. v2 §C-11)

**Quintetos y emparejamientos**
- RF-20: El sistema DEBE mostrar, por equipo, todos los quintetos usados en el partido con el conjunto estándar de T-05 (entidad quinteto) calculado sobre ese partido, minutos y posesiones, badge de muestra de T-02 y valor ajustado con banda en OER/DER/Net Rating, en tabla completa T-06. · (US-7) (Esp. v2 §F-07 "Quintetos utilizados en el partido"; §T-02; §T-05)
- RF-21: El sistema DEBE mostrar la tabla de emparejamientos del partido en tres niveles —quinteto vs quinteto, jugador vs jugador, jugador vs quinteto (en ambos sentidos)—: para cada cruce que coincidió en cancha, minutos compartidos, posesiones de cada lado, puntos a favor y en contra, Net Rating, eFG% y TS% de cada lado, TO% y OR% del tramo, y el conjunto estándar completo de la entidad emparejamiento. · (US-7) (Esp. v2 §F-07 "tabla de matchups contra los quintetos rivales"; §F-03 tabla de niveles; §T-05 "emparejamiento")
- RF-22: En el nivel jugador vs jugador, cada fila DEBE incluir además el +/- del tramo y la producción individual de cada uno mientras coincidieron (PTS, T2c/T2i, T3c/T3i, TLc/TLi, RO, RD, AS, PER). · (US-7) (Esp. v2 §F-03 Emparejamientos, nivel "Jugador vs jugador")
- RF-23: Todo emparejamiento con posesiones por debajo del mínimo de emparejamiento de T-02 (default 8) DEBE mostrarse en gris con el badge de muestra baja y la banda de error visible; los cruces que nunca coincidieron no se listan como fila con ceros (la ausencia se muestra como "sin datos" en la vista matricial). · (US-7) (Esp. v2 §T-02 tabla "Emparejamiento quinteto vs quinteto · 8 · 25"; §F-03 "Cruces sin antecedentes […] nunca como cero")
- RF-24: El módulo DEBE nombrarse y presentarse como **coincidencia en cancha**, nunca como "marcaje": FIBA no registra la asignación defensiva. · (US-7) (Esp. v2 §F-03 "Advertencia técnica")

**Exportación**
- RF-25: Toda tabla de la vista (jugadores, quintetos, emparejamientos, parciales, jugada a jugada filtrado) DEBE ofrecer el menú de exportación de T-06 (CSV, XLSX, PNG, PDF) con los metadatos del partido en la cabecera (partido, fecha, competencia y temporada, filtros aplicados, fecha de generación, usuario) y nombre de archivo autogenerado. · (US-8) (Esp. v2 §F-07 "Exportación a CSV"; §T-06)
- RF-26: El sistema DEBE generar un **informe de scouting** del partido en formato imprimible A4 (PDF por impresión del navegador) que reúna: encabezado, box de equipos con conjunto estándar resumido, parciales con ratings, línea de tiempo, mapa de tiros de cada equipo, top de jugadores por eficiencia y los 5 emparejamientos quinteto vs quinteto de más posesiones. · (US-8) (Esp. v2 §F-07 "informe de scouting"; Arquitectura §3.11)

**Componente reutilizable**
- RF-27: La vista DEBE construirse como un componente de partido único que recibe los datos del partido y un modo ("analizar" o "vivo"), de forma que En vivo (F-01), Momentum (F-02) y Preparar (F-03) reutilicen sus bloques cambiando solo la fuente de datos. · (US-9) (Esp. v2 §1.3 S5 "Los cuatro modos comparten el mismo componente de partido")
- RF-28: Los cálculos del partido (conjunto estándar, parciales, línea de tiempo, zonas, emparejamientos) DEBEN hacerse en el backend on-the-fly, sin persistir resultados. · (US-9) (Constitución 3 y 4; Arquitectura §3.9, DA-37)

**Nulos y casos borde**
- RF-29: Toda métrica no calculable DEBE mostrarse como nulo con su razón (`sin_intentos`, `sin_pbp`, `requiere_posesiones`, `no_registrado`, `sin_coordenadas`, `dnp`, `no_aplica`, `contexto_no_comparable`); ninguna se reemplaza por 0 ni se omite. · (Esp. v2 §C-11; Arquitectura §7.4)

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| `games` (+ `competition_id`, `minutes`, `source_url` de F-11) | encabezado, prórrogas | existe / columnas F-11 |
| `team_game_stats` (+ `period_pts`, `team_orb`, `team_drb`, `team_tov`, `blk_received`, `fouls_drawn` de F-11) | box oficial, parciales, conciliación | existe / columnas F-11 |
| `player_game_stats` (+ `player_id` de C-08, `blk_received`, `fouls_drawn` de F-11) | box por jugador | existe / columnas F-11, C-08 |
| `shots` (+ `court_x`, `court_y` de F-11) | mapa de tiros | existe / columnas F-11 |
| `pbp_events` (+ `previous_action`, `qualifiers` de F-11) | jugada a jugada, línea de tiempo, ratings por período, quintetos, emparejamientos | existe / columnas F-11 |
| `GET /api/game/<game_id>` | partido completo: `{game, box, players, partials, timeline, lineups, standard}` (acepta `base`) | **NUEVO** (Arquitectura §6, dueño F-07) |
| `GET /api/game/<game_id>/pbp` | jugada a jugada filtrable (`player`, `type`, `period`) | **NUEVO** (Arquitectura §6) |
| `GET /api/game/<game_id>/matchups` | emparejamientos del partido (`level`) | **NUEVO** (Arquitectura §6) |
| `GET /api/game/<game_id>/shots` | zonas y tiros del partido filtrados (`team`, `player`, `quarter`, `clock`, `zone`) | **NUEVO** — PROPUESTA (no está en 00-arquitectura-transversal.md): se necesita porque la agregación por zona filtrada es cálculo (regla 4) y `/api/shot-zones` (C-03) no admite partido |
| `GET /api/table/<table_id>` con ids `matchups_quinteto`, `matchups_jugador`, `matchups_jugador_quinteto` (parámetro `game`) | tablas completas exportables | **NUEVO** (T-06; ids dueño F-07, Arquitectura §6) |
| `GET /api/table/game_players`, `GET /api/table/game_lineups` | box por jugador y quintetos del partido | **NUEVO** — PROPUESTA (ids no listados en Arquitectura §6) |
| `GET /api/metrics/matchup?id=…` | conjunto estándar de un emparejamiento | **NUEVO** (tipo de entidad `matchup`, dueño F-07, Arquitectura §6) |
| Clave de configuración `game.run_min_points` | mínimo de puntos de una racha destacada (default 8) | **NUEVO** — PROPUESTA (no está en Arquitectura §3.2) |

Sin tablas ni columnas nuevas (Arquitectura §5: F-07 sin cambios de esquema). Errores: `404 no_encontrado` ("Partido no encontrado"), `404 sin_pbp` en `…/pbp` ("Partido sin play-by-play. Reimportá el partido."), `400 parametro_invalido` (filtro desconocido).

## 6. Estados de UI

Vista: S5 Partido · modo Analizar (`#/partido/<game_id>/analizar`). Copy nuevo (marcar para `docs/frontend.md`), siempre vía `t()`.

| Bloque | loading | vacío / sin datos | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Vista completa | spinner "Cargando partido…" | — | 404: "Partido no encontrado. Volvé al catálogo." · otro: "No se pudo cargar el partido." | "Sin conexión: el análisis del partido necesita conexión." (`/api/*` siempre a red) | encabezado + pestañas internas de bloques |
| Encabezado | (con la vista) | — | — | — | marcador, fecha, competencia, prórrogas ("1 prórroga" / "2 prórrogas"); chips de estado: "Sin play-by-play", "Sin coordenadas de tiro", "Necesita reproceso" |
| Aviso de conciliación | — | (oculto si todo coincide) | — | — | "Los totales de este partido no coinciden con el box oficial: {detalle}. Revisalo en Calidad de datos." |
| Box score | skeleton de tabla | — | — | — | tablas por equipo; fila "No jugó" en gris para DNP |
| Parciales y ratings | — | ratings: "—" con razón "Sin play-by-play" | — | — | tabla períodos × equipos |
| Línea de tiempo | spinner en el gráfico | "Sin play-by-play: no se puede dibujar la línea de tiempo. Reimportá el partido." | — | — | gráfico + lista de rachas "Parcial 10-0 de {equipo} (3.er cuarto, 6:12–3:40)" |
| Mapa de tiros | spinner | "Sin tiros registrados con estos filtros." · sin coordenadas: "Este partido no tiene coordenadas de tiro: se muestra el mapa de 3 zonas. Reprocesalo desde Datos → Calidad." | "No se pudo cargar el mapa de tiros." | idem vista | mapa + chips de filtro (Cuarto · Tramo de reloj) + lista de tiros de la zona elegida; nota "Tiros sin tramo de reloj: {n}" |
| Jugada a jugada | spinner | con filtros sin resultado: "Ningún evento con estos filtros." · sin pbp: "Partido sin play-by-play. Reimportá el partido." (copy existente de `docs/api.md`) | "No se pudo cargar el jugada a jugada." | idem | lista + contador "{n} de {total} eventos" + botón "Limpiar filtros" |
| Quintetos | spinner | "Sin play-by-play: no se pueden reconstruir los quintetos." | — | — | tabla T-06 por equipo con badge de muestra |
| Coincidencia en cancha | spinner | "Sin play-by-play: no se pueden calcular los cruces." · celda sin cruce: "Sin datos" | "No se pudieron calcular los cruces." | idem | selector de nivel (Quinteto vs quinteto · Jugador vs jugador · Jugador vs quinteto) + tabla; leyenda fija: "Coincidencia en cancha: FIBA no registra quién marca a quién; se mide el rendimiento mientras ambos estuvieron en cancha." |
| Exportar / Informe | "Generando informe…" | — | "No se pudo generar el archivo." | CSV/PNG/PDF funcionan sin red (cliente); XLSX: "La exportación a XLSX necesita conexión." | descarga / diálogo de impresión |

Mobile (<768 px): bloques apilados como pestañas internas horizontales con scroll (Resumen · Box · Tiros · Jugadas · Quintetos · Cruces); tablas con primera columna fija; filtros como chips en una fila con scroll.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: Given cualquier partido del catálogo, When lo abro en S5 · Analizar, Then la vista carga y sus totales coinciden con el box score oficial. Verificación concreta: para cada uno de los 13 partidos del seed reprocesados, PTS de cada equipo = marcador final; Σ jugadores (+ rebotes y pérdidas de equipo) = total de equipo en cada conteo del box; Σ parciales = PTS; marcador final de la línea de tiempo = marcador final.
- CA-2 **(CA del cliente)**: Given la vista Analizar construida, When se implementa F-01, Then el modo En vivo reutiliza el mismo componente de partido cambiando solo la fuente de datos (verificable: el componente acepta `mode: "vivo"` y renderiza los mismos bloques con un payload del mismo shape).
- CA-3: Given la fila de un partido en el catálogo, en el game log de Equipo o en el game log de Jugador, When la toco, Then se abre `#/partido/<game_id>/analizar` y recargar esa URL reproduce la misma vista.
- CA-4: Given un partido con prórroga (2 de los 13 del seed), When abro la línea de tiempo, Then el eje llega a 2400 + 300 × prórrogas segundos, los parciales muestran una fila por prórroga y el encabezado indica la cantidad de prórrogas.
- CA-5: Given un partido con play-by-play, When filtro el jugada a jugada por un jugador, el tipo "Tiro de campo" y el 3.er cuarto, Then solo aparecen tiros de campo de ese jugador en el 3.er cuarto y el contador coincide con la cantidad de filas.
- CA-6: Given el mapa de tiros de un equipo, When aplico cuarto = 2 y tramo = tardío, Then los intentos totales del mapa = cantidad de tiros de campo del equipo en el 2.º cuarto con tramo tardío en el jugada a jugada, y los tiros "sin tramo" se informan aparte (nunca como temprano).
- CA-7: Given el mapa sin filtros, When sumo los intentos de todas las zonas, Then la suma = TCi oficial del equipo en el partido.
- CA-8: Given la tabla de emparejamientos quinteto vs quinteto de un partido, When la ordeno, Then toda fila con menos de `sample.matchup.min` posesiones se ve en gris con badge "Baja" y banda visible, y la suma de posesiones de todas las filas de un equipo = posesiones totales de ese equipo en el partido reconstruidas por segmentos (± redondeo).
- CA-9: Given un emparejamiento cualquiera, When consulto `GET /api/metrics/matchup?id=…`, Then devuelve exactamente los mismos grupos de métricas que un quinteto y un jugador (CA de T-05 para la entidad emparejamiento).
- CA-10: Given un partido sin play-by-play, When lo abro, Then encabezado, box y parciales (desde el dato oficial) se muestran; línea de tiempo, jugada a jugada, quintetos, cruces y ratings por período muestran su estado vacío con la indicación de reimportar; ninguna métrica aparece como 0 en lugar de nulo.
- CA-11: Given un jugador que no jugó (DNP), When veo el box, Then su fila dice "No jugó", sus tasas son "—" con razón `dnp` y no suma minutos.
- CA-12: Given cualquier tabla de la vista, When la exporto a CSV y a XLSX, Then el archivo contiene las mismas filas, columnas visibles y orden que la pantalla y la cabecera documenta partido, competencia, temporada, filtros y fecha de generación.
- CA-13: Given un partido, When pido "Informe de scouting", Then se abre la vista de impresión A4 con encabezado, box resumido, parciales, línea de tiempo, mapas de tiro y top 5 de cruces, legible en papel sin abrir la app.
- CA-14: Given la sección de cruces, When la recorro, Then en ningún texto aparece la palabra "marcaje" y la leyenda de "coincidencia en cancha" está visible.
- CA-15: Given `GET /api/game/<id>` con un `game_id` inexistente, When lo llamo, Then responde 404 `{"error": "Partido no encontrado", "code": "no_encontrado"}`; y `GET /api/game/<id>/pbp?type=xyz` responde 400 `parametro_invalido`.
- CA-16: Given una racha de 8 o más puntos sin respuesta en un partido, When veo la línea de tiempo, Then aparece destacada; y al cambiar `game.run_min_points` a 12 en Configuración, las rachas de 8–11 dejan de destacarse en la próxima carga.

## 8. Fuera de alcance
- Modo En vivo (F-01), Momentum (F-02) y Preparar (F-03): solo se deja el componente listo para ellos.
- Video o sincronización con video.
- Edición o corrección manual del play-by-play (los errores se reportan en Calidad de datos, F-11).
- Asignación defensiva / marcaje individual (FIBA no lo registra).
- Percentiles de un partido contra otros partidos (ranking de partidos): no pedido.
- Barra de contexto T-03 en esta vista: un partido es un contexto cerrado; los filtros propios (cuarto, tramo, jugador, tipo) son locales a la vista.
- INCREMENTO DIFERIDO (→ F-12): abrir el partido desde el calendario de S8 (la fila de `fixtures` con `game_id` enlaza a esta vista cuando F-12 exista).
- INCREMENTO DIFERIDO (→ A-08, A-11): consumo de `matchups.py` para sinergias y stints de RAPM (lo implementan esos requisitos).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] "Totales coinciden con el box score oficial": se toma como box oficial el de FIBA persistido en `team_game_stats`/`player_game_stats`; la vista **muestra** esos conteos y compara contra ellos lo derivado del pbp (parciales, línea de tiempo, quintetos). Las discrepancias pbp↔box (que existen en FIBA en pocos casos) se avisan, no se corrigen.
- [DECISIÓN PROPUESTA — confirmar] "Parciales" en la línea de tiempo = rachas de anotación sin respuesta, con mínimo configurable `game.run_min_points` (default 8, criterio habitual de "parcial 8-0"); "parciales por cuarto" = puntos por período. Ambos se muestran.
- [DECISIÓN PROPUESTA — confirmar] En un solo partido no hay percentiles de zona ni de métricas (no hay población de "partidos" definida por T-01): las fichas muestran solo valor y razón `contexto_no_comparable` en percentil. El contexto de temporada lo da el modo Preparar (F-03).
- [DECISIÓN PROPUESTA — confirmar] Informe de scouting = vista de impresión A4 (1–2 páginas) generada en el cliente por impresión del navegador (DA-19); no hay PDF en servidor.
- [DECISIÓN PROPUESTA — confirmar] Grupos de tipo de evento del filtro: tiro de campo (`2pt`,`3pt`), tiro libre (`freethrow`), rebote, asistencia, pérdida, robo, tapón, falta (`foul`,`foulon`), cambio (`substitution`), tiempo muerto (`timeout`), otros (`period`, `game`, `jumpball`, `headcoachchallenge`).
- [DECISIÓN PROPUESTA — confirmar] Base T-04 en esta vista: se ofrece solo en el box de jugadores (`total` = `partido` para un partido; `por40` y `por100` útiles para comparar jugadores con distintos minutos).
