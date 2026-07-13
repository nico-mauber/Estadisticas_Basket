const BASE = "";

// Called when any gated request returns 401 (expired/missing session).
// app.js registers a handler to bounce the user back to the login screen.
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) { _onUnauthorized = fn; }

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, { credentials: "same-origin", ...opts });
  if (res.status === 401 && _onUnauthorized && path !== "/api/login") {
    _onUnauthorized();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
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
  games:         ()   => apiFetch("/api/games"),
  teams:         ()         => apiFetch("/api/teams"),
  team:          code       => apiFetch(`/api/team/${encodeURIComponent(code)}`),
  players:       code       => apiFetch(`/api/players/${encodeURIComponent(code)}`),
  player:        (code, name) => apiFetch(`/api/player/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  playerShots:   (code, name) => apiFetch(`/api/shots/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  searchPlayers: ()   => apiFetch("/api/search/players"),
  clutchTeam:    team => apiFetch(`/api/clutch/${encodeURIComponent(team)}`),
  lineup:        (code, players) => apiFetch(`/api/lineup/${encodeURIComponent(code)}?players=${players.map(encodeURIComponent).join("|")}`),
  onoff:         (code, name) => apiFetch(`/api/onoff/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  league:        (comp) => apiFetch(`/api/league${comp ? `?competition=${encodeURIComponent(comp)}` : ""}`),
  competitions:  ()   => apiFetch("/api/competitions"),
  deleteGames:   (ids) => apiFetch("/api/games", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game_ids: ids }) }),
  seed:          ()   => apiFetch("/api/seed", { method: "POST" }),
};
