import Link from "next/link";

import {
  EvidenceRegister,
  MonitoringField,
  PrimaryLink,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { KAREPOVAC_PHASES } from "@/lib/karepovac";

export default function KarepovacPage() {
  return (
    <div className="space-y-16">
      <section className="overflow-hidden rounded-2xl border border-kamen-rub bg-white lg:grid lg:grid-cols-[0.82fr_1.18fr]">
        <div className="flex flex-col justify-between bg-kamen-tinta p-5 text-white sm:p-9 lg:min-h-[520px]">
          <div>
            <h1 className="max-w-md text-4xl font-extrabold leading-[1.07] tracking-[-0.035em] sm:text-5xl">
              Što zrak nosi iz smjera Karepovca?
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-zinc-200 sm:mt-6 sm:text-lg sm:leading-8">
              Gradimo malu građansku mrežu koja će povezati indikativna H₂S
              mjerenja, mirisne događaje i vjetar — bez miješanja mjerenog i
              procijenjenog.
            </p>
          </div>

          <div className="mt-7 sm:mt-10">
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-amber-100 sm:mb-5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Projekt je u pripremi
            </div>
            <PrimaryLink href="/karepovac/ukljuci-se">
              Pogledajte kako se uključiti
            </PrimaryLink>
          </div>
        </div>
        <MonitoringField />
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:gap-12">
        <SectionHeading title="Danas nema podataka za prikaz">
          <p>
            To nije kvar. Mjerenja ćemo objaviti tek nakon usporednog rada,
            umjeravanja i provjere kvalitete. Procjena smjera širenja neće se
            uključiti dok nema pouzdanog vjetra i valjanih mjerenja.
          </p>
          <Link
            href="/karepovac/metodologija"
            className="fokus mt-5 inline-flex rounded-md font-semibold text-maslina underline decoration-maslina-rub decoration-2 underline-offset-4 hover:text-maslina-tamna"
          >
            Zašto prvo provjeravamo senzore →
          </Link>
        </SectionHeading>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-xl font-bold">Što već možemo reći</h2>
          <ul className="mt-5 space-y-4 leading-7">
            <Fact>
              Mreža će krenuti s najmanje tri jednaka H₂S čvora i pouzdanim
              lokalnim podatkom o vjetru.
            </Fact>
            <Fact>
              NH₃ se dodaje samo ako odabrani modul tijekom usporednog rada
              pokaže korisnu osjetljivost pri niskim koncentracijama.
            </Fact>
            <Fact>
              Ovo će biti indikativno građansko mjerenje, a ne službeno ni
              sigurnosno mjerenje.
            </Fact>
          </ul>
        </div>
      </section>

      <section>
        <SectionHeading title="Tri zapisa koja se ne smiju zamijeniti">
          <p>
            Karta i grafikoni uvijek će pokazati odakle podatak dolazi. Model
            vjetra neće se prikazivati kao da je plin izmjeren na tom mjestu.
          </p>
        </SectionHeading>
        <div className="mt-7">
          <EvidenceRegister />
        </div>
      </section>

      <section>
        <SectionHeading title="Put do javne mreže">
          <p>
            Svaka etapa ostavlja javni trag. Sljedeća se ne proglašava
            završenom dok prethodna nema dokumentiran rezultat.
          </p>
        </SectionHeading>
        <ol className="mt-8 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          {KAREPOVAC_PHASES.map((phase, index) => (
            <li
              key={phase.title}
              className={`grid gap-3 p-5 sm:grid-cols-[7rem_13rem_1fr] sm:gap-6 sm:p-6 ${
                index > 0 ? "border-t border-kamen-tlo" : ""
              }`}
            >
              <span
                className={
                  index === 0
                    ? "w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"
                    : "w-fit rounded-full bg-kamen-plitko px-3 py-1 text-xs font-bold text-kamen-drugi"
                }
              >
                {phase.status}
              </span>
              <h3 className="font-bold text-kamen-tinta">{phase.title}</h3>
              <p className="leading-7 text-kamen-tekst">{phase.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid overflow-hidden rounded-2xl bg-white lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-6 sm:p-9">
          <h2 className="text-3xl font-bold tracking-[-0.025em] text-kamen-tinta">
            Mrežu neće izgraditi jedna kutija na krovu.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-kamen-tekst">
            Trebaju nam dobro raspoređene lokacije, provjerena oprema,
            umjeravanje i javan račun svakog troška. Možete pomoći mjestom,
            znanjem ili budućom donacijom.
          </p>
          <div className="mt-7">
            <PrimaryLink href="/karepovac/ukljuci-se">Kako mogu pomoći?</PrimaryLink>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-kamen-tlo">
          <div className="flex min-h-36 flex-col justify-end bg-kamen-plitko p-5">
            <span className="text-3xl font-extrabold text-kamen-tinta">3+</span>
            <span className="mt-1 text-sm font-semibold text-kamen-tekst">
              čvora ciljano za prvi pilot
            </span>
          </div>
          <div className="flex min-h-36 flex-col justify-end bg-kamen-plitko p-5">
            <span className="text-3xl font-extrabold text-kamen-tinta">30</span>
            <span className="mt-1 text-sm font-semibold text-kamen-tekst">
              dana planirane provjere pilota
            </span>
          </div>
          <div className="col-span-2 flex min-h-28 items-end bg-white p-5">
            <p className="max-w-sm text-sm leading-6 text-kamen-drugi">
              Ciljevi iz odobrenog plana; nisu broj postojećih postaja ni
              trajanje već obavljenog rada.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1.5 h-4 w-4 shrink-0 text-amber-700">
        <path d="m4 10 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
