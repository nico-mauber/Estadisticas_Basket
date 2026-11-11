// Controles de Mi equipo (F-12): fijar el equipo propio y seguir jugadores. Son preferencias por usuario (`ui · home_team`,
// `ui · followed_players`): se guardan en el servidor y quedan con copia local para abrir la app sin esperar la red.
import { api } from "../api.js";
import { getPref, loadPrefs } from "../core/prefs.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _maxFollowed = null;

async function _max() {
  if (_maxFollowed != null) return _maxFollowed;
  try {
    const s = await api.settings();
    const v = (s.values || {})["my_team.max_followed"];
    _maxFollowed = Number.isFinite(Number(v)) ? Number(v) : 12;
  } catch { _maxFollowed = 12; }
  return _maxFollowed;
}

/** Guarda una preferencia del scope `ui` en el servidor y en la copia local. Lanza si el servidor la rechaza. */
export async function saveUiPref(key, value) {
  await api.savePref("ui", key, value);
  await loadPrefs("ui");
}

export const homeTeam = () => getPref("ui", "home_team", null);
export const followedPlayers = () => {
  const v = getPref("ui", "followed_players", []);
  return Array.isArray(v) ? v.filter(x => Number.isInteger(x)) : [];
};

/** Botón «Fijar como mi equipo» ⇄ «Es tu equipo ✓» (cabecera de Equipo). */
export function homeTeamButton(el, { teamCode, toast } = {}) {
  if (!el || !teamCode) return;
  const draw = () => {
    const mine = homeTeam() === teamCode;
    el.innerHTML = `<button type="button" class="btn btn-ghost btn-sm mt-home${mine ? " mt-on" : ""}" aria-pressed="${mine}"
      title="${mine ? "La app abre en Mi equipo con este equipo" : "La app va a abrir siempre en este equipo"}">${mine ? "⭐ Es tu equipo ✓" : "☆ Fijar como mi equipo"}</button>`;
    el.querySelector("button").addEventListener("click", async () => {
      const btn = el.querySelector("button");
      btn.disabled = true;
      try {
        await saveUiPref("home_team", mine ? null : teamCode);
        toast?.(mine ? "Quitaste el equipo fijado." : "Listo: la app va a abrir en tu equipo.");
      } catch (e) {
        toast?.(e.message || "No se pudo guardar.", "err");
      }
      draw();
    });
  };
  draw();
}

/** Botón «Seguir» ⇄ «Siguiendo ✓» (cabecera de Jugador). */
export function followButton(el, { playerId, toast, onChange } = {}) {
  if (!el || playerId == null) return;
  const id = Number(playerId);
  const draw = () => {
    const on = followedPlayers().includes(id);
    el.innerHTML = `<button type="button" class="btn btn-ghost btn-sm mt-follow${on ? " mt-on" : ""}" aria-pressed="${on}">${on ? "Siguiendo ✓" : "Seguir"}</button>`;
    el.querySelector("button").addEventListener("click", async () => {
      const btn = el.querySelector("button");
      btn.disabled = true;
      try {
        await toggleFollow(id);
        onChange?.();
      } catch (e) {
        toast?.(e.message || "No se pudo guardar.", "err");
      }
      draw();
    });
  };
  draw();
}

/** Agrega o quita un jugador de los seguidos (respeta `my_team.max_followed`). */
export async function toggleFollow(id) {
  const cur = followedPlayers();
  if (cur.includes(id)) {
    await saveUiPref("followed_players", cur.filter(x => x !== id));
    return false;
  }
  const max = await _max();
  if (cur.length >= max) throw new Error(`Llegaste al máximo de ${max} jugadores seguidos.`);
  await saveUiPref("followed_players", [...cur, id]);
  return true;
}

export { esc as _esc };
