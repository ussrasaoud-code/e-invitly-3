"""
Génère les tiges minimalistes (public/decor/tiges/*.svg pour la frise du
programme v2, en noir : elles servent de masque, colorées par le thème) et
leurs versions illustrées pour la bibliothèque (public/decor/bibliotheque/).
Usage : python3 scripts/decor/generate-vines.py
"""
import math, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "decor")
W, H = 40, 160  # tuile répétée verticalement : le haut et le bas se raccordent

def stem_points(amp, phase=0.0, cx=20, h=H, steps=48, periods=1):
    return [(cx + amp * math.sin(2 * math.pi * periods * t / steps + phase), h * t / steps) for t in range(steps + 1)]

def path_from(points):
    # Courbe lissée (Catmull-Rom → Bézier)
    d = f"M{points[0][0]:.2f} {points[0][1]:.2f}"
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}"
    return d

def x_at(y, amp, phase=0.0, cx=20, h=H, periods=1):
    return cx + amp * math.sin(2 * math.pi * periods * y / h + phase)

# Feuilles dessinées pointe vers +x, base en (0,0)
ALMOND = "M0 0 C4 -4.2 11 -4.6 16 0 C11 4.6 4 4.2 0 0 Z"
WILLOW = "M0 0 C6 -2.6 15 -2.8 22 0 C15 2.8 6 2.6 0 0 Z"
# Feuille en cœur sur un court pédoncule : encoche côté tige, pointe vers l'extérieur
HEART = "M0 0 L3.5 0 M3.5 0 C2.6 -4 6.2 -7.4 9.4 -5.6 C12 -4.2 13.6 -1.8 15.2 0 C13.6 1.8 12 4.2 9.4 5.6 C6.2 7.4 2.6 4 3.5 0 Z"
def round_leaf(r=4.4, stalk=3.5):
    return f"M0 0 L{stalk} 0 M{stalk + r} 0 m{-r} 0 a{r} {r} 0 1 0 {2*r} 0 a{r} {r} 0 1 0 {-2*r} 0"

def leaf(d, x, y, angle, scale=1.0, fill="#000", stroke=None, sw=0.9, fo=None):
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    op = f' fill-opacity="{fo}"' if fo is not None else ""
    return f'<path d="{d}" transform="translate({x:.2f} {y:.2f}) rotate({angle:.1f}) scale({scale})" fill="{fill}"{op}{st}/>'

def tendril(x, y, side, scale=1.0, stroke="#000"):
    s = side
    d = f"M0 0 C{6*s} -2 {10*s} -8 {7*s} -11 C{5*s} -13 {2*s} -11 {3*s} -8.5 C{4*s} -6.5 {6.5*s} -8 {5.5*s} -9.8"
    return f'<path d="{d}" transform="translate({x:.2f} {y:.2f}) scale({scale})" fill="none" stroke="{stroke}" stroke-width="0.9" stroke-linecap="round"/>'

def design(key):
    """Retourne (amplitude, liste d'éléments SVG) pour une tuile."""
    parts = []
    if key == "coeurs":
        amp = 5
        for y, side in [(26, 1), (70, -1), (118, 1), (146, -1)]:
            x = x_at(y, amp)
            parts.append(leaf(HEART, x, y, -35 if side > 0 else -145, 0.95, stroke="#000", sw=0.8, fo=0.35))
    elif key == "saule":
        amp = 3
        for y, side in [(18, 1), (58, -1), (98, 1), (138, -1)]:
            x = x_at(y, amp)
            parts.append(leaf(WILLOW, x, y, -55 if side > 0 else -125, 0.8))
    elif key == "eucalyptus":
        amp = 4
        for y, side in [(22, 1), (62, -1), (102, 1), (142, -1)]:
            x = x_at(y, amp)
            parts.append(leaf(round_leaf(), x, y, -20 if side > 0 else -160, 1.0, stroke="#000", sw=0.8, fo=0.35))
    elif key == "vrille":
        amp = 6
        parts.append(leaf(ALMOND, x_at(30, amp), 30, -35, 0.8))
        parts.append(f'<g>{tendril(x_at(80, amp), 80, -1, 1.1)}</g>')
        parts.append(leaf(ALMOND, x_at(126, amp), 126, -145, 0.8))
    elif key == "brindille":
        amp = 1.6
        for y in (40, 120):
            x = x_at(y, amp)
            parts.append(leaf(ALMOND, x, y, -60, 0.72))
            parts.append(leaf(ALMOND, x, y, -120, 0.72))
    elif key == "pointilles":
        amp = 4
        for y, side in [(20, 1), (60, -1), (100, 1), (140, -1)]:
            x = x_at(y, amp) + side * 5
            parts.append(f'<circle cx="{x:.2f}" cy="{y}" r="1.5" fill="#000"/>')
    return amp, parts

KEYS = {
    "coeurs": "Tige de cœurs",
    "saule": "Tige de saule",
    "eucalyptus": "Tige d'eucalyptus",
    "vrille": "Tige à vrilles",
    "brindille": "Brindille d'olivier",
    "pointilles": "Ligne et points",
}

def tile_svg(key, stroke_w=1.3):
    amp, parts = design(key)
    stem = path_from(stem_points(amp))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
        f'<path d="{stem}" fill="none" stroke="#000" stroke-width="{stroke_w}" stroke-linecap="round"/>'
        + "".join(parts) + "</svg>"
    )

def colored(svg, stem="#6f7f5c", leaf_fill="#8fa178"):
    # Version illustrée : tige vert sauge, feuilles plus claires
    return (svg.replace('stroke="#000"', f'stroke="{stem}"').replace('fill="#000"', f'fill="{leaf_fill}"'))

def long_vine(key, repeats=3):
    amp, _ = design(key)
    inner = tile_svg(key)
    body = inner[inner.index(">") + 1 : inner.rindex("</svg>")]
    groups = "".join(f'<g transform="translate(0 {i * H})">{body}</g>' for i in range(repeats))
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -4 {W + 12} {H * repeats + 8}">{groups}</svg>'

def garland(kind):
    """Guirlande horizontale (comme une frise de feuillage)."""
    w, h = 320, 70
    pts = [(w * t / 64, 35 + 9 * math.sin(2 * math.pi * 2 * t / 64)) for t in range(65)]
    stem = path_from(pts)
    parts = []
    shape = WILLOW if kind == "saule" else HEART
    scale = 1.0 if kind == "saule" else 1.15
    for i, x in enumerate(range(18, w - 10, 26)):
        y = 35 + 9 * math.sin(2 * math.pi * 2 * x / w)
        up = i % 2 == 0
        if kind == "saule":
            parts.append(leaf(shape, x, y, -35 if up else 35, scale))
        else:
            parts.append(leaf(shape, x, y, -60 if up else 60, scale, stroke="#000", sw=0.8, fo=0.35))
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">'
        f'<path d="{stem}" fill="none" stroke="#000" stroke-width="1.3" stroke-linecap="round"/>' + "".join(parts) + "</svg>"
    )
    return svg

os.makedirs(os.path.join(ROOT, "tiges"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "bibliotheque"), exist_ok=True)
for key in KEYS:
    open(os.path.join(ROOT, "tiges", f"{key}.svg"), "w").write(tile_svg(key))
    open(os.path.join(ROOT, "bibliotheque", f"tige-{key}.svg"), "w").write(colored(long_vine(key)))
for kind in ("saule", "coeurs"):
    open(os.path.join(ROOT, "bibliotheque", f"guirlande-{kind}.svg"), "w").write(colored(garland(kind)))
print("ok")
