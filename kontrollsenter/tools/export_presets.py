"""Eksporterer Python-animasjonene til kontrollsenter/js/presets.js (bilder som 7 strenger à 80 tegn, '#' = tent)."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # repoets rot
sys.path.insert(0, os.path.join(ROOT, "python"))                                      # amsign, gfx, animlib og anim_*

import anim_chase
import anim_heart
import anim_pacman
import anim_pong
import anim_space
import anim_stikkmann
from gfx import Canvas


def rows(c):
    return ["".join("#" if c.px[y][x] else "." for x in range(80)) for y in range(7)]


def holds_from_schedule(schedule):
    h = {}
    for t in schedule:
        h[t] = h.get(t, 0) + 1
    return {str(k): v for k, v in h.items() if v > 1}


presets = [
    {
        "id": "stikkmann", "navn": "Stikkmannen og bananskallet",
        "beskrivelse": "Går inn, sklir på et bananskall, ligger med stjerner, reiser seg og stikker av.",
        "frames": [rows(c) for c in anim_stikkmann.build()],
        "holds": holds_from_schedule(anim_stikkmann.SCHEDULE),
    },
    {
        "id": "hjerte", "navn": "Hjerteslag",
        "beskrivelse": "Hjerte med EKG-linjer som slår i lub-dub.",
        "frames": [rows(c) for c in anim_heart.build()],
        "holds": holds_from_schedule(anim_heart.SCHEDULE),
    },
    {
        "id": "pong", "navn": "Pong (evig rally)",
        "beskrivelse": "Pong som spiller mot seg selv i en sømløs løkke.",
        "frames": [rows(c) for c in anim_pong.build()],
        "holds": holds_from_schedule(anim_pong.SCHEDULE),
    },
    {
        "id": "rom", "navn": "Romfilm",
        "beskrivelse": "Rakett, asteroide, laser, eksplosjon og hyperromhopp.",
        "frames": [rows(anim_space.frame(t)) for t in range(anim_space.FRAMES)],
        "holds": holds_from_schedule(anim_space.SCHEDULE),
    },
    {
        "id": "pacjakt", "navn": "Pac-Man jages av spøkelse",
        "beskrivelse": "Pac-Man spiser prikker, et spøkelse dukker opp og jager ham tilbake.",
        "frames": [rows(anim_chase.frame(i)) for i in range(anim_chase.FRAMES)],
        "holds": {},
    },
    {
        "id": "pacman", "navn": "Pac-Man",
        "beskrivelse": "Pac-Man spiser prikker langs skjermen.",
        "frames": [rows(anim_pacman.frame(i)) for i in range(anim_pacman.FRAMES)],
        "holds": {},
    },
]

out = os.path.join(ROOT, "kontrollsenter", "js", "presets.js")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    f.write("// Generert av tools/export_presets.py. Ikke rediger for hånd.\n")
    f.write("window.PRESETS = " + json.dumps(presets, ensure_ascii=False, indent=0) + ";\n")
print("skrev", out, "-", len(presets), "forhåndsinnstillinger,", sum(len(p["frames"]) for p in presets), "bilder")
