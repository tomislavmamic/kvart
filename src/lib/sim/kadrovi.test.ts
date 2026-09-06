import assert from "node:assert/strict";
import test from "node:test";

import {
  najbliziDostupan,
  planZamjene,
  pomakNakonZamjene,
  pomakZaSat,
  SATI_UNAPRIJED,
  SATI_UNATRAG,
  SATI_ZALETA,
  satoviCrte,
  slozCrtu,
  zahvaceniSati,
  slozKadar,
  type OcitanjePostaje,
} from "@/lib/sim/kadrovi";
import { primijeniVjetar } from "@/lib/sim/dohvat";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";

const SADA = new Date("2026-08-21T15:00:00.000Z");

function vjetar(sat: string, izvor: SatniVjetar["izvor"] = "split3"): SatniVjetar {
  return { sat, smjerOd: 112.5, brzina: 1.2, tisina: false, izvor };
}

/** Puni niz koji pokriva zalet, prošlost i tri sata prognoze. */
function puniNizovi(unaprijed = SATI_UNAPRIJED) {
  const vjetrovi = new Map<string, SatniVjetar>();
  const dubine = new Map<string, number>();
  for (let i = -(SATI_UNATRAG + SATI_ZALETA); i <= unaprijed; i += 1) {
    const sat = new Date(SADA.getTime() + i * 3600000).toISOString();
    vjetrovi.set(sat, vjetar(sat, i > 0 ? "model" : "split3"));
    dubine.set(sat, 80);
  }
  return { vjetrovi, dubine };
}

const MJERENJE: OcitanjePostaje = {
  postaja: "k1",
  tvar: "sumporovodik",
  vrijednost: 2.758,
  jedinica: "µg/m³",
  ispodGranice: false,
};

test("crta ima 24 sata unatrag, sadašnji i tri unaprijed", () => {
  const { crta, zalet } = satoviCrte(SADA);
  assert.equal(crta.length, SATI_UNATRAG + 1 + SATI_UNAPRIJED, "28 kadrova");
  assert.equal(crta[0], "2026-08-20T15:00:00.000Z", "prvi je 24 h unatrag");
  assert.equal(crta.at(-1), "2026-08-21T18:00:00.000Z", "zadnji je +3 h");
  assert.equal(zalet.length, SATI_ZALETA, "zalet je izvan crte");
  assert.ok(zalet.at(-1)! < crta[0], "zalet prethodi crti");
});

test("bez prognoze crta staje na sadašnjem satu", () => {
  const { crta } = satoviCrte(SADA, 0);
  assert.equal(crta.length, SATI_UNATRAG + 1);
  assert.equal(crta.at(-1), SADA.toISOString());
});

test("prognozirani sat ne nosi mjerenja ni kad ih se ponudi", () => {
  const kadar = slozKadar("2026-08-21T16:00:00.000Z", 1, vjetar("x", "model"), 80, [MJERENJE]);
  assert.equal(kadar.vrsta, "prognoza");
  assert.deepEqual(kadar.ocitanja, [], "postaje budućnost ne mjere");
});

test("izmjereni sat zadržava mjerenje i oznaku izvora", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), 80, [MJERENJE]);
  assert.equal(kadar.vrsta, "izmjereno");
  assert.equal(kadar.izvor, "split3");
  assert.equal(kadar.ocitanja[0].vrijednost, 2.758);
  assert.equal(kadar.dostupnost, "spreman");
});

test("sat bez vjetra je rupa, ne kadar s pretpostavkom", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, undefined, 80, [MJERENJE]);
  assert.equal(kadar.dostupnost, "nedostupno");
  assert.equal(kadar.stanje, null, "ne izmišlja se slučaj vremena");
});

test("sat bez dubine sloja jednako je rupa", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), undefined);
  assert.equal(kadar.dostupnost, "nedostupno");
});

test("sat s vjetrom ali bez mjerenja stoji kao djelomičan", () => {
  const kadar = slozKadar("2026-08-21T14:00:00.000Z", -1, vjetar("x"), 80, [
    { ...MJERENJE, vrijednost: null },
  ]);
  assert.equal(kadar.dostupnost, "djelomicno", "polje se dade računati, mjerenja nema");
  assert.equal(kadar.ocitanja[0].vrijednost, null, "nedostatak ostaje nedostatak");
});

test("crta se slaže do zadnjeg sata koji prognoza doista pokriva", () => {
  const { vjetrovi, dubine } = puniNizovi(1);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.kadrovi.at(-1)?.pomak, 1, "prognoza seže dokle podataka ima");
  assert.equal(crta.kadrovi.filter((k) => k.vrsta === "prognoza").length, 1);
});

test("kadrovi zaleta stoje izvan crte i nose stanje", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.zalet.length, SATI_ZALETA);
  assert.ok(crta.zalet.every((k) => k.stanje !== null), "zalet mora imati čime hraniti model");
  assert.ok(
    crta.kadrovi.every((k) => k.pomak >= -SATI_UNATRAG),
    "zalet se ne smije pojaviti među vidljivim kadrovima",
  );
});

test("sadašnji sat je jedini označen kao „sada”", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  const sada = crta.kadrovi.filter((k) => k.vrsta === "sada");
  assert.equal(sada.length, 1);
  assert.equal(sada[0].sat, SADA.toISOString());
  assert.equal(sada[0].pomak, 0);
});

test("mjerenja se vežu uz svoj sat, a ne uz susjedni", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const sat = new Date(SADA.getTime() - 3 * 3600000).toISOString();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map([[sat, [MJERENJE]]]));
  const nas = crta.kadrovi.find((k) => k.sat === sat);
  assert.equal(nas?.ocitanja[0].vrijednost, 2.758);
  const susjed = crta.kadrovi.find((k) => k.pomak === -2);
  assert.deepEqual(susjed?.ocitanja, [], "susjedni sat ostaje bez mjerenja");
});

test("rupa u nizu ne pomiče ostale kadrove", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const rupa = new Date(SADA.getTime() - 5 * 3600000).toISOString();
  vjetrovi.delete(rupa);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(crta.kadrovi.length, SATI_UNATRAG + 1 + SATI_UNAPRIJED, "broj kadrova je isti");
  assert.equal(crta.kadrovi.find((k) => k.sat === rupa)?.dostupnost, "nedostupno");
  assert.equal(crta.kadrovi.find((k) => k.pomak === -4)?.dostupnost !== "nedostupno", true);
});

test("odabir pada na najbliži dostupan sat, a ne na prazan", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const rupa = new Date(SADA.getTime() - 5 * 3600000).toISOString();
  vjetrovi.delete(rupa);
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(najbliziDostupan(crta, -5)?.pomak, -4, "skače na susjedni, ne ostaje prazan");
  assert.equal(najbliziDostupan(crta, 0)?.pomak, 0);
});

test("kad nijedan sat nema vjetra, crta to prizna", () => {
  const crta = slozCrtu(SADA, new Map(), new Map(), new Map());
  assert.equal(najbliziDostupan(crta, 0), null);
  assert.ok(crta.kadrovi.every((k) => k.dostupnost === "nedostupno"));
});

test("promjena vjetra povlači i sate koji je nose u zaletu", () => {
  // Kadar sata H računa se iz H-3..H, pa promjena u H kvari i H+1..H+3.
  const crta = slozCrtu(
    new Date("2026-08-25T06:00:00Z"),
    new Map(
      satoviOko("2026-08-25T06:00:00Z").map((sat) => [
        sat,
        { sat, smjerOd: 50, brzina: 2, tisina: false, izvor: "model" as const },
      ]),
    ),
    new Map(satoviOko("2026-08-25T06:00:00Z").map((sat) => [sat, 100])),
    new Map(),
  );
  const mapa = new Map([
    [
      "2026-08-25T06:00:00.000Z",
      {
        sat: "2026-08-25T06:00:00.000Z",
        smjerOd: 87,
        brzina: 1.4,
        tisina: false,
        izvor: "split3" as const,
      },
    ],
  ]);
  const nova = primijeniVjetar(crta, mapa);
  const zahvaceni = zahvaceniSati(crta, nova, 3);
  // Prognozirani satovi zadržavaju modelski vjetar, ali se njihovi kadrovi
  // griju kroz ispravljeni 06 h — pa i oni idu na ponovni račun.
  assert.deepEqual(zahvaceni, [
    "2026-08-25T06:00:00.000Z",
    "2026-08-25T07:00:00.000Z",
    "2026-08-25T08:00:00.000Z",
    "2026-08-25T09:00:00.000Z",
  ]);
  // Promjena u sredini crte povlači i tri sata za njom.
  const sredina = "2026-08-25T02:00:00.000Z";
  const mapa2 = new Map([[sredina, { sat: sredina, smjerOd: 120, brzina: 3, tisina: false, izvor: "split3" as const }]]);
  const nova2 = primijeniVjetar(crta, mapa2);
  const zahvaceni2 = zahvaceniSati(crta, nova2, 3);
  assert.deepEqual(
    zahvaceni2,
    ["2026-08-25T02:00:00.000Z", "2026-08-25T03:00:00.000Z", "2026-08-25T04:00:00.000Z", "2026-08-25T05:00:00.000Z"],
  );
});

function satoviOko(vrh: string): string[] {
  const t0 = Date.parse(vrh);
  const sati: string[] = [];
  for (let k = -(SATI_UNATRAG + SATI_ZALETA); k <= SATI_UNAPRIJED; k += 1) {
    sati.push(new Date(t0 + k * 3600_000).toISOString());
  }
  return sati;
}

test("stara crta i novi vrh sata: kadar s pomakom 0 na novoj crti je novi sat", () => {
  // Kartica ostavljena otvorenom preko prijelaza sata: crta se slaže iznova
  // za novi vrh, a sat koji je bio „sada” postaje „prije 1 h”.
  const { vjetrovi, dubine } = puniNizovi();
  const stara = slozCrtu(SADA, vjetrovi, dubine, new Map());
  const noviVrh = new Date(SADA.getTime() + 3600000);
  const noviSat = noviVrh.toISOString();
  vjetrovi.set(noviSat, vjetar(noviSat, "split3"));
  const nova = slozCrtu(noviVrh, vjetrovi, dubine, new Map());

  assert.equal(nova.sada, noviSat);
  assert.equal(nova.kadrovi.find((k) => k.pomak === 0)?.sat, noviSat);
  assert.equal(nova.kadrovi.find((k) => k.pomak === 0)?.vrsta, "sada");
  // Sat koji je bio „sada” sad je prošli i zadržava se po apsolutnom satu.
  const bivsi = nova.kadrovi.find((k) => k.sat === stara.sada);
  assert.equal(bivsi?.pomak, -1);
  assert.equal(bivsi?.vrsta, "izmjereno");
  assert.equal(pomakZaSat(nova, stara.sada), -1);
});

test("pomak iz ISO sata: na crti, izvan nje i za nečitljiv zapis", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const crta = slozCrtu(SADA, vjetrovi, dubine, new Map());
  assert.equal(pomakZaSat(crta, "2026-08-21T10:00:00.000Z"), -5);
  assert.equal(pomakZaSat(crta, "2026-08-21T17:00:00.000Z"), 2);
  // Ispao s crte: pomak je izvan raspona, pozivatelj ga svodi na najbliži.
  assert.equal(pomakZaSat(crta, "2026-08-19T15:00:00.000Z"), -48);
  assert.equal(najbliziDostupan(crta, -48)?.pomak, -SATI_UNATRAG);
  assert.equal(pomakZaSat(crta, "-5"), null);
  assert.equal(pomakZaSat(crta, "ne-vrijeme"), null);
});

test("nakon prijelaza sata tko prati „sada” ostaje na novom „sada”, tko je birao sat ostaje na svom satu", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const stara = slozCrtu(SADA, vjetrovi, dubine, new Map());
  const noviVrh = new Date(SADA.getTime() + 3600000);
  const noviSat = noviVrh.toISOString();
  vjetrovi.set(noviSat, vjetar(noviSat, "split3"));
  const nova = slozCrtu(noviVrh, vjetrovi, dubine, new Map());

  // Prati sadašnjost: „sada” je i dalje „sada”, ne „prije 1 h”.
  assert.equal(pomakNakonZamjene(stara, nova, 0, true), 0);
  // Odabrao je sadašnji sat sam (npr. poveznica): ostaje na tom satu.
  assert.equal(pomakNakonZamjene(stara, nova, 0, false), -1);
  // Odabrao je 5 h unatrag: isti apsolutni sat, sad 6 h unatrag.
  assert.equal(pomakNakonZamjene(stara, nova, -5, true), -6);
  assert.equal(pomakNakonZamjene(stara, nova, -5, false), -6);
  // Sat koji je s crte ispao vodi na „sada”.
  assert.equal(pomakNakonZamjene(stara, nova, -SATI_UNATRAG, false), 0);
});

test("plan zamjene zadržava slike satova koji se računaju iznova, a baca samo one koji su ispali", () => {
  const { vjetrovi, dubine } = puniNizovi();
  const stara = slozCrtu(SADA, vjetrovi, dubine, new Map());
  // Nova crta sat poslije, s promijenjenim vjetrom u sadašnjem satu.
  const noviVrh = new Date(SADA.getTime() + 3600000);
  const noviSat = noviVrh.toISOString();
  vjetrovi.set(noviSat, vjetar(noviSat, "split3"));
  vjetrovi.set(SADA.toISOString(), { ...vjetar(SADA.toISOString()), smjerOd: 250 });
  // Nova crta seže sat dalje u prognozu: taj sat na staroj nije postojao.
  const noviPrognozirani = new Date(SADA.getTime() + 4 * 3600000).toISOString();
  vjetrovi.set(noviPrognozirani, vjetar(noviPrognozirani, "model"));
  dubine.set(noviPrognozirani, 80);
  const nova = slozCrtu(noviVrh, vjetrovi, dubine, new Map());

  const slike = new Set(stara.kadrovi.map((k) => k.sat));
  const plan = planZamjene(stara, nova, slike, 3);
  assert.ok(plan.zaRacun.includes(SADA.toISOString()), "promijenjeni sat ide na račun");
  for (const sat of plan.zaRacun) assert.ok(plan.zadrzati.has(sat), `slika ${sat} ostaje dok nova ne stigne`);
  assert.deepEqual(plan.izbaciti, [stara.kadrovi[0].sat], "ispao je samo najstariji sat");
  assert.equal(plan.imaNovih, true, "sat +4 h je nov");
  assert.ok(!plan.zadrzati.has(stara.kadrovi[0].sat));

  // Ista crta, isti vjetar: ništa se ne računa i ništa ne baca.
  const prazan = planZamjene(stara, stara, slike, 3);
  assert.deepEqual(prazan.zaRacun, []);
  assert.deepEqual(prazan.izbaciti, []);
  assert.equal(prazan.imaNovih, false);
});
