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
  type Ishod,
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
const KRATKO: Record<Skupina, string> = { stambeno: "Stambeno", nestambeno: "Nestambeno", nista: "Ništa novo", javno: "Javno", plan: "Po planu" };
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
            <span className="flex-1">{k.naziv}</span>
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
/** Oznaka dozvole na vrhu kartice: puna (izdana) ili iscrtkana (u obradi), kao na karti. */
function OznakaDozvole({ a }: { a: AktGradnje }) {
  const izdana = a.ishod === "izdana";
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
        izdana ? "bg-zinc-900 text-white" : "border-2 border-dashed border-zinc-900 text-zinc-900"
      }`}
    >
      {izdana ? (a.postupak === "građevinska" ? "Građevinska dozvola" : "Lokacijska dozvola") : "Traži se dozvola"}
    </span>
  );
}

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

function ZaglavljeKlika({ k, ishodi }: { k: KarticaSDozvolama; ishodi: Ishod[] }) {
  if (k.stanje.rezim === "izvan")
    return (
      <>
        <h2 className="text-base font-bold leading-snug text-zinc-900">Izvan područja GUP-a</h2>
        {k.podnaslov && <p className="text-xs text-zinc-500">{k.podnaslov}</p>}
      </>
    );
  const { kat } = presuda(k.uzorak);
  const c = k.cestica?.svojstva;
  const ne = ishodi.filter((i) => i === "ne").length;
  const uvjet = ishodi.filter((i) => i === "uvjet").length;
  const mjesto = [k.podnaslov, c ? `k.č. ${c.kc}, k.o. ${naslovno(c.ko)}` : null].filter(Boolean).join(" · ");
  return (
    <>
      {kat && (
        <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white/60" style={{ background: kat.boja }} />
          {SKUPINE_GRADNJE[kat.skupina].kratko}
        </span>
      )}
      {k.akti.length > 0 && <OznakaDozvole a={k.akti.reduce((a, b) => ((b.ishod === "izdana") > (a.ishod === "izdana") ? b : a))} />}
      <h2 className="mt-1.5 text-base font-bold leading-snug text-zinc-900">{kat ? kat.naziv : "Ovdje nema katastarske čestice"}</h2>
      {mjesto && <p className="text-xs text-zinc-500">{mjesto}</p>}
      {(ne > 0 || uvjet > 0) && (
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold">
          {ne > 0 && (
            <span className="text-red-800">
              ✕ {ne} {ne === 1 ? "zapreka" : ne < 5 ? "zapreke" : "zapreka"}
            </span>
          )}
          {uvjet > 0 && (
            <span className="text-amber-900">
              ! {uvjet} {uvjet === 1 ? "uvjet" : "uvjeta"}
            </span>
          )}
        </p>
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
  const vazne = lista.filter((p) => p.ishod !== "nevazno");
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
      {kat && (
        <p className="mt-2 text-zinc-800">
          {javno ? <>Prema evidenciji Grada Splita vlasnik je {VLASNIK_JAVNOG[k.uzorak!.vlasnik as KodVlasnika]}. </> : null}
          {kat.razlog}
        </p>
      )}
      {kat?.id === "po-planu" && (
        <div className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-2 text-zinc-800">
          {k.stanje.rezim === "vazeci" && (
            <p>
              Plan na snazi: <strong className="text-zinc-900">{k.stanje.plan.naziv}</strong>
              {k.stanje.plan.glasnik ? ` („Službeni glasnik Grada Splita”, br. ${k.stanje.plan.glasnik})` : ""}. Gradi se samo po
              njemu (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>); njegovu namjenu ovdje nismo provjerili.
            </p>
          )}
          {ispod && (
            <p className="mt-1 flex items-center gap-2">
              <UzorakBoje stil={uzorakKategorije(ispod)} malo />
              <span>
                Da plana nema, po namjeni novog GUP-a ovdje bi bilo: <strong className="text-zinc-900">{ispod.naziv}</strong>.
              </span>
            </p>
          )}
        </div>
      )}
      {skriveno && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-700">
          Ovaj sloj je na karti skriven.
          <button type="button" onClick={onPrikazi} className="fokus meta font-semibold text-zinc-900 underline">
            Prikaži ga
          </button>
        </p>
      )}

      <h3 className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Što smo provjerili</h3>
      <ol className="mt-1.5 space-y-2">{vazne.map(red)}</ol>
      {nevazne.length > 0 && (
        <details className="mt-2">
          <summary className="fokus meta cursor-pointer text-xs font-semibold text-zinc-500">Ne odnosi se ({nevazne.length})</summary>
          <ol className="mt-1.5 space-y-2">{nevazne.map(red)}</ol>
        </details>
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

function Cip(props: { upaljen: boolean; onClick: () => void; children: ReactNode; oznaka?: string; otvara?: boolean }) {
  const { upaljen, onClick, children, oznaka, otvara } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={otvara ? undefined : upaljen}
      aria-expanded={otvara ? upaljen : undefined}
      aria-label={oznaka}
      className={`fokus inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10 ${
        upaljen ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

function PopisSlojeva(props: {
  zbroj: ZbrojGradnje;
  kategorijePoSkupini: Record<Skupina, Kategorija[]>;
  skrivene: ReadonlySet<IdKategorije>;
  prebaci: (ids: readonly IdKategorije[], vidi: boolean) => void;
}) {
  const { zbroj, kategorijePoSkupini, skrivene, prebaci } = props;
  return (
    <div className="space-y-4">
      {SKUPINE.map((s) => {
        const ids = kategorijePoSkupini[s].map((k) => k.id);
        const st = stanjeSkupine(s, ids, skrivene);
        return (
          <fieldset key={s}>
            <legend className="w-full">
              <label className="meta flex cursor-pointer items-center gap-2.5 py-1 font-semibold text-zinc-900">
                <input
                  type="checkbox"
                  checked={st !== "nista"}
                  ref={(el) => {
                    if (el) el.indeterminate = st === "dio";
                  }}
                  onChange={(e) => prebaci(ids, e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-zinc-900"
                />
                <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[s].glavna])} />
                <span className="flex-1">{SKUPINE_GRADNJE[s].naslov}</span>
                <span className="tabular-nums font-normal text-zinc-500">{ha(zbroj.po_skupini_ha[s] ?? 0)} ha</span>
              </label>
            </legend>
            {/* svaki razlog ima svoj prekidač; svoj uzorak ima samo ono što na karti izgleda drukčije od skupine */}
            <ul className="pl-7">
              {kategorijePoSkupini[s].map((k) => (
                <li key={k.id}>
                  <label className={`meta flex cursor-pointer items-center gap-2.5 py-0.5 text-sm text-zinc-600 ${skrivene.has(k.id) ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={!skrivene.has(k.id)}
                      onChange={(e) => prebaci([k.id], e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-zinc-700"
                    />
                    {istiIzgled(k, KATEGORIJA_PO_ID[SKUPINE_GRADNJE[s].glavna]) ? (
                      <span aria-hidden className="w-6 shrink-0" />
                    ) : (
                      <UzorakBoje stil={uzorakKategorije(k)} />
                    )}
                    <span className="flex-1">{k.naziv}</span>
                    <span className="tabular-nums text-zinc-500">{ha(zbroj.po_kategoriji_ha[k.id] ?? 0)} ha</span>
                  </label>
                </li>
              ))}
            </ul>
            {s === "javno" && (
              <p className="mt-1 pl-7 text-xs text-zinc-500">
                Vlasnik je iz evidencije Grada, koja ga za većinu čestica ne navodi, pa javnog zemljišta ima i više. Javno uže od 10 m
                (ulice, rubovi cesta, putovi) karta ne boji jantarno.
              </p>
            )}
          </fieldset>
        );
      })}
      <ul className="space-y-1.5 border-t border-zinc-200 pt-3 text-sm text-zinc-600">
        <li className="flex items-center gap-2">
          <Crta boja={BOJA_STAMBENE_ZONE} />
          <span>rub zona za stanovanje (S, M1–M3, K5); vidi se kad približiš kartu</span>
        </li>
        <li className="flex items-center gap-2">
          <Crta boja="#18181b" crtice="7 5" />
          <span>granica GUP-a; izvan nje karta ništa ne boji</span>
        </li>
        <li className="flex items-center gap-2">
          <Crta boja="#18181b" />
          <span>tanka međa: čestice jednog zahtjeva ili dozvole, koje karta računa kao jednu građevnu česticu</span>
        </li>
      </ul>
    </div>
  );
}

const haPrepreke = (zbroj: ZbrojGradnje, id: IdPrepreke) =>
  PREPREKA_PO_ID[id].kategorije.reduce((a, k) => a + (zbroj.u_stambenim_zonama_ha[k] ?? 0), 0);

function PopisPrepreka(props: { zbroj: ZbrojGradnje; prepreka: IdPrepreke | null; onOdaberi: (p: IdPrepreke | null) => void }) {
  const { zbroj, prepreka, onOdaberi } = props;
  const red = (id: IdPrepreke | null, naziv: string, opis: string, v?: number) => (
    <li key={id ?? "nista"}>
      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-zinc-50">
        <input
          type="radio"
          name="gradnja-prepreka"
          checked={prepreka === id}
          onChange={() => onOdaberi(id)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-zinc-900"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-zinc-900">{naziv}</span>
          <span className="block text-xs text-zinc-500">{opis}</span>
        </span>
        {v !== undefined && <span className="shrink-0 tabular-nums text-sm text-zinc-600">{ha(v)} ha</span>}
      </label>
    </li>
  );
  return (
    <>
      <p className="text-sm text-zinc-600">
        Samo u zonama u kojima novi GUP dopušta stanovanje (S, M1–M3, K5). Odabrani razlog karta oboji{" "}
        <span className="inline-flex items-center gap-1 align-middle font-semibold text-zinc-900">
          <UzorakBoje stil={STIL_PREPREKE} malo /> ljubičasto
        </span>
        , a ostali upaljeni slojevi izblijede.
      </p>
      <ul className="mt-2">
        {red(null, "Ništa ne ističi", "Karta pokazuje samo upaljene slojeve.")}
        {PREPREKE.map((p) => red(p.id, p.naziv, p.opis, haPrepreke(zbroj, p.id)))}
      </ul>
      <p className="mt-2 border-t border-zinc-200 pt-2 text-xs text-zinc-500">
        U tim zonama za stambenu zgradu ostaje {ha((zbroj.u_stambenim_zonama_ha.stambeno ?? 0) + (zbroj.u_stambenim_zonama_ha["uz-cestu-stambeno"] ?? 0))}{" "}
        ha, od toga {ha(zbroj.u_stambenim_zonama_ha["uz-cestu-stambeno"] ?? 0)} ha tek kad do čestice dođu ulica i kanalizacija.
      </p>
    </>
  );
}

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
  const [rasireno, setRasireno] = useState(false);
  const [ploha, setPloha] = useState<null | "prepreke" | "slojevi">(null);
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
          // glavna kategorija skupine prva (npr. „Mjesto za stambenu zgradu”), pa uvjetna i dozvole
          KATEGORIJE.filter((k) => k.skupina === s && (zbroj.po_kategoriji_ha[k.id] ?? 0) > 0).sort(
            (a, b) => Number(b.id === SKUPINE_GRADNJE[s].glavna) - Number(a.id === SKUPINE_GRADNJE[s].glavna),
          ),
        ]),
      ),
    [zbroj],
  ) as Record<Skupina, Kategorija[]>;

  const prikaz = useMemo<Prikaz>(() => ({ skrivene, prepreka }), [skrivene, prepreka]);

  /** Otvori kartu samo s ovom skupinom (iz pregleda). */
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
      const naziv = sve.length > 1 ? SKUPINE_GRADNJE[k.skupina].naslov : k.naziv;
      out.push({
        naziv,
        ha: sve.reduce((a, x) => a + (zbroj.po_kategoriji_ha[x.id] ?? 0), 0),
        ploha: { boja: k.boja, alfa: prepreka ? k.alfa * 0.4 : k.alfa, pruge: k.pruge, mreza: k.mreza, tocke: k.tocke },
      });
    }
    if ((mapa.current?.getZoom() ?? 0) >= OBRISI_OD_ZUMA) out.push({ naziv: "rub zona za stanovanje", crta: { boja: BOJA_STAMBENE_ZONE, debljina: 2 } });
    out.push({ naziv: "granica GUP-a", crta: { boja: "#18181b", crtice: [10, 7], debljina: 2 } });
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
  const ishodi = k && podaci ? provjere(k.tocka, k.uzorak, k.stanje, k.cestica, odredbe, listovi, putovi).map((p) => p.ishod) : [];
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
                      {sk === "stambeno" &&
                        `${mjesta.stambeno.od_500_m2.toLocaleString("hr-HR")} gradilišta od barem 500 m² bez uvjeta, od toga ${ha(zbroj.po_kategoriji_ha["stambeno-dozvola"])} ha s izdanom i ${ha(zbroj.po_kategoriji_ha["stambeno-zahtjev"])} ha sa zatraženom dozvolom; ${ha(zbroj.po_kategoriji_ha["uz-cestu-stambeno"])} ha tek kad do čestice dođu ulica i kanalizacija`}
                      {sk === "nestambeno" && `od toga ${ha(zbroj.po_kategoriji_ha["uz-cestu-nestambeno"])} ha tek kad do čestice dođu ulica i kanalizacija`}
                      {sk === "nista" && "zgrade s dvorištima, ulice, parkovi, premalo zemljišta, čeka UPU…"}
                      {sk === "javno" && `država, Grad, županija; od toga ${ha(zbroj.po_kategoriji_ha.vojska)} ha vojna zona`}
                      {sk === "plan" &&
                        `slobodno zemljište pod DPU-om ili UPU-om na snazi; po namjeni GUP-a bilo bi ondje ${ha((zbroj.ispod_plana_ha.stambeno ?? 0) + (zbroj.ispod_plana_ha["uz-cestu-stambeno"] ?? 0))} ha za stambenu zgradu`}
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-zinc-700">Prikaži na karti →</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-lg font-bold tabular-nums text-zinc-900">{ha(s[sk])} ha</span>
                    <span className="block text-xs tabular-nums text-zinc-500">{posto(s[sk] / zbroj.ukupno_ha)}</span>
                  </span>
                </button>
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
                  dozvola (mreža) i izdana dozvola (točke). Čestice jednog akta karta računa zajedno, kao jednu građevnu česticu.
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

          {/* vrh: prekidač, tražilica, slojevi */}
          <div
            ref={vrh}
            className="pointer-events-none absolute inset-x-0 top-0 z-[1010] flex flex-col gap-2 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] sm:flex-row sm:items-start sm:gap-3 sm:px-3 sm:pt-3"
          >
            <div className="pointer-events-auto flex items-center gap-2 sm:order-last sm:ml-auto">
              <Prekidac prozor="karta" onPregled={otvoriPregled} onKarta={otvoriKartu} plutajuci />
              <span className="flex-1 sm:hidden" />
              <button
                type="button"
                onClick={() => void napraviSliku()}
                className="fokus inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-zinc-900 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] ring-1 ring-black/10 hover:bg-zinc-50"
              >
                <IkonaDijeljenja /> Podijeli
              </button>
            </div>
            <div className="pointer-events-auto sm:w-[400px] sm:shrink-0 [&_input]:mt-0 [&_input]:h-11 [&_input]:rounded-full [&_input]:border-black/10 [&_input]:px-4 [&_input]:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.15)] [&>div]:max-w-none">
              <TrazilicaAdrese id="gradnja-adresa-karta" natpis="Provjeri adresu" sakrijNatpis onOdaberi={odaberi} />
            </div>
            <div className="pointer-events-auto -mx-2 flex min-w-0 gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {SKUPINE.map((sk) => {
                const ids = kategorijePoSkupini[sk].map((x) => x.id);
                const st = stanjeSkupine(sk, ids, skrivene);
                return (
                  <Cip key={sk} upaljen={st !== "nista"} onClick={() => prebaci(ids, st === "nista")} oznaka={`${SKUPINE_GRADNJE[sk].naslov}: ${st === "nista" ? "skriveno" : "na karti"}`}>
                    <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[sk].glavna])} malo />
                    {KRATKO[sk]}
                    {st === "dio" && <span className="text-xs font-normal opacity-75">(dio)</span>}
                  </Cip>
                );
              })}
              <Cip upaljen={ploha === "prepreke" || !!prepreka} otvara onClick={() => setPloha((p) => (p === "prepreke" ? null : "prepreke"))}>
                {prepreka ? (
                  <>
                    <UzorakBoje stil={STIL_PREPREKE} malo />
                    <span className="max-w-[12rem] truncate">{PREPREKA_PO_ID[prepreka].naziv}</span>
                  </>
                ) : (
                  "Što priječi gradnju?"
                )}
                <span aria-hidden>▾</span>
              </Cip>
              {prepreka && (
                <Cip upaljen={false} onClick={() => setPrepreka(null)} oznaka="Ukloni istaknuti razlog">
                  ×
                </Cip>
              )}
              <Cip upaljen={ploha === "slojevi"} otvara onClick={() => setPloha((p) => (p === "slojevi" ? null : "slojevi"))} oznaka="Svi slojevi i tumač">
                <IkonaSlojeva /> <span className="hidden sm:inline">Slojevi</span>
              </Cip>
            </div>
          </div>

          {ploha && (
            <section
              aria-label={ploha === "prepreke" ? "Što priječi gradnju" : "Slojevi i tumač"}
              className="absolute inset-x-0 bottom-0 z-[1030] max-h-[75dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-zinc-700 shadow-[0_-4px_16px_rgb(0_0_0/0.15)] sm:bottom-auto sm:left-auto sm:right-3 sm:max-h-[calc(100dvh-6rem)] sm:w-[400px] sm:rounded-xl sm:shadow-lg"
              style={siroko ? { top: gore + 4 } : undefined}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-bold text-zinc-900">{ploha === "prepreke" ? "Što priječi gradnju stambene zgrade?" : "Slojevi na karti"}</h2>
                <button type="button" aria-label="Zatvori" onClick={() => setPloha(null)} className="fokus grid h-11 w-11 place-items-center rounded-full text-xl text-zinc-500 hover:bg-zinc-100">
                  ×
                </button>
              </div>
              {ploha === "prepreke" ? (
                <PopisPrepreka
                  zbroj={zbroj}
                  prepreka={prepreka}
                  onOdaberi={(p) => {
                    setPrepreka(p);
                    if (!siroko) setPloha(null);
                  }}
                />
              ) : (
                <PopisSlojeva zbroj={zbroj} kategorijePoSkupini={kategorijePoSkupini} skrivene={skrivene} prebaci={prebaci} />
              )}
            </section>
          )}

          {k && (
            <section
              ref={karticaEl}
              aria-label="Odabrano mjesto"
              className={`absolute inset-x-0 bottom-0 z-[1020] flex flex-col rounded-t-2xl bg-white text-sm leading-relaxed text-zinc-700 shadow-[0_-4px_16px_rgb(0_0_0/0.15)] sm:bottom-3 sm:left-3 sm:right-auto sm:w-[400px] sm:rounded-xl sm:shadow-lg ${
                rasireno ? "max-h-[50dvh]" : ""
              } sm:max-h-none`}
              style={siroko ? { top: gore + 4 } : undefined}
            >
              {!siroko && (
                <RucicaKartice
                  rasireno={rasireno}
                  onRasiri={() => setRasireno(true)}
                  onSkupi={() => setRasireno(false)}
                  onZatvori={zatvoriKarticu}
                />
              )}
              <div className="relative shrink-0 px-4 pb-2 pt-1 sm:pt-4">
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
                    if (!siroko && !rasireno) setRasireno(true);
                  }}
                >
                  <ZaglavljeKlika k={k} ishodi={ishodi} />
                </div>
                {!siroko && !rasireno && (
                  <button
                    type="button"
                    onClick={() => setRasireno(true)}
                    className="fokus mt-1.5 inline-flex h-11 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-900"
                  >
                    Sve provjere i čestica <span aria-hidden>▴</span>
                  </button>
                )}
                <p className="sr-only" aria-live="polite">
                  {presuda(k.uzorak).kat?.naziv ?? ""}
                </p>
              </div>
              {(siroko || rasireno) && (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

/** Ručica ploče odozdo: dodir raširi ili skupi, povlačenje gore raširi, dolje skupi pa zatvori. */
function RucicaKartice(props: { rasireno: boolean; onRasiri: () => void; onSkupi: () => void; onZatvori: () => void }) {
  const { rasireno, onRasiri, onSkupi, onZatvori } = props;
  const pocetak = useRef<number | null>(null);
  return (
    <button
      type="button"
      aria-label={rasireno ? "Skupi karticu" : "Raširi karticu"}
      aria-expanded={rasireno}
      className="fokus flex h-6 w-full shrink-0 touch-none items-center justify-center"
      onPointerDown={(e) => {
        pocetak.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        const dy = pocetak.current === null ? 0 : e.clientY - pocetak.current;
        pocetak.current = null;
        if (dy < -24) onRasiri();
        else if (dy > 24) {
          if (rasireno) onSkupi();
          else onZatvori();
        } else if (rasireno) onSkupi();
        else onRasiri();
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

function IkonaSlojeva() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M10 3l8 4-8 4-8-4z M2 11l8 4 8-4" />
    </svg>
  );
}
