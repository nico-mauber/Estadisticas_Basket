# Progress — X-01: Reorganización de la navegación en secciones y pestañas

> **Estado:** ⬜ No iniciado

## Estado de tareas
- [ ] T-B1 · `core/router.js` (registro, parseo, navegación)
- [ ] T-B2 · Resolución de rutas (inicial, legado, inválidas, picker)
- [ ] T-B3 · Conservación de query y última entidad
- [ ] T-B4 · `core/ui.js` (PROPUESTA)
- [ ] T-B5 · `components/tabs.js`
- [ ] T-B6 · `components/collapsible.js`
- [ ] T-B7 · `components/nav.js` (PROPUESTA) + hoja "Más"
- [ ] T-B8 · `views/_shared.js` (PROPUESTA)
- [ ] T-C1 · Sin `fetch()` fuera de `api.js`
- [ ] T-D1 · `views/datos.js`
- [ ] T-D2 · `views/liga.js`
- [ ] T-D3 · `views/comparar.js`
- [ ] T-D4 · `views/explorar.js`
- [ ] T-D5 · `views/equipo.js` picker + cabecera + caché
- [ ] T-D6 · `views/equipo.js` Resumen
- [ ] T-D7 · `views/equipo.js` Tiro, Quintetos, Momentos, Game log
- [ ] T-D8 · `views/jugador.js`
- [ ] T-D9 · `views/configuracion.js` + quitar engranaje
- [ ] T-D10 · Cáscaras `partido.js` y `mi-equipo.js`
- [ ] T-D11 · `app.js` reducido
- [ ] T-D12 · CSS nav/tabs/collapsible
- [ ] T-D13 · Copy con `t()`
- [ ] T-E1 · Estados sin entidad / inexistente / offline
- [ ] T-E2 · `sw.js` runtime caching
- [ ] T-E3 · Renders solapados
- [ ] T-F1 … T-F19 · Verificación
- [ ] T-G1 … T-G3 · (diferido)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 | ⬜ | |
| CA-2 | ⬜ | |
| CA-3 | ⬜ | |
| CA-4 | ⬜ | |
| CA-5 | ⬜ | |
| CA-6 | ⬜ | |
| CA-7 | ⬜ | |
| CA-8 | ⬜ | |
| CA-9 | ⬜ | |
| CA-10 | ⬜ | |
| CA-11 | ⬜ | |
| CA-12 | ⬜ | |
| CA-13 | ⬜ | |
| CA-14 | ⬜ | |
| CA-15 | ⬜ | |
| CA-16 | ⬜ | |

## Gates técnicos
- Backend arranca sin traceback: ⬜
- `upgrade_db()` idempotente (si aplica): ⬜ (N/A: sin cambios de esquema)
- Endpoints probados manualmente: ⬜
- Consola del navegador sin errores JS: ⬜

## Desviaciones respecto a docs/ o plan

## Docs a actualizar
- `docs/frontend.md` — §Vistas (9 secciones, pestañas, rutas hash; corrige D-03), estructura `core/`/`components/`/`views/`, §`app.js`, §Service Worker (runtime caching y versión de `CACHE`), §Responsive (4 + "Más"), copy nuevo de navegación.
- `docs/architecture.md` — vistas del frontend (corrige D-21) y organización en módulos ES.

## Deuda / TODO
