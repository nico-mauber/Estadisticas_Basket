import { api } from "./api.js";
import { drawRadar, drawEvolution, drawPlayerEvolution, drawLeagueScatter } from "./charts.js";

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
const INT  = v => v != null ? Math.round(v) : "—";

function statClass(value, avg, higherIsBetter = true) {
  if (value == null || avg == null) return "neutral";
  return (higherIsBetter ? value >= avg : value <= avg) ? "above-avg" : "below-avg";
}

function statBox(label, value, display, leagueKey, league, higherIsBetter = true) {
  const lg    = league?.[leagueKey];
  const avg   = lg?.avg;
  const best  = lg?.best;
  const cls   = statClass(value, avg, higherIsBetter);
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${cls}">${display}</div>
      <div class="stat-context">
        <span class="avg">Ø ${avg != null ? (leagueKey.includes("pct") || leagueKey.includes("or_") || leagueKey.includes("dr_") || leagueKey.includes("to_") || leagueKey.includes("as_") ? PCT(avg) : DEC2(avg)) : "—"}</span>
        &nbsp;
        <span class="best">↑ ${best != null ? (leagueKey.includes("pct") || leagueKey.includes("or_") || leagueKey.includes("dr_") || leagueKey.includes("to_") || leagueKey.includes("as_") ? PCT(best) : DEC2(best)) : "—"}</span>
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

// ── Nav ────────────────────────────────────────────────────────────────────
const sections = ["import", "league", "team", "player"];
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
  // d is YYYY-MM-DD → DD/MM/YYYY
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function _gamesTable(games, page) {
  if (!games.length) return '<p class="empty">Sin partidos aún.</p>';
  const totalPages = Math.ceil(games.length / PAGE_SIZE);
  const slice = games.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const pagination = totalPages > 1 ? `
    <div style="display:flex;align-items:center;gap:12px;margin-top:12px;justify-content:flex-end">
      <button class="btn btn-ghost" id="pg-prev" ${page === 0 ? "disabled" : ""} style="padding:6px 14px">← Ant.</button>
      <span style="color:var(--muted);font-size:13px">Página ${page + 1} / ${totalPages}</span>
      <button class="btn btn-ghost" id="pg-next" ${page >= totalPages - 1 ? "disabled" : ""} style="padding:6px 14px">Sig. →</button>
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
              <td>${_fmtDate(g.date)}</td>
              <td class="td-team">${g.home_team || "—"}</td>
              <td style="font-weight:600">${g.home_score ?? "—"} – ${g.away_score ?? "—"}</td>
              <td class="td-team">${g.away_team || "—"}</td>
              <td style="color:var(--muted);font-size:12px">${g.competition || "—"}</td>
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
      <p style="color:var(--muted);margin-top:10px;font-size:12px;">
        El sistema captura los datos automáticamente desde la URL.
      </p>
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
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importar";
    }
  });

}

// ── League section ─────────────────────────────────────────────────────────
async function renderLeague() {
  const sec = document.getElementById("sec-league");
  sec.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  try {
    const teams = await api.league();
    if (!teams.length) { sec.innerHTML = '<p class="empty">Sin datos. Importa partidos primero.</p>'; return; }

    sec.innerHTML = `
      <div class="card">
        <div class="card-title">Ranking de equipos — Liga</div>
        <div class="table-wrap">
          <table id="league-table">
            <thead><tr>
              <th>#</th>
              <th>Equipo</th>
              <th title="Partidos">PJ</th>
              <th title="Eficiencia Ofensiva">OER</th>
              <th title="Eficiencia Defensiva">DER</th>
              <th title="Rating Neto">NRtg</th>
              <th title="Effective FG%">eFG%</th>
              <th title="True Shooting%">TS%</th>
              <th title="Rebote Ofensivo%">OR%</th>
              <th title="Rebote Defensivo%">DR%</th>
              <th title="Turnover%">TO%</th>
              <th title="Pace">Pace</th>
              <th title="Puntos por partido">Pts</th>
            </tr></thead>
            <tbody>
              ${teams.map((t, i) => `
                <tr style="cursor:pointer" data-code="${t.team_code}">
                  <td style="color:var(--muted)">${i + 1}</td>
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
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    // Scatter map (only if 2+ teams)
    if (teams.length >= 2) {
      sec.insertAdjacentHTML("beforeend", `
        <div class="card">
          <div class="card-title">Mapa ofensivo / defensivo</div>
          <p style="color:var(--muted);font-size:11px;margin-bottom:12px">
            Derecha = mejor ataque (OER alto) &nbsp;|&nbsp; Abajo = mejor defensa (DER bajo) &nbsp;|&nbsp; Abajo-derecha = elite
          </p>
          <canvas id="chart-scatter" height="320"></canvas>
        </div>`);
      drawLeagueScatter("chart-scatter", teams);
    }

    // Click row → team view
    sec.querySelectorAll("tbody tr").forEach(tr => {
      tr.addEventListener("click", () => {
        document.getElementById("team-select").value = tr.dataset.code;
        setSection("team");
        renderTeam(tr.dataset.code);
      });
    });
  } catch (e) {
    sec.innerHTML = `<p class="empty" style="color:var(--red)">${e.message}</p>`;
  }
}

// ── Team section ───────────────────────────────────────────────────────────
async function renderTeam(teamName) {
  const sec = document.getElementById("sec-team");
  const main = document.getElementById("team-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';

  try {
    const data = await api.team(teamName);
    const av   = data.averages;
    const lg   = data.league;

    main.innerHTML = `
      <div class="card">
        <div class="card-title">Eficiencia</div>
        <div class="stat-grid">
          ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg)}
          ${statBox("DER", av.der, DEC2(av.der), "der", lg, false)}
          ${statBox("Net Rating", av.net_rating, DEC2(av.net_rating), "net_rating", lg)}
          ${statBox("Pace", av.pace, DEC2(av.pace), "pace", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Tiro</div>
        <div class="stat-grid">
          ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg)}
          ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg)}
          ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg)}
          ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Rebotes & Misc</div>
        <div class="stat-grid">
          ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg)}
          ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg)}
          ${statBox("TO%", av.to_pct, PCT(av.to_pct), "to_pct", lg, false)}
          ${statBox("AS%", av.as_pct, PCT(av.as_pct), "as_pct", lg)}
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
              ${data.game_log.map(g => `
                <tr>
                  <td>${g.date || "—"}</td>
                  <td>${g.opponent}</td>
                  <td style="color:var(--muted)">${g.home_away}</td>
                  <td><b>${g.pts}</b></td>
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

    // ── Charts (only render if multiple games for meaningful visuals) ──
    if (data.game_log.length >= 1) {
      // Two-column chart row
      main.insertAdjacentHTML("afterbegin", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card">
            <div class="card-title">Perfil de equipo</div>
            <div style="max-width:380px;margin:0 auto">
              <canvas id="chart-radar"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Evolución por partido</div>
            <canvas id="chart-evo" height="200"></canvas>
          </div>
        </div>`);
      drawRadar("chart-radar", av, lg, data.team_name);
      drawEvolution("chart-evo", data.game_log, lg?.oer?.avg);
    }

    // Populate player selector
    const players = await api.players(teamName);
    const pSel = document.getElementById("player-select");
    pSel.innerHTML = '<option value="">— Seleccionar jugador —</option>' +
      players.map(p => `<option value="${p}">${p}</option>`).join("");
  } catch (e) {
    main.innerHTML = `<p class="empty" style="color:var(--red)">${e.message}</p>`;
  }
}

// ── Player section ─────────────────────────────────────────────────────────
async function renderPlayer(teamName, playerName) {
  const sec = document.getElementById("sec-player");
  const main = document.getElementById("player-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';

  try {
    const data = await api.player(teamName, playerName);
    const av   = data.averages;
    const lg   = data.league;

    main.innerHTML = `
      <div class="card">
        <div class="card-title">Producción ofensiva</div>
        <div class="stat-grid">
          ${statBox("OER", av.oer, DEC2(av.oer), "oer", lg)}
          ${statBox("eFG%", av.efg_pct, PCT(av.efg_pct), "efg_pct", lg)}
          ${statBox("TS%", av.ts_pct, PCT(av.ts_pct), "ts_pct", lg)}
          ${statBox("FG2%", av.fg2_pct, PCT(av.fg2_pct), "fg2_pct", lg)}
          ${statBox("FG3%", av.fg3_pct, PCT(av.fg3_pct), "fg3_pct", lg)}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Rebotes & distribución</div>
        <div class="stat-grid">
          ${statBox("OR%", av.or_pct, PCT(av.or_pct), "or_pct", lg)}
          ${statBox("DR%", av.dr_pct, PCT(av.dr_pct), "dr_pct", lg)}
          ${statBox("TO%", av.to_pct, PCT(av.to_pct), "to_pct", lg, false)}
          ${statBox("AS%", av.as_pct, PCT(av.as_pct), "as_pct", lg)}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="card-title">Perfil de jugador</div>
          <div style="max-width:380px;margin:0 auto">
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
                  <td>${g.date || "—"}</td>
                  <td>${g.opponent}</td>
                  <td><b>${g.pts}</b></td>
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
  } catch (e) {
    main.innerHTML = `<p class="empty" style="color:var(--red)">${e.message}</p>`;
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function boot() {
  // Build shell
  document.getElementById("app").innerHTML = `
    <header>
      <h1>🏀 CourtIQ</h1>
      <span>Basketball Advanced Analytics</span>
    </header>
    <nav>
      ${sections.map(s => `<button data-section="${s}">${
        { import: "Importar", league: "Liga", team: "Equipo", player: "Jugador" }[s]
      }</button>`).join("")}
    </nav>
    <main>
      <!-- Import -->
      <div class="section" id="sec-import"></div>

      <!-- League -->
      <div class="section" id="sec-league"></div>

      <!-- Team -->
      <div class="section" id="sec-team">
        <div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <select id="team-select"><option value="">— Seleccionar equipo —</option></select>
          <select id="player-select"><option value="">— Seleccionar jugador —</option></select>
          <button class="btn btn-ghost" id="btn-show-player">Ver jugador</button>
        </div>
        <div id="team-main"></div>
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
    });
  });

  // Team selector — value = team_code, display = team_name
  const teamSel = document.getElementById("team-select");
  teamSel.addEventListener("change", () => {
    if (teamSel.value) renderTeam(teamSel.value);
  });

  document.getElementById("btn-show-player").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = document.getElementById("player-select").value;
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    setSection("player");
    renderPlayer(team, player);
  });

  // Pagination for import section — registered once here
  document.getElementById("sec-import").addEventListener("click", async e => {
    if (e.target.id === "pg-prev" && importPage > 0) importPage--;
    else if (e.target.id === "pg-next") importPage++;
    else return;
    const games = await api.games().catch(() => []);
    document.getElementById("games-table").innerHTML = _gamesTable(games, importPage);
  });

  // PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  setSection("import");
  renderImport();
}

boot();
