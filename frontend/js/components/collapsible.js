// ── Panel plegable genérico (X-01 CA-14) ─────────────────────────────────────
// Convierte una tarjeta con `.card-title` en plegable: el título lleva un botón ▾/▸ y el resto de la tarjeta queda en
// `.cd-body`. El estado se recuerda POR USUARIO en la preferencia `panel.collapsed[<key>]` (servidor, F-13 prefs) y, mientras
// las preferencias no cargaron o si no hay sesión, en `sessionStorage`. Al abrir se dispara `resize` para que los gráficos
// recalculen su ancho.
import { loadPrefs, getPref, setPref } from "../core/prefs.js";

let _prefs = null;

function _session(key) {
  try { const v = sessionStorage.getItem(`sb.cd.${key}`); return v == null ? null : v === "1"; } catch { return null; }
}
function _saveSession(key, open) {
  try { sessionStorage.setItem(`sb.cd.${key}`, open ? "1" : "0"); } catch { /* sin almacenamiento */ }
}

/** `card`: elemento con `.card-title`. `key`: id estable del panel. `defaultOpen`: estado sin preferencia guardada. */
export function makeCollapsible(card, key, { defaultOpen = true } = {}) {
  if (!card || card.dataset.collapsible) return;
  const title = card.querySelector(".card-title");
  if (!title) return;
  card.dataset.collapsible = "1";
  const header = title.closest(".map-header") || title;
  const body = document.createElement("div");
  body.className = "cd-body";
  while (header.nextSibling) body.appendChild(header.nextSibling);
  card.appendChild(body);
  const sess = _session(key);
  let open = sess == null ? defaultOpen : sess;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cd-toggle";
  btn.setAttribute("aria-label", "Mostrar u ocultar");
  const apply = () => {
    body.hidden = !open;
    card.classList.toggle("cd-collapsed", !open);
    btn.textContent = open ? "▾" : "▸";
    btn.setAttribute("aria-expanded", String(open));
  };
  let touched = false;   // un clic del usuario antes de que lleguen las preferencias manda sobre ellas
  btn.addEventListener("click", e => {
    e.stopPropagation();
    touched = true;
    open = !open;
    apply();
    _saveSession(key, open);
    setPref("panel.collapsed", key, !open).catch(() => {});
    if (open) window.dispatchEvent(new Event("resize"));
  });
  header.classList.add("cd-header");
  header.appendChild(btn);
  apply();
  // La preferencia del usuario (otro dispositivo, otra sesión) manda sobre el valor por defecto.
  _prefs ??= loadPrefs("panel.collapsed").catch(() => null);
  _prefs.then(() => {
    const saved = getPref("panel.collapsed", key, null);
    if (touched || saved === null || saved === undefined || !card.isConnected) return;
    const want = saved !== true;
    if (want !== open) { open = want; apply(); _saveSession(key, open); }
  });
}
