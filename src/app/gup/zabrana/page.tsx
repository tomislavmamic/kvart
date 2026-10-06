import Link from "next/link";
import type { ReactNode } from "react";

import { Navod } from "@/components/gup-dokument/navod";
import { ZabranaPrikaz } from "@/components/gup-grad/zabrana-prikaz";
import { imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajSporne, ucitajZbrojZabrane } from "@/lib/gup-grad/zabrana-podaci";
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
/** Čestice koje PPUG vodi kao neizgrađene bez šrafure, a list 4.d ostavlja bez oznake. */
const IZVAN_ZABRANE = "neizgrađena „uređena” čestica bez oznake na listu 4.d";

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
  const [zbroj, sporne] = await Promise.all([ucitajZbrojZabrane(), ucitajSporne()]);
  const izvan = sporne.ppug_rupa;
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
                        ["/gup/zabrana/karta-dracevac.webp", "Isto područje na karti iznad", "Dračevac 2 na karti ove stranice: crveno su obojene samo čestice urbane sanacije, tamnije neizgrađene, a svjetlije izgrađene."],
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
                      zamrzava gradnja: tamnije neizgrađene, a svjetlije izgrađene. Neuređeni dio nije obojen jer se ondje uz
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
                      `${imenicaUz(f.neizgradjene.cestice, ["neizgrađena čestica", "neizgrađene čestice", "neizgrađenih čestica"])} s mjestom za zgradu`,
                    ],
                  ].map(([v, n]) => (
                    <div key={n} className="bg-white px-3 py-3 sm:px-4">
                      <p className="font-mono text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">{v}</p>
                      <p className="text-xs text-zinc-600 sm:text-sm">{n}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 max-w-3xl text-sm text-zinc-600">
                  Zabrana ne pogađa ono što je već izgrađeno, nego slobodno zemljište na kojem bi se inače smjela graditi
                  nova zgrada: {ha1(f.neizgradjene.ha)} ha na neizgrađenim česticama i {ha1(f.djelomicno.ha)} ha na
                  slobodnim dijelovima {broj(f.djelomicno.cestice)}{" "}
                  {imenicaUz(f.djelomicno.cestice, ["izgrađene čestice", "izgrađene čestice", "izgrađenih čestica"])}{" "}
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
          Ima li unutar obuhvata UPU-a neizgrađenog zemljišta izvan zabrane?
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-900">
          <strong>Ima.</strong> Zabrana ne obuhvaća neizgrađeni „uređeni” dio građevinskog područja koji novi GUP na listu
          4.d ostavlja bez ijedne od triju oznaka. To su čestice koje PPUG na listu 4.4 prikazuje kao neizgrađene, ali ne i
          kao neuređene (svijetložuto, bez šrafure). Na njima se do donošenja UPU-a gradi neposrednom provedbom GUP-a i kad
          su unutar obuhvata propisanog UPU-a (<Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
        </p>

        <h3 className="mt-6 font-bold text-zinc-900">Zašto ih zabrana ne obuhvaća</h3>
        <ol className="mt-2 max-w-3xl list-decimal space-y-2 pl-5 text-zinc-600">
          <li>
            <strong className="text-zinc-900">Zabranu nosi oznaka, a ne obuhvat UPU-a.</strong> Samo na temelju UPU-a gradi se
            u urbanoj sanaciji, urbanoj preobrazbi i neuređenom dijelu građevinskog područja, „ako ovim odredbama ili Zakonom
            nije određeno drugačije” (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>). Iznimke su rekonstrukcija i
            zamjena postojeće zgrade (NN 155/25, čl. 106. st. 3.) te ulice, manje infrastrukturne građevine i javne zgrade (
            <Navod id="do-plana-2025">čl. 105. st. 5.</Navod>). Ostatak obuhvata propisanog UPU-a do njegova donošenja gradi
            se neposrednom provedbom GUP-a (čl. 103. st. 3.).
          </li>
          <li>
            <strong className="text-zinc-900">Neuređeni dio ne određuje GUP, nego PPUG.</strong> Urbanu sanaciju i urbanu
            preobrazbu GUP crta sam, a neuređeni su dijelovi oni „određeni PPUG-om Splita” (
            <Navod id="clanak-106-neuredeno-2025">čl. 106. st. 1.</Navod>), koje GUP prenosi na{" "}
            <Navod id="list-planske-mjere-2025">list 4.d</Navod>.
          </li>
          <li>
            <strong className="text-zinc-900">PPUG neizgrađeno dijeli na „uređeno” i neuređeno.</strong> Na{" "}
            <Navod id="istok-ppug-2025">listu 4.4</Navod> (Split istok, Kamen, Stobreč; mjerilo 1:5000, po katastarskim
            česticama) građevinsko je područje podijeljeno na izgrađeni dio (žuto) i neizgrađeni dio (svijetložuto), a unutar
            neizgrađenog šrafurom je označen neuređeni dio. Neuređeni je dio neizgrađeni dio na kojem nije izgrađena planirana
            osnovna infrastruktura, odnosno prometna površina i odvodnja otpadnih voda (stari ZPU, čl. 3. t. 24. i 25., NN
            39/19). Neizgrađeni dio bez šrafure PPUG naziva „uređenim” (
            <Navod id="odredba-ppug-6-2025">čl. 6. st. 1.</Navod>).
          </li>
          <li>
            <strong className="text-zinc-900">Neizgrađeni „uređeni” dio ostaje bez oznake.</strong> Takva čestica nije ni
            neuređena ni u urbanoj sanaciji ili preobrazbi, pa na listu 4.d nema nijedne od triju oznaka i zabrana je ne
            obuhvaća. Uvjete gradnje na njoj ipak postavlja PPUG: svoj prikaz neuređenog dijela naziva usmjeravajućim, pa se na
            čestici prikazanoj kao „uređena” gradi samo ako je uz prometnu površinu u funkciji široku najmanje 4 m ili je za tu
            površinu izdana građevinska dozvola, ako se može priključiti na odvodnju otpadnih voda i niskonaponsku mrežu i ako
            se osigura koridor za proširenje ceste (<Navod id="odredba-ppug-83-2025">čl. 83. st. 5.</Navod>).
          </li>
        </ol>

        <figure className="mt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {(
              [
                {
                  src: "/gup/zabrana/rupa-ppug-4-4.webp",
                  naslov: "List 4.4 PPUG-a",
                  tumac: [
                    [{ background: "#ffff00" }, "izgrađeno"],
                    [{ background: "#fffbb0" }, "neizgrađeno"],
                    [{ background: "repeating-linear-gradient(-45deg, #18181b 0 1px, #fffbb0 1px 5px)" }, "neuređeno"],
                    [{ border: "2px solid #c026d3" }, IZVAN_ZABRANE],
                  ],
                },
                {
                  src: "/gup/zabrana/rupa-gup-4d.webp",
                  naslov: "List 4.d novog GUP-a",
                  tumac: [
                    [{ background: "#86e08a" }, "urbana sanacija"],
                    [{ background: "#f5a623" }, "urbana preobrazba"],
                    [{ background: "#fdf5a6" }, "neuređeni dio"],
                    [{ background: "repeating-linear-gradient(0deg, #2563eb 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, #2563eb 0 1px, #fff 1px 5px)" }, "obuhvat UPU-a"],
                    [{ background: "repeating-linear-gradient(90deg, #dc2626 0 1px, #fff 1px 4px)" }, "plan na snazi"],
                    [{ border: "2px solid #c026d3" }, IZVAN_ZABRANE],
                  ],
                },
                {
                  src: "/gup/zabrana/rupa-ortofoto.webp",
                  naslov: "Ortofoto 2025.",
                  tumac: [
                    [{ background: "color-mix(in srgb, #ef4444 50%, white)" }, "jedna od triju oznaka (zabrana)"],
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
            Dračevac 2, isto područje na sve tri slike. Ljubičasto obrubljene čestice na listu 4.4 PPUG-a svijetložute su
            bez šrafure, dakle neizgrađene i „uređene”; na listu 4.d na njihovu mjestu nema ispune, iako su unutar obuhvata
            UPU-a.
          </figcaption>
        </figure>

        <h3 className="mt-8 font-bold text-zinc-900">Kako se listovi poklapaju</h3>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Sve čestice od najmanje 250 m² koje su većim dijelom u obuhvatu propisanog UPU-a izvan važećih planova (listovi
          4.2–4.4 PPUG-a): razred na PPUG-u prema oznaci na listu 4.d. Čestica nosi oznaku koja pokriva više od pola njezine
          površine, a bez oznake je ako nijedna oznaka ne pokriva više od pola. U svakom polju broj čestica, a ispod površina
          cijelih čestica.
        </p>
        <div className="mt-2 max-w-3xl overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-500">
                <th className="py-2 pr-3 font-semibold">PPUG</th>
                {["urbana sanacija", "urbana preobrazba", "neuređeni dio", "bez oznake"].map((o) => (
                  <th key={o} className="py-2 pr-3 text-right font-semibold">
                    {o}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-zinc-800">
              {(
                [
                  ["I", "izgrađeno"],
                  ["N", "neizgrađeno („uređeno”)"],
                  ["U", "neuređeno"],
                ] as const
              ).map(([r, naziv]) => (
                <tr key={r} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-3 font-semibold">{naziv}</td>
                  {(["sanacija", "preobrazba", "neuredeno", "bez"] as const).map((o) => {
                    const c = sporne.ppug_4d[r][o];
                    const istakni = r === "N" && o === "bez";
                    return (
                      <td
                        key={o}
                        className={`py-1.5 pr-3 text-right font-mono tabular-nums ${istakni ? "bg-fuchsia-100 font-bold text-fuchsia-950" : ""}`}
                      >
                        {c.cestice ? broj(c.cestice) : "–"}
                        {c.cestice ? <span className="block text-xs text-zinc-500">{ha1(c.ha)} ha</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 max-w-3xl space-y-2 text-sm text-zinc-600">
          <li>
            <strong className="text-zinc-900">Neizgrađeno („uređeno”), bez oznake (istaknuto):</strong> te čestice zabrana ne
            obuhvaća.
          </li>
          <li>
            <strong className="text-zinc-900">Neuređeno, bez oznake:</strong> {broj(sporne.ppug_4d.U.bez.cestice)} čestica (
            {ha1(sporne.ppug_4d.U.bez.ha)} ha) PPUG šrafira kao neuređene, a list 4.d ih ne označava. Kako neuređeni dio određuje
            PPUG (čl. 106. st. 1.), zabrana bi za njih mogla vrijediti i bez oznake na listu 4.d; novi GUP ne kaže koji list
            prevladava kad se razilaze.
          </li>
          <li>
            <strong className="text-zinc-900">Neizgrađeno („uređeno”), a označeno kao urbana sanacija ili preobrazba:</strong>{" "}
            {broj(sporne.ppug_4d.N.sanacija.cestice + sporne.ppug_4d.N.preobrazba.cestice)} čestica (
            {ha1(sporne.ppug_4d.N.sanacija.ha + sporne.ppug_4d.N.preobrazba.ha)} ha). List 4.d ih označava, pa su pod zabranom.
          </li>
          <li>
            <strong className="text-zinc-900">Izgrađeno, bez oznake:</strong> izgrađeni dio koji novi GUP ne označava kao
            urbanu sanaciju ili preobrazbu. Ondje se do donošenja UPU-a gradi neposrednom provedbom GUP-a (čl. 103. st. 3.).
          </li>
        </ul>

        <h3 className="mt-8 font-bold text-zinc-900">Gdje su te čestice</h3>
        <p className="mt-1 max-w-3xl text-zinc-600">
          U obuhvatima propisanih UPU-a izvan važećih planova ima {broj(izvan.cestice)}{" "}
          {imenicaUz(izvan.cestice, ["takva čestica", "takve čestice", "takvih čestica"])} od najmanje 250 m², ukupno{" "}
          {ha1(izvan.ha)} ha (površina cijelih čestica), sve u istočnom Splitu. U javnoj raspravi o PPUG-u Grad je u
          neizgrađeni „uređeni” dio prebacivao i čestice vlasnika koji su dokazali da je cesta do njih izvedena.
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
            zajedno sa slobodnim susjednim zemljištem, stane nova građevna čestica. Čestica je neizgrađena ako na njoj nema
            zgrade, okućnice ni gradilišta.
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
