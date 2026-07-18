# Spec — Feature 01: shot chart — modo simplificado sin coordenadas

## 1. Objetivo
Cuando el partido importado no trae coordenadas reales de tiro (caso FUBB: `x=0,y=0` en toda la tabla `shots`), el shot chart debe renderizarse en un modo honesto de 3 zonas (Pintura / Media distancia / Triple) en vez de mostrar un diagrama de 11 zonas con 8 casilleros que nunca van a tener datos.

## 2. Fuentes (trazabilidad)
- `docs/database.md` §`shots` — "Tiene coordenadas x/y si vienen del array shot de FIBA; si viene del play-by-play, x=0, y=0."
- `docs/api.md` §`GET /api/shots/<team_code>/<player_name>` — "Tiros sin coordenadas... caen en top_key_3 (3PT) o mid_top (2PT)."
- `backend/app.py` `_classify_zone_11()` — confirmado por lectura de código + prueba con datos reales (juego FUBB 2849350): el feed `data.json` de FIBA LiveStats para esta competencia NO expone el array `shot` (0 elementos) ni coordenadas en `pbp` (`x`/`y` ausentes, sin qualifier de lado/zona). Todo intento cae en 1 de 3 buckets: `restricted_area` (paint keyword), `mid_top` (2pt sin keyword), `top_key_3` (3pt sin coords).
- Decisión de producto (usuario, esta feature): no simular/inventar zonas — mostrar la realidad de los datos (Constitución regla 1).

## 3. Historias de usuario
- US-1: Como entrenador/analista, quiero que el shot chart se vea prolijo y creíble incluso cuando el partido importado no trae coordenadas de tiro, para no interpretar erróneamente 8 casilleros vacíos como "el jugador no tira desde ahí".
- US-2: Como entrenador/analista, quiero que si en el futuro se importa un partido con coordenadas reales, el chart siga mostrando las 11 zonas completas, para no perder detalle cuando el dato exista.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE reportar, junto a las zonas, si el conjunto de tiros del jugador tiene coordenadas reales o no. · (US-1, US-2, docs/database.md §shots) · `has_coordinates = true` si al menos un tiro tiene `x != 0 or y != 0`; `false` si todos los tiros son `x=0,y=0`.
- RF-2: Si `has_coordinates` es `false`, el frontend DEBE renderizar el shot chart en modo simplificado de 3 zonas: Pintura (`restricted_area`), Media distancia (`mid_top`), Triple (`top_key_3`). · (US-1, backend/app.py `_classify_zone_11`) · Las otras 8 claves de `ZONE_KEYS_11` no se muestran en este modo (nunca tienen `attempts>0` cuando `has_coordinates=false`).
- RF-3: Si `has_coordinates` es `true`, el frontend DEBE renderizar el shot chart de 11 zonas existente sin cambios. · (US-2)
- RF-4: El modo simplificado DEBE mantener el mismo estilo visual (cancha clara, cajas redondeadas con % de acierto grande + P/F y % de participación chicos, heatmap de color por P/F, badge P/F global + eFG%) que el modo de 11 zonas, para continuidad visual de la vista Jugador. · (US-1, docs/frontend.md §Vistas)

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `GET /api/shots/<team_code>/<player_name>` | endpoint existente | agrega campo `has_coordinates: bool` en la respuesta (junto a `zones`, `total_shots`, `summary`) | NUEVO campo, mismo endpoint |

## 6. Estados de UI
| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Shot chart (Jugador) | spinner existente (`renderPlayer`) | no se inserta la card si `total_shots === 0` (comportamiento actual, sin cambio) | no se inserta la card (comportamiento actual: `.catch` silencioso de `api.playerShots`, sin cambio) | Service Worker ya excluye `/api/*` de caché — sin cambio | si `has_coordinates=true` → chart de 11 zonas (sin cambio); si `false` → chart de 3 zonas (nuevo) |

## 7. Criterios de aceptación
- CA-1: Given un jugador cuyos tiros en `shots` son todos `x=0,y=0`, When se pide `GET /api/shots/<team>/<player>`, Then la respuesta incluye `"has_coordinates": false`.
- CA-2: Given `has_coordinates=false`, When se abre la vista Jugador, Then el shot chart muestra exactamente 3 casilleros con datos (Pintura/Media/Triple) y ningún casillero de wing/corner/elbow.
- CA-3: Given un jugador con al menos un tiro con coordenadas reales (`x!=0 or y!=0`), When se pide el endpoint, Then `has_coordinates=true` y la vista Jugador muestra el chart de 11 zonas sin cambios visuales respecto al comportamiento previo a esta feature.
- CA-4: Given `has_coordinates=false`, When se inspecciona el SVG generado, Then el badge (P/F global + eFG%) y los 3 casilleros usan la misma paleta/heatmap que el modo 11 zonas (mismos umbrales de color por P/F).

## 8. Fuera de alcance
- Obtener coordenadas reales desde otra fuente/endpoint de FIBA/Genius Sports (investigación de endpoint alternativo — descartada por el usuario en esta feature).
- Cambiar la clasificación de zonas en `_classify_zone_11` (se mantiene igual; solo se expone si el resultado usó coordenadas o no).
- Shot chart a nivel Equipo (`docs/frontend.md` lo marca "si hay datos" pero no está implementado hoy — no se toca en esta feature).

## 9. Ambigüedades
(ninguna abierta — decisión de alcance ya tomada por el usuario: aceptar 3 zonas reales y pulir el modo visual simplificado)
