// ── Base de normalización (T-04) ─────────────────────────────────────────────
// Una sola elección compartida por todas las vistas durante la sesión del navegador
// (sessionStorage) y en la URL (?base=) para compartir la vista. Sin elección: el default
// de configuración `ui.default_base`. El escalado lo hace siempre el backend.
import { api } from "../api.js";

export const BASE_OPTIONS = [
  { key: "total", label: "Totales", title: "Totales de la selección" },
  { key: "partido", label: "Por partido", title: "Promedio por partido" },
  { key: "por40", label: "Por 40'", title: "Por 40 minutos" },
  { key: "por100", label: "Por 100 pos.", title: "Por 100 posesiones" },
];
const KEYS = new Set(BASE_OPTIONS.map(o => o.key));
const STORAGE_KEY = "sb.base";
let _base = null;

function _fromUrl() {
  const candidates = [location.search, location.hash.split("?")[1] || ""];
  for (const q of candidates) {
    const v = new URLSearchParams(q).get("base");
    if (KEYS.has(v)) return v;
  }
  return null;
}

function _load() {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return KEYS.has(v) ? v : null;
  } catch { return null; }
}

function _save(v) {
  try { sessionStorage.setItem(STORAGE_KEY, v); } catch { /* sin storage: queda en memoria */ }
}

function _syncUrl(v) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("base", v);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar: la sesión sigue recordando la base */ }
}

export async function initBase() {
  const fromUrl = _fromUrl();
  if (fromUrl) {
    _base = fromUrl;
    _save(fromUrl);
    return _base;
  }
  _base = _load();
  if (_base) return _base;
  try {
    const s = await api.settings();
    const v = s?.values?.["ui.default_base"];
    _base = KEYS.has(v) ? v : "partido";
  } catch {
    _base = "partido";
  }
  return _base;
}

export function getBase() {
  return _base || _load() || "partido";
}

export function setBase(v) {
  if (!KEYS.has(v)) return;
  _base = v;
  _save(v);
  _syncUrl(v);
}
