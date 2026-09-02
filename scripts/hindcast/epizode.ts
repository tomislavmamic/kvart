/**
 * Knjižnica epizoda i uloge razdoblja za provjeru.
 *
 * Epizoda je razdoblje koje se u provjeri gleda izbliza: za njega se
 * spremaju snimke gustoće i slike, a ocjena se računa i na njemu samom.
 * Skup mora pokrivati ono što model mora znati, ne ono što mu ide od ruke:
 * jak miris, tišinu bez mirisa, stalan vjetar, promjenu vjetra, slab
 * vjetar, noćnu inverziju, dnevno miješanje, prijelaz s maestrala na
 * burin, i to po godišnjim dobima.
 *
 * ## Kako epizode nastaju
 *
 * Dio je ručno odabran (prozor dojava, jer je jedino s prijemnicima na
 * strani kvarta). Ostale bira `izvediEpizode` iz mjerenja i ulaza po
 * pravilima koja ne gledaju model — inače bi knjižnica bila probrana po
 * tome gdje model dobro radi. Pravila su zapisana uz svaku vrstu.
 *
 * ## Uloge razdoblja
 *
 * Uloge stoje ovdje, na jednom mjestu, da nijedan pokus ne može tiho
 * ugađati na skupu za provjeru. Vidi ARCHITECTURE.md §6.
 */

import type { Epizoda, Opazanja, Razdoblje, SatUlaza, Uloga } from "./tipovi";

export const RAZDOBLJA: Record<Uloga, Razdoblje> = {
  ugadjanje: { od: "2024-09-01", do: "2025-09-01" },
  provjera: { od: "2025-09-01", do: "2026-08-18" },
  zadrzano: { od: "2026-08-18", do: "2026-09-03" },
};

/** Uloga sata: prvo razdoblje koje ga sadrži. */
export function ulogaSata(sat: string): Uloga | null {
  for (const [uloga, r] of Object.entries(RAZDOBLJA) as [Uloga, Razdoblje][]) {
    if (sat >= `${r.od}T00:00:00.000Z` && sat < `${r.do}T00:00:00.000Z`) return uloga;
  }
  return null;
}

/** Ručno odabrane epizode; ostale dodaje `izvediEpizode`. */
export const RUCNE_EPIZODE: readonly Epizoda[] = [
  {
    id: "dojave-2026-08",
    naziv: "Prozor dojava, 26.–29. 8. 2026.",
    razdoblje: { od: "2026-08-26", do: "2026-08-30" },
    uloga: "zadrzano",
    vrsta: ["dojave", "ljeto", "slab-vjetar"],
    opis:
      "Jedino razdoblje s prijemnicima na strani kvarta: 15 dojava (8 s mirisom, 7 bez) s Dračevca 7B i iz Solina. Slab jugoistočnjak i promjenjiv vjetar, jutarnje i večernje epizode.",
  },
];

/** Sati (ISO) koje epizode pokrivaju, bez dvostrukih, rastuće. */
export function satiEpizoda(epizode: readonly Epizoda[]): string[] {
  const skup = new Set<string>();
  for (const e of epizode) {
    const od = Date.parse(`${e.razdoblje.od}T00:00:00.000Z`);
    const do_ = Date.parse(`${e.razdoblje.do}T00:00:00.000Z`);
    for (let t = od; t < do_; t += 3600_000) skup.add(new Date(t).toISOString());
  }
  return [...skup].sort();
}

function mjesniSat(sat: string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hourCycle: "h23" }).format(new Date(sat)),
  ) % 24;
}

function dan(sat: string): string {
  return sat.slice(0, 10);
}

function danPlus(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00.000Z`) + n * 86400_000).toISOString().slice(0, 10);
}

/**
 * Bira epizode iz mjerenja i ulaza, bez pogleda na model.
 *
 * Pravila, po vrsti (svaka epizoda je jedan dan 00–24 UTC plus dan prije,
 * da zalet i večer prije uđu u snimke):
 *
 * - `jak-miris`: dani s najvišim 95. postotkom H₂S-a na k1 (top 4 po
 *   razdoblju).
 * - `bez-mirisa`: dani s najnižim maksimumom H₂S-a, ali s potpunim
 *   mjerenjima (top 2 po razdoblju) — lažne uzbune se mjere ovdje.
 * - `promjena-vjetra`: dani s najvećim brojem sati u kojima se smjer
 *   okrenuo za više od 90° u odnosu na prethodni sat, uz brzinu ≥ 1 m/s
 *   (top 2 po razdoblju).
 * - `tisina`: dani s najvećim udjelom sati ispod 1 m/s (top 2 po razdoblju).
 * - `stalan-vjetar`: dani s najmanjim rasponom smjera uz brzinu ≥ 2 m/s
 *   (top 1 po razdoblju).
 * - `noc-inverzija`: noći (21–06) s najmanjom medijanskom dubinom sloja
 *   (top 2 po razdoblju).
 * - `dan-mijesanje`: dani s najvećom medijanskom dubinom 12–16 h (top 1).
 *
 * Args:
 *   ulazi: Sati s vjetrom i dubinom.
 *   opazanja: Mjerenja; koristi se H₂S s `zavod-k1` (ili što god ima kad njega nema).
 *
 * Returns:
 *   Epizode s ulogom prema razdoblju u koje padaju.
 */
export function izvediEpizode(ulazi: readonly SatUlaza[], opazanja: Opazanja): Epizoda[] {
  const h2s = new Map<string, number>();
  // Zavodova tablica je provjeren pogled na uređaj; AZO-ov izvoz ima nule
  // gdje je uređaj stajao. Kad Zavoda nema, uzima se što ima.
  for (const o of opazanja.h2s) if (o.izvor === "zavod-k1") h2s.set(o.sat, o.vrijednost);
  if (!h2s.size) for (const o of opazanja.h2s) h2s.set(o.sat, o.vrijednost);

  const poDanu = new Map<string, { h2s: number[]; ulazi: SatUlaza[] }>();
  for (const u of ulazi) {
    const d = dan(u.sat);
    const z = poDanu.get(d) ?? { h2s: [], ulazi: [] };
    z.ulazi.push(u);
    const v = h2s.get(u.sat);
    if (v !== undefined) z.h2s.push(v);
    poDanu.set(d, z);
  }

  const kvantil = (v: number[], q: number) => {
    if (!v.length) return Number.NaN;
    const s = [...v].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
  };
  const kut = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

  type Kandidat = { dan: string; mjera: number };
  const izbor = (
    vrsta: string,
    naziv: (d: string) => string,
    mjera: (z: { h2s: number[]; ulazi: SatUlaza[] }, d: string) => number,
    koliko: number,
    najveci: boolean,
  ): Epizoda[] => {
    const izlaz: Epizoda[] = [];
    for (const [uloga, r] of Object.entries(RAZDOBLJA) as [Uloga, Razdoblje][]) {
      const kandidati: Kandidat[] = [];
      for (const [d, z] of poDanu) {
        if (d < r.od || d >= r.do) continue;
        // Traži se pun dan: bez toga bi „najniži maksimum” bio dan bez mjerenja.
        if (z.h2s.length < 20 || z.ulazi.filter((u) => u.vjetar).length < 20) continue;
        const m = mjera(z, d);
        if (Number.isFinite(m)) kandidati.push({ dan: d, mjera: m });
      }
      kandidati.sort((a, b) => (najveci ? b.mjera - a.mjera : a.mjera - b.mjera));
      for (const k of kandidati.slice(0, koliko)) {
        izlaz.push({
          id: `${vrsta}-${k.dan}`,
          naziv: naziv(k.dan),
          razdoblje: { od: danPlus(k.dan, -1), do: danPlus(k.dan, 1) },
          uloga,
          vrsta: [vrsta, sezona(k.dan)],
          opis: `${naziv(k.dan)}; mjera ${k.mjera.toFixed(2)}. Odabrano pravilom u epizode.ts, bez pogleda na model.`,
        });
      }
    }
    return izlaz;
  };

  const epizode: Epizoda[] = [
    ...izbor("jak-miris", (d) => `Jak miris na k1, ${d}`, (z) => kvantil(z.h2s, 0.95), 4, true),
    ...izbor("bez-mirisa", (d) => `Bez mirisa na k1, ${d}`, (z) => Math.max(...z.h2s), 2, false),
    ...izbor(
      "promjena-vjetra",
      (d) => `Okreti vjetra, ${d}`,
      (z) => {
        let n = 0;
        for (let i = 1; i < z.ulazi.length; i += 1) {
          const a = z.ulazi[i - 1].vjetar;
          const b = z.ulazi[i].vjetar;
          if (a && b && a.brzina >= 1 && b.brzina >= 1 && kut(a.smjerOd, b.smjerOd) > 90) n += 1;
        }
        return n;
      },
      2,
      true,
    ),
    ...izbor(
      "tisina",
      (d) => `Tišina, ${d}`,
      (z) => z.ulazi.filter((u) => u.vjetar && u.vjetar.brzina < 1).length / z.ulazi.length,
      2,
      true,
    ),
    ...izbor(
      "stalan-vjetar",
      (d) => `Stalan vjetar, ${d}`,
      (z) => {
        const jaki = z.ulazi.filter((u) => u.vjetar && u.vjetar.brzina >= 2);
        if (jaki.length < 18) return Number.NaN;
        const s = jaki.map((u) => u.vjetar!.smjerOd);
        const sred = (Math.atan2(
          s.reduce((a, v) => a + Math.sin((v * Math.PI) / 180), 0),
          s.reduce((a, v) => a + Math.cos((v * Math.PI) / 180), 0),
        ) * 180) / Math.PI;
        return Math.max(...s.map((v) => kut(v, sred)));
      },
      1,
      false,
    ),
    ...izbor(
      "noc-inverzija",
      (d) => `Plitka noć, ${d}`,
      (z) => {
        const noc = z.ulazi.filter((u) => u.dubina && (mjesniSat(u.sat) >= 21 || mjesniSat(u.sat) < 6));
        return noc.length >= 6 ? kvantil(noc.map((u) => u.dubina!.m), 0.5) : Number.NaN;
      },
      2,
      false,
    ),
    ...izbor(
      "dan-mijesanje",
      (d) => `Duboko dnevno miješanje, ${d}`,
      (z) => {
        const dan_ = z.ulazi.filter((u) => u.dubina && mjesniSat(u.sat) >= 12 && mjesniSat(u.sat) < 16);
        return dan_.length >= 3 ? kvantil(dan_.map((u) => u.dubina!.m), 0.5) : Number.NaN;
      },
      1,
      true,
    ),
  ];

  // Isti dan smije biti epizoda samo jednom; vrste se spajaju.
  const poId = new Map<string, Epizoda>();
  for (const e of epizode) {
    const kljuc = e.razdoblje.od;
    const dosad = poId.get(kljuc);
    poId.set(
      kljuc,
      dosad
        ? { ...dosad, vrsta: [...new Set([...dosad.vrsta, ...e.vrsta])], opis: `${dosad.opis} Također: ${e.opis}` }
        : e,
    );
  }
  return [...RUCNE_EPIZODE, ...poId.values()].sort((a, b) => a.razdoblje.od.localeCompare(b.razdoblje.od));
}

function sezona(d: string): string {
  const m = Number(d.slice(5, 7));
  return m === 12 || m <= 2 ? "zima" : m <= 5 ? "proljece" : m <= 8 ? "ljeto" : "jesen";
}

/**
 * Epizode koje vrtnja koristi: iz `docs/hindcast/epizode.json` ako postoji
 * (zapisano jednom, da se knjižnica ne mijenja ispod pokusa), inače ručne.
 */
export const EPIZODE: readonly Epizoda[] = (() => {
  try {
    // Dinamički, da modul radi i bez datoteke (i u provjerama).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const put = `${process.cwd()}/docs/hindcast/epizode.json`;
    if (existsSync(put)) return JSON.parse(readFileSync(put, "utf8")) as Epizoda[];
  } catch {
    // ostaju ručne
  }
  return RUCNE_EPIZODE;
})();

// ---------------------------------------------------------------------------
// Alat: izvodi knjižnicu i piše je u docs/hindcast/epizode.json
//
//   npx tsx scripts/hindcast/epizode.ts --od 2024-09-01 --do 2026-09-03
//
// Datoteka se piše jednom i ne prepisuje bez `--prepisi`: knjižnica se ne
// smije mijenjati ispod pokusa koji su na njoj ocijenjeni.

async function alat(): Promise<void> {
  const { existsSync, writeFileSync } = await import("node:fs");
  const { sloziUlaze, ucitajDubine, ucitajOkolnosti, ucitajOpazanja, ucitajVjetar } = await import("./ulazi");
  const a = process.argv.slice(2);
  const uzmi = (ime: string, zadano: string) => {
    const i = a.indexOf(`--${ime}`);
    return i >= 0 && i + 1 < a.length ? a[i + 1] : zadano;
  };
  const put = `${process.cwd()}/docs/hindcast/epizode.json`;
  if (existsSync(put) && !a.includes("--prepisi")) {
    console.error(`${put} već postoji; dodaj --prepisi ako doista želiš novu knjižnicu`);
    process.exit(1);
  }
  const [vjetar, dubine, okolnosti, opazanja] = await Promise.all([
    ucitajVjetar(),
    ucitajDubine(),
    ucitajOkolnosti(),
    ucitajOpazanja(),
  ]);
  const ulazi = sloziUlaze("proizvodnja", { od: uzmi("od", "2024-09-01"), do: uzmi("do", "2026-09-03") }, {
    vjetar,
    dubine,
    okolnosti,
  });
  const epizode = izvediEpizode(ulazi, opazanja);
  writeFileSync(put, JSON.stringify(epizode, null, 1) + "\n");
  for (const e of epizode) console.error(`${e.uloga.padEnd(9)} ${e.razdoblje.od}…${e.razdoblje.do} ${e.vrsta.join(",")}`);
  console.error(`${epizode.length} epizoda → ${put}`);
}

if (process.argv[1] && /epizode\.ts$/.test(process.argv[1])) {
  void alat().catch((g) => {
    console.error(g);
    process.exit(1);
  });
}
