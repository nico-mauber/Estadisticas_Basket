"""Partido en vivo (F-01).

Descarga el JSON de FIBA con caché TTL en memoria, calcula el snapshot reutilizando los mismos
módulos que F-07 (stats_engine, lineups, possessions, bundles), detecta el fin del partido y lo
persiste solo. Sin hilos de fondo ni WebSocket: el cliente hace polling (Arquitectura §3.17).
"""
import logging
import re
import time
import urllib.error
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace

import bundles
import cache
import chains
import config
import context
import fiba_fetcher
import ingest
import lineups
import possessions
import repository
from competitions import CompetitionError
from database import db, Game
from game_analysis import elapsed_secs, period_label, _clock_display
from stats_engine import StatBundle, compute_standard, _parse_minutes, played

log = logging.getLogger(__name__)

TEAM_KEYS = ("oer", "der", "net_rating", "efg_pct", "ts_pct", "ppp", "possessions",
             "to_pct", "or_pct", "ft_rate", "ppt", "pace")
PLAYER_KEYS = ("oer", "ts_pct", "efg_pct", "uso_pct", "plus_minus")
ORIGIN_KEYS = ("second_chance_pts", "fast_break_pts", "pts_from_tov")
CHAIN_KEYS = ("points_created", "points_from_assist", "oreb_points", "steal_points", "turnover_cost")


class LiveFetchError(Exception):
    """FIBA no respondió y no hay snapshot previo para servir como `stale` (502)."""


class LiveNotFound(Exception):
    """El partido no existe en FIBA ni en la base, o todavía no publicó datos (404)."""


# ── Caché TTL en memoria (LRU) ───────────────────────────────────────────────

_MAX_CACHE = 32


@dataclass
class _Entry:
    fetched_at: float
    snapshot: dict
    final: bool = False


_cache: "OrderedDict[str, _Entry]" = OrderedDict()


def _cache_put(game_id: str, entry: _Entry) -> None:
    _cache[game_id] = entry
    _cache.move_to_end(game_id)
    while len(_cache) > _MAX_CACHE:
        _cache.popitem(last=False)


# ── Fuente ───────────────────────────────────────────────────────────────────

def valid_source_url(game_id: str, url: str) -> bool:
    """URL de FIBA LiveStats permitida y del mismo partido."""
    try:
        fiba_fetcher._data_url(url)
        return fiba_fetcher.extract_game_id(url) == game_id
    except ValueError:
        return False


def is_final(raw: dict) -> bool:
    """Evento `game` / `end` en el pbp crudo de FIBA."""
    pbp = raw.get("pbp") or []
    if isinstance(pbp, dict):
        pbp = list(pbp.values())
    for ev in pbp:
        if not isinstance(ev, dict):
            continue
        action = str(ev.get("actionType") or "").lower()
        sub = str(ev.get("subType") or "").lower()
        if action == "game" and sub in ("end", "ended"):
            return True
    return False


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _finished(game_id: str) -> dict:
    return {"status": "finalizado", "stale": False, "fetched_at": _now_iso(),
            "game_id": game_id, "redirect": f"#/partido/{game_id}/analizar"}


def _persisted_final(game_id: str) -> bool:
    """Persistido y cerrado. Un partido importado a mano a mitad de juego (raw sin evento de
    fin) sigue en vivo."""
    if not Game.query.filter_by(game_id=game_id).first():
        return False
    archived = ingest.load_archived(game_id)
    return archived is None or is_final(archived[0])


# ── Snapshot ─────────────────────────────────────────────────────────────────

def live_snapshot(game_id: str, url: str | None = None) -> dict:
    """Snapshot del partido. Cachea por `live.cache_ttl_secs`; al detectar fin, persiste."""
    if not re.fullmatch(r"\d{5,}", str(game_id)):
        raise LiveNotFound(game_id)

    now = time.time()
    cached = _cache.get(game_id)
    if cached and (cached.final or now - cached.fetched_at < config.get("live.cache_ttl_secs")):
        return cached.snapshot

    if cached is None and _persisted_final(game_id):
        snap = _finished(game_id)
        _cache_put(game_id, _Entry(now, snap, final=True))
        return snap

    try:
        raw = fiba_fetcher.fetch_raw_by_id(
            game_id, timeout=config.get("live.fetch_timeout_secs"), fallback=False)
    except (urllib.error.HTTPError, fiba_fetcher.FibaSchemaError) as exc:
        not_found = isinstance(exc, fiba_fetcher.FibaSchemaError) or exc.code in (403, 404)
        if cached is None and not_found:
            raise LiveNotFound(game_id) from exc
        return _stale(game_id, cached, exc)
    except Exception as exc:
        return _stale(game_id, cached, exc)

    if is_final(raw):
        if _persist_final(game_id, raw, url):
            snap = _finished(game_id)
            _cache_put(game_id, _Entry(now, snap, final=True))
            return snap
        snap = _build_snapshot(fiba_fetcher.parse_game(raw, game_id, validate=False), game_id)
        snap["persist_error"] = True
    else:
        snap = _build_snapshot(fiba_fetcher.parse_game(raw, game_id, validate=False), game_id)
    _cache_put(game_id, _Entry(now, snap))
    return snap


def _stale(game_id: str, cached: _Entry | None, exc: Exception) -> dict:
    log.warning("Descarga FIBA falló para %s: %s", game_id, exc)
    if cached is None:
        raise LiveFetchError(game_id) from exc
    return {**cached.snapshot, "stale": True}


def _persist_final(game_id: str, raw: dict, url: str | None) -> bool:
    """Persiste el partido cerrado con la misma ingesta que la importación manual (F-11)."""
    page_url = url or fiba_fetcher.page_url_for(game_id)
    try:
        page_info = fiba_fetcher.fetch_page_info(page_url)
        game = fiba_fetcher.parse_game(raw, game_id, page_info)
        ingest.persist_game(game)
        ingest.archive_raw(game_id, raw, page_info, source_url=page_url)
        db.session.commit()
    except Exception:
        db.session.rollback()
        log.exception("No se pudo persistir el partido finalizado %s", game_id)
        return False
    cache.bump_data_version("live_final")
    log.info("Partido %s finalizado y persistido automáticamente", game_id)
    return True


def _build_snapshot(parsed: dict, game_id: str) -> dict:
    teams_raw = parsed.get("teams") or []
    if len(teams_raw) != 2:
        raise LiveNotFound(game_id)
    home, away = teams_raw
    codes = (home["team_code"], away["team_code"])
    players_raw = parsed.get("players") or []
    events = _sorted_events(parsed.get("pbp") or [])
    has_pbp = bool(events)

    clock = _clock(events)
    game_minutes = _game_minutes(clock, players_raw)

    box = {}
    for row, other in ((home, away), (away, home)):
        own, opp = bundles._raw(row), bundles._raw(other)
        if own.get("pts") is not None and opp.get("pts") is not None:
            own["plus_minus"], opp["plus_minus"] = own["pts"] - opp["pts"], opp["pts"] - own["pts"]
        box[row["team_code"]] = (own, opp)

    teams = {}
    for side, row in (("home", home), ("away", away)):
        own, opp = box[row["team_code"]]
        std = _pick(compute_standard(_team_bundle(row, own, opp, game_minutes)), TEAM_KEYS)
        teams[side] = {"code": row["team_code"], "name": row.get("team_name"),
                       "score": row.get("pts"), "standard": std,
                       "vs_season": _vs_season(row["team_code"], std)}

    rows = [SimpleNamespace(team_code=p.get("team_code"), player_name=p.get("player_name"),
                            starter=p.get("starter")) for p in players_raw]
    starters = {c: lineups.game_starters(rows, c) for c in codes}
    on_court = _on_court(events, codes, starters)

    name_to_key = {(p.get("team_code"), p.get("player_name")): _key(p.get("team_code"), p.get("player_name"))
                   for p in players_raw}
    chain_maps = _chains(game_id, events, rows, codes, parsed.get("shots") or [], name_to_key) if has_pbp else None

    players = {"home": [], "away": []}
    for p in players_raw:
        if not played(p.get("minutes")):
            continue
        side = "home" if p.get("team_code") == codes[0] else "away"
        own_team, opp_team = box[p.get("team_code")]
        key = _key(p.get("team_code"), p.get("player_name"))
        players[side].append(_player_payload(p, key, own_team, opp_team, game_minutes,
                                              key in on_court[side], chain_maps))
    for side in players:
        players[side].sort(key=lambda r: (not r["on_court"], -(r["pts"] or 0)))

    return {
        "status": "en_curso",
        "stale": False,
        "fetched_at": _now_iso(),
        "game_id": game_id,
        "has_pbp": has_pbp,
        "clock": clock,
        "teams": teams,
        "distribution": {"home": _points_distribution(home), "away": _points_distribution(away)},
        "players_on_court": on_court,
        "players": players,
    }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _key(team_code, name) -> str:
    """Los jugadores de un partido en vivo no tienen id en la base: clave `equipo|nombre`."""
    return f"{team_code}|{name}"


def _sorted_events(pbp: list) -> list:
    """FIBA publica el pbp del más nuevo al más viejo: orden por action_number, sin repetidos."""
    seen = {}
    for e in pbp:
        an = e.get("action_number")
        if an is not None and an not in seen:
            seen[an] = e
    return [seen[an] for an in sorted(seen)]


def _clock(events: list) -> dict | None:
    """Último instante jugado según el pbp (máximo tiempo transcurrido)."""
    best, best_el = None, -1
    for e in events:
        el = elapsed_secs(e.get("period") or 1, e.get("period_type") or "REGULAR", e.get("clock_secs"))
        if el is not None and el > best_el:
            best, best_el = e, el
    if best is None:
        return None
    period, ptype = best.get("period") or 1, best.get("period_type") or "REGULAR"
    return {"period": period, "period_type": ptype, "clock_secs": best.get("clock_secs"),
            "elapsed_secs": best_el,
            "label": f"{period_label(period, ptype)} {_clock_display(best.get('clock_secs'))}".strip()}


def _game_minutes(clock: dict | None, players: list) -> float:
    """Minutos transcurridos: reloj del pbp; sin pbp, minutos de los jugadores / 10."""
    if clock and clock["elapsed_secs"]:
        return max(clock["elapsed_secs"] / 60, 1.0)
    total = sum(_parse_minutes(p.get("minutes")) for p in players)
    return max(total / 10, 1.0)


def _team_bundle(row: dict, own: dict, opp: dict, minutes: float) -> StatBundle:
    return StatBundle(
        entity_type="team", entity_id=row["team_code"], name=row.get("team_name") or "",
        own=own, opp=opp, team=None, games=1, minutes=minutes, team_minutes=None,
        seconds=minutes * 60, on_court=None, shots=None,
        possessions_counted=None, null_reasons={},
    )


def _pick(vals: dict, keys) -> dict:
    out = {}
    for k in keys:
        m = vals.get(k) or {}
        out[k] = {"value": m.get("value"), "reason": m.get("reason")}
    return out


def _vs_season(team_code: str, current: dict) -> dict | None:
    """Delta contra el promedio pooled de la temporada del equipo (mismo cálculo que
    `/api/metrics/team`, CA-6). El partido en vivo no está persistido: no entra en el promedio."""
    try:
        ctx = context.parse_context({}, team_code=team_code)
    except (context.ContextError, CompetitionError):
        return None
    if ctx.competition_id is None:
        return None
    bundle = bundles._team_bundle_from_games(team_code, ctx.competition_id, ctx)
    if bundle is None:
        return None
    season = compute_standard(bundle)
    metrics = {}
    for k in TEAM_KEYS:
        avg = (season.get(k) or {}).get("value")
        cur = (current.get(k) or {}).get("value")
        metrics[k] = {"own_avg": avg,
                      "delta": None if avg is None or cur is None else round(cur - avg, 4)}
    return {"competition_id": ctx.competition_id,
            "competition_label": repository.competition_labels().get(ctx.competition_id),
            "games": bundle.games, "metrics": metrics}


def _v(value, reason="no_registrado") -> dict:
    return {"value": value, "reason": None if value is not None else reason}


def _points_distribution(t: dict) -> dict:
    """Por tipo de tiro (excluyentes, suman PTS) y por origen (FIBA, no excluyentes entre sí)."""
    pts = t.get("pts") or 0
    paint = t.get("paint_pts")
    three = (t.get("fgm3") or 0) * 3
    ft = t.get("ftm") or 0
    mid = None if paint is None else max(0, (t.get("fgm2") or 0) * 2 - paint)
    known = sum(v for v in (paint, mid, three, ft) if v is not None)
    return {
        "total": pts,
        "by_shot": {
            "paint_pts": _v(paint), "mid_pts": _v(mid), "three_pts": _v(three), "ft_pts": _v(ft),
            "otros_no_clasificado": _v(max(0, pts - known)),
        },
        "by_origin": {k: _v(t.get(k)) for k in ORIGIN_KEYS},
    }


def _on_court(events: list, codes: tuple, starters: dict) -> dict:
    out = {"home": [], "away": []}
    if not events:
        return out
    segments = lineups.build_segments_both(events, codes, starters)
    if not segments:
        return out
    last = segments[-1]["on_court"]
    for side, code in (("home", codes[0]), ("away", codes[1])):
        names = last.get(code)
        out[side] = sorted(_key(code, n) for n in names) if names else []
    return out


def _chains(game_id, events, rows, codes, shots, name_to_key) -> dict:
    xy = {s.get("action_number"): (s.get("court_x"), s.get("court_y")) for s in shots}
    poss, _, _ = possessions.build_from_events(game_id, events, rows, codes, xy, name_to_key)
    return {
        "assist": chains.assist_points(poss),
        "oreb": chains.oreb_points(poss, events, name_to_key),
        "steal": chains.steal_points(poss, events, name_to_key),
        "turnover": chains.turnover_cost(poss),
    }


def _player_payload(p, key, team, opp, game_minutes, on_court, chain_maps) -> dict:
    mins = _parse_minutes(p.get("minutes"))
    own = bundles._raw(p)
    bundle = StatBundle(
        entity_type="player", entity_id=key, name=p.get("player_name") or "",
        own=own, opp=opp, team=team, games=1, minutes=mins,
        team_minutes=game_minutes * 5, seconds=mins * 60,
        on_court=None, shots=None, possessions_counted=None, null_reasons={},
        derived=bundles.player_derived(team, opp, mins, game_minutes),
    )
    std = _pick(compute_standard(bundle), PLAYER_KEYS)
    if std["plus_minus"]["value"] is None and p.get("plus_minus") is not None:
        std["plus_minus"] = _v(p.get("plus_minus"))

    if chain_maps is None:
        ch = {k: {"value": None, "reason": "sin_pbp"} for k in CHAIN_KEYS}
    else:
        def pts(name):
            return (chain_maps[name].get(key) or {}).get("points", 0)
        ch = {
            "points_created": _v((p.get("pts") or 0) + pts("assist")),
            "points_from_assist": _v(pts("assist")),
            "oreb_points": _v(pts("oreb")),
            "steal_points": _v(pts("steal")),
            "turnover_cost": _v(pts("turnover")),
        }
    return {"player_id": key, "name": p.get("player_name"), "jersey": p.get("jersey"),
            "minutes": round(mins, 1), "pts": p.get("pts"), "on_court": on_court,
            "standard": std, "chains": ch}
