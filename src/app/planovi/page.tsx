/**
 * Planovi: ulaz u sve stranice o prostornim planovima — GUP na snazi,
 * prijedlog izmjena i analize onoga što mijenja. Stranice same žive pod
 * /gup i /plan; ovdje je samo kazalo, da ih stanar ne mora tražiti u
 * izborniku „Više”.
 */
import Link from "next/link";

import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Planovi: GUP i njegove izmjene",
  description:
    "Sve o prostornim planovima za Dračevac i Bilice na jednom mjestu: gdje bi i zašto prijedlog izmjena GUP-a zaustavio gradnju, što nacrt izmjena iz 2024. mijenja u kvartu te cijeli tekst plana.",
});

interface Stranica {
  href: string;
  naslov: string;
  opis: string;
  /** Kratka oznaka onoga što se ondje može učiniti. */
  radnja?: string;
}

const SKUPINE: { naslov: string; uvod: string; stranice: Stranica[] }[] = [
  {
    naslov: "Prijedlog izmjena GUP-a",
    uvod: "Grad mijenja GUP. Prijedlog iz travnja 2025. još nije usvojen. Ako se usvoji, na većem bi dijelu kvarta nova gradnja stala do donošenja urbanističkog plana uređenja (UPU).",
    stranice: [
      {
        href: "/gup/zabrana",
        naslov: "Zabrana nove gradnje do donošenja UPU-a",
        opis: "Karta privatnog zemljišta na kojem se bez UPU-a ne bi smjela graditi nova zgrada, s površinom slobodnog zemljišta koje bi to pogodilo.",
        radnja: "Provjeri svoju adresu",
      },
      {
        href: "/gup/analiza",
        naslov: "Zašto bi prijedlog zaustavio gradnju",
        opis: "Analiza: što kažu važeći GUP i zakoni, koliko se u kvartu gradilo s dozvolom i što stanovnici mogu tražiti.",
        radnja: "Pročitaj analizu",
      },
      {
        href: "/plan",
        naslov: "Što nacrt izmjena GUP-a iz 2024. mijenja u kvartu",
        opis: "Promjene namjene prostora u Dračevcu i Bilicama prema nacrtu, uz obrazloženja iz samog nacrta.",
      },
    ],
  },
  {
    naslov: "GUP na snazi",
    uvod: "Generalni urbanistički plan Splita određuje što se na kojoj čestici smije graditi. Na snazi je pročišćeni tekst iz 2014. („Službeni glasnik Grada Splita”, br. 55/14).",
    stranice: [
      {
        href: "/gup",
        naslov: "Split po GUP-u",
        opis: "Koliko je zemljišta po planu već iskorišteno i što se smije graditi na pojedinoj čestici, s kartom čestica za cijeli grad.",
        radnja: "Pronađi česticu",
      },
      {
        href: "/gup/dokument",
        naslov: "GUP: tekst i karte",
        opis: "Cijeli tekst odredbi i svi kartografski prikazi: plan na snazi, izvorni plan iz 2006. i prijedlog iz 2025.",
      },
      {
        href: "/karta?pogled=nacrt-gupa",
        naslov: "GUP na karti kvarta",
        opis: "Namjena prostora prema planu na snazi i prema nacrtu, na karti Dračevca i Bilica.",
      },
    ],
  },
  {
    naslov: "Izvori",
    uvod: "Odakle su podaci i što je Gradu dosad poslano.",
    stranice: [
      {
        href: "/gup/dokument/ppug-2025",
        naslov: "PPUG: prijedlog izmjena iz 2025.",
        opis: "Odredbe, obrazloženje i listovi građevinskih područja u mjerilu 1:5000, na kojima je po česticama ucrtan neuređeni dio koji GUP preuzima.",
      },
      {
        href: "/dokumenti",
        naslov: "Dokumenti",
        opis: "Prostorni planovi, dopisi Gradu Splitu, odgovori i zapisnici važni za kvart.",
      },
      {
        href: "/podaci",
        naslov: "Prostorni podaci",
        opis: "Katalog otvorenih prostornih podataka za kvart: izvori, formati, licence i stanje pristupa.",
      },
    ],
  },
];

export default function PlanoviPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-kamen-tinta">Planovi</h1>
      <p className="mt-3 max-w-3xl text-kamen-tekst">
        Što se u Dračevcu i Bilicama smije graditi, kuda prolaze ceste i koliko prostora ostaje za parkove i škole, određuju
        prostorni planovi, ponajprije Generalni urbanistički plan Splita (GUP). Ovdje su sve naše stranice o njima: od cijelog
        teksta plana do analize predloženih izmjena.
      </p>

      <p className="mt-5 max-w-3xl rounded-xl bg-status-u-tijeku-ground px-4 py-3 text-sm text-status-u-tijeku">
        <strong>Javni poziv za inicijative za izmjene GUP-a otvoren je od 1. listopada do 16. studenoga 2026.</strong> Što
        stanovnici mogu tražiti, piše u{" "}
        <Link href="/gup/analiza#sto-uciniti" className="fokus font-semibold underline">
          analizi zabrane gradnje
        </Link>
        .
      </p>

      {SKUPINE.map((s) => (
        <section key={s.naslov} className="mt-10">
          <h2 className="border-b border-kamen-tlo pb-2 text-xl font-bold text-kamen-tinta">{s.naslov}</h2>
          <p className="mt-2 max-w-3xl text-sm text-kamen-drugi">{s.uvod}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {s.stranice.map((st) => (
              <li key={st.href}>
                <Link
                  href={st.href}
                  className="fokus group flex h-full flex-col rounded-xl border border-kamen-tlo bg-white px-4 py-3.5 transition-colors hover:border-maslina-rub hover:bg-maslina-vez"
                >
                  <span className="font-semibold text-kamen-tinta group-hover:text-maslina-tamna">
                    {/* „UPU-a” se ne lomi na crtici */}
                    {st.naslov.replaceAll("UPU-a", "UPU\u2011a")}
                  </span>
                  <span className="mt-1 flex-1 text-sm text-kamen-tekst">{st.opis}</span>
                  <span className="mt-2 text-sm font-semibold text-maslina">{st.radnja ?? "Otvori"} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
