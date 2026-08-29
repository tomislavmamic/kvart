import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

import {
  OKVIR,
  POSTAJE,
  POSTAJE_VJETRA,
  VRH_PLOHE,
} from "../src/generated/karepovac-karta";
import { MJERENJA } from "../src/generated/karepovac-mjerenja";

/**
 * Položaj službene postaje — jedna točka, pet mjesta koja se na nju pozivaju.
 *
 * Dok je koordinata bila zaokružena na tri decimale (43,516 / 16,517), izgledala
 * je kao „jugoistočni rub plohe” i tako je i pisala. Točka nađena na terenu
 * pokazuje nešto drugo: postaja stoji u udolini prema Kamenu, na suprotnoj
 * strani odlagališta od Dračevca i Bilica. To nije kozmetika — na tom se
 * jednom prijemniku bazdari jačina izvora u modelu raspršenja, pa greška u
 * njegovu mjestu ulazi u svaku brojku koju model dalje izgovori.
 *
 * Zato ove provjere paze da se pet zapisa te iste točke ne raziđu: izvor u
 * Pythonu, dva generirana modula, geojson za `/karta` i LiDAR reljef.
 */

const LAT = 43.516650515206784;
const LON = 16.51691228544307;

const PY = readFileSync("scripts/postaje.py", "utf8");
const GEOJSON = JSON.parse(
  readFileSync("public/geo/postaje-zraka.geojson", "utf8"),
) as {
  features: {
    properties: Record<string, number | string>;
    geometry: { coordinates: [number, number] };
  }[];
};

test("koordinata postaje stoji na jednom mjestu i nigdje se ne raziđe", () => {
  assert.match(
    PY,
    new RegExp(`^LAT_POSTAJE, LON_POSTAJE = ${LAT}, ${LON}$`, "m"),
    "scripts/postaje.py je izvor iz kojega sve ostalo izlazi",
  );

  for (const p of POSTAJE) {
    assert.equal(p.lat, LAT);
    assert.equal(p.lon, LON);
  }
  for (const p of MJERENJA.postaje) {
    assert.equal(p.lat, LAT);
    assert.equal(p.lon, LON);
  }
  assert.equal(GEOJSON.features.length, POSTAJE.length);
  for (const f of GEOJSON.features) {
    assert.deepEqual(f.geometry.coordinates, [LON, LAT]);
  }

  // Zaokružena koordinata iz očevidnika ne smije se vratiti kroz stražnja
  // vrata: ona sjeda 72 m južnije, u drugu ćeliju rešetke modela.
  assert.doesNotMatch(PY, /43\.516,\s*16\.517/);
});

test("postaja je s druge strane odlagališta nego kvart", () => {
  // Ovo je tvrdnja koju sučelje izgovara na `/karepovac/postaje` i u natpisu
  // sloja u `/karta`. Ako ikad prestane vrijediti, tekst laže prije nego što
  // itko primijeti.
  for (const p of POSTAJE) {
    assert.ok(
      p.kutDracevac > 90 && p.kutBilice > 90,
      `smjer prema postaji (${p.azimut}°) mora biti na suprotnoj polovici od `
        + `smjera prema kvartu; sada je ${p.kutDracevac}° / ${p.kutBilice}°`,
    );
    assert.ok(p.odPlohe > 400 && p.odPlohe < 1200, "udaljenost od sredine plohe");
    assert.ok(
      VRH_PLOHE - p.visina > 50,
      "postaja je u udolini, desetcima metara ispod vrha plohe",
    );
  }
});

test("postaja pada izvan okvira kartica, i prikaz to zna", () => {
  // Kartice na `/karepovac` ne mogu je nacrtati ondje gdje jest. Znak na rubu
  // ima smisla samo dok se ovo drži: ako točka ikad uđe u okvir, `uOkviru`
  // mora to reći, jer inače prikaz crta strelicu u prazno.
  for (const p of POSTAJE) {
    assert.equal(p.uOkviru, false);
    assert.ok(p.y > OKVIR.visina, "točka je južno od donjeg ruba okvira");
    const izvan = (OKVIR.granice.jug - p.lat) * 110574;
    assert.ok(
      Math.abs(izvan - p.izvanOkviraM) < 2,
      `izvanOkviraM (${p.izvanOkviraM}) mora odgovarati granicama okvira`,
    );
  }
});

test("visina postaje i vrh plohe očitani su iz LiDAR reljefa", () => {
  // Brojke u sučelju („40 m, vrh plohe je 74 m više”) nisu upisane rukom nego
  // izvedene. Provjera ih ponovno izvodi iz iste mreže koja stoji u repozitoriju.
  const zaglavlje = JSON.parse(
    readFileSync("public/geo/reljef/visine.json", "utf8"),
  ) as {
    zapad: number;
    jug: number;
    istok: number;
    sjever: number;
    stupaca: number;
    redaka: number;
    prazno: number;
  };
  const raspakirano = gunzipSync(readFileSync("public/geo/reljef/visine.bin.gz"));
  const mreza = new Int16Array(
    raspakirano.buffer,
    raspakirano.byteOffset,
    raspakirano.byteLength / 2,
  );
  assert.equal(mreza.length, zaglavlje.stupaca * zaglavlje.redaka);

  const stupac = Math.round(
    ((LON - zaglavlje.zapad) / (zaglavlje.istok - zaglavlje.zapad))
      * zaglavlje.stupaca,
  );
  const redak = Math.round(
    ((zaglavlje.sjever - LAT) / (zaglavlje.sjever - zaglavlje.jug))
      * zaglavlje.redaka,
  );
  const dm = mreza[redak * zaglavlje.stupaca + stupac];
  assert.notEqual(dm, zaglavlje.prazno, "mreža na toj točki mora imati podatak");
  assert.equal(dm / 10, POSTAJE[0].visina);

  for (const p of MJERENJA.postaje) {
    assert.equal(p.visina, POSTAJE[0].visina);
  }
});

/**
 * Anemometri: druga polovica iste ograde.
 *
 * Udaljenosti su prije stajale kao ručno upisane brojke u `src/lib/vjetar.ts`,
 * bez koordinate i bez referentne točke — dakle bez ičega čime bi se provjerile.
 * Sada izlaze iz `scripts/postaje_vjetra.py` kroz generirani modul, pa ovdje
 * stoji ono što se o njima tvrdi u sučelju.
 */

const PY_VJETAR = readFileSync("scripts/postaje_vjetra.py", "utf8");
const GEOJSON_VJETAR = JSON.parse(
  readFileSync("public/geo/postaje-vjetra.geojson", "utf8"),
) as {
  features: {
    properties: Record<string, number | string | null>;
    geometry: { coordinates: [number, number] };
  }[];
};

test("koordinate vjetrokaza izlaze iz jednog izvora", () => {
  assert.equal(GEOJSON_VJETAR.features.length, POSTAJE_VJETRA.length);
  for (const [i, p] of POSTAJE_VJETRA.entries()) {
    assert.match(
      PY_VJETAR,
      new RegExp(`\\b${p.lat}\\b`),
      `${p.naziv}: širina mora stajati u scripts/postaje_vjetra.py`,
    );
    assert.deepEqual(GEOJSON_VJETAR.features[i].geometry.coordinates, [
      p.lon,
      p.lat,
    ]);
  }
});

test("nijedan anemometar nije na Karepovcu, i to piše brojkom", () => {
  // Rečenica „vjetar se mjeri od 1,1 do 16 km od kvarta, nijednom na
  // Karepovcu” stoji na stranici o zraku i u natpisu sloja. Ovdje se drži uz
  // podatak: najbliža postaja je Neverinov Vrboran na 1,1 km, a nijedna ne
  // stoji na samoj plohi.
  const najbliza = Math.min(...POSTAJE_VJETRA.map((p) => p.odKvartaKm));
  assert.equal(najbliza, 1.1, "tekst tvrdi da najbliža stoji na 1,1 km");
  for (const p of POSTAJE_VJETRA) {
    assert.ok(
      p.odPloheKm >= 1,
      `${p.naziv} je ${p.odPloheKm} km od plohe — na Karepovcu se vjetar ne mjeri`,
    );
  }

  // Rečenica „državni anemometri stoje četiri do šesnaest kilometara zapadno”
  // sada vrijedi samo za državne mreže; Neverinove postaje stoje i bliže i na
  // drugim stranama.
  const drzavne = POSTAJE_VJETRA.filter((p) => p.mreza !== "Neverin.hr");
  for (const p of drzavne) {
    assert.ok(
      p.odKvartaKm >= 4,
      `${p.naziv} je na ${p.odKvartaKm} km — tekst tvrdi da je najbliža državna 4 km`,
    );
    assert.ok(p.odPloheKm > p.odKvartaKm, "ploha je istočnije od kvarta");
    assert.ok(
      p.azimutOdKvarta > 200 && p.azimutOdKvarta < 300,
      `${p.naziv} mora biti zapadno od kvarta, a azimut je ${p.azimutOdKvarta}°`,
    );
  }

  // Zračna luka i DHMZ-ov „Split-aerodrom” su isto mjesto; ako se ikad
  // raziđu, tablica na stranici prestaje ih smjeti spajati u jedan redak.
  const luka = POSTAJE_VJETRA.find((p) => p.oznaka === "ldsp");
  const dhmz = POSTAJE_VJETRA.find((p) => p.oznaka === "aerodrom");
  assert.ok(luka && dhmz);
  assert.equal(luka.lat, dhmz.lat);
  assert.equal(luka.lon, dhmz.lon);
});
