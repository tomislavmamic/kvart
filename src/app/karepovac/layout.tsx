import Link from "next/link";

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
 */
export default function KarepovacLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative left-1/2 -ml-[50vw] -mt-8 w-screen bg-kamen-tlo pb-16">
      <header className="border-b border-kamen-rub bg-white pt-7">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 pb-5">
          <Link
            href="/karepovac"
            className="fokus flex items-center gap-3 rounded-lg"
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
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
            U pripremi
          </span>
        </div>
        <KarepovacProjectNav />
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-8 sm:pt-10">{children}</div>
    </div>
  );
}
