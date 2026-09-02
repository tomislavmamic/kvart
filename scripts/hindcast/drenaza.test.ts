import assert from "node:assert/strict";
import test from "node:test";

import { SIM_POLJE } from "@/generated/karepovac-sim-polje";

import { izvediDrenazu } from "./drenaza";

test("otjecanje s plohe ide prema nižem Dračevcu, a polje pokriva plohu i kvart", () => {
  const d = izvediDrenazu();
  assert.ok(d.pokrivenost > 0.25 && d.pokrivenost < 0.6, `pokrivenost ${d.pokrivenost.toFixed(2)}`);
  const { gw, gh, granice } = SIM_POLJE;
  const cel = (lon: number, lat: number) => {
    const i = Math.round(((lon - granice.zapad) / (granice.istok - granice.zapad)) * gw);
    const j = Math.round(((granice.sjever - lat) / (granice.sjever - granice.jug)) * gh);
    return j * gw + i;
  };
  // Zapadni rub plohe pada prema zapadu-sjeverozapadu (Dračevac je na 290°).
  const k = cel(16.5065, 43.5225);
  const azimut = ((Math.atan2(d.x[k], -d.y[k]) * 180) / Math.PI + 360) % 360;
  assert.ok(Math.hypot(d.x[k], d.y[k]) > 0.3, `nagib uz plohu ${Math.hypot(d.x[k], d.y[k]).toFixed(2)}`);
  assert.ok(azimut > 230 && azimut < 340, `otječe prema ${azimut.toFixed(0)}°`);
  // Istočni rub okvira nije pokriven: nula, ne izmišljen pad.
  const e = cel(16.545, 43.52);
  assert.equal(d.x[e], 0);
});
