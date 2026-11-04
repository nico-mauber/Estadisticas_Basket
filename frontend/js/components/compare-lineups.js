// ── Comparar quintetos (F-09) ────────────────────────────────────────────────
// Dos combinaciones de 3 a 5 jugadores, del mismo equipo o de equipos distintos, con radar y tabla enfrentada del conjunto
// estándar de quinteto. En OER, DER y Net Rating gana el valor AJUSTADO por muestra (T-02), no el crudo; las muestras
// bajas se comparan igual, con su badge a la vista. Los datos salen de `api.metrics("lineup", {id})` (misma fuente que la
// tabla de quintetos de F-06).
import { api } from "../api.js";
import { loadCatalog, metricLabel, metricDef } from "../core/catalog.js";
import { fmtMetric, isNull, nullDisplay } from "../core/format.js";
import { percentileBg } from "../core/colors.js";
import { sampleBadge } from "./sample-badge.js";
import { drawComparePlayersRadar } from "../charts.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const RADAR = [
  { key: "oer", label: "Ataque" }, { key: "der", label: "Defensa" }, { key: "efg_pct", label: "Tiro" },
  { key: "to_pct", label: "Cuidado del balón" }, { key: "or_pct", label: "Rebote of." }, { key: "dr_pct", label: "Rebote def." },
];
const TABLE_BLOCKS = [
  { label: "Avanzado", keys: ["possessions", "minutes", "games", "oer", "der", "net_rating", "efg_pct", "ts_pct", "to_pct", "ft_rate", "or_pct", "dr_pct", "pace"] },
  { label: "Ataque", keys: ["ppp", "ppt", "fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "ast", "tov"] },
  { label: "Defensa", keys: ["stl", "blk", "pts_against", "plus_minus"] },
];
const ADJUSTED = new Set(["oer", "der", "net_rating"]);

let _token = 0, _run = 0;
const _playersByTeam = new Map();
let _teams = null;

async function _players(team) {
  if (!_playersByTeam.has(team)) {
    const list = await api.players(team);
    _playersByTeam.set(team, list.filter(p => p.player_id != null).map(p => ({ id: p.player_id, name: p.name })));
  }
  return _playersByTeam.get(team);
}

function _cell(payload, key) {
  const m = payload?.metrics?.[key];
  if (!m) return { text: "—", pct: null, value: null };
  const adj = ADJUSTED.has(key) ? m.adj?.value : null;
  const rawText = isNull(m.value) ? nullDisplay(m.reason) : fmtMetric(key, m.value);
  const text = adj != null && !isNull(m.value) ? `${rawText} <span class="td-muted" title="Valor ajustado por muestra (T-02)">(aj. ${fmtMetric(key, adj)})</span>` : rawText;
  const cmp = adj ?? (isNull(m.value) ? null : m.value);
  return { text, pct: m.percentile ?? null, value: cmp };
}

function _row(key, A, B) {
  const a = _cell(A, key), b = _cell(B, key);
  const dir = metricDef(key)?.direction;
  let clsA = "", clsB = "";
  if (a.value != null && b.value != null && dir && dir !== "neutral" && a.value !== b.value) {
    const aWins = dir === "higher" ? a.value > b.value : a.value < b.value;
    clsA = aWins ? "cmp-win" : ""; clsB = aWins ? "" : "cmp-win";
  }
  const tag = p => (p == null ? "" : `<span class="cmp-pct" style="background:${percentileBg(p)}">p${Math.round(p)}</span>`);
  return `<tr><td class="${clsA}">${a.text} ${tag(a.pct)}</td><td class="cmp-key">${esc(metricLabel(key))}</td><td class="${clsB}">${b.text} ${tag(b.pct)}</td></tr>`;
}

function _head(payload, label) {
  const e = payload?.entity || {};
  const names = (payload?.meta?.player_names || e.players || []).join(" · ");
  return `<div class="cmp-head"><div class="cmp-name">${esc(e.name || label)}</div>
    <div class="td-muted">${esc(e.team_code || "")}${names ? ` · ${esc(names)}` : ""}</div>
    <div>${payload?.sample ? sampleBadge(payload.sample, { compact: true }) : ""}</div></div>`;
}

function _sideHTML(letter, teams, selTeam) {
  return `<div class="cl-side" data-side="${letter}"><label class="gp-lbl">Equipo ${letter.toUpperCase()}
    <select class="cl-team map-select"><option value="">— Equipo —</option>${teams.map(t => `<option value="${esc(t.code)}"${t.code === selTeam ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
    <div class="lineup-picker cl-picker"></div></div>`;
}

/** `opts.initial`: {a, b} con ids `EQUIPO:12-34-56`. */
export async function renderCompareLineups(el, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando equipos…</p></div>';
  try {
    [_teams] = await Promise.all([_teams ? Promise.resolve(_teams) : api.teams(), loadCatalog()]);
  } catch (e) {
    if (token !== _token) return;
    el.innerHTML = `<div class="card"><p class="empty below-avg">${esc(e.message || "No se pudieron cargar los equipos.")}</p></div>`;
    return;
  }
  if (token !== _token) return;
  const init = {};
  for (const k of ["a", "b"]) {
    const v = opts.initial?.[k];
    if (v && v.includes(":")) { const [team, ids] = v.split(":"); init[k] = { team, ids: ids.split("-").map(Number) }; }
  }
  el.innerHTML = `<div class="card"><div class="card-title">Comparar quintetos</div>
    <div class="cl-sides">${_sideHTML("a", _teams, init.a?.team)}${_sideHTML("b", _teams, init.b?.team)}</div>
    <p class="td-muted cmp-note">Elegí entre 3 y 5 jugadores de cada equipo. En OER, DER y Net Rating gana el valor ajustado por muestra; un quinteto con muestra baja se compara igual, con su badge a la vista.</p>
    <button class="btn" id="btn-cmp-lineups">Comparar</button></div><div id="cmp-lineups-result"></div>`;
  const result = el.querySelector("#cmp-lineups-result");

  async function fillPicker(side, team, checked = []) {
    const box = el.querySelector(`[data-side="${side}"] .cl-picker`);
    if (!team) { box.innerHTML = ""; return; }
    box.innerHTML = '<span class="spinner"></span>';
    const players = await _players(team);
    if (token !== _token) return;
    box.innerHTML = players.map(p => `<label class="lineup-check"><input type="checkbox" value="${p.id}"${checked.includes(p.id) ? " checked" : ""}>${esc(p.name)}</label>`).join("") || '<span class="td-muted">Sin jugadores.</span>';
  }
  const filled = [];
  for (const k of ["a", "b"]) {
    el.querySelector(`[data-side="${k}"] .cl-team`).addEventListener("change", e => fillPicker(k, e.target.value));
    if (init[k]) filled.push(fillPicker(k, init[k].team, init[k].ids));
  }
  const pick = side => {
    const team = el.querySelector(`[data-side="${side}"] .cl-team`).value;
    const ids = [...el.querySelectorAll(`[data-side="${side}"] .cl-picker input:checked`)].map(i => Number(i.value)).sort((x, y) => x - y);
    return { team, ids };
  };

  const run = async () => {
    const A = pick("a"), B = pick("b");
    const bad = !A.team || !B.team ? "Elegí un equipo para cada combinación."
      : A.ids.length < 3 || A.ids.length > 5 || B.ids.length < 3 || B.ids.length > 5 ? "Elegí entre 3 y 5 jugadores en cada combinación."
      : A.team === B.team && A.ids.join("-") === B.ids.join("-") ? "Elegí dos combinaciones distintas." : "";
    if (bad) { result.innerHTML = `<div class="card"><p class="empty">${esc(bad)}</p></div>`; return; }
    const idA = `${A.team}:${A.ids.join("-")}`, idB = `${B.team}:${B.ids.join("-")}`;
    opts.onSync?.(idA, idB);
    result.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Comparando…</p></div>';
    const req = ++_run;
    let pa, pb;
    try {
      [pa, pb] = await Promise.all([api.metrics("lineup", { id: idA, ...(opts.params || {}) }), api.metrics("lineup", { id: idB, ...(opts.params || {}) })]);
    } catch (e) {
      if (req !== _run) return;
      result.innerHTML = `<div class="card"><p class="empty below-avg">${esc(e.status === 404 ? "Alguna combinación no tiene partidos juntos." : e.message || "No se pudo comparar.")}</p></div>`;
      return;
    }
    if (req !== _run) return;
    const nameOf = (side, team) => `${_teams.find(t => t.code === team)?.name || team} (${side.ids.length})`;
    const radarOk = RADAR.some(d => _cell(pa, d.key).pct != null || _cell(pb, d.key).pct != null);
    result.innerHTML = `<div class="card"><div class="cmp-heads">${_head(pa, nameOf(A, A.team))}${_head(pb, nameOf(B, B.team))}</div>
      ${radarOk ? '<div class="radar-wrap"><canvas id="cmp-lineups-radar"></canvas></div>' : '<p class="empty">Sin percentiles para el radar: las combinaciones no tienen población de referencia.</p>'}
      ${radarOk ? '<p class="td-muted">Radar en percentiles de cada combinación frente a los quintetos de su equipo (0 a 100).</p>' : ""}</div>
      ${TABLE_BLOCKS.map(blk => `<div class="card"><div class="card-title">${blk.label}</div><div class="vs-table-wrap"><table class="compare-table cmp-table">
        <thead><tr><th>${esc(nameOf(A, A.team))}</th><th></th><th>${esc(nameOf(B, B.team))}</th></tr></thead>
        <tbody>${blk.keys.map(k => _row(k, pa, pb)).join("")}</tbody></table></div></div>`).join("")}`;
    if (radarOk) drawComparePlayersRadar("cmp-lineups-radar", RADAR.map(d => _cell(pa, d.key).pct), RADAR.map(d => _cell(pb, d.key).pct),
      RADAR.map(d => d.label), nameOf(A, A.team), nameOf(B, B.team));
  };
  el.querySelector("#btn-cmp-lineups").addEventListener("click", run);
  if (init.a && init.b) { await Promise.all(filled); if (token === _token) run(); }
}

export function lineupsFromUrl() {
  try {
    const q = new URL(location.href).searchParams;
    const a = q.get("cmp_qa"), b = q.get("cmp_qb");
    return a && b ? { a, b } : null;
  } catch { return null; }
}

export function destroyCompareLineups() { _token++; _run++; }
