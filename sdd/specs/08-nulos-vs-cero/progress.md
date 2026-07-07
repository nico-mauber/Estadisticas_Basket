# Progress — Feature 08: nulo vs cero en métricas de tasa

## Estado de tareas
- [x] T-B1 · `_safe_div` default `0.0` → `None` · `backend/stats_engine.py`
- [x] T-B2 · `net_rating` null-safe (`if oer is not None and der is not None`) · `backend/stats_engine.py`
- [x] T-B3 · `as_pct` (team + player) `else 0.0` → `else None` · `backend/stats_engine.py`
- [x] T-B4 · `_avg()` de `team_stats` saltea `None`, devuelve `None` si vacío · `backend/app.py`
- [x] T-B5 · `_avg()` de `player_stats` idem · `backend/app.py`
- [x] T-D1 · `_computeAvg()` fallback `0` → `null`; `net_rating` null-safe · `frontend/js/app.js`
- [x] T-D2 · Verificado: `PCT`/`DEC2`/`statClass` renderizan `null` → `"—"` neutral (sin cambio de código)
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · N/A (sin cambio de esquema)
- [x] T-F3 · Endpoints probados con `test_client` contra DB real
- [x] T-F4 · Vistas recorridas en navegador real (Playwright), consola sin errores JS nuevos
- [x] T-F5 · CA-1 a CA-6 recorridos

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `GET /api/player/CNF/B. Barrera`: partido `fta=0` → `ft_pct: null`; partido `fta=2, ftm=1` → `0.5`. `averages.ft_pct = 0.5` (excluye el partido nulo). Antes del fix habría sido `0.25` |
| CA-2 | ✅ | Navegador real (A. Gentile, AGU): card FG3%/FG2%/FT%/TS% muestran `"—"` con clase `stat-value neutral`, no `0.0%` |
| CA-3 | ✅ | Jugador sin 3PA (A. Gentile): `averages.fg3_pct == None` (endpoint) y `"—"` en UI |
| CA-4 | ✅ | Equipo con 0 posesiones (test unitario `calc_team_stats`): `oer=None`, `net_rating=None`, sin `TypeError`. Endpoints `/api/team/CNF` y `/api/league` → 200 |
| CA-5 | ✅ | Conteos: B. Barrera `fta=0` en un partido se conserva como 0 (no se anula); solo las tasas se vuelven `null`. Promedio de tasa excluye el partido sin intentos (verificado en CA-1) |
| CA-6 | ✅ | Consola del navegador al recorrer Equipo→Jugador: único error = `favicon.ico` 404 (preexistente, documentado en Feature 01). Sin errores JS de esta feature |

## Gates técnicos
- Backend arranca sin traceback: ✅ (`python backend/app.py` sirviendo en `:5000`, `/api/me` → 200)
- `upgrade_db()` idempotente: N/A — sin cambio de esquema
- Endpoints probados manualmente: ✅ (`test_client` player/team/league + navegador real)
- Consola del navegador sin errores JS: ✅ (solo el 404 preexistente de favicon)

## Desviaciones respecto a docs/ o plan
- **Sentinels conservados** (`ast_to`/`def_to_ratio` = 99.0 cuando `tov==0`): NO se cambiaron a `null`, según decisión del plan §10. Representan "jugó sin perder la pelota" (dato real), distinto de "no intentó". Si el cliente quiere `null` también ahí, es 1 línea por sentinel.
- **`charts.js` sin cambios**: `_norm()` ya guarda `value == null` → 0 (radar); las líneas de evolución usan `?? 0` solo sobre OER/eFG por partido, que nunca son `null` para un equipo real (siempre hay posesiones/tiros). Sin regresión observada. Documentado como deuda menor por si aparece un 0 falso en un gráfico de caso borde.
- **`league_averages()` sin cambios**: ya filtraba `None`; su fallback `{avg:0,best:0}` para una métrica totalmente ausente se conserva (contexto de liga, no rompe).

## Docs a actualizar
- [x] `docs/api.md` — nota "Nulo vs cero en métricas de tasa" (contrato: tasas pueden ser `null`, excluidas del promedio)
- [x] `docs/metrics.md` — nota "Nulo vs cero" al inicio

## Deuda / TODO
- Evolución/`charts.js`: si algún gráfico de caso borde llega a mostrar un 0 falso por `?? 0`, cambiar a omitir el punto (`null`).
- Sentinels `ast_to`/`def_to_ratio`: pendiente confirmar con el cliente si `tov==0` debe ser `null` en vez de 99.0.
