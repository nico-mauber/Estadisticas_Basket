"""Verificación mecánica de idiomas (F-21, solo desarrollo; no se importa desde la app).

    python backend/tools/i18n_audit.py            # paridad de diccionarios, plantillas y errores del backend
    python backend/tools/i18n_audit.py --merge F  # une los fragmentos F/*.json en frontend/i18n/{en,pt}.json

Un fragmento es `{"texto en español": ["English", "Português"], ...}`. En la clave cada número va como `{#}` y en los valores
como `{1}`, `{2}`… (el orden de aparición en la clave). La auditoría comprueba que cada traducción conserve los mismos
números y marcadores que el texto de origen, que `en.json` y `pt.json` tengan las mismas claves y que las plantillas de frases
tengan los mismos identificadores y marcadores en los tres idiomas.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FE = os.path.join(ROOT, "frontend", "i18n")
PHR = os.path.join(ROOT, "backend", "phrases")


def _load(path):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}


def _holes(key):
    return key.count("{#}")


def _refs(value):
    return sorted(int(x) for x in re.findall(r"\{(\d+)\}", value))


def check_pair(key, value):
    """Errores de una traducción: mismos números (`{#}` ↔ `{n}`) y sin llaves sueltas."""
    errs = []
    n = _holes(key)
    if _refs(value) != sorted(set(_refs(value))) and False:
        errs.append("índices repetidos")
    if sorted(set(_refs(value))) != list(range(1, n + 1)):
        errs.append(f"la clave tiene {n} número(s) y la traducción usa {sorted(set(_refs(value)))}")
    if not value.strip():
        errs.append("traducción vacía")
    if "{#}" in value:
        errs.append("usa {#} en el valor (debe ser {1}, {2}…)")
    return errs


def merge(frag_dir):
    en, pt = _load(os.path.join(FE, "en.json")), _load(os.path.join(FE, "pt.json"))
    bad = 0
    for f in sorted(glob.glob(os.path.join(frag_dir, "*.json"))):
        for k, v in json.load(open(f, encoding="utf-8")).items():
            if not isinstance(v, list) or len(v) != 2:
                print(f"{os.path.basename(f)}: formato inválido: {k!r}"); bad += 1; continue
            for lang, val, dest in (("en", v[0], en), ("pt", v[1], pt)):
                errs = check_pair(k, val)
                if errs:
                    print(f"{os.path.basename(f)} [{lang}] {k!r}: {'; '.join(errs)}"); bad += 1
                else:
                    dest[k] = val
    for name, d in (("en", en), ("pt", pt)):
        open(os.path.join(FE, f"{name}.json"), "w", encoding="utf-8", newline="").write(
            json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=0) + "\n")
    print(f"en: {len(en)} · pt: {len(pt)} · errores: {bad}")
    return bad


def audit():
    bad = 0
    en, pt = _load(os.path.join(FE, "en.json")), _load(os.path.join(FE, "pt.json"))
    if set(en) != set(pt):
        only = sorted(set(en) ^ set(pt))
        print(f"claves distintas entre en.json y pt.json: {len(only)} (ej. {only[:3]})"); bad += 1
    for name, d in (("en", en), ("pt", pt)):
        for k, v in d.items():
            for e in check_pair(k, v):
                print(f"{name}.json {k!r}: {e}"); bad += 1
    # plantillas de frases
    es = _load(os.path.join(PHR, "es.json"))
    base = {t["id"]: sorted(re.findall(r"\{(\w+)\}", t["text"])) for t in es.get("templates", [])}
    for lang in ("en", "pt"):
        d = _load(os.path.join(PHR, f"{lang}.json"))
        got = {t["id"]: sorted(re.findall(r"\{(\w+)\}", t["text"])) for t in d.get("templates", [])}
        if set(got) != set(base):
            print(f"phrases/{lang}.json: identificadores distintos: {sorted(set(got) ^ set(base))[:5]}"); bad += 1
        for i, m in got.items():
            if i in base and m != base[i]:
                print(f"phrases/{lang}.json {i}: marcadores {m} ≠ {base[i]}"); bad += 1
    # errores del backend con código (Arq. §7.8)
    print(f"diccionarios: en {len(en)} · pt {len(pt)} · frases: {len(base)} · problemas: {bad}")
    return bad


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--merge":
        sys.exit(1 if merge(sys.argv[2]) else 0)
    sys.exit(1 if audit() else 0)
