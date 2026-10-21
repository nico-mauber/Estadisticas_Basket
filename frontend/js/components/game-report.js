// ── Informe de scouting del partido (F-07 RF-25/RF-26) ──────────────────────
// Menú de exportación del encabezado: CSV/XLSX con el box de ambos equipos y PNG/PDF A4
// con el informe (parciales, estándar, línea de tiempo, mapas de tiro, top jugadores, cruces).
import { fmtNumber, DEC1, DEC2, PCT, isNull, nullDisplay } from "../core/format.js";
import { shotChart } from "./shot-chart.js";
import { exportMenu } from "./export-menu.js";

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

const BOX_COLS = ["pts","fgm2","fga2","fgm3","fga3","ftm","fta","orb","drb","trb","ast","tov","stl","blk","pf"];
const BOX_LABELS = {
  pts:"PTS", fgm2:"2M", fga2:"2A", fgm3:"3M", fga3:"3A", ftm:"TLM", fta:"TLA",
  orb:"RO", drb:"RD", trb:"RT", ast:"AST", tov:"PER", stl:"ROB", blk:"TAP", pf:"FP",
};
const STD_KEYS = [["oer","OER",false],["der","DER",false],["net_rating","Net",false],["pace","Pace",false],
  ["efg_pct","eFG%",true],["ts_pct","TS%",true],["to_pct","TO%",true],["or_pct","OR%",true],["ft_rate","FT Rate",true]];
const TOP_PLAYERS = 3;
const TOP_CROSSES = 5;

function _raw(p, c) {
  const m = p.metrics?.[c];
  if (m && m.value != null) return Number(m.value);
  return p[c] != null ? Number(p[c]) : null;
}

// Valoración simple (PTS + RT + AST + ROB + TAP − tiros fallados − pérdidas) para ordenar el top.
function _val(p) {
  const g = c => _raw(p, c) ?? 0;
  return g("pts") + g("trb") + g("ast") + g("stl") + g("blk")
    - (g("fga2") + g("fga3") - g("fgm2") - g("fgm3")) - (g("fta") - g("ftm")) - g("tov");
}

function _fmtDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d)) return iso || "";
  const p = n => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _meta(g) {
  return {
    title: `Informe del partido — ${g.home_team} vs ${g.away_team}`,
    entity: { name: `${g.home_team} ${g.home_score}–${g.away_score} ${g.away_team}` },
    competition: { label: g.competition_label },
    filters: [{ label: "Fecha del partido", value: g.date || "—" }],
    generated_at: new Date().toISOString(),
    file_name: `partido_${g.home_code}_${g.away_code}_${g.game_id}`.toLowerCase(),
  };
}

function _data(detail) {
  const g = detail.game;
  const columns = [
    { key: "team", label: "Equipo", fmt: "text" }, { key: "player", label: "Jugador", fmt: "text" },
    { key: "min", label: "Min", fmt: "dec1" },
    ...BOX_COLS.map(c => ({ key: c, label: BOX_LABELS[c], fmt: "int" })),
    { key: "pm", label: "+/−", fmt: "signed_int" },
  ];
  const rows = [];
  for (const side of ["home", "away"]) {
    const code = side === "home" ? g.home_code : g.away_code;
    for (const p of (detail.players || []).filter(x => x.side === side)) {
      if (p.dnp) { rows.push([code, p.player_name, null, ...BOX_COLS.map(() => null), null]); continue; }
      rows.push([code, p.player_name, p.minutes, ...BOX_COLS.map(c => _raw(p, c)), p.plus_minus ?? null]);
    }
  }
  return { meta: _meta(g), columns, rows, pageInfo: `${rows.length} jugadores` };
}

function _timelineSVG(tl) {
  if (!tl?.points?.length) return "";
  const W = 640, H = 150, pad = 4;
  const pts = [{ t: 0, margin: 0 }, ...tl.points];
  const dur = tl.duration || pts[pts.length - 1].t || 1;
  const maxM = Math.max(1, ...pts.map(p => Math.abs(p.margin)));
  const x = t => pad + (t / dur) * (W - 2 * pad);
  const y = m => H / 2 - (m / maxM) * (H / 2 - pad);
  let d = `M${x(0)},${y(0)}`;
  let prev = 0;
  for (const p of pts.slice(1)) {
    d += ` L${x(p.t).toFixed(1)},${y(prev).toFixed(1)} L${x(p.t).toFixed(1)},${y(p.margin).toFixed(1)}`;
    prev = p.margin;
  }
  const lines = (tl.periods || []).map(p => typeof p === "number" ? p : p.t)
    .filter(t => t > 0 && t < dur)
    .map(t => `<line x1="${x(t)}" y1="0" x2="${x(t)}" y2="${H}" stroke="#8886" stroke-dasharray="3 3"/>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">
    ${lines}<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#8888"/>
    <path d="${d}" fill="none" stroke="#3b82f6" stroke-width="2"/></svg>`;
}

function _stdVal(obj, pct) {
  if (!obj || isNull(obj.value)) return nullDisplay(obj?.reason);
  return pct ? PCT(obj.value) : DEC2(obj.value);
}

// state: {detail, shots: {home, away}, matchups}
function _reportNode(state, { png }) {
  const { detail, shots, matchups } = state;
  const g = detail.game;
  const partials = detail.partials || [];
  const std = detail.standard;
  const tl = detail.timeline;
  const m = _meta(g);

  const top = side => (detail.players || []).filter(p => p.side === side && !p.dnp)
    .sort((a, b) => _val(b) - _val(a)).slice(0, TOP_PLAYERS);
  const topRows = side => top(side).map(p =>
    `<tr><td>${esc(p.player_name)}</td><td>${fmtNumber(p.minutes, 1)}</td><td>${_raw(p, "pts") ?? "—"}</td><td>${_raw(p, "trb") ?? "—"}</td>
      <td>${_raw(p, "ast") ?? "—"}</td><td>${_val(p)}</td></tr>`).join("");

  const crosses = [...(matchups?.rows || [])].sort((a, b) => (b.possessions || 0) - (a.possessions || 0)).slice(0, TOP_CROSSES);
  const shotCell = (data, name) => `<td style="width:50%;vertical-align:top"><b>${esc(name)}</b>${data ? shotChart(data, { colorBy: "none" }) : "<p>Sin tiros.</p>"}</td>`;

  const page1 = `<div class="prx-page">
    <div class="prx-head"><div class="prx-title">${esc(g.home_team)} ${g.home_score} – ${g.away_score} ${esc(g.away_team)}</div>
      <div class="prx-meta">Informe de scouting · ${esc(g.competition_label || "")} · ${esc(g.date || "")}${g.overtimes ? ` (${g.overtimes} PR)` : ""} · ${esc(_fmtDate(m.generated_at))}</div></div>
    ${partials.length ? `<h3>Parciales</h3><table class="prx-table"><thead><tr><th></th>${partials.map(p => `<th>${esc(p.label)}</th>`).join("")}<th>Total</th></tr></thead><tbody>
      <tr><td>${esc(g.home_code)}</td>${partials.map(p => `<td>${p.home}</td>`).join("")}<td><b>${g.home_score}</b></td></tr>
      <tr><td>${esc(g.away_code)}</td>${partials.map(p => `<td>${p.away}</td>`).join("")}<td><b>${g.away_score}</b></td></tr></tbody></table>` : ""}
    ${std?.home && std?.away ? `<h3>Conjunto estándar</h3><table class="prx-table"><thead><tr><th></th><th>${esc(g.home_code)}</th><th>${esc(g.away_code)}</th></tr></thead><tbody>
      ${STD_KEYS.map(([k, l, pct]) => `<tr><td>${l}</td><td>${_stdVal(std.home[k], pct)}</td><td>${_stdVal(std.away[k], pct)}</td></tr>`).join("")}</tbody></table>` : ""}
    ${tl ? `<h3>Línea de tiempo del marcador</h3>${_timelineSVG(tl)}
      <p>Cambios de ventaja: <b>${tl.lead_changes}</b> · Empates: <b>${tl.ties}</b> · Mayor ventaja ${esc(g.home_code)}: <b>${tl.biggest_lead?.home?.pts || 0}</b> · ${esc(g.away_code)}: <b>${tl.biggest_lead?.away?.pts || 0}</b></p>` : ""}
  </div>`;

  const page2 = `<div class="prx-page">
    <h3>Mapas de tiro</h3>
    <table style="width:100%"><tr>${shotCell(shots.home, g.home_team)}${shotCell(shots.away, g.away_team)}</tr></table>
    <h3>Mejores jugadores (valoración)</h3>
    ${["home", "away"].map(side => `<p><b>${esc(side === "home" ? g.home_team : g.away_team)}</b></p>
      <table class="prx-table"><thead><tr><th>Jugador</th><th>Min</th><th>PTS</th><th>RT</th><th>AST</th><th>VAL</th></tr></thead><tbody>${topRows(side)}</tbody></table>`).join("")}
    <h3>Cruces de quintetos con más posesiones</h3>
    ${crosses.length ? `<table class="prx-table"><thead><tr><th>${esc(g.home_code)}</th><th>${esc(g.away_code)}</th><th>Pos</th><th>PTS</th><th>OER</th></tr></thead><tbody>
      ${crosses.map(r => `<tr><td>${esc(r.own_name || "—")}</td><td>${esc(r.opp_name || "—")}</td><td>${DEC1(r.possessions)}</td>
        <td>${r.pts_for != null ? fmtNumber(r.pts_for, 0) : "—"}</td><td>${r.oer != null ? DEC2(r.oer) : "—"}</td></tr>`).join("")}</tbody></table>`
      : `<p>${g.has_pbp ? "Sin cruces disponibles." : "Sin jugada a jugada: cruces no disponibles."}</p>`}
  </div>`;

  const node = document.createElement("div");
  node.className = `prx ${png ? "prx-png" : "prx-print"}`;
  node.innerHTML = page1 + page2;
  return node;
}

// getState() se lee en cada exportación: toma lo que ya haya cargado (tiros y cruces se
// precargan en segundo plano al abrir el partido).
export function mountGameExport(host, getState) {
  return exportMenu(host, {
    getData: () => _data(getState().detail),
    getNode: () => document.createElement("div"),
    render: {
      png: () => _reportNode(getState(), { png: true }),
      pdf: () => _reportNode(getState(), { png: false }),
    },
    pngWidth: 1080,
  });
}
