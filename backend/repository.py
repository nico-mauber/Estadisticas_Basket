"""
Acceso de lectura a los partidos de una competencia (C-02): subconjunto de lo que F-11 difirió.

Carga en bloque (una consulta por tabla por petición, sin N+1) las filas de equipo y de jugador de los
partidos VISIBLES (las competencias en `borrador` quedan fuera, como en toda lectura) y resuelve qué
competencia usa una petición. La memoización vive en `flask.g`: dura una petición, no hay caché
entre peticiones (`cache.py` / `data_version` siguen diferidos).

Lo que sale de acá son dicts planos (nunca filas SQLAlchemy), listos para `stats_engine`.
"""
from flask import g, has_app_context

import competitions
from competitions import CompetitionError
from database import db, Competition, Game, TeamGameStats, PlayerGameStats, PbpEvent

ALL_LABEL = "Todas las competencias"


def memo(key, build):
    """Memo por petición (`flask.g`); fuera de un contexto de aplicación calcula siempre."""
    if not has_app_context():
        return build()
    cache = g.setdefault("_repository_memo", {})
    if key not in cache:
        cache[key] = build()
    return cache[key]


def _row(model, obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in model.__table__.columns}


def _game_fields(game: Game) -> dict:
    return {
        "date": game.date,
        "competition": game.competition,            # texto crudo de FIBA (nunca se edita)
        "competition_id": game.competition_id,
        "game_minutes": game.minutes or 40,         # 40 + 5 × prórrogas (F-11)
        "home_code": game.home_code,
        "away_code": game.away_code,
    }


# ── Competencia de la petición ──────────────────────────────────────────────

def _configured_default() -> int | None:
    """F-13: `ui.default_competition_id` de la configuración."""
    import config
    return config.get("ui.default_competition_id")


def _entity_competition(team_code: str | None, player_id: int | None) -> int | None:
    """Competencia del partido VISIBLE más reciente de la entidad (equipo o ficha de jugador)."""
    if team_code:
        q = (db.session.query(Game.competition_id)
             .join(TeamGameStats, TeamGameStats.game_id == Game.game_id)
             .filter(TeamGameStats.team_code == team_code))
    elif player_id is not None:
        q = (db.session.query(Game.competition_id)
             .join(PlayerGameStats, PlayerGameStats.game_id == Game.game_id)
             .filter(PlayerGameStats.player_id == player_id))
    else:
        return None
    q = competitions.visible(q.filter(Game.competition_id.isnot(None)), Game)
    row = q.order_by(Game.date.desc(), Game.game_id.desc()).first()
    return row[0] if row else None


def _published(comp_id: int | None) -> dict | None:
    """`{id, label}` de una competencia publicada, o None."""
    if comp_id is None:
        return None
    comp = db.session.get(Competition, comp_id)
    if comp is None or comp.status != "publicada":
        return None
    return {"id": comp.id, "label": competitions.label(comp)}


def resolve_competition(param: str | None = None, *, team_code: str | None = None,
                        player_id: int | None = None, include_hidden: bool = False) -> dict:
    """Competencia de una petición → `{"id", "all", "label", "source"}` (arquitectura §3.1, DA-14).

    Orden: parámetro (`<id>`, texto legado de FIBA, o `all`) → competencia del partido más reciente
    de la entidad → configurada (F-13) → la del partido más reciente de la liga → ninguna.
    `all` solo se aplica si se pide. Inexistente o en borrador → `CompetitionError` (400).
    """
    p = str(param or "").strip()
    if p.lower() == "all":
        return {"id": None, "all": True, "label": ALL_LABEL, "source": "param"}
    if p:
        cid = competitions.resolve(p)                  # "La competencia no existe." (400)
        comp = competitions.get(cid)
        if comp.status != "publicada" and not include_hidden:
            raise CompetitionError("La competencia no está publicada.", 400)
        return {"id": cid, "all": False, "label": competitions.label(comp), "source": "param"}

    for source, comp_id in (("entidad", _entity_competition(team_code, player_id)),
                            ("config", _configured_default())):
        found = _published(comp_id)
        if found:
            return {"id": found["id"], "all": False, "label": found["label"], "source": source}
    for c in competitions.list_competitions():         # la del partido más reciente de la liga
        if c["games"]:
            return {"id": c["id"], "all": False, "label": c["label"], "source": "ultima"}
    return {"id": None, "all": False, "label": None, "source": "ninguna"}


# ── Filas por competencia ───────────────────────────────────────────────────

_row_fillers: list = []


def register_row_filler(fn) -> None:
    """`fn(rows)` completa en las filas de equipo campos que la base trae `NULL` (ver `breakdown.py`)."""
    if fn not in _row_fillers:
        _row_fillers.append(fn)


def _all_team_rows() -> dict:
    """{(game_id, team_code): fila} de todos los partidos visibles, en orden cronológico."""
    def build():
        q = (db.session.query(TeamGameStats, Game)
             .join(Game, Game.game_id == TeamGameStats.game_id))
        q = competitions.visible(q, TeamGameStats).order_by(Game.date, Game.game_id, TeamGameStats.id)
        rows, by_game = {}, {}
        for tgs, game in q.all():
            r = {**_row(TeamGameStats, tgs), **_game_fields(game)}
            rows[(r["game_id"], r["team_code"])] = r
            by_game.setdefault(r["game_id"], []).append(r)
        for pair in by_game.values():                   # rival = la otra fila del mismo partido
            for r in pair:
                other = [o for o in pair if o is not r]
                r["opp_code"] = other[0]["team_code"] if len(other) == 1 else None
        for fill in _row_fillers:
            fill(rows)
        return rows
    return memo(("team_rows",), build)


def team_game_rows(comp_id: int | None) -> dict:
    """{(game_id, team_code): fila de team_game_stats + date, competition, competition_id,
    game_minutes, home_code, away_code, opp_code}. `comp_id` None = todas las publicadas."""
    if comp_id is None:
        return _all_team_rows()
    return memo(("team_rows", comp_id), lambda: {
        k: r for k, r in _all_team_rows().items() if r["competition_id"] == comp_id})


def _all_player_rows() -> list:
    def build():
        q = (db.session.query(PlayerGameStats, Game)
             .join(Game, Game.game_id == PlayerGameStats.game_id))
        q = competitions.visible(q, PlayerGameStats).order_by(Game.date, Game.game_id, PlayerGameStats.id)
        return [{**_row(PlayerGameStats, pgs), **_game_fields(game)} for pgs, game in q.all()]
    return memo(("player_rows",), build)


def player_game_rows(comp_id: int | None) -> list:
    """Filas de player_game_stats (incluye los DNP) + date, competition, competition_id,
    game_minutes, en orden (fecha, partido). `comp_id` None = todas las publicadas."""
    rows = _all_player_rows()
    if comp_id is None:
        return rows
    return memo(("player_rows", comp_id), lambda: [r for r in rows if r["competition_id"] == comp_id])


def opponent_row(rows: dict, row: dict) -> dict | None:
    """Fila del rival de `row` en el mismo partido (None si el partido no tiene las dos filas)."""
    code = row.get("opp_code")
    return rows.get((row["game_id"], code)) if code else None


def competition_labels() -> dict:
    """{id: etiqueta} de todas las competencias (para decorar partidos y selectores)."""
    return memo(("labels",), lambda: {cid: v["label"] for cid, v in competitions.labels().items()})


# ── Partidos de una competencia / pbp de un equipo (T-05, envuelve app.py) ──

def competition_games(comp_id: int | None) -> list:
    """Partidos VISIBLES, opcionalmente de una sola competencia (orden cronológico)."""
    q = competitions.visible(Game.query, Game)
    if comp_id is not None:
        q = q.filter(Game.competition_id == comp_id)
    key = ("competition_games",) if comp_id is None else ("competition_games", comp_id)
    return memo(key, lambda: q.order_by(Game.date, Game.game_id).all())


def _team_game_ids(team_code: str, comp_id: int | None = None) -> set[str]:
    """Partidos visibles del equipo, opcionalmente de una sola competencia."""
    q = competitions.visible(TeamGameStats.query.filter_by(team_code=team_code), TeamGameStats)
    if comp_id:
        q = q.filter(TeamGameStats.game_id.in_(
            db.session.query(Game.game_id).filter_by(competition_id=comp_id)))
    return {tr.game_id for tr in q.all()}


def _load_events(game_ids, keep: bool = True) -> dict:
    """`{game_id: [evento, ...]}` ordenados por `action_number`, con UNA consulta de núcleo por tanda: sin
    construir objetos del ORM (era el costo dominante de reconstruir las posesiones de una liga). Memo por
    petición: el mismo partido lo piden la vista de cada equipo y el motor de posesiones. `keep=False` no guarda
    los eventos (cálculos que recorren todos los partidos y solo conservan un resumen)."""
    store = memo(("pbp_events_by_game",), dict) if keep else {}
    missing = [gid for gid in game_ids if gid not in store]
    if missing:
        t = PbpEvent.__table__
        for i in range(0, len(missing), 400):
            chunk = missing[i:i + 400]
            for gid in chunk:
                store[gid] = []
            q = db.select(t).where(t.c.game_id.in_(chunk)).order_by(t.c.game_id, t.c.action_number)
            for row in db.session.execute(q).mappings():
                store[row["game_id"]].append(dict(row))
    return {gid: store[gid] for gid in game_ids}


def game_pbp_data(game_id: str) -> dict | None:
    """Eventos + info de un partido para possessions.py.

    Returns {game_id, events, player_rows, home_code, away_code} or None."""
    def build():
        g = Game.query.filter_by(game_id=game_id).first()
        if not g:
            return None
        events = _load_events([game_id])[game_id]
        if not events:
            return None
        player_rows = PlayerGameStats.query.filter_by(game_id=game_id).all()
        return {
            "game_id":     game_id,
            "events":      events,
            "player_rows": player_rows,
            "home_code":   g.home_code,
            "away_code":   g.away_code,
            "info":        {"date": g.date, "competition_id": g.competition_id},
        }
    return memo(("game_pbp_data", game_id), build)


def team_pbp_games(team_code: str, comp_id: int | None = None) -> list[dict]:
    """Partidos del equipo con pbp: [{game_id, events, player_rows, opp_code, info}, ...].

    Misma lógica que `app._team_pbp_games` (Feature 03/04/05): base compartida por
    quintetos, ON/OFF y cierres; ahora también por los cargadores de T-05 (`bundles.py`).
    """
    def build():
        games = []
        ids = sorted(_team_game_ids(team_code, comp_id))
        if not ids:
            return games
        events_by_game = _load_events(ids)
        game_rows = {g.game_id: g for g in Game.query.filter(Game.game_id.in_(ids)).all()}
        players_by_game: dict = {}
        for i in range(0, len(ids), 400):
            for pr in PlayerGameStats.query.filter(PlayerGameStats.game_id.in_(ids[i:i + 400])).all():
                players_by_game.setdefault(pr.game_id, []).append(pr)
        for gid in ids:
            events = events_by_game[gid]
            g = game_rows.get(gid)
            if not events or not g:
                continue
            opp_code = g.away_code if g.home_code == team_code else g.home_code
            if not opp_code:
                continue
            games.append({
                "game_id":     gid,
                "events":      events,
                "player_rows": players_by_game.get(gid, []),
                "opp_code":    opp_code,
                "info":        {"date": g.date, "home_away": "L" if g.home_code == team_code else "V"},
            })
        return games
    return memo(("team_pbp_games", team_code, comp_id), build)
