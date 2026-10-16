# Spec — F-21: Multi-idioma

> **ID:** F-21 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 14 (último requisito de v2)
> **Depende de:** X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md)) · A-10 ([../10-A-10-insights-automaticos/](../10-A-10-insights-automaticos/spec.md)) · T-06 ([../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/](../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/spec.md))
> **Habilita:** — (completa el incremento diferido de F-13 "Idioma" y el de F-15 "salida en inglés y portugués")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4.2 · F-21 y §1.1 "Idioma" · §1.3 S9 "Preferencias" ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.15, §3.20, §4 (`i18n.py`), §7.4, §7.8, §8 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md)) · Decisión humana DA-21 ([../../00-decisiones.md](../../00-decisiones.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-21):**
- "Interfaz en español, inglés y portugués, con selector persistente por usuario."
- "Extraer todos los textos a archivos de traducción; no debe quedar texto fijo en los componentes."
- "Incluye las plantillas de frases de A-10 y F-17, y las cabeceras de los archivos exportados de T-06."
- "Los nombres de métricas se mantienen en su forma estándar internacional (eFG%, TS%, OER) en los tres idiomas; solo se traducen las descripciones."
- "Relevante para abrir la herramienta a otros mercados de la región."
- Criterio: "Cambiar de idioma traduce toda la interfaz sin dejar cadenas sin traducir ni romper el diseño."
Y §1.1: componente transversal "Idioma — Interfaz en español, inglés y portugués — F-21"; §1.3 S9 Preferencias: "Base de normalización, competencia por defecto, etiquetas de métricas e idioma".

**Por qué:** abrir Smart-Basket a otros mercados de la región (inglés y portugués) sin duplicar la app. Es el último requisito de v2 porque tiene que traducir todo lo que dejan las fases 1 a 5: su verdadero alcance es el inventario completo de textos, no solo el selector.

**Decisión humana que condiciona esta spec (DA-21, 2026-09-26, `00-decisiones.md`):** **no** se preparó i18n en la fase 1: sin `t()` ni `core/i18n.js` obligatorios en fase 1, el copy se escribió en español directo y **se extrae en F-21**. (La Arquitectura §3.20 había propuesto preparar `t()` desde la fase 1; la decisión humana prevalece.) Consecuencia: al llegar a F-21, el código tiene cadenas fijas en español en frontend y backend; algunos planes de fases 1–5 pueden haber usado igualmente `t('clave', 'Texto')` (los planes de F-13, T-06, X-01, F-03 y otros lo citan), de modo que F-21 debe aceptar **ambos** estados: cadenas fijas y llamadas `t()` ya presentes.

**Qué existe HOY (verificado en el árbol de trabajo, rama `v2`):**
- No hay infraestructura de idiomas: no existe `frontend/js/core/i18n.js` ni `frontend/i18n/`, ni `backend/i18n.py`; `index.html` declara `<html lang="es">` y el título "Smart-Basket — Basketball Analytics"; `manifest.json` mezcla inglés ("Advanced basketball statistics dashboard") y marca.
- El texto está embebido en el código: `frontend/js/app.js` (2315 líneas) tiene al menos 128 líneas con vocales acentuadas o "ñ" (un piso: no cuenta cadenas sin acentos) y mezcla plantillas HTML, `toast(...)` (26 llamadas), tablas, leyendas y mensajes; `NAV_ITEMS` fija las etiquetas del menú; `charts.js` tiene rótulos de ejes, series y tooltips ("Ataque", "Defensa", "Promedio liga", …) y fija `Chart.defaults.locale = "es-UY"`; `core/format.js` fija `Intl.NumberFormat("es-UY")` y `NULL_REASON_LABELS` en español; `_fmtDate` arma `dd/mm/aaaa` a mano.
- El backend devuelve mensajes de error en español como texto libre: 33 respuestas `jsonify({"error": …})` en `backend/app.py`, 3 en `backend/auth.py`, 12 mensajes de `CompetitionError` en `backend/competitions.py`, errores de `fiba_fetcher.py` (17 `raise …` en español que la ruta de importación devuelve con `str(e)`), y etiquetas de campos en `backend/data_quality.py` (`NULL_FIELDS`). Los errores no llevan `code` (el formato `{error, code, details}` de Arq. §7.8 es nuevo y se adopta por fases).
- `frontend/js/api.js:apiFetch` convierte el error en `new Error(err.error)` y descarta cualquier `code`/`details`; no envía ningún encabezado de idioma.
- Preferencias por usuario: la tabla `user_prefs` y el scope `ui · language` los define F-13 (Arq. §3.3); la clave `ui.default_language` de configuración está reservada para F-21 (Arq. §3.2). F-13 dejó como incremento diferido el control de "Idioma" de S9 (→ F-21).
- Los archivos estáticos se sirven desde `frontend/` en la raíz (`Flask(..., static_folder="../frontend", static_url_path="/")`), de modo que `frontend/i18n/es.json` sería accesible en `/i18n/es.json`.

**Qué resuelven requisitos anteriores (supuestos de esta spec):** X-01 deja la navegación con registro de secciones/pestañas (etiquetas en el código de cada vista), el router con re-render y el service worker con runtime caching. F-13 deja `core/prefs.js` (`getPref`/`setPref`/`loadPrefs`), `config.get` y la vista de configuración generada desde `spec_json()` (etiquetas y ayudas en español dentro de `CONFIG_SPEC`). T-05 deja el catálogo de métricas con etiquetas en español y `catalog_json(lang)` con parámetro de idioma ya previsto. T-06 deja las tablas con columnas rotuladas por el backend, las cabeceras de exportación y los metadatos (§7.7). F-17 deja `backend/phrases.py` con `load_templates(lang)` y `backend/phrases/es.json`; A-10 agrega plantillas; F-12 y F-03 agregan las suyas. F-15 deja `llm._lang()` fijo en `"es"`.

**Qué queda (esta spec):** crear la infraestructura de idiomas, **inventariar y extraer todas las superficies de texto** que dejan las fases 1–5, traducir al inglés y al portugués, resolver cómo viajan al frontend los mensajes del backend (códigos + traducción), traducir las plantillas de frases y las cabeceras de exportación, formatear números y fechas por idioma, ofrecer el selector persistente y verificar que no queden cadenas sueltas ni diseños rotos.

## 1. Objetivo

Que toda la interfaz de Smart-Basket, incluidos los textos que genera el backend (frases, exportaciones, errores, etiquetas de tablas y configuración), se pueda ver en español, inglés o portugués, con el idioma elegido por cada usuario y recordado entre sesiones y dispositivos, sin cadenas fijas en los componentes y sin traducir los nombres internacionales de las métricas.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4.2 F-21 (literal arriba), §1.1 (capa transversal "Idioma"), §1.3 S9, §4 F-17 ("Las frases salen de plantillas fijas"), §5 A-10 (plantillas de texto), §3 T-06 (cabeceras y metadatos de exportación), §6 glosario (siglas).
- `docs/frontend.md` (estructura y copy de la UI), `docs/api.md` (mensajes de error), `docs/architecture.md`.
- Arquitectura §3.15 (plantillas por idioma: `phrases/es.json`, F-21 agrega `en.json`, `pt.json`), §3.20 (estrategia i18n: `t()`, `frontend/i18n/{es,en,pt}.json`, selector en `user_prefs`, `backend/i18n.py`; etiquetas de métricas del catálogo; formato numérico), §3.5 (`catalog_json(lang)`), §3.3 (scope `ui · language`), §3.2 (`ui.default_language`), §4 (`i18n.py`: `t(key, lang="es", **params)`), §7.4 (códigos de razón con etiqueta en el frontend), §7.7 (metadatos de exportación), §7.8 (formato de error con `code` y `details`), §8 (`core/i18n.js`).
- Decisión humana DA-21 (`00-decisiones.md`).
- Specs previas: `../../fase-1-confiabilidad/12-F-13-configuracion/` (incremento "Idioma"), `../../fase-1-confiabilidad/16-T-06-tablas-completas-exportacion/` (exportación), `../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/`, `../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/`, `../10-A-10-insights-automaticos/`, `../13-F-15-sugerencias-quinteto-ia/` (incremento "salida en inglés y portugués").

## 3. Historias de usuario

- US-1: Como entrenador o analista de un mercado angloparlante o lusófono, quiero usar la app en mi idioma, para entender cada pantalla sin saber español.
- US-2: Como usuario, quiero elegir el idioma una vez y que la app lo recuerde (también en otro dispositivo), para no tener que cambiarlo cada vez.
- US-3: Como usuario, quiero que las frases automáticas, los insights, los informes y los archivos exportados salgan en mi idioma, para compartirlos sin retraducir.
- US-4: Como analista, quiero que las siglas de las métricas (eFG%, TS%, OER…) no cambien de un idioma a otro, para reconocerlas y compararlas con otras herramientas.
- US-5: Como administrador, quiero definir el idioma por defecto de los usuarios nuevos, para que la herramienta arranque en el idioma del mercado.
- US-6: Como equipo de desarrollo, quiero una forma verificable de comprobar que no quedaron cadenas sin traducir ni claves faltantes, para dar por cerrado el requisito sin revisar pantalla por pantalla a ojo.

## 4. Requisitos funcionales

**Idioma y selector**
- RF-1: El sistema DEBE ofrecer la interfaz en español, inglés y portugués. · (US-1) (Esp. v2 §F-21 "Interfaz en español, inglés y portugués")
- RF-2: El sistema DEBE ofrecer un selector de idioma persistente por usuario (preferencia `ui · language`, Arq. §3.3), recordado entre sesiones y dispositivos, con copia local para el arranque; el selector DEBE estar siempre accesible en la cabecera de la app y también como control "Idioma" en S9 · Configuración · Preferencias (completa el incremento diferido de F-13). · (US-2) (Esp. v2 §F-21 "selector persistente por usuario"; §1.3 S9)
- RF-3: El idioma efectivo DEBE resolverse en este orden: preferencia del usuario → idioma por defecto global `ui.default_language` (configuración de F-13; default `es`) → español. La pantalla de inicio de sesión DEBE usar el idioma recordado en el dispositivo o, si no hay, el global, y ofrecer el selector. · (US-2, US-5) (Arq. §3.2, §3.3)
- RF-4: Cambiar de idioma DEBE traducir toda la interfaz visible sin recargar la página y sin perder la ruta, el contexto (filtros) ni el estado de la vista; los textos que provienen del backend DEBEN volver a pedirse en el idioma nuevo. · (US-1, US-2) (Esp. v2 §F-21 CA)

**Cobertura de textos**
- RF-5: Todo texto visible o accesible de la interfaz DEBE salir de archivos de traducción; NO DEBE quedar texto fijo en los componentes. Incluye: etiquetas del menú y de las pestañas, títulos, botones, encabezados de columnas y de tablas, placeholders, textos de ayuda y tooltips (`title`), `aria-label`, mensajes de estado (vacío, cargando, error, sin conexión, éxito), toasts, diálogos de confirmación, leyendas y rótulos de gráficos y de mapas de tiro, textos de impresión y de las maquetas de exportación, el título de la página y el atributo `lang` del documento. · (US-1) (Esp. v2 §F-21 "no debe quedar texto fijo en los componentes")
- RF-6: Las etiquetas de valores codificados (códigos de razón de nulo, niveles de muestra, estados de calidad de datos, orígenes y tipos de posesión, desenlaces, tramos de reloj, valores de los filtros de contexto, categorías de líderes) DEBEN traducirse por código, nunca por el texto en español. · (US-1) (Arq. §7.4)
- RF-7: Si falta una traducción en un idioma, el sistema DEBE mostrar el texto en español (nunca la clave cruda ni un campo vacío), y DEBE existir un modo de diagnóstico que haga visibles las cadenas que no pasaron por traducción. · (US-6)
- RF-8: Los textos con cantidades o valores DEBEN admitir parámetros y plurales por idioma (por ejemplo "1 partido eliminado" / "2 partidos eliminados"). · (US-1)
- RF-9: Los textos que no son de la interfaz sino datos (nombres de equipos, jugadores, competencias, notas del calendario, etiquetas personalizadas del usuario) NO DEBEN traducirse. · (US-1)

**Métricas**
- RF-10: Los nombres de métricas en su forma estándar internacional (eFG%, TS%, OER, DER, Net Rating, PPT, PPP, PACE, USO%, OR%, DR%, TO%, FT Rate, y las demás siglas del glosario v2 §6) NO DEBEN cambiar entre idiomas; SÍ DEBEN traducirse sus descripciones y ayudas. Las etiquetas que son palabras comunes o abreviaturas de origen español (por ejemplo "Partidos", "Minutos", "Robos", "PER", "RO") DEBEN tener equivalente por idioma. · (US-4) (Esp. v2 §F-21 "Los nombres de métricas se mantienen en su forma estándar internacional")
- RF-11: La etiqueta personalizada de una métrica definida en Configuración (`ui.metric_labels`, F-13) DEBE tener prioridad sobre cualquier traducción. · (US-4) (Arq. §3.2)

**Textos del backend**
- RF-12: El sistema DEBE traducir las plantillas de frases de F-17, A-10, F-12 (cambios bruscos) y F-03 (modo emparejamiento): mismos identificadores de plantilla, mismos marcadores y mismas reglas de disparo en los tres idiomas; las cifras de las frases DEBEN salir con el formato numérico del idioma. · (US-3) (Esp. v2 §F-21 "plantillas de frases de A-10 y F-17"; Arq. §3.15)
- RF-13: El sistema DEBE traducir las cabeceras y metadatos de los archivos exportados de T-06 (CSV, XLSX, PNG, PDF e informe de F-03): etiquetas de la portada ("Entidad", "Competencia", "Filtros", "Base", "Orden", "Generado por"…), encabezados de columnas y nombre del archivo; los **datos** exportados (números, nombres) NO DEBEN cambiar con el idioma. · (US-3) (Esp. v2 §F-21 "cabeceras de los archivos exportados de T-06"; Arq. §7.7)
- RF-14: Las etiquetas generadas por el backend para la UI (columnas de tablas, secciones y ayudas de Configuración, nombres de chequeos de calidad de datos, etiqueta del contexto "Últimos 5 · Local", criterio de población de las fichas) DEBEN salir en el idioma del usuario. · (US-1)
- RF-15: Los mensajes de error que hoy vienen en español desde el backend DEBEN pasar a viajar como código estable más parámetros (formato `{error, code, details}` de Arq. §7.8) y traducirse en el frontend; si un código no tiene traducción, la UI DEBE mostrar el mensaje en español del servidor. · (US-1) (Esp. v2 §F-21; Arq. §7.8)
- RF-16: El frontend DEBE informar su idioma al backend en cada petición, y las cachés del servidor que contienen texto generado DEBEN distinguir el idioma. · (US-3)
- RF-17: La salida de las sugerencias de IA de F-15 DEBE generarse en el idioma del usuario (completa el incremento diferido de F-15), con la misma validación de cifras. · (US-3) (Esp. v2 §F-15)

**Formato**
- RF-18: Números, porcentajes y fechas DEBEN formatearse según el idioma elegido (decimal con coma en español y portugués, con punto en inglés; fechas en el orden y separadores del idioma), desde los únicos puntos de formateo existentes (`core/format.js` y el formateador del backend de F-15). Los datos numéricos de las exportaciones conservan la convención de T-06. · (US-1) (DA-36)
- RF-19: El diseño NO DEBE romperse con los textos más largos de cualquier idioma: sin desbordes en la barra de navegación, botones, pestañas, tablas, tarjetas, tooltips y maquetas de exportación, en escritorio y en móvil (<768 px). · (US-1) (Esp. v2 §F-21 CA "ni romper el diseño"; Const. 7)

**Operación y verificación**
- RF-20: El diccionario del idioma activo DEBE estar disponible sin conexión después de haberlo cargado una vez. · (US-2) (Const. 7)
- RF-21: El sistema DEBE contar con una verificación mecánica repetible que (a) detecte cadenas en español sin pasar por traducción en el frontend y en el backend, (b) compruebe que los tres diccionarios tienen las mismas claves y los mismos parámetros y marcadores por clave, y (c) compruebe que las plantillas de frases tienen los mismos identificadores y marcadores en los tres idiomas. · (US-6) (Esp. v2 §F-21 CA "sin dejar cadenas sin traducir")
- RF-22: El plan DEBE inventariar todas las superficies de texto que dejan las fases 1–5 y cada una DEBE estar cubierta o justificada como excepción (RF-9). · (US-6) (Arq. §3.20)

## 5. Requisitos de datos / API

| Tabla / endpoint / archivo | Uso | Estado |
|---|---|---|
| `user_prefs` (`ui · language`) | idioma elegido por usuario | existente (F-13), solo se usa |
| `app_config` (`ui.default_language`) | idioma por defecto global | clave existente en la arquitectura (F-13 la reserva), F-21 la activa |
| `frontend/i18n/{es,en,pt}.json` | diccionarios del frontend | **NUEVO** (Arq. §3.13, §3.20) |
| `backend/i18n.py` + diccionarios del backend | textos generados por el backend | **NUEVO** (Arq. §4); ubicación de los diccionarios: PROPUESTA (no está en 00-arquitectura-transversal.md) |
| `backend/phrases/{en,pt}.json` | plantillas de frases traducidas | **NUEVO** (Arq. §3.15) |
| `GET /api/me` | agrega `default_language` para la pantalla de inicio de sesión | existente, tocado (PROPUESTA) |
| `GET /api/metrics-catalog` | `catalog_json(lang)` devuelve etiquetas y descripciones traducidas | existente (T-05), tocado |
| `GET /api/settings` | `spec_json(lang)` devuelve etiquetas y ayudas traducidas | existente (F-13), tocado |
| Endpoints con texto generado (`/api/game-plan`, `/api/insights`, `/api/my-team`, `/api/prepare`, `/api/table/<id>`, `/api/data-quality`, `/api/ai/lineup-suggestions`, `/api/export/xlsx`) | respetan el idioma enviado por el cliente | existentes, tocados |

Sin tablas ni columnas nuevas (Arq. §5). Encabezado HTTP de idioma: PROPUESTA (el nombre y el mecanismo no están en la arquitectura; ver `plan.md` §3). Todos los errores del backend pasan a tener `code` (Arq. §7.8).

## 6. Estados de UI

Vista: cabecera de la app (selector), S9 · Configuración · Preferencias (control "Idioma" y "Idioma por defecto" para administradores) y pantalla de inicio de sesión. Copy nuevo (agregar a `docs/frontend.md`; los textos de las demás vistas ya existen y se extraen sin cambiar su redacción en español).

| Elemento | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Selector de idioma | "Cargando idioma…" (breve; se conserva el idioma actual hasta tener el diccionario) | — | "No se pudo cambiar el idioma. Se mantiene {idioma}." (toast) | idioma ya cargado: cambia; no cargado: "Sin conexión: ese idioma todavía no está disponible sin conexión." y se mantiene el actual | la interfaz completa cambia; el selector muestra el idioma activo |
| Preferencia guardada | — | — | "No se pudo guardar tu idioma. Se usará solo en este dispositivo." (toast) | se guarda local y se sincroniza al volver la conexión | persiste tras recargar |
| Idioma por defecto (admin) | — | — | mensaje del servidor traducido | "Sin conexión: la configuración no está disponible." | "Guardado" |
| Modo diagnóstico (solo QA) | — | — | — | — | las cadenas traducidas se marcan con corchetes y las que no pasaron por traducción quedan sin marca |

Nombres de idioma (siempre en su propio idioma, nuevo copy): "Español", "English", "Português". Mobile (<768 px): el selector en la cabecera se reduce a un ícono con el código del idioma (ES / EN / PT) y abre una lista; en la hoja "Más" de la navegación inferior también está accesible.

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given cualquier usuario, When cambia el idioma a inglés o a portugués y recorre todas las secciones y pestañas habilitadas (S1–S9) en escritorio y en 360 px, Then toda la interfaz queda en ese idioma, sin cadenas en otro idioma ni claves crudas, y sin desbordes, solapamientos ni cortes de diseño.
- CA-2: Given un usuario que elige inglés, When recarga la página, cierra sesión y vuelve a entrar, o entra desde otro navegador con la misma cuenta, Then la app abre en inglés; Given otro usuario con otra preferencia, Then no se ve afectado.
- CA-3: Given un usuario sin preferencia, When abre la app, Then usa `ui.default_language`; Given un administrador que cambia `ui.default_language` a portugués, When entra un usuario sin preferencia, Then ve portugués; y Given que ese usuario ya tiene preferencia, Then se respeta la suya.
- CA-4: Given la pantalla de inicio de sesión, When se abre en un dispositivo donde antes se eligió inglés, Then se ve en inglés y el selector permite cambiarlo antes de ingresar.
- CA-5: Given una vista con datos y filtros aplicados (competencia, últimos 5, sede), When cambio el idioma, Then la ruta, los filtros y los datos siguen iguales y solo cambian los textos y formatos.
- CA-6: Given las siglas del conjunto estándar (eFG%, TS%, OER, DER, Net Rating, PPT, PPP, PACE, USO%, OR%, DR%, TO%, FT Rate), When cambio de idioma, Then se ven idénticas en los tres idiomas, y sus descripciones (ayuda/tooltip) están traducidas; las etiquetas de palabras comunes tienen su equivalente; una etiqueta personalizada de `ui.metric_labels` se mantiene igual en los tres.
- CA-7: Given un plan de juego (F-17), los insights (A-10), las alertas de Mi equipo (F-12) y un informe de Preparar (F-03), When el idioma es inglés o portugués, Then todas las frases salen en ese idioma con las mismas métricas, valores y orden que en español, y las cifras con el formato del idioma.
- CA-8: Given una exportación CSV, XLSX, PNG y PDF de la misma tabla en español, inglés y portugués, When las comparo, Then las cabeceras, la portada de metadatos, los encabezados de columnas y el nombre del archivo están en el idioma elegido y los datos (valores numéricos y nombres) son idénticos en los tres.
- CA-9: Given un error del backend (por ejemplo `GET /api/team/ZZZ` → 404, `POST /api/import` sin `url`, un 403 `requiere_admin`, un 400 de parámetro inválido con parámetros), When se muestra en inglés o portugués, Then el mensaje está traducido con sus parámetros interpolados; Given un código sin traducción, Then se muestra el mensaje en español del servidor.
- CA-10: Given una cadena de interfaz que falta en `en.json` o `pt.json`, When se muestra, Then aparece su texto en español (nunca la clave) y la verificación mecánica la reporta.
- CA-11: Given la verificación mecánica de cadenas (RF-21), When se ejecuta sobre el código final, Then reporta 0 cadenas sueltas (salvo excepciones documentadas), los tres diccionarios tienen las mismas claves, parámetros y marcadores, y las plantillas de frases tienen los mismos identificadores y marcadores en los tres idiomas.
- CA-12: Given las pantallas de la app en español antes y después de la extracción, When comparo su texto, Then es idéntico (la extracción no cambia el español).
- CA-13: Given números y fechas, When el idioma es inglés, Then se ven con punto decimal y fecha en formato inglés; en español y portugués, con coma decimal y fecha en formato local; los gráficos (ejes y tooltips) siguen el mismo formato.
- CA-14: Given un idioma ya cargado, When corto la conexión y lo vuelvo a elegir, Then cambia sin error; Given un idioma nunca cargado y sin conexión, Then se ve el aviso y se mantiene el idioma actual.
- CA-15: Given una sugerencia de IA (F-15) pedida con el idioma en inglés (si la función está habilitada), When se genera, Then el texto sale en inglés, con las cifras formateadas con punto decimal y pasando la misma validación contra el resumen.
- CA-16: Given nombres de equipos, jugadores, competencias y notas de calendario, When cambio de idioma, Then no se traducen ni se alteran.
- CA-17: Given la maqueta de exportación de F-03 (A4 y PNG de 1080 px) y las tablas con columnas fijas, When el idioma es portugués (el de textos más largos), Then no hay texto cortado ni desbordado.
- CA-18: Given el título de la página y el atributo `lang` del documento, When cambio de idioma, Then se actualizan al idioma activo.

## 8. Fuera de alcance

- Traducir `docs/` y los documentos SDD: siguen en español.
- Más idiomas que los tres pedidos, o idiomas de derecha a izquierda.
- Localización de contenido que no es texto de la app: nombres de FIBA (equipos, jugadores, competencias), datos de los partidos, notas cargadas por usuarios.
- Traducción automática en tiempo de ejecución (con IA o con servicios externos): los diccionarios son archivos revisados.
- Detección automática del idioma del navegador (ver §9).
- Variantes regionales del portugués o del inglés más allá de la elegida en §9.
- Cambiar la convención numérica de los **datos** exportados de T-06 (CSV con `;` y coma, XLSX con números nativos) según el idioma.
- Traducir `manifest.json` (nombre y descripción de la PWA): un manifiesto único por origen; se normaliza su redacción pero no se traduce por usuario.
- Revisión lingüística profesional de los textos en inglés y portugués: la traducción inicial la hace el equipo de desarrollo y requiere revisión de un hablante nativo del dominio del básquet antes de publicarse (gate de calidad, no de esta spec).

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] **Extracción en F-21 por DA-21.** Como la decisión humana evitó preparar `t()` en la fase 1, F-21 hace la extracción completa; los planes anteriores que ya usan `t('clave', 'Texto')` se aceptan tal cual (se les asigna diccionario) y el resto se extrae con claves `seccion.componente.texto`. Riesgo: es el requisito de mayor volumen de v2 (≈ miles de cadenas); por eso se estima XL y se parte en etapas (ver `plan.md`).
- [DECISIÓN PROPUESTA — confirmar] **Qué significa "forma estándar internacional".** Se mantienen sin traducir las siglas que son de uso internacional o del glosario v2 (eFG%, TS%, OER, DER, Net Rating, PPT, PPP, PACE, USO%, OR%, DR%, TO%, FT Rate, PtsEnPint). Las etiquetas que son palabras comunes en español ("Partidos", "Minutos", "Robos", "Tapones", "Faltas") y las abreviaturas de origen español ("PER", "RO", "RD", "T2i", "TLi") se traducen por idioma, porque en inglés "PER" significa otra cosa (Player Efficiency Rating) y dejarlas sin traducir confundiría. Confirmar con el cliente la lista exacta (la lista de siglas fijas queda en un solo lugar del catálogo).
- [DECISIÓN PROPUESTA — confirmar] **Formato numérico por idioma.** DA-36 fijó es-UY (coma decimal) "en toda la UI" pensando en el español. En inglés una coma decimal se leería mal, así que el formato sigue al idioma: español `es-UY`, inglés `en-US`, portugués `pt-BR`. Los datos exportados conservan la convención de T-06.
- [DECISIÓN PROPUESTA — confirmar] **Variantes.** Portugués de Brasil (`pt-BR`, el mercado mayor de la región) e inglés neutro (`en-US` para formatos). Español rioplatense como hoy ("Reimportá sus partidos"); en inglés y portugués se usa un registro neutro.
- [DECISIÓN PROPUESTA — confirmar] **Sin detección automática del idioma del navegador:** el valor por defecto lo decide el administrador (`ui.default_language`) y cada usuario lo cambia con el selector; con un default siempre definido, la detección nunca llegaría a usarse.
- [DECISIÓN PROPUESTA — confirmar] **Cómo viajan los errores:** código estable + parámetros (`details`) y traducción en el frontend; el mensaje en español del servidor queda como respaldo. Para los errores de FIBA que hoy se devuelven con `str(e)`, se agregan códigos (`fiba_url_invalida`, `fiba_esquema_cambiado`, `fiba_no_disponible`, …) manteniendo el texto en español como respaldo.
- [DECISIÓN PROPUESTA — confirmar] **Nombre de archivo exportado traducido:** la parte "apartado" del nombre (`quintetos`, `tabla-general`…) sale en el idioma elegido (`lineups`, `standings`), con el mismo formato `<apartado>_<entidad>_<competencia>_<fecha>` de T-06.
- [DECISIÓN PROPUESTA — confirmar] **Modo de pseudo-localización para QA:** un idioma de prueba que no aparece en el selector (activado con un parámetro de URL) que envuelve cada cadena traducida en marcas y la alarga ~30 %, para detectar a ojo cadenas sueltas y desbordes de diseño (RF-19, RF-21).
- [NEEDS CLARIFICATION] Quién revisa la calidad de las traducciones al inglés y al portugués: el equipo de desarrollo produce una primera versión, pero los textos accionables de las frases de F-17/A-10 (consejos tácticos de básquet) y la terminología deportiva requieren un revisor nativo. Sin esa revisión el requisito puede cumplir el criterio mecánico pero no el de calidad percibida.
