// Sinergias (A-08): quién asiste a quién (matriz), rankings de triples y de puntos tras asistencia, parejas con ajuste de muestra y
// jugadores que potencian a sus compañeros. `renderSynergy` va en Equipo › Quintetos; `renderImpact` en Jugador › Impacto.
import { api } from "../api.js";
import { fmtNumber, fmtSigned, nullDisplay, PCT } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { exportMenu } from "./export-menu.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0, _tokenP = 0;
const num = (m, f = v => fmtNumber(v, 2)) => (m && m.value != null ? f(m.value) : nullDisplay(m?.reason));

function _err(e) {
  return e instanceof TypeError || navigator.onLine === false ? "Sin conexión: las sinergias necesitan conexión."
    : e.status >= 500 ? "No se pudieron calcular las sinergias." : e.message;
}

function _matrix(d) {
  const m = d.assist_matrix;
  if (!m.total && !m.unlinked) return '<p class="empty">El equipo no registra asistencias en la selección.</p>';
  const cell = {};
  m.cells.forEach(c => { cell[`${c.assister}|${c.scorer}`] = c; });
  const max = Math.max(1, ...m.cells.map(c => c.count));
  const head = `<tr><th class="cx-corner">Asiste ↓ · Anota →</th>${m.cols.map(c => `<th>${esc(c.name)}</th>`).join("")}<th class="cx-total-h">Dadas</th></tr>`;
  const body = m.rows.map(r => `<tr><th class="cx-row-h">${esc(r.name)}</th>${m.cols.map(c => {
    const x = cell[`${r.id}|${c.id}`];
    return x ? `<td class="cx-cell sy-cell" style="background:rgba(34,197,94,${(0.12 + 0.5 * x.count / max).toFixed(2)})" title="${x.count} asistencias · ${x.points} puntos · ${x.threes} triples"><div class="cx-val">${x.count}</div><div class="cx-n">${x.points} pts${x.threes ? ` · ${x.threes}×3` : ""}</div></td>` : '<td class="cx-cell cx-empty">·</td>';
  }).join("")}<td class="cx-total"><div class="cx-val">${m.row_totals[r.id].count}</div></td></tr>`).join("");
  const foot = `<tr class="cx-foot"><th>Recibidas</th>${m.cols.map(c => `<td class="cx-total"><div class="cx-val">${m.col_totals[c.id].count}</div></td>`).join("")}<td class="cx-total"><div class="cx-val">${m.total}</div></td></tr>`;
  const ck = m.check;
  return `<div class="cx-scroll"><table class="cx-table" id="sy-matrix"><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>
    <p class="td-muted cx-legend">Filas: quien asiste · Columnas: quien anota. ${m.unlinked ? `Sin vínculo (anotador no identificado): ${m.unlinked}. ` : ""}${m.incomplete ? `En posesiones incompletas: ${m.incomplete}. ` : ""}</p>
    <p class="cx-check ${ck.ok ? "td-muted" : "below-avg"}">${ck.ok ? `Cuadra: matriz ${m.total} + sin vínculo ${m.unlinked} + incompletas ${m.incomplete} = ${m.pbp} asistencias del play-by-play${ck.box_matches ? ", igual al box oficial" : ` (box oficial: ${ck.box})`}.`
      : "La matriz no cuadra con las asistencias del play-by-play."}</p>`;
}

function _rank(title, rows, cols, empty) {
  return `<div class="card"><div class="card-title">${esc(title)}</div>${rows.length ? `<div class="vs-table-wrap"><table class="ld-table"><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join("")}</tr></thead><tbody>${
    rows.map(r => `<tr class="${r.ranked === false ? "ev-low" : ""}">${cols.map(c => `<td>${c[1](r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : `<p class="empty">${esc(empty)}</p>`}</div>`;
}

const pairName = r => r.players.map(p => esc(p.name)).join(" + ");
const net = r => (r.adj.net_rating ? fmtSigned(r.adj.net_rating.value, 2) : nullDisplay(r.values.net_rating?.reason));

/** Sinergias del equipo (Equipo › Quintetos). */
export async function renderSynergy(el, team, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = '<div class="card"><div class="card-title">Sinergias</div><p class="empty"><span class="spinner"></span>Calculando sinergias…</p></div>';
  let d;
  try { d = await api.synergy(team, opts.params || {}); }
  catch (e) { if (token === _token) el.innerHTML = `<div class="card"><div class="card-title">Sinergias</div><p class="empty below-avg">${esc(_err(e))}</p></div>`; return; }
  if (token !== _token) return;
  const r = d.rankings, byId = Object.fromEntries(d.pairs.rows.map(x => [x.id, x]));
  const top = key => d.pairs.rankings[key].map(id => byId[id]);
  const pairCols = [["Pareja", pairName], ["Muestra", x => sampleBadge(x.sample, { compact: true })], ["Net ajust.", net],
                    ["OER ajust.", x => (x.adj.oer ? fmtNumber(x.adj.oer.value, 2) : nullDisplay(x.values.oer?.reason))], ["TS%", x => num(x.values.ts_pct, PCT)]];
  const pairsTop = (title, key) => _rank(title, top(key), [["#", x => top(key).indexOf(x) + 1], ...pairCols], "Ninguna pareja alcanza la muestra mínima.");
  const impact = d.teammate_impact;
  el.innerHTML = `
    <div class="card"><div class="card-title">Sinergias · matriz de asistencias</div><div class="cx-head"><span class="td-muted">${esc(d.context.label)} · ${d.context.games_used} de ${d.context.games_total} partidos</span><span id="sy-export"></span></div>${_matrix(d)}</div>
    <div class="ev-grid">
      ${_rank("Quién genera más triples para otro", r.threes_pairs, [["Asiste", x => esc(x.assister.name)], ["Anota", x => esc(x.scorer.name)], ["Triples", x => x.threes]], "Sin triples asistidos en la selección.")}
      ${_rank("Quién convierte más puntos tras asistencia", r.points_after_assist.slice(0, 10), [["Anota", x => esc(x.name)], ["Puntos", x => x.points], ["% asistidas", x => num(x.assisted_share, PCT)], ["Asistente principal", x => `${esc(x.main_assister.name)} (${x.main_assister.count})`]], "Sin canastas asistidas en la selección.")}
    </div>
    <div class="ev-grid">${pairsTop("Parejas: mejor Net Rating (ajustado)", "net_rating")}${pairsTop("Parejas: mejor OER (ajustado)", "oer")}${pairsTop("Parejas: mayor eficiencia (TS%)", "ts_pct")}</div>
    ${_rank("Jugadores que potencian a sus compañeros", impact.slice(0, 10), [["Jugador", x => esc(x.name)], ["Compañeros", x => x.n], ["Impacto en Net", x => fmtSigned(x.impact_net, 2)],
      ["Impacto en OER", x => (x.impact_oer == null ? nullDisplay("sin_datos") : fmtSigned(x.impact_oer, 2))], ["Más potenciado", x => `${esc(x.companions[0].name)} (${fmtSigned(x.companions[0].diff_net, 2)})`]],
      "Ningún jugador tiene compañeros con muestra suficiente en ambos estados.")}
    <p class="td-muted sy-method">Las parejas usan el valor ajustado por muestra (regresión a la media de T-02); las de muestra baja no entran en los rankings. El impacto de A sobre B es el Net Rating de B junto a A menos el de B sin A, ambos ajustados y con muestra suficiente; el impacto de A es el promedio ponderado por la menor de las dos muestras.</p>`;
  const m = d.assist_matrix;
  exportMenu(el.querySelector("#sy-export"), {
    getNode: () => el.querySelector("#sy-matrix"),
    getData: () => ({
      meta: { title: `Matriz de asistencias — ${d.team}`, entity: { type: "team", id: d.team, name: d.team }, competition: { label: d.context.competition?.label || "" },
              filters: [{ label: "Contexto", value: d.context.label }], generated_at: new Date().toISOString(), file_name: `matriz-asistencias_${d.team}`.toLowerCase() },
      columns: [{ key: "_row", label: "Asiste", fmt: "text" }, ...m.cols.map((c, i) => ({ key: `c${i}`, label: c.name, fmt: "int" })), { key: "_t", label: "Dadas", fmt: "int" }],
      rows: m.rows.map(r => [r.name, ...m.cols.map(c => (m.cells.find(x => x.assister === r.id && x.scorer === c.id) || { count: 0 }).count), m.row_totals[r.id].count]),
      footer: [["Recibidas", ...m.cols.map(c => m.col_totals[c.id].count), m.total]],
      pageInfo: `${m.total} asistencias`,
    }),
  });
}

/** Impacto del jugador (Jugador › Impacto): con quién rinde mejor, a quién asiste, quién le asiste y a quién potencia. */
export async function renderImpact(el, team, playerId, opts = {}) {
  if (!el) return;
  const token = ++_tokenP;
  el.innerHTML = '<div class="card"><div class="card-title">Impacto</div><p class="empty"><span class="spinner"></span>Calculando sinergias…</p></div>';
  let d;
  try { d = await api.synergy(team, { ...(opts.params || {}), player: playerId }); }
  catch (e) { if (token === _tokenP) el.innerHTML = `<div class="card"><div class="card-title">Impacto</div><p class="empty below-avg">${esc(_err(e))}</p></div>`; return; }
  if (token !== _tokenP) return;
  const p = d.player;
  const list = (rows, label) => rows.length ? `<div class="ev-scroll"><table class="ld-table"><tbody>${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.count} asist.</td><td>${r.points} pts${r.threes ? ` · ${r.threes}×3` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">${esc(label)}</p>`;
  const pairs = p.best_pairs.length ? `<div class="ev-scroll"><table class="ld-table"><thead><tr><th>Pareja</th><th>Muestra</th><th>Net ajust.</th><th>OER ajust.</th></tr></thead><tbody>${p.best_pairs.map(r => `<tr><td>${esc(r.players.filter(x => x.id !== p.id).map(x => x.name).join(""))}</td><td>${sampleBadge(r.sample, { compact: true })}</td><td>${net(r)}</td><td>${r.adj.oer ? fmtNumber(r.adj.oer.value, 2) : "—"}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Este jugador no tiene parejas con muestra suficiente.</p>';
  const b = p.boosts;
  const boosts = b ? `<p class="td-muted">Impacto promedio en Net: <strong>${fmtSigned(b.impact_net, 2)}</strong> sobre ${b.n} compañeros.</p><div class="ev-scroll"><table class="ld-table"><thead><tr><th>Compañero</th><th>Con él</th><th>Sin él</th><th>Dif.</th></tr></thead><tbody>${
    b.companions.map(c => `<tr><td>${esc(c.name)}</td><td>${fmtSigned(c.net_with, 2)}</td><td>${fmtSigned(c.net_without, 2)}</td><td><strong>${fmtSigned(c.diff_net, 2)}</strong></td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Ningún compañero tiene muestra suficiente en ambos estados.</p>';
  el.innerHTML = `<div class="card"><div class="card-title">Impacto · ${esc(p.name)}</div><p class="td-muted">${esc(d.context.label)} · ${d.context.games_used} de ${d.context.games_total} partidos de ${esc(d.team)}.</p></div>
    <div class="ev-grid">
      <div class="card"><div class="card-title">Con quién rinde mejor</div>${pairs}</div>
      <div class="card"><div class="card-title">A quién asiste</div>${list(p.assists_to, "Sin asistencias vinculadas.")}</div>
      <div class="card"><div class="card-title">Quién le asiste</div>${list(p.assisted_by, "Sin canastas asistidas.")}</div>
      <div class="card"><div class="card-title">A quién potencia</div>${boosts}</div>
    </div>`;
}
