import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { OSNOVE_DIMA } from "../src/generated/karepovac-polje";

const RASPRSENJE = readFileSync("scripts/izvedi-raspesenje.py", "utf8");
const OBLACICI = readFileSync("scripts/oblacici.py", "utf8");
const BAZDARENJE = readFileSync("scripts/bazdari-izvor.py", "utf8");

test("jačina izvora dolazi iz mjerenja, ne iz pretpostavke", () => {
  // Prije je u skripti stajao TOK = 3.0 ouE/m²/s iz literature i sve je s njim
  // skaliralo pravocrtno. Sad se čita iz bazdarenja, koje nosi i raspon.
  assert.doesNotMatch(RASPRSENJE, /^TOK = /m, "tok se više ne pretpostavlja");
  assert.match(RASPRSENJE, /karepovac-bazdarenje\.ts/);
  assert.match(RASPRSENJE, /emisijaUgS/);
});

test("poklopac graničnog sloja diže koncentraciju, ne spušta je", () => {
  // Ovo je bila greška u predznaku: s `minimum` je plitka inverzija
  // *razrjeđivala* miris, dakle točno obrnuto od onoga što radi u prirodi.
  assert.match(
    OBLACICI,
    /f_z = np\.maximum\(\s*2\.0 \/ \(math\.sqrt\(2 \* math\.pi\) \* sig_z\), 1\.0 \/ dubina\s*\)/,
  );
});

test("model se ocjenjuje i na tvarima koje nisu s odlagališta", () => {
  // Ozon i ugljikov monoksid ne dolaze s Karepovca. Ako model pogađa njih, a
  // ne pogađa merkaptane, ne valja pretpostavka o izvoru — a ne fizika.
  assert.match(BAZDARENJE, /Ozon \(O3\)/);
  assert.match(BAZDARENJE, /Ugljikov monoksid \(CO\)/);
  assert.match(BAZDARENJE, /metil\+etilmerkaptan/);
});

test("skripte priznaju što im nedostaje", () => {
  for (const rupa of ["Baklja", "CORINE", "dvodimenzionalno"]) {
    assert.ok(
      OBLACICI.includes(rupa),
      `zaglavlje modela mora spomenuti ograničenje: ${rupa}`,
    );
  }
  assert.ok(
    RASPRSENJE.includes("ne smije predstaviti kao karta mirisa"),
    "godišnja slika mora reći da nije karta mirisa",
  );
});

test("brojke iz modela ne izlaze pred ljude kao mjerenje", () => {
  const izvor = readFileSync(
    "src/components/karepovac/karta-kartice.tsx",
    "utf8",
  );
  assert.doesNotMatch(izvor, /raspesenje/);
});

test("granica debljine sloja stoji na jednom mjestu", () => {
  // Dvije kopije istog računa dugo su nosile dvije različite granice — 10 m u
  // generatoru polja za preglednik, 25 m u računu raspršenja. Ništa nije
  // pucalo; polja su samo bila različita.
  const skripte = readdirSync("scripts").filter((f) => f.endsWith(".py"));
  const drze = skripte.filter((f) =>
    /^NAJTANJI_SLOJ\s*=/m.test(readFileSync(join("scripts", f), "utf8")),
  );
  assert.deepEqual(drze, ["reljef_polje.py"], "granica se definira drugdje");
});

test("generator polja ne drži vlastitu kopiju računa", () => {
  const generator = readFileSync("scripts/izvedi-polje-dima.py", "utf8");
  assert.match(generator, /from reljef_polje import \(/);
  for (const ime of ["polje_vjetra", "ucitaj_reljef", "gladi", "maska_plohe"]) {
    assert.doesNotMatch(
      generator,
      new RegExp(`^def ${ime}\\b`, "m"),
      `${ime} se ponovno definira umjesto da se uveze`,
    );
  }
});

test("predmemorija polja vjetra pamti i granicu", () => {
  // Bez granice u imenu promjena granice tiho posegne za starim poljima, pa
  // se u proizvodu ništa ne pomakne i izgleda kao da promjena nije važna.
  assert.match(OBLACICI, /polja-vjetra-[\s\S]*NAJTANJI_SLOJ/);
});

test("najplića razina nosi reljef, a ne jednolik vjetar", () => {
  // Uz pregrubu granicu debljine svaka ćelija osim najniže udari u nju,
  // debljina ispadne jednolika i polje se svede na jednolik vjetar. Razina od
  // 25 m predstavlja noćnu inverziju — dakle sate na koje se ljudi i žale —
  // pa je to najgore mjesto na kojem se to može dogoditi, a najteže vidljivo:
  // karta izgleda uredno, samo nema brda u sebi.
  const najplica = OSNOVE_DIMA.osnove[0];
  const bajtovi = Buffer.from(najplica.istokVy, "base64");
  let lo = 255;
  let hi = 0;
  for (const v of bajtovi) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  assert.ok(
    hi - lo > 12,
    `okomita brzina najplićeg polja ide samo ${lo}–${hi} od 255 — `
      + "reljef ne skreće struju, granica debljine sloja je pregruba",
  );
});
