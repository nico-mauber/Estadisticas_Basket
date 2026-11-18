
import { api, setUnauthorizedHandler } from "./api.js";
import { applyChartLocale } from "./charts.js";
import { lineupsFromUrl } from "./components/compare-lineups.js";
import { comparePlayersFromUrl } from "./components/compare-players.js";
import { chooseLanguage, mountLanguageSelector } from "./components/language-selector.js";
import { destroyLiveView } from "./components/live-view.js";
import { renderPrepare } from "./components/prepare-report.js";
import { applyTabs, renderTabs, watchTabs } from "./components/tabs.js";
import { initBase } from "./core/base.js";
import { loadPopulationMinSize } from "./core/catalog.js";
import { initContext } from "./core/context.js";
import { deviceLanguage, initI18n, isLanguage, onLanguageChange } from "./core/i18n.js";
import { getPref, loadPrefs } from "./core/prefs.js";
import { markRouteKey, onRouteChange, parseRoute, routeKey, routeQuery, writeRoute } from "./core/router.js";
import { S } from "./state.js";
import { _initCompareTabs, renderCompare } from "./views/compare.js";
import { renderConfig } from "./views/config.js";
import { IMPORT_TABS, renderImport } from "./views/datos.js";
import { _renderLeagueExtras, renderLeague } from "./views/league.js";
import { _renderEvents, _renderTrends, renderMyTeamView, showGame } from "./views/panels.js";
import { _renderImpactTab, _renderSimilar, renderPlayer } from "./views/player.js";
import { SEARCH_TABS, _searchParamsFromUrl, _searchUrlQuery, renderSearch } from "./views/search.js";
import { _rememberCompetition, refreshTeamSelector, toast } from "./views/shared.js";
import { _reloadTeam, _renderSynergy, _renderVersus, _selectedPlayer, renderTeam, renderTeamLineup, renderTeamOnOff, renderTeamShotmap } from "./views/team.js";

// ── Nav ────────────────────────────────────────────────────────────────────
export const sections = ["myteam", "import", "league", "team", "compare", "player", "search", "preparar", "partido", "config"];
// `sync: false` en los flujos que abren una entidad (equipo, jugador, partido): la dirección se escribe cuando llegan los datos.
export function setSection(id, { sync = true } = {}) {
  if (S.activeSection !== "config") S._lastSection = S.activeSection;
  if (id !== "partido") destroyLiveView();
  S.activeSection = id;
  S._navCount++;
  document.querySelectorAll("nav button, .nav-sheet button").forEach(b => b.classList.toggle("active", b.dataset.section === id));
  document.querySelectorAll(".section").forEach(s => s.style.display = s.id === `sec-${id}` ? "" : "none");
  _closeNavSheet();
  if (sync) syncRoute();
}
// Abre una sección desde la barra de navegación.
export function goSection(id) {
  setSection(id, { sync: !["team", "player"].includes(id) });
  if (id === "myteam")  renderMyTeamView();
  if (id === "import")  renderImport();
  if (id === "league")  renderLeague();
  if (id === "team")    { refreshTeamSelector(); syncRoute(); }
  if (id === "player")  syncRoute();
  if (id === "compare") renderCompare();
  if (id === "search")  renderSearch();
  if (id === "preparar") renderPrepare(document.getElementById("preparar-main"), { onOpenGame: showGame });
  if (id === "config")  renderConfig();
}
export function _closeNavSheet() { document.getElementById("nav-sheet")?.setAttribute("hidden", ""); }
// ── Pestañas de sección y direcciones (X-01) ─────────────────────────────────
export const TAB_DEFS = {
  team: [["resumen", "Resumen"], ["plantel", "Plantel"], ["tiro", "Tiro"], ["posesion", "Posesión"], ["eventos", "Eventos"], ["quintetos", "Quintetos"],
         ["momentos", "Momentos"], ["enfrentamiento", "Enfrentamiento"], ["gamelog", "Game log"]],
  player: [["resumen", "Resumen"], ["tiro", "Tiro"], ["posesion", "Posesión"], ["eventos", "Eventos"], ["impacto", "Impacto"], ["tendencias", "Tendencias"], ["similares", "Similares"], ["gamelog", "Game log"]],
  league: [["tabla", "Tabla"], ["ranking", "Ranking"], ["lideres", "Líderes"], ["perfil", "Perfil"], ["mapa", "Mapa"]],
};
export const TAB_DEFAULT = { team: "resumen", player: "resumen", league: "tabla" };
export const _tab = { ...TAB_DEFAULT };
export const _validTab = (section, tab) => (TAB_DEFS[section] || []).some(([id]) => id === tab);
export function _drawTabs(section) {
  renderTabs(document.getElementById(`${section}-tabs`), TAB_DEFS[section], _tab[section], t => setTab(section, t));
}
export function setTab(section, tab, { sync = true } = {}) {
  if (!_validTab(section, tab)) return;
  _tab[section] = tab;
  _drawTabs(section);
  applyTabs(document.getElementById(`sec-${section}`), tab);
  if (section === "team" && tab === "enfrentamiento") _renderVersus();
  if (section === "league") _renderLeagueExtras();
  if (section === "player" && tab === "similares") _renderSimilar();
  if (tab === "eventos" && (section === "team" || section === "player")) _renderEvents(section);
  if (section === "team" && tab === "quintetos") _renderSynergy();
  if (section === "player" && tab === "impacto") _renderImpactTab();
  if ((section === "team" && tab === "gamelog") || (section === "player" && tab === "tendencias")) _renderTrends(section);
  window.dispatchEvent(new Event("resize"));   // los gráficos de la pestaña recalculan su ancho
  if (sync) syncRoute();
}
export const _cmpTab = () => document.querySelector(".cmp-tab.active")?.dataset.cmp || "equipos";
// La vista actual como ruta: sección, entidad y pestaña.
export function currentRoute() {
  const section = S.activeSection;
  const r = { section, id: null, tab: null };
  if (section === "team")    { r.id = S._teamData?.team_code ?? null; r.tab = _tab.team; }
  else if (section === "player") { r.id = S._playerData?.player_id ?? null; r.tab = _tab.player; }
  else if (section === "league") r.tab = _tab.league;
  else if (section === "import") r.tab = S._importTab;
  else if (section === "compare") r.tab = _cmpTab();
  else if (section === "search") r.tab = S._searchTab;
  else if (section === "partido") { r.id = S._gameId; r.tab = S._gameId ? (S._gameTab || "analizar") : null; }
  else if (section === "config") r.tab = S._configTab;
  return r;
}
// Escribe la dirección de la vista actual (un paso del historial si cambió la sección, la entidad o la pestaña).
export function syncRoute() {
  if (S._routing) return;
  const r = currentRoute();
  const query = r.section === "team" ? { competition: S._teamComp, last: S._teamLastN, rival: _tab.team === "enfrentamiento" ? S._versusRival : null }
    : r.section === "player" ? { competition: S._playerComp, last: S._playerLastN }
    : r.section === "league" ? { competition: S._leagueComp, last: null, metric: _tab.league === "lideres" ? S._leaders.metric : null,
        min_minutes: _tab.league === "lideres" ? S._leaders.min : null }
    : r.section === "search" ? {}
    : { competition: null, last: null };
  // El cruce de Preparar (team, rival, fixture) viaja solo en su dirección (F-12).
  const clear = r.section === "preparar" ? {} : { team: null, fixture: null, ...(r.section === "team" ? {} : { rival: null }) };
  writeRoute(r, { ...clear, ..._searchUrlQuery(r.section), ...query });
}
export const _notice = msg => toast(msg, "err");
// Reconstruye la vista de la dirección abierta. `false` si no hay dirección válida (el llamador abre la sección inicial).
export async function applyRoute({ initial = false } = {}) {
  const p = parseRoute();
  if (!p) return false;
  if (p.invalid) { _notice("Esa sección no existe o todavía no está disponible."); return false; }
  const cur = currentRoute();
  if (!initial && !p.legacy && routeKey({ section: p.section, id: p.id, tab: p.tab }) === routeKey(cur)) return true;
  const q = routeQuery();
  if (p.legacy) {   // #search → #/explorar/jugadores: la dirección nueva se escribe ya, sin esperar a los datos
    const tab = { import: "importar", league: "tabla", compare: "equipos", search: "jugadores" }[p.section] || null;
    markRouteKey(routeKey({ section: p.section, id: null, tab }));
    writeRoute({ section: p.section, id: null, tab }, {});
  }
  S._routing = true;
  try {
    switch (p.section) {
      case "import": {
        const t = IMPORT_TABS.some(([id]) => id === p.tab) ? p.tab : "importar";
        if (p.tab && t !== p.tab) _notice("Esa pestaña todavía no está disponible.");
        S._importTab = t;
        setSection("import", { sync: false });
        renderImport();
        break;
      }
      case "league": {
        let t = _validTab("league", p.tab) ? p.tab : "tabla";
        if (p.tab && t !== p.tab) _notice("Esa pestaña todavía no está disponible.");
        if (S.activeSection === "league" && document.getElementById("league-tabs") && (!q.competition || q.competition === S._leagueComp)) {
          S._leaders = { metric: q.metric || "", min: q.min_minutes ?? "" };
          setTab("league", t, { sync: false });
        } else {
          if (q.competition) S._leagueComp = q.competition;
          _tab.league = t;
          S._leaders = { metric: q.metric || "", min: q.min_minutes ?? "" };
          setSection("league", { sync: false });
          await renderLeague();
        }
        break;
      }
      case "team": {
        setSection("team", { sync: false });
        await refreshTeamSelector();
        if (!p.id) break;
        const code = String(p.id).toUpperCase();
        const sel = document.getElementById("team-select");
        if (![...sel.options].some(o => o.value === code)) { _notice("No encontramos ese equipo."); break; }
        let t = p.tab;
        if (t && !_validTab("team", t)) { _notice("Esa pestaña todavía no está disponible."); t = null; }
        _tab.team = t || "resumen";
        const same = S._teamData?.team_code === code && (!q.competition || q.competition === S._teamComp) && Number(q.last || 0) === S._teamLastN;
        if (same) { if (q.rival) S._versusRival = q.rival.toUpperCase(); setTab("team", _tab.team, { sync: false }); break; }
        sel.value = code;
        S._routeQuery = q;
        await renderTeam(code);
        break;
      }
      case "player": {
        setSection("player", { sync: false });
        if (!p.id) break;
        let t = p.tab;
        if (t && !_validTab("player", t)) { _notice("Esa pestaña todavía no está disponible."); t = null; }
        _tab.player = t || "resumen";
        const same = String(S._playerData?.player_id) === String(p.id) && (!q.competition || q.competition === S._playerComp) && Number(q.last || 0) === S._playerLastN;
        if (same) { setTab("player", _tab.player, { sync: false }); break; }
        S._routeQuery = q;
        const ok = /^\d+$/.test(p.id) ? await renderPlayer(null, null, Number(p.id)) : false;
        if (!ok) _notice("No encontramos ese jugador.");
        break;
      }
      case "compare":
        setSection("compare", { sync: false });
        await renderCompare();
        if (p.tab === "equipos" || p.tab === "jugadores" || p.tab === "quintetos") _initCompareTabs(p.tab);
        break;
      case "search": {
        const t = SEARCH_TABS.some(([id]) => id === p.tab) ? p.tab : "jugadores";
        if (p.tab && t !== p.tab) _notice("Esa pestaña todavía no está disponible.");
        S._searchTab = t;
        const fromUrl = _searchParamsFromUrl();
        if (t === "quintetos" && Object.keys(fromUrl).length) S._searchInit = fromUrl;
        if (t === "contextos" && !fromUrl.team && (fromUrl.competition || fromUrl.last)) S._cross = { ...S._cross, competition: fromUrl.competition || "", last: fromUrl.last || "" };
        if (t === "similares" && fromUrl.player) S._simX = { ...S._simX, team: (fromUrl.team || "").toUpperCase(), player: fromUrl.player };
        if (t === "contextos" && fromUrl.team) S._cross = { team: fromUrl.team.toUpperCase(), side: fromUrl.side || "ataque", dimX: fromUrl.dim_x || "tramo", dimY: fromUrl.dim_y || "origen",
                                                          metric: fromUrl.metric || "ppp", limit: Number(fromUrl.limit) || 8, color: fromUrl.color || "", competition: fromUrl.competition || "", last: fromUrl.last || "" };
        setSection("search", { sync: false });
        await renderSearch();
        break;
      }
      case "preparar":
        setSection("preparar", { sync: false });
        renderPrepare(document.getElementById("preparar-main"), { onOpenGame: showGame,
          team: q.team ? q.team.toUpperCase() : null, rival: q.rival ? q.rival.toUpperCase() : null });
        break;
      case "myteam":
        setSection("myteam", { sync: false });
        renderMyTeamView();
        break;
      case "partido":
        if (p.id && /^\d+$/.test(p.id)) showGame(p.id, p.tab); else setSection("partido", { sync: false });
        break;
      case "config":
        S._configTab = p.tab || null;   // `#/configuracion/<módulo>` (X-01 CA-15)
        setSection("config", { sync: false });
        renderConfig();
        break;
    }
  } finally {
    S._routing = false;
    markRouteKey(routeKey(currentRoute()));   // normaliza la dirección (pestaña por defecto, filtros) sin sumar un paso
    syncRoute();
  }
  return true;
}
// Sin dirección: Mi equipo si el usuario fijó su equipo (F-12); si no, Datos si la base no tiene partidos y Liga › Tabla
// si tiene (X-01 RF-16).
export async function openInitialSection() {
  const seen = S._navCount;
  await loadPrefs("ui");
  if (seen !== S._navCount) return;
  if (getPref("ui", "home_team", null)) { goSection("myteam"); return; }
  let n = 0;
  try { n = (await api.games()).length; } catch { /* sin conexión: queda Datos */ }
  if (seen !== S._navCount) return;   // el usuario ya eligió una sección mientras se consultaban los partidos
  if (n > 0) goSection("league"); else goSection("import");
}
// ── Bootstrap ──────────────────────────────────────────────────────────────
export const NAV_ITEMS = {
  myteam:  { icon: "⭐", label: "Mi equipo" },
  import:  { icon: "📥", label: "Datos" },
  league:  { icon: "🏆", label: "Liga" },
  team:    { icon: "📊", label: "Equipo" },
  compare: { icon: "⚡", label: "Comparar" },
  player:  { icon: "👤", label: "Jugador" },
  search:  { icon: "🔎", label: "Explorar" },
  preparar: { icon: "📋", label: "Preparar" },
  partido: { icon: "🏀", label: "Partido" },
  config:  { icon: "⚙", label: "Configuración" },
};
// En pantallas chicas la barra muestra las cuatro secciones principales y "Más" abre el resto (X-01 RF-11).
// Mi equipo (F-12) va primera; en el teléfono Comparar pasa a "Más" para dejar lugar.
export const NAV_ORDER = ["myteam", "import", "league", "team", "player", "compare", "search", "preparar"];
export const NAV_EXTRA = ["import", "compare", "search", "preparar"];
export function renderApp() {
  loadPopulationMinSize();   // para el copy "la población tiene menos de N entidades" (T-01)
  initBase();                // base de normalización de la sesión (T-04)
  initContext();             // filtros de sede / rival / descanso (T-03)
  document.getElementById("app").innerHTML = `
    <header>
      <span class="header-logo">🏀 Smart-Basket</span>
      <span class="header-sub">Basketball Advanced Analytics</span>
      <span class="lang-slot" id="lang-slot"></span>
      <button class="header-gear" id="btn-config" aria-label="Configuración" title="Configuración">⚙</button>
      ${S._authRequired ? `<span class="header-user">${S._authUser || ""} · <button class="header-logout" id="btn-logout">Salir</button></span>` : ""}
    </header>
    <nav>
      ${NAV_ORDER.map(s => `
        <button data-section="${s}"${NAV_EXTRA.includes(s) ? ' class="nav-extra"' : ""}>
          <span class="nav-icon">${NAV_ITEMS[s].icon}</span>
          ${NAV_ITEMS[s].label}
        </button>`).join("")}
      <button type="button" class="nav-more" id="btn-nav-more" aria-haspopup="true" aria-expanded="false">
        <span class="nav-icon">⋯</span>Más
      </button>
    </nav>
    <div class="nav-sheet" id="nav-sheet" hidden>
      ${[...NAV_EXTRA, "config"].map(s => `<button type="button" data-section="${s}"><span class="nav-icon">${NAV_ITEMS[s].icon}</span>${NAV_ITEMS[s].label}</button>`).join("")}
    </div>
    <main>
      <!-- Mi equipo (F-12) -->
      <div class="section" id="sec-myteam"><div id="myteam-main"></div></div>
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
            <span id="team-home-btn"></span>
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
        <div id="team-ctx-header" class="chdr-host"></div>
        <div id="team-tabs" class="tabs-host" hidden></div>
        <div id="team-shotmap" data-tabs="tiro"></div>
        <p class="td-muted" data-tabs="tiro" id="team-tiro-hint">Elegí un jugador arriba y tocá “Ver mapa de tiro”. El mapa de tiro del equipo está en Resumen.</p>
        <div id="team-onoff" data-tabs="quintetos"></div>
        <div class="card" id="team-lineup-card" data-tabs="quintetos" style="display:none">
          <div class="card-title">Combinaciones (Lineups)</div>
          <p class="td-muted">Elegí entre 3 y 5 jugadores para ver el rendimiento del equipo cuando comparten cancha.</p>
          <div class="lineup-picker" id="team-lineup-picker"></div>
          <button class="btn btn-ghost" id="btn-analyze-lineup" style="margin-top:12px">Analizar combinación</button>
        </div>
        <div id="team-lineup" data-tabs="quintetos"></div>
        <div id="team-gameplan" data-tabs="resumen"></div>
        <div id="team-main" data-tabs="resumen gamelog"></div>
        <div id="team-a10" data-tabs="resumen"></div>
        <div id="team-insights" data-tabs="resumen"></div>
        <div id="team-roster" data-tabs="plantel"></div>
        <div id="team-lineups-block" data-tabs="quintetos"></div>
        <div id="team-ai" data-tabs="quintetos"></div>
        <div id="team-periods" data-tabs="momentos"></div>
        <div id="team-origins" data-tabs="posesion"></div>
        <div id="team-transition" data-tabs="posesion"></div>
        <div id="team-second-chance" data-tabs="posesion"></div>
        <div id="team-clock" data-tabs="posesion"></div>
        <div id="team-clutch" data-tabs="momentos"></div>
        <div id="team-versus" data-tabs="enfrentamiento"></div>
        <div id="team-trends" data-tabs="gamelog"></div>
        <div id="team-events" data-tabs="eventos"></div>
        <div id="team-synergy" data-tabs="quintetos"></div>
      </div>

      <!-- Compare -->
      <div class="section" id="sec-compare">
        <div class="cmp-tabs">
          <button class="filter-pill cmp-tab active" data-cmp="equipos">Equipos</button>
          <button class="filter-pill cmp-tab" data-cmp="jugadores">Jugadores</button>
          <button class="filter-pill cmp-tab" data-cmp="quintetos">Quintetos</button>
        </div>
        <div id="cmp-ctx-bar" class="ctx-bar-host"></div>
        <div id="cmp-pane-equipos">
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
        <div id="cmp-pane-jugadores" style="display:none"></div>
        <div id="cmp-pane-quintetos" style="display:none"></div>
      </div>

      <!-- Player -->
      <div class="section" id="sec-player">
        <div id="player-ctx-header" class="chdr-host"></div>
        <div id="player-tabs" class="tabs-host" hidden></div>
        <div id="player-insights" data-tabs="resumen"></div>
        <div id="player-similar" data-tabs="similares"></div>
        <div id="player-trends" data-tabs="tendencias"></div>
        <div id="player-events" data-tabs="eventos"></div>
        <div id="player-rapm" data-tabs="impacto"></div>
        <div id="player-impact" data-tabs="impacto"></div>
        <div id="player-main"><p class="empty">Selecciona un jugador desde la vista de equipo.</p></div>
      </div>

      <!-- Search -->
      <div class="section" id="sec-search">
        <div id="search-tabs" class="tabs-host"></div>
        <div id="search-ctx-bar" class="ctx-bar-host"></div>
        <div id="search-main"><p class="empty"><span class="spinner"></span>Cargando buscador...</p></div>
      </div>

      <!-- Preparar partido (F-03) -->
      <div class="section" id="sec-preparar">
        <div id="preparar-main"></div>
      </div>

      <!-- Partido (F-07) -->
      <div class="section" id="sec-partido">
        <div id="partido-main"><p class="empty">Selecciona un partido desde el catálogo.</p></div>
      </div>

      <!-- Config (F-13) -->
      <div class="section" id="sec-config"></div>
    </main>`;

  // Nav clicks
  document.querySelectorAll("nav button[data-section], .nav-sheet button").forEach(btn => {
    btn.addEventListener("click", () => goSection(btn.dataset.section));
  });
  const moreBtn = document.getElementById("btn-nav-more");
  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    const sheet = document.getElementById("nav-sheet");
    sheet.hidden = !sheet.hidden;
    moreBtn.setAttribute("aria-expanded", String(!sheet.hidden));
  });
  document.addEventListener("click", e => { if (!e.target.closest("#nav-sheet, #btn-nav-more")) _closeNavSheet(); });
  watchTabs(document.getElementById("sec-team"), () => _tab.team);
  watchTabs(document.getElementById("sec-player"), () => _tab.player);
  watchTabs(document.getElementById("sec-league"), () => _tab.league);

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
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    _tab.player = "resumen";
    setSection("player", { sync: false });
    renderPlayer(team, player.name, player.id);
  });

  // Shot map button — muestra el mapa de tiro DENTRO de Equipo
  document.getElementById("btn-show-shotmap").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    setTab("team", "tiro");
    renderTeamShotmap(team, player.name);
  });

  // ON/OFF button
  document.getElementById("btn-show-onoff").addEventListener("click", () => {
    const team   = document.getElementById("team-select").value;
    const player = _selectedPlayer();
    if (!team || !player) return toast("Selecciona equipo y jugador", "err");
    setTab("team", "quintetos");
    renderTeamOnOff(team, player.name, player.id);
  });

  // Lineup (combinación) button
  document.getElementById("btn-analyze-lineup").addEventListener("click", () => {
    const team = document.getElementById("team-select").value;
    if (!team) return toast("Selecciona un equipo", "err");
    const checkedEls = Array.from(document.querySelectorAll("#team-lineup-picker input:checked"));
    const checked = checkedEls.map(el => el.value);
    const checkedIds = checkedEls.map(el => Number(el.dataset.playerId)).filter(id => Number.isFinite(id));
    if (checked.length < 3 || checked.length > 5) return toast("Elegí entre 3 y 5 jugadores", "err");
    setTab("team", "quintetos");
    renderTeamLineup(team, checked, checkedIds);
  });

  // Last-N filter pills
  document.getElementById("team-filter-pills").addEventListener("click", e => {
    const pill = e.target.closest(".filter-pill");
    if (!pill || !S._teamData) return;
    const n = parseInt(pill.dataset.n, 10);
    S._teamLastN = n;
    _reloadTeam();   // el servidor recalcula la selección; el `Ø` de liga no cambia (C-02 RF-1)
  });

  // Competition filter (compone con las pills Últ. N)
  document.getElementById("team-comp").addEventListener("change", e => {
    if (!S._teamData) return;
    S._teamComp = e.target.value;
    _rememberCompetition(S._teamComp);
    _reloadTeam({ clutch: true });   // los cierres también dependen de la competencia
  });

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try { await api.logout(); } catch {}
      showLogin("Sesión cerrada.");
    });
  }

  document.getElementById("btn-config").addEventListener("click", () => goSection("config"));
  mountLanguageSelector(document.getElementById("lang-slot"), { onPick: lang => chooseLanguage(lang, { persist: true, toast }) });

  // Atrás, Adelante o una dirección editada a mano reconstruyen la vista (X-01 RF-4).
  onRouteChange(() => applyRoute());
  startRoute();
}
// Abre la dirección con la que se cargó la app; sin dirección (o con una inválida) abre la sección inicial (RF-15, RF-16).
export async function startRoute() {
  // Una dirección con dos jugadores abre directamente Comparar › Jugadores (F-05 RF-8).
  if ((comparePlayersFromUrl() || lineupsFromUrl()) && !parseRoute()) { renderCompare(); return; }
  if (await applyRoute({ initial: true })) return;
  await openInitialSection();
}
// ── Login screen ─────────────────────────────────────────────────────────────
export function showLogin(message = "") {
  document.getElementById("app").innerHTML = `
    <div class="login-wrap">
      <form class="login-card" id="login-form">
        <div class="login-logo">🏀 Smart-Basket</div>
        <div class="login-lang" id="login-lang"></div>
        <div class="login-sub">Ingresá para continuar</div>
        ${message ? `<div class="login-msg">${message}</div>` : ""}
        <input id="login-user" type="text" placeholder="Usuario" autocomplete="username" required />
        <input id="login-pass" type="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button class="btn" type="submit" id="login-btn">Entrar</button>
        <div class="login-err" id="login-err"></div>
      </form>
    </div>`;
  mountLanguageSelector(document.getElementById("login-lang"), { onPick: lang => chooseLanguage(lang, { persist: false }) });
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
export async function boot() {
  setUnauthorizedHandler(() => showLogin("Sesión expirada. Iniciá sesión de nuevo."));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  let me;
  try { me = await api.me(); }
  catch { me = { authenticated: false, auth_required: false, seed_enabled: false, is_admin: false }; }
  S._authRequired = me.auth_required === true;
  S._authUser     = me.user || null;
  S._seedEnabled  = me.seed_enabled === true;
  S._isAdmin      = me.is_admin === true;
  S._llmEnabled   = me.llm_enabled === true;

  // Idioma (F-21): preferencia del usuario → idioma del dispositivo → idioma por defecto de la configuración → español.
  const loggedIn = !(S._authRequired && !me.authenticated);
  let lang = null;
  if (loggedIn) {
    try { await loadPrefs("ui"); lang = getPref("ui", "language", null); } catch { /* sin conexión: queda el dispositivo */ }
  }
  if (!isLanguage(lang)) lang = deviceLanguage() || me.default_language;
  await initI18n(lang);

  if (!loggedIn) {
    showLogin();
  } else {
    renderApp();
  }
}
// Al cambiar de idioma se vuelve a dibujar la vista actual (los textos y formatos que arma el servidor y los gráficos se
// piden de nuevo en el idioma nuevo); la ruta y los filtros no cambian (F-21 RF-4).
onLanguageChange(async () => {
  try { applyChartLocale(); } catch { /* sin Chart.js */ }
  if (!document.getElementById("sec-import")) return;     // pantalla de login: no hay vista que redibujar
  try { await applyRoute({ initial: true }); } catch (e) { console.error(e); }
});
boot();
