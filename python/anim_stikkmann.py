"""Stikkmannen og bananskallet. 26 unike bilder, 31 plasser (15,5 s), ingen lyd.

  bilde 0-11   går inn fra venstre (4 piksler per bilde, ben og armer svinger)
  bilde 12-14  tråkker på bananskallet, flyr i været og lander på ryggen
  bilde 15-19  ligger med stjerner rundt hodet, setter seg opp
  bilde 20-22  står opp og rister på hodet
  bilde 23-25  hopper over skallet og løper ut til høyre

Bruk:  python anim_stikkmann.py              laster inn og starter
       python anim_stikkmann.py --one        ett bilde per grafikkside
       python anim_stikkmann.py --preview    bare forhåndsvisning på PC-en
"""
import math
import sys

import animlib
from gfx import Canvas

FRAMES = 26
HOLDS = {12: 2, 14: 2, 17: 2, 20: 2, 21: 2}           # morsomme øyeblikk vises litt lenger -> 31 plasser
SCHEDULE = animlib.schedule_from_holds(FRAMES, HOLDS)

PEEL_X = 46
PEEL = ["#...#", ".###."]                               # bananskall på bakken (rad 5-6)

# --- figurer (stikkmann vendt mot høyre) ---
WALK_A = [".###.", ".###.", "#.#.#", "..#..", "..#..", ".#.#.", "#..#."]     # skritt, høyre fot frem
WALK_B = [".###.", ".###.", ".#.#.", "..#..", "..#..", "..#..", "..#.."]     # bena sammen
WALK_C = [".###.", ".###.", "#.#.#", "..#..", "..#..", ".#.#.", ".#..#"]     # skritt, venstre fot frem
SLIP = [".###....", ".###....", "#.#.#...", "..#.#...", "...#.#..", "..#...#.", ".#.....#"]   # bena vidt fra hverandre, glir
AIR = ["......#.#", ".....#.#.", "##.####..", "##.#....."]                      # vannrett, bena sparket opp i en V (4 rader)
LYING = ["........#.", "##.....##.", "##.#######"]                          # ligger på ryggen, hodet til venstre, bøyd kne (3 rader)
SIT = [".###....", ".###....", "#.#.#...", "..#.....", "..######"]              # sitter, bena rett frem (5 rader)
JUMP = [".###.", ".###.", "#.#.#", "..#..", ".#.#."]                          # hopp, bena trukket opp (5 rader)
RUN = [".###.", ".###.", ".#.#.", "..#.#", "..#..", ".#.#.", "#...#"]         # løper


def draw(c, rows, x0, y0):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                c.set(x0 + x, y0 + y)


def star(c, x, y):
    for dx, dy in ((0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)):
        c.set(x + dx, y + dy)


def orbit(c, cx, cy, phase):
    """Tre pluss-formede stjerner som kretser rundt (cx, cy)."""
    for k in range(3):
        a = math.radians(phase * 40 + k * 120)
        star(c, cx + round(6 * math.cos(a)), cy + round(1.2 * math.sin(a)))


def walk_pose(t):
    return [WALK_A, WALK_B, WALK_C, WALK_B][t % 4]


def head_shake(c, x, shift):
    draw(c, WALK_B[2:], x, 2)                              # kropp uten hode
    draw(c, [".###.", ".###."], x + shift, 0)               # hodet flyttes sidelengs


def frame(t):
    c = Canvas()
    draw(c, PEEL, PEEL_X, 5)
    if t <= 11:                                            # går inn
        draw(c, walk_pose(t), -5 + 4 * t, 0)
    elif t == 12:                                          # tråkker på skallet
        draw(c, SLIP, 40, 0)
    elif t == 13:                                          # i luften, vannrett
        draw(c, AIR, 38, 1)
    elif t == 14:                                          # lander på ryggen
        draw(c, LYING, 38, 4)
        for x, y in ((36, 4), (36, 6), (48, 2), (50, 4)):   # slagstjerner
            c.set(x, y)
    elif 15 <= t <= 18:                                    # ligger med stjerner
        draw(c, LYING, 38, 4)
        orbit(c, 42, 2, t - 15)
    elif t == 19:                                          # setter seg opp
        draw(c, SIT, 39, 2)
        star(c, 42, 1)
    elif t == 20:                                          # står
        draw(c, WALK_B, 41, 0)
    elif t == 21:                                          # rister på hodet
        head_shake(c, 41, -1)
    elif t == 22:
        head_shake(c, 41, 1)
    elif t == 23:                                          # hopper over skallet
        draw(c, JUMP, 45, 0)
    elif t == 24:
        draw(c, RUN, 58, 0)
    else:                                                  # t == 25: løper ut
        draw(c, RUN, 76, 0)
    return c


def build():
    return [frame(t) for t in range(FRAMES)]


if __name__ == "__main__":
    frames = build()
    if "--preview" in sys.argv:
        animlib.render_preview(frames, SCHEDULE, "stikkmann", cell=8)
    else:
        animlib.load(frames, SCHEDULE, per_gpage=1 if "--one" in sys.argv else 2)
