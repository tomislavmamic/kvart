import type { Metadata } from "next";
import Link from "next/link";

import {
  PageIntro,
  SectionHeading,
} from "@/components/karepovac/project-components";

export const metadata: Metadata = {
  title: "Postaje",
  description:
    "Stanje buduće građanske mreže, pravila smještaja i privatnost domaćina postaja oko Karepovca.",
};

export default function PostajePage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Mreža još nema javnih postaja">
        <p>
          Ne prikazujemo izmišljene oznake ni točke samo da karta izgleda
          dovršeno. Postaja će se pojaviti ovdje tek nakon sastavljanja,
          usporednog rada, odabira lokacije i dogovora s domaćinom.
        </p>
      </PageIntro>

      <section className="overflow-hidden rounded-2xl border border-kamen-rub bg-white lg:grid lg:grid-cols-[1.1fr_0.9fr]">
        <StationField />
        <div className="flex flex-col justify-center bg-kamen-tinta p-6 text-white sm:p-9">
          <p className="text-3xl font-bold tracking-[-0.025em]">0 javnih postaja</p>
          <p className="mt-4 text-lg leading-8 text-zinc-300">
            Ovo je stvarno stanje projekta, ne mjera napretka. Cilj prvog pilota
            je najmanje tri provjerena čvora na lokacijama koje daju koristan
            raspored uz česte smjerove vjetra.
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
        <SectionHeading title="Kako biramo lokacije">
          <p>
            Ne pobjeđuje prva prijava. Skup lokacija mora zajedno pomoći
            razlikovati događaj iz smjera Karepovca od vrlo lokalnog izvora.
          </p>
        </SectionHeading>
        <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-2">
          {[
            ["Položaj", "Korisna upwind/downwind pokrivenost pod čestim režimima vjetra."],
            ["Strujanje zraka", "Otvoreno mjesto, odmaknuto od zidova i neposrednih lokalnih izvora."],
            ["Radni uvjeti", "Sigurno napajanje, podatkovna veza i moguć pristup za održavanje."],
            ["Pouzdanost", "Domaćin može javiti promjenu uvjeta, prekid ili potrebu za uklanjanjem."],
          ].map(([term, detail]) => (
            <div key={term} className="bg-white p-6">
              <dt className="font-bold text-kamen-tinta">{term}</dt>
              <dd className="mt-3 leading-7 text-kamen-tekst">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
        <SectionHeading title="Točna kućna lokacija ostaje privatna">
          <p>
            Javni prikaz koristi grubu ili pomaknutu lokaciju. Kontakt, adresa,
            pristupne upute i precizne koordinate domaćina dostupni su samo
            ovlaštenim osobama koje održavaju mrežu.
          </p>
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
