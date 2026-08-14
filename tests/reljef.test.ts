import assert from "node:assert/strict";
import test from "node:test";
import type { Feature, Polygon } from "geojson";
import { MAP_MAX_BOUNDS } from "../src/lib/map-views";
import {
  celija,
  korakMetara,
  nagibUTocki,
  rasponCestice,
  terenUTocki,
  ucitajMrezu,
  visinaUTocki,
  type Mreza,
  type MrezaZaglavlje,
} from "../src/lib/reljef";

/**
 * Očitanje reljefa.
 *
 * Većina se ispituje nad izmišljenom mrežom s poznatim nagibom, jer se nad
 * pravim terenom ne zna koji je odgovor točan. Nad stvarnom mrežom ostaje
 * samo ono što bi se moglo tiho razići: obuhvat protiv MAP_MAX_BOUNDS i
 * veličina protiv zaglavlja.
 */

const PRAZNO = -32768;

/**
 * Mreža s ravnom kosinom koja raste prema istoku, `poCeliji` metara po ćeliji.
 *
 * Obuhvat se računa iz broja ćelija tako da ćelija bude ~3 m, kao u stvarnoj
 * mreži. To nije uljepšavanje: prag ispod kojeg se strana svijeta ne izriče
 * mjeri se u postocima nagiba, pa bi mreža s ćelijom od jednog stupnja svaku
 * kosinu proglasila ravnom i test bi mjerio pogrešnu stvar.
 */
const KORAK_TESTA = 3;

function kosina(
  stupaca = 5,
  redaka = 5,
  poCeliji = 10,
  prazne: [number, number][] = [],
): Mreza {
  const jug = 43.5;
  const zapad = 16.5;
  const dLat = KORAK_TESTA / 110_540;
  const dLon = KORAK_TESTA / (111_320 * Math.cos((43.5 * Math.PI) / 180));
  const zaglavlje: MrezaZaglavlje = {
    zapad,
    jug,
    istok: zapad + dLon * stupaca,
    sjever: jug + dLat * redaka,
    stupaca,
    redaka,
    prviRedakJe: "sjever",
    jedinica: "dm",
    prazno: PRAZNO,
    korakM: KORAK_TESTA,
    izvor: "test",
  };
  const podaci = new Int16Array(stupaca * redaka);
  for (let r = 0; r < redaka; r++) {
    for (let c = 0; c < stupaca; c++) {
      podaci[r * stupaca + c] = c * poCeliji * 10; // decimetri
    }
  }
  for (const [r, c] of prazne) podaci[r * stupaca + c] = PRAZNO;
  return { zaglavlje, podaci };
}

/** Sredina ćelije (r, c) u toj mreži. */
function sredina(m: Mreza, r: number, c: number): [number, number] {
  const z = m.zaglavlje;
  const dLon = (z.istok - z.zapad) / z.stupaca;
  const dLat = (z.sjever - z.jug) / z.redaka;
  return [z.zapad + (c + 0.5) * dLon, z.sjever - (r + 0.5) * dLat];
}

test("ćelija vraća visinu u metrima, a izvan mreže null", () => {
  const m = kosina();
  assert.equal(celija(m, 0, 0), 0);
  assert.equal(celija(m, 0, 3), 30);
  assert.equal(celija(m, -1, 0), null);
  assert.equal(celija(m, 0, 5), null);
  assert.equal(celija(m, 5, 0), null);
});

test("prazna ćelija je null, a ne -3276,8 m", () => {
  const m = kosina(5, 5, 10, [[2, 2]]);
  assert.equal(celija(m, 2, 2), null);
});

test("visina u središtu ćelije jednaka je toj ćeliji", () => {
  const m = kosina();
  for (const [r, c] of [
    [0, 0],
    [2, 3],
    [4, 4],
  ]) {
    const [lon, lat] = sredina(m, r, c);
    const v = visinaUTocki(m, lon, lat);
    assert.ok(v !== null);
    // Do na zaokruživanje: središte ćelije se računa iz stupnjeva, pa točka
    // zna pasti 10⁻¹³ ° s jedne ili druge strane granice ćelija. Interpolacija
    // je ondje neprekinuta, dakle razlika je u zadnjoj znamenki, ne u odgovoru.
    assert.ok(
      Math.abs(v - c * 10) < 1e-9,
      `ćelija (${r}, ${c}): očekivano ${c * 10} m, dobiveno ${v}`,
    );
  }
});

test("visina se između ćelija interpolira, ne preskače", () => {
  // Bez interpolacije bi dva klika unutar iste čestice znala dati razliku od
  // pola metra bez ikakvog terena između njih.
  const m = kosina();
  const [lonA, lat] = sredina(m, 2, 1);
  const [lonB] = sredina(m, 2, 2);
  const na_pola = visinaUTocki(m, (lonA + lonB) / 2, lat);
  assert.ok(na_pola !== null);
  assert.ok(
    Math.abs(na_pola - 15) < 1e-9,
    `očekivano 15 m na pola puta, dobiveno ${na_pola}`,
  );
});

test("uz prazninu se uzima najbliža izmjerena ćelija, ne izmišlja nastavak", () => {
  const m = kosina(5, 5, 10, [[2, 2]]);
  const [lon, lat] = sredina(m, 2, 1);
  assert.equal(visinaUTocki(m, lon, lat), 10);
});

test("izvan obuhvata mreže nema visine", () => {
  const m = kosina();
  assert.equal(visinaUTocki(m, 20, 43.5), null);
  assert.equal(visinaUTocki(m, 16.5, 50), null);
});

test("nagib na poznatoj kosini odgovara izmjeri", () => {
  const m = kosina();
  const korak = korakMetara(m.zaglavlje);
  const [lon, lat] = sredina(m, 2, 2);
  const pad = nagibUTocki(m, lon, lat);
  assert.ok(pad);
  // 10 m visine po jednoj ćeliji, mjereno središnjom razlikom preko dvije.
  const ocekivano = (10 / korak.x) * 100;
  assert.ok(
    Math.abs(pad.nagib - ocekivano) < 0.2,
    `očekivano ~${ocekivano.toFixed(1)} %, dobiveno ${pad.nagib} %`,
  );
});

test("kosina koja raste prema istoku pada prema zapadu", () => {
  const m = kosina();
  const [lon, lat] = sredina(m, 2, 2);
  assert.equal(nagibUTocki(m, lon, lat)?.ekspozicija, "Z");
});

test("na ravnom se strana svijeta ne izriče", () => {
  // Ondje smjer pada određuje šum mjerenja, pa bi „pada prema jugoistoku”
  // bila tvrdnja o zaokruživanju, ne o terenu.
  const m = kosina(5, 5, 0);
  const [lon, lat] = sredina(m, 2, 2);
  const pad = nagibUTocki(m, lon, lat);
  assert.equal(pad?.nagib, 0);
  assert.equal(pad?.ekspozicija, null);
});

test("nagib preko ruba mreže se ne računa", () => {
  const m = kosina();
  const [lon, lat] = sredina(m, 0, 0);
  assert.equal(nagibUTocki(m, lon, lat), null);
});

test("vodoravni i okomiti korak nisu isti — inače je nagib kriv za četvrtinu", () => {
  const korak = korakMetara(kosina().zaglavlje);
  assert.ok(korak.x < korak.y, "na 43,5° je stupanj dužine kraći od širine");
});

test("raspon čestice mjeri samo ćelije unutar plohe", () => {
  const m = kosina(9, 9, 10);
  const z = m.zaglavlje;
  const dLon = (z.istok - z.zapad) / z.stupaca;
  const dLat = (z.sjever - z.jug) / z.redaka;
  // Kvadrat oko stupaca 2–4 u redcima 3–5.
  const zapad = z.zapad + 2 * dLon;
  const istok = z.zapad + 5 * dLon;
  const sjever = z.sjever - 3 * dLat;
  const jug = z.sjever - 6 * dLat;
  const cestica: Feature<Polygon> = {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [zapad, jug],
          [istok, jug],
          [istok, sjever],
          [zapad, sjever],
          [zapad, jug],
        ],
      ],
    },
  };
  assert.deepEqual(rasponCestice(m, cestica), { najniza: 20, najvisa: 40 });
});

test("teren spaja visinu, nagib i raspon u jedan nalaz", () => {
  const m = kosina();
  const [lon, lat] = sredina(m, 2, 2);
  const t = terenUTocki(m, lon, lat, null);
  assert.ok(t);
  assert.equal(t.visina, 20);
  assert.ok(t.nagib > 0);
  assert.equal(t.cestica, null);
});

test("točka izvan mreže daje null, a ne nulu", () => {
  // Nula je valjana nadmorska visina (more), pa bi se šutnja pretvorila u
  // tvrdnju da je čestica na razini mora.
  const m = kosina();
  assert.equal(terenUTocki(m, 99, 99, null), null);
});

test("stvarna mreža pokriva točno obuhvat karte", async () => {
  // MAP_MAX_BOUNDS živi u map-views.ts, a OBUHVAT u izvedi-reljef.py.
  // Razilaženje se inače vidi tek kao rupa u dosjeu uz rub karte.
  const m = await ucitajMrezu();
  assert.ok(m, "mreža visina nije učitana — vrti li se `npm run izvedi-reljef`?");
  const [[jug, zapad], [sjever, istok]] = MAP_MAX_BOUNDS;
  assert.equal(m.zaglavlje.zapad, zapad);
  assert.equal(m.zaglavlje.jug, jug);
  assert.equal(m.zaglavlje.istok, istok);
  assert.equal(m.zaglavlje.sjever, sjever);
});

test("stvarna mreža ima onoliko ćelija koliko zaglavlje tvrdi", async () => {
  const m = await ucitajMrezu();
  assert.ok(m);
  assert.equal(m.podaci.length, m.zaglavlje.stupaca * m.zaglavlje.redaka);
  assert.equal(m.zaglavlje.jedinica, "dm");
  assert.equal(m.zaglavlje.prviRedakJe, "sjever");
});

test("stvarna mreža daje razumnu visinu u sredini kvarta", async () => {
  // Dračevac i Bilice leže na obronku, ne na moru i ne na Kozjaku. Raspon je
  // namjerno širok: ovo hvata zrcaljeni redak ili zamijenjene osi, ne
  // pogrešku od metra.
  const m = await ucitajMrezu();
  assert.ok(m);
  const visina = visinaUTocki(m, 16.4993, 43.5249);
  assert.ok(visina !== null, "sredina kvarta nema visinu");
  assert.ok(
    visina > 20 && visina < 160,
    `sredina kvarta na ${visina} m — očekivano 20–160 m`,
  );
});

test("stvarna mreža raste prema istoku, uz obronak", async () => {
  // Zapadni dio obuhvata je obala Vranjičko-solinskog zaljeva, istočni je
  // obronak prema Kozjaku. Ovo bi palo da su stupci zrcaljeni.
  const m = await ucitajMrezu();
  assert.ok(m);
  const uzduz = [16.48, 16.49, 16.4993, 16.51].map((lon) =>
    visinaUTocki(m, lon, 43.529),
  );
  assert.ok(uzduz.every((v) => v !== null), `praznina u nizu: ${uzduz}`);
  for (let i = 1; i < uzduz.length; i++) {
    assert.ok(
      uzduz[i]! > uzduz[i - 1]!,
      `visina ne raste prema istoku: ${uzduz}`,
    );
  }
});

test("more u stvarnoj mreži je praznina, a ne nula metara", async () => {
  // LiDAR s vodene plohe nema odboj. Da se to popuni nulom, zaljev bi postao
  // ravna ploha na razini mora i dosje bi za točku u moru tvrdio visinu.
  const m = await ucitajMrezu();
  assert.ok(m);
  assert.equal(visinaUTocki(m, 16.46, 43.529), null);
});
