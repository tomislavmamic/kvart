/**
 * Strujnice kroz polje vjetra, računate za trenutačni vjetar.
 *
 * Kartica „Kuda vjetar nosi zrak s plohe” prije je crtala četrdeset unaprijed
 * izvučenih putanja za jedan zapečeni slučaj. Otkad polje dolazi iz sadašnjeg
 * vremena, putanje moraju s njim: inače bi karta pri maestralu i dalje crtala
 * jugoistočnjak i time tvrdila upravo ono što joj se ne vjeruje.
 *
 * Račun je isti kao u `scripts/izvedi-karepovac-karticu.py`, samo na polju koje
 * je već složeno: sjeme se posije na crtu okomitu na struju, uzvodno od okvira,
 * pa se prati sredinom koraka (RK2). Postotak skretanja mjeri se prema vjetru
 * na otvorenom, jer je to jedina brojka koju kartica tvrdi.
 */

import { OKVIR } from "@/generated/karepovac-karta";
import type { SlozenoPolje } from "@/lib/polje-dima";

export type Strujnice = {
  /** SVG putanje u koordinatama okvira. */
  readonly putanje: readonly string[];
  /** Skretanje polja od vjetra na otvorenom, u stupnjevima. */
  readonly skretanje: { readonly medijan: number; readonly najvece: number };
};

const KOLIKO = 40;
const KORAK = 6;
const NAJVISE_KORAKA = 320;
const RUB = 24;
/** Odstupanje ispod kojega se točka ne zapisuje; putanja je ionako glatka. */
const PRAG = 0.4;

function raspakiraj(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

/** Bilinearno očitanje polja u koordinatama okvira. */
function uzorak(
  A: Uint8Array,
  polje: SlozenoPolje,
  x: number,
  y: number,
): number {
  const fx = Math.min(1, Math.max(0, x / OKVIR.sirina)) * (polje.gw - 1);
  const fy = Math.min(1, Math.max(0, y / OKVIR.visina)) * (polje.gh - 1);
  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(polje.gw - 1, i0 + 1);
  const j1 = Math.min(polje.gh - 1, j0 + 1);
  const tx = fx - i0;
  const ty = fy - j0;
  const a = A[j0 * polje.gw + i0];
  const b = A[j0 * polje.gw + i1];
  const c = A[j1 * polje.gw + i0];
  const d = A[j1 * polje.gw + i1];
  const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  return (v / 255) * 2 * polje.skala - polje.skala;
}

/** Zapisuje putanju, preskačući točke koje leže na već povučenom potezu. */
function putanja(tocke: readonly [number, number][]): string {
  const zapis: string[] = [];
  let zadnja = tocke[0];
  for (let i = 0; i < tocke.length; i += 1) {
    const t = tocke[i];
    const sljedeca = tocke[i + 1];
    if (i > 0 && sljedeca) {
      const dx = sljedeca[0] - zadnja[0];
      const dy = sljedeca[1] - zadnja[1];
      const duljina = Math.hypot(dx, dy);
      const odmak =
        duljina > 0
          ? Math.abs((t[0] - zadnja[0]) * dy - (t[1] - zadnja[1]) * dx) / duljina
          : 0;
      if (odmak < PRAG) continue;
    }
    zapis.push(`${zapis.length === 0 ? "M" : "L"}${t[0].toFixed(1)} ${t[1].toFixed(1)}`);
    zadnja = t;
  }
  return zapis.join("");
}

/**
 * Izvodi strujnice i skretanje za već složeno polje.
 *
 * Args:
 *   polje: Polje iz `sastaviPolje`.
 *   smjerOd: Meteorološki smjer vjetra na otvorenom, u stupnjevima.
 *
 * Returns:
 *   Putanje za crtanje i mjera skretanja polja od tog vjetra.
 */
export function izvediStrujnice(polje: SlozenoPolje, smjerOd: number): Strujnice {
  const VX = raspakiraj(polje.vx);
  const VY = raspakiraj(polje.vy);

  // Smjer nošenja na otvorenom: kompas u koordinate okvira, gdje y raste prema
  // jugu.
  const kut = ((smjerOd + 180) * Math.PI) / 180;
  const ux = Math.sin(kut);
  const uy = -Math.cos(kut);

  const smjerPolja = (x: number, y: number): [number, number] => {
    const vx = uzorak(VX, polje, x, y);
    const vy = uzorak(VY, polje, x, y);
    const duljina = Math.hypot(vx, vy);
    // Pri tišini polje nema smjer; tada vrijedi smjer vjetra na otvorenom, a
    // kartica uz to piše da smjera zapravo nema.
    return duljina < 1e-6 ? [ux, uy] : [vx / duljina, vy / duljina];
  };

  const putanje: string[] = [];
  const cx = OKVIR.sirina / 2;
  const cy = OKVIR.visina / 2;
  for (let k = 0; k < KOLIKO; k += 1) {
    const poprijeko = ((k + 0.5) / KOLIKO - 0.5) * 2.6 * OKVIR.visina;
    let x = cx - uy * poprijeko - ux * 0.85 * OKVIR.sirina;
    let y = cy + ux * poprijeko - uy * 0.85 * OKVIR.sirina;

    const tocke: [number, number][] = [];
    for (let korak = 0; korak < NAJVISE_KORAKA; korak += 1) {
      const [dx1, dy1] = smjerPolja(x, y);
      const [dx2, dy2] = smjerPolja(x + dx1 * KORAK * 0.5, y + dy1 * KORAK * 0.5);
      x += dx2 * KORAK;
      y += dy2 * KORAK;
      if (
        x < -RUB * 40 ||
        x > OKVIR.sirina + RUB * 40 ||
        y < -RUB * 40 ||
        y > OKVIR.visina + RUB * 40
      ) {
        break;
      }
      if (x >= -RUB && x <= OKVIR.sirina + RUB && y >= -RUB && y <= OKVIR.visina + RUB) {
        tocke.push([x, y]);
      } else if (tocke.length > 0) {
        break;
      }
    }
    if (tocke.length >= 8) putanje.push(putanja(tocke));
  }

  const odstupanja: number[] = [];
  for (let j = 2; j < polje.gh - 2; j += 3) {
    for (let i = 2; i < polje.gw - 2; i += 3) {
      const x = ((i + 0.5) / polje.gw) * OKVIR.sirina;
      const y = ((j + 0.5) / polje.gh) * OKVIR.visina;
      const [dx, dy] = smjerPolja(x, y);
      const kosinus = Math.min(1, Math.max(-1, dx * ux + dy * uy));
      odstupanja.push((Math.acos(kosinus) * 180) / Math.PI);
    }
  }
  odstupanja.sort((a, b) => a - b);

  return {
    putanje,
    skretanje: {
      medijan: Math.round(odstupanja[Math.floor(odstupanja.length / 2)] ?? 0),
      najvece: Math.round(odstupanja[odstupanja.length - 1] ?? 0),
    },
  };
}
