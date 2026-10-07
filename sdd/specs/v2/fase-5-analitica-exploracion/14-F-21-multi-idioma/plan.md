# Plan — F-21: Multi-idioma

> **ID:** F-21 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 14 (último requisito de v2)
> **Depende de:** X-01 · F-17 · A-10 · T-06 (y, por el alcance "todas las superficies": F-13, F-15, F-12, F-03; rutas en "Dependencias técnicas")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 2)
> **Fuente:** `spec.md` de este requisito · Arquitectura §3.2, §3.3, §3.5, §3.13, §3.14, §3.15, §3.20, §4, §6, §7.4, §7.7, §7.8, §8 · Decisión humana DA-21 (`../../00-decisiones.md`)
> **Estimación:** XL · 28–40 h (partición sugerida en §10 si al medir supera 40 h)

## 1. Enfoque

Estrategia de la arquitectura §3.20 **ajustada por DA-21** (no se preparó `t()` en la fase 1): F-21 construye la infraestructura y hace la extracción masiva al final, sobre un inventario cerrado de superficies de texto. Cinco mecanismos:
1. **Frontend:** `core/i18n.js` (`t()`, carga de diccionarios planos `frontend/i18n/{es,en,pt}.json`, idioma activo, cambio en caliente con re-render) y un selector. Todo el texto de la interfaz (chrome, estados, toasts, leyendas, enumeraciones por código) sale de ahí.
2. **Backend:** `backend/i18n.py` + diccionarios del backend para todo texto que el servidor genera (etiquetas de tablas, catálogo de métricas, configuración, calidad de datos, etiqueta de contexto, metadatos de exportación) y `phrases/{en,pt}.json` para las frases. El idioma llega en un encabezado `X-Lang` que `api.js` agrega a **todas** las peticiones.
3. **Errores:** el backend deja de mandar texto libre como único contenido: cada error lleva `code` y `details` (Arq. §7.8) y el frontend lo traduce; el mensaje en español queda como respaldo.
4. **Formato:** un único mapa de localización (`es-UY`, `en-US`, `pt-BR`) alimenta números, fechas y gráficos; el formateador numérico del backend (de F-15) pasa a `i18n.py`.
5. **Verificación mecánica** (`backend/tools/i18n_audit.py`, solo de desarrollo): detecta cadenas sueltas, paridad de claves/marcadores entre idiomas y errores sin `code`; más un modo de pseudo-localización en runtime para detectar a ojo cadenas sueltas y desbordes.
La extracción se hace en **etapas por superficie** (E0 infraestructura → E1 cáscara → E2–E4 vistas por fase → E5 backend → E6 traducción y verificación), con el español como base: la extracción no cambia el texto en español (CA-12). Las traducciones a inglés y portugués se producen por glosario (§4.9) y requieren revisión nativa (spec §9).

## 2. Archivos (crear/editar)

| Ruta | Tipo | Responsabilidad | RF |
|---|---|---|---|
| `frontend/js/core/i18n.js` | js-core **NUEVO** (si C-11 ya lo creó con `t()`, se extiende; DA-21 dice que no) | `t`, `tText`, `tn`, `tError`, `getLanguage`, `setLanguage`, `initI18n`, `onLanguageChange`, `getLocale`, `LOCALES`, `LANGS`, pseudo-localización | RF-1..RF-8, RF-15, RF-18, RF-20 |
| `frontend/i18n/es.json`, `en.json`, `pt.json` | data **NUEVO** | diccionarios planos (clave → texto con `{param}`; plurales `.one`/`.other`) | RF-1, RF-5..RF-8 |
| `frontend/js/components/language-selector.js` | component **NUEVO** (PROPUESTA: no figura en Arq. §8) | selector en cabecera, login y S9 | RF-2, RF-3 |
| `frontend/js/api.js` (mod.) | js-api | encabezado `X-Lang` en `apiFetch`/`apiFetchBlob`; el error conserva `code`, `details`, `status`; `i18n(lang)` carga el diccionario | RF-15, RF-16, RF-20 |
| `frontend/js/core/format.js` (mod.) | js-core | formateadores por locale activo (caché invalidada al cambiar), `fmtDate`, `NULL_REASON_LABELS` → claves `nulos.razon.<código>` | RF-6, RF-18 |
| `frontend/js/charts.js` (mod.) | js-chart | rótulos con `tText`, `Chart.defaults.locale = getLocale()` | RF-5, RF-18 |
| `frontend/js/app.js` + `views/*.js` + `components/*.js` (mod., todos) | js-view / component | extracción de cada cadena a `t()`/`tText()`; `NAV_ITEMS` y registro de secciones/pestañas por claves | RF-5, RF-6, RF-8, RF-22 |
| `frontend/js/core/router.js` (X-01, mod.) | js-core | `rerender()` (PROPUESTA) para re-pintar la ruta actual tras cambiar de idioma; etiquetas de nav por claves | RF-4 |
| `frontend/js/core/catalog.js` (T-05, mod.) | js-core | recarga el catálogo al cambiar de idioma | RF-10 |
| `frontend/index.html`, `frontend/manifest.json` (mod.) | static | `<title>` y `lang` se actualizan en runtime; redacción única del manifiesto | RF-5 |
| `frontend/css/style.css` (mod.) | css | sección `/* ── i18n (F-21) ── */` (selector, reglas anti-desborde: `min-width:0`, `text-overflow`, `white-space: normal` en botones y pestañas) | RF-19 |
| `frontend/sw.js` (mod.) | cache | precache de `/js/core/i18n.js` y `/i18n/es.json`; bump de `CACHE` | RF-20 |
| `backend/i18n.py` | module **NUEVO** (Arq. §4) | `LANGS`, `current_lang`, `t`, `load`, `fmt_value`, `fmt_date` | RF-12..RF-14, RF-16, RF-18 |
| `backend/i18n/es.json`, `en.json`, `pt.json` | data **NUEVO** (ubicación PROPUESTA) | textos generados por el backend: `export.*`, `table.*`, `config.*`, `quality.*`, `context.*`, `metrics.*`, `groups.*`, `leaders.*`, `app.*` | RF-10, RF-13, RF-14 |
| `backend/phrases/en.json`, `pt.json` | data **NUEVO** (Arq. §3.15) | plantillas de frases traducidas (mismos ids y marcadores que `es.json`) | RF-12 |
| `backend/api_errors.py` | module **NUEVO** (PROPUESTA) | `ApiError(Exception)` (`message`, `status`, `code`, `details`), `error_response(message, code, status, **details)`, manejador de `ApiError` | RF-15 |
| `backend/app.py` (mod.) | route | las 33 respuestas `jsonify({"error": …})` pasan a `error_response(…, code, …)`; `GET /api/me` agrega `default_language`; lectura de `current_lang()` donde se genera texto | RF-3, RF-14, RF-15, RF-16 |
| `backend/auth.py`, `competitions.py`, `ingest.py`, `fixtures.py` (F-12), `phrases.py` (F-17), `llm.py` (F-15) (mod.) | module | errores con `code`/`details` (heredan de `ApiError`); `phrases.render`/`load_templates` con `lang`; `llm._lang()` → `i18n.current_lang()`; `llm.format_value` delega en `i18n.fmt_value` | RF-12, RF-15, RF-17, RF-18 |
| `backend/fiba_fetcher.py` (mod.) | module | las excepciones (`ValueError`, `FibaSchemaError`, `RuntimeError`) llevan `code`; el texto en español queda como `message` | RF-15 |
| `backend/metrics_catalog.py` (T-05, mod.) | module | `catalog_json(lang)` aplica diccionario (`metrics.<clave>.label|help`, `groups.<g>.label`), conserva siglas internacionales (`INTL_KEYS`), y `ui.metric_labels` gana | RF-10, RF-11 |
| `backend/config.py` (F-13, mod.) | config | `spec_json(lang)` con etiquetas/ayudas/secciones traducidas; activa `ui.default_language` | RF-3, RF-14 |
| `backend/tables.py`, `export_xlsx.py` (T-06, mod.) | module | etiquetas de columnas de texto, títulos y portada con `i18n.t`; nombre de archivo por idioma | RF-13, RF-14 |
| `backend/data_quality.py` (F-11, mod.) | module | `NULL_FIELDS` y chequeos con claves `quality.*` | RF-14 |
| `backend/context.py` (T-03), `population.py` (T-01), `lineup_leaders.py` (F-06), `my_team.py` (F-12), `prepare.py` (F-03), `insights.py` (A-10) (mod.) | module | textos generados (`context.label`, `population.criterion`, categorías, ventanas) vía `i18n.t`; claves de caché con `lang` | RF-14, RF-16 |
| `backend/tools/i18n_audit.py` | tool **NUEVO** (PROPUESTA; solo desarrollo, stdlib, no se importa desde la app) | auditoría mecánica (§4.8) | RF-21 |
| `docs/frontend.md`, `docs/api.md`, `docs/architecture.md`, `docs/deployment.md` | doc | infraestructura de idiomas, encabezado `X-Lang`, códigos de error, convención de claves, flujo para agregar un texto/idioma | — (cierre) |

**Matriz RF → archivo:** RF-1 `i18n.js`, diccionarios · RF-2 `language-selector.js`, `views/configuracion.js`, `app.js`, `core/prefs.js` (F-13) · RF-3 `i18n.js`, `config.py`, `app.py` (`/api/me`), `app.js` (login) · RF-4 `i18n.js`, `router.js`, `catalog.js`, `api.js` · RF-5 `app.js`, `views/*`, `components/*`, `charts.js`, `index.html` · RF-6 `format.js` y vistas (enums por código) · RF-7 `i18n.js` (cadena de respaldo, modo diagnóstico) · RF-8 `i18n.js` (`tn`) · RF-9 (sin cambios: no se traduce; `i18n_audit.py` lista excepciones) · RF-10, RF-11 `metrics_catalog.py`, `config.py`, `catalog.js` · RF-12 `phrases.py`, `phrases/*.json` · RF-13 `tables.py`, `export_xlsx.py`, `components/exporters.js` (T-06) · RF-14 `config.py`, `data_quality.py`, `context.py`, `population.py`, `tables.py` · RF-15 `api_errors.py`, `app.py`, módulos con errores, `api.js`, `i18n.js` (`tError`) · RF-16 `api.js`, `i18n.py`, claves de caché · RF-17 `llm.py` · RF-18 `format.js`, `charts.js`, `i18n.py` · RF-19 `style.css`, componentes · RF-20 `sw.js`, `i18n.js` · RF-21 `i18n_audit.py` · RF-22 §4.1 de este plan.

## 3. Backend — rutas y modelos

Sin tablas ni columnas nuevas. Preferencia `ui · language` (F-13) y configuración `ui.default_language` (enum `es|en|pt`, default `es`, sección Preferencias; F-13 la reserva, F-21 la activa).

### 3.1 Encabezado de idioma (PROPUESTA: no figura en la arquitectura)
`X-Lang: es|en|pt` en toda petición del frontend (la agrega `api.js`). `i18n.current_lang()` resuelve en este orden: encabezado válido → parámetro `?lang=` válido (para descargas directas por enlace) → preferencia del usuario `ui.language` (`prefs.get_prefs("ui")`) → `config.get("ui.default_language")` → `"es"`. Un valor inválido se ignora. No cambia contratos existentes (es un encabezado opcional).

### 3.2 `GET /api/me` (tocado)
Agrega `default_language` (valor de `ui.default_language`) para que la pantalla de inicio de sesión sepa qué idioma usar antes de autenticarse (la ruta es pública hoy). Sin otros cambios.

### 3.3 Formato de error y catálogo inicial de códigos (Arq. §7.8)
`{"error": "<mensaje en español, respaldo>", "code": "<código>", "details": {…}}`. El frontend traduce por `error.<code>.<details.entity|details.param>` → `error.<code>` → mensaje en español. Catálogo inicial, construido de los 33 sitios verificados de `app.py`, `auth.py`, `competitions.py` y `fiba_fetcher.py`:

| Origen (hoy) | HTTP | `code` | `details` | Clave de traducción |
|---|---|---|---|---|
| `app.py:203` "Se requiere campo 'url'" | 400 | `parametro_invalido` | `{param: "url"}` | `error.parametro_invalido.url` |
| `app.py:212` `str(e)` (URL/ID FIBA inválido) | 400 | `fiba_url_invalida` | `{url}` | `error.fiba_url_invalida` |
| `app.py:216` "No se pudo obtener datos de FIBA LiveStats. Verifica la URL." · `fiba_fetcher` (`RuntimeError`) | 502 | `fiba_no_disponible` | — | `error.fiba_no_disponible` |
| `fiba_fetcher` `FibaSchemaError` ("Esquema de FIBA cambió…", "Datos incompletos…") | 502 | `fiba_esquema_cambiado` | `{detail: "<texto técnico en español>"}` | `error.fiba_esquema_cambiado` (el detalle técnico se agrega sin traducir) |
| `app.py:262`, `1060` "Se requiere competition_id entero…" | 400 | `parametro_invalido` | `{param: "competition_id"}` | `error.parametro_invalido.competition_id` |
| `app.py:294`, `952` "Equipo no encontrado" | 404 | `no_encontrado` | `{entity: "team"}` | `error.no_encontrado.team` |
| `app.py:469` "Jugador no encontrado" | 404 | `no_encontrado` | `{entity: "player"}` | `error.no_encontrado.player` |
| `app.py:825` "Partido sin play-by-play. Reimportá el partido." · `app.py:959` "Equipo sin play-by-play. Reimportá sus partidos." | 404 | `sin_pbp` | `{entity: "game"\|"team"}` | `error.sin_pbp.game` / `.team` |
| `app.py:887` "Elegí entre 3 y 5 jugadores" | 400 | `parametro_invalido` | `{param: "players", min: 3, max: 5}` | `error.parametro_invalido.players` |
| `app.py:891`, `905` "Equipo no encontrado o sin play-by-play" | 404 | `no_encontrado` | `{entity: "team_pbp"}` | `error.no_encontrado.team_pbp` |
| `app.py:909` "Sin datos ON/OFF para este jugador" | 404 | `no_encontrado` | `{entity: "onoff"}` | `error.no_encontrado.onoff` |
| `app.py:944`/`978` "El parámetro {name} debe ser un número entero entre {lo} y {hi}." | 400 | `parametro_invalido` | `{param, min, max}` | `error.parametro_invalido.rango` |
| `app.py:955` "El equipo no tiene partidos en la competencia seleccionada." | 404 | `sin_datos` | `{entity: "team_competition"}` | `error.sin_datos.team_competition` |
| `app.py:1020` "Se requiere source_id entero." | 400 | `parametro_invalido` | `{param: "source_id"}` | `error.parametro_invalido.source_id` |
| `app.py:1037` "Elegí una competencia." | 400 | `parametro_invalido` | `{param: "competition"}` | `error.parametro_invalido.competition` |
| `app.py:1051` "offset debe ser un entero ≥ 0." | 400 | `parametro_invalido` | `{param: "offset"}` | `error.parametro_invalido.offset` |
| `app.py:1055` "Se requiere al menos un game_id." · `app.py:1154` "Se requiere game_ids[]" | 400 | `parametro_invalido` | `{param: "game_ids"}` | `error.parametro_invalido.game_ids` |
| `app.py:1170` "Demasiados intentos. Esperá 1 minuto." | 429 | `demasiados_intentos` | `{retry_secs: 60}` | `error.demasiados_intentos` |
| `app.py:1180` "Usuario o contraseña incorrectos" | 401 | `credenciales_invalidas` | — | `error.credenciales_invalidas` |
| `app.py:1211` "Seed deshabilitado en este entorno." | 403 | `seed_deshabilitado` | — | `error.seed_deshabilitado` |
| `auth.py:112,145` "No autenticado" | 401 | `no_autenticado` | — | `error.no_autenticado` |
| `auth.py:147` "Tu usuario no tiene permiso para esta acción." | 403 | `requiere_admin` | — | `error.requiere_admin` |
| `competitions.py` `CompetitionError` (12 mensajes: "Competencia no encontrada.", "La competencia no existe.", "El nombre es obligatorio.", "Estado inválido.", "Ya existe una competencia con ese nombre y temporada.", "No se puede fusionar una competencia consigo misma.", "Partido no encontrado.") | 400/404/409 | `no_encontrado` (`{entity: "competition"\|"game"}`) · `competencia_inexistente` · `parametro_invalido` (`{param: "name"\|"status"}`) · `conflicto` (`{entity: "competition", reason: "duplicada"\|"consigo_misma"}`) | según el caso | `error.<code>.<entity\|param\|reason>` |
| `ingest.reprocess_games` ("Partido no encontrado." por partido) | — (dentro de `failed[]`) | `no_encontrado` | `{entity: "game", game_id}` | `error.no_encontrado.game` |
| Requisitos de v2 (`fixtures`, `llm`, `phrases`, …) | varía | los de sus planes (`conflicto`, `limite_ia`, `llm_error`, `timeout_externo`, `llm_deshabilitado`, `sin_proximo_partido`, …) | según plan | `error.<code>[.<x>]` |
| Error de red del navegador (`TypeError`) | — | (cliente) | — | `error.red` |

Nota de compatibilidad: `error` (texto en español) se mantiene siempre, así que cualquier cliente viejo funciona sin cambios. La resolución del modelo de `ApiError` y `error_response` está en §4.2.

### 3.4 Endpoints que producen texto (siguen igual de forma, ahora respetan `X-Lang`)
`GET /api/metrics-catalog` · `GET /api/settings` · `GET /api/table/<id>` · `GET /api/data-quality` · `GET /api/game-plan` · `GET /api/insights` · `GET /api/my-team` · `GET /api/prepare` · `GET /api/players/…` (etiquetas) · `GET /api/leaders`/`/api/competition-profile` (F-14) · `POST /api/export/xlsx` · `GET /api/export/bulk` · `POST /api/ai/lineup-suggestions`. Sus **claves de caché** (`cache.memo`, Arq. §3.14) incluyen `lang` cuando el payload lleva texto.

## 4. Backend y frontend — lógica

### 4.1 Inventario de superficies de texto (RF-22)
Cada fila es una superficie que deja la fase indicada; "Dónde" cita el requisito dueño. Los archivos exactos se fijan al implementar con la auditoría (§4.8); este inventario es la lista mínima conocida y la guía de las etapas. **Estrategia:** FE = diccionario del frontend; BE = diccionario del backend; COD = por código (enumeración); TPL = plantilla de frases; EXC = excepción (no se traduce).

| # | Superficie | Dónde | Estrategia |
|---|---|---|---|
| S-01 | Cabecera, login ("Ingresá para continuar", "Entrar", errores de acceso), botón Salir, estados globales | `app.js` (hoy); X-01 | FE |
| S-02 | Navegación: etiquetas de las 9 secciones, hoja "Más", pestañas de S1–S9, avisos de ruta ("Esa sección no existe…"), título de la página | X-01 (`router`, `nav.js`, `tabs.js`, vistas) | FE |
| S-03 | Formato: razones de nulo (`NULL_REASON_LABELS`, 14 códigos de Arq. §7.4), "—", tooltips | C-11 (`core/format.js`) | COD (FE) |
| S-04 | Datos (S1): Importar, catálogo (badges de estado), Calidad (chequeos y estados `ok/alerta/no_disponible`), Competencias (formularios, estados `publicada/borrador/archivada`, fusión), Reprocesado (progreso), modal de borrado, Calendario | F-11, F-12, X-01 | FE + COD; nombres de chequeos y etiquetas de campos nulos (`NULL_FIELDS`) = BE (`quality.*`) |
| S-05 | Liga (S2): tabla general (leyenda "Solo partidos importados, no el fixture completo.", columnas PJ/PG/PP…), ranking, mapa (ejes, flechas, tooltips), líderes, perfil | C-09, C-10, T-01, F-14 | FE; ejes del scatter en `charts.js` |
| S-06 | Equipo (S3): pestañas y encabezados, récord, radar ("Ataque", "Defensa", "Promedio liga", …), four factors, game log, filtros (Todos · Últ. 5…), enfrentamiento | X-01, C-02, F-18, F-20 | FE |
| S-07 | Jugador (S4): ficha (campos, "Seguir"), distribución, impacto, tendencias | F-16, A-12, F-12, A-09, A-11 | FE; razones `no_registrado` |
| S-08 | Mapas de tiro: 11 zonas (SVG), tooltip de 7 datos, "Sin tiros registrados", modo 3 zonas | C-03 (`components/shot-chart.js`) | FE (rótulos SVG por clave de zona) |
| S-09 | Muestra: badge BAJA/MEDIA/ALTA, unidades (posesiones/minutos/partidos/intentos), advertencias | T-02 (`sample-badge.js`) | COD (FE) |
| S-10 | Ficha de métrica: tooltips de ranking ("7.º de 12", empate, líder, distancias, "diferencia aritmética"), hoja del ranking completo | T-01 (`metric-card.js`) | FE; ordinales con `tn`/Intl |
| S-11 | Tablas completas: botones (Columnas, Colorear, "Ver todas", paginación, totales, "Promedio competencia"), menú Exportar (CSV/XLSX/PNG/PDF), toasts | T-06 (`data-table.js`, `export-menu.js`) | FE; títulos y etiquetas de columnas de texto = BE (`table.<id>.*`) |
| S-12 | Exportaciones: portada XLSX, cabeceras `# clave: valor` del CSV, maqueta PNG/PDF, filtros aplicados, nombre de archivo | T-06 (`exporters.js`, `export_xlsx.py`) | CSV/PNG/PDF = FE; XLSX = BE (`export.*`) |
| S-13 | Configuración (S9): secciones (Umbrales, Reglas de contexto, Reglas de Momentum, Preferencias), etiquetas y ayudas de ~75 claves, errores por campo, "Aplicar" de la calibración | F-13, T-02 (`settings-form.js`, `config.py`) | BE (`config.<clave>.label|help`, `config.section.*`) + FE (botones, estados) |
| S-14 | Catálogo de métricas: etiquetas (≈60 claves), grupos, descripciones/ayudas nuevas, siglas fijas | T-05, A-12, A-01, A-07… (`metrics_catalog.py`) | BE (`metrics.<clave>.label|help`; `INTL_KEYS` sin traducir) |
| S-15 | Contexto: barra T-03 (dimensiones, valores: Local/Visitante, Descanso 0/1/2/3+, Cuartos 1–4/PR, Ajustado/Paliza, con/sin jugador), selector de base T-04 (Total/Por partido/Por 40/Por 100), filtros rápidos y cabecera F-19 (chips, récord, "N partidos", limpiar) | T-03, T-04, F-19 (`context-bar.js`, `base-selector.js`, `quick-filters.js`, `context-header.js`) | FE + COD; `context.label` ("Últimos 5 · Local") y `ignored[].reason` = BE (`context.*`) |
| S-16 | Plan de juego: encabezados (Ventajas/Riesgos), selector de referencia, ítems; **plantillas de frases** | F-17 (`game-plan.js`, `phrases.py`, `phrases/es.json`) | FE + TPL |
| S-17 | Plantel, Comparar jugadores, Estadísticas por cuarto, Combinaciones y ON/OFF (tarjetas de líderes: 7 categorías y criterios de `lineup_leaders.CATEGORIES`), selector de combinación, "Cierres" | F-08, F-05, F-04, F-06, C-06 | FE; categorías/criterios = BE (`leaders.*`) |
| S-18 | Dimensiones de posesión: orígenes (A-02), tipos de ataque (A-03), desenlaces de segunda oportunidad (A-04), tramos de reloj (A-05), cadenas de eventos (A-07), cruces (A-06), sinergias (A-08), "similares" (A-09), RAPM (A-11) | A-01…A-11 (enums fijados) | COD (FE) para cada enumeración (`enum.origin.*`, `enum.ptype.*`, `enum.chance.*`, `enum.clock.*`) + FE para el resto |
| S-19 | Partido (S5): analizar (boxscore, parciales, jugada a jugada, línea de tiempo, quintetos del partido), vivo (estados "estimado", "stale"), momentum (alertas de racha, "caliente/frío"), informe Preparar (6 bloques, advertencia de "coincidencia en cancha", maquetas A4/1080 px) | F-07, F-01, F-02, F-03 (`game-view.js`, `prepare-report.js`, `matchup-table.js`) | FE + COD; textos de alertas de Momentum si el backend los arma = BE/TPL (verificar en el plan de F-02) |
| S-20 | Explorar (S7): buscador de jugadores/quintetos, consultas guardadas (nombres del usuario = EXC), contextos cruzados, similares | C-08, F-10, A-06, A-09 | FE |
| S-21 | Tendencias: selector de series, pares preconfigurados, medias móviles, hitos, indicador de tendencia, leyendas de Chart.js | F-18 (`charts.js`) | FE |
| S-22 | Insights (A-10) y alertas de Mi equipo (F-12): plantillas de percentiles extremos y de cambio brusco | A-10, F-12 (`phrases/es.json`) | TPL |
| S-23 | Mi equipo (S8) y calendario: bloques, estados, formulario | F-12 | FE |
| S-24 | Sugerencias de IA (F-15): panel, límites, tipos, mensajes; **salida del modelo** y su disclaimer | F-15 (`lineup-suggestions.js`, `llm.py`) | FE + BE (`app.disclaimer`); el texto del modelo sale en `lang` (RF-17) |
| S-25 | Errores del backend (§3.3) y errores de red; toasts de éxito/error | `app.py`, módulos, `apiFetch` | COD (`error.*`) |
| S-26 | Atributos accesibles: `title`, `aria-label`, `placeholder`, `alt`, `confirm()`/`alert()` | todos los componentes | FE (`tText`) |
| S-27 | Documento: `<html lang>`, `<title>`, `manifest.json` | `index.html`, `manifest.json` | FE (runtime) / EXC (manifiesto) |
| S-28 | Fechas y números: `fmtDate` (hoy `dd/mm/aaaa` a mano), `Intl.NumberFormat("es-UY")`, `Chart.defaults.locale`, formateador de backend | `format.js`, `charts.js`, `i18n.py` | locale por idioma |
| S-29 | Datos de usuario y de FIBA: nombres de equipos/jugadores/competencias, notas, nombres de consultas guardadas, `ui.metric_labels` | varios | EXC (RF-9, RF-11) |

### 4.2 `backend/api_errors.py` (PROPUESTA)
```
class ApiError(Exception): message: str; status: int = 400; code: str = "parametro_invalido"; details: dict
error_response(message: str, code: str, status: int = 400, **details) -> tuple[Response, int]
    # jsonify({"error": message, "code": code, "details": details or {}}), status   (los `details` vacíos se envían como {})
register(app)   # @app.errorhandler(ApiError) -> error_response(e.message, e.code, e.status, **e.details)
```
`CompetitionError`, `FixtureError` (F-12), `LlmError` (F-15) y `PhrasesError` (F-17) pasan a heredar de `ApiError`, de modo que las rutas existentes `except … as e: return jsonify({"error": str(e)}), e.status` se simplifican a dejar que el manejador responda. `fiba_fetcher` define `FibaError(ApiError)` con subclases (`FibaUrlError`, `FibaUnavailable`, `FibaSchemaError`) que conservan sus textos en español. Regla: ningún `jsonify({"error": …})` literal queda en `app.py` (lo verifica `i18n_audit.py backend`).

### 4.3 Frontend `core/i18n.js`
```
LANGS = ["es","en","pt"];  LOCALES = {es: "es-UY", en: "en-US", pt: "pt-BR"}
initI18n({serverDefault}) -> Promise<void>          # idioma = localStorage sb.lang || serverDefault || "es"; carga es (respaldo) y el activo
getLanguage() -> "es"|"en"|"pt";  getLocale() -> string
setLanguage(lang, {persist = true}) -> Promise<void>
    1. seq = ++_seq; dict = await api.i18n(lang)  (si falla: toast `i18n.error_cambio`, se conserva el actual; sin conexión y no cargado: `i18n.sin_conexion`)
    2. si seq != _seq → descartar (evita carreras entre cambios rápidos)
    3. _dict[lang] = dict; _lang = lang; document.documentElement.lang = lang; document.title = tText("app.titulo")
    4. localStorage sb.lang (try/catch); si persist: setPref("ui","language",lang) (F-13; fallo → toast `i18n.error_guardar`)
    5. format.js invalida sus formateadores; Chart.defaults.locale = getLocale()
    6. await catalog.reload(); notificar onLanguageChange; router.rerender()
onLanguageChange(fn)
t(key, fallback, params?)   -> string HTML-seguro: busca _dict[lang][key] → _dict.es[key] → fallback → key; interpola {param} escapando HTML de los valores
tText(key, fallback, params?) -> string de texto plano (sin escapar) para textContent, title, placeholder, aria-label, toasts
tn(key, count, fallback, params?) -> elige `key.one` / `key.other` (o `.zero`) con Intl.PluralRules(locale) y pasa {n: count}
tError(err) -> string: err.code → `error.<code>.<details.entity|param|reason>` → `error.<code>` → err.message (español del servidor) → `error.red` si err es TypeError
```
Reglas: el nombre de la clave sigue `<superficie>.<componente>.<texto>` en `snake_case` (≤ 4 niveles; las claves son planas, no se anidan en el JSON); valores con `{param}`; plurales `.one`/`.other`; sin HTML en los valores (el marcado queda en el código); `t()` se usa donde el resultado se inserta con `innerHTML` (los parámetros se escapan) y `tText()` donde se asigna a `textContent`/atributos. **Pseudo-localización y diagnóstico** (solo si la URL trae `?i18n=pseudo` o `?i18n=keys`): `pseudo` envuelve cada cadena traducida en `⟦…⟧`, reemplaza vocales por equivalentes acentuados y agrega ~30 % de relleno; `keys` muestra la clave. Las cadenas que **no** pasan por `t()` quedan sin marcas → se ven a ojo. Si C-11 ya creó `core/i18n.js` con un `t()` mínimo (en contra de DA-21), esta tarea lo extiende conservando su firma.

### 4.4 Cambio de idioma sin recargar (RF-4)
`router.rerender()` (PROPUESTA de adición a `core/router.js` de X-01) vuelve a ejecutar el render de la ruta actual sin tocar el hash ni el contexto (usa el contador `_renderSeq` existente). Las vistas ya piden sus datos en cada render, así que los textos del backend se refrescan solos con el nuevo `X-Lang`. `core/catalog.js` descarta su caché y recarga `GET /api/metrics-catalog`. Los gráficos se reconstruyen en el re-render (los rótulos se arman con `tText` al dibujar). El estado de pestaña, filtros y scroll de tablas se conserva porque vive en la URL y en `core/context.js`.

### 4.5 Idioma efectivo y selector (RF-2, RF-3)
`boot()`: `await initI18n({serverDefault: me.default_language})` **antes** de `showLogin()`/`renderApp()`; tras autenticar y `loadPrefs("ui")`, si `getPref("ui","language")` difiere del activo se llama `setLanguage(pref, {persist: false})`. `components/language-selector.js`: `renderLanguageSelector(el, {compact})` dibuja un `<select>` (o, en móvil, un botón con ES/EN/PT y lista) con los nombres propios ("Español", "English", "Português"); `onchange` → `setLanguage`. Se monta en la cabecera (siempre), en la pantalla de login y en S9 · Preferencias (`views/configuracion.js`: bloque "Idioma" para el usuario y, solo administradores, la fila de `ui.default_language` generada por `settings-form`).

### 4.6 Backend `backend/i18n.py`
```
LANGS = ("es", "en", "pt")
current_lang() -> str                       # §3.1; sin contexto de petición (scripts) → "es"
load(lang) -> dict                          # lee backend/i18n/<lang>.json; caché en memoria por proceso
t(key: str, lang: str | None = None, **params) -> str     # lang None → current_lang(); cadena de respaldo lang → es → clave (registra faltantes en el log)
fmt_value(fmt: str, v: float | None, lang: str | None = None) -> str | None   # pct|dec1|dec2|int|signed_int|signed_dec2; half-up exacto; coma/punto por idioma (mueve la lógica de F-15)
fmt_date(iso: str, lang: str | None = None) -> str                           # dd/mm/aaaa (es, pt) · mm/dd/aaaa (en)
```
`phrases.render(template_id, values, *, lang)`: elige la plantilla en `phrases/<lang>.json` (misma estructura que `es.json`; si falta el id en el idioma → español) y formatea cada valor con `fmt_value(metric.fmt, v, lang)`. `metrics_catalog.catalog_json(lang)`: por métrica, `label = ui.metric_labels[key]` (si existe) o, si `key ∈ INTL_KEYS`, la sigla del catálogo en español (sin traducir), o `t("metrics.<key>.label")`; `help = t("metrics.<key>.help")` (nuevo campo con la descripción del glosario v2 §6 en los tres idiomas); `groups` por `t("groups.<g>.label")`. `INTL_KEYS` = {`oer`, `der`, `net_rating`, `efg_pct`, `ts_pct`, `ppt`, `ppt_2`, `ppt_3`, `ppt_ft`, `ppp`, `pace`, `uso_pct`, `or_pct`, `dr_pct`, `trb_pct`, `to_pct`, `ft_rate`, `fg_pct`, `fg2_pct`, `fg3_pct`, `ft_pct`, `ast_to`, `as_pct`, `plus_minus`} (lista en un solo lugar del catálogo; PROPUESTA a confirmar, spec §9). Las demás (palabras comunes y abreviaturas de origen español: `games`, `minutes`, `possessions`, `stl`, `blk`, `tov`, `ast`, `orb`, `drb`, `pf`, `fouls_drawn`, `blk_received`, `fga2`…) se traducen.
`export_xlsx.workbook_bytes(sheets, meta)`: la portada usa `i18n.t("export.meta.<campo>", lang)` (idioma tomado de la petición); los encabezados de columnas llegan ya rotulados por el cliente en su idioma (el cliente envía `columns[].label`); el nombre de archivo lo arma el cliente con `export.file.<apartado>`.
`tables.py`: `columns[].label` de las columnas de texto y `title` por `t("table.<id>.title"|"table.<id>.col.<key>")` con parámetros (`{team}`).

### 4.7 Formato por idioma (RF-18)
`core/format.js`: `_nf(decimals)` usa `Intl.NumberFormat(getLocale(), …)` con caché por `(locale, decimals)`; `fmtDate(iso)` usa `Intl.DateTimeFormat(getLocale(), {day:"2-digit", month:"2-digit", year:"numeric", timeZone:"UTC"})` sobre `Date.UTC(y, m-1, d)` (evita el corrimiento por huso) y reemplaza a `_fmtDate`; `charts.js` fija `Chart.defaults.locale = getLocale()` al iniciar y al cambiar el idioma. Los datos de exportación (CSV/XLSX) conservan la convención de T-06 (CSV con `;` y coma, XLSX numérico): no usan `getLocale()`.

### 4.8 `backend/tools/i18n_audit.py` (verificación mecánica, RF-21)
Herramienta de desarrollo, stdlib, ejecutable a mano (`python backend/tools/i18n_audit.py <modo>`), sin importar nada de la app. Salida: lista `archivo:línea · motivo · fragmento`; código de salida distinto de 0 si hay hallazgos.
- `frontend`: recorre `frontend/js/**/*.js` y `frontend/index.html`; extrae literales de cadena y el texto estático de plantillas (`>texto<` y texto fuera de `${…}` dentro de backticks); marca como "sin traducir" los que parecen texto de interfaz (contienen una palabra de ≥ 3 letras con espacios, o vocales acentuadas/"ñ"/"¿"/"¡", o están en una lista de palabras españolas frecuentes) y no están dentro de `t(`/`tText(`/`tn(`, ni en la lista de excepciones `backend/tools/i18n_allow.txt` (siglas, íconos, clases CSS, rutas, nombres de evento). Cubre atributos `title=`, `aria-label=`, `placeholder=`, `alt=`, `confirm(`, `alert(`.
- `backend`: marca `jsonify({"error": …})` y `raise …Error("<texto>")` con texto en español sin `code`, y cadenas en español devueltas en respuestas JSON de módulos con texto de UI sin pasar por `i18n.t`.
- `parity`: compara claves, parámetros `{x}` y formas plurales entre `frontend/i18n/*.json`, entre `backend/i18n/*.json` y entre `backend/phrases/*.json` (ids y marcadores de las plantillas); detecta valores vacíos, claves usadas en el código (`t('…')`) y ausentes del diccionario `es`, y claves del diccionario nunca usadas.
La lista de excepciones documentadas (RF-9) vive en `i18n_allow.txt` con un comentario por línea.

### 4.9 Glosario de traducción (base de la primera versión; a revisar por un hablante nativo)
| Español | Inglés | Portugués (Brasil) |
|---|---|---|
| partido | game | jogo |
| temporada · competencia · liga | season · competition · league | temporada · competição · liga |
| equipo · jugador · entrenador | team · player · coach | equipe · jogador · técnico |
| local · visitante | home · away | mandante · visitante |
| plantel | roster | elenco |
| quinteto · combinación | lineup · combination | quinteto · combinação |
| cierres (de partido) | clutch | clutch (finais decisivos) |
| posesión · ritmo | possession · pace | posse de bola · ritmo |
| tiro libre · tiro de campo · triple | free throw · field goal · three-pointer | lance livre · arremesso de quadra · bola de três |
| rebote ofensivo · defensivo | offensive · defensive rebound | rebote ofensivo · defensivo |
| pérdida · robo · tapón | turnover · steal · block | desperdício de bola · roubo de bola · toco |
| asistencia · falta | assist · foul | assistência · falta |
| muestra (baja/media/alta) | sample (low/medium/high) | amostra (baixa/média/alta) |
| percentil · promedio · ventaja · riesgo | percentile · average · advantage · risk | percentil · média · vantagem · risco |
| próximo partido · calendario | next game · schedule | próximo jogo · calendário |
| plan de juego · alertas | game plan · alerts | plano de jogo · alertas |
| Reimportá sus partidos | Re-import its games | Reimporte seus jogos |
Registro: en y pt sin voseo; botones en imperativo ("Importar" → "Import", "Importar").

### 4.10 Casos borde
Clave ausente en `en`/`pt` → español (RF-7) y la auditoría la reporta; parámetro faltante en `t()` → se deja el marcador `{n}` visible solo en modo `keys`, y en normal se reemplaza por vacío (sin romper el texto) y se registra en consola; plural sin `.other` → usa la clave base; `X-Lang` inválido → ignorado; `localStorage` bloqueado → idioma de sesión sin copia local (try/catch); respuesta de diccionario inválida → se mantiene el idioma actual; carrera de cambios → `_seq`; descarga por enlace directo sin cabecera → `?lang=`. Excepciones por no traducibles: nombres propios (S-29).

## 5. Frontend — capa API (`api.js`)
```js
const _langHeader = () => ({ "X-Lang": getLanguage() });
apiFetch(path, opts): headers = { ..._langHeader(), ...(opts.headers || {}) }; ante !res.ok → e = new Error(err.error || res.statusText); e.code = err.code; e.details = err.details; e.status = res.status; throw e
apiFetchBlob(path, opts): igual encabezado (T-06)
i18n: (lang) => apiFetch(`/i18n/${encodeURIComponent(lang)}.json`)        // estático; sin X-Lang relevante
```
`setSection`/vistas dejan de usar `err.message` directo: `toast(tError(err), "err")`. `qs()` no cambia. Sigue siendo el único lugar con `fetch`.

## 6. Frontend — UI
- **Selector** (`components/language-selector.js`): cabecera (desktop: `<select>` al costado del usuario; móvil: botón ES/EN/PT con lista), login y S9. Estados del spec §6.
- **Extracción por etapas** (ver §10 y `tasks.md`): E1 cáscara (S-01, S-02, S-03, S-25–S-28), E2 fase 1 (S-04, S-05, S-08..S-14), E3 fase 2 (S-06, S-07, S-15..S-17), E4 fases 3–5 (S-18..S-24), cada una con su pasada de `i18n_audit.py frontend` hasta 0.
- **Enumeraciones**: cada una con su prefijo (`enum.origin.<código>`, `nulos.razon.<código>`, `muestra.nivel.<nivel>`, `muestra.unidad.<unidad>`, `calidad.estado.<estado>`, `competencia.estado.<estado>`, `contexto.<dimensión>.<valor>`, `base.<valor>`) y un helper `enumLabel(prefix, code)` en `core/i18n.js` (cae en el código solo si no hay clave, en modo diagnóstico).
- **Anti-desborde** (RF-19): reglas en `style.css` para `nav button`, `.tab`, `.btn`, `.filter-pill`, `th`, `.card-title`, `.stat-box` (`min-width:0`, `overflow-wrap:anywhere`, `white-space: normal` donde corresponda, `text-overflow: ellipsis` + `title` completo en etiquetas de navegación); las maquetas de exportación (A4, 1080 px) se verifican en portugués (el idioma de textos más largos).
- Mobile (<768 px): selector compacto; la hoja "Más" incluye el selector; barra inferior con etiquetas que no se parten (`ellipsis`).
- Componentes compartidos reutilizados (§8 de la arquitectura): todos; ninguno cambia de contrato, solo de origen de sus textos.

## 7. Navegación
Sin rutas nuevas. El selector no altera el hash; `router.rerender()` conserva sección, id, pestaña y query. `docs/frontend.md`: sección "Idiomas" (convención de claves, `t`/`tText`/`tn`, cómo agregar un texto y un idioma, pseudo-localización, auditoría).

## 8. Contratos de datos
Diccionario (frontend y backend), archivo plano:
```json
{
  "_meta": {"lang": "en", "version": 1},
  "nav.seccion.liga": "League",
  "datos.borrado.eliminados.one": "{n} game deleted",
  "datos.borrado.eliminados.other": "{n} games deleted",
  "nulos.razon.sin_perdidas": "No turnovers: the ratio is undefined",
  "error.no_encontrado.team": "Team not found"
}
```
Plantilla de frases (`backend/phrases/en.json`, misma estructura que `es.json` de F-17):
```json
{"id": "ventaja_efg_pct", "metric": "efg_pct", "when": "ventaja", "text": "Shooting edge: look for more volume in the half court"}
```
`GET /api/me` → `{"authenticated": true, "user": "nico", "auth_required": true, "seed_enabled": false, "is_admin": true, "default_language": "es", "llm_enabled": false}`. Error → §3.3. Filas SQLAlchemy: ninguna.

## 9. Manejo de errores y offline
Errores de idioma: cambio fallido → toast `i18n.error_cambio` y se conserva el idioma; guardado de preferencia fallido → toast `i18n.error_guardar` y se usa solo localmente; diccionario no disponible sin conexión → aviso `i18n.sin_conexion`. Offline: `sw.js` precachea `/js/core/i18n.js` y `/i18n/es.json`; los diccionarios de `en`/`pt` quedan en la caché de runtime (X-01) después de la primera elección, de modo que volver a elegirlos offline funciona (CA-14). `CACHE` sube al siguiente entero al integrar (Arq. §3.13). Los textos del backend nunca se cachean entre idiomas (clave de caché con `lang`).

## 10. Riesgos y decisiones

- **R-1 (volumen):** es el requisito con más superficie: cientos de líneas de `app.js` más todo lo que agregan ≈50 requisitos (≈75 claves de configuración, ≈60 métricas, plantillas, 40 tablas, enumeraciones). Mitigación: inventario §4.1, etapas E0–E6 con auditoría mecánica por etapa y partición sugerida si la medición supera 40 h: **F-21a** (E0 infraestructura + E1 cáscara + errores/`X-Lang`, ≈ 8–12 h) · **F-21b** (E2–E4 extracción frontend por fases, ≈ 12–18 h) · **F-21c** (E5 backend + E6 traducción, revisión y verificación, ≈ 8–12 h).
- **R-2 (conflicto con trabajo en curso):** la extracción toca todos los archivos de UI; se hace al final, con las vistas de fases 1–5 estables, y se congela el copy durante E2–E4.
- **R-3 (calidad de traducción):** la primera versión usa el glosario §4.9; la frase accionable de F-17/A-10 y la terminología deportiva requieren revisión nativa (spec §9 [NEEDS CLARIFICATION]). Mientras no haya revisión, `en`/`pt` se marcan "versión preliminar" en el pie de S9 (opcional).
- **R-4 (DA-21 vs. planes que ya usan `t()`):** los planes de F-13, T-06, X-01, F-03 y otros citan `t('clave','Texto')` aunque DA-21 dijo que no; si esos `t()` quedaron en el código, F-21 los conserva y les agrega diccionario; el nombre de la función y su firma `t(key, fallback, params)` coinciden con la arquitectura para no reescribirlos. Se reporta en `huecos_arquitectura`.
- **R-5 (HTML y escape):** el código actual arma HTML con plantillas; `t()` escapa los parámetros y `tText()` no, y la auditoría marca `t()` dentro de `textContent` y `tText()` dentro de `innerHTML` con parámetros de usuario.
- **R-6 (rendimiento):** el diccionario de cada idioma pesa del orden de decenas de KB; se carga una vez y se cachea. `X-Lang` agrega un encabezado por petición (despreciable). Las claves de caché con `lang` multiplican por 3 las entradas de los namespaces con texto (LRU acotado; se mide).
- **D-1 (backend vs. frontend como dueño del diccionario):** catálogo de métricas, tablas, configuración, calidad, contexto y exportación XLSX son del **backend** (el payload ya viaja en el idioma pedido); chrome de UI, enumeraciones por código, errores y CSV/PNG/PDF son del **frontend**. Evita duplicar etiquetas en dos lados. Los códigos de razón de nulo viven solo en el frontend (el backend envía el código, §7.4).
- **D-2 (PROPUESTAS que se reportan como huecos):** encabezado `X-Lang` y `?lang=`; `backend/i18n/<lang>.json`; `backend/api_errors.py`; `components/language-selector.js`; `router.rerender()`; `default_language` en `/api/me`; `INTL_KEYS`; `backend/tools/i18n_audit.py`; códigos de error nuevos (`fiba_*`, `demasiados_intentos`, `credenciales_invalidas`, `no_autenticado`, `sin_datos`, `sin_proximo_partido`, `limite_ia`).
- **D-3 (formato por idioma):** se aparta de DA-36 solo en inglés y portugués (`en-US`, `pt-BR`); español queda `es-UY`. Si el cliente prefiere coma decimal en los tres, se cambia `LOCALES` en un solo lugar.
- **Desviaciones respecto de la arquitectura:** (1) por DA-21 (decisión humana) no hay `t()` previo: la extracción es de F-21; (2) los diccionarios del backend y el encabezado de idioma no están fijados en la arquitectura (PROPUESTAS); (3) las etiquetas de métricas traducen las palabras comunes y no las siglas (la arquitectura §3.20 decía que "las siglas no se traducen", lo cual se cumple; se explicita la lista).
- **Dependencias técnicas:** registro de secciones/pestañas, router, `collapsible`, runtime caching ([X-01](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/plan.md)); `phrases.py` y plantillas ([F-17](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/plan.md)); plantillas de percentiles extremos ([A-10](../10-A-10-insights-automaticos/plan.md)); tablas, `export_xlsx.py`, exportadores y metadatos ([T-06](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/plan.md)); `core/prefs.js`, `config.py`, `ui.default_language`, incremento "Idioma" ([F-13](../../fase-1-confiabilidad/12-F-13-configuracion/plan.md)); `catalog_json(lang)` y etiquetas ([T-05](../../fase-1-confiabilidad/13-T-05-conjunto-estandar-metricas/plan.md)); `NULL_REASON_LABELS` y `core/format.js` ([C-11](../../fase-1-confiabilidad/01-C-11-tratamiento-de-nulos/plan.md)); `data_quality.py` ([F-11](../../fase-1-confiabilidad/02-F-11-calidad-datos-competencias/plan.md)); `llm._lang()` y `format_value` ([F-15](../13-F-15-sugerencias-quinteto-ia/plan.md)); alertas y copy de S8 ([F-12](../12-F-12-mi-equipo/plan.md)); informe y maquetas ([F-03](../../fase-4-dia-de-partido/02-F-03-preparar-partido/plan.md)); más los planes de las demás superficies del inventario §4.1 (cada uno aporta su lista de copy en su §6).
- **Incrementos diferidos que completa:** F-13 "Idioma" en S9, F-15 "salida en inglés y portugués". No deja incrementos diferidos.
- **Estimación:** XL · 28–40 h (infraestructura y cáscara 8–10 h; extracción frontend por fases 10–14 h; backend, errores y exportaciones 5–7 h; traducción en/pt y glosario 4–6 h; auditoría, verificación en 3 idiomas y 2 anchos y docs 3–5 h). Si al medir supera 40 h, aplicar la partición de R-1.
