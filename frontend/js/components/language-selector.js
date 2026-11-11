// Selector de idioma (F-21): botón con el código del idioma activo y una lista con los tres nombres (siempre en su propio
// idioma). Se usa en la cabecera, en la pantalla de inicio de sesión y como control de Preferencias. Elegir un idioma lo
// activa de inmediato y lo guarda como preferencia del usuario (`ui · language`) con copia en el dispositivo.
import { LANGS, getLanguage, setLanguage, onLanguageChange, tText } from "../core/i18n.js";
import { setPref } from "../core/prefs.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Cambia el idioma y lo recuerda. Con `persist` (sesión iniciada) lo guarda también en el servidor. */
export async function chooseLanguage(lang, { persist = true, toast } = {}) {
  const before = getLanguage();
  try {
    await setLanguage(lang);
  } catch {
    toast?.(tText("No se pudo cambiar el idioma. Se mantiene {idioma}.", { idioma: LANGS.find(([c]) => c === before)?.[1] || before }), "err");
    return false;
  }
  if (persist) {
    try { await setPref("ui", "language", lang); } catch { /* queda en el dispositivo */ }
  }
  return true;
}

/** Botón + menú. `onPick(lang)` decide cómo guardar (en la pantalla de login no hay sesión). */
export function mountLanguageSelector(el, { onPick } = {}) {
  if (!el) return;
  const draw = () => {
    const cur = getLanguage();
    el.innerHTML = `<button type="button" class="lang-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="Idioma" title="Idioma">
        <span class="lang-globe" aria-hidden="true">🌐</span><span class="lang-code">${cur.toUpperCase()}</span></button>
      <ul class="lang-menu" role="listbox" hidden>${LANGS.map(([c, name]) =>
        `<li role="option" tabindex="0" data-lang="${c}" aria-selected="${c === cur}" lang="${c}" translate="no">${esc(name)}${c === cur ? " ✓" : ""}</li>`).join("")}</ul>`;
    const btn = el.querySelector(".lang-btn"), menu = el.querySelector(".lang-menu");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute("aria-expanded", String(!menu.hidden)); });
    menu.querySelectorAll("li").forEach(li => {
      const pick = async () => { close(); if (li.dataset.lang !== getLanguage()) await onPick?.(li.dataset.lang); };
      li.addEventListener("click", pick);
      li.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
  };
  draw();
  document.addEventListener("click", e => {
    const menu = el.querySelector(".lang-menu");
    if (menu && !menu.hidden && !el.contains(e.target)) { menu.hidden = true; el.querySelector(".lang-btn")?.setAttribute("aria-expanded", "false"); }
  });
  onLanguageChange(() => { if (el.isConnected) draw(); });
}
