// Vista search (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { setSection, syncRoute } from "../app.js";
import { mountContextBar } from "../components/context-bar.js";
import { renderCross } from "../components/cross-panel.js";
import { createDataTable } from "../components/data-table.js";
import { renderLineupSearch } from "../components/lineup-search.js";
import { renderSavedQueries, saveQueryDialog } from "../components/saved-queries.js";
import { renderSimilar } from "../components/similar-panel.js";
import { renderTabs } from "../components/tabs.js";
import { contextParams } from "../core/context.js";
import { S } from "../state.js";
import { _openPlayerById, renderPlayer } from "./player.js";
import { esc, toast } from "./shared.js";
import { openTeamLineup } from "./team.js";

// ── Explorar (X-01, F-10): pestañas Jugadores · Quintetos · Consultas ───────────
export const SEARCH_TABS = [["jugadores", "Jugadores"], ["quintetos", "Quintetos"], ["contextos", "Contextos"], ["similares", "Similares"], ["consultas", "Consultas"]];
export const _SEARCH_URL_KEYS = /^(competition|team|player|include|exclude|min_poss|adjusted|last|side|dim_x|dim_y|metric|limit|color|(min|max)\..+)$/;
export function _searchParamsFromUrl() {
  const out = {};
  try { for (const [k, v] of new URL(location.href).searchParams) if (_SEARCH_URL_KEYS.test(k) && v !== "") out[k] = v; } catch { /* sin dirección */ }
  return out;
}
// Parámetros de la búsqueda de quintetos en la dirección; al salir de Explorar se quitan para que no queden colgados.
export function _searchUrlQuery(section) {
  const q = {};
  if (section === "search" && S._searchTab === "quintetos" && S._searchLastParams)
    for (const [k, v] of Object.entries(S._searchLastParams)) if (_SEARCH_URL_KEYS.test(k)) q[k] = v;
  if (section === "search" && S._searchTab === "contextos" && S._cross.team)
    Object.assign(q, { competition: S._cross.competition, last: S._cross.last, team: S._cross.team, side: S._cross.side, dim_x: S._cross.dimX, dim_y: S._cross.dimY,
                       metric: S._cross.metric, limit: S._cross.limit === 8 ? "" : S._cross.limit, color: S._cross.color });
  if (section === "search" && S._searchTab === "similares" && S._simX.player) Object.assign(q, { team: S._simX.team, player: S._simX.player });
  const current = new Set(Object.keys(q));
  for (const k of S._searchKeys) if (!current.has(k)) q[k] = null;
  S._searchKeys = current;
  return q;
}
export async function renderSearch() {
  renderTabs(document.getElementById("search-tabs"), SEARCH_TABS, S._searchTab, t => {
    S._searchInit = null; S._searchStale = false; S._searchTab = t;
    renderSearch();
    syncRoute();
  });
  const main = document.getElementById("search-main");
  if (S._searchTable) { S._searchTable.destroy?.(); S._searchTable = null; }
  // Barra de contexto (T-03): jugadores y contextos aplican también los niveles evento y posesión; quintetos y
  // similares, el nivel partido. Consultas guardadas no la muestra.
  const barHost = document.getElementById("search-ctx-bar");
  if (S._searchTab === "consultas") barHost.innerHTML = "";
  else mountContextBar(barHost, {
    competition: (S._searchTab === "contextos" ? S._cross.competition : S._searchComp) || null,
    events: S._searchTab === "jugadores" || S._searchTab === "contextos",
    onChange: () => { S._searchPayload = null; renderSearch(); syncRoute(); },
  });
  if (S._searchTab === "quintetos") {
    const initial = S._searchInit || S._searchLastParams || {}, stale = S._searchStale;
    S._searchInit = null; S._searchStale = false;
    return renderLineupSearch(main, {
      initial, stale,
      onState: p => { S._searchLastParams = p; syncRoute(); },
      onSave: p => saveQueryDialog({ kind: "quintetos", params: p, notify: toast }),
      onOpenLineup: openTeamLineup,
    });
  }
  if (S._searchTab === "contextos") {
    return renderCross(main, {
      ...S._cross, params: { competition: S._cross.competition || null, last: S._cross.last || null, ...contextParams() },
      onChange: s => { S._cross = { ...S._cross, ...s }; renderSearch(); syncRoute(); },
    });
  }
  if (S._searchTab === "similares") return _renderSearchSimilar(main);
  if (S._searchTab === "consultas") return renderSavedQueries(main, { onRun: openSavedQuery, notify: toast });
  return _renderSearchPlayers();
}
// Explorar › Similares (A-09): elegir equipo y jugador y ver sus jugadores de perfil parecido sin ir a su ficha.
export async function _renderSearchSimilar(main) {
  let teams = [];
  try { teams = await api.teams(); } catch { teams = []; }
  main.innerHTML = `<div class="card"><div class="card-title">Jugadores similares</div><div class="ld-controls">
      <label class="gp-lbl">Equipo<select id="sx-team" class="map-select"><option value="">— Equipo —</option>${teams.map(t =>
        `<option value="${esc(t.code)}"${t.code === S._simX.team ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      <label class="gp-lbl">Jugador<select id="sx-player" class="map-select" ${S._simX.team ? "" : "disabled"}><option value="">— Jugador —</option></select></label></div>
      <p class="td-muted">Perfil parecido dentro de la competencia: uso, reparto de tiro, rebote, asistencias, pérdidas, eficiencia y minutos.</p></div>
    <div id="sx-result">${S._simX.player ? "" : '<p class="empty">Elegí un equipo y un jugador.</p>'}</div>`;
  const teamSel = main.querySelector("#sx-team"), playerSel = main.querySelector("#sx-player");
  teamSel.addEventListener("change", () => { S._simX = { ...S._simX, team: teamSel.value, player: "" }; renderSearch(); syncRoute(); });
  if (S._simX.team) {
    try {
      const list = await api.players(S._simX.team, { competition: S._searchComp || null });
      const rows = Array.isArray(list) ? list : (list.players || []);
      playerSel.innerHTML = '<option value="">— Jugador —</option>' + rows.filter(p => p.player_id != null).map(p =>
        `<option value="${p.player_id}"${String(p.player_id) === String(S._simX.player) ? " selected" : ""}>${esc(p.player_name || p.name)}</option>`).join("");
    } catch { /* sin lista: queda el selector vacío */ }
  }
  playerSel.addEventListener("change", () => { S._simX = { ...S._simX, player: playerSel.value }; renderSearch(); syncRoute(); });
  if (S._simX.player) {
    renderSimilar(main.querySelector("#sx-result"), Number(S._simX.player), {
      params: { competition: S._searchComp || null, ...contextParams() }, position: S._simX.position, minMinutes: S._simX.min,
      onChange: ({ position, minMinutes }) => { S._simX = { ...S._simX, position, min: minMinutes }; renderSearch(); },
      onOpenPlayer: _openPlayerById,
    });
  }
}
// Ejecuta una consulta guardada: abre la pestaña de su tipo con los filtros restaurados.
export async function openSavedQuery(q) {
  const { _saved, ...params } = q.params || {};
  S._searchTab = q.kind; S._searchInit = params; S._searchStale = !!q.stale;
  setSection("search", { sync: false });
  await renderSearch();
  syncRoute();
}
// Grupos de posición del filtro: PG/SG/G → G, SF/PF/F → F, C → C.
export const POSITION_GROUPS = [["G", "Base/Escolta (G)"], ["F", "Alero/Ala-pívot (F)"], ["C", "Pívot (C)"]];
export function _posGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (!p) return null;
  if (p === "C") return "C";
  if (p.includes("F")) return "F";
  if (p.includes("G")) return "G";
  return null;
}
export const SEARCH_METRICS = [
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "oer", label: "OER" }, { key: "uso_pct", label: "USO%", pct: true },
  { key: "ppp", label: "PPP" }, { key: "ppt", label: "PPT" },
  { key: "fg2_pct", label: "FG2%", pct: true }, { key: "fg3_pct", label: "FG3%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "pts", label: "Pts/g" }, { key: "ast", label: "Ast/g" }, { key: "tov", label: "Pérd/g" },
  { key: "stl", label: "Robos/g" }, { key: "blk", label: "Tapas/g" },
  { key: "reb_share", label: "% Reb Eq", pct: true },
  { key: "oreb_share", label: "% RebOf Eq", pct: true }, { key: "dreb_share", label: "% RebDef Eq", pct: true },
  { key: "minutes", label: "Min" }, { key: "plus_minus", label: "+/-" },
];
// Equipos del plantel (para el select de equipo): se leen de la columna _team del payload.
export function _searchTeams() {
  if (!S._searchPayload) return [];
  const idx = S._searchColIdx["_team"];
  if (idx == null) return [];
  return [...new Set(S._searchPayload.rows.map(r => r.values[idx]).filter(Boolean))].sort();
}
export async function _loadSearchPayload() {
  S._searchPayload = await api.table("search_players", { competition: S._searchComp || null, ...contextParams() });
  S._searchColIdx = {};
  S._searchPayload.columns.forEach((c, i) => { S._searchColIdx[c.key] = i; });
  return S._searchPayload;
}
export async function _renderSearchPlayers() {
  const main = document.getElementById("search-main");
  const init = S._searchTab === "jugadores" ? S._searchInit : null;
  if (init) {   // consulta guardada: la competencia se resuelve antes de pedir los promedios
    S._searchInit = null;
    if ((init.competition || "") !== S._searchComp) { S._searchComp = init.competition || ""; S._searchPayload = null; }
  }
  if (!S._searchPayload) {
    main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando buscador...</p>';
    try { await _loadSearchPayload(); }
    catch (e) {
      if (navigator.onLine === false || e instanceof TypeError) main.innerHTML = `<p class="empty below-avg">Sin conexión. No se pudo cargar el buscador.</p>`;
      else main.innerHTML = `<p class="empty below-avg">${e.message || "No se pudo cargar el buscador"}</p>`;
      return;
    }
  }
  if (!S._searchPayload.rows.length && !S._searchComp) { main.innerHTML = `<p class="empty">No hay jugadores importados todavía</p>`; return; }

  const comps = await api.competitions().catch(() => []);
  const teams = _searchTeams();

  main.innerHTML = `
    <div class="card">
      <div class="card-title">Buscador de jugadores</div>
      <div class="search-filters">
        <input type="text" id="sf-name" placeholder="Nombre contiene...">
        <select id="sf-team"><option value="">Equipo (todos)</option>${teams.map(t=>`<option>${t}</option>`).join("")}</select>
        <select id="sf-comp"><option value="">Competencia (todas)</option>${comps.map(c=>`<option value="${c.id}"${String(c.id) === S._searchComp ? " selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
        <select id="sf-pos"><option value="">Posición (todas)</option>${POSITION_GROUPS.map(([v, l])=>`<option value="${v}">${l}</option>`).join("")}</select>
      </div>
      <div class="search-ranges">
        ${SEARCH_METRICS.map(m => `
          <div class="range-filter">
            <span>${m.label}</span>
            <input type="number" step="any" class="sf-min" data-key="${m.key}" data-pct="${m.pct?1:0}" placeholder="mín">
            <input type="number" step="any" class="sf-max" data-key="${m.key}" data-pct="${m.pct?1:0}" placeholder="máx">
          </div>`).join("")}
      </div>
      <div class="search-actions">
        <button class="btn" id="sf-apply">Buscar</button>
        <button class="btn btn-ghost" id="sf-clear">Limpiar</button>
        <button class="btn btn-ghost" id="sf-save">Guardar búsqueda</button>
        <span id="sf-count" class="td-muted"></span>
      </div>
    </div>
    <div id="search-results"></div>`;

  const box = document.getElementById("search-results");
  S._searchTable = createDataTable(box, {
    tableId: "search_players",
    payload: S._searchPayload,
    onRowClick: row => {
      // id del payload = player_id; el nombre/equipo salen de las columnas de texto.
      const name = row.values[S._searchColIdx["_name"]];
      const team = row.values[S._searchColIdx["_team"]];
      setSection("player");
      renderPlayer(team, name, Number(row.id) || null);
    },
  });

  document.getElementById("sf-apply").addEventListener("click", _applySearch);
  // Cambiar de competencia recalcula los promedios en el backend (RF-7)
  document.getElementById("sf-comp").addEventListener("change", async e => {
    S._searchComp = e.target.value;
    box.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando buscador...</p>';
    try { await _loadSearchPayload(); }
    catch { box.innerHTML = '<p class="empty below-avg">No se pudo cargar el buscador</p>'; return; }
    _renderSearchPlayers();
  });
  document.getElementById("sf-clear").addEventListener("click", async () => {
    main.querySelectorAll(".search-filters input, .search-ranges input").forEach(i => i.value = "");
    main.querySelectorAll(".search-filters select").forEach(s => s.value = "");
    if (S._searchComp) {   // volver a "todas las competencias"
      S._searchComp = "";
      try { await _loadSearchPayload(); } catch { return; }
      _renderSearchPlayers();
      return;
    }
    _applySearch();
  });
  document.getElementById("sf-save").addEventListener("click", () =>
    saveQueryDialog({ kind: "jugadores", params: _searchParamsFromForm(), notify: toast }));
  if (init) _restoreSearchForm(init);
  _applySearch();
}
// Filtros del buscador de jugadores como parámetros planos (porcentajes como fracción).
export function _searchParamsFromForm() {
  const p = {};
  const name = document.getElementById("sf-name").value.trim();
  if (name) p.name = name;
  const team = document.getElementById("sf-team").value;
  if (team) p.team = team;
  if (S._searchComp) p.competition = String(S._searchComp);
  const pos = document.getElementById("sf-pos").value;
  if (pos) p.position = pos;
  for (const op of ["min", "max"]) {
    document.querySelectorAll(`.sf-${op}`).forEach(inp => {
      if (inp.value.trim() === "") return;
      const v = parseFloat(inp.value);
      p[`${op}.${inp.dataset.key}`] = String(inp.dataset.pct === "1" ? Math.round(v * 10000) / 1000000 : v);
    });
  }
  return p;
}
export function _restoreSearchForm(p) {
  document.getElementById("sf-name").value = p.name || "";
  document.getElementById("sf-team").value = p.team || "";
  document.getElementById("sf-pos").value = p.position || "";
  for (const op of ["min", "max"]) {
    document.querySelectorAll(`.sf-${op}`).forEach(inp => {
      const v = p[`${op}.${inp.dataset.key}`];
      inp.value = v == null ? "" : String(inp.dataset.pct === "1" ? Math.round(Number(v) * 10000) / 100 : Number(v));
    });
  }
}
export function _applySearch() {
  if (!S._searchTable) return;
  const name = document.getElementById("sf-name").value.trim().toLowerCase();
  const team = document.getElementById("sf-team").value;
  const pos  = document.getElementById("sf-pos").value;
  const ranges = [];
  document.querySelectorAll(".sf-min").forEach(inp => {
    if (inp.value.trim() === "") return;
    const pct = inp.dataset.pct === "1";
    ranges.push({ key: inp.dataset.key, op: "min", val: pct ? parseFloat(inp.value)/100 : parseFloat(inp.value) });
  });
  document.querySelectorAll(".sf-max").forEach(inp => {
    if (inp.value.trim() === "") return;
    const pct = inp.dataset.pct === "1";
    ranges.push({ key: inp.dataset.key, op: "max", val: pct ? parseFloat(inp.value)/100 : parseFloat(inp.value) });
  });

  const nameIdx = S._searchColIdx["_name"], teamIdx = S._searchColIdx["_team"], posIdx = S._searchColIdx["_position"];
  const rowFilter = row => {
    const v = row.values;
    if (name && !String(v[nameIdx] || "").toLowerCase().includes(name)) return false;
    if (team && v[teamIdx] !== team) return false;
    if (pos && _posGroup(v[posIdx]) !== pos) return false;   // sin posición no entra en ninguno
    for (const r of ranges) {
      const idx = S._searchColIdx[r.key];
      const val = idx != null ? v[idx] : null;
      if (val == null) return false;               // null no matchea rango (Feature 08)
      if (r.op === "min" && val < r.val) return false;
      if (r.op === "max" && val > r.val) return false;
    }
    return true;
  };

  // Etiquetas de filtros locales para la cabecera de exportación.
  const labels = [];
  if (name) labels.push({ label: "Nombre contiene", value: name });
  if (team) labels.push({ label: "Equipo", value: team });
  if (pos) labels.push({ label: "Posición", value: (POSITION_GROUPS.find(g => g[0] === pos) || [, pos])[1] });
  for (const r of ranges) {
    const m = SEARCH_METRICS.find(x => x.key === r.key);
    labels.push({ label: `${m ? m.label : r.key} ${r.op === "min" ? "≥" : "≤"}`, value: m?.pct ? `${(r.val * 100).toFixed(1)}%` : r.val });
  }

  S._searchTable.setRowFilter(rowFilter, labels);
  const count = S._searchTable.getState().rows.length;
  document.getElementById("sf-count").textContent = `${count} jugadores`;
}
