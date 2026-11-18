"""Contextos cruzados (A-06): un único motor que reparte las posesiones (u oportunidades) de un equipo en una matriz de
dos dimensiones y calcula una métrica por celda, con muestra (T-02), ajuste, percentil y la verificación de que las celdas
suman el total. Las posesiones salen de A-01 (`possessions.game_possessions`), ya enriquecidas con origen (A-02), tipo (A-03),
oportunidades (A-04) y tramo de reloj (A-05); aquí solo se agrupan.

Dimensiones: cuarto, clutch, tramo de reloj, origen, tipo, oportunidad, quinteto, jugador en cancha (solapada: cada posesión
pertenece a cinco jugadores), sede, rival y finalizador. Con la dimensión `oportunidad` la unidad es la oportunidad, no la
posesión. Las posesiones incompletas quedan fuera y se informan aparte.
"""
import cache
import clutch as clutch_mod
import config
import context as context_mod
import identity
import origin as origin_mod
import population
import possession_clock
import possessions
import repository
import sample
import transition
from context import context_key

LIMIT_DEFAULT, LIMIT_RANGE = 8, (3, 30)
OTHERS = "otros"


class CrossError(Exception):
    def __init__(self, status: int, message: str, code: str = "parametro_invalido"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _fixed(pairs):
    return [{"key": k, "label": l} for k, l in pairs]


# league=True: la dimensión es la misma para todos los equipos (se puede comparar contra la competencia)
DIMS = {
    "cuarto": {"label": "Cuarto", "league": True, "overlap": False,
               "fixed": _fixed([("1", "1.º cuarto"), ("2", "2.º cuarto"), ("3", "3.º cuarto"), ("4", "4.º cuarto"), ("pr", "Prórroga")])},
    "clutch": {"label": "Clutch", "league": True, "overlap": False, "fixed": _fixed([("cierre", "Cierre"), ("resto", "Resto del partido")])},
    "tramo": {"label": "Tramo de reloj", "league": True, "overlap": False,
              "fixed": _fixed([(b, possession_clock.BAND_LABELS[b]) for b in possession_clock.BANDS] + [("sin_tiro", "Sin tiro")])},
    "origen": {"label": "Origen de la posesión", "league": True, "overlap": False,
               "fixed": _fixed([(k, origin_mod.LABELS[k]) for k in origin_mod.ORIGINS])},
    "tipo": {"label": "Tipo de ataque", "league": True, "overlap": False,
             "fixed": _fixed([(k, transition.LABELS[k]) for k in transition.PTYPES] + [("sin_tipo", "Sin tipo")])},
    "oportunidad": {"label": "Oportunidad", "league": True, "overlap": False, "fixed": _fixed([("primera", "Primera"), ("segunda", "Segunda o posterior")])},
    "sede": {"label": "Local o visitante", "league": True, "overlap": False, "fixed": _fixed([("local", "Local"), ("visitante", "Visitante")])},
    "quinteto": {"label": "Quinteto", "league": False, "overlap": False, "fixed": None},
    "jugador": {"label": "Jugador en cancha", "league": False, "overlap": True, "fixed": None},
    "finalizador": {"label": "Finalizador", "league": False, "overlap": False, "fixed": None},
    "rival": {"label": "Rival", "league": False, "overlap": False, "fixed": None},
}

# (etiqueta, dirección de la métrica en ataque, formato)
METRICS = {
    "ppp": ("PPP", "higher", "dec2"), "efg_pct": ("eFG%", "higher", "pct"), "ts_pct": ("TS%", "higher", "pct"),
    "ppt": ("PPT", "higher", "dec2"), "to_pct": ("TO%", "lower", "pct"), "or_pct": ("OR%", "higher", "pct"),
    "ft_rate": ("FT Rate", "higher", "pct"), "volume": ("Volumen", "neutral", "int"),
}

PRESETS = [
    {"key": "tramo_origen", "label": "Tramo de reloj × origen", "dim_x": "tramo", "dim_y": "origen", "side": "ataque", "metric": "ppp"},
    {"key": "tramo_cuarto", "label": "Tramo de reloj × cuarto", "dim_x": "tramo", "dim_y": "cuarto", "side": "ataque", "metric": "ppp"},
    {"key": "tipo_quinteto", "label": "Tipo de ataque × quinteto", "dim_x": "tipo", "dim_y": "quinteto", "side": "ataque", "metric": "ppp"},
    {"key": "segunda_jugador", "label": "Segunda oportunidad × jugador", "dim_x": "oportunidad", "dim_y": "finalizador", "side": "ataque", "metric": "ppp"},
    {"key": "transicion_quinteto", "label": "Transición concedida × quinteto", "dim_x": "tipo", "dim_y": "quinteto", "side": "defensa", "metric": "ppp"},
    {"key": "tramo_clutch", "label": "Tramo de reloj × clutch", "dim_x": "tramo", "dim_y": "clutch", "side": "ataque", "metric": "ppp"},
]


# ── Conteos y métricas ───────────────────────────────────────────────────────

_KEYS = ("pts", "fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "tov", "orb", "odrb")


def _acc():
    d = {k: 0 for k in _KEYS}
    d["n"] = 0
    d["games"] = set()
    return d


def _add(a, item):
    a["n"] += 1
    a["games"].add(item["game_id"])
    for k in _KEYS:
        a[k] += item["c"][k]


def _value(a, metric, chance_mode):
    n = a["n"]
    fga = a["fga2"] + a["fga3"]
    if metric == "volume":
        return float(n), None
    if n == 0:
        return None, "sin_intentos"
    if metric == "or_pct":
        if chance_mode:
            return None, "no_aplica"
        den = a["orb"] + a["odrb"]
        return (a["orb"] / den, None) if den else (None, "sin_intentos")
    if metric == "ppp":
        return a["pts"] / n, None
    if not fga and metric in ("efg_pct", "ppt", "ft_rate"):
        return None, "sin_intentos"
    if metric == "efg_pct":
        return (a["fgm2"] + 1.5 * a["fgm3"]) / fga, None
    if metric == "ppt":
        return (2 * a["fgm2"] + 3 * a["fgm3"]) / fga, None
    if metric == "ft_rate":
        return a["fta"] / fga, None
    if metric == "ts_pct":
        den = 2 * (fga + 0.44 * a["fta"])
        return ((2 * a["fgm2"] + 3 * a["fgm3"] + a["ftm"]) / den, None) if den else (None, "sin_intentos")
    if metric == "to_pct":
        den = fga + 0.44 * a["fta"] + a["tov"]
        return (a["tov"] / den, None) if den else (None, "sin_intentos")
    return None, "no_aplica"


def _counts_out(a):
    return {k: a[k] for k in ("pts", "fga2", "fgm2", "fga3", "fgm3", "fta", "ftm", "tov", "orb", "odrb")}


# ── Ítems (posesiones u oportunidades) ───────────────────────────────────────

def _item_counts(p, ch):
    if ch is None:
        b, o = p.box, p.opp_box
        return {"pts": p.pts, "fga2": b.get("fga2") or 0, "fgm2": b.get("fgm2") or 0, "fga3": b.get("fga3") or 0, "fgm3": b.get("fgm3") or 0,
                "fta": b.get("fta") or 0, "ftm": b.get("ftm") or 0, "tov": b.get("tov") or 0, "orb": b.get("orb") or 0, "odrb": o.get("drb") or 0}
    b = ch.box or {}
    return {"pts": ch.pts or 0, "fga2": b.get("fga2", 0), "fgm2": b.get("fgm2", 0), "fga3": b.get("fga3", 0), "fgm3": b.get("fgm3", 0),
            "fta": b.get("fta", 0), "ftm": b.get("ftm", 0), "tov": b.get("tov", 0), "orb": 0, "odrb": 0}


def _band_of_possession(p):
    for s in reversed(p.shots or []):
        if s.get("band"):
            return s["band"]
    return "sin_tiro"


def _dims_of(p, ch, game, side, clutch_info):
    """Valor(es) de cada dimensión para un ítem."""
    own = p.own_on_court if side == "ataque" else p.opp_on_court
    on_court = list(own) if own else []
    in_clutch = False
    if clutch_info["closed"] and p.start_clock is not None:
        in_clutch = p.period_type in clutch_mod.OVERTIME_TYPES or (
            p.period_type == "REGULAR" and p.period == clutch_info["last_reg"] and p.start_clock <= clutch_info["window"])
    finisher = p.finisher_id
    if ch is not None and ch.finisher_id is not None:
        finisher = ch.finisher_id
    return {
        "cuarto": [("pr" if p.period_type != "REGULAR" else str(p.period))],
        "clutch": ["cierre" if in_clutch else "resto"],
        "tramo": [(ch.band or "sin_tiro") if ch is not None else _band_of_possession(p)],
        "origen": [p.origin or "saque_banda"],
        "tipo": [p.ptype or "sin_tipo"],
        "oportunidad": [("primera" if ch.n == 1 else "segunda") if ch is not None else ("segunda" if len(p.chances) > 1 else "primera")],
        "sede": ["local" if game["info"]["home_away"] == "L" else "visitante"],
        "quinteto": ["-".join(str(i) for i in sorted(on_court))] if len(on_court) == 5 else ["sin_dato"],
        "jugador": [str(i) for i in on_court] or ["sin_dato"],
        "finalizador": [str(finisher)] if finisher is not None else ["sin_dato"],
        "rival": [p.opp if side == "ataque" else p.team],
    }


def _items(team, comp_id, ctx, side, chance_mode):
    """Posesiones (u oportunidades) del lado que pasan el contexto de T-03: partido, evento (cuarto, marcador, con/sin
    jugador, con el estado al inicio de la posesión) y posesión (origen, tipo; oportunidad y reloj por oportunidad)."""
    import poss_filter

    def build():
        all_games = repository.team_pbp_games(team, comp_id)
        games, excluded = context_mod.filter_games_ex(all_games, ctx, team)
        window = config.get("clutch.window_secs")
        margin = config.get("clutch.margin")
        close = config.get("context.close_margin")
        filtered = context_mod.has_event_filters(ctx) or context_mod.has_possession_filters(ctx)
        items, incomplete = [], 0
        for g in games:
            evs = g["events"]
            reg = [e["period"] for e in evs if e.get("period_type") == "REGULAR" and e.get("period")]
            last_reg = max(reg) if reg else 4
            info = {"last_reg": last_reg, "window": window, "closed": clutch_mod._entry_margin(evs, last_reg, window) <= margin}
            for p in possessions.game_possessions(g["game_id"]):
                if (p.team if side == "ataque" else p.opp) != team:
                    continue
                if p.incomplete:
                    incomplete += 1
                    continue
                if filtered:
                    court = poss_filter._canon_ids(p.own_on_court if side == "ataque" else p.opp_on_court)
                    if not poss_filter.possession_pass(p, ctx, court, close):
                        continue
                for ch in (p.chances if chance_mode else [None]):
                    if chance_mode and ch.box is None:
                        continue
                    if ch is not None and not poss_filter.chance_pass(ch, ctx):
                        continue
                    items.append({"game_id": g["game_id"], "c": _item_counts(p, ch), "dv": _dims_of(p, ch, g, side, info),
                                  "p": p, "ch": ch})
        return {"items": items, "games_used": len(games), "games_total": len(all_games), "excluded": excluded, "incomplete": incomplete}
    return cache.memo("cross:items", (team, comp_id, context_key(ctx), side, chance_mode), build)


# ── Matriz ───────────────────────────────────────────────────────────────────

def _axis(dim, items, limit):
    """Valores del eje: fijos o, en las dimensiones dinámicas, los `limit` con más ítems más «Otros»."""
    spec = DIMS[dim]
    if spec["fixed"] is not None:
        return [v["key"] for v in spec["fixed"]], set()
    cnt = {}
    for it in items:
        for k in set(it["dv"][dim]):
            cnt[k] = cnt.get(k, 0) + 1
    ranked = sorted((k for k in cnt if k != "sin_dato"), key=lambda k: (-cnt[k], k))
    keep = ranked[:limit]
    rest = set(ranked[limit:])
    keys = keep + ([OTHERS] if rest else []) + (["sin_dato"] if "sin_dato" in cnt else [])
    return keys, rest


def _keys_for(it, dim, rest):
    ks = it["dv"][dim]
    if not rest:
        return set(ks)
    return {OTHERS if k in rest else k for k in ks}


def _labels(dim, keys, names):
    spec = DIMS[dim]
    if spec["fixed"] is not None:
        by = {v["key"]: v["label"] for v in spec["fixed"]}
        return [{"key": k, "label": by[k]} for k in keys]
    out = []
    for k in keys:
        if k == OTHERS:
            lab = "Otros"
        elif k == "sin_dato":
            lab = "Sin dato"
        elif dim == "rival":
            lab = k
        elif dim == "quinteto":
            lab = " · ".join(names(int(i)) for i in k.split("-"))
        else:
            lab = names(int(k))
        out.append({"key": k, "label": lab})
    return out


def _grid(items, dx, dy, limit):
    xs, xrest = _axis(dx, items, limit)
    ys, yrest = _axis(dy, items, limit)
    cells, rows, cols, grand = {}, {k: _acc() for k in xs}, {k: _acc() for k in ys}, _acc()
    multiplicity = 0
    for it in items:
        kx, ky = _keys_for(it, dx, xrest), _keys_for(it, dy, yrest)
        multiplicity += len(kx) * len(ky)
        _add(grand, it)
        for a in kx:
            _add(rows[a], it)
        for b in ky:
            _add(cols[b], it)
        for a in kx:
            for b in ky:
                _add(cells.setdefault((a, b), _acc()), it)
    return xs, ys, cells, rows, cols, grand, multiplicity


def _norm(team_code):
    return str(team_code or "").strip().upper()


def _teams(comp_id):
    return sorted({r["team_code"] for r in repository.team_game_rows(comp_id).values()})


def _color_value(a, metric, chance_mode, adjust, side):
    v, reason = _value(a, metric, chance_mode)
    if v is None or metric != "ppp" or chance_mode or adjust is None:
        return v, reason, None
    adj = sample.adjusted(v, a["n"], adjust, "split", metric_key="oer" if side == "ataque" else "der")
    return v, reason, adj


def _league_cells(team, comp_id, ctx, side, dx, dy, metric, chance_mode, prior):
    """{(x, y): valor de color} de un equipo para los percentiles contra la competencia; solo celdas con muestra suficiente."""
    def build():
        data = _items(team, comp_id, ctx, side, chance_mode)
        items = data["items"]
        if not items:
            return {}
        _, _, cells, _, _, _, _ = _grid(items, dx, dy, LIMIT_DEFAULT)
        out = {}
        for key, a in cells.items():
            badge = sample.sample_level("split", n=a["n"], unit="posesiones", team_poss=len(items), games=len(a["games"]))
            if not badge["ranked"]:
                continue
            v, _, adj = _color_value(a, metric, chance_mode, prior, side)
            if v is not None:
                out[key] = adj["value"] if adj else v
        return out
    return cache.memo("cross:league", (team, comp_id, context_key(ctx), side, dx, dy, metric, chance_mode), build)


def cross_matrix(team_code, comp_id, ctx, *, dim_x, dim_y, metric, side="ataque", limit=LIMIT_DEFAULT, color=None):
    team = _norm(team_code)
    if dim_x not in DIMS or dim_y not in DIMS:
        raise CrossError(400, "Dimensión inválida.")
    if dim_x == dim_y:
        raise CrossError(400, "Elegí dos dimensiones distintas.")
    if metric not in METRICS:
        raise CrossError(400, "Métrica inválida.")
    if side not in ("ataque", "defensa"):
        raise CrossError(400, "El lado debe ser ataque o defensa.")
    if not LIMIT_RANGE[0] <= limit <= LIMIT_RANGE[1]:
        raise CrossError(400, f"El límite debe estar entre {LIMIT_RANGE[0]} y {LIMIT_RANGE[1]}.")
    if color not in (None, "", "competencia", "matriz"):
        raise CrossError(400, "color debe ser competencia o matriz.")
    if team not in _teams(comp_id):
        raise CrossError(404, "Equipo no encontrado", "no_encontrado")
    if not repository.team_pbp_games(team, comp_id):
        raise CrossError(404, "Este equipo no tiene play-by-play importado. Reimportá sus partidos.", "sin_pbp")
    # con la dimensión oportunidad o con filtros de oportunidad/reloj (T-03), la unidad es la oportunidad
    chance_mode = "oportunidad" in (dim_x, dim_y) or context_mod.has_chance_filters(ctx)
    key = (team, comp_id, context_key(ctx), dim_x, dim_y, metric, side, limit, color or "")
    return cache.memo("cross:matrix", key, lambda: _build(team, comp_id, ctx, dim_x, dim_y, metric, side, limit, color or "", chance_mode))


def _build(team, comp_id, ctx, dx, dy, metric, side, limit, color, chance_mode):
    data = _items(team, comp_id, ctx, side, chance_mode)
    items = data["items"]
    unit = "oportunidades" if chance_mode else "posesiones"
    direction = METRICS[metric][1]
    if direction != "neutral" and side == "defensa":
        direction = "lower" if direction == "higher" else "higher"
    prior = None if chance_mode else sample.league_prior(comp_id, ctx)
    names_cache = {}

    def names(pid):
        if pid not in names_cache:
            card = identity.player_card(pid)
            names_cache[pid] = card["display_name"] if card else f"Jugador {pid}"
        return names_cache[pid]

    xs, ys, cells, rows, cols, grand, mult = _grid(items, dx, dy, limit)
    team_poss = len(items)

    def cell_obj(a, **extra):
        v, reason, adj = _color_value(a, metric, chance_mode, prior, side)
        badge = sample.sample_level("split", n=a["n"], unit=unit, team_poss=team_poss, games=len(a["games"])) if a["n"] else None
        mets = {m: dict(zip(("value", "reason"), _value(a, m, chance_mode))) for m in METRICS}
        return {"n": a["n"], "value": v, "reason": reason, "adj": adj, "sample": badge, "ranked": bool(badge and badge["ranked"]),
                "counts": _counts_out(a), "metrics": mets, "pct": None, **extra}

    grid = [[cell_obj(cells.get((x, y)) or _acc(), x=x, y=y) for y in ys] for x in xs]
    row_totals = [cell_obj(rows[x], key=x) for x in xs]
    col_totals = [cell_obj(cols[y], key=y) for y in ys]
    total = cell_obj(grand)

    # percentiles: contra la competencia (dimensiones comunes a todos los equipos) o dentro de la matriz
    basis = None
    if direction != "neutral":
        league_ok = DIMS[dx]["league"] and DIMS[dy]["league"] and color != "matriz"
        if league_ok:
            others = [t for t in _teams(comp_id) if t != team]
            pops = [_league_cells(t, comp_id, ctx, side, dx, dy, metric, chance_mode, prior) for t in others]
            mine = 0
            for i, x in enumerate(xs):
                for j, y in enumerate(ys):
                    c = grid[i][j]
                    if not c["ranked"] or c["value"] is None:
                        continue
                    vals = [p[(x, y)] for p in pops if (x, y) in p]
                    if len(vals) >= config.get("population.min_size"):
                        own = c["adj"]["value"] if c["adj"] else c["value"]
                        c["pct"] = population.percentile(own, vals, direction)
                        mine += 1
            if mine:
                basis = "competencia"
        if basis is None:
            valid = [(i, j) for i in range(len(xs)) for j in range(len(ys)) if grid[i][j]["ranked"] and grid[i][j]["value"] is not None]
            if len(valid) >= 3:
                vals = [(grid[i][j]["adj"]["value"] if grid[i][j]["adj"] else grid[i][j]["value"]) for i, j in valid]
                for (i, j), v in zip(valid, vals):
                    grid[i][j]["pct"] = population.percentile(v, [o for k, o in enumerate(vals) if (valid[k] != (i, j))], direction)
                basis = "matriz"

    cells_n = sum(a["n"] for a in cells.values())
    overlap = DIMS[dx]["overlap"] or DIMS[dy]["overlap"]
    check = {"ok": cells_n == mult and (overlap or cells_n == grand["n"]), "cells": cells_n, "total": grand["n"], "unit": unit,
             "overlapped": overlap, "expected": mult, "points_cells": sum(a["pts"] for a in cells.values()),
             "points_total": None if overlap else grand["pts"]}
    if not overlap:
        check["ok"] = check["ok"] and check["points_cells"] == grand["pts"]
    games = data["games_used"]
    return {
        "team": team, "side": side, "metric": metric, "metric_label": METRICS[metric][0], "metric_fmt": METRICS[metric][2], "direction": direction,
        "unit": unit, "limit": limit,
        "dims": {"x": {"key": dx, "label": DIMS[dx]["label"], "values": _labels(dx, xs, names)},
                 "y": {"key": dy, "label": DIMS[dy]["label"], "values": _labels(dy, ys, names)}},
        "cells": grid, "row_totals": row_totals, "col_totals": col_totals, "grand_total": total,
        "check": check, "pct_basis": basis,
        "excluded": {"incomplete": data["incomplete"]},
        "presets": PRESETS,
        "context": context_mod.context_echo(ctx, games_used=games, games_total=data["games_total"], games_excluded=data["excluded"], ignored=[],
                                            competition_label=repository.competition_labels().get(comp_id) if comp_id is not None else None),
    }


# ── Detalle de celda: conjunto estándar de T-05 (A-06 RF-16, CA-15) ──────────
# Tipo de entidad `cross_cell` (id `EQUIPO|dim_x|x|dim_y|y`, params `side` y `limit`): las posesiones (u oportunidades) de
# la celda como un split de contexto con el conjunto estándar completo. Es de un solo lado (el que se mira: el ataque del
# equipo o el del rival), así que ritmo, DER y Net van `no_aplica`. Una celda existe solo para un equipo: sin población.

def _parse_cell_id(entity_id):
    parts = str(entity_id).split("|")
    if len(parts) != 5:
        raise CrossError(400, "Celda inválida: equipo|dim_x|x|dim_y|y.")
    team, dx, x, dy, y = parts
    if dx not in DIMS or dy not in DIMS or dx == dy:
        raise CrossError(400, "Dimensión inválida.")
    return _norm(team), dx, x, dy, y


def cell_items(team, comp_id, ctx, side, dx, x, dy, y, limit=LIMIT_DEFAULT):
    """Ítems de UNA celda (las mismas reglas de ejes y «Otros» que la matriz)."""
    chance_mode = "oportunidad" in (dx, dy) or context_mod.has_chance_filters(ctx)
    data = _items(team, comp_id, ctx, side, chance_mode)
    items = data["items"]
    _, xrest = _axis(dx, items, limit)
    _, yrest = _axis(dy, items, limit)
    return [it for it in items if x in _keys_for(it, dx, xrest) and y in _keys_for(it, dy, yrest)], chance_mode, data


def cell_bundle(team, comp_id, ctx, side, dx, x, dy, y, limit=LIMIT_DEFAULT):
    import poss_filter
    from stats_engine import StatBundle
    import lineups
    sel, chance_mode, data = cell_items(team, comp_id, ctx, side, dx, x, dy, y, limit)
    if not sel:
        return None
    own, opp = poss_filter._empty(), poss_filter._empty()
    seconds = 0.0
    if chance_mode:
        games = {g["game_id"]: g for g in repository.team_pbp_games(team, comp_id)}
        spans_by_poss = {}
        for it in sel:
            p = it["p"]
            if id(p) not in spans_by_poss:
                order = sorted(games[it["game_id"]].get("events") or [], key=lambda e: e.get("action_number") or 0)
                idx = {e.get("action_number"): i for i, e in enumerate(order)}
                spans_by_poss[id(p)] = {ch.n: (a, d, s) for ch, a, d, s, _ev in poss_filter._chance_spans(p, order, idx)}
            span = spans_by_poss[id(p)].get(it["ch"].n)
            if span is None:
                continue
            poss_filter._add(own, span[0])
            poss_filter._add(opp, span[1])
            seconds += span[2]
    else:
        for it in sel:
            a, d = poss_filter._poss_box(it["p"])
            poss_filter._add(own, a)
            poss_filter._add(opp, d)
            seconds += it["p"].duration or 0
    own["blk_received"], opp["blk_received"] = opp.get("blk", 0), own.get("blk", 0)
    own["plus_minus"] = opp["plus_minus"] = None
    name = f"{team} · {x} × {y}"
    meta = {"team_code": team, "split": True, "poss_exact": True, "one_side": True, "side": side,
            "unit": "oportunidad" if chance_mode else "posesion", "cell": {"dim_x": dx, "x": x, "dim_y": dy, "y": y},
            "games_total": data["games_total"], "games_excluded": data["excluded"]}
    return StatBundle(entity_type="split", entity_id=f"{team}|{dx}|{x}|{dy}|{y}", name=name, own=own, opp=opp, team=None,
                      games=len({it["game_id"] for it in sel}), minutes=seconds / 60, team_minutes=None, seconds=seconds,
                      on_court=None, shots=None, possessions_counted=len(sel), null_reasons={}, meta=meta)


def _cell_loader(req):
    import metrics_catalog
    try:
        team, dx, x, dy, y = _parse_cell_id(req.entity_id)
        side = (req.params or {}).get("side") or "ataque"
        if side not in ("ataque", "defensa"):
            raise CrossError(400, "El lado debe ser ataque o defensa.")
        limit = int((req.params or {}).get("limit") or LIMIT_DEFAULT)
        b = cell_bundle(team, req.comp_id, req.ctx, side, dx, x, dy, y, limit)
    except CrossError as e:
        raise metrics_catalog.MetricsError(e.message, e.status, e.code) from None
    return [b] if b is not None else []


def _register_entity():
    import metrics_catalog
    metrics_catalog.register_entity("cross_cell", _cell_loader)


_register_entity()


# ── Tabla `cross_cells` (T-06, A-06 RF-17) ───────────────────────────────────
# Una fila por celda con datos de la matriz, con las métricas del cruce (las mismas que se pueden pintar) y el conteo de
# posesiones u oportunidades; ordenable y exportable. Las celdas son las mismas que dibuja `GET /api/cross`.

def table_rows(treq):
    import tables
    p = treq.params
    try:
        limit = int(p.get("limit") or LIMIT_DEFAULT)
    except ValueError:
        raise tables.TableError(400, "El límite debe ser un número.", "parametro_invalido", {"param": "limit"}) from None
    try:
        d = cross_matrix(p.get("team"), treq.comp_id, treq.ctx, dim_x=p.get("dim_x") or "", dim_y=p.get("dim_y") or "",
                         metric="ppp", side=p.get("side") or "ataque", limit=limit)
    except CrossError as e:
        raise tables.TableError(e.status, e.message, e.code) from None
    xs, ys = d["dims"]["x"]["values"], d["dims"]["y"]["values"]
    rows = []
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            c = d["cells"][i][j]
            if not c["n"]:
                continue
            texts = {"_x": x["label"], "_y": y["label"], "_n": c["n"], "_pts": c["counts"]["pts"]}
            for m in ("ppp", "efg_pct", "ts_pct", "ppt", "to_pct", "or_pct", "ft_rate"):
                texts["_" + m] = c["metrics"][m]["value"]
            rows.append(tables.TableRow(id=f"{x['key']}|{y['key']}", link=None, texts=texts, bundle=None,
                                        sample=c["sample"], reason_if_null="sin_intentos"))
    return rows


def _table_title(treq):
    p = treq.params
    dx, dy = DIMS.get(p.get("dim_x") or ""), DIMS.get(p.get("dim_y") or "")
    side = " (defensa)" if p.get("side") == "defensa" else ""
    return f"Contextos cruzados{side} — {dx['label'] if dx else ''} × {dy['label'] if dy else ''} — {_norm(p.get('team'))}"


def _register_table():
    import tables
    tables.register_table(
        "cross_cells", entity_type="cross", title="Contextos cruzados", builder=table_rows,
        required_params=("team", "dim_x", "dim_y"),
        default_columns=("_x", "_y", "_sample", "_n", "_pts", "_ppp", "_efg_pct", "_to_pct", "_or_pct"),
        bulk_scopes=(), row_kind="entity",
        extra_columns=(("_x", "Fila", "text"), ("_y", "Columna", "text"), ("_n", "Posesiones u oportunidades", "value:int"),
                       ("_pts", "Puntos", "value:int"), ("_ppp", "PPP", "value:dec2"), ("_efg_pct", "eFG%", "value:pct"),
                       ("_ts_pct", "TS%", "value:pct"), ("_ppt", "PPT", "value:dec2"), ("_to_pct", "TO%", "value:pct"),
                       ("_or_pct", "OR%", "value:pct"), ("_ft_rate", "FT Rate", "value:pct")),
        default_sort={"key": "_n", "dir": "desc", "use_adjusted": False},
        totals_mode="none", avg_mode="none", pct_mode="none", sample_col=True, title_fn=_table_title, levels=True,
    )


_register_table()
