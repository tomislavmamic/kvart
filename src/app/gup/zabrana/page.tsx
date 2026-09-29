import Link from "next/link";
import type { ReactNode } from "react";

import { Navod } from "@/components/gup-dokument/navod";
import { ZabranaPrikaz } from "@/components/gup-grad/zabrana-prikaz";
import { BOJE_ZABRANE, imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajSporne, ucitajZbrojZabrane, zemljisteZaStanovanje } from "@/lib/gup-grad/zabrana-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Zabrana nove gradnje do donošenja UPU-a",
  description:
    "Karta područja Splita na kojima prijedlog izmjena i dopuna GUP-a iz 2025. ne dopušta novu gradnju do donošenja urbanističkog plana uređenja, uz provjeru adrese.",
});

const ha = (m2: number) => Math.round(m2 / 1e4).toLocaleString("hr-HR");
const posto = (dio: number, cijelo: number) => `${Math.round((dio / cijelo) * 100)} %`;
const vanjska = "fokus text-emerald-700 underline";

interface Korak {
  kada: string;
  sto: string;
  tekst: ReactNode;
  /** Korak kojim zabrana nastaje ili bi nastala. */
  kljucni?: boolean;
  /** Još se nije dogodilo. */
  buduci?: boolean;
}

export default async function ZabranaPage() {
  const [zbroj, zemljiste, sporne] = await Promise.all([ucitajZbrojZabrane(), zemljisteZaStanovanje(), ucitajSporne()]);
  const plohaManjina = sporne.plohe.filter((p) => p.manjina).length;
  const z = zemljiste[2025];
  const redovi = [
    {
      naziv: "tek nakon UPU-a",
      opis: "urbana sanacija, urbana preobrazba ili neuređeno zemljište",
      m2: z.ceka,
      boja: "#dc2626",
      tamno: true,
    },
    { naziv: "u obuhvatu važećeg plana", opis: "gradi se prema tom UPU-u ili DPU-u", m2: z.poPlanu, boja: "#52525c", tamno: true },
    { naziv: "može se graditi odmah", opis: "neposrednom provedbom GUP-a", m2: z.poGupu, boja: "#7dd3fc", tamno: false },
    {
      naziv: "nije za gradnju",
      opis: "premale čestice, zabrane iz odredbi, neizgradiv teren",
      m2: z.nijeZaGradnju,
      boja: "#e4e4e7",
      tamno: false,
    },
  ];
  const udioIskoristenog = (z.iskoristeno / z.ukupno) * 100;

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
          Važeći GUP („Službeni glasnik Grada Splita”, br. 55/14) istočni Split ne svrstava ni u jednu od tih kategorija.
          Grad je ondje izdao oko 57 dozvola za nove stambene zgrade, od toga šest u Dračevcu (prema registru dozvola u
          ISPU-u).
        </>
      ),
    },
    {
      kada: "2019.",
      sto: "Iznimka za zgradu uz cestu",
      tekst: (
        <>
          Izmjena zakona dopušta lokacijsku dozvolu i prije UPU-a za novu zgradu koja ima pristup na prometnu površinu i
          rješenje odvodnje (
          <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html" className={vanjska}>
            NN 39/19
          </a>
          , čl. 146. st. 2. t. 3.). Grad kaže da se time obveza UPU-a „zaobilazila”.
        </>
      ),
    },
    {
      kada: "Travanj 2025.",
      sto: "Prijedlog izmjena i dopuna GUP-a",
      kljucni: true,
      tekst: (
        <>
          Na <Navod id="list-planske-mjere-2025">listu 4.d</Navod> {ha(zbroj.ukupno_ha * 1e4)} ha označeno je kao
          područje urbane sanacije, urbane preobrazbe ili neuređeni dio građevinskog područja, a prema{" "}
          <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod> ondje se može graditi samo na temelju UPU-a.
        </>
      ),
    },
    {
      kada: "1. siječnja 2026.",
      sto: "Novi Zakon o prostornom uređenju",
      tekst: (
        <>
          Novi zakon (
          <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html" className={vanjska}>
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
      sto: "Donošenje izmjena i dopuna",
      kljucni: true,
      buduci: true,
      tekst: (
        <>
          Ako Gradsko vijeće donese prijedlog, zabrana će vrijediti čim izmjene stupe na snagu, a prijedlog ne predviđa ni
          rok ni sredstva za izradu UPU-a.
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">
        <Link href="/planovi" className="fokus underline">
          Planovi
        </Link>{" "}
        · prijedlog izmjena i dopuna iz travnja 2025.
      </p>
      <h1 className="mt-1 text-2xl font-bold">Zabrana nove gradnje do donošenja UPU-a</h1>
      <p className="mt-3 max-w-3xl text-zinc-600">
        Ako Gradsko vijeće donese izmjene i dopune GUP-a predložene u travnju 2025., na zemljištu obojenom na karti neće se
        moći ishoditi građevinska dozvola za novu zgradu sve dok se za to područje ne donese urbanistički plan uređenja
        (UPU). Dvije od triju oznaka koje to uzrokuju određuje GUP, a treću PPUG.
      </p>

      <section className="mt-8">
        <h2 id="karta" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Gdje bi zabrana vrijedila
        </h2>
        <div className="mt-4">
          <ZabranaPrikaz
            poUpu={zbroj.po_upu}
            objasnjenje={
              <>
                <p className="max-w-3xl text-zinc-600">
                  Crvena je urbana sanacija, narančasta urbana preobrazba, a žut neuređeni dio građevinskog područja, unutar
                  obuhvata GUP-a. Narančastu i žutu preuzeli smo s <Navod id="list-planske-mjere-2025">lista 4.d</Navod>{" "}
                  prijedloga; list sanaciju crta zeleno, kao da je ondje sve u redu, a i ona priječi novu gradnju. Boje su samo u zonama
                  za gradnju (stambenoj, mješovitoj, gospodarskoj i turističkoj). Tamnijim su tonom iste boje čestice na kojima
                  ima mjesta za novu zgradu: na njima zabrana stvarno priječi gradnju. Svjetliji je ostatak zone, većinom
                  izgrađen; u neuređenom dijelu, koji bi po zakonu trebao biti neizgrađen, to su čestice na kojima već stoji
                  zgrada. Gotovo bijelo, kao izbrisano, ono je što list 4.d boji, a prijedlog namjenjuje ulicama, infrastrukturi, javnim sadržajima,
                  sportu ili zelenilu: ondje se privatna zgrada ne bi gradila ni bez zabrane. Izuzeta su područja
                  važećih planova jer se ondje i dalje gradi prema njima (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>).
                  Dio obuhvata propisanog UPU-a koji nije obojen do donošenja UPU-a gradi se neposrednom provedbom GUP-a (
                  <Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
                </p>
                <p className="mt-3 max-w-3xl border-l-4 border-fuchsia-600 bg-fuchsia-50 px-4 py-3 text-zinc-800">
                  <strong>Ljubičastim kosim crtama precrtane su sporne oznake</strong>; izdaleka je sporna čestica puna
                  ljubičasta mrlja. {sporne.pristup.cestice.toLocaleString("hr-HR")}{" "}
                  {imenicaUz(sporne.pristup.cestice, ["čestica", "čestice", "čestica"])} u neuređenom dijelu{" "}
                  {imenicaUz(sporne.pristup.cestice, ["graniči", "graniče", "graniči"])} s cestom čija
                  je katastarska čestica široka barem 4 m, a prema kriteriju iz obrazloženja prijedloga zemljište s pristupom
                  takvoj cesti nije neuređeno. U {plohaManjina} od {sporne.plohe.length} ploha urbane sanacije s barem 10 zgrada
                  rješenje o izvedenom stanju ima manje od polovine zgrada, iako zakon mjere urbane sanacije propisuje za područja
                  na kojima pretežu ozakonjene zgrade; u njima {imenicaUz(sporne.sanacija.cestice, ["je", "su", "je"])} još{" "}
                  {sporne.sanacija.cestice.toLocaleString("hr-HR")}{" "}
                  {imenicaUz(sporne.sanacija.cestice, ["sporna čestica", "sporne čestice", "spornih čestica"])}. Ljubičastim
                  točkama, a izdaleka blijedom mrljom,{" "}
                  {imenicaUz(sporne.cesta.cestice, ["označena je", "označene su", "označeno je"])} još{" "}
                  {sporne.cesta.cestice.toLocaleString("hr-HR")}{" "}
                  {imenicaUz(sporne.cesta.cestice, ["čestica", "čestice", "čestica"])} neuređenog dijela uz cestu koje nema u
                  gradskom registru ili joj se širina ne da izmjeriti: mogu biti sporne ako je cesta izvedena i javna. Kako smo to
                  provjerili i što se iz toga može tražiti, piše u{" "}
                  <Link href="/gup/analiza#oznake" className="fokus font-semibold text-emerald-700 underline">
                    analizi
                  </Link>
                  .
                </p>
              </>
            }
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 id="koliko" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Koliko zemljišta obuhvaća
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
          {[
            [`${ha(zbroj.gradnja_ukupno_ha * 1e4)} ha`, "zona za gradnju pod zabranom"],
            [`${ha(zbroj.slobodno_ha * 1e4)} ha`, "slobodnog zemljišta za novu gradnju"],
            [
              zbroj.neizgradjene.cestice.toLocaleString("hr-HR"),
              imenicaUz(zbroj.neizgradjene.cestice, ["neizgrađena čestica", "neizgrađene čestice", "neizgrađenih čestica"]),
            ],
          ].map(([v, n]) => (
            <div key={n} className="bg-white px-3 py-3 sm:px-4">
              <p className="font-mono text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">{v}</p>
              <p className="text-xs text-zinc-600 sm:text-sm">{n}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 max-w-3xl text-sm text-zinc-600">
          List 4.d boji {ha(zbroj.ukupno_ha * 1e4)} ha, ali{" "}
          {ha((zbroj.ukupno_ha - zbroj.gradnja_ukupno_ha) * 1e4)} ha od toga prijedlog namjenjuje ulicama, infrastrukturi,
          javnim sadržajima, sportu ili zelenilu, gdje se privatna zgrada ne gradi ni bez zabrane. Zabrana ne dira ni ono
          što je već izgrađeno, nego zemljište na kojem bi se inače smjela graditi nova zgrada. Od{" "}
          {ha(zbroj.slobodno_ha * 1e4)} ha takvog zemljišta pod zabranom {ha(zbroj.neizgradjene.ha * 1e4)} ha nalazi se na{" "}
          {zbroj.neizgradjene.cestice.toLocaleString("hr-HR")}{" "}
          {imenicaUz(zbroj.neizgradjene.cestice, ["neizgrađenoj čestici", "neizgrađene čestice", "neizgrađenih čestica"])}, a{" "}
          {ha(zbroj.djelomicno.ha * 1e4)} ha na slobodnim dijelovima {zbroj.djelomicno.cestice.toLocaleString("hr-HR")}{" "}
          {imenicaUz(zbroj.djelomicno.cestice, ["izgrađene čestice", "izgrađene čestice", "izgrađenih čestica"])} (npr. veliko
          dvorište ili neizgrađen dio poslovne čestice). Po namjeni:{" "}
          {ha((zbroj.slobodno_po_zoni_ha.stanovanje ?? 0) * 1e4)} ha stambene i mješovite,{" "}
          {ha((zbroj.slobodno_po_zoni_ha.gospodarstvo ?? 0) * 1e4)} ha gospodarske i{" "}
          {ha((zbroj.slobodno_po_zoni_ha.turizam ?? 0) * 1e4)} ha turističke namjene.
        </p>
      </section>

      <section className="mt-12">
        <h2 id="kako" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Kako bi zabrana stupila na snagu
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
          <strong>Isto zemljište, nova oznaka.</strong> Prema važećem GUP-u Grad na tim područjima izdaje dozvole. Kad ih
          prijedlog označi kao područja urbane sanacije, urbane preobrazbe ili neuređene dijelove građevinskog područja,
          dozvolu za novu zgradu do donošenja UPU-a priječi sam zakon. Koje će područje dobiti tu oznaku ipak odlučuje
          Grad: zakon dopušta i da GUP sam propiše uvjete gradnje s detaljnošću UPU-a (NN 155/25, čl. 106. st. 4.).
        </p>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Što o tome kažu važeći GUP i zakoni od 1994. naovamo, koliko se gradilo i što stanovnici mogu tražiti, pročitaj u{" "}
          <Link href="/gup/analiza" className="fokus font-semibold text-emerald-700 underline">
            analizi zabrane
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 id="tko" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Koji plan što zabranjuje
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          U obuhvatu GUP-a zabranu nosi GUP, njegov <Navod id="list-planske-mjere-2025">list 4.d</Navod> i{" "}
          <Navod id="obveza-plana-2025">čl. 103.</Navod> prijedloga. Oznake na tom listu, međutim, ne potječu sve iz GUP-a.
        </p>
        <div className="mt-4 max-w-4xl overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-500">
                <th className="py-2 pr-3 font-semibold">Oznaka</th>
                <th className="py-2 pr-3 font-semibold">Tko je određuje</th>
                <th className="py-2 pr-3 font-semibold">Mjerilo i podloga</th>
                <th className="py-2 pr-3 text-right font-semibold">ha</th>
                <th className="py-2 font-semibold">Kako se mijenja</th>
              </tr>
            </thead>
            <tbody className="align-top text-zinc-800">
              {(
                [
                  ["sanacija", "urbana sanacija", <>GUP, <Navod key="l" id="list-planske-mjere-2025">list 4.d</Navod></>, "1:10.000, topografska karta, bez čestica", "izmjenom GUP-a"],
                  ["preobrazba", "urbana preobrazba", <>GUP, <Navod key="l" id="list-planske-mjere-2025">list 4.d</Navod></>, "1:10.000, topografska karta, bez čestica", "izmjenom GUP-a"],
                  [
                    "neuredeno",
                    "neuređeni dio",
                    <>
                      PPUG, <Navod key="l" id="istok-ppug-2025">listovi građevinskih područja</Navod>; GUP ga preuzima na list 4.d
                    </>,
                    "1:5000, katastarski plan iz 2021., po česticama",
                    "izmjenom PPUG-a, a s njim i GUP-a",
                  ],
                ] as const
              ).map(([k, naziv, tko, mjerilo, izmjena]) => (
                <tr key={k} className="border-b border-zinc-200">
                  <td className="py-2 pr-3 font-semibold">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: BOJE_ZABRANE[k] }} />
                      {naziv}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{tko}</td>
                  <td className="py-2 pr-3">{mjerilo}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{ha(zbroj.ha[k] * 1e4)}</td>
                  <td className="py-2">{izmjena}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 max-w-3xl space-y-3 text-zinc-600">
          <p>
            Zakon je zamislio drukčije: unutar obuhvata GUP-a neuređeni dio određuje GUP, a PPUG samo izvan njega (stari
            Zakon o prostornom uređenju, čl. 78. st. 1. t. 1. i čl. 76. st. 1. t. 2., po kojem se ovaj postupak dovršava).
            Prijedlog GUP-a zato piše da su neuređeni dijelovi „određeni PPUG-om Splita” (
            <Navod id="clanak-106-neuredeno-2025">čl. 106. st. 1.</Navod>) i prenosi ih na svoj list. Zabranu tako nosi GUP,
            a granicu povlači PPUG. Kad se oba lista prenesu na istu podlogu, neuređeni se dio poklapa na 98 % površine, a
            ni na jednoj čestici pod zabranom listovi se ne razilaze. Da se razilaze, nije jasno koji bi prevladao.
          </p>
          <p>
            <strong>Zamjenjuje li novi GUP PPUG?</strong> Ne. PPUG je plan cijeloga grada, zajedno sa Žrnovnicom, Sitnom,
            Srinjinama i Slatinama, i određuje granice građevinskih područja. GUP je detaljniji plan središnjeg naselja i
            mora biti u skladu s njim. Grad mijenja oba plana usporedno, a oba prijedloga čekaju Gradsko vijeće. Novi javni
            poziv za inicijative nije dio tog postupka: njime Grad prikuplja prijedloge za sljedeće izmjene, i GUP-a i
            PPUG-a. Novi zakon predviđa da planovi doneseni po starim zakonima prestanu važiti u
            roku od sedam godina i da ih zamijene planovi nove generacije (
            <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html" className={vanjska}>
              NN 155/25
            </a>
            , čl. 238.), i to vrijedi za oba.
          </p>
          <p>
            <strong>Što ako se do neuređene čestice izgradi cesta?</strong> Oznaka na planu ostaje dok se PPUG i GUP ne
            izmijene, ali za novu zgradu tada ne treba ni UPU ni izmjena plana. Zakon dopušta lokacijsku dozvolu za
            „građenje nove zgrade koja ima pristup na postojeću javnu prometnu površinu te mogućnost rješavanja odvodnje
            otpadnih voda prema mjesnim prilikama određenim prostornim planom, ako se takvim građenjem ne sprečava opremanje
            drugog građevinskog zemljišta” (NN 155/25, čl. 180. st. 2. t. 3.). Lokacijsku dozvolu stranka smije zatražiti za
            svaku zgradu (čl. 154. st. 1. t. 13.), a građevinska se dozvola zatim izdaje prema njoj, bez nove provjere UPU-a
            (Zakon o gradnji, čl. 74.). Na taj put vlasnike neuređenih čestica upućuje i sam Grad. Da oznaka nestane, treba
            zatražiti da se čestica u PPUG-u i GUP-u prebaci u uređeni dio; Grad je to u raspravi o PPUG-u činio kad je
            vlasnik dokazao da je cesta izvedena. DPU se od 2014. više ne donosi. Za urbanu sanaciju i preobrazbu ta
            iznimka ne pomaže: ondje zakon do UPU-a dopušta samo rekonstrukciju i zamjenu postojeće zgrade (čl. 106. st.
            3.). To je naše čitanje zakona; uputa Ministarstva o tome nema.
          </p>
          <p>
            <strong>Zašto se u istočnom Splitu dosad gradilo?</strong> Iznimka za lokacijsku dozvolu postoji od 2019. (
            <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2019_04_39_801.html" className={vanjska}>
              NN 39/19
            </a>
            ), a Grad kaže da se njome obveza UPU-a „zaobilazila”. Dozvole u istočnom Splitu ipak ne objašnjava ona: u
            Kili, zapadnom dijelu Kamena i Dračevcu 2 registar od 25. travnja 2019. bilježi 33 građevinske dozvole za
            stambene, mješovite ili poslovne zgrade i samo četiri lokacijske dozvole. Građevinske dozvole izdavane su
            izravno, a za njih stari zakon takve iznimke nije imao (Zakon o gradnji, čl. 110. st. 2., NN 39/19). Izdavane
            su jer važeći GUP to zemljište ne označava ni kao neuređeno ni kao sanaciju (
            <Link href="/gup/analiza#vazeci-gup" className="fokus text-emerald-700 underline">
              analiza
            </Link>
            ).
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 id="stanovanje" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Koliko neiskorištenog zemljišta za stanovanje obuhvaća
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Prijedlog za stambenu (S) i mješovitu namjenu (M, K5) predviđa {ha(z.ukupno)} ha. Od toga je {ha(z.iskoristeno)}{" "}
          ha već iskorišteno, a na{" "}
          <strong className="text-red-700">
            {ha(z.ceka)} ha ({posto(z.ceka, z.neiskoristeno)})
          </strong>{" "}
          od preostalih {ha(z.neiskoristeno)} ha nove bi se zgrade smjele graditi tek nakon donošenja UPU-a.
        </p>

        <figure className="mt-5">
          <div className="flex justify-between text-sm text-zinc-600">
            <span>Iskorišteno: {ha(z.iskoristeno)} ha</span>
            <span className="font-semibold text-zinc-900">Neiskorišteno: {ha(z.neiskoristeno)} ha</span>
          </div>
          <div
            className="mt-1 flex h-9 overflow-hidden rounded-lg"
            role="img"
            aria-label={`Od ${ha(z.ukupno)} ha stambene i mješovite namjene iskorišteno je ${ha(z.iskoristeno)} ha, a neiskorišteno ${ha(z.neiskoristeno)} ha.`}
          >
            <div className="bg-zinc-300" style={{ width: `${udioIskoristenog}%` }} />
            <div className="bg-zinc-800" style={{ width: `${100 - udioIskoristenog}%` }} />
          </div>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-10 w-full" aria-hidden>
            <polygon points={`${udioIskoristenog},0 100,0 100,10 0,10`} fill="#e4e4e7" />
          </svg>
          <div
            className="flex h-14 overflow-hidden rounded-lg"
            role="img"
            aria-label={`Neiskorišteno zemljište: ${redovi.map((r) => `${r.naziv} ${ha(r.m2)} ha`).join(", ")}.`}
          >
            {redovi.map((r) => (
              <div
                key={r.naziv}
                className={`flex items-center px-2 font-mono text-sm font-bold tabular-nums ${r.tamno ? "text-white" : "text-zinc-900"}`}
                style={{ width: `${(r.m2 / z.neiskoristeno) * 100}%`, background: r.boja }}
              >
                <span className={r.m2 / z.neiskoristeno < 0.18 ? "hidden sm:inline" : ""}>{ha(r.m2)} ha</span>
              </div>
            ))}
          </div>
          <figcaption className="sr-only">Neiskorišteno zemljište stambene i mješovite namjene prema mogućnosti gradnje</figcaption>
        </figure>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {redovi.map((r) => (
            <li key={r.naziv} className="flex items-start gap-3 rounded-xl bg-white px-3 py-2.5">
              <span aria-hidden className="mt-1 h-4 w-4 shrink-0 rounded-sm border border-zinc-300" style={{ background: r.boja }} />
              <span className="flex-1">
                <span className="font-semibold text-zinc-900">{r.naziv}</span>
                <span className="block text-sm text-zinc-500">{r.opis}</span>
              </span>
              <span className="text-right font-mono text-sm tabular-nums text-zinc-900">
                {ha(r.m2)} ha
                <span className="block text-zinc-500">{posto(r.m2, z.neiskoristeno)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-sm text-zinc-600">
          Usporedbe radi: pročita li se doslovno, i važeći GUP gradnju na {ha(zemljiste[2015].ceka)} ha takvog zemljišta
          uvjetuje planovima koji nisu doneseni (<Navod id="obveza-plana-2015">čl. 104. i 105.</Navod>), no Grad je ondje
          posljednjih godina ipak izdavao dozvole. Prijedlog bi ta područja svrstao u kategoriju za koju zabranu propisuje
          zakon.
        </p>
      </section>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i način izračuna
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Područja zabrane preuzeta su s <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga i, kao i ostali
            listovi na stranici{" "}
            <Link href="/gup#kako-je-izracunato" className="fokus text-emerald-700 underline">
              Split po GUP-u
            </Link>
            , prenesena na rešetku od 2 m. Granice su točne na 5 do 15 m, pa je za česticu uz rub mjerodavan sam list.
          </li>
          <li>
            Obuhvat GUP-a preuzet je iz GIS izvoza Grada Splita, a obuhvati važećih planova s listova samih planova u
            ISPU-u. Kućni brojevi za tražilicu su iz gradskog adresnog registra.
          </li>
          <li>
            Slobodno zemljište računa se po katastarskim česticama, jednako kao na grafikonu GUP-a: slobodno je ono što nije
            pod zgradom s česticom koju joj odredbe propisuju, ulicom, parkiralištem, parkom i sl., a za gradnju je samo ako
            na njega, zajedno sa slobodnim susjednim zemljištem, stane nova građevna čestica. Premali ostaci se ne broje.
            Čestica je neizgrađena ako na njoj nema zgrade, okućnice ni gradilišta. Javne i društvene zone nisu uključene
            jer se javne zgrade smiju graditi i prije UPU-a.
          </li>
          <li>
            Sporne oznake: osi cesta iz gradskog registra nerazvrstanih cesta (2023.) i sloja državnih cesta; širina je
            širina katastarske čestice ceste, izmjerena svaka 4 m okomito na os, a ne širina kolnika. Rješenja o izvedenom
            stanju iz javnog registra akata Ministarstva (ISPU), zgrade iz gradskog 3D modela (tlocrti od 35 m²). Broje
            se samo čestice od najmanje 250 m² na kojima bi zabrana pogodila novu gradnju. Izračun je u skripti{" "}
            <a href="https://github.com/tomislavmamic/kvart/blob/main/scripts/gup-grad/sporne.py" className={vanjska}>
              sporne.py
            </a>
            .
          </li>
          <li>
            Iskorištenost zemljišta računa se jednako kao na{" "}
            <Link href="/gup?prikaz=grafikon" className="fokus text-emerald-700 underline">
              grafikonu GUP-a
            </Link>
            , prema zadanim pravilima („Po odredbama”).
          </li>
          <li>
            Dozvole izdane od 2016.: javni registar akata Ministarstva prostornoga uređenja, graditeljstva i državne
            imovine (ISPU). Pravila: <Navod id="obveza-plana-2025">čl. 103.</Navod> i{" "}
            <Navod id="do-plana-2025">čl. 105.</Navod> prijedloga te{" "}
            <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html" className={vanjska}>
              Zakon o prostornom uređenju (NN 155/25)
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
