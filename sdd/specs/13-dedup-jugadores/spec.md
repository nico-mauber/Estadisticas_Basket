# Spec — Feature 13: deduplicación de jugadores

> **Requisito C-08** (`Smart-Basket Especificacion v2.docx` §1, P0). Corte y orden:
> `sdd/ROADMAP-bloque-C.md` §2 y §4.

## 1. Objetivo
Que un mismo jugador nunca aparezca como dos fichas distintas por diferencias de grafía en el nombre
o por venir con la posición vacía en algunos partidos.

## 2. Fuentes (trazabilidad)

**Requisito del cliente (C-08):**
- *"Si en el mismo equipo y la misma competencia aparecen dos jugadores con idéntico nombre, deben unificarse en un solo registro."*
- *"Causa habitual: en algunos partidos no se carga la posición desde FIBA LiveStats."*
- *"Clave de deduplicación: nombre normalizado + equipo + competencia. Al unificar, conservar la posición no vacía y sumar los partidos de ambos registros."*
- *"Normalizar el nombre antes de comparar: minúsculas, sin tildes, sin espacios dobles."*
- CA del cliente: *"El total de jugadores de la base baja al eliminar duplicados y ningún equipo muestra dos fichas con el mismo nombre."*

**Docs:**
- `docs/database.md` — `player_game_stats` con `UniqueConstraint(game_id, team_code, player_name)`;
  columna `position` (`playingPosition` de FIBA, default `""`).
- `docs/api.md` — `GET /api/search/players` (una entrada por jugador, con `competitions[]`),
  `GET /api/players/<team_code>` (roster), `GET /api/player/<team>/<name>` (perfil).

**Código (estado verificado sobre el repo):**
- `backend/app.py` `search_players` (748) — agrupa por `(pr.team_code, pr.player_name)` con el nombre
  **crudo**, sin normalizar. Es el punto donde una variante de grafía produce dos fichas.
- `backend/app.py` `search_players` (775-776) — `if pr.position: position = pr.position`: conserva la
  posición no vacía, pero gana la **última** de la iteración. Con dos posiciones no vacías distintas
  el resultado no es determinista.
- `backend/app.py` `team_players` (505-513) — el roster lista `player_name` `distinct()` sin
  normalizar: mismo defecto latente.
- `backend/app.py` `player_stats` (547-549) — busca por `player_name` exacto: si el nombre varía entre
  partidos, el perfil muestra solo el subconjunto que coincide exactamente.
- `backend/fiba_fetcher.py` — origen de `player_name` y `position` en la importación.

**Estado de los datos (verificado, 2026-08-10):** 95 filas en `player_game_stats`, 74 fichas por
`(equipo, nombre crudo)` y **74** por `(equipo, nombre normalizado)` — **hoy no hay ningún duplicado
por grafía**. Sí hay 3 jugadores con posición distinta entre partidos: `C. Zinaich` (`F`/`PF`),
`J. Feldeine` (`G`/`PG`), `P. Prieto` (`G`/`PG`). Ver §9 y §7 sobre el impacto en la verificación.

## 3. Historias de usuario
- **US-1**: Como analista, quiero que un jugador tenga una sola ficha por equipo, para que sus
  promedios se calculen sobre todos sus partidos y no sobre la mitad.
- **US-2**: Como analista, quiero que la posición de un jugador sea estable entre consultas, para que
  el filtro por posición del buscador no lo esconda de forma intermitente.

## 4. Requisitos funcionales

- **RF-1**: La identidad de un jugador DEBE resolverse sobre su **nombre normalizado**, no sobre el
  nombre crudo. Normalización: minúsculas · sin tildes ni diacríticos · espacios colapsados a uno ·
  sin espacios al inicio ni al final. · (US-1, C-08 "Normalizar el nombre antes de comparar")

- **RF-2**: Dos fichas del mismo equipo cuyo nombre normalizado coincide DEBEN unificarse en un solo
  registro, sumando sus partidos. · (US-1, C-08) · Alcance: buscador, roster de equipo y perfil de
  jugador — las tres vistas resuelven la identidad igual.

- **RF-3**: Al unificar, la **posición** resultante DEBE ser no vacía si alguna ficha la trae, y
  DEBE ser determinista: ante varias posiciones no vacías distintas, gana la más frecuente; a igual
  frecuencia, la de la ficha más reciente. · (US-2, C-08 "conservar la posición no vacía")

- **RF-4**: El **nombre mostrado** DEBE ser una grafía real del jugador, no el nombre normalizado
  (que es una clave interna, no texto de UI). Ante varias grafías, la de la ficha más reciente. · (US-1)

- **RF-5**: El perfil de un jugador DEBE devolver todos sus partidos aunque el nombre haya variado de
  grafía entre ellos. · (US-1) · Hoy la consulta es por nombre exacto.

- **RF-6**: La unificación NO DEBE alterar el número de partidos ni ninguna estadística: solo agrupa
  filas ya existentes. Las reglas de nulos y DNP de la Feature 12 se aplican después de agrupar. ·
  (US-1, `sdd/specs/12-nulos-orden-color-dnp/` RF-6)

## 5. Requisitos de datos / API

| Tabla/Endpoint | Tipo | Cambio | Nuevo? |
|---|---|---|---|
| `player_game_stats` | existente | **Sin cambio de esquema.** La `UniqueConstraint(game_id, team_code, player_name)` se conserva: la unificación ocurre al leer, no al escribir. Sin `upgrade_db()`, sin migración destructiva (Constitución 5) | No |
| `GET /api/search/players` | existente | Agrupa por nombre normalizado. El total de entradas puede bajar. `position` pasa a resolverse por frecuencia | No |
| `GET /api/players/<team_code>` | existente | Ídem: el roster lista jugadores unificados | No |
| `GET /api/player/<team_code>/<player_name>` | existente | Resuelve el jugador por nombre normalizado: acepta cualquier grafía en la URL y devuelve todos sus partidos. El `404` se mantiene cuando no hay ninguna coincidencia | No |

> Sin campo nuevo en la respuesta: el nombre normalizado es clave interna y no se expone.

## 6. Estados de UI

No agrega vista. No cambia copy.

| Vista / Componente | loading | vacío | error | sin conexión (SW) | éxito |
|---|---|---|---|---|---|
| Buscador | sin cambio | `"Ningún jugador cumple los filtros"` (copy existente) | sin cambio | sin cambio | una fila por jugador; el recuento de `"N jugadores"` refleja el total unificado |
| Roster de equipo | sin cambio | sin cambio | sin cambio | sin cambio | una entrada por jugador |
| Perfil de jugador | sin cambio | sin cambio | `404 "Jugador no encontrado"` (copy existente) | sin cambio | game log con todos sus partidos |

## 7. Criterios de aceptación

- **CA-1**: Given dos fichas del mismo equipo cuyos nombres difieren solo en mayúsculas, tildes o
  espacios dobles, When se consulta el buscador, Then aparece **una sola** fila para ese jugador y sus
  partidos son la suma de ambas fichas.
- **CA-2**: Given ese mismo jugador, When se abre el roster de su equipo, Then aparece una sola entrada.
- **CA-3**: Given un jugador cuya posición viene vacía en un partido y cargada en otro, When se
  consulta, Then su posición es la no vacía.
- **CA-4**: Given un jugador con dos posiciones no vacías distintas, When se consulta dos veces
  seguidas, Then devuelve **la misma** posición ambas veces (determinismo), y es la más frecuente.
- **CA-5**: Given un jugador cuyo nombre varió de grafía entre partidos, When se abre su perfil con
  cualquiera de las dos grafías en la URL, Then el game log muestra **todos** sus partidos.
- **CA-6**: Given el nombre mostrado en buscador, roster y perfil, When se observa, Then es una grafía
  real (con mayúsculas y tildes), nunca el nombre normalizado en minúsculas y sin tildes.
- **CA-7**: Given la base sin ningún duplicado de grafía, When se aplica la unificación, Then el total
  de jugadores **no cambia** y ninguna estadística se altera (la unificación no inventa fusiones).
- **CA-8**: Given el recorrido de buscador, roster y perfil, When se observa la consola, Then no hay
  errores JS nuevos.

## 8. Fuera de alcance

- **Fusionar jugadores con nombres realmente distintos** (apodos, abreviaturas divergentes tipo
  `J. Feldeine` vs `Jerome Feldeine`). La normalización de C-08 es tipográfica, no semántica. Un
  emparejamiento difuso es una feature distinta con riesgo de falsos positivos.
- **Unificar al mismo jugador entre equipos distintos.** La clave incluye el equipo por definición
  (C-08): un jugador que cambió de club son dos fichas, y eso es correcto.
- **Corregir los datos en la tabla** (`UPDATE` de nombres o posiciones). La unificación ocurre al
  leer; el histórico crudo se conserva intacto (Constitución 5).
- **Normalizar el nombre en la importación.** Cambiaría la clave única de `player_game_stats` y el
  histórico ya cargado. Ver la decisión en §9.
- **La regla de nulos y DNP.** Cerrada en Feature 12; acá solo se respeta el orden (agrupar primero,
  promediar después).

## 9. Ambigüedades

- **[RESUELTA] ¿La competencia entra en la clave de deduplicación?** C-08 dice "nombre normalizado +
  equipo + competencia". → **Decisión: NO se agrega la competencia a la clave.** *Justificación*:
  agregarla **aumentaría** el número de fichas (un jugador con partidos en dos competencias pasaría a
  tener dos entradas), lo cual contradice el criterio de aceptación del propio C-08 ("el total de
  jugadores baja... ningún equipo muestra dos fichas con el mismo nombre"). El comportamiento vigente
  —una ficha por (equipo, jugador) con `competitions[]` en la respuesta y filtro por competencia en
  el buscador— ya cumple el objetivo de forma más fuerte. Se registra como desviación deliberada del
  texto literal, alineada con su intención.

- **[RESUELTA] ¿Dedup al importar o al leer?** → **Decisión: al leer.** *Justificación*: normalizar en
  la importación no arregla los partidos ya cargados y tocaría la clave única de la tabla
  (Constitución 5: sin migraciones destructivas). Agrupar en la consulta cubre todo el histórico sin
  migrar y es reversible. Costo: la agrupación se paga en cada request, aceptable al volumen actual.

- **[RESUELTA] ¿Qué posición gana ante dos valores no vacíos distintos (`F` vs `PF`)?** → **Decisión:
  la más frecuente; a igual frecuencia, la de la ficha más reciente.** *Justificación*: C-08 solo pide
  "conservar la posición no vacía", que no resuelve el empate; el código actual toma la última de la
  iteración, que no está ordenada y por lo tanto no es reproducible. La frecuencia es la señal
  disponible más estable. **No** se mapea `PF`→`F` ni `PG`→`G`: unificar la taxonomía de posiciones de
  FIBA es una decisión de producto, no de deduplicación.

- **[RESUELTA] ¿Cómo se verifica CA-1 si la base no tiene duplicados?** → **Decisión: verificar con un
  caso sintético**, insertando una variante de grafía de un jugador real en una copia de la base, y
  registrar en `progress.md` que el caso no es alcanzable con los datos de producción actuales.
  *Justificación*: el criterio literal del cliente ("el total baja") no se puede cumplir sobre datos
  sin duplicados; el requisito igual es real y debe quedar cubierto antes de que aparezca el primer
  duplicado en una importación futura. CA-7 protege el otro lado: sin duplicados, nada cambia.
