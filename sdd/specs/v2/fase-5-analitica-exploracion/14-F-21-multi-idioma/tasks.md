# Tasks — F-21: Multi-idioma

> **ID:** F-21 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 14
> **Depende de:** X-01 · F-17 · A-10 · T-06 (y F-13, F-15, F-12, F-03 por el alcance de superficies)
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 3)
> **Fuente:** `plan.md` de este mismo requisito

## Orden de ejecución

> Congelar el copy de UI de otros requisitos mientras corren los grupos B y D (riesgo R-2 del plan). Antes de empezar, guardar la línea base de texto en español (T-F1).

### Grupo A — Backend: infraestructura (esquema: sin cambios)
- [ ] T-A1 · Confirmar que no hay cambios de esquema y activar `ui.default_language` (enum `es|en|pt`, default `es`) en `CONFIG_SPEC` · `backend/config.py` · cubre RF-3 · Done: `GET /api/settings` lista `ui.default_language` en Preferencias; `python backend/database.py` dos veces sin error
- [ ] T-A2 · `backend/i18n.py`: `LANGS`, `current_lang` (encabezado → `?lang=` → preferencia → configuración → `es`), `load`, `t` con cadena de respaldo y log de faltantes · cubre RF-3, RF-16 · Done: con `app.test_client()`, `current_lang()` devuelve el idioma del encabezado `X-Lang: en`, ignora `X-Lang: xx` y cae a la preferencia/configuración
- [ ] T-A3 [P] · `fmt_value` (half-up exacto, coma/punto por idioma) y `fmt_date` en `i18n.py`; `llm.format_value` delega en `fmt_value` · cubre RF-18 · Done: `fmt_value("dec2", 0.125, "es") == "0,13"`, en inglés `"0.13"`; los 20 valores de la verificación de F-15 siguen coincidiendo
- [ ] T-A4 · `backend/api_errors.py`: `ApiError`, `error_response`, manejador registrado en `app.py` · cubre RF-15 · Done: lanzar `ApiError("x", 404, "no_encontrado", entity="team")` en una ruta de prueba devuelve `{error, code, details}` con HTTP 404
- [ ] T-A5 · `GET /api/me` agrega `default_language` · `backend/app.py` · cubre RF-3 · Done: `curl /api/me` (sin sesión) devuelve `default_language`
- [ ] T-A6 [P] · Esqueletos `backend/i18n/{es,en,pt}.json` con `_meta` y las claves de prefijo `export.*`, `table.*`, `config.*`, `quality.*`, `context.*`, `metrics.*`, `groups.*`, `leaders.*`, `app.*` · cubre RF-10, RF-13, RF-14 · Done: `i18n.load("en")` devuelve el dict sin error
- [ ] T-A7 · `backend/tools/i18n_audit.py` con modos `frontend`, `backend` y `parity` y `i18n_allow.txt` inicial · cubre RF-21 · Done: ejecutarlo sobre el código sin extraer lista hallazgos y sale con código ≠ 0; sobre un archivo con solo `t()` no reporta nada

### Grupo B — Backend: textos y errores
- [ ] T-B1 · Migrar las 33 respuestas `jsonify({"error": …})` de `app.py` y las 3 de `auth.py` a `error_response`/`ApiError` con `code` y `details` según la tabla de plan §3.3 · `backend/app.py`, `backend/auth.py` · cubre RF-15 · Done: `python backend/tools/i18n_audit.py backend` no reporta `jsonify({"error"…})` sin `code`; el texto `error` en español no cambia
- [ ] T-B2 · `CompetitionError` (y `FixtureError`, `LlmError`, `PhrasesError` si existen) heredan de `ApiError` con `code`/`details` · `backend/competitions.py`, `fixtures.py`, `llm.py`, `phrases.py` · cubre RF-15 · Done: `PATCH /api/competitions/9999` devuelve `code: no_encontrado`, `details.entity: competition`
- [ ] T-B3 · `fiba_fetcher`: `FibaError(ApiError)` con `FibaUrlError`, `FibaUnavailable`, `FibaSchemaError` y `code`; `POST /api/import` los mapea (400 `fiba_url_invalida`, 502 `fiba_no_disponible`/`fiba_esquema_cambiado` con `details.detail`) · `backend/fiba_fetcher.py`, `backend/app.py` · cubre RF-15 · Done: importar una URL inválida y una de un partido inexistente devuelve el código esperado y el mensaje en español de respaldo
- [ ] T-B4 · `ingest.reprocess_games`: `failed[]` con `code` y `details` · `backend/ingest.py` · cubre RF-15 · Done: reprocesar un `game_id` inexistente devuelve `failed[0].code == "no_encontrado"`
- [ ] T-B5 · `metrics_catalog.catalog_json(lang)`: etiquetas y `help` por idioma, `INTL_KEYS` sin traducir, `ui.metric_labels` con prioridad; claves `metrics.*`/`groups.*` en `es` (extraídas del catálogo actual) · `backend/metrics_catalog.py`, `backend/i18n/es.json` · cubre RF-10, RF-11 · Done: `GET /api/metrics-catalog` con `X-Lang: es` es idéntico al actual; con `X-Lang: en`, `efg_pct.label == "eFG%"` y `games.label` traducido; un override de `ui.metric_labels` se conserva en los tres
- [ ] T-B6 · `config.spec_json(lang)`: etiquetas, ayudas y secciones por `config.<clave>.label|help` y `config.section.*`; `ui.metric_labels`/valores no se traducen · `backend/config.py` · cubre RF-14 · Done: `GET /api/settings` en español idéntico al actual; en inglés las etiquetas cambian
- [ ] T-B7 · `tables.py`: `title` y etiquetas de columnas de texto por `table.<id>.*` con parámetros · `backend/tables.py` · cubre RF-13, RF-14 · Done: `GET /api/table/team_lineups?team=CNF` con `X-Lang: pt` devuelve título y columnas de texto en portugués; los `values` no cambian
- [ ] T-B8 · `export_xlsx.py`: portada con `export.meta.*` en el idioma de la petición · `backend/export_xlsx.py` · cubre RF-13 · Done: `POST /api/export/xlsx` con `X-Lang: en` abre en Excel con la portada en inglés y datos iguales a los de español
- [ ] T-B9 · `data_quality.py`: `NULL_FIELDS` y chequeos por `quality.*` · `backend/data_quality.py` · cubre RF-14 · Done: `GET /api/data-quality` en inglés devuelve etiquetas en inglés; los códigos y los conteos no cambian
- [ ] T-B10 · Textos generados restantes con `i18n.t`: `context.label` y `ignored[].reason` (`context.py`), `population.criterion`/`context_label` (`population.py`), categorías y criterios (`lineup_leaders.py`), ventanas y razones (`my_team.py`), informe (`prepare.py`), disclaimer (`llm.py`) · cubre RF-14 · Done: cada payload con `X-Lang: pt` trae sus textos en portugués y el resto del contrato igual
- [ ] T-B11 · `phrases.py`: `render`/`load_templates`/`game_plan` con `lang`; formato de valores por `i18n.fmt_value`; respaldo al español si falta un id · `backend/phrases.py` · cubre RF-12, RF-18 · Done: `GET /api/game-plan` con `X-Lang: en` devuelve frases en inglés con punto decimal
- [ ] T-B12 · Claves de caché con `lang` en todos los namespaces con texto (`prepare`, `my_team`, `llm`, `insights`, catálogo, tablas si se cachean) · `backend/*` · cubre RF-16 · Done: pedir el mismo endpoint en `es` y luego en `en` no devuelve el texto en español la segunda vez (revisar con `grep "cache.memo("`)
- [ ] T-B13 · `llm._lang()` devuelve `i18n.current_lang()`; el prompt de F-15 pide redactar en ese idioma · `backend/llm.py` · cubre RF-17 · Done: con el servicio simulado y `X-Lang: en`, el sistema pide inglés y las cifras salen con punto decimal y pasan `validate_numbers`
- [ ] T-B14 · `phrases/en.json` y `phrases/pt.json` (todas las plantillas de F-17, A-10, F-12 y F-03) con los mismos ids y marcadores que `es.json` · cubre RF-12 · Done: `i18n_audit.py parity` no reporta diferencias de ids ni de marcadores

### Grupo C — Frontend: infraestructura y api.js
- [ ] T-C1 · `core/i18n.js`: `LANGS`, `LOCALES`, `initI18n`, `getLanguage`, `getLocale`, `setLanguage` (carrera `_seq`, errores, offline), `onLanguageChange`, `t`, `tText`, `tn`, `tError`, `enumLabel`, pseudo-localización y modo `keys` · cubre RF-1, RF-4, RF-7, RF-8 · Done: desde la consola, `t("x.y","Hola")` devuelve "Hola"; con `?i18n=pseudo` devuelve `⟦…⟧` alargado; `tn` elige singular/plural
- [ ] T-C2 · `api.js`: encabezado `X-Lang` en `apiFetch`/`apiFetchBlob`, error con `code`/`details`/`status`, `api.i18n(lang)` · cubre RF-15, RF-16, RF-20 · Done: en la pestaña Network toda petición `/api/*` lleva `X-Lang`; un 404 deja `err.code === "no_encontrado"`
- [ ] T-C3 · `core/format.js`: formateadores por locale con caché invalidable, `fmtDate`, `NULL_REASON_LABELS` → claves `nulos.razon.*` · cubre RF-6, RF-18 · Done: en inglés `fmtNumber(1.09)` → "1.09"; `fmtDate("2026-10-04")` → "10/04/2026" en inglés y "04/10/2026" en español; "—" intacto
- [ ] T-C4 · `frontend/i18n/es.json` inicial (vacío con `_meta`) y carga de diccionarios; `core/catalog.js` recarga al cambiar de idioma · cubre RF-4, RF-10 · Done: cambiar de idioma re-pide `GET /api/metrics-catalog`
- [ ] T-C5 · `components/language-selector.js` (desktop `<select>`, móvil botón + lista, nombres propios) · cubre RF-2 · Done: aparece en la cabecera y cambia el idioma
- [ ] T-C6 · `router.rerender()` (PROPUESTA) y arranque: `initI18n` antes de `showLogin`/`renderApp`; aplicar la preferencia tras `loadPrefs("ui")` · `core/router.js`, `app.js` · cubre RF-3, RF-4 · Done: cambiar el idioma en `#/equipo/CNF/quintetos?competition=3&last=5` no cambia la URL ni los filtros y repinta
- [ ] T-C7 · Charts: `Chart.defaults.locale = getLocale()` al iniciar y al cambiar · `frontend/js/charts.js` · cubre RF-18 · Done: ticks y tooltips con la convención del idioma

### Grupo D — Frontend: extracción de textos (una pasada de `i18n_audit.py frontend` por etapa hasta 0)
- [ ] T-D1 · Etapa E1 — cáscara: cabecera, login, `NAV_ITEMS`/registro de secciones y pestañas, hoja "Más", avisos de ruta, estados globales, `<title>` y `lang` · `app.js`, `core/router.js`, `components/nav.js`, `components/tabs.js` · cubre RF-5 (S-01, S-02, S-27) · Done: `i18n_audit.py frontend` sin hallazgos en esos archivos; el español se ve idéntico
- [ ] T-D2 · E1 — formato y utilidades: razones de nulo, `toast`, estados loading/vacío/error genéricos · `core/format.js`, `core/ui.js`, `views/_shared.js` · cubre RF-5, RF-6 (S-03, S-25) · Done: ídem
- [ ] T-D3 · E2 — S1 Datos: Importar, catálogo, Calidad, Competencias, Reprocesado, modal de borrado, Calendario · `views/datos.js`, `components/fixtures-manager.js` · cubre RF-5, RF-6 (S-04) · Done: ídem
- [ ] T-D4 · E2 — S2 Liga: tabla general (leyenda de partidos importados), ranking, mapa y ejes, líderes, perfil · `views/liga.js`, `charts.js` · cubre RF-5 (S-05) · Done: ídem
- [ ] T-D5 · E2 — componentes transversales de fase 1: shot-chart (11 zonas, tooltip), sample-badge, metric-card, standard-panel, data-table, export-menu, exporters (CSV/PNG/PDF), settings-form · `components/*.js` · cubre RF-5, RF-6, RF-13 (S-08..S-13) · Done: ídem; el CSV exportado en inglés trae las líneas `# clave: valor` en inglés
- [ ] T-D6 · E3 — S3 Equipo y S4 Jugador: pestañas, resumen, radar, four factors, game log, ficha, distribución, impacto, tendencias, botones fijar/seguir · `views/equipo.js`, `views/jugador.js`, `charts.js` · cubre RF-5 (S-06, S-07) · Done: ídem
- [ ] T-D7 · E3 — contexto y comparación: context-bar, base-selector, quick-filters, context-header, plan de juego, plantel, comparar, cuartos, combinaciones/ON-OFF, tarjetas de líderes · `components/*.js`, `views/comparar.js` · cubre RF-5, RF-6 (S-15..S-17) · Done: ídem
- [ ] T-D8 · E4 — posesión y partido: dimensiones A-02..A-05 (enumeraciones `enum.*`), cadenas A-07, cruces A-06, sinergias, similares, RAPM, game-view, matchup-table, vivo, momentum, informe Preparar (incluidas las maquetas A4/1080 px) · `views/equipo.js`, `views/partido.js`, `components/*.js` · cubre RF-5, RF-6 (S-18, S-19) · Done: ídem
- [ ] T-D9 · E4 — Explorar, tendencias, Mi equipo y panel de IA: buscador, consultas guardadas, series y leyendas, S8, panel de sugerencias · `views/explorar.js`, `views/mi-equipo.js`, `components/lineup-suggestions.js` · cubre RF-5 (S-20..S-24) · Done: ídem
- [ ] T-D10 · Atributos accesibles y diálogos: `title`, `aria-label`, `placeholder`, `alt`, `confirm()`/`alert()` de todos los archivos con `tText` · todos los de `frontend/js` · cubre RF-5 (S-26) · Done: `i18n_audit.py frontend` en 0 (salvo `i18n_allow.txt`)
- [ ] T-D11 · Diccionario `frontend/i18n/es.json` completo (las claves extraídas) y revisión de claves duplicadas · cubre RF-1, RF-5 · Done: `i18n_audit.py parity` sin claves usadas y ausentes en `es`
- [ ] T-D12 · Traducción de `frontend/i18n/en.json` y `pt.json` con el glosario del plan §4.9; marcar "versión preliminar" si no hay revisión nativa · cubre RF-1 · Done: `parity` sin diferencias de claves, parámetros ni plurales entre los tres
- [ ] T-D13 · Traducción de `backend/i18n/en.json` y `pt.json` (catálogo con `help`, tablas, configuración, calidad, contexto, exportación, líderes) · cubre RF-10, RF-13, RF-14 · Done: `parity` sin diferencias en los diccionarios del backend
- [ ] T-D14 · Controles de idioma en S9: bloque "Idioma" de usuario y fila de `ui.default_language` (admin) · `views/configuracion.js` · cubre RF-2, RF-3 · Done: cambiar el idioma desde S9 y recargar lo conserva

### Grupo E — Errores, estados vacíos, offline/SW y diseño
- [ ] T-E1 · Reemplazar `err.message` por `tError(err)` en toasts y estados de error de todas las vistas · `frontend/js/**` · cubre RF-15 · Done: `grep "err.message"` sin usos directos en la UI
- [ ] T-E2 · Traducciones de `error.*` (catálogo de plan §3.3 y los códigos de requisitos posteriores) en los tres idiomas · `frontend/i18n/*.json` · cubre RF-15 · Done: cada código del catálogo tiene clave en los tres idiomas
- [ ] T-E3 [P] · `sw.js`: precache de `/js/core/i18n.js` y `/i18n/es.json`; bump de `CACHE` · `frontend/sw.js` · cubre RF-20 · Done: offline, la app abre en español; un idioma ya usado se vuelve a elegir offline
- [ ] T-E4 · Reglas anti-desborde y selector en `/* ── i18n (F-21) ── */` · `frontend/css/style.css` · cubre RF-19 · Done: ver T-F10
- [ ] T-E5 [P] · Documentar en `docs/frontend.md` la convención de claves, `t`/`tText`/`tn`, cómo agregar un texto y un idioma, pseudo-localización y la auditoría · `docs/frontend.md` · cubre RF-21 · Done: la sección existe y un colaborador puede agregar un texto siguiéndola

### Grupo F — Verificación de feature
- [ ] T-F1 · **Antes de extraer:** guardar la línea base del texto visible en español de cada sección y pestaña (con la consola `document.body.innerText` por vista, o con Playwright si está instalado en el entorno de desarrollo; fuera del repo) · cubre CA-12 · Done: archivos de línea base guardados con la lista de rutas recorridas
- [ ] T-F2 · Backend arranca sin traceback (`python backend/app.py`)
- [ ] T-F3 · `python backend/database.py` dos veces sin error (sin cambios de esquema)
- [ ] T-F4 · Cada endpoint tocado probado con curl/`app.test_client()` y `X-Lang: es|en|pt` (`/api/me`, `/api/metrics-catalog`, `/api/settings`, `/api/table/<id>`, `/api/data-quality`, `/api/game-plan`, `/api/insights`, `/api/my-team`, `/api/prepare`, `/api/export/xlsx`, `/api/ai/lineup-suggestions`) y contra el catálogo de errores de plan §3.3
- [ ] T-F5 · Consola del navegador sin errores JS al recorrer S1–S9 en los tres idiomas
- [ ] T-F6 · Recorrer cada CA del spec y marcar ✅ en `progress.md`
- [ ] T-F7 · CA-1 (CA del cliente): recorrer todas las secciones y pestañas habilitadas (lista del inventario §4.1) en `en` y `pt`, escritorio (1280 px) y móvil (360 px), con `?i18n=pseudo` para detectar cadenas sueltas y desbordes y sin él para el aspecto real; registrar capturas o notas por vista
- [ ] T-F8 · CA-2 y CA-3: elegir inglés con un usuario, recargar, cerrar sesión, entrar desde otro navegador, y verificar con otro usuario que no cambia; cambiar `ui.default_language` a `pt` con un administrador y entrar con un usuario sin preferencia
- [ ] T-F9 · CA-4 y CA-5: login en inglés recordado y selector antes de ingresar; cambiar de idioma con filtros aplicados y comprobar que la URL, los filtros y los datos no cambian
- [ ] T-F10 · CA-17 y RF-19: a 360, 768 y 1280 px en portugués, revisar navegación, pestañas, botones, tablas, tarjetas, tooltips y las maquetas A4 y PNG de 1080 px de F-03; corregir desbordes con T-E4
- [ ] T-F11 · CA-6: comparar el catálogo en los tres idiomas (`GET /api/metrics-catalog`) y las tarjetas de métrica: siglas idénticas, descripciones traducidas, etiqueta personalizada de `ui.metric_labels` conservada
- [ ] T-F12 · CA-7: plan de juego (F-17), insights (A-10), alertas (F-12) e informe (F-03) en inglés y portugués; comparar métricas, valores y orden contra español y revisar el formato numérico
- [ ] T-F13 · CA-8: exportar la misma tabla a CSV, XLSX, PNG y PDF en los tres idiomas y comparar cabeceras, portada, columnas y nombre de archivo; los datos numéricos y los nombres son idénticos (comparar CSV con una herramienta de diff)
- [ ] T-F14 · CA-9: provocar `GET /api/team/ZZZ`, `POST /api/import` sin `url`, un 403 con `ADMIN_USERS` y un 400 con parámetros (`clutch?margin=abc`) en inglés y portugués; verificar el mensaje traducido con parámetros y, quitando temporalmente una clave `error.*`, el respaldo en español
- [ ] T-F15 · CA-10 y CA-11: quitar una clave de `en.json`, verificar que se muestra el español y que `i18n_audit.py parity` la reporta; ejecutar las tres pasadas de `i18n_audit.py` sobre el código final y registrar el resultado (0 hallazgos salvo `i18n_allow.txt`)
- [ ] T-F16 · CA-12: comparar el texto en español contra la línea base de T-F1 (diff por vista); toda diferencia se justifica o se corrige
- [ ] T-F17 · CA-13: números y fechas en los tres idiomas en tablas, tarjetas, tooltips y gráficos (ejes y tooltips de Chart.js)
- [ ] T-F18 · CA-14: con un idioma ya cargado, cortar la red y volver a elegirlo; con uno no cargado y sin red, verificar el aviso y que se mantiene el actual
- [ ] T-F19 · CA-15 (solo con la función de IA habilitada): generar una sugerencia en inglés con el servicio simulado de F-15 y comprobar idioma, formato y validación
- [ ] T-F20 · CA-16 y CA-18: confirmar que nombres de equipos/jugadores/competencias y notas no se alteran, y que `<title>` y `<html lang>` siguen el idioma
- [ ] T-F21 · Revisión nativa de `en`/`pt` por un hablante del dominio (gate de calidad, spec §9); registrar quién y cuándo en `progress.md`

## Matriz de cobertura (CA → tareas)
| CA | Tareas |
|---|---|
| CA-1 | T-C1, T-C5, T-C6, T-D1…T-D13, T-E4, T-F7 |
| CA-2 | T-C5, T-C6, T-D14, T-F8 |
| CA-3 | T-A1, T-A2, T-A5, T-D14, T-F8 |
| CA-4 | T-A5, T-C5, T-C6, T-F9 |
| CA-5 | T-C1, T-C6, T-F9 |
| CA-6 | T-B5, T-C4, T-D13, T-F11 |
| CA-7 | T-B11, T-B14, T-A3, T-F12 |
| CA-8 | T-B7, T-B8, T-D5, T-F13 |
| CA-9 | T-A4, T-B1…T-B4, T-C2, T-E1, T-E2, T-F14 |
| CA-10 | T-A7, T-C1, T-F15 |
| CA-11 | T-A7, T-D10, T-D11, T-D12, T-D13, T-B14, T-F15 |
| CA-12 | T-F1, T-D1…T-D10, T-F16 |
| CA-13 | T-A3, T-C3, T-C7, T-F17 |
| CA-14 | T-C1, T-E3, T-F18 |
| CA-15 | T-B13, T-F19 |
| CA-16 | T-D1…T-D9, T-F20 |
| CA-17 | T-E4, T-F10 |
| CA-18 | T-C1, T-D1, T-F20 |

## Dependencias externas
- **Todas las fases 1–5 cerradas** (o al menos con su UI estable): F-21 es el último requisito; el inventario del plan §4.1 se verifica contra el código final con `i18n_audit.py`. Si algún requisito no se implementó, su fila queda fuera con nota en `progress.md`.
- **F-13** (`core/prefs.js`, `user_prefs`, `ui.default_language`), **X-01** (router, runtime caching), **T-05/T-06** (catálogo con `lang`, tablas y exportación), **F-17/A-10** (`phrases.py`, `es.json`), **F-15** (`llm.py`) deben existir antes de los grupos B y C.
- **Dataset de verificación**: los 13 partidos del seed reprocesados; dos usuarios en `AUTH_USERS` (uno en `ADMIN_USERS`); datos que activen cada superficie (partido con prórroga, competencia con calendario, equipo con pbp para quintetos, función de IA habilitada o simulada).
- **Herramientas**: navegador de escritorio y emulación de 360 px; Playwright opcional (ya figura en `backend/requirements.txt`) para las líneas base; ninguna dependencia nueva.
- **Revisión humana de las traducciones** (hablante nativo del dominio del básquet) para `en` y `pt`; sin ella el requisito cumple lo mecánico pero queda "versión preliminar".
- Ninguna variable de entorno nueva.
