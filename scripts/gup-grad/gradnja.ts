/**
 * Pločice i zbrojevi za /gup/gradnja: gdje se po novom GUP-u ne može graditi
 * ništa novo, a gdje ništa stambeno (src/lib/gup-grad/gradnja.ts).
 *
 * Ulaz su pločice „dijelova čestice” za GUP 2025. i način brojanja „po
 * odredbama” (scripts/gup-grad/regije.py), neuređeni dijelovi s lista 4.d
 * (public/geo/gup-grad/zabrana-2025.geojson, scripts/gup-grad/zabrana.py) i
 * koridori ulica koje list 1 ne boji (data/gup-grad/koridori-2025,
 * scripts/gup-grad/koridori.py): ondje klasa postaje P, kao na listu, te
 * putovi i preusko zemljište (data/gup-grad/skupine-2025,
 * scripts/gup-grad/gradnja-skupine.py), te javno zemljište i gradski
 * projekti (data/gup-grad/javno-2025, scripts/gup-grad/gradnja-javno.py).
 * Javno zemljište ne mijenja razlog nego mu dodaje vlasnika (kodPiksela u
 * gradnja.ts); u zbrojevima se broji kao javno, a ne po razlogu.
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
 * Pokretanje (poslije regije.py, zabrana.py, koridori.py i gradnja-skupine.py):  npx tsx scripts/gup-grad/gradnja.ts
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { PNG } from "pngjs";
import type { FeatureCollection } from "geojson";

import {
  KATEGORIJE,
  KATEGORIJA_PO_ID,
  KATEGORIJA_PO_KODU,
  kategorija,
  kodNaKarti,
  kodPiksela,
  PLAN_NA_SNAZI,
  PO_PLANU,
  ZONA_GRADNJE,
  type IdKategorije,
  type Skupina,
} from "../../src/lib/gup-grad/gradnja";
import { KLASA_PO_INDEKSU, KLASE, type KodKlase } from "../../src/lib/gup-grad/model";
import { REGIJE } from "../../src/lib/gup-grad/regije";
import { oblik, uObliku, type Geometrija, type Oblik } from "../../src/lib/gup-grad/zabrana";

const KORIJEN = process.cwd();
const JAVNO = path.join(KORIJEN, "public");
const IZLAZ = path.join(JAVNO, "geo", "gup-grad", "gradnja");
const INACICA = "gradevna";
const GODINA = "2025";
const KORIDORI = path.join(KORIJEN, "data", "gup-grad", "koridori-2025");
const SKUPINE = path.join(KORIJEN, "data", "gup-grad", "skupine-2025");
const JAVNE = path.join(KORIJEN, "data", "gup-grad", "javno-2025");
const P = KLASE.find((k) => k.kod === "P")!.indeks;
const VOJSKA = KATEGORIJA_PO_ID.vojska.kod;
const JAVNO_ZEMLJISTE = KATEGORIJA_PO_ID.javno.kod;
const USKI_JAVNI = KATEGORIJA_PO_ID["javni-pojas"].kod;

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
  /** Razlog ispod javnog zemljišta: koliko bi ga inače bilo za gradnju. */
  const ispodJavnog = new Map<IdKategorije, number>();
  /** Razlog po GUP-u ispod „po planu na snazi”: što bi karta rekla da plana nema. */
  const ispodPlana = new Map<IdKategorije, number>();
  const poZoni = new Map<string, number>();
  /** U zonama za stanovanje, po kategoriji kakva je na karti (javno kao javno): za filtar „Što priječi”. */
  const uStambenim = new Map<number, number>();
  const plocice: Plocica[] = [];
  for (const p of indeks.inacice[INACICA][GODINA]) {
    const png = PNG.sync.read(readFileSync(path.join(JAVNO, p.url)));
    const { width: w, height: h, data: d } = png;
    // maska koridora (koridori.py), 1-bitni PNG iste mreže; nema je gdje koridora nema
    const putKoridora = path.join(KORIDORI, path.basename(p.url));
    const kor = existsSync(putKoridora) ? PNG.sync.read(readFileSync(putKoridora)).data : null;
    // putovi (1) i preusko (2) iz gradnja-skupine.py, sivi PNG iste mreže
    const putSkupina = path.join(SKUPINE, path.basename(p.url));
    const sku = existsSync(putSkupina) ? PNG.sync.read(readFileSync(putSkupina)).data : null;
    // vlasnik javnog (bitovi 0–2) i gradski projekt (bit 3) iz gradnja-javno.py
    const putJavnog = path.join(JAVNE, path.basename(p.url));
    const jav = existsSync(putJavnog) ? PNG.sync.read(readFileSync(putJavnog)).data : null;
    const [[jug, zapad], [sjever, istok]] = p.granice;
    const y0 = mercY(sjever), y1 = mercY(jug);
    for (let r = 0; r < h; r++) {
      const lat = izMercY(y0 - ((r + 0.5) / h) * (y0 - y1));
      // piksel je `korak` metara Web Mercatora; na tlu je kraći za cos(φ)
      const pikselM2 = (indeks.korak * Math.cos((lat * Math.PI) / 180)) ** 2;
      for (let c = 0; c < w; c++) {
        const i = (r * w + c) * 4;
        if (d[i + 3] !== 255) continue;
        const koridor = kor !== null && kor[i] > 127;
        if (koridor) d[i] = P;
        const klasa = d[i], regija = d[i + 1];
        const lng = zapad + ((c + 0.5) / w) * (istok - zapad);
        const s = sku ? sku[i] : 0;
        const jv = jav ? jav[i] : 0;
        const k = kategorija(klasa, regija, {
          neuredeno: regija === REGIJE.ceka && neuredeno.some((o) => uObliku(o, lng, lat)),
          koridor,
          put: s === 1,
          preusko: s === 2,
          odmak: s === 3,
          odmaci: s === 4,
          ostatakKuce: s === 5,
          gradskiProjekt: (jv & 8) > 0,
        });
        // uski javni pojas (gradnja-javno.py, bit 16): javno, ali bez jantarne boje
        const uskoJavno = (jv & 16) > 0 && (jv & 7) > 0 && k !== VOJSKA;
        const kat = uskoJavno ? USKI_JAVNI : k;
        let vlasnik = uskoJavno ? 0 : jv & 7;
        // slobodno zemljište pod planom na snazi (gradnja-javno.py, bit 32): odlučuje plan
        if ((jv & 32) > 0 && !vlasnik && kat && PO_PLANU.has(KATEGORIJA_PO_KODU.get(kat)!.id)) vlasnik = PLAN_NA_SNAZI;
        d[i + 2] = kodPiksela(kat, vlasnik);
        if (!k) {
          d[i + 3] = 0;
          continue;
        }
        // javno se broji kao javno; vojna zona ostaje svoja kategorija
        const brojiSe = kodNaKarti(kat, vlasnik);
        if (vlasnik === PLAN_NA_SNAZI) {
          const id = KATEGORIJA_PO_KODU.get(kat)!.id;
          ispodPlana.set(id, (ispodPlana.get(id) ?? 0) + pikselM2);
        }
        m2.set(brojiSe, (m2.get(brojiSe) ?? 0) + pikselM2);
        if (brojiSe === JAVNO_ZEMLJISTE) {
          const id = KATEGORIJA_PO_KODU.get(k)!.id;
          ispodJavnog.set(id, (ispodJavnog.get(id) ?? 0) + pikselM2);
        }
        if (ZONA_GRADNJE[KLASA_PO_INDEKSU.get(klasa)!.kod] === "stambena") uStambenim.set(brojiSe, (uStambenim.get(brojiSe) ?? 0) + pikselM2);
        const kod = KLASA_PO_INDEKSU.get(klasa)!.kod;
        // po kategoriji kakva je na karti (javno, po planu), da zbroj po namjeni kaže isto što i karta
        const kljuc = `${kod}|${KATEGORIJA_PO_KODU.get(brojiSe)!.id}`;
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
    ispod_javnog_ha: Object.fromEntries([...ispodJavnog].map(([id, v]) => [id, ha(v)])),
    ispod_plana_ha: Object.fromEntries([...ispodPlana].map(([id, v]) => [id, ha(v)])),
    po_kategoriji_ha: poKategoriji,
    po_skupini_ha: poSkupini,
    po_namjeni_ha: zone,
    u_stambenim_zonama_ha: Object.fromEntries(
      KATEGORIJE.filter((k) => uStambenim.has(k.kod)).map((k) => [k.id, ha(uStambenim.get(k.kod)!)]),
    ),
    zona_gradnje: ZONA_GRADNJE,
  };
  writeFileSync(path.join(KORIJEN, "data", "gup-grad", "gradnja-2025.json"), JSON.stringify(zbroj, null, 1) + "\n");
  console.log(plocice.length, "pločica;", zbroj.ukupno_ha, "ha");
  console.log(poSkupini);
  console.log(poKategoriji);
}

main();
