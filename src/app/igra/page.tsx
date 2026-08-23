import type { Metadata } from "next";

import { ThreeDiorama } from "@/components/igra/three-diorama";

export const metadata: Metadata = {
  title: "Kvart u pokretu — 3D maketa",
  description:
    "Reljefna maketa Dračevca i Bilica: LiDAR teren u koraku od 3 metra, s cestama, zgradama i akvaduktom položenima na stvarno tlo.",
};

const DIRECTION_CONTRACT = `<!--
THESIS: Stvarni kvart postaje izrezan blok terena; prepoznatljivost dolazi iz LiDAR reljefa i GIS geometrije, ne iz generičnih igračaka.
OWN-WORLD: Mediteranski niski poligoni, kupa kanalica na kosim krovovima, pokrov tla iz stvarnih poligona, izohipse urezane u tlo, izravno sunce i ortografska kamera.
STORY: Posjetitelj prvo vidi da kvart stoji na padini, zatim prepoznaje mrežu cesta i akvadukt, pa zaokrene blok da vidi usjeke i terase.
FIRST VIEWPORT: WebGL reljef uzima cijeli prozor bez ijedne trake; izlaz je križić u kutu, sve upravljanje je jedan stupac desno, a naslov, upute i izvori stoje iza gumba s upitnikom.
FORM: Three.js građanska maketa na LiDAR terenu, slobodan zaokret iznad obzora, preuveličanje visina ×1/×2/×3,5, seed kvart-threejs-rct-20260811.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function IgraPage() {
  return (
    <section className="igra-page igra-3d-page">
      <template
        data-design-contract="kvart-threejs-rct-20260811"
        dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }}
      />

      <ThreeDiorama />

    </section>
  );
}
