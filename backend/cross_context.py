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
    def build():
        all_games = repository.team_pbp_games(team, comp_id)
        games, excluded = context_mod.filter_games_ex(all_games, ctx, team)
        window = config.get("clutch.window_secs")
        margin = config.get("clutch.margin")
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
                for ch in (p.chances if chance_mode else [None]):
                    if chance_mode and ch.box is None:
                        continue
                    items.append({"game_id": g["game_id"], "c": _item_counts(p, ch), "dv": _dims_of(p, ch, g, side, info)})
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
    chance_mode = "oportunidad" in (dim_x, dim_y)
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
