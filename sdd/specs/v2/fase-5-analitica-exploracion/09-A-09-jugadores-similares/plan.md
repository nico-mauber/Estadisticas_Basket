# Plan — A-09: Jugadores similares

> **ID:** A-09 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 09
> **Depende de:** T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)) · C-03 ([../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)) · C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)); consume T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)), F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md), menú de exportación) y F-03 ([../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md), incremento diferido)
> **Habilita:** F-03 (emparejamiento propuesto por perfil)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.18, §3.4, §3.6, §3.7, §3.2, §4, §6, §7.4, §7.8, §8, §9.2 (I-05)
> **Estimación:** L · 9–13 h

## 1. Enfoque
`backend/similarity.py` (módulo dedicado, Python puro, sin dependencias, DA-37) arma un vector de perfil por jugador a partir de la
**población de jugadores de T-01** (que ya trae los valores del conjunto estándar de T-05 por miembro) más el reparto de tiro por
zona (C-03), normaliza cada dimensión con z-score dentro de la competencia y calcula una distancia euclidiana normalizada sobre las
dimensiones disponibles en ambos jugadores. Un endpoint fino `GET /api/similar/<player_id>` devuelve el top N con la explicación (valores,
z, dimensiones más parecidas y más distintas). En el frontend: componente `similar-players.js`, pestaña "Similares" en Jugador (S4), pestaña
"Similares" en Explorar (S7) con selector de jugador, y acción "Similares" en cada fila del buscador. El mismo servicio alimenta
`suggestions_profile` del informe de F-03. Nada se persiste y no hay cambios de esquema; el resultado se cachea por versión de datos y
configuración.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/similarity.py` | module **NUEVO** | `DIMENSIONS`, `similar_players`, `similar_payload`, `profile_suggestions`, helpers de perfil, z-score, zonas, distancia y posición | RF-1…RF-10, RF-13, RF-14, RF-15, RF-16 |
| `backend/config.py` (F-13) | module (edit) | activar `similar.top_n` (`status: activa`, consumidor A-09) | RF-16 |
| `backend/app.py` | route | `GET /api/similar/<int:player_id>` fina (validación, resolución de competencia, errores §7.8) | RF-1, RF-6, RF-14 |
| `backend/prepare.py` (F-03) | module (edit) | reemplaza `suggestions_profile = None` por `similarity.profile_suggestions(...)` sobre `rival_threats.top_usage` | RF-15 |
| `frontend/js/api.js` | js-api | `api.similar(playerId, params)` | RF-1, RF-11 |
| `frontend/js/components/similar-players.js` | js-component **NUEVO** (PROPUESTA, §10) | `renderSimilarPlayers`, `renderSimilarPicker`, filas expandibles, método, exportación | RF-6, RF-9…RF-12 |
| `frontend/js/views/jugador.js` (X-01) | js-view | habilitar y renderizar la pestaña `similares` (S4) | RF-11 |
| `frontend/js/views/explorar.js` (X-01) | js-view | habilitar la pestaña `similares` (S7) con selector; columna/acción "Similares" en la tabla del buscador | RF-11 |
| `frontend/js/components/prepare-report.js` (F-03) | js-component (edit) | bloque "Perfil parecido en tu plantel (estimación)" cuando `suggestions_profile` no es `null` | RF-15 |
| `frontend/css/style.css` | css | sección `/* ── similar-players (A-09) ── */`: `.sim-filters`, `.sim-table`, `.sim-bar`, `.sim-expand`, apilado <768 px | RF-9 |
| `frontend/sw.js` | sw | con runtime caching (X-01) basta subir `CACHE` al siguiente entero; si no, sumar `/js/components/similar-players.js` a `STATIC` | §9 |
| `docs/api.md` | doc (cierre) | `GET /api/similar/<player_id>`; `suggestions_profile` de `/api/prepare` | — |
| `docs/frontend.md` | doc (cierre) | `similar-players.js`, pestañas Similares (S4, S7), acción del buscador, bloque de F-03, copy nuevo | — |
| `docs/architecture.md` | doc (cierre) | módulo `similarity.py` | — |
| `docs/metrics.md` | doc (cierre) | "Jugadores similares": dimensiones, z-score, distancia, similitud, nulos, método de validación | — |

Matriz RF → archivo: RF-1/RF-13/RF-16 `similarity.py`, `app.py`, `config.py` · RF-2/RF-3 `similarity.py` (dimensiones y zonas) · RF-4/RF-5 `similarity.py`
(z-score y distancia) · RF-6 `similarity.py`, `app.py`, `similar-players.js` · RF-7/RF-8 `similarity.py` · RF-9/RF-10 `similar-players.js`,
`similarity.py` (payload) · RF-11 `jugador.js`, `explorar.js`, `similar-players.js`, `api.js` · RF-12 `similar-players.js` (menú T-06) · RF-14 `similarity.py`,
`app.py` · RF-15 `prepare.py`, `prepare-report.js`, `similarity.py` · RF-17 spec §9 + `progress.md` (protocolo) · RF-18 todos.

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin tablas ni columnas nuevas. Lee `shots` (`court_x`, `court_y`, `action_type`, `sub_type`), `player_game_stats` (`player_id`, `position`) y `games`
(`competition_id`) por consulta y `app_config` (`similar.top_n`) vía `config.get`.

### 3.2 `GET /api/similar/<int:player_id>` — NUEVO (dueño A-09, `login_required`)
Query:
- `competition` (id entero; si falta: la competencia más reciente del jugador, `repository.resolve_competition`). `all` → 400.
- `position` ∈ {`G`, `F`, `C`, `mismo`} (opcional). `mismo` = el grupo del jugador de referencia.
- `min_minutes` (entero ≥ `sample.player.min`; default = `sample.player.min`).
- `top_n` (entero 3–50; default `similar.top_n`).
Los demás parámetros de contexto T-03 (`last`, `venue`, …) se **ignoran**: el perfil usa toda la competencia (spec §9).

Response 200:
```json
{
  "reference": {"player_id": 128, "name": "A. Varela", "team_code": "CNF", "team_name": "Nacional",
                "position": "PG", "position_group": "G", "games": 14, "minutes": 412.5, "mpg": 29.5,
                "in_population": true,
                "sample": {"level": "alta", "unit": "minutos", "n": 412.5, "min": 60, "high": 200, "min_source": "absoluto",
                           "games": 14, "minutes": 412.5, "possessions": null, "ranked": true},
                "profile": [
                  {"key": "uso_pct", "label": "USO%", "fmt": "pct", "value": 0.241, "z": 1.12},
                  {"key": "zonas", "label": "Zonas de tiro", "fmt": "pct", "value": null, "z": null,
                   "detail": {"mode": "11", "top": [{"zone": "restricted_area", "share": 0.31}, {"zone": "top_key_3", "share": 0.18}, {"zone": "mid_top", "share": 0.12}]}},
                  {"key": "or_pct", "label": "OR%", "fmt": "pct", "value": 0.031, "z": -0.64}
                ]},
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "filters": {"position_group": null, "min_minutes": 60, "min_minutes_default": 60, "top_n": 10},
  "dimensions": [
    {"key": "uso_pct", "label": "USO%", "fmt": "pct", "components": 1, "mean": 0.19, "sd": 0.061},
    {"key": "zonas", "label": "Zonas de tiro", "fmt": "pct", "components": 11, "mean": null, "sd": null},
    {"key": "min_pg", "label": "Min/partido", "fmt": "dec1", "components": 1, "mean": 18.4, "sd": 7.9}
  ],
  "population": {"size": 74, "criterion": "jugadores con ≥ 60 minutos", "competition_id": 3, "zone_mode": "11"},
  "results": [
    {"rank": 1, "player_id": 131, "name": "M. Rodríguez", "team_code": "PEN", "team_name": "Peñarol",
     "position": "PG", "position_group": "G", "games": 13, "minutes": 388.0, "mpg": 29.8,
     "distance": 0.4712, "similarity": 68, "dimensions_compared": 9,
     "profile": [{"key": "uso_pct", "value": 0.226, "z": 0.84, "dz": 0.28}],
     "closest": ["uso_pct", "as_pct", "ppt"], "furthest": ["min_pg", "dr_pct"],
     "sample": {"level": "alta", "unit": "minutos", "n": 388.0, "min": 60, "high": 200, "ranked": true}}
  ],
  "excluded": {"perfil_incompleto": 3, "sin_zonas": 1},
  "method": {"distance": "euclidiana normalizada sobre z-scores", "weights": "igual por dimensión (zonas = 1)",
             "min_dimensions": 6, "similarity": "100 / (1 + d)", "population_scope": "toda la competencia"},
  "reason": null
}
```
`reason` ∈ {`null`, `poblacion_insuficiente`, `sin_resultados`}. `reference.profile[*].value/z` nulos con `reason` por dimensión cuando no hay dato
(`{"value": null, "reason": "sin_intentos"}`, formato §7.4). `detail` solo en la dimensión de zonas.

Errores (formato §7.8):
| Caso | HTTP | `code` | `error` |
|---|---|---|---|
| `competition=all` | 400 | `parametro_invalido` | "La similitud necesita una competencia concreta" |
| Competencia inexistente | 400 | `competencia_inexistente` | mensaje de `resolve_competition` |
| `position` fuera de {G,F,C,mismo} | 400 | `parametro_invalido` | "Posición inválida: usá G, F, C o mismo" |
| `position=mismo` sin posición registrada del jugador | 400 | `parametro_invalido` | "Este jugador no tiene posición registrada" |
| `min_minutes` < `sample.player.min` o no numérico | 400 | `parametro_invalido` | "El mínimo de minutos no puede ser menor que {n} (umbral de muestra)" |
| `top_n` fuera de 3–50 | 400 | `parametro_invalido` | "top_n debe estar entre 3 y 50" |
| Jugador inexistente | 404 | `no_encontrado` | "Jugador no encontrado" |
| Jugador sin minutos en la competencia | 404 | `no_encontrado` | "El jugador no tiene minutos en esta competencia" |
| Sin sesión | 401 | — | handler de `api.js` |

### 3.3 Configuración (F-13)
F-13 reserva `similar.top_n` (int, 10, 3–50). A-09 la pasa a `status: activa` y la lee con `config.get`. Las constantes del método (`MIN_DIMENSIONS = 6`,
`ZONE_COVERAGE_MIN = 0.90`, pesos iguales) quedan en `similarity.py` documentadas en `docs/metrics.md`; si el cliente las quiere editables,
F-13 agrega `similar.min_dimensions` y `similar.zone_coverage` (PROPUESTA, §10).

## 4. Backend — lógica

### 4.1 `backend/similarity.py` (NUEVO)
Constantes del módulo:
```
DIMENSIONS = (                                    # orden fijo = orden de presentación
  {"key": "uso_pct", "label": "USO%",            "fmt": "pct",  "metric": "uso_pct"},
  {"key": "zonas",   "label": "Zonas de tiro",   "fmt": "pct",  "metric": None},      # grupo de 11 (o 3) componentes
  {"key": "or_pct",  "label": "OR%",             "fmt": "pct",  "metric": "or_pct"},
  {"key": "dr_pct",  "label": "DR%",             "fmt": "pct",  "metric": "dr_pct"},
  {"key": "as_pct",  "label": "AS%",             "fmt": "pct",  "metric": "as_pct"},
  {"key": "to_pct",  "label": "TO%",             "fmt": "pct",  "metric": "to_pct"},
  {"key": "ppt",     "label": "PPT",             "fmt": "dec2", "metric": "ppt"},
  {"key": "ft_rate", "label": "FT Rate",         "fmt": "dec2", "metric": "ft_rate"},
  {"key": "min_pg",  "label": "Min/partido",     "fmt": "dec1", "metric": None},      # derivada: minutes / games
)
MIN_DIMENSIONS = 6; ZONE_COVERAGE_MIN = 0.90
ZONE3_KEYS = ("paint_fga_share", "mid_fga_share", "fg3_uso")        # claves estándar de T-05 (fallback sin coordenadas)
```
Los valores de `uso_pct`, `or_pct`, `dr_pct`, `as_pct`, `to_pct`, `ppt`, `ft_rate`, `minutes`, `games`, `paint_fga_share`, `mid_fga_share`, `fg3_uso` salen de
`Population.members[*].values` (T-01/T-05); **este módulo no calcula ninguna de esas fórmulas** (regla 4).

| Función | Firma | Algoritmo |
|---|---|---|
| `similar_players` | `similar_players(player_id: int, comp_id: int, *, position_group: str \| None, min_minutes: int, top_n: int, team_code: str \| None = None) -> list[dict]` (`team_code` PROPUESTA) | `return similar_payload(...)["results"]` (firma de la arquitectura §4). |
| `similar_payload` | `similar_payload(player_id, comp_id, *, position_group=None, min_minutes=None, top_n=None, team_code=None, same_position=False) -> dict` (PROPUESTA) | Ver 4.2. Cacheado: `cache.memo("similar", (player_id, comp_id, position_group, same_position, min_minutes, top_n, team_code), fn, max_entries=128)` (la clave se prefija con `data_version`/`config_version`, §3.14). |
| `profile_suggestions` | `profile_suggestions(team_code: str, rival_code: str, comp_id: int, ctx: Context, *, threats: list[dict], top_n: int = 3) -> dict` (PROPUESTA) | Ver 4.4. |
| `_zone_vectors` | `_zone_vectors(comp_id: int) -> dict` | Ver 4.3. Cacheado `cache.memo("similar:zones", (comp_id,), …, max_entries=8)`. |
| `_position_groups` | `_position_groups(player_ids: list[int]) -> dict[int, tuple[str \| None, str \| None]]` | `PlayerGameStats.query.filter(player_id.in_(ids))` (todas las competencias; la posición de la ficha es un atributo estable, C-08); ordena filas por (fecha del partido, `game_id`), agrupa por `player_id`, llama `identity.resolve_identity(rows)` → `(nombre, posición)` y `identity.position_group(posición)`. Devuelve `{player_id: (position, group)}`. |

### 4.2 `similar_payload` — algoritmo
```
cfg: min_pop = config.get("sample.player.min");  top_n = top_n o config.get("similar.top_n")
validar: min_minutes (default min_pop; < min_pop → SimilarityError("parametro_invalido", …, 400)); top_n en 3..50
ctx = Context(competition_id=comp_id, competition_all=False, resto None)          # sin last/venue/...: perfil de toda la competencia
pop = population.population("player", comp_id, ctx)                                # T-01: miembros {id=str(player_id), name, values, sample, in_population}
ref_m = _member(pop, str(player_id));  si None → SimilarityError("no_encontrado", "El jugador no tiene minutos en esta competencia", 404)
miembros_pop = [m para m en pop.members si m.in_population]
si len(miembros_pop) < config.get("population.min_size") → devolver payload vacío con reason "poblacion_insuficiente"
zv = _zone_vectors(comp_id);  zone_mode = zv["mode"]                                # "11" | "3"
# 1) perfil crudo por miembro
para m en pop.members:
    v = m.values;  g = v.get("games");  mi = v.get("minutes")
    raw[m.id] = { uso_pct: v.uso_pct, or_pct: v.or_pct, dr_pct: v.dr_pct, as_pct: v.as_pct, to_pct: v.to_pct, ppt: v.ppt, ft_rate: v.ft_rate,
                  min_pg: mi / g si mi no es None y g (> 0) sino None,                # C-11: nulo, no 0
                  zonas: zv["shares"].get(int(m.id)) si zone_mode == "11" sino [v.paint_fga_share, v.mid_fga_share, v.fg3_uso] (None si alguno es None) }
# 2) media y desvío por dimensión / componente sobre miembros_pop (valores no nulos)
para cada dimensión escalar d: vals = [raw[m.id][d] para m en miembros_pop si no None];  si len(vals) < population.min_size → d inactiva
        mean_d = mean(vals);  sd_d = pstdev(vals);  si sd_d == 0 → d inactiva
para zonas: por componente c: ídem; componente con sd 0 se descarta; grupo sin componentes activos → inactivo
G_activos = dimensiones activas (≤ 9)
# 3) z por miembro
z[m.id][d] = (x − mean_d)/sd_d  (None si x es None);  zonas: lista de z por componente activo (None si el vector es None)
# 4) distancia con la referencia
sq_por_dimension(a, b): para cada d activa: escalar → (za − zb)² si ambos no None;  zonas → mean_c (za_c − zb_c)² si ambos vectores no None
distancia(a, b): L = sq_por_dimension;  n = len(L);  si n < MIN_DIMENSIONS → None (candidato excluido: "perfil_incompleto")
                 d = sqrt( sum(L.values()) / n );  similitud = round(100 / (1 + d))
# 5) candidatos
candidatos = [m para m en miembros_pop si m.id != str(player_id)]
filtrar: m.values["minutes"] >= min_minutes;  si team_code: team del miembro == team_code (para F-03);
         si position_group: _position_groups(...)[int(m.id)][1] == position_group;  si same_position: == grupo de la referencia
excluded = {"perfil_incompleto": n, "sin_zonas": n}      # contadores informativos
resultados = sorted([(d, nombre, m)], key=(d, nombre))[:top_n]
cada resultado: rank, ids, posición/grupo, equipo, games, minutes, mpg, distance (4 dec.), similarity, dimensions_compared, profile[{key, value, z, dz = z_ref − z}],
                closest = 3 dimensiones de menor sq;  furthest = 2 de mayor sq;  sample = m.sample
ref payload: igual + in_population (ref_m.in_population), sample (T-02) y, si no está en población, se calcula igual con la media/desvío de la población
dimensions: [{key, label, fmt, components, mean, sd}] (solo activas; zonas con mean/sd null)
population: {size: len(miembros_pop), criterion: f"jugadores con ≥ {min_pop} minutos", competition_id, zone_mode}
reason: "sin_resultados" si la lista queda vacía (con candidatos filtrados) sino null
```
**Fórmulas (z-score, distancia, similitud):**
`z_d = (x_d − media_d) / desvío_d` (desvío poblacional `statistics.pstdev` sobre los miembros `in_population` con valor no nulo);
`d(a, b) = √( (1/n) · Σ_{k ∈ dims comparables} s_k )`, con `s_k = (z_{a,k} − z_{b,k})²` para dimensiones escalares y `s_k = (1/m) · Σ_{c=1..m} (z_{a,c} − z_{b,c})²`
para la dimensión de zonas (m componentes de zona activos); `n` = cantidad de dimensiones comparables (≥ 6); `similitud = round(100 / (1 + d))`.
Propiedades: simetría (`d(a,b) = d(b,a)`), `d(a,a) = 0` y `similitud = 100`; `d` es la diferencia estandarizada promedio (en desvíos).

**Nulos (C-11):** un valor nulo no se imputa; reduce `n`. `profile[*]` de la referencia o del candidato lleva `{value: null, reason}` (razón de la
métrica o `sin_coordenadas` para zonas). Candidatos con `n < 6` → `excluded.perfil_incompleto`.

**Casos borde:** referencia sin posición con `position=mismo` → 400 (spec §9); competencia con < `population.min_size` jugadores → `reason: poblacion_insuficiente`;
empates de distancia → orden por nombre; `top_n` mayor que los candidatos → lista corta sin error; DNP no cuenta (`games` de T-05 ya los excluye);
jugador con `games = 0` → `min_pg` nulo.

### 4.3 `_zone_vectors(comp_id)` — reparto por zona
```
rows = SELECT s.game_id, s.team_code, s.player_name, s.action_type, s.sub_type, s.court_x, s.court_y, p.player_id
       FROM shots s JOIN games g ON g.game_id = s.game_id AND g.competition_id = :comp_id
       LEFT JOIN player_game_stats p ON p.game_id = s.game_id AND p.team_code = s.team_code AND p.player_name = s.player_name
       WHERE p.player_id IS NOT NULL
agrupa por player_id;  total_fga = len(rows);  con_coord = filas con court_x y court_y no nulos
cobertura_poblacion = Σ con_coord / Σ total_fga
mode = "11" si cobertura_poblacion >= ZONE_COVERAGE_MIN sino "3"
si mode == "11":
    por jugador: si con_coord / total_fga < ZONE_COVERAGE_MIN → shares = None (excluded.sin_zonas)
                 sino  zt = shot_zones.zone_table(filas con coordenadas);  shares = [zt["zones"][z]["share"] para z en ZONE_KEYS_11]
devuelve {"mode": mode, "shares": {player_id: shares | None}}
```
`shot_zones.zone_table` y `ZONE_KEYS_11` son de C-03 (movidos desde `app.py`). `share` = intentos de la zona / total de intentos del jugador (`share` de zonas sin
intentos = 0,0: es una proporción real, no un dato faltante). En modo `"3"` no se consulta `shots`: las tres proporciones salen de los valores estándar del miembro de
la población (`paint_fga_share`, `mid_fga_share`, `fg3_uso`); si alguna es nula, la dimensión de zonas de ese jugador es nula.

### 4.4 `profile_suggestions` (incremento de F-03)
```
profile_suggestions(team_code, rival_code, comp_id, ctx, *, threats, top_n=3) -> dict
    # threats = rival_threats["top_usage"] de F-03: [{player_id, name, uso_pct}]
    filas = []
    para t en threats:
        try: res = similar_payload(t.player_id, comp_id, team_code=team_code, min_minutes=sample.player.min, top_n=top_n)
        except SimilarityError como e: filas += [{threat: t, candidates: [], reason: e.code}]; continuar
        cand = [{player_id, name, similarity, distance, minutes_per_game: r.mpg, uso_pct: pop.values.uso_pct, sample: r.sample} para r en res.results]
        filas += [{threat: {player_id, name, uso_pct, team_code: rival_code}, candidates: cand, reason: res.reason}]
    devuelve {"estimate": True, "method": "perfil parecido (A-09)", "disclaimer": "Estimación por parecido de perfil. FIBA LiveStats no registra la asignación defensiva: no es marcaje individual.", "rows": filas}
```
`ctx` se acepta por compatibilidad con la firma de F-03 pero no filtra el perfil (spec §9). `team_code` restringe a los candidatos del equipo propio. Si `threats` está
vacío → `rows: []` y F-03 no muestra el bloque. En `prepare.py` la llamada va dentro de `try/except` para que un fallo de A-09 no rompa el informe
(`suggestions_profile` queda `null` y se registra el error).

## 5. Frontend — capa API
- `similar: (playerId, params) => apiFetch(`/api/similar/${playerId}${qs(params)}`)` — `params = {competition, position, min_minutes, top_n}`; `qs()` de T-05.
  Sin `fetch` fuera de `api.js`.
- Consumidos: `api.competitions()` (selector de competencia), `api.searchPlayers()` (lista del selector de S7; ya cargada por el buscador).

## 6. Frontend — UI

**`components/similar-players.js`** (PROPUESTA de nombre; la arquitectura §8 no lo lista):
- `renderSimilarPlayers(el, payload, {status = "ok", errorMessage = "", onFilterChange, onRetry})`:
  - `.sim-ref`: tarjeta del jugador de referencia (nombre con enlace a `#/jugador/<id>/resumen`, equipo, posición FIBA, partidos, min/partido, `sampleBadge`) y, si
    `!reference.in_population`, aviso "Este jugador tiene pocos minutos ({m} min): el parecido es orientativo.".
  - `.sim-filters`: `<select class="sim-comp">` (competencias de `api.competitions()`), `<select class="sim-pos">` ("Todas", "Base/Escolta (G)", "Alero/Ala-pívot (F)", "Pívot (C)",
    "Misma posición") y `<input type="number" class="sim-min" min="{min_minutes_default}">` ("Minutos mínimos"). Cambios disparan `onFilterChange({competition, position, min_minutes})`
    con debounce de 300 ms.
  - `.sim-method`: "Parecido = diferencia promedio en nueve dimensiones estandarizadas dentro de la competencia ({population.size} jugadores con ≥ {m} min). Los filtros de período no
    afectan al parecido." + modo de zonas ("Zonas: 11 zonas" / "Zonas: pintura, media distancia y triples").
  - `.sim-table`: columnas #, Jugador (enlace), Equipo, Pos, PJ, Min/PJ, Parecido (barra `.sim-bar` con el número 0–100), "Se parecen en" (`closest`), "Difieren en" (`furthest`)
    y botón ▸ que expande la fila `.sim-expand`: tabla de las nueve dimensiones (Dimensión · Referencia · Jugador · Diferencia en z), con las zonas como "top 3 de zonas" de cada uno
    (copy de zonas en una constante local: `restricted_area` "Área restringida", `mid_left_close` "Media corta izq.", `mid_right_close` "Media corta der.", `mid_left_far` "Media larga izq.",
    `mid_right_far` "Media larga der.", `mid_top` "Media frontal", `left_corner_3` "Triple esquina izq.", `right_corner_3` "Triple esquina der.", `left_wing_3` "Triple ala izq.",
    `right_wing_3` "Triple ala der.", `top_key_3` "Triple frontal"). Valores con `fmtNumber`/`PCT` (es-UY); nulos con `nullDisplay(reason)`.
  - Exportación: contenedor `.sim-export` con `exportMenu(el, {getData, getNode, formats})` de T-06; `getData()` arma `{meta, columns, rows}`: meta = jugador de referencia, competencia,
    filtros (§7.7 de la arquitectura), columnas = #, jugador, equipo, posición, PJ, Min/PJ, parecido, distancia y las nueve dimensiones; `getNode` = el contenedor de la tabla.
  - Estados: loading ("Buscando jugadores parecidos…"), vacío ("Ningún jugador cumple los filtros."), error ("No se pudieron buscar jugadores parecidos" + "Reintentar"),
    offline ("Sin conexión: se muestran los últimos resultados cargados" si hay payload).
- `renderSimilarPicker(el, {players, selectedId, onPick})`: input de texto con lista filtrada (máx. 20, por nombre/equipo; sin acentos con `norm_name`-equivalente del cliente) sobre
  `players` de `api.searchPlayers()` (cada fila con `player_id`, `player`, `team_code`, `position`); `onPick(playerId)`.

**`views/jugador.js` (S4):** habilitar la pestaña `similares` (`registerTab('jugador', {slug: 'similares', enabled: true, render})`). `render(el, route)`: `playerId = route.id`;
filtros desde la query de la ruta (`position`, `min_minutes`) y `competition` del contexto (`core/context.js`); `loadSimilar()` → `renderSimilarPlayers(el, null, {status: "loading"})` →
`api.similar(playerId, {...})` → render; `onFilterChange` actualiza la query con `navigate('jugador', {id, tab: 'similares', query, replace: true})`. Contador de pedido (la última gana).
Los parámetros de contexto de período se ignoran (la leyenda lo aclara).

**`views/explorar.js` (S7):** habilitar la pestaña `similares`. Sin `?player=`: `renderSimilarPicker` ("Elegí un jugador para ver sus parecidos."); con `?player=<id>`: igual que S4 pero con el
selector arriba para cambiar de jugador. En la pestaña `jugadores` (buscador), `_renderSearchResults` agrega una columna final "Similares" con un botón por fila que hace
`navigate('explorar', {tab: 'similares', query: {player: p.player_id}})` y `event.stopPropagation()` (la fila sigue abriendo el perfil del jugador).

**`components/prepare-report.js` (F-03):** función `renderProfileSuggestions(s)`: si `s` es `null` o sin `rows` → cadena vacía. Si no: sección "Perfil parecido en tu plantel — estimación"
con el aviso `s.disclaimer` y, por fila, "Amenaza: {nombre} ({USO%})" → lista de hasta 3 candidatos "{nombre} · parecido {similarity} · {min/partido} min · USO% {uso}"; fila con `reason` →
"Sin perfil suficiente para esta amenaza". El bloque no es plegable y se incluye en la exportación del informe.

**Componentes compartidos reutilizados (arquitectura §8):** `sample-badge.js` (T-02), `export-menu.js` / `exporters.js` (T-06), `core/format.js` (`fmtNumber`, `PCT`, `nullDisplay`),
`core/context.js` (T-03), `core/router.js` y `components/tabs.js` (X-01).

**Móvil (<768 px):** filtros apilados a ancho completo; la tabla queda en `.table-wrap` con scroll interno (sin scroll de la página) y se ocultan las columnas "Se parecen en" / "Difieren en"
(se ven al expandir la fila); la barra de similitud sigue visible.

## 7. Navegación
- S4: `#/jugador/<player_id>/similares[?position=G&min_minutes=200]`.
- S7: `#/explorar/similares[?player=<player_id>&position=…&min_minutes=…]` (el parámetro `player` es propio de esta pestaña, no del contexto T-03).
- `docs/frontend.md` actualiza el mapa de vistas: S4 › Similares y S7 › Similares habilitadas.

## 8. Contratos de datos
- Respuesta de `/api/similar`: §3.2. Claves **fijas** para F-03: `results[].{player_id, name, similarity, distance, mpg, sample}`; `reference.in_population`.
- `suggestions_profile` (F-03): `{estimate: true, method, disclaimer, rows: [{threat: {player_id, name, uso_pct, team_code}, candidates: [{player_id, name, similarity, distance, minutes_per_game, uso_pct, sample}], reason}]}`.
- Estado de filtros: query de la ruta (`position`, `min_minutes`, `player`).

## 9. Manejo de errores y offline
| Situación | Mensaje (español) |
|---|---|
| 400 `parametro_invalido` | mensaje del backend bajo los filtros |
| 400 `competencia_inexistente` | "La competencia elegida no existe" |
| 404 `no_encontrado` | "No encontramos este jugador en la competencia elegida" |
| 401 | handler global de `api.js` |
| 5xx / red | "No se pudieron buscar jugadores parecidos" + "Reintentar" |
| Sin conexión | "Sin conexión: se muestran los últimos resultados cargados" |
- `sw.js`: subir `CACHE` al siguiente entero al integrar (hoy `smart-basket-v13`; lo asigna la integración, arquitectura §3.13); sumar `/js/components/similar-players.js` a `STATIC` solo si X-01
  no pasó a runtime caching.

## 10. Riesgos / decisiones
- **PROPUESTA (no está en 00-arquitectura-transversal.md): `similar_payload` y `profile_suggestions`.** La arquitectura §4 fija solo `similar_players(player_id, comp_id, *, position_group,
  min_minutes, top_n) -> list[dict]`; el endpoint y F-03 necesitan el sobre (referencia, método, población, excluidos) y la función de sugerencias. Se agrega además el kwarg `team_code`
  a `similar_players`. Reportado en huecos.
- **PROPUESTA: `components/similar-players.js`.** No figura en la tabla §8; las pantallas S4 y S7 comparten la tabla de resultados. Reportado en huecos.
- **PROPUESTA: no se registra una tabla de T-06 (`tables.register_table`).** El builder del registro devuelve `StatBundle` y esta tabla mezcla columnas de similitud (no del catálogo); se exporta con el
  menú genérico de T-06 (`getData`). Si T-06 admite tablas "custom" cuando se implemente A-09, se migra. No se agrega ningún id a la lista de la arquitectura §6.
- **PROPUESTA: constantes del método fuera de configuración** (`MIN_DIMENSIONS`, `ZONE_COVERAGE_MIN`, pesos iguales). La arquitectura no define claves; F-13 puede agregar `similar.min_dimensions` y
  `similar.zone_coverage` si el cliente las quiere editables (T-02 exige que los umbrales de muestra no estén fijos; estas son parámetros del método).
- **PROPUESTA: namespace de caché `similar` y `similar:zones`** (la arquitectura §3.14 fija otros namespaces; los nuevos siguen la misma regla de versión).
- **Decisión: euclidiana sobre z-scores** (spec §9): preserva el nivel de uso y de producción; el coseno descarta la magnitud. Se registra para que el cliente pueda objetar tras la validación manual.
- **Riesgo: valor del protocolo de validación sobre pocos datos.** Con los 13 partidos del seed, pocos jugadores superan 60 minutos y el top 10 se agota; la validación debe correrse con la competencia real
  más completa (`tasks.md`, dependencias externas). Si el cliente no la aprueba, los ajustes (pesos, dimensiones) son decisiones nuevas, no parámetros a tocar.
- **Riesgo: interpretación del emparejamiento de F-03.** Se interpreta como "perfil parecido" (spec §9, `[NEEDS CLARIFICATION]`); si el cliente quería complementariedad, `profile_suggestions` cambia
  (la distancia se invierte en las dimensiones defensivas), pero el contrato del bloque se mantiene.
- **Riesgo: zonas.** Si F-11/C-03 no reprocesaron todos los partidos, la cobertura de coordenadas es baja y el modo cae a 3 zonas (`population.zone_mode`); la pantalla lo informa.
- **Riesgo: rendimiento.** ~200 jugadores × 9 dimensiones = milisegundos; el costo está en `_zone_vectors` (una consulta de `shots` de la competencia; ~12.000 filas) cacheada por versión de
  datos. CA-15 mide frío/caliente.
- **Riesgo: dependencia de `player_id`.** `_zone_vectors` une `shots` con `player_game_stats.player_id` (C-08); un partido sin `player_id` completado deja a sus tiros fuera (cuenta en `sin_zonas`).
  Mitigación: `identity.backfill_player_ids()` de C-08 corre en `upgrade_db()`.
- **Incrementos diferidos.** Ninguno propio: A-09 **completa** el incremento diferido de F-03 (RF-15).
- **Dependencias técnicas.** `population.population` (T-01, [plan](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)); claves estándar `uso_pct`, `or_pct`, `dr_pct`, `as_pct`, `to_pct`,
  `ppt`, `ft_rate`, `minutes`, `games`, `paint_fga_share`, `mid_fga_share`, `fg3_uso` (T-05, [plan](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md));
  `shot_zones.zone_table`, `ZONE_KEYS_11` (C-03, [plan](../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md)); `identity.resolve_identity`, `identity.position_group`,
  `player_game_stats.player_id` (C-08, [plan](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)); `sample.sample_level` / `components/sample-badge.js` (T-02,
  [plan](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)); `config.get`, `similar.top_n`, `sample.player.min`, `population.min_size` (F-13,
  [plan](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `components/export-menu.js` / `exporters.js` (T-06, [plan](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md));
  `views/jugador.js`, `views/explorar.js`, `registerTab`, `navigate` (X-01, [plan](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md));
  `repository.resolve_competition`, `cache.memo` (F-11, [plan](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `prepare.py`, `rival_threats.top_usage`, `prepare-report.js` (F-03, [plan](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md)).
- **Estimación:** L · 9–13 h (similarity.py con perfiles, z-score, zonas y distancia 3–4 h; endpoint y config 1 h; componente y dos vistas con acción del buscador 3 h; incremento de F-03 en
  backend y UI 1,5–2 h; estilos 0,5 h; docs 1 h; verificación y protocolo de validación 1,5–2 h). La arquitectura §9.1 estima M 6–10 h sin contar el incremento de F-03 ni el protocolo.
