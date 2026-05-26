const BASE = "";

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  importGame:    url  => apiFetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }),
  games:         ()   => apiFetch("/api/games"),
  teams:         ()         => apiFetch("/api/teams"),
  team:          code       => apiFetch(`/api/team/${encodeURIComponent(code)}`),
  players:       code       => apiFetch(`/api/players/${encodeURIComponent(code)}`),
  player:        (code, name) => apiFetch(`/api/player/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  playerShots:   (code, name) => apiFetch(`/api/shots/${encodeURIComponent(code)}/${encodeURIComponent(name)}`),
  league:        ()   => apiFetch("/api/league"),
  deleteGames:   (ids) => apiFetch("/api/games", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game_ids: ids }) }),
};
