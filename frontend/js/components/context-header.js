// ── Cabecera de contexto y filtros rápidos (F-19) ────────────────────────────
// Una franja fija al tope de Equipo y Jugador con: la entidad, su récord "V-D", la diferencia media de puntos,
// "N de M partidos", el badge de muestra y la etiqueta de filtros aplicados; debajo, chips de período, sede y rival
// y "Limpiar filtros". Los números los calcula el servidor (`GET /api/context/summary`): acá solo se dibujan.
// El período (`last`) lo guarda la vista; sede y rival viajan en el contexto global (`core/context.js`).
import { api } from "../api.js";
import { fmtNumber } from "../core/format.js";
import { getContext, setContext, contextParams, activeCount } from "../core/context.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PERIODS = [[0, "Todos"], [3, "Últimos 3"], [5, "Últimos 5"], [10, "Últimos 10"], [15, "Últimos 15"]];
const VENUES = [["", "Todos"], ["local", "Local"], ["visitante", "Visitante"]];
const NOTICE_MS = 4000;

let _token = 0;
let _seen = { entity: null, sig: null };   // la última selección dibujada: sirve para avisar "Quedan N de M"
let _noticeTimer = null;

const _teamsByComp = new Map();
async function _teams(competition) {
  const key = String(competition ?? "");
  if (_teamsByComp.has(key)) return _teamsByComp.get(key);
  try {
    const o = await api.contextOptions({ competition: competition && competition !== "all" ? competition : null });
    _teamsByComp.set(key, o.teams || []);
  } catch {
    return null;
  }
  return _teamsByComp.get(key);
}

export function invalidateContextHeader() { _teamsByComp.clear(); }

const _signed = v => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${fmtNumber(Math.abs(v), 1)}`);

const _chip = (attrs, label, active) =>
  `<button type="button" class="filter-pill chdr-chip${active ? " active" : ""}" ${attrs} aria-pressed="${active}">${esc(label)}</button>`;

// `opts`: {entity: "team"|"player", id, competition, last, excludeTeam, onLast(n), onChange(), onClear()}
export async function mountContextHeader(el, opts) {
  if (!el) return;
  const token = ++_token;
  const { entity, id, competition, last = 0, excludeTeam } = opts;
  const ctx = getContext();
  const entityKey = `${entity}:${id}`;
  const sig = JSON.stringify({ competition, last, ctx });
  const changed = _seen.entity === entityKey && _seen.sig !== sig;
  _seen = { entity: entityKey, sig };

  if (!el.querySelector(".chdr")) {
    el.innerHTML = `<div class="chdr"><div class="chdr-top"><span class="td-muted">Calculando selección…</span></div></div>`;
  }
  let d;
  try {
    d = await api.contextSummary({ entity, id, competition: competition || null, last: last || null, ...contextParams() });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    el.innerHTML = `<div class="chdr"><div class="chdr-top"><span class="td-muted">${offline ? "Sin conexión" : "No se pudo calcular la selección"}</span></div></div>`;
    return;
  }
  if (token !== _token) return;

  const teams = (await _teams(competition)) || [];
  if (token !== _token) return;
  const rivals = teams.filter(t => t.code !== excludeTeam);
  const filtered = last > 0 || activeCount() > 0;
  const none = d.games === 0;
  const ex = d.context?.games_excluded || {};
  const notes = [];
  if (ex.sin_pbp) notes.push(`${ex.sin_pbp} ${ex.sin_pbp === 1 ? "partido sin jugada a jugada excluido" : "partidos sin jugada a jugada excluidos"}`);
  const norest = (ex.sin_partido_previo || 0) + (ex.sin_fecha || 0);
  if (norest) notes.push(`${norest} ${norest === 1 ? "partido sin descanso calculable excluido" : "partidos sin descanso calculable excluidos"}`);
  if ((d.context?.ignored || []).length) notes.push("hay filtros que esta vista no aplica");

  const label = d.label || "";   // el servidor ya incluye "Últimos N", sede y rival en la etiqueta
  el.innerHTML = `
    <div class="chdr${none ? " chdr-empty" : ""}">
      <div class="chdr-top">
        <strong class="chdr-name">${esc(d.entity.name)}</strong>
        ${d.record ? `<span class="chdr-rec" title="Victorias-derrotas de los partidos de la selección">${esc(d.record)}</span>
        <span class="chdr-margin" title="Diferencia media de puntos por partido">Dif. ${_signed(d.avg_margin)}</span>` : ""}
        <span class="chdr-n${none ? " chdr-n-zero" : ""}">${d.games} de ${d.games_total} partidos</span>
        ${d.sample ? sampleBadge(d.sample, { compact: true }) : ""}
        ${filtered ? '<button type="button" class="btn btn-ghost btn-sm chdr-clear">Limpiar filtros</button>' : ""}
      </div>
      <div class="chdr-label td-muted">${esc(label)}</div>
      <div class="chdr-chips" role="group" aria-label="Filtros rápidos">
        <span class="chdr-group"><em>Período</em>${PERIODS.map(([n, l]) => _chip(`data-last="${n}"`, l, n === last)).join("")}</span>
        <span class="chdr-group"><em>Sede</em>${VENUES.map(([k, l]) => _chip(`data-venue="${k}"`, l, (ctx.venue || "") === k)).join("")}</span>
        <span class="chdr-group"><em>Rival</em>${rivals.length
          ? [_chip('data-opp=""', "Todos", !ctx.opponent), ...rivals.map(t => _chip(`data-opp="${esc(t.code)}"`, t.name, ctx.opponent === t.code))].join("")
          : '<span class="td-muted">Sin rivales en la competencia</span>'}</span>
      </div>
      ${notes.length ? `<div class="chdr-sec td-muted">${esc(notes.join(" · "))}</div>` : ""}
      ${none ? '<div class="chdr-warn" role="status">Ningún partido cumple los filtros.</div>' : ""}
      <div class="chdr-notice" role="status" aria-live="polite" hidden></div>
    </div>`;

  // Aviso destacado tras un cambio de filtros (RF-8): unos segundos, el conteo permanente queda arriba.
  if (changed) {
    const box = el.querySelector(".chdr-notice");
    box.textContent = d.games === 0 ? `Quedan 0 de ${d.games_total} partidos` : `Quedan ${d.games} de ${d.games_total} partidos`;
    box.hidden = false;
    clearTimeout(_noticeTimer);
    _noticeTimer = setTimeout(() => { box.hidden = true; }, NOTICE_MS);
  }

  el.querySelectorAll("[data-last]").forEach(b => b.addEventListener("click", () => {
    const n = Number(b.dataset.last);
    if (n !== last) opts.onLast?.(n);
  }));
  el.querySelectorAll("[data-venue]").forEach(b => b.addEventListener("click", () => {
    if ((getContext().venue || "") === b.dataset.venue) return;
    setContext({ venue: b.dataset.venue });
    opts.onChange?.();
  }));
  el.querySelectorAll("[data-opp]").forEach(b => b.addEventListener("click", () => {
    if ((getContext().opponent || "") === b.dataset.opp) return;
    setContext({ opponent: b.dataset.opp });
    opts.onChange?.();
  }));
  el.querySelector(".chdr-clear")?.addEventListener("click", () => opts.onClear?.());
}
