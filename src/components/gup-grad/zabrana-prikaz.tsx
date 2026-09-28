"use client";

/**
 * /gup/zabrana: tražilica adrese, karta i popis po UPU-u.
 *
 * Podatke karte (zabrana-2025.geojson, planski-rezim-2025.geojson i
 * sporne-2025.geojson) učita jednom i iz njih računa stanje svake točke
 * (stanjeTocke); karta
 * (zabrana-karta.tsx) samo crta i javlja klik, a učitava se bez SSR-a.
 * Kućni brojevi (~0,5 MB) stižu tek kad se krene tipkati adresa.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { FeatureCollection } from "geojson";

import { Navod } from "@/components/gup-dokument/navod";
import { navodTocke } from "@/lib/gup-dokument/id";
import type { CiljKarte, OznakaKarte } from "@/components/gup-grad/zabrana-karta";
import type { RedUpu } from "@/lib/gup-grad/zabrana-podaci";
import {
  BLIZU_RUBA_M,
  BOJE_ZABRANE,
  cesticaUTocki,
  imenicaUz,
  IZVOR_OZNAKE,
  mjestoNaPpugu,
  NAZIV_PODRUCJA,
  naslovno,
  plociceZaTocku,
  pripremiAdrese,
  slojeviIzGeojsona,
  spojiOkvire,
  stanjeTocke,
  trazi,
  type Adrese,
  type Prijedlog,
  type SiroveAdrese,
  type ListPpug,
  type PlocicaCestica,
  type PlohaSanacije,
  type Slojevi,
  type SpornaCestica,
  type Stanje,
} from "@/lib/gup-grad/zabrana";

const ZabranaKarta = dynamic(() => import("@/components/gup-grad/zabrana-karta").then((m) => m.ZabranaKarta), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

/**
 * Katastarska čestica pod klikom, iz pločica čestica koje koristi i /gup
 * (public/geo/gup-grad/cestice). Indeks i pločica dohvaćaju se jednom.
 */
function dohvacacCestica() {
  let indeks: Promise<PlocicaCestica[]> | null = null;
  const plocice = new Map<string, Promise<FeatureCollection | null>>();
  return async (lng: number, lat: number) => {
    indeks ??= fetch("/geo/gup-grad/cestice-indeks.json")
      .then((r) => r.json() as Promise<{ plocice: PlocicaCestica[] }>)
      .then((d) => d.plocice);
    const ids = plociceZaTocku(await indeks, lng, lat);
    const fcs = await Promise.all(
      ids.map((id) => {
        if (!plocice.has(id)) {
          plocice.set(
            id,
            fetch(`/geo/gup-grad/cestice/${id}.json`)
              .then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : null))
              .catch(() => null),
          );
        }
        return plocice.get(id)!;
      }),
    );
    return cesticaUTocki(fcs.filter((f): f is FeatureCollection => f !== null), lng, lat);
  };
}

/** Popis po UPU-u je dug (preko 30); prvih toliko je odmah vidljivo. */
const PRVIH_UPU = 12;

const ha = (v: number) => v.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const broj = (v: number) => v.toLocaleString("hr-HR");
/** Površina čestice zaokružena na desetak m²: izračun ide po rešetki od 2 m. */
const okrugloM2 = (v: number) => (Math.round(v / 10) * 10).toLocaleString("hr-HR");

interface Podaci {
  zabrana: FeatureCollection;
  planovi: FeatureCollection;
  cestice: FeatureCollection;
  sporne: FeatureCollection | null;
  slojevi: Slojevi;
}

type Kartica = { oznaka: string; boja: "zabrana" | "sivo" | "zeleno"; naslov: string; podnaslov?: string; tijelo: ReactNode };

function Znacka({ boja, children }: { boja: Kartica["boja"]; children: ReactNode }) {
  const klasa = {
    zabrana: "bg-zinc-900 text-white",
    sivo: "bg-zinc-200 text-zinc-800",
    zeleno: "bg-emerald-100 text-emerald-900",
  }[boja];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${klasa}`}>{children}</span>;
}

const metri = (v: number) => v.toLocaleString("hr-HR", { maximumFractionDigits: 1 });

/** Zašto je oznaka ovdje sporna (sporne-2025.geojson); null ako nije. */
function spor(sporna: SpornaCestica | null, ploha: PlohaSanacije | null): ReactNode {
  const vise = (
    <Link href="/gup/analiza#oznake" className="fokus font-semibold underline">
      Više u analizi
    </Link>
  );
  if (sporna?.razlozi.includes("pristup")) {
    return (
      <p className="mb-2 rounded-lg border-l-4 border-fuchsia-600 bg-fuchsia-50 px-2.5 py-1.5 text-fuchsia-950">
        <strong>Sporna oznaka.</strong> Veći je dio čestice k.č. {sporna.kc} označen kao neuređeni dio, a čestica
        graniči s cestom čija je katastarska čestica široka oko {`${metri(sporna.sirina ?? 4)}\u00a0m`}
        {sporna.kanal ? ", a na manje od 15\u00a0m prolazi i kanalizacija" : ""}. Prema kriteriju iz obrazloženja prijedloga
        zemljište s pristupom postojećoj cesti širokoj barem 4 m nije neuređeno, ako je cesta doista izvedena u toj
        širini. {vise}
      </p>
    );
  }
  if (sporna?.razlozi.includes("ppug")) {
    return (
      <p className="mb-2 rounded-lg border-l-4 border-fuchsia-600 bg-fuchsia-50 px-2.5 py-1.5 text-fuchsia-950">
        <strong>Sporna oznaka.</strong> List 4.d GUP-a čestici k.č. {sporna.kc} pripisuje neuređeni dio, a na listu
        građevinskih područja PPUG-a, koji taj dio određuje, čestica nije šrafirana. {vise}
      </p>
    );
  }
  if (sporna?.razlozi.includes("cesta")) {
    return (
      <p className="mb-2 rounded-lg border-l-4 border-fuchsia-400 bg-fuchsia-50 px-2.5 py-1.5 text-fuchsia-950">
        <strong>Moguće sporna oznaka.</strong> Čestica k.č. {sporna.kc} graniči s cestom koje nema u gradskom registru
        nerazvrstanih cesta ili joj se širina ne da izmjeriti{sporna.kanal ? ", a na manje od 15\u00a0m prolazi kanalizacija" : ""}.
        Ako je cesta izvedena i javna, Grad je u raspravi o PPUG-u takve čestice prebacivao u uređeni dio kad je vlasnik to
        dokazao. {vise}
      </p>
    );
  }
  if (ploha?.manjina) {
    return (
      <p className="mb-2 rounded-lg border-l-4 border-fuchsia-600 bg-fuchsia-50 px-2.5 py-1.5 text-fuchsia-950">
        <strong>Sporna oznaka.</strong> U ovoj plohi urbane sanacije rješenje o izvedenom stanju prema registru ima{" "}
        {broj(ploha.sRjesenjem)} od {broj(ploha.zgrade)} zgrada ({ploha.udio} %). Zakon mjere urbane sanacije propisuje
        za područja na kojima pretežu ozakonjene zgrade. {vise}
      </p>
    );
  }
  if (ploha) {
    return (
      <p className="mb-2 text-zinc-600">
        U ovoj plohi urbane sanacije rješenje o izvedenom stanju prema registru ima {broj(ploha.sRjesenjem)} od{" "}
        {broj(ploha.zgrade)} zgrada ({ploha.udio} %).
      </p>
    );
  }
  return null;
}

const RAZRED_PPUG = { U: "šrafirana kao neuređena", I: "u izgrađenom dijelu", N: "u neizgrađenom, ali uređenom dijelu" } as const;

function karticaStanja(
  s: Stanje,
  ppug: { list: ListPpug; tocka: [number, number]; razred?: "U" | "I" | "N" } | null = null,
): Kartica {
  const rub =
    s.rezim !== "izvan" && s.doRuba < BLIZU_RUBA_M ? (
      <p className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-800">
        Ovo je mjesto oko {Math.max(1, Math.round(s.doRuba))} m od ruba područja zabrane. Karta je precrtana sa
        skeniranog lista, pa za česticu uz rub provjeri <Navod id="list-planske-mjere-2025">list 4.d</Navod>.
      </p>
    ) : null;
  switch (s.rezim) {
    case "zabrana": {
      const naListuPpug = ppug && <Navod id={navodTocke(ppug.list.id, ppug.tocka)}>listu {ppug.list.broj} PPUG-a</Navod>;
      return {
        oznaka: "Bez UPU-a nema nove gradnje",
        boja: "zabrana",
        naslov: s.upu ? `Potreban je ${s.upu.naziv}` : "Potreban je UPU",
        tijelo: (
          <>
            <p className="mb-2 flex items-start gap-2">
              <span aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: BOJE_ZABRANE[s.podrucje] }} />
              <span>
                {s.podrucje === "neuredeno" ? (
                  <>
                    Ovo je <strong>neuređeni dio građevinskog područja</strong>. Odredio ga je prijedlog izmjena PPUG-a, po
                    katastarskim česticama u mjerilu 1:5000
                    {naListuPpug ? <> (ovo mjesto na {naListuPpug}{ppug?.razred && s.cestica ? `: čestica je ${RAZRED_PPUG[ppug.razred]}` : ""})</> : ""},
                    a GUP ga preuzima na <Navod id="list-planske-mjere-2025">list 4.d</Navod>.
                  </>
                ) : (
                  <>
                    Ovo je <strong>{NAZIV_PODRUCJA[s.podrucje]}</strong>. Tu oznaku određuje sam GUP, na{" "}
                    <Navod id="list-planske-mjere-2025">listu 4.d</Navod> u mjerilu 1:10.000.
                    {naListuPpug && ppug?.razred && s.cestica ? <> Na {naListuPpug} čestica je {RAZRED_PPUG[ppug.razred]}.</> : ""}
                  </>
                )}{" "}
                Do donošenja {s.upu ? "tog plana" : "UPU-a"} ne bi se mogla ishoditi dozvola za novu zgradu (
                <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>).
                {s.upu ? "" : " Na listu 4.d ovdje nije ucrtan obuhvat nijednog propisanog UPU-a."}
              </span>
            </p>
            {spor(s.sporna, s.ploha)}
            {s.cestica && (
              <p className="mb-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-900">
                {s.cestica.neizgradjena ? (
                  <>
                    <strong>Neizgrađena čestica</strong> k.č. {s.cestica.kc} (k.o. {naslovno(s.cestica.ko)}): na oko{" "}
                    {okrugloM2(s.cestica.m2)} m² nova bi se zgrada smjela graditi tek nakon donošenja UPU-a.
                  </>
                ) : (
                  <>
                    <strong>Djelomično izgrađena čestica</strong> k.č. {s.cestica.kc} (k.o. {naslovno(s.cestica.ko)}): na
                    slobodnom dijelu od oko {okrugloM2(s.cestica.m2)} m² nova bi se zgrada smjela graditi tek nakon donošenja UPU-a.
                  </>
                )}
              </p>
            )}
            <p className="mt-2">
              I dalje su dopuštene rekonstrukcija postojeće zgrade i njezina zamjena na istoj čestici (Zakon o prostornom
              uređenju, čl. 106. st. 3.) te gradnja ulica, manjih infrastrukturnih građevina i javnih zgrada (
              <Navod id="do-plana-2025">čl. 105. st. 5.</Navod>).
            </p>
            {s.podrucje === "sanacija" && s.cestica?.neizgradjena && (
              <p className="mt-2">
                <strong>Čestica je prazna, a ipak je u urbanoj sanaciji.</strong> GUP tu oznaku ne crta po česticama, nego kao
                jednu plohu preko cijelog izgrađenog dijela naselja, a PPUG i prazne čestice unutar izgrađenog bloka vodi kao
                izgrađeni dio. Za razliku od neuređenog dijela, ovdje do UPU-a nema iznimke za čestice uz postojeću cestu, pa
                se na njoj ne bi smjelo graditi ništa novo.
              </p>
            )}
            {s.podrucje === "neuredeno" && (
              <p className="mt-2">
                <strong>Ako do čestice vodi postojeća javna cesta</strong> i odvodnja se može riješiti, nova se zgrada može
                dobiti i prije UPU-a: lokacijskom dozvolom, koju stranka smije zatražiti za svaku zgradu, pa građevinskom
                dozvolom prema njoj (Zakon o prostornom uređenju, čl. 154. st. 1. t. 13. i čl. 180. st. 2. t. 3.; Zakon o
                gradnji, čl. 74.). Uvjet je i da se time ne sprečava opremanje drugog zemljišta. Na taj put vlasnike upućuje i
                sam Grad.
              </p>
            )}
            {rub}
          </>
        ),
      };
    }
    case "vazeci":
      return {
        oznaka: "Važeći plan",
        boja: "sivo",
        naslov: s.plan.naziv,
        tijelo: (
          <>
            <p>
              Ovdje se gradi prema tom planu
              {s.plan.glasnik ? ` („Službeni glasnik Grada Splita”, br. ${s.plan.glasnik})` : ""}, pa se zabrana iz
              prijedloga ne primjenjuje (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>).
            </p>
            {rub}
          </>
        ),
      };
    case "preporuka":
      return {
        oznaka: "Gradnja je moguća",
        boja: "zeleno",
        naslov: `Unutar obuhvata: ${s.upu.naziv}`,
        tijelo: (
          <>
            <p>
              Prijedlog ovdje propisuje izradu UPU-a, ali ovo zemljište nije područje urbane sanacije ni urbane
              preobrazbe, a ni neuređeni dio građevinskog područja, pa se do donošenja UPU-a gradi neposrednom provedbom
              GUP-a (<Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
            </p>
            {rub}
          </>
        ),
      };
    case "gup":
      return {
        oznaka: "Gradnja je moguća",
        boja: "zeleno",
        naslov: "Gradi se prema GUP-u",
        tijelo: (
          <>
            <p>
              Ovdje nije propisan plan užeg područja niti je koji na snazi, pa se dozvole izdaju neposrednom provedbom
              GUP-a.
            </p>
            {rub}
          </>
        ),
      };
    case "izvan":
      return {
        oznaka: "Izvan GUP-a",
        boja: "sivo",
        naslov: "Izvan obuhvata GUP-a",
        tijelo: (
          <p>Ovdje se primjenjuje Prostorni plan uređenja Grada Splita, a ova karta obuhvaća samo područje GUP-a.</p>
        ),
      };
  }
}

function Uzorak({ stil }: { stil: CSSProperties }) {
  return <span aria-hidden className="inline-block h-4 w-6 shrink-0 rounded-sm" style={stil} />;
}

const NAZIV_OZNAKE = { sanacija: "urbana sanacija", preobrazba: "urbana preobrazba", neuredeno: "neuređeni dio" } as const;

function Stavka({ stil, children }: { stil: CSSProperties; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Uzorak stil={stil} />
      <span>{children}</span>
    </li>
  );
}

/** Skupina tumača; ako ima prekidač, on pali i gasi taj sloj karte. */
function Skupina(props: { naslov: string; vidljivo?: boolean; promijeni?: (v: boolean) => void; children: ReactNode }) {
  const { naslov, vidljivo, promijeni, children } = props;
  return (
    <div>
      {promijeni ? (
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-zinc-900">
          <input type="checkbox" checked={vidljivo} onChange={(e) => promijeni(e.target.checked)} className="h-4 w-4 accent-zinc-900" />
          {naslov}
        </label>
      ) : (
        <p className="font-semibold text-zinc-900">{naslov}</p>
      )}
      <ul className={`mt-1.5 space-y-1.5 ${promijeni && !vidljivo ? "opacity-40" : ""}`}>{children}</ul>
    </div>
  );
}

export function ZabranaPrikaz({ poUpu }: { poUpu: RedUpu[] }) {
  const [podaci, setPodaci] = useState<Podaci | null>(null);
  const [greska, setGreska] = useState(false);
  const [prikaziZabranu, setPrikaziZabranu] = useState(true);
  const [sporno, setSporno] = useState(true);
  const [cilj, setCilj] = useState<CiljKarte | null>(null);
  const [oznaka, setOznaka] = useState<OznakaKarte | null>(null);
  const [kartica, setKartica] = useState<Kartica | null>(null);
  const [cesticaKlika, setCesticaKlika] = useState<{ kc: string; ko: string } | null>(null);
  const dohvatiCesticu = useRef(dohvacacCestica());
  const zadnjiKlik = useRef(0);
  const [odabraniUpu, setOdabraniUpu] = useState<number | null>(null);
  const [sviUpu, setSviUpu] = useState(false);
  const kljuc = useRef(0);
  const okvirKarte = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dohvati = (u: string) => fetch(u).then((r) => (r.ok ? (r.json() as Promise<FeatureCollection>) : Promise.reject(new Error(u))));
    Promise.all([
      dohvati("/geo/gup-grad/zabrana-2025.geojson"),
      dohvati("/geo/gup-grad/planski-rezim-2025.geojson"),
      dohvati("/geo/gup-grad/zabrana-cestice-2025.geojson"),
      // sporne oznake su dodatak: bez njih karta i dalje radi
      dohvati("/geo/gup-grad/sporne-2025.geojson").catch(() => null),
    ])
      .then(([zabrana, planovi, cestice, sporne]) =>
        setPodaci({
          zabrana,
          planovi,
          cestice,
          sporne,
          slojevi: slojeviIzGeojsona(zabrana, planovi, cestice, sporne ?? undefined),
        }),
      )
      .catch(() => setGreska(true));
  }, []);

  const pomakni = (c: Omit<CiljKarte, "kljuc">) => setCilj({ ...c, kljuc: ++kljuc.current });
  const doKarte = () => {
    if (window.matchMedia("(max-width: 640px)").matches) okvirKarte.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const pokaziTocku = (lng: number, lat: number, podnaslov?: string) => {
    if (!podaci) return;
    const s = stanjeTocke(podaci.slojevi, lng, lat);
    const mjesto = s.rezim === "zabrana" ? mjestoNaPpugu(podaci.slojevi.ppug, lng, lat) : null;
    const ppug = mjesto && {
      ...mjesto,
      razred: s.rezim === "zabrana" && s.cestica ? podaci.slojevi.ppugCestice[`${s.cestica.ko}|${s.cestica.kc}`] : undefined,
    };
    setOdabraniUpu(null);
    setOznaka({ lng, lat, uZabrani: s.rezim === "zabrana" });
    setKartica({ ...karticaStanja(s, ppug), podnaslov });
    // broj čestice pod klikom, za svaku točku; stariji odgovor ne smije prebrisati noviji
    const n = ++zadnjiKlik.current;
    setCesticaKlika(null);
    dohvatiCesticu.current(lng, lat)
      .then((c) => n === zadnjiKlik.current && setCesticaKlika(c))
      .catch(() => {});
  };

  // ---------------------------------------------------------------- tražilica
  const [adrese, setAdrese] = useState<Adrese | null>(null);
  const [upit, setUpit] = useState("");
  const [otvoreno, setOtvoreno] = useState(false);
  const [aktivni, setAktivni] = useState(0);
  const ucitavam = useRef(false);
  const ucitajAdrese = () => {
    if (adrese || ucitavam.current) return;
    ucitavam.current = true;
    fetch("/geo/gup-grad/kucni-brojevi.json")
      .then((r) => r.json() as Promise<SiroveAdrese>)
      .then((a) => setAdrese(pripremiAdrese(a)))
      .catch(() => (ucitavam.current = false));
  };
  const prijedlozi = useMemo(() => (adrese ? trazi(adrese, upit) : []), [adrese, upit]);

  const odaberi = (p: Prijedlog) => {
    setOtvoreno(false);
    setUpit(p.naziv);
    if (!podaci || !adrese) return;
    if (p.vrsta === "adresa") {
      pokaziTocku(p.adresa.lng, p.adresa.lat, `${p.naziv} · ${p.kotar}`);
      pomakni({ tocka: [p.adresa.lng, p.adresa.lat] });
    } else {
      const brojevi = adrese.brojevi.filter((b) => b.ulica === p.ulica);
      const uZabrani = brojevi.filter((b) => stanjeTocke(podaci.slojevi, b.lng, b.lat).rezim === "zabrana").length;
      const okvir = spojiOkvire(brojevi.map((b) => [b.lng, b.lat, b.lng, b.lat]));
      if (okvir) pomakni({ okvir });
      setOznaka(null);
      setOdabraniUpu(null);
      setKartica({
        oznaka: uZabrani === 0 ? "Gradnja je moguća" : uZabrani === brojevi.length ? "Bez UPU-a nema nove gradnje" : "Dijelom pod zabranom",
        boja: uZabrani ? "zabrana" : "zeleno",
        naslov: p.naziv,
        podnaslov: p.kotar,
        tijelo: (
          <p>
            U području zabrane je {broj(uZabrani)} od ukupno {broj(brojevi.length)}{" "}
            {imenicaUz(brojevi.length, ["kućnog broja", "kućna broja", "kućnih brojeva"])} u ovoj ulici.
            {uZabrani > 0 && uZabrani < brojevi.length ? " Upiši i kućni broj ili klikni na kuću na karti." : ""}
          </p>
        ),
      });
    }
    doKarte();
  };

  const odaberiUpu = (r: RedUpu) => {
    if (!podaci) return;
    const okviri = r.broj
      ? podaci.slojevi.propisani.filter((u) => u.broj === r.broj).map((u) => u.okvir)
      : podaci.slojevi.komadi.filter((k) => k.upu === 0).map((k) => k.okvir);
    const okvir = spojiOkvire(okviri);
    if (okvir) pomakni({ okvir });
    setOdabraniUpu(r.broj || null);
    setOznaka(null);
    const dijelovi = [
      r.sanacija_ha && `${ha(r.sanacija_ha)} ha urbane sanacije`,
      r.preobrazba_ha && `${ha(r.preobrazba_ha)} ha urbane preobrazbe`,
      r.neuredeno_ha && `${ha(r.neuredeno_ha)} ha neuređenog građevinskog zemljišta`,
    ].filter(Boolean);
    setKartica({
      oznaka: `Obvezan UPU: ${ha(r.sanacija_ha + r.preobrazba_ha + r.neuredeno_ha)} ha`,
      boja: "zabrana",
      naslov: r.naziv ?? "Područje zabrane izvan ucrtanih obuhvata UPU-a",
      tijelo: (
        <>
          <p>Pod zabranom: {dijelovi.join(", ")}.</p>
          <p className="mt-2">
            Slobodno za novu gradnju: <strong className="text-zinc-900">{ha(r.slobodno_ha)} ha</strong>. Neizgrađenih
            čestica: <strong className="text-zinc-900">{broj(r.neizgradjene)}</strong>.
          </p>
        </>
      ),
    });
    doKarte();
  };

  const redoviUpu = poUpu.filter((r) => r.sanacija_ha + r.preobrazba_ha + r.neuredeno_ha >= 0.05);
  const vidljiviUpu = sviUpu ? redoviUpu : redoviUpu.slice(0, PRVIH_UPU);

  return (
    <div>
      <div className="relative max-w-md">
        <label htmlFor="zabrana-adresa" className="block font-semibold text-zinc-900">
          Provjeri adresu
        </label>
        <input
          id="zabrana-adresa"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="npr. Put Mostina 12"
          role="combobox"
          aria-expanded={otvoreno && upit.trim().length > 0}
          aria-controls="zabrana-prijedlozi"
          aria-autocomplete="list"
          aria-activedescendant={otvoreno && prijedlozi[aktivni] ? `zabrana-p-${aktivni}` : undefined}
          value={upit}
          onFocus={() => {
            ucitajAdrese();
            setOtvoreno(true);
          }}
          onBlur={() => setTimeout(() => setOtvoreno(false), 120)}
          onChange={(e) => {
            ucitajAdrese();
            setUpit(e.target.value);
            setAktivni(0);
            setOtvoreno(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && prijedlozi.length) {
              setAktivni((a) => (a + 1) % prijedlozi.length);
              e.preventDefault();
            } else if (e.key === "ArrowUp" && prijedlozi.length) {
              setAktivni((a) => (a - 1 + prijedlozi.length) % prijedlozi.length);
              e.preventDefault();
            } else if (e.key === "Enter") {
              if (prijedlozi[aktivni]) odaberi(prijedlozi[aktivni]);
              e.preventDefault();
            } else if (e.key === "Escape") setOtvoreno(false);
          }}
          className="fokus mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900"
        />
        {otvoreno && upit.trim().length > 0 && (
          <ul
            id="zabrana-prijedlozi"
            role="listbox"
            className="absolute inset-x-0 top-full z-[1100] mt-1 max-h-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {prijedlozi.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">
                {adrese ? "Te ulice nema u gradskom adresnom registru" : "Adrese se učitavaju…"}
              </li>
            ) : (
              prijedlozi.map((p, i) => (
                <li
                  key={`${p.naziv}-${p.kotar}-${i}`}
                  id={`zabrana-p-${i}`}
                  role="option"
                  aria-selected={i === aktivni}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    odaberi(p);
                  }}
                  className={`flex cursor-pointer justify-between gap-3 px-3 py-2 text-sm ${i === aktivni ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                >
                  <span className="text-zinc-900">{p.naziv}</span>
                  <span className="shrink-0 text-zinc-500">{p.kotar}</span>
                </li>
              ))
            )}
          </ul>
        )}
        <p className="mt-1 text-sm text-zinc-500">Ili klikni bilo gdje na karti.</p>
      </div>

      <div
        ref={okvirKarte}
        className="relative mt-3 h-[65svh] min-h-[380px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:h-[560px]"
      >
        {podaci ? (
          <ZabranaKarta
            zabrana={podaci.zabrana}
            planovi={podaci.planovi}
            cestice={podaci.cestice}
            sporne={podaci.sporne}
            prikaziZabranu={prikaziZabranu}
            sporno={sporno}
            odabraniUpu={odabraniUpu}
            cilj={cilj}
            oznaka={oznaka}
            onKlik={(lng, lat) => pokaziTocku(lng, lat)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            {greska ? "Karta se nije učitala. Osvježi stranicu." : "Karta se učitava…"}
          </div>
        )}
        {kartica && (
          <div
            aria-live="polite"
            className="absolute inset-x-2 bottom-2 z-[1000] max-h-[70%] overflow-y-auto rounded-xl bg-white p-4 text-sm leading-relaxed text-zinc-700 shadow-lg sm:inset-x-auto sm:left-3 sm:w-96"
          >
            <button
              type="button"
              aria-label="Zatvori"
              onClick={() => {
                setKartica(null);
                setOznaka(null);
                setOdabraniUpu(null);
              }}
              className="fokus absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-lg text-zinc-500 hover:bg-zinc-100"
            >
              ×
            </button>
            <Znacka boja={kartica.boja}>{kartica.oznaka}</Znacka>
            <h3 className="mt-2 pr-8 text-base font-bold leading-snug text-zinc-900">{kartica.naslov}</h3>
            {kartica.podnaslov && <p className="font-mono text-xs text-zinc-500">{kartica.podnaslov}</p>}
            {oznaka && cesticaKlika && (
              <p className="font-mono text-xs text-zinc-700">
                k.č. {cesticaKlika.kc}, k.o. {naslovno(cesticaKlika.ko)}
              </p>
            )}
            <div className="mt-2">{kartica.tijelo}</div>
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-4 text-sm text-zinc-700 md:grid-cols-3">
        <Skupina naslov="Nova gradnja tek nakon UPU-a" vidljivo={prikaziZabranu} promijeni={setPrikaziZabranu}>
          {(["sanacija", "preobrazba", "neuredeno"] as const).map((p) => (
            <Stavka key={p} stil={{ background: BOJE_ZABRANE[p], opacity: 0.8 }}>
              {NAZIV_OZNAKE[p]} <span className="text-zinc-500">· {IZVOR_OZNAKE[p]}</span>
            </Stavka>
          ))}
          <Stavka stil={{ border: `1px solid ${BOJE_ZABRANE.cestica}` }}>čestica na kojoj bi zabrana pogodila novu gradnju (izbliza)</Stavka>
        </Skupina>
        {podaci?.sporne && (
          <Skupina naslov="Sporno" vidljivo={sporno} promijeni={setSporno}>
            <Stavka stil={{ background: `repeating-linear-gradient(135deg, ${BOJE_ZABRANE.sporno} 0 1.2px, transparent 1.2px 5px)` }}>
              oznaka ne odgovara kriteriju Grada ili zakonu
            </Stavka>
            <Stavka stil={{ border: `1.5px solid ${BOJE_ZABRANE.sporno}` }}>moguće sporno: uz cestu izvan registra</Stavka>
            <li className="text-zinc-500">Ceste kroz zabranu, izbliza; sredina crte je širina čestice ceste:</li>
            {(
              [
                [BOJE_ZABRANE.cestaSiroka, "barem 4 m"],
                [BOJE_ZABRANE.cestaUska, "uža od 4 m"],
                [BOJE_ZABRANE.cestaNepoznata, "nije izmjerena"],
              ] as const
            ).map(([boja, tekst]) => (
              <Stavka key={tekst} stil={{ height: 9, background: boja, border: `2.5px solid ${BOJE_ZABRANE.cesta}`, borderRadius: 0 }}>
                {tekst}
              </Stavka>
            ))}
          </Skupina>
        )}
        <Skupina naslov="Za snalaženje">
          <Stavka stil={{ background: "rgba(113,113,122,0.35)", border: `1px solid ${BOJE_ZABRANE.vazeci}` }}>
            plan na snazi: gradi se prema njemu
          </Stavka>
          <Stavka stil={{ border: `2px solid ${BOJE_ZABRANE.upu}` }}>obuhvat UPU-a iz prijedloga; izvan boja UPU je samo preporučen</Stavka>
          <Stavka stil={{ height: 2, background: `repeating-linear-gradient(90deg, ${BOJE_ZABRANE.gup} 0 6px, transparent 6px 10px)` }}>
            granica GUP-a
          </Stavka>
        </Skupina>
      </div>

      <h3 className="mt-8 font-bold text-zinc-900">Po planovima koji još nisu doneseni</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Za svaki plan: slobodno zemljište za novu gradnju (ha) i broj neizgrađenih čestica na kojima se do njegova donošenja ne bi smjelo graditi. Klikom na redak
        obuhvat plana prikazuje se na karti.
      </p>
      <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        <li className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
          <span>Plan</span>
          <span className="w-16 text-right">ha</span>
          <span className="w-16 text-right">čestice</span>
        </li>
        {vidljiviUpu.map((r) => {
          return (
            <li key={r.broj}>
              <button
                type="button"
                onClick={() => odaberiUpu(r)}
                aria-pressed={kartica !== null && odabraniUpu === (r.broj || null) && r.broj !== 0}
                className="fokus grid w-full grid-cols-[1fr_auto_auto] items-baseline gap-4 px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span className="text-zinc-900">{r.naziv ?? "Bez ucrtanog obuhvata UPU-a"}</span>
                <span className="w-16 text-right font-mono tabular-nums text-red-700">{ha(r.slobodno_ha)}</span>
                <span className="w-16 text-right font-mono tabular-nums text-zinc-600">{broj(r.neizgradjene)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {redoviUpu.length > PRVIH_UPU && (
        <button
          type="button"
          onClick={() => setSviUpu((v) => !v)}
          aria-expanded={sviUpu}
          className="fokus mt-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-zinc-100"
        >
          {sviUpu ? "Prikaži manje" : `Prikaži sve (${redoviUpu.length})`}
        </button>
      )}
    </div>
  );
}
