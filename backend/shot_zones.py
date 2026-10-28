"""Shot zone classification, aggregation and percentile enrichment (C-03).

Moved from app.py: zone constants, classification, and zone table builder.
New: `zones_with_stats` adds PPT percentile and sample badge per zone.
"""
import cache
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

# Geometría FIBA en metros: cancha de 28 × 15 m. Las coordenadas de FIBA (`court_x` a lo largo, `court_y` a lo
# ancho, 0–100) abarcan la cancha COMPLETA y los dos equipos tiran a los dos aros (cambian de lado en el
# entretiempo), así que primero se llevan todos los tiros a UNA media cancha (`to_half_court`).
COURT_LEN_M = 28.0
KEY_DEPTH_M = 5.8          # la pintura llega hasta la línea de tiros libres (5,80 m de la línea de fondo)
CORNER_DEPTH_M = 2.99      # hasta ahí llega el tramo recto de la línea de 6,75 m (esquina)
KEY_ACROSS = (33.7, 66.3)  # ancho de la pintura (4,90 m de 15 m) en % del ancho de la cancha


def classify_zone(action_type: str, sub_type: str, across: float = 0,
                  depth: float = 0, qualifiers=None) -> str:
    """Clasifica un tiro en una de las 11 zonas.

    `across` / `depth` salen de `to_half_court`: `across` = posición a lo ancho en % (0–100, centro 50) y
    `depth` = distancia en metros a la línea de fondo del aro al que tira. (0, 0) = sin coordenadas.

      restricted_area  = dentro de la pintura (ancho 33,7–66,3 %, hasta la línea de tiros libres)
      mid_left_close / mid_right_close = fuera de la pintura, antes de la línea de tiros libres
      mid_left_far / mid_right_far     = tiro de media distancia de lado, pasada la línea de tiros libres
      mid_top          = media distancia de frente
      left/right_corner_3 = triple desde la esquina; left/right_wing_3 y top_key_3 = resto de los triples
    """
    sub       = (sub_type or "").lower()
    has_coord = across != 0 or depth != 0

    if action_type == "3pt":
        if not has_coord:
            return "top_key_3"
        if depth < CORNER_DEPTH_M:
            return "left_corner_3" if across < 50 else "right_corner_3"
        if across < 38:
            return "left_wing_3"
        if across >= 62:
            return "right_wing_3"
        return "top_key_3"

    # 2pt — las bandejas, volcadas y similares son siempre del aro
    if any(k in sub for k in _PAINT_KWORDS):
        return "restricted_area"

    if has_coord:
        if depth <= KEY_DEPTH_M:
            if KEY_ACROSS[0] <= across <= KEY_ACROSS[1]:
                return "restricted_area"
            return "mid_left_close" if across < 50 else "mid_right_close"
        if across < 42:
            return "mid_left_far"
        if across >= 58:
            return "mid_right_far"
        return "mid_top"

    return "mid_top"


def to_half_court(court_x, court_y):
    """Coordenadas de FIBA (cancha completa) → `(across_pct, depth_m)` de una media cancha.

    Si el tiro es al aro del otro lado (`court_x` > 50) se gira la cancha 180°. Sin coordenadas → (0, 0)."""
    if court_x is None or court_y is None or (not court_x and not court_y):
        return 0, 0
    if court_x > 50:
        court_x, court_y = 100 - court_x, 100 - court_y
    return court_y, round(court_x / 100 * COURT_LEN_M, 3)


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

    def _xy(row):
        # las filas de la base traen `court_x/court_y` (reales, de FIBA); `x/y` (legado) siguen en 0
        cx, cy = _get(row, "court_x", None), _get(row, "court_y", None)
        if cx is None and cy is None:
            cx, cy = _get(row, "x", 0), _get(row, "y", 0)
        return cx or 0, cy or 0

    has_coordinates = any(_xy(row) != (0, 0) for row in shots)
    zones = {k: {"made": 0, "attempts": 0} for k in ZONE_KEYS_11}
    for row in shots:
        z = classify_zone(
            _get(row, "action_type", ""),
            _get(row, "sub_type", ""),
            *to_half_court(*_xy(row)),
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


_MID_ZONES = frozenset({"mid_left_close", "mid_right_close", "mid_left_far", "mid_right_far", "mid_top"})


def game_zone_counts(game_id) -> dict | None:
    """Tiros de campo de un partido por equipo y jugador: `{(team_code, player_name | None): {paint_fga, mid_fga}}`.

    `paint_fga` = tiros en la pintura (zona `restricted_area`); `mid_fga` = tiros de 2 desde fuera de ella
    (media distancia). `None` si el partido no trae coordenadas reales: sin ellas no se puede decir en qué zona
    cayó cada tiro y el dato queda como no disponible, nunca como 0. Cacheado por versión de datos."""
    def build():
        t = Shot.__table__
        rows = db.session.execute(db.select(t.c.team_code, t.c.player_name, t.c.action_type, t.c.sub_type,
                                            t.c.court_x, t.c.court_y, t.c.made).where(t.c.game_id == game_id)).all()
        if not any((r.court_x or 0) or (r.court_y or 0) for r in rows):
            return None
        out: dict = {}
        for r in rows:
            zone = classify_zone(r.action_type or "", r.sub_type or "", *to_half_court(r.court_x, r.court_y))
            for key in ((r.team_code, None), (r.team_code, r.player_name)):
                d = out.setdefault(key, {"paint_fga": 0, "mid_fga": 0, "paint_pts": 0})
                d["paint_fga"] += 1 if zone == "restricted_area" else 0
                d["mid_fga"] += 1 if zone in _MID_ZONES else 0
                d["paint_pts"] += 2 * (r.made or 0) if zone == "restricted_area" else 0
        return out
    return cache.memo("shots:zone_counts", game_id, build)


def _get_game_id(shot):
    """Get game_id from a Shot (ORM row or dict)."""
    if isinstance(shot, dict):
        return shot.get("game_id")
    return shot.game_id
