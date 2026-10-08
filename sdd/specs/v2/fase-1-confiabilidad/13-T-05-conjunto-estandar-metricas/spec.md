# Spec — T-05: Conjunto estándar de métricas — regla de completitud

> **ID:** T-05 · **Prioridad:** P0 · **Fase y orden:** Fase 1 · 13
> **Depende de:** C-01 ([../09-C-01-rebotes-distribucion-jugador/spec.md](../09-C-01-rebotes-distribucion-jugador/spec.md)) · C-04 ([../08-C-04-as-per/spec.md](../08-C-04-as-per/spec.md)) · C-07 ([../10-C-07-detalle-tiro-completo/spec.md](../10-C-07-detalle-tiro-completo/spec.md)) · C-11 ([../01-C-11-tratamiento-de-nulos/spec.md](../01-C-11-tratamiento-de-nulos/spec.md)) · F-11 ([../02-F-11-calidad-datos-competencias/spec.md](../02-F-11-calidad-datos-competencias/spec.md)) · C-08 ([../07-C-08-jugadores-duplicados/spec.md](../07-C-08-jugadores-duplicados/spec.md), ver §9 y desacuerdo con la arquitectura §9.1) · C-02 ([../11-C-02-promedios-de-liga/spec.md](../11-C-02-promedios-de-liga/spec.md), contexto `competition`/`last`)
> **Habilita:** T-02 ([../14-T-02-confiabilidad-muestra/spec.md](../14-T-02-confiabilidad-muestra/spec.md)), T-01 ([../15-T-01-ficha-de-metrica/spec.md](../15-T-01-ficha-de-metrica/spec.md)), T-06 ([../16-T-06-tablas-completas-exportacion/spec.md](../16-T-06-tablas-completas-exportacion/spec.md)), T-04, F-06, F-05, F-08, F-18, F-07, A-01, A-12
> **Estado:** ✅ Aprobado — defaults de arquitectura confirmados (§9)
> **Fuente:** Especificación v2 §3 · T-05 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §2.1, §2.2, §2.3, §3.5, §7.3, §7.4 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (T-05, literal resumido).** "Regla general de la aplicación: ningún apartado puede mostrar un subconjunto
arbitrario de métricas. Toda entidad analizable devuelve el conjunto completo. Hoy los quintetos y el ON/OFF muestran cuatro o
cinco indicadores sueltos y quedan sin eFG%, FG2%, FG3%, TS%, uso de triple, tiros libres o rebote; eso obliga a salir de la
pantalla para completar la lectura y hace la información inutilizable para decidir." El conjunto "se define una sola vez en el
backend y se reutiliza. No debe haber una lista de métricas distinta por pantalla". Si una métrica no puede calcularse "se
muestra como nulo con la razón, nunca se omite de la tabla ni se sustituye por cero (C-11)".

**Qué existe HOY (verificado en el código de la rama `v2`).**
- No hay lista única. Cada pantalla arma la suya:
  - Equipo: `stats_engine.calc_team_stats` (`backend/stats_engine.py`, 49 claves por partido) promediadas en `app.team_stats`
    con una lista `keys` propia; la vista pinta 6 cards con `statBox(...)` (`frontend/js/app.js` `_renderTeamContent`).
  - Jugador: `stats_engine.calc_player_stats` + lista `keys` distinta en `app.player_stats`; otra lista de cards en `_renderPlayerContent`.
  - Combinación (`GET /api/lineup/<team>`): `lineups.lineup_stats` devuelve solo `metrics{oer, der, net_rating, efg_pct, ts_pct}`
    + `raw{pts, pts_against, fga, fgm, fga3, fgm3, fta, ftm, orb, drb, reb, ast, tov, stl, blk}`; la UI (`renderTeamLineup`)
    pinta 5 `statBox` y una tabla de 18 columnas. Faltan FG2%, FG3%, FT%, PPT, uso de triple, AS/PER, OR%, DR%, TO%, faltas, etc.
  - ON/OFF (`GET /api/onoff/<team>/<jugador>`): `lineups.onoff_stats` → `on/off{possessions, seconds, pts_for, pts_against, reb,
    orb, drb, ast, tov, stl, blk, oer, der, net_rating, efg_pct, ts_pct}`; la UI (`renderTeamOnOff`) pinta 5 tasas + 7 conteos.
  - Cierres (`GET /api/clutch/<team>`): `clutch.team_clutch` → `aggregate{pts_for, pts_against, point_diff, reb, ast, tov, stl, blk,
    fouls_committed, fouls_drawn, off_rating, def_rating, efg_pct, ts_pct, possessions}`; la UI (`renderTeamClutch`) pinta ~10 cajas.
- Nomenclatura distinta para lo mismo: `off_rating`/`oer`, `def_rating`/`der`, `pts_for`/`pts`, `reb`/`trb`, `point_diff`/
  `plus_minus`, `fouls_committed`/`pf`, `stocks`/`stops` (mapeo en arquitectura §3.5 "Compatibilidad").
- Fórmulas duplicadas: `lineups._pos/_metrics`, `clutch._pos/_box_metrics` y `stats_engine.possessions/calc_team_stats` calculan
  lo mismo por separado.
- Hay tasas de equipo que se promedian por partido (`app.team_stats._avg`, `app.league_overview._avg`): una tasa de selección no es
  el cociente de totales (política pooled, arquitectura §2.1, DA-02). El AS/PER (C-04: `stats_engine.season_ast_to`) y el DEF/TO
  (C-11: `season_def_to_ratio`) ya son pooled.
- Datos: `team_game_stats`/`player_game_stats` NO tienen tapones recibidos ni faltas recibidas. Se verificó sobre los 13 partidos del
  seed archivados en `game_sources` (26 filas de equipo y 312 de jugador): FIBA publica `tot_sBlocksReceived` / `tot_sFoulsOn` (equipo)
  y `sBlocksReceived` / `sFoulsOn` (jugador) en el 100 % de las filas y no se persisten (`fiba_fetcher._parse_fiba_json`). El conteo de
  eventos `foulon` del equipo en el pbp coincide con `tot_sFoulsOn` en 26/26 equipo-partido, y los eventos `block` del rival coinciden con
  `tot_sBlocksReceived` en 26/26. Las faltas cometidas del box (`pf` = `tot_sFoulsPersonal`) coinciden en 26/26 con los eventos `foul`
  que no son técnicas de banco ni de entrenador (`benchTechnical`, `coachTechnical`).
- `games.minutes` ya es 40 + 5 × prórrogas (F-11) y `lineups.PERIOD_LEN` ya usa `OVERTIME` (F-11): los minutos de equipo y los segundos
  de tramo son confiables. El pbp y los segmentos de quinteto ya existen (`lineups.build_segments`, Features 03/04).
- Lo que resolvieron features anteriores: nulos y razones (`stats_engine.null_reason(s)`, `core/format.js`, Feature 12/C-11); `as_pos`,
  `tov_pos`, `orb_min`, `drb_min`, OR%/DR%/TRB% individuales por minutos (Feature 15/C-01); AS/PER acumulado (C-04); `ppt_2/3/ft` y
  totales de tiro (Feature 16/C-07). Lo que **no** resolvieron: una lista única, la misma cobertura en quinteto/ON-OFF/cierre, tapones
  y faltas recibidas, segundos por posesión, USO 2P/3P, reparto por zona, y la definición común de DER/Net/USO% de jugador.
- Con el seed (13 partidos, 14 equipos, 2 partidos por equipo salvo dos con 1, 187 jugadores) hay datos suficientes para verificar
  fórmulas e invariantes; no alcanzan para percentiles (eso es T-01).

**Qué queda para después** (ver §8): percentil/ranking/badge por métrica (T-01/T-02), bases por 40 y por 100 (T-04), tablas (T-06),
reparto por zona (C-03), pareja/emparejamiento/cuarto/split/origen/tramo de reloj/zona/cadena (cada dueño registra su tipo).

## 1. Objetivo
Definir una sola vez, en el backend, el conjunto estándar de métricas (catálogo y fórmulas) y entregarlo completo, con las mismas
claves y los mismos grupos, para equipo, jugador, quinteto, ON/OFF y cierre de partido, de modo que ningún apartado muestre un
subconjunto arbitrario ni un cero que sea un dato inexistente.

## 2. Fuentes (trazabilidad)
- Especificación v2: §3 T-05 (conjunto estándar, tabla de grupos, reglas), §3 T-04 (bases), §3 T-01/T-02 (percentil y badge, diferidos), §2 C-11
  (nulos), §6 glosario de métricas ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)).
- Arquitectura: §2.1 (política pooled), §2.2 (conciliación DA-03…DA-07, DA-34), §2.3 (calculabilidad), §3.5 (módulos, `StatBundle`, claves
  definitivas), §3.8 (base T-04, parámetros de contexto), §7.3 (shape del conjunto estándar), §7.4 (códigos de nulo), §9.2 I-09
  ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md)).
- `docs/metrics.md` §Posesiones, §Eficiencia, §Tiro, §Rebotes, §Pérdidas y asistencias, §Impacto defensivo, §Impacto físico, §USO%,
  §PACE; `docs/api.md` §Equipo, §Jugador, §Lineups, §ON/OFF, §Clutch, §"Nulos con razón"; `docs/database.md` §`team_game_stats`,
  §`player_game_stats`, §`pbp_events`; `docs/frontend.md` §Equipo, §Jugador, §Lineups, §ON/OFF, §Cierres.
- Decisiones humanas: [../../00-decisiones.md](../../00-decisiones.md) (DA-02, DA-07, DA-36 resueltas; DA-03…DA-06, DA-34 con el default de la arquitectura).
- Specs previos: `sdd/specs/03-lineups`, `04-on-off`, `05-clutch`, `08-nulos-vs-cero`, `11-mas-stats-lineup-comparar`; `sdd/specs/15-metricas-jugador`
  (C-01/C-04) y `16-*` (C-07) integradas desde `dev` por C-11.

## 3. Historias de usuario
- US-1: Como entrenador, quiero que un quinteto, un jugador, un equipo, un ON/OFF y un cierre muestren las mismas métricas con los mismos
  nombres, para leer cualquier apartado sin salir de la pantalla a completar datos.
- US-2: Como analista, quiero que una métrica que no se puede calcular aparezca como "—" con su razón (sin intentos, sin play-by-play, no
  aplica, dato no registrado), para distinguir un dato faltante de un cero real.
- US-3: Como analista, quiero una sola definición de cada métrica (nombre y fórmula del glosario), para que "TO%" o "USO%" signifiquen lo
  mismo en toda la app.
- US-4: Como entrenador, quiero ver el conjunto en totales y por partido, para comparar muestras de distinto tamaño.
- US-5: Como administrador, quiero saber qué partidos necesitan reprocesarse para completar tapones y faltas recibidas, para que el
  conjunto no quede con huecos de datos.
- US-6: Como equipo de producto, quiero que toda entidad nueva (pareja, emparejamiento, cuarto, split, origen, tramo de reloj, zona,
  cadena de evento) adopte el mismo conjunto al construirse, para que el próximo apartado no vuelva a quedar incompleto.

## 4. Requisitos funcionales
- **RF-1 — Catálogo único.** El sistema DEBE definir el conjunto estándar en un único lugar del backend, con, para cada métrica:
  clave, etiqueta en español, grupo, formato de presentación, dirección (más es mejor / menos es mejor / sin color de rendimiento),
  tipo (conteo, tasa o volumen), comportamiento en las bases de normalización, fuente de datos, entidades a las que aplica y claves
  legado equivalentes; y DEBE exponerlo por API para que el frontend no mantenga listas propias. (US-3, US-6) (Esp. v2 §3 T-05; Arq. §3.5)
- **RF-2 — Mismos grupos, mismas claves.** Para equipo, jugador, quinteto, ON/OFF y cierre, el sistema DEBE devolver todas las métricas
  del catálogo, en los mismos grupos y con las mismas claves y etiquetas; una métrica que no aplica o no puede calcularse DEBE
  devolverse igual, como nulo con razón, y NUNCA omitirse. (US-1, US-2) (Esp. v2 §3 T-05 "no se omite"; Arq. §7.3)
- **RF-3 — Nulos con razón.** Toda métrica no calculable DEBE devolver `value = null` y un `reason` de este conjunto: `sin_intentos`
  (denominador 0), `sin_perdidas` (AS/PER o DEF/TO con 0 pérdidas), `sin_pbp` (la selección no tiene play-by-play para esa métrica),
  `no_registrado` (el dato no fue importado todavía o la competencia no lo publica), `no_aplica` (la métrica no aplica a la entidad),
  `sin_datos` (la entidad no tiene partidos en la selección) y `no_disponible` (métrica definida pero que se habilita con un requisito
  posterior). Un nulo NUNCA entra en una suma, un denominador ni un promedio, y NUNCA se muestra como 0. (US-2) (Esp. v2 §2 C-11; Arq. §7.4)
- **RF-4 — Política pooled y fórmulas del glosario.** Toda tasa de una selección de varios partidos o tramos DEBE calcularse como
  cociente de totales (Σnumerador / Σdenominador), no como promedio de las tasas por partido (DA-02). Las fórmulas son las que se copian
  en RF-5 a RF-12 (tomadas de [../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md) §6 y de Arq. §2.2/§3.5). (US-3)
- **RF-5 — Volumen.** El conjunto DEBE incluir `games`, `minutes`, `possessions`, `pace` y `sec_per_poss`. Posesión =
  `T2i + T3i − RO + PER + 0,44 × TLi`. PACE = posesiones por 40 minutos, con minutos reales (40 + 5 × prórrogas). Segundos por posesión
  = segundos de juego / (posesiones propias + posesiones del rival). (US-1) (Esp. v2 §3 T-05 Volumen; docs/metrics.md §PACE)
- **RF-6 — Producción.** El conjunto DEBE incluir `pts`, `pts_against`, `ppp`, `oer`, `der`, `net_rating` y `plus_minus`. OER = puntos
  anotados / posesiones propias; DER = puntos recibidos / posesiones del rival; Net Rating = OER − DER; PPP = puntos / posesiones; `plus_minus`
  = puntos a favor − puntos en contra (equipo, quinteto, ON/OFF, cierre) o la suma del +/- de FIBA (jugador). (US-1) (Esp. v2 §6)
- **RF-7 — Tiro.** El conjunto DEBE incluir intentos y aciertos (`fga2`, `fgm2`, `fga3`, `fgm3`, `fta`, `ftm`, `fga`, `fgm`), porcentajes
  (`fg_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `efg_pct`, `ts_pct`), valor por tiro (`ppt`, `ppt_2`, `ppt_3`, `ppt_ft`) y perfil (`fg3_uso`,
  `fg2_uso`, `ft_rate`, `paint_fga_share`, `mid_fga_share`). PPT = puntos de tiros de campo / TCi (DA-03); eFG% = `(T2c + T3c + 0,5 × T3c) / (T2i + T3i)`
  (equivalente a `(FGM + 0,5 × 3PM) / FGA`); TS% = `Puntos / (2 × (T2i + T3i + 0,44 × TLi))`; FT Rate = TLi / TCi; uso de triple = T3i / TCi. (US-1) (Esp. v2 §6)
- **RF-8 — Balón.** El conjunto DEBE incluir `ast`, `tov`, `ast_to`, `as_pos`, `as_pct` y `to_pct`. AS/PER = ΣAS / ΣPER (nulo `sin_perdidas` si ΣPER = 0);
  AS/pos = AS / posesiones propias (jugador: posesiones propias del jugador, con −RO); TO% = pérdidas / posesiones en equipo, quinteto, ON/OFF y
  cierre (DA-04) y pérdidas / (TCi + 0,44 × TLi + PER) en jugador; AS% = AS / TCc en equipo, quinteto, ON/OFF y cierre, y
  `AS / ((min_jug / (min_equipo / 5)) × TCc_equipo − TCc_jug)` en jugador (DA-06). (US-1, US-3) (Esp. v2 §3 T-05 Balón; Arq. §2.2)
- **RF-9 — Rebote.** El conjunto DEBE incluir `orb`, `drb`, `trb`, `or_pct`, `dr_pct`, `trb_pct`, `orb_pos`, `drb_min`, `orb_min`. OR% = RO propios /
  (RO propios + RD del rival); DR% = RD propios / (RD propios + RO del rival); REB% = REB / (REB + REB del rival); RO/pos = RO / posesiones;
  RO/min y RD/min por minuto. En jugador, OR%/DR%/REB% usan la fórmula individual por minutos de la Feature 15. (US-1) (Esp. v2 §6; docs/metrics.md §Rebotes)
- **RF-10 — Defensa.** El conjunto DEBE incluir `stl`, `blk`, `blk_received` (tapones recibidos), `stops` (robos + tapones) y los puntos recibidos
  (`pts_against`, RF-6). (US-1) (Esp. v2 §3 T-05 Defensa)
- **RF-11 — Faltas.** El conjunto DEBE incluir `pf` (faltas cometidas) y `fouls_drawn` (faltas recibidas). (US-1) (Esp. v2 §3 T-05 Faltas)
- **RF-12 — Uso e impacto.** Para jugador, el conjunto DEBE incluir `uso_pct`, `uso_2p` y `uso_3p` "con el jugador en cancha":
  USO% = posesiones terminadas por el jugador / posesiones del equipo con el jugador en cancha, calculado por minutos (DA-05):
  `PLAYS_jug × (min_equipo / 5) / (min_jug × PLAYS_equipo)` con `PLAYS = TCi + 0,44 × TLi + PER`; USO 2P y USO 3P con la misma estructura sobre T2i y T3i.
  Para las demás entidades estas tres métricas DEBEN devolverse nulas con razón `no_aplica`. (US-1) (Esp. v2 §6 USO%; Arq. §2.2)
- **RF-13 — Datos nuevos de FIBA.** El sistema DEBE persistir tapones recibidos y faltas recibidas por equipo-partido y por jugador-partido
  (FIBA los publica y hoy se descartan), sin valor por defecto (nulo = "no importado todavía"), y DEBE poder completarlos en los partidos
  ya cargados reprocesándolos desde el archivo crudo de F-11. Mientras un partido de la selección no tenga el dato, la métrica devuelve nulo
  `no_registrado` (nunca una suma parcial). Para quinteto, ON/OFF y cierre se derivan del play-by-play (`foulon` del equipo; `block` del rival). (US-5)
  (Esp. v2 §3 T-05 "si no puede calcularse… nulo con la razón"; Arq. §1.1, §5)
- **RF-14 — Jugador: en cancha y estimaciones.** Para jugador, las métricas "con el jugador en cancha" (`possessions` de volumen, `pace`,
  `sec_per_poss`, `pts_against`, `der`, `net_rating`, `orb_pos`) DEBEN calcularse con los segmentos de quinteto del play-by-play; si un partido
  no tiene play-by-play, `possessions` y `orb_pos` DEBEN estimarse por fracción de minutos y marcarse como estimadas, y las demás DEBEN ser
  nulas `sin_pbp` si ningún partido de la selección tiene play-by-play, o marcarse parciales si solo algunos lo tienen (DA-34, Arq. §2.1). (US-1, US-2)
- **RF-15 — Bases total y por partido.** El conjunto DEBE poder pedirse en base `total` o `partido` (conteos y volumen ÷ partidos jugados; las
  tasas, porcentajes, ratios, `games`, `pace` y `sec_per_poss` nunca se escalan). Las bases por 40 minutos y por 100 posesiones NO se ofrecen en esta
  fase (las agrega T-04); pedirlas DEBE devolver un error claro. (US-4) (Esp. v2 §3 T-04, T-05; Arq. §3.8)
- **RF-16 — Misma selección que la pantalla.** El conjunto DEBE calcularse sobre la selección activa de la pantalla (competencia y, en esta fase,
  últimos N partidos), y la respuesta DEBE informar qué selección usó (competencia, partidos usados y excluidos). (US-1) (Arq. §3.8, §7.5)
- **RF-17 — Presentación común.** Las pantallas Equipo, Jugador, Combinación, ON/OFF y Cierres DEBEN mostrar el conjunto completo agrupado por los
  mismos grupos, con las etiquetas del catálogo, formato numérico es-UY y nulos como "—" con su razón; ninguna de ellas DEBE conservar una lista
  de métricas propia para el conjunto estándar. (US-1, US-2) (Esp. v2 §3 T-05; DA-36)
- **RF-18 — Compatibilidad.** Las respuestas actuales de `/api/team`, `/api/player`, `/api/lineup`, `/api/onoff` y `/api/clutch` DEBEN conservar
  sus claves y su significado; el conjunto estándar se agrega como bloque nuevo. Los cambios visibles de valor por la conciliación (pooled, PPT,
  TO%, USO%, AS%) DEBEN quedar documentados. (US-3) (Arq. §3.5 "Compatibilidad", R-04)
- **RF-19 — Registro de tipos de entidad.** El sistema DEBE ofrecer un registro de tipos de entidad en el que cada dueño inscribe cómo
  arma el conjunto de su entidad. En esta fase se inscriben equipo, jugador, quinteto, ON/OFF y cierre; pareja, emparejamiento, cuarto/tramo, split,
  origen, tramo de reloj, zona y cadena de evento lo adoptan al construirse (§8). (US-6) (Arq. §3.5 "Adopción por entidad", §9.2 I-09)
- **RF-20 — Etiquetas configurables.** El sistema DEBE permitir sobrescribir la etiqueta de una métrica desde la configuración sin cambiar su clave.
  (US-3) (Arq. §3.2 `ui.metric_labels`)
- **RF-21 — Calidad de datos.** El panel de calidad de F-11 DEBE informar cuántos partidos todavía no tienen tapones y faltas recibidas, para
  guiar el reproceso. (US-5) (Arq. §5)

## 5. Requisitos de datos / API
**Esquema (NUEVO, justificado por RF-13).** Columnas con `ALTER TABLE ... ADD COLUMN` en `upgrade_db()` (idempotente), sin `DEFAULT`
(NULL = "no importado todavía", regla de columnas nuevas de C-11):

| Tabla.columna | Tipo | Default | `upgrade_db()` | Fuente FIBA |
|---|---|---|---|---|
| `team_game_stats.blk_received` | INTEGER | NULL | sí | `tm[n].tot_sBlocksReceived` |
| `team_game_stats.fouls_drawn` | INTEGER | NULL | sí | `tm[n].tot_sFoulsOn` |
| `player_game_stats.blk_received` | INTEGER | NULL | sí | `pl[k].sBlocksReceived` |
| `player_game_stats.fouls_drawn` | INTEGER | NULL | sí | `pl[k].sFoulsOn` |

Los partidos ya importados quedan "pendientes de reproceso" (sube `ingest.INGEST_VERSION`; `GET /api/data-quality` y `POST /api/reprocess` de F-11).

**Endpoints.**
- `GET /api/metrics-catalog` — NUEVO. Catálogo: `{groups, metrics{clave: {label, group, fmt, direction, kind, base_mode, rel_dist, entities, legacy_keys}}, null_reasons, version}`.
- `GET /api/metrics/<entity_type>?id=<id>[&competition=&last=&base=]` — NUEVO. `entity_type ∈ {team, player, lineup, onoff, clutch}`. Respuesta = Arq. §7.3
  (`entity`, `context`, `base`, `sample`, `groups`, `metrics`, `catalog_version`). Errores 400 (parámetro inválido, base no disponible, competencia
  inexistente), 404 (entidad no encontrada; sin play-by-play).
- `GET /api/team/<team_code>` y `GET /api/player/<team_code>/<player_name>` (y `GET /api/player/<int:player_id>` de C-08) — modificados: agregan `standard` (§7.3).
- `GET /api/lineup/<team>`, `/api/onoff/<team>/<jugador>`, `/api/clutch/<team>` — sin cambios de shape (legado).
- `GET /api/data-quality` — modificado: los cuatro campos nuevos entran en "campos nulos".

## 6. Estados de UI
Panel "Conjunto estándar" (reusado en Equipo, Jugador, Combinación, ON/OFF y Cierres). Copy NUEVO a agregar a `docs/frontend.md`:
- **Cargando:** "Calculando métricas…" (con spinner existente).
- **Vacío (sin partidos en la selección):** "Sin partidos en la selección. Cambiá el filtro de competencia o de períodos."
- **Error:** el mensaje del backend (400/404); sin play-by-play: "Sin play-by-play para esta selección. Reimportá sus partidos."
- **Sin conexión (service worker):** `/api/*` va siempre a la red; se muestra el error de red existente de la app.
- **Éxito:** grupos con títulos "Volumen", "Producción", "Tiro — intentos y aciertos", "Tiro — porcentajes", "Tiro — valor", "Tiro — perfil", "Balón",
  "Rebote", "Defensa", "Faltas", "Uso e impacto", "Otras métricas"; selector "Totales | Por partido".
- **Valor nulo:** "—" con `title` = etiqueta de la razón. Copy nuevo de razones: `sin_datos` "Sin partidos en la selección"; `sin_pbp` "Sin play-by-play
  en los partidos de la selección"; `no_aplica` "La métrica no aplica a esta entidad"; `no_disponible` "Todavía no disponible: se habilita con una versión
  posterior". Se reusan las existentes `sin_intentos`, `sin_perdidas`, `dnp`, `no_registrado` ("La competencia no registra este dato. Si cambió, reimportá sus partidos").
- **Valor estimado / parcial (jugador):** marca "est." con `title` "Estimado por minutos jugados (sin play-by-play)"; "parcial" con `title` "Calculado con {n} de {m} partidos con play-by-play".
- Móvil (< 768 px): los grupos se apilan en una columna de tarjetas con grilla de 2 columnas; el selector de base ocupa el ancho completo.

## 7. Criterios de aceptación
- **CA-1 (CA del cliente):** Given un quinteto, un jugador y un emparejamiento seleccionados; When se piden sus métricas; Then los tres devuelven exactamente los
  mismos grupos de métricas, sin huecos y sin diferencias de nomenclatura. *Verificación en esta fase:* quinteto, jugador, equipo, ON/OFF y cierre devuelven el
  mismo conjunto de grupos y de claves; el emparejamiento se verifica al registrarse su tipo (F-07, §8).
- **CA-2:** Given el catálogo; When se compara la lista de claves de `metrics` de `team`, `player`, `lineup`, `onoff` y `clutch`; Then el conjunto de claves y la lista de grupos son idénticos
  en los cinco y coinciden con `GET /api/metrics-catalog`.
- **CA-3:** Given un quinteto con ≥ 1 posesión; When se piden sus métricas; Then aparecen eFG%, FG2%, FG3%, FT%, TS%, PPT (4), uso de triple, FT Rate, AS/PER, TO%, OR%, DR%, RO/pos, tapones
  recibidos y faltas recibidas (los que hoy faltan en Combinación y ON/OFF), cada una con valor o con nulo y razón.
- **CA-4 (nulos):** Given un jugador sin pérdidas; When se piden sus métricas; Then `ast_to` es `null` con razón `sin_perdidas` y no 0 ni 99; y given un jugador con 0 triples intentados,
  `fg3_pct` es `null` con razón `sin_intentos` mientras `fgm3` es el número 0.
- **CA-5 (no aplica):** Given un quinteto; When se piden sus métricas; Then `uso_pct`, `uso_2p` y `uso_3p` están presentes con `value = null` y `reason = "no_aplica"`.
- **CA-6 (datos nuevos, antes del reproceso):** Given partidos con `ingest_version` previa; When se piden `blk_received` y `fouls_drawn` de equipo o jugador; Then son `null` con razón
  `no_registrado` y la UI los muestra "—"; y el panel de calidad lista los partidos pendientes.
- **CA-7 (datos nuevos, después del reproceso):** Given los 13 partidos del seed reprocesados; When se suma `fouls_drawn` de los jugadores de un equipo en un partido; Then es igual a `fouls_drawn` del equipo
  y a los eventos `foulon` del equipo en el pbp; y la suma de `blk_received` de los jugadores es igual a la del equipo y a los eventos `block` del rival.
- **CA-8 (pooled):** Given un equipo con ≥ 2 partidos; When se piden OER, eFG% y TO% de la selección; Then cada valor es Σnumerador / Σdenominador sobre los totales del equipo (verificable a mano con
  los totales de `/api/team`), no el promedio de las tasas por partido.
- **CA-9 (fórmulas DA-04/05/06):** Given un partido (`last=1`); When se piden las métricas de un equipo y de sus jugadores; Then TO% de equipo = PER / posesiones; la suma de `uso_pct × min_jug / (5 × minutos del partido)`
  de todos los jugadores es ≈ 1 (entre 0,97 y 1,00; la diferencia son las pérdidas de equipo); la suma de las AS de los jugadores es igual a la AS del equipo; y AS% de jugador coincide con el cálculo manual de DA-06.
- **CA-10 (ON/OFF partición):** Given un jugador con play-by-play; When se piden las métricas de ON/OFF; Then para cada conteo (`pts`, `fga`, `ast`, `tov`, `pf`, `fouls_drawn`, `blk_received`…) ON + OFF = total del equipo en los partidos usados, y los
  segundos ON + OFF = tiempo total de juego (40 min o 45 min con prórroga).
- **CA-11 (jugador estimado / sin pbp):** Given un jugador cuyos partidos no tienen play-by-play; When se piden sus métricas; Then `der`, `net_rating`, `pts_against`, `pace` y `sec_per_poss` son `null` con razón `sin_pbp`,
  `possessions` y `orb_pos` traen valor estimado con la marca de estimación, y las métricas de box (PTS, TS%, USO%…) tienen valor.
- **CA-12 (DNP):** Given un jugador con un partido sin minutos; When se piden sus métricas; Then `games` y todos los promedios excluyen ese partido.
- **CA-13 (sin partidos):** Given una entidad que existe pero cuya selección (competencia elegida) no tiene partidos; When se piden las métricas; Then la respuesta es 200 con todas las métricas nulas y razón `sin_datos` y `games = 0` en el eco de contexto; y given un id inexistente, 404 "Entidad no encontrada".
- **CA-14 (bases):** Given base `partido`; When se piden las métricas; Then los conteos y volumen son total ÷ partidos jugados y las tasas no cambian; `base=por40` o `base=por100` devuelve 400 "Base no disponible: llega con la normalización por 40 minutos y por 100 posesiones".
- **CA-15 (compatibilidad):** Given las respuestas de `/api/team`, `/api/player`, `/api/lineup`, `/api/onoff`, `/api/clutch` de antes del cambio; When se comparan con las de después (excluido el bloque `standard`); Then las claves y valores no cambian.
- **CA-16 (UI):** Given las pantallas Equipo, Jugador, Combinación, ON/OFF y Cierres; When se abren; Then cada una muestra el panel con los 12 grupos y las mismas etiquetas, y la consola no tiene errores; en 360 px no hay scroll horizontal de página.
- **CA-17 (etiquetas):** Given `ui.metric_labels = {"ppt": "Puntos por tiro"}`; When se pide el catálogo; Then la etiqueta de `ppt` cambia y su clave no.
- **CA-18 (idempotencia del esquema):** Given la base actual; When se ejecuta `upgrade_db()` dos veces; Then no hay error y las columnas existen una sola vez.

## 8. Fuera de alcance
- INCREMENTO DIFERIDO (→ T-01, [../15-T-01-ficha-de-metrica/spec.md](../15-T-01-ficha-de-metrica/spec.md)): percentil, ranking, distancias y color de cada métrica ("cada métrica se acompaña siempre de su percentil").
- INCREMENTO DIFERIDO (→ T-02, [../14-T-02-confiabilidad-muestra/spec.md](../14-T-02-confiabilidad-muestra/spec.md)): badge de muestra, valor ajustado y banda de error.
- INCREMENTO DIFERIDO (→ T-04, [../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/spec.md)): bases por 40 minutos y por 100 posesiones.
- INCREMENTO DIFERIDO (→ C-03, [../17-C-03-mapas-tiro-ppt-tooltip/spec.md](../17-C-03-mapas-tiro-ppt-tooltip/spec.md)): `paint_fga_share` y `mid_fga_share` (reparto por zona) en todas las entidades; hasta entonces son nulos `no_disponible`.
- INCREMENTO DIFERIDO (→ T-06, [../16-T-06-tablas-completas-exportacion/spec.md](../16-T-06-tablas-completas-exportacion/spec.md)): tablas completas y exportación de este conjunto.
- INCREMENTO DIFERIDO (→ cada dueño de entidad): adopción del conjunto por pareja (A-08), emparejamiento (F-07), cuarto/tramo (F-04), split (T-03), origen (A-02), tipo de posesión (A-03), oportunidad (A-04), tramo de reloj (A-05), zona (C-03) y cadena de evento (A-07), y por
  los quintetos de F-06 (tabla completa). T-05 deja el registro de tipos y el contrato; el CA del cliente con "emparejamiento" se cierra en F-07.
- INCREMENTO DIFERIDO (→ A-01, [../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)): `possessions_counted`, `off_poss_duration`, `player_poss_duration`.
- INCREMENTO DIFERIDO (→ A-12, [../../fase-2-contexto-comparabilidad/06-A-12-metricas-jugador-pendientes/spec.md](../../fase-2-contexto-comparabilidad/06-A-12-metricas-jugador-pendientes/spec.md)): `ast_team_share`, `pts_per_ast` y demás métricas pendientes de jugador.
- Migración de los endpoints legado a las claves estándar (solo se agrega el bloque `standard`); migración de `lineups._metrics` y `clutch._box_metrics` a `compute_standard` (la hacen F-06 y C-06/F-04 según Arq. §3.5).
- Cambiar los datos que hoy ven Liga, Comparar y Buscar (T-01/T-06).
- Cualquier cálculo en el frontend (regla 4 de la Constitución).

## 9. Ambigüedades
- [DECISIÓN CONFIRMADA — default de arquitectura] **Cobertura en fase 1.** El criterio del cliente nombra "emparejamiento", que no existe hasta F-07. Se acepta verificar la regla con las cinco entidades existentes y registrar los demás tipos al construirse (Arq. §9.2 I-09).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Fórmulas en conflicto con `docs/metrics.md`** (DA-03 PPT, DA-04 TO% de equipo, DA-05 USO% en cancha, DA-06 AS% de jugador, DA-34 DER/Net de jugador): se aplican los defaults de la arquitectura (adoptar el glosario del cliente). Cambian números visibles
  (R-04): se documentan en `docs/metrics.md` y se comparan antes/después en `progress.md`. Si el humano rechaza alguna, esa clave conserva la fórmula de `docs/metrics.md` sin tocar el resto.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Código de nulo nuevo `no_disponible`** para `paint_fga_share`/`mid_fga_share` hasta C-03: la arquitectura fija 13 códigos y ninguno describe "definida pero todavía no habilitada". Alternativa descartada: `sin_coordenadas` (miente, las coordenadas existen desde F-11).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Faltas recibidas de equipo sin fallback a `opp_pf`.** La arquitectura sugiere usar `opp_pf` (faltas personales del rival) mientras no se reprocesa. No son lo mismo (FIBA cuenta `FoulsOn` distinto de `FoulsPersonal` del rival; p. ej. TRO 18 recibidas vs VER 19 cometidas en el seed): se muestra nulo `no_registrado` hasta reprocesar.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Faltas cometidas desde el play-by-play** (`pf` en quinteto/ON-OFF/cierre) = eventos `foul` salvo `benchTechnical` y `coachTechnical` (coincide 26/26 con `tot_sFoulsPersonal`). El cierre legado `fouls_committed` (todas las `foul`) no cambia.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Jugador "en cancha"**: partidos sin play-by-play (o sin 5 titulares válidos) se estiman solo para `possessions` y `orb_pos`; DER, Net, PTS recibidos, PACE y segundos por posesión usan solo los partidos con segmentos exactos y se marcan "parcial" si no son todos.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Minutos del cierre**: ventana de cierre por partido calificado (`window_secs` + 300 s por prórroga) / 60; minutos de quinteto y ON/OFF = segundos de tramos / 60; minutos de equipo = Σ `games.minutes`.
- [DECISIÓN CONFIRMADA — default de arquitectura] **`games` del quinteto** = partidos en los que el quinteto jugó al menos un tramo (no los partidos usados para armar tramos, que siguen informándose como `games_used`/`games_excluded` en el eco de contexto).
- [DECISIÓN CONFIRMADA — default de arquitectura] **Base por defecto** de la UI = `partido` (como `ui.default_base`); `total` se ofrece con un selector de dos botones hasta que T-04 aporte el selector de cuatro bases.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Etiqueta "PER" = pérdidas** (como en la especificación del cliente y en la app), aunque en el basquetbol anglosajón sea otra métrica; se conserva para no cambiar el vocabulario del cliente.
- [DECISIÓN CONFIRMADA — default de arquitectura] **Dependencia de C-08**: el id de jugador del conjunto estándar es `player_id` (Arq. §3.12) y las rutas legado por nombre lo resuelven. La arquitectura (§9.1) no lista C-08 entre las dependencias de T-05 y sí de T-01; por el orden de fases C-08 (1·07) se implementa antes que T-05 (1·13).
