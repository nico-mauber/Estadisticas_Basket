# Progress — F-14: Líderes y perfil de la competencia

> **Estado:** ✅ Implementado (pestañas Líderes y Perfil de Liga, `GET /api/leaders`, `GET /api/competition-profile`, tabla `leaders` de T-06 con exportación, claves `leaders.*` activas).
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/competition_profile.py`: líderes sobre la población de jugadores de T-01 y perfil con `league_reference`, mejor valor, ritmo, reparto de tiro y PPP por origen (A-02).
- `GET /api/leaders` (tarjetas o una métrica con todos los que califican) y `GET /api/competition-profile`.
- `leaders.min_minutes` y `leaders.top_n` activas en Configuración.
- `components/leaders-panel.js` y las pestañas **Líderes** y **Perfil** de Liga; métrica y mínimo en la dirección. `sw.js` v54.

## Estado de CA
`f14_sim.py` 26/26 y `f14_browser.py` 29/29 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | cada promedio del perfil (equipos, ritmo, reparto de tiro, jugadores) es igual al `avg` de `/api/rankings` |
| CA-2 | ✅ | el primero coincide con el `leader` de la ficha, y `avg` con el de la ficha |
| CA-3 | ✅ | un mínimo menor al de la población se sube y se informa (`raised`) |
| CA-4 | ✅ | "menos es mejor": líder = valor más bajo; neutral: "Mayor valor" |
| CA-5 | ✅ | competición estándar con marca de empate |
| CA-6 | 🔶 | los conteos van por partido; falta la base de T-04 |
| CA-7 | ✅ | `last` se aplica a la población y la etiqueta lo dice |
| CA-8 | ✅ | `competition=all` → 400 con el mensaje |
| CA-9 | ✅ | población insuficiente: "Población insuficiente para calcular referencias." |
| CA-10 | 🔶 | PPP por origen: media por equipo y peso sobre las posesiones clasificadas; los siete pesos suman 100 % |
| CA-11 | ✅ | los nulos no entran y se cuentan en `excluded_null` |
| CA-12 | ✅ | nadie por debajo del mínimo de la población |
| CA-13 | ⬜ | exportación (tabla `leaders` de T-06) no hecha |
| CA-14 | ✅ | `leaders.top_n` y `leaders.min_minutes` cambian la respuesta sin reiniciar |
| CA-15 | ✅ | 360 px sin scroll horizontal |
| CA-16 | ✅ | `#/liga/lideres?metric=ast&min_minutes=…` reproduce la vista |

## Desviaciones
- Sin tabla `leaders` de T-06 ni exportación; la tabla de una métrica es propia.
- Sin base de normalización (T-04): los conteos van por partido.
- Copy sin `t()` (F-21).

## Tabla `leaders` (2026-11-16)
- T-B7 ✅ `GET /api/table/leaders?metric=&min_minutes=`: mismos jugadores, orden, puesto y valores que `/api/leaders?all=1` (`f14_table.py` 20/20 con PTS, TS% y PER).
- En Liga › Líderes, el modo métrica muestra la tabla completa (orden, columnas, exportación CSV/XLSX/PNG/PDF con cabecera de competencia y filtros); la fila abre la ficha del jugador. Chromium 1280 y 360 px y en inglés (`tables_browser.py`).
- Desvío: los valores son los de ranking de la población (por partido, igual que la ficha); la base de la barra no cambia esta tabla.
