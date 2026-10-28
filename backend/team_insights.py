"""Análisis automático del equipo: fortalezas y debilidades contra su competencia.

Misma idea que "Ventajas y amenazas" de Preparar (F-03), pero para UN equipo: cada métrica se compara con el
resto de los equipos de la competencia (percentil orientado: alto = mejor) y las que quedan en los extremos se
traducen a una frase. Son reglas fijas sobre percentiles, no un modelo: el texto dice qué mide cada una y la
muestra baja se advierte en vez de ocultarse.
"""
import cache
import config
import metrics_catalog
import population
import repository
from context import Context

# (clave, fortaleza, debilidad). El texto describe lo que significa estar arriba / abajo de la liga.
RULES = (
    ("oer", "Ataque eficiente: anota muchos puntos por posesión.", "Ataque poco eficiente: anota pocos puntos por posesión."),
    ("der", "Defensa sólida: concede pocos puntos por posesión.", "Defensa permeable: concede muchos puntos por posesión."),
    ("net_rating", "Gana las posesiones por margen: balance neto alto.", "Pierde las posesiones por margen: balance neto bajo."),
    ("efg_pct", "Tira bien: eFG% alto.", "Tira mal: eFG% bajo, cuesta convertir los tiros de campo."),
    ("fg3_pct", "Acierto alto desde el triple.", "Acierto bajo desde el triple."),
    ("ft_pct", "Buen porcentaje de tiros libres.", "Porcentaje bajo de tiros libres."),
    ("ft_rate", "Llega seguido a la línea de tiros libres.", "Llega poco a la línea de tiros libres."),
    ("to_pct", "Cuida la pelota: pocas pérdidas por posesión.", "Pierde muchos balones por posesión."),
    ("ast_to", "Buena circulación: muchas asistencias por pérdida.", "Circulación pobre: pocas asistencias por pérdida."),
    ("or_pct", "Domina el rebote ofensivo: genera segundas oportunidades.", "Rebote ofensivo débil: pocas segundas oportunidades."),
    ("dr_pct", "Cierra bien el rebote defensivo.", "Concede demasiados rebotes ofensivos al rival."),
    ("opp_efg_pct", "Defiende el tiro: el rival anota con eFG% bajo.", "Defiende mal el tiro: el rival anota con eFG% alto."),
    ("opp_to_pct", "Presiona: fuerza muchas pérdidas del rival.", "Presiona poco: fuerza pocas pérdidas del rival."),
    ("opp_ft_rate", "Defiende sin hacer faltas: el rival llega poco a la línea.", "Concede muchos tiros libres al rival."),
    ("stl", "Roba muchas pelotas por partido.", "Roba pocas pelotas por partido."),
    ("paint_pts", "Produce mucho en la pintura.", "Produce poco en la pintura."),
    ("fast_break_pts", "Corre bien la cancha: muchos puntos de contraataque.", "Casi no corre: pocos puntos de contraataque."),
    ("second_chance_pts", "Aprovecha los rebotes ofensivos: muchos puntos de segunda oportunidad.",
     "Aprovecha poco los rebotes ofensivos."),
    ("bench_pts", "Banca productiva.", "Banca poco productiva."),
)
STRONG, WEAK = 70, 30        # percentil desde el cual es fortaleza / debilidad
ITEMS = 5                    # máximo de frases por lado


def _pct(pop, team_code, key):
    me = pop.get(team_code)
    mdef = metrics_catalog.METRICS.get(key)
    if me is None or mdef is None or mdef.direction == "neutral":
        return None, None
    v = me.values.get(key)
    if v is None:
        return None, None
    others = [m.values.get(key) for m in pop.members if str(m.id) != str(team_code)]
    return v, population.percentile(v, others, mdef.direction)


def _build(team_code: str, comp_id: int, last: int | None) -> dict:
    ctx = Context(competition_id=comp_id, competition_all=False, last=last)
    pop = population.population("team", comp_id, ctx, apply_thresholds=False)
    items = []
    for key, strong_text, weak_text in RULES:
        value, pct = _pct(pop, team_code, key)
        if pct is None:
            continue
        mdef = metrics_catalog.METRICS[key]
        items.append({"metric": key, "label": mdef.label, "fmt": mdef.fmt, "value": value, "percentile": pct,
                      "text": strong_text if pct >= 50 else weak_text})
    strengths = sorted((i for i in items if i["percentile"] >= STRONG), key=lambda i: -i["percentile"])[:ITEMS]
    weaknesses = sorted((i for i in items if i["percentile"] <= WEAK), key=lambda i: i["percentile"])[:ITEMS]
    me = pop.get(team_code)
    games = (me.games if me else 0) or 0
    return {"strengths": strengths, "weaknesses": weaknesses, "teams": pop.size,
            "games": games, "low_sample": games < config.get("sample.team.min"),
            "evaluated": len(items)}


def team_insights(team_code: str, comp_id: int, *, last: int | None = None) -> dict:
    rows = repository.team_game_rows(comp_id)
    if not any(r["team_code"] == team_code for r in rows.values()):
        return {"strengths": [], "weaknesses": [], "teams": 0, "games": 0, "low_sample": True, "evaluated": 0}
    return cache.memo("team_insights", (team_code, comp_id, last), lambda: _build(team_code, comp_id, last))
