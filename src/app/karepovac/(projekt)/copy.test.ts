import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COPY_FILES = [
  "src/lib/karepovac.ts",
  "src/components/karepovac/project-components.tsx",
  "src/components/karepovac/karta-kartice.tsx",
  "src/app/karepovac/page.tsx",
  "src/app/karepovac/(projekt)/layout.tsx",
  "src/app/karepovac/(projekt)/zrak/page.tsx",
  "src/app/karepovac/(projekt)/ukljuci-se/page.tsx",
  "src/app/karepovac/(projekt)/ukljuci-se/obrazac.tsx",
  "src/lib/ukljuci-se.ts",
  "src/app/karepovac/(projekt)/metodologija/page.tsx",
  "src/app/karepovac/(projekt)/podaci/page.tsx",
  "src/app/karepovac/(projekt)/financije/page.tsx",
  "src/app/karepovac/(projekt)/postaje/page.tsx",
  "src/components/karepovac/sluzbena-mjerenja.tsx",
  "src/app/karepovac/dojava/page.tsx",
  "src/app/karepovac/dojava/obrazac.tsx",
] as const;

const copyByPath = Object.fromEntries(
  COPY_FILES.map((path) => [
    path,
    readFileSync(join(process.cwd(), path), "utf8"),
  ]),
) as Record<(typeof COPY_FILES)[number], string>;

const publicCopy = Object.values(copyByPath).join("\n");

test("Karepovac copy avoids translated and bureaucratic phrases", () => {
  for (const phrase of [
    "Mreža još nema javnih postaja",
    "Pet vrata do javnog podatka",
    "Podaci će dolaziti s objašnjenjem, ne sami",
    "Put do javne mreže",
    "građansk",
    "domaćin postaje",
    "domaćina",
    "mirisni događaj",
    "test na stolu",
    "kvalitativni signal",
    "neovisni ulaz",
    "objavljivi trošak",
    "gruba javna lokacija",
    "podataka uživo",
    "referentni instrument",
    "Verzioniran",
    "čvor",
    "pilot",
    "Prikazuje se vrijeme zadnjeg valjanog uzorka",
  ]) {
    assert.doesNotMatch(publicCopy, new RegExp(phrase, "i"), phrase);
  }
});

test("Karepovac copy states the preparation stage in plain Croatian", () => {
  // Službene postaje na Karepovcu postoje i to se kaže prvo; da naših nema,
  // kaže se odmah zatim, jednako izravno.
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/postaje/page.tsx"],
    /Dvije službene postaje već stoje na Karepovcu/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/postaje/page.tsx"],
    /Naših postaja: nijedna/,
  );
  // „Naša” je nosivo: službena mjerenja jesu počela i stoje na stranici o
  // zraku, pa ova rečenica mora reći čija mjerenja nisu počela.
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/metodologija/page.tsx"],
    /Naša mjerenja još nisu počela/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/podaci/page.tsx"],
    /Uz svaki podatak objavit ćemo kada je i kako izmjeren/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/financije/page.tsx"],
    /Novac i troškovi/,
  );
});

test("methodology steps use active plain Croatian", () => {
  const methodology = copyByPath["src/app/karepovac/(projekt)/metodologija/page.tsx"];

  for (const phrase of [
    "Sastavit ćemo uređaj",
    "Usporedit ćemo uređaje i provjeriti razlike",
    "Usporedit ćemo uređaje s pouzdanim mjerenjem",
    "Zabilježit ćemo inačice ispravaka",
    "Tijekom 30 dana provjeravat ćemo",
  ]) {
    assert.match(methodology, new RegExp(phrase), phrase);
  }
});

test("reviewed wording stays on its intended page", () => {
  // Prije je na perjanici pisalo „Mjerenja još nisu počela”. Otkad su na
  // stranici službena satna mjerenja s Karepovca, to više nije istina; ostaje
  // ono što jest — model daje oblik, ne količinu.
  assert.match(
    copyByPath["src/components/karepovac/karta-kartice.tsx"],
    /Oblik, ne količina/,
  );
  assert.doesNotMatch(
    copyByPath["src/components/karepovac/karta-kartice.tsx"],
    /Mjerenja još nisu počela/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/zrak/page.tsx"],
    /mjerna uređaja planirana za prvi pokusni rad/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/zrak/page.tsx"],
    /dana planiranog pokusnog rada/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/podaci/page.tsx"],
    /Prikazat ćemo vrijeme zadnjeg valjanog mjerenja/,
  );
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/layout.tsx"],
    /Pratite pripremu mjernih postaja, metodologiju, podatke i načine uključivanja/,
  );
});

test("dojava traži sat i ne traži ime", () => {
  const stranica = copyByPath["src/app/karepovac/dojava/page.tsx"];
  const obrazac = copyByPath["src/app/karepovac/dojava/obrazac.tsx"];
  // Bez sata se dojava ne može spojiti s vjetrom, pa to negdje mora pisati —
  // ali ne na samoj stranici za dojavu: ondje obrazac mora stati na zaslon
  // mobitela, pa objašnjenja stoje na pregledu, gdje se čita.
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/zrak/page.tsx"],
    /Sat je ono što\s+dojavu čini upotrebljivom/,
  );
  assert.match(obrazac, /Ne tražimo ni ime ni kontakt/);
  // Ruža od pet dojava izgledala bi kao nalaz, a bila bi slučaj.
  assert.match(stranica, /Za ružu treba barem dvadeset dojava/);
  assert.match(stranica, /to nije neuspjeh nego nalaz/);
});

test("model ne obećava kartu mirisa koju ne može potkrijepiti", () => {
  const zrak = copyByPath["src/app/karepovac/(projekt)/zrak/page.tsx"];
  // Opisi slojeva nastaju u `scripts/izvedi-siru-kartu.py` i putuju kroz
  // generirani modul; provjerava se ono što doista ode pred ljude.
  const karta = readFileSync(
    join(process.cwd(), "src/generated/karepovac-siri.ts"),
    "utf8",
  );
  assert.match(zrak, /Merkaptane, koji dolaze s Karepovca, model ne pogađa/);
  // Karta pokazuje gdje i koliko često, ne koliko smrdi — i to mora pisati
  // uz nju, jer je upravo ta razlika ono što model može potkrijepiti.
  assert.match(zrak, /a ne koliko tada smrdi/);
  assert.match(karta, /najpouzdanije što model daje/);
  assert.match(karta, /model ne pogađa/);
});

test("uključivanje bilježi namjeru bez uplate i imenuje mjesta", () => {
  const stranica = copyByPath["src/app/karepovac/(projekt)/ukljuci-se/page.tsx"];
  const obrazac = copyByPath["src/app/karepovac/(projekt)/ukljuci-se/obrazac.tsx"];

  // Prvi redak kaže što nije otvoreno i što se svejedno može.
  assert.match(stranica, /Prijave i uplate nisu otvorene; namjeru možete javiti već sada/);
  // Obrazac nije uplata; kontakt se ne objavljuje i piše zašto se traži.
  assert.match(obrazac, /Ovo nije uplata ni obveza/);
  assert.match(obrazac, /Kontakt nikad ne objavljujemo/);
  assert.match(obrazac, /Zabilježeno\. Hvala\./);
  // Onesposobljenih gumba više nema: ono što se ne može, piše se rečenicom.
  assert.doesNotMatch(stranica, /disabled/);
  assert.doesNotMatch(stranica, /Prijave još nisu otvorene/);
  // Mjesta se imenuju iz popisa, ne prepisuju.
  assert.match(stranica, /Gdje tražimo mjesto/);
  assert.match(stranica, /Traže dogovor s ustanovom, ne stanovnika/);
  assert.match(stranica, /\?postaja=\$\{s\.id\}/);
  // Datuma nema: „što slijedi” to kaže umjesto da ga izmisli.
  assert.match(stranica, /datuma za njega nemamo/);
  // Popisi obećanja prije otvaranja ostaju od riječi do riječi — jednom,
  // bez omotača koji su ih ponavljali (stranica je bila 11 zaslona).
  assert.match(stranica, /Prije otvaranja prijava objavit ćemo/);
  assert.match(stranica, /Prije otvaranja donacija objavit ćemo/);
  assert.match(stranica, /račune i potvrde koje smijemo javno objaviti/);
  assert.doesNotMatch(stranica, /Ponudite mjesto u vrtu ili na balkonu/);
  assert.doesNotMatch(stranica, /Pomozite nam kupiti i održavati opremu/);
  // Cijene se ne pripisuju #28 ni ovdje.
  assert.doesNotMatch(stranica, /iz popisa #28/);
});

test("novac kaže obje istine: okvirna cijena opreme da, cilj i primatelj ne", () => {
  const financije = copyByPath["src/app/karepovac/(projekt)/financije/page.tsx"];
  assert.match(
    financije,
    /okvirna procjena opreme za\s+predložene postaje na karti simulatora, bez montaže; nije cilj\s+prikupljanja ni ponuda/,
  );
  // #28 je plan s grubljim zbrojevima po fazama, ne izvor brojki po stavci:
  // brojke se ne pripisuju #28, i nema izmišljenih „kataloga”.
  assert.doesNotMatch(financije, /iz popisa #28/);
  assert.doesNotMatch(publicCopy, /katalo/i);
  assert.match(financije, /A 3–6, B 1–2, C 2–10/);
  assert.match(financije, /Ne pokrivaju montažu, umjeravanje, održavanje, vezu ni pričuvu/);
  for (const stanje of ["Nije potvrđen", "Nije utvrđen", "Ne prati se"]) {
    assert.match(financije, new RegExp(stanje), stanje);
  }
  // Pilula od 12 px koja nosi stanje stranice više ne postoji.
  assert.doesNotMatch(financije, /Iznos nije potvrđen/);
  assert.doesNotMatch(financije, /text-xs/);
});

test("postaje imenuju gdje se traži mjesto i ne crtaju ukras", () => {
  const postaje = copyByPath["src/app/karepovac/(projekt)/postaje/page.tsx"];
  assert.match(postaje, /Gdje tražimo mjesto/);
  assert.match(postaje, /Ponudi mjesto/);
  assert.doesNotMatch(postaje, /StationField/);
  // Brojke dolaze iz popisa, ne iz rečenice.
  assert.match(postaje, /PRIJEDLOZI_POSTAJA\.length/);
});

test("Karepovac paragraphs use at least one rem text", () => {
  assert.doesNotMatch(publicCopy, /<p[^>]*text-(?:xs|sm)\b/);
});
