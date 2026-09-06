/**
 * Vremenska crta simulatora kao JSON, za osvježavanje otvorene kartice.
 *
 * Stranica `/karepovac/sim` crtu dobije pri otvaranju; ovaj odgovor je ista
 * crta za kasnije — kad sat prijeđe na sljedeći, kad se kartica vrati u
 * prvi plan i svakih pet minuta dok je vidljiva. Bez toga bi kartica
 * ostavljena otvorenom preko noći ujutro još pisala „sada” uz sinoćnji sat.
 *
 * Slaže se po zahtjevu (`new Date()` mora teći za svaki), ali dohvati prema
 * izvorima u `dohvat.ts` nose svoj rok i ostaju u predmemoriji podataka, pa
 * je odgovor jeftin i ne budi AZO. Izmjereni AZO niz se ovdje ne čeka (kao
 * ni pri prikazu stranice); njega preglednik i dalje uzima s
 * `/api/karepovac/vjetar` i sam ugrađuje.
 */

import { dohvatiCrtu } from "@/lib/sim/dohvat";

export const revalidate = 0;

export async function GET(): Promise<Response> {
  const crta = await dohvatiCrtu();
  return Response.json(crta, {
    headers: {
      // Ništa se ne drži u pregledniku: poziv koji stigne na prijelazu sata
      // mora donijeti novi sat, ne onaj od prije minutu.
      "cache-control": "no-store",
    },
  });
}
