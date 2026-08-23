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

export const metadata = createPageMetadata({
  title: "Postaje",
  description:
    "Dvije službene postaje već stoje na Karepovcu i objavljuju satna mjerenja. Naših postaja još nema; ovdje piše kako biramo njihova mjesta i kako štitimo adresu stanovnika.",
});

export default function PostajePage() {
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

      <section className="overflow-hidden rounded-2xl border border-kamen-rub bg-white lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <StationField />
        <div className="flex flex-col justify-center bg-kamen-tinta p-6 text-white sm:p-9">
          <p className="text-3xl font-bold tracking-[-0.025em]">Naših postaja: nijedna</p>
          <p className="mt-4 text-lg leading-8 text-zinc-300">
            Obje službene postaje stoje na istoj točki, s druge strane odlagališta od kvarta. Zato i dalje trebamo vlastite uređaje — najmanje tri, raspoređena tako da mjere ondje gdje ljudi žive. Nećemo prikazivati izmišljene oznake samo da bi karta izgledala popunjeno.
          </p>
          <Link
            href="/karepovac/ukljuci-se"
            className="fokus mt-7 inline-flex min-h-11 w-fit items-center justify-center rounded-lg border border-white/60 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
          >
            Što tražimo od lokacije
          </Link>
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

function StationField() {
  return (
    <div className="relative min-h-[390px] overflow-hidden p-6 sm:p-8">
      <svg aria-hidden="true" viewBox="0 0 560 390" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <rect width="560" height="390" fill="#f4f4f5" />
        <g fill="none" stroke="#d4d4d8" strokeWidth="1.5">
          <path d="M0 78H560M0 156H560M0 234H560M0 312H560" />
          <path d="M112 0V390M224 0V390M336 0V390M448 0V390" />
        </g>
        <circle cx="285" cy="190" r="58" fill="#ecfdf5" />
        <circle cx="285" cy="190" r="23" fill="#007956" />
        <path d="m285 247-15-43h30l-15 43Z" fill="#007956" />
        <circle cx="285" cy="190" r="8" fill="white" />
      </svg>
      <div className="relative flex min-h-[326px] items-end justify-center">
        <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-kamen-tinta shadow-[0_8px_20px_-8px_rgb(24_24_27/0.25)]">
          Karepovac
        </div>
      </div>
    </div>
  );
}
