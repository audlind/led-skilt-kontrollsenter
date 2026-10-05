"""Pac-Man-animasjon: 10 ferdiglastede bilder (sider A-J) som skiltet blar mellom selv."""
import time

from amsign import Sign
from gfx import Canvas

CLOSED = ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]
OPEN = ["..###..", ".####..", "####...", "###....", "####...", ".####..", "..###.."]
STEP = 8
FRAMES = 10  # x = 0, 8, ..., 72


def frame(i):
    c = Canvas()
    x0 = i * STEP
    sprite = OPEN if i % 2 == 0 else CLOSED
    for y, row in enumerate(sprite):
        for k, ch in enumerate(row):
            if ch == "#":
                c.set(x0 + k, y)
    for xd in range(10, 80, 6):          # prikker på midtlinjen
        if xd > x0 + 7:
            c.set(xd, 3)
    return c


def main():
    s = Sign()
    s.send("<D*>", show=False)
    time.sleep(1)
    for i in range(FRAMES):
        letter = chr(ord("A") + i)
        c = frame(i)
        for b, blk in enumerate(c.blocks(), start=1):
            r = s.send(b"<G%s%d>" % (letter.encode(), b) + blk, show=False)
            assert r.startswith(b"ACK"), (letter, b, r)
        labels = "".join(f"<G{letter}{b}>" for b in range(1, 4))
        r = s.send(f"<L1><P{letter}><FA><Ma><WA><FK>{labels}", show=False)  # ut = K (Hold): ingen blinking
        assert r.startswith(b"ACK"), (letter, r)
        print("bilde", i + 1, "av", FRAMES, "lastet")
    # Tidsplan A, alltid aktiv (år 00-99), med alle sidene i rekkefølge. Uten tidsplan vises bare en evt. kjøreside.
    pages = "".join(chr(ord("A") + i) for i in range(FRAMES))
    r = s.send("<TA>00010100009912312359" + pages, show=False)
    assert r.startswith(b"ACK"), r
    print("tidsplan A:", pages)
    s.close()
    print("ferdig: skiltet spiller animasjonen selv")


if __name__ == "__main__":
    main()
