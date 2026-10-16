# Progress — Feature 14: promedios de liga

> Cierre de C-02 (`Smart-Basket Especificacion v2.docx` §1, P0).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema
- [x] **T-B1** · `league_averages()`: sin valores válidos → `{"avg": None, "best": None}` · `backend/stats_engine.py`
- [x] **T-B2** · `league_overview._avg`: excluye `None`, devuelve `None` si queda vacío · `backend/app.py`
- [x] **T-B3** · `team_stats`: mapa `leagues` por competencia + `""` · `backend/app.py`
- [x] **T-B4** · `player_stats`: ídem sobre población de jugadores · `backend/app.py`
- [x] **T-B5** · RF-6 verificado — **destapó un defecto del spec**, ver §Desviaciones D-1
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · `statBox`: retirado el `↑ {best}` · `frontend/js/app.js`
- [x] **T-D2** · `_renderTeamContent`: `leagues[_teamComp]` · `frontend/js/app.js`
- [x] **T-D3** · `_renderPlayerContent`: `leagues[comp]` · `frontend/js/app.js`
- [x] **T-E1** · Competencia con métrica nula → `Ø —`, sin caer al agregado
- [x] **T-E2** · `sw.js` sin cambios
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | `leagues[comp].avg` coincide **exacto** con la media ponderada por partidos en las 6 métricas probadas: `oer` 1.0171, `der` 1.0171, `efg_pct` 0.4964, `ts_pct` 0.5213, `pace` 78.745, `or_pct` 0.2936. Criterio reescrito en el Paso 4 — ver D-1 |
| CA-2 | ✅ | Con una 2ª competencia inyectada vía intercepción de `fetch` (la base real tiene una sola): al cambiar el selector, `OER` pasa de `Ø 1.02` a `Ø 9.99` y `eFG%` de `Ø 49.6%` a `Ø 11.1%` |
| CA-3 | ✅ | Filtro "Últ. 3" sobre CNF: las **20** métricas con contexto mantienen su `Ø` idéntico, mientras los valores del equipo sí cambian. Comparación por etiqueta, no por índice |
| CA-4 | ✅ | Con `pace.avg = null` inyectado: la card muestra `Ø —`, no `Ø 0.0%`. Barrido de Equipo/Jugador/Liga: **0** ocurrencias de `Ø 0.0%` |
| CA-5 | ✅ | Barrido de `.stat-context` en Equipo, Jugador y Liga: **0** elementos con `↑` |
| CA-6 | ✅ | Barrido de `/\b\d{3,}\.\d%/` en las tres vistas: **0** coincidencias. Requirió un fix extra — ver D-2 |
| CA-7 | ✅ | `GET /api/league` → `200`. `_avg` excluye nulos; antes `sum()` con un `None` habría levantado `TypeError` |
| CA-8 | ✅ | Consola tras recorrer Equipo, Jugador y Liga: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — `/api/team/<code>`, `/api/player/<t>/<n>`, `/api/league`
  (con y sin `?comp=`), contra el shape del plan §8
- Consola del navegador sin errores JS: ✅

## Desviaciones respecto a docs/ o plan

**D-1 · CA-1 del spec estaba mal formulado; lo corrigió la verificación, no el código.**
El criterio original pedía que el `Ø` coincidiera con "la media de esa métrica en la tabla de Liga".
Son dos estadísticos distintos cuando los equipos tienen distinta cantidad de partidos:

| Estadístico | OER |
|---|---|
| Media sobre todos los partidos-equipo (ponderada) | **1.0171** |
| Media de los promedios por equipo | 0.9908 |

CNF y HYM tienen 2 partidos; los otros cuatro equipos, 1. C-02 dice literalmente *"sobre todos los
partidos de la competencia y temporada seleccionadas"* → la ponderada es la correcta, y es la que
`league_averages()` ya calculaba. **El código no cambió; el criterio de aceptación sí.** Spec §7 CA-1
reescrito y §9 ampliado con la decisión y su justificación.

**D-2 · `def_to_ratio` se renderizaba como porcentaje — fix agregado para poder pasar CA-6.**
No estaba en plan §2. El heurístico `isPct` de `statBox` clasifica por substring, y `def_to_ratio`
contiene `"to_"`: un ratio de `3.275` se mostraba como **`327.5%`**. Es la misma familia de valor
imposible que reporta C-02 — y con el sentinel `99.0` de la Feature 08 daría exactamente el
`9900.0%` del reporte del cliente. Se agregó una lista de exclusión explícita (`NOT_PCT`).
Sin este fix, CA-6 no pasaba.

**D-3 · `league` se conserva junto a `leagues`.**
Redundante a propósito (plan D-1): `league == leagues[""]`. Evita romper consumidores del campo viejo
y hace el cambio reversible. Se retiran juntos cuando T-01 rehaga el bloque de contexto.

**D-4 · CA-2 y CA-4 no son alcanzables con los datos de producción.**
La base tiene **una sola** competencia, así que `leagues[""]` y `leagues["<comp>"]` son numéricamente
idénticos y el filtrado no es observable; y ninguna métrica queda sin datos. Ambos se verificaron
interceptando la respuesta para inyectar una 2ª competencia y una métrica nula. La base real no se
tocó. Registrado para no leerlo como cobertura end-to-end plena.

## Docs a actualizar

- [x] `docs/api.md` — campo `leagues`; `avg`/`best` admiten `null`; alcance por competencia
- [x] `docs/frontend.md` — la card de stat ya no muestra `↑`; de dónde sale el `Ø`

## Deuda / TODO

- **⚠️ El sentinel `def_to_ratio = 99.0` contamina el promedio de liga de jugadores.**
  Tras el fix de D-2 ya no se muestra como porcentaje, pero el `Ø` del perfil de jugador marca
  **26.66** para un ratio que normalmente vale 2-5: los jugadores con `tov == 0` aportan `99.0` cada
  uno. Es deuda abierta de Feature 08 (`08-nulos-vs-cero/progress.md`: *"pendiente confirmar con el
  cliente si `tov==0` debe ser `null` en vez de 99.0"*) y quedó **fuera de alcance** por spec §8. Ahora
  es más visible que antes, porque el `Ø` es el único contexto que queda en la card. **Requiere
  decisión del cliente** y es barato de aplicar (1 línea por sentinel).
- **El heurístico `isPct` de `statBox` es frágil.** Clasificar formato por substring del nombre de la
  métrica funciona por accidente. Lo correcto es declarar el formato junto a cada métrica. `NOT_PCT`
  tapa el caso conocido; el próximo nombre con `to_`, `or_` o `as_` vuelve a romperlo.
- **La población de liga sigue sin umbral mínimo de muestra** (plan D-4): un equipo con 1 partido pesa
  igual que uno con 12. Es T-01/T-02, no esta feature — pero explica por qué el `Ø` todavía se mueve
  entre importaciones.
- **Entre esta feature y T-01 las cards no tienen indicador de dispersión.** Consecuencia aceptada de
  la decisión del cliente (ROADMAP §5).
