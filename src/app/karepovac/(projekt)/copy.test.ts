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
  "src/app/karepovac/(projekt)/metodologija/page.tsx",
  "src/app/karepovac/(projekt)/podaci/page.tsx",
  "src/app/karepovac/(projekt)/financije/page.tsx",
  "src/app/karepovac/(projekt)/postaje/page.tsx",
  "src/components/karepovac/sluzbena-mjerenja.tsx",
  "src/app/karepovac/(projekt)/dojava/page.tsx",
  "src/app/karepovac/(projekt)/dojava/obrazac.tsx",
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
  assert.match(
    copyByPath["src/app/karepovac/(projekt)/metodologija/page.tsx"],
    /Mjerenja još nisu počela/,
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
  const stranica = copyByPath["src/app/karepovac/(projekt)/dojava/page.tsx"];
  const obrazac = copyByPath["src/app/karepovac/(projekt)/dojava/obrazac.tsx"];
  // Bez sata se dojava ne može spojiti s vjetrom, pa se to i traži naglas.
  assert.match(obrazac, /Sat je ono što dojavu čini upotrebljivom/);
  assert.match(obrazac, /Ne tražimo ni ime ni kontakt/);
  // Ruža od pet dojava izgledala bi kao nalaz, a bila bi slučaj.
  assert.match(stranica, /Za ružu treba barem dvadeset dojava/);
  assert.match(stranica, /to nije neuspjeh nego nalaz/);
});

test("model ne obećava kartu mirisa koju ne može potkrijepiti", () => {
  const zrak = copyByPath["src/app/karepovac/(projekt)/zrak/page.tsx"];
  assert.match(zrak, /Zato ovdje nema karte mirisa/);
  assert.match(zrak, /Merkaptane, koji dolaze s Karepovca, model ne pogađa/);
});

test("Karepovac paragraphs use at least one rem text", () => {
  assert.doesNotMatch(publicCopy, /<p[^>]*text-(?:xs|sm)\b/);
});
