"use client";

/**
 * /gup/zabrana: tražilica adrese, karta i popis po UPU-u.
 *
 * Podatke karte (zabrana-2025.geojson i planski-rezim-2025.geojson) učita
 * jednom i iz njih računa stanje svake točke (stanjeTocke); karta
 * (zabrana-karta.tsx) samo crta i javlja klik, a učitava se bez SSR-a.
 * Kućni brojevi (~0,5 MB) stižu tek kad se krene tipkati adresa.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { FeatureCollection } from "geojson";

import { Navod } from "@/components/gup-dokument/navod";
import type { CiljKarte, OznakaKarte } from "@/components/gup-grad/zabrana-karta";
import type { RedUpu } from "@/lib/gup-grad/zabrana-podaci";
import {
  BLIZU_RUBA_M,
  BOJE_ZABRANE,
  imenicaUz,
  NAZIV_PODRUCJA,
  naslovno,
  pripremiAdrese,
  slojeviIzGeojsona,
  spojiOkvire,
  stanjeTocke,
  trazi,
  type Adrese,
  type Prijedlog,
  type SiroveAdrese,
  type Slojevi,
  type Stanje,
} from "@/lib/gup-grad/zabrana";

const ZabranaKarta = dynamic(() => import("@/components/gup-grad/zabrana-karta").then((m) => m.ZabranaKarta), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

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
  slojevi: Slojevi;
}

type Kartica = { oznaka: string; boja: "crveno" | "sivo" | "zeleno"; naslov: string; podnaslov?: string; tijelo: ReactNode };

function Znacka({ boja, children }: { boja: Kartica["boja"]; children: ReactNode }) {
  const klasa = {
    crveno: "bg-red-700 text-white",
    sivo: "bg-zinc-200 text-zinc-800",
    zeleno: "bg-emerald-100 text-emerald-900",
  }[boja];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${klasa}`}>{children}</span>;
}

function karticaStanja(s: Stanje): Kartica {
  const rub =
    s.rezim !== "izvan" && s.doRuba < BLIZU_RUBA_M ? (
      <p className="mt-2 rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-800">
        Ovo je mjesto oko {Math.max(1, Math.round(s.doRuba))} m od ruba crvenog područja. Karta je precrtana sa
        skeniranog lista, pa za česticu uz rub provjeri <Navod id="list-planske-mjere-2025">list 4.d</Navod>.
      </p>
    ) : null;
  switch (s.rezim) {
    case "zabrana":
      return {
        oznaka: "Bez UPU-a nema nove gradnje",
        boja: "crveno",
        naslov: s.upu ? `Potreban je ${s.upu.naziv}` : "Potreban je UPU",
        tijelo: (
          <>
            {s.cestica && (
              <p className="mb-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-red-950">
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
            <p>
              Ovo je {NAZIV_PODRUCJA[s.podrucje]}. Prema prijedlogu (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>)
              ovdje se do donošenja {s.upu ? "tog plana" : "UPU-a"} ne bi mogla ishoditi dozvola za novu zgradu.
              {s.upu ? "" : " Na listu 4.d ovdje nije ucrtan obuhvat nijednog propisanog UPU-a."}
            </p>
            <p className="mt-2">
              I dalje su dopuštene rekonstrukcija postojeće zgrade i njezina zamjena na istoj čestici (Zakon o prostornom
              uređenju, čl. 106. st. 3.) te gradnja ulica, manjih infrastrukturnih građevina i javnih zgrada (
              <Navod id="do-plana-2025">čl. 105. st. 5.</Navod>).
            </p>
            {rub}
          </>
        ),
      };
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

export function ZabranaPrikaz({ poUpu }: { poUpu: RedUpu[] }) {
  const [podaci, setPodaci] = useState<Podaci | null>(null);
  const [greska, setGreska] = useState(false);
  const [crveno, setCrveno] = useState(true);
  const [cilj, setCilj] = useState<CiljKarte | null>(null);
  const [oznaka, setOznaka] = useState<OznakaKarte | null>(null);
  const [kartica, setKartica] = useState<Kartica | null>(null);
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
    ])
      .then(([zabrana, planovi, cestice]) =>
        setPodaci({ zabrana, planovi, cestice, slojevi: slojeviIzGeojsona(zabrana, planovi, cestice) }),
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
    setOdabraniUpu(null);
    setOznaka({ lng, lat, crveno: s.rezim === "zabrana" });
    setKartica({ ...karticaStanja(s), podnaslov });
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
      const uCrvenom = brojevi.filter((b) => stanjeTocke(podaci.slojevi, b.lng, b.lat).rezim === "zabrana").length;
      const okvir = spojiOkvire(brojevi.map((b) => [b.lng, b.lat, b.lng, b.lat]));
      if (okvir) pomakni({ okvir });
      setOznaka(null);
      setOdabraniUpu(null);
      setKartica({
        oznaka: uCrvenom === 0 ? "Gradnja je moguća" : uCrvenom === brojevi.length ? "Bez UPU-a nema nove gradnje" : "Dijelom u crvenom",
        boja: uCrvenom ? "crveno" : "zeleno",
        naslov: p.naziv,
        podnaslov: p.kotar,
        tijelo: (
          <p>
            U crvenom je području {broj(uCrvenom)} od ukupno {broj(brojevi.length)}{" "}
            {imenicaUz(brojevi.length, ["kućnog broja", "kućna broja", "kućnih brojeva"])} u ovoj ulici.
            {uCrvenom > 0 && uCrvenom < brojevi.length ? " Upiši i kućni broj ili klikni na kuću na karti." : ""}
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
      boja: "crveno",
      naslov: r.naziv ?? "Crveno područje izvan ucrtanih obuhvata UPU-a",
      tijelo: (
        <>
          <p>U crvenom: {dijelovi.join(", ")}.</p>
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
            crveno={crveno}
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
            <div className="mt-2">{kartica.tijelo}</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-700">
        <span className="flex items-center gap-2">
          <Uzorak stil={{ background: "rgba(220,38,38,0.45)", border: `2px solid ${BOJE_ZABRANE.crvenoRub}` }} />
          bez UPU-a nema nove gradnje
        </span>
        <span className="flex items-center gap-2">
          <Uzorak stil={{ background: "rgba(127,29,29,0.6)", border: `1px solid ${BOJE_ZABRANE.cesticaRub}` }} />
          neizgrađena čestica
        </span>
        <span className="flex items-center gap-2">
          <Uzorak stil={{ background: "rgba(220,38,38,0.45)", border: `1.5px dashed ${BOJE_ZABRANE.cesticaRub}` }} />
          slobodni dio izgrađene čestice
        </span>
        <span className="flex items-center gap-2">
          <Uzorak stil={{ background: "rgba(82,82,92,0.12)", border: `1.5px dashed ${BOJE_ZABRANE.vazeci}` }} />
          važeći plan (gradi se prema njemu)
        </span>
        <span className="flex items-center gap-2">
          <Uzorak stil={{ border: `2px solid ${BOJE_ZABRANE.upu}` }} />
          obuhvat propisanog UPU-a
        </span>
        <span className="flex items-center gap-2">
          <Uzorak stil={{ border: `2px dashed ${BOJE_ZABRANE.gup}` }} />
          granica obuhvata GUP-a
        </span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={crveno} onChange={(e) => setCrveno(e.target.checked)} className="h-4 w-4 accent-red-700" />
          prikaži crvena područja
        </label>
      </div>

      <p className="mt-2 text-sm text-zinc-500">Čestice se na karti vide pri većem povećanju.</p>

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
