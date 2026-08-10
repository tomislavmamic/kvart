import type { Metadata } from "next";

import {
  PageIntro,
  PreparationNotice,
  SecondaryLink,
  SectionHeading,
} from "@/components/karepovac/project-components";

export const metadata: Metadata = {
  title: "Uključi se",
  description:
    "Kako ponuditi lokaciju, pomoći opremom ili pratiti pripremu mreže za praćenje zraka oko Karepovca.",
};

export default function UkljuciSePage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Pomozite izgraditi mrežu kojoj se može vjerovati">
        <p>
          Tražit ćemo domaćine postaja, tehničke volontere i donacije za opremu
          i održavanje. Prijave i uplate još nisu otvorene jer prvo moramo
          objaviti tko je odgovoran, kako čuvamo podatke i kamo ide svaki euro.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
          <HostMark />
          <h2 className="mt-8 text-2xl font-bold text-kamen-tinta">
            Ponudite vrt ili balkon
          </h2>
          <p className="mt-4 leading-7 text-kamen-tekst">
            Dobra lokacija ima sigurno napajanje, vezu, strujanje zraka i
            pristup za održavanje. Točna kućna adresa i kontakt neće biti javni.
          </p>
          <h3 className="mt-7 font-bold text-kamen-tinta">Prije prijave objavljujemo</h3>
          <ul className="mt-3 space-y-3 text-kamen-tekst">
            <Check>obavijest o privatnosti i privolu;</Check>
            <Check>dogovor o pristupu, opremi i povlačenju postaje;</Check>
            <Check>pravila izbora lokacija i grubo javno pozicioniranje.</Check>
          </ul>
          <button
            type="button"
            disabled
            className="mt-8 min-h-11 w-full cursor-not-allowed rounded-full bg-kamen-rub px-5 py-3 font-semibold text-kamen-drugi"
          >
            Prijave domaćina uskoro
          </button>
        </article>

        <article className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
          <DonationMark />
          <h2 className="mt-8 text-2xl font-bold text-kamen-tinta">
            Pomozite kupiti i održavati opremu
          </h2>
          <p className="mt-4 leading-7 text-kamen-tekst">
            Donacijska poveznica bit će aktivna tek kad navedemo zakonitog
            primatelja, cilj, proračun, uvjete i način javnog izvještavanja o
            troškovima.
          </p>
          <h3 className="mt-7 font-bold text-kamen-tinta">Na stranici će biti vidljivo</h3>
          <ul className="mt-3 space-y-3 text-kamen-tekst">
            <Check>koliko se prikuplja i za koje stavke;</Check>
            <Check>što je naručeno, plaćeno i preostalo;</Check>
            <Check>računi i potvrde prikladni za javnu objavu.</Check>
          </ul>
          <button
            type="button"
            disabled
            className="mt-8 min-h-11 w-full cursor-not-allowed rounded-full bg-kamen-rub px-5 py-3 font-semibold text-kamen-drugi"
          >
            Donacije još nisu otvorene
          </button>
        </article>
      </section>

      <section className="rounded-xl bg-maslina-vez p-6 sm:p-8">
        <SectionHeading title="Možete pomoći i prije nabave">
          <p>
            Korisni su iskustvo s elektrokemijskim senzorima, elektronikom,
            LoRa/Wi-Fi vezom, kućištima na otvorenom, meteorologijom, obradom
            podataka, privatnošću i terenskim održavanjem.
          </p>
        </SectionHeading>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://github.com/tomislavmamic/kvart/issues/12"
            target="_blank"
            rel="noopener noreferrer"
            className="fokus inline-flex min-h-11 items-center justify-center rounded-lg border border-maslina-rub bg-white px-5 py-2.5 font-semibold text-maslina-tamna hover:bg-emerald-50"
          >
            Pratite i komentirajte plan ↗
          </a>
          <SecondaryLink href="/karepovac/metodologija">
            Pročitajte metodologiju
          </SecondaryLink>
        </div>
      </section>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 leading-6">
      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-maslina" />
      <span>{children}</span>
    </li>
  );
}

function HostMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-14 w-14 text-maslina">
      <path d="M10 31 32 14l22 17v23H10V31Z" fill="#ecfdf5" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M25 54V38h14v16M46 25v-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 12c4-4 8 4 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DonationMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="h-14 w-14 text-maslina">
      <path d="M11 24h42v31H11V24Z" fill="#ecfdf5" stroke="currentColor" strokeWidth="3" />
      <path d="M18 24c1-9 7-14 14-14s13 5 14 14M23 36h18M23 44h12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
