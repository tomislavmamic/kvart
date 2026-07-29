/**
 * Sažetak promjena namjene iz nacrta izmjena GUP-a 2024.
 *
 * Brojke dolaze iz public/geo/planovi/_namjena.json, koji piše
 * scripts/trace-plans.py. Čita se s diska na poslužitelju da stranica ne
 * mora vući cijele slojeve, a da brojka i karta uvijek govore isto.
 */
import { readFile } from "fs/promises";
import path from "path";

export interface Promjena {
  iz_kod: string;
  u_kod: string;
  /** Čitljivo ime namjene — "Z5 → M1" stanaru ne znači ništa. */
  iz: string;
  u: string;
  ha: number;
}

/**
 * Stavka popisa izmjena koju nacrt sam otiskuje uz izmijenjene plohe.
 *
 * Ovo je jedini dio prikaza koji ne izvodimo mi: broj i tekst dolaze iz
 * tumača znakova nacrta, a hektari su naši, iz ploha kojima je taj broj
 * pripisan. Zato na stranici stoje odvojeno od naših skupina.
 */
export interface Stavka {
  broj: string;
  tekst: string;
  ha: number;
  ploha: number;
  promjene: Record<string, number>;
}

export interface Razlika {
  od_godine: number;
  do_godine: number;
  ploha: number;
  promjene: Promjena[];
  /** Prazno za razlike između listova koji popis izmjena nemaju. */
  stavke?: Stavka[];
  ha_po_promjeni: Record<string, number>;
}

export interface Godina {
  godina: number;
  naziv: string;
  ploha: number;
  po_klasi: Record<string, number>;
}

/** Skupine kojima se promjena tumači stanaru, ne planeru. */
export interface Skupina {
  id: string;
  naslov: string;
  objasnjenje: string;
  ha: number;
  stavke: Promjena[];
}

const GRADNJA = /^(S|M|K|I|D|T|N|L)/;
const ZELENO = /^(Z|R)/;

/**
 * Nerazvrstane plohe (kod još sadrži "/") ostaju izvan skupina — čitanje
 * oznaka nije uspjelo pa se ne zna je li riječ o I ili K, i radije se ne
 * broji nego da uđe u krivu skupinu.
 */
function nerazvrstano(p: Promjena): boolean {
  return p.iz_kod.includes("/") || p.u_kod.includes("/");
}

export function skupine(r: Razlika): Skupina[] {
  const def: Omit<Skupina, "ha" | "stavke">[] = [
    {
      id: "zelenilo-u-gradnju",
      naslov: "Zelenilo prelazi u gradnju",
      objasnjenje:
        "Površine koje su danas zaštitno zelenilo ili rekreacija postaju " +
        "građevinske. Ovo je promjena koja se najviše osjeti u susjedstvu.",
    },
    {
      id: "u-javno",
      naslov: "Stanovanje prelazi u javnu i društvenu namjenu",
      objasnjenje:
        "Površine na kojima se danas pretežno stanuje nacrtom su predviđene " +
        "za vrtić, školu ili drugu javnu ustanovu.",
    },
    {
      id: "u-zelenilo",
      naslov: "Novo i uređenije zelenilo",
      objasnjenje:
        "Površine koje nacrtom postaju zelenilo, park ili športsko-" +
        "rekreacijska zona — bilo iz gradnje, bilo uređenjem zelenila koje " +
        "je dosad bilo samo zaštitno.",
    },
    {
      id: "industrija-u-mjesovito",
      naslov: "Gospodarska zona prelazi u mješovitu",
      objasnjenje:
        "Gospodarska (I) i poslovna (K) namjena prelazi u mješovitu, koja " +
        "dopušta i stanovanje. Manje pogona, više stanova.",
    },
    {
      id: "u-gospodarsku",
      naslov: "Stanovanje prelazi u gospodarsku zonu",
      objasnjenje:
        "Površine na kojima se danas pretežno stanuje nacrtom postaju " +
        "gospodarske ili poslovne.",
    },
    {
      id: "ostalo",
      naslov: "Ostale promjene",
      objasnjenje: "Promjene između ostalih namjena.",
    },
  ];
  const kosare: Record<string, Promjena[]> = {};
  for (const d of def) kosare[d.id] = [];

  for (const p of r.promjene ?? []) {
    if (nerazvrstano(p)) continue;
    const iz = p.iz_kod;
    const u = p.u_kod;
    // Redoslijed je dio pravila: zelenilo koje prelazi u gradnju mora se
    // uhvatiti prije nego što ga pravila o odredišnoj namjeni raspodijele.
    let id = "ostalo";
    if (ZELENO.test(iz) && GRADNJA.test(u)) id = "zelenilo-u-gradnju";
    else if (/^(M|S)/.test(iz) && /^D/.test(u)) id = "u-javno";
    else if (ZELENO.test(u)) id = "u-zelenilo";
    else if (/^(I|K)/.test(iz) && /^M/.test(u)) id = "industrija-u-mjesovito";
    else if (/^M/.test(iz) && /^(I|K)/.test(u)) id = "u-gospodarsku";
    kosare[id].push(p);
  }

  return def
    .map((d) => ({
      ...d,
      stavke: kosare[d.id].sort((a, b) => b.ha - a.ha),
      ha: Math.round(kosare[d.id].reduce((s, x) => s + x.ha, 0) * 10) / 10,
    }))
    .filter((s) => s.stavke.length > 0);
}

export async function ucitajPromjene(): Promise<{
  godine: Godina[];
  razlike: Razlika[];
} | null> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), "public", "geo", "planovi", "_namjena.json"),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
