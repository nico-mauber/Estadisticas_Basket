# Progress — C-03: Mapas de tiro: PPT y detalle por zona

> **Estado:** ⬜ No iniciado
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: módulo `shot_zones.py`
- [ ] T-A1 · Mover `ZONE_KEYS_11`/`ZONE_POINTS`/`_2PT_ZONES`/`_3PT_ZONES`
- [ ] T-A2 · `classify_zone` (renombre de `_classify_zone_11`)
- [ ] T-A3 · `to_half_court`
- [ ] T-A4 · `zone_table` (reemplaza `_zones_from_shots`, agrega `share`)
- [ ] T-A5 · `zones_with_stats` (percentile + sample)
- [ ] T-A6 · Retirar duplicados de `app.py`

### Grupo B — Backend: rutas
- [ ] T-B1 · `GET /api/shot-zones` (NUEVO)
- [ ] T-B2 · Validación `entity` inválido → 400
- [ ] T-B3 · `player_shots`/`team_shots` delegan en `shot_zones` + `share`

### Grupo C — Backend: verificación de nulos y no-regresión
- [ ] T-C1 · Nulos en zona sin intentos
- [ ] T-C2 · No-regresión de `summary`

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.shotZones`

### Grupo E — Frontend: componente `shot-chart.js`
- [ ] T-E1 · Mover SVG base
- [ ] T-E2 · `shotChart` con `data-zone`
- [ ] T-E3 · Color por percentil
- [ ] T-E4 · Zona sin intentos: "Sin tiros registrados"
- [ ] T-E5 · Tooltip desktop (hover)
- [ ] T-E6 · Hoja inferior móvil (tap)
- [ ] T-E7 · Zona sin intentos en tooltip
- [ ] T-E8 · Badge de muestra
- [ ] T-E9 · Retirar duplicados de `app.js`

### Grupo F — Frontend: UI (integración en las 3 vistas)
- [ ] T-F1 · Mapa de equipo
- [ ] T-F2 · Shot chart de jugador dentro de Equipo
- [ ] T-F3 · Shot chart de Jugador
- [ ] T-F4 · Estado vacío

### Grupo G — Errores, estados vacíos, offline/SW
- [ ] T-G1 · CSS tooltip/hoja
- [ ] T-G2 · `sw.js`: asset nuevo + `CACHE`
- [ ] T-G3 · Offline (confirmación)

### Grupo H — Verificación de feature
- [ ] T-H1 … T-H14

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): N/A (sin cambio de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan
(completar al implementar; ver plan.md §10 para las desviaciones ya anticipadas: D-1 a D-4)

## Docs a actualizar
- [ ] `docs/api.md` — `GET /api/shot-zones` (NUEVO), `GET /api/shots/...` (+ `share`), fórmulas de zona
- [ ] `docs/architecture.md` — `shot_zones.py` en el mapa de capas
- [ ] `docs/frontend.md` — `components/shot-chart.js`, tooltip de 7 datos, estados de UI
- [ ] `docs/metrics.md` — confirmación de que FG%/eFG%/PPT de zona no cambiaron (nota de no-regresión)

## Deuda / TODO
- Coordenadas reales de tiro (F-11, DA-32): mientras F-11 no reprocese el seed, el mapa de 11 zonas sigue
  degradado a datos concentrados en pocas cajas (mismo comportamiento que hoy, sin regresión). Recalibrar
  `classify_zone` (D-07) en cuanto haya coordenadas reales disponibles.
- Percentil y badge de muestra dependen de T-01/T-02: si al implementar no están integrados, se usan los
  fallbacks del plan §10 (D-3, D-4) y se documenta aquí cuándo se reemplazaron por las implementaciones definitivas.
- Población de zona en `population.py`: registrar en `huecos_arquitectura` si T-01 no ofrece un mecanismo directo
  para poblaciones filtradas a una zona (ver plan §10 D-3).
