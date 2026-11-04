# Progress — F-20: Enfrentamiento directo dentro de Equipo

> **Estado:** ✅ Implementado (pestaña Enfrentamiento de Equipo con historial, promedios contra el rival frente a los generales, diferencias más marcadas y enlaces a Preparar)
> **Fecha:** 2026-11-04

## Qué se hizo
- `backend/rival_comparison.py` y `GET /api/rival-comparison` (lista de rivales y comparación).
- `components/versus-panel.js` y la pestaña **Enfrentamiento** de Equipo; el rival viaja en la dirección (`?rival=`).
- `renderPrepare` acepta `team`, `rival` y `focus` para abrir el informe del cruce.
- `sw.js` v54.

## Estado de CA
`f20_sim.py` 17/17 y `f20_browser.py` 23/23 (1280 y 360 px).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | pestaña Enfrentamiento + elegir rival = dos clics |
| CA-2 | ✅ | el historial es el de `/api/h2h` (mismos partidos) |
| CA-3 | ✅ | el general es igual a la ficha de `/api/metrics/team`; el valor contra el rival, igual a `opponent=<rival>` |
| CA-4 | ✅ | 3 a 5 ítems ordenados por `|z|` |
| CA-5 | ✅ | "Ver informe completo" abre Preparar con ambos equipos elegidos |
| CA-6 | 🔶 | "Ver emparejamientos" abre Preparar y baja a la coincidencia en cancha |
| CA-7 | ✅ | rival sin enfrentamientos: `sin_historial`, sin romper |
| CA-8 | ✅ | `rival == team` → 400 "El rival no puede ser el mismo equipo" |

## Desviaciones
- **Sin X-01 completo:** el enlace a Preparar abre `#/preparar` y el rival se pasa por código, no por la dirección `#/partido/preparar?team=&rival=`.
- **Muestra baja:** en vez de ocultar la comparación con menos de `sample.team.min` partidos contra el rival, la muestra con un aviso y el badge.
- **Competencia:** usa la de la vista (no "todas" por defecto): el historial y la comparación comparten el mismo universo.
- **Desvío para `z`:** sale de toda la competencia sin mínimos de muestra, como Preparar.
- **Copy sin `t()`** (F-21).
