"use server";

import { SEKTOR_IMENA, satiDojava, sektor, spojiVjetar, vjetarIzArhive } from "@/lib/dojave";
import type { OdourStrength } from "@/lib/constants";
import { getArchivedWind, getOdourReportsByReporter } from "@/lib/queries";

/**
 * „Vaše dojave” — što je ovaj preglednik poslao i što se s tim dogodilo.
 *
 * Ovo je jedini razlog da se dojavitelj vrati bez računa i bez kontakta:
 * vidi da je dojava ušla, i vidi je li dobila vjetar. Oznaku zna samo
 * preglednik (`dojavitelj.ts`); poslužitelj po njoj samo čita, i vraća
 * samo ono što je taj isti preglednik poslao.
 */

export type MojaDojava = {
  id: number;
  /** Početak, ISO 8601 u UTC-u; preglednik ga ispisuje u svom vremenu. */
  occurredAt: string;
  smelled: boolean;
  strength: OdourStrength | null;
  place: string | null;
  lat: number | null;
  lng: number | null;
  /** Ime sektora iz kojega je tada puhalo, ili `null` dok vjetra nema. */
  vjetarIz: string | null;
  /** Sat je izmjeren i bio je tih: nema smjera, pa ni kraka. */
  tisina: boolean;
  /** Sat dojave još traje; vjetar dobiva kad završi. */
  satTraje: boolean;
};

export type MojeDojaveRezultat =
  | { ok: true; dojave: MojaDojava[] }
  | { ok: false };

/**
 * Zadnjih deset dojava ovog preglednika, sa spojenim vjetrom gdje ga ima.
 *
 * @param oznaka Oznaka preglednika iz `localStorage`.
 * @returns Popis, ili `ok: false` kad baza ne odgovara — popis nije uvjet
 *   da obrazac radi, pa se greška ne baca.
 */
export async function mojeDojave(oznaka: string): Promise<MojeDojaveRezultat> {
  if (!/^[0-9a-f]{32}$/.test(oznaka)) return { ok: true, dojave: [] };
  try {
    const sada = new Date();
    const tekuciSat = Math.floor(sada.getTime() / 3_600_000);
    const redovi = await getOdourReportsByReporter(oznaka);
    const arhiva = await getArchivedWind(satiDojava(redovi));
    const vjetar = spojiVjetar(vjetarIzArhive(arhiva, sada));
    return {
      ok: true,
      dojave: redovi.map((r) => {
        const v = vjetar(r.occurredAt);
        return {
          id: r.id,
          occurredAt: r.occurredAt.toISOString(),
          smelled: r.smelled,
          strength: r.strength,
          place: r.place,
          lat: r.lat,
          lng: r.lng,
          vjetarIz: v && !v.tisina ? SEKTOR_IMENA[sektor(v.smjer)] : null,
          tisina: v?.tisina ?? false,
          satTraje: Math.floor(r.occurredAt.getTime() / 3_600_000) >= tekuciSat,
        };
      }),
    };
  } catch {
    return { ok: false };
  }
}
