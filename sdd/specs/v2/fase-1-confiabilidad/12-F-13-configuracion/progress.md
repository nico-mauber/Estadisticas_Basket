# Progress — F-13: Configuración

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`.

## Estado de tareas
### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Modelos `AppConfig` y `UserPref`

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `ConfigKey`, `SECTIONS`, `CONFIG_SPEC` completo
- [ ] T-B2 · `get`, `get_many`, overrides cacheados por versión
- [ ] T-B3 · `validate` + coherencia + `set_values` atómico
- [ ] T-B4 · `reset` / `reset_section`
- [ ] T-B5 · `spec_json` / `payload`
- [ ] T-B6 · `prefs.py`
- [ ] T-B7 · Rutas `/api/settings*`
- [ ] T-B8 · Rutas `/api/prefs`
- [ ] T-B9 · `clutch.py` sin literales
- [ ] T-B10 · `clutch_team` sin `margin = 10`
- [ ] T-B11 · Tabla general con `standings.*`
- [ ] T-B12 · `resolve_competition` con `ui.default_competition_id`

### Grupo C — Frontend: api.js
- [ ] T-C1 · Métodos de settings y prefs

### Grupo D — Frontend: UI
- [ ] T-D1 · `core/prefs.js`
- [ ] T-D2 · `components/settings-form.js`
- [ ] T-D3 · Engranaje + vista `config`
- [ ] T-D4 · Leyenda de Cierres sin literal
- [ ] T-D5 · Leyenda de tabla general
- [ ] T-D6 · Estilos

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados y copy
- [ ] T-E2 · `sw.js`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `create_all` idempotente
- [ ] T-F3 · Endpoints con curl
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA-1 … CA-14

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (→ T-05) · Editor de etiquetas
- [ ] T-G2 (→ T-02) · Aplicar calibración de K
- [ ] T-G3 (→ X-01) · S9
- [ ] T-G4 (→ F-21) · Idioma
- [ ] T-G5 (opcional) · Reescritura de competencia por defecto al fusionar

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (CA del cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` / `create_all` idempotente: ⬜
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET/PUT /api/settings`, `POST /api/settings/reset`, `GET/PUT/DELETE /api/prefs`; default de `margin` y `window_secs` en `/api/clutch`; `standings_rules` en la tabla general.
- `docs/database.md` — tablas `app_config` y `user_prefs`.
- `docs/frontend.md` — vista Configuración (engranaje), `core/prefs.js`, `components/settings-form.js`, copy nuevo.
- `docs/architecture.md` — módulos `config.py` y `prefs.py`; regla "ningún umbral fijo en el código".
- `docs/deployment.md` — `ADMIN_USERS` para editar configuración.

## Deuda / TODO
