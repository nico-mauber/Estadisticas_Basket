# Spec — C-07: Detalle de tiro completo en equipo y jugador

> **ID:** C-07 · **Prioridad:** P1 · **Fase y orden:** 1·10
> **Depende de:** C-11 ([../01-C-11-tratamiento-de-nulos/](../01-C-11-tratamiento-de-nulos/spec.md), incluye el Grupo 0 = integración de `dev`) · C-02 ([../11-C-02-promedios-de-liga/](../11-C-02-promedios-de-liga/spec.md), **dependencia propuesta por este spec**, ver §9-A5)
> **Habilita:** T-05 ([../13-T-05-conjunto-estandar-metricas/](../13-T-05-conjunto-estandar-metricas/spec.md)) · C-03 ([../17-C-03-mapas-tiro-ppt-tooltip/](../17-C-03-mapas-tiro-ppt-tooltip/spec.md))
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §2 · C-07 ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · §1.3 (S3/S4 pestaña Tiro) · §6 glosario (PPT) · Arquitectura §1.0, §2.1, §2.2, §3.5, §7.4 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente** (Esp. v2 §2 C-07, literal):
- *"Agregar T2i, T2c, T3i, T3c, TLi y TLc, en promedio por partido y en totales de temporada."*
- *"Agregar puntos por tiro (PPT) general, de 2, de 3 y de tiros libres."*
- CA: *"La sección Tiro muestra intentos y convertidos de las tres categorías más los cuatro valores de PPT."*

El glosario v2 (§6) define: *"PPT — Puntos anotados desde tiros de campo / tiros de campo intentados"*. En la
navegación objetivo (§1.3) la pestaña **Tiro** de S3 Equipo y de S4 Jugador contiene "Mapa por zonas con PPT, detalle
T2/T3/TL en promedio y totales" (C-03 + C-07).

**Qué existe hoy (verificado).**
- En `main` (producción, commit `2b5f14c`) no hay detalle de tiro: la card "Tiro" del jugador muestra solo FG2%, FG3%,
  FT%, Uso 2P y Uso 3P; no hay `ppt_2/ppt_3/ppt_ft` ni totales.
- En la rama `dev` (commit `0cc4de6`, Feature 16 `sdd/specs/16-tiro-completo-ppt/`, que el Grupo 0 de C-11 integra):
  - `backend/stats_engine.py` `calc_team_stats` y `calc_player_stats` devuelven `ppt_2 = 2·FGM2/FGA2`,
    `ppt_3 = 3·FGM3/FGA3`, `ppt_ft = FTM/FTA` (vía `_safe_div` → `None` con denominador 0) y siguen devolviendo
    `pps = PTS/FGA` (**incluye los puntos de tiros libres**). El comentario del código dice "El PPT general es `pps`".
  - `backend/app.py` `team_stats` / `player_stats` agregan un bloque `totals = {fga2, fgm2, fga3, fgm3, fta, ftm}`
    sumado sobre **todos** los partidos (jugador: solo partidos jugados, `played(minutes)`), y `averages` con la
    **media de las tasas por partido** (`_avg`, excluye `None`); `ast_to` es la excepción pooled (`season_ast_to`, C-04).
  - `frontend/js/app.js` `_shotDetailGrid(av, totals, lg)` pinta seis celdas "promedio (total)" y cuatro `statBox`:
    `PPT` = `av.pps`, `PPT 2`, `PPT 3`, `PPT TL`. Se usa en la card "Tiro" de `_renderTeamContent` y de
    `_renderPlayerContent`. Las cards "Eficiencia" (equipo) y "Producción ofensiva" (jugador) también rotulan `PPT` a `pps`.
  - `docs/metrics.md` (dev, l.67): `PPT = PTS / FGA` "(solo tiros de campo)" — contradicción interna: `PTS` incluye TL.
  - `backend/app.py` `_zones_from_shots` / `team_shots` / `player_shots`: `summary.ppt = puntos de campo / intentos de
    campo` (ya es el PPT del glosario). Resultado: **en la misma pantalla conviven dos "PPT" distintos** (encabezado del
    mapa = glosario; card Tiro = `pps`).
- **Defectos verificados en `dev` que quedan para C-07:**
  1. PPT general = `pps` (PTS/TCi) en vez del glosario (discrepancia D-15; `[DECISIÓN HUMANA: DA-03]`, default: nueva clave `ppt`).
  2. `totals` ignora los filtros de pantalla: con el select de competencia o las pills "Últ. 5 / Últ. 3", el promedio se
     recalcula en el cliente (`_computeAvg`) pero el "(total)" sigue siendo el de toda la base.
  3. `_computeAvg` (app.js) **no incluye** `ppt_2`, `ppt_3`, `ppt_ft` en su lista de claves: con un filtro activo los tres
     PPT se muestran "—" aunque haya intentos.
  4. Los PPT de la card son **media de tasas por partido** y no cuadran con los totales mostrados al lado (evidencia de la
     Feature 16: T3c total 23 de T3i 53 → 3·23/53 = 1,30, pero la card mostró `PPT 3 1.32`). Lo mismo con FG2%/FG3%/FT%.
  5. `search_players` y la tabla del Buscador rotulan "PPT" a `pps`.

**Qué resolvieron features anteriores.** 08/12 (nulos: `_safe_div` → `null`, DNP fuera de promedios), 16 (conteos,
`ppt_2/3/ft`, `totals`, `_shotDetailGrid`), 15 (AS/PER acumulado como precedente de agregación pooled).

**Qué queda (alcance de C-07 v2, delta sobre `dev`):** PPT general según el glosario; toda tasa de la sección Tiro
calculada sobre los totales de la selección (pooled, DA-02) para que sea verificable a mano con los conteos mostrados;
totales y promedios que respeten la selección de competencia y últimos N; nulos con razón; la etiqueta "PPT" siempre
apuntando al mismo valor en toda la app.

## 1. Objetivo
Que la sección Tiro de Equipo y de Jugador muestre, para la selección activa, intentos y convertidos de 2, de 3 y de
tiro libre (promedio por partido y total) y los cuatro PPT con la definición del glosario, todos coherentes entre sí.

## 2. Fuentes (trazabilidad)
- Especificación v2 §2 C-07 (requisito y CA), §1.3 S3/S4 pestaña Tiro, §6 glosario "PPT", §2 C-11 (nulos).
- Arquitectura §1.0 (delta sobre `dev`), §2.1 (agregación pooled, DA-02), §2.2 filas PPT / PPT 2-3-TL / FG% (DA-03),
  §3.5 (claves `ppt`, `ppt_2`, `ppt_3`, `ppt_ft`, `fga2`…`ftm`; `pps` legado), §3.8 (`competition`, `last` en fase 1),
  §7.4 (nulo con razón), §11 DA-02, DA-03, DA-36.
- `docs/metrics.md` (estado de `dev`) §Eficiencia de tiro (PPT, PPT 2, PPT 3, PPT TL), §eFG%.
- `docs/api.md` (dev) `GET /api/team/<team_code>`, `GET /api/player/<team_code>/<player_name>` (`averages`, `totals`),
  `GET /api/search/players`.
- `docs/frontend.md` (dev) §"Mapa de tiro y card Tiro (C-03 / C-07)".
- Specs de `dev`: `git show dev:sdd/specs/16-tiro-completo-ppt/{spec,plan,progress}.md`.

## 3. Historias de usuario
- US-1: Como entrenador, quiero ver cuántos tiros de 2, de 3 y libres intenta y convierte mi equipo o un jugador, por
  partido y en total, para dimensionar el volumen además de la eficacia.
- US-2: Como analista, quiero el PPT general y abierto por tipo de tiro, para saber de dónde salen los puntos más baratos.
- US-3: Como analista, quiero que los porcentajes y PPT de la sección se puedan recalcular a mano con los totales que
  muestra la misma pantalla, para confiar en los números.
- US-4: Como entrenador, quiero que al filtrar por competencia o por últimos partidos todo el detalle (promedios,
  totales y PPT) corresponda a esa selección.

## 4. Requisitos funcionales
- RF-1: El sistema DEBE mostrar en la sección Tiro de Equipo y de Jugador T2i, T2c, T3i, T3c, TLi y TLc, cada uno en
  **promedio por partido** y en **total** de la selección activa. · (US-1, US-4) (Esp. v2 §C-07) (docs/api.md `totals`)
  · Reglas: total = Σ del conteo sobre los partidos de la selección; promedio por partido = total / partidos de la
  selección; jugador: solo partidos jugados (un DNP no cuenta, Esp. v2 §C-11).
- RF-2: El sistema DEBE mostrar el **PPT general** con la definición del glosario: `PPT = (2 × T2c + 3 × T3c) / (T2i + T3i)`
  ("Puntos anotados desde tiros de campo / tiros de campo intentados"). · (US-2) (Esp. v2 §6 PPT, §C-07)
  (Arquitectura §2.2, `[DECISIÓN HUMANA: DA-03]`)
- RF-3: El sistema DEBE mostrar **PPT de 2** = `(2 × T2c) / T2i`, **PPT de 3** = `(3 × T3c) / T3i` y **PPT de TL** =
  `TLc / TLi`. · (US-2) (Esp. v2 §C-07) (docs/metrics.md §PPT 2 / PPT 3 / PPT TL)
- RF-4: Toda tasa de la sección Tiro (PPT, PPT 2, PPT 3, PPT TL, FG2%, FG3%, FT%, Uso 2P, Uso 3P) DEBE calcularse sobre
  los **totales de la selección** (Σnumerador / Σdenominador), no como promedio de las tasas por partido. · (US-3)
  (Arquitectura §2.1, `[DECISIÓN HUMANA: DA-02]`) · Reglas: FG2% = ΣT2c/ΣT2i; FG3% = ΣT3c/ΣT3i; FT% = ΣTLc/ΣTLi;
  Uso 2P = ΣT2i/ΣTCi; Uso 3P = ΣT3i/ΣTCi (docs/metrics.md §Uso del tiro).
- RF-5: Toda tasa con denominador 0 en la selección DEBE valer nulo con razón `sin_intentos` y mostrarse "—", nunca 0;
  un conteo 0 real (ej. 0 triples intentados) DEBE mostrarse `0`. · (US-3) (Esp. v2 §C-11) (Arquitectura §7.4)
- RF-6: Promedios, totales y tasas de la sección DEBEN corresponder a la selección activa de competencia y de últimos
  N partidos (la misma que el resto de la pantalla). · (US-4) (Esp. v2 §C-07 + §C-02) (Arquitectura §3.8)
- RF-7: En toda la app, la etiqueta "PPT" DEBE mostrar el valor de RF-2. En particular: card "Eficiencia" de Equipo,
  card "Producción ofensiva" de Jugador, sección Tiro y columna "PPT" del Buscador. · (US-2, US-3) (Arquitectura §2.2 DA-03)
- RF-8: El sistema DEBE conservar la clave legado `pps` (PTS/TCi) en las respuestas existentes sin mostrarla con la
  etiqueta "PPT". · (US-3) (Arquitectura §3.5 "Compatibilidad con claves actuales")
- RF-9: El PPT general, PPT 2, PPT 3 y PPT TL DEBEN tener promedio de liga (`Ø`) calculado con la misma regla que el resto
  de las métricas (C-02). · (US-2) (Esp. v2 §C-02) (Arquitectura §3.6)
- RF-10: El game log por partido DEBE exponer también `ppt` del partido (tasa del partido, para gráficos y tablas por
  partido). · (US-2) (Arquitectura §2.1 "Serie partido a partido")

## 5. Requisitos de datos / API
| Tabla/Endpoint | Tipo | Campos / Shape | Nuevo? |
|---|---|---|---|
| `team_game_stats`, `player_game_stats` (`fgm2`, `fga2`, `fgm3`, `fga3`, `ftm`, `fta`, `minutes`) | consumidas | sin cambio | No — sin cambio de esquema |
| `GET /api/team/<team_code>` | existente (mod.) | Acepta `competition`, `last` (contrato de C-02). `averages.ppt` **NUEVO**; `averages.{ppt,ppt_2,ppt_3,ppt_ft,fg2_pct,fg3_pct,ft_pct,fg2_uso,fg3_uso}` pooled; `totals` sobre la selección; `null_reasons` con las razones de esas claves; `game_log[].ppt` **NUEVO**; `league.ppt` **NUEVO** | Campos NUEVOS → docs/api.md |
| `GET /api/player/<team_code>/<player_name>` y `GET /api/player/<int:player_id>` (C-08) | existente (mod.) | Ídem | Campos NUEVOS |
| `GET /api/search/players` | existente (mod.) | Cada fila agrega `ppt` (la columna "PPT" pasa a leerla); `pps` se conserva | Campo NUEVO |
| Errores | — | Sin códigos nuevos: 404 equipo/jugador (existente), 400 `contexto_invalido`/`competencia_inexistente` (de C-02) | No |

## 6. Estados de UI
Sección **Tiro** dentro de la vista Equipo y de la vista Jugador (en fase 1 son cards de `#sec-team` / `#sec-player`;
X-01 las mueve a la pestaña `tiro` de S3/S4 sin cambiarlas).

| Vista/Componente | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Sección Tiro (Equipo/Jugador) | spinner existente de la vista | selección sin partidos jugados: "Sin partidos jugados en la selección" (**copy nuevo** → docs/frontend.md) | toast existente con el `error` del backend | mensaje offline existente (`/api/*` siempre a red) | tres filas T2/T3/TL con "por partido" y "total"; cuatro PPT con `Ø`; tasas sin intentos en "—" con `title` = "Sin intentos" (etiqueta `sin_intentos` de C-11) |
| Card Eficiencia / Producción ofensiva | sin cambio | sin cambio | sin cambio | sin cambio | "PPT" muestra el PPT del glosario |
| Buscador — columna PPT | sin cambio | sin cambio | sin cambio | sin cambio | valor `ppt`; nulos al final al ordenar |

Copy nuevo (vía `t()`, → docs/frontend.md): "Detalle de tiro", "Por partido", "Total", "PPT", "PPT 2", "PPT 3", "PPT TL",
"T2i", "T2c", "T3i", "T3c", "TLi", "TLc" (literales de la Esp. v2), "Sin partidos jugados en la selección".
Formato es-UY (DA-36): conteos por partido con 1 decimal ("45,0"), totales enteros ("90"), PPT con 2 decimales ("1,09"),
porcentajes con 1 decimal ("43,4 %").

## 7. Criterios de aceptación
- CA-1 (CA del cliente): Given la vista Equipo y la vista Jugador con datos, When se observa la sección Tiro, Then
  muestra intentos y convertidos de las tres categorías (T2, T3, TL) más los cuatro valores de PPT (general, 2, 3, TL).
- CA-2: Given un equipo con partidos, When se observa la sección Tiro, Then cada uno de T2i, T2c, T3i, T3c, TLi, TLc se
  muestra por partido y en total, y total / partidos = promedio por partido (con el redondeo mostrado).
- CA-3: Given la sección Tiro de un equipo o jugador, When se recalcula a mano `PPT = (2·ΣT2c + 3·ΣT3c)/(ΣT2i + ΣT3i)`,
  `PPT 2 = 2·ΣT2c/ΣT2i`, `PPT 3 = 3·ΣT3c/ΣT3i`, `PPT TL = ΣTLc/ΣTLi` con los totales mostrados, Then coinciden con los
  valores de la pantalla (a 2 decimales), y FG2%/FG3%/FT% coinciden con ΣT2c/ΣT2i, ΣT3c/ΣT3i, ΣTLc/ΣTLi.
- CA-4: Given un partido con tiros libres convertidos, When se compara el PPT general con PTS/TCi, Then el PPT general
  excluye los puntos de tiro libre (es menor que `pps` cuando TLc > 0).
- CA-5: Given un jugador sin triples intentados en la selección, When se ve la sección, Then T3i y T3c muestran `0` y
  `PPT 3` y `FG3%` muestran "—" (nunca `0,00` ni `0,0 %`), sin color de rendimiento.
- CA-6: Given el filtro de competencia o "Últ. 5", When se aplica, Then promedios, totales y los cuatro PPT de la sección
  corresponden a esos partidos (el total cambia; ningún PPT pasa a "—" si la selección tiene intentos).
- CA-7: Given un jugador con partidos DNP, When se observa la sección, Then los DNP no suman partidos ni totales.
- CA-8: Given las cards Eficiencia (equipo), Producción ofensiva (jugador), la sección Tiro y el Buscador, When se lee
  "PPT" de una misma entidad y selección, Then es el mismo valor en todos los lugares.
- CA-9: Given los cuatro PPT, When se observa su contexto, Then muestran `Ø` de liga (o "Ø —" si no hay universo), igual
  al que muestra cualquier otra pantalla para esa competencia (regla de C-02).
- CA-10: Given el recorrido de Equipo, Jugador y Buscador, When se observa la consola del navegador, Then no hay errores JS.

## 8. Fuera de alcance
- Mapa de tiro, tooltip de 7 datos, `summary.ppp` de equipo y coordenadas reales → C-03.
- Conjunto estándar completo (TCi, TCc, FG% general, `paint_fga_share`, bases por 40/por 100) y migración total a pooled
  de las demás tasas (eFG%, TS%, FT Rate, OER…) → T-05 (DA-02) y T-04.
- Percentiles, ranking y ficha de métrica de estos valores → T-01 (hasta entonces se muestra `Ø` según C-02).
- Detalle de tiro en quintetos, ON/OFF y cierres → F-06 / T-05.
- Retirar la clave `pps` de las respuestas → cuando T-05 migre todas las pantallas.

## 9. Ambigüedades
- A1 · ¿PPT general incluye los tiros libres? → [DECISIÓN PROPUESTA — confirmar] No: se adopta el glosario v2 ("puntos
  desde tiros de campo / tiros de campo intentados"), `ppt = (2·T2c + 3·T3c)/TCi`, nueva clave; `pps` queda legado.
  Es el default de `[DECISIÓN HUMANA: DA-03]`. Cambia el número visible respecto de `dev` (baja en equipos que anotan
  muchos TL); se anota en `docs/metrics.md` y en progress.
- A2 · ¿Las tasas de temporada son promedio de las tasas por partido o cociente de totales? → [DECISIÓN PROPUESTA —
  confirmar] Cociente de totales para toda tasa de la sección Tiro (default de `[DECISIÓN HUMANA: DA-02]`). Razón: el
  cliente pide promedios y totales en la misma sección; con media de tasas los PPT no se pueden verificar con los totales
  mostrados (defecto 4 de §0). Las tasas fuera de la sección siguen con la política vigente hasta T-05.
- A3 · ¿"Totales de temporada" con un filtro de últimos N? → [DECISIÓN PROPUESTA — confirmar] "Total" = total de la
  selección activa (competencia + últimos N), rotulado "Total" (no "Total temporada") para no mentir cuando hay filtro.
- A4 · ¿"Promedio por partido" de un conteo con partidos DNP? → Resuelto por C-11: el DNP no cuenta como partido.
- A5 · Orden respecto de C-02 → [DECISIÓN PROPUESTA — confirmar] Implementar C-07 **después** de C-02 (invertir el orden
  10↔11 de la fase 1). Razón: RF-6 exige que el backend reciba `competition`/`last` y agregue la selección; ese mecanismo
  (`context.py` y la agregación única de temporada) lo crea C-02. Sin él, C-07 tendría que calcular tasas en el
  frontend (`_computeAvg`), contra la Constitución regla 4. C-02 no depende de C-07.
