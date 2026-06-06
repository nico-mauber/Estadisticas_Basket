import { api } from "./api.js";
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
  const lg    = league?.[leagueKey];
  const avg   = lg?.avg;
  const best  = lg?.best;
  const cls   = statClass(value, avg, higherIsBetter);
  const isPct = leagueKey.includes("pct") || leagueKey.includes("or_") || leagueKey.includes("dr_") || leagueKey.includes("to_") || leagueKey.includes("as_");
  const fmt   = v => v != null ? (isPct ? PCT(v) : DEC2(v)) : "—";
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${cls}">${display}</div>
      <div class="stat-context">
        <span class="avg">Ø ${fmt(avg)}</span>
        &nbsp;
        <span class="best">↑ ${fmt(best)}</span>
      </div>
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
    "orb","drb","ast","tov","stl","blk",
  ];
  const result = {};
  for (const k of keys) {
    const vals = gameLog.map(g => g[k]).filter(v => v != null && !isNaN(v));
    result[k] = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10000) / 10000 : 0;
  }
  result.net_rating = (result.oer || 0) - (result.der || 0);
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
const sections = ["import", "league", "team", "compare", "player"];
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
}

// ── League section — sortable table ───────────────────────────────────────
let _leagueTeams    = [];
let _leagueSortKey  = "oer";
let _leagueSortDir  = -1; // -1 desc, 1 asc

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
      sec.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="card-title">Mapa ofensivo / defensivo</div>
          <p class="chart-hint">
            Derecha = mejor ataque (OER alto) &nbsp;|&nbsp; Abajo = mejor defensa (DER bajo) &nbsp;|&nbsp; Abajo-derecha = elite
            &nbsp;&nbsp;·&nbsp;&nbsp;
            <span style="color:var(--muted)">🖱 rueda = zoom &nbsp;·&nbsp; arrastrar = mover &nbsp;·&nbsp; pellizcar = zoom táctil</span>
          </p>
          <canvas id="chart-scatter"></canvas>
          <div style="text-align:right;margin-top:8px">
            <button class="btn btn-ghost btn-sm" id="btn-reset-scatter">↺ Resetear zoom</button>
          </div>
        </div>`);
      drawLeagueScatter("chart-scatter", _leagueTeams);
      document.getElementById("btn-reset-scatter").addEventListener("click", () => resetZoom("chart-scatter"));
    }
  } catch (e) {
    sec.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
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
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
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

      const METRICS = [
        { key: "oer",       label: "OER",        hib: true,  fmt: DEC2 },
        { key: "der",       label: "DER",        hib: false, fmt: DEC2 },
        { key: "net_rating",label: "Net Rating",  hib: true,  fmt: DEC2 },
        { key: "efg_pct",   label: "eFG%",       hib: true,  fmt: PCT  },
        { key: "ts_pct",    label: "TS%",        hib: true,  fmt: PCT  },
        { key: "fg2_pct",   label: "FG2%",       hib: true,  fmt: PCT  },
        { key: "fg3_pct",   label: "FG3%",       hib: true,  fmt: PCT  },
        { key: "or_pct",    label: "OR%",        hib: true,  fmt: PCT  },
        { key: "dr_pct",    label: "DR%",        hib: true,  fmt: PCT  },
        { key: "to_pct",    label: "TO%",        hib: false, fmt: PCT  },
        { key: "as_pct",    label: "AS%",        hib: true,  fmt: PCT  },
        { key: "pace",      label: "Pace",       hib: true,  fmt: DEC2 },
        { key: "pts",       label: "Pts/partido",hib: true,  fmt: DEC2 },
      ];

      const rows = METRICS.map(m => {
        const va = avA[m.key], vb = avB[m.key];
        const aWins = va != null && vb != null && (m.hib ? va > vb : va < vb);
        const bWins = va != null && vb != null && (m.hib ? vb > va : vb < va);
        return `<tr>
          <td class="td-muted" style="font-weight:600">${m.label}</td>
          <td class="${aWins ? 'winner' : bWins ? 'loser' : ''}" style="text-align:right">${m.fmt(va)}</td>
          <td class="${bWins ? 'winner' : aWins ? 'loser' : ''}" style="text-align:right">${m.fmt(vb)}</td>
        </tr>`;
      }).join("");

      document.getElementById("compare-result").innerHTML = `
        <div class="chart-grid">
          <div class="card">
            <div class="card-title">Radar comparativo</div>
            <div class="radar-wrap">
              <canvas id="chart-compare-radar"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Estadísticas — ${dataA.team_name} vs ${dataB.team_name}</div>
            <div class="table-wrap">
              <table class="compare-table">
                <thead><tr>
                  <th>Métrica</th>
                  <th style="text-align:right;color:var(--accent)">${dataA.team_name}</th>
                  <th style="text-align:right;color:var(--blue)">${dataB.team_name}</th>
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

// ── Shot chart SVG — half court, 11 zones (PPT color coding) ──────────────
function _shotChartSVG(zones, totalShots, summary) {
  const W = 340, H = 320;
  const cx = 170, cy = 256;
  const cL = 20, cR = 320, cT = 8, cB = 288;
  const r3 = 135, rP = 50;
  const pbX1 = 121, pbX2 = 219, pbTop = 140;
  const c3xL = 38, c3xR = 302;
  const c3yJoin = Math.round(cy - Math.sqrt(r3 * r3 - (cx - c3xL) ** 2));
  const wingX = 75;
  const courtBg = "#162032", line = "#374151";

  function zFill(key) {
    const z = zones?.[key];
    if (!z?.attempts) return courtBg;
    const pf = z.pf;
    if (pf >= 1.05) return "rgba(22,163,74,0.80)";
    if (pf >= 0.90) return "rgba(101,163,13,0.72)";
    if (pf >= 0.70) return "rgba(234,88,12,0.72)";
    return "rgba(220,38,38,0.82)";
  }

  const hCirc = r => `M${cx - r},${cy} A${r},${r} 0 0,0 ${cx + r},${cy} Z`;
  const hRing = (r1, r2) =>
    `M${cx-r2},${cy} A${r2},${r2} 0 0,0 ${cx+r2},${cy} L${cx+r1},${cy} A${r1},${r1} 0 0,1 ${cx-r1},${cy} Z`;

  function lbl(key, lx, ly) {
    const z = zones?.[key];
    if (!z?.attempts) return '';
    const pct = (z.pct * 100).toFixed(1) + '%';
    const pf  = z.pf.toFixed(2);
    const bg  = zFill(key);
    const w = 58, h = 38, r = 4;
    const x0 = lx - w / 2, y0 = ly - h / 2;
    return `
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${r}" fill="${bg}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
      <text x="${lx - 6}" y="${ly - 5}" text-anchor="end"   fill="rgba(255,255,255,0.75)" font-size="9" font-family="Inter,sans-serif">${z.attempts}</text>
      <text x="${lx + 4}" y="${ly - 5}" text-anchor="start" fill="rgba(255,255,255,0.75)" font-size="9" font-family="Inter,sans-serif">PPT ${pf}</text>
      <text x="${lx}"     y="${ly + 11}" text-anchor="middle" fill="#fff" font-size="14" font-weight="800" font-family="Inter,sans-serif">${pct}</text>`;
  }

  function badge() {
    if (!summary) return '';
    const ppt = summary.global_pf != null ? summary.global_pf.toFixed(2) : '—';
    const ppp = summary.ppp       != null ? summary.ppp.toFixed(2)       : '—';
    const efg = summary.efg_pct   != null ? (summary.efg_pct * 100).toFixed(1)+'%' : '—';
    const g   = summary.games ?? 0;
    return `
      <rect x="${cR - 172}" y="${cT}"    width="54" height="22" rx="3" fill="rgba(99,102,241,0.90)"/>
      <text x="${cR - 145}"  y="${cT+14}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Inter,sans-serif">PPP ${ppp}</text>
      <rect x="${cR - 116}" y="${cT}"    width="54" height="22" rx="3" fill="rgba(234,88,12,0.90)"/>
      <text x="${cR - 89}"  y="${cT+14}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Inter,sans-serif">PPT ${ppt}</text>
      <rect x="${cR - 60}"  y="${cT}"    width="54" height="22" rx="3" fill="rgba(101,163,13,0.90)"/>
      <text x="${cR - 33}"  y="${cT+14}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Inter,sans-serif">eFG ${efg}</text>
      <circle cx="${cR - 4}" cy="${cT+11}" r="11" fill="#374151"/>
      <text   x="${cR - 4}"  y="${cT+15}" text-anchor="middle" fill="#e2e8f0" font-size="9" font-weight="700" font-family="Inter,sans-serif">${g}P</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:420px;margin:0 auto;display:block;border-radius:8px">
    <defs>
      <clipPath id="sc-clip"><rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}"/></clipPath>
      <clipPath id="sc-left"><rect x="${cL}" y="${cT}" width="${cx-cL}" height="${cB-cT}"/></clipPath>
      <clipPath id="sc-right"><rect x="${cx}" y="${cT}" width="${cR-cx}" height="${cB-cT}"/></clipPath>
      <clipPath id="sc-ctr"><rect x="${cx-wingX}" y="${cT}" width="${wingX*2}" height="${cB-cT}"/></clipPath>
    </defs>
    <rect width="${W}" height="${H}" fill="#0d1117" rx="8"/>
    <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="${courtBg}" rx="3"/>
    <rect x="${cx-wingX}" y="${cT}" width="${wingX*2}"  height="${cB-cT}" fill="${zFill('top_key_3')}"    clip-path="url(#sc-clip)"/>
    <rect x="${cL}"        y="${cT}" width="${cx-cL}"    height="${cB-cT}" fill="${zFill('left_wing_3')}"  clip-path="url(#sc-left)"/>
    <rect x="${cx}"        y="${cT}" width="${cR-cx}"    height="${cB-cT}" fill="${zFill('right_wing_3')}" clip-path="url(#sc-right)"/>
    <rect x="${cL}"   y="${c3yJoin}" width="${c3xL-cL}"   height="${cB-c3yJoin}" fill="${zFill('left_corner_3')}"  clip-path="url(#sc-clip)"/>
    <rect x="${c3xR}" y="${c3yJoin}" width="${cR-c3xR}"   height="${cB-c3yJoin}" fill="${zFill('right_corner_3')}" clip-path="url(#sc-clip)"/>
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_left_far')}"  clip-path="url(#sc-left)"/>
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_right_far')}" clip-path="url(#sc-right)"/>
    <path d="${hRing(rP, r3)}" fill="${zFill('mid_top')}"       clip-path="url(#sc-ctr)"/>
    <rect x="${c3xL}" y="${cy}" width="${pbX1-c3xL}" height="${cB-cy}" fill="${zFill('mid_left_close')}"  clip-path="url(#sc-clip)"/>
    <rect x="${pbX2}" y="${cy}" width="${c3xR-pbX2}" height="${cB-cy}" fill="${zFill('mid_right_close')}" clip-path="url(#sc-clip)"/>
    <path d="${hCirc(rP)}"                                                                         fill="${zFill('restricted_area')}" clip-path="url(#sc-clip)"/>
    <rect x="${pbX1}" y="${pbTop}" width="${pbX2-pbX1}" height="${cB-pbTop}"                       fill="${zFill('restricted_area')}" clip-path="url(#sc-clip)"/>
    <rect  x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="none" stroke="${line}" stroke-width="1.5" rx="3"/>
    <rect  x="${pbX1}" y="${pbTop}" width="${pbX2-pbX1}" height="${cB-pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <path  d="M${pbX1},${pbTop} A49,49 0 0,0 ${pbX2},${pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="4,3"/>
    <path  d="M${c3xL},${cB} L${c3xL},${c3yJoin} A${r3},${r3} 0 0,0 ${c3xR},${c3yJoin} L${c3xR},${cB}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <path  d="M${cx-rP},${cy} A${rP},${rP} 0 0,0 ${cx+rP},${cy}" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
    <circle cx="${cx}" cy="${cy}" r="9"  fill="none" stroke="#9ca3af" stroke-width="2"/>
    <line   x1="${cx-26}" y1="${cB-3}" x2="${cx+26}" y2="${cB-3}" stroke="#9ca3af" stroke-width="3"/>
    ${lbl('top_key_3',       cx,          75)}
    ${lbl('left_wing_3',     cL + 36,    200)}
    ${lbl('right_wing_3',    cR - 36,    200)}
    ${lbl('left_corner_3',   cL + 22,    266)}
    ${lbl('right_corner_3',  cR - 22,    266)}
    ${lbl('mid_top',         cx,         168)}
    ${lbl('mid_left_far',    cx - 102,   172)}
    ${lbl('mid_right_far',   cx + 102,   172)}
    ${lbl('mid_left_close',  cx - 68,    268)}
    ${lbl('mid_right_close', cx + 68,    268)}
    ${lbl('restricted_area', cx,         222)}
    ${badge()}
  </svg>`;
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
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.summary)}`;
      main.insertBefore(shotCard, main.querySelector(".chart-grid"));
    }).catch(() => {});
  } catch (e) {
    main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
const NAV_ITEMS = {
  import:  { icon: "📥", label: "Importar" },
  league:  { icon: "🏆", label: "Liga" },
  team:    { icon: "📊", label: "Equipo" },
  compare: { icon: "⚡", label: "Comparar" },
  player:  { icon: "👤", label: "Jugador" },
};

async function boot() {
  document.getElementById("app").innerHTML = `
    <header>
      <span class="header-logo">🏀 CourtIQ</span>
      <span class="header-sub">Basketball Advanced Analytics</span>
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
          </div>
          <div class="filter-pills" id="team-filter-pills" style="display:none;margin-top:12px">
            <span style="color:var(--muted);font-size:12px;align-self:center;margin-right:4px">Período:</span>
            <button class="filter-pill active" data-n="0">Todos</button>
            <button class="filter-pill" data-n="5">Últ. 5</button>
            <button class="filter-pill" data-n="3">Últ. 3</button>
          </div>
        </div>
        <div id="team-main"></div>
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
    </main>`;

  // Nav clicks
  document.querySelectorAll("nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      setSection(btn.dataset.section);
      if (btn.dataset.section === "import")  renderImport();
      if (btn.dataset.section === "league")  renderLeague();
      if (btn.dataset.section === "team")    refreshTeamSelector();
      if (btn.dataset.section === "compare") renderCompare();
    });
  });

  // Team selector
  const teamSel = document.getElementById("team-select");
  teamSel.addEventListener("change", () => {
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  setSection("import");
  renderImport();
}

boot();
