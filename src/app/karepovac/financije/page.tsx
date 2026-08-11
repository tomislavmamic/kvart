import type { Metadata } from "next";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { KAREPOVAC_BUDGET_CATEGORIES } from "@/lib/karepovac";

export const metadata: Metadata = {
  title: "Novac i troškovi",
  description:
    "Ovdje ćemo objaviti koliko je novca prikupljeno, što je kupljeno i koliko je novca preostalo.",
};

export default function FinancijePage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Objavit ćemo koliko je novca prikupljeno i na što je potrošen">
        <p>Još nisu potvrđeni iznos koji želimo prikupiti, cijene opreme ni osoba ili organizacija koja smije primati uplate. Zato ne prikazujemo izmišljeni cilj ni napredak prikupljanja.</p>
      </PageIntro>

      <PreparationNotice />

      <section className="grid gap-6 sm:grid-cols-3">
        <StatusCell label="Tko prima uplate" value="Nije potvrđen" />
        <StatusCell label="Koliko želimo prikupiti" value="Nije utvrđen" />
        <StatusCell label="Koliko je prikupljeno" value="Ne prati se" />
      </section>

      <section>
        <SectionHeading title="Što moramo platiti">
          <p>Iznose ćemo objaviti nakon što provjerimo cijene, potrebne količine, trošak umjeravanja i kasnijeg održavanja. Nije dovoljno navesti samo cijenu senzora.</p>
        </SectionHeading>
        <div className="mt-7 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          {KAREPOVAC_BUDGET_CATEGORIES.map((category, index) => (
            <div
              key={category.id}
              className={`grid grid-cols-[1fr_auto] items-center gap-4 p-5 sm:p-6 ${
                index > 0 ? "border-t border-kamen-tlo" : ""
              }`}
            >
              <span className="font-medium leading-6 text-kamen-tinta">
                {category.label}
              </span>
              <span className="rounded-full bg-kamen-plitko px-3 py-1.5 text-xs font-bold text-kamen-drugi">
                Iznos nije potvrđen
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <SectionHeading title="Pregled uplata i troškova">
          <p>Kada donacije budu otvorene, uz svaki trošak koji smijemo javno prikazati navest ćemo datum, svrhu, skupinu troška, iznos i pripadajući dokument. Imena donatora nećemo objavljivati bez njihove posebne privole.</p>
        </SectionHeading>
        <div className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <div className="grid grid-cols-[1fr_auto] bg-kamen-plitko px-5 py-3 text-sm font-bold text-kamen-drugi">
            <span>Trošak</span>
            <span>Iznos</span>
          </div>
          <div className="px-5 py-12 text-center">
            <p className="font-bold text-kamen-tinta">Još nema troškova</p>
            <p className="mt-2 leading-7 text-kamen-drugi">
              Još nema zabilježenih troškova. Pregled ćemo početi voditi kada bude poznato tko vodi projekt i kada proračun bude odobren.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-kamen-tlo bg-white p-5">
      <p className="text-base font-medium text-kamen-drugi">{label}</p>
      <p className="mt-2 text-lg font-bold text-kamen-tinta">{value}</p>
    </div>
  );
}
