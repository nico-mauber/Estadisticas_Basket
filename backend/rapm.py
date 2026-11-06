"""Impacto ajustado — RAPM (A-11).

Regresión ridge sobre stints de posesiones (A-01, `matchups.stints`): cada observación es un lado de un stint
(cinco atacan contra cinco que defienden) con respuesta `y = 100 · puntos / posesiones` y peso `w = posesiones`.
Cada jugador aporta dos incógnitas: O (cuando ataca) y D (cuando defiende). El nivel base (media ponderada de la
competencia) se resta y no se penaliza. λ se elige por validación cruzada con los partidos completos asignados a
pliegues; las ecuaciones normales dispersas se resuelven con gradiente conjugado precondicionado (Jacobi) en
Python puro (Arq. §3.18, DA-25).

Publicación: `off = β_O`, `def = −β_D` (signo orientado: positivo = mejor), `total = off + def`, en puntos por 100
posesiones sobre el promedio de la competencia, siempre junto a las posesiones del jugador.

El cálculo es bajo demanda (`recompute`, acción de administrador) y su resultado vive en memoria del proceso con
las versiones de datos y configuración con que se calculó: una lectura nunca calcula, y un resultado viejo se
sigue mostrando marcado `stale`. Nunca se persiste en la base (Constitución 4).
"""
import logging
import math
import threading
import time
from collections import OrderedDict
from datetime import datetime, timezone

import cache
import config
import context as context_mod
import identity
import matchups
import population
import repository
import sample
import stats_engine

log = logging.getLogger(__name__)

MAX_SECS = 150          # tiempo máximo del cálculo (gunicorn corta a los 180 s)
CG_TOL = 1e-9           # tolerancia relativa del residuo del gradiente conjugado
CG_MAXIT = 500
TOP_N = 10              # top del diagnóstico de dominancia
DOMINANCE_ALPHA = 0.10  # nivel de la prueba binomial de sobrerrepresentación del cuartil inferior en el top 10
SPEARMAN_FLOOR = -0.3   # correlación mínima admitida entre |impacto| y posesiones
MAX_STORED = 4          # competencias con resultado en memoria (LRU)
CHANGED_WARN = 0.10     # share de posesiones con cambio de quinteto que dispara la advertencia

_RESULTS: "OrderedDict[int, dict]" = OrderedDict()
_RUNNING: set = set()
_lock = threading.Lock()


class RapmTimeout(Exception):
    pass


class RapmBusy(Exception):
    pass


# ── Diseño ───────────────────────────────────────────────────────────────────

def _design(stints: list) -> dict:
    """Filas `(game_id, cols, w, y, pts)`: 5 columnas O del atacante (índice p) y 5 D del defensor (P + p)."""
    players = sorted({pid for st in stints for pid in st["home_on"] + st["away_on"]})
    idx = {p: i for i, p in enumerate(players)}
    P = len(players)
    rows = []
    for st in stints:
        for side, off, de in (("home", st["home_on"], st["away_on"]), ("away", st["away_on"], st["home_on"])):
            w = st[f"poss_{side}"]
            if w <= 0:
                continue
            pts = st[f"pts_{side}"]
            cols = tuple([idx[p] for p in off] + [P + idx[q] for q in de])
            rows.append((st["game_id"], cols, w, 100.0 * pts / w, pts))
    sw = sum(r[2] for r in rows)
    mu = sum(r[2] * r[3] for r in rows) / sw if sw else None
    return {"players": players, "P": P, "rows": rows, "mu": mu, "sw": sw}


def _accumulate(rows: list, n: int) -> dict:
    """Ecuaciones normales de un subconjunto de filas: `A = XᵀWX` (dict por fila), `Sy = Σ w·y·x`, `S1 = Σ w·x`."""
    A = [dict() for _ in range(n)]
    Sy, S1 = [0.0] * n, [0.0] * n
    SW = SWY = 0.0
    for _, cols, w, y, _pts in rows:
        SW += w
        SWY += w * y
        for i in cols:
            Ai = A[i]
            Sy[i] += w * y
            S1[i] += w
            for j in cols:
                Ai[j] = Ai.get(j, 0.0) + w
    return {"A": A, "Sy": Sy, "S1": S1, "SW": SW, "SWY": SWY}


def _compact(A: list, minus: list | None = None) -> tuple:
    """`A − minus` como listas `(índices, valores)` por fila + diagonal."""
    M, diag = [], []
    for i, row in enumerate(A):
        d = dict(row)
        if minus is not None:
            for j, v in minus[i].items():
                d[j] = d.get(j, 0.0) - v
        items = [(j, v) for j, v in d.items() if abs(v) > 1e-9]
        M.append(([j for j, _ in items], [v for _, v in items]))
        diag.append(d.get(i, 0.0) if abs(d.get(i, 0.0)) > 1e-9 else 0.0)
    return M, diag


def _matvec(M: list, v: list) -> list:
    return [sum(a * v[j] for j, a in zip(ix, vals)) for ix, vals in M]


def _dot(a: list, b: list) -> float:
    return sum(x * y for x, y in zip(a, b))


def _cg_solve(M: list, diag: list, b: list, lam: float, x0: list, deadline: float) -> tuple:
    """Resuelve `(A + λI)·x = b` con gradiente conjugado precondicionado (Jacobi), arranque en `x0`.
    Devuelve `(x, iteraciones)`; lanza `RapmTimeout` si pasa `deadline` (time.monotonic)."""
    if time.monotonic() > deadline:
        raise RapmTimeout()
    n = len(b)
    bn = math.sqrt(_dot(b, b))
    if bn == 0:
        return [0.0] * n, 0
    x = list(x0)
    Ax = _matvec(M, x)
    r = [b[i] - Ax[i] - lam * x[i] for i in range(n)]
    if math.sqrt(_dot(r, r)) / bn < CG_TOL:
        return x, 0
    pre = [1.0 / (diag[i] + lam) for i in range(n)]
    z = [r[i] * pre[i] for i in range(n)]
    p = list(z)
    rz = _dot(r, z)
    for it in range(1, CG_MAXIT + 1):
        Ap = _matvec(M, p)
        Ap = [Ap[i] + lam * p[i] for i in range(n)]
        pAp = _dot(p, Ap)
        if pAp <= 0:
            return x, it
        alpha = rz / pAp
        x = [x[i] + alpha * p[i] for i in range(n)]
        r = [r[i] - alpha * Ap[i] for i in range(n)]
        if math.sqrt(_dot(r, r)) / bn < CG_TOL:
            return x, it
        if time.monotonic() > deadline:
            raise RapmTimeout()
        z = [r[i] * pre[i] for i in range(n)]
        rz_new = _dot(r, z)
        p = [z[i] + (rz_new / rz) * p[i] for i in range(n)]
        rz = rz_new
    return x, CG_MAXIT


def _rhs(acc: dict, mu: float, minus: dict | None = None) -> list:
    if minus is None:
        return [acc["Sy"][i] - mu * acc["S1"][i] for i in range(len(acc["Sy"]))]
    return [(acc["Sy"][i] - minus["Sy"][i]) - mu * (acc["S1"][i] - minus["S1"][i]) for i in range(len(acc["Sy"]))]


def _sse(rows: list, x: list, mu: float) -> float:
    """Error cuadrático ponderado medio de `rows` con coeficientes `x` y nivel base `mu`."""
    sw = sum(r[2] for r in rows)
    if not sw:
        return 0.0
    return sum(w * (y - mu - sum(x[c] for c in cols)) ** 2 for _, cols, w, y, _ in rows) / sw


# ── Validación cruzada ───────────────────────────────────────────────────────

def _folds_by_game(game_ids: list, folds: int) -> dict:
    """Asignación determinista: índice del partido en `sorted(game_ids)` módulo `folds`."""
    return {g: i % folds for i, g in enumerate(sorted(game_ids))}


def _cross_validate(design, total_acc, fold_of, folds, lambdas, deadline, stats):
    n = 2 * design["P"]
    by_fold = [[] for _ in range(folds)]
    for r in design["rows"]:
        by_fold[fold_of[r[0]]].append(r)
    errors = {lam: 0.0 for lam in lambdas}
    baseline, used = 0.0, 0
    for k in range(folds):
        val = by_fold[k]
        if not val:
            continue
        acc_k = _accumulate(val, n)
        tr_sw = total_acc["SW"] - acc_k["SW"]
        if tr_sw <= 0:
            continue
        mu_k = (total_acc["SWY"] - acc_k["SWY"]) / tr_sw
        M, diag = _compact(total_acc["A"], acc_k["A"])
        b = _rhs(total_acc, mu_k, acc_k)
        baseline += _sse(val, [0.0] * n, mu_k)
        x = [0.0] * n
        for lam in sorted(lambdas):
            x, it = _cg_solve(M, diag, b, lam, x, deadline)
            stats["solves"] += 1
            stats["iterations"] += it
            errors[lam] += _sse(val, x, mu_k)
        used += 1
    if not used:
        return None, None
    cv = [{"lambda": lam, "error": round(errors[lam] / used, 3)} for lam in sorted(lambdas)]
    return cv, round(baseline / used, 3)


# ── Publicación ──────────────────────────────────────────────────────────────

def _r(v, nd=2):
    """Redondeo sin «−0»."""
    return round(v, nd) + 0.0


def _player_info(comp_id: int) -> dict:
    """{player_id canónico: {name, team_code, minutes, games}} desde player_game_stats (los DNP no suman)."""
    out = {}
    for r in repository.player_game_rows(comp_id):
        pid = identity.canonical_id(r.get("player_id")) if r.get("player_id") is not None else None
        if pid is None:
            continue
        e = out.setdefault(pid, {"team_code": r.get("team_code"), "minutes": 0.0, "games": 0})
        e["team_code"] = r.get("team_code") or e["team_code"]
        if stats_engine.played(r.get("minutes")):
            e["minutes"] += stats_engine._parse_minutes(r.get("minutes"))
            e["games"] += 1
    for pid, e in out.items():
        card = identity.player_card(pid)
        e["name"] = card["display_name"] if card else f"Jugador {pid}"
        e["minutes"] = round(e["minutes"], 1)
    return out


def _ficha(value, pid, members: list) -> dict:
    """Ficha T-01 de un valor entre `members` = [(pid, nombre, valor)] (población con muestra suficiente)."""
    empty = {"rank": None, "rank_total": None, "tied": False, "percentile": None, "avg": None, "dist_avg": None,
             "leader": None, "dist_leader": None, "in_population": any(m[0] == pid for m in members), "pct_reason": None}
    if value is None:
        return empty
    if len(members) < config.get("population.min_size"):
        return {**empty, "pct_reason": "poblacion_insuficiente"}
    others = [m[2] for m in members if m[0] != pid]
    rk, tied = population.rank(value, others, "higher")
    vals = [m[2] for m in members]
    avg = round(sum(vals) / len(vals), 2)
    best = max(vals)
    leader = sorted([m for m in members if m[2] == best], key=lambda m: population._norm_name(m[1]))[0]
    return {**empty, "rank": rk, "rank_total": len(members), "tied": tied,
            "percentile": population.percentile(value, others, "higher"), "avg": avg, "dist_avg": round(value - avg, 2),
            "leader": {"id": leader[0], "name": leader[1], "value": leader[2]}, "dist_leader": round(value - leader[2], 2)}


def _publish(design: dict, x: list, info: dict) -> list:
    P = design["P"]
    poss_off, poss_def = [0] * P, [0] * P
    pts_off, pts_def = [0] * P, [0] * P
    for _, cols, w, _y, pts in design["rows"]:
        for c in cols[:5]:
            poss_off[c] += w
            pts_off[c] += pts
        for c in cols[5:]:
            poss_def[c - P] += w
            pts_def[c - P] += pts
    rows = []
    seen = set()
    for i, pid in enumerate(design["players"]):
        seen.add(pid)
        inf = info.get(pid) or {"name": f"Jugador {pid}", "team_code": None, "minutes": 0.0, "games": 0}
        off, de = x[i], -x[P + i]
        net = (100 * (pts_off[i] / poss_off[i] - pts_def[i] / poss_def[i])) if poss_off[i] and poss_def[i] else None
        badge = sample.sample_level("player", n=inf["minutes"], unit="minutos", minutes=inf["minutes"], games=inf["games"],
                                    possessions=poss_off[i] + poss_def[i])
        rows.append({"player_id": pid, "name": inf["name"], "team_code": inf["team_code"],
                     "off": {"value": _r(off), "reason": None}, "def": {"value": _r(de), "reason": None},
                     "total": {"value": _r(off + de), "reason": None},
                     "possessions": poss_off[i] + poss_def[i], "poss_off": poss_off[i], "poss_def": poss_def[i],
                     "minutes": inf["minutes"], "games": inf["games"],
                     "onoff_net": {"value": _r(net, 1), "reason": None} if net is not None else {"value": None, "reason": "sin_intentos"},
                     "sample": badge, "ranked": badge["ranked"]})
    # Jugadores de la competencia sin posesiones en los stints usados: sin valor (C-11), fuera del ranking.
    for pid, inf in info.items():
        if pid in seen or not inf["games"]:
            continue
        badge = sample.sample_level("player", n=inf["minutes"], unit="minutos", minutes=inf["minutes"], games=inf["games"], possessions=0)
        none = {"value": None, "reason": "sin_datos"}
        rows.append({"player_id": pid, "name": inf["name"], "team_code": inf["team_code"], "off": dict(none), "def": dict(none),
                     "total": dict(none), "possessions": 0, "poss_off": 0, "poss_def": 0, "minutes": inf["minutes"],
                     "games": inf["games"], "onoff_net": dict(none), "sample": badge, "ranked": False})
    members = {k: [(r["player_id"], r["name"], r[k]["value"]) for r in rows if r["ranked"] and r[k]["value"] is not None]
               for k in ("off", "def", "total")}
    for r in rows:
        for k in ("off", "def", "total"):
            if r["ranked"] and r[k]["value"] is not None:
                r[k].update(_ficha(r[k]["value"], r["player_id"], members[k]))
            elif r[k]["value"] is not None:
                r[k].update({"rank": None, "rank_total": None, "percentile": None, "in_population": False, "pct_reason": "muestra_baja"})
    rows.sort(key=lambda r: (r["total"]["value"] is None, not r["ranked"], -(r["total"]["value"] or 0), population._norm_name(r["name"])))
    return rows


def _p25(values: list):
    """Percentil 25 con interpolación lineal."""
    v = sorted(values)
    if not v:
        return None
    pos = 0.25 * (len(v) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (pos - lo)


def _binom_limit(n: int, p: float, alpha: float) -> int:
    """Menor k con P(X > k) ≤ alpha para X ~ Binomial(n, p)."""
    probs = [math.comb(n, k) * p ** k * (1 - p) ** (n - k) for k in range(n + 1)]
    for k in range(n + 1):
        if sum(probs[k + 1:]) <= alpha:
            return k
    return n


def _top_ids(design, x, n=TOP_N):
    P = design["P"]
    vals = [(x[i] - x[P + i], pid) for i, pid in enumerate(design["players"])]
    return [pid for _, pid in sorted(vals, key=lambda t: (-t[0], t[1]))[:n]]


def _diagnostics(players: list, design: dict, x_final: list, x_unreg: list, lam_u: float) -> dict:
    ranked = [p for p in players if p["ranked"] and p["total"]["value"] is not None]
    top = sorted(ranked, key=lambda p: (-p["total"]["value"], p["player_id"]))[:TOP_N]
    p25 = _p25([p["possessions"] for p in ranked])
    below = sum(1 for p in top if p25 is not None and p["possessions"] < p25)
    sp = stats_engine.spearman([abs(p["total"]["value"]) for p in ranked], [p["possessions"] for p in ranked])
    limit = _binom_limit(len(top), 0.25, DOMINANCE_ALPHA)
    low_in_top = sum(1 for p in top if not p["ranked"])
    # «Dominado» = sobrerrepresentado: el top 10 tiene más jugadores del cuartil inferior de posesiones de lo que
    # daría el azar (binomial con p = 0,25, α = 0,10) o el |impacto| crece al bajar la muestra (Spearman < −0,3).
    # El criterio estricto de la spec (ninguno debajo del p25) se informa aparte: aun sin ninguna relación entre
    # impacto y posesiones se cumple solo con probabilidad 0,75¹⁰ ≈ 5,6 %.
    ok = (low_in_top == 0 and below <= limit and (sp is None or sp >= SPEARMAN_FLOOR)) if top else None
    dom = {"ok": ok, "top_n": len(top),
           "top_min_possessions": min(p["possessions"] for p in top) if top else None,
           "top_below_p25": below, "expected_below_p25": round(0.25 * len(top), 1), "max_below_p25": limit,
           "strict_ok": (min(p["possessions"] for p in top) >= p25) if top else None,
           "top_low_sample": low_in_top,
           "p25_possessions": round(p25, 1) if p25 is not None else None, "ranked_players": len(ranked),
           "spearman_abs_total_vs_possessions": round(sp, 3) if sp is not None else None, "spearman_floor": SPEARMAN_FLOOR}
    low = {p["player_id"] for p in players if p["sample"]["level"] == "baja"}
    top_u, top_c = _top_ids(design, x_unreg), _top_ids(design, x_final)
    cmp_ = {"lambda": lam_u, "top10_low_sample_unregularized": sum(1 for i in top_u if i in low),
            "top10_low_sample_chosen": sum(1 for i in top_c if i in low), "top10_overlap": len(set(top_u) & set(top_c)),
            "top10_unregularized": top_u,
            "low_sample_definition": "minutos < sample.player.min; los dos top 10 se arman sin filtro de muestra"}
    return {"dominance": dom, "compare_unregularized": cmp_}


# ── Cálculo y almacenamiento ─────────────────────────────────────────────────

def _lambdas() -> list:
    raw = config.get("rapm.lambdas")
    vals = sorted({float(v) for v in raw if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0}) if isinstance(raw, list) else []
    return [int(v) if v.is_integer() else v for v in vals] or [500, 1000, 2000, 4000, 8000]


def _comp_echo(comp_id: int, games_used: int, games_total: int, sin_pbp: int, ignored=()):
    ctx = context_mod.parse_context({"competition": str(comp_id)})
    return context_mod.context_echo(ctx, games_used=games_used, games_total=games_total,
                                    games_excluded={"sin_pbp": sin_pbp} if sin_pbp else {}, ignored=list(ignored),
                                    competition_label=repository.competition_labels().get(comp_id))


def _store(comp_id: int, payload: dict) -> None:
    v = cache.get_versions()
    with _lock:
        _RESULTS[comp_id] = {"payload": payload, "data_version": v["data_version"], "config_version": v["config_version"]}
        _RESULTS.move_to_end(comp_id)
        while len(_RESULTS) > MAX_STORED:
            _RESULTS.popitem(last=False)


def recompute(comp_id: int) -> dict:
    """Calcula el RAPM de la competencia (síncrono) y guarda el resultado con sus versiones. `RapmTimeout` si supera
    `MAX_SECS` (no guarda nada); `RapmBusy` si ya hay un cálculo en curso para esa competencia."""
    with _lock:
        if comp_id in _RUNNING:
            raise RapmBusy()
        _RUNNING.add(comp_id)
    try:
        return _recompute(comp_id)
    finally:
        with _lock:
            _RUNNING.discard(comp_id)


def _recompute(comp_id: int) -> dict:
    t0 = time.monotonic()
    deadline = t0 + MAX_SECS
    folds = int(config.get("rapm.folds"))
    lambdas = _lambdas()
    comp = {"id": comp_id, "label": repository.competition_labels().get(comp_id)}
    st = matchups.stints(comp_id)
    summ = st["summary"]
    needed = 2 * folds
    base = {"competition": comp, "computed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "lambdas": lambdas, "folds": folds}
    if summ["games"] < needed:
        payload = {**base, "status": "datos_insuficientes", "games": summ["games"], "needed": needed, "reason": "pocos_partidos",
                   "message": f"Hacen falta al menos {needed} partidos con play-by-play para validar el modelo."}
        _store(comp_id, payload)
        return payload
    design = _design(st["stints"])
    if design["P"] < 10 or not design["rows"]:
        payload = {**base, "status": "datos_insuficientes", "games": summ["games"], "needed": needed, "reason": "sin_stints",
                   "message": "No hay posesiones con los cinco jugadores de ambos equipos identificados."}
        _store(comp_id, payload)
        return payload

    n = 2 * design["P"]
    fold_of = _folds_by_game(summ["game_ids"], folds)
    total_acc = _accumulate(design["rows"], n)
    stats = {"solves": 0, "iterations": 0}
    cv, cv_baseline = _cross_validate(design, total_acc, fold_of, folds, lambdas, deadline, stats)
    best = min(cv, key=lambda c: (c["error"], -c["lambda"]))
    lam = best["lambda"]

    mu = design["mu"]
    M, diag = _compact(total_acc["A"])
    b = _rhs(total_acc, mu)
    x, it = _cg_solve(M, diag, b, lam, [0.0] * n, deadline)
    stats["solves"] += 1
    stats["iterations"] += it
    lam_u = min(lambdas) / 100
    x_u, it = _cg_solve(M, diag, b, lam_u, x, deadline)
    stats["solves"] += 1
    stats["iterations"] += it

    info = _player_info(comp_id)
    players = _publish(design, x, info)
    diag_out = _diagnostics(players, design, x, x_u, lam_u)

    warnings = []
    if len(lambdas) > 1 and lam in (min(lambdas), max(lambdas)):
        warnings.append({"code": "lambda_en_el_borde", "message": "El λ elegido está en el borde de la grilla: ampliá la grilla."})
    if cv_baseline is not None and best["error"] >= cv_baseline:
        warnings.append({"code": "sin_mejora_vs_modelo_vacio", "message": "La validación no mejora el modelo vacío: la muestra es insuficiente."})
    used = summ["possessions_used"]
    changed_share = round(summ["lineup_changed"] / used, 4) if used else None
    if changed_share is not None and changed_share > CHANGED_WARN:
        warnings.append({"code": "muchos_cambios_de_quinteto",
                         "message": "Muchas posesiones tienen cambios de quinteto en el medio: se atribuyen al quinteto del inicio."})

    total = summ["possessions_total"]
    payload = {
        **base, "status": "listo", "duration_s": round(time.monotonic() - t0, 2),
        "lambda": lam, "cv": cv, "cv_baseline": cv_baseline,
        "folds_by_game": fold_of,
        "model": {"rows": len(design["rows"]), "stints": len(st["stints"]), "players": design["P"], "games": summ["games"],
                  "possessions_total": total, "possessions_used": used,
                  "coverage": round(used / total, 4) if total else None, "excluded": summ["excluded"],
                  "lineup_changed_share": changed_share, "intercept": round(mu, 2),
                  "fit": {"error_model": round(_sse(design["rows"], x, mu), 3), "error_empty": round(_sse(design["rows"], [0.0] * n, mu), 3)},
                  "cg": {"solves": stats["solves"], "iterations_mean": round(stats["iterations"] / stats["solves"], 1) if stats["solves"] else None}},
        "players": players, "diagnostics": diag_out, "warnings": warnings,
        "context": _comp_echo(comp_id, summ["games"], summ["games"] + summ["excluded"]["games_sin_pbp"], summ["excluded"]["games_sin_pbp"]),
    }
    _store(comp_id, payload)
    log.info("RAPM competencia %s: λ=%s, %s filas, %s jugadores, %.1f s", comp_id, lam, len(design["rows"]), design["P"], payload["duration_s"])
    return payload


def cached(comp_id: int) -> dict:
    """Resultado guardado (nunca calcula). `sin_calcular` si no hay; `stale` si los datos o la configuración cambiaron."""
    with _lock:
        e = _RESULTS.get(comp_id)
    if e is None:
        return {"status": "sin_calcular", "competition": {"id": comp_id, "label": repository.competition_labels().get(comp_id)},
                "message": "El impacto ajustado todavía no se calculó."}
    v = cache.get_versions()
    stale = (e["data_version"], e["config_version"]) != (v["data_version"], v["config_version"])
    return {**e["payload"], "stale": stale}


def view(comp_id: int, *, player: int | None = None, top: int = 25, can_recompute: bool = False, ignored=()) -> dict:
    """Payload de `GET /api/rapm`: `players` recortado a `top` (0 = todos) y la fila de `player`."""
    out = {**cached(comp_id), "can_recompute": can_recompute}
    if out["status"] != "listo":
        return out
    players = out["players"]
    out["players_total"] = len(players)
    out["players"] = players if not top else players[:top]
    if ignored:
        out["context"] = {**out["context"], "ignored": list(ignored)}
    if player is not None:
        out["player"] = next((p for p in players if p["player_id"] == player), None)
    return out


def player_in_competition(comp_id: int, pid: int) -> bool:
    return any(identity.canonical_id(r.get("player_id")) == pid for r in repository.player_game_rows(comp_id)
               if r.get("player_id") is not None)


# ── Tabla T-06 `rapm` ────────────────────────────────────────────────────────

def table_rows(treq) -> list:
    import bundles
    import tables
    res = cached(treq.comp_id) if treq.comp_id is not None else {"status": "sin_calcular"}
    if res.get("status") != "listo":
        return []
    by_id = {b.entity_id: b for b in bundles.all_player_bundles(treq.comp_id, treq.ctx)}
    out = []
    for p in res["players"]:
        if p["total"]["value"] is None:
            continue
        texts = {"_name": p["name"], "_team": p["team_code"], "_rapm_total": p["total"]["value"], "_rapm_off": p["off"]["value"],
                 "_rapm_def": p["def"]["value"], "_rapm_poss": p["possessions"], "_rapm_minutes": p["minutes"],
                 "_rapm_rank": p["total"].get("rank"), "_onoff_net": p["onoff_net"]["value"]}
        out.append(tables.TableRow(id=str(p["player_id"]), link=f"player:{p['player_id']}", texts=texts,
                                   bundle=by_id.get(p["player_id"]), sample=p["sample"], reason_if_null="sin_datos"))
    return out


def _fmt_utc(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d/%m/%Y %H:%M UTC")
    except (TypeError, ValueError):
        return iso or ""


def table_extras(treq) -> dict:
    res = cached(treq.comp_id) if treq.comp_id is not None else {"status": "sin_calcular"}
    if res.get("status") != "listo":
        return {"info": {"status": res.get("status")}, "filters": [{"label": "Impacto ajustado", "value": "Todavía no se calculó"}]}
    m = res["model"]
    cov = f"{m['coverage'] * 100:.1f} %".replace(".", ",") if m.get("coverage") is not None else "—"
    return {"info": {"status": "listo", "stale": res.get("stale"), "lambda": res["lambda"], "folds": res["folds"],
                     "computed_at": res["computed_at"], "coverage": m.get("coverage")},
            "filters": [{"label": "λ elegido", "value": f"{res['lambda']:g}"}, {"label": "Pliegues", "value": str(res["folds"])},
                        {"label": "Calculado", "value": _fmt_utc(res["computed_at"])}, {"label": "Cobertura de posesiones", "value": cov}]}
