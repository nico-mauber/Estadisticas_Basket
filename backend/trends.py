"""Tendencias y evolución partido a partido (F-18) para equipo y jugador.

Una serie por métrica del conjunto estándar (hasta tres), con media móvil, indicador de tendencia (últimos N partidos contra el
resto, con prueba de Welch sobre los valores por partido) y hitos (cambios de racha, sede y ausencias de jugadores clave).
Los valores salen de `compute_standard` aplicado a cada partido: la misma fórmula que la ficha, nunca una fórmula paralela.
"""
import math

import bundles
import cache
import config
import metrics_catalog
import population
import repository
import stats_engine
import context as context_mod
from context import Context, context_key, context_echo

PRESETS = [
    {"key": "pts_vs_rec", "label": "Puntos anotados y recibidos", "metrics": ["pts", "pts_against"]},
    {"key": "oer_der", "label": "OER y DER", "metrics": ["oer", "der"]},
    {"key": "efg_to", "label": "eFG% y TO%", "metrics": ["efg_pct", "to_pct"]},
]
MA_CHOICES = (3, 5, 10)
MIN_GROUP = 3


class TrendError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


# ── Estadística ──────────────────────────────────────────────────────────────

def _betacf(a, b, x):
    qab, qap, qam = a + b, a + 1, a - 1
    c, d = 1.0, 1 - qab * x / qap
    d = 1 / (d if abs(d) > 1e-30 else 1e-30)
    h = d
    for m in range(1, 200):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > 1e-30 else 1e-30)
        c = 1 + aa / c; c = c if abs(c) > 1e-30 else 1e-30
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d; d = 1 / (d if abs(d) > 1e-30 else 1e-30)
        c = 1 + aa / c; c = c if abs(c) > 1e-30 else 1e-30
        delta = d * c
        h *= delta
        if abs(delta - 1) < 3e-12:
            break
    return h


def _betai(a, b, x):
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    bt = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log(1 - x))
    if x < (a + 1) / (a + b + 2):
        return bt * _betacf(a, b, x) / a
    return 1 - bt * _betacf(b, a, 1 - x) / b


def welch(x: list, y: list):
    """Prueba de Welch bilateral: `(t, gl, p)` o `None` si no hay variación para compararlas."""
    nx, ny = len(x), len(y)
    if nx < 2 or ny < 2:
        return None
    mx, my = sum(x) / nx, sum(y) / ny
    vx = sum((v - mx) ** 2 for v in x) / (nx - 1)
    vy = sum((v - my) ** 2 for v in y) / (ny - 1)
    se2 = vx / nx + vy / ny
    if se2 <= 0:
        return None
    t = (mx - my) / math.sqrt(se2)
    df = se2 ** 2 / ((vx / nx) ** 2 / (nx - 1) + (vy / ny) ** 2 / (ny - 1))
    p = _betai(df / 2, 0.5, df / (df + t * t))
    return t, df, p


def moving_average(values: list, k: int) -> list:
    """Media de los últimos `k` valores válidos hasta cada partido; sin `k` valores todavía no hay punto."""
    out, window = [], []
    for v in values:
        if v is not None:
            window.append(v)
            window = window[-k:]
        out.append(round(sum(window) / k, 4) if len(window) == k and v is not None else None)
    return out


# ── Series ───────────────────────────────────────────────────────────────────

def _pairs(entity_type, entity_id, comp_id, ctx):
    if entity_type == "team":
        return bundles.team_game_bundles(str(entity_id).upper(), comp_id, ctx)
    return bundles.player_game_bundles(int(entity_id), comp_id, ctx)


def _values(bundle, base):
    vals = stats_engine.compute_standard(bundle)
    try:
        vals = stats_engine.apply_base(vals, bundle, base)
    except ValueError:
        pass
    return vals


def trends(entity_type: str, entity_id, comp_id: int | None, ctx: Context, *, metrics: list, ma: int | None = None,
           last_n: int | None = None, base: str = "partido") -> dict:
    ma = config.get("trends.default_ma") if ma is None else ma
    last_n = config.get("trends.last_n") if last_n is None else last_n
    key = (entity_type, str(entity_id), comp_id, context_key(ctx), tuple(metrics), ma, last_n, base)
    return cache.memo("trends", key, lambda: _build(entity_type, entity_id, comp_id, ctx, metrics, ma, last_n, base))


def _build(entity_type, entity_id, comp_id, ctx, metrics, ma, last_n, base) -> dict:
    pairs = _pairs(entity_type, entity_id, comp_id, ctx)
    streak_min = config.get("trends.streak_min")
    alpha = config.get("trends.alpha")
    games = []
    for info, b in pairs:
        row = {"game_id": info["game_id"], "date": info.get("date"), "opponent": info.get("opponent"),
               "home_away": info.get("home_away"), "team_pts": info.get("team_pts"), "opp_pts": info.get("opp_pts"),
               "played": b is not None, "values": {}, "reasons": {}}
        tp, op = info.get("team_pts"), info.get("opp_pts")
        row["result"] = None if tp is None or op is None or tp == op else ("V" if tp > op else "D")
        row["diff"] = None if tp is None or op is None else tp - op
        if entity_type == "player":
            row["diff"] = (b.own.get("plus_minus") if b is not None else None)
        vals = _values(b, base) if b is not None else {}
        for m in metrics:
            obj = vals.get(m) or {}
            v = obj.get("value")
            row["values"][m] = v
            row["reasons"][m] = None if v is not None else ("dnp" if b is None else obj.get("reason") or "sin_datos")
        games.append(row)

    series = []
    for m in metrics:
        d = metrics_catalog.METRICS[m]
        vals = [g["values"][m] for g in games]
        s = {"metric": m, "label": d.label, "fmt": d.fmt, "direction": d.direction, "group": d.group, "values": vals,
             "ma": moving_average(vals, ma), "trend": _trend(pairs, vals, m, d, last_n, base, alpha)}
        series.append(s)

    out = {"entity": {"type": entity_type, "id": str(entity_id)}, "games": games, "series": series,
           "ma": ma, "last_n": last_n, "base": base, "alpha": alpha, "presets": PRESETS,
           "milestones": _milestones(entity_type, entity_id, comp_id, games, streak_min),
           "reference": _reference(entity_type, entity_id, comp_id, ctx, metrics, base)}
    out["context"] = context_echo(ctx, games_used=sum(1 for g in games if g["played"]), games_total=len(games), games_excluded={},
                                  ignored=[], competition_label=repository.competition_labels().get(comp_id) if comp_id is not None else None)
    return out


def _trend(pairs, vals, m, d, last_n, base, alpha) -> dict:
    n = len(vals)
    cut = max(0, n - last_n)
    rest_idx, last_idx = list(range(cut)), list(range(cut, n))
    xs_last = [vals[i] for i in last_idx if vals[i] is not None]
    xs_rest = [vals[i] for i in rest_idx if vals[i] is not None]
    out = {"last_n": last_n, "n_last": len(xs_last), "n_rest": len(xs_rest), "last": None, "rest": None, "delta": None,
           "delta_rel": None, "direction": None, "p_value": None, "significant": None, "reason": None}
    if len(xs_last) < MIN_GROUP or len(xs_rest) < MIN_GROUP:
        out["reason"] = "muestra_insuficiente"
        return out
    # valor de cada grupo = cociente de totales (la misma agregación que la ficha), no el promedio de las tasas por partido
    def pooled(idx):
        bs = [pairs[i][1] for i in idx if pairs[i][1] is not None]
        if not bs:
            return None
        b = bundles.sum_bundles(bs)
        return (_values(b, base).get(m) or {}).get("value")
    a, r = pooled(last_idx), pooled(rest_idx)
    if a is None or r is None:
        out["reason"] = "sin_datos"
        return out
    out.update({"last": a, "rest": r, "delta": round(a - r, 4), "delta_rel": round((a - r) / abs(r), 4) if r else None})
    sgn = -1 if d.direction == "lower" else 1
    out["direction"] = "neutral" if d.direction == "neutral" else ("mejora" if sgn * (a - r) > 0 else "empeora" if sgn * (a - r) < 0 else "igual")
    w = welch(xs_last, xs_rest)
    if w is not None:
        out["p_value"] = round(w[2], 4)
        out["significant"] = w[2] < alpha
    return out


def _milestones(entity_type, entity_id, comp_id, games, streak_min) -> list:
    """Hitos por partido: racha cortada (de al menos `streak_min` iguales) y, en equipos, ausencias de jugadores clave."""
    out = [{"game_id": g["game_id"], "venue": g["home_away"], "streak_break": None, "absent": []} for g in games]
    run_res, run_len = None, 0
    for i, g in enumerate(games):
        res = g["result"]
        if res is None:
            continue
        if run_res is not None and res != run_res and run_len >= streak_min:
            out[i]["streak_break"] = {"result": run_res, "length": run_len}
        if res == run_res:
            run_len += 1
        else:
            run_res, run_len = res, 1
    if entity_type == "team":
        code = str(entity_id).upper()
        ids = {g["game_id"] for g in games}
        rows = [r for r in repository.player_game_rows(comp_id) if r["team_code"] == code and r["game_id"] in ids]
        minutes = {}
        for r in rows:
            mn = r.get("minutes")
            if mn and str(mn) not in ("0", "0:00", "00:00"):
                minutes[r["player_id"]] = minutes.get(r["player_id"], 0) + 1
        mins = {}
        names = {}
        for r in rows:
            names[r["player_id"]] = r["player_name"]
            try:
                mm, ss = (str(r["minutes"] or "0:00").split(":") + ["0"])[:2]
                mins[r["player_id"]] = mins.get(r["player_id"], 0) + int(mm) + int(ss) / 60
            except ValueError:
                pass
        key_players = sorted(mins, key=lambda p: -mins[p])[:config.get("trends.key_players")]
        order = {g["game_id"]: i for i, g in enumerate(games)}
        played_idx = {}
        for r in rows:
            if r.get("minutes") and str(r["minutes"]) not in ("0", "0:00", "00:00"):
                played_idx.setdefault(r["player_id"], []).append(order[r["game_id"]])
        for pid in key_players:
            pi = played_idx.get(pid)
            if not pi:
                continue
            lo, hi = min(pi), max(pi)
            for i in range(lo, hi + 1):
                if i not in pi:
                    out[i]["absent"].append(names[pid])
    return out


def _reference(entity_type, entity_id, comp_id, ctx, metrics, base) -> dict:
    """Promedio de la competencia por métrica (línea de referencia), solo por partido y con una competencia concreta."""
    if base != "partido" or ctx.competition_all or comp_id is None or context_key(ctx)[0] is None:
        return {}
    try:
        ref = population.league_reference(entity_type, comp_id, context_mod.without_last(ctx))   # el Ø no cambia con los últimos N
    except Exception:
        return {}
    return {m: ref.get(m) for m in metrics if ref.get(m) is not None}
