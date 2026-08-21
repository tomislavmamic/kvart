import Link from "next/link";
import type { ReactNode } from "react";

import { DimPerjanica } from "@/components/karepovac/dim-perjanica";
import { PerjanicaSIzborom } from "@/components/karepovac/perjanica-s-izborom";
import { SIRA_KARTA } from "@/generated/karepovac-siri";
import { POSTAJE } from "@/lib/vjetar";
import { pripremiZrak, type ZrakZaKartu } from "@/lib/zrak";

import {
  BLIZI_OKVIR,
  CESTE_UZ_PLOHU,
  OKVIR,
  PODLOGA,
  PRSTENI,
  TOCKE,
  TOKOVI,
  VIIRS,
  VISINE,
} from "@/generated/karepovac-karta";

/** Stroke ostaje jednake debljine i kad kartica priđe bliže plohi. */
const NESKALIRANO = { vectorEffect: "non-scaling-stroke" } as const;

type Izvor = "mi" | "sluzbeno" | "procjena" | "istraziti";

const IZVOR_STIL: Record<Izvor, string> = {
  mi: "bg-maslina-vez text-maslina-tamna",
  sluzbeno: "bg-sky-50 text-sky-800",
  procjena: "bg-kamen-plitko text-kamen-tekst",
  istraziti: "bg-amber-100 text-amber-900",
};

/**
 * Sati idu na cijele, koncentracije na značajne znamenke.
 *
 * Fiksne decimale ovdje ne rade: donji rub koncentracije je 0,0004 µg/m³, što
 * na tri decimale ispadne „0,000” — a ljestvica koja tvrdi da počinje od nule
 * govori upravo ono što ova ne smije.
 */
function poVelicini(x: number) {
  return x >= 10
    ? x.toLocaleString("hr-HR", { maximumFractionDigits: 0 })
    : x.toLocaleString("hr-HR", { maximumSignificantDigits: 2 });
}

/**
 * Poveznica na isti sloj u karti, sa zapaljenim pogledom, podlogom i mjestom.
 *
 * Mjerilo je 16, a ne manje. Karta drži `MAP_MAX_BOUNDS`, a Leaflet uz njih
 * pomiče središte da okno ostane unutar okvira — pri 14 i 15 je okno šire od
 * onoga što do plohe preostaje, pa je odgurne prema sjeverozapadu i ploha
 * ispadne iz sredine. Pri 16 stane.
 */
const U_KARTI =
  "/karta?pogled=zrak-karepovac&sloj=karepovac-sati&podloga=dof&c=43.52150,16.51050&z=16";

function Mjesto({
  x,
  y,
  children,
  velicina = 10,
  ploha = false,
  sidro = "middle",
}: {
  x: number;
  y: number;
  children: string;
  velicina?: number;
  ploha?: boolean;
  sidro?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={velicina}
      fontWeight={700}
      textAnchor={sidro}
      className={`karepovac-mjesto${ploha ? " karepovac-mjesto-ploha" : ""}`}
    >
      {children}
    </text>
  );
}

function Mjesta({ blizu = false }: { blizu?: boolean }) {
  if (blizu) {
    return (
      <>
        <Mjesto x={524} y={302} velicina={12} ploha>
          KAREPOVAC
        </Mjesto>
        <Mjesto x={358} y={208} velicina={11}>
          Dračevac
        </Mjesto>
      </>
    );
  }
  return (
    <>
      <Mjesto x={497} y={250} ploha>
        KAREPOVAC
      </Mjesto>
      <Mjesto x={330} y={150}>
        Dračevac
      </Mjesto>
      <Mjesto x={120} y={100}>
        Bilice
      </Mjesto>
    </>
  );
}

function Mjerilo({ blizu = false }: { blizu?: boolean }) {
  const x0 = blizu ? BLIZI_OKVIR.x : 0;
  const y0 = blizu ? BLIZI_OKVIR.y : 0;
  const sirina = blizu ? BLIZI_OKVIR.sirina : OKVIR.sirina;
  const visina = blizu ? BLIZI_OKVIR.visina : OKVIR.visina;
  const duljina = blizu ? BLIZI_OKVIR.mjerilo200 : OKVIR.mjerilo500;
  const metara = blizu ? 200 : 500;
  const bx = x0 + 18;
  const by = y0 + visina - 17;

  return (
    <g className="karepovac-mjerilo" aria-hidden="true">
      <path
        d={`M${bx} ${by} h${duljina} M${bx} ${by - 4} v8 M${bx + duljina} ${by - 4} v8`}
        stroke="var(--color-kamen-tekst)"
        strokeWidth={2}
        fill="none"
        {...NESKALIRANO}
      />
      <text x={bx} y={by - 7} fontSize={9} fontWeight={700}>
        {metara} m
      </text>
      <g transform={`translate(${x0 + sirina - 24} ${y0 + 24})`}>
        <path d="M0 -11 L4.5 5.5 L0 2 L-4.5 5.5 Z" fill="var(--color-kamen-tekst)" />
        <text x={0} y={17} fontSize={9} fontWeight={700} textAnchor="middle">
          S
        </text>
      </g>
    </g>
  );
}

function Ploha({ ispuna = true }: { ispuna?: boolean }) {
  return (
    <g aria-hidden="true">
      <path
        d={PODLOGA.ploha}
        fill={ispuna ? "var(--color-kamen-rub)" : "none"}
        stroke="var(--color-kamen-tekst)"
        strokeWidth={1.7}
        {...NESKALIRANO}
      />
      <path
        d={PODLOGA.plohaManja}
        fill={ispuna ? "var(--color-kamen-rub)" : "none"}
        stroke="var(--color-kamen-tekst)"
        strokeWidth={1.3}
        {...NESKALIRANO}
      />
    </g>
  );
}

/** Podloga se crta jednom pa je svaka kartica samo poziva — tako sve stoje
 *  nad istim ulicama i datoteka ostaje razumne veličine. */
export function PodlogaDefinicija() {
  return (
    <svg width={0} height={0} aria-hidden="true" focusable="false" className="absolute">
      <defs>
        <g id="karepovac-podloga">
          <rect
            x={-40}
            y={-40}
            width={OKVIR.sirina + 80}
            height={OKVIR.visina + 80}
            fill="#fcfbf9"
          />
          <path d={PODLOGA.izohipseSporedne} fill="none" stroke="#e9e4da" strokeWidth={0.6} {...NESKALIRANO} />
          <path d={PODLOGA.izohipseGlavne} fill="none" stroke="#d6cec0" strokeWidth={1} {...NESKALIRANO} />
          <path d={PODLOGA.zgrade} fill="#e2e0dd" />
          <path
            d={PODLOGA.ulice}
            fill="none"
            stroke="#c4c2bf"
            strokeWidth={1.3}
            strokeLinecap="round"
            {...NESKALIRANO}
          />
          <path
            d={PODLOGA.granicaDracevac}
            fill="none"
            stroke="var(--color-maslina)"
            strokeWidth={1.7}
            strokeDasharray="5 4"
            {...NESKALIRANO}
          />
          <path
            d={PODLOGA.granicaBilice}
            fill="none"
            stroke="var(--color-maslina)"
            strokeWidth={1.7}
            strokeDasharray="5 4"
            {...NESKALIRANO}
          />
        </g>
        <clipPath id="karepovac-okvir">
          <rect width={OKVIR.sirina} height={OKVIR.visina} />
        </clipPath>
        <clipPath id="karepovac-uz-plohu">
          <path d={PODLOGA.ploha} />
        </clipPath>
        <radialGradient id="karepovac-slijeganje" cx="0.5" cy="0.55" r="0.55">
          <stop offset="0" stopColor="#a30037" stopOpacity="0.8" />
          <stop offset="0.45" stopColor="#d97706" stopOpacity="0.55" />
          <stop offset="0.8" stopColor="#fcd34d" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fcd34d" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient id="karepovac-vjetar" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#123a63" />
          <stop offset="0.45" stopColor="#1d5c8f" />
          <stop offset="1" stopColor="#2a7fa8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Karta({
  opis,
  blizu = false,
  klasa = "",
  children,
}: {
  opis: string;
  blizu?: boolean;
  klasa?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox={blizu ? BLIZI_OKVIR.viewBox : OKVIR.viewBox}
      role="img"
      aria-label={opis}
      className={`block h-auto w-full ${klasa}`}
    >
      <use href="#karepovac-podloga" />
      {children}
      <Mjerilo blizu={blizu} />
    </svg>
  );
}

/** Natpis u donjem desnom kutu okvira: što ovaj pogled pokazuje. */
function NatpisOkvira({ children }: { children: string }) {
  return (
    <Mjesto x={OKVIR.sirina - 18} y={OKVIR.visina - 30} sidro="end" velicina={9.5}>
      {children}
    </Mjesto>
  );
}

/**
 * Nepomična podloga ispod perjanice, sa sjenčanim reljefom.
 *
 * Reljef je ovdje, a ne na svakoj kartici, jer ga treba samo perjanica: otkad
 * polje vjetra doista skreće oko padine (medijan 9°, nad padinama i preko 50°),
 * zrak na karti zavija — a bez sjene zavija oko brda kojih se na slici ne vidi.
 *
 * Način miješanja je `multiply`, a ne neprozirna slika: podloga ispod nosi
 * ceste, zgrade i izohipse, pa ih sjena smije potamniti ali ne i pojesti.
 */
function PodlogaKarte() {
  return (
    <svg viewBox={OKVIR.viewBox} aria-hidden="true" className="block h-auto w-full">
      <use href="#karepovac-podloga" />
      <image
        href="/karepovac/kvart-reljef.png"
        x={0}
        y={0}
        width={OKVIR.sirina}
        height={OKVIR.visina}
        opacity={0.65}
        style={{ mixBlendMode: "multiply" }}
        preserveAspectRatio="none"
      />
    </svg>
  );
}

/** Obris plohe, imena mjesta i mjerilo — sve što dim ne smije progutati. */
function NatpisiKarte({ opis, children }: { opis: string; children?: ReactNode }) {
  return (
    <svg
      viewBox={OKVIR.viewBox}
      role="img"
      aria-label={opis}
      className="pointer-events-none absolute inset-0 block h-full w-full"
    >
      <Ploha ispuna={false} />
      {children}
      <Mjesta />
      <Mjerilo />
    </svg>
  );
}

/**
 * Karta s perjanicom koja se računa u pregledniku.
 *
 * Tri sloja jer platno mora leći preko podloge, a natpisi preko platna —
 * inače dim proguta imena mjesta.
 *
 * Ovdje stoji sama perjanica, bez izbora tvari i ljestvice; to je za mjesta
 * gdje je karta najava. Puni prikaz je `PerjanicaSIzborom`. Umjesto polja
 * može doći i nepomična slika — tako se u isti okvir slažu godišnji pogledi.
 */
export function KartaDima({
  opis,
  polje,
  slika,
  children,
}: {
  opis: string;
  polje?: ZrakZaKartu["polje"];
  /** Nepomična slika umjesto perjanice koja se računa u pregledniku. */
  slika?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <PodlogaKarte />
      {slika ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slika} alt="" className="absolute inset-0 block h-full w-full" />
      ) : polje ? (
        <DimPerjanica polje={polje} />
      ) : null}
      <NatpisiKarte opis={opis}>{children}</NatpisiKarte>
    </div>
  );
}

/**
 * Natpis u kutu karte.
 *
 * Os nošenja stoji samo kad je ima: pri tišini i pri promjenjivom vjetru
 * jedan broj u stupnjevima izgledao bi kao tvrdnja koju podatak ne nosi.
 */
function natpisPolja(opis: ZrakZaKartu["opis"], azimut: number): string {
  return opis.stanje === "prema" || opis.stanje === "mimo"
    ? `${opis.natpis} — os ${azimut}°`
    : opis.natpis;
}

/** Udaljenost postaje s decimalnim zarezom, kako se ovdje i piše. */
function km(postaja: keyof typeof POSTAJE): string {
  return String(POSTAJE[postaja].udaljenostKm).replace(".", ",");
}

/** Gumb prebacivača pogleda; `peer-checked` ga puni kad je pogled odabran. */
const STIL_GUMBA =
  "order-1 inline-flex min-h-11 cursor-pointer items-center rounded-full border "
  + "border-kamen-rub px-4 py-2 text-sm font-semibold text-kamen-tekst "
  + "hover:bg-white peer-checked:border-kamen-tinta peer-checked:bg-kamen-tinta "
  + "peer-checked:text-white peer-checked:hover:bg-kamen-tinta "
  + "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 "
  + "peer-focus-visible:outline-maslina";

/** Boja natpisa prema tome kamo zrak ide. */
const BOJA_STANJA: Record<ZrakZaKartu["opis"]["stanje"], string> = {
  prema: "bg-amber-100 text-amber-900",
  mimo: "bg-maslina-vez text-maslina-tamna",
  stoji: "bg-sky-50 text-sky-900",
  nepoznato: "bg-kamen-plitko text-kamen-tekst",
};

/**
 * Perjanica preko cijele širine, za uvodni dio `/karepovac/zrak`.
 *
 * Dohvat stoji odvojeno od prikaza: `PrikazPoljaDima` je čista funkcija stanja
 * zraka, pa se svako stanje — tišina, promjenjiv vjetar, izvor koji šuti —
 * dade nacrtati u provjeri bez mreže.
 */
export async function PoljeDimaVeliko() {
  return <PrikazPoljaDima {...await pripremiZrak()} />;
}

/**
 * Pogledi na zrak s Karepovca — jedan okvir, više toga za vidjeti.
 *
 * Prvi pogled je vjetar koji sada puše; ostali su zbroj godine. Razlika je
 * stvarna i zato svaki nosi svoj opis i svoje podrijetlo ispod karte: jedno
 * je jedan sat, drugo je godina dana računa.
 *
 * Karta je namjerno nepomična. Podatak nije toliko točan da bi zasluživao
 * razgledavanje izbliza, a i sve što ovdje stoji vrijedi za kvart. Tko želi
 * dalje — preko granice kvarta, uz katastar i ortofoto — ide na `/karta`,
 * gdje isti sloj stoji kao pogled. Zato ovdje nema ni povećala ni povlačenja,
 * nego jedna poveznica.
 *
 * Sama nosi definiciju podloge jer je na toj stranici nema tko drugi postaviti.
 */
export function PrikazPoljaDima({ zrak, polje, opis }: ZrakZaKartu) {
  const godisnji = SIRA_KARTA.slojevi.map((sloj) => ({
    kljuc: sloj.kljuc,
    naziv: sloj.naziv,
    opis: sloj.opis,
    slika: sloj.slikaKvart as string,
    od: sloj.kvartOd as number,
    do: sloj.kvartDo as number,
    jedinica: sloj.jedinica as string,
  }));

  return (
    <div className="relative flex flex-col bg-[#fcfbf9] p-4 sm:p-6">
      <PodlogaDefinicija />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-bold text-kamen-tinta">
          Kamo zrak s plohe ide
        </span>
        <span className="rounded-lg bg-amber-100 px-3 py-2 text-right text-xs text-amber-900">
          <span className="block font-bold">Model, ne mjerenje</span>
          <span className="mt-0.5 block">Oblik, ne količina</span>
          {opis.kada ? (
            <span className="mt-0.5 block">vjetar izmjeren u {opis.kada}</span>
          ) : null}
        </span>
      </div>

      <fieldset className="mt-4 flex flex-wrap gap-2">
        <legend className="sr-only">Što karta pokazuje</legend>

        {/* `contents` skida omotač iz rasporeda, pa gumb, oznaka i karta
            ostaju braća u DOM-u — bez toga `peer-checked` nema što gledati. */}
        <div className="contents">
          <input
            type="radio"
            name="pogled-zraka"
            id="pogled-sada"
            defaultChecked
            className="peer sr-only"
          />
          <label htmlFor="pogled-sada" className={STIL_GUMBA}>
            Sada
          </label>
          <div className="order-2 hidden w-full peer-checked:block">
            <div className="mt-4">
              <PerjanicaSIzborom
                polje={polje}
                podloga={<PodlogaKarte />}
                natpisi={
                  <NatpisiKarte opis={`Karta kvarta: ${opis.recenica}`}>
                    <NatpisOkvira>{natpisPolja(opis, polje.azimut)}</NatpisOkvira>
                  </NatpisiKarte>
                }
              />
            </div>

            <p
              className={`mt-3 rounded-lg px-3 py-2 text-base leading-7 font-semibold ${BOJA_STANJA[opis.stanje]}`}
            >
              {opis.recenica}
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-kamen-rub bg-kamen-rub text-sm sm:grid-cols-3">
              <div data-kind="official" className="bg-white p-3">
                <dt className="font-semibold text-kamen-tinta">Vjetar</dt>
                <dd className="mt-0.5 text-kamen-tekst">
                  {zrak.vjetar
                    ? `izmjeren, ${POSTAJE[zrak.vjetar.postaja].oznaka} `
                      + `(${km(zrak.vjetar.postaja)} km)`
                    : "sada nedostupan"}
                </dd>
              </div>
              <div data-kind="estimated" className="bg-white p-3">
                <dt className="font-semibold text-kamen-tinta">Miješanje zraka</dt>
                <dd className="mt-0.5 text-kamen-tekst">
                  {zrak.mijesanje
                    ? `model, sloj ${zrak.mijesanje.dubina} m`
                    : "sada nedostupno"}
                </dd>
              </div>
              <div data-kind="missing" className="bg-white p-3">
                <dt className="font-semibold text-kamen-tinta">Jačina izvora</dt>
                <dd className="mt-0.5 text-kamen-tekst">bazdarena, ali široko</dd>
              </div>
            </dl>

            {opis.zadrska ? (
              <p className="mt-3 max-w-prose rounded-lg bg-amber-50 px-3 py-2 text-base leading-7 text-amber-950">
                {opis.zadrska}
              </p>
            ) : null}

            {opis.raspon ? (
              <p className="mt-3 max-w-prose text-base leading-7 text-kamen-drugi">
                {opis.raspon}
              </p>
            ) : null}

            <p className="mt-3 max-w-prose text-base leading-7 text-kamen-drugi">
              {"Vjetar je izmjeren na "
                + (zrak.vjetar
                  ? `postaji ${POSTAJE[zrak.vjetar.postaja].ime}, `
                    + `${km(zrak.vjetar.postaja)} km od kvarta`
                  : "najbližoj postaji koja ga objavljuje")
                + ", a ne u kvartu."}
            </p>
          </div>
        </div>

        {godisnji.map((pogled) => (
          <div key={pogled.kljuc} className="contents">
            <input
              type="radio"
              name="pogled-zraka"
              id={`pogled-${pogled.kljuc}`}
              className="peer sr-only"
            />
            <label htmlFor={`pogled-${pogled.kljuc}`} className={STIL_GUMBA}>
              {pogled.naziv}
            </label>
            <div className="order-2 hidden w-full peer-checked:block">
              <div className="mt-4 overflow-hidden rounded-lg border border-kamen-tlo">
                <KartaDima
                  slika={pogled.slika}
                  opis={`Karta kvarta: ${pogled.opis}`}
                >
                  <NatpisOkvira>{`godina ${SIRA_KARTA.godina}.`}</NatpisOkvira>
                </KartaDima>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="shrink-0 text-sm tabular-nums text-kamen-drugi">
                  {poVelicini(pogled.od)}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2.5 flex-1 rounded-full bg-[linear-gradient(90deg,#fdedc7,#fad689,#e99c42,#b7542a,#5e1b16)]"
                />
                <span className="shrink-0 text-sm tabular-nums text-kamen-drugi">
                  {poVelicini(pogled.do)} {pogled.jedinica}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-kamen-rub bg-kamen-rub text-sm sm:grid-cols-3">
                <div data-kind="estimated" className="bg-white p-3">
                  <dt className="font-semibold text-kamen-tinta">Polje vjetra</dt>
                  <dd className="mt-0.5 text-kamen-tekst">iz LiDAR reljefa</dd>
                </div>
                <div data-kind="official" className="bg-white p-3">
                  <dt className="font-semibold text-kamen-tinta">Vjetar</dt>
                  <dd className="mt-0.5 text-kamen-tekst">
                    izmjeren, {SIRA_KARTA.godina}.
                  </dd>
                </div>
                <div data-kind="missing" className="bg-white p-3">
                  <dt className="font-semibold text-kamen-tinta">Jačina izvora</dt>
                  <dd className="mt-0.5 text-kamen-tekst">bazdarena, ali široko</dd>
                </div>
              </dl>

              <p className="mt-3 max-w-prose text-base leading-7 text-kamen-tekst">
                {pogled.opis} Ljestvica ide od najmanje do najveće vrijednosti u
                ovom okviru, a ne od nule — inače bi cijeli kvart bio obojen i
                perjanica se ne bi vidjela kao perjanica. Brojke uz nju kažu
                koliko su ti rubovi.
              </p>
            </div>
          </div>
        ))}
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-kamen-tlo pt-4">
        <p className="max-w-md text-base leading-7 text-kamen-drugi">
          Karta je nepomična jer je za pogled. Za veće mjerilo, izvan granica
          kvarta i uz katastar — otvori je u karti.
        </p>
        <Link
          href={U_KARTI}
          className="fokus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-kamen-tinta px-5 py-2.5 text-sm font-semibold text-kamen-tinta hover:bg-kamen-tinta hover:text-white"
        >
          Otvori u karti
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

function Kartica({
  naslov,
  opis,
  izvor,
  izvorOznaka,
  napomena,
  poveznica,
  poveznicaOznaka,
  blizu = false,
  siroka = false,
  children,
}: {
  naslov: string;
  opis: string;
  izvor: Izvor;
  izvorOznaka: string;
  napomena: string;
  poveznica?: string;
  poveznicaOznaka?: string;
  blizu?: boolean;
  siroka?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border border-kamen-tlo bg-white ${
        siroka ? "lg:col-span-2" : ""
      }`}
    >
      {children && (
        <div className="relative border-b border-kamen-tlo bg-[#fcfbf9] leading-none">
          {children}
          <span className="absolute left-3 top-3 rounded-full border border-kamen-rub bg-white/90 px-2 py-0.5 text-xs font-bold text-kamen-drugi">
            {blizu ? "Ploha izbliza" : "Cijeli kvart"}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="text-lg font-bold leading-snug tracking-[-0.014em] text-kamen-tinta">
          {naslov}
        </h3>
        <p className="max-w-[62ch] text-base leading-7 text-kamen-tekst">{opis}</p>
        {poveznica && poveznicaOznaka && (
          <Link
            href={poveznica}
            className="fokus mt-1 inline-flex w-fit rounded-md text-base font-semibold text-maslina underline decoration-maslina-rub decoration-2 underline-offset-4 hover:text-maslina-tamna"
          >
            {poveznicaOznaka} →
          </Link>
        )}
        <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-2 pt-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${IZVOR_STIL[izvor]}`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {izvorOznaka}
          </span>
          <span className="flex-1 basis-56 text-xs leading-relaxed text-kamen-tih">
            {napomena}
          </span>
        </div>
      </div>
    </article>
  );
}

const NAS_BUNAR = TOCKE.find((t) => t.d === 799) ?? TOCKE[4];

export async function KarepovacKarte() {
  return <PrikazKarepovacKarte zrak={await pripremiZrak()} />;
}

export function PrikazKarepovacKarte({ zrak }: { zrak: ZrakZaKartu }) {
  return (
    <section aria-labelledby="sto-pratimo">
      <PodlogaDefinicija />

      <div className="grid gap-4 rounded-2xl bg-kamen-tinta p-5 text-white sm:p-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h1 className="max-w-[22ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.035em] text-white sm:text-4xl">
            Karepovac je gore, mi smo pod njim
          </h1>
          <p className="mt-4 max-w-[62ch] text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">
            Kad puše levant, zrak nam nosi miris s plohe. Kad padne kiša, procjedna
            voda ide kroz krš prema našim bunarima i vrtovima. Na svakoj je kartici
            ista karta istoga kvarta — mijenja se samo sloj koji je na nju nacrtan.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 self-end sm:grid-cols-4 lg:grid-cols-2">
          {[
            { v: `${VISINE.tijelo[0]}–${VISINE.tijelo[1]} m`, o: "tijelo odlagališta", b: "text-rose-300" },
            { v: `${VISINE.dracevac[0]}–${VISINE.dracevac[1]} m`, o: "Dračevac", b: "text-amber-300" },
            { v: `${VISINE.bilice[0]}–${VISINE.bilice[1]} m`, o: "Bilice", b: "text-sky-300" },
            { v: `${VISINE.najblizaKuca} m`, o: "od ruba plohe do prve kuće", b: "text-white" },
          ].map((s) => (
            <div key={s.o}>
              <dt className={`text-xl font-extrabold tabular-nums tracking-[-0.02em] ${s.b}`}>
                {s.v}
              </dt>
              <dd className="mt-0.5 text-xs font-semibold text-zinc-400">{s.o}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-600" />
        <p className="text-base leading-7">
          <strong className="font-bold">Podloga je stvarna, brojke nisu.</strong> Karta,
          izohipse, zgrade, ceste, granice kvarta i obris plohe izvučeni su iz podataka
          koje već imamo. Vrijednosti na njima su ogledne jer mjerenja još nisu počela.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2
          id="sto-pratimo"
          className="text-2xl font-bold tracking-[-0.02em] text-kamen-tinta"
        >
          Jedanaest stvari koje pratimo
        </h2>
        <p className="text-base text-kamen-drugi">
          Ista karta i isti sjever na svakoj; tri kartice o samoj plohi gledaju izbliza
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Kartica
          naslov="Kamo zrak s plohe ide sada"
          opis={`Ploha leži iznad kvarta i istočno od njega. ${zrak.opis.recenica} Naleti izlaze sami jer izvor ne ispušta jednolično.`}
          izvor="procjena"
          izvorOznaka="Model, ne mjerenje"
          napomena={`Polje vjetra izvedeno je iz LiDAR reljefa, a smjer i brzina s postaje ${zrak.zrak.vjetar ? `${POSTAJE[zrak.zrak.vjetar.postaja].oznaka} (${km(zrak.zrak.vjetar.postaja)} km)` : "koja ga trenutačno objavljuje"}${zrak.opis.kada ? `, izmjereni u ${zrak.opis.kada}` : ""}. Jačina izvora još je pretpostavka, pa prikaz govori kamo zrak ide, a ne koliko mirisa nosi.`}
          poveznica="/karepovac/zrak"
          poveznicaOznaka="Uđite u projekt praćenja zraka"
        >
          <KartaDima
            polje={zrak.polje}
            opis={`Karta kvarta: ${zrak.opis.recenica}`}
          >
            <Mjesto x={OKVIR.sirina - 18} y={OKVIR.visina - 30} sidro="end" velicina={9.5}>
              {natpisPolja(zrak.opis, zrak.polje.azimut)}
            </Mjesto>
          </KartaDima>
        </Kartica>

        <Kartica
          naslov="Voda u bunarima nizvodno"
          opis={`Ista padina, ista kiša. Tijelo odlagališta leži na ${VISINE.tijelo[0]}–${VISINE.tijelo[1]} m, Dračevac na ${VISINE.dracevac[0]}–${VISINE.dracevac[1]}, Bilice na ${VISINE.bilice[0]}–${VISINE.bilice[1]}. Što god procuri, ide prema nama.`}
          izvor="mi"
          izvorOznaka="Uzorkujemo sami"
          napomena="Vodljivost mjerimo sami svaki mjesec, a u laboratorij šaljemo dvaput godišnje. Treba nam i jedan bunar izvan dosega, da imamo s čim usporediti."
        >
          <Karta opis="Karta s prstenovima udaljenosti od odlagališta i točkama bunara; naglašen je bunar na 800 metara udaljenosti i 34 metra nadmorske visine.">
            <g clipPath="url(#karepovac-okvir)">
              {PRSTENI.map((p) => (
                <path
                  key={p.metara}
                  d={p.d}
                  fill="none"
                  stroke="#005986"
                  strokeWidth={p.istaknut ? 1.5 : 0.9}
                  strokeDasharray={p.istaknut ? "4 3" : "3 4"}
                  opacity={p.istaknut ? 0.85 : 0.5}
                  {...NESKALIRANO}
                />
              ))}
            </g>
            <Ploha />
            {TOCKE.map((t) => (
              <circle
                key={t.d}
                cx={t.x}
                cy={t.y}
                r={4 + (1400 - t.d) / 190}
                fill="#0284c7"
                fillOpacity={0.28 + (1400 - t.d) / 2600}
                stroke="#005986"
                strokeWidth={1.4}
                {...NESKALIRANO}
              />
            ))}
            <circle
              cx={NAS_BUNAR.x}
              cy={NAS_BUNAR.y}
              r={13}
              fill="none"
              stroke="var(--color-maslina)"
              strokeWidth={2}
              {...NESKALIRANO}
            />
            <Mjesto x={NAS_BUNAR.x} y={NAS_BUNAR.y - 19} velicina={9.5}>
              {`naš bunar · ${NAS_BUNAR.visina} m n.v.`}
            </Mjesto>
            <Mjesta />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Kamo voda ide s plohe"
          opis="Podebljani su tokovi u koje se slijeva voda s plohe. Model terena staje na rubu odlagališta, pa im i izvori počinju tek ondje."
          izvor="mi"
          izvorOznaka="Mjerimo sami"
          napomena="Dubinu vode izmjerimo vrpcom, u svim bunarima isti dan. Kuda voda ide pod zemljom, u kršu, zna reći samo hidrogeološka studija."
        >
          <Karta opis="Karta na kojoj su naglašene linije otjecanja čiji izvori leže uz rub odlagališta, s ostatkom mreže u pozadini.">
            <path d={TOKOVI.ostalo} fill="none" stroke="#0284c7" strokeWidth={0.7} opacity={0.2} {...NESKALIRANO} />
            <path
              d={TOKOVI.sPlohe}
              fill="none"
              stroke="#005986"
              strokeWidth={2.2}
              opacity={0.55}
              strokeLinecap="round"
              {...NESKALIRANO}
            />
            <path
              d={TOKOVI.sPlohe}
              fill="none"
              stroke="#0284c7"
              strokeWidth={2.6}
              opacity={0.95}
              strokeLinecap="round"
              className="karepovac-tece"
              {...NESKALIRANO}
            />
            <Ploha />
            <g fill="var(--color-maslina)" stroke="#ffffff" strokeWidth={1.2}>
              {TOKOVI.izvori.map((t) => (
                <circle key={`${t.x}-${t.y}`} cx={t.x} cy={t.y} r={2.6} />
              ))}
            </g>
            {TOCKE.filter((_, i) => i % 2 === 0).map((t) => (
              <g key={t.d}>
                <rect
                  x={t.x - 15}
                  y={t.y - 7}
                  width={30}
                  height={14}
                  rx={3}
                  fill="#ffffff"
                  stroke="#005986"
                  strokeWidth={1.2}
                  {...NESKALIRANO}
                />
                <text
                  x={t.x}
                  y={t.y + 3.6}
                  fontSize={8.5}
                  fontWeight={700}
                  textAnchor="middle"
                  fill="#005986"
                >
                  {t.visina} m
                </text>
              </g>
            ))}
            <Mjesta />
            <Mjesto x={OKVIR.sirina - 18} y={OKVIR.visina - 30} sidro="end" velicina={9}>
              zeleno — izvori uz rub plohe
            </Mjesto>
          </Karta>
        </Kartica>

        <Kartica
          naslov="Tlo u vrtovima"
          opis="Teški metali ondje gdje se sadi i zalijeva vodom iz bunara. Isti vrtovi svake godine, uzorak s tri dubine."
          izvor="mi"
          izvorOznaka="Uzorkujemo sami"
          napomena="Laboratorij jednom godišnje. Prvo moramo odlučiti tražimo li ono što padne iz zraka ili ono što se nakupi zalijevanjem — o tome ovisi gdje se kopa."
        >
          <Karta opis="Karta s oglednim mjestima za uzorkovanje tla, tamnijima bliže odlagalištu.">
            <Ploha />
            {TOCKE.map((t, i) => (
              <rect
                key={t.d}
                x={t.x - 5}
                y={t.y - 5}
                width={10}
                height={10}
                fill="#a1794a"
                fillOpacity={0.85 - i * 0.09}
                stroke="#6b4a24"
                strokeWidth={1.2}
                transform={`rotate(45 ${t.x} ${t.y})`}
                {...NESKALIRANO}
              />
            ))}
            <Mjesta />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Dim i požari na plohi"
          opis="Najgori dan u godini nije onaj s najviše sumporovodika, nego onaj kad ploha gori. Kvadrati su prava razlučivost satelitske dojave: 375 metara."
          izvor="sluzbeno"
          izvorOznaka="Satelit i dojave"
          napomena="Toplinske dojave su besplatne i stižu više puta na dan. Treba provjeriti može li se ploha na toj razlučivosti uopće razlikovati od okolice."
          blizu
        >
          <Karta
            blizu
            opis="Približena karta odlagališta s mrežom satelitskih toplinskih točaka razlučivosti 375 metara."
          >
            {VIIRS.map((c) => (
              <rect
                key={`${c.x}-${c.y}`}
                x={c.x}
                y={c.y}
                width={c.a}
                height={c.a}
                fill={c.pogodak ? "#a30037" : "none"}
                fillOpacity={c.pogodak ? 0.16 : 0}
                stroke="#a30037"
                strokeWidth={c.pogodak ? 1.1 : 0.7}
                strokeOpacity={c.pogodak ? 0.75 : 0.25}
                {...NESKALIRANO}
              />
            ))}
            <Ploha />
            <g className="karepovac-zar">
              <circle cx={OKVIR.srediste[0] - 44} cy={OKVIR.srediste[1] + 20} r={7} fill="#a30037" />
              <circle
                cx={OKVIR.srediste[0] - 44}
                cy={OKVIR.srediste[1] + 20}
                r={16}
                fill="none"
                stroke="#a30037"
                strokeWidth={1.8}
                className="karepovac-puls"
                {...NESKALIRANO}
              />
            </g>
            <Mjesto x={OKVIR.srediste[0] - 44} y={OKVIR.srediste[1] + 46} velicina={10}>
              žarište
            </Mjesto>
            <Mjesta blizu />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Radi li baklja i otplinjavanje"
          opis="Ugašena baklja obično objasni noć u kojoj se kvart ne može prozračiti. Vidi se s ruba kvarta, pa je dovoljno fotografirati je i zapisati vrijeme."
          izvor="mi"
          izvorOznaka="Promatramo sami"
          napomena="Dva stalna motrišta i pogled svaku večer u isto vrijeme. Nikakva oprema ne treba."
          blizu
        >
          <Karta
            blizu
            opis="Približena karta odlagališta s položajem baklje i dvama motrištima u kvartu iz kojih se vidi."
          >
            <Ploha />
            <g
              stroke="var(--color-maslina)"
              strokeWidth={1.3}
              strokeDasharray="5 4"
              opacity={0.8}
              fill="none"
              {...NESKALIRANO}
            >
              <path d={`M${TOCKE[0].x} ${TOCKE[0].y} L${OKVIR.srediste[0] + 4} ${OKVIR.srediste[1] - 8}`} />
              <path d={`M${TOCKE[3].x} ${TOCKE[3].y} L${OKVIR.srediste[0] + 4} ${OKVIR.srediste[1] - 8}`} />
            </g>
            <g className="karepovac-plamen">
              <circle cx={OKVIR.srediste[0] + 4} cy={OKVIR.srediste[1] - 8} r={19} fill="#d97706" fillOpacity={0.22} />
              <circle cx={OKVIR.srediste[0] + 4} cy={OKVIR.srediste[1] - 8} r={8} fill="#d97706" />
              <circle cx={OKVIR.srediste[0] + 4} cy={OKVIR.srediste[1] - 8} r={3.2} fill="#fef3c6" />
            </g>
            <Mjesto x={OKVIR.srediste[0] + 38} y={OKVIR.srediste[1] - 22} velicina={11}>
              baklja
            </Mjesto>
            {[TOCKE[0], TOCKE[3]].map((t) => (
              <g key={t.d}>
                <path
                  d={`M${t.x} ${t.y - 10} l8 14 h-16 Z`}
                  fill="#ffffff"
                  stroke="var(--color-maslina)"
                  strokeWidth={1.8}
                  {...NESKALIRANO}
                />
                <circle cx={t.x} cy={t.y + 1} r={2.2} fill="var(--color-maslina)" />
                <Mjesto x={t.x} y={t.y - 16} velicina={10}>
                  motrište
                </Mjesto>
              </g>
            ))}
            <Mjesta blizu />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Slijeganje pokrova odlagališta"
          opis="Pokrov koji se neravnomjerno sliježe puca, a kroz pukotine izlazi plin i ulazi kiša. Sve se to vidi sa satelita, bez izlaska na teren i bez ičije dozvole."
          izvor="sluzbeno"
          izvorOznaka="Satelit"
          napomena="Europski servis gibanja tla pokriva Hrvatsku i daje pomak u milimetrima na godinu. Treba provjeriti koliko točaka pada baš na plohu."
          blizu
        >
          <Karta
            blizu
            opis="Približena karta odlagališta obojena po brzini slijeganja, s vrijednostima u milimetrima na godinu."
          >
            <Ploha />
            <g clipPath="url(#karepovac-uz-plohu)">
              <rect
                x={OKVIR.srediste[0] - 155}
                y={OKVIR.srediste[1] - 85}
                width={330}
                height={195}
                fill="url(#karepovac-slijeganje)"
              />
            </g>
            <Ploha ispuna={false} />
            {[
              [-46, -14, "−7"],
              [-16, 8, "−16"],
              [16, -16, "−18"],
              [44, 10, "−11"],
              [-28, 24, "−9"],
              [52, -10, "−5"],
            ].map(([dx, dy, v]) => (
              <g key={String(v)}>
                <circle
                  cx={OKVIR.srediste[0] + Number(dx)}
                  cy={OKVIR.srediste[1] + Number(dy)}
                  r={2.2}
                  fill="var(--color-kamen-tekst)"
                />
                <Mjesto
                  x={OKVIR.srediste[0] + Number(dx)}
                  y={OKVIR.srediste[1] + Number(dy) - 8}
                  velicina={8.5}
                >
                  {String(v)}
                </Mjesto>
              </g>
            ))}
            <Mjesto x={OKVIR.srediste[0] - 60} y={OKVIR.srediste[1] + 62} velicina={10}>
              mm godišnje
            </Mjesto>
            <Mjesta blizu />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Kuda vjetar nosi zrak s plohe"
          opis={`Strujnice su izvedene iz reljefa snimljenog LiDAR-om, za vjetar koji sada puše: struja se ne penje uz padinu nego je obilazi, pa skreće ${zrak.strujnice.skretanje.medijan}° u prosjeku, a nad padinama i do ${zrak.strujnice.skretanje.najvece}°.`}
          izvor="sluzbeno"
          izvorOznaka="Javni podatak"
          napomena={
            zrak.opis.stanje === "prema" || zrak.opis.stanje === "mimo"
              ? `Struja je nacrtana za ${zrak.opis.natpis}; skretanje je izračun iz reljefa. Državna postaja daje širu sliku, a vlastiti anemometar ono što se događa među kućama.`
              : "Smjer sada nije određen, pa je nacrtan slučaj o kojem se javlja — slab jugoistočnjak. Skretanje je izračun iz reljefa. Vlastiti anemometar tek će pokazati što se događa među kućama."
          }
        >
          <Karta
            klasa="karepovac-karta-vjetar"
            opis="Karta kvarta prekrivena poljem strujanja vjetra, s brzinama nad Dračevcem, Bilicama i Karepovcem."
          >
            <g clipPath="url(#karepovac-okvir)">
              <rect width={OKVIR.sirina} height={OKVIR.visina} fill="url(#karepovac-vjetar)" opacity={0.85} />
              <path d={PODLOGA.izohipseGlavne} fill="none" stroke="#ffffff" strokeWidth={0.7} opacity={0.16} {...NESKALIRANO} />
              <path
                d={PODLOGA.ploha}
                fill="#0b2440"
                fillOpacity={0.45}
                stroke="#ffffff"
                strokeWidth={1.4}
                strokeOpacity={0.6}
                {...NESKALIRANO}
              />
              <g stroke="#ffffff" fill="none" strokeWidth={0.9} opacity={0.16}>
                {zrak.strujnice.putanje.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
              <g stroke="#ffffff" fill="none" strokeLinecap="round">
                {zrak.strujnice.putanje.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    pathLength={100}
                    strokeWidth={[1.2, 1.55, 1.35, 1.75, 1.45][i % 5]}
                    className="karepovac-struja"
                    style={{
                      animationDuration: `${(2.9 + (i % 7) * 0.24).toFixed(2)}s`,
                      animationDelay: `${(-(i % 11) * 0.42).toFixed(2)}s`,
                    }}
                  />
                ))}
              </g>
            </g>
            <Mjesto x={330} y={148} velicina={11}>
              Dračevac
            </Mjesto>
            <Mjesto x={120} y={98} velicina={11}>
              Bilice
            </Mjesto>
            <Mjesto x={497} y={248} velicina={11}>
              KAREPOVAC
            </Mjesto>
          </Karta>
        </Kartica>

        <Kartica
          naslov="Kamioni kroz Put sv. Ižidora"
          opis="Ulaz na plohu vodi kroz kvart. Brojimo vozila u smjenama i bilježimo u koje sate prolaze."
          izvor="mi"
          izvorOznaka="Brojimo sami"
          napomena="Treba dogovoriti dva mjesta za brojanje i raspored smjena. Mjerač buke na mobitelu služi za orijentaciju, ne kao dokaz."
        >
          <Karta opis="Karta s naglašenim cestama uz odlagalište i dva mjesta za brojanje vozila.">
            <path
              d={CESTE_UZ_PLOHU}
              fill="none"
              stroke="#953d00"
              strokeWidth={2.8}
              strokeLinecap="round"
              opacity={0.85}
              {...NESKALIRANO}
            />
            <Ploha />
            {[TOCKE[0], TOCKE[2]].map((t, i) => (
              <g key={t.d}>
                <circle cx={t.x} cy={t.y} r={7.5} fill="#ffffff" stroke="#953d00" strokeWidth={1.9} {...NESKALIRANO} />
                <text
                  x={t.x}
                  y={t.y + 3.2}
                  fontSize={8.5}
                  fontWeight={800}
                  textAnchor="middle"
                  fill="#953d00"
                >
                  {i + 1}
                </text>
              </g>
            ))}
            <Mjesta />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Lebdeće čestice u zraku"
          opis="Prašina s plohe kad puše bura i dim kad nešto gori — isti senzor hvata oboje, a stoji višestruko manje od onoga za sumporovodik."
          izvor="istraziti"
          izvorOznaka="Za istražiti"
          napomena="Senzori su jeftini i provjereni. Ostaje vidjeti ima li u Splitu postaja s kojom bismo se usporedili prije nego išta objavimo."
        >
          <Karta opis="Karta s oglednim postajama za lebdeće čestice; znakovi su veći bliže odlagalištu.">
            <Ploha />
            {TOCKE.map((t, i) => (
              <g key={t.d}>
                <circle cx={t.x} cy={t.y} r={11 - i * 0.85} fill="#71717b" fillOpacity={0.44 - i * 0.042} />
                <circle cx={t.x} cy={t.y} r={3} fill="#ffffff" stroke="#3f3f46" strokeWidth={1.4} {...NESKALIRANO} />
              </g>
            ))}
            <Mjesta />
          </Karta>
        </Kartica>

        <Kartica
          naslov="Obveze i rokovi sanacije"
          opis="Jedina kartica bez karte, jer ovo nije prostorni podatak. Što je okolišnom dozvolom propisano mjeriti i objaviti, do kada, i je li objavljeno. Ovdje ne treba nijedan senzor — samo uredna evidencija i zahtjevi za pristup informacijama."
          izvor="sluzbeno"
          izvorOznaka="Javni dokumenti"
          napomena="Okolišna dozvola, godišnja izvješća operatera, nalazi inspekcije i projektna dokumentacija sanacije."
          siroka
        />
      </div>

      <p className="mt-4 text-base leading-7 text-kamen-tih">
        Podloga: izohipse iz LiDAR-a Državne geodetske uprave; zgrade, ulice i obris
        odlagališta iz OpenStreetMapa (ODbL); tokovi izvedeni iz reljefa.
      </p>
    </section>
  );
}
