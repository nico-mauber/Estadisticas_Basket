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
let importPage = 0;

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

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Fecha</th><th>Local</th><th>Result.</th><th>Visitante</th><th>Competencia</th>
        </tr></thead>
        <tbody>
          ${slice.map(g => `
            <tr>
              <td class="td-muted">${_fmtDate(g.date)}</td>
              <td class="td-team">${g.home_team || "—"}</td>
              <td class="td-result">${g.home_score ?? "—"} – ${g.away_score ?? "—"}</td>
              <td class="td-team">${g.away_team || "—"}</td>
              <td class="td-comp">${g.competition || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    ${pagination}`;
}

async function renderImport(allGames) {
  const games = allGames || await api.games().catch(() => []);
  const sec   = document.getElementById("sec-import");

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
      <div class="card-title">Partidos importados (${games.length})</div>
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
        ${statBox("PPS", av.pps, DEC2(av.pps), "pps", lg)}
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
        ${statBox("TO%", av.to_pct, PCT(av.to_pct), "to_pct", lg, false)}
        ${statBox("AS%", av.as_pct, PCT(av.as_pct), "as_pct", lg)}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Defensa avanzada</div>
      <div class="stat-grid">
        ${statBox("Robos", av.stl, DEC2(av.stl), "stl", lg)}
        ${statBox("Tapones", av.blk, DEC2(av.blk), "blk", lg)}
        ${statBox("Stocks", av.stocks, DEC2(av.stocks), "stocks", lg)}
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
      players.map(p => `<option value="${p}">${p}</option>`).join("");
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

// ── Shot chart SVG — half court, 4 zones with corner_3, delta vs league ──────
function _shotChartSVG(zones, totalShots, leagueZones) {
  const W = 340, H = 350;  // extra 40px at bottom for corner_3 stats bar
  const muted = "#6b7280", txt = "#e2e8f0", line = "#374151";

  // Court geometry (basket at bottom-center, shooting UP)
  const cx = 170, cy = 256;
  const cL = 20, cR = 320, cT = 8, cB = 288;

  // Zone radii (FIBA proportions at ~20px/m: 6.75m arc, 2.5m paint)
  const rP = 50;
  const r3 = 135;

  function zColor(z, key) {
    if (!z?.attempts) return "#141f2e";
    const la = leagueZones?.[key]?.pct;
    if (la == null) {
      const p = z.pct;
      if (p >= 0.58) return "rgba(22,163,74,0.72)";
      if (p >= 0.44) return "rgba(101,163,13,0.60)";
      if (p >= 0.32) return "rgba(75,85,99,0.50)";
      return "rgba(220,38,38,0.68)";
    }
    const d = (z.pct - la) * 100;
    if (d >= 9)  return "rgba(22,163,74,0.80)";
    if (d >= 3)  return "rgba(101,163,13,0.68)";
    if (d >= -3) return "rgba(75,85,99,0.50)";
    if (d >= -9) return "rgba(234,88,12,0.68)";
    return "rgba(220,38,38,0.78)";
  }

  const hCirc = r => `M${cx-r},${cy} A${r},${r} 0 0,0 ${cx+r},${cy} Z`;
  const hRing = (r1, r2) =>
    `M${cx-r2},${cy} A${r2},${r2} 0 0,0 ${cx+r2},${cy} L${cx+r1},${cy} A${r1},${r1} 0 0,1 ${cx-r1},${cy} Z`;

  const paint    = zones.paint         || {attempts:0, pct:null};
  const mid      = zones.mid_range     || {attempts:0, pct:null};
  const abBreak  = zones.above_break_3 || {attempts:0, pct:null};
  const corner3  = zones.corner_3      || {attempts:0, pct:null};

  function zlabel(z, x, y, key, title) {
    const la = leagueZones?.[key];
    if (!z?.attempts) return `
      <text x="${x}" y="${y-10}" text-anchor="middle" fill="${muted}" font-size="9" font-weight="700" letter-spacing="0.5" font-family="Inter,sans-serif">${title}</text>
      <text x="${x}" y="${y+8}"  text-anchor="middle" fill="${muted}" font-size="14" font-family="Inter,sans-serif">—</text>`;
    const pct = (z.pct*100).toFixed(0)+"%";
    const d   = la?.pct != null ? (z.pct - la.pct)*100 : null;
    const ds  = d != null ? (d>=0?'+':'')+d.toFixed(0)+'pp' : null;
    const dc  = d == null ? muted : d >= 3 ? '#4ade80' : d <= -3 ? '#f87171' : '#9ca3af';
    const lap = la?.pct != null ? `Ø ${(la.pct*100).toFixed(0)}%` : '';
    return `
      <text x="${x}" y="${y-18}" text-anchor="middle" fill="${muted}" font-size="9" font-weight="700" letter-spacing="0.5" font-family="Inter,sans-serif">${title}</text>
      <text x="${x}" y="${y-2}"  text-anchor="middle" fill="${txt}"   font-size="16" font-weight="800" font-family="Inter,sans-serif">${z.made}/${z.attempts}</text>
      <text x="${x}" y="${y+14}" text-anchor="middle" fill="${txt}"   font-size="13" font-family="Inter,sans-serif">${pct}</text>
      ${ds  ? `<text x="${x}" y="${y+27}" text-anchor="middle" fill="${dc}"   font-size="10" font-family="Inter,sans-serif">${ds} vs liga</text>` : ''}
      ${lap ? `<text x="${x}" y="${y+39}" text-anchor="middle" fill="${muted}" font-size="9"  font-family="Inter,sans-serif">${lap}</text>` : ''}`;
  }

  // Corner_3 stats bar (rendered below court, y=296 to y=340)
  function cornerBar(z, key) {
    const barY = cB + 12;
    const la = leagueZones?.[key];
    if (!z?.attempts) return `
      <text x="${W/2}" y="${barY+2}" text-anchor="middle" fill="${muted}" font-size="9" font-weight="700" letter-spacing="0.5" font-family="Inter,sans-serif">ESQUINA 3</text>
      <text x="${W/2}" y="${barY+16}" text-anchor="middle" fill="${muted}" font-size="12" font-family="Inter,sans-serif">Sin datos</text>`;
    const pct = (z.pct*100).toFixed(0)+"%";
    const d   = la?.pct != null ? (z.pct - la.pct)*100 : null;
    const ds  = d != null ? (d>=0?'+':'')+d.toFixed(0)+'pp' : null;
    const dc  = d == null ? muted : d >= 3 ? '#4ade80' : d <= -3 ? '#f87171' : '#9ca3af';
    const lap = la?.pct != null ? `Ø ${(la.pct*100).toFixed(0)}%` : '';
    const fill = zColor(z, key);
    return `
      <rect x="${cL}" y="${barY-4}" width="${cR-cL}" height="44" fill="${fill}" rx="4" opacity="0.85"/>
      <text x="${W/2}" y="${barY+8}" text-anchor="middle" fill="${muted}" font-size="9" font-weight="700" letter-spacing="0.5" font-family="Inter,sans-serif">ESQUINA 3 (CORNER)</text>
      <text x="${W/2-60}" y="${barY+24}" text-anchor="middle" fill="${txt}" font-size="14" font-weight="800" font-family="Inter,sans-serif">${z.made}/${z.attempts}</text>
      <text x="${W/2}" y="${barY+24}" text-anchor="middle" fill="${txt}" font-size="14" font-family="Inter,sans-serif">${pct}</text>
      ${ds  ? `<text x="${W/2+55}" y="${barY+24}" text-anchor="middle" fill="${dc}" font-size="11" font-family="Inter,sans-serif">${ds}</text>` : ''}
      ${lap ? `<text x="${W/2}" y="${barY+36}" text-anchor="middle" fill="${muted}" font-size="9" font-family="Inter,sans-serif">${lap}</text>` : ''}`;
  }

  const pbX1 = cx-49, pbX2 = cx+49, pbTop = cy-116;

  const SCALE = [
    [-9,'rgba(220,38,38,0.78)'], [-3,'rgba(234,88,12,0.68)'],
    [0,'rgba(75,85,99,0.50)'],   [3,'rgba(101,163,13,0.68)'],
    [9,'rgba(22,163,74,0.80)'],
  ];

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
    style="width:100%;max-width:420px;margin:0 auto;display:block;border-radius:8px">
    <defs>
      <clipPath id="sc-clip">
        <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}"/>
      </clipPath>
    </defs>

    <!-- Background -->
    <rect width="${W}" height="${H}" fill="#0d1117" rx="8"/>
    <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="#111827" rx="3"/>

    <!-- ZONE FILLS (back to front) -->
    <!-- Above-break 3: fills entire court (others paint over it) -->
    <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="${zColor(abBreak,'above_break_3')}" clip-path="url(#sc-clip)" rx="3"/>

    <!-- Corner 3: thin strips at each corner (below basket level, outside r3 from center) -->
    <rect x="${cL}"    y="${cy}" width="${cx-r3-cL}" height="${cB-cy}" fill="${zColor(corner3,'corner_3')}" clip-path="url(#sc-clip)"/>
    <rect x="${cx+r3}" y="${cy}" width="${cR-cx-r3}" height="${cB-cy}" fill="${zColor(corner3,'corner_3')}" clip-path="url(#sc-clip)"/>

    <!-- Mid-range: half-ring above basket level + long-2 strip below arc -->
    <path d="${hRing(rP, r3)}" fill="${zColor(mid,'mid_range')}" clip-path="url(#sc-clip)"/>
    <rect x="${cx-r3}" y="${cy}" width="${r3*2}" height="${cB-cy}" fill="${zColor(mid,'mid_range')}" clip-path="url(#sc-clip)"/>

    <!-- Paint: half-circle + close rect below basket level -->
    <path d="${hCirc(rP)}" fill="${zColor(paint,'paint')}" clip-path="url(#sc-clip)"/>
    <rect x="${cx-rP}" y="${cy}" width="${rP*2}" height="${cB-cy}" fill="${zColor(paint,'paint')}" clip-path="url(#sc-clip)"/>

    <!-- COURT LINES -->
    <rect x="${cL}" y="${cT}" width="${cR-cL}" height="${cB-cT}" fill="none" stroke="${line}" stroke-width="1.5" rx="3"/>
    <rect x="${pbX1}" y="${pbTop}" width="${pbX2-pbX1}" height="${cB-pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <path d="M${pbX1},${pbTop} A49,49 0 0,0 ${pbX2},${pbTop}" fill="none" stroke="#4b5563" stroke-width="1.5" stroke-dasharray="4,3"/>
    <path d="M${cx-r3},${cy} A${r3},${r3} 0 0,0 ${cx+r3},${cy}" fill="none" stroke="#4b5563" stroke-width="1.5"/>
    <line x1="${cx-r3}" y1="${cy}" x2="${cx-r3}" y2="${cB}" stroke="#4b5563" stroke-width="1.5"/>
    <line x1="${cx+r3}" y1="${cy}" x2="${cx+r3}" y2="${cB}" stroke="#4b5563" stroke-width="1.5"/>
    <path d="M${cx-rP},${cy} A${rP},${rP} 0 0,0 ${cx+rP},${cy}" fill="none" stroke="#4b5563" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
    <circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#9ca3af" stroke-width="2"/>
    <line x1="${cx-26}" y1="${cB-3}" x2="${cx+26}" y2="${cB-3}" stroke="#9ca3af" stroke-width="3"/>

    <!-- ZONE LABELS (paint, mid, above-break) -->
    ${zlabel(paint,   cx, cy-18,  'paint',         'PINTURA')}
    ${zlabel(mid,     cx, cy-92,  'mid_range',      'MID-RANGE')}
    ${zlabel(abBreak, cx, cy-195, 'above_break_3',  'ARCO 3P')}

    <!-- CORNER_3 STATS BAR (below court) -->
    ${cornerBar(corner3, 'corner_3')}

    <!-- COLOR SCALE -->
    <text x="6" y="${H-11}" fill="${muted}" font-size="8" font-weight="600" font-family="Inter,sans-serif">FG% vs liga:</text>
    ${SCALE.map(([v,c],i) => `
      <rect x="${62+i*46}" y="${H-22}" width="42" height="13" fill="${c}" rx="2"/>
      <text x="${62+i*46+21}" y="${H-12}" text-anchor="middle" fill="${txt}" font-size="8" font-family="Inter,sans-serif">${v>0?'+':''}${v}pp</text>
    `).join('')}
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
          ${statBox("PPP", av.ppp, DEC2(av.ppp), "ppp", lg)}
          ${statBox("PPS", av.pps, DEC2(av.pps), "pps", lg)}
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
          ${statBox("TO%", av.to_pct, PCT(av.to_pct), "to_pct", lg, false)}
          ${statBox("AS%", av.as_pct, PCT(av.as_pct), "as_pct", lg)}
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
          ${statBox("Stocks", av.stocks, DEC2(av.stocks), "stocks", lg)}
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
        ${_shotChartSVG(shots.zones, shots.total_shots, shots.league_zones)}`;
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

  // Import section pagination
  document.getElementById("sec-import").addEventListener("click", async e => {
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
