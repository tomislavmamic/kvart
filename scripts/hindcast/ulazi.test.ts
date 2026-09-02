import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import {
  MAPA_AZO,
  MAPA_ZAVOD,
  dojaveUSate,
  kakvocaNiza,
  najboljaUsporedba,
  opazanjaAzo,
  opazanjaZavoda,
  pokrivenost,
  prijemniciDojava,
  procitajAzo,
  procitajLdsp,
  procitajMarjan,
  procitajOpenMeteo,
  satAzo,
  satiRazdoblja,
  sloziUlaze,
  slug,
  spojiAzoVjetar,
  ucitajOpazanja,
  usporediNizove,
  type IzvoriUlaza,
  type NizVjetra,
  type RedDojave,
} from "./ulazi";
import type { Opazanje } from "./tipovi";

const SAT = 3_600_000;
const T0 = Date.UTC(2026, 7, 27, 18); // 2026-08-27T18:00Z
const iso = (h: number) => new Date(T0 + h * SAT).toISOString();

// --- AZO ---------------------------------------------------------------------

test("AZO-ov `vrijeme` je kraj sata, pa početak pada sat ranije", () => {
  assert.equal(satAzo(Date.UTC(2025, 7, 22, 23)), "2025-08-22T22:00:00.000Z");
  const niz = procitajAzo([
    { vrijednost: 2.277, mjernaJedinica: "µg/m3", vrijeme: Date.UTC(2025, 7, 22, 23) },
    { vrijednost: "x", vrijeme: Date.UTC(2025, 7, 23, 0) },
    { vrijednost: 1, vrijeme: null },
    null,
  ]);
  assert.deepEqual([...niz], [["2025-08-22T22:00:00.000Z", 2.277]]);
  assert.equal(procitajAzo({ nije: "niz" }).size, 0);
});

test("AZO-ov vjetar traži i brzinu i smjer, a negativna brzina je kvar", () => {
  const brzine = new Map([
    [iso(0), 1.5],
    [iso(1), -999],
    [iso(2), 2],
  ]);
  const smjerovi = new Map([
    [iso(0), 365.5],
    [iso(1), 90],
  ]);
  const v = spojiAzoVjetar(brzine, smjerovi);
  assert.deepEqual([...v], [[iso(0), { smjerOd: 5.5, brzina: 1.5 }]]);
});

test("H₂S s AZO-a: negativno i točna nula ispadaju, ostalo je opažanje bez oznake granice", () => {
  const o = opazanjaAzo([
    { vrijednost: 0.4, vrijeme: T0 + SAT },
    { vrijednost: -0.2, vrijeme: T0 + 2 * SAT },
    { vrijednost: 0, vrijeme: T0 + 3 * SAT },
  ]);
  assert.deepEqual(o, [{ sat: iso(0), vrijednost: 0.4, ispodGranice: false, izvor: "azo308" }]);
});

// --- Marjan, LDSP ------------------------------------------------------------

test("Meteostat: km/h u m/s, prazna polja i krivi redci ispadaju", () => {
  const csv = [
    "2026-03-09,19,13.2,7.8,70,,,0,0.0,,1024.7,,",
    "2026-03-09,20,12.8,5.7,62,,,60,11.0,,1025.0,,",
    "2026-03-09,21,12.2,5.1,62,,,,7.0,,1025.7,,",
    "2026-03-09,22,12.2,5.1,62,,,90,,,1025.7,,",
    "smeće",
    "",
  ].join("\n");
  const v = procitajMarjan(csv);
  assert.deepEqual(
    [...v.keys()],
    ["2026-03-09T19:00:00.000Z", "2026-03-09T20:00:00.000Z"],
  );
  const m = v.get("2026-03-09T20:00:00.000Z")!;
  assert.equal(m.smjerOd, 60);
  assert.ok(Math.abs(m.brzina - 11 / 3.6) < 1e-9);
});

test("LDSP: očitanja unutar sata usrednjuju se vektorski, `M` se preskače", () => {
  const csv = [
    "station,valid,drct,sknt",
    "LDSP,2025-07-25 00:00,350.00,3.00",
    "LDSP,2025-07-25 00:30,10.00,3.00",
    "LDSP,2025-07-25 01:00,M,2.00",
    "LDSP,2025-07-25 02:00,180.00,M",
    "LDSP,2025-07-25 03:00,270.00,10.00",
  ].join("\n");
  const v = procitajLdsp(csv);
  assert.deepEqual([...v.keys()], ["2025-07-25T00:00:00.000Z", "2025-07-25T03:00:00.000Z"]);
  const nula = v.get("2025-07-25T00:00:00.000Z")!;
  assert.ok(Math.abs(nula.smjerOd) < 1e-9 || Math.abs(nula.smjerOd - 360) < 1e-9);
  // Duljina srednjeg vektora dvaju očitanja 20° razmaknutih: 3 kn · cos 10°.
  assert.ok(Math.abs(nula.brzina - 3 * 0.514444 * Math.cos((10 * Math.PI) / 180)) < 1e-9);
  const tri = v.get("2025-07-25T03:00:00.000Z")!;
  assert.ok(Math.abs(tri.smjerOd - 270) < 1e-9);
  assert.ok(Math.abs(tri.brzina - 5.14444) < 1e-9);
});

// --- Open-Meteo --------------------------------------------------------------

test("Open-Meteo: sat bez zone je UTC, dubina ima pod od 25 m, rupe ostaju rupe", () => {
  const niz = procitajOpenMeteo({
    hourly: {
      time: ["2026-08-27T18:00", "2026-08-27T19:00", "2026-08-27T20:00"],
      wind_speed_10m: [2.4, null, 1],
      wind_direction_10m: [123, 200, null],
      boundary_layer_height: [12.4, 480.6, null],
      shortwave_radiation: [0, null, 5],
      cloud_cover: [10, 20, null],
      temperature_2m: [25.1, null, null],
      precipitation: [0, 0, null],
    },
  });
  assert.deepEqual([...niz.vjetar], [[iso(0), { smjerOd: 123, brzina: 2.4 }]]);
  assert.deepEqual([...niz.dubine], [[iso(0), 25], [iso(1), 481]]);
  assert.deepEqual(niz.okolnosti.get(iso(1)), {
    sunce: null,
    oblaci: 20,
    temperatura: null,
    oborina: 0,
  });
  assert.equal(procitajOpenMeteo(null).vjetar.size, 0);
});

// --- Zavod -------------------------------------------------------------------

const K1 = `<table><tr><th>datum</th><th>sat</th><th>H<sub>2</sub>S</th></tr>
<tr><td>21.08.2026</td><td>3:00</td><td>-</td></tr>
<tr><td>21.08.2026</td><td>2:00</td><td>&lt; 0,1</td></tr>
<tr><td>21.08.2026</td><td>1:00</td><td>2,758</td></tr></table>`;

test("Zavod: `-` ispada, `< 0,1` je pola granice i tako piše, sat je početak u UTC-u", () => {
  const o = opazanjaZavoda(K1, "H2S", "zavod-k1");
  // Ljetno vrijeme: „1:00” je kraj sata 0–1 h mjesno, dakle 22 h UTC dan
  // prije; „2:00” je 23 h UTC. Redak s „-” ispada.
  assert.deepEqual(o, [
    { sat: "2026-08-20T22:00:00.000Z", vrijednost: 2.758, ispodGranice: false, izvor: "zavod-k1" },
    { sat: "2026-08-20T23:00:00.000Z", vrijednost: 0.05, ispodGranice: true, izvor: "zavod-k1" },
  ]);
  assert.deepEqual(opazanjaZavoda(K1, "metil+etilmerkaptan", "zavod-k2"), []);
});

// --- Dojave ------------------------------------------------------------------

const DOJAVE: RedDojave[] = [
  {
    id: 1,
    occurredAt: "2026-08-27T06:30:00.000Z",
    endedAt: "2026-08-27T07:30:00.000Z",
    smelled: true,
    strength: "osjetno",
    place: "Dračevac 7B",
    reporterId: "a",
    lat: null,
    lng: null,
    hidden: false,
  },
  {
    id: 2,
    occurredAt: "2026-08-27T07:10:00.000Z",
    endedAt: null,
    smelled: true,
    strength: "jako",
    place: "Dračevac 7B",
    reporterId: "a",
    lat: null,
    lng: null,
    hidden: false,
  },
  {
    id: 3,
    occurredAt: "2026-08-27T07:20:00.000Z",
    endedAt: null,
    smelled: false,
    strength: null,
    place: "Dračevac 7B",
    reporterId: "a",
    lat: null,
    lng: null,
    hidden: false,
  },
  {
    id: 4,
    occurredAt: "2026-08-28T10:00:00.000Z",
    endedAt: "2026-08-28T20:00:00.000Z",
    smelled: true,
    strength: "slabo",
    place: "Zvonimirova ulica Solin",
    reporterId: "b",
    lat: 43.536,
    lng: 16.49,
    hidden: false,
  },
  {
    id: 5,
    occurredAt: "2026-08-28T12:00:00.000Z",
    endedAt: null,
    smelled: true,
    strength: "nepodnosivo",
    place: "Matoševa ulica 59, Solin",
    reporterId: null,
    lat: null,
    lng: null,
    hidden: true,
  },
  {
    id: 6,
    occurredAt: "2026-08-28T13:00:00.000Z",
    endedAt: null,
    smelled: true,
    strength: "slabo",
    place: "nepoznato mjesto",
    reporterId: "c",
    lat: null,
    lng: null,
    hidden: false,
  },
];

test("dojave: raspon do kraja − 1 ms, isti nos u istom satu jednom, jače prevlada", () => {
  const sati = dojaveUSate(DOJAVE);
  const a = sati.filter((s) => s.dojavitelj === "a");
  // 06.30–07.30 dotiče sate 6 i 7; u satu 7 „jako” (#2) nadjača „osjetno” (#1)
  // i „ne smrdi” (#3).
  assert.deepEqual(
    a.map((s) => [s.sat, s.tezina, s.idDojave]),
    [
      ["2026-08-27T06:00:00.000Z", 1.7, 1],
      ["2026-08-27T07:00:00.000Z", 2.4, 2],
    ],
  );
  assert.ok(a.every((s) => s.prijemnik === "dracevac-7b" && s.smrdi));
});

test("dojave: raspon se reže na šest sati, skrivene i bez mjesta ispadaju", () => {
  const sati = dojaveUSate(DOJAVE);
  const b = sati.filter((s) => s.dojavitelj === "b");
  assert.equal(b.length, 6, "10–20 h je deset sati, ali broji se šest");
  assert.equal(b[0].sat, "2026-08-28T10:00:00.000Z");
  assert.equal(b[5].sat, "2026-08-28T15:00:00.000Z");
  assert.ok(b.every((s) => s.prijemnik === "dojava-43.5360-16.4900" && s.tezina === 1));
  assert.equal(sati.filter((s) => s.idDojave === 5).length, 0, "skrivena");
  assert.equal(sati.filter((s) => s.idDojave === 6).length, 0, "bez mjesta");
});

test("prijemnici dojava: jedno mjesto, jedan prijemnik; skrivene ne stvaraju mjesto", () => {
  const p = prijemniciDojava(DOJAVE);
  assert.deepEqual(
    p.map((x) => x.ime),
    ["dojava-43.5360-16.4900", "dracevac-7b"],
  );
  assert.deepEqual(p[1], {
    ime: "dracevac-7b",
    lat: 43.527789,
    lon: 16.50401,
    opis: "Dračevac 7B",
  });
  // Isto i iz satnih opažanja, koja nose samo ime prijemnika (mjesta iz
  // `data/dojave.json`).
  const izSati = prijemniciDojava(dojaveUSate(DOJAVE)).map((x) => x.ime);
  assert.ok(izSati.includes("dracevac-7b"));
  assert.equal(slug("Matoševa ulica 59, Solin"), "matoseva-ulica-59-solin");
  assert.equal(slug("Đurđevac"), "durdevac");
});

// --- Slaganje ulaza ----------------------------------------------------------

function niz(parovi: [number, number, number][]): NizVjetra {
  return new Map(parovi.map(([h, smjerOd, brzina]) => [iso(h), { smjerOd, brzina }]));
}

const IZVORI: IzvoriUlaza = {
  vjetar: {
    split3: niz([[0, 10, 1]]),
    split2: niz([[0, 20, 2], [1, 21, 2]]),
    marjan: niz([[0, 30, 3], [2, 32, 3]]),
    ldsp: niz([[0, 40, 4], [2, 42, 4], [3, 43, 4]]),
    vrboran: new Map(),
    era5: niz([[0, 50, 5], [1, 51, 5], [2, 52, 5], [3, 53, 5], [4, 54, 5]]),
    prognoza: niz([[0, 60, 6], [2, 62, 6]]),
  },
  dubine: {
    prognoza: new Map([[iso(0), 300]]),
    era5: new Map([[iso(0), 400], [iso(1), 500]]),
  },
  okolnosti: {
    prognoza: new Map([[iso(0), { sunce: 1, oblaci: 1, temperatura: 1, oborina: 1 }]]),
    era5: new Map([[iso(1), { sunce: 2, oblaci: 2, temperatura: 2, oborina: 2 }]]),
  },
};

const RAZDOBLJE = { od: iso(0), do: iso(6) };

test("razdoblje: početak uključivo, kraj isključivo, po punim satima", () => {
  assert.deepEqual(satiRazdoblja({ od: "2026-08-27T18:20:00Z", do: iso(2) }), [iso(0), iso(1)]);
  assert.throws(() => satiRazdoblja({ od: "jučer", do: "danas" }));
});

test("proizvodnja: Split-3, pa Split-2, pa prognoza, pa ERA5 — i svaki sat kaže odakle je", () => {
  const u = sloziUlaze("proizvodnja", RAZDOBLJE, IZVORI);
  assert.equal(u.length, 6);
  assert.deepEqual(
    u.map((s) => (s.vjetar ? [s.vjetar.izvor, s.vjetar.smjerOd] : null)),
    [["split3", 10], ["split2", 21], ["prognoza", 62], ["era5", 53], ["era5", 54], null],
  );
  assert.ok(u.every((s) => !s.vjetar || s.vjetar.izvorBrzine === undefined));
  assert.deepEqual(u[0].dubina, { m: 300, izvor: "prognoza" });
  assert.deepEqual(u[1].dubina, { m: 500, izvor: "era5" });
  assert.equal(u[2].dubina, null);
  assert.equal(u[0].okolnosti?.izvor, "prognoza");
  assert.equal(u[1].okolnosti?.izvor, "era5");
  assert.equal(u[2].okolnosti, null);
});

test("spoj: smjer sa Split-3/Marjana/LDSP-a, brzina s Marjana/LDSP-a/ERA5", () => {
  const u = sloziUlaze("spoj", RAZDOBLJE, IZVORI);
  assert.deepEqual(
    u.map((s) => s.vjetar && [s.vjetar.izvor, s.vjetar.izvorBrzine, s.vjetar.smjerOd, s.vjetar.brzina]),
    [
      ["split3", "marjan", 10, 3],
      null,
      ["marjan", "marjan", 32, 3],
      ["ldsp", "ldsp", 43, 4],
      null,
      null,
    ],
  );
});

test("spoj bez otvorene postaje zadržava brzinu s postaje smjera i to kaže", () => {
  const izvori: IzvoriUlaza = {
    ...IZVORI,
    vjetar: { ...IZVORI.vjetar, marjan: new Map(), ldsp: new Map(), era5: new Map() },
  };
  const [u] = sloziUlaze("spoj", { od: iso(0), do: iso(1) }, izvori);
  assert.deepEqual(u.vjetar, { smjerOd: 10, brzina: 1, izvor: "split3", izvorBrzine: "split3" });
});

test("pojedinačni izvor koristi samo sebe; nepoznato pravilo je greška", () => {
  const u = sloziUlaze("marjan", RAZDOBLJE, IZVORI);
  assert.deepEqual(
    u.map((s) => s.vjetar?.izvor ?? null),
    ["marjan", null, "marjan", null, null, null],
  );
  assert.throws(() => sloziUlaze("vrboran" as never, RAZDOBLJE, IZVORI));
});

test("pokrivenost broji po izvoru, spoj s dvije postaje zasebno", () => {
  const p = pokrivenost(sloziUlaze("spoj", RAZDOBLJE, IZVORI));
  assert.deepEqual(p, {
    poIzvoru: { "split3+marjan": 1, marjan: 1, ldsp: 1 },
    bezVjetra: 3,
    ukupno: 6,
  });
});

// --- Usporedba nizova --------------------------------------------------------

test("usporedba nizova nalazi pomak od sat vremena i prepoznaje isti uređaj", () => {
  const vrijednosti = [1.1, 2.2, 3.3, 4.4, 5.5, 6.6];
  const a: Opazanje[] = vrijednosti.map((v, i) => ({
    sat: iso(i + 1),
    vrijednost: v,
    ispodGranice: false,
    izvor: "azo308",
  }));
  const b: Opazanje[] = vrijednosti.map((v, i) => ({
    sat: iso(i),
    vrijednost: v,
    ispodGranice: false,
    izvor: "zavod-k1",
  }));
  const u = usporediNizove(a, b);
  const najbolja = najboljaUsporedba(u)!;
  assert.equal(najbolja.pomak, -1);
  assert.equal(najbolja.identicnih, 6);
  assert.ok(Math.abs((najbolja.korelacija ?? 0) - 1) < 1e-9);
  assert.equal(u.find((x) => x.pomak === 0)!.identicnih, 0);
});

test("kakvoća niza: sati po mjesecu, ispod granice, najdulji zaglavljeni niz", () => {
  const o: Opazanje[] = [
    { sat: iso(0), vrijednost: 0.05, ispodGranice: true, izvor: "zavod-k1" },
    { sat: iso(1), vrijednost: 0.05, ispodGranice: true, izvor: "zavod-k1" },
    { sat: iso(2), vrijednost: 0.7, ispodGranice: false, izvor: "zavod-k1" },
  ];
  assert.deepEqual(kakvocaNiza(o), { "2026-08": { sati: 3, ispodGranice: 2, najduljiIsti: 2 } });
});

// --- Prava predmemorija (samo kad postoji) ------------------------------------

test("AZO 308 i Zavod k1 su isti uređaj, a AZO-ov sat je kraj sata", {
  skip: !existsSync(MAPA_AZO) || !existsSync(MAPA_ZAVOD),
}, async () => {
  const { h2s } = await ucitajOpazanja();
  const azo = h2s.filter((o) => o.izvor === "azo308");
  const zavod = h2s.filter((o) => o.izvor === "zavod-k1");
  assert.ok(azo.length > 1000 && zavod.length > 1000);
  const najbolja = najboljaUsporedba(usporediNizove(azo, zavod))!;
  // Nakon pomaka koji `satAzo` već primjenjuje, nizovi se moraju poklapati bez
  // dodatnog pomaka.
  assert.equal(najbolja.pomak, 0);
  assert.ok(najbolja.identicnih / najbolja.n > 0.99, "isti uređaj, iste brojke");
});
