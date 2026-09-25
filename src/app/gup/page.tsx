import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { GupPrikaz } from "@/components/gup-grad/gup-prikaz";
import type { PodaciInfografike } from "@/components/gup-grad/infografika";
import { GODINE, type Godina } from "@/lib/gup-grad/model";
import { izracunaj, ucitajMjerenja, ucitajOdredbe } from "@/lib/gup-grad/podaci";
import { INACICE } from "@/lib/gup-grad/pravila";
import { pravokutnici, voronoi } from "@/lib/gup-grad/raspored";
import { navodNamjena } from "@/lib/gup-dokument/id";
import { createPageMetadata } from "@/lib/metadata";

/** List namjene i tekst svake godine plana na /gup/dokument. */
const DOKUMENT_GODINE: Record<Godina, { list: string; tekst: string }> = {
  2006: { list: "list-namjena-2008", tekst: "/gup/dokument/2006" },
  2015: { list: "list-namjena-2014", tekst: "/gup/dokument" },
  2025: { list: "list-namjena-2025", tekst: "/gup/dokument/2025" },
};

export const metadata = createPageMetadata({
  title: "Split po GUP-u: koliko čega ima i koliko je potrošeno",
  description:
    "Površina svake namjene iz Generalnog urbanističkog plana Splita 2006., 2015. i 2025., koliko je od toga već izgrađeno i koliko je izgrađeno protivno planu.",
});

async function pripremi(): Promise<PodaciInfografike> {
  const [d, odredbe] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const rezultati = Object.fromEntries(INACICE.map((i) => [i.id, izracunaj(d, i.pravila, odredbe)]));
  const prvi = rezultati[INACICE[0].id];
  const rasporedi = {} as PodaciInfografike["rasporedi"];
  const planovi = {} as PodaciInfografike["planovi"];
  for (const g of GODINE) {
    const povrsine = Object.fromEntries(prvi[g].map((r) => [r.kod, r.ukupnoM2]));
    rasporedi[g] = { voronoi: voronoi(povrsine), pravokutnici: pravokutnici(povrsine) };
    const p = d.planovi.find((x) => x.godina === g);
    planovi[g] = { naziv: p?.naziv ?? `GUP ${g}.`, napomena: p?.napomena ?? "" };
  }
  return {
    inacice: INACICE.map(({ id, naziv, opis }) => ({ id, naziv, opis })),
    rezultati: rezultati as Record<string, Record<Godina, (typeof prvi)[Godina]>>,
    rasporedi,
    planovi,
  };
}

export default async function GupPage() {
  const podaci = await pripremi();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Split po GUP-u</h1>
      <p className="mt-3 max-w-3xl text-zinc-600">
        Koliko je u Generalnom urbanističkom planu Splita predviđeno za stanovanje, gospodarstvo, škole, šport i
        zelenilo — u planu iz 2006., u pročišćenom planu iz 2015. i u prijedlogu izmjena iz 2025. I koliko je od toga
        danas već izgrađeno, i koliko je izgrađeno protivno namjeni koju plan propisuje.
      </p>
      <p className="mt-2 max-w-3xl text-zinc-600">
        Sam plan — tekst odredbi i sve kartografske prikaze — možeš pročitati na{" "}
        <Link href="/gup/dokument" className="fokus font-semibold text-emerald-700 underline">
          GUP Splita: tekst i karte
        </Link>
        . Točkasto podcrtano ispod otvara doslovno ono mjesto u planu na koje se pozivamo.
      </p>

      <div className="mt-6">
        <GupPrikaz podaci={podaci} />
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Na karti se vidi kako je razvrstana svaka pojedina čestica — namjena, što na njoj stoji i je li to po planu.
        Klik na česticu kaže zašto; ako je krivo svrstana, ondje se može predložiti ispravak.
      </p>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="kako-je-izracunato" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Kako je izračunato
        </h2>

        <h3 className="mt-5 font-bold text-zinc-900">Namjena</h3>
        <p className="mt-1">
          GUP Splita nema javno objavljen vektorski sloj namjene, samo PDF listove. Za svaku godinu uzeli smo list{" "}
          <Navod id="list-namjena-2014">„1. Korištenje i namjena prostora”</Navod> u mjerilu 1 : 10 000, prebacili ga u
          koordinate na rešetku od 2 × 2 m i svaki
          piksel razvrstali po boji iz legende. Listovi 2006. i 2015. uklopljeni su prema službenom ISPU rasteru, a
          prijedlog 2025. prema listu iz 2015. Točnost položaja je oko 5–10 m: za zbroj po gradu to ne znači ništa, a za
          pojedinu česticu na granici dviju zona znači.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {GODINE.map((g) => (
            <li key={g}>
              <strong>{podaci.planovi[g].naziv}.</strong> {podaci.planovi[g].napomena}{" "}
              <Navod id={DOKUMENT_GODINE[g].list}>List</Navod>,{" "}
              <Link href={DOKUMENT_GODINE[g].tekst} className="fokus text-emerald-700 underline">
                tekst plana
              </Link>
              .
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Plan neke namjene crta <Navod id="clanak-7-2015">istom bojom</Navod> i razlikuje ih samo slovom na listu, pa su
          ovdje spojene: mješovita M1–M3 s
          poslovnom sa stanovanjem K5, i gospodarska I s poslovnom K1–K4. To su ujedno kombinirane namjene koje dopuštaju
          više vrsta gradnje. „Ulice i infrastruktura” je sve unutar obuhvata što plan ne boji namjenom: ulice, pruga,
          groblja i infrastrukturni koridori. Na starijim listovima u to upada i dio sive podloge zgrada, pa je te klase
          2006. i 2015. nešto više nego 2025.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Što je „iskorišteno”</h3>
        <p className="mt-1">
          Iskorištenost se mjeri po katastarskim česticama (katastar Državne geodetske uprave, rujan 2026.). Na svakoj
          čestici, i posebno na svakom njezinom dijelu koji pada u drugu zonu, izmjereno je što na njoj stoji: zgrade (iz
          katastra, koji zna vrstu zgrade, i iz gradskog 3D modela, koji vidi i zgrade kojih u katastru nema, i visinu
          svake), ceste i nogostupi, parkirališta, okoliš škola, vrtića, bolnica i crkava, igrališta, športski tereni,
          groblja i trgovi, trafostanice i vodospreme, parkovi i zelenilo koje održavaju Parkovi i nasadi, i
          gradilišta. Na parkiralištu, školskom dvorištu ili u parku ne gradi se stan, pa je i to iskorišteno zemljište.
          Javna parkirališta i zelenilo su iz izvoza Grada, a parkirališta trgovina i zgrada, okoliš ustanova, igrališta i
          gradilišta iz OpenStreetMapa. Iskorištenost je ista za sve tri godine — mjeri se današnje stanje prema namjeni
          iz svake inačice plana.
        </p>
        <p className="mt-2">
          Kuća ne troši samo svoj tlocrt. Odredbe za provođenje za svako područje urbanog pravila (list{" "}
          <Navod id="list-urbana-pravila-2014">„Urbana pravila”</Navod>) propisuju najveći koeficijent izgrađenosti (kig —
          tlocrt prema čestici), najveći koeficijent
          iskorištenosti (kis — bruto površina prema čestici) i najmanju građevnu česticu (Ppmin). Zato se zgradi
          pripisuje onoliko čestice koliko joj po tim odredbama treba: tlocrt / kig, bruto površina / kis (etaže iz
          visine zgrade u 3D modelu) i ne manje od Ppmin. Neboder u naselju iz sedamdesetih tako troši i parkiralište
          i zelenilo oko sebe, a kuća od 150 m² na čestici od 3 000 m² ostavlja slobodan vrt — ali samo ako je taj vrt
          sam dovoljno velik za novu građevnu česticu. Od više vrijednosti (slobodnostojeća, dvojna…) uzima se ona koja
          zgradi pripisuje najmanje zemljišta, da se slobodno ne proglasi iskorištenim. Građevna čestica često je više
          katastarskih — kuća na jednoj, vrt na susjednoj — pa kad zgradi na vlastitoj čestici nedostaje zemljišta,
          uzima ga sa susjedne čestice bez zgrade koja sama nije nova građevna čestica. Veliku susjednu livadu ne dira.
        </p>
        <p className="mt-2">
          Gdje odredbe ne dopuštaju novu stambenu gradnju — dovršena naselja u kojima je moguća samo rekonstrukcija
          postojećih zgrada, zaštićene cjeline, parkovi — slobodno zemljište stambene i mješovite zone ne broji se kao
          slobodno za stanovanje. Isto vrijedi za premale i preuske ostatke. Odredbe traže građevnu česticu{" "}
          <Navod id="sirina-cestice-2015">široku barem 10 m</Navod> (dvojna kuća; slobodnostojeća 12–16 m), pa slobodno
          zemljište u koje ne stane krug od oko 9 m —
          put, stube, pojas uz nogostup, rub uz zgradu — nije za gradnju; širina se mjeri na slobodnom zemljištu, ne na
          čestici, pa uska čestica usred livade ostaje slobodna. Širok slobodan dio čestice manji od Ppmin je ostatak
          ako se ne dodiruje sa slobodnom česticom iste namjene s kojom bi zajedno dosegao Ppmin; gdje ga odredbe za
          područje ne propisuju, a gradnju dopuštaju, uzima se{" "}
          <Navod id="ppmin-250-2015">najmanji Ppmin za stanovanje iz plana (250 m²)</Navod>. Na
          grafikonu je to točkasti
          pojas „nije za gradnju”. Izvadci odredbi (
          <Link href="/gup/dokument/2006" className="fokus text-emerald-700 underline">
            Sl. gl. 1/06 s izmjenama 3/08
          </Link>
          ;{" "}
          <Link href="/gup/dokument" className="fokus text-emerald-700 underline">
            pročišćeni tekst 55/14
          </Link>
          ;{" "}
          <Link href="/gup/dokument/2025" className="fokus text-emerald-700 underline">
            prijedlog 2025.
          </Link>
          ) s citatima i stranicama su u <code className="font-mono text-xs">data/gup-grad/odredbe/izvor/</code>.
        </p>
        <p className="mt-2">
          Ulice unutar obojene zone ne broje se u zonu. Plan boji namjenom cijele blokove i ucrtava samo glavne ceste, pa
          bi nerazvrstane ceste, ulice i nogostupi unutar stambene zone inače ispali „iskorišteno stanovanje”. Njihova
          površina (os ceste ± pola profila, i nogostupi) oduzima se od zone i pribraja „Ulicama i infrastrukturi”; komad
          čestice koji je barem 60 % ulica izuzima se cijeli, kao i čestica puta uz koju ostaje samo uski prazni rub.
          Ceste su iz gradskih slojeva i registra nerazvrstanih cesta (2023.), a kolni prilazi, prometnice kroz naselja,
          pješački putovi i stube koje oni nemaju iz OpenStreetMapa, sa širinom po razredu ceste.
        </p>
        <p className="mt-2">
          Svaka čestica u stambenoj i mješovitoj zoni s barem 500 m² slobodnog (u naseljima višestambenih zgrada od
          300 m²) pregledana je i na ortofotu (DGU, 2023.); gdje se na snimci vidi parkiralište, igralište, park,
          gradilište ili zgrada koje nema u podacima, ili teren na kojem se ne može graditi, čestica je ispravljena (
          <code className="font-mono text-xs">data/gup-grad/pregled/rucno.json</code>). Isječke je pregledao
          jezični model (Claude) po pisanim uputama, a sud niske sigurnosti nije primijenjen.
        </p>
        <p className="mt-2">
          Grafikon nudi i dva druga načina brojanja za usporedbu: samo stvarno pokriveni dio (svako dvorište je
          slobodno) i svaka čestica na kojoj išta stoji.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Planovi užeg područja: gdje namjena nije dovoljna</h3>
        <p className="mt-1">
          Namjena kaže što se na zemljištu smije, ali ne i gradi li se po GUP-u. Gdje je na snazi urbanistički ili
          detaljni plan uređenja (ili stari provedbeni plan), gradi se po njemu, a on može biti i stroži od GUP-a — UPU
          Bilice II–Mostine iz 1998. u poslovnoj zoni dopušta stanovanje na najviše četvrtini zone. Gdje GUP propisuje
          izradu plana užeg područja, a plana nema, nova gradnja u nisko konsolidiranim područjima (urbana pravila 3.x)
          čeka taj plan; do njega se grade samo ulice i infrastruktura (
          <Navod id="obveza-plana-2015">Sl. gl. 55/14, čl. 104–105</Navod>). Prijedlog 2025. obvezu sužava na neuređene
          dijelove neizgrađenog građevinskog područja, urbanu preobrazbu i urbanu sanaciju (
          <Navod id="obveza-plana-2025">čl. 103</Navod>); ostali obuhvati su{" "}
          <Navod id="preporuka-plana-2025">preporuka i do plana se gradi po GUP-u</Navod>.
        </p>
        <p className="mt-2">
          Obuhvate smo uzeli s listova <Navod id="list-detaljniji-planovi-2008">„Obuhvat detaljnijih planova”</Navod> i
          „Važeći planovi” (<Navod id="list-vazeci-planovi-2008">izmjene 2008.</Navod>;{" "}
          <Navod id="list-vazeci-planovi-2014">stanje 28. 11. 2014.</Navod>) i s{" "}
          <Navod id="list-planske-mjere-2025">lista 4.d prijedloga 2025.</Navod>, istim uklapanjem kao namjenu. Pročišćeni list obveza za 2015. nije
          objavljen, pa za 2015. vrijede obveze iz 2008. (izmjene 2014. mijenjaju ih samo za Trsteničku uvalu). Čestica
          pripada obuhvatu kad ga pokriva barem pola čestice; najmanji planovi od nekoliko čestica mogu ispasti. Na
          grafikonu i na karti je slobodno koje čeka plan narančasto, a slobodno pod planom na snazi na grafikonu je rešetka — to drugo je slobodno
          za gradnju, ali koliko se na njemu smije, odlučuje taj plan. Na karti se za prijedlog 2025. ocrtavaju i obuhvati 34
          propisana UPU-a s imenima iz legende <Navod id="list-planske-mjere-2025">lista 4.d</Navod>
          (<code className="font-mono text-xs">scripts/gup-grad/planski-obrisi.py</code>), a u načinu „Planski režim”
          čestice koje čekaju plan obojene su po vrsti područja, kao na listu: urbana sanacija zeleno, neuređeni dio
          građevinskog područja žuto, urbana preobrazba narančasto. Obuhvati su iz{" "}
          <code className="font-mono text-xs">scripts/gup-grad/planski-rezim.py</code>, a što koji znači u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/rezim.ts</code>.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Što je „protivno planu”</h3>
        <p className="mt-1">
          Svaka vrsta korištenja uspoređena je s onim što odredbe za tu namjenu dopuštaju: stambena zgrada u{" "}
          <Navod id={navodNamjena(2015, "M/K5")}>mješovitoj zoni</Navod> je u skladu, u{" "}
          <Navod id={navodNamjena(2015, "Z5")}>zaštitnom zelenilu</Navod>,{" "}
          <Navod id={navodNamjena(2015, "T")}>turističkoj</Navod> ili <Navod id={navodNamjena(2015, "D")}>javnoj</Navod>{" "}
          zoni nije; manja pomoćna građevina u <Navod id={navodNamjena(2015, "Z1")}>parku</Navod> i ugostiteljski sadržaj
          na <Navod id={navodNamjena(2015, "R3")}>kupalištu</Navod> jesu. Ono što odredbe dopuštaju samo pod posebnim
          uvjetom (<Navod id={navodNamjena(2015, "I/K")}>stan uz posao u poslovnoj zoni</Navod>) broji se kao protivno,
          jer se uvjet iz katastra ne vidi. <Navod id="z6-2015">Zelenilo s postojećim građevinama (Z6, Meje i Bačvice)</Navod>{" "}
          list crta istom bojom kao zaštitno zelenilo Z5; odvojili smo ga po{" "}
          <Navod id="z6-bacvice-2025">oznakama otisnutim na listu 2025.</Navod>, pa su ondje postojeće kuće u skladu s
          planom. <Navod id="sve-namjene-2015">Ceste i infrastruktura su dopuštene svugdje</Navod>.
          Kuća protivna planu u zoni bez koeficijenta izgrađenosti (zelenilo, javna ili poslovna zona) troši onoliko
          zemljišta koliko bi joj trebalo u stambenoj zoni — tlocrt / 0,3, a ne manje od 300 m² — a ne cijeli komad
          zone, pa velik park s jednom kućom ne postaje sav protivan planu. Zgrada kojoj ne znamo vrstu jer je nema
          u katastru protivna je samo tamo gdje plan ne predviđa nikakvu zgradu (zelenilo, rekreacija, plaže). Ovo je
          gruba provjera po skupinama namjene, a ne provjera pojedine građevinske dozvole — zgrada može biti starija od
          plana ili legalizirana.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Granice izračuna</h3>
        <p className="mt-1">
          Listovi plana su skenirani crteži uklopljeni u koordinate; granica zone na njima odstupa od katastra do
          5–10 m, pa rubni pojas čestice može pasti u susjednu zonu. Ortofoto je iz 2023., a gradski 3D model ne nosi
          datum snimanja: zgrade građene poslije njih nema ni u jednom, osim ako su u katastru. Parkirališta, okoliš
          ustanova i igrališta iz OpenStreetMapa nisu potpuni; pregled na ortofotu hvata ih samo na većim slobodnim
          česticama. Katastar je iz rujna 2026., a namjena iz plana svake godine, pa 2006. i 2015. pokazuju današnje
          stanje prema tadašnjem planu, ne tadašnje stanje. Brojke su procjena na razini grada; za pojedinu česticu
          mjerodavni su plan, odredbe i katastar.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Za one koji žele promijeniti pravila</h3>
        <p className="mt-1">
          Cijeli plan, tekst i karte, je na{" "}
          <Link href="/gup/dokument" className="fokus font-semibold text-emerald-700 underline">
            /gup/dokument
          </Link>
          . Izvadci odredbi s citatima i stranicama su u{" "}
          <code className="font-mono text-xs">data/gup-grad/odredbe/izvor/</code>. Pravila brojanja su u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/pravila.ts</code>, izračun u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/izracun.ts</code>, a mjerenja po česticama izvode skripte
          u <code className="font-mono text-xs">scripts/gup-grad/</code>. Podaci OpenStreetMapa © OpenStreetMap
          contributors, ODbL. Kako je razvrstana pojedina čestica vidi se na{" "}
          <a href="/gup" className="fokus font-semibold text-emerald-700 underline">
            karti
          </a>
          . Za kvart, s pročitanim oznakama namjene, vidi{" "}
          <Link href="/plan" className="fokus font-semibold text-emerald-700 underline">
            što nacrt GUP-a mijenja u Dračevcu i Bilicama
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
