"use client";

/**
 * /gup/gradnja: tražilica adrese, karta i tumač klika.
 *
 * Karta (gradnja-karta.tsx) boji razlog po pikselu; klik ovdje složi popis
 * onoga što je za tu točku provjereno, redom kojim bi to pitao onaj tko želi
 * graditi, i za svaku stavku kaže prolazi li, priječi li ili postavlja uvjet:
 *
 *  - namjena s lista 1 (gradnja.ts, ZONA_GRADNJE)
 *  - što na mjestu stoji (regija iz pločice)
 *  - odredbe područja urbanog pravila (stambene i mješovite zone)
 *  - planski režim s lista 4.d i planovi na snazi (stanjeTocke, zabrana.ts)
 *  - veličina i širina slobodnog zemljišta (najmanja građevna čestica)
 *
 * i što se nije provjeravalo. Uz to čestica pod klikom: njezin obris na karti
 * i koliko je u njoj čega, iz istih piksela.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Feature, FeatureCollection } from "geojson";

import { Navod } from "@/components/gup-dokument/navod";
import { IkonaZaslona, TrazilicaAdrese, useCijeliZaslon } from "@/components/gup-grad/karta-alati";
import { kategorijeUObliku, uzorakUTocki, type Uzorak } from "@/components/gup-grad/gradnja-plocice";
import { BOJA_STAMBENE_ZONE } from "@/components/gup-grad/gradnja-karta";
import type { CiljKarte } from "@/components/gup-grad/zabrana-karta";
import {
  KATEGORIJE,
  KATEGORIJA_PO_KODU,
  OPIS_ZONE,
  SKUPINE_GRADNJE,
  ZONA_GRADNJE,
  type Kategorija,
  type Skupina,
} from "@/lib/gup-grad/gradnja";
import type { OdredbeGradnje, ZbrojGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { KLASA_PO_INDEKSU, type Klasa } from "@/lib/gup-grad/model";
import type { SvojstvaCestice } from "@/lib/gup-grad/provjera";
import { REGIJE } from "@/lib/gup-grad/regije";
import {
  BLIZU_RUBA_M,
  NAZIV_PODRUCJA,
  naslovno,
  oblik,
  plociceZaTocku,
  slojeviIzGeojsona,
  spojiOkvire,
  stanjeTocke,
  uObliku,
  type Adrese,
  type Geometrija,
  type PlocicaCestica,
  type Prijedlog,
  type Slojevi,
  type Stanje,
} from "@/lib/gup-grad/zabrana";
import { navodGradnja, navodNamjena, navodPpmin, navodTocke, tockaNaListu } from "@/lib/gup-dokument/id";
import { uHtrs } from "@/lib/gup-dokument/htrs";
import { listoviKlijent, putTocke } from "@/lib/gup-dokument/listovi-klijent";
import type { List } from "@/lib/gup-dokument/model";

const GradnjaKarta = dynamic(() => import("@/components/gup-grad/gradnja-karta").then((m) => m.GradnjaKarta), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

const ha = (v: number) => v.toLocaleString("hr-HR", { maximumFractionDigits: v < 10 ? 1 : 0 });
/** Površina iz rešetke od ~2 m, zaokružena na 5 m². */
const m2 = (v: number) => `${(Math.round(v / 5) * 5).toLocaleString("hr-HR")} m²`;
const SKUPINE: Skupina[] = ["nista", "uvjetno", "nestambeno", "stambeno"];

/** Uzorak boje kategorije kakav je na karti (na svijetlosivoj podlozi). */
export function uzorakKategorije(k: Kategorija): CSSProperties {
  const ton = `color-mix(in srgb, ${k.boja} ${Math.round(k.alfa * 100)}%, #e4e4e7)`;
  return k.tockice
    ? { backgroundColor: ton, backgroundImage: "radial-gradient(#27272a 1px, transparent 1.3px)", backgroundSize: "4px 4px" }
    : { backgroundColor: ton };
}

// ------------------------------------------------------------- čestica pod klikom

interface CesticaKlika {
  svojstva: SvojstvaCestice;
  geometrija: Geometrija;
}

/** Katastarska čestica pod točkom iz pločica /gup (public/geo/gup-grad/cestice), sa svojstvima i oblikom. */
function dohvacacCestica() {
  let indeks: Promise<PlocicaCestica[]> | null = null;
  const plocice = new Map<string, Promise<FeatureCollection | null>>();
  return async (lng: number, lat: number): Promise<CesticaKlika | null> => {
    indeks ??= fetch("/geo/gup-grad/cestice-indeks.json")
      .then((r) => r.json() as Promise<{ plocice: PlocicaCestica[] }>)
      .then((d) => d.plocice);
    for (const id of plociceZaTocku(await indeks, lng, lat)) {
      if (!plocice.has(id)) {
        plocice.set(
          id,
          fetch(`/geo/gup-grad/cestice/${id}.json`)
            .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
            .catch(() => null),
        );
      }
      const fc = await plocice.get(id)!;
      for (const f of fc?.features ?? []) {
        if (!f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) continue;
        const g = f.geometry as Geometrija;
        if (uObliku(oblik(g), lng, lat)) return { svojstva: f.properties as SvojstvaCestice, geometrija: g };
      }
    }
    return null;
  };
}

// ------------------------------------------------------------- provjere

type Ishod = "da" | "ne" | "uvjet" | "nevazno";

interface Provjera {
  pitanje: string;
  ishod: Ishod;
  odgovor: ReactNode;
}

const ZNAK: Record<Ishod, { znak: string; klasa: string; naziv: string }> = {
  da: { znak: "✓", klasa: "bg-emerald-100 text-emerald-800", naziv: "ne priječi" },
  ne: { znak: "✕", klasa: "bg-red-100 text-red-800", naziv: "priječi" },
  uvjet: { znak: "!", klasa: "bg-amber-100 text-amber-900", naziv: "uz uvjet" },
  nevazno: { znak: "–", klasa: "bg-zinc-100 text-zinc-500", naziv: "ne odnosi se" },
};

/** Što na mjestu stoji, po regiji iz pločice. */
const NA_MJESTU: Record<number, string> = {
  [REGIJE.zgrada]: "zgrada (iz katastra ili gradskog 3D modela 2025.)",
  [REGIJE.gradiliste]: "gradilište",
  [REGIJE.ulica]: "ulica, put ili nogostup",
  [REGIJE.parkiraliste]: "parkiralište",
  [REGIJE.javna]: "okoliš javne ustanove (škola, vrtić, bolnica, crkva)",
  [REGIJE.uredjeno]: "igralište, športski teren, trg ili groblje",
  [REGIJE.infrastruktura]: "infrastrukturna građevina (trafostanica, vodosprema, pruga, benzinska postaja)",
  [REGIJE.zelenilo]: "park ili zelenilo koje održava Grad",
  [REGIJE.okucnica]: "dvorište postojeće zgrade: zemljište koje joj odredbe propisuju uz tlocrt",
};

const NOVA_STAMBENA: Record<string, { ishod: Ishod; tekst: string }> = {
  da: { ishod: "da", tekst: "nova stambena zgrada je dopuštena" },
  interpolacija: { ishod: "uvjet", tekst: "nova stambena zgrada samo kao interpolacija, između dvije izgrađene čestice" },
  upu: { ishod: "uvjet", tekst: "nova stambena gradnja samo kroz propisani UPU ili DPU" },
  rekonstrukcija: { ishod: "ne", tekst: "samo rekonstrukcija i zamjena postojećih zgrada, nova stambena zgrada nije dopuštena" },
  ne: { ishod: "ne", tekst: "stambena gradnja nije dopuštena" },
  gp: { ishod: "uvjet", tekst: "gradski projekt: gradi se u ukupnoj kvoti bruto površine za cijeli projekt" },
};

const TIP_GRADNJE: Record<string, string> = {
  slobodnostojeca: "slobodnostojeća",
  dvojna: "dvojna",
  interpolacija: "interpolacija",
  opcenito: "bez navedene vrste",
  niz: "u nizu",
};

/** Mjesto klika na službenom listu, ako list ima uklapanje; inače navod cijelog lista. */
function NaListu({ list, navod, tocka, listovi, children }: { list: string; navod: string; tocka: [number, number]; listovi: Record<string, List> | null; children: ReactNode }) {
  const l = listovi?.[list];
  const t = l && tockaNaListu(l.uklapanje, uHtrs(tocka[1], tocka[0]));
  if (!l || !t) return <Navod id={navod}>{children}</Navod>;
  const id = navodTocke(list, t);
  return (
    <a href={putTocke(l, t)} data-gup-navod={id} className="navod fokus">
      {children}
    </a>
  );
}

function provjere(
  tocka: [number, number],
  u: Uzorak | null,
  s: Stanje,
  c: CesticaKlika | null,
  o: OdredbeGradnje,
  listovi: Record<string, List> | null,
): Provjera[] {
  const navod = (id: string, tekst: ReactNode) => (o.navodi.includes(id) ? <Navod id={id}>{tekst}</Navod> : tekst);
  const klasa: Klasa | undefined = u ? KLASA_PO_INDEKSU.get(u.klasa) : undefined;
  const zona = klasa ? ZONA_GRADNJE[klasa.kod] : null;
  const out: Provjera[] = [];

  // 1. namjena
  out.push({
    pitanje: "Namjena po novom GUP-u",
    ishod: !zona ? "nevazno" : zona === "stambena" ? "da" : "ne",
    odgovor: klasa ? (
      <>
        {navod(navodNamjena(2025, klasa.kod), <strong>{klasa.naziv}</strong>)} {klasa.kod !== "P" && `(${klasa.kod})`} — {OPIS_ZONE[zona!]}
        {zona === "nestambena" && " (stambenu zgradu ne)"}. Vidi{" "}
        <NaListu list="namjena-2025" navod="list-namjena-2025" tocka={tocka} listovi={listovi}>
          ovo mjesto na listu 1
        </NaListu>
        .
      </>
    ) : (
      "Na ovom mjestu nema katastarske čestice kojoj GUP daje namjenu (more, lučko područje ili neupisano)."
    ),
  });
  if (!u || !klasa) return out;

  // 2. što stoji
  const slobodno = u.regija >= REGIJE.slobodno;
  out.push({
    pitanje: "Je li mjesto slobodno",
    ishod: slobodno ? "da" : "ne",
    odgovor: slobodno ? (
      "Da: nema zgrade, ulice, parkirališta ni uređene površine, i ne pripada dvorištu postojeće zgrade."
    ) : (
      <>Ne, ovdje je {NA_MJESTU[u.regija] ?? "nešto izgrađeno"}.</>
    ),
  });

  // 3. odredbe urbanog pravila
  const kod = c?.svojstva.u?.["2025"];
  const pravilo = kod ? o.gradnja[kod] : undefined;
  const nazivPravila = kod ? (
    <>
      {navod(navodGradnja(2025, kod), <>područje urbanog pravila {kod}</>)}
      {o.nazivi[kod] ? <> („{o.nazivi[kod]}”)</> : null}
    </>
  ) : null;
  if (zona === "stambena") {
    const ns = pravilo ? NOVA_STAMBENA[pravilo.nova_stambena] : undefined;
    out.push({
      pitanje: "Dopuštaju li odredbe novu stambenu zgradu",
      ishod: ns?.ishod ?? "da",
      odgovor: kod ? (
        <>
          {nazivPravila}: {ns?.tekst ?? "odredbe ne ograničavaju novu stambenu gradnju"}.
        </>
      ) : (
        "Za ovo mjesto list urbanih pravila nema područja, pa odredbe novu gradnju posebno ne ograničavaju."
      ),
    });
  } else {
    out.push({
      pitanje: "Dopuštaju li odredbe novu stambenu zgradu",
      ishod: "nevazno",
      odgovor: <>Odredbe urbanih pravila razlikuju stambenu gradnju samo u stambenim i mješovitim zonama{kod ? <>; ovo je {nazivPravila}</> : null}.</>,
    });
  }

  // 4. planski režim
  const list4d = (t: ReactNode) => (
    <NaListu list="planske-mjere-2025" navod="list-planske-mjere-2025" tocka={tocka} listovi={listovi}>
      {t}
    </NaListu>
  );
  let rezim: Provjera;
  switch (s.rezim) {
    case "zabrana":
    case "negradivo": {
      const upu = s.upu ? s.upu.naziv : "UPU";
      if (s.rezim === "negradivo") {
        rezim = {
          pitanje: "Čeka li gradnja UPU",
          ishod: "nevazno",
          odgovor: <>Mjesto je u {list4d(NAZIV_PODRUCJA[s.podrucje])}, ali ondje ionako nije namjena za privatnu gradnju.</>,
        };
      } else if (s.podrucje === "neuredeno") {
        rezim = {
          pitanje: "Čeka li gradnja UPU",
          ishod: "uvjet",
          odgovor: (
            <>
              Ovo je {list4d(NAZIV_PODRUCJA.neuredeno)}: gradi se po {upu} (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>), a
              do njega nova zgrada samo ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja (Zakon o prostornom
              uređenju, NN 155/25, čl. 180. st. 2. t. 3.).
            </>
          ),
        };
      } else if (klasa.kod === "D") {
        rezim = {
          pitanje: "Čeka li gradnja UPU",
          ishod: "uvjet",
          odgovor: (
            <>
              Ovo je {list4d(NAZIV_PODRUCJA[s.podrucje])}, gdje se gradi po {upu}, ali javne i društvene zgrade smiju se graditi i
              prije njega (<Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>).
            </>
          ),
        };
      } else {
        rezim = {
          pitanje: "Čeka li gradnja UPU",
          ishod: "ne",
          odgovor: (
            <>
              Da. Ovo je {list4d(NAZIV_PODRUCJA[s.podrucje])}: gradi se samo po {upu} (
              <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>), a do njega su dopuštene samo rekonstrukcija i zamjena
              postojećih zgrada. Novi GUP ne daje ni rok ni novac za taj plan.
            </>
          ),
        };
      }
      break;
    }
    case "vazeci":
      rezim = {
        pitanje: "Čeka li gradnja UPU",
        ishod: "uvjet",
        odgovor: (
          <>
            Ne, ali ovdje je na snazi {s.plan.naziv}
            {s.plan.glasnik ? ` („Službeni glasnik Grada Splita”, br. ${s.plan.glasnik})` : ""}, pa se gradi po njemu (
            <Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>). Njegove odredbe mogu biti strože od GUP-a, a ovdje ih nismo
            provjerili.
          </>
        ),
      };
      break;
    case "preporuka":
      rezim = {
        pitanje: "Čeka li gradnja UPU",
        ishod: "da",
        odgovor: (
          <>
            Ne. Za ovo područje GUP preporučuje {s.upu.naziv}, ali do njega se gradi po GUP-u (
            <Navod id="preporuka-plana-2025">čl. 103. st. 4.</Navod>).
          </>
        ),
      };
      break;
    default:
      rezim = {
        pitanje: "Čeka li gradnja UPU",
        ishod: "da",
        odgovor: <>Ne: na {list4d("listu 4.d")} ovo mjesto nije ni u području koje čeka UPU ni u planu na snazi, pa se gradi po GUP-u.</>,
      };
  }
  out.push(rezim);

  // 5. veličina i širina
  const vrsta = zona === "stambena" ? "stanovanje" : klasa.kod === "D" ? "javna" : klasa.kod === "I/K" ? "gospodarska" : null;
  const najmanja = vrsta && kod ? o.ppmin[kod]?.[vrsta] : undefined;
  const najmanjaTekst = najmanja ? (
    <>
      najmanja građevna čestica ovdje je {navod(navodPpmin(2025, kod!), m2(najmanja.m2))} (vrsta „{TIP_GRADNJE[najmanja.tip] ?? najmanja.tip}”)
    </>
  ) : null;
  if (!slobodno || zona === "bez-zgrada" || zona === "promet") {
    out.push({ pitanje: "Je li slobodno dovoljno za novu česticu", ishod: "nevazno", odgovor: "Ne odnosi se: mjesto nije slobodno ili namjena ne predviđa zgrade." });
  } else if (u.regija === REGIJE.usko) {
    out.push({
      pitanje: "Je li slobodno dovoljno za novu česticu",
      ishod: "ne",
      odgovor: "Ne: slobodni pojas uži je od ~9 m (put, stube, rub uz među), a odredbe traže česticu široku barem 10 m.",
    });
  } else if (u.regija === REGIJE.premalo) {
    out.push({
      pitanje: "Je li slobodno dovoljno za novu česticu",
      ishod: "ne",
      odgovor: (
        <>
          Ne: slobodni komad manji je od najmanje građevne čestice{najmanjaTekst ? <> ({najmanjaTekst})</> : null}, a nema slobodnog
          susjeda iste namjene s kojim bi to dosegao.
        </>
      ),
    });
  } else if (u.regija === REGIJE.slobodno || u.regija === REGIJE.ceka) {
    out.push({
      pitanje: "Je li slobodno dovoljno za novu česticu",
      ishod: "da",
      odgovor: najmanjaTekst ? (
        <>Da: {najmanjaTekst}, a slobodnog zemljišta, zajedno sa slobodnim susjedima iste namjene, ima barem toliko i šire je od ~9 m.</>
      ) : (
        "Da: slobodni komad širi je od ~9 m, a odredbe ovdje ne propisuju najmanju građevnu česticu."
      ),
    });
  }

  // 6. teren, samo kad je pregledom označen
  if (u.regija === REGIJE.neizgradivo) {
    out.push({ pitanje: "Može li se teren graditi", ishod: "ne", odgovor: "Ne: pregled ortofota pokazao je da se ovaj teren ne može graditi." });
  }
  return out;
}

// ------------------------------------------------------------- prikaz

interface Kartica {
  tocka: [number, number];
  podnaslov?: string;
  uzorak: Uzorak | null;
  stanje: Stanje;
  cestica: CesticaKlika | null;
  /** m² po kodu kategorije u čestici; null dok se broji */
  sastav: Map<number, number> | null;
}

interface Podaci {
  slojevi: Slojevi;
  gup: Feature | null;
  /** stambene i mješovite zone (gradnja-zone-2025.geojson) */
  zone: FeatureCollection;
}

function UzorakBoje({ stil }: { stil: CSSProperties }) {
  return <span aria-hidden className="inline-block h-4 w-6 shrink-0 rounded-sm ring-1 ring-inset ring-black/10" style={stil} />;
}

/** Crta tumača kao na karti (iste crtice). */
function Crta({ boja, crtice }: { boja: string; crtice?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 16" className="h-4 w-6 shrink-0">
      <line x1="0" y1="8" x2="24" y2="8" stroke={boja} strokeWidth={crtice ? 1.5 : 2} strokeDasharray={crtice} />
    </svg>
  );
}

/** Sastav čestice po kategorijama: traka i popis. */
function SastavCestice({ sastav, ukupno }: { sastav: Map<number, number>; ukupno: number }) {
  const redovi = KATEGORIJE.map((k) => ({ k, v: sastav.get(k.kod) ?? 0 })).filter((r) => r.v >= 5);
  if (!redovi.length || ukupno <= 0) return null;
  return (
    <div className="mt-2">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Sastav čestice po razlogu">
        {redovi.map(({ k, v }) => (
          <span key={k.kod} style={{ ...uzorakKategorije(k), width: `${(v / ukupno) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-600">
        {redovi.map(({ k, v }) => (
          <li key={k.kod} className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={uzorakKategorije(k)} />
            <span className="flex-1">{k.naziv}</span>
            <span className="tabular-nums text-zinc-800">{m2(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TumacKlika({ k, odredbe, listovi }: { k: Kartica; odredbe: OdredbeGradnje; listovi: Record<string, List> | null }) {
  if (k.stanje.rezim === "izvan") {
    return (
      <>
        <h3 className="pr-8 text-base font-bold leading-snug text-zinc-900">Izvan obuhvata GUP-a</h3>
        {k.podnaslov && <p className="font-mono text-xs text-zinc-500">{k.podnaslov}</p>}
        <p className="mt-2">
          Ovdje vrijedi Prostorni plan uređenja Grada Splita, a ova karta sudi samo o području GUP-a (iscrtkana granica).
        </p>
      </>
    );
  }
  const kat = k.uzorak ? KATEGORIJA_PO_KODU.get(k.uzorak.kategorija) : undefined;
  const lista = provjere(k.tocka, k.uzorak, k.stanje, k.cestica, odredbe, listovi);
  const c = k.cestica?.svojstva;
  const ukupno = k.sastav ? [...k.sastav.values()].reduce((a, b) => a + b, 0) : 0;
  return (
    <>
      {kat ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/60" style={{ background: kat.boja }} />
          {SKUPINE_GRADNJE[kat.skupina].kratko}
        </span>
      ) : null}
      <h3 className="mt-2 pr-8 text-base font-bold leading-snug text-zinc-900">{kat ? kat.naziv : "Nema čestice u obuhvatu"}</h3>
      {k.podnaslov && <p className="font-mono text-xs text-zinc-500">{k.podnaslov}</p>}
      {kat && <p className="mt-1.5 text-zinc-800">{kat.razlog}</p>}

      <h4 className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Što je provjereno za ovu točku</h4>
      <ol className="mt-1.5 space-y-2">
        {lista.map((p) => (
          <li key={p.pitanje} className="flex gap-2.5">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${ZNAK[p.ishod].klasa}`}
              title={ZNAK[p.ishod].naziv}
            >
              <span aria-hidden>{ZNAK[p.ishod].znak}</span>
              <span className="sr-only">{ZNAK[p.ishod].naziv}</span>
            </span>
            <div>
              <p className="font-semibold text-zinc-900">{p.pitanje}</p>
              <p>{p.odgovor}</p>
            </div>
          </li>
        ))}
      </ol>
      {"doRuba" in k.stanje && k.stanje.doRuba < BLIZU_RUBA_M && (
        <p className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-800">
          Mjesto je oko {Math.max(1, Math.round(k.stanje.doRuba))} m od ruba područja s lista 4.d, koje je precrtano sa skeniranog
          lista: za česticu uz rub provjeri sam list.
        </p>
      )}

      {c && (
        <div className="mt-3 border-t border-zinc-200 pt-2.5">
          <p className="font-semibold text-zinc-900">
            Čestica k.č. {c.kc}, k.o. {naslovno(c.ko)}{" "}
            <span className="font-normal text-zinc-500">· {c.a.toLocaleString("hr-HR")} m² u katastru</span>
          </p>
          {k.sastav ? <SastavCestice sastav={k.sastav} ukupno={ukupno} /> : <p className="text-xs text-zinc-500">Broji se…</p>}
        </div>
      )}

      <details className="mt-3 border-t border-zinc-200 pt-2.5">
        <summary className="fokus cursor-pointer font-semibold text-zinc-900">Što karta ne provjerava</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-600">
          <li>vlasništvo, pristup čestice na javnu cestu i priključke (voda, odvodnja, struja)</li>
          <li>nagib, stijenu i tlo, osim mjesta koja su ručnim pregledom ortofota označena kao neizgradiva</li>
          <li>zaštitu kulturne baštine i krajobraza (konzervatorski uvjeti), pojas uz more i vodotoke</li>
          <li>posebne uvjete javnopravnih tijela i infrastrukturne koridore koji nisu ucrtani kao ulica</li>
          {k.stanje.rezim === "vazeci" && <li>odredbe plana užeg područja koji je ovdje na snazi</li>}
        </ul>
        <p className="mt-1.5 text-zinc-600">
          Namjena je pročitana s PDF lista u rešetki od 2 m; uz granicu zone pogreška je 5–10 m. Za odluku o kupnji ili gradnji
          zatraži lokacijsku informaciju od Grada.
        </p>
      </details>
    </>
  );
}

export function GradnjaPrikaz({ zbroj, odredbe }: { zbroj: ZbrojGradnje; odredbe: OdredbeGradnje }) {
  const [podaci, setPodaci] = useState<Podaci | null>(null);
  const [greska, setGreska] = useState(false);
  const [skrivene, setSkrivene] = useState<ReadonlySet<Skupina>>(new Set());
  const [cilj, setCilj] = useState<CiljKarte | null>(null);
  const [kartica, setKartica] = useState<Kartica | null>(null);
  const [listovi, setListovi] = useState<Record<string, List> | null>(null);
  const dohvatiCesticu = useRef(dohvacacCestica());
  const zadnjiKlik = useRef(0);
  const kljuc = useRef(0);
  const okvirKarte = useRef<HTMLDivElement>(null);
  const cijeli = useRef<HTMLDivElement>(null);
  const [puno, prebaciZaslon] = useCijeliZaslon(cijeli);

  useEffect(() => {
    const dohvati = (u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : Promise.reject(new Error(u))));
    Promise.all([
      dohvati("/geo/gup-grad/zabrana-2025.geojson"),
      dohvati("/geo/gup-grad/planski-rezim-2025.geojson"),
      dohvati("/geo/gup-grad/gradnja-zone-2025.geojson"),
    ])
      .then(([zabrana, planovi, zone]) =>
        setPodaci({
          slojevi: slojeviIzGeojsona(zabrana, planovi),
          gup: zabrana.features.find((f) => f.properties?.vrsta === "gup") ?? null,
          zone,
        }),
      )
      .catch(() => setGreska(true));
  }, []);

  const pomakni = (c: Omit<CiljKarte, "kljuc">) => setCilj({ ...c, kljuc: ++kljuc.current });
  const doKarte = () => {
    if (!puno && window.matchMedia("(max-width: 640px)").matches) okvirKarte.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const pokaziTocku = async (lng: number, lat: number, podnaslov?: string) => {
    if (!podaci) return;
    const n = ++zadnjiKlik.current;
    const stanje = stanjeTocke(podaci.slojevi, lng, lat);
    void listoviKlijent().then((l) => setListovi(l));
    const [uzorak, cestica] = await Promise.all([
      uzorakUTocki(lng, lat).catch(() => null),
      stanje.rezim === "izvan" ? Promise.resolve(null) : dohvatiCesticu.current(lng, lat).catch(() => null),
    ]);
    // stariji odgovor ne smije prebrisati noviji klik
    if (n !== zadnjiKlik.current) return;
    setKartica({ tocka: [lng, lat], podnaslov, uzorak, stanje, cestica, sastav: null });
    if (cestica) {
      const sastav = await kategorijeUObliku(cestica.geometrija).catch(() => null);
      if (n === zadnjiKlik.current) setKartica((k) => (k ? { ...k, sastav } : k));
    }
  };

  const odaberi = (p: Prijedlog, adrese: Adrese) => {
    if (p.vrsta === "adresa") {
      void pokaziTocku(p.adresa.lng, p.adresa.lat, `${p.naziv} · ${p.kotar}`);
      pomakni({ tocka: [p.adresa.lng, p.adresa.lat] });
    } else {
      const okvir = spojiOkvire(adrese.brojevi.filter((b) => b.ulica === p.ulica).map((b) => [b.lng, b.lat, b.lng, b.lat]));
      if (okvir) pomakni({ okvir });
      zadnjiKlik.current++;
      setKartica(null);
    }
    doKarte();
  };

  const prebaciSkupinu = (s: Skupina, vidi: boolean) =>
    setSkrivene((stare) => {
      const nove = new Set(stare);
      if (vidi) nove.delete(s);
      else nove.add(s);
      return nove;
    });

  const kategorijePoSkupini = useMemo(
    () => Object.fromEntries(SKUPINE.map((s) => [s, KATEGORIJE.filter((k) => k.skupina === s && (zbroj.po_kategoriji_ha[k.id] ?? 0) > 0)])),
    [zbroj],
  ) as Record<Skupina, Kategorija[]>;

  return (
    <div>
      <div
        ref={cijeli}
        className={
          puno
            ? "fixed inset-0 z-[1300] flex flex-col bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3"
            : ""
        }
      >
        <TrazilicaAdrese
          id="gradnja-adresa"
          natpis="Provjeri adresu"
          sakrijNatpis={puno}
          podnaslov={puno ? undefined : "Ili klikni bilo gdje na karti: reći će što je provjereno i što ondje priječi gradnju."}
          onOdaberi={odaberi}
        />

        <div
          ref={okvirKarte}
          className={
            puno
              ? "relative mt-2 min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
              : "relative mt-3 h-[70svh] min-h-[420px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:h-[620px]"
          }
        >
          {podaci ? (
            <GradnjaKarta
              gup={podaci.gup}
              zone={podaci.zone}
              skrivene={skrivene}
              cilj={cilj}
              oznaka={kartica ? { lng: kartica.tocka[0], lat: kartica.tocka[1] } : null}
              cestica={kartica?.cestica?.geometrija ?? null}
              punZaslon={puno}
              onKlik={(lng, lat) => void pokaziTocku(lng, lat)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              {greska ? "Karta se nije učitala. Osvježi stranicu." : "Karta se učitava…"}
            </div>
          )}
          {podaci && (
            <button
              type="button"
              onClick={prebaciZaslon}
              aria-pressed={puno}
              aria-label={puno ? "Vrati kartu na stranicu" : "Karta preko cijelog zaslona"}
              title={puno ? "Vrati kartu na stranicu (Esc)" : "Karta preko cijelog zaslona"}
              className="fokus absolute left-[10px] top-[84px] z-[1000] grid h-[34px] w-[34px] place-items-center rounded border-2 border-black/20 bg-white bg-clip-padding text-zinc-900 hover:bg-zinc-50"
            >
              <IkonaZaslona puno={puno} />
            </button>
          )}
          {kartica && (
            <div
              aria-live="polite"
              className="absolute inset-x-2 bottom-2 z-[1000] max-h-[72%] overflow-y-auto rounded-xl bg-white p-4 text-sm leading-relaxed text-zinc-700 shadow-lg sm:inset-x-auto sm:left-3 sm:w-[26rem]"
            >
              <button
                type="button"
                aria-label="Zatvori"
                onClick={() => {
                  zadnjiKlik.current++;
                  setKartica(null);
                }}
                className="fokus absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-lg text-zinc-500 hover:bg-zinc-100"
              >
                ×
              </button>
              <TumacKlika k={kartica} odredbe={odredbe} listovi={listovi} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-5 text-sm text-zinc-700 sm:grid-cols-2">
        {SKUPINE.map((s) => (
          <fieldset key={s}>
            <legend className="w-full">
              <label className="flex cursor-pointer items-center gap-2 font-semibold text-zinc-900">
                <input
                  type="checkbox"
                  checked={!skrivene.has(s)}
                  onChange={(e) => prebaciSkupinu(s, e.target.checked)}
                  className="h-4 w-4 accent-zinc-900"
                />
                <span className="flex-1">{SKUPINE_GRADNJE[s].naslov}</span>
                <span className="tabular-nums font-normal text-zinc-500">{ha(zbroj.po_skupini_ha[s])} ha</span>
              </label>
            </legend>
            <ul className={`mt-1.5 space-y-1.5 pl-6 ${skrivene.has(s) ? "opacity-40" : ""}`}>
              {kategorijePoSkupini[s].map((k) => (
                <li key={k.id} className="flex items-center gap-2">
                  <UzorakBoje stil={uzorakKategorije(k)} />
                  <span className="flex-1">{k.naziv}</span>
                  <span className="tabular-nums text-zinc-500">{ha(zbroj.po_kategoriji_ha[k.id])} ha</span>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
        <ul className="space-y-1.5 sm:col-span-2">
          <li className="flex items-center gap-2">
            <Crta boja={BOJA_STAMBENE_ZONE} />
            <span>zona stambene ili mješovite namjene (S, M1–M3, K5): ondje novi GUP predviđa stanovanje</span>
          </li>
          <li className="flex items-center gap-2">
            <Crta boja="#18181b" crtice="7 5" />
            <span>granica GUP-a; izvan nje karta ne sudi</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
