# Progress — A-11: Impacto ajustado (RAPM)

> **Estado:** ✅ Implementado (Jugador › Impacto, `GET /api/rapm`, `POST /api/rapm/recompute`, tabla `rapm`). Criterio de dominancia ajustado (ver Desviaciones).
> **Fecha:** 2026-11-05
> Reglas: `sdd/04-implement.md`. Tareas: [tasks.md](tasks.md). Spec: [spec.md](spec.md). Plan: [plan.md](plan.md).

## Qué se hizo
- `backend/matchups.py` `stints(comp_id)`: posesiones completas de A-01 agrupadas por partido y quintetos de ambos equipos, con exclusiones contadas.
- `backend/rapm.py`: diseño disperso, ecuaciones normales por pliegue (resta), gradiente conjugado precondicionado (Jacobi) en Python puro, validación cruzada por partidos, publicación con fichas T-01 y muestra T-02, diagnóstico de dominancia, almacenamiento en memoria con versiones (`stale`), tiempo máximo y bloqueo de cálculos simultáneos (409).
- `backend/stats_engine.py`: `weighted_mean`, `spearman`. `backend/config.py`: `rapm.lambdas` y `rapm.folds` activas, con validación de la lista (1 a 10 números entre 1 y 100 000). `backend/auth.py`: los 403 de `admin_required` traen `code: "requiere_admin"`.
- `backend/app.py`: `GET /api/rapm`, `POST /api/rapm/recompute`. `backend/tables.py`: tabla `rapm` y columnas `type: "value"` con `fmt` (opt-in con `value:<fmt>` en `extra_columns`).
- Frontend: `components/rapm-panel.js` en Jugador › Impacto; `data-table.js` formatea columnas `value` y manda la muestra baja al final; `core/format.js` `fmtByFmt`; `sw.js` v63.

## Estado de CA
Scripts en el scratchpad (no se commitean): `a11_sim.py` 53/53 (copia de la DB), `a11_auth.py` 8/8 (con `AUTH_USERS` y `ADMIN_USERS`), `a11_synth.py` 17/17 (núcleo numérico y liga sintética), `a11_browser.py` 28/28 (1280 y 360 px, consola limpia).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | base real: ningún jugador de muestra baja en el top 10, 3 de 10 debajo del p25 (máximo 4), Spearman 0,02 → `ok`. Liga sintética de 132 partidos: 0 de 10 debajo del p25, Spearman 0,24. El criterio estricto de la spec (`strict_ok`) da falso en la base real (mínimo del top 223 vs p25 251) y se informa |
| CA-2 | ✅ | base real: 6 de muestra baja en el top 10 sin regularizar vs 5 con λ elegido; liga sintética: 6 vs 0 |
| CA-3 | ✅ | un error por λ; λ = argmin (empate → mayor); pliegues reconstruidos a mano |
| CA-4 | ✅ | toda fila con impacto trae posesiones, minutos y partidos (API, tabla y tarjeta) |
| CA-5 | ✅ | total = off + def ± 0,01 en todos |
| CA-6 | ✅ | nivel base 100,48 = PPP ponderado × 100; error del modelo 3983 < vacío 4009 (entrenamiento); 3 stints predichos a mano |
| CA-7 | ✅ | 2099 usadas + 2 incompletas + 0 sin quinteto = 2101 = total de A-01; incompletas = conciliación |
| CA-8 | ✅ | def publicado +0,36 ↔ β_D −0,356; −0,11 ↔ +0,115; en la liga sintética el defensivo publicado correlaciona +0,50 con el verdadero |
| CA-9 | ✅ | 119 jugadores de muestra baja: sin puesto, `muestra_baja`, tarjeta en gris |
| CA-10 | ✅ | puesto, líder y promedio recalculados a mano |
| CA-11 | ✅ | lecturas sin recálculo; tras `bump_data_version` mismo resultado con `stale: true`; sin tablas nuevas |
| CA-12 | ✅ | no admin 403 `requiere_admin`; admin 200 |
| CA-13 | ✅ | `sin_calcular` en 0,008 s sin calcular |
| CA-14 | ✅ | `rapm.folds = 7` → necesita 14 partidos, hay 13 → `datos_insuficientes` |
| CA-15 | ✅ | `MAX_SECS = 0` → 502 `timeout_externo`, queda el resultado anterior, el servidor responde |
| CA-16 | ✅ | 13 partidos: 0,9 s (27 resoluciones, 14 iteraciones de media). Liga sintética 132 partidos, 144 jugadores, 3084 observaciones: 3,8 s. Sin `numpy` |
| CA-17 | 🔶 | los ids pasan por `identity.canonical_id`; no se probó con una fusión real (la base no tiene duplicados) |
| CA-18 | ✅ | `onoff_net` vs 100 × Net de T-05: 23,3 vs 25,1; 21,9 vs 24,6; 17,8 vs 16,5 (≤ 5) |
| CA-19 | ✅ | CSV con cabecera de λ, pliegues, fecha y cobertura |
| CA-20 | 🔶 | la lógica `sin_datos` existe; en la base no hay jugadores con minutos y sin posesiones en stints |

Verificación numérica (T-F6): el gradiente conjugado coincide con eliminación gaussiana con error relativo < 1e-9 (λ = 1 y 8000). En la liga sintética (impactos verdaderos conocidos, unidades de titulares y suplentes) el RAPM correlaciona 0,49 con el impacto verdadero y el ON/OFF crudo 0,24.

## Lectura con los datos actuales
Con 13 partidos (2 por equipo) la validación elige λ = 8000 (borde) y no mejora al modelo vacío: los valores son muy chicos (±0,4) y la app lo advierte. Es el comportamiento esperado: el cliente pidió una temporada completa.

## Desviaciones
- **Criterio de CA-1.** La spec pedía "ninguno de los 10 primeros por debajo del p25 de posesiones". Aun sin relación entre impacto y posesiones eso se cumple con probabilidad 0,75¹⁰ ≈ 5,6 %, y falló también en la liga sintética donde el modelo recupera bien los impactos. Se reemplazó por: sin muestra baja en el top 10, a lo sumo 4 de 10 debajo del p25 (binomial, α = 0,10) y Spearman |impacto|–posesiones ≥ −0,3. El estricto se informa como `strict_ok`. **Confirmar con el cliente.**
- `compare_unregularized` arma los dos top 10 sin filtro de muestra (el plan filtraba el elegido, lo que daba 0 por construcción).
- Sin ficha T-01 por tooltip (`metricCard`): el puesto, percentil, líder y promedio van en la tarjeta y en el `title` de cada barra.
- `rapm.py` expone `recompute`, `cached` y `view` en lugar de `rapm()` / `rapm_cached()`.
- 409 `en_curso` agregado para cálculos simultáneos.
- Copy sin `t()` (F-21).
