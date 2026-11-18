// Vista player (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { _drawTabs, _tab, setSection, syncRoute } from "../app.js";
import { drawRadar } from "../charts.js";
import { renderClockPanel } from "../components/clock-panel.js";
import { mountContextHeader } from "../components/context-header.js";
import { mountTable } from "../components/data-table.js";
import { renderInsights } from "../components/insights-panel.js";
import { bindMetricCards } from "../components/metric-card.js";
import { followButton } from "../components/my-team-controls.js";
import { renderOriginPanel } from "../components/origin-panel.js";
import { renderPlayerHeader } from "../components/player-header.js";
import { renderRapm } from "../components/rapm-panel.js";
import { renderSecondChancePanel } from "../components/second-chance-panel.js";
import { bindZoneTooltips, shotChart } from "../components/shot-chart.js";
import { renderSimilar } from "../components/similar-panel.js";
import { renderStandardPanel } from "../components/standard-panel.js";
import { renderImpact } from "../components/synergy-panel.js";
import { applyTabs } from "../components/tabs.js";
import { renderTransitionPanel } from "../components/transition-panel.js";
import { getBase, setBase } from "../core/base.js";
import { loadCatalog } from "../core/catalog.js";
import { clearContext, contextParams, dropInvalid } from "../core/context.js";
import { DEC2, PCT } from "../core/format.js";
import { S } from "../state.js";
import { _renderCompactTrends, _renderEvents, _renderTrends, showGame } from "./panels.js";
import { _PCT_REB_HINT, _USO_HINT, _astPerBox, _compOptions, _creationNote, _fichaGridHTML, _hint, _makeCollapsible, _mountCtxBar, _radarMsg, _rememberCompetition, _selectionNote, statBox, toast } from "./shared.js";
import { _fillFichaGrids, _loadDroppingInvalid, _mountShotDetailExports, _noShots, _shotNote } from "./team.js";

export function _renderImpactTab() {
  if (S._playerData?.player_id == null) return;
  renderRapm(document.getElementById("player-rapm"), S._playerData.player_id, { params: _playerParams(), toast });
  if (!S._playerData.team_code) return;
  renderImpact(document.getElementById("player-impact"), S._playerData.team_code, S._playerData.player_id, { params: _playerParams() });
}
export function _renderSimilar() {
  const id = S._playerData?.player_id;
  if (id == null) return;
  renderSimilar(document.getElementById("player-similar"), id, {
    params: _playerParams(), position: S._similar.position, minMinutes: S._similar.min,
    onChange: ({ position, minMinutes }) => { S._similar = { position, min: minMinutes }; _renderSimilar(); },
    onOpenPlayer: _openPlayerById,
  });
}
export function _openPlayerById(id) {
  _tab.player = "resumen";
  setSection("player", { sync: false });
  renderPlayer(null, null, Number(id));
}
// C-07 — detalle de tiro: intentos/convertidos de las 3 categorías (promedio por
// partido + total de temporada) y los 4 PPT. Compartido por Equipo y Jugador.
export function _shotDetailGrid(av, totals) {
  const t = totals || {};
  const rs = av?.null_reasons || {};
  // "promedio (total)" — el promedio ya viene del backend; el total también, para no
  // arrastrar el redondeo de multiplicar promedio × partidos (Feature 16 §9).
  const cell = (label, avgKey, totKey) => {
    const a = av?.[avgKey], n = t[totKey];
    // Total ausente → "—", nunca "(0)" (C-11 RF-4)
    const disp = `${DEC2(a)}<span style="font-size:9px;color:var(--muted)"> (${n ?? "—"})</span>`;
    return statBox(label, a, disp, rs[avgKey]);
  };
  return `
    <div data-shot-detail>
      <div class="map-header" style="margin-top:14px">
        <div class="card-title" style="margin:0;font-size:11px;color:var(--muted)">Detalle de tiro — promedio (total temporada)</div>
        <span class="xm-host" data-xm-shot></span>
      </div>
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
        ${statBox("PPT",    av.ppt,    DEC2(av.ppt),    rs.ppt)}
        ${statBox("PPT 2",  av.ppt_2,  DEC2(av.ppt_2),  rs.ppt_2)}
        ${statBox("PPT 3",  av.ppt_3,  DEC2(av.ppt_3),  rs.ppt_3)}
        ${statBox("PPT TL", av.ppt_ft, DEC2(av.ppt_ft), rs.ppt_ft)}
      </div>
    </div>`;
}
// Parámetros de la selección activa del jugador: competencia, últimos N y contexto global
export const _playerParams = () => ({ competition: S._playerComp, last: S._playerLastN || null, ...contextParams() });
export async function renderPlayer(teamCode, playerName, playerId = null) {
  const main = document.getElementById("player-main");
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  const rq = S._routeQuery; S._routeQuery = null;
  S._playerComp = rq?.competition || null;   // sin competencia: la del partido más reciente del jugador (RF-6)
  S._playerLastN = Number(rq?.last) > 0 ? Number(rq.last) : 0;
  S._playerCtx  = { teamCode, playerName };
  const req = ++S._playerReq;

  try {
    const load = () => playerId != null ? api.playerById(playerId, _playerParams()) : api.player(teamCode, playerName, _playerParams());
    const data = await _loadDroppingInvalid(load);
    if (req !== S._playerReq) return false;
    _applyPlayerData(main, data);
    return true;
  } catch (e) {
    if (req === S._playerReq) main.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
    return false;
  }
}
export function _applyPlayerData(main, data) {
  S._playerData = data;
  S._playerComp = String(data.context.competition.id ?? "all");
  S._playerLastN = data.context.applied?.last || 0;
  S._playerCtx  = { teamCode: data.team_code, playerName: data.player };   // grafía de la ficha
  _renderPlayerContent(main, data);
  _drawTabs("player");
  applyTabs(document.getElementById("sec-player"), _tab.player);
  syncRoute();
  if (_tab.player === "similares") _renderSimilar();
  if (_tab.player === "tendencias") _renderTrends("player");
  if (_tab.player === "eventos") _renderEvents("player");
  if (_tab.player === "impacto") _renderImpactTab();
  // RF-1: la identidad se dibuja antes que cualquier card de métricas.
  if (data.player_id != null) {
    renderPlayerHeader(document.getElementById("player-identity"), data.player_id, {
      params: _playerParams(),
      afterRender: host => followButton(host.querySelector(".ph-follow"), { playerId: data.player_id, toast }),
      onSaved: () => toast("Ficha actualizada"),
    });
  }
  _mountCtxBar(main, S._playerComp, _reloadPlayer, data.team_code);   // nivel evento y posesión del jugador (T-03)
  mountContextHeader(document.getElementById("player-ctx-header"), {
    entity: "player", id: data.player_id, competition: S._playerComp, last: S._playerLastN, excludeTeam: data.team_code,
    onLast: n => { S._playerLastN = n; _reloadPlayer(); },
    onChange: () => _reloadPlayer(),
    onClear: () => { clearContext(); S._playerLastN = 0; _reloadPlayer(); },
  });
  _loadPlayerStandard(data.player_id);
  if (data.player_id != null) renderInsights(document.getElementById("player-insights"), "player", data.player_id, { params: _playerParams() });
  if (data.player_id != null) {
    renderOriginPanel(document.getElementById("player-origins"), data.player_id,
      { mode: "player", params: _playerParams() });
    renderTransitionPanel(document.getElementById("player-transition"), data.player_id,
      { mode: "player", params: _playerParams() });
    renderSecondChancePanel(document.getElementById("player-second-chance"), data.player_id,
      { mode: "player", params: _playerParams() });
    renderClockPanel(document.getElementById("player-clock"), data.player_id,
      { mode: "player", params: _playerParams() });
  }
}
export async function _loadPlayerStandard(playerId) {
  const el = document.getElementById("player-standard-panel");
  const main = document.getElementById("player-main");
  if (!el) return;
  const req = ++S._playerStdReq;
  renderStandardPanel(el, null, { layout: "grid", base: getBase() });
  const ctxQuery = _playerParams();
  try {
    await loadCatalog();
    const fichaStd = await api.metrics("player", { id: playerId, ...ctxQuery, base: "partido" });
    if (req !== S._playerStdReq) return;
    _fillFichaGrids(main, S._playerCardGroups, "player", fichaStd, playerId);
    const payload = getBase() === "partido"
      ? fichaStd
      : await api.metrics("player", { id: playerId, ...ctxQuery, base: getBase() });
    if (req !== S._playerStdReq) return;
    renderStandardPanel(el, payload, {
      layout: "grid",
      base: getBase(),
      onBaseChange: newBase => { setBase(newBase); _loadPlayerStandard(playerId); _loadPlayerGameLog(playerId); },
    });
    if (main) bindMetricCards(main, { entityType: "player", contextQuery: { ...ctxQuery, id: playerId } });
  } catch (e) {
    if (req !== S._playerStdReq) return;
    _fillFichaGrids(main, S._playerCardGroups, "player", null, playerId);
    renderStandardPanel(el, { error: e.message || "No se pudo cargar el conjunto estándar" }, { layout: "grid", base: getBase() });
  }
}
// Cambió la competencia: se pide el perfil de nuevo al servidor (no se recalcula en el navegador)
export async function _reloadPlayer() {
  if (!S._playerData) return;
  const main = document.getElementById("player-main");
  const id = S._playerData.player_id;
  const req = ++S._playerReq;
  main.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  let data;
  try {
    data = await api.playerById(id, _playerParams());
  } catch (e) {
    if (req !== S._playerReq) return;
    toast(e.message, "err");
    try {
      // competencia inexistente o sin publicar: volver a la por defecto; otro error: conservar la anterior
      data = /competencia/i.test(e.message) ? await api.playerById(id)
           : dropInvalid(e) ? await api.playerById(id, _playerParams()) : S._playerData;
    } catch (e2) {
      if (req === S._playerReq) main.innerHTML = `<p class="empty below-avg">${e2.message}</p>`;
      return;
    }
  }
  if (req === S._playerReq) _applyPlayerData(main, data);
}
export function _renderPlayerContent(main, data) {
  const { teamCode, playerName } = S._playerCtx;
  const log  = data.game_log;
  const av   = { ...data.averages, null_reasons: data.null_reasons };
  const rs   = av.null_reasons;   // razón de cada nulo (C-11 RF-4)
  // Promedio de liga de la COMPETENCIA elegida, calculado por el servidor (C-02 RF-1)
  const lg   = data.league;
  const comps = data.competitions;
  const radarOk = lg?.oer?.avg != null;

  {
    const PLAYER_CARD_GROUPS = [
      { title: "Producción ofensiva", metrics: [
        ["OER", "oer", av.oer, DEC2(av.oer)], ["USO%", "uso_pct", av.uso_pct, PCT(av.uso_pct)],
        ["PPP", "ppp", av.ppp, DEC2(av.ppp)], ["PPT", "ppt", av.ppt, DEC2(av.ppt)],
        ["eFG%", "efg_pct", av.efg_pct, PCT(av.efg_pct)], ["TS%", "ts_pct", av.ts_pct, PCT(av.ts_pct)],
        ["FT Rate", "ft_rate", av.ft_rate, DEC2(av.ft_rate)] ] },
      { title: "Por posesión y por minuto", metrics: [
        [_hint("AS/pos", "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)"), "as_pos", av.as_pos, DEC2(av.as_pos)],
        [_hint("PER/pos", "Pérdidas por posesión propia (PER = pérdidas)"), "tov_pos", av.tov_pos, DEC2(av.tov_pos)],
        [_hint("PTS/pos", "Puntos por posesión propia (igual al OER del jugador)"), "pts_pos", av.pts_pos, DEC2(av.pts_pos)],
        [_hint("RO/min", "Rebotes ofensivos por minuto disputado"), "orb_min", av.orb_min, DEC2(av.orb_min)],
        [_hint("RD/min", "Rebotes defensivos por minuto disputado"), "drb_min", av.drb_min, DEC2(av.drb_min)] ] },
      { title: "Tiro", extra: _shotDetailGrid(av, data.totals), metrics: [
        ["FG2%", "fg2_pct", av.fg2_pct, PCT(av.fg2_pct)], ["FG3%", "fg3_pct", av.fg3_pct, PCT(av.fg3_pct)],
        ["FT%", "ft_pct", av.ft_pct, PCT(av.ft_pct)],
        [_hint("Uso 2P", _USO_HINT), "fg2_uso", av.fg2_uso, PCT(av.fg2_uso)],
        [_hint("Uso 3P", _USO_HINT), "fg3_uso", av.fg3_uso, PCT(av.fg3_uso)],
        [_hint("Uso TL", _USO_HINT), "ft_uso", av.ft_uso, PCT(av.ft_uso)] ] },
      { title: "Rebotes & distribución", trailing: _astPerBox(av, data.totals), metrics: [
        [_hint("OR%", "Porción de los rebotes ofensivos disponibles que capturó mientras estuvo en cancha, " + _PCT_REB_HINT.replace("%s", "OR%")), "or_pct", av.or_pct, PCT(av.or_pct)],
        [_hint("DR%", "Porción de los rebotes defensivos disponibles que capturó mientras estuvo en cancha, " + _PCT_REB_HINT.replace("%s", "DR%")), "dr_pct", av.dr_pct, PCT(av.dr_pct)],
        ["TO", "tov", av.tov, DEC2(av.tov)], ["AS", "ast", av.ast, DEC2(av.ast)],
        ["% Reb Equipo", "reb_share", av.reb_share, PCT(av.reb_share)],
        ["% RebOf Equipo", "oreb_share", av.oreb_share, PCT(av.oreb_share)],
        ["% RebDef Equipo", "dreb_share", av.dreb_share, PCT(av.dreb_share)] ] },
      { title: "Creación de juego", trailing: _creationNote(data.standard), metrics: [
        [_hint("AS/pos", "Asistencias por posesión propia (posesión = T2i + T3i + 0,44 × TLi + PER − RO)"),
         "as_pos", av.as_pos, DEC2(av.as_pos)],
        [_hint("% asistencias del equipo", "Asistencias del jugador sobre las del equipo en los partidos que disputó"),
         "ast_team_share", null, "—"],
        [_hint("Puntos generados", "2 × asistencias a tiros de 2 + 3 × asistencias a tiros de 3. Los tiros libres no suman: no se sabe cuántos de la serie entraron"),
         "ast_points", null, "—"],
        [_hint("Puntos por asistencia", "Puntos generados dividido por las asistencias a tiros de campo"),
         "pts_per_ast", null, "—"],
        [_hint("Segundos de posesión", "Duración media de las posesiones que terminó el jugador"),
         "player_poss_duration", null, "—"] ] },
      { title: "Defensa avanzada", metrics: [
        ["Robos", "stl", av.stl, DEC2(av.stl)], ["Tapones", "blk", av.blk, DEC2(av.blk)],
        ["Stops", "stocks", av.stocks, DEC2(av.stocks)],
        ["Def Playmaking", "def_playmaking", av.def_playmaking, DEC2(av.def_playmaking)],
        ["DEF/TO Ratio", "def_to_ratio", av.def_to_ratio, DEC2(av.def_to_ratio)],
        ["Impacto Físico", "physical_impact", av.physical_impact, DEC2(av.physical_impact)] ] },
    ];
    S._playerCardGroups = PLAYER_CARD_GROUPS;
    main.innerHTML = `
      <div id="player-identity"></div>
      ${comps.length > 1 ? `
      <div class="card">
        <select id="player-comp" class="map-select">${_compOptions(comps, S._playerComp, "Todas las competencias", "all")}</select>
      </div>` : ""}
      ${_selectionNote(data, ["jugador", "jugadores"])}
      ${PLAYER_CARD_GROUPS.map((g, i) => `
      <div class="card" data-tabs="resumen">
        <div class="card-title">${g.title}</div>
        <div class="stat-grid metric-card-grid" data-mc-group="${i}">${_fichaGridHTML(g.metrics, "player", null, data.player_id)}</div>
        ${g.trailing ? `<div class="stat-grid">${g.trailing}</div>` : ""}
        ${g.extra || ""}
      </div>`).join("")}
      <div class="chart-grid" data-tabs="resumen">
        <div class="card">
          <div class="card-title">Perfil de jugador</div>
          ${radarOk ? '<div class="radar-wrap"><canvas id="chart-player-radar"></canvas></div>'
                    : `<p class="empty">${_radarMsg(data)}</p>`}
        </div>
        <div id="player-evo-compact"></div>
      </div>
      <div class="card" data-tabs="resumen" id="player-standard-card">
        <div class="card-title">Conjunto estándar</div>
        <div id="player-standard-panel"></div>
      </div>
      <div id="player-origins" data-tabs="posesion"></div>
      <div id="player-transition" data-tabs="posesion"></div>
      <div id="player-second-chance" data-tabs="posesion"></div>
      <div id="player-clock" data-tabs="posesion"></div>
      <div class="card" data-tabs="gamelog">
        <div class="card-title">Game log — ${playerName}</div>
        <div id="player-gamelog-dt"></div>
      </div>`;
    if (radarOk) drawRadar("chart-player-radar", av, lg, playerName);
    _renderCompactTrends("player");
    _makeCollapsible(main.querySelector("#player-standard-card"), "jugador-estandar", true);
    _loadPlayerGameLog(data.player_id);
    _mountShotDetailExports(main, playerName, String(data.player_id ?? ""), _playerCompLabel());

    if (comps.length > 1) {
      document.getElementById("player-comp").addEventListener("change", e => {
        S._playerComp = e.target.value;
        _rememberCompetition(S._playerComp);
        _reloadPlayer();
      });
    }

    // Shot chart — async, non-blocking (C-03: usa api.shotZones + shotChart)
    api.shotZones({ entity: 'player', id: data.player_id, competition: S._playerComp, last: S._playerLastN || null, ...contextParams() }).then(shots => {
      const shotCard = document.createElement("div");
      shotCard.className = "card";
      shotCard.dataset.tabs = "tiro";
      if (!shots || !shots.summary?.total_shots) {
        shotCard.innerHTML = _noShots("Sin tiros registrados para este jugador.");
        main.insertBefore(shotCard, main.querySelector(".chart-grid"));
        return;
      }
      shotCard.innerHTML = `
        <div class="card-title">Shot chart por zonas <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— ${playerName}</span></div>
        ${shotChart(shots)}${_shotNote(shots)}`;
      main.insertBefore(shotCard, main.querySelector(".chart-grid"));
      bindZoneTooltips(shotCard, shots);
    }).catch(() => {});
  }
}
// Game log de jugador migrado a createDataTable (player_game_log). Respeta competencia
// y base elegida (T-D8); los DNP vienen como filas con métricas nulas razón `dnp`.
export function _loadPlayerGameLog(playerId) {
  const el = document.getElementById("player-gamelog-dt");
  if (!el || playerId == null) return;
  const compParam = (S._playerComp && S._playerComp !== "all") ? S._playerComp : null;
  mountTable(el,
    () => api.table("player_game_log", { player_id: playerId, competition: compParam, last: S._playerLastN || null, ...contextParams(), base: getBase() }),
    { tableId: "player_game_log", onRowClick: row => showGame(row.id) });   // la fila abre Analizar partido (F-07 CA-3)
}
export function _playerCompLabel() {
  const sel = document.getElementById("player-comp");
  if (sel && sel.selectedOptions[0] && S._playerComp !== "all") return sel.selectedOptions[0].textContent;
  return "";
}
