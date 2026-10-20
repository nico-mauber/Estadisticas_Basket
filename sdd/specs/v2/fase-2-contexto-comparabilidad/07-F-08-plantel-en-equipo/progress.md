# Progress — F-08: Plantel en Equipo

> **Estado:** ✅ Implementado (tabla completa del plantel, enlace a la ficha y selección para comparar dos jugadores)
> **Fecha:** 2026-10-20

## Estado de tareas
- [x] RF-1 · Tabla `team_roster` con todos los jugadores que disputaron minutos (los convocados sin minutos quedan fuera) y el conjunto estándar completo
- [x] RF-2 · Ficha de T-01 por métrica (percentil contra los jugadores de la competencia)
- [x] RF-3 · Orden, selector de columnas, totales, promedio de competencia, coloreado y exportación (T-06)
- [x] RF-4 · Los jugadores bajo el mínimo se muestran con badge de muestra baja, sin ocultarse
- [x] RF-5 · Cada fila abre la ficha del jugador; «Elegir para comparar» permite marcar dos filas y abrir Comparar › Jugadores con ambos cargados
- [x] RF-6 · Contexto de T-03 y base de T-04
- [x] RF-7 · DNP excluidos del cálculo; nulos con razón, nunca 0
- [x] RF-8 · La tarjeta "Jugadores más influyentes — USO%" se retira; USO% es una columna ordenable de la tabla
- [x] RF-9 · `player_id` entero como id de fila y en el enlace

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| Tabla del plantel | ✅ | LBO: 9 jugadores con minutos; 81 columnas de métricas; sin columna de equipo |
| Percentiles y badge | ✅ | Percentiles por fila; badge en minutos con el umbral de jugador |
| Enlace a la ficha | ✅ | Chromium: tocar una fila abre la ficha del jugador correcto |
| USO% absorbido | ✅ | La tarjeta suelta ya no existe; `uso_pct` es columna de la tabla |
| Contexto y base | ✅ | `venue=local` aplicado; `base=por100` aplicada |
| Exportación | ✅ | CSV con el equipo en el nombre del archivo |
| Comparar desde el plantel | ✅ | Dos filas marcadas abren Comparar › Jugadores con ambos jugadores |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Consola del navegador sin errores JS: ✅ (1280 y 360 px)
- Verificación: `f08_sim.py` 17/17, `f08_browser.py` 26/26, regresión completa en verde

## Desviaciones respecto a docs/ o plan
- **Sin pestaña propia:** no hay router X-01, así que el plantel es un bloque de la vista Equipo, arriba de los quintetos.
- **Reutiliza el buscador:** `team_roster` comparte builder con `search_players` (misma consulta acotada a un equipo), en vez de un builder nuevo.
- **Arreglo de paso:** la ficha de jugador no mostraba el nombre del jugador en ningún lado visible al abrirla; ahora tiene un encabezado con nombre, equipo, posición y partidos.
- **Arreglo de paso:** `onRowClick` de las tablas ahora recibe también el payload, para que una fila pueda leer sus columnas de texto.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/frontend.md`

## Deuda / TODO
- `t()` para el copy (F-21).
