"""Shot zone classification, aggregation and percentile enrichment (C-03).

Moved from app.py: zone constants, classification, and zone table builder.
New: `zones_with_stats` adds PPT percentile and sample badge per zone.
"""
import config
import population as population_mod
import sample as sample_mod
import competitions
import context as context_mod
import identity
from database import db, Shot, Game, PlayerGameStats
from stats_engine import played


# ── Zone constants ─────────────────────────────────────────────────────────

ZONE_KEYS_11 = [
    "restricted_area",
    "mid_left_close", "mid_right_close",
    "mid_left_far",   "mid_right_far",   "mid_top",
    "left_corner_3",  "right_corner_3",
    "left_wing_3",    "right_wing_3",    "top_key_3",
]

ZONE_POINTS = {
    "restricted_area": 2, "mid_left_close": 2, "mid_right_close": 2,
    "mid_left_far": 2,    "mid_right_far": 2,   "mid_top": 2,
    "left_corner_3": 3,   "right_corner_3": 3,
    "left_wing_3": 3,     "right_wing_3": 3,    "top_key_3": 3,
}

_2PT_ZONES = {"restricted_area", "mid_left_close", "mid_right_close",
              "mid_left_far", "mid_right_far", "mid_top"}
_3PT_ZONES = {"left_corner_3", "right_corner_3", "left_wing_3",
              "right_wing_3", "top_key_3"}

_PAINT_KWORDS = {"layup", "dunk", "alley", "tip", "hook", "putback", "driving", "fingerroll"}


# ── Classification ─────────────────────────────────────────────────────────

def classify_zone(action_type: str, sub_type: str, court_x: float = 0,
                  court_y: float = 0, qualifiers=None) -> str:
    """Classify a shot into one of 11 zones.

    Coordinate system (FIBA LiveStats normalized):
      x: 0–100, center=50, left<50
      y: 0–100, baseline=0, increases away from basket

    Zone geometry matches SVG rendering:
      restricted_area  = full paint box (x 34–66)
      mid_left_close   = outside paint left, near baseline (x<34, y<25)
      mid_right_close  = outside paint right, near baseline (x>66, y<25)
      mid_left_far     = left elbow / wing mid (x<42, y>=25)
      mid_right_far    = right elbow (x>=58, y>=25)
      mid_top          = high post center (x 42–58, y>=25)
    """
    sub       = (sub_type or "").lower()
    has_coord = court_x != 0 or court_y != 0

    if action_type == "3pt":
        if has_coord and court_y < 14:
            return "left_corner_3" if court_x < 50 else "right_corner_3"
        if not has_coord:
            return "top_key_3"
        if court_x < 38:
            return "left_wing_3"
        if court_x >= 62:
            return "right_wing_3"
        return "top_key_3"

    # 2pt — paint keywords always -> restricted area
    paint_sub = any(k in sub for k in _PAINT_KWORDS)
    if paint_sub:
        return "restricted_area"

    if has_coord:
        if 34 <= court_x <= 66:
            return "restricted_area"
        if court_y < 25:
            return "mid_left_close" if court_x < 50 else "mid_right_close"
        if court_x < 42:
            return "mid_left_far"
        if court_x >= 58:
            return "mid_right_far"
        return "mid_top"

    return "mid_top"


def to_half_court(court_x, court_y):
    """Convert full-court coordinates to half-court. Identity until F-11 integration."""
    return court_x, court_y


# ── Zone table ─────────────────────────────────────────────────────────────

def zone_table(shots, *, context_totals=None):
    """Classify shots into 11 zones and compute per-zone and summary stats.

    `shots` can be ORM Shot rows or dicts with action_type, sub_type, x, y, made.
    Returns (zones, total_fga, total_pts, fgm2, fgm3, has_coordinates).
    Each zone dict has: made, attempts, fg_pct, efg_pct, ppt, share.
    """
    def _get(row, attr, default=0):
        if isinstance(row, dict):
            return row.get(attr, default)
        return getattr(row, attr, default)

    has_coordinates = any(
        (_get(row, "x", 0) or 0) != 0 or (_get(row, "y", 0) or 0) != 0
        for row in shots
    )
    zones = {k: {"made": 0, "attempts": 0} for k in ZONE_KEYS_11}
    for row in shots:
        z = classify_zone(
            _get(row, "action_type", ""),
            _get(row, "sub_type", ""),
            _get(row, "x", 0) or 0,
            _get(row, "y", 0) or 0,
        )
        zones[z]["attempts"] += 1
        zones[z]["made"]     += _get(row, "made", 0)

    total_fga = sum(z["attempts"] for z in zones.values())
    total_pts = sum(zones[k]["made"] * ZONE_POINTS[k] for k in ZONE_KEYS_11)
    fgm2 = sum(zones[k]["made"] for k in _2PT_ZONES)
    fgm3 = sum(zones[k]["made"] for k in _3PT_ZONES)

    for k, z in zones.items():
        if z["attempts"]:
            z["fg_pct"] = round(z["made"] / z["attempts"], 4)
            # PPT = zone points / zone attempts
            z["ppt"] = round(z["made"] * ZONE_POINTS[k] / z["attempts"], 3)
            # eFG% per zone: factor 1.0 for 2pt zones, 1.5 for 3pt zones
            factor = 1.5 if ZONE_POINTS[k] == 3 else 1.0
            z["efg_pct"] = round(z["made"] * factor / z["attempts"], 4)
        else:
            z["fg_pct"] = None
            z["ppt"] = None
            z["efg_pct"] = None
        # Share: zone attempts / total FGA
        z["share"] = round(z["attempts"] / total_fga, 4) if total_fga else 0.0

    return zones, total_fga, total_pts, fgm2, fgm3, has_coordinates


# ── Percentile-enriched zone data (C-03) ───────────────────────────────────

def _shots_for_team(team_code, comp_id, last):
    """Query shots for a team, filtered by competition and last N games."""
    q = Shot.query.join(Game, Shot.game_id == Game.game_id)
    q = competitions.visible(q, Shot)
    if comp_id is not None:
        q = q.filter(Game.competition_id == comp_id)
    if last:
        # Get the last N distinct game_ids for this team, ordered by date
        sub = (db.session.query(Game.game_id)
               .join(Shot, Shot.game_id == Game.game_id)
               .filter(Shot.team_code == team_code))
        sub = competitions.visible(sub, Shot)
        if comp_id is not None:
            sub = sub.filter(Game.competition_id == comp_id)
        sub = sub.distinct().order_by(Game.date.desc()).limit(last)
        game_ids = [gid for (gid,) in sub.all()]
        q = q.filter(Shot.game_id.in_(game_ids))
    q = q.filter(Shot.team_code == team_code)
    return q.all()


def _shots_for_player(player_id, comp_id, last):
    """Query shots for a player (by player_id -> all name aliases), filtered by competition and last N."""
    names = identity.aliases(player_id)
    if not names:
        return []
    # Determine team_code from Player record
    from database import Player
    player = db.session.get(Player, player_id)
    if not player:
        return []
    team_code = player.team_code

    q = Shot.query.join(Game, Shot.game_id == Game.game_id)
    q = competitions.visible(q, Shot)
    q = q.filter(Shot.team_code == team_code, Shot.player_name.in_(names))
    if comp_id is not None:
        q = q.filter(Game.competition_id == comp_id)
    if last:
        sub = (db.session.query(Game.game_id)
               .join(Shot, Shot.game_id == Game.game_id)
               .filter(Shot.team_code == team_code, Shot.player_name.in_(names)))
        sub = competitions.visible(sub, Shot)
        if comp_id is not None:
            sub = sub.filter(Game.competition_id == comp_id)
        sub = sub.distinct().order_by(Game.date.desc()).limit(last)
        game_ids = [gid for (gid,) in sub.all()]
        q = q.filter(Shot.game_id.in_(game_ids))
    return q.all()


def _ppt_per_zone_for_entity(entity_type, entity_id, comp_id, last):
    """Compute zone table for an entity, return {zone_key: ppt} for zones with attempts."""
    if entity_type == "team":
        shots = _shots_for_team(entity_id, comp_id, last)
    else:
        shots = _shots_for_player(entity_id, comp_id, last)
    zones, *_ = zone_table(shots)
    return {k: z["ppt"] for k, z in zones.items() if z["attempts"] > 0}


def _other_team_codes(exclude_code, comp_id):
    """All distinct team_codes with shots in a competition, excluding one."""
    q = (db.session.query(Shot.team_code)
         .join(Game, Shot.game_id == Game.game_id)
         .filter(Game.competition_id == comp_id, Shot.team_code != exclude_code))
    q = competitions.visible(q, Shot)
    return [tc for (tc,) in q.distinct().all()]


def _other_player_ids(exclude_pid, comp_id):
    """All distinct player_ids with minutes > 0 in a competition, excluding one."""
    q = (db.session.query(PlayerGameStats.player_id)
         .join(Game, PlayerGameStats.game_id == Game.game_id)
         .filter(Game.competition_id == comp_id,
                 PlayerGameStats.player_id.isnot(None),
                 PlayerGameStats.player_id != exclude_pid))
    q = competitions.visible(q, PlayerGameStats)
    # Only players who actually played (minutes > 0)
    results = q.distinct().all()
    pids = []
    for (pid,) in results:
        # Check if this player has any game with minutes played
        has_minutes = (PlayerGameStats.query
                       .join(Game, PlayerGameStats.game_id == Game.game_id)
                       .filter(PlayerGameStats.player_id == pid,
                               Game.competition_id == comp_id)
                       .all())
        if any(played(r.minutes) for r in has_minutes):
            pids.append(pid)
    return pids


def zones_with_stats(entity_type, entity_id, comp_id, last, shots_query_fn):
    """Build enriched zone data with PPT percentile and sample badge.

    Parameters
    ----------
    entity_type : str
        "team" or "player"
    entity_id : str or int
        Team code (str) or player_id (int)
    comp_id : int or None
        Competition id for percentile universe. None = no percentile.
    last : int or None
        Last N games filter
    shots_query_fn : callable
        Function(entity_id, comp_id, last) -> list of Shot rows
    """
    shots = shots_query_fn(entity_id, comp_id, last)
    zones, total_fga, total_pts, fgm2, fgm3, has_coordinates = zone_table(shots)

    # Count distinct games
    game_ids = {_get_game_id(s) for s in shots}
    games_count = len(game_ids)

    # Determine if we can compute percentiles
    can_percentile = comp_id is not None
    pop_reason = None
    others_ppt = {}  # {zone_key: [ppt values from other entities]}

    if can_percentile:
        # Gather PPT values from other entities of same type
        if entity_type == "team":
            other_ids = _other_team_codes(entity_id, comp_id)
        else:
            other_ids = _other_player_ids(entity_id, comp_id)

        min_pop = config.get("population.min_size")
        if len(other_ids) < min_pop:
            can_percentile = False
            pop_reason = "poblacion_insuficiente"
        else:
            # For each zone, collect PPT from all other entities
            for zone_key in ZONE_KEYS_11:
                others_ppt[zone_key] = []
            for oid in other_ids:
                other_zones = _ppt_per_zone_for_entity(entity_type, oid, comp_id, None)
                for zone_key, ppt_val in other_zones.items():
                    if ppt_val is not None:
                        others_ppt[zone_key].append(ppt_val)
    else:
        pop_reason = "sin_universo"

    # Enrich each zone with percentile and sample
    for zone_key, z in zones.items():
        if z["attempts"] == 0:
            z["percentile"] = None
            z["percentile_reason"] = "sin_intentos" if can_percentile else pop_reason
            z["sample"] = sample_mod.sample_level(
                "zone", n=0, unit="intentos"
            )
        elif not can_percentile:
            z["percentile"] = None
            z["percentile_reason"] = pop_reason
            z["sample"] = sample_mod.sample_level(
                "zone", n=z["attempts"], unit="intentos"
            )
        else:
            my_ppt = z["ppt"]
            zone_others = others_ppt.get(zone_key, [])
            z["percentile"] = population_mod.percentile(my_ppt, zone_others, "higher")
            z["percentile_reason"] = None
            z["sample"] = sample_mod.sample_level(
                "zone", n=z["attempts"], unit="intentos"
            )

    # Build summary
    summary = {
        "ppt": round(total_pts / total_fga, 3) if total_fga else None,
        "efg_pct": round((fgm2 + 1.5 * fgm3) / total_fga, 4) if total_fga else None,
        "ppp": None,  # Could be enriched later
        "games": games_count,
        "total_shots": total_fga,
    }

    return {
        "zones": zones,
        "summary": summary,
        "has_coordinates": has_coordinates,
    }


def _get_game_id(shot):
    """Get game_id from a Shot (ORM row or dict)."""
    if isinstance(shot, dict):
        return shot.get("game_id")
    return shot.game_id
