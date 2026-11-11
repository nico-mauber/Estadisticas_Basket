# Progress — F-15: Sugerencias de quinteto asistidas por IA

> **Estado:** ✅ Implementado y **apagado por defecto**. Se activa en Render con `LLM_ENABLED=true` y `ANTHROPIC_API_KEY`; el modelo se elige con `LLM_MODEL` (decisión de costo del cliente).
> **Fecha:** 2026-11-05

## Qué se hizo
- `backend/llm.py`: disponibilidad (paquete, bandera, clave y `ai.suggestions_enabled`), resumen determinista por tipo de lectura con las mismas funciones que las tablas, marcadores, validación de cifras y descarte, llamada con el SDK oficial (`client.beta.messages.create`, salida estructurada, `effort`, `fallbacks: "default"`), manejo de negativa, tiempo agotado y errores, caché por consulta y límite por usuario y hora.
- `backend/app.py`: `POST /api/ai/lineup-suggestions`; `/api/me` agrega `llm_enabled`. `backend/config.py`: `ai.suggestions_enabled` activa y `ai.perf_pct`, `ai.low_usage_share`, `ai.top_n`, `ai.max_calls_per_hour`. `backend/requirements.txt`: `anthropic>=1.17,<2` (opcional).
- Frontend: `components/lineup-suggestions.js` en Equipo › Quintetos, solo con la función habilitada; `sw.js` v65.

## Estado de CA
Scripts en el scratchpad (no se commitean): `f15_sim.py` 35/35 (cliente simulado para la lógica + servidor HTTP local que imita la API para verificar la forma real de la llamada del SDK 1.17), `f15_browser.py` 21/21 (1280 y 360 px, servidor con la función activa contra un servicio simulado, consola limpia).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | las cifras del texto son las del resumen (y aparecen en la tabla de soporte); sin la función Quintetos no cambia y el panel no existe |
| CA-2 | ✅ | cifra inventada, fila no listada o marcador inexistente → descartada; todas descartadas → `validacion_fallida` |
| CA-3 | ✅ | etiqueta "Generada automáticamente" y datos que la sustentan |
| CA-4 | ✅ | abrir la pestaña no llama al servicio (contador del servicio simulado) |
| CA-5 | ✅ | con el umbral de quinteto en 500 posesiones: `sin_quintetos_sobre_umbral`, sin llamada |
| CA-6 | ✅ | ningún quinteto de muestra baja en el resumen |
| CA-7 | ✅ | «Anotar» = top elegibles por OER ajustado de la tabla |
| CA-8 | ✅ | «Contra un rival» usa los cruces de quintetos de F-03 con muestra suficiente |
| CA-9 | ✅ | infrautilizados cumplen percentil y participación; «a evitar» exige muestra alta y Net aj. + banda < 0 (la base de ejemplo no tiene ninguno) |
| CA-10 | ✅ | cada par difiere en un jugador; impactos de A-08 |
| CA-11 | ✅ | cierres: solo muestra alta (la base de ejemplo no tiene ninguno) |
| CA-12 | ✅ | límites visibles sin interacción |
| CA-13 | ✅ | negativa → `rechazo_modelo`; tiempo agotado → 502 `timeout_externo`; servicio caído → 502 `llm_error`; sin texto parcial |
| CA-14 | ✅ | `ai.max_calls_per_hour` = 2 → la tercera generación real responde 429; repetir la consulta reutiliza sin llamar; Regenerar vuelve a llamar |
| CA-15 | ✅ | métrica nula fuera del resumen |
| CA-16 | ✅ | lo enviado: objetivo, criterio, equipo, contexto y filas con nombres y valores formateados (sin ids, eventos ni partidos) |
| CA-17 | ✅ | sin entorno: `llm_enabled: false`, 503 `llm_deshabilitado`, la app arranca igual |
| CA-18 | ✅ | valores = `phrases.format_value` de los valores de la tabla (mismo formato que el frontend) |
| CA-19 | ⬜ | requiere una clave real (no se probó; sin costo hasta que el cliente la cargue) |

## Desviaciones y decisiones
- Modelo por defecto `claude-opus-5-5` (la arquitectura decía `claude-opus-5`, que ya tiene sucesor). `LLM_EFFORT` por defecto `medium`.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) activado por defecto; se omite con Haiku y con `LLM_FALLBACKS=off`.
- La tabla de soporte usa los valores en base total (las tasas no cambian con la base).
- `ai.suggestions_enabled` se muestra siempre en Configuración (con la aclaración de que requiere el entorno), en vez de ocultarse.
- Sin enlace que enfoque la fila exacta de la tabla (el enlace abre la pestaña Quintetos).
- Copy sin `t()` (F-21).
