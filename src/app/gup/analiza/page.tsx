/**
 * Analiza: zašto izmjene GUP-a iz 2025. zaustavljaju novu gradnju
 * do donošenja UPU-a, iako i važeći GUP ondje propisuje UPU. Hrvatska inačica
 * izvješća reports/UPU building ban in sanation areas.md.
 *
 * Svako mjesto u GUP-u na koje se tekst poziva je <Navod>: skočni prozor s
 * doslovnim tekstom ili isječkom lista, a iz njega cijeli dokument otvoren na
 * tom mjestu (/gup/dokument) i izvornik na split.hr. Navodi su u
 * src/lib/gup-dokument/navodi.ts.
 *
 * Brojke o zemljištu na kojem se bez UPU-a neće smjeti graditi čitaju se iz istih podataka kao
 * /gup/zabrana; ostale brojke (usporedba listova, nove zgrade, dozvole) iz
 * izvješća i bilježaka u research_notes/.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import { Navod } from "@/components/gup-dokument/navod";
import { imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajSporne, ucitajZbrojZabrane, zemljisteZaStanovanje } from "@/lib/gup-grad/zabrana-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Zašto izmjene GUP-a zaustavljaju gradnju do donošenja UPU-a",
  description:
    "Analiza: važeći GUP već propisuje UPU za istočni Split, a ondje se ipak gradi. Zabrana gradnje ne proizlazi iz novog zakona, nego iz nove oznake urbane sanacije u prijedlogu izmjena GUP-a iz 2025.",
});

const ha = (m2: number) => Math.round(m2 / 1e4).toLocaleString("hr-HR");
const posto = (dio: number, cijelo: number) => `${Math.round((dio / cijelo) * 100)} %`;

const IZVOR = {
  gupSplit: "https://split.hr/strateski-dokumenti/prostorno-planska-dokumentacija/planovi-na-snazi/gup-splita",
  zpu30: "https://narodne-novine.nn.hr/clanci/sluzbeni/260702.html",
  nn100_04: "https://narodne-novine.nn.hr/clanci/sluzbeni/2004_07_100_1897.html",
  zpug: "https://narodne-novine.nn.hr/clanci/sluzbeni/2007_07_76_2395.html",
  zpu153: "https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html",
  zog153: "https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3221.html",
  nn65_17: "https://narodne-novine.nn.hr/clanci/sluzbeni/2017_07_65_1494.html",
  nn39_19: "https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html",
  nn67_23: "https://narodne-novine.nn.hr/clanci/sluzbeni/2023_06_67_1101.html",
  zpu155: "https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html",
  zog155: "https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2316.html",
  mpgiPitanja: "https://mpgi.gov.hr/?id=176&page=1&url=print",
  mpgiTinjan: "https://mpgi.gov.hr/UserDocsImages/dokumenti/Propisi/Upute_misljenja/2024_3_21.ZPU.79.2.pdf",
  baskaVoda: "https://odluke.sudovi.hr/Document/View?id=a7677b81-269b-4dd7-bac5-07bb287edcff",
  presuda31: "https://odluke.sudovi.hr/Document/View?id=e43be9b5-2c66-4c43-b70f-6bc107efb56a",
  sudovi: "https://odluke.sudovi.hr/",
  vus: "https://narodne-novine.nn.hr/clanci/sluzbeni/full/2017_05_46_1091.html",
  sporrong: "https://echrlawyer.org/echr-case-law/sporrong-and-lonnroth-v-sweden/",
  obrazlozenje:
    "https://split.hr/Portals/0/Dokumenti/Prostorno-planska/Izmjene%20i%20dopune%20Generalnog%20urbanisti%C4%8Dkog%20plana%20Splita%20za%20ponovnu%20javnu%20raspravu/3_%20Obrazlozenje.pdf",
  izvjesce:
    "https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-i-strateskoj-studiji-o-utjecaju-na-okolis-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita",
  izvjescePdf:
    "https://split.hr/DesktopModules/EasyDNNNews/DocumentDownload.ashx?portalid=0&moduleid=2192&articleid=20457&documentid=15067",
  izvjescePpug1: "https://mpgi.gov.hr/UserDocsImages//dokumenti/Prostorno/Planovi/Izvjesca/Splitsko-dalmatinska//31.3.2025.Split.pdf",
  izvjescePpug2:
    "https://split.hr/DesktopModules/EasyDNNNews/DocumentDownload.ashx?portalid=0&moduleid=2192&articleid=23081&documentid=16564",
  izvjescePonovna:
    "https://split.hr/ukljuci-se/prostorno-planska-dokumentacija/izvjesca-o-javnim-raspravama/izvjesce-o-ponovnoj-javnoj-raspravi-o-prijedlogu-izmjena-i-dopuna-generalnog-urbanistickog-plana-splita-za-ponovnu-javnu-raspravu",
  konacni2017: "https://split.hr/gradska-uprava/gradsko-vijece/sjednice-gradskog-vijeca/lgs.axd?t=16&id=18388",
  poziv:
    "https://www.dalmacijadanas.hr/grad-split-otvara-javni-poziv-za-izmjene-gup-a-i-ppug-a-gradani-i-poslovni-subjekti-mogu-slati-svoje-inicijative/",
  ispu: "https://ispu.mgipu.hr/",
  dof2011: "https://geoportal.dgu.hr/services/dof/wms?SERVICE=WMS&REQUEST=GetCapabilities",
  dof2017: "https://geoportal.dgu.hr/services/inspire/orthophoto_2017/wms?SERVICE=WMS&REQUEST=GetCapabilities",
  dof2025: "https://geoportal.dgu.hr/services/inspire/orthophoto_2025_2026/wms?SERVICE=WMS&REQUEST=GetCapabilities",
  index:
    "https://www.index.hr/vijesti/clanak/split-rijesio-86-posto-zahtjeva-za-legalizaciju-u-drzavni-proracun-se-slilo-156-milijuna-kuna/872620.aspx",
  biljeskeDozvole:
    "https://github.com/tomislavmamic/kvart/blob/main/research_notes/UPU%20building%20ban%20in%20sanation%20areas/split_permit_practice.md",
  popisZgrada:
    "https://github.com/tomislavmamic/kvart/blob/main/research_notes/UPU%20building%20ban%20in%20sanation%20areas/new_buildings_east_split.csv",
  izvorniIzvjestaj:
    "https://github.com/tomislavmamic/kvart/blob/main/reports/UPU%20building%20ban%20in%20sanation%20areas.md",
  biljeske: "https://github.com/tomislavmamic/kvart/tree/main/research_notes/UPU%20building%20ban%20in%20sanation%20areas",
} as const;

const SADRZAJ: [string, string][] = [
  ["podrucja", "1. Jesu li područja ista?"],
  ["oznake", "2. Što znače oznake na listu 4.d i jesu li dobro ucrtane?"],
  ["vazeci-gup", "3. Što kaže važeći GUP?"],
  ["zakon", "4. Je li se promijenio zakon?"],
  ["prijedlog", "5. Što prijedlog mijenja?"],
  ["gradnja", "6. Je li se gradilo?"],
  ["zasto", "7. Zašto zabrana nastaje sada?"],
  ["sto-uciniti", "Što stanovnici mogu učiniti"],
  ["otvorena-pitanja", "Otvorena pitanja"],
  ["izvori", "Izvori i način izračuna"],
];

/** Vanjski izvor (zakon, izvješće, registar). */
function V({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="fokus text-emerald-700 underline">
      {children}
    </a>
  );
}

function Poglavlje({ id, naslov, children }: { id: string; naslov: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 id={id} className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-balance text-zinc-900">
        {naslov}
      </h2>
      <div className="mt-4 max-w-3xl space-y-4 leading-relaxed text-zinc-800">{children}</div>
    </section>
  );
}

function Podnaslov({ children }: { children: ReactNode }) {
  return <h3 className="pt-4 text-lg font-bold text-balance text-zinc-900">{children}</h3>;
}

/**
 * Dokazi i pojedinosti koji nisu nužni za glavnu nit: zatvoreni dok ih
 * čitatelj ne otvori, da stranica ostane pregledna.
 */
function Detaljnije({ naslov, children }: { naslov: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <summary className="fokus flex cursor-pointer list-none items-start gap-2 font-semibold text-emerald-800 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="mt-0.5 inline-block text-sm transition-transform group-open:rotate-90">
          ▸
        </span>
        <span>{naslov}</span>
      </summary>
      <div className="mt-3 space-y-4 text-[0.95rem]">{children}</div>
    </details>
  );
}

/** Kratak odgovor na početku poglavlja. */
function Odgovor({ children }: { children: ReactNode }) {
  return <p className="border-l-4 border-red-700 bg-white px-4 py-3 font-medium text-zinc-900">{children}</p>;
}

/** Doslovan citat iz GUP-a; izvor otvara isto mjesto u planu. */
function Citat({ id, izvor, children }: { id: string; izvor: string; children: ReactNode }) {
  return (
    <blockquote className="rounded-r-xl border-l-4 border-zinc-300 bg-white px-4 py-3 text-zinc-800">
      <p>„{children}”</p>
      <footer className="mt-1.5 text-sm text-zinc-500">
        <Navod id={id}>{izvor}</Navod>
      </footer>
    </blockquote>
  );
}

function Tablica({ zaglavlje, redovi, sirina = "min-w-[36rem]" }: { zaglavlje: ReactNode[]; redovi: ReactNode[][]; sirina?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className={`w-full ${sirina} border-collapse text-left text-sm`}>
        <thead>
          <tr className="border-b-2 border-zinc-300 text-zinc-600">
            {zaglavlje.map((z, i) => (
              <th key={i} scope="col" className="px-2 py-2 align-bottom font-semibold first:pl-0">
                {z}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {redovi.map((r, i) => (
            <tr key={i} className="border-b border-zinc-200 align-top">
              {r.map((c, j) => (
                <td key={j} className="px-2 py-2 first:pl-0 [&:not(:first-child)]:tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Oznaka = { boja: string; tekst: ReactNode; oblik?: "ploha" | "crta" | "tocka" | "prsten" | "mreza" | "srafura" | "obrub" };

/** Znak u tumaču: ploha, crta, točka ili šrafura kakvu crtaju listovi GUP-a. */
function Znak({ o }: { o: Oznaka }) {
  const oblik = o.oblik ?? "ploha";
  const klasa = {
    ploha: "h-3.5 w-5 rounded-sm border border-black/15",
    crta: "h-1 w-5 translate-y-1.5",
    tocka: "h-3.5 w-3.5 rounded-full border border-zinc-900",
    prsten: "h-3.5 w-3.5 rounded-full border-[3px] bg-white",
    mreza: "h-3.5 w-5 border",
    srafura: "h-3.5 w-5 border",
    obrub: "h-3.5 w-5 border-2 bg-white",
  }[oblik];
  const stil =
    oblik === "prsten" || oblik === "obrub"
      ? { borderColor: o.boja }
      : oblik === "mreza"
        ? {
            borderColor: o.boja,
            backgroundImage: `repeating-linear-gradient(0deg, ${o.boja} 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, ${o.boja} 0 1px, transparent 1px 4px)`,
          }
        : oblik === "srafura"
          ? { borderColor: o.boja, backgroundImage: `repeating-linear-gradient(90deg, ${o.boja} 0 1px, transparent 1px 4px)` }
          : { background: o.boja };
  return <span aria-hidden className={`mt-1 shrink-0 ${klasa}`} style={stil} />;
}

function Legenda({ oznake, uska = false }: { oznake: Oznaka[]; uska?: boolean }) {
  return (
    <ul className={`grid gap-x-5 gap-y-1.5 text-sm text-zinc-700 ${uska ? "mt-2" : "mt-3 max-w-3xl sm:grid-cols-2"}`}>
      {oznake.map((o, i) => (
        <li key={i} className="flex items-start gap-2">
          <Znak o={o} />
          <span>{o.tekst}</span>
        </li>
      ))}
    </ul>
  );
}

function Slika({
  src,
  sirina,
  visina,
  opis,
  legenda,
  children,
}: {
  src: string;
  sirina: number;
  visina: number;
  opis: string;
  legenda?: Oznaka[];
  children: ReactNode;
}) {
  return (
    <figure className="max-w-4xl pt-4">
      <a href={src} className="fokus block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={sirina} height={visina} alt={opis} loading="lazy" className="h-auto w-full rounded-xl border border-zinc-200" />
      </a>
      {legenda && <Legenda oznake={legenda} />}
      <figcaption className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">{children}</figcaption>
    </figure>
  );
}

interface Karta {
  src: string;
  naslov: ReactNode;
  opis: string;
  /** Znak iz tumača uz naslov, kad svaka karta prikazuje drugu oznaku. */
  znak?: Oznaka;
  /** Tumač samo te karte, kad isti znak na dvama listovima znači različito. */
  legenda?: Oznaka[];
}

/**
 * Karte istog isječka jedna uz drugu: par (važeći GUP i prijedlog) ili
 * mreža 2 × 2. Na širem zaslonu izlaze iz stupca teksta na punu širinu
 * stranice, na mobitelu su jedna ispod druge.
 */
function ParKarata({ karte, legenda, children }: { karte: Karta[]; legenda: Oznaka[]; children: ReactNode }) {
  return (
    <figure className="pt-4 lg:w-[56rem] xl:-ml-16 xl:w-[64rem]">
      <div className="grid gap-4 lg:grid-cols-2">
        {karte.map((k) => (
          <div key={k.src}>
            <p className="mb-1.5 flex items-start gap-2 text-sm font-semibold text-zinc-900">
              {k.znak && <Znak o={k.znak} />}
              <span>{k.naslov}</span>
            </p>
            <a href={k.src} className="fokus block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={k.src} width={1300} height={750} alt={k.opis} loading="lazy" className="h-auto w-full rounded-xl border border-zinc-200" />
            </a>
            {k.legenda && <Legenda oznake={k.legenda} uska />}
          </div>
        ))}
      </div>
      <div className="xl:ml-16">
        <Legenda oznake={legenda} />
        <figcaption className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-600">{children}</figcaption>
      </div>
    </figure>
  );
}

const PODLOGA: Oznaka[] = [
  { boja: "rgb(120,120,120)", tekst: "zgrade (gradski 3D model)" },
  { boja: "rgb(150,150,150)", tekst: "katastarske čestice", oblik: "crta" },
];

export default async function AnalizaPage() {
  const [zbroj, zemljiste, sporne] = await Promise.all([ucitajZbrojZabrane(), zemljisteZaStanovanje(), ucitajSporne()]);
  const broj = (n: number) => n.toLocaleString("hr-HR");
  const ha1 = (x: number) => x.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const plohe = sporne.plohe;
  const manjina = plohe.filter((p) => p.manjina);
  const vecina = plohe.filter((p) => !p.manjina);
  const ploha = (upu: number) => manjina.find((p) => p.upu === upu);
  const oznake4d = ["sanacija", "preobrazba", "neuredeno", "bez"] as const;
  const ppug4d = (r: "I" | "N" | "U") => {
    const red = sporne.ppug_4d[r];
    const ukupno = oznake4d.reduce((z, o) => z + red[o].ha, 0);
    const posto = (x: number) => (x === 0 ? "–" : x / ukupno < 0.005 ? "< 1 %" : `${Math.round((100 * x) / ukupno)} %`);
    return { ukupno, cestice: oznake4d.reduce((z, o) => z + red[o].cestice, 0), posto: (o: (typeof oznake4d)[number]) => posto(red[o].ha) };
  };
  const z = zemljiste[2025];
  const h = (x: number) => ha(x * 1e4);
  const neizgradjene = zbroj.neizgradjene.cestice;
  const djelomicno = zbroj.djelomicno.cestice;
  const poUpu = zbroj.po_upu
    .filter((r) => r.broj > 0 && r.naziv)
    .sort((a, b) => b.slobodno_ha - a.slobodno_ha)
    .slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">
        <Link href="/planovi" className="fokus underline">
          Planovi
        </Link>{" "}
        · analiza, 27. rujna 2026., brojke osvježene 29. rujna 2026.
      </p>
      <h1 className="mt-1 max-w-3xl text-2xl font-bold text-balance sm:text-3xl">
        Gradnju ne zaustavlja novi zakon, nego nova oznaka na karti
      </h1>
      <p className="mt-3 max-w-3xl text-lg text-zinc-600">
        Zašto prijedlog izmjena GUP-a iz 2025. zabranjuje novu gradnju u istočnom Splitu kad i važeći GUP ondje propisuje UPU, a
        posljednjih se godina ipak gradilo s dozvolama?
      </p>
      <p className="mt-3 max-w-3xl text-sm text-zinc-500">
        Pitanje je postavio stanovnik istočnog Splita (Dračevac, Mostine, Bilice); podaci o dozvolama obuhvaćaju i susjedna istočna
        prigradska naselja. Točkasto podcrtan tekst otvara doslovan tekst onog mjesta u GUP-u na koje se pozivamo, a odande se stiže do cijelog
        plana i izvornika na split.hr.
      </p>

      <div className="mt-6 max-w-3xl rounded-xl bg-white px-5 py-4 leading-relaxed text-zinc-800">
        <p className="font-semibold text-zinc-900">Ukratko</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Zabranu ne donosi novi zakon, nego nova oznaka na karti.</strong> Prijedlog izmjena GUP-a iz travnja 2025. označava istočni Split kao područje urbane sanacije ili neuređeni dio građevinskog područja.
          </li>
          <li>
            <strong>Na tako označenom zemljištu zakon ne dopušta nove zgrade dok se ne donese UPU.</strong> To pravilo vrijedi od 2014., a zadržava ga i novi zakon, na snazi od 1. siječnja 2026. U neuređenom dijelu iznimka je lokacijska dozvola za zgradu uz postojeću javnu cestu, s rješenjem odvodnje.
          </li>
          <li>
            <strong>Važeći GUP za gotovo isto područje već propisuje UPU, ali to zemljište ne označava ni kao sanaciju ni kao neuređeni dio.</strong> Zato Grad ondje izdaje dozvole: od 2016. oko 57 za nove stambene zgrade, od toga šest u Dračevcu.
          </li>
          <li>
            <strong>Gradilo se, ali manje nego što se čini.</strong> Oko 4 % zgrada na tom području nastalo je nakon 2017., a većina kuća koje se doimaju novima stajala je već 2011. i poslije je ozakonjena.
          </li>
          <li>
            <strong>U cijelom gradu zabrana će pogoditi {h(zbroj.slobodno_ha)} ha slobodnog zemljišta</strong>, od čega {h(zbroj.neizgradjene.ha)} ha na {neizgradjene.toLocaleString("hr-HR")} {imenicaUz(neizgradjene, ["neizgrađenoj čestici", "neizgrađene čestice", "neizgrađenih čestica"])}.
          </li>
          <li>
            <strong>Oznake nisu ucrtane dosljedno ni prema kriteriju samoga Grada ni prema zakonu.</strong> Najmanje {broj(sporne.pristup.cestice)} čestica uz ceste čija je čestica široka barem 4 m označeno je kao neuređeni dio, a u trima plohama urbane sanacije ozakonjene zgrade prema registru nisu većina.
          </li>
          <li>
            <strong>Oznaku bira Grad, a ne zakon.</strong> Javni poziv za inicijative za izmjene GUP-a traje do 16. studenoga 2026. i prilika je da se zatraži drukčija oznaka.
          </li>
        </ul>
        <p className="mt-3 text-sm text-zinc-500">Izmjene GUP-a još nisu donesene, pa ta zabrana danas ne vrijedi.</p>
      </div>

      <div className="mt-4 max-w-3xl">
        <Detaljnije naslov="Dokumenti i njihovo stanje">
          <Tablica
            sirina="min-w-[42rem]"
            zaglavlje={["Dokument", "Stanje u rujnu 2026.", "Što donosi"]}
            redovi={[
              [
                <>GUP Splita, pročišćeni tekst („Službeni glasnik Grada Splita”, br. 55/14, s izmjenama zaključno s br. 41/14)</>,
                <>
                  <strong>Na snazi.</strong> Od 2014. nije mijenjan ni autentično tumačen (<V href={IZVOR.gupSplit}>split.hr</V>).
                </>,
                <>
                  <Navod id="istok-4c-2008">List 4.c</Navod> iz 2008. s obvezom izrade UPU-a; <Navod id="pravilo-3-1-2015">čl. 73.</Navod> (urbano pravilo 3.1), <Navod id="clanak-104-2015">čl. 104.</Navod> i <Navod id="clanak-105-2015">čl. 105.</Navod>
                </>,
              ],
              [
                <>Zakon o prostornom uređenju i Zakon o gradnji (NN 155/25)</>,
                <>
                  <strong>Na snazi od 1. siječnja 2026.</strong> (<V href={IZVOR.zpu155}>ZPU</V>, <V href={IZVOR.zog155}>ZoG</V>)
                </>,
                <>Do donošenja UPU-a zabranjuju izdavanje dozvole za novu zgradu ondje gdje zakon propisuje UPU; izuzete su rekonstrukcija i zamjena postojeće građevine, a u neuređenom dijelu i lokacijska dozvola za novu zgradu uz postojeću javnu cestu (ZPU, čl. 180. st. 2. t. 3.).</>,
              ],
              [
                <>Izmjene i dopune GUP-a, prijedlog za ponovnu javnu raspravu (travanj 2025.)</>,
                <>
                  <strong>Samo prijedlog.</strong> Postupak je mirovao 2025. i 2026.; izvješće o ponovnoj javnoj raspravi potpisano je 2. i 3. rujna 2026. Na temelju čl. 236. st. 2. novog ZPU-a (NN 155/25) postupak se dovršava po starom zakonu (NN 153/13) (<V href={IZVOR.izvjescePonovna}>izvješće</V>).
                </>,
                <>
                  <Navod id="istok-4d-2025">List 4.d</Navod> s ispunom urbane sanacije i neuređenih dijelova; <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod> i <Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>
                </>,
              ],
              [
                <>Izmjene i dopune PPUG-a, prijedlog za ponovnu javnu raspravu (travanj 2025.)</>,
                <>
                  <strong>Samo prijedlog.</strong> Izvješće o ponovnoj javnoj raspravi potpisano je 2. rujna 2026. (<V href={IZVOR.izvjescePpug2}>izvješće</V>).
                </>,
                <>
                  Neuređeni dio po katastarskim česticama na listovima građevinskih područja 1:5000 (<Navod id="istok-ppug-2025">list 4.4</Navod>); UPU obvezan samo za neuređeni dio (<Navod id="odredba-ppug-86-2025">čl. 86. st. 8.</Navod>).
                </>,
              ],
              [
                <>Javni poziv za inicijative za izmjene PPUG-a i GUP-a</>,
                <>
                  <strong>1. listopada – 16. studenoga 2026.</strong> (<V href={IZVOR.poziv}>Dalmacija Danas, 25. 9. 2026.</V>)
                </>,
                <>Sljedeća formalna prilika za stanovnike.</>,
              ],
            ]}
          />
        </Detaljnije>
      </div>

      <nav aria-label="Sadržaj" className="mt-8 max-w-3xl rounded-xl bg-white px-4 py-3 text-sm">
        <p className="font-semibold text-zinc-900">Sadržaj</p>
        <ol className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {SADRZAJ.map(([id, naslov]) => (
            <li key={id}>
              <a href={`#${id}`} className="fokus text-emerald-700 hover:underline">
                {naslov}
              </a>
            </li>
          ))}
        </ol>
      </nav>


      <Poglavlje id="podrucja" naslov="1. Jesu li to doista ista područja? Gotovo jesu">
        <Odgovor>U istočnom Splitu jesu, gotovo u potpunosti. Gdje se karte razlikuju, prijedlog je blaži, a ne stroži.</Odgovor>
        <p>Prema važećem GUP-u plan užeg područja potreban je za gradnju ondje gdje su ispunjena sva tri sljedeća uvjeta:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            zemljište je unutar obuhvata UPU-a ili DPU-a ucrtanog na <Navod id="istok-4c-2008">listu 4.c</Navod>;
          </li>
          <li>
            na njega se primjenjuje neko od pravila 3.x za niskokonsolidirana područja (<Navod id="istok-4b-2014">list 4.b</Navod>);
          </li>
          <li>
            ondje nije na snazi nijedan plan užeg područja (<Navod id="clanak-104-2015">čl. 104.</Navod> i <Navod id="clanak-105-2015">105.</Navod>).
          </li>
        </ul>
        <p>
          Prema prijedlogu UPU je obvezan samo ondje gdje je zemljište na <Navod id="istok-4d-2025">listu 4.d</Navod> označeno kao područje urbane sanacije, urbane preobrazbe ili neuređeni dio građevinskog područja (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). U ostatku obuhvata UPU je samo preporučen (<Navod id="preporuka-plana-2025">čl. 103. st. 4.</Navod>).
        </p>
        <Podnaslov>Što je ucrtano na listovima</Podnaslov>
        <p>Karte prikazuju isti isječak istočnog Splita, u bojama samih listova. U svakom paru prva karta prikazuje važeći GUP, a druga prijedlog.</p>
        <ParKarata
          karte={[
            {
              src: "/gup/analiza/obveza-vazeci.webp",
              naslov: (
                <>
                  GUP na snazi · <Navod id="istok-4c-2008">list 4.c</Navod> (2008.)
                </>
              ),
              opis: "List 4.c važećeg GUP-a: obveza izrade UPU-a propisana je za gotovo cijeli istočni Split.",
              legenda: [
                { boja: "#003fff", oblik: "mreza", tekst: "obveza izrade urbanističkog plana uređenja (UPU)" },
                { boja: "#ff0000", oblik: "srafura", tekst: "obveza izrade detaljnog plana uređenja (DPU)" },
              ],
            },
            {
              src: "/gup/analiza/obuhvat-prijedlog.webp",
              naslov: (
                <>
                  Prijedlog 2025. · <Navod id="istok-4d-2025">list 4.d</Navod>
                </>
              ),
              opis: "List 4.d prijedloga: obuhvati UPU-a gotovo su isti kao na listu 4.c važećeg GUP-a.",
              legenda: [
                { boja: "#003fff", oblik: "mreza", tekst: "obuhvat izrade urbanističkog plana uređenja (UPU)" },
                { boja: "#ff0000", oblik: "srafura", tekst: "važeći prostorni plan užeg područja" },
              ],
            },
          ]}
          legenda={PODLOGA}
        >
          <strong>Slika 1.</strong> Obuhvati UPU-a gotovo su isti u važećem GUP-u i u prijedlogu.
        </ParKarata>
        <ParKarata
          karte={[
            {
              src: "/gup/analiza/prijedlog-sanacija.webp",
              znak: { boja: "#9fff7f", tekst: "" },
              naslov: "Područje urbane sanacije · 51,8 ha na isječku",
              opis: "Područja urbane sanacije prema listu 4.d prijedloga: veći dio Dračevca 2, Mostina i sjevernog Harakovca.",
            },
            {
              src: "/gup/analiza/prijedlog-neuredeno.webp",
              znak: { boja: "#ffffaf", tekst: "" },
              naslov: "Neuređeni dio građevinskog područja · 70,3 ha na isječku",
              opis: "Neuređeni dijelovi građevinskog područja prema listu 4.d prijedloga: neizgrađeno zemljište Harakovca, Dračevca i Mostina.",
            },
            {
              src: "/gup/analiza/prijedlog-preobrazba.webp",
              znak: { boja: "#ffbf00", tekst: "" },
              naslov: "Područje urbane preobrazbe · 20,9 ha na isječku",
              opis: "Područja urbane preobrazbe prema listu 4.d prijedloga: na ovom isječku gotovo samo Karepovac.",
            },
            {
              src: "/gup/analiza/prijedlog-ostatak.webp",
              znak: { boja: "#003fff", oblik: "mreza", tekst: "" },
              naslov: "Ostatak obuhvata UPU-a: plan samo preporučen · 28,1 ha na isječku",
              opis: "Dijelovi obuhvata UPU-a iz prijedloga koji nisu ni urbana sanacija, ni preobrazba, ni neuređeni dio: većinom ulice i poslovne zone u Mostinama.",
            },
          ]}
          legenda={PODLOGA}
        >
          <strong>Slika 2.</strong> Zabrana gradnje do donošenja UPU-a vrijedit će samo na područjima s prvih triju karata. Četvrta karta prikazuje ostatak obuhvata, u kojem je UPU samo preporučen.
        </ParKarata>
        <ParKarata
          karte={[
            {
              src: "/gup/analiza/pravilo-3-1-vazeci.webp",
              naslov: (
                <>
                  GUP na snazi · <Navod id="istok-4b-2014">list 4.b</Navod> (2014.)
                </>
              ),
              opis: "Urbano pravilo 3.1 prema važećem GUP-u u istočnom Splitu.",
              legenda: [
                {
                  boja: "#ff00ff",
                  tekst: (
                    <>
                      3.1 <Navod id="pravilo-3-1-naslov-2015">„Sanacija, uređivanje i urbana obnova djelomično izgrađenih prostora mješovite izgradnje”</Navod>
                    </>
                  ),
                },
              ],
            },
            {
              src: "/gup/analiza/pravilo-3-1-prijedlog.webp",
              naslov: (
                <>
                  Prijedlog 2025. · <Navod id="istok-up-2025">list 4.c</Navod>
                </>
              ),
              opis: "Urbano pravilo 3.1 prema prijedlogu iz 2025., u gotovo istim granicama.",
              legenda: [{ boja: "#ff00ff", tekst: "3.1 „Sanacija, uređivanje i urbana preobrazba djelomično izgrađenih prostora mješovite izgradnje”" }],
            },
          ]}
          legenda={PODLOGA}
        >
          <strong>Slika 3.</strong> Pravilo 3.1 primjenjuje se u prijedlogu na gotovo isto zemljište kao u važećem GUP-u. Promijenio mu se naziv: „urbana obnova” postala je „urbana preobrazba”.
        </ParKarata>
        <ParKarata
          karte={[
            {
              src: "/gup/analiza/pravilo-3-2-vazeci.webp",
              naslov: (
                <>
                  GUP na snazi · <Navod id="istok-4b-2014">list 4.b</Navod> (2014.)
                </>
              ),
              opis: "Urbano pravilo 3.2 prema važećem GUP-u, uglavnom u Harakovcu.",
            },
            {
              src: "/gup/analiza/pravilo-3-2-prijedlog.webp",
              naslov: (
                <>
                  Prijedlog 2025. · <Navod id="istok-up-2025">list 4.c</Navod>
                </>
              ),
              opis: "Urbano pravilo 3.2 prema prijedlogu iz 2025., u gotovo istim granicama.",
            },
          ]}
          legenda={[
            {
              boja: "#5ba0b8",
              tekst: (
                <>
                  3.2 „Nova regulacija na pretežito neizgrađenom prostoru” (<Navod id="pravilo-3-2-2015">čl. 74.</Navod>)
                </>
              ),
            },
            ...PODLOGA,
          ]}
        >
          <strong>Slika 4.</strong> Pravilo 3.2 primjenjuje se u prijedlogu na gotovo isto zemljište kao u važećem GUP-u.
        </ParKarata>
        <ParKarata
          karte={[
            {
              src: "/gup/analiza/pravilo-3-4-vazeci.webp",
              naslov: (
                <>
                  GUP na snazi · <Navod id="istok-4b-2014">list 4.b</Navod> (2014.)
                </>
              ),
              opis: "Urbano pravilo 3.4 prema važećem GUP-u u istočnom Splitu.",
            },
            {
              src: "/gup/analiza/pravilo-3-4-prijedlog.webp",
              naslov: (
                <>
                  Prijedlog 2025. · <Navod id="istok-up-2025">list 4.c</Navod>
                </>
              ),
              opis: "Urbano pravilo 3.4 prema prijedlogu iz 2025., u gotovo istim granicama.",
            },
          ]}
          legenda={[{ boja: "#00ffbf", tekst: "3.4 „Zaštitne i vrijedne pejzažne površine”" }, ...PODLOGA]}
        >
          <strong>Slika 5.</strong> Pravilo 3.4 primjenjuje se u prijedlogu na gotovo isto zemljište kao u važećem GUP-u. Pravila 3.3, 3.5 i 3.6 na ovom se isječku ne pojavljuju.
        </ParKarata>

        <Podnaslov>Koliko se poklapaju</Podnaslov>
        <p>
          <strong>Važeći GUP već propisuje UPU za 93 % zemljišta na kojem ga za gradnju traži i prijedlog.</strong> Ondje gdje se karte razlikuju, prijedlog je blaži: na oko 21,7 ha za koje važeći GUP propisuje UPU samo ga preporučuje, a novu obvezu UPU-a uvodi na tek 7,8 ha, gotovo isključivo uz rub Karepovca.
        </p>
        <Tablica
          zaglavlje={["Područje", "UPU potreban prema važećem GUP-u (ha)", "UPU potreban prema prijedlogu (ha)", "Prema obama planovima (ha)", "U prijedlogu: sanacija / neuređeno (ha)"]}
          redovi={[
            ["UPU 18 Dračevac 2", "28,0", "25,7", "25,7", "13,5 / 13,0"],
            ["UPU 17 Mostine", "43,2", "33,0", "32,9", "19,0 / 18,1"],
            ["UPU 19 Harakovac", "47,8", "39,1", "39,0", "10,8 / 29,6"],
            [<strong key="c">Cijelo promatrano područje</strong>, "119,3", "105,5", "97,6", "43,5 sanacije"],
          ]}
        />
        <Detaljnije naslov="Kako smo mjerili i kolike su razlike u cijelom gradu">
          <p>
            Sva su tri lista iz PDF-ova Grada prenesena na rešetku od 2 m. Od službenih granica planova odstupaju za 4 do 7 m (medijan), a pomak bilo kojeg od njih za 10 m mijenja udjele u nastavku za najviše dva postotna boda.
          </p>
          <p>
            Promatrano područje (187,3 ha) obuhvaća kvartove Dračevac i Bilice te UPU 17 Mostine, UPU 18 Dračevac 2 i UPU 19 Harakovac iz prijedloga. Ondje se obuhvati UPU-a iz važećeg GUP-a i iz prijedloga gotovo potpuno poklapaju: <strong>Jaccardov indeks je 0,98</strong> (presjek podijeljen unijom, pri čemu 1 znači potpuno poklapanje), odnosno od 137,3 ha i 140,1 ha zajedničko je 137,2 ha. <strong>Važeći GUP već propisuje UPU za 93 % zemljišta na kojem ga za gradnju traži i prijedlog.</strong> <strong>99,4 % urbane sanacije iz prijedloga nalazi se unutar obuhvata za koji važeći GUP već propisuje UPU</strong>, a na 74 % te površine primjenjuje se urbano pravilo 3.1. U UPU-u Dračevac 2 iz prijedloga pravilo 3.1 primjenjuje se na 97 % zemljišta.
          </p>
          <p>
            Ondje gdje se karte razlikuju, prijedlog obvezu češće ukida nego što je uvodi. <strong>Prijedlog samo preporučuje UPU na oko 21,7 ha za koje ga važeći GUP propisuje</strong>, pa će se ondje graditi neposrednom provedbom GUP-a. Prema namjeni s lista 1 to su većinom gospodarske zone (I, K) u Mostinama i Harakovcu; taj udio još nije provjeren prema tumaču znakova. <strong>Novu obvezu UPU-a prijedlog uvodi na samo 7,8 ha</strong>, gotovo sve uz rub gradskog projekta Karepovac. U cijelom se gradu karte razlikuju mnogo više (Jaccardov indeks 0,51): prijedlog ukida obvezu na oko 350 ha konsolidiranog grada, a dodaje veliko područje urbane preobrazbe na zemljištu gradskih projekata poput Kopilice i brodogradilišta. Ipak, i na razini cijelog grada važeći GUP već propisuje UPU za 99 % područja urbane sanacije iz prijedloga koja su izvan važećih planova.
          </p>
          <Slika
            src="/gup/analiza/rezim-istok.webp"
            sirina={1950}
            visina={1125}
            opis="Karta istočnog Splita: na gotovo cijelom području Dračevca 2, Mostina i Harakovca UPU je potreban prema obama planovima, a na Karepovcu samo prema prijedlogu."
            legenda={[
              { boja: "rgba(213,94,0,0.75)", tekst: "UPU potreban prema obama planovima" },
              { boja: "rgba(0,114,178,0.75)", tekst: "UPU potreban samo prema važećem GUP-u (u prijedlogu preporučen)" },
              { boja: "rgba(230,159,0,0.75)", tekst: "UPU potreban samo prema prijedlogu" },
              { boja: "rgba(160,190,215,0.8)", tekst: "konsolidirano područje u obuhvatu UPU-a: gradi se bez UPU-a" },
              { boja: "rgba(190,160,220,0.8)", tekst: "važeći UPU ili DPU (stvarne granice)" },
              { boja: "rgb(200,0,200)", tekst: "granice kvartova", oblik: "crta" },
            ]}
          >
            <strong>Slika 6.</strong> Gdje je u istočnom Splitu za gradnju potreban UPU (rešetka od 2 m, podloga: ortofoto 2025.). Na gotovo cijelom području Dračevca 2, Mostina i Harakovca UPU propisuju oba plana. Plavo su označene izgrađene poslovne čestice i prometni koridori, a narančasti pojas na istoku je Karepovac. Izvori: <Navod id="istok-4c-2008">list 4.c</Navod> i <Navod id="istok-4b-2014">list 4.b</Navod> važećeg GUP-a, <Navod id="istok-4d-2025">list 4.d</Navod> prijedloga.
          </Slika>
        </Detaljnije>
        <p>
          Jedna ograda vrijedi za cijelu analizu: to što važeći GUP ondje propisuje UPU kao uvjet za gradnju naše je tumačenje njegova teksta, a ne opis prakse odjela koji izdaje dozvole. To tumačenje ispituje treće poglavlje, a praksu šesto.
        </p>
      </Poglavlje>

      <Poglavlje id="oznake" naslov="2. Što znače oznake na listu 4.d i jesu li dobro ucrtane?">
        <Odgovor>
          Zakon definira sve tri oznake, a za urbanu sanaciju daje i provjerljiv uvjet: da na području pretežu ozakonjene zgrade. Grad je provjerljiv kriterij naveo samo za neuređeni dio. Provjera prema tim dvama kriterijima pokazuje da oznake nisu ucrtane dosljedno: dio zemljišta označen je iako ne ispunjava kriterij, a zemljište sa sličnim obilježjima drugdje nije označeno.
        </Odgovor>
        <Tablica
          sirina="min-w-[46rem]"
          zaglavlje={["Oznaka na listu 4.d", "Što kaže zakon", "Kako ju je odredio Grad", "Kojim je planom ucrtana"]}
          redovi={[
            [
              <strong key="s">Područje urbane sanacije</strong>,
              <>
                „skup planskih mjera i uvjeta kojima se stanje prostornog nereda dovodi u funkcionalno i planski uređeno stanje” (<V href={IZVOR.zpu155}>ZPU, čl. 19. t. 61.</V>); mjere urbane sanacije propisuju se „za područja na kojima se pretežito nalaze zgrade ozakonjene na temelju posebnog zakona” (čl. 77. st. 5.)
              </>,
              <>
                „većinom nisko konsolidirana područja na istočnom dijelu grada, na kojima je prisutna dugogodišnja nezakonita gradnja” (<Navod id="clanak-106-sanacija-2025">čl. 106. st. 2.</Navod>; <Navod id="obrazlozenje-sanacija-2025">Obrazloženje, § 2.1.1.2</Navod>); na listu su označene samo „veće homogene površine”. Nisu navedeni ni prag (npr. udio nezakonitih zgrada) ni podaci iz kojih je oznaka izvedena.
              </>,
              "GUP, list 4.d",
            ],
            [
              <strong key="n">Neuređeni dio građevinskog područja</strong>,
              "neizgrađeni dio građevinskog područja na kojem nije izgrađena planirana osnovna infrastruktura: odvodnja otpadnih voda i pristupna prometna površina",
              <>
                „mogućnost priključenja na postojeću prometnu površinu u funkciji, minimalne širine 4 m” (<Navod id="obrazlozenje-neuredeno-2025">Obrazloženje, § 2.1.1.3</Navod>; <Navod id="clanak-106-neuredeno-2025">čl. 106. st. 1.</Navod>). PPUG ga crta na neizgrađenom zemljištu bez izgrađene ceste i odvodnje (<Navod id="odredba-ppug-6-2025">PPUG, čl. 6.</Navod>).
              </>,
              <>
                prijedlog izmjena PPUG-a, <Navod id="istok-ppug-2025">listovi građevinskih područja</Navod> u mjerilu 1:5000, po katastarskim česticama; GUP ga samo preuzima
              </>,
            ],
            [
              <strong key="p">Područje urbane preobrazbe</strong>,
              <>
                „skup planskih mjera i uvjeta kojima se bitno mijenjaju obilježja izgrađenog dijela građevinskog područja” (<V href={IZVOR.zpu155}>ZPU, čl. 19. t. 60.</V>)
              </>,
              <>
                gradski projekti, pojedinačni zahvati (P1, P15, P20, P34, P35 i P36) i poimence nabrojana područja: brodogradilište, Sjeverna luka, proizvodne zone Dujmovače, Smokovika i Bilica, dio TTTS-a i Turska kula (<Navod id="clanak-106-preobrazba-2025">čl. 106. st. 4.</Navod>)
              </>,
              "GUP, list 4.d",
            ],
            [
              <strong key="o">Ostatak obuhvata UPU-a</strong>,
              "Zakon ga ne poznaje: UPU ondje nije obvezan.",
              <>
                „područja koja ne spadaju u nijednu od ove tri kategorije” (<Navod id="obrazlozenje-preporuka-2025">Obrazloženje, § 2.1.1.4</Navod>). Kriterij nije naveden.
              </>,
              "GUP, list 4.d",
            ],
          ]}
        />
        <p>
          Neuređeni dio određen je po katastarskim česticama, ali ne u GUP-u, nego u prijedlogu izmjena PPUG-a: na njegovim <Navod id="istok-ppug-2025">listovima građevinskih područja</Navod> u mjerilu 1:5000 šrafiran je čestica po čestica (<Navod id="legenda-ppug-2025">tumač znakova</Navod>). List 4.d GUP-a to samo prenosi: kad se oba lista prenesu na istu podlogu, neuređeni se dio poklapa na 98 % površine. Urbanu sanaciju i urbanu preobrazbu, međutim, određuje samo <Navod id="clanak-103-karta-2025">list 4.d</Navod> u mjerilu 1:10.000, bez katastarske podloge. Na tom je listu i popis svih 34 UPU-a pod naslovom „Popis planova užeg područja za koje je propisana obveza izrade”, a da je izrada obvezna samo za urbanu sanaciju, preobrazbu i neuređeni dio, kaže tek bilješka. Granica urbane sanacije ili preobrazbe prema zemljištu na kojem je UPU samo preporučen presijeca, prema našem prijenosu lista, 155 čestica od najmanje 250 m² u gradu, od toga 50 na isječku istočnog Splita, pa vlasnici tih čestica s lista ne mogu pouzdano iščitati koje pravilo za njih vrijedi.
        </p>

        <Podnaslov>Kako su čestice razvrstane i kako su iz neuređenog dijela izlazile</Podnaslov>
        <p>
          Metodu razvrstavanja Grad nije objavio. Obrazloženje PPUG-a kaže samo da je podjela na izgrađeni, neizgrađeni i neuređeni dio napravljena „sukladno stvarnom stanju na terenu prikazanom na službenoj državnoj digitalnoj ortofoto karti i na temelju recentnih zračnih snimaka” (<Navod id="obrazlozenje-ppug-metoda-2025">Obrazloženje PPUG-a, str. 16</Navod>), a odredbe da je izgrađeni dio „utvrđen na temelju podataka iz ortofoto snimke iz 2021. godine” (<Navod id="odredba-ppug-6-izgradjeno-2025">PPUG, čl. 6. st. 2.</Navod>). Popisa čestica, podataka o kanalizaciji ni mjerenja širine cesta nema.
        </p>
        <p>
          Više otkrivaju odgovori na primjedbe iz dviju javnih rasprava o PPUG-u (<V href={`${IZVOR.izvjescePpug1}#page=147`}>izvješće iz ožujka 2025.</V> i <V href={`${IZVOR.izvjescePpug2}#page=97`}>izvješće iz rujna 2026.</V>):
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Presudno je je li cesta do čestice izvedena, a ne koliko je široka.</strong> Grad je prihvatio primjedbu za čestice uz „pristupni put širine 3 m” (br. 37), a odbio vlasnicu koja je navela put od 4 m: „Nesporno je da postoji katastarska čestica puta, ali prema dostupnim podacima, sama prometna površina nije izgrađena” (<V href={`${IZVOR.izvjescePpug2}#page=99`}>br. 7, str. 99</V>).
          </li>
          <li>
            <strong>Pristup s državne ceste ne računa se</strong>: „Postojeće pristupe s državne ceste ne treba dodatno opterećivati” (<V href={`${IZVOR.izvjescePpug1}#page=162`}>br. 80, 89 i 100</V>). Računa se, naprotiv, pristup preko susjedne čestice istog vlasnika (br. 65, 72, 75, 79, 99 i 102).
          </li>
          <li>
            <strong>Zemljište je iz neuređenog dijela izlazilo samo na zahtjev vlasnika.</strong> Prihvaćeno je 14 primjedbi, većinom zato što su vlasnici pokazali da do čestica vodi izvedena cesta ili da im pristup osigurava susjedna čestica, a četiri djelomično. Grad je dokaz i sam tražio, primjerice „recentnu fotografiju na kojoj se vidi izvedena cesta”.
          </li>
          <li>
            <strong>Urbanu sanaciju u tim raspravama nitko nije osporio.</strong> Grad je objasnio da je to samo zakonski naziv za dosadašnju „urbanu obnovu” (<V href={`${IZVOR.izvjescePdf}#page=213`}>izvješće o GUP-u, br. 107, str. 213</V>).
          </li>
        </ul>
        <p>
          Grad vlasnicima neuređenih čestica preporučuje i put mimo UPU-a: lokacijsku dozvolu za novu zgradu uz postojeću javnu cestu, s rješenjem odvodnje (novi ZPU, čl. 180. st. 2. t. 3.; <a href="#zakon" className="fokus text-emerald-700 underline">4. poglavlje</a>). U urbanoj sanaciji do donošenja UPU-a zakon dopušta samo rekonstrukciju i zamjenu (čl. 106. st. 3.), pa ta iznimka ondje, prema našem čitanju, ne pomaže.
        </p>
        <p>
          Podjelu s lista PPUG-a slijedi i list 4.d. Za čestice od najmanje 250 m² u obuhvatima propisanih UPU-a izvan važećih planova usporedili smo razred na listu PPUG-a s oznakom na listu 4.d (udio površine):
        </p>
        <Tablica
          sirina="min-w-[40rem]"
          zaglavlje={["Na listu PPUG-a", "Čestica", "ha", "Urbana sanacija", "Urbana preobrazba", "Neuređeni dio", "Bez oznake"]}
          redovi={(
            [
              ["I", "izgrađeno"],
              ["N", "neizgrađeno, bez šrafure"],
              ["U", "neuređeno (šrafirano)"],
            ] as const
          ).map(([r, naziv]) => {
            const t = ppug4d(r);
            return [naziv, broj(t.cestice), ha1(t.ukupno), ...oznake4d.map((o) => t.posto(o))];
          })}
        />
        <p>
          Urbanu sanaciju i preobrazbu list 4.d crta gotovo isključivo na zemljištu koje PPUG vodi kao izgrađeno, a neuređeni dio na onom koje PPUG šrafira. Ni izgrađeno nije svuda označeno: {ppug4d("I").posto("bez")} njegove površine u obuhvatima UPU-a nema oznake. Neizgrađeno zemljište bez šrafure oznake gotovo nikad nema, pa se na njemu, iako je u obuhvatu UPU-a, gradi neposrednom provedbom GUP-a (<Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>). Tako prazna čestica koju PPUG vodi kao neizgrađenu može ostati bez oznake, dok je susjedna čestica s ozakonjenom kućom u urbanoj sanaciji, gdje su do UPU-a dopuštene samo rekonstrukcija i zamjena. Je li čestica izgrađena, dakle, ne odlučuje GUP, nego PPUG, prema ortofoto snimci iz 2021.
        </p>

        <Podnaslov>Neuređeni dio: zemljište uz ceste na česticama širokim barem 4 m</Podnaslov>
        <p>
          Za neuređeni dio Grad je naveo jasan kriterij, koji se može provjeriti. Za svaku cestu iz gradskog registra nerazvrstanih cesta i za državnu cestu izmjerili smo širinu katastarske čestice na kojoj leži, a zatim utvrdili koje čestice u neuređenom dijelu graniče s tom cestom. Brojali smo samo čestice od najmanje 250 m² na kojima zabrana pogađa novu gradnju, u cijelom obuhvatu GUP-a.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Od {broj(sporne.neuredeno.cestice)} takvih čestica u neuređenom dijelu (s {ha1(sporne.neuredeno.ha)} ha slobodnog zemljišta) <strong>najmanje {broj(sporne.pristup.cestice)} ({ha1(sporne.pristup.ha)} ha) graniči s registriranom cestom čija je čestica široka barem 4 m</strong>. Ako je i sama cesta toliko široka i u funkciji, te čestice prema kriteriju Grada ne pripadaju neuređenom dijelu. Na manje od 15 m od {broj(sporne.pristup_kanal)} tih čestica prolazi i mješovita ili fekalna kanalizacija, što je važno jer zakon uz pristup traži i odvodnju. Još {broj(sporne.cesta.cestice)} čestica ({ha1(sporne.cesta.ha)} ha) graniči s cestom koje nema u registru, a ima je u drugim gradskim slojevima ili u OpenStreetMapu, ili s cestom iz registra kojoj se širina ne da izmjeriti; one su moguće sporne.
          </li>
          <li>
            U neuređenom je dijelu i <strong>{broj(sporne.izgradjena.cestice)} čestica na kojima već stoji zgrada</strong> (slobodnog je zemljišta na njima {ha1(sporne.izgradjena.ha)} ha). Zakon neuređeni dio određuje kao dio neizgrađenog dijela građevinskog područja, pa je upitno pripadaju li mu izgrađene čestice.
          </li>
          <li>Neuređeni dio određen je PPUG-om, pa se njegova izmjena može zatražiti u javnom pozivu za inicijative, koji obuhvaća i izmjene PPUG-a.</li>
        </ul>
        <Slika
          src="/gup/analiza/provjera-neuredeno.webp"
          sirina={1300}
          visina={750}
          opis="Karta istočnog Splita: neuređeni dio s lista 4.d, registrirane ceste obojene prema širini njihove čestice te crveno obrubljene čestice u neuređenom dijelu uz ceste čija je čestica široka barem 4 m."
          legenda={[
            { boja: "#ffffaf", tekst: "neuređeni dio građevinskog područja (list 4.d)" },
            { boja: "#dc0000", tekst: "čestica u neuređenom dijelu uz cestu čija je čestica široka barem 4 m", oblik: "obrub" },
            { boja: "rgb(40,40,40)", tekst: "registrirana cesta, čestica ceste široka barem 4 m", oblik: "crta" },
            { boja: "rgb(240,120,0)", tekst: "registrirana cesta, čestica ceste uža od 4 m", oblik: "crta" },
            { boja: "rgb(96,165,250)", tekst: "cesta izvan registra ili neizmjerene širine", oblik: "crta" },
            ...PODLOGA,
          ]}
        >
          <strong>Slika 7.</strong> Prema kriteriju Grada crveno obrubljene čestice ne bi trebale biti u neuređenom dijelu, ako je cesta uz njih izvedena u širini svoje čestice.
        </Slika>
        <Detaljnije naslov="Kako smo mjerili širinu cesta i što mjerenjem nije obuhvaćeno">
          <p>
            Osi cesta preuzete su iz gradskog registra nerazvrstanih cesta (29. studenoga 2023.) i sloja državnih cesta. Svaka 4 m uzeli smo tetivu okomitu na os kroz usku česticu kojom os prolazi, pa širinu izgladili pomičnim medijanom na oko 40 m. Širina čestice ceste nije širina izvedenog kolnika, nego najveća širina koju cesta na njoj može imati; je li cesta doista toliko široka i u funkciji, kako traži kriterij Grada, ovim se mjerenjem ne može utvrditi. Ceste koje nisu zasebne čestice nisu izmjerene i ne broje se kao pristup, pa je {broj(sporne.pristup.cestice)} donja granica za čestice uz ceste čija je čestica široka barem 4 m; uži izvedeni kolnik mogao bi broj čestica koje ispunjavaju kriterij Grada i smanjiti. Kanalizacija je iz gradskog GIS sloja mreže i kolektora, samo mješovita i fekalna. Granice prenesene s lista 4.d od službenih granica odstupaju za 4 do 7 m (medijan), a čestica se ubraja u neuređeni dio kad je barem pola njezine površine u njemu. Je li čestica izgrađena i koliko je na njoj slobodnog zemljišta, preuzeto je iz izračuna za kartu zabrane. Čestice kojima registrirana cesta prolazi dulje od 8 m smatraju se cestom i nisu brojane.
          </p>
        </Detaljnije>

        <Podnaslov>Urbana sanacija: jesu li ozakonjene zgrade većina?</Podnaslov>
        <p>
          Prema zakonu, mjere urbane sanacije propisuju se za područja na kojima pretežu ozakonjene zgrade. Za svaku zgradu u plohama urbane sanacije i na području Dračevca, Bilica, Mostina, Harakovca, Kile i Kamena provjerili smo ima li u registru Ministarstva (ISPU) rješenje o izvedenom stanju. Registar ne mora biti potpun, pa su udjeli približni.
        </p>
        <Tablica
          zaglavlje={["Oznaka", "Broj zgrada", "Udio s rješenjem o izvedenom stanju (ISPU)"]}
          redovi={[
            ["područje urbane sanacije", "830", "80 %"],
            ["ostatak obuhvata UPU-a (preporuka)", "106", "66 %"],
            ["neuređeni dio", "44", "45 %"],
            ["važeći plan užeg područja", "170", "56 %"],
            ["izvan obuhvata UPU-a", "41", "39 %"],
          ]}
        />
        <ul className="list-disc space-y-2 pl-5">
          <li>
            U {vecina.length} od {plohe.length} ploha urbane sanacije s barem 10 zgrada rješenje o izvedenom stanju ima {Math.min(...vecina.map((p) => p.udio))} do {Math.max(...vecina.map((p) => p.udio))} % zgrada.
          </li>
          <li>
            <strong>U preostalim trima plohama nije tako.</strong> U plohi u Harakovcu ({ha1(ploha(19)?.ha ?? 0)} ha, {ploha(19)?.zgrade} zgrada) rješenje o izvedenom stanju ima {ploha(19)?.udio} % zgrada, u plohi u Mostinama ({ha1(ploha(17)?.ha ?? 0)} ha, {ploha(17)?.zgrade} zgrada, među njima velike poslovne hale) {ploha(17)?.udio} %, a u plohi u obuhvatu UPU-a proširenja groblja Lovrinac ({ha1(ploha(21)?.ha ?? 0)} ha, {ploha(21)?.zgrade} zgrada) {ploha(21)?.udio} %. Prema podacima iz registra, u tim plohama zakonski uvjet za urbanu sanaciju nije ispunjen. Na njima je {broj(sporne.sanacija.cestice)} čestica na kojima zabrana pogađa novu gradnju.
          </li>
          <li>
            <strong>U plohama urbane sanacije je i {broj(sporne.prazne_u_sanaciji.cestice)} praznih čestica ({ha1(sporne.prazne_u_sanaciji.ha)} ha)</strong>, od toga {broj(sporne.prazne_u_sanaciji_uz_cestu)} uz postojeću cestu. GUP sanaciju crta kao jednu plohu preko cijelog izgrađenog dijela naselja, a PPUG i prazne čestice unutar izgrađenog bloka, sve do ceste, vodi kao izgrađeni dio. Na takvoj se čestici do UPU-a neće smjeti graditi ništa. Na jednakoj praznoj čestici u neuređenom dijelu uz postojeću javnu cestu može se dobiti lokacijska dozvola, a na onoj bez oznake gradi se odmah. Na sjevernom rubu Dračevca 2 tako je prazan maslinik s unutarnje strane zavoja ceste u sanaciji, a jednake prazne čestice iste gospodarske zone preko ceste nisu.
          </li>
          <li>
            <strong>I u ostatku obuhvata većina zgrada ima rješenje o izvedenom stanju (66 %), a oznake urbane sanacije ondje nema.</strong> Oznaka dakle ne prati samo udio ozakonjenih zgrada: zemljište sa sličnim udjelom na jednom je mjestu pod zabranom, a na drugome nije.
          </li>
        </ul>
        <Slika
          src="/gup/analiza/provjera-sanacija.webp"
          sirina={1300}
          visina={750}
          opis={`Karta istočnog Splita: plohe urbane sanacije s udjelom zgrada koje imaju rješenje o izvedenom stanju; ploha u Harakovcu ima ${ploha(19)?.udio} %, a jedna u Mostinama ${ploha(17)?.udio} %.`}
          legenda={[
            { boja: "#9fff7f", tekst: "područje urbane sanacije (list 4.d)" },
            { boja: "#dc0000", tekst: "ploha u kojoj zgrade s rješenjem u registru nisu većina", oblik: "obrub" },
            ...PODLOGA,
          ]}
        >
          <strong>Slika 8.</strong> Udio zgrada s rješenjem o izvedenom stanju u svakoj plohi urbane sanacije s barem 10 zgrada. Ploha u obuhvatu UPU-a proširenja groblja Lovrinac je izvan isječka.
        </Slika>
        <Detaljnije naslov="Kako smo brojali ozakonjene zgrade">
          <p>
            Za sve plohe urbane sanacije, kvartove Dračevac i Bilice te za UPU-e 17–20 i 26 iz prijedloga rješenja o izvedenom stanju preuzeta su iz javnog registra Ministarstva (ISPU, sloj „Akt za uporabu građevine”); brojana su samo rješenja kojima je zahtjev usvojen, svako jednom. Zgradi smo pripisali rješenje ako je njegova točka u registru udaljena manje od 15 m od tlocrta zgrade; jedno se rješenje tako može pripisati i susjednoj zgradi, što udjele povećava. Zgradom smatramo tlocrt od najmanje 35 m² iz gradskog 3D modela, a dijelovi krova koji se dodiruju spojeni su u jednu zgradu. Registar ne mora biti potpun, a zgrada bez akta u registru nije nužno nezakonita: starije zgrade i dozvole izdane prije uvođenja registra u njemu ne moraju biti upisane.
          </p>
        </Detaljnije>

        <Podnaslov>Ostatak obuhvata i urbana preobrazba</Podnaslov>
        <p>
          Za ostatak obuhvata Grad nije naveo nikakav kriterij. Na isječku se ostatak obuhvata gotovo u cijelosti (27,2 od 28,1 ha) nalazi na zemljištu za koje važeći GUP na listu 4.c već propisuje UPU; prijedlog ga je zadržao u obuhvatu UPU-a, ali bez ispune. Urbana preobrazba na isječku obuhvaća gotovo samo Karepovac, a on je gradski projekt, pa je ta oznaka u skladu s popisom iz čl. 106. st. 4.
        </p>

        <Podnaslov>Što se na temelju toga može tražiti</Podnaslov>
        <ul className="list-disc space-y-2 pl-5">
          <li>da se neuređeni dio uskladi s kriterijem Grada, tako da se iz njega izuzmu čestice uz postojeću cestu široku barem 4 m i izgrađene čestice (izmjenom PPUG-a i GUP-a);</li>
          <li>da se iz urbane sanacije izuzmu plohe u kojima ozakonjene zgrade nisu većina (Harakovac, Mostine i Lovrinac);</li>
          <li>da se iz urbane sanacije izuzmu prazne čestice, barem one uz postojeću javnu cestu, jer sanacija služi uređenju ozakonjene gradnje, a na njima nje nema;</li>
          <li>za pojedinu česticu u neuređenom dijelu do koje već vodi izvedena cesta, da je Grad prebaci u uređeni dio; dokaz treba priložiti (fotografija ceste, podaci o priključku), jer je Grad takve primjedbe u raspravi o PPUG-u prihvaćao;</li>
          <li>
            da Grad objavi podatke i prag po kojima je ucrtao urbanu sanaciju te njezine granice odredi po katastarskim česticama, kao što je to u PPUG-u učinio za neuređeni dio, a u važećem GUP-u za granicu zaštićene povijesne jezgre.
          </li>
        </ul>
      </Poglavlje>

      <Poglavlje id="vazeci-gup" naslov="3. Što kaže važeći GUP? Na papiru se nova kuća ne može graditi bez plana, i to od 2006.">
        <Odgovor>
          Uvjerljivije je tumačenje prema kojem se nova kuća na čestici s pravilom 3.1 unutar obuhvata s lista 4.c ne može graditi bez UPU-a, i to od 2006. Rečenica s riječima „za ostalo” ipak dopušta i suprotno tumačenje, a nijedno mjerodavno tijelo još nije reklo koje je ispravno.
        </Odgovor>
        <p>Ključne su tri odredbe:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Navod id="clanak-105-2015">Čl. 105.</Navod> propisuje UPU za obuhvate s lista 4.c, a dok se UPU ne donese, dopušta samo zahvate s taksativnog popisa: ulice, infrastrukturu, javne zgrade i slično. Na popisu nema kuća.
          </li>
          <li>
            <Navod id="clanak-104-2015">Čl. 104.</Navod> u niskokonsolidiranim područjima gradnju „temeljem ovog Plana” dopušta samo ondje gdje nije propisana izrada plana užeg područja.
          </li>
          <li>
            Urbano pravilo 3.1 (<Navod id="pravilo-3-1-2015">čl. 73.</Navod>) dopušta novu gradnju „uz izradu provedbenog dokumenta prostornog uređenja, ukoliko je ovim odredbama utvrđena obveza izrade provedbenog dokumenta, a za ostalo temeljem ovog Plana”. Oko tih riječi „za ostalo” vrti se cijeli spor.
          </li>
        </ul>
        <Detaljnije naslov="Doslovni tekst odredbi">
          <p>
            Odredbe treba čitati zajedno. <Navod id="clanak-105-2015">Čl. 105.</Navod> utvrđuje „obvezu izrade urbanističkih i provedbenih dokumenata prostornog uređenja za obuhvate prema kartografskom prikazu … 4.c”. Zatim „do donošenja provedbenih dokumenata” dopušta izdavanje dozvola samo za taksativno nabrojene zahvate: dijelove ulične mreže, prometnu i komunalnu infrastrukturu, zahvate na obali u lukama, javne i društvene građevine, manje rekreacijske površine te, nakon natječaja, proizvodne i poslovne građevine na česticama od najmanje 3.000 m². Kuća na popisu nema.
          </p>
          <p>
            <Navod id="clanak-104-2015">Čl. 104.</Navod> dvije vrste područja uređuje različito. U konsolidiranim područjima gradnju „temeljem ovog Plana” dopušta bez ograde, a u niskokonsolidiranim samo „za područja za koja nije propisana izrada provedbenog dokumenta prostornog uređenja”.
          </p>
          <p>
            Urbano pravilo 3.1 (čl. 73.) nosi naslov <Navod id="pravilo-3-1-naslov-2015">„Sanacija, uređivanje i urbana obnova djelomično izgrađenih prostora mješovite izgradnje”</Navod>. Za mješovitu namjenu M1 kaže:
          </p>
          <Citat id="pravilo-3-1-2015" izvor="Sl. gl. 55/14, čl. 73., str. 50">
            Omogućava se nova izgradnja, zamjena postojećih građevina i rekonstrukcija postojećih građevina te uređenje javnih prostora uz izradu provedbenog dokumenta prostornog uređenja, ukoliko je ovim odredbama utvrđena obveza izrade provedbenog dokumenta, a za ostalo temeljem ovog Plana uz slijedeće uvjete
          </Citat>
          <p>Za postojeće građevine čl. 49. dodaje prijelazno pravilo:</p>
          <Citat id="clanak-49-do-plana-2015" izvor="Sl. gl. 55/14, čl. 49., str. 30">
            Do odnošenja [sic, umjesto ‚donošenja’] provedbenih dokumenata prostornog uređenja moguća je rekonstrukcija i prenamjena legalnih građevina u postojećim gabaritima.
          </Citat>

        </Detaljnije>
        <Detaljnije naslov="Zašto tekst više govori u prilog zabrani">
          <p>
            Najjači su argumenti sustavni. Čl. 104. u konsolidiranim područjima gradnju „temeljem ovog Plana” dopušta bez ograde, a u niskokonsolidiranima samo ondje gdje plan nije propisan; čestica s pravilom 3.1 unutar granice s lista 4.c niskokonsolidirana je i ima propisan plan. Čl. 105. sročen je kao dopuštenje, pa se ono što ne navodi smije graditi tek nakon donošenja plana.
          </p>
          <p>
            Iznimke u samom pravilu 3.1 bile bi suvišne kad bi se na česticama s tim pravilom i prije plana smjelo graditi. Za turističku namjenu T1 pravilo kaže „<Navod id="pravilo-3-1-t1-2015">Moguća realizacija temeljem ovog Plana, prije donošenja propisanog provedbenog dokumenta prostornog uređenja</Navod>”, a slične odredbe postoje za <Navod id="pravilo-3-1-dvorana-2015">sportsku dvoranu uz OŠ Stobreč</Navod>, <Navod id="pravilo-3-1-streljana-2015">Streljanu Stobreč</Navod> i, drugdje u planu, za <Navod id="pravilo-p29-2015">hotel P29</Navod>. Nadogradnju legalnih kuća čl. 49. dopušta samo <Navod id="clanak-49-izvan-obuhvata-2015">„izvan obuhvata”</Navod> planova.
          </p>
          <p>
            U istom smjeru upućuje i povijest teksta. Izmjene iz 2008. uvele su izraz „za ostalo” tako što su <Navod id="izmjena-pravila-3-1-2008">zamijenile riječi „(u granicama obuhvata utvrđenim ovim Planom)”</Navod>. Zamjena je dakle prostorna: „ostalo” je ostatak zemljišta s pravilom 3.1, ono na kojem obveze plana nema.
          </p>
          <p>
            Tome u prilog idu i riječi samoga Grada. <Navod id="obrazlozenje-gubitak-obveze-2025">Obrazloženje prijedloga iz travnja 2025.</Navod> kaže da za neka područja „za koja je dosadašnjim GUP-om bila obvezna izrada … UPU-a … više se ne može propisati ta obveza, tako da gradnja postaje moguća izravno temeljem GUP-a”. Odlomak govori o područjima koja obvezu gube, ali polazi od toga da obveza na snazi priječi neposrednu gradnju.
          </p>
          <p>
            Obvezu iz plana Grad je i provodio kad ju je pravilo izričito propisivalo. Godine 2016. vlasniku u konsolidiranoj zoni s pravilom 2.7 odgovorio je da dozvola nije moguća jer je „GUP-om (<Navod id="clanak-70-2015">članak 70.</Navod>) predviđena obveza izrade detaljnijeg plana”, kako stoji u primjedbi br. 70 (<V href={IZVOR.izvjescePdf}>Izvješće o javnoj raspravi, 26. 3. 2025., str. 187–188</V>).
          </p>
          <p>
            U Harakovcu je tekst još jasniji. Na tamošnje se zemljište gotovo u cijelosti primjenjuju pravila 3.2–3.6, ponajviše pravilo 3.2, „Nova regulacija na pretežito neizgrađenom prostoru”. <Navod id="pravilo-3-2-2015">Pravilo 3.2</Navod> zahtijeva plan i nema odredbu „za ostalo”.
          </p>

        </Detaljnije>
        <Detaljnije naslov="Zašto tumačenje prema kojem je gradnja dopuštena nije bez temelja">
          <p>
            Ono polazi od gramatike. Rečenica pravila 3.1 može se raščlaniti tako da plan treba samo za javne prostore, a da se na česticama („ostalo”) gradi neposredno, pod navedenim uvjetima. Čini se da su ti uvjeti doista pisani za dozvole koje se izdaju neposrednom provedbom GUP-a: odnose se na pojedinu česticu, sve do odredbe o interpolaciji „<Navod id="pravilo-3-1-interpolacija-2015">ukoliko se nova (jedna) građevna parcela formira između dvije izgrađene parcele Ppmin=300 m²</Navod>”.
          </p>
          <p>
            Podupiru ga i dvije rečenice čl. 49. Prva je bez ograde: „<Navod id="clanak-49-dogradnja-2015">U nisko konsolidiranom području omogućava se dogradnja i nadogradnja postojećih, legalnih građevina prema urbanim pravilima</Navod>”; ograničenja „izvan obuhvata” u njoj nema. Druga izgrađenim dijelovima nudi blaže uvjete „<Navod id="clanak-49-izgradeni-dijelovi-2015">kroz izradu propisanog provedbenog dokumenta prostornog uređenja ili na drugi način utvrđen ovom Odlukom</Navod>”.
          </p>
          <p>
            Najviše govori odgovor Grada na primjedbu br. 73: najveću tlocrtnu površinu iz pravila 3.1 opisao je kao „mehanizam zaštite prostora do donošenja planova užeg područja” (<V href={IZVOR.izvjesce}>Izvješće, str. 194</V>). To ima smisla samo ako se po tom pravilu gradi prije tih planova.
          </p>
          <p>
            Autentičnog tumačenja tih članaka nema, a nije nađena ni sudska odluka. Postupak izmjena 2015.–2017. došao je do konačnog prijedloga s istim tekstom. Izmjene nikad nisu donesene, a odluka o njihovoj izradi stavljena je izvan snage 2022. (<V href={IZVOR.konacni2017}>konačni prijedlog 2017.</V>; <V href={IZVOR.izvjescePdf}>Izvješće, 26. 3. 2025., točka 90</V>).
          </p>

        </Detaljnije>
        <Detaljnije naslov="Kako se tekst mijenjao od 2006.">
          <Tablica
            sirina="min-w-[44rem]"
            zaglavlje={["Odredba", "Izvorni plan 2006. (Sl. gl. 1/06)", "Izmjene 2008. (Sl. gl. 3/08)", "Pročišćeni tekst 2014. (Sl. gl. 55/14)"]}
            redovi={[
              [
                "Pravilo 3.1, M1",
                <>
                  Sva nova gradnja, zamjena i rekonstrukcija <Navod id="pravilo-3-1-2006">„uz izradu UPU-a (u granicama obuhvata utvrđenim ovim Planom)”</Navod>
                </>,
                <Navod key="i" id="izmjena-pravila-3-1-2008">
                  „…ukoliko je ovim odredbama utvrđena obveza izrade detaljnijeg plana, a za ostalo temeljem ovog Plana”
                </Navod>,
                <>
                  <Navod id="pravilo-3-1-2015">Isto</Navod>; „detaljniji plan” postaje „provedbeni dokument”
                </>,
              ],
              [
                "Čl. 104., niskokonsolidirana područja",
                <>
                  Neposredno po GUP-u samo <Navod id="clanak-104-2006">„za područja za koja nije propisana izrada detaljnijeg plana”</Navod>
                </>,
                "Samo nazivlje",
                <Navod key="c" id="clanak-104-2015">
                  Isto
                </Navod>,
              ],
              [
                "Čl. 105.",
                <>
                  <Navod id="clanak-105-2006">Obveza prema listu 4.c</Navod>; iznimke za ulice, infrastrukturu, javne građevine, rekreaciju R2 i poslovne čestice od najmanje 3.000 m²
                </>,
                <>
                  Novi <Navod id="list-detaljniji-planovi-2008">list 4.c</Navod>; iznimke proširene (benzinske postaje, garaže, luke, proizvodnja)
                </>,
                <Navod key="c" id="clanak-105-2015">
                  Isto
                </Navod>,
              ],
              [
                "Postojeće legalne građevine (čl. 49.)",
                <>
                  Rekonstrukcija prema planovima; <Navod id="clanak-49-izvan-obuhvata-2006">nadogradnja samo izvan obuhvata</Navod>; ništa o razdoblju do donošenja plana
                </>,
                <>
                  <Navod id="izmjena-clanka-49-2008">Dopuštene rekonstrukcija „u postojećim gabaritima” do donošenja plana te dogradnja i nadogradnja u niskokonsolidiranom području</Navod>
                </>,
                <Navod key="c" id="clanak-49-do-plana-2015">
                  Isto
                </Navod>,
              ],
            ]}
          />
          <p>
            <strong>Uvjet da se prije gradnje donese UPU postojao je već u izvornom GUP-u iz 2006.: tada je UPU bio potreban za gradnju na svakoj čestici s pravilom 3.1 u zoni M1.</strong> Izmjene iz 2008. zamijenile su list 4.c, pravilo 3.1 suzile na zemljište s ucrtanom obvezom, a za postojeće kuće dopustile rekonstrukciju u postojećim gabaritima te dogradnju i nadogradnju. Danas vrijedi list iz 2008.; izmjena iz 2014. na listu 4.c dirala je samo Trstenik. Je li list iz 2006. već obuhvaćao stambeni Dračevac, ne zna se, jer nije pronađen.
          </p>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="zakon" naslov="4. Je li se promijenio zakon? Jest, 2014., i to samo za zemljište koje plan tako označi">
        <Odgovor>
          Zakonska zabrana gradnje novih zgrada prije donošenja UPU-a postoji od 2014. i odnosi se samo na zemljište koje plan označi kao neuređeno, kao područje urbane preobrazbe ili kao područje urbane sanacije. Novi zakon (NN 155/25) zadržao ju je i malo ublažio.
        </Odgovor>
        <Tablica
          sirina="min-w-[44rem]"
          zaglavlje={["Razdoblje", "Zakon", "UPU je po zakonu obvezan za", "Prije donošenja UPU-a"]}
          redovi={[
            ["1994. – rujan 2007.", "ZPU, NN 30/94", "ono što propiše plan", "nema zakonske zabrane, osim u zaštićenom obalnom pojasu od srpnja 2004."],
            [
              "listopad 2007. – 2013.",
              "ZPUG, NN 76/07",
              "neizgrađene dijelove i dijelove planirane za „urbanu obnovu”",
              "dozvole „samo na temelju tog plana”; zamjena i rekonstrukcija izuzete; privremena zabrana najdulje 2 + 1 godinu",
            ],
            [
              "2014. – 2025.",
              "ZPU i ZoG, NN 153/13",
              "neuređene dijelove te izgrađene dijelove planirane za preobrazbu ili sanaciju, osim ako GUP daje uvjete s detaljnošću UPU-a",
              <>
                <strong>nema dozvole za novu građevinu</strong> (čl. 79. st. 3.); rekonstrukcija i zamjena izuzete; pretpostavke iz čl. 201.
              </>,
            ],
            [
              "od 1. siječnja 2026.",
              "ZPU i ZoG, NN 155/25",
              "neizgrađeno i neopremljeno zemljište, izgrađene dijelove planirane za sanaciju ili preobrazbu i drugo",
              "građevinska dozvola samo za rekonstrukciju ili zamjenu; lokacijska i za novu zgradu uz postojeću javnu prometnu površinu",
            ],
          ]}
        />
        <p>
          Zakon ne određuje koje zemljište pripada tim kategorijama, nego to prepušta GUP-u. Važeći GUP nije tako označio stambeni istočni Split, pa se zakonska zabrana, ako se zakon čita doslovno, na njega ne odnosi.
        </p>
        <Detaljnije naslov="Kako se zakon mijenjao od 1994.">
          <p>
            <strong>Do 2007. zakonske zabrane nije bilo.</strong> Zakon iz 1994. obvezu izrade UPU-a u potpunosti je prepustio planovima i tražio samo da dozvola bude u skladu s „dokumentom prostornog uređenja” (<V href={IZVOR.zpu30}>ZPU, NN 30/94</V>). Jedina zakonska zabrana bila je obalna: od srpnja 2004. „Unutar zaštićenoga obalnog pojasa ne može se graditi ako nije donesen urbanistički plan uređenja” (<V href={IZVOR.nn100_04}>NN 100/04</V>).
          </p>
          <p>
            <strong>Zakon iz 2007. (ZPUG) uveo je tu zamisao.</strong> UPU je postao obvezan za neizgrađene dijelove građevinskog područja i za dijelove tih područja „planiranih za urbanu obnovu”. Gdje je obvezu propisao zakon, dozvola se mogla izdati „samo na temelju tog plana”, a zamjena i rekonstrukcija bile su izuzete. Gradsko vijeće moglo je do donošenja plana i privremeno zabraniti izdavanje dozvola, ali <strong>najdulje na dvije godine, uz produljenje za još jednu</strong> (<V href={IZVOR.zpug}>ZPUG, NN 76/07, čl. 75., 125. i 127.</V>).
          </p>
          <p>
            <strong>Današnju zabranu uveo je 2014. stari Zakon o prostornom uređenju</strong>, u čl. 79. Stavak 1. propisuje UPU „za neuređene dijelove građevinskog područja i za izgrađene dijelove tih područja planiranih za urbanu preobrazbu ili urbanu sanaciju”. Stavak 2. obvezu ukida ako PPUG ili GUP propiše uvjete „s detaljnošću propisanom za urbanistički plan uređenja”. <strong>Stavak 3. kaže da se do tada „ne može izdati akt za građenje nove građevine”</strong>, a stavak 4. izuzima rekonstrukciju i zamjenu postojeće građevine (<V href={IZVOR.zpu153}>ZPU, NN 153/13</V>).
          </p>
          <p>
            Zakon o gradnji to je preslikao u čl. 110. st. 1. t. 7.: za dozvolu je potrebno da je UPU „donesen … ako se dozvola izdaje na području za koje je posebnim zakonom propisana obveza njegova donošenja” (<V href={IZVOR.zog153}>ZoG, NN 153/13</V>). Izmjena iz 2017. mijenjala je samo formulacije (<V href={IZVOR.nn65_17}>NN 65/17</V>), a <V href={IZVOR.nn67_23}>NN 67/23</V> čl. 79. nije dirao. Izmjena iz 2019. (<V href={IZVOR.nn39_19}>NN 39/19, čl. 45.</V>) uvela je, međutim, iznimku za lokacijsku dozvolu: UPU nije uvjet za „građenje nove zgrade koja ima pristup na prometnu površinu te mogućnost rješavanja odvodnje otpadnih voda prema mjesnim prilikama određenim prostornim planom” (stari ZPU, čl. 146. st. 2. t. 3.). Grad sam kaže da je upravo ta odredba „omogućila zaobilaženje te obveze, dopuštajući izdavanje akata za građenje uz tek minimalne uvjete pristupa i odvodnje, bez cjelovite planske razrade koju bi UPU osigurao” (<V href={`${IZVOR.izvjescePpug2}#page=100`}>izvješće o ponovnoj javnoj raspravi o PPUG-u, br. 8, str. 100</V>).
          </p>
          <p>
            Ta iznimka ipak ne objašnjava dozvole u istočnom Splitu. Vrijedila je samo za lokacijsku dozvolu, a Zakon o gradnji građevinskoj je dozvoli ostavio samo iznimke za rekonstrukciju i zamjenu (<V href={IZVOR.nn39_19}>ZoG, čl. 110. st. 2., NN 39/19</V>). U Kili, zapadnom dijelu Kamena i Dračevcu 2 registar od 25. travnja 2019. bilježi 33 građevinske dozvole za stambene, mješovite ili poslovne zgrade i samo četiri lokacijske dozvole. Dozvole su, dakle, izdavane izravno, jer važeći GUP to zemljište ne označava kao neuređeno ni kao sanaciju.
          </p>
          <p>
            Ministarstvo to pravilo primjenjuje dosljedno. U odgovorima na česta pitanja iz 2014. kaže da se dozvole „ne mogu izdati … dok se taj plan ne donese” (<V href={IZVOR.mpgiPitanja}>MPGI, česta pitanja</V>), a mišljenje Općini Tinjan iz 2024. to ponavlja (<V href={IZVOR.mpgiTinjan}>MPGI, 21. 3. 2024.</V>). Županijski upravni odjel primijenio ga je u Baškoj Vodi, a Upravni sud u Splitu potvrdio je odbijanje zahtjeva (<V href={IZVOR.baskaVoda}>UsIgr-268/2020-6</V>).
          </p>
          <p>
            <strong>Zakon, međutim, ne određuje koje zemljište pripada tim kategorijama.</strong> GUP „određuje” neuređeni dio i dio „planiran za urbanu preobrazbu i urbanu sanaciju” (stari ZPU, čl. 78. st. 1.). Provjere pri izdavanju dozvole odnose se na obvezu propisanu „ovim Zakonom” ili „posebnim zakonom”. Granica UPU-a koju GUP povuče oko običnog izgrađenog zemljišta nije takva obveza. Dozvolu može priječiti samo kroz uvjete samog plana (ZoG, čl. 110. st. 1. t. 3.), ali ne kao zakonska zabrana (<V href={IZVOR.zpu153}>ZPU</V> i <V href={IZVOR.zog153}>ZoG, NN 153/13</V>). Prema tom tumačenju zakonska zabrana u stambenom istočnom Splitu po važećem GUP-u nikad nije vrijedila, jer ga GUP nikad nije tako označio.
          </p>

        </Detaljnije>
        <Detaljnije naslov="Sporno: je li se prijelazna odredba od 2014. do 2025. odnosila i na područja s pravilom 3.1?">
          <p>
            Čl. 201. starog ZPU-a vrijedio je dok se planovi ne usklade s novim kategorijama i sadržavao je dvije pretpostavke. Prema stavku 2. „neuređenim dijelom građevinskog područja smatraju se neizgrađeni dijelovi” planova na snazi. Prema stavku 3. „dijelovi građevinskog područja određeni za urbanu obnovu prostornim planovima koji su na snazi” smatraju se planiranima za urbanu preobrazbu. Za sanaciju takve pretpostavke nema (<V href={IZVOR.zpu153}>ZPU, NN 153/13</V>).
          </p>
          <p>
            Službeni naziv pravila 3.1 sadrži <Navod id="pravilo-3-1-naslov-2015">„urbanu obnovu”</Navod>, što potvrđuje i presuda splitskog Upravnog suda (<V href={IZVOR.presuda31}>UsIgr-256/2015-14</V>). I sam je Grad podnositelju primjedbe br. 107 odgovorio da je prijedlog tek uskladio „urbanu obnovu” sa zakonskim pojmovima „sanacija” i „preobrazba” (<V href={IZVOR.izvjesce}>Izvješće, str. 213–214</V>). To je razuman argument da su se područja s pravilom 3.1 od 2014. smatrala područjima preobrazbe, pa da je gradnja ondje bila zakonom zabranjena.
          </p>
          <p>
            Ni protuargumenti nisu zanemarivi. Naziv pravila nije isto što i zemljište „određeno za urbanu obnovu”. Preobrazba znači bitnu promjenu urbane strukture, što slabo pristaje naselju kuća. Nijedna uputa Ministarstva ni sudska odluka ne bavi se nazivima pravila u GUP-u.
          </p>
          <p>
            <strong>Ova analiza to pitanje ostavlja otvorenim.</strong> U praksi je <strong>Grad dozvole ipak izdavao</strong> (6. poglavlje), a čini se da ih nitko nije osporio. Stavak 2. otvara slično, ali uže pitanje za neizgrađene čestice, jer se nekoliko točaka dozvola u istočnim prigradskim naseljima nalazi na zemljištu koje prijedlog označava kao <Navod id="legenda-4d-2025">„neuređeni dio neizgrađenog građevinskog područja prema PPUG-u Splita”</Navod>.
          </p>

        </Detaljnije>
        <Detaljnije naslov="Što donosi novi zakon (NN 155/25)">
          <p>
            Čl. 106. st. 2. novog ZPU-a (NN 155/25) propisuje UPU, među ostalim, za dijelove građevinskog područja „koji nisu izgrađeni i opremljeni osnovnom infrastrukturom” i za „postojeće i izgrađene dijelove građevinskih područja za koje se planira urbana preobrazba i/ili urbana sanacija”. Do donošenja UPU-a građevinska dozvola može se izdati samo za rekonstrukciju ili zamjenu postojeće građevine (novi ZoG, čl. 73. st. 1. t. 6. i st. 3.). Za lokacijsku dozvolu novi zakon zadržava iznimku iz 2019., ali je sužava: vrijedi za „građenje nove zgrade koja ima pristup na postojeću javnu prometnu površinu te mogućnost rješavanja odvodnje otpadnih voda prema mjesnim prilikama određenim prostornim planom, ako se takvim građenjem ne sprečava opremanje drugog građevinskog zemljišta” (novi ZPU, čl. 180. st. 2. t. 3.; <V href={IZVOR.zpu155}>ZPU</V> i <V href={IZVOR.zog155}>ZoG, NN 155/25</V>). Za urbanu sanaciju i preobrazbu do donošenja UPU-a vrijede samo prijelazne mjere za rekonstrukciju i zamjenu (čl. 106. st. 3.), pa iznimka ondje ne pomaže; za neuređeni dio takve odredbe nema. Grad na tu iznimku upućuje vlasnike neuređenih čestica (<V href={`${IZVOR.izvjescePpug2}#page=98`}>izvješće o ponovnoj javnoj raspravi o PPUG-u, br. 5, 7 i 9</V>).
          </p>
          <p>
            Novi zakon nema pretpostavku poput one iz čl. 201. Njegova kategorija sanacije i preobrazbe traži da je promjena „planirana”, a to je oznaka plana, pa se, doslovno protumačena, ne odnosi na neoznačena područja s lista 4.c važećeg GUP-a. Kategorija zemljišta koje „nije izgrađeno i opremljeno” sročena je kao činjenica, a ne kao oznaka, pa bi mogla obuhvatiti prazne neopremljene čestice i prema važećem GUP-u. To je naše tumačenje; nijedna uputa ga ne potvrđuje. Ni stari ni novi ZPU zabrani ne određuje rok.
          </p>
          <p>
            Podaci iz registra u skladu su s doslovnim tumačenjem. Unutar UPU-a iz prijedloga izdane su najmanje dvije dozvole za novu gradnju čija klasa nosi 2026. godinu, pa su zahtjevi vjerojatno i podneseni i riješeni po novom zakonu: UP/I-361-03/26-01/000088, za zgradu sa šest stanova (Kila), izdana 29. lipnja 2026. na zemljištu koje prijedlog boji kao sanaciju, i UP/I-361-03/26-01/000097 (Orišac), izdana 14. rujna 2026. (<V href={IZVOR.ispu}>registar ISPU</V>; <V href={IZVOR.biljeskeDozvole}>bilješke o prikupljanju</V>; sam popis akata ne objavljujemo jer sadrži adrese privatnih zahvata).
          </p>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="prijedlog" naslov="5. Što prijedlog mijenja? Izričite oznake i manje iznimaka, po odluci Grada">
        <Odgovor>
          Prijedlog označava istočni Split kao područje urbane sanacije ili neuređeni dio građevinskog područja, pa zabrana gradnje novih zgrada do donošenja UPU-a proizlazi izravno iz zakona. Prijedlog usto ukida iznimke koje važeći GUP daje postojećim kućama. Samu oznaku bira Grad.
        </Odgovor>
        <p>Srž je novi čl. 103. st. 1.:</p>
        <Citat id="obveza-plana-2025" izvor="Prijedlog 2025., čl. 103. st. 1., str. 143">
          Područja unutar obuhvata GUP-a na kojima je gradnja moguća samo temeljem prostornog plana užeg područja odnosno ne dozvoljava se neposredna provedba GUP-a, ako ovim odredbama ili Zakonom nije određeno drugačije, su: 1. neuređeni dijelovi … 2. izgrađeni dijelovi … planirani za urbanu preobrazbu 3. izgrađeni dijelovi … planirani za urbanu sanaciju
        </Citat>
        <p>
          Ostali propisani planovi postaju preporuka: „<Navod id="preporuka-plana-2025">do izrade prostornog plana užeg područja gradnja je moguća neposrednom provedbom GUP-a</Navod>” (čl. 103. st. 4.). Dosadašnji <Navod id="clanak-104-brisanje-2025">čl. 104. se briše</Navod>.
        </p>
        <Tablica
          sirina="min-w-[46rem]"
          zaglavlje={["Pitanje", "Važeći GUP (Sl. gl. 55/14)", "Prijedlog, travanj 2025.", "Što zakon traži kad je zemljište označeno"]}
          redovi={[
            [
              "Nova kuća na praznoj čestici s pravilom 3.1 ili u sanaciji",
              <>
                Tekst: kroz UPU (sporno zbog <Navod id="pravilo-3-1-2015">„za ostalo”</Navod>). Praksa: odobrava se.
              </>,
              <>
                Samo kroz UPU (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>); nije na popisu iz <Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>
              </>,
              "Nema dozvole do UPU-a (stari ZPU, čl. 79. st. 3.; novi ZoG, čl. 73. st. 1. t. 6.). U neuređenom dijelu iznimka za lokacijsku dozvolu za čestice uz cestu (od 2019. stari ZPU, čl. 146. st. 2. t. 3.; novi ZPU, čl. 180. st. 2. t. 3.)",
            ],
            [
              "Rekonstrukcija u postojećim gabaritima",
              <Navod key="c" id="clanak-49-do-plana-2015">
                Dopuštena do donošenja plana
              </Navod>,
              "Samo kroz „ili Zakonom”",
              "Dopuštena (stari ZPU, čl. 79. st. 4.; novi ZPU, čl. 106. st. 3.; novi ZoG, čl. 73. st. 3.)",
            ],
            [
              "Nadogradnja ili dogradnja legalne kuće",
              <>
                <Navod id="clanak-49-dogradnja-2015">Sporno</Navod>. Praksa: odobrava se (6. poglavlje).
              </>,
              <>
                Odredba ukinuta; vrijede uvjeti za novu gradnju (<Navod id="clanak-49b-2025">čl. 49.b</Navod>)
              </>,
              "Dopuštena kao rekonstrukcija ako se ispune uvjeti GUP-a",
            ],
            [
              "Propisani plan izvan triju kategorija",
              <>
                U niskokonsolidiranim područjima priječi neposrednu gradnju (<Navod id="clanak-104-2015">čl. 104.</Navod>)
              </>,
              <>
                „Preporuka”: gradi se neposredno (<Navod id="preporuka-plana-2025">čl. 103. st. 4.</Navod>)
              </>,
              "Nema zakonske zabrane",
            ],
          ]}
        />

        <Detaljnije naslov="Što prijedlog oduzima postojećim kućama">
          <p>
            Prema postojećim kućama prijedlog je stroži. Popis iznimaka u <Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod> sužava se na „manje” građevine infrastrukture, a iznimka za proizvodne i poslovne građevine nestaje. Nestaje i mogućnost rekonstrukcije u postojećim gabaritima do donošenja plana, kao i rečenica o dogradnji i nadogradnji u niskokonsolidiranom području. Nestaju i <Navod id="clanak-49-izgradeni-dijelovi-2015">blaži uvjeti za izgrađene dijelove</Navod>: do 40 % manja čestica, Po+P+3, 1 m od međe te plaćanje umjesto osiguravanja parkirališnih mjesta. Prema novom <Navod id="clanak-49b-2025">čl. 49.b st. 2.</Navod> „rekonstrukcija postojećih građevina dozvoljena je pod istim uvjetima propisanim ovim Planom za izgradnju novih građevina”. Te promjene vrijede za cijeli grad, ali najjače pogađaju istok.
          </p>
          <p>
            Grad kaže da je to namjerno. Ozakonjenje od 2012. dalo je Splitu „cca 15000 ‚novih postojećih’ građevina ali koje su protivne planskim odredbama”, pa su pravila pooštrena „kako se, sada zakonitim ali ‚neplanskim’ građevinama, ne bi omogućile nove nadogradnje i dogradnje” (<Navod id="obrazlozenje-ozakonjenje-2025">Obrazloženje, str. 25</Navod>).
          </p>
        </Detaljnije>
        <Detaljnije naslov="Traži li zakon zabranu? Propisuje posljedicu, ali ne i oznaku">
          <p>
            Grad promjenu predstavlja kao posljedicu zakona: „na područjima na kojima je Zakonom prozvana obveza donošenja UPU-a, prije njegovog donošenja ne može se izdati lokacijska dozvola i građevinska dozvola za građenje nove građevine, dok je na područjima planske obveze preporuke … izdavanje navedenih akata moguće i prije donošenja tog plana” (<Navod id="obrazlozenje-zabrana-2025">Obrazloženje, § 2.1.1.4</Navod>). Županiji je odgovorio da novi UPU-i imaju „status sanacijskog plana ili plana urbane preobrazbe što je zakonom propisana obveza” (<V href={IZVOR.izvjesce}>Izvješće, str. 323</V>).
          </p>
          <p>
            To je <strong>točno kad je riječ o posljedici, ali nepotpuno kad je riječ o uzroku</strong>. Zakon traži „mjere za urbanu sanaciju” gdje prevladavaju ozakonjene zgrade (stari ZPU, čl. 53. st. 5.; novi čl. 77. st. 5.), ali ne traži da te mjere budu baš UPU. Dopušta i da GUP sam propiše uvjete s detaljnošću UPU-a, čime otpadaju i obveza UPU-a i zabrana (stari čl. 79. st. 2.; novi čl. 106. st. 4.; <V href={IZVOR.zpu153}>NN 153/13</V>, <V href={IZVOR.zpu155}>NN 155/25</V>). Taj put ima cijenu: Ministarstvo ga tumači tako da tekst i karte moraju biti „u mjerilu propisanom za urbanistički plan uređenja” (<V href={IZVOR.mpgiTinjan}>MPGI, 21. 3. 2024.</V>).
          </p>
          <p>
            Popis iznimaka u <Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod> odluka je Grada. Za ulice i javne građevine, prema našem tumačenju, možda je čak <em>širi</em> od zakonskog, premda to nije provjereno. O kućama ne kaže ništa, pa njima kroz riječi „ili Zakonom” ostaju samo zakonske iznimke za rekonstrukciju i zamjenu.
          </p>
          <p>
            Grad svoju sklonost nije skrivao. Županija je upozorila da takvi planovi „često … ostaju ‚mrtvo slovo na papiru’”. Grad je odgovorio da je GUP u ulozi provedbenog plana „anomalija u sustavu planiranja” i da planova užeg područja „treba biti što više” (<V href={IZVOR.izvjesce}>Izvješće, str. 148</V>).
          </p>

        </Detaljnije>
        <Podnaslov>Koliko zemljišta za gradnju oznake blokiraju</Podnaslov>
        <p>
          Zabrana ne dira ono što je već izgrađeno, nego slobodno zemljište na kojem bi se inače smjela graditi nova zgrada. U cijelom gradu to je <strong>{h(zbroj.slobodno_ha)} ha</strong>, od čega {h(zbroj.neizgradjene.ha)} ha na {neizgradjene.toLocaleString("hr-HR")} {imenicaUz(neizgradjene, ["neizgrađenoj čestici", "neizgrađene čestice", "neizgrađenih čestica"])}.
        </p>
        <Tablica
          zaglavlje={["Propisani UPU", "Slobodno zemljište (ha)", "Neizgrađene čestice"]}
          redovi={poUpu.map((r) => [
            r.naziv,
            r.slobodno_ha.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            r.neizgradjene.toLocaleString("hr-HR"),
          ])}
        />
        <p>
          Karta privatnog zemljišta pod zabranom (urbana sanacija i urbana preobrazba stambenih i mješovitih zona), s
          tražilicom adresa, nalazi se na stranici{" "}
          <Link href="/gup/zabrana" className="fokus font-semibold text-emerald-700 underline">
            Zabrana nove gradnje do donošenja UPU-a
          </Link>
          .
        </p>
        <Detaljnije naslov="Kako smo računali i koliko je zemljišta za stanovanje">
          <p>
            Zabrana ne dira ono što je već izgrađeno. Oznake iz prijedloga u cijelom gradu obuhvaćaju <strong>{h(zbroj.ukupno_ha)} ha</strong> ({h(zbroj.ha.sanacija)} ha urbane sanacije, {h(zbroj.ha.preobrazba)} ha urbane preobrazbe i {h(zbroj.ha.neuredeno)} ha neuređenih dijelova građevinskog područja), računajući samo ispunu koja se na listu vidi, unutar obuhvata GUP-a i izvan važećih planova. U zonama za gradnju (stambenoj, mješovitoj, gospodarskoj i turističkoj) od toga je {h(zbroj.gradnja_ukupno_ha)} ha, a ostalo su ulice, infrastruktura te javna, športska i zelena namjena, na kojima se privatna zgrada ne gradi ni bez zabrane. I u zonama za gradnju velik je dio izgrađen: ozakonjene kuće, brodogradilište. Zabrana pogađa zemljište koje je još slobodno za novu zgradu. Ova ga stranica broji čestica po čestica, istim izračunom kao <Link href="/gup?prikaz=grafikon" className="fokus text-emerald-700 underline">grafikon GUP-a</Link>, bez čestica kojima je većina na ulici ili javnoj, športskoj i zelenoj namjeni (primjerice u koridoru planirane ceste). Slobodno je zemljište koje ne zauzima zgrada s česticom koju joj odredbe propisuju, ni ulica, ni parkiralište ni park, a mora biti dovoljno veliko da na njega, zajedno sa slobodnim susjednim zemljištem, stane nova građevna čestica. Čestica koju zgrada troši računa se iz njezina tlocrta i bruto površine kroz najveći koeficijent izgrađenosti (kig) i iskoristivosti (kis) za to područje, a ne manje od najmanje građevne čestice. Za stambenu i mješovitu namjenu to su vrijednosti iz urbanih pravila; za gospodarsku i turističku namjenu, za razliku od grafikona, iz posebnih pravila urbanih pravila 3.1 i 3.2 (<Navod id="kig-gospodarska-2025">primjerice kig 0,4 i kisN+kisO 1,6 za poslovnu namjenu u pravilu 3.1</Navod>), gdje leži gotovo sva takva zemlja pod zabranom. Gradski projekti imaju samo ukupnu kvotu bruto površine, pa ondje zgrada troši cijeli komad čestice, osim ako pokriva manje od 3 % njega. Zone javne i društvene namjene nisu uključene jer se javne zgrade smiju graditi i prije UPU-a.
          </p>
          <p>
            Prema tom izračunu, <strong>na {h(zbroj.slobodno_ha)} ha slobodnog zemljišta nove se zgrade neće smjeti graditi bez UPU-a</strong>. Od toga <strong>{h(zbroj.neizgradjene.ha)} ha nalazi se na {neizgradjene.toLocaleString("hr-HR")} {imenicaUz(neizgradjene, ["čestici na kojoj", "čestice na kojima", "čestica na kojima"])} ništa nije izgrađeno</strong> (nema zgrade, okućnice ni gradilišta), a {h(zbroj.djelomicno.ha)} ha na slobodnim dijelovima {djelomicno.toLocaleString("hr-HR")} {imenicaUz(djelomicno, ["izgrađene čestice", "izgrađene čestice", "izgrađenih čestica"])}, primjerice na velikim dvorištima ili neizgrađenim dijelovima poslovnih čestica. Po namjeni je {h(zbroj.slobodno_po_zoni_ha.gospodarstvo ?? 0)} ha gospodarsko, {h(zbroj.slobodno_po_zoni_ha.stanovanje ?? 0)} ha stambeno i mješovito, a {h(zbroj.slobodno_po_zoni_ha.turizam ?? 0)} ha turističko zemljište.
          </p>
          <p>
            Za stanovanje: stambene i mješovite zone prijedloga (S, M, K5) zauzimaju {ha(z.ukupno)} ha, od čega je {ha(z.neiskoristeno)} ha neiskorišteno. <strong>Na {ha(z.ceka)} ha tog neiskorištenog zemljišta ({posto(z.ceka, z.neiskoristeno)}) nove se zgrade neće smjeti graditi bez UPU-a.</strong> {ha(z.poPlanu)} ha je u obuhvatu važećih planova, na {ha(z.poGupu)} ha moći će se graditi neposrednom provedbom GUP-a, a {ha(z.nijeZaGradnju)} ha premalo je za građevnu česticu ili ga isključuju odredbe zone. Pročitan doslovno, i važeći GUP već {ha(zemljiste[2015].ceka)} ha takvog zemljišta veže uz planove koji nikad nisu doneseni; kao što pokazuje 6. poglavlje, Grad je ondje ipak izdavao dozvole.
          </p>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="gradnja" naslov="6. Je li se gradilo, i to s dozvolom? Jest, ali manje nego što se čini">
        <Odgovor>
          Dozvole za nove kuće i manje stambene zgrade izdavale su se cijelo desetljeće i izdaju se i danas. No stvarno je novih zgrada malo: većina kuća koje se doimaju novima stajala je već 2011. i poslije je ozakonjena.
        </Odgovor>

        <Podnaslov>Oko 57 dozvola za nove zgrade, šest u Dračevcu</Podnaslov>
        <p>
          Od 2016. do rujna 2026. u obuhvatima UPU-a iz prijedloga izdano je oko 57 dozvola za nove stambene i stambeno-poslovne zgrade, od toga šest u Dračevcu. Nije nađen nijedan zahtjev odbijen zbog nedonesenog UPU-a.
        </p>
        <Slika
          src="/gup/analiza/dozvole-4c-istok.webp"
          sirina={1837}
          visina={966}
          opis="Dozvole za nove stambene zgrade 2014.–2026. ucrtane na list 4.c važećeg GUP-a, Mostine i Dračevac; sve se nalaze na plavoj rešetki obveze izrade UPU-a."
        >
          <strong>Slika 9.</strong> Dozvole za nove stambene zgrade (zeleno, s godinom) i zahtjevi u obradi (narančasto) na listu 4.c važećeg GUP-a. Sve točke leže na plavoj rešetki kojom je označena obveza izrade UPU-a.
        </Slika>

        <Detaljnije naslov="Dozvole u Dračevcu, proširenja i odbijeni zahtjevi">
          <p>
            Iz javnog registra Ministarstva (ISPU) prikupljeni su svi akti unutar obuhvata UPU-a iz prijedloga, a svaki je ucrtan na <Navod id="istok-4c-2008">list 4.c</Navod> (<V href={IZVOR.ispu}>ISPU</V>; <V href={IZVOR.biljeskeDozvole}>bilješke o prikupljanju</V>). Registar pokazuje <strong>oko 57 dozvola za nove stambene ili stambeno-poslovne zgrade izdanih od 2016. do rujna 2026.</strong> Sve se nalaze na plavoj rešetki „obveza izrade urbanističkog plana uređenja” s <Navod id="legenda-4c-2008">lista 4.c</Navod>, najmanje 30 m od svakog važećeg plana. Po područjima: zapadni Kamen 14, Kila 12, Orišac 11, sjeverni Stobreč 7, <strong>Dračevac 6</strong>, Mostine 5 i Žnjan 2. Kreću se od obiteljskih kuća do zgrada sa 6, 9, 13 i 42 stana. <strong>Izdavanje se ubrzalo 2025. i 2026.</strong>, nakon što su objavljena oba prijedloga. Prijedlog koji nije donesen nema pravnog učinka i odjel koji izdaje dozvole tako se i ponaša.
          </p>
          <p>Svih šest dozvola u Dračevcu izdano je za stambeni sjeveroistočni Dračevac, unutar UPU-a Dračevac 2 iz prijedloga:</p>
          <Tablica
            sirina="min-w-[40rem]"
            zaglavlje={["Klasa", "Datum", "Zgrada", "List 4.d prijedloga"]}
            redovi={[
              ["UP/I-361-03/20-01/000010", "17. 3. 2021.", "nova stambeno-poslovna zgrada", "sanacija"],
              ["UP/I-361-03/21-01/000049", "6. 7. 2021.", "jedan stan i jedan poslovni prostor", "sanacija"],
              ["UP/I-361-03/21-01/000240", "21. 7. 2022.", "Po+Pr+1K+N, jedan stan i jedna trgovina", "bez ispune"],
              ["UP/I-361-03/19-01/000158", "4. 5. 2023.", "stambena zgrada, 3 stana", "sanacija"],
              ["UP/I-361-03/23-01/000111", "30. 1. 2025.", "Po+Pr+2K, 2 stana i 2 poslovna prostora", "bez ispune"],
              ["UP/I-361-03/22-01/000095", "14. 5. 2025.", "1 stan i 1 ured", "bez ispune"],
            ]}
          />
          <p className="text-sm text-zinc-500">
            Izvor: <V href={IZVOR.ispu}>ISPU</V>.
          </p>
          <p>
            Izdavane su i dozvole za proširenja izvan „postojećih gabarita”: drugi kat na dvojnoj kući, čime su nastala tri stana (UP/I-361-03/22-01/000029, 29. 12. 2022.), i uređenje potkrovlja (UP/I-361-03/21-01/000054, 9. 10. 2023.). Blaže se tumačenje dakle primjenjuje i na proširenja, a ne samo na nove kuće. Jedan zahtjev za novu gradnju (UP/I-361-03/25-01/000080) je u obradi. Tri od šest dozvola u Dračevcu odnose se na zemljište koje prijedlog unutar granice UPU-a ostavlja bez ispune, pa će se ondje i dalje moći graditi neposrednom provedbom GUP-a (<Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod> prijedloga). Ostale tri i zahtjev u obradi odnose se na zemljište koje prijedlog označava kao sanaciju.
          </p>
          <p>
            Odbijeni zahtjevi ne upućuju na zabranu zbog UPU-a. U uzorku točaka najmanje 30 m unutar granice UPU-a iz prijedloga i najmanje 30 m od svakog važećeg plana nađeno je 10 odbijenih zahtjeva. <strong>Za pet čestica na kojima je zahtjev bio odbijen kasnije je izdana dozvola, a da u međuvremenu nije donesen nikakav UPU</strong>, pa se ta odbijanja nisu mogla temeljiti na nedonesenom planu. Jedini odbijeni zahtjev u Dračevcu je zahtjev za izdavanje lokacijske dozvole, odbijen 10. travnja 2025. (UP/I-350-05/23-01/000050) iz nepoznatih razloga, a novi zahtjev za isto zemljište je u obradi (<V href={IZVOR.ispu}>ISPU</V>). Nije nađen nijedan splitski sudski predmet u kojem bi presudan bio nedoneseni UPU (<V href={IZVOR.sudovi}>odluke.sudovi.hr</V>).
          </p>
          <p>
            Na javnoj raspravi 2024. samo je jedna primjedba, br. 208, tražila da se ukine „nemogućnost donošenja akata o gradnji do donošenja UPU-a”, a i ona se odnosila na prijedlog, a ne na važeći GUP (<V href={IZVOR.izvjesce}>Izvješće, str. 284–285</V>). Na ponovnoj javnoj raspravi u svibnju 2025. takvih primjedbi nije bilo (<V href={IZVOR.izvjescePonovna}>izvješće o ponovnoj javnoj raspravi, 2. 9. 2026.</V>).
          </p>
          <p>
            Jedan je obrazac zanimljiv, ali nije dokaz. U Harakovcu, gdje <Navod id="pravilo-3-2-2015">pravilo 3.2</Navod> nema odredbu „za ostalo”, ima oko 25 ozakonjenja, a <strong>nema nijedne</strong> dozvole za novu stambenu zgradu. Zemljište je ondje ipak većinom gospodarske namjene, pa se ni ne očekuje mnogo zahtjeva za stanovanje.
          </p>
        </Detaljnije>
        <Podnaslov>Oko 4 % zgrada nastalo je nakon 2017.</Podnaslov>
        <p>
          Na području istočnog Splita za koje važeći GUP propisuje UPU danas ima 635 zgrada. Nakon 2017. nastalo ih je 23 do 25, otprilike tri godišnje. Većina kuća koje se doimaju novima stajala je već 2011. i poslije je ozakonjena: na jednu dozvolu za novu zgradu dolazi više od 15 ozakonjenja.
        </p>
        <Detaljnije naslov="Kako smo brojali nove zgrade i ozakonjenja">
          <p>
            Nove zgrade brojane su na tlocrtima iz gradskog 3D modela, a starost im je utvrđena pregledom ortofoto snimaka Državne geodetske uprave iz 2011., 2017., 2021. i 2025./26. (<V href={IZVOR.dof2011}>DOF 2011</V>; <V href={IZVOR.dof2017}>DOF 2017</V>; <V href={IZVOR.dof2025}>DOF 2025/26</V>; <V href={IZVOR.popisZgrada}>popis zgrada</V>). Na području istočnog Splita za koje važeći GUP propisuje UPU danas ima 635 zgrada. Od toga je <strong>33–45 nastalo nakon 2011. (5–7 %), a 23–25 nakon 2017. (oko 4 %, otprilike tri godišnje)</strong>; otprilike četvrtinu čine poslovne hale i sportske građevine. U stambenom Dračevcu 2 brojke su <strong>5–9 od 2011. i 2–3 od 2017.</strong>
          </p>
          <p>
            U pojasu širokom 150 m odmah izvan tog područja gradilo se gušće: 10–12 % zgrada nastalo je nakon 2011., premda su od 2017. udjeli slični (5 % prema 4 %). Najuočljivije nove zgrade, Mall of Split i neboderi kod Kile i Brda, stoje uz južni rub Mostina, izvan tog područja. Šest novih zgrada unutar područja poklapa se s točkama dozvola, među njima i zgrada od oko 200 m² u Dračevcu 2 za koju je dozvola izdana u srpnju 2022.
          </p>
          <Tablica
            zaglavlje={["Područje", "Zgrada danas", "Nastalih nakon 2011.", "Nastalih nakon 2017."]}
            redovi={[
              ["UPU obvezan prema važećem GUP-u", "635", "33–45 (5–7\u00a0%)", "23–25 (≈ 4\u00a0%)"],
              ["Sanacija iz prijedloga, izvan važećih planova", "540", "19–30", "12–13"],
              ["UPU 18 Dračevac 2 iz prijedloga", "166", "5–9", "2–3"],
              ["UPU 17 Mostine iz prijedloga", "250", "14–18", "12–13"],
              ["Pojas od 150 m izvan područja iz prvog retka", "304", "29–36 (10–12\u00a0%)", "16–17 (5\u00a0%)"],
            ]}
          />
          <p>
            Ozakonjenja je daleko više nego dozvola. Na područjima UPU-a iz prijedloga sloj akata za uporabu u ISPU-u, u koje ulaze i rješenja o izvedenom stanju, pokazuje sljedeće (većinom izdano 2013.–2016.):
          </p>
          <Tablica
            zaglavlje={["Područje", "Rješenja o ozakonjenju", "Dozvole za novu gradnju"]}
            redovi={[
              ["Dračevac 2", "oko 120", "6"],
              ["Mostine", "146", "5"],
              ["Kila", "oko 200", "12"],
              ["Zapadni Kamen", "oko 170", "14"],
              ["Harakovac", "25", "0"],
            ]}
          />
          <p>
            Izvor: <V href={IZVOR.ispu}>ISPU</V>. Do 2016. Split je zaprimio 13.608 zahtjeva za ozakonjenje (<V href={IZVOR.index}>Index.hr, 3. 2. 2016.</V>).
          </p>
          <p>
            Sjećanje stanovnika nije pogrešno: gradilo se stalno, a dio toga i s dozvolom. No u samom Dračevcu nove zgrade s dozvolom iz posljednjeg desetljeća mogu se nabrojiti na prste obiju ruku. Većina kuća koje se doimaju novima stajala je već 2011. i ozakonjena je 2013.–2016. Velik dio ostale vidljive gradnje čine novi katovi i dogradnje tih kuća. Brojanjem tlocrta to se ne može uočiti (na ravnim krovovima iz 2011. poslije niču nove etaže), pa dojam da je kvart veliko gradilište navodi na precjenjivanje broja novih zgrada, ali ne i obujma gradnje.
          </p>
          <Slika
            src="/gup/analiza/nove-zgrade-istok.webp"
            sirina={1950}
            visina={1125}
            opis="Karta istočnog Splita s novim zgradama od 2011., obojenima po razdoblju u kojem su nastale."
            legenda={[
              { boja: "rgb(240,228,66)", tekst: "nastala 2011.–2017.", oblik: "tocka" },
              { boja: "rgb(230,159,0)", tekst: "nastala 2017.–2021.", oblik: "tocka" },
              { boja: "rgb(213,0,0)", tekst: "nastala 2021.–2025.", oblik: "tocka" },
              { boja: "rgb(160,0,200)", tekst: "stara zgrada zamijenjena novom", oblik: "tocka" },
              { boja: "rgb(120,120,120)", tekst: "prsten: razdoblje nije sigurno", oblik: "prsten" },
              { boja: "rgba(0,158,115,0.35)", tekst: "urbana sanacija iz prijedloga" },
              { boja: "rgb(0,114,178)", tekst: "granica područja za koje važeći GUP propisuje UPU", oblik: "crta" },
            ]}
          >
            <strong>Slika 10.</strong> Zgrade od najmanje 35 m² kojih nema na ortofotu iz 2011. Izvori: ortofoto snimke DGU-a i gradski 3D model, navedeni gore.
          </Slika>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="zasto" naslov="7. Zašto onda zabrana nastaje sada? Isto zemljište mijenja pravnu kategoriju">
        <p>
          <strong>Ne zato što se promijenio zakon.</strong> Isto zemljište prelazi iz obveze UPU-a koju propisuje GUP u obvezu koju propisuje zakon.
        </p>
        <p>
          Danas obvezu UPU-a propisuje sam GUP, a odjel koji izdaje dozvole tumači njegov tekst blago i ondje ih izdaje. Kad izmjene s oznakama iz prijedloga stupe na snagu, sam će zakon priječiti izdavanje dozvole, a zakon se ne može zaobići tumačenjem. <strong>Isto zemljište, drugi pravni temelj zabrane.</strong>
        </p>
        <p>Rizik je u tome što zabrana može dugo trajati: zakon joj ne određuje rok, a prijedlog ne predviđa ni rok ni sredstva za izradu propisanih UPU-a.</p>
        <Detaljnije naslov="Tekst, praksa i rizici: cijelo obrazloženje">
          <p>
            <strong>Ne zato što se 2026. promijenio zakon.</strong> NN 155/25 nastavlja pravilo iz 2014. i čak dodaje malu iznimku za čestice uz postojeće ceste. Zabrana nastaje <strong>premještanjem istog zemljišta iz jedne vrste obveze UPU-a u drugu</strong>.
          </p>
          <p>
            Od 2006. stambeni istočni Split živi pod obvezom koju je propisao <strong>plan</strong>: granicom s lista 4.c, iza koje stoji samo tekst GUP-a. Odjel koji izdaje dozvole taj je tekst čitao blago, bilo preko izraza <Navod id="pravilo-3-1-2015">„a za ostalo temeljem ovog Plana”</Navod> iz pravila 3.1, bilo preko <Navod id="clanak-49-dogradnja-2015">rečenice o dogradnji bez ograde</Navod>, bilo preko obojega. Prijedlog isto zemljište stavlja u kategoriju koju propisuje <strong>zakon</strong>, označivši ga kao „planirano za urbanu sanaciju” ili „neuređeno”.
          </p>
          <p>
            Kad se to dogodi, Zakon o gradnji kao uvjet za dozvolu traži da je UPU donesen (novi ZoG, čl. 73. st. 1. t. 6.; novi ZPU, čl. 180. st. 1. t. 4.), a službenik to ne može zaobići drukčijim tumačenjem neke rečenice GUP-a. Jedine su iznimke rekonstrukcija i zamjena postojeće građevine te, samo u neuređenom dijelu, lokacijska dozvola za novu zgradu uz postojeću javnu cestu. Lokacijsku dozvolu stranka smije zatražiti za svaku zgradu (novi ZPU, čl. 154. st. 1. t. 13.), a građevinska se dozvola tada izdaje prema njoj, bez provjere UPU-a (novi ZoG, čl. 74.), pa je taj put otvoren i obiteljskim kućama. Isti prijedlog ukida odredbe GUP-a o dogradnji legalnih kuća, a rekonstrukciju veže uz uvjete za novu gradnju, koje mnoge ozakonjene kuće ne mogu ispuniti. <strong>Isto zemljište, drugi pravni temelj zabrane.</strong> Grad u § 2.1.1.4 Obrazloženja i sam upravo tako razgraničava: zakonska obveza znači da se dozvole ne mogu izdati, a planska preporuka da mogu.
          </p>
          <p>
            <strong>Nesklad teksta i prakse razriješen je jednostavno: Grad zabranu nije provodio.</strong> Na papiru je „zabranjeno” uvjerljivije tumačenje važećeg GUP-a za novu kuću na čestici s pravilom 3.1 unutar granice s lista 4.c, a isto proizlazi i iz Obrazloženja Grada iz travnja 2025. Ipak, registar pokazuje oko 57 izdanih dozvola, šest u Dračevcu, i dozvole za proširenja izvan postojećih gabarita, a nijedan zahtjev odbijen iz tog razloga. I odgovor Grada na primjedbu br. 73 parametre pravila 3.1 shvaća kao pravila za gradnju do donošenja planova. Stanovnici se ravnaju prema praksi. Ta praksa, međutim, počiva na spornom tumačenju, a ne na jasnom pravilu: traje dok odjel tekst tako tumači, a prestat će sama od sebe čim stupe na snagu izmjene s oznakama iz prijedloga.
          </p>
          <p>
            <strong>Je li zakonska zabrana vrijedila već od 2014. do 2025., nije razriješeno.</strong> Najuvjerljivije tumačenje starog ZPU-a zabranu ograničava na zemljište koje plan označi, a važeći GUP u istočnom Splitu ništa tako ne označava. No čl. 201. st. 3. područja „urbane obnove” izjednačio je s preobrazbom, a pravilo 3.1 službeno se zove <Navod id="pravilo-3-1-naslov-2015">„…urbana obnova…”</Navod>. Ako je ta pretpostavka obuhvaćala područja s pravilom 3.1, mnoge su ondje dozvole od 2014. do 2025. izdane protivno zakonu. Nijedan sud ni ministarstvo to nije reklo, a Grad ih je svejedno izdavao.
          </p>
          <p>
            <strong>Zašto se Grad za to odlučio?</strong> Kao razloge navodi 15.000 ozakonjenih „novih postojećih” građevina i ciljeve koje prijedlog u <Navod id="clanak-106-sanacija-2025">čl. 106. st. 2.</Navod> postavlja UPU-ima urbane sanacije: ulice, komunalnu infrastrukturu, javne prostore i pravila za ozakonjene kuće, uključujući „uklanjanje (uz mogućnost nove gradnje) neuvjetnih građevina”. Ti su ciljevi legitimni.
          </p>
          <p>
            Rizik je u trajanju. Od 2014. zakonska zabrana nema rok, za razliku od privremene zabrane iz zakona iz 2007., koja je mogla trajati najdulje dvije godine i još jednu (<V href={IZVOR.zpug}>ZPUG, NN 76/07</V>), a prijedlog propisanim UPU-ima ne daje ni sredstva ni rokove. Visoki upravni sud ukidao je odredbe planova koje su gradnju uvjetovale budućim UPU-om „čije je donošenje neizvjesno”, pozivajući se na pravnu sigurnost (<V href={IZVOR.vus}>VUS, Usoz-73/16, NN 46/2017</V>). Prema praksi Europskog suda za ljudska prava duge zabrane gradnje bez preispitivanja i naknade mogu povrijediti pravo vlasništva (<V href={IZVOR.sporrong}>Sporrong i Lönnroth protiv Švedske</V>). Odredba plana iz koje zabrana izravno proizlazi ne može se u ocjeni zakonitosti ukinuti kao „protivna zakonu”, ali se izbor oznake i dalje može osporavati kao nerazmjeran.
          </p>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="sto-uciniti" naslov="Što stanovnici mogu učiniti do 16. studenoga 2026.">
        <ol className="list-decimal space-y-4 pl-5">
          <li>
            <strong>U javnom pozivu za inicijative (do 16. studenoga 2026.) zatražiti drukčije rješenje za Dračevac 2</strong>, po redu prvenstva:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                da se sa stambenog Dračevca 2 na <Navod id="istok-4d-2025">listu 4.d</Navod> ukloni ispuna urbane sanacije, tako da UPU ondje bude samo preporučen; tada bi se i dalje gradilo neposrednom provedbom GUP-a;
              </li>
              <li>ako se to ne prihvati, da GUP za stambeni Dračevac 2 sam propiše uvjete s detaljnošću UPU-a, pa zakonska obveza UPU-a ne bi ni nastala (novi ZPU, čl. 106. st. 4.);</li>
              <li>
                ako Grad ostane pri oznaci urbane sanacije, da GUP propiše prijelazne mjere za rekonstrukciju, zamjenu i dogradnju ozakonjenih kuća (novi ZPU, čl. 105. st. 2. t. 3.);
              </li>
              <li>
                uz bilo koje od tih rješenja, da se neuređeni dio uskladi s kriterijem Grada, a urbana sanacija sa zakonskim uvjetom te da se granice oznaka odrede po katastarskim česticama (
                <a href="#oznake" className="fokus text-emerald-700 underline">
                  2. poglavlje
                </a>
                ).
              </li>
            </ul>
            <span className="mt-2 block">Uz to treba tražiti rok i sredstva za izradu UPU-a Dračevac 2.</span>
          </li>
          <li>
            <strong>Zahtjevom za pristup informacijama doznati na što se odjel koji izdaje dozvole oslanja</strong>, tražeći obrazloženja nekoliko dozvola izdanih u Dračevcu.
          </li>
          <li>
            <strong>Vlasnici koji imaju projekt na zemljištu koje prijedlog označava kao sanaciju trebaju potražiti pravni savjet</strong>: danas postoji put do dozvole, a izmjene će ga zatvoriti.
          </li>
        </ol>
        <Detaljnije naslov="Obrazloženje i rješenja koja treba navesti u zahtjevu">
          <p>
            <strong>Utjecati se može na oznaku, a ne na zakon.</strong> <strong>Prvo, u javnom pozivu Grada za inicijative</strong> (1. listopada – 16. studenoga 2026.) stanovnici Dračevca 2 i izgrađenih dijelova Mostina mogu zatražiti tri stvari, ovim redom. Najprije <strong>da stambeni Dračevac 2 na <Navod id="istok-4d-2025">listu 4.d</Navod> bude „preporuka”</strong>: plava granica bez ispune sanacije, kakvu prijedlog već ima za oko 21 ha u Mostinama i Harakovcu te za dio samog Dračevca 2. Tada bi se do izrade UPU-a i dalje gradilo neposredno po parametrima GUP-a. Ako se to ne prihvati, <strong>da GUP za te ulice sam propiše uvjete s detaljnošću UPU-a</strong> (regulacijske pravce i pravila za čestice), pa zakonska obveza UPU-a ne bi ni nastala (novi ZPU, čl. 106. st. 4.). Ako Grad ostane pri sanaciji, <strong>da GUP izričito propiše prijelazne mjere</strong> (novi ZPU, čl. 105. st. 2. t. 3.). One bi trebale obuhvatiti rekonstrukciju, zamjenu postojećih građevina i dogradnju ozakonjenih kuća u okviru parametara pravila 3.1, vratiti rečenice o <Navod id="clanak-49-do-plana-2015">rekonstrukciji u postojećim gabaritima</Navod> i o <Navod id="clanak-49-dogradnja-2015">dogradnji u niskokonsolidiranom području</Navod> te reći kako se primjenjuje nova iznimka za lokacijsku dozvolu za čestice uz postojeće ceste.
          </p>
          <p>
            Kako god se odluči, inicijativa bi trebala tražiti i rok i proračunska sredstva za UPU Dračevac 2 te pitati u koji postupak poziv ulazi: u postupak izmjena iz 2021., iz kojeg je nastao prijedlog iz travnja 2025., ili u izradu plana nove generacije.
          </p>
          <p>
            <strong>Drugo, treba doznati na što se odjel koji izdaje dozvole zapravo oslanja.</strong> To bi razriješio zahtjev za pristup informacijama Gradu Splitu. U njemu treba tražiti obrazloženja rješenja UP/I-361-03/20-01/000010 (17. ožujka 2021., nova zgrada na zemljištu sanacije iz prijedloga), UP/I-361-03/19-01/000158 (4. svibnja 2023., tri stana na zemljištu sanacije iz prijedloga) i UP/I-361-03/22-01/000029 (29. prosinca 2022., dograđen drugi kat) te razloge odbijanja zahtjeva za lokacijsku dozvolu u Dračevcu od 10. travnja 2025. (UP/I-350-05/23-01/000050). Ako se odjel poziva na „za ostalo” iz pravila 3.1 ili na rečenicu o dogradnji u niskokonsolidiranom području, stanovnici bi imali pisani dokaz da se važeći GUP u praksi primjenjuje kao plan koji gradnju dopušta, a ne zabranjuje, i konkretan razlog da traže da prijedlog te odredbe zadrži.
          </p>
          <p>
            <strong>Treće, vlasnici koji imaju projekt na zemljištu sanacije iz prijedloga trebaju znati</strong> da u sadašnjoj praksi postoji put koji će izmjene zatvoriti. Tu je važan pravni savjet, jer nije utvrđeno što biva sa zahtjevom koji je još u obradi kad izmjene stupe na snagu.
          </p>
        </Detaljnije>
      </Poglavlje>

      <Poglavlje id="otvorena-pitanja" naslov="Otvorena pitanja">
        <p>Na sedam pitanja ova analiza ne može odgovoriti. Za svako je navedeno zašto je važno i kako bi se moglo razriješiti.</p>
        <Detaljnije naslov="Otvorena pitanja">
          <Tablica
            sirina="min-w-[44rem]"
            zaglavlje={["Pitanje", "Zašto je važno", "Kako ga razriješiti"]}
            redovi={[
              [
                "Na koju se odredbu GUP-a odjel za dozvole oslanja na zemljištu s pravilom 3.1 unutar granice s lista 4.c?",
                "O tome ovisi je li današnja praksa čvrsta ili krhka",
                "Zahtjev za pristup informacijama za dvije ili tri navedene dozvole",
              ],
              [
                "Je li čl. 201. st. 3. starog ZPU-a od 2014. do 2025. područja „urbane obnove” s pravilom 3.1 izjednačio s preobrazbom?",
                "Ako jest, dozvole su ondje bile zakonom zabranjene",
                "Mišljenje Ministarstva; ni uputa ni sudska praksa nisu pronađene",
              ],
              [
                "Obuhvaća li čl. 106. st. 2. t. 1. novog ZPU-a (neizgrađeno i neopremljeno) prazne čestice i prema važećem GUP-u? Priznaje li upravno tijelo iznimku za pristup cesti iz čl. 180. st. 2. t. 3. i kad GUP do UPU-a dopušta samo zahvate s popisa iz čl. 105. st. 5.?",
                "O tome ovisi jesu li neke čestice već pod zabranom i hoće li čestice uz postojeće ceste izbjeći buduću zabranu",
                "Mišljenje Ministarstva; obrazloženja novih zakona",
              ],
              [
                "Je li se tekst čl. 103. i 105. iz travnja 2025. promijenio nakon ponovne javne rasprave? Hoće li postupak iz 2021. biti dovršen ili će ga preteći novi poziv?",
                "O tome ovisi na koji tekst stanovnici odgovaraju",
                "Konačni prijedlog Grada; nadležni upravni odjel",
              ],
              ["Je li stambeni Dračevac bio unutar lista 4.c iz 2006.?", "Točno datira obvezu iz plana", "Grafički dio GUP-a iz 2006. (Sl. gl. 1/06)"],
              [
                "Zašto je 10. travnja 2025. odbijen zahtjev za lokacijsku dozvolu u Dračevcu?",
                "To je jedino nađeno odbijanje u kvartu",
                "Tekst rješenja, od podnositelja zahtjeva ili zahtjevom za pristup informacijama",
              ],
              [
                "Koji zakon i koji tekst plana vrijede za zahtjev koji je u obradi na dan stupanja izmjena na snagu?",
                "Važno za vlasnike koji imaju projekte",
                "Pravni savjet; Ministarstvo",
              ],
            ]}
          />
        </Detaljnije>
      </Poglavlje>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i način izračuna
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Navodi iz GUP-a vode točno na ono mjesto u planu na stranici{" "}
            <Link href="/gup/dokument" className="fokus text-emerald-700 underline">
              GUP Splita: tekst i karte
            </Link>
            , a odande na izvorni PDF na split.hr.
          </li>
          <li>
            Listovi 4.b i 4.c važećeg GUP-a i list 4.d prijedloga preneseni su na rešetku od 2 m, kao i ostali listovi na stranici{" "}
            <Link href="/gup#kako-je-izracunato" className="fokus text-emerald-700 underline">
              Split po GUP-u
            </Link>
            . Listovi 4.d i 4.c prijedloga pomaknuti su za oko 3,7 odnosno 4 m na položaj lista 1 (izmjereno usporedbom podloge). Važeći planovi ucrtani su u stvarnim granicama, preuzetima s listova samih planova u ISPU-u, jer ih list 4.d crta shematski: DPU dijela područja Dračevac ondje zauzima 1,5 ha, preko ceste i kuća, a plan je jedna čestica od 0,46 ha. Ispuna koju list skriva ispod bijelih, šrafiranih ploha važećih planova ne broji se, jer je list ne pokazuje. Na kartama urbanih pravila ulice nisu obojene: list iz 2025. ostavlja ih bijelima, a list iz 2014. i njih boji bojom pravila, pa bi usporedba inače pokazala razliku koje nema. Površine uz karte na Slici 2 vrijede za prikazani isječak, bez zemljišta pod važećim planovima.
          </li>
          <li>
            Prijedlog izmjena PPUG-a (odredbe, obrazloženje i listovi građevinskih područja 4.2–4.4) je na stranici{" "}
            <Link href="/gup/dokument/ppug-2025" className="fokus text-emerald-700 underline">
              PPUG, prijedlog 2025.
            </Link>
            . Listovi su uklopljeni prema brojevima katastarskih čestica ispisanima na njima (8.000 do 22.000 parova po listu, medijan odstupanja 1–1,5 m), a neuređeni dio, šrafura na listu, pročitan je iz PDF-a kao vektor. Odgovori Grada na primjedbe su iz izvješća o javnim raspravama o PPUG-u (<V href={IZVOR.izvjescePpug1}>ožujak 2025.</V>, <V href={IZVOR.izvjescePpug2}>rujan 2026.</V>) i o GUP-u.
          </li>
          <li>
            Sporne čestice (2. poglavlje): osi cesta iz gradskog registra nerazvrstanih cesta (2023.), širina katastarske čestice ceste izmjerena svaka 4 m okomito na os; kanalizacija iz gradskog GIS sloja mreže i kolektora; rješenja o izvedenom stanju iz registra ISPU (u repozitoriju se objavljuju samo zbrojevi po plohi). Izračun je u skriptama{" "}
            <V href="https://github.com/tomislavmamic/kvart/blob/main/scripts/gup-grad/sporne.py">sporne.py</V> i{" "}
            <V href="https://github.com/tomislavmamic/kvart/blob/main/scripts/gup-grad/ppug.py">ppug.py</V>.
          </li>
          <li>
            Slobodno zemljište računa se po katastarskim česticama, jednako kao na stranici{" "}
            <Link href="/gup/zabrana" className="fokus text-emerald-700 underline">
              Zabrana nove gradnje do donošenja UPU-a
            </Link>
            .
          </li>
          <li>
            Dozvole: javni registar akata Ministarstva prostornoga uređenja, graditeljstva i državne imovine (<V href={IZVOR.ispu}>ISPU</V>), prikupljen za obuhvate UPU-a iz prijedloga (<V href={IZVOR.biljeskeDozvole}>bilješke</V>). Popis pojedinih akata nije objavljen jer sadrži adrese privatnih zahvata.
          </li>
          <li>
            Nove zgrade: tlocrti iz gradskog 3D modela (najmanje 35 m², dijelovi krova koji se dodiruju spojeni u jednu zgradu), provjereni na ortofoto snimkama DGU-a iz 2011., 2017., 2021. i 2025./26.; nesigurni slučajevi dani su kao raspon (<V href={IZVOR.popisZgrada}>popis zgrada</V>).
          </li>
          <li>
            Zakoni iz Narodnih novina, sudske odluke s <V href={IZVOR.sudovi}>odluke.sudovi.hr</V>, izvješća s javnih rasprava i Obrazloženje sa split.hr, kako su navedeni u tekstu.
          </li>
          <li>
            Analiza je nastala 27. rujna 2026. kao odgovor na pitanje stanovnika, a brojke su osvježene 28. rujna 2026. Izvorno izvješće (na engleskom) i bilješke istraživanja su u{" "}
            <V href={IZVOR.izvorniIzvjestaj}>repozitoriju projekta</V> (<V href={IZVOR.biljeske}>bilješke</V>).
          </li>
        </ul>
      </section>
    </div>
  );
}
