// ── Tramo de reloj de posesión y composición de puntos (A-05) ────────────────
// Cómo anota el equipo (peso de triples, dobles y tiros libres; pérdidas y asistencias) y en qué momento de la
// posesión tira: temprano (0-8 s), medio (9-16 s) y tardío (17-24 s) del reloj de posesión, con el reloj de 14 s
// (tras rebote ofensivo) aparte. FIBA no publica el shot clock: el reloj se deriva del reloj de partido.
// Equipo: `mode: "team"` + contexto de T-03. Partido: `gameId` + `teams` (un solo partido, selector de equipo).
// El lado va en `?cside=`.
import { api } from "../api.js";
import { fmtNumber, PCT, PCT0, DEC1, DEC2, nullDisplay, isNull } from "../core/format.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let _token = 0;   // descarta respuestas viejas al cambiar de equipo, lado o contexto

function _sideFromUrl() {
  try { return new URL(location.href).searchParams.get("cside") === "defensa" ? "defensa" : "ataque"; } catch { return "ataque"; }
}
function _setSideUrl(side) {
  try {
    const url = new URL(location.href);
    url.searchParams.set("cside", side);
    history.replaceState(history.state, "", url);
  } catch { /* la URL no se pudo actualizar */ }
}

const val = (m, fmt) => (!m || isNull(m.value) ? nullDisplay(m?.reason || "sin_intentos") : fmt(m.value));
const low = o => o?.sample?.level === "baja";
const lowTag = o => (low(o) ? ` <span class="sample-badge sample-baja" title="${esc(`Muestra baja: mínimo ${o.sample.min} posesiones`)}">baja</span>` : "");
const table = (head, rows) => `<div class="dt-table-wrap"><table class="search-table of-table">
  <thead><tr>${head.map((h, i) => `<th${i === 0 ? ' class="of-origin"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.join("")}</tbody></table></div>`;
const stat = (label, value, sub = "") => `<div class="tp-stat"><em>${esc(label)}</em><strong>${value}</strong>${sub ? `<span>${sub}</span>` : ""}</div>`;
const sec = (title, body) => `<h4 class="tp-h">${esc(title)}</h4>${body}`;

const PART_CLASS = { t3: "cp-seg-3", t2: "cp-seg-2", tl: "cp-seg-ft" };

function _mix(pm, side) {
  const own = side === "ataque" ? "anota" : "concede";
  const bar = `<div class="cp-bar" role="img" aria-label="Composición de los puntos">${pm.parts.map(p =>
    isNull(p.share.value) ? "" : `<span class="${PART_CLASS[p.key]}" style="width:${(p.share.value * 100).toFixed(1)}%" title="${esc(`${p.label}: ${p.pts} puntos`)}">${PCT0(p.share.value)}</span>`).join("")}</div>`;
  const rows = pm.parts.map(p => `<tr><td class="of-origin"><i class="cp-dot ${PART_CLASS[p.key]}"></i>${esc(p.label)}</td>
    <td>${fmtNumber(p.pts, 0)}</td><td>${val(p.share, PCT)}</td><td>${p.made} / ${p.attempts}</td><td>${val(p.pct, PCT)}</td>
    <td>${val(p.attempts_share, PCT)}</td></tr>`);
  rows.push(`<tr class="of-total"><td class="of-origin">Total</td><td>${fmtNumber(pm.pts, 0)}</td><td>${pm.reconciled ? "100 %" : "—"}</td><td colspan="3"></td></tr>`);
  const t = pm.turnovers, a = pm.assists;
  const astPts = a.ast_points.value == null
    ? `<span title="${esc(a.note)}">${nullDisplay(a.ast_points.reason)}</span>` : fmtNumber(a.ast_points.value, 0);
  return `<p class="td-muted">Peso de cada tipo de tiro en los puntos que el equipo ${own} (${pm.games} partido${pm.games === 1 ? "" : "s"}, box oficial).</p>${bar}`
    + table(["Tipo", "Puntos", "% de los puntos", "Convertidos / intentos", "% acierto", "% de los intentos"], rows)
    + `<div class="tp-stats">
      ${stat("Pérdidas", fmtNumber(t.count, 0), `${val(t.per_game, DEC1)} por partido · ${val(t.poss_share, PCT)} de las posesiones`)}
      ${stat("Puntos perdidos (estimado)", val(t.est_points_lost, DEC1), esc(t.note))}
      ${stat("Asistencias", fmtNumber(a.count, 0), `${val(a.per_game, DEC1)} por partido · ${val(a.fgm_assisted_share, PCT)} de las canastas de campo`)}
      ${stat("Puntos generados por asistencias", astPts, `${val(a.ast_points_share, PCT)} de los puntos · ${a.linked.fg2} a dobles, ${a.linked.fg3} a triples, ${a.linked.ft} a tiros libres`)}
    </div>`;
}

function _bandRow(b, blk, th14) {
  const x = b[blk];
  const range = blk === "r14" && b.key === "medio" ? `${b.range.split("–")[0]}–${th14} s` : b.range;
  if (x.reason) return `<tr class="of-info"><td class="of-origin">${esc(b.label)} <small>${esc(b.range)}</small></td><td colspan="10">Sin tramo tardío: el reloj se reinicia a 14 s.</td></tr>`;
  const m = x.metrics, th = x.threes;
  return `<tr class="${low(x) ? "of-low" : ""}"><td class="of-origin">${esc(b.label)} <small>${esc(range)}</small></td>
    <td>${fmtNumber(x.shots, 0)}${lowTag(x)}</td><td>${isNull(x.share) ? "—" : PCT(x.share)}</td>
    <td>${th.made} / ${th.attempts}</td><td>${val(th.share_of_band, PCT)}</td><td>${val(th.share_of_team_3pa, PCT)}</td>
    <td>${val(m.efg_pct, PCT)}</td><td>${val(m.ppt, DEC2)}</td><td>${val(m.ppp, DEC2)}</td>
    <td>${val(m.to_pct, PCT)}</td><td>${val(m.viol24_rate, PCT)}</td></tr>`;
}

const BAND_HEAD = ["Tramo", "Tiros", "% de los tiros", "Triples (c/i)", "% de sus tiros son triples", "Peso en los triples del equipo",
  "eFG%", "PPT", "PPP", "TO%", "Viol. 24 s"];

function _bands(d) {
  const rows24 = d.bands.map(b => _bandRow(b, "r24"));
  const nc = d.no_clock;
  rows24.push(`<tr class="of-info"><td class="of-origin" title="${esc("El reloj de partido del tiro no permite derivar el reloj de posesión.")}">Sin reloj derivable</td>
    <td>${nc.shots}</td><td>${isNull(d.reconcile.fga_engine) || !d.reconcile.fga_engine ? "—" : PCT(nc.shots / d.reconcile.fga_engine)}</td><td colspan="8"></td></tr>`);
  const rows14 = d.bands.filter(b => b.key !== "tardio").map(b => _bandRow(b, "r14", d.thresholds.reset_secs));
  const types = table(["Tramo", ...["Pase", "Manejo", "Pasos", "24 segundos", "Otras"]], d.bands.map(b => {
    const t = b.r24.turnover_types;
    return `<tr><td class="of-origin">${esc(b.label)}</td><td>${t.pase}</td><td>${t.manejo}</td><td>${t.pasos}</td><td>${t.viol24}</td><td>${t.otras}</td></tr>`;
  }));
  return `<p class="td-muted">${esc(d.clock_source.note)} Resolución de 1 s: un tiro a 8,4 s cuenta como 8.</p>`
    + sec("Reloj de 24 s", table(BAND_HEAD, rows24))
    + sec("Reloj de 14 s (tras rebote ofensivo): no hay tramo tardío", table(BAND_HEAD, rows14))
    + sec("Pérdidas por tipo y tramo (reloj de 24 s)", types);
}

function _reconcile(d) {
  const r = d.reconcile;
  const txt = `Tiros: ${r.in_bands_24} en reloj de 24 s + ${r.in_bands_14} en reloj de 14 s + ${r.no_clock} sin reloj + ${r.in_incomplete} en posesiones incompletas = ${r.in_bands_24 + r.in_bands_14 + r.no_clock + r.in_incomplete}`;
  return r.ok
    ? `<p class="td-muted">${txt} (iguala los ${r.fga_team} del box oficial).</p>`
    : `<p class="td-muted below-avg">${txt}: diferencia con los ${r.fga_team} del box oficial. Revisá el motor de posesiones.</p>`;
}

const BAND_KEYS = ["temprano", "medio", "tardio"];
const BAND_NAME = { temprano: "Temprano", medio: "Medio", tardio: "Tardío", sin_reloj: "Sin reloj" };
const signed = (v, fmt) => (isNull(v) ? "—" : `${v > 0 ? "+" : ""}${fmt(v)}`);

// ── Panel de decisión: las siete preguntas del cuerpo técnico, con los números de las tablas de arriba ──
function _qCard(title, headline, body) {
  return `<div class="cp-q"><h5>${esc(title)}</h5><p class="cp-q-head">${headline}</p>${body}</div>`;
}

function _decision(d, side) {
  const q = d.decision, rows = Object.fromEntries(d.bands.map(b => [b.key, b]));
  const label = k => BAND_NAME[k];
  // 1 · pérdidas
  const q1 = q.q1_perdidas;
  const maxTov = BAND_KEYS.reduce((a, b) => ((q1.share_of_turnovers[b] ?? -1) > (q1.share_of_turnovers[a] ?? -1) ? b : a), "temprano");
  const tovTotal = BAND_KEYS.reduce((s, b) => s + q1.turnovers[b], 0);
  const c1 = _qCard("¿Dónde perdemos balones?",
    tovTotal ? `El ${PCT0(q1.share_of_turnovers[maxTov])} de las pérdidas ocurre en el tramo ${label(maxTov).toLowerCase()}.` : "Sin pérdidas en esta selección.",
    table(["Tramo", "TO%", "Pérdidas", "% del total", "Pase", "Manejo", "Pasos", "24 s", "Otras"], BAND_KEYS.map(b => {
      const t = q1.by_type[b];
      return `<tr><td class="of-origin">${label(b)}</td><td>${isNull(q1.to_pct[b]) ? "—" : PCT(q1.to_pct[b])}</td><td>${q1.turnovers[b]}</td>
        <td>${isNull(q1.share_of_turnovers[b]) ? "—" : PCT(q1.share_of_turnovers[b])}</td><td>${t.pase}</td><td>${t.manejo}</td><td>${t.pasos}</td><td>${t.viol24}</td><td>${t.otras}</td></tr>`;
    })));
  // 2 · eficiencia contra el promedio de la competencia en el mismo tramo
  const q2 = q.q2_eficiencia;
  const avgNote = q2.league ? "Ø = promedio de los equipos de la competencia en el mismo tramo." : "Sin promedio de la competencia en esta vista.";
  const c2 = _qCard("¿Dónde somos más eficientes?",
    q2.best_band ? `Mejor PPP: tramo ${label(q2.best_band).toLowerCase()} (${DEC2(q2.rows.find(r => r.band === q2.best_band).ppp.value)}).` : "Sin muestra suficiente para elegir un tramo.",
    table(["Tramo", "PPP", "Ø", "Dif.", "eFG%", "Ø", "Dif."], q2.rows.map(r => `<tr class="${r.sample.level === "baja" ? "of-low" : ""}"><td class="of-origin">${label(r.band)}${lowTag({ sample: r.sample })}</td>
      <td>${isNull(r.ppp.value) ? "—" : DEC2(r.ppp.value)}</td><td>${isNull(r.ppp.avg) ? "—" : DEC2(r.ppp.avg)}</td><td>${signed(r.ppp.dist_avg, DEC2)}</td>
      <td>${isNull(r.efg_pct.value) ? "—" : PCT(r.efg_pct.value)}</td><td>${isNull(r.efg_pct.avg) ? "—" : PCT(r.efg_pct.avg)}</td><td>${signed(r.efg_pct.dist_avg, v => `${fmtNumber(v * 100, 1)} pp`)}</td></tr>`)) +
    `<p class="td-muted">${avgNote}</p>`);
  // 3 · desde dónde tiramos
  const topZone = b => {
    const cells = d.matrix.zones.map(z => ({ z, n: z.bands[b].attempts })).filter(x => x.n > 0).sort((a, b2) => b2.n - a.n)[0];
    return cells ? `${cells.z.label} (${cells.n})` : "—";
  };
  const c3 = _qCard("¿Desde dónde tiramos según el reloj?", "Zona con más tiros en cada tramo; el detalle está en la matriz.",
    `<ul class="cp-list">${BAND_KEYS.map(b => `<li><strong>${label(b)}:</strong> ${esc(topZone(b))}</li>`).join("")}</ul>`);
  // 4 · selección de tiro
  const c4 = _qCard("¿Cómo cambia la selección de tiro?", "Cómo termina cada oportunidad y cuánto pesa la pintura.",
    table(["Tramo", "Dobles", "Triples", "Libres", "Pérdida", "Pintura", "Perímetro"], q.q4_seleccion.map(r => `<tr><td class="of-origin">${label(r.band)}</td>
      <td>${isNull(r.mix.t2) ? "—" : PCT0(r.mix.t2)}</td><td>${isNull(r.mix.t3) ? "—" : PCT0(r.mix.t3)}</td><td>${isNull(r.mix.tl) ? "—" : PCT0(r.mix.tl)}</td><td>${isNull(r.mix.perdida) ? "—" : PCT0(r.mix.perdida)}</td>
      <td>${isNull(r.paint_share) ? "—" : PCT0(r.paint_share)}</td><td>${isNull(r.perimeter_share) ? "—" : PCT0(r.perimeter_share)}</td></tr>`)));
  // 5 · quién decide (solo ataque)
  const top = q.q5_decide.top_by_band;
  const c5 = side === "defensa" ? "" : _qCard("¿Quién decide en cada tramo?", "Quienes terminan más oportunidades del tramo (tiro, pérdida o falta recibida).",
    `<ul class="cp-list">${BAND_KEYS.map(b => `<li><strong>${label(b)}:</strong> ${(top[b] || []).length ? top[b].map(p =>
      `${esc(p.name)} (${p.finished}, ${isNull(p.uso_pct.value) ? "—" : PCT0(p.uso_pct.value)})${p.sample.level === "baja" ? " <small>muestra baja</small>" : ""}`).join(" · ") : "—"}</li>`).join("")}</ul>`);
  // 6 · costo de llegar al tardío
  const q6 = q.q6_costo_tardio;
  const c6 = _qCard("¿Cuánto nos cuesta llegar al tramo tardío?",
    isNull(q6.reach_tardio_share.value) ? "Sin oportunidades con tramo." : `El ${PCT0(q6.reach_tardio_share.value)} de las oportunidades llega al tramo tardío.`,
    `<div class="tp-stats">${stat("PPP tardío", val(q6.ppp_tardio, DEC2))}${stat("PPP temprano", val(q6.ppp_temprano, DEC2))}${stat("Diferencia", val(q6.diff, v => signed(v, DEC2)), "tardío menos temprano")}</div>`);
  // 7 · el rival
  const c7 = _qCard("¿A qué tramo empujamos al rival?",
    side === "defensa" ? "Esta vista ya muestra al rival: lo de arriba es lo que obligamos a hacer." : "Se responde con la vista Defensa.",
    side === "defensa" ? "" : '<button type="button" class="btn btn-ghost btn-sm cp-goside" data-side="defensa">Ver vista Defensa</button>');
  return `<div class="cp-decision">${c1}${c2}${c3}${c4}${c5}${c6}${c7}</div>`;
}

// ── Matriz zona × tramo ──
function _matrix(m) {
  if (!m.has_coordinates) {
    return '<p class="td-muted">Las zonas son aproximadas: reprocesá los partidos para ubicar cada tiro.</p>';
  }
  const cols = m.bands;
  const rows = m.zones.filter(z => cols.some(b => z.bands[b].attempts > 0)).map(z => `<tr><td class="of-origin">${esc(z.label)}</td>${cols.map(b => {
    const c = z.bands[b];
    if (!c.attempts) return '<td class="td-muted">—</td>';
    return `<td class="${c.sample.level === "baja" ? "cp-cell-low" : ""}" title="${esc(`${c.made} de ${c.attempts} · FG% ${isNull(c.fg_pct.value) ? "—" : PCT(c.fg_pct.value)} · eFG% ${isNull(c.efg_pct.value) ? "—" : PCT(c.efg_pct.value)}`)}">
      <strong>${c.attempts}</strong> <small>· PPT ${isNull(c.ppt.value) ? "—" : DEC2(c.ppt.value)}</small></td>`;
  }).join("")}</tr>`);
  rows.push(`<tr class="of-total"><td class="of-origin">Total</td>${cols.map(b => `<td>${m.totals[b]}</td>`).join("")}</tr>`);
  return `<p class="td-muted">Tiros (y puntos por tiro) de cada zona en cada tramo, con ambos relojes. Las celdas grises tienen muestra baja.</p>`
    + table(["Zona", ...cols.map(b => BAND_NAME[b])], rows);
}

// ── Plantel por tramo (equipo, ataque) ──
function _playersTable(pl) {
  const cell = (r, b) => {
    const c = r.by_band[b];
    return `<td class="${c.sample.level === "baja" && c.finished ? "cp-cell-low" : ""}">${c.shots}</td><td>${isNull(c.efg_pct.value) ? "—" : PCT0(c.efg_pct.value)}</td>
      <td>${isNull(c.uso_pct.value) ? "—" : PCT0(c.uso_pct.value)}</td><td>${isNull(c.ppp_personal.value) ? "—" : DEC2(c.ppp_personal.value)}</td>`;
  };
  const head = ["Jugador", ...BAND_KEYS.flatMap(b => [`${BAND_NAME[b]}: tiros`, "eFG%", "USO%", "PPP pers."])];
  const row = r => `<tr><td class="of-origin">${esc(r.name)}</td>${BAND_KEYS.map(b => cell(r, b)).join("")}</tr>`;
  return `<p class="td-muted">USO% = oportunidades del tramo que el jugador termina (tiro, pérdida o falta recibida) sobre las del equipo. Reloj de 24 s.</p>`
    + table(head, [...pl.rows.map(row), row(pl.team_row)]);
}

// ── Vista de jugador ──
function _playerView(d) {
  const rows = BAND_KEYS.map(b => {
    const c = d.by_band[b], band = d.bands.find(x => x.key === b);
    return `<tr class="${c.sample.level === "baja" && c.finished ? "of-low" : ""}"><td class="of-origin">${BAND_NAME[b]}</td><td>${c.shots}</td>
      <td>${isNull(c.efg_pct.value) ? "—" : PCT(c.efg_pct.value)}</td><td>${isNull(c.ppt.value) ? "—" : DEC2(c.ppt.value)}</td><td>${isNull(c.ts_pct.value) ? "—" : PCT(c.ts_pct.value)}</td>
      <td>${c.finished}${lowTag(c)}</td><td>${band.chances}</td><td>${isNull(c.uso_pct.value) ? "—" : PCT(c.uso_pct.value)}</td><td>${isNull(c.ppp_personal.value) ? "—" : DEC2(c.ppp_personal.value)}</td></tr>`;
  });
  return `<p class="td-muted">${esc(d.clock_source.note)} Reloj de 24 s; USO% = oportunidades del tramo que termina sobre las del equipo.</p>`
    + table(["Tramo", "Tiros", "eFG%", "PPT", "TS%", "Termina", "Del equipo", "USO%", "PPP personal"], rows);
}

// `opts`: {params (competition, last, contexto), mode: "team"|"game"|"player", gameId, teams: [{code, name}], team}
export async function renderClockPanel(el, teamCode, opts = {}) {
  if (!el) return;
  if (opts.mode === "player") return _renderPlayer(el, teamCode, opts);
  const side = _sideFromUrl();
  const token = ++_token;
  const game = opts.mode === "game";
  const team = game ? (opts.team || teamCode) : teamCode;
  const title = side === "defensa" ? "Cómo anota el rival y cuándo tira" : "Cómo anota y cuándo tira";
  const sideChips = `<div class="pb-chips" role="group" aria-label="Lado">
      <button type="button" class="filter-pill cp-chip${side === "ataque" ? " active" : ""}" data-side="ataque">Ataque</button>
      <button type="button" class="filter-pill cp-chip${side === "defensa" ? " active" : ""}" data-side="defensa">Defensa</button></div>`;
  const teamChips = game && opts.teams?.length ? `<div class="pb-chips" role="group" aria-label="Equipo">${opts.teams.map(t =>
    `<button type="button" class="filter-pill cp-team${t.code === team ? " active" : ""}" data-team="${esc(t.code)}">${esc(t.name || t.code)}</button>`).join("")}</div>` : "";
  const shell = body => {
    el.innerHTML = `<div class="card of-card tp-card"><div class="card-title">${title}</div>${teamChips}${sideChips}${body}</div>`;
    el.querySelectorAll(".cp-chip").forEach(c => c.addEventListener("click", () => {
      if (c.classList.contains("active")) return;
      _setSideUrl(c.dataset.side);
      renderClockPanel(el, teamCode, opts);
    }));
    el.querySelectorAll(".cp-team").forEach(c => c.addEventListener("click", () => {
      if (c.classList.contains("active")) return;
      renderClockPanel(el, teamCode, { ...opts, team: c.dataset.team });
    }));
  };
  shell('<p class="empty"><span class="spinner"></span>Calculando el reloj de posesión…</p>');

  let d;
  try {
    d = await api.possessionClock({ team, side, ...(game ? { game: opts.gameId } : (opts.params || {})) });
  } catch (e) {
    if (token !== _token) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const msg = offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular el reloj de posesión. Probá de nuevo.");
    shell(`<p class="empty below-avg">${esc(msg)}</p>${e.code === "sin_pbp" ? "" : '<button type="button" class="btn btn-ghost btn-sm cp-retry">Reintentar</button>'}`);
    el.querySelector(".cp-retry")?.addEventListener("click", () => renderClockPanel(el, teamCode, opts));
    return;
  }
  if (token !== _token) return;
  if (!d.summary.shots) { shell('<p class="empty">No hay tiros en esta selección.</p>'); return; }
  const ctx = d.context?.label ? `<p class="td-muted">${esc(d.context.label)}</p>` : "";
  shell(ctx + sec("Composición de los puntos", _mix(d.points_mix, side)) + sec("Tramo del reloj de posesión", _bands(d))
    + sec("Panel de decisión", _decision(d, side)) + sec("Matriz zona × tramo", _matrix(d.matrix))
    + (d.players ? sec("Jugadores por tramo", _playersTable(d.players)) : "") + _reconcile(d));
  el.querySelectorAll(".cp-goside").forEach(b => b.addEventListener("click", () => {
    _setSideUrl(b.dataset.side);
    renderClockPanel(el, teamCode, opts);
  }));
}

let _ptoken = 0;   // el panel de jugador lleva su propio contador: puede convivir con el de equipo

async function _renderPlayer(el, playerId, opts) {
  const token = ++_ptoken;
  const shell = body => { el.innerHTML = `<div class="card of-card tp-card"><div class="card-title">Cuándo tira (reloj de posesión)</div>${body}</div>`; };
  shell('<p class="empty"><span class="spinner"></span>Calculando el reloj de posesión…</p>');
  let d;
  try {
    d = await api.possessionClock({ player: playerId, ...(opts.params || {}) });
  } catch (e) {
    if (token !== _ptoken) return;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    shell(`<p class="empty below-avg">${esc(offline ? "Sin conexión: el análisis de posesiones necesita conexión."
      : (e.code === "sin_pbp" ? e.message : "No se pudo calcular el reloj de posesión. Probá de nuevo."))}</p>`);
    return;
  }
  if (token !== _ptoken) return;
  if (!d.summary.shots && !d.summary.finished) { shell('<p class="empty">Sin tiros ni posesiones terminadas en esta selección.</p>'); return; }
  shell((d.context?.label ? `<p class="td-muted">${esc(d.context.label)}</p>` : "") + _playerView(d));
}

export function destroyClockPanel() { _token++; _ptoken++; }
