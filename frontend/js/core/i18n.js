// ── Idiomas de la interfaz (F-21) ────────────────────────────────────────────
// Español (idioma de origen), inglés y portugués. Los textos de la app están escritos en español; los diccionarios
// `/i18n/en.json` y `/i18n/pt.json` mapean el texto en español a su traducción (clave = texto de origen, como gettext),
// con `{#}` en la clave por cada número y `{1}`, `{2}`… en el valor para volver a ponerlos. Con el idioma activo distinto de
// español, un traductor del DOM reemplaza los textos y atributos (title, placeholder, aria-label, alt) que figuran en el
// diccionario y deja el resto tal cual (nombres de equipos, jugadores y competencias no se traducen, ni lo que no tiene
// traducción: nunca se muestra una clave). Los números y fechas generados por la app se adaptan al idioma. En español el
// traductor no corre: el comportamiento es el de siempre.
//
// Los textos que no pasan por el DOM (rótulos de gráficos, nombres de archivo, textos de exportación) usan `tText()`.

export const LANGS = [["es", "Español"], ["en", "English"], ["pt", "Português"]];
const LOCALES = { es: "es-UY", en: "en-US", pt: "pt-BR" };
const LS_KEY = "sb.lang";
const ATTRS = ["title", "placeholder", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);
// Número suelto (no pegado a letras: «T2c», «R1» y «2P» quedan literales).
const NUM_RE = /(?<![\p{L}\d])\d+(?:[.,]\d+)*(?![\p{L}])/gu;

let _lang = "es";
let _dict = {};
let _obs = null;
let _debug = false;
let _srcTitle = null;
const _dicts = {};
const _misses = new Set();
const _listeners = [];

export const isLanguage = l => LANGS.some(([c]) => c === l);
export const getLanguage = () => _lang;
export const getLocale = () => LOCALES[_lang] || LOCALES.es;
export const languageName = code => (LANGS.find(([c]) => c === code) || [])[1] || code;
export const onLanguageChange = fn => { _listeners.push(fn); };

export function deviceLanguage() {
  try { const l = localStorage.getItem(LS_KEY); return isLanguage(l) ? l : null; } catch { return null; }
}

/** Textos visibles que no tenían traducción desde que se activó el idioma (para la verificación; solo inglés y portugués). */
export const i18nMisses = () => [..._misses].sort();

// ── Traducción de un texto ───────────────────────────────────────────────────
function _template(core) {
  const nums = [];
  const key = core.replace(/\s+/g, " ").replace(NUM_RE, m => { nums.push(m); return "{#}"; });
  return { key, nums };
}
const _fill = (value, nums) => value.replace(/\{(\d+)\}/g, (_, i) => nums[Number(i) - 1] ?? "");

function _lookup(core) {
  const { key, nums } = _template(core);
  let v = _dict[key];
  if (v !== undefined) return _fill(v, nums);
  // «Texto:», «Texto…» y «Texto.» se traducen con la entrada del texto sin el cierre.
  const m = /^(.*?)([:…\.]+)$/.exec(key);
  if (m && _dict[m[1]] !== undefined) return _fill(_dict[m[1]], nums) + m[2];
  return undefined;
}

function _translateCore(core) {
  const whole = _lookup(core);
  if (whole !== undefined) return whole;
  // «Últimos 5 · Local · 12 partidos»: se traduce por tramos.
  for (const sep of [" · ", " | ", " — "]) {
    if (core.includes(sep)) {
      const parts = core.split(sep);
      const out = parts.map(p => _translateCore(p.trim()));
      return out.some(x => x !== undefined) ? parts.map((p, i) => out[i] ?? p).join(sep) : undefined;
    }
  }
  // «Líder: R. Brause 12,3» y «Jugadores similares a R. Brause»: se traduce el rótulo y se deja el resto (nombres, números).
  const colon = /^([^:]{2,60}:)(\s+)([\s\S]+)$/.exec(core);
  if (colon) {
    const head = _lookup(colon[1]);
    if (head !== undefined) return head + colon[2] + colon[3];
  }
  for (const [prefix, value] of _prefixes()) {
    if (core.startsWith(prefix) && core.length > prefix.length) return value.replace("⁂", core.slice(prefix.length));
  }
  if (/\p{L}{2}/u.test(core)) _misses.add(_template(core).key);      // sin traducción: queda en español y se registra
  return undefined;
}

// Entradas «Texto de origen ⁂» → «Translated text ⁂»: el resto del texto (un nombre, un valor) se conserva.
let _prefixCache = null, _prefixFor = null;
function _prefixes() {
  if (_prefixFor !== _dict) {
    _prefixFor = _dict;
    _prefixCache = Object.entries(_dict).filter(([k]) => k.endsWith("⁂")).map(([k, v]) => [k.slice(0, -1), v])
      .sort((a, b) => b[0].length - a[0].length);
  }
  return _prefixCache;
}

function _localizeNumbers(s) {
  if (_lang !== "en") return s;
  return s.replace(/(\d),(\d)/g, "$1.$2").replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, "$2/$1/$3");
}

/** Traduce un texto en español al idioma activo (con respaldo en español y números adaptados). */
export function tText(src, params) {
  let s = String(src ?? "");
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");
  if (_lang === "es") return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (!m[2]) return s;
  const out = _translateCore(m[2]);
  return m[1] + _localizeNumbers(out === undefined ? m[2] : (_debug ? `⟦${out}⟧` : out)) + m[3];
}

/** Plural simple: `tn(n, "partido", "partidos")` → texto en español traducible por el diccionario. */
export const tn = (n, one, many) => tText(Number(n) === 1 ? one : many);

// ── Traductor del DOM ────────────────────────────────────────────────────────
function _skip(node) {
  for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName) || el.getAttribute?.("translate") === "no" || el.classList?.contains("notranslate")) return true;
  }
  return false;
}

function _text(node) {
  const st = node.__i18n, cur = node.data;
  if (st && st.out === cur && st.lang === _lang) return;
  const src = st && st.out === cur ? st.src : cur;          // si el texto cambió desde afuera, es un original nuevo
  const out = _lang === "es" ? src : tText(src);
  node.__i18n = { src, out, lang: _lang };
  if (out !== cur) node.data = out;
}

function _attrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const st = (el.__i18nA ||= {})[a], cur = el.getAttribute(a);
    if (st && st.out === cur && st.lang === _lang) continue;
    const src = st && st.out === cur ? st.src : cur;
    const out = _lang === "es" ? src : tText(src);
    el.__i18nA[a] = { src, out, lang: _lang };
    if (out !== cur) el.setAttribute(a, out);
  }
  if (el.tagName === "INPUT" && (el.type === "button" || el.type === "submit") && el.value) {
    const st = (el.__i18nA ||= {}).value, cur = el.value;
    if (!(st && st.out === cur && st.lang === _lang)) {
      const src = st && st.out === cur ? st.src : cur;
      const out = _lang === "es" ? src : tText(src);
      el.__i18nA.value = { src, out, lang: _lang };
      el.value = out;
    }
  }
}

function _subtree(root) {
  if (!root || _skip(root)) return;
  if (root.nodeType === 3) { _text(root); return; }
  if (root.nodeType !== 1) return;
  _attrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { if (!_skip(n)) _text(n); }
    else if (!SKIP_TAGS.has(n.tagName) && n.getAttribute("translate") !== "no") _attrs(n);
  }
}

function _start() {
  if (_obs || typeof MutationObserver === "undefined") return;
  _obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === "childList") m.addedNodes.forEach(n => _subtree(n));
      else if (m.type === "characterData") { if (!_skip(m.target)) _text(m.target); }
      else if (m.type === "attributes") { if (!_skip(m.target)) _attrs(m.target); }
    }
  });
  _obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

function _stop() { _obs?.disconnect(); _obs = null; }

function _applyDocument() {
  document.documentElement.lang = _lang;
  _srcTitle ??= document.title;
  document.title = tText(_srcTitle);
  if (document.body) _subtree(document.body);
}

// ── Carga y cambio de idioma ─────────────────────────────────────────────────
export async function loadDictionary(lang) {
  if (lang === "es") return {};
  if (_dicts[lang]) return _dicts[lang];
  const res = await fetch(`/i18n/${lang}.json`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`diccionario ${lang}: ${res.status}`);
  _dicts[lang] = await res.json();
  return _dicts[lang];
}

/** Activa un idioma (carga su diccionario). Si no se puede cargar, mantiene el actual y lanza el error. */
export async function setLanguage(lang, { remember = true } = {}) {
  if (!isLanguage(lang)) lang = "es";
  const dict = await loadDictionary(lang);
  const changed = lang !== _lang;
  _lang = lang;
  _dict = dict;
  _debug = /(?:\?|&)i18n=debug\b/.test(location.search);
  if (remember) { try { localStorage.setItem(LS_KEY, lang); } catch { /* sin storage */ } }
  _misses.clear();
  if (lang === "es") _stop(); else _start();
  if (document.body) _applyDocument();
  if (changed) _listeners.forEach(fn => { try { fn(lang); } catch (e) { console.error(e); } });
  return lang;
}

/** Idioma inicial antes de dibujar la app: el dispositivo o el indicado; sin diccionario disponible queda en español. */
export async function initI18n(lang) {
  try { await setLanguage(isLanguage(lang) ? lang : "es", { remember: false }); }
  catch { _lang = "es"; _dict = {}; document.documentElement.lang = "es"; }
  return _lang;
}
