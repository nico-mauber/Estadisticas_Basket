# Plan — Feature 16: detalle de tiro completo y PPT

> Spec: `sdd/specs/16-tiro-completo-ppt/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

C-03 es un **renombre más un agregado**: `pf` ya es PPT (spec §9), así que el backend solo cambia el
nombre de la clave y suma `efg` por zona; el frontend cambia dos textos y agrega un tercer valor a la
etiqueta de zona, lo que sí requiere rehacer su layout SVG (hoy caben tres textos, hacen falta cuatro).

C-07 es puro agregado: los conteos crudos ya viajan en la respuesta; faltan los tres PPT desglosados
y los totales de temporada, más las cards que los muestren.

Sin esquema, sin dependencias, sin endpoints nuevos.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/app.py` | route | `_zones_from_shots`: `pf` → `ppt` y `efg` por zona | RF-1, RF-4 |
| `backend/app.py` | route | `player_shots`/`team_shots`: `summary.global_pf` → `summary.ppt` | RF-2 |
| `backend/stats_engine.py` | service | `ppt_2`, `ppt_3`, `ppt_ft` en equipo y jugador | RF-6, RF-7 |
| `backend/app.py` | route | `team_stats`/`player_stats`: bloque `totals` de temporada | RF-5 |
| `frontend/js/app.js` | js-view | `_scLbl`: 4 valores por zona; layout de la caja | RF-1, RF-2 |
| `frontend/js/app.js` | js-view | `_scBadge`: `P/F` → `PPT` | RF-2 |
| `frontend/js/app.js` | js-view | Card "Tiro" de jugador y de equipo: T2i/T2c/…/TLc + 4 PPT | RF-5, RF-6, RF-8 |
| `docs/metrics.md` | doc | Los tres PPT desglosados; eFG% por zona (Paso 4) | RF-4, RF-6 |
| `docs/api.md` | doc | `ppt`/`efg` por zona, `summary.ppt`, `totals` (Paso 4) | RF-1, RF-5 |
| `docs/frontend.md` | doc | Etiquetas nuevas; el mapa ya no dice `P/F` (Paso 4) | RF-2, RF-5 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ · RF-3 ✔ (mismos helpers sirven a ambos modos) · RF-4 ✔ ·
RF-5 ✔ · RF-6 ✔ · RF-7 ✔ (vía `_safe_div`) · RF-8 ✔

## 3. Backend — rutas y modelos

**Sin tabla, columna ni endpoint nuevo.** Sin `upgrade_db()`.

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/shots/<code>` y `.../<player>` | `zones[].pf` → `zones[].ppt`; `zones[].efg` **nuevo**; `summary.global_pf` → `summary.ppt` | sin cambio |
| `GET /api/team/<code>`, `GET /api/player/<t>/<n>` | `averages` suma `ppt_2`, `ppt_3`, `ppt_ft`; bloque `totals` **nuevo** con los seis conteos acumulados | sin cambio |

## 4. Backend — lógica

| Función | Módulo | Fórmula exacta | RF |
|---|---|---|---|
| `_zones_from_shots` | `app.py` | `ppt = convertidos × ZONE_POINTS[k] / intentos` (sin cambio, solo el nombre). `efg = convertidos × factor / intentos`, con `factor = 1.0` si `ZONE_POINTS[k] == 2` y `1.5` si `== 3` | RF-1, RF-4 |
| `calc_team_stats` / `calc_player_stats` | `stats_engine.py` | `ppt_2 = (2 × FGM2) / FGA2` · `ppt_3 = (3 × FGM3) / FGA3` · `ppt_ft = FTM / FTA`. Vía `_safe_div` → `null` con denominador 0 | RF-6, RF-7 |
| `team_stats` / `player_stats` | `app.py` | `totals` = suma de `fga2`, `fgm2`, `fga3`, `fgm3`, `fta`, `ftm` sobre los partidos de la población vigente (jugados, excluyendo DNP — Feature 12) | RF-5 |

El **PPT general** ya existe como `pps` (`PTS / FGA`), idéntico a la definición de `docs/metrics.md`.
No se agrega una clave nueva: se muestra `pps` bajo la etiqueta `PPT`, como ya hace el perfil.

## 5. Frontend — capa API (api.js)

**Sin cambios.**

## 6. Frontend — UI (app.js)

**`_scBadge`** — el texto `P/F` pasa a `PPT`. La caja de `eFG%` no cambia. Cambio de una línea.

**`_scLbl`** — hoy dibuja tres textos sobre una caja de 54×33: `share%` (arriba izq.), `P/F {v}`
(arriba der.) y `fg%` (grande, centrado). Hacen falta **cuatro** valores. Distribución elegida:

```
┌──────────────────┐
│ 23%        1,20  │   ← share% (izq) · PPT (der)
│      45,0%       │   ← % de acierto, grande y centrado (sin cambios)
│      eFG 60,0%   │   ← eFG% de la zona (línea nueva)
└──────────────────┘
```

La caja crece de 33 a ~44px de alto para alojar la línea nueva. El `%` de acierto conserva su
jerarquía visual: es el dato que se lee de un vistazo.

**Card "Tiro"** (jugador y equipo) — se agregan, reusando `statBox`:

| Etiqueta | Contenido |
|---|---|
| `T2i` / `T2c` | promedio por partido, con el total de temporada como contexto |
| `T3i` / `T3c` | ídem |
| `TLi` / `TLc` | ídem |
| `PPT` | `pps` (general, ya existente) |
| `PPT 2` / `PPT 3` / `PPT TL` | claves nuevas |

Mobile-first: la card "Tiro" pasa de 5 a ~13 stats; `.stat-grid` ya hace wrap. Verificar a 390px.

## 7. Navegación

Sin vistas ni hashes nuevos.

## 8. Contratos de datos

```
GET /api/shots/<code>[/<player>]
  zones[k] = { made, attempts, pct, ppt, efg }     // `pf` ELIMINADA, `ppt`/`efg` nuevas
  summary  = { ppt, efg_pct, ppp, games }          // `global_pf` ELIMINADA

GET /api/team/<code>  ·  GET /api/player/<t>/<n>
  averages.{ppt_2, ppt_3, ppt_ft}                  // NUEVAS, pueden ser null
  totals = { fga2, fgm2, fga3, fgm3, fta, ftm }    // NUEVO
```

Sin filas SQLAlchemy nuevas ni modificadas.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos.

**Casos borde**: zona con 0 intentos → no se dibuja (comportamiento actual). Jugador sin triples en la
temporada → `ppt_3` y `totals.fga3 = 0`, con `PPT 3` en `"—"` (RF-7) y el total en `0` real.

**Service worker**: sin assets nuevos.

## 10. Riesgos / decisiones

**D-1 · `pf` se elimina del contrato en vez de mantenerse como alias.**
Es un cambio incompatible para cualquier consumidor externo. Se asume: el único consumidor es el
frontend de este repo, y mantener las dos claves perpetuaría el nombre que C-03 quiere eliminar. El CA
del cliente es explícito: *"Ninguna etiqueta del mapa de tiro muestra 'P/F'"*.

**D-2 · La etiqueta de zona crece un 33% en alto.**
Cuatro valores no entran en la caja actual. El riesgo es solapamiento entre zonas contiguas del modo
11 zonas, donde las cajas están cerca. Se verifica en el Paso 4 con el mapa real; si se solapan, la
alternativa es mostrar el eFG% solo en el modo de 3 zonas, donde sobra espacio — y registrarlo.

**D-3 · En zonas de 2 puntos, eFG% == FG%.**
Matemáticamente inevitable (factor 1.0). Seis de las once zonas mostrarán dos números idénticos. No es
un error: es lo que pide C-03, y hace visible que el diferencial del eFG% viene solo del triple.
Vale la pena confirmarlo con el cliente si le resulta redundante en pantalla.

**D-4 · Los totales se calculan en el backend** (spec §9), sobre la población de partidos jugados que
fijó la Feature 12 — un DNP no aporta al total de intentos, coherente con sus promedios.
