"use client";

/**
 * Infografika namjene GUP-a Splita: površina po namjeni za tri godine plana,
 * koliko je od toga iskorišteno i koliko u skladu s planom.
 *
 * Raspored ćelija (Voronoi ili pravokutnici) i sve brojke stižu gotovi s
 * poslužitelja (src/app/gup/page.tsx); ovdje se samo bira što se vidi i
 * računa do koje visine se ćelija „puni” bojom.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { RezultatKlase } from "@/lib/gup-grad/izracun";
import { GODINE, KLASE, SKUPINE, type Godina, type KodKlase } from "@/lib/gup-grad/model";
import { razinaZaUdio, sirinaNaVisini, visinaNaSirini, type Tocka } from "@/lib/gup-grad/poligon";
import type { VrstaKoristenja } from "@/lib/gup-grad/pravila";
import type { Oblik, Raspored } from "@/lib/gup-grad/raspored";

export interface PodaciInfografike {
  inacice: { id: string; naziv: string; opis: string }[];
  rezultati: Record<string, Record<Godina, RezultatKlase[]>>;
  rasporedi: Record<Godina, Record<Oblik, Raspored>>;
  planovi: Record<Godina, { naziv: string; napomena: string }>;
}

type Pogled = "namjena" | "iskoristenost" | "sklad";

const POGLEDI: { id: Pogled; naziv: string }[] = [
  { id: "namjena", naziv: "Namjena" },
  { id: "iskoristenost", naziv: "Iskorišteno" },
  { id: "sklad", naziv: "U skladu s planom" },
];

const OBLICI: { id: Oblik; naziv: string }[] = [
  { id: "voronoi", naziv: "Stanice" },
  { id: "pravokutnici", naziv: "Pravokutnici" },
];

const VRSTE: Record<VrstaKoristenja, string> = {
  stambena: "stambene zgrade",
  gospodarska: "gospodarske i poslovne zgrade",
  javna: "javne zgrade",
  pomocna: "pomoćne zgrade",
  ostala: "ostale građevine",
  neevidentirana: "zgrade kojih nema u katastru",
  promet: "ceste, nogostupi i parkirališta",
  uredjeno: "groblja i športski objekti",
  zelenilo: "održavano javno zelenilo",
};

const KLASA = new Map(KLASE.map((k) => [k.kod, k]));
const SKUPINA = new Map(SKUPINE.map((s) => [s.kod, s]));

function ha(m2: number, znamenke = 0): string {
  return (m2 / 1e4).toLocaleString("hr-HR", {
    minimumFractionDigits: znamenke,
    maximumFractionDigits: znamenke,
  });
}

function posto(dio: number, cijelo: number): string {
  if (cijelo <= 0) return "0 %";
  return `${Math.round((dio / cijelo) * 100).toLocaleString("hr-HR")} %`;
}

const put = (p: readonly Tocka[]) => (p.length ? `M${p.map(([x, y]) => `${x},${y}`).join("L")}Z` : "");
const sigurniId = (kod: string) => kod.replace(/[^A-Za-z0-9]/g, "");

function Prekidac<T extends string>({
  oznaka,
  opcije,
  vrijednost,
  promijeni,
}: {
  oznaka: string;
  opcije: { id: T; naziv: string }[];
  vrijednost: T;
  promijeni: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={oznaka} className="flex w-full rounded-lg border border-zinc-300 bg-white p-0.5 sm:w-auto">
      {opcije.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={vrijednost === o.id}
          onClick={() => promijeni(o.id)}
          className={`fokus min-h-11 flex-1 whitespace-nowrap rounded-md px-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-3 ${
            vrijednost === o.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {o.naziv}
        </button>
      ))}
    </div>
  );
}

export function GupInfografika({ podaci }: { podaci: PodaciInfografike }) {
  const [godina, setGodina] = useState<Godina>(2025);
  const [pogled, setPogled] = useState<Pogled>("namjena");
  const [oblik, setOblik] = useState<Oblik>("voronoi");
  const [inacica, setInacica] = useState(podaci.inacice[0].id);
  const [odabrana, setOdabrana] = useState<KodKlase | null>(null);
  const uid = useId().replace(/:/g, "");
  // Natpisi se mjere u pikselima zaslona, ne u jedinicama viewBoxa — inače
  // su na mobitelu sitni, a na širokom zaslonu golemi.
  const okvir = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(0.64);

  const raspored = podaci.rasporedi[godina][oblik];
  const rezultati = podaci.rezultati[inacica][godina];
  const poKodu = useMemo(() => new Map(rezultati.map((r) => [r.kod, r])), [rezultati]);

  const zbroj = useMemo(
    () =>
      rezultati.reduce(
        (s, r) => ({
          ukupno: s.ukupno + r.ukupnoM2,
          iskoristeno: s.iskoristeno + r.iskoristenoM2,
          suprotno: s.suprotno + r.uSuprotnostiM2,
        }),
        { ukupno: 0, iskoristeno: 0, suprotno: 0 },
      ),
    [rezultati],
  );

  // Visine punjenja po ćeliji: iskorišteno se nasipa odozdo, a u pogledu
  // „u skladu” najprije dio u skladu, pa iznad njega dio u suprotnosti.
  const razine = useMemo(() => {
    const m = new Map<KodKlase, { dno: number; iskoristeno: number; uSkladu: number; ostatak: number }>();
    for (const c of raspored.celije) {
      const r = poKodu.get(c.kod);
      if (!r || r.ukupnoM2 <= 0) continue;
      const dno = Math.max(...c.poligon.map(([, y]) => y));
      m.set(c.kod, {
        dno,
        iskoristeno: razinaZaUdio(c.poligon, r.iskoristenoM2 / r.ukupnoM2),
        uSkladu: razinaZaUdio(c.poligon, r.uSkladuM2 / r.ukupnoM2),
        // premali ostaci leže odmah iznad iskorištenog
        ostatak: razinaZaUdio(c.poligon, Math.min(1, (r.iskoristenoM2 + r.ostatakM2) / r.ukupnoM2)),
      });
    }
    return m;
  }, [raspored, poKodu]);

  useEffect(() => {
    const el = okvir.current;
    if (!el) return;
    const mjeri = () => setSkala(el.clientWidth / (raspored.sirina + 12));
    mjeri();
    const ro = new ResizeObserver(mjeri);
    ro.observe(el);
    return () => ro.disconnect();
  }, [raspored.sirina]);

  const odabraniRez = odabrana ? poKodu.get(odabrana) : undefined;
  const odabranaCelija = odabrana ? raspored.celije.find((c) => c.kod === odabrana) : undefined;
  const opisInacice = podaci.inacice.find((i) => i.id === inacica)?.opis;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Prekidac
          oznaka="Godina plana"
          opcije={GODINE.map((g) => ({ id: String(g) as `${Godina}`, naziv: String(g) }))}
          vrijednost={String(godina) as `${Godina}`}
          promijeni={(v) => setGodina(Number(v) as Godina)}
        />
        <Prekidac oznaka="Što prikazati" opcije={POGLEDI} vrijednost={pogled} promijeni={setPogled} />
        <Prekidac oznaka="Oblik grafikona" opcije={OBLICI} vrijednost={oblik} promijeni={setOblik} />
      </div>

      {pogled !== "namjena" && (
        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
          <Prekidac
            oznaka="Kako se broji iskorišteno"
            opcije={podaci.inacice.map((i) => ({ id: i.id, naziv: i.naziv }))}
            vrijednost={inacica}
            promijeni={setInacica}
          />
          <p className="max-w-md text-sm text-zinc-600">{opisInacice}</p>
        </div>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5 sm:p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Obuhvat</dt>
          <dd className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums sm:text-2xl">
            {ha(zbroj.ukupno)} <span className="text-sm font-semibold text-zinc-500 sm:text-base">ha</span>
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5 sm:p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Iskorišteno</dt>
          <dd className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums sm:text-2xl">
            {ha(zbroj.iskoristeno)} <span className="text-sm font-semibold text-zinc-500 sm:text-base">ha</span>
          </dd>
          <dd className="text-xs tabular-nums text-zinc-600 sm:text-sm">{posto(zbroj.iskoristeno, zbroj.ukupno)} obuhvata</dd>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-2.5 sm:p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Protivno planu</dt>
          <dd className="mt-1 whitespace-nowrap text-xl font-bold tabular-nums sm:text-2xl">
            {ha(zbroj.suprotno)} <span className="text-sm font-semibold text-zinc-500 sm:text-base">ha</span>
          </dd>
          <dd className="text-xs tabular-nums text-zinc-600 sm:text-sm">{posto(zbroj.suprotno, zbroj.iskoristeno)} iskorištenog</dd>
        </div>
      </dl>

      <figure className="mt-5">
        <div ref={okvir} className="relative mx-auto" style={{ maxWidth: oblik === "voronoi" ? 640 : 900 }}>
          <svg
            viewBox={`-6 -6 ${raspored.sirina + 12} ${raspored.visina + 12}`}
            className="block h-auto w-full touch-manipulation select-none"
            role="img"
            aria-label={`Površina po namjeni u ${podaci.planovi[godina].naziv}. Brojke su i u tablici ispod grafikona.`}
            onPointerLeave={(e) => e.pointerType === "mouse" && setOdabrana(null)}
          >
            <defs>
              {SKUPINE.map((s) => (
                <pattern key={s.kod} id={`${uid}-ostatak-${s.kod}`} width="10" height="10" patternUnits="userSpaceOnUse">
                  <rect width="10" height="10" fill={s.svijetla} />
                  <circle cx="2.5" cy="2.5" r="1.7" fill={s.boja} />
                  <circle cx="7.5" cy="7.5" r="1.7" fill={s.boja} />
                </pattern>
              ))}
              <pattern id={`${uid}-srafura`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="9" height="9" fill="rgba(255,255,255,0.18)" />
                <line x1="0" y1="0" x2="0" y2="9" stroke="#18181b" strokeWidth="3.2" strokeOpacity="0.75" />
              </pattern>
              {raspored.celije.map((c) => (
                <clipPath key={c.kod} id={`${uid}-c-${sigurniId(c.kod)}`}>
                  <path d={put(c.poligon)} />
                </clipPath>
              ))}
            </defs>

            {raspored.celije.map((c) => {
              const s = SKUPINA.get(c.skupina)!;
              const rz = razine.get(c.kod);
              const dno = rz?.dno ?? 0;
              const pun = pogled === "namjena";
              return (
                <g
                  key={c.kod}
                  clipPath={`url(#${uid}-c-${sigurniId(c.kod)})`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setOdabrana(c.kod)}
                  onClick={() => setOdabrana((o) => (o === c.kod ? null : c.kod))}
                  className="cursor-pointer"
                >
                  <path d={put(c.poligon)} fill={pun ? s.boja : s.svijetla} style={{ transition: "fill 300ms" }} />
                  {!pun && rz && (
                    <>
                      {/* premali ostaci: točkasti pojas iznad iskorištenog, ispod slobodnog */}
                      <rect
                        x={-10}
                        y={0}
                        width={raspored.sirina + 20}
                        height={raspored.visina + 20}
                        fill={`url(#${uid}-ostatak-${s.kod})`}
                        style={{ transform: `translateY(${rz.ostatak}px)`, transition: "transform 500ms ease" }}
                      />
                      {/* sav iskorišteni dio; u pogledu „sklad” gornji pojas dobije šrafuru */}
                      <rect
                        x={-10}
                        y={0}
                        width={raspored.sirina + 20}
                        height={raspored.visina + 20}
                        fill={s.boja}
                        style={{ transform: `translateY(${rz.iskoristeno}px)`, transition: "transform 500ms ease" }}
                      />
                      <rect
                        x={-10}
                        y={0}
                        width={raspored.sirina + 20}
                        height={raspored.visina + 20}
                        fill={`url(#${uid}-srafura)`}
                        opacity={pogled === "sklad" ? 1 : 0}
                        style={{
                          transform: `translateY(${rz.iskoristeno}px)`,
                          transition: "transform 500ms ease, opacity 300ms",
                        }}
                      />
                      {/* dio u skladu prekrije šrafuru odozdo */}
                      <rect
                        x={-10}
                        y={0}
                        width={raspored.sirina + 20}
                        height={raspored.visina + 20}
                        fill={s.boja}
                        style={{
                          transform: `translateY(${pogled === "sklad" ? rz.uSkladu : dno}px)`,
                          transition: "transform 500ms ease",
                        }}
                      />
                    </>
                  )}
                </g>
              );
            })}

            {/* razmak od 2 px između ćelija i deblji između skupina */}
            {raspored.celije.map((c) => (
              <path key={c.kod} d={put(c.poligon)} fill="none" stroke="#fafafa" strokeWidth={3} pointerEvents="none" />
            ))}
            {raspored.skupine.map((s) => (
              <path key={s.kod} d={put(s.poligon)} fill="none" stroke="#fafafa" strokeWidth={7} pointerEvents="none" />
            ))}
            {odabranaCelija && (
              <path d={put(odabranaCelija.poligon)} fill="none" stroke="#18181b" strokeWidth={3} pointerEvents="none" />
            )}

            {raspored.celije.map((c) => {
              const r = poKodu.get(c.kod);
              if (!r) return null;
              const brojka =
                pogled === "namjena"
                  ? `${ha(r.ukupnoM2)} ha`
                  : pogled === "iskoristenost"
                    ? `${posto(r.iskoristenoM2, r.ukupnoM2)} iskorišteno`
                    : r.uSuprotnostiM2 >= 5000
                      ? `${ha(r.uSuprotnostiM2)} ha protivno`
                      : "u skladu";
              const n = natpis(c.poligon, c.sredina, KLASA.get(c.kod)!.kratko, c.kod, brojka, skala);
              if (!n) return null;
              return (
                <text
                  key={c.kod}
                  x={c.sredina[0]}
                  y={c.sredina[1]}
                  textAnchor="middle"
                  pointerEvents="none"
                  className="fill-zinc-900"
                  style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.8)", strokeWidth: 3 / skala, strokeLinejoin: "round" }}
                >
                  <tspan x={c.sredina[0]} dy={n.broj ? -n.velicina * 0.2 : n.velicina * 0.35} fontSize={n.velicina} fontWeight={700}>
                    {n.naslov}
                  </tspan>
                  {n.broj && (
                    <tspan x={c.sredina[0]} dy={n.velicina * 1.15} fontSize={n.velicina * 0.88} className="tabular-nums">
                      {n.broj}
                    </tspan>
                  )}
                </text>
              );
            })}
          </svg>
        </div>

        <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-700">
          {SKUPINE.map((s) => (
            <span key={s.kod} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-3.5 rounded-sm" style={{ background: s.boja }} aria-hidden />
              {s.naziv}
            </span>
          ))}
          {pogled !== "namjena" && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block size-3.5 rounded-sm bg-zinc-300" aria-hidden />
                svijetlo: još slobodno
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg className="size-3.5 rounded-sm" viewBox="0 0 14 14" aria-hidden>
                  <rect width="14" height="14" fill="#e4e4e7" />
                  <circle cx="3.5" cy="3.5" r="2" fill="#71717b" />
                  <circle cx="10.5" cy="10.5" r="2" fill="#71717b" />
                </svg>
                točkasto: premali ostaci (ne broje se kao slobodni)
              </span>
              {pogled === "sklad" && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="size-3.5 rounded-sm" viewBox="0 0 14 14" aria-hidden>
                    <rect width="14" height="14" fill="#71717b" />
                    <path d="M-2,4 L4,-2 M-2,11 L11,-2 M3,16 L16,3 M10,16 L16,10" stroke="#18181b" strokeWidth="2.2" />
                  </svg>
                  šrafirano: iskorišteno protivno namjeni
                </span>
              )}
            </>
          )}
        </figcaption>
      </figure>

      <div className="mt-4 min-h-28 rounded-lg border border-zinc-200 bg-white p-4" aria-live="polite">
        {odabraniRez ? (
          <Detalji
            r={odabraniRez}
            prethodno={GODINE.filter((g) => g !== godina).map((g) => ({
              godina: g,
              m2: podaci.rezultati[inacica][g].find((x) => x.kod === odabraniRez.kod)?.ukupnoM2 ?? 0,
            }))}
          />
        ) : (
          <p className="text-sm text-zinc-500">
            Dodirni ili pređi mišem preko polja za pojedinosti: koliko ga ima, koliko je iskorišteno i čime.
          </p>
        )}
      </div>

      <Tablica podaci={podaci} godina={godina} inacica={inacica} />
    </div>
  );
}

/**
 * Najduži natpis koji stane u ćeliju: ime + brojka, kod + brojka, sam kod
 * ili ništa. Širina slova procijenjena je na 0,56 visine (sistemsko pismo,
 * mješavina malih i velikih slova); ćelija bez natpisa ima brojke u
 * pojedinostima i u tablici.
 */
function natpis(
  poligon: readonly Tocka[],
  sredina: Tocka,
  ime: string,
  kod: string,
  broj: string,
  skala: number,
): { naslov: string; broj?: string; velicina: number } | null {
  const velicina = 13.5 / skala;
  const sirina = sirinaNaVisini(poligon, sredina[1]) - 10 / skala;
  const visina = visinaNaSirini(poligon, sredina[0]) - 6 / skala;
  const stane = (t: string, f = velicina) => t.length * f * 0.56 <= sirina;
  const dva = visina >= velicina * 2.3;
  if (dva && stane(ime) && stane(broj, velicina * 0.88)) return { naslov: ime, broj, velicina };
  if (dva && stane(kod) && stane(broj, velicina * 0.88)) return { naslov: kod, broj, velicina };
  if (visina >= velicina * 1.1 && stane(kod)) return { naslov: kod, velicina };
  return null;
}

function Detalji({ r, prethodno }: { r: RezultatKlase; prethodno: { godina: number; m2: number }[] }) {
  const kl = KLASA.get(r.kod)!;
  const vrste = (Object.entries(r.poVrstiM2) as [VrstaKoristenja, number][])
    .filter(([, v]) => v >= 500)
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="text-sm">
      <p className="font-bold text-zinc-900">
        <span className="font-mono">{r.kod}</span> · {kl.naziv}
      </p>
      {kl.kombinirana && (
        <p className="mt-0.5 text-zinc-600">Kombinirana namjena — plan ovdje dopušta više vrsta gradnje.</p>
      )}
      <p className="mt-2 tabular-nums text-zinc-800">
        <strong>{ha(r.ukupnoM2, 1)} ha</strong> u planu ·{" "}
        {prethodno.map((p) => `${p.godina}: ${ha(p.m2, 1)} ha`).join(" · ")}
      </p>
      <p className="mt-1 tabular-nums text-zinc-800">
        Iskorišteno <strong>{ha(r.iskoristenoM2, 1)} ha</strong> ({posto(r.iskoristenoM2, r.ukupnoM2)}), od toga u skladu s
        planom {ha(r.uSkladuM2, 1)} ha, protivno planu <strong>{ha(r.uSuprotnostiM2, 1)} ha</strong>.
        {r.ostatakM2 >= 500 && (
          <>
            {" "}
            Premalih ostataka {ha(r.ostatakM2, 1)} ha; slobodno{" "}
            {ha(Math.max(0, r.ukupnoM2 - r.iskoristenoM2 - r.ostatakM2), 1)} ha.
          </>
        )}
      </p>
      {r.uliceM2 >= 500 && (
        <p className="mt-1 tabular-nums text-zinc-600">
          {r.kod === "P"
            ? `Uključuje ${ha(r.uliceM2, 1)} ha ulica iz drugih zona.`
            : `Bez ${ha(r.uliceM2, 1)} ha ulica koje plan ucrtava u ovu zonu — pribrojene su „Ulicama i infrastrukturi”.`}
        </p>
      )}
      {vrste.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
          {vrste.map(([v, m2]) => (
            <li key={v} className="tabular-nums">
              {VRSTE[v]}: {ha(m2, 1)} ha
              {(r.suprotnoPoVrstiM2[v] ?? 0) > 0 && " · protivno"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tablica({ podaci, godina, inacica }: { podaci: PodaciInfografike; godina: Godina; inacica: string }) {
  const red = (g: Godina, kod: KodKlase) => podaci.rezultati[inacica][g].find((r) => r.kod === kod);
  return (
    <details className="mt-4 rounded-lg border border-zinc-200 bg-white">
      <summary className="fokus flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
        Sve brojke u tablici
      </summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[40rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-3 font-semibold">Namjena</th>
              {GODINE.map((g) => (
                <th key={g} className="py-2 pr-3 text-right font-semibold">
                  {g} ha
                </th>
              ))}
              <th className="py-2 pr-3 text-right font-semibold">Iskorišteno {godina}.</th>
              <th className="py-2 pr-3 text-right font-semibold">Protivno planu</th>
              <th className="py-2 text-right font-semibold">Premali ostaci</th>
            </tr>
          </thead>
          <tbody>
            {KLASE.map((k) => {
              const ovaj = red(godina, k.kod);
              if (!GODINE.some((g) => (red(g, k.kod)?.ukupnoM2 ?? 0) > 0)) return null;
              return (
                <tr key={k.kod} className="border-b border-zinc-100">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <span className="font-mono text-xs text-zinc-500">{k.kod}</span> {k.kratko}
                  </th>
                  {GODINE.map((g) => (
                    <td key={g} className={`py-1.5 pr-3 text-right ${g === godina ? "font-semibold" : ""}`}>
                      {ha(red(g, k.kod)?.ukupnoM2 ?? 0, 1)}
                    </td>
                  ))}
                  <td className="py-1.5 pr-3 text-right">
                    {ovaj ? `${ha(ovaj.iskoristenoM2, 1)} (${posto(ovaj.iskoristenoM2, ovaj.ukupnoM2)})` : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{ovaj ? ha(ovaj.uSuprotnostiM2, 1) : "—"}</td>
                  <td className="py-1.5 text-right">{ovaj ? ha(ovaj.ostatakM2, 1) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
