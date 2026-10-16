# Tasks — F-19: Filtros rápidos y cabecera de contexto

> **ID:** F-19 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 04
> **Depende de:** T-03, T-02, X-01, F-11 (ver [plan.md](plan.md) §10)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- (sin cambios de esquema)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Crear `context_summary(entity_type, entity_id, ctx)` con las ramas `team` y `competition` (récord, `avg_margin`, `games`, `games_total`, exclusión `sin_pbp` con filtros de evento, eco con `context_echo`) · `backend/context_summary.py` · cubre RF-6, RF-9, RF-11, RF-12 · Done: en `app.test_client()`/shell, para un equipo del seed sin filtros `games == games_total` y `wins + losses == games`; con `last=5`, `games == 5`.
- [ ] T-B2 · Agregar la rama `player` (partidos jugados sin DNP, récord del equipo, minutos, badge por minutos, `record_basis`) · `backend/context_summary.py` · cubre RF-6 · Done: jugador con un DNP en el seed → `games` = partidos con minutos > 0.
- [ ] T-B3 · Envolver en `cache.memo("ctxsum", …)` y resolver nulos con razón (`sin_datos`, `no_aplica`) · `backend/context_summary.py` · cubre RF-9, RF-12 · Done: selección vacía devuelve `record: null` + `null_reasons.record == "sin_datos"`; cambiar `sample.team.min` por PUT settings cambia `sample.level` en la siguiente llamada.
- [ ] T-B4 · Ruta fina `GET /api/context/summary` (validación de `entity`/`id`, `parse_context`, errores §7.8) · `backend/app.py` · cubre RF-12 · Done: `curl` con `entity=team&id=CNF` → 200 shape plan §3; `id=ZZZ` → 404 `no_encontrado`; `last=abc` → 400 `contexto_invalido`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.contextSummary(params)` con `qs()` · `frontend/js/api.js` · cubre RF-12 · Done: desde la consola del navegador `api.contextSummary({entity:"team", id:"CNF", last:5})` resuelve con `games: 5`.

### Grupo D — Frontend: UI (render + charts)
- [ ] T-D1 · `renderQuickFilters` con las tres filas de chips (período 3/5/10/15, sede, rival sin el propio equipo), `aria-pressed` y `onChange` → `setContext` · `frontend/js/components/quick-filters.js` · cubre RF-1, RF-2, RF-3, RF-4 · Done: tocar "Últimos 10" deja la URL con `last=10` y el chip activo.
- [ ] T-D2 · Botón "Más filtros (n)" que abre el panel con `renderContextBar` (T-03) y contador de filtros no-chip · `frontend/js/components/quick-filters.js` · cubre RF-5 · Done: con `quarter=4` activo el botón dice "Más filtros (1)".
- [ ] T-D3 · Botón "Limpiar filtros" (visible solo con filtros activos; conserva `competition` y `base`) · `frontend/js/components/quick-filters.js` · cubre RF-10 · Done: tras limpiar, la URL solo conserva `competition`/`base`.
- [ ] T-D4 · `renderContextHeader` (nombre, badge T-02, récord, dif. media con signo es-UY, "N de M partidos", etiqueta de filtros, línea secundaria, estado vacío) · `frontend/js/components/context-header.js` · cubre RF-6, RF-9, RF-11, RF-13 · Done: el header de un equipo del seed muestra "Récord V-D · Dif. media ±x,x · N de M partidos".
- [ ] T-D5 · `flashGamesLeft(el, n, m)` (aviso "Quedan n de m partidos", ~4 s) · `frontend/js/components/context-header.js` · cubre RF-8 · Done: al tocar un chip aparece y desaparece el aviso.
- [ ] T-D6 · `mountContextDock` (carga opciones y resumen, suscripción a `onContextChange`/`onRoute`, contador de pedido "la última gana") · `frontend/js/components/ctx-dock.js` · cubre RF-4, RF-7, RF-8 · Done: tocar tres chips seguidos deja la cabecera coherente con el último estado.
- [ ] T-D7 · Estilos: `.ctx-dock` sticky, `.chip-row` con scroll horizontal interno, modo compacto <768 px, panel como hoja inferior en móvil · `frontend/css/style.css` · cubre RF-7 · Done: en 375 px no hay scroll horizontal de página y el dock sigue visible al final de la vista.
- [ ] T-D8 · Montar el dock en S3 Equipo (entidad `team`) y retirar `#team-filter-pills`/`#team-comp` y su listener; `_recordCard` recibe el récord de la selección · `frontend/js/views/equipo.js`, `frontend/js/app.js` · cubre RF-1…RF-11 · Done: ya no aparecen las pills "Últ. 5 · Últ. 3" y el récord no se oculta con filtros.
- [ ] T-D9 [P] · Montar el dock en S4 Jugador (entidad `player`) · `frontend/js/views/jugador.js` · cubre RF-6, RF-7 · Done: la cabecera del jugador muestra "Récord del equipo con él" y badge en minutos.
- [ ] T-D10 [P] · Montar el dock en S2 Liga y S7 Explorar (entidad `competition`, sin chips de rival) · `frontend/js/views/liga.js`, `frontend/js/views/explorar.js` · cubre RF-1, RF-2, RF-6 · Done: en Liga se ven chips de período y sede, y "N partidos" de la competencia.
- [ ] T-D11 [P] · S6 Comparar `equipos`: chips compartidos + una cabecera por lado · `frontend/js/views/comparar.js` · cubre RF-6 · Done: con "Últimos 5" ambas cabeceras muestran su propio "5 de M partidos".

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Mensajes de error/offline de plan §9 en cabecera y panel (400 con botón limpiar, 404, red, sin conexión con último resumen) · `frontend/js/components/context-header.js`, `ctx-dock.js` · cubre RF-9 · Done: editar la URL con `last=abc` muestra "Hay un filtro inválido en la dirección. Limpiá los filtros."
- [ ] T-E2 · `sw.js`: subir `CACHE` al siguiente entero (y, si X-01 no cambió a runtime caching, agregar los tres módulos a `STATIC`) · `frontend/sw.js` · cubre §9 · Done: DevTools → Application muestra la caché nueva con los módulos tras recargar.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · No toca esquema: `python backend/database.py` sigue corriendo dos veces sin error (control de no regresión).
- [ ] T-F3 · Endpoint probado: `curl -b cookies.txt "http://localhost:5000/api/context/summary?entity=team&id=CNF"`, `…&last=5&venue=local`, `…entity=player&id=<player_id>`, `…entity=competition&competition=<id>`; shape de plan §3 verificado.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer S2, S3 (todas las pestañas), S4, S6 y S7 tocando chips.
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en `progress.md`.
- [ ] T-F6 · CA-1 (CA del cliente): en S2, S3, S4, S6 y S7, con `last=5&venue=local` activos, hacer scroll hasta el final en desktop y en DevTools 375 px → la cabecera sigue visible con la etiqueta de filtros y "N de M partidos".
- [ ] T-F7 · CA-2: Equipo del seed con todos sus partidos → tocar "Últimos 5"; comparar récord y dif. media con los 5 partidos más recientes del game log (cálculo a mano en `progress.md`); ver el aviso "Quedan 5 de M partidos".
- [ ] T-F8 · CA-3: activar "Últimos 10" + "Local" + un rival; verificar la URL `last=10&venue=local&opponent=<code>`; recargar (F5) y verificar chips, cabecera y bloques idénticos.
- [ ] T-F9 · CA-4: elegir "Local" + un rival sin partidos de local → "Ningún partido cumple los filtros", bloques con "—", botón limpiar visible.
- [ ] T-F10 · CA-5: con chips y un filtro del panel activos, "Limpiar filtros" → todo en "Todos", competencia y base intactas en la URL, botón oculto.
- [ ] T-F11 · CA-6: con "Últimos 3" ver badge; `PUT /api/settings {"values":{"sample.team.min":4}}` → recargar → badge BAJA; restaurar con `POST /api/settings/reset`.
- [ ] T-F12 · CA-7: jugador del seed con al menos un DNP → cabecera con partidos jugados (contrastar con `player_game_stats.minutes` por SQL) y badge en minutos.
- [ ] T-F13 · CA-8: filtro de cuarto "4" desde el panel con un partido sin pbp en la selección (borrar su pbp en una copia de la base o usar un partido importado sin pbp) → línea "1 partido sin jugada a jugada excluido" y N descontado.
- [ ] T-F14 · CA-9: DevTools 375 px, competencia con ≥ 10 equipos → la fila de rivales se desplaza en horizontal; `document.documentElement.scrollWidth <= innerWidth`.
- [ ] T-F15 · CA-10: `curl …/api/context/summary?entity=team&id=ZZZ` → 404 `{"error":"Equipo no encontrado","code":"no_encontrado"}`; `…&id=CNF&last=abc` → 400 `contexto_invalido`.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-D4, T-D6, T-D7, T-D8, T-D9, T-D10, T-D11, T-F6 |
| CA-2 | T-B1, T-B4, T-C1, T-D1, T-D4, T-D5, T-F7 |
| CA-3 | T-D1, T-D6, T-F8 |
| CA-4 | T-B3, T-D4, T-D3, T-F9 |
| CA-5 | T-D3, T-F10 |
| CA-6 | T-B1, T-B3, T-D4, T-F11 |
| CA-7 | T-B2, T-D9, T-F12 |
| CA-8 | T-B1, T-D4, T-F13 |
| CA-9 | T-D1, T-D7, T-F14 |
| CA-10 | T-B4, T-E1, T-F15 |

## Dependencias externas
- T-03 implementado (contrato de contexto, `core/context.js`, `context-bar.js`, `/api/context/options`) y X-01 (router,
  vistas en `views/`). Sin ellos F-19 no puede empezar.
- T-02 implementado (`sample.sample_level`, `sample-badge.js`) y F-13 (umbrales editables, para CA-6).
- Dataset de verificación: los 13 partidos del seed reprocesados con la ingesta v2 (F-11), `competition_id` completo; al
  menos un jugador con DNP y un partido sin pbp (o copia de la base con el pbp de un partido borrado) para CA-7/CA-8.
- Sesión válida para curl (`AUTH_USERS` local o modo abierto sin `AUTH_USERS`).
