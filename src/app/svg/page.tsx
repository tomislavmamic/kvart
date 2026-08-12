import type { Metadata } from "next";

import { DioramaController } from "@/components/igra/diorama-controller";
import { KvartDiorama } from "@/components/igra/kvart-diorama";

export const metadata: Metadata = {
  title: "Kvart u pokretu",
  description:
    "Stilizirani izometrijski model Dračevca i Bilica temeljen na dostupnim prostornim podacima.",
};

const DIRECTION_CONTRACT = `<!--
THESIS: Kvart se pamti kao živa maketa stvarnih ulica, ne kao generična karta ni igra upravljanja.
OWN-WORLD: Mediteranski niski poligoni, vapnenac, maslina, prigušeno more i sitan život u jednoj fiksnoj izometriji.
STORY: Posjetitelj odmah prepoznaje Dračevac, Bilice, velike zgrade, kuće i akvadukt te zastaje promatrati kretanje.
FIRST VIEWPORT: Diorama ispunjava sav prostor ispod zaglavlja; naslov je gore lijevo, pauza gore desno, izvor dolje.
FORM: Fiksna izometrijska građanska maketa, odabrana smjernica A, seed kvart-diorama-rct-20260811.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function SvgPage() {
  return (
    <section className="igra-page relative left-1/2 -my-8 w-screen -translate-x-1/2 overflow-hidden">
      <template
        data-design-contract="kvart-diorama-rct-20260811"
        dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }}
      />

      <div className="igra-intro">
        <h1>Kvart u pokretu</h1>
        <p>
          Stilizirani model Dračevca i Bilica prema dostupnim prostornim
          podacima Grada Splita.
        </p>
      </div>

      <DioramaController>
        <KvartDiorama />
      </DioramaController>

      <p className="igra-source">
        Ceste: OpenStreetMap · zgrade i Dioklecijanov vodovod: GIS Grada
        Splita · prikaz je pojednostavljena maketa, nije geodetski proizvod.
      </p>
    </section>
  );
}
