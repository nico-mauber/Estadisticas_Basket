# Progress — F-03: Preparar partido

> Estado: ⬜ No iniciado

## Estado de tareas
(copiar checklist de tasks.md con [x] al implementar)

### Grupo A — Backend: módulo `prepare.py`
- [ ] T-A1 · `head_to_head(team_a, team_b, comp_id)` · `backend/prepare.py`
- [ ] T-A2 · `_advantages_and_threats(...)` · `backend/prepare.py`
- [ ] T-A3 · `_rival_offensive_threats(...)` · `backend/prepare.py`
- [ ] T-A4 · `_matchups_block(...)` · `backend/prepare.py`
- [ ] T-A5 · `prepare_report(...)` · `backend/prepare.py`
- [ ] T-A6 · `report.default_last_n` en `CONFIG_SPEC` (o default embebido) · `backend/config.py` / `backend/prepare.py`

### Grupo B — Backend: rutas
- [ ] T-B1 · `GET /api/prepare` · `backend/app.py`
- [ ] T-B2 · `GET /api/h2h` · `backend/app.py`
- [ ] T-B3 · Validaciones 400/404 · `backend/app.py`

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.prepare()` / `api.h2h()` · `frontend/js/api.js`

### Grupo D — Frontend: UI
- [ ] T-D1 · Selector inicial
- [ ] T-D2 · Registro de modo `preparar` en router
- [ ] T-D3 · Bloque Encabezado
- [ ] T-D4 · Bloque Ventajas/Amenazas
- [ ] T-D5 · Bloque Quintetos rivales
- [ ] T-D6 · Bloque Amenazas ofensivas
- [ ] T-D7 · Bloque Head to head
- [ ] T-D8 · `matchup-table.js`
- [ ] T-D9 · Selector directo/inverso
- [ ] T-D10 · Historial por celda
- [ ] T-D11 · Bloque Sugerencia por perfil (oculto)
- [ ] T-D12 · Exportación PDF/PNG/CSV

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Estados vacíos por bloque
- [ ] T-E2 · Error general / offline
- [ ] T-E3 · `sw.js` STATIC + CACHE

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback
- [ ] T-F2 · `upgrade_db()` (N/A, sin esquema)
- [ ] T-F3 · Endpoints probados con curl
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
| CA-6 (cliente) | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A, sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

(completar al implementar)

## Docs a actualizar
- [ ] `docs/api.md` — endpoints `GET /api/prepare`, `GET /api/h2h`
- [ ] `docs/architecture.md` — módulo `backend/prepare.py`
- [ ] `docs/frontend.md` — vista S5 · Partido modo Preparar, componentes `prepare-report.js`/`matchup-table.js`, rutas de `sw.js`

## Deuda / TODO
- Incremento diferido → A-09 (fase 5): "emparejamiento propuesto por perfil" (`suggestions_profile`).
- Incremento diferido → F-12 (fase 5): abrir Preparar desde el calendario/próximo partido.
- [NEEDS CLARIFICATION] (spec §9): límite superior de quintetos rivales mostrados en el informe (vs. tabla completa) — confirmar con el cliente si el PDF de 2 páginas debe recortar a un top N.
