import assert from "node:assert/strict";
import test from "node:test";

import { mirisneJedinice, PRAG_NA_LJESTVICI } from "@/lib/dim";
import { SIDRO_SIMULATORA } from "@/lib/sim/ljestvica";
import {
  GRANICE_RAZINA,
  izvediSituaciju,
  kamoNosi,
  ocijeniPodrucja,
  polozajGranice,
  razinaZaPolozaj,
  type Granice,
  type KadarSituacije,
  type Podrucje,
  type SlikaSata,
  type SusjedniSat,
} from "@/lib/sim/situacija";
import { uBajt } from "@/lib/sim/zapis-gustoce";

/** Mali okvir 3 × 3 km oko izmišljene plohe, rešetka 60 × 60 (50 m ćelija). */
const GRANICE: Granice = { zapad: 16.48, jug: 43.505, istok: 16.517, sjever: 43.532 };
const SIRINA = 60;
const VISINA = 60;

const NASELJE: Podrucje = { id: "a", naziv: "Naselje A", lat: 43.52, lon: 16.49, polumjerM: 300 };
const DRUGO: Podrucje = { id: "b", naziv: "Naselje B", lat: 43.51, lon: 16.51, polumjerM: 300 };

/** Bajt koji odgovara zadanom broju mirisnih jedinica (koliko puta iznad praga). */
function bajtZa(mirisnih: number): number {
  const g = (mirisnih * SIDRO_SIMULATORA) / mirisneJedinice("sumporovodik");
  return uBajt(g, SIDRO_SIMULATORA);
}

/** Slika u kojoj je krug oko točke na zadanoj razini, ostalo prazno. */
function slika(krugovi: { lat: number; lon: number; polumjerM: number; mirisnih: number }[]): SlikaSata {
  const bajtovi = new Uint8Array(SIRINA * VISINA);
  for (let y = 0; y < VISINA; y += 1) {
    const lat = GRANICE.sjever - ((y + 0.5) / VISINA) * (GRANICE.sjever - GRANICE.jug);
    for (let x = 0; x < SIRINA; x += 1) {
      const lon = GRANICE.zapad + ((x + 0.5) / SIRINA) * (GRANICE.istok - GRANICE.zapad);
      for (const k of krugovi) {
        const dx = (lon - k.lon) * 111320 * Math.cos((k.lat * Math.PI) / 180);
        const dy = (lat - k.lat) * 110574;
        if (dx * dx + dy * dy <= k.polumjerM * k.polumjerM) {
          bajtovi[y * SIRINA + x] = Math.max(bajtovi[y * SIRINA + x], bajtZa(k.mirisnih));
        }
      }
    }
  }
  return { bajtovi, sirina: SIRINA, visina: VISINA };
}

function kadar(dio: Partial<KadarSituacije> = {}): KadarSituacije {
  return {
    sat: "2026-08-27T18:00:00.000Z",
    pomak: 0,
    vrsta: "sada",
    dostupnost: "spreman",
    vjetar: { smjerOd: 120, brzina: 2.5, tisina: false, izvor: "split3" },
    izvor: "split3",
    ...dio,
  };
}

function susjed(pomak: number, razina: SusjedniSat["razina"], dostupnost: SusjedniSat["dostupnost"] = "spreman"): SusjedniSat {
  return { sat: `s${pomak}`, pomak, dostupnost, razina };
}

test("granice razina stoje na pragu i rastu logaritamskim koracima", () => {
  assert.ok(polozajGranice("moguce") < PRAG_NA_LJESTVICI, "„moguće” počinje ispod praga");
  assert.ok(polozajGranice("slabo") > PRAG_NA_LJESTVICI, "„slabo” je iznad praga");
  const korak1 = polozajGranice("slabo") - polozajGranice("moguce");
  const korak2 = polozajGranice("osjetno") - polozajGranice("slabo");
  const korak3 = polozajGranice("jako") - polozajGranice("osjetno");
  assert.ok(Math.abs(korak1 - korak2) < 0.02 && Math.abs(korak2 - korak3) < 0.02, "koraci su jednaki u logaritmu");
  assert.equal(razinaZaPolozaj(0), "nema");
  assert.equal(razinaZaPolozaj(PRAG_NA_LJESTVICI), "moguce");
  assert.equal(razinaZaPolozaj(1), "jako");
  assert.equal(GRANICE_RAZINA.jako / GRANICE_RAZINA.moguce > 30, true, "tri koraka su više od 30×");
});

test("razina područja je visoki percentil, ne jedna vruća ćelija", () => {
  // Cijelo naselje na 10× praga → osjetno.
  const puno = ocijeniPodrucja(slika([{ ...NASELJE, mirisnih: 10 }]), GRANICE, "sumporovodik", 1, [NASELJE]);
  assert.equal(puno[0].razina, "osjetno");
  assert.ok(puno[0].zahvacenost > 0.9, `zahvaćenost ${puno[0].zahvacenost}`);

  // Samo mala mrlja od 60 m u naselju na 50× praga → percentil je ne vidi.
  const mrlja = ocijeniPodrucja(
    slika([{ lat: NASELJE.lat, lon: NASELJE.lon, polumjerM: 60, mirisnih: 50 }]),
    GRANICE,
    "sumporovodik",
    1,
    [NASELJE],
  );
  assert.equal(mrlja[0].razina, "nema");
  assert.ok(mrlja[0].zahvacenost < 0.1);
});

test("jačina izvora pomiče razinu kao i na karti", () => {
  const s = slika([{ ...NASELJE, mirisnih: 1 }]);
  assert.equal(ocijeniPodrucja(s, GRANICE, "sumporovodik", 1, [NASELJE])[0].razina, "moguce");
  assert.equal(ocijeniPodrucja(s, GRANICE, "sumporovodik", 4, [NASELJE])[0].razina, "slabo");
  assert.equal(ocijeniPodrucja(s, GRANICE, "sumporovodik", 0, [NASELJE])[0].razina, "nema");
});

test("ukupna razina je najviša nad naseljima, a područja idu redom", () => {
  const s = slika([
    { ...NASELJE, mirisnih: 3 },
    { ...DRUGO, mirisnih: 30 },
  ]);
  const sit = izvediSituaciju({
    kadar: kadar(),
    slika: s,
    granice: GRANICE,
    tvar: "sumporovodik",
    podrucja: [NASELJE, DRUGO],
  });
  assert.equal(sit.razina, "jako");
  assert.deepEqual(
    sit.podrucja.map((p) => [p.podrucje.id, p.razina]),
    [
      ["a", "slabo"],
      ["b", "jako"],
    ],
  );
  assert.equal(sit.pouzdanost, "visoka");
  assert.equal(sit.trend, "nepoznato", "bez susjeda trend se ne zna");
  assert.deepEqual(sit.nosi, kamoNosi(120));
  assert.match(sit.nosi!.opis, /prema sjeverozapadu/);
});

test("kamo nosi je suprotno od smjera iz kojega puše", () => {
  assert.equal(kamoNosi(0).azimut, 180);
  assert.equal(kamoNosi(0).opis, "prema jugu");
  assert.equal(kamoNosi(270).opis, "prema istoku");
  assert.equal(kamoNosi(350).opis, "prema jugu");
});

test("prognoza nikad nije visoka, a tri sata unaprijed je niska", () => {
  const s = slika([{ ...NASELJE, mirisnih: 3 }]);
  const osnova = { slika: s, granice: GRANICE, tvar: "sumporovodik" as const, podrucja: [NASELJE] };
  const plus1 = izvediSituaciju({
    ...osnova,
    kadar: kadar({ pomak: 1, vrsta: "prognoza", izvor: "model", vjetar: { smjerOd: 120, brzina: 2.5, tisina: false, izvor: "model" } }),
  });
  assert.equal(plus1.pouzdanost, "srednja");
  const plus3 = izvediSituaciju({ ...osnova, kadar: kadar({ pomak: 3, vrsta: "prognoza", izvor: "model" }) });
  assert.equal(plus3.pouzdanost, "niska");
  assert.ok(plus3.razlozi.some((r) => /prognoza/i.test(r)));
});

test("modelski vjetar u prošlosti daje najviše srednju, tišina nisku", () => {
  const s = slika([{ ...NASELJE, mirisnih: 3 }]);
  const osnova = { slika: s, granice: GRANICE, tvar: "sumporovodik" as const, podrucja: [NASELJE] };
  const model = izvediSituaciju({
    ...osnova,
    kadar: kadar({ pomak: -3, vrsta: "izmjereno", izvor: "model", vjetar: { smjerOd: 120, brzina: 2.5, tisina: false, izvor: "model" } }),
  });
  assert.equal(model.pouzdanost, "srednja");
  assert.ok(model.razlozi.some((r) => /model/i.test(r)));

  const tisina = izvediSituaciju({
    ...osnova,
    kadar: kadar({ vjetar: { smjerOd: 120, brzina: 0.2, tisina: true, izvor: "split3" } }),
  });
  assert.equal(tisina.pouzdanost, "niska");
  assert.equal(tisina.nosi, null, "tišina ne nosi nikamo");

  const promjenjiv = izvediSituaciju({
    ...osnova,
    kadar: kadar({ vjetar: { smjerOd: 120, brzina: 2, tisina: false, izvor: "ldsp", promjenjiv: true } }),
  });
  assert.equal(promjenjiv.nosi, null);
  assert.equal(promjenjiv.pouzdanost, "niska");
});

test("nedostupan susjed spušta pouzdanost za jedan stupanj", () => {
  const s = slika([{ ...NASELJE, mirisnih: 3 }]);
  const sit = izvediSituaciju({
    kadar: kadar(),
    slika: s,
    granice: GRANICE,
    tvar: "sumporovodik",
    podrucja: [NASELJE],
    prije: [susjed(-1, null, "nedostupno"), susjed(-2, "slabo")],
  });
  assert.equal(sit.pouzdanost, "srednja");
  assert.ok(sit.razlozi.some((r) => /zalet/.test(r)));
});

test("trend gleda dva prethodna sata", () => {
  const s = slika([{ ...NASELJE, mirisnih: 3 }]); // slabo
  const osnova = { kadar: kadar(), slika: s, granice: GRANICE, tvar: "sumporovodik" as const, podrucja: [NASELJE] };
  assert.equal(izvediSituaciju({ ...osnova, prije: [susjed(-1, "nema"), susjed(-2, "moguce")] }).trend, "gore");
  assert.equal(izvediSituaciju({ ...osnova, prije: [susjed(-1, "osjetno"), susjed(-2, "jako")] }).trend, "bolje");
  assert.equal(izvediSituaciju({ ...osnova, prije: [susjed(-1, "osjetno"), susjed(-2, "nema")] }).trend, "stabilno");
  assert.equal(izvediSituaciju({ ...osnova, prije: [susjed(-1, null), susjed(-2, null)] }).trend, "nepoznato");
});

test("sljedeća promjena je prvi sljedeći izračunati sat s drugom razinom", () => {
  const s = slika([{ ...NASELJE, mirisnih: 3 }]); // slabo
  const osnova = { kadar: kadar(), slika: s, granice: GRANICE, tvar: "sumporovodik" as const, podrucja: [NASELJE] };
  const sit = izvediSituaciju({ ...osnova, poslije: [susjed(1, "slabo"), susjed(2, "moguce"), susjed(3, "nema")] });
  assert.deepEqual(sit.promjena, { sat: "s2", razina: "moguce" });
  // Neizračunat sat prekida potragu: ne obećava se ono što se ne zna.
  assert.equal(izvediSituaciju({ ...osnova, poslije: [susjed(1, null), susjed(2, "nema")] }).promjena, null);
  assert.equal(izvediSituaciju({ ...osnova, poslije: [susjed(1, "slabo"), susjed(2, "slabo")] }).promjena, null);
});

test("neizračunat ili nedostupan sat ne izgleda kao čist zrak", () => {
  const bezSlike = izvediSituaciju({ kadar: kadar(), slika: null, granice: GRANICE, tvar: "sumporovodik" });
  assert.equal(bezSlike.pouzdanost, "niska");
  assert.equal(bezSlike.razina, "nema");
  assert.deepEqual(bezSlike.podrucja, []);
  assert.ok(bezSlike.razlozi.some((r) => /nije izračunat/.test(r)));

  const rupa = izvediSituaciju({
    kadar: kadar({ dostupnost: "nedostupno", vjetar: null, izvor: null }),
    slika: slika([{ ...NASELJE, mirisnih: 30 }]),
    granice: GRANICE,
    tvar: "sumporovodik",
  });
  assert.equal(rupa.pouzdanost, "niska");
  assert.deepEqual(rupa.podrucja, [], "nedostupan sat ne ocjenjuje područja ni kad slika postoji");
  assert.equal(rupa.trend, "nepoznato");
});
