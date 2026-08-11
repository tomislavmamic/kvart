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
    "Saznajte kako možete ponuditi mjesto za mjernu postaju, pomoći znanjem ili pratiti pripremu donacija za opremu.",
};

export default function UkljuciSePage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Pomozite nam postaviti prve mjerne postaje">
        <p>
          Tražit ćemo stanovnike koji mogu ustupiti mjesto za postaju, ljude koji
          se razumiju u opremu i one koji žele pomoći donacijom. Prijave i uplate
          još nisu otvorene. Prvo moramo objaviti tko vodi projekt, kako čuvamo
          osobne podatke i kako ćemo prikazivati troškove.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
          <HostMark />
          <h2 className="mt-8 text-2xl font-bold text-kamen-tinta">
            Ponudite mjesto u vrtu ili na balkonu
          </h2>
          <p className="mt-4 leading-7 text-kamen-tekst">
            Mjesto treba imati sigurno napajanje, podatkovnu vezu, slobodno
            strujanje zraka i pristup radi održavanja. Kućnu adresu i kontakt
            nećemo javno objaviti.
          </p>
          <h3 className="mt-7 font-bold text-kamen-tinta">
            Prije otvaranja prijava objavit ćemo
          </h3>
          <ul className="mt-3 space-y-3 text-kamen-tekst">
            <Check>obavijest o tome koje podatke prikupljamo i zašto;</Check>
            <Check>
              dogovor o pristupu postaji, vlasništvu opreme i uklanjanju postaje;
            </Check>
            <Check>
              pravila prema kojima ćemo birati mjesta i prikazivati približne
              lokacije.
            </Check>
          </ul>
          <button
            type="button"
            disabled
            className="mt-8 min-h-11 w-full cursor-not-allowed rounded-full bg-kamen-rub px-5 py-3 font-semibold text-kamen-drugi"
          >
            Prijave još nisu otvorene
          </button>
        </article>

        <article className="rounded-xl border border-kamen-tlo bg-white p-6 sm:p-8">
          <DonationMark />
          <h2 className="mt-8 text-2xl font-bold text-kamen-tinta">
            Pomozite nam kupiti i održavati opremu
          </h2>
          <p className="mt-4 leading-7 text-kamen-tekst">
            Poveznicu za donacije objavit ćemo tek kada bude jasno tko smije
            primati uplate, koliko želimo prikupiti i kako ćemo prikazati svaki
            trošak.
          </p>
          <h3 className="mt-7 font-bold text-kamen-tinta">
            Prije otvaranja donacija objavit ćemo
          </h3>
          <ul className="mt-3 space-y-3 text-kamen-tekst">
            <Check>koliko želimo prikupiti i što ćemo tim novcem platiti;</Check>
            <Check>što je naručeno, što je plaćeno i koliko je novca ostalo;</Check>
            <Check>račune i potvrde koje smijemo javno objaviti.</Check>
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
        <SectionHeading title="Kako možete pomoći već sada">
          <p>
            Već sada možete pomoći znanjem o senzorima, elektronici, LoRa ili
            Wi-Fi vezi, kućištima za vanjsku uporabu, vremenskim podacima,
            obradi mjerenja i održavanju opreme.
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
