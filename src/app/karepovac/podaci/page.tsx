import type { Metadata } from "next";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";

export const metadata: Metadata = {
  title: "Podaci i izvori",
  description:
    "Budući javni podaci, izvori, kvaliteta i otvoreni formati mreže oko Karepovca.",
};

export default function PodaciPage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Podaci će dolaziti s objašnjenjem, ne sami">
        <p>
          Svako javno očitanje treba odgovoriti gdje je nastalo, kada je zadnji
          put bilo valjano, kako je obrađeno i smije li se uspoređivati s drugim
          izvorom. Dok toga nema, nema ni datoteke za preuzimanje.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section>
        <SectionHeading title="Što će sadržavati zapis postaje" />
        <div className="mt-7 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <dl className="divide-y divide-kamen-tlo">
            {[
              ["Vrijeme", "vrijeme uzorka, zadnjeg primitka i zadnjeg valjanog mjerenja"],
              ["Vrijednost", "sirova i korigirana vrijednost uz jedinicu i interval agregacije"],
              ["Kvaliteta", "valjano, privremeno, sumnjivo, nevaljano, zastarjelo ili održavanje"],
              ["Porijeklo", "postaja, vrsta senzora, verzija programa i verzija korekcije"],
              ["Okolina", "temperatura i vlaga potrebne za tumačenje odziva senzora"],
              ["Lokacija", "gruba javna lokacija koja štiti adresu domaćina"],
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
          <SectionHeading title="Otvoreni formati">
            <p>
              Nakon provjere planiramo objaviti satne agregate za jednostavno
              korištenje i sirove uzorke sa sačuvanim oznakama kvalitete za
              stručnu analizu.
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
              Licenca, shema, API i raspored osvježavanja bit će objavljeni
              prije prvog javnog skupa.
            </p>
          </div>
        </div>

        <div>
          <SectionHeading title="Kad nešto nedostaje">
            <p>
              Zastarjela postaja ostaje vidljiva, ali ne ulazi u trenutni sažetak
              ni model. Praznina se ne popunjava interpolacijom koja izgleda kao
              mjerenje.
            </p>
          </SectionHeading>
          <div className="mt-6 rounded-xl bg-kamen-tinta p-6 text-white">
            <p className="text-sm font-bold text-zinc-300">Primjer poštenog stanja</p>
            <p className="mt-3 text-xl font-bold">Nema valjanog mjerenja</p>
            <p className="mt-2 leading-7 text-zinc-300">
              Prikazuje se vrijeme zadnjeg valjanog uzorka i razlog prekida —
              ne nula, ne procjena i ne posljednja vrijednost bez upozorenja.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
