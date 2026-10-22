/**
 * Pločice i zbrojevi za /gup/gradnja: gdje se po novom GUP-u ne može graditi
 * ništa novo, a gdje ništa stambeno (src/lib/gup-grad/gradnja.ts).
 *
 * Ulaz su pločice „dijelova čestice” za GUP 2025. i način brojanja „po
 * odredbama” (scripts/gup-grad/regije.py) i neuređeni dijelovi s lista 4.d
 * (public/geo/gup-grad/zabrana-2025.geojson, scripts/gup-grad/zabrana.py).
 * Pikseli koji čekaju UPU dijele se na neuređeno (uz postojeću cestu gradi se
 * i prije UPU-a) i ostalo istim oblicima kojima klik na karti kaže u kojem je
 * području (stanjeTocke u zabrana.ts).
 *
 * Izlaz:
 *   public/geo/gup-grad/gradnja/<red>_<stupac>.png   R = klasa, G = regija,
 *       B = kategorija (gradnja.ts, `kod`), A = 255 na čestici
 *   public/geo/gup-grad/gradnja.json                 pločice s granicama
 *   data/gup-grad/gradnja-2025.json                  hektari po kategoriji,
 *       po skupini i po namjeni
 *
 * Pokretanje (poslije regije.py i zabrana.py):  npx tsx scripts/gup-grad/gradnja.ts
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { PNG } from "pngjs";
import type { FeatureCollection } from "geojson";

import { KATEGORIJE, KATEGORIJA_PO_KODU, kategorija, ZONA_GRADNJE, type IdKategorije, type Skupina } from "../../src/lib/gup-grad/gradnja";
import { KLASA_PO_INDEKSU, type KodKlase } from "../../src/lib/gup-grad/model";
import { REGIJE } from "../../src/lib/gup-grad/regije";
import { oblik, uObliku, type Geometrija, type Oblik } from "../../src/lib/gup-grad/zabrana";

const KORIJEN = process.cwd();
const JAVNO = path.join(KORIJEN, "public");
const IZLAZ = path.join(JAVNO, "geo", "gup-grad", "gradnja");
const INACICA = "gradevna";
const GODINA = "2025";

interface Plocica {
  url: string;
  /** [[jug, zapad], [sjever, istok]] */
  granice: [[number, number], [number, number]];
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const izMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90;

function main() {
  const indeks = JSON.parse(readFileSync(path.join(JAVNO, "geo", "gup-grad", "regije.json"), "utf8")) as {
    korak: number;
    inacice: Record<string, Record<string, Plocica[]>>;
  };
  const zabrana = JSON.parse(readFileSync(path.join(JAVNO, "geo", "gup-grad", "zabrana-2025.geojson"), "utf8")) as FeatureCollection;
  const neuredeno: Oblik[] = zabrana.features
    .filter((f) => f.properties?.vrsta === "neuredeno")
    .map((f) => oblik(f.geometry as Geometrija));

  rmSync(IZLAZ, { recursive: true, force: true });
  mkdirSync(IZLAZ, { recursive: true });
  const m2 = new Map<number, number>();
  const poZoni = new Map<string, number>();
  const plocice: Plocica[] = [];
  for (const p of indeks.inacice[INACICA][GODINA]) {
    const png = PNG.sync.read(readFileSync(path.join(JAVNO, p.url)));
    const { width: w, height: h, data: d } = png;
    const [[jug, zapad], [sjever, istok]] = p.granice;
    const y0 = mercY(sjever), y1 = mercY(jug);
    for (let r = 0; r < h; r++) {
      const lat = izMercY(y0 - ((r + 0.5) / h) * (y0 - y1));
      // piksel je `korak` metara Web Mercatora; na tlu je kraći za cos(φ)
      const pikselM2 = (indeks.korak * Math.cos((lat * Math.PI) / 180)) ** 2;
      for (let c = 0; c < w; c++) {
        const i = (r * w + c) * 4;
        if (d[i + 3] !== 255) continue;
        const klasa = d[i], regija = d[i + 1];
        const lng = zapad + ((c + 0.5) / w) * (istok - zapad);
        const k = kategorija(klasa, regija, regija === REGIJE.ceka && neuredeno.some((o) => uObliku(o, lng, lat)));
        d[i + 2] = k;
        if (!k) {
          d[i + 3] = 0;
          continue;
        }
        m2.set(k, (m2.get(k) ?? 0) + pikselM2);
        const kod = KLASA_PO_INDEKSU.get(klasa)!.kod;
        const kljuc = `${kod}|${KATEGORIJA_PO_KODU.get(k)!.id}`;
        poZoni.set(kljuc, (poZoni.get(kljuc) ?? 0) + pikselM2);
      }
    }
    const ime = path.basename(p.url);
    writeFileSync(path.join(IZLAZ, ime), PNG.sync.write(png, { colorType: 6 }));
    plocice.push({ url: `/geo/gup-grad/gradnja/${ime}`, granice: p.granice });
  }
  writeFileSync(path.join(JAVNO, "geo", "gup-grad", "gradnja.json"), JSON.stringify({ korak: indeks.korak, plocice }));

  const ha = (v: number) => Math.round(v / 100) / 100;
  const poKategoriji = Object.fromEntries(KATEGORIJE.map((k) => [k.id, ha(m2.get(k.kod) ?? 0)])) as Record<IdKategorije, number>;
  const poSkupini = {} as Record<Skupina, number>;
  for (const k of KATEGORIJE) poSkupini[k.skupina] = ha((poSkupini[k.skupina] ?? 0) * 1e4 + (m2.get(k.kod) ?? 0));
  const zone: Partial<Record<KodKlase, Partial<Record<IdKategorije, number>>>> = {};
  for (const [kljuc, v] of poZoni) {
    const [kod, id] = kljuc.split("|") as [KodKlase, IdKategorije];
    (zone[kod] ??= {})[id] = ha(v);
  }
  const zbroj = {
    opis: "Izvedeno skriptom scripts/gup-grad/gradnja.ts iz pločica dijelova čestice (regije.py, „po odredbama”, GUP 2025.) i neuređenih dijelova lista 4.d (zabrana.py).",
    ukupno_ha: ha([...m2.values()].reduce((a, b) => a + b, 0)),
    po_kategoriji_ha: poKategoriji,
    po_skupini_ha: poSkupini,
    po_namjeni_ha: zone,
    zona_gradnje: ZONA_GRADNJE,
  };
  writeFileSync(path.join(KORIJEN, "data", "gup-grad", "gradnja-2025.json"), JSON.stringify(zbroj, null, 1) + "\n");
  console.log(plocice.length, "pločica;", zbroj.ukupno_ha, "ha");
  console.log(poSkupini);
  console.log(poKategoriji);
}

main();
