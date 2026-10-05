"""Conways Game of Life på skiltets 80 x 7 piksler (torus: kantene henger sammen).

26 unike bilder, 31 plasser (15,5 s):
  bilde 0       frøet (et lite tilfeldig mønster midt på skjermen), vises litt lenger
  bilde 1-21    22 generasjoner (0..21), utviklet etter standardreglene B3/S23
  bilde 22-25   feiing: feltet viskes ut fra venstre mot høyre, så starter runden med et nytt frø

Frøet er valgt ved søk (se search()): det som holder seg i live, vokser ut over hele feltet og har mest bevegelse.

Bruk:  python anim_life.py --search      finn et nytt frø og skriv ut tallet
       python anim_life.py --preview     forhåndsvisning på PC-en
       python anim_life.py               last inn på skiltet
       python anim_life.py --seed 123    bruk et bestemt frø     --one  ett bilde per grafikkside
"""
import sys

import numpy as np

import animlib
from gfx import Canvas

W, H = 80, 7
GENS = 22                       # generasjoner som vises (bilde 0-21)
SEED = 2572                     # funnet med --search (beste av 4000 frø, poeng 4506)
FRAMES = 26
HOLDS = {0: 3, 21: 3, 8: 2}     # frøet, siste generasjon og ett mellombilde vises litt lenger (31 plasser)
SCHEDULE = animlib.schedule_from_holds(FRAMES, HOLDS)


def step(b):
    """Én generasjon, B3/S23, på en torus."""
    n = sum(np.roll(np.roll(b, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
    return ((n == 3) | (b & (n == 2))).astype(np.uint8)


DENSITY = 0.30                  # andel levende celler i ursuppen


def seed_board(seed):
    """Ursuppe: tilfeldige celler over hele 80 x 7-feltet (samme frø gir alltid samme suppe)."""
    rng = np.random.default_rng(seed)
    return (rng.random((H, W)) < DENSITY).astype(np.uint8)


def generations(seed):
    b = seed_board(seed)
    out = [b]
    for _ in range(GENS - 1):
        b = step(b)
        out.append(b)
    return out


def score(seed):
    g = generations(seed)
    pops = [int(x.sum()) for x in g]
    if min(pops) < 40:
        return -1
    if any((g[i] == g[j]).all() for i in range(len(g)) for j in range(i)):
        return -1                                       # ikke hopp inn i en løkke eller stillstand
    changes = [int((g[i] != g[i - 1]).sum()) for i in range(1, len(g))]
    tail = sum(changes[-6:]) / 6                        # fortsatt bevegelse mot slutten
    if tail < 25:
        return -1
    spread = int((g[-1].any(axis=0)).sum())             # antall kolonner med liv til slutt
    return sum(changes) + 6 * tail + 4 * spread


def search(n=4000):
    best = sorted(((score(s), s) for s in range(1, n + 1)), reverse=True)[:5]
    return best


def frames_for(seed):
    g = generations(seed)
    frames = []
    for t in range(FRAMES):
        if t < GENS:
            b = g[t]
        else:                                           # feiing: kolonner til venstre for grensen slokkes
            cut = int((t - GENS + 1) * W / 4)           # 20, 40, 60, 80 kolonner
            b = g[-1].copy()
            b[:, :cut] = 0
        c = Canvas()
        for y in range(H):
            for x in range(W):
                if b[y, x]:
                    c.set(x, y)
        frames.append(c)
    return frames


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--search" in args:
        for sc, s in search():
            print(f"frø {s}: poeng {sc}")
        sys.exit()
    seed = int(args[args.index("--seed") + 1]) if "--seed" in args else SEED
    if seed == 0:
        raise SystemExit("Sett SEED i filen, eller bruk --seed N (finn et frø med --search).")
    frames = frames_for(seed)
    if "--preview" in args:
        animlib.render_preview(frames, SCHEDULE, "life")
    else:
        animlib.load(frames, SCHEDULE, per_gpage=1 if "--one" in args else 2)
