# Tasks — F-16: Ficha de identidad del jugador

> **ID:** F-16 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 05
> **Depende de:** C-08 · X-01 · F-11 · T-03 · **Habilita:** F-05
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Agregar a `upgrade_db().new_cols` las 6 columnas de `players` (`height_cm` INTEGER, `birth_year` INTEGER, `nationality` TEXT, `profile_notes` TEXT, `profile_updated_at` TEXT, `profile_updated_by` TEXT, todas DEFAULT NULL) y los atributos equivalentes en el modelo `Player` · `backend/database.py` · cubre RF-6, RF-7, RF-8 · Done: `python backend/database.py` corrido 2 veces seguidas no falla y `PRAGMA table_info(players)` lista las 6 columnas

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `position_group(pos: str) -> str | None` (G={G,PG,SG}, F={F,SF,PF}, C={C}) si C-08 no lo definió ya · `backend/identity.py` · cubre RF-3 · Done: `position_group("PG") == "G"`, `position_group("") is None`
- [ ] T-B2 · `_player_competitions(player_id)`: lista `{id, label, games, last_date}` por competencia con partidos jugados (sin DNP), orden `last_date` desc · `backend/identity.py` · cubre RF-11 · Done: para un jugador con partidos en 2 competencias del seed, devuelve 2 entradas ordenadas
- [ ] T-B3 · `player_profile(player_id, ctx)`: compone `player_card` (C-08) + dorsal (partido más reciente) + posición (`resolve_identity`) + grupo + línea de contexto + `fields_null_reasons` · `backend/identity.py` · cubre RF-2, RF-3, RF-4, RF-5, RF-11 · Done: para un jugador del seed sin datos manuales, la respuesta trae `height_cm: null` con `fields_null_reasons.height_cm == "no_registrado"`
- [ ] T-B4 · `_validate_profile_fields(fields)`: rangos de altura (140–240), año (1950…año actual−12), nacionalidad (2–56 caracteres), notas (≤500); `""` → `None` · `backend/identity.py` · cubre RF-6 · Done: `_validate_profile_fields({"height_cm": 300})` devuelve un error para `height_cm`
- [ ] T-B5 · `update_player_profile(player_id, fields, *, user)`: resuelve `merged_into` a la ficha destino, aplica campos válidos, `profile_updated_at`/`_by`, `cache.bump_data_version("perfil_jugador")` · `backend/identity.py` · cubre RF-6, RF-7, RF-8, RF-10 · Done: tras `update_player_profile(id, {"height_cm": 198}, user="nico")`, `player_profile(id, ctx).height_cm == 198` y `profile_updated_by == "nico"`
- [ ] T-B6 · `GET /api/player-profile/<int:player_id>` (`login_required`, Ctx; resuelve competencia por defecto = más reciente del jugador si falta) · `backend/app.py` · cubre RF-1, RF-2, RF-4 · Done: `curl -b cookies.txt "http://localhost:5000/api/player-profile/<id>"` responde 200 con el shape del plan §3
- [ ] T-B7 · `PUT /api/player-profile/<int:player_id>` (`admin_required`) con validación y errores 400/403/404 del plan §3 · `backend/app.py` · cubre RF-6, RF-9 · Done: `curl -X PUT` con `{"height_cm": 300}` responde 400 con el mensaje de altura
- [ ] T-B8 · Verificar que `tables.py`/`export_xlsx.py` no incluyen columnas manuales de `players` en ningún `bulk_scopes` · `backend/tables.py` (o donde T-06 registre tablas) · cubre RF-12 · Done: `grep -n "height_cm\|birth_year\|nationality\|profile_notes"` no aparece fuera de `identity.py`/`app.py`/`database.py`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.playerProfile(id, params)` · `frontend/js/api.js` · cubre RF-1 · Done: llama `GET /api/player-profile/<id>?...`
- [ ] T-C2 · `api.savePlayerProfile(id, body)` (PUT con `Content-Type: application/json`) · `frontend/js/api.js` · cubre RF-6 · Done: llama `PUT /api/player-profile/<id>` con el body serializado

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · Crear `components/player-header.js` (`renderPlayerHeader`): avatar/iniciales, línea 1 (dorsal, nombre, posición, club), línea 2 (`context_line`), chips de plantel con nulos en "—" · `frontend/js/components/player-header.js` · cubre RF-1, RF-3, RF-4, RF-5 · Done: con `height_cm: null`, el chip muestra "—" con `title` "No registrado"
- [ ] T-D2 · Montar `player-header` en `views/jugador.js` antes de las pestañas, con esqueleto mientras carga · `frontend/js/views/jugador.js` · cubre RF-1 · Done: al abrir cualquier pestaña de S4, la cabecera se pinta antes que el contenido de la pestaña
- [ ] T-D3 · Registrar la pestaña `ficha` (`registerTab("jugador", {slug: "ficha", ...})`) con tabla de datos de plantel y pie de auditoría · `frontend/js/views/jugador.js` · cubre RF-2, RF-8 · Done: `#/jugador/<id>/ficha` muestra los 9 campos de RF-2
- [ ] T-D4 · Formulario de edición inline (solo si `profile.editable`) con validación en cliente + `toast` de éxito + re-render · `frontend/js/views/jugador.js` · cubre RF-6, RF-9 · Done: como admin, guardar altura 198 actualiza cabecera y pestaña sin recargar
- [ ] T-D5 · CSS de cabecera, chips, formulario, truncado de la línea de contexto (`text-overflow: ellipsis`) · `frontend/css/style.css` · cubre RF-1, CA-10 · Done: en 375 px sin scroll horizontal
- [ ] T-D6 · Copy nuevo con `t('jugador.ficha.*', '…')`, etiquetas de grupo de posición, altura en metros con coma ("1,98 m") · `player-header.js`, `views/jugador.js` · cubre RF-13 · Done: `grep -n "No registrado"` solo dentro de `t(`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estado "No encontramos este jugador" + enlace a Explorar en 404 · `views/jugador.js` · cubre §6 · Done: `#/jugador/999999/ficha` muestra el mensaje
- [ ] T-E2 · Estado sin conexión en cabecera y pestaña Ficha · `views/jugador.js` · cubre §6 · Done: con Network Offline, ambas muestran "Sin conexión: no se pudo cargar…"
- [ ] T-E3 · Usuario sin permiso: sin botón "Editar"; `PUT` directo (forzado) muestra el mensaje 403 · `views/jugador.js` · cubre RF-9 · Done: con un usuario no admin logueado, la pestaña Ficha no tiene botón "Editar"
- [ ] T-E4 · `sw.js`: agregar `player-header.js` a `STATIC` o confiar en runtime caching de X-01; subir `CACHE` si aplica · `frontend/sw.js` · cubre §9 · Done: el archivo se sirve offline en DevTools

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `python backend/database.py` corrido 2 veces seguidas sin error (idempotencia de `upgrade_db()`)
- [ ] T-F3 · `GET`/`PUT /api/player-profile/<id>` probados con curl contra el shape del plan §3
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer las 10 pestañas de S4 de 2 jugadores del seed
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress
- [ ] T-F6 · CA-1 (CA del cliente): abrir cualquier pestaña de S4 (también por URL directa) y comprobar que la cabecera se renderiza antes que cualquier card de métricas (captura o DOM order)
- [ ] T-F7 · CA-2: jugador del seed con 16 partidos jugados y 1 DNP; sin filtros la línea dice "… 16 partidos"; con `last=5` (T-03) dice "5 partidos"
- [ ] T-F8 · CA-3: jugador sin datos manuales; pestaña Ficha muestra "—" con tooltip "No registrado" en altura/año/nacionalidad; `curl` confirma `fields_null_reasons.height_cm == "no_registrado"`
- [ ] T-F9 · CA-4: como admin, cargar altura 198/año 1999/nacionalidad "Uruguay"; verificar "1,98 m", "1999", "Uruguay" y "Editado el … por …"; reimportar/reprocesar un partido del jugador y confirmar que los datos persisten
- [ ] T-F10 · CA-5: enviar altura 300 → 400 con el mensaje exacto y sin cambios; borrar nacionalidad (campo vacío) → vuelve a "—" con `no_registrado`
- [ ] T-F11 · CA-6: con `ADMIN_USERS` definida y un usuario fuera de la lista, verificar ausencia de "Editar" y `PUT` directo → 403 `requiere_admin`
- [ ] T-F12 · CA-7: jugador con posición FIBA variable entre partidos (G, PG, G en el seed o inyectado en la base de verificación); verificar posición "G" (más frecuente) y grupo "G"
- [ ] T-F13 · CA-8: fusionar dos fichas con C-08, cargar datos manuales en la destino, abrir la ficha origen por su id; verificar que se ven los datos de la destino
- [ ] T-F14 · CA-9: `GET /api/player-profile/999999` → 404 con el shape exacto
- [ ] T-F15 · CA-10: viewport 375 px; cabecera sin scroll horizontal, línea de contexto truncada con puntos suspensivos sin tapar el nombre

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-D1, T-D2, T-F6 |
| CA-2 | T-B3, T-D3, T-F7 |
| CA-3 | T-B3, T-D1, T-D3, T-F8 |
| CA-4 | T-B4, T-B5, T-D4, T-F9 |
| CA-5 | T-B4, T-D4, T-F10 |
| CA-6 | T-B7, T-E3, T-F11 |
| CA-7 | T-B1, T-B3, T-F12 |
| CA-8 | T-B3, T-B5, T-F13 |
| CA-9 | T-B6, T-E1, T-F14 |
| CA-10 | T-D5, T-F15 |

## Dependencias externas
- C-08 integrado: tabla `players`, `player_game_stats.player_id`, `identity.player_card`/`resolve_identity`/`norm_name`, endpoint de fusión.
- F-11 integrado: `player_game_stats.first_name`/`family_name`/`photo_url`, `repository`, `cache.bump_data_version`, `auth.admin_required`/`is_admin`, `/api/me.is_admin`.
- T-03 integrado: `context.parse_context`, `context.filter_games`, `context_echo` (para la línea de contexto y `games`).
- X-01 integrado: `core/router.js`, `registerTab`, `views/jugador.js` con las pestañas de S4.
- Dataset de verificación: al menos un jugador del seed con partidos en 2 competencias (CA-13/CA-2) y, si no existe en
  los 13 partidos, inyección controlada documentada en progress (posición variable entre partidos para CA-7).
- Variable `ADMIN_USERS` definida en el entorno local para CA-6 (con y sin el usuario de prueba en la lista).
