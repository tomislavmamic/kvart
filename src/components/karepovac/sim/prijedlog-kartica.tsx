"use client";

import {
  cijenaFaze,
  opisPodrucja,
  type PrijedlogPostaje,
  ZAHTJEV_URL,
} from "@/lib/sim/prijedlozi-postaja";

/**
 * Kartica predložene mjerne postaje: što bi mjerila, čime, pošto i zašto baš
 * ondje.
 *
 * Ovo nije stanje zraka nego prijedlog ulaganja, pa kartica izgleda drukčije
 * od kartica situacije (obrub crtkan, kao i oznaka na karti): ništa na njoj
 * ne tvrdi da nešto već mjeri. Cijene su okvirne, za opremu bez montaže, i
 * tako i piše.
 */

const FAZA: Readonly<Record<PrijedlogPostaje["faza"], string>> = {
  A: "faza A — prvo",
  B: "faza B — zatim",
  C: "faza C — po potrebi",
};

function eur(od: number, do_: number): string {
  const f = (n: number) => n.toLocaleString("hr-HR");
  return `${f(od)}–${f(do_)} €`;
}

export function PrijedlogKartica({
  prijedlog,
  naZatvori,
}: {
  prijedlog: PrijedlogPostaje;
  naZatvori: () => void;
}) {
  const [fazaOd, fazaDo] = cijenaFaze(prijedlog.faza);
  return (
    <section
      aria-label="Predložena mjerna postaja"
      // Kartica je dugačka; iznad crte sati smije zauzeti najviše pola
      // zaslona, ostatak se lista unutar nje.
      className="pointer-events-auto max-h-[52vh] w-full overflow-y-auto rounded-lg border border-dashed border-maslina/60 bg-white/92 text-zinc-900 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-maslina-tamna">
            Predložena postaja · {FAZA[prijedlog.faza]}
          </div>
          <h2 className="mt-0.5 text-base font-bold leading-tight">{prijedlog.naziv}</h2>
          <div className="text-[13px] text-zinc-600">{prijedlog.mjesto}</div>
          <div className="text-[13px] text-zinc-700">Mjerila bi: {prijedlog.mjeri}</div>
        </div>
        <button
          type="button"
          onClick={naZatvori}
          aria-label="Zatvori karticu prijedloga"
          className="fokus -mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>

      <dl className="px-3 pt-2 text-[12px] leading-5 text-zinc-800">
        <dt className="font-semibold">Što i kako</dt>
        <dd>
          <ul className="list-disc pl-4">
            {prijedlog.velicine.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </dd>
        <dt className="mt-1.5 font-semibold">Oprema</dt>
        <dd>
          <ul className="list-disc pl-4">
            {prijedlog.oprema.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </dd>
        <dt className="mt-1.5 font-semibold">Okvirna cijena opreme</dt>
        <dd>
          <b>{eur(prijedlog.cijena[0], prijedlog.cijena[1])}</b>
          <span className="text-zinc-500"> · cijela {FAZA[prijedlog.faza].split(" — ")[0]} {eur(fazaOd, fazaDo)}, bez montaže</span>
        </dd>
        <dt className="mt-1.5 font-semibold">Gdje smije stajati</dt>
        <dd>{opisPodrucja(prijedlog)}. Osjenčano područje na karti pokazuje isto.</dd>
        <dt className="mt-1.5 font-semibold">Zašto ovdje</dt>
        <dd>{prijedlog.zasto}</dd>
        <dt className="mt-1.5 font-semibold">Treba dogovoriti</dt>
        <dd>{prijedlog.uvjeti}</dd>
      </dl>

      <div className="mt-2 flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-[12px]">
        <span className="text-zinc-500">Pribadača je prijedlog; vrijedi cijelo osjenčano područje.</span>
        <a
          href={ZAHTJEV_URL}
          target="_blank"
          rel="noreferrer"
          className="fokus -my-2 inline-flex min-h-11 items-center font-semibold text-maslina-tamna underline underline-offset-2 hover:text-maslina-noc"
        >
          Cijeli popis (#28)
        </a>
      </div>
    </section>
  );
}
