# Plan — Feature 17: vista Liga

> Spec: `sdd/specs/17-vista-liga/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

C-09 es agregado puro: `league_overview` ya recorre las filas de cada equipo y ya filtra por
competencia; solo falta acumular victorias, derrotas y puntos a favor/en contra en ese mismo bucle, y
renderizar una tabla más en la vista. Cero consultas nuevas.

C-10 es un cambio de convención en los títulos de eje, más un ajuste de orden null-safe que arrastra
la Feature 14.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/app.py` | route | `league_overview`: `wins`, `losses`, `table_points`, `pts_for`, `pts_against` | RF-1, RF-2, RF-3, RF-5, RF-6 |
| `backend/app.py` | route | `league_overview`: orden null-safe del resultado | RF-8 |
| `frontend/js/app.js` | js-view | Tabla general nueva, ordenada por puntos | RF-1, RF-4 |
| `frontend/js/app.js` | js-view | `LEAGUE_MAPS`: flechas de dirección en los títulos de eje | RF-7 |
| `docs/api.md` | doc | Campos nuevos de `/api/league` (Paso 4) | RF-1, RF-3 |
| `docs/frontend.md` | doc | Tabla general; convención de flechas de eje (Paso 4) | RF-1, RF-7 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ · RF-3 ✔ · RF-4 ✔ · RF-5 ✔ (por construcción) · RF-6 ✔ ·
RF-7 ✔ · RF-8 ✔

## 3. Backend — rutas y modelos

**Sin tabla, columna ni endpoint nuevo.** Sin `upgrade_db()`.

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/league` | Campos nuevos por equipo: `wins`, `losses`, `table_points`, `pts_for`, `pts_against`. El filtro `?competition=` los alcanza sin cambios | sin cambio |

## 4. Backend — lógica

| Función | Módulo | Regla | RF |
|---|---|---|---|
| `league_overview` | `app.py` | Sobre las filas ya filtradas de cada equipo: `wins` = partidos con `pts > opp_pts`; `losses` = el resto; `pts_for` = suma de `pts`; `pts_against` = suma de `opp_pts`; `table_points = 2 × wins + 1 × losses` | RF-1, RF-2, RF-3 |
| `league_overview` | `app.py` | El orden final usa una clave de tupla que manda los `None` al final, en vez de comparar `None` con `float` | RF-8 |

`wins + losses == len(rows)` por construcción (RF-5): se cuenta sobre la misma lista. Un marcador
igualado cuenta como derrota (spec §9).

Sin fórmulas de `docs/metrics.md` involucradas: son conteos, no métricas derivadas.

## 5. Frontend — capa API (api.js)

**Sin cambios.** `api.league(comp)` ya existe y ya propaga la competencia.

## 6. Frontend — UI (app.js)

**Tabla general** — card nueva arriba del ranking existente, reusando el patrón `.search-table` que ya
usan Cierres y Buscador:

| Col | Contenido |
|---|---|
| Equipo | `team_name` |
| PJ | `games` |
| PG | `wins` |
| PP | `losses` |
| Pts | `table_points` — **columna de orden por defecto, descendente** |
| PF | `pts_for` |
| PC | `pts_against` |

Se alimenta del mismo `_leagueTeams` que ya se descarga para el ranking: **sin fetch adicional**.
Al cambiar el filtro de competencia, se re-renderiza con el resto de la vista.

**Leyendas de eje** — nueva convención, aplicada a los tres presets:

| Preset | Eje X (antes → después) | Eje Y (antes → después) |
|---|---|---|
| Eficiencia | `OER (↑ mejor ataque)` → `OER (→ mejor ataque)` | `DER (↓ mejor defensa)` → sin cambio |
| Rebotes | `OR% (↑ mejor)` → `OR% (→ mejor)` | `DR% (↑ mejor)` → sin cambio |
| Recuperos | `Recuperos por partido (↑)` → `(→ más robos)` | `Puntos por partido (↑)` → sin cambio |

Los ejes Y ya eran correctos porque el gráfico no invierte la escala (`reverse: false`): el valor más
alto se dibuja arriba, y `↑`/`↓` describen esa posición. Solo cambian los horizontales.

Mobile-first: la tabla general tiene 7 columnas y va dentro de `.table-wrap`, que ya scrollea en
horizontal sin arrastrar el body.

## 7. Navegación

Sin vistas ni hashes nuevos: la tabla vive dentro de la vista Liga.

## 8. Contratos de datos

```
GET /api/league  →  [{
  team_code, team_name, games,
  wins, losses, table_points, pts_for, pts_against,   // NUEVOS
  oer, der, net_rating, efg_pct, ts_pct, or_pct, dr_pct, to_pct, pace, pts, stl
}]
```

`pts` sigue siendo el **promedio** de puntos por partido; `pts_for` es el **total**. Sin filas
SQLAlchemy nuevas.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos.

**Caso borde**: base vacía o competencia sin partidos → la lista viene vacía y la tabla general no se
renderiza, igual que el ranking existente.

**Service worker**: sin assets nuevos.

## 10. Riesgos / decisiones

**D-1 · La tabla refleja solo los partidos importados, no el fixture.**
Un equipo con 3 de 12 partidos cargados aparecerá con 3 PJ. Es inherente a la app y ya vale para el
resto de la vista, pero una *tabla de posiciones* invita más que ninguna otra pantalla a leerse como
la clasificación oficial. Vale una aclaración visible si el cliente la va a compartir con terceros.

**D-2 · C-10 se aplica a los tres presets, no solo al de rebote** (spec §9).
C-10 nombra el eje de rebote, pero el mismo símbolo ambiguo está en los tres. Corregir uno solo
dejaría la inconsistencia que originó el reporte. Es una desviación deliberada del texto, alineada
con el CA.

**D-3 · El orden null-safe del ranking es un arreglo de la Feature 14, no de C-09.**
`_avg` pasó a devolver `None` allí, y este `sort` compara directo contra `float`. No se manifestó
porque todo equipo con partidos tiene OER, pero un equipo cuyos partidos no resuelvan rival dejaría la
vista Liga en error 500. Se cierra acá porque es la misma pantalla.

**D-4 · Un marcador igualado cuenta como derrota** (spec §9). No debería existir en FIBA; se define
para que la suma `PG + PP == PJ` se sostenga ante un dato corrupto.
