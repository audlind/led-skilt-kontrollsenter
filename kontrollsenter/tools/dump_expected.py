"""Skriver fasit for JavaScript-testen: blokker for alle forhåndsbilder og en komplett opplastingsplan (Python-versjonen)."""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # repoets rot
sys.path.insert(0, os.path.join(ROOT, "python"))                                      # amsign, gfx, animlib og anim_*

import amsign
import anim_pong
import animlib
from gfx import Canvas

# 1) blokker for alle forhåndsbilder
presets = json.loads(open(os.path.join(ROOT, "kontrollsenter", "js", "presets.js"), encoding="utf-8").read()
                     .split("=", 1)[1].rstrip().rstrip(";"))
blocks = []
for p in presets:
    for i, rows in enumerate(p["frames"]):
        c = Canvas()
        for y in range(7):
            for x in range(80):
                if rows[y][x] == "#":
                    c.set(x, y)
        blocks.append({"id": p["id"], "frame": i, "blocks": [b.hex() for b in c.blocks()]})

# 2) opplastingsplan for Pong (som animlib.load sender den)
sent = []


class FakeSign:
    def send(self, data, **k):
        sent.append((data if isinstance(data, bytes) else data.encode("latin-1")).hex())
        return b"ACK"

    def close(self):
        pass


time.sleep = lambda s: None
frames = anim_pong.build()
animlib.load(frames, anim_pong.SCHEDULE, per_gpage=2, page_extra={5: "<BA>", 15: "<BA>"}, sign=FakeSign())

# 3) pakker
samples = {
    "slett": amsign.packet("<D*>").hex(),
    "side": amsign.packet("<L1><PA><FE><Ma><WA><FE><AA><CB><N00>" + amsign.encode("Hei på deg: Æ Ø Å")).hex(),
    "encode": amsign.encode("Hei på deg: Æ Ø Å æ ø å"),
}
out = os.path.join(ROOT, "kontrollsenter", "tools", "expected.json")
json.dump({"blocks": blocks, "pong_plan": sent, "samples": samples}, open(out, "w"))
print("skrev", out, len(blocks), "rammer,", len(sent), "pakker i planen")
