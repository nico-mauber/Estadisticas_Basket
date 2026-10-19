// ── Barra de contexto (T-03) ──────────────────────────────────────────────────
// Sede · Rival · Descanso + "Limpiar filtros". Los períodos (últimos N) y la competencia siguen en los
// controles de cada vista. En móvil se pliega en una línea "Filtros (n)".
import { api } from "../api.js";
import { VENUE_OPTIONS, REST_OPTIONS, getContext, setContext, clearContext, activeCount } from "../core/context.js";

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

const _opts = (list, sel) => list.map(o => `<option value="${esc(o.key)}"${o.key === sel ? " selected" : ""}>${esc(o.label)}</option>`).join("");

// Monta la barra en `el`. `onChange()` se llama después de guardar el cambio (la vista recarga).
// `competition`: id o "all" de la competencia activa (para la lista de rivales).
export function mountContextBar(el, { competition, onChange } = {}) {
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
      </div>
    </details>`;

  _teams(competition === "all" ? null : competition).then(teams => {
    const sel = el.querySelector('[data-ctx="opponent"]');
    if (!sel) return;
    if (!teams) { sel.title = "No se pudieron cargar los rivales."; return; }
    sel.innerHTML = '<option value="">Todos</option>' + teams.map(t =>
      `<option value="${esc(t.code)}"${t.code === ctx.opponent ? " selected" : ""}>${esc(t.name)}</option>`).join("");
  });

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
  notes.push("Los mapas de tiro y los cierres todavía no aplican estos filtros.");
  return `<p class="td-muted ctx-note">${esc(echo.label)} · ${echo.games_used} de ${echo.games_total} partidos · ${esc(notes.join(" "))}</p>`;
}
