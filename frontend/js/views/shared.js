// Vista shared (X-01: extraída de app.js sin cambios de comportamiento).
import { api } from "../api.js";
import { makeCollapsible } from "../components/collapsible.js";
import { contextNote, mountContextBar } from "../components/context-bar.js";
import { exportMenu } from "../components/export-menu.js";
import { tableToData } from "../components/exporters.js";
import { metricCard } from "../components/metric-card.js";
import { stdKeyFor } from "../core/catalog.js";
import { activeCount, clearContext } from "../core/context.js";
import { DEC2, PCT, PCT0, isNull, nullDisplay } from "../core/format.js";
import { setPref } from "../core/prefs.js";
import { S } from "../state.js";

// ── Toast ──────────────────────────────────────────────────────────────────
export function toast(msg, type = "ok") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}
// ── Stat helpers ───────────────────────────────────────────────────────────
// PCT/DEC1/DEC2 y la regla de nulos viven en core/format.js (C-11).

// Comparador null-safe `cmpNullsLast` vive ahora en core/format.js (T-06 T-D1).

// `reason`: código de `null_reasons` del backend; si `value` es nulo se muestra "—" con
// esa razón en el title, sea cual sea `display` (C-11 RF-4). El bloque "Ø liga" se retiró
// con T-01: Equipo y Jugador usan la ficha de métrica (metricCard); los pocos usos
// restantes (detalle de tiro, AS/PER) muestran solo el valor.
export function statBox(label, value, display, reason = null) {
  return `
    <div class="stat-box">
      <div class="stat-label">${label}</div>
      <div class="stat-value neutral">${isNull(value) ? nullDisplay(reason) : display}</div>
    </div>`;
}
// ── Ficha de métrica en grillas de Equipo/Jugador (T-01) ─────────────────────
// `metrics`: [[label, claveLegada|canónica, valorPromedio, displayRespaldo, reason?]].
// Con `std` (respuesta de /api/metrics) se dibuja la ficha completa (metricCard);
// sin `std` (o si la métrica no está en el conjunto estándar) se muestra solo el valor.
export function _fichaGridHTML(metrics, entityType, std, entityId) {
  return metrics.map(([label, clave, value, display, reason]) => {
    const stdKey = stdKeyFor(clave) || clave;
    const mObj = std?.metrics?.[stdKey];
    if (std && mObj) {
      return metricCard(stdKey, mObj, { entityType, label, id: entityId, minSize: std.population?.min_size });
    }
    return statBox(label, value, display, reason);
  }).join("");
}
// Nota al pie de "Creación de juego": cuántas asistencias tienen vínculo y qué pasa con los libres.
export function _creationNote(std) {
  const pts = std?.metrics?.ast_points;
  if (!pts) return "";
  if (pts.value == null && pts.reason === "no_registrado") {
    return '<p class="td-muted assist-note">Los partidos de esta selección se importaron sin el vínculo de las asistencias. Reprocesalos para ver los puntos generados.</p>';
  }
  if (pts.value == null && pts.reason === "sin_pbp") {
    return '<p class="td-muted assist-note">Sin play-by-play: no se puede saber qué tiro convirtió cada asistencia.</p>';
  }
  return '<p class="td-muted assist-note">Los puntos generados cuentan solo las asistencias a tiros de campo: en un tiro libre no se sabe cuántos de la serie entraron.</p>';
}
// Etiqueta con su definición al pasar el cursor / tocar (C-01): `statBox` inserta el label como HTML.
// Uso de 2P / 3P / TL: los tres suman 100 % (mismo denominador)
export const _USO_HINT = "Reparto de las jugadas de tiro: TC2i, TC3i y 0,44 × TLi sobre (TCi + 0,44 × TLi). Uso 2P + Uso 3P + Uso TL = 100 %";
export const _hint = (label, text) => `<span title="${esc(text)}">${label}</span>`;
export const _PCT_REB_HINT = "estimado por minutos mientras estuvo en cancha. No es comparable con el %s de equipo.";
// Totales que respaldan un cociente: " (43/29)" bajo el valor (C-04). Vacío si falta alguno.
export const _ratioSub = (a, b) => a == null || b == null ? ""
  : `<span style="font-size:9px;color:var(--muted)"> (${a}/${b})</span>`;
// Caja de AS/PER (asistencias sobre pérdidas acumuladas de la selección). PER = pérdidas.
export function _astPerBox(av, totals) {
  const label = '<span title="Asistencias sobre pérdidas, acumulado de la selección (PER = pérdidas)">AS/PER</span>';
  return statBox(label, av.ast_to, DEC2(av.ast_to) + _ratioSub(totals?.ast, totals?.tov),
                 av.null_reasons?.ast_to);
}
// ── Filtro por competencia (compartido: Liga/Equipo/Comparar/Jugador) ────────
// Por id de competencia (F-11): el texto de FIBA puede renombrarse o fusionarse. `comps` = [{id, label}]
// (de /api/competitions o del campo `competitions` del perfil). El navegador NO recalcula promedios al
// filtrar: pide el perfil al servidor con `competition`/`last` (C-02 RF-5, Constitución regla 4).
// `allValue`: valor de la opción "Todas las competencias": "all" en las vistas con promedio de liga (el
// servidor no calcula `Ø` sin una competencia, RF-7); "" en el catálogo de Datos y en Buscar.
export function _compOptions(comps, selected = "", allLabel = "Todas las competencias", allValue = "") {
  return `<option value="${allValue}"${String(selected) === allValue ? " selected" : ""}>${allLabel}</option>` +
    comps.map(c => `<option value="${c.id}"${String(c.id) === String(selected) ? " selected" : ""}>${esc(c.label)}</option>`).join("");
}
// Aviso bajo los selectores: de qué población sale el `Ø` y, si la selección no tiene partidos, un
// estado vacío (C-02 RF-13). `kind`: [singular, plural] de la entidad de la población.
export function _refLegend(data, kind) {
  const c = data.context, m = data.league_meta;
  return c.competition.id == null
    ? "Ø no disponible: elegí una competencia para ver el promedio de liga."
    : `Ø = promedio de ${m.size} ${m.size === 1 ? kind[0] : kind[1]} de ${esc(c.competition.label)}.`;
}
export function _selectionNote(data, kind) {
  const filtered = activeCount() > 0;
  const empty = data.games === 0
    ? (filtered
      ? '<p class="empty">No hay partidos que cumplan estos filtros. <button type="button" class="btn btn-ghost btn-sm ctx-empty-clear">Limpiar filtros</button></p>'
      : '<p class="empty">Sin partidos en esta competencia</p>')
    : "";
  return `<div class="ctx-bar-host"></div>${contextNote(data.context)}<p class="td-muted" style="margin:0 0 8px">${_refLegend(data, kind)}</p>${empty}`;
}
// Monta la barra de contexto (T-03) y el botón de la selección vacía dentro de `main`; `reload` recarga la vista.
export function _mountCtxBar(main, competition, reload, teamCode = null) {
  mountContextBar(main.querySelector(".ctx-bar-host"), { competition, teamCode, onChange: reload });
  main.querySelector(".ctx-empty-clear")?.addEventListener("click", () => { clearContext(); reload(); });
}
// Radar sin promedio de liga (`Ø` nulo): no hay contra qué escalar.
export const _radarMsg = data => data.context.competition.id == null
  ? "El radar compara contra el promedio de una competencia: elegí una."
  : "Sin datos de la competencia para armar el radar.";
// Escapa texto para insertarlo en HTML (nombres editables por el usuario, p. ej. competencias).
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// ── Exportación de tablas no migradas (T-D10) ────────────────────────────────
// Lee el <table> ya renderizado con tableToData y monta el menú de exportación.
// `meta` mínima: título, entidad, competencia del filtro activo, fecha.
export function _baseMeta({ title, section, entity, competitionLabel, entitySlug }) {
  const slug = s => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const compLabel = competitionLabel || "todas";
  const ent = entitySlug || (entity ? slug(entity) : "liga");
  return {
    title,
    section: section || slug(title),
    entity: { type: "team", id: "", name: entity || "" },
    competition: { id: null, label: competitionLabel || "", season: "" },
    filters: [],
    base: null,
    sort: null,
    columns_visible: null,
    generated_at: new Date().toISOString(),
    generated_by: S._authUser || "_open",
    app_version: "smart-basket-v23",
    file_name: `${slug(section || title)}_${ent}_${slug(compLabel)}_${today}`,
  };
}
// Exportación de un panel estándar (ON/OFF compare, combinación grid): no hay un único
// <table>. Serializa la primera tabla con encabezado si existe, o las parejas de stat-box.
export function _mountPanelExport(hostEl, panelFn, meta) {
  if (!hostEl) return;
  exportMenu(hostEl, {
    getData: () => {
      const panel = typeof panelFn === "function" ? panelFn() : panelFn;
      if (panel) {
        const tables = [...panel.querySelectorAll("table")];
        if (tables.length) {
          // ON/OFF: una tabla por grupo con el mismo encabezado; se unifican las filas.
          const first = tableToData(tables[0], meta);
          const rows = [];
          for (const t of tables) rows.push(...tableToData(t, meta).rows);
          return { meta, columns: first.columns, rows, footer: [], pageInfo: `${rows.length} filas` };
        }
        const boxes = [...panel.querySelectorAll(".stat-box")];
        if (boxes.length) {
          const columns = [{ key: "metrica", label: "Métrica", fmt: "text" }, { key: "valor", label: "Valor", fmt: "text" }];
          const rows = boxes.map(b => [b.querySelector(".stat-label")?.textContent.trim() || "", b.querySelector(".stat-value, .mc-value")?.textContent.trim() || ""]);
          return { meta, columns, rows, footer: [], pageInfo: `${rows.length} filas` };
        }
      }
      return { meta, columns: [], rows: [], footer: [], pageInfo: "Sin filas" };
    },
    getNode: () => (typeof panelFn === "function" ? panelFn() : panelFn) || hostEl,
  });
}
// Monta un botón "Exportar" en `hostEl` que serializa el <table> dentro de `tableElOrFn`.
export function _mountTableExport(hostEl, tableElOrFn, meta) {
  if (!hostEl) return;
  exportMenu(hostEl, {
    getData: () => {
      const tableEl = typeof tableElOrFn === "function" ? tableElOrFn() : tableElOrFn;
      const d = tableEl ? tableToData(tableEl, meta) : { meta, columns: [], rows: [], footer: [] };
      return { ...d, meta, pageInfo: `${d.rows.length} fila${d.rows.length === 1 ? "" : "s"}` };
    },
    getNode: () => {
      const tableEl = typeof tableElOrFn === "function" ? tableElOrFn() : tableElOrFn;
      return tableEl ? (tableEl.closest(".table-wrap") || tableEl) : hostEl;
    },
  });
}
// ── Four Factors card ──────────────────────────────────────────────────────
export function _fourFactorsCard(av, teamName) {
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
      <div class="map-header">
        <div class="card-title" style="margin:0">Four Factors <span style="color:var(--muted2);font-weight:400;text-transform:none;letter-spacing:0">— <span class="notranslate">${teamName}</span> <span>vs Rival</span></span></div>
        <span class="xm-host" data-xm="four-factors"></span>
      </div>
      <div class="table-wrap">
        <table id="four-factors-table" style="font-size:13px">
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
export function _recordCard(record, teamName) {
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
export async function refreshTeamSelector() {
  const teamSel = document.getElementById("team-select");
  if (!teamSel) return;
  const current = teamSel.value;
  const teams = await api.teams().catch(() => []);
  teamSel.innerHTML = '<option value="">— Seleccionar equipo —</option>' +
    teams.map(t => `<option value="${t.code}">${t.name} (${t.games}p)</option>`).join("");
  if (current) teamSel.value = current;
}
export async function refreshCompareSelectors() {
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
    // por defecto, la competencia por defecto (C-02 RF-6); "Todas" solo si el usuario la eligió
    const defaultId = comps.find(c => c.is_default)?.id ?? "";
    const keep = comps.length > 1 ? compSel.value : "";
    compSel.innerHTML = _compOptions(comps, keep || defaultId, "Todas las competencias", "all");
  }
}
// Tablas y gráficos desplegables: el título lleva un botón ▾ y el resto de la card se oculta o muestra. El estado
// se recuerda por título mientras dura la sesión.
// Panel plegable (X-01 CA-14): ver `components/collapsible.js` (estado por usuario en `panel.collapsed`).
export function _makeCollapsible(card, key, defaultOpen = true) {
  makeCollapsible(card, key, { defaultOpen });
}
// Última competencia elegida por el usuario (T-03 RF-20): la usa Liga cuando la dirección no trae una.
export function _rememberCompetition(comp) {
  if (comp) setPref("ui", "last_competition", String(comp)).catch(() => {});
}
