import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  doRuba,
  imenicaUz,
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

test("stanjeTocke: crveno prije plana na snazi, izvan GUP-a, preporuka, GUP", () => {
  const upu = { ...oblik(poligon(kvadrat(16.4, 43.5, 0.02))), broj: 18, naziv: "UPU Dračevac 2" };
  const s: Slojevi = {
    komadi: [{ ...oblik(poligon(kvadrat(16.4, 43.5, 0.005))), podrucje: "sanacija", upu: 18 }],
    cestice: [{ ...oblik(poligon(kvadrat(16.401, 43.501, 0.002))), kc: "406/3", ko: "SPLIT", m2: 850, neizgradjena: true }],
    sporne: [
      {
        ...oblik(poligon(kvadrat(16.401, 43.501, 0.002))),
        kc: "406/3",
        ko: "SPLIT",
        m2: 850,
        podrucje: "sanacija",
        razlozi: ["sanacija"],
        udio: 12,
      },
    ],
    plohe: [
      { ...oblik(poligon(kvadrat(16.4, 43.5, 0.004))), ha: 8, zgrade: 25, sRjesenjem: 3, udio: 12, manjina: true },
    ],
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
    assert.deepEqual(z.sporna?.razlozi, ["sanacija"]);
    assert.equal(z.ploha?.udio, 12);
    // najbliži rub je 0,002° zemljopisne dužine zapadno ≈ 161 m
    assert.ok(z.doRuba > 150 && z.doRuba < 170, `${z.doRuba}`);
  }
  const bezCestice = stanjeTocke(s, 16.4045, 43.5045);
  assert.equal(bezCestice.rezim === "zabrana" && bezCestice.cestica, null);
  assert.equal(bezCestice.rezim === "zabrana" && bezCestice.sporna, null);
  // izvan plohe s brojem zgrada
  assert.equal(bezCestice.rezim === "zabrana" && bezCestice.ploha, null);
  assert.equal(stanjeTocke(s, 16.412, 43.512).rezim, "vazeci");
  assert.equal(stanjeTocke(s, 16.418, 43.502).rezim, "preporuka");
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
});

test("zabrana-2025.geojson: komadi zbrojeni daju iskazanu površinu", () => {
  const d = JSON.parse(readFileSync(path.join(process.cwd(), "public/geo/gup-grad/zabrana-2025.geojson"), "utf8"));
  const komadi = d.features.filter((f: { properties: { vrsta: string } }) => ["sanacija", "preobrazba", "neuredeno"].includes(f.properties.vrsta));
  const ha = komadi.reduce((s: number, f: { properties: { ha: number } }) => s + f.properties.ha, 0);
  // odbačene mrvice ispod 150 m² — razlika je unutar pola posto
  assert.ok(Math.abs(ha - d.zbroj.ukupno_ha) / d.zbroj.ukupno_ha < 0.005, `${ha} vs ${d.zbroj.ukupno_ha}`);
  assert.equal(d.features.filter((f: { properties: { vrsta: string } }) => f.properties.vrsta === "gup").length, 1);
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
