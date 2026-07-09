import { api, setUnauthorizedHandler } from "./api.js";
import { drawRadar, drawEvolution, drawPlayerEvolution, drawLeagueScatter, drawCompareRadar, resetZoom } from "./charts.js";

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Stat helpers ───────────────────────────────────────────────────────────
const PCT  = v => v != null ? (v * 100).toFixed(1) + "%" : "—";
const DEC2 = v => v != null ? Number(v).toFixed(2) : "—";

function statClass(value, avg, higherIsBetter = true) {
  if (value == null || avg == null) return "neutral";
  return (higherIsBetter ? value >= avg : value <= avg) ? "above-avg" : "below-avg";
}

function statBox(label, value, display, leagueKey, league, higherIsBetter = true) {
  const lg    = leagueKey ? league?.[leagueKey] : null;
  const avg   = lg?.avg;
  const best  = lg?.best;
  const cls   = statClass(value, avg, higherIsBetter);
  const isPct = !!leagueKey && (leagueKey.includes("pct") || leagueKey.includes("or_") || leagueKey.includes("dr_") || leagueKey.includes("to_") || leagueKey.includes("as_"));
  const fmt   = v => v != null ? (isPct ? PCT(v) : DEC2(v)) : "—";
  const context = lg ? `
      <div class="stat-context">
        <span class="avg">Ø ${fmt(avg)}</span>
        &nbsp;
        <span class="best">↑ ${fmt(best)}</span>
      </div>` : "";
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${cls}">${display}</div>
      ${context}
    </div>`;
}

// ── Compute averages from a game_log array (for last-N filter) ─────────────
function _computeAvg(gameLog) {
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
  return result;
}

// ── Four Factors card ──────────────────────────────────────────────────────
function _fourFactorsCard(av, teamName) {
  const factors = [
    { label: "eFG%",    team: av.efg_pct,     opp: av.opp_efg_pct, fmt: PCT, hib: true,  title: "Eficiencia de tiro ajustada" },
    { label: "TO%",     team: av.to_pct,      opp: av.opp_to_pct,  fmt: PCT, hib: false, title: "Cuidado del balón" },
    { label: "RebOf%",  team: av.or_pct,      opp: 1-(av.dr_pct||0), fmt: PCT, hib: true, title: "Segundas oportunidades" },
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
  const pct = record.win_pct != null ? (record.win_pct * 100).toFixed(0) + "%" : "—";
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

function _fmtDate(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function _gamesTable(games, page) {
  if (!games.length) return '<p class="empty">Sin partidos aún.</p>';
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
      <td class="td-comp">${g.competition || "—"}</td>
    </tr>`;
  }).join("");

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${cbHeader}<th>Fecha</th><th>Local</th><th>Result.</th><th>Visitante</th><th>Competencia</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${pagination}`;
}

function _showDeleteModal(count, ids) {
  const hasToken = !!localStorage.getItem("adminToken");
  const tokenNote = hasToken
    ? `<p class="token-note">Token configurado. <a href="#" id="lnk-change-token">Cambiar</a></p>`
    : `<p class="token-note token-missing">Token de administrador requerido:</p>
       <input id="admin-token-input" type="password" placeholder="Token de administrador" class="token-input" />`;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Eliminar partido${count > 1 ? "s" : ""}</h3>
      <p>¿Eliminar ${count} partido${count > 1 ? "s" : ""}? Se eliminará toda la información asociada (estadísticas, jugadores, tiros). Esta acción no se puede deshacer.</p>
      ${tokenNote}
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="btn-cancel-delete">Cancelar</button>
        <button class="btn btn-danger btn-sm" id="btn-confirm-delete">Eliminar</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", async e => {
    if (e.target === backdrop || e.target.id === "btn-cancel-delete") {
      backdrop.remove();
      return;
    }
    if (e.target.id === "lnk-change-token") {
      e.preventDefault();
      localStorage.removeItem("adminToken");
      backdrop.remove();
      _showDeleteModal(count, ids);
      return;
    }
    if (e.target.id === "btn-confirm-delete") {
      const tokenInput = backdrop.querySelector("#admin-token-input");
      if (tokenInput) {
        const val = tokenInput.value.trim();
        if (!val) { toast("Ingresa el token de administrador", "err"); return; }
        localStorage.setItem("adminToken", val);
      }
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = "Eliminando…";
      try {
        await api.deleteGames(ids);
        toast(`${count} partido${count > 1 ? "s" : ""} eliminado${count > 1 ? "s" : ""}`);
        selectMode = false;
        selectedGames.clear();
        importPage = 0;
        backdrop.remove();
        renderImport();
        refreshTeamSelector();
        refreshCompareSelectors();
      } catch (err) {
        if (err.message.includes("autorizado") || err.message.includes("401")) {
          localStorage.removeItem("adminToken");
          toast("Token incorrecto. Intenta de nuevo.", "err");
        } else {
          toast(err.message, "err");
        }
        btn.disabled = false;
        btn.textContent = "Eliminar";
      }
    }
  });
}

async function renderImport(allGames) {
  const games = allGames || await api.games().catch(() => []);
  const sec   = document.getElementById("sec-import");

  const deleteBtnStyle = selectMode && selectedGames.size > 0 ? "" : "display:none";
  const selectBtnLabel = selectMode ? "Cancelar" : "Seleccionar partidos";

  sec.innerHTML = `
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
        <div class="card-title" style="margin:0">Partidos importados (${games.length})</div>
        <div class="games-header-actions">
          <button class="btn btn-ghost btn-sm" id="btn-select-mode">${selectBtnLabel}</button>
          <button class="btn-delete-sel" id="btn-delete-sel" style="${deleteBtnStyle}">🗑 Eliminar seleccionados</button>
        </div>
      </div>
      <div id="games-table">${_gamesTable(games, importPage)}</div>
    </div>`;

  document.getElementById("btn-import").addEventListener("click", async () => {
    const url = document.getElementById("url-input").value.trim();
    if (!url) return toast("Ingresa una URL", "err");
    const btn = document.getElementById("btn-import");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Importando...';
    try {
      const res = await api.importGame(url);
      const teamNames = (res.teams || []).map(t => t.name).join(" vs ");
      toast(`Partido importado: ${teamNames}`);
      importPage = 0;
      renderImport();
      refreshTeamSelector();
      refreshCompareSelectors();
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importar";
    }
  });

  const seedBtn = document.getElementById("btn-seed");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = '<span class="spinner"></span>Importando partidos...';
      try {
        const res = await api.seed();
        toast(`Seed: ${res.imported} importados, ${res.failed} fallidos`,
              res.failed ? "err" : "ok");
        importPage = 0;
        renderImport();
        refreshTeamSelector();
        refreshCompareSelectors();
      } catch (e) {
        toast(e.message, "err");
      } finally {
        seedBtn.disabled = false;
        seedBtn.textContent = "⚡ Agregar partidos (dev)";
      }
    });
  }
}

// ── League section — sortable table ───────────────────────────────────────
let _leagueTeams    = [];
let _leagueSortKey  = "oer";
let _leagueSortDir  = -1; // -1 desc, 1 asc
let _leagueMap      = "ef";

// Scatter map presets — each defines the X/Y axes for el mapa de liga.
const LEAGUE_MAPS = [
  {
    id: "ef", label: "Eficiencia (OER / DER)",
    axis: { xKey: "oer", xName: "OER", xTitle: "OER  (↑ mejor ataque)", xPct: false,
            yKey: "der", yName: "DER", yTitle: "DER  (↓ mejor defensa)", yPct: false },
    hint: "Derecha = mejor ataque (OER alto) &nbsp;|&nbsp; Abajo = mejor defensa (DER bajo) &nbsp;|&nbsp; Abajo-derecha = elite",
  },
  {
    id: "reb", label: "Rebotes (OR% / DR%)",
    axis: { xKey: "or_pct", xName: "OR%", xTitle: "OR%  (↑ mejor)", xPct: true,
            yKey: "dr_pct", yName: "DR%", yTitle: "DR%  (↑ mejor)", yPct: true },
    hint: "Arriba-derecha = domina ambos tableros (ofensivo y defensivo)",
  },
  {
    id: "rec", label: "Recuperos / Puntos",
    axis: { xKey: "stl", xName: "Recuperos", xTitle: "Recuperos por partido  (↑)", xPct: false,
            yKey: "pts", yName: "Puntos", yTitle: "Puntos por partido  (↑)", yPct: false },
    hint: "Derecha = más robos &nbsp;|&nbsp; Arriba = más puntos &nbsp;|&nbsp; Arriba-derecha = elite",
  },
];

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

function _sortedLeague() {
  return [..._leagueTeams].sort((a, b) => {
    const va = a[_leagueSortKey], vb = b[_leagueSortKey];
    if (va == null) return 1;
    if (vb == null) return -1;
    return typeof va === "string"
      ? va.localeCompare(vb) * _leagueSortDir
      : (va - vb) * _leagueSortDir;
  });
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
      <td class="${t.net_rating >= 0 ? 'above-avg' : 'below-avg'}">${DEC2(t.net_rating)}</td>
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
  drawLeagueScatter("chart-scatter", _leagueTeams, map.axis);
}

async function renderLeague() {
  const sec = document.getElementById("sec-league");
  sec.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  try {
    _leagueTeams = await api.league();
    if (!_leagueTeams.length) { sec.innerHTML = '<p class="empty">Sin datos. Importa partidos primero.</p>'; return; }

    sec.innerHTML = `
      <div class="card">
        <div class="card-title">Ranking de equipos — Liga <span style="color:var(--muted);font-size:10px;font-weight:400;margin-left:8px">Click en columna para ordenar</span></div>
        <div class="table-wrap">
          <table id="league-table" class="table-sticky"></table>
        </div>
      </div>`;

    const tableEl = document.getElementById("league-table");
    tableEl.innerHTML = _leagueTableHTML(_sortedLeague());
    _bindLeagueTableEvents(tableEl);
    _bindLeagueRowClicks(tableEl);

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

// ── Clutch por equipo (últimos 5 min, dif ≤ 15) — dentro de Equipo (Feat 05 v2) ──
let _clutchData = null;
let _clutchSort = { key: "date", dir: -1 };

const CLUTCH_COLS = [
  { key: "date", label: "Fecha", date: true },
  { key: "opponent_code", label: "Rival", txt: true }, { key: "home_away", label: "L/V", txt: true },
  { key: "entry_margin", label: "Δ@5:00", int: true },
  { key: "point_diff", label: "Dif", diff: true }, { key: "pts", label: "Pts", int: true },
  { key: "off_rating", label: "Off" }, { key: "def_rating", label: "Def" },
  { key: "efg_pct", label: "eFG%", pct: true }, { key: "ts_pct", label: "TS%", pct: true },
  { key: "tov", label: "TOV", int: true }, { key: "ast", label: "AST", int: true },
  { key: "reb", label: "REB", int: true },
  { key: "fouls_drawn", label: "FR", int: true }, { key: "fouls_committed", label: "FC", int: true },
  { key: "top_finisher", label: "Finaliza", leader: "pts" }, { key: "top_creator", label: "Crea", leader: "ast" },
];

async function renderTeamClutch(teamCode) {
  const box = document.getElementById("team-clutch");
  if (!box) return;
  const title = '<div class="card-title">Cierres (últimos 5 min, dif ≤ 15)</div>';
  box.innerHTML = `<div class="card">${title}<p class="empty"><span class="spinner"></span>Calculando cierres...</p></div>`;
  try {
    _clutchData = await api.clutchTeam(teamCode);
  } catch (e) {
    box.innerHTML = `<div class="card">${title}<p class="empty below-avg">${e.message || "No se pudieron cargar los cierres"}</p></div>`;
    return;
  }
  const d = _clutchData;
  if (!d.games_qualified) {
    box.innerHTML = `<div class="card">${title}<p class="empty">Sin cierres apretados: los ${d.games_excluded} partido(s) con play-by-play se definieron por más de ${d.margin} al minuto 5:00.</p></div>`;
    return;
  }
  const a = d.aggregate;
  box.innerHTML = `
    <div class="card">
      ${title}
      <p class="td-muted">Agregado del equipo en cierres apretados — récord <strong>${d.clutch_record}</strong> · ${d.games_qualified} calificado(s)${d.games_excluded ? ` · ${d.games_excluded} excluido(s) por paliza` : ""}</p>
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
  const _val = v => (v && typeof v === "object") ? (v.pts ?? v.ast ?? 0) : v;
  const sorted = [..._clutchData.per_game].sort((a, b) => {
    let av = _val(a[k]), bv = _val(b[k]);
    if (typeof av === "string" || typeof bv === "string")
      return _clutchSort.dir * String(av ?? "").localeCompare(String(bv ?? ""));
    if (av == null) av = -Infinity;
    if (bv == null) bv = -Infinity;
    return _clutchSort.dir * (av - bv);
  });
  const cell = (c, r) => {
    const v = r[c.key];
    if (c.leader) return v ? `${v.name} (${v[c.leader]})` : "—";
    if (c.date)   return _fmtDate(v);
    if (c.diff)   { const cls = v > 0 ? "above-avg" : v < 0 ? "below-avg" : ""; return `<span class="${cls}">${v > 0 ? "+" : ""}${v}</span>`; }
    if (c.txt)    return v || "—";
    if (c.int)    return v == null ? "—" : v;
    if (c.pct)    return PCT(v);
    return DEC2(v);
  };
  t.innerHTML = `
    <thead><tr>${CLUTCH_COLS.map(c => `<th data-key="${c.key}">${c.label}</th>`).join("")}</tr></thead>
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

function _filteredLog(gameLog, n) {
  if (!n) return gameLog;
  const sorted = [...gameLog].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted.slice(0, n);
}

// ── Usage ranking card ──────────────────────────────────────────────────────
function _renderUsageRanking(players) {
  const el = document.getElementById("usage-ranking");
  if (!el || !players?.length) return;
  const maxUso = players[0]?.uso_pct || 1;
  const rows = players.map(p => {
    const pct = p.uso_pct ? (p.uso_pct * 100).toFixed(1) + "%" : "—";
    const bar = p.uso_pct ? Math.round((p.uso_pct / maxUso) * 100) : 0;
    const pts = p.pts ? p.pts.toFixed(1) : "—";
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
  const filtered = _filteredLog(data.game_log, n);
  const av = n ? _computeAvg(filtered) : data.averages;
  const lg = data.league;
  const rec = n ? null : data.record;

  main.innerHTML = `
    ${_recordCard(rec, data.team_name)}
    <div class="card">
      <div class="card-title">Eficiencia</div>
      <div class="stat-grid">
        ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg)}
        ${statBox("DER", av.der, DEC2(av.der), "der", lg, false)}
        ${statBox("Net Rating", av.net_rating, DEC2(av.net_rating), "net_rating", lg)}
        ${statBox("Pace", av.pace, DEC2(av.pace), "pace", lg)}
        ${statBox("PPT", av.pps, DEC2(av.pps), "pps", lg)}
        ${statBox("FT Rate", av.ft_rate, DEC2(av.ft_rate), "ft_rate", lg)}
      </div>
    </div>
    ${_fourFactorsCard(av, data.team_name)}
    <div class="card">
      <div class="card-title">Tiro</div>
      <div class="stat-grid">
        ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg)}
        ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg)}
        ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg)}
        ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg)}
        ${statBox("FT%", av.ft_pct, PCT(av.ft_pct), "ft_pct", lg)}
        ${statBox("Uso 3P", av.fg3_uso, PCT(av.fg3_uso), "fg3_uso", lg)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Rebotes & Misc</div>
      <div class="stat-grid">
        ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg)}
        ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg)}
        ${statBox("Reb%", av.trb_pct, PCT(av.trb_pct), "trb_pct", lg)}
        ${statBox("TO", av.tov, DEC2(av.tov), "to_ratio", lg, false)}
        ${statBox("AS", av.ast, DEC2(av.ast), "ast_ratio", lg)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Defensa avanzada</div>
      <div class="stat-grid">
        ${statBox("Robos", av.stl, DEC2(av.stl), "stl", lg)}
        ${statBox("Tapones", av.blk, DEC2(av.blk), "blk", lg)}
        ${statBox("Stops", av.stocks, DEC2(av.stocks), "stocks", lg)}
        ${statBox("Def Playmaking", av.def_playmaking, DEC2(av.def_playmaking), "def_playmaking", lg)}
        ${statBox("DEF/TO Ratio", av.def_to_ratio, DEC2(av.def_to_ratio), "def_to_ratio", lg)}
      </div>
    </div>
    ${(av.paint_pts || av.second_chance_pts || av.pts_from_tov || av.bench_pts || av.fast_break_pts) ? `
    <div class="card">
      <div class="card-title">Desglose ofensivo</div>
      <div class="stat-grid">
        ${statBox("PeP",       av.paint_pts,         DEC2(av.paint_pts),         null, null, false)}
        ${statBox("Seg. Op.",  av.second_chance_pts,  DEC2(av.second_chance_pts), null, null, false)}
        ${statBox("Ptos/PER",  av.pts_from_tov,       DEC2(av.pts_from_tov),      null, null, false)}
        ${statBox("Banca",     av.bench_pts,          DEC2(av.bench_pts),         null, null, false)}
        ${statBox("PCA",       av.fast_break_pts,     DEC2(av.fast_break_pts),    null, null, false)}
      </div>
    </div>` : ""}
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
            ${filtered.map(g => `
              <tr>
                <td class="td-muted">${_fmtDate(g.date)}</td>
                <td>${g.opponent}</td>
                <td class="td-muted">${g.home_away}</td>
                <td class="td-result">${g.pts}</td>
                <td>${DEC2(g.oer)}</td>
                <td>${DEC2(g.der)}</td>
                <td>${PCT(g.efg_pct)}</td>
                <td>${PCT(g.ts_pct)}</td>
                <td>${PCT(g.or_pct)}</td>
                <td>${PCT(g.dr_pct)}</td>
                <td>${PCT(g.to_pct)}</td>
              </tr>`).join("")}
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

  try {
    _teamData = await api.team(teamCode);

    // Filter pills
    const filterWrap = document.getElementById("team-filter-pills");
    if (filterWrap) {
      filterWrap.style.display = _teamData.games > 3 ? "" : "none";
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

    renderTeamClutch(teamCode);   // cierres del equipo (Feature 05 v2)
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
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
      ? `${side}: ${data.possessions} pos · ${Math.round(data.seconds / 60)}'`
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
      ? `<p class="empty below-avg" style="margin-top:8px">Muestra chica (${r.sample.possessions} posesiones) — tomar con cuidado</p>`
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
          ${r.sample.possessions} posesiones · ${Math.round(r.sample.seconds / 60)}' en cancha ·
          ${r.games_used} partido(s) usado(s)${r.games_excluded ? ` (${r.games_excluded} excluido(s) por datos inconsistentes)` : ""}
        </p>
        ${smallSample}
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
      const avA = dataA.averages, avB = dataB.averages;
      const lg  = dataA.league;

      const a = avA, b = avB;
      const N1 = v => v != null ? Math.round(v) : 0;
      const D1 = v => v != null ? Number(v).toFixed(1) : "0";

      const shootRow = (label, madeA, attA, madeB, attB) => {
        const pctA = attA ? Math.round(100 * madeA / attA) : 0;
        const pctB = attB ? Math.round(100 * madeB / attB) : 0;
        const winA = pctA >= pctB;
        return `<tr>
          <td class="${winA ? 'winner' : 'loser'}">${N1(madeA)}/${N1(attA)} (${pctA}%)</td>
          <td class="lbl">${label}</td>
          <td class="${!winA ? 'winner' : 'loser'}">${N1(madeB)}/${N1(attB)} (${pctB}%)</td>
        </tr>`;
      };
      const rawRow = (label, va, vb, lowerBetter = false) => {
        const winA = lowerBetter ? va <= vb : va >= vb;
        return `<tr>
          <td class="${winA ? 'winner' : 'loser'}">${D1(va)}</td>
          <td class="lbl">${label}</td>
          <td class="${!winA ? 'winner' : 'loser'}">${D1(vb)}</td>
        </tr>`;
      };

      const pfA = N1(a.pf), pfB = N1(b.pf), oppPfA = N1(a.opp_pf), oppPfB = N1(b.opp_pf);
      const rows = [
        shootRow("LC",      a.fgm,  a.fga,  b.fgm,  b.fga),
        shootRow("2Pts",    a.fgm2, a.fga2, b.fgm2, b.fga2),
        shootRow("3Pts",    a.fgm3, a.fga3, b.fgm3, b.fga3),
        shootRow("1Pt",     a.ftm,  a.fta,  b.ftm,  b.fta),
        rawRow("REB",       a.trb || (a.orb + a.drb), b.trb || (b.orb + b.drb)),
        rawRow("As",        a.ast,  b.ast),
        rawRow("ST",        a.stl,  b.stl),
        rawRow("Blq",       a.blk,  b.blk),
        rawRow("PER",       a.tov,  b.tov,  true),
        `<tr>
          <td class="${pfA <= pfB ? 'winner' : 'loser'}">${pfA} (${oppPfA})</td>
          <td class="lbl">FP</td>
          <td class="${pfB <= pfA ? 'winner' : 'loser'}">${pfB} (${oppPfB})</td>
        </tr>`,
        rawRow("PeP",       a.paint_pts         || 0, b.paint_pts         || 0),
        rawRow("PtsSegCh",  a.second_chance_pts || 0, b.second_chance_pts || 0),
        rawRow("PtPer",     a.pts_from_tov      || 0, b.pts_from_tov      || 0),
        rawRow("Pts Banca", a.bench_pts         || 0, b.bench_pts         || 0),
        rawRow("PCA",       a.fast_break_pts    || 0, b.fast_break_pts    || 0),
      ].join("");

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

// Heatmap por P/F (puntos por finalización), umbrales calcados de la imagen de referencia
const _scBoxFill = pf => pf >= 1.00 ? "#79b13f" : pf >= 0.85 ? "#ef8b3a" : "#df574c";
const _scDec2 = v => v.toFixed(2).replace(".", ",");
const _scDec1 = v => v.toFixed(1).replace(".", ",");

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

function _scLbl(zones, totalShots, key, lx, ly) {
  const z = zones?.[key];
  if (!z?.attempts) return '';
  const share = _scDec1((z.attempts / totalShots) * 100);
  const pf    = _scDec2(z.pf);
  const fg    = _scDec1(z.pct * 100) + '%';
  const bg    = _scBoxFill(z.pf);
  const w = 54, h = 33, r = 4;
  const x0 = lx - w / 2, y0 = ly - h / 2;
  return `
    <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="${bg}" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>
    <text x="${lx - 5}" y="${ly - 6}" text-anchor="end"   fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">${share}%</text>
    <text x="${lx + 4}" y="${ly - 6}" text-anchor="start" fill="rgba(0,0,0,0.70)" font-size="7.5" font-family="Inter,sans-serif">P/F ${pf}</text>
    <text x="${lx}"     y="${ly + 9}" text-anchor="middle" fill="${SC_boxText}" font-size="14" font-weight="800" font-family="Inter,sans-serif">${fg}</text>`;
}

function _scBadge(summary) {
  if (!summary) return '';
  const pf  = summary.global_pf != null ? _scDec2(summary.global_pf) : '—';
  const efg = summary.efg_pct   != null ? _scDec1(summary.efg_pct * 100) + ' %' : '—';
  const cw = 70, ch = 38, bx = SC_cR - 2 * cw, by = SC_cT + 2;
  return `
    <rect x="${bx}"      y="${by}" width="${cw}" height="${ch}" rx="4" fill="#ef8b3a"/>
    <rect x="${bx + cw}" y="${by}" width="${cw}" height="${ch}" rx="4" fill="#9aa83a"/>
    <text x="${bx + cw/2}"        y="${by + 14}" text-anchor="middle" fill="rgba(0,0,0,0.65)" font-size="9"  font-family="Inter,sans-serif">P/F</text>
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
async function renderPlayer(teamCode, playerName) {
  const main = document.getElementById("player-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';

  try {
    const data = await api.player(teamCode, playerName);
    const av   = data.averages;
    const lg   = data.league;

    main.innerHTML = `
      <div class="card">
        <div class="card-title">Producción ofensiva</div>
        <div class="stat-grid">
          ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg)}
          ${statBox("USO%", av.uso_pct, PCT(av.uso_pct), "uso_pct", lg)}
          ${statBox("PPP", av.ppp, DEC2(av.ppp), "ppp", lg)}
          ${statBox("PPT", av.pps, DEC2(av.pps), "pps", lg)}
          ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg)}
          ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg)}
          ${statBox("FT Rate", av.ft_rate, DEC2(av.ft_rate), "ft_rate", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Tiro</div>
        <div class="stat-grid">
          ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg)}
          ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg)}
          ${statBox("FT%", av.ft_pct, PCT(av.ft_pct), "ft_pct", lg)}
          ${statBox("Uso 2P", av.fg2_uso, PCT(av.fg2_uso), "fg2_uso", lg)}
          ${statBox("Uso 3P", av.fg3_uso, PCT(av.fg3_uso), "fg3_uso", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Rebotes & distribución</div>
        <div class="stat-grid">
          ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg)}
          ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg)}
          ${statBox("TO", av.tov, DEC2(av.tov), "to_ratio", lg, false)}
          ${statBox("AS", av.ast, DEC2(av.ast), "ast_ratio", lg)}
          ${statBox("AST/TO", av.ast_to, DEC2(av.ast_to), "ast_ratio", lg)}
          ${statBox("% Reb Equipo", av.reb_share, PCT(av.reb_share), "reb_share", lg)}
          ${statBox("% RebOf Equipo", av.oreb_share, PCT(av.oreb_share), "oreb_share", lg)}
          ${statBox("% RebDef Equipo", av.dreb_share, PCT(av.dreb_share), "dreb_share", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Defensa avanzada</div>
        <div class="stat-grid">
          ${statBox("Robos", av.stl, DEC2(av.stl), "stl", lg)}
          ${statBox("Tapones", av.blk, DEC2(av.blk), "blk", lg)}
          ${statBox("Stops", av.stocks, DEC2(av.stocks), "stocks", lg)}
          ${statBox("Def Playmaking", av.def_playmaking, DEC2(av.def_playmaking), "def_playmaking", lg)}
          ${statBox("DEF/TO Ratio", av.def_to_ratio, DEC2(av.def_to_ratio), "def_to_ratio", lg)}
          ${statBox("Impacto Físico", av.physical_impact, DEC2(av.physical_impact), "physical_impact", lg)}
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
              ${data.game_log.map(g => `
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
                  <td>${DEC2(g.oer)}</td>
                  <td>${PCT(g.efg_pct)}</td>
                  <td>${PCT(g.ts_pct)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
    drawRadar("chart-player-radar", av, lg, playerName);
    drawPlayerEvolution("chart-player-evo", data.game_log);

    // Shot chart — async, non-blocking
    api.playerShots(teamCode, playerName).then(shots => {
      if (!shots || !shots.total_shots) return;
      const shotCard = document.createElement("div");
      shotCard.className = "card";
      shotCard.innerHTML = `
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.summary, shots.has_coordinates)}`;
      main.insertBefore(shotCard, main.querySelector(".chart-grid"));
    }).catch(() => {});
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
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
        <select id="sf-comp"><option value="">Competencia (todas)</option>${comps.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>
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
  const sorted = [...rows].sort((a, b) => {
    let av = a[k], bv = b[k];
    if (typeof av === "string" || typeof bv === "string")
      return _searchSort.dir * String(av ?? "").localeCompare(String(bv ?? ""));
    if (av == null) av = -Infinity;
    if (bv == null) bv = -Infinity;
    return _searchSort.dir * (av - bv);
  });
  const fmt = (c, v) => c.txt ? (v || "—") : c.int ? (v ?? "—") : c.pct ? PCT(v) : DEC2(v);
  box.innerHTML = `
    <div class="card">
      <div class="table-wrap">
        <table class="search-table">
          <thead><tr>${SEARCH_COLS.map(c => `<th data-key="${c.key}">${c.label}</th>`).join("")}</tr></thead>
          <tbody>
            ${sorted.map(p => `
              <tr data-team="${p.team_code}" data-player="${p.player.replace(/"/g,'&quot;')}">
                ${SEARCH_COLS.map(c => `<td>${fmt(c, p[c.key])}</td>`).join("")}
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
        </div>
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
    // limpiar apartados del equipo anterior (mapa de tiro, ON/OFF, lineup, cierres)
    ["team-shotmap", "team-onoff", "team-lineup", "team-clutch"].forEach(id => {
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

  // Import section: pagination + select mode + delete
  document.getElementById("sec-import").addEventListener("click", async e => {
    // Select mode toggle
    if (e.target.id === "btn-select-mode") {
      selectMode = !selectMode;
      selectedGames.clear();
      const games = await api.games().catch(() => []);
      renderImport(games);
      return;
    }

    // Delete selected
    if (e.target.id === "btn-delete-sel") {
      if (selectedGames.size === 0) return;
      _showDeleteModal(selectedGames.size, [...selectedGames]);
      return;
    }

    // Checkbox toggle
    if (e.target.classList.contains("row-cb")) {
      const id = e.target.dataset.id;
      if (!id) return;
      if (e.target.checked) {
        selectedGames.add(id);
      } else {
        selectedGames.delete(id);
      }
      const row = e.target.closest("tr");
      if (row) row.classList.toggle("selected-row", e.target.checked);
      const delBtn = document.getElementById("btn-delete-sel");
      if (delBtn) delBtn.style.display = selectedGames.size > 0 ? "" : "none";
      return;
    }

    // Pagination
    if (e.target.id === "pg-prev" && importPage > 0) importPage--;
    else if (e.target.id === "pg-next") importPage++;
    else return;
    const games = await api.games().catch(() => []);
    document.getElementById("games-table").innerHTML = _gamesTable(games, importPage);
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
  catch { me = { authenticated: false, auth_required: false, seed_enabled: false }; }
  _authRequired = me.auth_required === true;
  _authUser     = me.user || null;
  _seedEnabled  = me.seed_enabled === true;

  if (_authRequired && !me.authenticated) {
    showLogin();
  } else {
    renderApp();
  }
}

boot();
