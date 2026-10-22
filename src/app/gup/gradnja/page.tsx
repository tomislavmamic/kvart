import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { GradnjaPrikaz } from "@/components/gup-grad/gradnja-prikaz";
import { SKUPINE_GRADNJE, type Skupina } from "@/lib/gup-grad/gradnja";
import { ucitajOdredbeGradnje, ucitajZbrojGradnje } from "@/lib/gup-grad/gradnja-podaci";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Gdje se po novom GUP-u neće moći graditi",
  description:
    "Karta Splita u obuhvatu GUP-a: gdje se po novom GUP-u neće moći graditi ništa novo, a gdje ništa stambeno — i zašto, za svaku točku: izgrađeno, ulica, namjena, odredbe, čekanje na UPU, premalo zemljište.",
});

const ha = (v: number) => Math.round(v).toLocaleString("hr-HR");
const posto = (v: number) => `${Math.round(v * 100).toLocaleString("hr-HR")} %`;
const vanjska = "fokus text-emerald-700 underline";

const BOJA_SKUPINE: Record<Skupina, string> = {
  nista: "#27272a",
  uvjetno: "#ca8a04",
  nestambeno: "#0891b2",
  stambeno: "#15803d",
};

export default async function GradnjaPage() {
  const [zbroj, odredbe] = await Promise.all([ucitajZbrojGradnje(), ucitajOdredbeGradnje()]);
  const k = zbroj.po_kategoriji_ha;
  const s = zbroj.po_skupini_ha;
  const udio = (v: number) => v / zbroj.ukupno_ha;
  const zauzeto = k.zgrada + k.okucnica + k.koristeno + k.ulica;
  const planNeDopusta = k["rezerva-prometa"] + k["bez-zgrada"] + k["samo-rekonstrukcija"] + k.neizgradivo;
  const stambenoMjesovito = zbroj.po_namjeni_ha["M/K5"]?.stambeno ?? 0;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-zinc-500">
        <Link href="/planovi" className="fokus underline">
          Planovi
        </Link>{" "}
        · novi GUP, prijedlog izmjena i dopuna iz travnja 2025.
      </p>
      <h1 className="mt-1 text-2xl font-bold">Gdje se po novom GUP-u neće moći graditi</h1>
      <p className="mt-3 max-w-3xl text-zinc-600">
        Karta pokazuje, za svako mjesto u obuhvatu GUP-a Splita, može li se ondje nakon donošenja novog GUP-a graditi nova
        zgrada: <strong className="text-zinc-900">nikakva</strong> (jer je mjesto već izgrađeno ili zauzeto ulicom, jer
        namjena ne predviđa zgrade, jer odredbe dopuštaju samo obnovu, jer nova gradnja čeka UPU ili jer je slobodni komad
        premalen), <strong className="text-zinc-900">nikakva stambena</strong> (namjena dopušta samo javnu, gospodarsku,
        turističku ili športsku gradnju) ili stambena i stambeno-poslovna.
      </p>
      <p className="mt-2 max-w-3xl text-zinc-600">
        Klik na bilo koje mjesto kaže što je za tu točku provjereno, što ondje priječi gradnju i koliko je čega na čestici.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        {(["nista", "uvjetno", "nestambeno", "stambeno"] as const).map((sk) => (
          <div key={sk} className="bg-white px-3 py-3 sm:px-4">
            <p className="flex items-center gap-2 font-mono text-xl font-bold tabular-nums text-zinc-900 sm:text-2xl">
              <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: BOJA_SKUPINE[sk] }} />
              {ha(s[sk])} ha
            </p>
            <p className="text-xs text-zinc-600 sm:text-sm">
              {SKUPINE_GRADNJE[sk].naslov} · {posto(udio(s[sk]))}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        Od {ha(zbroj.ukupno_ha)} ha katastarskih čestica u obuhvatu GUP-a, bez mora.
      </p>

      <section className="mt-8">
        <h2 id="karta" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Karta
        </h2>
        <div className="mt-4">
          <GradnjaPrikaz zbroj={zbroj} odredbe={odredbe} />
        </div>
      </section>

      <section className="mt-12 max-w-3xl text-zinc-700">
        <h2 id="sto-kaze" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Što karta kaže
        </h2>
        <p className="mt-3">
          Najveći dio je već zauzet: {ha(zauzeto)} ha ({posto(udio(zauzeto))}) čine zgrade s dvorištima koja im pripadaju, ulice,
          parkirališta, parkovi, igrališta i okoliš škola. Na još {ha(planNeDopusta)} ha slobodnog zemljišta plan zgrade ne predviđa ili dopušta samo
          obnovu postojećih: parkovi, zaštitno zelenilo, rekreacija i plaže, rezerve za ulice i groblja.
        </p>
        <p className="mt-2">
          Za novu stambenu zgradu ostaje {ha(s.stambeno)} ha, gotovo sve ({ha(stambenoMjesovito)} ha) u mješovitim zonama.
          Novi GUP pritom zaustavlja gradnju na {ha(k["ceka-upu"])} ha slobodnog zemljišta urbane sanacije i preobrazbe dok se
          ne donese UPU, a na {ha(s.uvjetno)} ha neuređenog dijela do UPU-a se može graditi samo uz postojeću javnu cestu. Koja
          su to područja i zašto, objašnjava stranica{" "}
          <Link href="/gup/zabrana" className="fokus font-semibold text-emerald-700 underline">
            Zabrana nove gradnje do donošenja UPU-a
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 max-w-3xl text-zinc-700">
        <h2 id="kako" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Što se provjerava, i kojim redom
        </h2>
        <p className="mt-3">
          Svako mjesto dobiva jedan razlog, prvi koji gradnju priječi, redom kojim bi to pitao onaj tko želi graditi:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-zinc-900">Je li mjesto već zauzeto.</strong> Zgrade iz katastra i gradskog 3D modela,
            gradilišta, ulice, parkirališta, javne ustanove, igrališta, trgovi, groblja i parkovi. Zgradi pripada i dvorište:
            onoliko čestice koliko joj odredbe propisuju (tlocrt kroz najveći koeficijent izgrađenosti, a ne manje od najmanje
            građevne čestice). Postojeća se zgrada smije obnoviti ili zamijeniti, ali nova se uz nju ne može dodati.
          </li>
          <li>
            <strong className="text-zinc-900">Predviđa li namjena zgrade.</strong> Prema{" "}
            <Navod id="list-namjena-2025">listu 1</Navod> novog GUP-a: u parku, zaštitnom zelenilu, rekreaciji i na plaži ne
            (osim manjih pratećih građevina), a zemljište koje plan ne boji namjenom rezervirano je za ulice, prugu, groblja i
            infrastrukturu.
          </li>
          <li>
            <strong className="text-zinc-900">Dopuštaju li odredbe novu zgradu.</strong> U stambenim i mješovitim zonama
            područje urbanog pravila (<Navod id="list-urbana-pravila-2025">list urbanih pravila</Navod>) u dovršenim naseljima
            dopušta samo rekonstrukciju i zamjenu postojećih zgrada. Ondje gdje je ručni pregled ortofota pokazao da se teren
            ne može graditi, ne može.
          </li>
          <li>
            <strong className="text-zinc-900">Čeka li gradnja UPU.</strong> U područjima urbane sanacije i preobrazbe s{" "}
            <Navod id="list-planske-mjere-2025">lista 4.d</Navod> gradi se samo na temelju UPU-a (
            <Navod id="obveza-plana-2025">čl. 103. st. 1.</Navod>), a do njega samo rekonstrukcija i zamjena. U neuređenom dijelu
            nova zgrada smije se i prije UPU-a ako do čestice vodi postojeća javna cesta i ako se riješi odvodnja (Zakon o
            prostornom uređenju, NN 155/25, čl. 180. st. 2. t. 3.); karta to ne može provjeriti za svaku česticu, pa to
            zemljište boji zasebno. Javne i društvene zgrade smiju se graditi i prije UPU-a (
            <Navod id="clanak-105-popis-2025">čl. 105. st. 5.</Navod>).
          </li>
          <li>
            <strong className="text-zinc-900">Je li slobodno dovoljno za novu česticu.</strong> Slobodni komad mora biti barem
            velik kao najmanja građevna čestica koju odredbe propisuju za to područje (ili to doseći sa slobodnim susjedom iste
            namjene) i širi od ~9 m.
          </li>
          <li>
            <strong className="text-zinc-900">Dopušta li namjena stanovanje.</strong> Stambena (S), mješovita (M1–M3) i
            poslovna sa stanovanjem (K5) da; javna i društvena, gospodarska, poslovna, turistička, športska, lučka i posebna ne.
          </li>
        </ol>
      </section>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i ograničenja
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Karta je izvedena iz istog izračuna kao{" "}
            <Link href="/gup#kako-je-izracunato" className={vanjska}>
              Split po GUP-u
            </Link>{" "}
            (način brojanja „po odredbama”), na rešetki od oko 2 m: namjena i urbana pravila pročitani su s PDF listova
            prijedloga GUP-a iz travnja 2025., zgrade su iz katastra DGU-a i gradskog 3D modela, ulice, parkirališta i parkovi
            iz gradskih podataka i OpenStreetMapa, uz ručni pregled ortofota. Uz granicu zone pogreška je 5–10 m, pa je za
            česticu uz rub mjerodavan sam list.
          </li>
          <li>
            Područja sanacije, preobrazbe i neuređenog dijela su s <Navod id="list-planske-mjere-2025">lista 4.d</Navod>, a
            obuhvati planova užeg područja na snazi s ISPU-a. Gdje je plan na snazi, gradi se po njemu; njegove odredbe ovdje
            nisu provjerene.
          </li>
          <li>
            Karta ne provjerava vlasništvo ni pristup na cestu, nagib i tlo, zaštitu kulturne baštine i krajobraza, pojas uz
            more i vodotoke ni posebne uvjete javnopravnih tijela. Ništa od toga ne može mjesto pretvoriti iz „ne može” u
            „može”, ali može obrnuto. Za odluku o kupnji ili gradnji zatraži lokacijsku informaciju od Grada.
          </li>
          <li>
            Karta pokriva obuhvat GUP-a (iscrtkana granica). Ostatak Grada ide po Prostornom planu uređenja Grada Splita i
            ovdje nije obojen.
          </li>
        </ul>
      </section>
    </div>
  );
}
