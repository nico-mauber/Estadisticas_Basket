# Tasks — T-02: Confiabilidad de muestra

> **ID:** T-02 · **Prioridad:** P0 · **Fase y orden:** 1·14
> **Depende de:** F-13, T-05 (y F-11, C-02, C-08, C-11 vía ellos) · **Habilita:** T-01, T-06, C-03, F-06, F-19, T-03, F-09, F-10, A-06, A-08, A-11, F-15
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** Especificación v2 §3 · T-02 · Arquitectura §3.7 · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: configuración y esquema
- [ ] T-A1 · Verificar que `CONFIG_SPEC` tiene todas las claves `sample.*`, `regression.*`, `sample.ppp_sd`, `sample.band_z`, `sample.relative_enabled` con nombre, default y rango de arquitectura §3.2; agregar las faltantes · `backend/config.py` · cubre RF-2, RF-4, RF-7, RF-9 · Done: `GET /api/settings` lista las 30+ claves con defaults 15/40/1.5, 30/80, 40/120, 8/25, 15/40, 10/30, 2/3, 60/200, 3/10, K 25/50/20/25/25/25, σ 1.15, z 1.96
- (Sin cambios de esquema: no hay tareas de modelos.)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `ENTITY_SAMPLE`, `UNIT`, `REGRESSED_TYPES`, `effective_min`, `sample_level`, `is_ranked` · `backend/sample.py` (NUEVO) · cubre RF-1, RF-2, RF-3, RF-4, RF-6, RF-10 · Done: en `python -c` con app context, `sample_level("lineup", n=12, unit="posesiones")["level"] == "baja"`, 20 → `media`, 45 → `alta`; con `team_poss=2000` → `min == 30` y `min_source == "relativo"`
- [ ] T-B2 · `league_prior` y `team_offensive_possessions` con caché `cache.memo` · `backend/sample.py` · cubre RF-4, RF-7 · Done: prior de la competencia del seed ≈ Σpts/Σpos calculado a mano con una consulta SQL sobre `team_game_stats` (diferencia < 0,0001)
- [ ] T-B3 · `adjusted`, `band` (kwarg `poss_def`), `adjust_values` · `backend/sample.py` · cubre RF-7, RF-8, RF-9 · Done: para `value=1.2, poss=20, prior=1.02, K=25` → `adj.value == 1.1` y `band == round(1.96*1.15/sqrt(45), 4)`; valor `None` → `adj None`
- [ ] T-B4 · `sample_for` (unidad por entidad; ON/OFF = menor de los dos estados; minutos/partidos/posesiones siempre informados) · `backend/sample.py` · cubre RF-1, RF-5 · Done: bundle ON con 300 pos y OFF con 0 → `n == 0`, `level == "baja"`
- [ ] T-B5 · Helper `_lineup_bundles(games, team_code, size)` + `all_lineups(team_code, comp_id, ctx, *, size=5)` con caché `lineups:<team>` · `backend/lineups.py` · cubre RF-13 · Done: para un equipo del seed, la suma de `seconds` de todos los quintetos de size 5 = segundos jugados de los partidos usados (±1 s por período) y cada bundle tiene id `TEAM:pid-pid-…` ascendente
- [ ] T-B6 · `calibrate_k` (partidos alternos, Pearson puro, advertencias) · `backend/sample.py` · cubre RF-12 · Done: devuelve el shape del plan §3; con < 10 unidades `k_suggested is None` y `"muestra_insuficiente" in warnings`
- [ ] T-B7 · Enganche en el armado del payload estándar: `sample_for` + `adjust_values` → `standard_payload(sample=…)` para `team`, `player`, `lineup`, `onoff`, `clutch` · `backend/metrics_catalog.py` / función de armado de T-05 · cubre RF-1, RF-7, RF-8 · Done: `curl "http://localhost:5000/api/metrics/lineup?id=<TEAM:ids>&competition=<id>"` trae `sample` §7.2 y `metrics.oer.adj`
- [ ] T-B8 · Ruta `POST /api/settings/calibrate` fina con `login_required` + `admin_required`, validación y errores §7.8 · `backend/app.py` · cubre RF-12 · Done: 400 con `entity=pair`, 400 sin `competition`, 200 con `lineup`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.calibrate(entity, competition)` · `frontend/js/api.js` · cubre RF-12 · Done: llamada desde la consola del navegador devuelve el JSON de calibración

### Grupo D — Frontend: UI
- [ ] T-D1 [P] · `sampleBadge(sample, {compact})` con `t()` y formato es-UY · `frontend/js/components/sample-badge.js` (NUEVO) · cubre RF-1, RF-3 · Done: renderiza "Muestra MEDIA · 23,5 pos · 4 PJ · 31,5'" y el tooltip de mínimo relativo
- [ ] T-D2 [P] · Estilos `.sample-badge`, `.sample-baja/media/alta`, `.metric-low-sample`, `.adj-value`, `.adj-band` · `frontend/css/style.css` · cubre RF-1, RF-11 · Done: badge legible en 360 px y en desktop
- [ ] T-D3 · `standard-panel`: badge en cabecera, gris + advertencia si `!ranked`, crudo + ajustado ± banda en OER/DER/Net · `frontend/js/components/standard-panel.js` · cubre RF-8, RF-11 · Done: combinación `baja` se ve en gris con "Muestra baja: no entra en rankings ni recomendaciones"
- [ ] T-D4 · Panel Combinación: leer `/api/metrics/lineup`; eliminar `smallSample` (`< 10`) y el copy "Muestra chica" · `frontend/js/app.js` `renderTeamLineup` · cubre RF-14 · Done: `grep -n "possessions < 10\|Muestra chica" frontend/js/app.js` sin resultados
- [ ] T-D5 · Panel ON/OFF: badge del menor estado + ajustados por estado; "sin muestra" vía `t()` · `frontend/js/app.js` `renderTeamOnOff` · cubre RF-5, RF-14 · Done: titular de 40 min por partido muestra "OFF: sin muestra" y badge BAJA
- [ ] T-D6 · Panel Cierres: badge `clutch` + ajustados en el agregado · `frontend/js/app.js` `renderTeamClutch` · cubre RF-14 · Done: badge con posesiones del tramo visible
- [ ] T-D7 · Configuración → Umbrales: botón "Calibrar con los datos cargados" (solo admin), resultado, advertencias y "Aplicar" · `frontend/js/views/configuracion.js` (o archivo de la vista `config` de F-13) · cubre RF-12 · Done: aplicar cambia `regression.lineup.k` en `GET /api/settings`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Mensajes 400/403 de calibración en la UI; estado "sin unidades suficientes" · `frontend/js/views/configuracion.js` · cubre RF-12 · Done: usuario no admin ve "Necesitás permisos de administrador"
- [ ] T-E2 · `sample-badge.js` a `STATIC` y `CACHE` +1 · `frontend/sw.js` · cubre RF-1 · Done: tras recargar, DevTools → Application muestra la nueva versión de caché con el módulo

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · `upgrade_db()` idempotente: no aplica (sin cambios de esquema); igualmente `python backend/database.py` corre 2 veces sin error
- [ ] T-F3 · Endpoints probados: `curl -b cookies.txt "http://localhost:5000/api/metrics/lineup?id=<TEAM:ids>&competition=<id>"`, `…/api/metrics/onoff?id=<TEAM:pid>&competition=<id>`, `…/api/metrics/clutch?id=<TEAM>&competition=<id>`, `curl -b cookies.txt -X POST -H "Content-Type: application/json" -d '{"entity":"lineup","competition":<id>}' http://localhost:5000/api/settings/calibrate`; shapes verificados contra plan §3/§8
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo (Combinación, ON/OFF, Cierres) y Configuración
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (cliente, fase 1): script ad hoc con `app.test_client()`/app context: `all_lineups(<equipo con más partidos>, comp, ctx)` → `compute_standard` + `sample_for` + `adjust_values`; contar `media`/`alta` (≥ 5) y verificar que el primero por `net_rating.adj.value` entre `is_ranked` tiene `n ≥ min`; registrar salida en `progress.md` (si el seed no alcanza, repetir con la segunda competencia de R-05 y documentar)
- [ ] T-F7 · CA-2: en Configuración poner `sample.relative_enabled = false`; elegir combinaciones con ~12, ~20 y ~45 posesiones (buscarlas con el script de T-F6) y pedir `/api/metrics/lineup` de cada una: niveles `baja/media/alta`, `min 15`, `high 40`, `min_source absoluto`
- [ ] T-F8 · CA-3: con relativo habilitado, verificar `min = max(15, 0,015 × team_poss)` usando `team_offensive_possessions` impreso por script; un equipo chico devuelve `absoluto`
- [ ] T-F9 · CA-4: `PUT /api/settings {"values": {"sample.lineup.min": 25}}` y repetir el curl de la combinación: `min == 25` sin reiniciar; `grep` de T-D4 sin resultados; restaurar con `POST /api/settings/reset`
- [ ] T-F10 · CA-5: con los `adj.k`/`adj.prior` y `sample.possessions` de la respuesta, recalcular a mano `(pos·v + K·p)/(pos+K)` y `oer_aj − der_aj` (coinciden a 4 decimales)
- [ ] T-F11 · CA-6: dos combinaciones (~15 y ~60 pos): banda de la primera mayor; ambas = `1,96·1,15/√(pos+25)`
- [ ] T-F12 · CA-7: ON/OFF de un jugador que jugó todo (buscarlo con `onoff_stats`: `off.possessions == 0`): badge `baja`, `n = 0`, ajustados OFF `null` con razón `sin_intentos`; UI sin `NaN`/`Infinity`
- [ ] T-F13 · CA-8: navegador, combinación `baja`: valores en gris, advertencia visible, crudo + ajustado + banda visibles, nada oculto
- [ ] T-F14 · CA-9: como admin, calibrar `lineup`; `GET /api/settings` conserva el K anterior; presionar "Aplicar" y verificar el nuevo K; registrar `r`, `units`, `k_suggested` en `progress.md`
- [ ] T-F15 · CA-10: arrancar con `ADMIN_USERS=otro` y loguearse con un usuario fuera de la lista: calibrar → 403 `requiere_admin`
- [ ] T-F16 · CA-11: navegador, Equipo → Cierres de un equipo con cierres calificados: badge con posesiones del tramo, OER/DER/Net ajustados con `k = 20`
- [ ] T-F17 · CA-12: `/api/metrics/team?id=<equipo con 2 PJ>&competition=<id>` → `sample.level = baja`, unidad `partidos`; `/api/metrics/player?id=<pid con < 60 min>` → `baja`, unidad `minutos`
- [ ] T-F18 · CA-13: pedir una entidad con `competition=<id>` donde no jugó: `n = 0`, `baja`, métricas `null` con `sin_datos`

### Grupo G — (diferido)
- [ ] T-G1 · (diferido → F-06) Tabla `team_lineups` y tarjetas de quintetos líderes consumen `is_ranked` y `adj`; re-verificar el CA-1 en pantalla
- [ ] T-G2 · (diferido → F-06) Cierre por quinteto con `clutch_lineup` (partidos contados, sin `media`)
- [ ] T-G3 · (diferido → A-01) Calibración por posesiones alternas y σ empírico en `band`
- [ ] T-G4 · (diferido → A-08, F-07, T-03, C-03, A-05) Cada dueño llama a `sample_for` con su entidad y la agrega a `ENTITY_SAMPLE` si hace falta

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B5, T-B1, T-B3, T-B7, T-F6 (UI: T-G1) |
| CA-2 | T-A1, T-B1, T-B7, T-F7 |
| CA-3 | T-B1, T-B2, T-F8 |
| CA-4 | T-A1, T-B1, T-D4, T-F9 |
| CA-5 | T-B2, T-B3, T-B7, T-F10 |
| CA-6 | T-B3, T-F11 |
| CA-7 | T-B4, T-B3, T-D5, T-F12 |
| CA-8 | T-D1, T-D2, T-D3, T-D4, T-F13 |
| CA-9 | T-B6, T-B8, T-C1, T-D7, T-F14 |
| CA-10 | T-B8, T-E1, T-F15 |
| CA-11 | T-B7, T-D6, T-F16 |
| CA-12 | T-B4, T-B7, T-F17 |
| CA-13 | T-B4, T-B7, T-F18 |

## Dependencias externas
- F-13 cerrada (`config.py`, `app_config`, `PUT /api/settings`, vista `config`), T-05 cerrada (`StatBundle`, `compute_standard`,
  `standard_payload`, loaders, `standard-panel.js`), F-11 (`repository`, `cache`, `admin_required`, `PERIOD_LEN` con `OVERTIME`),
  C-02 (`context.py`), C-08 (`player_id`).
- Dataset de verificación: los 13 partidos del seed importados y **reprocesados con la ingesta v2** (F-11); segunda competencia
  real o de copia (R-05) para CA-1 y CA-9 si el seed no alcanza.
- Variables de entorno para CA-10: `AUTH_USERS` con dos usuarios y `ADMIN_USERS` con uno solo.
