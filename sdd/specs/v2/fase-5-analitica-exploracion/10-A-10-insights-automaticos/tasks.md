# Tasks — A-10: Insights automáticos en texto

> **ID:** A-10 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 10
> **Depende de:** T-01, F-17 (y T-02, T-03, F-13, X-01, C-08 consumidos; ver [plan.md](plan.md) §10)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Datos y configuración (sin cambios de esquema)
- [ ] T-A1 · Activar `insights.low_pct`, `insights.high_pct`, `insights.min_items`, `insights.max_items` en `CONFIG_SPEC` (`status: activa`, consumidor A-10) · `backend/config.py` · cubre RF-2, RF-15 · Done: `GET /api/settings` las lista como activas con default 10 / 90 / 3 / 5 y `PUT` con `low_pct` ≥ `high_pct` responde 400.
- [ ] T-A2 [P] · Agregar la sección `insights` y `as_pos` en `families.circulacion` · `backend/phrases/rules.json` · cubre RF-8, RF-10 · Done: el JSON carga y las 17 claves de equipo y 16 de jugador existen en `metrics_catalog.METRICS` con `base_mode == "fixed"`.
- [ ] T-A3 [P] · Agregar las 8 plantillas (6 genéricas de percentil extremo + `cambio_mejora`/`cambio_empeora`) · `backend/phrases/es.json` · cubre RF-3, RF-5, RF-7, RF-14, RF-16 · Done: `generico_higher_extremo_alto` es literalmente "{entidad} está en el percentil {p} de {metrica} de la competencia ({valor} frente a {media} de promedio)" y ninguna tiene dígitos.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Ampliar `WHEN_VALUES`, `MAX_LEN` y `validate_templates` (cobertura genérica por dirección y entidad, `cambio_*`, métricas de `rules["insights"]`) · `backend/phrases.py` · cubre RF-14 · Done: `python backend/phrases.py` imprime `OK`; borrar `generico_lower_extremo_bajo` o agregar un dígito en una plantilla nueva hace fallar la validación con el error correspondiente.
- [ ] T-B2 · Hacer público `score_candidates(...)` (extraído del armado de candidatos de `game_plan`) sin cambiar el comportamiento de F-17 · `backend/phrases.py` · cubre RF-16 · Done: las llamadas a `game_plan` de F-17 devuelven lo mismo que antes del refactor (comparar la respuesta de `GET /api/game-plan?team=<code>` antes y después).
- [ ] T-B3 · `insights.py`: `insights_payload` con motivos tempranos (`sin_universo`, `contexto_no_comparable`, `poblacion_insuficiente`, `sin_datos`, `muestra_baja`), disparo por `low_pct`/`high_pct` desde `population.ficha`, orden por extremidad, familias, render y `_coherent` · `backend/insights.py` · cubre RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-12, RF-15 · Done: para un equipo del seed, `python -c` con `app.app_context()` devuelve frases con `percentile ≤ 10` o `≥ 90`, de familias distintas, ordenadas por `|p − 50|`, y `insights()` devuelve la misma lista.
- [ ] T-B4 · `sudden_changes` (período anterior vía `score_candidates`, `|z| ≥ change_z`, plantillas `cambio_*`, `muestra_baja`) · `backend/insights.py` · cubre RF-16 · Done: con `window_games=3`, `change_z=1.5` sobre un equipo con partidos suficientes devuelve cambios con `delta`, `own`, `ref` y `text`; con `change_z=99` devuelve `changes: []`; con `window_games < sample.team.min` devuelve `reason: muestra_baja`.
- [ ] T-B5 · Caché con `cache.memo("insights", …)` y `_games_total` para el eco de contexto · `backend/insights.py` · cubre RF-12, RF-15 · Done: dos llamadas idénticas seguidas devuelven el mismo objeto y cambiar `insights.high_pct` vía `PUT /api/settings` cambia la siguiente respuesta sin reiniciar.
- [ ] T-B6 · Ruta fina `GET /api/insights` (validación de `entity`/`id`, `parse_context`, errores §7.8, 404 con `identity.player_card`) · `backend/app.py` · cubre RF-1, RF-12 · Done: `curl` con `entity=team&id=<code>` → 200 con el shape del plan §3.2; `entity=xyz` → 400; `entity=team&id=ZZZ` → 404 `no_encontrado`; `entity=player&id=abc` → 400.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.insights(params)` con `qs()` · `frontend/js/api.js` · cubre RF-13 · Done: desde la consola `await api.insights({entity: "team", id: "<code>"})` resuelve con `insights`.

### Grupo D — Frontend: UI
- [ ] T-D1 · `renderInsights` (lista con tono ▲/▼/●, texto escapado, línea de evidencia con `_ordinal`, tooltip con la evidencia, nota de `below_min`, motivos y estados loading/error/offline) · `frontend/js/components/insights-panel.js` · cubre RF-11, RF-13, RF-17 · Done: con un `payload` de prueba se ven las tres variantes de tono y el texto "Pocos valores extremos en esta selección." cuando `below_min`.
- [ ] T-D2 · Montar el bloque en Equipo › Resumen (contador de pedido, `onContextChange`, estados) · `frontend/js/views/equipo.js` · cubre RF-12, RF-13 · Done: al cambiar a "Últimos 5" el bloque se recalcula y la evidencia muestra "Últimos 5".
- [ ] T-D3 [P] · Montar el bloque en Jugador › Resumen con `player_id` · `frontend/js/views/jugador.js` · cubre RF-12, RF-13 · Done: el bloque aparece en un jugador con ≥ `sample.player.min` minutos y muestra "Muestra insuficiente…" en uno con menos.
- [ ] T-D4 · CSS de `/* ── insights-panel (A-10) ── */` con apilado <768 px · `frontend/css/style.css` · cubre RF-13 · Done: en 375 px sin scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`).

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Mensajes de error/offline del plan §9 y copy de motivos del spec §6 · `frontend/js/components/insights-panel.js`, vistas · cubre RF-9, RF-13 · Done: con la red cortada (DevTools Offline) y respuesta previa se ve "Sin conexión: se muestran los últimos insights cargados".
- [ ] T-E2 · `sw.js`: subir `CACHE` al siguiente entero (y `STATIC` si X-01 no pasó a runtime caching) · `frontend/sw.js` · cubre §9 · Done: DevTools → Application muestra la caché nueva con el módulo.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · No toca esquema: `python backend/database.py` corre dos veces sin error; `python backend/phrases.py` imprime `OK`; y `GET /api/game-plan` de F-17 devuelve lo mismo que antes de T-B2.
- [ ] T-F3 · Endpoint probado con curl (sesión: `curl -c c.txt -X POST … /api/login`): `curl -b c.txt "http://localhost:5000/api/insights?entity=team&id=<code>"`, `…entity=player&id=<player_id>`, `…&last=5`, y los errores del plan §3.2; shape verificado.
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer Equipo › Resumen y Jugador › Resumen (cambiar de entidad, de `last`, de competencia).
- [ ] T-F5 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-F6 · CA-1 (CA del cliente): para 3 equipos y 3 jugadores del seed, abrir el Resumen y comparar cada insight con la ficha de esa métrica en la pantalla y con `curl "…/api/metrics/<team|player>?id=<id>"` (percentil, valor, promedio idénticos; `extremo_alto` ⇒ p ≥ 90, `extremo_bajo` ⇒ p ≤ 10; tono ▲ ⇔ color verde de la ficha). Además script ad hoc (`python -c`, `app.app_context()`) que recorre **todos** los equipos y jugadores en población del seed, llama a `population.ficha` independiente y compara con `insights()`; imprimir recuento de insights verificados y de discrepancias (debe ser 0). Registrar la tabla en `progress.md`.
- [ ] T-F7 · CA-2/CA-3: buscar un equipo con ≥ 5 extremos (o bajar `insights.high_pct` a 70 para forzarlo) y verificar 5 frases ordenadas por `|p − 50|` y de familias distintas; buscar un equipo con 1–2 extremos y verificar `below_min: true` y la nota en pantalla; con 0 extremos, `reason: sin_extremos`.
- [ ] T-F8 · CA-4: comparar el texto de un insight de eFG% (percentil ≥ 90) con la plantilla del cliente: "<Equipo> está en el percentil <p> de eFG% de la competencia (<valor> frente a <media> de promedio)".
- [ ] T-F9 · CA-5/CA-6: TO% o DER extremos (frase "entre los mejores/peores… menos es mejor", tono ▲/▼) y una métrica neutral (USO% de jugador o uso de triple de equipo) con tono ● y sin color.
- [ ] T-F10 · CA-7: equipo de 2 partidos (copia de la base o `sample.team.min` = 4 vía `PUT /api/settings`) y jugador con < `sample.player.min` minutos → `reason: muestra_baja`; restaurar con `POST /api/settings/reset`.
- [ ] T-F11 · CA-8: `last=5` → los percentiles del insight coinciden con las fichas de `GET /api/metrics/team?id=<code>&last=5` y el contexto dice "Últimos 5".
- [ ] T-F12 · CA-9: `PUT /api/settings {"values": {"insights.high_pct": 80, "insights.max_items": 3}}` → ≤ 3 frases con p ≥ 80; restablecer con `POST /api/settings/reset {"keys": ["insights.high_pct", "insights.max_items"]}`.
- [ ] T-F13 · CA-10: forzar una métrica nula (p. ej. AS/PER con 0 pérdidas, `last=1`) → no aparece, sin "0" ni "NaN".
- [ ] T-F14 · CA-11: `…&on=<player_id>` y `…&competition=all` → 200 con lista vacía y `reason` `contexto_no_comparable` / `sin_universo`.
- [ ] T-F15 · CA-12: equipo con eFG%, TS% y PPT en p ≥ 90 (o umbral bajado) → una sola frase de la familia `tiro`.
- [ ] T-F16 · CA-13: con `sample.team.min` = 2 si el seed no alcanza (o con datos de producción), `python -c` que llama `insights.sudden_changes(team, comp_id, ctx, window_games=3, change_z=1.5)`; verificar a mano en `progress.md` el `own` (pooled de los últimos 3 partidos desde `GET /api/team/<code>` `game_log`), el `ref` (pooled de los anteriores), el signo de `delta` y `z = delta orientado / σ` con σ de `population`; probar `change_z=99` (vacío) y `window_games=1` con `sample.team.min` 3 (`muestra_baja`).
- [ ] T-F17 · CA-14: script ad hoc que verifica que cada `text` es `render(template_id, …)` de `es.json`, sin dígitos a mano, y que `python backend/phrases.py` valida las plantillas nuevas.
- [ ] T-F18 · CA-15: `curl` con `entity=xyz`, sin `id` y con equipo/jugador inexistente → 400 y 404 con los mensajes del spec.
- [ ] T-F19 · CA-16: DevTools 375 px → bloque sin scroll horizontal, frases completas en varias líneas.

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B3, T-D1, T-D2, T-D3, T-F6 |
| CA-2 | T-B3, T-F7 |
| CA-3 | T-B3, T-D1, T-F7 |
| CA-4 | T-A3, T-B3, T-F8 |
| CA-5 | T-A3, T-B3, T-F9 |
| CA-6 | T-A3, T-B3, T-D1, T-F9 |
| CA-7 | T-B3, T-D3, T-E1, T-F10 |
| CA-8 | T-B3, T-D2, T-F11 |
| CA-9 | T-A1, T-B3, T-B5, T-F12 |
| CA-10 | T-B3, T-F13 |
| CA-11 | T-B3, T-D1, T-F14 |
| CA-12 | T-A2, T-B3, T-F15 |
| CA-13 | T-B2, T-B4, T-F16 |
| CA-14 | T-A3, T-B1, T-F17 |
| CA-15 | T-B6, T-F18 |
| CA-16 | T-D4, T-F19 |

## Dependencias externas
- F-17 implementado (`phrases.py`, `es.json`, `rules.json`, `score_candidates` o su helper privado) y T-01, T-02, T-03, F-13, X-01, C-08 integrados. Sin ellos A-10 no puede empezar.
- Dataset de verificación: los 13 partidos del seed reprocesados con la ingesta v2. Con pocos partidos por equipo los percentiles extremos y los cambios bruscos son difíciles de ver: para CA-2/CA-12/CA-13 usar datos de producción o bajar temporalmente `insights.high_pct` / `sample.team.min` por configuración (restaurar al terminar, anotarlo en `progress.md`).
- Sesión válida para curl (`AUTH_USERS` local o modo abierto) y usuario admin para editar configuración (`ADMIN_USERS` sin definir = todos admin).
- Para CA-7 con jugadores: al menos un jugador del seed con menos de `sample.player.min` minutos en la competencia.
