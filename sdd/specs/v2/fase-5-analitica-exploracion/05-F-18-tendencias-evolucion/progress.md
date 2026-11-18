# Progress — F-18: Tendencias y evolución

> **Estado:** ✅ Implementado para equipo (Game log) y jugador (Tendencias), con exportación CSV/XLSX/PNG/PDF. Quinteto y reemplazo de los gráficos fijos de Resumen (2026-11-17).
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/trends.py` y `GET /api/trends`: series partido a partido (hasta tres métricas), media móvil, referencia del Ø, indicador de tendencia con prueba de Welch, hitos (racha, sede, ausencias de jugadores clave). Activa `trends.default_ma`, `trends.last_n`, `trends.alpha`, `trends.key_players` y `trends.streak_min`.
- `components/trends-panel.js`: selector de series y pares frecuentes, dos ejes, media móvil de 3, 5 o 10, diferencia de puntos, tendencia y PNG. `sw.js` v58.

## Estado de CA
`f18_sim.py` 22/22 y `f18_browser.py` 23/23 (1280 y 360 px), con una base de prueba de 8 clones de los 13 partidos para los indicadores.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | 🔶 | el mismo componente sirve para equipo y jugador y cambia de métrica sin recargar; falta el quinteto |
| Selector de hasta tres series con eje secundario | ✅ | y aviso con tres escalas distintas |
| Pares preconfigurados | ✅ | los tres |
| Diferencia de puntos con línea de cero y color por resultado | ✅ | |
| Media móvil de 3, 5 o 10 | ✅ | sin *k* valores no hay punto; los huecos no cuentan |
| Tendencia con delta y significancia | ✅ | Welch contrastado con un valor conocido (p = 0,347); con menos de 3 partidos con valor por grupo, "muestra insuficiente" |
| Hitos | 🔶 | sede, racha y ausencias; las ausencias no se probaron con datos reales |
| Huecos con razón, nunca 0 | ✅ | |
| Exportar como imagen | 🔶 | PNG sí; PDF y CSV de la serie no |

## Desviaciones
- ~~No reemplaza los gráficos fijos~~: resuelto el 2026-11-17 (modo compacto en Resumen).
- ~~Sin quinteto~~: resuelto el 2026-11-17.
- El indicador usa el cociente de totales de cada grupo para los valores y el delta, y la prueba de Welch sobre los valores por partido.
- Copy sin `t()` (F-21).

## Exportación (2026-11-16)
- Menú Exportar en lugar de "Descargar imagen": CSV/XLSX con la serie partido a partido (fecha, rival, L/V, resultado, diferencia, valor y media móvil de cada métrica) y la cabecera de contexto; PNG/PDF con los dos gráficos como imagen y la misma cabecera. `f18_browser2.py` 16/16 en Chromium (equipo y jugador, 1280 y 360 px).

## Quinteto y gráficos fijos (2026-11-17)
- `/api/trends?entity=lineup&id=EQUIPO:ids`: serie por partido del quinteto (con los jugadores juntos en cancha), +/- del quinteto y Ø de quintetos del mismo tamaño; se abre desde el detalle de un quinteto (Equipo › Quintetos).
- Resumen de Equipo y Jugador: la tarjeta "Evolución por partido" es el mismo componente en modo compacto (OER y DER; puntos y TS%) con "Ver tendencias"; `drawEvolution`/`drawPlayerEvolution` ya no se usan. El componente quedó sin ids fijos (varias instancias a la vez).
- Evidencia: `f18q_sim.py` 7/7 (Σ pts por partido = pts del quinteto = 28; equipo sin cambios); `f18q_browser.py` 16/16 y `f18_browser2.py` 16/16 (Chromium 1280/360 px e inglés).

