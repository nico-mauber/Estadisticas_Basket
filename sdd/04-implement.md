# Paso 4 — IMPLEMENT

> Objetivo: ejecutar tasks.md hasta que todos los criterios de aceptación del spec pasen y los gates técnicos estén en verde. Único paso que escribe código de producción.

## Entrada
- `sdd/specs/NN-<feature>/tasks.md` (gate del Paso 3 pasado).
- spec.md y plan.md de la feature (referencia constante).
- docs/ (fuente de reglas y contratos; consultar ante cualquier duda).

## Salida
- Código de producción en `backend/` y/o `frontend/` según el plan.
- `sdd/specs/NN-<feature>/progress.md` (bitácora de la feature).

```markdown
# Progress — Feature NN: <nombre>

## Estado de tareas
Copia del checklist de tasks.md con [x] los completados.

## Estado de CA (gate de aceptación)
Tabla: CA-n | ✅/❌ | evidencia (curl/comando/captura/paso a paso seguido en navegador).

## Gates técnicos
- Backend arranca sin traceback: ✅/❌
- `upgrade_db()` idempotente (si tocó esquema): ✅/❌
- Endpoints probados manualmente: ✅/❌
- Consola del navegador sin errores JS: ✅/❌

## Desviaciones respecto a docs/ o plan
Qué cambió, por qué, e impacto en features futuras.

## Docs a actualizar
Qué archivo(s) de docs/ (api.md, database.md, frontend.md, metrics.md, architecture.md) quedaron desactualizados por esta feature y deben sincronizarse.

## Deuda / TODO
Pendientes conscientes.
```

## Protocolo de ejecución
1. Ejecutar tareas en el orden de tasks.md; marcar cada una al terminar con su `Done:` verificado.
2. **Fidelidad al plan**: implementar lo que dice plan.md. Si el plan estaba mal → corregir el plan primero (breve), no divergir en silencio.
3. **Consultar docs/ para reglas exactas**: fórmulas de métricas, formatos de respuesta, restricciones de esquema y copy de UI se toman de docs/, no de memoria. Nunca inventar un endpoint o columna.
4. **Capas y Constitución**: rutas Flask delgadas → módulos backend; UI → `api.js` → fetch; métricas siempre on-the-fly en `stats_engine.py`; esquema solo vía `upgrade_db()`; español.
5. **Reusar** funciones/helpers ya construidos (revisar progress.md de features anteriores y docs/frontend.md).
6. Commits pequeños, uno por tarea o grupo lógico. Mensajes en imperativo.

## Gate de salida de feature (todos en verde para cerrar)
- [ ] Todas las tareas de tasks.md completadas.
- [ ] **Cada CA del spec verificado ✅** (evidencia en progress.md) — este es el gate duro.
- [ ] Backend arranca sin traceback.
- [ ] `upgrade_db()` corrido 2 veces sin error (si tocó esquema).
- [ ] Endpoints nuevos/tocados probados (curl o navegador) contra el response shape del plan.
- [ ] Consola del navegador sin errores JS.
- [ ] Estados loading/vacío/error/offline implementados con el copy literal del spec.
- [ ] Sin endpoint/columna inventada fuera de docs/ — o docs/api.md y docs/database.md actualizados con lo nuevo.
- [ ] Desviaciones registradas en progress.md.
- [ ] docs/ sincronizados (o pendiente explícito en progress.md § "Docs a actualizar").

Al cerrar la feature → volver al Paso 1 con la siguiente.

## Verificación de CA (cómo)
- No hay test suite automatizado: preferir prueba real de comportamiento sobre "el código parece correcto".
- Para endpoints: `curl` contra `http://localhost:5000/api/...` (con `-b`/`-c` para cookie de sesión si la ruta está gateada por login) y comparar el JSON contra el plan.
- Para flujos de usuario: recorrer la vista en el navegador (`python backend/app.py` + `http://localhost:5000`) y observar el resultado que el CA describe; revisar la consola del navegador.
- Para reglas de negocio (fórmulas de métricas, zonas de tiro, upsert idempotente): probar el caso borde exacto del spec (ej. reimportar el mismo `game_id` dos veces → no duplica; tiro sin coordenadas → cae en `top_key_3`/`mid_top`).
