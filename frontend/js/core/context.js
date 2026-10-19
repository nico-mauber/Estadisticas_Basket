// ── Contexto global de filtros (T-03, nivel partido) ─────────────────────────
// Sede, rival y descanso viajan en la URL (?venue=&opponent=&rest=, mismos nombres que la API),
// se recuerdan durante la sesión y se aplican a todas las vistas con estadísticas. El cálculo lo hace
// siempre el backend; acá solo se guarda la selección. `competition` y `last` los siguen manejando las
// vistas (selector de competencia y pills de últimos N).

export const VENUE_OPTIONS = [
  { key: "", label: "Todos" }, { key: "local", label: "Local" }, { key: "visitante", label: "Visitante" },
];
export const REST_OPTIONS = [
  { key: "", label: "Todos" }, { key: "0", label: "0 días" }, { key: "1", label: "1 día" },
  { key: "2", label: "2 días" }, { key: "3mas", label: "3 o más" },
];
const VALID = {
  venue: new Set(["local", "visitante"]),
  rest: new Set(["0", "1", "2", "3mas"]),
  opponent: null,   // texto libre (código de equipo); el servidor lo valida
};
const KEYS = Object.keys(VALID);
const STORAGE_KEY = "sb.ctx";

let _state = {};
const _listeners = new Set();

function _clean(obj) {
  const out = {};
  for (const k of KEYS) {
    const v = String(obj?.[k] ?? "").trim();
    if (!v) continue;
    if (VALID[k] && !VALID[k].has(v)) continue;
    out[k] = k === "opponent" ? v.toUpperCase() : v;
  }
  return out;
}

function _fromUrl() {
  const found = {};
  for (const q of [location.search, location.hash.split("?")[1] || ""]) {
    const p = new URLSearchParams(q);
    for (const k of KEYS) if (p.get(k)) found[k] = p.get(k);
  }
  return _clean(found);
}

function _load() {
  try { return _clean(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}")); } catch { return {}; }
}

function _persist() {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch { /* queda en memoria */ }
  try {
    const url = new URL(location.href);
    for (const k of KEYS) url.searchParams.delete(k);
    for (const [k, v] of Object.entries(_state)) url.searchParams.set(k, v);
    history.replaceState(history.state, "", url);
  } catch { /* la sesión sigue recordando el contexto */ }
}

// URL > sesión. Se llama una vez al armar la app.
export function initContext() {
  const fromUrl = _fromUrl();
  _state = Object.keys(fromUrl).length ? fromUrl : _load();
  _persist();
}

export const getContext = () => ({ ..._state });
export const activeCount = () => Object.keys(_state).length;

// Parámetros para la query de la API (`api.js` omite los vacíos).
export const contextParams = () => ({ ..._state });

export function setContext(patch) {
  _state = _clean({ ..._state, ...patch });
  _persist();
  _listeners.forEach(fn => fn(getContext()));
}

export function clearContext() {
  _state = {};
  _persist();
  _listeners.forEach(fn => fn(getContext()));
}

export function onContextChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Un 400 `contexto_invalido` nombra el parámetro (details.param): se limpia solo ese. Devuelve true si
// había algo que limpiar (el llamador reintenta); false si el error no es de contexto.
export function dropInvalid(err) {
  if (err?.code !== "contexto_invalido") return false;
  const param = err.details?.param;
  if (param && param in _state) {
    const next = { ..._state };
    delete next[param];
    _state = next;
  } else if (!param && activeCount()) {
    _state = {};
  } else {
    return false;
  }
  _persist();
  return true;
}
