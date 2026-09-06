import { KarepovacKarte } from "@/components/karepovac/karta-kartice";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Karepovac — što pratimo",
  description:
    "Odlagalište je uz kvart i iznad njega. Jedanaest stvari koje pratimo, svaka na istoj karti i u istom mjerilu.",
});

/**
 * Stranica se slaže pri svakom zahtjevu; dohvati prema izvorima ostaju u
 * predmemoriji podataka (`next: { revalidate }` u `vjetar.ts`), pa
 * posjetitelj ni sada ne budi METAR ni AZO svojim dolaskom. Prije je stajalo
 * `revalidate = 900` — ISR sa `stale-while-revalidate` — pa je „izmjereni u
 * 23:30” na kartici znao biti od jučer (vidi `sim/page.tsx`).
 */
export const revalidate = 0;

/**
 * THESIS: kvart prvo mora vidjeti sve što s plohe silazi na njega, pa tek onda
 *   birati čime će se baviti.
 * OWN-WORLD: jedna karta, jedno mjerilo, jedan sjever — mijenja se samo sloj.
 * STORY: susjed prepozna svoju ulicu, vidi što je iznad nje i odakle koji
 *   podatak dolazi.
 * FIRST VIEWPORT: visinska razlika crno na bijelo, pa odmah kartice.
 * FORM: pregled iz kojeg se ulazi u pojedini projekt, a ne sam projekt.
 */
export default function KarepovacPage() {
  return <KarepovacKarte />;
}
