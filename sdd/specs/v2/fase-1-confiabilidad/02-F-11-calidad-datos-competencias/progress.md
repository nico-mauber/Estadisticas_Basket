# Progress — F-11: Panel de calidad de datos

> **Estado:** ✅ Completado (2026-09-26) · rama `v2`
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md).

## Decisiones humanas aplicadas
DA-12 (archivar JSON crudo), DA-13 (competencias nacen `publicada`), DA-18 (`ADMIN_USERS` opcional), DA-32 (capturar
coordenadas), **alcance acotado** y **borrador oculta todo**. Registro en [../../00-decisiones.md](../../00-decisiones.md).

## Alcance: qué se hizo y qué se difirió
Versión acotada decidida por el humano. Respecto del plan:

| Pieza del plan | Estado | Nota |
|---|---|---|
| Competencias, alias, edición, fusión, reasignación, estado | ✅ | Estados: `publicada` · `borrador` (sin `archivada`) |
| Ingesta en `ingest.py`, archivo crudo, reproceso por lotes | ✅ | Reemplazo de filas hijas en lugar de upsert por tabla: más simple y sin huérfanos |
| Coordenadas de tiro, minutos reales, fix `OVERTIME` en quintetos | ✅ | Coordenadas solo se guardan; el mapa las usa en C-03 |
| Panel de calidad (8 chequeos + posesiones diferido) | ✅ | Se agregó "datos básicos faltantes" como chequeo propio |
| `ADMIN_USERS` | ✅ | |
| ~20 columnas nuevas (tapones/faltas recibidas, nombres, fotos, `previous_action`, calificadores, rebotes de equipo, parciales) | ⏭ diferido | Cada requisito dueño (T-05, F-16, A-01, F-04/F-07) agrega las suyas, sube `INGEST_VERSION` y reprocesa |
| `cache.py` / `app_meta` / `data_version` | ⏭ diferido | No hay caché que invalidar todavía |
| `repository.py`, resolución de competencia por defecto (DA-14) | ⏭ diferido | → C-02, que necesita el universo por defecto |
| Componentes JS en archivos separados | ⏭ | Todo en `app.js`, como el resto de las vistas (DA-22 sigue abierta) |
| Errores `{error, code, details}` (arquitectura §7.8) | ⏭ | Se mantiene `{error}`, el formato vigente de la API |
| `t()` en el copy | ⏭ | DA-21: copy en español directo |

## Evidencia (13 partidos del seed, "Liga de Ascenso 2026", 2 con prórroga)

### Backfill y API nueva (CA-2, CA-9, CA-16)
- Al arrancar: 1 competencia (`Liga de Ascenso` / `2026`), 1 alias, 13/13 partidos con `competition_id`. Segundo
  arranque: 0 asignaciones, filas sin cambio.
- `split_source`: "Liga Uruguaya de Basquetbol 2025/2026" → (`Liga Uruguaya de Basquetbol`, `2025/2026`);
  "Copa de Plata" → sin temporada; "Liga 2025 - 26" → `2025-26`.
- `/api/league?competition=1` == `/api/league?competition=Liga de Ascenso 2026` (14 equipos).

### Calidad antes y después del reproceso (CA-4, CA-10, CA-12)
Antes (datos de la ingesta anterior): 13 incompletos · 13 pendientes de reproceso · 13 sin coordenadas · los 2
partidos con prórroga en "quintetos inconsistentes" (tramos 2700 s vs 2400 s esperados con minutos = 40) ·
coordenadas nulas 1769/1769.

Reproceso de la competencia en 2 lotes (10 + 3), desde FIBA (sin archivo previo): 13 ok, 0 fallidos, 19,9 s. Filas
antes = después (26 · 312 · 1769 · 7163), `game_sources` 0 → 13.

Después: **13 partidos · 0 incompletos · "Lista para publicar"**; todos los chequeos `ok` salvo el aviso de campos
nulos (posición 18/312 = 5,8 %, dato que FIBA no carga en algunos partidos). Partidos 2849340 y 2849347:
`minutes = 45`, `ingest_version = 2`, 152/152 tiros con coordenadas (rango 2,06–97,22 × 1,98–98,14).

### Idempotencia y reproceso sin red (CA-11, CA-12, CA-13) — copia de la base, red bloqueada
```
PASS CA-13 reproceso desde archivo sin red: 13 ok, fallidos []
PASS CA-11 idempotente: filas iguales {games 13, team 26, player 312, shots 1769, pbp 7163, sources 13}
PASS CA-10 2849340 / 2849347: minutes/ingest=(45, 2), tiros con coordenadas 152/152
PASS import sin red → 502, base intacta
PASS CA-12 sin archivo ni red: failed=[2849328 "red bloqueada"], processed=[2849331]
```

### Regresión de la API (datos originales vs reprocesados, mismo código)
Volcado de `/api/team`, `/api/player`, `/api/league`, `/api/search/players`, `/api/shots`, `/api/clutch` y
`/api/onoff` de los 14 equipos y todos sus jugadores (418 respuestas). Única diferencia: `pace` y `or_pct`/`dr_pct`/
`trb_pct` individuales en los 2 partidos con prórroga (ahora con 45 minutos), y los promedios de liga que dependen de
ellos. Todo lo demás idéntico.

### Competencias (CA-3, CA-5, CA-7, CA-8, CA-9, CA-17) — copia de la base
```
PASS alta → 201 · duplicado (nombre, temporada) → 409
PASS CA-8 la reasignación sobrevive al reproceso
PASS CA-9 selectores sin la competencia en borrador; Datos la muestra
PASS CA-9 equipos/liga sin los 2 partidos en borrador: 22 equipo-partidos; game log del equipo sin ellos
PASS Datos: el catálogo sigue mostrando los 13 partidos
PASS Buscar: al publicar vuelven sus partidos (222 → 259 partidos-jugador)
PASS CA-7 fusión: 2 partidos movidos, la origen desaparece · fusión consigo misma → 409
PASS CA-3 sin pbp → incompleto · CA-17 discrepancia "PTS box 66 / pbp 64" · CA-5 duplicado "A. Caldas" / "  A. CALDAS "
PASS CA-6 posesiones: no_disponible
PASS borrado en cascada incluye game_sources
```

### Permisos (CA-14) — `python backend/test_auth.py`
```
OK  escenario auth habilitado
OK  rate-limit (5 fallos -> 429)
OK  permisos de administración (ADMIN_USERS)   # admin → 400 (pasa el gate), no-admin → 403, sin variable → todos admin
OK  escenario auth deshabilitado (app abierta)
TODOS LOS TESTS OK
```

### Frontend (CA-1, CA-18 parcial) — Chromium headless
Recorrido completo (Importar con modo selección, modal de borrado y de mover; Calidad; Competencias con modal de
edición; Liga; Equipo; Jugador; Comparar; Buscar; offline): **0 errores JS, 0 hallazgos**. Calidad muestra "Lista para
publicar" y las 9 tarjetas. Móvil 390 px: pestañas y tarjetas sin scroll horizontal de página.
- Primera pasada: 3 errores JS al cambiar de pestaña mientras otra cargaba (el render tardío buscaba elementos ya
  reemplazados) → corregido con `if (!el.isConnected) return` tras cada `await`.

## Revisión de código (`/code-review` sobre `89f630c`)

| # | Hallazgo | Resolución |
|---|---|---|
| 1 | Filas repetidas por clave única (dos jugadores con igual nombre abreviado, eventos sin número) abortaban la importación | ✅ `persist_game` deduplica como la ingesta anterior (jugador: última ficha; tiro/evento: el primero) |
| 2 | `clutch._is_clutch` sigue comparando con `"OT"` | ↪ Previo a F-11; es alcance de C-06 (siguiente requisito) |
| 3 | Respuesta vieja de Calidad podía pisar la nueva (y publicar otra competencia) | ✅ se descarta si cambió la competencia elegida |
| 4 | Liga quedaba trabada si su competencia se fusionaba o pasaba a borrador | ✅ competencia no elegible → "todas" |
| 5 | Selector de Buscar sin escapar (XSS con nombres de competencia) | ✅ `esc()` |
| 6 | Cambiar el filtro del catálogo conservaba la selección oculta | ✅ se limpia la selección |
| 7 | Filtro del catálogo apuntando a una competencia fusionada | ✅ → "todas" |
| 8 | Lote de 10 podía superar los 180 s de gunicorn con FIBA colgado | ✅ lote de 5 (peor caso 100 s) |
| 9 | Existencia en ON/OFF y cierres sin filtrar borradores | ✅ `_visible` |
| 10 | Competencia inexistente como parámetro daba 404 (docs: 400) | ✅ 400 |
| 11 | Nombre de equipo en Liga/selector según orden de filas (cambia al reprocesar) | ✅ nombre del partido más reciente |
| 12 | Alta/edición de competencia devolvían 0 partidos/equipos | ✅ `competitions.describe` |
| 13 | Se borró la rama `raw["shot"]` | ✗ no aplica: esa clave no existe en los JSON de FIBA (13/13 verificados) y su geometría era incorrecta |
| 14 | "Mover" fallando a mitad no refrescaba el catálogo | ✅ refresca con lo movido |
| 15 | Tamaño de lote y `needs_reprocess` duplicados en frontend/backend | ✅ el backend decide el lote (`game_ids` + `offset`); `ingest.needs_reprocess()` único |

Verificación de las correcciones (copia de la base): 12/12 PASS (#1, #8, #9, #10, #11, #12). Navegador: #4, #5 (el
nombre `Prueba"><img onerror=…>` se ve como texto y no se ejecuta), #6, #7 PASS, 0 errores JS. Suites anteriores
re-ejecutadas: reproceso offline 7/7, competencias 19/19, `test_auth.py` OK, recorrido completo 0 errores y
regresión de la API **sin diferencias** respecto de antes de las correcciones.

## Pendiente de verificación humana
- Probar en dev con usuarios reales: `ADMIN_USERS` con un usuario no admin (acciones ocultas, 403).
- Tras el deploy: entrar a Datos → Calidad y **reprocesar cada competencia** (todos los partidos existentes quedan
  "pendientes de reproceso" hasta hacerlo; mientras tanto se ven igual que antes).
- CA-18 (base vacía) no se probó en navegador: los textos de vacío están en el código.
