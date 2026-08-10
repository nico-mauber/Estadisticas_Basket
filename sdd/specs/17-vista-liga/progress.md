# Progress — Feature 17: vista Liga

> Cierre de C-09 y C-10 (`Smart-Basket Especificacion v2.docx` §1, P1/P2).

## Estado de tareas

- [x] **T-A1** · N/A — sin cambio de esquema
- [x] **T-B1** · `wins`, `losses`, `table_points`, `pts_for`, `pts_against` · `backend/app.py`
- [x] **T-B2** · Orden final null-safe del ranking · `backend/app.py`
- [x] **T-C1** · N/A — `api.js` sin cambios
- [x] **T-D1** · `_standingsCardHTML` — tabla general ordenada por puntos
- [x] **T-D2** · Flechas de dirección en los títulos de eje de los 3 presets
- [x] **T-E1** · Ver D-2: no alcanzable con los datos actuales
- [x] **T-E2** · Verificado a 390px
- [x] **T-E3** · `sw.js` sin cambios
- [x] **T-F1** a **T-F5** · Ver §Gates y §CA

## Estado de CA (gate de aceptación)

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ✅ | Card "Tabla general" con cabeceras `Equipo · PJ · PG · PP · Pts · PF · PC`, 6 filas |
| CA-2 | ✅ | NACIONAL 2 PJ / 2 PG / 0 PP → **4 Pts**. HEBRAICA 2 PJ / 0 PG / 2 PP → **2 Pts**. Regla `table_points == 2×wins + losses` verificada en los 6 equipos |
| CA-3 | ✅ | Orden descendente por Pts confirmado (4, 2, 2, 2, 1, 1). Desempate por diferencia de puntos: AGUADA (−28) sobre CORDON (−51), ambos con 1 punto |
| CA-4 | ✅ | CNF: API `PF 207 / PC 154` vs suma del game log `207 / 154`. HYM: `141 / 155` en ambos |
| CA-5 | ✅ | `PG + PP == PJ` en los 6 equipos |
| CA-6 | ⚠️ | **No alcanzable con los datos actuales** — ver D-2. Verificado en backend (`/api/league?competition=…` → `200` con los campos nuevos) y por construcción en frontend: la tabla se arma desde `_leagueTeams`, que `renderLeague()` refetchea al cambiar el filtro |
| CA-7 | ✅ | Preset Eficiencia: eje X `OER (→ mejor ataque)` — flecha horizontal en eje horizontal |
| CA-8 | ✅ | Preset Rebotes: `OR% (→ mejor)` / `DR% (↑ mejor)`. Contrastado con las posiciones reales del gráfico: el equipo con mayor OR% se dibuja **a la derecha** y el de mayor DR% **arriba**. Las leyendas coinciden con la pantalla |
| CA-9 | ✅ | Con `oer: null` inyectado vía intercepción de `fetch`: la ruta no rompe y, al ordenar por OER ascendente, la secuencia es `0.77 · 0.88 · 0.94 · 0.99 · 1.11 · —` — el nulo al final |
| CA-10 | ✅ | Consola tras recorrer la vista Liga y alternar presets: **0 errores** |

## Gates técnicos

- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: **N/A** — sin cambio de esquema
- Endpoints probados manualmente: ✅ — `/api/league` con y sin `?competition=`
- Consola del navegador sin errores JS: ✅
- Mobile 390px: ✅ — la tabla general scrollea dentro de su `.table-wrap`; el body **no** genera
  scroll horizontal

## Desviaciones respecto a docs/ o plan

**D-1 · C-10 no era el defecto que el texto describe.**
C-10 pide "invertir la flecha del eje de rebote". Se verificó en navegador que los ejes **ya ubicaban
bien** lo mejor: con `reverse: false`, el mayor DR% se dibuja arriba (pixelY 39 vs 264) y la leyenda
decía `↑ mejor`. El defecto real era otro: el símbolo `↑` significaba **dos cosas distintas** según el
eje — posición en pantalla en el eje Y (`DER ↓ mejor defensa`, correcto) y "más es mejor" en el eje X
(`OER ↑ mejor ataque`, cuando en pantalla lo mejor está a la **derecha**). Una flecha vertical en un
eje horizontal no puede indicar el lado favorable, que es exactamente lo que pide el CA.
**Corrección aplicada**: los ejes horizontales pasan a `→`, los verticales conservan `↑`/`↓`. Los ejes
Y no se tocaron porque ya eran correctos. Registrado en spec §9.

**D-2 · CA-6 no es alcanzable con los datos de producción.**
El selector de competencia solo se renderiza cuando hay **más de una** competencia, y la base tiene
una sola (`"Liga Uruguaya de Basquetbol 2025/2026"`). El filtrado se verificó en el backend y queda
cubierto por construcción en el frontend, pero **no** end-to-end. Se registra para no leerlo como
cobertura plena.

**D-3 · Se aplicó C-10 a los tres presets, no solo al de rebote** (plan D-2). Corregir un solo eje
habría dejado viva la ambigüedad que originó el reporte.

**D-4 · El orden null-safe del ranking es deuda de la Feature 14, cerrada acá** (plan D-3).
`result.sort(key=lambda x: x["oer"], reverse=True)` comparaba directo contra `float` y, desde que
`_avg` puede devolver `None`, un equipo sin OER habría dejado la vista Liga en **500**. No se
manifestó porque todo equipo con partidos tiene OER, pero era un fallo real esperando el dato.

**D-5 · Se agregó un criterio de desempate que C-09 no pide.**
Con puntos iguales, la tabla desempata por **diferencia de puntos** (PF − PC). C-09 solo pide ordenar
por puntos; sin desempate, el orden entre equipos empatados quedaba a merced del orden de llegada de
la consulta, que no es estable. La reglamentación real de desempates es del organizador (spec §8): si
usa otro criterio, es una línea.

## Docs a actualizar

- [x] `docs/api.md` — campos nuevos de `/api/league`
- [x] `docs/frontend.md` — tabla general; convención de flechas de eje

## Deuda / TODO

- **La tabla refleja solo los partidos importados, no el fixture** (plan D-1). Un equipo con 3 de 12
  partidos cargados aparece con 3 PJ. Es inherente a la app, pero una *tabla de posiciones* invita más
  que ninguna otra pantalla a leerse como la clasificación oficial: **conviene una aclaración visible**
  si el cliente la va a compartir con terceros.
- **Criterio de desempate a confirmar** (D-5): hoy es diferencia de puntos.
- **Puntos de tabla fijos en 2/1.** Algunos torneos usan otro esquema; no es configurable.
