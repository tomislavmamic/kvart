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
  KATEGORIJA_PO_ID,
  KATEGORIJA_PO_KODU,
  istiIzgled,
  OPIS_ZONE,
  VLASNIK_JAVNOG,
  SKUPINE_GRADNJE,
  uzorakKategorije,
  ZONA_GRADNJE,
  type IdKategorije,
  type Kategorija,
  type KodVlasnika,
  type Skupina,
} from "@/lib/gup-grad/gradnja";
import type { OdredbeGradnje, ZbrojGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { KLASA_PO_INDEKSU, type Klasa } from "@/lib/gup-grad/model";
import type { SvojstvaCestice } from "@/lib/gup-grad/provjera";
import { REGIJE } from "@/lib/gup-grad/regije";
import {
  BLIZU_RUBA_M,
  imenicaUz,
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
const SKUPINE: Skupina[] = ["nista", "nestambeno", "stambeno", "javno"];

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

/** Čestica koju gradnja-skupine.py proglašava putom (public/geo/gup-grad/putovi-2025.json). */
interface PutCestice {
  ko: string;
  kc: string;
  sirina_m: number;
  duljina_m: number;
  susjeda: number;
  osm_udio: number;
  uz_ulicu: number;
  razlog: "OSM put uzduž" | "graniči s mnogo čestica" | "dugom stranom uz ulicu";
}
type Putovi = ReadonlyMap<string, PutCestice>;
const kljucPuta = (ko: string, kc: string) => `${ko}|${kc}`;

const broj1 = (v: number) => v.toLocaleString("hr-HR", { maximumFractionDigits: 1 });

/** Zašto je čestica put, rečenicom. */
function zastoPut(p: PutCestice): string {
  const mjere = `široka je najviše ${broj1(p.sirina_m)} m, a duga oko ${p.duljina_m} m`;
  if (p.razlog === "OSM put uzduž")
    return `${mjere}, a njome prolazi put ucrtan u OpenStreetMap (${Math.round(Math.min(1, p.osm_udio) * 100)} % njezine duljine)`;
  if (p.razlog === "graniči s mnogo čestica")
    return `${mjere}, a graniči s ${p.susjeda} ${imenicaUz(p.susjeda, ["česticom", "čestice", "čestica"])} kojima služi kao prilaz`;
  return `${mjere}, a dugom stranom leži uz ulicu (${Math.round(p.uz_ulicu * 100)} % ruba): to je rub ceste ili nogostup`;
}

type Ishod = "da" | "ne" | "uvjet" | "nevazno";

interface Provjera {
  pitanje: string;
  ishod: Ishod;
  odgovor: ReactNode;
}

/** Svako je pitanje postavljeno tako da je „da” u redu (✓). */
const ZNAK: Record<Ishod, { znak: string; klasa: string; naziv: string }> = {
  da: { znak: "✓", klasa: "bg-emerald-100 text-emerald-800", naziv: "u redu" },
  ne: { znak: "✕", klasa: "bg-red-100 text-red-800", naziv: "zapreka" },
  uvjet: { znak: "!", klasa: "bg-amber-100 text-amber-900", naziv: "uz uvjet" },
  nevazno: { znak: "–", klasa: "bg-zinc-100 text-zinc-500", naziv: "ne odnosi se" },
};

/** Što na mjestu stoji, po regiji iz pločice. */
const NA_MJESTU: Record<number, string> = {
  [REGIJE.zgrada]: "zgrada (iz katastra ili gradskog 3D modela iz 2025.)",
  [REGIJE.gradiliste]: "gradilište",
  [REGIJE.ulica]: "ulica, put ili nogostup",
  [REGIJE.parkiraliste]: "parkiralište",
  [REGIJE.javna]: "okoliš javne ustanove (škola, vrtić, bolnica, crkva)",
  [REGIJE.uredjeno]: "igralište, športski teren, trg ili groblje",
  [REGIJE.infrastruktura]: "pruga ili komunalna građevina (trafostanica, vodosprema, benzinska postaja)",
  [REGIJE.zelenilo]: "park ili zelena površina koju održava Grad",
  [REGIJE.okucnica]: "dvorište postojeće zgrade (zemljište koje pravila propisuju uz zgradu)",
};

const NOVA_STAMBENA: Record<string, { ishod: Ishod; tekst: string }> = {
  da: { ishod: "da", tekst: "nova stambena zgrada je dopuštena" },
  interpolacija: { ishod: "uvjet", tekst: "nova stambena zgrada samo između dviju već izgrađenih čestica (interpolacija)" },
  upu: { ishod: "uvjet", tekst: "nova stambena zgrada tek po UPU-u ili DPU-u koji pravila traže" },
  rekonstrukcija: { ishod: "ne", tekst: "nova stambena zgrada nije dopuštena; postojeće se smiju samo obnoviti ili zamijeniti" },
  ne: { ishod: "ne", tekst: "stambena gradnja nije dopuštena" },
  gp: { ishod: "ne", tekst: "gradski projekt: gradit će se tek po odobrenom projektu za cijelo područje, i samo ono što projekt predvidi" },
};

/** Za koju vrstu zgrade vrijedi najmanja čestica („za slobodnostojeću zgradu”); prazno kad je pravila ne navode. */
const TIP_GRADNJE: Record<string, string> = {
  slobodnostojeca: "slobodnostojeću zgradu",
  dvojna: "dvojnu zgradu",
  interpolacija: "zgradu između dviju izgrađenih",
  niz: "zgradu u nizu",
  opcenito: "",
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
  putovi: Putovi | null,
): Provjera[] {
  const navod = (id: string, tekst: ReactNode) => (o.navodi.includes(id) ? <Navod id={id}>{tekst}</Navod> : tekst);
  const klasa: Klasa | undefined = u ? KLASA_PO_INDEKSU.get(u.klasa) : undefined;
  const zona = klasa ? ZONA_GRADNJE[klasa.kod] : null;
  const katId = u ? KATEGORIJA_PO_KODU.get(u.kategorija)?.id : undefined;
  const koridor = katId === "koridor";
  const out: Provjera[] = [];

  // 0. vlasnik: javno zemljište i vojna zona nisu za gradnju građana
  if (u) {
    const vojska = katId === "vojska";
    out.push({
      pitanje: "Je li zemljište u privatnom vlasništvu?",
      ishod: u.vlasnik || vojska || katId === "javni-pojas" ? "ne" : "da",
      odgovor: vojska
        ? "Ne. Ovo je vojna zona (posebna namjena): zemljište za potrebe obrane."
        : katId === "javni-pojas"
          ? "Ne. Ovo je uski pojas javnog zemljišta (rub ceste, put ili prolaz)."
        : u.vlasnik
          ? `Ne. Prema evidenciji Grada Splita vlasnik je ${VLASNIK_JAVNOG[u.vlasnik as KodVlasnika]}.`
          : "Prema evidenciji Grada Splita vlasnik nije država, Grad ni županija. Ta evidencija za mnoge čestice ne navodi vlasnika, pa to nije potvrda.",
    });
  }

  // 1. namjena
  out.push({
    pitanje: "Dopušta li novi GUP ovdje stanovanje?",
    ishod: !zona ? "nevazno" : zona === "stambena" && !koridor ? "da" : "ne",
    odgovor: klasa ? (
      <>
        {klasa.kod === "P" ? (
          <>
            <strong>Neobojeno na karti namjene</strong>: {OPIS_ZONE.promet}.
          </>
        ) : (
          <>
            {navod(navodNamjena(2025, klasa.kod), <strong>{klasa.naziv}</strong>)} ({klasa.kod}): {OPIS_ZONE[zona!]}.
          </>
        )}
        {koridor && " Ovo mjesto zapravo nije obojeno: to je pojas ulice između blokova, koji smo izdvojili sa samog lista."}{" "}
        Pogledaj{" "}
        <NaListu list="namjena-2025" navod="list-namjena-2025" tocka={tocka} listovi={listovi}>
          ovo mjesto na listu 1
        </NaListu>
        .
      </>
    ) : (
      "Ovdje nema katastarske čestice kojoj GUP daje namjenu (more, lučko područje ili neupisano zemljište)."
    ),
  });
  if (!u || !klasa) return out;

  // 2. što stoji
  const slobodno = u.regija >= REGIJE.slobodno;
  out.push({
    pitanje: "Je li mjesto slobodno?",
    ishod: slobodno ? "da" : "ne",
    odgovor: slobodno ? (
      "Da. Nema zgrade, ulice, parkirališta ni uređene površine, a nije ni dvorište postojeće zgrade."
    ) : (
      <>Ne. Ovdje je {NA_MJESTU[u.regija] ?? "nešto izgrađeno"}.</>
    ),
  });

  // 3. pravila gradnje (urbano pravilo)
  const kod = c?.svojstva.u?.["2025"];
  const pravilo = kod ? o.gradnja[kod] : undefined;
  const nazivPravila = kod ? (
    <>
      {navod(navodGradnja(2025, kod), <>Urbano pravilo {kod}</>)}
      {o.nazivi[kod] ? <> „{o.nazivi[kod]}”</> : null}
    </>
  ) : null;
  if (kod === "GP") {
    out.push({
      pitanje: "Dopuštaju li pravila gradnje novu zgradu?",
      ishod: "ne",
      odgovor: <>{nazivPravila}: {NOVA_STAMBENA.gp.tekst}. Dok projekta nema, na slobodnom zemljištu neće se moći graditi.</>,
    });
  } else if (zona === "stambena") {
    const ns = pravilo ? NOVA_STAMBENA[pravilo.nova_stambena] : undefined;
    out.push({
      pitanje: "Dopuštaju li pravila gradnje novu stambenu zgradu?",
      ishod: ns?.ishod ?? "da",
      odgovor: kod ? (
        <>
          {nazivPravila}: {ns?.tekst ?? "pravila ne ograničavaju novu stambenu zgradu"}.
        </>
      ) : (
        "Za ovo mjesto list urbanih pravila ne određuje posebna pravila, pa nova stambena zgrada nije dodatno ograničena."
      ),
    });
  } else {
    out.push({
      pitanje: "Dopuštaju li pravila gradnje novu stambenu zgradu?",
      ishod: "nevazno",
      odgovor: (
        <>
          Ne odnosi se: ta pravila razlikuju stambenu gradnju samo u zonama za stanovanje.{kod ? <> Ovdje vrijedi {nazivPravila}.</> : null}
        </>
      ),
    });
  }

  // 4. planski režim
  const list4d = (t: ReactNode) => (
    <NaListu list="planske-mjere-2025" navod="list-planske-mjere-2025" tocka={tocka} listovi={listovi}>
      {t}
    </NaListu>
  );
  const pitanjeUpu = "Može li se graditi bez čekanja na UPU?";
  let rezim: Provjera;
  switch (s.rezim) {
    case "zabrana":
    case "negradivo": {
      const upu = s.upu ? s.upu.naziv : "UPU";
      if (s.rezim === "negradivo") {
        rezim = {
          pitanje: pitanjeUpu,
          ishod: "nevazno",
          odgovor: <>Ne odnosi se. Ovo je {list4d(NAZIV_PODRUCJA[s.podrucje])}, ali namjena ovdje ionako ne dopušta privatnu gradnju.</>,
        };
      } else if (s.podrucje === "neuredeno") {
        rezim = {
          pitanje: pitanjeUpu,
          ishod: "uvjet",
          odgovor: (
            <>
              Samo uz uvjet. Ovo je {list4d(NAZIV_PODRUCJA.neuredeno)}: GUP ovdje traži {upu} (
              <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Dok ga nema, nova zgrada moći će se graditi samo ako do čestice
              vodi postojeća javna cesta i ako se riješi odvodnja (Zakon o prostornom uređenju, NN 155/25, čl. 180. st. 2. t. 3.). To
              karta ne može provjeriti.
            </>
          ),
        };
      } else if (klasa.kod === "D") {
        rezim = {
          pitanje: pitanjeUpu,
          ishod: "uvjet",
          odgovor: (
            <>
              Za javne i društvene zgrade da. Ovo je {list4d(NAZIV_PODRUCJA[s.podrucje])}, gdje se inače gradi po {upu}, ali javne i
              društvene zgrade smiju se graditi i prije njega (<Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>).
            </>
          ),
        };
      } else {
        rezim = {
          pitanje: pitanjeUpu,
          ishod: "ne",
          odgovor: (
            <>
              Ne. Ovo je {list4d(NAZIV_PODRUCJA[s.podrucje])}: nova zgrada moći će se graditi samo po {upu} (
              <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Do tada se postojeće zgrade smiju samo obnoviti ili zamijeniti.
              Novi GUP ne daje ni rok ni novac za taj plan.
            </>
          ),
        };
      }
      break;
    }
    case "vazeci":
      rezim = {
        pitanje: pitanjeUpu,
        ishod: "uvjet",
        odgovor: (
          <>
            Da, ali po planu koji je ovdje već na snazi: {s.plan.naziv}
            {s.plan.glasnik ? ` („Službeni glasnik Grada Splita”, br. ${s.plan.glasnik})` : ""} (
            <Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>). Njegova pravila mogu biti stroža od GUP-a, a ovdje ih nismo
            provjerili.
          </>
        ),
      };
      break;
    case "preporuka":
      rezim = {
        pitanje: pitanjeUpu,
        ishod: "da",
        odgovor: (
          <>
            Da. GUP za ovo područje preporučuje {s.upu.naziv}, ali dok ga nema, gradi se po GUP-u (
            <Navod id="preporuka-plana-2025">čl. 103. st. 4.</Navod>).
          </>
        ),
      };
      break;
    default:
      rezim = {
        pitanje: pitanjeUpu,
        ishod: "da",
        odgovor: <>Da. Na {list4d("listu 4.d")} ovo mjesto nije u području koje čeka UPU ni u planu koji je već na snazi, pa se gradi po GUP-u.</>,
      };
  }
  out.push(rezim);

  // 5. put
  const put = c ? putovi?.get(kljucPuta(c.svojstva.ko, c.svojstva.kc)) : undefined;
  if (slobodno && (zona === "stambena" || zona === "nestambena") && !koridor) {
    out.push(
      katId === "put"
        ? {
            pitanje: "Je li čestica zemljište za gradnju, a ne put?",
            ishod: "ne",
            odgovor: put ? (
              <>Ne, to je put: {zastoPut(put)}. Na putu se neće graditi, a susjedne čestice ne mogu se preko njega spojiti.</>
            ) : (
              "Ne, to je put: uska je i duga i služi kao prilaz, pa se na njoj neće graditi."
            ),
          }
        : {
            pitanje: "Je li čestica zemljište za gradnju, a ne put?",
            ishod: "da",
            odgovor: "Da. Nije uska, duga čestica kojom prolazi put, koja služi mnogim susjedima ili leži uz ulicu.",
          },
    );
  }

  // 6. veličina i širina
  const vrsta = zona === "stambena" ? "stanovanje" : klasa.kod === "D" ? "javna" : klasa.kod === "I/K" ? "gospodarska" : null;
  const najmanja = vrsta && kod ? o.ppmin[kod]?.[vrsta] : undefined;
  const tip = najmanja ? (TIP_GRADNJE[najmanja.tip] ?? najmanja.tip) : "";
  const najmanjaTekst = najmanja ? (
    <>
      najmanja čestica za gradnju ovdje je {navod(navodPpmin(2025, kod!), m2(najmanja.m2))}
      {tip ? <> za {tip}</> : null}
    </>
  ) : null;
  const pitanjeMjesta = "Ima li dovoljno mjesta za novu česticu?";
  if (!slobodno || zona === "bez-zgrada" || zona === "promet" || katId === "put") {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "nevazno",
      odgovor: katId === "put" ? "Ne odnosi se: na putu se ne gradi." : "Ne odnosi se: mjesto nije slobodno ili namjena ne predviđa zgrade.",
    });
  } else if (u.regija === REGIJE.usko) {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      odgovor: "Ne. Slobodni pojas uži je od oko 9 m (put, stube, rub uz među), a pravila traže česticu široku barem 10 m.",
    });
  } else if (u.regija === REGIJE.premalo) {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      odgovor: (
        <>
          Ne. Slobodni komad manji je od najmanje čestice za gradnju{najmanjaTekst ? <> ({najmanjaTekst})</> : null}, a nema slobodnog
          susjeda iste namjene s kojim bi to dosegao.
        </>
      ),
    });
  } else if (katId === "odmak") {
    out.push({
      pitanje: "Smije li zgrada stajati baš na ovom mjestu?",
      ishod: "ne",
      odgovor:
        "Ne. Gradilište je dovoljno veliko, ali ovo je njegov odmak: zgrada mora biti 5 m od javne ulice i 3 m od susjednih čestica. Ovdje može biti dvorište ili prilaz; mjesto za zgradu na karti je obojeno.",
    });
  } else if (katId === "odmaci") {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      odgovor:
        "Ne. Zemljište je dovoljno široko za česticu, ali zgrada mora biti 5 m od javne ulice i 3 m od susjednih čestica, i kad se ti odmaci oduzmu, ne stane ni zgrada široka 6 m s tlocrtom od 60 m².",
    });
  } else if (katId === "premalo") {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      odgovor:
        "Ne. Ni zajedno sa slobodnim susjedima iste namjene ovdje nema dijela širokog barem 10 m i velikog barem 250 m². Ovo je pojas uz put, ostatak dvorišta ili prolaz između zgrada.",
    });
  } else if (u.regija === REGIJE.slobodno || u.regija === REGIJE.ceka) {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "da",
      odgovor: najmanjaTekst ? (
        <>
          Da: {najmanjaTekst}. Slobodnog zemljišta, zajedno sa slobodnim susjedima iste namjene, ima barem toliko, široko je barem
          10 m, a uz odmake od ulice (5 m) i susjeda (3 m) u njega stane zgrada široka barem 6 m.
        </>
      ) : (
        "Da: slobodno zemljište, zajedno sa slobodnim susjedima iste namjene, ima dio širok barem 10 m i velik barem 250 m², a u njemu i uz odmake od ulice (5 m) i susjeda (3 m) stane zgrada široka barem 6 m."
      ),
    });
  }

  // 7. teren, samo kad je pregledom označen
  if (u.regija === REGIJE.neizgradivo) {
    out.push({
      pitanje: "Može li se na ovom terenu graditi?",
      ishod: "ne",
      odgovor: "Ne. Na snimci iz zraka (ortofotu) vidi se da se ovaj teren ne može graditi.",
    });
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
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Od čega se sastoji čestica">
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

function TumacKlika(props: { k: Kartica; odredbe: OdredbeGradnje; listovi: Record<string, List> | null; putovi: Putovi | null }) {
  const { k, odredbe, listovi, putovi } = props;
  if (k.stanje.rezim === "izvan") {
    return (
      <>
        <h3 className="pr-8 text-base font-bold leading-snug text-zinc-900">Izvan područja GUP-a</h3>
        {k.podnaslov && <p className="font-mono text-xs text-zinc-500">{k.podnaslov}</p>}
        <p className="mt-2">
          Ovdje vrijedi Prostorni plan uređenja Grada Splita. Ova karta pokriva samo područje GUP-a, unutar iscrtkane granice.
        </p>
      </>
    );
  }
  // javno zemljište: presuda je „javno”, a razlog ispod njega ostaje za objašnjenje
  const ispod = k.uzorak ? KATEGORIJA_PO_KODU.get(k.uzorak.kategorija) : undefined;
  const javno = !!k.uzorak?.vlasnik && ispod?.id !== "vojska";
  const kat = javno ? KATEGORIJA_PO_ID.javno : ispod;
  const lista = provjere(k.tocka, k.uzorak, k.stanje, k.cestica, odredbe, listovi, putovi);
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
      <h3 className="mt-2 pr-8 text-base font-bold leading-snug text-zinc-900">{kat ? kat.naziv : "Ovdje nema katastarske čestice"}</h3>
      {k.podnaslov && <p className="font-mono text-xs text-zinc-500">{k.podnaslov}</p>}
      {kat && (
        <p className="mt-1.5 text-zinc-800">
          {javno ? <>Prema evidenciji Grada Splita vlasnik je {VLASNIK_JAVNOG[k.uzorak!.vlasnik as KodVlasnika]}. </> : null}
          {kat.razlog}
        </p>
      )}


      <h4 className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Što smo provjerili za ovo mjesto</h4>
      {/* mobitel nema oblačić (title), pa je ključ oznaka vidljiv */}
      <p className="mt-1 text-xs text-zinc-500">
        {(["da", "ne", "uvjet", "nevazno"] as const).map((i, n) => (
          <span key={i}>
            {n > 0 && " · "}
            {ZNAK[i].znak} {ZNAK[i].naziv}
          </span>
        ))}
      </p>
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
          Ovo mjesto je samo oko {Math.max(1, Math.round(k.stanje.doRuba))} m od granice područja s lista 4.d. Granicu smo precrtali
          sa skeniranog lista, pa za česticu uz granicu provjeri sam list.
        </p>
      )}

      {c && (
        <div className="mt-3 border-t border-zinc-200 pt-2.5">
          <p className="font-semibold text-zinc-900">
            Čestica k.č. {c.kc}, k.o. {naslovno(c.ko)}{" "}
            <span className="font-normal text-zinc-500">· {c.a.toLocaleString("hr-HR")} m² u katastru</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-zinc-600">Od čega se sastoji cijela čestica</p>
          {k.sastav ? <SastavCestice sastav={k.sastav} ukupno={ukupno} /> : <p className="text-xs text-zinc-500">Računa se…</p>}
        </div>
      )}

      <details className="mt-3 border-t border-zinc-200 pt-2.5">
        <summary className="fokus cursor-pointer font-semibold text-zinc-900">Što karta ne provjerava</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-zinc-600">
          <li>vlasništvo</li>
          <li>vodi li do čestice javna cesta i ima li priključke (voda, odvodnja, struja)</li>
          <li>nagib, stijenu i tlo, osim mjesta koja smo na ortofotu označili kao neizgradiva</li>
          <li>zaštitu kulturne baštine i krajobraza (uvjete konzervatora), pojas uz more i vodotoke</li>
          <li>posebne uvjete nadležnih tijela (npr. Hrvatskih voda, HEP-a) i infrastrukturne koridore koji nisu ucrtani kao ulica</li>
          {k.stanje.rezim === "vazeci" && <li>pravila detaljnijeg plana koji ovdje već vrijedi</li>}
        </ul>
        <p className="mt-1.5 text-zinc-600">
          Namjenu smo pročitali s PDF lista, u kvadratićima od oko 2 m, pa uz granicu zone pogreška može biti 5–10 m. Prije kupnje
          ili gradnje zatraži od Grada lokacijsku informaciju.
        </p>
      </details>
    </>
  );
}

export function GradnjaPrikaz({ zbroj, odredbe }: { zbroj: ZbrojGradnje; odredbe: OdredbeGradnje }) {
  const [podaci, setPodaci] = useState<Podaci | null>(null);
  const [greska, setGreska] = useState(false);
  const [skrivene, setSkrivene] = useState<ReadonlySet<IdKategorije>>(new Set());
  const [cilj, setCilj] = useState<CiljKarte | null>(null);
  const [kartica, setKartica] = useState<Kartica | null>(null);
  const [listovi, setListovi] = useState<Record<string, List> | null>(null);
  const [putovi, setPutovi] = useState<Putovi | null>(null);
  const putoviRef = useRef<Promise<Putovi> | null>(null);
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

  /** Pali ili gasi kategorije na karti (skupina = sve njezine kategorije odjednom). */
  const prebaci = (ids: readonly IdKategorije[], vidi: boolean) =>
    setSkrivene((stare) => {
      const nove = new Set(stare);
      for (const id of ids) {
        if (vidi) nove.delete(id);
        else nove.add(id);
      }
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
          podnaslov={puno ? undefined : "Ili dodirni bilo koje mjesto na karti: vidjet ćeš što se ondje smije graditi i zašto."}
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
              <TumacKlika k={kartica} odredbe={odredbe} listovi={listovi} putovi={putovi} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-x-8 gap-y-5 text-sm text-zinc-700 sm:grid-cols-2">
        {SKUPINE.map((s) => {
          const ids = kategorijePoSkupini[s].map((k) => k.id);
          const vidljivih = ids.filter((id) => !skrivene.has(id)).length;
          return (
            <fieldset key={s}>
              <legend className="w-full">
                <label className="flex cursor-pointer items-center gap-2 font-semibold text-zinc-900">
                  <input
                    type="checkbox"
                    checked={vidljivih > 0}
                    ref={(el) => {
                      if (el) el.indeterminate = vidljivih > 0 && vidljivih < ids.length;
                    }}
                    onChange={(e) => prebaci(ids, e.target.checked)}
                    className="h-4 w-4 accent-zinc-900"
                  />
                  <UzorakBoje stil={uzorakKategorije(KATEGORIJA_PO_ID[SKUPINE_GRADNJE[s].glavna])} />
                  <span className="flex-1">{SKUPINE_GRADNJE[s].naslov}</span>
                  <span className="tabular-nums font-normal text-zinc-500">{ha(zbroj.po_skupini_ha[s] ?? 0)} ha</span>
                </label>
              </legend>
              {/* svaki razlog ima svoj prekidač; svoj uzorak ima samo ono što na karti izgleda drukčije od skupine */}
              <ul className="mt-1.5 space-y-1 pl-6">
                {kategorijePoSkupini[s].map((k) => (
                  <li key={k.id}>
                    <label className={`flex cursor-pointer items-center gap-2 text-zinc-600 ${skrivene.has(k.id) ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox"
                        checked={!skrivene.has(k.id)}
                        onChange={(e) => prebaci([k.id], e.target.checked)}
                        className="h-3.5 w-3.5 shrink-0 accent-zinc-700"
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
                <p className="mt-1.5 pl-6 text-xs text-zinc-500">
                  Vlasnik je iz evidencije Grada, koja ga za većinu čestica ne navodi, pa javnog zemljišta ima i više. Javno uže od
                  10 m (ulice, rubovi cesta, putovi) karta ne boji jantarno.
                </p>
              )}
            </fieldset>
          );
        })}
        <ul className="space-y-1.5 sm:col-span-2">
          <li className="flex items-center gap-2">
            <Crta boja={BOJA_STAMBENE_ZONE} />
            <span>rub zona u kojima novi GUP dopušta stanovanje (S, M1–M3, K5); vidi se kad približiš kartu</span>
          </li>
          <li className="flex items-center gap-2">
            <Crta boja="#18181b" crtice="7 5" />
            <span>granica GUP-a; izvan nje karta ništa ne boji</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
