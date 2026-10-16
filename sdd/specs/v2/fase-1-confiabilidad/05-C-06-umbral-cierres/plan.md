# Plan — C-06: Umbral de cierres de partido

> **ID:** C-06 · **Prioridad:** P1 · **Fase y orden:** 1·05
> **Depende de:** C-11 Grupo 0 (P-00) — [`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md) · F-11 — [`../02-F-11-calidad-datos-competencias/plan.md`](../02-F-11-calidad-datos-competencias/plan.md)
> **Habilita:** F-13, F-04, F-06
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 · C-06 · Arquitectura §1.1, §1.5 D-09, §3.2, §4, §6
> **Estimación:** S · 2–3 h

## 1. Enfoque

`backend/clutch.py` pasa a tener el umbral (10) y la ventana (300 s) en un único punto: los parámetros
`margin=None`/`window_secs=None` de `team_clutch`, que si vienen en `None` se resuelven contra dos constantes
de módulo (`DEFAULT_MARGIN = 10`, `DEFAULT_WINDOW_SECS = 300`) — el mismo lugar que F-13 reemplaza después
por `config.get("clutch.margin")`/`config.get("clutch.window_secs")` sin tocar la firma (Arquitectura §3.2,
`clutch.py` en el mapa de módulos §4: "`margin=None, window_secs=None` → `config.get(...)` desde F-13; antes,
10/300"). La ruta `clutch_team` en `app.py` deja de tener su propio default (`margin=15` hoy) y solo valida y
reenvía lo que llegó por query. `_is_clutch` reconoce `OVERTIME` además de `OT` (D-09) usando la constante
compartida `PERIOD_TYPES` que crea F-11 (mientras F-11 no exista, una constante local de `clutch.py` con el
mismo valor, ver riesgo §10). El agregado suma un desglose completo del universo de partidos (con/sin pbp,
calificados/excluidos/sin eventos) para que el recuento cierre sin huecos, y acepta `competition` resuelta con
`repository.resolve_competition` de F-11 (mientras F-11 no exista, se filtra localmente sobre `Game.competition_id`
si ya está poblado, o se ignora con `competition: null` — ver riesgo §10, esto se ajusta cuando F-11 esté escrito
en paralelo). El frontend arma el título íntegro desde `margin`/`window_secs` de la respuesta; nunca desde una
constante local.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/clutch.py` | módulo (mod.) | Constantes `DEFAULT_MARGIN = 10`, `DEFAULT_WINDOW_SECS = 300` (único lugar); `_is_clutch` reconoce `OVERTIME`/`OT`; `_entry_margin`/`team_clutch` reciben `window_secs`; `team_clutch(games, team_code, team_name, margin=None, window_secs=None, competition=None)` calcula el desglose completo de universo y devuelve `margin`, `window_secs`, `competition` | RF-1, RF-2, RF-3, RF-5, RF-7, RF-8 |
| `backend/app.py` | ruta (mod.) | `clutch_team`: valida `?margin`/`?window_secs`/`?competition`, sin defaults propios; nuevos códigos de error 400/404 | RF-2, RF-8, RF-9 |
| `frontend/js/app.js` | vista (mod.) | `renderTeamClutch`: título construido con `d.margin`/`d.window_secs` en loading/éxito; título base `"Cierres"` sin números en loading/error; recuento con los 4 contadores; columna "PR" en la tabla por partido | RF-4, RF-6, RF-10 |
| `frontend/js/api.js` | api (mod.) | `api.clutch(team, params = {})` acepta `{margin, window_secs, competition}` vía `qs()` | RF-8, RF-9 |
| `frontend/sw.js` | sw | Sin asset nuevo; no se toca `CACHE` (no hay archivo nuevo en `STATIC`) | — |
| `docs/api.md` | doc (cierre) | `GET /api/clutch/<team_code>`: default 10/300, `window_secs`, `competition`, los 4 contadores de universo, `per_game[].overtime_periods`, errores nuevos | RF-2, RF-3, RF-5, RF-7, RF-8, RF-9 |
| `docs/architecture.md` | doc (cierre) | `clutch.py`: firma con `margin=None, window_secs=None` | RF-2 |
| `docs/frontend.md` | doc (cierre) | Copy nuevo de la card de Cierres (§6 del spec) | RF-4, RF-6 |
| `CLAUDE.md` | doc (cierre, fuera de v2 — ver nota) | Ya dice ≤10; se revisa que siga coincidiendo tras el cambio | — |

**Matriz RF → archivo:** RF-1 clutch.py · RF-2 clutch.py/app.py/docs · RF-3 clutch.py · RF-4 app.js ·
RF-5 clutch.py · RF-6 app.js · RF-7 clutch.py · RF-8 clutch.py/app.py/api.js · RF-9 app.py/api.js ·
RF-10 clutch.py (ya cumplido, sin tocar `_safe_div`). Sin RF huérfanos.

**Nota sobre `CLAUDE.md`:** el orquestador lo lista en "Docs a actualizar"; es un archivo ignorado por git fuera
de `docs/`. Este plan lo trata como verificación de coherencia al cerrar (no como archivo que C-06 edita, porque
la regla del grupo es no tocar nada fuera de las carpetas asignadas); se deja como nota en progress.md para que
quien mergee la rama lo revise.

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin cambios de esquema (confirmado por Arquitectura §5 "Sin cambios de esquema: … C-06 …").

### 3.2 Endpoints

**GET `/api/clutch/<team_code>`** (modificado · `login_required`)

Query:
- `margin` (int, opcional): 0–40. Ausente o `None` → `config.get("clutch.margin")` si F-13 ya existe, si no
  `clutch.DEFAULT_MARGIN` (10). Presente y fuera de rango, o no numérico → 400.
- `window_secs` (int, opcional, **NUEVO**): 60–600. Misma regla de default (300) y de validación.
- `competition` (string, opcional): `<id>` | `all` | vacío. Resuelto con `repository.resolve_competition` (F-11);
  mientras F-11 no esté disponible, ver riesgo D-2 (§10): se documenta como comportamiento provisional.

Response 200 (shape actual + campos nuevos en negrita conceptual, marcados NUEVO):
```json
{
  "team_code": "CNF",
  "team_name": "Nacional",
  "margin": 10,
  "window_secs": 300,
  "competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"},
  "games_total": 13,
  "games_with_pbp": 12,
  "games_without_pbp": 1,
  "games_qualified": 9,
  "games_excluded": 2,
  "games_without_clutch_events": 1,
  "clutch_record": "6-3-0",
  "aggregate": {
    "pts_for": 118, "pts_against": 109, "point_diff": 9,
    "reb": 41, "ast": 19, "tov": 12, "stl": 6, "blk": 3,
    "fouls_committed": 24, "fouls_drawn": 21,
    "off_rating": 1.05, "def_rating": 0.97, "efg_pct": 0.52, "ts_pct": 0.56,
    "possessions": 112.3
  },
  "per_game": [
    {"game_id": "abc123", "date": "2026-03-08", "opponent_code": "PEN", "home_away": "home",
     "entry_margin": 6, "overtime_periods": 0,
     "pts": 14, "opp_pts": 11, "point_diff": 3, "tov": 1, "ast": 2, "reb": 4,
     "fouls_committed": 2, "fouls_drawn": 3,
     "top_finisher": {"name": "C. Zinaich", "pts": 8},
     "top_creator": {"name": "J. Feldeine", "ast": 2},
     "off_rating": 1.12, "def_rating": 0.88, "efg_pct": 0.6, "ts_pct": 0.61, "possessions": 12.5}
  ]
}
```
Campos **NUEVO** (marcados `PROPUESTA (no está en 00-arquitectura-transversal.md)` — la arquitectura §6 solo fija
"shape actual; `margin`/`window_secs` por defecto 10/300"): `window_secs`, `competition`, `games_total`,
`games_with_pbp`, `games_without_pbp`, `games_without_clutch_events`, `per_game[].overtime_periods`.
`games_excluded` conserva su semántica actual (excluidos por diferencia > margen).

Errores (formato §7.8):
- 404 `no_encontrado` `"Equipo no encontrado"` (existente).
- 404 `no_encontrado` `"El equipo no tiene partidos en la competencia seleccionada."` (**NUEVO**, solo si `competition`
  resuelve a un id sin partidos del equipo).
- 404 `sin_pbp` `"Equipo sin play-by-play. Reimportá sus partidos."` (existente).
- 400 `parametro_invalido` `"El margen debe ser un número entre 0 y 40"` / `"La ventana debe ser un número entre 60
  y 600 segundos"` (**NUEVO**, RF-9).
- 400 `competencia_inexistente` (delegado a la resolución de F-11, cuando exista).

Sin cambios de esquema.

## 4. Backend — lógica

**`backend/clutch.py`** (módulo existente, se edita):

```
DEFAULT_MARGIN = 10          # único lugar; F-13 lo reemplaza por config.get("clutch.margin")
DEFAULT_WINDOW_SECS = 300    # único lugar; F-13 lo reemplaza por config.get("clutch.window_secs")

PERIOD_TYPES_OT = {"OT", "OVERTIME"}   # PROPUESTA local; F-11 la centraliza en su propio módulo (§9)

def _is_clutch(ev, last_regular, window_secs=DEFAULT_WINDOW_SECS):
    if ev.get("period_type") in PERIOD_TYPES_OT:
        return True
    return (ev.get("period_type") == "REGULAR"
            and ev.get("period") == last_regular
            and (ev.get("clock_secs") or 0) <= window_secs)
```
Cambio de firma: `_is_clutch` recibe `window_secs` (antes usaba `CLUTCH_SECS` fijo); `_entry_margin(evs, last_reg,
window_secs)` idem, comparando contra `window_secs` en vez de `CLUTCH_SECS`. `CLUTCH_SECS` queda como alias de
compatibilidad (`CLUTCH_SECS = DEFAULT_WINDOW_SECS`) por si algún import externo lo usa (verificado: solo
`clutch.py` lo usa hoy).

`team_clutch(games, team_code, team_name, margin=None, window_secs=None, competition=None)`:
```
margin = DEFAULT_MARGIN if margin is None else margin
window_secs = DEFAULT_WINDOW_SECS if window_secs is None else window_secs
games_total = len(games)                      # ya viene filtrado por competencia si `competition` se aplicó antes de llamar
games_with_pbp = games_total                  # _team_pbp_games ya excluye partidos sin pbp (ver D-1 §10)
games_without_pbp = 0                         # placeholder hasta que F-11 informe partidos sin pbp del universo total
                                               #   (games_total pasa a ser "partidos con pbp"; ver §9 ambigüedad)
por cada g en games:
    calcular last_reg, em = _entry_margin(evs, last_reg, window_secs)
    si em > margin: excluded += 1; continue
    clutch = [e for e in evs if _is_clutch(e, last_reg, window_secs)]
    calcular overtime_periods = cantidad de valores distintos de period entre los eventos con
                                 period_type in PERIOD_TYPES_OT del partido completo (no solo de la ventana)
    codes = equipos con al menos un evento en `clutch`
    si team_code no está en codes o opp no está en codes:
        games_without_clutch_events += 1; continue
    ... (agregación sin cambio) ...
    per_game.append({..., "overtime_periods": overtime_periods})
aggregate = ... (sin cambio de fórmula)
return {..., "margin": margin, "window_secs": window_secs, "competition": competition,
        "games_total": games_total, "games_with_pbp": games_with_pbp,
        "games_without_pbp": games_without_pbp, "games_qualified": len(per_game),
        "games_excluded": excluded, "games_without_clutch_events": games_without_clutch_events, ...}
```
Invariante verificado (CA-3): `games_qualified + games_excluded + games_without_clutch_events == games_with_pbp` y
`games_with_pbp + games_without_pbp == games_total` (con `games_without_pbp = 0` mientras F-11 no separe el
universo total del universo con pbp — ver §9).

Nulos (C-11): sin cambio — `_box_metrics`/`_safe_div` ya devuelven `None` con denominador 0; RF-10 solo lo verifica,
no lo modifica.

**Rutas en `app.py`:**
```python
@app.route("/api/clutch/<team_code>")
@login_required
def clutch_team(team_code: str):
    team_code = team_code.upper()
    row = TeamGameStats.query.filter_by(team_code=team_code).first()
    if not row:
        return jsonify({"error": "Equipo no encontrado", "code": "no_encontrado"}), 404

    margin_raw = request.args.get("margin")
    window_raw = request.args.get("window_secs")
    margin = _parse_int_param(margin_raw, 0, 40)          # helper NUEVO, ver abajo
    if margin_raw is not None and margin is None:
        return jsonify({"error": "El margen debe ser un número entre 0 y 40",
                         "code": "parametro_invalido"}), 400
    window_secs = _parse_int_param(window_raw, 60, 600)
    if window_raw is not None and window_secs is None:
        return jsonify({"error": "La ventana debe ser un número entre 60 y 600 segundos",
                         "code": "parametro_invalido"}), 400

    games = _team_pbp_games(team_code)   # (F-11 lo migra a repository.team_pbp_games con filtro de competencia)
    if not games:
        return jsonify({"error": "Equipo sin play-by-play. Reimportá sus partidos.",
                         "code": "sin_pbp"}), 404

    return jsonify(team_clutch(games, team_code, row.team_name, margin, window_secs))
```
`_parse_int_param(raw, lo, hi)` (helper NUEVO, PROPUESTA): `None` si `raw is None`; intenta `int(raw)`, si falla o
queda fuera de `[lo, hi]` devuelve `None` como señal de "inválido" (distinta de "ausente", que ya se manejó arriba
comprobando `raw is not None`).

## 5. Frontend — capa API (`api.js`)

| Método | Endpoint | Notas |
|---|---|---|
| `api.clutch(team, params = {})` | `GET /api/clutch/<team>` + `qs(params)` | antes tomaba `margin` suelto; pasa a aceptar `{margin, window_secs, competition}`. Si `qs()` no existe todavía (la crea T-05/F-11/C-08 en paralelo), C-06 arma la query string a mano con el mismo contrato (omitir `null`/`undefined`/`""`) hasta que `qs()` esté disponible |

## 6. Frontend — UI

Ubicación: vista Equipo (sin cambio de sección; X-01 en fase 2 la reubica sin tocar el componente).

`renderTeamClutch` (en `app.js`):
- Loading: título `"Cierres"` (sin números) + `"Calculando cierres..."` (sin cambio).
- Vacío (0 calificados): título completo con `d.margin`/`d.window_secs` + mensaje `"Sin cierres apretados: los {e}
  partido(s) con play-by-play se definieron por más de {margen} al minuto {mm:ss del window_secs}."`.
- Error: título `"Cierres"` (sin números) + mensaje del backend.
- Éxito: título `t('clutch.title', 'Cierres (últimos {min} min, dif ≤ {margen})', {min: fmtMin(d.window_secs),
  margen: d.margin})` en mayúsculas por CSS (`text-transform: uppercase`, ya existente en la clase del título) +
  línea de recuento + `d.competition?.label` si viene + agregado + tabla `per_game` con columna nueva "PR" (muestra
  `overtime_periods` si > 0, en blanco si 0).
- `fmtMin(window_secs)`: `window_secs/60`, con coma decimal si no es entero (`1,5 min` para 90 s) vía
  `core/format.js` `fmtNumber` (o `toLocaleString('es-UY')` si `fmtNumber` no existe todavía).

Componentes compartidos reutilizados: `toast` (error), `nullDisplay`/`t()` de C-11 (celdas nulas de `efg_pct`/`ts_pct`
en el agregado o filas), `.search-table`/`.table-sticky` para `per_game`.

Estados mobile 768 px: el encabezado con recuento en dos líneas (título arriba, recuento abajo) si no entra en una
sola línea a 360 px; sin scroll horizontal en la tabla `per_game` (columnas ya comprimidas hoy).

## 7. Navegación
Sin cambio: la card de Cierres vive dentro de la vista Equipo existente; X-01 (fase 2) la reubica sin tocar su
contrato.

## 8. Contratos (shapes)
Ver §3.2 (response completa) y §7.8 (errores) de este plan.

## 9. Errores y offline
| Código | Cuándo | Mensaje |
|---|---|---|
| 400 | `margin` fuera de 0–40 o no numérico | `"El margen debe ser un número entre 0 y 40"` |
| 400 | `window_secs` fuera de 60–600 o no numérico | `"La ventana debe ser un número entre 60 y 600 segundos"` |
| 404 | equipo inexistente | `"Equipo no encontrado"` (existente) |
| 404 | equipo sin partidos en la competencia elegida | `"El equipo no tiene partidos en la competencia seleccionada."` |
| 404 | equipo sin pbp | `"Equipo sin play-by-play. Reimportá sus partidos."` (existente) |

Offline: `/api/*` a red siempre; sin conexión, el error de red existente de `api.js` cubre la card (sin cambio).

## 10. Riesgos y decisiones

- **D-1 · `games_without_pbp` en 0 por ahora.** `_team_pbp_games` (hoy en `app.py`, futuro `repository.py` de F-11)
  ya filtra partidos sin pbp al construir `games`; `team_clutch` no ve los partidos sin pbp del equipo. Para que
  `games_total` incluya también esos partidos (RF-5 completo) hace falta que quien llama a `team_clutch` le pase
  también el conteo de partidos sin pbp del equipo (o la lista completa). **PROPUESTA (no está en
  00-arquitectura-transversal.md):** la ruta `clutch_team` calcula `games_without_pbp = total de partidos del equipo
  (en la competencia resuelta) − len(games)` con una consulta simple a `Game`/`TeamGameStats`, y se lo pasa a
  `team_clutch` como parámetro adicional en vez de recalcularlo ahí. Se documenta como desviación menor de la firma
  propuesta en la arquitectura (que no detalla este parámetro); se reporta en `huecos_arquitectura`.
- **D-2 · Filtro de competencia sin F-11 en paralelo.** C-06 depende del universo de competencia (`repository`,
  `games.competition_id`) que crea F-11 en la misma fase, orden 02 (antes que C-06, orden 05). Si al implementar
  C-06 el código de F-11 todavía no está integrado en la rama de trabajo, `competition` se resuelve con un fallback
  local: `games.competition` (TEXT, existente) filtrado por igualdad de string, y la respuesta informa
  `"competition": {"id": null, "label": comp_string}`. Este fallback se retira en cuanto F-11 esté disponible
  (tarea marcada en el grupo de dependencias externas de `tasks.md`).
- **D-3 · Prórrogas también mal en `dev`.** La arquitectura (§1.0 tabla, fila C-05/C-06) confirma que la corrección
  de `OVERTIME` no está en `dev`; C-06 la hace desde cero sobre el resultado de la integración del Grupo 0 de C-11.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato de endpoint (los campos nuevos están permitidos
  como agregado de su propio dueño, §0.3). Se agrega `PERIOD_TYPES_OT` local (PROPUESTA) porque F-11 (dueño de
  `PERIOD_TYPES` compartido según §1.0/D-09) va después en el orden dentro de la misma fase; si F-11 ya está
  integrado al implementar, C-06 importa su constante compartida en vez de la local.
- **Dependencias técnicas:** C-11 Grupo 0 → integración de `dev` (constante `margin=10` ya presente, se reemplaza
  por `DEFAULT_MARGIN`) ([`../01-C-11-tratamiento-de-nulos/plan.md`](../01-C-11-tratamiento-de-nulos/plan.md)); F-11
  → `repository.resolve_competition`, `repository.team_pbp_games`, constante compartida de tipos de período
  ([`../02-F-11-calidad-datos-competencias/plan.md`](../02-F-11-calidad-datos-competencias/plan.md)); F-13 (después)
  → migra `DEFAULT_MARGIN`/`DEFAULT_WINDOW_SECS` a `config.get("clutch.margin")`/`config.get("clutch.window_secs")`
  sin tocar la firma de `team_clutch` ([`../12-F-13-configuracion/plan.md`](../12-F-13-configuracion/plan.md)).
- **Incremento diferido:** editar el umbral y la ventana desde la UI de Configuración — se habilita con F-13
  ([`../12-F-13-configuracion/`](../12-F-13-configuracion/)). Filtro "últimos N partidos" y demás dimensiones de
  contexto en Cierres — se habilita con T-03
  ([`../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/`](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/)).
  Conjunto estándar T-05 en Cierres y tabla exportable `clutch_games` — se habilitan con T-05
  ([`../13-T-05-conjunto-estandar-metricas/`](../13-T-05-conjunto-estandar-metricas/)) y T-06.
- **Estimación: S · 2–3 h** (constantes + `_is_clutch`/`_entry_margin` con `window_secs` + desglose de universo:
  1 h; ruta con validación de query: 0,5 h; frontend título + recuento + columna PR: 1 h; docs + verificación: 0,5 h).
