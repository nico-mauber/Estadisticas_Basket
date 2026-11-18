// Vista panels (X-01: extraída de app.js sin cambios de comportamiento).
import { setSection, setTab, syncRoute } from "../app.js";
import { renderEvents } from "../components/events-panel.js";
import { renderGameView } from "../components/game-view.js";
import { destroyLiveView, renderLiveView } from "../components/live-view.js";
import { renderMyTeam } from "../components/my-team.js";
import { renderPrepare } from "../components/prepare-report.js";
import { renderTrends } from "../components/trends-panel.js";
import { getBase } from "../core/base.js";
import { buildHash, writeRoute } from "../core/router.js";
import { S } from "../state.js";
import { _playerParams } from "./player.js";
import { toast } from "./shared.js";
import { _teamParams } from "./team.js";

// Evolución y tendencias (F-18): el mismo componente para equipo (Game log) y jugador (Tendencias).
export function _renderTrends(section) {
  const id = section === "team" ? S._teamData?.team_code : S._playerData?.player_id;
  if (id == null) return;
  const st = S._trendsState[section];
  renderTrends(document.getElementById(`${section}-trends`), section, id, {
    params: section === "team" ? _teamParams() : _playerParams(), base: getBase(), ...st,
    entityName: section === "team" ? S._teamData?.team_name : S._playerData?.player,
    onChange: s => { S._trendsState[section] = { metrics: s.metrics, ma: s.ma, lastN: s.lastN }; _renderTrends(section); },
  });
}
// Evolución por partido del Resumen (F-18): el mismo componente en modo compacto (reemplaza los gráficos fijos de OER/eFG%).
export function _renderCompactTrends(section) {
  const id = section === "team" ? S._teamData?.team_code : S._playerData?.player_id;
  if (id == null) return;
  renderTrends(document.getElementById(`${section}-evo-compact`), section, id, {
    compact: true, params: section === "team" ? _teamParams() : _playerParams(), base: getBase(),
    onMore: () => setTab(section, section === "team" ? "gamelog" : "tendencias"),
  });
}
// Producción desde eventos (A-07): pestaña Eventos de Equipo y de Jugador.
export function _renderEvents(section) {
  const id = section === "team" ? S._teamData?.team_code : S._playerData?.player_id;
  if (id == null) return;
  renderEvents(document.getElementById(`${section}-events`), section, id, { params: section === "team" ? _teamParams() : _playerParams() });
}
// Abre Preparar con el cruce ya elegido (F-20; desde el calendario y Mi equipo, F-12). La dirección lleva el cruce.
export function showPrepare(team, rival, focus = null, fixture = null) {
  setSection("preparar", { sync: false });
  writeRoute({ section: "preparar", id: null, tab: null }, { team, rival, fixture, competition: null, last: null });
  renderPrepare(document.getElementById("preparar-main"), { onOpenGame: showGame, team, rival, focus });
}
// Mi equipo (F-12, S8).
export function renderMyTeamView() {
  renderMyTeam(document.getElementById("myteam-main"), {
    toast, onPrepare: (team, rival, fixture) => showPrepare(team, rival, null, fixture),
  });
}
// ── F-07: Analizar partido ──────────────────────────────────────────────────
// `#/partido/<id>/<pestaña>` (CA-3): "analizar" abre el Resumen; recargar reproduce la misma pestaña.
export function showGame(gameId, tab = null) {
  destroyLiveView();
  S._gameId = String(gameId);
  S._gameTab = tab && tab !== "analizar" ? tab : null;
  setSection("partido");
  renderGameView(document.getElementById("partido-main"), gameId, {
    tab: S._gameTab,
    onTab: t => { S._gameTab = t === "resumen" ? null : t; syncRoute(); },
    onOpenPlayer: id => { location.hash = buildHash({ section: "player", id }); },
  });
}
// ── F-01: Partido en vivo ──────────────────────────────────────────────────
export function showLiveGame(gameId, url = null) {
  S._gameId = null;
  setSection("partido");
  renderLiveView(document.getElementById("partido-main"), gameId, { url });
}
// URL de FIBA LiveStats (…/u/LIGA/<id>/bs.html) o id numérico suelto.
export function _liveTarget(input) {
  const s = input.trim();
  if (/^\d{5,}$/.test(s)) return { id: s, url: null };
  const m = /\/(\d{5,})\//.exec(s);
  return m ? { id: m[1], url: s } : null;
}
