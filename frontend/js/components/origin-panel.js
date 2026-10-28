// ── Origen de la posesión (A-02) ─────────────────────────────────────────────
// Tabla de los 7 orígenes (volumen, % del total, PPP, eFG%, TO%, FT Rate, duración media y reparto de
// finalización), fila informativa de "Tras rebote ofensivo" y selector Ataque / Defensa. Una llamada por lado;
// el lado elegido va en `?side=` de la URL. En modo jugador solo hay ataque: de qué origen recibe el balón
// cuando finaliza la posesión.
import { api } from "../api.js";
import { fmtNumber, PCT, PCT0, DEC2, DEC1, nullDisplay, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let _token = 0;   // descarta respuestas viejas al cambiar de entidad, lado o contexto

const FINISH = [["t2", "T2", "of-t2"], ["t3", "T3", "of-t3"], ["tl", "TL", "of-tl"], ["perdida", "Pérdida", "of-to"]];

function _sideFromUrl() {
  try { return new URL(location.href).searchParams.get("side") === "defensa" ? "defensa" : "ataque"; } catch { return "ataque"; }
}
function _setSideUrl(side) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("side", side);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar */ }
}

function _val(m, fmt) {
  if (!m || isNull(m.value)) return nullDisplay(m?.reason || "sin_intentos");
  return fmt(m.value);
}

function _finishBar(f) {
  const parts = FINISH.filter(([k]) => !isNull(f[k]));
  if (!parts.length) return '<span class="td-muted">—</span>';
  const title = parts.map(([k, label]) => `${label} ${PCT0(f[k])}`).join(" · ");
  const extra = f.fin_periodo?.count ? ` · Fin de período sin tiro: ${f.fin_periodo.count}` : "";
  return `<div class="of-bar" title="${esc(title + extra)}" role="img" aria-label="${esc(title)}">
    ${parts.map(([k, label, cls]) => `<span class="${cls}" style="width:${(f[k] * 100).toFixed(1)}%"></span>`).join("")}
  </div>`;
}

function _rowHTML(o, def) {
  const low = o.sample?.level === "baja";
  const m = o.metrics || {};
  return `<tr class="${low ? "of-low" : ""}">
    <td class="of-origin">${esc(o.label)}</td>
    <td>${fmtNumber(o.possessions, 0)}${low ? ` <span class="sample-badge sample-baja" title="${esc(`Muestra baja: mínimo ${o.sample.min} posesiones`)}">baja</span>` : ""}</td>
    <td>${isNull(o.share) ? "—" : PCT(o.share)}</td>
    <td>${_val(m.ppp, DEC2)}</td>
    <td>${_val(m.efg_pct, PCT)}</td>
    <td>${_val(m.to_pct, PCT)}</td>
    <td>${_val(m.ft_rate, PCT)}</td>
    <td>${_val(m.duration_avg, v => `${DEC1(v)} s`)}</td>
    <td class="of-finish">${_finishBar(o.finish || {})}</td>
  </tr>`;
}

function _tableHTML(data, mode) {
  const def = data.side === "defensa";
  const head = def
    ? ["Origen (rival)", "Posesiones", "%", "PPP conced.", "eFG% conced.", "TO% forzado", "FT Rate conced.", "Duración", "Finalización"]
    : [mode === "player" ? "Origen de la posesión que finaliza" : "Origen", "Posesiones", "%", "PPP", "eFG%", "TO%", "FT Rate", "Duración", "Finalización"];
  const oreb = data.oreb_info;
  const orebRow = oreb ? `<tr class="of-info"><td class="of-origin">${esc(oreb.label)}</td>
      <td>${fmtNumber(oreb.possessions, 0)}</td><td colspan="7" class="td-muted">${esc(oreb.note)}</td></tr>` : "";
  return `<div class="dt-table-wrap"><table class="search-table of-table">
    <thead><tr>${head.map((h, i) => `<th${i === 0 ? ' class="of-origin"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${data.origins.map(o => _rowHTML(o, def)).join("")}${orebRow}</tbody>
  </table></div>
  <div class="of-legend">${FINISH.map(([, label, cls]) => `<span><i class="${cls}"></i>${label}</span>`).join("")}</div>`;
}

function _reconcileHTML(data) {
  const r = data.reconcile;
  if (!r) return `<p class="td-muted">Posesiones del jugador: ${fmtNumber(data.summary.possessions, 0)}.</p>`;
  if (r.ok) return `<p class="td-muted">Posesiones clasificadas: ${fmtNumber(r.sum_origins, 0)} de ${fmtNumber(r.total_possessions, 0)} (100 %).</p>`;
  return `<p class="empty below-avg">Diferencia de ${fmtNumber(Math.abs(r.total_possessions - r.sum_origins), 0)} posesiones: revisar el motor de posesiones (A-01).</p>`;
}

// `opts`: {params (competition, last, contexto), mode: "team"|"player", teamName}
export async function renderOriginPanel(el, id, opts = {}) {
  if (!el) return;
  const mode = opts.mode || "team";
  const side = mode === "player" ? "ataque" : _sideFromUrl();
  const token = ++_token;
  const title = side === "defensa" ? "Origen de la posesión rival" : "Origen de la posesión";
  const chips = mode === "player" ? "" : `<div class="pb-chips" role="group" aria-label="Lado">
      <button type="button" class="filter-pill of-chip${side === "ataque" ? " active" : ""}" data-side="ataque">Ataque</button>
      <button type="button" class="filter-pill of-chip${side === "defensa" ? " active" : ""}" data-side="defensa">Defensa</button></div>`;
  const shell = body => `<div class="card of-card"><div class="card-title">${title}</div>${chips}${body}</div>`;
  el.innerHTML = shell('<p class="empty"><span class="spinner"></span>Calculando orígenes…</p>');
  _bindChips(el, id, opts);

  let data;
  try {
    data = await api.origins({ ...(mode === "player" ? { player: id } : { team: id }), side, ...(opts.params || {}) });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular el origen de la posesión. Probá de nuevo.");
    el.innerHTML = shell(`<p class="empty below-avg">${esc(msg)}</p>${e.code === "sin_pbp" ? "" : '<button type="button" class="btn btn-ghost btn-sm of-retry">Reintentar</button>'}`);
    _bindChips(el, id, opts);
    el.querySelector(".of-retry")?.addEventListener("click", () => renderOriginPanel(el, id, opts));
    return;
  }
  if (token !== _token) return;

  if (!data.summary.possessions) {
    el.innerHTML = shell('<p class="empty">No hay posesiones en esta selección.</p>');
    _bindChips(el, id, opts);
    return;
  }
  el.innerHTML = shell(`${data.context?.label ? `<p class="td-muted">${esc(data.context.label)}</p>` : ""}${_tableHTML(data, mode)}${_reconcileHTML(data)}`);
  _bindChips(el, id, opts);
}

function _bindChips(el, id, opts) {
  el.querySelectorAll(".of-chip").forEach(c => c.addEventListener("click", () => {
    if (c.classList.contains("active")) return;
    _setSideUrl(c.dataset.side);
    renderOriginPanel(el, id, opts);
  }));
}

export function destroyOriginPanel() { _token++; }
