/**
 * Trajni zapis svakog očitanja koje kroz stranicu prođe.
 *
 * Stranica vjetar ionako dohvaća svakih petnaest minuta; ovdje se dohvaćeno i
 * zapiše, pa modeliranje prestane ovisiti o tome čuva li izvor arhivu.
 * Neverinov naslijeđeni API daje samo zadnje očitanje, DHMZ-ov XML samo
 * tekući termin — što se od njih ne zapiše odmah, izgubljeno je zauvijek. A
 * bez arhive se nova postaja ne može ni ocijeniti na plinu
 * (`scripts/provjeri-izvore-vjetra.py` traži stotine zajedničkih sati).
 *
 * Tri pravila:
 *
 * 1. **Arhiva nikad ne ruši prikaz.** Upis se ne čeka u prikazu (`after` iz
 *    Next-a, gdje ga ima), a svaka greška se proguta i zabilježi u dnevnik.
 * 2. **Izmišljeno ne ulazi.** Promjenjiv smjer se sprema kao prazan stupac,
 *    a ne kao pretpostavljeni stupanj kojim prikaz crta os; sat bez oba
 *    podatka ne ulazi uopće. Modelski vjetar (Open-Meteo) se ne sprema —
 *    model nije opažanje, a njegov arhiv postoji i bez nas.
 * 3. **Dvaput dohvaćeno je jednom zapisano.** Postaja i trenutak imaju
 *    jedinstveni ključ; ponovni upis se tiho preskoči. Dubina sloja je
 *    iznimka — modelska je, model je zna naknadno popraviti, pa kasniji
 *    zapis za isti sat prepiše raniji.
 *
 * Baza se uvozi tek pri upisu (dinamički), da modul smiju uvesti i provjere
 * bez `DATABASE_URL` — `src/lib/db` pri uvozu baca kad ga nema.
 */

import type { Mijesanje, Vjetar, ZrakSada } from "@/lib/vjetar";
import type { SatniVjetarISlojevi } from "@/lib/vjetar-sat";

export type RedVjetra = {
  station: string;
  observedAt: Date;
  directionDeg: number | null;
  speedMs: number;
  gustMs: number | null;
};

export type RedSloja = {
  source: string;
  observedAt: Date;
  depthM: number;
};

/** Očitanja koja vode kartu, s promjenjivim smjerom kao prazninom. */
export function redoviIzOcitanja(ocitanja: readonly Vjetar[]): RedVjetra[] {
  return ocitanja.map((o) => ({
    station: o.postaja,
    observedAt: new Date(o.opazeno),
    directionDeg: o.promjenjiv ? null : o.smjerOd,
    speedMs: o.brzina,
    gustMs: o.naleti ?? null,
  }));
}

/**
 * Satni nizovi po postaji (AZO), bez modelskih satova.
 *
 * `procitajAzoNiz` sate bez oba podatka ionako izostavlja, pa svaki red ovdje
 * ima i smjer i brzinu; provjera na `izvor` ostaje za slučaj da se u niz ikad
 * umiješa modelski sat.
 */
export function redoviIzSerija(
  serije: SatniVjetarISlojevi["serije"],
): RedVjetra[] {
  const redovi: RedVjetra[] = [];
  for (const [postaja, niz] of serije) {
    for (const v of niz.values()) {
      if (v.izvor !== postaja) continue;
      redovi.push({
        station: postaja,
        observedAt: new Date(v.sat),
        directionDeg: v.smjerOd,
        speedMs: v.brzina,
        gustMs: null,
      });
    }
  }
  return redovi;
}

/**
 * Dubine sloja po satu, ali samo prošli i tekući sat.
 *
 * Niz nosi i prognozu; prognoza nije podatak o zraku nego o modelu, pa se
 * sprema tek kad sat prođe i vrijednost postane ono što je prikaz koristio.
 */
export function redoviIzDubina(
  dubine: SatniVjetarISlojevi["dubine"],
  sada: Date,
): RedSloja[] {
  const vrh = Math.floor(sada.getTime() / 3_600_000) * 3_600_000;
  const redovi: RedSloja[] = [];
  for (const [sat, dubina] of dubine) {
    const t = Date.parse(sat);
    if (Number.isNaN(t) || t > vrh) continue;
    redovi.push({ source: "openmeteo", observedAt: new Date(t), depthM: dubina });
  }
  return redovi;
}

function redIzMijesanja(mijesanje: Mijesanje | null | undefined): RedSloja[] {
  if (!mijesanje) return [];
  const t = Date.parse(mijesanje.vrijeme);
  if (Number.isNaN(t)) return [];
  return [{ source: "openmeteo", observedAt: new Date(t), depthM: mijesanje.dubina }];
}

/** Isti red dvaput u istom pozivu srušio bi upis prije jedinstvenog ključa. */
function bezDvostrukih<T extends { observedAt: Date }>(
  redovi: T[],
  kljuc: (red: T) => string,
): T[] {
  const videno = new Map<string, T>();
  for (const red of redovi) videno.set(kljuc(red), red);
  return [...videno.values()];
}

/**
 * Zapisuje sve što je dohvat donio; greška ostaje u dnevniku, nikad u prikazu.
 *
 * Args:
 *   zrak: Trenutačna očitanja, ako ih je pozivatelj dohvatio.
 *   vjetar: Satni nizovi i dubine, ako ih je pozivatelj dohvatio.
 */
export async function zapisiZrak(
  zrak: ZrakSada | null,
  vjetar: SatniVjetarISlojevi | null = null,
  sada: Date = new Date(),
): Promise<void> {
  try {
    const redoviVjetra = bezDvostrukih(
      [
        ...redoviIzOcitanja(zrak?.ocitanja ?? []),
        ...redoviIzSerija(vjetar?.serije ?? new Map()),
        ...redoviIzOcitanja(vjetar?.sada?.ocitanja ?? []),
      ],
      (r) => `${r.station}@${r.observedAt.getTime()}`,
    );
    const redoviSloja = bezDvostrukih(
      [
        ...redIzMijesanja(zrak?.mijesanje),
        ...redoviIzDubina(vjetar?.dubine ?? new Map(), sada),
      ],
      (r) => `${r.source}@${r.observedAt.getTime()}`,
    );
    if (redoviVjetra.length === 0 && redoviSloja.length === 0) return;

    const [{ db }, { mixingReadings, windReadings }] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ]);
    const { sql } = await import("drizzle-orm");

    if (redoviVjetra.length > 0) {
      await db.insert(windReadings).values(redoviVjetra).onConflictDoNothing();
    }
    if (redoviSloja.length > 0) {
      await db
        .insert(mixingReadings)
        .values(redoviSloja)
        .onConflictDoUpdate({
          target: [mixingReadings.source, mixingReadings.observedAt],
          set: { depthM: sql`excluded.depth_m` },
        });
    }
  } catch (greska) {
    console.error("arhiva zraka: upis nije prošao", greska);
  }
}

/**
 * Zapisuje u pozadini, iza odgovora, gdje Next to dopušta.
 *
 * `after` postoji samo unutar zahtjeva; izvan njega (provjere, skripte) upis
 * ide odmah i na njega se pričeka. Poziv nikad ne baca.
 */
export async function zapisiZrakPoslije(
  zrak: ZrakSada | null,
  vjetar: SatniVjetarISlojevi | null = null,
): Promise<void> {
  try {
    const { after } = await import("next/server");
    after(() => zapisiZrak(zrak, vjetar));
  } catch {
    await zapisiZrak(zrak, vjetar);
  }
}
