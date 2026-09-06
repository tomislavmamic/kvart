"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";

import { Kotacic } from "@/components/karepovac/kotacic";
import { prijaviMiris } from "@/lib/actions/public";
import { ODOUR_STRENGTHS, ODOUR_STRENGTH_SHORT } from "@/lib/constants";
import type { OdourStrength } from "@/lib/constants";
import { JOS_TRAJE, TRAJANJA } from "@/lib/dojava-trajanje";
import {
  dvoznamenkasto,
  KORAK_MINUTA,
  minuteZaSat,
  odabirIzTrenutka,
  satiZaDan,
  satZaSimulator,
  uRasponu,
  uTrenutak,
  type OdabirVremena,
} from "@/lib/dojava-vrijeme";
import {
  oznakaDojavitelja,
  postojecaOznaka,
  zaboraviDojavitelja,
} from "@/lib/dojavitelj";
import { OPIS_OKVIRA, uOkviru, zaokruziMjesto } from "@/lib/mjesto";

import { mojeDojave, type MojaDojava } from "./moje";

/**
 * Obrazac je pisan za mobitel u ruci, na ulici, u mraku — i za jedan zaslon.
 *
 * Duljina je ovdje osobina, ne posljedica. Dojava se ispunjava u trenutku u
 * kojem netko stoji vani i osjeti miris; ako obrazac traži klizanje, dio
 * ljudi odustane na pola, a odustali dojavitelj nije podatak. Cilj je da
 * „Pošalji dojavu” stoji na zaslonu od 390 × 712 px bez klizanja, i to na
 * putu „smrdjelo je”.
 *
 * Odatle izbori koje treba znati prije mijenjanja:
 *
 * - **Vrijeme i trajanje su sklopljeni u jedan red.** Dva gumba, „Danas
 *   23.50” i „Ne znam”, otvaraju kotačiće tek na dodir. Tko javlja *sada* —
 *   a to je većina — ne dira ništa; tko javlja za jučer navečer, dodirne
 *   jednom i dobije kotačić kao na budilici (`Kotacic`). Prije su tri
 *   kotačića stajala otvorena i gurala gumb 185 px ispod ruba zaslona.
 * - **Dan je u kotačiću sata, ne zaseban.** Sati idu „jučer 00 … jučer 23,
 *   danas 00 … danas [sada]”: ponoć je jedan korak, a kotačić za dan sa
 *   samo dvije vrijednosti trošio je 180 px.
 * - **Minuta nije sitničarenje.** Epizoda koja počne u 14.50 i traje petnaest
 *   minuta prelazi u sljedeći sat, pa je nosi vjetar obaju sati.
 * - **Nema biranja datuma.** Miris se javlja dok se pamti — danas ili jučer.
 *   Sat iz poveznice (`?sat=`, sa simulatora) prima se ako je danas ili
 *   jučer; stariji se ne da izabrati, pa obrazac to i kaže.
 * - **Pita se trajanje, ne sat u kojem je prestalo.** Epizode su često
 *   kratke — petnaestak minuta — a nitko ne pamti u kojem je satu točno
 *   prestalo. „Do 15 minuta” je odgovor koji čovjek doista ima. Isto pitanje
 *   dobiva i „nije smrdjelo”, kao „koliko ste bili vani” — večer bez mirisa
 *   je nekoliko sati tišine, ne jedan.
 * - **Jačina nije unaprijed odabrana.** Jačina je mjerenje; „osjetno” koje
 *   nitko nije dodirnuo ulazilo je u ružu s težinom 1,7 i nitko poslije nije
 *   mogao razlučiti odabrano od zadanog. Bez odabira obrazac ne ide dalje.
 * - **Sat se pokazuje tek poslije montiranja.** Poslužitelj na Vercelu živi
 *   u UTC-u; da se vrijeme ispisuje pri prikazu, HTML bi nosio dva sata
 *   manje nego što preglednik vidi, a React bi to hidratacijom prepisivao
 *   pri svakom dolasku. Stanje se računa u pregledniku (početne vrijednosti
 *   `useState`), a ispisuje se tek kad `montirano` kaže da hidratacije više
 *   nema; dotad gumb kaže „Sada”, što je i istina.
 * - **Poslije slanja dojava ne nestaje.** Brojke ispod se osvježe
 *   (`router.refresh`), kartica nudi sat na simulatoru i drugu dojavu — i
 *   onu „nije smrdjelo”, koja ruži najviše nedostaje — a ispod stoji što je
 *   ovaj preglednik dosad poslao i je li dobilo vjetar.
 * - **Svaka skupina ima vidljiv natpis.** Kotačić bez natpisa je zagonetka:
 *   vrijednosti se vide, ali ne i pitanje na koje odgovaraju.
 */

/** Koliko dana unatrag obrazac dopušta; poslužitelj drži isto ograničenje. */
const DANA_UNATRAG = 30;

/** Nakon koliko se uz „Tražim…” kaže da smije potrajati. */
const DUGO_TRAZIM_MS = 3000;

type StanjeMjesta =
  | { vrsta: "nema" }
  | { vrsta: "trazim" }
  | { vrsta: "imam"; lat: number; lng: number }
  | { vrsta: "odbijeno" }
  | { vrsta: "izvan" };

/** Veliki gumb-izbor; prst, ne miš. */
const IZBOR =
  "fokus-unutar flex min-h-12 cursor-pointer items-center justify-center "
  + "rounded-xl border border-kamen-rub bg-white px-3 text-center text-base "
  + "font-semibold text-kamen-tinta hover:bg-kamen-plitko "
  + "has-checked:border-maslina has-checked:bg-maslina-vez "
  + "has-checked:text-maslina-noc";

/** Gumb koji otvara kotačić; izgleda kao polje, jer to i jest. */
const SKLOPLJENO =
  "fokus flex min-h-12 w-full items-center justify-between gap-2 rounded-xl "
  + "border border-kamen-rub bg-white px-3 text-left text-base font-semibold "
  + "text-kamen-tinta hover:bg-kamen-plitko aria-expanded:border-maslina";

/** Natpis skupine; govori na koje pitanje polja ispod odgovaraju. */
const NATPIS = "block text-base font-bold text-kamen-tinta";

/** Sporedni gumb u kartici poslije slanja. */
const GUMB_KARTICE =
  "fokus flex min-h-12 w-full items-center justify-center rounded-xl border "
  + "border-maslina px-3 text-center font-semibold text-maslina-tamna hover:bg-white";

/**
 * Mjesto s kojim obrazac počinje, npr. točka na koju je netko kliknuo u
 * simulatoru (`/karepovac/dojava?lat=…&lng=…`). Zaokružuje se i provjerava
 * kao i mjesto s uređaja; izvan okvira se ne uzima, da adresa ne podmetne
 * mjesto koje obrazac ne bi prihvatio.
 */
export type PocetnoMjesto = { readonly lat: number; readonly lng: number } | null;

/** Što je zadnje poslano; kartica poslije slanja govori o tome. */
type Poslano = {
  pocetak: Date;
  smrdi: boolean;
  mjesto: { lat: number; lng: number } | null;
  /** Dojava pada u sat koji u trenutku slanja još nije završio. */
  satTraje: boolean;
};

/** Prazna pretplata: `useSyncExternalStore` bez vanjskog izvora. */
function nista() {
  return () => {};
}

/** Je li komponenta montirana — laž pri prikazu na poslužitelju i hidrataciji. */
function useMontirano(): boolean {
  return useSyncExternalStore(nista, () => true, () => false);
}

/** Početno vrijeme: iz poveznice ako je danas ili jučer, inače sada. */
function pocetnoVrijeme(pocetniSat: number | null, sada: Date) {
  const izPoveznice = pocetniSat === null ? null : odabirIzTrenutka(pocetniSat, sada);
  return {
    vrijeme: izPoveznice ?? sadaNaKotacicu(sada),
    // Sat iz poveznice se pokazuje u zatvorenom retku, ne u otvorenom
    // kotačiću: otvoren je gurao „Pošalji” 120 px ispod ruba telefona baš
    // na ulazu sa simulatora. Da je uzet, vidi se iz samog retka.
    otvoreno: false,
    dirnuto: izPoveznice !== null,
    napomena:
      pocetniSat !== null && izPoveznice === null
        ? "Sat iz poveznice stariji je od jučer, pa ga obrazac ne nudi — ostalo je na sada."
        : null,
  };
}

/** Trenutačni sat i minuta, na pet. */
function sadaNaKotacicu(sada: Date): OdabirVremena {
  return {
    danas: true,
    sat: sada.getHours(),
    minuta: Math.floor(sada.getMinutes() / KORAK_MINUTA) * KORAK_MINUTA,
  };
}

/** Adresa sata na simulatoru, s točkom ako je ima (`?t=lat,lng`, kao ondje). */
function adresaSimulatora(poslano: Poslano): string {
  const sat = `/karepovac/sim?sat=${encodeURIComponent(satZaSimulator(poslano.pocetak))}`;
  return poslano.mjesto ? `${sat}&t=${poslano.mjesto.lat},${poslano.mjesto.lng}` : sat;
}

export function ObrazacDojave({
  pocetnoMjesto = null,
  pocetniSat = null,
  pocetnoSmrdi = true,
}: {
  pocetnoMjesto?: PocetnoMjesto;
  /** Sat iz poveznice (`?sat=`), u milisekundama; prima se ako je danas ili jučer. */
  pocetniSat?: number | null;
  /** `?smrdi=ne` otvara obrazac na „nije smrdjelo”. */
  pocetnoSmrdi?: boolean;
} = {}) {
  const router = useRouter();
  const [osvjezavam, osvjezi] = useTransition();
  const montirano = useMontirano();

  const [smrdi, setSmrdi] = useState(pocetnoSmrdi);
  const [jacina, setJacina] = useState<OdourStrength | null>(null);
  // Sat preglednika; ispisuje se tek kad je `montirano` — vidi zaglavlje.
  const [sada, setSada] = useState(() => new Date());
  const [pocetno] = useState(() => pocetnoVrijeme(pocetniSat, sada));
  const [vrijeme, setVrijeme] = useState<OdabirVremena>(pocetno.vrijeme);
  const [vrijemeOtvoreno, setVrijemeOtvoreno] = useState(pocetno.otvoreno);
  /** Je li dojavitelj (ili poveznica) dirao vrijeme; nedirano se prati sa satom. */
  const dirnuto = useRef(pocetno.dirnuto);
  const napomenaSata = pocetno.napomena;
  const [trajanje, setTrajanje] = useState<number | typeof JOS_TRAJE | "">("");
  const [trajanjeOtvoreno, setTrajanjeOtvoreno] = useState(false);
  const [mjesto, setMjesto] = useState<StanjeMjesta>(() =>
    pocetnoMjesto && uOkviru(pocetnoMjesto)
      ? { vrsta: "imam", ...zaokruziMjesto(pocetnoMjesto) }
      : { vrsta: "nema" },
  );
  const [dugoTrazim, setDugoTrazim] = useState(false);
  const [zaboravljen, setZaboravljen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Greška odabira jačine stoji uz pločice, ne uz gumb, da gumb ne pobjegne ispod ruba. */
  const [greskaJacine, setGreskaJacine] = useState<string | null>(null);
  const [poslano, setPoslano] = useState<Poslano | null>(null);
  const [poslanih, setPoslanih] = useState(0);
  const [pending, setPending] = useState(false);
  const naslovKartice = useRef<HTMLHeadingElement>(null);

  // Kartica koja se vrati u prvi plan: nedirano vrijeme prati sat, inače bi
  // „sada” značilo trenutak kad je stranica otvorena. Isto radi i `posalji`
  // — tko nije dirao vrijeme, javlja za trenutak slanja, ne otvaranja.
  useEffect(() => {
    function osvjeziSada() {
      if (document.visibilityState !== "visible" || dirnuto.current) return;
      const s = new Date();
      setSada(s);
      setVrijeme(sadaNaKotacicu(s));
    }
    document.addEventListener("visibilitychange", osvjeziSada);
    return () => document.removeEventListener("visibilitychange", osvjeziSada);
  }, []);

  // Žarište na naslov kartice poslije slanja, da čitač zaslona kaže što se
  // dogodilo; `aria-live` na kartici pokriva i ostalo.
  useEffect(() => {
    if (poslano) naslovKartice.current?.focus();
  }, [poslano]);

  const satiKotacica = [
    ...satiZaDan(false, sada).map((i) => ({ vrijednost: i - 24, natpis: `jučer ${dvoznamenkasto(i)}` })),
    ...satiZaDan(true, sada).map((i) => ({ vrijednost: i, natpis: `danas ${dvoznamenkasto(i)}` })),
  ];
  const minuteKotacica = minuteZaSat(vrijeme.danas, vrijeme.sat, sada).map((m) => ({
    vrijednost: m,
    natpis: dvoznamenkasto(m),
  }));
  const trajanjaKotacica = smrdi
    ? TRAJANJA
    : // Tišina koja „još traje” nije opažanje nego prognoza.
      TRAJANJA.filter((t) => t.vrijednost !== JOS_TRAJE);

  /** Odabir dana ili sata ne smije ostaviti minutu koja još nije došla. */
  function promijeniSat(vrijednost: number) {
    dirnuto.current = true;
    const s = sada;
    const noviDanas = vrijednost >= 0;
    const noviSat = noviDanas ? vrijednost : vrijednost + 24;
    const stegnutiSat = noviDanas && noviSat > s.getHours() ? s.getHours() : noviSat;
    const moguce = minuteZaSat(noviDanas, stegnutiSat, s);
    setVrijeme((v) => ({
      danas: noviDanas,
      sat: stegnutiSat,
      minuta: moguce.includes(v.minuta) ? v.minuta : (moguce[moguce.length - 1] ?? 0),
    }));
  }

  function promijeniMinutu(minuta: number) {
    dirnuto.current = true;
    setVrijeme((v) => ({ ...v, minuta }));
  }

  function trazimMjesto() {
    if (!navigator.geolocation) {
      setMjesto({ vrsta: "odbijeno" });
      return;
    }
    setMjesto({ vrsta: "trazim" });
    setDugoTrazim(false);
    const strpljenje = setTimeout(() => setDugoTrazim(true), DUGO_TRAZIM_MS);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(strpljenje);
        setDugoTrazim(false);
        const tocka = { lat: coords.latitude, lng: coords.longitude };
        if (!uOkviru(tocka)) {
          setMjesto({ vrsta: "izvan" });
          return;
        }
        // Zaokružuje se odmah, prije nego što išta ode s uređaja.
        setMjesto({ vrsta: "imam", ...zaokruziMjesto(tocka) });
      },
      () => {
        clearTimeout(strpljenje);
        setDugoTrazim(false);
        setMjesto({ vrsta: "odbijeno" });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function posalji(formData: FormData) {
    setError(null);
    setGreskaJacine(null);
    if (smrdi && !jacina) {
      setGreskaJacine("Odaberite koliko je jako smrdjelo — jedno od četvero.");
      return;
    }
    setPending(true);
    // Nedirano vrijeme znači „sada” — u trenutku slanja, ne otvaranja stranice.
    const trenutak = dirnuto.current ? sada : new Date();
    const odabir = dirnuto.current ? vrijeme : sadaNaKotacicu(trenutak);
    if (!dirnuto.current) {
      setSada(trenutak);
      setVrijeme(odabir);
    }
    const pocetak = uTrenutak(odabir.danas, odabir.sat, odabir.minuta, trenutak);
    if (!uRasponu(pocetak, DANA_UNATRAG)) {
      setPending(false);
      setError("Javiti se može za zadnjih trideset dana.");
      return;
    }
    formData.set("kada", pocetak.toISOString());
    formData.set("smelled", smrdi ? "da" : "ne");
    if (smrdi && jacina) formData.set("strength", jacina);
    formData.delete("doKada");
    if (typeof trajanje === "number") {
      formData.set("trajanjeMin", String(trajanje));
    } else {
      formData.delete("trajanjeMin");
    }
    formData.set("ongoing", smrdi && trajanje === JOS_TRAJE ? "1" : "0");
    const moja = oznakaDojavitelja();
    if (moja) formData.set("reporterId", moja);
    const tocka = mjesto.vrsta === "imam" ? { lat: mjesto.lat, lng: mjesto.lng } : null;
    if (tocka) {
      formData.set("lat", String(tocka.lat));
      formData.set("lng", String(tocka.lng));
    }
    const rezultat = await prijaviMiris(formData);
    setPending(false);
    if (!rezultat.ok) {
      setError(rezultat.error);
      return;
    }
    setPoslano({
      pocetak,
      smrdi,
      mjesto: tocka,
      // Arhiva sat spaja tek kad završi (`vjetarIzArhive`); kartica to kaže.
      satTraje: Math.floor(pocetak.getTime() / 3_600_000) >= Math.floor(trenutak.getTime() / 3_600_000),
    });
    setPoslanih((n) => n + 1);
    // Stranica je dinamična: osvježavanje ponovno čita dojave i vjetar, pa
    // se „dosad javljeno” ispod pomakne za ovu dojavu.
    osvjezi(() => router.refresh());
  }

  /** Nova dojava od sada, za drugi ishod: „javi i kad prestane”. */
  function javiPonovno(noviSmrdi: boolean) {
    const s = new Date();
    setSada(s);
    setVrijeme(sadaNaKotacicu(s));
    dirnuto.current = false;
    setSmrdi(noviSmrdi);
    setJacina(null);
    setTrajanje("");
    setVrijemeOtvoreno(false);
    setTrajanjeOtvoreno(false);
    setPoslano(null);
    setError(null);
  }

  const natpisVremena = montirano
    ? `${vrijeme.danas ? "Danas" : "Jučer"} ${dvoznamenkasto(vrijeme.sat)}.${dvoznamenkasto(vrijeme.minuta)}`
    : "Sada";
  const natpisTrajanja =
    TRAJANJA.find((t) => t.vrijednost === trajanje)?.natpis ?? "Ne znam";

  return (
    <>
      {poslano ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-maslina-rub bg-maslina-vez p-5 text-maslina-noc"
        >
          <h2 ref={naslovKartice} tabIndex={-1} className="fokus rounded text-xl font-bold">
            Zabilježeno. Hvala.
          </h2>
          <p className="mt-2 text-base leading-7">
            {poslano.smrdi
              ? "Dojava je spremljena. Izmjereni vjetar za taj sat spajamo iz arhive postaja; za tekući sat stigne s otprilike sat vremena zakašnjenja."
              : "I sat bez mirisa se broji — bez njega se ne zna koliko je često smrdjelo, ni koliko je puta model uzbunio uzalud."}
          </p>
          {poslano.satTraje && (
            <p className="mt-2 text-base leading-7">
              Sat koji još traje dobiva vjetar kad završi.
            </p>
          )}
          <p className="mt-2 text-base leading-7">
            {osvjezavam
              ? "Osvježavam brojke ispod…"
              : "Brojke ispod uključuju i ovu dojavu — vjetar za njezin sat vidite u Vašim dojavama."}
          </p>
          <p className="mt-3 text-base leading-7">
            <Link
              href={adresaSimulatora(poslano)}
              className="fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
            >
              Pogledaj što je model tvrdio za taj sat
              {poslano.mjesto ? " na tom mjestu" : ""} →
            </Link>
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => javiPonovno(!poslano.smrdi)} className={GUMB_KARTICE}>
              {poslano.smrdi ? "Javi i kad prestane" : "Javi kad zasmrdi"}
            </button>
            <button type="button" onClick={() => javiPonovno(poslano.smrdi)} className={GUMB_KARTICE}>
              Javi drugi sat
            </button>
          </div>
          {poslano.smrdi && (
            <p className="mt-3 text-base leading-6">
              Dojava „nije smrdjelo” — kad prestane, ili sutra u isto doba —
              ruži i provjeri modela najviše nedostaje.
            </p>
          )}
        </div>
      ) : (
        <form action={posalji} className="space-y-3">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          <fieldset>
            <legend className="sr-only">Je li se osjetio miris</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { kljuc: true, natpis: "Smrdjelo je" },
                { kljuc: false, natpis: "Nije smrdjelo" },
              ].map((izbor) => (
                <label key={String(izbor.kljuc)} className={IZBOR}>
                  <input
                    type="radio"
                    name="smrdi-izbor"
                    checked={smrdi === izbor.kljuc}
                    onChange={() => {
                      setSmrdi(izbor.kljuc);
                      if (!izbor.kljuc && trajanje === JOS_TRAJE) setTrajanje("");
                    }}
                    className="sr-only"
                  />
                  {izbor.natpis}
                </label>
              ))}
            </div>
            {!smrdi && (
              <p className="mt-2 text-base leading-6 text-kamen-drugi">
                Hvala — sati bez mirisa su ono što ruži najviše nedostaje.
              </p>
            )}
          </fieldset>

          {smrdi && (
            <fieldset>
              <legend className={NATPIS}>Koliko jako?</legend>
              {/* Dva po dva, ne četiri u redu: „nepodnošljivo” u redu od četiri
                  traži sitna slova, a stranicu čitaju i oči kojima sitno ne ide. */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(ODOUR_STRENGTHS).map(([kljuc]) => (
                  <label key={kljuc} className={IZBOR}>
                    <input
                      type="radio"
                      name="strength"
                      value={kljuc}
                      checked={jacina === kljuc}
                      onChange={() => {
                        setJacina(kljuc as OdourStrength);
                        setGreskaJacine(null);
                      }}
                      className="sr-only"
                    />
                    {ODOUR_STRENGTH_SHORT[kljuc as OdourStrength]}
                  </label>
                ))}
              </div>
              {/* Puna rečenica odabrane jačine: na mobitelu nema pokazivača, pa
                  opis mora stajati na zaslonu, a ne u `title`. Dok ništa nije
                  odabrano, redak kaže da odabir treba — jačina se ne pretpostavlja. */}
              {greskaJacine ? (
                <p role="alert" className="mt-2 text-base leading-6 font-semibold text-odbijeno-tamna">
                  {greskaJacine}
                </p>
              ) : (
                <p className="mt-2 text-base leading-6 text-kamen-drugi" aria-live="polite">
                  {jacina ? ODOUR_STRENGTHS[jacina] : "Odaberite jednu od četiri jačine."}
                </p>
              )}
            </fieldset>
          )}

          <div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span id="natpis-kada" className={NATPIS}>
                  {smrdi ? "Kada je počelo?" : "Kada?"}
                </span>
                <button
                  type="button"
                  aria-labelledby="natpis-kada natpis-vremena"
                  aria-expanded={vrijemeOtvoreno}
                  aria-controls="kotacici-vremena"
                  onClick={() => setVrijemeOtvoreno((o) => !o)}
                  className={`${SKLOPLJENO} mt-2`}
                >
                  <span id="natpis-vremena" className="tabular-nums">{natpisVremena}</span>
                  <span aria-hidden="true" className="text-kamen-drugi">{vrijemeOtvoreno ? "▴" : "▾"}</span>
                </button>
              </div>
              <div>
                <span id="natpis-trajanja" className={NATPIS}>
                  {smrdi ? "Koliko je trajalo?" : "Koliko ste bili vani?"}
                </span>
                <button
                  type="button"
                  aria-labelledby="natpis-trajanja natpis-trajanja-vrijednost"
                  aria-expanded={trajanjeOtvoreno}
                  aria-controls="kotacic-trajanja"
                  onClick={() => setTrajanjeOtvoreno((o) => !o)}
                  className={`${SKLOPLJENO} mt-2`}
                >
                  <span id="natpis-trajanja-vrijednost">{natpisTrajanja}</span>
                  <span aria-hidden="true" className="text-kamen-drugi">{trajanjeOtvoreno ? "▴" : "▾"}</span>
                </button>
              </div>
            </div>
            {napomenaSata && (
              <p className="mt-2 text-base leading-6 text-kamen-drugi">{napomenaSata}</p>
            )}
            {vrijemeOtvoreno && montirano && (
              // Sat i minuta — dva kotačića kao na budilici; dan je u satu.
              <div
                id="kotacici-vremena"
                className="mt-2 grid grid-cols-[1.5fr_1fr] gap-1 rounded-xl border border-kamen-rub bg-white px-2 py-1"
              >
                <Kotacic
                  stavke={satiKotacica}
                  vrijednost={vrijeme.danas ? vrijeme.sat : vrijeme.sat - 24}
                  promijeni={promijeniSat}
                  naslov="Dan i sat"
                />
                <Kotacic
                  stavke={minuteKotacica}
                  vrijednost={vrijeme.minuta}
                  promijeni={promijeniMinutu}
                  naslov="Minuta"
                />
              </div>
            )}
            {trajanjeOtvoreno && (
              <div
                id="kotacic-trajanja"
                className="mt-2 rounded-xl border border-kamen-rub bg-white px-2 py-1"
              >
                <Kotacic
                  stavke={trajanjaKotacica}
                  vrijednost={trajanje}
                  promijeni={setTrajanje}
                  naslov="Trajanje"
                />
              </div>
            )}
          </div>

          <div>
            <span className={NATPIS}>Gdje ste bili?</span>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
              {mjesto.vrsta === "imam" ? (
                // Kratak natpis namjerno: na zaslonu od 320 px duži gumb pojede
                // polje za adresu. Što je zabilježeno piše u retku ispod.
                <button
                  type="button"
                  onClick={() => setMjesto({ vrsta: "nema" })}
                  aria-label="Ukloni zabilježenu lokaciju"
                  className="fokus flex min-h-12 items-center justify-center rounded-xl border border-maslina bg-maslina-vez px-4 text-base font-semibold text-maslina-noc"
                >
                  Ukloni
                </button>
              ) : (
                <button
                  type="button"
                  onClick={trazimMjesto}
                  disabled={mjesto.vrsta === "trazim"}
                  className="fokus flex min-h-12 items-center justify-center rounded-xl border border-kamen-rub bg-white px-4 text-base font-semibold text-kamen-tinta hover:bg-kamen-plitko disabled:opacity-60"
                >
                  {mjesto.vrsta === "trazim" ? "Tražim…" : "Uzmi lokaciju"}
                </button>
              )}
              <input
                type="text"
                name="place"
                maxLength={120}
                autoComplete="street-address"
                aria-label="Najbliža adresa"
                placeholder="Najbliža adresa"
                // `min-w-0` drži polje u rešetki: bez toga ga vlastiti najmanji
                // sadržaj gurne preko ruba na uskom zaslonu.
                className="fokus block min-h-12 w-full min-w-0 rounded-xl border border-kamen-rub bg-white px-4 text-base text-kamen-tinta placeholder:text-kamen-drugi"
              />
            </div>
            <div aria-live="polite">
              {mjesto.vrsta === "trazim" && dugoTrazim && (
                <p className="mt-2 text-base leading-6 text-kamen-drugi">
                  Ovo može potrajati — možete i samo upisati adresu.
                </p>
              )}
              {mjesto.vrsta === "imam" && (
                <p className="mt-2 text-base leading-6 text-kamen-drugi">
                  Lokacija je zabilježena, zaokružena na stotinjak metara još u
                  vašem pregledniku.
                </p>
              )}
              {mjesto.vrsta === "odbijeno" && (
                <p className="mt-2 text-base leading-6 text-kamen-drugi">
                  Preglednik nije dao lokaciju. Upišite najbližu adresu — i to je
                  dovoljno.
                </p>
              )}
              {mjesto.vrsta === "izvan" && (
                <p className="mt-2 text-base leading-6 text-kamen-drugi">
                  Lokacija je izvan okvira koji bilježimo ({OPIS_OKVIRA}), pa
                  je ne spremamo. Adresa ostaje.
                </p>
              )}
            </div>
          </div>

          <div aria-live="assertive">
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-odbijeno bg-rose-50 px-4 py-3 text-base leading-7 text-odbijeno-tamna"
              >
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="fokus flex min-h-14 w-full items-center justify-center rounded-full bg-maslina text-lg font-semibold text-white transition-colors hover:bg-maslina-tamna disabled:opacity-60"
          >
            {pending ? "Šaljem…" : "Pošalji dojavu"}
          </button>

          <p className="text-base leading-6 text-kamen-drugi">
            Ne tražimo ni ime ni kontakt. Preglednik pamti nasumičan broj, da se
            dvije vaše dojave u istom satu ne broje kao dvoje ljudi.{" "}
            {zaboravljen ? (
              <span className="font-semibold text-maslina-tamna">
                Obrisano. Sljedeća dojava kreće kao nova.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  zaboraviDojavitelja();
                  setZaboravljen(true);
                }}
                className="fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina-tamna underline underline-offset-4"
              >
                Obriši taj broj
              </button>
            )}
          </p>
        </form>
      )}

      <MojeDojave verzija={poslanih} zaboravljen={zaboravljen} />
    </>
  );
}

type StanjeMojih =
  | { vrsta: "ucitavam" }
  | { vrsta: "greska" }
  | { vrsta: "imam"; dojave: MojaDojava[] };

/** „čet, 4. 9. 22.15”, u vremenu preglednika. */
function trenutakMjesno(iso: string): string {
  return new Intl.DateTimeFormat("hr-HR", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * „Vaše dojave”: što je ovaj preglednik poslao i je li dobilo vjetar.
 *
 * Oznaka se samo čita (`postojecaOznaka`), nikad ne stvara — posjet
 * stranici ne smije obilježiti preglednik. Bez oznake nema ni popisa.
 */
function MojeDojave({ verzija, zaboravljen }: { verzija: number; zaboravljen: boolean }) {
  // Oznaka se čita pri svakom prikazu: poslije slanja nastane, poslije
  // brisanja nestane, a na poslužitelju je nema — pa ni popisa.
  const oznaka = useSyncExternalStore(nista, postojecaOznaka, () => null);
  const [stanje, setStanje] = useState<StanjeMojih>({ vrsta: "ucitavam" });

  useEffect(() => {
    if (!oznaka) return;
    let vrijedi = true;
    mojeDojave(oznaka).then((r) => {
      if (!vrijedi) return;
      setStanje(r.ok ? { vrsta: "imam", dojave: r.dojave } : { vrsta: "greska" });
    });
    return () => {
      vrijedi = false;
    };
  }, [oznaka, verzija]);

  if (!oznaka || zaboravljen) return null;

  return (
    <section className="mt-10" aria-live="polite">
      <h2 className="text-xl font-bold text-kamen-tinta">Vaše dojave</h2>
      {stanje.vrsta === "ucitavam" && (
        <p className="mt-2 text-base leading-7 text-kamen-drugi">Učitavam…</p>
      )}
      {stanje.vrsta === "greska" && (
        <p className="mt-2 text-base leading-7 text-kamen-drugi">
          Popis se trenutačno ne može učitati.
        </p>
      )}
      {stanje.vrsta === "imam" && stanje.dojave.length === 0 && (
        <p className="mt-2 text-base leading-7 text-kamen-drugi">
          Iz ovog preglednika još nema dojava.
        </p>
      )}
      {stanje.vrsta === "imam" && stanje.dojave.length > 0 && (
        <>
          <p className="mt-2 text-base leading-7 text-kamen-drugi">
            Zadnjih {Math.min(stanje.dojave.length, 10)} iz ovog preglednika, i je li
            koja dobila izmjereni vjetar. Sat bez vjetra (tišina) stoji zabilježen,
            ali izvan ruže.
          </p>
          <ul className="mt-3 divide-y divide-kamen-tlo rounded-xl border border-kamen-tlo bg-white">
            {stanje.dojave.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-base leading-6">
                <span className="tabular-nums text-kamen-tinta">{trenutakMjesno(d.occurredAt)}</span>
                <span className="font-semibold text-kamen-tinta">
                  {d.smelled ? (d.strength ? ODOUR_STRENGTH_SHORT[d.strength] : "smrdjelo") : "nije smrdjelo"}
                </span>
                {d.place && <span className="text-kamen-tekst">{d.place}</span>}
                <span className="text-kamen-drugi">
                  {d.vjetarIz
                    ? `vjetar iz ${d.vjetarIz}`
                    : d.tisina
                      ? "tišina — bez smjera"
                      : d.satTraje
                        ? "vjetar stiže kad sat završi"
                        : "vjetar još čekamo"}
                </span>
                <Link
                  href={adresaSimulatora({
                    pocetak: new Date(d.occurredAt),
                    smrdi: d.smelled,
                    mjesto: d.lat !== null && d.lng !== null ? { lat: d.lat, lng: d.lng } : null,
                    satTraje: d.satTraje,
                  })}
                  className="fokus inline-flex min-h-11 items-center rounded font-semibold text-maslina-tamna underline decoration-maslina-rub decoration-2 underline-offset-4"
                >
                  na simulatoru →
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
