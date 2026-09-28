import Link from "next/link";
import type { ReactNode } from "react";

import { Navod } from "@/components/gup-dokument/navod";
import { ZabranaPrikaz } from "@/components/gup-grad/zabrana-prikaz";
import { imenicaUz } from "@/lib/gup-grad/zabrana";
import { ucitajZbrojZabrane, zemljisteZaStanovanje } from "@/lib/gup-grad/zabrana-podaci";
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
  const [zbroj, zemljiste] = await Promise.all([ucitajZbrojZabrane(), zemljisteZaStanovanje()]);
  const z = zemljiste[2025];
  const redovi = [
    {
      naziv: "čeka UPU",
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
          ) zadržava to pravilo: do donošenja UPU-a dopuštene su samo rekonstrukcija i zamjena postojeće građevine (čl.
          106. st. 3.).
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
        <Link href="/gup" className="fokus underline">
          Split po GUP-u
        </Link>{" "}
        · prijedlog izmjena i dopuna iz travnja 2025.
      </p>
      <h1 className="mt-1 text-2xl font-bold">Zabrana nove gradnje do donošenja UPU-a</h1>
      <p className="mt-3 max-w-3xl text-zinc-600">
        Ako Gradsko vijeće donese izmjene i dopune GUP-a predložene u travnju 2025., na crveno označenom zemljištu neće
        se moći ishoditi građevinska dozvola za novu zgradu sve dok se za to područje ne donese urbanistički plan uređenja
        (UPU).
      </p>
      <p className="mt-3 max-w-3xl rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <strong>Zasad ništa nije zabranjeno.</strong> Prijedlog nije donesen, a na snazi je GUP u pročišćenom tekstu iz
        2014. („Službeni glasnik Grada Splita”, br. 55/14). Javni poziv za podnošenje inicijativa za izmjene GUP-a traje
        od 1. listopada do 16. studenoga 2026.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200">
        {[
          [`${ha(zbroj.ukupno_ha * 1e4)} ha`, "zemljišta označeno crveno"],
          [`${ha(zbroj.slobodno_ha * 1e4)} ha`, "slobodnog zemljišta za novu gradnju"],
          [
            zbroj.neizgradjene.cestice.toLocaleString("hr-HR"),
            imenicaUz(zbroj.neizgradjene.cestice, ["neizgrađena čestica", "neizgrađene čestice", "neizgrađenih čestica"]),
          ],
        ].map(([v, n]) => (
          <div key={n} className="bg-white px-3 py-3 sm:px-4">
            <p className="font-mono text-xl font-bold tabular-nums text-red-700 sm:text-2xl">{v}</p>
            <p className="text-xs text-zinc-600 sm:text-sm">{n}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 max-w-3xl text-sm text-zinc-600">
        Zabrana ne dira ono što je već izgrađeno, nego zemljište na kojem bi se inače smjela graditi nova zgrada. Od{" "}
        {ha(zbroj.slobodno_ha * 1e4)} ha takvog zemljišta u crvenom {ha(zbroj.neizgradjene.ha * 1e4)} ha nalazi se na{" "}
        {zbroj.neizgradjene.cestice.toLocaleString("hr-HR")}{" "}
        {imenicaUz(zbroj.neizgradjene.cestice, ["neizgrađenoj čestici", "neizgrađene čestice", "neizgrađenih čestica"])}, a{" "}
        {ha(zbroj.djelomicno.ha * 1e4)} ha na slobodnim dijelovima {zbroj.djelomicno.cestice.toLocaleString("hr-HR")}{" "}
        {imenicaUz(zbroj.djelomicno.cestice, ["izgrađene čestice", "izgrađene čestice", "izgrađenih čestica"])} (npr. veliko
        dvorište ili neizgrađen dio poslovne čestice). Po namjeni:{" "}
        {ha((zbroj.slobodno_po_zoni_ha.stanovanje ?? 0) * 1e4)} ha stambene i mješovite,{" "}
        {ha((zbroj.slobodno_po_zoni_ha.gospodarstvo ?? 0) * 1e4)} ha gospodarske i{" "}
        {ha((zbroj.slobodno_po_zoni_ha.turizam ?? 0) * 1e4)} ha turističke namjene.
      </p>

      <section className="mt-10">
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
        <h2 id="karta" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Gdje bi zabrana vrijedila
        </h2>
        <p className="mt-3 max-w-3xl text-zinc-600">
          Crvenom su bojom označena područja urbane sanacije, urbane preobrazbe i neuređeni dijelovi građevinskog područja s{" "}
          <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga, unutar obuhvata GUP-a. Izuzeta su područja
          važećih planova jer se ondje i dalje gradi prema njima (<Navod id="plan-na-snazi-2025">čl. 103. st. 5.</Navod>).
          Dio obuhvata propisanog UPU-a koji nije označen crveno do donošenja UPU-a gradi se neposrednom provedbom GUP-a (
          <Navod id="obuhvat-izvan-cekanja-2025">čl. 103. st. 3.</Navod>).
        </p>
        <div className="mt-4">
          <ZabranaPrikaz poUpu={zbroj.po_upu} />
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
          od preostalih {ha(z.neiskoristeno)} ha nova bi gradnja morala čekati UPU.
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
            Crvena su područja preuzeta s <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga i, kao i ostali
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
