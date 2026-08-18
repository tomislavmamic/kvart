import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
