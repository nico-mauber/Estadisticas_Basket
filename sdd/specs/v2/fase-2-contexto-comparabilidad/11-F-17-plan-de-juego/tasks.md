# Tasks — F-17: Plan de juego

> **ID:** F-17 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 11
> **Depende de:** T-01, T-05, X-01, F-13 (y T-02, T-03 consumidos; ver [plan.md](plan.md) §10)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Datos y configuración (sin cambios de esquema)
- [ ] T-A1 · Activar las claves `gameplan.items_min`, `gameplan.items_max`, `gameplan.min_z` en `CONFIG_SPEC` (`status: activa`, consumidor "F-17, F-03") · `backend/config.py` · cubre RF-9, RF-18 · Done: `GET /api/settings` lista las tres claves como activas con default 3 / 5 / 0,5 y `config.get("gameplan.min_z")` devuelve `0.5`.
- [ ] T-A2 [P] · Crear `backend/phrases/rules.json` con `families` (tiro, circulacion) y `game_plan.team` (15 métricas) · `backend/phrases/rules.json` · cubre RF-10, RF-11 · Done: el JSON carga con `python -c "import json; json.load(open('backend/phrases/rules.json', encoding='utf-8'))"` y las 15 claves existen en `metrics_catalog.METRICS`.
- [ ] T-A3 [P] · Crear `backend/phrases/es.json` con las 30 plantillas (15 métricas × `ventaja`/`riesgo`) del plan §4.1 · `backend/phrases/es.json` · cubre RF-6, RF-19 · Done: 30 entradas con id único `ventaja_<metrica>` / `riesgo_<metrica>`, ninguna con dígitos.

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Crear `backend/phrases.py` con constantes, `PhraseError`, `load_rules`, `load_templates` (memoizado por mtime) y `validate_templates` + bloque `if __name__ == "__main__"` que imprime `OK` o la lista de errores · `backend/phrases.py` · cubre RF-16, RF-17 · Done: `python backend/phrases.py` imprime `OK: 30 plantillas`; si se agrega un dígito, un marcador `{x}` o se borra `riesgo_der`, imprime el error correspondiente y sale con código 1.
- [ ] T-B2 · `pick_template` (exacta → genérica `*` → `None`), `format_value` (es-UY, half-up por `Decimal(repr)`) y `render` (marcador faltante → `PhraseError`) · `backend/phrases.py` · cubre RF-4, RF-6, RF-16, RF-19 · Done: en un `python -c` con `app.app_context()`: `format_value("efg_pct", 0.5324)` → `"53,2%"`, `format_value("efg_pct", 0.0082, delta=True)` → `"+0,8 pp"`, `format_value("oer", None)` → `"—"`; `render("ventaja_efg_pct", {})` → "Ventaja en tiro: buscá volumen en medio campo".
- [ ] T-B3 · `game_plan` núcleo con referencia `competencia`: validaciones, motivos vacíos (`sin_universo`, `contexto_no_comparable`, `sin_datos`, `poblacion_insuficiente`, `muestra_baja`), candidatos con `delta` orientado y `z` (`_sigma`, `_member`), `_select` con familias y relleno `minor`, ítems con `percentile` de `population.ficha` y `text` · `backend/phrases.py` · cubre RF-2, RF-3, RF-5, RF-9, RF-10, RF-11, RF-12, RF-13, RF-14, RF-18 · Done: para un equipo del seed (contexto con `competition` resuelta) la llamada devuelve entre 3 y 5 ítems por columna, ordenados por `|z|` decreciente, y `own`/`ref`/`percentile` de cada ítem coinciden con `population.ficha`.
- [ ] T-B4 · Referencia `rival`: miembro del rival en la misma población, `rival_sin_datos`, `sample.ref`, `sample_warning` si el rival es de muestra baja · `backend/phrases.py` · cubre RF-7 · Done: con `rival=<otro equipo>` los `ref` de los ítems son iguales a los `values` de ese equipo en la población; con rival = propio equipo lanza `PhraseError` 400.
- [ ] T-B5 · Referencia `periodo_anterior`: exponer `metrics_catalog.load_bundles(req)` si T-05 no lo hizo, `_bundle_minus` y `_previous_period` (reutiliza `stats_engine.compute_standard`) · `backend/phrases.py`, `backend/metrics_catalog.py` · cubre RF-7 · Done: con `last=5` en un equipo de ≥ 8 partidos, el valor `ref` de `efg_pct` coincide con `Σ(2·fgm2+…)` calculado a mano sobre los partidos anteriores a los 5 más recientes (ver T-F9); sin partidos anteriores suficientes → `reason: periodo_anterior_insuficiente`.
- [ ] T-B6 · Modo `matchup`: fuerza `reference="rival"`, no excluye muestra baja y fija `sample_warning` · `backend/phrases.py` · cubre RF-16 · Done: llamada interna con un equipo de 2 partidos devuelve ítems con `sample_warning: true`; en modo `perfil` devuelve `reason: muestra_baja`.
- [ ] T-B7 · Cierre del payload: `context_echo`, `population`, `rule`, `items` (concatenación), `cache.memo("gplan", …)` con `config_version` en la clave · `backend/phrases.py` · cubre RF-13, RF-18 · Done: dos llamadas idénticas seguidas devuelven el mismo objeto (la segunda sin recomputar, se ve en el log de depuración) y cambiar `gameplan.items_max` vía `PUT /api/settings` cambia la siguiente respuesta sin reiniciar.
- [ ] T-B8 · Ruta fina `GET /api/game-plan` con validación de `team`/`reference`/`rival`, `parse_context`, traducción de `PhraseError` y de errores de contexto al formato §7.8 · `backend/app.py` · cubre RF-1, RF-7, RF-8, RF-13 · Done: `curl` con `team=<code>` → 200 con el shape del plan §3.2; `reference=rival_proximo` → 400 `referencia_no_disponible`; `reference=xyz` → 400 `parametro_invalido`; `team=ZZZ` → 404 `no_encontrado`.

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.gamePlan(params)` con `qs()` · `frontend/js/api.js` · cubre RF-1 · Done: desde la consola del navegador `await api.gamePlan({team: "<code>"})` resuelve con `advantages` y `risks`.

### Grupo D — Frontend: UI
- [ ] T-D1 · `renderPlanItem` y `fmtPlanDelta` (signo, pp, color `above-avg`/`below-avg`, percentil con `percentileColor`, tooltip con la diferencia aritmética, atenuado para `minor`) · `frontend/js/components/game-plan.js` · cubre RF-2, RF-3, RF-4, RF-5, RF-19 · Done: un ítem de prueba de TO% (`delta_raw` negativo, `delta` positivo) se ve verde con "+1,8", valores "14,2% vs 16,0%", "p83" y el tooltip "Diferencia aritmética: −1,8 pp (propio − referencia)".
- [ ] T-D2 · `renderGamePlan` (armazón, `collapsible`, selector de referencia y de rival, `.gp-meta` con `sampleBadge`, columnas "Ventajas"/"Vulnerabilidades", estados loading/error/offline/vacío, `planReasonText`) · `frontend/js/components/game-plan.js` · cubre RF-1, RF-7, RF-8, RF-12, RF-13, RF-15 · Done: el panel se pliega/despliega, "Rival del próximo partido" aparece deshabilitada con su nota y "Mi equipo: período anterior" está deshabilitada sin `last`.
- [ ] T-D3 · Montar el panel en `resumen` de S3 con estado de referencia en `sessionStorage`, contador de pedido, `onContextChange` y carga de `teams` desde `api.contextOptions` · `frontend/js/views/equipo.js` · cubre RF-1, RF-7, RF-13, RF-15 · Done: al elegir un rival el panel se recalcula y el encabezado dice "Referencia: Rival <nombre>"; tocar tres referencias seguidas deja el panel con la última.
- [ ] T-D4 · CSS de `/* ── game-plan (F-17) ── */` con columnas, ítems, `gp-minor` y apilado <768 px · `frontend/css/style.css` · cubre RF-1, RF-2 · Done: en 375 px las columnas se apilan y `document.documentElement.scrollWidth <= innerWidth`.

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Mensajes de error y offline del plan §9 y copy de motivos del spec §6 · `frontend/js/components/game-plan.js`, `frontend/js/views/equipo.js` · cubre RF-12, RF-13 · Done: con `last=abc` en la URL el panel muestra "Hay un filtro inválido en la dirección. Limpiá los filtros."; con la red cortada (DevTools Offline) se ve "Sin conexión: se muestra el último plan cargado".
- [ ] T-E2 · `sw.js`: subir `CACHE` al siguiente entero (y agregar `/js/components/game-plan.js` a `STATIC` si X-01 no pasó a runtime caching) · `frontend/sw.js` · cubre §9 · Done: DevTools → Application muestra la caché nueva con el módulo tras recargar.

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`).
- [ ] T-F2 · No toca esquema: `python backend/database.py` corre dos veces seguidas sin error; además `python backend/phrases.py` imprime `OK` y `cd backend && python -c "import phrases; print(phrases.__file__)"` apunta a `phrases.py` (no al directorio).
- [ ] T-F3 · Endpoint probado con curl (sesión: `curl -c c.txt -X POST -H "Content-Type: application/json" -d '{"user":"…","password":"…"}' http://localhost:5000/api/login`): `curl -b c.txt "http://localhost:5000/api/game-plan?team=<code>"`, `…&reference=rival&rival=<otro>`, `…&last=5&reference=periodo_anterior`, y los cuatro errores del plan §3.2; shape verificado.
- [ ] T-F4 · Cobertura de la población: para un equipo del seed, `rule.metrics_evaluated` = 15 y `rule.metrics_scored` ≥ 13; anotar en `progress.md` cuáles se omiten y por qué (nulo o σ = 0).
- [ ] T-F5 · Consola del navegador sin errores JS al recorrer Equipo › Resumen (cambiar de equipo, de referencia, de `last`, plegar/desplegar).
- [ ] T-F6 · Recorrer cada CA del spec manualmente y marcar ✅ en `progress.md`.
- [ ] T-F7 · CA-1 (CA del cliente): en Resumen de un equipo del seed, para cada ítem de ambas columnas comparar `own`, `ref` y `percentile` con `curl "…/api/metrics/team?id=<code>"` (campos `avg`, `percentile` de la ficha) y con la ficha visible de esa métrica en la pantalla; `delta` debe ser igual a `dist_avg` de la ficha. Registrar la tabla de comparación (un renglón por ítem) en `progress.md`.
- [ ] T-F8 · CA-2: contar ítems por columna (3–5), verificar orden por `|z|` decreciente y que no haya dos métricas de la familia `tiro` (eFG%, TS%, PPT) ni de `circulacion` (AS/PER, AS%) en la misma columna.
- [ ] T-F9 · CA-3 y CA-5: con TO% (o DER) en el plan, verificar signo y color del delta y el tooltip aritmético; con `last=5` y `reference=periodo_anterior`, calcular a mano en `progress.md` el eFG% de los partidos anteriores a los 5 más recientes (Σ(FGM + 0,5·3PM)/ΣFGA desde `GET /api/team/<code>` `game_log`) y comparar con `ref`; sin `last` verificar el 400 con el mensaje esperado.
- [ ] T-F10 · CA-4: con `reference=rival&rival=<B>` comparar `ref` con la ficha de B (`/api/metrics/team?id=<B>`); probar rival = propio equipo (400) y rival inexistente (404).
- [ ] T-F11 · CA-6: con un equipo de 2 partidos (copia de la base con solo 2 partidos de un equipo, o `sample.team.min` subido a 4 con `PUT /api/settings`) → "Muestra insuficiente…" y badge BAJA; restaurar con `POST /api/settings/reset`.
- [ ] T-F12 · CA-7: plegar el panel, recargar (F5) y verificar que sigue plegado; `curl -b c.txt "…/api/prefs?scope=panel.collapsed"` devuelve `equipo.game_plan: true`; con otro usuario (`AUTH_USERS` con dos usuarios) el panel sigue desplegado.
- [ ] T-F13 · CA-8: script ad hoc (`python -c` con `app.app_context()`) que recorre los 13 partidos del seed por cada equipo y, para cada ítem, verifica (a) `text` == `render(template_id, …)` de `es.json`, (b) ningún `ventaja` con `delta ≤ 0` ni `riesgo` con `delta ≥ 0`, (c) ningún dígito en `text`; imprimir el recuento de ítems verificados.
- [ ] T-F14 · CA-9: forzar un nulo (equipo cuyo `ast_to` es nulo por 0 pérdidas en la selección, p. ej. con `last=1` sobre un partido sin pérdidas, o editando temporalmente un valor en una copia de la base) → la métrica no aparece, no hay "0"/"NaN" en el panel.
- [ ] T-F15 · CA-10: `curl "…/api/game-plan?team=<code>&on=<player_id>"` y `…&competition=all` → 200 con columnas vacías y `reason` `contexto_no_comparable` / `sin_universo`; el panel muestra el texto del motivo.
- [ ] T-F16 · CA-11: `PUT /api/settings {"values": {"gameplan.items_max": 3, "gameplan.min_z": 1.0}}` → recargar; ≤ 3 ítems por columna y ningún ítem pleno con `|z| < 1,0`; restaurar con `POST /api/settings/reset {"keys": ["gameplan.items_max", "gameplan.min_z"]}`.
- [ ] T-F17 · CA-12: DevTools 375 px → columnas apiladas, sin scroll horizontal, frases en varias líneas sin truncarse.
- [ ] T-F18 · CA-13: `curl` con `reference=rival_proximo`, `reference=xyz` y `team=ZZZ` → 400 `referencia_no_disponible`, 400 `parametro_invalido`, 404 `no_encontrado` con los mensajes del spec.
- [ ] T-F19 · CA-14: `python -c` con `app.app_context()` que llama `phrases.game_plan("team", "<equipo de 2 partidos>", reference="rival", rival="<otro>", comp_id=…, ctx=…, mode="matchup")` → ítems con `sample_warning: true`; mismo equipo con `mode="perfil"` → `reason: muestra_baja`.

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (diferido → F-12) · Habilitar la referencia `rival_proximo` en `game_plan` con `fixtures.next_fixture(team_code, today)` y activar la opción del selector · `backend/phrases.py`, `frontend/js/components/game-plan.js` · cubre RF-8 · Done: con un partido cargado en el calendario, `reference=rival_proximo` responde 200 con el rival del próximo partido; sin calendario sigue respondiendo 400 `referencia_no_disponible`. (Se ejecuta dentro de F-12.)
- [ ] T-G2 (diferido → F-12) · Montar `renderGamePlan` en Mi equipo (S8) con `panelId: "mi_equipo.game_plan"` · `frontend/js/views/mi-equipo.js` · cubre RF-1, RF-15 · Done: el panel aparece en S8 para el equipo fijado y su estado de plegado es independiente del de Equipo. (Se ejecuta dentro de F-12.)
- [ ] T-G3 (diferido → F-03) · Usar `renderPlanItem` y `phrases.game_plan(mode="matchup")` en el bloque Ventajas/Amenazas del informe · `backend/prepare.py`, `frontend/js/components/prepare-report.js` · cubre RF-16 · Done: el informe de F-03 muestra los ítems con el mismo formato y `sample_warning` visible cuando corresponde. (Se ejecuta dentro de F-03.)

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 (cliente) | T-B3, T-D1, T-D2, T-D3, T-F4, T-F7 |
| CA-2 | T-B3, T-D2, T-F8 |
| CA-3 | T-B3, T-D1, T-F9 |
| CA-4 | T-B4, T-B8, T-D3, T-F10 |
| CA-5 | T-B5, T-B8, T-D2, T-F9 |
| CA-6 | T-B3, T-D2, T-E1, T-F11 |
| CA-7 | T-D2, T-D3, T-F12 |
| CA-8 | T-A3, T-B1, T-B2, T-B3, T-F2, T-F13 |
| CA-9 | T-B3, T-F14 |
| CA-10 | T-B3, T-B8, T-D2, T-F15 |
| CA-11 | T-A1, T-B3, T-B7, T-F16 |
| CA-12 | T-D4, T-F17 |
| CA-13 | T-B8, T-E1, T-F18 |
| CA-14 | T-B6, T-F19 |

## Dependencias externas
- Fase 1 cerrada y X-01, T-03 implementados: T-01 (`population.py`, `core/colors.js`), T-05 (`metrics_catalog`, `compute_standard`), T-02 (`sample.py`, `sample-badge.js`), F-13 (`config.py`, `prefs.py`, `core/prefs.js`), X-01 (`collapsible.js`, `views/equipo.js`), T-03 (`context.py` completo, `core/context.js`, `/api/context/options`), F-11 (`repository.py`, `cache.py`). Sin ellos F-17 no puede empezar.
- Dataset de verificación: los 13 partidos del seed reprocesados con la ingesta v2; al menos un equipo con ≥ 8 partidos en una competencia (para `last=5` + período anterior) y, para CA-6/CA-14, una copia de la base con un equipo de 2 partidos o `sample.team.min` ajustable.
- Sesión válida para curl (`AUTH_USERS` local, con dos usuarios para CA-7, o modo abierto) y, para editar configuración, que el usuario sea admin (`ADMIN_USERS` sin definir = todos admin).
- Si el catálogo T-05 no tiene la clave `ppt` o `as_pct` con ese nombre al implementar, ajustar `rules.json` (la lista es un dato).
