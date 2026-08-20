import Link from "next/link";

import { PoljeDimaVeliko } from "@/components/karepovac/karta-kartice";
import {
  EvidenceRegister,
  PrimaryLink,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { DnevniHod, RuzaMirisa } from "@/components/karepovac/sluzbena-mjerenja";
import { BAZDARENJE } from "@/generated/karepovac-bazdarenje";
import { MJERENJA } from "@/generated/karepovac-mjerenja";
import { KAREPOVAC_PHASES } from "@/lib/karepovac";

/** Isti rok kao na pregledu, da dvije karte istoga kvarta ne pokazuju dva vjetra. */
export const revalidate = 900;

const H2S_SATI = MJERENJA.postaje[0].tvari[0].sati;
const MERKAPTANI_SATI =
  MJERENJA.postaje[1].tvari[MJERENJA.postaje[1].tvari.length - 1].sati;

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
              Postavit ćemo nekoliko mjernih postaja oko Karepovca. Njihova ćemo
              mjerenja uspoređivati s pojavama neugodnog mirisa te sa smjerom i
              brzinom vjetra.
            </p>
          </div>

          <div className="mt-7 sm:mt-10">
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-amber-100 sm:mb-5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Projekt je u pripremi
            </div>
            <PrimaryLink href="/karepovac/ukljuci-se">
              Kako se mogu uključiti
            </PrimaryLink>
          </div>
        </div>
        <PoljeDimaVeliko />
      </section>

      <section className="space-y-8">
        <SectionHeading title="Što već znamo iz službenih mjerenja">
          <p>
            Naših uređaja još nema, ali na rubu odlagališta dvije službene
            postaje mjere svakoga sata. Skinuli smo sve što su objavile —
            {" "}{H2S_SATI.toLocaleString("hr-HR")} sati sumporovodika i{" "}
            {MERKAPTANI_SATI.toLocaleString("hr-HR")} sati merkaptana — i evo
            što u tome piše.
          </p>
        </SectionHeading>
        <DnevniHod />
        <RuzaMirisa />
        <div className="rounded-xl border border-kamen-tlo bg-kamen-plitko p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <p className="max-w-2xl text-base leading-7 text-kamen-tekst">
            Obje ruže gore stoje na rubu odlagališta. Ono što se osjeti u
            kvartu, kilometar dalje, ne mjeri nitko — osim ljudi koji ondje
            žive.
          </p>
          <Link
            href="/karepovac/dojava"
            className="fokus mt-4 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna sm:mt-0"
          >
            Javite kada je smrdjelo
          </Link>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.68fr_1.32fr] lg:gap-12">
        <SectionHeading title="Što model smije reći, a što ne">
          <p>
            Model raspršenja pustili smo kroz {BAZDARENJE.sati.toLocaleString("hr-HR")}{" "}
            sati mjerenja da vidimo pogađa li. Rezultat je pola dobar, i bolje
            je da to piše ovdje nego da se otkrije poslije.
          </p>
          <Link
            href="/karepovac/metodologija"
            className="fokus mt-5 inline-flex rounded-md font-semibold text-maslina underline decoration-maslina-rub decoration-2 underline-offset-4 hover:text-maslina-tamna"
          >
            Zašto prvo provjeravamo senzore →
          </Link>
        </SectionHeading>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-xl font-bold">Provjera na tuđim tvarima</h2>
          <ul className="mt-5 space-y-4 leading-7">
            <Fact>
              Ozon i ugljikov monoksid ne dolaze s Karepovca — ovise samo o tome
              koliko se zrak miješa. Njih model pogađa dobro, pa mu račun
              razrjeđenja valja.
            </Fact>
            <Fact>
              Merkaptane, koji dolaze s Karepovca, model ne pogađa. Ne valja mu,
              dakle, pretpostavka da odlagalište ispušta jednako cijeli dan — a
              mjerenja pokazuju da ne ispušta.
            </Fact>
            <Fact>
              Zato karta na vrhu pokazuje kamo zrak s plohe odlazi i koliko je
              često ondje — a ne koliko tada smrdi. To je razlika koju model
              može potkrijepiti.
            </Fact>
          </ul>
        </div>
      </section>

      <section>
        <SectionHeading title="Kako ćemo razlikovati podatke">
          <p>
            Na karti i grafikonima jasno ćemo označiti odakle svaki podatak dolazi.
            Procjenu na temelju vjetra nećemo prikazivati kao da je riječ o mjerenju.
          </p>
        </SectionHeading>
        <div className="mt-7">
          <EvidenceRegister />
        </div>
      </section>

      <section>
        <SectionHeading title="Što moramo napraviti prije početka mjerenja">
          <p>
            Na svakoj ćemo etapi ostaviti javni trag. Sljedeću nećemo proglasiti
            završenom dok prethodna ne bude imala dokumentiran rezultat.
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
            Za pouzdanu sliku treba nam više postaja.
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-kamen-tekst">
            Za pouzdaniju sliku trebaju nam dobro raspoređene postaje,
            provjerena oprema i redovito održavanje. Javno ćemo objaviti i koliko
            je novca prikupljeno te na što je potrošen.
          </p>
          <div className="mt-7">
            <PrimaryLink href="/karepovac/ukljuci-se">
              Pogledajte kako možete pomoći
            </PrimaryLink>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-kamen-tlo">
          <div className="flex min-h-36 flex-col justify-end bg-kamen-plitko p-5">
            <span className="text-3xl font-extrabold text-kamen-tinta">3+</span>
            <span className="mt-1 text-sm font-semibold text-kamen-tekst">
              mjerna uređaja planirana za prvi pokusni rad
            </span>
          </div>
          <div className="flex min-h-36 flex-col justify-end bg-kamen-plitko p-5">
            <span className="text-3xl font-extrabold text-kamen-tinta">30</span>
            <span className="mt-1 text-sm font-semibold text-kamen-tekst">
              dana planiranog pokusnog rada
            </span>
          </div>
          <div className="col-span-2 flex min-h-28 items-end bg-white p-5">
            <p className="max-w-sm text-base leading-6 text-kamen-drugi">
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
