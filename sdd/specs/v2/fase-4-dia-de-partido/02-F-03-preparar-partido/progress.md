# Progress — F-03: Preparar partido

> **Estado:** 🔶 Implementado y verificado (backend 27/27, Chromium 32/32 en 1280 y 360 px); falta revisión con datos de QA (el seed local no tiene equipos que se hayan enfrentado dos veces) y confirmar con el cliente los puntos de §9
> **Fecha:** 2026-10-17
> Reglas: `sdd/04-implement.md`. Spec: [spec.md](spec.md) · Plan: [plan.md](plan.md) · Tasks: [tasks.md](tasks.md)

## Estado de tareas

### Grupo A — Backend: módulo `prepare.py`
- [x] T-A1 · `head_to_head(team_a, team_b, comp_id)` — todas las competencias visibles, más reciente primero, orientado a `team_a`
- [x] T-A2 · `_advantages_and_threats` — 15 duelos con percentiles de T-01 (ver desviaciones: sin `phrases.py`)
- [x] T-A3 · `_rival_threats` — top USO% (solo jugadores del rival), zonas de `zones_with_stats` + mejor zona por PPT, reparto de puntos
- [x] T-A4 · `_matchups_block` — `matchups.team_matchups` en 3 niveles + jugador-quinteto en sentido inverso
- [x] T-A5 · `prepare_report` — filtro `last` sobre el rival, caché `cache.memo("prepare", …)`
- [x] T-A6 · `report.default_last_n` — no se agregó la clave: default embebido (todos), como permite el plan

### Grupo B — Backend: rutas
- [x] T-B1 · `GET /api/prepare`
- [x] T-B2 · `GET /api/h2h`
- [x] T-B3 · Validaciones 400/404

### Grupo C — Frontend: api.js
- [x] T-C1 · `api.prepare()` / `api.h2h()`

### Grupo D — Frontend: UI
- [x] T-D1 · Selector inicial (equipo, rival, partidos del rival)
- [x] T-D2 · Sección `preparar` con botón en la navegación (sin router X-01)
- [x] T-D3 · Encabezado
- [x] T-D4 · Ventajas / Amenazas
- [x] T-D5 · Quintetos rivales (top 8 + ver todos)
- [x] T-D6 · Amenazas ofensivas (mapa de zonas de C-03 reutilizado)
- [x] T-D7 · Head to head (fila → Analizar)
- [x] T-D8 · Tabla de coincidencia en cancha — dentro de `prepare-report.js` (no se creó `matchup-table.js`: F-07 no tenía componente reutilizable y hoy tiene un solo consumidor)
- [x] T-D9 · Selector "con qué cinco salgo" e inverso
- [x] T-D10 · Historial por cruce con enlace a Analizar
- [x] T-D11 · Sugerencia por perfil: no se renderiza (`suggestions_profile: null`)
- [x] T-D12 · Exportación PDF A4 / PNG 1080 px / CSV

### Grupo E — Errores, estados vacíos, offline/SW
- [x] T-E1 · Estados vacíos por bloque
- [x] T-E2 · Error general / sin conexión con reintentar
- [x] T-E3 · `sw.js` v32 con `prepare-report.js`

### Grupo F — Verificación de feature
- [x] T-F1 · Backend arranca sin traceback
- [x] T-F2 · `upgrade_db()` — N/A
- [x] T-F3 · Endpoints probados (`prepare_sim.py`, 27/27)
- [x] T-F4 · Chromium (Playwright) 1280 px y 360 px: 0 errores de consola (`prepare_browser.py`, 32/32)
- [ ] T-F5 · Recorrido con datos reales de QA

## Estado de CA (gate de aceptación)

Datos de prueba: copia de la base con un segundo LAG–TAB (el raw de 2849343 con id 9999991 y fecha 2026-06-20), porque el seed no tiene ningún par de equipos con dos enfrentamientos.

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | En frío 5,5–7,4 s (13+1 partidos); PDF y PNG legibles sin la app (revisados visualmente) |
| CA-2 | ✅ | 5 + 5 ítems con métrica, valores, percentiles, diferencia y lectura; percentil = `population.percentile` de T-01 |
| CA-3 | ✅ | Orden y quintetos = `lineups.all_lineups("TAB")` por minutos (26) |
| CA-4 | ✅ | Mejor zona por PPT (zona restringida, 1,27); por tipo de tiro suma 235 = PTS del rival |
| CA-5 | ✅ | H2H: 2 partidos, más reciente primero, récord 2–0; fila → Analizar |
| CA-6 (cliente) | ✅ | Elegir un quinteto propio ordena los rivales por Net del cruce; el inverso lista los propios |
| CA-7 | ✅ | Cruces inexistentes = "Sin datos" (14 en la prueba), nunca 0, al final de la lista |
| CA-8 | ✅ | Muestra baja en gris con badge y ± visible, ordenada después de los recomendables |
| CA-9 | ✅ | Fila de cruce → 2 partidos enlazados → Analizar |
| CA-10 | ✅ | Sin "marcaje" en la respuesta ni en la vista; leyenda fija visible |
| CA-11 | ✅ | PDF A4 de 2 páginas (Chromium `page.pdf`) |
| CA-12 | ✅ | PNG 1080 × 2150, vertical |
| CA-13 | ✅ | CSV con cabecera T-06 + ventajas/amenazas, quintetos rivales y cruces |
| CA-14 | ✅ | `last=1`: rival 1 de 3, cruces solo de ese partido, H2H sin cambios |
| CA-15 | ✅ | 400 sin rival / mismo equipo / sin equipo / `last` inválido; 404 equipo inexistente |
| CA-16 | ✅ | LAG vs OLI: H2H y cruces vacíos con su copy, resto del informe visible |

## Gates técnicos
- Backend arranca sin traceback: ✅
- Sin cambios de esquema: ✅
- Regresión `game_matchups` tras extraer `_matchup_rows`: 78 comparaciones (13 partidos × 3 niveles × 2 lados) idénticas a la versión anterior (solo se agrega `net_band`)
- F-01/F-02 sin regresión: `live_sim.py` 29/29, `momentum_sim.py` 32/32, `browser_check.py` 46/46
- `node --check`: ✅

## Desviaciones respecto a docs/ o plan
- **Sin `phrases.py` (F-17 no implementado):** las ventajas/amenazas se arman en `prepare.py` con duelos (nuestro ataque vs su defensa, nuestra defensa vs su ataque, misma métrica) y percentiles de T-01. Cuando exista F-17 puede reemplazar los textos sin cambiar el contrato.
- **Percentiles sin umbral de muestra:** la población usa `apply_thresholds=False` (con el umbral, ningún equipo del seed con 2 partidos entra); la muestra baja se advierte con `sample_warning`, como pide RF-6.
- **Amenazas ofensivas:** se cargan solo los jugadores del rival (`bundles._player_bundle_from_games`); enumerar la competencia completa tardaba ~29 s.
- **`team_matchups(team, rival, game_ids, level, side)`:** recibe los partidos ya filtrados en vez de `comp_id`/`ctx`.
- **Navegación:** sección propia "Preparar" en la barra (no hay S5 ni router X-01).
- **`matchup-table.js` no se creó:** la tabla vive en `prepare-report.js`.
- **`report.default_last_n` no se agregó** (default embebido: todos los partidos).
- **Distribución de puntos** movida de `live.py` a `stats_engine.points_distribution` (la usan F-01 y F-03).
- **PNG:** se monta el nodo fuera de pantalla antes de `toPNG` y se usa layout en bloque (el `toPNG` de T-06 copia una lista blanca de estilos sin grid/flex).

## Docs actualizados
- ✅ `docs/api.md` — `GET /api/prepare`, `GET /api/h2h`
- ✅ `docs/architecture.md` — `prepare.py`, `team_matchups`
- ✅ `docs/frontend.md` — sección Preparar, `api.prepare`/`api.h2h`

## Deuda / TODO
- Revisar con datos de QA (pares con varios enfrentamientos, competencias más largas: medir el tiempo en frío).
- Identidad: el seed tiene "J. Fairell" y "J. Augustin-Fairell" como jugadores distintos (C-08, candidato a unificar).
- Incremento diferido → A-09: "emparejamiento propuesto por perfil".
- Incremento diferido → F-12: abrir Preparar desde el próximo partido.
- [NEEDS CLARIFICATION] (spec §9): el informe en pantalla muestra todos los quintetos (top 8 + ver todos); el PDF/PNG recorta a 8. Confirmar con el cliente.
