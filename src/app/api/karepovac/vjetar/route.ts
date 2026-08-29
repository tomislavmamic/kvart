/**
 * Satni vjetar za sve modele na stranici, iz jednog pravila.
 *
 * Odgovor slaže `satniVjetar` (`src/lib/vjetar-sat.ts`) — izmjereni AZO niz
 * gdje ga ima, opažanje koje vodi kartu za tekući sat, model za ostalo.
 * Ovdje se, za razliku od prikaza stranice, izmjereni niz čeka do kraja:
 * AZO-ovu ogradu na brzinu plaća predmemorija jednom u petnaest minuta, a
 * ne posjetitelj.
 *
 * `satovi` nose samo ono što nije model: sat kojega ondje nema ostaje na
 * modelu i na karti uz njega to i piše. `serije` su po postaji, za
 * pribadače; `sada` su trenutačna očitanja svih postaja.
 */

import { zapisiZrakPoslije } from "@/lib/arhiva-zraka";
import { satniVjetar } from "@/lib/vjetar-sat";

/** Isti rok kao ostali izvori vjetra, da se dvije karte ne raziđu. */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const vjetar = await satniVjetar(new Date());
  const { vjetrovi, serije, sada } = vjetar;
  // Ovdje se izmjereni niz čeka do kraja, pa je ovo najbogatiji ulov za
  // arhivu: cijele serije po postaji, ne samo tekuće očitanje.
  await zapisiZrakPoslije(sada, vjetar);

  return Response.json(
    {
      satovi: [...vjetrovi.values()].filter((v) => v.izvor !== "model"),
      serije: Object.fromEntries(
        [...serije].map(([postaja, niz]) => [postaja, [...niz.values()]]),
      ),
      sada: sada?.ocitanja ?? [],
    },
    {
      headers: {
        // Preglednik smije držati kratko; posluživanje ionako ide iz
        // zajedničke predmemorije, pa čest povratak na stranicu ne budi AZO.
        "cache-control": "public, max-age=60, stale-while-revalidate=900",
      },
    },
  );
}
