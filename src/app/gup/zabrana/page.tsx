import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { ZabranaPrikaz } from "@/components/gup-grad/zabrana-prikaz";
import { imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajZbrojZabrane } from "@/lib/gup-grad/zabrana-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Zabrana nove gradnje do donošenja UPU-a",
  description:
    "Karta privatnog zemljišta u Splitu na kojem prijedlog izmjena i dopuna GUP-a iz 2025. ne dopušta novu zgradu do donošenja urbanističkog plana uređenja, uz provjeru adrese.",
});

const ha = (m2: number) => Math.round(m2 / 1e4).toLocaleString("hr-HR");
/** Slobodno zemljište na karti mjeri se desecima hektara: cijeli bi hektari zbrojeni dali krivo. */
const ha1 = (h: number) => h.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const broj = (n: number) => n.toLocaleString("hr-HR");
const vanjska = "fokus text-emerald-700 underline";
const ZPU_2025 = "https://narodne-novine.nn.hr/clanci/sluzbeni/2025_12_155_2315.html";

export default async function ZabranaPage() {
  const zbroj = await ucitajZbrojZabrane();
  const f = zbroj.fokus;
  const ostalaNamjena = (f.slobodno_po_zoni_ha.gospodarstvo ?? 0) + (f.slobodno_po_zoni_ha.turizam ?? 0);

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
        Kad Gradsko vijeće donese izmjene GUP-a predložene u travnju 2025., na zemljištu obojenom na karti neće se moći
        dobiti dozvola za novu zgradu dok se za to područje ne donese urbanistički plan uređenja (UPU). Postojeće zgrade
        smjet će se obnoviti i zamijeniti. Prijedlog ne predviđa ni rok ni novac za izradu tih planova, pa zabrana može
        potrajati.
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
                <div className="max-w-3xl space-y-3 text-zinc-600">
                  <p>
                    Crveno je urbana sanacija, a narančasto urbana preobrazba stambenih i mješovitih zona. Obje su oznake s{" "}
                    <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga, koji sanaciju crta zeleno, kao da je
                    ondje sve u redu. Tamnije su neizgrađene čestice. Na svjetlijima, izgrađenima, postojeća se zgrada smije
                    obnoviti ili zamijeniti, ali se na slobodnom dijelu ne smije graditi nova. Plavim je rubom obuhvat UPU-a
                    u kojem su te čestice.
                  </p>
                  <p>
                    Ostale oznake s lista 4.d karta ne boji. U neuređenom dijelu nova se zgrada uz postojeću javnu cestu
                    može dobiti i prije UPU-a (
                    <a href={ZPU_2025} className={vanjska}>
                      ZPU
                    </a>
                    , čl. 180. st. 2. t. 3.), a bez ceste se ionako ne gradi. Urbanom preobrazbom gospodarskih zona i
                    gradskih projekata (brodogradilište, Kopilica, Karepovac, luka) preuređuju se cijela područja, a ne
                    pojedinačne privatne čestice, a na ulicama i javnim, športskim i zelenim površinama privatna se zgrada
                    ne gradi ni bez zabrane. Gdje je na snazi plan užeg područja (sivo), gradi se prema njemu (
                    <Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>). Klik na kartu kaže što vrijedi na tom mjestu.
                  </p>
                </div>

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
                  Zabrana ne dira ono što je izgrađeno, nego slobodno zemljište na kojem bi se inače smjela graditi nova
                  zgrada: {ha1(f.neizgradjene.ha)} ha na neizgrađenim česticama i {ha1(f.djelomicno.ha)} ha na slobodnim
                  dijelovima {broj(f.djelomicno.cestice)}{" "}
                  {imenicaUz(f.djelomicno.cestice, ["izgrađene čestice", "izgrađene čestice", "izgrađenih čestica"])}, npr.
                  velikim dvorištima. Od toga je {ha1(f.slobodno_po_zoni_ha.stanovanje ?? 0)} ha stambene i mješovite, a{" "}
                  {ha1(ostalaNamjena)} ha gospodarske i turističke namjene.
                </p>
              </>
            }
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 id="zasto" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Zašto se dosad gradilo, a od sada neće
        </h2>
        <div className="mt-3 max-w-3xl space-y-3 text-zinc-600">
          <p>
            UPU za istočni Split propisan je još na <Navod id="list-detaljniji-planovi-2008">listu 4.c</Navod> GUP-a iz
            2006.–2008., a većina tih planova nikad nije izrađena. Zakon od 2014. zabranjuje dozvolu za novu zgradu prije
            UPU-a ondje gdje plan zemljište označi kao urbanu sanaciju, urbanu preobrazbu ili neuređeni dio (
            <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2013_12_153_3220.html" className={vanjska}>
              NN 153/13
            </a>
            , čl. 79.; jednako i{" "}
            <a href={ZPU_2025} className={vanjska}>
              novi zakon
            </a>
            , čl. 106.). Važeći GUP istočni Split tako nije označio, pa je Grad ondje izdavao dozvole: od 2016. oko 57 za
            nove stambene zgrade.
          </p>
          <p>
            <strong className="text-zinc-900">Prijedlog isto zemljište označava kao urbanu sanaciju ili preobrazbu</strong>{" "}
            (<Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>), i tada dozvolu priječi sam zakon, a ne tumačenje GUP-a.
            Tu je oznaku izabrao Grad: zakon dopušta i da GUP sam propiše uvjete gradnje s detaljnošću UPU-a, pa obveza UPU-a
            ne nastaje (NN 155/25, čl. 106. st. 4.).
          </p>
          <p>
            Što o tome kažu važeći GUP i zakoni, koliko se gradilo i što stanovnici mogu tražiti, piše u{" "}
            <Link href="/gup/analiza" className="fokus font-semibold text-emerald-700 underline">
              analizi zabrane
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i način izračuna
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Oznake su s <Navod id="list-planske-mjere-2025">lista 4.d</Navod>, a namjena zone s lista 1 prijedloga, i, kao na
            stranici{" "}
            <Link href="/gup#kako-je-izracunato" className="fokus text-emerald-700 underline">
              Split po GUP-u
            </Link>
            , prenesene su na rešetku od 2 m. Granice su točne na 5 do 15 m, pa je za česticu uz rub mjerodavan sam list.
            Obuhvati važećih planova su s njihovih listova u ISPU-u, a obuhvat GUP-a i kućni brojevi iz gradskih GIS
            podataka.
          </li>
          <li>
            Slobodno zemljište računa se po katastarskim česticama, kao na grafikonu GUP-a: slobodno je ono što nije pod
            zgradom s česticom koju joj odredbe propisuju, ulicom, parkiralištem ni parkom, a za gradnju je samo ako na njega,
            zajedno sa slobodnim susjednim zemljištem, stane nova građevna čestica. Čestica je neizgrađena ako na njoj nema
            zgrade, okućnice ni gradilišta.
          </li>
          <li>
            Dozvole od 2016.: javni registar akata Ministarstva prostornoga uređenja, graditeljstva i državne imovine (ISPU).
            Pravila: <Navod id="obveza-plana-2025">čl. 103.</Navod> i <Navod id="do-plana-2025">čl. 105.</Navod> prijedloga te{" "}
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
