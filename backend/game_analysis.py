"""Análisis completo de un partido (F-07).

Módulo principal de la vista Analizar (S5): encabezado, box oficial + conjunto estándar,
parciales por período con ratings, línea de tiempo del marcador, jugada a jugada filtrable,
zonas de tiro filtradas y conciliación. Todo on-the-fly sin persistir.
"""
import logging
from dataclasses import dataclass

import cache
import competitions
import config
import identity
import lineups
import possessions
import repository
import sample as sample_mod
import shot_zones
import stats_engine
from database import db, Game, TeamGameStats, PlayerGameStats, Shot, PbpEvent
from bundles import player_derived
from lineups import PERIOD_LEN, _agg, _pos
from stats_engine import StatBundle, compute_standard, _parse_minutes, played, _safe_div

log = logging.getLogger(__name__)


# ── Constantes ────────────────────────────────────────────────────────────────

TYPE_GROUPS = {
    "tiro":          {"2pt", "3pt"},
    "tiro_libre":    {"freethrow"},
    "rebote":        {"rebound"},
    "asistencia":    {"assist"},
    "perdida":       {"turnover"},
    "robo":          {"steal"},
    "tapon":         {"block"},
    "falta":         {"foul", "foulon"},
    "cambio":        {"substitution"},
    "tiempo_muerto": {"timeout"},
    "otro":          {"period", "game", "jumpball", "headcoachchallenge"},
}

_ACTION_TO_GROUP = {}
for _grp, _types in TYPE_GROUPS.items():
    for _t in _types:
        _ACTION_TO_GROUP[_t] = _grp

VALID_PERIODS = {"1", "2", "3", "4", "pr"}


# ── Helpers públicos ──────────────────────────────────────────────────────────

def elapsed_secs(period: int, period_type: str, clock_secs: int | None) -> int | None:
    if clock_secs is None:
        return None
    plen = PERIOD_LEN.get(period_type, 600)
    if period_type == "OVERTIME":
        return 2400 + (period - 1) * 300 + (plen - clock_secs)
    return (period - 1) * 600 + (plen - clock_secs)


def period_key(period: int, period_type: str) -> str:
    if period_type == "OVERTIME":
        return f"pr{period}"
    return str(period)


def period_label(period: int, period_type: str) -> str:
    if period_type == "OVERTIME":
        return f"PR{period}"
    return f"{period}C"


def _clock_display(clock_secs: int | None) -> str:
    if clock_secs is None:
        return ""
    m, s = divmod(max(0, clock_secs), 60)
    return f"{m:02d}:{s:02d}"


# ── Datos del partido ─────────────────────────────────────────────────────────

def _load_game(game_id: str):
    g = Game.query.filter_by(game_id=game_id).first()
    if not g:
        return None
    return g


def _load_tgs(game_id: str) -> dict:
    rows = TeamGameStats.query.filter_by(game_id=game_id).all()
    out = {}
    for r in rows:
        side = "home" if r.is_home else "away"
        out[side] = r
    return out


def _load_players(game_id: str) -> list:
    return PlayerGameStats.query.filter_by(game_id=game_id).all()


def _load_events(game_id: str) -> list[dict]:
    evs = PbpEvent.query.filter_by(game_id=game_id).order_by(PbpEvent.action_number).all()
    return [{c.name: getattr(e, c.name) for c in e.__table__.columns} for e in evs]


def _load_shots(game_id: str) -> list:
    return Shot.query.filter_by(game_id=game_id).all()


def _overtimes(game, events) -> int:
    if game.minutes and game.minutes > 40:
        return max(0, (game.minutes - 40) // 5)
    if events:
        ot_periods = {e.get("period") for e in events if e.get("period_type") == "OVERTIME"}
        return len(ot_periods)
    return 0


# ── Box oficial ───────────────────────────────────────────────────────────────

_BOX_COLS = [
    "pts", "fgm2", "fga2", "fgm3", "fga3", "ftm", "fta",
    "orb", "drb", "trb", "ast", "tov", "stl", "blk", "pf",
]

_TEAM_EXTRA_COLS = [
    "paint_pts", "second_chance_pts", "pts_from_tov", "bench_pts", "fast_break_pts",
    "blk_received", "fouls_drawn",
]


def _official_box(tgs_row) -> dict:
    box = {}
    for c in _BOX_COLS:
        box[c] = getattr(tgs_row, c, None)
    for c in _TEAM_EXTRA_COLS:
        v = getattr(tgs_row, c, None)
        if v is not None:
            box[c] = v
    box["fgm"] = (box.get("fgm2") or 0) + (box.get("fgm3") or 0)
    box["fga"] = (box.get("fga2") or 0) + (box.get("fga3") or 0)
    return box


# ── T-B1: period_partials ─────────────────────────────────────────────────────

def period_partials(game_id, events, tgs_map):
    home_tgs = tgs_map.get("home")
    away_tgs = tgs_map.get("away")
    if not home_tgs or not away_tgs:
        return [], None, "no_registrado"

    home_code = home_tgs.team_code
    away_code = away_tgs.team_code

    periods_seen = []
    if events:
        seen = {}
        for ev in events:
            pk = period_key(ev.get("period", 1), ev.get("period_type", "REGULAR"))
            if pk not in seen:
                seen[pk] = {
                    "period": ev.get("period", 1),
                    "period_type": ev.get("period_type", "REGULAR"),
                }
                periods_seen.append(pk)

    # try official period_pts (not available without F-11 ingest v2)
    # Fall back to pbp-derived partials
    source = None
    partials = []

    # pbp-derived partials
    if events:
        source = "pbp"
        period_scores = {}
        prev_s1, prev_s2 = 0, 0
        last_pk = None
        for ev in events:
            pk = period_key(ev.get("period", 1), ev.get("period_type", "REGULAR"))
            s1, s2 = ev.get("s1"), ev.get("s2")
            if s1 is None or s2 is None:
                continue
            if pk != last_pk and last_pk is not None:
                period_scores[last_pk] = (s1_end - prev_s1, s2_end - prev_s2)
                prev_s1, prev_s2 = s1_end, s2_end
            s1_end, s2_end = s1, s2
            last_pk = pk
        if last_pk:
            period_scores[last_pk] = (s1_end - prev_s1, s2_end - prev_s2)

        for pk in periods_seen:
            info = seen.get(pk, {})
            h, a = period_scores.get(pk, (0, 0))
            pdata = {
                "period": pk,
                "label": period_label(info.get("period", 1), info.get("period_type", "REGULAR")),
                "home": h,
                "away": a,
                "ratings": _period_ratings(events, pk, home_code, away_code, info),
            }
            partials.append(pdata)
    elif not events:
        source = None

    return partials, source


def _period_ratings(events, pk, home_code, away_code, period_info):
    evs_p = [e for e in events
             if period_key(e.get("period", 1), e.get("period_type", "REGULAR")) == pk]
    if not evs_p:
        return _null_ratings("sin_pbp")

    ptype = period_info.get("period_type", "REGULAR")
    plen = PERIOD_LEN.get(ptype, 600)

    home_box = _agg(evs_p, home_code)
    away_box = _agg(evs_p, away_code)

    def _side_ratings(own_box, opp_box):
        t_pos = _pos(own_box)
        o_pos = _pos(opp_box)
        oer = _safe_div(own_box["pts"], t_pos)
        der = _safe_div(opp_box["pts"], o_pos)
        net = round(oer - der, 4) if oer is not None and der is not None else None
        pace = _safe_div((t_pos + o_pos) / 2, plen / 60) if plen else None
        efg = _safe_div(own_box["fgm"] + 0.5 * own_box["fgm3"], own_box["fga"])
        ts = _safe_div(own_box["pts"], 2 * (own_box["fga"] + 0.44 * own_box["fta"]))
        to_pct = _safe_div(own_box["tov"], t_pos) if t_pos else None
        or_pct = _safe_div(own_box["orb"], own_box["orb"] + opp_box["drb"])
        ft_rate = _safe_div(own_box["fta"], own_box["fga"])
        return {
            "possessions": _mv(round(t_pos, 1) if t_pos is not None else None),
            "oer": _mv(oer), "der": _mv(der), "net_rating": _mv(net),
            "pace": _mv(round(pace, 1) if pace is not None else None),
            "efg_pct": _mv(efg), "ts_pct": _mv(ts),
            "to_pct": _mv(to_pct), "or_pct": _mv(or_pct), "ft_rate": _mv(ft_rate),
        }

    return {
        "home": _side_ratings(home_box, away_box),
        "away": _side_ratings(away_box, home_box),
    }


def _null_ratings(reason):
    keys = ["possessions", "oer", "der", "net_rating", "pace",
            "efg_pct", "ts_pct", "to_pct", "or_pct", "ft_rate"]
    side = {k: {"value": None, "reason": reason} for k in keys}
    return {"home": dict(side), "away": dict(side)}


def _mv(val, reason=None):
    if val is None:
        return {"value": None, "reason": reason or "sin_intentos"}
    return {"value": val, "reason": None}


# ── T-B2: score_timeline ──────────────────────────────────────────────────────

def score_timeline(game_id: str, events: list[dict], home_code: str, away_code: str,
                   overtimes: int) -> dict | None:
    if not events:
        return None

    min_run = config.get("game.run_min_points")
    points = []
    timeouts = []
    runs = []
    prev = (0, 0)
    run = None

    periods_info = []
    seen_periods = set()

    for ev in events:
        p = ev.get("period", 1)
        pt = ev.get("period_type", "REGULAR")
        pk = period_key(p, pt)

        if pk not in seen_periods:
            seen_periods.add(pk)
            start_t = elapsed_secs(p, pt, PERIOD_LEN.get(pt, 600))
            periods_info.append({"key": pk, "label": period_label(p, pt), "start_t": start_t or 0})

        t = elapsed_secs(p, pt, ev.get("clock_secs"))
        at = ev.get("action_type")

        if at == "timeout" and t is not None:
            timeouts.append({
                "t": t, "period_label": period_label(p, pt),
                "clock": _clock_display(ev.get("clock_secs")),
                "team_code": ev.get("team_code"),
            })

        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is None or s2 is None:
            continue
        cur = (s1, s2)
        if cur != prev and t is not None:
            d_home = s1 - prev[0]
            d_away = s2 - prev[1]
            d = d_home if d_home > 0 else d_away
            scorer = home_code if d_home > 0 else away_code

            points.append({
                "t": t, "period_label": period_label(p, pt),
                "clock": _clock_display(ev.get("clock_secs")),
                "home": s1, "away": s2, "margin": s1 - s2,
                "team": scorer, "action_number": ev.get("action_number"),
            })

            if run and run["team_code"] == scorer:
                run["pts"] += d
                run["end_t"] = t
                run["to"] = {"home": s1, "away": s2}
            else:
                if run and run["pts"] >= min_run:
                    run["period_label"] = run.get("_pl", "")
                    runs.append(run)
                run = {
                    "team_code": scorer, "pts": d,
                    "start_t": points[-2]["t"] if len(points) >= 2 else 0,
                    "end_t": t,
                    "from": {"home": prev[0], "away": prev[1]},
                    "to": {"home": s1, "away": s2},
                    "_pl": period_label(p, pt),
                }
            prev = cur

    if run and run["pts"] >= min_run:
        run["period_label"] = run.get("_pl", "")
        runs.append(run)

    for r in runs:
        r.pop("_pl", None)

    # lead changes, ties, biggest lead
    lead_changes = 0
    ties = 0
    biggest_home = {"pts": 0, "t": 0}
    biggest_away = {"pts": 0, "t": 0}
    prev_sign = 0
    for pt_ev in points:
        m = pt_ev["margin"]
        sign = 1 if m > 0 else (-1 if m < 0 else 0)
        if prev_sign != 0 and sign != 0 and sign != prev_sign:
            lead_changes += 1
        if m == 0 and pt_ev["t"] > 0:
            ties += 1
        if sign != 0:
            prev_sign = sign
        if m > biggest_home["pts"]:
            biggest_home = {"pts": m, "t": pt_ev["t"]}
        if -m > biggest_away["pts"]:
            biggest_away = {"pts": -m, "t": pt_ev["t"]}

    duration = 2400 + 300 * overtimes
    final = {"home": prev[0], "away": prev[1]}

    return {
        "duration": duration,
        "periods": periods_info,
        "points": points,
        "timeouts": timeouts,
        "runs": runs,
        "lead_changes": lead_changes,
        "ties": ties,
        "biggest_lead": {"home": biggest_home, "away": biggest_away},
        "final": final,
        "run_min_points": min_run,
    }


# ── T-B3: game_pbp ───────────────────────────────────────────────────────────

def game_pbp(game_id: str, events: list[dict], home_code: str, away_code: str,
             *, player_id: int | None = None, types: list[str] | None = None,
             periods: list[str] | None = None):
    if types:
        unknown = [t for t in types if t not in TYPE_GROUPS]
        if unknown:
            raise ValueError(f"Tipo de evento inválido: {', '.join(unknown)}")
    if periods:
        unknown = [p for p in periods if p not in VALID_PERIODS]
        if unknown:
            raise ValueError(f"Período inválido: {', '.join(unknown)}")

    type_groups_count = {}
    for ev in events:
        grp = _ACTION_TO_GROUP.get(ev.get("action_type"), "otro")
        type_groups_count[grp] = type_groups_count.get(grp, 0) + 1

    # build player name->id map
    player_rows = PlayerGameStats.query.filter_by(game_id=game_id).all()
    name_to_id = {}
    for r in player_rows:
        if r.player_id:
            name_to_id[r.player_name] = r.player_id

    if player_id is not None:
        id_to_name = {v: k for k, v in name_to_id.items()}
        if player_id not in id_to_name:
            valid_ids = sorted(name_to_id.values())
            raise ValueError(f"Jugador inválido: {player_id}")

    filtered = events
    if periods:
        def _period_match(ev):
            pk = period_key(ev.get("period", 1), ev.get("period_type", "REGULAR"))
            for fp in periods:
                if fp == "pr" and pk.startswith("pr"):
                    return True
                if pk == fp:
                    return True
            return False
        filtered = [e for e in filtered if _period_match(e)]

    if types:
        allowed = set()
        for t in types:
            allowed |= TYPE_GROUPS[t]
        filtered = [e for e in filtered if e.get("action_type") in allowed]

    if player_id is not None:
        target_name = id_to_name.get(player_id)
        filtered = [e for e in filtered if e.get("player_name") == target_name]

    # serialize
    score_h, score_a = 0, 0
    result_events = []
    for ev in events:
        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is not None and s2 is not None:
            score_h, score_a = s1, s2

    score_h, score_a = 0, 0
    score_map = {}
    for ev in events:
        s1, s2 = ev.get("s1"), ev.get("s2")
        if s1 is not None and s2 is not None:
            score_h, score_a = s1, s2
        score_map[ev.get("action_number")] = (score_h, score_a)

    for ev in filtered:
        p = ev.get("period", 1)
        pt = ev.get("period_type", "REGULAR")
        an = ev.get("action_number")
        sh, sa = score_map.get(an, (0, 0))
        pname = ev.get("player_name") or ""
        pid = name_to_id.get(pname)

        result_events.append({
            "action_number": an,
            "period": p,
            "period_type": pt,
            "period_label": period_label(p, pt),
            "clock": _clock_display(ev.get("clock_secs")),
            "elapsed": elapsed_secs(p, pt, ev.get("clock_secs")),
            "team_code": ev.get("team_code") or None,
            "player_id": pid,
            "player": pname or None,
            "action_type": ev.get("action_type"),
            "sub_type": ev.get("sub_type"),
            "type_group": _ACTION_TO_GROUP.get(ev.get("action_type"), "otro"),
            "success": ev.get("success"),
            "score": {"home": sh, "away": sa},
            "margin_home": sh - sa,
        })

    return {
        "game_id": game_id,
        "total": len(events),
        "count": len(result_events),
        "filters": {
            "player": player_id,
            "type": types,
            "period": periods,
        },
        "type_groups": [{"key": k, "count": v} for k, v in sorted(type_groups_count.items())],
        "events": result_events,
    }


# ── T-B4: game_shots ─────────────────────────────────────────────────────────

def game_shots(game_id: str, team_code: str, *,
               player_id: int | None = None, quarters: list[str] | None = None,
               bands: list[str] | None = None, zone: str | None = None):
    game = _load_game(game_id)
    if not game:
        raise ValueError("Partido no encontrado")

    if team_code not in (game.home_code, game.away_code):
        raise ValueError("El equipo no jugó este partido")

    shots = Shot.query.filter_by(game_id=game_id, team_code=team_code).all()

    has_coordinates = any(
        (s.court_x or 0) != 0 or (s.court_y or 0) != 0 for s in shots
    )
    mode = 11 if has_coordinates else 3

    # build possession band index from A-01
    band_index = {}
    try:
        poss_list = possessions.game_possessions(game_id)
        if poss_list:
            for p in poss_list:
                for shot_info in (p.shots or []):
                    an = shot_info.get("action_number")
                    if an is not None:
                        band_index[an] = {
                            "band": shot_info.get("band"),
                            "shot_clock_start": getattr(
                                next((c for c in p.chances if c.start_event <= an <= (c.end_event or an)), None),
                                "shot_clock_start", None
                            ) if p.chances else None,
                        }
    except Exception:
        log.debug("Could not load possessions for band index on game %s", game_id)

    # build player name->id map
    player_rows = PlayerGameStats.query.filter_by(game_id=game_id, team_code=team_code).all()
    name_to_id = {}
    for r in player_rows:
        if r.player_id:
            name_to_id[r.player_name] = r.player_id

    # get period_type for each event from pbp
    period_type_map = {}
    evs = PbpEvent.query.filter_by(game_id=game_id).all()
    for ev in evs:
        period_type_map[ev.action_number] = ev.period_type

    # classify and filter
    result_shots = []
    no_band = 0
    reset14 = 0
    for s in shots:
        z = shot_zones.classify_zone(
            s.action_type or "", s.sub_type or "",
            s.court_x or 0, s.court_y or 0,
        )
        bi = band_index.get(s.action_number, {})
        band = bi.get("band")
        scs = bi.get("shot_clock_start")
        if band is None:
            no_band += 1
        if scs == 14:
            reset14 += 1

        pts_val = 0
        if s.made:
            pts_val = 3 if s.action_type == "3pt" else 2

        pid = name_to_id.get(s.player_name)
        pt = period_type_map.get(s.action_number, "REGULAR")

        result_shots.append({
            "action_number": s.action_number,
            "player_id": pid,
            "player": s.player_name,
            "period": s.period,
            "period_type": pt,
            "clock": None,
            "zone": z,
            "band": band,
            "shot_clock_start": scs,
            "made": s.made,
            "pts": pts_val,
            "court_x": s.court_x,
            "court_y": s.court_y,
        })

    # apply filters
    filtered = result_shots
    ignored = []

    if quarters:
        def _q_match(shot):
            if shot["period_type"] == "OVERTIME":
                return "pr" in quarters
            return str(shot["period"]) in quarters
        filtered = [sh for sh in filtered if _q_match(sh)]

    if bands:
        has_pbp = bool(band_index)
        if not has_pbp:
            ignored.append({"param": "clock", "reason": "sin_pbp"})
        else:
            filtered = [sh for sh in filtered if sh["band"] in bands]

    if player_id is not None:
        filtered = [sh for sh in filtered if sh["player_id"] == player_id]

    # zone table from filtered shots
    zone_dicts = [{
        "action_type": sh.get("action_type", "2pt"),
        "sub_type": "",
        "x": sh.get("court_x") or 0,
        "y": sh.get("court_y") or 0,
        "made": sh["made"],
    } for sh in filtered]

    # manual zone aggregation
    zones = {}
    for sh in filtered:
        z = sh["zone"]
        if z not in zones:
            zones[z] = {"made": 0, "attempts": 0}
        zones[z]["attempts"] += 1
        zones[z]["made"] += sh["made"]

    total_attempts = sum(zd["attempts"] for zd in zones.values())
    for zk, zd in zones.items():
        pts_per = shot_zones.ZONE_POINTS.get(zk, 2)
        if zd["attempts"]:
            zd["fg_pct"] = round(zd["made"] / zd["attempts"], 4)
            zd["ppt"] = round(zd["made"] * pts_per / zd["attempts"], 3)
            factor = 1.5 if pts_per == 3 else 1.0
            zd["efg_pct"] = round(zd["made"] * factor / zd["attempts"], 4)
        else:
            zd["fg_pct"] = None
            zd["ppt"] = None
            zd["efg_pct"] = None
        zd["share"] = round(zd["attempts"] / total_attempts, 4) if total_attempts else None
        zd["percentile"] = None
        zd["pct_reason"] = "contexto_no_comparable"
        zd["sample"] = sample_mod.sample_level(
            "zone", n=zd["attempts"], unit="intentos",
        )

    # summary
    total_made = sum(zd["made"] for zd in zones.values())
    total_pts = sum(
        zd["made"] * shot_zones.ZONE_POINTS.get(zk, 2) for zk, zd in zones.items()
    )
    summary_efg = _safe_div(
        sum(zd["made"] * (1.5 if shot_zones.ZONE_POINTS.get(zk, 2) == 3 else 1.0)
            for zk, zd in zones.items()),
        total_attempts,
    )
    summary_ppt = _safe_div(total_pts, total_attempts)

    if zone:
        filtered = [sh for sh in filtered if sh["zone"] == zone]

    return {
        "game_id": game_id,
        "team_code": team_code,
        "has_coordinates": has_coordinates,
        "mode": mode,
        "filters": {
            "quarter": quarters,
            "clock": bands,
            "zone": zone,
            "player": player_id,
        },
        "zones": zones,
        "summary": {
            "attempts": total_attempts,
            "made": total_made,
            "efg_pct": summary_efg,
            "ppt": summary_ppt,
            "no_band": no_band,
            "reset14": reset14,
        },
        "shots": filtered,
        "ignored": ignored if ignored else None,
    }


# ── T-B5: reconcile_game ─────────────────────────────────────────────────────

def reconcile_game(game, tgs_map, players, partials, timeline):
    checks = []
    home_tgs = tgs_map.get("home")
    away_tgs = tgs_map.get("away")

    # score_final
    if home_tgs and away_tgs:
        ok = (home_tgs.pts == game.home_score and away_tgs.pts == game.away_score)
        checks.append({"check": "score_final", "ok": ok})
    else:
        checks.append({"check": "score_final", "ok": None})

    # players_sum
    diffs = {}
    count_cols = ["pts", "fgm2", "fga2", "fgm3", "fga3", "ftm", "fta", "ast", "stl", "blk", "pf"]
    for side, tgs in tgs_map.items():
        side_players = [p for p in players if
                        (p.team_code == tgs.team_code)]
        for col in count_cols:
            p_sum = sum(getattr(p, col, 0) or 0 for p in side_players)
            t_val = getattr(tgs, col, 0) or 0
            if p_sum != t_val:
                diffs[f"{side}.{col}"] = {"players": p_sum, "team": t_val}

        # rebotes: add team_orb/team_drb (not available pre-F-11)
        for rb, team_rb in [("orb", "team_orb"), ("drb", "team_drb")]:
            p_sum = sum(getattr(p, rb, 0) or 0 for p in side_players)
            # team_orb/team_drb not in TeamGameStats columns yet
            t_val = getattr(tgs, rb, 0) or 0
            if p_sum != t_val:
                diffs[f"{side}.{rb}"] = {"players": p_sum, "team": t_val}

        # tov: add team_tov (not available pre-F-11)
        p_sum_tov = sum(getattr(p, "tov", 0) or 0 for p in side_players)
        t_tov = getattr(tgs, "tov", 0) or 0
        if p_sum_tov != t_tov:
            diffs[f"{side}.tov"] = {"players": p_sum_tov, "team": t_tov}

    ps_ok = len(diffs) == 0
    checks.append({"check": "players_sum", "ok": ps_ok, "diffs": diffs})

    # period_sum
    if partials:
        h_sum = sum(p["home"] for p in partials)
        a_sum = sum(p["away"] for p in partials)
        ps_ok2 = (h_sum == (home_tgs.pts if home_tgs else 0) and
                   a_sum == (away_tgs.pts if away_tgs else 0))
        checks.append({"check": "period_sum", "ok": ps_ok2})
    else:
        checks.append({"check": "period_sum", "ok": None})

    # timeline_final
    if timeline and timeline.get("final"):
        tf = timeline["final"]
        ok = (tf["home"] == game.home_score and tf["away"] == game.away_score)
        checks.append({"check": "timeline_final", "ok": ok})
    else:
        checks.append({"check": "timeline_final", "ok": None})

    all_ok = all(c["ok"] for c in checks if c["ok"] is not None)
    return {"ok": all_ok, "items": checks}


# ── T-B6: game_players (StatBundle per player for a single game) ──────────────

def _game_player_bundles(game_id, players, tgs_map, events):
    home_tgs = tgs_map.get("home")
    away_tgs = tgs_map.get("away")
    home_code = home_tgs.team_code if home_tgs else None
    away_code = away_tgs.team_code if away_tgs else None

    # team minutes
    game_obj = _load_game(game_id)
    game_minutes = (game_obj.minutes or 40) if game_obj else 40

    # team box for each side
    team_box = {}
    if home_tgs:
        team_box[home_tgs.team_code] = _official_box(home_tgs)
    if away_tgs:
        team_box[away_tgs.team_code] = _official_box(away_tgs)

    # opp box
    opp_box = {}
    if home_tgs and away_tgs:
        opp_box[home_tgs.team_code] = _official_box(away_tgs)
        opp_box[away_tgs.team_code] = _official_box(home_tgs)

    bundles = []
    for p in players:
        mins = _parse_minutes(p.minutes)
        is_dnp = not played(p.minutes)
        tc = p.team_code

        own = {
            "fgm2": p.fgm2 or 0, "fga2": p.fga2 or 0,
            "fgm3": p.fgm3 or 0, "fga3": p.fga3 or 0,
            "ftm": p.ftm or 0, "fta": p.fta or 0,
            "orb": p.orb or 0, "drb": p.drb or 0,
            "ast": p.ast or 0, "tov": p.tov or 0,
            "stl": p.stl or 0, "blk": p.blk or 0,
            "pf": p.pf or 0,
            "pts": p.pts or 0,
            "fga": (p.fga2 or 0) + (p.fga3 or 0),
            "fgm": (p.fgm2 or 0) + (p.fgm3 or 0),
            "fouls_drawn": p.fouls_drawn,
            "blk_received": p.blk_received,
        }

        side = "home" if tc == home_code else "away"
        opp = opp_box.get(tc, {})
        team = team_box.get(tc, {})

        bundle = StatBundle(
            entity_type="player",
            entity_id=p.player_id or p.player_name,
            name=p.player_name,
            own=own,
            opp=opp if not is_dnp else None,
            team=team if not is_dnp else None,
            games=0 if is_dnp else 1,
            minutes=mins,
            team_minutes=game_minutes * 5 if not is_dnp else None,
            seconds=mins * 60 if mins else None,
            on_court=None,
            shots=None,
            possessions_counted=None,
            null_reasons={},
            derived=None if is_dnp else player_derived(team, opp, mins, game_minutes),
            meta={
                "team_code": tc,
                "side": side,
                "jersey": p.jersey,
                "starter": p.starter == 1,
                "player_id": p.player_id,
                "plus_minus": p.plus_minus,
                "dnp": is_dnp,
            },
        )
        bundles.append(bundle)
    return bundles


# ── T-B7: game_lineups ───────────────────────────────────────────────────────

def _game_lineup_bundles(game_id, events, team_code, player_rows):
    starters = lineups.game_starters(player_rows, team_code)
    if not starters:
        return []

    segs = lineups.build_segments(events, team_code, starters)
    if not segs:
        return []

    # identify opp code
    game = _load_game(game_id)
    if not game:
        return []
    opp_code = game.away_code if game.home_code == team_code else game.home_code

    # aggregate by lineup
    lineup_agg = {}
    name_to_id_map = {}
    for r in player_rows:
        if r.team_code == team_code and r.player_id:
            name_to_id_map[r.player_name] = r.player_id

    for seg in segs:
        on = seg["on_court"]
        if on is None or len(on) != 5:
            continue
        ids = frozenset(name_to_id_map.get(n, n) for n in on)
        key = ids
        if key not in lineup_agg:
            lineup_agg[key] = {"events": [], "seconds": 0, "names": {}}
        lineup_agg[key]["events"].extend(seg["events"])
        lineup_agg[key]["seconds"] += seg["seconds"]
        for n in on:
            pid = name_to_id_map.get(n, n)
            lineup_agg[key]["names"][pid] = n

    bundles = []
    for ids, entry in lineup_agg.items():
        ids_sorted = sorted(ids, key=lambda x: (isinstance(x, str), x))
        own_box = _agg(entry["events"], team_code)
        opp_box_data = _agg(entry["events"], opp_code)
        seconds = entry["seconds"]
        minutes = seconds / 60

        entity_id = f"{team_code}:{'-'.join(str(i) for i in ids_sorted)}"
        display = [entry["names"].get(pid, str(pid)) for pid in ids_sorted]

        bundle = StatBundle(
            entity_type="lineup",
            entity_id=entity_id,
            name=" · ".join(display),
            own=own_box,
            opp=opp_box_data,
            team=None,
            games=1,
            minutes=minutes,
            team_minutes=None,
            seconds=seconds,
            on_court=None,
            shots=None,
            possessions_counted=None,
            null_reasons={},
            meta={"team_code": team_code, "player_ids": list(ids_sorted)},
        )
        bundles.append(bundle)
    return bundles


# ── T-B8: game_detail (assembler) ────────────────────────────────────────────

def game_detail(game_id: str, base: str = "total") -> dict:
    def build():
        return _build_game_detail(game_id, base)
    return cache.memo("game", (game_id, base), build)


def _build_game_detail(game_id: str, base: str) -> dict:
    game = _load_game(game_id)
    if not game:
        return None

    comp = None
    comp_label = ""
    if game.competition_id:
        from database import Competition
        comp = Competition.query.filter_by(id=game.competition_id).first()
        if comp:
            comp_label = competitions.label(comp)

    tgs_map = _load_tgs(game_id)
    players = _load_players(game_id)
    events = _load_events(game_id)
    has_pbp = bool(events)
    shots = _load_shots(game_id)
    has_coords = any((s.court_x or 0) != 0 or (s.court_y or 0) != 0 for s in shots)
    ots = _overtimes(game, events)

    home_tgs = tgs_map.get("home")
    away_tgs = tgs_map.get("away")
    home_code = home_tgs.team_code if home_tgs else game.home_code
    away_code = away_tgs.team_code if away_tgs else game.away_code

    # encabezado
    game_info = {
        "game_id": game_id,
        "date": game.date,
        "competition_id": game.competition_id,
        "competition_label": comp_label,
        "home_code": home_code,
        "home_team": game.home_team,
        "away_code": away_code,
        "away_team": game.away_team,
        "home_score": game.home_score,
        "away_score": game.away_score,
        "minutes": game.minutes or (40 + 5 * ots),
        "overtimes": ots,
        "has_pbp": has_pbp,
        "has_coords": has_coords,
        "needs_reprocess": (game.ingest_version or 0) < 2 if game.ingest_version is not None else True,
    }

    # box oficial
    box = {}
    for side, tgs in tgs_map.items():
        box[side] = {
            "team_code": tgs.team_code,
            "team_name": tgs.team_name,
            "official": _official_box(tgs),
        }

    # estándar de equipo
    standard = {}
    for side, tgs in tgs_map.items():
        opp_side = "away" if side == "home" else "home"
        opp_tgs = tgs_map.get(opp_side)
        if opp_tgs:
            own_raw = _official_box(tgs)
            opp_raw = _official_box(opp_tgs)
            game_mins = game.minutes or (40 + 5 * ots)
            bundle = StatBundle(
                entity_type="team", entity_id=tgs.team_code, name=tgs.team_name,
                own=own_raw, opp=opp_raw, team=None,
                games=1, minutes=game_mins, team_minutes=None,
                seconds=game_mins * 60, on_court=None, shots=None,
                possessions_counted=None, null_reasons={},
            )
            vals = compute_standard(bundle)
            standard[side] = _format_standard(vals)

    # parciales
    partials, partials_source = period_partials(game_id, events, tgs_map)

    # timeline
    tl = score_timeline(game_id, events, home_code, away_code, ots) if has_pbp else None

    # jugadores
    player_bundles = _game_player_bundles(game_id, players, tgs_map, events)
    players_payload = _format_players(player_bundles, base)

    # quintetos
    lineups_payload = None
    if has_pbp:
        lineups_payload = {}
        for side, code in [("home", home_code), ("away", away_code)]:
            lb = _game_lineup_bundles(game_id, events, code, players)
            lineups_payload[side] = _format_lineups(lb)

    # conciliación
    checks = reconcile_game(game, tgs_map, players, partials, tl)

    return {
        "game": game_info,
        "box": {**box, "checks": checks},
        "standard": standard,
        "players": players_payload,
        "partials": partials,
        "partials_source": partials_source,
        "timeline": tl,
        "lineups": lineups_payload,
        "base": base,
    }


def _format_standard(vals: dict) -> dict:
    out = {}
    for k, v in vals.items():
        if isinstance(v, dict):
            out[k] = v
        else:
            out[k] = {"value": v, "reason": None}
    return out


def _format_players(bundles: list, base: str) -> list:
    result = []
    for b in bundles:
        meta = b.meta
        if b.games == 0:
            vals = {k: {"value": None, "reason": "dnp"}
                    for k in stats_engine.metrics_catalog_keys()}
        else:
            vals = compute_standard(b)
            try:
                vals = stats_engine.apply_base(vals, b, base)
            except (ValueError, AttributeError):
                pass

        result.append({
            "player_id": meta.get("player_id"),
            "player_name": b.name,
            "team_code": meta.get("team_code"),
            "side": meta.get("side"),
            "jersey": meta.get("jersey"),
            "starter": meta.get("starter"),
            "dnp": meta.get("dnp", False),
            "plus_minus": meta.get("plus_minus"),
            "minutes": round(b.minutes, 1) if b.minutes else 0,
            "metrics": _format_standard(vals),
        })
    return result


def _format_lineups(bundles: list) -> list:
    result = []
    for b in bundles:
        vals = compute_standard(b)
        t_pos = _pos(b.own) if b.own else 0
        badge = sample_mod.sample_level("lineup", n=t_pos, unit="posesiones")

        result.append({
            "id": b.entity_id,
            "name": b.name,
            "player_ids": b.meta.get("player_ids", []),
            "minutes": round(b.minutes, 1) if b.minutes else 0,
            "possessions": round(t_pos, 1),
            "sample": badge,
            "metrics": _format_standard(vals),
        })
    return result


# ── Helpers de metrics_catalog ────────────────────────────────────────────────

def metrics_catalog_keys():
    try:
        return stats_engine.metrics_catalog_keys()
    except AttributeError:
        import metrics_catalog
        return list(metrics_catalog.METRICS.keys())
