"use client";

import Link from "next/link";

import {
  adresaPomoci,
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
 *
 * Jedina radnja na kartici vodi **unutar** stranice, na `/karepovac/ukljuci-se`
 * s oznakom postaje: tko je pročitao „2 500–4 000 €, faza A” i želi ustupiti
 * dvorište ili platiti, ne smije završiti na GitHubu u novoj kartici bez puta
 * natrag. Prvi plan (#28), iz kojega je popis izrastao, ostaje kao sporedna
 * poveznica — popis je otad dulji od njega.
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
      // Zaglavlje i radnja ne klize: opis se lista između njih, pa „Mogu pomoći”
      // stoji na telefonu vidljivo i kad je kartica dulja od pola zaslona.
      // 45 vh: ispod nje ostaje traka sati, a iznad nje na telefonu stoji
      // samo redak sa satom (kartica situacije se skupi dok je ova otvorena).
      className="pointer-events-auto flex max-h-[45vh] w-full flex-col rounded-lg border border-dashed border-maslina/60 bg-white/92 text-zinc-900 shadow-sm backdrop-blur-sm"
    >
      <div className="flex shrink-0 items-start gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-maslina-tamna">
            Predložena postaja · {FAZA[prijedlog.faza]}
          </div>
          <h2 className="mt-0.5 text-base font-bold leading-tight">{prijedlog.naziv}</h2>
          {/* Cijena odmah pod naslovom: to je molba, i vidi se prije listanja. */}
          <div className="text-[13px] text-zinc-800">
            <b>{eur(prijedlog.cijena[0], prijedlog.cijena[1])}</b>
            <span className="text-zinc-500"> oprema, bez montaže</span>
          </div>
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

      <dl className="min-h-0 overflow-y-auto px-3 pt-2 text-[12px] leading-5 text-zinc-800">
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
        <dd>
          {opisPodrucja(prijedlog)}. Osjenčano područje na karti pokazuje isto.
          {prijedlog.izvanPolja ? (
            <>
              {" "}
              <b>Izvan je polja koje simulator računa</b>, pa bi postaja mjerila,
              ali usporedba s modelom traži šire polje.
            </>
          ) : null}
        </dd>
        <dt className="mt-1.5 font-semibold">Zašto ovdje</dt>
        <dd>{prijedlog.zasto}</dd>
        <dt className="mt-1.5 font-semibold">Treba dogovoriti</dt>
        <dd>{prijedlog.uvjeti}</dd>
      </dl>

      {/* Radnja: mjesto, znanje ili novac za baš ovu postaju. Pilula je
          maslina jer je to jedina radnja na kartici; prvi plan (#28) je za one koji
          žele tehnički tekst. */}
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-zinc-200 px-3 py-2 text-[12px]">
        <span className="text-zinc-500">Pribadača je prijedlog; vrijedi cijelo osjenčano područje.</span>
        <div className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <a
            href={ZAHTJEV_URL}
            target="_blank"
            rel="noreferrer"
            className="fokus -my-2 inline-flex min-h-11 items-center text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            Prvi plan (#28)
          </a>
          <Link
            href={adresaPomoci(prijedlog)}
            className="fokus inline-flex min-h-11 items-center rounded-full bg-maslina px-3.5 text-sm font-semibold text-white hover:bg-maslina-tamna"
          >
            Mogu pomoći s ovom postajom
          </Link>
        </div>
      </div>
    </section>
  );
}
