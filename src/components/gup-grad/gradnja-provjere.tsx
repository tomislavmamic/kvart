"use client";

/**
 * Tumač klika na /gup/gradnja: popis onoga što je za točku provjereno,
 * redom kojim bi to pitao onaj tko želi graditi, i za svaku stavku prolazi
 * li, priječi li ili postavlja uvjet:
 *
 *  - vlasnik (javno zemljište, vojska)
 *  - namjena s lista 1 (gradnja.ts, ZONA_GRADNJE)
 *  - što na mjestu stoji (regija iz pločice)
 *  - odredbe područja urbanog pravila (stambene i mješovite zone)
 *  - planski režim s lista 4.d i planovi na snazi (stanjeTocke, zabrana.ts)
 *  - je li čestica put, ostatak čestice s kućom, veličina i širina
 *    slobodnog zemljišta (najmanja građevna čestica, odmaci)
 *
 * Uz to dohvat katastarske čestice pod točkom.
 */
import type { ReactNode } from "react";
import type { FeatureCollection } from "geojson";

import { Navod } from "@/components/gup-dokument/navod";
import type { Uzorak } from "@/components/gup-grad/gradnja-plocice";
import { jeJavno, KATEGORIJA_PO_KODU, OPIS_ZONE, PLAN_NA_SNAZI, VLASNIK_JAVNOG, ZONA_GRADNJE, type KodVlasnika } from "@/lib/gup-grad/gradnja";
import type { OdredbeGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { KLASA_PO_INDEKSU, type Klasa } from "@/lib/gup-grad/model";
import type { SvojstvaCestice } from "@/lib/gup-grad/provjera";
import { REGIJE } from "@/lib/gup-grad/regije";
import { imenicaUz, NAZIV_PODRUCJA, oblik, plociceZaTocku, uObliku, type Geometrija, type PlocicaCestica, type Stanje } from "@/lib/gup-grad/zabrana";
import { navodGradnja, navodNamjena, navodPpmin, navodTocke, tockaNaListu } from "@/lib/gup-dokument/id";
import { uHtrs } from "@/lib/gup-dokument/htrs";
import { putTocke } from "@/lib/gup-dokument/listovi-klijent";
import type { List } from "@/lib/gup-dokument/model";

/** Površina iz rešetke od ~2 m, zaokružena na 5 m². */
export const m2 = (v: number) => `${(Math.round(v / 5) * 5).toLocaleString("hr-HR")} m²`;

// ------------------------------------------------------------- čestica pod klikom

export interface CesticaKlika {
  svojstva: SvojstvaCestice;
  geometrija: Geometrija;
}

/** Katastarska čestica pod točkom iz pločica /gup (public/geo/gup-grad/cestice), sa svojstvima i oblikom. */
export function dohvacacCestica() {
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
export interface PutCestice {
  ko: string;
  kc: string;
  sirina_m: number;
  duljina_m: number;
  susjeda: number;
  osm_udio: number;
  uz_ulicu: number;
  razlog: "OSM put uzduž" | "graniči s mnogo čestica" | "dugom stranom uz ulicu";
}
export type Putovi = ReadonlyMap<string, PutCestice>;
export const kljucPuta = (ko: string, kc: string) => `${ko}|${kc}`;

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

export type Ishod = "da" | "ne" | "uvjet" | "nevazno";

export interface Provjera {
  pitanje: string;
  ishod: Ishod;
  odgovor: ReactNode;
  /** Zapreka ili uvjet kratko, kao tvrdnja (vrh kartice): „Nova zgrada tek po UPU-u”. */
  sazetak?: string;
}

/** Svako je pitanje postavljeno tako da je „da” u redu (✓). */
export const ZNAK: Record<Ishod, { znak: string; klasa: string; naziv: string }> = {
  da: { znak: "✓", klasa: "bg-emerald-100 text-emerald-800", naziv: "u redu" },
  ne: { znak: "✕", klasa: "bg-red-100 text-red-800", naziv: "zapreka" },
  uvjet: { znak: "!", klasa: "bg-amber-100 text-amber-900", naziv: "uvjet" },
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

const NOVA_STAMBENA: Record<string, { ishod: Ishod; tekst: string; sazetak?: string }> = {
  da: { ishod: "da", tekst: "nova stambena zgrada je dopuštena" },
  interpolacija: {
    ishod: "uvjet",
    tekst: "nova stambena zgrada samo između dviju već izgrađenih čestica (interpolacija)",
    sazetak: "Samo između dviju izgrađenih čestica",
  },
  upu: { ishod: "uvjet", tekst: "nova stambena zgrada tek po UPU-u ili DPU-u koji pravila traže", sazetak: "Nova zgrada tek po UPU-u ili DPU-u" },
  rekonstrukcija: {
    ishod: "ne",
    tekst: "nova stambena zgrada nije dopuštena; postojeće se smiju samo obnoviti ili zamijeniti",
    sazetak: "Pravila: samo obnova postojećih zgrada",
  },
  ne: { ishod: "ne", tekst: "stambena gradnja nije dopuštena", sazetak: "Pravila ne dopuštaju stanovanje" },
  gp: {
    ishod: "ne",
    tekst: "gradski projekt: gradit će se tek po odobrenom projektu za cijelo područje, i samo ono što projekt predvidi",
    sazetak: "Gradski projekt: čeka se odobrenje",
  },
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

export function provjere(
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
  // pod DPU-om na snazi (i onim koji dopušta stanovanje) namjena GUP-a ne odlučuje
  const naPlanu =
    u?.vlasnik === PLAN_NA_SNAZI || katId === "po-dpu-stambeno" || (s.rezim === "vazeci" && /^(DPU|PUP)/.test(s.plan.naziv));
  const out: Provjera[] = [];

  // 0. vlasnik: javno zemljište i vojna zona nisu za gradnju građana
  if (u) {
    const vojska = katId === "vojska";
    out.push({
      pitanje: "Je li zemljište u privatnom vlasništvu?",
      ishod: jeJavno(u.vlasnik) || vojska || katId === "javni-pojas" ? "ne" : "da",
      sazetak: vojska ? "Vojna zona" : "Javno zemljište",
      odgovor: vojska
        ? "Ne. Ovo je vojna zona (posebna namjena): zemljište za potrebe obrane."
        : katId === "javni-pojas"
          ? "Ne. Ovo je uski pojas javnog zemljišta (rub ceste, put ili prolaz)."
        : jeJavno(u.vlasnik)
          ? `Ne. Prema evidenciji Grada Splita vlasnik je ${VLASNIK_JAVNOG[u.vlasnik as KodVlasnika]}.`
          : "Prema evidenciji Grada Splita vlasnik nije država, Grad ni županija. Ta evidencija za mnoge čestice ne navodi vlasnika, pa to nije potvrda.",
    });
  }

  // 1. namjena
  out.push({
    pitanje: "Dopušta li novi GUP ovdje stanovanje?",
    // pod planom na snazi namjena GUP-a ne odlučuje: „ne” bi bio lažna zapreka
    ishod: !zona ? "nevazno" : zona === "stambena" && !koridor ? "da" : naPlanu ? "uvjet" : "ne",
    sazetak: naPlanu
      ? "Novi GUP ovdje ne stanovanje, ali odlučuje DPU"
      : zona === "nestambena"
        ? "Novi GUP: ovdje nema stanovanja"
        : "Novi GUP: ovdje se ne gradi",
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
        {koridor && " Ovo mjesto zapravo nije obojeno: to je pojas ulice između blokova, koji smo izdvojili sa samog lista."}
        {naPlanu && zona !== "stambena" && " Ovdje ipak odlučuje DPU koji je na snazi, a on stanovanje može dopuštati."}{" "}
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
    sazetak: "Mjesto je već izgrađeno ili zauzeto",
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
      sazetak: NOVA_STAMBENA.gp.sazetak,
      odgovor: <>{nazivPravila}: {NOVA_STAMBENA.gp.tekst}. Dok projekta nema, na slobodnom zemljištu neće se moći graditi.</>,
    });
  } else if (zona === "stambena") {
    const ns = pravilo ? NOVA_STAMBENA[pravilo.nova_stambena] : undefined;
    out.push({
      pitanje: "Dopuštaju li pravila gradnje novu stambenu zgradu?",
      ishod: ns?.ishod ?? "da",
      sazetak: ns?.sazetak,
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
          sazetak: "Treba pristupna cesta i kanalizacija",
          odgovor: (
            <>
              Samo uz uvjet. Ovo je {list4d(NAZIV_PODRUCJA.neuredeno)}: ulica i kanalizacija koje plan ovdje predviđa još nisu
              izgrađene (<Navod id="neuredeno-infrastruktura-2025">čl. 106. st. 1.</Navod>), pa GUP traži {upu} (
              <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Dok ga nema, dozvola za novu zgradu može se dobiti tek kad:
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  do čestice vodi ulica izgrađena u punoj širini koju joj plan određuje (
                  <Navod id="kolni-pristup-2025">čl. 49.f st. 1.</Navod>). Za pristupnu ulicu to je pojas od 10 m s kolnikom od barem
                  5,5 m (<Navod id="profil-pristupne-ulice-2025">čl. 32.</Navod>). Iznimno je dovoljan prilaz širok 3 m: ulica u već
                  izgrađenom dijelu grada koja se ne može proširiti, ili vlastiti put do 50 m za najviše dvije niske stambene zgrade (
                  <Navod id="pristup-iznimke-2025">čl. 49.f st. 4. i 5.</Navod>);
                </li>
                <li>čestica se može priključiti na kanalizaciju ili vlastiti sustav odvodnje otpadnih voda.</li>
              </ul>
              Isto traži i Zakon o prostornom uređenju (NN 155/25, čl. 180. st. 2. t. 3.). Ni ulicu ni kanalizaciju karta ne provjerava.
            </>
          ),
        };
      } else if (klasa.kod === "D") {
        rezim = {
          pitanje: pitanjeUpu,
          ishod: "uvjet",
          sazetak: "Prije UPU-a samo javne i društvene zgrade",
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
          sazetak: "Ništa novo dok se ne donese UPU",
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
        sazetak: `Vrijedi ${s.plan.naziv.split(" ")[0]} na snazi; pravila nisu provjerena`,
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
            sazetak: "Čestica je zapravo put",
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
      sazetak: "Preusko za građevnu česticu",
      odgovor: "Ne. Slobodni pojas uži je od oko 9 m (put, stube, rub uz među), a pravila traže česticu široku barem 10 m.",
    });
  } else if (u.regija === REGIJE.premalo) {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      sazetak: "Premalo za građevnu česticu",
      odgovor: (
        <>
          Ne. Slobodni komad manji je od najmanje čestice za gradnju{najmanjaTekst ? <> ({najmanjaTekst})</> : null}, a nema slobodnog
          susjeda iste namjene s kojim bi to dosegao.
        </>
      ),
    });
  } else if (katId === "ostatak-kuce") {
    out.push({
      pitanje: "Može li se ostatak čestice odvojiti za novu zgradu?",
      ishod: "ne",
      sazetak: "Ostatak čestice uz postojeću zgradu",
      odgovor:
        "Ne. Na ovoj čestici već stoji zgrada. Nova zgrada smjela bi se graditi samo kad bi se ostatak mogao odvojiti u vlastitu česticu od barem 400 m², široku posvuda barem 10 m. Slobodni dio oko postojeće zgrade to nije, a sa susjednim česticama ne spaja se.",
    });
  } else if (katId === "odmak") {
    out.push({
      pitanje: "Smije li zgrada stajati baš na ovom mjestu?",
      ishod: "ne",
      sazetak: "Odmak od ulice i susjeda (dvorište)",
      odgovor:
        "Ne. Gradilište je dovoljno veliko, ali ovo je njegov odmak: zgrada mora biti 5 m od javne ulice i 3 m od susjednih čestica. Ovdje može biti dvorište ili prilaz; mjesto za zgradu na karti je obojeno.",
    });
  } else if (katId === "odmaci") {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      sazetak: "Zgrada ne stane uz odmake",
      odgovor:
        "Ne. Zemljište je dovoljno široko za česticu, ali zgrada mora biti 5 m od javne ulice i 3 m od susjednih čestica, i kad se ti odmaci oduzmu, ne ostaje 150 m² mjesta za zgradu široku 8 m.",
    });
  } else if (katId === "premalo") {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "ne",
      sazetak: "Premalo ili preusko za zgradu",
      odgovor:
        "Ne. Ni zajedno sa slobodnim susjedima iste namjene ovdje nema dijela širokog barem 10 m i velikog barem 400 m². Ovo je pojas uz put, ostatak dvorišta ili prolaz između zgrada.",
    });
  } else if (u.regija === REGIJE.slobodno || u.regija === REGIJE.ceka) {
    out.push({
      pitanje: pitanjeMjesta,
      ishod: "da",
      odgovor: najmanjaTekst ? (
        <>
          Da: {najmanjaTekst}. Slobodnog zemljišta, zajedno sa slobodnim susjedima iste namjene, ima barem toliko, široko je barem
          10 m, a uz odmake od ulice (5 m) i susjeda (3 m) u njemu ostaje barem 150 m² mjesta za zgradu široku barem 8 m.
        </>
      ) : (
        "Da: slobodno zemljište, zajedno sa slobodnim susjedima iste namjene, ima dio širok barem 10 m i velik barem 400 m², a u njemu i uz odmake od ulice (5 m) i susjeda (3 m) ostaje barem 150 m² mjesta za zgradu široku barem 8 m."
      ),
    });
  }

  // 7. teren, samo kad je pregledom označen
  if (u.regija === REGIJE.neizgradivo) {
    out.push({
      pitanje: "Može li se na ovom terenu graditi?",
      ishod: "ne",
      sazetak: "Teren nije za gradnju",
      odgovor: "Ne. Na snimci iz zraka (ortofotu) vidi se da se ovaj teren ne može graditi.",
    });
  }
  return out;
}
