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

/**
 * Odgovor se slaže pri svakom zahtjevu, kao i stranica simulatora: s
 * `revalidate = 300` bio je ISR sa `stale-while-revalidate`, pa je prvi
 * poziv nakon zatišja donosio jučerašnji „tekući sat”. Dohvati prema
 * izvorima u `vjetar-sat.ts` nose svoj rok i ostaju u predmemoriji podataka.
 */
export const revalidate = 0;

/**
 * Koliko najmanje prolazi između dvaju upisa u arhivu iz ovog procesa.
 *
 * Simulator ovaj odgovor traži svakih pet minuta iz svake otvorene kartice,
 * a odgovor se slaže po zahtjevu — bez ograde bi svaki posjetitelj pisao
 * red u bazu. Pet minuta je rok kojim je arhiva i zamišljena (Neverinove
 * postaje javljaju petominutno); kraće ne bi donijelo novo očitanje, jer
 * ni predmemorija izvora nije kraća.
 */
const RAZMAK_UPISA_MS = 5 * 60_000;

export async function GET(): Promise<Response> {
  const vjetar = await satniVjetar(new Date());
  const { vjetrovi, serije, sada } = vjetar;
  // Ovdje se izmjereni niz čeka do kraja, pa je ovo najbogatiji ulov za
  // arhivu: cijele serije po postaji, ne samo tekuće očitanje.
  await zapisiZrakPoslije(sada, vjetar, { kljuc: "api-vjetar", razmakMs: RAZMAK_UPISA_MS });

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
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
