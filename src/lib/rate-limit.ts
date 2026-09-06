/**
 * Ograda na učestalost, u memoriji procesa.
 *
 * Dovoljno za kvartovsku stranicu na Fluid Computeu, gdje se procesi
 * ponovno koriste; u najgorem slučaju (svjež proces) prozor se jednostavno
 * poništi. Ograda je zaštita od skripte, ne od susjeda — zato svaki obrazac
 * ima svoj spremnik (`bucket`) i svoju granicu, a ključ nije nužno IP:
 * susjedi na istom mobilnom operateru često dijele jednu javnu adresu
 * (CGNAT), pa bi šesti susjed u epizodi mirisa dobio poruku koja optužuje
 * nekoga tko nije poslao ništa.
 */

type Zapis = { count: number; windowStart: number };

const hits = new Map<string, Zapis>();

const WINDOW_MS = 60 * 60 * 1000; // 1 sat

/** Zadana granica; prijave problema (`submitProblem`) ostaju na njoj. */
const MAX_PER_WINDOW = 5;

export type Ograda = {
  /** Najviše pogodaka po ključu u satu. */
  readonly max?: number;
  /** Ime spremnika; obrasci s različitim imenima ne dijele brojač. */
  readonly bucket?: string;
  /** Trenutak, za provjere. */
  readonly now?: number;
  /** Gdje se broji; zadano zajedničko za proces. */
  readonly memorija?: Map<string, Zapis>;
};

/**
 * Smije li pozivatelj s ovim ključem još jednom, i ako smije, broji ga.
 *
 * @param key IP ili druga oznaka pozivatelja.
 * @param ograda Granica i spremnik; bez njih 5 na sat u zajedničkom spremniku.
 * @returns Istina dok je pozivatelj ispod granice.
 */
export function checkRateLimit(key: string, ograda: Ograda = {}): boolean {
  const now = ograda.now ?? Date.now();
  const max = ograda.max ?? MAX_PER_WINDOW;
  const memorija = ograda.memorija ?? hits;
  const kljuc = ograda.bucket ? `${ograda.bucket}:${key}` : key;
  const entry = memorija.get(kljuc);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    memorija.set(kljuc, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
