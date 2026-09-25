"use client";

/**
 * Navigacija po cijelom tekstu GUP-a na /gup/dokument (StranicaIzdanja).
 *
 * Tekst plana na snazi ima 82 stranice glasnika, a sadržaj je stajao samo na
 * vrhu: tko je jednom ušao u tekst, nije znao ni gdje je ni kako na drugo
 * mjesto. Sad je sadržaj uvijek pri ruci i zna gdje se čita:
 * - od `lg` je stupac uz tekst koji ostaje na mjestu i prati čitanje;
 * - ispod `lg` traka iznad teksta pokazuje poglavlje, članak i stranicu, a
 *   dodirom otvara isti sadržaj kao donju ploču.
 * Stupac i ploča su jedan element — popover ispod `lg`, stupac od `lg`
 * (globals.css, .sadrzaj-dokumenta). Popover i sidra rade i bez JavaScripta;
 * skripta samo označava mjesto čitanja.
 *
 * Mjesto čitanja su zadnji naslov, članak i prijelaz stranice iznad crte
 * čitanja. Ne promatra se svaki od ~2 500 blokova: pri listanju se binarno
 * traži po sidrima iz sadržaja, desetak mjerenja po okviru, pa je mjesto točno
 * i kad slike tablica naknadno pomaknu tekst.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { SIDRO_KARATA, type SadrzajDokumenta } from "@/lib/gup-dokument/sadrzaj";

const ID_PLOCE = "sadrzaj-dokumenta";

/** Indeksi su unutar dokumenta `dok`; -1 gdje još nema ničega. */
interface Mjesto {
  /** -1 iznad teksta. */
  dok: number;
  naslov: number;
  clanak: number;
  stranica: number;
  /** Iznad teksta, a ispod naslova kartografskih prikaza. */
  karte: boolean;
}

const NIGDJE: Mjesto = { dok: -1, naslov: -1, clanak: -1, stranica: -1, karte: false };

const Kontekst = createContext<{ dokumenti: SadrzajDokumenta[]; mjesto: Mjesto }>({
  dokumenti: [],
  mjesto: NIGDJE,
});

type Sidro = { dok: number; i: number; el: HTMLElement };

/** Zadnje sidro iznad crte. Sidra su redom teksta, pa im vrhovi rastu. */
function zadnjeIznad(sidra: Sidro[], crta: number): Sidro | undefined {
  let lo = 0;
  let hi = sidra.length - 1;
  let nadeno: Sidro | undefined;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (sidra[m].el.getBoundingClientRect().top <= crta) {
      nadeno = sidra[m];
      lo = m + 1;
    } else hi = m - 1;
  }
  return nadeno;
}

const isto = (a: Mjesto, b: Mjesto) =>
  a.dok === b.dok && a.naslov === b.naslov && a.clanak === b.clanak && a.stranica === b.stranica && a.karte === b.karte;

export function MjestoCitanja({ dokumenti, children }: { dokumenti: SadrzajDokumenta[]; children: ReactNode }) {
  const [mjesto, setMjesto] = useState(NIGDJE);

  useEffect(() => {
    const sidra = (uzmi: (d: SadrzajDokumenta) => { id: string }[]): Sidro[] =>
      dokumenti.flatMap((d, dok) =>
        uzmi(d).flatMap(({ id }, i) => {
          const el = document.getElementById(id);
          return el ? [{ dok, i, el }] : [];
        }),
      );
    const pocetci = sidra((d) => [{ id: d.sidro }]);
    const naslovi = sidra((d) => d.naslovi);
    const clanci = sidra((d) => d.clanci);
    const stranice = sidra((d) => d.stranice);
    const karte = document.getElementById(SIDRO_KARATA);

    let okvir = 0;
    const izmjeri = () => {
      okvir = 0;
      // Ispod mjesta na koje skače sidro (scroll-margin 6rem), a naslov koji
      // uđe u gornju trećinu prozora već je ono što se čita.
      const crta = Math.max(112, window.innerHeight * 0.3);
      const dok = zadnjeIznad(pocetci, crta)?.dok ?? -1;
      const u = (s?: Sidro) => (s && s.dok === dok ? s.i : -1);
      const novo: Mjesto = {
        dok,
        naslov: u(zadnjeIznad(naslovi, crta)),
        clanak: u(zadnjeIznad(clanci, crta)),
        stranica: u(zadnjeIznad(stranice, crta)),
        karte: dok < 0 && !!karte && karte.getBoundingClientRect().top <= crta,
      };
      setMjesto((m) => (isto(m, novo) ? m : novo));
    };
    const zakazi = () => {
      okvir ||= requestAnimationFrame(izmjeri);
    };
    // Prvo mjerenje odmah, ne u okviru: kartica otvorena u pozadini (poveznica
    // navoda u novoj kartici) okvire ne crta, a sidro ju je već pomaknulo.
    izmjeri();
    window.addEventListener("scroll", zakazi, { passive: true });
    window.addEventListener("resize", zakazi);
    return () => {
      cancelAnimationFrame(okvir);
      window.removeEventListener("scroll", zakazi);
      window.removeEventListener("resize", zakazi);
    };
  }, [dokumenti]);

  return <Kontekst.Provider value={{ dokumenti, mjesto }}>{children}</Kontekst.Provider>;
}

/** „čl. 53 · str. 37” — gdje se čita, onako kako se navodi. */
function oznakaMjesta(d: SadrzajDokumenta | undefined, m: Mjesto): string[] {
  if (!d) return [];
  const cl = d.clanci[m.clanak];
  const str = d.stranice[m.stranica];
  return [cl && `čl. ${cl.cl}`, str && `str. ${str.s}`].filter((x): x is string => !!x);
}

function zatvoriPlocu() {
  const el = document.getElementById(ID_PLOCE);
  try {
    if (el?.matches(":popover-open")) el.hidePopover();
  } catch {
    // preglednik bez popovera: ploča se ni ne otvara
  }
}

/**
 * Pomakne popis sadržaja (ne stranicu) tako da označena stavka stoji na
 * trećini visine — vidi se i što je prošlo i što dolazi. Stupac se pomiče tek
 * kad stavka izađe iz vida, da ne poskakuje uz svaki naslov.
 */
function pokaziOznacenu(popis: HTMLElement | null, uvijek: boolean) {
  const a = popis?.querySelector<HTMLElement>("[data-oznaceno]");
  if (!popis || !a || !popis.clientHeight) return;
  const p = popis.getBoundingClientRect();
  const r = a.getBoundingClientRect();
  const rub = 48;
  if (uvijek || r.top < p.top + rub || r.bottom > p.bottom - rub) popis.scrollTop += r.top - p.top - p.height / 3;
}

const UVLAKA = ["", "pl-2", "pl-5", "pl-8", "pl-11"];

const stavka = (oznaceno: boolean, jace: boolean) =>
  `fokus meta flex items-center gap-3 rounded-lg py-1 pr-2 leading-snug ${
    oznaceno
      ? "bg-kamen-plitko font-semibold text-kamen-tinta"
      : `${jace ? "font-medium text-kamen-tinta" : "text-kamen-tekst"} hover:bg-kamen-plitko hover:text-kamen-tinta`
  }`;

/** Sadržaj izdanja: stupac uz tekst od `lg`, donja ploča ispod. */
export function SadrzajIzdanja() {
  const { dokumenti, mjesto } = useContext(Kontekst);
  const popis = useRef<HTMLDivElement>(null);

  // Stupac prati čitanje: označena stavka ne izlazi iz vida.
  useEffect(() => pokaziOznacenu(popis.current, false), [mjesto]);

  useEffect(() => {
    const ploca = document.getElementById(ID_PLOCE);
    if (!ploca) return;
    // Ploča se otvara na mjestu čitanja; kad prozor naraste do stupca, zatvara se.
    const otvorena = (e: Event) => {
      if ((e as Event & { newState?: string }).newState === "open") pokaziOznacenu(popis.current, true);
    };
    const siroko = window.matchMedia("(min-width: 1024px)");
    const promjena = () => {
      if (siroko.matches) zatvoriPlocu();
    };
    ploca.addEventListener("toggle", otvorena);
    siroko.addEventListener("change", promjena);
    return () => {
      ploca.removeEventListener("toggle", otvorena);
      siroko.removeEventListener("change", promjena);
    };
  }, []);

  const polozaj = oznakaMjesta(dokumenti[mjesto.dok], mjesto).join(" · ");

  return (
    <nav id={ID_PLOCE} popover="auto" aria-labelledby="sadrzaj-naslov" className="sadrzaj-dokumenta">
      <div className="flex items-center gap-3 border-b border-kamen-tlo py-2 pl-5 pr-3 lg:border-0 lg:px-2 lg:pb-2 lg:pt-0">
        <h2 id="sadrzaj-naslov" className="text-xs font-bold uppercase tracking-[0.06em] text-kamen-drugi">
          Sadržaj
        </h2>
        <p className="min-w-0 flex-1 truncate text-right text-xs tabular-nums text-kamen-drugi">{polozaj}</p>
        <button
          type="button"
          popoverTarget={ID_PLOCE}
          popoverTargetAction="hide"
          aria-label="Zatvori sadržaj"
          className="fokus meta flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-kamen-drugi hover:bg-kamen-plitko hover:text-kamen-tinta lg:hidden"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={popis} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2 text-sm lg:px-0 lg:pb-2">
        <a
          href={`#${SIDRO_KARATA}`}
          onClick={zatvoriPlocu}
          aria-current={mjesto.karte ? "location" : undefined}
          data-oznaceno={mjesto.karte || undefined}
          className={`${stavka(mjesto.karte, true)} pl-2`}
        >
          Kartografski prikazi
        </a>

        {dokumenti.map((d, di) => {
          const naPocetku = mjesto.dok === di && mjesto.naslov < 0;
          return (
            <div key={d.id} className="mt-4">
              <a
                href={`#${d.sidro}`}
                onClick={zatvoriPlocu}
                aria-current={naPocetku ? "location" : undefined}
                data-oznaceno={naPocetku || undefined}
                className={`${stavka(naPocetku, false)} pl-2 text-xs font-bold uppercase tracking-[0.06em]`}
              >
                {d.kratko}
              </a>
              <ol className="mt-1 space-y-px">
                {d.naslovi.map((n, ni) => {
                  const oznaceno = mjesto.dok === di && mjesto.naslov === ni;
                  return (
                    <li key={n.id}>
                      <a
                        href={`#${n.id}`}
                        onClick={zatvoriPlocu}
                        aria-current={oznaceno ? "location" : undefined}
                        data-oznaceno={oznaceno || undefined}
                        className={`${stavka(oznaceno, n.r === 1)} ${UVLAKA[n.r]}`}
                      >
                        <span className="min-w-0 flex-1">{n.t}</span>
                        <span className="shrink-0 text-xs tabular-nums text-kamen-tih">
                          <span className="sr-only">str. </span>
                          {n.s}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
              {d.clanci.length > 0 && (
                <details className="mt-2">
                  <summary className="fokus meta flex cursor-pointer items-center rounded-lg px-2 py-1 font-semibold text-kamen-tinta hover:bg-kamen-plitko">
                    Članci · {d.clanci.length}
                  </summary>
                  <p className="mt-2 flex flex-wrap gap-1.5 px-2 tabular-nums">
                    {d.clanci.map((c, ci) => {
                      const oznacen = mjesto.dok === di && mjesto.clanak === ci;
                      return (
                        <a
                          key={c.id}
                          href={`#${c.id}`}
                          onClick={zatvoriPlocu}
                          aria-current={oznacen ? "location" : undefined}
                          title={`čl. ${c.cl}, str. ${c.s}`}
                          className={`fokus meta-cip inline-flex min-w-9 items-center justify-center rounded-full border px-2 py-0.5 ${
                            oznacen
                              ? "border-maslina bg-maslina text-white"
                              : "border-kamen-rub bg-white text-kamen-tekst hover:border-maslina hover:text-maslina"
                          }`}
                        >
                          {c.cl}
                        </a>
                      );
                    })}
                  </p>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Traka iznad teksta ispod `lg`: lijepi se za vrh dok traje tekst, kaže gdje
 * se čita i otvara sadržaj. Iznad teksta stoji na svojem mjestu, kao ulaz u nj.
 */
export function TrakaSadrzaja() {
  const { dokumenti, mjesto } = useContext(Kontekst);
  const d = dokumenti[mjesto.dok];
  const naslov = d?.naslovi[mjesto.naslov]?.t;
  const opis = d ? [d.kratko, ...oznakaMjesta(d, mjesto)] : dokumenti.map((x) => x.kratko);

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-kamen-tlo bg-white/95 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        popoverTarget={ID_PLOCE}
        className="fokus flex min-h-12 w-full items-center gap-3 rounded-lg py-1.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="sr-only">Otvori sadržaj. Sad: </span>
          <span className="block truncate text-sm font-semibold text-kamen-tinta">{naslov ?? "Sadržaj dokumenta"}</span>
          <span className="block truncate text-xs tabular-nums text-kamen-drugi">{opis.join(" · ")}</span>
        </span>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-kamen-rub bg-white text-kamen-tekst"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5">
            <path
              d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>
    </div>
  );
}
