# Hosting og automatisk utrulling med Firebase

Kontrollsenteret er en statisk webapp (ren HTML, CSS og JavaScript, ingen bygging), så den passer rett inn i **Firebase Hosting**. Siden er servert over HTTPS, noe Web Serial krever, og tilkoblingen til skiltet går fra besøkendes egen nettleser til deres egen USB-port. Selve skiltet blir aldri eksponert på nett.

## Hvordan utrullingen fungerer

Firebase Hosting henter ikke filer fra GitHub selv. I stedet ruller en **GitHub Action** ut ved hver endring:

```
push til main  →  GitHub Actions: protokolltest  →  FirebaseExtended/action-hosting-deploy  →  Firebase Hosting (live)
pull request   →  GitHub Actions: forhåndsutrulling på en midlertidig adresse
```

Alt som trengs ligger allerede i repoet:

| Fil | Hva |
|---|---|
| `firebase.json` | Hosting-konfigurasjon: publiserer mappen `kontrollsenter/`, hopper over utviklerfiler (`tools/`, `serve.py`, `start.bat`, `README.md`), og setter sikkerhets- og mellomlagringsheadere |
| `.github/workflows/firebase-hosting-merge.yml` | Kjører protokolltesten og ruller ut til live når `main` endres |
| `.github/workflows/firebase-hosting-pull-request.yml` | Lager en forhåndsadresse for hver pull request |

Workflowene **hoppes over** (ikke feiler) til du har satt opp de to verdiene under, så det er trygt at de ligger i repoet allerede.

## Slik kobler du det til (fire steg)

### 1. Lag et Firebase-prosjekt

1. Gå til [console.firebase.google.com](https://console.firebase.google.com) og lag et prosjekt (Analytics kan du hoppe over).
2. Åpne **Build → Hosting** og trykk «Kom i gang». Du trenger ikke kjøre kommandoene den foreslår.
3. Noter **prosjekt-ID-en** (for eksempel `led-skilt-1234`).

### 2. Lag en tjenestekonto GitHub kan bruke

I [Google Cloud Console](https://console.cloud.google.com) for samme prosjekt:

1. **IAM og administrasjon → Tjenestekontoer → Opprett tjenestekonto**, for eksempel `github-deploy`.
2. Gi den rollen **Firebase Hosting Admin**. (Hvis utrullingen senere feiler med manglende tillatelser, legg også til **API Keys Viewer** og **Service Usage Consumer**.)
3. Åpne kontoen → **Nøkler → Legg til nøkkel → Opprett ny nøkkel → JSON**. Filen lastes ned. **Behandle den som et passord og ikke legg den i repoet** (repoet er offentlig).

### 3. Legg verdiene inn i GitHub

Med GitHub CLI (du er allerede innlogget som `audlind`):

```
gh secret set FIREBASE_SERVICE_ACCOUNT --repo audlind/led-skilt-kontrollsenter < nøkkelfil.json
gh variable set FIREBASE_PROJECT_ID --repo audlind/led-skilt-kontrollsenter --body "led-skilt-1234"
```

Eller i nettleseren: repoet → **Settings → Secrets and variables → Actions** → hemmelighet `FIREBASE_SERVICE_ACCOUNT` (hele JSON-innholdet) og variabel `FIREBASE_PROJECT_ID`.

Slett deretter nøkkelfilen fra maskinen din.

### 4. Rull ut

Push til `main` (eller kjør workflowen manuelt fra Actions-fanen). Etter et minutt ligger appen på `https://<prosjekt-ID>.web.app`.

> **Alternativ:** `firebase init hosting:github` setter opp tjenestekonto og hemmelighet automatisk, men skriver også sine egne workflowfiler med samme navn som våre. Velg «nei» til byggesteg, og gjenopprett våre filer med `git checkout` etterpå hvis du vil beholde protokolltesten foran utrullingen.

## Hva `firebase.json` gjør

- **`public: "kontrollsenter"`** er det eneste som publiseres.
- **`ignore`** holder `tools/` (testdata og skript), `serve.py`, `start.bat` og README utenfor den publiserte siden.
- **`Cache-Control: no-cache`** på HTML, JS og CSS betyr at nettleseren sjekker for ny versjon (via ETag) hver gang. Uten dette kan Firebases standard (1 time) vise gammel kode etter en utrulling.
- **`Content-Security-Policy`** er streng: bare skript og stiler fra samme opphav, ingen eksterne ressurser, ingen innebygde skript, ingen innramming. Appen kjører uten brudd på den (verifisert).
- **`Permissions-Policy: serial=(self)`** tillater Web Serial for siden, og slår av kamera, mikrofon og posisjon.
- **`X-Content-Type-Options`, `Referrer-Policy`** er vanlige hardening-headere.

## Test lokalt med de samme headerne

`kontrollsenter/serve.py` leser headerne fra `firebase.json` og sender nøyaktig de samme som Firebase vil:

```
cd kontrollsenter
python serve.py
```

Hvis du endrer sikkerhetspolicyen og noe slutter å virke, ser du det i nettleserens konsoll (og i **DIAGNOSE**) lokalt før du ruller ut.

## Vanlige spørsmål

**Kan andre bruke appen på nettstedet?** Ja, men den kobler bare til skilt som er koblet til *deres egen* maskin via Uno-broen. Det er ingen server og ingen kommunikasjon via nettet.

**Må besøkende bruke Chrome eller Edge?** Ja. Web Serial finnes ikke i Firefox og Safari. Simulatoren fungerer overalt.

**Egen domene?** Firebase Console → Hosting → «Legg til tilpasset domene».

**Rulle tilbake?** Firebase Console → Hosting → Utgivelseshistorikk → «Rull tilbake» på en tidligere versjon.

**Koster det noe?** Gratisplanen (Spark) dekker lagring og trafikk til en liten app som denne (ca. 0,3 MB) med god margin.
