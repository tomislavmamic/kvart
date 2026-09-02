/**
 * Jedna vrtnja provjere: ulazi → model → ocjena → zapis.
 *
 * Sve što vrtnja pojede i ispljune ostaje na disku pod
 * `.cache/hindcast/runs/<id>/` (ulazi, parametri, predikcije, snimke), a
 * sažetak ocjene ide u `docs/hindcast/<id>.json` i u `docs/STATUS.json`,
 * da se pokus može ponoviti i usporediti s drugim pokusom bez čitanja
 * dnevnika razgovora.
 *
 * Model se vrti u više procesa (`model.komad.ts`), po komadima sa zaletom;
 * ocjena se računa odvojeno za svako razdoblje (`ugadjanje`, `provjera`,
 * `zadrzano`) i za cjelinu, uvijek uz nulti pojas i nulte modele — brojka
 * bez njih ne znači ništa.
 *
 * Pokretanje:
 *   npx tsx scripts/hindcast/pokreni.ts --id polazno --od 2024-09-01 --do 2026-09-03
 *     [--pravilo proizvodnja|spoj|split3|marjan|ldsp|prognoza|era5]
 *     [--nacin proizvodnja|lanac] [--uzoraka 6] [--azoKasni] [--h2s zavod-k1|azo308]
 *     [--postavke put.json] [--radnika 8]
 *     [--snimke sat1,sat2,…|epizode] [--opis "…"]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { join } from "node:path";

import type { Postavke } from "@/lib/dim";
import { POSTAVKE_SIMULATORA } from "@/lib/sim/simulacija";

import { EPIZODE, RAZDOBLJA, satiEpizoda } from "./epizode";
import { kljucDojave, sazetak, type Ocjena } from "./metrike";
import { oznakaModela, razdijeli, ucitajOsnove, zaletSati } from "./model";
import { slikaPng } from "./slika";
import type { NacinLanca } from "./model";
import type {
  Opazanja,
  Predikcija,
  Prijemnik,
  PraviloVjetra,
  Razdoblje,
  SatUlaza,
  Uloga,
} from "./tipovi";
import {
  PRIJEMNICI,
  pokrivenost,
  prijemniciDojava,
  sloziUlaze,
  ucitajDubine,
  ucitajOkolnosti,
  ucitajOpazanja,
  ucitajVjetar,
} from "./ulazi";

const KORIJEN = process.cwd();
const MAPA_VRTNJI = join(KORIJEN, ".cache", "hindcast", "runs");
const MAPA_SAZETAKA = join(KORIJEN, "docs", "hindcast");

/** Azimut od k1 prema težištu plohe: odatle vjetar donosi zrak na postaju. */
const AZIMUT_UZVJETRA_K1 = 320;

/** Prag epizode na k1: 90. postotak izmjerenog H₂S-a u razdoblju ugađanja. */
const UDIO_VRHA = 0.1;

type Argumenti = {
  id: string;
  od: string;
  do: string;
  pravilo: PraviloVjetra;
  nacin: NacinLanca;
  postavke: Postavke;
  postavkePut: string | null;
  radnika: number;
  snimke: "epizode" | "nista" | string[];
  opis: string;
  h2sIzvor: "azo308" | "zavod-k1";
  /** Kao stranica: AZO-ov vjetar označen sat kasnije; vidi `OpcijeSlaganja`. */
  azoKasni: boolean;
  /** Uzoraka gustoće po satu za prosjek; 1 = trenutak na kraju sata, kao stranica. */
  uzoraka: number;
};

function argumenti(): Argumenti {
  const a = process.argv.slice(2);
  const uzmi = (ime: string, zadano: string | null = null): string | null => {
    const i = a.indexOf(`--${ime}`);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : zadano;
  };
  const id = uzmi("id");
  const od = uzmi("od");
  const do_ = uzmi("do");
  if (!id || !od || !do_) {
    console.error("pokreni.ts --id <ime> --od GGGG-MM-DD --do GGGG-MM-DD [--pravilo] [--nacin] [--postavke] [--radnika] [--snimke] [--opis]");
    process.exit(1);
  }
  const postavkePut = uzmi("postavke");
  const snimke = uzmi("snimke", "epizode")!;
  return {
    id,
    od,
    do: do_,
    pravilo: (uzmi("pravilo", "proizvodnja") as PraviloVjetra),
    nacin: (uzmi("nacin", "proizvodnja") as NacinLanca),
    postavke: postavkePut ? JSON.parse(readFileSync(postavkePut, "utf8")) : {},
    postavkePut,
    radnika: Number(uzmi("radnika", String(Math.max(1, cpus().length - 1)))),
    snimke: snimke === "epizode" ? "epizode" : snimke === "nista" ? "nista" : snimke.split(","),
    opis: uzmi("opis", "") ?? "",
    // Zavodova tablica je provjeren pogled na isti uređaj: AZO-ov izvoz nosi
    // tisuće sati s točnom nulom gdje je uređaj stajao, a Zavod ih nema.
    h2sIzvor: (uzmi("h2s", "zavod-k1") as "azo308" | "zavod-k1"),
    azoKasni: a.includes("--azoKasni"),
    uzoraka: Number(uzmi("uzoraka", "1")),
  };
}

function uSat(datum: string): string {
  return new Date(`${datum}T00:00:00.000Z`).toISOString();
}

/** Vrti jedan komad u vlastitom procesu i vraća njegove predikcije. */
function vrtiKomad(
  mapa: string,
  redni: number,
  komad: { sati: SatUlaza[]; biljeziOd: string },
  prijemnici: readonly Prijemnik[],
  postavke: Postavke,
  nacin: NacinLanca,
  uzoraka: number,
  snimke: readonly string[],
): Promise<Predikcija[]> {
  const ulazPut = join(mapa, "komadi", `${redni}.ulaz.json`);
  const izlazPut = join(mapa, "komadi", `${redni}.izlaz.json`);
  mkdirSync(join(mapa, "komadi"), { recursive: true });
  const satiKomada = new Set(komad.sati.map((s) => s.sat));
  writeFileSync(
    ulazPut,
    JSON.stringify({
      sati: komad.sati,
      biljeziOd: komad.biljeziOd,
      prijemnici,
      postavke,
      nacin,
      uzoraka,
      snimke: snimke.filter((s) => satiKomada.has(s) && s >= komad.biljeziOd),
      mapaSnimki: join(mapa, "snimke"),
    }),
  );
  return new Promise((rijesi, odbij) => {
    const dijete = spawn(
      process.execPath,
      ["--import", "tsx", join(KORIJEN, "scripts", "hindcast", "model.komad.ts"), ulazPut, izlazPut],
      { cwd: KORIJEN, stdio: ["ignore", "inherit", "inherit"] },
    );
    dijete.on("exit", (kod) => {
      if (kod !== 0) {
        odbij(new Error(`komad ${redni} pao s kodom ${kod}`));
        return;
      }
      rijesi(JSON.parse(readFileSync(izlazPut, "utf8")));
    });
  });
}

/** Najviše `radnika` komada odjednom. */
async function vrtiSve<T>(poslovi: (() => Promise<T>)[], radnika: number): Promise<T[]> {
  const rezultati: T[] = new Array(poslovi.length);
  let sljedeci = 0;
  async function radnik(): Promise<void> {
    while (sljedeci < poslovi.length) {
      const i = sljedeci;
      sljedeci += 1;
      rezultati[i] = await poslovi[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(radnika, poslovi.length) }, radnik));
  return rezultati;
}

/** Sati razdoblja, po ulozi; `sve` je cijela vrtnja. */
function uRazdoblju(sat: string, r: Razdoblje): boolean {
  return sat >= uSat(r.od) && sat < uSat(r.do);
}

type OcjenaRazdoblja = {
  uloga: Uloga | "sve";
  razdoblje: Razdoblje;
  h2s: Ocjena | null;
  merkaptani: Ocjena | null;
};

function ocijeniRazdoblje(
  uloga: Uloga | "sve",
  razdoblje: Razdoblje,
  ulazi: readonly SatUlaza[],
  predikcije: readonly Predikcija[],
  opazanja: Opazanja,
  h2sIzvor: Argumenti["h2sIzvor"],
): OcjenaRazdoblja {
  const naK1 = new Map(
    predikcije.filter((p) => p.prijemnik === "k1").map((p) => [p.sat, p]),
  );
  const ulaziUR = ulazi.filter((u) => uRazdoblju(u.sat, razdoblje));
  const ugadjanjeR = RAZDOBLJA.ugadjanje;

  function ocjena(
    mjereno: Map<string, number>,
    model: (p: Predikcija) => number,
    ukljuciDojave: boolean,
  ): Ocjena | null {
    const sati = ulaziUR.map((u) => u.sat).filter((s) => naK1.has(s) && mjereno.has(s));
    if (sati.length < 50) return null;
    const x = sati.map((s) => model(naK1.get(s)!));
    const y = sati.map((s) => mjereno.get(s)!);
    // Prag epizode se veže uz razdoblje ugađanja, da isti prag vrijedi za
    // sva razdoblja — inače bi „epizoda” u svakom razdoblju značila drugo.
    const uUgadjanju = [...mjereno.entries()].filter(([s]) => uRazdoblju(s, ugadjanjeR)).map(([, v]) => v);
    const osnovaPraga = uUgadjanju.length >= 500 ? uUgadjanju : y;
    const sortirano = [...osnovaPraga].sort((a, b) => a - b);
    const pragMjereno = sortirano[Math.min(sortirano.length - 1, Math.floor(sortirano.length * (1 - UDIO_VRHA)))];
    const satiUg = [...mjereno.keys()].filter((s) => uRazdoblju(s, ugadjanjeR) && !uRazdoblju(s, razdoblje));
    const dojave = ukljuciDojave ? opazanja.dojave.filter((d) => uRazdoblju(d.sat, razdoblje)) : [];
    const predikcijeDojava = new Map<string, number>();
    for (const p of predikcije) predikcijeDojava.set(kljucDojave(p.prijemnik, p.sat), model(p));
    const pragModela = (() => {
      const s = [...x].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(s.length * (1 - UDIO_VRHA)))];
    })();
    return sazetak({
      sati,
      model: x,
      mjereno: y,
      ulazi: ulaziUR,
      pragMjereno,
      udioVrha: UDIO_VRHA,
      nizvjetar: (u) => {
        if (!u.vjetar) return false;
        const d = Math.abs(((u.vjetar.smjerOd - AZIMUT_UZVJETRA_K1 + 540) % 360) - 180);
        return d <= 45;
      },
      ugadjanje: satiUg.length >= 500 ? { sati: satiUg, vrijednosti: satiUg.map((s) => mjereno.get(s)!) } : undefined,
      azimutUzvjetra: AZIMUT_UZVJETRA_K1,
      dojave: dojave.length ? dojave : undefined,
      predikcije: dojave.length ? predikcijeDojava : undefined,
      pragDojava: dojave.length ? pragModela : undefined,
    });
  }

  const h2s = new Map<string, number>();
  for (const o of opazanja.h2s) if (o.izvor === h2sIzvor) h2s.set(o.sat, o.vrijednost);
  const merk = new Map<string, number>();
  for (const o of opazanja.merkaptani) merk.set(o.sat, o.vrijednost);

  return {
    uloga,
    razdoblje,
    h2s: ocjena(h2s, (p) => p.gustoca, true),
    merkaptani: ocjena(merk, (p) => p.merkaptani, false),
  };
}

async function glavno(): Promise<void> {
  const arg = argumenti();
  const mapa = join(MAPA_VRTNJI, arg.id);
  mkdirSync(mapa, { recursive: true });
  mkdirSync(MAPA_SAZETAKA, { recursive: true });
  const pocetak = Date.now();

  // 1. Ulazi, s podrijetlom.
  const razdoblje: Razdoblje = { od: arg.od, do: arg.do };
  const [vjetar, dubine, okolnosti, opazanja] = await Promise.all([
    ucitajVjetar(),
    ucitajDubine(),
    ucitajOkolnosti(),
    ucitajOpazanja(),
  ]);
  const ulazi = sloziUlaze(arg.pravilo, razdoblje, { vjetar, dubine, okolnosti }, { azoKasni: arg.azoKasni });
  const prijemnici: Prijemnik[] = [...PRIJEMNICI];
  for (const p of prijemniciDojava(opazanja.dojave)) {
    if (!prijemnici.some((q) => q.ime === p.ime)) prijemnici.push(p);
  }
  const pokr = pokrivenost(ulazi);
  console.error(`ulazi: ${pokr.ukupno} sati, bez vjetra ${pokr.bezVjetra}; po izvoru ${JSON.stringify(pokr.poIzvoru)}`);
  writeFileSync(join(mapa, "ulazi.json"), JSON.stringify({ razdoblje, pravilo: arg.pravilo, pokrivenost: pokr, ulazi }));
  writeFileSync(join(mapa, "opazanja.json"), JSON.stringify(opazanja));
  writeFileSync(join(mapa, "prijemnici.json"), JSON.stringify(prijemnici, null, 1));

  // 2. Parametri i oznaka inačice.
  const oznaka = oznakaModela(arg.postavke);
  const parametri = {
    id: arg.id,
    opis: arg.opis,
    oznaka,
    nacin: arg.nacin,
    uzoraka: arg.uzoraka,
    pravilo: arg.pravilo,
    azoKasni: arg.azoKasni,
    h2sIzvor: arg.h2sIzvor,
    postavke: { ...POSTAVKE_SIMULATORA, ...arg.postavke },
    postavkePut: arg.postavkePut,
    razdoblje,
    pokrenuto: new Date().toISOString(),
  };
  writeFileSync(join(mapa, "parametri.json"), JSON.stringify(parametri, null, 1));

  // 3. Snimke: sati epizoda unutar razdoblja, ili zadani popis.
  const snimke =
    arg.snimke === "nista"
      ? []
      : arg.snimke === "epizode"
        ? satiEpizoda(EPIZODE).filter((s) => uRazdoblju(s, razdoblje))
        : arg.snimke;

  // 4. Model po komadima. Komada je više nego radnika, da spori komadi
  // (slab vjetar → više koraka) ne drže cijelu vrtnju na kraju.
  const komadi = razdijeli(ulazi, Math.max(arg.radnika * 3, 1), zaletSati(arg.postavke));
  console.error(`model: ${komadi.length} komada na ${arg.radnika} radnika, način ${arg.nacin}, inačica ${oznaka.oznaka}`);
  const rezultati = await vrtiSve(
    komadi.map((k, i) => () => vrtiKomad(mapa, i, k, prijemnici, arg.postavke, arg.nacin, arg.uzoraka, snimke)),
    arg.radnika,
  );
  const predikcije = rezultati.flat().sort((a, b) => a.sat.localeCompare(b.sat) || a.prijemnik.localeCompare(b.prijemnik));
  writeFileSync(join(mapa, "predikcije.json"), JSON.stringify(predikcije));
  console.error(`model: ${predikcije.length} predikcija u ${((Date.now() - pocetak) / 60000).toFixed(1)} min`);

  // 5. Slike snimaka, istom ljestvicom kao na stranici.
  if (snimke.length) {
    const osnove = ucitajOsnove();
    const ploha = plohaObris();
    mkdirSync(join(mapa, "slike"), { recursive: true });
    for (const sat of snimke) {
      const ime = sat.replace(/[:.]/g, "-");
      const put = join(mapa, "snimke", `${ime}.h2s.f32`);
      if (!existsSync(put)) continue;
      const buf = readFileSync(put);
      const g = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const n = Math.round(Math.sqrt(g.length));
      writeFileSync(join(mapa, "slike", `${ime}.png`), slikaPng(g, n, n, { prijemnici, ploha }));
    }
    void osnove;
  }

  // 6. Ocjena po razdobljima.
  const ocjene: OcjenaRazdoblja[] = [
    ocijeniRazdoblje("sve", razdoblje, ulazi, predikcije, opazanja, arg.h2sIzvor),
    ...(Object.entries(RAZDOBLJA) as [Uloga, Razdoblje][])
      .filter(([, r]) => uSat(r.od) < uSat(arg.do) && uSat(r.do) > uSat(arg.od))
      .map(([uloga, r]) => ocijeniRazdoblje(uloga, r, ulazi, predikcije, opazanja, arg.h2sIzvor)),
  ];
  writeFileSync(join(mapa, "ocjena.json"), JSON.stringify(ocjene, null, 1));

  // 7. Sažetak za docs i STATUS.
  const kratko = (o: Ocjena | null) =>
    o
      ? {
          n: o.n,
          spearman: o.ukupno.spearman,
          spearmanBezHoda: o.ukupno.spearmanBezHoda,
          aucVrha: o.ukupno.aucVrha,
          nultiPojasSpearman: o.nultiPojas.spearman,
          nultiPojasAuc: o.nultiPojas.aucVrha,
          POD: o.kontingencija.POD,
          FAR: o.kontingencija.FAR,
          CSI: o.kontingencija.CSI,
          nagib: o.regresija.nagib,
          nagib95: o.regresija.nagib95,
          odsjecak: o.regresija.odsjecak,
          nultiModeli: o.nultiModeli,
          noc: o.rezimi.dobaDana.noc,
          dan: o.rezimi.dobaDana.dan,
          dojave: o.dojave,
        }
      : null;
  const sazetakVrtnje = {
    id: arg.id,
    opis: arg.opis,
    oznaka,
    nacin: arg.nacin,
    uzoraka: arg.uzoraka,
    pravilo: arg.pravilo,
    azoKasni: arg.azoKasni,
    h2sIzvor: arg.h2sIzvor,
    postavke: parametri.postavke,
    razdoblje,
    pokrivenost: pokr,
    trajanjeMin: Number(((Date.now() - pocetak) / 60000).toFixed(1)),
    ocjene: ocjene.map((o) => ({
      uloga: o.uloga,
      razdoblje: o.razdoblje,
      h2s: kratko(o.h2s),
      merkaptani: kratko(o.merkaptani),
    })),
    epizode: EPIZODE.filter((e) => uSat(e.razdoblje.od) < uSat(arg.do) && uSat(e.razdoblje.do) > uSat(arg.od)).map((e) => e.id),
  };
  writeFileSync(join(MAPA_SAZETAKA, `${arg.id}.json`), JSON.stringify(sazetakVrtnje, null, 1));
  upisiUStatus(sazetakVrtnje);

  for (const o of ocjene) {
    const h = o.h2s;
    console.error(
      `${o.uloga.padEnd(10)} ${o.razdoblje.od}…${o.razdoblje.do}: ` +
        (h
          ? `n=${h.n} ρ=${h.ukupno.spearman} (bez hoda ${h.ukupno.spearmanBezHoda}, nulti ${h.nultiPojas.spearman.min}…${h.nultiPojas.spearman.max}) AUC=${h.ukupno.aucVrha} POD=${h.kontingencija.POD} FAR=${h.kontingencija.FAR}` +
            (h.dojave ? ` dojave n=${h.dojave.n} POD=${h.dojave.POD} FAR=${h.dojave.FAR} AUC=${h.dojave.aucDojava}` : "")
          : "premalo sati"),
    );
  }
  console.error(`zapisano ${join("docs", "hindcast", `${arg.id}.json`)}`);
}

/** Obris glavne plohe iz GeoJSON-a, za sliku. */
function plohaObris(): [number, number][] {
  const put = join(KORIJEN, "public", "geo", "karepovac.geojson");
  if (!existsSync(put)) return [];
  const gj = JSON.parse(readFileSync(put, "utf8"));
  const prsten = gj.features?.[0]?.geometry?.coordinates?.[0];
  return Array.isArray(prsten) ? prsten.map((p: number[]) => [p[0], p[1]]) : [];
}

/** Upisuje (ili zamjenjuje) pokus s istim `id` u docs/STATUS.json. */
function upisiUStatus(s: { id: string } & Record<string, unknown>): void {
  const put = join(KORIJEN, "docs", "STATUS.json");
  const status = existsSync(put) ? JSON.parse(readFileSync(put, "utf8")) : {};
  const pokusi: Record<string, unknown>[] = Array.isArray(status.pokusi) ? status.pokusi : [];
  const bezStarog = pokusi.filter((p) => p.id !== s.id);
  bezStarog.push({
    id: s.id,
    opis: s.opis,
    oznaka: (s.oznaka as { oznaka: string }).oznaka,
    nacin: s.nacin,
    uzoraka: s.uzoraka,
    pravilo: s.pravilo,
    azoKasni: s.azoKasni,
    razdoblje: s.razdoblje,
    ocjene: (s.ocjene as { uloga: string; h2s: Record<string, unknown> | null }[]).map((o) => ({
      uloga: o.uloga,
      h2s: o.h2s
        ? {
            n: o.h2s.n,
            spearman: o.h2s.spearman,
            aucVrha: o.h2s.aucVrha,
            POD: o.h2s.POD,
            FAR: o.h2s.FAR,
            nultiPojasSpearman: o.h2s.nultiPojasSpearman,
            dojave: o.h2s.dojave,
          }
        : null,
    })),
    sazetak: `docs/hindcast/${s.id}.json`,
  });
  status.pokusi = bezStarog;
  status.azurirano = new Date().toISOString();
  writeFileSync(put, JSON.stringify(status, null, 2) + "\n");
}

void glavno().catch((g) => {
  console.error(g);
  process.exit(1);
});
