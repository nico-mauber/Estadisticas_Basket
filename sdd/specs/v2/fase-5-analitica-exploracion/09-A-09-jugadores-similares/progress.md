# Progress — A-09: Jugadores similares

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-A1 · activar `similar.top_n`
- [ ] T-B1 · `similarity.py` base (dimensiones, errores, posiciones)
- [ ] T-B2 · `_zone_vectors`
- [ ] T-B3 · perfil crudo, media/desvío y z-score
- [ ] T-B4 · distancia y similitud
- [ ] T-B5 · `similar_payload` (filtros, orden, explicación)
- [ ] T-B6 · `similar_players` y caché
- [ ] T-B7 · ruta `GET /api/similar/<player_id>`
- [ ] T-B8 · `profile_suggestions` (incremento de F-03)
- [ ] T-B9 · `suggestions_profile` en `prepare.py`
- [ ] T-C1 · `api.similar`
- [ ] T-D1 · `renderSimilarPlayers`
- [ ] T-D2 · fila expandible y exportación
- [ ] T-D3 · pestaña Similares de Jugador (S4)
- [ ] T-D4 · pestaña Similares de Explorar (S7) y acción del buscador
- [ ] T-D5 · CSS
- [ ] T-D6 · bloque en el informe de F-03
- [ ] T-E1 · errores y offline
- [ ] T-E2 · `sw.js`
- [ ] T-F1 … T-F20 · verificación (T-F18 = protocolo de validación manual)

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
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (no aplica: sin esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/api.md` — `GET /api/similar/<player_id>`; `suggestions_profile` de `GET /api/prepare`.
- `docs/frontend.md` — componente `similar-players.js`, pestañas Similares de Jugador (S4) y Explorar (S7), acción "Similares" del buscador, bloque "Perfil parecido en tu plantel" del informe de F-03, copy nuevo.
- `docs/architecture.md` — módulo `backend/similarity.py`.
- `docs/metrics.md` — "Jugadores similares": dimensiones, z-score dentro de la competencia, distancia euclidiana normalizada, similitud, nulos, modo de zonas y protocolo de validación.

## Deuda / TODO
