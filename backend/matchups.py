"""Coincidencia en cancha — matchups (F-07).

Calcula los cruces entre quintetos, jugadores y jugador-vs-quinteto de un partido
o entre dos equipos de una competencia. Nunca persiste resultados.

Terminología: "coincidencia en cancha", nunca "marcaje" (FIBA no registra asignaciones
defensivas). Ver spec.md RF-24.
"""
import logging

import cache
import config
import lineups
import repository
import sample as sample_mod
import stats_engine
from lineups import _agg, _pos, _sum_boxes, PERIOD_LEN
from stats_engine import StatBundle, compute_standard, _safe_div

log = logging.getLogger(__name__)


# ── Segmentos del partido ─────────────────────────────────────────────────────

def _game_segments(game_id: str):
    def build():
        return _build_game_segments(game_id)
    return cache.memo("matchups:game_segs", (game_id,), build)


def _build_game_segments(game_id: str):
    from database import Game, PlayerGameStats, PbpEvent

    game = Game.query.filter_by(game_id=game_id).first()
    if not game:
        return None

    events = [
        {c.name: getattr(e, c.name) for c in e.__table__.columns}
        for e in PbpEvent.query.filter_by(game_id=game_id).order_by(PbpEvent.action_number).all()
    ]
    if not events:
        return None

    player_rows = PlayerGameStats.query.filter_by(game_id=game_id).all()
    home_code, away_code = game.home_code, game.away_code
    codes = (home_code, away_code)

    # name-to-id maps
    name_to_id = {}
    for r in player_rows:
        if r.player_id:
            name_to_id[(r.team_code, r.player_name)] = r.player_id

    starters = {}
    for code in codes:
        s = lineups.game_starters(player_rows, code)
        starters[code] = s

    if not starters[home_code] or not starters[away_code]:
        return {"segments": [], "reason": "titulares_incompletos",
                "home_code": home_code, "away_code": away_code,
                "name_to_id": name_to_id}

    segs = lineups.build_segments_both(events, codes, starters)

    # convert player names to ids in on_court
    converted = []
    for seg in segs:
        oc = {}
        for code in codes:
            names = seg["on_court"].get(code)
            if names is None:
                oc[code] = None
            else:
                oc[code] = frozenset(name_to_id.get((code, n), n) for n in names)
        converted.append({
            "on_court": oc,
            "events": seg["events"],
            "seconds": seg["seconds"],
        })

    return {"segments": converted, "reason": None,
            "home_code": home_code, "away_code": away_code,
            "name_to_id": name_to_id}


# ── Conteos por lado ──────────────────────────────────────────────────────────

def _side_counts(evs, code):
    return _agg(evs, code)


def _player_counts(evs, player_name):
    b = dict(pts=0, fgm2=0, fga2=0, fgm3=0, fga3=0, ftm=0, fta=0,
             orb=0, drb=0, ast=0, tov=0)
    for ev in evs:
        if ev.get("player_name") != player_name:
            continue
        at = ev.get("action_type")
        ok = ev.get("success") == 1
        if at == "2pt":
            b["fga2"] += 1
            b["fgm2"] += ok
        elif at == "3pt":
            b["fga3"] += 1
            b["fgm3"] += ok
        elif at == "freethrow":
            b["fta"] += 1
            b["ftm"] += ok
        elif at == "rebound":
            st = (ev.get("sub_type") or "").lower()
            if "offensive" in st:
                b["orb"] += 1
            elif "defensive" in st:
                b["drb"] += 1
        elif at == "assist":
            b["ast"] += 1
        elif at == "turnover":
            b["tov"] += 1
    b["pts"] = 2 * b["fgm2"] + 3 * b["fgm3"] + b["ftm"]
    return b


# ── Matchup ID format ────────────────────────────────────────────────────────

def _matchup_id(own_code, own_ids, opp_code, opp_ids):
    own_str = "-".join(str(i) for i in sorted(own_ids, key=lambda x: (isinstance(x, str), x)))
    opp_str = "-".join(str(i) for i in sorted(opp_ids, key=lambda x: (isinstance(x, str), x)))
    return f"{own_code}:{own_str}|{opp_code}:{opp_str}"


# ── game_matchups ─────────────────────────────────────────────────────────────

LEVELS = ("quinteto", "jugador", "jugador_quinteto")


def game_matchups(game_id: str, level: str = "quinteto", *, side: str = "home"):
    if level not in LEVELS:
        raise ValueError("Nivel inválido")

    data = _game_segments(game_id)
    if data is None:
        return None
    if not data["segments"]:
        return {"rows": [], "reason": data.get("reason", "sin_pbp")}

    home_code, away_code = data["home_code"], data["away_code"]
    own, opp = home_code, away_code
    if level == "jugador_quinteto" and side != "home":
        own, opp = away_code, home_code
    return _matchup_rows([(game_id, data)], own, opp, level)


def team_matchups(team_code: str, rival_code: str, game_ids: list, level: str = "quinteto", *,
                  side: str = "team"):
    """Cruces acumulados de todos los partidos `game_ids` entre los dos equipos (F-03), mismo
    algoritmo por segmentos que `game_matchups`. `side` (solo `jugador_quinteto`): "team" =
    jugadores propios vs quintetos rivales; "rival" = el sentido inverso. Cada fila trae en
    `games` los partidos y posesiones del cruce."""
    if level not in LEVELS:
        raise ValueError("Nivel inválido")
    own, opp = team_code, rival_code
    if level == "jugador_quinteto" and side == "rival":
        own, opp = rival_code, team_code
    datas = []
    for gid in game_ids:
        data = _game_segments(gid)
        if data and data["segments"] and {data["home_code"], data["away_code"]} == {team_code, rival_code}:
            datas.append((gid, data))
    if not datas:
        return {"rows": [], "matrix": None, "reason": "sin_enfrentamientos"}
    return _matchup_rows(datas, own, opp, level)


def _matchup_rows(datas: list, own: str, opp: str, level: str) -> dict:
    """Acumula los tramos 5v5 de uno o más partidos por cruce (`own` = lado propio)."""
    id_to_name = {}
    for _, data in datas:
        for (tc, pn), pid in data["name_to_id"].items():
            id_to_name[(tc, pid)] = pn

    acc = {}
    for gid, data in datas:
        for seg in data["segments"]:
            o_on = seg["on_court"].get(own)
            p_on = seg["on_court"].get(opp)
            if o_on is None or p_on is None or len(o_on) != 5 or len(p_on) != 5:
                continue
            if level == "quinteto":
                keys = [(o_on, p_on)]
            elif level == "jugador":
                keys = [(frozenset({a}), frozenset({b})) for a in o_on for b in p_on]
            else:
                keys = [(frozenset({a}), p_on) for a in o_on]
            for own_ids, opp_ids in keys:
                mid = _matchup_id(own, own_ids, opp, opp_ids)
                entry = acc.setdefault(mid, {"events": [], "seconds": 0, "by_game": {},
                                             "own_code": own, "own_ids": own_ids,
                                             "opp_code": opp, "opp_ids": opp_ids})
                entry["events"].extend(seg["events"])
                entry["seconds"] += seg["seconds"]
                entry["by_game"].setdefault(gid, []).extend(seg["events"])

    rows = []
    for mid, entry in acc.items():
        own_box = _side_counts(entry["events"], entry["own_code"])
        opp_box = _side_counts(entry["events"], entry["opp_code"])
        seconds = entry["seconds"]
        minutes = seconds / 60
        t_pos = _pos(own_box)
        o_pos = _pos(opp_box)

        badge = sample_mod.sample_level("matchup", n=t_pos, unit="posesiones")

        oer = _safe_div(own_box["pts"], t_pos)
        der = _safe_div(opp_box["pts"], o_pos)
        net = round(oer - der, 4) if oer is not None and der is not None else None

        efg = _safe_div(own_box["fgm"] + 0.5 * own_box.get("fgm3", 0), own_box["fga"])
        ts = _safe_div(own_box["pts"], 2 * (own_box["fga"] + 0.44 * own_box["fta"]))
        opp_efg = _safe_div(opp_box["fgm"] + 0.5 * opp_box.get("fgm3", 0), opp_box["fga"])
        opp_ts = _safe_div(opp_box["pts"], 2 * (opp_box["fga"] + 0.44 * opp_box["fta"]))
        to_pct = _safe_div(own_box["tov"], t_pos) if t_pos else None
        or_pct = _safe_div(own_box["orb"], own_box["orb"] + opp_box["drb"])

        # names
        def _names(code, ids):
            return [id_to_name.get((code, pid), str(pid)) for pid in
                    sorted(ids, key=lambda x: (isinstance(x, str), x))]

        own_names = _names(entry["own_code"], entry["own_ids"])
        opp_names = _names(entry["opp_code"], entry["opp_ids"])

        row = {
            "id": mid,
            "own_name": " · ".join(own_names),
            "opp_name": " · ".join(opp_names),
            "own_code": entry["own_code"],
            "opp_code": entry["opp_code"],
            "minutes": round(minutes, 1),
            "possessions": round(t_pos, 1) if t_pos else 0,
            "opp_possessions": round(o_pos, 1) if o_pos else 0,
            "pts_for": own_box["pts"],
            "pts_against": opp_box["pts"],
            "oer": oer, "der": der, "net_rating": net,
            "efg_pct": efg, "ts_pct": ts,
            "opp_efg_pct": opp_efg, "opp_ts_pct": opp_ts,
            "to_pct": to_pct, "or_pct": or_pct,
            "sample": badge,
            "net_band": sample_mod.band(t_pos or 0, "matchup", "net_rating", poss_def=o_pos or 0)
                        if net is not None else None,
            "games": [{"game_id": gid, "possessions": round(_pos(_side_counts(evs, entry["own_code"])), 1)}
                      for gid, evs in entry["by_game"].items()],
        }

        # player-level extra
        if level == "jugador":
            own_pid = list(entry["own_ids"])[0]
            opp_pid = list(entry["opp_ids"])[0]
            own_pname = id_to_name.get((entry["own_code"], own_pid), str(own_pid))
            opp_pname = id_to_name.get((entry["opp_code"], opp_pid), str(opp_pid))
            row["extra"] = {
                "plus_minus": own_box["pts"] - opp_box["pts"],
                "player_a": {"player_id": own_pid, **_player_counts(entry["events"], own_pname)},
                "player_b": {"player_id": opp_pid, **_player_counts(entry["events"], opp_pname)},
            }

        rows.append(row)

    # sort by possessions desc
    rows.sort(key=lambda r: r.get("possessions", 0), reverse=True)

    # matrix for quinteto level
    matrix = None
    if level == "quinteto":
        own_ids_set = list({r["id"].split("|")[0] for r in rows})
        opp_ids_set = list({r["id"].split("|")[1] for r in rows})
        cells = {}
        for r in rows:
            parts = r["id"].split("|")
            cell_key = r["id"]
            cells[cell_key] = {
                "net_rating": r["net_rating"],
                "possessions": r["possessions"],
                "level": r["sample"].get("level") if r["sample"] else None,
            }
        matrix = {"rows": own_ids_set, "cols": opp_ids_set, "cells": cells}

    return {"rows": rows, "matrix": matrix, "reason": None}


# ── Entity registration ──────────────────────────────────────────────────────

def _register():
    import metrics_catalog
    try:
        metrics_catalog.register_entity("matchup", _load_matchup_bundles)
    except Exception:
        log.debug("matchup entity already registered or metrics_catalog not ready")


def _load_matchup_bundles(req):
    pass


try:
    _register()
except Exception:
    pass
