/**
 * Slaže satni niz stanja zraka za razdoblje dojava (25.–29. 8. 2026.),
 * kakav `ocijeni-dojave-sim.ts` vrti kroz simulator: izmjereni vjetar
 * (spoj postaja, isti niz kao u ruži) + modelska dubina sloja (Open-Meteo).
 *
 * Pokretanje: npx tsx scripts/sati-dojava.ts <openmeteo.json> <izlaz.json>
 */
import { readFileSync, writeFileSync } from "node:fs";

import { vjetarUSatu } from "@/lib/dojave";

const [meteoPut, izlazPut] = process.argv.slice(2);

/** Izmjereno na Split-3 (AZO) 29. 8., iza kraja generiranog niza. */
const DOPUNA: Record<string, { smjer: number; brzina: number }> = {
  "2026-08-29T00": { smjer: 98, brzina: 1.2 },
  "2026-08-29T01": { smjer: 128, brzina: 0.8 },
  "2026-08-29T02": { smjer: 162, brzina: 1.1 },
  "2026-08-29T03": { smjer: 94, brzina: 1.6 },
  "2026-08-29T04": { smjer: 120, brzina: 1.4 },
  "2026-08-29T05": { smjer: 180, brzina: 0.7 },
  "2026-08-29T06": { smjer: 161, brzina: 0.9 },
  "2026-08-29T07": { smjer: 216, brzina: 0.8 },
  "2026-08-29T08": { smjer: 167, brzina: 1.4 },
  "2026-08-29T09": { smjer: 261, brzina: 1.0 },
  "2026-08-29T10": { smjer: 236, brzina: 1.5 },
};

const meteo: Record<string, { smjer: number; brzina: number; dubina: number }> =
  JSON.parse(readFileSync(meteoPut, "utf8"));

const od = Date.UTC(2026, 7, 25, 12);
const do_ = Date.UTC(2026, 7, 29, 10);
const izlaz: Record<string, { smjerOd: number; brzina: number; dubina: number }> = {};
for (let t = od; t <= do_; t += 3_600_000) {
  const kada = new Date(t);
  const kljuc = kada.toISOString().slice(0, 13);
  const m = meteo[`${kljuc}:00`];
  const v = vjetarUSatu(kada) ?? DOPUNA[kljuc] ?? null;
  if (!v || !m) continue;
  izlaz[`${kljuc}:00Z`] = { smjerOd: v.smjer, brzina: v.brzina, dubina: m.dubina };
}
writeFileSync(izlazPut, JSON.stringify(izlaz));
console.error(`${Object.keys(izlaz).length} sati → ${izlazPut}`);
