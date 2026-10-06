# LED-skilt kontrollsenter

> **Bruker du appen?** Se [brukermanualen](../docs/brukermanual.md). Denne filen er for den som utvikler den.

Webapp (ren HTML/CSS/JavaScript, ingen bygging) som styrer Clas Ohlson 36-2071 / Amplus AM03127-H11 via Arduino Uno-broen.

## Start

1. Koble som i manualen (Uno pin 2 ← skiltets TX, pin 3 → skiltets RX, GND, 12 V på skiltet) og last `arduino/bridge_inv/bridge_inv.ino` til Uno-en.
2. Dobbeltklikk `start.bat` (eller `python serve.py`). Chrome/Edge åpnes på `http://localhost:8765`.
3. Trykk **KOBLE TIL SKILT** og velg Arduino Uno. Appen sender en kontakttest og sier fra hvis skiltet ikke svarer.
4. **SIMULATOR** lar deg prøve alt uten skilt. Den digitale tvillingen på skjermen viser det skiltet ville vist.

Krever Chrome eller Edge (Web Serial). Firefox og Safari støtter det ikke.

`serve.py` sender de samme HTTP-headerne som Firebase Hosting (leses fra `../firebase.json`), så du kan teste sikkerhetspolicyen lokalt. Hosting og automatisk utrulling: se [../docs/firebase.md](../docs/firebase.md).

## Feilsøking

Siden er tom, eller knappene gjør ingenting:

1. Lukk et gammelt serververvindu (Ctrl+C) og kjør `start.bat` på nytt. (Den første versjonen av serveren var enkelttrådet og kunne henge når Chrome åpnet flere forbindelser. Nå er den flertrådet og tar neste ledige port hvis 8765 er opptatt.)
2. Last siden på nytt uten mellomlager: Ctrl+Shift+R.
3. Alternativ: åpne `index.html` direkte (dobbeltklikk). Web Serial virker også fra fil i Chrome/Edge.
4. Trykk **DIAGNOSE** (eller Skift+F12). Der ser du miljø, status for hver del, feil og en selvtest. **Kopier rapport** gir en tekst som kan limes inn i en feilmelding.

Hvis appen ikke starter i det hele tatt, kommer det et rødt banner øverst som sier hva som mangler.

Ingen svar fra skiltet etter tilkobling: sjekk 12 V på skiltet, pin 2 og 3 mot TX og RX, GND, og at RESET-jumperen ikke sitter på. Svar som bare består av `ff`-bytes betyr løs GND.

## Faner

- **TEKST**: alle effekter, hastigheter, fonter, farger og norske tegn. Viser pakken og kostnaden i byte.
- **TEGN**: pikselstudio. Tegn rett på skiltet. Penn, linje, rektangel, fyll, flytt, speil, forskyv, tekststempel, bildeimport.
- **ANIMASJON**: bibliotek (forhåndsvis, rediger, last opp), tidslinje med onion skin, generatorer, opplasting, eksport/import.
- **SYSTEM**: lysstyrke, klokkesynk, sletting, kjøreside, tidsplanbygger, tester, avansert.
- **REFERANSE**: tabeller og regler.

Høyre side: instrumenter (inkludert *display duty*) og pakkemonitor med hex og pakkeoppbygging.

## Filer

- `js/protocol.js` pakker, sjekksum, grafikkblokker, animasjonsplan (testet mot Python: `node tools/test_protocol.js`)
- `js/link.js` Web Serial og simulator
- `js/twin.js` digital tvilling (minne og avspilling)
- `js/presets.js` ferdige animasjoner, generert av `tools/export_presets.py`

## Test

```
python tools/dump_expected.py
node tools/test_protocol.js
```
