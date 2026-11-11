"""Calendario manual y próximo partido (F-12, Arq. §3.19).

FIBA LiveStats no publica el fixture: un administrador lo carga a mano. Un partido del calendario queda vinculado al
partido importado que coincide en local, visitante y fecha (±1 día); vinculado, deja de ser "próximo".
"""
import re
from datetime import date, datetime, timedelta, timezone

from database import db, Fixture, Game, TeamGameStats

UY_OFFSET = timedelta(hours=-3)            # Uruguay: UTC−3 fijo, sin horario de verano
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
MAX_NOTES = 300


class FixtureError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "parametro_invalido", details: dict | None = None):
        super().__init__(message)
        self.message, self.status, self.code, self.details = message, status, code, details

    def payload(self) -> dict:
        out = {"error": self.message, "code": self.code}
        if self.details:
            out["details"] = self.details
        return out


def today_uy() -> str:
    return (datetime.now(timezone.utc) + UY_OFFSET).date().isoformat()


def parse_day(s) -> date | None:
    try:
        return date.fromisoformat(str(s)) if s else None
    except ValueError:
        return None


def team_names() -> dict:
    """{código: nombre más reciente} de los equipos con algún partido importado."""
    out = {}
    q = (db.session.query(TeamGameStats.team_code, TeamGameStats.team_name, Game.date)
         .join(Game, Game.game_id == TeamGameStats.game_id).order_by(Game.date))
    for code, name, _ in q.all():
        if code:
            out[code] = name or code
    return out


def fixture_dict(f: Fixture, names: dict | None = None, labels: dict | None = None) -> dict:
    names = names if names is not None else team_names()
    if labels is None:
        import competitions
        labels = {k: v["label"] for k, v in competitions.labels().items()}
    return {"id": f.id, "competition_id": f.competition_id, "competition_label": labels.get(f.competition_id),
            "date": f.date, "time": f.time, "home_code": f.home_code, "home_name": names.get(f.home_code, f.home_code),
            "away_code": f.away_code, "away_name": names.get(f.away_code, f.away_code), "game_id": f.game_id,
            "played": f.game_id is not None, "source_url": f.source_url, "notes": f.notes,
            "created_by": f.created_by, "created_at": f.created_at}


def _order_key(f: Fixture):
    return (f.date, f.time or "00:00", f.id)


def list_fixtures(comp_id: int | None = None, team_code: str | None = None, *, date_from: str | None = None) -> list:
    q = Fixture.query
    if comp_id is not None:
        q = q.filter(Fixture.competition_id == comp_id)
    if team_code:
        q = q.filter((Fixture.home_code == team_code) | (Fixture.away_code == team_code))
    if date_from:
        q = q.filter(Fixture.date >= date_from)
    rows = sorted(q.all(), key=_order_key)
    names = team_names()
    import competitions
    labels = {k: v["label"] for k, v in competitions.labels().items()}
    return [fixture_dict(f, names, labels) for f in rows]


def next_fixture(team_code: str, today: str) -> Fixture | None:
    """Primer partido del calendario del equipo con fecha ≥ hoy y sin partido importado vinculado."""
    rows = (Fixture.query.filter((Fixture.home_code == team_code) | (Fixture.away_code == team_code))
            .filter(Fixture.game_id.is_(None)).filter(Fixture.date >= today).all())
    return min(rows, key=_order_key) if rows else None


def has_any() -> bool:
    return db.session.query(Fixture.id).first() is not None


def get_fixture(fixture_id: int) -> Fixture | None:
    return db.session.get(Fixture, fixture_id)


def _validate(data: dict, current: Fixture | None = None) -> dict:
    """Campos normalizados (los ausentes conservan el valor actual al editar)."""
    def pick(k):
        return data[k] if k in data else (getattr(current, k) if current is not None else None)

    d = pick("date")
    if not d or parse_day(d) is None:
        raise FixtureError("Elegí la fecha del partido.", details={"param": "date"})
    t = (pick("time") or "").strip() or None
    if t is not None and not _TIME_RE.match(t):
        raise FixtureError("La hora debe tener el formato HH:MM.", details={"param": "time"})
    home = (pick("home_code") or "").strip().upper()
    away = (pick("away_code") or "").strip().upper()
    if not home or not away or home == away:
        raise FixtureError("Elegí dos equipos distintos.", details={"param": "teams"})
    names = team_names()
    for code in (home, away):
        if code not in names:
            raise FixtureError("Equipo desconocido: importá al menos un partido de ese equipo antes de cargarlo en el calendario.",
                               details={"team": code})
    comp = pick("competition_id")
    if comp in ("", None):
        comp = None
    else:
        try:
            comp = int(comp)
        except (TypeError, ValueError):
            raise FixtureError("La competencia no existe.", code="competencia_inexistente")
        import competitions
        if comp not in competitions.labels():
            raise FixtureError("La competencia no existe.", code="competencia_inexistente")
    url = (pick("source_url") or "").strip() or None
    if url is not None:
        import fiba_fetcher
        try:
            fiba_fetcher._data_url(url)
        except ValueError as e:
            raise FixtureError(str(e), details={"param": "source_url"})
    notes = (pick("notes") or "").strip() or None
    if notes is not None and len(notes) > MAX_NOTES:
        raise FixtureError(f"Las notas pueden tener hasta {MAX_NOTES} caracteres.", details={"param": "notes"})
    out = {"date": parse_day(d).isoformat(), "time": t, "home_code": home, "away_code": away, "competition_id": comp,
           "source_url": url, "notes": notes}
    dup = Fixture.query.filter_by(date=out["date"], home_code=home, away_code=away).first()
    if dup is not None and (current is None or dup.id != current.id):
        raise FixtureError("Ya hay un partido cargado con esa fecha y esos equipos.", 409, "conflicto")
    return out


def create_fixture(data: dict, *, user: str | None) -> dict:
    vals = _validate(data or {})
    f = Fixture(**vals, created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"), created_by=user)
    db.session.add(f)
    db.session.flush()
    _link_existing(f)
    db.session.commit()
    return fixture_dict(f)


def update_fixture(fixture_id: int, data: dict) -> dict:
    f = get_fixture(fixture_id)
    if f is None:
        raise FixtureError("Partido del calendario no encontrado", 404, "no_encontrado")
    vals = _validate(data or {}, f)
    for k, v in vals.items():
        setattr(f, k, v)
    if "game_id" in (data or {}):
        gid = data["game_id"]
        if gid is not None and Game.query.filter_by(game_id=str(gid)).first() is None:
            raise FixtureError("Ese partido importado no existe.", 404, "no_encontrado")
        f.game_id = str(gid) if gid is not None else None
    db.session.commit()
    return fixture_dict(f)


def delete_fixture(fixture_id: int) -> None:
    f = get_fixture(fixture_id)
    if f is None:
        raise FixtureError("Partido del calendario no encontrado", 404, "no_encontrado")
    db.session.delete(f)
    db.session.commit()


def _candidates(home: str, away: str, day: date) -> list:
    lo, hi = (day - timedelta(days=1)).isoformat(), (day + timedelta(days=1)).isoformat()
    return (Fixture.query.filter_by(home_code=home, away_code=away).filter(Fixture.game_id.is_(None))
            .filter(Fixture.date >= lo).filter(Fixture.date <= hi).all())


def link_game_to_fixture(game_id: str) -> int | None:
    """Vincula el partido importado con el del calendario que coincide (local, visitante, fecha ±1 día; el de fecha más
    cercana y, a igualdad, el de menor id). Idempotente. No hace commit (lo hace quien importa)."""
    if Fixture.query.filter_by(game_id=game_id).first() is not None:
        return None
    g = Game.query.filter_by(game_id=game_id).first()
    day = parse_day(g.date) if g else None
    if g is None or day is None or not g.home_code or not g.away_code:
        return None
    cands = _candidates(g.home_code, g.away_code, day)
    if not cands:
        return None
    f = min(cands, key=lambda c: (abs((parse_day(c.date) - day).days), c.id))
    f.game_id = game_id
    return f.id


def _link_existing(f: Fixture) -> None:
    """Un partido cargado en el calendario después de importarlo queda vinculado de entrada."""
    day = parse_day(f.date)
    linked = {x for (x,) in db.session.query(Fixture.game_id).filter(Fixture.game_id.isnot(None)).all()}
    games = [g for g in Game.query.filter_by(home_code=f.home_code, away_code=f.away_code).all()
             if g.game_id not in linked and parse_day(g.date) and abs((parse_day(g.date) - day).days) <= 1]
    if games:
        f.game_id = min(games, key=lambda g: (abs((parse_day(g.date) - day).days), g.game_id)).game_id


def unlink_games(game_ids: list) -> int:
    if not game_ids:
        return 0
    n = 0
    for f in Fixture.query.filter(Fixture.game_id.in_([str(g) for g in game_ids])).all():
        f.game_id = None
        n += 1
    return n
