import { KarepovacKarte } from "@/components/karepovac/karta-kartice";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Karepovac — što pratimo",
  description:
    "Odlagalište je uz kvart i iznad njega. Jedanaest stvari koje pratimo, svaka na istoj karti i u istom mjerilu.",
});

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
