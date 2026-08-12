import type { Metadata } from "next";

import { ThreeDiorama } from "@/components/igra/three-diorama";

export const metadata: Metadata = {
  title: "Kvart u pokretu — 3D maketa",
  description:
    "Trodimenzionalna maketa Dračevca i Bilica izrađena prema dostupnim prostornim podacima.",
};

const DIRECTION_CONTRACT = `<!--
THESIS: Stvarni kvart postaje mirna 3D maketa; prepoznatljivost dolazi iz GIS geometrije, ne iz generičnih igračaka.
OWN-WORLD: Mediteranski niski poligoni, vapnenac, maslina, prigušeno more i izravno sunce u fiksnoj ortografskoj kameri.
STORY: Posjetitelj prvo prepoznaje mrežu cesta, zatim velike zgrade i akvadukt, pa ostaje promatrati sitan promet.
FIRST VIEWPORT: WebGL diorama ispunjava prostor ispod zaglavlja; naslov je gore lijevo, pauza gore desno, izvor uvijek pri dnu.
FORM: Three.js građanska maketa fiksnog kuta s ograničenim približavanjem i pomicanjem, seed kvart-threejs-rct-20260811.
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
          3D maketa Dračevca i Bilica prema stvarnoj mreži cesta i dostupnim
          prostornim podacima.
        </p>
      </div>

      <ThreeDiorama />

      <p className="igra-source">
        Ceste: OpenStreetMap · zgrade i Dioklecijanov vodovod: GIS Grada
        Splita · prikaz je pojednostavljena maketa, nije geodetski proizvod.
      </p>
    </section>
  );
}
