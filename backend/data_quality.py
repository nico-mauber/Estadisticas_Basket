"""
Panel de calidad de datos de una competencia (F-11).

Responde, en una sola consulta, si una competencia está lista para publicarse: qué partidos
están incompletos y por qué. Solo lee; no calcula métricas ni persiste nada.

Cada chequeo devuelve {status: ok|alerta|no_disponible, count, counts_as_incomplete, items}.
Un partido es INCOMPLETO si falla algún chequeo con `counts_as_incomplete` (sin play-by-play,
datos básicos faltantes, pendiente de reproceso, play-by-play que no cuadra con el box,
quintetos inconsistentes). Sin coordenadas, campos nulos y posibles duplicados son avisos.
"""
from collections import defaultdict

import lineups
from database import db, Game, TeamGameStats, PlayerGameStats, Shot, PbpEvent
from ingest import INGEST_VERSION, needs_reprocess
from stats_engine import norm_name

# Campos cuyo nulo se informa (tabla, columna, etiqueta). Un 0 informado por FIBA no es nulo.
NULL_FIELDS = [
    ("games",             "date",              "Fecha del partido"),
    ("player_game_stats", "position",          "Posición del jugador"),
    ("player_game_stats", "plus_minus",        "+/- del jugador"),
    ("team_game_stats",   "paint_pts",         "Puntos en la pintura"),
    ("team_game_stats",   "second_chance_pts", "Puntos de segunda oportunidad"),
    ("team_game_stats",   "pts_from_tov",      "Puntos tras pérdida"),
    ("team_game_stats",   "bench_pts",         "Puntos de la banca"),
    ("team_game_stats",   "fast_break_pts",    "Puntos de contraataque"),
    ("shots",             "court_x",           "Coordenadas de tiro"),
]


def _check(items, incomplete, status_if_items="alerta"):
    return {"status": status_if_items if items else "ok", "count": len(items),
            "counts_as_incomplete": incomplete, "items": items}


def _label(g: Game) -> str:
    return f"{g.home_team or '—'} {g.home_score if g.home_score is not None else '—'} – " \
           f"{g.away_score if g.away_score is not None else '—'} {g.away_team or '—'}"


def report(competition_id: int) -> dict:
    games = Game.query.filter_by(competition_id=competition_id).order_by(Game.date, Game.game_id).all()
    gids = [g.game_id for g in games]
    by_id = {g.game_id: g for g in games}
    item = lambda gid, **extra: {"game_id": gid, "date": by_id[gid].date, "label": _label(by_id[gid]), **extra}

    team_rows = defaultdict(list)
    for r in TeamGameStats.query.filter(TeamGameStats.game_id.in_(gids)).all():
        team_rows[r.game_id].append(r)
    player_rows = defaultdict(list)
    for r in PlayerGameStats.query.filter(PlayerGameStats.game_id.in_(gids)).all():
        player_rows[r.game_id].append(r)
    events = defaultdict(list)
    for e in (PbpEvent.query.filter(PbpEvent.game_id.in_(gids))
              .order_by(PbpEvent.game_id, PbpEvent.action_number).all()):
        events[e.game_id].append({c.name: getattr(e, c.name) for c in e.__table__.columns})
    with_coords = {gid for (gid,) in db.session.query(Shot.game_id)
                   .filter(Shot.game_id.in_(gids), Shot.court_x.isnot(None)).distinct()}

    # ── chequeos por partido ────────────────────────────────────────────────
    no_pbp = [item(gid) for gid in gids if not events[gid]]
    missing = []
    for gid in gids:
        faltan = [txt for cond, txt in ((len(team_rows[gid]) != 2, "los dos equipos"),
                                        (not player_rows[gid], "jugadores"),
                                        (not by_id[gid].date, "fecha")) if cond]
        if faltan:
            missing.append(item(gid, detail="Falta: " + ", ".join(faltan)))
    reprocess = [item(gid) for gid in gids if needs_reprocess(by_id[gid])]
    no_coords = [item(gid) for gid in gids if events[gid] and gid not in with_coords]

    mismatch, lineup_issues = [], []
    for gid in gids:
        evs = events[gid]
        if not evs:
            continue
        for t in team_rows[gid]:
            # play-by-play vs box: puntos, tiros de campo y tiros libres intentados
            pb = lineups._agg(evs, t.team_code)
            diffs = [f"{lbl} box {bv} / pbp {pv}" for lbl, bv, pv in
                     (("PTS", t.pts, pb["pts"]), ("TCi", t.fga, pb["fga"]), ("TLi", t.fta, pb["fta"]))
                     if (bv or 0) != pv]
            if diffs:
                mismatch.append(item(gid, team_code=t.team_code, detail="; ".join(diffs)))
            # quintetos: 5 titulares y tramos que cubren exactamente el partido
            starters = lineups.game_starters(player_rows[gid], t.team_code)
            if not starters:
                lineup_issues.append(item(gid, team_code=t.team_code, detail="Quinteto inicial sin 5 jugadores"))
                continue
            segs = lineups.build_segments(evs, t.team_code, starters)
            secs = round(sum(s["seconds"] for s in segs))
            expected = 60 * (by_id[gid].minutes or 40)
            bad = sum(1 for s in segs if len(s["on_court"]) != 5)
            if secs != expected or bad:
                detail = []
                if secs != expected:
                    detail.append(f"tramos suman {secs} s (esperado {expected} s)")
                if bad:
                    detail.append(f"{bad} tramo(s) sin 5 jugadores en cancha")
                lineup_issues.append(item(gid, team_code=t.team_code, detail="; ".join(detail)))

    checks = {
        "games_without_pbp":       _check(no_pbp, True),
        "games_missing_data":      _check(missing, True),
        "games_needing_reprocess": _check(reprocess, True),
        "pbp_box_mismatch":        _check(mismatch, True),
        "lineup_inconsistencies":  _check(lineup_issues, True),
        "games_without_coords":    _check(no_coords, False),
        "null_fields":             _null_fields(gids),
        "possible_duplicates":     _duplicates(player_rows),
        # INCREMENTO DIFERIDO (→ A-01): requiere el motor de posesiones
        "possession_gaps":         {"status": "no_disponible", "count": None, "counts_as_incomplete": False,
                                    "reason": "requiere_posesiones", "items": []},
    }
    incomplete = sorted({it["game_id"] for c in checks.values() if c["counts_as_incomplete"]
                         for it in c["items"]})
    return {
        "summary": {"games": len(gids), "incomplete_games": len(incomplete), "incomplete_ids": incomplete,
                    "ready_to_publish": bool(gids) and not incomplete, "ingest_version": INGEST_VERSION},
        "checks": checks,
    }


def _null_fields(gids: list[str]) -> dict:
    models = {"games": Game, "team_game_stats": TeamGameStats,
              "player_game_stats": PlayerGameStats, "shots": Shot}
    items = []
    for table, col, lbl in NULL_FIELDS:
        model = models[table]
        column = getattr(model, col)
        base = model.query.filter(model.game_id.in_(gids))
        total = base.count()
        # texto vacío también es "sin dato" (fecha y posición llegan como "" desde FIBA)
        nulls = base.filter(column.is_(None) | (column == "")).count() if col in ("date", "position") \
            else base.filter(column.is_(None)).count()
        if total:
            items.append({"table": table, "field": col, "label": lbl, "nulls": nulls, "total": total,
                          "pct": round(nulls / total, 4)})
    flagged = [it for it in items if it["nulls"]]
    return {"status": "alerta" if flagged else "ok", "count": len(flagged),
            "counts_as_incomplete": False, "items": items}


def _duplicates(player_rows: dict) -> dict:
    """Fichas del mismo equipo cuyo nombre normalizado coincide con grafías distintas
    (C-08): hoy se unifican al leer; el panel las muestra para que se vean."""
    groups = defaultdict(lambda: defaultdict(set))
    for gid, rows in player_rows.items():
        for r in rows:
            groups[(r.team_code, norm_name(r.player_name))][r.player_name].add(gid)
    items = [{"team_code": team, "norm_key": key,
              "variants": [{"player_name": n, "games": len(g)} for n, g in sorted(names.items())]}
             for (team, key), names in sorted(groups.items()) if len(names) > 1]
    return {"status": "alerta" if items else "ok", "count": len(items),
            "counts_as_incomplete": False, "items": items}
