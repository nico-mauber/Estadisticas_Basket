# Plan — F-08: Plantel dentro de Equipo

> **ID:** F-08 · **Prioridad:** P1 · **Fase y orden:** 2·07
> **Depende de:** T-05 · T-01 · T-06 · X-01 (rutas relativas en spec.md §0/§2)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** spec.md de este mismo requisito · Arquitectura §3.5, §3.6, §3.11, §3.12, §6, §7
> **Estimación:** M · 5–8 h

## 1. Enfoque
Registrar una tabla T-06 nueva (`team_roster`) cuyo `builder` arma un `StatBundle` de tipo `player` por cada jugador con
minutos del equipo en el contexto activo (reusando el tipo de entidad `player` ya registrado por T-05, filtrado a un equipo)
y delega en `stats_engine.compute_standard`/`population.attach_fichas` (T-01) para el conjunto completo con percentiles. En
frontend, agregar la pestaña `plantel` de S3 con `components/data-table.js` sobre ese payload, con acciones de fila "Ver
ficha" y "Comparar", y retirar `_renderUsageRanking` de la vista Resumen de Equipo (o dejarla hasta que X-01 esté integrado,
según §9.3 del spec). Sin cambios de esquema ni de `stats_engine.py` (solo consumo de lo que T-05 ya expone).

## 2. Archivos (crear/editar)
| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/app.py` (mod., o `backend/roster.py` NUEVO si la lógica de agrupar por equipo no cabe en una ruta fina) | service/route | `team_roster_bundles(team_code, comp_id, ctx) -> list[StatBundle]` (jugadores con minutos del equipo, uno por `player_id`/nombre normalizado) | RF-1, RF-4, RF-7 |
| `backend/tables.py` (mod., de T-06) | registro | `register_table("team_roster", entity_type="player", builder=team_roster_bundles, default_columns=[...])` | RF-1, RF-3 |
| `backend/metrics_catalog.py` (consumido, de T-05) | — | tipo de entidad `player` ya registrado por T-05; F-08 solo filtra su loader por equipo | RF-1 |
| `backend/population.py` (consumido, de T-01/C-02) | — | `attach_fichas`/`ficha` para las columnas de la tabla | RF-2, RF-4 |
| `frontend/js/api.js` (mod. si T-06 no agregó `api.table` aún) | api | `api.table("team_roster", {team, competition, last, base})` | RF-1, RF-3 |
| `frontend/js/views/equipo.js` (X-01) o `app.js` si X-01 no está integrado aún | js-view | pestaña `plantel`: tabla completa + acciones de fila; retiro/condicional de `_renderUsageRanking` | RF-1..RF-9 |
| `frontend/js/components/data-table.js`, `export-menu.js`, `sample-badge.js`, `metric-card.js` (de T-06/T-02/T-01) | components | reusados sin modificar | RF-2, RF-3 |
| `frontend/js/app.js` (mod.) | js-view | retirar o condicionar `_renderUsageRanking` (línea ~1100/1292) según §9.3 del spec | RF-8 |
| `frontend/sw.js` (mod., si X-01 no migró aún a runtime caching) | cache | agrega módulo(s) nuevo(s) a `STATIC` y sube `CACHE` | — |
| `docs/api.md`, `docs/frontend.md` | doc | endpoint de tabla nuevo, pestaña Plantel, retiro de la tarjeta USO% | — (cierre) |

Matriz RF → archivo: RF-1 → `team_roster_bundles` (backend) + `tables.py`; RF-2/RF-4 → `population.py` (consumido); RF-3 →
`data-table.js`+`export-menu.js`; RF-5 → `views/equipo.js` (enlaces de fila); RF-6 → `context.py` (T-03, consumido; en fase 2
sin T-03 completo, `{competition, last}` explícitos); RF-7 → `stats_engine.compute_standard` (consumido, ya aplica C-11) +
`played(minutes)` (existente); RF-8 → `app.js` (retiro de `_renderUsageRanking`); RF-9 → `identity.py` (C-08, consumido) /
fallback por nombre.

## 3. Backend — rutas y modelos

### Endpoints
- `GET /api/table/team_roster?team=<code>&competition=<id>&last=<n>&base=<b>` — tabla T-06 con una fila por jugador del
  plantel. Response: shape §7.6 de la arquitectura, con `entity_type: "player"`, columnas = grupos del conjunto estándar
  T-05 (`games`, `minutes`, `pts`, `oer`, `efg_pct`, `ts_pct`, `ppt`, `ast`, `tov`, `ast_to`, `trb`, `or_pct`, `dr_pct`,
  `stl`, `blk`, `pf`, `uso_pct`, …), `_sample` con el badge T-02 si está disponible (si T-02 no cerró aún cuando se
  implemente F-08, `sample: null` y sin exclusión de población — degradación documentada en §10). Errores: 404
  `{"error": "Equipo no encontrado", "code": "no_encontrado"}` si el `team_code` no tiene partidos.
- `GET /api/players/<team_code>` (legado, mod. por C-08 fuera de este plan): F-08 no lo modifica; si C-08 aún no agregó
  `player_id`, la tabla nueva sigue funcionando con nombre normalizado como identificador de fila.

### Tablas/columnas
Sin cambios de esquema (F-08 no está en `§5 Cambios de esquema previstos` de la arquitectura).

## 4. Backend — lógica

```
# backend/app.py o backend/roster.py (NUEVO si la ruta queda gorda)
def team_roster_bundles(team_code: str, comp_id: int | None, ctx: "Context") -> list[StatBundle]:
    """
    1. rows = repository.player_game_rows(comp_id) filtradas por team_code y ctx (competencia, last;
       T-03 cuando esté disponible) — o, si repository.py (F-11) no está integrado aún, la consulta
       directa que ya usa team_players() (PlayerGameStats.query.filter_by(team_code=...)).
    2. Agrupar por identidad: norm_name(player_name) (o player_id si C-08 ya persiste la tabla `players`).
    3. Para cada jugador: played_rows = [r for r in rows if played(r.minutes)] (C-11/Feature 12: DNP fuera).
       Si played_rows está vacío, el jugador NO entra a la tabla (no jugó minutos en la selección).
    4. Arma StatBundle(entity_type="player", entity_id=<player_id o nombre>, name=<grafía resuelta>,
       own=<RAW_KEYS sumados de played_rows>, opp=<agregado del rival correspondiente por partido>,
       team=<conteos del equipo en esos partidos>, games=len(played_rows), minutes=Σ minutos,
       team_minutes=Σ minutos de equipo, on_court=None (F-08 no calcula on-court; eso es T-05 base),
       shots=None, possessions_counted=None, null_reasons={}).
    5. Devuelve list[StatBundle], una por jugador con minutos.
    """
```

Manejo de nulos (C-11): jugador sin ningún triple intentado → `fg3_pct`/`ppt_3`/`fg3_uso` nulos `sin_intentos` (heredado de
`compute_standard`, sin lógica propia de F-08). Caché: reusa el namespace `pop:player` (T-01) para las fichas y, si
`repository.py`/`cache.py` (F-11) están disponibles, `cache.memo("roster:<team>", (comp_id, ctx_key), fn)`; si no,
sin caché explícita (la ruta ya es liviana: un query por equipo).

## 5. Frontend — capa API (api.js)
```js
api.table = (tableId, params) => apiFetch(`/api/table/${tableId}${qs(params)}`);   // de T-06, F-08 lo reusa
```
`qs()` es de T-05; F-08 no crea métodos nuevos en `api.js` (la tabla usa el genérico `api.table`).

## 6. Frontend — UI
Pestaña `plantel` de S3 (`#/equipo/<code>/plantel`). Si X-01 aún no integró el router cuando se implemente F-08 (caso
excepcional dado que F-08 es fase 2 y X-01 es 2·01), la tabla vive en una sección propia dentro de `renderTeam`, junto a
donde hoy está `_renderUsageRanking`.

- **Tabla del plantel**: `components/data-table.js` sobre `api.table("team_roster", {team, competition, last, base})` +
  `export-menu.js`. Cada fila agrega dos acciones: "Ver ficha" (navega a `#/jugador/<player_id o nombre>/resumen`) y un
  checkbox "Comparar" (acumula hasta 2 seleccionados; botón flotante "Comparar seleccionados (N)" navega a
  `#/comparar/jugadores?a=<id1>&b=<id2>`, deshabilitado con &gt;2 marcados — spec §9.2).
- Estados loading/vacío/error/offline/éxito: tabla §6 de spec.md.
- Mobile 768px: tabla con scroll horizontal y columna `_name` sticky (ya resuelto por `data-table.js`, T-06); acciones de
  fila colapsadas en un menú de tres puntos.
- Retiro de `_renderUsageRanking`: si X-01 ya integró la pestaña, se elimina la llamada en la línea ~1292 de `app.js` y la
  función queda sin uso (se borra o se deja comentada con referencia a este plan, decisión del implementador); si X-01 no
  integró aún, se deja intacta hasta que X-01 cierre (spec §9.3, INCREMENTO DIFERIDO).

Componentes compartidos reusados: `data-table.js`, `export-menu.js`, `exporters.js`, `sample-badge.js` (T-02, si
disponible), `metric-card.js` (T-01, para el detalle expandido de una celda si el componente lo ofrece), `base-selector.js`
(T-04, si disponible).

## 7. Navegación
Pestaña `plantel` dentro de S3 `equipo` (registrada en `core/router.js` por X-01; F-08 llama
`router.registerTab("equipo", {slug: "plantel", label: "Plantel", enabled: true, render: renderPlantelTab})`).

## 8. Contratos de datos
Shape: `/api/table/team_roster` → §7.6 de la arquitectura (idéntico shape que cualquier otra tabla T-06; `entity_type:
"player"`). Sin contrato propio adicional.

## 9. Manejo de errores y offline
| Código | Caso | Mensaje es |
|---|---|---|
| 404 | equipo sin partidos | "Equipo no encontrado" |
| 200 con `rows: []` | equipo sin jugadores con minutos en la selección | "Este equipo no tiene jugadores con minutos en la selección." (no es error HTTP) |

`sw.js`: si X-01 todavía no migró a runtime caching, F-08 no agrega módulos nuevos propios (reusa `data-table.js` ya
cacheado por T-06); si agrega algún archivo propio, sube `CACHE` en 1.

## 10. Riesgos y decisiones
- **Riesgo:** si F-08 se implementa antes que T-02, la tabla no puede excluir jugadores de muestra baja del promedio de
  competencia ni mostrar el badge. Mitigación: `sample: null` en cada fila hasta que T-02 esté disponible; la tabla sigue
  siendo útil (valores + percentiles de T-01, que solo depende de la población mínima de minutos, no de T-02 para
  jugadores). Se documenta como degradación temporal, no como hueco de arquitectura.
- **Desviación respecto de la arquitectura:** ninguna. La tabla `team_roster` ya está listada en el catálogo de ids de
  tabla de la arquitectura §6 ("Ids de tablas … `team_roster` (F-08)"), así que no hay huecos que reportar.
- **Dependencias técnicas:** `stats_engine.compute_standard`/`StatBundle` (T-05,
  `../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md`); `population.attach_fichas`/`ficha` (T-01,
  `../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/plan.md`); `tables.register_table`/`build_table` y
  `components/data-table.js`/`export-menu.js` (T-06, `../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md`);
  pestaña y router (X-01, `../01-X-01-reorganizacion-navegacion/plan.md`); `norm_name`/`resolve_identity`/`player_id`
  (C-08, `../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/plan.md`, opcional); destino de comparar (F-05,
  `../08-F-05-comparar-jugadores/plan.md`).
- **Estimación:** M · 5–8 h (backend `team_roster_bundles` + registro de tabla 2–3 h; frontend pestaña + acciones de fila
  1,5–3 h; retiro/condicional de `_renderUsageRanking` + verificación manual y docs 1,5–2 h).
