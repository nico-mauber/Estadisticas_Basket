# Plan — F-03: Preparar partido

> **ID:** F-03 · **Prioridad:** P0 · **Fase y orden:** Fase 4 — Día de partido · 02
> **Depende de:** F-07 ([../01-F-07-analizar-partido/](../01-F-07-analizar-partido/plan.md)) · T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md)) · F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4 · F-03 · Arquitectura §3.7, §3.9, §3.10, §3.11, §3.12, §4, §6, §9
> **Estimación:** XL · 30–40 h (partición sugerida si el redactor confirma que supera 40 h al implementar: informe base · emparejamientos · salidas)

## 1. Enfoque

`prepare.py` (NUEVO) es un orquestador puro: no reconstruye nada que ya exista. Reutiliza `lineups.all_lineups` (F-06) para
quintetos rivales, `matchups.team_matchups`/`game_matchups` (F-07) para los tres niveles de emparejamiento,
`population.ficha`/`population()` (T-01) y `sample.*` (T-02) para percentiles y muestra, `phrases.game_plan(mode="matchup")`
(F-17) para las 5+5 ventajas/amenazas, y `shot_zones.zone_table`/`components/shot-chart.js` (C-03, vía F-07) para el mapa de
amenazas ofensivas. Toda la vista vive detrás de un único endpoint `GET /api/prepare` que arma el payload completo en una
sola llamada (objetivo < 10 s, §3.14): el frontend no hace fan-out de N llamadas por bloque. El módulo `head_to_head` es
independiente (no depende de pbp) para poder mostrarse aun si el equipo/rival no tiene play-by-play. Exportación 100 %
cliente + `POST /api/export/xlsx` ya existentes (T-06), sin lógica nueva de exportación en el backend salvo el armado del
CSV de datos base (reutiliza `components/exporters.js`).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/prepare.py` | module (NUEVO) | `prepare_report()`, `head_to_head()`, ensamblado de ventajas/amenazas, quintetos rivales, amenazas ofensivas | RF-1..RF-12, RF-27, RF-28 |
| `backend/app.py` | route | `GET /api/prepare`, `GET /api/h2h` (rutas finas, delegan en `prepare.py`) | RF-1, RF-2, RF-3, RF-11, RF-26 |
| `backend/config.py` (mod., de F-13) | config | agrega `report.default_last_n` a `CONFIG_SPEC` | RF-2 (ambigüedad §9) |
| `frontend/js/api.js` | api | `api.prepare(params)`, `api.h2h(params)` | RF-1, RF-2, RF-11 |
| `frontend/js/views/partido.js` (de X-01) | js-view | modo `preparar` (sin `game_id`): selector inicial, orquesta los 6 bloques | RF-1, RF-3, RF-27, RF-28 |
| `frontend/js/components/prepare-report.js` (NUEVO) | component | render de los 6 bloques (encabezado, ventajas/amenazas, quintetos rivales, amenazas ofensivas, H2H, coincidencia en cancha), maquetas de exportación (A4 / 1080 px) | RF-3..RF-25 |
| `frontend/js/components/matchup-table.js` (NUEVO) | component | tabla de emparejamientos con selector de nivel + directo/inverso, reutilizada también por F-07 (matchups de un partido) si F-07 no la creó ya — este plan la crea aquí si F-07 no la registró; **verificar contra `../01-F-07-analizar-partido/plan.md` §2 antes de implementar para no duplicar** | RF-13..RF-22 |
| `frontend/js/components/export-menu.js` (de T-06) | component (extiende) | agrega preset `informe-preparar` (PDF A4 2 páginas, PNG 1080 px) | RF-23, RF-24 |
| `frontend/css/style.css` | css | sección `/* ── prepare-report (F-03) ── */`: maqueta de impresión `@media print` A4, maqueta PNG 1080 px | RF-23, RF-24 |
| `frontend/sw.js` | cache | agrega `components/prepare-report.js`, `components/matchup-table.js` a `STATIC` (fase 1–3: aún cache-first sin runtime caching, según qué requisito de esa lista esté activo al integrar); bump `CACHE` | — |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoints `GET /api/prepare`/`GET /api/h2h`, módulo `prepare.py`, vista Preparar | — (cierre) |

**Matriz RF → archivo:**

| RF | Archivo(s) |
|---|---|
| RF-1, RF-3 | `app.py`, `prepare.py`, `views/partido.js` |
| RF-2 | `app.py`, `prepare.py`, `config.py` |
| RF-4, RF-5, RF-6 | `prepare.py` (usa `phrases.game_plan`, `population.ficha`) |
| RF-7, RF-8 | `prepare.py` (usa `lineups.all_lineups`) |
| RF-9, RF-10 | `prepare.py` (usa `shot_zones.zone_table`, `stats_engine.compute_standard`) |
| RF-11, RF-12 | `prepare.py` (`head_to_head`), `app.py` (`/api/h2h`) |
| RF-13..RF-22 | `prepare.py` (delega en `matchups.team_matchups`), `components/matchup-table.js` |
| RF-23, RF-24 | `components/prepare-report.js`, `components/export-menu.js`, `components/exporters.js` (T-06, sin cambios) |
| RF-25 | `components/prepare-report.js` (arma filas), `components/exporters.js` `toCSV` (T-06, sin cambios) |
| RF-26 | `prepare.py` (caché vía `cache.memo`, namespace `prepare:<team>:<rival>`) |
| RF-27, RF-28 | `prepare.py` (razones C-11 en cada bloque) |

## 3. Backend — rutas y modelos

Sin cambios de esquema (confirmado por Arquitectura §5).

**`GET /api/prepare`** (login_required)
- Query: `team` (código, requerido), `rival` (código, requerido), `competition` (T-03, default resuelto), `last` (últimos N
  partidos **del rival**, default `config.get("report.default_last_n")`, `None` = todos).
- 400 `{"error": "Falta el equipo", "code": "parametro_invalido"}` si falta `team`; 400 `{"error": "Falta el rival",
  "code": "parametro_invalido"}` si falta `rival`; 400 `{"error": "El rival no puede ser el mismo equipo", "code":
  "parametro_invalido"}` si `rival == team`.
- 404 `{"error": "Equipo no encontrado", "code": "no_encontrado"}` / `{"error": "Rival no encontrado", "code":
  "no_encontrado"}` si el código no existe en la competencia resuelta.
- 200 → shape de §8 (`{summary, advantages, threats, rival_lineups, rival_threats, h2h, matchups, suggestions_profile}`).

**`GET /api/h2h`** (login_required)
- Query: `a`, `b` (códigos de equipo, requeridos), `competition` (opcional; default: todas las competencias donde ambos se
  enfrentaron — el H2H es histórico por definición, RF-2).
- 400 si falta `a` o `b`, mismo formato que arriba.
- 200 → `{team_a, team_b, games: [{game_id, date, competition_label, score_a, score_b, winner}], record: {wins_a, wins_b}}`.

Clave de configuración `report.default_last_n` (PROPUESTA, spec §9): `int | null`, default `null` (todos), rango 1–82,
sección "Preferencias", consumidor F-03, agregada por F-03 (a falta de F-13 en este plan, se define en `config.py` si F-13
ya está integrado cuando se implemente F-03; si F-13 aún no corrió, `prepare.py` usa el default embebido `None` y la clave se
agrega en el primer plan que toque `config.py` después — sin bloquear F-03).

## 4. Backend — lógica

### `backend/prepare.py` (NUEVO)

```
prepare_report(team_code: str, rival_code: str, comp_id: int, ctx: Context, *, last: int | None) -> dict
    # 1. valida team != rival (ya validado en la ruta; función pura también lo re-chequea)
    # 2. games_team = repository.competition_games(comp_id) filtrados por team_code (todos)
    # 3. games_rival = ídem filtrados por rival_code y limit=last (los últimos N por fecha desc)
    # 4. advantages, threats = _advantages_and_threats(team_code, rival_code, comp_id, ctx)
    # 5. rival_lineups = lineups.all_lineups(rival_code, comp_id, ctx_con_games_rival)  [RF-7, RF-8]
    # 6. rival_threats = _rival_offensive_threats(rival_code, games_rival)              [RF-9, RF-10]
    # 7. h2h = head_to_head(team_code, rival_code, comp_id=None)                        [RF-11; historial completo]
    # 8. matchups = _matchups_block(team_code, rival_code, comp_id, ctx, games_rival)   [RF-13..RF-22]
    # 9. suggestions_profile = None  (INCREMENTO DIFERIDO → A-09, RF-21)
    # cacheado: cache.memo("prepare", (team_code, rival_code, comp_id, ctx_key, last), ...)

_advantages_and_threats(team_code, rival_code, comp_id, ctx) -> tuple[list[dict], list[dict]]
    # delega en phrases.game_plan(entity_type="team", entity_id=team_code, reference="rival",
    #   rival=rival_code, comp_id=comp_id, ctx=ctx, mode="matchup")
    # separa items en advantages (direction == "ventaja") / threats (direction == "riesgo")
    # RF-6: si population(team) o population(rival) tiene games < sample.team.min → advantage/threat
    #   list igual se devuelve, con "sample_warning": true a nivel de bloque

_rival_offensive_threats(rival_code, games_rival) -> dict
    # top jugadores por uso_pct (stats_engine.compute_standard sobre StatBundle del jugador, entidad "player")
    # zonas: shot_zones.zone_table(shots de rival_code en games_rival) -> top zona por ppt  [RF-9]
    #   si ninguna coordenada disponible en games_rival -> fallback modo 3 zonas (RF-10, delega en shot_chart.js)
    # reparto de puntos: paint_pts / second_chance_pts / pts_from_tov / fast_break_pts / resto
    #   (resto = pts − esas 4 categorías; TL y triples derivados de ppt_3/ppt_ft del conjunto estándar)
    #   fórmula literal del glosario (§6): sin cambios, solo agregación sobre games_rival
    # todo valor no calculable -> {"value": None, "reason": "sin_pbp"|"no_registrado"}  [RF-27]

head_to_head(team_a: str, team_b: str, comp_id: int | None) -> dict
    # repository.competition_games(comp_id) si comp_id, si no TODAS las competencias donde (team_a,team_b) o (team_b,team_a)
    # jugaron entre sí; orden por fecha desc; cada fila {game_id, date, competition_label, score_a, score_b, winner}
    # record = {wins_a: n, wins_b: n} sobre las filas devueltas
    # sin partidos -> {"team_a":..., "team_b":..., "games": [], "record": {"wins_a": 0, "wins_b": 0}}  [RF-28]

_matchups_block(team_code, rival_code, comp_id, ctx, games_rival) -> dict
    # para cada nivel in ("quinteto", "jugador", "jugador_quinteto"):
    #   matchups.team_matchups(team_code, rival_code, comp_id, ctx, level=nivel)   [reuso F-07, sin duplicar]
    # aplica el badge de sample.matchup.min/.high (T-02) a cada fila (ya lo hace team_matchups; prepare.py no reimplementa)
    # RF-19: cruces con games=[] -> {"reason": "sin_enfrentamientos"} en vez de fila con valor 0 (team_matchups ya lo entrega así)
    # devuelve {"quinteto": [...], "jugador": [...], "jugador_quinteto": [...]}
```

**Manejo de nulos (C-11).** Ningún bloque sustituye un valor faltante por 0 ni omite la fila: cada valor no calculable trae
`{"value": null, "reason": "<código>"}` (§7.4 de la arquitectura), heredado directamente de los módulos que `prepare.py`
consume (`stats_engine.compute_standard`, `matchups.team_matchups`, `shot_zones.zone_table`).

**Caché.** `cache.memo("prepare", key, fn, max_entries=32)` con `key = (team_code, rival_code, comp_id, context_key(ctx),
last, data_version, config_version)`. Objetivo de latencia (§3.14): < 10 s en frío incluye la población completa de la
competencia (ya cacheada por `population.py` bajo `pop:<entity_type>`) y los emparejamientos de ambos equipos (cacheados por
`matchups.py` si F-07 los cachea por partido — este plan no re-cachea lo que F-07 ya cachea).

**Casos borde.**
- Rival sin partidos en la competencia (o sin partidos tras aplicar `last`): `rival_lineups=[]`, `rival_threats` con razones
  `sin_pbp`/`sin_datos`, `h2h` puede seguir teniendo datos (usa el historial completo, no filtrado por competencia salvo que
  el usuario lo pida), `matchups` con todas las filas en `sin_enfrentamientos` (RF-28).
- Equipo o rival con muestra baja para T-01 (menos de `sample.team.min` partidos): `advantages`/`threats` se generan igual
  (F-17/`phrases.game_plan` no exige `alta`), pero `sample_warning: true` (RF-6).
- División por cero en el reparto de puntos del rival (equipo con 0 puntos en la selección — imposible en la práctica pero
  cubierto): cada porcentaje usa `stats_engine._safe_div(num, den, default=None)`.

## 5. Frontend — capa API (api.js)

```js
api.prepare: (params) => apiFetch(`/api/prepare?${qs(params)}`)
  // params: {team, rival, competition, last}
api.h2h: (params) => apiFetch(`/api/h2h?${qs(params)}`)
  // params: {a, b, competition}
```
`qs()` ya existe (T-05, agregado por T-05 a `api.js`); no se reimplementa.

## 6. Frontend — UI

Vista: S5 · Partido, modo `preparar`. En fase 4 (X-01 ya está en fase 2, así que la sección S5 y su router ya existen; el
modo `preparar` se registra vía `core/router.js` `registerTab("partido", {slug: "preparar", enabled: true, render:
renderPrepareReport})`). Ruta: `#/partido/preparar?team=<code>&rival=<code>[&last=<n>]` (sin `game_id`, caso especial de S5
documentado en Arquitectura §3.12).

**Componentes compartidos reutilizados** (§8 de la arquitectura): `components/standard-panel.js` (conjunto estándar en
filas expandidas de la matriz de emparejamientos), `components/metric-card.js` + `components/sample-badge.js` (fichas T-01
en ventajas/amenazas), `components/data-table.js` (tabla de quintetos rivales y de emparejamientos), `components/
export-menu.js` + `components/exporters.js` (T-06), `components/shot-chart.js` (mapa de zonas del rival, C-03),
`components/game-plan.js` (formato de ítem F-17 — F-03 reutiliza su renderer de ítem, no el panel completo: cada ítem de
ventaja/amenaza usa la misma función de render que `game-plan.js` expone para una fila individual), `components/
context-bar.js` (solo `competition`; el resto de T-03 no se expone en esta vista, spec §8), `core/colors.js`
(`percentileColor`), `core/format.js` (`nullDisplay`, `fmtNumber`).

**Estados** (loading/vacío/error/offline/éxito): copiados literalmente de `spec.md` §6 (tabla por bloque). Resumen:
- Selector inicial (sin `team`/`rival`): dos `<select>` de equipo con copy `t('preparar.selector', 'Elegí tu equipo y el
  rival para generar el informe.')`.
- Loading de la vista completa: spinner con progreso por bloque (6 bloques: encabezado ya resuelto, ventajas/amenazas,
  quintetos rivales, amenazas ofensivas, H2H, coincidencia en cancha) — como `GET /api/prepare` devuelve todo en una sola
  respuesta, el "progreso por bloque" es una animación de skeletons secuenciales sobre la misma respuesta (no hay streaming
  parcial: Constitución 9, un solo `fetch`).
- Error de red: `t('preparar.error', 'No se pudo generar el informe.')` con botón reintentar.
- Offline: `t('preparar.offline', 'Sin conexión: preparar un partido necesita conexión.')` (la vista requiere `/api/*`,
  siempre a red).
- Éxito: encabezado + 6 bloques, según spec §6.

**Mobile (<768 px):** bloques apilados como pestañas internas horizontales con scroll (`components/tabs.js`, X-01), según
spec §6. El PDF y el PNG mantienen tamaño fijo (A4 / 1080 px) independiente del viewport — se renderizan sobre un contenedor
oculto de tamaño fijo, no sobre el DOM visible (mismo patrón que usa `exporters.js` `toPNG`).

## 7. Navegación

Agrega el modo `preparar` a la pestaña S5 · Partido (ya registrada por X-01 con las pestañas `analizar`/`vivo`/`momentum`);
F-03 la habilita con `enabled: true` al integrarse. Ruta especial sin `id` de partido:
`#/partido/preparar?team=<code>&rival=<code>[&last=<n>]` (documentado en Arquitectura §3.12, ya vinculante). Actualiza
`docs/frontend.md` mapa de rutas al cerrar.

## 8. Contratos de datos

### `GET /api/prepare` — response 200
```json
{
  "summary": {
    "team": {"code": "CNF", "name": "Nacional"}, "rival": {"code": "PEN", "name": "Peñarol"},
    "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
    "rival_games_considered": 5, "rival_games_total": 16, "last": 5,
    "generated_at": "2026-09-23T14:05:00-03:00"
  },
  "advantages": [
    {"metric": "efg_pct", "delta": 0.8, "own": 53.2, "ref": 52.4, "percentile": 71,
     "text": "Ventaja en tiro: buscá volumen en medio campo", "direction": "up"}
  ],
  "threats": [
    {"metric": "to_pct", "delta": -3.1, "own": 14.2, "ref": 11.1, "percentile": 22,
     "text": "Riesgo de pérdidas: cuidá el balón en la salida de presión", "direction": "down"}
  ],
  "sample_warning": false,
  "rival_lineups": {
    "table_id": "team_lineups", "rows": ["...": "§7.6 de la arquitectura, entity_type=lineup"]
  },
  "rival_threats": {
    "top_usage": [{"player_id": 812, "name": "J. Pérez", "uso_pct": {"value": 0.284, "reason": null}}],
    "best_zone": {"zone": "media_derecha", "ppt": {"value": 1.42, "reason": null}, "has_coordinates": true},
    "points_origin": {
      "paint_pts": {"value": 0.31, "reason": null}, "second_chance_pts": {"value": 0.08, "reason": null},
      "fast_break_pts": {"value": 0.12, "reason": null}, "pts_from_tov": {"value": 0.15, "reason": null},
      "resto": {"value": 0.34, "reason": null}
    }
  },
  "h2h": {
    "team_a": "CNF", "team_b": "PEN",
    "games": [{"game_id": "abc123", "date": "2026-06-12", "competition_label": "Liga Uruguaya 2025/2026",
               "score_a": 78, "score_b": 74, "winner": "CNF"}],
    "record": {"wins_a": 3, "wins_b": 2}
  },
  "matchups": {
    "quinteto": ["...": "filas de matchups.team_matchups(level=quinteto)"],
    "jugador": ["...": "ídem level=jugador"],
    "jugador_quinteto": ["...": "ídem level=jugador_quinteto"]
  },
  "suggestions_profile": null,
  "context": { "...": "§7.5 de la arquitectura" }
}
```

### `GET /api/h2h` — response 200
```json
{"team_a": "CNF", "team_b": "PEN",
 "games": [{"game_id": "abc123", "date": "2026-06-12", "competition_label": "Liga Uruguaya 2025/2026",
            "score_a": 78, "score_b": 74, "winner": "CNF"}],
 "record": {"wins_a": 3, "wins_b": 2}}
```

Filas SQLAlchemy: ninguna nueva ni tocada (F-03 no toca esquema).

## 9. Manejo de errores y offline

| Código | Situación | Mensaje |
|---|---|---|
| 400 `parametro_invalido` | falta `team`/`rival`, o `rival == team` | "Falta el equipo" / "Falta el rival" / "El rival no puede ser el mismo equipo" |
| 404 `no_encontrado` | `team`/`rival` no existen en la competencia | "Equipo no encontrado" / "Rival no encontrado" |
| 401 | sin sesión | manejador existente de `api.js` (redirect a login) |

Offline: la vista completa requiere `/api/*` (siempre a red, service worker); no hay modo offline para el informe (spec no
lo pide). Exportación CSV/PNG/PDF funciona sin red una vez que el informe ya se cargó (procesamiento 100 % cliente, T-06).

Assets estáticos nuevos (`components/prepare-report.js`, `components/matchup-table.js`) se agregan a `STATIC[]` de `sw.js` y
se sube `CACHE` al siguiente entero (número exacto asignado al integrar, según Arquitectura §3.13).

## 10. Riesgos y decisiones

- **Duplicación potencial de `matchup-table.js` con F-07**: F-07 ya construye una tabla de emparejamientos por partido
  (`GET /api/game/<game_id>/matchups`) con su propio componente dentro de `game-view.js` (`gvMatchups`, según spec F-03 §0).
  Este plan reutiliza esa lógica de render extrayéndola a `components/matchup-table.js` si F-07 no lo hizo ya; si al
  implementar se confirma que F-07 ya expone un componente reutilizable equivalente, F-03 lo consume directamente y este
  archivo no se crea (ajustar en tasks.md al implementar). **Dependencia técnica**: verificar
  `../01-F-07-analizar-partido/plan.md` §2 y §6 antes de codificar.
- **`report.default_last_n` como clave de configuración**: PROPUESTA (no está en la arquitectura). Riesgo bajo: si F-13 no
  la adopta, el default queda embebido en `prepare.py` sin romper nada (no es un umbral de muestra ni de cálculo, es solo el
  valor inicial de un filtro de UI).
- **Objetivo de 10 s con emparejamientos de tres niveles**: el nivel `jugador_quinteto` es el de mayor costo (cruza cada
  jugador propio contra cada quinteto rival). Si el prototipo mide más de 10 s en frío con ~35 partidos por equipo, la
  mitigación es cachear cada nivel por separado (`cache.memo("matchups", (team, rival, level, ...), ...)`) en `matchups.py`
  (F-07), no en `prepare.py` — se reporta como ajuste a `../01-F-07-analizar-partido/plan.md` si el humano lo aprueba, sin
  bloquear esta feature con la caché ya prevista.
- **Sin desviaciones respecto a la arquitectura.**
- **Dependencias técnicas**: `lineups.all_lineups` (`../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/plan.md`),
  `matchups.team_matchups`/`game_matchups` (`../01-F-07-analizar-partido/plan.md`), `population.ficha`/`population()`
  (`../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md`), `sample.sample_level`/`adjusted`/`band`
  (`../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md`), `phrases.game_plan`
  (`../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md`), `tables.register_table`/`export_xlsx.py`/
  `components/exporters.js` (`../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md`),
  `shot_zones.zone_table`/`components/shot-chart.js` (`../../fase-1-confiabilidad/17-C-03-mapas-tiro-ppt-tooltip/plan.md`).
- **Incremento diferido** (→ A-09, fase 5): bloque "emparejamiento propuesto por perfil" — `suggestions_profile` queda
  siempre `null` hasta que A-09 exista; el frontend no muestra el bloque (RF-21).
- **Incremento diferido** (→ F-12, fase 5): abrir Preparar directamente desde el calendario/próximo partido de Mi equipo —
  en esta fase se abre eligiendo `team`/`rival` manualmente.
