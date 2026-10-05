"""Grafikk for AM03127: gjør ASCII-kunst om til 32x8-blokker (<GXn>).

Format per blokk (bekreftet ved test): 64 byte = fire 8x8-enheter etter hverandre,
16 byte per enhet, radvis (2 byte per rad), 4 piksler per byte, MSB = venstre piksel.
Pikselverdi: 00 av, 01 grønn, 10 rød, 11 gul. Skiltet har 7 synlige rader (rad 8 vises ikke).
"""


def art_to_blocks(art, width=None):
    """art: liste med strenger ('#' = rød piksel, '.' eller ' ' = av). Returnerer liste med 64-byte blokker."""
    rows = [r.ljust(width or max(len(r) for r in art)) for r in art]
    rows += [" " * len(rows[0])] * (8 - len(rows))  # fyll opp til 8 rader
    total_cols = len(rows[0])
    n_blocks = -(-total_cols // 32)
    blocks = []
    for b in range(n_blocks):
        data = bytearray()
        for unit in range(4):
            for row in range(8):
                for half in range(2):
                    byte = 0
                    for k in range(4):
                        col = b * 32 + unit * 8 + half * 4 + k
                        on = col < total_cols and rows[row][col] == "#"
                        byte = (byte << 2) | (0b10 if on else 0b00)
                    data.append(byte)
        blocks.append(bytes(data))
    return blocks


class Canvas:
    """Tegnebrett 80 x 7 piksler (x = 0..79 fra venstre, y = 0..6 fra toppen)."""
    W, H = 80, 7

    def __init__(self):
        self.px = [[0] * self.W for _ in range(8)]

    def clear(self):
        self.px = [[0] * self.W for _ in range(8)]

    def set(self, x, y, on=True):
        if 0 <= x < self.W and 0 <= y < self.H:
            self.px[y][x] = 1 if on else 0

    def line(self, x0, y0, x1, y1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.set(x0, y0)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def rect(self, x0, y0, x1, y1, fill=False):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if fill or x in (x0, x1) or y in (y0, y1):
                    self.set(x, y)

    def to_art(self):
        return ["".join("#" if v else " " for v in row) for row in self.px[: self.H]]

    def blocks(self):
        return art_to_blocks(self.to_art(), width=self.W)

    def show(self, sign, page="A", gpage="A", **kw):
        """Sender blokkene og selve siden (gjør dette første gang)."""
        return send_art(sign, self.to_art(), page=page, gpage=gpage, **kw)

    def update(self, sign, gpage="A", only_changed=True):
        """Sender bare blokkene som er endret siden sist (live-oppdatering; siden sendes ikke igjen)."""
        last = getattr(self, "_last", {})
        self._last = last
        for i, blk in enumerate(self.blocks(), start=1):
            if only_changed and last.get(i) == blk:
                continue
            r = sign.send(b"<G" + gpage.encode() + str(i).encode() + b">" + blk, show=False)
            if not r.startswith(b"ACK"):
                return r
            last[i] = blk
        return b"ACK"


def send_art(sign, art, page="A", gpage="A", lead="A", lag="K", wait_c="Z", show=False):
    """Sender grafikkblokkene og en side som viser dem etter hverandre."""
    blocks = art_to_blocks(art)
    for i, blk in enumerate(blocks, start=1):
        r = sign.send(b"<G" + gpage.encode() + str(i).encode() + b">" + blk, show=show)
        assert r.startswith(b"ACK"), f"blokk {i}: {r!r}"
    labels = "".join(f"<G{gpage}{i}>" for i in range(1, len(blocks) + 1))
    return sign.send(f"<L1><P{page}><F{lead}><Ma><W{wait_c}><F{lag}>{labels}", show=show)
