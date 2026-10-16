# Spec — F-15: Sugerencias de quinteto asistidas por IA

> **ID:** F-15 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 13
> **Depende de:** F-06 ([../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/](../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/spec.md)) · F-03 ([../../fase-4-dia-de-partido/02-F-03-preparar-partido/](../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md)) · A-08 ([../08-A-08-sinergias-jugadores/](../08-A-08-sinergias-jugadores/spec.md)) · T-02 ([../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/](../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/spec.md))
> **Habilita:** — (la salida en inglés y portugués queda como incremento diferido → F-21, [../14-F-21-multi-idioma/](../14-F-21-multi-idioma/spec.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-15 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.7, §3.10, §3.16, §4 (`llm.py`), §6 (`POST /api/ai/lineup-suggestions`), §7, §11 DA-24, §12 R-13 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-15):** "Capa de lectura sobre la sección de quintetos: convierte la tabla en recomendaciones accionables. Se apoya en un modelo de lenguaje, pero el modelo no calcula nada."
- **Arquitectura obligatoria:** "Todos los números se calculan en el backend con las reglas de este documento. El modelo recibe un resumen ya calculado (quintetos, métricas, percentiles, muestra) y solo redacta la lectura." · "El modelo no accede a datos crudos ni realiza operaciones aritméticas. Cualquier cifra que aparezca en el texto debe existir previamente en el resumen enviado." · "Solo se envían al modelo quintetos que superan el umbral de muestra de T-02." · "Cada sugerencia se muestra junto a los datos que la sustentan, para que el entrenador pueda verificarla en la misma pantalla." · "Etiquetado explícito de que se trata de una sugerencia generada automáticamente." · "La sugerencia se genera bajo demanda, no en cada carga de pantalla, por coste y por latencia."
- **Tipos:** quinteto recomendado según el objetivo (anotar, defender, reboteear, frenar el ritmo o cerrar el partido) · recomendado contra un rival concreto (cruzando con los emparejamientos de F-03) · infrautilizados ("buen rendimiento ajustado y pocos minutos") · a evitar ("rendimiento bajo sostenido con muestra suficiente") · cambios de una pieza (qué jugador entra o sale y cómo cambia su perfil, apoyado en las sinergias de A-08) · lectura de cierres (qué quinteto sostiene mejor los finales ajustados según el récord clutch y el diferencial del tramo).
- **Límites escritos en la interfaz:** "La sugerencia describe lo que ya ocurrió, no predice lo que va a ocurrir." · "No sustituye el criterio del entrenador ni contempla lesiones, faltas, estado físico ni decisiones tácticas." · "Si ningún quinteto supera el umbral de muestra, la app lo dice y no genera sugerencia. Es preferible no responder que responder sobre veinte posesiones."
- **Criterio de aceptación:** "ninguna cifra del texto generado difiere de la que muestra la tabla, y desactivar la función deja el resto de la sección intacta."

**Por qué:** la tabla completa de quintetos (F-06) tiene cientos de filas; el entrenador quiere una lectura que le diga por dónde mirar. Pero un texto generado por un modelo puede inventar números, y en una herramienta de decisión deportiva un número inventado destruye la confianza que la Fase 1 construyó. Por eso el cliente impone que el modelo solo redacte y que cada cifra se pueda verificar.

**Qué existe HOY (verificado):**
- No hay ninguna integración con un modelo de lenguaje: `backend/requirements.txt` solo tiene `flask`, `flask-cors`, `flask-sqlalchemy`, `playwright` y `gunicorn` (no hay paquete `anthropic`); `backend/` no tiene `llm.py`; `/api/me` (`backend/app.py:me`) devuelve `authenticated`, `user`, `auth_required`, `seed_enabled` e `is_admin`, sin ningún indicador de IA.
- `docs/deployment.md` documenta las variables de entorno (`DB_PATH`, `SECRET_KEY`, `SESSION_SECURE`, `AUTH_USERS`, `ADMIN_USERS`, `SEED_ENABLED`); no hay claves de servicios externos. `render.yaml` arranca `gunicorn app:app --timeout 180` (1 worker síncrono por defecto; Arquitectura §3.14, DA-28).
- Hay un precedente de dependencia opcional con import protegido: `backend/fiba_fetcher.py` importa `playwright` dentro de un `try` y degrada si no está.
- La sección de quintetos actual es el bloque "Combinaciones (Lineups)" de `app.js` (`renderTeamLineup`, un quinteto elegido por vez, sin tabla completa ni ajuste de muestra); la tabla completa, el ajuste por regresión, el badge y los cierres por quinteto los entregan F-06, T-02 y C-06 (todavía no están en el árbol).

**Qué resuelven requisitos anteriores (supuestos de esta spec):** T-02 entrega `sample.sample_level`, `sample.adjusted`, `sample.band`, `sample.is_ranked` y los umbrales `sample.lineup.*`/`sample.clutch_lineup.*`. F-06 entrega `lineups.all_lineups`, `lineups.lineup_clutch`, la tabla `team_lineups` y la pestaña `quintetos` de S3. F-03 entrega `matchups.team_matchups` (emparejamientos de quintetos contra un rival, vía F-07). A-08 entrega `synergy.teammate_impact` y `synergy.pair_table`. F-13 entrega la configuración (`ai.suggestions_enabled` queda reservada para F-15). X-01 entrega `collapsible.js` y las pestañas.

**Qué queda (esta spec):** el módulo de IA (`llm.py`) con resumen precalculado, llamada controlada, validación de cifras y descarte; el endpoint `POST /api/ai/lineup-suggestions`; el panel de la pestaña Quintetos con límites escritos, etiqueta y datos de soporte; la bandera para apagar la función sin afectar el resto; y el manejo de errores, costo y privacidad.

## 1. Objetivo

Agregar a la sección de quintetos un panel opcional, generado solo cuando el usuario lo pide, que redacta recomendaciones de quintetos a partir de un resumen calculado en el backend, valida automáticamente que cada cifra del texto exista en ese resumen, y muestra cada sugerencia junto a los datos que la sustentan, con etiqueta de contenido automático y los límites de la herramienta a la vista.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4 F-15 (completo, literal arriba); §3 T-02 (umbrales y regresión); §4 F-06 (quintetos y cierres); §4 F-03 (emparejamientos); §5 A-08 (sinergias); §3 C-11 (nulos); §6 glosario (fórmulas de las métricas citadas).
- `docs/api.md` (no hay endpoint de IA: NUEVO), `docs/deployment.md` (variables de entorno), `docs/frontend.md`.
- Arquitectura §3.7 (muestra y regresión), §3.10 (emparejamientos), §3.16 (integración LLM: cliente, variables, llamada, validación, timeouts), §4 (`llm.py`: `llm_available`, `lineup_suggestions`, `validate_numbers`), §6 (`POST /api/ai/lineup-suggestions`, `/api/me` agrega `llm_enabled`), §7.8 (formato de error y códigos `llm_error`, `llm_deshabilitado`, `timeout_externo`), §11 DA-24 y DA-28, §12 R-13.
- Specs previas: `../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/` (tabla de quintetos, cierres), `../../fase-1-confiabilidad/14-T-02-confiabilidad-muestra/` (muestra), `../../fase-4-dia-de-partido/02-F-03-preparar-partido/` y `../../fase-4-dia-de-partido/01-F-07-analizar-partido/` (emparejamientos), `../08-A-08-sinergias-jugadores/` (sinergias).

## 3. Historias de usuario

- US-1: Como entrenador, quiero pedir una lectura de mis quintetos según un objetivo (anotar, defender, reboteear, frenar el ritmo, cerrar), para saber qué combinación priorizar sin recorrer toda la tabla.
- US-2: Como entrenador, quiero una recomendación contra un rival concreto, para elegir quintetos con antecedentes favorables.
- US-3: Como entrenador, quiero ver qué quintetos rinden bien y juegan poco, cuáles conviene evitar, qué cambio de una pieza mejora o empeora un quinteto y quién sostiene los finales ajustados, para ajustar rotaciones.
- US-4: Como entrenador, quiero ver junto a cada sugerencia los datos que la sustentan, para verificarla en la misma pantalla.
- US-5: Como entrenador, quiero saber con claridad que el texto es automático y cuáles son sus límites, para no tomarlo como una predicción ni como una decisión.
- US-6: Como administrador, quiero poder apagar la función (y controlar su costo), para que el resto de la app no dependa de un servicio externo.

## 4. Requisitos funcionales

**Disponibilidad y control**
- RF-1: El sistema DEBE mostrar el panel "Sugerencias asistidas por IA" dentro de la pestaña Quintetos de la sección Equipo, debajo de la tabla de quintetos, plegable y con el estado recordado. · (US-1) (Esp. v2 §F-15 "Capa de lectura sobre la sección de quintetos"; §1.3 S3)
- RF-2: El sistema DEBE generar sugerencias **solo cuando el usuario toca un botón**; abrir la pantalla, cambiar de pestaña o filtrar NO DEBE llamar al modelo ni consumir su cuota. · (US-1) (Esp. v2 §F-15 "bajo demanda")
- RF-3: El sistema DEBE permitir desactivar la función por completo con una bandera de entorno (`LLM_ENABLED`) y con una preferencia de configuración (`ai.suggestions_enabled`, F-13); desactivada, el panel NO DEBE mostrarse, el endpoint DEBE responder 503 `llm_deshabilitado`, y el resto de la sección (tabla, líderes, selector) DEBE funcionar sin cambios. Sin el paquete del servicio o sin la clave, la función DEBE quedar deshabilitada de la misma forma, sin error al arrancar la app. · (US-6) (Esp. v2 §F-15 CA "desactivar la función deja el resto intacto"; Arq. §3.16)

**Arquitectura obligatoria del cliente**
- RF-4: Todos los números DEBEN calcularse en el backend con las reglas del conjunto estándar (T-05), la regresión y la muestra (T-02); el modelo DEBE recibir únicamente un resumen precalculado (filas de quintetos con métricas ya formateadas, percentiles y muestra) y NO DEBE recibir datos crudos (eventos, tiros, partidos) ni realizar operaciones aritméticas. · (US-4) (Esp. v2 §F-15 "Arquitectura obligatoria")
- RF-5: El resumen DEBE incluir únicamente quintetos cuya muestra no sea "baja" (T-02, `is_ranked`); para las lecturas de cierres, únicamente los que alcanzan el nivel "alta" de cierres por quinteto (`sample.clutch_lineup.high_games`). · (US-4) (Esp. v2 §F-15 "Solo se envían … quintetos que superan el umbral de muestra de T-02"; Arq. §3.7)
- RF-6: Toda cifra del texto final DEBE existir en el resumen enviado: el modelo cita valores mediante marcadores y el backend los reemplaza por el valor ya formateado; cualquier otro número en el texto (dígitos fuera de marcadores, o marcadores inexistentes) DEBE hacer que esa sugerencia se descarte y NO se muestre. · (US-4) (Esp. v2 §F-15 "Cualquier cifra … debe existir previamente en el resumen"; CA)
- RF-7: Cada sugerencia DEBE mostrarse junto a los datos que la sustentan (las filas del resumen a las que refiere, con los mismos valores y la misma muestra que la tabla de quintetos) y con un enlace a la fila correspondiente de la tabla. · (US-4) (Esp. v2 §F-15 "Cada sugerencia se muestra junto a los datos que la sustentan")
- RF-8: Cada sugerencia DEBE llevar una etiqueta visible "Generada automáticamente" (y la respuesta DEBE incluir `generated: true`). · (US-5) (Esp. v2 §F-15 "Etiquetado explícito")

**Tipos de sugerencia** (un selector de "qué querés saber"; cada tipo define de forma determinista qué filas entran al resumen)
- RF-9: El sistema DEBE ofrecer el tipo "Objetivo" con cinco objetivos: anotar, defender, reboteear, frenar el ritmo y cerrar el partido; cada objetivo ordena los quintetos elegibles por una métrica fija (ver `plan.md` §4.3). · (US-1) (Esp. v2 §F-15 "Quinteto recomendado según el objetivo elegido")
- RF-10: El sistema DEBE ofrecer el tipo "Contra un rival" (requiere elegir rival) que cruza los quintetos propios con los emparejamientos contra ese rival (F-03/F-07) y recomienda los de mejor resultado con muestra suficiente. · (US-2) (Esp. v2 §F-15 "Quinteto recomendado contra un rival concreto")
- RF-11: El sistema DEBE ofrecer el tipo "Infrautilizados": quintetos con rendimiento ajustado alto (percentil de Net Rating ajustado ≥ `ai.perf_pct`) y pocos minutos (≤ `ai.low_usage_share` % del tiempo del equipo). · (US-3) (Esp. v2 §F-15 "Quintetos infrautilizados")
- RF-12: El sistema DEBE ofrecer el tipo "A evitar": quintetos con muestra "alta" cuyo Net Rating ajustado es negativo incluso en el extremo superior de su banda (valor ajustado + banda < 0). · (US-3) (Esp. v2 §F-15 "Quintetos a evitar … muestra suficiente")
- RF-13: El sistema DEBE ofrecer el tipo "Cambios de una pieza": pares de quintetos elegibles del equipo que difieren en un solo jugador, con el cambio de perfil (diferencia de Net Rating ajustado y de las métricas del resumen) y el impacto de los dos jugadores según las sinergias de A-08. · (US-3) (Esp. v2 §F-15 "Cambios de una pieza … apoyado en las sinergias de A-08")
- RF-14: El sistema DEBE ofrecer el tipo "Lectura de cierres": qué quintetos sostienen mejor los finales ajustados según el récord y el diferencial del tramo de cierre (F-06/C-06). · (US-3) (Esp. v2 §F-15 "Lectura de cierres")

**Límites y vacíos**
- RF-15: El panel DEBE mostrar siempre, en pantalla y sin interacción, los tres límites del cliente (describe lo que ya ocurrió y no predice; no sustituye el criterio del entrenador ni contempla lesiones, faltas, estado físico ni decisiones tácticas; sin quintetos sobre el umbral no se genera sugerencia). · (US-5) (Esp. v2 §F-15 "Límites que deben quedar escritos en la interfaz")
- RF-16: Si ningún quinteto supera el umbral para el tipo pedido, el sistema NO DEBE llamar al modelo y DEBE informarlo en pantalla (mensaje explicativo con el umbral vigente). · (US-5) (Esp. v2 §F-15 "Si ningún quinteto supera el umbral … no genera sugerencia")
- RF-17: Los valores nulos (C-11) NO DEBEN llegar al modelo como 0 ni como texto: las métricas nulas se omiten del resumen y el texto no puede citarlas; en la tabla de soporte se muestran "—". · (US-4) (Esp. v2 §C-11)

**Operación**
- RF-18: El sistema DEBE manejar los fallos del servicio de IA (sin respuesta, tiempo agotado, error, negativa del modelo) devolviendo un error o un resultado vacío explicado, sin romper la pantalla y sin mostrar texto parcial. · (US-6) (Arq. §3.16, §7.8)
- RF-19: El sistema DEBE limitar la cantidad de generaciones por usuario por hora (`ai.max_calls_per_hour`) y DEBE reutilizar el resultado ya generado para la misma consulta y los mismos datos, salvo que el usuario pida "Regenerar". · (US-6) (Esp. v2 §F-15 "por coste y por latencia"; Arq. R-13)
- RF-20: El sistema DEBE enviar al servicio externo solo métricas agregadas y los nombres de los jugadores del quinteto (sin identificadores de usuario, sin eventos ni partidos), y la clave de acceso DEBE vivir solo en una variable de entorno del servidor. · (US-6) (Arq. R-13)
- RF-21: Las cifras del texto y de la tabla de soporte DEBEN tener el mismo formato que la tabla de quintetos (coma decimal es-UY, mismos decimales por métrica). · (US-4) (Esp. v2 §F-15 CA; DA-36)

## 5. Requisitos de datos / API

| Tabla / endpoint | Uso | Estado |
|---|---|---|
| `POST /api/ai/lineup-suggestions` | genera sugerencias bajo demanda | **NUEVO** (Arq. §6) |
| `GET /api/me` | agrega `llm_enabled` (función utilizable: entorno completo y `ai.suggestions_enabled` activa) | existente, tocado (Arq. §6) |
| `GET /api/table/team_lineups`, `GET /api/metrics/lineup` (F-06) | las filas que la tabla muestra; F-15 usa las mismas funciones de backend | existentes (F-06), solo se consumen |
| `GET /api/settings` / `PUT /api/settings` (F-13) | `ai.suggestions_enabled` y las claves de F-15 | existentes, solo se usan |

Sin tablas ni columnas nuevas (Arq. §5). Variables de entorno nuevas (a documentar en `docs/deployment.md`): `LLM_ENABLED` (bandera), `ANTHROPIC_API_KEY` (secreto, solo en el panel de Render), `LLM_MODEL` (default `claude-opus-5`, ver §9), `LLM_TIMEOUT_SECS` (60), `LLM_MAX_RETRIES` (1), `LLM_EFFORT` (opcional). Claves de configuración: `ai.suggestions_enabled` (Arq. §3.2) y, **PROPUESTA (no está en 00-arquitectura-transversal.md)**: `ai.perf_pct`, `ai.low_usage_share`, `ai.top_n`, `ai.max_calls_per_hour`. Dependencia nueva opcional: paquete `anthropic` (justificación en `plan.md` §10).

Errores: `400 parametro_invalido` (objetivo o rival inválido), `404 no_encontrado` (equipo), `429 limite_ia` (PROPUESTA: límite por hora), `502 llm_error` / `timeout_externo`, `503 llm_deshabilitado`. Contrato JSON en `plan.md` §3 y §8.

## 6. Estados de UI

Vista: S3 Equipo · pestaña Quintetos · panel "Sugerencias asistidas por IA" (plegable). Copy nuevo (agregar a `docs/frontend.md`; en español, F-21 lo extrae).

| Elemento | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Panel completo (función apagada) | — | el panel no se dibuja | — | — | — |
| Controles | — | — | — | "Sin conexión: las sugerencias necesitan conexión." (botón deshabilitado) | selector "¿Qué querés saber?" + botón "Generar sugerencias" |
| Generación | "Generando la lectura… puede tardar hasta un minuto." (botón deshabilitado) | "Ningún quinteto supera el umbral de muestra ({n} posesiones) para esta lectura. No se genera sugerencia." | "No se pudo generar la lectura. Probá de nuevo en unos minutos." · "Se alcanzó el límite de {n} generaciones por hora." · "No se pudo generar una lectura verificable. Probá de nuevo." · "El servicio de IA no pudo responder esta consulta." | ídem controles | tarjetas de sugerencia |
| Tarjeta de sugerencia | — | — | — | — | etiqueta "Generada automáticamente" + título + texto + "Datos que la sustentan" (tabla de filas con valores, badge de muestra y enlace a la fila de la tabla) |
| Límites (siempre visibles) | — | — | — | — | "Describe lo que ya ocurrió; no predice lo que va a ocurrir." · "No sustituye el criterio del entrenador: no contempla lesiones, faltas, estado físico ni decisiones tácticas." · "Si ningún quinteto supera el umbral de muestra, no se genera sugerencia." |
| Pie | — | — | — | — | "Generado el {fecha} · {n} quintetos considerados · umbral: {m} posesiones" y botón "Regenerar" |

Opciones del selector (nuevo copy): "Anotar", "Defender", "Reboteear", "Frenar el ritmo", "Cerrar el partido", "Contra un rival…", "Quintetos infrautilizados", "Quintetos a evitar", "Cambios de una pieza", "Lectura de cierres". Con "Contra un rival…" aparece un selector de equipo rival.

Mobile (<768 px): controles apilados, tarjetas en una columna, tabla de soporte con scroll horizontal y primera columna fija; los límites siguen visibles arriba de las tarjetas.

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given una sugerencia generada, When comparo cada cifra de su texto con la tabla de quintetos del equipo (misma competencia y contexto), Then ninguna cifra difiere; y Given la función desactivada (`LLM_ENABLED` apagada o `ai.suggestions_enabled` en falso), When abro la pestaña Quintetos, Then la tabla, las tarjetas de líderes y el selector de combinación funcionan exactamente igual que sin la función.
- CA-2: Given una respuesta del modelo que contiene una cifra inventada (dígitos fuera de marcadores, o un marcador a una fila o clave inexistente), When el backend la valida, Then esa sugerencia se descarta y no aparece; si se descartan todas, la respuesta es vacía con motivo `validacion_fallida`.
- CA-3: Given una sugerencia válida, When la veo, Then lleva la etiqueta "Generada automáticamente" y debajo la tabla "Datos que la sustentan" con los valores de las filas citadas, iguales (texto y formato) a los de la tabla de quintetos.
- CA-4: Given la pestaña Quintetos recién abierta, When miro la actividad de red, Then no hay ninguna llamada a `/api/ai/lineup-suggestions`; la llamada ocurre solo al tocar "Generar sugerencias".
- CA-5: Given un equipo cuyos quintetos tienen todos muestra "baja", When pido cualquier tipo, Then no se llama al modelo (verificable con un servicio simulado que cuenta llamadas) y la pantalla muestra "Ningún quinteto supera el umbral de muestra…".
- CA-6: Given un quinteto con muestra "baja" y valores extremos, When pido un objetivo, Then ese quinteto no aparece en el resumen ni en las sugerencias.
- CA-7: Given cada objetivo (anotar, defender, reboteear, frenar el ritmo, cerrar), When lo pido, Then las filas del resumen son las que el criterio fijo del plan selecciona (verificable ordenando la tabla de quintetos por esa métrica entre los de muestra ≥ media).
- CA-8: Given "Contra un rival" con un rival y emparejamientos con muestra suficiente, When lo pido, Then las filas de soporte coinciden con las del emparejamiento de quintetos de F-03 (`GET /api/prepare`, bloque `matchups.quinteto`) para ese par de equipos; sin emparejamientos con muestra suficiente, el resultado es el vacío explicado.
- CA-9: Given "Infrautilizados", When lo pido, Then cada fila cumple percentil de Net ajustado ≥ `ai.perf_pct` y participación en el tiempo del equipo ≤ `ai.low_usage_share` %; Given "A evitar", Then cada fila tiene muestra "alta" y Net ajustado + banda < 0.
- CA-10: Given "Cambios de una pieza", When lo pido, Then cada par difiere exactamente en un jugador, ambos quintetos tienen muestra ≥ media y los impactos de los dos jugadores coinciden con `GET /api/synergy/<team>` (A-08); un jugador sin fila de sinergia muestra "—" y no rompe el par.
- CA-11: Given "Lectura de cierres", When lo pido, Then las filas coinciden con `GET /api/table/team_lineup_clutch` (F-06) para los quintetos con nivel "alta".
- CA-12: Given el panel, When lo veo, Then los tres límites del cliente están visibles sin interacción, antes y después de generar.
- CA-13: Given el servicio de IA caído, con tiempo agotado o con una negativa del modelo (`stop_reason` "refusal"), When genero, Then veo el mensaje de error correspondiente, no hay texto parcial y el resto de la pantalla sigue funcionando.
- CA-14: Given `ai.max_calls_per_hour` = 2, When genero tres veces seguidas con consultas distintas, Then la tercera responde 429 `limite_ia` con el mensaje de límite; Given la misma consulta repetida sin "Regenerar", Then se reutiliza el resultado y no cuenta como llamada nueva ni llama al modelo.
- CA-15: Given una métrica nula de un quinteto (por ejemplo AS/PER sin pérdidas), When se arma el resumen, Then esa métrica no figura en el resumen enviado y el texto no la cita; en la tabla de soporte aparece "—".
- CA-16: Given el resumen enviado al modelo (registro de depuración), When lo reviso, Then contiene solo filas de quintetos con métricas formateadas, percentiles y muestra: sin eventos, sin partidos, sin nombres de usuario ni identificadores de sesión.
- CA-17: Given el servidor sin la variable `ANTHROPIC_API_KEY` o sin el paquete `anthropic`, When arranca y se usa la app, Then no hay error, `GET /api/me` devuelve `llm_enabled: false`, el panel no se muestra y el endpoint responde 503 `llm_deshabilitado`.
- CA-18: Given 20 valores de la tabla de soporte, When los comparo con los de la tabla de quintetos formateados por el frontend, Then son idénticos carácter por carácter (redondeo y coma decimal).
- CA-19 (requiere clave real, opcional): Given una llamada real al modelo configurado, When genero "Anotar" sobre un equipo del seed con quintetos elegibles, Then el texto cita solo valores del resumen, pasa la validación y se muestra con su soporte.

## 8. Fuera de alcance

- Que el modelo calcule, estime o prediga: no hay proyecciones ni "probabilidad de ganar".
- Generación automática o en segundo plano, notificaciones y programación de lecturas.
- Chat libre con el modelo o preguntas abiertas del usuario; solo los 10 tipos fijos.
- Entrenar o ajustar modelos; guardar el historial de sugerencias en base de datos (el resultado reutilizado vive en la caché en memoria del servidor).
- Sugerencias sobre jugadores sueltos, rivales o partidos; solo quintetos del equipo consultado.
- Mostrar el panel dentro del informe de F-03 o en Mi equipo (F-12): solo la pestaña Quintetos.
- INCREMENTO DIFERIDO (→ F-21): texto en inglés y portugués; el módulo queda con un único punto (`llm._lang()`) que F-21 conecta a la preferencia de idioma, con formato numérico por idioma ya soportado por el formateador.
- Comparar proveedores o modelos distintos de Claude; la elección del modelo es una variable de entorno.

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] **Modelo por defecto.** La arquitectura (DA-24) fija `LLM_MODEL=claude-opus-5`. El modelo vigente más reciente de esa línea es `claude-opus-5-5`, con un precio por token menor ($4/$20 por millón frente a $5/$25). Se mantiene el default de la arquitectura en el plan y se deja el cambio como decisión de costo del cliente (se cambia con la variable de entorno, sin tocar código); alternativas más baratas: `claude-sonnet-5-5` o `claude-haiku-4-5`.
- [DECISIÓN PROPUESTA — confirmar] **Los diez tipos en un solo selector.** El cliente lista cinco objetivos y cinco tipos más (rival, infrautilizados, a evitar, cambios de una pieza, cierres). Se implementan como una única lista de diez opciones (campo `goal` del endpoint). "Cerrar el partido" (objetivo) y "Lectura de cierres" usan las mismas filas de cierres: el primero recomienda un quinteto para cerrar, la segunda describe cómo se comportan los que más cierran (hasta `ai.top_n + 2` filas).
- [DECISIÓN PROPUESTA — confirmar] **Criterios de "infrautilizado" y "a evitar".** El cliente los define con palabras ("buen rendimiento ajustado y pocos minutos", "rendimiento bajo sostenido con muestra suficiente"). Se concretan como: infrautilizado = percentil de Net ajustado ≥ `ai.perf_pct` (default 70) entre los quintetos elegibles del equipo y ≤ `ai.low_usage_share` % (default 5) del tiempo del equipo; a evitar = muestra "alta" y Net ajustado + banda < 0 (el techo del intervalo de 95 % sigue siendo negativo). Los tres números son configurables (PROPUESTA de claves).
- [DECISIÓN PROPUESTA — confirmar] **Cifras derivadas en "Cambios de una pieza".** El cliente pide cuantificar "cómo cambia su perfil", lo que requiere una diferencia entre dos quintetos que no es una columna de la tabla. La diferencia la calcula el backend (resta de los valores numéricos de las dos filas de la tabla, formateada como el resto) y se muestra en la tabla de soporte junto a los valores de ambos quintetos que la originan, de modo que el entrenador puede verificarla restando dos celdas. El modelo nunca resta; la cifra "existe previamente en el resumen" (RF-6).
- [DECISIÓN PROPUESTA — confirmar] **Cantidad de sugerencias:** hasta `ai.top_n` (default 3) filas por consulta y hasta 3 sugerencias de texto; menos si el criterio selecciona menos.
- [DECISIÓN PROPUESTA — confirmar] **Reutilización del resultado:** el texto generado se guarda en la caché en memoria del servidor por (equipo, tipo, rival, competencia, contexto, versiones de datos y configuración, idioma) y se reutiliza hasta que cambien los datos o la configuración; "Regenerar" fuerza una llamada nueva. Un servidor reiniciado pierde la caché (no se persiste: no es un dato del negocio).
- [DECISIÓN PROPUESTA — confirmar] **Privacidad.** Se envían nombres de jugadores (nombres deportivos públicos ya visibles en la app) y métricas agregadas; no se envían usuarios ni datos crudos. Aun así los datos viajan a un servicio externo (Estados Unidos): se recomienda que el cliente confirme que es aceptable respecto de la Ley 18.331 (Arq. R-12/R-13) antes de activar `LLM_ENABLED` en producción.
- [DECISIÓN PROPUESTA — confirmar] **Idioma de la salida:** español rioplatense ahora; F-21 lo conecta al idioma elegido.
- [NEEDS CLARIFICATION] Presupuesto de costo: el cliente no indicó un tope mensual. El plan limita llamadas por usuario y por hora y registra los tokens de cada llamada, pero el valor de `ai.max_calls_per_hour` (default 20) y la elección de modelo dependen de un presupuesto que el cliente debe fijar.
