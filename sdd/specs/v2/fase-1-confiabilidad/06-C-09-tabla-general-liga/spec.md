# Spec — C-09: Tabla general en Liga

> **ID:** C-09 · **Prioridad:** P1 · **Fase y orden:** 1·06
> **Depende de:** C-11 Grupo 0 ([`../01-C-11-tratamiento-de-nulos/spec.md`](../01-C-11-tratamiento-de-nulos/spec.md)) · F-11 ([`../02-F-11-calidad-datos-competencias/spec.md`](../02-F-11-calidad-datos-competencias/spec.md))
> **Habilita:** F-13 (puntos y desempate configurables), T-06 (`league_standings`)
> **Estado:** Implementado (2026-09-26) — ver [progress.md](progress.md). Spec reordenada al formato de 9 secciones del Paso 1 después de la implementación; los RF/CA conservan su numeración.
> **Fuente:** Especificación v2 §2 · C-09 y §1.3 S2 ([`../../00-especificacion-cliente-v2.md`](../../00-especificacion-cliente-v2.md)) · Arquitectura §1.0 (fila C-09/C-10), §3.2 (`standings.*`), DA-31 ([`../../00-arquitectura-transversal.md`](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal):** *"Incluir tabla de posiciones clásica: PJ, PG, PP y puntos, con 2 puntos por partido
ganado y 1 por partido perdido."* · *"Agregar columna de puntos anotados y puntos recibidos."* Criterio de aceptación: *"La
tabla general ordena por puntos y su suma es coherente con el game log de cada equipo."*

**Qué existía (verificado):** la feature 17 de `dev` (integrada en C-11 Grupo 0) ya agregó a `GET /api/league` los campos
`wins`, `losses`, `table_points`, `pts_for`, `pts_against` y la card "Tabla general" (`_standingsCardHTML` en
`frontend/js/app.js`) arriba del ranking, ordenada por puntos con desempate por diferencia. Los puntos (`2 * wins + losses`)
vivían en la ruta de `backend/app.py` y el orden en el frontend; `games` contaba solo los partidos con fila del rival.

**Qué queda (delta de C-09):**
1. Puntos por resultado y desempate en un único lugar del backend (`stats_engine.py`), para que F-13 los haga
   configurables (DA-31).
2. PJ coherente con PG + PP.
3. Aclaración visible "solo partidos importados" (DA-31).
4. Universo: con varias competencias y "Todas" elegido, la tabla sumaría torneos distintos; se pide elegir una
   (decisión humana "C-09 universo" en [`../../00-decisiones.md`](../../00-decisiones.md)).

## 1. Objetivo
Que la tabla general de cada competencia muestre PJ, PG, PP, puntos, anotados y recibidos coherentes con el game log de
cada equipo, ordenada por puntos, con las reglas de puntuación definidas en un único lugar.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 · C-09 y §1.3 S2 (Liga).
- `docs/api.md` — `GET /api/league`. `docs/frontend.md` — vista Liga. `docs/metrics.md` — definición de PJ/PG/PP no existe:
  se fija en esta spec (§4).
- Arquitectura transversal §3.2 (`standings.win_points`, `standings.loss_points`, `standings.tiebreak`), DA-31.

## 3. Historias de usuario
- **US-1**: Como usuario de la app (entrenador/analista FUBB), quiero ver la tabla de posiciones clásica de una
  competencia (PJ, PG, PP, puntos), para saber cómo está cada equipo en el campeonato.
- **US-2**: Como usuario, quiero ver puntos anotados y recibidos por equipo, para entender de dónde viene la diferencia.
- **US-3**: Como usuario, quiero que la tabla coincida con el game log de cada equipo, para confiar en ella.
- **US-4**: Como usuario, quiero saber que la tabla cuenta solo los partidos importados, para no confundirla con la tabla
  oficial del torneo.

## 4. Requisitos funcionales
- **RF-1**: El sistema DEBE devolver por equipo PJ (`games`), PG (`wins`), PP (`losses`), puntos de tabla
  (`table_points`), `pts_for` y `pts_against` calculados sobre los mismos partidos, con `wins + losses == games`.
  (US-1, US-2, US-3) (Esp. v2 §C-09) (docs/api.md `GET /api/league`)
- **RF-2**: El sistema DEBE calcular `table_points = 2 × PG + 1 × PP` y ordenar la tabla por puntos con desempate por
  diferencia (`pts_for − pts_against`), definiendo ambas reglas en un único lugar del backend y devolviendo la posición de
  cada equipo; el frontend NO DEBE recalcular puntos ni desempates. (US-1) (Esp. v2 §C-09) (DA-31)
- **RF-3**: El sistema DEBE mostrar la aclaración *"Solo partidos importados, no el fixture completo."* junto a la tabla.
  (US-4) (DA-31)
- **RF-4**: Con más de una competencia y "Todas" elegido, el sistema NO DEBE mostrar la tabla sino *"Elegí una competencia
  para ver la tabla general."*, con el selector de competencia en esa misma card; con una sola competencia la tabla se ve
  siempre. (US-1) (decisión humana "C-09 universo")
- **RF-5**: Un marcador igualado (dato corrupto: no existe en FIBA) DEBE contarse como derrota, de modo que PG + PP = PJ
  se sostenga siempre. (US-3)

## 5. Requisitos de datos / API
- **Tablas:** sin cambios de esquema (se calcula desde `team_game_stats`).
- **`GET /api/league`** (existente, modificado): query `competition` opcional. Cada equipo trae `games`, `wins`, `losses`,
  `table_points`, `pts_for`, `pts_against` (ya existentes) y `standings_pos` (**NUEVO**: posición 1..N según RF-2). El
  resto de la respuesta no cambia. Errores: sin cambios.
- Sin endpoints nuevos.

## 6. Estados de UI
Card "Tabla general" en la vista Liga:
- **Loading**: el de la vista Liga (sin cambios).
- **Vacío**: sin partidos importados, el de la vista Liga (sin cambios).
- **Elegir competencia** (NUEVO copy): *"Elegí una competencia para ver la tabla general."* con el selector dentro de la
  card (RF-4).
- **Éxito**: columnas PJ · PG · PP · Pts · PF · PC ordenadas por `standings_pos`, más la nota *"Solo partidos importados,
  no el fixture completo."* (NUEVO copy, a `docs/frontend.md`).
- **Error / sin conexión**: los de la vista Liga (service worker sin cambios de comportamiento).
- **Móvil (< 768 px)**: sin scroll horizontal de página.

## 7. Criterios de aceptación
- **CA-1 (CA del cliente)**: Given Liga con una competencia, When se lee la tabla general, Then ordena por puntos
  (desempate por diferencia) y para cada equipo PJ, PG, PP, PF y PC coinciden con su game log (`GET /api/team/<code>`).
- **CA-2**: Given un resultado empatado en la lista de marcadores de un equipo, Then cuenta como derrota y PG + PP = PJ.
- **CA-3**: Given `?competition=<id>`, Then la tabla solo cuenta partidos de esa competencia.
- **CA-4**: Given dos competencias y "Todas", Then la card pide elegir una; al elegir, muestra su tabla.
- **CA-5**: Given el resto de `GET /api/league`, Then no cambia respecto del estado anterior salvo `standings_pos`.
- **CA-6**: Given 360 px de ancho, Then la vista Liga no tiene scroll horizontal de página y la consola no muestra errores.

## 8. Fuera de alcance
- **Incremento diferido:** editar puntos por victoria/derrota y criterio de desempate desde la UI — se habilita con F-13
  ([`../12-F-13-configuracion/`](../12-F-13-configuracion/)).
- **Incremento diferido:** tabla exportable `league_standings` con orden y paginación del componente común — se habilita
  con T-06 ([`../16-T-06-tablas-completas-exportacion/`](../16-T-06-tablas-completas-exportacion/)).
- Fixture y partidos no importados; tabla oficial del torneo → F-12.
- Reglas de desempate por enfrentamiento directo (ver §9).

## 9. Ambigüedades
- **[DECISIÓN PROPUESTA — confirmar] Desempate.** El cliente no lo define. Se adopta diferencia de puntos
  (PF − PC) (DA-31, aplicada); el reglamento FIBA/FUBB (enfrentamiento directo) queda como opción de F-13 porque exige
  resolver empates múltiples y requiere más datos que la tabla general.
- **[DECISIÓN PROPUESTA — confirmar] Universo.** "Todas" con varias competencias no muestra tabla (decisión humana
  registrada); evita mezclar torneos.
- **[DECISIÓN PROPUESTA — confirmar] Derrota por marcador igualado.** Dato corrupto; se cuenta como derrota para
  preservar PG + PP = PJ (RF-5).
- **[DECISIÓN PROPUESTA — confirmar] Componente de tabla de T-06.** C-09 nace con la card propia de `app.js`; se migra al
  componente común cuando T-06 exista (incremento diferido, §8).
