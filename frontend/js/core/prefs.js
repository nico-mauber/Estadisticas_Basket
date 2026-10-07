/**
 * Preferencias por usuario con copia local — F-13.
 * Lectura sincrónica (localStorage); escritura optimista + API.
 */
import { api } from "../api.js";

const _mem = {};
const PREFIX = "sb.prefs.";

function _lsGet(scope) {
  try { return JSON.parse(localStorage.getItem(PREFIX + scope)) || {}; } catch { return {}; }
}

function _lsSet(scope, data) {
  try { localStorage.setItem(PREFIX + scope, JSON.stringify(data)); } catch { /* sin storage */ }
}

export async function loadPrefs(scope) {
  try {
    const res = await api.prefs(scope);
    _mem[scope] = res.values || {};
    _lsSet(scope, _mem[scope]);
  } catch {
    _mem[scope] = _lsGet(scope);
  }
  return _mem[scope];
}

export function getPref(scope, key, def = null) {
  if (_mem[scope] && key in _mem[scope]) return _mem[scope][key];
  const ls = _lsGet(scope);
  return key in ls ? ls[key] : def;
}

export async function setPref(scope, key, value) {
  if (!_mem[scope]) _mem[scope] = _lsGet(scope);
  _mem[scope][key] = value;
  _lsSet(scope, _mem[scope]);
  try { await api.savePref(scope, key, value); } catch { /* conserva local */ }
}
