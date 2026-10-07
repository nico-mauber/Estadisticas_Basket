# Plan — C-03: Mapas de tiro: PPT y detalle por zona

> **ID:** C-03 · **Prioridad:** P1 · **Fase y orden:** 1·17
> **Depende de:** C-07 — [`../10-C-07-detalle-tiro-completo/plan.md`](../10-C-07-detalle-tiro-completo/plan.md) · T-01 — [`../15-T-01-ficha-de-metrica/plan.md`](../15-T-01-ficha-de-metrica/plan.md) · T-02 — [`../14-T-02-confiabilidad-muestra/plan.md`](../14-T-02-confiabilidad-muestra/plan.md)
> **Habilita:** A-05, F-07, A-09
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** [spec.md](spec.md) · Especificación v2 §2 · C-03 · Arquitectura §1.5, §1.6, §2.2, §3.5, §3.6, §3.7, §4, §6, §8
> **Estimación:** L · 12–18 h

## 1. Enfoque

C-03 crea `backend/shot_zones.py` (dueño según Arquitectura §4), que absorbe `_classify_zone_11`/`ZONE_KEYS_11`/
`ZONE_POINTS`/`_zones_from_shots` movidos desde `app.py` (hoy viven ahí pese a la regla 3 de la Constitución) y les
agrega `share` (peso sobre el total del contexto), `percentile` (delegado en `population.ficha()` de T-01, tipo de
entidad `zone`) y `sample` (delegado en `sample.sample_level()` de T-02, unidad "intentos"). El endpoint nuevo
`GET /api/shot-zones` expone ese payload completo; las rutas legado `GET /api/shots/...` pasan a llamar internamente
a `shot_zones.zone_table(...)` y agregan `share` a su shape actual sin quitar nada, para no romper consumidores que
no migren en este mismo cambio. El frontend reemplaza el texto estático de `_scLbl` por una etiqueta reducida (FG%,
eFG%, PPT, sin cambio de fórmula) más un manejador de hover/tap que abre un tooltip (desktop) o una hoja inferior
(≤768 px) con los 7 datos, construido en el componente compartido `components/shot-chart.js` (dueño C-03 según
Arquitectura §8), que además reemplaza `_scBoxFill` (umbrales fijos) por `percentileColor()` de T-01. Las fórmulas de
zona (FG%, eFG%, PPT) no cambian: se mueven de módulo, no de lógica.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/shot_zones.py` | módulo (NUEVO) | `ZONE_KEYS_11`, `ZONE_POINTS`, `_2PT_ZONES`/`_3PT_ZONES` (movidas de `app.py`); `to_half_court(court_x, court_y) -> tuple[float, float]` (identidad si F-11 ya entrega media cancha, ver plan §10 D-1); `classify_zone(action_type, sub_type, court_x, court_y, qualifiers=None) -> str` (renombre de `_classify_zone_11`, con umbrales ajustados a la geometría de media cancha real cuando `has_coordinates`); `zone_table(shots, *, context_totals=None) -> dict` (reemplaza `_zones_from_shots`, agrega `share`); `zones_with_stats(entity_type, entity_id, comp_id, ctx) -> dict` (arma `zone_table` + adjunta `percentile`/`sample` por zona vía T-01/T-02) | RF-1, RF-3, RF-5, RF-6, RF-7, RF-8, RF-10 |
| `backend/app.py` | ruta (mod.) | Retira `ZONE_KEYS_11`/`ZONE_POINTS`/`_classify_zone_11`/`_zones_from_shots` (se importan de `shot_zones`); ruta NUEVA `GET /api/shot-zones`; `player_shots`/`team_shots` delegan en `shot_zones.zones_with_stats` y agregan `share` a su shape actual | RF-2, RF-4, RF-5, RF-7 |
| `frontend/js/components/shot-chart.js` | js-component (NUEVO) | `shotChart(zonesPayload, {mode: 11\|3, colorBy: "percentile"}) -> string` (SVG, movido de `_shotChart11SVG`/`_shotChart3SVG`/`_courtLinesSVG`/`_scSvgWrap` de `app.js`); `bindZoneTooltips(el, zonesPayload)` (hover desktop / tap móvil, arma y posiciona el tooltip o la hoja inferior con los 7 datos) | RF-2, RF-3, RF-6, RF-9 |
| `frontend/js/app.js` | vista (mod.) | Retira `_shotChart11SVG`/`_shotChart3SVG`/`_courtLinesSVG`/`_scSvgWrap`/`_scLbl`/`_scBadge`/`_scBoxFill` (se mueven a `shot-chart.js`); las 3 vistas que dibujan mapas (`renderTeamShotmap`, shot chart de jugador dentro de Equipo, shot chart de Jugador) pasan a llamar `shotChart(...)` + `bindZoneTooltips(...)` con el payload de `GET /api/shot-zones` | RF-1, RF-2, RF-3, RF-9 |
| `frontend/js/api.js` | js-api | `api.shotZones(params)` (`GET /api/shot-zones` + `qs(params)`); `api.playerShots`/`api.teamShots` sin cambio de firma (siguen apuntando a las rutas legado hasta que las 3 vistas migren) | RF-2, RF-4 |
| `frontend/css/style.css` | css | Sección `/* ── shot-chart tooltip (C-03) ── */` (tooltip flotante desktop, hoja inferior móvil, estado "sin tiros registrados") | RF-2, RF-3 |
| `frontend/sw.js` | sw | Agregar `js/components/shot-chart.js` a `STATIC` y subir `CACHE` al siguiente entero | RF-2 |
| `docs/api.md` | doc (cierre) | `GET /api/shot-zones` (NUEVO), `GET /api/shots/...` (+ `share`), fórmulas de zona documentadas junto al endpoint | RF-2, RF-4, RF-5, RF-10 |
| `docs/architecture.md` | doc (cierre) | `shot_zones.py` en el mapa de capas (reemplaza la nota de que la lógica de zonas vive en `app.py`) | RF-8 |
| `docs/frontend.md` | doc (cierre) | `components/shot-chart.js`, tooltip de 7 datos, estados de §6 del spec | RF-2, RF-3, RF-9 |
| `docs/metrics.md` | doc (cierre) | Confirmar que FG%/eFG%/PPT de zona no cambiaron (RF-10, nota de no-regresión) | RF-10 |

**Matriz RF → archivo:** RF-1 shot_zones.py/app.js (no-regresión, ya cumplido) · RF-2 shot_zones.py/app.py/shot-chart.js/api.js ·
RF-3 shot_zones.py/shot-chart.js/css · RF-4 shot_zones.py/app.py/api.js · RF-5 shot_zones.py · RF-6 shot_zones.py/
shot-chart.js · RF-7 shot_zones.py · RF-8 shot_zones.py (geometría, ver §10 D-1) · RF-9 shot-chart.js/app.js ·
RF-10 shot_zones.py (no-regresión de fórmulas). Sin RF huérfanos.

## 3. Backend — rutas y modelos

### 3.1 Esquema
Sin cambios de esquema (Arquitectura §5: "Sin cambios de esquema: … C-03 …"; `shots.court_x`/`court_y` son de F-11).

### 3.2 Endpoints

**GET `/api/shot-zones`** (NUEVO · `login_required`)

Query: `entity` (`team` | `player`, obligatorio), `id` (`team_code` o `player_id`/nombre legado, obligatorio),
`competition` (opcional, resuelto con `repository.resolve_competition` de F-11), `last` (entero opcional, últimos N
partidos).

Response 200:
```json
{
  "zones": {
    "restricted_area": {
      "made": 14, "attempts": 20, "fg_pct": 0.70, "efg_pct": 0.70, "ppt": 1.40,
      "share": 0.256, "percentile": 78, "sample": {"level": "alta", "unit": "intentos", "n": 20, "min": 10, "high": 30}
    },
    "left_corner_3": {
      "made": 0, "attempts": 0, "fg_pct": null, "efg_pct": null, "ppt": null,
      "share": 0.0, "percentile": null, "sample": {"level": "baja", "unit": "intentos", "n": 0, "min": 10, "high": 30}
    }
  },
  "summary": {"ppt": 1.08, "efg_pct": 0.52, "ppp": 1.02, "games": 12, "total_shots": 78},
  "has_coordinates": true,
  "context": {"competition": {"id": 3, "label": "Liga Uruguaya de Básquetbol 2025/2026"}, "applied": {"last": 5}}
}
```
Una zona con `attempts: 0` trae `fg_pct`/`efg_pct`/`ppt`/`percentile` en `null` (C-11); nunca `0`. `percentile: null`
también cuando la población de referencia es insuficiente (razón se agrega como `percentile_reason` cuando aplica:
`sin_intentos` | `sin_universo` | `poblacion_insuficiente`, formato §7.4 de la arquitectura).

Errores (formato §7.8): 400 `parametro_invalido` `"El parámetro entity debe ser 'team' o 'player'"` (**NUEVO**) · 404
`no_encontrado` `"Equipo no encontrado"` / `"Jugador no encontrado"` (según `entity`) · 400 `competencia_inexistente`
(resolución compartida F-11).

**GET `/api/shots/<team_code>`** · **GET `/api/shots/<team_code>/<player_name>`** (modificados · `login_required`)

Delegan internamente en `shot_zones.zones_with_stats("team"|"player", ...)` reusando el mismo cálculo; shape actual
(`zones{11}`, `total_shots`, `has_coordinates`, `summary`) **+ `share` por zona** (campo nuevo, el resto sin cambio).
Sin cambio de query ni de errores existentes.

Sin cambios de esquema.

## 4. Backend — lógica

**`backend/shot_zones.py`** (módulo nuevo; contenido movido + agregado):

```python
ZONE_KEYS_11 = [...]      # movido literal de app.py, sin cambios
ZONE_POINTS = {...}       # movido literal
_2PT_ZONES = {...}; _3PT_ZONES = {...}   # movidos literales

def to_half_court(court_x: float, court_y: float) -> tuple[float, float]:
    """Coordenadas ya transformadas a media cancha por F-11 (Arquitectura §1.6).
    Si F-11 todavía entrega crudas (0-100 de cancha completa) por no estar integrado,
    aplica la fórmula de la arquitectura como fallback (ver plan §10 D-1)."""
    ...

def classify_zone(action_type: str, sub_type: str, court_x: float | None, court_y: float | None,
                   qualifiers: str | None = None) -> str:
    """Renombre de `_classify_zone_11`; misma lógica de palabras clave de pintura y
    umbrales por cuadrante, ajustados a la geometría de media cancha real (D-07)."""
    ...   # cuerpo idéntico al `_classify_zone_11` actual mientras `has_coordinates`
          # siga siendo falso en la práctica (F-11 no integrado); ver riesgo D-2

def zone_table(shots: list, *, context_totals: dict | None = None) -> dict:
    """Reemplaza `_zones_from_shots`: agrupa `shots` en las 11 zonas + totales.
    Fórmulas SIN CAMBIO (RF-10): pct = made/attempts; ppt = made*ZONE_POINTS[z]/attempts;
    efg = made*factor/attempts (factor 1.5 en zonas de 3, 1.0 en zonas de 2).
    Agrega `share = attempts_zona / total_fga_del_mismo_contexto` (o `context_totals["total_fga"]`
    si se pasa explícito, para que el share se calcule sobre el mismo universo que el resto
    del payload incluso si `shots` ya viene pre-filtrado por contexto)."""
    ...

def zones_with_stats(entity_type: str, entity_id: str, comp_id: int | None, ctx) -> dict:
    """Arma zone_table(...) y adjunta percentile/sample por zona:
    - population.ficha('zone_' + zone_key + '_ppt', ppt_zona, entity_id, pop) -> {percentile, reason}
      (pop viene de population.population('zone', comp_id, ctx) filtrado a esa zona — ver §10 D-3
      sobre cómo T-01 expone poblaciones por zona)
    - sample.sample_level('clock_zone', n=attempts, unit='intentos') -> badge (T-02, clave
      sample.clock_zone.min/.high de CONFIG_SPEC)
    Sin universo (T-01 no disponible aún) -> percentile: null, reason: 'sin_universo' (degradación
    explícita, nunca bloquea la respuesta)."""
    ...
```

Entradas: `shots` = lista de `Shot` (o dicts equivalentes) ya filtrados por `team_code`/`player_name` y por contexto
(`competition`/`last`) antes de llamar a `zone_table`. `context_totals` permite pasar el total de intentos del mismo
filtro para que `share` no se recalcule dos veces.

Manejo de nulos (C-11): sin cambio de criterio — `attempts == 0` → `fg_pct`/`efg_pct`/`ppt`/`percentile` en `None`
con razón cuando aplica; nunca `0`/`0.00`. Caso borde nuevo: `share` de una zona sin intentos es `0.0` (es una
proporción real, no un dato faltante — "0% de los tiros" es correcto, a diferencia de "0% de acierto").

Caché: sin caché propia — `zones_with_stats` delega en `population.population()` (T-01), que sí está cacheada por
`(entity_type, comp_id, ctx_key)` según Arquitectura §3.6; el cálculo de zonas en sí (agrupar `Shot`) es barato
(≤ algunos cientos de filas por entidad) y no lo necesita.

**Rutas en `app.py`:**
```python
@app.route("/api/shot-zones")
@login_required
def shot_zones_route():
    entity = request.args.get("entity")
    if entity not in ("team", "player"):
        return jsonify({"error": "El parámetro entity debe ser 'team' o 'player'",
                         "code": "parametro_invalido"}), 400
    entity_id = request.args.get("id", "")
    # resolver equipo/jugador -> 404 si no existe (mismo patrón que las rutas legado)
    # resolver competencia con competitions.resolve (F-11) -> 400 competencia_inexistente
    # filtrar Shot por team_code (+ player_name si entity == "player") y por competencia/last
    payload = shot_zones.zones_with_stats(entity, entity_id, comp_id, ctx)
    return jsonify(payload)
```
`player_shots`/`team_shots` (existentes) se editan para llamar a `shot_zones.zones_with_stats(...)` en vez de
`_zones_from_shots(...)` y agregar `zones[k]["share"]` a cada zona antes de devolver el shape actual (sin tocar
`total_shots`/`has_coordinates`/`summary`).

## 5. Frontend — capa API (`api.js`)

| Método | Endpoint | Notas |
|---|---|---|
| `api.shotZones(params)` | `GET /api/shot-zones` + `qs(params)` (NUEVO) | `params = {entity, id, competition, last}` |
| `api.teamShots(code)` · `api.playerShots(team, name)` | sin cambio | siguen apuntando a `GET /api/shots/...`; se usan mientras las 3 vistas no migren a `shotZones` |

## 6. Frontend — UI

Ubicación: pestaña Tiro de Equipo (S3, hoy dentro de la sección `team` existente) y pestaña Tiro de Jugador (S4, hoy
`player`); X-01 (fase 2) las reubica en pestañas sin tocar el componente.

`components/shot-chart.js` (nuevo, dueño C-03 según Arquitectura §8):
- `shotChart(zonesPayload, {mode, colorBy})`: SVG movido literal de `_shotChart11SVG`/`_shotChart3SVG`/
  `_courtLinesSVG`/`_scSvgWrap`; cada caja de zona (antes `_scLbl`) reduce su contenido visible a FG%/eFG%/PPT (sin
  el peso ni el detalle completo, que pasan al tooltip) y agrega `data-zone="<key>"` para que `bindZoneTooltips`
  pueda engancharse; el color de fondo de la caja usa `percentileColor(zone.percentile)` de `core/colors.js` (T-01)
  en vez de `_scBoxFill` (RF-6); sin percentil (`null`) → color neutro (gris), no rojo/verde. Zona con
  `attempts === 0` → caja con fondo neutro y texto "Sin tiros registrados" en vez de FG%/eFG%/PPT (RF-3).
- `bindZoneTooltips(el, zonesPayload)`: en desktop, `mouseenter`/`mouseleave` sobre cada `[data-zone]` abren/cierran
  un tooltip flotante posicionado junto al cursor (con lógica de "no salirse del viewport"); en pantallas ≤768 px,
  `click`/`touchstart` abre una hoja inferior fija (mismo patrón que otros modales existentes de la app) con los 7
  datos y un botón de cerrar; un segundo tap en la misma zona la cierra. Contenido del tooltip/hoja: `"{made}/
  {attempts}"`, `"FG% {fg}"`, `"eFG% {efg}"`, `"PPT {ppt}"`, `"{share}% de los tiros"`, `"Percentil {p}"` (o `"Sin
  datos de percentil"` si `null`), badge de muestra (`sample-badge.js` de T-02, si `sample.level !== "alta"`). Zona
  sin intentos: solo `"Sin tiros registrados en esta zona."`.
- Reemplaza las llamadas de `app.js` a `_shotChartSVG(...)` por `shotChart(zonesPayload, {mode, colorBy:
  "percentile"})` + `bindZoneTooltips(...)`, alimentadas por `api.shotZones({entity, id, competition, last})` en vez
  de `api.teamShots`/`api.playerShots` (las 3 vistas migran: mapa agregado de equipo, shot chart de jugador dentro
  de Equipo, shot chart de Jugador).

Componentes compartidos reutilizados: `nullDisplay` (C-11; sin `t()`, DA-21 resuelta: copy en español directo), `sample-badge.js` (T-02, si ya existe en el
momento de implementar; si T-02 aún no lo publicó, C-03 arma un badge mínimo local con el mismo shape y lo reemplaza
cuando T-02 esté disponible — ver riesgo §10), `.modal`/patrón de hoja inferior existente.

Estados: ver §6 del spec (loading/vacío/error/sin conexión/éxito). Mobile 768 px: el tooltip nunca se activa por
hover en pantallas táctiles (se detecta con `matchMedia("(hover: hover)")` o el mismo patrón que ya use la app para
otros tooltips); la hoja inferior ocupa el ancho completo con márgenes de 16 px.

## 7. Navegación
Sin vistas ni hashes nuevos (el routing por hash llega con X-01). El mapa vive en las pestañas Tiro existentes.

## 8. Contratos (shapes)
Ver §3.2 (response completa de `/api/shot-zones` y el campo `share` agregado a las rutas legado).

## 9. Errores y offline
| Código | Cuándo | Mensaje |
|---|---|---|
| 400 | `entity` ausente o distinto de `team`/`player` | `"El parámetro entity debe ser 'team' o 'player'"` |
| 404 | equipo/jugador inexistente | `"Equipo no encontrado"` / `"Jugador no encontrado"` (existente) |
| 400 | competencia inexistente | delegado a `competitions.resolve` (F-11) |

Offline: `/api/*` a red siempre; sin conexión, el error de red existente de `api.js` cubre el mapa (sin cambio).
`sw.js`: `js/components/shot-chart.js` nuevo en `STATIC`, `CACHE` al siguiente entero.

## 10. Riesgos y decisiones

- **D-1 · Geometría sin F-11 integrado.** Si al implementar C-03 las coordenadas reales de F-11 (`shots.court_x`/
  `court_y`, DA-32) todavía no están disponibles, `to_half_court` es la identidad y `classify_zone` opera igual que
  hoy (`has_coord = x != 0 or y != 0`, siempre falso en la práctica → zonas por defecto `top_key_3`/`mid_top`). El
  mapa de 11 zonas queda visualmente degradado a datos concentrados en pocas cajas, comportamiento **idéntico al
  actual, sin regresión**; se documenta como deuda en `progress.md` hasta que F-11 esté integrado y C-03 se
  re-verifique con coordenadas reales.
- **D-2 · Ajuste de umbrales D-07 pendiente de datos reales.** Corregir los umbrales de `classify_zone` a la
  geometría real de cancha completa transformada (D-07) requiere tiros con coordenadas reales para calibrar los
  cortes (hoy los umbrales de `_classify_zone_11` fueron ajustados a mano contra el SVG, sin datos reales). Mientras
  F-11 no reprocese el seed con coordenadas reales, C-03 mantiene los umbrales actuales sin cambios (no hay forma de
  verificar una corrección sin datos reales) y lo registra como **PROPUESTA (no está en
  00-arquitectura-transversal.md)**: recalibrar `classify_zone` en cuanto el seed tenga coordenadas reales, incluso
  si eso ocurre después del cierre formal de C-03.
- **D-3 · Población de zona en `population.py` (T-01).** La arquitectura no detalla cómo `population()` expone
  poblaciones filtradas a una sola zona de tiro (T-05 solo registra el tipo de entidad `zone` como responsabilidad
  de C-03, sin especificar su `StatBundle`). Se adopta: C-03 registra `zone` como tipo de entidad ante
  `metrics_catalog.register_entity` (Arquitectura §3.5) con un loader que arma un `StatBundle` por zona (PPT de esa
  zona como métrica única relevante) y reusa `population.population("zone", ...)`/`ficha(...)` de T-01 sin pedirle
  cambios a su contrato. Se marca **PROPUESTA** y se reporta en `huecos_arquitectura`.
- **D-4 · Badge de muestra sin T-02 integrado.** Si T-02 (`sample.py`) todavía no existe en la rama de trabajo al
  implementar C-03 (aunque el orden de fase lo pone antes, orden 14 vs. 17), C-03 arma un badge local mínimo
  (`{level: attempts < 10 ? "baja" : attempts < 30 ? "media" : "alta", unit: "intentos", n: attempts}`, mismos
  umbrales que `sample.clock_zone.min`/`.high` de la arquitectura) y lo reemplaza por `sample.sample_level(...)` en
  cuanto T-02 esté disponible, sin cambiar el shape expuesto al frontend.
- **Desviaciones respecto de la arquitectura:** ninguna de contrato de endpoint o componente (`GET /api/shot-zones`
  y `components/shot-chart.js` están fijados como dueño C-03 en §6 y §8). Se agregan como PROPUESTA: la función
  `zones_with_stats`, el registro del tipo de entidad `zone` con su `StatBundle` (D-3), y el fallback local de
  badge de muestra (D-4, temporal).
- **Dependencias técnicas:** C-07 → shape de `summary`/detalle de tiro que C-03 no toca
  ([`../10-C-07-detalle-tiro-completo/plan.md`](../10-C-07-detalle-tiro-completo/plan.md)); T-01 → `population.py`
  (`population()`, `ficha()`, `percentileColor()` de `core/colors.js`)
  ([`../15-T-01-ficha-de-metrica/plan.md`](../15-T-01-ficha-de-metrica/plan.md)); T-02 → `sample.py`
  (`sample_level()`, `components/sample-badge.js`)
  ([`../14-T-02-confiabilidad-muestra/plan.md`](../14-T-02-confiabilidad-muestra/plan.md)); F-11 → coordenadas
  reales (`shots.court_x/court_y`), `repository.resolve_competition`
  ([`../02-F-11-calidad-datos-competencias/plan.md`](../02-F-11-calidad-datos-competencias/plan.md)).
- **Incremento diferido:** respetar la barra de contexto completa (sede, rival, cuarto, marcador, tramo de reloj) —
  se habilita con T-03
  ([`../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/`](../../fase-2-contexto-comparabilidad/02-T-03-selector-global-contexto/));
  matriz zona × tramo de reloj — se habilita con A-06
  ([`../../fase-5-analitica-exploracion/07-A-06-contextos-cruzados/`](../../fase-5-analitica-exploracion/07-A-06-contextos-cruzados/));
  exportación del mapa — T-06; recalibración de `classify_zone` con coordenadas reales — se habilita cuando F-11
  reprocese el seed (D-2, no tiene ID de requisito propio, queda registrado como deuda de C-03).
- **Estimación: L · 12–18 h** (`shot_zones.py` movido + `share`/`zones_with_stats`: 3 h; endpoint nuevo + rutas
  legado con delegación: 2 h; `shot-chart.js` movido + tooltip/hoja con 7 datos: 4–5 h; color por percentil +
  integración T-01/T-02 (o fallbacks D-3/D-4): 2–3 h; estados vacíos + CSS + mobile: 1–2 h; docs + verificación:
  1–2 h).
