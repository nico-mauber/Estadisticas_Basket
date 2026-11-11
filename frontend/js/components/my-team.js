// Mi equipo (F-12, sección S8 `#/mi-equipo`): la pantalla de entrada del entrenador. Muestra el equipo fijado sin ningún
// filtro: cabecera, próximo partido (con Preparar), plan de juego, alertas de los últimos días y accesos directos (últimos
// partidos, quintetos más usados y jugadores seguidos). Cada bloque se dibuja aislado: si uno falla, el resto se ve.
import { api } from "../api.js";
import { fmtNumber, fmtSigned, nullDisplay, PCT, fmtByFmt, fmtMetric } from "../core/format.js";
import { sampleBadge } from "./sample-badge.js";
import { renderGamePlan } from "./game-plan.js";
import { saveUiPref, toggleFollow } from "./my-team-controls.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDay = d => { const p = String(d || "").split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (d || "—"); };
const num = (m, d = 1) => (m && m.value != null ? fmtNumber(m.value, d) : nullDisplay(m?.reason));
let _token = 0;

const card = (id, title, body) => `<div class="card mt-card" id="${id}"><div class="card-title">${esc(title)}</div>${body}</div>`;

function _offline(e) { return e instanceof TypeError || navigator.onLine === false; }

function _failed(d, block, label) {
  const f = d.blocks_failed?.[block];
  return f ? `<p class="empty below-avg">${esc(label)} <button type="button" class="btn btn-ghost btn-sm mt-retry">Reintentar</button></p>` : null;
}

async function _picker(el, opts, { current = null, note = "" } = {}) {
  let teams = [];
  try { teams = await api.teams(); } catch (e) {
    el.innerHTML = card("mt-picker", "Mi equipo", `<p class="empty below-avg">${esc(_offline(e) ? "Sin conexión: Mi equipo necesita conexión." : "No se pudieron cargar los equipos.")}</p>`);
    return;
  }
  el.innerHTML = card("mt-picker", "Mi equipo", `${note ? `<p class="below-avg">${esc(note)}</p>` : ""}
    <p>Elegí tu equipo para que la app arranque siempre en él.</p>
    <div class="mt-pick-row"><select class="map-select" id="mt-team-select" aria-label="Tu equipo"><option value="">— Elegí tu equipo —</option>
      ${teams.map(t => `<option value="${esc(t.code)}"${current === t.code ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      <button type="button" class="btn btn-sm" id="mt-fix-btn">Fijar como mi equipo</button>
      ${current ? '<button type="button" class="btn btn-ghost btn-sm" id="mt-cancel-pick">Cancelar</button>' : ""}</div>`);
  el.querySelector("#mt-cancel-pick")?.addEventListener("click", () => renderMyTeam(el, opts));
  el.querySelector("#mt-fix-btn").addEventListener("click", async () => {
    const code = el.querySelector("#mt-team-select").value;
    if (!code) return;
    try { await saveUiPref("home_team", code); opts.toast?.("Listo: la app va a abrir en tu equipo."); }
    catch (e) { opts.toast?.(e.message || "No se pudo guardar.", "err"); return; }
    renderMyTeam(el, opts);
  });
}

function _header(d) {
  const h = d.header;
  return card("mt-header", d.team.name, `<div class="mt-head">
      <div><div class="td-muted">${esc(d.competition.label || "")} · sin filtros</div>
        <div class="mt-record"><strong>${esc(h.record.text)}</strong> <span class="td-muted">G-P</span> · Dif. media <strong>${h.avg_margin.value != null ? fmtSigned(h.avg_margin.value, 1) : nullDisplay(h.avg_margin.reason)}</strong>
          · ${h.games} partidos ${sampleBadge(h.sample, { compact: true })}</div></div>
      <div class="mt-head-actions"><a class="btn btn-ghost btn-sm" href="#/equipo/${esc(d.team.code)}/resumen">Ver equipo</a>
        <button type="button" class="btn btn-ghost btn-sm" id="mt-change">Cambiar equipo</button></div>
    </div>`);
}

function _next(d, opts) {
  const f = d.next_fixture;
  if (!f) {
    const msg = _failed(d, "next_fixture", "No se pudo cargar el próximo partido.")
      || `<p class="empty">${d.next_fixture_reason === "sin_calendario" ? "Todavía no hay calendario cargado." : "No hay próximos partidos cargados para tu equipo."}</p>
         ${d.can_edit_fixtures ? '<a class="btn btn-ghost btn-sm" href="#/datos/calendario">Cargar calendario</a>' : ""}`;
    return card("mt-next", "Próximo partido", msg);
  }
  const when = f.days_left === 0 ? "hoy" : f.days_left === 1 ? "mañana" : `faltan ${f.days_left} días`;
  return card("mt-next", "Próximo partido", `<div class="mt-next">
    <div class="mt-next-main"><span class="mt-rival">${esc(f.rival.name)}</span>
      <span class="td-muted">${fmtDay(f.date)}${f.time ? ` ${esc(f.time)}` : ""} · ${f.is_home ? "Local" : "Visitante"} · ${esc(when)}</span>
      ${f.notes ? `<span class="td-muted">${esc(f.notes)}</span>` : ""}</div>
    <button type="button" class="btn btn-sm" id="mt-prepare">Preparar partido</button></div>`);
}

function _alerts(d) {
  const failed = _failed(d, "alerts", "No se pudieron cargar las alertas.");
  if (failed) return card("mt-alerts", "Alertas", failed);
  const a = d.alerts, w = a.window;
  const head = `<p class="td-muted mt-window">Últimos ${w.days} días · ${w.games} partidos ${w.games ? sampleBadge(w.sample, { compact: true }) : ""}</p>`;
  if (a.reason === "sin_partidos_en_ventana") return card("mt-alerts", "Alertas", `${head}<p class="empty">No hubo partidos en los últimos ${w.days} días.</p>`);
  const insReason = { muestra_baja: "Con tan pocos partidos en la ventana no hay percentiles confiables para los insights.",
    poblacion_insuficiente: "La competencia no tiene suficientes equipos para comparar.", ventana_no_final: "La ventana no termina en el último partido del equipo.",
    sin_extremos: "Sin valores extremos en la ventana." }[a.insights_reason] || "";
  const ins = a.insights.length ? `<ul class="mt-list">${a.insights.map(i => `<li class="${i.good === false ? "below-avg" : ""}">${esc(i.text)}</li>`).join("")}</ul>`
    : `<p class="empty">${esc(insReason || "Sin insights en la ventana.")}</p>`;
  const ch = a.changes.length ? `<ul class="mt-list mt-changes">${a.changes.map(c => `<li class="mt-change-${c.direction}">
      <span class="mt-arrow">${c.direction === "mejora" ? "↑" : "↓"}</span> ${esc(c.text)}
      <div class="td-muted mt-change-nums">Ventana ${fmtByFmt(c.fmt, c.week_value)} (${c.games_week} PJ) · resto ${fmtByFmt(c.fmt, c.rest_value)} (${c.games_rest} PJ) · diferencia ${c.fmt === "pct" ? fmtSigned(c.delta * 100, 1) + " pp" : fmtSigned(c.delta, 2)} · ${fmtNumber(Math.abs(c.z), 1)} desvíos ${sampleBadge(c.sample, { compact: true })}</div></li>`).join("")}</ul>`
    : `<p class="empty">${a.changes_basis && a.changes_basis.games_rest < a.changes_basis.min_rest ? `Hacen falta al menos ${a.changes_basis.min_rest} partidos anteriores a la ventana para detectar cambios bruscos.` : "Sin cambios bruscos en la ventana."}</p>`;
  return card("mt-alerts", "Alertas", `${head}<div class="mt-sub">Insights de la ventana</div>${ins}<div class="mt-sub">Cambios bruscos</div>${ch}`);
}

function _lastGames(d) {
  const failed = _failed(d, "last_games", "No se pudieron cargar los partidos.");
  if (failed) return card("mt-last", "Últimos partidos", failed);
  const rows = d.last_games || [];
  if (!rows.length) return card("mt-last", "Últimos partidos", '<p class="empty">Todavía no hay partidos.</p>');
  return card("mt-last", "Últimos partidos", `<table class="ld-table mt-table"><tbody>${rows.map(g => `<tr>
    <td>${fmtDay(g.date)}</td><td>${g.is_home ? "vs" : "@"} ${esc(g.rival.name || g.rival.code)}</td>
    <td>${g.score_own ?? "—"}-${g.score_rival ?? "—"}</td><td class="${g.result === "G" ? "mt-win" : "mt-loss"}">${esc(g.result || "")}</td>
    <td><a href="${esc(g.link)}" class="mt-game-link">Analizar</a></td></tr>`).join("")}</tbody></table>`);
}

function _lineups(d) {
  const failed = _failed(d, "top_lineups", "No se pudieron cargar los quintetos.");
  if (failed) return card("mt-lineups", "Quintetos más usados", failed);
  const t = d.top_lineups;
  if (!t.rows.length) return card("mt-lineups", "Quintetos más usados", `<p class="empty">${t.reason === "sin_pbp" ? "Sin play-by-play: no se pueden armar quintetos." : "Sin quintetos."}</p>`);
  return card("mt-lineups", "Quintetos más usados", `<ul class="mt-list mt-lineup-list">${t.rows.map(l => `<li>
    <a href="${esc(l.link)}">${esc(l.names)}</a>
    <div class="td-muted">${num(l.minutes)} min · ${num(l.possessions, 0)} posesiones · Net ${l.net_rating.value != null ? fmtMetric("net_rating", l.net_rating.value) : nullDisplay(l.net_rating.reason)} ${sampleBadge(l.sample, { compact: true })}</div></li>`).join("")}</ul>`);
}

function _followed(d) {
  const failed = _failed(d, "followed_players", "No se pudieron cargar los jugadores.");
  if (failed) return card("mt-followed", "Jugadores seguidos", failed);
  const f = d.followed_players;
  const body = f.rows.length ? `<div class="mt-players">${f.rows.map(p => p.available ? `<div class="mt-player" data-id="${p.followed_id ?? p.player_id}">
      <a href="${esc(p.link)}" class="mt-player-name">${esc(p.name)}</a> <span class="td-muted">${esc(p.team_code || "")}</span>
      <div class="mt-player-stats">${p.recent.games ? `Últ. ${p.recent.games}: <strong>${num(p.recent.metrics.pts)}</strong> pts · ${num(p.recent.metrics.trb)} reb · ${num(p.recent.metrics.ast)} ast · TS ${p.recent.metrics.ts_pct.value != null ? PCT(p.recent.metrics.ts_pct.value) : "—"} · ${num(p.recent.metrics.minutes)} min` : '<span class="td-muted">Sin partidos jugados.</span>'}</div>
      <button type="button" class="btn btn-ghost btn-sm mt-unfollow">Dejar de seguir</button></div>`
    : `<div class="mt-player mt-gone" data-id="${p.player_id}"><span>Jugador no disponible</span> <button type="button" class="btn btn-ghost btn-sm mt-unfollow">Dejar de seguir</button></div>`).join("")}</div>`
    : `<p class="empty">No seguís a ningún jugador. Buscá uno y tocá 'Seguir'.</p>`;
  return card("mt-followed", "Jugadores seguidos", `${body}${f.truncated ? `<p class="td-muted">Se muestran los primeros ${f.max}.</p>` : ""}
    <div class="mt-follow-add"><select class="map-select" id="mt-follow-select" aria-label="Seguir a un jugador"><option value="">Seguir a un jugador de tu equipo…</option></select></div>`);
}

export async function renderMyTeam(el, opts = {}) {
  if (!el) return;
  const token = ++_token;
  el.innerHTML = `<div class="mt-skel">${["Mi equipo", "Próximo partido", "Alertas"].map(t => card("", t, '<p class="empty"><span class="spinner"></span>Cargando…</p>')).join("")}</div>`;
  let d;
  try { d = await api.myTeam({}); }
  catch (e) {
    if (token !== _token) return;
    el.innerHTML = card("mt-error", "Mi equipo", `<p class="empty below-avg">${esc(_offline(e) ? "Sin conexión: Mi equipo necesita conexión." : "No se pudo cargar tu equipo.")}
      <button type="button" class="btn btn-ghost btn-sm mt-retry">Reintentar</button></p>`);
    el.querySelector(".mt-retry").addEventListener("click", () => renderMyTeam(el, opts));
    return;
  }
  if (token !== _token) return;
  if (!d.team || d.reason) {
    return _picker(el, opts, { note: d.reason === "equipo_sin_partidos" ? "Tu equipo fijado ya no tiene partidos importados. Elegí otro." : "" });
  }
  el.innerHTML = `<div class="mt-grid">${_header(d)}${_next(d, opts)}<div id="mt-plan" class="mt-span">${card("", "Plan de juego", '<p class="empty"><span class="spinner"></span>Calculando plan de juego…</p>')}</div>${_alerts(d)}
    <div class="mt-shortcuts">${_lastGames(d)}${_lineups(d)}${_followed(d)}</div></div>`;
  el.querySelectorAll(".mt-retry").forEach(b => b.addEventListener("click", () => renderMyTeam(el, opts)));
  el.querySelector("#mt-change").addEventListener("click", () => _picker(el, opts, { current: d.team.code }));
  el.querySelector("#mt-prepare")?.addEventListener("click", () => opts.onPrepare?.(d.team.code, d.next_fixture.rival.code, d.next_fixture.fixture_id));
  const nf = d.next_fixture;
  renderGamePlan(el.querySelector("#mt-plan"), d.team.code, {
    params: { competition: d.competition.id }, panelId: "mi-equipo.plan",
    nextFixture: nf ? { rival: nf.rival } : null, defaultReference: nf ? "rival_proximo" : "competencia",
  });
  el.querySelectorAll(".mt-unfollow").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.closest(".mt-player").dataset.id);
    try { await toggleFollow(id); } catch (e) { opts.toast?.(e.message || "No se pudo guardar.", "err"); return; }
    renderMyTeam(el, opts);
  }));
  const sel = el.querySelector("#mt-follow-select");
  if (sel) {
    api.players(d.team.code, { competition: d.competition.id }).then(list => {
      const followed = new Set((d.followed_players?.rows || []).map(p => p.player_id));
      sel.insertAdjacentHTML("beforeend", list.filter(p => p.player_id != null && !followed.has(p.player_id))
        .map(p => `<option value="${p.player_id}">${esc(p.name)}</option>`).join(""));
    }).catch(() => {});
    sel.addEventListener("change", async () => {
      const id = Number(sel.value);
      if (!id) return;
      try { await toggleFollow(id); } catch (e) { opts.toast?.(e.message || "No se pudo guardar.", "err"); sel.value = ""; return; }
      renderMyTeam(el, opts);
    });
  }
}
