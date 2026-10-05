# Animasjoner

Skiltet kan ikke oppdateres live over seriell uten å bli mørkt (se under). Løsningen er å **laste alle bildene én gang** og la skiltet bla mellom dem selv. Da sendes ingenting mens animasjonen spiller, så skjermen holder seg tent og bildet er blinkefritt.

## Mørketid: hvorfor ikke live-oppdatering

Skiltets prosessor viser bare skjermen når den ikke er opptatt med serielt mottak. Målt på video (38 s, 29,8 bilder per sekund) som andel av bildene der skjermen viste innhold:

| Metode | Pakkestørrelse | Oppdateringer per sekund | Skjermen viser noe |
|---|---|---|---|
| Grafikkblokker (`<GA1>` + 64 byte) | ca. 80 byte | 10 | 33 % |
| Kort tekstside med en prikk | ca. 45 byte | 16 | 53 % |
| Sidebytte med `<RPA>` / `<RPB>` | ca. 12 byte | 6,7 | 92 % |

Ved 9600 baud tar hver byte ca. 1,04 ms, og mørketiden følger pakkestørrelsen nær (12 byte × 6,7 per sekund gir ca. 8 % mørkt, og det ble målt 8 %). Tolkningen er at prosessoren er opptatt med seriell mottak. Ved de raskeste oppdateringene dukker det også opp rotete tegn (likt standardskjermen «LED») i ett eller to bilder.

**Praktiske råd:** send grafikk én gang, oppdater sjelden, send bare blokkene som er endret, og bruk ferdiglastede sider for alt som skal bevege seg.

## Teknikken: ferdiglastede sider

1. **Hvert bilde er en side** (A, B, C, …) som viser tre grafikkblokker (`<GA1><GA2><GA3>`).
2. **To bilder deler en grafikkside:** blokk 1–3 og blokk 4–6. Da bruker 26 bilder bare 13 grafikksider (A–M). Hvis dette ikke virker på et annet skilt, bruk ett bilde per grafikkside.
3. **En tidsplan som alltid er aktiv** (`<TA>00010100009912312359ABCD…`) viser sidene i rekkefølge. Den kan gjenta sider og har plass til **31 plasser**. Uten tidsplan vises bare en eventuell kjøreside (se under).
4. **Utgående effekt Hold (`<FK>`)** gjør at forrige bilde blir stående til neste tegnes. Med `<FA>` blir skjermen tom mellom bildene og blinker kraftig.
5. **Innledende effekt `<FA>`** (umiddelbart) og **ventetid `<WA>`** (0,5 s) gir raskest mulig bildefrekvens: **2 bilder per sekund**.

```
<L1><PA><FA><Ma><WA><FK><GA1><GA2><GA3>      ← bilde 1 (side A)
<L1><PB><FA><Ma><WA><FK><GA4><GA5><GA6>      ← bilde 2 (side B, samme grafikkside A, blokk 4–6)
<TA>00010100009912312359AB…                  ← tidsplan: sidene i rekkefølge
```

### Kjøresiden som ikke vil gå bort

`<RPn>` setter en kjøreside som vises når ingen tidsplan er aktiv. Den **blir stående selv etter `<D*>`** på dette skiltet, og da vises bare den siden og animasjonen står stille. Bruk derfor en tidsplan, ikke en kjøreside, for animasjoner.

### Holdtid

En side kan vises lenger ved å gjenta den i tidsplanen. `<TA>…ABBBC…` viser side B i 1,5 s. Det er slik de morsomme øyeblikkene (eksplosjonen, bananskall-skliingen) får litt luft.

## Grenser

| Egenskap | Verdi |
|---|---|
| Raskeste bilde | 0,5 s per side (ventetid `<WA>`) |
| Unike bilder | 26 (sidene A–Z) |
| Plasser i tidsplanen | 31 (sider kan gjentas) |
| Lengste løkke | 31 × 0,5 s = 15,5 s |
| Lastetid | ca. 80 byte per blokk, 3 blokker per bilde: 26 bilder tar ca. 11 s og blinker underveis |

Tre grafikkblokker per bilde gir 2 bilder per grafikkside (6 av 8 blokker). Sidene A–P var testet; to bilder per side (blokk 4–6) virker også.

## Animasjonene i repoet

Alle ligger i [`python/`](../python) og kan forhåndsvises uten skilt (`python anim_xxx.py --preview`, krever `opencv-python-headless` og `pillow`). De er også eksportert som data til kontrollsenteret (`kontrollsenter/js/presets.js`).

| Fil | Animasjon | Bilder | Plasser |
|---|---|---|---|
| `anim_stikkmann.py` | Stikkmannen går inn, sklir på et bananskall, ligger med stjerner, reiser seg og stikker av | 26 | 31 |
| `anim_heart.py` | Hjerte med EKG-linjer som slår i lub-dub | 26 | 30 |
| `anim_pong.py` | Pong spiller mot seg selv, sømløs løkke (ballens bane gjentar seg etter 20 bilder) | 20 | 22 |
| `anim_space.py` | Rakett, asteroide, laser, eksplosjon og hyperromhopp | 26 | 31 |
| `anim_chase.py` | Pac-Man spiser prikker, et spøkelse jager ham tilbake | 16 | 16 |
| `anim_pacman.py` | Pac-Man spiser prikker | 10 | 10 |
| `anim_life.py` | Conways Game of Life som «ursuppe» (utprøvd, fungerer dårlig ved denne oppløsningen) | 26 | 31 |

Bruk gjerne `--nosound` på Pong hvis du ikke vil ha bip fra summeren.

<table>
<tr>
<td align="center"><img src="bilder/forhandsvisning/stikkmann_preview.gif" width="330"><br>Stikkmannen</td>
<td align="center"><img src="bilder/forhandsvisning/heart_preview.gif" width="330"><br>Hjerteslag</td>
</tr>
<tr>
<td align="center"><img src="bilder/forhandsvisning/pong_preview.gif" width="330"><br>Pong</td>
<td align="center"><img src="bilder/forhandsvisning/space_preview.gif" width="330"><br>Romfilm</td>
</tr>
</table>

Hele bildesekvensen for hver animasjon ligger som PNG i [`bilder/forhandsvisning/`](bilder/forhandsvisning).

## Lage din egen

I Python (se [`python/gfx.py`](../python/gfx.py) og [`python/animlib.py`](../python/animlib.py)):

```python
import animlib
from gfx import Canvas

frames = []
for t in range(16):
    c = Canvas()
    c.rect(0, 0, 79, 6)               # ramme
    c.set(5 + 4 * t, 3)               # en prikk som beveger seg
    frames.append(c)

schedule = animlib.schedule_from_holds(len(frames), {8: 2})     # bilde 8 vises i 1 s
animlib.load(frames, schedule)        # laster inn og starter
```

Tegn pikslene med `Canvas.set/line/rect`, og `animlib.render_preview(frames, schedule, "min")` lager en PNG og en GIF uten at skiltet trengs. I kontrollsenteret kan du tegne bildene direkte på skiltet og bruke generatorene (rull, blink, frem og tilbake).
