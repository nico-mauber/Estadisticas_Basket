# Plan — F-20: Enfrentamiento directo dentro de Equipo

> **ID:** F-20 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 02
> **Depende de:** X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)) · F-03 ([../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** Especificación v2 §4.2 · F-20 · Arquitectura §3.10, §3.12, §4, §6, §9
> **Estimación:** M · 3–6 h

## 1. Enfoque

Feature pequeña de reuso: no crea ningún motor de cálculo nuevo. El historial reutiliza `prepare.head_to_head` de F-03 sin
tocarlo (una sola llamada, mismo shape que `GET /api/h2h`). La única pieza de cálculo propia es la comparación de
promedios contra el rival vs. promedios generales, que vive en un módulo mínimo (`rival_comparison.py`, NUEVO) construido
sobre `stats_engine.compute_standard`/`team_game_stats` ya persistidos — sin depender de posesiones on-the-fly (A-01) ni de
percentiles (T-01) para el cálculo central, aunque si T-01 y F-17 ya están disponibles al implementar (lo están: F-20 es
de fase 5), la vista los reutiliza para el formato del bloque de diferencias.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/rival_comparison.py` | module (NUEVO) | `compare(team_code, rival_code, comp_id)`: promedios contra el rival vs. generales + diferencias ordenadas | RF-6, RF-7, RF-8 |
| `backend/app.py` | route | `GET /api/rival-comparison` (ruta fina, delega en `rival_comparison.py`); reutiliza `prepare.head_to_head` para el historial sin ruta nueva (usa `GET /api/h2h` ya existente) | RF-4, RF-6 |
| `frontend/js/api.js` | api | `api.rivalComparison(params)` (reutiliza `api.h2h(params)` de F-03, ya existente, sin cambios) | RF-4, RF-6 |
| `frontend/js/views/equipo.js` (de X-01) | js-view | pestaña `enfrentamiento`: selector de rival, orquesta los 4 bloques | RF-1, RF-2, RF-3 |
| `frontend/js/components/rival-comparison.js` (NUEVO) | component | render de historial + comparación de promedios + diferencias + enlaces | RF-4..RF-10 |
| `docs/api.md`, `docs/architecture.md`, `docs/frontend.md` | doc | endpoint `GET /api/rival-comparison`, módulo `rival_comparison.py`, pestaña Enfrentamiento | — (cierre) |

**Matriz RF → archivo:**

| RF | Archivo(s) |
|---|---|
| RF-1, RF-2 | `views/equipo.js`, `components/rival-comparison.js` |
| RF-3 | `views/equipo.js` (lee `?rival=` de la URL) |
| RF-4, RF-5 | `components/rival-comparison.js` (llama `api.h2h`, de F-03, sin cambios) |
| RF-6, RF-7, RF-8 | `rival_comparison.py`, `app.py`, `components/rival-comparison.js` |
| RF-9, RF-10 | `components/rival-comparison.js` (enlaces a rutas ya existentes de F-03/F-07) |

## 3. Backend — rutas y modelos

Sin cambios de esquema.

**`GET /api/rival-comparison`** (login_required)
- Query: `team` (requerido), `rival` (requerido), `competition` (opcional, default: la resolución estándar de T-03/C-02).
- 400 `{"error": "Falta el equipo", "code": "parametro_invalido"}` / `{"error": "Falta el rival", "code":
  "parametro_invalido"}` si falta alguno; 400 `{"error": "El rival no puede ser el mismo equipo", "code":
  "parametro_invalido"}` si `rival == team`.
- 404 `{"error": "Equipo no encontrado", "code": "no_encontrado"}` / `"Rival no encontrado"` si el código no existe.
- 200 → shape de §8 (`{vs_rival, overall, deltas, sample}`).

No se crea ninguna ruta nueva para el historial: la vista llama directamente `GET /api/h2h` (ya existe, dueño F-03) desde
`api.h2h(params)` (ya existe en `api.js` desde F-03, sin modificar su firma).

## 4. Backend — lógica

### `backend/rival_comparison.py` (NUEVO)

```
compare(team_code: str, rival_code: str, comp_id: int | None) -> dict
    # 1. games_vs_rival = repository.competition_games(comp_id) filtrados a partidos entre team_code y rival_code
    #    (cualquiera de los dos como local)
    # 2. games_all = repository.competition_games(comp_id) filtrados a partidos de team_code (todos, incluidos los del
    #    rival — decisión RF-6/§9 del spec: "promedios generales" no excluye al rival)
    # 3. bundle_vs_rival = StatBundle agregando team_game_stats de games_vs_rival (mismo patrón que T-05 StatBundle)
    #    bundle_overall = StatBundle agregando team_game_stats de games_all
    # 4. vs_rival = stats_engine.compute_standard(bundle_vs_rival)   # pooled, DA-02
    #    overall = stats_engine.compute_standard(bundle_overall)     # pooled, DA-02
    # 5. deltas: para cada métrica común con direction != neutral, delta orientado = s·(vs_rival.value - overall.value)
    #    (mismo criterio de orientación que T-01 §3.6: positivo = mejor que el promedio general)
    # 6. top_deltas = las 3 a 5 de mayor |delta| (gameplan.items_min/items_max si F-13 está integrado, si no 3..5 fijo)
    # 7. sample = sample.sample_level("team", n=len(games_vs_rival), unit="partidos") si T-02 está disponible; si no,
    #    {"level": "baja" if len(games_vs_rival) < 3 else "alta", "n": len(games_vs_rival)} (fallback simple, T-02 ya
    #    está disponible en fase 5 así que este fallback no debería activarse en la práctica)
    # devuelve {"vs_rival": vs_rival, "overall": overall, "deltas": {...}, "top_deltas": [...], "sample": sample}
```

**Manejo de nulos (C-11).** Toda métrica sin base (ej. `to_pct` si no hubo posesiones calculables) hereda `{"value": null,
"reason": ...}` directamente de `stats_engine.compute_standard`; el delta correspondiente es `null` si cualquiera de los
dos lados (`vs_rival` u `overall`) es nulo.

**Casos borde.**
- Rival sin ningún partido contra el equipo: `games_vs_rival = []`, `vs_rival` con todas las métricas `{"value": null,
  "reason": "sin_datos"}`, `deltas` todos `null`, `sample = {"level": "baja", "n": 0}`.
- Rival == team (validado antes de llamar `compare`, en la ruta).

## 5. Frontend — capa API (api.js)

```js
api.rivalComparison: (params) => apiFetch(`/api/rival-comparison?${qs(params)}`)
  // params: {team, rival, competition}
```
`api.h2h` ya existe (F-03), se reutiliza sin cambios para el bloque de historial.

## 6. Frontend — UI

Vista: S3 · Equipo, pestaña `enfrentamiento` (ya registrada por X-01 con `enabled: false`; F-20 la habilita). Ruta:
`#/equipo/<team_code>/enfrentamiento?rival=<code>` (o sin `rival` para mostrar el selector, RF-1/RF-2).

**Componentes compartidos reutilizados** (§8 de la arquitectura): `components/metric-card.js` (fichas de la comparación de
promedios, sin ranking de competencia — `showRanking: false`, se usa solo para el formato visual valor+delta),
`components/sample-badge.js` (muestra de partidos contra el rival), `components/game-plan.js` (formato de ítem para
"diferencias más marcadas" si F-17 ya está disponible — lo está en fase 5), `core/colors.js`, `core/format.js`.

**Estados** (loading/vacío/error/offline/éxito): copiados literalmente de `spec.md` §6.

**Mobile (<768 px):** bloques apilados en una columna, sin pestañas internas adicionales (contenido compacto).

## 7. Navegación

Habilita la pestaña `enfrentamiento` de S3 · Equipo (registrada por X-01). Ruta:
`#/equipo/<team_code>/enfrentamiento[?rival=<code>][&competition=<id>]`.

## 8. Contratos de datos

### `GET /api/rival-comparison` — response 200
```json
{
  "vs_rival": {
    "efg_pct": {"value": 49.1, "reason": null}, "to_pct": {"value": 15.8, "reason": null},
    "or_pct": {"value": 26.0, "reason": null}, "ft_rate": {"value": 0.24, "reason": null},
    "oer": {"value": 1.01, "reason": null}, "der": {"value": 1.06, "reason": null},
    "net_rating": {"value": -0.05, "reason": null}, "ts_pct": {"value": 52.3, "reason": null},
    "ppt": {"value": 1.19, "reason": null}
  },
  "overall": {
    "efg_pct": {"value": 53.2, "reason": null}, "to_pct": {"value": 12.1, "reason": null},
    "or_pct": {"value": 28.4, "reason": null}, "ft_rate": {"value": 0.21, "reason": null},
    "oer": {"value": 1.08, "reason": null}, "der": {"value": 0.99, "reason": null},
    "net_rating": {"value": 0.09, "reason": null}, "ts_pct": {"value": 56.8, "reason": null},
    "ppt": {"value": 1.28, "reason": null}
  },
  "deltas": {
    "efg_pct": {"value": -4.1, "reason": null}, "to_pct": {"value": -3.7, "reason": null},
    "or_pct": {"value": -2.4, "reason": null}, "ft_rate": {"value": 0.03, "reason": null},
    "oer": {"value": -0.07, "reason": null}, "der": {"value": -0.07, "reason": null},
    "net_rating": {"value": -0.14, "reason": null}, "ts_pct": {"value": -4.5, "reason": null},
    "ppt": {"value": -0.09, "reason": null}
  },
  "top_deltas": [
    {"metric": "to_pct", "delta": -3.7, "own": 15.8, "ref": 12.1},
    {"metric": "ts_pct", "delta": -4.5, "own": 52.3, "ref": 56.8},
    {"metric": "efg_pct", "delta": -4.1, "own": 49.1, "ref": 53.2}
  ],
  "sample": {"level": "media", "unit": "partidos", "n": 4, "min": 3, "high": 10}
}
```

Filas SQLAlchemy: ninguna nueva ni tocada (F-20 no toca esquema).

## 9. Manejo de errores y offline

| Código | Situación | Mensaje |
|---|---|---|
| 400 `parametro_invalido` | falta `team`/`rival`, o `rival == team` | "Falta el equipo" / "Falta el rival" / "El rival no puede ser el mismo equipo" |
| 404 `no_encontrado` | `team`/`rival` no existen | "Equipo no encontrado" / "Rival no encontrado" |
| 401 | sin sesión | manejador existente de `api.js` |

Offline: la pestaña requiere `/api/*` (siempre a red); sin conexión, banner "Sin conexión: el historial necesita
conexión." (spec §6). Sin assets estáticos nuevos fuera de `components/rival-comparison.js`, que se agrega a `STATIC[]` de
`sw.js` con el bump de `CACHE` correspondiente (si en esta fase X-01 ya cambió a runtime caching, §3.13, el archivo se
sirve solo — sin lista `STATIC[]` que mantener a mano).

## 10. Riesgos y decisiones

- **`GET /api/rival-comparison` como endpoint nuevo, no extensión de `GET /api/h2h`**: decisión documentada en spec §9,
  respeta "un solo dueño por pieza" (F-03 es dueño de `GET /api/h2h` y de su contrato exacto; F-20 no lo modifica).
  Reportado en `huecos_arquitectura` porque la arquitectura no cataloga este endpoint explícitamente.
- **"Promedios generales" incluye los partidos contra el rival**: decisión documentada en spec §9 (consistencia con el
  resto de la app, que siempre promedia sobre el universo completo de la selección). Si el humano confirma la lectura
  alternativa (excluir al rival del promedio general), el cambio es acotado a `rival_comparison.compare` paso 2 (filtrar
  `games_all` para excluir los que coinciden con `games_vs_rival`) sin tocar ningún otro requisito.
- **Fallback de `sample.py` si T-02 no estuviera disponible**: no debería activarse en la práctica (F-20 es de fase 5,
  posterior a T-02 de fase 1), pero se documenta por si el orden de implementación real difiere del orden de fases
  propuesto.
- **Sin desviaciones respecto a la arquitectura** más allá del endpoint PROPUESTA ya reportado.
- **Dependencias técnicas**: `prepare.head_to_head`/`GET /api/h2h` (`../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md`),
  `matchups.team_matchups` (`../../fase-4-dia-de-partido/01-F-07-analizar-partido/plan.md`, para el enlace de RF-10),
  `stats_engine.compute_standard` (T-05, `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`),
  `sample.sample_level` (T-02, `../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/plan.md`), `components/game-plan.js`
  (F-17, `../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md`, para el formato de diferencias si está
  disponible).
- **Sin incrementos diferidos**: todo lo pedido por el cliente para F-20 es implementable con las dependencias ya
  declaradas, todas de fases anteriores a la 5.
