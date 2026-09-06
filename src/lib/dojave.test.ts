import assert from "node:assert/strict";
import test from "node:test";

import { VJETAR } from "@/generated/karepovac-vjetar";

import {
  NAJDULJI_RASPON_SATI,
  POSTAJE_ZA_RUZU,
  ruzaDojava,
  satiDojava,
  sektor,
  SEKTORA,
  SEKTOR_IMENA,
  spojiVjetar,
  vjetarIzArhive,
  vjetarUSatu,
  ZADNJI_SAT_LUKE,
  type SatArhive,
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

/** Sažeti sat arhive iz smjera u stupnjevima i brzine, kako bi ga vratio upit. */
function satArhive(station: string, sat: number, smjer: number, brzina = 2): SatArhive {
  const rad = (smjer * Math.PI) / 180;
  return {
    station,
    sat,
    sinBrzina: brzina * Math.sin(rad),
    cosBrzina: brzina * Math.cos(rad),
    brzina,
  };
}

/** Trenutak sigurno poslije svih sati koje provjere koriste. */
const POSLIJE = new Date(Date.UTC(2100, 0, 1));

test("arhiva: u istom satu vodi postaja višeg prvenstva, kao i satni vjetar", () => {
  // Isti red kao `satniVjetar`: AZO Split-3 prije Split-2, pa tek Neverin.
  assert.deepEqual(POSTAJE_ZA_RUZU.slice(0, 3), ["split3", "split2", "vrboran"]);
  assert.equal(POSTAJE_ZA_RUZU.at(-1), "ldsp", "zračna luka je zadnja");

  const sat = 496_000;
  const vjetar = vjetarIzArhive([
    satArhive("vrboran", sat, 200),
    satArhive("split3", sat, 110),
    satArhive("split2", sat, 130),
    satArhive("nepoznata", sat, 5),
  ], POSLIJE);
  assert.equal(vjetar.get(sat)?.smjer, 110, "Split-3 vodi");

  const bezAzo = vjetarIzArhive([satArhive("pujanke", sat, 90), satArhive("vrboran", sat, 200)], POSLIJE);
  assert.equal(bezAzo.get(sat)?.smjer, 200, "bez AZO-a vodi Vrboran, ne Pujanke");
  assert.equal(vjetarIzArhive([satArhive("nepoznata", sat, 5)], POSLIJE).size, 0, "tuđa postaja ne ulazi");
});

/** Prosjek više očitanja (smjer, brzina) onako kako ga upit sažme. */
function prosjekOcitanja(station: string, sat: number, ocitanja: [number, number][]): SatArhive {
  const n = ocitanja.length;
  const rad = (d: number) => (d * Math.PI) / 180;
  return {
    station,
    sat,
    sinBrzina: ocitanja.reduce((z, [d, b]) => z + b * Math.sin(rad(d)), 0) / n,
    cosBrzina: ocitanja.reduce((z, [d, b]) => z + b * Math.cos(rad(d)), 0) / n,
    brzina: ocitanja.reduce((z, [, b]) => z + b, 0) / n,
  };
}

test("arhiva: smjer je težinski vektorski prosjek — tišina ne glasa o smjeru", () => {
  // 350° i 10° su oba sjever; aritmetički prosjek bi rekao jug (180°).
  const sat = 496_001;
  const sjever = vjetarIzArhive([prosjekOcitanja("vrboran", sat, [[350, 2], [10, 2]])], POSLIJE);
  assert.equal(sjever.get(sat)?.smjer, 0, "prosjek 350° i 10° je sjever");
  assert.equal(sjever.get(sat)?.tisina, false);

  // Jedanaest očitanja od 0,0 m/s „iz 315°” i jedno od 3 m/s iz 110°:
  // smjer sata je onaj koji je doista puhao.
  const jedanPuh = vjetarIzArhive(
    [prosjekOcitanja("vrboran", sat, [...Array.from({ length: 11 }, () => [315, 0] as [number, number]), [110, 3]])],
    POSLIJE,
  );
  assert.equal(jedanPuh.get(sat)?.smjer, 110, "očitanja od 0,0 m/s ne vuku smjer prema 315°");
  assert.equal(jedanPuh.get(sat)?.tisina, true, "ali sat s prosjekom 0,25 m/s je tišina");

  // Vjetar koji se vrtio na sve strane pri 2 m/s: brzina ima, smjera nema.
  const vrtnja = vjetarIzArhive(
    [prosjekOcitanja("vrboran", sat, [[0, 2], [90, 2], [180, 2], [270, 2]])],
    POSLIJE,
  );
  assert.equal(vrtnja.get(sat)?.tisina, true, "poništeni vektor ne dobiva nasumičan krak");
});

test("arhiva: očitanje „315° i 0,0 m/s” je tišina, a ne sjeverozapadnjak", () => {
  const sat = 496_002;
  const v = vjetarIzArhive([satArhive("vrboran", sat, 315, 0)], POSLIJE).get(sat);
  assert.ok(v, "sat je izmjeren i ostaje zabilježen");
  assert.equal(v.tisina, true);
  assert.equal(vjetarIzArhive([satArhive("vrboran", sat, 315, 0.4)], POSLIJE).get(sat)?.tisina, true, "0,4 m/s je ispod praga");
  assert.equal(vjetarIzArhive([satArhive("vrboran", sat, 315, 0.6)], POSLIJE).get(sat)?.tisina, false, "0,6 m/s nosi smjer");
});

test("arhiva: sat koji još traje ne dobiva smjer — čeka da završi", () => {
  const sadaMs = Date.UTC(2026, 8, 5, 7, 46);
  const tekuci = Math.floor(sadaMs / 3_600_000);
  const vjetar = vjetarIzArhive(
    [satArhive("vrboran", tekuci, 315, 3), satArhive("split3", tekuci - 1, 110, 3)],
    new Date(sadaMs),
  );
  assert.equal(vjetar.has(tekuci), false, "dva Neverinova očitanja tekućeg sata nisu sat");
  assert.equal(vjetar.get(tekuci - 1)?.smjer, 110, "prošli sat je gotov i ulazi");
});

test("ruža broji tišinu odvojeno: ni krak ni čekanje", () => {
  const kada = new Date(ZADNJI_SAT_LUKE.getTime() + 96 * 3_600_000);
  const sat = Math.floor(kada.getTime() / 3_600_000);
  const dojave = [
    { occurredAt: kada, smelled: true, strength: "jako" as const, reporterId: "a" },
    { occurredAt: kada, smelled: false, reporterId: "b" },
  ];
  const ruza = ruzaDojava(
    dojave,
    spojiVjetar(vjetarIzArhive([satArhive("split3", sat, 315, 0)], POSLIJE)),
  );
  assert.equal(ruza.tisina, 2);
  assert.equal(ruza.bezVjetra, 0, "sat je izmjeren; ne čeka se ništa");
  assert.equal(ruza.uporabljeno, 0, "ali u ružu ne ulazi");
  assert.equal(ruza.broj.reduce((a, b) => a + b, 0) + ruza.brojBez.reduce((a, b) => a + b, 0), 0);
});

test("i niz luke zna za tišinu", () => {
  let tihih = 0;
  let sVjetrom = 0;
  for (let i = 0; i < VJETAR.sati; i += 1) {
    const v = vjetarUSatu(new Date(PRVI_SAT + i * 3_600_000));
    if (!v) continue;
    if (v.tisina) {
      tihih += 1;
      assert.ok(v.brzina < 0.5);
    } else {
      sVjetrom += 1;
      assert.ok(v.brzina >= 0.5);
    }
  }
  assert.ok(tihih > 0, "u godinu dana luka je bar jednom javila tišinu");
  assert.ok(sVjetrom > tihih, "ali češće vjetar");
});

test("spojeni izvor gleda arhivu prije luke, a bez oboje ne izmišlja", () => {
  const uNizu = new Date(PRVI_SAT + 24 * 3_600_000);
  const satUNizu = Math.floor(uNizu.getTime() / 3_600_000);
  const poslijeNiza = new Date(ZADNJI_SAT_LUKE.getTime() + 48 * 3_600_000);
  const satPoslije = Math.floor(poslijeNiza.getTime() / 3_600_000);

  const arhiva = vjetarIzArhive([
    satArhive("split3", satUNizu, 45),
    satArhive("split3", satPoslije, 225),
  ], POSLIJE);
  const izvor = spojiVjetar(arhiva);
  assert.equal(izvor(uNizu)?.smjer, 45, "arhiva nadjačava niz luke i unutar niza");
  assert.equal(izvor(poslijeNiza)?.smjer, 225, "poslije kraja niza luke ostaje arhiva");
  assert.equal(
    spojiVjetar(new Map())(poslijeNiza),
    null,
    "sat bez arhive i izvan niza luke ostaje bez vjetra",
  );
  assert.deepEqual(spojiVjetar(new Map())(uNizu), vjetarUSatu(uNizu), "bez arhive vrijedi luka");
});

test("ruža prima izvor vjetra, pa dojave poslije kraja niza luke ipak uđu", () => {
  const kada = new Date(ZADNJI_SAT_LUKE.getTime() + 72 * 3_600_000);
  const sat = Math.floor(kada.getTime() / 3_600_000);
  const dojave = [
    { occurredAt: kada, smelled: true, strength: "jako" as const, reporterId: "a" },
    { occurredAt: kada, smelled: false, reporterId: "b" },
  ];
  const bezArhive = ruzaDojava(dojave);
  assert.equal(bezArhive.bezVjetra, 2, "luka je stala, bez arhive nema vjetra");

  const sArhivom = ruzaDojava(dojave, spojiVjetar(vjetarIzArhive([satArhive("split3", sat, 112)], POSLIJE)));
  assert.equal(sArhivom.bezVjetra, 0);
  assert.equal(sArhivom.uporabljeno, 2);
  const s = sektor(112);
  assert.equal(sArhivom.broj[s], 1);
  assert.equal(sArhivom.brojBez[s], 1);
});

test("sati dojava su svi sati koje dojave pokrivaju, bez ponavljanja", () => {
  const kada = new Date(Date.UTC(2026, 8, 4, 21, 50));
  const sat = Math.floor(kada.getTime() / 3_600_000);
  const sati = satiDojava([
    { occurredAt: kada, endedAt: new Date(kada.getTime() + 15 * 60_000) },
    { occurredAt: kada },
    { occurredAt: new Date(kada.getTime() - 5 * 3_600_000) },
  ]);
  assert.deepEqual(sati, [sat - 5, sat, sat + 1], "rastuće, 21.50–22.05 nosi dva sata, bez dvostrukih");
  assert.deepEqual(satiDojava([]), []);
});
