# Tasks — F-15: Sugerencias de quinteto asistidas por IA

> **ID:** F-15 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 13
> **Depende de:** F-06 · F-03 · A-08 · T-02
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `plan.md` de este mismo requisito

## Orden de ejecución

### Grupo A — Backend: esquema y modelos
- [ ] T-A1 · Sin cambios de esquema (confirmar contra Arq. §5): no hay tablas ni columnas nuevas · Done: `python backend/database.py` sin diferencias respecto de antes
- [ ] T-A2 [P] · Activar `ai.suggestions_enabled` (oculta en `spec_json()` si el entorno no tiene LLM) y agregar `ai.perf_pct`, `ai.low_usage_share`, `ai.top_n`, `ai.max_calls_per_hour` (PROPUESTA) · `backend/config.py` · cubre RF-3, RF-11, RF-12, RF-19 · Done: `GET /api/settings` lista las claves con los defaults (70, 5, 3, 20); sin `LLM_ENABLED`, `ai.suggestions_enabled` no aparece
- [ ] T-A3 [P] · Agregar `anthropic` a `backend/requirements.txt` (versión mínima verificada con `pip index versions anthropic`) · cubre RF-3 · Done: `pip install -r backend/requirements.txt` instala; la app arranca igual si el paquete falta (probar desinstalándolo)

### Grupo B — Backend: lógica y rutas
- [ ] T-B1 · `llm.py`: import protegido, `llm_available`, `suggestions_enabled` · `backend/llm.py` · cubre RF-3 · Done: con `LLM_ENABLED` vacío, sin clave o sin paquete, ambas devuelven `False`; con las tres cosas y `ai.suggestions_enabled` verdadero, `True`
- [ ] T-B2 · `format_value(fmt, v, lang)` con redondeo half-up exacto y separador por idioma · `backend/llm.py` · cubre RF-21 · Done: 20 valores de la tabla de quintetos formateados por `format_value` coinciden con `core/format.js` (`fmtMetric`/`PCT`/`DEC1`/`DEC2`), incluido un caso de empate binario (por ejemplo 0,125 a 2 decimales → "0,13")
- [ ] T-B3 · `validate_numbers(text, allowed)` y normalización de tokens · `backend/llm.py` · cubre RF-6 · Done: "1,12" y "55,4%" pasan si están en `allowed`; "1,13", "56" o "+3" fuera de `allowed` se devuelven como ofensores; el signo `−` (U+2212) y el `-` normalizan igual
- [ ] T-B4 · `build_summary` — lectura de las tablas `team_lineups`, `team_lineup_clutch`, `matchups_quinteto` y de `synergy.teammate_impact`; conversión de filas por columnas; elegibles (`is_ranked`, cierres `alta`); `team_minutes` · `backend/llm.py` · cubre RF-4, RF-5, RF-17, RF-20 · Done: el resumen de "anotar" del equipo del seed lista solo quintetos con muestra ≠ baja y sus valores son los de `GET /api/table/team_lineups`
- [ ] T-B5 · Selección por tipo: `anotar`, `defender`, `reboteear`, `frenar_ritmo` · `backend/llm.py` · cubre RF-9 · Done: las filas coinciden con ordenar la tabla por la métrica del plan §4.3 entre los elegibles
- [ ] T-B6 · Selección por tipo: `cerrar` y `lectura_cierres` · `backend/llm.py` · cubre RF-9, RF-14 · Done: las filas coinciden con `GET /api/table/team_lineup_clutch` filtrada a nivel `alta`
- [ ] T-B7 · Selección por tipo: `vs_rival` · `backend/llm.py` · cubre RF-10 · Done: las filas coinciden con el bloque de emparejamientos de quintetos de `GET /api/prepare` para el mismo par
- [ ] T-B8 · Selección por tipo: `infrautilizados` y `a_evitar` · `backend/llm.py` · cubre RF-11, RF-12 · Done: cada fila cumple los umbrales de configuración (se verifica cambiando `ai.perf_pct` y `ai.low_usage_share`)
- [ ] T-B9 · Selección por tipo: `cambio_pieza` (pares con 4 jugadores en común, orientación por minutos, diferencias, impactos de A-08) · `backend/llm.py` · cubre RF-13 · Done: cada par difiere en exactamente un jugador y los impactos coinciden con `GET /api/synergy/<team>`
- [ ] T-B10 · `_call_model` (cliente, salida estructurada, `fallbacks`, manejo de `refusal`/`max_tokens`/timeout/errores, log de `usage`) y prompt de sistema · `backend/llm.py` · cubre RF-4, RF-18 · Done: con un cliente simulado que devuelve cada tipo de resultado (éxito, refusal, timeout, error HTTP, JSON inválido), la función produce el resultado o la excepción esperada
- [ ] T-B11 · `_process` (marcadores, dígitos fuera de marcadores, filas citadas, `validate_numbers`, descarte, máximo 3, `supporting_rows`) · `backend/llm.py` · cubre RF-6, RF-7, RF-8 · Done: una respuesta simulada con una cifra inventada, un marcador inexistente y una fila citada sin listar se descartan; una correcta pasa
- [ ] T-B12 · `lineup_suggestions` (orden de operaciones, vacío sin llamada, caché `llm` con `refresh`, `_Uncached`, `_rate_limit`) · `backend/llm.py` · cubre RF-2, RF-16, RF-19 · Done: con el cliente simulado contando llamadas: equipo sin elegibles → 0 llamadas; misma consulta dos veces → 1 llamada; `refresh` → llamada nueva; tercera consulta distinta con `ai.max_calls_per_hour = 2` → `LlmError` 429
- [ ] T-B13 · Ruta `POST /api/ai/lineup-suggestions` (validación, errores con `code`, contexto de `competition`/`last`) y `llm_enabled` en `GET /api/me` · `backend/app.py` · cubre RF-2, RF-3, RF-18 · Done: `curl` con cada error de plan §3.1 devuelve el código y mensaje esperados

### Grupo C — Frontend: api.js
- [ ] T-C1 · `api.aiLineupSuggestions(body)` · `frontend/js/api.js` · cubre RF-2 · Done: desde la consola, `await api.aiLineupSuggestions({...})` devuelve el shape (con el servicio simulado)

### Grupo D — Frontend: UI
- [ ] T-D1 · Guardar `llm_enabled` de `/api/me` y montar el panel solo si es verdadero · `frontend/js/app.js`, `frontend/js/views/equipo.js` · cubre RF-3 · Done: con la función apagada no existe el nodo del panel en el DOM
- [ ] T-D2 · Componente del panel: plegable, límites fijos, selector de tipo y de rival, botón · `frontend/js/components/lineup-suggestions.js` · cubre RF-1, RF-15 · Done: los tres límites se ven sin interacción; "Contra un rival…" muestra el selector de rival
- [ ] T-D3 · Generación: loading, tarjetas con etiqueta "Generada automáticamente", texto escapado, tabla "Datos que la sustentan" con badge y enlace a la fila · cubre RF-2, RF-7, RF-8 · Done: tras generar (servicio simulado) se ven tarjetas y soporte; el enlace enfoca la fila de la tabla de quintetos
- [ ] T-D4 · Vacíos y errores por `reason`/`code`, regenerar, pie con fecha y quintetos considerados · cubre RF-16, RF-18, RF-19 · Done: cada mensaje de spec §6 se ve al forzar su caso
- [ ] T-D5 [P] · Estilos y mobile (`/* ── lineup-suggestions (F-15) ── */`) · `frontend/css/style.css` · Done: a 360 px una columna y sin scroll horizontal de página

### Grupo E — Errores, estados vacíos, offline/SW
- [ ] T-E1 · Offline: botón deshabilitado con el texto de §6 del spec · `lineup-suggestions.js` · cubre RF-18 · Done: con la red cortada se ve el mensaje y el botón no responde
- [ ] T-E2 [P] · `sw.js`: componente nuevo a `STATIC` y bump de `CACHE` (solo si X-01 no migró a runtime caching) · `frontend/sw.js` · Done: el panel carga offline hasta el botón
- [ ] T-E3 · `render.yaml`: `--workers 1 --threads 4` si F-01 no lo dejó; documentar variables `LLM_*` y la clave como secreto · `render.yaml`, `docs/deployment.md` · cubre RF-18, RF-20 · Done: `docs/deployment.md` lista las variables y su default; `render.yaml` arranca con hilos

### Grupo F — Verificación de feature
- [ ] T-F1 · Backend arranca sin traceback (`python backend/app.py`), con y sin `LLM_ENABLED`/clave/paquete
- [ ] T-F2 · N/A de esquema: `python backend/database.py` dos veces sin error (no cambia)
- [ ] T-F3 · Cada endpoint probado con `app.test_client()` (o curl) con el cliente de IA **simulado** (reemplazar `llm._call_model` por una función que devuelve respuestas fabricadas, sin costo): `POST /api/ai/lineup-suggestions` para los 10 `goal`, errores 400/404/429/503, `GET /api/me`
- [ ] T-F4 · Consola del navegador sin errores JS al recorrer el panel
- [ ] T-F5 · Recorrer cada CA y marcar ✅ en `progress.md`
- [ ] T-F6 · CA-1 (CA del cliente), primera cláusula: con una respuesta simulada que cita 5 valores por marcador, comparar cada cifra del texto con la fila de la tabla de quintetos (`GET /api/table/team_lineups`); segunda cláusula: con `LLM_ENABLED` apagada y luego con `ai.suggestions_enabled` en falso, recorrer la pestaña Quintetos y confirmar que tabla, líderes y selector funcionan igual y que el panel no existe
- [ ] T-F7 · CA-2: respuestas simuladas con (a) dígito fuera de marcador, (b) marcador a clave inexistente, (c) fila citada sin listar en `row_ids`, (d) todas inválidas → descarte individual, `discarded` correcto y `reason: "validacion_fallida"` en (d)
- [ ] T-F8 · CA-3 y CA-18: inspeccionar la tarjeta y comparar 20 valores de "Datos que la sustentan" con la tabla de quintetos carácter por carácter
- [ ] T-F9 · CA-4: pestaña Network del navegador, abrir y recorrer Quintetos sin tocar el botón: 0 llamadas a `/api/ai/lineup-suggestions`
- [ ] T-F10 · CA-5 y CA-6: con `sample.lineup.min` muy alto (o un equipo del seed con pocas posesiones), 0 llamadas al servicio simulado y mensaje de umbral; un quinteto de muestra baja nunca aparece en el resumen (registrar el resumen en depuración local)
- [ ] T-F11 · CA-7 … CA-11: para cada tipo, comparar las filas del resumen con la tabla correspondiente (ordenar `team_lineups` por la métrica del plan; `GET /api/prepare`; `GET /api/synergy/<team>`; `GET /api/table/team_lineup_clutch`) y verificar los umbrales cambiando `ai.perf_pct` y `ai.low_usage_share`
- [ ] T-F12 · CA-12: los tres límites visibles antes y después de generar, en escritorio y en 360 px
- [ ] T-F13 · CA-13: servicio simulado que lanza timeout, error HTTP y devuelve `stop_reason: "refusal"`: mensajes correctos, sin texto parcial, resto de la pantalla operativo
- [ ] T-F14 · CA-14: `ai.max_calls_per_hour = 2`; tres consultas distintas → la tercera 429; repetir una consulta ya hecha → no cuenta ni llama
- [ ] T-F15 · CA-15: inyectar un quinteto con `ast_to` nulo (sin pérdidas) y verificar que no está en el resumen y en el soporte aparece "—"
- [ ] T-F16 · CA-16: revisar el resumen registrado: sin eventos, partidos, usuario ni identificadores de sesión
- [ ] T-F17 · CA-17: arrancar sin `ANTHROPIC_API_KEY` y, aparte, sin el paquete: `GET /api/me` → `llm_enabled: false`, endpoint 503, panel ausente, sin error al arrancar
- [ ] T-F18 · CA-19 (opcional, con clave real y costo asumido): una llamada real con "Anotar" sobre un equipo del seed; registrar tokens, costo estimado y que el texto pasa la validación
- [ ] T-F19 · Registrar en `progress.md` el modelo usado, la duración y los tokens medidos, y el costo por lectura

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-B4, T-B11, T-D1, T-F6 |
| CA-2 | T-B3, T-B11, T-F7 |
| CA-3 | T-B11, T-D3, T-F8 |
| CA-4 | T-D2, T-D3, T-F9 |
| CA-5 | T-B4, T-B12, T-D4, T-F10 |
| CA-6 | T-B4, T-F10 |
| CA-7 | T-B5, T-B6, T-F11 |
| CA-8 | T-B7, T-F11 |
| CA-9 | T-A2, T-B8, T-F11 |
| CA-10 | T-B9, T-F11 |
| CA-11 | T-B6, T-F11 |
| CA-12 | T-D2, T-F12 |
| CA-13 | T-B10, T-D4, T-F13 |
| CA-14 | T-A2, T-B12, T-F14 |
| CA-15 | T-B4, T-D3, T-F15 |
| CA-16 | T-B4, T-F16 |
| CA-17 | T-A3, T-B1, T-B13, T-D1, T-F17 |
| CA-18 | T-B2, T-F8 |
| CA-19 | T-B10, T-F18 |

## Dependencias externas
- **F-06** debe exponer las tablas `team_lineups` y `team_lineup_clutch` (y `lineups.all_lineups`) antes de T-B4–T-B6; **F-03/F-07** la tabla `matchups_quinteto` antes de T-B7; **A-08** `synergy.teammate_impact` antes de T-B9; **T-02** `sample.*`; **T-06** `tables.build_table` y `data-table.js`; **F-13** `config.py`; **X-01** `collapsible.js` y la pestaña `quintetos`.
- **Variables de entorno** (solo para CA-19 y producción): `LLM_ENABLED=true`, `ANTHROPIC_API_KEY=<secreto>`, `LLM_MODEL`, `LLM_TIMEOUT_SECS`, `LLM_MAX_RETRIES`, `LLM_EFFORT` (opcional). La verificación T-F3 … T-F17 no necesita clave ni costo (servicio simulado).
- **Paquete `anthropic`** instalado para CA-19 (y para ver `llm_enabled: true`); la ausencia del paquete es parte de CA-17.
- **Dataset de verificación**: los 13 partidos del seed reprocesados (con pbp), al menos un equipo con quintetos de muestra media/alta y otros de muestra baja; para `vs_rival` dos equipos con antecedentes; para `cerrar` un equipo con ≥ `sample.clutch_lineup.high_games` cierres con el mismo quinteto (si el seed no lo permite, inyección controlada documentada).
- **Decisión del cliente pendiente** antes de producción: modelo por defecto, presupuesto de costo y aceptación de enviar nombres y métricas a un servicio externo (spec §9).
