# Progress — F-18: Tendencias y evolución

> **Estado:** 🔶 Implementado para equipo (Game log) y jugador (Tendencias). Falta el quinteto, la exportación a PDF y CSV, y reemplazar los dos gráficos fijos de evolución.
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
- No reemplaza los dos gráficos de evolución fijos (Resumen de Equipo y Jugador): el nuevo componente está en Game log y en Tendencias.
- Sin quinteto.
- El indicador usa el cociente de totales de cada grupo para los valores y el delta, y la prueba de Welch sobre los valores por partido.
- Copy sin `t()` (F-21).
