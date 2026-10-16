# Spec — A-11: Impacto ajustado (RAPM)

> **ID:** A-11 · **Prioridad:** P2 · **Fase y orden:** 5·11
> **Depende de:** A-01 ([../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md](../../fase-3-contexto-posesion/01-A-01-motor-posesiones/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md)) · F-07 ([../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md](../../fase-4-dia-de-partido/01-F-07-analizar-partido/spec.md), crea `matchups.py`, §9.1 de la arquitectura) — y, por las capas comunes, F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/spec.md](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)), F-11 ([../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/spec.md)), C-08 ([../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md](../../fase-1-confiabilidad/07-C-08-jugadores-duplicados/spec.md)), T-01 ([../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md](../../fase-1-confiabilidad/15-T-01-ficha-de-metrica/spec.md)), T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md)), X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** —
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §5.4 · A-11 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 S4 "Impacto" · Arquitectura §3.7, §3.10, §3.14, §3.18, §3.21, §4 (`rapm.py`), §6 (`/api/rapm`, tabla `rapm`) ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, §5.4 A-11):**
- "El ON/OFF actual está contaminado por con quién comparte cancha cada jugador."
- "Implementar una regresión ridge sobre stints de posesiones para obtener impacto ofensivo, defensivo y total ajustado por jugador."
- "Lambda determinada por validación cruzada."
- "Requiere al menos una temporada completa de play-by-play; con la base actual de partidos importados es viable."
- "Mostrar siempre junto al número de posesiones del jugador."
- **Criterio de aceptación del cliente:** "El ranking resultante no está dominado por jugadores con pocas posesiones."

El mapa de secciones (§1.3 S4 "Impacto") fija: "+/-, ON/OFF, impacto ajustado, con quién rinde mejor". El orquestador pidió seguir Arquitectura §3.18 (Python puro frente a numpy, caché) y **definir la verificación** del criterio de aceptación.

**Qué existe hoy (verificado en código y docs):**
- `backend/lineups.py` `onoff_stats(games, team_code, player_name)` (l.245) parte los tramos de `build_segments` en ON y OFF por jugador y devuelve OER, DER, Net Rating, eFG% y TS% con diferencia ON − OFF (`docs/api.md` `GET /api/onoff/<team_code>/<player_name>`). Es **crudo**: no descuenta con quién comparte cancha cada jugador ni contra qué rivales juega, que es exactamente la contaminación que describe el cliente (un suplente que juega siempre con titulares muestra un ON/OFF inflado). No hay ninguna regresión ni validación cruzada en el repositorio; el único cálculo estadístico más allá de promedios es la métrica de `stats_engine.py`.
- `backend/lineups.py` calcula tramos con **un solo equipo** (`build_segments(events, team_code, starters)`), sin conocer los cinco rivales en cancha; no hay un objeto "stint" con los diez jugadores.
- `frontend/js/app.js` muestra ON/OFF dentro de la vista Equipo (`renderTeamOnOff`, `docs/frontend.md`); no hay sección de impacto por jugador.
- Dependencias: `backend/requirements.txt` solo lista `flask`, `flask-cors`, `flask-sqlalchemy`, `playwright` y `gunicorn`: no hay `numpy` ni `scikit-learn` (Constitución 2: no agregar dependencias sin justificación medida).

**Qué resolvieron features/requisitos anteriores (de esta misma corrida de specs):**
- A-01: posesiones reconstruidas, **cada una con los cinco jugadores de ambos equipos al inicio** (`own_on_court`/`opp_on_court`) y marca de incompleta; `lineups.build_segments_both`. Es la fuente de los stints.
- F-07 (fase 4): crea `backend/matchups.py` (emparejamientos por coincidencia en cancha). La arquitectura (§3.10) deja a A-11 la función `matchups.stints(comp_id, ctx)` que arma los stints para RAPM.
- T-02: muestra por jugador en minutos (`sample.player.min`/`high`) y exclusión de rankings de la muestra baja; F-13: claves `rapm.lambdas` (grilla de λ) y `rapm.folds` (pliegues) agregadas por A-11 a `CONFIG_SPEC` (Arq. §3.2). F-11: `auth.admin_required`, `cache` versionado.

**Qué queda para A-11:** el cálculo del RAPM (regresión ridge sobre stints con λ por validación cruzada), su cálculo bajo demanda por un administrador con resultado cacheado, la verificación de que el ranking no está dominado por muestras chicas, la presentación en S4 Impacto con las posesiones siempre visibles y la tabla exportable.

## 1. Objetivo
Entregar, por jugador de una competencia, un **impacto ofensivo, defensivo y total ajustado** (RAPM) obtenido con una regresión ridge sobre stints de posesiones y λ elegido por validación cruzada, mostrado siempre junto a las posesiones del jugador y con un ranking que no está dominado por muestras pequeñas.

## 2. Fuentes (trazabilidad)
- Especificación v2 §5.4 A-11 (completo), §1.3 S4 "Impacto", §3 T-01 (ficha, población), T-02 (muestra de jugador), T-05, T-06, §2 C-11 (nulos), §6 Glosario (Posesión, OER, DER, Net Rating, Valor ajustado).
- `docs/api.md` §`GET /api/onoff/<team_code>/<player_name>`; `docs/metrics.md` (OER, DER, Net Rating, posesión); `docs/frontend.md` (vista Equipo → ON/OFF).
- Arquitectura §3.7 (muestra de jugador), §3.10 (`matchups.stints` para RAPM, dueño A-11), §3.14 (`cache`), §3.18 ("RAPM: ridge sobre stints (≈ 12 mil filas × ≈ 360 columnas dispersas). Default Python puro con gradiente conjugado disperso y grilla `rapm.lambdas` × `rapm.folds`, cómputo bajo demanda (acción 'Recalcular' admin) cacheado por (competencia, `data_version`, `config_version`); no se persiste (regla 4). Si el cómputo medido supera 30 s, el plan propone `numpy`"), §3.2 (`rapm.lambdas`, `rapm.folds`), §3.21 (`admin_required`), §4 (`rapm.py`: `rapm(comp_id, ctx) -> dict`), §6 (`GET /api/rapm`, `POST /api/rapm/recompute`, tabla `rapm`), DA-25.
- Specs/planes previos de esta corrida: A-01 `plan.md` §4 (`Possession`, `own_on_court`/`opp_on_court`), F-07 `plan.md` §4.2 (`matchups.py`), T-02 `plan.md` (muestra de jugador), F-13 `plan.md` (`CONFIG_SPEC`).

## 3. Historias de usuario
- US-1: Como entrenador, quiero un indicador de impacto de cada jugador que descuente con quién comparte cancha y contra quién juega, para no sobrevalorar a un suplente que juega con los mejores ni castigar al que rota con unidades flojas.
- US-2: Como analista, quiero ver el impacto ofensivo y el defensivo por separado y su suma, para saber de qué lado aporta cada jugador.
- US-3: Como analista, quiero ver siempre cuántas posesiones respaldan el número, para no tomar como verdad un valor de pocas posesiones.
- US-4: Como analista, quiero que el ranking no esté dominado por jugadores de pocas posesiones, para poder usarlo como lista de referencia.
- US-5: Como administrador, quiero recalcular el impacto cuando importo partidos nuevos y ver con qué parámetros se calculó, para mantenerlo al día y auditarlo.
- US-6: Como analista, quiero comparar el impacto ajustado con el ON/OFF crudo del mismo jugador, para ver cuánto cambia la lectura al descontar la contaminación.

## 4. Requisitos funcionales

**Modelo**
- RF-1: El sistema DEBE calcular, para cada jugador de una competencia, tres valores de impacto —**ofensivo, defensivo y total**— mediante una **regresión ridge sobre stints de posesiones**: cada observación es un stint (cinco jugadores atacando contra cinco defendiendo) con sus posesiones y puntos, y cada jugador aporta dos incógnitas (impacto cuando está en cancha atacando e impacto cuando está defendiendo). · (US-1, US-2) (Esp. v2 §A-11)
- RF-2: La variable respuesta de cada observación DEBE ser **puntos por 100 posesiones** del lado atacante, ponderada por sus posesiones; la regresión DEBE incluir un nivel base (promedio de la competencia) sin penalizar. Un stint genera una observación por cada lado que tuvo al menos una posesión. · (US-1) (Esp. v2 §A-11; Arq. §3.10 `stints`)
- RF-3: El impacto se expresa en **puntos por 100 posesiones sobre el promedio de la competencia**: **ofensivo** positivo = mejora el ataque; **defensivo** positivo = reduce los puntos del rival (signo orientado: "positivo = mejor" como en T-01); **total = ofensivo + defensivo**. · (US-2) (Esp. v2 §A-11; DA-09)
- RF-4: El parámetro de regularización λ DEBE elegirse por **validación cruzada** sobre la grilla configurable (`rapm.lambdas`, por defecto 500, 1000, 2000, 4000, 8000) con `rapm.folds` pliegues (por defecto 5), asignando **los partidos completos** a pliegues (sin mezclar stints de un mismo partido entre entrenamiento y validación) y eligiendo el λ de menor error ponderado de validación. · (US-1) (Esp. v2 §A-11 "Lambda determinada por validación cruzada"; Arq. §3.2)
- RF-5: Los stints DEBEN armarse con las posesiones **completas** de A-01 que tienen los cinco jugadores de ambos equipos identificados; las posesiones incompletas y las de quinteto desconocido quedan fuera y se informan como cobertura (`posesiones usadas / posesiones totales`), nunca imputadas. · (US-1) (Esp. v2 §A-01; C-11)
- RF-6: El universo de cálculo DEBE ser **una competencia** completa (todos sus partidos con pbp); el resultado no cambia con filtros de contexto (período, sede, rival, cuarto…), que se informan como no aplicables. · (US-1) (Esp. v2 §A-11 "una temporada completa"; Arq. §3.1)

**Presentación y ranking**
- RF-7: El sistema DEBE mostrar, junto a cada valor de impacto, **las posesiones del jugador** (ofensivas, defensivas y total en los stints usados), sus minutos y partidos, sin excepción: no existe una vista que muestre el impacto sin esas cifras. · (US-3) (Esp. v2 §A-11 "Mostrar siempre junto al número de posesiones")
- RF-8: El sistema DEBE ofrecer el **ranking por impacto total** de la competencia con puesto sobre el total, y mostrar la ficha de T-01 (ranking, distancia al líder y al promedio, percentil) para ofensivo, defensivo y total, con la población de jugadores que alcanzan el mínimo de muestra de T-02 (`sample.player.min`). · (US-4) (Esp. v2 §T-01)
- RF-9: Los jugadores por debajo del mínimo de muestra de T-02 DEBEN mostrarse **en gris**, con advertencia y badge BAJA, y quedar **fuera del ranking** y de la población de percentiles. · (US-4) (Esp. v2 §T-02)
- RF-10: El sistema DEBE **demostrar** que el ranking no está dominado por muestras pequeñas con una verificación numérica incluida en la respuesta (diagnóstico): entre los 10 primeros por impacto total, ninguno tiene menos posesiones que el percentil 25 de las posesiones de los jugadores del ranking; además informa la correlación de rangos entre |impacto| y posesiones y, como referencia, cuántos jugadores de muestra baja entrarían al top 10 con una regularización mínima. · (US-4) (Esp. v2 §A-11 criterio de aceptación; orquestador: "definir verificación")
- RF-11: El sistema DEBE mostrar, junto al RAPM de cada jugador, su **ON/OFF crudo** (Net Rating del equipo con el jugador en cancha) para comparar. · (US-6) (Esp. v2 §A-11 "El ON/OFF actual está contaminado")
- RF-12: Si el λ elegido es el **extremo** de la grilla, o si la validación cruzada no mejora el error de un modelo sin jugadores (todo en 0), el sistema DEBE advertirlo ("ampliar la grilla de λ" o "muestra insuficiente para validar"), sin ocultar el resultado. · (US-5) (Esp. v2 §A-11)

**Cálculo, caché y permisos**
- RF-13: El cálculo DEBE ejecutarse **bajo demanda** mediante una acción "Recalcular" reservada a administradores, y su resultado DEBE cachearse en memoria asociado a la competencia, a `data_version` y a `config_version`; **no se persiste** en la base de datos. Una consulta de lectura nunca dispara el cálculo. · (US-5) (Arq. §3.18, §3.21; Constitución 4)
- RF-14: Si el resultado cacheado corresponde a una versión de datos o de configuración anterior, el sistema DEBE seguir mostrándolo con la marca "desactualizado" y la invitación a recalcular. Si todavía no se calculó, DEBE decirlo y ofrecer la acción solo a administradores. · (US-5)
- RF-15: La respuesta DEBE documentar con qué se calculó: λ elegido, grilla, pliegues, curva de error por λ, cantidad de stints, jugadores, partidos, cobertura de posesiones, duración del cálculo y fecha, de modo que el cálculo sea auditable. · (US-5) (Esp. v2 §A-11)
- RF-16: El sistema DEBE terminar el cálculo dentro de un **tiempo máximo** seguro respecto del tiempo de espera del servidor; si lo supera, DEBE abortar con un error legible que explique cómo reducir el costo (grilla más corta) y no dejar el proceso colgado. · (US-5) (Arq. §3.14, §3.18, R-02)
- RF-17: Una competencia con menos partidos con pbp que **el doble de pliegues** DEBE devolver el estado "datos insuficientes" con el motivo, sin calcular. · (US-5) (Esp. v2 §A-11 "al menos una temporada completa")

**Capas comunes**
- RF-18: Los jugadores DEBEN identificarse por `player_id` (sin duplicados por variantes del nombre); un jugador que cambió de equipo dentro de la competencia tiene una ficha por equipo y por lo tanto un valor por equipo. · (US-1) (Esp. v2 §C-08; Arq. §3.4)
- RF-19: El sistema DEBE ofrecer la tabla completa `rapm` (T-06) con una fila por jugador, el conjunto estándar de T-05 y las columnas de impacto y posesiones, ordenable, con coloreado por percentil y exportable con los parámetros del cálculo documentados en la cabecera. · (US-4) (Esp. v2 §T-06)
- RF-20: Todo valor sin base de cálculo DEBE mostrarse nulo con razón (`sin_datos`, `muestra_baja`, `no_calculado`), nunca 0. Un jugador sin posesiones en stints usados no tiene valor. · (US-3) (C-11)

## 5. Requisitos de datos / API
| Tabla / Endpoint | Tipo | Campos / Shape | ¿Nuevo? |
|---|---|---|---|
| `GET /api/rapm?competition=<id>` (+ `player=<player_id>`) | endpoint (Arq. §6) | `{status, players: [{player_id, off, def, total, possessions, …}], lambda, folds, …}`; el shape completo lo fija `plan.md` §3 | **NUEVO** (ruta fijada en Arq. §6; shape ampliado por el plan) |
| `POST /api/rapm/recompute` **A** | endpoint (Arq. §6, `admin_required`) | body `{competition}` → mismo payload que el GET | **NUEVO** |
| `GET /api/table/rapm` (T-06) | tabla (Arq. §6) | una fila por jugador con el conjunto estándar y columnas de impacto (payload §7.6) | **NUEVO** (id fijado en Arq. §6) |
| `matchups.stints(comp_id, ctx)` | función backend (Arq. §3.10) | `[{home_on, away_on, poss_home, poss_away, pts_home, pts_away}]` | **NUEVO** (dueño A-11, en el módulo de F-07) |
| `rapm.lambdas`, `rapm.folds` | claves de configuración (Arq. §3.2) | json lista · int | **NUEVO** (se agregan a `CONFIG_SPEC`, sección Umbrales) |

Sin cambios de esquema (Arq. §5: A-11 es on-the-fly y **no persiste** coeficientes).

## 6. Estados de UI
S4 Jugador → pestaña **Impacto** (`#/jugador/<id>/impacto`). Copy nuevo marcado `(nuevo)` para `docs/frontend.md`.

| Vista / componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Tarjeta de impacto ajustado | spinner + "Cargando impacto ajustado…" (nuevo) | "El impacto ajustado todavía no se calculó." (nuevo); admin: botón "Calcular impacto ajustado" (nuevo); no admin: "Pedile a un administrador que lo calcule." (nuevo) · "Este jugador no tiene posesiones suficientes en los stints." (nuevo) | 5xx "No se pudo cargar el impacto ajustado." (nuevo) | "Sin conexión: el impacto ajustado necesita conexión." (nuevo) | ofensivo, defensivo y total con posesiones, minutos, partidos, ranking X.º de N, percentil, badge de muestra y ON/OFF crudo al lado |
| Estado "datos insuficientes" | — | "Hacen falta al menos {n} partidos con play-by-play para validar el modelo." (nuevo) | — | — | — |
| Banner de desactualizado | — | — | — | — | "Los datos cambiaron desde el último cálculo ({fecha}). Recalculá para actualizar." (nuevo) |
| Acción "Recalcular" (admin) | botón deshabilitado + "Calculando… puede tardar hasta un minuto." (nuevo) | — | 502 "El cálculo superó el tiempo máximo. Reducí la grilla de λ en Configuración." (nuevo) · 403 "Solo un administrador puede recalcular." (nuevo) | idem | toast "Impacto ajustado recalculado." (nuevo) y recarga del bloque |
| Muestra baja | — | — | — | — | tarjeta en gris con badge BAJA, advertencia y sin ranking |
| Advertencias de modelo | — | — | — | — | "El λ elegido está en el borde de la grilla: ampliá la grilla." / "La validación no mejora el modelo vacío: la muestra es insuficiente." (nuevo) |
| Ranking completo / tabla | skeleton | "Sin jugadores con muestra suficiente." (nuevo) | toast del backend | — | `data-table.js` con exportación (T-06) |
| Detalles del modelo | — | — | — | — | panel plegable con λ, grilla, pliegues, curva de error, cobertura, duración, verificación del ranking |
| Valor nulo | — | "—" con `title` = razón | — | — | sin color de rendimiento |

Mobile (<768 px): tarjeta apilada, barras de ofensivo/defensivo/total a ancho completo, tabla con primera columna fija; sin cambios en la nav inferior.

## 7. Criterios de aceptación
- CA-1 **(CA del cliente)**: "El ranking resultante no está dominado por jugadores con pocas posesiones." Given el RAPM calculado de una competencia, When se obtiene el ranking por impacto total, Then ninguno de los 10 primeros tiene menos posesiones que el percentil 25 de las posesiones de los jugadores del ranking (`diagnostics.dominance.ok == true`), y todos los jugadores del ranking alcanzan el mínimo de muestra de T-02.
- CA-2 (regularización efectiva): Given el mismo conjunto de stints, When se compara el top 10 del λ elegido con el de un λ mínimo de la grilla dividido por 100 (casi sin regularizar), Then el diagnóstico informa cuántos jugadores de muestra baja entrarían al top 10 sin regularizar y cuántos con el λ elegido; con el λ elegido, ese número es menor o igual (`diagnostics.compare_unregularized`).
- CA-3 (λ por validación cruzada): Given `rapm.lambdas = [500, 1000, 2000, 4000, 8000]` y `rapm.folds = 5`, When se consulta `cv`, Then hay un error de validación por cada λ de la grilla, el `lambda` informado es el de menor error (empates → el mayor λ) y cada partido pertenece a un solo pliegue (los pliegues se reconstruyen a mano a partir de `folds_by_game`).
- CA-4 (posesiones siempre visibles): Given cualquier vista o tabla con valores de impacto, When se la inspecciona, Then toda fila/tarjeta con `off`, `def` o `total` muestra también `possessions` (y `minutes`/`games`); no existe respuesta de la API con impacto sin posesiones.
- CA-5 (total = ofensivo + defensivo): Given cualquier jugador del resultado, When se suman `off` y `def`, Then el resultado es `total` (tolerancia de redondeo ≤ 0,01).
- CA-6 (consistencia del modelo): Given el resultado, When se recalcula a mano (script ad hoc) el valor predicho de 3 stints con los coeficientes publicados (`intercept + Σ O + Σ D`) y se lo compara con el valor observado, Then el error cuadrático ponderado global del ajuste es menor que el del modelo vacío (solo nivel base), y el nivel base (`model.intercept`) coincide con el PPP promedio ponderado de la competencia por 100 (± 0,1).
- CA-7 (cobertura): Given una competencia con posesiones incompletas, When se consulta `model`, Then `possessions_used + excluded.incompletas + excluded.sin_quinteto = possessions_total` y la cobertura es `used/total`; las posesiones excluidas coinciden con la conciliación de A-01.
- CA-8 (signo defensivo): Given dos jugadores con `def` positivo y negativo, When se revisa la regresión, Then el de `def` positivo corresponde a una columna defensiva (D) con coeficiente **negativo** (reduce los puntos del rival): el signo se invierte al publicar; verificable con la tabla de coeficientes crudos del script ad hoc.
- CA-9 (muestra T-02): Given un jugador por debajo de `sample.player.min` minutos, When se ve su tarjeta y el ranking, Then aparece en gris, badge BAJA, `ranked: false`, y no figura en `GET /api/rankings/…` ni en el ranking de la tabla.
- CA-10 (ficha T-01): Given el impacto total de un jugador con muestra suficiente, When se pasa el cursor, Then se ve el puesto sobre el total de la población, el líder, el promedio y el percentil, coincidentes con la tabla `rapm`.
- CA-11 (caché y no persistencia): Given el resultado calculado, When se consulta `GET /api/rapm` repetidas veces, Then no se recalcula (misma `computed_at`); When se importa un partido nuevo, Then la siguiente consulta devuelve el mismo resultado con `stale: true`; y la base de datos no contiene tablas ni columnas nuevas con coeficientes.
- CA-12 (acción administrada): Given un usuario que no es administrador (con `ADMIN_USERS` definida), When llama a `POST /api/rapm/recompute`, Then recibe 403 `requiere_admin`; con un administrador responde 200 con el resultado nuevo y `computed_at` actualizado.
- CA-13 (lectura nunca calcula): Given una competencia sin cálculo previo, When se llama a `GET /api/rapm`, Then responde 200 `status: "sin_calcular"` en menos de 1 s, sin disparar el cálculo.
- CA-14 (datos insuficientes): Given una competencia con menos partidos con pbp que el doble de `rapm.folds`, When un administrador pide recalcular, Then responde `status: "datos_insuficientes"` con el motivo y no calcula.
- CA-15 (tiempo máximo): Given una grilla artificialmente grande (p. ej. 30 valores de λ), When se recalcula, Then el cálculo se aborta antes del tiempo máximo con 502 `timeout_externo` y el mensaje de la spec §6, y el servidor sigue respondiendo.
- CA-16 (rendimiento, DA-25): Given la competencia más grande disponible (los 13 partidos del seed y, si existe, una competencia de ~200 partidos), When un administrador recalcula, Then el tiempo se registra en `progress.md`; si supera 30 s, se documenta la decisión sobre `numpy` (dependencia opcional justificada por la medición).
- CA-17 (identidad, C-08): Given un jugador con dos grafías de nombre, When se ve el resultado, Then aparece una sola fila con sus posesiones sumadas.
- CA-18 (comparación con ON/OFF): Given un jugador, When se ve su tarjeta, Then se muestra su Net Rating en cancha crudo en puntos por 100 posesiones (`onoff_net`) con su RAPM total al lado, y `onoff_net` coincide con 100 × `net_rating` de `GET /api/metrics/player?id=<player_id>` (T-05, Net del equipo con el jugador en cancha) dentro de ±5 puntos por 100 posesiones (la diferencia admitida proviene de que A-11 usa posesiones reconstruidas y T-05 la fórmula del glosario, que A-01 concilia dentro de ±2 %); la diferencia observada se registra en `progress.md`.
- CA-19 (exportación, T-06): Given la tabla `rapm`, When se exporta a CSV, Then el archivo reproduce filas y columnas visibles y su cabecera documenta competencia, λ, pliegues, fecha del cálculo y cobertura.
- CA-20 (nulos): Given un jugador sin posesiones en stints usados, Then sus valores son "—" con razón `sin_datos` (nunca 0) y no entra al ranking.

## 8. Fuera de alcance
- **Intervalos de confianza / error estándar por jugador** (bootstrap o aproximación bayesiana): no está en el pedido; el criterio de aceptación se cubre con regularización + mínimo de muestra + diagnóstico. Posible mejora de v3.
- **Ventaja de localía** como término del modelo, **decaimiento temporal** y **a priori informativo** (box score): la versión base es ridge con nivel base común; se documenta como limitación en `docs/metrics.md`.
- RAPM **por contexto** (cuarto, sede, rival) o por temporada anterior: el universo es la competencia completa.
- RAPM de quintetos o parejas: A-08 y F-06 cubren parejas y quintetos con su propio ajuste (T-02).
- Persistir coeficientes en la base: prohibido por Constitución 4 (no se calculan métricas en disco).
- Cálculo automático al importar partidos: v2 lo deja como acción administrada.
- **Dependencia `numpy`:** solo si la medición de CA-16 supera 30 s (DA-25); se decide en el cierre con evidencia, no en este spec.

## 9. Ambigüedades
1. [DECISIÓN PROPUESTA — confirmar] **Verificación del criterio "no dominado por pocas posesiones".** El cliente no define cómo medirlo. Decisión: (a) mínimo de muestra de T-02 para entrar al ranking, (b) ninguno de los 10 primeros por debajo del percentil 25 de posesiones del ranking, (c) correlación de rangos |impacto|–posesiones informada, (d) comparación con una regularización mínima (RF-10, CA-1, CA-2). Si el cliente prefiere un umbral absoluto de posesiones, cambia el parámetro de (b).
2. [DECISIÓN PROPUESTA — confirmar] **Unidad y signo.** Puntos por 100 posesiones sobre el promedio de la competencia; defensivo con signo orientado ("positivo = mejor"), igual que T-01 con DER. Ofensivo + defensivo = total.
3. [DECISIÓN PROPUESTA — confirmar] **"Posesiones del jugador"** = posesiones (ofensivas + defensivas) de los stints usados en las que el jugador estaba en cancha; se informan también por lado. No es lo mismo que las posesiones del box (fórmula de jugador) ni que `plays`.
4. [DECISIÓN PROPUESTA — confirmar] **Elección de λ:** el de menor error de validación; empates → el mayor (más conservador); si es el extremo de la grilla se advierte (RF-12). La grilla y los pliegues se leen de configuración (`rapm.lambdas`, `rapm.folds`), no del código.
5. [DECISIÓN PROPUESTA — confirmar] **Atribución del quinteto al inicio de la posesión.** Los cambios dentro de una posesión (p. ej. antes de tiros libres) se atribuyen al quinteto del inicio, como hace A-01; se informa el porcentaje de posesiones con cambio (`lineup_changed`) en el diagnóstico.
6. [DECISIÓN PROPUESTA — confirmar] **Universo y contexto:** solo `competition`; los filtros de T-03 se ignoran con razón `no_aplica`. Razón: segmentar la muestra de un modelo con ~360 incógnitas lo vuelve inestable.
7. [DECISIÓN PROPUESTA — confirmar] **Cálculo bajo demanda y caché volátil.** Tras un reinicio o un despliegue el resultado desaparece (la caché es de memoria y no se persiste) y un administrador debe recalcular; con varios workers de gunicorn cada proceso tiene su propia caché (por eso DA-28 recomienda 1 worker). Se reporta como riesgo.
8. [DECISIÓN PROPUESTA — confirmar] **Datos insuficientes:** menos de `2 × rapm.folds` partidos con pbp en la competencia → no se calcula (no hay forma de validar). No agrega una clave nueva: deriva de `rapm.folds`.
9. [DECISIÓN PROPUESTA — confirmar] **Jugador con varias fichas** (cambió de equipo en la misma competencia): una ficha por equipo (C-08 no vincula fichas de equipos distintos), por lo que el modelo estima un coeficiente por ficha. Se documenta como limitación.
10. [DECISIÓN PROPUESTA — confirmar] **Python puro frente a numpy.** Se arranca en Python puro (gradiente conjugado disperso) según DA-25; la decisión sobre `numpy` se cierra con la medición de CA-16. Hasta entonces el spec no pide ninguna dependencia nueva.
