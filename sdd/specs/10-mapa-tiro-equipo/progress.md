# Progress — Feature 10: Mapa de tiro del equipo

## Estado
- [x] Backend: `_zones_from_shots` (factorizado de `player_shots`) + `GET /api/shots/<team_code>` (PPP desde `TeamGameStats`) · `backend/app.py`
- [x] Frontend: `api.teamShots(team)` · `frontend/js/api.js`
- [x] Frontend: `renderTeamShotmapTeam` + card `#team-teamshot` (auto en `renderTeam`, limpiado al cambiar de equipo) · `frontend/js/app.js`

## CA
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/shots/CNF` → total=143, has_coordinates=false, summary `{efg_pct:0.6049, games:2, global_pf:1.21, ppp:1.101}` |
| CA-2 | ✅ | Navegador: card "Mapa de tiro del equipo — CNF" con SVG, arriba del mapa del jugador |
| CA-3 | ✅ | Mapa del jugador (botón) intacto; consola sin errores |

## Notas
- `player_shots` refactorizado para reusar `_zones_from_shots` (sin duplicar la clasificación de zonas).
- El mapa del equipo es global (no filtrado por competencia) — spec §8.
- Evidencia: verificado con Playwright (CNF).
