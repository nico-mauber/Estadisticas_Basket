// ── Pestañas de sección (X-01) ───────────────────────────────────────────────
// Una fila de pestañas (desplazable en móvil, con la activa visible). El contenido de cada pestaña son los bloques de la
// sección marcados con `data-tabs="<pestaña> …"` (`*` = siempre): `applyTabs` muestra los de la pestaña activa y oculta el resto.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Dibuja la fila en `el`. `tabs`: `[[id, etiqueta], …]`; `onSelect(id)` se llama al elegir una distinta de la activa. */
export function renderTabs(el, tabs, active, onSelect) {
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `<div class="tabs-row" role="tablist">${tabs.map(([id, label]) =>
    `<button type="button" role="tab" class="tab-btn${id === active ? " active" : ""}" data-tab="${esc(id)}" aria-selected="${id === active}">${esc(label)}</button>`).join("")}</div>`;
  el.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.tab !== active) onSelect?.(b.dataset.tab);
  }));
  el.querySelector(".tab-btn.active")?.scrollIntoView?.({ block: "nearest", inline: "center" });
}

/** Muestra los bloques de `root` que pertenecen a la pestaña `active` y oculta los demás. */
export function applyTabs(root, active) {
  if (!root) return;
  root.querySelectorAll("[data-tabs]").forEach(node => {
    const tabs = node.dataset.tabs.split(/\s+/);
    node.classList.toggle("tab-hidden", !(tabs.includes("*") || tabs.includes(active)));
  });
}

/** Reaplica las pestañas cada vez que la sección re-dibuja su contenido (los bloques se crean después de cargar los datos). */
export function watchTabs(root, getActive) {
  if (!root || root._tabsWatcher) return;
  let queued = false;
  const run = () => { queued = false; applyTabs(root, getActive()); };
  root._tabsWatcher = new MutationObserver(() => { if (!queued) { queued = true; queueMicrotask(run); } });
  root._tabsWatcher.observe(root, { childList: true, subtree: true });
}
