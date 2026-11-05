// Producción desde eventos (A-07): la consecuencia en puntos de cada asistencia, rebote ofensivo, rebote defensivo, robo y pérdida
// de un equipo o un jugador (pestaña Eventos). Cinco cards con desenlaces, puntos y tasas; los valores sin base van como "—" con su razón.
import { api } from "../api.js";
import { PCT, fmtNumber, nullDisplay } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let _token = 0;

const num = (m, fmt = v => fmtNumber(v, 2)) => (m && m.value != null ? fmt(m.value) : nullDisplay(m?.reason));
const pct = m => num(m, PCT);

function _rows(labels, outcomes, withPts = true) {
  return `<div class="ev-scroll"><table class="ld-table ev-table"><thead><tr><th></th><th>Cantidad</th><th>%</th>${withPts ? "<th>Puntos</th>" : ""}</tr></thead><tbody>${
    Object.entries(labels).map(([k, l]) => { const o = outcomes[k]; return `<tr><td>${esc(l)}</td><td>${o.count}</td><td>${pct(o.share)}</td>${withPts ? `<td>${o.points}</td>` : ""}</tr>`; }).join("")}</tbody></table></div>`;
}

function _card(title, blk, body, empty) {
  const low = blk.sample && blk.sample.n > 0 && blk.sample.level === "baja";
  return `<div class="card ev-card${low ? " ev-low" : ""}"><div class="card-title">${esc(title)} <span class="ev-n">${blk.events}</span> ${sampleBadge(blk.sample, { compact: true })}</div>${
    low ? '<p class="td-muted below-avg">Muestra baja: leé estos valores con cuidado.</p>' : ""}${
    blk.events ? body : `<p class="empty">${esc(empty)}</p>`}</div>`;
}

const kv = (label, value, hint = "") => `<div class="ev-kv"><span class="td-muted"${hint ? ` title="${esc(hint)}"` : ""}>${esc(label)}</span><strong>${value}</strong></div>`;

/** `kind`: "team" | "player"; `id`: código de equipo o `player_id`; `opts.params`: competencia y contexto. */
export async function renderEvents(el, kind, id, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = '<div class="card"><div class="card-title">Eventos</div><p class="empty"><span class="spinner"></span>Calculando producción por evento…</p></div>';
  let d;
  try { d = await api.eventsProduction({ ...(opts.params || {}), entity: kind, id }); }
  catch (e) {
    if (token !== _token) return;
    const msg = e instanceof TypeError || navigator.onLine === false ? "Sin conexión: el análisis por evento necesita conexión."
      : e.status >= 500 ? "No se pudo calcular la producción por evento." : e.message;
    el.innerHTML = `<div class="card"><div class="card-title">Eventos</div><p class="empty below-avg">${esc(msg)}</p></div>`;
    return;
  }
  if (token !== _token) return;
  const b = d.blocks, tm = kind === "team";
  const a = b.assists, o = b.oreb, r = b.dreb, s = b.steals, t = b.turnovers;
  const cards = [
    _card("Asistencias", a, `
      <div class="ev-kvs">${kv("Puntos generados", a.points)}${kv("Puntos por asistencia", num(a.points_per_assist))}
        ${a.top_receiver ? kv("Asiste más a", `${esc(a.top_receiver.name)} (${a.top_receiver.count})`) : ""}
        ${tm && a.top_pair ? kv("Pareja más frecuente", `${esc(a.top_pair.assister)} → ${esc(a.top_pair.receiver)} (${a.top_pair.count})`) : ""}</div>
      ${_rows({ doble: "Termina en doble", triple: "Termina en triple", mas1: "Termina en 2+1" }, a.kinds)}
      ${tm ? `<p class="td-muted ev-rec">Cuadre: ${a.reconcile.linked} con canasta + ${a.reconcile.unlinked} sin vínculo + ${a.reconcile.incomplete} en posesión incompleta = ${a.reconcile.pbp} del play-by-play.</p>` : ""}`,
      "Sin asistencias en la selección."),
    _card("Rebotes ofensivos", o, `
      <div class="ev-kvs">${kv("Puntos tras rebote ofensivo", o.points)}${kv("Conversión", pct(o.conversion))}${kv("Puntos por rebote ofensivo", num(o.points_per_oreb))}
        ${tm ? kv("Rebotes de equipo", o.team_rebounds) : ""}</div>
      ${_rows({ putback: "Putback", doble: "Doble", triple: "Triple", falta: "Falta recibida", perdida: "Pérdida", sin_puntos: "Finalización sin puntos" }, o.outcomes)}`,
      "Sin rebotes ofensivos en la selección."),
    _card("Rebotes defensivos", r, `
      <div class="ev-kvs">${kv("Inician contraataque", `${r.counterattacks.count} (${pct(r.counterattacks.share)})`)}
        ${kv("Terminan en anotación", `${r.counterattack_scores.count} (${pct(r.counterattack_scores.share)})`)}
        ${kv("Puntos generados después", `${r.points} (${r.points_in_transition} en transición)`)}${kv("PPP de esas posesiones", num(r.ppp))}
        ${kv("Primer pase de salida", nullDisplay("no_registrado"), r.first_pass.note)}${tm ? kv("Rebotes de equipo", r.team_rebounds) : ""}</div>
      <p class="td-muted ev-rec">FIBA no registra los pases de salida.</p>`,
      "Sin rebotes defensivos en la selección."),
    _card("Robos", s, `
      <div class="ev-kvs">${kv("Puntos tras robo", s.points)}${kv("Puntos por robo", num(s.points_per_steal))}
        ${kv("PPP tras robo", num(s.ppp_after_steal))}${kv("PPP de todas las posesiones", num(s.ppp_all))}</div>
      ${_rows({ doble: "Doble", triple: "Triple", falta: "Falta recibida", perdida: "Pérdida posterior", sin_conversion: "Sin conversión" }, s.outcomes)}
      ${tm ? `<p class="td-muted ev-rec">Cuadre: ${s.reconcile.linked} vinculados + ${s.reconcile.unlinked} sin vínculo + ${s.reconcile.incomplete} en posesión incompleta = ${s.reconcile.pbp} del play-by-play.</p>` : ""}`,
      "Sin robos en la selección."),
    _card("Pérdidas", t, `
      <div class="ev-kvs">${kv("Puntos recibidos", t.points_conceded)}${kv("Costo por pérdida", num(t.cost_per_turnover))}
        ${kv("Pérdidas castigadas", `${t.punished.count} (${pct(t.punished.share)})`)}${tm ? kv("Pérdidas de equipo", t.team_turnovers) : ""}</div>
      ${_rows({ doble: "Doble recibido", triple: "Triple recibido", falta: "Falta recibida por el rival", sin_castigo: "Sin castigo", sin_posesion_siguiente: "Sin posesión siguiente (fin de período)" }, t.outcomes)}`,
      "Sin pérdidas en la selección."),
  ];
  el.innerHTML = `<div class="card"><div class="card-title">Producción desde eventos · ${esc(d.entity.name)}</div>
      <p class="td-muted">${esc(d.context.label)} · ${d.context.games_used} de ${d.context.games_total} partidos. Cada evento se mide por la posesión que sigue.${
        d.excluded.incomplete ? ` Quedaron fuera ${d.excluded.incomplete} posesiones incompletas.` : ""}</p>
      ${tm && d.reconcile.pts_from_tov.differing.length ? `<p class="td-muted">Puntos tras pérdida frente al box oficial: difieren ${d.reconcile.pts_from_tov.differing.length} de ${d.reconcile.pts_from_tov.games} partidos.</p>` : ""}</div>
    <div class="ev-grid">${cards.join("")}</div>`;
}
