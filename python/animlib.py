"""Felles hjelpefunksjoner for animasjoner på AM03127-skiltet.

En animasjon er en liste med 80x7-bilder (Canvas) og en tidsplan (rekkefølge av bilde-indekser, maks 31 plasser).
Bildene lastes én gang som sider A-Z, og skiltet spiller dem selv uten seriell trafikk.
To bilder deler en grafikkside (blokk 1-3 og 4-6) når per_gpage=2.
"""
import time

from gfx import Canvas

HEAD = "<TA>00010100009912312359"      # tidsplan A, alltid aktiv (år 00-99)


def schedule_from_holds(n_frames, holds):
    """Alle bilder i rekkefølge; holds = {bilde: antall plasser}. Maks 31 plasser."""
    seq = [t for t in range(n_frames) for _ in range(holds.get(t, 1))]
    assert len(seq) <= 31, f"{len(seq)} plasser (maks 31)"
    return seq


def render_preview(frames, schedule, prefix, cols=2, cell=6):
    import cv2
    import numpy as np
    pad = 1

    def img(c, label=None):
        h, w = 7 * cell + 2 * pad, 80 * cell + 2 * pad
        im = np.full((h + 18, w, 3), (24, 24, 24), np.uint8)
        for y in range(7):
            for x in range(80):
                col = (60, 60, 255) if c.px[y][x] else (50, 50, 50)
                cv2.circle(im, (pad + x * cell + cell // 2, pad + y * cell + cell // 2), max(2, cell // 3), col, -1)
        if label:
            cv2.putText(im, label, (4, h + 13), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
        return im

    tiles = [img(c, f"bilde {t} (side {chr(65 + t)})") for t, c in enumerate(frames)]
    while len(tiles) % cols:
        tiles.append(np.zeros_like(tiles[0]))
    sheet = np.vstack([np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)])
    cv2.imwrite(f"{prefix}_preview.png", sheet)
    print(f"{prefix}_preview.png lagret")
    try:
        from PIL import Image
        seq = [Image.fromarray(cv2.cvtColor(img(frames[t]), cv2.COLOR_BGR2RGB)) for t in schedule]
        seq[0].save(f"{prefix}_preview.gif", save_all=True, append_images=seq[1:], duration=500, loop=0)
        print(f"{prefix}_preview.gif lagret ({len(seq)} plasser, 500 ms per plass)")
    except ImportError:
        print("pillow mangler: bare PNG ble laget")


def load(frames, schedule, per_gpage=2, page_extra=None, mode_code=None, sign=None):
    """Last bildene inn i skiltet og start tidsplanen.

    page_extra: {bildeindeks: tekst som settes foran grafikken i siden, f.eks. '<BA>' for et bip}
    mode_code:  {bildeindeks: tegn for <M..>, f.eks. 'C' for melodi 1}; ellers 'a' (normal, hastighet 3)
    """
    from amsign import Sign
    page_extra = page_extra or {}
    mode_code = mode_code or {}
    s = sign or Sign()
    s.send("<D*>", show=False)
    time.sleep(1)
    for t, c in enumerate(frames):
        letter = chr(ord("A") + t)
        gp = chr(ord("A") + t // per_gpage)
        first = (t % per_gpage) * 3 + 1
        for b, blk in enumerate(c.blocks()):
            r = s.send(b"<G%s%d>" % (gp.encode(), first + b) + blk, show=False)
            assert r.startswith(b"ACK"), (letter, b, r)
        labels = "".join(f"<G{gp}{first + b}>" for b in range(3))
        m = mode_code.get(t, "a")
        r = s.send(f"<L1><P{letter}><FA><M{m}><WA><FK>{page_extra.get(t, '')}{labels}", show=False)
        assert r.startswith(b"ACK"), (letter, r)
        print(f"bilde {t + 1:2d} av {len(frames)} lastet (side {letter}, grafikkside {gp}, blokk {first}-{first + 2})", flush=True)
    pages = "".join(chr(ord("A") + t) for t in schedule)
    r = s.send(HEAD + pages, show=False)
    assert r.startswith(b"ACK"), r
    print(f"tidsplan A: {pages} ({len(pages)} plasser, {len(pages) * 0.5:.1f} s per runde)")
    s.close()
    print("ferdig: skiltet spiller animasjonen selv")
