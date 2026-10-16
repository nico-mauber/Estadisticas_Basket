# Progress — C-03: Mapas de tiro: PPT y detalle por zona

> **Estado:** ✅ Completado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas

### Grupo A — Backend: módulo `shot_zones.py`
- [x] T-A1 · Mover `ZONE_KEYS_11`/`ZONE_POINTS`/`_2PT_ZONES`/`_3PT_ZONES`
- [x] T-A2 · `classify_zone` (renombre de `_classify_zone_11`)
- [x] T-A3 · `to_half_court`
- [x] T-A4 · `zone_table` (reemplaza `_zones_from_shots`, agrega `share`)
- [x] T-A5 · `zones_with_stats` (percentile + sample)
- [x] T-A6 · Retirar duplicados de `app.py`

### Grupo B — Backend: rutas
- [x] T-B1 · `GET /api/shot-zones` (NUEVO)
- [x] T-B2 · Validación `entity` inválido → 400
- [x] T-B3 · `player_shots`/`team_shots` delegan en `shot_zones` + `share`

### Grupo C — Backend: verificación de nulos y no-regresión
- [x] T-C1 · Nulos en zona sin intentos
- [x] T-C2 · No-regresión de `summary`

### Grupo D — Frontend: api.js
- [x] T-D1 · `api.shotZones`

### Grupo E — Frontend: componente `shot-chart.js`
- [x] T-E1 · Mover SVG base
- [x] T-E2 · `shotChart` con `data-zone`
- [x] T-E3 · Color por percentil
- [x] T-E4 · Zona sin intentos: "Sin tiros registrados"
- [x] T-E5 · Tooltip desktop (hover)
- [x] T-E6 · Hoja inferior móvil (tap)
- [x] T-E7 · Zona sin intentos en tooltip
- [x] T-E8 · Badge de muestra
- [x] T-E9 · Retirar duplicados de `app.js`

### Grupo F — Frontend: UI (integración en las 3 vistas)
- [x] T-F1 · Mapa de equipo
- [x] T-F2 · Shot chart de jugador dentro de Equipo
- [x] T-F3 · Shot chart de Jugador
- [x] T-F4 · Estado vacío

### Grupo G — Errores, estados vacíos, offline/SW
- [x] T-G1 · CSS tooltip/hoja
- [x] T-G2 · `sw.js`: asset nuevo + `CACHE` → v24
- [ ] T-G3 · Offline (confirmación) — pendiente verificación manual

### Grupo H — Verificación de feature
- [x] T-H1 … T-H14 — verificado via curl y revisión de código

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (tooltip 7 datos) | ✅ | shot-chart.js:176-199 — made/att, FG%, eFG%, PPT, share%, percentil, sample badge |
| CA-2 (color percentil) | ✅ | shot-chart.js:70 — `percentileColor(z.percentile)`, gris si null |
| CA-3 (mobile sheet) | ✅ | shot-chart.js:242-269 — bottom sheet con backdrop y botón cerrar |
| CA-4 (desktop hover) | ✅ | shot-chart.js:228-240 — tooltip posicionado near cursor |
| CA-5 (zona vacía) | ✅ | shot-chart.js:59-64 — caja gris con "—", tooltip "Sin tiros registrados" |
| CA-6 (3 vistas) | ✅ | app.js:1435,1454,1937 — 3 call sites migrados a api.shotZones |
| CA-7 (no regresión legacy) | ✅ | app.py _zones_from_shots delega + aliases pct/efg para compat |
| CA-8 (percentil por zona) | ✅ | shot_zones.py zones_with_stats — PPT per zone vs population |
| CA-9 (sample badge) | ✅ | shot-chart.js:188-190 — sampleBadge si no "alta" |

## Gates técnicos
- Backend arranca sin traceback: ✅ (flask run + curl verificado)
- `upgrade_db()` idempotente (si aplica): N/A (sin cambio de esquema)
- Endpoints probados manualmente: ✅ (`/api/shot-zones?entity=team&id=ALB&competition=1` → 200, `/api/shot-zones?entity=equipo` → 400)
- Consola del navegador sin errores JS: pendiente verificación manual
- `node --check` todos los JS: ✅

## Desviaciones respecto a docs/ o plan
- D-1: `to_half_court` es identity function (coordenadas ya en media cancha desde F-11), no transforma nada.
- D-2: Percentil usa `population.percentile(my_ppt, others_ppts, "higher")` calculado localmente en shot_zones.py, no registrado en metrics_catalog (las zonas no son métricas estándar).
- D-3: Sample por zona usa lógica propia en shot_zones.py (`_zone_sample`), no sample.py, porque la unidad es intentos de tiro por zona, no partidos.

## Docs actualizados
- [x] `docs/api.md` — `GET /api/shot-zones` (NUEVO), legacy `/api/shots/...` nota de `share` y compat
- [x] `docs/architecture.md` — `shot_zones.py` en diagrama y descripciones
- [x] `docs/frontend.md` — `shot-chart.js` en tree, sección Shot chart reescrita, sw.js v24

## Deuda / TODO
- Coordenadas reales de tiro (F-11, DA-32): mapa 11 zonas degradado a pocas cajas sin regresión.
- T-G3 offline y verificación manual de consola pendientes.
