# Progress — F-01: Partido en vivo

> Estado: ⬜ No iniciado

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: `chains.py`
- [ ] T-A1 · `assist_points`
- [ ] T-A2 · `oreb_points`
- [ ] T-A3 · `steal_points`
- [ ] T-A4 · `turnover_cost`

### Grupo B — Backend: `live.py`
- [ ] T-B1 · `is_final`
- [ ] T-B2 · Caché TTL en memoria
- [ ] T-B3 · Bloque `teams`
- [ ] T-B4 · `_vs_season`
- [ ] T-B5 · `_points_distribution`
- [ ] T-B6 · `players_on_court`
- [ ] T-B7 · Bloque `players`
- [ ] T-B8 · `live_snapshot`

### Grupo C — Backend: ruta
- [ ] T-C1 · `GET /api/live/<game_id>`

### Grupo D — Frontend: api.js
- [ ] T-D1 · `api.live(id)`

### Grupo E — Frontend: UI
- [ ] T-E1 · Registro de modo `vivo`
- [ ] T-E2 · Adaptador de polling
- [ ] T-E3 · Indicador EN VIVO / stale
- [ ] T-E4 · Bloque métricas de equipo
- [ ] T-E5 · Bloque distribución de puntos
- [ ] T-E6 · Bloque jugadores
- [ ] T-E7 · Banner de partido finalizado

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` (N/A)
- [ ] T-F3 · Endpoint probado con curl
- [ ] T-F4 · Consola sin errores JS
- [ ] T-F5 · CA recorridos manualmente

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
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A, sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

(completar al implementar)

## Docs a actualizar
- [ ] `docs/api.md` — endpoint `GET /api/live/<game_id>`
- [ ] `docs/architecture.md` — módulos `backend/live.py`, `backend/chains.py`
- [ ] `docs/frontend.md` — vista S5 · Partido modo Vivo, `api.live()`
- [ ] `docs/deployment.md` — nota de DA-28 (gunicorn `--workers 1 --threads 4`)

## Deuda / TODO
- Incremento diferido → A-07 (fase 5): desglose fino de producción desde eventos (`chains.py` se extiende sin cambiar firmas).
- [NEEDS CLARIFICATION] (spec §9): comportamiento cuando `game_id` corresponde a un partido futuro sin `data.json` publicado.
