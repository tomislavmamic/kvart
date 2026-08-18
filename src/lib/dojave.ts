import { VJETAR } from "@/generated/karepovac-vjetar";
import type { OdourStrength } from "@/lib/constants";

/** Koliko sektora ima ruža; 16 je isto što nose i ruže mjerenja. */
export const SEKTORA = 16;

export const SEKTOR_IMENA = [
  "S", "SSI", "SI", "ISI", "I", "IJI", "JI", "JJI",
  "J", "JJZ", "JZ", "ZJZ", "Z", "ZSZ", "SZ", "SSZ",
] as const;

/**
 * Težina po jačini. Dojava „nepodnošljivo” nosi više od dojave „slabo”, jer
 * ruža treba pokazati gdje je bilo najgore, a ne samo tko je stigao javiti.
 * Raspon je namjerno uzak: tri puta, ne deset, da jedna dojava ne pregazi
 * dvadeset drugih.
 */
export const TEZINA: Record<OdourStrength, number> = {
  slabo: 1,
  osjetno: 1.7,
  jako: 2.4,
  nepodnosivo: 3,
};

const SMJEROVI = dekodiraj(VJETAR.smjer);
const BRZINE = dekodiraj(VJETAR.brzina);
const PRVI_SAT = Date.parse(VJETAR.prviSat);

function dekodiraj(base64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

export type Vjetar = { smjer: number; brzina: number };

/**
 * Vraća izmjereni vjetar u satu u kojem se miris osjetio.
 *
 * @param kada Vrijeme dojave.
 * @returns Smjer iz kojega je puhalo u stupnjevima i brzinu u m/s, ili `null`
 *   ako za taj sat nema mjerenja — bilo zato što je izvan niza, bilo zato što
 *   zračna luka toga sata nije javila.
 */
export function vjetarUSatu(kada: Date): Vjetar | null {
  const index = Math.floor((kada.getTime() - PRVI_SAT) / 3_600_000);
  if (index < 0 || index >= VJETAR.sati) return null;
  const smjer = SMJEROVI[index];
  const brzina = BRZINE[index];
  if (smjer === VJETAR.nema || brzina === VJETAR.nema) return null;
  return {
    smjer: smjer * VJETAR.korakSmjera,
    brzina: brzina * VJETAR.korakBrzine,
  };
}

/** Vraća sektor ruže za smjer iz kojega puše. */
export function sektor(smjer: number): number {
  const korak = 360 / SEKTORA;
  return Math.floor((((smjer + korak / 2) % 360) + 360) % 360 / korak);
}

export type Dojava = { occurredAt: Date; strength: OdourStrength };

export type RuzaDojava = {
  /** Zbroj težina po sektoru, od sjevera nadesno. */
  tezine: number[];
  /** Broj dojava po sektoru. */
  broj: number[];
  /** Koliko je dojava ušlo u ružu i koliko ih čeka podatak o vjetru. */
  uporabljeno: number;
  bezVjetra: number;
};

/**
 * Slaže ružu dojava: svaka dojava dobiva sat, svaki sat svoj izmjereni vjetar.
 *
 * Ovo ne treba nikakav model raspršenja i vrijedi samo za sebe. Ako se vrh
 * ruže poklopi sa smjerom u kojem leži Karepovac, to je nalaz i bez ijedne
 * jednadžbe; ako se ne poklopi, to je jednako tako nalaz.
 *
 * @param dojave Dojave koje ulaze u zbroj.
 * @returns Ružu po sektorima i koliko je dojava ostalo bez vjetra.
 */
export function ruzaDojava(dojave: readonly Dojava[]): RuzaDojava {
  const tezine = new Array<number>(SEKTORA).fill(0);
  const broj = new Array<number>(SEKTORA).fill(0);
  let uporabljeno = 0;
  let bezVjetra = 0;

  for (const dojava of dojave) {
    const vjetar = vjetarUSatu(dojava.occurredAt);
    if (!vjetar) {
      bezVjetra += 1;
      continue;
    }
    const s = sektor(vjetar.smjer);
    tezine[s] += TEZINA[dojava.strength];
    broj[s] += 1;
    uporabljeno += 1;
  }
  return { tezine, broj, uporabljeno, bezVjetra };
}
