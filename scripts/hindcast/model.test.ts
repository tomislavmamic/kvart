import assert from "node:assert/strict";
import test from "node:test";

import { ZALET_SATI } from "@/lib/sim/simulacija";

import { celijaPrijemnika, oznakaModela, razdijeli, ucitajOsnove, vrtiModel } from "./model";
import type { Prijemnik, SatUlaza } from "./tipovi";

const K1: Prijemnik = { ime: "k1", lat: 43.5166505, lon: 16.5169123, opis: "postaja" };

function sati(od: string, n: number, smjerOd = 315, brzina = 1.5): SatUlaza[] {
  const t0 = Date.parse(od);
  return Array.from({ length: n }, (_, i) => ({
    sat: new Date(t0 + i * 3600_000).toISOString(),
    vjetar: { smjerOd, brzina, izvor: "split3" as const },
    dubina: { m: 100, izvor: "era5" as const },
    okolnosti: null,
  }));
}

test("postaja k1 leži u okviru simulatora", () => {
  const o = ucitajOsnove();
  const c = celijaPrijemnika(K1, o, 200, 200);
  assert.ok(c.uOkviru);
  assert.ok(c.i > 100 && c.j > 100, "jugoistočno od sredine");
});

test("prva tri sata nakon hladnog starta se ne bilježe", () => {
  const p = vrtiModel(sati("2026-01-01T00:00:00.000Z", 5), [K1]);
  assert.equal(p.length, 5 - ZALET_SATI);
  assert.equal(p[0].sat, "2026-01-01T03:00:00.000Z");
});

test("rupa u vjetru prekida lanac i traži novi zalet", () => {
  const niz = sati("2026-01-01T00:00:00.000Z", 9);
  const sRupom = niz.map((s, i) => (i === 4 ? { ...s, vjetar: null } : s));
  const p = vrtiModel(sRupom, [K1]);
  const satovi = p.map((x) => x.sat);
  assert.ok(satovi.includes("2026-01-01T03:00:00.000Z"));
  assert.ok(!satovi.includes("2026-01-01T05:00:00.000Z"));
  assert.ok(!satovi.includes("2026-01-01T07:00:00.000Z"));
  assert.ok(satovi.includes("2026-01-01T08:00:00.000Z"));
});

test("vjetar sa sjeverozapada donosi zrak na k1, s jugoistoka ne", () => {
  const nizvjetar = vrtiModel(sati("2026-01-01T00:00:00.000Z", 6, 320, 2), [K1]);
  const uzvjetar = vrtiModel(sati("2026-01-01T00:00:00.000Z", 6, 140, 2), [K1]);
  const zadnji = (p: typeof nizvjetar) => p[p.length - 1].gustoca;
  assert.ok(zadnji(nizvjetar) > 5 * Math.max(zadnji(uzvjetar), 1e-6), `${zadnji(nizvjetar)} vs ${zadnji(uzvjetar)}`);
});

test("komadi sa zaletom daju isto što i cijeli niz, po satu kao na stranici", () => {
  const niz = sati("2026-01-01T00:00:00.000Z", 10, 300, 1.2);
  const cijeli = vrtiModel(niz, [K1]);
  const komadi = razdijeli(niz, 2);
  assert.equal(komadi.length, 2);
  const spojeno = komadi.flatMap((k) =>
    vrtiModel(k.sati, [K1]).filter((p) => p.sat >= k.biljeziOd),
  );
  assert.deepEqual(spojeno, cijeli);
});

test("neprekinut lanac se pri slabom vjetru NE poklapa s računom po satu — spremnik čestica guši izvor", () => {
  // Ovo nije provjera ispravnosti nego kanarinac za poznatu manu modela:
  // kad se ispravi (izvor mora curiti jednoliko), test treba okrenuti.
  const niz = sati("2026-01-01T00:00:00.000Z", 10, 300, 1.2);
  const poSatu = vrtiModel(niz, [K1]);
  const lanac = vrtiModel(niz, [K1], { nacin: "lanac" });
  assert.deepEqual(lanac.map((p) => p.sat), poSatu.map((p) => p.sat));
  const omjeri = lanac.map((p, i) => Math.abs(Math.log((p.gustoca + 1e-3) / (poSatu[i].gustoca + 1e-3))));
  assert.ok(Math.max(...omjeri) > Math.log(2), `najveći omjer ${Math.exp(Math.max(...omjeri)).toFixed(2)}×`);
});

test("oznaka modela ovisi o postavkama", () => {
  const a = oznakaModela();
  const b = oznakaModela({ raspad: 80 });
  assert.equal(a.fizika, b.fizika);
  assert.notEqual(a.postavke, b.postavke);
});

test("trenutak na kraju sata pri stalnom vjetru skače iz sata u sat — vijuganje ima fazu", () => {
  // Kanarinac za poznatu manu: stranica uvijek uhvati istu fazu, lanac
  // različitu. Kad se vijuganje promijeni, ovaj test treba okrenuti.
  const niz = sati("2026-01-01T00:00:00.000Z", 10, 300, 1.2);
  const lanac = vrtiModel(niz, [K1], { nacin: "lanac", postavke: { punjenje: 160 } });
  const g = lanac.map((p) => p.gustoca);
  assert.ok(Math.max(...g) > 10 * (Math.min(...g) + 0.5), `raspon ${Math.min(...g).toFixed(1)}–${Math.max(...g).toFixed(1)}`);
});

test("uz spremnik dostatan za vijek i satni prosjek lanac se poklapa s računom po satu", () => {
  const niz = sati("2026-01-01T00:00:00.000Z", 10, 300, 1.2);
  const postavke = { punjenje: 160 };
  const poSatu = vrtiModel(niz, [K1], { postavke, uzoraka: 6 });
  const lanac = vrtiModel(niz, [K1], { nacin: "lanac", postavke, uzoraka: 6 });
  assert.deepEqual(lanac.map((p) => p.sat), poSatu.map((p) => p.sat));
  const omjeri = lanac.map((p, i) => Math.abs(Math.log((p.gustoca + 1e-2) / (poSatu[i].gustoca + 1e-2)))).sort((a, b) => a - b);
  // Preostala razlika je faza vijuganja koju sat od 60 min ne usrednji do
  // kraja (period je 48 min) i šum čestica — red veličine 2×, ne 100×.
  const medijan = omjeri[Math.floor(omjeri.length / 2)];
  assert.ok(medijan < Math.log(1.7), `medijan omjera ${Math.exp(medijan).toFixed(2)}×`);
  assert.ok(Math.max(...omjeri) < Math.log(3.5), `najveći omjer ${Math.exp(Math.max(...omjeri)).toFixed(2)}×`);
});

test("stabilan razred zadržava zrak dulje od nestabilnoga", () => {
  const postavke = { cestica: 20_000, punjenje: 320, raspadNestabilno: 0.5, raspadStabilno: 2.5, vijekNajvise: 320 };
  // Prijemnik kilometar niz vjetar: uz plohu razliku pojede svjež zrak.
  const dracevac: Prijemnik = { ime: "dracevac", lat: 43.527789, lon: 16.50401, opis: "dojave" };
  const noc = sati("2026-01-01T00:00:00.000Z", 9, 120, 0.8).map((s) => ({
    ...s,
    okolnosti: { sunce: 0, oblaci: 10, temperatura: 10, oborina: 0, izvor: "era5" as const },
  }));
  const dan = noc.map((s) => ({ ...s, okolnosti: { ...s.okolnosti!, sunce: 800 } }));
  const gN = vrtiModel(noc, [dracevac], { nacin: "lanac", postavke, uzoraka: 6 });
  const gD = vrtiModel(dan, [dracevac], { nacin: "lanac", postavke, uzoraka: 6 });
  const zadnji = (p: typeof gN) => p[p.length - 1].gustoca;
  assert.ok(zadnji(gN) > 1.5 * zadnji(gD), `noć ${zadnji(gN).toFixed(2)} vs dan ${zadnji(gD).toFixed(2)}`);
});

test("slučajno vrtloženje po razredu razmaže zrak u tihoj noći i na k1 i na Dračevac", () => {
  // Vjetar iz 250° pri 0,8 m/s nosi mimo obiju točaka; bez difuzije obje
  // ostaju gotovo prazne, s njom noćni razred F razmaže zrak do obiju.
  const dracevac: Prijemnik = { ime: "dracevac", lat: 43.527789, lon: 16.50401, opis: "dojave" };
  const noc = sati("2026-01-01T00:00:00.000Z", 8, 250, 0.8).map((s) => ({
    ...s,
    okolnosti: { sunce: 0, oblaci: 10, temperatura: 10, oborina: 0, izvor: "era5" as const },
  }));
  const bez = vrtiModel(noc, [K1, dracevac], { nacin: "lanac", postavke: { punjenje: 160, difuzija: 0 }, uzoraka: 6 });
  const sa = vrtiModel(noc, [K1, dracevac], { nacin: "lanac", postavke: { punjenje: 160, difuzija: 1 }, uzoraka: 6 });
  const niz = (p: typeof bez, ime: string) => p.filter((x) => x.prijemnik === ime).map((x) => x.gustoca);
  // k1 leži 70° od osi nošenja: bez difuzije je čas pun, čas prazan; s njom
  // je stalno pod zrakom. Dračevac je kilometar daleko i tek s njom uopće
  // dobije išta (σ za sat u razredu F je oko 900 m).
  assert.ok(Math.min(...niz(bez, "k1")) < 0.5, `k1 bez difuzije ima prazne sate: ${niz(bez, "k1").map((v) => v.toFixed(1)).join(" ")}`);
  assert.ok(Math.min(...niz(sa, "k1")) > 2, `k1 s difuzijom: ${niz(sa, "k1").map((v) => v.toFixed(1)).join(" ")}`);
  const dBez = niz(bez, "dracevac").at(-1)!;
  const dSa = niz(sa, "dracevac").at(-1)!;
  assert.ok(dSa > 5 * dBez + 0.3, `dračevac ${dBez.toFixed(2)} → ${dSa.toFixed(2)}`);
});

test("otjecanje niz padinu u tihoj vedroj noći nosi zrak prema Dračevcu i bez vjetra odande", () => {
  const dracevac: Prijemnik = { ime: "dracevac", lat: 43.527789, lon: 16.50401, opis: "dojave" };
  // Vjetar iz 250° pri 0,6 m/s nosi mimo Dračevca; razred F.
  const noc = sati("2026-01-01T00:00:00.000Z", 8, 250, 0.6).map((s) => ({
    ...s,
    okolnosti: { sunce: 0, oblaci: 10, temperatura: 10, oborina: 0, izvor: "era5" as const },
  }));
  const bez = vrtiModel(noc, [dracevac], { nacin: "lanac", postavke: { punjenje: 160, difuzija: 0 }, uzoraka: 6 });
  const sa = vrtiModel(noc, [dracevac], { nacin: "lanac", postavke: { punjenje: 160, difuzija: 0, drenaza: 0.5 }, uzoraka: 6 });
  const zadnji = (p: typeof bez) => p.at(-1)!.gustoca;
  // Učinak je skroman (0,06 → 0,17 u probi): otjecanje od 0,35 m/s treba
  // 50 minuta do Dračevca, a dotad prorjeđivanje pojede dvije trećine.
  // Test čuva smjer učinka; koliko vrijedi, kaže hindcast (E6), ne ovo.
  assert.ok(zadnji(sa) > 1.8 * zadnji(bez) + 0.04, `dračevac ${zadnji(bez).toFixed(2)} → ${zadnji(sa).toFixed(2)}`);
});
