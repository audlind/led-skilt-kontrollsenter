# Kontrollsenteret (utviklerdokumentasjon)

> **Bruker du appen?** Se [brukermanualen](brukermanual.md). Dette dokumentet er for deg som vil forstå eller endre koden.

En webapp (ren HTML, CSS og JavaScript, ingen bygging) som styrer skiltet. Kobler direkte til Uno-broen med Web Serial, eller kjører i simulator.

## Starte

```
cd kontrollsenter
start.bat            # eller:  python serve.py
```

`serve.py` starter en flertrådet lokal webserver på `http://localhost:8765` (neste ledige port hvis den er opptatt), uten mellomlagring, og åpner Chrome eller Edge. Du kan også åpne `index.html` direkte; Web Serial virker fra fil i Chrome/Edge. **Krever Chrome eller Edge** (Firefox og Safari støtter ikke Web Serial).

Trykk **KOBLE TIL SKILT**. Appen bruker Arduinoen du har godkjent før uten å spørre (hold Skift for å velge selv), venter 2,5 s på at Uno-en resettes, og sender en kontakttest. **SIMULATOR** lar deg bruke alt uten skilt.

## Faner

| Fane | Hva |
|---|---|
| **TEKST** | Meldingsbygger: alle effekter, hastigheter, modus, fonter, farger, norske tegn. Viser pakken, sjekksummen og kostnaden i byte. Hurtigvalg for rulletekst, blinkende tekst og klokke. |
| **TEGN** | Pikselstudio. Tegn rett på skiltet på skjermen. Penn, viskelær, linje, rektangel, fyll, flytt, speiling, forskyving, angre, tekststempel, bildeimport (terskel og dithering), tekst inn og ut. |
| **ANIMASJON** | Bibliotek med de ferdige animasjonene (forhåndsvis, rediger, last opp), tidslinje med onion skin og holdtid, generatorer (rull, blink, frem og tilbake), opplasting med fremdrift, eksport og import som JSON. |
| **SYSTEM** | Lysstyrke, klokkesynk, sletting, kjøreside, tidsplanbygger, lyd og tester, avansert (skilt-ID). |
| **REFERANSE** | Tabeller og regler, bygget fra de samme dataene som protokollen bruker. |

Høyre side har **instrumenter** (blant annet *display duty*: andel av de siste 10 sekundene skiltet har vist innhold) og **pakkemonitor** med hex, ACK/NACK, pakkeoppbygging og rå kommandoer. Ctrl+K åpner en kommandopalett, og tastene 1–5 bytter fane.

## Arkitektur

| Fil | Ansvar |
|---|---|
| `js/protocol.js` | Pakker, sjekksum, norske tegn, sidekommandoer, grafikkblokker, animasjonsplan. Ren logikk, brukes også i Node-testen. |
| `js/link.js` | Transport: `SerialLink` (Web Serial) og `SimLink` (simulator) med felles grensesnitt og tellere. |
| `js/twin.js` | **Digital tvilling:** en modell av skiltets minne (sider, grafikk, tidsplaner, kjøreside) som mates med alle kommandoer som får `ACK` og spiller dem av som skiltet ville gjort. |
| `js/display.js` | Gjenskaper skiltet på et canvas (80 × 7 punkter, lysstyrke, mørketid) og fungerer som tegneflate. |
| `js/font.js` | 5×7-skrift for forhåndsvisning og tekststempel (skiltets egen font er en annen). |
| `js/app.js`, `monitor.js`, `tab-*.js`, `main.js` | Fellestilstand, pakkemonitor og instrumenter, fanene, oppstart og hurtigtaster. |
| `js/presets.js` | De ferdige animasjonene som data. Genereres av `tools/export_presets.py` fra Python-animasjonene. |
| `js/diag.js` | Diagnose og oppstartsvakt. Lastes først og er uavhengig av resten. |

### Skiltet vises på to måter

- **TVILLING:** det skiltet forventes å vise (en modell av minnet, avspilt i 0,5 s-steg med hold og løkke). Effekter simuleres ikke.
- **REDIGERING:** bildet du redigerer. Du tegner direkte på det.

Mørketid simuleres: mens en pakke sendes dimmes skjermen like lenge som pakken tar på ledningen (1,04 ms per byte).

## Web Serial og tilkoblingen

- `SerialLink.connect()` lukker først alle porter som sitter åpne fra før, åpner porten på 9600 8N1, starter en lesesløyfe og venter 2,5 s på Uno-resetten.
- **Ikke-fatale leserfeil** (`BufferOverrunError`, `FramingError`, `ParityError`, `BreakError`) gir en ny leser, og forbindelsen fortsetter.
- **Fatale feil** (for eksempel `NetworkError` når enheten forsvinner) lukker porten ordentlig og melder frakoblet. Når Uno-en kommer tilbake, kobler appen til igjen automatisk.
- Kommandoer går i en kø (én om gangen). Svaret leses uten å vente på tidsavbrudd: `ACK` er tre byte, `NACK` fire pluss ett sjekksumbyte.

## Testing

Protokollen er testet **byte for byte mot Python-implementasjonen** som er bevist mot det ekte skiltet:

```
python kontrollsenter/tools/dump_expected.py      # Python skriver fasit (alle 124 forhåndsbilder og en komplett opplastingsplan)
node kontrollsenter/tools/test_protocol.js        # JavaScript sammenlignes: 460 sjekker
```

Samme test kjører i GitHub Actions ved hver push (se `.github/workflows/test.yml`). I tillegg bekrefter CI at `presets.js` er oppdatert i forhold til Python-animasjonene.

Selve tilkoblingen er testet mot en falsk Web Serial-port som kan feile på bestilling (fatal feil, ikke-fatal feil, port som sitter åpen fra før, skriving til en forsvunnet enhet), og mot det ekte skiltet.

## Skjermbilder til dokumentasjonen

Bildene i `docs/bilder/skjermbilder/` lages av selve appen i simulatormodus, med Playwright mot Chrome. Kjør dem på nytt når grensesnittet endres (se [docs/README.md](README.md#lage-skjermbildene-på-nytt)):

```
pip install playwright
python kontrollsenter/serve.py --no-browser      # ett vindu
python kontrollsenter/tools/screenshots.py       # et annet
```

Skriptet tilpasser høyden til innholdet, fjerner flyktige meldinger og lager det annoterte oversiktsbildet med nummererte markører. Appens strenge CSP blokkerer at Playwright kjører kode i siden, så konteksten opprettes med `bypass_csp=True` (gjelder bare testverktøyet).

## Feilsøking

**DIAGNOSE-knappen** (eller Skift+F12) viser miljø (nettleser, Web Serial, sikker kontekst), status for hver del av appen, feil, siste serielle feil og en selvtest på 12 punkter. «Kopier rapport» gir en tekst som kan limes inn i en feilmelding. Hvis appen ikke starter, kommer det et rødt banner med hva som mangler.

| Symptom | Årsak og løsning |
|---|---|
| Siden er tom, knappene gjør ingenting | Skriptfiler ble ikke levert. Bruk `start.bat` (flertrådet server), eller åpne `index.html` direkte, og last siden på nytt med Ctrl+Shift+R. (En enkelttrådet server henger når Chrome åpner en tom forbindelse.) |
| «The port is already open» | En gammel forbindelse sitter fast. Last siden på nytt, eller kjør «Nullstill seriellport» i kommandopaletten (Ctrl+K). |
| Ingen svar etter tilkobling | Skiltet er av, eller ledningene løse. Se [hardware.md](hardware.md). |
| Svar med `ff`-bytes | GND-ledningen har falt ut. |
| «Web Serial støttes ikke» | Bruk Chrome eller Edge. |
