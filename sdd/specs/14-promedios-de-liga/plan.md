# Plan — Feature 14: promedios de liga

> Spec: `sdd/specs/14-promedios-de-liga/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

Tres cambios chicos y un borrado:

1. **Alcance** — `team_stats` y `player_stats` pasan de construir *una* población de liga global a
   construir *un mapa* de poblaciones, una por competencia más el agregado. El frontend elige la
   entrada según el filtro activo, sin refetch.
2. **Nulos** — `league_averages()` devuelve `None` en vez de `{avg:0,best:0}`, y el `_avg` de
   `league_overview` empieza a excluirlos.
3. **Borrado** — el bloque `↑ {best}` sale de `statBox`. Un solo punto: todas las cards lo usan.

Sin esquema, sin dependencias, sin endpoints nuevos. La agrupación por competencia reusa el mismo
mapa `game_id → competition` que las rutas ya construyen.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `league_averages()`: sin valores válidos → `{"avg": None, "best": None}` | RF-3 |
| `backend/app.py` | route | `team_stats`: construir `leagues` por competencia + `""`; `league` = `leagues[""]` | RF-1, RF-2, RF-6 |
| `backend/app.py` | route | `player_stats`: ídem sobre la población de jugadores | RF-1, RF-2, RF-6 |
| `backend/app.py` | route | `league_overview._avg`: excluir `None`, devolver `None` si no queda ninguno | RF-4 |
| `frontend/js/app.js` | js-view | `statBox`: retirar el `<span class="best">↑ …</span>` | RF-5 |
| `frontend/js/app.js` | js-view | `_renderTeamContent`: `lg` = `data.leagues[_teamComp]` con caída a `data.league` | RF-1, RF-2 |
| `frontend/js/app.js` | js-view | Vista Jugador: ídem con su filtro de competencia | RF-1, RF-2 |
| `docs/api.md` | doc | Campo `leagues`; `avg`/`best` admiten `null` (Paso 4) | RF-1, RF-3 |
| `docs/frontend.md` | doc | La card de stat ya no muestra `↑`; de dónde sale el `Ø` (Paso 4) | RF-5 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ · RF-3 ✔ · RF-4 ✔ · RF-5 ✔ · RF-6 ✔

## 3. Backend — rutas y modelos

**Sin tabla ni columna nueva.** Sin `upgrade_db()`. **Sin endpoint nuevo.**

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/team/<team_code>` | **Campo nuevo `leagues`**: `{"": {…}, "<competencia>": {…}, …}`, una entrada por competencia en la que el equipo tiene partidos. `league` se conserva y equivale a `leagues[""]` | sin cambio |
| `GET /api/player/<team>/<name>` | Ídem, población de jugadores | `404` sin cambio |
| `GET /api/league` | `_avg` excluye nulos y devuelve `null` si no queda ninguno. `?comp=` sin cambios | sin cambio |

## 4. Backend — lógica

| Función | Módulo | Regla | RF |
|---|---|---|---|
| `league_averages(stats)` | `stats_engine.py` | Única línea que cambia: la métrica sin ningún valor válido pasa de `{"avg": 0, "best": 0}` a `{"avg": None, "best": None}`. El resto (exclusión de `None`, `min`/`max` según `lower_is_better`) ya era correcto | RF-3 |
| `team_stats` — población de liga | `app.py` | Agrupar las stats avanzadas de **todos** los equipos por la competencia de su partido, y llamar `league_averages` una vez por grupo más una vez sobre el total (clave `""`). Solo se incluyen las competencias donde el equipo consultado tiene partidos: el resto no se puede seleccionar en la UI | RF-1, RF-6 |
| `player_stats` — población de liga | `app.py` | Ídem con `PlayerGameStats`, agrupando por la competencia del partido de cada ficha | RF-1, RF-6 |
| `league_overview._avg` | `app.py` | `vals = [a[key] for a in adv_list if a.get(key) is not None]`; `None` si queda vacío. Alinea esta ruta con `_avg` de `team_stats`/`player_stats`, que ya lo hacían | RF-4 |

Ninguna fórmula de `docs/metrics.md` cambia: se altera **sobre qué población** se promedia, no cómo.

## 5. Frontend — capa API (api.js)

**Sin cambios.** Ninguna firma se toca; solo llega un campo más en la respuesta.

## 6. Frontend — UI (app.js / charts.js)

**`statBox` — retirar el `↑`.** El bloque de contexto pasa de dos spans a uno:

```
Ø {avg}   ↑ {best}      →      Ø {avg}
```

Es el único punto de render del indicador, así que el borrado alcanza a todas las cards de Equipo y
Jugador de una vez. `fmt(avg)` ya devuelve `"—"` cuando el valor es nulo (RF-3 + Feature 12 RF-4), así
que una métrica sin datos en la liga muestra `Ø —` sin código nuevo.

**Selección del promedio según competencia.** `_renderTeamContent` y el render de Jugador toman
`lg = data.leagues?.[compActiva] ?? data.league`. Con el filtro en "todas", `compActiva` es `""` y la
entrada es el agregado. El filtro de últimos N **no** participa de esta selección — de ahí RF-2 sale
por construcción.

**Mobile-first**: quitar un span reduce la altura de la card; sin cambios de layout ni de breakpoint.

## 7. Navegación

Sin vistas ni hashes nuevos.

## 8. Contratos de datos

```
GET /api/team/<code>
{
  "league":  { "oer": {"avg": 1.02, "best": 1.25}, ... },   // = leagues[""]
  "leagues": {
    "":                                  { "oer": {"avg": 1.02, "best": 1.25}, ... },
    "Liga Uruguaya de Basquetbol 2025/2026": { "oer": {"avg": 1.04, "best": 1.25}, ... }
  }
}
```

`avg` y `best` admiten `null` (métrica sin ningún valor válido en esa población).
`GET /api/player/<team>/<name>` tiene la misma forma. Sin filas SQLAlchemy nuevas.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos.

**Caso borde**: competencia sin ningún partido válido → su entrada en `leagues` queda con todas las
métricas en `null`, y las cards muestran `Ø —`. No se omite la clave: omitirla haría caer el `??` al
agregado global y mentiría sobre el alcance.

**Service worker**: sin assets nuevos → `STATIC[]` y `CACHE` sin tocar.

## 10. Riesgos / decisiones

**D-1 · `league` se conserva además de `leagues`.**
Redundante, pero evita romper de golpe a cualquier consumidor del campo viejo y hace el cambio
reversible. Cuando T-01 rehaga el bloque de contexto, `league` y `best` se retiran juntos.

**D-2 · Se paga una llamada a `league_averages` por competencia.**
Con 1-2 competencias es despreciable. La población se recorre una vez y se agrupa en memoria: el
costo es el agrupamiento, no consultas extra a la base.

**D-3 · Entre esta feature y T-01, las cards quedan sin indicador de dispersión.**
Consecuencia aceptada de la decisión del cliente (spec §9). El `Ø` corregido sigue dando contexto; lo
que se pierde es la referencia al mejor de la liga — que era justamente el número no confiable.

**D-4 · La población de liga sigue sin umbral mínimo de muestra.**
Un equipo con 1 partido pesa igual que uno con 12 en el promedio. Esta feature corrige el alcance, no
la calidad; el umbral es T-01/T-02 (spec §8). Se registra porque el `Ø` seguirá algo movido hasta
entonces, y conviene no atribuirlo a esta corrección.

**D-5 · `league_overview._avg` podía levantar `TypeError`, no solo dar un número malo.**
`sum()` sobre una lista con `None` explota. No se observó en producción porque las métricas de equipo
rara vez son nulas (siempre hay tiros y posesiones), pero un partido cargado a medias lo dispararía.
El fix cierra un fallo potencial de la vista Liga, no solo una imprecisión.
