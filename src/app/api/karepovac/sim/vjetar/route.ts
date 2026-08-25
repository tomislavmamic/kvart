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
 *
 * Uz niz ide i `sada` — što svaka postaja javlja u ovom trenutku. To nije isto
 * što i niz: DHMZ i METAR ne objavljuju povijest, nego samo zadnje očitanje.
 * Karta ih zato zabada s vrijednošću samo dok stoji na sadašnjem satu; kad se
 * klizač povuče unatrag, pribadača ostaje, a brojka nestane. Prikazati zadnje
 * očitanje uz sat od jučer značilo bi tvrditi nešto što nitko nije izmjerio.
 */

import { azoSerije, dopuniSadasnjim } from "@/lib/sim/dohvat";
import { vrhSata } from "@/lib/sim/vrijeme-satno";
import { dohvatiZrak } from "@/lib/vjetar";

/** Isti rok kao ostali izvori vjetra, da se dvije karte ne raziđu. */
export const revalidate = 900;

export async function GET(): Promise<Response> {
  const [serije, sada] = await Promise.all([
    azoSerije(new Date()),
    // Ne ruši odgovor ako padne: pribadače su dodatak, niz je ono glavno.
    dohvatiZrak().catch(() => null),
  ]);
  // Niz koji vodi model je prve postaje koja je javila; redoslijed je onaj
  // provjereni iz `vjetar.ts`.
  const vodeci =
    serije.get("split3")?.size ? serije.get("split3")! : serije.get("split2") ?? new Map();
  // Tekući sat: kad ga AZO još nije objavio, vodi isto opažanje koje vodi i
  // kartu na `/karepovac` — da dvije karte istoga kvarta ne nose dva vjetra.
  const dopunjeno = dopuniSadasnjim(vodeci, vrhSata(new Date()), sada?.vjetar ?? null);

  return Response.json(
    {
      satovi: [...dopunjeno.values()],
      // Po postaji, za pribadače: AZO objavljuje satni niz, pa te brojke
      // prate klizač umjesto da stoje samo na sadašnjem satu.
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
