# Karepovac Croatian Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every public Karepovac page in natural, neighbourly standard Croatian while preserving all technical distinctions and truthful preparation-stage states.

**Architecture:** Keep the current route and component structure. Add one source-level copy contract test that scans the six pages, shared Karepovac components, and the typed copy data for rejected translated phrases and required plain-Croatian statements. Rewrite copy in focused groups without changing layout or behavior.

**Tech Stack:** Next.js 16.2 App Router, React 19 Server Components, TypeScript, Node test runner through `tsx`, Tailwind CSS 4.

## Global Constraints

- Write in standard Croatian with a warm, direct neighbourly voice.
- Speak about the project in first-person plural and address residents politely and directly.
- Prefer short active sentences; one main thought per sentence.
- Keep `H₂S`, `NH₃`, `CSV`, `JSON`, `GeoJSON`, `API`, `LoRa`, and `Wi-Fi` unchanged.
- Preserve the distinction between our measurements, official measurements, and estimates based on wind.
- Never imply that stations, measurements, calibration, a donation recipient, a funding goal, or collected money already exist.
- Do not change layout, components, visual styling, or route URLs.

---

### Task 1: Lock the Croatian voice in a failing test

**Files:**
- Create: `src/app/karepovac/copy.test.ts`
- Modify: `package.json:6-12`

**Interfaces:**
- Consumes: source files containing all public Karepovac copy.
- Produces: a test command that runs both the truth-state tests and the Croatian copy contract.

- [ ] **Step 1: Expand the test command**

Change `package.json` to run both test files explicitly:

```json
"test": "tsx --test src/lib/karepovac.test.ts src/app/karepovac/copy.test.ts"
```

- [ ] **Step 2: Write the failing copy contract**

Create `src/app/karepovac/copy.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COPY_FILES = [
  "src/lib/karepovac.ts",
  "src/components/karepovac/project-components.tsx",
  "src/app/karepovac/layout.tsx",
  "src/app/karepovac/page.tsx",
  "src/app/karepovac/ukljuci-se/page.tsx",
  "src/app/karepovac/metodologija/page.tsx",
  "src/app/karepovac/podaci/page.tsx",
  "src/app/karepovac/financije/page.tsx",
  "src/app/karepovac/postaje/page.tsx",
] as const;

const publicCopy = COPY_FILES.map((path) =>
  readFileSync(join(process.cwd(), path), "utf8"),
).join("\n");

test("Karepovac copy avoids translated and bureaucratic phrases", () => {
  for (const phrase of [
    "Mreža još nema javnih postaja",
    "Pet vrata do javnog podatka",
    "Podaci će dolaziti s objašnjenjem, ne sami",
    "Put do javne mreže",
    "domaćin postaje",
    "domaćina",
    "mirisni događaj",
    "test na stolu",
    "kvalitativni signal",
    "neovisni ulaz",
    "objavljivi trošak",
    "gruba javna lokacija",
  ]) {
    assert.doesNotMatch(publicCopy, new RegExp(phrase, "i"), phrase);
  }
});

test("Karepovac copy states the preparation stage in plain Croatian", () => {
  for (const phrase of [
    "Još nismo postavili nijednu mjernu postaju",
    "Mjerenja još nisu počela",
    "Što provjeravamo prije objave mjerenja",
    "Uz svaki podatak objavit ćemo kada je i kako izmjeren",
    "Novac i troškovi",
  ]) {
    assert.match(publicCopy, new RegExp(phrase), phrase);
  }
});
```

- [ ] **Step 3: Run the test and confirm the expected failure**

Run: `npm test`

Expected: the existing truth-state tests pass; both new copy tests fail on the current translated phrases and missing required phrases.

- [ ] **Step 4: Commit the red test**

```bash
git add package.json src/app/karepovac/copy.test.ts
git commit -m "test: define Croatian voice for Karepovac copy"
```

### Task 2: Rewrite shared labels, phases, and empty states

**Files:**
- Modify: `src/lib/karepovac.ts:1-76`
- Modify: `src/lib/karepovac.test.ts:21-62`
- Modify: `src/components/karepovac/project-components.tsx:45-195`
- Modify: `src/app/karepovac/layout.tsx:4-11`

**Interfaces:**
- Consumes: `KAREPOVAC_NAV`, `KAREPOVAC_DATA_KINDS`, `KAREPOVAC_PHASES`, and `KAREPOVAC_BUDGET_CATEGORIES` used by all pages.
- Produces: shared Croatian labels and descriptions used by navigation, the overview, methodology, and finances pages.

- [ ] **Step 1: Update the expected shared labels**

Add these assertions to `src/lib/karepovac.test.ts`:

```ts
assert.equal(KAREPOVAC_NAV[4]?.label, "Novac i troškovi");
assert.equal(KAREPOVAC_DATA_KINDS[0]?.label, "Izmjereno na našoj postaji");
assert.equal(KAREPOVAC_PHASES[0]?.title, "Dogovor o projektu");
assert.equal(KAREPOVAC_PHASES.at(-1)?.title, "Objava mjerenja");
```

Run: `npm test`

Expected: FAIL because the current labels are `Financije`, `Izmjereno na postaji građanske mreže`, `Dogovor i izvedivost`, and `Javna mjerenja`.

- [ ] **Step 2: Rewrite the typed shared copy**

Use these exact labels and meanings in `src/lib/karepovac.ts`:

| Current | Replacement |
| --- | --- |
| `Financije` | `Novac i troškovi` |
| `Izmjereno na postaji građanske mreže` | `Izmjereno na našoj postaji` |
| `Dogovor i izvedivost` | `Dogovor o projektu` |
| `Nabava i test na stolu` | `Nabava i početna provjera` |
| `Mreža u vrtovima i na balkonima` | `Pokusni rad u kvartu` |
| `Javna mjerenja` | `Objava mjerenja` |
| `otvorene podatke` | `podatke za preuzimanje` |
| `H₂S i odabrani senzorski moduli` | `Senzori za H₂S i druga odabrana mjerenja` |
| `Upravljači i komunikacija` | `Upravljačka elektronika i prijenos podataka` |
| `Povezivost i hosting` | `Veza s postajama i rad mrežne stranice` |

Use these phase descriptions exactly:

```text
Dogovor o projektu — Odredit ćemo tko vodi projekt i tko smije primati donacije. Dogovorit ćemo kako čuvamo podatke stanovnika i možemo li senzore usporediti s pouzdanim mjerenjem.
Nabava i početna provjera — Sastavit ćemo najmanje tri jednaka mjerna uređaja. Prije postavljanja provjerit ćemo rade li stabilno, šalju li podatke i štite li ih kućišta od vremenskih uvjeta.
Usporedba i umjeravanje — Uređaji će neko vrijeme raditi jedni uz druge i uspoređivat ćemo ih s pouzdanim mjerenjem. Tek tada ćemo znati koje vrijednosti smijemo objaviti.
Pokusni rad u kvartu — Postavit ćemo uređaje na odabrana mjesta i 30 dana pratiti rade li redovito, možemo li ih održavati i jesu li podaci stanovnika zaštićeni.
Objava mjerenja — Objavit ćemo provjerena mjerenja, stanje svake postaje i podatke za preuzimanje. Procjenu smjera širenja prema vjetru prikazat ćemo odvojeno.
```

- [ ] **Step 3: Rewrite shared empty states and evidence descriptions**

In `project-components.tsx`, use these exact public statements:

```text
Još nismo postavili nijednu postaju pa nema ni naših mjerenja. Ovdje ćemo objaviti rezultate tek kada provjerimo uređaje i način mjerenja.
Mjerenja još nisu počela
Smjer širenja još ne procjenjujemo
Prikaz ostaje prazan dok ne dobijemo provjerena mjerenja.
```

Describe the three source types as:

```text
Vrijednost izmjerena na pojedinoj postaji, uz vrijeme mjerenja i oznaku pouzdanosti.
Podatak koji je objavilo nadležno tijelo, uz vrijeme objave i poveznicu na izvor.
Procjena izrađena iz smjera i brzine vjetra, jasno odvojena od mjerenja.
```

Set the shared route metadata description in `layout.tsx` to:

```text
Pripremamo mrežu mjernih postaja za praćenje sumporovodika, pojava neugodnog mirisa te smjera i brzine vjetra oko Karepovca.
```

- [ ] **Step 4: Run the shared tests**

Run: `npm test`

Expected: the typed shared-label assertions pass; the source-wide copy test still fails on page-specific phrases handled in Tasks 3–5.

- [ ] **Step 5: Commit the shared rewrite**

```bash
git add src/lib/karepovac.ts src/lib/karepovac.test.ts src/components/karepovac/project-components.tsx
git commit -m "copy: rewrite shared Karepovac language"
```

### Task 3: Rewrite the overview and participation pages

**Files:**
- Modify: `src/app/karepovac/page.tsx:14-151`
- Modify: `src/app/karepovac/ukljuci-se/page.tsx:7-101`

**Interfaces:**
- Consumes: shared labels and phase descriptions from Task 2.
- Produces: the primary project explanation and all public participation copy.

- [ ] **Step 1: Rewrite the overview page**

Apply these headline and section replacements:

| Current | Replacement |
| --- | --- |
| `Gradimo malu građansku mrežu...` | `Postavit ćemo nekoliko mjernih postaja oko Karepovca. Njihova ćemo mjerenja uspoređivati s pojavama neugodnog mirisa te sa smjerom i brzinom vjetra.` |
| `Pogledajte kako se uključiti` | `Kako se mogu uključiti` |
| `Danas nema podataka za prikaz` | `Danas još nemamo vlastita mjerenja` |
| `Što već možemo reći` | `Što je već dogovoreno` |
| `Tri zapisa koja se ne smiju zamijeniti` | `Kako ćemo razlikovati podatke` |
| `Put do javne mreže` | `Što moramo napraviti prije početka mjerenja` |
| `Mrežu neće izgraditi jedna kutija na krovu.` | `Za pouzdanu sliku treba nam više postaja.` |
| `Kako mogu pomoći?` | `Pogledajte kako možete pomoći` |

Rewrite supporting sentences in first-person plural. Say `najmanje tri jednaka mjerna uređaja`, `pojava neugodnog mirisa`, and `objavit ćemo` instead of `mreža će`, `mirisni događaj`, and infinitive-led bureaucratic sentences.

Use this exact supporting copy:

```text
Mjerenja ćemo objaviti tek nakon što uređaje usporedimo, umjerimo i provjerimo. Smjer širenja počet ćemo procjenjivati tek kada budemo imali pouzdan podatak o vjetru i valjana mjerenja.

Za početak planiramo najmanje tri jednaka mjerna uređaja i pouzdan lokalni podatak o vjetru.
Amonijak (NH₃) dodat ćemo samo ako se tijekom usporedbe pokaže da ga odabrani senzor može pouzdano pratiti pri niskim koncentracijama.
Naša će mjerenja biti orijentacijska. Neće zamijeniti službena ni sigurnosna mjerenja.

Na karti i grafikonima jasno ćemo označiti odakle svaki podatak dolazi. Procjenu na temelju vjetra nećemo prikazivati kao da je riječ o mjerenju.

Za pouzdaniju sliku trebaju nam dobro raspoređene postaje, provjerena oprema i redovito održavanje. Javno ćemo objaviti i koliko je novca prikupljeno te na što je potrošen.
```

- [ ] **Step 2: Rewrite the participation page**

Use these headings:

```text
Pomozite nam postaviti prve mjerne postaje
Ponudite mjesto u vrtu ili na balkonu
Prije otvaranja prijava objavit ćemo
Pomozite nam kupiti i održavati opremu
Prije otvaranja donacija objavit ćemo
Kako možete pomoći već sada
```

Replace `domaćin postaje` with `stanovnik koji će ustupiti mjesto za postaju`. Replace `zakoniti primatelj` with the direct explanation `tko smije primati uplate`. Buttons must read `Prijave još nisu otvorene` and `Donacije još nisu otvorene`.

Use these exact paragraphs and list items:

```text
Tražit ćemo stanovnike koji mogu ustupiti mjesto za postaju, ljude koji se razumiju u opremu i one koji žele pomoći donacijom. Prijave i uplate još nisu otvorene. Prvo moramo objaviti tko vodi projekt, kako čuvamo osobne podatke i kako ćemo prikazivati troškove.

Mjesto treba imati sigurno napajanje, podatkovnu vezu, slobodno strujanje zraka i pristup radi održavanja. Kućnu adresu i kontakt nećemo javno objaviti.

obavijest o tome koje podatke prikupljamo i zašto;
dogovor o pristupu postaji, vlasništvu opreme i uklanjanju postaje;
pravila prema kojima ćemo birati mjesta i prikazivati približne lokacije.

Poveznicu za donacije objavit ćemo tek kada bude jasno tko smije primati uplate, koliko želimo prikupiti i kako ćemo prikazati svaki trošak.

koliko želimo prikupiti i što ćemo tim novcem platiti;
što je naručeno, što je plaćeno i koliko je novca ostalo;
račune i potvrde koje smijemo javno objaviti.

Već sada možete pomoći znanjem o senzorima, elektronici, LoRa ili Wi-Fi vezi, kućištima za vanjsku uporabu, vremenskim podacima, obradi mjerenja i održavanju opreme.
```

Set the participation-page metadata description to:

```text
Saznajte kako možete ponuditi mjesto za mjernu postaju, pomoći znanjem ili pratiti pripremu donacija za opremu.
```

- [ ] **Step 3: Run the copy contract**

Run: `npm test`

Expected: overview and participation phrases pass; failures remain only in methodology, data, finances, or station files.

- [ ] **Step 4: Commit the two-page rewrite**

```bash
git add src/app/karepovac/page.tsx src/app/karepovac/ukljuci-se/page.tsx
git commit -m "copy: rewrite Karepovac overview and participation"
```

### Task 4: Rewrite methodology and data pages

**Files:**
- Modify: `src/app/karepovac/metodologija/page.tsx:7-84`
- Modify: `src/app/karepovac/podaci/page.tsx:7-89`

**Interfaces:**
- Consumes: shared source-type labels and evidence descriptions from Task 2.
- Produces: plain-Croatian explanations of sensor checks, measurement quality, downloads, and missing data.

- [ ] **Step 1: Rewrite the methodology page**

Use `Što provjeravamo prije objave mjerenja` as the page title. Replace `Pet vrata do javnog podatka` with `Kako provjeravamo uređaje` and rename the five steps:

```text
Sastavljanje
Zajednička provjera
Usporedba
Ispravci
Pokusni rad
```

Replace `mirisni otisak` in explanatory prose with `promjene povezane s neugodnim mirisom`; retain it only in the term row, written `Pokazatelj neugodnog mirisa`. Replace `kvalitativni signal` with `pokazatelj pojave ili promjene` and `neovisni ulaz` with `zaseban podatak`.

Use this exact explanatory copy:

```text
Jeftini senzori ne reagiraju samo na plin koji želimo pratiti. Na njih utječu temperatura, vlaga, drugi plinovi i vrijeme uporabe. Zato mjerenja nećemo objaviti čim uključimo uređaj.

U početku želimo pratiti sumporovodik (H₂S). Promjene povezane s neugodnim mirisom možemo pratiti dodatnim senzorima, ali iz njih nećemo zaključivati o pojedinom plinu. Amonijak (NH₃) dodat ćemo samo ako se senzor pokaže dovoljno pouzdanim.

H₂S — Glavni plin u prvom pokusnom radu. Vrijednost ćemo objaviti samo uz provjeren ispravak i oznaku pouzdanosti.
Pokazatelj neugodnog mirisa — Može upozoriti na pojavu ili promjenu mirisa, ali ne pokazuje koji je plin prisutan.
NH₃ — Dodat ćemo ga samo ako usporedna mjerenja pokažu da ga odabrani senzor može korisno pratiti pri očekivanim niskim koncentracijama.
Vjetar — Smjer i brzina vjetra zaseban su podatak za procjenu mogućeg smjera širenja. Njime nećemo popunjavati mjesta na kojima nema mjerenja.

Svaki uređaj proći će isti postupak. Ako se u nekom koraku pokaže nepouzdanim, to ćemo jasno navesti umjesto da podatke uljepšavamo.
```

Set the methodology-page metadata description to:

```text
Objašnjavamo kako ćemo provjeravati senzore, ocjenjivati pouzdanost mjerenja i prikazivati njihova ograničenja.
```

- [ ] **Step 2: Rewrite the data page**

Use these headings and statements:

```text
Uz svaki podatak objavit ćemo kada je i kako izmjeren
Što ćemo objaviti uz svako mjerenje
Datoteke za preuzimanje
Kad mjerenje nedostaje
Primjer jasne obavijesti
Nema valjanog mjerenja
```

Replace `shema` with `opis podataka`, `sirovi uzorci` with `izvorna mjerenja`, `stručna analiza` with `podrobnija analiza`, `trenutni sažetak` with `pregled trenutačnog stanja`, and `gruba javna lokacija` with `približna lokacija koja ne otkriva adresu`.

Use this exact explanatory copy:

```text
Uz svako mjerenje navest ćemo gdje je nastalo, kada je zadnji put bilo valjano, kako smo ga obradili i s kojim se podacima smije uspoređivati. Dok te informacije nisu spremne, nećemo nuditi ni datoteke za preuzimanje.

Vrijeme — vrijeme mjerenja, vrijeme primitka i vrijeme zadnjeg valjanog mjerenja
Vrijednost — izvorna i ispravljena vrijednost, mjerna jedinica i razdoblje koje prikazuje
Pouzdanost — valjano, privremeno, sumnjivo, nevaljano, zastarjelo ili održavanje
Uređaj — oznaka postaje, vrsta senzora te inačica programa i ispravka
Uvjeti — temperatura i vlaga koje mogu utjecati na senzor
Lokacija — približna lokacija koja ne otkriva kućnu adresu

Nakon provjere objavit ćemo satne vrijednosti za jednostavnu uporabu. Izvorna mjerenja s oznakama pouzdanosti bit će dostupna za podrobniju analizu.

Licencu, opis podataka, API i raspored osvježavanja objavit ćemo prije prvog skupa podataka.

Postaja koja se prestala javljati ostat će vidljiva, ali njezine podatke nećemo uključiti u pregled trenutačnog stanja ni u procjenu širenja. Mjesto bez mjerenja ostat će prazno.
```

Set the data-page metadata description to:

```text
Saznajte koje ćemo podatke objavljivati uz svako mjerenje, kako ćemo označavati njihovu pouzdanost i u kojim će se datotekama moći preuzeti.
```

- [ ] **Step 3: Run the copy contract**

Run: `npm test`

Expected: methodology and data phrases pass; any remaining copy failures point only to the finances or stations page.

- [ ] **Step 4: Commit the technical-page rewrite**

```bash
git add src/app/karepovac/metodologija/page.tsx src/app/karepovac/podaci/page.tsx
git commit -m "copy: clarify Karepovac measurement and data pages"
```

### Task 5: Rewrite money and station pages

**Files:**
- Modify: `src/app/karepovac/financije/page.tsx:7-94`
- Modify: `src/app/karepovac/postaje/page.tsx:7-100`

**Interfaces:**
- Consumes: `Novac i troškovi` navigation label and budget labels from Task 2.
- Produces: plain explanations of donations, spending, station siting, and location privacy.

- [ ] **Step 1: Rewrite the money page**

Set metadata title to `Novac i troškovi`. Use these visible headings:

```text
Objavit ćemo koliko je novca prikupljeno i na što je potrošen
Što moramo platiti
Pregled uplata i troškova
Još nema troškova
```

Replace `Primatelj uplata` with `Tko prima uplate`, `Cilj prikupljanja` with `Koliko želimo prikupiti`, `Prikupljeno` with `Koliko je prikupljeno`, `objavljivi trošak` with `trošak koji smijemo javno prikazati`, and `evidentiranih troškova` with `zabilježenih troškova`.

Use this exact supporting copy:

```text
Još nisu potvrđeni iznos koji želimo prikupiti, cijene opreme ni osoba ili organizacija koja smije primati uplate. Zato ne prikazujemo izmišljeni cilj ni napredak prikupljanja.

Iznose ćemo objaviti nakon što provjerimo cijene, potrebne količine, trošak umjeravanja i kasnijeg održavanja. Nije dovoljno navesti samo cijenu senzora.

Kada donacije budu otvorene, uz svaki trošak koji smijemo javno prikazati navest ćemo datum, svrhu, skupinu troška, iznos i pripadajući dokument. Imena donatora nećemo objavljivati bez njihove posebne privole.

Još nema zabilježenih troškova. Pregled ćemo početi voditi kada bude poznato tko vodi projekt i kada proračun bude odobren.
```

Set the money-page metadata description to:

```text
Ovdje ćemo objaviti koliko je novca prikupljeno, što je kupljeno i koliko je novca preostalo.
```

- [ ] **Step 2: Rewrite the stations page**

Use these headings:

```text
Još nismo postavili nijednu mjernu postaju
0 postavljenih postaja
Kako biramo mjesta za postaje
Adresa i kontakt ostaju privatni
```

Replace `Ne pobjeđuje prva prijava` with `Mjesta nećemo birati samo po redoslijedu prijava.` Replace `upwind/downwind pokrivenost` with `raspored s obje strane najčešćih smjerova vjetra`, `grubu ili pomaknutu lokaciju` with `približnu lokaciju`, and `domaćin` with `stanovnik koji je ustupio mjesto`.

Use this exact supporting copy:

```text
Nećemo prikazivati izmišljene oznake ni točke samo da bi karta izgledala popunjeno. Postaju ćemo dodati tek nakon što sastavimo i provjerimo uređaj, odaberemo mjesto i dogovorimo se sa stanovnikom koji ga ustupa.

Trenutačno nemamo nijednu postavljenu postaju. Za prvi pokusni rad trebaju nam najmanje tri provjerena uređaja, raspoređena tako da mjere s različitih strana Karepovca.

Mjesta nećemo birati samo po redoslijedu prijava. Postaje zajedno moraju pomoći razlikovati pojavu iz smjera Karepovca od izvora u neposrednoj blizini.

Položaj — Raspored s obje strane najčešćih smjerova vjetra.
Strujanje zraka — Otvoreno mjesto, odmaknuto od zidova i neposrednih izvora dima ili mirisa.
Uvjeti za rad — Sigurno napajanje, podatkovna veza i pristup radi održavanja.
Dogovor — Stanovnik nam može javiti promjenu uvjeta, prekid rada ili da želi ukloniti postaju.

Na karti ćemo prikazati samo približnu lokaciju. Ime, kontakt, kućna adresa, upute za pristup i točne koordinate bit će dostupni samo ljudima koji održavaju postaju.
```

Set the stations-page metadata description to:

```text
Pratite koje su mjerne postaje postavljene, kako biramo njihova mjesta i kako štitimo adresu i kontakt stanovnika.
```

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: PASS for the truth-state tests, shared-label assertions, rejected-phrase scan, and required-phrase scan.

- [ ] **Step 4: Commit the final page-copy group**

```bash
git add src/app/karepovac/financije/page.tsx src/app/karepovac/postaje/page.tsx
git commit -m "copy: rewrite Karepovac money and station pages"
```

### Task 6: Read aloud, inspect mobile copy, and verify the build

**Files:**
- Test: all files changed in Tasks 1–5

**Interfaces:**
- Consumes: completed copy rewrite.
- Produces: verified pages with natural Croatian, unchanged facts, and no mobile overflow.

- [ ] **Step 1: Search for rejected wording and inconsistent labels**

Run:

```bash
rg -n -i "građanska mreža|javna mreža|domaćin|mirisni događaj|test na stolu|kvalitativni signal|neovisni ulaz|objavljivi trošak|gruba javna lokacija|Financije" src/app/karepovac src/components/karepovac src/lib/karepovac.ts
```

Expected: no user-facing matches. A technical comment may remain only if it is not rendered.

- [ ] **Step 2: Run automated verification**

Run:

```bash
npm test
npm run lint
DATABASE_URL=postgresql://build:build@127.0.0.1:1/build npm run build
```

Expected: all tests pass, lint exits with no errors, and all six `/karepovac` routes appear as static routes in the successful build output.

- [ ] **Step 3: Inspect the rewritten pages at phone and desktop widths**

Run the local server on port `3011`. Open all six routes at `390×844` and the overview at `1450×903`. Confirm:

- all six navigation labels fit;
- headings wrap without clipping;
- buttons retain 44px touch targets;
- no paragraph becomes smaller than 1rem;
- every page says plainly what does not yet exist;
- `Novac i troškovi` is used consistently in navigation, metadata, and the page heading.

- [ ] **Step 4: Perform the final Croatian read-through**

Read every visible sentence aloud in page order. Reject any sentence that lacks a clear actor, carries more than one main thought, or needs the English phrasing to sound natural. Re-run `npm test` after any final wording change.

- [ ] **Step 5: Commit verification fixes if any**

```bash
git add src/app/karepovac src/components/karepovac src/lib/karepovac.ts src/lib/karepovac.test.ts package.json
git commit -m "copy: polish Croatian Karepovac text"
```

Skip this commit only when Step 3 and Step 4 require no changes.
