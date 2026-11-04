# Progress — X-01: Reorganización de la navegación en secciones y pestañas

> **Estado:** 🔶 Implementado sobre `app.js` sin partirlo en vistas: direcciones con deep links e historial, pestañas en Equipo, Jugador y Liga, barra con "Más" en móvil y avisos de dirección inválida. Faltan las secciones y pestañas de requisitos posteriores, la partición en `views/` y el panel plegable genérico.
> **Fecha:** 2026-11-03

## Qué se hizo
- `core/router.js`: `#/<sección>[/<id>][/<pestaña>]`, historial (un paso por sección, entidad o pestaña; los filtros reemplazan), redirección de hashes viejos y lectura de la query de la dirección.
- `components/tabs.js`: fila de pestañas desplazable y `applyTabs` / `watchTabs` sobre bloques marcados con `data-tabs`.
- Pestañas en **Equipo** (Resumen, Plantel, Tiro, Posesión, Quintetos, Momentos, Game log), **Jugador** (Resumen, Tiro, Posesión, Game log) y **Liga** (Tabla, Ranking, Mapa); **Datos** y **Comparar** ya tenían pestañas y ahora tienen dirección.
- Deep links de equipo, jugador, partido y de las demás secciones; los filtros de la vista (`competition`, `last`) y el contexto global viajan en la query.
- Barra: "Datos", "Explorar"; en móvil 4 secciones + "Más" con una hoja (Datos, Explorar, Preparar, Configuración).
- Sección inicial: Datos si la base está vacía, Liga › Tabla si no.
- Avisos en español para sección, pestaña, equipo o jugador inexistentes, con recuperación.
- `sw.js` v52 (`router.js` y `tabs.js` en `STATIC`).

## Estado de CA
`x01_browser.py` 44/44 (1280 y 360 px, sin errores de consola).

| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | 🔶 | la barra muestra Datos, Liga, Equipo, Jugador, Comparar, Explorar y Preparar (Preparar se conserva: F-03 vive hoy en su propia sección); sin Partido ni Mi equipo; Configuración por el engranaje y por "Más" |
| CA-2 | ✅ | `#/equipo/<code>/quintetos` y recarga con el mismo equipo y pestaña |
| CA-3 | ✅ | `last=3` viaja en la dirección y otra sesión lo abre aplicado |
| CA-4 | ✅ | Atrás y Adelante recorren pestañas y llegan hasta Liga |
| CA-5 | 🔶 | cada función sigue accesible; Calidad y Competencias están en Datos; Partidos y Exportar no son pestañas aparte (el catálogo está en Importar) |
| CA-6 | ✅ | a 360 px: Liga, Equipo, Jugador, Comparar y "Más" (Datos, Explorar, Preparar, Configuración) |
| CA-7 | ✅ | fila de pestañas desplazable, la activa visible, sin scroll horizontal de página |
| CA-8 | ✅ | `#/equipo/NOEXISTE/resumen` avisa y deja el selector |
| CA-9 | 🔶 | pestaña o sección inexistente avisa y abre la por defecto; `#/partido/<id>` abre el análisis de partido (ya existe) |
| CA-10 | ✅ | sin dirección abre Liga › Tabla con partidos |
| CA-11 | ✅ | fila del ranking → `#/equipo/<code>/resumen`; fila del plantel → `#/jugador/<id>/resumen` |
| CA-12 | ✅ | `#search` → `#/explorar/jugadores` |
| CA-13 | ⬜ | sin conexión: la cáscara sale del service worker (`router.js` y `tabs.js` agregados); no se probó el modo sin red |
| CA-14 | ⬜ | panel plegable genérico no hecho (el plan de juego guarda su estado por usuario con `panel.collapsed`) |
| CA-15 | ⬜ | Configuración sin pestañas (formulario único) |
| CA-16 | ✅ | los nulos no se tocaron |

## Desviaciones
- **Sin partir `app.js` en `views/`:** la reorganización se hace sobre el monolito, con bloques marcados por `data-tabs`. Reduce el riesgo de regresión; la partición queda para después.
- **Los filtros van en la query y la vista en el hash** (`/?last=3#/equipo/ALB/resumen`), no dentro del hash: el contexto global y varios paneles ya leían y escribían la query.
- **Mapa de tiro del equipo queda en Resumen** (boceto del cliente de la pestaña Equipo); Tiro agrupa el mapa de un jugador. El especificado "Tiro con mapa del equipo" no se movió.
- **Plantel, Posesión y Momentos** son pestañas de Equipo adicionales a la lista de X-01 porque ya existen los bloques de F-08, A-02…A-05 y F-04.
- **Preparar** conserva su botón. Partido no tiene botón y se abre desde el catálogo o el análisis.
- **Jugador:** sin pestañas Distribución e Impacto (el contenido queda en Resumen; ON/OFF sigue en Equipo › Quintetos).
- **Datos:** sin pestañas Partidos y Exportar separadas.
- **Configuración** sin pestañas.
- **Copy** sin `t()` (F-21 pendiente).

## Docs actualizados
- ✅ `docs/frontend.md` · ✅ `docs/architecture.md`
