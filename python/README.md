# Python

Biblioteker og animasjoner for kommandolinjen. Krever Python 3 og `pyserial` (`pip install pyserial`).

Skriptene finner hverandre så lenge de ligger i samme mappe; kjør dem herfra (`cd python`). Standardporten er `COM3`, endre den i `amsign.py` (`Sign(port="COM3")`).

## Bibliotek

| Fil | Innhold |
|---|---|
| `amsign.py` | `Sign`-klassen: pakker med sjekksum, rask svarlesing (`ACK`/`NACK`), `page()` for tekstsider, `encode()` for norske tegn (`<Uxx>`). Venter 2,5 s etter at porten åpnes (Uno-resett). |
| `gfx.py` | Grafikk: `art_to_blocks()` gjør ASCII-kunst til 32×8-blokker, `Canvas` (80 × 7 med `set`, `line`, `rect`, `update`), `send_art()`. |
| `animlib.py` | `load()` laster en animasjon som sider og tidsplan, `schedule_from_holds()` lager rekkefølgen med holdtid, `render_preview()` lager PNG og GIF uten skilt. |
| `ping.py` | Kontakttest: sender `<BA>` tre ganger og skriver ut svarene (forventer `ACK`). |

## Animasjoner

`anim_stikkmann.py`, `anim_heart.py`, `anim_pong.py`, `anim_space.py`, `anim_chase.py`, `anim_pacman.py` og `anim_life.py`. Se [../docs/animasjoner.md](../docs/animasjoner.md).

```
python anim_pong.py                 # last inn i skiltet
python anim_pong.py --one           # ett bilde per grafikkside (hvis blokk 4-6 ikke virker)
python anim_pong.py --nosound       # uten bip
python anim_pong.py --preview       # forhåndsvisning (pong_preview.png og .gif), krever ikke skilt
```

Forhåndsvisning krever `pip install opencv-python-headless pillow numpy`.

## Eksempel

```python
from amsign import Sign
s = Sign("COM3")
s.send("<D*>")                                                    # slett alt
s.page("Hei på deg: Æ Ø Å", lead="E", lag="E", disp="a", wait_c="C")   # rulletekst, norske tegn oversettes
s.close()
```
