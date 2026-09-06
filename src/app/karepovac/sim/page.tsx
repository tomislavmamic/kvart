import { Simulator } from "@/components/karepovac/sim/simulator";
import { dohvatiCrtu } from "@/lib/sim/dohvat";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Simulator mirisa s Karepovca",
  description:
    "Kamo je zrak s Karepovca išao zadnja 24 sata i kamo ide sljedeća tri — na karti, po satu, uz mjerenja s postaja uz plohu.",
});

/**
 * Stranica se slaže pri svakom zahtjevu, a ne pregotovi.
 *
 * Do 4. 9. 2026. stajalo je `revalidate = 300`: stranica je bila ISR s
 * `stale-while-revalidate`, pa je prvi posjetitelj nakon zatišja dobivao
 * **prethodno** složenu stranicu — izmjereno 28 sati staru — s riječju „sada”
 * uz sat koji je odavno prošao. Na stranici s malo prometa to nije rub nego
 * pravilo. Nula ovdje znači: `new Date()` u `dohvatiCrtu` teče za svaki
 * zahtjev, a dohvati prema izvorima (`next: { revalidate: 900 / 1800 }` u
 * `dohvat.ts` i `vjetar-sat.ts`) **ostaju** u zajedničkoj predmemoriji
 * podataka — `revalidate = 0` mijenja samo zadani rok dohvata bez roka, ne
 * one s pozitivnim (vidi `caching-without-cache-components.md`). Tako AZO-ova
 * ograda na brzinu i dalje pada na predmemoriju, ne na posjetitelja.
 * `force-dynamic` bi, naprotiv, sve dohvate pretvorio u `no-store`.
 */
export const revalidate = 0;

export default async function SimulatorPage() {
  const crta = await dohvatiCrtu();
  return (
    <main>
      {/* Naslov živi u zaglavlju nad kartom; ovdje ostaje za čitače zaslona i
          tražilice, da karta dobije cijelu visinu prozora. */}
      <h1 className="sr-only">Simulator mirisa s Karepovca</h1>
      <Simulator pocetna={crta} />
    </main>
  );
}
