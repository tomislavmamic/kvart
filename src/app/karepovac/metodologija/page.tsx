import type { Metadata } from "next";

import {
  EvidenceRegister,
  PageIntro,
  SectionHeading,
} from "@/components/karepovac/project-components";

export const metadata: Metadata = {
  title: "Kako mjerimo",
  description:
    "Metodologija, umjeravanje, provjera kvalitete i ograničenja građanske mreže oko Karepovca.",
};

export default function MetodologijaPage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Najprije provjera, tek onda broj">
        <p>
          Jeftin senzor može reagirati na temperaturu, vlagu i druge plinove,
          a njegov odziv s vremenom odluta. Zbog toga uređaj ne postaje javna
          postaja čim ga uključimo.
        </p>
      </PageIntro>

      <section className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <SectionHeading title="Što želimo pratiti">
          <p>
            H₂S je prvi specifični plin za pilot. Senzori mirisnog otiska mogu
            pomoći prepoznati događaj, ali nisu zamjena za identificirani plin.
            NH₃ ulazi tek nakon uspješne provjere kandidata.
          </p>
        </SectionHeading>
        <dl className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <MethodRow term="H₂S" value="Primarni plin za prvi pilot; rezultat se objavljuje samo uz valjanu korekciju i oznaku kvalitete." />
          <MethodRow term="Mirisni otisak" value="Dopunski kvalitativni signal za događaje i obrasce, bez tvrdnje da predstavlja jedan plin." />
          <MethodRow term="NH₃" value="Opcionalno proširenje ako usporedni rad pokaže korisnu osjetljivost pri očekivanim niskim razinama." />
          <MethodRow term="Vjetar" value="Neovisni ulaz za procijenjeni smjer širenja; nikada se ne pretvara u izmišljeno mjerenje između postaja." />
        </dl>
      </section>

      <section>
        <SectionHeading title="Pet vrata do javnog podatka">
          <p>
            Svaki uređaj prolazi isti put. Neuspjeh na jednim vratima ostaje
            vidljiv kao ograničenje, umjesto da se sakrije glađim grafikonom.
          </p>
        </SectionHeading>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-5">
          {[
            ["Sastavljanje", "Verzija senzora, elektronike, kućišta i programa."],
            ["Rad zajedno", "Razlike, šum, pomak, prekidi i utjecaj kućišta."],
            ["Usporedba", "Rad uz prikladan referentni instrument kada je moguće."],
            ["Umjeravanje", "Verzionirane korekcije, pogreška i poznata ograničenja."],
            ["Pilot", "30 dana dostupnosti, održavanja i provjere lokacije."],
          ].map(([title, body]) => (
            <li key={title} className="bg-white p-5">
              <h3 className="font-bold text-kamen-tinta">{title}</h3>
              <p className="mt-3 text-base leading-7 text-kamen-tekst">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHeading title="Izvor ostaje uz podatak">
          <p>
            Boja i naziv govore je li nešto izmjereno u građanskoj mreži,
            preuzeto iz službenog izvora ili procijenjeno modelom.
          </p>
        </SectionHeading>
        <div className="mt-7">
          <EvidenceRegister />
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-950 sm:p-8">
        <h2 className="text-xl font-bold">Ovo nije sigurnosni alarm</h2>
        <p className="mt-3 max-w-3xl leading-7">
          Buduća očitanja bit će indikativna mjerenja građanske mreže. Ne
          potvrđuju usklađenost s propisima, ne zamjenjuju službeni nadzor i ne
          smiju se koristiti za zaštitu radnika ili hitne odluke.
        </p>
      </section>
    </div>
  );
}

function MethodRow({ term, value }: { term: string; value: string }) {
  return (
    <div className="grid gap-2 border-b border-kamen-tlo p-5 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:p-6">
      <dt className="font-bold text-kamen-tinta">{term}</dt>
      <dd className="leading-7 text-kamen-tekst">{value}</dd>
    </div>
  );
}
