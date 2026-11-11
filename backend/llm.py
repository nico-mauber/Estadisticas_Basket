"""Sugerencias de quinteto asistidas por IA (F-15, Arq. §3.16).

El modelo no calcula nada: el backend arma un resumen determinista con filas de quintetos ya calculadas (las mismas
funciones que alimentan las tablas de Quintetos), con valores ya formateados, y el modelo solo redacta. Cita cada valor
con un marcador `{m:R<k>.<clave>}` que el backend reemplaza por el valor del resumen; una sugerencia con cualquier otra
cifra se descarta. Solo entran quintetos con muestra suficiente (T-02); si ninguno califica no se llama al modelo.

La función está apagada salvo que el entorno la habilite (`LLM_ENABLED`, `ANTHROPIC_API_KEY` y el paquete `anthropic`)
y la configuración la deje activa (`ai.suggestions_enabled`). Sin eso, el resto de la app no cambia.
"""
import json
import logging
import os
import re
import threading
import time
from collections import deque
from datetime import datetime, timezone

import cache
import config
import context as context_mod
import i18n
import metrics_catalog
import phrases
import repository

try:                                     # dependencia opcional (mismo patrón que Playwright)
    import anthropic
except ImportError:                      # pragma: no cover - depende del entorno
    anthropic = None

log = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_TOKENS = 16000
MAX_SUGGESTIONS = 3
DISCLAIMER = ("Sugerencia generada automáticamente a partir de datos ya calculados. Describe lo que ya ocurrió; "
              "no predice ni sustituye el criterio del entrenador.")

GOALS = {
    "anotar": "Anotar", "defender": "Defender", "reboteear": "Reboteear", "frenar_ritmo": "Frenar el ritmo",
    "cerrar": "Cerrar el partido", "vs_rival": "Contra un rival", "infrautilizados": "Quintetos infrautilizados",
    "a_evitar": "Quintetos a evitar", "cambio_pieza": "Cambios de una pieza", "lectura_cierres": "Lectura de cierres",
}

_TOKEN_RE = re.compile(r"(?<![\w.])[-+−]?\d+(?:[.,]\d+)?")
_MARKER_RE = re.compile(r"\{m:(R\d+)\.([a-z0-9_]+)\}")
_calls: dict = {}                 # owner → deque de instantes de llamadas reales al modelo (última hora)
_nonce: dict = {}                 # consulta → contador de «Regenerar»
_lock = threading.Lock()


class LlmError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details

    def payload(self) -> dict:
        out = {"error": self.message, "code": self.code}
        if self.details:
            out["details"] = self.details
        return out


class _Uncached(Exception):
    """Resultado que se devuelve sin guardarlo en la caché (un fallo no se reutiliza)."""
    def __init__(self, result: dict):
        super().__init__("uncached")
        self.result = result


# ── Disponibilidad ───────────────────────────────────────────────────────────

def _truthy(v) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "si", "sí", "on")


def llm_available() -> bool:
    """Entorno completo: bandera, clave y paquete."""
    return anthropic is not None and _truthy(os.environ.get("LLM_ENABLED")) and bool(os.environ.get("ANTHROPIC_API_KEY", "").strip())


def suggestions_enabled() -> bool:
    return llm_available() and bool(config.get("ai.suggestions_enabled"))


def model_name() -> str:
    return os.environ.get("LLM_MODEL", "").strip() or DEFAULT_MODEL


# ── Formato y validación de cifras ───────────────────────────────────────────

def _norm(tok: str) -> str:
    """Forma canónica de una cifra («1,50», «+1.5» y «1,5» son la misma; «−0» es «0»)."""
    t = tok.replace("−", "-").replace(",", ".").lstrip("+")
    try:
        f = float(t)
    except ValueError:
        return t
    return format(f if f != 0 else 0.0, ".12g")


def number_tokens(text: str) -> list:
    return [_norm(t) for t in _TOKEN_RE.findall(text or "")]


def validate_numbers(text: str, allowed: set) -> tuple:
    """`(todo_ok, tokens_fuera)`: cada cifra del texto debe existir en el resumen."""
    bad = [t for t in number_tokens(text) if t not in allowed]
    return (not bad, bad)


def _fmt(key: str, value, *, signed: bool = False) -> str:
    if key in metrics_catalog.METRICS:
        return phrases.format_value(key, value, delta=signed)
    return phrases._num(value, 1, signed=signed)


# ── Resumen determinista ─────────────────────────────────────────────────────

def _table_rows(table_id: str, args: dict) -> list:
    import tables
    payload = tables.build_table(table_id, args)
    keys = [c["key"] for c in payload["columns"]]
    out = []
    for r in payload["rows"]:
        vals = {k: v for k, v in zip(keys, r["values"])}
        pct = {k: p for k, p in zip(keys, r.get("pct") or []) if p is not None}
        out.append({"id": r["id"], "names": [n.strip() for n in str(vals.get("_players") or "").split("·") if n.strip()],
                    "sample": r.get("sample") or vals.get("_sample"), "vals": vals, "pct": pct, "adj": r.get("adj") or {}})
    return out


def _eligible(row) -> bool:
    s = row.get("sample") or {}
    return s.get("level") not in (None, "baja")


def _adj(row, key):
    a = (row.get("adj") or {}).get(key)
    return a.get("value") if isinstance(a, dict) else a


def _value(row, key):
    """Valor de una clave de la fila: `<métrica>_adj` es el ajustado de T-02; `p_<métrica>` su percentil."""
    if key.endswith("_adj"):
        return _adj(row, key[:-4])
    if key.startswith("p_"):
        return row["pct"].get(key[2:])
    if key.endswith("_band"):
        a = (row.get("adj") or {}).get(key[:-5])
        return a.get("band") if isinstance(a, dict) else None
    return row["vals"].get(key)


def _label(key: str) -> str:
    if key.endswith("_adj"):
        return f"{_label(key[:-4])} ajustado"
    if key.startswith("p_"):
        return f"Percentil de {_label(key[2:])}"
    if key.endswith("_band"):
        return f"Banda de {_label(key[:-5])}"
    m = metrics_catalog.METRICS.get(key)
    return m.label if m else {"minutes_share": "Participación en el tiempo del equipo", "_record": "Récord en cierres",
                              "_win_pct": "% de victorias en cierres", "_games_counted": "Cierres",
                              "_point_diff": "Diferencial en cierres", "mu_games": "Partidos del cruce",
                              "impact_out": "Impacto del que sale", "impact_in": "Impacto del que entra"}.get(key, key)


def _display(key: str, v) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    base = key[:-4] if key.endswith("_adj") else key[:-5] if key.endswith("_band") else key
    if key.startswith("p_"):
        return phrases._num(v, 0)
    if key == "minutes_share":
        return phrases._num(v, 1) + "%"
    if key in ("_games_counted", "mu_games"):
        return phrases._num(v, 0)
    if key in ("_point_diff",):
        return phrases._num(v, 0, signed=True)
    if key.startswith("d_"):
        return _fmt(key[2:], v, signed=True)
    if key.startswith("impact_"):
        return _fmt("net_rating", v, signed=True)
    return _fmt(base, v)


def _summary_row(k: int, src: dict, keys: list, extra: dict | None = None, *, team: str) -> dict | None:
    values = {}
    for key in keys:
        v = (extra or {}).get(key, _value(src, key)) if extra and key in extra else _value(src, key)
        d = _display(key, v)
        if d is None:
            continue                                  # un nulo nunca llega al modelo (C-11)
        values[key] = {"label": _label(key), "display": d}
    if not values:
        return None
    s = src.get("sample") or {}
    return {"row_id": f"R{k}", "lineup_id": src.get("lineup_id", src["id"]), "names": src["names"],
            "sample": {"level": s.get("level"), "n": phrases._num(s.get("n") or 0, 1), "unit": s.get("unit")},
            "table_link": f"#/equipo/{team}/quintetos", "values": values, "badge": s or None}


def _by(rows, key, *, desc=True):
    def k(r):
        v = _value(r, key)
        poss = r["vals"].get("possessions") or 0
        return (v is None, -(v if desc else -v) if v is not None else 0, -poss, str(r["id"]))
    return sorted(rows, key=k)


COLS = {
    "anotar": ("oer", True, ["oer_adj", "oer", "efg_pct", "ts_pct", "ppt", "ast_to", "to_pct", "possessions"]),
    "defender": ("der", False, ["der_adj", "der", "opp_efg_pct", "opp_to_pct", "dr_pct", "stl", "blk", "possessions"]),
    "reboteear": ("trb_pct", True, ["trb_pct", "or_pct", "dr_pct", "trb", "possessions"]),
    "frenar_ritmo": ("pace", False, ["pace", "sec_per_poss", "net_rating_adj", "oer_adj", "der_adj", "possessions"]),
}
CRITERIA = {
    "anotar": "Quintetos con muestra suficiente ordenados por OER ajustado, de mayor a menor",
    "defender": "Quintetos con muestra suficiente ordenados por DER ajustado, de menor a mayor (menos es mejor)",
    "reboteear": "Quintetos con muestra suficiente ordenados por porcentaje de rebotes, de mayor a menor",
    "frenar_ritmo": "Quintetos con muestra suficiente ordenados por ritmo, de menor a mayor",
    "cerrar": "Quintetos con muestra alta de cierres ordenados por porcentaje de victorias y diferencial en los finales ajustados",
    "lectura_cierres": "Quintetos con muestra alta de cierres ordenados por porcentaje de victorias y diferencial en los finales ajustados",
    "vs_rival": "Cruces de quintetos propios contra quintetos del rival con muestra suficiente, ordenados por Net Rating del cruce",
    "infrautilizados": "Quintetos con Net Rating ajustado alto en percentil y poca participación en el tiempo del equipo",
    "a_evitar": "Quintetos con muestra alta cuyo Net Rating ajustado es negativo aun en el extremo superior de su banda",
    "cambio_pieza": "Pares de quintetos que difieren en un solo jugador, con la diferencia de rendimiento entre ambos",
}


def _pids(lineup_id: str) -> list:
    try:
        return sorted(int(x) for x in str(lineup_id).split(":", 1)[1].split("-"))
    except (IndexError, ValueError):
        return []


def build_summary(team: str, comp_id: int, ctx, goal: str, rival: str | None) -> dict:
    """Resumen determinista (sin modelo): filas `R<k>` con valores formateados, criterio y conteos."""
    top = int(config.get("ai.top_n"))
    args = {"team": team, "base": "total", "competition": str(comp_id)}
    if ctx.last:
        args["last"] = str(ctx.last)
    lineups = _table_rows("team_lineups", args)
    elig = [r for r in lineups if _eligible(r)]
    min_poss = None
    if lineups:
        s0 = lineups[0].get("sample") or {}
        min_poss = s0.get("min")
    picked, extras = [], {}

    if goal in COLS:
        key, desc, cols = COLS[goal]
        picked = _by(elig, key, desc=desc)[:top]
    elif goal in ("cerrar", "lectura_cierres"):
        cl = [r for r in _table_rows("team_clutch_lineups", args) if (r.get("sample") or {}).get("level") == "alta"]

        def wp(r):
            try:
                return float(str(r["vals"].get("_win_pct") or "").rstrip("%").replace(",", "."))
            except ValueError:
                return -1
        cl.sort(key=lambda r: (-wp(r), -(r["vals"].get("_point_diff") or 0), -(r["vals"].get("_games_counted") or 0), str(r["id"])))
        picked = cl[:top + (2 if goal == "lectura_cierres" else 0)]
        cols = ["_record", "_win_pct", "_games_counted", "_point_diff", "net_rating_adj", "possessions"]
        elig = cl
    elif goal == "infrautilizados":
        team_min = sum((r["vals"].get("minutes") or 0) for r in lineups)
        pp = int(config.get("ai.perf_pct"))
        share_max = float(config.get("ai.low_usage_share"))
        cand = []
        for r in elig:
            p = r["pct"].get("net_rating")
            share = 100 * (r["vals"].get("minutes") or 0) / team_min if team_min else None
            if p is not None and share is not None and p >= pp and share <= share_max:
                extras[r["id"]] = {"minutes_share": share}
                cand.append((r, p, share))
        cand.sort(key=lambda t: (-t[1], t[2], str(t[0]["id"])))
        picked = [t[0] for t in cand[:top]]
        cols = ["net_rating_adj", "p_net_rating", "minutes", "minutes_share", "possessions"]
    elif goal == "a_evitar":
        cand = [r for r in elig if (r.get("sample") or {}).get("level") == "alta"
                and _adj(r, "net_rating") is not None and (_adj(r, "net_rating") + (_value(r, "net_rating_band") or 0)) < 0]
        picked = _by(cand, "net_rating_adj", desc=False)[:top]
        cols = ["net_rating_adj", "net_rating_band", "oer_adj", "der_adj", "possessions"]
    elif goal == "vs_rival":
        import matchups
        gids = [g.game_id for g in repository.competition_games(comp_id) if {g.home_code, g.away_code} == {team, rival}]
        mrows = matchups.team_matchups(team, rival, gids, "quinteto")["rows"] if gids else []
        own_ok = {r["id"]: r for r in elig}
        cand = []
        for m in mrows:
            own_id = m["id"].split("|")[0]
            if (m.get("sample") or {}).get("level") in (None, "baja") or own_id not in own_ok or m.get("net_rating") is None:
                continue
            cand.append(m)
        cand.sort(key=lambda m: (-m["net_rating"], -(m.get("possessions") or 0), m["id"]))
        for m in cand[:top]:
            own = own_ok[m["id"].split("|")[0]]
            picked.append({"id": m["id"], "lineup_id": own["id"], "names": own["names"], "sample": m["sample"], "pct": {}, "adj": own["adj"],
                           "vals": {"net_rating": m["net_rating"], "oer": m["oer"], "der": m["der"], "possessions": m["possessions"],
                                    "mu_games": len(m.get("games") or []), "opp": m["opp_name"]}})
        cols = ["net_rating", "oer", "der", "possessions", "mu_games", "net_rating_adj"]
        elig = cand
    elif goal == "cambio_pieza":
        import synergy
        imp = {x["id"]: x.get("impact_net") for x in (synergy.synergy(team, comp_id, ctx).get("teammate_impact") or [])}
        by_id = {r["id"]: r for r in elig}
        pairs = []
        ids = sorted(by_id)
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                pa, pb = set(_pids(a)), set(_pids(b))
                if len(pa) == 5 and len(pb) == 5 and len(pa & pb) == 4:
                    A, B = by_id[a], by_id[b]
                    if (B["vals"].get("minutes") or 0) > (A["vals"].get("minutes") or 0):
                        A, B, pa, pb = B, A, pb, pa
                    na, nb = _adj(A, "net_rating"), _adj(B, "net_rating")
                    if na is None or nb is None:
                        continue
                    out_id, in_id = (pa - pb).pop(), (pb - pa).pop()
                    pairs.append((A, B, out_id, in_id, nb - na))
        pairs.sort(key=lambda t: (-abs(t[4]), str(t[0]["id"]), str(t[1]["id"])))
        for A, B, out_id, in_id, dn in pairs[:top]:
            def dv(k):
                x, y = _value(A, k), _value(B, k)
                return None if x is None or y is None else y - x
            name_out = next((n for n in A["names"] if n not in B["names"]), str(out_id))
            name_in = next((n for n in B["names"] if n not in A["names"]), str(in_id))
            ex = {"d_net_rating": dn, "d_oer": dv("oer"), "d_der": dv("der"), "d_efg_pct": dv("efg_pct"), "d_trb_pct": dv("trb_pct"),
                  "d_to_pct": dv("to_pct"), "impact_out": imp.get(out_id), "impact_in": imp.get(in_id)}
            picked.append({"id": f"{A['id']}>{B['id']}", "lineup_id": B["id"], "names": B["names"], "sample": B["sample"],
                           "pct": {}, "adj": {}, "vals": {}, "pair": {"out": name_out, "in": name_in, "from": A["names"]}, "_extra": ex})
        cols = ["d_net_rating", "d_oer", "d_der", "d_efg_pct", "d_trb_pct", "d_to_pct", "impact_out", "impact_in"]
        elig = pairs
    else:
        raise LlmError(400, "parametro_invalido", "Elegí un tipo de lectura válido", {"param": "goal"})

    rows = []
    for r in picked:
        ex = r.get("_extra") or extras.get(r["id"]) or {}
        row = _summary_row(len(rows) + 1, r, cols, ex, team=team)
        if row is None:
            continue
        if r.get("pair"):
            row["change"] = r["pair"]
        if goal == "vs_rival":
            row["rival_lineup"] = r["vals"].get("opp")
        rows.append(row)
    label = repository.competition_labels().get(comp_id)
    return {"goal": goal, "goal_label": GOALS[goal], "criterion": CRITERIA[goal], "team": team,
            "team_name": _team_name(team), "rival": rival, "context_label": label or "", "lang": i18n.current_lang(), "rows": rows,
            "considered": {"rows": len(rows), "eligible": len(elig), "lineups": len(lineups),
                           "min_poss": min_poss}}


def _team_name(code):
    import fixtures
    return fixtures.team_names().get(code, code)


def _allowed(summary: dict) -> set:
    toks = set()
    for r in summary["rows"]:
        for v in r["values"].values():
            toks.update(number_tokens(v["display"]))
        toks.update(number_tokens(r["sample"]["n"]))
        toks.update(number_tokens(" ".join(r["names"])))
        for k in ("change",):
            if r.get(k):
                toks.update(number_tokens(json.dumps(r[k], ensure_ascii=False)))
        if r.get("rival_lineup"):
            toks.update(number_tokens(r["rival_lineup"]))
    toks.update(number_tokens(summary.get("team_name") or ""))
    toks.update(number_tokens(summary.get("context_label") or ""))
    return toks


def _model_input(summary: dict) -> dict:
    """Lo único que viaja al servicio externo: filas con nombres y valores formateados (sin ids, eventos ni partidos)."""
    rows = []
    for r in summary["rows"]:
        x = {"row_id": r["row_id"], "names": r["names"], "sample": r["sample"],
             "values": {k: {"label": v["label"], "display": v["display"]} for k, v in r["values"].items()}}
        if r.get("change"):
            x["change"] = r["change"]
        if r.get("rival_lineup"):
            x["rival_lineup"] = r["rival_lineup"]
        rows.append(x)
    return {"goal": summary["goal"], "goal_label": summary["goal_label"], "criterion": summary["criterion"],
            "team_name": summary["team_name"], "context_label": summary["context_label"], "lang": summary["lang"], "rows": rows}


# ── Modelo ───────────────────────────────────────────────────────────────────

SYSTEM = (
    "Sos un redactor de lecturas de básquet para un cuerpo técnico. Recibís un resumen JSON ya calculado con filas "
    "R1, R2…; cada fila tiene valores listos para citar. Escribí en español rioplatense, en tono directo y profesional.\n"
    "Reglas:\n"
    "1. No calculás, no estimás y no comparás cifras por tu cuenta: solo citás los valores del resumen.\n"
    "2. Para nombrar un valor escribí el marcador {m:R<k>.<clave>} con una clave que exista en esa fila; el sistema lo "
    "reemplaza por el valor exacto.\n"
    "3. No escribas ningún dígito fuera de los marcadores (ni en el título): una sugerencia con otra cifra se descarta.\n"
    "4. Describí lo que ya ocurrió: sin predicciones y sin hablar de lesiones, faltas, estado físico ni decisiones tácticas.\n"
    "5. Cada sugerencia lista en row_ids las filas que cita; solo podés citar filas de esa lista.\n"
    "6. Como máximo tres sugerencias. Si no podés redactar algo verificable, devolvé suggestions vacío.\n"
    "7. El campo criterion explica por qué se eligieron esas filas; respetá ese orden y no inventes otro criterio."
)

SCHEMA = {
    "type": "object",
    "properties": {"suggestions": {"type": "array", "items": {
        "type": "object",
        "properties": {"title": {"type": "string"}, "text": {"type": "string"},
                       "row_ids": {"type": "array", "items": {"type": "string"}}},
        "required": ["title", "text", "row_ids"], "additionalProperties": False}}},
    "required": ["suggestions"], "additionalProperties": False,
}


def _new_client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"],
                               timeout=float(os.environ.get("LLM_TIMEOUT_SECS") or 60),
                               max_retries=int(os.environ.get("LLM_MAX_RETRIES") or 1))


def _request_kwargs(summary: dict) -> dict:
    model = model_name()
    output_config = {"format": {"type": "json_schema", "schema": SCHEMA}}
    effort = (os.environ.get("LLM_EFFORT") or "medium").strip().lower()
    if effort in ("low", "medium", "high", "xhigh", "max"):
        output_config["effort"] = effort
    lang = summary.get("lang") or "es"
    extra = f"8. Escribí el título y el texto de cada sugerencia en {i18n.NAMES[lang]} (el resumen viene en español: los marcadores no cambian)."
    system = SYSTEM if lang == "es" else SYSTEM + "\n" + extra
    kw = {"model": model, "max_tokens": MAX_TOKENS, "system": system, "output_config": output_config,
          "messages": [{"role": "user", "content": json.dumps(_model_input(summary), ensure_ascii=False)}]}
    # Reintento del lado del servidor ante una negativa (la elige Anthropic por categoría). Haiku no lo admite.
    if (os.environ.get("LLM_FALLBACKS") or "default").strip().lower() != "off" and not model.startswith("claude-haiku"):
        kw["betas"] = [FALLBACK_BETA]
        kw["fallbacks"] = "default"
    return kw


def _call_model(summary: dict) -> dict:
    """`{"stop_reason", "data" (dict o None), "model"}`. Errores de red/HTTP → LlmError 502."""
    t0 = time.monotonic()
    try:
        resp = _new_client().beta.messages.create(**_request_kwargs(summary))
    except anthropic.APITimeoutError:
        log.warning("IA: tiempo agotado (%s)", summary["goal"])
        raise LlmError(502, "timeout_externo", "El servicio de IA no respondió a tiempo. Probá de nuevo en unos minutos.")
    except anthropic.APIStatusError as e:
        log.error("IA: error HTTP %s (%s): %s", e.status_code, summary["goal"], getattr(e, "message", e))
        raise LlmError(502, "llm_error", "No se pudo generar la lectura. Probá de nuevo en unos minutos.")
    except anthropic.APIConnectionError as e:
        log.error("IA: sin conexión con el servicio (%s): %s", summary["goal"], e)
        raise LlmError(502, "llm_error", "No se pudo generar la lectura. Probá de nuevo en unos minutos.")
    usage = getattr(resp, "usage", None)
    log.info("IA: %s · %s · %s tokens de entrada · %s de salida · %.1f s · %s", summary["goal"], getattr(resp, "model", model_name()),
             getattr(usage, "input_tokens", "?"), getattr(usage, "output_tokens", "?"), time.monotonic() - t0, resp.stop_reason)
    if resp.stop_reason == "refusal":
        return {"stop_reason": "refusal", "data": None, "model": getattr(resp, "model", None)}
    text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
    try:
        data = json.loads(text) if resp.stop_reason != "max_tokens" else None
    except (TypeError, ValueError):
        data = None
    return {"stop_reason": resp.stop_reason, "data": data, "model": getattr(resp, "model", None)}


# ── Validación de la respuesta ───────────────────────────────────────────────

def process(raw: dict, summary: dict) -> tuple:
    """`(sugerencias válidas, descartadas)`. Una sugerencia se descarta si cita una fila que no lista, un marcador
    inexistente o cualquier cifra que no esté en el resumen."""
    rows = {r["row_id"]: r for r in summary["rows"]}
    allowed = _allowed(summary)
    names_allowed = set()
    for r in summary["rows"]:
        names_allowed.update(number_tokens(" ".join(r["names"])))
    names_allowed.update(number_tokens(summary.get("team_name") or ""))
    out, discarded = [], 0
    for s in ((raw or {}).get("suggestions") or [])[:10]:
        try:
            title, text, ids = str(s["title"]).strip(), str(s["text"]).strip(), list(s["row_ids"])
        except (KeyError, TypeError):
            discarded += 1
            continue
        ok = bool(title and text and ids) and all(i in rows for i in ids)
        if ok:
            bare = _MARKER_RE.sub(" ", f"{title} {text}")
            ok = all(t in names_allowed for t in number_tokens(bare))      # sin cifras fuera de marcadores
        resolved = {}
        if ok:
            def sub(m):
                rid, key = m.group(1), m.group(2)
                if rid not in ids or key not in rows[rid]["values"]:
                    raise KeyError(key)
                return rows[rid]["values"][key]["display"]
            try:
                resolved = {"title": _MARKER_RE.sub(sub, title), "text": _MARKER_RE.sub(sub, text)}
            except KeyError:
                ok = False
        if ok:
            ok = validate_numbers(resolved["title"] + " " + resolved["text"], allowed)[0]
        if not ok:
            discarded += 1
            continue
        out.append({**resolved, "supporting_rows": [rows[i] for i in dict.fromkeys(ids)]})
        if len(out) >= MAX_SUGGESTIONS:
            break
    return out, discarded


# ── Orquestación ─────────────────────────────────────────────────────────────

def _rate_limit(owner: str) -> None:
    limit = int(config.get("ai.max_calls_per_hour"))
    now = time.monotonic()
    with _lock:
        dq = _calls.setdefault(owner, deque())
        while dq and now - dq[0] > 3600:
            dq.popleft()
        if len(dq) >= limit:
            raise LlmError(429, "limite_ia", f"Se alcanzó el límite de {limit} generaciones por hora.", {"limit": limit})
        dq.append(now)


def lineup_suggestions(team: str, comp_id: int, ctx, goal: str, rival: str | None, *, owner: str, refresh: bool = False) -> dict:
    if not suggestions_enabled():
        raise LlmError(503, "llm_deshabilitado", "Las sugerencias asistidas por IA no están disponibles.")
    if goal not in GOALS:
        raise LlmError(400, "parametro_invalido", "Elegí un tipo de lectura válido", {"param": "goal"})
    if goal == "vs_rival":
        if not rival:
            raise LlmError(400, "parametro_invalido", "Elegí el rival", {"param": "rival"})
        if rival == team:
            raise LlmError(400, "parametro_invalido", "El rival debe ser distinto de tu equipo", {"param": "rival"})
    summary = build_summary(team, comp_id, ctx, goal, rival)
    label = repository.competition_labels().get(comp_id)
    base = {"team": {"code": team, "name": summary["team_name"]}, "goal": goal, "rival": rival,
            "competition": {"id": comp_id, "label": label}, "disclaimer": DISCLAIMER, "considered": summary["considered"],
            "context": context_mod.context_echo(ctx, games_used=0, games_total=0, games_excluded={}, ignored=[], competition_label=label)}
    if not summary["rows"]:
        return {**base, "suggestions": [], "generated": False, "reason": "sin_quintetos_sobre_umbral", "discarded": 0, "cached": False}
    qkey = (team, comp_id, context_mod.context_key(ctx), goal, rival, i18n.current_lang())
    with _lock:
        if refresh:
            _nonce[qkey] = _nonce.get(qkey, 0) + 1
        nonce = _nonce.get(qkey, 0)
    state = {"fresh": False}

    def produce():
        state["fresh"] = True
        _rate_limit(owner)
        raw = _call_model(summary)
        if raw["stop_reason"] == "refusal":
            raise _Uncached({**base, "suggestions": [], "generated": False, "reason": "rechazo_modelo", "discarded": 0})
        sugg, discarded = process(raw["data"], summary)
        result = {**base, "suggestions": sugg, "generated": bool(sugg), "discarded": discarded, "model": raw.get("model") or model_name(),
                  "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "reason": None if sugg else "validacion_fallida"}
        if not sugg:
            raise _Uncached(result)
        return result
    try:
        res = cache.memo("llm", qkey + (nonce,), produce)
    except _Uncached as u:
        return {**u.result, "cached": False}
    return {**res, "cached": not state["fresh"]}
