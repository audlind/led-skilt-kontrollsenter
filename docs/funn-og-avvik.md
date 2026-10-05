# Funn, avvik og utestet

Her står det som avviker fra databladet (Amplus protokoll v2.2), det som var overraskende, og det som ikke er prøvd.

## Avvik fra databladet

| Databladet sier | Dette skiltet (REV 1.4A) gjør |
|---|---|
| Ingen `ACK` på broadcast-ID 00 | Svarer `ACK` på ID 00. Skiltets ID er 00, og det svarer ikke på andre ID-er (01, 02, 55 og FF ga ingen respons). |
| `NACK` uten tilleggsdata | `NACK` + ett byte med den **riktige sjekksummen** når sjekksummen er feil. Ukjent kommando eller tomt datafelt gir bare `NACK`. |
| Seriell med vanlige RS-232-nivåer | Linjene er **invertert**: 0 V i hvile. Egen kobling kreves. |
| Grafikkdata beskrevet i en figur (mistet i PDF-en) | Fire 8×8-enheter radvis, 2 byte per rad, se [protokoll.md](protokoll.md). |
| Fargene A–S | Fargekodene med grønt (D, E, F, M) er usynlige på dette røde skiltet. |
| Font D og E for 13 og 8 piksler høyde | Vises avkuttet eller rart på 7 rader. |

## Overraskelser

- **Skiltet er mørkt mens det mottar data.** Se [animasjoner.md](animasjoner.md) for målingene.
- **Kjøresiden `<RPn>` overlever `<D*>`** (databladet sier at «slett alt» fjerner kjøresiden). Etterpå viser skiltet bare den siden.
- **Penn-effektene Q, R og S** skriver faste ord (Hello World, Welcome, Amplus) og ignorerer meldingen.
- **Grafikksiden vises ikke** hvis det står `<AA><CB><N00>` foran grafikkreferansene. Bruk bare `<GA1><GA2><GA3>`.
- **Skiltet godtar ugyldige verdier** uten å klage: sidenavn utenfor A–Z, linje 0–9, kolonne 00–FF, grafikkside Q og blokk 9. `ACK` betyr bare at kommandoen ble godtatt.
- **Klokketekst `<KT> <KD>`** er 14 tegn og 84 kolonner, så siste siffer kuttes ved skjermkanten.
- **Uno-en resettes når serieporten åpnes** (DTR). Første kommando mister ellers pakken.
- **Skiltet viser «LED» og et antennesymbol** når det ikke finnes noen side å vise (trolig standardskjermen).
- **Minnet overlever strømbrudd:** sider, kjøreside og klokke (batteri).

## Utestet

- **Å endre skiltets ID** med `<IDxx>`. Skiltet fungerer med ID 00, så dette er ikke prøvd. Det kan gjøre at skiltet ikke lenger svarer på ID 00.
- **Utlesing av firmwaren** (den sokkelmonterte brikken AM03127-H11 REV 1.4A). Krever en EPROM- eller flash-programmerer.
- **RJ11-kontakten (J31)**: pinnene er ikke målt. Alt i repoet bruker J31A.
- **Strømtrekket** er ikke målt.
- **Dagsvinduer i tidsplaner** (datoene `00/00/00` for å gjenta hver dag, som i databladet) er ikke prøvd. Alle animasjonene bruker en tidsplan som alltid er aktiv.
- **Flere skilt på samme linje** (ID 01–FF og broadcast).
- Andre Amplus-skilt med AM03127: protokollen og grafikkformatet bør være like, men fargekoder, antall rader og blokker kan avvike.

## Kilder

- Amplus, [AM004-03128/03127 LED Display Board Communication v2.2](https://asset.conrad.com/media10/add/160267/c1/-/en/000590998DS01/datasheet-590998-mc-crypt-am03127-h11.pdf) (Conrad-datablad)
- MC CRYPT AM03127-H11 brukermanual (12 V / 2,5 A)
- ambor.com, [Driving a LED panel with a spreadsheet](https://blog.ambor.com/2020/04/driving-led-panel-with-spreadsheet.html): 9600 8N1, RJ11-pinout og sjekksumeksempel for et lignende Amplus-skilt
- Clas Ohlson 36-2070: et annet, mindre skilt med IR-sender og batteri (ikke dette skiltet)
