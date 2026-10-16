# Plan — F-19: Filtros rápidos y cabecera de contexto

> **ID:** F-19 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 04
> **Depende de:** T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md))
> **Habilita:** — (cabecera estándar para F-05, F-08, F-04, F-06)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.7, §3.8, §3.12, §3.13, §6, §7.2, §7.5, §8
> **Estimación:** M · 7–10 h

## 1. Enfoque
F-19 es presentación sobre el contrato de T-03: no parsea ni persiste contexto. En backend agrega **un** endpoint fino
`GET /api/context/summary` (dueño F-19 según arquitectura §6) cuya lógica vive en un módulo dedicado que reutiliza
`context.parse_context` / `context.filter_games` / `context.context_echo` (T-03), `repository` (F-11) y
`sample.sample_level` (T-02). En frontend crea los dos componentes que la arquitectura §8 le asigna
(`components/quick-filters.js`, `components/context-header.js`) y un contenedor fijo `ctx-dock` que las vistas montan
arriba de su contenido. Los chips escriben con `core/context.js:setContext` y las vistas ya reaccionan con
`onContextChange` (T-03); la cabecera se refresca con cada cambio de contexto o de ruta. Se retiran las pills
`#team-filter-pills` heredadas (si T-03 no lo hizo) sin perder funcionalidad.

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/context_summary.py` | module **NUEVO** (PROPUESTA de ubicación, ver §10) | `context_summary(entity_type, entity_id, ctx)`: récord, diferencia media, partidos N/M, badge | RF-6, RF-9, RF-11, RF-12 |
| `backend/app.py` | route | `GET /api/context/summary` fina: `parse_context` → `context_summary` → JSON; errores §7.8 | RF-12 |
| `frontend/js/api.js` | js-api | `api.contextSummary(params)` (nombre fijado en arquitectura §8) | RF-12 |
| `frontend/js/components/quick-filters.js` | js-component **NUEVO** | `renderQuickFilters(el, {teams, context, onChange})`: chips período/sede/rival, botón "Más filtros" con contador, "Limpiar filtros" | RF-1…RF-5, RF-10 |
| `frontend/js/components/context-header.js` | js-component **NUEVO** | `renderContextHeader(el, summary)` + `flashGamesLeft(el, n, m)`: cabecera, aviso, línea secundaria, estado vacío | RF-6, RF-8, RF-9, RF-11 |
| `frontend/js/components/ctx-dock.js` | js-component **NUEVO** (PROPUESTA, ver §10) | `mountContextDock(el, {entity, id, showOpponents})`: arma el contenedor fijo, carga opciones y resumen, se suscribe a `onContextChange`/`onRoute` | RF-4, RF-7, RF-8 |
| `frontend/js/components/context-bar.js` | js-component (T-03, solo consumo) | se renderiza dentro del panel "Más filtros" | RF-5 |
| `frontend/js/components/sample-badge.js` | js-component (T-02, solo consumo) | badge en la cabecera | RF-6 |
| `frontend/js/views/equipo.js` | js-view | montar el dock arriba de las pestañas de S3 (entidad `team`); retirar `#team-filter-pills` y el `_filteredLog` local si siguen | RF-1…RF-11 |
| `frontend/js/views/jugador.js` | js-view | montar el dock en S4 (entidad `player`) | RF-1…RF-11 |
| `frontend/js/views/liga.js` | js-view | dock con entidad `competition`, `showOpponents: false` | RF-1, RF-2, RF-6 |
| `frontend/js/views/comparar.js` | js-view | chips compartidos + una cabecera por lado (`equipos`; F-05 lo reutiliza en `jugadores`) | RF-6 |
| `frontend/js/views/explorar.js` | js-view | dock con entidad `competition` | RF-1, RF-2, RF-6 |
| `frontend/js/app.js` | js-view | quitar el markup de `#team-filter-pills`, `team-comp-wrap` y el listener de pills (l.1637–1645, l.1746–1761) si X-01/T-03 no lo mudaron | RF-1 |
| `frontend/css/style.css` | css | sección `/* ── quick-filters / context-header (F-19) ── */`: `.ctx-dock` sticky, `.chip-row` con scroll horizontal interno, `.chip`, `.chip.active`, `.ctx-header`, `.ctx-flash`, compacto <768 px | RF-7, CA-9 |
| `frontend/sw.js` | sw | con runtime caching de X-01 no hace falta tocar `STATIC`; subir `CACHE` al siguiente entero al integrar | §9 |
| `docs/api.md` | doc | `GET /api/context/summary` | cierre |
| `docs/frontend.md` | doc | componentes, dock, copy nuevo, retiro de pills Últ. N | cierre |
| `docs/architecture.md` | doc | módulo `context_summary.py` | cierre |

Matriz RF → archivo: RF-1/2/3/4/5/10 → `quick-filters.js` (+ vistas); RF-6/8/9/11 → `context-header.js` +
`context_summary.py`; RF-7 → `ctx-dock.js` + `style.css`; RF-12 → `context_summary.py` + `app.py` + `api.js`;
RF-13 → todos los componentes (`t()`, `fmtNumber`).

## 3. Backend — rutas y modelos

### `GET /api/context/summary` — NUEVO (dueño F-19, `login_required`)
- Query: `entity` ∈ {`team`, `player`, `competition`} (obligatorio); `id` (team_code, player_id entero o competition_id;
  para `competition` puede omitirse y se usa la resuelta); todos los parámetros de contexto de T-03 (§3.8: `competition`,
  `last`, `venue`, `opponent`, `rest`, `quarter`, `score`, `on`, `off`, y los de posesión cuando existan). `base` se ignora.
- Response 200 (equipo):
```json
{
  "entity": {"type": "team", "id": "CNF", "name": "Nacional", "team_code": "CNF"},
  "label": "Nacional",
  "record": "4-1", "wins": 4, "losses": 1,
  "avg_margin": 6.4, "margin_basis": "resultado_final",
  "games": 5, "games_total": 16,
  "sample": {"level": "media", "unit": "partidos", "n": 5, "min": 3, "high": 10, "min_source": "absoluto",
             "games": 5, "minutes": null, "possessions": null, "ranked": true},
  "context": {
    "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
    "applied": {"last": 5, "venue": "local"},
    "ignored": [], "level": "partido", "population_mode": "apply_all",
    "games_used": 5, "games_total": 16, "games_excluded": {"sin_pbp": 0},
    "label": "Últimos 5 · Local"
  }
}
```
- Jugador: `entity: {"type": "player", "id": 128, "name": "A. Varela", "team_code": "CNF"}`, `record` = del equipo en los
  partidos jugados, `record_basis: "equipo_con_jugador"`, `sample.unit = "minutos"`, `sample.minutes` = Σ minutos.
- Competencia: `record`, `wins`, `losses`, `avg_margin` = `null` con `null_reasons: {"record": "no_aplica", "avg_margin":
  "no_aplica"}`; `sample = null`; `games` = partidos de la competencia en la selección.
- Selección vacía: 200 con `games: 0`, `record: null`, `avg_margin: null`, `null_reasons: {"record": "sin_datos",
  "avg_margin": "sin_datos"}` y `sample.level = "baja"`.
- Errores (formato §7.8): 400 `parametro_invalido` "Falta el parámetro entity" / "Entidad desconocida"; 400
  `contexto_invalido` (lo levanta `parse_context`, mensaje de T-03); 400 `competencia_inexistente`; 404 `no_encontrado`
  "Equipo no encontrado" / "Jugador no encontrado" / "Competencia no encontrada"; 401 sin sesión.
- Sin tablas ni columnas nuevas.

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `context_summary(entity_type: str, entity_id: str \| int \| None, ctx: Context) -> dict` | `context_summary.py` (NUEVO) | ver algoritmo | RF-6, RF-9, RF-11, RF-12 |
| `_team_games(team_code, ctx) -> tuple[list[dict], int]` | `context_summary.py` | `repository.competition_games` + `context.filter_games` | RF-6 |
| `_player_games(player_id, ctx) -> tuple[list[dict], int, float]` | `context_summary.py` | `repository.player_game_rows` + `played(minutes)` | RF-6 |

Algoritmo `context_summary` (pseudo-código):
```
comp_id = ctx.competition_id            # ya resuelto por parse_context (§3.1, DA-14)
if entity_type == "team":
    rows_all = [r for r in repository.team_game_rows(comp_id).values() if r.team_code == id]   # 1 fila por partido
    if not rows_all: raise NotFound("Equipo no encontrado")
    games_all = [game_dict(r) for r in rows_all]                 # {game_id, date, is_home, opp_code, pts, opp_pts}
    games = context.filter_games(games_all, ctx, team_code=id)   # last/venue/opponent/rest (nivel partido)
    if context.level(ctx) in ("evento", "posesion"):
        excluded_sin_pbp = [g for g in games if not g.has_pbp]; games = games − excluded_sin_pbp
    wins   = count(g.pts > g.opp_pts);  losses = len(games) − wins   # FIBA no tiene empates; si pts == opp_pts se cuenta como derrota y se loguea
    margin = round(Σ(g.pts − g.opp_pts) / len(games), 1) if games else None
    sample = sample.sample_level("team", n=len(games), unit="partidos", games=len(games))
elif entity_type == "player":
    pid = int(id); team_code = identity.player_card(pid)["team_code"]   # sigue merged_into (C-08)
    prow = [r for r in repository.player_game_rows(comp_id) if r.player_id == pid]
    if not prow: raise NotFound("Jugador no encontrado")
    played_rows = [r for r in prow if played(r.minutes)]        # DNP fuera (C-11 / dev)
    games = context.filter_games(team games of played_rows, ctx, team_code)   # mismo filtro, sobre partidos jugados
    (idem exclusión sin_pbp)
    wins/losses/margin sobre el resultado del equipo en esos partidos
    minutes = Σ _parse_minutes(r.minutes) de los partidos incluidos
    sample = sample.sample_level("player", n=minutes, unit="minutos", games=len(games), minutes=minutes)
elif entity_type == "competition":
    games = context.filter_games(repository.competition_games(comp_id), ctx, team_code=None)
    record = margin = sample = None (no_aplica)
games_total = cantidad de partidos de la entidad en comp_id sin filtros (mismo criterio de DNP)
echo = context.context_echo(ctx, games_used=len(games), games_total=games_total,
                            games_excluded={"sin_pbp": len(excluded_sin_pbp)}, ignored=ctx_ignored)
return shape §3
```
- Nulos (C-11): con 0 partidos, `record`/`avg_margin` = `null` con razón `sin_datos`; nunca 0.
- `competition=all`: se permite (la cabecera es un listado); `games_total` = todos los partidos de la entidad.
- Caché: `cache.memo("ctxsum", (entity_type, id, context.context_key(ctx)), fn, max_entries=128)` — clave prefijada con
  `data_version`/`config_version` (§3.14), así el badge cambia al tocar umbrales (CA-6).
- Filtro `on`/`off` (nivel evento, `entity_only`): los partidos incluidos son los que tienen pbp; el récord es de esos
  partidos (decisión spec §9).
- Costo: una carga en bloque por competencia ya cacheada por `repository`; O(partidos de la entidad).

## 5. Frontend — capa API (api.js)
- `contextSummary: params => apiFetch(`/api/context/summary${qs(params)}`)` — `params` = `{entity, id, ...contextToQuery(getContext())}`;
  `qs()` es de T-05 (omite `null`/`""`). Sin `fetch` fuera de `api.js`.
- Consumidos: `api.contextOptions(params)` (T-03) para equipos de la competencia y dimensiones del panel.

## 6. Frontend — UI

**Ubicación (X-01 implementado):** el dock se monta arriba del contenido de la pestaña activa en S2, S3, S4, S6 y S7,
**debajo** de las pestañas (`components/tabs.js`) y compartido por todas las pestañas de la sección (se monta una vez por
sección y se actualiza al cambiar de pestaña o de id).

**`components/ctx-dock.js`** — `mountContextDock(el, {entity, id, showOpponents = true, compare = null}) -> {refresh(), destroy()}`
(PROPUESTA): estructura
```
<div class="ctx-dock">                       ← position: sticky; top: 0 (debajo del header de la app); z-index sobre el contenido
  <div class="ctx-header" id="…">            ← renderContextHeader
  <div class="quick-filters">                ← renderQuickFilters
  <div class="ctx-more" hidden>              ← renderContextBar (T-03) dentro del panel
</div>
```
1. Carga `api.contextOptions({competition})` una vez por competencia (equipos, dimensiones disponibles).
2. Llama `api.contextSummary({entity, id, ...ctx})` al montar y en cada `onContextChange`/`onRoute`; cancela respuestas
   viejas con un contador de pedido (la última gana).
3. Compara `games` anterior vs nuevo: si cambió por acción del usuario → `flashGamesLeft`.

**`components/quick-filters.js`** — `renderQuickFilters(el, {teams, context, onChange, showOpponents})`:
- Fila 1 "Período": chips `Todos | Últimos 3 | 5 | 10 | 15` (`data-last`). Fila 2 "Sede": `Todos | Local | Visitante`.
  Fila 3 "Rival": `Todos` + un chip por equipo (`teams` de `/api/context/options` filtrando el propio `team_code`), texto =
  nombre corto. Cada fila es `.chip-row` con `overflow-x: auto; flex-wrap: nowrap; scroll-snap-type: x` (sin scroll de
  página, CA-9).
- Botón "Más filtros (n)" donde n = filtros activos que no son chips (`quarter`, `score`, `on`, `off`, `rest`, posesión);
  abre/cierra `.ctx-more` y renderiza allí `renderContextBar(el, {options, context, onChange})` de T-03 (sin duplicar los
  controles de período/sede/rival: se le pasa la opción `hide: ["last", "venue", "opponent"]` — PROPUESTA de parámetro a
  T-03, ver §10; si T-03 no lo acepta, el panel muestra la barra completa y el estado se mantiene sincronizado porque ambos
  leen/escriben `core/context.js`).
- "Limpiar filtros" visible si `activeCount(context) > 0`; `onClick` → `setContext({last: null, venue: null, opponent: null,
  rest: null, quarter: null, score: null, on: null, off: null, clock: null, clock_start: null, origin: null, ptype: null,
  chance: null})` (conserva `competition` y `base`, decisión spec §9).
- `onChange(patch)` → `setContext(patch)`; accesibilidad: chips como `<button aria-pressed>`; grupo con `role="group"` y
  `aria-label`.

**`components/context-header.js`** — `renderContextHeader(el, summary)`:
- Línea 1: nombre de la entidad (grande) · `sampleBadge(summary.sample, {compact: true})` (T-02).
- Línea 2: "Récord 9-7" (o "Récord del equipo con él 9-7") · "Dif. media +4,3" (con "(resultado final)" si
  `context.level != "partido"`) · "**16 de 16 partidos**".
- Línea 3: `context.label` o "Sin filtros" + competencia; línea secundaria con `games_excluded`/`ignored` (RF-11).
- Estado vacío (RF-9): "Ningún partido cumple los filtros" + botón "Limpiar filtros".
- `flashGamesLeft(el, n, m)`: agrega `.ctx-flash` con "Quedan n de m partidos" y lo quita a los 4 s (`setTimeout`).
- Números con `fmtNumber` (es-UY) y signo explícito; nulos con `nullDisplay(reason)` (C-11).

**Móvil (<768 px):** la cabecera colapsa a una línea ("Nacional · 9-7 · 16/16 · [ALTA] · 2 filtros") y los chips a una fila
por grupo desplazable; el panel "Más filtros" se abre como hoja inferior. Altura máxima del dock ≈ 30 % del viewport para no
tapar el contenido. Desktop: tres filas de chips y cabecera completa.

**Comparar (S6 `equipos`):** una fila de chips compartida (el contexto aplica a ambos) y dos cabeceras lado a lado (una por
equipo; en móvil una debajo de la otra, compactas). Sin chips de rival.

**Retiro de lo existente:** `#team-filter-pills`, `_teamLastN`, `_filteredLog` y el `<select id="team-comp">` de Equipo se
reemplazan por el dock (si T-03 ya lo hizo, no hay nada que quitar). `_recordCard` sigue en la pestaña Resumen y pasa a
recibir el récord de la selección desde `summary` (deja de ocultarse con filtros).

## 7. Navegación
Sin secciones ni pestañas nuevas. El estado de los chips vive en la query del hash de T-03
(`#/equipo/CNF/resumen?last=5&venue=local&opponent=PEN`); al cambiar de pestaña se conserva todo, al cambiar de sección todo
salvo `on`/`off` (regla de T-03). `docs/frontend.md` documenta el dock en el mapa de vistas.

## 8. Contratos de datos
- Response de `/api/context/summary`: §3 (usa §7.2 para `sample` y §7.5 para `context`).
- Estado de chips = subconjunto de `Context` de `core/context.js`: `{last: 3|5|10|15|null, venue: "local"|"visitante"|null,
  opponent: team_code|null}`.
- `activeCount(ctx)` = número de parámetros de contexto no nulos excluyendo `competition` y `base`.

## 9. Manejo de errores y offline
| Situación | Mensaje (español, `t()`) |
|---|---|
| 400 `contexto_invalido` (URL editada a mano) | "Hay un filtro inválido en la dirección. Limpiá los filtros." + botón limpiar |
| 404 | "No encontramos esta entidad en la competencia elegida" |
| 401 | handler global de `api.js` (vuelve al login) |
| 5xx / red | "No se pudo calcular la selección" (la vista sigue) |
| Offline | Se mantiene el último `summary` con la marca "Sin conexión"; los chips siguen operables (el error lo muestra cada bloque) |
- `sw.js`: X-01 cambia a runtime caching, por lo que los módulos nuevos quedan en caché al primer uso; igual se sube `CACHE`
  al siguiente entero al integrar (§3.13). Si al implementar F-19 X-01 no hubiera cambiado la estrategia, agregar
  `/js/components/quick-filters.js`, `/js/components/context-header.js` y `/js/components/ctx-dock.js` a `STATIC`.

## 10. Riesgos / decisiones
- **PROPUESTA (no está en 00-arquitectura-transversal.md): módulo `backend/context_summary.py`.** La arquitectura asigna el
  endpoint a F-19 pero no fija dónde vive su lógica. No se agrega a `context.py` porque su contrato es de T-03 (regla "un
  solo dueño por pieza"). Reportado en huecos.
- **PROPUESTA: `components/ctx-dock.js`.** La arquitectura §8 fija `quick-filters.js` y `context-header.js`, pero no el
  contenedor que los monta y sincroniza con el contexto; sin él cada vista repetiría la orquestación. Reportado en huecos.
- **PROPUESTA: opción `hide` en `renderContextBar`.** Para no duplicar período/sede/rival dentro del panel. Si T-03 no la
  implementa, el panel muestra la barra completa (sin inconsistencia: misma fuente de estado).
- **Extensión del shape de `/api/context/summary`.** La arquitectura fija `{label, record: "W-L", avg_margin, games,
  games_total, sample}`; F-19, como dueño, agrega `entity`, `wins`, `losses`, `margin_basis`, `record_basis`,
  `null_reasons` y `context` (eco §7.5). El formato de `record` se mantiene como string "V-D" ("W-L" en la arquitectura).
- **Riesgo: altura del dock en móvil.** Tres filas de chips + cabecera pueden ocupar demasiado; mitigación: modo compacto
  (una línea + filas desplazables) y panel como hoja inferior. Verificar en 375 px (CA-1, CA-9).
- **Riesgo: carrera de respuestas** al tocar chips rápido; mitigación: contador de pedido, la última respuesta gana.
- **Riesgo: empates** (FIBA no los tiene); si aparecieran por datos corruptos se cuentan como derrota y se loguean.
- **Coherencia con T-01:** la cabecera no calcula percentiles; los bloques recalculan poblaciones con el mismo contexto
  (T-01/T-03). La cabecera usa `games_used` del mismo `context_echo` que los bloques, así el N coincide.
- **Dependencias técnicas:** `context.parse_context`, `context.filter_games`, `context.level`, `context.context_key`,
  `context.context_echo`, `core/context.js`, `components/context-bar.js`, `GET /api/context/options` (T-03,
  [../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md));
  `sample.sample_level`, `components/sample-badge.js` (T-02,
  [../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md));
  `repository.team_game_rows`, `repository.player_game_rows`, `repository.competition_games`, `cache.memo` (F-11,
  [../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `identity.player_card` (C-08, [../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md));
  `core/router.js`, `components/tabs.js` (X-01); `core/format.js`, `core/i18n.js` (C-11).
- **Estimación:** M · 7–10 h (backend 2 h, componentes 3–4 h, integración en 5 vistas 1,5–2 h, verificación y docs 1,5–2 h).
