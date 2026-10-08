// ── Catálogo estándar de métricas (T-05) ────────────────────────────────────
// Una sola petición por carga de página (`loadCatalog` memoizada); el resto de los
// helpers son síncronos una vez resuelta esa promesa (`catalog` a nivel de módulo).

import { api } from "../api.js";

const SESSION_KEY = "sb.metrics-catalog";

let catalog = null;
let _promise = null;
let _legacyMap = null;

function _buildLegacyMap(cat) {
  const map = {};
  for (const [key, def] of Object.entries(cat.metrics)) {
    for (const legacy of def.legacy_keys || []) map[legacy] = key;
  }
  return map;
}

export function loadCatalog() {
  if (_promise) return _promise;
  _promise = api.metricsCatalog().then(cat => {
    catalog = cat;
    _legacyMap = _buildLegacyMap(cat);
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(cat)); } catch {}
    return cat;
  }).catch(err => {
    try {
      const cached = sessionStorage.getItem(SESSION_KEY);
      if (cached) {
        catalog = JSON.parse(cached);
        _legacyMap = _buildLegacyMap(catalog);
        return catalog;
      }
    } catch {}
    _promise = null;   // permite reintentar en la próxima llamada
    throw err;
  });
  return _promise;
}

export function metricDef(key) {
  return catalog?.metrics?.[key] ?? null;
}

export function metricLabel(key) {
  return metricDef(key)?.label ?? key;
}

export function groupsFor(entityType) {
  if (!catalog) return [];
  return catalog.groups
    .map(g => ({
      key: g.key,
      label: g.label,
      metrics: g.metrics.filter(k => catalog.metrics[k]?.entities?.includes(entityType)),
    }))
    .filter(g => g.metrics.length > 0);
}

export function stdKeyFor(legacyKey) {
  return _legacyMap?.[legacyKey] ?? null;
}
