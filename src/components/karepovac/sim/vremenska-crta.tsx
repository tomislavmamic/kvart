"use client";

import { useCallback, useEffect, useId, useRef } from "react";

import type { Ljestvica } from "@/lib/dim";
import { najbliziDostupan, type Crta, type Kadar } from "@/lib/sim/kadrovi";
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
 *    izgledati kao ono što se dogodilo.
 * 2. **Što još nije gotovo.** Satovi koje radnici još računaju trepere sivo;
 *    sat bez vjetra je rupa koja se ne da odabrati — prazan kadar bi
 *    izgledao kao čist zrak, a to je najgora moguća laž na ovoj karti.
 * 3. **Kad je noć.** Miris se noću drži tla; noćni satovi imaju tamniju
 *    podlogu i mjesec na početku, dan sunce.
 *
 * Reprodukcija ide sat po sat (`KORAK_REPRODUKCIJE_MS`) i preskače rupe;
 * karta između sati pretapa dvije slike, ne izmišlja treću.
 */

const MJESNO = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

const MJESNO_DAN = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  weekday: "short",
  day: "numeric",
  month: "numeric",
});

export function satMjesno(iso: string): string {
  return MJESNO.format(new Date(iso));
}

export function danMjesno(iso: string): string {
  return MJESNO_DAN.format(new Date(iso));
}

/** Riječ koja uz sat stoji na traci i u čitaču zaslona. */
export function opisKadra(kadar: Kadar): string {
  if (kadar.dostupnost === "nedostupno") return "nema podataka";
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

  if (!odabrani) return null;

  const udioSredine = (p: number) => ((p - prvi + 0.5) / n) * 100;
  const prognoza = odabrani.vrsta === "prognoza";

  function izPokazivaca(e: React.PointerEvent<HTMLDivElement>) {
    const el = traka.current;
    if (!el) return;
    const okvir = el.getBoundingClientRect();
    const udio = (e.clientX - okvir.left) / okvir.width;
    naKadar(pomakIzUdjela(udio - 0.5 / n, prvi, zadnji));
  }

  return (
    <div className="pointer-events-auto rounded-xl bg-white/90 px-3 pb-2 pt-2 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => naReprodukciju(!reproducira)}
          aria-pressed={reproducira}
          aria-label={reproducira ? "Zaustavi prikaz po satima" : "Pokreni prikaz po satima"}
          className="fokus flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-700"
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
        <div className="leading-none">
          <span className="text-base font-bold tabular-nums text-zinc-900">
            {satMjesno(odabrani.sat)}
          </span>
          <span
            className={`ml-1.5 text-xs ${
              prognoza ? "font-semibold text-violet-700" : "text-zinc-500"
            }`}
          >
            {prognoza
              ? `prognoza, +${odabrani.pomak} h`
              : odabrani.vrsta === "sada"
                ? "sada"
                : `${danMjesno(odabrani.sat)}, ${odabrani.pomak} h`}
          </span>
        </div>
        {pomak !== 0 ? (
          <button
            type="button"
            onClick={() => naKadar(0)}
            className="fokus ml-auto rounded px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            na sada
          </button>
        ) : null}
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
        aria-valuetext={`${satMjesno(odabrani.sat)}, ${danMjesno(odabrani.sat)}, ${opisKadra(odabrani)}${
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
        className="fokus relative mt-2 h-12 cursor-pointer touch-none select-none rounded"
      >
        {/* Podloga: dan svijetao, noć zasjenjena; glif na početku svakog niza. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-12">
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
                  <span className="absolute left-0.5 top-0 text-[9px] leading-none text-slate-500">
                    {noc ? "☾" : "☼"}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>

        {/* Pločice razina: pune u prošlosti, prošarane u prognozi. */}
        <div aria-hidden="true" className="absolute inset-x-0 top-3 flex h-4 gap-px">
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
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-4">
          {kadrovi.map((k) => (
            <span
              key={k.sat}
              className="flex-1 text-center text-[10px] leading-4 tabular-nums text-zinc-500"
            >
              {nosiNatpis(k.sat) && k.pomak !== 0 ? String(new Date(k.sat).getUTCHours() === 0 && false ? "" : satMjesno(k.sat).slice(0, 2)) : ""}
            </span>
          ))}
        </div>

        {/* Crta „sada”: granica između onoga što se dogodilo i nagađanja. */}
        {kadrovi.some((k) => k.pomak === 0) ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0"
            style={{ left: `${udioSredine(0)}%` }}
          >
            <span className="absolute -bottom-0 left-1/2 -translate-x-1/2 text-[10px] font-bold leading-4 text-zinc-900">
              sada
            </span>
            <span className="absolute left-0 top-2 h-6 w-0.5 -translate-x-1/2 bg-zinc-900" />
          </div>
        ) : null}

        {/* Odabrani sat: ručica preko cijele visine. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1 h-8"
          style={{
            left: `${udioSredine(pomak)}%`,
            transition: mirovanje ? undefined : "left 120ms ease-out",
          }}
        >
          <span className="absolute left-0 top-0 h-8 w-[3px] -translate-x-1/2 rounded-full bg-zinc-900 ring-2 ring-white" />
          <span className="absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1 rounded-full bg-zinc-900 ring-2 ring-white" />
        </div>
      </div>
    </div>
  );
}
