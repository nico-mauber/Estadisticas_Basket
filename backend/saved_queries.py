"""Consultas guardadas por usuario (F-10).

Una consulta es un nombre y el diccionario plano de parámetros de una búsqueda (de quintetos o de jugadores): reejecutarla
es volver a pedir esa búsqueda, así que el resultado depende solo de los datos y de la configuración. El servidor anota
en `_saved` las versiones de datos y configuración del momento de guardar para avisar si cambiaron (`stale`).
"""
import json
import re
from datetime import datetime, timezone

import cache
import metrics_catalog
from database import db, SavedQuery

MAX_PER_OWNER = 100
MAX_NAME = 80
MAX_PARAMS_BYTES = 4096
KINDS = ("quintetos", "jugadores")

_CONTEXT_KEYS = {"last", "venue", "opponent", "rest", "quarter", "score", "on", "off", "clock", "clock_start",
                 "origin", "ptype", "chance"}
_BASE_KEYS = {
    "quintetos": {"competition", "team", "include", "exclude", "min_poss", "adjusted", "base", "ui.sort"} | _CONTEXT_KEYS,
    "jugadores": {"competition", "name", "team", "position", "ui.sort"},
}
_RANGE_RE = re.compile(r"^(min|max)\.[a-z0-9_]{1,40}$")


class SavedQueryError(Exception):
    def __init__(self, status: int, message: str, code: str = "parametro_invalido"):
        super().__init__(message)
        self.status, self.message, self.code = status, message, code

    def payload(self) -> dict:
        return {"error": self.message, "code": self.code}


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def validate_params(kind: str, params) -> dict:
    """Normaliza a `{str: str}` y rechaza claves desconocidas (`_saved` es del servidor)."""
    if kind not in KINDS:
        raise SavedQueryError(400, "Tipo de consulta inválido.")
    if not isinstance(params, dict):
        raise SavedQueryError(400, "La consulta tiene parámetros inválidos: params.")
    out = {}
    for k, v in params.items():
        if k == "_saved":
            continue
        if isinstance(v, (dict, list)) or v is None:
            raise SavedQueryError(400, f"La consulta tiene parámetros inválidos: {k}.")
        ok = k in _BASE_KEYS[kind]
        if not ok and _RANGE_RE.match(k):
            key = k[4:]
            d = metrics_catalog.METRICS.get(key)
            ok = kind == "jugadores" or (d is not None and "lineup" in d.entities)
        if not ok:
            raise SavedQueryError(400, f"La consulta tiene parámetros inválidos: {k}.")
        out[str(k)] = str(v)
    if len(json.dumps(out, ensure_ascii=False).encode("utf-8")) > MAX_PARAMS_BYTES:
        raise SavedQueryError(400, "La consulta es demasiado grande.")
    return out


def is_stale(params: dict) -> bool:
    saved = (params or {}).get("_saved")
    return not isinstance(saved, dict) or saved != cache.get_versions()


def _row(q: SavedQuery) -> dict:
    try:
        params = json.loads(q.params or "{}")
    except ValueError:
        params = {}
    return {"id": q.id, "name": q.name, "kind": q.kind, "params": params, "created_at": q.created_at,
            "updated_at": q.updated_at, "stale": is_stale(params)}


def list_queries(owner: str, kind: str | None = None) -> list:
    q = SavedQuery.query.filter_by(owner=owner)
    if kind:
        if kind not in KINDS:
            raise SavedQueryError(400, "Tipo de consulta inválido.")
        q = q.filter_by(kind=kind)
    return [_row(r) for r in q.order_by(SavedQuery.updated_at.desc(), SavedQuery.id.desc()).all()]


def save_query(owner: str, name, kind: str, params, *, overwrite: bool = False) -> dict:
    name = (name or "").strip() if isinstance(name, str) else ""
    if not name:
        raise SavedQueryError(400, "Poné un nombre a la consulta.")
    if len(name) > MAX_NAME:
        raise SavedQueryError(400, f"El nombre no puede superar los {MAX_NAME} caracteres.")
    clean = validate_params(kind, params)
    clean["_saved"] = cache.get_versions()
    text = json.dumps(clean, ensure_ascii=False, sort_keys=True)
    now = _now()
    existing = SavedQuery.query.filter_by(owner=owner, name=name).first()
    if existing is not None:
        if not overwrite:
            raise SavedQueryError(409, "Ya tenés una consulta con ese nombre.", "conflicto")
        existing.kind, existing.params, existing.updated_at = kind, text, now
        row = existing
    else:
        if SavedQuery.query.filter_by(owner=owner).count() >= MAX_PER_OWNER:
            raise SavedQueryError(400, f"Llegaste al máximo de {MAX_PER_OWNER} consultas guardadas.")
        row = SavedQuery(owner=owner, name=name, kind=kind, params=text, created_at=now, updated_at=now)
        db.session.add(row)
    db.session.commit()
    return _row(row)


def delete_query(owner: str, query_id: int) -> None:
    n = SavedQuery.query.filter_by(id=query_id, owner=owner).delete()
    db.session.commit()
    if not n:
        raise SavedQueryError(404, "Consulta no encontrada.", "no_encontrado")
