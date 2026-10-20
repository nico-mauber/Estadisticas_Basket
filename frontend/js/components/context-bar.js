// ── Barra de contexto (T-03) ──────────────────────────────────────────────────
// Sede · Rival · Descanso (nivel partido) y, en Equipo, Cuarto · Marcador · Con/Sin jugador (nivel evento)
// + "Limpiar filtros". Los períodos (últimos N) y la competencia siguen en los controles de cada vista.
// En móvil se pliega en una línea "Filtros (n)".
import { api } from "../api.js";
import { VENUE_OPTIONS, REST_OPTIONS, QUARTER_OPTIONS, SCORE_OPTIONS, EVENT_KEYS, getContext, setContext, clearContext, activeCount } from "../core/context.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const _teamsByComp = new Map();   // competencia → [{code, name}]

async function _teams(competition) {
  const key = String(competition ?? "");
  if (_teamsByComp.has(key)) return _teamsByComp.get(key);
  try {
    const o = await api.contextOptions({ competition: competition || null });
    _teamsByComp.set(key, o.teams || []);
  } catch {
    return null;
  }
  return _teamsByComp.get(key);
}

const _playersByTeam = new Map();   // equipo → [{id, name}]

async function _players(teamCode) {
  if (_playersByTeam.has(teamCode)) return _playersByTeam.get(teamCode);
  try {
    const list = await api.players(teamCode);
    _playersByTeam.set(teamCode, list.filter(p => p.player_id != null).map(p => ({ id: String(p.player_id), name: p.name })));
  } catch {
    return null;
  }
  return _playersByTeam.get(teamCode);
}

const _csv = v => (v ? v.split(",") : []);

const _opts = (list, sel) => list.map(o => `<option value="${esc(o.key)}"${o.key === sel ? " selected" : ""}>${esc(o.label)}</option>`).join("");

// Monta la barra en `el`. `onChange()` se llama después de guardar el cambio (la vista recarga).
// `competition`: id o "all" de la competencia activa (para la lista de rivales). `teamCode`: equipo de la vista;
// con él se ofrecen los filtros de nivel evento (cuarto, marcador, con/sin jugador).
export function mountContextBar(el, { competition, teamCode, onChange } = {}) {
  if (!el) return;
  const ctx = getContext();
  const n = activeCount();
  const wide = window.matchMedia && window.matchMedia("(min-width: 768px)").matches;
  el.innerHTML = `
    <details class="ctx-bar card"${wide || n ? " open" : ""}>
      <summary><span>Filtros${n ? ` (${n})` : ""}</span>${n ? '<button type="button" class="btn btn-ghost btn-sm ctx-clear">Limpiar filtros</button>' : ""}</summary>
      <div class="ctx-fields">
        <label>Sede <select class="map-select" data-ctx="venue">${_opts(VENUE_OPTIONS, ctx.venue || "")}</select></label>
        <label>Rival <select class="map-select" data-ctx="opponent"><option value="">Todos</option>${ctx.opponent ? `<option value="${esc(ctx.opponent)}" selected>${esc(ctx.opponent)}</option>` : ""}</select></label>
        <label>Descanso <select class="map-select" data-ctx="rest">${_opts(REST_OPTIONS, ctx.rest || "")}</select></label>
${teamCode ? `        <div class="ctx-field">Cuarto <div class="ctx-quarters" role="group" aria-label="Cuarto">${QUARTER_OPTIONS.map(o => `<button type="button" class="ctx-q" data-q="${o.key}" aria-pressed="${_csv(ctx.quarter).includes(o.key)}">${o.label}</button>`).join("")}</div></div>
        <label>Marcador <select class="map-select" data-ctx="score">${_opts(SCORE_OPTIONS, ctx.score || "")}</select></label>
        <label>Con jugador <select class="map-select" data-ctx="on"><option value="">Todos</option></select></label>
        <label>Sin jugador <select class="map-select" data-ctx="off"><option value="">Todos</option></select></label>` : ""}
      </div>
${!teamCode && EVENT_KEYS.some(k => ctx[k]) ? '      <p class="td-muted ctx-hint">Los filtros de cuarto, marcador y con/sin jugador se aplican al equipo, no a la ficha de jugador.</p>\n' : ""}    </details>`;

  _teams(competition === "all" ? null : competition).then(teams => {
    const sel = el.querySelector('[data-ctx="opponent"]');
    if (!sel) return;
    if (!teams) { sel.title = "No se pudieron cargar los rivales."; return; }
    sel.innerHTML = '<option value="">Todos</option>' + teams.map(t =>
      `<option value="${esc(t.code)}"${t.code === ctx.opponent ? " selected" : ""}>${esc(t.name)}</option>`).join("");
  });

  if (teamCode) {
    _players(teamCode).then(players => {
      for (const key of ["on", "off"]) {
        const sel = el.querySelector(`[data-ctx="${key}"]`);
        if (!sel) continue;
        if (!players) { sel.title = "No se pudieron cargar los jugadores."; continue; }
        sel.innerHTML = '<option value="">Todos</option>' + players.map(p =>
          `<option value="${esc(p.id)}"${p.id === ctx[key] ? " selected" : ""}>${esc(p.name)}</option>`).join("");
      }
    });
    el.querySelectorAll(".ctx-q").forEach(btn => btn.addEventListener("click", () => {
      const cur = new Set(_csv(getContext().quarter));
      cur.has(btn.dataset.q) ? cur.delete(btn.dataset.q) : cur.add(btn.dataset.q);
      setContext({ quarter: [...cur].join(",") });
      onChange?.();
    }));
  }
  el.querySelectorAll("[data-ctx]").forEach(sel => sel.addEventListener("change", () => {
    setContext({ [sel.dataset.ctx]: sel.value });
    onChange?.();
  }));
  el.querySelector(".ctx-clear")?.addEventListener("click", e => {
    e.preventDefault();   // el botón vive dentro del <summary>: no debe plegar el panel
    clearContext();
    onChange?.();
  });
}

// Texto bajo la barra: selección aplicada, partidos usados y excluidos (T-E2). "" si no hay filtros.
export function contextNote(echo) {
  if (!echo || !activeCount()) return "";
  const ex = echo.games_excluded || {};
  const notes = [];
  if (ex.sin_pbp) notes.push(`Se excluyeron ${ex.sin_pbp} ${ex.sin_pbp === 1 ? "partido" : "partidos"} sin jugada a jugada.`);
  const norest = (ex.sin_partido_previo || 0) + (ex.sin_fecha || 0);
  if (norest) notes.push(`Se excluyeron ${norest} ${norest === 1 ? "partido" : "partidos"} sin descanso calculable.`);
  if (ex.sin_titulares) notes.push(`Se excluyeron ${ex.sin_titulares} ${ex.sin_titulares === 1 ? "partido" : "partidos"} sin titulares registrados.`);
  if (echo.level === "evento") notes.push("El game log y los totales de partido no se recortan por cuarto, marcador ni jugador.");
  if ((echo.ignored || []).length) notes.push("Hay filtros que este bloque no aplica.");
  notes.push("Los mapas de tiro y los cierres todavía no aplican estos filtros.");
  return `<p class="td-muted ctx-note">${esc(echo.label)} · ${echo.games_used} de ${echo.games_total} partidos · ${esc(notes.join(" "))}</p>`;
}
