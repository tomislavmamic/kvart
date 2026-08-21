/**
 * Izmjereni satni vjetar za simulator, odvojen od prikaza stranice.
 *
 * Postoji zbog jedne osobine izvora: AZO-ov izvoz daje jedan polutant po
 * pozivu i vraća `429` ako drugi poziv stigne prije nekih pet sekundi. Brzina i
 * smjer su dva polutanta, pa izmjereni vjetar traje sekundama — predugo da
 * stoji pred prvim prikazom karte.
 *
 * Zato stranica kreće na modelskom vjetru, koji pokriva svih 28 sati odjednom,
 * a ovo se traži naknadno. Rok predmemorije znači da tih nekoliko sekundi
 * plati jedan poziv u petnaest minuta, a ne svaki posjetitelj.
 *
 * Odgovor je namjerno mršav: samo satovi koje je mjerenje doista pokrilo.
 * Sat kojega ovdje nema ostaje na modelu i tako i piše na karti.
 */

import { azoVjetar } from "@/lib/sim/dohvat";

/** Isti rok kao ostali izvori vjetra, da se dvije karte ne raziđu. */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const izmjereno = await azoVjetar(new Date());
  return Response.json(
    { satovi: [...izmjereno.values()] },
    {
      headers: {
        // Preglednik smije držati kratko; posluživanje ionako ide iz
        // zajedničke predmemorije, pa čest povratak na stranicu ne budi AZO.
        "cache-control": "public, max-age=60, stale-while-revalidate=900",
      },
    },
  );
}
