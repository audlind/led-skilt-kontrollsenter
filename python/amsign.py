"""Bibliotek for Amplus AM03127-skilt via Uno-bro (invertert logikk), COM3, 9600 8N1."""
import time
import serial


def encode(text: str) -> str:
    """Gjør Latin-1-tegn U+00C0..U+00FF (Æ Ø Å æ ø å osv.) om til skiltets <Uxx>-koder."""
    out = []
    for ch in text:
        if 0xC0 <= ord(ch) <= 0xFF:
            out.append(f"<U{ord(ch) - 0x80:02X}>")
        else:
            out.append(ch)
    return "".join(out)


def _b(data) -> bytes:
    return data if isinstance(data, bytes) else data.encode("latin-1")


def checksum(data) -> str:
    x = 0
    for ch in _b(data):
        x ^= ch
    return f"{x:02X}"


def packet(data, sign_id: int = 0, bad_cs: bool = False) -> bytes:
    cs = checksum(data)
    if bad_cs:
        cs = f"{(int(cs, 16) ^ 0xFF):02X}"
    return b"<ID%02X>" % sign_id + _b(data) + cs.encode() + b"<E>"


class Sign:
    def __init__(self, port="COM3", sign_id=0):
        self.id = sign_id
        self.s = serial.Serial(port, 9600, bytesize=8, parity="N", stopbits=1, timeout=1.2)
        time.sleep(2.5)  # Uno resettes ved åpning av port
        self.s.reset_input_buffer()

    def send(self, data, sign_id=None, bad_cs=False, show=True, wait=0.0):
        pkt = packet(data, self.id if sign_id is None else sign_id, bad_cs)
        self.s.reset_input_buffer()
        self.s.write(pkt)
        rx = self._read_reply()
        if show:
            print(f"TX {pkt!r}  ->  RX {rx!r}")
        if wait:
            time.sleep(wait)
        return rx

    def _read_reply(self):
        """Les svaret uten å vente på tidsavbrudd: ACK = 3 byte, NACK = 4 byte + ev. ett sjekksumbyte."""
        rx = self.s.read(3)
        if rx == b"NAC":
            rx += self.s.read(1)            # 'K'
            time.sleep(0.02)
            rx += self.s.read(self.s.in_waiting)  # evt. forventet sjekksum
        return rx

    def raw(self, b: bytes, show=True):
        self.s.reset_input_buffer()
        self.s.write(b)
        rx = self.s.read(16)
        if show:
            print(f"RAW TX {b!r}  ->  RX {rx!r}")
        return rx

    def page(self, text, line=1, page="A", lead="E", disp="a", wait_c="A", lag="E",
             font="A", color="B", col=0, extra="", **kw):
        d = (f"<L{line}><P{page}><F{lead}><M{disp}><W{wait_c}><F{lag}>"
             f"<A{font}><C{color}><N{col:02X}>{extra}{encode(text)}")
        return self.send(d, **kw)

    def close(self):
        self.s.close()
