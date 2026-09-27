import { api, setUnauthorizedHandler } from "./api.js";
import { drawRadar, drawEvolution, drawPlayerEvolution, drawLeagueScatter, drawCompareRadar, resetZoom } from "./charts.js";
import { PCT, PCT0, DEC1, DEC2, fmtNumber, isNull, nullDisplay, fmtOrNull } from "./core/format.js";

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Stat helpers ───────────────────────────────────────────────────────────
// PCT/DEC1/DEC2 y la regla de nulos viven en core/format.js (C-11).

function statClass(value, avg, higherIsBetter = true) {
  if (value == null || avg == null) return "neutral";
  return (higherIsBetter ? value >= avg : value <= avg) ? "above-avg" : "below-avg";
}

// Comparador único de tablas ordenables: el nulo se APARTA de la comparación en
// vez de recibir un valor extremo, por eso su posición no depende de `dir` — queda
// al final tanto ascendente como descendente (Feature 12 RF-1/RF-2).
function _cmpNullsLast(av, bv, dir) {
  const isNull = v => v == null || (typeof v === "number" && isNaN(v));
  const an = isNull(av), bn = isNull(bv);
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof av === "string" || typeof bv === "string")
    return dir * String(av).localeCompare(String(bv));
  return dir * (av - bv);
}

// `reason`: código de `null_reasons` del backend; si `value` es nulo se muestra "—" con
// esa razón en el title, sea cual sea `display` (C-11 RF-4).
function statBox(label, value, display, leagueKey, league, higherIsBetter = true, reason = null) {
  const lg    = leagueKey ? league?.[leagueKey] : null;
  const avg   = lg?.avg;
  const cls   = statClass(value, avg, higherIsBetter);
  // `def_to_ratio` = (STL+BLK+DR)/TOV es un RATIO, no un porcentaje: sin excluirlo,
  // el `includes("to_")` lo formatea como % y un 3.275 se muestra "327.5%" — la misma
  // familia de valor imposible que reporta C-02 (Feature 14 RF-5).
  // `as_pos` cae en el mismo heurístico por `includes("as_")` y es un ratio (Feature 15 D-6)
  const NOT_PCT = ["def_to_ratio", "as_pos"];
  const isPct = !!leagueKey && !NOT_PCT.includes(leagueKey) &&
    (leagueKey.includes("pct") || leagueKey.includes("or_") || leagueKey.includes("dr_") || leagueKey.includes("to_") || leagueKey.includes("as_"));
  const fmt   = v => v != null ? (isPct ? PCT(v) : DEC2(v)) : "—";
  // El indicador "↑ mejor de la liga" se retiró: era el máximo de la población sin
  // mínimo de muestra y producía valores imposibles (↑ 9900.0%). Su reemplazo es el
  // percentil de T-01 (Feature 14 RF-5, decisión del cliente en ROADMAP §5).
  const context = lg ? `
      <div class="stat-context">
        <span class="avg">Ø ${fmt(avg)}</span>
      </div>` : "";
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${cls}">${isNull(value) ? nullDisplay(reason) : display}</div>
      ${context}
    </div>`;
}

// ── Compute averages from a game_log array (for last-N filter) ─────────────
function _computeAvg(gameLog) {
  // Un DNP no cuenta como partido jugado (Feature 12 RF-6). El backend usa la misma
  // población; si acá no se filtrara, el filtro de últimos N divergiría de `averages`.
  // `played` solo viene en el game log de jugador — en el de equipo es undefined y no filtra.
  gameLog = (gameLog || []).filter(g => g.played !== false);
  const n = gameLog.length;
  if (!n) return {};
  const keys = [
    "oer","der","efg_pct","ts_pct","fg2_pct","fg3_pct",
    "ft_pct","ft_rate","ft_rate_report","pps","ppp",
    "fg2_uso","fg3_uso","peso_1p","peso_2p","peso_3p",
    "or_pct","dr_pct","trb_pct","to_pct","to_ratio","as_pct","ast_ratio",
    "opp_efg_pct","opp_ts_pct","opp_to_pct","opp_ft_rate",
    "pace","pts","possessions","plays",
    "stocks","def_playmaking","def_to_ratio","physical_impact",
    "reb_share","oreb_share","dreb_share",
    "uso_pct","ast_to",   // keys de jugador (ausentes en logs de equipo → null)
    "fgm","fga","fgm2","fga2","fgm3","fga3","ftm","fta",
    "orb","drb","trb","ast","tov","stl","blk","pf",
    "opp_pf","paint_pts","second_chance_pts","pts_from_tov","bench_pts","fast_break_pts",
  ];
  const result = {};
  for (const k of keys) {
    const vals = gameLog.map(g => g[k]).filter(v => v != null && !isNaN(v));
    // null (no 0) cuando ningún partido tiene dato válido para esa tasa
    result[k] = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10000) / 10000 : null;
  }
  result.net_rating = (result.oer != null && result.der != null)
    ? Math.round((result.oer - result.der) * 10000) / 10000
    : null;
  // DEF/TO acumulado (pooled, DA-02), mismo criterio que el backend (C-11)
  const sum = k => gameLog.reduce((s, g) => s + (g[k] || 0), 0);
  const tov = sum("tov");
  result.def_to_ratio = tov ? Math.round(((sum("stl") + sum("blk") + sum("drb")) / tov) * 10000) / 10000 : null;
  // Razón de cada nulo: la que comparten los partidos del filtro; si difieren, genérica.
  result.null_reasons = {};
  for (const [k, v] of Object.entries(result)) {
    if (v != null) continue;
    const rs = new Set(gameLog.map(g => g.null_reasons?.[k]).filter(Boolean));
    result.null_reasons[k] = rs.size === 1 ? [...rs][0] : "sin_intentos";
  }
  return result;
}

// ── Filtro por competencia (compartido: Liga/Equipo/Comparar/Jugador) ────────
// Por id de competencia (F-11): el texto de FIBA puede renombrarse o fusionarse.
// `comps` = [{id, label}] (de /api/competitions o del game log).
function _logComps(gameLog) {
  const byId = new Map();
  (gameLog || []).forEach(g => {
    if (g.competition_id != null) byId.set(String(g.competition_id), g.competition_label || "—");
  });
  return [...byId].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
}
function _filterByComp(gameLog, comp) {
  return comp ? (gameLog || []).filter(g => String(g.competition_id) === String(comp)) : gameLog;
}
function _compOptions(comps, selected = "", allLabel = "Todas las competencias") {
  return `<option value="">${allLabel}</option>` +
    comps.map(c => `<option value="${c.id}"${String(c.id) === String(selected) ? " selected" : ""}>${esc(c.label)}</option>`).join("");
}

// Escapa texto para insertarlo en HTML (nombres editables por el usuario, p. ej. competencias).
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ── Four Factors card ──────────────────────────────────────────────────────
function _fourFactorsCard(av, teamName) {
  const factors = [
    { label: "eFG%",    team: av.efg_pct,     opp: av.opp_efg_pct, fmt: PCT, hib: true,  title: "Eficiencia de tiro ajustada" },
    { label: "TO%",     team: av.to_pct,      opp: av.opp_to_pct,  fmt: PCT, hib: false, title: "Cuidado del balón" },
    // RebOf% rival = 1 − DR% propio; con DR% nulo el resultado es nulo, no 100% (C-11 RF-6)
    { label: "RebOf%",  team: av.or_pct,      opp: av.dr_pct == null ? null : 1 - av.dr_pct, fmt: PCT, hib: true, title: "Segundas oportunidades" },
    { label: "FT Rate", team: av.ft_rate,     opp: av.opp_ft_rate, fmt: DEC2, hib: true,  title: "Agresividad hacia el aro (FTA/FGA)" },
  ];

  const rows = factors.map(f => {
    const tWins = f.team != null && f.opp != null && (f.hib ? f.team > f.opp : f.team < f.opp);
    const oWins = f.team != null && f.opp != null && (f.hib ? f.opp > f.team : f.opp < f.team);
    return `
      <tr title="${f.title}">
        <td class="td-muted" style="font-weight:600;min-width:72px">${f.label}</td>
        <td class="${tWins ? 'above-avg' : oWins ? 'below-avg' : ''}" style="text-align:right;font-weight:700">${f.fmt(f.team)}</td>
        <td style="text-align:center;color:var(--border2);padding:0 6px">vs</td>
        <td class="${oWins ? 'above-avg' : tWins ? 'below-avg' : ''}" style="text-align:left;font-weight:700">${f.fmt(f.opp)}</td>
      </tr>`;
  }).join("");

  return `
    <div class="card">
      <div class="card-title">Four Factors <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${teamName} vs Rival</span></div>
      <div class="table-wrap">
        <table style="font-size:13px">
          <thead><tr>
            <th>Factor</th>
            <th style="text-align:right;color:var(--accent)">${teamName}</th>
            <th></th>
            <th style="text-align:left;color:var(--muted)">Rival Ø</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Record badge ────────────────────────────────────────────────────────────
function _recordCard(record, teamName) {
  if (!record) return "";
  const pct = PCT0(record.win_pct);
  return `
    <div class="card" style="display:flex;align-items:center;gap:var(--sp-5);flex-wrap:wrap">
      <div>
        <div class="stat-label">Récord</div>
        <div style="font-size:28px;font-weight:800;line-height:1.1">
          <span class="above-avg">${record.wins}</span>
          <span style="color:var(--border2);margin:0 4px">-</span>
          <span class="below-avg">${record.losses}</span>
        </div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">% Victorias</div>
        <div class="stat-value">${pct}</div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">Local</div>
        <div class="stat-value">${record.home}</div>
      </div>
      <div class="stat-box" style="flex:1;min-width:80px">
        <div class="stat-label">Visitante</div>
        <div class="stat-value">${record.away}</div>
      </div>
    </div>`;
}

// ── Team selector (module-level so renderImport can call it) ───────────────
async function refreshTeamSelector() {
  const teamSel = document.getElementById("team-select");
  if (!teamSel) return;
  const current = teamSel.value;
  const teams = await api.teams().catch(() => []);
  teamSel.innerHTML = '<option value="">— Seleccionar equipo —</option>' +
    teams.map(t => `<option value="${t.code}">${t.name} (${t.games}p)</option>`).join("");
  if (current) teamSel.value = current;
}

async function refreshCompareSelectors() {
  const teams = await api.teams().catch(() => []);
  const opts = '<option value="">— Equipo —</option>' +
    teams.map(t => `<option value="${t.code}">${t.name}</option>`).join("");
  ["compare-a", "compare-b"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  // Selector de competencia (solo si hay >1 competencia en la base)
  const compSel = document.getElementById("compare-comp");
  if (compSel) {
    const comps = await api.competitions().catch(() => []);
    compSel.style.display = comps.length > 1 ? "" : "none";
    compSel.innerHTML = _compOptions(comps, compSel.value || "");
  }
}

// ── Nav ────────────────────────────────────────────────────────────────────
const sections = ["import", "league", "team", "compare", "player", "search"];
let activeSection = "import";

function setSection(id) {
  activeSection = id;
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("active", b.dataset.section === id));
  document.querySelectorAll(".section").forEach(s => s.style.display = s.id === `sec-${id}` ? "" : "none");
}

// ── Import section ─────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
let importPage    = 0;
let selectMode    = false;
let selectedGames = new Set();
let _seedEnabled  = false;  // dev-only seed button (set from /api/me at boot)
let _authRequired = false;  // whether the backend requires login
let _authUser     = null;   // logged-in username (when auth required)
let _isAdmin      = false;  // puede modificar datos (F-11, /api/me → is_admin)
let _importTab    = "importar";   // importar · calidad · competencias (F-11)
let _catalogComp  = "";     // filtro del catálogo por competencia
let _qualityComp  = "";     // competencia elegida en Calidad de datos

function _fmtDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

// Estado de datos de un partido en el catálogo (F-11)
function _dataBadges(g) {
  const b = [];
  if (g.competition_status === "borrador") b.push('<span class="badge badge-muted">Borrador</span>');
  if (!g.has_pbp) b.push('<span class="badge badge-warn">Sin PBP</span>');
  else if (!g.has_coords) b.push('<span class="badge badge-muted">Sin coordenadas</span>');
  if (g.needs_reprocess) b.push('<span class="badge badge-warn">Reprocesar</span>');
  return b.join(" ") || '<span class="badge badge-ok">OK</span>';
}

function _gamesTable(games, page, emptyMsg = "Sin partidos aún.") {
  if (!games.length) return `<p class="empty">${emptyMsg}</p>`;
  const totalPages = Math.ceil(games.length / PAGE_SIZE);
  const slice = games.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pagination = totalPages > 1 ? `
    <div class="pagination">
      <button class="btn btn-ghost btn-sm" id="pg-prev" ${page === 0 ? "disabled" : ""}>← Ant.</button>
      <span class="pagination-label">Página ${page + 1} / ${totalPages}</span>
      <button class="btn btn-ghost btn-sm" id="pg-next" ${page >= totalPages - 1 ? "disabled" : ""}>Sig. →</button>
    </div>` : "";

  const cbHeader = selectMode ? "<th></th>" : "";
  const rows = slice.map(g => {
    const id      = g.game_id || "";
    const checked = selectedGames.has(id) ? "checked" : "";
    const selCls  = selectedGames.has(id) ? " selected-row" : "";
    const cbCell  = selectMode
      ? `<td><input type="checkbox" class="row-cb" data-id="${id}" ${checked}></td>`
      : "";
    return `<tr data-game-id="${id}" class="${selCls}">
      ${cbCell}
      <td class="td-muted">${_fmtDate(g.date)}</td>
      <td class="td-team">${g.home_team || "—"}</td>
      <td class="td-result">${g.home_score ?? "—"} – ${g.away_score ?? "—"}</td>
      <td class="td-team">${g.away_team || "—"}</td>
      <td class="td-comp">${esc(g.competition_label || g.competition || "—")}</td>
      <td>${_dataBadges(g)}</td>
    </tr>`;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${cbHeader}<th>Fecha</th><th>Local</th><th>Result.</th><th>Visitante</th><th>Competencia</th><th>Estado</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagination}`;
}

// Tras un cambio de datos (importar, borrar, reprocesar, editar competencias) los
// selectores y el buscador cacheado quedan viejos.
function _afterDataChange() {
  _searchData = null;
  refreshTeamSelector();
  refreshCompareSelectors();
}

// El borrado se autoriza con la sesión (admin, F-11); no pide token (C-11 RF-14).
function _showDeleteModal(count, ids) {
  _formModal({
    title: `Eliminar partido${count > 1 ? "s" : ""}`,
    text: `¿Eliminar ${count} partido${count > 1 ? "s" : ""}? Se eliminará toda la información asociada (estadísticas, jugadores, tiros). Esta acción no se puede deshacer.`,
    confirm: "Eliminar", danger: true,
    onSubmit: async () => {
      await api.deleteGames(ids);
      toast(`${count} partido${count > 1 ? "s" : ""} eliminado${count > 1 ? "s" : ""}`);
      selectMode = false;
      selectedGames.clear();
      importPage = 0;
      renderImport();
      _afterDataChange();
    },
  });
}

// Modal con formulario. `fields`: [{name, label, type: "text"|"select", value, options:[{value,label}]}].
// Si `onSubmit(values)` lanza, se muestra el error y el modal queda abierto.
function _formModal({ title, text = "", fields = [], confirm = "Guardar", danger = false, onSubmit }) {
  const field = f => f.type === "select"
    ? `<label class="modal-field">${f.label}<select name="${f.name}">${f.options.map(o =>
        `<option value="${o.value}"${String(o.value) === String(f.value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select></label>`
    : `<label class="modal-field">${f.label}<input name="${f.name}" type="text" value="${esc(f.value)}" placeholder="${esc(f.placeholder)}"></label>`;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal">
      <h3>${title}</h3>
      ${text ? `<p>${text}</p>` : ""}
      ${fields.map(field).join("")}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-sm${danger ? " btn-danger" : ""}">${confirm}</button>
      </div>
    </form>`;
  document.body.appendChild(backdrop);
  const form = backdrop.querySelector("form");
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop || e.target.hasAttribute("data-cancel")) backdrop.remove();
  });
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)));
      backdrop.remove();
    } catch (err) {
      toast(err.message, "err");
      btn.disabled = false;
    }
  });
  form.querySelector("input, select")?.focus();
}

// Reproceso por lotes (F-11): el backend procesa un lote por petición y el cliente encadena
// con `next_offset`. `onProgress(hechos, total)` actualiza la UI.
async function _runReprocess(target, onProgress) {
  const body = target.competitionId != null ? { competition_id: target.competitionId } : { game_ids: target.gameIds };
  let processed = 0, failed = [], total = target.gameIds ? target.gameIds.length : 0;
  try {
    let offset = 0;
    while (offset != null) {
      const r = await api.reprocess({ ...body, offset });
      processed += r.processed.length; failed = failed.concat(r.failed); total = r.total;
      offset = r.next_offset;
      onProgress?.(processed + failed.length, total);
    }
    toast(`Reprocesados ${processed} partidos (${failed.length} con error).`, failed.length ? "err" : "ok");
    failed.slice(0, 3).forEach(f => toast(`No se pudo reprocesar ${f.game_id}: ${f.error}`, "err"));
  } catch (e) {
    toast(`El reproceso se detuvo en ${processed + failed.length} de ${total}: ${e.message}`, "err");
  }
  _afterDataChange();
}

const IMPORT_TABS = [["importar", "Importar"], ["calidad", "Calidad de datos"], ["competencias", "Competencias"]];

// Sección Datos (F-11): pestañas Importar · Calidad de datos · Competencias.
function renderImport() {
  const sec = document.getElementById("sec-import");
  sec.innerHTML = `
    <div class="filter-pills import-tabs">
      ${IMPORT_TABS.map(([id, lbl]) =>
        `<button class="filter-pill${id === _importTab ? " active" : ""}" data-tab="${id}">${lbl}</button>`).join("")}
    </div>
    <div id="import-tab"></div>`;
  sec.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => {
    _importTab = b.dataset.tab;
    renderImport();
  }));
  const el = document.getElementById("import-tab");
  if (_importTab === "calidad") return _renderQualityTab(el);
  if (_importTab === "competencias") return _renderCompetitionsTab(el);
  return _renderImportTab(el);
}

const _compLabel = c => c.status === "borrador" ? `${c.label} (borrador)` : c.label;

async function _renderImportTab(el) {
  const comps = await api.competitions(true).catch(() => []);
  if (!comps.some(c => String(c.id) === String(_catalogComp))) _catalogComp = "";
  const games = await api.games(_catalogComp).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  const hasSel = selectMode && selectedGames.size > 0;

  el.innerHTML = `
    <div class="card">
      <div class="card-title">Importar partido desde FIBA LiveStats</div>
      <div class="import-panel">
        <input id="url-input" type="text" placeholder="https://fibalivestats.dcd.shared.geniussports.com/u/FUBB/2741550/bs.html" />
        <button class="btn" id="btn-import">Importar</button>
      </div>
      <p class="import-hint">El sistema captura los datos automáticamente desde la URL de FIBA LiveStats.</p>
      ${_seedEnabled ? `
      <div class="seed-panel">
        <button class="btn btn-seed" id="btn-seed">⚡ Agregar partidos (dev)</button>
        <span class="seed-hint">Importa el set fijo de partidos de prueba (solo entorno dev).</span>
      </div>` : ""}
    </div>
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Partidos importados (${games ? games.length : 0})</div>
        <div class="games-header-actions">
          ${comps.length > 1 ? `<select id="catalog-comp" class="map-select">${_compOptions(
            comps.map(c => ({ id: c.id, label: _compLabel(c) })), _catalogComp)}</select>` : ""}
          ${_isAdmin ? `<button class="btn btn-ghost btn-sm" id="btn-select-mode">${selectMode ? "Cancelar" : "Seleccionar partidos"}</button>` : ""}
        </div>
      </div>
      ${_isAdmin && selectMode ? `
      <div class="games-header-actions sel-actions" id="sel-actions" style="${hasSel ? "" : "display:none"}">
        ${comps.length > 1 ? '<button class="btn btn-ghost btn-sm" id="btn-move-sel">Mover a competencia…</button>' : ""}
        <button class="btn btn-ghost btn-sm" id="btn-reprocess-sel">Reprocesar</button>
        <button class="btn-delete-sel" id="btn-delete-sel">🗑 Eliminar</button>
      </div>` : ""}
      <div id="games-table">${games
        ? _gamesTable(games, importPage, _catalogComp ? "No hay partidos en esta competencia." : "Sin partidos aún.")
        : '<p class="empty below-avg">No se pudo cargar el catálogo de partidos.</p>'}</div>
    </div>`;

  const refresh = () => renderImport();

  document.getElementById("btn-import").addEventListener("click", async () => {
    const url = document.getElementById("url-input").value.trim();
    if (!url) return toast("Ingresa una URL", "err");
    const btn = document.getElementById("btn-import");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Importando...';
    try {
      const res = await api.importGame(url);
      const teamNames = (res.teams || []).map(t => t.name).join(" vs ");
      toast(`Partido importado: ${teamNames}${res.competition_label ? ` · ${res.competition_label}` : ""}`);
      importPage = 0;
      refresh();
      _afterDataChange();
    } catch (e) {
      toast(navigator.onLine === false ? "Sin conexión. Revisá tu red e intentá de nuevo." : e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importar";
    }
  });

  document.getElementById("btn-seed")?.addEventListener("click", async e => {
    const seedBtn = e.currentTarget;
    seedBtn.disabled = true;
    seedBtn.innerHTML = '<span class="spinner"></span>Importando partidos...';
    try {
      const res = await api.seed();
      toast(`Seed: ${res.imported} importados, ${res.failed} fallidos`, res.failed ? "err" : "ok");
      importPage = 0;
      refresh();
      _afterDataChange();
    } catch (err) {
      toast(err.message, "err");
      seedBtn.disabled = false;
      seedBtn.textContent = "⚡ Agregar partidos (dev)";
    }
  });

  document.getElementById("catalog-comp")?.addEventListener("change", e => {
    _catalogComp = e.target.value;
    importPage = 0;
    selectedGames.clear();   // no actuar sobre partidos que el filtro dejó fuera de vista
    refresh();
  });

  document.getElementById("btn-select-mode")?.addEventListener("click", () => {
    selectMode = !selectMode;
    selectedGames.clear();
    refresh();
  });

  el.querySelectorAll(".row-cb").forEach(cb => cb.addEventListener("change", () => {
    cb.checked ? selectedGames.add(cb.dataset.id) : selectedGames.delete(cb.dataset.id);
    cb.closest("tr")?.classList.toggle("selected-row", cb.checked);
    const actions = document.getElementById("sel-actions");
    if (actions) actions.style.display = selectedGames.size ? "" : "none";
  }));

  const page = delta => { importPage += delta; refresh(); };
  document.getElementById("pg-prev")?.addEventListener("click", () => page(-1));
  document.getElementById("pg-next")?.addEventListener("click", () => page(1));

  document.getElementById("btn-delete-sel")?.addEventListener("click", () => {
    if (selectedGames.size) _showDeleteModal(selectedGames.size, [...selectedGames]);
  });

  document.getElementById("btn-move-sel")?.addEventListener("click", () => {
    const ids = [...selectedGames];
    _formModal({
      title: "Mover a competencia",
      text: `${ids.length} partido${ids.length > 1 ? "s" : ""} pasan a la competencia elegida. La asignación se conserva al reprocesar.`,
      fields: [{ name: "comp", label: "Competencia", type: "select",
                 options: comps.map(c => ({ value: c.id, label: _compLabel(c) })) }],
      confirm: "Mover",
      onSubmit: async v => {
        let moved = 0;
        try {
          for (const id of ids) { await api.assignGame(id, Number(v.comp)); moved++; }
        } finally {
          if (moved) {
            selectMode = false;
            selectedGames.clear();
            refresh();
            _afterDataChange();
          }
        }
        toast(`${moved} partido${moved > 1 ? "s" : ""} movido${moved > 1 ? "s" : ""}.`);
      },
    });
  });

  document.getElementById("btn-reprocess-sel")?.addEventListener("click", async e => {
    const btn = e.currentTarget, ids = [...selectedGames];
    btn.disabled = true;
    await _runReprocess({ gameIds: ids }, (done, total) => { btn.textContent = `Reprocesando ${done} de ${total}…`; });
    selectMode = false;
    selectedGames.clear();
    refresh();
  });
}

// Orden y copy de los chequeos del informe de calidad (F-11)
const QUALITY_CHECKS = [
  ["games_without_pbp",       "Partidos sin play-by-play"],
  ["games_missing_data",      "Partidos con datos básicos faltantes"],
  ["games_needing_reprocess", "Partidos pendientes de reproceso"],
  ["pbp_box_mismatch",        "Play-by-play que no cuadra con el box score"],
  ["lineup_inconsistencies",  "Quintetos inconsistentes"],
  ["games_without_coords",    "Partidos sin coordenadas de tiro"],
  ["null_fields",             "Campos nulos"],
  ["possible_duplicates",     "Jugadores posiblemente duplicados"],
  ["possession_gaps",         "Posesiones que no cerraron correctamente"],
];

function _qualityCheckCard(title, c, key) {
  if (!c) return "";
  const incomplete = c.counts_as_incomplete;
  const badge = c.status === "ok" ? '<span class="badge badge-ok">OK</span>'
    : c.status === "no_disponible" ? '<span class="badge badge-muted">No disponible</span>'
    : `<span class="badge ${incomplete ? "badge-warn" : "badge-muted"}">${c.count} ${incomplete ? "incompleto(s)" : "aviso(s)"}</span>`;
  let body = "";
  if (c.status === "no_disponible") {
    body = '<p class="td-muted">Disponible cuando se implemente el motor de posesiones.</p>';
  } else if (key === "null_fields") {
    body = `<div class="table-wrap"><table>
      <thead><tr><th>Campo</th><th style="text-align:right">Nulos</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${c.items.map(i => `<tr>
        <td>${i.label}</td><td style="text-align:right">${i.nulls} / ${i.total}</td>
        <td style="text-align:right" class="${i.nulls ? "" : "td-muted"}">${PCT(i.pct)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  } else if (c.items.length) {
    const line = key === "possible_duplicates"
      ? i => `<li><b>${i.team_code}</b> · ${i.variants.map(v => `${esc(v.player_name)} (${v.games} PJ)`).join(" / ")}</li>`
      : i => `<li>${_fmtDate(i.date)} · ${esc(i.label)}${i.team_code ? ` · <b>${i.team_code}</b>` : ""}${i.detail ? ` — <span class="td-muted">${esc(i.detail)}</span>` : ""}</li>`;
    body = `<details${c.items.length <= 5 ? " open" : ""}><summary>Ver ${c.items.length}</summary>
      <ul class="quality-items">${c.items.map(line).join("")}</ul></details>`;
  }
  return `
    <div class="card quality-check">
      <div class="games-header"><div class="card-title" style="margin:0">${title}</div>${badge}</div>
      ${body}
    </div>`;
}

async function _renderQualityTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Revisando la competencia…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!comps.length) {
    el.innerHTML = '<p class="empty">Todavía no hay competencias. Importá un partido para crear la primera.</p>';
    return;
  }
  if (!comps.some(c => String(c.id) === String(_qualityComp))) _qualityComp = String(comps[0].id);

  const requested = _qualityComp;
  let rep;
  try { rep = await api.dataQuality(requested); }
  catch { if (requested === _qualityComp) el.innerHTML = '<p class="empty below-avg">No se pudo generar el informe de calidad.</p>'; return; }
  if (!el.isConnected || requested !== _qualityComp) return;   // llegó tarde: otra competencia elegida
  const comp = rep.competition, s = rep.summary;
  const isDraft = comp.status === "borrador";

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <select id="quality-comp" class="map-select">${comps.map(c =>
          `<option value="${c.id}"${String(c.id) === _qualityComp ? " selected" : ""}>${esc(_compLabel(c))}</option>`).join("")}</select>
        ${_isAdmin ? `<div class="games-header-actions">
          <button class="btn btn-ghost btn-sm" id="btn-reprocess-comp"${s.games ? "" : " disabled"}>Reprocesar competencia</button>
          <button class="btn btn-sm${isDraft ? "" : " btn-ghost"}" id="btn-publish">${isDraft ? "Publicar" : "Pasar a borrador"}</button>
        </div>` : ""}
      </div>
      ${s.games ? `
      <div class="quality-summary">
        <span class="badge ${s.ready_to_publish ? "badge-ok" : "badge-warn"}">${s.ready_to_publish ? "Lista para publicar" : "Revisar antes de publicar"}</span>
        <span>${s.games} partidos · ${s.incomplete_games} incompletos · ${isDraft ? "en borrador (oculta fuera de Datos)" : "publicada"}</span>
      </div>` : '<p class="empty">Esta competencia no tiene partidos.</p>'}
    </div>
    ${s.games ? QUALITY_CHECKS.map(([k, t]) => _qualityCheckCard(t, rep.checks[k], k)).join("") : ""}`;

  document.getElementById("quality-comp").addEventListener("change", e => {
    _qualityComp = e.target.value;
    _renderQualityTab(el);
  });

  document.getElementById("btn-reprocess-comp")?.addEventListener("click", async e => {
    const btn = e.currentTarget;
    btn.disabled = true;
    await _runReprocess({ competitionId: comp.id }, (done, total) => { btn.textContent = `Reprocesando ${done} de ${total}…`; });
    _renderQualityTab(el);
  });

  document.getElementById("btn-publish")?.addEventListener("click", () => {
    const setStatus = async status => {
      await api.updateCompetition(comp.id, { status });
      toast(status === "publicada" ? "Competencia publicada." : "Competencia pasada a borrador.");
      _afterDataChange();
      _renderQualityTab(el);
    };
    if (isDraft && s.incomplete_games === 0) return setStatus("publicada").catch(err => toast(err.message, "err"));
    _formModal(isDraft
      ? { title: "Publicar competencia", text: `Hay ${s.incomplete_games} partidos incompletos. ¿Publicar igual?`,
          confirm: "Publicar igual", onSubmit: () => setStatus("publicada") }
      : { title: "Pasar a borrador", text: "Sus partidos dejan de verse en Liga, Equipo, Jugador, Comparar y Buscar hasta que la publiques.",
          confirm: "Pasar a borrador", onSubmit: () => setStatus("borrador") });
  });
}

async function _renderCompetitionsTab(el) {
  el.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando competencias…</p>';
  const comps = await api.competitions(true).catch(() => null);
  if (!el.isConnected) return;   // se cambió de pestaña mientras cargaba
  if (!comps) { el.innerHTML = '<p class="empty below-avg">No se pudieron cargar las competencias.</p>'; return; }

  el.innerHTML = `
    <div class="card">
      <div class="games-header">
        <div class="card-title" style="margin:0">Competencias y temporadas</div>
        ${_isAdmin ? '<button class="btn btn-ghost btn-sm" id="btn-new-comp">Nueva competencia</button>' : ""}
      </div>
      ${comps.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Competencia</th><th>Estado</th><th>PJ</th><th>Equipos</th><th>Fechas</th>${_isAdmin ? "<th></th>" : ""}</tr></thead>
        <tbody>${comps.map(c => `
          <tr data-id="${c.id}">
            <td class="td-team">${esc(c.label)}</td>
            <td><span class="badge ${c.status === "publicada" ? "badge-ok" : "badge-muted"}">${c.status === "publicada" ? "Publicada" : "Borrador"}</span></td>
            <td>${c.games}</td>
            <td>${c.teams}</td>
            <td class="td-muted">${c.first_date ? `${_fmtDate(c.first_date)} – ${_fmtDate(c.last_date)}` : "—"}</td>
            ${_isAdmin ? `<td class="comp-actions">
              <button class="btn btn-ghost btn-sm" data-act="edit">Editar</button>
              ${comps.length > 1 ? '<button class="btn btn-ghost btn-sm" data-act="merge">Fusionar en…</button>' : ""}
            </td>` : ""}
          </tr>`).join("")}</tbody>
      </table></div>` : '<p class="empty">Todavía no hay competencias. Importá un partido para crear la primera.</p>'}
    </div>`;

  const done = msg => { toast(msg); _afterDataChange(); _renderCompetitionsTab(el); };
  const statusOptions = [{ value: "publicada", label: "Publicada" }, { value: "borrador", label: "Borrador (oculta fuera de Datos)" }];

  document.getElementById("btn-new-comp")?.addEventListener("click", () => _formModal({
    title: "Nueva competencia",
    fields: [{ name: "name", label: "Nombre", placeholder: "Liga Uruguaya de Básquetbol" },
             { name: "season", label: "Temporada (opcional)", placeholder: "2025/2026" }],
    onSubmit: async v => { await api.createCompetition(v); done("Competencia guardada."); },
  }));

  el.querySelectorAll("[data-act]").forEach(btn => btn.addEventListener("click", () => {
    const c = comps.find(x => String(x.id) === btn.closest("tr").dataset.id);
    if (btn.dataset.act === "edit") {
      _formModal({
        title: "Editar competencia",
        fields: [{ name: "name", label: "Nombre", value: c.name },
                 { name: "season", label: "Temporada (opcional)", value: c.season || "" },
                 { name: "status", label: "Estado", type: "select", value: c.status, options: statusOptions }],
        onSubmit: async v => { await api.updateCompetition(c.id, v); done("Competencia guardada."); },
      });
    } else {
      _formModal({
        title: `Fusionar «${esc(c.label)}»`,
        text: `Todos sus partidos (${c.games}) pasan a la competencia elegida y «${esc(c.label)}» deja de existir.`,
        fields: [{ name: "target", label: "Fusionar en", type: "select",
                   options: comps.filter(x => x.id !== c.id).map(x => ({ value: x.id, label: _compLabel(x) })) }],
        confirm: "Fusionar", danger: true,
        onSubmit: async v => { await api.mergeCompetition(Number(v.target), c.id); done("Competencias fusionadas."); },
      });
    }
  }));
}

// ── League section — sortable table ───────────────────────────────────────
let _leagueTeams    = [];
let _leagueSortKey  = "oer";
let _leagueSortDir  = -1; // -1 desc, 1 asc
let _leagueMap      = "ef";
let _leagueComp     = ""; // "" = todas las competencias

// Scatter map presets — each defines the X/Y axes for el mapa de liga.
// Cada eje declara la dirección de su métrica (`higher` | `lower` | `neutral`) y el título se arma
// con `_mapAxis`: nunca escribir la flecha a mano (C-10). `xLabel`/`yLabel` = nombre largo del
// título si difiere del corto (`xName`/`yName`, usado en tooltip y línea de promedio).
const LEAGUE_MAPS = [
  {
    id: "ef", label: "Eficiencia (OER / DER)",
    axis: { xKey: "oer", xName: "OER", xDir: "higher", xQual: "mejor ataque", xPct: false,
            yKey: "der", yName: "DER", yDir: "lower",  yQual: "mejor defensa", yPct: false },
    hint: "Derecha = mejor ataque (OER alto) &nbsp;|&nbsp; Abajo = mejor defensa (DER bajo) &nbsp;|&nbsp; Abajo-derecha = elite",
  },
  {
    id: "reb", label: "Rebotes (OR% / DR%)",
    axis: { xKey: "or_pct", xName: "OR%", xDir: "higher", xQual: "mejor", xPct: true,
            yKey: "dr_pct", yName: "DR%", yDir: "higher", yQual: "mejor", yPct: true },
    hint: "Derecha = mejor rebote ofensivo &nbsp;|&nbsp; Arriba = mejor rebote defensivo &nbsp;|&nbsp; Arriba-derecha = domina ambos tableros",
  },
  {
    id: "rec", label: "Recuperos / Puntos",
    axis: { xKey: "stl", xName: "Recuperos", xLabel: "Recuperos por partido", xDir: "higher", xQual: "más robos", xPct: false,
            yKey: "pts", yName: "Puntos",    yLabel: "Puntos por partido",    yDir: "higher", yQual: "más puntos", yPct: false },
    hint: "Derecha = más robos &nbsp;|&nbsp; Arriba = más puntos &nbsp;|&nbsp; Arriba-derecha = elite",
  },
];

// Flecha hacia el lado de la pantalla donde está el mejor rendimiento. El eje Y no está invertido
// (`reverse: false` en drawLeagueScatter): los valores crecen hacia arriba.
const AXIS_ARROWS = { x: { higher: "→", lower: "←" }, y: { higher: "↑", lower: "↓" } };

function _axisTitle(name, dir, orient, qual) {
  const arrow = AXIS_ARROWS[orient][dir];
  return arrow ? `${name}  (${arrow} ${qual})` : name;   // métrica neutral: sin flecha de "mejor"
}

function _mapAxis(a) {
  return {
    ...a,
    xTitle: _axisTitle(a.xLabel || a.xName, a.xDir, "x", a.xQual),
    yTitle: _axisTitle(a.yLabel || a.yName, a.yDir, "y", a.yQual),
    xAvgLabel: `Prom. ${a.xName}`,
    yAvgLabel: `Prom. ${a.yName}`,
  };
}

const LEAGUE_COLS = [
  { key: null,           label: "#" },
  { key: "team_name",    label: "Equipo" },
  { key: "games",        label: "PJ",    title: "Partidos" },
  { key: "oer",          label: "OER",   title: "Eficiencia Ofensiva" },
  { key: "der",          label: "DER",   title: "Eficiencia Defensiva" },
  { key: "net_rating",   label: "NRtg",  title: "Rating Neto" },
  { key: "efg_pct",      label: "eFG%",  title: "Effective FG%" },
  { key: "ts_pct",       label: "TS%",   title: "True Shooting%" },
  { key: "or_pct",       label: "OR%",   title: "Rebote Ofensivo%" },
  { key: "dr_pct",       label: "DR%",   title: "Rebote Defensivo%" },
  { key: "to_pct",       label: "TO%",   title: "Turnover%" },
  { key: "pace",         label: "Pace",  title: "Pace" },
  { key: "pts",          label: "Pts",   title: "Puntos por partido" },
];

// C-09 — tabla de posiciones clásica: 2 puntos por ganado, 1 por perdido.
// Se alimenta del mismo `_leagueTeams` que el ranking: sin fetch adicional.
// Ordena por puntos de tabla; desempata por diferencia de puntos (Feature 17 RF-4).
function _standingsCardHTML(teams) {
  if (!teams?.length) return "";
  const rows = [...teams].sort((a, b) =>
    (b.table_points ?? 0) - (a.table_points ?? 0) ||
    ((b.pts_for ?? 0) - (b.pts_against ?? 0)) - ((a.pts_for ?? 0) - (a.pts_against ?? 0)));
  const th = ["Equipo", "PJ", "PG", "PP", "Pts", "PF", "PC"]
    .map((h, i) => `<th${i ? ' style="text-align:right"' : ""}>${h}</th>`).join("");
  const body = rows.map(t => `
    <tr data-code="${t.team_code}">
      <td>${t.team_name}</td>
      <td style="text-align:right">${t.games ?? "—"}</td>
      <td style="text-align:right">${t.wins ?? "—"}</td>
      <td style="text-align:right">${t.losses ?? "—"}</td>
      <td style="text-align:right;font-weight:700">${t.table_points ?? "—"}</td>
      <td style="text-align:right">${t.pts_for ?? "—"}</td>
      <td style="text-align:right">${t.pts_against ?? "—"}</td>
    </tr>`).join("");
  return `
    <div class="card">
      <div class="card-title">Tabla general</div>
      <div class="table-wrap">
        <table id="standings-table" class="search-table">
          <thead><tr>${th}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function _sortedLeague() {
  return [..._leagueTeams].sort((a, b) =>
    _cmpNullsLast(a[_leagueSortKey], b[_leagueSortKey], _leagueSortDir));
}

function _leagueTableHTML(teams) {
  const sorted = teams;
  const headers = LEAGUE_COLS.map(c => {
    const cls = c.key === _leagueSortKey
      ? (_leagueSortDir === -1 ? "sort-desc" : "sort-asc")
      : "";
    const attrs = c.key ? `data-key="${c.key}"` : "";
    return `<th class="${cls}" ${attrs} title="${c.title || ""}">${c.label}</th>`;
  }).join("");

  const rows = sorted.map((t, i) => `
    <tr style="cursor:pointer" data-code="${t.team_code}">
      <td class="td-muted">${i + 1}</td>
      <td class="td-team">${t.team_name}</td>
      <td>${t.games}</td>
      <td>${DEC2(t.oer)}</td>
      <td>${DEC2(t.der)}</td>
      <td class="${t.net_rating == null ? '' : t.net_rating >= 0 ? 'above-avg' : 'below-avg'}">${DEC2(t.net_rating)}</td>
      <td>${PCT(t.efg_pct)}</td>
      <td>${PCT(t.ts_pct)}</td>
      <td>${PCT(t.or_pct)}</td>
      <td>${PCT(t.dr_pct)}</td>
      <td>${PCT(t.to_pct)}</td>
      <td>${DEC2(t.pace)}</td>
      <td>${DEC2(t.pts)}</td>
    </tr>`).join("");

  return `<thead><tr>${headers}</tr></thead><tbody>${rows}</tbody>`;
}

function _bindLeagueTableEvents(tableEl) {
  tableEl.querySelectorAll("th[data-key]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (_leagueSortKey === key) {
        _leagueSortDir *= -1;
      } else {
        _leagueSortKey = key;
        _leagueSortDir = key === "team_name" ? 1 : -1;
      }
      tableEl.innerHTML = _leagueTableHTML(_sortedLeague());
      _bindLeagueTableEvents(tableEl);
      _bindLeagueRowClicks(tableEl);
    });
  });
}

function _bindLeagueRowClicks(tableEl) {
  tableEl.querySelectorAll("tbody tr").forEach(tr => {
    tr.addEventListener("click", () => {
      document.getElementById("team-select").value = tr.dataset.code;
      setSection("team");
      renderTeam(tr.dataset.code);
    });
  });
}

function _drawLeagueMap() {
  const map = LEAGUE_MAPS.find(m => m.id === _leagueMap) || LEAGUE_MAPS[0];
  const hintEl = document.getElementById("map-hint");
  if (hintEl) {
    hintEl.innerHTML = `${map.hint}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      <span style="color:var(--muted)">🖱 rueda = zoom &nbsp;·&nbsp; arrastrar = mover &nbsp;·&nbsp; pellizcar = zoom táctil</span>`;
  }
  drawLeagueScatter("chart-scatter", _leagueTeams, _mapAxis(map.axis));
}

async function renderLeague() {
  const sec = document.getElementById("sec-league");
  sec.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  try {
    const comps = await api.competitions().catch(() => []);
    if (!comps.some(c => String(c.id) === String(_leagueComp))) _leagueComp = "";
    _leagueTeams = await api.league(_leagueComp);
    if (!_leagueTeams.length) { sec.innerHTML = '<p class="empty">Sin datos. Importa partidos primero.</p>'; return; }

    const compSelHTML = comps.length > 1
      ? `<select id="league-comp" class="map-select">${_compOptions(comps, _leagueComp)}</select>`
      : "";
    sec.innerHTML = `
      ${_standingsCardHTML(_leagueTeams)}
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Ranking de equipos — Liga <span style="color:var(--muted);font-size:10px;font-weight:400;margin-left:8px">Click en columna para ordenar</span></div>
          ${compSelHTML}
        </div>
        <div class="table-wrap">
          <table id="league-table" class="table-sticky"></table>
        </div>
      </div>`;

    const tableEl = document.getElementById("league-table");
    tableEl.innerHTML = _leagueTableHTML(_sortedLeague());
    _bindLeagueTableEvents(tableEl);
    _bindLeagueRowClicks(tableEl);

    const compSel = document.getElementById("league-comp");
    if (compSel) compSel.addEventListener("change", e => { _leagueComp = e.target.value; renderLeague(); });

    if (_leagueTeams.length >= 2) {
      const mapOpts = LEAGUE_MAPS.map(m =>
        `<option value="${m.id}" ${m.id === _leagueMap ? "selected" : ""}>${m.label}</option>`
      ).join("");
      sec.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="map-header">
            <div class="card-title" style="margin:0">Mapa de liga</div>
            <select id="map-select" class="map-select">${mapOpts}</select>
          </div>
          <p class="chart-hint" id="map-hint"></p>
          <canvas id="chart-scatter"></canvas>
          <div style="text-align:right;margin-top:8px">
            <button class="btn btn-ghost btn-sm" id="btn-reset-scatter">↺ Resetear zoom</button>
          </div>
        </div>`);
      _drawLeagueMap();
      document.getElementById("map-select").addEventListener("change", e => {
        _leagueMap = e.target.value;
        _drawLeagueMap();
      });
      document.getElementById("btn-reset-scatter").addEventListener("click", () => resetZoom("chart-scatter"));
    }
    // Cierres se movieron a la vista Equipo (Feature 05 v2).
  } catch (e) {
    sec.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

// ── Clutch por equipo (últimos N min, dif ≤ `margin`) — dentro de Equipo (Feat 05 v2) ──
// Umbral y ventana salen siempre de la respuesta (`margin`, `window_secs`): nunca escribir
// esos números acá (C-06). Antes de la respuesta el título dice solo "Cierres".
let _clutchData = null;
let _clutchSort = { key: "date", dir: -1 };
let _clutchReq  = 0;   // descarta respuestas viejas al cambiar de equipo o competencia

const CLUTCH_COLS = [
  { key: "date", label: "Fecha", date: true },
  { key: "opponent_code", label: "Rival", txt: true }, { key: "home_away", label: "L/V", txt: true },
  { key: "entry_margin", label: d => `Δ@${_clock(d.window_secs)}`, int: true },
  { key: "overtime_periods", label: "PR", title: "Prórrogas", ot: true },
  { key: "point_diff", label: "Dif", diff: true }, { key: "pts", label: "Pts", int: true },
  { key: "off_rating", label: "Off" }, { key: "def_rating", label: "Def" },
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "tov", label: "TOV", int: true }, { key: "ast", label: "AST", int: true },
  { key: "reb", label: "REB", int: true },
  { key: "fouls_drawn", label: "FR", int: true }, { key: "fouls_committed", label: "FC", int: true },
  { key: "top_finisher", label: "Finaliza", leader: "pts" }, { key: "top_creator", label: "Crea", leader: "ast" },
];

// Segundos → reloj de juego "m:ss" (300 → "5:00").
const _clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function _clutchTitle(d) {
  if (!d) return `<div class="card-title">Cierres</div>`;
  const min = d.window_secs / 60;
  return `<div class="card-title">Cierres (últimos ${fmtNumber(min, Number.isInteger(min) ? 0 : 1)} min, dif ≤ ${d.margin})</div>`;
}

// Recuento que cierra: calificados + excluidos + sin eventos de cierre + sin play-by-play = partidos del equipo.
function _clutchCount(d) {
  const parts = [`${d.games_qualified} calificado(s)`,
                 `${d.games_excluded} excluido(s) por diferencia mayor a ${d.margin}`];
  if (d.games_without_clutch_events) parts.push(`${d.games_without_clutch_events} sin eventos de cierre`);
  if (d.games_without_pbp) parts.push(`${d.games_without_pbp} sin play-by-play`);
  return (d.competition ? `${esc(d.competition.label)} · ` : "") + parts.join(" · ");
}

async function renderTeamClutch(teamCode) {
  const box = document.getElementById("team-clutch");
  if (!box) return;
  const req = ++_clutchReq;
  box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty"><span class="spinner"></span>Calculando cierres...</p></div>`;
  let d;
  try {
    d = await api.clutchTeam(teamCode, _teamComp);
  } catch (e) {
    if (req === _clutchReq) box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty below-avg">${e.message || "No se pudieron cargar los cierres"}</p></div>`;
    return;
  }
  if (req !== _clutchReq) return;   // llegó tarde: otro equipo o competencia elegidos
  _clutchData = d;
  const title = _clutchTitle(d);
  if (!d.games_qualified) {
    box.innerHTML = `<div class="card">${title}<p class="empty">Sin cierres apretados: ${_clutchCount(d)}.</p></div>`;
    return;
  }
  const a = d.aggregate;
  box.innerHTML = `
    <div class="card">
      ${title}
      <p class="td-muted">Agregado del equipo en cierres apretados — récord <strong>${d.clutch_record}</strong> · ${_clutchCount(d)}</p>
      <div class="stat-grid">
        ${statBox("Dif", a.point_diff, (a.point_diff > 0 ? "+" : "") + a.point_diff, null, null)}
        ${statBox("Off", a.off_rating, DEC2(a.off_rating), null, null)}
        ${statBox("Def", a.def_rating, DEC2(a.def_rating), null, null, false)}
        ${statBox("eFG%", a.efg_pct, PCT(a.efg_pct), null, null)}
        ${statBox("TS%", a.ts_pct, PCT(a.ts_pct), null, null)}
      </div>
      <div class="stat-grid" style="margin-top:8px">
        <div class="stat-box"><div class="stat-label">Pts F / C</div><div class="stat-value neutral">${a.pts_for} / ${a.pts_against}</div></div>
        <div class="stat-box"><div class="stat-label">REB</div><div class="stat-value neutral">${a.reb}</div></div>
        <div class="stat-box"><div class="stat-label">AST</div><div class="stat-value neutral">${a.ast}</div></div>
        <div class="stat-box"><div class="stat-label">TOV</div><div class="stat-value neutral">${a.tov}</div></div>
        <div class="stat-box"><div class="stat-label">Robos / Tapones</div><div class="stat-value neutral">${a.stl} / ${a.blk}</div></div>
      </div>
      <div class="card-title" style="margin-top:16px">Por partido <span style="color:var(--muted);font-size:10px;font-weight:400;margin-left:8px">Click en columna para ordenar</span></div>
      <div class="table-wrap"><table id="clutch-table" class="search-table"></table></div>
    </div>`;
  _drawClutchTable();
}

function _drawClutchTable() {
  const t = document.getElementById("clutch-table");
  if (!t || !_clutchData) return;
  const k = _clutchSort.key;
  const _val = v => (v && typeof v === "object") ? (v.pts ?? v.ast ?? null) : v;
  const sorted = [..._clutchData.per_game].sort((a, b) =>
    _cmpNullsLast(_val(a[k]), _val(b[k]), _clutchSort.dir));
  const cell = (c, r) => {
    const v = r[c.key];
    if (c.leader) return v ? `${v.name} (${v[c.leader]})` : "—";
    if (c.ot)     return v || "";   // sin prórroga: celda vacía
    if (c.date)   return _fmtDate(v);
    if (c.diff)   { if (v == null) return "—";   // sin dato: ni color ni valor crudo (RF-3/RF-4)
                    const cls = v > 0 ? "above-avg" : v < 0 ? "below-avg" : ""; return `<span class="${cls}">${v > 0 ? "+" : ""}${v}</span>`; }
    if (c.txt)    return v || "—";
    if (c.int)    return v == null ? "—" : v;
    if (c.pct)    return PCT(v);
    return DEC2(v);
  };
  t.innerHTML = `
    <thead><tr>${CLUTCH_COLS.map(c => `<th data-key="${c.key}"${c.title ? ` title="${c.title}"` : ""}>${typeof c.label === "function" ? c.label(_clutchData) : c.label}</th>`).join("")}</tr></thead>
    <tbody>${sorted.map(r => `<tr>${CLUTCH_COLS.map(c => `<td>${cell(c, r)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  t.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (_clutchSort.key === key) _clutchSort.dir *= -1;
    else _clutchSort = { key, dir: ["date","opponent_code","home_away","top_finisher","top_creator"].includes(key) ? 1 : -1 };
    _drawClutchTable();
  }));
}

// ── Team section — with last-N filter ─────────────────────────────────────
let _teamData  = null;
let _teamLastN = 0; // 0 = all
let _teamComp  = ""; // "" = todas las competencias

function _filteredLog(gameLog, n) {
  if (!n) return gameLog;
  const sorted = [...gameLog].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted.slice(0, n);
}

// ── Usage ranking card ──────────────────────────────────────────────────────
function _renderUsageRanking(players) {
  const el = document.getElementById("usage-ranking");
  if (!el || !players?.length) return;
  const maxUso = players[0]?.uso_pct || 1;   // `|| 1`: solo guarda de la división
  const rows = players.map(p => {
    // Un 0 real se muestra como 0; solo el nulo es "—" (C-11 RF-5)
    const pct = PCT(p.uso_pct);
    const bar = p.uso_pct != null ? Math.round((p.uso_pct / maxUso) * 100) : 0;
    const pts = DEC1(p.pts);
    return `
      <tr class="clickable-row" data-player="${p.name}">
        <td style="font-weight:600">${p.name}</td>
        <td style="width:120px">
          <div style="background:var(--border);border-radius:3px;height:8px;overflow:hidden">
            <div style="width:${bar}%;height:100%;background:var(--accent);border-radius:3px"></div>
          </div>
        </td>
        <td style="text-align:right;font-weight:700;color:var(--accent)">${pct}</td>
        <td style="text-align:right;color:var(--muted)">${pts} pts</td>
        <td style="text-align:right;color:var(--muted);font-size:11px">${p.games}P</td>
      </tr>`;
  }).join("");
  el.innerHTML = `
    <div class="card" style="margin-top:8px">
      <div class="card-title">Jugadores más influyentes — USO%</div>
      <table class="game-log" style="width:100%">
        <thead><tr>
          <th>Jugador</th><th></th>
          <th style="text-align:right">USO%</th>
          <th style="text-align:right">PPG</th>
          <th style="text-align:right">PJ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  el.querySelectorAll(".clickable-row").forEach(tr => {
    tr.addEventListener("click", () => {
      const pName = tr.dataset.player;
      document.getElementById("player-select").value = pName;
      document.getElementById("player-select").dispatchEvent(new Event("change"));
    });
  });
}

function _renderTeamContent(main, data, n) {
  const byComp   = _filterByComp(data.game_log, _teamComp);
  const filtered = _filteredLog(byComp, n);
  // sin filtro alguno → usar los promedios/record ya calculados por el backend
  const unfiltered = !n && !_teamComp;
  const av  = unfiltered ? { ...data.averages, null_reasons: data.null_reasons } : _computeAvg(filtered);
  const rs  = av.null_reasons || {};   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA activa, no del subconjunto en pantalla:
  // el filtro de últimos N no participa de esta selección (Feature 14 RF-1/RF-2).
  const lg  = data.leagues?.[_teamComp || ""] ?? data.league;
  const rec = unfiltered ? data.record : null;

  main.innerHTML = `
    ${_recordCard(rec, data.team_name)}
    <div class="card">
      <div class="card-title">Eficiencia</div>
      <div class="stat-grid">
        ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg, true, rs.oer)}
        ${statBox("DER", av.der, DEC2(av.der), "der", lg, false, rs.der)}
        ${statBox("Net Rating", av.net_rating, DEC2(av.net_rating), "net_rating", lg, true, rs.net_rating)}
        ${statBox("Pace", av.pace, DEC2(av.pace), "pace", lg, true, rs.pace)}
        ${statBox("PPT", av.pps, DEC2(av.pps), "pps", lg, true, rs.pps)}
        ${statBox("FT Rate", av.ft_rate, DEC2(av.ft_rate), "ft_rate", lg, true, rs.ft_rate)}
      </div>
    </div>
    ${_fourFactorsCard(av, data.team_name)}
    <div class="card">
      <div class="card-title">Tiro</div>
      <div class="stat-grid">
        ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg, true, rs.efg_pct)}
        ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg, true, rs.ts_pct)}
        ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg, true, rs.fg2_pct)}
        ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg, true, rs.fg3_pct)}
        ${statBox("FT%", av.ft_pct, PCT(av.ft_pct), "ft_pct", lg, true, rs.ft_pct)}
        ${statBox("Uso 3P", av.fg3_uso, PCT(av.fg3_uso), "fg3_uso", lg, true, rs.fg3_uso)}
      </div>
      ${_shotDetailGrid(av, data.totals, lg)}
    </div>
    <div class="card">
      <div class="card-title">Rebotes & Misc</div>
      <div class="stat-grid">
        ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg, true, rs.or_pct)}
        ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg, true, rs.dr_pct)}
        ${statBox("Reb%", av.trb_pct, PCT(av.trb_pct), "trb_pct", lg, true, rs.trb_pct)}
        ${statBox("TO", av.tov, DEC2(av.tov), "to_ratio", lg, false, rs.tov)}
        ${statBox("AS", av.ast, DEC2(av.ast), "ast_ratio", lg, true, rs.ast)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Defensa avanzada</div>
      <div class="stat-grid">
        ${statBox("Robos", av.stl, DEC2(av.stl), "stl", lg, true, rs.stl)}
        ${statBox("Tapones", av.blk, DEC2(av.blk), "blk", lg, true, rs.blk)}
        ${statBox("Stops", av.stocks, DEC2(av.stocks), "stocks", lg, true, rs.stocks)}
        ${statBox("Def Playmaking", av.def_playmaking, DEC2(av.def_playmaking), "def_playmaking", lg, true, rs.def_playmaking)}
        ${statBox("DEF/TO Ratio", av.def_to_ratio, DEC2(av.def_to_ratio), "def_to_ratio", lg, true, rs.def_to_ratio)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Desglose ofensivo</div>
      <div class="stat-grid">
        ${statBox("PtsEnPint",       av.paint_pts,         DEC2(av.paint_pts),         null, null, false, rs.paint_pts)}
        ${statBox("Seg. Op.",  av.second_chance_pts,  DEC2(av.second_chance_pts), null, null, false, rs.second_chance_pts)}
        ${statBox("Ptos/PER",  av.pts_from_tov,       DEC2(av.pts_from_tov),      null, null, false, rs.pts_from_tov)}
        ${statBox("Banca",     av.bench_pts,          DEC2(av.bench_pts),         null, null, false, rs.bench_pts)}
        ${statBox("PCA",       av.fast_break_pts,     DEC2(av.fast_break_pts),    null, null, false, rs.fast_break_pts)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Game log</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Fecha</th><th>Rival</th><th>L/V</th>
            <th>Pts</th><th>OER</th><th>DER</th><th>eFG%</th><th>TS%</th>
            <th>OR%</th><th>DR%</th><th>TO%</th>
          </tr></thead>
          <tbody>
            ${filtered.map(g => {
              const c = (k, f) => fmtOrNull(g[k], f, g.null_reasons?.[k]);
              return `
              <tr>
                <td class="td-muted">${_fmtDate(g.date)}</td>
                <td>${g.opponent}</td>
                <td class="td-muted">${g.home_away}</td>
                <td class="td-result">${g.pts}</td>
                <td>${c("oer", DEC2)}</td>
                <td>${c("der", DEC2)}</td>
                <td>${c("efg_pct", PCT)}</td>
                <td>${c("ts_pct", PCT)}</td>
                <td>${c("or_pct", PCT)}</td>
                <td>${c("dr_pct", PCT)}</td>
                <td>${c("to_pct", PCT)}</td>
              </tr>`; }).join("")}
          </tbody>
        </table>
      </div>
    </div>`;

  if (filtered.length >= 1) {
    main.insertAdjacentHTML("afterbegin", `
      <div class="chart-grid">
        <div class="card">
          <div class="card-title">Perfil de equipo</div>
          <div class="radar-wrap">
            <canvas id="chart-radar"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Evolución por partido</div>
          <canvas id="chart-evo" height="200"></canvas>
        </div>
      </div>`);
    drawRadar("chart-radar", av, lg, data.team_name);
    drawEvolution("chart-evo", filtered, lg?.oer?.avg);
  }
}

async function renderTeam(teamCode) {
  const main = document.getElementById("team-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  _teamLastN = 0;
  _teamComp  = "";

  try {
    _teamData = await api.team(teamCode);

    // Filter pills
    const filterWrap = document.getElementById("team-filter-pills");
    if (filterWrap) {
      filterWrap.style.display = _teamData.games > 3 ? "" : "none";
    }

    // Selector de competencia (solo si el equipo tiene >1 competencia)
    const comps    = _logComps(_teamData.game_log);
    const compWrap = document.getElementById("team-comp-wrap");
    const compSel  = document.getElementById("team-comp");
    if (compWrap && compSel) {
      compWrap.style.display = comps.length > 1 ? "" : "none";
      compSel.innerHTML = _compOptions(comps);
    }

    _renderTeamContent(main, _teamData, 0);

    const players = await api.players(teamCode);
    const pSel = document.getElementById("player-select");
    pSel.innerHTML = '<option value="">— Seleccionar jugador —</option>' +
      players.map(p => `<option value="${p.name}">${p.name}</option>`).join("");
    _renderUsageRanking(players);

    const lineupCard = document.getElementById("team-lineup-card");
    const picker = document.getElementById("team-lineup-picker");
    if (players.length >= 3) {
      picker.innerHTML = players.map(p => `
        <label class="lineup-check"><input type="checkbox" value="${p.name}">${p.name}</label>`).join("");
      lineupCard.style.display = "";
    } else {
      lineupCard.style.display = "none";
    }

    renderTeamShotmapTeam(teamCode);   // mapa de tiro del equipo (Feature 10)
    renderTeamClutch(teamCode);        // cierres del equipo (Feature 05 v2)
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

// Mapa de tiro AGREGADO del equipo (Feature 10) — reusa api.teamShots + _shotChartSVG
function renderTeamShotmapTeam(teamCode) {
  const box = document.getElementById("team-teamshot");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro del equipo...</p></div>';
  api.teamShots(teamCode).then(shots => {
    if (!shots || !shots.total_shots) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Mapa de tiro del equipo <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${teamCode}</span></div>
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.summary, shots.has_coordinates)}
      </div>`;
  }).catch(() => { box.innerHTML = ""; });
}

// Shot chart del jugador DENTRO de la vista Equipo (reusa api.playerShots + _shotChartSVG)
function renderTeamShotmap(teamCode, playerName) {
  const box = document.getElementById("team-shotmap");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro...</p></div>';
  api.playerShots(teamCode, playerName).then(shots => {
    if (!shots || !shots.total_shots) {
      box.innerHTML = "";
      toast("Sin datos de tiro para este jugador", "err");
      return;
    }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.summary, shots.has_coordinates)}
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }).catch(() => { box.innerHTML = ""; });
}

// ON/OFF: rendimiento del equipo con un jugador en cancha vs en el banco (Feature 04)
async function renderTeamOnOff(teamCode, playerName) {
  const box = document.getElementById("team-onoff");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando ON/OFF...</p></div>';
  try {
    const r = await api.onoff(teamCode, playerName);
    // Fila de tasas: Δ viene del backend (comparable ON vs OFF)
    const row = (label, key, lowerBetter = false, fmt = DEC2) => {
      const on = r.on[key], off = r.off[key], d = r.diff[key];
      const cls = d == null ? "neutral" : (lowerBetter ? d <= 0 : d >= 0) ? "above-avg" : "below-avg";
      return `<tr>
        <td>${on != null ? fmt(on) : "—"}</td>
        <td class="lbl">${label}</td>
        <td>${off != null ? fmt(off) : "—"}</td>
        <td class="${cls}">${d != null ? (d >= 0 ? "+" : "") + fmt(d) : "—"}</td>
      </tr>`;
    };
    // Fila de conteos crudos: Δ = ON − OFF calculado acá (escala con minutos, no comparable directo)
    const rawRow = (label, key, lowerBetter = false) => {
      const on = r.on[key], off = r.off[key];
      const d = (on != null && off != null) ? on - off : null;
      const cls = d == null ? "neutral" : (lowerBetter ? d <= 0 : d >= 0) ? "above-avg" : "below-avg";
      return `<tr>
        <td>${on != null ? on : "—"}</td>
        <td class="lbl">${label}</td>
        <td>${off != null ? off : "—"}</td>
        <td class="${cls}">${d != null ? (d >= 0 ? "+" : "") + d : "—"}</td>
      </tr>`;
    };
    const sample = (side, data) => data.possessions
      ? `${side}: ${DEC1(data.possessions)} pos · ${Math.round(data.seconds / 60)}' en cancha`
      : `${side}: sin muestra`;

    box.innerHTML = `
      <div class="card">
        <div class="card-title">ON / OFF <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName} · Uso ${r.usg_pct != null ? PCT(r.usg_pct) : "—"}</span></div>
        <div class="table-wrap">
          <table class="onoff-table">
            <thead><tr><th>ON</th><th>Eficiencia</th><th>OFF</th><th>Δ</th></tr></thead>
            <tbody>
              ${row("OER", "oer")}
              ${row("DER", "der", true)}
              ${row("Net Rating", "net_rating")}
              ${row("eFG%", "efg_pct", false, PCT)}
              ${row("TS%", "ts_pct", false, PCT)}
            </tbody>
          </table>
        </div>
        <div class="table-wrap" style="margin-top:12px">
          <table class="onoff-table">
            <thead><tr><th>ON</th><th>Producción del equipo</th><th>OFF</th><th>Δ</th></tr></thead>
            <tbody>
              ${rawRow("Pts a favor", "pts_for")}
              ${rawRow("Pts en contra", "pts_against", true)}
              ${rawRow("REB", "reb")}
              ${rawRow("AST", "ast")}
              ${rawRow("Pérdidas", "tov", true)}
              ${rawRow("Robos", "stl")}
              ${rawRow("Tapones", "blk")}
            </tbody>
          </table>
        </div>
        <p class="td-muted" style="margin-top:8px">${sample("ON", r.on)} &nbsp;|&nbsp; ${sample("OFF", r.off)}<br><span style="font-size:11px">Los conteos crudos escalan con los minutos de cada tramo; las tasas de arriba son comparables directas.</span></p>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos ON/OFF para este jugador", "err");
  }
}

// Lineups: rendimiento del equipo con una combinación de 3-5 jugadores en cancha (Feature 03)
async function renderTeamLineup(teamCode, players) {
  const box = document.getElementById("team-lineup");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando combinación...</p></div>';
  try {
    const r = await api.lineup(teamCode, players);
    const m = r.metrics;
    const lead = (l, key) => l ? `${l.name} (${l[key]})` : "—";
    const smallSample = r.sample.possessions < 10
      ? `<p class="empty below-avg" style="margin-top:8px">Muestra chica (${DEC1(r.sample.possessions)} posesiones) — tomar con cuidado</p>`
      : "";
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Combinación <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${players.join(" · ")}</span></div>
        <div class="stat-grid">
          ${statBox("OER", m.oer, DEC2(m.oer), null, null)}
          ${statBox("DER", m.der, DEC2(m.der), null, null, false)}
          ${statBox("Net Rating", m.net_rating, DEC2(m.net_rating), null, null)}
          ${statBox("eFG%", m.efg_pct, PCT(m.efg_pct), null, null)}
          ${statBox("TS%", m.ts_pct, PCT(m.ts_pct), null, null)}
        </div>
        <p class="td-muted" style="margin-top:8px">
          ${DEC1(r.sample.possessions)} posesiones · ${Math.round(r.sample.seconds / 60)}' en cancha ·
          ${r.games_used} partido(s) usado(s)${r.games_excluded ? ` (${r.games_excluded} excluido(s) por datos inconsistentes)` : ""}
        </p>
        ${smallSample}
        <div class="table-wrap" style="margin-top:12px">
          <table class="search-table">
            <thead><tr>
              <th>Off</th><th>Def</th><th>Net</th><th>eFG%</th><th>TS%</th><th>Pos</th>
              <th>Pts</th><th>Pts-C</th><th>REB</th><th>OR</th><th>DR</th><th>AST</th>
              <th>TOV</th><th>ROB</th><th>TAP</th><th>FGA</th><th>3PA</th><th>FTA</th>
            </tr></thead>
            <tbody><tr>
              <td>${DEC2(m.oer)}</td><td>${DEC2(m.der)}</td><td>${DEC2(m.net_rating)}</td>
              <td>${PCT(m.efg_pct)}</td><td>${PCT(m.ts_pct)}</td><td>${DEC1(r.sample.possessions)}</td>
              <td>${r.raw.pts}</td><td>${r.raw.pts_against}</td><td>${r.raw.reb}</td>
              <td>${r.raw.orb}</td><td>${r.raw.drb}</td><td>${r.raw.ast}</td>
              <td>${r.raw.tov}</td><td>${r.raw.stl}</td><td>${r.raw.blk}</td>
              <td>${r.raw.fga}</td><td>${r.raw.fga3}</td><td>${r.raw.fta}</td>
            </tr></tbody>
          </table>
        </div>
        <div class="stat-grid" style="margin-top:8px">
          <div class="stat-box"><div class="stat-label">Anota más</div><div class="stat-value neutral">${lead(r.leaders.scorer, "pts")}</div></div>
          <div class="stat-box"><div class="stat-label">Asiste más</div><div class="stat-value neutral">${lead(r.leaders.assister, "ast")}</div></div>
          <div class="stat-box"><div class="stat-label">Rebota más</div><div class="stat-value neutral">${lead(r.leaders.rebounder, "trb")}</div></div>
        </div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos para esta combinación", "err");
  }
}

// ── Compare section ────────────────────────────────────────────────────────
async function renderCompare() {
  const sec = document.getElementById("sec-compare");
  await refreshCompareSelectors();

  const btnCompare = document.getElementById("btn-compare");
  if (btnCompare._bound) return;
  btnCompare._bound = true;

  btnCompare.addEventListener("click", async () => {
    const codeA = document.getElementById("compare-a").value;
    const codeB = document.getElementById("compare-b").value;
    if (!codeA || !codeB) return toast("Selecciona dos equipos", "err");
    if (codeA === codeB) return toast("Selecciona equipos distintos", "err");

    btnCompare.disabled = true;
    btnCompare.innerHTML = '<span class="spinner"></span>Comparando...';

    try {
      const [dataA, dataB] = await Promise.all([api.team(codeA), api.team(codeB)]);
      const comp = document.getElementById("compare-comp")?.value || "";
      const avA = comp ? _computeAvg(_filterByComp(dataA.game_log, comp)) : dataA.averages;
      const avB = comp ? _computeAvg(_filterByComp(dataB.game_log, comp)) : dataB.averages;
      const lg  = dataA.league;

      const a = avA, b = avB;
      // Sin dato → "—", nunca 0 (Feature 12 RF-4)
      const N1 = v => v != null ? Math.round(v) : "—";
      // Ganador/perdedor: clase neutra si falta cualquiera de los dos lados — un nulo
      // no se compara ni se pinta con color de rendimiento (RF-3)
      const winCls = (va, vb, lowerBetter = false) =>
        (va == null || vb == null) ? "" : ((lowerBetter ? va <= vb : va >= vb) ? "winner" : "loser");

      const shootRow = (label, madeA, attA, madeB, attB) => {
        const pct  = (m, a) => (m == null || !a) ? null : Math.round(100 * m / a);
        const pctA = pct(madeA, attA), pctB = pct(madeB, attB);
        const shot = (m, a, p) => `${N1(m)}/${N1(a)}` + (p == null ? "" : ` (${p}%)`);
        return `<tr>
          <td class="${winCls(pctA, pctB)}">${shot(madeA, attA, pctA)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(pctB, pctA)}">${shot(madeB, attB, pctB)}</td>
        </tr>`;
      };
      const rawRow = (label, va, vb, lowerBetter = false) => `<tr>
          <td class="${winCls(va, vb, lowerBetter)}">${DEC1(va)}</td>
          <td class="lbl">${label}</td>
          <td class="${winCls(vb, va, lowerBetter)}">${DEC1(vb)}</td>
        </tr>`;

      const pfA = a.pf, pfB = b.pf, oppPfA = a.opp_pf, oppPfB = b.opp_pf;
      const rows = [
        shootRow("LC",      a.fgm,  a.fga,  b.fgm,  b.fga),
        shootRow("2Pts",    a.fgm2, a.fga2, b.fgm2, b.fga2),
        shootRow("3Pts",    a.fgm3, a.fga3, b.fgm3, b.fga3),
        shootRow("1Pt",     a.ftm,  a.fta,  b.ftm,  b.fta),
        rawRow("REB",       a.trb ?? (a.orb + a.drb), b.trb ?? (b.orb + b.drb)),
        rawRow("As",        a.ast,  b.ast),
        rawRow("ST",        a.stl,  b.stl),
        rawRow("Blq",       a.blk,  b.blk),
        rawRow("PER",       a.tov,  b.tov,  true),
        `<tr>
          <td class="${winCls(pfA, pfB, true)}">${N1(pfA)} (${N1(oppPfA)})</td>
          <td class="lbl">FP</td>
          <td class="${winCls(pfB, pfA, true)}">${N1(pfB)} (${N1(oppPfB)})</td>
        </tr>`,
        // Sin `|| 0`: "la competencia no registra ese dato" es NULL, no cero (RF-4)
        rawRow("PtsEnPint", a.paint_pts,         b.paint_pts),
        rawRow("PtsSegCh",  a.second_chance_pts, b.second_chance_pts),
        rawRow("PtPer",     a.pts_from_tov,      b.pts_from_tov),
        rawRow("Pts Banca", a.bench_pts,         b.bench_pts),
        rawRow("PCA",       a.fast_break_pts,    b.fast_break_pts),
      ].join("");

      // Tabla de métricas avanzadas (una fila por equipo, estilo tabla de cierres)
      const advRow = (name, av, color) => `<tr>
        <td style="color:${color};font-weight:600;text-align:left">${name}</td>
        <td>${DEC2(av.oer)}</td><td>${DEC2(av.der)}</td><td>${DEC2(av.net_rating)}</td>
        <td>${PCT(av.efg_pct)}</td><td>${PCT(av.ts_pct)}</td><td>${DEC2(av.pace)}</td>
        <td>${PCT(av.or_pct)}</td><td>${PCT(av.dr_pct)}</td><td>${PCT(av.to_pct)}</td>
        <td>${PCT(av.as_pct)}</td><td>${DEC2(av.pts)}</td><td>${DEC2(av.possessions)}</td>
      </tr>`;

      document.getElementById("compare-result").innerHTML = `
        <div class="chart-grid">
          <div class="card">
            <div class="card-title">Radar comparativo</div>
            <div class="radar-wrap">
              <canvas id="chart-compare-radar"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">${dataA.team_name} vs ${dataB.team_name}</div>
            <div class="table-wrap">
              <table class="compare-table fiba-box">
                <thead><tr>
                  <th style="color:var(--accent)">${dataA.team_name}</th>
                  <th class="lbl"></th>
                  <th style="color:var(--blue)">${dataB.team_name}</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Métricas avanzadas</div>
          <div class="table-wrap">
            <table class="search-table">
              <thead><tr>
                <th style="text-align:left">Equipo</th>
                <th>Off</th><th>Def</th><th>Net</th><th>eFG%</th><th>TS%</th><th>Pace</th>
                <th>OR%</th><th>DR%</th><th>TO%</th><th>AS%</th><th>Pts</th><th>Pos</th>
              </tr></thead>
              <tbody>
                ${advRow(dataA.team_name, avA, "var(--accent)")}
                ${advRow(dataB.team_name, avB, "var(--blue)")}
              </tbody>
            </table>
          </div>
        </div>`;

      drawCompareRadar("chart-compare-radar", avA, avB, lg, dataA.team_name, dataB.team_name);
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btnCompare.disabled = false;
      btnCompare.textContent = "Comparar";
    }
  });
}

// ── Shot chart SVG — half court, estilo "El Metro" (cancha clara, heatmap por P/F) ──
// Geometría y paleta compartidas entre el modo 11 zonas (coords reales) y el modo
// simplificado de 3 zonas (fallback: partido sin array `shot` de FIBA → x=0,y=0).
const SC_W = 340, SC_H = 320;
const SC_cx = 170, SC_cy = 256;
const SC_cL = 20, SC_cR = 320, SC_cT = 8, SC_cB = 288;
const SC_r3 = 135, SC_rP = 50;
const SC_pbX1 = 121, SC_pbX2 = 219, SC_pbTop = 140;
const SC_c3xL = 38, SC_c3xR = 302;
const SC_c3yJoin = Math.round(SC_cy - Math.sqrt(SC_r3 * SC_r3 - (SC_cx - SC_c3xL) ** 2));

const SC_courtBg = "#f3f6fa", SC_paintBg = "#c7d8ec", SC_restrictBg = "#b4c8e6",
      SC_cornerBg = "#efe9c4", SC_line = "#46566a", SC_boxText = "#1f2937";

// Heatmap por PPT (puntos por tiro), umbrales calcados de la imagen de referencia.
// La fórmula no cambió con C-03 — solo el nombre —, así que los colores son idénticos.
const _scBoxFill = ppt => ppt >= 1.00 ? "#79b13f" : ppt >= 0.85 ? "#ef8b3a" : "#df574c";

function _scHCirc(r) {
  return `M${SC_cx - r},${SC_cy} A${r},${r} 0 0,0 ${SC_cx + r},${SC_cy} Z`;
}

// Spokes (líneas que abren desde el aro separando los sectores del modo 11 zonas)
function _scSpoke(deg) {
  const t = deg * Math.PI / 180;
  const x1 = SC_cx + SC_rP * Math.cos(t),  y1 = SC_cy - SC_rP * Math.sin(t);
  const x2 = SC_cx + 250 * Math.cos(t),    y2 = SC_cy - 250 * Math.sin(t);
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${SC_line}" stroke-width="1.2" clip-path="url(#sc-clip)"/>`;
}

// C-07 — detalle de tiro: intentos/convertidos de las 3 categorías (promedio por
// partido + total de temporada) y los 4 PPT. Compartido por Equipo y Jugador.
function _shotDetailGrid(av, totals, lg) {
  const t = totals || {};
  const rs = av?.null_reasons || {};
  // "promedio (total)" — el promedio ya viene del backend; el total también, para no
  // arrastrar el redondeo de multiplicar promedio × partidos (Feature 16 §9).
  const cell = (label, avgKey, totKey) => {
    const a = av?.[avgKey], n = t[totKey];
    // Total ausente → "—", nunca "(0)" (C-11 RF-4)
    const disp = `${DEC2(a)}<span style="font-size:9px;color:var(--muted)"> (${n ?? "—"})</span>`;
    return statBox(label, a, disp, null, null, true, rs[avgKey]);
  };
  return `
    <div class="card-title" style="margin-top:14px;font-size:11px;color:var(--muted)">Detalle de tiro — promedio (total temporada)</div>
    <div class="stat-grid">
      ${cell("T2i", "fga2", "fga2")}
      ${cell("T2c", "fgm2", "fgm2")}
      ${cell("T3i", "fga3", "fga3")}
      ${cell("T3c", "fgm3", "fgm3")}
      ${cell("TLi", "fta",  "fta")}
      ${cell("TLc", "ftm",  "ftm")}
    </div>
    <div class="card-title" style="margin-top:14px;font-size:11px;color:var(--muted)">Puntos por tiro</div>
    <div class="stat-grid">
      ${statBox("PPT",    av.pps,    DEC2(av.pps),    "pps",    lg, true, rs.pps)}
      ${statBox("PPT 2",  av.ppt_2,  DEC2(av.ppt_2),  "ppt_2",  lg, true, rs.ppt_2)}
      ${statBox("PPT 3",  av.ppt_3,  DEC2(av.ppt_3),  "ppt_3",  lg, true, rs.ppt_3)}
      ${statBox("PPT TL", av.ppt_ft, DEC2(av.ppt_ft), "ppt_ft", lg, true, rs.ppt_ft)}
    </div>`;
}

function _scLbl(zones, totalShots, key, lx, ly) {
  const z = zones?.[key];
  if (!z?.attempts) return '';
  // C-03: cada zona muestra % de acierto, eFG% y PPT. El indicador "P/F" se retiró:
  // era esta misma fórmula (puntos de la zona / intentos) mal etiquetada.
  const share = DEC1((z.attempts / totalShots) * 100);
  const ppt   = z.ppt != null ? DEC2(z.ppt) : '—';
  const fg    = DEC1(z.pct * 100) + '%';
  const efg   = z.efg != null ? DEC1(z.efg * 100) + '%' : '—';
  const bg    = _scBoxFill(z.ppt);
  const w = 54, h = 44, r = 4;
  const x0 = lx - w / 2, y0 = ly - h / 2;
  return `
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="${bg}" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>
    <text x="${lx - 5}" y="${ly - 11}" text-anchor="end"   fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">${share}%</text>
    <text x="${lx + 4}" y="${ly - 11}" text-anchor="start" fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">PPT ${ppt}</text>
    <text x="${lx}"     y="${ly + 5}"  text-anchor="middle" fill="${SC_boxText}" font-size="14" font-weight="800" font-family="Inter,sans-serif">${fg}</text>
    <text x="${lx}"     y="${ly + 16}" text-anchor="middle" fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">eFG ${efg}</text>`;
}

function _scBadge(summary) {
  if (!summary) return '';
  const pf  = summary.ppt     != null ? DEC2(summary.ppt) : '—';   // C-03: era "P/F"
  const efg = summary.efg_pct != null ? DEC1(summary.efg_pct * 100) + ' %' : '—';
  const cw = 70, ch = 38, bx = SC_cR - 2 * cw, by = SC_cT + 2;
  return `
    <rect x="${bx}"      y="${by}" width="${cw}" height="${ch}" rx="4" fill="#ef8b3a"/>
    <rect x="${bx + cw}" y="${by}" width="${cw}" height="${ch}" rx="4" fill="#9aa83a"/>
    <text x="${bx + cw/2}"        y="${by + 14}" text-anchor="middle" fill="rgba(0,0,0,0.65)" font-size="9"  font-family="Inter,sans-serif">PPT</text>
    <text x="${bx + cw/2}"        y="${by + 31}" text-anchor="middle" fill="${SC_boxText}" font-size="15" font-weight="800" font-family="Inter,sans-serif">${pf}</text>
    <text x="${bx + cw + cw/2}"   y="${by + 14}" text-anchor="middle" fill="rgba(0,0,0,0.65)" font-size="9"  font-family="Inter,sans-serif">eFG%</text>
    <text x="${bx + cw + cw/2}"   y="${by + 31}" text-anchor="middle" fill="${SC_boxText}" font-size="15" font-weight="800" font-family="Inter,sans-serif">${efg}</text>`;
}

function _courtLinesSVG() {
  return `
    <rect width="${SC_W}" height="${SC_H}" fill="${SC_courtBg}" rx="8"/>
    <rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}" fill="${SC_courtBg}" rx="3"/>
    <!-- Esquinas amarillas (fuera de la línea de 3 lateral) -->
    <rect x="${SC_cL}"   y="${SC_c3yJoin}" width="${SC_c3xL-SC_cL}" height="${SC_cB-SC_c3yJoin}" fill="${SC_cornerBg}" clip-path="url(#sc-clip)"/>
    <rect x="${SC_c3xR}" y="${SC_c3yJoin}" width="${SC_cR-SC_c3xR}" height="${SC_cB-SC_c3yJoin}" fill="${SC_cornerBg}" clip-path="url(#sc-clip)"/>
    <!-- Pintura + zona restringida (azul) -->
    <rect x="${SC_pbX1}" y="${SC_pbTop}" width="${SC_pbX2-SC_pbX1}" height="${SC_cB-SC_pbTop}" fill="${SC_paintBg}" clip-path="url(#sc-clip)"/>
    <path d="${_scHCirc(SC_rP)}" fill="${SC_restrictBg}" clip-path="url(#sc-clip)"/>
    <!-- Spokes (sectores) -->
    ${_scSpoke(150)}${_scSpoke(108)}${_scSpoke(72)}${_scSpoke(30)}
    <!-- Líneas de cancha -->
    <rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}" fill="none" stroke="${SC_line}" stroke-width="1.5" rx="3"/>
    <rect x="${SC_pbX1}" y="${SC_pbTop}" width="${SC_pbX2-SC_pbX1}" height="${SC_cB-SC_pbTop}" fill="none" stroke="${SC_line}" stroke-width="1.5"/>
    <path d="M${SC_pbX1},${SC_pbTop} A49,49 0 0,0 ${SC_pbX2},${SC_pbTop}" fill="none" stroke="${SC_line}" stroke-width="1.5" stroke-dasharray="4,3"/>
    <path d="M${SC_c3xL},${SC_cB} L${SC_c3xL},${SC_c3yJoin} A${SC_r3},${SC_r3} 0 0,0 ${SC_c3xR},${SC_c3yJoin} L${SC_c3xR},${SC_cB}" fill="none" stroke="${SC_line}" stroke-width="1.5"/>
    <path d="M${SC_cx-SC_rP},${SC_cy} A${SC_rP},${SC_rP} 0 0,0 ${SC_cx+SC_rP},${SC_cy}" fill="none" stroke="${SC_line}" stroke-width="1.2"/>
    <circle cx="${SC_cx}" cy="${SC_cy}" r="9" fill="none" stroke="#c2611f" stroke-width="2"/>
    <line x1="${SC_cx-26}" y1="${SC_cB-3}" x2="${SC_cx+26}" y2="${SC_cB-3}" stroke="${SC_line}" stroke-width="3"/>`;
}

function _scSvgWrap(inner) {
  return `<svg viewBox="0 0 ${SC_W} ${SC_H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:440px;margin:0 auto;display:block;border-radius:8px">
    <defs>
      <clipPath id="sc-clip"><rect x="${SC_cL}" y="${SC_cT}" width="${SC_cR-SC_cL}" height="${SC_cB-SC_cT}"/></clipPath>
    </defs>
    ${inner}
  </svg>`;
}

// 11 zonas — requiere coordenadas reales de tiro (array `shot` de FIBA con x/y)
function _shotChart11SVG(zones, totalShots, summary) {
  return _scSvgWrap(`
    ${_courtLinesSVG()}
    <!-- Cajas de estadística por zona (heatmap) -->
    ${_scLbl(zones, totalShots, 'top_key_3',       SC_cx,          70)}
    ${_scLbl(zones, totalShots, 'left_wing_3',     SC_cL + 34,    150)}
    ${_scLbl(zones, totalShots, 'right_wing_3',    SC_cR - 34,    150)}
    ${_scLbl(zones, totalShots, 'mid_top',         SC_cx,         162)}
    ${_scLbl(zones, totalShots, 'mid_left_far',    SC_cx - 64,    206)}
    ${_scLbl(zones, totalShots, 'mid_right_far',   SC_cx + 64,    206)}
    ${_scLbl(zones, totalShots, 'restricted_area', SC_cx,         236)}
    ${_scLbl(zones, totalShots, 'mid_left_close',  SC_cx - 64,    263)}
    ${_scLbl(zones, totalShots, 'mid_right_close', SC_cx + 64,    263)}
    ${_scLbl(zones, totalShots, 'left_corner_3',   SC_cL + 30,    263)}
    ${_scLbl(zones, totalShots, 'right_corner_3',  SC_cR - 30,    263)}
    ${_scBadge(summary)}`);
}

// 3 zonas — fallback honesto cuando el partido no trae coordenadas de tiro
// (Feature 01: sdd/specs/01-shot-chart-fallback-visual). Solo `top_key_3`,
// `mid_top` y `restricted_area` pueden tener attempts>0 en este caso.
function _shotChart3SVG(zones, totalShots, summary) {
  return _scSvgWrap(`
    ${_courtLinesSVG()}
    <!-- Cajas de estadística: Triple / Media / Pintura -->
    ${_scLbl(zones, totalShots, 'top_key_3',       SC_cx, 70)}
    ${_scLbl(zones, totalShots, 'mid_top',         SC_cx, 162)}
    ${_scLbl(zones, totalShots, 'restricted_area', SC_cx, 236)}
    ${_scBadge(summary)}`);
}

// Dispatcher: `hasCoordinates` viene de `GET /api/shots/...` (`has_coordinates`).
function _shotChartSVG(zones, totalShots, summary, hasCoordinates) {
  return hasCoordinates === false
    ? _shotChart3SVG(zones, totalShots, summary)
    : _shotChart11SVG(zones, totalShots, summary);
}

// ── Player section ─────────────────────────────────────────────────────────
let _playerData = null;
let _playerComp = "";
let _playerCtx  = { teamCode: "", playerName: "" };

async function renderPlayer(teamCode, playerName) {
  const main = document.getElementById("player-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  _playerComp = "";
  _playerCtx  = { teamCode, playerName };

  try {
    _playerData = await api.player(teamCode, playerName);
    _renderPlayerContent(main, _playerData, "");
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

function _renderPlayerContent(main, data, comp) {
  const { teamCode, playerName } = _playerCtx;
  const log  = _filterByComp(data.game_log, comp);
  const av   = comp ? _computeAvg(log) : { ...data.averages, null_reasons: data.null_reasons };
  const rs   = av.null_reasons || {};   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA activa (Feature 14 RF-1/RF-2)
  const lg   = data.leagues?.[comp || ""] ?? data.league;
  const comps = _logComps(data.game_log);

  {
    main.innerHTML = `
      ${comps.length > 1 ? `
      <div class="card">
        <select id="player-comp" class="map-select">${_compOptions(comps, comp)}</select>
      </div>` : ""}
      <div class="card">
        <div class="card-title">Producción ofensiva</div>
        <div class="stat-grid">
          ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg, true, rs.oer)}
          ${statBox("USO%", av.uso_pct, PCT(av.uso_pct), "uso_pct", lg, true, rs.uso_pct)}
          ${statBox("PPP", av.ppp, DEC2(av.ppp), "ppp", lg, true, rs.ppp)}
          ${statBox("PPT", av.pps, DEC2(av.pps), "pps", lg, true, rs.pps)}
          ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg, true, rs.efg_pct)}
          ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg, true, rs.ts_pct)}
          ${statBox("FT Rate", av.ft_rate, DEC2(av.ft_rate), "ft_rate", lg, true, rs.ft_rate)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Por posesión y por minuto</div>
        <div class="stat-grid">
          ${statBox("AS/pos",  av.as_pos,  DEC2(av.as_pos),  "as_pos",  lg, true, rs.as_pos)}
          ${statBox("PER/pos", av.tov_pos, DEC2(av.tov_pos), "tov_pos", lg, false, rs.tov_pos)}
          ${statBox("PTS/pos", av.pts_pos, DEC2(av.pts_pos), "pts_pos", lg, true, rs.pts_pos)}
          ${statBox("RO/min",  av.orb_min, DEC2(av.orb_min), "orb_min", lg, true, rs.orb_min)}
          ${statBox("RD/min",  av.drb_min, DEC2(av.drb_min), "drb_min", lg, true, rs.drb_min)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Tiro</div>
        <div class="stat-grid">
          ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg, true, rs.fg2_pct)}
          ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg, true, rs.fg3_pct)}
          ${statBox("FT%", av.ft_pct, PCT(av.ft_pct), "ft_pct", lg, true, rs.ft_pct)}
          ${statBox("Uso 2P", av.fg2_uso, PCT(av.fg2_uso), "fg2_uso", lg, true, rs.fg2_uso)}
          ${statBox("Uso 3P", av.fg3_uso, PCT(av.fg3_uso), "fg3_uso", lg, true, rs.fg3_uso)}
        </div>
        ${_shotDetailGrid(av, data.totals, lg)}
      </div>
      <div class="card">
        <div class="card-title">Rebotes & distribución</div>
        <div class="stat-grid">
          ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg, true, rs.or_pct)}
          ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg, true, rs.dr_pct)}
          ${statBox("TO", av.tov, DEC2(av.tov), "to_ratio", lg, false, rs.tov)}
          ${statBox("AS", av.ast, DEC2(av.ast), "ast_ratio", lg, true, rs.ast)}
          ${statBox("AST/TO", av.ast_to, DEC2(av.ast_to), "ast_ratio", lg, true, rs.ast_to)}
          ${statBox("% Reb Equipo", av.reb_share, PCT(av.reb_share), "reb_share", lg, true, rs.reb_share)}
          ${statBox("% RebOf Equipo", av.oreb_share, PCT(av.oreb_share), "oreb_share", lg, true, rs.oreb_share)}
          ${statBox("% RebDef Equipo", av.dreb_share, PCT(av.dreb_share), "dreb_share", lg, true, rs.dreb_share)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Defensa avanzada</div>
        <div class="stat-grid">
          ${statBox("Robos", av.stl, DEC2(av.stl), "stl", lg, true, rs.stl)}
          ${statBox("Tapones", av.blk, DEC2(av.blk), "blk", lg, true, rs.blk)}
          ${statBox("Stops", av.stocks, DEC2(av.stocks), "stocks", lg, true, rs.stocks)}
          ${statBox("Def Playmaking", av.def_playmaking, DEC2(av.def_playmaking), "def_playmaking", lg, true, rs.def_playmaking)}
          ${statBox("DEF/TO Ratio", av.def_to_ratio, DEC2(av.def_to_ratio), "def_to_ratio", lg, true, rs.def_to_ratio)}
          ${statBox("Impacto Físico", av.physical_impact, DEC2(av.physical_impact), "physical_impact", lg, true, rs.physical_impact)}
        </div>
      </div>
      <div class="chart-grid">
        <div class="card">
          <div class="card-title">Perfil de jugador</div>
          <div class="radar-wrap">
            <canvas id="chart-player-radar"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Evolución por partido</div>
          <canvas id="chart-player-evo" height="200"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Game log — ${playerName}</div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Fecha</th><th>Rival</th><th>Pts</th>
              <th>FGM/A</th><th>3PM/A</th><th>FTM/A</th>
              <th>OR</th><th>DR</th><th>Ast</th><th>TOV</th>
              <th>OER</th><th>eFG%</th><th>TS%</th>
            </tr></thead>
            <tbody>
              ${log.map(g => {
                // DNP: el partido figura, pero sin números — no jugó, no son ceros (C-11 RF-10)
                if (g.played === false) return `
                <tr>
                  <td class="td-muted">${_fmtDate(g.date)}</td>
                  <td>${g.opponent}</td>
                  <td colspan="11" class="td-muted null-val" title="No jugó (DNP)">DNP</td>
                </tr>`;
                const c = (k, f) => fmtOrNull(g[k], f, g.null_reasons?.[k]);
                return `
                <tr>
                  <td class="td-muted">${_fmtDate(g.date)}</td>
                  <td>${g.opponent}</td>
                  <td class="td-result">${g.pts}</td>
                  <td>${g.fgm}/${g.fga}</td>
                  <td>${g.fgm3}/${g.fga3}</td>
                  <td>${g.ftm}/${g.fta}</td>
                  <td>${g.orb}</td>
                  <td>${g.drb}</td>
                  <td>${g.ast}</td>
                  <td>${g.tov}</td>
                  <td>${c("oer", DEC2)}</td>
                  <td>${c("efg_pct", PCT)}</td>
                  <td>${c("ts_pct", PCT)}</td>
                </tr>`; }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
    drawRadar("chart-player-radar", av, lg, playerName);
    drawPlayerEvolution("chart-player-evo", log);

    if (comps.length > 1) {
      document.getElementById("player-comp").addEventListener("change", e => {
        _playerComp = e.target.value;
        _renderPlayerContent(main, data, _playerComp);
      });
    }

    // Shot chart — async, non-blocking (global del jugador, no filtrado por competencia)
    api.playerShots(teamCode, playerName).then(shots => {
      if (!shots || !shots.total_shots) return;
      const shotCard = document.createElement("div");
      shotCard.className = "card";
      shotCard.innerHTML = `
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.summary, shots.has_coordinates)}`;
      main.insertBefore(shotCard, main.querySelector(".chart-grid"));
    }).catch(() => {});
  }
}

// ── Search section ───────────────────────────────────────────────────────────
let _searchData = null;
let _searchSort = { key: "player", dir: 1 };

const SEARCH_METRICS = [
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "oer", label: "OER" }, { key: "uso_pct", label: "USO%", pct: true },
  { key: "ppp", label: "PPP" }, { key: "pps", label: "PPT" },
  { key: "fg2_pct", label: "FG2%", pct: true }, { key: "fg3_pct", label: "FG3%", pct: true },
  { key: "ft_pct", label: "FT%", pct: true },
  { key: "pts", label: "Pts/g" }, { key: "ast", label: "Ast/g" }, { key: "tov", label: "Pérd/g" },
  { key: "stl", label: "Robos/g" }, { key: "blk", label: "Tapas/g" },
  { key: "reb_share", label: "% Reb Eq", pct: true },
  { key: "oreb_share", label: "% RebOf Eq", pct: true }, { key: "dreb_share", label: "% RebDef Eq", pct: true },
  { key: "minutes", label: "Min" }, { key: "plus_minus", label: "+/-" },
];

const SEARCH_COLS = [
  { key: "player", label: "Jugador", txt: true }, { key: "team_code", label: "Eq", txt: true },
  { key: "position", label: "Pos", txt: true }, { key: "games", label: "G", int: true },
  { key: "minutes", label: "Min" }, { key: "plus_minus", label: "+/-" },
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "oer", label: "OER" }, { key: "uso_pct", label: "USO%", pct: true },
  { key: "pts", label: "Pts" }, { key: "ast", label: "Ast" }, { key: "tov", label: "TOV" },
  { key: "stl", label: "ST" }, { key: "blk", label: "Blq" },
];

async function renderSearch() {
  const main = document.getElementById("search-main");
  if (!_searchData) {
    main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando buscador...</p>';
    try { _searchData = await api.searchPlayers(); }
    catch (e) { main.innerHTML = `<p class="empty below-avg">No se pudo cargar el buscador</p>`; return; }
  }
  if (!_searchData.length) { main.innerHTML = `<p class="empty">No hay jugadores importados todavía</p>`; return; }

  const teams     = [...new Set(_searchData.map(p => p.team_code))].sort();
  const comps     = [...new Set(_searchData.flatMap(p => p.competitions))].sort();
  const positions = [...new Set(_searchData.map(p => p.position).filter(Boolean))].sort();

  main.innerHTML = `
    <div class="card">
      <div class="card-title">Buscador de jugadores</div>
      <div class="search-filters">
        <input type="text" id="sf-name" placeholder="Nombre contiene...">
        <select id="sf-team"><option value="">Equipo (todos)</option>${teams.map(t=>`<option>${t}</option>`).join("")}</select>
        <select id="sf-comp"><option value="">Competencia (todas)</option>${comps.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select>
        <select id="sf-pos"><option value="">Posición (todas)</option>${positions.map(p=>`<option>${p}</option>`).join("")}</select>
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
        <span id="sf-count" class="td-muted"></span>
      </div>
    </div>
    <div id="search-results"></div>`;

  document.getElementById("sf-apply").addEventListener("click", _applySearch);
  document.getElementById("sf-clear").addEventListener("click", () => {
    main.querySelectorAll(".search-filters input, .search-ranges input").forEach(i => i.value = "");
    main.querySelectorAll(".search-filters select").forEach(s => s.value = "");
    _applySearch();
  });
  _applySearch();
}

function _applySearch() {
  const name = document.getElementById("sf-name").value.trim().toLowerCase();
  const team = document.getElementById("sf-team").value;
  const comp = document.getElementById("sf-comp").value;
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

  const filtered = _searchData.filter(p => {
    if (name && !p.player.toLowerCase().includes(name)) return false;
    if (team && p.team_code !== team) return false;
    if (comp && !p.competitions.includes(comp)) return false;
    if (pos  && p.position !== pos) return false;
    for (const r of ranges) {
      const v = p[r.key];
      if (v == null) return false;               // null no matchea rango (Feature 08)
      if (r.op === "min" && v < r.val) return false;
      if (r.op === "max" && v > r.val) return false;
    }
    return true;
  });
  document.getElementById("sf-count").textContent = `${filtered.length} jugadores`;
  _renderSearchResults(filtered);
}

function _renderSearchResults(rows) {
  const box = document.getElementById("search-results");
  if (!rows.length) { box.innerHTML = `<p class="empty">Ningún jugador cumple los filtros</p>`; return; }
  const k = _searchSort.key;
  const sorted = [...rows].sort((a, b) => _cmpNullsLast(a[k], b[k], _searchSort.dir));
  const fmt = (c, p) => {
    const v = p[c.key];
    if (c.txt) return v || "—";
    return fmtOrNull(v, c.int ? String : c.pct ? PCT : DEC2, p.null_reasons?.[c.key]);
  };
  box.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table class="search-table">
          <thead><tr>${SEARCH_COLS.map(c => `<th data-key="${c.key}">${c.label}</th>`).join("")}</tr></thead>
          <tbody>
            ${sorted.map(p => `
              <tr data-team="${p.team_code}" data-player="${p.player.replace(/"/g,'&quot;')}">
                ${SEARCH_COLS.map(c => `<td>${fmt(c, p)}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
  box.querySelectorAll("th").forEach(th => th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (_searchSort.key === key) _searchSort.dir *= -1;
    else _searchSort = { key, dir: ["player","team_code","position"].includes(key) ? 1 : -1 };
    _renderSearchResults(rows);
  }));
  box.querySelectorAll("tbody tr").forEach(tr => tr.addEventListener("click", () => {
    setSection("player");
    renderPlayer(tr.dataset.team, tr.dataset.player);
  }));
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
const NAV_ITEMS = {
  import:  { icon: "📥", label: "Importar" },
  league:  { icon: "🏆", label: "Liga" },
  team:    { icon: "📊", label: "Equipo" },
  compare: { icon: "⚡", label: "Comparar" },
  player:  { icon: "👤", label: "Jugador" },
  search:  { icon: "🔎", label: "Buscar" },
};

function renderApp() {
  document.getElementById("app").innerHTML = `
    <header>
      <span class="header-logo">🏀 Smart-Basket</span>
      <span class="header-sub">Basketball Advanced Analytics</span>
      ${_authRequired ? `<span class="header-user">${_authUser || ""} · <button class="header-logout" id="btn-logout">Salir</button></span>` : ""}
    </header>
    <nav>
      ${sections.map(s => `
        <button data-section="${s}">
          <span class="nav-icon">${NAV_ITEMS[s].icon}</span>
          ${NAV_ITEMS[s].label}
        </button>`).join("")}
    </nav>
    <main>
      <div class="section" id="sec-import"></div>
      <div class="section" id="sec-league"></div>

      <!-- Team -->
      <div class="section" id="sec-team">
        <div class="card">
          <div class="team-controls">
            <select id="team-select"><option value="">— Seleccionar equipo —</option></select>
            <select id="player-select"><option value="">— Seleccionar jugador —</option></select>
            <button class="btn btn-ghost" id="btn-show-player">Ver jugador</button>
            <button class="btn btn-ghost" id="btn-show-shotmap">Ver mapa de tiro</button>
            <button class="btn btn-ghost" id="btn-show-onoff">Ver ON/OFF</button>
          </div>
          <div class="filter-pills" id="team-filter-pills" style="display:none;margin-top:12px">
            <span style="color:var(--muted);font-size:12px;align-self:center;margin-right:4px">Período:</span>
            <button class="filter-pill active" data-n="0">Todos</button>
            <button class="filter-pill" data-n="5">Últ. 5</button>
            <button class="filter-pill" data-n="3">Últ. 3</button>
          </div>
          <span id="team-comp-wrap" style="display:none;margin-top:12px">
            <select id="team-comp" class="map-select"></select>
          </span>
        </div>
        <div id="team-teamshot"></div>
        <div id="team-shotmap"></div>
        <div id="team-onoff"></div>
        <div class="card" id="team-lineup-card" style="display:none">
          <div class="card-title">Combinaciones (Lineups)</div>
          <p class="td-muted">Elegí entre 3 y 5 jugadores para ver el rendimiento del equipo cuando comparten cancha.</p>
          <div class="lineup-picker" id="team-lineup-picker"></div>
          <button class="btn btn-ghost" id="btn-analyze-lineup" style="margin-top:12px">Analizar combinación</button>
        </div>
        <div id="team-lineup"></div>
        <div id="team-main"></div>
        <div id="team-clutch"></div>
        <div id="usage-ranking"></div>
      </div>

      <!-- Compare -->
      <div class="section" id="sec-compare">
        <div class="card">
          <div class="card-title">Comparar equipos</div>
          <div class="compare-controls">
            <select id="compare-a"><option value="">— Equipo A —</option></select>
            <select id="compare-b"><option value="">— Equipo B —</option></select>
            <select id="compare-comp" style="display:none"><option value="">Todas las competencias</option></select>
            <button class="btn" id="btn-compare">Comparar</button>
          </div>
        </div>
        <div id="compare-result"></div>
      </div>

      <!-- Player -->
      <div class="section" id="sec-player">
        <div id="player-main"><p class="empty">Selecciona un jugador desde la vista de equipo.</p></div>
      </div>

      <!-- Search -->
      <div class="section" id="sec-search">
        <div id="search-main"><p class="empty"><span class="spinner"></span>Cargando buscador...</p></div>
      </div>
    </main>`;

  // Nav clicks
  document.querySelectorAll("nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      setSection(btn.dataset.section);
      if (btn.dataset.section === "import")  renderImport();
      if (btn.dataset.section === "league")  renderLeague();
      if (btn.dataset.section === "team")    refreshTeamSelector();
      if (btn.dataset.section === "compare") renderCompare();
      if (btn.dataset.section === "search")  renderSearch();
    });
  });

  // Team selector
  const teamSel = document.getElementById("team-select");
  teamSel.addEventListener("change", () => {
    // limpiar apartados del equipo anterior (mapas de tiro, ON/OFF, lineup, cierres)
    ["team-teamshot", "team-shotmap", "team-onoff", "team-lineup", "team-clutch"].forEach(id => {
      const box = document.getElementById(id);
      if (box) box.innerHTML = "";
    });
    if (teamSel.value) renderTeam(teamSel.value);
  });

  // Player button
  document.getElementById("btn-show-player").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = document.getElementById("player-select").value;
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    setSection("player");
    renderPlayer(team, player);
  });

  // Shot map button — muestra el mapa de tiro DENTRO de Equipo
  document.getElementById("btn-show-shotmap").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = document.getElementById("player-select").value;
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    renderTeamShotmap(team, player);
  });

  // ON/OFF button
  document.getElementById("btn-show-onoff").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = document.getElementById("player-select").value;
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    renderTeamOnOff(team, player);
  });

  // Lineup (combinación) button
  document.getElementById("btn-analyze-lineup").addEventListener("click", () => {
    const team = document.getElementById("team-select").value;
    if (!team) return toast("Selecciona un equipo", "err");
    const checked = Array.from(
      document.querySelectorAll("#team-lineup-picker input:checked")
    ).map(el => el.value);
    if (checked.length < 3 || checked.length > 5) return toast("Elegí entre 3 y 5 jugadores", "err");
    renderTeamLineup(team, checked);
  });

  // Last-N filter pills
  document.getElementById("team-filter-pills").addEventListener("click", e => {
    const pill = e.target.closest(".filter-pill");
    if (!pill || !_teamData) return;
    const n = parseInt(pill.dataset.n, 10);
    _teamLastN = n;
    document.querySelectorAll(".filter-pill").forEach(p => p.classList.toggle("active", p === pill));
    _renderTeamContent(document.getElementById("team-main"), _teamData, n);
  });

  // Competition filter (compone con las pills Últ. N)
  document.getElementById("team-comp").addEventListener("change", e => {
    if (!_teamData) return;
    _teamComp = e.target.value;
    _renderTeamContent(document.getElementById("team-main"), _teamData, _teamLastN);
    renderTeamClutch(_teamData.team_code);   // los cierres se calculan en el backend por competencia
  });

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await api.logout(); } catch {}
      showLogin("Sesión cerrada.");
    });
  }

  setSection("import");
  renderImport();
}

// ── Login screen ─────────────────────────────────────────────────────────────
function showLogin(message = "") {
  document.getElementById("app").innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <div class="login-logo">🏀 Smart-Basket</div>
        <div class="login-sub">Ingresá para continuar</div>
        ${message ? `<div class="login-msg">${message}</div>` : ""}
        <input id="login-user" type="text" placeholder="Usuario" autocomplete="username" required />
        <input id="login-pass" type="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button class="btn" type="submit" id="login-btn">Entrar</button>
        <div class="login-err" id="login-err"></div>
      </form>
    </div>`;
  const form  = document.getElementById("login-form");
  const errEl = document.getElementById("login-err");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const user     = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    const btn      = document.getElementById("login-btn");
    errEl.textContent = "";
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Entrando...';
    try {
      await api.login(user, password);
      boot();  // re-check session and build the app
    } catch (err) {
      errEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
  document.getElementById("login-user").focus();
}

async function boot() {
  setUnauthorizedHandler(() => showLogin("Sesión expirada. Iniciá sesión de nuevo."));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  let me;
  try { me = await api.me(); }
  catch { me = { authenticated: false, auth_required: false, seed_enabled: false, is_admin: false }; }
  _authRequired = me.auth_required === true;
  _authUser     = me.user || null;
  _seedEnabled  = me.seed_enabled === true;
  _isAdmin      = me.is_admin === true;

  if (_authRequired && !me.authenticated) {
    showLogin();
  } else {
    renderApp();
  }
}

boot();
