"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { Ljestvica } from "@/lib/dim";
import { najbliziDostupan, type Crta, type Kadar } from "@/lib/sim/kadrovi";
import {
  danMjesno,
  istiDan,
  oznakaSata,
  razmakSati,
  satMjesno,
  zastarjela,
} from "@/lib/sim/oznaka-sata";
import type { StanjePogona } from "@/lib/sim/pogon";
import { RIJECI_RAZINA, type Razina } from "@/lib/sim/situacija";
import { bojaRazine } from "@/components/karepovac/sim/razina-boje";
import {
  jeNoc,
  KORAK_REPRODUKCIJE_MS,
  nosiNatpis,
  pomakIzUdjela,
  sljedeciZaReprodukciju,
} from "@/components/karepovac/sim/vremenska-crta-logika";

/**
 * Traka vremena, kao na radaru oborina: −24 h … sada … +3 h u jednom potezu.
 *
 * Traka nije samo klizač nego i **pregled**: svaki sat nosi pločicu u boji
 * svoje razine nad naseljima, pa se bez pomicanja vidi kad je bilo loše i
 * kad će biti. Boje su iste kao na kartici i na karti (`razina-boje.ts`).
 *
 * Tri stvari traka mora reći bez riječi:
 *
 * 1. **Gdje je sada.** Crta i riječ „sada” stoje na sadašnjem satu; prošlost
 *    je lijevo puna, prognoza desno prošarana i bljeđa — nagađanje ne smije
 *    izgledati kao ono što se dogodilo. Riječ „sada” računa se prema satu
 *    gledatelja (`oznaka-sata.ts`): kad je crta starija od sata, crta na
 *    njezinu „sada” piše „zadnje”, a pravo „sada” se, ako je još na traci,
 *    crta točkasto desno od nje.
 * 2. **Što još nije gotovo.** Satovi koje radnici još računaju trepere sivo;
 *    sat bez vjetra je rupa koja se ne da odabrati — prazan kadar bi
 *    izgledao kao čist zrak, a to je najgora moguća laž na ovoj karti.
 *    Brojka „n/28” stoji ovdje, uz pločice o kojima govori, a ne nad kartom.
 * 3. **Kad je noć.** Miris se noću drži tla; noćni satovi imaju tamniju
 *    podlogu i mjesec na početku, dan sunce.
 *
 * Reprodukcija ide sat po sat (`KORAK_REPRODUKCIJE_MS`) i preskače rupe;
 * karta između sati pretapa dvije slike, ne izmišlja treću.
 */

// Oblici sata i dana žive u `oznaka-sata.ts`; ovdje ostaju izvezeni jer ih
// pribadače i kartice odavde uvoze.
export { danMjesno, satMjesno };

/**
 * Riječ koja uz sat stoji na traci i u čitaču zaslona, prema satu gledatelja.
 *
 * Args:
 *   kadar: Kadar o kojem je riječ.
 *   sadaStvarno: Sat gledatelja; bez njega se uzima `vrsta` s kadra.
 */
export function opisKadra(kadar: Kadar, sadaStvarno?: Date): string {
  if (kadar.dostupnost === "nedostupno") return "nema podataka";
  if (sadaStvarno) return oznakaSata(kadar, sadaStvarno);
  if (kadar.vrsta === "prognoza") return `prognoza +${kadar.pomak} h`;
  if (kadar.vrsta === "sada") return "sada";
  return "izmjereno";
}

/** Prošarana podloga: kose bijele crte preko boje, kao i na karti. */
const SRAFURA =
  "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.55) 0 2px, transparent 2px 6px)";

/** Rupa: sivo prošarano bez boje. */
const RUPA =
  "repeating-linear-gradient(135deg, rgb(161 161 170 / 0.5) 0 2px, transparent 2px 5px)";

export function VremenskaCrta({
  crta,
  pomak,
  izracunati,
  razine,
  ljestvica,
  reproducira,
  mirovanje,
  sadaStvarno,
  napredak,
  naReprodukciju,
  naPromjenu,
}: {
  crta: Crta;
  pomak: number;
  /** Satovi za koje je perjanica gotova; ostali se još računaju. */
  izracunati: ReadonlySet<string>;
  /** Razina nad naseljima po satu, za izračunate sate. */
  razine: ReadonlyMap<string, Razina>;
  /** Ljestvica tvari koja se gleda; iz nje su boje pločica. */
  ljestvica: Ljestvica;
  reproducira: boolean;
  /** Želja za mirovanjem: bez treptanja i bez pretapanja. */
  mirovanje: boolean;
  /** Sat gledatelja; riječ „sada” računa se prema njemu, ne prema crti. */
  sadaStvarno: Date;
  /** Koliko je sati izračunato; brojka stoji uz pločice. */
  napredak?: StanjePogona;
  naReprodukciju: (v: boolean) => void;
  naPromjenu: (pomak: number) => void;
}) {
  const id = useId();
  const traka = useRef<HTMLDivElement>(null);
  const kadrovi = crta.kadrovi;
  const prvi = kadrovi[0]?.pomak ?? 0;
  const zadnji = kadrovi[kadrovi.length - 1]?.pomak ?? 0;
  const n = kadrovi.length;
  const odabrani = kadrovi.find((k) => k.pomak === pomak) ?? kadrovi[0];

  /** Traka smije stati samo na sat koji se dade prikazati. */
  const naKadar = useCallback(
    (trazeni: number) => {
      const k = najbliziDostupan(crta, trazeni);
      if (k && k.pomak !== pomak) naPromjenu(k.pomak);
    },
    [crta, pomak, naPromjenu],
  );

  /** Prvi dostupni sat u zadanom smjeru; strelice preskaču rupe. */
  const korak = useCallback(
    (smjer: 1 | -1) => {
      for (let p = pomak + smjer; p >= prvi && p <= zadnji; p += smjer) {
        const k = kadrovi.find((x) => x.pomak === p);
        if (k && k.dostupnost !== "nedostupno") {
          naPromjenu(p);
          return;
        }
      }
    },
    [pomak, prvi, zadnji, kadrovi, naPromjenu],
  );

  // Reprodukcija: sat po sat, preko rupa, s kraja na početak.
  useEffect(() => {
    if (!reproducira) return;
    const t = window.setInterval(() => {
      const sljedeci = sljedeciZaReprodukciju(kadrovi, pomak);
      if (sljedeci === null) naReprodukciju(false);
      else naPromjenu(sljedeci);
    }, KORAK_REPRODUKCIJE_MS);
    return () => window.clearInterval(t);
  }, [reproducira, kadrovi, pomak, naPromjenu, naReprodukciju]);

  // Jednom, kad zagrijavanje završi: poslije se brojka mijenja tiho. Stanje
  // se izvodi tijekom crtanja (bez učinka), pa se ne vraća na „nije” kad
  // se poslije osvježavanja koji sat računa iznova.
  const [zavrseno, postaviZavrseno] = useState(false);
  const gotovoSve = !!napredak && napredak.ukupno > 0 && napredak.gotovo >= napredak.ukupno;
  if (gotovoSve && !zavrseno) postaviZavrseno(true);

  if (!odabrani) return null;

  const udioSredine = (p: number) => ((p - prvi + 0.5) / n) * 100;
  const oznaka = opisKadra(odabrani, sadaStvarno);
  // Prognoza prema satu gledatelja: sat koji tek dolazi, ne oznaka s kadra.
  const prognoza = razmakSati(odabrani.sat, sadaStvarno) < 0;
  const stara = zastarjela(crta.sada, sadaStvarno);
  // Gdje je pravo „sada” na traci kad je crta stara; izvan trake je `null`.
  const stvarniPomak = stara ? -razmakSati(crta.sada, sadaStvarno) : null;
  const stvarniNaTraci = stvarniPomak !== null && stvarniPomak >= prvi && stvarniPomak <= zadnji;
  // Brojka samo za prvo zagrijavanje (i za grešku): poslije se sat koji se
  // računa iznova vidi kao „osvježavam” na kartici, a stara slika stoji.
  const racuna = napredak
    ? napredak.greska !== null || (!zavrseno && napredak.gotovo < napredak.ukupno)
    : false;

  function izPokazivaca(e: React.PointerEvent<HTMLDivElement>) {
    const el = traka.current;
    if (!el) return;
    const okvir = el.getBoundingClientRect();
    const udio = (e.clientX - okvir.left) / okvir.width;
    naKadar(pomakIzUdjela(udio - 0.5 / n, prvi, zadnji));
  }

  // Na telefonu zbijeno (≈ 80 px s rubovima): gumb 44 px, sat, pločice od
  // 10 px i brojke sati — karta mora držati 80 % zaslona. Na širokom zaslonu
  // kao prije.
  return (
    <div className="pointer-events-auto rounded-xl bg-white/90 px-3 pb-0.5 pt-0.5 shadow-md ring-1 ring-black/5 backdrop-blur-sm sm:pb-2 sm:pt-2">
      <div className="flex flex-nowrap items-center gap-x-1.5 sm:flex-wrap sm:gap-x-2.5 sm:gap-y-1">
        <button
          type="button"
          onClick={() => naReprodukciju(!reproducira)}
          aria-pressed={reproducira}
          aria-label={reproducira ? "Zaustavi prikaz po satima" : "Pokreni prikaz po satima"}
          className="fokus flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700"
        >
          {reproducira ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
              <path d="M6 3.5v13l10-6.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="min-w-0 truncate leading-none">
          <span className="text-base font-bold tabular-nums text-zinc-900">
            {satMjesno(odabrani.sat)}
          </span>
          <span
            className={`ml-1.5 text-sm ${
              prognoza ? "font-semibold text-status-poslano" : oznaka === "sada" ? "font-semibold text-zinc-900" : "text-zinc-500"
            }`}
          >
            {/* Dan samo kad nije današnji: na telefonu redak ne smije puknuti. */}
            {oznaka === "sada" ? "sada" : istiDan(odabrani.sat, sadaStvarno) ? oznaka : `${danMjesno(odabrani.sat)}, ${oznaka}`}
          </span>
        </div>
        {/* Brojka bez `aria-live`: mijenja se do 28 puta, a kartica ionako
            izgovara „računam ovaj sat”. Čitaču ide jedna rečenica na kraju. */}
        {racuna && napredak ? (
          <span className="shrink-0 rounded bg-zinc-900/80 px-2 py-1 text-[11px] font-medium text-white">
            {napredak.greska ?? (
              <>
                <span className="hidden sm:inline">Računam </span>
                {napredak.gotovo}/{napredak.ukupno}
                <span className="hidden sm:inline"> sati</span>
              </>
            )}
          </span>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {zavrseno ? "Perjanica je izračunata za sve sate." : ""}
        </span>
        {pomak !== 0 ? (
          <button
            type="button"
            onClick={() => naKadar(0)}
            className="fokus ml-auto min-h-11 min-w-11 shrink-0 rounded px-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 sm:px-2.5"
          >
            {stara ? "na zadnje" : "na sada"}
          </button>
        ) : null}
        {/* Izlaz na pregled, samo na telefonu: gore je ondje jedino skupljena
            kartica. Na širokom zaslonu ista pilula stoji gore desno. */}
        <Link
          href="/karepovac"
          aria-label="Karepovac — sve što pratimo"
          className={`fokus flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-sm font-semibold text-zinc-800 ring-1 ring-black/10 hover:bg-zinc-50 sm:hidden ${pomak !== 0 ? "" : "ml-auto"}`}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M12 4 6 10l6 6" className="stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span>Karepovac</span>
        </Link>
      </div>

      <div
        ref={traka}
        id={id}
        role="slider"
        tabIndex={0}
        aria-label="Sat koji se prikazuje"
        aria-valuemin={prvi}
        aria-valuemax={zadnji}
        aria-valuenow={pomak}
        aria-valuetext={`${satMjesno(odabrani.sat)}, ${danMjesno(odabrani.sat)}, ${oznaka}${
          razine.has(odabrani.sat) ? `, miris u naseljima: ${RIJECI_RAZINA[razine.get(odabrani.sat)!]}` : ""
        }`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          if (reproducira) naReprodukciju(false);
          izPokazivaca(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) izPokazivaca(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            korak(-1);
          } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            korak(1);
          } else if (e.key === "Home") {
            e.preventDefault();
            naKadar(prvi);
          } else if (e.key === "End") {
            e.preventDefault();
            naKadar(zadnji);
          } else if (e.key === " ") {
            e.preventDefault();
            naReprodukciju(!reproducira);
          }
        }}
        className="fokus relative mt-1 h-6 cursor-pointer touch-none select-none rounded sm:mt-2 sm:h-12"
      >
        {/* Podloga: dan svijetao, noć zasjenjena; glif na početku svakog niza. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-6 sm:h-12">
          {kadrovi.map((k, i) => {
            const noc = jeNoc(k.sat);
            const prijelaz = i === 0 || jeNoc(kadrovi[i - 1].sat) !== noc;
            return (
              <span
                key={k.sat}
                className={`relative flex-1 ${noc ? "bg-slate-200/70" : ""} ${
                  i === 0 ? "rounded-l" : ""
                } ${i === n - 1 ? "rounded-r" : ""}`}
              >
                {prijelaz ? (
                  <span className="absolute left-0.5 top-0 hidden text-[9px] leading-none text-slate-500 sm:inline">
                    {noc ? "☾" : "☼"}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>

        {/* Pločice razina: pune u prošlosti, prošarane u prognozi. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0.5 flex h-2.5 gap-px sm:top-3 sm:h-4">
          {kadrovi.map((k) => {
            const rupa = k.dostupnost === "nedostupno";
            const gotovo = izracunati.has(k.sat);
            const razina = razine.get(k.sat);
            const boja = gotovo && razina ? bojaRazine(razina, ljestvica) : undefined;
            const prog = k.vrsta === "prognoza";
            return (
              <span
                key={k.sat}
                className={`flex-1 rounded-sm ${
                  rupa
                    ? ""
                    : !gotovo
                      ? `bg-zinc-300 ${mirovanje ? "" : "animate-pulse"}`
                      : ""
                }`}
                style={
                  rupa
                    ? { backgroundImage: RUPA }
                    : gotovo
                      ? {
                          backgroundColor: boja,
                          backgroundImage: prog ? SRAFURA : undefined,
                          opacity: prog ? 0.85 : 1,
                        }
                      : undefined
                }
              />
            );
          })}
        </div>

        {/* Natpisi sati ispod pločica. */}
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-3 sm:h-4">
          {kadrovi.map((k) => (
            <span
              key={k.sat}
              className="flex-1 text-center text-[10px] leading-3 tabular-nums text-zinc-500 sm:leading-4"
            >
              {nosiNatpis(k.sat) && k.pomak !== 0 ? satMjesno(k.sat).slice(0, 2) : ""}
            </span>
          ))}
        </div>

        {/* Crta „sada”: granica između onoga što se dogodilo i nagađanja.
            Kad je crta stara, to više nije „sada” nego zadnji složeni sat. */}
        {kadrovi.some((k) => k.pomak === 0) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0"
            style={{ left: `${udioSredine(0)}%` }}
          >
            <span
              className={`absolute -bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold leading-3 sm:leading-4 ${
                stara ? "text-zinc-500" : "text-zinc-900"
              }`}
            >
              {stara ? "zadnje" : "sada"}
            </span>
            <span className={`absolute left-0 top-0 h-3 w-0.5 -translate-x-1/2 sm:top-2 sm:h-6 ${stara ? "bg-zinc-400" : "bg-zinc-900"}`} />
          </div>
        ) : null}

        {/* Pravo „sada” prema satu gledatelja, kad je crta stara a sat je
            još na traci: točkasta crta desno od zadnjeg složenog sata. */}
        {stvarniNaTraci ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0"
            style={{ left: `${udioSredine(stvarniPomak!)}%` }}
          >
            <span className="absolute -bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold leading-3 text-zinc-900 sm:leading-4">
              sada
            </span>
            <span className="absolute left-0 top-0 h-3 w-0 -translate-x-1/2 border-l-2 border-dotted border-zinc-900 sm:top-2 sm:h-6" />
          </div>
        ) : null}

        {/* Odabrani sat: ručica preko cijele visine. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-0.5 h-4 sm:top-1 sm:h-8"
          style={{
            left: `${udioSredine(pomak)}%`,
            transition: mirovanje ? undefined : "left 120ms ease-out",
          }}
        >
          <span className="absolute left-0 top-0 h-4 w-[3px] -translate-x-1/2 rounded-full bg-zinc-900 ring-2 ring-white sm:h-8" />
          <span className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1 rounded-full bg-zinc-900 ring-2 ring-white" />
        </div>
      </div>
    </div>
  );
}
