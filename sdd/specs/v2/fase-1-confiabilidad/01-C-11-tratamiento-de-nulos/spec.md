# Spec — C-11: Tratamiento de nulos en toda la app

> **ID:** C-11 · **Prioridad:** P0 · **Fase y orden:** 1·01
> **Depende de:** — (incluye la precondición P-00: integración del Bloque C de la rama `dev`) · **Habilita:** todas las C-xx, F-11 (`../02-F-11-calidad-datos-competencias/`), T-05 (`../13-T-05-conjunto-estandar-metricas/`), T-06 (`../16-T-06-tablas-completas-exportacion/`)
> **Estado:** Implementado — decisiones humanas aplicadas (ver `../../00-decisiones.md`: DA-01, DA-02, DA-07, DA-21, DA-36, C-11 RF-10/RF-11)
> **Fuente:** Especificación v2 §2 · C-11 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0, §2.1, §3.13, §3.20, §5, §7.4, §8, §9.2 P-00 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §2 C-11):** *"Esta regla se aplica a todas las pantallas, sin excepción. Es la corrección de
mayor impacto sobre la confianza en los datos."* Tabla: `0` = *"El dato existe y vale cero"* → *"Se muestra el número 0"*;
`NULL` = *"El dato no existe o no puede calcularse"* (partido no cargado · sin play-by-play para la métrica · jugador sin
minutos (DNP) · la competencia no registra ese dato) → *"Se muestra '—', nunca 0"*. Reglas: *"Un NULL nunca entra en un
promedio ni en un denominador."* · *"Un NULL nunca se ordena como si fuera 0: en tablas ordenables va siempre al final, en
ambos sentidos."* · *"Un NULL nunca se pinta con color de rendimiento (verde/rojo)."* · *"Los partidos con DNP no cuentan como
partido jugado en los promedios del jugador."* La nota del §0 explica el porqué: *"Hoy hay métricas visibles que muestran
valores imposibles (por ejemplo, comparativas de '↑ 9900.0%'…)"*.

**Qué existe hoy (verificado en código):**
- `main` (producción, commit `2b5f14c`): Feature 08 (`sdd/specs/08-nulos-vs-cero/`) ya separó `null` de `0` en el
  **cálculo**: `stats_engine._safe_div` devuelve `None` con denominador 0; `app.py:team_stats`/`player_stats` `_avg` excluyen
  `None`; `app.js` `PCT`/`DEC2`/`statClass` muestran "—" neutro. Quedaron fuera orden, color, DNP y la auditoría.
- Rama `dev` (commit `0cc4de6`, **no mergeada**): la Feature 12 (`dev:sdd/specs/12-nulos-orden-color-dnp/`) cerró 12/12 CA:
  comparador único `dev:frontend/js/app.js:_cmpNullsLast` (l.25) usado en Liga, Cierres y Buscador; predicado
  `dev:backend/stats_engine.py:played(minutes)` (DNP = minutos 0 o ausentes) aplicado en `player_stats`, `team_players` y
  `search_players`; campo `played` en `game_log`; `reb_share`/`uso_pct`/`win_pct` → `None`; `winCls` en Comparar; `charts.js`
  sin `?? 0` en evolución y `_norm` → `null` en el radar. Los otros commits de `dev` (`669250e`, `3c65008`) agregan
  `backend/venv/` y `package-lock.json`: basura que no se integra (arquitectura §1.0, D-02).
- Pendientes verificados en el código de `dev` (lo que queda para esta carpeta):
  - Sentinels: `dev:backend/stats_engine.py:calc_player_stats` devuelve `ast_to = 99.0` (o `inf` → 99.0) cuando `tov == 0`, y
    `def_to_ratio = 99.0` (o `0.0` si además no hubo robos/tapones/rebotes); `calc_team_stats` hace lo mismo con
    `def_to_ratio`. Son el origen del "↑ 9900.0%" (D-12). `[DECISIÓN HUMANA: DA-07]` default: nulo con razón `sin_perdidas`.
  - `dev:frontend/js/app.js:_fourFactorsCard` (l.114): RebOf% del rival = `1-(av.dr_pct||0)` → con `dr_pct` nulo muestra
    **100,0 %** (un nulo convertido en dato).
  - `dev:frontend/js/app.js:_renderUsageRanking` (l.736–738): `p.uso_pct ? … : "—"` y `p.pts ? … : "—"` → un **0 real** se
    muestra como "—" (error inverso: el 0 existe y debe verse).
  - `dev:frontend/js/app.js:_shotDetailGrid` (l.1273): total `(${n ?? 0})` → un total ausente se muestra "(0)".
  - `dev:frontend/js/app.js:_renderTeamContent` (card "Desglose ofensivo"): se oculta si todos los valores son falsy; las
    columnas `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts` (`database.py`, `default=0`) y
    `player_game_stats.plus_minus` (`default=0`; `search_players` agrega `0` si es `None`) no distinguen "la competencia no
    registra el dato" de "vale 0".
  - `dev:frontend/js/charts.js:drawPlayerEvolution` (l.283): el DNP dibuja `pts = 0` (deuda registrada en el progress de la
    Feature 12).
  - `dev:backend/app.py:player_stats` (l.631–644): la población de liga de jugadores recorre **todas** las fichas, incluidas
    las DNP → el Ø de conteos (`pts`, `stocks`, `possessions`) se deprime con ceros de partidos no jugados. **Se rutea a C-02**
    (dueño del promedio de liga), se registra en la auditoría.
  - No existe un contrato "nulo con razón": el frontend no puede decir *por qué* falta un dato (arquitectura §7.4).
  - `frontend/js/app.js` (modal de borrado) todavía pide un token de administrador en `localStorage` (D-19).
  - No existen `frontend/js/core/format.js` ni `core/i18n.js` (arquitectura §3.13, §3.20, §8: dueño C-11).
- `docs/metrics.md` (`dev`, l.5 y l.9) ya documenta "Nulo vs cero" y "Partidos DNP"; `docs/database.md` no fija política de
  nulos para columnas nuevas.

**Qué queda (alcance de esta carpeta):** (1) integrar el Bloque C de `dev` (P-00, Grupo 0 de tasks); (2) sentinels → nulo con
razón; (3) contrato "nulo con razón" en los endpoints legado y en la UI; (4) regla "la competencia no registra ese dato";
(5) política `DEFAULT NULL` para columnas nuevas con dato FIBA (la aplica F-11); (6) helpers compartidos de formato/nulos e
i18n; (7) corregir los hallazgos de la auditoría y (8) el recorrido completo que exige el CA del cliente.

## 1. Objetivo
Que en ninguna pantalla un dato inexistente se comporte como un cero (ni al mostrarse, promediarse, ordenarse ni colorearse),
que un cero real siempre se muestre como 0, y que cada "—" pueda explicar por qué falta el dato.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 C-11 (tabla 0/NULL, 4 reglas, CA) y §0 (nota de confianza); §1.3 S1 "Calidad de datos … campos nulos por
  competencia" (C-11 comparte con F-11).
- `00-arquitectura-transversal.md` §1.0 (estado de `dev`, P-00), §1.5 D-02/D-12/D-19, §2.1 (nulos fuera de numerador,
  denominador y promedio; DNP), §3.13 (módulos ES, `core/`), §3.20 (i18n, formato es-UY, DA-21, DA-36), §5 (columnas nuevas
  `DEFAULT NULL`), §7.4 (códigos de razón), §8 (`core/format.js`, `core/i18n.js`), §9.2 (P-00), §11 DA-01, DA-07.
- `docs/metrics.md` §"Nulo vs cero" y §"Partidos DNP" (versión `dev`); `docs/api.md` §"Nulo vs cero en métricas de tasa";
  `docs/database.md` (defaults `0` de `team_game_stats`/`player_game_stats`); `docs/frontend.md` (placeholder "—").
- Specs previos: `sdd/specs/08-nulos-vs-cero/` (base), `dev:sdd/specs/12-nulos-orden-color-dnp/spec.md` y `progress.md`
  (RF-1…RF-10, deuda), `dev:sdd/specs/15-metricas-jugador/progress.md` (sentinel del `game_log`), `dev:sdd/ROADMAP-bloque-C.md` §3.1.

## 3. Historias de usuario
- US-1: Como entrenador, quiero que un "—" signifique siempre "no hay dato" y un 0 signifique "hubo cero", para no tomar
  decisiones sobre números inventados.
- US-2: Como entrenador, quiero poder ver por qué falta un dato (no jugó, sin play-by-play, la competencia no lo registra),
  para saber si es un problema de carga que se puede arreglar.
- US-3: Como analista, quiero ordenar cualquier tabla y ver primero a quienes tienen dato, en ambos sentidos.
- US-4: Como entrenador, quiero que un nulo nunca aparezca en verde o rojo, para no leer rendimiento donde no hay información.
- US-5: Como entrenador, quiero que los partidos que un jugador no jugó no le bajen los promedios ni aparezcan como un cero
  en su evolución.
- US-6: Como responsable del producto, quiero que la regla quede fijada para todo lo que se construya después (columnas
  nuevas, pantallas nuevas), para que la confianza no se vuelva a perder.

## 4. Requisitos funcionales
- **RF-1**: El sistema DEBE partir del comportamiento del Bloque C ya implementado en `dev` (features 12–18: orden de nulos,
  DNP, nulos en `reb_share`/`uso_pct`/`win_pct`, identidad normalizada, promedios de liga por competencia, indicadores de
  jugador, tiro completo, tabla general, etiquetas y umbral de cierres) sin incorporar archivos de entorno virtual ni
  artefactos de dependencias. · (US-6, Esp. v2 §C-11, Arquitectura §1.0 / §9.2 P-00, DA-01)
- **RF-2**: El sistema DEBE devolver `null` (nunca 0 ni un valor centinela) en toda métrica cuyo cálculo no esté definido, y
  en particular: AS/PER y DEF/TO con cero pérdidas DEBEN ser `null` con razón `sin_perdidas`, tanto por partido como en el
  acumulado, en equipo y en jugador. · (US-1, Esp. v2 §C-11 "no puede calcularse", Arquitectura §7.4, D-12, DA-07) ·
  Regla: `AS/PER = ΣAS / ΣPER`; `DEF/TO = (ROB + TAP + RD) / PER` (`docs/metrics.md` §Scouting defensivo); denominador 0 →
  `null`.
- **RF-3**: Toda respuesta de la API que contenga una métrica nula DEBE poder informar la razón con uno de los códigos
  fijados: `sin_intentos`, `sin_perdidas`, `dnp`, `sin_pbp`, `requiere_posesiones`, `no_registrado`, `sin_coordenadas`,
  `no_aplica`, `sin_datos`, `sin_fecha`, `sin_enfrentamientos`, `sin_universo`, `poblacion_insuficiente`,
  `contexto_no_comparable`. En los endpoints existentes con diccionarios planos la razón viaja en un mapa paralelo
  `null_reasons` `{clave: código}`; el valor sigue siendo `null`. · (US-2, Arquitectura §7.4)
- **RF-4**: Toda celda o card con valor nulo DEBE mostrar "—" con una ayuda (title/tooltip) que diga la razón en español;
  NUNCA el texto `null`, `NaN`, `undefined` ni `Infinity`, y las respuestas JSON NUNCA DEBEN contener `Infinity`/`NaN`. ·
  (US-1, US-2, Esp. v2 §C-11 "Se muestra '—', nunca 0")
- **RF-5**: Todo valor 0 real DEBE mostrarse como 0 (con el formato de la métrica), nunca como "—". · (US-1, Esp. v2 §C-11
  fila "0") · Caso verificado: ranking de uso del equipo.
- **RF-6**: Un nulo NUNCA DEBE convertirse en dato por aritmética derivada en la UI (complementos, restas, sumas): si un
  operando es nulo, el resultado es nulo. · (US-1, Esp. v2 §C-11 regla 1) · Caso verificado: RebOf% del rival en Four
  Factors (`1 − DR%`).
- **RF-7**: Un nulo NUNCA DEBE entrar en un promedio, suma, numerador ni denominador, ni en el backend ni en la UI. ·
  (US-1, Esp. v2 §C-11 regla 1, Arquitectura §2.1)
- **RF-8**: En toda tabla ordenable (cliente o servidor), los registros con nulo en la columna de orden DEBEN quedar al final
  en ambos sentidos, con un único comparador compartido. · (US-3, Esp. v2 §C-11 regla 2)
- **RF-9**: Ningún nulo DEBE recibir color de rendimiento (verde/rojo, ganador/perdedor), tampoco en comparaciones directas
  (Comparar, ON/OFF, Cierres, Four Factors). · (US-4, Esp. v2 §C-11 regla 3)
- **RF-10**: Un partido DNP (minutos 0 o ausentes) NO DEBE contar como partido jugado en ningún promedio ni conteo de
  partidos del jugador, y los gráficos de evolución NO DEBEN dibujar un punto para ese partido en ninguna serie (incluidos
  los conteos): el DNP se ve como un hueco, y el partido sigue en el game log. · (US-5, Esp. v2 §C-11 regla 4,
  `dev:sdd/specs/12-…/progress.md` §Deuda)
- **RF-11**: El sistema DEBE tratar como `no_registrado` un campo de conteo que FIBA **no publica**: si la clave no viene en
  el JSON, la ingesta guarda `NULL` (y `0` solo si FIBA informa 0); el campo se devuelve `null` con razón `no_registrado`
  (por partido y en promedios) y no entra en promedios. Los partidos importados antes se corrigen al reimportar.
  *(Decisión humana 2026-09-26: se descarta la heurística "0 en toda la competencia con ≥ 3 partidos".)* ·
  (US-2, Esp. v2 §C-11 "la competencia no registra ese dato") ·
  Campos alcanzados: `paint_pts`, `second_chance_pts`, `pts_from_tov`, `bench_pts`, `fast_break_pts` (equipo) y
  `plus_minus` (jugador).
- **RF-12**: Toda columna nueva que almacene un dato publicado por FIBA DEBE crearse sin valor por defecto (nulo = "no
  importado todavía"), y la ingesta DEBE escribir 0 solo cuando FIBA informa 0. La regla queda escrita en `docs/database.md`
  y es vinculante para F-11 y los requisitos posteriores. · (US-6, Arquitectura §5, §1.2 "anti-patrón C-11")
- **RF-13**: El formato visible de números DEBE ser uno solo para toda la UI, con coma decimal (es-UY) — p. ej. "60,0%",
  "1,09" — y un único punto de formateo que aplique la regla de nulos. *(DA-21: sin función de traducción en fase 1; el copy
  va en español directo y se extrae en F-21.)* · (US-1, Arquitectura §3.20, DA-36)
- **RF-14**: El modal de borrado de partidos NO DEBE pedir un token de administrador (el backend ya no lo usa). · (US-1,
  Arquitectura D-19)
- **RF-15**: El recorrido completo de la app DEBE quedar auditado pantalla por pantalla y métrica por métrica, con el
  resultado registrado; los hallazgos que pertenecen a otro requisito se registran y se rutean, no se parchan acá. · (US-1,
  Esp. v2 §C-11 CA)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| (ninguna tabla) | — | Sin cambio de esquema. La regla `DEFAULT NULL` (RF-12) se documenta; la aplica F-11 en sus columnas. | No |
| `GET /api/team/<team_code>` | existente (mod.) | `averages.def_to_ratio` y `game_log[].def_to_ratio` → `null` con 0 pérdidas; campos de desglose → `null` si `no_registrado`; **+ `null_reasons`** (nivel raíz, para `averages`) y **`game_log[].null_reasons`** | Campos nuevos |
| `GET /api/player/<team_code>/<player_name>` | existente (mod.) | `game_log[].ast_to`/`def_to_ratio` → `null` (`sin_perdidas`); `game_log[]` DNP con `null_reasons` = `dnp` en tasas; **+ `null_reasons`** | Campos nuevos |
| `GET /api/search/players` | existente (mod.) | `plus_minus` → `null` si `no_registrado`; `def_to_ratio` acumulado; **+ `null_reasons`** por fila | Campos nuevos |
| `GET /api/players/<team_code>`, `GET /api/league`, `GET /api/lineup/*`, `GET /api/onoff/*`, `GET /api/clutch/*`, `GET /api/shots/*` | existentes | Sin cambio de contrato; entran en la auditoría (RF-15) | No |

## 6. Estados de UI
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Toda card/celda con dato nulo | sin cambio | sin cambio | sin cambio | sin cambio (SW sirve los módulos nuevos) | "—" neutro con title = etiqueta de la razón (**copy nuevo**, ver tabla) |
| Four Factors (Equipo) | sin cambio | sin cambio | sin cambio | sin cambio | RebOf% rival "—" si DR% es nulo |
| Ranking de uso (Equipo) | sin cambio | sin cambio | sin cambio | sin cambio | 0 real → "0,0%" / "0,0" |
| Desglose ofensivo (Equipo) | sin cambio | sin cambio | sin cambio | sin cambio | card siempre visible; campos `no_registrado` en "—" |
| Evolución (Jugador) | sin cambio | sin cambio | sin cambio | sin cambio | hueco en partidos DNP; tooltip "No jugó (DNP)" |
| Modal de borrado | sin cambio | — | sin cambio | — | sin campo de token |

**Copy nuevo** (a `docs/frontend.md`; todo vía `t()`): etiquetas de razón — `sin_intentos` "Sin intentos: no se puede calcular" ·
`sin_perdidas` "Sin pérdidas: el cociente no está definido" · `dnp` "No jugó (DNP)" · `sin_pbp` "Sin play-by-play para este
partido" · `requiere_posesiones` "Requiere el motor de posesiones" · `no_registrado` "La competencia no registra este dato.
Si cambió, reimportá sus partidos" · `sin_coordenadas` "Sin coordenadas de tiro" · `no_aplica` "No aplica a esta entidad" ·
`sin_datos` "Sin partidos en la selección" · `sin_fecha` "Partido sin fecha" · `sin_enfrentamientos` "Sin enfrentamientos
registrados" · `sin_universo` "Elegí una competencia para ver el ranking" · `poblacion_insuficiente` "Muy pocos equipos o
jugadores para calcular el percentil" · `contexto_no_comparable` "Con este filtro no se compara contra la competencia".
Copy existente reutilizado: placeholder "—".

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given la app con los partidos del dataset de verificación importados, When se hace el
  *"recorrido completo de la app"* (Importar, Liga, Equipo, Cierres, Combinación, ON/OFF, mapa de tiro de equipo y jugador,
  Jugador, Comparar, Buscar, gráficos de evolución y radar), Then no se encuentra *"un solo 0 que en realidad sea un dato
  inexistente"*, y el checklist por pantalla y métrica queda registrado en `progress.md`.
- **CA-2**: Given la rama de trabajo de v2 con el Grupo 0 integrado, When se listan los archivos versionados, Then no hay
  archivos bajo `backend/venv/` ni `package-lock.json`, y los CA de humo de las features 12–18 (`played` en `game_log`,
  `_cmpNullsLast`, `PtsEnPint`, cierres ≤ 10, `leagues`, `totals`, tabla general) siguen pasando.
- **CA-3**: Given un jugador con un partido jugado con 0 pérdidas, When se consulta su perfil, Then en ese partido
  `ast_to` y `def_to_ratio` son `null` con `null_reasons` = `sin_perdidas`, y en la UI se ve "—" con la ayuda "Sin pérdidas…";
  ninguna respuesta contiene `99.0` para esas claves.
- **CA-4**: Given un equipo con un partido de 0 pérdidas (real o inyectado en una copia de la base), When se consulta
  `/api/team/<code>`, Then `def_to_ratio` de ese partido es `null` (`sin_perdidas`) y no entra en el promedio.
- **CA-5**: Given las tablas de Liga, Cierres y Buscar con al menos un nulo en la columna ordenada (real o inyectado), When se
  ordena ascendente y descendente, Then los nulos quedan al final en ambos sentidos.
- **CA-6**: Given cualquier celda "—", When se inspecciona, Then no tiene clase de rendimiento (`above-avg`, `below-avg`,
  `winner`, `loser`) ni color verde/rojo.
- **CA-7**: Given un equipo cuyo DR% promedio es nulo (inyectado), When se ve Four Factors, Then el RebOf% del rival muestra "—",
  no "100,0%".
- **CA-8**: Given un jugador con USO% o puntos promedio iguales a 0 en el ranking de uso, When se ve la card, Then se ve
  "0,0%"/"0,0", no "—".
- **CA-9**: Given un jugador con al menos un partido DNP, When se abre su perfil, Then los partidos informados son solo los
  jugados, el game log incluye el DNP y el gráfico de evolución no tiene punto (tampoco en PTS) en esa fecha.
- **CA-10**: Given un partido cuyo JSON de FIBA no trae la clave de contraataque (o una copia de la base con
  `fast_break_pts` en `NULL`), When se importa y se abre el equipo, Then el desglose muestra "—" con la ayuda "La competencia
  no registra este dato…" y `/api/team` devuelve `null` con `no_registrado`; cuando FIBA sí manda la clave se ven los
  números (incluidos los 0 reales).
- **CA-11**: Given cualquier vista, When se recorre, Then los decimales se ven con coma ("1,09", "60,0%") y ningún texto
  muestra `null`, `NaN`, `undefined` ni `Infinity`; las respuestas JSON de los endpoints tocados parsean con un parser
  estricto.
- **CA-12**: Given `docs/database.md` al cerrar, When se lee, Then contiene la regla "columnas nuevas con dato FIBA: `DEFAULT
  NULL`; 0 solo si FIBA informa 0", y `docs/metrics.md`/`docs/api.md` describen `null_reasons` y los códigos.
- **CA-13**: Given la vista Importar, When se abre el modal de borrado, Then no pide token y el borrado funciona con la sesión.
- **CA-14**: Given el recorrido de CA-1, When se observa la consola, Then no hay errores JS nuevos (el 404 de `favicon.ico` es
  preexistente).

## 8. Fuera de alcance
- Promedio de liga y su población (incluido el hallazgo "población de jugadores con fichas DNP") → C-02
  (`../11-C-02-promedios-de-liga/`).
- AS/PER acumulado bajo filtros (competencia/últimos N) y su presentación en Equipo → C-04 (`../08-C-04-as-per/`); indicadores
  por posesión/minuto del jugador en pooled → C-01 (`../09-C-01-rebotes-distribucion-jugador/`).
- Totales del detalle de tiro bajo filtro de competencia → C-07 (`../10-C-07-detalle-tiro-completo/`).
- `statBox` que compara conteos con tasas (D-14) → T-01 (la ficha reemplaza el bloque).
- `games.minutes` nunca escrito (PACE con prórroga, D-08) y columnas nuevas de la ingesta v2 → F-11.
- Panel "campos nulos por competencia" en Calidad de datos → F-11 (reutiliza la regla de RF-11).
- Umbrales de muestra y gris por muestra baja → T-02 (C-11 decide solo `null` vs 0).
- Etiquetas de métricas desde el catálogo (`fmtMetric`) → T-05.
- Traducción a otros idiomas y extracción del copy existente → F-21 (C-11 solo crea `t()`).

## 9. Ambigüedades
- [DECISIÓN PROPUESTA — confirmar] **Sentinels (DA-07)**: AS/PER y DEF/TO con 0 pérdidas pasan a `null` con razón
  `sin_perdidas` (también por partido). *Razón*: un 99,0 no es un valor; es lo que produce "↑ 9900.0%". La información "jugó sin
  perder la pelota" sigue visible en la columna PER = 0.
- [DECISIÓN PROPUESTA — confirmar] **Detección de "la competencia no registra ese dato"**: campo en 0 o ausente en todas las
  filas de la competencia con ≥ 3 partidos importados. *Razón*: es la única señal disponible sin cambiar el esquema; a nivel
  competencia es robusta (un equipo puede tener 0 contraataques en un partido, una liga entera en 3+ partidos no). Umbral fijo
  en fase 1; F-11 podrá mostrarlo en Calidad de datos. Hasta que F-11 cree `competitions`, la competencia es el string
  `games.competition`.
- [DECISIÓN PROPUESTA — confirmar] **DNP en evolución**: hueco (sin punto) en todas las series, con el partido presente en el
  eje. *Razón*: el partido existe (la fecha importa para leer la serie) pero no hay rendimiento que dibujar.
- [DECISIÓN PROPUESTA — confirmar] **Formato es-UY en fase 1 (DA-36)**: C-11 cambia el formato de toda la UI a coma decimal
  al centralizar `PCT`/`DEC2`. *Razón*: la arquitectura asigna `fmtNumber` a C-11 y los ejemplos del cliente usan coma.
- [DECISIÓN PROPUESTA — confirmar] **Integración de `dev` (DA-01)** dentro de esta carpeta (Grupo 0), por cherry-pick de
  `0cc4de6` sin los commits de `venv`.
