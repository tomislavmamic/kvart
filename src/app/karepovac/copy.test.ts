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
