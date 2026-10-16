# Spec — F-12: Mi equipo

> **ID:** F-12 · **Prioridad:** P2 · **Fase y orden:** Fase 5 — Analítica diferencial y exploración · 12
> **Depende de:** F-03 ([../../fase-4-dia-de-partido/02-F-03-preparar-partido/](../../fase-4-dia-de-partido/02-F-03-preparar-partido/spec.md)) · F-17 ([../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/](../../fase-2-contexto-comparabilidad/11-F-17-plan-de-juego/spec.md)) · A-10 ([../10-A-10-insights-automaticos/](../10-A-10-insights-automaticos/spec.md)) · F-13 ([../../fase-1-confiabilidad/12-F-13-configuracion/](../../fase-1-confiabilidad/12-F-13-configuracion/spec.md)) · X-01 ([../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/](../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/spec.md))
> **Habilita:** — (completa los incrementos diferidos de F-17 `rival_proximo`, F-03 "abrir Preparar desde el calendario" y X-01 "S8 como inicio")
> **Estado:** Borrador (agente) — pendiente de revisión humana (gate Paso 1)
> **Fuente:** Especificación v2 §4 · F-12 y §1.3 S8 · Mi equipo ([../../00-especificacion-cliente-v2.md](../../00-especificacion-cliente-v2.md)) · Arquitectura §3.3, §3.12, §3.15, §3.19, §4 (`fixtures.py`), §5 (`fixtures`), §6 (`/api/my-team`, `/api/fixtures`), §9.2 I-06/I-16 ([../../00-arquitectura-transversal.md](../../00-arquitectura-transversal.md))

## 0. Contexto y situación actual

**Qué pide el cliente (literal, Esp. v2 §F-12):**
- "Marcar un equipo como propio; la app arranca siempre en él."
- "Próximo partido con acceso directo al modo Preparar."
- "Alertas: insights automáticos de la última semana y variaciones bruscas de rendimiento."
- "Accesos directos a últimos partidos, quintetos más usados y jugadores seguidos."
- Criterio: "Al abrir la app, el entrenador ve su equipo sin aplicar ningún filtro."

Y §1.3 S8: "Pantalla de entrada para el entrenador: evita que tenga que reconstruir su contexto cada vez que abre la app." Módulos: Equipo fijado (F-12) · Próximo partido (F-12, F-03) · Plan de juego (F-17) · Alertas (A-10) · Accesos directos (F-12). Pregunta que responde S8: "¿Qué necesito ver hoy sin buscarlo?".

**Por qué:** hoy la app abre en Importar y el entrenador tiene que elegir equipo, competencia y período cada vez. S8 junta en una pantalla lo que mira todos los días y deja de depender de que el usuario reconstruya el contexto.

**Qué existe HOY (verificado en el árbol de trabajo, rama `v2`):**
- Arranque: `frontend/js/app.js:boot()` pide `api.me()` y llama `renderApp()`, que termina con `setSection("import"); renderImport();` — la app siempre abre en Importar (sección `import` de la lista `sections`, l. ~231). No existe el concepto de equipo propio ni de sección inicial por usuario.
- No existe ningún calendario ni próximo partido: `backend/database.py` no tiene tabla `fixtures` y `backend/app.py` no tiene rutas `/api/fixtures` ni `/api/my-team` (Arquitectura §1.3 y §3.19: FIBA LiveStats no publica fixture en `data.json`).
- Preferencias por usuario: la tabla `user_prefs` y `backend/prefs.py` los crea F-13 (todavía no están en el árbol); el scope `ui` con las claves `home_team` y `followed_players` ya está fijado en Arquitectura §3.3 para este requisito.
- No existe el concepto "seguir jugador". El jugador solo se identifica hoy por `(team_code, player_name)`; el id estable `player_id` lo crea C-08.
- `backend/auth.py` ya tiene `admin_required`/`is_admin` (F-11) y `/api/me` devuelve `is_admin`.
- `backend/ingest.py:persist_game(game)` es el único punto de escritura de un partido importado: ahí se engancha la vinculación `fixtures.game_id` (Arquitectura §3.19: "`fixtures.game_id` se completa al importar el partido (match por fecha + equipos)").

**Qué resuelven requisitos anteriores (supuestos de esta spec):** X-01 deja registrada la sección S8 (`mi-equipo`, ⭐, prioridad móvil 1) con `enabled: false` y una cáscara `views/mi-equipo.js`; la sección inicial del router elige S8 si está habilitada (X-01 RF-16). F-13 entrega `user_prefs`, `core/prefs.js` (`getPref`/`setPref`/`loadPrefs`) y `config.get` con las claves `alerts.*` reservadas. F-17 entrega `phrases.game_plan`, `GET /api/game-plan`, el componente `components/game-plan.js` y el panel plegable; deja como incremento diferido la referencia `rival_proximo` (→ F-12). A-10 entrega `insights.insights(entity_type, entity_id, comp_id, ctx)`. F-03 entrega el modo Preparar `#/partido/preparar?team=&rival=` y deja como incremento diferido abrirlo desde el calendario (→ F-12). T-01/T-02/T-05 entregan fichas, muestra y conjunto estándar; C-08 entrega `player_id`; F-06 entrega `lineups.all_lineups`.

**Qué queda (esta spec):** equipo fijado por usuario y arranque en S8, calendario manual y próximo partido, alertas (insights de la última semana + variaciones bruscas), accesos directos (últimos partidos, quintetos más usados, jugadores seguidos), el concepto nuevo "seguir jugador", y completar los tres incrementos diferidos mencionados.

## 1. Objetivo

Entregar la sección S8 "Mi equipo": una pantalla de entrada por usuario que muestra, sin filtros, el equipo propio con su próximo partido (y acceso a Preparar), su plan de juego, alertas de la última semana y accesos directos a últimos partidos, quintetos más usados y jugadores seguidos; y hacer que la app arranque en ella.

## 2. Fuentes (trazabilidad)

- Especificación v2 §4 F-12 (literal arriba) y §1.3 S8; §4 F-17 ("Presente en la sección Equipo, en Mi equipo (S8)"; referencia "promedio del rival del próximo partido"); §5 A-10 (alertas); §1.3 S5 ("se abre desde … el calendario de S8"); §6 glosario (fórmulas de las métricas que se citan).
- `docs/database.md` §`games`, §`team_game_stats` (sin cambios); `docs/api.md` (no hay endpoints de calendario ni de Mi equipo: son NUEVOS); `docs/frontend.md` (arranque, navegación).
- Arquitectura §3.3 (scope `ui` · `home_team`, `followed_players`), §3.12 (S8, ruta `#/mi-equipo`, móvil prioridad 1), §3.15 (referencia `rival_proximo` diferida → F-12), §3.19 (`fixtures`, `next_fixture`), §4, §5 (tabla `fixtures`), §6 (`GET /api/my-team`, `/api/fixtures`), §7.4 (nulos con razón), §9.2 (I-06, I-16).
- Specs previas: `../../fase-2-contexto-comparabilidad/01-X-01-reorganizacion-navegacion/` (S8 deshabilitada, router), `../../fase-1-confiabilidad/12-F-13-configuracion/` (prefs, `alerts.*`), `../../fase-4-dia-de-partido/02-F-03-preparar-partido/` (modo Preparar), `../../fase-2-contexto-comparabilidad/10-F-06-quintetos-onoff-ampliados/` (quintetos).

## 3. Historias de usuario

- US-1: Como entrenador, quiero marcar mi equipo y que la app abra siempre en él, para no tener que elegirlo ni filtrar cada vez.
- US-2: Como entrenador, quiero ver cuándo y contra quién es mi próximo partido y abrir su informe de preparación con un toque, para pasar de la agenda al análisis sin buscar.
- US-3: Como administrador de datos, quiero cargar el calendario a mano, para que la app sepa cuál es el próximo partido aunque FIBA no lo publique.
- US-4: Como entrenador, quiero ver el plan de juego de mi equipo en la misma pantalla, para tener ventajas y riesgos a la vista.
- US-5: Como entrenador, quiero alertas de la última semana (insights y cambios bruscos de rendimiento), para enterarme de lo que cambió sin revisar tabla por tabla.
- US-6: Como entrenador, quiero accesos directos a los últimos partidos, los quintetos que más usamos y los jugadores que sigo, para llegar a lo que miro todos los días en un toque.
- US-7: Como entrenador, quiero seguir a jugadores (propios o rivales) y ver su forma reciente, para vigilar a los que me importan.

## 4. Requisitos funcionales

**Equipo fijado y arranque**
- RF-1: El sistema DEBE permitir a cada usuario marcar un equipo como propio, cambiarlo y quitarlo, y DEBE recordarlo por usuario entre dispositivos y sesiones (preferencia `ui · home_team`, Arquitectura §3.3). Un usuario no ve ni modifica el equipo fijado de otro. · (US-1) (Esp. v2 §F-12 "Marcar un equipo como propio"; Arq. §3.3)
- RF-2: El sistema DEBE ofrecer fijar el equipo desde dos lugares: la cabecera de la sección Equipo (botón "Fijar como mi equipo") y la propia sección Mi equipo (selector de equipo). · (US-1) (Esp. v2 §F-12)
- RF-3: Cuando el usuario tiene equipo fijado y abre la app sin ruta en la URL, el sistema DEBE iniciar en S8 (`#/mi-equipo`). Una URL con ruta explícita (enlace compartido) DEBE respetarse. Sin equipo fijado, el arranque conserva la regla de X-01 (Datos si no hay partidos, Liga si los hay). · (US-1) (Esp. v2 §F-12 "la app arranca siempre en él"; X-01 RF-16)
- RF-4: S8 DEBE mostrar el equipo propio **sin que el usuario aplique ningún filtro**: competencia resuelta automáticamente (la más reciente del equipo, Arq. §3.1), sin límite de partidos, sin chips activos y sin parámetros de contexto en la URL. · (US-1) (Esp. v2 §F-12 CA)
- RF-5: S8 DEBE mostrar, en una cabecera, el nombre del equipo, la competencia y temporada, el récord victorias-derrotas, la diferencia media de puntos, los partidos considerados y el badge de muestra (T-02). · (US-1) (Esp. v2 §1.3 S8 "Equipo fijado"; F-19 cabecera)
- RF-6: Si el usuario no tiene equipo fijado, S8 DEBE mostrar un selector de equipo y el texto de ayuda, sin error. Si el equipo fijado ya no tiene partidos (se borraron), DEBE avisarlo y ofrecer elegir otro. · (US-1)

**Próximo partido y calendario**
- RF-7: El sistema DEBE permitir cargar un calendario manual (fecha, hora opcional, local, visitante, competencia opcional, enlace FIBA opcional, notas), editarlo y borrarlo; solo un administrador (DA-18) puede escribir; cualquier usuario autenticado lo lee. · (US-3) (Esp. v2 §1.3 S8 "Próximo partido"; Arq. §3.19, §3.21)
- RF-8: El sistema DEBE ofrecer el calendario como pestaña "Calendario" de S1 · Datos (`#/datos/calendario`). · (US-3) (Arq. §3.12)
- RF-9: El sistema DEBE definir el "próximo partido" de un equipo como el primer partido del calendario (orden por fecha y hora) en el que juega, con fecha mayor o igual a hoy (hora de Uruguay) y sin partido importado asociado. · (US-2) (Esp. v2 §F-12 "Próximo partido"; Arq. §3.19 `next_fixture`)
- RF-10: S8 DEBE mostrar el próximo partido con rival, fecha, hora (si existe), condición de local o visitante, competencia y días que faltan, y un botón "Preparar partido" que abre `#/partido/preparar?team=<equipo>&rival=<rival>&fixture=<id>`. · (US-2) (Esp. v2 §F-12 "acceso directo al modo Preparar"; Arq. §3.12)
- RF-11: Al importar un partido, el sistema DEBE vincularlo automáticamente con el partido del calendario que coincida en equipos y fecha (±1 día), completando `fixtures.game_id`; al borrar el partido importado, DEBE desvincularlo. Un partido vinculado deja de ser "próximo". · (US-2, US-3) (Arq. §3.19 "`fixtures.game_id` se completa al importar")
- RF-12: Sin calendario cargado, o sin partidos futuros para el equipo, S8 DEBE mostrar un estado vacío explicado (y, si el usuario es administrador, un enlace a la pestaña Calendario), nunca un próximo partido inventado. · (US-2) (Esp. v2 §C-11)
- RF-13: El sistema DEBE completar el incremento diferido de F-17: la referencia `rival_proximo` del Plan de juego resuelve al rival del próximo partido del equipo (`GET /api/game-plan?reference=rival_proximo`); sin próximo partido, responde un error claro y la UI no ofrece esa referencia. · (US-4) (Esp. v2 §F-17 "promedio del rival del próximo partido"; Arq. §3.15, I-06)
- RF-14: El sistema DEBE completar el incremento diferido de F-03 e I-16: desde el calendario (pestaña Calendario y S8) se puede abrir Preparar con equipo y rival ya elegidos. · (US-2) (Esp. v2 §1.3 S5 "calendario de S8"; Arq. I-16)

**Plan de juego**
- RF-15: S8 DEBE incluir el panel Plan de juego de F-17 (mismo componente y mismo cálculo que en Equipo), plegable con el estado recordado por usuario. La referencia por defecto es el rival del próximo partido si existe y, si no, la competencia; el usuario puede cambiarla. · (US-4) (Esp. v2 §F-17 "Presente en … Mi equipo (S8)"; §1.3 S8)

**Alertas**
- RF-16: S8 DEBE mostrar los insights automáticos de A-10 calculados sobre los partidos del equipo de los últimos `alerts.lookback_days` días (default 7). · (US-5) (Esp. v2 §F-12 "insights automáticos de la última semana"; Arq. §3.2)
- RF-17: S8 DEBE mostrar las variaciones bruscas de rendimiento: métricas del conjunto estándar cuyo valor en la ventana de la última semana se aparta del resto de la temporada por al menos `alerts.change_z` desvíos, con el sentido (mejora o empeora) orientado por la dirección de la métrica. · (US-5) (Esp. v2 §F-12 "variaciones bruscas de rendimiento"; Arq. §3.2)
- RF-18: Cada alerta DEBE mostrar los valores que la sustentan (valor de la semana, valor del resto, diferencia) y la cantidad de partidos de cada lado, y DEBE poder verificarse contra la tabla de métricas del equipo. Una alerta sobre una ventana con menos partidos que `sample.team.min` DEBE llevar badge de muestra baja. Una métrica nula NUNCA genera alerta. · (US-5) (Esp. v2 §A-10 CA "Ningún insight contradice los números"; §T-02; §C-11)
- RF-19: Si el equipo no jugó en la ventana, S8 DEBE decirlo ("No hubo partidos en los últimos N días") en lugar de mostrar alertas vacías o de otra ventana. · (US-5)

**Accesos directos**
- RF-20: S8 DEBE listar los últimos partidos del equipo (cantidad `my_team.last_games`) con fecha, rival, condición, marcador y resultado, cada uno con enlace al modo Analizar de S5. · (US-6) (Esp. v2 §F-12 "últimos partidos"; §1.3 S5)
- RF-21: S8 DEBE listar los quintetos más usados (cantidad `my_team.top_lineups`, ordenados por minutos jugados), con su muestra, y cada uno con enlace a la pestaña Quintetos del equipo. · (US-6) (Esp. v2 §F-12 "quintetos más usados"; F-06)
- RF-22: El sistema DEBE permitir seguir y dejar de seguir jugadores (concepto nuevo "seguir jugador") desde la cabecera de la sección Jugador y desde S8, recordado por usuario (`ui · followed_players`, lista de `player_id`), con un máximo configurable `my_team.max_followed`. · (US-7) (Esp. v2 §F-12 "jugadores seguidos"; Arq. §3.3)
- RF-23: S8 DEBE mostrar, por cada jugador seguido, su equipo, partidos, y sus métricas recientes (últimos 5 partidos) con enlace a su ficha; un jugador que ya no existe se muestra como no disponible con opción de dejar de seguirlo. · (US-7)

**Transversales**
- RF-24: Toda cifra de S8 DEBE formatearse con `core/format.js` (coma decimal es-UY); todo valor no calculable DEBE mostrarse "—" con su razón (C-11); ningún valor de rendimiento DEBE colorearse sin percentil válido (T-01). · (Esp. v2 §C-11, T-01; DA-36)
- RF-25: Si un bloque de S8 falla (por ejemplo, las alertas), los demás DEBEN seguir visibles y el bloque fallido DEBE mostrar su error con opción de reintentar. · (US-1)
- RF-26: S8 DEBE funcionar en móvil (<768 px) con los bloques apilados y estar en la barra inferior como primera sección prioritaria. · (Const. 7; Arq. §3.12)

## 5. Requisitos de datos / API

**Tablas** (Arq. §5; sin `ALTER` sobre tablas existentes):
| Tabla / columna | Tipo | Default | Vía | Estado |
|---|---|---|---|---|
| `fixtures` (`id` PK, `competition_id` INTEGER, `date` TEXT NOT NULL, `time` TEXT, `home_code` TEXT NOT NULL, `away_code` TEXT NOT NULL, `game_id` TEXT, `source_url` TEXT, `notes` TEXT, `created_at` TEXT, `created_by` TEXT) | tabla | — | `create_all` | **NUEVO** |
| `user_prefs` (`ui` · `home_team`, `followed_players`) | filas | — | las crea F-13 | existente (F-13), solo se usan |

**Endpoints:**
| Endpoint | Uso | Estado |
|---|---|---|
| `GET /api/my-team` | pantalla S8 en una llamada (equipo, próximo partido, plan de juego, alertas, accesos directos) | **NUEVO** (Arq. §6) |
| `GET /api/fixtures` · `POST /api/fixtures` (A) · `PATCH/DELETE /api/fixtures/<int:fixture_id>` (A) | calendario | **NUEVO** (Arq. §6) |
| `GET /api/game-plan` (F-17) | se extiende la referencia `rival_proximo` | existente (F-17), tocado |
| `GET/PUT/DELETE /api/prefs` (F-13) | equipo fijado y jugadores seguidos | existente (F-13), solo se usa |
| `POST /api/import` · `DELETE /api/games` | vinculan/desvinculan `fixtures.game_id` | existentes, tocados |

Errores: `400 parametro_invalido`, `403 requiere_admin`, `404 no_encontrado` (fixture o equipo), `404 sin_proximo_partido` (`rival_proximo` sin calendario). El contrato JSON detallado está en `plan.md` §3 y §8.

Claves de configuración que activa F-12: `alerts.lookback_days`, `alerts.change_z` (Arq. §3.2). Claves nuevas que propone: `my_team.last_games`, `my_team.top_lineups`, `my_team.max_followed` (PROPUESTA, ver §9).

## 6. Estados de UI

Vista: S8 Mi equipo (`#/mi-equipo`) y pestaña `calendario` de S1. Copy nuevo (agregar a `docs/frontend.md`; en español, F-21 lo extrae a diccionarios).

| Bloque | loading | vacío | error | sin conexión | éxito |
|---|---|---|---|---|---|
| Pantalla (sin equipo fijado) | — | "Elegí tu equipo para que la app arranque siempre en él." + selector + botón "Fijar como mi equipo" | — | — | — |
| Equipo fijado sin partidos | skeleton | "Tu equipo fijado ya no tiene partidos importados. Elegí otro." | — | — | — |
| Cabecera del equipo | skeleton | — | "No se pudo cargar tu equipo." + "Reintentar" | "Sin conexión: Mi equipo necesita conexión." | nombre · competencia · récord · dif. media · partidos · badge de muestra |
| Próximo partido | skeleton | sin calendario: "Todavía no hay calendario cargado."; sin futuros: "No hay próximos partidos cargados para tu equipo." (+ "Cargar calendario" si es admin) | "No se pudo cargar el próximo partido." | ídem | "Próximo partido · {rival} · {fecha} {hora} · Local/Visitante · faltan {n} días" + botón "Preparar partido" |
| Plan de juego | skeleton | "Sin ventajas ni riesgos destacables." (copy de F-17) | "No se pudo cargar el plan de juego." | ídem | panel F-17 plegable |
| Alertas | skeleton | sin partidos: "No hubo partidos en los últimos {n} días."; sin alertas: "Sin alertas en la última semana." | "No se pudieron cargar las alertas." | ídem | lista de insights y de cambios bruscos con valores y badge de muestra |
| Últimos partidos | skeleton | "Todavía no hay partidos." | "No se pudieron cargar los partidos." | ídem | filas fecha · rival · marcador · G/P · enlace |
| Quintetos más usados | skeleton | "Sin play-by-play: no se pueden armar quintetos." | "No se pudieron cargar los quintetos." | ídem | filas quinteto · minutos · muestra · enlace |
| Jugadores seguidos | skeleton | "No seguís a ningún jugador. Buscá uno y tocá 'Seguir'." | "No se pudieron cargar los jugadores." | ídem | tarjetas de jugador; "Jugador no disponible" con "Dejar de seguir" |
| Pestaña Calendario (S1) | skeleton | "El calendario está vacío." | "No se pudo cargar el calendario." | "Sin conexión: el calendario necesita conexión." | tabla de partidos futuros y pasados; formulario solo para administradores |
| Botón "Seguir" (cabecera de Jugador) | — | — | "No se pudo guardar." (toast) | se guarda local y reintenta | "Seguir" ⇄ "Siguiendo ✓" |

Mensajes del formulario de calendario (nuevo copy): "Elegí la fecha del partido.", "Elegí dos equipos distintos.", "Equipo desconocido: importá al menos un partido de ese equipo antes de cargarlo en el calendario.", "Solo un administrador puede modificar el calendario.", "Llegaste al máximo de {n} jugadores seguidos.".

Mobile (<768 px): bloques apilados en una columna en el orden cabecera → próximo partido → plan de juego → alertas → accesos directos; tarjetas de jugadores en carrusel horizontal; el formulario de calendario en una columna. Nav inferior fija con "Mi equipo" primera.

## 7. Criterios de aceptación

- CA-1 **(CA del cliente)**: Given un usuario con equipo fijado y la URL sin ruta, When abre la app, Then ve su equipo en S8 sin haber aplicado ningún filtro (URL `#/mi-equipo` sin parámetros, sin chips activos, competencia resuelta sola).
- CA-2: Given un usuario que fija el equipo CNF y otro usuario que fija PEN, When cada uno recarga (incluso desde otro navegador), Then cada uno abre en el suyo y el cambio de uno no altera el del otro.
- CA-3: Given un usuario sin equipo fijado, When abre la app, Then la sección inicial es la de X-01 (Datos o Liga), y al entrar a S8 ve el selector y el texto "Elegí tu equipo para que la app arranque siempre en él.".
- CA-4: Given un enlace con ruta explícita (`#/liga/ranking`), When un usuario con equipo fijado lo abre, Then se respeta la ruta y no se lo redirige a S8.
- CA-5: Given un partido futuro del equipo en el calendario, When abro S8, Then veo rival, fecha, hora, local/visitante y días restantes, y "Preparar partido" abre `#/partido/preparar?team=…&rival=…&fixture=…` con ambos equipos ya elegidos.
- CA-6: Given un calendario sin partidos futuros del equipo (o vacío), When abro S8, Then veo el estado vacío correspondiente y ningún rival inventado.
- CA-7: Given un partido del calendario con fecha de hoy, When abro S8 ese día, Then sigue siendo el próximo partido; Given la misma fecha de ayer, Then deja de serlo.
- CA-8: Given un partido del calendario no jugado, When importo el partido real (mismos equipos, fecha igual o ±1 día), Then el partido del calendario queda vinculado (`game_id`) y S8 muestra el siguiente; When borro ese partido importado, Then la vinculación se quita y vuelve a ser próximo si su fecha no pasó.
- CA-9: Given un usuario no administrador (con `ADMIN_USERS` definida), When intenta crear, editar o borrar un partido del calendario, Then recibe 403 `requiere_admin` y la UI no muestra los controles de escritura; Given un administrador, Then puede hacerlo.
- CA-10: Given el Plan de juego en S8, When lo comparo con `GET /api/game-plan?team=<equipo>&reference=<la misma>` y con el panel de la sección Equipo, Then los ítems son idénticos; When elijo la referencia "Rival del próximo partido" con partido cargado, Then el rival de la referencia es el del próximo partido, y sin partido cargado esa referencia no se ofrece (la API responde 404 `sin_proximo_partido`).
- CA-11: Given partidos del equipo dentro de los últimos 7 días, When veo "Alertas", Then los insights coinciden con `GET /api/insights?entity=team&id=<equipo>&last=<n>` (n = partidos de la ventana), y cada alerta de cambio brusco muestra valor de la semana, valor del resto, diferencia y partidos de cada lado; recalculando a mano esos dos valores con la tabla de partidos del equipo, coinciden.
- CA-12: Given que cambio `alerts.lookback_days` o `alerts.change_z` en Configuración (F-13), When recargo S8, Then la ventana y el umbral cambian de inmediato.
- CA-13: Given un equipo que no jugó en los últimos N días, When abro S8, Then las alertas muestran "No hubo partidos en los últimos N días." y no alertas de otra ventana.
- CA-14: Given una ventana de 1 o 2 partidos (menos que `sample.team.min`), When hay una alerta, Then lleva badge de muestra baja; Given una métrica nula en la ventana (por ejemplo sin pérdidas), Then no genera alerta.
- CA-15: Given los quintetos más usados de S8, When los comparo con la tabla de quintetos del equipo (`GET /api/table/team_lineups`) ordenada por minutos, Then son los mismos, en el mismo orden y con la misma muestra.
- CA-16: Given los últimos partidos de S8, When toco uno, Then abre S5 · Analizar de ese partido; el marcador y el resultado coinciden con el game log del equipo.
- CA-17: Given un jugador, When toco "Seguir" en su cabecera, Then aparece en S8 y sigue ahí tras recargar; When toco "Dejar de seguir", Then desaparece; Given el máximo `my_team.max_followed`, When intento seguir uno más, Then veo "Llegaste al máximo de {n} jugadores seguidos." y no se agrega.
- CA-18: Given un jugador seguido que fue fusionado (C-08) o eliminado, When abro S8, Then se muestra bajo su ficha vigente o como "Jugador no disponible" con "Dejar de seguir", sin romper la pantalla.
- CA-19: Given que el bloque de alertas falla (error 500 simulado), When abro S8, Then los demás bloques se ven y el de alertas muestra su error con "Reintentar".
- CA-20: Given un equipo con menos de `sample.team.min` partidos, When veo S8, Then el badge de muestra es "baja" y ninguna métrica se colorea por rendimiento.
- CA-21: Given la app abierta en un teléfono (360 px), When abro S8, Then los bloques se apilan sin scroll horizontal de página y "Mi equipo" es el primer botón de la barra inferior.
- CA-22: Given el servidor sin sesión, When pido `GET /api/my-team`, Then recibe 401; Given el modo abierto (sin `AUTH_USERS`), Then funciona y las preferencias quedan bajo el dueño `_open`.

## 8. Fuera de alcance

- Scraping o importación automática de fixtures de sitios de terceros (Arq. §3.19 "Descartadas").
- Notificaciones push o por correo de las alertas; las alertas se ven al abrir la app.
- Alertas sobre jugadores seguidos (solo se muestra su forma reciente) y sobre el rival.
- Más de un equipo propio por usuario o equipos "favoritos" distintos del propio.
- Vincular fichas de una misma persona en equipos distintos (fuera de v2, Arq. §3.4): seguir es por ficha (`player_id`).
- Datos en vivo en S8 (el partido en curso lo cubre F-01): S8 no consulta FIBA.
- Exportación de S8 (no pedida por el cliente).
- Edición masiva o importación CSV del calendario.
- Traducción del copy: la hace F-21 (esta spec usa español directo; ver `../14-F-21-multi-idioma/spec.md`).

## 9. Ambigüedades

- [DECISIÓN PROPUESTA — confirmar] **"La app arranca siempre en él"** se interpreta como: con equipo fijado y sin ruta en la URL, abre en S8; una URL con ruta explícita se respeta (CA-4). Sin equipo fijado se conserva la regla de X-01 (Datos o Liga) en lugar de forzar S8: X-01 RF-16 decía "si S8 está habilitada → Mi equipo", lo que mandaría a un usuario sin equipo a una pantalla vacía. Se ajusta esa regla (ver plan §10).
- [DECISIÓN PROPUESTA — confirmar] **Zona horaria de "hoy"**: hora de Uruguay (UTC−3 fijo; Uruguay no usa horario de verano), calculada en el servidor, porque el servidor corre en UTC.
- [DECISIÓN PROPUESTA — confirmar] **Ventana de la "última semana"**: partidos del equipo con fecha entre hoy−`alerts.lookback_days` y hoy. Los insights de A-10 se calculan con `last = n` (n = partidos de la ventana), porque el contexto T-03 expresa períodos como "últimos N partidos" y los partidos de la ventana son, por construcción, los últimos n del equipo. La población de percentiles es la de T-01 con ese mismo contexto.
- [DECISIÓN PROPUESTA — confirmar] **"Variación brusca"** no está definida por el cliente. Se define así: para cada métrica direccional del conjunto estándar de la lista fija del plan, `z = s·(valor_semana − media_resto)/desvío_resto`, donde `valor_semana` es el valor agrupado (pooled, DA-02) de los partidos de la ventana, `media_resto` y `desvío_resto` son la media y el desvío muestral de los valores por partido de los partidos anteriores a la ventana, y `s` = +1 si la métrica es "más es mejor" y −1 si "menos es mejor". Alerta si |z| ≥ `alerts.change_z` (default 1,5, PROPUESTA de la arquitectura). Se exige al menos `sample.team.min` partidos en el resto y desvío mayor que 0. No se divide por √n: es más conservador con ventanas de 1–2 partidos.
- [DECISIÓN PROPUESTA — confirmar] **Claves de configuración nuevas** `my_team.last_games` (5), `my_team.top_lineups` (3), `my_team.max_followed` (12) en la sección Preferencias: el cliente pide "ningún umbral fijo en el código" (F-13). No están en la tabla de la arquitectura (PROPUESTA).
- [DECISIÓN PROPUESTA — confirmar] **Equipos del calendario**: solo se aceptan equipos que ya tienen al menos un partido importado (los códigos salen de `/api/teams`), porque Preparar necesita historia del rival. Un rival nuevo requiere importar antes un partido suyo.
- [DECISIÓN PROPUESTA — confirmar] **Vinculación de partidos**: coincidencia de local y visitante exactos y fecha igual o ±1 día (la fecha que FIBA scrapea puede diferir por huso horario); si hay más de un candidato se vincula el de fecha más cercana y, a igualdad, el de menor id.
- [DECISIÓN PROPUESTA — confirmar] **Seguir jugadores de otros equipos**: se permite (el cliente dice "jugadores seguidos", no "jugadores propios") y se ordena por el orden en que se siguieron.
- [NEEDS CLARIFICATION] Si el cliente quiere que los jugadores seguidos generen alertas propias (hoy solo se muestra su forma reciente): cambia el alcance de A-10 (insights de jugador) y el volumen de la pantalla.
