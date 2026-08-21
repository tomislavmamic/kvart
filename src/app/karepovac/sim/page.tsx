import { Simulator } from "@/components/karepovac/sim/simulator";
import { dohvatiCrtu } from "@/lib/sim/dohvat";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Simulator mirisa s Karepovca",
  description:
    "Kamo je zrak s Karepovca išao zadnja 24 sata i kamo ide sljedeća tri — na karti, po satu, uz mjerenja s postaja uz plohu.",
});

/** Isti rok kao ostali prikazi zraka, da dvije karte ne pokazuju dva vjetra. */
export const revalidate = 900;

export default async function SimulatorPage() {
  const crta = await dohvatiCrtu();
  return (
    <div>
      {/* Naslov živi u zaglavlju nad kartom; ovdje ostaje za čitače zaslona i
          tražilice, da karta dobije cijelu visinu prozora. */}
      <h1 className="sr-only">Simulator mirisa s Karepovca</h1>
      <Simulator pocetna={crta} />
    </div>
  );
}
