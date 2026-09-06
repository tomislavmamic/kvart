"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import type { Ljestvica } from "@/lib/dim";
import type { Kadar } from "@/lib/sim/kadrovi";
import {
  danMjesno,
  istiDan,
  natpisZastarjele,
  opisIzvoraSata,
  opisIzvoraSataKratko,
  oznakaSata,
  razmakSati,
  satMjesno,
  zastarjela,
} from "@/lib/sim/oznaka-sata";
import {
  podnaslov,
  RIJECI_POUZDANOSTI,
  RIJECI_RAZINA,
  RIJECI_TRENDA,
  stupanj,
  type Razina,
  type Situacija,
} from "@/lib/sim/situacija";
import { adresaDojaveZaSat } from "@/lib/sim/tocka";
import type { SatniVjetar } from "@/lib/sim/vrijeme-satno";
import type { Postaja, Vjetar } from "@/lib/vjetar";
import { bojaRazine } from "@/components/karepovac/sim/razina-boje";

/**
 * Kartica situacije: ono što karta mora reći u pet sekundi.
 *
 * Redoslijed je redoslijed pitanja: **kad** (dan, sat i je li to sada,
 * prije ili prognoza — prema satu gledatelja), **koliko** (razina, velikim
 * slovima i bojom), **gdje** (naselja koja perjanica dotiče), **kamo ide**
 * (strelica), **bolje ili gore** (trend), **koliko ste sigurni** (pouzdanost,
 * uz „zašto?” koji otvara razloge) i **kad se mijenja** (sljedeći sat s
 * drugom razinom). Ispod, čitljivo (Dense, 0,875 rem): odakle je vjetar koji
 * vodi kartu i **koliko je to očitanje staro** — jedina mjera po kojoj
 * stanovnik razlikuje „tišina, izmjereno prije 5 min” od „tišina od jučer”.
 * Uz to jedina radnja kartice: javiti miris za sat koji se gleda. Legenda
 * stoji sitno u zadnjem retku, a postavke iza gumba „Više”.
 *
 * Tri pravila prikaza koja se ne daju zaobići:
 *
 * - **„Sada” je sada gledatelja.** Riječ uz sat računa se prema satu na
 *   zidu (`oznaka-sata.ts`), ne prema oznaci koju je poslužitelj stavio na
 *   kadar. Kad je crta starija od sata, kartica kaže od kada su podaci i da
 *   se osvježava; „sada” uz prošli sat ne piše nikad.
 * - **„Ne znamo” nije „čisto”.** Kad je pouzdanost niska, a perjanica ne
 *   dotiče naselja, kartica ne kaže „nema mirisa” nego da se ne zna — i
 *   kaže isti razlog koji stoji iza „zašto?” (`podnaslov` u situacija.ts).
 * - **Riječi i boje su iste kao na karti i traci** (`razina-boje.ts`);
 *   legenda pri dnu ponavlja iste tri riječi da se karta dade čitati.
 */

/** Naslov po razini, u obliku koji stoji sam: „Moguć miris”, ne „moguće miris”. */
const NASLOV: Readonly<Record<Exclude<Razina, "nema">, string>> = {
  moguce: "Moguć miris",
  slabo: "Slab miris",
  osjetno: "Osjetan miris",
  jako: "Jak miris",
};

export type Osvjezavanje = "mirno" | "u tijeku" | "greska";

/**
 * Je li kartica na telefonu raširena — pamti se za sjednicu.
 *
 * Karta mora pri otvaranju držati 80 % zaslona, pa kartica na telefonu kreće
 * skupljena (sat, izvor, naslov) i širi se na dodir. Tko je jednom raširi,
 * zatječe je raširenu i nakon sljedećeg otvaranja u istoj sjednici.
 * `useSyncExternalStore` umjesto učinka: poslužitelj i hidracija vide
 * „skupljeno”, a preglednik odmah zatim pročita zapamćeno bez upozorenja
 * o neslaganju. Bez `sessionStorage` (privatni način) ostaje pamćenje u
 * memoriji za trajanja stranice.
 */
const KLJUC_PROSIRENE = "karepovac-sim-kartica-prosirena";
let prosirenaUMemoriji: boolean | null = null;
const slusaci = new Set<() => void>();
function citajProsirenu(): boolean {
  if (prosirenaUMemoriji !== null) return prosirenaUMemoriji;
  try {
    return window.sessionStorage.getItem(KLJUC_PROSIRENE) === "1";
  } catch {
    return false;
  }
}
function zapisiProsirenu(vrijednost: boolean): void {
  prosirenaUMemoriji = vrijednost;
  try {
    window.sessionStorage.setItem(KLJUC_PROSIRENE, vrijednost ? "1" : "0");
  } catch {
    // Bez pohrane: pamćenje u memoriji je dovoljno za ovu stranicu.
  }
  for (const s of slusaci) s();
}
function pretplatiProsirenu(s: () => void): () => void {
  slusaci.add(s);
  return () => {
    slusaci.delete(s);
  };
}

function Strelicica({ gore }: { gore: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
      <path
        d={gore ? "M5 12.5 10 7.5l5 5" : "M5 7.5l5 5 5-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Plocica({ razina, ljestvica, velika = false }: { razina: Razina; ljestvica: Ljestvica; velika?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ring-1 ring-black/10 ${velika ? "h-5 w-5" : "h-2.5 w-2.5"}`}
      style={{ backgroundColor: bojaRazine(razina, ljestvica) }}
    />
  );
}

function Strelica({ azimut }: { azimut: number }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <g transform={`rotate(${azimut} 10 10)`}>
        <path d="M10 2.5 L14 12 L10 10 L6 12 Z" fill="currentColor" />
        <path d="M10 9v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function IkonaTrenda({ trend }: { trend: Situacija["trend"] }) {
  if (trend === "nepoznato") return <span aria-hidden="true" className="text-zinc-400">·</span>;
  const kut = trend === "gore" ? -35 : trend === "bolje" ? 35 : 0;
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" aria-hidden="true">
      <g transform={`rotate(${kut} 10 10)`}>
        <path d="M3 10h13M12 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function broj(x: number, decimala = 1): string {
  return x.toFixed(decimala).replace(".", ",");
}

export function SituacijaKartica({
  situacija,
  kadar,
  izracunat,
  ljestvica,
  prijedlozi = false,
  sadaStvarno,
  crtaSada,
  osvjezavanje = "mirno",
  sadaOcitanja = [],
  serije = new Map(),
  napomena = null,
  osvjezavaSat = false,
  sazeta = false,
  pocetnoProsirena,
  naOsvjezi,
  naVise,
  plocaOtvorena,
}: {
  situacija: Situacija;
  kadar: Kadar | null;
  /** Je li radnik sliku za ovaj sat već isporučio. */
  izracunat: boolean;
  /** Ljestvica tvari koja se gleda; iz nje su boje pločica. */
  ljestvica: Ljestvica;
  /** Jesu li na karti predložene postaje; tada legenda objašnjava točke. */
  prijedlozi?: boolean;
  /** Sat gledatelja; sve riječi o vremenu idu prema njemu. */
  sadaStvarno: Date;
  /** `Crta.sada`: sat za koji je crta složena, da se vidi je li stara. */
  crtaSada: string;
  /** Što se s osvježavanjem crte događa, kad je stara. */
  osvjezavanje?: Osvjezavanje;
  /** Trenutačna očitanja postaja, za trenutak i starost vjetra. */
  sadaOcitanja?: readonly Vjetar[];
  /** Satni nizovi po postaji, ako su stigli. */
  serije?: ReadonlyMap<Postaja, ReadonlyMap<string, SatniVjetar>>;
  /** Jednokratna poruka, npr. da sat iz podijeljene adrese više nije na crti. */
  napomena?: string | null;
  /** Sat se računa iznova s novijim vjetrom; stara slika je još na zaslonu. */
  osvjezavaSat?: boolean;
  /** Na telefonu samo redak sa satom (dok je otvorena kartica postaje). */
  sazeta?: boolean;
  /** Ručno osvježavanje kad automatsko nije uspjelo. */
  naOsvjezi?: () => void;
  /** Raširenost na telefonu neovisno o pamćenju (provjere). */
  pocetnoProsirena?: boolean;
  naVise: () => void;
  plocaOtvorena: boolean;
}) {
  const [zasto, postaviZasto] = useState(false);
  const zapamcena = useSyncExternalStore(pretplatiProsirenu, citajProsirenu, () => false);
  const prosirena = pocetnoProsirena ?? zapamcena;
  if (!kadar) return null;
  // Na telefonu skupljena: pri otvaranju, ili dok je otvorena kartica mjesta
  // ili postaje. Na širokom zaslonu uvijek puna (razredi `sm:`).
  const skupljena = sazeta || !prosirena;

  const nedostupan = kadar.dostupnost === "nedostupno";
  const zahvacena = situacija.podrucja.filter((p) => p.razina !== "nema");
  const nesigurno = situacija.pouzdanost === "niska";
  // Prognoza prema satu gledatelja, ne prema oznaci s kadra.
  const prognoza = razmakSati(kadar.sat, sadaStvarno) < 0;
  const oznaka = oznakaSata(kadar, sadaStvarno);
  const stara = zastarjela(crtaSada, sadaStvarno);

  let naslov: string;
  let podnaslovKartice: string | null = null;
  let razinaNaslova: Razina = situacija.razina;
  if (nedostupan) {
    naslov = "Nema podataka o vjetru";
    podnaslovKartice = "Za ovaj sat nijedan izvor nije javio vjetar, pa se perjanica ne može izračunati.";
    razinaNaslova = "nema";
  } else if (!izracunat) {
    naslov = "Računam ovaj sat…";
    podnaslovKartice = "Perjanica stiže za koju sekundu.";
    razinaNaslova = "nema";
  } else if (situacija.razina === "nema") {
    naslov = nesigurno ? "Ne znamo pouzdano" : "Nema naznaka mirisa u naseljima";
    podnaslovKartice = podnaslov(situacija, kadar);
  } else {
    naslov = NASLOV[situacija.razina];
    podnaslovKartice = null;
  }

  const v = kadar.vjetar;
  const promjena = situacija.promjena;
  const promjenaRijec =
    promjena && (stupanj(promjena.razina) < stupanj(situacija.razina) ? "slabije" : "jače");
  const izvorRecenica = opisIzvoraSata(kadar, sadaOcitanja, serije, sadaStvarno);
  const zastarjeloNatpis = stara ? natpisZastarjele(crtaSada, sadaStvarno, osvjezavanje) : null;
  // Čitaču zaslona bez glagola: glagol se mijenja pri svakom pokušaju.
  const zastarjeloZaCitac = stara ? natpisZastarjele(crtaSada, sadaStvarno, null) : null;

  return (
    <section
      aria-label="Situacija za odabrani sat"
      // Bez gornje granice visine i bez unutarnjeg listanja: kartica koja
      // kaže manje bolja je od kartice koja skriva što kaže (na iOS-u se
      // unutarnji klizač ne vidi). Visina se štedi sadržajem — legenda samo
      // na širokom zaslonu, rečenica o izvoru u jednom retku ispod sata.
      className="pointer-events-auto w-full rounded-xl bg-white/92 shadow-md ring-1 ring-black/5 backdrop-blur-sm"
    >
      {/* Čitaču zaslona jedna rečenica po satu, ista bez obzira na to je li
          kartica skupljena: naslov se mijenja i s tipkovnicom i s
          reprodukcijom, a slider javlja samo sat. */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {`${satMjesno(kadar.sat)}, ${danMjesno(kadar.sat)}, ${nedostupan ? "nema podataka" : oznaka}: ${naslov.toLowerCase()}, pouzdanost ${
          RIJECI_POUZDANOSTI[situacija.pouzdanost]
        }${zastarjeloZaCitac ? `. ${zastarjeloZaCitac}` : ""}`}
      </p>

      {/* Skupljena kartica (samo telefon): sat, „sada”, izvor i naslov u
          jednom bloku od ~58 px, da karta pri otvaranju drži 80 % zaslona.
          Ono što je za povjerenje nužno ostaje i ovdje: kad, odakle, što —
          i obavijest o staroj crti. */}
      <div className={skupljena ? "px-3.5 pb-1.5 pt-1.5 sm:hidden" : "hidden"}>
        <p className="truncate text-sm leading-5 text-zinc-600">
          <span className="font-semibold tabular-nums text-zinc-900">{satMjesno(kadar.sat)}</span>{" "}
          {!istiDan(kadar.sat, sadaStvarno) ? <span>{danMjesno(kadar.sat)} </span> : null}
          <span className={prognoza ? "font-semibold text-status-poslano" : "font-semibold text-zinc-800"}>{oznaka}</span>
          {" · "}
          {opisIzvoraSataKratko(kadar, sadaOcitanja, serije)}
          {osvjezavaSat ? <span className="text-status-ceka"> · osvježavam</span> : null}
        </p>
        {zastarjeloNatpis ? (
          <p className="mt-0.5 rounded bg-status-u-tijeku-ground px-2 py-0.5 text-sm font-semibold leading-5 text-status-u-tijeku">
            {zastarjeloNatpis}
          </p>
        ) : null}
        <div className="mt-0.5 flex items-center gap-2">
          <Plocica razina={razinaNaslova} ljestvica={ljestvica} velika />
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold leading-6 text-zinc-900">{naslov}</h2>
          {!sazeta ? (
            <button
              type="button"
              onClick={() => zapisiProsirenu(true)}
              aria-expanded={false}
              aria-label="Više o ovom satu"
              className="fokus -my-2.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Strelicica gore={false} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Puna kartica: uvijek na širokom zaslonu, na telefonu na zahtjev. */}
      <div className={skupljena ? "hidden sm:contents" : "contents"}>
      <div className="px-3.5 pt-1.5">
        {/* Kad: sat (i dan, kad nije današnji), pa je li to sada, prije ili
            prognoza — prema satu gledatelja. Dense (0,875 rem): ovo je
            rečenica koja nosi značenje, ne ukras. „Postavke” stoji na desnom
            kraju istog retka, da ne troši svoj. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-5 text-zinc-600">
          <span className="font-semibold tabular-nums text-zinc-900">{satMjesno(kadar.sat)}</span>
          {!istiDan(kadar.sat, sadaStvarno) ? <span>{danMjesno(kadar.sat)}</span> : null}
          <span
            className={
              prognoza
                ? "font-semibold text-status-poslano"
                : oznaka === "sada"
                  ? "font-semibold text-zinc-900"
                  : "font-semibold text-zinc-700"
            }
          >
            — {oznaka}
          </span>
          {!prognoza && situacija.izvorVjetra === "model" ? (
            <span
              className="rounded bg-status-ceka-ground px-1.5 py-px text-xs font-semibold text-status-ceka"
              title="Nijedna postaja nije javila vjetar; uzet je iz modela."
            >
              vjetar iz modela
            </span>
          ) : null}
          {osvjezavaSat ? (
            // Sat se računa iznova s novijim vjetrom; stara slika ostaje dok
            // nova ne stigne, pa se naslov ne mijenja — samo ova oznaka.
            <span className="rounded bg-status-ceka-ground px-1.5 py-px text-xs font-semibold text-status-ceka">
              osvježavam
            </span>
          ) : null}
          {/* Postavke po imenu: „Više” nije govorilo što otvara. Na telefonu
              je ovo jedini put do ploče (gornja pilula ondje ne postoji). */}
          <button
            type="button"
            onClick={naVise}
            aria-expanded={plocaOtvorena}
            className="fokus -my-2 ml-auto min-h-11 min-w-11 rounded px-2.5 font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {plocaOtvorena ? "Zatvori postavke" : "Postavke"}
          </button>
          <button
            type="button"
            onClick={() => zapisiProsirenu(false)}
            aria-expanded
            aria-label="Manje o ovom satu"
            className="fokus -my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:hidden"
          >
            <Strelicica gore />
          </button>
        </div>
        {/* Odakle je vjetar i koliko je staro očitanje — to *jest* „kad”, pa
            stoji odmah ispod sata, u jednom retku (Dense). Brzina kratko;
            smjer već kaže „nosi prema …” dolje. */}
        <p className="text-sm leading-5 text-zinc-600">
          {v ? (
            v.tisina ? (
              <>
                <b className="text-zinc-800">tišina</b> · {izvorRecenica}
              </>
            ) : (
              <>
                {izvorRecenica} · <b className="text-zinc-800">{broj(v.brzina)} m/s</b>
              </>
            )
          ) : (
            "vjetar nije poznat"
          )}
        </p>
        {zastarjeloNatpis ? (
          // Stara crta: nikad „sada” uz prošli sat. Ovo je i poruka i
          // obećanje, pa kaže što se s osvježavanjem događa — a kad ne uspije,
          // to je gumb: neuspjeh bez ičega za pritisnuti ostavlja čovjeka
          // s pitanjem što sad.
          osvjezavanje === "greska" && naOsvjezi ? (
            <button
              type="button"
              onClick={naOsvjezi}
              className="fokus mt-0.5 min-h-11 w-full rounded bg-status-u-tijeku-ground px-2 py-1 text-left text-sm font-semibold leading-5 text-status-u-tijeku hover:bg-status-u-tijeku-ground/70"
            >
              {zastarjeloNatpis} · <span className="underline underline-offset-2">pokušaj opet</span>
            </button>
          ) : (
            <p className="mt-0.5 rounded bg-status-u-tijeku-ground px-2 py-1 text-sm font-semibold leading-5 text-status-u-tijeku">
              {zastarjeloNatpis}
            </p>
          )
        ) : null}
      </div>

      <div className="px-3.5">
        {napomena ? (
          <p className="mt-0.5 text-sm leading-5 text-zinc-600">{napomena}</p>
        ) : null}

        {/* Koliko: jedna riječ, jedna boja. */}
        <div className="mt-1 flex items-center gap-2.5">
          <Plocica razina={razinaNaslova} ljestvica={ljestvica} velika />
          <h2 className="text-lg font-bold leading-6 text-zinc-900">{naslov}</h2>
        </div>
        {/* Rečenica koju stanovnik čita: 1rem, ne gusto (Reading-Size Rule). */}
        {podnaslovKartice ? <p className="mt-0.5 text-base leading-6 text-zinc-700">{podnaslovKartice}</p> : null}

        {/* Gdje: naselja koja perjanica dotiče, od najjačeg. */}
        {zahvacena.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {[...zahvacena]
              .sort((a, b) => stupanj(b.razina) - stupanj(a.razina) || b.zahvacenost - a.zahvacenost)
              .map((p) => (
                <li
                  key={p.podrucje.id}
                  className="flex items-center gap-1.5 text-sm leading-5 text-zinc-800"
                  title={`Perjanica pokriva oko ${Math.round(p.zahvacenost * 100)} % naselja`}
                >
                  <Plocica razina={p.razina} ljestvica={ljestvica} />
                  <span className="font-semibold">{p.podrucje.naziv}</span>
                  <span className="text-zinc-500">{RIJECI_RAZINA[p.razina]}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      {/* Kamo, bolje ili gore, kad se mijenja. */}
      <dl className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-zinc-200/80 px-3.5 pt-1 text-xs leading-5 text-zinc-700">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Kamo nosi</dt>
          <dd className="flex items-center gap-1.5">
            {situacija.nosi ? (
              <>
                <Strelica azimut={situacija.nosi.azimut} />
                <span>nosi {situacija.nosi.opis}</span>
              </>
            ) : (
              <span className="text-zinc-500">{v?.tisina ? "tišina, ne nosi nikamo" : "smjer nije poznat"}</span>
            )}
          </dd>
        </div>
        {/* Trend na uskom zaslonu ustupa mjesto sljedećoj promjeni kad je
            ima: „oko 23 h: jače” već kaže kamo ide. */}
        <div className={`items-center gap-1.5 ${promjena && promjenaRijec ? "hidden sm:flex" : "flex"}`}>
          <dt className="sr-only">Trend</dt>
          <dd className="flex items-center gap-1.5">
            <IkonaTrenda trend={situacija.trend} />
            <span>{RIJECI_TRENDA[situacija.trend]}</span>
          </dd>
        </div>
        {promjena && promjenaRijec ? (
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Sljedeća promjena</dt>
            <dd>
              oko {satMjesno(promjena.sat).slice(0, 2)} h: <b className="text-zinc-900">{promjenaRijec}</b>{" "}
              <span className="text-zinc-500">({RIJECI_RAZINA[promjena.razina]})</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {/* Koliko sigurno — i radnja, desno, u istom retku: pouzdanost i pilula
          stanu jedno uz drugo i na 390 px, pa pilula ne troši svoj redak. */}
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-0.5 px-3.5 pb-1 text-xs leading-5 text-zinc-700">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Pouzdanost</dt>
          <dd className="flex items-center gap-1">
            <span>
              pouzdanost{" "}
              {/* Riječ nosi značenje sama; boja izvan palete (jantar) bi
                  glumila upozorenje koje sustav boja ne poznaje. */}
              <b className={nesigurno ? "text-zinc-900 underline decoration-dotted underline-offset-2" : "text-zinc-900"}>
                {RIJECI_POUZDANOSTI[situacija.pouzdanost]}
              </b>
            </span>
            <button
              type="button"
              onClick={() => postaviZasto((z) => !z)}
              aria-expanded={zasto}
              className="fokus -my-2 min-h-11 rounded px-1.5 font-semibold text-maslina underline decoration-dotted underline-offset-2 hover:bg-maslina-vez"
            >
              zašto?
            </button>
          </dd>
        </div>
        <div className="ml-auto flex items-center">
          <dt className="sr-only">Dojava</dt>
          <dd>
            {/* Jedina radnja kartice: model tvrdi, nos provjerava. Sat koji
                se gleda putuje s dojavom, bez mjesta — obrazac ga pita. Bez
                predučitavanja: na mobilnim podacima ne skida se stranica koju
                većina neće otvoriti. Kratak natpis (1 rem) da stane uz
                pouzdanost; cijela rečenica ide čitaču zaslona. */}
            <Link
              href={adresaDojaveZaSat(kadar.sat)}
              prefetch={false}
              aria-label={
                situacija.razina === "nema" || !izracunat
                  ? "Osjećate miris? Javite ga za ovaj sat"
                  : "Javite je li tako kod vas, za ovaj sat"
              }
              className="fokus inline-flex min-h-11 items-center rounded-full bg-maslina px-3.5 text-base font-semibold text-white hover:bg-maslina-tamna"
            >
              {situacija.razina === "nema" || !izracunat ? "Javi miris" : "Javi je li tako"}
            </Link>
          </dd>
        </div>
      </dl>

      {zasto ? (
        <ul className="mx-3.5 mb-2 list-disc space-y-1 rounded-lg bg-zinc-50 py-2 pl-7 pr-3 text-base leading-6 text-zinc-700">
          {situacija.razlozi.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}

      {/* Sitno: legenda boja, sloj i ključ predloženih postaja — samo na
          širokom zaslonu; na telefonu boje stoje uz naslov i na traci, a
          legenda je i u ploči „Više”. */}
      <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200/80 px-3.5 py-1.5 text-[11px] leading-4 text-zinc-500 sm:flex">
        {kadar.stanje ? <span>sloj {kadar.stanje.dubina} m</span> : null}
        <span className="flex items-center gap-2" aria-label="Legenda boja">
          {(["moguce", "osjetno", "jako"] as const).map((r) => (
            <span key={r} className="flex items-center gap-1">
              <Plocica razina={r} ljestvica={ljestvica} />
              {RIJECI_RAZINA[r]}
            </span>
          ))}
        </span>
        {prijedlozi ? (
          <span className="flex items-center gap-1" title="Mjesta gdje bi se isplatilo mjeriti; klik na točku kaže što i pošto">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full border-2 border-dashed border-maslina" />
            predložene postaje
          </span>
        ) : null}
      </div>
      </div>
    </section>
  );
}
