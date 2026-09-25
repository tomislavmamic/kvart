import assert from "node:assert/strict";
import { test } from "node:test";
import proj4 from "proj4";

import { uHtrs } from "./htrs";

const HTRS96 = "+proj=tmerc +lat_0=0 +lon_0=16.5 +k=0.9999 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs";

test("HTRS96/TM se poklapa s proj4 na cijelom obuhvatu GUP-a", () => {
  for (const [lat, lng] of [
    [43.5081, 16.4402], // Riva
    [43.5307, 16.5132], // Dračevac
    [43.4913, 16.3799], // Marjan, zapad
    [43.537, 16.547], // Stobreč, istok
  ]) {
    const [e, n] = uHtrs(lat, lng);
    const [pe, pn] = proj4("WGS84", HTRS96, [lng, lat]);
    assert.ok(Math.abs(e - pe) < 0.01 && Math.abs(n - pn) < 0.01, `${lat},${lng}: ${e},${n} ≠ ${pe},${pn}`);
  }
});

/**
 * Uklapanje listova (listovi.json, iz rasteriziraj.py) provjereno je okom:
 * Poljud pada usred stadiona (R1) na listu 2014. i 2025., Dioklecijanova
 * palača u blok palače na listu 2008. Ovaj test drži te točke — ako se
 * pločice ponovo iscrtaju s drugim okvirom stranice, isječci oko čestice
 * bi tiho otklizali.
 */
test("uklapanje lista stavlja poznata mjesta tamo gdje su na listu", async () => {
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { tockaNaListu, okvirOkoTocke, navodTocke } = await import("./id");
  const { ulomakTocke } = await import("./listovi-klijent");
  const { listovi } = JSON.parse(readFileSync(path.join(process.cwd(), "data/gup-grad/dokument/listovi.json"), "utf8"));
  const poljud = uHtrs(43.5195, 16.4318);
  const palaca = uHtrs(43.5081, 16.4402);
  for (const [list, mjesto, ocekivano] of [
    ["namjena-2014", poljud, [0.2663, 0.3746]],
    ["namjena-2025", poljud, [0.2478, 0.3944]],
    ["namjena-2008", palaca, [0.2934, 0.6248]],
  ] as const) {
    const t = tockaNaListu(listovi[list].uklapanje, mjesto as [number, number])!;
    assert.ok(Math.abs(t[0] - ocekivano[0]) < 0.0005 && Math.abs(t[1] - ocekivano[1]) < 0.0005, `${list}: ${t}`);
    // okvir od ±350 m je na listu 1:10 000 oko 3,5 cm — manji od lista, veći od čestice
    const o = okvirOkoTocke(listovi[list].uklapanje, t);
    assert.ok(o[2] - o[0] > 0.03 && o[2] - o[0] < 0.06, `${list}: širina okvira ${o[2] - o[0]}`);
  }
  assert.equal(tockaNaListu(listovi["promet-2008"].uklapanje, poljud), null, "list bez provjerenog uklapanja nema točku");
  const u = ulomakTocke(navodTocke("namjena-2014", [0.2663, 0.3746]), { "namjena-2014": { id: "namjena-2014", ...listovi["namjena-2014"] } });
  assert.match(u!.href, /^\/gup\/dokument\/list\/namjena-2014\?okvir=.*&tocka=0\.26630,0\.37460$/);
});
