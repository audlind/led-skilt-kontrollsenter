# Dokumentasjon

Velg det som passer det du vil gjøre.

## Jeg vil bruke skiltet

| Dokument | For deg som … |
|---|---|
| [**Brukermanual**](brukermanual.md) | skal styre skiltet fra kontrollsenteret: koble til, vise tekst, tegne, animere, stille klokken. Med skjermbilder og oppskrifter. **Start her.** |
| [Maskinvare](hardware.md) | skal koble skiltet til PC-en: kretskortet, strøm, kobling med Arduino Uno, signalnivåer |

## Jeg vil forstå hvordan det virker

| Dokument | Innhold |
|---|---|
| [Protokollreferanse](protokoll.md) | Pakkeformat, sjekksum, alle kommandoer, effekter, fonter, farger, norske tegn, grafikkformatet og målte grenser |
| [Animasjonsteknikk](animasjoner.md) | Hvorfor skiltet er mørkt under oppdatering, og hvordan man får blinkefrie animasjoner. Beskrivelse av de ferdige animasjonene. |
| [Funn og avvik](funn-og-avvik.md) | Det som avviker fra databladet, overraskelser og det som er utestet |

## Jeg vil utvikle eller drifte

| Dokument | Innhold |
|---|---|
| [Kontrollsenteret (utvikler)](kontrollsenter.md) | Arkitektur, Web Serial, digital tvilling, testing, feilsøking |
| [Hosting med Firebase](firebase.md) | Automatisk utrulling fra GitHub, sikkerhetsheadere, oppsett steg for steg |

## Oversikt over mappen

```
docs/
├── README.md              denne siden
├── brukermanual.md        brukermanual med skjermbilder
├── hardware.md            maskinvare og kobling
├── protokoll.md           protokollreferanse
├── animasjoner.md         animasjonsteknikk
├── funn-og-avvik.md       avvik fra databladet og utestet
├── kontrollsenter.md      utviklerdokumentasjon for appen
├── firebase.md            hosting og utrulling
└── bilder/
    ├── skjermbilder/      skjermbilder av appen (lages av kontrollsenter/tools/screenshots.py)
    ├── forhandsvisning/   forhåndsvisninger av animasjonene (PNG og GIF)
    └── *.jpg / *.webp     bilder av skiltet, kretskortet og testresultater
```

## Lage skjermbildene på nytt

Skjermbildene i `bilder/skjermbilder/` lages av selve appen i simulatormodus, så de holdes oppdatert når appen endrer seg:

```
pip install playwright                         # bruker Chrome som allerede er installert
python kontrollsenter/serve.py --no-browser    # i ett vindu
python kontrollsenter/tools/screenshots.py     # i et annet
```
