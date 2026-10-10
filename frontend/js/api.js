const BASE = "";

// Called when any gated request returns 401 (expired/missing session).
// app.js registers a handler to bounce the user back to the login screen.
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

const JSON_HEADERS = { "Content-Type": "application/json" };
const send = (path, method, body) => apiFetch(path, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
const qs = params => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
  return q ? `?${q}` : "";
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, { credentials: "same-origin", ...opts });
  if (res.status === 401 && _onUnauthorized && path !== "/api/login") {
    _onUnauthorized();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || res.statusText);
    e.code = err.code || null;
    e.details = err.details || null;
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export const api = {
  // Auth
  login:         (user, password) => apiFetch("/api/login",  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, password }) }),
  logout:        ()   => apiFetch("/api/logout", { method: "POST" }),
  me:            ()   => apiFetch("/api/me"),
  // Data
  importGame:    url  => apiFetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
  games:         (comp) => apiFetch(`/api/games${qs({ competition: comp })}`),
  teams:         ()         => apiFetch("/api/teams"),
  team:          (code, params = {}) => apiFetch(`/api/team/${encodeURIComponent(code)}${qs(params)}`),
  players:       (code, params = {}) => apiFetch(`/api/players/${encodeURIComponent(code)}${qs(params)}`),
  playerById:    (id, params = {})   => apiFetch(`/api/player/${encodeURIComponent(id)}${qs(params)}`),
  player:        (code, name, params = {}) => apiFetch(`/api/player/${encodeURIComponent(code)}/${encodeURIComponent(name)}${qs(params)}`),
  playerShots:   (code, name) => apiFetch(`/api/shots/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  teamShots:     code       => apiFetch(`/api/shots/${encodeURIComponent(code)}`),
  searchPlayers: (params = {}) => apiFetch(`/api/search/players${qs(params)}`),
  mergePlayers:  (targetId, sourceId) => send("/api/identity/merge", "POST", { target_id: targetId, source_id: sourceId }),
  // Cierres: "all" (todas las competencias) se envía como "sin parámetro": este endpoint no entiende "all"
  clutchTeam:    (team, comp) => apiFetch(`/api/clutch/${encodeURIComponent(team)}${qs({ competition: comp === "all" ? "" : comp })}`),
  lineup:        (code, players) => apiFetch(`/api/lineup/${encodeURIComponent(code)}?players=${players.map(encodeURIComponent).join("|")}`),
  onoff:         (code, name) => apiFetch(`/api/onoff/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  league:        (comp) => apiFetch(`/api/league${qs({ competition: comp })}`),
  deleteGames:   (ids) => send("/api/games", "DELETE", { game_ids: ids }),
  seed:          ()   => apiFetch("/api/seed", { method: "POST" }),
  // Datos: competencias, calidad y reproceso (F-11)
  competitions:      (includeHidden) => apiFetch(`/api/competitions${includeHidden ? "?include_hidden=1" : ""}`),
  createCompetition: body         => send("/api/competitions", "POST", body),
  updateCompetition: (id, body)   => send(`/api/competitions/${id}`, "PATCH", body),
  mergeCompetition:  (id, srcId)  => send(`/api/competitions/${id}/merge`, "POST", { source_id: srcId }),
  assignGame:        (gid, compId) => send(`/api/games/${encodeURIComponent(gid)}`, "PATCH", { competition_id: compId }),
  dataQuality:       comp         => apiFetch(`/api/data-quality${qs({ competition: comp })}`),
  reprocess:         body         => send("/api/reprocess", "POST", body),
  // Configuración (F-13)
  settings:          ()           => apiFetch("/api/settings"),
  saveSettings:      values       => send("/api/settings", "PUT", { values }),
  resetSettings:     body         => send("/api/settings/reset", "POST", body),
  prefs:             scope        => apiFetch(`/api/prefs${qs({ scope })}`),
  savePref:          (scope, key, value) => send("/api/prefs", "PUT", { scope, key, value }),
  deletePref:        (scope, key) => apiFetch("/api/prefs", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ scope, key }) }),
  // Conjunto estándar de métricas (T-05)
  metricsCatalog:    ()                  => apiFetch("/api/metrics-catalog"),
  metrics:           (type, params = {}) => apiFetch(`/api/metrics/${encodeURIComponent(type)}${qs(params)}`),
  // Confiabilidad de muestra (T-02)
  calibrate:         (entity, competition) => send("/api/settings/calibrate", "POST", { entity, competition }),
};
