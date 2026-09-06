import Link from "next/link";

import {
  PageIntro,
  SectionHeading,
} from "@/components/karepovac/project-components";
import {
  MjestoPostaje,
  SluzbenePostaje,
  VjetrokaziOkoKvarta,
} from "@/components/karepovac/sluzbena-mjerenja";
import { createPageMetadata } from "@/lib/metadata";
import { PRIJEDLOZI_POSTAJA } from "@/lib/sim/prijedlozi-postaja";
import { NAZIV_FAZE, trebaStanovnika } from "@/lib/ukljuci-se";

export const metadata = createPageMetadata({
  title: "Postaje",
  description:
    "Dvije službene postaje već stoje na Karepovcu i objavljuju satna mjerenja. Naših postaja još nema; ovdje piše gdje ih predlažemo, kako biramo mjesta i kako štitimo adresu stanovnika.",
});

export default function PostajePage() {
  const zaStanovnike = PRIJEDLOZI_POSTAJA.filter(trebaStanovnika);
  const uFaziA = PRIJEDLOZI_POSTAJA.filter((s) => s.faza === "A").length;

  return (
    <div className="space-y-14">
      <PageIntro title="Dvije službene postaje već stoje na Karepovcu">
        <p>Jugoistočno od odlagališta, u udolini prema Kamenu, rade dvije mjerne postaje i objavljuju satne tablice, mjesec po mjesecu. Jednu vodi Čistoća, drugu Grad Split; obje mjeri Nastavni zavod za javno zdravstvo. Nismo to znali dok nismo potražili — pa to ovdje pišemo prije nego što išta kažemo o vlastitim uređajima.</p>
      </PageIntro>

      <section>
        <SluzbenePostaje />
        <p className="mt-4 max-w-3xl text-base leading-7 text-kamen-drugi">
          Podaci su javni i strojno čitljivi, ali stoje na stranici bez pretraživanja i bez ijednog grafikona. Skidamo ih i objavljujemo ovdje uz oznaku da su službeni, a ne naši.
        </p>
      </section>

      <section>
        <MjestoPostaje />
      </section>

      <section>
        <VjetrokaziOkoKvarta />
      </section>

      <section
        aria-labelledby="nasih-postaja"
        className="overflow-hidden rounded-2xl border border-kamen-rub bg-white lg:grid lg:grid-cols-[0.9fr_1.1fr]"
      >
        <div className="flex flex-col justify-center bg-kamen-tinta p-6 text-white sm:p-9">
          <p id="nasih-postaja" className="text-3xl font-bold tracking-[-0.025em]">
            Naših postaja: nijedna
          </p>
          <p className="mt-4 text-lg leading-8 text-zinc-300">
            Obje službene postaje stoje na istoj točki, s druge strane odlagališta
            od kvarta. Zato i dalje trebamo vlastite uređaje — najmanje tri,
            raspoređena tako da mjere ondje gdje ljudi žive. Predložili smo{" "}
            {PRIJEDLOZI_POSTAJA.length} mjesta u tri faze; u prvoj ih je {uFaziA}.
            Nećemo prikazivati izmišljene oznake samo da bi karta izgledala
            popunjeno.
          </p>
          <Link
            href="/karepovac/sim?pri=1"
            className="fokus mt-7 inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-white/60 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
          >
            Predložena mjesta na karti →
          </Link>
        </div>
        <div className="p-6 sm:p-8">
          <h3 className="text-xl font-bold text-kamen-tinta">Gdje tražimo mjesto</h3>
          <p className="mt-2 text-base leading-7 text-kamen-tekst">
            {zaStanovnike.length} od {PRIJEDLOZI_POSTAJA.length} predloženih postaja
            traži dvorište, balkon ili krov stanovnika i struju iz kuće. Ostale
            traže dogovor s ustanovom.
          </p>
          <ul className="mt-4 divide-y divide-kamen-tlo">
            {zaStanovnike.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-base leading-6">
                  <span className="font-semibold text-kamen-tinta">{s.naziv}</span>
                  <span className="block text-kamen-drugi">{NAZIV_FAZE[s.faza]}</span>
                </span>
                <Link
                  href={`/karepovac/ukljuci-se?postaja=${s.id}#mogu-pomoci`}
                  className="fokus inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-maslina px-4 font-semibold text-maslina-tamna hover:bg-maslina-vez"
                >
                  Ponudi mjesto
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionHeading title="Kako biramo mjesta za postaje">
          <p>Mjesta nećemo birati samo po redoslijedu prijava. Postaje zajedno moraju pomoći razlikovati pojavu iz smjera Karepovca od izvora u neposrednoj blizini.</p>
        </SectionHeading>
        <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-2">
          {[
            ["Položaj", "Raspored s obje strane najčešćih smjerova vjetra."],
            ["Strujanje zraka", "Otvoreno mjesto, odmaknuto od zidova i neposrednih izvora dima ili mirisa."],
            ["Uvjeti za rad", "Sigurno napajanje, podatkovna veza i pristup radi održavanja."],
            ["Dogovor", "Stanovnik nam može javiti promjenu uvjeta, prekid rada ili da želi ukloniti postaju."],
          ].map(([term, detail]) => (
            <div key={term} className="bg-white p-6">
              <dt className="font-bold text-kamen-tinta">{term}</dt>
              <dd className="mt-3 leading-7 text-kamen-tekst">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
        <SectionHeading title="Adresa i kontakt ostaju privatni">
          <p>Na karti ćemo prikazati samo približnu lokaciju. Ime, kontakt, kućna adresa, upute za pristup i točne koordinate bit će dostupni samo ljudima koji održavaju postaju.</p>
        </SectionHeading>
      </section>
    </div>
  );
}
