/**
 * Vrtnja proizvodnog modela perjanice kroz povijesne sate, za provjeru.
 *
 * Ovo **nije** drugi model nego isti onaj koji stranica vrti u radnicima:
 * `stvoriDimSirovo` iz `src/lib/dim.ts` nad poljem koje slaže
 * `src/lib/sim/polje.ts` iz `public/karepovac/sim-polje.bin`, koračano
 * pravilom `planSata` iz `src/lib/sim/simulacija.ts`. Sve što se ovdje
 * mijenja u odnosu na stranicu jest da se sat ne crta nego očita na
 * prijemnicima — i da se, po izboru, slika gustoće spremi na disk.
 *
 * ## Lanac, rupe i zalet
 *
 * Model pamti zrak najviše `vijek` sekundi prikaza (2,7 stvarna sata), pa se
 * povijest smije rezati na neovisne komade: svaki komad počne `ZALET_SATI`
 * sati prije prvog sata koji bilježi. To je isto pravilo po kojem stranica
 * računa svaki sat iz vlastita zaleta (`zaSat`), samo što se ovdje lanac
 * ne prekida na svakom satu nego teče dok teku i ulazi.
 *
 * Sat bez vjetra je rupa: lanac se prekida, a nakon rupe prva se tri sata
 * odrade i ne bilježe — kao i na stranici, gdje se takav sat ne može
 * odabrati. Rupa se ne popunjava izmišljenim vjetrom.
 *
 * ## Zašto očitanje 3 × 3
 *
 * Rešetka gustoće je 200 × 200 nad 6,4 km, dakle 32 m po ćeliji; jedna
 * ćelija je pod razlučivosti polja vjetra (25 m) i pod šumom čestica. Tri
 * puta tri ćelije (≈ 100 m) je isto očitanje kojim je izvedeno sidro
 * ljestvice (`SIDRO_SIMULATORA`), pa gustoće ostaju usporedive s njim.
 */

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stvoriDimSirovo, type Postavke, type Simulacija } from "@/lib/dim";
import { razloziOsnove, slozi, type Osnove } from "@/lib/sim/polje";
import { SIM_POLJE } from "@/generated/karepovac-sim-polje";
import {
  planSata,
  POSTAVKE_SIMULATORA,
  SEKUNDI_PO_SATU,
  ZALET_SATI,
} from "@/lib/sim/simulacija";
import { NEUTRALNO, razredStabilnosti } from "@/lib/sim/stabilnost";

import { izvediDrenazu } from "./drenaza";
import type { Predikcija, Prijemnik, SatUlaza } from "./tipovi";

/**
 * Razred stabilnosti sata iz okolnosti (zračenje, naoblaka) i brzine; D kad
 * okolnosti nema. Isti izračun kao `scripts/oblacici.py`.
 */
export function stabilnostSata(u: SatUlaza): number {
  if (!u.vjetar || !u.okolnosti) return NEUTRALNO;
  const { sunce, oblaci } = u.okolnosti;
  if (sunce === null || oblaci === null) return NEUTRALNO;
  return razredStabilnosti(u.vjetar.brzina, sunce, oblaci);
}

/**
 * Koliko sati zaleta postavke traže: bar `ZALET_SATI`, a više kad razred
 * smije produljiti vijek (`vijekNajvise`).
 */
export function zaletSati(postavke: Postavke = {}): number {
  const vijek = Math.max(postavke.vijek ?? POSTAVKE_SIMULATORA.vijek ?? 160, postavke.vijekNajvise ?? 0);
  return Math.max(ZALET_SATI, Math.ceil(vijek / SEKUNDI_PO_SATU));
}

/** Osnove se čitaju jednom po procesu; 1,4 MB ne treba čitati po komadu. */
let osnoveCache: Osnove | null = null;

export function ucitajOsnove(): Osnove {
  if (osnoveCache) return osnoveCache;
  const bin = readFileSync(join(process.cwd(), "public", SIM_POLJE.bajtovi));
  const osnove = razloziOsnove(
    bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  );
  // Polje otjecanja se izvodi iz LiDAR mreže; model ga uzima samo kad
  // postavka `drenaza` nije nula, pa je nošenje bez štete za ostale pokuse.
  const d = izvediDrenazu();
  osnoveCache = { ...osnove, drenaza: { x: d.x, y: d.y } };
  return osnoveCache;
}

/** Ćelija rešetke gustoće u kojoj prijemnik leži. */
export function celijaPrijemnika(
  p: Prijemnik,
  osnove: Osnove,
  sirina: number,
  visina: number,
): { i: number; j: number; uOkviru: boolean } {
  const g = osnove.granice;
  const fx = (p.lon - g.zapad) / (g.istok - g.zapad);
  const fy = (g.sjever - p.lat) / (g.sjever - g.jug);
  return {
    i: Math.round(fx * sirina),
    j: Math.round(fy * visina),
    uOkviru: fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1,
  };
}

/** Prosjek gustoće 3 × 3 oko ćelije; ćelije izvan rešetke ne ulaze. */
function ocitaj3x3(
  g: Float32Array,
  sirina: number,
  visina: number,
  i0: number,
  j0: number,
): number {
  let zbroj = 0;
  let n = 0;
  for (let dj = -1; dj <= 1; dj += 1) {
    for (let di = -1; di <= 1; di += 1) {
      const i = i0 + di;
      const j = j0 + dj;
      if (i < 0 || i >= sirina || j < 0 || j >= visina) continue;
      zbroj += g[j * sirina + i];
      n += 1;
    }
  }
  return n ? zbroj / n : 0;
}

export type Snimka = {
  readonly sat: string;
  readonly sirina: number;
  readonly visina: number;
  readonly gustoca: Float32Array;
  readonly merkaptani: Float32Array;
};

/**
 * Kako se lanac vodi kroz sate.
 *
 * - `proizvodnja`: kao na stranici — svaki sat iz **vlastita** hladnog
 *   starta `ZALET_SATI` sati ranije (`zaSat` u `simulacija.ts`). Četiri puta
 *   skuplje, ali vjerno: stranica ne vrti neprekinut lanac.
 * - `lanac`: jedan neprekinut lanac, sat za satom, kao `ocijeni-sim.ts`.
 *
 * Dvoje se **ne poklapa**, i to je nalaz, ne sitnica: pri slabom vjetru se
 * spremnik čestica (10 000 u simulatoru) napuni, pa izvor ne curi jednoliko
 * nego u naletima koji ovise o tome kad je simulacija pokrenuta — u
 * `_proba` mjerenju od 18 % do 100 % nazivne emisije po deset minuta.
 * Vidi ARCHITECTURE.md, „Poznati izvori pogreške”.
 */
export type NacinLanca = "proizvodnja" | "lanac";

export type OpcijeVrtnje = {
  /** Postavke povrh `POSTAVKE_SIMULATORA`; ovdje ulaze pokusi s parametrima. */
  readonly postavke?: Postavke;
  /** Zadano `proizvodnja`; vidi `NacinLanca`. */
  readonly nacin?: NacinLanca;
  /**
   * Koliko puta u satu se gustoća slika i usrednjuje; zadano 1 (samo kraj
   * sata, kao na stranici).
   *
   * Mjerenje na postaji je **satni prosjek**, a slika na kraju sata je
   * trenutak. Razlika nije sitnica: perjanica u modelu vijuga cijelom
   * širinom s periodom od 48 minuta (`vijuganje` u `dim.ts`), pa trenutak
   * na kraju sata uhvati čas jednu, čas drugu stranu — pri stalnom vjetru
   * od 1,2 m/s gustoća na k1 iz sata u sat skače 0 → 47 → 39 → 5 → 0,4
   * (`model.test.ts`). Stranica, koja svaki sat računa iz istog hladnog
   * starta, uvijek uhvati **istu** fazu, pa je otklon sustavan. Usrednjeno
   * po satu toga nema, i tek tada se model uspoređuje s onim što postaja
   * doista mjeri.
   */
  readonly uzoraka?: number;
  /** Za koje sate spremiti cijelu sliku; zadano ni za jedan. */
  readonly snimaj?: (sat: string) => boolean;
  readonly naSnimku?: (snimka: Snimka) => void;
  /** Javlja napredak, radi dugih vrtnji. */
  readonly naSat?: (sat: string, redni: number, ukupno: number) => void;
};

/**
 * Vrti model kroz sate redom i vraća predikcije na prijemnicima.
 *
 * Args:
 *   ulazi: Sati redom, s vjetrom ili bez njega; sati bez vjetra su rupe.
 *   prijemnici: Gdje se očitava.
 *   opcije: Postavke i snimanje.
 *
 * Returns:
 *   Predikcije za sate koji su imali vjetar i nisu prva tri nakon rupe.
 */
export function vrtiModel(
  ulazi: readonly SatUlaza[],
  prijemnici: readonly Prijemnik[],
  opcije: OpcijeVrtnje = {},
): Predikcija[] {
  if ((opcije.nacin ?? "proizvodnja") === "lanac") return vrtiLanac(ulazi, prijemnici, opcije);
  // Po satu: svaki sat od `ZALET_SATI` ranije, iz hladnog starta, kao što
  // radnik na stranici radi za svaki kadar. Sat koji nema puna tri sata
  // vjetra ispred sebe ne dobiva predikciju — ni na stranici je nema.
  const izlaz: Predikcija[] = [];
  const zalet = zaletSati(opcije.postavke);
  for (let k = zalet; k < ulazi.length; k += 1) {
    const prozor = ulazi.slice(k - zalet, k + 1);
    if (prozor.some((u) => !u.vjetar || !u.dubina)) continue;
    const t0 = Date.parse(prozor[0].sat);
    if (prozor.some((u, i) => Date.parse(u.sat) !== t0 + i * 3600_000)) continue;
    opcije.naSat?.(ulazi[k].sat, k, ulazi.length);
    izlaz.push(...vrtiLanac(prozor, prijemnici, { ...opcije, naSat: undefined }));
  }
  return izlaz;
}

function vrtiLanac(
  ulazi: readonly SatUlaza[],
  prijemnici: readonly Prijemnik[],
  opcije: OpcijeVrtnje = {},
): Predikcija[] {
  const osnove = ucitajOsnove();
  const celijaM = osnove.sirinaM / osnove.gw;
  const par: Postavke = {
    ...POSTAVKE_SIMULATORA,
    ...(opcije.postavke ?? {}),
    metaraX: osnove.sirinaM,
    metaraY: osnove.visinaM,
  };

  const izlaz: Predikcija[] = [];
  const zalet = zaletSati(opcije.postavke);
  let sim: Simulacija | null = null;
  let prosliMs = Number.NaN;
  let zagrijano = 0;
  let mjesta: { p: Prijemnik; i: number; j: number }[] | null = null;

  ulazi.forEach((u, redni) => {
    opcije.naSat?.(u.sat, redni, ulazi.length);
    const ms = Date.parse(u.sat);
    if (!u.vjetar || !u.dubina) {
      // Rupa: lanac se prekida. Čestice koje jesu u zraku ostaju, ali sat
      // bez vjetra ne zna kamo bi ih nosio, pa se iduća tri sata ne bilježe.
      zagrijano = 0;
      prosliMs = Number.NaN;
      return;
    }
    const stanje = {
      smjerOd: u.vjetar.smjerOd,
      brzina: u.vjetar.brzina,
      dubina: u.dubina.m,
      stabilnost: stabilnostSata(u),
    };
    const polje = slozi(stanje, osnove);
    const hladno = sim === null || ms - prosliMs !== 3600_000;
    if (sim === null) {
      sim = stvoriDimSirovo(polje, { ...par, pocetakMs: ms, krajMs: ms + 3600_000 });
    } else {
      sim.postaviPolje(polje);
      sim.postavi("krajMs", ms + 3600_000);
    }
    sim.postavi("stabilnost", stanje.stabilnost);
    if (hladno) zagrijano = 0;

    const { koraka, dt } = planSata(stanje.brzina, celijaM);
    const biljezi = zagrijano + 1 > zalet;
    const uzoraka = Math.max(1, Math.round(opcije.uzoraka ?? 1));
    const snimaj = biljezi && (opcije.snimaj?.(u.sat) ?? false);
    if (biljezi && !mjesta) {
      mjesta = prijemnici.map((p) => {
        const c = celijaPrijemnika(p, osnove, sim!.sirina, sim!.visina);
        return { p, i: c.i, j: c.j };
      });
    }
    const zbrojH = mjesta ? new Float64Array(mjesta.length) : null;
    const zbrojM = mjesta ? new Float64Array(mjesta.length) : null;
    let zbrojSlike: Float32Array | null = null;
    let zbrojSlikeM: Float32Array | null = null;
    let uzeto = 0;
    for (let k = 0; k < koraka; k += 1) {
      sim.korak(dt);
      // Uzorci su ravnomjerno po satu, zadnji na samom kraju sata.
      const naRedu = biljezi && Math.floor(((k + 1) * uzoraka) / koraka) > Math.floor((k * uzoraka) / koraka);
      if (!naRedu || !mjesta || !zbrojH || !zbrojM) continue;
      // `crtaj` vraća unutarnji spremnik koji sljedeći poziv prepisuje, pa se
      // sumporovodikova slika očita (i po potrebi kopira) prije merkaptanske.
      const g = sim.crtaj();
      mjesta.forEach((m, q) => {
        zbrojH[q] += ocitaj3x3(g, sim!.sirina, sim!.visina, m.i, m.j);
      });
      if (snimaj) {
        if (!zbrojSlike) zbrojSlike = new Float32Array(g.length);
        for (let i = 0; i < g.length; i += 1) zbrojSlike[i] += g[i];
      }
      const gm = sim.crtaj("merkaptani");
      mjesta.forEach((m, q) => {
        zbrojM[q] += ocitaj3x3(gm, sim!.sirina, sim!.visina, m.i, m.j);
      });
      if (snimaj) {
        if (!zbrojSlikeM) zbrojSlikeM = new Float32Array(gm.length);
        for (let i = 0; i < gm.length; i += 1) zbrojSlikeM[i] += gm[i];
      }
      uzeto += 1;
    }
    zagrijano += 1;
    prosliMs = ms;

    if (!biljezi || !mjesta || !zbrojH || !zbrojM || uzeto === 0) return;

    mjesta.forEach((m, q) => {
      izlaz.push({
        sat: u.sat,
        prijemnik: m.p.ime,
        gustoca: zbrojH[q] / uzeto,
        merkaptani: zbrojM[q] / uzeto,
      });
    });
    if (snimaj && zbrojSlike && zbrojSlikeM) {
      const sl = zbrojSlike as Float32Array;
      const slM = zbrojSlikeM as Float32Array;
      for (let i = 0; i < sl.length; i += 1) sl[i] /= uzeto;
      for (let i = 0; i < slM.length; i += 1) slM[i] /= uzeto;
      opcije.naSnimku?.({
        sat: u.sat,
        sirina: sim.sirina,
        visina: sim.visina,
        gustoca: sl,
        merkaptani: slM,
      });
    }
  });

  return izlaz;
}

/**
 * Dijeli sate na komade koji se smiju računati neovisno.
 *
 * Svaki komad dobiva `ZALET_SATI` sati zaleta ispred sebe (iz prethodnog
 * komada), pa su predikcije jednake onima iz jednog neprekinutog lanca —
 * do na slučajnost čestica, koja je ionako sjeme rođenja, ne povijest.
 *
 * Args:
 *   ulazi: Svi sati redom.
 *   komada: Na koliko komada.
 *
 * Returns:
 *   Komadi; svaki nosi sate koje računa i sate koje samo bilježi.
 */
export function razdijeli(
  ulazi: readonly SatUlaza[],
  komada: number,
  zalet: number = ZALET_SATI,
): { sati: SatUlaza[]; biljeziOd: string }[] {
  const n = ulazi.length;
  const koliko = Math.max(1, Math.min(komada, n));
  const velicina = Math.ceil(n / koliko);
  const izlaz: { sati: SatUlaza[]; biljeziOd: string }[] = [];
  for (let k = 0; k < koliko; k += 1) {
    const od = k * velicina;
    if (od >= n) break;
    const do_ = Math.min(n, od + velicina);
    const pocetak = Math.max(0, od - zalet);
    izlaz.push({ sati: ulazi.slice(pocetak, do_), biljeziOd: ulazi[od].sat });
  }
  return izlaz;
}

/**
 * Oznaka inačice modela: git zapis + sažetak fizike + sažetak postavki.
 *
 * Fizika je `src/lib/dim.ts` i `src/lib/sim/polje.ts` (i osnove polja);
 * promjena bilo čega od toga daje drugu oznaku, pa se dvije vrtnje s istom
 * oznakom smiju uspoređivati kao ista stvar.
 */
export function oznakaModela(postavke: Postavke = {}): {
  git: string;
  fizika: string;
  postavke: string;
  oznaka: string;
} {
  let git = "bez-gita";
  try {
    git = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    // Izvan repozitorija oznaka ostaje bez zapisa; provjera i dalje radi.
  }
  const h = createHash("sha1");
  for (const put of [
    "src/lib/dim.ts",
    "src/lib/sim/polje.ts",
    "src/lib/sim/simulacija.ts",
    "src/lib/polje-dima.ts",
    "public/karepovac/sim-polje.bin",
  ]) {
    h.update(readFileSync(join(process.cwd(), put)));
  }
  const fizika = h.digest("hex").slice(0, 10);
  const postavkeSazetak = createHash("sha1")
    .update(JSON.stringify({ ...POSTAVKE_SIMULATORA, ...postavke }, Object.keys({ ...POSTAVKE_SIMULATORA, ...postavke }).sort()))
    .digest("hex")
    .slice(0, 8);
  return {
    git,
    fizika,
    postavke: postavkeSazetak,
    oznaka: `${git}-${fizika}-${postavkeSazetak}`,
  };
}
