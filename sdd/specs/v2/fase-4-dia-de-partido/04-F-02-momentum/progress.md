# Progress — F-02: Pestaña Momentum

> Estado: ⬜ No iniciado

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: `momentum.py`
- [ ] T-A1 · `_current_run`
- [ ] T-A2 · `_last_n_possessions_ppp`
- [ ] T-A3 · `_last_window_ratings`
- [ ] T-A4 · `_last_outcomes`
- [ ] T-A5 · `_hot_players` (a) conversiones consecutivas
- [ ] T-A6 · `_hot_players` (b) puntos en ventana
- [ ] T-A7 · `_hot_players` (c) asistencias consecutivas
- [ ] T-A8 · `_hot_players` (d) rebotes ofensivos en el cuarto
- [ ] T-A9 · `_cold_players`
- [ ] T-A10 · `compute`

### Grupo B — Backend: ruta
- [ ] T-B1 · `GET /api/live/<game_id>/momentum`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.momentum(id)`

### Grupo D — Frontend: UI
- [ ] T-D1 · Registro de modo `momentum`
- [ ] T-D2 · Reuso de ciclo de polling
- [ ] T-D3 · Bloque Racha actual
- [ ] T-D4 · Bloque últimas N posesiones
- [ ] T-D5 · Bloque últimos 5 minutos
- [ ] T-D6 · Bloque últimas 5 posesiones con desenlace
- [ ] T-D7 · Bloque jugadores calientes/fríos

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque
- [ ] T-E2 · Error/offline heredado de F-01

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
- [ ] `docs/api.md` — endpoint `GET /api/live/<game_id>/momentum`
- [ ] `docs/architecture.md` — módulo `backend/momentum.py`
- [ ] `docs/frontend.md` — pestaña Momentum, `api.momentum()`

## Deuda / TODO
- [NEEDS CLARIFICATION] (spec §9): si una canasta no asistida corta o solo se salta en la racha de "4 asistencias consecutivas del mismo jugador" — implementado con la lectura estricta (corta), confirmar con el cliente.
