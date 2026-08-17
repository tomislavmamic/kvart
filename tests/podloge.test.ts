import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("EPSG:4326 se traži samo ondje gdje Web Mercatora nema", () => {
  // Provjereno GetCapabilities-om 14. 8. 2026.: `dof`, `tk` i `hok` nude
  // EPSG:3857, a `inspire/orthophoto_2023` ne. Traženje u 4326 tjera
  // poslužitelj da svaku pločicu preprojicira umjesto da je posluži iz
  // predmemorije, pa je ovo postavka koja se plaća — i jedna se podloga
  // ovdje lako previdi pri sljedećem dodavanju.
  for (const b of BASE_LAYERS) {
    if (b.wmsCrs !== "EPSG:4326") continue;
    assert.ok(
      b.url.includes("/inspire/"),
      `podloga ${b.id} traži 4326, a njezin servis nudi Web Mercator`,
    );
  }
});

test("nijedna podloga ne traži 4326 bez potrebe", () => {
  const u4326 = BASE_LAYERS.filter((b) => b.wmsCrs === "EPSG:4326").map((b) => b.id);
  assert.deepEqual(u4326, ["dof"]);
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

test("izohipse su odrezane na kvart, ne na obuhvat karte", async () => {
  // Reljef se računa na cijelom obuhvatu karte jer sjenčanje i mreža visina
  // to trebaju. Izohipse ne: one su JEDNA datoteka koju preglednik povuče
  // cijelu, pa svaki nepotrebni kilometar plaća svaki posjetitelj. Prvi put
  // su bile neodrezane — 18,0 km² za kvart od 1,7 km², 1,24 MB umjesto 0,11.
  const [izohipse, granica] = await Promise.all(
    ["izohipse", "granica"].map(async (ime) =>
      JSON.parse(
        await readFile(
          new URL(`../public/geo/${ime}.geojson`, import.meta.url),
          "utf8",
        ),
      ),
    ),
  );
  const okvir = (fc: { features: { geometry: unknown }[] }) => {
    const xs: number[] = [];
    const ys: number[] = [];
    const hodaj = (c: unknown): void => {
      if (!Array.isArray(c) || c.length === 0) return;
      if (typeof c[0] === "number") {
        xs.push(c[0] as number);
        ys.push(c[1] as number);
        return;
      }
      for (const k of c) hodaj(k);
    };
    for (const f of fc.features) {
      const g = f.geometry as { coordinates?: unknown } | null;
      if (g?.coordinates) hodaj(g.coordinates);
    }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };

  const i = okvir(izohipse);
  const g = okvir(granica);
  // Dopuštena rezerva je 120 m (REZERVA_M u izvedi-reljef.py, isto kao
  // BUFFER_KM u clip-lib.ts); prag je 200 m da mjerenje po kutu ne pukne.
  const mLon = 111_320 * Math.cos((43.52 * Math.PI) / 180);
  const preko = [
    (g[0] - i[0]) * mLon,
    (g[1] - i[1]) * 110_540,
    (i[2] - g[2]) * mLon,
    (i[3] - g[3]) * 110_540,
  ];
  for (const m of preko) {
    assert.ok(m < 200, `izohipse sežu ${Math.round(m)} m preko granice kvarta`);
  }
  // I doista pokrivaju kvart, a ne samo njegov djelić.
  assert.ok(i[0] <= g[0] && i[1] <= g[1] && i[2] >= g[2] && i[3] >= g[3]);
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
