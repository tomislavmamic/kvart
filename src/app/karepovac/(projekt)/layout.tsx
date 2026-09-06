import Link from "next/link";

import { PreparationBadge } from "@/components/karepovac/project-components";
import { KarepovacProjectNav } from "@/components/karepovac/project-nav";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Praćenje zraka oko Karepovca",
  description:
    "Pratite pripremu mjernih postaja, metodologiju, podatke i načine uključivanja.",
});

/**
 * THESIS: javna mjerna ploča počinje poštenim praznim stanjem, ne lažnim nadzornim centrom.
 * OWN-WORLD: papir, kamen, maslina za radnju; zapisi, tanke mrežne crte i jasne oznake izvora.
 * STORY: susjed razumije što postoji, što još ne postoji i kako može pomoći da mreža nastane.
 * FIRST VIEWPORT: status i objašnjenje lijevo, mirno polje s pinom Karepovca i dvije prazne evidencije desno.
 * FORM: javni zapisnik unutar postojećeg svijeta „Zemljovid i zapisnik”.
 * MJESTO: projekt praćenja zraka; u njega se ulazi s pregleda na /karepovac.
 *
 * Zaglavlje na mobitelu: povratak i značka u prvom redu, ime projekta u
 * drugom, traka u trećem — tri niska reda umjesto jednog širokog, jer na
 * 390 px povratak, značka i ime ne stanu jedno uz drugo, a povratak na
 * pregled ne smije biti skriven na platformi na kojoj je primarni čitatelj.
 */
export default function KarepovacLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative left-1/2 -ml-[50vw] -mt-8 w-screen bg-kamen-tlo pb-16">
      <header className="border-b border-kamen-rub bg-white pt-2 sm:pt-7">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 sm:flex-nowrap sm:justify-between sm:pb-5">
          <div className="order-1 flex w-full items-center justify-between gap-3 sm:order-2 sm:w-auto sm:justify-end">
            <Link
              href="/karepovac"
              className="fokus inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-kamen-drugi underline decoration-kamen-rub decoration-2 underline-offset-4 hover:text-kamen-tinta"
            >
              ← Sve što pratimo
            </Link>
            <PreparationBadge />
          </div>
          <Link
            href="/karepovac/zrak"
            className="fokus order-2 flex items-center gap-3 rounded-lg sm:order-1"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-maslina-vez text-maslina">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
                <path d="M5 14c3-3 6 3 9 0s5-2 7-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="8" cy="8" r="3.5" fill="currentColor" />
                <path d="m8 15-2.5-5h5L8 15Z" fill="currentColor" />
                <circle cx="8" cy="8" r="1.1" fill="white" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold text-kamen-tinta">
                Praćenje zraka
              </span>
              <span className="block text-sm text-kamen-drugi">oko Karepovca</span>
            </span>
          </Link>
        </div>
        <KarepovacProjectNav />
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-6 sm:pt-10">{children}</div>
    </div>
  );
}
