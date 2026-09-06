import Link from "next/link";

import {
  PageIntro,
  PreparationNotice,
  SectionHeading,
} from "@/components/karepovac/project-components";
import {
  BUDGET_ESTIMATE_LABEL,
  KAREPOVAC_BUDGET_CATEGORIES,
} from "@/lib/karepovac";
import { createPageMetadata } from "@/lib/metadata";
import {
  cijenaFaze,
  PRIJEDLOZI_POSTAJA,
  ZAHTJEV_URL,
} from "@/lib/sim/prijedlozi-postaja";
import { eur, FAZE, NAZIV_FAZE } from "@/lib/ukljuci-se";

export const metadata = createPageMetadata({
  title: "Novac i troškovi",
  description:
    "Okvirna procjena opreme za predložene postaje stoji ovdje; cilj prikupljanja, primatelj uplata i troškovi izvan opreme još ne postoje. Kad budu, ovdje ćemo objaviti što je prikupljeno i na što je potrošeno.",
});

/** Zbroj svih faza; ista aritmetika kao `cijenaFaze`, samo preko cijelog popisa. */
function cijenaSvega(): [number, number] {
  return FAZE.map(cijenaFaze).reduce(
    (z, [od, do_]) => [z[0] + od, z[1] + do_],
    [0, 0] as [number, number],
  );
}

/**
 * Jedna stranica, dvije istine o novcu.
 *
 * Okvirna cijena opreme POSTOJI — po stavci u popisu predloženih postaja
 * (`src/lib/sim/prijedlozi-postaja.ts`), ista koju kartica u simulatoru
 * pokazuje. Cilj prikupljanja, primatelj uplata i troškovi izvan opreme NE
 * postoje. Dosad je stranica govorila samo drugo, pa je tko je u simulatoru
 * vidio „600–1.500 €” ovdje čitao „iznos nije potvrđen” i zaključio da jedna
 * stranica laže. Sad se kaže oboje, svako s imenom.
 *
 * Izvor je popis u kodu, ne #28: #28 je plan iz kojeg je popis izrastao i
 * nosi samo grublje zbrojeve po fazama za kraći popis. Tko klikne izvor mora
 * naći iste brojke koje je ovdje pročitao.
 */
export default function FinancijePage() {
  const ukupno = cijenaSvega();

  return (
    <div className="space-y-14">
      <PageIntro title="Objavit ćemo koliko je novca prikupljeno i na što je potrošen">
        <p>
          Okvirnu cijenu opreme za predložene postaje procijenili smo sami i
          stoji dolje. Iznos koji želimo prikupiti, tko smije primati uplate i
          koliko stoje montaža, umjeravanje i održavanje — to još nije
          utvrđeno. Zato ne prikazujemo cilj ni napredak prikupljanja.
        </p>
      </PageIntro>

      <PreparationNotice />

      <section className="grid gap-6 sm:grid-cols-3">
        <StatusCell label="Tko prima uplate" value="Nije potvrđen" />
        <StatusCell label="Koliko želimo prikupiti" value="Nije utvrđen" />
        <StatusCell label="Koliko je prikupljeno" value="Ne prati se" />
      </section>

      <section aria-labelledby="okvirna-cijena">
        <SectionHeading title="Okvirna cijena opreme">
          <p>
            Sve brojke u ovom odjeljku su okvirna procjena opreme za
            predložene postaje na karti simulatora, bez montaže; nije cilj
            prikupljanja ni ponuda. Procijenjene su po stavci za{" "}
            {PRIJEDLOZI_POSTAJA.length} predloženih postaja u tri faze i zbrojene.
            Ne pokrivaju montažu, umjeravanje, održavanje, vezu ni pričuvu.
          </p>
        </SectionHeading>

        <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-kamen-tlo bg-kamen-tlo sm:grid-cols-4">
          {FAZE.map((faza) => (
            <div key={faza} className="bg-white p-5">
              <dt className="text-base font-medium text-kamen-drugi">{NAZIV_FAZE[faza]}</dt>
              <dd className="mt-2 text-lg font-bold tabular-nums text-kamen-tinta">
                {eur(...cijenaFaze(faza))}
              </dd>
            </div>
          ))}
          <div className="bg-white p-5">
            <dt className="text-base font-medium text-kamen-drugi">sve tri faze</dt>
            <dd className="mt-2 text-lg font-bold tabular-nums text-kamen-tinta">
              {eur(...ukupno)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          {FAZE.map((faza) => (
            <div key={faza}>
              <h3 className="border-b border-kamen-tlo bg-kamen-plitko px-5 py-3 text-base font-bold text-kamen-tinta">
                {NAZIV_FAZE[faza]}
              </h3>
              <ul>
                {PRIJEDLOZI_POSTAJA.filter((s) => s.faza === faza).map((s) => (
                  <li
                    key={s.id}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-4 border-b border-kamen-tlo px-5 py-3 text-base leading-7 last:border-b-0"
                  >
                    <span>
                      <span className="font-semibold text-kamen-tinta">{s.naziv}</span>
                      <span className="text-kamen-drugi"> — {s.mjeri}</span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums text-kamen-tinta">
                      {eur(s.cijena[0], s.cijena[1])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-4 text-base leading-7 text-kamen-tekst">
          Izvor: popis predloženih postaja, s cijenom uz svaku postaju —{" "}
          <Link
            href="/karepovac/sim?pri=1"
            className="fokus rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
          >
            predložena mjesta na karti →
          </Link>
          . Plan iz kojeg je popis izrastao je{" "}
          <a
            href={ZAHTJEV_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="fokus rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
          >
            zahtjev #28 ↗
          </a>
          ; ondje stoje samo grublji zbrojevi po fazama (A 3–6, B 1–2, C 2–10
          tisuća €) za kraći popis, bez postaja na sjeveroistoku, Žnjanu i
          kampusu koje su dodane poslije.
        </p>
      </section>

      <section aria-labelledby="sto-platiti">
        <SectionHeading title="Što moramo platiti">
          <p>
            Iznose ćemo objaviti nakon što provjerimo cijene, potrebne količine,
            trošak umjeravanja i kasnijeg održavanja. Nije dovoljno navesti samo
            cijenu senzora — zato uz svaku skupinu piše je li uopće procijenjena.
          </p>
        </SectionHeading>
        <dl className="mt-7 overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          {KAREPOVAC_BUDGET_CATEGORIES.map((category, index) => (
            <div
              key={category.id}
              className={`p-5 sm:grid sm:grid-cols-[1fr_1.2fr] sm:gap-6 sm:p-6 ${
                index > 0 ? "border-t border-kamen-tlo" : ""
              }`}
            >
              <dt className="font-semibold leading-7 text-kamen-tinta">{category.label}</dt>
              <dd className="mt-1 text-base leading-7 text-kamen-tekst sm:mt-0">
                {BUDGET_ESTIMATE_LABEL[category.estimate ?? "nije"]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12">
        <SectionHeading title="Pregled uplata i troškova">
          <p>Kada donacije budu otvorene, uz svaki trošak koji smijemo javno prikazati navest ćemo datum, svrhu, skupinu troška, iznos i pripadajući dokument. Imena donatora nećemo objavljivati bez njihove posebne privole.</p>
        </SectionHeading>
        <div className="overflow-hidden rounded-xl border border-kamen-tlo bg-white">
          <div className="grid grid-cols-[1fr_auto] bg-kamen-plitko px-5 py-3 text-base font-bold text-kamen-drugi">
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
