import assert from "node:assert/strict";
import test from "node:test";

import { izvediEpizode, RAZDOBLJA, satiEpizoda, ulogaSata } from "./epizode";
import type { Opazanja, SatUlaza } from "./tipovi";

test("uloge razdoblja se ne preklapaju i pokrivaju sve od 2024-09", () => {
  assert.equal(RAZDOBLJA.ugadjanje.do, RAZDOBLJA.provjera.od);
  assert.equal(RAZDOBLJA.provjera.do, RAZDOBLJA.zadrzano.od);
  assert.equal(ulogaSata("2025-03-01T00:00:00.000Z"), "ugadjanje");
  assert.equal(ulogaSata("2026-08-18T00:00:00.000Z"), "zadrzano");
  assert.equal(ulogaSata("2024-01-01T00:00:00.000Z"), null);
});

test("sati epizoda su puni dani bez dvostrukih", () => {
  const s = satiEpizoda([
    { id: "a", naziv: "", razdoblje: { od: "2026-01-01", do: "2026-01-03" }, uloga: "provjera", vrsta: [], opis: "" },
    { id: "b", naziv: "", razdoblje: { od: "2026-01-02", do: "2026-01-04" }, uloga: "provjera", vrsta: [], opis: "" },
  ]);
  assert.equal(s.length, 72);
  assert.equal(s[0], "2026-01-01T00:00:00.000Z");
});

test("izvod bira jak i tih dan bez pogleda na model", () => {
  const ulazi: SatUlaza[] = [];
  const h2s: { sat: string; vrijednost: number; ispodGranice: boolean; izvor: "azo308" }[] = [];
  const t0 = Date.parse("2025-01-10T00:00:00.000Z");
  for (let h = 0; h < 24 * 6; h += 1) {
    const sat = new Date(t0 + h * 3600_000).toISOString();
    const d = Math.floor(h / 24);
    ulazi.push({
      sat,
      vjetar: { smjerOd: d === 2 ? (h % 2 ? 40 : 220) : 300, brzina: d === 3 ? 0.4 : 3, izvor: "split3" },
      dubina: { m: 200, izvor: "era5" },
      okolnosti: null,
    });
    h2s.push({ sat, vrijednost: d === 1 ? 5 + (h % 5) : 1, ispodGranice: false, izvor: "azo308" });
  }
  const opazanja: Opazanja = { h2s, merkaptani: [], dojave: [] };
  const e = izvediEpizode(ulazi, opazanja);
  // Epizoda pokriva dan prije i sam dan, pa `od` stoji dan ranije.
  const za = (dan: string) => e.find((x) => x.razdoblje.od === dan)?.vrsta ?? [];
  assert.ok(za("2025-01-10").includes("jak-miris"), "11. 1. je jak dan");
  assert.ok(za("2025-01-12").includes("tisina"), "13. 1. je tih dan");
  assert.ok(za("2025-01-11").includes("promjena-vjetra"), "12. 1. su okreti");
  assert.ok(!za("2025-01-12").includes("promjena-vjetra"));
  assert.ok(e.every((x) => x.uloga === "ugadjanje" || x.id === "dojave-2026-08"));
});
