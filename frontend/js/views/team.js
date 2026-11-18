// Vista team (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { _drawTabs, _tab, setSection, syncRoute } from "../app.js";
import { drawRadar } from "../charts.js";
import { renderClockPanel } from "../components/clock-panel.js";
import { mountContextHeader } from "../components/context-header.js";
import { mountTable } from "../components/data-table.js";
import { exportMenu } from "../components/export-menu.js";
import { renderGamePlan } from "../components/game-plan.js";
import { renderInsights } from "../components/insights-panel.js";
import { renderLineupSuggestions } from "../components/lineup-suggestions.js";
import { renderLineupsBlock } from "../components/lineups-block.js";
import { bindMetricCards } from "../components/metric-card.js";
import { homeTeamButton } from "../components/my-team-controls.js";
import { renderOriginPanel } from "../components/origin-panel.js";
import { renderPeriodBlock } from "../components/period-block.js";
import { renderSecondChancePanel } from "../components/second-chance-panel.js";
import { bindZoneTooltips, shotChart } from "../components/shot-chart.js";
import { renderStandardPanel } from "../components/standard-panel.js";
import { renderSynergy } from "../components/synergy-panel.js";
import { applyTabs } from "../components/tabs.js";
import { renderTeamInsights } from "../components/team-insights.js";
import { renderTransitionPanel } from "../components/transition-panel.js";
import { renderVersus } from "../components/versus-panel.js";
import { getBase, setBase } from "../core/base.js";
import { loadCatalog } from "../core/catalog.js";
import { activeCount, clearContext, clearPlayerFilters, contextParams, dropInvalid } from "../core/context.js";
import { DEC1, DEC2, PCT, fmtNumber } from "../core/format.js";
import { S } from "../state.js";
import { _initCompareTabs, showComparePlayers } from "./compare.js";
import { _renderCompactTrends, _renderEvents, _renderTrends, showGame, showPrepare } from "./panels.js";
import { _shotDetailGrid, renderPlayer } from "./player.js";
import { _USO_HINT, _astPerBox, _baseMeta, _compOptions, _fichaGridHTML, _fourFactorsCard, _hint, _makeCollapsible, _mountCtxBar, _mountPanelExport, _mountTableExport, _radarMsg, _recordCard, _selectionNote, esc, toast } from "./shared.js";

// Enfrentamiento directo del equipo abierto (F-20): se vuelve a pedir al cambiar equipo, competencia, período o filtros.
export function _renderVersus() {
  const code = S._teamData?.team_code;
  if (!code) return;
  renderVersus(document.getElementById("team-versus"), code, {
    params: _teamParams(), rival: S._versusRival, teamName: S._teamData.team_name,
    onRival: r => { S._versusRival = r; syncRoute(); },
    onOpenPrepare: (team, rival, focus) => showPrepare(team, rival, focus),
  });
}
// Sinergias (A-08): Equipo › Quintetos y Jugador › Impacto.
export function _renderSynergy() {
  const code = S._teamData?.team_code;
  if (code) renderSynergy(document.getElementById("team-synergy"), code, { params: _teamParams() });
  // Sugerencias asistidas por IA (F-15): el panel solo existe si el servidor tiene la función habilitada.
  if (code) renderLineupSuggestions(document.getElementById("team-ai"), { teamCode: code, enabled: S._llmEnabled, params: _teamParams() });
}
export function _clutchTitle(d) {
  if (!d) return `<div class="card-title">Cierres</div>`;
  const min = d.window_secs / 60;
  return `<div class="card-title">Cierres (últimos ${fmtNumber(min, Number.isInteger(min) ? 0 : 1)} min, dif ≤ ${d.margin})</div>`;
}
// Recuento que cierra: calificados + excluidos + sin eventos de cierre + sin play-by-play = partidos del equipo.
export function _clutchCount(d) {
  const parts = [`${d.games_qualified} calificado(s)`,
                 `${d.games_excluded} excluido(s) por diferencia mayor a ${d.margin}`];
  if (d.games_without_clutch_events) parts.push(`${d.games_without_clutch_events} sin eventos de cierre`);
  if (d.games_without_pbp) parts.push(`${d.games_without_pbp} sin play-by-play`);
  return (d.competition ? `${esc(d.competition.label)} · ` : "") + parts.join(" · ");
}
export async function renderTeamClutch(teamCode) {
  const box = document.getElementById("team-clutch");
  if (!box) return;
  const req = ++S._clutchReq;
  box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty"><span class="spinner"></span>Calculando cierres...</p></div>`;
  let d;
  try {
    d = await api.clutchTeam(teamCode, S._teamComp, { last: S._teamLastN || null, ...contextParams() });
  } catch (e) {
    if (req === S._clutchReq) box.innerHTML = `<div class="card">${_clutchTitle(null)}<p class="empty below-avg">${e.message || "No se pudieron cargar los cierres"}</p></div>`;
    return;
  }
  if (req !== S._clutchReq) return;   // llegó tarde: otro equipo o competencia elegidos
  const title = _clutchTitle(d);
  if (!d.games_qualified) {
    box.innerHTML = `<div class="card">${title}<p class="empty">Sin cierres apretados: ${_clutchCount(d)}.</p></div>`;
    return;
  }
  box.innerHTML = `
    <div class="card">
      ${title}
      <p class="td-muted">Agregado del equipo en cierres apretados — récord <strong>${d.clutch_record}</strong> · ${_clutchCount(d)}</p>
      <div id="team-clutch-standard-panel"></div>
      <div class="card-title" style="margin-top:16px">Por partido</div>
      <div id="team-clutch-dt"></div>
    </div>`;
  // Tabla por partido migrada a createDataTable (T-06). Conserva competencia y recuento (C-06).
  const compParam = (S._teamComp && S._teamComp !== "all") ? S._teamComp : null;
  mountTable(document.getElementById("team-clutch-dt"),
    () => api.table("clutch_games", { team: teamCode, competition: compParam }),
    { tableId: "clutch_games" });
  _loadClutchStandard(teamCode, d.margin, d.window_secs);
}
export async function _loadClutchStandard(teamCode, margin, windowSecs) {
  const el = document.getElementById("team-clutch-standard-panel");
  if (!el) return;
  const req = ++S._clutchStdReq;
  renderStandardPanel(el, null, { layout: "grid" });
  try {
    await loadCatalog();
    const payload = await api.metrics("clutch", { id: teamCode, competition: S._teamComp, margin, window_secs: windowSecs });
    if (req !== S._clutchStdReq) return;
    renderStandardPanel(el, payload, { layout: "grid" });
    bindMetricCards(el, { entityType: "clutch", contextQuery: { competition: S._teamComp, margin, window_secs: windowSecs, id: teamCode } });
  } catch (e) {
    if (req !== S._clutchStdReq) return;
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid" });
  }
}
// Carga que tolera filtros inválidos en la dirección (T-03 RF-17): cada 400 `contexto_invalido`
// limpia EL parámetro que el backend nombró y reintenta. Una URL compartida puede traer varios
// filtros vencidos (rival que ya no está en la competencia + jugador de otro equipo), así que se
// reintenta mientras quede algo por limpiar, no una sola vez.
export async function _loadDroppingInvalid(load) {
  for (let i = 0; i < 5; i++) {
    try {
      return await load();
    } catch (e) {
      if (!dropInvalid(e)) throw e;
      toast(e.message, "err");
    }
  }
  return load();
}
// Parámetros de la selección activa; `api.js` omite los nulos (sin `competition` el servidor usa la
// competencia del partido más reciente del equipo).
export const _teamParams = () => ({ competition: S._teamComp, last: S._teamLastN || null, ...contextParams() });
// Jugador elegido en el select de Equipo: la ficha (value) y su nombre visible (C-08)
export function _selectedPlayer() {
  const sel = document.getElementById("player-select");
  const opt = sel.selectedOptions[0];
  return sel.value && opt ? { id: Number(sel.value), name: opt.dataset.name } : null;
}
// Desglose ofensivo: si FIBA no lo publica en la competencia se calcula desde el play-by-play y se avisa.
export function _extrasNote(data) {
  const calc = Object.values(data.extras_source || {}).filter(v => v === "calculado").length;
  if (!calc) return "";
  return `<p class="td-muted">${calc === 5 ? "Calculado" : "En parte calculado"} desde el play-by-play: FIBA no publica este desglose en la competencia. ` +
    `El contraataque cuenta las posesiones de transición (aproximación).</p>`;
}
export function _renderTeamContent(main, data) {
  const av  = { ...data.averages, null_reasons: data.null_reasons };
  const rs  = av.null_reasons;   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA elegida, no del subconjunto en pantalla: lo calcula el servidor y
  // el filtro de últimos N no lo altera (C-02 RF-1). "Todas": `Ø —` con razón `sin_universo`.
  const lg  = data.league;
  const radarOk = lg?.oer?.avg != null;
  const hasGames = data.game_log.length > 0;
  const radarCard = `
        <div class="card">
          <div class="card-title">Perfil de equipo</div>
          ${!hasGames ? '<p class="empty">Sin partidos en la selección.</p>'
            : radarOk ? '<div class="radar-wrap"><canvas id="chart-radar"></canvas></div>'
            : `<p class="empty">${_radarMsg(data)}</p>`}
        </div>`;
  const evoCard = '<div id="team-evo-compact"></div>';

  // Definición de las cards con ficha (T-01): etiqueta, clave (legada o canónica),
  // valor promedio y display de respaldo para cuando no hay conjunto estándar.
  const TEAM_CARD_GROUPS = [
    { title: "Eficiencia", metrics: [
      ["OER", "oer", av.oer, DEC2(av.oer)], ["DER", "der", av.der, DEC2(av.der)],
      ["Net Rating", "net_rating", av.net_rating, DEC2(av.net_rating)],
      ["Pace", "pace", av.pace, DEC2(av.pace)], ["PPT", "ppt", av.ppt, DEC2(av.ppt)],
      ["FT Rate", "ft_rate", av.ft_rate, DEC2(av.ft_rate)] ] },
    { title: "Tiro", extra: _shotDetailGrid(av, data.totals), metrics: [
      ["eFG%", "efg_pct", av.efg_pct, PCT(av.efg_pct)], ["TS%", "ts_pct", av.ts_pct, PCT(av.ts_pct)],
      ["FG2%", "fg2_pct", av.fg2_pct, PCT(av.fg2_pct)], ["FG3%", "fg3_pct", av.fg3_pct, PCT(av.fg3_pct)],
      ["FT%", "ft_pct", av.ft_pct, PCT(av.ft_pct)],
      [_hint("Uso 2P", _USO_HINT), "fg2_uso", av.fg2_uso, PCT(av.fg2_uso)],
      [_hint("Uso 3P", _USO_HINT), "fg3_uso", av.fg3_uso, PCT(av.fg3_uso)],
      [_hint("Uso TL", _USO_HINT), "ft_uso", av.ft_uso, PCT(av.ft_uso)] ] },
    { title: "Rebotes & Misc", trailing: _astPerBox(av, data.totals), metrics: [
      ["OR%", "or_pct", av.or_pct, PCT(av.or_pct)], ["DR%", "dr_pct", av.dr_pct, PCT(av.dr_pct)],
      ["Reb%", "trb_pct", av.trb_pct, PCT(av.trb_pct)], ["PER", "tov", av.tov, DEC2(av.tov)],
      ["AS", "ast", av.ast, DEC2(av.ast)] ] },
    { title: "Defensa avanzada", metrics: [
      ["Robos", "stl", av.stl, DEC2(av.stl)], ["Tapones", "blk", av.blk, DEC2(av.blk)],
      ["Stops", "stocks", av.stocks, DEC2(av.stocks)],
      ["Def Playmaking", "def_playmaking", av.def_playmaking, DEC2(av.def_playmaking)],
      ["DEF/TO Ratio", "def_to_ratio", av.def_to_ratio, DEC2(av.def_to_ratio)] ] },
    { title: "Desglose ofensivo", metrics: [
      ["PtsEnPint", "paint_pts", av.paint_pts, DEC2(av.paint_pts)],
      ["Seg. Op.", "second_chance_pts", av.second_chance_pts, DEC2(av.second_chance_pts)],
      ["Ptos/PER", "pts_from_tov", av.pts_from_tov, DEC2(av.pts_from_tov)],
      ["Banca", "bench_pts", av.bench_pts, DEC2(av.bench_pts)],
      ["PCA", "fast_break_pts", av.fast_break_pts, DEC2(av.fast_break_pts)] ],
      extra: _extrasNote(data) },
  ];

  const groupCard = i => {
    const g = TEAM_CARD_GROUPS[i];
    return `
    <div class="card">
      <div class="card-title">${g.title}</div>
      <div class="stat-grid metric-card-grid" data-mc-group="${i}">${_fichaGridHTML(g.metrics, "team", null, data.team_code)}</div>
      ${g.trailing ? `<div class="stat-grid">${g.trailing}</div>` : ""}
      ${g.extra || ""}
    </div>`;
  };

  // Distribución de la pestaña (boceto del cliente, 2 columnas; 1 en pantallas chicas):
  //   Mapa de tiro        | Perfil de equipo
  //   Evolución / partido | Récord + Four Factors
  //   Eficiencia          | Tiro
  //   Rebotes             | Defensa + Desglose ofensivo
  //   Conjunto estándar (desplegable, ancho completo)
  main.innerHTML = `
    ${_selectionNote(data, ["equipo", "equipos"])}
    <div class="team-grid" data-tabs="resumen">
      <div id="team-teamshot"></div>
      ${radarCard}
      ${evoCard}
      <div class="tg-stack">${_recordCard(data.record, data.team_name)}${_fourFactorsCard(av, data.team_name)}</div>
      ${groupCard(0)}
      ${groupCard(1)}
      ${groupCard(2)}
      <div class="tg-stack">${groupCard(3)}${groupCard(4)}</div>
      <div class="card tg-full" id="team-standard-card">
        <div class="card-title">Conjunto estándar</div>
        <div id="team-standard-panel"></div>
      </div>
    </div>
    <div class="card" data-tabs="gamelog">
      <div class="card-title">Game log</div>
      <div id="team-gamelog-dt"></div>
    </div>`;
  _makeCollapsible(main.querySelector("#team-standard-card"), "equipo-estandar", false);

  if (hasGames) {
    if (radarOk) drawRadar("chart-radar", av, lg, data.team_name);
    _renderCompactTrends("team");
  }
  S._teamCardGroups = TEAM_CARD_GROUPS;
  _loadTeamStandard(data.team_code);
  _loadTeamGameLog(data.team_code);

  // Exportación de las tablas no migradas de Equipo (T-D10): Four Factors y detalle de tiro.
  const ffHost = main.querySelector('[data-xm="four-factors"]');
  if (ffHost) _mountTableExport(ffHost, () => main.querySelector("#four-factors-table"),
    _baseMeta({ title: `Four Factors — ${data.team_name}`, section: "four-factors", entity: data.team_name, entitySlug: data.team_code, competitionLabel: _teamCompLabel() }));
  _mountShotDetailExports(main, data.team_name, data.team_code, _teamCompLabel());
}
// Monta exportación en cada grilla de detalle de tiro (T-D10). No es un <table>, así que
// se serializan las parejas etiqueta/valor de los stat-box.
export function _mountShotDetailExports(container, entityName, entitySlug, compLabel) {
  container.querySelectorAll("[data-shot-detail]").forEach(grid => {
    const host = grid.querySelector("[data-xm-shot]");
    if (!host) return;
    const meta = _baseMeta({ title: `Detalle de tiro — ${entityName}`, section: "detalle-tiro", entity: entityName, entitySlug, competitionLabel: compLabel });
    exportMenu(host, {
      getData: () => {
        const boxes = [...grid.querySelectorAll(".stat-box")];
        const columns = [{ key: "metrica", label: "Métrica", fmt: "text" }, { key: "valor", label: "Valor", fmt: "text" }];
        const rows = boxes.map(b => [b.querySelector(".stat-label")?.textContent.trim() || "", b.querySelector(".stat-value")?.textContent.trim() || ""]);
        return { meta, columns, rows, footer: [], pageInfo: `${rows.length} filas` };
      },
      getNode: () => grid,
    });
  });
}
// Etiqueta de la competencia activa de Equipo (para la cabecera de exportación).
export function _teamCompLabel() {
  const sel = document.getElementById("team-comp");
  if (sel && sel.selectedOptions[0] && S._teamComp !== "all") return sel.selectedOptions[0].textContent;
  return "";
}
// Game log de equipo migrado a createDataTable (team_game_log). Respeta competencia,
// "Últ. N" y base elegida en la vista (T-D8).
export function _loadTeamGameLog(teamCode) {
  const el = document.getElementById("team-gamelog-dt");
  if (!el) return;
  const compParam = (S._teamComp && S._teamComp !== "all") ? S._teamComp : null;
  mountTable(el,
    () => api.table("team_game_log", { team: teamCode, competition: compParam, last: S._teamLastN || null, ...contextParams(), base: getBase() }),
    { tableId: "team_game_log", onRowClick: row => showGame(row.id) });   // la fila abre Analizar partido (F-07 CA-3)
}
// Re-dibuja las grillas de fichas de Equipo/Jugador con el conjunto estándar ya
// cargado (`std`), y engancha el ranking al hover/tap. `sectionEl` acota el bind.
export function _fillFichaGrids(container, groups, entityType, std, entityId) {
  if (!container || !groups) return;
  groups.forEach((g, i) => {
    const grid = container.querySelector(`.metric-card-grid[data-mc-group="${i}"]`);
    if (grid) grid.innerHTML = _fichaGridHTML(g.metrics, entityType, std, entityId);
  });
}
export async function _loadTeamStandard(teamCode) {
  const el = document.getElementById("team-standard-panel");
  const main = document.getElementById("team-main");
  if (!el) return;
  const req = ++S._teamStdReq;
  renderStandardPanel(el, null, { layout: "grid", base: getBase() });
  const ctxQuery = { competition: S._teamComp, last: S._teamLastN || null, ...contextParams() };
  try {
    await loadCatalog();
    // El conjunto estándar que alimenta las cards de ficha va siempre por partido
    // (base del ranking, RF-18); el panel usa la base elegida por el usuario.
    const fichaStd = await api.metrics("team", { id: teamCode, ...ctxQuery, base: "partido" });
    if (req !== S._teamStdReq) return;
    _fillFichaGrids(main, S._teamCardGroups, "team", fichaStd, teamCode);
    const payload = getBase() === "partido"
      ? fichaStd
      : await api.metrics("team", { id: teamCode, ...ctxQuery, base: getBase() });
    if (req !== S._teamStdReq) return;
    renderStandardPanel(el, payload, {
      layout: "grid",
      base: getBase(),
      onBaseChange: newBase => { setBase(newBase); _loadTeamStandard(teamCode); _loadTeamGameLog(teamCode);
        _renderTeamRoster(teamCode); _renderTeamLineups(teamCode, S._teamData?.team_name);
        _renderTeamPeriods(teamCode, S._teamData?.team_name); },
    });
    if (main) bindMetricCards(main, { entityType: "team", contextQuery: { ...ctxQuery, id: teamCode } });
  } catch (e) {
    if (req !== S._teamStdReq) return;
    // Sin conjunto estándar las cards ya muestran el valor; aviso discreto en el panel.
    _fillFichaGrids(main, S._teamCardGroups, "team", null, teamCode);
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid", base: getBase() });
  }
}
// Plantel del equipo (F-08): tabla completa T-06; absorbe el ranking por USO% (RF-8), que ahora es
// una columna más de esta tabla. Cada fila abre la ficha del jugador.
export function _renderTeamRoster(teamCode) {
  const el = document.getElementById("team-roster");
  if (!el) return;
  el.innerHTML = `<div class="card">
      <div class="map-header">
        <div class="card-title" style="margin:0">Plantel</div>
        <button type="button" class="btn btn-ghost btn-sm rs-pick-toggle">Elegir para comparar</button>
      </div>
      <p class="td-muted rs-hint">Tocá una fila para abrir la ficha del jugador.</p>
      <div class="rs-compare" style="display:none">
        <span class="rs-picked"></span>
        <button type="button" class="btn btn-ghost btn-sm rs-compare-go" disabled>Comparar</button>
        <button type="button" class="btn btn-ghost btn-sm rs-compare-clear">Limpiar</button>
      </div>
      <div id="team-roster-dt"></div>
    </div>`;
  // Selección para comparar (F-08 RF-5 → F-05 RF-9): dos jugadores y se abre Comparar › Jugadores.
  const picked = [];
  let pickMode = false;
  const bar = el.querySelector(".rs-compare");
  const label = el.querySelector(".rs-picked");
  const go = el.querySelector(".rs-compare-go");
  const hint = el.querySelector(".rs-hint");
  const toggle = el.querySelector(".rs-pick-toggle");
  const refresh = () => {
    bar.style.display = pickMode ? "" : "none";
    label.textContent = picked.length ? picked.map(p => p.name).join(" vs ") : "Elegí dos jugadores.";
    go.disabled = picked.length !== 2;
    toggle.textContent = pickMode ? "Salir de comparar" : "Elegir para comparar";
    hint.textContent = pickMode
      ? "Tocá dos filas para elegir los jugadores a comparar."
      : "Tocá una fila para abrir la ficha del jugador.";
  };
  toggle.addEventListener("click", () => {
    pickMode = !pickMode;
    if (!pickMode) picked.length = 0;
    refresh();
  });
  el.querySelector(".rs-compare-clear").addEventListener("click", () => { picked.length = 0; refresh(); });
  refresh();
  go.addEventListener("click", () => { if (picked.length === 2) showComparePlayers(picked[0].id, picked[1].id); });
  mountTable(document.getElementById("team-roster-dt"),
    () => api.table("team_roster", { team: teamCode, ...contextParams(), competition: S._teamComp, last: S._teamLastN || null, base: getBase() }),
    {
      tableId: "team_roster",
      collapsedRows: 5,   // lista corta que se extiende con "Ver todos"
      onRowClick: (row, payload) => {
        const i = payload.columns.findIndex(c => c.key === "_name");
        const name = i >= 0 ? row.values[i] : "";
        if (pickMode) {   // modo comparar: la fila se marca en vez de abrir la ficha
          const at = picked.findIndex(p => String(p.id) === String(row.id));
          if (at >= 0) picked.splice(at, 1);
          else if (picked.length < 2) picked.push({ id: row.id, name });
          refresh();
          return;
        }
        setSection("player");
        renderPlayer(teamCode, name, Number(row.id) || null);
      },
    });
}
// Bloques "Mejores quintetos" / "Todos los quintetos" / "ON/OFF del plantel" (F-06).
export function _renderTeamLineups(teamCode, teamName) {
  // Enlace profundo (F-10): `?lineup=EQUIPO:pid-pid-…` abre el detalle de ese quinteto; se consume una vez.
  let open = S._pendingLineup;
  S._pendingLineup = null;
  if (!open) { try { open = new URL(location.href).searchParams.get("lineup"); } catch { open = null; } }
  renderLineupsBlock(document.getElementById("team-lineups-block"), teamCode, {
    params: _teamParams(), base: getBase(), teamName, competitionLabel: _teamCompLabel(),
    openLineup: open && open.split(":")[0].toUpperCase() === teamCode ? open : null,
    onCompare: (a, b) => showCompareLineups(a, b),
  });
}
export function openTeamLineup(lineupId) {
  const team = String(lineupId).split(":")[0].toUpperCase();
  S._pendingLineup = lineupId;
  location.hash = `#/equipo/${encodeURIComponent(team)}/quintetos`;
}
// Abre Comparar › Quintetos con dos quintetos ya elegidos (F-09, desde el detalle de un quinteto).
export function showCompareLineups(idA, idB) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("cmp_qa", idA); url.searchParams.set("cmp_qb", idB);
    history.replaceState(history.state, "", url);
  } catch { /* sin dirección */ }
  setSection("compare");
  const qPane = document.getElementById("cmp-pane-quintetos");
  delete qPane.dataset.mounted;
  _initCompareTabs("quintetos");
}
// Bloque "Por tramo del partido" (F-04): los 8 tramos en una llamada; cambiar de tramo no vuelve a pedir nada.
export function _renderTeamPeriods(teamCode, teamName) {
  renderPeriodBlock(document.getElementById("team-periods"), teamCode, {
    params: _teamParams(), base: getBase(), teamName, competitionLabel: _teamCompLabel(),
    onBaseChange: newBase => { setBase(newBase); _loadTeamStandard(teamCode); _loadTeamGameLog(teamCode); _renderTeamPeriods(teamCode, teamName); },
  });
}
// Aplica una respuesta de perfil de equipo: guarda la selección que el servidor resolvió (el eco de
// `context`), sincroniza pills y selector de competencia y dibuja.
export function _applyTeamData(main, data) {
  S._teamData  = data;
  S._teamComp  = String(data.context.competition.id ?? "all");
  S._teamLastN = data.context.applied.last || 0;
  const pills = document.getElementById("team-filter-pills");
  if (pills) {
    pills.style.display = "none";   // los chips de período de la cabecera (F-19) reemplazan a estas pills
    pills.querySelectorAll(".filter-pill").forEach(p => p.classList.toggle("active", Number(p.dataset.n) === S._teamLastN));
  }
  const compWrap = document.getElementById("team-comp-wrap");
  const compSel  = document.getElementById("team-comp");
  if (compWrap && compSel) {
    compWrap.style.display = data.competitions.length > 1 ? "" : "none";
    compSel.innerHTML = _compOptions(data.competitions, S._teamComp, "Todas las competencias", "all");
  }
  _renderTeamContent(main, data);
  homeTeamButton(document.getElementById("team-home-btn"), { teamCode: data.team_code, toast });
  _drawTabs("team");
  applyTabs(document.getElementById("sec-team"), _tab.team);
  syncRoute();
  if (_tab.team === "enfrentamiento") _renderVersus();
  if (_tab.team === "gamelog") _renderTrends("team");
  if (_tab.team === "eventos") _renderEvents("team");
  if (_tab.team === "quintetos") _renderSynergy();
  _mountCtxBar(main, S._teamComp, () => _reloadTeam(), data.team_code);
  mountContextHeader(document.getElementById("team-ctx-header"), {
    entity: "team", id: data.team_code, competition: S._teamComp, last: S._teamLastN, excludeTeam: data.team_code,
    onLast: n => { S._teamLastN = n; _reloadTeam(); },
    onChange: () => _reloadTeam(),
    onClear: () => { clearContext(); S._teamLastN = 0; _reloadTeam(); },
  });
  _renderTeamPeriods(data.team_code, data.team_name);
  renderOriginPanel(document.getElementById("team-origins"), data.team_code, { mode: "team", params: _teamParams() });
  renderTransitionPanel(document.getElementById("team-transition"), data.team_code, { mode: "team", params: _teamParams() });
  renderSecondChancePanel(document.getElementById("team-second-chance"), data.team_code, { mode: "team", params: _teamParams() });
  renderClockPanel(document.getElementById("team-clock"), data.team_code, { mode: "team", params: _teamParams() });
  renderGamePlan(document.getElementById("team-gameplan"), data.team_code, { params: _teamParams() });
  renderInsights(document.getElementById("team-a10"), "team", data.team_code, { params: _teamParams() });
  renderTeamInsights(document.getElementById("team-insights"), data.team_code, { params: _teamParams() });
  renderTeamShotmapTeam(data.team_code);   // mapa de tiro del equipo (Feature 10), de la selección activa
  _renderTeamRoster(data.team_code);
  _renderTeamLineups(data.team_code, data.team_name);
}
// Cambió la competencia o el filtro de últimos N: se pide el perfil de nuevo al servidor (no se recalcula
// en el navegador, C-02 RF-5). `clutch`: los cierres dependen solo de la competencia.
export async function _reloadTeam({ clutch = false } = {}) {
  if (!S._teamData) return;
  const main = document.getElementById("team-main");
  const code = document.getElementById("team-select").value || S._teamData.team_code;
  const req = ++S._teamReq;
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  let data;
  try {
    data = await api.team(code, _teamParams());
  } catch (e) {
    if (req !== S._teamReq) return;
    toast(e.message, "err");
    try {
      // La competencia elegida dejó de existir o de estar publicada: volver a la por defecto (RF-14);
      // cualquier otro error (p. ej. sin conexión): se conserva la selección anterior.
      data = /competencia/i.test(e.message) ? await api.team(code)
           : dropInvalid(e) ? await api.team(code, _teamParams()) : S._teamData;
    } catch (e2) {
      if (req === S._teamReq) main.innerHTML = `<p class="empty below-avg">${e2.message}</p>`;
      return;
    }
    if (req !== S._teamReq) return;
    clutch = true;
  }
  if (req !== S._teamReq) return;
  _applyTeamData(main, data);
  _loadTeamPlayers(code, req).catch(() => {});
  if (clutch) renderTeamClutch(code);
}
// Selector de jugador y combinaciones del equipo: solo los de la competencia elegida (no los de otra liga).
export async function _loadTeamPlayers(teamCode, req = S._teamReq) {
  const players = await api.players(teamCode, { competition: S._teamComp });
  if (req !== S._teamReq) return;
  const pSel = document.getElementById("player-select");
  const keep = pSel.value;
  pSel.innerHTML = '<option value="">— Seleccionar jugador —</option>' +
    players.map(p => `<option value="${p.player_id ?? ""}" data-name="${esc(p.name)}">${esc(p.name)}</option>`).join("");
  if (keep && players.some(p => String(p.player_id) === keep)) pSel.value = keep;
  const lineupCard = document.getElementById("team-lineup-card");
  const picker = document.getElementById("team-lineup-picker");
  if (players.length >= 3) {
    picker.innerHTML = players.map(p => `
      <label class="lineup-check"><input type="checkbox" value="${esc(p.name)}" data-player-id="${p.player_id ?? ""}">${esc(p.name)}</label>`).join("");
    lineupCard.style.display = "";
  } else {
    lineupCard.style.display = "none";
  }
  document.getElementById("team-lineup").innerHTML = "";   // una combinación de la competencia anterior ya no aplica
}
export async function renderTeam(teamCode) {
  if (S._ctxTeam && S._ctxTeam !== teamCode) clearPlayerFilters();
  S._ctxTeam = teamCode;
  const main = document.getElementById("team-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  // Con una dirección abierta (X-01) la competencia y los últimos N vienen de ella; si no, la del partido más reciente (RF-6).
  const rq = S._routeQuery; S._routeQuery = null;
  S._versusRival = rq?.rival && rq.rival !== teamCode ? String(rq.rival).toUpperCase() : "";
  S._teamLastN = Number(rq?.last) > 0 ? Number(rq.last) : 0;
  S._teamComp  = rq?.competition || null;
  const req = ++S._teamReq;

  try {
    const data = await _loadDroppingInvalid(() => api.team(teamCode, _teamParams()));
    if (req !== S._teamReq) return;
    _applyTeamData(main, data);

    await _loadTeamPlayers(teamCode, req);

    renderTeamClutch(teamCode);        // cierres del equipo, de la competencia elegida (Feature 05 v2)
  } catch (e) {
    if (req === S._teamReq) main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}
// Sin tiros: con filtros activos, el mensaje lo dice (no es que el equipo no tire).
export const _noShots = what => activeCount() > 0 ? '<p class="empty">Sin tiros que cumplan estos filtros.</p>' : `<p class="empty">${what}</p>`;
// Filtros que el mapa no aplica (cuarto, marcador, con/sin jugador, origen, tipo de ataque, oportunidad): se avisa.
export const _shotNote = d => (d?.context?.ignored || []).length
  ? '<p class="td-muted">Este mapa aplica los filtros de partido y de reloj; no aplica cuarto, marcador, con/sin jugador, origen, tipo de ataque ni oportunidad.</p>' : "";
// Mapa de tiro AGREGADO del equipo (C-03) — usa api.shotZones + shotChart
export function renderTeamShotmapTeam(teamCode) {
  const box = document.getElementById("team-teamshot");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro del equipo...</p></div>';
  api.shotZones({ entity: 'team', id: teamCode, competition: S._teamComp, last: S._teamLastN || null, ...contextParams() }).then(shots => {
    if (!shots || !shots.summary?.total_shots) {
      box.innerHTML = `<div class="card">${_noShots("Sin tiros registrados para este equipo.")}</div>`;
      return;
    }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Mapa de tiro del equipo <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${teamCode}</span></div>
        ${shotChart(shots)}${_shotNote(shots)}
      </div>`;
    bindZoneTooltips(box, shots);
  }).catch(() => { box.innerHTML = ""; });
}
// Shot chart del jugador DENTRO de la vista Equipo (C-03) — usa api.shotZones + shotChart
export function renderTeamShotmap(teamCode, playerName) {
  const box = document.getElementById("team-shotmap");
  if (!box) return;
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Cargando mapa de tiro...</p></div>';
  const playerId = _selectedPlayer()?.id;
  if (!playerId) { box.innerHTML = ""; return; }
  api.shotZones({ entity: 'player', id: playerId, competition: S._teamComp, last: S._teamLastN || null, ...contextParams() }).then(shots => {
    if (!shots || !shots.summary?.total_shots) {
      box.innerHTML = `<div class="card">${_noShots("Sin tiros registrados para este jugador.")}</div>`;
      return;
    }
    box.innerHTML = `
      <div class="card">
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${shotChart(shots)}${_shotNote(shots)}
      </div>`;
    bindZoneTooltips(box, shots);
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }).catch(() => { box.innerHTML = ""; });
}
// ON/OFF: rendimiento del equipo con un jugador en cancha vs en el banco (Feature 04)
// T-05/T-E4: las dos tablas (Eficiencia y Producción del equipo) se retiran; el conjunto
// estándar completo lo monta `renderStandardPanel(..., {layout:"compare"})` con
// `api.metrics("onoff", ...)`. El badge de confiabilidad de muestra (T-02) ya lo aporta
// el panel en su cabecera: no se duplica una línea propia de "ON: N pos"/"sin muestra".
export async function renderTeamOnOff(teamCode, playerName, playerId = null) {
  const box = document.getElementById("team-onoff");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando ON/OFF...</p></div>';
  try {
    const r = await api.onoff(teamCode, playerName, _teamParams());

    box.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">ON / OFF <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName} · Uso ${r.usg_pct != null ? PCT(r.usg_pct) : "—"}</span></div>
          <span class="xm-host" data-xm="onoff"></span>
        </div>
        <div id="team-onoff-standard-panel" style="margin-top:8px"></div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const panelEl = document.getElementById("team-onoff-standard-panel");
    _mountPanelExport(box.querySelector('[data-xm="onoff"]'), () => panelEl,
      _baseMeta({ title: `ON/OFF — ${playerName}`, section: "on-off", entity: playerName, entitySlug: `${teamCode}-${playerName}`, competitionLabel: _teamCompLabel() }));
    if (playerId != null) {
      renderStandardPanel(panelEl, null, { layout: "compare" });
      try {
        await loadCatalog();
        const payload = await api.metrics("onoff", { id: `${teamCode}:${playerId}`, competition: S._teamComp, last: S._teamLastN || null, ...contextParams() });
        renderStandardPanel(panelEl, payload, { layout: "compare" });
      } catch (e) {
        renderStandardPanel(panelEl, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "compare" });
      }
    }
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos ON/OFF para este jugador", "err");
  }
}
// Lineups: rendimiento del equipo con una combinación de 3-5 jugadores en cancha (Feature 03)
// T-05/T-E3: el resumen (statBox/tabla de 18 columnas) se retira; se conservan líderes y el
// recuento de partidos usados/excluidos de `api.lineup`. El conjunto estándar lo monta
// `renderStandardPanel` con `api.metrics("lineup", ...)`.
export async function renderTeamLineup(teamCode, players, playerIds = []) {
  const box = document.getElementById("team-lineup");
  box.innerHTML = '<div class="card"><p class="empty"><span class="spinner"></span>Calculando combinación...</p></div>';
  try {
    const r = await api.lineup(teamCode, players, _teamParams());
    const lead = (l, key) => l ? `${l.name} (${l[key]})` : "—";
    box.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Combinación <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${players.join(" · ")}</span></div>
          <span class="xm-host" data-xm="lineup"></span>
        </div>
        <p class="td-muted" style="margin-top:8px">
          ${DEC1(r.sample.possessions)} posesiones · ${Math.round(r.sample.seconds / 60)}' en cancha ·
          ${r.games_used} partido(s) usado(s)${r.games_excluded ? ` (${r.games_excluded} excluido(s) por datos inconsistentes)` : ""}
        </p>
        <div class="stat-grid" style="margin-top:8px">
          <div class="stat-box"><div class="stat-label">Anota más</div><div class="stat-value neutral">${lead(r.leaders.scorer, "pts")}</div></div>
          <div class="stat-box"><div class="stat-label">Asiste más</div><div class="stat-value neutral">${lead(r.leaders.assister, "ast")}</div></div>
          <div class="stat-box"><div class="stat-label">Rebota más</div><div class="stat-value neutral">${lead(r.leaders.rebounder, "trb")}</div></div>
        </div>
        <div id="team-lineup-standard-panel" style="margin-top:12px"></div>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const panelEl = document.getElementById("team-lineup-standard-panel");
    _mountPanelExport(box.querySelector('[data-xm="lineup"]'), () => panelEl,
      _baseMeta({ title: `Combinación — ${players.join(" · ")}`, section: "combinacion", entity: players.join("-"), entitySlug: teamCode, competitionLabel: _teamCompLabel() }));
    if (playerIds.length >= 3) {
      renderStandardPanel(panelEl, null, { layout: "grid" });
      try {
        await loadCatalog();
        const id = `${teamCode}:${[...playerIds].sort((a, b) => a - b).join("-")}`;
        const payload = await api.metrics("lineup", { id, competition: S._teamComp, last: S._teamLastN || null, ...contextParams() });
        renderStandardPanel(panelEl, payload, { layout: "grid" });
        bindMetricCards(panelEl, { entityType: "lineup", contextQuery: { competition: S._teamComp, last: S._teamLastN || null, ...contextParams(), id } });
      } catch (e) {
        renderStandardPanel(panelEl, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid" });
      }
    }
  } catch (e) {
    box.innerHTML = "";
    toast(e.message || "Sin datos para esta combinación", "err");
  }
}
