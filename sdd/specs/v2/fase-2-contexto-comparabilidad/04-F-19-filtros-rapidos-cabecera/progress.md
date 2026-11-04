# Progress — F-19: Filtros rápidos y cabecera de contexto

> **Estado:** 🔶 Implementado en Equipo y Jugador (cabecera fija, chips de período, sede y rival, limpiar filtros, aviso "Quedan N de M", `GET /api/context/summary`). Faltan Liga, Comparar y Explorar, que dependen de T-03 y de la navegación X-01.
> **Fecha:** 2026-11-03

## Estado de tareas
- [x] RF-1 · Chips de período: Todos, Últimos 3, 5, 10, 15 (mutuamente excluyentes, el activo resaltado)
- [x] RF-2 · Chips de sede: Todos, Local, Visitante
- [x] RF-3 · Chips de rival: Todos y uno por equipo de la competencia activa, sin el equipo de la entidad
- [x] RF-4 · Los chips reflejan el contexto (URL de T-03), se combinan entre sí y con la barra de filtros, y recalculan toda la vista
- [x] RF-5 · Panel desplegable "Más filtros": es la barra "Filtros" de T-03 (cuarto, marcador, con/sin jugador, descanso); lleva el contador de filtros activos
- [x] RF-6 · Cabecera con nombre, récord V-D, diferencia media con signo, N de M partidos, badge de muestra y etiqueta de filtros
- [x] RF-7 · Cabecera fija al hacer scroll en escritorio y móvil
- [x] RF-8 · Aviso destacado "Quedan N de M partidos" durante unos 4 s; el conteo permanente queda actualizado
- [x] RF-9 · Con 0 partidos la cabecera lo dice y ofrece limpiar los filtros
- [x] RF-10 · "Limpiar filtros" visible con algún filtro activo; conserva la competencia (la base de normalización no se toca)
- [x] RF-11 · Línea secundaria con partidos excluidos (sin jugada a jugada, sin descanso) y filtros no aplicados
- [x] RF-12 · `GET /api/context/summary` (team, player, competition)
- [ ] RF-13 · Copy con `t()` y es-UY: el copy va directo en español (F-21 multi-idioma pendiente); los números usan el formato de la app

## Estado de CA
`f19_sim.py` 22/22 y `f19_browser.py` 51/51 (1280 y 360 px, sin errores de consola).

| Qué se verificó | Estado |
|---|---|
| Récord y diferencia media = los de `/api/team` (ALB 2-0, +12,5) | ✅ |
| Local + Visitante suman los partidos y los récords del total | ✅ |
| Últimos N, sede y rival cambian N sin cambiar M | ✅ |
| Rival sin enfrentamientos: 0 partidos, margen nulo (nunca 0), aviso y botón limpiar | ✅ |
| Jugador: partidos jugados, récord del equipo en esos partidos, badge en minutos | ✅ |
| Cabecera fija al hacer scroll | ✅ |
| Limpiar quita período, sede y rival de la URL | ✅ |

## Desviaciones
- **Sin Liga, Comparar y Explorar:** esas vistas no tienen todavía el contexto global de T-03 ni la navegación de X-01.
- **Las pills "Últ. N" de Equipo** se ocultan: los chips de la cabecera las reemplazan.
- **Selecciones vacías:** los bloques de posesión (origen, transición, segunda oportunidad, reloj) responden 404 `sin_pbp` con un mensaje de "sin play-by-play" cuando el rival elegido no tiene enfrentamientos; la cabecera sí explica el motivo real. Falta ajustar esos mensajes.
- **Copy sin `t()`** (DA-21): F-21 no se hizo.
- **M de "N de M"** es el total de partidos de la entidad en la competencia **sin ningún filtro** (el eco de T-03 también recorta por sede y rival).

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/frontend.md`
