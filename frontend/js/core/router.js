// ── Direcciones de la app (X-01) ─────────────────────────────────────────────
// La sección, la entidad y la pestaña viajan en el hash: `#/<sección>[/<id>][/<pestaña>]`. Los filtros viajan en la query
// de la dirección (`?competition=&last=&venue=…`), que ya usan el contexto global (T-03) y varios paneles. Abrir o recargar
// una dirección reconstruye la vista; Atrás y Adelante recorren las secciones, entidades y pestañas visitadas.

// id de sección interno → nombre en la dirección
export const SLUGS = {
  import: "datos", league: "liga", team: "equipo", player: "jugador", compare: "comparar",
  search: "explorar", preparar: "preparar", partido: "partido", config: "configuracion",
};
const SECTION_OF = Object.fromEntries(Object.entries(SLUGS).map(([k, v]) => [v, k]));

// Secciones cuyo segundo tramo es una entidad (equipo, jugador, partido); en el resto es la pestaña.
const ENTITY_SECTIONS = new Set(["team", "player", "partido"]);

// Direcciones del formato viejo (hash plano) que pueden haber quedado guardadas.
const LEGACY = { "#import": "import", "#league": "league", "#team": "team", "#compare": "compare", "#player": "player", "#search": "search" };

/** `#/equipo/ALB/tiro` → `{section: "team", id: "ALB", tab: "tiro"}`; `null` si no hay dirección; `{invalid: true}` si la
 *  sección no existe. Un hash plano viejo se traduce a su sección nueva. */
export function parseRoute(hash = location.hash) {
  const h = String(hash || "").split("?")[0];
  if (!h || h === "#" || h === "#/") return null;
  if (LEGACY[h]) return { section: LEGACY[h], id: null, tab: null, legacy: true };
  const m = /^#\/([^/]+)(?:\/([^/]*))?(?:\/([^/]*))?/.exec(h);
  if (!m) return { invalid: true };
  const section = SECTION_OF[decodeURIComponent(m[1])];
  if (!section) return { invalid: true, slug: m[1] };
  const a = m[2] ? decodeURIComponent(m[2]) : null;
  const b = m[3] ? decodeURIComponent(m[3]) : null;
  return ENTITY_SECTIONS.has(section) ? { section, id: a, tab: b } : { section, id: null, tab: a };
}

export function buildHash({ section, id = null, tab = null }) {
  const parts = [SLUGS[section] || section];
  if (ENTITY_SECTIONS.has(section)) {
    if (id != null && id !== "") parts.push(encodeURIComponent(id));
    if (tab && parts.length > 1) parts.push(encodeURIComponent(tab));
  } else if (tab) {
    parts.push(encodeURIComponent(tab));
  }
  return "#/" + parts.join("/");
}

export const routeKey = r => `${r.section}|${r.id ?? ""}|${r.tab ?? ""}`;

let _lastKey = null;   // la última dirección que escribió la app: decide si el cambio es un paso nuevo del historial

/** Escribe la dirección (y, si se pasa, los parámetros de la query: `null`/`""` los quita). Un cambio de sección, entidad
 *  o pestaña es un paso del historial; un cambio solo de filtros reemplaza el paso actual. */
export function writeRoute(route, query = {}) {
  try {
    const url = new URL(location.href);
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === "" || v === 0) url.searchParams.delete(k);
      else url.searchParams.set(k, String(v));
    }
    url.hash = buildHash(route);
    const key = routeKey(route);
    const same = _lastKey == null ? url.hash === location.hash : key === _lastKey;
    _lastKey = key;
    const next = url.pathname + url.search + url.hash;
    if (next === location.pathname + location.search + location.hash) return;
    history[same ? "replaceState" : "pushState"](history.state, "", next);
  } catch { /* la vista sigue funcionando sin dirección */ }
}

/** Parámetros de la query de la dirección actual. */
export function routeQuery() {
  try {
    const q = new URL(location.href).searchParams;
    return { competition: q.get("competition"), last: q.get("last") };
  } catch { return { competition: null, last: null }; }
}

/** Llama a `fn` cuando el usuario cambia la dirección (Atrás, Adelante o edición manual). */
export function onRouteChange(fn) {
  const handler = () => fn();
  window.addEventListener("popstate", handler);
  window.addEventListener("hashchange", handler);
  return () => { window.removeEventListener("popstate", handler); window.removeEventListener("hashchange", handler); };
}

export function markRouteKey(key) { _lastKey = key; }
