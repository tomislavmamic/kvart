"use client";

/**
 * /gup/gradnja u dva prikaza, s prekidačem:
 *
 *  - Pregled: tražilica adrese, brojke (koliko je čega i što u zonama za
 *    stanovanje priječi gradnju) i objašnjenja sa stranice (`children`).
 *    Svaki redak brojki otvara kartu s tim slojem.
 *  - Karta: preko cijelog zaslona (gradnja-karta.tsx). Gore tražilica i
 *    prekidači slojeva; zadano je upaljeno samo stambeno. „Što priječi
 *    gradnju” istakne jednu skupinu razloga (PREPREKE). Klik otvara karticu
 *    s provjerama (gradnja-provjere.tsx): na mobitelu ploča odozdo, na
 *    računalu stupac lijevo, a karta odabranu česticu pomakne izvan nje.
 *    „Podijeli” napravi sliku pogleda s tumačem (gradnja-slika.ts).
 *
 * Stanje je u poveznici (gradnja-url.ts), pa se pogled može podijeliti, a
 * tipka Natrag zatvara karticu i kartu.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type * as LeafletNS from "leaflet";
import type { Feature, FeatureCollection } from "geojson";

import { Navod } from "@/components/gup-dokument/navod";
import { TrazilicaAdrese } from "@/components/gup-grad/karta-alati";
import { kategorijeUObliku, uzorakUTocki, type Uzorak } from "@/components/gup-grad/gradnja-plocice";
import { BOJA_STAMBENE_ZONE, OBRISI_OD_ZUMA, type Pogled, type Prikaz, type Zaklon } from "@/components/gup-grad/gradnja-karta";
import { cesticeUTocki, datumHr, type AktGradnje, type PodaciDozvola } from "@/lib/gup-grad/gradnja-dozvole";
import {
  dohvacacCestica,
  kljucPuta,
  m2,
  provjere,
  ZNAK,
  type CesticaKlika,
  type Provjera,
  type PutCestice,
  type Putovi,
} from "@/components/gup-grad/gradnja-provjere";
import { napisiUrl, procitajUrl, zadanoSkrivene, type Prozor } from "@/components/gup-grad/gradnja-url";
import { slikaKarte, type StavkaLegende } from "@/components/gup-grad/gradnja-slika";
import { PODLOGE, type CiljKarte } from "@/components/gup-grad/zabrana-karta";
import {
  ALFA_PREPREKE,
  BOJA_PREPREKE,
  KATEGORIJE,
  KATEGORIJA_PO_ID,
  KATEGORIJA_PO_KODU,
  kodNaKarti,
  punNaziv,
  istiIzgled,
  PREPREKE,
  PREPREKA_PO_ID,
  SKUPINE_GRADNJE,
  uzorakKategorije,
  VLASNIK_JAVNOG,
  type IdKategorije,
  type IdPrepreke,
  type Kategorija,
  type KodVlasnika,
  type Skupina,
} from "@/lib/gup-grad/gradnja";
import type { MjestaGradnje, OdredbeGradnje, ZbrojGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { BLIZU_RUBA_M, naslovno, slojeviIzGeojsona, spojiOkvire, stanjeTocke, type Adrese, type Prijedlog, type Slojevi, type Stanje } from "@/lib/gup-grad/zabrana";
import { listoviKlijent } from "@/lib/gup-dokument/listovi-klijent";
import type { List } from "@/lib/gup-dokument/model";
import { SITE_URL } from "@/lib/metadata";

const GradnjaKarta = dynamic(() => import("@/components/gup-grad/gradnja-karta").then((m) => m.GradnjaKarta), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-200" />,
});

const ha = (v: number) => v.toLocaleString("hr-HR", { maximumFractionDigits: v < 10 ? 1 : 0 });
const posto = (v: number) => `${Math.round(v * 100).toLocaleString("hr-HR")} %`;
/** Redom kojim ih karta nudi: odgovor na koji stranica odgovara prvi. */
const SKUPINE: Skupina[] = ["stambeno", "nestambeno", "nista", "javno", "plan"];
const KRATKO: Record<Skupina, string> = { stambeno: "Stambeno", nestambeno: "Nestambeno", nista: "Ništa novo", javno: "Javno", plan: "DPU" };
const SIROKO = "(min-width: 640px)";
/** Kategorije zahtjeva i dozvola (gradnja.ts): dok je koja na karti, vide se i međe unutar njihovih skupina. */
const DOZVOLE: readonly IdKategorije[] = ["stambeno-zahtjev", "stambeno-dozvola", "nestambeno-zahtjev", "nestambeno-dozvola"];
/** Desni stupac kartice na računalu: širina i razmak od ruba. */
const STUPAC = 400;
const RAZMAK = 12;

// ------------------------------------------------------------- kartica klika

interface Kartica {
  tocka: [number, number];
  podnaslov?: string;
  uzorak: Uzorak | null;
  stanje: Stanje;
  cestica: CesticaKlika | null;
  /** m² po kodu kategorije u čestici; null dok se broji */
  sastav: Map<number, number> | null;
}

/** Kartica s dozvolama na čestici pod točkom i svim česticama tih akata (skupina); dozvole mogu stići i poslije klika. */
interface KarticaSDozvolama extends Kartica {
  akti: AktGradnje[];
  skupina: number[];
}

interface Podaci {
  slojevi: Slojevi;
  gup: Feature | null;
  /** stambene i mješovite zone (gradnja-zone-2025.geojson) */
  zone: FeatureCollection;
  /** detaljni planovi na snazi (DPU, PUP) iz planski-rezim-2025.geojson */
  dpu: FeatureCollection;
}

function UzorakBoje({ stil, malo = false }: { stil: CSSProperties; malo?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-sm ring-1 ring-inset ring-black/10 ${malo ? "h-3 w-3" : "h-4 w-6"}`}
      style={stil}
    />
  );
}

const STIL_PREPREKE: CSSProperties = { backgroundColor: `color-mix(in srgb, ${BOJA_PREPREKE} ${ALFA_PREPREKE * 100}%, #a6a6a6)` };

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
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Od čega se sastoji čestica">
        {redovi.map(({ k, v }) => (
          <span key={k.kod} style={{ ...uzorakKategorije(k), width: `${(v / ukupno) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-600">
        {redovi.map(({ k, v }) => (
          <li key={k.kod} className="flex items-center gap-2">
            <UzorakBoje stil={uzorakKategorije(k)} malo />
            <span className="flex-1">{punNaziv(k)}</span>
            <span className="tabular-nums text-zinc-800">{m2(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Kategorija koju karta pokazuje za uzorak: javno zemljište kao javno, a razlog ispod njega ostaje za objašnjenje. */
function presuda(u: Uzorak | null): { kat: Kategorija | undefined; javno: boolean; ispod: Kategorija | undefined } {
  const ispod = u ? KATEGORIJA_PO_KODU.get(u.kategorija) : undefined;
  const kat = u ? KATEGORIJA_PO_KODU.get(kodNaKarti(u.kategorija, u.vlasnik)) : undefined;
  return { kat, javno: kat?.id === "javno", ispod };
}

/** Vrh kartice: presuda, naslov, adresa i čestica, zbroj provjera. Na mobitelu to je sve što se vidi dok se kartica ne raširi. */
/** Dugi popis čestica akta: prvih nekoliko i koliko ih je još. */
function skratiPopis(kc: string, najvise = 6): string {
  const [popis, ko] = kc.split(/\s+(?=k\.o\.)/);
  const dijelovi = popis.split(/,\s*/);
  if (dijelovi.length <= najvise) return kc;
  return `${dijelovi.slice(0, najvise).join(", ")} i još ${dijelovi.length - najvise}${ko ? ` ${ko}` : ""}`;
}

/** Dozvole na čestici: što je izdano ili traženo, kad, za što, i koliko čestica akt zahvaća. */
function DozvoleKlika({ akti }: { akti: AktGradnje[] }) {
  if (!akti.length) return null;
  return (
    <div className="mt-3 border-t border-zinc-200 pt-2.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {akti.some((a) => a.ishod === "izdana") ? "Ovdje se gradi ili smije graditi" : "Ovdje se traži dozvola"}
      </h3>
      <ul className="mt-1.5 space-y-2.5">
        {akti.map((a) => (
          <li key={a.klasa}>
            <p className="font-semibold text-zinc-900">
              {a.akt}
              {a.ishod === "izdana" ? `, izdana ${datumHr(a.rijeseno)}` : `: u obradi od ${datumHr(a.zaprimljeno)}`}
            </p>
            <p className="text-zinc-700">
              {[a.zahvat, a.namjena].filter(Boolean).join(", ")}
              {a.adresa && a.adresa !== "Split" ? ` · ${a.adresa}` : ""}
            </p>
            <p className="text-xs text-zinc-500">
              k.č. {skratiPopis(a.kc)}
              {a.cestice.length > 1 ? ` · ${a.cestice.length} čestice obrubljene na karti` : ""} · {a.klasa}
            </p>
            {a.poveznica && (
              <a href={a.poveznica} target="_blank" rel="noopener noreferrer" className="fokus meta text-xs font-semibold text-emerald-700 underline">
                Predmet u eDozvoli
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        Iz registra akata na geoportalu ISPU. Građevinska dozvola vrijedi 3 godine, lokacijska 2 (uz jedno produljenje); karta
        pokazuje izdane od 2020. i zahtjeve u obradi.
      </p>
    </div>
  );
}

/**
 * Vrh kartice: presuda kao traka u boji kategorije (isti uzorak kao na karti), adresa i čestica, pa imenovane
 * zapreke i uvjeti. Na mobitelu je to sve što se vidi dok se kartica ne raširi.
 */
function ZaglavljeKlika({ k, lista, saZaprekama }: { k: KarticaSDozvolama; lista: Provjera[]; saZaprekama: boolean }) {
  if (k.stanje.rezim === "izvan")
    return (
      <>
        <h2 className="text-base font-bold leading-snug text-zinc-900">Izvan područja GUP-a</h2>
        {k.podnaslov && <p className="text-xs text-zinc-500">{k.podnaslov}</p>}
      </>
    );
  const { kat } = presuda(k.uzorak);
  const c = k.cestica?.svojstva;
  const mjesto = [k.podnaslov, c ? `k.č. ${c.kc}, k.o. ${naslovno(c.ko)}` : null].filter(Boolean).join(" · ");
  const vazno = lista.filter((p) => p.ishod === "ne" || p.ishod === "uvjet");
  // dozvola i zapreka zajedno: podnaslov kaže oboje, da zeleno „može” i crvena zapreka ne proturječe
  const akt = k.akti.find((a) => a.ishod === "izdana") ?? k.akti[0];
  const prvaZapreka = lista.find((p) => p.ishod === "ne");
  const podnaslov = akt
    ? [
        akt.ishod === "izdana" ? `Gradnja odobrena ${datumHr(akt.rijeseno)}` : `Dozvola zatražena ${datumHr(akt.zaprimljeno)}`,
        prvaZapreka ? (prvaZapreka.sazetak ?? prvaZapreka.pitanje) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : kat
      ? SKUPINE_GRADNJE[kat.skupina].naslov
      : null;
  return (
    <>
      <div className="flex items-start gap-3">
        {kat && <span aria-hidden className="mt-0.5 h-9 w-9 shrink-0 rounded-lg ring-1 ring-inset ring-black/10" style={uzorakKategorije(kat)} />}
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-zinc-900">{kat ? punNaziv(kat) : "Ovdje nema katastarske čestice"}</h2>
          {podnaslov && <p className="text-sm leading-snug text-zinc-600">{podnaslov}</p>}
        </div>
      </div>
      {mjesto && <p className="mt-1.5 text-xs text-zinc-500">{mjesto}</p>}
      {saZaprekama && vazno.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-sm">
          {vazno.map((p) => (
            <li key={p.pitanje} className={`flex gap-1.5 ${p.ishod === "ne" ? "text-red-800" : "text-amber-900"}`}>
              <span aria-hidden className="w-3 shrink-0 font-bold">
                {ZNAK[p.ishod].znak}
              </span>
              <span>
                <span className="sr-only">{ZNAK[p.ishod].naziv}: </span>
                {p.sazetak ?? p.pitanje}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TijeloKlika(props: {
  k: KarticaSDozvolama;
  odredbe: OdredbeGradnje;
  listovi: Record<string, List> | null;
  putovi: Putovi | null;
  skriveno: boolean;
  onPrikazi: () => void;
}) {
  const { k, odredbe, listovi, putovi, skriveno, onPrikazi } = props;
  if (k.stanje.rezim === "izvan")
    return (
      <p className="mt-2">Ovdje vrijedi Prostorni plan uređenja Grada Splita. Ova karta pokriva samo područje GUP-a, unutar iscrtkane granice.</p>
    );
  const { kat, javno, ispod } = presuda(k.uzorak);
  const lista = provjere(k.tocka, k.uzorak, k.stanje, k.cestica, odredbe, listovi, putovi);
  const problemi = lista.filter((p) => p.ishod === "ne" || p.ishod === "uvjet");
  const uRedu = lista.filter((p) => p.ishod === "da");
  const nevazne = lista.filter((p) => p.ishod === "nevazno");
  const c = k.cestica?.svojstva;
  const ukupno = k.sastav ? [...k.sastav.values()].reduce((a, b) => a + b, 0) : 0;
  const red = (p: (typeof lista)[number]) => (
    <li key={p.pitanje} className="flex gap-2.5">
      <span className={`mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-bold ${ZNAK[p.ishod].klasa}`}>
        <span aria-hidden>{ZNAK[p.ishod].znak}</span>
        {ZNAK[p.ishod].naziv}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-900">{p.pitanje}</p>
        <div>{p.odgovor}</div>
      </div>
    </li>
  );
  return (
    <>
      {skriveno && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-700">
          Ovaj sloj je na karti skriven.
          <button type="button" onClick={onPrikazi} className="fokus meta font-semibold text-zinc-900 underline">
            Prikaži ga
          </button>
        </p>
      )}
      {problemi.length > 0 && <ol className="mt-3 space-y-2">{problemi.map(red)}</ol>}
      {uRedu.length > 0 && (
        <details className="mt-2">
          <summary className="fokus meta cursor-pointer text-sm font-semibold text-emerald-800">
            ✓ {uRedu.length} {uRedu.length === 1 ? "provjera" : uRedu.length < 5 ? "provjere" : "provjera"} u redu
          </summary>
          <ol className="mt-1.5 space-y-2">{uRedu.map(red)}</ol>
        </details>
      )}
      {nevazne.length > 0 && (
        <details className="mt-1">
          <summary className="fokus meta cursor-pointer text-sm font-semibold text-zinc-500">Ne odnosi se ({nevazne.length})</summary>
          <ol className="mt-1.5 space-y-2">{nevazne.map(red)}</ol>
        </details>
      )}
      {kat && (
        <p className="mt-3 border-t border-zinc-200 pt-2.5 text-zinc-800">
          {javno ? <>Prema evidenciji Grada Splita vlasnik je {VLASNIK_JAVNOG[k.uzorak!.vlasnik as KodVlasnika]}. </> : null}
          {kat.razlog}
        </p>
      )}
      {(kat?.id === "po-planu" || kat?.id === "po-dpu-stambeno") && (
        <div className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-2 text-zinc-800">
          {k.stanje.rezim === "vazeci" && (
            <p>
              Plan na snazi: <strong className="text-zinc-900">{k.stanje.plan.naziv}</strong>
              {k.stanje.plan.glasnik ? ` („Službeni glasnik Grada Splita”, br. ${k.stanje.plan.glasnik})` : ""}. Gradi se samo po
              njemu (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>); njegovu namjenu ovdje nismo provjerili.
            </p>
          )}
          {ispod && kat?.id === "po-planu" && (
            <p className="mt-1 flex items-center gap-2">
              <UzorakBoje stil={uzorakKategorije(ispod)} malo />
              <span>
                Da plana nema, po namjeni novog GUP-a ovdje bi bilo: <strong className="text-zinc-900">{punNaziv(ispod)}</strong>.
              </span>
            </p>
          )}
        </div>
      )}
      {"doRuba" in k.stanje && k.stanje.doRuba < BLIZU_RUBA_M && (
        <p className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-800">
          Ovo mjesto je samo oko {Math.max(1, Math.round(k.stanje.doRuba))} m od granice područja s lista 4.d. Granicu smo precrtali sa
          skeniranog lista, pa za česticu uz granicu provjeri sam list.
        </p>
      )}

      <DozvoleKlika akti={k.akti} />

      {c && (
        <div className="mt-3 border-t border-zinc-200 pt-2.5">
          <p className="font-semibold text-zinc-900">
            Čestica k.č. {c.kc}, k.o. {naslovno(c.ko)} <span className="font-normal text-zinc-500">· {c.a.toLocaleString("hr-HR")} m² u katastru</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-600">Od čega se sastoji cijela čestica</p>
          {k.sastav ? <SastavCestice sastav={k.sastav} ukupno={ukupno} /> : <p className="text-xs text-zinc-500">Računa se…</p>}
        </div>
      )}

      <details className="mt-3 border-t border-zinc-200 pt-2.5">
        <summary className="fokus meta cursor-pointer font-semibold text-zinc-900">Što karta ne provjerava</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-600">
          <li>vlasništvo privatnih čestica</li>
          <li>vodi li do čestice ulica dovoljne širine i može li se priključiti na vodu, kanalizaciju i struju</li>
          <li>nagib, stijenu i tlo, osim mjesta koja smo na ortofotu označili kao neizgradiva</li>
          <li>zaštitu kulturne baštine i krajobraza (uvjete konzervatora), pojas uz more i vodotoke</li>
          <li>posebne uvjete nadležnih tijela (npr. Hrvatskih voda, HEP-a) i infrastrukturne koridore koji nisu ucrtani kao ulica</li>
          {k.stanje.rezim === "vazeci" && <li>pravila detaljnijeg plana koji ovdje već vrijedi</li>}
        </ul>
        <p className="mt-1.5 text-zinc-600">
          Namjenu smo pročitali s PDF lista, u kvadratićima od oko 2 m, pa uz granicu zone pogreška može biti 5–10 m. Prije kupnje ili
          gradnje zatraži od Grada lokacijsku informaciju.
        </p>
      </details>
    </>
  );
}

// ------------------------------------------------------------- slojevi i zapreke

function stanjeSkupine(s: Skupina, ids: readonly IdKategorije[], skrivene: ReadonlySet<IdKategorije>): "sve" | "dio" | "nista" {
  const vidljivih = ids.filter((id) => !skrivene.has(id)).length;
  return vidljivih === 0 ? "nista" : vidljivih === ids.length ? "sve" : "dio";
}

/**
 * Čip sloja: upaljen je bijel s punim uzorkom i kvačicom, ugašen proziran sa sivim tekstom i blijedim uzorkom,
 * djelomično upaljen s napola punim uzorkom. Boja skupine tako ostaje vidljiva i kad je čip upaljen.
 */
function Cip(props: { stanje: "sve" | "dio" | "nista"; onClick: () => void; children: ReactNode; oznaka?: string }) {
  const { stanje, onClick, children, oznaka } = props;
  const upaljen = stanje !== "nista";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={stanje === "dio" ? "mixed" : upaljen}
      aria-label={oznaka}
      className={`fokus inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 [@media(pointer:coarse)]:h-11 ${
        upaljen ? "bg-white font-semibold text-zinc-900 ring-black/15" : "bg-white/85 font-medium text-zinc-600 ring-black/10 [&>span:first-child]:opacity-50"
      } ${stanje === "dio" ? "[&>span:first-child]:[clip-path:inset(0_50%_0_0)]" : ""}`}
    >
      {children}
      {upaljen && (
        <span aria-hidden className="text-xs text-zinc-900">
          ✓
        </span>
      )}
    </button>
  );
}

/**
 * Tumač je i upravljanje slojevima (kao na Feltu i Mapboxu): za svaku upaljenu skupinu njezine stavke s uzorkom kao
 * na karti, svaku s kvačicom. Skupine se pale čipovima gore; hektari su u pregledu.
 */
function PopisTumaca(props: {
  kategorijePoSkupini: Record<Skupina, Kategorija[]>;
  skrivene: ReadonlySet<IdKategorije>;
  prebaci: (ids: readonly IdKategorije[], vidi: boolean) => void;
  prepreka: IdPrepreke | null;
  onUkloniPrepreku: () => void;
}) {
  const { kategorijePoSkupini, skrivene, prebaci, prepreka, onUkloniPrepreku } = props;
  const upaljene = SKUPINE.filter((s) => kategorijePoSkupini[s].some((k) => !skrivene.has(k.id)));
  return (
    <div className="space-y-2.5 text-sm">
      {prepreka && (
        <div className="rounded-lg bg-violet-50 p-2 ring-1 ring-violet-200">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-900">Ističe se</p>
          <div className="mt-0.5 flex items-start gap-2 text-zinc-800">
            <span className="mt-0.5">
              <UzorakBoje stil={STIL_PREPREKE} />
            </span>
            <span className="flex-1">{PREPREKA_PO_ID[prepreka].naziv} (u zonama za stanovanje)</span>
            <button
              type="button"
              onClick={onUkloniPrepreku}
              aria-label="Ukloni isticanje"
              className="fokus -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-zinc-500 hover:bg-violet-100"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {upaljene.length === 0 && <p className="text-zinc-500">Upali sloj gore (Stambeno, Nestambeno…).</p>}
      {upaljene.map((s) => (
        <div key={s}>
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{KRATKO[s]}</p>
          {kategorijePoSkupini[s].length === 1 || s === "nista" ? (
            <p className="mt-0.5 flex items-center gap-2 text-zinc-700">
              <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[s].glavna])} />
              {s === "nista" ? "zgrade, ulice, parkovi, premalo, čeka UPU…" : SKUPINE_GRADNJE[s].naslov}
            </p>
          ) : (
            <ul className="mt-0.5">
              {kategorijePoSkupini[s].map((k) => (
                <li key={k.id}>
                  <label className={`meta flex cursor-pointer items-center gap-2 py-0.5 ${skrivene.has(k.id) ? "text-zinc-400" : "text-zinc-700"}`}>
                    <input
                      type="checkbox"
                      checked={!skrivene.has(k.id)}
                      onChange={(e) => prebaci([k.id], e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-zinc-900"
                    />
                    <span className={skrivene.has(k.id) ? "opacity-40" : ""}>
                      <UzorakBoje stil={uzorakKategorije(k)} />
                    </span>
                    <span>{k.naziv}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <ul className="space-y-1 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
        <li className="flex items-center gap-2">
          <Crta boja="#18181b" crtice="5 4" />
          <span>granica DPU-a na snazi</span>
        </li>
        <li className="flex items-center gap-2">
          <Crta boja={BOJA_STAMBENE_ZONE} />
          <span>rub zona za stanovanje (izbliza)</span>
        </li>
        <li className="flex items-center gap-2">
          <Crta boja="#18181b" />
          <span>granica GUP-a (s bijelim rubom)</span>
        </li>
      </ul>
    </div>
  );
}

/** Tumač na računalu: sklopiva kartica dolje lijevo. */
function TumacKarte(props: {
  kategorijePoSkupini: Record<Skupina, Kategorija[]>;
  skrivene: ReadonlySet<IdKategorije>;
  prebaci: (ids: readonly IdKategorije[], vidi: boolean) => void;
  prepreka: IdPrepreke | null;
  onUkloniPrepreku: () => void;
  otvoren: boolean;
  onOtvori: (o: boolean) => void;
  style: CSSProperties;
}) {
  const { otvoren, onOtvori, style, ...popis } = props;
  return (
    <section
      aria-label="Tumač karte"
      className="absolute z-[1010] w-[260px] rounded-xl bg-white text-zinc-700 shadow-[0_10px_15px_-3px_rgb(0_0_0/0.1),0_4px_6px_-4px_rgb(0_0_0/0.1)] ring-1 ring-black/10"
      style={style}
    >
      <button
        type="button"
        onClick={() => onOtvori(!otvoren)}
        aria-expanded={otvoren}
        className="fokus flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm font-bold text-zinc-900"
      >
        Tumač{popis.prepreka ? " · ističe se" : ""}
        <span aria-hidden className="text-base leading-none text-zinc-500">
          {otvoren ? "▾" : "▴"}
        </span>
      </button>
      {otvoren && (
        <div className="max-h-[45vh] overflow-y-auto overscroll-contain px-3 pb-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-16px),transparent)]">
          <PopisTumaca {...popis} />
        </div>
      )}
    </section>
  );
}

const haPrepreke = (zbroj: ZbrojGradnje, id: IdPrepreke) =>
  PREPREKA_PO_ID[id].kategorije.reduce((a, k) => a + (zbroj.u_stambenim_zonama_ha[k] ?? 0), 0);

// ------------------------------------------------------------- prikaz

/** Koliko je dozvola na zemljištu za gradnju (gradnja-dozvole.py), za pregled. */
export interface ZbrojDozvola {
  izdanih: number;
  gradjevinskih: number;
  uObradi: number;
  cestica: number;
  odDatuma: string;
}

export function GradnjaPrikaz(props: {
  zbroj: ZbrojGradnje;
  odredbe: OdredbeGradnje;
  mjesta: MjestaGradnje;
  dozvoleZbroj: ZbrojDozvola | null;
  children: ReactNode;
}) {
  const { zbroj, odredbe, mjesta, dozvoleZbroj, children } = props;
  const [prozor, setProzor] = useState<Prozor>("pregled");
  const [kartaOtvarana, setKartaOtvarana] = useState(false);
  const [podaci, setPodaci] = useState<Podaci | null>(null);
  const [greska, setGreska] = useState(false);
  const [skrivene, setSkrivene] = useState<ReadonlySet<IdKategorije>>(zadanoSkrivene);
  const [prepreka, setPrepreka] = useState<IdPrepreke | null>(null);
  const [cilj, setCilj] = useState<CiljKarte | null>(null);
  const [kartica, setKartica] = useState<Kartica | null>(null);
  /** Ploča odozdo na mobitelu: najprije samo vrh (presuda i zbroj provjera), da se čestica vidi; dodir je raširi. */
  const [visina, setVisina] = useState<Visina>("malo");
  /** Na mobitelu: ploča tumača odozdo. */
  const [ploha, setPloha] = useState<null | "tumac">(null);
  /** Na računalu: kartica tumača dolje lijevo, zadano otvorena. */
  const [tumacOtvoren, setTumacOtvoren] = useState(true);
  const [listovi, setListovi] = useState<Record<string, List> | null>(null);
  const [putovi, setPutovi] = useState<Putovi | null>(null);
  const [dozvole, setDozvole] = useState<PodaciDozvola | null>(null);
  const [siroko, setSiroko] = useState(false);
  const [gore, setGore] = useState(120);
  const [visinaKartice, setVisinaKartice] = useState(0);
  const [slika, setSlika] = useState<null | "radim" | { url: string; blob: Blob } | { greska: string }>(null);
  const [pocetak, setPocetak] = useState<Pogled | null>(null);
  const putoviRef = useRef<Promise<Putovi> | null>(null);
  const dohvatiCesticu = useRef(dohvacacCestica());
  const zadnjiKlik = useRef(0);
  const kljuc = useRef(0);
  const vrh = useRef<HTMLDivElement>(null);
  const karticaEl = useRef<HTMLElement>(null);
  const mapa = useRef<LeafletNS.Map | null>(null);
  const pogled = useRef<Pogled | null>(null);
  /** Karta i kartica otvorene su novim zapisom u povijesti: zatvaraju se s history.back(). */
  const gurnuto = useRef({ karta: false, kartica: false });
  /** Mjesto koje čeka podatke karte: iz poveznice ili iz tražilice na pregledu. */
  const cekaTocka = useRef<{ t: [number, number]; podnaslov?: string; izPoveznice: boolean } | null>(null);

  // ------------------------------------------------ poveznica
  const stanje = useRef({ prozor, skrivene, prepreka, tocka: null as [number, number] | null });
  useEffect(() => {
    stanje.current = { prozor, skrivene, prepreka, tocka: kartica?.tocka ?? null };
  });
  const zapisi = useCallback((novo: boolean) => {
    const url = napisiUrl({ ...stanje.current, pogled: pogled.current });
    if (url === `${location.pathname}${location.search}${location.hash}`) return;
    if (novo) window.history.pushState(null, "", url);
    else window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const u = procitajUrl(location.search);
    /* eslint-disable react-hooks/set-state-in-effect -- stanje iz poveznice čita se tek u pregledniku */
    setSkrivene(u.skrivene);
    setPrepreka(u.prepreka);
    if (u.pogled) setPocetak(u.pogled);
    if (u.prozor === "karta") {
      setProzor("karta");
      setKartaOtvarana(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    pogled.current = u.pogled;
    cekaTocka.current = u.tocka ? { t: u.tocka, izPoveznice: true } : null;
    const mq = window.matchMedia(SIROKO);
    const promjena = () => setSiroko(mq.matches);
    promjena();
    mq.addEventListener("change", promjena);
    const natrag = () => {
      const n = procitajUrl(location.search);
      if (n.prozor === "pregled") gurnuto.current.karta = false;
      if (!n.tocka) gurnuto.current.kartica = false;
      setProzor(n.prozor);
      if (!n.tocka) {
        zadnjiKlik.current++;
        setKartica(null);
      }
    };
    window.addEventListener("popstate", natrag);
    return () => {
      mq.removeEventListener("change", promjena);
      window.removeEventListener("popstate", natrag);
    };
  }, []);

  // prvi put ne: poveznica se još nije pročitala u stanje
  const prviZapis = useRef(true);
  useEffect(() => {
    if (prviZapis.current) {
      prviZapis.current = false;
      return;
    }
    zapisi(false);
  }, [skrivene, prepreka, zapisi]);

  // karta preko cijelog zaslona: stranica ispod se ne lista
  useEffect(() => {
    if (prozor !== "karta") return;
    const html = document.documentElement;
    const staro = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = staro;
    };
  }, [prozor]);

  useEffect(() => {
    if (!kartaOtvarana || podaci) return;
    // dozvole ne čekaju ništa: karta ih nacrta kad stignu
    fetch("/geo/gup-grad/gradnja-dozvole-2025.json")
      .then((r) => (r.ok ? (r.json() as Promise<PodaciDozvola>) : null))
      .then((d) => d && setDozvole(d))
      .catch(() => {});
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
          dpu: {
            type: "FeatureCollection",
            features: planovi.features.filter((f) => f.properties?.vrsta === "vazeci" && !String(f.properties?.ispu ?? "").startsWith("UPU")),
          },
        }),
      )
      .catch(() => setGreska(true));
  }, [kartaOtvarana, podaci]);

  const otvoriKartu = () => {
    setKartaOtvarana(true);
    if (prozor === "karta") return;
    setProzor("karta");
    stanje.current = { ...stanje.current, prozor: "karta" };
    gurnuto.current.karta = true;
    zapisi(true);
  };
  const otvoriPregled = () => {
    setPloha(null);
    if (gurnuto.current.karta && !gurnuto.current.kartica) {
      window.history.back();
      return;
    }
    gurnuto.current = { karta: false, kartica: false };
    setProzor("pregled");
    stanje.current = { ...stanje.current, prozor: "pregled" };
    zapisi(true);
  };

  // ------------------------------------------------ klik i tražilica
  const pomakni = (c: Omit<CiljKarte, "kljuc">) => setCilj({ ...c, kljuc: ++kljuc.current });

  const pokaziTocku = useCallback(
    async (lng: number, lat: number, podnaslov?: string, izPoveznice = false) => {
      if (!podaci) return;
      const n = ++zadnjiKlik.current;
      const st = stanjeTocke(podaci.slojevi, lng, lat);
      setPloha(null);
      void listoviKlijent().then((l) => setListovi(l));
      // putovi (~100 kB) tek uz prvi klik, kao i listovi
      putoviRef.current ??= fetch("/geo/gup-grad/putovi-2025.json")
        .then((r) => (r.ok ? (r.json() as Promise<{ putovi: PutCestice[] }>) : { putovi: [] }))
        .then((d) => {
          const m = new Map(d.putovi.map((p) => [kljucPuta(p.ko, p.kc), p]));
          setPutovi(m);
          return m;
        })
        .catch(() => {
          putoviRef.current = null;
          return new Map();
        });
      const [uzorak, cestica] = await Promise.all([
        uzorakUTocki(lng, lat).catch(() => null),
        st.rezim === "izvan" ? Promise.resolve(null) : dohvatiCesticu.current(lng, lat).catch(() => null),
      ]);
      // stariji odgovor ne smije prebrisati noviji klik
      if (n !== zadnjiKlik.current) return;
      // mjesto iz poveznice već je u njoj: novi zapis bi tipku Natrag ostavio bez učinka
      const prva = !stanje.current.tocka && !izPoveznice;
      setKartica({ tocka: [lng, lat], podnaslov, uzorak, stanje: st, cestica, sastav: null });
      stanje.current = { ...stanje.current, tocka: [lng, lat] };
      if (prva) {
        gurnuto.current.kartica = true;
        zapisi(true);
      } else zapisi(false);
      if (cestica) {
        const sastav = await kategorijeUObliku(cestica.geometrija).catch(() => null);
        if (n === zadnjiKlik.current) setKartica((k) => (k ? { ...k, sastav } : k));
      }
    },
    [podaci, zapisi],
  );

  // mjesto iz poveznice, kad stignu podaci
  useEffect(() => {
    if (!podaci || !cekaTocka.current) return;
    const { t, podnaslov, izPoveznice } = cekaTocka.current;
    cekaTocka.current = null;
    void pokaziTocku(t[0], t[1], podnaslov, izPoveznice);
  }, [podaci, pokaziTocku]);

  const zatvoriKarticu = useCallback(() => {
    zadnjiKlik.current++;
    if (gurnuto.current.kartica) {
      window.history.back();
      return;
    }
    setKartica(null);
    stanje.current = { ...stanje.current, tocka: null };
    zapisi(false);
  }, [zapisi]);

  const odaberi = (p: Prijedlog, adrese: Adrese) => {
    otvoriKartu();
    if (p.vrsta === "adresa") {
      const t: [number, number] = [p.adresa.lng, p.adresa.lat];
      if (podaci) void pokaziTocku(t[0], t[1], `${p.naziv} · ${p.kotar}`);
      else cekaTocka.current = { t, podnaslov: `${p.naziv} · ${p.kotar}`, izPoveznice: false };
      pomakni({ tocka: t });
    } else {
      const okvir = spojiOkvire(adrese.brojevi.filter((b) => b.ulica === p.ulica).map((b) => [b.lng, b.lat, b.lng, b.lat]));
      if (okvir) pomakni({ okvir });
      if (stanje.current.tocka) zatvoriKarticu();
    }
  };

  useEffect(() => {
    if (prozor !== "karta") return;
    const tipka = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (slika) setSlika(null);
      else if (ploha) setPloha(null);
      else if (stanje.current.tocka) zatvoriKarticu();
    };
    document.addEventListener("keydown", tipka);
    return () => document.removeEventListener("keydown", tipka);
  }, [prozor, ploha, slika, zatvoriKarticu]);

  // ------------------------------------------------ slojevi
  /** Pali ili gasi kategorije na karti (skupina = sve njezine kategorije odjednom). */
  const prebaci = useCallback(
    (ids: readonly IdKategorije[], vidi: boolean) =>
      setSkrivene((stare) => {
        const nove = new Set(stare);
        for (const id of ids) {
          if (vidi) nove.delete(id);
          else nove.add(id);
        }
        return nove;
      }),
    [],
  );

  const kategorijePoSkupini = useMemo(
    () =>
      Object.fromEntries(
        SKUPINE.map((s) => [
          s,
          // slobodno, zatražena dozvola, izdana dozvola, pa neuređeno (uvjetna) na kraju
          KATEGORIJE.filter((k) => k.skupina === s && (zbroj.po_kategoriji_ha[k.id] ?? 0) > 0).sort(
            (a, b) => Number(a.id === SKUPINE_GRADNJE[s].uvjetna) - Number(b.id === SKUPINE_GRADNJE[s].uvjetna),
          ),
        ]),
      ),
    [zbroj],
  ) as Record<Skupina, Kategorija[]>;

  const prikaz = useMemo<Prikaz>(() => ({ skrivene, prepreka }), [skrivene, prepreka]);

  /** Otvori kartu samo s ovom skupinom (iz pregleda). */
  /** Otvori kartu samo s ovim kategorijama (iz retka u pregledu). */
  const kartaSaKategorijama = (ids: readonly IdKategorije[]) => {
    setSkrivene(new Set(KATEGORIJE.map((k) => k.id).filter((id) => !ids.includes(id))));
    setPrepreka(null);
    otvoriKartu();
  };
  const kartaSa = (s: Skupina | null, p: IdPrepreke | null) => {
    const nove = new Set(KATEGORIJE.map((k) => k.id));
    const vidljive = s ? kategorijePoSkupini[s].map((k) => k.id) : [SKUPINE_GRADNJE.stambeno.glavna, SKUPINE_GRADNJE.stambeno.uvjetna!];
    for (const id of vidljive) nove.delete(id);
    setSkrivene(nove);
    setPrepreka(p);
    otvoriKartu();
  };

  // ------------------------------------------------ zaklon: tražilica gore, kartica dolje ili lijevo
  useEffect(() => {
    const el = vrh.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setGore(el.getBoundingClientRect().bottom));
    ro.observe(el);
    return () => ro.disconnect();
  }, [kartaOtvarana]);
  useEffect(() => {
    const el = karticaEl.current;
    if (!el) {
      setVisinaKartice(0);
      return;
    }
    const ro = new ResizeObserver(() => setVisinaKartice(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [kartica !== null, siroko]); // eslint-disable-line react-hooks/exhaustive-deps

  const zaklon = useMemo<Zaklon>(
    () =>
      siroko
        ? { gore, dolje: 0, lijevo: kartica ? STUPAC + 2 * RAZMAK : 0, desno: 0 }
        : { gore, dolje: kartica ? Math.round(visinaKartice) : 0, lijevo: 0, desno: 0 },
    [siroko, gore, kartica, visinaKartice],
  );

  const odgodaPomaka = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPomak = useCallback(
    (p: Pogled) => {
      pogled.current = p;
      if (odgodaPomaka.current) clearTimeout(odgodaPomaka.current);
      odgodaPomaka.current = setTimeout(() => zapisi(false), 300);
    },
    [zapisi],
  );
  const onSpremna = useCallback((m: LeafletNS.Map | null) => {
    mapa.current = m;
  }, []);
  const onKlik = useCallback((lng: number, lat: number) => void pokaziTocku(lng, lat), [pokaziTocku]);

  // ------------------------------------------------ slika za dijeljenje
  const legendaSlike = (): StavkaLegende[] => {
    const out: StavkaLegende[] = [];
    if (prepreka) {
      const p = PREPREKA_PO_ID[prepreka];
      out.push({ naziv: `${p.naziv} (u zonama za stanovanje)`, ha: haPrepreke(zbroj, prepreka), ploha: { boja: BOJA_PREPREKE, alfa: ALFA_PREPREKE } });
    }
    const vidjene: Kategorija[] = [];
    for (const s of SKUPINE)
      for (const k of kategorijePoSkupini[s]) {
        if (skrivene.has(k.id)) continue;
        const ista = vidjene.find((v) => istiIzgled(v, k) && v.skupina === k.skupina);
        if (ista) continue;
        vidjene.push(k);
      }
    for (const k of vidjene) {
      // ista boja za cijelu skupinu: u tumaču naziv skupine i zbroj svega što se tako crta
      const sve = kategorijePoSkupini[k.skupina].filter((x) => !skrivene.has(x.id) && istiIzgled(x, k));
      const naziv = sve.length > 1 ? SKUPINE_GRADNJE[k.skupina].naslov : punNaziv(k);
      out.push({
        naziv,
        ha: sve.reduce((a, x) => a + (zbroj.po_kategoriji_ha[x.id] ?? 0), 0),
        ploha: { boja: k.boja, alfa: prepreka ? k.alfa * 0.4 : k.alfa, pruge: k.pruge, mreza: k.mreza, tocke: k.tocke },
      });
    }
    if ((mapa.current?.getZoom() ?? 0) >= OBRISI_OD_ZUMA) out.push({ naziv: "rub zona za stanovanje", crta: { boja: BOJA_STAMBENE_ZONE, debljina: 2 } });
    out.push({ naziv: "granica GUP-a", crta: { boja: "#18181b", debljina: 2 } });
    out.push({ naziv: "granica DPU-a na snazi", crta: { boja: "#18181b", crtice: [8, 6], debljina: 2 } });
    if (kartica?.cestica) out.push({ naziv: `odabrana čestica k.č. ${kartica.cestica.svojstva.kc}`, crta: { boja: "#111111", debljina: 3 } });
    return out;
  };

  const napraviSliku = async () => {
    const map = mapa.current;
    if (!map) return;
    setPloha(null);
    setSlika("radim");
    try {
      const vel = map.getSize();
      const z = zaklon;
      const podrucje = { x: z.lijevo, y: z.gore, w: vel.x - z.lijevo - z.desno, h: vel.y - z.gore - z.dolje };
      const vidljiva = (s: Skupina) => stanjeSkupine(s, kategorijePoSkupini[s].map((k) => k.id), skrivene) !== "nista";
      // stambeno, uz ono o čemu odlučuje plan na snazi (zadano)
      const samoStambeno = vidljiva("stambeno") && SKUPINE.every((s) => s === "stambeno" || s === "plan" || !vidljiva(s));
      const naslov = prepreka
        ? `Što priječi stambenu gradnju: ${PREPREKA_PO_ID[prepreka].naziv.toLowerCase()}`
        : samoStambeno
          ? "Gdje će se po novom GUP-u moći graditi stambena zgrada"
          : "Što će se po novom GUP-u moći graditi";
      const podloga = PODLOGE.find((p) => map.getContainer().querySelector(".leaflet-control-layers-base input:checked + span")?.textContent?.trim() === p.naziv);
      const blob = await slikaKarte(map, podrucje, {
        naslov,
        podnaslov: [kartica?.podnaslov?.split(" · ")[0], "Split, prijedlog izmjena GUP-a (travanj 2025.)"].filter(Boolean).join(" · "),
        legenda: legendaSlike(),
        podnozje: [
          `${SITE_URL.host}/gup/gradnja · ${new Date().toLocaleDateString("hr-HR", { day: "numeric", month: "numeric", year: "numeric" })} · hektari su za cijelo područje GUP-a`,
          `Izvori: prijedlog ID GUP-a Splita (travanj 2025.), katastar DGU, evidencija vlasnika Grada Splita. Podloga: ${
            podloga?.id === "satelit" ? "© Esri, Maxar" : "DOF 2025. © DGU"
          }.`,
        ],
      });
      setSlika({ url: URL.createObjectURL(blob), blob });
    } catch {
      setSlika({ greska: "Slika se nije napravila. Pokušaj ponovno ili promijeni podlogu u Ortofoto 2025." });
    }
  };
  const zatvoriSliku = () => {
    if (slika && typeof slika === "object" && "url" in slika) URL.revokeObjectURL(slika.url);
    setSlika(null);
  };
  const datotekaSlike = (b: Blob) => new File([b], "split-gup-gradnja.png", { type: "image/png" });
  const mozeDijeliti = slika && typeof slika === "object" && "blob" in slika && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [datotekaSlike(slika.blob)] });

  // ------------------------------------------------ iscrtavanje
  const k = useMemo<KarticaSDozvolama | null>(() => {
    if (!kartica) return null;
    const naCestici = dozvole ? cesticeUTocki(dozvole, kartica.tocka[0], kartica.tocka[1]) : [];
    const akti = [...new Set(naCestici.flatMap((i) => dozvole!.cestice[i].akti))].map((i) => dozvole!.akti[i]);
    return { ...kartica, akti, skupina: [...new Set(akti.flatMap((a) => a.cestice))] };
  }, [kartica, dozvole]);
  const listaKartice = k && podaci ? provjere(k.tocka, k.uzorak, k.stanje, k.cestica, odredbe, listovi, putovi) : [];
  const skrivenoKliknuto = (() => {
    const { kat } = presuda(k?.uzorak ?? null);
    return !!kat && skrivene.has(kat.id) && !(prepreka && PREPREKA_PO_ID[prepreka].kategorije.includes(kat.id));
  })();
  const s = zbroj.po_skupini_ha;

  return (
    <>
      {/* ------------------------------------------------ pregled */}
      <div className={prozor === "karta" ? "invisible" : undefined} aria-hidden={prozor === "karta"}>
        <Prekidac prozor="pregled" onPregled={otvoriPregled} onKarta={otvoriKartu} />
        <div className="mt-4 grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
          <TrazilicaAdrese
            id="gradnja-adresa"
            natpis="Provjeri adresu"
            podnaslov="Karta se otvori na tom mjestu i kaže što se ondje smije graditi i zašto."
            onOdaberi={odaberi}
          />
          <button
            type="button"
            onClick={otvoriKartu}
            className="fokus inline-flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 font-semibold text-white hover:bg-zinc-800 sm:mb-6"
          >
            <IkonaKarte /> Otvori kartu
          </button>
        </div>

        <section className="mt-6" aria-labelledby="gradnja-koliko">
          <h2 id="gradnja-koliko" className="text-lg font-bold text-zinc-900">
            Koliko je čega
          </h2>
          <div className="mt-2 flex h-4 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Udio četiri odgovora u površini GUP-a">
            {SKUPINE.map((sk) => (
              <span key={sk} style={{ ...uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[sk].glavna]), width: `${(s[sk] / zbroj.ukupno_ha) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {SKUPINE.map((sk) => (
              <li key={sk}>
                <button type="button" onClick={() => kartaSa(sk, null)} className="fokus flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-zinc-50 sm:px-4">
                  <span className="mt-1">
                    <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[sk].glavna])} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-zinc-900">{SKUPINE_GRADNJE[sk].naslov}</span>
                    <span className="block text-xs text-zinc-500">
                      {sk === "stambeno" && `${mjesta.stambeno.od_500_m2.toLocaleString("hr-HR")} gradilišta od barem 500 m²`}
                      {sk === "nista" && "zgrade s dvorištima, ulice, parkovi, premalo zemljišta, čeka UPU…"}
                      {sk === "javno" && `država, Grad, županija; od toga ${ha(zbroj.po_kategoriji_ha.vojska)} ha vojna zona`}
                      {sk === "plan" &&
                        `slobodno zemljište pod DPU-om na snazi; po namjeni GUP-a bilo bi ondje ${ha((zbroj.ispod_plana_ha.stambeno ?? 0) + (zbroj.ispod_plana_ha["uz-cestu-stambeno"] ?? 0))} ha za stambenu zgradu`}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-zinc-700">Prikaži na karti →</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-lg font-bold tabular-nums text-zinc-900">{ha(s[sk])} ha</span>
                    <span className="block text-xs tabular-nums text-zinc-500">{posto(s[sk] / zbroj.ukupno_ha)}</span>
                  </span>
                </button>
                {kategorijePoSkupini[sk].length > 1 && <RazradaSkupine sk={sk} kategorije={kategorijePoSkupini[sk]} zbroj={zbroj} onKarta={kartaSaKategorijama} />}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-zinc-500">
            Ukupno {ha(zbroj.ukupno_ha)} ha: sve katastarske čestice unutar granice GUP-a, bez mora.
          </p>
          {dozvoleZbroj && (
            <button
              type="button"
              onClick={() => kartaSa("stambeno", null)}
              className="fokus mt-3 flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-3 text-left hover:bg-zinc-50 sm:px-4"
            >
              <span className="mt-1">
                <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID["stambeno-dozvola"])} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-zinc-900">Na dijelu tog zemljišta već se gradi ili se traži dozvola</span>
                <span className="block text-sm text-zinc-600">
                  Od {datumHr(dozvoleZbroj.odDatuma).replace(/^1\. 1\. /, "")} izdano je {dozvoleZbroj.izdanih} dozvola (
                  {dozvoleZbroj.gradjevinskih} građevinskih), a još {dozvoleZbroj.uObradi} zahtjeva je u obradi, na{" "}
                  {dozvoleZbroj.cestica} čestica. Na karti su to zasebne stavke u skupinama „stambeno” i „nestambeno”: zatražena
                  dozvola (tamnija) i izdana dozvola (najtamnija). Čestice jednog akta karta računa zajedno, kao jednu građevnu česticu.
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-zinc-700">Prikaži na karti →</span>
              </span>
            </button>
          )}
        </section>

        <section className="mt-6" aria-labelledby="gradnja-prijeci">
          <h2 id="gradnja-prijeci" className="text-lg font-bold text-zinc-900">
            Što u zonama za stanovanje priječi gradnju
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Zone u kojima novi GUP dopušta stanovanje (S, M1–M3, K5) imaju {ha(Object.values(zbroj.u_stambenim_zonama_ha).reduce((a, b) => a + (b ?? 0), 0))}{" "}
            ha. Na većini njih nova stambena zgrada neće moći stajati, i evo zašto.
          </p>
          <PreprekeTraka zbroj={zbroj} onOdaberi={(p) => kartaSa("stambeno", p)} />
        </section>

        <div className="mt-10">{children}</div>
      </div>

      {/* ------------------------------------------------ karta */}
      {kartaOtvarana && (
        <div
          className={`gradnja-karta fixed inset-0 z-[1300] bg-zinc-200 ${prozor === "karta" ? "" : "hidden"}`}
          role="dialog"
          aria-modal="true"
          aria-label="Karta gradnje po novom GUP-u"
        >
          <div className="absolute inset-0">
            {podaci ? (
              <GradnjaKarta
                gup={podaci.gup}
                zone={podaci.zone}
                dpu={podaci.dpu}
                prikaz={prikaz}
                cilj={cilj}
                oznaka={k ? { lng: k.tocka[0], lat: k.tocka[1] } : null}
                cestica={k?.cestica?.geometrija ?? null}
                zaklon={zaklon}
                pocetak={pocetak}
                dozvole={dozvole}
                vidiDozvole={DOZVOLE.some((id) => !skrivene.has(id))}
                skupina={k?.skupina ?? []}
                onKlik={onKlik}
                onPomak={onPomak}
                onSpremna={onSpremna}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                {greska ? "Karta se nije učitala. Osvježi stranicu." : "Karta se učitava…"}
              </div>
            )}
          </div>

          {/* vrh: na računalu jedan red (tražilica, slojevi | pregled, dijeljenje), na mobitelu dva */}
          <div
            ref={vrh}
            className={`pointer-events-none absolute inset-x-0 top-0 z-[1010] flex flex-col gap-2 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:pt-3 ${
              !siroko && k && visina === "puno" ? "invisible" : ""
            }`}
          >
            <div className="pointer-events-auto flex items-center gap-2 sm:contents">
              {!siroko && (
                <button
                  type="button"
                  onClick={otvoriPregled}
                  aria-label="Pregled: brojke i objašnjenja"
                  className="fokus grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-zinc-900 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10"
                >
                  <IkonaPregleda />
                </button>
              )}
              <div className="relative min-w-0 flex-1 sm:w-[340px] sm:flex-none [&_input]:mt-0 [&_input]:h-11 [&_input]:rounded-full [&_input]:border-black/10 [&_input]:pl-10 [&_input]:pr-4 [&_input]:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] [&>div]:relative [&>div]:max-w-none">
                <TrazilicaAdrese id="gradnja-adresa-karta" natpis="Provjeri adresu" sakrijNatpis onOdaberi={odaberi} />
                <span aria-hidden className="pointer-events-none absolute left-3.5 top-[13px] text-zinc-500">
                  <IkonaPovecala />
                </span>
              </div>
              {!siroko && (
                <button
                  type="button"
                  onClick={() => void napraviSliku()}
                  aria-label="Podijeli sliku karte"
                  className="fokus grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-zinc-900 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10"
                >
                  <IkonaDijeljenja />
                </button>
              )}
            </div>
            <div className="pointer-events-auto relative -mx-2 min-w-0 sm:mx-0 sm:flex-1">
              <div className="flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                {SKUPINE.map((sk) => {
                  const ids = kategorijePoSkupini[sk].map((x) => x.id);
                  const st = stanjeSkupine(sk, ids, skrivene);
                  return (
                    <Cip key={sk} stanje={st} onClick={() => prebaci(ids, st === "nista")} oznaka={`${SKUPINE_GRADNJE[sk].naslov}: ${st === "nista" ? "skriveno" : "na karti"}`}>
                      <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[sk].glavna])} malo />
                      {KRATKO[sk]}
                    </Cip>
                  );
                })}
              </div>
              {/* na mobitelu se čipovi listaju vodoravno: blijeđenje desno kaže da ih ima još */}
              <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-900/45 to-transparent sm:hidden" />
            </div>
            {siroko && (
              <div className="pointer-events-auto flex items-center gap-2">
                <Prekidac prozor="karta" onPregled={otvoriPregled} onKarta={otvoriKartu} plutajuci />
                <button
                  type="button"
                  onClick={() => void napraviSliku()}
                  aria-label="Podijeli sliku karte"
                  title="Podijeli sliku karte"
                  className="fokus grid h-11 w-11 place-items-center rounded-full bg-white text-zinc-900 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10 hover:bg-zinc-50"
                >
                  <IkonaDijeljenja />
                </button>
              </div>
            )}
          </div>

          {/* tumač: na računalu kartica dolje lijevo (desno od kartice mjesta), na mobitelu gumb koji otvara ploču */}
          {siroko ? (
            // dok je kartica mjesta otvorena, tumač je skupljen uz nju, da ne prekrije odabranu česticu
            <TumacKarte
              kategorijePoSkupini={kategorijePoSkupini}
              skrivene={skrivene}
              prebaci={prebaci}
              prepreka={prepreka}
              onUkloniPrepreku={() => setPrepreka(null)}
              otvoren={tumacOtvoren && !k}
              onOtvori={setTumacOtvoren}
              style={{ left: k ? STUPAC + 2 * RAZMAK : RAZMAK, bottom: RAZMAK }}
            />
          ) : (
            !k && (
              <button
                type="button"
                onClick={() => setPloha((p) => (p ? null : "tumac"))}
                aria-expanded={ploha === "tumac"}
                className="fokus absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[1010] inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10"
              >
                <IkonaSlojeva /> Tumač
                {prepreka && <span className="h-2.5 w-2.5 rounded-full bg-violet-600" aria-label="ističe se razlog" />}
              </button>
            )
          )}

          {ploha === "tumac" && !siroko && (
            <section
              aria-label="Tumač karte"
              className="absolute inset-x-0 bottom-0 z-[1030] max-h-[45dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-700 shadow-[0_-4px_16px_rgb(0_0_0/0.15)]"
            >
              <button type="button" aria-label="Zatvori tumač" onClick={() => setPloha(null)} className="fokus flex h-7 w-full items-center justify-center">
                <span aria-hidden className="h-1.5 w-10 rounded-full bg-zinc-300" />
              </button>
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-bold text-zinc-900">Tumač</h2>
                <button type="button" aria-label="Zatvori" onClick={() => setPloha(null)} className="fokus grid h-11 w-11 place-items-center rounded-full text-xl text-zinc-500 hover:bg-zinc-100">
                  ×
                </button>
              </div>
              <PopisTumaca
                kategorijePoSkupini={kategorijePoSkupini}
                skrivene={skrivene}
                prebaci={prebaci}
                prepreka={prepreka}
                onUkloniPrepreku={() => setPrepreka(null)}
              />
            </section>
          )}

          {k && (
            <section
              ref={karticaEl}
              aria-label="Odabrano mjesto"
              className={`absolute inset-x-0 bottom-0 z-[1020] flex flex-col rounded-t-2xl bg-white text-sm leading-relaxed text-zinc-700 shadow-[0_-4px_16px_rgb(0_0_0/0.15)] sm:bottom-3 sm:left-3 sm:right-auto sm:w-[400px] sm:rounded-xl sm:shadow-lg ${
                visina === "pola" ? "max-h-[50dvh]" : visina === "puno" ? "max-h-[92dvh]" : ""
              } sm:max-h-none`}
              style={siroko ? { top: gore + 4 } : undefined}
            >
              {!siroko && <RucicaKartice visina={visina} onVisina={setVisina} onZatvori={zatvoriKarticu} />}
              <div className="relative shrink-0 px-4 pb-3 pt-1 sm:pt-4">
                <button
                  type="button"
                  aria-label="Zatvori"
                  onClick={zatvoriKarticu}
                  className="fokus absolute right-1.5 top-0 grid h-11 w-11 place-items-center rounded-full text-xl text-zinc-500 hover:bg-zinc-100 sm:top-2"
                >
                  ×
                </button>
                <div
                  className="pr-10"
                  onClick={() => {
                    if (!siroko && visina === "malo") setVisina("pola");
                  }}
                >
                  {/* zapreke i uvjeti u vrhu samo dok je kartica skupljena; raširena ih ima s odgovorima */}
                  <ZaglavljeKlika k={k} lista={listaKartice} saZaprekama={!siroko && visina === "malo"} />
                </div>
                <p className="sr-only" aria-live="polite">
                  {presuda(k.uzorak).kat ? punNaziv(presuda(k.uzorak).kat!) : ""}
                </p>
              </div>
              {(siroko || visina !== "malo") && (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <TijeloKlika
                    k={k}
                    odredbe={odredbe}
                    listovi={listovi}
                    putovi={putovi}
                    skriveno={skrivenoKliknuto}
                    onPrikazi={() => {
                      const { kat } = presuda(k.uzorak);
                      if (kat) prebaci(kategorijePoSkupini[kat.skupina].map((x) => x.id), true);
                    }}
                  />
                </div>
              )}
            </section>
          )}

          {slika && (
            <div className="absolute inset-0 z-[1100] flex items-end justify-center bg-black/50 sm:items-center" onClick={zatvoriSliku}>
              <div
                role="dialog"
                aria-label="Slika karte za dijeljenje"
                className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-bold text-zinc-900">Slika za dijeljenje</h2>
                  <button type="button" aria-label="Zatvori" onClick={zatvoriSliku} className="fokus grid h-11 w-11 place-items-center rounded-full text-xl text-zinc-500 hover:bg-zinc-100">
                    ×
                  </button>
                </div>
                {slika === "radim" ? (
                  <p className="py-10 text-center text-sm text-zinc-600">Slika se radi…</p>
                ) : "greska" in slika ? (
                  <p className="py-6 text-sm text-red-800">{slika.greska}</p>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- slika napravljena u pregledniku (blob) */}
                    <img src={slika.url} alt="Pregled slike: karta s naslovom i tumačem" className="min-h-0 flex-1 rounded-lg object-contain ring-1 ring-zinc-200" />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mozeDijeliti && (
                        <button
                          type="button"
                          onClick={() =>
                            void navigator
                              .share({ files: [datotekaSlike(slika.blob)], title: "Gradnja po novom GUP-u", url: location.href })
                              .catch(() => {})
                          }
                          className="fokus inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 font-semibold text-white"
                        >
                          <IkonaDijeljenja /> Podijeli
                        </button>
                      )}
                      <a
                        href={slika.url}
                        download="split-gup-gradnja.png"
                        className={`fokus inline-flex h-11 flex-1 items-center justify-center rounded-full px-4 font-semibold ${
                          mozeDijeliti ? "bg-white text-zinc-900 ring-1 ring-zinc-300" : "bg-zinc-900 text-white"
                        }`}
                      >
                        Spremi sliku
                      </a>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(location.href)}
                        className="fokus inline-flex h-11 flex-1 items-center justify-center rounded-full bg-white px-4 font-semibold text-zinc-900 ring-1 ring-zinc-300"
                      >
                        Kopiraj poveznicu
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Poveznica otvara kartu na ovom istom pogledu.</p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Od čega je skupina u pregledu: traka i redak po kategoriji, istim uzorkom i redom kao na karti; redak otvara kartu
 * samo s tom kategorijom. „Ništa novo” ima mnogo razloga, pa je sklopljen.
 */
function RazradaSkupine(props: { sk: Skupina; kategorije: Kategorija[]; zbroj: ZbrojGradnje; onKarta: (ids: readonly IdKategorije[]) => void }) {
  const { sk, kategorije, zbroj, onKarta } = props;
  const ukupno = kategorije.reduce((a, k) => a + (zbroj.po_kategoriji_ha[k.id] ?? 0), 0);
  const redovi = (
    <div className="px-3 pb-3 sm:px-4 sm:pl-[3.25rem]">
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={`Od čega je: ${SKUPINE_GRADNJE[sk].naslov}`}>
        {kategorije.map((k) => (
          <span key={k.id} style={{ ...uzorakKategorije(k), width: `${((zbroj.po_kategoriji_ha[k.id] ?? 0) / ukupno) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-1.5">
        {kategorije.map((k) => (
          <li key={k.id}>
            <button
              type="button"
              onClick={() => onKarta([k.id])}
              className="fokus meta flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <UzorakBoje stil={uzorakKategorije(k)} malo />
              <span className="min-w-0 flex-1">{k.naziv}</span>
              <span className="shrink-0 tabular-nums text-zinc-600">{ha(zbroj.po_kategoriji_ha[k.id] ?? 0)} ha</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  if (sk !== "nista") return redovi;
  return (
    <details className="group">
      <summary className="fokus meta cursor-pointer px-3 pb-2 text-xs font-semibold text-zinc-600 sm:px-4 sm:pl-[3.25rem]">
        Razlozi ({kategorije.length})
      </summary>
      {redovi}
    </details>
  );
}

/** Pregled | Karta. Na stranici je to traka iznad sadržaja, na karti pločica nad njom. */
function Prekidac({ prozor, onPregled, onKarta, plutajuci = false }: { prozor: Prozor; onPregled: () => void; onKarta: () => void; plutajuci?: boolean }) {
  const gumb = (p: Prozor, naziv: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={prozor === p}
      className={`fokus h-10 rounded-full px-4 text-sm font-semibold ${prozor === p ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
    >
      {naziv}
    </button>
  );
  return (
    <div
      role="group"
      aria-label="Prikaz"
      className={`inline-flex rounded-full bg-white p-0.5 ring-1 ring-black/10 ${plutajuci ? "shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)]" : ""}`}
    >
      {gumb("pregled", "Pregled", onPregled)}
      {gumb("karta", "Karta", onKarta)}
    </div>
  );
}

/** Visina ploče odozdo na mobitelu: vrh (presuda i zapreke), pola zaslona, gotovo cijeli zaslon. */
type Visina = "malo" | "pola" | "puno";
const VISINE: Visina[] = ["malo", "pola", "puno"];

/** Ručica ploče odozdo: dodir je podigne za korak (s vrha vrati na najnižu), povlačenje gore ili dolje za korak; ispod najniže zatvori. */
function RucicaKartice(props: { visina: Visina; onVisina: (v: Visina) => void; onZatvori: () => void }) {
  const { visina, onVisina, onZatvori } = props;
  const pocetak = useRef<number | null>(null);
  /** Povlačenje je već odlučilo: klik koji slijedi ne mijenja visinu još jednom. */
  const povuceno = useRef(false);
  const i = VISINE.indexOf(visina);
  return (
    <button
      type="button"
      aria-label={visina === "puno" ? "Smanji karticu" : "Povećaj karticu"}
      className="fokus flex h-7 w-full shrink-0 touch-none items-center justify-center"
      onPointerDown={(e) => {
        pocetak.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const dy = pocetak.current === null ? 0 : e.clientY - pocetak.current;
        pocetak.current = null;
        povuceno.current = Math.abs(dy) > 24;
        if (dy < -24) onVisina(VISINE[Math.min(2, i + 1)]);
        else if (dy > 24) {
          if (i === 0) onZatvori();
          else onVisina(VISINE[i - 1]);
        }
      }}
      // dodir i tipkovnica: korak gore, s vrha natrag na najnižu
      onClick={() => {
        if (povuceno.current) {
          povuceno.current = false;
          return;
        }
        onVisina(VISINE[(i + 1) % 3]);
      }}
    >
      <span aria-hidden className="h-1.5 w-10 rounded-full bg-zinc-300" />
    </button>
  );
}

function PreprekeTraka({ zbroj, onOdaberi }: { zbroj: ZbrojGradnje; onOdaberi: (p: IdPrepreke) => void }) {
  const redovi = PREPREKE.map((p) => ({ p, v: haPrepreke(zbroj, p.id) })).sort((a, b) => b.v - a.v);
  const najvise = Math.max(...redovi.map((r) => r.v));
  const stambeno = (zbroj.u_stambenim_zonama_ha.stambeno ?? 0) + (zbroj.u_stambenim_zonama_ha["uz-cestu-stambeno"] ?? 0);
  return (
    <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
      {redovi.map(({ p, v }) => (
        <li key={p.id}>
          <button type="button" onClick={() => onOdaberi(p.id)} className="fokus block w-full px-3 py-2.5 text-left hover:bg-zinc-50 sm:px-4">
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-zinc-900">{p.naziv}</span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-zinc-900">{ha(v)} ha</span>
            </span>
            <span className="mt-1 block h-2 rounded-full bg-zinc-100">
              <span className="block h-2 rounded-full" style={{ ...STIL_PREPREKE, width: `${(v / najvise) * 100}%` }} />
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              {p.opis} <span className="font-semibold text-zinc-700">Prikaži na karti →</span>
            </span>
          </button>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-3 px-3 py-2.5 sm:px-4">
        <span className="flex items-center gap-2 font-semibold text-zinc-900">
          <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID.stambeno)} malo /> Ostaje za novu stambenu zgradu
        </span>
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-zinc-900">{ha(stambeno)} ha</span>
      </li>
    </ul>
  );
}

function IkonaKarte() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M2 5l5-2 6 2 5-2v12l-5 2-6-2-5 2z M7 3v12 M13 5v12" />
    </svg>
  );
}

function IkonaDijeljenja() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13V3M6 7l4-4 4 4M4 11v5h12v-5" />
    </svg>
  );
}

function IkonaPregleda() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 5h12M4 10h12M4 15h8" />
    </svg>
  );
}

function IkonaPovecala() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

function IkonaSlojeva() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 3l8 4-8 4-8-4z M2 11l8 4 8-4" />
    </svg>
  );
}
