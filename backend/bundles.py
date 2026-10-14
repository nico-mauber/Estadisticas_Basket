"""
Cargadores de `StatBundle` de equipo y jugador (T-05, Grupo C, PROPUESTA — plan §4.5).

Arma los bundles desde las filas del box (`repository.*`) y registra los cinco tipos de
entidad en `metrics_catalog` (team, player, lineup, onoff, clutch) al importarse. `app.py`
importa este módulo al arrancar para que el registro ocurra.
"""
import clutch
import context
import identity
import lineups
import metrics_catalog
import repository
from database import db, Player
from stats_engine import (RAW_KEYS, StatBundle, played, _parse_minutes, fga, fgm, plays, pos,
                          sum_bundles)

_RAW_SET = set(RAW_KEYS)


def _raw(row: dict) -> dict:
    """Copia las claves de `RAW_KEYS` de una fila de box (NULL → `None`); deriva `fga`/`fgm` y,
    para la fila de equipo, `plus_minus = pts - opp_pts` cuando la fila no lo trae directo
    (las filas de equipo no tienen `plus_minus` propio; se completa afuera con el rival)."""
    out = {}
    for k in _RAW_SET:
        if k in ("plus_minus",):
            continue
        out[k] = row.get(k)
    out["plus_minus"] = row.get("plus_minus")   # jugador: sPlusMinusPoints; equipo: se completa en el llamador
    return out


# ── Equipo ───────────────────────────────────────────────────────────────────

def team_game_bundles(team_code: str, comp_id: int | None, ctx: "context.Context"):
    """`[(dict, StatBundle), ...]` por partido JUGADO del equipo (plan §4.5)."""
    rows = repository.team_game_rows(comp_id)
    own_all = [r for r in rows.values() if r["team_code"] == team_code]
    if not own_all:
        return []
    own_all = [r for r in own_all if r.get("opp_code")]   # sin rival no hay métricas del partido
    sel = context.filter_games(own_all, ctx, team_code)
    games_total = len(context.filter_games(own_all, context.without_last(ctx), team_code))

    out = []
    for row in sel:
        opp_row = repository.opponent_row(rows, row)
        if opp_row is None:
            continue
        own = _raw(row)
        opp = _raw(opp_row)
        own["plus_minus"] = None if own.get("pts") is None or opp.get("pts") is None \
            else own["pts"] - opp["pts"]
        opp["plus_minus"] = None if own.get("pts") is None or opp.get("pts") is None \
            else opp["pts"] - own["pts"]
        minutes = row.get("game_minutes") or 40
        bundle = StatBundle(
            entity_type="team", entity_id=team_code, name=row["team_name"],
            own=own, opp=opp, team=None,
            games=1, minutes=minutes, team_minutes=None, seconds=minutes * 60,
            on_court=None, shots=None, possessions_counted=None,
            null_reasons={},
            meta={"team_code": team_code, "team_name": row["team_name"], "game_ids": [row["game_id"]]},
        )
        info = {
            "game_id": row["game_id"], "date": row.get("date"),
            "opponent_code": opp_row["team_code"], "opponent": opp_row["team_name"],
            "home_away": "L" if row.get("is_home") else "V",
            "team_pts": row.get("pts"), "opp_pts": opp_row.get("pts"), "played": True,
        }
        out.append((info, bundle))

    return out


def _team_bundle_from_games(team_code, comp_id, ctx):
    per_game = team_game_bundles(team_code, comp_id, ctx)
    if not per_game:
        return None
    rows = repository.team_game_rows(comp_id)
    own_all = [r for r in rows.values() if r["team_code"] == team_code]
    games_total = len(context.filter_games(own_all, context.without_last(ctx), team_code))
    bundle = sum_bundles([b for _, b in per_game])
    bundle.meta["games_total"] = games_total
    bundle.meta["games_excluded"] = {}
    return bundle


def team_loader(req: "metrics_catalog.EntityRequest") -> list:
    team_code = str(req.entity_id).upper()
    bundle = _team_bundle_from_games(team_code, req.comp_id, req.ctx)
    return [bundle] if bundle is not None else []


def all_team_bundles(comp_id, ctx):
    """Un bundle (`sum_bundles`) por equipo con partidos en la competencia (T-01)."""
    rows = repository.team_game_rows(comp_id)
    codes = sorted({r["team_code"] for r in rows.values()})
    out = []
    for code in codes:
        b = _team_bundle_from_games(code, comp_id, ctx)
        if b is not None:
            out.append(b)
    return out


# ── Jugador ──────────────────────────────────────────────────────────────────

def player_game_bundles(player_id: int, comp_id: int | None, ctx: "context.Context"):
    """`[(dict, StatBundle | None), ...]` por partido de la ficha (plan §4.5 / T-06).

    Un partido JUGADO trae su `StatBundle`; un DNP (sin minutos) trae `bundle = None` e
    `info["played"] == False` (el game log de jugador lo muestra como fila con métricas
    nulas razón `dnp`; `_player_bundle_from_games` los excluye del total). Los consumidores
    que solo quieren partidos jugados filtran por `bundle is not None`."""
    card = identity.player_card(player_id)
    if card is None:
        return []
    team_code = card["team_code"]
    pid = card["player_id"]

    all_player_rows = [r for r in repository.player_game_rows(comp_id)
                       if identity.canonical_id(r.get("player_id")) == pid]
    if not all_player_rows:
        return []
    sel = context.filter_games(all_player_rows, ctx, team_code)

    team_rows = repository.team_game_rows(comp_id)
    pbp_cache: dict = {}

    def _pbp_games():
        if comp_id not in pbp_cache:
            games = repository.team_pbp_games(team_code, comp_id)
            pbp_cache[comp_id] = {g["game_id"]: g for g in
                                  identity.canonicalize_pbp_games(games, team_code)}
        return pbp_cache[comp_id]

    out = []
    for row in sel:
        team_row = team_rows.get((row["game_id"], team_code))
        if not played(row.get("minutes")):
            # DNP: fila sin bundle (el game log la muestra con razón `dnp`).
            opp_row_dnp = repository.opponent_row(team_rows, team_row) if team_row else None
            info_dnp = {
                "game_id": row["game_id"], "date": row.get("date"),
                "opponent_code": opp_row_dnp["team_code"] if opp_row_dnp else None,
                "opponent": opp_row_dnp["team_name"] if opp_row_dnp else "",
                "home_away": ("L" if team_row.get("is_home") else "V") if team_row else "",
                "team_pts": team_row.get("pts") if team_row else None,
                "opp_pts": opp_row_dnp.get("pts") if opp_row_dnp else None,
                "played": False,
            }
            out.append((info_dnp, None))
            continue
        opp_row = repository.opponent_row(team_rows, team_row) if team_row else None
        if team_row is None or opp_row is None:
            continue

        own = _raw(row)
        team = _raw(team_row)
        opp = _raw(opp_row)
        team["plus_minus"] = None if team.get("pts") is None or opp.get("pts") is None \
            else team["pts"] - opp["pts"]
        opp["plus_minus"] = None if team.get("pts") is None or opp.get("pts") is None \
            else opp["pts"] - team["pts"]

        mp = _parse_minutes(row.get("minutes"))
        gm = row.get("game_minutes") or 40
        w = mp / gm if gm else 0.0

        plays_team, fga2_team, fga3_team, fgm_team = plays(team), team.get("fga2"), team.get("fga3"), fgm(team)
        orb_t, drb_t, orb_o, drb_o = team.get("orb"), team.get("drb"), opp.get("orb"), opp.get("drb")
        derived = {
            "plays_team_w": None if plays_team is None else w * plays_team,
            "t2a_team_w": None if fga2_team is None else w * fga2_team,
            "t3a_team_w": None if fga3_team is None else w * fga3_team,
            "fgm_team_w": None if fgm_team is None else w * fgm_team,
            "orb_pool_w": None if orb_t is None or drb_o is None else w * (orb_t + drb_o),
            "drb_pool_w": None if drb_t is None or orb_o is None else w * (drb_t + orb_o),
            "trb_pool_w": (None if None in (orb_t, drb_t, orb_o, drb_o)
                          else w * (orb_t + drb_t + orb_o + drb_o)),
        }

        pbp_game = _pbp_games().get(row["game_id"])
        display_name = card["display_name"]
        oc = lineups.player_on_court(pbp_game, team_code, display_name) if pbp_game else None
        if oc is None:
            on_court = {
                "games_exact": 0, "games_estimated": 1,
                "poss_estimated": (pos(team) or 0) * w,
                "own": {k: 0 for k in RAW_KEYS}, "opp": {k: 0 for k in RAW_KEYS},
                "seconds": 0,
            }
        else:
            on_court = {
                "games_exact": 1, "games_estimated": 0, "poss_estimated": 0.0,
                "own": oc["own"], "opp": oc["opp"], "seconds": oc["seconds"],
            }

        minutes = mp
        bundle = StatBundle(
            entity_type="player", entity_id=player_id, name=display_name,
            own=own, opp=opp, team=team,
            games=1, minutes=minutes, team_minutes=gm * 5, seconds=minutes * 60,
            on_court=on_court, shots=None, possessions_counted=None,
            null_reasons={}, derived=derived,
            meta={"team_code": team_code, "team_name": row.get("team_name"), "game_ids": [row["game_id"]]},
        )
        info = {
            "game_id": row["game_id"], "date": row.get("date"),
            "opponent_code": opp_row["team_code"], "opponent": opp_row["team_name"],
            "home_away": "L" if team_row.get("is_home") else "V",
            "team_pts": team.get("pts"), "opp_pts": opp.get("pts"), "played": True,
        }
        out.append((info, bundle))

    return out


def _player_bundle_from_games(player_id, comp_id, ctx):
    per_game = [(info, b) for info, b in player_game_bundles(player_id, comp_id, ctx) if b is not None]
    if not per_game:
        return None
    card = identity.player_card(player_id)
    all_rows = [r for r in repository.player_game_rows(comp_id)
               if identity.canonical_id(r.get("player_id")) == card["player_id"]]
    scoped = context.filter_games(all_rows, context.without_last(ctx), card["team_code"])
    games_total = sum(1 for r in scoped if played(r.get("minutes")))
    bundle = sum_bundles([b for _, b in per_game])
    bundle.meta["games_total"] = games_total
    n_dnp = len(scoped) - games_total
    bundle.meta["games_excluded"] = {"dnp": n_dnp} if n_dnp else {}
    return bundle


def player_loader(req: "metrics_catalog.EntityRequest") -> list:
    try:
        pid = int(req.entity_id)
    except (TypeError, ValueError):
        return []
    pid = identity.canonical_id(pid)
    if pid is None:
        return []
    bundle = _player_bundle_from_games(pid, req.comp_id, req.ctx)
    return [bundle] if bundle is not None else []


def all_player_bundles(comp_id, ctx):
    """Un bundle (`sum_bundles`) por ficha de jugador con partidos JUGADOS en la competencia (T-01)."""
    rows = repository.player_game_rows(comp_id)
    pids = sorted({identity.canonical_id(r["player_id"]) for r in rows
                  if r.get("player_id") is not None} - {None})
    out = []
    for pid in pids:
        b = _player_bundle_from_games(pid, comp_id, ctx)
        if b is not None:
            out.append(b)
    return out


# ── Quinteto / ON-OFF / Cierre: wrappers sobre lineups.py y clutch.py ────────

def _filter_pbp_games(games: list[dict], ctx: "context.Context") -> list[dict]:
    """Últimos N partidos (`ctx.last`) de `repository.team_pbp_games` (plan §4.6/§4.7).

    No usa `context.filter_games`: esos dicts no traen `competition_id` (ya lo filtró
    `team_pbp_games(team_code, comp_id)`) ni `date` a nivel raíz (va en `info.date`). Orden
    cronológico ascendente, igual criterio que `filter_games`."""
    out = sorted(games, key=lambda g: (g.get("info", {}).get("date") or "", g.get("game_id") or ""))
    if ctx.last:
        out = out[-ctx.last:]
    return out


def _parse_lineup_id(entity_id: str) -> tuple[str, list[int]]:
    team_code, _, rest = str(entity_id).partition(":")
    pids = [int(p) for p in rest.split("-") if p.strip()]
    return team_code.upper(), pids


def _names_for(team_code: str, pids: list[int]) -> list[str] | None:
    names = []
    for pid in pids:
        p = db.session.get(Player, identity.canonical_id(pid) or pid)
        if p is None:
            return None
        names.append(p.display_name)
    return names


def lineup_loader(req: "metrics_catalog.EntityRequest") -> list:
    team_code, pids = _parse_lineup_id(req.entity_id)
    if not (3 <= len(pids) <= 5):
        return []
    names = _names_for(team_code, pids)
    if names is None:
        return []
    games = repository.team_pbp_games(team_code, req.comp_id)
    games = _filter_pbp_games(games, req.ctx)
    games = identity.canonicalize_pbp_games(games, team_code)
    bundle = lineups.lineup_bundle(games, team_code, names, entity_id=req.entity_id,
                                   name=" · ".join(sorted(names)))
    return [bundle] if bundle is not None else []


def onoff_loader(req: "metrics_catalog.EntityRequest") -> list:
    team_code, pids = _parse_lineup_id(req.entity_id)
    if len(pids) != 1:
        return []
    names = _names_for(team_code, pids)
    if names is None:
        return []
    games = repository.team_pbp_games(team_code, req.comp_id)
    games = _filter_pbp_games(games, req.ctx)
    games = identity.canonicalize_pbp_games(games, team_code)
    result = lineups.onoff_bundles(games, team_code, names[0], entity_id=req.entity_id, name=names[0])
    if result is None:
        return []
    return [result[0], result[1]]


def clutch_loader(req: "metrics_catalog.EntityRequest") -> list:
    team_code = str(req.entity_id).upper()
    games = repository.team_pbp_games(team_code, req.comp_id)
    games = _filter_pbp_games(games, req.ctx)
    games = identity.canonicalize_pbp_games(games, team_code)
    if not games:
        return []
    row = None
    for r in repository.team_game_rows(req.comp_id).values():
        if r["team_code"] == team_code:
            row = r
    team_name = row["team_name"] if row else team_code
    margin = req.params.get("margin")
    window_secs = req.params.get("window_secs")
    bundle = clutch.clutch_bundle(games, team_code, team_name, margin, window_secs)
    return [bundle] if bundle is not None else []


# ── Enumeradores de quinteto / ON-OFF / cierre (T-01 plan §4.2) ──────────────

def _teams_with_pbp(comp_id):
    """Equipos de la competencia con al menos un partido (orden alfabético)."""
    rows = repository.team_game_rows(comp_id)
    return sorted({r["team_code"] for r in rows.values()})


def _pbp_games_for(team_code, comp_id, ctx):
    """Partidos del equipo con pbp, filtrados por contexto (`last`) y canonicalizados (C-08)."""
    games = repository.team_pbp_games(team_code, comp_id)
    games = _filter_pbp_games(games, ctx)
    return identity.canonicalize_pbp_games(games, team_code)


def all_lineup_bundles(comp_id, ctx, size=5):
    """Todos los quintetos (o combinaciones de `size` jugadores) de todos los equipos de la
    competencia (T-01 plan §4.2): `chain(lineups.all_lineups(team, ...))`."""
    size = size or 5
    out = []
    for team_code in _teams_with_pbp(comp_id):
        out.extend(lineups.all_lineups(team_code, comp_id, ctx, size=size))
    return out


def all_onoff_bundles(comp_id, ctx, variant=None):
    """Estados ON de todos los jugadores de todos los equipos (T-01 plan §4.2): por equipo,
    `lineups.all_onoff_bundles(games, team_code)` (una pasada). Cada bundle ON lleva
    `meta["off"]` con su estado OFF."""
    out = []
    for team_code in _teams_with_pbp(comp_id):
        games = _pbp_games_for(team_code, comp_id, ctx)
        out.extend(lineups.all_onoff_bundles(games, team_code))
    return out


def all_clutch_bundles(comp_id, ctx, variant=None):
    """Un bundle de cierre por equipo con partidos calificados (T-01 plan §4.2)."""
    rows = repository.team_game_rows(comp_id)
    team_names = {}
    for r in rows.values():
        team_names[r["team_code"]] = r["team_name"]
    out = []
    for team_code in _teams_with_pbp(comp_id):
        games = _pbp_games_for(team_code, comp_id, ctx)
        if not games:
            continue
        bundle = clutch.clutch_bundle(games, team_code, team_names.get(team_code, team_code))
        if bundle is not None:
            out.append(bundle)
    return out


metrics_catalog.register_entity("team", team_loader, game_loader=team_game_bundles,
                                enumerator=all_team_bundles)
metrics_catalog.register_entity("player", player_loader, game_loader=player_game_bundles,
                                enumerator=all_player_bundles)
metrics_catalog.register_entity("lineup", lineup_loader)
metrics_catalog.register_entity("onoff", onoff_loader)
metrics_catalog.register_entity("clutch", clutch_loader, game_loader=clutch.clutch_game_bundles)

# Enumeradores de los tipos sin enumerador propio en T-05 (T-01 plan §4.2).
metrics_catalog.set_enumerator("lineup", all_lineup_bundles)
metrics_catalog.set_enumerator("onoff", all_onoff_bundles)
metrics_catalog.set_enumerator("clutch", all_clutch_bundles)
