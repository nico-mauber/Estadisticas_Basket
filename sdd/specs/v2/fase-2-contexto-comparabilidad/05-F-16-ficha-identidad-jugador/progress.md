# Progress — F-16: Ficha de identidad del jugador

> **Estado:** ✅ Implementado (cabecera de identidad en la vista Jugador, datos manuales con edición de administrador)
> **Fecha:** 2026-10-21

## Estado de tareas
- [x] RF-1 · La cabecera de identidad se dibuja antes que cualquier card de métricas
- [🔶] RF-2 · Nombre completo, dorsal, posición, club, foto, altura, año y nacionalidad en la cabecera (no hay pestaña `ficha` propia: sin router X-01 la ficha vive en la cabecera)
- [x] RF-3 · Dorsal y posición salen de `identity.player_card` (partido más reciente / valor más frecuente)
- [x] RF-4 · Línea "<competencia> · <equipo> · N partidos" con los partidos de la selección activa (respeta `last`, sede, rival y descanso de T-03)
- [x] RF-5 · Dato no publicado ni cargado → "—" con razón `no_registrado` y tooltip explicativo
- [x] RF-6 · Un administrador carga y corrige altura, año de nacimiento, nacionalidad y notas
- [x] RF-7 · Los datos pertenecen a la ficha (C-08), no a un partido: sobreviven a reimportaciones y reprocesos
- [x] RF-8 · "Editado el <fecha> por <usuario>"
- [x] RF-9 · Sin permiso no hay botón de edición; el `PUT` exige `admin_required`
- [x] RF-10 · Editar sube la versión de datos (`cache.bump_data_version`)
- [x] RF-11 · `competitions[]` con las competencias del jugador
- [x] RF-12 · Los datos personales no entran en las tablas de T-06 ni en la exportación masiva
- [🔶] RF-13 · Altura en metros con coma ("1,98 m"); sin `t()` (F-21)

## Estado de CA (gate de aceptación)
| CA | Estado | Evidencia |
|---|---|---|
| CA-1 (cliente) | ✅ | Chromium: la identidad precede a la primera card de métricas (`compareDocumentPosition`) |
| CA-2 | ✅ | "Liga de Ascenso 2026 · LAGOMAR · 2 partidos"; con `last=1` dice "1 partido"; con `venue=local` baja a 1 |
| CA-3 | ✅ | Sin datos manuales: "—" con tooltip y `fields_null_reasons.height_cm == "no_registrado"` |
| CA-4 | ✅ | Altura 198 → "1,98 m", 1999, "Uruguay" y "Editado el 21/10/2026 por _open"; sobrevive a subir la versión de datos |
| CA-5 | ✅ | Altura 300 → 400 "La altura debe estar entre 140 y 240 cm." y la ficha no cambia; vaciar la nacionalidad vuelve a "—" |

## Gates técnicos
- Backend arranca sin traceback: ✅
- `upgrade_db()` idempotente: ✅ (corre dos veces sin error; 6 columnas nuevas en `players`)
- Consola del navegador sin errores JS: ✅ (1280 y 360 px)
- Verificación: `f16_sim.py` 24/24, `f16_browser.py` 30/30, regresión completa en verde

## Desviaciones respecto a docs/ o plan
- **Sin pestaña `ficha`:** no hay router X-01; la identidad y los datos de ficha van en la cabecera de la vista Jugador, visible en todo momento.
- **Un endpoint, no dos vistas:** `player_profile` compone sobre `identity.player_card` como pide el plan.
- **Validación en los dos lados:** el formulario usa `min`/`max`, que el navegador bloquea antes de enviar; se muestra el MISMO mensaje que devuelve el backend para que el usuario no vea dos textos distintos.
- **Reemplaza el encabezado de F-08:** la cabecera simple (nombre, equipo, partidos) que se agregó al arreglar la navegación del plantel queda absorbida por esta.

## Docs actualizados
- ✅ `docs/api.md` · ✅ `docs/frontend.md`

## Deuda / TODO
- Pestaña `ficha` propia cuando exista X-01.
- `t()` para el copy (F-21).
- La foto sale de FIBA (`players.photo_url`); no hay carga manual de foto.
