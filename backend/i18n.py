"""Idioma de los textos que genera el servidor (F-21).

El frontend informa su idioma en cada petición con el encabezado `X-Lang` (es, en o pt); las descargas por enlace directo
pueden usar `?lang=`. Sin ninguno de los dos vale `ui.default_language` de la configuración y, sin eso, español. Aquí vive la
resolución del idioma y el separador decimal por idioma; las frases salen de `phrases/<idioma>.json`.
"""
import logging

LANGS = ("es", "en", "pt")
DEFAULT = "es"
NAMES = {"es": "español rioplatense", "en": "English", "pt": "português do Brasil"}

log = logging.getLogger(__name__)


def valid(lang) -> bool:
    return lang in LANGS


def default_language() -> str:
    try:
        import config
        v = config.get("ui.default_language")
        return v if valid(v) else DEFAULT
    except Exception:
        return DEFAULT


def current_lang() -> str:
    """Idioma de la petición en curso (fuera de una petición, el predeterminado)."""
    try:
        from flask import has_request_context, request
        if has_request_context():
            for raw in (request.headers.get("X-Lang"), request.args.get("lang")):
                if valid(raw):
                    return raw
    except Exception:
        log.exception("No se pudo leer el idioma de la petición")
    return default_language()


def decimal_sep(lang: str | None = None) -> str:
    """Separador decimal: coma en español y portugués, punto en inglés."""
    return "." if (lang or current_lang()) == "en" else ","
