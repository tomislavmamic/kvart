/**
 * Reže već izvučene GeoJSON slojeve (public/geo/) na granicu kvarta.
 * Pokretanje:  npm run clip-geo
 *
 * Radi nad postojećim datotekama (ne dohvaća ponovno vanjske servise) i
 * upisuje ih natrag. Idempotentno je — ponovno rezanje ne mijenja rezultat.
 * granica.geojson se preskače (to je sama maska).
 */
import { readFile, writeFile, stat } from "fs/promises";
import path from "path";
import { loadMask, clipToBoundary } from "./clip-lib";
import type { FeatureCollection } from "geojson";

const GEO = path.join(process.cwd(), "public", "geo");

// Slojevi izvučeni na širem obuhvatu koje treba svesti na kvart.
const LAYERS = [
  "zgrade",
  "pjesacke",
  "parkiralista",
  "struja",
  "sadrzaji",
  "stajalista",
  "zelene-povrsine",
  "toponimi",
  "internet",
  "plan-optika",
];

async function main(): Promise<void> {
  const mask = await loadMask();
  console.log("Režem slojeve na granicu kvarta (+120 m)…");
  for (const name of LAYERS) {
    const p = path.join(GEO, `${name}.geojson`);
    let fc: FeatureCollection;
    try {
      fc = JSON.parse(await readFile(p, "utf-8")) as FeatureCollection;
    } catch {
      console.log(`  · ${name} — nema datoteke, preskačem`);
      continue;
    }
    const before = fc.features.length;
    const clipped = clipToBoundary(fc, mask);
    await writeFile(p, JSON.stringify(clipped), "utf-8");
    const kb = ((await stat(p)).size / 1024).toFixed(1);
    const flag = clipped.features.length === 0 ? "  ⚠ nema podataka u kvartu" : "";
    console.log(
      `  ✓ ${name.padEnd(16)} ${String(before).padStart(5)} → ${String(
        clipped.features.length
      ).padStart(4)}   ${kb.padStart(7)} KB${flag}`
    );
  }
  console.log("Gotovo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
