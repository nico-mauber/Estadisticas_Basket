# Progress — Feature 11: Más estadísticas en Combinación y Comparar

## Estado
- [x] Backend: `raw` de `lineup_stats` con `pts`, `pts_against`, `reb` · `backend/lineups.py`
- [x] Frontend: tabla ancha (`.search-table`) en la card de Combinación (`renderTeamLineup`) · `frontend/js/app.js`
- [x] Frontend: card "Métricas avanzadas" (tabla 2 filas A/B) en Comparar (`renderCompare`) · `frontend/js/app.js`

## CA
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/lineup/CNF?players=…` → `raw` con `pts:53, pts_against:31, reb:27` |
| CA-2 | ✅ | Navegador: tabla de combinación con Off 1.21/Def 0.75/Net 0.45/eFG 54.6%/TS 56.4%/Pos 43.96/Pts 53/Pts-C 31/REB 27/OR 9/DR 18/AST 7/TOV 6/ROB 5/TAP 3/FGA 43/3PA 18/FTA 9 |
| CA-3 | ✅ | Navegador: card "Métricas avanzadas" con 2 filas (NACIONAL 1.25/0.96/0.29/59.8%… ; HEBRAICA 0.94/1.03/-0.08/46.3%…); consola sin errores |

## Notas
- La tabla de Comparar avanzada no colorea ganador (spec §8); el box score FIBA existente sí.
- Evidencia: verificado con Playwright (CNF combo; CNF vs HYM).
