"""Sinergias entre jugadores (A-08): matriz de asistencias (quién asiste a quién), rankings de triples y de puntos tras
asistencia, parejas con el conjunto estándar ajustado por muestra (T-02) y jugadores que potencian a sus compañeros
(diferencial de un compañero con y sin ese jugador en cancha). Las asistencias salen de las posesiones de A-01 (el
vínculo asistencia → canasta lo resuelve el motor de posesiones); las parejas, de los segmentos de cancha de `lineups`.
"""
import dataclasses
from collections import Counter

import cache
import context as context_mod
import identity
import lineups
import origin as origin_mod
import possessions
import repository
import sample
import stats_engine
from context import context_key
from database import TeamGameStats

TOP = 10


class SynergyError(Exception):
    def __init__(self, status: int, message: str, code: str = "parametro_invalido"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _canon(pid):
    return (identity.canonical_id(pid) or pid) if pid is not None else None


def _name(pid):
    card = identity.player_card(pid) if pid is not None else None
    return card["display_name"] if card else f"Jugador {pid}"


def _m(num, den, nd=4):
    return {"value": round(num / den, nd), "reason": None} if den else {"value": None, "reason": "sin_intentos"}


# ── Matriz de asistencias ────────────────────────────────────────────────────

def _assist_data(team, comp_id, ctx):
    games, total, excluded = origin_mod._games_for(team, comp_id, ctx)
    links = Counter()           # (asistente, anotador) → cantidad
    pts, threes = Counter(), Counter()
    fgm, assisted = Counter(), Counter()
    by_scorer = {}              # anotador → Counter de asistentes
    pbp, incomplete, self_links = 0, 0, 0
    per_game, box = [], 0
    for g in games:
        n_pbp = sum(1 for e in g["events"] if e.get("team_code") == team and e.get("action_type") == "assist")
        pbp += n_pbp
        linked_g, inc_g = 0, 0
        for p in possessions.game_possessions(g["game_id"]):
            if p.team != team:
                continue
            if p.incomplete:
                inc_g += 1 if p.assister_id is not None else 0
                continue
            for s in p.shots:
                if s.get("made") and s.get("player_id") is not None:
                    fgm[_canon(s["player_id"])] += 1
            made = [s for s in p.shots if s.get("made")]
            if p.assister_id is None or not made:
                continue
            a, r = _canon(p.assister_id), _canon(p.finisher_id)
            if r is None:
                continue
            if a == r:
                self_links += 1
                continue
            shot = made[-1]
            links[(a, r)] += 1
            pts[(a, r)] += shot.get("pts") or 0
            threes[(a, r)] += 1 if shot.get("three") else 0
            assisted[r] += 1
            by_scorer.setdefault(r, Counter())[a] += 1
            linked_g += 1
        incomplete += inc_g
        row = TeamGameStats.query.filter_by(game_id=g["game_id"], team_code=team).first()
        b = getattr(row, "ast", None) if row is not None else None
        box += b or 0
        per_game.append({"game_id": g["game_id"], "pbp": n_pbp, "matrix": linked_g, "incomplete": inc_g, "box": b})
    return {"links": links, "pts": pts, "threes": threes, "fgm": fgm, "assisted": assisted, "by_scorer": by_scorer, "pbp": pbp,
            "incomplete": incomplete, "self_links": self_links, "box": box, "per_game": per_game,
            "games_used": len(games), "games_total": total, "excluded": excluded}


def _matrix(d):
    links = d["links"]
    ids = sorted({a for a, _ in links} | {r for _, r in links}, key=lambda i: (-sum(v for (a, _), v in links.items() if a == i), _name(i)))
    rows = sorted({a for a, _ in links}, key=lambda i: (-sum(v for (a, _), v in links.items() if a == i), _name(i)))
    cols = sorted({r for _, r in links}, key=lambda i: (-sum(v for (_, r), v in links.items() if r == i), _name(i)))
    cells = [{"assister": a, "scorer": r, "count": c, "points": d["pts"][(a, r)], "threes": d["threes"][(a, r)]} for (a, r), c in sorted(links.items(), key=lambda kv: (-kv[1], kv[0]))]
    row_tot = {i: {"count": sum(v for (a, _), v in links.items() if a == i), "points": sum(v for (a, _), v in d["pts"].items() if a == i),
                   "threes": sum(v for (a, _), v in d["threes"].items() if a == i)} for i in rows}
    col_tot = {i: {"count": sum(v for (_, r), v in links.items() if r == i), "points": sum(v for (_, r), v in d["pts"].items() if r == i),
                   "threes": sum(v for (_, r), v in d["threes"].items() if r == i)} for i in cols}
    linked = sum(links.values())
    unlinked = max(0, d["pbp"] - linked - d["incomplete"])
    check = {"ok": linked + unlinked + d["incomplete"] == d["pbp"] and sum(v["count"] for v in row_tot.values()) == linked == sum(v["count"] for v in col_tot.values()),
             "matrix": linked, "unlinked": unlinked, "incomplete": d["incomplete"], "pbp": d["pbp"], "box": d["box"], "self_links": d["self_links"],
             "box_matches": d["box"] == d["pbp"],
             "games_differing": [x for x in d["per_game"] if x["box"] is None or x["box"] != x["pbp"]]}
    named = lambda ids: [{"id": i, "name": _name(i)} for i in ids]
    return {"rows": named(rows), "cols": named(cols), "cells": cells, "row_totals": {str(k): v for k, v in row_tot.items()},
            "col_totals": {str(k): v for k, v in col_tot.items()}, "total": linked, "unlinked": unlinked, "incomplete": d["incomplete"],
            "pbp": d["pbp"], "check": check}


# ── Parejas y potenciadores ──────────────────────────────────────────────────

def _bundle_values(b, prior):
    b = dataclasses.replace(b, entity_type="pair")
    return b, sample.adjust_values(stats_engine.compute_standard(b), b, prior)


def _minus(total, part):
    """Bundle de `total` sin lo que ocurrió con `part` en cancha (conteos, posesiones y tiempo restados)."""
    def sub(a, b):
        if a is None:
            return None
        return {k: (v - ((b or {}).get(k) or 0) if isinstance(v, (int, float)) else v) for k, v in a.items()}
    seconds = (total.seconds or 0) - (part.seconds or 0)
    return dataclasses.replace(total, entity_type="pair", own=sub(total.own, part.own), opp=sub(total.opp, part.opp), seconds=seconds,
                               minutes=seconds / 60 if seconds else 0.0)


def _val(values, key, adj=True):
    o = (values or {}).get(key) or {}
    a = o.get("adj") if adj else None
    return a["value"] if a else o.get("value")


def _pairs_and_impact(team, comp_id, ctx):
    prior = sample.league_prior(comp_id, ctx)
    team_poss = sample.team_offensive_possessions(team, comp_id, ctx)
    pair_bs = {tuple(b.meta["player_ids"]): b for b in lineups.all_lineups(team, comp_id, ctx, size=2)}
    singles = {b.meta["player_ids"][0]: b for b in lineups.all_lineups(team, comp_id, ctx, size=1)}
    rows, cache_vals = [], {}
    for ids, b in pair_bs.items():
        b2, vals = _bundle_values(b, prior)
        badge = sample.sample_for("pair", [b2], team_poss=team_poss)
        cache_vals[ids] = (b2, vals, badge)
        adj = {k: vals[k]["adj"] for k in sample.REGRESSED_KEYS if (vals.get(k) or {}).get("adj") is not None}
        rows.append({"id": f"{team}:{ids[0]}-{ids[1]}", "players": [{"id": i, "name": _name(i)} for i in ids], "games": b.games,
                     "minutes": round(b.minutes or 0, 1), "possessions": (vals.get("possessions") or {}).get("value"),
                     "values": {k: vals[k] for k in ("oer", "der", "net_rating", "ts_pct", "efg_pct") if k in vals},
                     "adj": adj, "sample": badge, "ranked": badge["ranked"]})
    rows.sort(key=lambda r: (not r["ranked"], -(r["adj"].get("net_rating", {}).get("value") if r["adj"].get("net_rating") else -9), r["id"]))
    ranked = [r for r in rows if r["ranked"]]

    def top(key, adj):
        def v(r):
            o = r["values"].get(key) or {}
            a = r["adj"].get(key) if adj else None
            return a["value"] if a else o.get("value")
        pool = [r for r in ranked if v(r) is not None]
        return [r["id"] for r in sorted(pool, key=lambda r: (-v(r), r["id"]))[:TOP]]
    rankings = {"net_rating": top("net_rating", True), "oer": top("oer", True), "ts_pct": top("ts_pct", False)}

    # jugadores que potencian: rendimiento de B junto a A frente a B sin A
    impact = []
    ids = sorted(singles)
    for a in ids:
        comps = []
        for b in ids:
            if a == b:
                continue
            key = tuple(sorted((a, b)))
            if key not in cache_vals:
                continue
            _, v_with, badge_with = cache_vals[key]
            without = _minus(singles[b], pair_bs[key])
            wb, v_wo = _bundle_values(without, prior)
            badge_wo = sample.sample_for("pair", [wb], team_poss=team_poss)
            if not (badge_with["ranked"] and badge_wo["ranked"]):
                continue
            nw, nwo = _val(v_with, "net_rating"), _val(v_wo, "net_rating")
            ow, owo = _val(v_with, "oer"), _val(v_wo, "oer")
            if nw is None or nwo is None:
                continue
            comps.append({"id": b, "name": _name(b), "net_with": round(nw, 4), "net_without": round(nwo, 4), "diff_net": round(nw - nwo, 4),
                          "diff_oer": round(ow - owo, 4) if ow is not None and owo is not None else None,
                          "weight": round(min(badge_with["n"], badge_wo["n"]), 1)})
        if comps:
            wsum = sum(c["weight"] for c in comps)
            impact.append({"id": a, "name": _name(a), "companions": sorted(comps, key=lambda c: (-c["diff_net"], c["name"])), "n": len(comps),
                           "impact_net": round(sum(c["diff_net"] * c["weight"] for c in comps) / wsum, 4) if wsum else None,
                           "impact_oer": (round(sum(c["diff_oer"] * c["weight"] for c in comps if c["diff_oer"] is not None) /
                                               sum(c["weight"] for c in comps if c["diff_oer"] is not None), 4)
                                          if any(c["diff_oer"] is not None for c in comps) else None)})
    impact.sort(key=lambda r: (-(r["impact_net"] if r["impact_net"] is not None else -9), r["name"]))
    minutes = {i: round(s.minutes or 0, 1) for i, s in singles.items()}
    return rows, rankings, impact, minutes


# ── Reporte ──────────────────────────────────────────────────────────────────

def synergy(team_code, comp_id, ctx, player=None):
    team = str(team_code).upper()
    return cache.memo("synergy", (team, comp_id, context_key(ctx), player), lambda: _build(team, comp_id, ctx, player))


def _build(team, comp_id, ctx, player):
    if not repository.team_pbp_games(team, comp_id):
        raise SynergyError(404, "Este equipo no tiene play-by-play importado. Reimportá sus partidos.", "sin_pbp")
    d = _assist_data(team, comp_id, ctx)
    matrix = _matrix(d)
    pair_rows, pair_rankings, impact, minutes = _pairs_and_impact(team, comp_id, ctx)

    def player_badge(pid):
        return sample.sample_level("player", n=minutes.get(pid, 0), unit="minutos", minutes=minutes.get(pid, 0))

    gen3 = Counter()
    for (a, _), v in d["threes"].items():
        gen3[a] += v
    top_pairs = [{"assister": {"id": a, "name": _name(a)}, "scorer": {"id": r, "name": _name(r)}, "threes": v, "count": d["links"][(a, r)]}
                 for (a, r), v in sorted(d["threes"].items(), key=lambda kv: (-kv[1], _name(kv[0][0]), _name(kv[0][1]))) if v > 0][:TOP]
    by_player = []
    for pid, v in sorted(gen3.items(), key=lambda kv: (-kv[1], _name(kv[0]))):
        badge = player_badge(pid)
        by_player.append({"id": pid, "name": _name(pid), "threes": v, "sample": badge, "ranked": badge["ranked"]})
    after = []
    for r, n in d["assisted"].items():
        main = sorted(d["by_scorer"][r].items(), key=lambda kv: (-kv[1], _name(kv[0])))[0]
        badge = player_badge(r)
        after.append({"id": r, "name": _name(r), "points": sum(v for (_, s), v in d["pts"].items() if s == r), "assisted_fg": n,
                      "assisted_share": _m(n, d["fgm"][r]), "main_assister": {"id": main[0], "name": _name(main[0]), "count": main[1]},
                      "sample": badge, "ranked": badge["ranked"]})
    after.sort(key=lambda r: (not r["ranked"], -r["points"], r["name"]))
    by_player.sort(key=lambda r: (not r["ranked"], -r["threes"], r["name"]))
    out = {"team": team, "assist_matrix": matrix,
           "rankings": {"threes_pairs": top_pairs, "threes_by_player": by_player, "points_after_assist": after},
           "pairs": {"rows": pair_rows, "rankings": pair_rankings}, "teammate_impact": impact,
           "context": context_mod.context_echo(ctx, games_used=d["games_used"], games_total=d["games_total"], games_excluded=d["excluded"], ignored=[],
                                               competition_label=repository.competition_labels().get(comp_id) if comp_id is not None else None)}
    if player is not None:
        pid = _canon(int(player))
        mine = [r for r in pair_rows if any(p["id"] == pid for p in r["players"])]
        out["player"] = {
            "id": pid, "name": _name(pid),
            "best_pairs": [r for r in mine if r["ranked"]][:5],
            "assists_to": [{"id": r, "name": _name(r), "count": c, "points": d["pts"][(a, r)], "threes": d["threes"][(a, r)]}
                           for (a, r), c in sorted(d["links"].items(), key=lambda kv: (-kv[1], kv[0])) if a == pid][:5],
            "assisted_by": [{"id": a, "name": _name(a), "count": c, "points": d["pts"][(a, r)], "threes": d["threes"][(a, r)]}
                            for (a, r), c in sorted(d["links"].items(), key=lambda kv: (-kv[1], kv[0])) if r == pid][:5],
            "boosts": next((x for x in impact if x["id"] == pid), None),
        }
    return out
