import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const COPY_FILES = [
  "src/lib/karepovac.ts",
  "src/components/karepovac/project-components.tsx",
  "src/components/karepovac/karta-kartice.tsx",
  "src/app/karepovac/layout.tsx",
  "src/app/karepovac/page.tsx",
  "src/app/karepovac/ukljuci-se/page.tsx",
  "src/app/karepovac/metodologija/page.tsx",
  "src/app/karepovac/podaci/page.tsx",
  "src/app/karepovac/financije/page.tsx",
  "src/app/karepovac/postaje/page.tsx",
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
  assert.match(
    copyByPath["src/app/karepovac/postaje/page.tsx"],
    /Još nismo postavili nijednu mjernu postaju/,
  );
  assert.match(
    copyByPath["src/app/karepovac/metodologija/page.tsx"],
    /Mjerenja još nisu počela/,
  );
  assert.match(
    copyByPath["src/app/karepovac/podaci/page.tsx"],
    /Uz svaki podatak objavit ćemo kada je i kako izmjeren/,
  );
  assert.match(
    copyByPath["src/app/karepovac/financije/page.tsx"],
    /Novac i troškovi/,
  );
});

test("methodology steps use active plain Croatian", () => {
  const methodology = copyByPath["src/app/karepovac/metodologija/page.tsx"];

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
  assert.match(
    copyByPath["src/components/karepovac/project-components.tsx"],
    /Mjerenja još nisu počela/,
  );
  assert.match(
    copyByPath["src/app/karepovac/page.tsx"],
    /mjerna uređaja planirana za prvi pokusni rad/,
  );
  assert.match(
    copyByPath["src/app/karepovac/page.tsx"],
    /dana planiranog pokusnog rada/,
  );
  assert.match(
    copyByPath["src/app/karepovac/podaci/page.tsx"],
    /Prikazat ćemo vrijeme zadnjeg valjanog mjerenja/,
  );
  assert.match(
    copyByPath["src/app/karepovac/layout.tsx"],
    /Pratite pripremu mjernih postaja, metodologiju, podatke i načine uključivanja/,
  );
});

test("Karepovac paragraphs use at least one rem text", () => {
  assert.doesNotMatch(publicCopy, /<p[^>]*text-(?:xs|sm)\b/);
});
