# Tasks — F-13: Configuración

> **ID:** F-13 · **Prioridad:** P1 · **Fase y orden:** 1·12
> **Depende de:** C-06, C-11, F-11 (y C-09 para migrar sus constantes) · **Habilita:** T-02, T-04, T-06, F-06, F-17, A-03, A-05, F-02, F-14, F-12, F-21
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelos `AppConfig` (`app_config`) y `UserPref` (`user_prefs`, PK `(owner, scope, key)`) · `backend/database.py` · cubre RF-2, RF-14, RF-16 · Done: `python backend/database.py` crea ambas tablas; `sqlite3 backend/basketball.db ".schema app_config"` y `".schema user_prefs"` muestran las columnas del plan §3.1; correrlo 2 veces no da error.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `ConfigKey`, `SECTIONS` y `CONFIG_SPEC` con **todas** las claves de Arq. §3.2 (nombre, tipo, default, rango, unidad, etiqueta, ayuda, sección, consumidor, `status`); activas solo `clutch.*`, `standings.*`, `ui.default_competition_id` · `backend/config.py` · cubre RF-1, RF-10 · Done: en `python -c` con app context, `len(config.CONFIG_SPEC) ≥ 70`, cada default está dentro de su rango y coincide con Arq. §3.2 (script ad hoc que recorre la tabla y compara).
- [ ] T-B2 · `get`, `get_many`, `_load_overrides` con `cache.memo("cfg", …)` versionado · `backend/config.py` · cubre RF-2, RF-7 · Done: sin filas en `app_config`, `config.get("clutch.margin") == 10`; insertando a mano una fila `("clutch.margin", "7")` y llamando `cache.bump_config_version()`, `get` devuelve 7 en la siguiente petición de `app.test_client()`.
- [ ] T-B3 · `validate` por tipo + `COHERENCE_RULES` + `set_values` atómico (borra la fila si el valor es el default; `bump_config_version` si hubo cambios) · `backend/config.py` · cubre RF-4, RF-2, RF-16 · Done: `set_values({"clutch.margin": 50})` lanza `ConfigError` con `details`; `set_values({"clutch.margin": 5, "standings.win_points": 9})` no escribe nada; `set_values({"clutch.margin": 10})` no deja fila.
- [ ] T-B4 · `reset(keys)` y `reset_section(slug)` · `backend/config.py` · cubre RF-5 · Done: tras `reset(["clutch.margin"])` la fila desaparece y `config_version` sube solo si borró algo.
- [ ] T-B5 · `spec_json()` (con `modified`, `updated_at`, `updated_by`, `dynamic_choices` resuelto contra `competitions.list_competitions()`) y `payload(is_admin)` · `backend/config.py` · cubre RF-3, RF-9, RF-16 · Done: `payload()["values"]` tiene exactamente las 6 claves activas; `spec` incluye reservadas con `status: "reservada"`.
- [ ] T-B6 [P] · `prefs.py`: `PREF_SCOPES`, `current_owner`, `get_prefs`, `set_pref` (upsert), `delete_pref`, límite 8 KB · `backend/prefs.py` · cubre RF-14 · Done: con `test_client` y dos sesiones distintas, cada una ve solo sus preferencias; scope inválido lanza error de validación.
- [ ] T-B7 · Rutas `GET /api/settings` (login), `PUT /api/settings` y `POST /api/settings/reset` (`admin_required`), mapeo de `ConfigError` a 400 con `code`/`details` (§7.8) · `backend/app.py` · cubre RF-3, RF-4, RF-5, RF-6 · Done: curl de T-F3 devuelve los shapes del plan §3.2–3.4.
- [ ] T-B8 · Rutas `GET/PUT/DELETE /api/prefs` · `backend/app.py` · cubre RF-14 · Done: curl de T-F3 (prefs) devuelve `{scope, values}` / `{scope, key, value}` / `{…, deleted}`.
- [ ] T-B9 · `clutch.py`: eliminar `CLUTCH_SECS`; `_is_clutch`/`_entry_margin` con `window_secs`; `team_clutch(margin=None, window_secs=None)` leyendo `config.get`; eco `window_secs` · `backend/clutch.py` · cubre RF-7, RF-8 · Done: `GET /api/clutch/<equipo>` sin query devuelve `margin: 10`, `window_secs: 300` y los mismos `games_qualified` que antes del cambio (anotar antes/después en `progress.md`).
- [ ] T-B10 · `clutch_team`: quitar `margin = 10`; `margin` inválido/ausente → `None` · `backend/app.py` · cubre RF-8 · Done: `?margin=5` sigue funcionando como override; sin query rige la config.
- [ ] T-B11 · Tabla general: `table_points = win_points·PG + loss_points·PP`, orden con `standings.tiebreak`, eco `standings_rules` (en la función/endpoint que haya dejado C-09) · `backend/app.py` (o módulo de C-09) · cubre RF-7, RF-8 · Done: con defaults, `table_points` idénticos a `dev` para los 13 partidos del seed.
- [ ] T-B12 · `repository.resolve_competition`: paso `ui.default_competition_id` vía `config.get` (ignorar id inexistente) · `backend/repository.py` · cubre RF-9 · Done: con la clave en un id válido y una entidad sin competencia propia resoluble, el eco `context.competition.id` es ese id.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `settings`, `saveSettings`, `resetSettings`, `prefs`, `savePref`, `deletePref`; `apiFetch` adjunta `code`/`details` al `Error` · `frontend/js/api.js` · cubre RF-3, RF-4, RF-5, RF-14 · Done: desde la consola del navegador, `api.settings()` resuelve el payload y `api.saveSettings({"clutch.margin": 99}).catch(e => e.details)` devuelve el mapa de errores.

### Grupo D — Frontend: UI
- [ ] T-D1 [P] · `core/prefs.js` (`loadPrefs`, `getPref`, `setPref`; copia en `localStorage` con try/catch) · `frontend/js/core/prefs.js` · cubre RF-15 · Done: en consola, `await setPref("panel.collapsed","x",true)`; recargar; `await loadPrefs("panel.collapsed"); getPref("panel.collapsed","x",false) === true`; con `localStorage` bloqueado (modo privado) no lanza.
- [ ] T-D2 · `components/settings-form.js`: módulos con `filter-pill`, controles por tipo, rango/unidad/default, marca "Modificado", autor/fecha, errores por campo, solo lectura, vacío por módulo · `frontend/js/components/settings-form.js` · cubre RF-11, RF-12, RF-13, RF-16 · Done: con el payload real se ven 4 módulos; Momentum muestra el vacío que nombra a F-02.
- [ ] T-D3 · Engranaje en `<header>`, sección `config` fuera de la barra inferior, `renderConfig()` (guardar/restablecer, toast, invalidar cachés de vista) · `frontend/js/app.js` · cubre RF-11, RF-12 · Done: click en ⚙ abre la vista; la barra inferior móvil sigue con 6 botones.
- [ ] T-D4 · Leyenda de Cierres sin `CLUTCH_MARGIN_DEFAULT` (usa `margin`/`window_secs` de la respuesta) · `frontend/js/app.js:renderTeamClutch` · cubre RF-8 · Done: con `clutch.margin = 5` la leyenda dice "dif ≤ 5".
- [ ] T-D5 · Leyenda de la tabla general con `standings_rules` · `frontend/js/app.js:_standingsCardHTML` · cubre RF-8 · Done: con `win_points = 3` la leyenda dice "3 pts por ganado".
- [ ] T-D6 · Estilos `settings-form` (fila, modificado, acciones sticky sobre la barra inferior, engranaje) · `frontend/css/style.css` · cubre RF-11 · Done: a 360 px una columna, sin scroll horizontal.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados loading/error/sin conexión/403 con el copy del spec §6 vía `t()` · `frontend/js/app.js`, `settings-form.js` · cubre RF-11, RF-13 · Done: con el backend apagado, la vista muestra "Sin conexión: la configuración no está disponible."; con usuario no admin, aviso de solo lectura.
- [ ] T-E2 · `sw.js`: agregar `/js/core/prefs.js` y `/js/components/settings-form.js` a `STATIC`; subir `CACHE` · `frontend/sw.js` · Done: en DevTools → Application → Cache Storage aparece la versión nueva con ambos archivos.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · `python backend/database.py` corre 2 veces seguidas sin error (create_all idempotente; tablas `app_config`, `user_prefs`).
- [ ] T-F3 · Endpoints con curl (sesión con `-c/-b cookies.txt` tras `POST /api/login`):
  `curl -b c.txt http://localhost:5000/api/settings` · `curl -b c.txt -X PUT -H "Content-Type: application/json" -d '{"values":{"clutch.margin":5}}' http://localhost:5000/api/settings` · `curl -b c.txt -X POST -H "Content-Type: application/json" -d '{"keys":["clutch.margin"]}' http://localhost:5000/api/settings/reset` · `curl -b c.txt -X PUT -H "Content-Type: application/json" -d '{"scope":"panel.collapsed","key":"x","value":true}' http://localhost:5000/api/prefs` · `curl -b c.txt "http://localhost:5000/api/prefs?scope=panel.collapsed"` · `curl -b c.txt -X DELETE -H "Content-Type: application/json" -d '{"scope":"panel.collapsed","key":"x"}' http://localhost:5000/api/prefs`; shapes contra plan §3.
- [ ] T-F4 · Consola del navegador sin errores JS al abrir Configuración, guardar, restablecer y volver a Equipo/Liga.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`:
  - [ ] T-F5.1 · CA-1 (CA del cliente): anotar `games_qualified` de `GET /api/clutch/<equipo>` (equipo con cierres en el seed); `PUT` `clutch.margin=5`; repetir el GET sin reiniciar → `margin: 5`, `games_qualified` ≤ al anterior; abrir Equipo → leyenda "dif ≤ 5". `PUT` `standings.win_points=3` → `GET /api/league` con `table_points = 3·PG + PP`; Liga reordenada.
  - [ ] T-F5.2 · CA-2: base limpia (`DELETE FROM app_config`) → `GET /api/settings`; comparar `values` con los 6 defaults y contar reservadas en `spec`.
  - [ ] T-F5.3 · CA-3: `PUT {"clutch.margin":50}` → 400 `parametro_invalido` con `details["clutch.margin"]`; GET confirma el valor anterior.
  - [ ] T-F5.4 · CA-4: `PUT {"clutch.margin":5,"standings.win_points":9}` → 400; `SELECT value FROM app_meta WHERE key='config_version'` igual antes y después; ningún valor cambió.
  - [ ] T-F5.5 · CA-5: arrancar con `AUTH_USERS` con `nico` y `ana` y `ADMIN_USERS=nico`; login como `ana` → `PUT` y `reset` dan 403 `requiere_admin`; `GET` da `is_admin: false`; en navegador, pantalla en solo lectura.
  - [ ] T-F5.6 · CA-6: con `clutch.margin=5` guardado, `reset` → fila borrada (`SELECT * FROM app_config`), GET vuelve a 10 y `games_qualified` al valor original.
  - [ ] T-F5.7 · CA-7: `PUT {"momentum.window_secs":200}` → 400 `clave_no_disponible`; navegador: módulo Momentum con el vacío que nombra a F-02.
  - [ ] T-F5.8 · CA-8: `gunicorn --workers 2 app:app` (o dos `app.test_client()` de procesos distintos en un script ad hoc); guardar en uno y hacer 4 GET `/api/clutch/<equipo>` seguidos → todos con el valor nuevo.
  - [ ] T-F5.9 · CA-9: `grep -rn "CLUTCH_MARGIN_DEFAULT\|CLUTCH_SECS\|2 \* wins\|margin = 10\|margin=10" backend frontend/js` → sin resultados fuera de `config.py`.
  - [ ] T-F5.10 · CA-10: prefs con dos usuarios (`nico`, `ana`): cada uno ve solo lo suyo; `scope=foo` → 400.
  - [ ] T-F5.11 · CA-11: fijar `ui.default_competition_id` a un id válido (ver `GET /api/competitions`); consultar un endpoint con contexto sin `competition` para una entidad sin competencia propia resoluble (o con `competition` omitido en `GET /api/league`) y verificar el eco; `PUT` con id 9999 → 400.
  - [ ] T-F5.12 · CA-12: DevTools modo dispositivo 360 × 740: vista en una columna, botones visibles sobre la barra inferior, barra inferior sin botón nuevo.
  - [ ] T-F5.13 · CA-13: con un valor guardado, reabrir → "Modificado", "Por defecto: …", "Modificado por nico el …".
  - [ ] T-F5.14 · CA-14: `ui.default_competition_id = null` → se ve "Automática (la más reciente)".

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (diferido → T-05) · Editor de `ui.metric_labels` con la lista de métricas del catálogo y activación de la clave.
- [ ] T-G2 (diferido → T-02) · Botón "Aplicar" de la calibración de K (`POST /api/settings/calibrate` → `PUT /api/settings`) y activación de `sample.*`/`regression.*`.
- [ ] T-G3 (diferido → X-01) · Mover `renderConfig` a `views/configuracion.js`, registrar S9 con pestañas `umbrales|contexto|momentum|preferencias`.
- [ ] T-G4 (diferido → F-21) · Activar `ui.default_language` y la preferencia `ui.language`.
- [ ] T-G5 (opcional) · `competitions.merge_competitions` reescribe `ui.default_competition_id` al id destino.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B2, T-B3, T-B7, T-B9, T-B10, T-B11, T-D3, T-D4, T-D5, T-F5.1 |
| CA-2 | T-B1, T-B5, T-B7, T-F5.2 |
| CA-3 | T-B3, T-B7, T-C1, T-D2, T-F5.3 |
| CA-4 | T-B3, T-F5.4 |
| CA-5 | T-B7, T-D2, T-E1, T-F5.5 |
| CA-6 | T-B4, T-B7, T-F5.6 |
| CA-7 | T-B1, T-B3, T-D2, T-F5.7 |
| CA-8 | T-B2, T-F5.8 |
| CA-9 | T-B9, T-B10, T-B11, T-D4, T-F5.9 |
| CA-10 | T-A1, T-B6, T-B8, T-D1, T-F5.10 |
| CA-11 | T-B5, T-B12, T-F5.11 |
| CA-12 | T-D3, T-D6, T-F5.12 |
| CA-13 | T-B3, T-B5, T-D2, T-F5.13 |
| CA-14 | T-D2, T-F5.14 |

## Dependencias externas
- F-11 integrado: `auth.admin_required`/`is_admin`, `cache.py`, tabla `app_meta`, `repository.resolve_competition`, `competitions.list_competitions`.
- C-06 integrado (clutch con `OVERTIME` corregido) y C-09 integrado (tabla general); C-11 integrado (`core/format.js`, `core/i18n.js`).
- Dataset de verificación: los 13 partidos del seed importados (`SEED_ENABLED=true` + login, o importación manual) — la base local está vacía (Arq. D-22).
- Para CA-5: variables de entorno locales `AUTH_USERS` (dos usuarios con hash) y `ADMIN_USERS=nico`; `SECRET_KEY`.
- Para CA-8: `gunicorn` disponible localmente (o script con dos procesos).
- En Render: documentar `ADMIN_USERS` (la agrega F-11) en `docs/deployment.md`.
