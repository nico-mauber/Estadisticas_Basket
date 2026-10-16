// Panel de posibles duplicados y fusión manual de fichas de jugador (C-08).
// Se monta dentro de Datos → Calidad. La lógica de identidad vive en el backend (identity.py):
// acá solo se muestran los candidatos y se llama a POST /api/identity/merge.
import { api } from "../api.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const REASONS = {
  apellido_inicial:         "Mismo apellido e inicial",
  dorsal_apellido:          "Mismo dorsal y apellido parecido",
  nombre_completo_distinto: "Nombres completos distintos en la misma ficha",
};

const NO_CONNECTION = "Sin conexión: no se puede unificar ahora";

const playerLine = p => `<b>${esc(p.name)}</b>
  <span class="td-muted">${p.games} PJ${p.jerseys?.length ? ` · #${esc(p.jerseys.join(", #"))}` : ""}</span>`;

function itemHTML(it, idx, isAdmin) {
  const reason = REASONS[it.reason] ?? it.reason;
  const who = it.players.map(playerLine).join('<span class="dup-sep"> y </span>');
  const action = isAdmin && it.can_merge
    ? `<button class="btn btn-ghost btn-sm" data-merge="${idx}">Unificar</button>` : "";
  return `
    <li class="dup-item">
      <div class="dup-team">${esc(it.team_code)}</div>
      <div class="dup-players">${who}</div>
      <div class="dup-reason td-muted">${esc(reason)}</div>
      <div class="dup-action">${action}</div>
    </li>`;
}

// Dibuja el chequeo `possible_duplicates` (shape de GET /api/data-quality) dentro de `el`.
// `onMerged` se llama tras una fusión exitosa (el llamador recarga el informe).
export function renderDuplicateItems(el, check, { isAdmin = false, onMerged = () => {}, toast = () => {} } = {}) {
  if (!el) return;
  if (!check?.items?.length) {
    el.innerHTML = '<p class="td-muted">No se detectaron posibles duplicados en esta competencia</p>';
    return;
  }
  el.innerHTML = `<ul class="dup-list">${check.items.map((it, i) => itemHTML(it, i, isAdmin)).join("")}</ul>
    <p class="td-muted dup-note">Son avisos: la app solo une automáticamente los nombres que difieren en mayúsculas, tildes o espacios.
      Estos casos hay que confirmarlos a mano.</p>`;
  el.querySelectorAll("[data-merge]").forEach(btn =>
    btn.addEventListener("click", () => openMergeDialog(check.items[Number(btn.dataset.merge)], { onMerged, toast })));
}

// Modal: elegir qué ficha se conserva; la otra queda como alias y sus partidos se suman.
export function openMergeDialog(pair, { onMerged = () => {}, toast = () => {} } = {}) {
  const [a, b] = pair.players;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal">
      <h3>Unificar jugadores</h3>
      <p>Si son la misma persona, sus partidos se suman en una sola ficha. La otra queda como alias:
         seguirá encontrándose por su nombre.</p>
      <label class="modal-radio"><input type="radio" name="keep" value="${a.player_id}" checked>
        Conservar <b>${esc(a.name)}</b> <span class="td-muted">(${a.games} PJ)</span></label>
      <label class="modal-radio"><input type="radio" name="keep" value="${b.player_id}">
        Conservar <b>${esc(b.name)}</b> <span class="td-muted">(${b.games} PJ)</span></label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cancel>Cancelar</button>
        <button type="submit" class="btn btn-sm">Unificar</button>
      </div>
    </form>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", e => {
    if (e.target === backdrop || e.target.hasAttribute("data-cancel")) backdrop.remove();
  });
  const form = backdrop.querySelector("form");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const target = Number(new FormData(form).get("keep"));
    const source = target === a.player_id ? b.player_id : a.player_id;
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Unificando fichas…";
    try {
      const res = await api.mergePlayers(target, source);
      backdrop.remove();
      toast(`Fichas unificadas: ${res.player.display_name} ahora suma ${res.player.games} partidos`);
      onMerged(res);
    } catch (err) {
      toast(err instanceof TypeError ? NO_CONNECTION : err.message, "err");
      btn.disabled = false;
      btn.textContent = "Unificar";
    }
  });
}
