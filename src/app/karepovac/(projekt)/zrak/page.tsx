import Link from "next/link";

import { PoljeDimaVeliko } from "@/components/karepovac/karta-kartice";
import {
  EvidenceRegister,
  PrimaryLink,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { PresjekPadine } from "@/components/karepovac/presjek-padine";
import { DnevniHod, RuzaMirisa } from "@/components/karepovac/sluzbena-mjerenja";
import { BAZDARENJE } from "@/generated/karepovac-bazdarenje";
import { MJERENJA } from "@/generated/karepovac-mjerenja";
import { KAREPOVAC_PHASES } from "@/lib/karepovac";

/**
 * Kao na pregledu i simulatoru: stranica se slaže pri svakom zahtjevu, a
 * dohvati prema izvorima drže vlastiti rok u predmemoriji podataka. ISR sa
 * `stale-while-revalidate` davao je prvom posjetitelju nakon zatišja kartu
 * s vjetrom od jučer i natpisom „izmjereni u…” — dvije karte istoga kvarta
 * tada nisu pokazivale isti vjetar, nego jedna jučerašnji.
 */
export const revalidate = 0;

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
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-status-u-tijeku-ground sm:mb-5">
              <span className="h-2.5 w-2.5 rounded-full bg-status-u-tijeku-ground" />
              Projekt je u pripremi
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <PrimaryLink href="/karepovac/ukljuci-se">
                Kako se mogu uključiti
              </PrimaryLink>
              {/* Karta pokraj je godišnji prosjek; tko pita „a sada?” treba
                  sat po sat, a to je simulator. */}
              <Link
                href="/karepovac/sim"
                className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-white underline decoration-white/50 decoration-2 underline-offset-4 hover:decoration-white"
              >
                Simulator po satima →
              </Link>
            </div>
          </div>
        </div>
        <PoljeDimaVeliko />
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr] lg:gap-12">
        <SectionHeading title="Zašto baš na nas">
          <p>
            Karta odozgo pokazuje kamo zrak ide, ali ne i ono što svatko tko
            ovdje živi zna nogama: odlagalište stoji iznad kuća. Presjek uz ovo
            pokazuje padinu sa strane — od plohe, preko Dračevca, do Bilica.
          </p>
        </SectionHeading>
        <PresjekPadine />
      </section>

      <section className="space-y-8">
        <SectionHeading title="Što već znamo iz službenih mjerenja">
          <p>
            Naših uređaja još nema, ali jugoistočno od odlagališta dvije
            službene postaje mjere svakoga sata. Skinuli smo sve što su objavile —
            {" "}{H2S_SATI.toLocaleString("hr-HR")} sati sumporovodika i{" "}
            {MERKAPTANI_SATI.toLocaleString("hr-HR")} sati merkaptana — i evo
            što u tome piše.
          </p>
        </SectionHeading>
        <DnevniHod />
        <RuzaMirisa />
        <div className="rounded-xl border border-kamen-tlo bg-kamen-plitko p-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div className="max-w-2xl">
            <p className="text-base leading-7 text-kamen-tekst">
              Obje ruže gore stoje na istoj točki, u udolini jugoistočno od
              plohe — dakle s druge strane odlagališta nego kvart. One bilježe
              sate kad zrak s plohe ide prema Kamenu. Ono što se osjeti u
              kvartu, na suprotnu stranu, ne mjeri nitko — osim ljudi koji
              ondje žive.
            </p>
            <p className="mt-4 text-base leading-7 text-kamen-tekst">
              Zato obrazac za dojavu traži sat, a ne opis. Sat je ono što
              dojavu čini upotrebljivom — s njim se spaja s izmjerenim vjetrom,
              bez njega ostaje priča. Jednako vrijedi i dojava da{" "}
              <strong>nije</strong> smrdjelo: bez nje se ne zna koliko je često
              smrdjelo, nego samo koliko je ljudi stiglo javiti.
            </p>
          </div>
          <div className="mt-4 flex shrink-0 flex-col items-start gap-2 sm:mt-0 sm:items-end">
            <Link
              href="/karepovac/dojava"
              className="fokus inline-flex min-h-11 items-center justify-center rounded-full bg-maslina px-6 py-3 font-semibold text-white hover:bg-maslina-tamna"
            >
              Javite kada je smrdjelo
            </Link>
            {/* Sat bez mirisa vrijedi koliko i sat s mirisom; bez posebnog
                ulaza nitko ga ne javi. */}
            <Link
              href="/karepovac/dojava?smrdi=ne"
              className="fokus inline-flex min-h-11 items-center rounded-md font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
            >
              … ili da nije smrdjelo
            </Link>
          </div>
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
        <div className="rounded-xl border border-status-u-tijeku/20 bg-status-u-tijeku-ground p-6 text-kamen-tinta">
          <h2 className="text-xl font-bold">Provjera na mjerenjima</h2>
          <ul className="mt-5 space-y-4 leading-7">
            <Fact>
              Fizika modela ugođena je na prvoj godini mjerenja H₂S-a i
              provjerena na drugoj, koju model nije vidio. Pogađa slabo, ali
              stvarno — a prije ugađanja nije pogađao ništa: pri tišini je
              perjanicu slao za smjerom s anemometara kilometrima daleko, dok
              se zrak zapravo razlijeva oko plohe.
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
                    ? "w-fit rounded-full bg-status-u-tijeku-ground px-3 py-1 text-xs font-bold text-status-u-tijeku"
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
      <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-1.5 h-4 w-4 shrink-0 text-status-u-tijeku">
        <path d="m4 10 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
