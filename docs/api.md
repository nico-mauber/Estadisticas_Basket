# API REST

Base URL producción: `https://estadisticas-basket.onrender.com`  
Base URL local: `http://localhost:5000`

Todas las rutas bajo `/api/`. Respuestas en JSON. Errores retornan `{"error": "mensaje"}` con código HTTP apropiado.

> **Nulo vs cero en métricas de tasa.** Los campos de tasa (porcentajes, ratios, puntos por posesión: `oer`, `der`, `net_rating`, `efg_pct`, `ts_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `ft_rate`, `ppt`, `pps`, `ppp`, `or_pct`, `dr_pct`, `trb_pct`, `to_pct`, `as_pct`, `uso_pct`, etc.) valen **`null`** cuando su denominador es 0 en ese partido (ej. un partido sin tiros libres → `ft_pct: null`, no `0`). En `averages`, esos partidos se **excluyen** del promedio (no cuentan como 0). Las stats de conteo (`pts`, `fta`, `ast`, ...) conservan su 0 real. `null` = "sin dato / sin intentos"; `0` = "valor real cero". Ver `sdd/specs/08-nulos-vs-cero/`.

> **Partidos DNP y población de promedio.** Un partido con 0 minutos disputados (DNP) **no cuenta como partido jugado**: queda fuera de todos los promedios del jugador, tanto de tasa como de conteo. Afecta a `GET /api/player/<team>/<player>`, `GET /api/players/<team>` y `GET /api/search/players`:
> - `games` es el número de partidos **jugados**, no el de fichas en `player_game_stats`.
> - `averages.*`, `uso_pct`, `pts`, `minutes` y `plus_minus` se promedian solo sobre partidos jugados.
> - `game_log` sigue devolviendo **todas** las fichas, incluidas las DNP: cada entrada trae `"played": bool` (`false` = DNP). El DNP se excluye del promedio, no de la historia.
>
> Un partido **con** minutos y 0 puntos sí cuenta — ese 0 es real. Campos que además pueden valer `null` donde antes devolvían `0`: `reb_share`, `oreb_share`, `dreb_share` (tasas: denominador 0 o sin fila de equipo), `uso_pct` en `/api/players/<team>`, y `record.win_pct` en `/api/team/<code>`. Ver `sdd/specs/12-nulos-orden-color-dnp/`.

> **Identidad de jugador (C-08).** Cada jugador es una **ficha** (`player_id`, tabla `players`) con clave `(equipo, nombre normalizado)`: minúsculas, sin tildes, espacios colapsados. Dos grafías del mismo nombre son una sola ficha y suman sus partidos; la tabla conserva el nombre crudo.
> - Los endpoints `…/<team>/<name>` (perfil, mapa de tiro, ON/OFF) y `GET /api/lineup/<team>` aceptan **cualquier grafía** y usan **todos** los partidos, tiros y eventos de la ficha. `GET /api/player/<player_id>` y los listados devuelven el `player_id`.
> - El `player`/`name` devuelto es siempre una grafía real (la del partido más reciente), nunca la clave normalizada.
> - `position` es la más frecuente entre las no vacías; a igual frecuencia, la más reciente. `position_group` la agrupa: `G` = G/PG/SG, `F` = F/SF/PF, `C` = C; `null` sin posición.
> - La normalización es tipográfica, no semántica: `J. Feldeine` y `Jerome Feldeine` **no** se unen solos; el panel de calidad los lista como candidatos y un administrador los fusiona (`POST /api/identity/merge`). La competencia no entra en la clave.

> **Selección de competencia y promedios de liga (C-02).** `GET /api/team/<code>` y `GET /api/player/…` aceptan `?competition=<id>|all&last=<n>`. La competencia se resuelve en el backend (parámetro → entidad → configurada F-13 → última de la liga). La respuesta trae UN `league` con el promedio de la competencia seleccionada, no un mapa por competencia.
>
> **Filtros de contexto de nivel partido (T-03).** Los mismos endpoints (`/api/team`, `/api/player`, `/api/rankings/…`, `/api/metrics/<tipo>`, `/api/table/<id>`) aceptan además `?venue=local|visitante`, `?opponent=<team_code>` y `?rest=0|1|2|3mas` (días de descanso: 0 = partidos en días consecutivos; se mide sobre todos los partidos publicados del equipo, el primer partido y los que no tienen fecha quedan fuera). Se combinan con "y"; los últimos N se toman después de los demás filtros y la población de los rankings se recalcula con el mismo contexto (con `opponent` el rival sale de la población). El eco `context` trae `applied` (`last`, `venue`, `opponent`, `rest`), `ignored` (`[{param, reason}]`; `quarter`/`score`/`on`/`off` → `no_implementado`, `clock`/`clock_start`/`origin`/`ptype`/`chance` → `requiere_posesiones`, `/api/shot-zones` → `no_aplica`), `games_used`, `games_total`, `games_excluded` (`sin_partido_previo`, `sin_fecha`, `dnp`) y `label`. Un valor inválido responde `400 {error, code: "contexto_invalido", details: {param, value}}`; una entidad sin partidos que cumplan los filtros responde `404 sin_partidos` en `/api/metrics/<tipo>`; si la entidad directamente no existe (código mal escrito), responde `404 no_encontrado` aunque haya filtros activos.
>
> **Filtros de nivel evento (T-03, solo equipo).** `?quarter=1,2,3,4,pr` (cuartos; `pr` agrupa todas las prórrogas), `?score=ajustado|paliza` (marcador corrido ANTES del evento: ajustado si la diferencia es ≤ `context.close_margin`, 10 por defecto; paliza si es mayor) y `?on=<player_id>[,…]` / `?off=<player_id>[,…]` (jugadores de ese equipo en / fuera de cancha) los aplican `GET /api/metrics/team`, el bloque `standard` de `GET /api/team/<code>` y `GET /api/rankings/team/<métrica>`. Las métricas se calculan sobre los eventos (y los segundos de reloj) que cumplen todos los filtros, solo en partidos con jugada a jugada; el badge de muestra pasa a posesiones (`sample.split.*`) y OER/DER/Net llevan el ajuste a la media con `regression.split.k`. Con `on`/`off` la respuesta trae `context.population_mode = "entity_only"` y `population.reason = "contexto_no_comparable"` (sin percentiles). El eco trae `level: "evento"`, `games_excluded.sin_pbp` / `sin_titulares`. `on`/`off` de un jugador de otro equipo o repetidos en ambos → 400 `contexto_invalido`. Los demás endpoints (jugador, lineup, onoff, clutch, shot-zones, tablas) los informan en `context.ignored` (`no_aplica`; en jugador `no_implementado`).
>
> **Tablas `team_lineups` y `team_onoff` (F-06).** `GET /api/table/team_lineups?team=<code>[&size=3|4|5]` devuelve una fila por combinación de `size` jugadores (5 por defecto) con el conjunto estándar completo, `_players` (nombres con la grafía de la ficha), `_size`, el badge de muestra de quinteto y `adj` con OER/DER/Net ajustados y su banda; `link` es `lineup:<code>:<pid>-<pid>-…` (ids ascendentes). `GET /api/table/team_onoff?team=<code>[&view=on|off|diff]` devuelve una fila por jugador del plantel: `on` (en cancha), `off` (fuera) o `diff` (ON − OFF clave por clave; si cualquiera de los dos lados es nulo, la diferencia es nula con razón `sin_datos`, nunca 0). El badge de ON/OFF usa el menor de los dos estados. Ambas aceptan el contexto de nivel partido de T-03, `?base=` y las opciones de T-06 (orden, columnas, exportación); los filtros de nivel evento se informan en `context.ignored` con `no_aplica`. `size` o `view` fuera de la lista → 400 `parametro_invalido`.
>
> **`GET /api/player-profile/<player_id>`** (F-16) devuelve la ficha de identidad: `display_name`, `full_name`, `jersey`, `position`, `team{code,name}`, `competition{id,label}`, `games`, `context_line` ("<competencia> · <equipo> · N partidos", con los partidos de la selección activa de T-03), `competitions[]`, los datos cargados a mano (`height_cm`, `birth_year`, `nationality`, `profile_notes`), `fields_null_reasons` (`no_registrado` por campo sin dato), `profile_updated_at`/`profile_updated_by` y `editable`. 404 `no_encontrado`.
>
> **`PUT /api/player-profile/<player_id>`** (solo administradores) guarda esos datos manuales; body parcial, `null` o cadena vacía borra el campo y vuelve a "no registrado". Rangos: altura 140–240 cm, año 1940–2020, nacionalidad 60 caracteres, notas 2000. Fuera de rango → 400 `parametro_invalido` con `details.param`. Los datos viven en la ficha (identidad de C-08), así que sobreviven a reimportaciones y reprocesos, y suben la versión de datos. No se exportan en las tablas de T-06.
>
> **`GET /api/table/team_roster?team=<code>`** (F-08) devuelve el plantel: una fila por jugador con minutos en la selección (los convocados sin minutos no aparecen), con el conjunto estándar completo, su ficha de T-01 (percentil contra los jugadores de la competencia), el badge de muestra y `link = player:<player_id>`. Acepta el contexto de T-03, `?base=` y las opciones de T-06. El ranking por USO% es una columna más de esta tabla.
>
> **`GET /api/table/team_clutch_lineups?team=<code>`** (F-06) devuelve una fila por quinteto con minutos en el tramo de cierre (últimos `clutch.window_secs` del último período regular más las prórrogas, en partidos con diferencia ≤ `clutch.margin` al entrar al tramo, C-06): `_record` (V-D), `_win_pct`, `_games_counted`, `_pts_for`, `_pts_against`, `_point_diff` (diferencial del quinteto DENTRO del tramo) y el conjunto estándar del tramo. Un partido cuenta para el récord solo si el quinteto jugó al menos `sample.clutch_lineup.min_poss` posesiones del cierre, y el resultado es el del PARTIDO, no el del tramo. El badge se mide en partidos contados (`sample.clutch_lineup.high_games`, 3 por defecto) y el Net Rating trae su ajuste con `regression.clutch_lineup.k`.
>
> **`GET /api/periods/<team_code>`** (F-04) devuelve los 8 tramos del partido en una respuesta: `{team_code, window_secs, context, windows: [{window, label, empty, standard, summary, games}]}`. Tramos: `q1`–`q4`, `h1`, `h2`, `pr` (todas las prórrogas) y `last5` (últimos `clutch.window_secs` del último período regular más las prórrogas). Cada `standard` es el payload de `GET /api/metrics/period?id=<equipo>:<tramo>` (conjunto estándar completo, ficha T-01 contra los demás equipos en el mismo tramo y contexto, badge de split, OER/DER/Net ajustados); `summary` trae `record` (G-P-E por los puntos del tramo), `games_with_window`, `pts`, `pts_against`, `point_diff`; `games` es el desglose por partido. Acepta el contexto de T-03 y `?base=`; el filtro `quarter` se ignora (`context.ignored`: `no_aplica`) porque manda el tramo. Un tramo sin partidos con play-by-play viene con `empty: true`. Cada tramo trae además `summary` y `games` ya calculados (el pbp se recorre una sola vez por ventana). Los percentiles de cada tramo se calculan contra los demás equipos EN ESA MISMA VENTANA, no contra el partido completo. 404 `no_encontrado` si el equipo no existe; `/api/metrics/period` con un tramo inválido → 400 `parametro_invalido`.
>
> **`GET /api/context/options?competition=<id>|all`** devuelve `{competition, competitions, teams: [{code, name}], dimensions: [{name, level, values, available}]}`: las dimensiones disponibles hoy son `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on` y `off`; las de evento (`quarter`, `score`, `on`, `off`) también; las de posesión vienen con `available: false`.
> - El `Ø` es la media **de las entidades** de la competencia (DA-08: cada equipo/jugador una vez, con todos sus partidos), no ponderada por cantidad de partidos.
> - `avg` y `best` valen `null` —no `0`— cuando ninguna observación de la población tiene dato.
> - `league_meta` describe la población (size, criterion, competition_id/label).
> - Sin competencia (`competition=all`), `league` tiene todas las métricas con `avg: null` y razón `sin_universo`.
> - `context` (eco de la selección): `competition {id, label}`, `applied {last}`, `games_used`, `games_total`, `label`.
> - `competitions`: competencias de la entidad, `[{id, label, games}]`, para el selector.
> - El `Ø` **no** se recalcula con el subconjunto filtrado en pantalla (últimos N): solo depende de la competencia seleccionada.
> - `best` ya no se consume en la UI (el indicador `↑` se retiró); se conserva en la respuesta hasta que T-01 rehaga el bloque de contexto.
>
> Ver `sdd/specs/v2/fase-1-confiabilidad/02-C-02-promedios-de-liga/`.

> **Métricas de jugador por posesión y por minuto.** `game_log[]` y `averages` de los endpoints de jugador incluyen `as_pos`, `tov_pos` (`PER/pos`), `pts_pos`, `orb_min` y `drb_min`; y `or_pct`/`dr_pct`/`trb_pct`, que antes estaban **ausentes** y ahora traen el valor de la fórmula individual (ver `docs/metrics.md`). Todos pueden ser `null` con denominador 0 o sin datos del rival. **Agregación (C-01):** en `averages` (perfil y Buscador) las ocho tasas y `oer` son el **cociente de los totales de los partidos jugados** (ver `docs/metrics.md`), no la media de las tasas por partido; en `game_log[]` valen lo de ese partido. Una tasa por posesión nunca es negativa (`POS ≤ 0` → `null`, `sin_intentos`) y un `or_pct`/`dr_pct`/`trb_pct` > 100 % tampoco se devuelve (`null`, `estimacion_invalida`).
>
> **`ast_to` cambió de semántica**: era el promedio de los ratios por partido; ahora `averages.ast_to` es el **acumulado de la selección** (`ΣAS / ΣPER`), en equipo y en jugador. `null` si no hubo pérdidas (antes `99.0`). `GET /api/team/<code>` y `GET /api/player/…` devuelven además `totals.ast` y `totals.tov` (Σ de la selección; en jugador, solo partidos jugados) para reproducir el cociente con el box score, y `GET /api/team/<code>` trae `game_log[].ast_to` (AS/PER **de ese partido**, `null` con razón `sin_perdidas` si tuvo 0 pérdidas). Ver `sdd/specs/v2/fase-1-confiabilidad/08-C-04-as-per/`.

> **Competencias en borrador (F-11).** Los partidos de una competencia con `status: "borrador"` no entran en **ninguna** respuesta de lectura (equipos, liga, jugadores, buscador, mapas de tiro, quintetos, ON/OFF, cierres) hasta publicarla. Solo se ven en `GET /api/games`, `GET /api/competitions?include_hidden=1` y `GET /api/data-quality` (sección Datos).

> **Permisos de escritura (F-11).** Las rutas que modifican datos (`DELETE /api/games`, `PATCH /api/games/<id>`, `POST`/`PATCH /api/competitions…`, `POST /api/reprocess`) exigen además ser administrador: con `ADMIN_USERS` definida, solo esos usuarios; sin ella, todo usuario logueado. No admin → `403 {"error": "Tu usuario no tiene permiso para esta acción."}`. Importar no requiere admin.

> **Nulos con razón (C-11).** `GET /api/team/<code>`, `GET /api/player/<team>/<name>` y `GET /api/search/players` agregan un mapa `null_reasons` `{clave: código}` que dice **por qué** vale `null` cada métrica nula. Solo lista claves cuyo valor es `null`; el valor sigue siendo `null`.
> - Dónde: en `/api/team` y `/api/player`, `null_reasons` en la raíz explica `averages`, y cada entrada de `game_log[]` trae su propio `null_reasons`. En `/api/search/players`, cada fila trae el suyo.
> - Códigos que se emiten hoy:
>
>   | Código | Significa |
>   |---|---|
>   | `dnp` | El jugador no disputó minutos en ese partido (o en ninguno, para `averages`) |
>   | `no_registrado` | La competencia no publica ese campo (FIBA no manda la clave): `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts`, `plus_minus` |
>   | `sin_perdidas` | `ast_to` o `def_to_ratio` con 0 pérdidas: el cociente no está definido |
>   | `sin_intentos` | Cualquier otra tasa con denominador 0 (también una tasa por posesión de jugador con `POS ≤ 0`) |
>   | `estimacion_invalida` | `or_pct`, `dr_pct` o `trb_pct` individuales que darían más de 100 % (estimación por minutos con muestra ínfima) |
>
> - **Sin centinelas**: `ast_to` y `def_to_ratio` con 0 pérdidas valen `null` (`sin_perdidas`), también por partido — antes `99.0` (DA-07). Ninguna respuesta contiene `Infinity` ni `NaN`.
> - **`averages.def_to_ratio`** es el acumulado `(ΣROB + ΣTAP + ΣRD) / ΣPER` (pooled, DA-02), igual que `ast_to`; antes era el promedio de los ratios por partido.
> - **Desglose FIBA y `plus_minus`**: si la competencia no los publica, valen `null` (antes `0`). En `/api/search/players`, `plus_minus` promedia solo los partidos que lo traen.

---

## POST `/api/import`

Importa un partido desde FIBA LiveStats.

**Request body:**
```json
{ "url": "https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/12345/bs.html" }
```

**Response 200:**
```json
{
  "ok": true,
  "game_id": "12345",
  "teams": [
    { "code": "FUBB", "name": "Federación Uruguaya de Basketball" },
    { "code": "OPO", "name": "Oponente" }
  ],
  "competition_id": 1,
  "competition_label": "Liga Uruguaya de Basquetbol 2025/2026"
}
```

**Errores:**
- `400` — campo `url` ausente o vacío
- `502` — FIBA LiveStats no respondió o datos inválidos

**Comportamiento:** importar el mismo partido dos veces es idempotente: upsert del partido y reemplazo completo de sus equipos, jugadores, tiros y play-by-play. La competencia se resuelve por el texto de FIBA (se crea si no existe, estado `publicada`); una competencia asignada a mano se conserva. El JSON crudo queda archivado para reprocesar (F-11).

---

## GET `/api/games`

Catálogo de partidos importados (incluye los de competencias en borrador), ordenados por fecha descendente.

**Query params:** `?competition=<id>` (opcional) filtra por competencia; también acepta el texto de FIBA.

**Response:**
```json
[
  {
    "id": 1,
    "game_id": "12345",
    "competition": "Liga FUBB",
    "date": "2024-03-15",
    "home_team": "Equipo A",
    "home_code": "EQA",
    "away_team": "Equipo B",
    "away_code": "EQB",
    "home_score": 85,
    "away_score": 72,
    "minutes": 40,
    "imported_at": "2024-03-16 10:30:00",
    "competition_id": 1,
    "competition_label": "Liga FUBB 2024",
    "competition_status": "publicada",
    "ingest_version": 2,
    "has_pbp": true,
    "has_coords": true,
    "needs_reprocess": false
  }
]
```

- `competition` es el texto crudo de FIBA; `competition_id`/`competition_label` la competencia asignada.
- `minutes`: 40 + 5 por prórroga (40 en partidos no reprocesados).
- `needs_reprocess`: guardado con una versión de ingesta anterior a la vigente.

---

## PATCH `/api/games/<game_id>` — admin

Reasigna un partido a otra competencia. La asignación se conserva al reimportar y reprocesar.

**Request:** `{ "competition_id": 3 }` · **Response 200:** la fila del partido con `competition_id`/`competition_label`.

**Errores:** `400` sin `competition_id` entero o competencia inexistente · `404` partido no encontrado. (Toda competencia inexistente pasada como parámetro — `competition=`, `competition_id` — da `400`; `404` es para rutas `/api/competitions/<id>`.)

---

## GET `/api/teams`

Lista todos los equipos con conteo de partidos.

**Response:**
```json
[
  { "code": "FUBB", "name": "Federación Uruguaya", "games": 12 }
]
```

---

## GET `/api/team/<team_code>`

Stats completas del equipo para la selección activa (C-02): promedios, record, promedio de liga de la competencia, contexto y game log.

**Parámetros:** `team_code` — case-insensitive (se normaliza a mayúsculas).

**Query params (C-02):**
- `competition` — id de competencia, texto de FIBA (legado) o `all`. Ausente = la del partido más reciente de la entidad (DA-14).
- `last` — entero > 0. Los N partidos más recientes de la entidad en la competencia.

**Response:**
```json
{
  "team_code": "FUBB",
  "team_name": "Federación Uruguaya",
  "games": 12,
  "context": {
    "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
    "applied": { "last": 5 },
    "games_used": 5, "games_total": 12,
    "games_excluded": {}, "ignored": [],
    "label": "Liga de Ascenso 2026 · Últimos 5"
  },
  "competitions": [
    { "id": 1, "label": "Liga de Ascenso 2026", "games": 12 }
  ],
  "record": {
    "wins": 8, "losses": 4, "win_pct": 0.667,
    "home": "5-1", "away": "3-3"
  },
  "averages": { "oer": 1.05, "...": "..." },
  "null_reasons": { "...": "..." },
  "totals": { "ast": 43, "tov": 29, "...": "..." },
  "league": {
    "oer": { "avg": 1.0, "best": 1.15, "reason": null, "n": 14 },
    "...": "..."
  },
  "league_meta": {
    "entity_type": "team", "competition_id": 1,
    "competition_label": "Liga de Ascenso 2026",
    "size": 14, "criterion": "media de los equipos de la competencia (cada uno con todos sus partidos)"
  },
  "game_log": [
    {
      "game_id": "12345", "date": "2024-03-15",
      "competition": "Liga de Ascenso", "competition_id": 1,
      "competition_label": "Liga de Ascenso 2026",
      "opponent": "Equipo B", "opponent_code": "EQB",
      "home_away": "L",
      "oer": 1.08, "pts": 85, "opp_pts": 72,
      "null_reasons": {},
      "...": "todas las métricas del partido"
    }
  ]
}
```

**Errores:** `400` — competencia inexistente o `last` inválido · `404` — equipo no encontrado.

---

## GET `/api/players/<team_code>`

Plantel del equipo: una entrada por **ficha** de jugador, ordenado por USO% descendente.

**Query:** `competition` (opcional) — id de competencia (o texto de FIBA legado); recorta los partidos que alimentan `games`, `uso_pct` y `pts`. Ausente = todas.

**Response:**
```json
[
  { "player_id": 12, "name": "C. Zinaich", "games": 2, "uso_pct": 0.2145, "pts": 19.0 },
  { "player_id": 15, "name": "J. Feldeine", "games": 2, "uso_pct": null, "pts": 11.5 }
]
```

`games` = partidos **jugados** (excluye DNP). `uso_pct` y `pts` son `null` sin partidos jugados. **Errores:** `400` — `{"error": "La competencia no existe."}`.

---

## GET `/api/player/<team_code>/<player_name>`

Stats completas del jugador para la selección activa (C-02). Acepta cualquier grafía del nombre (ver nota de identidad) y devuelve la ficha vigente, con `player_id`.

**Query params (C-02):**
- `competition` — id de competencia, texto de FIBA (legado) o `all`. Ausente = la del partido más reciente de la entidad.
- `last` — entero > 0. Los N partidos más recientes jugados de la entidad en la competencia.

**Response:**
```json
{
  "player": "García Juan",
  "player_id": 12,
  "position": "PF",
  "position_group": "F",
  "team_code": "FUBB",
  "team_name": "Federación Uruguaya",
  "games": 10,
  "context": {
    "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
    "applied": {},
    "games_used": 10, "games_total": 10,
    "games_excluded": { "dnp": 2 }, "ignored": [],
    "label": "Liga de Ascenso 2026"
  },
  "competitions": [
    { "id": 1, "label": "Liga de Ascenso 2026", "games": 10 }
  ],
  "averages": { "oer": 1.02, "...": "..." },
  "null_reasons": { "...": "..." },
  "totals": { "ast": 43, "tov": 29, "...": "..." },
  "league": {
    "oer": { "avg": 0.97, "best": 3.0, "reason": null, "n": 138 },
    "...": "..."
  },
  "league_meta": {
    "entity_type": "player", "competition_id": 1,
    "competition_label": "Liga de Ascenso 2026",
    "size": 138, "criterion": "media de los jugadores de la competencia (cada uno con todos sus partidos jugados)"
  },
  "game_log": [{ "...": "un entry por partido, con played y null_reasons" }]
}
```

**Errores:** `400` — competencia inexistente o `last` inválido · `404` — `{"error": "Jugador no encontrado"}`.

---

## GET `/api/player/<player_id>`

Mismo contenido que `GET /api/player/<team_code>/<player_name>` (incluido `player_id`, `position`, `position_group`, `context`, `competitions`, `league`, `league_meta`), pero por identificador de ficha. Acepta los mismos query params `competition` y `last` (C-02). Si la ficha fue absorbida por otra (fusión), responde la vigente: el `player_id` de la respuesta es el canónico. Es la ruta que usan el buscador y el plantel para abrir el perfil.

**Errores:** `400` — competencia inexistente o `last` inválido · `404` — `{"error": "Jugador no encontrado"}`.

---

## GET `/api/shots/<team_code>/<player_name>`

Shot chart de **11 zonas** del jugador (ver clasificación en [database.md](database.md#clasificación-de-zonas-de-tiro)). Suma los tiros de **todas las grafías** de la ficha. **Errores:** `404` — `{"error": "Jugador no encontrado"}` si el nombre no resuelve a ninguna ficha del equipo.

**Response:**
```json
{
  "zones": {
    "restricted_area": { "made": 45, "attempts": 80, "pct": 0.5625, "pf": 1.125 },
    "mid_left_close":  { "made": 4,  "attempts": 10, "pct": 0.40,   "pf": 0.80 },
    "mid_top":         { "made": 6,  "attempts": 15, "pct": 0.40,   "pf": 0.80 },
    "left_corner_3":   { "made": 8,  "attempts": 20, "pct": 0.40,   "pf": 1.20 },
    "top_key_3":       { "made": 15, "attempts": 45, "pct": 0.333,  "pf": 1.00 },
    "...": "11 zonas en total (ZONE_KEYS_11)"
  },
  "total_shots": 175,
  "has_coordinates": true,
  "summary": {
    "global_pf": 1.05,
    "efg_pct":   0.512,
    "ppp":       0.98,
    "games":     10
  }
}
```

Por zona: `made`, `attempts`, `pct` (% acierto), `pf` (puntos por intento; `null` si 0 intentos), `share` (proporción del total de tiros, C-03), más los aliases `fg_pct`=`pct` y `efg_pct`=`efg`. Los campos `pct`/`pf` son legacy — el frontend C-03 usa `GET /api/shot-zones` en su lugar.

`has_coordinates` — `true` si al menos un tiro del jugador tiene `x!=0` o `y!=0`; hoy siempre `false` (F-11 guarda las coordenadas pero la clasificación aún no las usa). El frontend usa `GET /api/shot-zones` (C-03) que elige 11 o 3 zonas automáticamente.

### GET `/api/shots/<team_code>` (agregado del equipo)

Mismo shape que el de jugador, pero agrega los tiros de **todos los jugadores** del equipo (Feature 10). `summary.ppp` se calcula desde `TeamGameStats`. Alimenta el "Mapa de tiro del equipo" en la vista Equipo.

`summary`:
- `global_pf` — puntos por tiro global
- `efg_pct` — eFG% derivado de los tiros con zona
- `ppp` — puntos por posesión del jugador (de `player_game_stats`, no solo tiros)
- `games` — partidos con datos de tiro

Tiros sin coordenadas (`x=0, y=0`, partido sin array `shot` en FIBA) caen en `top_key_3` (3PT) o `mid_top` (2PT) o `restricted_area` (2PT con keyword de pintura) — en la práctica, si ningún tiro del jugador tiene coordenadas, solo esas 3 claves de `zones` tendrán `attempts>0` (ver `has_coordinates` arriba).

---

## GET `/api/shot-zones`

Mapa de tiro enriquecido con percentil y muestra por zona (C-03). Reemplaza los endpoints legacy `/api/shots/…` para el frontend.

**Query params:**
| Param | Requerido | Valores | Default |
|-------|-----------|---------|---------|
| `entity` | sí | `team` \| `player` | — |
| `id` | sí | código de equipo o `player_id` | — |
| `competition` | no | id de competencia | última de la entidad |
| `last` | no | entero ≥ 1 | todos los partidos |

**Response 200:**
```json
{
  "zones": {
    "restricted_area": {
      "made": 45, "attempts": 80,
      "fg_pct": 0.5625, "efg_pct": 0.5625,
      "ppt": 1.125, "share": 0.457,
      "percentile": 38, "sample": {"level": "alta", "n": 80, "threshold": 30}
    },
    "top_key_3": { "...": "mismos campos" },
    "...": "11 zonas (ZONE_KEYS_11)"
  },
  "summary": {
    "total_shots": 175, "ppt": 1.05, "efg_pct": 0.512
  },
  "has_coordinates": false,
  "context": {
    "entity": "team", "id": "ALB",
    "competition": {"id": 1, "label": "Liga Regular"},
    "last": null
  }
}
```

`percentile` — percentil del PPT de esa zona respecto a todas las demás entidades del mismo tipo en la competencia (population.percentile, direction "higher"). `null` sin competencia o sin universo. `sample` — confiabilidad de la muestra (T-02). `share` — proporción de tiros del total (`attempts / total_fga`).

**Errores:**
- `400` — `{"code": "parametro_invalido", "error": "..."}` si `entity` no es `team` ni `player`, o falta `id`.
- `404` — entidad no encontrada.

Sin competencia: todas las zonas llevan `percentile: null` y `percentile_reason: "sin_universo"`.

---

## GET `/api/pbp/<game_id>`

Verificación del play-by-play persistido de un partido (Feature 02). Solo lectura.

**Response 200:**
```json
{
  "game_id": "2741559",
  "events": 577,
  "by_action_type": { "2pt": 89, "3pt": 48, "rebound": 71, "substitution": 112, "assist": 38, "steal": 19, "block": 3, "freethrow": 50, "turnover": 29, "...": "..." },
  "first": { "action_number": 1, "action_type": "game", "period": 1, "clock_secs": 600, "...": "..." },
  "last":  { "action_number": 999, "...": "..." }
}
```

**Errores:** `404` — `{"error": "Partido sin play-by-play. Reimportá el partido."}` (partido inexistente o importado antes de la Feature 02).

---

## GET `/api/search/players`

Todos los jugadores de la base con sus promedios, para el buscador avanzado (una entrada por **ficha**, C-08). El filtrado y el orden se hacen en el frontend; el filtro opcional `competition` recorta en el backend los partidos que alimentan los promedios.

**Query:** `competition` (opcional) — id de competencia (o texto de FIBA legado). Ausente = todas. Con valor, solo aparecen las fichas con partidos en esa competencia. `400` si no existe.

**Response:**
```json
[
  {
    "player_id": 12,
    "player": "A. Varela",
    "team_code": "AGU",
    "team_name": "Aguada",
    "competitions": ["Liga Uruguaya de Basquetbol 2025/2026"],
    "competition_ids": [3],
    "games": 3,
    "position": "G",
    "position_group": "G",
    "minutes": 27.4,
    "plus_minus": 4.5,
    "efg_pct": 0.55, "ts_pct": 0.58, "oer": 1.08, "uso_pct": 0.24,
    "ppp": 1.02, "ppt": 1.08, "pps": 1.10, "fg2_pct": 0.50, "fg3_pct": 0.37, "ft_pct": 0.80,
    "reb_share": 0.15, "oreb_share": 0.10, "dreb_share": 0.20,
    "physical_impact": 8.0, "stocks": 2.3, "def_playmaking": 0.9,
    "pts": 14.2, "ast": 6.1, "tov": 2.0, "stl": 1.2, "blk": 0.4
  }
]
```

- `position` — posición FIBA más frecuente entre las no vacías (desempate: la más reciente); `""` si nunca hubo dato. Es un atributo de la ficha: no cambia con el filtro de competencia. `position_group` — `"G"`, `"F"`, `"C"` o `null` (el filtro de posición del buscador usa este campo).
- `competition_ids` — ids de las competencias de la ficha, sin correspondencia posicional con `competitions`; usarlo solo para pertenencia.
- `plus_minus` / `minutes` — promedio por partido (`plus_minus` puede ser negativo).
- Las tasas siguen la regla de nulos (ver nota al inicio): `null` si no hay dato, excluidas del promedio.
- Un jugador que jugó en dos equipos aparece una vez por equipo.

---

## GET `/api/clutch/<team_code>`

Cierres del equipo (Feature 05 **v2**, C-06): rendimiento en la **ventana de cierre** (último período REGULAR con reloj ≤ `window_secs` + todas las prórrogas) **de partidos apretados** — solo cuentan los partidos con diferencia ≤ `margin` al entrar a la ventana. Devuelve un **agregado** ("mini-partido" del equipo, todos sus cierres sumados) **más un desglose por partido**. Ver `sdd/specs/05-clutch/spec.md §10` y `sdd/specs/v2/fase-1-confiabilidad/05-C-06-umbral-cierres/`.

**Query (todos opcionales):**
- `margin` — umbral de partido cerrado, entero 0–40. Default **10** (`clutch.DEFAULT_MARGIN`).
- `window_secs` — ventana de cierre en segundos, entero 60–600. Default **300** (`clutch.DEFAULT_WINDOW_SECS`).
- `competition` — id de competencia (o texto de FIBA legado): el universo son solo los partidos del equipo en ella. Sin el parámetro, todas las competencias publicadas.

Los defaults viven solo en `backend/clutch.py` (F-13 los hará configurables). La respuesta devuelve los valores usados y **el frontend arma el título con ellos**.

> Reemplaza al antiguo `GET /api/clutch?team=` (una fila por equipo-partido, en la vista Liga). El análisis se movió a la vista **Equipo**.

**Response:**
```json
{
  "team_code": "HYM", "team_name": "Hebraica Macabi",
  "margin": 10, "window_secs": 300,
  "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
  "games_total": 2, "games_with_pbp": 2, "games_without_pbp": 0,
  "games_qualified": 2, "games_excluded": 0, "games_without_clutch_events": 0,
  "clutch_record": "1-1-0",
  "aggregate": {
    "pts_for": 21, "pts_against": 18, "point_diff": 3,
    "off_rating": 0.9227, "def_rating": 0.8364,
    "efg_pct": 0.4348, "ts_pct": 0.4241, "possessions": 22.76,
    "reb": 13, "ast": 6, "tov": 3, "stl": 2, "blk": 2,
    "fouls_committed": 7, "fouls_drawn": 5
  },
  "per_game": [
    {
      "game_id": "2820499", "date": "2026-04-28",
      "opponent_code": "CNF", "home_away": "V", "entry_margin": 6, "overtime_periods": 0,
      "pts": 16, "opp_pts": 12, "point_diff": 4,
      "off_rating": 1.16, "def_rating": 0.96, "efg_pct": 0.577, "ts_pct": 0.542,
      "possessions": 13.8, "tov": 1, "ast": 5, "reb": 6,
      "fouls_committed": 6, "fouls_drawn": 4,
      "top_finisher": { "name": "C. Mitchell", "pts": 5 },
      "top_creator":  { "name": "J. Canty", "ast": 1 }
    }
  ]
}
```

- `competition` = `{id, label}` de la competencia pedida, o `null` si no se filtró.
- **Calificación por ventana:** un partido entra solo si al abrir la ventana (último evento con `clock_secs > window_secs` del REGULAR final) la diferencia absoluta era ≤ `margin`. Si no, suma a `games_excluded` y no aporta al agregado. `entry_margin` = esa diferencia por partido.
- **Recuento que cierra:** `games_qualified + games_excluded + games_without_clutch_events == games_with_pbp` y `games_with_pbp + games_without_pbp == games_total`. `games_without_clutch_events` = calificó por diferencia pero no hay eventos de cierre de ambos equipos.
- **Prórrogas:** todos los eventos con `period_type` `OVERTIME` (o el legado `OT`) entran en la ventana. `per_game[].overtime_periods` = cantidad de prórrogas del partido.
- `aggregate` = suma de las stats crudas de todos los cierres calificados; tasas recalculadas sobre la suma (`null` si 0 posesiones o 0 intentos). `aggregate.point_diff == pts_for − pts_against`.
- `clutch_record` = `ganados-perdidos-empatados` de los cierres calificados (`pts > / < / == opp_pts`).
- Faltas desde `pbp_events`: `fouls_committed` (`foul`), `fouls_drawn` (`foulon`).
- **Errores:** `400` — `margin`/`window_secs` fuera de rango o no enteros ("El parámetro margin debe ser un número entero entre 0 y 40."), o competencia inexistente. `404` — equipo inexistente ("Equipo no encontrado"), sin partidos en la competencia pedida ("El equipo no tiene partidos en la competencia seleccionada.") o sin play-by-play ("Equipo sin play-by-play. Reimportá sus partidos."). Con `games_qualified == 0`, `aggregate` trae conteos 0 y tasas `null`.

---

## GET `/api/lineup/<team_code>?players=A|B|C`

Rendimiento del equipo mientras los jugadores indicados (3 a 5, separados por `|`) comparten cancha, agregado sobre todos los partidos del equipo con play-by-play (Feature 03). Motor de reconstrucción de quintetos: `backend/lineups.py`.

**Response 200:**
```json
{
  "team_code": "CNF", "players": ["P. Prieto", "E. Oglivie", "J. Feldeine"], "size": 3,
  "games_used": 2, "games_excluded": 0,
  "sample": { "possessions": 43.96, "seconds": 1311.0 },
  "metrics": { "oer": 1.2056, "der": 0.7546, "net_rating": 0.451, "efg_pct": 0.5465, "ts_pct": 0.5643 },
  "raw": { "fga": 46, "fgm": 25, "fga3": 12, "fgm3": 6, "fta": 8, "ftm": 6, "orb": 7, "drb": 14, "ast": 9, "tov": 5, "stl": 8, "blk": 2 },
  "leaders": {
    "scorer":    { "name": "J. Feldeine", "pts": 15 },
    "assister":  { "name": "J. Feldeine", "ast": 2 },
    "rebounder": { "name": "E. Oglivie",  "trb": 9 }
  }
}
```

- `games_used`/`games_excluded` — partidos con quinteto inicial válido (5 titulares) vs. descartados por datos de pbp inconsistentes (RF-1/RF-7).
- `sample.seconds` = tiempo de juego del equipo con esos jugadores en cancha. La suma de segundos de todos los tramos de un partido es exacta (PERIOD_LEN por período: 600 regular / 300 OT); no modela reloj detenido dentro de un tramo.
- Tasas `null` si su denominador es 0 (regla de nulos, ver nota al inicio).

**Errores:** `400` — `{"error": "Elegí entre 3 y 5 jugadores"}` (menos de 3 o más de 5 nombres, o nombres que son el mismo jugador) · `400` — `{"error": "Jugador no encontrado: <nombre>"}` si un nombre no resuelve a una ficha del equipo · `404` — equipo sin partidos con play-by-play. Cada nombre puede usar cualquier grafía; `players` devuelve la grafía real de cada ficha.

---

## GET `/api/onoff/<team_code>/<player_name>`

Rendimiento del equipo con el jugador en cancha (**ON**) vs. en el banco (**OFF**), agregado sobre todos los partidos del equipo con play-by-play (Feature 04). Reusa el motor de `backend/lineups.py` (Feature 03) — ON/OFF nacen de los mismos tramos, partición exhaustiva y disjunta.

**Response 200:**
```json
{
  "team_code": "CNF", "player": "E. Oglivie", "player_id": 12, "usg_pct": 0.0947,
  "games_used": 2, "games_excluded": 0,
  "on":  { "possessions": 87.0, "seconds": 2682.0, "pts_for": 103, "pts_against": 63, "reb": 53, "orb": 15, "drb": 38, "ast": 13, "tov": 11, "stl": 8, "blk": 3, "oer": 1.1839, "der": 0.7475, "net_rating": 0.4364, "efg_pct": 0.5513, "ts_pct": 0.5787 },
  "off": { "possessions": 77.0, "seconds": 2201.0, "pts_for": 104, "pts_against": 91, "reb": 36, "orb": 10, "drb": 26, "ast": 18, "tov": 9, "stl": 5, "blk": 1, "oer": 1.3506, "der": 1.1837, "net_rating": 0.1669, "efg_pct": 0.6692, "ts_pct": 0.6842 },
  "diff": { "oer": -0.1667, "der": -0.4362, "net_rating": 0.2695, "efg_pct": -0.1179, "ts_pct": -0.1055 }
}
```

- `usg_pct` — USO% promedio del jugador (`calc_player_stats`, mismo cálculo que `/api/search/players`).
- **Conteos crudos del equipo (RF-8):** `pts_for`, `pts_against`, `reb`/`orb`/`drb`, `ast`, `tov`, `stl`, `blk` en cada conjunto ON/OFF. Escalan con los minutos del conjunto (ON suele tener más posesiones), así que su Δ no es comparable directo — las tasas sí lo son. El frontend calcula el Δ de conteos como `ON − OFF`.
- `diff = ON − OFF` (solo tasas); `null` si cualquiera de los dos lados no tiene dato (denominador 0, ver CA-2 en `sdd/specs/04-on-off/spec.md`).
- Si ON u OFF tienen `possessions: 0` (jugador jugó 0 o el 100% de los minutos), sus métricas de tasa son `null` (no `NaN`/`Infinity`).

**Errores:** `404` — `{"error": "Sin datos ON/OFF para este jugador"}` (jugador o equipo sin datos) / `{"error": "Equipo no encontrado o sin play-by-play"}`.

---

## GET `/api/competitions`

Competencias y temporadas (F-11). Una competencia **en una temporada** es el universo de cálculo. Sin parámetros devuelve solo las `publicada` (selectores); con `?include_hidden=1` también las `borrador` (sección Datos). Orden: último partido más reciente primero.

**Response:**
```json
[{ "id": 1, "name": "Liga Uruguaya de Basquetbol", "season": "2025/2026",
   "label": "Liga Uruguaya de Basquetbol 2025/2026", "status": "publicada",
   "games": 13, "teams": 12, "first_date": "2025-10-03", "last_date": "2025-11-14",
   "is_default": true }]
```

`is_default` (C-02): marca la competencia por defecto (la del partido más reciente de la liga, resolución de `repository.resolve_competition`). El frontend abre la vista Liga en esa competencia.

> **Cambio de forma:** antes devolvía una lista de strings.

### POST `/api/competitions` — admin
`{ "name": "Liga de Ascenso", "season": "2026" }` → `201` con el objeto. `400` sin nombre · `409` ya existe (nombre + temporada, sin distinguir mayúsculas).

### PATCH `/api/competitions/<id>` — admin
Parcial: `{ "name"?, "season"?, "status"? }` con `status` ∈ `publicada` · `borrador`. `400` estado inválido · `404` · `409` duplicado.

### POST `/api/competitions/<id>/merge` — admin
`{ "source_id": 2 }`: los partidos y alias de la competencia 2 pasan a `<id>` y la 2 se borra. Una importación futura con el texto de la 2 queda en `<id>`. **Response:** `{ "ok": true, "target": {…}, "moved_games": 4, "moved_aliases": 1 }`. `409` fusionar consigo misma.

---

## GET `/api/data-quality`

Informe de calidad de una competencia (F-11). **Query:** `?competition=<id>` (obligatorio).

**Response:**
```json
{
  "competition": { "id": 1, "label": "Liga de Ascenso 2026", "status": "borrador", "...": "..." },
  "summary": { "games": 13, "incomplete_games": 1, "incomplete_ids": ["2849340"],
               "ready_to_publish": false, "ingest_version": 2 },
  "checks": {
    "games_without_pbp":       { "status": "alerta", "count": 1, "counts_as_incomplete": true,
                                 "items": [{ "game_id": "2849340", "date": "2026-06-10", "label": "A 81 – 77 B" }] },
    "games_missing_data":      { "...": "sin los dos equipos, sin jugadores o sin fecha" },
    "games_needing_reprocess": { "...": "ingest_version anterior a la vigente" },
    "pbp_box_mismatch":        { "...": "PTS / TCi / TLi del pbp ≠ box; items con team_code y detail" },
    "lineup_inconsistencies":  { "...": "sin 5 titulares, tramos que no suman 60 × minutos o sin 5 en cancha" },
    "games_without_coords":    { "counts_as_incomplete": false },
    "null_fields":             { "items": [{ "table": "player_game_stats", "field": "position",
                                             "label": "Posición del jugador", "nulls": 18, "total": 312, "pct": 0.0577 }] },
    "possible_duplicates":     { "status": "alerta", "count": 1, "counts_as_incomplete": false,
                                 "items": [{ "kind": "candidato", "reason": "apellido_inicial", "team_code": "CNF", "can_merge": true,
                                             "players": [{ "player_id": 15, "name": "J. Feldeine", "games": 12, "jerseys": ["7"], "first_date": "2025-10-02", "last_date": "2026-03-01" },
                                                         { "player_id": 41, "name": "Jerome Feldeine", "games": 1, "jerseys": ["7"], "first_date": "2026-03-08", "last_date": "2026-03-08" }] }] },
    "possession_gaps":         { "status": "alerta", "count": 2, "pct": 0.1, "counts_as_incomplete": false,
                                 "items": [{ "game_id": "2849328", "date": "2026-01-15", "label": "A 81 – 77 B", "incomplete": 2, "reasons": {"cambio_sin_cierre": 1, "sin_finalizacion": 1}, "diff_pct": {"A": 0.25, "B": 0.05} }] }
  }
}
```

Un partido es **incompleto** si falla un chequeo con `counts_as_incomplete: true`; la competencia está lista para publicar si no tiene incompletos. `status` de cada chequeo: `ok` · `alerta` · `no_disponible`.

`possible_duplicates` (C-08) lista **avisos**, nunca partidos incompletos: `kind: "candidato"` = dos fichas del mismo equipo que **nunca jugaron el mismo partido** y que parecen la misma persona (`reason`: `apellido_inicial` — mismo apellido e inicial compatible, p. ej. `J. Feldeine`/`Jerome Feldeine`; `dorsal_apellido` — mismo dorsal y apellido que comparte 4+ caracteres iniciales), con `can_merge: true`; `kind: "posible_fusion_incorrecta"` (`reason: "nombre_completo_distinto"`) = una ficha cuyos partidos traen nombres completos de FIBA distintos, es decir que la clave tipográfica pudo juntar a dos personas (solo detectable en partidos reprocesados con `INGEST_VERSION` ≥ 3).

---

## GET `/api/game/<game_id>/possessions` — NUEVO (A-01)

Posesiones reconstruidas de un partido. **Query:** `?team=<code>` (filtra por equipo atacante), `?detail=1` (incluye `event_numbers`).

**Response 200:**
```json
{
  "game_id": "2849328",
  "teams": { "home": "OMU", "away": "SAY" },
  "possessions": [
    { "poss_id": 1, "team": "OMU", "opp": "SAY", "period": 1, "period_type": "REGULAR",
      "start_clock": 600, "end_clock": 583, "duration": 17, "start_event": 4, "end_event": 11,
      "end_type": "t2c", "pts": 2, "chances": [{ "n": 1, "start_clock": 600, "shot_clock_start": 24, "pts": 2 }],
      "incomplete": false }
  ],
  "reconcile": {
    "OMU": { "counted": 81, "incomplete": 0, "formula_pbp": 80.8, "diff_pct": 0.25, "pts_poss": 72, "pts_outside": 0, "pts_box": 72, "pts_ok": true }
  }
}
```

**Errores:** `404 no_encontrado` — partido inexistente; `404 sin_pbp` — partido sin play-by-play; `400 parametro_invalido` — equipo inválido para este partido.

---

## GET `/api/possessions/reconcile` — NUEVO (A-01)

Conciliación de posesiones reconstruidas vs fórmula del glosario para una competencia. **Query:** `?competition=<id>` (obligatorio, no acepta `all`).

**Response 200:**
```json
{
  "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
  "teams": [{ "team_code": "OMU", "team_name": "OmniSports", "games": 13, "counted": 1042,
              "incomplete": 1, "formula": 1039.5, "diff_pct": 0.24, "within_2pct": true }],
  "totals": { "counted": 2099, "formula": 2104.6, "diff_pct": -0.27, "incomplete": 2, "incomplete_pct": 0.1 },
  "games_over_5pct": [],
  "games_excluded": { "sin_pbp": 0 }
}
```

**Errores:** `400 competencia_inexistente`; `400 parametro_invalido` (falta `competition` o vale `all`).

---

## GET `/api/game/<game_id>` — NUEVO (F-07)

Detalle completo de un partido: encabezado, box oficial, parciales, línea de tiempo, jugadores con conjunto estándar, quintetos, conciliación. Cacheado por `cache.memo("game", ...)`.

**Query:** `?base=total|partido|por40|por100` (default `total`).

**Response 200:**
```json
{
  "game": { "game_id": "12345", "home_code": "CNF", "away_code": "PEN",
            "home_name": "CNF", "away_name": "PEN", "date": "2026-03-15",
            "competition": { "id": 1, "label": "Liga de Ascenso 2026" },
            "home_score": 82, "away_score": 75 },
  "box": { "home": { "pts": 82, "fgm": 28, "fga": 58, "fg_pct": 48.3, "..." : "..." },
           "away": { "..." : "..." } },
  "partials": { "periods": [{ "key": "Q1", "label": "1er cuarto",
                  "home_pts": 22, "away_pts": 18, "ratings": { "home": { "off": 1.1, "..." : "..." }, "away": { "..." : "..." } } }],
                "overtimes": 0 },
  "timeline": { "plays": [{ "elapsed": 45, "period": 1, "clock": "9:15",
                  "team": "CNF", "pts": 2, "home_score": 2, "away_score": 0,
                  "is_timeout": false }],
                "runs": [{ "team": "CNF", "pts": 10, "start_elapsed": 120, "end_elapsed": 280 }],
                "lead_changes": 5, "ties": 3, "biggest_lead": { "home": 12, "away": 8 } },
  "players": { "home": [{ "player_id": 7, "name": "Juan Pérez", "position": "PG",
                  "played": true, "minutes": "25:30", "standard": { "pts": 15, "..." : "..." } }],
               "away": [ "..." ] },
  "lineups": { "home": [{ "players": [7, 12, 15, 18, 21], "names": ["...", "..."],
                  "minutes": "8:30", "possessions": 22, "badge": "estrella",
                  "standard": { "off_rating": 112.5, "..." : "..." } }],
               "away": [ "..." ] },
  "reconciliation": { "score_final": true, "players_sum": false, "period_sum": true,
                      "timeline_final": true, "details": { "..." : "..." } }
}
```

**Errores:** `404 no_encontrado`; `400 parametro_invalido` (base inválida).

---

## GET `/api/game/<game_id>/pbp` — NUEVO (F-07)

Jugada a jugada filtrable. Devuelve eventos del partido con marcador acumulado.

**Query:** `?player=<player_id>&type=<tipo1,tipo2>&period=<Q1,Q2,OT1>` (todos opcionales). Tipos válidos: `tiro`, `tiro_libre`, `rebote`, `asistencia`, `perdida`, `robo`, `tapon`, `falta`, `cambio`, `tiempo_muerto`, `otro`.

**Response 200:**
```json
{
  "game_id": "12345",
  "total": 593,
  "filtered": 36,
  "type_groups": { "tiro": 128, "rebote": 95, "falta": 42, "..." : "..." },
  "plays": [{ "action_number": 1, "period": 1, "clock": "10:00",
              "team": "CNF", "player": "Juan Pérez", "player_id": 7,
              "action_type": "2pt", "sub_type": "layup", "success": true,
              "score": "2-0", "description": "2PT Layup Juan Pérez" }]
}
```

**Errores:** `404 no_encontrado`; `404 sin_pbp`; `400 parametro_invalido` (tipo o período inválido).

---

## GET `/api/origins` — NUEVO (A-02)

Origen de la posesión: cómo empieza cada posesión y cómo rinde según su origen. Auth: `login_required`. Solo posesiones **completas** (A-01); las incompletas no se imputan a ningún origen.

| Param | Obligatorio | Descripción |
|---|---|---|
| `team` | uno de `team`/`player` | Código del equipo |
| `player` | uno de `team`/`player` | `player_id` de la ficha: orígenes de las posesiones que el jugador finaliza (`finisher_id`), solo ataque |
| `side` | no | `ataque` (default) o `defensa` (posesiones del rival contra el equipo: PPP concedido, TO% forzado) |
| contexto T-03 | no | `competition`, `last`, `venue`, `opponent`, `rest`. Los filtros de evento/posesión (`quarter`, `score`, `on`, `off`, `origin`…) se informan en `context.ignored` |

Response 200: `entity`, `side`, `context` (eco §7.5), `summary {possessions, classified, reconciled}`, `origins[]` (7 filas, orden fijo del cliente: `canasta_rival`, `rebote_defensivo`, `robo`, `perdida_rival`, `saque_banda`, `tiempo_muerto`, `tiro_libre_rival`), cada una con `possessions`, `share`, `metrics {ppp, efg_pct, to_pct, ft_rate, duration_avg}` (`{value, reason}`; `null` con razón `sin_intentos`), `finish {t2, t3, tl, perdida, fin_periodo}` y `sample` (badge T-02, entidad `origin` = umbrales `sample.split.*`). Con `team`: `oreb_info` (posesiones extra de oportunidades 2+, informativa, fuera de la suma) y `reconcile {sum_origins, total_possessions, ok}`.

Errores: 400 `parametro_invalido` (falta `team`/`player`, ambos, o `side` inválido), 400 `contexto_invalido`, 404 `no_encontrado`, 404 `sin_pbp` (ningún partido de la selección tiene play-by-play).

**Conjunto estándar y tabla.** Tipo de entidad `origin`: `GET /api/metrics/origin?id=<equipo>:<origen>&side=ataque|defensa` (las 89 claves; la población de la ficha son los equipos en el mismo origen y lado). Tabla T-06 `team_origins`: `GET /api/table/team_origins?team=<code>&side=ataque|defensa`, una fila por origen con su conjunto estándar, `% del total` y badge de muestra.

## GET `/api/transition` — NUEVO (A-03)

Transición y contraataque. Auth: `login_required`. Mismos parámetros que `GET /api/origins` (`team` o `player`, `side=ataque|defensa` solo con `team`, contexto T-03; los filtros de evento y de posesión se informan en `context.ignored`).

Response 200 (equipo): `types[]` (`transicion`, `early`, `media_cancha`: `possessions`, `share`, `metrics {ppp, efg_pct, to_pct, ft_rate, duration_avg, first_shot_secs}`, `sample`), `ppp_diff {transicion_vs_media_cancha, early_vs_media_cancha}`, `summary {possessions, classified, unclassified {incompleta|sin_accion|reloj_no_derivable}, reconciled}`, `context`. Con `side=ataque` además: `first_shot {mean, distribution[], possessions, without_shot}`, `origin_of_transition[]` (origen del contraataque con `% del origen que corre`), `finish_in_transition[]` (6 categorías), `dreb_to_transition`, `players {rows[], coverage}` (corredores), `pass_out` (`null` / `no_registrado`) y `reconcile_fastbreak` (puntos de transición reconstruidos vs `fast_break_pts` oficial, solo partidos con ingesta actual; informativo). Con `side=defensa`: `conceded_per100`, `conceded_by_origin[]`, `own_turnovers_to_transition` y `balance`. Con `player`: `types[]` (posesiones que el jugador finaliza por tipo: PPP y eFG%), `runner {initiated, initiated_pts, assists_in_transition, pass_out}`.

Conjunto estándar y tabla: `GET /api/metrics/ptype?id=<equipo>:<tipo>&side=` y `GET /api/table/team_ptypes?team=<code>&side=` (mismo patrón que `origin`). Errores como en `/api/origins`.

## GET `/api/team-insights/<team_code>` — NUEVO

Fortalezas y debilidades del equipo contra su competencia. Auth: `login_required`. Query: `competition`, `last`. Response 200: `strengths[]` y `weaknesses[]` (`metric`, `label`, `fmt`, `value`, `percentile`, `text`; fortaleza = percentil ≥ 70, debilidad ≤ 30, hasta 5 por lado), `teams`, `games`, `low_sample`, `evaluated`, `entity`, `context`. 400 si no hay competencia.

**Cambios (2026-10):** `GET /api/players/<team>`, `GET /api/lineup/<team>` y `GET /api/onoff/<team>/<jugador>` aceptan `?competition=` y solo usan los partidos de esa competencia. `GET /api/team/<code>` agrega `extras_source` (`oficial` / `calculado` por campo del desglose ofensivo). El conjunto estándar suma `ft_uso` (90 claves).

## GET `/api/second-chance` — NUEVO (A-04)

Segunda oportunidad. Auth: `login_required`. Parámetros como `GET /api/origins` (`team` o `player`, `side=ataque|defensa` solo con `team`, contexto T-03).

Response 200 (equipo): `summary {possessions, second_chances, oreb_in_box, incomplete, reconciled}`, `ppp_first`, `ppp_second`, `ppp_diff`, `pts_per_oreb`, `conversion`, `outcomes[]` (`putback`, `reinicio`, `kickout_triple`, `falta_recibida`, `perdida`, `sin_puntos`: `count`, `share`, `pts`, `ppp`, `sample`), `modes[]` (intentos y convertidos por modo del tiro), `sources[]` (origen del rebote según el tiro fallado: triple, media distancia, cercano, tiro libre), `rebound_zone` (`null` / `no_registrado`), `chains`, `secs_to_shot {mean, distribution[], possessions, without_shot}`. Con `side=ataque`: `players {rows[], team_row, totals}` (captura y finalización por separado; "Rebote de equipo" aparte), `cost` (coste del rebote ofensivo, aproximación) y `reconcile {calc, official, diff, games[], games_mismatch[], excluded[]}` contra `team_game_stats.second_chance_pts` (solo partidos con ingesta actual). Con `side=defensa`: `or_pct_conceded` (OR% concedido), `ppp_second` concedido, `long_rebound` (`no_registrado`) y los mismos desenlaces y segundos del rival. Con `player`: `capture {captured, pts, conversion, own_putbacks}`, `finish {finished, pts, ppp_personal}` y `outcomes[]` de lo que finaliza. Ventanas configurables `oreb.putback_secs` (3) y `oreb.kickout_secs` (6).

## GET `/api/possession-clock` — NUEVO (A-05)

Tramo de reloj de posesión y composición de puntos. Auth: `login_required`. Query: `team=<code>` (obligatorio), `side=ataque|defensa` (default `ataque`), `game=<game_id>` (un solo partido; ignora el resto del contexto) y contexto T-03.

Response 200: `side`, `entity {type: "team", id}`, `clock_source {kind: "derivado", resolution_secs: 1, note}`, `thresholds {early_max, mid_max, reset_secs}`, `bands[]` (`temprano`, `medio`, `tardio`: `range`, `all {shots, share}`, `r24` y `r14`), `no_clock {shots, chances, reason}`, `reconcile {fga_team, fga_engine, in_bands_24, in_bands_14, no_clock, in_incomplete, ok, chances_24, chances_14}`, `points_mix`, `summary {possessions, incomplete, shots}` y `context`.

Cada bloque `r24` / `r14` (`r14.tardio` = `{value: null, reason: "no_aplica"}`): `chances`, `shots`, `pts`, `share` (tiros del bloque / tiros de campo del equipo), `pts_share`, `metrics {efg_pct, ts_pct, ppt, ppp, to_pct, viol24_rate}`, `mix {t2, t3, tl, perdida}` (reparto de las oportunidades, suma 100 %), `threes {attempts, made, pct, share_of_band, share_of_team_3pa, pts, pts_share}`, `shape {paint_share, perimeter_share}`, `turnover_types {pase, manejo, pasos, viol24, otras}` y `sample` (T-02, unidad posesiones).

`points_mix` (box oficial de los partidos usados; en defensa, el del rival): `pts`, `parts[]` (`t3`, `t2`, `tl`: `pts`, `share`, `made`, `attempts`, `pct`, `attempts_share`), `reconciled`, `possessions`, `ppp`, `turnovers {count, per_game, poss_share, est_points_lost}`, `assists {count, per_game, fgm_assisted_share, ast_points, ast_points_share, linked}` (`ast_points` `null` con `no_registrado` / `sin_pbp` si falta el vínculo de A-12) y `official_origin {second_chance, fast_break, from_turnovers, paint}`.

Errores: 400 `parametro_invalido` ("Indicá un equipo.", "El lado debe ser ataque o defensa."), 400 `contexto_invalido`, 404 `no_encontrado`, 404 `sin_pbp`. Cortes configurables: `clock.early_max` (8) y `clock.mid_max` (16); `clock.reset_secs` (14).

## GET `/api/game/<game_id>/matchups` — NUEVO (F-07)

Coincidencia en cancha de un partido: cruces entre quintetos y/o jugadores.

**Query:** `?level=quinteto|jugador|jugador_quinteto` (default `quinteto`), `?side=home|away` (default `home`).

**Response 200 (level=quinteto):**
```json
{
  "game_id": "12345", "level": "quinteto", "side": "home",
  "rows": [{ "matchup_id": "CNF:7-12-15-18-21|PEN:3-4-8-11-14",
             "own": { "code": "CNF", "players": [7, 12, 15, 18, 21], "names": ["..."] },
             "opp": { "code": "PEN", "players": [3, 4, 8, 11, 14], "names": ["..."] },
             "minutes": "5:20", "possessions": 14, "badge": "estrella",
             "own_stats": { "pts": 12, "fg": "5/9", "..." : "..." },
             "opp_stats": { "pts": 8, "..." : "..." },
             "net": 4 }]
}
```

**Response 200 (level=jugador):**
```json
{
  "game_id": "12345", "level": "jugador", "side": "home",
  "rows": [{ "player_a": { "id": 7, "name": "Juan Pérez" },
             "player_b": { "id": 3, "name": "Carlos López" },
             "minutes": "12:30", "possessions": 34,
             "a_stats": { "pts": 8, "..." : "..." },
             "b_stats": { "pts": 5, "..." : "..." },
             "plus_minus": 3 }]
}
```

**Errores:** `404 no_encontrado`; `404 sin_pbp`; `400 parametro_invalido` (level o side inválido).

---

## GET `/api/game/<game_id>/shots` — NUEVO (F-07)

Mapa de tiro de un equipo en un partido, con zonas y filtros.

**Query:** `?team=<code>` (obligatorio), `?player=<player_id>`, `?quarter=<Q1,Q2>`, `?clock=<band>`, `?zone=<zona>` (todos opcionales excepto team).

**Response 200:**
```json
{
  "game_id": "12345", "team": "CNF",
  "total": 58, "filtered": 58, "no_band": 58,
  "shots": [{ "x": 250, "y": 120, "made": true, "pts": 2, "zone": "paint",
              "player": "Juan Pérez", "player_id": 7, "period": 1, "clock": "8:45" }],
  "zones": [{ "zone": "paint", "label": "Pintura", "attempts": 18, "made": 10,
              "pct": 55.6, "pts": 20, "pps": 1.11, "badge": "estrella" }]
}
```

**Errores:** `400 parametro_invalido` (falta `team` o jugador inválido).

---

## GET `/api/live/<game_id>` — NUEVO (F-01)

Snapshot de un partido en curso, leído de FIBA LiveStats. El cliente hace polling cada `live.poll_secs` (10–60 s); el servidor cachea la descarga por partido durante `live.cache_ttl_secs`, así varios usuarios generan una sola descarga por intervalo. Al detectar el evento de fin (`game`/`end`) el partido se persiste solo (misma ingesta que `POST /api/import`) y la respuesta pasa a `finalizado`.

**Query:** `?url=<bs.html de FIBA>` (opcional). Si se envía, debe ser del host de FIBA LiveStats y del mismo `game_id`; se usa para leer fecha y competencia al persistir. Sin `url` se usa `…/u/FUBB/<game_id>/bs.html`.

**Response 200 (en curso):**
```json
{
  "status": "en_curso", "stale": false, "fetched_at": "2026-10-16T21:14:32+00:00",
  "game_id": "2849343", "has_pbp": true,
  "clock": {"period": 3, "period_type": "REGULAR", "clock_secs": 245, "elapsed_secs": 1555, "label": "3C 4:05"},
  "teams": {
    "home": {"code": "LAG", "name": "…", "score": 61,
             "standard": {"oer": {"value": 1.08, "reason": null}, "...": "der, net_rating, efg_pct, ts_pct, ppp, possessions, to_pct, or_pct, ft_rate, ppt, pace"},
             "vs_season": {"competition_id": 3, "competition_label": "…", "games": 2,
                           "metrics": {"oer": {"own_avg": 0.9594, "delta": 0.12}}}},
    "away": {"...": "mismo shape"}
  },
  "distribution": {"home": {"total": 61,
    "by_shot": {"paint_pts": {"value": 28, "reason": null}, "mid_pts": {}, "three_pts": {}, "ft_pts": {}, "otros_no_clasificado": {}},
    "by_origin": {"second_chance_pts": {}, "fast_break_pts": {}, "pts_from_tov": {}}}, "away": {}},
  "players_on_court": {"home": ["LAG|B. Gomez", "…5 claves"], "away": ["…"]},
  "players": {"home": [{"player_id": "LAG|B. Gomez", "name": "B. Gomez", "jersey": "7", "minutes": 21.5, "pts": 12,
     "on_court": true,
     "standard": {"oer": {}, "ts_pct": {}, "efg_pct": {}, "uso_pct": {}, "plus_minus": {}},
     "chains": {"points_created": {}, "points_from_assist": {}, "oreb_points": {}, "steal_points": {}, "turnover_cost": {}}}],
   "away": []}
}
```
- `by_shot` es excluyente y suma `total`; `by_origin` viene de FIBA y sus categorías se superponen (un contraataque tras pérdida cuenta en ambas). Un desglose que la competencia no publica viene `null` con razón `no_registrado`.
- Jugadores en vivo no tienen id en la base: la clave es `"<equipo>|<nombre>"`.
- `vs_season.metrics.possessions`: `own_avg` por partido y `delta: null` (un volumen parcial no se compara con un partido completo; el tempo se compara con `pace`).
- `chains` es `null` con razón `sin_pbp` si FIBA aún no publicó jugada a jugada; con pbp, 0 es real (la acción no ocurrió).
- `stale: true`: FIBA no respondió y se sirve el último snapshot (`fetched_at` es el de ese snapshot). `persist_error: true`: el partido terminó pero no se pudo guardar; se reintenta en el próximo polling.

**Response 200 (finalizado):** `{"status": "finalizado", "stale": false, "fetched_at": "…", "game_id": "…", "redirect": "#/partido/<id>/analizar"}`. El frontend muestra entonces `GET /api/game/<game_id>`.

**Errores:** `404 no_encontrado` (id no numérico, o FIBA responde 403/404 y no está en la base), `400 parametro_invalido` (`url` de otro host o de otro partido), `502 fiba_no_disponible` (FIBA no responde y no hay snapshot previo).

---

## GET `/api/live/<game_id>/momentum` — NUEVO (F-02)

Lo que está cambiando el partido ahora (no el acumulado). Misma fuente, caché y errores que `GET /api/live/<game_id>`: no descarga aparte. Partido en curso → calculado sobre los datos en memoria del snapshot; partido guardado → estado al cierre, calculado sobre `pbp_events` + posesiones de A-01 (cacheado, se invalida con datos o configuración). Mismo `?url=` opcional.

**Response 200:**
```json
{
  "status": "en_curso", "stale": false, "fetched_at": "…", "game_id": "2849328", "has_pbp": true,
  "now": {"period": 2, "period_type": "REGULAR", "elapsed_secs": 1200, "label": "2C 0:00"},
  "teams": {"home": {"code": "OMU", "name": "…"}, "away": {"code": "SAY", "name": "…"}},
  "thresholds": {"last_possessions": 10, "window_secs": 300, "last_outcomes": 5, "hot_consecutive_makes": 3,
                 "hot_points": 8, "hot_points_window_secs": 180, "assist_streak": 4, "oreb_in_quarter": 3,
                 "cold_consecutive_tov": 3},
  "run": {"team_code": "SAY", "side": "away", "points": 8, "opp_points": 0,
          "since": {"period": 2, "clock_secs": 154, "label": "2C 2:34"}, "elapsed_secs": 134},
  "last_possessions": {"n": 10, "home": {"ppp": {"value": 1.2, "reason": null}, "possessions": 10, "points": 12}, "away": {}},
  "last_window": {"window_secs": 300, "reason": null,
                  "home": {"oer": {"value": 1.15, "reason": null}, "der": {}, "net_rating": {}, "possessions": 12, "points": 14}, "away": {}},
  "last_outcomes": {"n": 5, "home": [{"end_type": "t3c", "label": "Triple convertido", "pts": 3, "player": "…",
                    "assister": "…", "is_three": true, "had_second_chance": false, "incomplete": false, "clock": "2C 0:41"}], "away": []},
  "hot": [{"player_key": "OMU|R. Previatti", "name": "R. Previatti", "team_code": "OMU", "side": "home",
           "marks": [{"rule": "makes_streak", "value": 3, "label": "3 tiros de campo convertidos seguidos"},
                     {"rule": "oreb_in_quarter", "value": 3, "label": "3 rebotes ofensivos en el cuarto"}]}],
  "cold": [{"player_key": "…", "name": "…", "marks": [{"rule": "cold_streak", "value": 3, "label": "3 pérdidas seguidas"}]}]
}
```
- `run`: parcial abierto = puntos seguidos del último equipo que anotó (`null` si nadie anotó). `opp_points` siempre 0.
- `last_possessions`/`last_window`: `null` con razón `pocas_posesiones` / `pocos_minutos` si la muestra no alcanza (nunca un valor sobre muestra parcial). OER/DER de la ventana = puntos por posesión reconstruida (A-01), propia / del rival.
- `last_outcomes`: de la más reciente a la más vieja.
- Reglas (`marks[].rule`): `makes_streak` (tiros de campo convertidos seguidos), `points_window` (puntos en la ventana corta), `assist_streak` (últimas canastas de campo del equipo asistidas por el mismo jugador; una sin asistir o de otro corta), `oreb_in_quarter` (se reinicia en cada período), `cold_streak` (pérdidas sin canasta, asistencia ni rebote propio en el medio). Umbrales: claves `momentum.*` (F-13).

**Errores:** los mismos que `GET /api/live/<game_id>`.

---

## GET `/api/prepare` — NUEVO (F-03)

Informe de scouting de un rival (Preparar partido), en una sola respuesta. Cacheado por `(team, rival, competencia, last)` y versión de datos/configuración; < 10 s en frío.

**Query:** `team`, `rival` (códigos, requeridos), `competition` (opcional; default: la del partido más reciente de `team`), `last` (opcional: últimos N partidos **del rival**; aplica a todo el informe salvo el historial).

**Response 200:**
```json
{
  "summary": {"team": {"code": "LAG", "name": "LAGOMAR"}, "rival": {"code": "TAB", "name": "TABARE"},
              "competition": {"id": 1, "label": "Liga de Ascenso 2026"}, "team_games": 2,
              "rival_games_considered": 2, "rival_games_total": 2, "last": null, "generated_at": "…"},
  "advantages": [{"id": "tiro_defensa", "side": "defensa", "title": "Su tiro vs nuestra defensa del tiro",
                  "own_metric": "opp_efg_pct", "ref_metric": "efg_pct", "own_label": "eFG% rival", "ref_label": "eFG%",
                  "own_fmt": "pct", "ref_fmt": "pct", "own": 0.42, "ref": 0.466, "own_pct": 92, "ref_pct": 31,
                  "edge": 61, "strength": "clara", "text": "Defendemos el tiro mejor de lo que ellos tiran.", "direction": "up"}],
  "threats": ["… mismo formato, edge más negativo primero"],
  "sample_warning": true,
  "rival_lineups": {"rows": [{"id": "TAB:96-99-…", "name": "…", "games": 2, "minutes": 33.4, "possessions": 73.8,
                              "oer": 1.05, "der": 1.12, "net_rating": -0.14, "net_adj": -0.10, "net_band": 0.33,
                              "sample": {"level": "alta", "…": "badge T-02"}}], "reason": null},
  "rival_threats": {"top_usage": [{"player_id": 105, "name": "A. Da Costa", "games": 2, "mpg": 35.5, "ppg": 23.0,
                                   "uso_pct": {"value": 0.29, "reason": null}, "ts_pct": {}, "efg_pct": {}}],
                    "zones": {"…": "mismo payload que GET /api/shot-zones"},
                    "best_zone": {"zone": "restricted_area", "ppt": 1.27, "attempts": 74, "…": "…"},
                    "points": {"…": "mismo formato que distribution de GET /api/live"}},
  "h2h": {"…": "mismo formato que GET /api/h2h"},
  "matchups": {"games": ["9999991", "2849343"], "reason": null,
               "quinteto": {"rows": [], "matrix": {}}, "jugador": {"rows": []},
               "jugador_quinteto": {"rows": []}, "jugador_quinteto_rival": {"rows": []}},
  "suggestions_profile": null
}
```
- Ventajas/amenazas: 15 duelos (nuestro ataque vs su defensa, nuestra defensa vs su ataque, y la misma métrica en ambos) con percentiles de T-01 contra toda la competencia (sin umbral de muestra; `sample_warning` si alguno de los dos tiene menos de `sample.team.min` partidos). `edge` = percentil propio − percentil del rival; ventajas = 5 mayores, amenazas = 5 menores.
- Cruces (`matchups`): filas de `matchups.team_matchups` (mismo formato que `GET /api/game/<id>/matchups`, con `games: [{game_id, possessions}]` y `net_band`) sobre los partidos entre ambos que entran en el filtro del rival. Sin partidos → `reason: "sin_enfrentamientos"`.

**Errores:** `400 parametro_invalido` ("Falta el equipo", "Falta el rival", "El rival no puede ser el mismo equipo", `last` inválido), `404 no_encontrado` ("Equipo no encontrado" / "Rival no encontrado" en la competencia).

---

## GET `/api/h2h` — NUEVO (F-03)

Historial completo entre dos equipos, en todas las competencias visibles (o una con `competition`). Orientado al equipo `a`.

**Query:** `a`, `b` (códigos, requeridos), `competition` (opcional).

**Response 200:** `{"team_a": "LAG", "team_b": "TAB", "games": [{"game_id", "date", "competition_id", "competition_label", "venue": "L|V", "score_a", "score_b", "winner"}], "record": {"wins_a": 2, "wins_b": 0}}` (más reciente primero).

**Errores:** `400 parametro_invalido` (falta alguno o son iguales).

---

## POST `/api/identity/merge` — admin

Une dos fichas de jugador **del mismo equipo** (C-08): `target_id` conserva el id y absorbe a `source_id`. Las filas de `player_game_stats` de la absorbida pasan a la vigente y `source_id` queda con `merged_into`, de modo que `GET /api/player/<source_id>` y cualquier consulta por su nombre resuelven a la ficha vigente. No se modifica ninguna estadística ni nombre crudo.

**Body:** `{ "target_id": 15, "source_id": 41 }`

**Response 200:**
```json
{
  "player": { "player_id": 15, "team_code": "CNF", "display_name": "Jerome Feldeine", "position": "PG", "position_group": "G",
              "games": 13, "games_listed": 13, "aliases": ["J. Feldeine", "Jerome Feldeine"], "competition_ids": [1] },
  "merged": { "source_id": 41, "rows_moved": 1 }
}
```

**Errores:** `400` — `{"error": "Indicá target_id y source_id enteros"}` / `{"error": "No se puede unificar una ficha consigo misma"}` · `401` sin sesión · `403` usuario sin permiso de administrador (`ADMIN_USERS`) · `404` — `{"error": "Jugador no encontrado"}` · `409` — `{"error": "Solo se pueden unificar fichas del mismo equipo"}`.

---

## POST `/api/reprocess` — admin

Re-ejecuta la ingesta vigente sobre partidos ya importados: desde el JSON archivado, o desde FIBA (por id) si el partido se importó antes de que existiera el archivo. Idempotente; conserva la competencia asignada.

- `{ "game_ids": [...], "offset": 0 }` o `{ "competition_id": 1, "offset": 0 }`: procesa un lote de 5 partidos (`ingest.REPROCESS_BATCH`) a partir de `offset`; el cliente repite con `next_offset` hasta que sea `null`. Con 5 por lote, el peor caso (5 descargas de FIBA × 20 s) queda debajo del timeout de 180 s de gunicorn.

**Response:** `{ "processed": ["2849328", …], "failed": [{ "game_id": "…", "error": "motivo" }], "total": 13, "next_offset": 5 }`. Un partido fallido no corta el lote.

Si un partido trae filas repetidas por clave única (dos jugadores del mismo equipo con igual nombre abreviado, eventos sin número), se guarda una sola (jugador: la última ficha; tiro/evento: el primero), igual que la ingesta anterior.

---

## GET `/api/league`

Ranking de todos los equipos ordenado por OER descendente.

**Query params:** `?competition=<id>` (opcional; también acepta el texto de FIBA) — filtra el ranking y sus promedios a los partidos de esa competencia. Sin el parámetro, agrega todas las competencias publicadas. Equipos sin partidos en la competencia se omiten; competencia inexistente → `400`.

**Response:**
```json
[
  {
    "team_code": "FUBB",
    "team_name": "Federación Uruguaya",
    "games": 12,
    "wins": 8, "losses": 4, "table_points": 20,
    "pts_for": 868, "pts_against": 812,
    "standings_pos": 2,
    "oer": 1.05,
    "der": 0.98,
    "net_rating": 0.07,
    "efg_pct": 0.512,
    "ts_pct": 0.548,
    "or_pct": 0.29,
    "dr_pct": 0.71,
    "to_pct": 0.14,
    "pace": 68.5,
    "pts": 72.3,
    "stl": 7.1
  }
]
```

**Tabla general (C-09):** `games` (PJ), `wins` (PG), `losses` (PP), `table_points`, `pts_for` (PF) y `pts_against` (PC) salen de los mismos partidos que el ranking. `table_points = 2 × PG + 1 × PP` y `standings_pos` es la posición en la tabla: más puntos primero, desempate por diferencia `pts_for − pts_against`. Puntos y desempate viven en un solo lugar, `stats_engine.WIN_POINTS` / `LOSS_POINTS` / `standings_sort_key` (DA-31; F-13 los hará configurables). Un marcador igualado cuenta como derrota, para que `wins + losses == games` siempre.

> **Competencia en game_log:** `GET /api/team/<code>` y `GET /api/player/…` incluyen en cada entrada de `game_log` `competition` (texto de FIBA), `competition_id` y `competition_label`. Desde C-02 la selección (competencia + últimos N) se resuelve en el backend: el frontend pide la competencia como query param y recibe solo los partidos filtrados, sin recalcular promedios client-side. `GET /api/search/players` devuelve en `competitions[]` las etiquetas. El `game_log` de equipo está en orden cronológico.

---

## DELETE `/api/games`

**Admin.** Borra uno o más partidos por `game_id`. El borrado es en cascada: elimina también sus `team_game_stats`, `player_game_stats`, `shots`, `pbp_events` y el JSON archivado.

**Request body:**
```json
{ "game_ids": ["12345", "12346"] }
```

**Response 200:**
```json
{ "ok": true, "deleted": 2 }
```

**Errores:**
- `400` — `game_ids[]` ausente o no es lista
- `401` — sin sesión iniciada (ver [Autenticación](#autenticación))
- `403` — el usuario no es administrador

---

## Autenticación

Ver diseño completo en [superpowers/specs/2026-06-06-login-auth-design.md](superpowers/specs/2026-06-06-login-auth-design.md).

Cuando hay credenciales configuradas (`AUTH_USERS`), **todas las rutas de datos exigen sesión iniciada** (cookie de sesión firmada, HttpOnly). Sin sesión → `401`. Abiertas siempre: `/` (SPA), estáticos, `POST /api/login`, `GET /api/me`.

### POST `/api/login`

**Request:** `{ "user": "nico", "password": "..." }`

**Response 200:** `{ "ok": true, "user": "nico" }` + cookie de sesión.

**Errores:** `401` credenciales inválidas · `429` demasiados intentos (5 fallos/IP/60s).

### POST `/api/logout`

Limpia la sesión. **Response:** `{ "ok": true }`.

### GET `/api/me`

Estado de auth + feature flags. Llamada por el SPA al arrancar. Siempre abierta.

**Response:**
```json
{ "authenticated": false, "user": null, "auth_required": true, "seed_enabled": false, "is_admin": false }
```

`seed_enabled` refleja `SEED_ENABLED` (reemplaza al antiguo `/api/config`). `is_admin`: puede modificar datos (ver permisos de escritura arriba); la UI oculta las acciones que no puede ejecutar.

---

## POST `/api/seed` — solo dev

Importa el set fijo de partidos `SEED_URLS` (definido en `app.py`) en una sola operación. Pensado para repoblar el entorno dev sin disco persistente.

**Gating:** requiere sesión iniciada **y** `SEED_ENABLED=true`. Sin la variable (producción) responde `403`; sin sesión, `401`.

**Response 200:**
```json
{
  "ok": true,
  "imported": 12,
  "failed": 1,
  "results": [
    { "url": "...", "ok": true,  "game_id": "2849328", "teams": "A vs B" },
    { "url": "...", "ok": false, "error": "mensaje" }
  ]
}
```

**Errores:** `403` — `SEED_ENABLED` no está habilitado.

---

## Conjunto estándar de métricas (T-05)

Catálogo único de 83 claves en 12 grupos, mismas claves para `team`, `player`, `lineup`, `onoff`, `clutch`.
Ver `docs/metrics.md` §Conjunto estándar para fórmulas y conciliación.

### `GET /api/metrics-catalog`

**Auth:** `login_required`. Sin parámetros.

Response 200:
```json
{
  "version": 1,
  "groups": [{"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]}, ...],
  "metrics": {
    "ppt": {"label": "PPT", "group": "tiro_valor", "fmt": "dec2", "direction": "higher", "kind": "rate",
            "base_mode": "fixed", "rel_dist": true, "entities": ["team","player","lineup","onoff","clutch"], "legacy_keys": ["pps"]}
  },
  "null_reasons": ["sin_intentos", "sin_perdidas", "sin_pbp", "no_registrado", "no_aplica", "sin_datos", "no_disponible", "dnp"]
}
```
(Recorte: `groups` trae 12, `metrics` las 83 claves.) `label` ya aplica `ui.metric_labels` (F-13).

### `GET /api/metrics/<entity_type>?id=<id>[&competition=&last=&base=]`

**Auth:** `login_required`. `entity_type ∈ {team, player, lineup, onoff, clutch}`.

| Param | Valor |
|---|---|
| `id` (obligatorio) | `team`: `team_code` · `player`: `player_id` · `lineup`: `<team_code>:<pid>-<pid>-…` (3–5 ids) · `onoff`: `<team_code>:<pid>` · `clutch`: `team_code` |
| `competition` | id \| `all` \| texto legado (C-02) |
| `last` | entero > 0 |
| `base` | `total` \| `partido` \| `por40` \| `por100` (default `partido`). Conteos: total, ÷ partidos, × 2400/segundos de la entidad, × 100/posesiones (propias o del rival según `per100_den`; jugador: las del equipo con él en cancha, `estimated: true` si se estimaron por minutos). Tasas (`fixed`) iguales en las 4; `volume` en total para por40/por100; denominador 0 → nulo `sin_datos` (T-04) |
| `margin`, `window_secs` | solo `clutch` |

Response 200 (`GET /api/metrics/team?id=VER&competition=1&base=total`, recorte):
```json
{
  "entity": {"type": "team", "id": "VER", "name": "VERDIRROJO", "team_code": "VER"},
  "context": {"competition": {"id": 1, "label": "Liga de Ascenso 2026"}, "games_used": 2, "games_total": 2},
  "base": "total", "sample": null,
  "groups": [{"key": "volumen", "label": "Volumen", "metrics": ["games", "minutes", "possessions", "pace", "sec_per_poss"]}],
  "metrics": {
    "pts":          {"value": 149,    "reason": null},
    "oer":          {"value": 0.966,  "reason": null},
    "blk_received": {"value": null,   "reason": "no_registrado"},
    "uso_pct":      {"value": null,   "reason": "no_aplica"}
  },
  "catalog_version": 1
}
```
Jugador agrega `coverage`: `{"games": 2, "on_court_games_exact": 2, "on_court_games_estimated": 0}`; una métrica
estimada/parcial lleva `"estimated": true` o `"partial": true`. ON/OFF agrega `states: {on: {...}, off: {...}}`
y `diff` (ON − OFF, solo métricas `kind: "rate"`).

**Errores:**
| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `parametro_invalido` | Tipo de entidad desconocido / falta `id` / base inválida |
| 400 | `competencia_inexistente` | La competencia no existe |
| 400 | `contexto_invalido` | Parámetro de contexto inválido |
| 404 | `no_encontrado` | Id inexistente |
| 404 | `sin_pbp` | Quinteto/ON-OFF/cierre sin ningún partido con play-by-play |

### `GET /api/team/<code>` y `GET /api/player/...` — modificados

Agregan la clave `standard` con el mismo payload de arriba (`team` o `player`), calculado con los mismos
`competition`/`last`/`base` de la petición. Las claves existentes no cambian (compatibilidad). Si el cálculo
del bloque falla, la respuesta legado se devuelve igual con `"standard": null`.

---

## Confiabilidad de muestra (T-02)

`GET /api/metrics/<entity_type>` (ver arriba) agrega en la raíz del payload:
```json
"sample": {"level": "media", "unit": "posesiones", "n": 23.5, "min": 19.2, "high": 40,
           "min_source": "relativo", "games": 4, "minutes": 31.5, "possessions": 23.5, "ranked": true}
```
Y en `lineup`/`onoff`/`clutch`, dentro de `metrics.oer`/`metrics.der`/`metrics.net_rating`:
```json
"adj": {"value": 1.1033, "k": 25, "prior": 1.0203, "band": 0.3237}
```
(`null` si no aplica). `team`/`player` traen `sample` pero sin `adj` (sin regresión).

### `POST /api/settings/calibrate` — NUEVO

**Auth:** `admin_required`. Body: `{"entity": "lineup"|"onoff", "competition": <id>}`.

Response 200:
```json
{"entity": "lineup", "competition_id": 3, "method": "partidos_alternos", "units": 42, "units_excluded": 118,
 "n_half_mean": 38.4, "r": 0.452, "k_suggested": 46.6, "k_current": 25, "config_key": "regression.lineup.k", "warnings": []}
```
`warnings` ⊆ `["muestra_insuficiente", "correlacion_no_positiva"]`; con cualquiera, `k_suggested: null`. No
escribe nada — "Aplicar" en la UI llama `PUT /api/settings {values: {"regression.lineup.k": 47}}` (F-13).

**Errores:** `400 parametro_invalido` (entidad fuera de lineup/onoff), `400 competencia_inexistente` (falta,
`all` o inexistente), `401`, `403 requiere_admin`.

---

## Ficha de métrica (T-01)

`GET /api/metrics/<entity_type>` y los bloques `standard` de `/api/team`/`/api/player` agregan, en cada objeto
de `metrics[clave]` (junto a `value`/`reason`/`adj`/`sample`):
```json
"oer": {
  "value": 0.966, "reason": null,
  "rank": 9, "rank_total": 12, "tied": false, "in_population": true, "percentile": 27,
  "avg": 1.0071, "dist_avg": -0.0411, "dist_avg_rel": -0.0408,
  "leader": {"id": "ALB", "name": "ALBATROS", "value": 1.12}, "dist_leader": -0.154, "dist_leader_rel": -0.1375,
  "pct_reason": null, "basis": null
}
```
Sin población: `rank`/`percentile`/`avg`/`leader`/`dist_*` en `null` y `pct_reason ∈ {sin_universo,
poblacion_insuficiente, contexto_no_comparable}`. `basis: "partido"` marca conteos/volumen mostrados en totales
cuyo ranking y distancias están en por partido. El payload agrega `population: {size, criterion, context_label,
reason}`.

### `GET /api/rankings/<entity_type>/<metric_key>` — NUEVO

**Auth:** `login_required`. `entity_type ∈ {team, player, lineup, onoff, clutch}`. Params: `id` (entidad a
resaltar, opcional), `competition`, `last`, `base`.

Response 200:
```json
{"entity_type": "team", "metric": "oer", "direction": "higher", "rank_basis": null,
 "population": {"size": 12, "criterion": "equipos con ≥ 3 partidos", "competition_id": 1, "context_label": "...", "reason": null},
 "rows": [{"rank": 1, "tied": false, "id": "ALB", "name": "ALBATROS", "value": 1.12, "in_population": true, "highlight": false}],
 "outside_population": [{"id": "LBO", "name": "LBO", "value": 1.21, "hypothetical_rank": 1, "highlight": false, "sample": {...}}],
 "avg": 1.0071}
```
Población vacía o `competition=all` → 200 con `rows: []` y `population.reason`. Errores: `400 parametro_invalido`
(tipo/métrica desconocida o métrica que no aplica al tipo), `400 competencia_inexistente`, `400 contexto_invalido`, `401`.

### `GET /api/league` — modificado

Cada fila agrega `in_population`, `rank: {clave: {rank, total, tied}}` y `pct: {clave: p}` (11 claves). Los
valores `oer…stl` pasan a cociente de totales (pooled) de la población; `to_pct` = PER/POS (DA-04). Con
`include=summary`: `{teams: [...], avg: {clave: v}, leaders: {clave: {id,name,value}}, population: {...}}`. Sin
`include`, la lista conserva su forma anterior más las claves nuevas por fila.

---

## `GET /api/settings` — Configuración vigente (F-13)

**Auth:** `login_required`.

Response 200:
```json
{
  "version": 0,
  "is_admin": true,
  "values": {
    "clutch.margin": 10, "clutch.window_secs": 300,
    "standings.win_points": 2, "standings.loss_points": 1,
    "standings.tiebreak": "diferencia",
    "ui.default_competition_id": null
  },
  "sections": [{"slug": "umbrales", "label": "Umbrales de muestra"}, ...],
  "spec": [{"key": "clutch.margin", "type": "int", "default": 10, "min": 0, "max": 40, ...}]
}
```

`values` incluye solo claves **activas**. `spec` incluye todas (activas y reservadas con `status`).

---

## `PUT /api/settings` — Guardar configuración (F-13)

**Auth:** `admin_required`. Body: `{"values": {"clutch.margin": 5}}`.

Response 200: mismo shape que GET con valores actualizados. Errores:
- `400 parametro_invalido` — tipo, rango o coherencia inválida; `details` con error por clave.
- `400 clave_no_disponible` — clave reservada o desconocida.
- `403 requiere_admin`.

---

## `POST /api/settings/reset` — Restablecer configuración (F-13)

**Auth:** `admin_required`. Body: `{"keys": ["clutch.margin"]}` o `{"section": "contexto"}`.

Response 200: mismo shape que GET. Las claves vuelven a su default.

---

## `GET /api/prefs?scope=<scope>` — Preferencias del usuario (F-13)

**Auth:** `login_required`. Scopes: `table.columns`, `table.sort`, `table.colorize`, `panel.collapsed`, `ui`.

Response 200: `{"scope": "panel.collapsed", "values": {"tiro": true}}`.

---

## `PUT /api/prefs` — Guardar preferencia (F-13)

**Auth:** `login_required`. Body: `{"scope": "panel.collapsed", "key": "tiro", "value": true}`.

Response 200: `{"scope": "...", "key": "...", "value": ...}`.

---

## `DELETE /api/prefs` — Borrar preferencia (F-13)

**Auth:** `login_required`. Body: `{"scope": "panel.collapsed", "key": "tiro"}`.

Response 200: `{"scope": "...", "key": "...", "deleted": true}`.

---

## `GET /api/table/<table_id>` — Tabla completa (T-06)

**Auth:** `login_required`. Query params según la tabla:

| `table_id` | Params requeridos | Params opcionales |
|---|---|---|
| `league_teams` | `competition` | `last`, `base` |
| `league_standings` | `competition` | — |
| `team_game_log` | `team`, `competition` | `last`, `base` |
| `player_game_log` | `player_id`, `competition` | `base` |
| `search_players` | `competition` | — |
| `clutch_games` | `team`, `competition` | — |

Response 200:
```json
{
  "table_id": "league_teams",
  "title": "Ranking — Liga Uruguaya 2025/2026",
  "columns": [
    {"key": "oer", "label": "OER", "fmt": "decimal3", "group": "eficiencia", "direction": "higher"}
  ],
  "rows": [
    {
      "entity": "TRO",
      "label": "TROUVILLE",
      "values": [1.057, ...],
      "reasons": [null, ...],
      "pct": [85, ...],
      "sample": {"level": "alta", "ranked": true, "possessions": 640}
    }
  ],
  "totals": {"values": [...], "reasons": [...]},
  "competition_avg": {"values": [...], "reasons": [...]},
  "row_count": 14,
  "context": {"competition": 1, "last": null, "base": "partido"},
  "meta": {
    "generated_at": "2026-10-14T...",
    "generated_by": "admin",
    "app_version": "2.0.0",
    "default_sort": {"key": "net_rating", "dir": "desc"},
    "filters": [{"key": "competition", "label": "Liga Uruguaya 2025/2026"}]
  }
}
```

Errores: 404 `no_encontrado` (tabla inexistente), 400 `parametro_invalido` (param faltante o `base` inválida).

---

## `POST /api/export/xlsx` — Exportar hojas XLSX (T-06)

**Auth:** `login_required`. Body JSON:
```json
{
  "sheets": [
    {
      "title": "Ranking Liga",
      "columns": [{"key": "oer", "label": "OER"}],
      "rows": [[1.057, ...]]
    }
  ],
  "meta": {"title": "Ranking", "generated_at": "...", "generated_by": "admin"}
}
```

Response 200: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` con `Content-Disposition: attachment; filename="..."`.

Errores: 400 (body inválido), 413 (> 10 MB o > 50 000 filas en una hoja).

---

## `GET /api/export/bulk` — Exportación masiva XLSX (T-06)

**Auth:** `login_required`. Query params:

| Param | Requerido | Descripción |
|---|---|---|
| `scope` | sí | `"team"` o `"competition"` |
| `team` | si scope=team | Código del equipo |
| `competition` | sí | ID de competencia (no acepta `"all"`) |

Response 200: XLSX con Portada + una hoja por tabla aplicable al scope. Errores: 400 (scope/competition inválido), 404 (sin datos).
