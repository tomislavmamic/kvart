import type { Metadata } from "next";

import { ThreeDiorama } from "@/components/igra/three-diorama";

export const metadata: Metadata = {
  title: "Kvart u pokretu — 3D maketa",
  description:
    "Reljefna maketa Dračevca i Bilica: LiDAR teren u koraku od 3 metra, s cestama, zgradama i akvaduktom položenima na stvarno tlo.",
};

const DIRECTION_CONTRACT = `<!--
THESIS: Stvarni kvart postaje izrezan blok terena; prepoznatljivost dolazi iz LiDAR reljefa i GIS geometrije, ne iz generičnih igračaka.
OWN-WORLD: Mediteranski niski poligoni na golom vapnencu, maslina i makija po stvarnim zelenim površinama, izohipse urezane u tlo, izravno sunce i ortografska kamera.
STORY: Posjetitelj prvo vidi da kvart stoji na padini, zatim prepoznaje mrežu cesta i akvadukt, pa zaokrene blok da vidi usjeke i terase.
FIRST VIEWPORT: WebGL reljef ispunjava prostor ispod zaglavlja; naslov je gore lijevo, pauza gore desno, izvor uvijek pri dnu.
FORM: Three.js građanska maketa na LiDAR terenu, slobodan zaokret iznad obzora, preuveličanje visina ×1/×2/×3,5, seed kvart-threejs-rct-20260811.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function IgraPage() {
  return (
    <section className="igra-page igra-3d-page relative left-1/2 -my-8 w-screen -translate-x-1/2 overflow-hidden">
      <template
        data-design-contract="kvart-threejs-rct-20260811"
        dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }}
      />

      <div className="igra-intro">
        <h1>Kvart u pokretu</h1>
        <p>
          Reljefna maketa Dračevca i Bilica: teren iz LiDAR snimke u koraku od
          3 metra, sa 105 metara visinske razlike, a na njemu stvarne ceste,
          zgrade i akvadukt.
        </p>
      </div>

      <ThreeDiorama />

      <p className="igra-source">
        Reljef: DGU-ov LiDAR digitalni model reljefa (DMR) · ceste i zelene
        površine: OpenStreetMap · zgrade i Dioklecijanov vodovod: GIS Grada
        Splita · prikaz je pojednostavljena maketa, nije geodetski proizvod.
      </p>
    </section>
  );
}
