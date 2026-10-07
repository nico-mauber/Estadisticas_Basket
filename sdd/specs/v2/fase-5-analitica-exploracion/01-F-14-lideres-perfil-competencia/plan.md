# Plan — F-14: Líderes y perfil de competencia

> **ID:** F-14 · **Prioridad:** P2 · **Fase y orden:** 5·01
> **Depende de:** T-01, A-02, F-13, T-04 (y T-05, T-02, T-06, X-01, C-02 vía ellos) — ver [spec.md](spec.md)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4 · F-14 · Arquitectura §3.6, §3.2, §3.12, §4, §6, §7.1b, §7.3, §7.5, §7.6, §8
> **Estimación:** M · 6–10 h

## 1. Enfoque

Un módulo backend dedicado `backend/competition_profile.py` (Arq. §4; capa estadística sin persistencia, DA-37) con dos
funciones públicas —`leaders` y `profile`— que **solo consumen** las funciones de T-01 (`population.population`,
`league_reference`, `rank`, `percentile`, `full_ranking`) y el catálogo de T-05: F-14 no define ninguna fórmula ni ninguna
población propia, por eso sus números coinciden con los de las fichas (CA del cliente). Dos rutas finas en `app.py`
(`/api/leaders`, `/api/competition-profile`), la tabla `leaders` registrada en T-06 (`tables.register_table`), dos claves de
configuración activadas (`leaders.min_minutes`, `leaders.top_n`) y, en el frontend, dos componentes (`leaders-panel.js`,
`profile-panel.js`) que X-01 monta en las pestañas `lideres` y `perfil` de S2 (Liga). Sin cambios de esquema.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/competition_profile.py` | module NUEVO (Arq. §4) | `LEADER_DEFAULT_METRICS`, `PROFILE_SECTIONS`, `effective_min_minutes`, `leaders`, `leaders_payload`, `leaders_cards`, `leaders_table_rows`, `profile`, registro de la tabla `leaders` | RF-1…RF-15 |
| `backend/population.py` (T-01) | module (consumo + PROPUESTA) | se consume sin cambios salvo dos extensiones aditivas: kwarg `base` (compartido con T-06) y campos `team_code`/`reasons` en los miembros de jugador (ver §10) | RF-7, RF-12, RF-13 |
| `backend/tables.py` (T-06) | module (registrar) | `register_table("leaders", entity_type="player", title=…, builder=competition_profile.leaders_table_rows, default_columns=[…], required_params=("metric",), bulk_scopes=("competition",))` | RF-2, RF-15 |
| `backend/config.py` (F-13) | module | pasar `leaders.min_minutes` y `leaders.top_n` de `reservada` a `activa` (nombre, default y rango ya declarados por F-13) | RF-16 |
| `backend/app.py` | route | `GET /api/leaders`, `GET /api/competition-profile` (finas); `import competition_profile` para que se registre la tabla | RF-1…RF-14 |
| `frontend/js/api.js` | js-api | `api.leaders(params)`, `api.competitionProfile(params)` | RF-1, RF-8 |
| `frontend/js/components/leaders-panel.js` | js-component NUEVO (PROPUESTA de archivo) | tarjetas por métrica, selector de métrica, campo de mínimo de minutos, tabla completa con `createDataTable` | RF-1…RF-6, RF-15, RF-17 |
| `frontend/js/components/profile-panel.js` | js-component NUEVO (PROPUESTA de archivo) | selector Equipos/Jugadores, cuatro bloques, ranking inline, exportación | RF-8…RF-12, RF-15 |
| `frontend/js/views/liga.js` (X-01) | js-view | habilita y renderiza las pestañas `lideres` y `perfil`; recuerda `metric`, `min_minutes`, `entity` en la query | RF-17 |
| `frontend/css/style.css` | css | sección `/* ── leaders-profile (F-14) ── */` | RF-1, RF-8 |
| `frontend/sw.js` | sw | `leaders-panel.js` y `profile-panel.js` a `STATIC` y `CACHE` +1 **solo** si X-01 aún no pasó a runtime caching | RF-1 |
| `docs/api.md` | doc | 2 endpoints nuevos, tabla `leaders`, errores | cierre |
| `docs/frontend.md` | doc | pestañas Líderes y Perfil de Liga, componentes, copy nuevo | cierre |
| `docs/metrics.md` | doc | cómo se definen líderes y promedios de referencia (misma población que los percentiles) | cierre |
| `docs/architecture.md` | doc | módulo `competition_profile.py` | cierre |

Matriz RF → archivo: RF-1/RF-2 (`competition_profile.py`, `leaders-panel.js`, `tables.py`) · RF-3 (`competition_profile.py`
`effective_min_minutes`, `config.py`) · RF-4 (`competition_profile.py`, `leaders-panel.js`) · RF-5 (`competition_profile.py`, catálogo
`direction`) · RF-6 (`competition_profile.py`) · RF-7 (`competition_profile.py` ↔ `population.py`) · RF-8…RF-11
(`competition_profile.py`, `profile-panel.js`) · RF-12 (`competition_profile.py`) · RF-13 (`app.py` + `context.py`) · RF-14
(`app.py`, `competition_profile.py`, paneles) · RF-15 (`tables.py`, `profile-panel.js` + `export-menu.js`) · RF-16
(`config.py`) · RF-17 (`liga.js`, paneles).

## 3. Backend — rutas y modelos

Sin modelos nuevos ni `upgrade_db()`. Ambas rutas con `login_required`; errores en el formato de Arq. §7.8
`{"error", "code", "details"}` (F-11 mantuvo `{"error"}`; `code`/`details` son campos adicionales compatibles).

### 3.1 `GET /api/leaders` (NUEVO — Arq. §6)

- **Parámetros**: `competition` (id; obligatorio en la práctica, ver errores), `last` y el resto del contexto T-03 (en
  fase 5 todos los de §3.8, parseados por `context.parse_context`), `base` (`total`|`partido`|`por40`|`por100`, default
  `ui.default_base`), `metric` (clave del catálogo aplicable a `player`; omitida ⇒ tarjetas), `min_minutes` (int 0–2000;
  default `leaders.min_minutes`), `top` (int 3–50; default `leaders.top_n`).
- **Response 200 con `metric`** (ejemplo con valores ilustrativos, competencia "Liga de Ascenso 2026"):
```json
{
  "metric": {"key": "ast", "label": "AS", "fmt": "int", "direction": "higher", "neutral": false},
  "entity_type": "player",
  "min_minutes": {"requested": 60, "effective": 60, "default": 60, "floor": 60, "raised": false},
  "top_n": 10,
  "population": {"size": 32, "criterion": "jugadores con ≥ 60 min", "competition_id": 1, "context_label": "Toda la competencia"},
  "eligible": 32,
  "excluded_null": {"count": 0, "reason": null},
  "rows": [
    {"rank": 1, "tied": false, "player_id": 12, "name": "C. Zinaich", "team_code": "ALB",
     "value": 5.5, "minutes": 71.2, "games": 2, "percentile": 98, "population_rank": 1,
     "sample": {"level": "media", "unit": "minutos", "n": 71.2, "min": 60, "high": 200, "ranked": true}},
    {"rank": 2, "tied": true, "player_id": 31, "name": "J. Feldeine", "team_code": "TRO", "value": 4.5, "minutes": 64.0,
     "games": 2, "percentile": 94, "population_rank": 2, "sample": {"level": "media", "unit": "minutos", "n": 64.0, "ranked": true}}
  ],
  "cut_tied": false,
  "avg": 1.62,
  "leader": {"id": "12", "name": "C. Zinaich", "value": 5.5},
  "context": {"competition": {"id": 1, "label": "Liga de Ascenso 2026"}, "applied": {}, "ignored": [], "level": "partido",
              "population_mode": "apply_all", "games_used": 13, "games_total": 13, "games_excluded": {"sin_pbp": 0},
              "label": "Toda la competencia"},
  "base": "partido"
}
```
  - `rows[*].rank` = puesto dentro de la lista de elegibles (competición estándar "1224"); `population_rank` = puesto de T-01
    en la población completa (coinciden cuando el mínimo efectivo es el de la población). `percentile` = `population.percentile`
    (el de la ficha). `leader` y `avg` son los de la ficha de T-01 para esa métrica (no los de la lista filtrada).
  - Métrica `lower`: `"direction": "lower"` y `rows` ordenadas ascendente; métrica `neutral`: `"neutral": true` (la UI
    rotula "Mayor valor").
  - `excluded_null`: jugadores de la población sin valor en la métrica (`reason` = la razón más frecuente, p. ej.
    `no_registrado`).
- **Response 200 sin `metric`** (tarjetas): `{"cards": [<objeto de "con metric" sin context/base>, …], "min_minutes": {…},
  "top_n": 10, "context": {…}, "base": "partido"}` — una tarjeta por clave de `LEADER_DEFAULT_METRICS` (§4.1).
- **Errores**:
  - 400 `{"error": "Elegí una competencia para ver líderes y perfil.", "code": "parametro_invalido", "details": {"param": "competition"}}` (`competition` vacío o `all`).
  - 400 `{"error": "La competencia no existe.", "code": "competencia_inexistente"}` (propagado de `competitions.resolve`).
  - 400 `{"error": "Métrica inválida: foo", "code": "parametro_invalido", "details": {"param": "metric"}}` (clave inexistente o con `no_aplica` para jugador).
  - 400 `{"error": "Mínimo de minutos inválido (0–2000)", "code": "parametro_invalido"}`; ídem `top` (3–50) y `base`.
  - 400 `contexto_invalido` (propagado de `parse_context`).
  - Sin error: población insuficiente ⇒ 200 con `rows: []`, `eligible: 0` y `"reason": "poblacion_insuficiente"` en la raíz.

### 3.2 `GET /api/competition-profile` (NUEVO — Arq. §6)

- **Parámetros**: `competition`, `last` y contexto T-03, `base` (default `ui.default_base`), `entity` (`team`|`player`, default `team`).
- **Response 200** (`entity=team`):
```json
{
  "entity_type": "team",
  "population": {"size": 14, "criterion": "equipos con ≥ 2 partidos", "competition_id": 1, "context_label": "Toda la competencia", "reason": null},
  "sections": [
    {"key": "referencia", "label": "Promedios de referencia", "rows": [
      {"key": "oer", "label": "OER", "fmt": "dec2", "direction": "higher", "avg": 1.0412, "n": 14, "reason": null,
       "leader": {"id": "TRO", "name": "Trouville", "value": 1.1283}, "ranking": "/api/rankings/team/oer"},
      {"key": "to_pct", "label": "TO%", "fmt": "pct", "direction": "lower", "avg": 0.1521, "n": 14, "reason": null,
       "leader": {"id": "ALB", "name": "Albatros", "value": 0.1204}, "ranking": "/api/rankings/team/to_pct"}
    ]},
    {"key": "ritmo", "label": "Ritmo", "rows": [{"key": "pace", "label": "PACE", "fmt": "dec1", "direction": "neutral", "avg": 78.4, "n": 14, "reason": null, "leader": {"id": "UPA", "name": "Unión Pablo", "value": 82.1}, "ranking": "/api/rankings/team/pace"}]},
    {"key": "reparto_tiro", "label": "Reparto de tiro", "rows": [{"key": "fg3_uso", "label": "Uso de triple", "fmt": "pct", "direction": "neutral", "avg": 0.3412, "n": 14, "reason": null, "leader": {"id": "MON", "name": "Montevideo", "value": 0.402}, "ranking": "/api/rankings/team/fg3_uso"}]},
    {"key": "ppp_origen", "label": "PPP por origen de posesión", "available": true, "classified_possessions": 2410,
     "rows": [
       {"origin": "rebote_defensivo", "label": "Tras rebote defensivo", "possessions": 1030, "share": 0.4274,
        "ppp": {"value": 1.0388, "reason": null, "n": 14}, "ranking": "/api/rankings/origin/ppp"},
       {"origin": "tiempo_muerto", "label": "Saque de fondo tras tiempo muerto", "possessions": 41, "share": 0.017,
        "ppp": {"value": null, "reason": "poblacion_insuficiente", "n": 2}, "ranking": null}
     ]}
  ],
  "context": {"competition": {"id": 1, "label": "Liga de Ascenso 2026"}, "applied": {}, "ignored": [], "level": "partido", "population_mode": "apply_all", "games_used": 13, "games_total": 13, "games_excluded": {"sin_pbp": 0}, "label": "Toda la competencia"},
  "base": "partido"
}
```
  (Los nombres de equipo son ilustrativos.) `n` = entidades de la población con valor (denominador del promedio). `entity=player`:
  secciones `referencia` y `reparto_tiro` de jugadores; `ritmo` y `ppp_origen` ausentes.
  - `avg` es **idéntico** a `population.league_reference(entity_type, comp_id, ctx, base=base)[key]`; `leader` es el primer
    puesto de `population.full_ranking`.
  - Población menor que `population.min_size`: cada fila con `avg: null`, `reason: "poblacion_insuficiente"` y `population.reason` igual.
  - `ppp_origen.available = false` con `reason: "requiere_posesiones"` si el tipo `origin` no está registrado o ningún partido
    tiene pbp.
- **Errores**: los de `/api/leaders` (competencia, base, contexto) y 400 `{"error": "Entidad inválida: usá team o player", "code": "parametro_invalido"}`.

### 3.3 Tabla `leaders` (`GET /api/table/leaders`, T-06)

`tables.register_table("leaders", entity_type="player", title="Líderes — {métrica}", builder=leaders_table_rows,
default_columns=["_name", "_team", "games", "minutes", "<métrica>"], required_params=("metric",), default_sort=<métrica según
dirección>, bulk_scopes=("competition",))` (los kwargs opcionales son los de T-06). Parámetros: `metric`, `min_minutes`, contexto,
`base`. Payload §7.6: una fila por jugador que califica (todos, no solo el top), `totals` = `none` (`no_aplica`),
`competition_avg` = `league_reference("player", …)`. Errores como T-06.

### 3.4 Configuración (F-13)

| Clave | Tipo | Default | Rango | Sección | Consumidor |
|---|---|---|---|---|---|
| `leaders.min_minutes` | int (min) | 60 | 0–2000 | Preferencias | `effective_min_minutes` |
| `leaders.top_n` | int | 10 | 3–50 | Preferencias | `leaders_payload` |

F-13 las declara `reservada (→ F-14)`; F-14 las pasa a `activa` (T-A1). Se leen siempre con `config.get`, nunca como constante.

## 4. Backend — lógica

### 4.1 `backend/competition_profile.py` (NUEVO)

```
LEADER_DEFAULT_METRICS = ("pts", "trb", "ast", "stl", "blk", "efg_pct", "ts_pct", "fg3_pct", "ft_pct", "oer", "uso_pct", "ast_to")
PROFILE_SECTIONS = {
  "team":   {"referencia": ("oer","der","net_rating","efg_pct","ts_pct","ppt","to_pct","or_pct","dr_pct","ft_rate","ast_to"),
             "ritmo": ("pace","possessions","sec_per_poss"),
             "reparto_tiro": ("fg2_uso","fg3_uso","paint_fga_share","mid_fga_share")},
  "player": {"referencia": ("pts","trb","ast","stl","blk","efg_pct","ts_pct","fg3_pct","ft_pct","to_pct","uso_pct","ast_to"),
             "reparto_tiro": ("fg2_uso","fg3_uso","ft_rate")},
}
effective_min_minutes(requested: int | None) -> dict           # {"requested","effective","default","floor","raised"}
leaders(comp_id: int, ctx: Context, metric_key: str, min_minutes: int, *, base: str = "partido", top_n: int | None = None) -> list[dict]
leaders_payload(comp_id, ctx, metric_key, min_minutes, *, base, top_n) -> dict      # response §3.1 con metric
leaders_cards(comp_id, ctx, min_minutes, *, base) -> dict                            # response §3.1 sin metric
leaders_table_rows(req: TableRequest) -> list[TableRow]                              # builder T-06
profile(comp_id: int, ctx: Context, *, entity_type: str = "team", base: str = "partido") -> dict    # response §3.2
```
`leaders(...)` mantiene la firma de la arquitectura (`-> list[dict]`, las filas); `base` y `top_n` son kwargs adicionales
(PROPUESTA, §10). Las constantes `LEADER_DEFAULT_METRICS` y `PROFILE_SECTIONS` son listas de claves del catálogo: no
contienen fórmulas ni etiquetas (salen del catálogo de T-05, que aplica `ui.metric_labels`).

**`effective_min_minutes(requested)`**
```
default = config.get("leaders.min_minutes"); floor = config.get("sample.player.min")
req = default if requested is None else requested          # validación 0–2000 en la ruta (400)
eff = max(req, floor)
return {"requested": req, "effective": eff, "default": default, "floor": floor, "raised": eff > req}
```

**`_leaders_core(comp_id, ctx, metric_key, min_minutes, base)` → `(rows, meta)`** (privada; la usan `leaders`, `leaders_payload` y
`leaders_table_rows`)
1. `mdef = metrics_catalog.METRICS.get(metric_key)`; si falta o `"player" not in mdef.entities` → `ProfileError(400, "Métrica inválida: …")`.
2. `mm = effective_min_minutes(min_minutes)`.
3. `pop = population.population("player", comp_id, ctx, base=base)` (cacheada por T-01: misma que usa la ficha; `apply_thresholds=True`).
   `members = [m for m in pop.members if m.in_population]` (los de muestra baja quedan afuera, RF-6).
   Si `len(members) < config.get("population.min_size")` → `meta.reason = "poblacion_insuficiente"`, `rows = []`.
4. Elegibles: `m.sample["n"] >= mm["effective"]` (unidad `minutos` del badge de T-02: minutos totales jugados en la selección,
   independientes de la base). `base` no altera la elegibilidad.
5. Valores: `v = m.values.get(metric_key)`; `v is None` → `excluded_null += 1` (razón: `m.reasons.get(metric_key)` si el
   miembro la trae; si no, `sin_datos`).
6. Orden: `s = +1` si `direction != "lower"`, `-1` si `lower`; clave `(-s·v, m.name)` (estable, desempate alfabético como el líder de T-01).
7. Puestos de competición estándar: `rank_i = 1 + #{elegibles estrictamente mejores}`; `tied = hay otro con el mismo valor`.
8. Filas: `{rank, tied, player_id=int(m.id), name, team_code=m.team_code, value=v, minutes=m.sample["n"], games=m.sample["games"], sample=m.sample}`.
9. Meta: `population = {size: len(members), criterion, …}` (T-01), `eligible`, `excluded_null`, `avg =
   population.league_reference("player", comp_id, ctx, base=base)[metric_key]`, `leader = population.full_ranking("player",
   metric_key, comp_id, ctx, None)["rows"][0]` (id, name, value del primer puesto de la población).

**`leaders(...)`**: `rows, _ = _leaders_core(...)`; devuelve `rows[:top_n or config.get("leaders.top_n")]` y, para esas filas
solamente, completa `percentile = population.percentile(v, others, direction)` y `population_rank = population.rank(v, others,
direction)[0]` con `others` = valores no nulos de los **otros** miembros de la población (idéntico a la ficha de T-01).
`cut_tied` = el valor del puesto N es igual al del N+1.

**`leaders_cards`**: para cada clave de `LEADER_DEFAULT_METRICS` aplica `leaders_payload` reutilizando la misma población
(una sola llamada a `population.population`, cacheada). Claves cuyo catálogo no las marque para `player` se omiten con un log.

**`leaders_table_rows(req)`**: `_leaders_core` con los parámetros de `req` y, para cada elegible, el `StatBundle` del
jugador con el mismo loader del tipo `player` que usa la población (T-05/T-01; PROPUESTA `population.member_bundles(pop)`, ver §10);
`TableRow(id=player_id, link="#/jugador/<id>/resumen", texts={"_name": name, "_team": team_code}, bundle=bundle)`. T-06 calcula
`pct`, `totals` (`none`) y `competition_avg` (`league_reference`) y arma la cabecera de exportación.

**`profile(comp_id, ctx, *, entity_type, base)`**
1. `pop = population.population(entity_type, comp_id, ctx, base=base)`; `n_pop = #in_population`;
   `insufficient = n_pop < config.get("population.min_size")`.
2. `ref = population.league_reference(entity_type, comp_id, ctx, base=base)` (una vez).
3. Para cada sección de `PROFILE_SECTIONS[entity_type]` y cada clave: `mdef` del catálogo (`label`, `fmt`, `direction`);
   `avg = ref[key]` (o `None` + razón `poblacion_insuficiente` si `insufficient`; `None` + `sin_datos` si nadie tiene valor);
   `n = #{m in_population con valor}`; `leader = population.full_ranking(entity_type, key, comp_id, ctx, None)["rows"][0]`;
   `ranking = f"/api/rankings/{entity_type}/{key}"`.
4. Solo `entity_type == "team"`: bloque `ppp_origen`:
   ```
   try: popo = population.population("origin", comp_id, ctx)       # miembros: id "<team>:<origin>" (A-02)
   except UnknownEntityType: → {"available": false, "reason": "requiere_posesiones"}
   by_origin = group(popo.members, key=m.id.split(":", 1)[1])
   for origin in A02_ORIGINS (orden de A-02):
        group = by_origin[origin]
        possessions = Σ m.sample["n"] for m in group (todos, también muestra baja)      # peso: cociente de totales
        vals = [m.values["ppp"] for m in group if m.in_population and m.values.get("ppp") is not None]
        ppp = mean(vals) if len(vals) >= population.min_size else None  (razón poblacion_insuficiente / sin_datos)
   classified = Σ possessions de todos los orígenes; share = possessions / classified
   ```
   La media usa la misma aritmética que `league_reference` (media de las entidades de la población, DA-08); no se promedian
   los PPP de otro modo ni se pondera. `classified_possessions` cierra la suma de posesiones de los siete orígenes.
5. Eco: `context` (de `context.context_echo`), `base`, `population`.

**Orden de ejecución y caché.** Todo cuelga de `population.population`, que T-01 cachea por (tipo, competencia, contexto,
base) y versión de datos/configuración; F-14 no agrega caché propia. Si `cache.py` no existe al implementar (F-11 lo difirió),
se calcula por petición y se mide en `progress.md`.

**Nulos (C-11).** Ningún valor nulo se toma como 0 ni entra en un promedio o en un orden; `excluded_null` lo cuenta; los
promedios sin datos o sin población devuelven `null` con razón (`sin_datos`, `poblacion_insuficiente`, `sin_universo`).
División por cero: no hay divisiones propias (todo viene de T-01/T-05/A-02).

### 4.2 Rutas en `app.py` (finas)

```
@app.route("/api/leaders")              → comp_id = _require_competition(request.args)        # 400 si vacío/all
                                          ctx = context.parse_context(request.args)
                                          base = parse_base(request.args)                       # T-04
                                          metric = request.args.get("metric")
                                          min_minutes = _int_arg("min_minutes", 0, 2000); top = _int_arg("top", 3, 50)
                                          jsonify(leaders_payload(...) if metric else leaders_cards(...))
@app.route("/api/competition-profile")  → idem con entity (team|player) → jsonify(profile(...))
```
(`_require_competition` y `_int_arg` siguen el patrón de `_int_arg` ya existente en `app.py`; errores `ProfileError` → `jsonify(e.body), e.status`.)

## 5. Frontend — capa API (`api.js`)
- `api.leaders(params) → apiFetch(\`/api/leaders${qs(params)}\`)`; `api.competitionProfile(params) → apiFetch(\`/api/competition-profile${qs(params)}\`)`
  (`qs` de T-05 omite `null`/`undefined`/`""`).
- Reutiliza `api.table("leaders", params)` (T-06), `api.ranking(entity, metric, params)` (T-01), `api.settings()` (F-13).

## 6. Frontend — UI

**Dónde vive.** S2 Liga (`views/liga.js`, X-01): pestaña `lideres` (`#/liga/lideres`) y pestaña `perfil` (`#/liga/perfil`),
registradas por X-01 con `enabled: false`; F-14 las habilita y les da `render`. El selector de competencia es el compartido
de Liga; sin competencia concreta ("Todas") se muestra "Elegí una competencia para ver líderes y perfil.". La query lleva
`metric`, `min_minutes` (Líderes) y `entity` (Perfil) además del contexto.

**`components/leaders-panel.js`** — `renderLeadersPanel(el, {query, onQueryChange})`
1. Barra de controles: `<select>` de métrica (opción "Resumen" = tarjetas; resto agrupado con `groupsFor("player")` de
   `core/catalog.js`, etiquetas `metricLabel`), campo numérico "Mínimo de minutos" (valor de `min_minutes.effective`, placeholder
   el default) y botón "Aplicar"; al aplicar, `onQueryChange({metric, min_minutes})` actualiza la URL (RF-17).
2. Sin métrica: `api.leaders(ctxParams)` → grilla de tarjetas `.leaders-card`: título (etiqueta), rótulo "Menos es mejor" /
   "Mayor valor" según `direction`/`neutral`, lista `<ol>` con puesto (con "=" si `tied`), jugador (enlace
   `#/jugador/<player_id>/resumen`), equipo, valor `fmtMetric(key, v)`, badge `sampleBadge(row.sample, {compact: true})`; pie
   "N jugadores califican · mínimo {effective} min" y "Ver todos" (fija `metric`). Si `cut_tied`, "y más con el mismo valor".
3. Con métrica: cabecera (puesto de población, líder y promedio de T-01 con `fmtMetric`, mínimo aplicado y aviso "Mínimo
   aplicado: {n} min (el mínimo de muestra de la competencia)" si `raised`) y la tabla completa
   `createDataTable(el2, {tableId: "leaders", payload: await api.table("leaders", {metric, min_minutes, ...ctx, base})})`
   (orden por defecto de la métrica, columnas configurables, totales `no_aplica`, promedio de competencia, exportación de T-06).
4. Estados: loading (spinner), vacío ("Ningún jugador alcanza el mínimo de {n} minutos en esta competencia. Probá con un mínimo
   menor."), error (mensaje + "Reintentar"), sin conexión ("Sin conexión. No se pudieron cargar los líderes.").

**`components/profile-panel.js`** — `renderProfilePanel(el, {query, onQueryChange})`
1. Pills "Equipos | Jugadores" (`entity`).
2. `api.competitionProfile({...ctx, base, entity})` → por sección una tarjeta con tabla: Métrica · Ø referencia (`fmtMetric`) ·
   Mejor (entidad y valor) · N. Clic en la fila: `api.ranking(entity, key, ctx)` y se despliega inline el ranking completo
   (mismo `rows` y `avg` que el hover de las fichas) — es la forma "consultable" que pide el cliente.
3. Bloque "PPP por origen de posesión" (equipos): fila por origen con posesiones, peso (%), PPP de referencia y N; pie "Total
   clasificado: {classified_possessions} posesiones" (suma de los pesos = 100 %). Si `available: false`: "Se calcula con el
   motor de posesiones (sin play-by-play en esta competencia)." (copy nuevo).
4. Botón `exportMenu` (CSV/XLSX/PNG/PDF) con `tableToData` sobre las tablas del perfil (T-06 D-8: tablas de métricas en filas).
5. Estados: loading por bloque, "Población insuficiente para calcular referencias." (nuevo), error + "Reintentar", sin conexión
   ("Sin conexión. No se pudo cargar el perfil.").

**Reutiliza (Arq. §8):** `core/catalog.js`, `core/format.js` (`fmtMetric`/`fmtNumber`/`nullDisplay`), `components/data-table.js`,
`components/export-menu.js`, `components/sample-badge.js`, `core/context.js` (T-03), `base-selector.js` (T-04, ya montado en la
vista de Liga por T-04/X-01), `components/tabs.js`.

**Mobile (<768 px).** Tarjetas en una columna; controles apilados; la tabla de T-06 con primera columna fija; el ranking inline
se vuelve hoja inferior.

## 7. Navegación
`#/liga/lideres?competition=<id>&metric=<clave>&min_minutes=<n>` y `#/liga/perfil?competition=<id>&entity=team|player`
(mismos nombres de contexto que la API; defaults omitidos). `registerTab("liga", {slug: "lideres", enabled: true, render})` y
`{slug: "perfil", …}`; el orden de pestañas de S2 es el de Arq. §3.12 (`tabla`, `ranking`, `mapa`, `lideres`, `perfil`).

## 8. Contratos de datos
- Respuestas de `GET /api/leaders` y `GET /api/competition-profile`: §3.1 y §3.2 (el eco de contexto es §7.5; `fmt` y `direction` del catálogo §3.5).
- Tabla `leaders`: payload de tabla §7.6 (T-06).
- Sin filas SQLAlchemy nuevas.

## 9. Errores y offline
| Código | Caso | Mensaje (UI) |
|---|---|---|
| 400 `parametro_invalido` | sin competencia / `all`, métrica, mínimo, `top`, base o entidad inválidos | el `error` del servidor ("Elegí una competencia para ver líderes y perfil.") |
| 400 `competencia_inexistente` / `contexto_invalido` | competencia o contexto inválidos | el `error` del servidor |
| 401 | sesión vencida | handler existente |
| 200 con `reason: poblacion_insuficiente` | menos jugadores/equipos que `population.min_size` | "Población insuficiente para calcular referencias." |
| red caída | fetch rechazado | "Sin conexión. No se pudieron cargar los líderes." / "…el perfil." |
Service worker: si X-01 ya usa runtime caching no hay cambios; si no, sumar los dos componentes a `STATIC` y subir `CACHE`.

## 10. Riesgos y decisiones
- **R-1 Dependencia de la API de T-01.** F-14 se escribe antes de que exista el plan de T-01 en el repo (se escribe en paralelo);
  usa las firmas de Arq. §3.6. Si T-01 nombra distinto algún campo del miembro de población (`sample`, `values`, `in_population`),
  se ajusta en la implementación sin cambiar el contrato público de F-14.
- **R-2 Extensiones aditivas a T-01 (PROPUESTA — no están en 00-arquitectura-transversal.md):** (a) kwarg `base: str = "partido"`
  en `population()`/`league_reference()`/`full_ranking()` (el mismo que necesita T-06, ver `../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md` §10 R-5); (b) campos `team_code` y `reasons: {clave: razón}` en cada miembro de población de tipo
  `player`; (c) `population.member_bundles(pop) -> dict[id, StatBundle]` para armar la tabla `leaders` sin recargar datos.
  Sin (c), `leaders_table_rows` invoca el loader del tipo `player` por cada elegible.
- **R-3 Semántica de la población `origin` (A-02).** F-14 asume que A-02 registra el tipo `origin` con ids `"<team>:<origin>"`
  y `sample.n` = posesiones (plan de A-02 §4.4); si la ficha de A-02 usara otro agrupamiento, el CA-1 sobre el PPP por origen
  fallaría. Se verifica en T-F2 con la ficha de A-02. Se recomienda que A-02 exponga `origin.origin_reference(comp_id, ctx)`;
  F-14 lo usaría en lugar de agrupar (reportado como hueco).
- **R-4 Verificación con pocos datos.** Seed: 14 equipos con 1–2 partidos y 32 jugadores ≥ 60 min (spec D-8). Para equipos hay que
  bajar `sample.team.min` a 2 (F-13) o importar más partidos; sin eso el Perfil muestra "Población insuficiente".
- **R-5 Rendimiento.** Líderes y perfil son O(miembros) sobre una población cacheada; las 12 tarjetas comparten la misma población.
  Objetivo < 1,5 s en caliente (Arq. §3.14); se mide en `progress.md`.
- **R-6 Porcentajes con pocos intentos (spec D-4).** Mitigación visible: badge y tabla completa con intentos.
- **Decisiones del plan:** mínimo efectivo `max(pedido, sample.player.min)`; PPP de referencia por origen = media de equipos
  (DA-08); perfil Equipos/Jugadores; sin caché propia; lista de tarjetas como constante (ajustable).
- **Desviaciones respecto de la arquitectura:** ninguna de contrato. `leaders`/`profile` agregan kwargs (`base`, `top_n`,
  `entity_type`); `ritmo`, `reparto_tiro` y `ppp_origen` son nombres de sección de este plan (el contrato JSON de la respuesta
  no está fijado en Arq. §6: "promedios de referencia = los de T-01").
- **Incrementos diferidos:** ninguno (dependencias de fases anteriores).

**Dependencias técnicas**
- T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)): `population.population`, `league_reference`, `rank`, `percentile`, `full_ranking`, `GET /api/rankings`, `metricCard`.
- T-05 ([../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)): `metrics_catalog.METRICS`/`GROUPS`, `core/catalog.js` (`groupsFor`, `metricLabel`), `fmtMetric`.
- T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)): badge de muestra y exclusión de muestras bajas.
- T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)): `tables.register_table`, `createDataTable`, `exportMenu`.
- F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/plan.md](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)): `config.get`, claves `leaders.*`, `sample.player.min`, `population.min_size`.
- T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md)): `parse_base`, `apply_base`, `base-selector.js`.
- T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)): `context.parse_context`, `context_echo`, `core/context.js`.
- X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)): `views/liga.js`, `registerTab`, `components/tabs.js`.
- A-02 ([../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md](../../fase-3-contexto-posesion/02-A-02-origen-posesion/plan.md)): tipo de entidad `origin`, orígenes y PPP por origen.
- C-02 ([../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md](../../fase-1-confiabilidad/11-C-02-promedios-de-liga/plan.md)) y C-09 ([../../fase-1-confiabilidad/06-C-09-tabla-general-liga/plan.md](../../fase-1-confiabilidad/06-C-09-tabla-general-liga/plan.md)): competencia concreta en Liga y mensaje de "Todas".

**Estimación: M · 6–10 h** (módulo `competition_profile.py` y rutas 3–4 h; tabla `leaders` y configuración 1 h; paneles y
pestañas 2–3 h; verificación y docs 1–2 h).
