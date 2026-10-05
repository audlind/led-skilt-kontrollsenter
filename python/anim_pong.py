"""Pong som spiller mot seg selv i en uendelig løkke, uten vinner. 20 unike bilder, 22 plasser (11 s).

  Ballen (2 x 2 piksler) går 7 piksler per bilde mellom racketene og spretter opp og ned.
  Treff: høyre racket i bilde 5, venstre racket i bilde 15. Treffbildene holdes en ekstra plass,
  og summeren gir et kort bip (<BA>). Racketene følger ballen og begge banene gjentar seg
  nøyaktig etter 20 bilder, så løkken er sømløs.

Bruk:  python anim_pong.py              laster inn og starter
       python anim_pong.py --one        ett bilde per grafikkside (hvis blokk 4-6 ikke virker)
       python anim_pong.py --nosound    uten bip
       python anim_pong.py --preview    bare forhåndsvisning på PC-en
"""
import sys

import animlib
from gfx import Canvas

FRAMES = 20
HITS = (5, 15)                                         # høyre treff, venstre treff
HOLDS = {5: 2, 15: 2}                                  # treffbildene vises litt lenger
SCHEDULE = animlib.schedule_from_holds(FRAMES, HOLDS)  # 22 plasser

LEFT_X, RIGHT_X = 2, 76          # racketer er 2 piksler brede, 2 piksler fra kanten på hver side
X_MIN, X_MAX = 4, 74             # ballen er 2 x 2 og stopper rett ved racketene
VX = 7                           # piksler per bilde: 70 / 7 = 10 bilder per kryssing, 20 per runde


def fold(u, lo, hi):
    """Speil en rett bane inn i intervallet [lo, hi] (ballen spretter)."""
    span = hi - lo
    m = (u - lo) % (2 * span)
    return lo + (m if m <= span else 2 * span - m)


def ball(t):
    """Øvre venstre hjørne av ballen (2 x 2 piksler). Perioden er 20 bilder."""
    return fold(39 + VX * t, X_MIN, X_MAX), fold(2 + t, 0, 5)


def paddles():
    """Racketenes midtpunkt per bilde (1..5), maks 2 piksler bevegelse per bilde.
    Simulerer tre runder og bruker den siste, så bevegelsen gjentar seg sømløst."""
    left, right = 3, 3
    runs = []
    for t in range(3 * FRAMES):
        tt = t % FRAMES
        by = ball(tt)[1]
        heading_right = tt >= 15 or tt < 5 + 1       # fra venstre treff (15) til høyre treff (5)
        heading_left = 5 <= tt < 15
        lt = by + 1 if heading_left else 3
        rt = by + 1 if heading_right else 3
        left = max(1, min(5, left + max(-2, min(2, lt - left))))
        right = max(1, min(5, right + max(-2, min(2, rt - right))))
        runs.append((left, right))
    last, prev = runs[2 * FRAMES:], runs[FRAMES:2 * FRAMES]
    assert last == prev, "racketbevegelsen gjentar seg ikke"
    return [p[0] for p in last], [p[1] for p in last]


LEFT_Y, RIGHT_Y = paddles()


def draw_paddle(c, x, cy):
    for y in range(cy - 1, cy + 2):
        for dx in (0, 1):
            c.set(x + dx, y)


def frame(t):
    c = Canvas()
    draw_paddle(c, LEFT_X, LEFT_Y[t])
    draw_paddle(c, RIGHT_X, RIGHT_Y[t])
    for y in (0, 2, 4, 6):                            # stiplet midtlinje
        c.set(40, y)
    bx, by = ball(t)
    for dx in (0, 1):
        for dy in (0, 1):
            c.set(bx + dx, by + dy)
    return c


def build():
    return [frame(t) for t in range(FRAMES)]


def self_check():
    """Kontroller at racketene treffer ved treffene, og at løkken er sømløs."""
    for t, cy, name in ((5, RIGHT_Y, "høyre"), (15, LEFT_Y, "venstre")):
        bx, by = ball(t)
        assert by <= cy[t] + 1 and by + 1 >= cy[t] - 1, f"{name} racket bommer i bilde {t}"
    assert ball(FRAMES) == ball(0), "ballbanen gjentar seg ikke"
    assert ball(5)[0] == X_MAX and ball(15)[0] == X_MIN, "treffene ligger ikke på banekanten"


self_check()

if __name__ == "__main__":
    frames = build()
    if "--preview" in sys.argv:
        animlib.render_preview(frames, SCHEDULE, "pong")
    else:
        sound = "--nosound" not in sys.argv
        animlib.load(frames, SCHEDULE,
                     per_gpage=1 if "--one" in sys.argv else 2,
                     page_extra={5: "<BA>", 15: "<BA>"} if sound else None)
