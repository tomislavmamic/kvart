import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { Navod } from "@/components/gup-dokument/navod";
import { ZabranaPrikaz } from "@/components/gup-grad/zabrana-prikaz";
import { imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajSporne, ucitajStanjePremaPpug, ucitajZbrojZabrane } from "@/lib/gup-grad/zabrana-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Zabrana nove gradnje do donošenja UPU-a",
  description:
    "Karta privatnog zemljišta u Splitu na kojem novi GUP ne dopušta gradnju nove zgrade do donošenja urbanističkog plana uređenja, uz provjeru adrese.",
});

const ha = (m2: number) => Math.round(m2 / 1e4).toLocaleString("hr-HR");
/** Slobodno zemljište na karti mjeri se desecima hektara: cijeli bi hektari zbrojeni dali krivo. */
const ha1 = (h: number) => h.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const broj = (n: number) => n.toLocaleString("hr-HR");
const vanjska = "fokus text-emerald-700 underline";
const ZPU_2025 = "https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html";
/** Čestice u neizgrađenom uređenom dijelu PPUG-a koje list 4.d ostavlja bez oznake. */
const IZVAN_ZABRANE = "neizgrađeni uređeni dio bez oznake na listu 4.d";

/** Dio građevinskog područja na listu PPUG-a: izgrađeni, neizgrađeni uređeni, neizgrađeni neuređeni. */
const DIJELOVI_PPUG = ["I", "N", "U"] as const;
const NAZIV_DIJELA = { I: "izgrađeni dio", N: "neizgrađeni uređeni dio", U: "neizgrađeni neuređeni dio" } as const;
const OZNAKE_4D = ["sanacija", "preobrazba", "neuredeno", "bez"] as const;
const NAZIV_OZNAKE_4D = {
  sanacija: "područje urbane sanacije",
  preobrazba: "područje urbane preobrazbe",
  neuredeno: "neuređeni dio",
  bez: "bez oznake",
} as const;

/** Što vrijedi do donošenja UPU-a; objašnjenja su ispod tablice na stranici. */
type Ishod = "zabrana" | "cesta" | "gup" | "ppug";
const ISHOD: Record<Ishod, { naziv: string; klasa: string }> = {
  zabrana: { naziv: "zabrana", klasa: "bg-red-700 text-white" },
  cesta: { naziv: "uz cestu", klasa: "bg-amber-100 text-amber-950 ring-1 ring-amber-400" },
  gup: { naziv: "GUP", klasa: "bg-emerald-100 text-emerald-900" },
  ppug: { naziv: "GUP i PPUG", klasa: "bg-white text-emerald-900 ring-1 ring-emerald-500" },
};
/** Dva ishoda: list 4.d razilazi se s PPUG-om ili s tekstom GUP-a; prvi vrijedi ako prevlada list. */
const ISHOD_KOMBINACIJE: Record<(typeof DIJELOVI_PPUG)[number], Record<(typeof OZNAKE_4D)[number], Ishod[]>> = {
  I: { sanacija: ["zabrana"], preobrazba: ["zabrana"], neuredeno: ["cesta", "gup"], bez: ["gup"] },
  N: { sanacija: ["zabrana", "ppug"], preobrazba: ["zabrana", "ppug"], neuredeno: ["cesta", "ppug"], bez: ["ppug"] },
  U: { sanacija: ["zabrana", "cesta"], preobrazba: ["zabrana", "cesta"], neuredeno: ["cesta"], bez: ["cesta", "gup"] },
};

function IshodZnak({ ishod }: { ishod: Ishod }) {
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${ISHOD[ishod].klasa}`}>{ISHOD[ishod].naziv}</span>;
}

interface Korak {
  kada: string;
  sto: string;
  tekst: ReactNode;
  /** Korak kojim zabrana nastaje. */
  kljucni?: boolean;
  /** Još se nije dogodilo. */
  buduci?: boolean;
}

export default async function ZabranaPage() {
  const [zbroj, sporne, stanje] = await Promise.all([ucitajZbrojZabrane(), ucitajSporne(), ucitajStanjePremaPpug()]);
  const izvan = sporne.ppug_rupa;
  const prazne = Object.values(stanje.prazna).reduce((a, b) => a + b, 0);
  const saZgradomNeizgradeno = stanje.saZgradom.N + stanje.saZgradom.U;
  const t = sporne.ppug_4d;
  const zbrojCestica = (...c: { cestice: number; ha: number }[]) => ({
    cestice: c.reduce((a, x) => a + x.cestice, 0),
    ha: c.reduce((a, x) => a + x.ha, 0),
  });
  /** Gdje se list 4.d razilazi s PPUG-om ili s tekstom GUP-a. */
  const razilazenje = {
    sanacija: zbrojCestica(t.N.sanacija, t.N.preobrazba, t.U.sanacija, t.U.preobrazba),
    neuredeno: zbrojCestica(t.I.neuredeno, t.N.neuredeno),
  };
  const f = zbroj.fokus;
  const ostalaNamjena = (f.slobodno_po_zoni_ha.gospodarstvo ?? 0) + (f.slobodno_po_zoni_ha.turizam ?? 0);

  const koraci: Korak[] = [
    {
      kada: "2006.–2008.",
      sto: "GUP Splita",
      tekst: (
        <>
          Na <Navod id="list-detaljniji-planovi-2008">listu 4.c</Navod> propisana je obveza izrade UPU-a za Dračevac,
          Mostine, Kilu i druga prigradska naselja. Većina tih planova nikad nije izrađena.
        </>
      ),
    },
    {
      kada: "2014.",
      sto: "Zakon o prostornom uređenju",
      tekst: (
        <>
          Prema članku 79. UPU je obvezan za neuređene dijelove građevinskog područja i za izgrađene dijelove planirane za
          urbanu preobrazbu ili urbanu sanaciju, a do njegova donošenja ne može se izdati akt za građenje nove građevine (
          <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html" className={vanjska}>
            NN 153/13
          </a>
          ).
        </>
      ),
    },
    {
      kada: "2016.–2026.",
      sto: "Dozvole se i dalje izdaju",
      tekst: (
        <>
          Važeći GUP („Službeni glasnik Grada Splita”, br. 55/14) istočni Split ne svrstava ni u jednu od tih kategorija,
          pa je Grad ondje izdao oko 57 dozvola za nove stambene zgrade, od toga šest u Dračevcu (prema registru dozvola u
          ISPU-u).
        </>
      ),
    },
    {
      kada: "2019.",
      sto: "Iznimka za zgradu uz cestu",
      tekst: (
        <>
          Izmjenom zakona lokacijska se dozvola za novu zgradu s pristupom na prometnu površinu i rješenjem odvodnje može
          izdati i prije UPU-a (
          <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html" className={vanjska}>
            NN 39/19
          </a>
          , čl. 146. st. 2. t. 3.). Grad kaže da se time obveza UPU-a „zaobilazila”.
        </>
      ),
    },
    {
      kada: "Travanj 2025.",
      sto: "Prijedlog novog GUP-a",
      kljucni: true,
      tekst: (
        <>
          Na <Navod id="list-planske-mjere-2025">listu 4.d</Navod> {ha(zbroj.ukupno_ha * 1e4)} ha označeno je kao
          područje urbane sanacije, urbane preobrazbe ili neuređeni dio građevinskog područja, a ondje se prema{" "}
          <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod> smije graditi samo na temelju UPU-a.
        </>
      ),
    },
    {
      kada: "1. siječnja 2026.",
      sto: "Novi Zakon o prostornom uređenju",
      tekst: (
        <>
          Novi zakon (
          <a href={ZPU_2025} className={vanjska}>
            NN 155/25
          </a>
          ) zadržava to pravilo. U urbanoj sanaciji i preobrazbi do donošenja UPU-a dopuštene su samo rekonstrukcija i
          zamjena postojeće građevine (čl. 106. st. 3.). U neuređenom dijelu ostaje sužena iznimka iz 2019.: lokacijska
          dozvola za novu zgradu uz postojeću javnu cestu, s rješenjem odvodnje (čl. 180. st. 2. t. 3.).
        </>
      ),
    },
    {
      kada: "Sljedeći korak",
      sto: "Donošenje novog GUP-a",
      kljucni: true,
      buduci: true,
      tekst: <>Zabrana počinje vrijediti čim novi GUP stupi na snagu, a u njemu nema ni roka ni novca za izradu UPU-a.</>,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">
        <Link href="/planovi" className="fokus underline">
          Planovi
        </Link>{" "}
        · novi GUP, prijedlog izmjena i dopuna iz travnja 2025.
      </p>
      <h1 className="mt-1 text-2xl font-bold">Zabrana nove gradnje do donošenja UPU-a</h1>
      <p className="mt-3 max-w-3xl text-zinc-600">
        Kad Gradsko vijeće donese novi GUP (izmjene i dopune predložene u travnju 2025.), na zemljištu obojenom na karti
        neće se moći dobiti dozvola za novu zgradu dok se za to područje ne donese urbanistički plan uređenja (UPU).
        Postojeće će se zgrade i dalje smjeti obnoviti ili zamijeniti. Novi GUP ne predviđa ni rok ni novac za izradu tih
        planova, pa zabrana može potrajati.
      </p>

      <section className="mt-8">
        <h2 id="karta" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Područja u kojima se zamrzava gradnja
        </h2>
        <div className="mt-4">
          <ZabranaPrikaz
            poUpu={zbroj.po_upu}
            objasnjenje={
              <>
                <figure>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["/gup/zabrana/list-4d-dracevac.webp", "List 4.d novog GUP-a", "Izrez lista 4.d novog GUP-a za Dračevac 2: zelena ispuna urbane sanacije i žuta neuređenog dijela ispod plave mreže obuhvata UPU-a."],
                        ["/gup/zabrana/karta-dracevac.webp", "Isto područje na karti iznad", "Dračevac 2 na karti ove stranice: crveno su obojene samo čestice urbane sanacije, tamnije prazne, a svjetlije čestice sa zgradom."],
                      ] as const
                    ).map(([src, naslov, opis]) => (
                      <div key={src}>
                        <p className="mb-1 text-sm font-semibold text-zinc-900">{naslov}</p>
                        <a href={src} className="fokus block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            width={1100}
                            height={903}
                            alt={opis}
                            loading="lazy"
                            className="h-auto w-full rounded-lg border border-zinc-200"
                          />
                        </a>
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-3 max-w-3xl space-y-2 text-sm text-zinc-600">
                    <p>
                      <strong className="text-zinc-900">
                        Na <Navod id="list-planske-mjere-2025">listu 4.d</Navod> novog GUP-a
                      </strong>{" "}
                      za Dračevac 2 zeleno je urbana sanacija, a žuto neuređeni dio. Plavom je mrežom označen obuhvat UPU-a,
                      a crvenim prugama planovi na snazi. List je u mjerilu 1:10.000 i ne razlikuje čestice.
                    </p>
                    <p>
                      <strong className="text-zinc-900">Na karti ove stranice</strong> obojena je svaka čestica na kojoj se
                      zamrzava gradnja: tamnije prazne, a svjetlije čestice sa zgradom. Neuređeni dio nije obojen jer se ondje uz
                      postojeću javnu cestu dozvola za novu zgradu može dobiti i prije UPU-a.
                    </p>
                  </figcaption>
                </figure>

                <h3 id="koliko" className="mt-8 scroll-mt-20 font-bold text-zinc-900">
                  Koliko zemljišta obuhvaća
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
                  {[
                    [`${ha(f.gradnja_ukupno_ha * 1e4)} ha`, "zona za gradnju pod zabranom"],
                    [`${ha1(f.slobodno_ha)} ha`, "slobodnog zemljišta za novu zgradu"],
                    [
                      broj(f.neizgradjene.cestice),
                      `${imenicaUz(f.neizgradjene.cestice, ["prazna čestica", "prazne čestice", "praznih čestica"])} s mjestom za zgradu`,
                    ],
                  ].map(([v, n]) => (
                    <div key={n} className="bg-white px-3 py-3 sm:px-4">
                      <p className="font-mono text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">{v}</p>
                      <p className="text-xs text-zinc-600 sm:text-sm">{n}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 max-w-3xl text-sm text-zinc-600">
                  Zabrana ne pogađa postojeće zgrade, nego slobodno zemljište na kojem bi se inače smjela graditi
                  nova zgrada: {ha1(f.neizgradjene.ha)} ha na praznim česticama i {ha1(f.djelomicno.ha)} ha na
                  slobodnim dijelovima {broj(f.djelomicno.cestice)}{" "}
                  {imenicaUz(f.djelomicno.cestice, ["čestice sa zgradom", "čestice sa zgradom", "čestica sa zgradom"])}{" "}
                  (primjerice u velikim dvorištima). Od toga {ha1(f.slobodno_po_zoni_ha.stanovanje ?? 0)} ha otpada na
                  stambenu i mješovitu, a {ha1(ostalaNamjena)} ha na gospodarsku i turističku namjenu.
                </p>
              </>
            }
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 id="kako" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Kako zabrana stupa na snagu
        </h2>
        <ol className="mt-5 space-y-5 border-l-2 border-zinc-200 pl-5">
          {koraci.map((k) => (
            <li key={k.kada} className="relative">
              <span
                aria-hidden
                className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ${
                  k.buduci ? "border-2 border-red-700 bg-white" : k.kljucni ? "bg-red-700" : "bg-zinc-400"
                }`}
              />
              <p className={`font-mono text-sm font-bold ${k.kljucni ? "text-red-700" : "text-zinc-500"}`}>{k.kada}</p>
              <h3 className="font-bold text-zinc-900">{k.sto}</h3>
              <p className="mt-0.5 max-w-2xl text-zinc-600">{k.tekst}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl border-l-4 border-red-700 bg-white px-4 py-3 text-zinc-800">
          <strong>Isto zemljište, nova oznaka.</strong> Po važećem GUP-u Grad na tim područjima izdaje dozvole. Kad ih
          novi GUP označi kao urbanu sanaciju, urbanu preobrazbu ili neuređeni dio građevinskog područja, izdavanje dozvole za
          novu zgradu do donošenja UPU-a priječi sam zakon. Koje će područje dobiti tu oznaku ipak odlučuje Grad: zakon
          dopušta i to da GUP sam propiše uvjete gradnje s detaljnošću UPU-a (NN 155/25, čl. 106. st. 4.).
        </p>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Što o tome kažu važeći GUP i zakoni od 1994. naovamo, koliko se gradilo i što stanovnici mogu tražiti, piše u{" "}
          <Link href="/gup/analiza" className="fokus font-semibold text-emerald-700 underline">
            analizi zabrane
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 id="izvan-zabrane" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Ima li u obuhvatu UPU-a neizgrađenog dijela građevinskog područja izvan zabrane?
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-900">
          <strong>Ima.</strong> Zabranu nosi oznaka na <Navod id="list-planske-mjere-2025">listu 4.d</Navod> novog GUP-a, a
          ne obuhvat UPU-a (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod> i{" "}
          <Navod id="obuhvat-izvan-cekanja-2025">st. 3.</Navod>). Neizgrađeni uređeni dio građevinskog područja list 4.d ne
          označava, pa se na njemu do donošenja UPU-a gradi neposrednom provedbom GUP-a i kad je unutar obuhvata propisanog
          UPU-a, uz uvjete koje PPUG postavlja za uređeni dio (<Navod id="odredba-ppug-83-2025">čl. 83. st. 5.</Navod>). Što
          vrijedi na pojedinoj čestici ovisi o dvama listovima: u kojem je dijelu građevinskog područja na{" "}
          <Navod id="istok-ppug-2025">listu 4.4 PPUG-a</Navod> i koju oznaku ima na listu 4.d. Svih dvanaest kombinacija
          prikazano je u tablici niže.
        </p>

        <h3 className="mt-6 font-bold text-zinc-900">Pojmovi</h3>
        <p className="mt-1 max-w-3xl text-zinc-600">
          Izgrađeno, neizgrađeno, uređeno i neuređeno u planovima i zakonima ne znače svugdje isto. Na ovoj stranici svaka od
          tih riječi ima samo jedno značenje.
        </p>
        <dl className="mt-3 max-w-3xl space-y-4 text-zinc-600">
          <div>
            <dt className="font-bold text-zinc-900">Dijelovi građevinskog područja (PPUG, list 4.4)</dt>
            <dd className="mt-1 space-y-1">
              <p>PPUG dijeli građevinsko područje po katastarskim česticama. Definicije su iz starog ZPU-a (čl. 3., NN 39/19):</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-zinc-800">izgrađeni dio</strong> je „područje određeno prostornim planom koje je
                  izgrađeno” (t. 13.). PPUG ga je odredio prema ortofotu iz 2021. (
                  <Navod id="odredba-ppug-6-izgradjeno-2025">čl. 6. st. 2.</Navod>). Na listu je žut, a u tumaču se zove
                  „izgrađeno”.
                </li>
                <li>
                  <strong className="text-zinc-800">neizgrađeni dio</strong> je „područje određeno prostornim planom planirano za
                  daljnji razvoj” (t. 23.) i dijeli se na dva dijela:
                  <ul className="mt-1 list-[circle] space-y-1 pl-5">
                    <li>
                      <strong className="text-zinc-800">neizgrađeni neuređeni dio</strong> je onaj „na kojemu nije izgrađena
                      planirana osnovna infrastruktura” (t. 24.), odnosno odvodnja otpadnih voda i prometna površina preko
                      koje se pristupa čestici (t. 25.). Na listu je šrafiran, a u tumaču se zove „neuređeno”.
                    </li>
                    <li>
                      <strong className="text-zinc-800">neizgrađeni uređeni dio</strong> je ostatak: neizgrađeni dijelovi koji
                      nisu prikazani kao neuređeni „smatraju se ‚uređenima‘” (PPUG,{" "}
                      <Navod id="odredba-ppug-6-2025">čl. 6. st. 1.</Navod>). Na listu je svijetložut bez šrafure, a u tumaču se
                      zove „neizgrađeno”.
                    </li>
                  </ul>
                </li>
              </ul>
              <p>Na uređeni i neuređeni dijeli se samo neizgrađeni dio; izgrađeni dio nije ni jedno ni drugo.</p>
            </dd>
          </div>
          <div>
            <dt className="font-bold text-zinc-900">Oznake novog GUP-a (list 4.d)</dt>
            <dd className="mt-1">
              Tumač lista 4.d ima tri oznake: područje urbane sanacije, područje urbane preobrazbe i neuređeni dio
              neizgrađenog građevinskog područja „prema PPUG-u Splita”. Prve dvije GUP veže uz izgrađeni dio (
              <Navod id="obveza-plana-2025">čl. 103. st. 1. t. 2. i 3.</Navod>), a neuređeni dio preuzima iz PPUG-a (
              <Navod id="clanak-106-neuredeno-2025">čl. 106. st. 1.</Navod>). Za te tri oznake UPU je obvezan, a na ostatku
              obuhvata UPU-a, koji je bez oznake, samo preporučen (<Navod id="legenda-4d-2025">tumač lista 4.d</Navod>).
            </dd>
          </div>
          <div>
            <dt className="font-bold text-zinc-900">Stanje čestice (karta ove stranice)</dt>
            <dd className="mt-1">
              <strong className="text-zinc-800">Čestica sa zgradom</strong> ima zgradu, okućnicu ili gradilište, a{" "}
              <strong className="text-zinc-800">prazna čestica</strong> nema ništa od toga. Stanje čestice i dio
              građevinskog područja nisu isto. Na karti ima {broj(prazne)}{" "}
              {imenicaUz(prazne, ["prazna čestica", "prazne čestice", "praznih čestica"])}; PPUG od njih{" "}
              {broj(stanje.prazna.I)} vodi kao izgrađeni dio, a {broj(saZgradomNeizgradeno)}{" "}
              {imenicaUz(saZgradomNeizgradeno, ["česticu sa zgradom", "čestice sa zgradom", "čestica sa zgradom"])} kao
              neizgrađeni dio. Pravno je stanje čestice bitno za rekonstrukciju i zamjenu, koje traže postojeću zgradu.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-zinc-900">„Uređeno” u zakonu i pravilniku</dt>
            <dd className="mt-1">
              Zakon o prostornom uređenju „uređenim građevinskim zemljištem” naziva zemljište za koje se mogu ishoditi akti za
              gradnju (NN 155/25, čl. 205. st. 4.), a Pravilnik o prostornim planovima uređenim dijelom smatra površine
              opremljene osnovnom infrastrukturom (NN 152/23, čl. 39. st. 3.). Uređeni dio PPUG-a nije ni jedno ni drugo: PPUG
              ga određuje kao ostatak neizgrađenog dijela, pa čestica u njemu ne mora biti opremljena, a gradnja na njoj nije
              bezuvjetna (vidi „GUP i PPUG” niže).
            </dd>
          </div>
        </dl>

        <figure className="mt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                {
                  src: "/gup/zabrana/rupa-ppug-4-4.webp",
                  naslov: "List 4.4 PPUG-a",
                  tumac: [
                    [{ background: "#ffff00" }, "„izgrađeno” = izgrađeni dio"],
                    [{ background: "#fffbb0" }, "„neizgrađeno” = neizgrađeni uređeni dio"],
                    [{ background: "repeating-linear-gradient(-45deg, #18181b 0 1px, #fffbb0 1px 5px)" }, "„neuređeno” = neizgrađeni neuređeni dio"],
                    [{ border: "2px solid #c026d3" }, IZVAN_ZABRANE],
                  ],
                },
                {
                  src: "/gup/zabrana/rupa-gup-4d.webp",
                  naslov: "List 4.d novog GUP-a",
                  tumac: [
                    [{ background: "#86e08a" }, "područje urbane sanacije"],
                    [{ background: "#f5a623" }, "područje urbane preobrazbe"],
                    [{ background: "#fdf5a6" }, "neuređeni dio prema PPUG-u"],
                    [{ background: "repeating-linear-gradient(0deg, #2563eb 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, #2563eb 0 1px, #fff 1px 5px)" }, "obuhvat UPU-a"],
                    [{ background: "repeating-linear-gradient(90deg, #dc2626 0 1px, #fff 1px 4px)" }, "važeći plan užeg područja"],
                    [{ border: "2px solid #c026d3" }, IZVAN_ZABRANE],
                  ],
                },
                {
                  src: "/gup/zabrana/rupa-ortofoto.webp",
                  naslov: "Ortofoto 2025.",
                  tumac: [
                    [{ background: "color-mix(in srgb, #ef4444 50%, white)" }, "jedna od triju oznaka lista 4.d"],
                    [{ background: "#c026d3" }, IZVAN_ZABRANE],
                    [{ border: "2px solid #2563eb" }, "obuhvat UPU-a"],
                  ],
                },
              ] as const
            ).map((k) => (
              <div key={k.src}>
                <p className="mb-1 text-sm font-semibold text-zinc-900">{k.naslov}</p>
                <a href={k.src} className="fokus block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={k.src} width={760} height={624} alt={k.naslov} loading="lazy" className="h-auto w-full rounded-lg border border-zinc-200" />
                </a>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700">
                  {k.tumac.map(([stil, naziv]) => (
                    <li key={naziv} className="flex items-center gap-1.5">
                      <span aria-hidden className="inline-block h-3 w-5 shrink-0 rounded-sm" style={stil} />
                      {naziv}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <figcaption className="mt-3 max-w-3xl text-sm text-zinc-600">
            Dračevac 2, isto područje na sve tri slike. Ljubičasto obrubljene čestice na listu 4.4 PPUG-a su u neizgrađenom
            uređenom dijelu (svijetložuto, bez šrafure); na listu 4.d na njihovu mjestu nema nijedne od triju oznaka, iako su
            unutar obuhvata UPU-a. Uz nazive iz tumača lista 4.4 (u navodnicima) stoje nazivi koje rabi ova stranica.
          </figcaption>
        </figure>

        <h3 className="mt-8 font-bold text-zinc-900">Što vrijedi do donošenja UPU-a</h3>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Redak je dio građevinskog područja na listu PPUG-a, a stupac oznaka na listu 4.d. U polju su broj čestica, njihova
          ukupna površina i što na njima vrijedi do donošenja UPU-a. Brojene su čestice od najmanje 250 m² koje su barem
          polovinom u obuhvatu propisanog UPU-a izvan važećih planova (listovi 4.2–4.4 PPUG-a). Čestica ima oznaku koja
          pokriva barem polovinu njezine površine. U neizgrađenom neuređenom dijelu je ako je šrafirana barem polovinom, a u
          izgrađenom ili neizgrađenom uređenom dijelu ako je šrafirana na manje od petine, prema boji koja na njoj
          prevladava; ostale čestice nisu brojene. Gdje stoje dva ishoda, listovi se razilaze (objašnjeno ispod tablice).
        </p>
        <div className="mt-2 max-w-3xl overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
            <thead>
              <tr className="text-zinc-500">
                <th className="py-1 pr-3 font-semibold" rowSpan={2}>
                  PPUG, list 4.4
                </th>
                <th className="border-b border-zinc-200 py-1 text-center font-semibold" colSpan={4}>
                  oznaka na listu 4.d novog GUP-a
                </th>
              </tr>
              <tr className="border-b border-zinc-300 text-zinc-500">
                {OZNAKE_4D.map((o) => (
                  <th key={o} className="py-2 pl-2 text-right align-bottom font-semibold">
                    {NAZIV_OZNAKE_4D[o]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-800">
              {DIJELOVI_PPUG.map((r) => (
                <tr key={r} className="border-b border-zinc-200">
                  <td className="py-2 pr-3 align-top font-semibold">{NAZIV_DIJELA[r]}</td>
                  {OZNAKE_4D.map((o) => {
                    const c = sporne.ppug_4d[r][o];
                    const istakni = r === "N" && o === "bez";
                    return (
                      <td
                        key={o}
                        className={`py-2 pl-2 text-right align-top ${istakni ? "bg-fuchsia-100 text-fuchsia-950" : ""}`}
                      >
                        <span className={`font-mono tabular-nums ${istakni ? "font-bold" : ""}`}>
                          {c.cestice ? broj(c.cestice) : "–"}
                        </span>
                        {c.cestice ? <span className="block font-mono text-xs text-zinc-500">{ha1(c.ha)} ha</span> : null}
                        <span className="mt-1 flex flex-wrap items-center justify-end gap-1 text-xs text-zinc-500">
                          {ISHOD_KOMBINACIJE[r][o].map((i, n) => (
                            <Fragment key={i}>
                              {n > 0 && "ili"}
                              <IshodZnak ishod={i} />
                            </Fragment>
                          ))}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 max-w-3xl space-y-2 text-sm text-zinc-600">
          <div>
            <dt className="inline">
              <IshodZnak ishod="zabrana" />
            </dt>{" "}
            <dd className="inline">
              Nova zgrada tek nakon UPU-a (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Do tada su dopuštene
              rekonstrukcija i zamjena postojeće zgrade (ZPU, čl. 106. st. 3. i čl. 180. st. 2. t. 1. i 2.; Zakon o gradnji, čl.
              73. st. 3.) te ulice, manje prometne i komunalne građevine i javne i društvene zgrade (
              <Navod id="do-plana-2025">čl. 105. st. 5.</Navod>). Iznimka za novu zgradu uz postojeću javnu cestu ovdje,
              prema našem čitanju, ne vrijedi: za urbanu sanaciju i preobrazbu zakon do UPU-a predviđa samo prijelazne mjere za
              rekonstrukciju i zamjenu (ZPU, čl. 106. st. 3.).
            </dd>
          </div>
          <div>
            <dt className="inline">
              <IshodZnak ishod="cesta" />
            </dt>{" "}
            <dd className="inline">
              UPU je obvezan (<Navod id="obveza-plana-2025">čl. 103. st. 1. t. 1.</Navod>) i vrijedi sve što i pod „zabrana”,
              ali se lokacijska dozvola za novu zgradu može dobiti i prije UPU-a ako čestica ima pristup na postojeću javnu
              prometnu površinu i mogućnost rješavanja odvodnje otpadnih voda, a time se ne sprečava opremanje drugog
              građevinskog zemljišta (ZPU, čl. 180. st. 2. t. 3.).
            </dd>
          </div>
          <div>
            <dt className="inline">
              <IshodZnak ishod="gup" />
            </dt>{" "}
            <dd className="inline">
              Gradi se neposrednom provedbom GUP-a, i unutar obuhvata UPU-a (
              <Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
            </dd>
          </div>
          <div>
            <dt className="inline">
              <IshodZnak ishod="ppug" />
            </dt>{" "}
            <dd className="inline">
              Gradi se neposrednom provedbom GUP-a, ali PPUG svoj prikaz neuređenog dijela naziva usmjeravajućim i na čestici
              prikazanoj kao uređena gradnju dopušta samo ako je čestica uz prometnu površinu u funkciji široku najmanje 4 m ili
              je za tu površinu izdana građevinska dozvola, ako se može priključiti na odvodnju otpadnih voda i niskonaponsku
              mrežu i ako se osigura koridor za proširenje ceste (<Navod id="odredba-ppug-83-2025">čl. 83. st. 5.</Navod>).
            </dd>
          </div>
        </dl>

        <h4 className="mt-5 text-sm font-bold text-zinc-900">Gdje se listovi razilaze</h4>
        <ul className="mt-1 max-w-3xl list-disc space-y-2 pl-5 text-sm text-zinc-600">
          <li>
            <strong className="text-zinc-800">Urbana sanacija ili preobrazba na neizgrađenom dijelu</strong> (
            {broj(razilazenje.sanacija.cestice)} {imenicaUz(razilazenje.sanacija.cestice, ["čestica", "čestice", "čestica"])},{" "}
            {ha1(razilazenje.sanacija.ha)} ha). GUP te oznake veže uz izgrađeni
            dio („izgrađeni dijelovi građevinskog područja planirani za urbanu sanaciju”, čl. 103. st. 1. t. 2. i 3.), a za
            područja zabrane upućuje na list 4.d (<Navod id="clanak-103-karta-2025">čl. 103. st. 2.</Navod>). Ako prevlada
            list, vrijedi „zabrana”; ako tekst, vrijedi ono što vrijedi bez te oznake: „GUP i PPUG” na uređenom, a „uz cestu”
            na neuređenom dijelu.
          </li>
          <li>
            <strong className="text-zinc-800">Oznaka neuređenog dijela izvan neuređenog dijela PPUG-a</strong> (
            {broj(razilazenje.neuredeno.cestice)}{" "}
            {imenicaUz(razilazenje.neuredeno.cestice, ["čestica", "čestice", "čestica"])}, {ha1(razilazenje.neuredeno.ha)} ha). Neuređeni dio određuje
            PPUG (čl. 106. st. 1.; tumač lista 4.d: „prema PPUG-u Splita”), a po zakonu on je dio neizgrađenog dijela (stari
            ZPU, čl. 3. t. 24.). Ako prevlada list 4.d, vrijedi „uz cestu”; ako PPUG, „GUP” na izgrađenom, a „GUP i PPUG” na
            uređenom dijelu.
          </li>
          <li>
            <strong className="text-zinc-800">Neuređeni dio PPUG-a bez oznake na listu 4.d</strong> (
            {broj(sporne.ppug_4d.U.bez.cestice)} {imenicaUz(sporne.ppug_4d.U.bez.cestice, ["čestica", "čestice", "čestica"])},{" "}
            {ha1(sporne.ppug_4d.U.bez.ha)} ha). Ako prevlada PPUG, vrijedi „uz
            cestu”; ako list 4.d, „GUP”.
          </li>
        </ul>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Novi GUP ne kaže što vrijedi kad se list 4.d razilazi s PPUG-om ili s njegovim vlastitim tekstom. Za sve stupce
          vrijedi još jedno: zakon UPU propisuje i za dijelove građevinskog područja „koji nisu izgrađeni i opremljeni
          osnovnom infrastrukturom” (ZPU, čl. 106. st. 2. t. 1.) i pritom ne upućuje na plan. Doslovno čitano, to obuhvaća
          svaku praznu česticu do koje nisu izvedene cesta i odvodnja, s oznakom ili bez nje.
        </p>

        <h3 className="mt-8 font-bold text-zinc-900">Gdje je neizgrađeni uređeni dio bez oznake</h3>
        <p className="mt-1 max-w-3xl text-zinc-600">
          U obuhvatima propisanih UPU-a izvan važećih planova ima {broj(izvan.cestice)}{" "}
          {imenicaUz(izvan.cestice, ["takva čestica", "takve čestice", "takvih čestica"])} od najmanje 250 m² (istaknuto u
          tablici), ukupno {ha1(izvan.ha)} ha, sve u istočnom Splitu. U javnoj raspravi o PPUG-u Grad je u neizgrađeni
          uređeni dio prebacivao i čestice vlasnika koji su dokazali da je cesta do njih izvedena.
        </p>
        <div className="mt-2 max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-500">
                <th className="py-2 pr-3 font-semibold">Propisani UPU</th>
                <th className="py-2 pr-3 text-right font-semibold">čestice</th>
                <th className="py-2 text-right font-semibold">ha</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800">
              {izvan.po_upu.map((r) => (
                <tr key={r.broj} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-3">{r.naziv ?? "izvan ucrtanih obuhvata UPU-a"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{broj(r.cestice)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{ha1(r.ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          Na karti iznad takva čestica nije obojena. Klik na nju otvara karticu „Gradnja je moguća” s napomenom da je zabrana
          ne obuhvaća iako je u obuhvatu UPU-a. Karta je precrtana sa skeniranih listova i točna je na 5 do 15 m, pa je za
          česticu uz rub oznake mjerodavan sam list.
        </p>
      </section>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i način izračuna
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Oznake s <Navod id="list-planske-mjere-2025">lista 4.d</Navod> i namjena zona s lista 1 novog GUP-a prenesene su,
            kao i na stranici{" "}
            <Link href="/gup#kako-je-izracunato" className="fokus text-emerald-700 underline">
              Split po GUP-u
            </Link>
            , na rešetku od 2 m. Granice su zato točne na 5 do 15 m, pa je za česticu uz rub mjerodavan sam list. Obuhvati
            važećih planova preuzeti su s njihovih listova u ISPU-u, a obuhvat GUP-a i kućni brojevi iz gradskih GIS
            podataka.
          </li>
          <li>
            Slobodno zemljište računa se po katastarskim česticama, kao na grafikonu GUP-a: slobodno je ono što ne zauzimaju
            zgrada s česticom koju joj odredbe propisuju, ulica, parkiralište ni park, a za gradnju je samo ako na njega,
            zajedno sa slobodnim susjednim zemljištem, stane nova građevna čestica. Čestica je prazna ako na njoj nema
            zgrade, okućnice ni gradilišta. Dio građevinskog područja (izgrađeni, neizgrađeni uređeni ili neizgrađeni
            neuređeni) pročitan je s listova 4.2–4.4 PPUG-a po boji i šrafuri pod svakom česticom.
          </li>
          <li>
            Dozvole od 2016.: javni registar akata Ministarstva prostornoga uređenja, graditeljstva i državne imovine (ISPU).
            Pravila: <Navod id="obveza-plana-2025">čl. 103.</Navod> i <Navod id="do-plana-2025">čl. 105.</Navod> novog GUP-a te{" "}
            <a href={ZPU_2025} className={vanjska}>
              Zakon o prostornom uređenju (NN 155/25)
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
