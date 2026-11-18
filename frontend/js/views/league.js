// Vista league (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { _drawTabs, _tab, setSection, syncRoute } from "../app.js";
import { drawLeagueScatter, resetZoom } from "../charts.js";
import { contextNote, mountContextBar } from "../components/context-bar.js";
import { mountTable } from "../components/data-table.js";
import { renderCompetitionProfile, renderLeaders } from "../components/leaders-panel.js";
import { applyTabs } from "../components/tabs.js";
import { activeCount, clearContext, contextParams } from "../core/context.js";
import { getPref } from "../core/prefs.js";
import { S } from "../state.js";
import { _openPlayerById } from "./player.js";
import { _compOptions, _makeCollapsible, _rememberCompetition } from "./shared.js";
import { renderTeam } from "./team.js";

// Líderes y perfil de la competencia (F-14): se piden al abrir la pestaña y al cambiar la competencia o los filtros.
export function _leagueParams() { return { competition: S._leagueComp, ...contextParams() }; }
export function _renderLeagueExtras() {
  if (_tab.league === "lideres") {
    renderLeaders(document.getElementById("league-leaders"), {
      params: _leagueParams(), metric: S._leaders.metric, minMinutes: S._leaders.min,
      onChange: ({ metric, minMinutes }) => { S._leaders = { metric, min: minMinutes }; syncRoute(); _renderLeagueExtras(); },
      onOpenPlayer: _openPlayerById,
    });
  } else if (_tab.league === "perfil") {
    renderCompetitionProfile(document.getElementById("league-profile"), { params: _leagueParams() });
  }
}
// Scatter map presets — each defines the X/Y axes for el mapa de liga.
// Cada eje declara la dirección de su métrica (`higher` | `lower` | `neutral`) y el título se arma
// con `_mapAxis`: nunca escribir la flecha a mano (C-10). `xLabel`/`yLabel` = nombre largo del
// título si difiere del corto (`xName`/`yName`, usado en tooltip y línea de promedio).
export const LEAGUE_MAPS = [
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
  {
    id: "uso3", label: "Uso de 3P / eFG%",
    axis: { xKey: "fg3_uso", xName: "Uso 3P", xLabel: "Uso de triple (% de las jugadas de tiro)", xDir: "higher", xQual: "más triples", xPct: true,
            yKey: "efg_pct", yName: "eFG%", yDir: "higher", yQual: "mejor tiro", yPct: true },
    hint: "Derecha = tira más triples &nbsp;|&nbsp; Arriba = mejor eFG% &nbsp;|&nbsp; Arriba-derecha = muchos triples y los convierte",
  },
  {
    id: "uso2", label: "Uso de 2P / Uso de TL",
    axis: { xKey: "fg2_uso", xName: "Uso 2P", xLabel: "Uso de 2 (% de las jugadas de tiro)", xDir: "higher", xQual: "más dobles", xPct: true,
            yKey: "ft_uso", yName: "Uso TL", yLabel: "Uso de tiros libres (% de las jugadas de tiro)", yDir: "higher", yQual: "más libres", yPct: true },
    hint: "Derecha = ataca más con tiros de 2 &nbsp;|&nbsp; Arriba = pesan más los tiros libres &nbsp;|&nbsp; Arriba-derecha = ataca el aro y llega a la línea",
  },
];
// Flecha hacia el lado de la pantalla donde está el mejor rendimiento. El eje Y no está invertido
// (`reverse: false` en drawLeagueScatter): los valores crecen hacia arriba.
export const AXIS_ARROWS = { x: { higher: "→", lower: "←" }, y: { higher: "↑", lower: "↓" } };
export function _axisTitle(name, dir, orient, qual) {
  const arrow = AXIS_ARROWS[orient][dir];
  return arrow ? `${name}  (${arrow} ${qual})` : name;   // métrica neutral: sin flecha de "mejor"
}
export function _mapAxis(a) {
  return {
    ...a,
    xTitle: _axisTitle(a.xLabel || a.xName, a.xDir, "x", a.xQual),
    yTitle: _axisTitle(a.yLabel || a.yName, a.yDir, "y", a.yQual),
    xAvgLabel: `Prom. ${a.xName}`,
    yAvgLabel: `Prom. ${a.yName}`,
  };
}
export function _drawLeagueMap() {
  const map = LEAGUE_MAPS.find(m => m.id === S._leagueMap) || LEAGUE_MAPS[0];
  const hintEl = document.getElementById("map-hint");
  if (hintEl) {
    hintEl.innerHTML = `${map.hint}
      &nbsp;&nbsp;·&nbsp;&nbsp;
      <span style="color:var(--muted)">🖱 rueda = zoom &nbsp;·&nbsp; arrastrar = mover &nbsp;·&nbsp; pellizcar = zoom táctil</span>`;
  }
  const axis = _mapAxis(map.axis);
  const avg = S._leagueSummary?.avg;
  if (avg) {
    if (avg[axis.xKey] != null) axis.avgX = avg[axis.xKey];
    if (avg[axis.yKey] != null) axis.avgY = avg[axis.yKey];
  }
  drawLeagueScatter("chart-scatter", S._leagueTeams, axis);
}
// T-06: abre el equipo al hacer clic en una fila del ranking (conserva el comportamiento previo).
export function _openTeamFromRow(row) {
  const code = String(row.id ?? "").split(":").pop() || row.id;
  const sel = document.getElementById("team-select");
  if (sel) sel.value = code;
  _tab.team = "resumen";
  setSection("team", { sync: false });
  renderTeam(code);
}
export async function renderLeague() {
  const sec = document.getElementById("sec-league");
  sec.innerHTML = '<p class="empty"><span class="spinner"></span>Cargando...</p>';
  try {
    const comps = await api.competitions().catch(() => []);
    // Sin competencia en la dirección: la última que eligió el usuario (T-03 RF-20) si sigue vigente; si no, la
    // competencia por defecto (RF-12). "Todas" solo si el usuario la eligió.
    if (S._leagueComp == null) {
      const last = getPref("ui", "last_competition", null);
      if (last === "all" || comps.some(c => String(c.id) === String(last))) S._leagueComp = last == null ? null : String(last);
    }
    if (S._leagueComp !== "all" && !comps.some(c => String(c.id) === String(S._leagueComp))) {
      const def = comps.find(c => c.is_default);
      S._leagueComp = def ? String(def.id) : null;
    }
    // El mapa de liga sigue con /api/league (no migra, T-D7).
    const res = await api.league(S._leagueComp, { summary: true, ...contextParams() });
    S._leagueTeams = res.teams || [];
    S._leagueSummary = { avg: res.avg || {}, leaders: res.leaders || {}, population: res.population || null };
    if (!S._leagueTeams.length) {
      sec.innerHTML = activeCount() > 0
        ? '<div id="league-ctx-bar" class="ctx-bar-host"></div><p class="empty">No hay partidos que cumplan estos filtros. <button type="button" class="btn btn-ghost btn-sm" id="league-clear">Limpiar filtros</button></p>'
        : '<p class="empty">Sin datos. Importa partidos primero.</p>';
      if (activeCount() > 0) {
        mountContextBar(document.getElementById("league-ctx-bar"), { competition: S._leagueComp, events: true, onChange: () => renderLeague() });
        document.getElementById("league-clear").addEventListener("click", () => { clearContext(); renderLeague(); });
      }
      return;
    }

    const compSelHTML = comps.length > 1
      ? `<select id="league-comp" class="map-select">${_compOptions(comps, S._leagueComp, "Todas las competencias", "all")}</select>`
      : "";
    sec.innerHTML = `
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Tabla general</div>
          ${compSelHTML}
        </div>
        <p class="td-muted">Solo partidos importados, no el fixture completo.</p>
        <div id="league-standings-dt"></div>
      </div>
      <div class="card">
        <div class="map-header">
          <div class="card-title" style="margin:0">Ranking de equipos — Liga</div>
        </div>
        <div id="league-ranking-dt"></div>
      </div>`;

    // Parámetros de tabla: "all" (todas) se envía como sin competencia.
    const compParam = (S._leagueComp && S._leagueComp !== "all") ? S._leagueComp : null;

    // Tabla general (league_standings): el backend responde 400 con el mensaje de C-09
    // cuando hay varias competencias y no se eligió una.
    const standEl = document.getElementById("league-standings-dt");
    mountTable(standEl, () => api.table("league_standings", { competition: compParam, ...contextParams() }), {
      tableId: "league_standings",
      onRowClick: _openTeamFromRow,
    });

    // Ranking (league_teams): clic de fila → abre el equipo.
    const rankEl = document.getElementById("league-ranking-dt");
    mountTable(rankEl, () => api.table("league_teams", { competition: compParam, ...contextParams() }), {
      tableId: "league_teams",
      onRowClick: _openTeamFromRow,
    });

    const compSel = document.getElementById("league-comp");
    if (compSel) compSel.addEventListener("change", e => { S._leagueComp = e.target.value; _rememberCompetition(S._leagueComp); renderLeague(); });
    _makeCollapsible(sec.children[0], "liga-tabla");
    _makeCollapsible(sec.children[1], "liga-ranking");

    if (S._leagueTeams.length >= 2) {
      const mapOpts = LEAGUE_MAPS.map(m =>
        `<option value="${m.id}" ${m.id === S._leagueMap ? "selected" : ""}>${m.label}</option>`
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
      _makeCollapsible(sec.lastElementChild, "liga-mapa");
      sec.lastElementChild.dataset.tabs = "mapa";
      _drawLeagueMap();
      document.getElementById("map-select").addEventListener("change", e => {
        S._leagueMap = e.target.value;
        _drawLeagueMap();
      });
      document.getElementById("btn-reset-scatter").addEventListener("click", () => resetZoom("chart-scatter"));
    }
    // Cierres se movieron a la vista Equipo (Feature 05 v2).
    sec.children[0].dataset.tabs = "tabla";
    sec.children[1].dataset.tabs = "ranking";
    sec.insertAdjacentHTML("beforeend", '<div id="league-leaders" data-tabs="lideres"></div><div id="league-profile" data-tabs="perfil"></div>');
    const lgNote = res.context && res.context.level !== "partido"
      ? `${contextNote(res.context)}<p class="td-muted ctx-note">La tabla general (récord y puntos) es siempre del partido completo; los filtros recortan las métricas.</p>` : "";
    sec.insertAdjacentHTML("afterbegin", `<div id="league-ctx-bar" class="ctx-bar-host"></div>${lgNote}<div id="league-tabs" class="tabs-host"></div>`);
    mountContextBar(document.getElementById("league-ctx-bar"), { competition: S._leagueComp, events: true, onChange: () => renderLeague() });
    _drawTabs("league");
    applyTabs(sec, _tab.league);
    syncRoute();
    _renderLeagueExtras();
  } catch (e) {
    sec.innerHTML = `<p class="empty below-avg">${e.message}</p>`;
  }
}
