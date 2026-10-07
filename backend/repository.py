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
from database import db, Competition, Game, TeamGameStats, PlayerGameStats

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
    """Hook de F-13: `ui.default_competition_id` de la configuración. Hasta F-13 no hay
    configuración y devuelve None; si el id no existe o no está publicada se ignora."""
    return None


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
