import type { Metadata } from "next";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";

export const metadata: Metadata = {
  title: "Podaci i izvori",
  description:
    "Saznajte koje ćemo podatke objavljivati uz svako mjerenje, kako ćemo označavati njihovu pouzdanost i u kojim će se datotekama moći preuzeti.",
};

export default function PodaciPage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Uz svaki podatak objavit ćemo kada je i kako izmjeren">
        <p>
          Uz svako mjerenje navest ćemo gdje je nastalo, kada je zadnji put bilo
          valjano, kako smo ga obradili i s kojim se podacima smije
          uspoređivati. Dok te informacije nisu spremne, nećemo nuditi ni
          datoteke za preuzimanje.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section>
        <SectionHeading title="Što ćemo objaviti uz svako mjerenje" />
        <div className="mt-7 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <dl className="divide-y divide-kamen-tlo">
            {[
              ["Vrijeme", "vrijeme mjerenja, vrijeme primitka i vrijeme zadnjeg valjanog mjerenja"],
              ["Vrijednost", "izvorna i ispravljena vrijednost, mjerna jedinica i razdoblje koje prikazuje"],
              ["Pouzdanost", "valjano, privremeno, sumnjivo, nevaljano, zastarjelo ili održavanje"],
              ["Uređaj", "oznaka postaje, vrsta senzora te inačica programa i ispravka"],
              ["Uvjeti", "temperatura i vlaga koje mogu utjecati na senzor"],
              ["Lokacija", "približna lokacija koja ne otkriva kućnu adresu"],
            ].map(([term, detail]) => (
              <div key={term} className="grid gap-2 p-5 sm:grid-cols-[10rem_1fr] sm:gap-8 sm:p-6">
                <dt className="font-bold text-kamen-tinta">{term}</dt>
                <dd className="leading-7 text-kamen-tekst">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionHeading title="Datoteke za preuzimanje">
            <p>
              Nakon provjere objavit ćemo satne vrijednosti za jednostavnu
              uporabu. Izvorna mjerenja s oznakama pouzdanosti bit će dostupna
              za podrobniju analizu.
            </p>
          </SectionHeading>
          <div className="mt-6 rounded-xl border border-kamen-tlo bg-white p-6">
            <div className="flex flex-wrap gap-2">
              {['CSV', 'JSON', 'GeoJSON'].map((format) => (
                <span key={format} className="rounded-sm bg-kamen-plitko px-2.5 py-1 font-mono text-sm font-semibold text-kamen-tekst">
                  {format}
                </span>
              ))}
            </div>
            <p className="mt-5 leading-7 text-kamen-tekst">
              Licencu, opis podataka, API i raspored osvježavanja objavit ćemo
              prije prvog skupa podataka.
            </p>
          </div>
        </div>

        <div>
          <SectionHeading title="Kad mjerenje nedostaje">
            <p>
              Postaja koja se prestala javljati ostat će vidljiva, ali njezine
              podatke nećemo uključiti u pregled trenutačnog stanja ni u
              procjenu širenja. Mjesto bez mjerenja ostat će prazno.
            </p>
          </SectionHeading>
          <div className="mt-6 rounded-xl bg-kamen-tinta p-6 text-white">
            <p className="text-base font-bold text-zinc-300">Primjer jasne obavijesti</p>
            <p className="mt-3 text-xl font-bold">Nema valjanog mjerenja</p>
            <p className="mt-2 leading-7 text-zinc-300">
              Prikazat ćemo vrijeme zadnjeg valjanog mjerenja i razlog prekida.
              Nećemo prikazati nulu, procjenu ni posljednju vrijednost bez
              upozorenja.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
