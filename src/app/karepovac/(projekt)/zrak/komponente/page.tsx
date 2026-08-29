import { DimPerjanica } from "@/components/karepovac/dim-perjanica";
import {
  NatpisiKarte,
  PodlogaDefinicija,
  PodlogaGranicaBilice,
  PodlogaGranicaDracevac,
  PodlogaIzohipseGlavne,
  PodlogaIzohipseSporedne,
  PodlogaKarte,
  PodlogaPozadina,
  PodlogaReljef,
  PodlogaUlice,
  PodlogaZgrade,
} from "@/components/karepovac/karta-kartice";
import { OKVIR } from "@/generated/karepovac-karta";
import { pripremiZrak, type ZrakZaKartu } from "@/lib/zrak";

export const revalidate = 900;

function Sloj({ naziv, children }: { naziv: string; children: React.ReactNode }) {
  const id = `sloj-${naziv.toLowerCase()}`;

  return (
    <section
      id={naziv.toLowerCase()}
      data-component={naziv}
      aria-labelledby={id}
      className="min-w-0"
    >
      <h2 id={id} className="mb-2 font-mono text-sm font-bold text-kamen-tinta">
        {naziv}
      </h2>
      {children}
    </section>
  );
}

const omjer = { aspectRatio: `${OKVIR.sirina} / ${OKVIR.visina}` };

function SlojPodloge({
  naziv,
  id,
  komponenta,
  children,
}: {
  naziv: string;
  id: string;
  komponenta: string;
  children: React.ReactNode;
}) {
  const naslov = `sloj-podloge-${id}`;

  return (
    <div
      id={`podloga-${id}`}
      data-component={`Podloga.${komponenta}`}
      data-part="podloga-sloj"
      aria-labelledby={naslov}
      className="min-w-0"
    >
      <h3 id={naslov} className="mb-2 text-sm font-bold text-kamen-tinta">
        {naziv}
      </h3>
      <svg
        viewBox={OKVIR.viewBox}
        role="img"
        aria-label={naziv}
        className="block h-auto w-full overflow-hidden rounded-xl bg-white"
      >
        {children}
      </svg>
    </div>
  );
}

export function PrikazKomponenti({ prikaz }: { prikaz: ZrakZaKartu }) {
  return (
    <>
      <h1 className="sr-only">Vizualni slojevi karte</h1>
      <PodlogaDefinicija />

      <div data-component="SlojeviKarte" className="grid gap-5 min-[560px]:grid-cols-3">
        <Sloj naziv="Podloga">
          <div
            data-part="viewport"
            className="overflow-hidden rounded-xl bg-white"
            style={omjer}
          >
            <PodlogaKarte />
          </div>
        </Sloj>

        <Sloj naziv="Perjanica">
          <div
            data-part="viewport"
            className="relative overflow-hidden rounded-xl"
            style={{
              ...omjer,
              backgroundColor: "#f4f4f5",
              backgroundImage:
                "linear-gradient(45deg, #d4d4d8 25%, transparent 25%), linear-gradient(-45deg, #d4d4d8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d4d4d8 75%), linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              backgroundSize: "16px 16px",
            }}
          >
            <DimPerjanica
              polje={prikaz.polje}
              zalet={prikaz.zalet}
              tvar="merkaptani"
            />
          </div>
        </Sloj>

        <Sloj naziv="Natpisi">
          <div
            data-part="viewport"
            className="relative overflow-hidden rounded-xl bg-white"
            style={omjer}
          >
            <NatpisiKarte opis={`Natpisi karte kvarta: ${prikaz.opis.recenica}`} />
          </div>
        </Sloj>
      </div>

      <div
        data-component="Podloga.Slojevi"
        className="mt-12 grid gap-5 min-[560px]:grid-cols-2 lg:grid-cols-4"
      >
        <SlojPodloge naziv="Pozadina" id="pozadina" komponenta="Pozadina">
          <PodlogaPozadina />
        </SlojPodloge>
        <SlojPodloge
          naziv="Sporedne izohipse"
          id="izohipse-sporedne"
          komponenta="IzohipseSporedne"
        >
          <PodlogaIzohipseSporedne />
        </SlojPodloge>
        <SlojPodloge
          naziv="Glavne izohipse"
          id="izohipse-glavne"
          komponenta="IzohipseGlavne"
        >
          <PodlogaIzohipseGlavne />
        </SlojPodloge>
        <SlojPodloge naziv="Zgrade" id="zgrade" komponenta="Zgrade">
          <PodlogaZgrade />
        </SlojPodloge>
        <SlojPodloge naziv="Ulice" id="ulice" komponenta="Ulice">
          <PodlogaUlice />
        </SlojPodloge>
        <SlojPodloge
          naziv="Granica Dračevca"
          id="granica-dracevac"
          komponenta="GranicaDracevac"
        >
          <PodlogaGranicaDracevac />
        </SlojPodloge>
        <SlojPodloge
          naziv="Granica Bilica"
          id="granica-bilice"
          komponenta="GranicaBilice"
        >
          <PodlogaGranicaBilice />
        </SlojPodloge>
        <SlojPodloge naziv="Reljef" id="reljef" komponenta="Reljef">
          <PodlogaReljef />
        </SlojPodloge>
      </div>
    </>
  );
}

export default async function KomponentePage() {
  return <PrikazKomponenti prikaz={await pripremiZrak()} />;
}
