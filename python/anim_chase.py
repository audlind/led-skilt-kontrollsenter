"""Pac-Man spiser prikker mot høyre, et spøkelse dukker opp og jager ham tilbake mot venstre.
16 ferdiglastede bilder (sider A-P, grafikksider A-P), alltid aktiv tidsplan, ut-effekt Hold.
"""
import time

from amsign import Sign
from gfx import Canvas

CLOSED = ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]
OPEN_R = ["..###..", ".####..", "####...", "###....", "####...", ".####..", "..###.."]
OPEN_L = [row[::-1] for row in OPEN_R]
GHOST = ["..###..", ".#####.", "##.#.##", "#######", "#######", "#######", "#.#.#.#"]

RIGHT_FRAMES = 8          # bilde 0-7: Pac-Man mot høyre, x = 0, 8, ..., 56
FRAMES = 16               # bilde 8-15: spøkelset dukker opp, jakt mot venstre


def draw(c, sprite, x0):
    for y, row in enumerate(sprite):
        for k, ch in enumerate(row):
            if ch == "#":
                c.set(x0 + k, y)


def frame(i):
    c = Canvas()
    if i < RIGHT_FRAMES:                      # spiser prikker mot høyre
        x = i * 8
        draw(c, OPEN_R if i % 2 == 0 else CLOSED, x)
        for xd in range(10, 80, 6):
            if xd > x + 7:
                c.set(xd, 3)
    else:                                     # snur og flykter mot venstre
        j = i - RIGHT_FRAMES                  # 0..7
        x = 64 - 8 * j                        # 64, 56, ..., 8
        draw(c, OPEN_L if j % 2 == 0 else CLOSED, x)
        draw(c, GHOST, x + 12)                # spøkelset ett steg bak (klippes ved høyre kant)
    return c


def main():
    s = Sign()
    s.send("<D*>", show=False)
    time.sleep(1)
    for i in range(FRAMES):
        letter = chr(ord("A") + i)
        for b, blk in enumerate(frame(i).blocks(), start=1):
            r = s.send(b"<G%s%d>" % (letter.encode(), b) + blk, show=False)
            assert r.startswith(b"ACK"), (letter, b, r)
        labels = "".join(f"<G{letter}{b}>" for b in range(1, 4))
        r = s.send(f"<L1><P{letter}><FA><Ma><WA><FK>{labels}", show=False)
        assert r.startswith(b"ACK"), (letter, r)
        print("bilde", i + 1, "av", FRAMES, "lastet", flush=True)
    pages = "".join(chr(ord("A") + i) for i in range(FRAMES))
    r = s.send("<TA>00010100009912312359" + pages, show=False)
    assert r.startswith(b"ACK"), r
    print("tidsplan A:", pages)
    s.close()
    print("ferdig")


if __name__ == "__main__":
    main()
