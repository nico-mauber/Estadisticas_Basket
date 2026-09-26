# Plan — F-16: Ficha de identidad del jugador

> **ID:** F-16 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 05
> **Depende de:** C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)) · F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)) · T-03 ([../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/plan.md))
> **Habilita:** F-05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Arquitectura §3.4, §3.14, §3.21, §5, §6, §7.4, §7.8
> **Estimación:** M · 6–9 h

## 1. Enfoque
Se extiende la identidad persistente de C-08: seis columnas nuevas en `players` vía `upgrade_db()` (arquitectura §5) y dos
funciones nuevas en `backend/identity.py` (`player_profile`, `update_player_profile`) que componen `identity.player_card`
(C-08) con dorsal/posición derivados de `player_game_stats`, la línea de contexto calculada con el contexto T-03 y los
campos manuales. Rutas finas `GET`/`PUT /api/player-profile/<int:player_id>` (dueño F-16). En el frontend, un componente
`components/player-header.js` se monta sobre las pestañas de S4 (antes que cualquier pestaña renderice métricas) y la
pestaña `ficha` se registra en el router de X-01 con el detalle y el formulario para administradores (`/api/me.is_admin`, F-11).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/database.py` | model | modelo `Player` (C-08) + atributos `height_cm`, `birth_year`, `nationality`, `profile_notes`, `profile_updated_at`, `profile_updated_by`; 6 entradas en `upgrade_db().new_cols` | RF-6, RF-7, RF-8 |
| `backend/identity.py` | module (C-08, extiende F-16) | `player_profile(player_id, ctx)`, `update_player_profile(player_id, fields, *, user)`, `_validate_profile_fields(fields)`, `_player_competitions(player_id)` | RF-2…RF-8, RF-11 |
| `backend/app.py` | route | `GET /api/player-profile/<int:player_id>` (`login_required`) y `PUT` (`admin_required`) finos | RF-6, RF-9 |
| `backend/tables.py` / `export_xlsx.py` | module (T-06, solo verificación) | confirmar que ningún `bulk_scopes` incluye columnas de `players` manuales | RF-12 |
| `frontend/js/api.js` | js-api | `api.playerProfile(id, params)`, `api.savePlayerProfile(id, body)` | RF-1, RF-6 |
| `frontend/js/components/player-header.js` | js-component **NUEVO** (PROPUESTA, ver §10) | `renderPlayerHeader(el, profile)` (cabecera compacta) | RF-1, RF-3, RF-4, RF-5 |
| `frontend/js/views/jugador.js` | js-view (X-01) | montar la cabecera antes de la pestaña; `registerTab("jugador", {slug: "ficha", enabled: true, render: renderFichaTab})`; formulario de edición | RF-1, RF-2, RF-6, RF-8, RF-9 |
| `frontend/css/style.css` | css | sección `/* ── player-header / ficha (F-16) ── */` (avatar, grilla de datos, formulario, truncado de la línea) | RF-1, CA-10 |
| `frontend/sw.js` | sw | subir `CACHE` (runtime caching de X-01 cubre el módulo nuevo) | §9 |
| `docs/database.md` | doc | columnas de `players` de F-16 | cierre |
| `docs/api.md` | doc | `GET`/`PUT /api/player-profile/<int:player_id>` | cierre |
| `docs/frontend.md` | doc | cabecera de identidad, pestaña Ficha, copy nuevo | cierre |

Matriz RF → archivo: RF-1 → `player-header.js`, `jugador.js`; RF-2 → `jugador.js` + `identity.player_profile`; RF-3/RF-4/
RF-5/RF-11 → `identity.player_profile`; RF-6/RF-7/RF-8 → `database.py`, `identity.update_player_profile`, `app.py`; RF-9 →
`app.py` (`admin_required`) + `jugador.js` (`is_admin`); RF-10 → `identity.update_player_profile` (`cache.bump_data_version`);
RF-12 → verificación en `tables.py`; RF-13 → `player-header.js`, `jugador.js` (`t()`, `fmtNumber`).

## 3. Backend — rutas y modelos

### Columnas nuevas (tabla `players`, creada por C-08) — vía `upgrade_db()`
| Columna | Tipo | Default | Vía | Constraints |
|---|---|---|---|---|
| `height_cm` | INTEGER | NULL | `("players", "height_cm", "INTEGER DEFAULT NULL")` | validado en app: 140–240 |
| `birth_year` | INTEGER | NULL | `("players", "birth_year", "INTEGER DEFAULT NULL")` | 1950…año actual − 12 |
| `nationality` | TEXT | NULL | `("players", "nationality", "TEXT DEFAULT NULL")` | 2–56 caracteres, recortado |
| `profile_notes` | TEXT | NULL | `("players", "profile_notes", "TEXT DEFAULT NULL")` | ≤ 500 caracteres |
| `profile_updated_at` | TEXT (ISO 8601 con zona) | NULL | `upgrade_db()` | se escribe en cada PUT |
| `profile_updated_by` | TEXT | NULL | `upgrade_db()` | `session["user"]` o `"_open"` |

Se agregan también como atributos del modelo `Player` (para bases nuevas, `create_all` las crea). No se toca
`UNIQUE(team_code, norm_key)`. Sin backfill (nulo = no registrado).

### `GET /api/player-profile/<int:player_id>` — NUEVO (`login_required`, Ctx)
- Query: contexto T-03 (`competition`, `last`, `venue`, `opponent`, `rest`, …). Si no llega `competition`, se resuelve la
  competencia más reciente **del jugador** (§3.1, DA-14).
- Response 200:
```json
{
  "player_id": 128,
  "display_name": "A. Varela",
  "full_name": "Agustín Varela",
  "first_name": "Agustín", "family_name": "Varela",
  "jersey": "7",
  "position": "G", "position_group": "G",
  "height_cm": 198, "birth_year": 1999, "nationality": "Uruguay",
  "profile_notes": null,
  "photo_url": "https://…/photoT.jpg",
  "team": {"code": "CNF", "name": "Nacional"},
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "games": 16,
  "context_line": "Liga Uruguaya de Básquetbol 2025/2026 · Nacional · 16 partidos",
  "competitions": [
    {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026", "games": 16, "last_date": "2026-05-30"},
    {"id": 1, "label": "Liga de las Américas 2026", "games": 4, "last_date": "2026-02-11"}
  ],
  "fields_null_reasons": {"profile_notes": "no_registrado"},
  "profile_updated_at": "2026-09-23T14:05:00-03:00", "profile_updated_by": "nico",
  "editable": true,
  "context": { "...": "eco §7.5" }
}
```
- `fields_null_reasons`: una entrada por cada campo en `null` (`height_cm`, `birth_year`, `nationality`, `profile_notes`,
  `jersey`, `position`, `photo_url`, `first_name`, `family_name`) con `no_registrado`.
- `editable` = `auth.is_admin()` (F-11).
- Errores: 404 `no_encontrado` "Jugador no encontrado"; 400 `contexto_invalido` (T-03); 401.

### `PUT /api/player-profile/<int:player_id>` — NUEVO (`admin_required`)
- Body parcial: `{"height_cm": 198, "birth_year": 1999, "nationality": "Uruguay", "profile_notes": "Zurdo"}`; claves
  ausentes no se tocan; `null` o `""` borran el campo. Claves desconocidas → 400.
- Response 200: mismo shape que GET (sin contexto de query: competencia por defecto).
- Errores: 400 `parametro_invalido` con `details: {campo: mensaje}` — "La altura debe estar entre 140 y 240 cm", "El año de
  nacimiento debe estar entre 1950 y <año>", "La nacionalidad debe tener entre 2 y 56 caracteres", "Las notas no pueden
  superar los 500 caracteres", "Campo desconocido: <x>"; 403 `requiere_admin` "Solo un administrador puede editar la ficha";
  404 `no_encontrado`.

## 4. Backend — lógica

| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `player_profile(player_id: int, ctx: Context) -> dict` | `identity.py` | `players` + `player_game_stats` + `competitions` | RF-2…RF-5, RF-11 |
| `update_player_profile(player_id: int, fields: dict, *, user: str) -> dict` | `identity.py` | escribe `players` | RF-6…RF-8, RF-10 |
| `_validate_profile_fields(fields: dict) -> tuple[dict, dict]` | `identity.py` | reglas RF-6 | RF-6 |
| `_player_competitions(player_id: int) -> list[dict]` | `identity.py` | partidos jugados por competencia | RF-11 |
| `position_group(pos: str) -> str \| None` | `identity.py` (si C-08 no lo definió) | G={G,PG,SG}, F={F,SF,PF}, C={C} | RF-3 |

Algoritmo `player_profile`:
```
card = player_card(player_id)          # C-08: sigue merged_into hasta la ficha destino; NotFound si no existe
pid  = card["player_id"]               # id efectivo (destino)
ids  = [pid] + ids de fichas con merged_into == pid (cadena)          # filas de todas las fichas fusionadas
rows = player_game_stats WHERE player_id IN ids JOIN games (date, competition_id)
jersey   = jersey no vacío de la fila con games.date más reciente (desempate game_id) → None si no hay
position, _ = resolve_identity(rows)   # C-08/dev: FIBA más frecuente no vacío, desempate más reciente
group    = position_group(position)
comps    = _player_competitions(pid)   # [{id,label,games,last_date}] con games = filas con played(minutes); orden last_date desc
comp_id  = ctx.competition_id (ya resuelto por parse_context con player_id=pid → la más reciente del jugador)
sel      = filas de comp_id cuyo partido pasa context.filter_games(..., ctx, team_code=card.team_code) y played(minutes)
games    = len(sel)
context_line = f"{comp.label} · {team.name} · {games} {'partido' if games == 1 else 'partidos'}"
             (comp = "Todas las competencias" si ctx.competition_all)
null_reasons = {campo: "no_registrado" for campo in CAMPOS if valor is None}
return shape §3
```
- `update_player_profile`: `clean, errors = _validate_profile_fields(fields)`; si `errors` → `ValidationError(details)`;
  resuelve `merged_into` (edita la ficha destino); aplica solo claves presentes; `""` → `None`; `nationality.strip()`
  con espacios colapsados; `profile_updated_at = now()` (zona `America/Montevideo`), `profile_updated_by = user`;
  `db.session.commit()`; `cache.bump_data_version("perfil_jugador")` (RF-10).
- Nulos (C-11): nunca se escribe 0 ni `""`; los ausentes se informan en `fields_null_reasons`.
- Caché: `player_profile` no se memoiza aparte (consultas acotadas a un jugador); usa `repository` cacheado para partidos.
- Casos borde: jugador sin partidos jugados en la competencia (solo DNP) → `games = 0` y línea "… · 0 partidos"; jugador
  con partidos solo en otra competencia → la resolución DA-14 elige la suya; `competition=all` → línea "Todas las
  competencias · Nacional · N partidos".

## 5. Frontend — capa API (api.js)
- `playerProfile: (id, params) => apiFetch(`/api/player-profile/${id}${qs(params)}`)`
- `savePlayerProfile: (id, body) => apiFetch(`/api/player-profile/${id}`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})`

## 6. Frontend — UI

**Ubicación:** S4 Jugador (`#/jugador/<player_id>/<pestaña>`), X-01 ya implementado. `views/jugador.js` monta, en este
orden: (1) `player-header` (cabecera de identidad), (2) dock de contexto de F-19 (`mountContextDock`, entidad `player`),
(3) pestañas (`components/tabs.js`), (4) contenido. La pestaña **espera** a que la cabecera tenga datos antes de pintar
métricas (se muestra el esqueleto de la cabecera y un spinner en el contenido): así se cumple el CA "antes de mostrar un
solo número" también con red lenta.

**`components/player-header.js`** — `renderPlayerHeader(el, profile)` (PROPUESTA):
- Avatar: `<img src=photo_url loading="lazy">` con `onerror` → círculo con iniciales; sin `photo_url` → iniciales.
- Línea 1: "#7" (dorsal; "#—" con title "No registrado" si nulo) · **nombre** (`full_name` o `display_name`) · posición
  ("Base (G)"; etiqueta por grupo: G "Base/Escolta", F "Alero/Ala-pívot", C "Pívot"; se muestra el código FIBA) · club.
- Línea 2: `context_line` (con `text-overflow: ellipsis`).
- Chips pequeños de datos de plantel: "1,98 m" · "1999" · "Uruguay"; nulos como "—" con `title` de `NULL_REASON_LABELS
  .no_registrado`.
- <768 px: avatar 40 px, nombre en una línea con elipsis, chips en segunda fila; sin scroll horizontal.

**Pestaña `ficha`** — `renderFichaTab(el, ctx)`:
- Card "Datos de plantel": tabla de dos columnas (Dorsal, Posición, Grupo, Altura, Año de nacimiento, Nacionalidad, Club
  actual, Partidos disputados en la selección, Competencias del jugador con partidos) y notas.
- Pie: "Editado el 23/09/2026 por nico" o "Sin datos cargados a mano".
- Si `profile.editable`: botón "Editar ficha" → formulario inline con `<input type="number" min=140 max=240>` (altura en cm
  con ayuda "cm"), `<input type="number" min=1950 max=<año−12>>`, `<input list="nat-suggest">` (datalist con valores ya
  cargados: PROPUESTA, se arma desde las fichas visibles o se omite si no hay endpoint — ver §10) y `<textarea maxlength=500>`;
  botones "Guardar" / "Cancelar". Validación en cliente con los mismos rangos (el servidor manda). Éxito → `toast("Ficha
  actualizada")` y re-render de cabecera y pestaña. Error 400 → mensaje bajo el campo (`details`).
- Sin permiso: sin botón; nunca se muestran campos editables.

**Estados:** los de spec §6. Componentes reutilizados: `toast` (existente), `core/format.js` (`fmtNumber`, `nullDisplay`,
`NULL_REASON_LABELS`), `core/i18n.js` (`t()`), `components/tabs.js` (X-01), dock de F-19.

## 7. Navegación
Pestaña `ficha` de S4 (slug fijado en arquitectura §3.12) habilitada con `registerTab`. La pestaña por defecto sigue siendo
`resumen`. La cabecera se ve en todas las pestañas. `docs/frontend.md` actualiza el mapa de S4.

## 8. Contratos de datos
- GET/PUT: §3. Fila `players` tocada: 6 columnas nuevas.
- Etiquetas de grupo de posición (frontend): `{G: "Base/Escolta", F: "Alero/Ala-pívot", C: "Pívot"}` vía `t()`.

## 9. Manejo de errores y offline
| Código | Mensaje |
|---|---|
| 400 `parametro_invalido` | mensaje por campo desde `details` |
| 403 `requiere_admin` | "Solo un administrador puede editar la ficha" |
| 404 | "No encontramos este jugador" + enlace a Explorar |
| 401 | handler global |
| red/offline | "Sin conexión: no se pudo cargar la ficha" / "…no se pudo guardar" (el formulario conserva lo tipeado) |
- `sw.js`: subir `CACHE`; si X-01 no hubiera pasado a runtime caching, agregar `/js/components/player-header.js` a `STATIC`.
- La foto es de un dominio externo: offline no carga → iniciales (sin error en consola más allá del `onerror` manejado).

## 10. Riesgos / decisiones
- **Qué publica FIBA (verificado en código y en arquitectura §1.1):** `shirtNumber` → `jersey` y `playingPosition` →
  `position` se persisten hoy por partido; `firstName`/`familyName`/`photoT` los captura F-11; altura, nacimiento y
  nacionalidad **no** se publican → carga manual. Sin cambios en `fiba_fetcher.py` en F-16.
- **PROPUESTA (no está en 00-arquitectura-transversal.md): `components/player-header.js`.** La arquitectura §8 no lista un
  componente de cabecera de jugador; se necesita en todas las pestañas de S4 y lo reutiliza F-05. Reportado en huecos.
- **PROPUESTA: funciones `identity.player_profile` e `identity.update_player_profile`.** §3.4 declara que F-16 extiende
  `identity.py` pero no fija sus firmas. Reportado.
- **Extensión del shape de `GET /api/player-profile`:** la arquitectura fija `{player_id, display_name, jersey, position,
  height_cm, birth_year, nationality, team, context_line, fields_null_reasons}`; F-16 (dueño) agrega `full_name`,
  `first_name`, `family_name`, `position_group`, `profile_notes`, `photo_url`, `competition`, `games`, `competitions`,
  `profile_updated_at/by`, `editable` y `context`. `competitions` lo consume F-05 para comparar entre competencias.
- **Datalist de nacionalidades:** requeriría un endpoint de valores distintos; para no inventar uno, el datalist se arma
  con los valores ya presentes en las fichas que el cliente tenga en memoria (plantel de F-08 si está cargado) o se omite.
  Si el cliente pide normalización, se agrega luego (no bloquea).
- **Riesgo R-12 (datos personales):** solo administradores editan; sin exportación masiva; se documenta en
  `docs/database.md`.
- **Riesgo: sobre-fusión (R-11):** datos manuales cargados sobre una ficha que mezcla dos personas; mitigación: la ficha
  muestra `full_name` y foto, y F-11 lista sospechas de duplicado/sobre-fusión.
- **Dependencias técnicas:** tabla `players`, `player_game_stats.player_id`, `identity.player_card`, `resolve_identity`,
  `norm_name` (C-08, [../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md));
  `player_game_stats.first_name/family_name/photo_url`, `repository`, `cache.bump_data_version`, `auth.admin_required`,
  `auth.is_admin`, `/api/me.is_admin` (F-11, [../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md));
  `context.parse_context`, `context.filter_games`, `context_echo` (T-03); `core/router.js`, `registerTab`, `views/jugador.js`
  (X-01); `mountContextDock` (F-19, [../../fase-2-contexto-comparabilidad/04-F-19-filtros-rapidos-cabecera/plan.md](../../fase-2-contexto-comparabilidad/04-F-19-filtros-rapidos-cabecera/plan.md), opcional: sin F-19 la cabecera funciona igual).
- **Estimación:** M · 6–9 h (esquema 0,5 h, identity + rutas 2,5 h, cabecera + pestaña + formulario 2–3 h, verificación y
  docs 1–2 h).
