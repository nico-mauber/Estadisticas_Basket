# Tasks — T-04: Base de normalización

> **ID:** T-04 · **Prioridad:** P1 · **Fase y orden:** Fase 2 — Contexto y comparabilidad · 03
> **Depende de:** T-05 · T-03 · **Habilita:** F-14, F-18
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** [spec.md](spec.md) · [plan.md](plan.md)

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- (sin tareas: T-04 no toca esquema — cálculo on-the-fly, sin tabla ni columna nueva)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · Implementar `apply_base(values, bundle, base)` con las tres ramas (`fixed`, `volume`, `count`) según el algoritmo del plan §4 · `backend/stats_engine.py` · cubre RF-2, RF-6, RF-9 · Done: con un `StatBundle` de prueba de 4 partidos, `apply_base(values, bundle, "total")["pts"]["value"] == apply_base(values, bundle, "partido")["pts"]["value"] * 4`
- [ ] T-B2 · `_segundos_entidad(bundle)`: equipo (minutos de partido reales), jugador (minutos jugados), quinteto/split (segundos en cancha) · `backend/stats_engine.py` · cubre RF-3 · Done: para un equipo con un partido con prórroga, `_segundos_entidad` da `45*60` en vez de `40*60`
- [ ] T-B3 · `_posesiones_denominador(bundle, per100_den)`: `own`/`opp`, con estimación marcada para jugador sin pbp · `backend/stats_engine.py` · cubre RF-4, RF-10 · Done: para un jugador de un partido sin pbp, el resultado trae `estimated=True` y el denominador es `POS_equipo × min_jugador/min_partido`
- [ ] T-B4 · Manejo de denominador 0 → `null` `sin_datos` en `por40`/`por100`; preservar razones de nulo ya existentes sin sobreescribir · `backend/stats_engine.py` · cubre RF-9 · Done: un jugador con 0 minutos en la selección devuelve todas las claves `count` en `por100` como `{"value": null, "reason": "sin_datos"}`
- [ ] T-B5 · `parse_base(args)` en `context.py` (o módulo que el humano prefiera, ver plan §10), con `ContextError` en valor inválido · `backend/context.py` · cubre RF-8 · Done: `parse_base({"base": "anual"})` levanta error; `parse_base({})` devuelve `config.get("ui.default_base")`
- [ ] T-B6 · Conectar `base = parse_base(request.args)` en los handlers de T-05 (`/api/metrics/<entity_type>`, `/api/team/<code>`, `/api/player/<team_code>/<name>`, `/api/player/<int:player_id>`) y pasarlo a `apply_base` antes de `standard_payload` · `backend/app.py` · cubre RF-1, RF-5, RF-11 · Done: `curl ".../api/team/<code>?base=por40"` responde 200 con `"base": "por40"` y valores distintos de `base=total`
- [ ] T-B7 · Verificar que `tables.build_table` (T-06) propaga `base` a cada fila vía `apply_base` (sin implementarlo si ya es de T-06; solo confirmar el contrato) · `backend/tables.py` (verificación) · cubre RF-11 · Done: nota en progress con el resultado de la verificación (o issue reportado si T-06 aún no lo hizo)

### Grupo C — Frontend: api.js
- [ ] T-C1 · Los métodos de T-05 en `api.js` agregan `base` a la query cuando está definida · `frontend/js/api.js` · cubre RF-5 · Done: `api.team(code, {base: "por100"})` hace `GET .../api/team/<code>?base=por100`

### Grupo D — Frontend: UI
- [ ] T-D1 · Crear `components/base-selector.js` con 4 pills y `onChange` · `frontend/js/components/base-selector.js` · cubre RF-1 · Done: tocar "Por 40'" dispara `onChange("por40")`
- [ ] T-D2 · Resolución de la base activa: URL `base=` > `sessionStorage['ui.base']` > `config.ui.default_base`, con try/catch en `sessionStorage` · `frontend/js/views/equipo.js`, `jugador.js` (o un helper compartido `core/context.js`) · cubre RF-7, RF-8 · Done: abrir la app sin `base` en la URL y sin uso previo arranca en "Por partido"; elegir una base y cambiar de pestaña la conserva
- [ ] T-D3 [P] · Montar el selector en `views/equipo.js` (pestañas ya migradas a T-05) · `frontend/js/views/equipo.js` · cubre RF-1, RF-11 · Done: S3 › Resumen muestra el selector; una pestaña legado (si la hay en esa fase) no lo muestra
- [ ] T-D4 [P] · Montar el selector en `views/jugador.js` · `frontend/js/views/jugador.js` · cubre RF-1, RF-11 · Done: S4 › Resumen muestra el selector
- [ ] T-D5 · Indicador "estimado" junto al valor cuando la métrica trae `estimated: true` · componente que renderiza métricas (T-05 `standard-panel.js`, verificar con su dueño) · cubre RF-10 · Done: para un jugador sin pbp en `base=por100`, el valor de `oer` muestra el ícono/`title` "estimado"
- [ ] T-D6 · CSS del selector alineado con la barra de contexto; sin scroll horizontal en 320 px · `frontend/css/style.css` · cubre RF-1 · Done: en 320 px las 4 pills entran en una fila con texto abreviado
- [ ] T-D7 · Copy con `t('base.*', '…')` · `base-selector.js` · cubre RF-12 · Done: `grep -n "Por 100 posesiones"` solo dentro de `t(`

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Selector deshabilitado + aviso "Sin conexión: no se puede cambiar la base" bajo Network Offline · vistas que lo montan · cubre §6 · Done: con DevTools Offline, tocar una pill no cambia el estado y muestra el aviso
- [ ] T-E2 · Error 400 al cambiar de base (simulado con un valor corrupto en la URL): toast "No se pudo cambiar la base", vuelve a la anterior · vistas · cubre §6 · Done: forzar `base=anual` en la URL muestra el toast y el selector vuelve a la base previa válida
- [ ] T-E3 · `sw.js`: agregar `base-selector.js` si aplica; subir `CACHE` · `frontend/sw.js` · cubre §9 · Done: el archivo se sirve offline en DevTools

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F2 · Sin cambios de esquema: N/A (se registra en progress)
- [ ] T-F3 · `curl` a `/api/team/<code>?base=total|partido|por40|por100` y `/api/player/<int:player_id>?base=...` comparando el shape y los valores escalados
- [ ] T-F4 · Consola del navegador sin errores JS al cambiar de base en S3 y S4
- [ ] T-F5 · Recorrer cada CA del spec y marcar ✅ en progress
- [ ] T-F6 · CA-1 (CA del cliente): jugador con un único partido jugado; comparar `pts` en las 4 bases con cálculo manual (`total`, `total` de nuevo por ser 1 partido, `total×2400/segundos`, `total×100/posesiones`) y `efg_pct` idéntico en las 4
- [ ] T-F7 · CA-2: equipo con 4 partidos; verificar `total(pts) == partido(pts) × 4` exacto
- [ ] T-F8 · CA-3: jugador con 0 minutos en la selección; `base=por100` → todas las claves `count` `null` `sin_datos`
- [ ] T-F9 · CA-4: comparar `efg_pct` entre `base=total` y `base=por100` para la misma entidad → idéntico
- [ ] T-F10 · CA-5: equipo con partido con prórroga; `base=por40` usa minutos reales (verificar con `_segundos_entidad` o el valor final de `pace`/conteos escalados)
- [ ] T-F11 · CA-6: jugador de un partido sin pbp; `base=por100` trae `estimated: true` y el denominador coincide con la fórmula de estimación
- [ ] T-F12 · CA-7: comparar una pestaña con T-05 adoptado (muestra selector) contra una sin adoptar en esta fase (no lo muestra)
- [ ] T-F13 · CA-8: elegir "Por 100 posesiones" en S3 › Resumen, navegar a S3 › Tiro; verificar que el selector y los valores siguen en esa base
- [ ] T-F14 · CA-9: abrir `#/equipo/<code>/resumen?base=por40` en sesión nueva; verificar que arranca en "Por 40 minutos"
- [ ] T-F15 · CA-10: sin `base` en URL ni sesión, `ui.default_base` en su default de fábrica ("partido"); verificar arranque en "Por partido"
- [ ] T-F16 · CA-11: `curl` crudo con `base=por100` y confirmar que los valores ya vienen escalados por el servidor (sin pasar por el frontend)

### Grupo G — Incrementos diferidos (diferido)
- [ ] T-G1 (diferido → F-06) · Verificar que Quintetos/ON-OFF ampliados adoptan el selector al migrar a T-05, sin cambios en `apply_base`
- [ ] T-G2 (diferido → F-04) · Verificar que Estadísticas por cuarto adopta el selector al migrar a T-05
- [ ] T-G3 (diferido → A-01…A-05) · Extender `_posesiones_denominador`/`_segundos_entidad` a splits de posesión cuando existan (sin cambiar la firma de `apply_base`)

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B1, T-B2, T-B3, T-F6 |
| CA-2 | T-B1, T-F7 |
| CA-3 | T-B4, T-F8 |
| CA-4 | T-B1, T-F9 |
| CA-5 | T-B2, T-F10 |
| CA-6 | T-B3, T-D5, T-F11 |
| CA-7 | T-D3, T-D4, T-F12 |
| CA-8 | T-D2, T-D3, T-F13 |
| CA-9 | T-D2, T-F14 |
| CA-10 | T-D2, T-F15 |
| CA-11 | T-B6, T-F16 |

## Dependencias externas
- T-05 con `StatBundle`/`compute_standard`/`metrics_catalog.METRICS` (`base_mode`, `per100_den`) disponibles.
- T-03 con `context.py` (`ContextError`, patrón de parseo) disponible para alojar `parse_base`.
- F-13 con `app_config`/`ui.default_base` en `CONFIG_SPEC` (default `partido`).
- X-01 con `core/router.js` conservando el query string entre pestañas.
- Dataset de verificación: un equipo con 4 partidos jugados en una competencia, un jugador con un único partido
  jugado, un partido con prórroga, y un partido sin play-by-play para un jugador de ese partido (los 13 del seed +
  reproceso con ingesta v2 cubren estos casos salvo que se documente una inyección controlada).
