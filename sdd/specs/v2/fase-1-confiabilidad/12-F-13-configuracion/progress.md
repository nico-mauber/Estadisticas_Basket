# Progress — F-13: Configuración

> **Estado:** ✅ Implementado
> Reglas: `sdd/04-implement.md`.

## Estado de tareas
### Grupo A — Backend: esquema y modelos
- [x] T-A1 · Modelos `AppConfig` y `UserPref`

### Grupo B — Backend: lógica y rutas
- [x] T-B1 · `ConfigKey`, `SECTIONS`, `CONFIG_SPEC` completo
- [x] T-B2 · `get`, `get_many`, overrides cacheados por versión (flask.g)
- [x] T-B3 · `validate` + coherencia + `set_values` atómico
- [x] T-B4 · `reset` / `reset_section`
- [x] T-B5 · `spec_json` / `payload`
- [x] T-B6 · `prefs.py`
- [x] T-B7 · Rutas `/api/settings*`
- [x] T-B8 · Rutas `/api/prefs`
- [x] T-B9 · `clutch.py` sin literales
- [x] T-B10 · `clutch_team` sin `margin = 10`
- [x] T-B11 · Tabla general con `standings.*`
- [x] T-B12 · `resolve_competition` con `ui.default_competition_id`

### Grupo C — Frontend: api.js
- [x] T-C1 · Métodos de settings y prefs

### Grupo D — Frontend: UI
- [x] T-D1 · `core/prefs.js`
- [x] T-D2 · `components/settings-form.js`
- [x] T-D3 · Engranaje + vista `config`
- [x] T-D4 · Leyenda de Cierres sin literal (ya usaba `margin`/`window_secs` de la respuesta)
- [x] T-D5 · Leyenda de tabla general (puntos/desempate ya vienen del backend)
- [x] T-D6 · Estilos

### Grupo E — Errores, estados vacíos, offline/SW
- [x] T-E1 · Estados y copy
- [x] T-E2 · `sw.js` (CACHE v19)

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `create_all` idempotente
- [x] T-F3 · Endpoints con `app.test_client()`
- [x] T-F4 · Consola sin errores JS
- [x] T-F5 · CA-1 … CA-14

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (→ T-05) · Editor de etiquetas
- [ ] T-G2 (→ T-02) · Aplicar calibración de K
- [ ] T-G3 (→ X-01) · S9
- [ ] T-G4 (→ F-21) · Idioma
- [ ] T-G5 (opcional) · Reescritura de competencia por defecto al fusionar

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ✅ | Engranaje abre config, admin edita, usuario ve solo lectura |
| CA-2 | ✅ | `CONFIG_SPEC` 81 claves, 6 activas |
| CA-3 | ✅ | Validación tipo/rango/coherencia en `set_values` |
| CA-4 | ✅ | `admin_required` en PUT/reset |
| CA-5 | ✅ | Reset por clave y por sección |
| CA-6 | ✅ | Overrides en `app_config`, solo diffs del default |
| CA-7 | ✅ | `clutch.py` usa `config.get()` |
| CA-8 | ✅ | `standings_row`/`standings_sort_key` configurables |
| CA-9 | ✅ | `ui.default_competition_id` en `repository._configured_default` |
| CA-10 | ✅ | Secciones reservadas con mensaje de feature consumidora |
| CA-11 | ✅ | `prefs.py` CRUD + scopes restringidos |
| CA-12 | ✅ | `core/prefs.js` cache memoria/localStorage |
| CA-13 | ✅ | Badge "Modificado" + metadata `updated_by`/`updated_at` |
| CA-14 | ✅ | SW cachea módulos nuevos (v19) |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` / `create_all` idempotente: ✅
- Endpoints probados manualmente: ✅ (`app.test_client()`)
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan
- Implementado sin `cache.py` ni tabla `app_meta` (no existen en el repo): overrides cacheados por request vía `flask.g`, invalidados en cada request nuevo.

## Docs a actualizar
- [x] `docs/api.md`
- [x] `docs/database.md`
- [x] `docs/frontend.md`
- [x] `docs/architecture.md`
- [x] `docs/deployment.md`

## Deuda / TODO
Ninguna.
