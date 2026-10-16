# Plan — Feature 13: deduplicación de jugadores

> Spec: `sdd/specs/13-dedup-jugadores/spec.md` (gate del Paso 1 pasado). Reglas: `sdd/02-plan.md`.

## 1. Enfoque

La identidad del jugador hoy está implícita y repetida en tres rutas: cada una agrupa o busca por
`player_name` crudo, a su manera. La estrategia es hacerla **explícita y única**: dos funciones en
`stats_engine.py` —normalizar el nombre y resolver la ficha unificada de un grupo de filas— que las
tres rutas consumen.

Sin esquema, sin migración, sin dependencias. La unificación ocurre al leer: el histórico crudo de
`player_game_stats` queda intacto y el cambio aplica retroactivamente a todo lo ya importado.

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `backend/stats_engine.py` | service | `norm_name(s)` — normalización tipográfica única de la app | RF-1 |
| `backend/stats_engine.py` | service | `resolve_identity(rows)` — nombre a mostrar + posición, de un grupo de fichas | RF-3, RF-4 |
| `backend/app.py` | route | `search_players`: agrupar por `(team_code, norm_name(player_name))`; identidad vía `resolve_identity` | RF-1, RF-2, RF-3, RF-4 |
| `backend/app.py` | route | `team_players`: agrupar por nombre normalizado en vez de `distinct()` crudo | RF-1, RF-2, RF-3 |
| `backend/app.py` | route | `player_stats`: resolver por nombre normalizado en vez de igualdad exacta | RF-1, RF-5 |
| `docs/api.md` | doc | Nota de identidad de jugador en los 3 endpoints (Paso 4) | RF-1, RF-5 |
| `docs/database.md` | doc | Aclarar que la unicidad es por nombre crudo y la identidad se resuelve al leer (Paso 4) | RF-2 |

**Matriz RF → archivo**: RF-1 ✔ · RF-2 ✔ · RF-3 ✔ · RF-4 ✔ · RF-5 ✔ · RF-6 ✔ (se satisface por
construcción: agrupar no altera filas; los promedios de Feature 12 corren después).

## 3. Backend — rutas y modelos

**Sin tabla ni columna nueva.** Sin `upgrade_db()`. La `UniqueConstraint(game_id, team_code,
player_name)` se conserva tal cual (Constitución 5).

**Sin endpoint nuevo.** Tres endpoints existentes cambian su resolución de identidad:

| Método + ruta | Cambio | Errores |
|---|---|---|
| `GET /api/search/players` | Clave de grupo: `(team_code, norm_name(player_name))`. `player` y `position` salen de `resolve_identity` | sin cambio |
| `GET /api/players/<team_code>` | Roster agrupado por nombre normalizado; `name` y la posición vía `resolve_identity` | sin cambio |
| `GET /api/player/<team_code>/<player_name>` | Filtra por `norm_name(fila) == norm_name(param)`, no por igualdad exacta. Acepta cualquier grafía en la URL | `404 {"error": "Jugador no encontrado"}` cuando no hay ninguna coincidencia — sin cambio |

## 4. Backend — lógica

| Función | Módulo | Regla | RF |
|---|---|---|---|
| `norm_name(s) -> str` | `stats_engine.py` (**nueva**) | Minúsculas → quitar diacríticos vía `unicodedata.normalize("NFD")` descartando las marcas (categoría `Mn`) → colapsar espacios internos a uno → recortar extremos. Solo `unicodedata` y `re`, ambos de la stdlib: sin dependencia nueva (Constitución 2) | RF-1 |
| `resolve_identity(rows) -> (name, position)` | `stats_engine.py` (**nueva**) | `name`: la grafía de la ficha más reciente. `position`: la más frecuente entre las no vacías; a igual frecuencia, la de la ficha más reciente; `""` si ninguna trae posición | RF-3, RF-4 |

"Más reciente" se determina por la fecha del partido cuando está disponible, y por `game_id` como
desempate estable. La función recibe las filas ya ordenadas por la ruta que la llama, para no
acoplar `stats_engine.py` al modelo de `Game`.

Ninguna fórmula de `docs/metrics.md` se toca. Esta feature cambia **qué filas forman un jugador**,
no cómo se calcula ninguna métrica sobre ellas.

## 5. Frontend — capa API (api.js)

**Sin cambios.** Las firmas no cambian. El perfil ya se navega pasando el nombre que vino del
roster o del buscador, que tras esta feature es siempre una grafía real y resoluble.

## 6. Frontend — UI (app.js / charts.js)

**Sin cambios.** El buscador ya renderiza una fila por entrada de la respuesta y ya muestra el
recuento `"N jugadores"` desde `filtered.length`: al bajar el número de entradas, el recuento se
ajusta solo. El filtro por posición (`sf-pos`) se beneficia del determinismo de RF-3 sin tocar código.

Mobile-first: sin marcado nuevo, sin cambios de layout.

## 7. Navegación

Sin vistas ni hashes nuevos. El mapa de `docs/frontend.md` no cambia.

## 8. Contratos de datos

Sin campos nuevos ni eliminados. Cambia el **contenido**:

```
GET /api/search/players → puede devolver MENOS entradas (fichas unificadas)
                          player   = grafía real, resuelta
                          position = la más frecuente entre las no vacías
GET /api/players/<t>    → ídem para name / position; `games` refleja la suma unificada
GET /api/player/<t>/<n> → acepta cualquier grafía de <n>; game_log incluye todos los partidos
```

Sin filas SQLAlchemy nuevas ni modificadas: la unificación es de lectura.

## 9. Manejo de errores y offline

Sin códigos HTTP nuevos.

**Caso borde**: nombre en la URL que no resuelve a ninguna ficha → `404` con el copy existente
`"Jugador no encontrado"`. La normalización **amplía** lo que resuelve, así que no puede convertir
en `404` algo que antes devolvía `200`.

**Service worker**: sin assets nuevos → `STATIC[]` y versión de `CACHE` sin tocar.

## 10. Riesgos / decisiones

**D-1 · La unificación se paga en cada request.**
Agrupar al leer en vez de normalizar al importar cuesta una pasada de normalización por fila en cada
consulta. Al volumen actual (95 filas) es irrelevante. Si la base crece a decenas de miles, el lugar
correcto es una columna normalizada indexada — pero eso es cambio de esquema y hoy no se justifica.

**D-2 · La normalización es tipográfica, no semántica.**
`J. Feldeine` y `Jerome Feldeine` NO se unifican. Es deliberado (spec §8): el emparejamiento difuso
introduce falsos positivos que fusionarían jugadores distintos, un daño peor que el duplicado.

**D-3 · No se mapea `PF`→`F` ni `PG`→`G`.**
Los 3 casos reales de la base (`C. Zinaich`, `J. Feldeine`, `P. Prieto`) tienen dos posiciones no
vacías del mismo linaje. RF-3 elige una de forma determinista, pero no colapsa la taxonomía: unificar
el catálogo de posiciones de FIBA es decisión de producto y merece su propio requisito.

**D-4 · CA-1, CA-2, CA-5 y CA-6 no son alcanzables con los datos de producción actuales.**
No hay duplicados de grafía en la base (74 = 74). Se verifican sobre una **copia** de la base con una
variante inyectada; la base real no se toca. CA-7 cubre el reverso: sin duplicados, el total no cambia
y ninguna estadística se altera. Se registra en `progress.md` para no leerlo como cobertura plena.

**D-5 · Riesgo de sobre-fusión.**
Si dos jugadores distintos del mismo equipo tuvieran nombres que normalizan igual, esta feature los
fusionaría en silencio. Con el formato `Inicial. Apellido` de FIBA es plausible a futuro (dos
hermanos, `P. Prieto` y `P. Prieto`). No es detectable desde los datos —son indistinguibles— pero se
registra: si aparece, la señal es un jugador con más partidos que los que jugó su equipo.
