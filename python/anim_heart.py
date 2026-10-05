"""Hjerteslag: et hjerte midt på skjermen med EKG-linje på hver side.

26 unike bilder, 30 plasser (15 s), sømløs løkke med to slag per runde (hvert 13. bilde):
  EKG-utslag glir inn mot hjertet fra begge sider (3 piksler per bilde).
  Når de treffer, slår hjertet: stort - middels - stort - middels - lite ("lub-dub"), med gnister i hjørnene
  og bip fra summeren på de to store utslagene.

Bruk:  python anim_heart.py              laster inn og starter
       python anim_heart.py --one        ett bilde per grafikkside (hvis blokk 4-6 ikke virker)
       python anim_heart.py --nosound    uten bip
       python anim_heart.py --preview    bare forhåndsvisning på PC-en
"""
import sys

import animlib
from gfx import Canvas

FRAMES = 26
BEAT = 13                                   # bilder mellom to slag
BEEPS = (0, 2, 13, 15)                      # store utslag: bip
HOLDS = {0: 2, 2: 2, 13: 2, 15: 2}          # utslagene vises litt lenger -> 30 plasser
SCHEDULE = animlib.schedule_from_holds(FRAMES, HOLDS)

CENTER = 39                                  # hjertets midtkolonne (skjermen er kolonne 0-79, midt mellom 39 og 40)
LEFT_END, RIGHT_START = 34, 44               # EKG-linjene stopper her, symmetrisk om hjertet
SPEED = 3                                    # piksler per bilde

HEART_L = [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."]   # 7 x 7
HEART_M = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]            # 7 x 6
HEART_S = [".#.#.", "#####", "#####", ".###.", "..#.."]                                 # 5 x 5
# y-verdi (0 = øverst, 3 = grunnlinje) per kolonne relativt til R-toppen: P-bølge, Q, R (høy), S (dyp), T-bølge
QRS = {-7: 3, -6: 2, -5: 2, -4: 3, -3: 3, -2: 4, -1: 2, 0: 0, 1: 6, 2: 4, 3: 3, 4: 2, 5: 2, 6: 3, 7: 3}


def pulse_size(k):
    """Hjertets størrelse etter k bilder siden slaget (k = t mod 13)."""
    return {0: HEART_L, 1: HEART_M, 2: HEART_L, 3: HEART_M}.get(k, HEART_S)


def draw_sprite(c, rows, cx, y0):
    x0 = cx - len(rows[0]) // 2
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                c.set(x0 + x, y0 + y)


def wave_columns(xr):
    """Punktene til ett EKG-utslag med R-toppen i kolonne xr (venstre side). Gir {kolonne: [y,...]}."""
    cols = {}
    prev = None
    for dc in sorted(QRS):
        y = QRS[dc]
        lo, hi = (y, y) if prev is None else (min(y, prev), max(y, prev))
        cols[xr + dc] = list(range(lo, hi + 1))
        prev = y
    return cols


def frame(t):
    c = Canvas()
    k = t % BEAT
    size = pulse_size(k)
    draw_sprite(c, size, CENTER, 1 if size is HEART_S else 0)
    if k in (0, 2):                                   # gnister i hjørnene ved de store utslagene
        for x, y in ((CENTER - 5, 0), (CENTER + 5, 0), (CENTER - 5, 6), (CENTER + 5, 6)):
            c.set(x, y)
    # utslaget som er på vei inn: avstand til treff (0..12 bilder)
    xr = None
    for arrival in (0, BEAT):
        dist = (arrival - t) % FRAMES
        if dist <= BEAT - 1:
            xr = LEFT_END - SPEED * dist
    cols = wave_columns(xr) if xr is not None else {}
    for x in range(0, LEFT_END + 1):                  # venstre side
        for y in cols.get(x, [3]):
            c.set(x, y)
    for x in range(0, LEFT_END + 1):                  # høyre side speilet om hjertets midte
        for y in cols.get(x, [3]):
            c.set(2 * CENTER - x, y)
    return c


def build():
    return [frame(t) for t in range(FRAMES)]


if __name__ == "__main__":
    frames = build()
    if "--preview" in sys.argv:
        animlib.render_preview(frames, SCHEDULE, "heart")
    else:
        sound = "--nosound" not in sys.argv
        animlib.load(frames, SCHEDULE,
                     per_gpage=1 if "--one" in sys.argv else 2,
                     page_extra={t: "<BA>" for t in BEEPS} if sound else None)
