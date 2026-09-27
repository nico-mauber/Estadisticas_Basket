# Spec — C-09: Tabla general en Liga

> **ID:** C-09 · **Prioridad:** P1 · **Fase y orden:** 1·06
> **Depende de:** C-11 Grupo 0 (integración de `dev`) · F-11 (competencias) · **Habilita:** F-13 (puntos y desempate configurables), T-06 (`league_standings`)
> **Estado:** Implementado (2026-09-26) — ver [progress.md](progress.md)
> **Fuente:** Especificación v2 §2 · C-09 y §1.3 S2 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0 (fila C-09/C-10), §3.2 (`standings.*`), DA-31 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

> Spec escrita al implementar: la carpeta del requisito estaba vacía (el resto de la fase tiene spec/plan/tasks previos).

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** *"Incluir tabla de posiciones clásica: PJ, PG, PP y puntos, con 2 puntos por partido
ganado y 1 por partido perdido."* · *"Agregar columna de puntos anotados y puntos recibidos."* Criterio de aceptación: *"La
tabla general ordena por puntos y su suma es coherente con el game log de cada equipo."*

**Qué existe (verificado):** la feature 17 de `dev` (integrada en C-11 Grupo 0) ya agregó a `GET /api/league` los campos
`wins`, `losses`, `table_points`, `pts_for`, `pts_against` y la card "Tabla general" (`_standingsCardHTML`) arriba del
ranking, ordenada por puntos con desempate por diferencia.

**Qué queda (delta):**
1. Puntos por resultado y desempate en un único lugar del backend, para que F-13 los haga configurables (DA-31). Hoy los
   puntos están en `app.py` (`2 * wins + losses`) y el orden en el frontend.
2. PJ coherente con PG + PP: `games` contaba solo los partidos con fila del rival.
3. Aclaración visible "solo partidos importados" (DA-31).
4. Universo: con varias competencias y "Todas" elegido, la tabla suma torneos distintos.

## 1. Objetivo
Que la tabla general de cada competencia muestre PJ, PG, PP, puntos, PF y PC coherentes con el game log, ordenada por
puntos, con las reglas de puntuación en un solo lugar.

## 2. Requisitos funcionales
- **RF-1**: `GET /api/league` DEBE devolver por equipo `games` (PJ), `wins`, `losses`, `table_points`, `pts_for`,
  `pts_against` calculados sobre los mismos partidos, con `wins + losses == games`.
- **RF-2**: `table_points = WIN_POINTS × PG + LOSS_POINTS × PP` (2 / 1) y el orden (puntos, desempate por diferencia
  PF − PC) DEBEN definirse en un único lugar del backend (`stats_engine`), y la respuesta DEBE traer la posición
  (`standings_pos`). El frontend NO DEBE recalcular puntos ni desempates.
- **RF-3**: La card DEBE mostrar "Solo partidos importados, no el fixture completo."
- **RF-4**: Con más de una competencia y "Todas" elegido, la card NO DEBE mostrar la tabla sino "Elegí una competencia
  para ver la tabla general."; el selector de competencia de la vista DEBE estar en esa card. Con una sola competencia la
  tabla se ve siempre.
- **RF-5**: Un marcador igualado (dato corrupto: no existe en FIBA) cuenta como derrota.

## 3. Criterios de aceptación
- **CA-1 (cliente)**: Given Liga con una competencia, When se lee la tabla general, Then ordena por puntos (desempate por
  diferencia) y para cada equipo PJ, PG, PP, PF y PC coinciden con su game log (`GET /api/team/<code>`).
- **CA-2**: Given `standings_row` con un empate, Then cuenta como derrota y PG + PP = PJ.
- **CA-3**: Given `?competition=<id>`, Then la tabla solo cuenta partidos de esa competencia.
- **CA-4**: Given dos competencias y "Todas", Then la card pide elegir una; al elegir, muestra su tabla.
- **CA-5**: Given el resto de `/api/league`, Then no cambia (solo se agrega `standings_pos`).
- **CA-6**: 360 px sin scroll horizontal de página; consola sin errores.

## 4. Fuera de alcance
- Editar puntos y desempate desde la UI → F-13 (`standings.win_points`, `standings.loss_points`, `standings.tiebreak`).
- Tabla exportable `league_standings` → T-06. Fixture y partidos no importados → F-12.
