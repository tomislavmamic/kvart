import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  doRuba,
  cesticaUTocki,
  imenicaUz,
  mjestoNaPpugu,
  plociceZaTocku,
  naslovno,
  normaliziraj,
  oblik,
  pripremiAdrese,
  stanjeTocke,
  trazi,
  uObliku,
  type Geometrija,
  type Slojevi,
} from "@/lib/gup-grad/zabrana";

const kvadrat = (x0: number, y0: number, a: number) => [
  [x0, y0],
  [x0 + a, y0],
  [x0 + a, y0 + a],
  [x0, y0 + a],
  [x0, y0],
];
const poligon = (...prstenovi: number[][][]): Geometrija => ({ type: "Polygon", coordinates: prstenovi });

test("uObliku: rupa u poligonu nije unutra, ni dio multipoligona izvan oba", () => {
  const s = oblik(poligon(kvadrat(16.4, 43.5, 0.01), kvadrat(16.403, 43.503, 0.004)));
  assert.equal(uObliku(s, 16.401, 43.501), true);
  assert.equal(uObliku(s, 16.405, 43.505), false); // u rupi
  assert.equal(uObliku(s, 16.42, 43.505), false);
  const m = oblik({ type: "MultiPolygon", coordinates: [[kvadrat(16.4, 43.5, 0.001)], [kvadrat(16.41, 43.5, 0.001)]] });
  assert.equal(uObliku(m, 16.4105, 43.5005), true);
  assert.equal(uObliku(m, 16.405, 43.5005), false);
});

test("doRuba: metri do najbližeg ruba", () => {
  const s = oblik(poligon(kvadrat(16.4, 43.5, 0.01)));
  // 0,0001° geografske širine ≈ 11 m
  const d = doRuba(s, 16.405, 43.5001);
  assert.ok(d > 10 && d < 12, `${d}`);
});

test("stanjeTocke: zabrana prije plana na snazi, izvan GUP-a, preporuka, GUP", () => {
  const upu = { ...oblik(poligon(kvadrat(16.4, 43.5, 0.02))), broj: 18, naziv: "UPU Dračevac 2" };
  const s: Slojevi = {
    komadi: [
      { ...oblik(poligon(kvadrat(16.4, 43.5, 0.005))), podrucje: "sanacija", upu: 18, fokus: true },
      { ...oblik(poligon(kvadrat(16.41, 43.5, 0.003))), podrucje: "preobrazba", upu: 0, fokus: false, izvan: "gospodarska" },
    ],
    negradivo: [{ ...oblik(poligon(kvadrat(16.406, 43.5, 0.003))), podrucje: "neuredeno", namjena: "promet", upu: 18 }],
    cestice: [{ ...oblik(poligon(kvadrat(16.401, 43.501, 0.002))), kc: "406/3", ko: "SPLIT", m2: 850, neizgradjena: true, fokus: true }],
    ppug: [],
    ppugCestice: {},
    obris: oblik(poligon(kvadrat(16.4, 43.5, 0.005))),
    vazeci: [{ ...oblik(poligon(kvadrat(16.41, 43.51, 0.005))), naziv: "DPU radne zone Dračevac", glasnik: "8/03" }],
    propisani: [upu],
    gup: oblik(poligon(kvadrat(16.39, 43.49, 0.05))),
  };
  const z = stanjeTocke(s, 16.402, 43.502);
  assert.equal(z.rezim, "zabrana");
  if (z.rezim === "zabrana") {
    assert.equal(z.podrucje, "sanacija");
    assert.equal(z.upu?.naziv, "UPU Dračevac 2");
    assert.equal(z.cestica?.kc, "406/3");
    assert.equal(z.fokus, true);
    // najbliži rub je 0,002° zemljopisne dužine zapadno ≈ 161 m
    assert.ok(z.doRuba > 150 && z.doRuba < 170, `${z.doRuba}`);
  }
  const bezCestice = stanjeTocke(s, 16.4045, 43.5045);
  assert.equal(bezCestice.rezim === "zabrana" && bezCestice.cestica, null);
  // preobrazba gospodarske zone: i dalje zabrana, ali je karta ne boji
  const gosp = stanjeTocke(s, 16.4115, 43.5015);
  assert.equal(gosp.rezim, "zabrana");
  if (gosp.rezim === "zabrana") {
    assert.equal(gosp.fokus, false);
    assert.equal(gosp.izvan, "gospodarska");
  }
  const ng = stanjeTocke(s, 16.4075, 43.5015);
  assert.equal(ng.rezim, "negradivo");
  if (ng.rezim === "negradivo") {
    assert.equal(ng.namjena, "promet");
    assert.equal(ng.upu?.naziv, "UPU Dračevac 2");
  }
  assert.equal(stanjeTocke(s, 16.412, 43.512).rezim, "vazeci");
  assert.equal(stanjeTocke(s, 16.418, 43.508).rezim, "preporuka");
  assert.equal(stanjeTocke(s, 16.43, 43.53).rezim, "gup");
  assert.equal(stanjeTocke(s, 16.5, 43.6).rezim, "izvan");
});

test("trazi: kućni broj s točnim prvo, ulica bez broja, bez dijakritika", () => {
  const a = pripremiAdrese({
    ulice: [
      ["Put Mostina", "GK Mejaši"],
      ["Ulica Dračevac", "GK Mejaši"],
    ],
    brojevi: [
      [0, "12a", 16.49, 43.52],
      [0, "12", 16.49, 43.52],
      [0, "120", 16.49, 43.52],
      [1, "3", 16.5, 43.52],
    ],
  });
  assert.equal(normaliziraj("  Dračevac, 3 "), "dracevac 3");
  const r = trazi(a, "mostina 12");
  assert.deepEqual(r.map((p) => p.naziv), ["Put Mostina 12", "Put Mostina 12a", "Put Mostina 120"]);
  assert.equal(r[0].kotar, "Mejaši");
  const u = trazi(a, "dracevac");
  assert.equal(u.length, 1);
  assert.equal(u[0].vrsta, "ulica");
  assert.deepEqual(trazi(a, "nepostojeca 5"), []);
});

test("naslovno: katastarska općina iz velikih slova", () => {
  assert.equal(naslovno("KAMEN"), "Kamen");
  assert.equal(naslovno("ŽRNOVNICA"), "Žrnovnica");
});

test("zabrana-cestice-2025.geojson: zbroj čestica jednak je iskazanom slobodnom zemljištu", () => {
  const citaj = (ime: string) => JSON.parse(readFileSync(path.join(process.cwd(), "public/geo/gup-grad", ime), "utf8"));
  const z = citaj("zabrana-2025.geojson").zbroj;
  const c = citaj("zabrana-cestice-2025.geojson").features as { properties: { m2: number; neizgradjena: boolean } }[];
  const neizg = c.filter((f) => f.properties.neizgradjena);
  assert.equal(neizg.length, z.neizgradjene.cestice);
  assert.equal(c.length - neizg.length, z.djelomicno.cestice);
  const ha = c.reduce((s, f) => s + f.properties.m2, 0) / 1e4;
  assert.ok(Math.abs(ha - z.slobodno_ha) < 0.2, `${ha} vs ${z.slobodno_ha}`);
  // ono što karta boji
  const f = c.filter((x) => (x.properties as { fokus?: boolean }).fokus);
  assert.equal(f.filter((x) => x.properties.neizgradjena).length, z.fokus.neizgradjene.cestice);
  const haF = f.reduce((s, x) => s + x.properties.m2, 0) / 1e4;
  assert.ok(Math.abs(haF - z.fokus.slobodno_ha) < 0.2, `${haF} vs ${z.fokus.slobodno_ha}`);
  // po UPU-u su prebrojane sve čestice s karte (po njima se crtaju obuhvati)
  const poUpu = z.po_upu as { fokus_cestice: number }[];
  assert.equal(poUpu.reduce((s, r) => s + r.fokus_cestice, 0), f.length);
});

test("zabrana-2025.geojson: komadi zbrojeni daju iskazanu površinu", () => {
  const d = JSON.parse(readFileSync(path.join(process.cwd(), "public/geo/gup-grad/zabrana-2025.geojson"), "utf8"));
  type K = { properties: { vrsta: string; ha: number } };
  const zbroji = (vrste: string[]) => d.features.filter((f: K) => vrste.includes(f.properties.vrsta)).reduce((s: number, f: K) => s + f.properties.ha, 0);
  const gradnja = zbroji(["sanacija", "preobrazba", "neuredeno"]);
  const sve = gradnja + zbroji(["negradivo"]);
  // odbačene mrvice ispod 150 m² — razlika je unutar pola posto
  assert.ok(Math.abs(gradnja - d.zbroj.gradnja_ukupno_ha) / d.zbroj.gradnja_ukupno_ha < 0.005, `${gradnja} vs ${d.zbroj.gradnja_ukupno_ha}`);
  assert.ok(Math.abs(sve - d.zbroj.ukupno_ha) / d.zbroj.ukupno_ha < 0.01, `${sve} vs ${d.zbroj.ukupno_ha}`);
  assert.equal(d.features.filter((f: { properties: { vrsta: string } }) => f.properties.vrsta === "gup").length, 1);
  const fokus = d.features.filter((f: { properties: { fokus?: boolean } }) => f.properties.fokus).reduce((s: number, f: K) => s + f.properties.ha, 0);
  assert.ok(Math.abs(fokus - d.zbroj.fokus.gradnja_ukupno_ha) / d.zbroj.fokus.gradnja_ukupno_ha < 0.005, `${fokus} vs ${d.zbroj.fokus.gradnja_ukupno_ha}`);
});

test("imenicaUz: jednina, dvojina i množina uz broj", () => {
  const z: [string, string, string] = ["zgrada", "zgrade", "zgrada"];
  const k: [string, string, string] = ["kućni broj", "kućna broja", "kućnih brojeva"];
  assert.equal(imenicaUz(1, k), "kućni broj");
  assert.equal(imenicaUz(1473, k), "kućna broja");
  assert.equal(imenicaUz(12, k), "kućnih brojeva");
  assert.equal(imenicaUz(21, k), "kućni broj");
  assert.equal(imenicaUz(113, k), "kućnih brojeva");
  assert.equal(imenicaUz(6697, z), "zgrada");
  assert.equal(imenicaUz(23, z), "zgrade");
});

test("cesticaUTocki i plociceZaTocku: čestica pod klikom", () => {
  const fc = {
    type: "FeatureCollection" as const,
    features: [
      { type: "Feature" as const, properties: { kc: "297/1", ko: "SPLIT" }, geometry: poligon(kvadrat(16.5, 43.52, 0.001)) },
      { type: "Feature" as const, properties: { kc: "298/1", ko: "SPLIT" }, geometry: poligon(kvadrat(16.502, 43.52, 0.001)) },
    ],
  };
  assert.deepEqual(cesticaUTocki([fc], 16.5025, 43.5205), { kc: "298/1", ko: "SPLIT" });
  assert.equal(cesticaUTocki([fc], 16.501, 43.53), null);
  const pl = [
    { id: "a", granice: [[43.5, 16.4], [43.51, 16.41]] as [[number, number], [number, number]] },
    { id: "b", granice: [[43.505, 16.405], [43.52, 16.42]] as [[number, number], [number, number]] },
  ];
  assert.deepEqual(plociceZaTocku(pl, 16.407, 43.507), ["a", "b"]);
  assert.deepEqual(plociceZaTocku(pl, 16.415, 43.515), ["b"]);
});

test("mjestoNaPpugu: točka na listu, a ne u legendi ni izvan lista", () => {
  // list 0,1° × 0,1°: x raste s dužinom, y pada sa širinom
  const l = { id: "ppug-x", broj: "4.4", udio: [10, 0, -164, 0, -10, 436] as [number, number, number, number, number, number], kartaDo: 0.83 };
  assert.deepEqual(mjestoNaPpugu([l], 16.45, 43.55)?.tocka.map((v) => Math.round(v * 100) / 100), [0.5, 0.5]);
  assert.equal(mjestoNaPpugu([l], 16.49, 43.55), null); // legenda
  assert.equal(mjestoNaPpugu([l], 16.3, 43.55), null);
});
