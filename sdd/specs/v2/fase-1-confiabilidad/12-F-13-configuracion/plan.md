# Plan — F-13: Configuración

> **ID:** F-13 · **Prioridad:** P1 · **Fase y orden:** 1·12
> **Depende de:** C-06 ([../05-C-06-umbral-cierres/plan.md](../05-C-06-umbral-cierres/plan.md)), C-11 ([../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)), F-11 ([../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)), C-09 ([../06-C-09-tabla-general-liga/plan.md](../06-C-09-tabla-general-liga/plan.md), migra sus constantes) · **Habilita:** T-02, T-04, T-06, F-06, F-17, A-03, A-05, F-02, F-14, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · [Arquitectura](../../00-arquitectura-transversal.md) §3.2, §3.3, §3.12, §3.14, §3.21, §5, §6, §7.8, §8
> **Estimación:** L · 12–18 h

## 1. Enfoque
Módulo backend `config.py` con el catálogo `CONFIG_SPEC` (todas las claves de Arquitectura §3.2, con estado `activa`/`reservada`), lectura tipada `config.get()` cacheada por `app_meta.config_version` (infraestructura `cache.py` de F-11) y escritura validada y atómica que incrementa `config_version`. Tabla `app_config` (solo overrides) y tabla `user_prefs` + `prefs.py` para preferencias por usuario. Rutas finas `/api/settings*` y `/api/prefs` en `app.py` (escritura con `auth.admin_required` de F-11). Se reemplazan los literales de C-06 (`clutch.py`) y C-09 (tabla general) por `config.get`, y `repository.resolve_competition` (F-11) lee `ui.default_competition_id`. Frontend: `core/prefs.js`, componente `components/settings-form.js` (generado desde `spec`) y una vista `config` abierta desde un engranaje en el header (X-01 la reubica en S9).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/config.py` | module **NUEVO** | `ConfigKey`, `CONFIG_SPEC`, `SECTIONS`, `get`, `get_many`, `set_values`, `reset`, `spec_json`, validación y coherencia | RF-1, RF-2, RF-4, RF-5, RF-7, RF-10, RF-16 |
| `backend/prefs.py` | module **NUEVO** | `current_owner`, `get_prefs`, `set_pref`, `delete_pref`, `PREF_SCOPES` | RF-14 |
| `backend/database.py` | model | modelos `AppConfig`, `UserPref` (create_all); sin `ALTER` | RF-2, RF-14, RF-16 |
| `backend/app.py` | route | `GET/PUT /api/settings`, `POST /api/settings/reset`, `GET/PUT/DELETE /api/prefs`; `clutch_team` sin literal; tabla general sin literal (si C-09 dejó el cálculo en la ruta) | RF-3, RF-4, RF-5, RF-6, RF-8, RF-14 |
| `backend/clutch.py` | module | `team_clutch(..., margin=None, window_secs=None)`; `_is_clutch`/`_entry_margin` reciben `window_secs`; se elimina `CLUTCH_SECS` | RF-7, RF-8 |
| función de tabla general de C-09 (hoy `app.league_overview`; si C-09 la movió a `competitions.py`/otro módulo, ahí) | module | puntos y desempate desde `standings.*` + eco `standings_rules` | RF-8 |
| `backend/repository.py` (de F-11) | module | `resolve_competition`: paso 5 lee `config.get("ui.default_competition_id")` | RF-9 |
| `backend/auth.py` | module | (sin cambios: consume `admin_required`/`is_admin` de F-11) | RF-6 |
| `backend/test_auth.py` | test existente | (sin cambios en F-13; F-11 ya suma escenarios admin) | RF-6 |
| `frontend/js/api.js` | js-api | `settings()`, `saveSettings(values)`, `resetSettings(body)`, `prefs(scope)`, `savePref(scope,key,value)`, `deletePref(scope,key)` | RF-3, RF-4, RF-5, RF-14 |
| `frontend/js/core/prefs.js` | js-core **NUEVO** | `getPref`, `setPref`, `loadPrefs` (copia en `localStorage` con try/catch) | RF-15 |
| `frontend/js/components/settings-form.js` | js-component **NUEVO** (PROPUESTA de nombre) | `renderSettingsForm(el, payload, {onSave, onReset})`: módulos, controles por tipo, errores por campo, solo lectura | RF-11, RF-12, RF-13, RF-16 |
| `frontend/js/app.js` | js-view | engranaje en `<header>`; sección `config` (fuera de la barra inferior); `renderConfig()`; leyenda de Cierres sin literal; leyenda de tabla general | RF-8, RF-11, RF-12, RF-13 |
| `frontend/css/style.css` | css | sección `/* ── settings-form (F-13) ── */`: `.settings-row`, `.settings-modified`, `.settings-actions` (sticky al pie), `.header-gear` | RF-11 |
| `frontend/sw.js` | sw | agregar `/js/core/prefs.js`, `/js/components/settings-form.js` a `STATIC`; subir `CACHE` al siguiente entero | RF-11, RF-15 |
| `docs/api.md` | doc (cierre) | endpoints `/api/settings*`, `/api/prefs`; default de `margin` en `/api/clutch`; `standings_rules` en `/api/league` | — |
| `docs/database.md` | doc (cierre) | tablas `app_config`, `user_prefs` | — |
| `docs/frontend.md` | doc (cierre) | vista Configuración, engranaje, `core/prefs.js`, `settings-form.js`, copy nuevo | — |
| `docs/architecture.md` | doc (cierre) | módulos `config.py`/`prefs.py`; regla "ningún umbral en el código" | — |
| `docs/deployment.md` | doc (cierre) | recordatorio de `ADMIN_USERS` (variable de F-11) para editar configuración | — |

Matriz RF → archivo: RF-1 `config.py`; RF-2 `config.py`, `database.py`; RF-3 `app.py`, `config.py`, `api.js`; RF-4 `config.py`, `app.py`; RF-5 `config.py`, `app.py`; RF-6 `app.py` (`admin_required`); RF-7 `config.py` (caché por versión), `clutch.py`, tabla general; RF-8 `clutch.py`, `app.py`, tabla general, `app.js`; RF-9 `repository.py`, `config.py` (validador dinámico); RF-10 `config.py`; RF-11 `settings-form.js`, `app.js`, `style.css`, `sw.js`; RF-12 `settings-form.js`, `app.js`; RF-13 `settings-form.js`; RF-14 `prefs.py`, `database.py`, `app.py`; RF-15 `core/prefs.js`, `api.js`; RF-16 `config.py`, `database.py`, `settings-form.js`.

## 3. Backend — rutas y modelos

### 3.1 Tablas (NUEVAS, vía `db.create_all()` en `init_db`, idempotente; sin `upgrade_db`)
| Tabla | Columna | Tipo | Default | Constraints |
|---|---|---|---|---|
| `app_config` | `key` | TEXT | — | PRIMARY KEY |
| | `value` | TEXT (JSON) | — | NOT NULL |
| | `updated_at` | TEXT (ISO 8601 con zona, `datetime.now(timezone.utc).isoformat()`) | — | NOT NULL |
| | `updated_by` | TEXT | NULL | usuario de sesión o `"_open"` |
| `user_prefs` | `owner` | TEXT | — | PK compuesta `(owner, scope, key)` |
| | `scope` | TEXT | — | |
| | `key` | TEXT | — | |
| | `value` | TEXT (JSON) | — | NOT NULL |
| | `updated_at` | TEXT | — | NOT NULL |

`app_meta` (clave `config_version`) la crea F-11; F-13 la usa vía `cache.bump_config_version()`.

### 3.2 `GET /api/settings` (NUEVO · `login_required`)
Response 200:
```json
{
  "version": 7,
  "is_admin": true,
  "values": {
    "clutch.margin": 10, "clutch.window_secs": 300,
    "standings.win_points": 2, "standings.loss_points": 1, "standings.tiebreak": "diferencia",
    "ui.default_competition_id": null
  },
  "sections": [
    {"slug": "umbrales", "label": "Umbrales de muestra"},
    {"slug": "contexto", "label": "Reglas de contexto"},
    {"slug": "momentum", "label": "Reglas de Momentum"},
    {"slug": "preferencias", "label": "Preferencias"}
  ],
  "spec": [
    {"key": "clutch.margin", "type": "int", "default": 10, "min": 0, "max": 40, "choices": null,
     "unit": "puntos", "label": "Diferencia máxima de partido cerrado",
     "help": "Un partido cuenta como cierre si la diferencia al inicio de la ventana es menor o igual a este valor.",
     "section": "contexto", "status": "activa", "consumer": "C-06, F-06, A-06",
     "modified": false, "updated_at": null, "updated_by": null},
    {"key": "ui.default_competition_id", "type": "int_or_null", "default": null, "min": null, "max": null,
     "choices": [{"value": null, "label": "Automática (la más reciente)"}, {"value": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}],
     "unit": null, "label": "Competencia por defecto", "help": "…", "section": "preferencias",
     "status": "activa", "consumer": "F-11, T-03", "modified": false, "updated_at": null, "updated_by": null},
    {"key": "momentum.window_secs", "type": "int", "default": 300, "min": 60, "max": 600, "choices": null,
     "unit": "segundos", "label": "Ventana de momentum", "help": "…", "section": "momentum",
     "status": "reservada", "consumer": "F-02", "modified": false, "updated_at": null, "updated_by": null}
  ]
}
```
`values` incluye **solo claves activas** (las reservadas se leen en backend con `config.get` y devuelven su default, pero no se exponen como vigentes en la UI). `spec` incluye todas. Errores: 401 (sin sesión, `login_required`).

### 3.3 `PUT /api/settings` (NUEVO · `admin_required`)
Request: `{"values": {"clutch.margin": 5, "standings.win_points": 3}}`. Response 200: igual a GET con los valores nuevos y `version` incrementada.
Errores (formato §7.8):
- 400 `parametro_invalido`: `{"error": "Hay valores inválidos", "code": "parametro_invalido", "details": {"clutch.margin": "Debe estar entre 0 y 40", "sample.lineup.min": "El mínimo no puede superar al de muestra alta"}}`.
- 400 `clave_no_disponible`: `{"error": "La clave momentum.window_secs todavía no está disponible", "code": "clave_no_disponible", "details": {"momentum.window_secs": "Se habilita con F-02"}}` (también para claves desconocidas: "Clave desconocida").
- 400 `parametro_invalido` si el body no es `{values: {...}}` o está vacío: "No hay valores para guardar".
- 403 `requiere_admin`: "Solo un administrador puede modificar la configuración".

### 3.4 `POST /api/settings/reset` (NUEVO · `admin_required`)
Request: `{"keys": ["clutch.margin"]}` o `{"section": "contexto"}` (PROPUESTA: `section`). Response 200: igual a GET. Errores: 400 `parametro_invalido` ("Indicá claves o una sección"), 400 `clave_no_disponible`, 403 `requiere_admin`. Restablecer una clave sin override no es error (idempotente) y no incrementa la versión si no borró filas.

### 3.5 `GET /api/prefs?scope=<scope>` · `PUT /api/prefs` · `DELETE /api/prefs` (NUEVOS · `login_required`)
- GET → `{"scope": "table.columns", "values": {"team_lineups": ["_name", "_sample", "net_rating"]}}`. Sin `scope` o scope no permitido → 400 `parametro_invalido` "Ámbito de preferencia inválido".
- PUT body `{"scope": "panel.collapsed", "key": "game_plan", "value": true}` → `{"scope": "panel.collapsed", "key": "game_plan", "value": true}`. Errores 400: scope inválido; `key` vacía o > 64 caracteres; `value` serializado > 8 KB (PROPUESTA de límite); en scope `ui`, clave fuera de `{language, home_team, followed_players, last_competition}`.
- DELETE body `{"scope", "key"}` → `{"scope", "key", "deleted": true}` (idempotente: `deleted: false` si no existía).
- Las preferencias **no** tocan `config_version` (son por usuario y no afectan cálculos compartidos).

### 3.6 Endpoints existentes tocados
- `GET /api/clutch/<team_code>` (dueño C-06): si falta `margin` o es inválido → `margin = None` y `team_clutch` usa `config.get("clutch.margin")`. Response sin cambio de shape salvo **`window_secs`** (PROPUESTA si C-06 no lo agregó; necesario para la leyenda "últimos N min").
- `GET /api/league` (tabla general C-09): `table_points` con `standings.*`; orden de la tabla general con `standings.tiebreak`. Se agrega `standings_rules: {win_points, loss_points, tiebreak}` (PROPUESTA; si C-09 migró la tabla a T-06 `league_standings`, el eco va en `meta`). Nota: `/api/league` es una lista; si C-09 no la convirtió en objeto, el eco va en el endpoint/tabla de posiciones que C-09 haya definido (ver [../06-C-09-tabla-general-liga/plan.md](../06-C-09-tabla-general-liga/plan.md)).

## 4. Backend — lógica

### 4.1 `backend/config.py` (NUEVO)
```
@dataclass(frozen=True)
class ConfigKey:
    key: str; type: str          # int | float | bool | enum | json | int_or_null | float_or_null
    default: Any; min: float | None = None; max: float | None = None
    choices: tuple | None = None # enum
    dynamic_choices: str | None = None   # "competitions" (valida contra competitions.list_competitions())
    unit: str | None = None; label: str = ""; help: str = ""
    section: str = "preferencias"        # umbrales | contexto | momentum | preferencias
    consumer: str = ""; owner: str = "F-13"
    status: str = "reservada"            # activa | reservada   (PROPUESTA: campo no está en Arq. §3.2)

SECTIONS = [("umbrales","Umbrales de muestra"),("contexto","Reglas de contexto"),
            ("momentum","Reglas de Momentum"),("preferencias","Preferencias")]
CONFIG_SPEC: dict[str, ConfigKey]   # ≈70 claves, orden de Arq. §3.2 (ver spec §5)
COHERENCE_RULES = [ ("sample.lineup.min","<=","sample.lineup.high"), … por cada entidad de muestra …,
                    ("clock.early_max","<","clock.mid_max"), ("transition.max_secs","<","early_offense.max_secs"),
                    ("oreb.putback_secs","<","oreb.kickout_secs"), ("gameplan.items_min","<=","gameplan.items_max"),
                    ("insights.min_items","<=","insights.max_items"), ("insights.low_pct","<","insights.high_pct") ]
```

**`get(key: str) -> Any`**
1. Si `key not in CONFIG_SPEC` → `KeyError` (bug de programación, nunca silencioso).
2. `overrides = _overrides()` → `cache.memo("cfg", ("all",), _load_overrides)`; la clave de memo incluye `data_version` y `config_version` (§3.14), así que un cambio de versión en otro proceso fuerza recarga en la siguiente petición. `_load_overrides()` = `SELECT key, value FROM app_config` → `{key: json.loads(value)}`; filas con clave desconocida o valor que ya no valida (catálogo cambió) se ignoran con `log.warning` y se usa el default.
3. Devuelve `overrides.get(key, spec.default)` (valor ya tipado).
4. Fuera de contexto de petición (scripts, `python backend/database.py`): `cache.get_versions()` sin `flask.g` → lee la versión directo (F-11 define el comportamiento; si no hay app context se usa el default y se registra `log.debug`). PROPUESTA: `get()` acepta ser llamado solo dentro de `app.app_context()`.

**`get_many(prefix: str) -> dict`**: `{k: get(k) for k in CONFIG_SPEC if k.startswith(prefix)}`.

**`validate(key, raw) -> (value, error|None)`** (privada):
- `int`: `isinstance(raw, bool)` → error; acepta int o string entera (`"5"`); fuera de `[min, max]` → "Debe estar entre {min} y {max}".
- `float`: int/float/string numérica con coma o punto (`"1,5"` → 1.5); rango ídem.
- `int_or_null` / `float_or_null`: `None` o `""` → `None`; si no, como int/float.
- `bool`: `true/false` (JSON); strings `"true"/"false"`.
- `enum`: valor ∈ `choices` → si no "Valor no permitido".
- `json`: `ui.metric_labels` → dict `str → str`, cada etiqueta 1–24 caracteres sin saltos de línea; `rapm.lambdas` → lista de 1–10 números > 0.
- `dynamic_choices == "competitions"`: `None` o id existente en `competitions` (consulta a `competitions.list_competitions()` de F-11) → si no "La competencia no existe".

**`set_values(values: dict, *, user: str | None) -> dict`**
```
errors = {}; parsed = {}
for k, raw in values.items():
    spec = CONFIG_SPEC.get(k)
    if spec is None:            errors[k] = ("clave_no_disponible", "Clave desconocida"); continue
    if spec.status != "activa": errors[k] = ("clave_no_disponible", f"Se habilita con {spec.consumer}"); continue
    v, err = validate(spec, raw); if err: errors[k] = ("parametro_invalido", err) else parsed[k] = v
effective = {**current_effective_values(), **parsed}
for a, op, b in COHERENCE_RULES:     # solo si ambas claves están activas
    if violates(effective[a], op, effective[b]): errors[a] = ("parametro_invalido", mensaje_coherencia(a, b))
if errors: raise ConfigError(errors)   # la ruta decide 400 con el code dominante (clave_no_disponible > parametro_invalido)
with db.session.begin_nested():
    for k, v in parsed.items():
        if v == CONFIG_SPEC[k].default: DELETE FROM app_config WHERE key=k      # RF-2: no guardar defaults
        else: UPSERT app_config(key=k, value=json.dumps(v), updated_at=now, updated_by=user or "_open")
db.session.commit()
if parsed: cache.bump_config_version()     # F-11; incrementa app_meta.config_version
return payload()
```
Atomicidad: validación completa antes de escribir; escritura en una única transacción (`commit` único). Si el commit falla → `rollback` y 500 "No se pudo guardar la configuración".

**`reset(keys: list[str]) -> dict`**: valida que existan y estén activas; `DELETE FROM app_config WHERE key IN (...)`; si `rowcount > 0` → `bump_config_version()`. `reset_section(slug)` (PROPUESTA) = `reset([k for k in activas if section == slug])`.

**`spec_json() -> list[dict]`**: serializa `CONFIG_SPEC` en orden + `modified`, `updated_at`, `updated_by` (de `app_config`); resuelve `dynamic_choices` a la lista `[{value: None, label: "Automática (la más reciente)"}, {value: id, label: competition.label}]`.

**`payload(is_admin: bool) -> dict`**: `{version, is_admin, values: {k: get(k) for activas}, sections, spec: spec_json()}`.

`current_owner` para `updated_by`: `session.get("user")` si `auth.auth_enabled()`, si no `"_open"` (misma regla que `prefs.current_owner`).

### 4.2 `backend/prefs.py` (NUEVO)
```
PREF_SCOPES = {"table.columns": None, "table.sort": None, "table.colorize": None, "panel.collapsed": None,
               "ui": {"language", "home_team", "followed_players", "last_competition"}}
MAX_VALUE_BYTES = 8192        # PROPUESTA
current_owner() -> str        # session["user"] si auth habilitada, "_open" si modo abierto
get_prefs(scope) -> dict      # SELECT key, value FROM user_prefs WHERE owner=? AND scope=?
set_pref(scope, key, value) -> None    # valida scope/key/tamaño; UPSERT (on_conflict_do_update sobre la PK)
delete_pref(scope, key) -> bool
```
Sin caché (lecturas puntuales por usuario). No toca `config_version`.

### 4.3 Migración de constantes (RF-8)
**`backend/clutch.py`** (sobre el estado que deje C-06, que ya corrige `OVERTIME`):
- Se elimina `CLUTCH_SECS = 300`.
- `_is_clutch(ev, last_regular, window_secs)` y `_entry_margin(evs, last_reg, window_secs)` reciben la ventana: condición `clock_secs <= window_secs` y "último evento con `clock_secs > window_secs`".
- `team_clutch(games, team_code, team_name, margin=None, window_secs=None)`: `margin = config.get("clutch.margin") if margin is None else margin`; ídem `window_secs`. Response agrega `window_secs` (PROPUESTA si C-06 no lo hizo).
- `lineups.lineup_clutch` (F-06) y F-04 reutilizarán la misma lectura (no se tocan ahora).

**`backend/app.py:clutch_team`**: `margin = request.args.get("margin", type=int)`; si `None` o `< 0` → `None` (se elimina `margin = 10`).

**Tabla general (C-09)**: donde C-09 calcule los puntos (hoy `app.league_overview`: `"table_points": 2 * wins + losses`):
```
wp, lp = config.get("standings.win_points"), config.get("standings.loss_points")
table_points = wp * wins + lp * losses
orden: key = (-table_points, -(pts_for - pts_against) if tiebreak == "diferencia" else 0, team_name)
```
Nulos: si C-09 o C-11 dejaron `pts_for/pts_against` en `None` para equipos sin datos, esos equipos van al final (`cmpNullsLast` en frontend; en backend clave `(x is None, …)`).

**`repository.resolve_competition`** (F-11, arquitectura §3.1): el paso "→ `ui.default_competition_id` (config)" se implementa como `cid = config.get("ui.default_competition_id"); if cid and competition_exists(cid): return cid`. Si la competencia fue borrada/fusionada, se ignora (sigue con "la del partido más reciente") y `data_quality` puede listarlo (fuera de alcance). F-11 deja ese paso con un `TODO F-13` o default `None`; F-13 lo conecta.

### 4.4 Casos borde
- Valor guardado que ya no valida tras cambiar el catálogo (rango más estrecho): `get` usa el default y la pantalla muestra "Valor guardado inválido, se usa el default" (campo `invalid_stored: true` en `spec`, PROPUESTA).
- `ui.default_competition_id` apuntando a una competencia fusionada: al fusionar, `competitions.merge_competitions` (F-11) debería reescribir el override al id destino — se deja registrado como riesgo R-3 y tarea opcional.
- Dos administradores guardan a la vez: último en escribir gana por clave; la versión incrementa dos veces (sin bloqueo optimista; PROPUESTA de `If-Match: version` fuera de alcance).
- Modo abierto (sin `AUTH_USERS`): `admin_required` permite todo; `updated_by = "_open"`.

## 5. Frontend — capa API (`api.js`)
| Método | Endpoint | Notas |
|---|---|---|
| `settings()` | `GET /api/settings` | |
| `saveSettings(values)` | `PUT /api/settings` body `{values}` | `apiFetch` lanza `Error(err.error)`; se extiende para adjuntar `err.code` y `err.details` al objeto `Error` (PROPUESTA mínima: `e.code`, `e.details`) para mostrar errores por campo |
| `resetSettings(body)` | `POST /api/settings/reset` body `{keys}` o `{section}` | |
| `prefs(scope)` | `GET /api/prefs?scope=` | usa `qs()` si ya existe (T-05); si no, `encodeURIComponent` |
| `savePref(scope, key, value)` | `PUT /api/prefs` | |
| `deletePref(scope, key)` | `DELETE /api/prefs` | |
Todos con `credentials: "same-origin"` (ya en `apiFetch`).

## 6. Frontend — UI

### 6.1 Ubicación (fase 1, antes de X-01)
- `app.js` layout: en `<header>` se agrega `<button class="header-gear" id="btn-config" aria-label="Configuración">⚙</button>` (visible si hay sesión o modo abierto). Click → `setSection("config")`.
- `sections` suma `"config"` y un `<div class="section" id="sec-config">`; **no** se agrega botón a la barra inferior ni a la superior (Arq. §3.12). Volver: botón "← Volver" en la vista que retorna a la última sección.
- X-01: mueve `renderConfig` a `views/configuracion.js`, registra S9 (`configuracion`, pestañas `umbrales`, `contexto`, `momentum`, `preferencias`) y elimina el engranaje o lo conserva como acceso directo (decisión de X-01).

### 6.2 `components/settings-form.js` — `renderSettingsForm(el, payload, {onSave, onReset, initialSection})`
- Barra de módulos con `filter-pill` (Umbrales de muestra · Reglas de contexto · Reglas de Momentum · Preferencias); módulo activo recordado en `sessionStorage` (try/catch).
- Por cada `spec` con `status === "activa"` del módulo: fila `.settings-row` con etiqueta, control según `type` (`int`/`float` → `<input type="number" inputmode="decimal" min max step>`; `enum` y `int_or_null` con `choices` → `<select>`; `bool` → checkbox tipo interruptor; `json` → `<textarea>` con validación JSON local de forma, solo `ui.metric_labels` cuando T-05 la active), unidad y rango (`t('config.range', 'entre {min} y {max} {unit}')`), ayuda, "Por defecto: {default}", marca `.settings-modified` "Modificado", y "Modificado por {updated_by} el {fecha}" (`_fmtDate`).
- Módulo sin claves activas: vacío con la lista de consumidores de sus claves reservadas (agrupadas por `consumer`).
- Formato numérico con `fmtNumber` de `core/format.js` (C-11; coma decimal DA-36); `null` → "Automática (la más reciente)" (C-11: nunca 0).
- Estado "sucio": compara con valores iniciales; botón "Guardar cambios" deshabilitado si no hay cambios. "Restablecer módulo" y, por fila, ícono "↺" (restablecer clave) si `modified`.
- Guardar: `onSave(changedValues)` → spinner en botón; en error 400 pinta `details[clave]` bajo cada campo (`.below-avg` existente para color de error); en 403 muestra aviso de solo lectura.
- Solo lectura (`payload.is_admin === false`): `disabled` en todos los controles, sin botones, aviso superior.
- Todo el copy con `t('config.*', '…')` (`core/i18n.js`, C-11).
- Mobile <768 px: `.settings-row` en columna; `.settings-actions` con `position: sticky; bottom: calc(var(--bottom-nav-h) + 8px)` (sobre la barra inferior fija).

### 6.3 `renderConfig()` en `app.js`
1. Loading (spinner + "Cargando configuración…").
2. `api.settings()` → `renderSettingsForm(...)`.
3. `onSave(values)` → `api.saveSettings(values)` → re-render con la respuesta + `toast("Configuración guardada. Los cálculos ya usan los valores nuevos.")` + invalidar cachés de vista del frontend (`_teamData = null`, `_clutchData = null`, datos de Liga) para que la próxima vista se recalcule (RF-12).
4. `onReset(body)` → `confirm(...)` → `api.resetSettings(body)` → ídem.
5. Error de carga → mensaje + "Reintentar".

### 6.4 Consumidores de UI tocados
- `renderTeamClutch`: se elimina `CLUTCH_MARGIN_DEFAULT`; loading: "Cierres (últimos 5 min)" genérico → con respuesta: `titleFor(d.margin, d.window_secs)` = "Cierres (últimos {window_secs/60} min, dif ≤ {margin})". Si `window_secs` falta (C-06 no lo agregó y la PROPUESTA no se aprueba), el título omite la duración de la ventana antes que usar un literal.
- Tabla general (`_standingsCardHTML`): leyenda desde `standings_rules`.

### 6.5 `core/prefs.js` (NUEVO, Arq. §8)
```
const _mem = {}                                        // {scope: {key: value}}
loadPrefs(scope) -> Promise<object>                    // api.prefs(scope) → _mem[scope]; copia en localStorage "sb.prefs.<scope>" (try/catch)
getPref(scope, key, def)                               // sync: _mem → localStorage → def
setPref(scope, key, value) -> Promise<void>            // optimista en _mem + localStorage; api.savePref; si falla, conserva local y toast discreto
```
(`loadPrefs` es PROPUESTA: la firma de Arq. §8 solo lista `getPref`/`setPref`; hace falta una carga asíncrona inicial.) En F-13 no hay consumidores de UI; se verifica desde la consola del navegador.

## 7. Navegación
Vista nueva `config` (fase 1) sin hash (no existe routing hasta X-01; Arq. D-03). Se documenta en `docs/frontend.md` §Vistas como "Configuración (engranaje del header)". X-01: `#/configuracion/<modulo>`.

## 8. Contratos de datos
- `GET/PUT /api/settings`, `POST /api/settings/reset`: §3.2–3.4.
- `ConfigKey` serializado: `{key, type, default, min, max, choices, unit, label, help, section, status, consumer, modified, updated_at, updated_by}`.
- Prefs: §3.5.
- Filas: `AppConfig(key, value, updated_at, updated_by)`; `UserPref(owner, scope, key, value, updated_at)`.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje (español) |
|---|---|---|
| 400 `parametro_invalido` | tipo/rango/coherencia; body vacío; scope inválido | "Hay valores inválidos" + `details`; "No hay valores para guardar"; "Ámbito de preferencia inválido" |
| 400 `clave_no_disponible` | clave reservada o desconocida | "La clave {k} todavía no está disponible" / "Clave desconocida" |
| 401 | sin sesión | (handler global existente → login) |
| 403 `requiere_admin` | no admin | "Solo un administrador puede modificar la configuración" |
| 500 | fallo al guardar | "No se pudo guardar la configuración" |
Offline: `/api/*` siempre a red (SW); la vista muestra "Sin conexión: la configuración no está disponible." si `fetch` falla por red (`TypeError`). `sw.js`: agregar `core/prefs.js` y `components/settings-form.js` a `STATIC` y subir `CACHE` al siguiente entero disponible al integrar (hoy `smart-basket-v9`; el número lo asigna la integración, Arq. §3.13).

## 10. Riesgos / decisiones
- **D-1 (desviación/PROPUESTA): campo `status` (`activa`/`reservada`) en `CONFIG_SPEC`.** La Arquitectura §3.2 dice que cada requisito posterior "agrega sus claves"; la nota del orquestador pide definirlas ahora. Se declaran todas ahora (nombres y defaults literales de §3.2) y el requisito consumidor cambia `status` a `activa` al empezar a leerla. El dueño de la clave sigue siendo el de la columna "Agrega" para su **activación y uso**. Reportado en `desacuerdos_arquitectura`.
- **D-2: claves de T-02/T-01/T-05 reservadas** hasta que esos requisitos (orden 13–15) las activen: evita controles sin efecto; el CA-1 se verifica con C-06 y C-09.
- **D-3: `window_secs` en la respuesta de `/api/clutch`** y **`standings_rules`** en la tabla general: PROPUESTAS (no están en Arq. §6) necesarias para que las leyendas no tengan literales.
- **D-4: `loadPrefs(scope)`** en `core/prefs.js` y `e.code`/`e.details` en errores de `apiFetch`: PROPUESTAS mínimas.
- **D-5: `POST /api/settings/reset` con `{section}`**: PROPUESTA de conveniencia.
- **R-1: caché por versión depende de F-11** (`cache.py`, `app_meta`). Si F-11 no está integrado, F-13 no puede cerrar (dependencia dura).
- **R-2: literales residuales.** CA-9 exige búsqueda de literales; los de T-02 (`possessions < 10` en Combinación) y C-03 (1,00/0,85) quedan registrados como deuda de sus dueños, no de F-13.
- **R-3: `ui.default_competition_id` huérfano** tras fusionar/borrar competencias: `get` lo valida en `resolve_competition` (se ignora si no existe); tarea opcional para que `merge_competitions` reescriba el override.
- **R-4: cambio de números visibles** al migrar la tabla general: con defaults 2/1 los resultados son idénticos a `dev` (verificar antes/después en `progress.md`).
- **Dependencias técnicas:** `auth.admin_required`, `auth.is_admin` (F-11, [../02-F-11-calidad-datos-competencias/plan.md](../02-F-11-calidad-datos-competencias/plan.md)); `cache.memo`, `cache.get_versions`, `cache.bump_config_version`, tabla `app_meta` (F-11); `repository.resolve_competition`, `competitions.list_competitions` (F-11); `clutch.team_clutch` con `OVERTIME` corregido (C-06, [../05-C-06-umbral-cierres/plan.md](../05-C-06-umbral-cierres/plan.md)); cálculo de tabla general (C-09, [../06-C-09-tabla-general-liga/plan.md](../06-C-09-tabla-general-liga/plan.md)); `core/format.js` (`fmtNumber`, `nullDisplay`) y `core/i18n.js` (`t`) (C-11, [../01-C-11-tratamiento-de-nulos/plan.md](../01-C-11-tratamiento-de-nulos/plan.md)).
- **Consumidores posteriores** (activan claves): T-02 ([../14-T-02-confiabilidad-muestra/plan.md](../14-T-02-confiabilidad-muestra/plan.md)), T-01 ([../15-T-01-ficha-de-metrica/plan.md](../15-T-01-ficha-de-metrica/plan.md)), T-05 ([../13-T-05-conjunto-estandar-metricas/plan.md](../13-T-05-conjunto-estandar-metricas/plan.md)), T-06 ([../16-T-06-tablas-completas-exportacion/plan.md](../16-T-06-tablas-completas-exportacion/plan.md)), T-04 ([../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md](../../fase-2-contexto-comparabilidad/03-T-04-base-normalizacion/plan.md)), A-03/A-05, F-02, F-14, F-21, etc.
- **Incrementos diferidos:** editor de etiquetas (→ T-05); calibración "Aplicar" (→ T-02); selector de idioma (→ F-21); reubicación S9 (→ X-01). Ver grupo G (diferido) de `tasks.md`.
- **Estimación: L · 12–18 h** (backend config+prefs 5–7 h; migración C-06/C-09/resolve 1–2 h; UI 4–6 h; verificación y docs 2–3 h).
