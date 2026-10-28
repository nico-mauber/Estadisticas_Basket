"""
Caché entre peticiones por versión de datos y de configuración (T-01, Arq. §3.14).

A diferencia de `repository.memo` (memo por petición vía `flask.g`), este módulo mantiene un
LRU en memoria del proceso cuyas claves van prefijadas por `(data_version, config_version)`,
dos contadores persistidos en la tabla `app_meta`. Al subir cualquiera de las dos versiones
(una escritura de datos o un cambio de configuración), las entradas viejas quedan
inaccesibles (su prefijo ya no coincide) y el LRU las descarta por antigüedad.

Firma de la arquitectura §3.14: `get_versions`, `bump_data_version`, `bump_config_version`,
`memo`, `clear`. Sin dependencias nuevas; Python puro (`OrderedDict` como LRU).
"""
import logging
from collections import OrderedDict
from threading import RLock

log = logging.getLogger(__name__)

MAX_PER_NAMESPACE = 256
# Namespaces con UNA entrada por partido: con el límite general una competencia de más de 128 partidos
# (cada partido ocupa 2 entradas en `poss:game`) expulsa entradas todo el tiempo y cada petición vuelve a
# reconstruir las posesiones de toda la liga (se ve como "No se pudo cargar" por tiempo). Los límites
# cubren una temporada de varias competencias; el costo es memoria (~0,7 MB por partido de posesiones).
NAMESPACE_LIMITS = {"poss:game": 4000, "matchups:game_segs": 1500, "game": 1500, "momentum": 1500,
                    "tables:gamepop": 1500, "assists:game": 4000, "shots:zone_counts": 4000}

_DATA_KEY = "data_version"
_CONFIG_KEY = "config_version"

# {namespace: OrderedDict[(version_prefix, key) -> value]}  (LRU por namespace)
_store: dict[str, "OrderedDict"] = {}
_lock = RLock()


# ── Versiones persistidas en app_meta ────────────────────────────────────────

def _read_meta(key: str) -> int:
    """Lee un contador de `app_meta`, sembrándolo en 1 si falta. Fuera de un contexto de
    aplicación (scripts ad hoc sin DB) devuelve 1 sin tocar la base."""
    from database import db
    from flask import has_app_context
    if not has_app_context():
        return 1
    try:
        row = db.session.execute(
            db.text("SELECT value FROM app_meta WHERE key = :k"), {"k": key}).fetchone()
        if row is None:
            db.session.execute(
                db.text("INSERT INTO app_meta (key, value) VALUES (:k, :v)"), {"k": key, "v": "1"})
            db.session.commit()
            return 1
        return int(row[0])
    except Exception:
        log.exception("cache._read_meta(%s) falló; se asume versión 1", key)
        return 1


_data_bump_hooks: list = []


def on_data_bump(fn) -> None:
    """`fn()` se llama después de subir `data_version` (el calentamiento del caché se vuelve a lanzar)."""
    if fn not in _data_bump_hooks:
        _data_bump_hooks.append(fn)


def _bump(key: str, reason: str) -> int:
    from database import db
    from flask import has_app_context
    if not has_app_context():
        return 1
    current = _read_meta(key)
    new = current + 1
    db.session.execute(
        db.text("UPDATE app_meta SET value = :v WHERE key = :k"), {"k": key, "v": str(new)})
    db.session.commit()
    try:
        from flask import g, has_app_context
        if has_app_context():
            g.pop("_cache_versions", None)
    except Exception:
        pass
    log.info("cache.%s %d -> %d (%s)", key, current, new, reason)
    if key == _DATA_KEY:
        for hook in _data_bump_hooks:
            try:
                hook()
            except Exception:
                log.exception("hook de data_version falló")
    return new


def get_versions() -> dict:
    """`{"data_version": int, "config_version": int}` (Arq. §3.14)."""
    return {"data_version": _read_meta(_DATA_KEY), "config_version": _read_meta(_CONFIG_KEY)}


def bump_data_version(reason: str = "") -> int:
    """Sube `data_version`: invalida toda entrada del caché (sus claves llevan la versión vieja).
    Lo llaman las escrituras de datos (ingesta, borrado, competencias, identidad)."""
    return _bump(_DATA_KEY, reason or "data")


def bump_config_version(reason: str = "") -> int:
    """Sube `config_version`: invalida el caché ante un cambio de configuración (F-13)."""
    return _bump(_CONFIG_KEY, reason or "config")


# ── Memoización entre peticiones ──────────────────────────────────────────────

def _version_prefix() -> tuple:
    """`(data_version, config_version)`. Dentro de una petición se lee UNA vez (`flask.g`): armar una población
    hace miles de `memo` y cada uno hacía dos consultas a `app_meta`. Las escrituras de versión lo invalidan."""
    try:
        from flask import g, has_app_context
        if has_app_context():
            cached = g.get("_cache_versions")
            if cached is not None:
                return cached
            v = get_versions()
            g._cache_versions = (v["data_version"], v["config_version"])
            return g._cache_versions
    except Exception:       # fuera de Flask (scripts): lectura directa
        pass
    v = get_versions()
    return (v["data_version"], v["config_version"])


def memo(namespace: str, key, build_fn):
    """Devuelve el valor memorizado de `(namespace, versión, key)` o lo construye con `build_fn()`.

    La clave efectiva incluye `(data_version, config_version)`: al subir cualquiera, la entrada
    vieja ya no se encuentra. LRU de `MAX_PER_NAMESPACE` por namespace (se descarta la más
    antigua). `key` debe ser hashable (tuplas de ints/strings)."""
    full_key = (_version_prefix(), key)
    with _lock:
        ns = _store.get(namespace)
        if ns is not None and full_key in ns:
            ns.move_to_end(full_key)          # marca como recién usada (LRU)
            return ns[full_key]
    value = build_fn()                        # fuera del lock: no reentrar bajo el candado
    with _lock:
        ns = _store.setdefault(namespace, OrderedDict())
        ns[full_key] = value
        ns.move_to_end(full_key)
        limit = NAMESPACE_LIMITS.get(namespace, MAX_PER_NAMESPACE)
        while len(ns) > limit:
            ns.popitem(last=False)
    return value


def clear(namespace: str | None = None) -> None:
    """Vacía el caché en memoria (todo, o un solo namespace). No toca las versiones."""
    with _lock:
        if namespace is None:
            _store.clear()
        else:
            _store.pop(namespace, None)
