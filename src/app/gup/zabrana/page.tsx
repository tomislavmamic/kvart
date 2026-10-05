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
  const rupa = sporne.ppug_rupa;
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
        <h2 id="rupa" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Ima li u zabrani rupa?
        </h2>
        <div className="mt-3 max-w-3xl space-y-3 text-zinc-600">
          <p className="text-zinc-900">
            <strong>Ima.</strong> Na dijelu praznih čestica unutar obuhvata UPU-a moći će se graditi i bez UPU-a, odmah po
            novom GUP-u.
          </p>
          <p>
            Zabrana ne vrijedi za cijeli obuhvat UPU-a, nego samo za zemljište koje novi GUP na listu 4.d označi kao urbanu
            sanaciju, urbanu preobrazbu ili neuređeni dio. Neuređeni dio GUP ne određuje sam, nego ga preuzima iz PPUG-a, s{" "}
            <Navod id="istok-ppug-2025">lista 4.4 „Građevinska područja – Split istok, Kamen, Stobreč”</Navod>. Taj list za
            svaku česticu određuje je li izgrađena, neizgrađena ili neuređena. Neuređena je prazna čestica do koje
            nisu izvedene cesta i odvodnja; neizgrađena je prazna čestica do koje jesu, obično uz postojeću cestu.
          </p>
          <p>
            Novi GUP preuzima samo neuređene čestice. Neizgrađena čestica zato na njegovu listu 4.d ostaje bez ikakve oznake,
            a bez oznake nema ni zabrane: na njoj se gradi prema uvjetima samog GUP-a, kao i drugdje u gradu, iako je unutar
            obuhvata UPU-a (<Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
          </p>
        </div>

        <figure className="mt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["/gup/zabrana/rupa-ppug-dracevac.webp", "List 4.4 PPUG-a", "Izrez lista 4.4 PPUG-a za Dračevac 2: žuto izgrađeno, šrafirano neuređeno, a ljubičasto obrubljene svijetložute neizgrađene čestice."],
                ["/gup/zabrana/rupa-4d-dracevac.webp", "List 4.d novog GUP-a", "Isto područje na listu 4.d novog GUP-a: ljubičasto obrubljene čestice nemaju oznaku, iako su unutar obuhvata UPU-a."],
              ] as const
            ).map(([src, naslov, opis]) => (
              <div key={src}>
                <p className="mb-1 text-sm font-semibold text-zinc-900">{naslov}</p>
                <a href={src} className="fokus block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} width={1100} height={903} alt={opis} loading="lazy" className="h-auto w-full rounded-lg border border-zinc-200" />
                </a>
              </div>
            ))}
          </div>
          <figcaption className="mt-3 max-w-3xl text-sm text-zinc-600">
            Dračevac 2. Ljubičasto su obrubljene čestice koje su na listu 4.4 PPUG-a svijetložute, dakle neizgrađene. Na
            listu 4.d novog GUP-a na njihovu mjestu nema oznake, iako su unutar plavog obuhvata UPU-a, pa se na njima smije
            graditi.
          </figcaption>
        </figure>

        <div className="mt-5 max-w-3xl space-y-3 text-zinc-600">
          <p>
            U obuhvatima UPU-a bez plana na snazi takvih je {broj(rupa.cestice)}{" "}
            {imenicaUz(rupa.cestice, ["čestica", "čestice", "čestica"])} od najmanje 250 m², ukupno {ha1(rupa.ha)} ha. U
            javnoj raspravi o PPUG-u Grad je među njih prebacivao i čestice vlasnika koji su dokazali da je cesta do njih
            izvedena. U urbanoj sanaciji takve rupe gotovo nema: PPUG ondje i prazne čestice unutar izgrađenog bloka vodi kao
            izgrađene, pa one ostaju pod zabranom.
          </p>
          <p>
            Je li tvoja čestica u rupi, provjeri klikom na nju na karti iznad: ako piše „Gradnja je moguća”, zabrana na nju ne
            djeluje.
          </p>
        </div>

        <div className="mt-5 max-w-3xl overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-500">
                <th className="py-2 pr-3 font-semibold">Plan užeg područja</th>
                <th className="py-2 pr-3 text-right font-semibold">čestice</th>
                <th className="py-2 text-right font-semibold">ha</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800">
              {rupa.po_upu.map((r) => (
                <tr key={r.broj} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-3">{r.naziv ?? "izvan ucrtanih obuhvata UPU-a"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{broj(r.cestice)}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{ha1(r.ha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
