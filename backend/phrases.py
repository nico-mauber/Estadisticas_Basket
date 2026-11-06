"""Motor de frases y plan de juego (F-17).

Dos piezas:
- Plantillas fijas por métrica y por disparo (`phrases/es.json`), con marcadores y reglas de validación. No se genera
  texto libre: cada frase es la plantilla de esa métrica en esa dirección (ventaja o riesgo). A-10 y F-03 reutilizan el
  mismo motor.
- `game_plan`: para un equipo, las métricas donde está mejor y peor que una referencia (competencia, un rival o su propio
  período anterior). Cada ítem sale de la misma población que la ficha de T-01, así que se puede verificar contra la
  tabla de métricas de la pantalla.

Orden de los ítems: puntaje `z` = diferencia orientada / desvío poblacional de la métrica. Las diferencias en distintas
unidades (puntos porcentuales, OER) no son comparables; el puntaje sí.
"""
import json
import logging
import os
import re
import statistics
from decimal import ROUND_HALF_UP, Decimal

import cache
import config
import context as context_mod
import metrics_catalog
import population
import repository
import sample as sample_mod
import stats_engine
from context import Context

log = logging.getLogger(__name__)

PHRASES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "phrases")
LANGS = ("es",)
MARKERS = ("entidad", "metrica", "valor", "referencia", "delta", "p", "media", "rival")
WHEN_VALUES = ("ventaja", "riesgo", "extremo_alto", "extremo_bajo", "cambio_mejora", "cambio_empeora")
REFERENCES = ("competencia", "rival", "periodo_anterior", "rival_proximo")
MODES = ("perfil", "matchup")
MAX_LEN = {"ventaja": 100, "riesgo": 100, "extremo_alto": 160, "extremo_bajo": 160,   # A-10 agrega los de insights
           "cambio_mejora": 160, "cambio_empeora": 160}                                   # F-12: cambios bruscos


class PhraseError(Exception):
    """Error del plan de juego con código estable y estado HTTP (la ruta lo traduce al formato de la API)."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


# ── Archivos de datos ────────────────────────────────────────────────────────

_FILE_CACHE: dict = {}


def _read_json(name: str) -> dict:
    """JSON de `phrases/` memorizado por fecha de modificación (editar el archivo no exige reiniciar)."""
    path = os.path.join(PHRASES_DIR, name)
    mtime = os.path.getmtime(path)
    hit = _FILE_CACHE.get(path)
    if hit and hit[0] == mtime:
        return hit[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _FILE_CACHE[path] = (mtime, data)
    return data


def load_rules() -> dict:
    rules = _read_json("rules.json")
    fam = rules.get("families")
    if not isinstance(fam, dict) or not all(isinstance(v, list) for v in fam.values()):
        raise PhraseError("plantillas_invalidas", "Las reglas del plan de juego no son válidas", 500)
    if not isinstance((rules.get("game_plan") or {}).get("team"), list):
        raise PhraseError("plantillas_invalidas", "Las reglas del plan de juego no son válidas", 500)
    return rules


def validate_templates(data: dict, rules: dict, metrics: dict) -> list:
    """Lista de errores de las plantillas (vacía si están bien): id repetido, `when` desconocido, métrica
    inexistente, marcador fuera de la lista, dígitos escritos a mano, texto vacío o largo, y falta de plantilla de
    ventaja o de riesgo para alguna métrica del plan."""
    errors, seen, have = [], set(), set()
    for t in data.get("templates", []):
        tid = t.get("id")
        text = t.get("text") or ""
        if not tid or tid in seen:
            errors.append(f"id repetido o vacío: {tid!r}")
        seen.add(tid)
        if t.get("when") not in WHEN_VALUES:
            errors.append(f"{tid}: 'when' inválido ({t.get('when')!r})")
        metric = t.get("metric")
        if metric != "*" and metric not in metrics:
            errors.append(f"{tid}: la métrica {metric!r} no está en el catálogo")
        for m in re.findall(r"\{(\w+)\}", text):
            if m not in MARKERS:
                errors.append(f"{tid}: marcador no permitido {{{m}}}")
        if re.search(r"\d", text):
            errors.append(f"{tid}: el texto tiene dígitos escritos a mano")
        if not text.strip():
            errors.append(f"{tid}: texto vacío")
        elif len(text) > MAX_LEN.get(t.get("when"), 100):
            errors.append(f"{tid}: texto de más de {MAX_LEN.get(t.get('when'), 100)} caracteres ({len(text)})")
        for ent in t.get("entities") or ["team"]:
            have.add((metric, t.get("when"), ent))
    for entity, keys in (rules.get("game_plan") or {}).items():
        for k in keys:
            mdef = metrics.get(k)
            if mdef is None:
                errors.append(f"game_plan.{entity}: la métrica {k!r} no está en el catálogo")
                continue
            if mdef.direction == "neutral":
                errors.append(f"game_plan.{entity}: {k} tiene dirección neutral y no puede ser ventaja o riesgo")
            for when in ("ventaja", "riesgo"):
                if (k, when, entity) not in have:
                    errors.append(f"falta la plantilla de {when} para {k} ({entity})")
    return errors


def load_templates(lang: str = "es") -> dict:
    """`{lang, version, templates, by_id, by_key, generic}` validado. `by_key[(métrica, when, entidad)]`."""
    if lang not in LANGS:
        raise PhraseError("parametro_invalido", f"Idioma no soportado: {lang}", 400)
    data = _read_json(f"{lang}.json")
    errors = validate_templates(data, load_rules(), metrics_catalog.METRICS)
    if errors:
        log.error("Plantillas inválidas (%s): %s", lang, "; ".join(errors))
        raise PhraseError("plantillas_invalidas", "Las plantillas del plan de juego no son válidas", 500)
    by_id, by_key, generic = {}, {}, {}
    for t in data["templates"]:
        by_id[t["id"]] = t
        for ent in t.get("entities") or ["team"]:
            if t["metric"] == "*":
                generic[(t.get("direction"), t["when"], ent)] = t
            else:
                by_key[(t["metric"], t["when"], ent)] = t
    return {"lang": lang, "version": data.get("version"), "templates": data["templates"],
            "by_id": by_id, "by_key": by_key, "generic": generic}


def pick_template(metric_key: str, when: str, entity_type: str, *, mode: str = "perfil",
                  direction: str | None = None, lang: str = "es") -> dict | None:
    """Plantilla exacta de la métrica; si no hay, la genérica de esa dirección; si no, `None`. En modo `matchup` usa el
    texto alternativo `text_matchup` cuando la plantilla lo define."""
    tpl = load_templates(lang)
    t = tpl["by_key"].get((metric_key, when, entity_type)) or tpl["generic"].get((direction, when, entity_type))
    if t is None:
        return None
    text = t.get("text_matchup") if mode == "matchup" and t.get("text_matchup") else t["text"]
    return {**t, "text": text}


# ── Formato ──────────────────────────────────────────────────────────────────

def _round_half_up(value: float, decimals: int) -> Decimal:
    q = Decimal(1).scaleb(-decimals)
    return Decimal(repr(float(value))).quantize(q, rounding=ROUND_HALF_UP)


def _num(value: float, decimals: int, *, signed: bool = False) -> str:
    d = _round_half_up(value, decimals)
    text = f"{abs(d):.{decimals}f}".replace(".", ",")
    if d < 0:
        return "−" + text
    return ("+" + text) if signed else text


def format_value(metric_key: str, value, *, delta: bool = False) -> str:
    """Valor con el formato de la métrica y coma decimal. `delta=True`: diferencia con signo (porcentajes en
    puntos porcentuales). Redondeo half-up, igual que `Intl.NumberFormat` en el cliente."""
    if value is None:
        return "—"
    fmt = metrics_catalog.METRICS[metric_key].fmt
    if fmt == "pct":
        return _num(value * 100, 1, signed=delta) + (" pp" if delta else "%")
    if fmt in ("dec1",):
        return _num(value, 1, signed=delta)
    if fmt in ("dec2", "signed_dec2"):
        return _num(value, 2, signed=delta or fmt == "signed_dec2")
    if fmt in ("int", "signed_int"):
        return _num(value, 0, signed=delta or fmt == "signed_int")
    return _num(value, 2, signed=delta)


def render(template_id: str, values: dict | None = None, *, lang: str = "es") -> str:
    """Rellena los marcadores de la plantilla. Un marcador ausente en `values` es un error de programación."""
    values = values or {}
    t = load_templates(lang)["by_id"].get(template_id)
    if t is None:
        raise PhraseError("plantilla_inexistente", f"No existe la plantilla {template_id}", 500)

    def sub(m):
        name = m.group(1)
        if name not in values:
            raise PhraseError("marcador_faltante", f"Falta el valor del marcador {{{name}}} en {template_id}", 500)
        return str(values[name])

    return re.sub(r"\{(\w+)\}", sub, t["text"])


# ── Plan de juego ────────────────────────────────────────────────────────────

def _family(metric_key: str, rules: dict) -> str:
    for fam, keys in rules.get("families", {}).items():
        if metric_key in keys:
            return fam
    return metric_key


def _sigma(pop, metric_key: str):
    """Desvío estándar poblacional de la métrica entre los miembros de la población; `None` con menos de 2 valores o
    sin dispersión."""
    vals = [m.values.get(metric_key) for m in pop.members if m.in_population and m.values.get(metric_key) is not None]
    if len(vals) < 2:
        return None
    s = statistics.pstdev(vals)
    return s if s > 0 else None


def _previous_period(team_code: str, comp_id: int, ctx: Context):
    """Valores del propio equipo en los partidos anteriores a los últimos N: `(valores, badge)` o `None` si no hay
    suficientes. Es el valor pooled de esos partidos (misma política de agregación que el resto), no un promedio de
    tasas."""
    import bundles
    per_game = bundles.team_game_bundles(team_code, comp_id, context_mod.without_last(ctx))
    prev = per_game[:-ctx.last] if len(per_game) > ctx.last else []
    if len(prev) < config.get("sample.team.min"):
        return None
    b = bundles.sum_bundles([x for _, x in prev])
    values = stats_engine.compute_standard(b)
    try:
        values = stats_engine.apply_base(values, b, "partido")
    except ValueError:
        pass
    return {k: (values.get(k) or {}).get("value") for k in stats_engine.metrics_catalog_keys()}, sample_mod.sample_for("team", [b])


def _select(cands: list, sign: int, cfg: dict) -> list:
    """Hasta `items_max` ítems de ese signo con |z| ≥ `min_z`, uno por familia; si quedan menos que `items_min`, se
    completa con diferencias menores del mismo signo (marcadas `minor`)."""
    pool = sorted((c for c in cands if sign * c["z"] > 0), key=lambda c: (-abs(c["z"]), c["order"]))
    out, used = [], set()
    for c in pool:
        if abs(c["z"]) < cfg["min_z"]:
            continue
        if len(out) >= cfg["items_max"]:
            break
        if c["family"] in used:
            continue
        out.append(c)
        used.add(c["family"])
    if len(out) < cfg["items_min"]:
        for c in pool:
            if c in out or c["family"] in used:
                continue
            c["minor"] = True
            out.append(c)
            used.add(c["family"])
            if len(out) >= cfg["items_min"]:
                break
    return sorted(out, key=lambda c: (-abs(c["z"]), c["order"]))


def _member_label(pop, team_code):
    m = pop.get(team_code)
    return m.name if m else team_code


def game_plan(entity_type: str, entity_id: str, *, reference: str = "competencia", rival: str | None = None,
              comp_id: int | None, ctx: Context, mode: str = "perfil", today: str | None = None) -> dict:
    """Plan de juego de un equipo (F-17). `mode="matchup"` es la entrada de F-03: la referencia es siempre el rival y la
    muestra baja se advierte en vez de excluir al equipo."""
    if entity_type != "team":
        raise PhraseError("parametro_invalido", "El plan de juego solo está disponible para equipos", 400)
    if reference not in REFERENCES:
        raise PhraseError("parametro_invalido", "Referencia inválida: usá competencia, rival o periodo_anterior", 400)
    if mode not in MODES:
        raise PhraseError("parametro_invalido", f"Modo inválido: {mode}", 400)
    if mode == "matchup":
        reference = "rival"
    team_code = str(entity_id).upper()
    if reference == "rival_proximo":
        # F-12: el rival es el del próximo partido del calendario manual.
        import fixtures
        f = fixtures.next_fixture(team_code, today or fixtures.today_uy())
        if f is None:
            raise PhraseError("sin_proximo_partido", "No hay un próximo partido cargado para este equipo", 404)
        rival = f.away_code if f.home_code == team_code else f.home_code
        out = game_plan(entity_type, team_code, reference="rival", rival=rival, comp_id=comp_id, ctx=ctx, mode=mode)
        return {**out, "reference": {**(out.get("reference") or {}), "type": "rival_proximo", "fixture_id": f.id,
                                     "rival_code": rival}}
    rival = (rival or "").strip().upper() or None
    if reference == "rival":
        if not rival:
            raise PhraseError("parametro_invalido", "Elegí un rival para comparar", 400)
        if rival == team_code:
            raise PhraseError("parametro_invalido", "El rival debe ser distinto del equipo", 400)
    if reference == "periodo_anterior" and not ctx.last:
        raise PhraseError("parametro_invalido",
                          "Elegí un período (Últimos N) para comparar con el período anterior", 400)

    key = (team_code, reference, rival, comp_id, context_mod.context_key(ctx), mode)
    return cache.memo("gplan", key, lambda: _build(team_code, reference, rival, comp_id, ctx, mode))


def _empty(reason: str, team_code: str, team_name: str, reference: str, rival_name, ctx: Context, *,
           sample_own=None, games_used=0, rule=None, size=0, comp_id=None) -> dict:
    return {
        "team": {"code": team_code, "name": team_name},
        "reference": _ref_info(reference, rival_name, ctx),
        "advantages": [], "risks": [], "items": [],
        "sample": {"own": sample_own, "ref": None}, "sample_warning": False,
        "reason": reason, "rule": rule,
        "population": {"size": size, "competition_id": comp_id},
        "context": _echo(ctx, team_code, games_used),
    }


def _ref_info(reference: str, rival_name, ctx: Context) -> dict:
    if reference == "competencia":
        return {"type": "competencia", "label": "Ø competencia", "rival": None}
    if reference == "rival":
        return {"type": "rival", "label": f"Rival {rival_name or ''}".strip(), "rival": rival_name}
    return {"type": "periodo_anterior",
            "label": f"Período anterior (antes de los últimos {ctx.last})" if ctx.last else "Período anterior",
            "rival": None}


def _echo(ctx: Context, team_code: str, games_used: int) -> dict:
    from context_summary import _team_total
    label = repository.competition_labels().get(ctx.competition_id) if ctx.competition_id is not None else None
    return context_mod.context_echo(ctx, games_used=games_used, games_total=_team_total(team_code, ctx),
                                    games_excluded={}, ignored=[], competition_label=label)


def _build(team_code: str, reference: str, rival_code, comp_id, ctx: Context, mode: str) -> dict:
    rules = load_rules()
    cfg = {"items_min": config.get("gameplan.items_min"), "items_max": config.get("gameplan.items_max"),
           "min_z": config.get("gameplan.min_z")}
    metric_keys = rules["game_plan"]["team"]
    team_name = team_code
    rows = repository.team_game_rows(comp_id) if comp_id is not None else {}
    for r in rows.values():
        if r["team_code"] == team_code:
            team_name = r["team_name"]
            break
    rival_name = None
    if reference == "rival":
        rival_name = next((r["team_name"] for r in rows.values() if r["team_code"] == rival_code), None)
        if rival_name is None and comp_id is not None:
            raise PhraseError("no_encontrado", "Rival no encontrado", 404)

    def empty(reason, **kw):
        return _empty(reason, team_code, team_name, reference, rival_name or rival_code, ctx,
                      rule={**cfg, "order": "abs_z", "metrics_evaluated": len(metric_keys), "metrics_scored": 0},
                      comp_id=comp_id, **kw)

    if ctx.competition_all or comp_id is None:
        return empty("sin_universo")
    if not any(r["team_code"] == team_code for r in rows.values()):
        raise PhraseError("no_encontrado", "Equipo no encontrado", 404)
    if context_mod.population_mode(ctx) == "entity_only":
        return empty("contexto_no_comparable")

    # `matchup` (F-03) usa la competencia completa sin mínimos de muestra: la muestra baja se advierte en vez de dejar
    # el bloque vacío.
    pop = population.population("team", comp_id, ctx, apply_thresholds=(mode != "matchup"))
    own = pop.get(team_code)
    if own is None:
        return empty("sin_datos")
    sample_own = own.sample
    sample_warning = False
    if sample_own and sample_own.get("level") == "baja":
        if mode == "perfil":
            return empty("muestra_baja", sample_own=sample_own, games_used=own.games, size=pop.size)
        sample_warning = True
    if pop.size < config.get("population.min_size"):
        return empty("poblacion_insuficiente", sample_own=sample_own, games_used=own.games, size=pop.size)

    sample_ref = None
    if reference == "competencia":
        ref_values = population.league_reference("team", comp_id, ctx)
    elif reference == "rival":
        r = pop.get(rival_code)
        if r is None:
            return empty("rival_sin_datos", sample_own=sample_own, games_used=own.games, size=pop.size)
        ref_values, sample_ref = r.values, r.sample
        if sample_ref and sample_ref.get("level") == "baja":
            sample_warning = True
    else:
        if context_mod.has_event_filters(ctx):
            return empty("contexto_no_comparable", sample_own=sample_own, games_used=own.games, size=pop.size)
        prev = _previous_period(team_code, comp_id, ctx)
        if prev is None:
            return empty("periodo_anterior_insuficiente", sample_own=sample_own, games_used=own.games, size=pop.size)
        ref_values, sample_ref = prev

    cands, scored = [], 0
    for order, m in enumerate(metric_keys):
        d = metrics_catalog.METRICS[m]
        if d.direction == "neutral":
            continue
        v, r = own.values.get(m), ref_values.get(m)
        if v is None or r is None:
            continue                     # un nulo nunca se reemplaza por 0
        sigma = _sigma(pop, m)
        if sigma is None:
            continue
        scored += 1
        s = -1 if d.direction == "lower" else 1
        delta = round(s * (v - r), 4)
        z = delta / sigma
        if z == 0:
            continue
        ficha = population.ficha(m, v, team_code, pop)
        cands.append({
            "metric": m, "label": d.label, "group": d.group, "fmt": d.fmt, "family": _family(m, rules),
            "direction": "ventaja" if delta > 0 else "riesgo", "icon": "↑" if delta > 0 else "↓",
            "delta": delta, "delta_rel": (round(delta / abs(r), 4) if d.rel_dist and r else None),
            "delta_raw": round(v - r, 4), "own": v, "ref": r,
            "percentile": ficha["percentile"], "rank": ficha["rank"], "rank_total": ficha["rank_total"],
            "z": round(z, 3), "minor": False, "order": order,
        })
    advantages, risks = _select(cands, +1, cfg), _select(cands, -1, cfg)
    for it in advantages + risks:
        tpl = pick_template(it["metric"], it["direction"], "team", mode=mode)
        it["template_id"] = tpl["id"] if tpl else None
        it["text"] = render(tpl["id"], {
            "entidad": team_name, "metrica": it["label"],
            "valor": format_value(it["metric"], it["own"]), "referencia": format_value(it["metric"], it["ref"]),
            "delta": format_value(it["metric"], it["delta_raw"], delta=True),
            "p": "" if it["percentile"] is None else it["percentile"],
            "media": format_value(it["metric"], it["ref"]), "rival": rival_name or ""}) if tpl else ""
        it.pop("order", None)
    out = _empty(None, team_code, team_name, reference, rival_name, ctx, sample_own=sample_own,
                 games_used=own.games, size=pop.size, comp_id=comp_id,
                 rule={**cfg, "order": "abs_z", "metrics_evaluated": len(metric_keys), "metrics_scored": scored})
    out.update({"advantages": advantages, "risks": risks, "items": advantages + risks,
                "sample": {"own": sample_own, "ref": sample_ref}, "sample_warning": sample_warning,
                "mode": mode, "catalog_version": metrics_catalog.CATALOG_VERSION})
    if not advantages and not risks:
        out["reason"] = "sin_diferencias"
    return out


# ── Insights automáticos (A-10) ──────────────────────────────────────────────

def _insight_family(metric_key: str, rules: dict) -> str:
    for fam, keys in rules.get("insight_families", {}).items():
        if metric_key in keys:
            return fam
    return metric_key


def insights(entity_type: str, entity_id, *, comp_id: int | None, ctx: Context) -> dict:
    """Entre `insights.min_items` y `insights.max_items` frases de plantilla fija para un equipo o un jugador: una por métrica
    cuyo percentil de T-01 es ≤ `insights.low_pct` o ≥ `insights.high_pct`, una por familia, ordenadas por lo extremo."""
    if entity_type not in ("team", "player"):
        raise PhraseError("parametro_invalido", "Los insights solo existen para equipos y jugadores", 400)
    eid = str(entity_id).upper() if entity_type == "team" else str(entity_id)
    key = (entity_type, eid, comp_id, context_mod.context_key(ctx))
    return cache.memo("insights", key, lambda: _build_insights(entity_type, eid, comp_id, ctx))


def _build_insights(entity_type: str, eid: str, comp_id, ctx: Context) -> dict:
    rules = load_rules()
    cfg = {"low_pct": config.get("insights.low_pct"), "high_pct": config.get("insights.high_pct"),
           "min_items": config.get("insights.min_items"), "max_items": config.get("insights.max_items")}
    out = {"entity": {"type": entity_type, "id": eid}, "items": [], "reason": None, "rule": cfg,
           "sample": None, "population": {"size": 0, "competition_id": comp_id}}

    def done(reason, own=None):
        out["reason"] = reason
        label = repository.competition_labels().get(comp_id) if comp_id is not None else None
        n = own.games if own else 0
        out["context"] = context_mod.context_echo(ctx, games_used=n, games_total=n, games_excluded={}, ignored=[],
                                                  competition_label=label)
        return out

    if ctx.competition_all or comp_id is None:
        return done("sin_universo")
    if context_mod.population_mode(ctx) == "entity_only":
        return done("contexto_no_comparable")
    pop = population.population(entity_type, comp_id, ctx)
    own = pop.get(eid)
    out["population"]["size"] = pop.size
    if own is None:
        return done("sin_datos")
    out["entity"]["name"] = own.name
    out["sample"] = own.sample
    if own.sample and own.sample.get("level") == "baja":
        return done("muestra_baja", own)
    if pop.size < config.get("population.min_size"):
        return done("poblacion_insuficiente", own)
    cands = []
    for order, m in enumerate(rules["insights"][entity_type]):
        d = metrics_catalog.METRICS.get(m)
        if d is None or entity_type not in d.entities:
            continue
        v = own.values.get(m)
        f = population.ficha(m, v, own.id, pop)
        p = f["percentile"]
        if v is None or p is None or not f["in_population"]:
            continue                      # nunca se reemplaza un nulo por 0
        if p >= cfg["high_pct"]:
            when = "extremo_alto"
        elif p <= cfg["low_pct"]:
            when = "extremo_bajo"
        else:
            continue
        cands.append({"metric": m, "label": d.label, "fmt": d.fmt, "direction": d.direction, "when": when,
                      "percentile": p, "value": v, "avg": f["avg"], "rank": f["rank"], "rank_total": f["rank_total"],
                      "extreme": abs(p - 50), "family": _insight_family(m, rules), "order": order})
    cands.sort(key=lambda c: (-c["extreme"], c["order"]))
    used, picked = set(), []
    for c in cands:
        if c["family"] in used:
            continue
        used.add(c["family"])
        picked.append(c)
        if len(picked) >= cfg["max_items"]:
            break
    for c in picked:
        tpl = pick_template(c["metric"], c["when"], entity_type, direction=c["direction"])
        c["template_id"] = tpl["id"] if tpl else None
        avg = format_value(c["metric"], c["avg"])
        c["text"] = render(tpl["id"], {"entidad": own.name, "metrica": c["label"], "valor": format_value(c["metric"], c["value"]),
                                       "media": avg, "referencia": avg, "delta": "", "p": c["percentile"], "rival": ""}) if tpl else ""
        c["tone"] = "alto" if c["when"] == "extremo_alto" else "bajo"
        c["good"] = None if c["direction"] == "neutral" else c["when"] == "extremo_alto"
        c.pop("order", None)
        c.pop("extreme", None)
    out["items"] = picked
    return done(None if picked else "sin_extremos", own)


if __name__ == "__main__":
    # Valida las plantillas sin levantar la app: `python phrases.py`.
    import sys
    errs = validate_templates(_read_json("es.json"), load_rules(), metrics_catalog.METRICS)
    if errs:
        print("\n".join(errs))
        sys.exit(1)
    print(f"OK: {len(_read_json('es.json')['templates'])} plantillas")
