// Buscador de quintetos (F-10): todos los quintetos de una competencia filtrados por equipo, jugadores incluidos y
// excluidos, mínimo de posesiones y rangos por métrica. El filtrado lo hace el servidor (`/api/table/lineup_search`):
// la misma consulta devuelve siempre las mismas filas en el mismo orden. Los parámetros se materializan en un objeto
// plano (los mismos nombres que la query de la tabla) que sirve para la dirección y para guardar la búsqueda.
import { api } from "../api.js";
import { createDataTable } from "./data-table.js";
import { loadCatalog, metricDef, metricLabel, groupsFor } from "../core/catalog.js";
import { contextParams } from "../core/context.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const CONTEXT_KEYS = ["last", "venue", "opponent", "rest", "quarter", "score", "on", "off", "clock", "clock_start", "origin", "ptype", "chance"];
const BASE_RANGES = ["net_rating", "oer", "der", "efg_pct", "ts_pct", "or_pct", "dr_pct", "to_pct", "ast_to", "pace", "minutes", "possessions"];
const LAST_OPTIONS = [["", "Todos los partidos"], ["3", "Últimos 3"], ["5", "Últimos 5"], ["10", "Últimos 10"]];

const isPct = key => metricDef(key)?.fmt === "pct";
const toInput = (key, v) => v == null || v === "" ? "" : String(isPct(key) ? Math.round(Number(v) * 10000) / 100 : Number(v));
const fromInput = (key, v) => isPct(key) ? String(Math.round(parseFloat(v) * 100000) / 10000000) : String(parseFloat(v));

const EXCL_LABELS = [["jugadores", "por jugadores"], ["min_poss", "por muestra"], ["rangos", "por rangos"], ["nulos", "por dato nulo"]];

export async function renderLineupSearch(el, { initial = {}, onState, onSave, stale = false } = {}) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando quintetos…</p>';
  let comps = [], catalogOk = true;
  try { await loadCatalog(); } catch { catalogOk = false; }
  try { comps = await api.competitions(); } catch (e) {
    el.innerHTML = `<p class="empty below-avg">${navigator.onLine === false || e instanceof TypeError ? "Sin conexión: la búsqueda de quintetos necesita conexión." : esc(e.message)}</p>`;
    return;
  }
  if (!el.isConnected) return;

  // estado
  const st = {
    competition: initial.competition || "", team: initial.team || "",
    include: (initial.include || "").split(",").filter(Boolean), exclude: (initial.exclude || "").split(",").filter(Boolean),
    min_poss: initial.min_poss ?? "", adjusted: initial.adjusted !== "0", last: initial.last || "",
    ranges: {},   // key → {min, max} en la unidad del servidor (fracción para porcentajes)
  };
  for (const [k, v] of Object.entries(initial)) {
    const m = /^(min|max)\.(.+)$/.exec(k);
    if (m) (st.ranges[m[2]] ||= {})[m[1]] = v;
  }
  const savedCtx = Object.fromEntries(CONTEXT_KEYS.filter(k => k !== "last" && initial[k] != null && initial[k] !== "").map(k => [k, initial[k]]));
  const ctxFixed = Object.keys(savedCtx).length ? savedCtx : null;
  let players = [], playersComp = null, table = null, lastParams = null;

  const lineupMetrics = (catalogOk ? groupsFor("lineup").flatMap(g => g.metrics) : BASE_RANGES);
  const baseKeys = BASE_RANGES.filter(k => lineupMetrics.includes(k));
  const rangeKeys = () => [...new Set([...baseKeys, ...Object.keys(st.ranges)])].filter(k => lineupMetrics.includes(k));

  el.innerHTML = `
    ${stale ? '<p class="banner warn ls-stale">Los datos o la configuración cambiaron desde que guardaste esta consulta: el resultado puede diferir.</p>' : ""}
    <div class="card ls-card">
      <div class="card-title">Buscador de quintetos</div>
      <div class="search-filters ls-bar">
        <select id="ls-comp" aria-label="Competencia"><option value="">Competencia…</option>${comps.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join("")}</select>
        <select id="ls-team" aria-label="Equipo"><option value="">Equipo (todos)</option></select>
        <select id="ls-last" aria-label="Período">${LAST_OPTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
        <input type="number" id="ls-minposs" min="0" step="1" placeholder="Mín. posesiones (vacío: regla de muestra)" aria-label="Mínimo de posesiones">
      </div>
      <div class="ls-players">
        <div class="ls-picker" data-kind="include"><span class="ls-pl-label">Incluye a</span><div class="ls-chips"></div><input type="text" class="ls-pl-input" placeholder="Buscar jugador…" autocomplete="off"><div class="ls-sugg" hidden></div></div>
        <div class="ls-picker" data-kind="exclude"><span class="ls-pl-label">Excluye a</span><div class="ls-chips"></div><input type="text" class="ls-pl-input" placeholder="Buscar jugador…" autocomplete="off"><div class="ls-sugg" hidden></div></div>
      </div>
      <details class="ls-more"><summary>Más filtros (rangos por métrica)</summary>
        <label class="ls-adj"><input type="checkbox" id="ls-adj"> Valor ajustado por muestra (OER, DER y Net Rating)</label>
        <div class="search-ranges" id="ls-ranges"></div>
        <select id="ls-addm" aria-label="Agregar métrica"><option value="">Agregar métrica…</option></select>
      </details>
      <div class="search-actions">
        <button class="btn" id="ls-go">Buscar</button>
        <button class="btn btn-ghost" id="ls-clear">Limpiar</button>
        <button class="btn btn-ghost" id="ls-save">Guardar búsqueda</button>
        <span class="td-muted" id="ls-count"></span>
      </div>
      <p class="td-muted ls-excl" id="ls-excl"></p>
      <p class="below-avg ls-err" id="ls-err" hidden></p>
    </div>
    <div id="ls-results"></div>`;

  const $ = id => el.querySelector(id);
  $("#ls-comp").value = st.competition;
  $("#ls-last").value = st.last;
  $("#ls-minposs").value = st.min_poss;
  $("#ls-adj").checked = st.adjusted;

  // ── rangos ────────────────────────────────────────────────────────────────
  function drawRanges() {
    const box = $("#ls-ranges");
    box.innerHTML = rangeKeys().map(k => {
      const r = st.ranges[k] || {};
      return `<div class="range-filter"><span>${esc(metricLabel(k))}</span>
        <input type="number" step="any" class="ls-min" data-key="${k}" placeholder="mín" value="${esc(toInput(k, r.min))}">
        <input type="number" step="any" class="ls-max" data-key="${k}" placeholder="máx" value="${esc(toInput(k, r.max))}"></div>`;
    }).join("");
    const rest = lineupMetrics.filter(k => !rangeKeys().includes(k));
    $("#ls-addm").innerHTML = '<option value="">Agregar métrica…</option>' + rest.map(k => `<option value="${k}">${esc(metricLabel(k))}</option>`).join("");
    $("#ls-addm").hidden = !rest.length;
  }
  drawRanges();
  $("#ls-addm").addEventListener("change", e => {
    if (!e.target.value) return;
    readForm();
    st.ranges[e.target.value] ||= {};
    drawRanges();
  });

  // ── jugadores incluidos y excluidos ─────────────────────────────────────────
  const nameOf = id => {
    const p = players.find(x => String(x.player_id) === String(id));
    return p ? `${p.player} (${p.team_code})` : `Jugador ${id}`;
  };
  function drawChips() {
    for (const kind of ["include", "exclude"]) {
      el.querySelector(`.ls-picker[data-kind="${kind}"] .ls-chips`).innerHTML = st[kind].map(id =>
        `<span class="ls-chip" data-id="${esc(id)}">${esc(nameOf(id))}<button type="button" class="ls-chip-x" aria-label="Quitar" data-kind="${kind}" data-id="${esc(id)}">✕</button></span>`).join("");
    }
    el.querySelectorAll(".ls-chip-x").forEach(b => b.addEventListener("click", () => {
      st[b.dataset.kind] = st[b.dataset.kind].filter(x => x !== b.dataset.id);
      drawChips();
    }));
  }
  el.querySelectorAll(".ls-picker").forEach(picker => {
    const input = picker.querySelector(".ls-pl-input"), sugg = picker.querySelector(".ls-sugg"), kind = picker.dataset.kind;
    const show = () => {
      const q = input.value.trim().toLowerCase();
      const chosen = new Set([...st.include, ...st.exclude]);
      const team = $("#ls-team").value;
      const hits = q.length < 1 ? [] : players.filter(p => p.player_id != null && !chosen.has(String(p.player_id))
        && (!team || p.team_code === team) && String(p.player || "").toLowerCase().includes(q)).slice(0, 8);
      sugg.hidden = false;
      sugg.innerHTML = q.length < 1 ? "" : hits.length
        ? hits.map(p => `<button type="button" class="ls-sugg-item" data-id="${p.player_id}">${esc(p.player)} <span class="td-muted">${esc(p.team_code)}</span></button>`).join("")
        : '<span class="td-muted ls-sugg-empty">Sin coincidencias</span>';
      sugg.hidden = q.length < 1;
      sugg.querySelectorAll(".ls-sugg-item").forEach(b => b.addEventListener("click", () => {
        st[kind].push(b.dataset.id);
        input.value = ""; sugg.hidden = true; drawChips();
      }));
    };
    input.addEventListener("input", show);
    input.addEventListener("blur", () => setTimeout(() => { sugg.hidden = true; }, 200));
  });

  async function loadPlayers() {
    const comp = $("#ls-comp").value;
    if (playersComp === comp && players.length) return;
    try { players = await api.searchPlayers(comp ? { competition: comp } : {}); } catch { players = []; }
    playersComp = comp;
    const teams = [...new Set(players.map(p => p.team_code))].sort();
    $("#ls-team").innerHTML = '<option value="">Equipo (todos)</option>' + teams.map(t => `<option>${esc(t)}</option>`).join("");
    $("#ls-team").value = teams.includes(st.team) ? st.team : "";
    drawChips();
  }

  // ── lectura del formulario y ejecución ──────────────────────────────────────
  function readForm() {
    st.competition = $("#ls-comp").value;
    st.team = $("#ls-team").value || "";
    st.last = $("#ls-last").value;
    st.min_poss = $("#ls-minposs").value.trim();
    st.adjusted = $("#ls-adj").checked;
    for (const k of rangeKeys()) {
      const lo = el.querySelector(`.ls-min[data-key="${k}"]`)?.value.trim(), hi = el.querySelector(`.ls-max[data-key="${k}"]`)?.value.trim();
      const r = {};
      if (lo) r.min = fromInput(k, lo);
      if (hi) r.max = fromInput(k, hi);
      if (Object.keys(r).length) st.ranges[k] = r; else delete st.ranges[k];
    }
  }
  function toParams() {
    const p = {};
    if (st.competition) p.competition = st.competition;
    if (st.team) p.team = st.team;
    if (st.include.length) p.include = st.include.join(",");
    if (st.exclude.length) p.exclude = st.exclude.join(",");
    if (st.min_poss !== "") p.min_poss = st.min_poss;
    p.adjusted = st.adjusted ? "1" : "0";
    if (st.last) p.last = st.last;
    for (const [k, r] of Object.entries(st.ranges)) {
      if (r.min != null) p[`min.${k}`] = r.min;
      if (r.max != null) p[`max.${k}`] = r.max;
    }
    Object.assign(p, ctxFixed || Object.fromEntries(Object.entries(contextParams()).filter(([k]) => k !== "last" && CONTEXT_KEYS.includes(k))));
    return p;
  }

  function showError(msg) { const e = $("#ls-err"); e.textContent = msg || ""; e.hidden = !msg; }

  async function run() {
    readForm();
    showError("");
    const box = $("#ls-results");
    if (table) { table.destroy(); table = null; }
    box.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando quintetos…</p>';
    const params = toParams();
    let payload;
    try { payload = await api.table("lineup_search", params); }
    catch (e) {
      box.innerHTML = "";
      if (!el.isConnected) return;
      if (navigator.onLine === false || e instanceof TypeError) showError("Sin conexión: la búsqueda de quintetos necesita conexión.");
      else if (e.code === "competencia_inexistente") showError("La competencia de esta consulta ya no existe. Elegí otra para ejecutarla.");
      else if (e.status === 400 || e.status === 404) showError(e.message);
      else showError("No se pudo ejecutar la búsqueda. Probá de nuevo.");
      return;
    }
    if (!el.isConnected) return;
    // materializa la competencia resuelta
    const cid = payload.context?.competition?.id;
    if (cid != null) {
      st.competition = String(cid);
      $("#ls-comp").value = st.competition;
      params.competition = st.competition;
      await loadPlayers();
    }
    lastParams = params;
    const info = payload.info || {};
    $("#ls-count").textContent = `${info.matched ?? payload.row_count} quintetos de ${info.total_lineups ?? "?"}`;
    const ex = info.excluded || {};
    const parts = EXCL_LABELS.filter(([k]) => ex[k]).map(([k, l]) => `${ex[k]} ${l}`);
    $("#ls-excl").textContent = parts.length ? `Descartados: ${parts.join(" · ")}.` : "";
    onState?.(params);
    if (!info.total_lineups) { box.innerHTML = '<p class="empty">No hay quintetos para analizar. Importá partidos con play-by-play.</p>'; return; }
    if (!payload.rows.length) { box.innerHTML = '<p class="empty">Ningún quinteto cumple los filtros</p>'; return; }
    box.innerHTML = "";
    table = createDataTable(box, {
      tableId: "lineup_search", payload,
      onRowClick: row => { const team = String(row.id).split(":")[0]; location.hash = `#/equipo/${encodeURIComponent(team)}/quintetos`; },
    });
  }

  $("#ls-go").addEventListener("click", run);
  $("#ls-clear").addEventListener("click", () => {
    Object.assign(st, { team: "", include: [], exclude: [], min_poss: "", adjusted: true, last: "", ranges: {} });
    $("#ls-last").value = ""; $("#ls-minposs").value = ""; $("#ls-adj").checked = true; $("#ls-team").value = "";
    drawRanges(); drawChips(); run();
  });
  $("#ls-save").addEventListener("click", () => { readForm(); onSave?.(lastParams || toParams()); });
  $("#ls-comp").addEventListener("change", async () => {
    st.include = []; st.exclude = []; st.team = "";
    players = []; playersComp = null;
    await loadPlayers();
    run();
  });
  el.querySelectorAll("#ls-minposs, #ls-last").forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") run(); }));

  if (st.competition) await loadPlayers();
  await run();
}
