import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_LAYERS,
  BASE_SKUPINE,
  OVERLAY_LAYERS,
  MAP_VIEWS,
} from "../src/lib/map-views";

/**
 * Registar podloga.
 *
 * Provjerava se ono što se rukom ne primijeti dok netko ne otvori kartu:
 * podloga bez skupine ne bi se pojavila ni u jednoj ploči, a podloga bez
 * atribucije je kršenje uvjeta dozvole, ne kozmetička greška.
 */

test("svaka podloga pripada postojećoj skupini", () => {
  const skupine = new Set(BASE_SKUPINE.map((s) => s.id));
  for (const b of BASE_LAYERS) {
    assert.ok(
      skupine.has(b.skupina),
      `podloga ${b.id} ima nepoznatu skupinu ${b.skupina}`,
    );
  }
});

test("nijedna skupina nije prazna — inače je naslov bez sadržaja", () => {
  for (const s of BASE_SKUPINE) {
    assert.ok(
      BASE_LAYERS.some((b) => b.skupina === s.id),
      `skupina ${s.id} nema nijednu podlogu`,
    );
  }
});

test("id-evi podloga su jedinstveni", () => {
  const idevi = BASE_LAYERS.map((b) => b.id);
  assert.equal(new Set(idevi).size, idevi.length);
});

test("svaka podloga nosi atribuciju — to je uvjet dozvole", () => {
  for (const b of BASE_LAYERS) {
    assert.ok(b.attribution.trim().length > 0, `podloga ${b.id} bez atribucije`);
  }
});

test("zadana podloga postoji u registru", () => {
  // map-client.tsx kreće od "dof" i pada na BASE_LAYERS[0] za nepoznat id.
  assert.ok(BASE_LAYERS.some((b) => b.id === "dof"));
});

test("WMS podloga navodi sloj, XYZ podloga ima {z}/{x}/{y}", () => {
  for (const b of BASE_LAYERS) {
    if (b.type === "wms") {
      assert.ok(b.wmsLayers, `WMS podloga ${b.id} ne navodi wmsLayers`);
    } else {
      for (const znak of ["{z}", "{x}", "{y}"]) {
        assert.ok(
          b.url.includes(znak),
          `XYZ podloga ${b.id} nema ${znak} u predlošku`,
        );
      }
    }
  }
});

test("podloga s vlastitim pločicama ograničava maxNativeZoom", () => {
  // Bez toga Leaflet iznad zadnjeg izrađenog zuma traži pločice kojih nema i
  // podloga nestane baš na mjerilu na kojem se gleda pojedina čestica.
  for (const b of BASE_LAYERS) {
    if (b.type === "xyz" && b.url.startsWith("/geo/")) {
      assert.ok(
        b.maxNativeZoom !== undefined,
        `lokalna podloga ${b.id} nema maxNativeZoom`,
      );
    }
  }
});

test("id podloge i id preklopnika se ne sudaraju", () => {
  // Adresa ih drži u odvojenim parametrima, ali isto ime za dvije različite
  // stvari je zamka za sljedeću izmjenu — sjenčanje je zato `sjencanje` kao
  // podloga i `reljef` kao poluprozirni preklopnik.
  const preklopnici = new Set(OVERLAY_LAYERS.map((o) => o.id));
  for (const b of BASE_LAYERS) {
    assert.ok(
      !preklopnici.has(b.id),
      `${b.id} postoji i kao podloga i kao preklopnik`,
    );
  }
});

test("svaki sloj koji pogled spominje postoji u registru", () => {
  // Iznimka je `katastar-vlasnistvo`: taj sloj imenuje fizičke osobe uz OIB,
  // pa se registrira samo pod `next dev` (vidi SAMO_LOKALNO u map-views.ts).
  // Pogled ga i dalje spominje, i to je ispravno — pod razvojem se pojavi, u
  // produkciji ga jednostavno nema.
  const SAMO_U_RAZVOJU = new Set(["katastar-vlasnistvo"]);
  const poznati = new Set(OVERLAY_LAYERS.map((o) => o.id));
  for (const v of MAP_VIEWS) {
    for (const id of v.layerIds) {
      if (SAMO_U_RAZVOJU.has(id)) continue;
      assert.ok(poznati.has(id), `pogled ${v.id} traži nepostojeći sloj ${id}`);
    }
  }
});

test("izohipse su registrirane i idu iz naše datoteke", () => {
  const izohipse = OVERLAY_LAYERS.find((o) => o.id === "izohipse");
  assert.ok(izohipse, "sloj izohipsi nije registriran");
  assert.equal(izohipse.type, "geojson");
  assert.equal(izohipse.url, "/geo/izohipse.geojson");
  assert.equal(izohipse.phase, 1);
});

test("sjenčanje se poslužuje lokalno, ne s DGU WMS-a", () => {
  // Anonimni DGU pristup otiskuje žig „GEOPORTAL” preko sredine pločice, a
  // reljef je jedina podloga na kojoj se gleda upravo sredina.
  const podloga = BASE_LAYERS.find((b) => b.id === "sjencanje");
  const preklopnik = OVERLAY_LAYERS.find((o) => o.id === "reljef");
  assert.ok(podloga && preklopnik);
  assert.ok(podloga.url.startsWith("/geo/reljef/"));
  assert.ok(preklopnik.url.startsWith("/geo/reljef/"));
});
