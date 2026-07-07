# Tasks — Feature 08: nulo vs cero en métricas de tasa

## Orden de ejecución

### Grupo B — Backend: lógica
- [ ] T-B1 · Cambiar `_safe_div(num, den, default=0.0)` → `default=None` · `backend/stats_engine.py` · cubre RF-1 · Done: `_safe_div(5,0)` devuelve `None`; `_safe_div(5,2)` devuelve `2.5`
- [ ] T-B2 · `net_rating` null-safe en `calc_team_stats`: `round(oer-der,4) if (oer is not None and der is not None) else None` · `backend/stats_engine.py` · cubre RF-4 · Done: equipo con `oer=None` o `der=None` no tira `TypeError`; `net_rating=None`
- [ ] T-B3 [P] · `as_pct` (team y player): `else 0.0` → `else None` · `backend/stats_engine.py` · cubre RF-1 · Done: jugador con `fgm=0` tiene `as_pct=None`
- [ ] T-B4 · `_avg()` de `team_stats` saltea `None` y devuelve `None` si no hay dato válido · `backend/app.py` · cubre RF-3 · Done: promedio de una tasa ignora partidos con esa tasa en `None`
- [ ] T-B5 [P] · `_avg()` de `player_stats` idem · `backend/app.py` · cubre RF-3 · Done: `averages.ft_pct` de un jugador con un partido 0 FTA + otro 4/6 = 0.6667 (no 0.3333)

### Grupo D — Frontend: UI
- [ ] T-D1 · `_computeAvg()`: fallback de métrica sin dato válido `0` → `null`; `net_rating` null-safe · `frontend/js/app.js` · cubre RF-3, RF-4 · Done: filtro "Últ. 5" de un equipo no muestra 0 espurio en tasas sin dato
- [ ] T-D2 · Verificar que `statBox`/`PCT`/`DEC2`/`statClass` renderizan `null` como `"—"` neutral (sin cambio de código esperado) · `frontend/js/app.js` · cubre RF-5 · Done: celda con tasa `null` muestra `"—"`

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · N/A — no se tocó esquema
- [ ] T-F3 · `GET /api/player/<team>/<player>` de un jugador con un partido sin FTA → `ft_pct` del partido = `null`, `averages.ft_pct` excluye ese partido; `GET /api/team/<code>` → tasas `null` donde denominador 0
- [ ] T-F4 · Recorrer vistas Equipo/Jugador/Liga/Comparar en navegador → consola sin errores JS; tasas sin dato muestran `"—"`; radar/evolución no dibujan 0 falso ni tiran error
- [ ] T-F5 · Recorrer CA-1 a CA-6 del spec y marcar ✅/❌ con evidencia

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-B5, T-F3 |
| CA-2 | T-B1, T-B5, T-D2, T-F3, T-F4 |
| CA-3 | T-B1, T-B5, T-F3 |
| CA-4 | T-B2, T-F3 |
| CA-5 | T-B4, T-B5, T-F3 |
| CA-6 | T-D1, T-D2, T-F4 |

## Dependencias externas
Ninguna — sin env var nueva, sin esquema, sin re-import. Los partidos ya en `backend/basketball.db` sirven para verificar (métricas on-the-fly).
