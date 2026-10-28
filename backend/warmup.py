"""Calentamiento del caché de posesiones.

Reconstruir las posesiones de una liga entera tarda decenas de segundos y cada petición que necesita una
población (perfil de equipo, plantel, quintetos, Preparar) las pide todas. Si eso ocurre dentro de la primera
petición del usuario, el navegador o el proxy cortan por tiempo y se ve "No se pudo cargar".

`kick()` arranca un hilo (uno solo a la vez) que las calcula de a un partido, el más reciente primero, con un
contexto de aplicación por partido para no retener los eventos. Se dispara al iniciar el servidor y cada vez que
sube `data_version` (ingesta, borrado, fusión de jugadores). Solo corre con `SB_WARMUP=1`: los scripts de prueba y
`python -c "import app"` no lo arrancan.
"""
import logging
import os
import threading
import time

log = logging.getLogger(__name__)

_lock = threading.Lock()
_thread: threading.Thread | None = None
_again = False


def enabled() -> bool:
    return os.environ.get("SB_WARMUP") == "1"


def _run(app) -> None:
    global _thread, _again
    import possessions
    from database import Game
    while True:
        t0 = time.time()
        done = 0
        try:
            with app.app_context():
                ids = [g for (g,) in Game.query.with_entities(Game.game_id).order_by(Game.date.desc()).all()]
            for gid in ids:
                with app.app_context():
                    possessions.game_possessions(gid)
                done += 1
            log.info("warmup: %d partidos en %.1f s", done, time.time() - t0)
        except Exception:
            log.exception("warmup falló tras %d partidos", done)
        with _lock:
            if _again:             # subió la versión de datos mientras corría: una pasada más
                _again = False
                continue
            _thread = None
            return


def kick(app) -> None:
    """Arranca el calentamiento (o pide una pasada más si ya corre)."""
    global _thread, _again
    if not enabled():
        return
    with _lock:
        if _thread is not None and _thread.is_alive():
            _again = True
            return
        _thread = threading.Thread(target=_run, args=(app,), name="warmup", daemon=True)
        _thread.start()
