import { Ruza } from "@/components/karepovac/ruza";
import {
  PageIntro,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { ODOUR_STRENGTH_SHORT, ODOUR_STRENGTHS } from "@/lib/constants";
import type { OdourStrength } from "@/lib/constants";
import { ruzaDojava, SEKTOR_IMENA } from "@/lib/dojave";
import { createPageMetadata } from "@/lib/metadata";
import { getOdourReports } from "@/lib/queries";

import { ObrazacDojave } from "./obrazac";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Dojava mirisa",
  description:
    "Javite kada i gdje se osjetio miris. Svaka dojava dobiva sat, svaki sat svoj izmjereni vjetar — i iz toga izlazi ruža koja ne ovisi ni o kakvom modelu.",
});

/**
 * Smjer iz kojega puše vjetar koji nosi zrak s Karepovca na kvart.
 *
 * Odlagalište leži 1,1 km istočno-jugoistočno od sredine kvarta, na 112°, pa
 * ga donosi vjetar iz istog smjera. To je predviđanje koje ruža dojava
 * provjerava — i može ga opovrgnuti.
 */
const SEKTOR_KAREPOVCA = 5;

export default async function DojavaPage() {
  const dojave = await getOdourReports();
  const ruza = ruzaDojava(dojave);
  const dovoljno = ruza.uporabljeno >= 20;
  const vrh = dovoljno
    ? ruza.tezine.indexOf(Math.max(...ruza.tezine))
    : null;

  const poJacini = Object.keys(ODOUR_STRENGTHS).map((kljuc) => ({
    kljuc: kljuc as OdourStrength,
    broj: dojave.filter((d) => d.strength === kljuc).length,
  }));

  return (
    <div className="space-y-14">
      <PageIntro title="Javite kada je smrdjelo">
        <p>
          Ovo je jedino mjerenje koje se skuplja bez ijednog uređaja. Svaka
          dojava dobiva sat, svaki sat ima svoj izmjereni vjetar — i iz toga
          izlazi ruža koja pokazuje odakle je puhalo kad se osjetilo. Ta ruža
          ne ovisi ni o kakvom modelu i vrijedi sama za sebe.
        </p>
        <p className="mt-4">
          Postupak je pučka inačica mrežne metode iz norme EN 16841-1, gdje
          obučeni ocjenjivači tijekom godine obilaze zadane točke. Naša je
          slabija u svakom pogledu osim jednoga: može početi danas.
        </p>
      </PageIntro>

      <section className="rounded-2xl border border-kamen-rub bg-white p-6 sm:p-8">
        <ObrazacDojave />
      </section>

      <section>
        <SectionHeading title="Ruža dojava">
          <p>
            Krak stoji u smjeru iz kojega je puhalo. Karepovac leži
            istočno-jugoistočno od kvarta, pa bi ondje trebao biti i vrh. Ako
            se ne poklopi, to nije neuspjeh nego nalaz — znači da miris dolazi
            odnekud drugdje ili da sat u dojavama nije dovoljno točan.
          </p>
        </SectionHeading>

        {dovoljno && vrh !== null ? (
          <div className="mt-7 grid items-center gap-8 sm:grid-cols-[minmax(0,320px)_1fr]">
            <Ruza
              vrijednosti={ruza.tezine}
              boja="#6d28d9"
              opisZaCitac={`Ruža dojava: najviše ih je pri vjetru iz smjera ${SEKTOR_IMENA[vrh]}.`}
              opisi={ruza.tezine.map(
                (_, i) => `${SEKTOR_IMENA[i]}: ${ruza.broj[i]} dojava`,
              )}
              biljeg={{ sektor: SEKTOR_KAREPOVCA, naziv: "Karepovac" }}
            />
            <div>
              <p className="text-2xl font-bold text-kamen-tinta">
                Najviše dojava pri vjetru iz smjera {SEKTOR_IMENA[vrh]}
              </p>
              <p className="mt-3 max-w-md text-base leading-7 text-kamen-tekst">
                {vrh === SEKTOR_KAREPOVCA
                  ? "To je smjer u kojem leži Karepovac. Dojave i vjetar govore isto."
                  : `Karepovac leži u smjeru ${SEKTOR_IMENA[SEKTOR_KAREPOVCA]}. Vrh dojava stoji drugdje, i to ovdje piše jednako kao da se poklopilo.`}
              </p>
              <p className="mt-4 max-w-md text-base leading-7 text-kamen-drugi">
                U ruži je {ruza.uporabljeno.toLocaleString("hr-HR")} dojava.
                {ruza.bezVjetra > 0 &&
                  ` Još ${ruza.bezVjetra.toLocaleString("hr-HR")} čeka podatak o vjetru za svoj sat.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-7 rounded-xl border border-kamen-tlo bg-kamen-plitko p-6">
            <p className="text-lg leading-8 text-kamen-tekst">
              Za ružu treba barem dvadeset dojava s poznatim vjetrom. Zasad ih
              je {ruza.uporabljeno.toLocaleString("hr-HR")}. Dok ih ne bude
              dovoljno, ovdje ne crtamo ništa — ruža od pet dojava izgledala bi
              kao nalaz, a bila bi slučaj.
            </p>
          </div>
        )}
      </section>

      <section>
        <SectionHeading title="Što je dosad javljeno" />
        <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-4">
          {poJacini.map(({ kljuc, broj }) => (
            <div key={kljuc} className="bg-white p-5">
              <dt className="text-base text-kamen-drugi">
                {ODOUR_STRENGTH_SHORT[kljuc]}
              </dt>
              <dd className="mt-1 text-3xl font-extrabold tabular-nums text-kamen-tinta">
                {broj}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-3xl text-base leading-7 text-kamen-drugi">
          Zbroj za zadnjih godinu dana. Dojava nije mjerenje i tako je i
          označavamo — ali je jedini podatak u ovom projektu koji dolazi odande
          gdje ljudi zapravo žive, a ne s ruba odlagališta.
        </p>
      </section>
    </div>
  );
}
