import assert from "node:assert/strict";
import test from "node:test";
import { BASE_LAYERS, MAP_MAX_BOUNDS } from "../src/lib/map-views";
import {
  adresaIzvora,
  okvir3857,
  okvir4326,
  PLOCICA_PX,
  podlogaZaPosluzivanje,
  uMrezi,
  uObuhvatu,
  zaglavljaGreske,
  zaglavljaPlocice,
  ZUM_DO,
  ZUM_OD,
} from "../src/lib/plocice";

/**
 * Račun pločica i ograde rute koja poslužuje podlogu.
 *
 * Naglasak je na ogradama. Kriv račun okvira vidi se odmah — karta ispadne
 * pomaknuta. Rupa u ogradi se NE vidi: ruta i dalje radi, samo je usput
 * postala otvoreni posrednik prema DGU-u, na naš račun i pod našim imenom.
 */

/**
 * Pločica standardne mreže koja na z16 sadrži KVART_CENTER (43,5249, 16,4993).
 * Indeksi su izvedeni iz same točke, ne prepisani s diska: imena datoteka u
 * public/geo/reljef/ pripadaju istoj mreži, ali pokrivaju širi prozor, pa
 * prva pločica odande nije ona u kojoj je središte kvarta.
 */
const SREDINA = { z: 16, x: 35771, y: 23949 };

test("okvir pločice u Mercatoru je kvadrat", () => {
  const o = okvir3857(SREDINA.z, SREDINA.x, SREDINA.y);
  const sirina = o.istok - o.zapad;
  const visina = o.sjever - o.jug;
  assert.ok(Math.abs(sirina - visina) < 1e-6, `${sirina} ≠ ${visina}`);
});

test("cijeli svijet na z0 seže od ruba do ruba", () => {
  const o = okvir4326(0, 0, 0);
  assert.ok(Math.abs(o.zapad + 180) < 1e-9);
  assert.ok(Math.abs(o.istok - 180) < 1e-9);
  // Web Mercator se prekida na ±85,051°, ne na polu.
  assert.ok(Math.abs(o.sjever - 85.0511287798) < 1e-6);
  assert.ok(Math.abs(o.jug + 85.0511287798) < 1e-6);
});

test("pločica se dijeli na četiri na sljedećem zumu", () => {
  const gore = okvir4326(15, 17885, 11972);
  const dolje = okvir4326(16, 35770, 23944);
  assert.ok(Math.abs(gore.zapad - dolje.zapad) < 1e-9);
  assert.ok(Math.abs(gore.sjever - dolje.sjever) < 1e-9);
  // Dijete pokriva točno polovicu roditeljeve stranice.
  const sirinaGore = gore.istok - gore.zapad;
  const sirinaDolje = dolje.istok - dolje.zapad;
  assert.ok(Math.abs(sirinaGore / 2 - sirinaDolje) < 1e-9);
});

test("pločica sredine kvarta doista pokriva kvart", () => {
  const o = okvir4326(SREDINA.z, SREDINA.x, SREDINA.y);
  assert.ok(o.zapad < 16.4993 && o.istok > 16.4993, `dužina: ${o.zapad}–${o.istok}`);
  assert.ok(o.jug < 43.5249 && o.sjever > 43.5249, `širina: ${o.jug}–${o.sjever}`);
});

test("u mreži su samo cijeli brojevi unutar raspona", () => {
  assert.ok(uMrezi(SREDINA.z, SREDINA.x, SREDINA.y));
  assert.equal(uMrezi(ZUM_OD - 1, 0, 0), false, "prenizak zum");
  assert.equal(uMrezi(ZUM_DO + 1, 0, 0), false, "previsok zum");
  assert.equal(uMrezi(16, -1, 0), false, "negativan stupac");
  assert.equal(uMrezi(16, 2 ** 16, 0), false, "stupac izvan mreže");
  assert.equal(uMrezi(16, 0, 2 ** 16), false, "redak izvan mreže");
  assert.equal(uMrezi(16.5, 1, 1), false, "necijeli zum");
  assert.equal(uMrezi(16, 1.5, 1), false, "necijeli stupac");
  assert.equal(uMrezi(NaN, 1, 1), false, "NaN");
});

test("obuhvat propušta kvart, a odbija ostatak svijeta", () => {
  assert.ok(uObuhvatu(SREDINA.z, SREDINA.x, SREDINA.y), "sredina kvarta");
  // Zagreb, Rim, Sydney — sve na istom zumu, sve izvan.
  const vani: [number, number, number][] = [
    [16, 35934, 23495], // Zagreb
    [16, 35283, 24347], // Rim
    [16, 60293, 38334], // Sydney
    [16, 0, 0], // rub svijeta
  ];
  for (const [z, x, y] of vani) {
    assert.equal(uObuhvatu(z, x, y), false, `pločica ${z}/${x}/${y} nije odbijena`);
  }
});

test("obuhvat prati MAP_MAX_BOUNDS, ne izmišljenu granicu", () => {
  // Na z18 je pločica ~150 m, dovoljno sitno da se rub testira precizno.
  const [[jug, zapad], [sjever, istok]] = MAP_MAX_BOUNDS;
  const uSredini = (a: number, b: number) => (a + b) / 2;
  const nadi = (lon: number, lat: number, z = 18) => {
    const n = 2 ** z;
    const x = Math.floor(((lon + 180) / 360) * n);
    const r = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    );
    return [z, x, y] as [number, number, number];
  };
  assert.ok(uObuhvatu(...nadi(uSredini(zapad, istok), uSredini(jug, sjever))));
  // Jasno izvan okvira po svakoj strani.
  assert.equal(uObuhvatu(...nadi(zapad - 0.05, uSredini(jug, sjever))), false);
  assert.equal(uObuhvatu(...nadi(istok + 0.05, uSredini(jug, sjever))), false);
  assert.equal(uObuhvatu(...nadi(uSredini(zapad, istok), jug - 0.05)), false);
  assert.equal(uObuhvatu(...nadi(uSredini(zapad, istok), sjever + 0.05)), false);
});

test("poslužuju se samo WMS podloge iz registra", () => {
  for (const b of BASE_LAYERS) {
    const nadena = podlogaZaPosluzivanje(b.id);
    if (b.type === "wms") assert.ok(nadena, `${b.id} bi se trebala posluživati`);
    else assert.equal(nadena, null, `${b.id} nije WMS i ne ide kroz rutu`);
  }
  assert.equal(podlogaZaPosluzivanje("nema-me"), null);
  assert.equal(podlogaZaPosluzivanje("../../etc/passwd"), null);
});

test("adresa izvora nosi ispravan CRS i redoslijed osi", () => {
  const mercator = BASE_LAYERS.find((b) => b.id === "dof-2011")!;
  const cetiri = BASE_LAYERS.find((b) => b.id === "dof")!;

  const uM = new URL(adresaIzvora(mercator, SREDINA.z, SREDINA.x, SREDINA.y));
  assert.equal(uM.searchParams.get("srs"), "EPSG:3857");
  assert.equal(uM.searchParams.get("version"), "1.1.1");
  const bM = uM.searchParams.get("bbox")!.split(",").map(Number);
  assert.ok(Math.abs(bM[0]) > 1000, "Mercator je u metrima, ne stupnjevima");

  const u4 = new URL(adresaIzvora(cetiri, SREDINA.z, SREDINA.x, SREDINA.y));
  assert.equal(u4.searchParams.get("srs"), "EPSG:4326");
  const b4 = u4.searchParams.get("bbox")!.split(",").map(Number);
  // WMS 1.1.1 traži x,y — dakle dužina, širina. Obrnut redoslijed je klasičan
  // izvor tiho pomaknute podloge, pa se provjerava izrijekom.
  assert.ok(b4[0] > 16 && b4[0] < 17, `zapad=${b4[0]} nije dužina`);
  assert.ok(b4[1] > 43 && b4[1] < 44, `jug=${b4[1]} nije širina`);
  assert.ok(b4[2] > b4[0] && b4[3] > b4[1], "granice nisu rastuće");
});

test("adresa izvora traži pločicu dogovorene veličine", () => {
  const b = BASE_LAYERS.find((x) => x.type === "wms")!;
  const u = new URL(adresaIzvora(b, SREDINA.z, SREDINA.x, SREDINA.y));
  assert.equal(u.searchParams.get("width"), String(PLOCICA_PX));
  assert.equal(u.searchParams.get("height"), String(PLOCICA_PX));
  assert.equal(u.searchParams.get("layers"), b.wmsLayers);
});

test("uspjeh se pamti dugo, greška gotovo nikako", () => {
  // Kad geoportal padne na minutu, ne smijemo tu minutu zapamtiti na godinu
  // dana i time sami sebi trajno razbiti podlogu.
  const ok = zaglavljaPlocice()["Cache-Control"];
  const greska = zaglavljaGreske()["Cache-Control"];
  assert.match(ok, /max-age=31536000/);
  assert.match(ok, /immutable/);
  assert.match(greska, /max-age=0/);
  assert.ok(!/immutable/.test(greska));
});
