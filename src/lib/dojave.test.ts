import assert from "node:assert/strict";
import test from "node:test";

import { VJETAR } from "@/generated/karepovac-vjetar";

import {
  NAJDULJI_RASPON_SATI,
  ruzaDojava,
  sektor,
  SEKTORA,
  SEKTOR_IMENA,
  vjetarUSatu,
} from "./dojave";

const PRVI_SAT = Date.parse(VJETAR.prviSat);

test("sektor pripada smjeru iz kojega puše, sjever obuhvaća obje strane nule", () => {
  assert.equal(SEKTOR_IMENA[sektor(0)], "S");
  assert.equal(SEKTOR_IMENA[sektor(359)], "S", "359° je i dalje sjever");
  assert.equal(SEKTOR_IMENA[sektor(11)], "S");
  assert.equal(SEKTOR_IMENA[sektor(12)], "SSI");
  assert.equal(SEKTOR_IMENA[sektor(90)], "I");
  assert.equal(SEKTOR_IMENA[sektor(112.5)], "IJI", "smjer u kojem leži Karepovac");
  assert.equal(SEKTOR_IMENA[sektor(270)], "Z");
});

test("vjetar se ne izmišlja izvan niza ni za sate koje luka nije javila", () => {
  assert.equal(vjetarUSatu(new Date(PRVI_SAT - 3_600_000)), null);
  assert.equal(vjetarUSatu(new Date(PRVI_SAT + VJETAR.sati * 3_600_000)), null);

  // Barem jedan sat unutar niza mora imati vjetar, inače je izvoz prazan.
  let imamo = 0;
  for (let i = 0; i < VJETAR.sati; i += 1) {
    if (vjetarUSatu(new Date(PRVI_SAT + i * 3_600_000))) imamo += 1;
  }
  assert.equal(imamo, VJETAR.imamo);
  assert.ok(imamo > VJETAR.sati / 2, "više od pola sati mora imati vjetar");
});

test("izmjereni vjetar stoji u granicama koje vjetar uopće može imati", () => {
  for (let i = 0; i < VJETAR.sati; i += 97) {
    const v = vjetarUSatu(new Date(PRVI_SAT + i * 3_600_000));
    if (!v) continue;
    assert.ok(v.smjer >= 0 && v.smjer < 360, `smjer ${v.smjer}`);
    assert.ok(v.brzina >= 0 && v.brzina < 60, `brzina ${v.brzina}`);
  }
});

test("ruža broji samo dojave kojima zna vjetar, ostale prijavi kao neriješene", () => {
  const uNizu = new Date(PRVI_SAT + 24 * 3_600_000);
  const izvanNiza = new Date(PRVI_SAT - 48 * 3_600_000);
  const ruza = ruzaDojava([
    { occurredAt: uNizu, strength: "jako" },
    { occurredAt: izvanNiza, strength: "slabo" },
  ]);

  assert.equal(ruza.tezine.length, SEKTORA);
  assert.equal(ruza.bezVjetra, 1, "dojava izvan niza ne smije ući u zbroj");
  assert.ok(ruza.uporabljeno <= 1);
  assert.equal(
    ruza.broj.reduce((a, b) => a + b, 0),
    ruza.uporabljeno,
    "zbroj po sektorima mora se poklopiti s brojem uporabljenih dojava",
  );
});

test("jača dojava nosi više, ali ne toliko da pregazi ostale", () => {
  const kada = new Date(PRVI_SAT + 24 * 3_600_000);
  if (!vjetarUSatu(kada)) return;

  const slaba = ruzaDojava([{ occurredAt: kada, strength: "slabo" }]);
  const jaka = ruzaDojava([{ occurredAt: kada, strength: "nepodnosivo" }]);
  const s = Math.max(...slaba.tezine);
  const j = Math.max(...jaka.tezine);
  assert.ok(j > s, "nepodnošljivo mora nositi više od slabog");
  assert.ok(j / s <= 4, "raspon težina mora ostati uzak");
});

/** Sat unutar niza za koji vjetar postoji; provjere bez njega nemaju smisla. */
function satSVjetrom(od = 24): Date | null {
  for (let i = od; i < od + 500; i += 1) {
    const kada = new Date(PRVI_SAT + i * 3_600_000);
    if (vjetarUSatu(kada)) return kada;
  }
  return null;
}

test("dojava „ne smrdi” ulazi u ružu i mijenja udio, ali ne i težinu", () => {
  // Ovo je jedina brojka koja odgovara na „koliko često smrdi”. Bez negativnih
  // dojava zbroj mjeri koliko je tko voljan javljati jednako koliko i miris.
  const kada = satSVjetrom();
  if (!kada) return;
  const s = sektor(vjetarUSatu(kada)!.smjer);

  const samoDa = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "jako", reporterId: "a" },
  ]);
  assert.equal(samoDa.udio[s], 1, "bez ijedne negativne dojave udio je 1");

  const oboje = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "jako", reporterId: "a" },
    { occurredAt: kada, smelled: false, reporterId: "b" },
    { occurredAt: kada, smelled: false, reporterId: "c" },
    { occurredAt: kada, smelled: false, reporterId: "d" },
  ]);
  assert.equal(oboje.udio[s], 0.25, "jedna od četiri");
  assert.equal(oboje.broj[s], 1);
  assert.equal(oboje.brojBez[s], 3);
  assert.equal(oboje.uporabljeno, 4, "i tišina je opažanje");
  assert.equal(
    oboje.tezine[s],
    samoDa.tezine[s],
    "negativna dojava ne smije mijenjati težinu",
  );
});

test("sektor bez ijednog opažanja nema udio, umjesto da ima nulu", () => {
  const kada = satSVjetrom();
  if (!kada) return;
  const ruza = ruzaDojava([{ occurredAt: kada, smelled: true, strength: "slabo" }]);
  const prazni = ruza.udio.filter((u) => u === null).length;
  assert.ok(prazni > 0, "negdje nitko nije bio — to nije isto što i nula");
  assert.equal(
    ruza.udio.filter((u) => u === 0).length,
    0,
    "nula znači „bili smo i nije smrdjelo”, a to ovdje nitko nije javio",
  );
});

test("raspon nosi po jedno opažanje za svaki sat, ali ne bez granice", () => {
  const kada = satSVjetrom();
  if (!kada) return;
  // `endedAt` je stvarni trenutak kraja, ne oznaka sata: epizoda od 14.00 do
  // 17.00 provedena je u satima 14, 15 i 16 — u 17.00 je već gotova.
  const triSata = ruzaDojava([
    {
      occurredAt: kada,
      endedAt: new Date(kada.getTime() + 3 * 3_600_000),
      smelled: true,
      strength: "osjetno",
      reporterId: "a",
    },
  ]);
  assert.equal(
    triSata.uporabljeno + triSata.bezVjetra,
    3,
    "tri sata trajanja su tri sata, svaki sa svojim vjetrom",
  );

  const dug = ruzaDojava([
    {
      occurredAt: kada,
      endedAt: new Date(kada.getTime() + 48 * 3_600_000),
      smelled: true,
      strength: "osjetno",
      reporterId: "a",
    },
  ]);
  assert.equal(
    dug.uporabljeno + dug.bezVjetra,
    NAJDULJI_RASPON_SATI,
    "predug raspon se reže, da jedna dojava ne nadglasa dvadeset kratkih",
  );

  // Kraj prije početka je pogreška unosa, ne raspon unatrag.
  const naopako = ruzaDojava([
    {
      occurredAt: kada,
      endedAt: new Date(kada.getTime() - 5 * 3_600_000),
      smelled: true,
      strength: "slabo",
    },
  ]);
  assert.equal(naopako.uporabljeno + naopako.bezVjetra, 1);
});

test("isti dojavitelj u istom satu broji se jednom, i to po jačem", () => {
  const kada = satSVjetrom();
  if (!kada) return;
  const s = sektor(vjetarUSatu(kada)!.smjer);

  const dvaput = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "slabo", reporterId: "ista" },
    { occurredAt: kada, smelled: true, strength: "nepodnosivo", reporterId: "ista" },
  ]);
  assert.equal(dvaput.broj[s], 1, "jedan nos, jedan sat, jedno opažanje");
  assert.equal(dvaput.sazeto, 1);
  const samoJaka = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "nepodnosivo", reporterId: "ista" },
  ]);
  assert.equal(dvaput.tezine[s], samoJaka.tezine[s], "ostaje jače opažanje");

  // Miris nadjačava tišinu: tko je javio oboje za isti sat, osjetio je miris.
  const oboje = ruzaDojava([
    { occurredAt: kada, smelled: false, reporterId: "ista" },
    { occurredAt: kada, smelled: true, strength: "jako", reporterId: "ista" },
  ]);
  assert.equal(oboje.broj[s], 1);
  assert.equal(oboje.brojBez[s], 0);

  // Dvoje ljudi u istom satu su dva opažanja, ma koliko slično javili.
  const dvoje = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "slabo", reporterId: "a" },
    { occurredAt: kada, smelled: true, strength: "slabo", reporterId: "b" },
  ]);
  assert.equal(dvoje.broj[s], 2);
  assert.equal(dvoje.sazeto, 0);
});

test("dojava bez oznake preglednika ne sažima se ni s kojom drugom", () => {
  // Stari zapisi nemaju oznaku. Sažeti ih po `null` značilo bi proglasiti ih
  // jednim te istim nosom, a o njima upravo to ne znamo.
  const kada = satSVjetrom();
  if (!kada) return;
  const s = sektor(vjetarUSatu(kada)!.smjer);
  const ruza = ruzaDojava([
    { occurredAt: kada, smelled: true, strength: "slabo" },
    { occurredAt: kada, smelled: true, strength: "slabo" },
    { occurredAt: kada, smelled: true, strength: "slabo", reporterId: null },
  ]);
  assert.equal(ruza.broj[s], 3);
  assert.equal(ruza.sazeto, 0);
});

test("stara dojava bez novih polja i dalje vrijedi kao prije", () => {
  const kada = satSVjetrom();
  if (!kada) return;
  const s = sektor(vjetarUSatu(kada)!.smjer);
  const ruza = ruzaDojava([{ occurredAt: kada, strength: "jako" }]);
  assert.equal(ruza.broj[s], 1, "bez `smelled` dojava znači da je smrdjelo");
  assert.equal(ruza.brojBez[s], 0);
  assert.ok(ruza.tezine[s] > 0);
});

test("kratka epizoda preko granice sata nosi oba sata, inače samo svoj", () => {
  // Ovo je razlog zbog kojega se vrijeme bira satom i minutom: epizoda od
  // petnaest minuta u 14.50 doista je bila i u satu 14 i u satu 15, pa je
  // nosi vjetar obaju. Ista epizoda u 14.00 tiče se samo sata 14.
  const kada = satSVjetrom();
  if (!kada) return;

  const preko = ruzaDojava([
    {
      occurredAt: new Date(kada.getTime() + 50 * 60_000),
      endedAt: new Date(kada.getTime() + 65 * 60_000),
      smelled: true,
      strength: "osjetno",
      reporterId: "a",
    },
  ]);
  assert.equal(preko.uporabljeno + preko.bezVjetra, 2, "14.50–15.05 su dva sata");

  const unutra = ruzaDojava([
    {
      occurredAt: kada,
      endedAt: new Date(kada.getTime() + 15 * 60_000),
      smelled: true,
      strength: "osjetno",
      reporterId: "a",
    },
  ]);
  assert.equal(unutra.uporabljeno + unutra.bezVjetra, 1, "14.00–14.15 je jedan sat");

  // Puni sat završava na granici, ali je proveden u satu koji je počeo.
  const tocnoSat = ruzaDojava([
    {
      occurredAt: kada,
      endedAt: new Date(kada.getTime() + 60 * 60_000),
      smelled: true,
      strength: "osjetno",
      reporterId: "a",
    },
  ]);
  assert.equal(
    tocnoSat.uporabljeno + tocnoSat.bezVjetra,
    1,
    "u 15.00 je epizoda gotova, pa sat 15 ne broji",
  );
});
