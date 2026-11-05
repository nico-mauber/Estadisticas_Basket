// Contextos cruzados (A-06): un único componente que cruza dos dimensiones de un equipo sobre una métrica. Matriz con color por
// percentil, badge de muestra por celda, totales por fila y columna, verificación de cuadre y el detalle de la celda elegida.
import { api } from "../api.js";
import { percentileBg } from "../core/colors.js";
import { fmtNumber, PCT } from "../core/format.js";
import { exportMenu } from "./export-menu.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CROSS_DIMS = [
  ["cuarto", "Cuarto"], ["clutch", "Clutch"], ["tramo", "Tramo de reloj"], ["origen", "Origen de la posesión"], ["tipo", "Tipo de ataque"],
  ["oportunidad", "Oportunidad"], ["quinteto", "Quinteto"], ["jugador", "Jugador en cancha"], ["finalizador", "Finalizador"],
  ["sede", "Local o visitante"], ["rival", "Rival"],
];
export const CROSS_METRICS = [["ppp", "PPP"], ["efg_pct", "eFG%"], ["ts_pct", "TS%"], ["ppt", "PPT"], ["to_pct", "TO%"], ["or_pct", "OR%"], ["ft_rate", "FT Rate"], ["volume", "Volumen"]];
const REASONS = { sin_intentos: "Sin intentos", no_aplica: "No aplica" };

function _fmt(metric, v) {
  if (v == null) return "—";
  if (["efg_pct", "ts_pct", "to_pct", "or_pct", "ft_rate"].includes(metric)) return PCT(v);
  if (metric === "volume") return fmtNumber(v, 0);
  return fmtNumber(v, 2);
}

let _token = 0;

/** `opts`: `{team, side, dimX, dimY, metric, limit, color, params, onChange(state)}`. `params`: competencia y contexto. */
export async function renderCross(el, opts = {}) {
  if (!el) return;
  const token = ++_token;
  const st = { team: opts.team || "", side: opts.side || "ataque", dimX: opts.dimX || "tramo", dimY: opts.dimY || "origen",
               metric: opts.metric || "ppp", limit: opts.limit || 8, color: opts.color || "" };
  const change = patch => opts.onChange?.({ ...st, ...patch });
  let teams = [];
  try { teams = await api.teams(); } catch (e) {
    el.innerHTML = `<div class="card"><p class="empty below-avg">${navigator.onLine === false || e instanceof TypeError ? "Sin conexión: el cruce de contextos necesita conexión." : esc(e.message)}</p></div>`;
    return;
  }
  if (token !== _token) return;
  let presets = [];
  const controls = `
    <div class="ld-controls cx-controls">
      <label class="gp-lbl">Equipo<select id="cx-team" class="map-select"><option value="">— Equipo —</option>${teams.map(t => `<option value="${esc(t.code)}"${t.code === st.team ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      <label class="gp-lbl">Lado<select id="cx-side" class="map-select"><option value="ataque"${st.side === "ataque" ? " selected" : ""}>Ataque</option><option value="defensa"${st.side === "defensa" ? " selected" : ""}>Defensa</option></select></label>
      <label class="gp-lbl">Filas<select id="cx-x" class="map-select">${CROSS_DIMS.map(([k, l]) => `<option value="${k}"${k === st.dimX ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <button type="button" class="btn btn-ghost btn-sm" id="cx-swap" title="Intercambiar ejes">⇄ Intercambiar ejes</button>
      <label class="gp-lbl">Columnas<select id="cx-y" class="map-select">${CROSS_DIMS.map(([k, l]) => `<option value="${k}"${k === st.dimY ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="gp-lbl">Métrica<select id="cx-metric" class="map-select">${CROSS_METRICS.map(([k, l]) => `<option value="${k}"${k === st.metric ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <label class="gp-lbl">Máx. por eje<input id="cx-limit" type="number" min="3" max="30" class="ld-min" value="${st.limit}"></label>
    </div>`;
  el.innerHTML = `<div class="card"><div class="card-title">Contextos cruzados</div>${controls}<div id="cx-presets" class="tr-presets"></div></div><div id="cx-out"></div>`;
  const out = el.querySelector("#cx-out");

  const bind = () => {
    const read = () => ({ team: el.querySelector("#cx-team").value, side: el.querySelector("#cx-side").value, dimX: el.querySelector("#cx-x").value,
                          dimY: el.querySelector("#cx-y").value, metric: el.querySelector("#cx-metric").value,
                          limit: Math.max(3, Math.min(30, Number(el.querySelector("#cx-limit").value) || 8)) });
    ["#cx-team", "#cx-side", "#cx-x", "#cx-y", "#cx-metric", "#cx-limit"].forEach(sel => el.querySelector(sel).addEventListener("change", () => change(read())));
    el.querySelector("#cx-swap").addEventListener("click", () => { const r = read(); change({ ...r, dimX: r.dimY, dimY: r.dimX }); });
  };
  bind();

  if (!st.team) { out.innerHTML = '<div class="card"><p class="empty">Elegí un equipo y dos dimensiones.</p></div>'; return; }
  if (st.dimX === st.dimY) { out.innerHTML = '<div class="card"><p class="empty below-avg">Elegí dos dimensiones distintas.</p></div>'; return; }
  out.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Armando la matriz…</p></div>';
  let d;
  try {
    d = await api.cross({ ...(opts.params || {}), team: st.team, dim_x: st.dimX, dim_y: st.dimY, metric: st.metric, side: st.side, limit: st.limit, color: st.color });
  } catch (e) {
    if (token !== _token) return;
    const msg = e instanceof TypeError || navigator.onLine === false ? "Sin conexión: el cruce de contextos necesita conexión."
      : e.status >= 500 ? "No se pudo armar la matriz." : e.message;
    out.innerHTML = `<div class="card"><p class="empty below-avg">${esc(msg)}</p></div>`;
    return;
  }
  if (token !== _token) return;
  presets = d.presets || [];
  el.querySelector("#cx-presets").innerHTML = presets.map(p => `<button type="button" class="btn btn-ghost btn-sm tr-preset cx-preset${p.dim_x === st.dimX && p.dim_y === st.dimY && p.side === st.side ? " active" : ""}" data-key="${p.key}">${esc(p.label)}</button>`).join("");
  el.querySelectorAll(".cx-preset").forEach(b => b.addEventListener("click", () => {
    const p = presets.find(x => x.key === b.dataset.key);
    change({ dimX: p.dim_x, dimY: p.dim_y, side: p.side, metric: p.metric });
  }));

  const xs = d.dims.x.values, ys = d.dims.y.values, m = d.metric;
  const cellHTML = (c, i, j) => {
    const low = c.n > 0 && !c.ranked;
    if (!c.n) return `<td class="cx-cell cx-empty" title="Sin posesiones en esta combinación">—</td>`;
    const bg = c.ranked && c.pct != null ? percentileBg(c.pct, 0.32) : null;
    const adj = c.adj ? ` · ajustado ${fmtNumber(c.adj.value, 2)}` : "";
    const title = `${c.n} ${d.unit}${adj}${c.reason ? " · " + (REASONS[c.reason] || c.reason) : ""}`;
    return `<td class="cx-cell${low ? " cx-low" : ""}" data-i="${i}" data-j="${j}" style="${bg ? `background:${bg}` : ""}" title="${esc(title)}">
      <div class="cx-val">${c.value == null ? `<span title="${esc(REASONS[c.reason] || "")}">—</span>` : _fmt(m, c.value)}</div>
      <div class="cx-n">${c.n}${low ? ' <span class="cx-badge">BAJA</span>' : ""}${c.pct != null && c.ranked ? ` · p${c.pct}` : ""}</div></td>`;
  };
  const totalCell = c => `<td class="cx-total">${c.n ? `<div class="cx-val">${c.value == null ? "—" : _fmt(m, c.value)}</div><div class="cx-n">${c.n}</div>` : "—"}</td>`;
  const head = `<tr><th class="cx-corner">${esc(d.dims.x.label)} ╲ ${esc(d.dims.y.label)}</th>${ys.map(y => `<th>${esc(y.label)}</th>`).join("")}<th class="cx-total-h">Total</th></tr>`;
  const body = xs.map((x, i) => `<tr><th class="cx-row-h">${esc(x.label)}</th>${d.cells[i].map((c, j) => cellHTML(c, i, j)).join("")}${totalCell(d.row_totals[i])}</tr>`).join("");
  const foot = `<tr class="cx-foot"><th>Total</th>${d.col_totals.map(totalCell).join("")}${totalCell(d.grand_total)}</tr>`;
  const ck = d.check;
  const basis = d.pct_basis === "competencia" ? "Color: percentil frente a la competencia" : d.pct_basis === "matriz" ? "Color: percentil dentro de esta matriz" : "Sin color de rendimiento";
  const note = ck.overlapped
    ? `Jugador en cancha: cada ${d.unit === "posesiones" ? "posesión" : "oportunidad"} cuenta una vez por cada jugador en cancha. Cuadra: Σ celdas = ${ck.cells} = Σ ${d.unit} × jugadores (${ck.expected}); total único ${ck.total}.`
    : `Cuadra: Σ celdas = total (${ck.total} ${d.unit}) y ${ck.points_cells} puntos.`;
  out.innerHTML = `<div class="card cx-card">
      <div class="cx-head"><span class="td-muted">${esc(d.team)} · ${st.side === "ataque" ? "Ataque" : "Defensa"} · ${esc(d.metric_label)} · ${d.unit}</span><span id="cx-export"></span></div>
      <div class="cx-scroll"><table class="cx-table" id="cx-table"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
      <p class="td-muted cx-legend">${esc(basis)}. Gris: menos de ${d.grand_total.sample ? d.grand_total.sample.min : "?"} ${d.unit} (muestra baja), sin color.</p>
      <p class="cx-check ${ck.ok ? "td-muted" : "below-avg"}">${ck.ok ? esc(note) : "El cuadre no cierra: revisá posesiones incompletas."}${d.excluded.incomplete ? ` Quedaron fuera ${d.excluded.incomplete} posesiones incompletas.` : ""}</p>
      <p class="td-muted">${esc(d.context.label)} · ${d.context.games_used} de ${d.context.games_total} partidos.</p>
    </div><div id="cx-detail"></div>`;

  // detalle de celda: las ocho métricas y los conteos
  const detail = out.querySelector("#cx-detail");
  const showDetail = c => {
    const rows = CROSS_METRICS.map(([k, l]) => { const v = c.metrics[k]; return `<tr><td>${l}</td><td class="num">${v.value == null ? `<span title="${esc(REASONS[v.reason] || v.reason || "")}">—</span>` : _fmt(k, v.value)}</td></tr>`; }).join("");
    detail.innerHTML = `<div class="card"><div class="card-title">${esc(c.x ? xs.find(v => v.key === c.x).label : "")} · ${esc(c.y ? ys.find(v => v.key === c.y).label : "")}</div>
      <p class="td-muted">${c.n} ${d.unit} · ${c.counts.pts} puntos · ${c.counts.fga2 + c.counts.fga3} tiros de campo · ${c.counts.fta} libres · ${c.counts.tov} pérdidas</p>
      <table class="ld-table cx-detail-table"><tbody>${rows}</tbody></table></div>`;
  };
  out.querySelectorAll(".cx-cell[data-i]").forEach(td => td.addEventListener("click", () => {
    out.querySelectorAll(".cx-cell.sel").forEach(x => x.classList.remove("sel"));
    td.classList.add("sel");
    showDetail(d.cells[+td.dataset.i][+td.dataset.j]);
  }));

  exportMenu(out.querySelector("#cx-export"), {
    getNode: () => out.querySelector("#cx-table"),
    getData: () => ({
      meta: { title: `Contextos cruzados — ${d.team}`, entity: { type: "team", id: d.team, name: d.team }, competition: { label: d.context.competition?.label || "" },
              filters: [{ label: "Lado", value: st.side === "ataque" ? "Ataque" : "Defensa" }, { label: "Filas", value: d.dims.x.label }, { label: "Columnas", value: d.dims.y.label },
                        { label: "Métrica", value: d.metric_label }, { label: "Color", value: basis }, { label: "Contexto", value: d.context.label }],
              generated_at: new Date().toISOString(), file_name: `contextos-cruzados_${d.team}_${d.dims.x.key}-${d.dims.y.key}_${d.metric}`.toLowerCase() },
      columns: [{ key: "_row", label: d.dims.x.label, fmt: "text" }, ...ys.map((y, j) => ({ key: `c${j}`, label: y.label, fmt: d.metric_fmt })), { key: "_tot", label: "Total", fmt: d.metric_fmt }],
      rows: xs.map((x, i) => [x.label, ...d.cells[i].map(c => c.value), d.row_totals[i].value]),
      footer: [["Total", ...d.col_totals.map(c => c.value), d.grand_total.value]],
      pageInfo: `${d.grand_total.n} ${d.unit}`,
    }),
  });
}
