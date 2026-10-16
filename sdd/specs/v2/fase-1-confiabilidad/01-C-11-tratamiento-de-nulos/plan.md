# Plan — C-11: Tratamiento de nulos en toda la app

> **ID:** C-11 · **Prioridad:** P0 · **Fase y orden:** 1·01
> **Depende de:** — (P-00 incluida) · **Habilita:** todas las C-xx, F-11, T-05, T-06
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 C-11 · Arquitectura §1.0, §2.1, §3.13, §3.20, §5, §7.4, §8
> **Estimación:** L · 10–16 h

## 1. Enfoque
1. **Grupo 0 (P-00)**: cherry-pick de `0cc4de6` de `dev` sobre la rama de trabajo de v2 (sin `669250e`/`3c65008`),
   `backend/venv/` a `.gitignore`, humo de los CA de las features 12–18. Todo el resto del plan se escribe **sobre el código de
   `dev`** (las líneas citadas son de `dev`).
2. **Backend**: eliminar sentinels en `stats_engine.py`; agregar dos helpers puros (razón de nulo y campos no registrados) y
   usarlos en las rutas legado para emitir `null_reasons`. Sin esquema.
3. **Frontend**: crear `core/format.js` (formato es-UY, nulos, comparador) y `core/i18n.js` (`t()`), migrar `app.js`/`charts.js`
   a esos helpers, corregir los hallazgos de la auditoría y mostrar la razón en el title de cada "—".
4. **Auditoría antes de tocar código** (Grupo Z) con el checklist de §6.4, y re-recorrido al final (CA del cliente).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `.gitignore` | config | agregar `backend/venv/` y `package-lock.json` | RF-1 |
| (git) cherry-pick `0cc4de6` | integración | Bloque C de `dev` sin venv | RF-1 |
| `backend/stats_engine.py` | module | sentinels → `None`; `NULL_REASON_CODES`; `null_reason_for()` y `unrecorded_fields()` (PROPUESTA); `UNRECORDABLE_TEAM`, `UNRECORDABLE_PLAYER` | RF-2, RF-3, RF-7, RF-11 |
| `backend/app.py` | route | `team_stats`, `player_stats`, `search_players`: `null_reasons` + `no_registrado`; `def_to_ratio` acumulado en jugador/equipo sin sentinel | RF-2, RF-3, RF-7, RF-11 |
| `frontend/js/core/format.js` | js-core **NUEVO** | `PCT`, `DEC1`, `DEC2`, `INT`, `fmtNumber`, `nullDisplay`, `cmpNullsLast`, `NULL_REASON_LABELS` | RF-4, RF-5, RF-8, RF-13 |
| `frontend/js/core/i18n.js` | js-core **NUEVO** | `t(key, fallback, params)` | RF-13 |
| `frontend/js/app.js` | js-view | importar helpers; `statBox` con razón; `_fourFactorsCard`; `_renderUsageRanking`; `_shotDetailGrid`; desglose ofensivo; `winCls`/ON-OFF/Cierres sin color para nulos; modal sin token; reemplazo de `_cmpNullsLast` por `cmpNullsLast` | RF-4…RF-10, RF-14 |
| `frontend/js/charts.js` | js-chart | evolución: DNP → hueco en todas las series + tooltip; formato es-UY en ticks/tooltips vía `fmtNumber` | RF-10, RF-13 |
| `frontend/css/style.css` | css | `/* ── nulos (C-11) ── */` `.null-val` (color `--muted`, `cursor: help`) | RF-4 |
| `frontend/sw.js` | sw | `STATIC` + `/js/core/format.js`, `/js/core/i18n.js`; `CACHE` → siguiente entero (`smart-basket-v10`, se asigna al integrar) | RF-4, RF-13 |
| `docs/api.md` | doc | `null_reasons`, códigos, `ast_to`/`def_to_ratio` nulos | RF-2, RF-3 |
| `docs/metrics.md` | doc | sentinels eliminados; regla `no_registrado`; DNP en evolución | RF-2, RF-10, RF-11 |
| `docs/database.md` | doc | política `DEFAULT NULL` para columnas nuevas con dato FIBA | RF-12 |
| `docs/frontend.md` | doc | `core/format.js`, `core/i18n.js`, copy de razones, formato es-UY; retirar la mención a `_colorCell` no, eso es T-01 | RF-4, RF-13 |

Matriz RF→archivo: RF-1 `.gitignore`+cherry-pick · RF-2 `stats_engine.py`, `app.py` · RF-3 `stats_engine.py`, `app.py`, `docs/api.md` ·
RF-4 `format.js`, `app.js`, `style.css` · RF-5 `app.js` · RF-6 `app.js` · RF-7 `stats_engine.py`, `app.py`, `app.js` · RF-8 `format.js`,
`app.js` · RF-9 `app.js` · RF-10 `charts.js`, `app.js` · RF-11 `stats_engine.py`, `app.py`, `app.js` · RF-12 `docs/database.md` ·
RF-13 `format.js`, `i18n.js`, `charts.js`, `sw.js` · RF-14 `app.js` · RF-15 `progress.md` (checklist §6.4).

## 3. Backend — rutas y modelos
Sin tablas ni columnas nuevas (arquitectura §5: C-11 sin cambios de esquema). Sin endpoints nuevos. Endpoints tocados:

**GET `/api/team/<team_code>`** (sin parámetros nuevos). Cambios de response:
```json
{
  "team_code": "CNF", "team_name": "Nacional", "games": 8,
  "record": {"wins": 5, "losses": 3, "win_pct": 0.625, "home": "3-1", "away": "2-2"},
  "averages": {"oer": 1.0912, "def_to_ratio": 3.12, "fast_break_pts": null, "paint_pts": 34.5, "...": "..."},
  "null_reasons": {"fast_break_pts": "no_registrado"},
  "league": {"...": "..."}, "leagues": {"...": "..."}, "totals": {"fga2": 312, "...": 0},
  "game_log": [
    {"game_id": "2820499", "date": "2026-04-12", "def_to_ratio": null, "fast_break_pts": null, "...": "...",
     "null_reasons": {"def_to_ratio": "sin_perdidas", "fast_break_pts": "no_registrado"}}
  ]
}
```
`averages.def_to_ratio` pasa a acumulado: `Σ(stl+blk+drb) / Σtov` de los partidos (pooled, DA-02, como ya hace `dev` con
`ast_to`); `null` con `sin_perdidas` si `Σtov = 0`. Errores: sin cambio (404 `{"error": "Equipo no encontrado"}`).

**GET `/api/player/<team_code>/<player_name>`**: `game_log[].ast_to` y `game_log[].def_to_ratio` → `null` con
`sin_perdidas` si `tov = 0`; en filas DNP (`played: false`) todas las tasas nulas llevan razón `dnp`; `averages.def_to_ratio`
acumulado sobre jugados; `null_reasons` raíz para `averages` (`ast_to`/`def_to_ratio` `sin_perdidas`, `plus_minus`
`no_registrado`, tasas sin ningún denominador `sin_intentos`, jugador sin partidos jugados → `sin_datos`). Errores sin cambio
(404 `{"error": "Jugador no encontrado"}`).

**GET `/api/search/players`**: cada fila agrega `null_reasons` (mismas reglas) y `plus_minus: null` si `no_registrado` en
todas las competencias del jugador; `def_to_ratio` acumulado. Sin errores nuevos.

Formato de error sin cambio (arquitectura §7.8 conserva `error`).

## 4. Backend — lógica
| Función | Módulo | Fórmula/entrada | RF |
|---|---|---|---|
| `calc_team_stats(t, opp)` (mod.) | `stats_engine.py` | `def_to_ratio = _safe_div(stl+blk+drb, tov)` (sin rama 99.0/0.0) | RF-2 |
| `calc_player_stats(p, team_pos, team, game_minutes, opp)` (mod.) | `stats_engine.py` | `ast_to = _safe_div(ast, tov)`; `def_to_ratio = _safe_div(stl+blk+drb, tov)`; se elimina `float("inf")` y `99.0` | RF-2, RF-4 |
| `NULL_REASON_CODES` | `stats_engine.py` | tupla con los 14 códigos de §7.4 | RF-3 |
| `null_reason_for(key, raw, *, played=True, unrecorded=frozenset())` **PROPUESTA** | `stats_engine.py` | ver pseudo-código | RF-3 |
| `unrecorded_fields(rows, fields, *, min_games=3)` **PROPUESTA** | `stats_engine.py` | ver pseudo-código | RF-11 |
| `UNRECORDABLE_TEAM`, `UNRECORDABLE_PLAYER` **PROPUESTA** | `stats_engine.py` | `("paint_pts","second_chance_pts","pts_from_tov","bench_pts","fast_break_pts")`, `("plus_minus",)` | RF-11 |
| `team_stats` (mod.) | `app.py` | agrupa `TeamGameStats` por `games.competition` (mapa `game_comp` ya existente en `dev` l.447) → `unrecorded_by_comp`; anula campos por partido; `null_reasons`; `def_to_ratio` acumulado | RF-2, RF-3, RF-11 |
| `player_stats` (mod.) | `app.py` | ídem con `PlayerGameStats` para `plus_minus`; razón `dnp` en filas no jugadas; `def_to_ratio` acumulado | RF-2, RF-3, RF-10, RF-11 |
| `search_players` (mod.) | `app.py` | `pm_vals` excluye filas `no_registrado` (hoy agrega `0` si `None`, `dev` l.873); `null_reasons` por fila | RF-7, RF-11 |

**Pseudo-código `null_reason_for`** (determina la razón de un `None` desde los conteos crudos; no calcula métricas):
```
DENOMINATORS = {   # clave → conteos crudos cuyo total 0 anula la métrica
  "ast_to": ("tov",), "def_to_ratio": ("tov",),
  "fg2_pct": ("fga2",), "fg3_pct": ("fga3",), "ft_pct": ("fta",), "ppt_2": ("fga2",), "ppt_3": ("fga3",), "ppt_ft": ("fta",),
  "efg_pct": ("fga2","fga3"), "pps": ("fga2","fga3"), "ft_rate": ("fga2","fga3"), "fg2_uso": ("fga2","fga3"), "fg3_uso": ("fga2","fga3"),
  "ts_pct": ("fga2","fga3","fta"), "to_pct": ("fga2","fga3","fta","tov"), "ppp": ("fga2","fga3","fta","tov"), ...}
def null_reason_for(key, raw, *, played=True, unrecorded=frozenset()):
    if not played: return "dnp"
    if key in unrecorded: return "no_registrado"
    if key in ("ast_to", "def_to_ratio") and (raw.get("tov") or 0) == 0: return "sin_perdidas"
    if key in DENOMINATORS: return "sin_intentos"
    return "sin_datos"          # p. ej. OR% individual sin fila de equipo/rival
```
Las rutas llaman `null_reason_for` solo para las claves cuyo valor quedó `None` (nunca para valores no nulos).

**Pseudo-código `unrecorded_fields`**:
```
def unrecorded_fields(rows, fields, *, min_games=3):
    # rows: dicts de una MISMA competencia (equipo-partido o jugador-partido)
    games = {r["game_id"] for r in rows}
    if len(games) < min_games: return set()
    return {f for f in fields if all((r.get(f) or 0) == 0 for r in rows)}
```
Caché: no (se calcula por petición sobre filas ya cargadas en la ruta; F-11 introduce `repository`/`cache`). F-11 migra el
agrupamiento a `competition_id` y reutiliza la función en el check `null_fields` de `data_quality.py`.

**Manejo de nulos en promedios** (ya en `dev`, se verifica): `_avg` excluye `None`; los campos anulados por `no_registrado`
quedan fuera del promedio; en `search_players` `_avg_count` sigue promediando conteos de partidos jugados (0 reales cuentan).

**Casos borde**: jugador sin ningún partido jugado → `games: 0`, `averages` todo `null`, `null_reasons` `sin_datos`; competencia
con < 3 partidos → nunca `no_registrado`; partido sin fila rival (`_opp_for` `None`) → se omite como hoy (sin cambio).

## 5. Frontend — capa API (api.js)
Sin cambios: los endpoints y parámetros no cambian; `null_reasons` llega dentro del JSON existente.

## 6. Frontend — UI (app.js / charts.js)
### 6.1 `core/format.js` (NUEVO, dueño C-11, arquitectura §8)
```
export const NULL_REASON_LABELS = { sin_intentos: t("nulos.sin_intentos", "Sin intentos: no se puede calcular"), ... 14 códigos }  // copy de spec §6
export function fmtNumber(v, decimals)   // null/NaN/±Infinity → null; si no: Intl.NumberFormat("es-UY",{minimumFractionDigits:d, maximumFractionDigits:d, useGrouping:false})
export const PCT  = v => v == null || !isFinite(v) ? "—" : fmtNumber(v * 100, 1) + "%"
export const DEC1 = v => … fmtNumber(v, 1) ;  DEC2 = v => … fmtNumber(v, 2) ;  INT = v => … fmtNumber(v, 0)
export function nullDisplay(reason)      // `<span class="null-val" title="${NULL_REASON_LABELS[reason] ?? t('nulos.generico','Sin dato')}">—</span>`
export function cmpNullsLast(a, b, dir)  // copia literal de `_cmpNullsLast` de dev (l.25–34)
```
`app.js` elimina sus definiciones locales de `PCT`, `DEC2`, `_cmpNullsLast` e importa desde `./core/format.js`; los tres usos de
`_cmpNullsLast` (l.496, 696, 1668) pasan a `cmpNullsLast`. `_scDec1`/`_scDec2` (l.1250) pasan a `DEC1`/`DEC2`.

### 6.2 `core/i18n.js` (NUEVO)
`export function t(key, fallback, params = {})` → `fallback` con `{param}` interpolado. Todo copy nuevo de C-11 pasa por `t()`.

### 6.3 Cambios en vistas
- `statBox(label, value, display, leagueKey, league, higherIsBetter = true, reason = null)`: si `value == null` el display es
  `nullDisplay(reason)` y la clase `neutral` (ya lo es por `statClass`). Las vistas de Equipo y Jugador pasan
  `data.null_reasons?.[clave]` (o, con filtro de competencia activo, la razón agregada: si todas las filas del log filtrado
  tienen la misma razón, esa; si no, `sin_intentos`).
- `_fourFactorsCard` (l.114): `opp: av.dr_pct == null ? null : 1 - av.dr_pct`.
- `_renderUsageRanking` (l.736–738): `p.uso_pct != null ? PCT(p.uso_pct) : "—"`, `p.pts != null ? DEC1(p.pts) : "—"`, barra 0
  solo si el valor es 0 real; `maxUso` con `|| 1` solo como guarda de división.
- `_shotDetailGrid` (l.1273): `n != null ? INT(n) : "—"`.
- Desglose ofensivo (`_renderTeamContent`, card de `PtsEnPint`…): la card se muestra siempre; cada `statBox` recibe la razón.
- Comparar `winCls` (l.1132), ON/OFF (`cls` con `d == null → neutral`, ya en `dev`), Cierres `cell()` (ya en `dev`): se verifican;
  cualquier comparación directa adicional que aparezca en la auditoría usa la misma guarda.
- Modal de borrado (`_showDeleteModal`, l.272): se quita el input de token y la lectura de `localStorage`.
- Game log de jugador: las celdas de tasas en filas DNP muestran `nullDisplay("dnp")`.

### 6.4 Checklist de recorrido (CA-1; se copia a `progress.md` y se completa dos veces: Grupo Z y Grupo F)
| Pantalla | Métricas / elementos a revisar | Hallazgo previo (código `dev`) | Esperado |
|---|---|---|---|
| Importar | catálogo (fecha, marcador, competencia), modal de borrado | token en modal (D-19) | sin token; fecha vacía "—" |
| Liga — tabla general | PJ, PG, PP, Pts, PF, PC | — | conteos 0 reales visibles |
| Liga — ranking | OER, DER, Net, eFG%, TS%, OR%, DR%, TO%, PACE, PTS, ROB; orden | `_cmpNullsLast` ok | nulos al final; "—" neutro |
| Liga — mapa | scatter (ejes con nulos se excluyen) | `valid` filtra nulos ok | sin punto para nulos |
| Equipo — récord | G-P, %, local/visitante | `win_pct` ok | "—" sin partidos |
| Equipo — eficiencia / tiro / detalle | OER…FT Rate; T2i…TLc (promedio y total); PPT | total `n ?? 0` | total "—" si falta |
| Equipo — Four Factors | eFG%, TO%, RebOf%, FT Rate propios y rival | `1-(dr_pct||0)` | rival "—" si DR% nulo |
| Equipo — rebotes, defensa | OR%, DR%, Reb%, TO, AS, Robos, Tapones, Stops, Def Playmaking, DEF/TO | DEF/TO 99.0 | DEF/TO "—" `sin_perdidas` |
| Equipo — desglose ofensivo | PtsEnPint, PtsSegCh, PtPer, Pts Banca, PCA | card oculta si todo 0 | "—" `no_registrado` |
| Equipo — game log / radar / evolución | tabla por partido; radar vs liga; OER y eFG% | ok en `dev` | sin puntos en 0 falsos |
| Equipo — ranking de uso | USO%, PTS | 0 real → "—" | "0,0%" |
| Cierres | tabla por partido, agregado, orden | ok en `dev` | nulos al final, sin color |
| Combinación (quinteto) | métricas + raw + líderes | — | "—" si sin datos |
| ON/OFF | tasas, conteos, diff, muestra | ok en `dev` | diff "—" sin color |
| Mapa de tiro equipo / jugador | 11/3 zonas, badge, PPT, eFG% | zona sin intentos | sin "0%" ni "0,00" en zona vacía |
| Jugador — cards | producción, por posesión/minuto, tiro, rebotes & distribución, defensa | AS/PER y DEF/TO 99.0 en log | "—" con razón |
| Jugador — game log / evolución / radar | filas DNP; PTS y OER; ejes | DNP pts=0 dibujado | hueco en DNP |
| Comparar | radar, tabla, box, tiro, desglose | ok en `dev` (`winCls`) | nulos sin ganador |
| Buscar | tabla, filtros, orden, +/- | +/- `None → 0` | "—" `no_registrado` |
Resultado por fila: ✅ limpia / ⚠️ corregida (con referencia a la tarea) / ↪ ruteada (requisito dueño).

Mobile 768 px: sin cambios de layout; el title del "—" se ve con tap largo; se acepta (el tooltip rico es de T-01).

## 7. Navegación
Sin vistas ni rutas nuevas (el routing por hash es de X-01).

## 8. Contratos de datos
- Mapa `null_reasons`: `{ "<clave de métrica>": "<código §7.4>" }`, solo con claves cuyo valor es `null`. Nivel raíz para
  `averages`; dentro de cada fila de `game_log`/`search`.
- Códigos: los 14 de arquitectura §7.4 (`NULL_REASON_CODES`). Ningún endpoint emite un código fuera de esa lista.
- Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline
- Sin códigos HTTP nuevos. Los mensajes existentes se conservan.
- `sw.js`: agregar `/js/core/format.js` y `/js/core/i18n.js` a `STATIC` y subir `CACHE` (hoy `smart-basket-v9`) al siguiente
  entero; sin eso la app offline no carga (`app.js` importa los módulos). Verificar en DevTools → Application → Service Workers
  con "Offline".

## 10. Riesgos / decisiones
- **R1 — Integración de `dev`**: conflictos si `main` recibió cambios después de `0cc4de6`; mitigación: cherry-pick de un solo
  commit y humo de CA 12–18 antes de seguir (arquitectura R-01).
- **R2 — Cambio visible de formato** (punto → coma) en toda la UI (DA-36): se registra en `progress.md` como cambio de
  presentación; Chart.js se alimenta con números (no strings) y solo cambia el formato de ticks/tooltips.
- **R3 — Falsos `no_registrado`**: umbral de 3 partidos; si aparece un caso real se ajusta en F-11 (Calidad de datos).
- **R4 — `null_reasons` agregadas con filtro activo** en el frontend: heurística simple (misma razón en todas las filas o
  `sin_intentos`); desaparece cuando C-02/T-05 muevan el filtro al backend.
- **Desviaciones respecto de la arquitectura**: (a) estimación L 10–16 h vs "M 6–10 h" (§9.1): la integración de `dev` + dos
  módulos nuevos + auditoría de 19 filas no entra en M; (b) `null_reason_for`, `unrecorded_fields`, `UNRECORDABLE_*` son
  **PROPUESTA (no está en 00-arquitectura-transversal.md)**: la arquitectura fija los códigos pero no cómo se detectan.
- **Dependencias técnicas**: ninguna previa. Entrega a F-11 (`../02-F-11-calidad-datos-competencias/plan.md`) la regla
  `unrecorded_fields` y la política `DEFAULT NULL`; a T-05 (`../13-T-05-conjunto-estandar-metricas/plan.md`) `core/format.js`
  (que agrega `fmtMetric`) y los códigos de razón; a T-06 `cmpNullsLast`.
- **Estimación: L · 10–16 h** (Grupo 0: 2–3 h · backend: 2–3 h · frontend: 3–5 h · auditoría + verificación: 3–5 h).
