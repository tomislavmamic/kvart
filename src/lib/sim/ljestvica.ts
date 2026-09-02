/**
 * Boje i jačina izvora za simulator.
 *
 * Dvije stvari koje prikaz mora razlikovati, a lako ih je pobrkati:
 *
 * - **Jačina izvora** je ulaz u model. Kad je gledatelj promijeni, pita
 *   „što bi bilo da ploha ispušta dvostruko”. Prijenos zraka je linearan po
 *   jačini izvora — nema kemije koja bi to iskrivila — pa je udvostručena
 *   emisija doslovno udvostručena gustoća, i to se smije izračunati množenjem
 *   umjesto ponovnim vrtnjom čestica.
 * - **Boja** je samo prikaz. Mijenja se slobodno i ništa ne znači za model.
 *
 * Zato jačina stoji uz tvar kao mnoŽitelj gustoće, a boja uz nju kao ljestvica.
 *
 * ## Zašto ponuđene boje, a ne birač nijanse
 *
 * Perjanica nije puna ploha nego prozirna naslaga: ljestvica mora rasti i po
 * neprozirnosti i po tami, inače se rub izgubi ili jezgra zasiti. Nijansa
 * uzeta iz birača to ne nosi sa sobom. Ponuđene ljestvice su građene tako da
 * svaka radi i sama i uz drugu, i da se dvije tvari razlikuju i pri
 * najčešćem obliku slabijeg razlikovanja boja (deuteranopija) — jedna topla,
 * druge hladne, i sve s različitim tijekom svjetline.
 */

import { LJESTVICA, LJESTVICA_MERKAPTANA, type Ljestvica, type Tvar } from "@/lib/dim";

/**
 * Gustoća koja na okviru simulatora odgovara medijanu izmjerenom na postaji.
 *
 * Sidro više nije pretpostavka nego regresija: dvije godine satne gustoće na
 * mjestu postaje Karepovac 1 (`scripts/ocijeni-sim.ts`, lanac stvarnih sati,
 * 12 872 zajednička sata) prema izmjerenom H₂S-u daju nagib
 * 0,0149 µg/m³ po jedinici gustoće i pozadinu 1,27 µg/m³ — istu pozadinu
 * koju neovisno nalazi i bazdareni model oblačića (1,26). Sidro je medijan
 * mjerenja (1,132 µg/m³) podijeljen nagibom.
 *
 * Staro sidro (19,33) izjednačavalo je gustoću **nad samom plohom** s
 * medijanom postaje — kao da postaja stoji na odlagalištu, a stoji 676 m
 * jugoistočno, u udolini. Zato je ljestvica svaku ćeliju bojila oko četiri
 * puta prejako; usporedba s bazdarenim modelom pokazivala je 55 ha „iznad
 * praga” ondje gdje bazdareni model daje 1,2 ha.
 *
 * Nagib nosi širok raspon (95 %: 0,005–0,027, dakle sidro 41–225): prijemnik
 * je jedan i na krivoj strani plohe. Zato je sidro red veličine, ne mjera —
 * ali red veličine izveden iz mjerenja, a ne iz pretpostavke o mjestu
 * postaje. Oblik perjanice, o kojem izvod ovisi, čuvaju kanarinci u
 * `dim.test.ts` i `simulacija.test.ts`; kad padnu, regresiju treba ponoviti.
 */
export const SIDRO_SIMULATORA = 47.2;

/*
 * 2. 9. 2026.: sidro izvedeno iznova nakon pokusa E3 + E5 (spremnik za vijek,
 * satni prosjek, difuzija po razredu), koji su ušli u `POSTAVKE_SIMULATORA`.
 * Regresija na 11 974 sata (`docs/hindcast/e5-difuzija.json`): nagib
 * 0,024 µg/m³ po jedinici gustoće (95 %: 0,012–0,037), pozadina 1,48;
 * sidro = 1,132 / 0,024 = 47,2 (raspon 31–94). Staro sidro 76,2 vrijedilo je
 * za trenutak na kraju sata bez difuzije. Kanarinac oblika u
 * `simulacija.test.ts` nosi novu referencu 30,0.
 */

/** Jačina izvora koju gledatelj bira, u odnosu na bazdarenu. */
export const JACINA = { najmanja: 0, najveca: 5, zadana: 1, korak: 0.1 } as const;

export type Boja = {
  readonly kljuc: string;
  readonly naziv: string;
  readonly ljestvica: Ljestvica;
};

/**
 * Ljestvice koje gledatelj može dodijeliti tvari.
 *
 * Prve dvije su one kojima `/karepovac/zrak` već crta H₂S i merkaptane; ostale
 * su građene po istom pravilu — dno prozirno, prijelaz gladak, vrh gotovo
 * neproziran — da se dvije tvari daju gledati istodobno.
 */
export const BOJE: readonly Boja[] = [
  { kljuc: "jantar", naziv: "Jantar", ljestvica: LJESTVICA },
  { kljuc: "modra", naziv: "Modra", ljestvica: LJESTVICA_MERKAPTANA },
  {
    kljuc: "zelena",
    naziv: "Zelena",
    ljestvica: [
      [0, [240, 253, 244, 0]],
      [0.26, [236, 252, 240, 0]],
      [0.42, [167, 232, 190, 84]],
      [0.58, [96, 197, 141, 148]],
      [0.74, [42, 157, 108, 196]],
      [0.88, [21, 113, 84, 226]],
      [1, [8, 61, 48, 248]],
    ],
  },
  {
    kljuc: "grimiz",
    naziv: "Grimiz",
    ljestvica: [
      [0, [255, 241, 245, 0]],
      [0.26, [255, 236, 242, 0]],
      [0.42, [248, 186, 208, 84]],
      [0.58, [235, 126, 162, 148]],
      [0.74, [211, 62, 110, 196]],
      [0.88, [163, 28, 76, 226]],
      [1, [92, 10, 42, 248]],
    ],
  },
  {
    kljuc: "tirkiz",
    naziv: "Tirkiz",
    ljestvica: [
      [0, [236, 254, 255, 0]],
      [0.26, [231, 253, 255, 0]],
      [0.42, [153, 233, 242, 84]],
      [0.58, [76, 196, 214, 148]],
      [0.74, [26, 146, 172, 196]],
      [0.88, [16, 100, 128, 226]],
      [1, [8, 51, 68, 248]],
    ],
  },
  {
    kljuc: "ugljen",
    naziv: "Ugljen",
    ljestvica: [
      [0, [250, 250, 250, 0]],
      [0.26, [245, 245, 245, 0]],
      [0.42, [200, 200, 204, 84]],
      [0.58, [148, 148, 156, 148]],
      [0.74, [96, 96, 106, 196]],
      [0.88, [56, 56, 66, 226]],
      [1, [18, 18, 24, 248]],
    ],
  },
];

/** Boja koju tvar nosi dok je gledatelj ne promijeni. */
export const ZADANA_BOJA: Record<Tvar, string> = {
  sumporovodik: "jantar",
  merkaptani: "modra",
};

/**
 * Nalazi ljestvicu po ključu.
 *
 * Args:
 *   kljuc: Ključ boje; nepoznat pada na zadanu za tu tvar.
 *   tvar: Tvar za koju se traži.
 *
 * Returns:
 *   Ljestvica boja.
 */
export function bojaZa(kljuc: string, tvar: Tvar): Boja {
  return (
    BOJE.find((b) => b.kljuc === kljuc) ??
    BOJE.find((b) => b.kljuc === ZADANA_BOJA[tvar]) ??
    BOJE[0]
  );
}

/**
 * Svodi jačinu izvora na dopušteni raspon.
 *
 * Args:
 *   v: Tražena jačina.
 *
 * Returns:
 *   Jačina unutar raspona; nevaljan unos pada na zadanu.
 */
export function jacinaURasponu(v: number): number {
  if (!Number.isFinite(v)) return JACINA.zadana;
  return Math.min(JACINA.najveca, Math.max(JACINA.najmanja, v));
}

/** Pretvara ljestvicu u CSS prijelaz, da traka i karta ne odu svaka svojim. */
export function uGradijent(ljestvica: Ljestvica): string {
  const postaje = ljestvica
    .map(
      ([mjesto, [r, g, b, a]]) =>
        `rgb(${r} ${g} ${b} / ${(a / 255).toFixed(2)}) ${(mjesto * 100).toFixed(1)}%`,
    )
    .join(", ");
  return `linear-gradient(90deg, ${postaje})`;
}
