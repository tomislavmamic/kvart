import type { Metadata } from "next";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";
import { KAREPOVAC_BUDGET_CATEGORIES } from "@/lib/karepovac";

export const metadata: Metadata = {
  title: "Financije",
  description:
    "Priprema javnog proračuna, cilja prikupljanja i evidencije troškova za mrežu oko Karepovca.",
};

export default function FinancijePage() {
  return (
    <div className="space-y-14">
      <PageIntro title="Svaki trošak mora imati svoje mjesto u zapisniku">
        <p>
          Cilj prikupljanja, primatelj uplata i cijene još nisu potvrđeni. Zato
          ovdje ne prikazujemo nulu, lažni napredak ni okvirni iznos koji bi
          mogao izgledati kao otvorena kampanja.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section className="grid gap-6 sm:grid-cols-3">
        <StatusCell label="Primatelj uplata" value="Nije potvrđen" />
        <StatusCell label="Cilj prikupljanja" value="Nije utvrđen" />
        <StatusCell label="Prikupljeno" value="Ne prati se" />
      </section>

      <section>
        <SectionHeading title="Stavke budućeg proračuna">
          <p>
            Iznosi se objavljuju nakon provjere dobavljača, potrebne količine,
            umjeravanja i troška održavanja — zajedno, ne samo cijena senzora.
          </p>
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
        <SectionHeading title="Javna evidencija trošenja">
          <p>
            Nakon otvaranja prikupljanja, svaki objavljivi trošak imat će datum,
            svrhu, kategoriju, iznos i dokument. Identitet donatora ne objavljuje
            se bez zasebne privole.
          </p>
        </SectionHeading>
        <div className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <div className="grid grid-cols-[1fr_auto] bg-kamen-plitko px-5 py-3 text-sm font-bold text-kamen-drugi">
            <span>Trošak</span>
            <span>Iznos</span>
          </div>
          <div className="px-5 py-12 text-center">
            <p className="font-bold text-kamen-tinta">Još nema evidentiranih troškova</p>
            <p className="mt-2 leading-7 text-kamen-drugi">
              Evidencija počinje kad postoji odgovorna organizacija i odobren
              proračun.
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
      <p className="text-sm font-medium text-kamen-drugi">{label}</p>
      <p className="mt-2 text-lg font-bold text-kamen-tinta">{value}</p>
    </div>
  );
}
