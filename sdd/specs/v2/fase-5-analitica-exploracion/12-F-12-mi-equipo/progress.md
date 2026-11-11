# Progress — F-12: Mi equipo

> **Estado:** ✅ Implementado (sección Mi equipo, Datos › Calendario, Fijar equipo y Seguir jugadores, `GET /api/my-team`, `/api/fixtures`, referencia `rival_proximo`).
> **Fecha:** 2026-11-05
> Reglas: `sdd/04-implement.md`.

## Qué se hizo
- Backend: tabla `fixtures` (`database.py`), `fixtures.py` (calendario, próximo partido, vinculación), `my_team.py` (pantalla en una llamada con bloques aislados), rutas `GET /api/my-team`, `GET/POST /api/fixtures`, `PATCH/DELETE /api/fixtures/<id>`; `ingest.persist_game` vincula al importar o reprocesar y `DELETE /api/games` desvincula; `competitions.merge` reasigna el calendario; `phrases.game_plan` resuelve `rival_proximo`; plantillas `cambio_mejora`/`cambio_empeora`; claves `alerts.*` activas y `my_team.*` nuevas.
- Frontend: `components/my-team.js`, `components/my-team-controls.js`, `components/fixtures-manager.js`; sección Mi equipo primera en la barra (en el teléfono Comparar pasa a «Más»); arranque en Mi equipo con equipo fijado; `#/preparar?team=&rival=&fixture=`; botón de equipo fijado en Equipo y de seguir en Jugador; `game-plan.js` con referencia «Rival del próximo partido» y panel propio en Mi equipo; `sw.js` v64.

## Estado de CA
Scripts en el scratchpad (no se commitean): `f12_sim.py` 55/55 (copia de la DB), `f12_auth.py` 8/8 (`AUTH_USERS` + `ADMIN_USERS`), `f12_browser.py` 30/30 (1280 y 360 px, consola limpia).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | con equipo fijado, abrir sin dirección lleva a `#/mi-equipo` sin parámetros ni filtros (`context.applied == {}`) |
| CA-2 | ✅ | dos usuarios con equipos distintos abren cada uno en el suyo; seguidos por usuario |
| CA-3 | ✅ | sin equipo: Liga; Mi equipo muestra el selector y el texto de ayuda |
| CA-4 | ✅ | `#/liga/ranking` se respeta con equipo fijado |
| CA-5 | ✅ | rival, fecha, hora, Local, "faltan 5 días"; Preparar abre `#/preparar?team=ALB&rival=TRO&fixture=1` con los dos equipos elegidos y sobrevive a recargar |
| CA-6 | ✅ | `sin_calendario` / `sin_proximos` sin rival inventado |
| CA-7 | ✅ | con `today` = fecha del partido sigue siendo el próximo; al día siguiente pasa al siguiente |
| CA-8 | ✅ | se vincula al cargarlo si ya estaba importado, al reprocesar (`persist_game`) y se desvincula al borrar el partido |
| CA-9 | ✅ | no admin: 403 `requiere_admin` al crear, editar y borrar; lee el calendario sin controles |
| CA-10 | ✅ | el plan de Mi equipo coincide con `GET /api/game-plan` con el mismo rival; `rival_proximo` sin calendario → 404 `sin_proximo_partido` |
| CA-11 | ✅ | insights = `GET /api/insights` con `last = n`; cambios bruscos = cálculo a mano (z con desvío muestral) |
| CA-12 | ✅ | cambiar `alerts.lookback_days` cambia la ventana de inmediato |
| CA-13 | ✅ | "No hubo partidos en los últimos 7 días." |
| CA-14 | ✅ | ventana de 1 o 2 partidos con badge BAJA; métricas nulas no alertan |
| CA-15 | ✅ | quintetos más usados = `team_lineups` ordenada por minutos |
| CA-16 | ✅ | últimos partidos con marcador y enlace a Analizar |
| CA-17 | ✅ | Seguir ⇄ Siguiendo ✓, aparece en Mi equipo, Dejar de seguir lo quita; máximo truncado |
| CA-18 | ✅ | id inexistente → "Jugador no disponible" sin romper |
| CA-19 | 🔶 | bloques aislados en el backend (`blocks_failed`) y error con Reintentar en la UI; no se simuló un 500 real en el navegador |
| CA-20 | ✅ | equipo con 2 partidos: muestra baja |
| CA-21 | ✅ | 360 px sin scroll horizontal; Mi equipo primera en la barra inferior |
| CA-22 | ✅ | sin sesión 401; modo abierto con dueño `_open` |

## Limitaciones y desviaciones
- Con la base de ejemplo (2 partidos por equipo) los cambios bruscos no tienen resto suficiente: se verificaron con bundles reales en un script.
- La ventana usa `last = n` para los insights; con 1 o 2 partidos A-10 responde `muestra_baja` (se informa).
- Mobile: para dejar Mi equipo primera, Comparar pasó a la hoja «Más» (la barra sigue con 4 secciones + Más).
- El enlace a Preparar es `#/preparar?team=&rival=&fixture=` (la arquitectura decía `#/partido/preparar`, que no existe en el router actual).
- `rival_proximo` en `/api/game-plan` responde 404 `sin_proximo_partido` (F-17 respondía 400 `referencia_no_disponible`).
- Copy sin `t()` (F-21).
