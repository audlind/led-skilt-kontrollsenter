"""Romfilm for AM03127-skiltet: 26 unike bilder (sider A-Z), 31 plasser i tidsplanen (15,5 s).

Scener (0,5 s per bilde, alle forflytninger er små steg):
  t0-9    stjerner ruller i to lag (1 og 3 piksler per bilde), raketten glir inn fra venstre
  t6-14   asteroide nærmer seg fra høyre, 3 piksler per bilde
  t12-14  raketten skyter, laserskuddet treffer
  t15-19  eksplosjon med ringer og rusk
  t20-25  hyperromhopp: raketten akselererer, stjernene blir til striper, blits

To bilder deler en grafikkside (blokk 1-3 og 4-6), så 26 bilder bruker 13 grafikksider (A-M).
Bruk:  python anim_space.py            laster inn og starter
       python anim_space.py --one      ett bilde per grafikkside (26 sider, hvis blokk 4-6 ikke virker)
       python anim_space.py --preview  bare forhåndsvisning på PC-en (trenger ikke skiltet)
"""
import math
import sys

from gfx import Canvas

FRAMES = 26
HOLD = {9: 2, 14: 2, 17: 3, 25: 2}        # bilder som vises litt lenger (antall plasser i tidsplanen)
SCHEDULE = [t for t in range(FRAMES) for _ in range(HOLD.get(t, 1))]   # 31 plasser

ROCKET = ["###.#....", ".#######.", "####.####", ".#######.", "###.#...."]   # vinger, cockpit-hull, spiss nese
ASTEROID = [".###.", "##.##", "#####", "####.", ".###."]                                # med krater
ENTRY_X = [-9, -5, -1, 3, 7, 11, 15, 18, 21, 24]            # t0-9
WARP_X = [28, 36, 46, 58, 72, 100]                          # t20-25
FAR = [(3, 1), (11, 5), (19, 2), (27, 6), (35, 0), (44, 4), (53, 1), (61, 5), (70, 3), (77, 6)]
NEAR = [(6, 3), (17, 0), (29, 5), (40, 2), (51, 6), (63, 1), (73, 4)]
DEBRIS = [(3, 0), (-2, -1), (2, -1), (2, 1), (-2, 1), (1, -2), (1, 2), (-3, 0)]


def sprite(c, rows, x0, y0, clear=True):
    if clear:                                   # klipp ut bakgrunnen (stjerner) bak figuren
        for y in range(len(rows)):
            for x in range(len(rows[0])):
                c.set(x0 + x, y0 + y, False)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                c.set(x0 + x, y0 + y)


def stars(c, t, streak=0):
    for i, (x, y) in enumerate(FAR):
        if streak == 0 and (i + t) % 4 == 0:        # fjerne stjerner blinker (borte hvert fjerde bilde)
            continue
        sx = (x - 1 * t) % 80
        for k in range(1 + (streak // 3)):
            c.set(sx + k, y)
    for (x, y) in NEAR:
        sx = (x - 3 * t) % 80
        for k in range(1 + streak):
            c.set(sx + k, y)


def ring(c, cx, cy, r, step=30):
    for a in range(0, 360, step):
        c.set(cx + round(r * math.cos(math.radians(a))), cy + round(0.6 * r * math.sin(math.radians(a))))


def frame(t):
    c = Canvas()
    if t == 25:                                  # blitsen
        c.rect(0, 0, 79, 6, fill=True)
        return c
    streak = 0 if t < 20 else [1, 3, 6, 10, 16][t - 20]
    stars(c, t, streak)
    # rakett
    if t < 10:
        rx = ENTRY_X[t]
    elif t < 20:
        rx = 24 - (1 if t == 12 else 0)          # lite rykk bakover når den skyter
    else:
        rx = WARP_X[t - 20]
    flame = 2 + (t % 2) + (streak // 3 if t >= 20 else 0)
    for k in range(1, flame + 1):
        c.set(rx - k, 3)
    if t % 2 == 0:
        c.set(rx - 1, 2)
        c.set(rx - 1, 4)
    sprite(c, ROCKET, rx, 1)
    # asteroide
    if 6 <= t <= 14:
        sprite(c, ASTEROID, 80 - 3 * (t - 6), 1)
    # laser
    if t in (12, 13, 14):
        a, b = {12: (34, 40), 13: (42, 48), 14: (49, 55)}[t]
        for x in range(a, b + 1):
            c.set(x, 3)
        if t == 12:
            c.set(rx + 9, 2)
            c.set(rx + 9, 4)
    # eksplosjon (sentrum der asteroiden traff)
    if 15 <= t <= 19:
        cx, cy = 58, 3
        k = t - 14                               # 1..5
        if k == 1:
            for dx in (-1, 0, 1):
                c.set(cx + dx, cy)
            c.set(cx, cy - 1)
            c.set(cx, cy + 1)
        elif k <= 3:
            ring(c, cx, cy, k, 30)
        elif k == 4:
            ring(c, cx, cy, 4, 60)
        else:
            ring(c, cx, cy, 5, 90)
        if k >= 2:
            for dx, dy in DEBRIS:
                c.set(cx + dx * (k - 1), cy + dy * (k - 1))
    return c


def render_preview():
    import cv2
    import numpy as np
    cell, pad = 6, 1
    frames = [frame(t) for t in range(FRAMES)]

    def img(c, label=None):
        h, w = 7 * cell + 2 * pad, 80 * cell + 2 * pad
        im = np.full((h + 18, w, 3), (24, 24, 24), np.uint8)
        for y in range(7):
            for x in range(80):
                col = (60, 60, 255) if c.px[y][x] else (50, 50, 50)
                cv2.circle(im, (pad + x * cell + cell // 2, pad + y * cell + cell // 2), 2, col, -1)
        if label:
            cv2.putText(im, label, (4, h + 13), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
        return im

    tiles = [img(c, f"bilde {t} (side {chr(65 + t)})") for t, c in enumerate(frames)]
    cols = 2
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    sheet = np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)])
    cv2.imwrite("space_preview.png", sheet)
    # GIF i tidsplanens rekkefølge (krever pillow)
    try:
        from PIL import Image
        seq = [Image.fromarray(cv2.cvtColor(img(frames[t]), cv2.COLOR_BGR2RGB)) for t in SCHEDULE]
        seq[0].save("space_preview.gif", save_all=True, append_images=seq[1:], duration=500, loop=0)
        print("space_preview.gif lagret (500 ms per plass,", len(seq), "plasser)")
    except ImportError:
        print("pillow mangler: bare PNG ble laget")
    print("space_preview.png lagret")


def load(per_gpage=2):
    import time
    from amsign import Sign
    s = Sign()
    s.send("<D*>", show=False)
    time.sleep(1)
    for t in range(FRAMES):
        letter = chr(ord("A") + t)
        gp = chr(ord("A") + t // per_gpage)
        first = (t % per_gpage) * 3 + 1
        for b, blk in enumerate(frame(t).blocks()):
            r = s.send(b"<G%s%d>" % (gp.encode(), first + b) + blk, show=False)
            assert r.startswith(b"ACK"), (letter, b, r)
        labels = "".join(f"<G{gp}{first + b}>" for b in range(3))
        r = s.send(f"<L1><P{letter}><FA><Ma><WA><FK>{labels}", show=False)
        assert r.startswith(b"ACK"), (letter, r)
        print(f"bilde {t + 1:2d} av {FRAMES} lastet (side {letter}, grafikkside {gp}, blokk {first}-{first + 2})", flush=True)
    pages = "".join(chr(ord("A") + t) for t in SCHEDULE)
    assert len(pages) <= 31
    r = s.send("<TA>00010100009912312359" + pages, show=False)
    assert r.startswith(b"ACK"), r
    print(f"tidsplan A: {pages} ({len(pages)} plasser, {len(pages) * 0.5:.1f} s per runde)")
    s.close()
    print("ferdig: skiltet spiller romfilmen selv")


if __name__ == "__main__":
    if "--preview" in sys.argv:
        render_preview()
    else:
        load(per_gpage=1 if "--one" in sys.argv else 2)
