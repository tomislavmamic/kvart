import Link from "next/link";

import { GupInfografika, type PodaciInfografike } from "@/components/gup-grad/infografika";
import { GODINE, type Godina } from "@/lib/gup-grad/model";
import { izracunaj, ucitajMjerenja, ucitajOdredbe } from "@/lib/gup-grad/podaci";
import { INACICE } from "@/lib/gup-grad/pravila";
import { pravokutnici, voronoi } from "@/lib/gup-grad/raspored";
import { createPageMetadata } from "@/lib/metadata";

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

      <div className="mt-6">
        <GupInfografika podaci={podaci} />
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Kako je razvrstana svaka pojedina čestica — namjena, što na njoj stoji i je li to po planu — vidi se na{" "}
        <Link href="/karta?pogled=gup-provjera" className="fokus font-semibold text-emerald-700 underline">
          karti provjere
        </Link>
        .
      </p>

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 className="border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">Kako je izračunato</h2>

        <h3 className="mt-5 font-bold text-zinc-900">Namjena</h3>
        <p className="mt-1">
          GUP Splita nema javno objavljen vektorski sloj namjene, samo PDF listove. Za svaku godinu uzeli smo list „1.
          Korištenje i namjena prostora” u mjerilu 1 : 10 000, prebacili ga u koordinate na rešetku od 2 × 2 m i svaki
          piksel razvrstali po boji iz legende. Listovi 2006. i 2015. uklopljeni su prema službenom ISPU rasteru, a
          prijedlog 2025. prema listu iz 2015. Točnost položaja je oko 5–10 m: za zbroj po gradu to ne znači ništa, a za
          pojedinu česticu na granici dviju zona znači.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {GODINE.map((g) => (
            <li key={g}>
              <strong>{podaci.planovi[g].naziv}.</strong> {podaci.planovi[g].napomena}
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Plan neke namjene crta istom bojom i razlikuje ih samo slovom na listu, pa su ovdje spojene: mješovita M1–M3 s
          poslovnom sa stanovanjem K5, i gospodarska I s poslovnom K1–K4. To su ujedno kombinirane namjene koje dopuštaju
          više vrsta gradnje. „Ulice i infrastruktura” je sve unutar obuhvata što plan ne boji namjenom: ulice, pruga,
          groblja i infrastrukturni koridori. Na starijim listovima u to upada i dio sive podloge zgrada, pa je te klase
          2006. i 2015. nešto više nego 2025.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Što je „iskorišteno”</h3>
        <p className="mt-1">
          Iskorištenost se mjeri po katastarskim česticama (katastarski plan iz GIS izvoza Grada Splita). Na svakoj
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
          Kuća ne troši samo svoj tlocrt. Odredbe za provođenje za svako područje urbanog pravila (list „Urbana
          pravila”) propisuju najveći koeficijent izgrađenosti (kig — tlocrt prema čestici), najveći koeficijent
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
          slobodno za stanovanje. Isto vrijedi za premale i preuske ostatke. Odredbe traže građevnu česticu široku
          barem 10 m (dvojna kuća; slobodnostojeća 12–16 m), pa slobodno zemljište u koje ne stane krug od oko 9 m —
          put, stube, pojas uz nogostup, rub uz zgradu — nije za gradnju; širina se mjeri na slobodnom zemljištu, ne na
          čestici, pa uska čestica usred livade ostaje slobodna. Širok slobodan dio čestice manji od Ppmin je ostatak
          ako se ne dodiruje sa slobodnom česticom iste namjene s kojom bi zajedno dosegao Ppmin; gdje ga odredbe za
          područje ne propisuju, a gradnju dopuštaju, uzima se najmanji Ppmin za stanovanje iz plana (250 m²). Na
          grafikonu je to točkasti
          pojas „nije za gradnju”. Izvadci odredbi (Sl. gl. 1/06 s izmjenama 3/08; pročišćeni tekst 55/14; prijedlog
          2025.) s citatima i stranicama su u <code className="font-mono text-xs">data/gup-grad/odredbe/izvor/</code>.
        </p>
        <p className="mt-2">
          Ulice unutar obojene zone ne broje se u zonu. Plan boji namjenom cijele blokove i ucrtava samo glavne ceste, pa
          bi nerazvrstane ceste, ulice i nogostupi unutar stambene zone inače ispali „iskorišteno stanovanje”. Njihova
          površina (os ceste ± pola profila, i nogostupi) oduzima se od zone i pribraja „Ulicama i infrastrukturi”; komad
          čestice koji je barem 60 % ulica izuzima se cijeli.
        </p>
        <p className="mt-2">
          Najveće slobodne čestice u stambenim i mješovitim zonama pregledane su i na ortofotu (DGU, 2023.); gdje se
          na snimci vidi parkiralište, igralište, park, gradilište ili zgrada koje nema u podacima, ili teren na kojem
          se ne može graditi, čestica je ispravljena (<code className="font-mono text-xs">data/gup-grad/pregled/rucno.json</code>).
        </p>
        <p className="mt-2">
          Grafikon nudi i dva druga načina brojanja za usporedbu: samo stvarno pokriveni dio (svako dvorište je
          slobodno) i svaka čestica na kojoj išta stoji.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Što je „protivno planu”</h3>
        <p className="mt-1">
          Svaka vrsta korištenja uspoređena je s onim što odredbe za tu namjenu dopuštaju: stambena zgrada u mješovitoj
          zoni je u skladu, u zaštitnom zelenilu, turističkoj ili javnoj zoni nije; manja pomoćna građevina u parku i
          ugostiteljski sadržaj na kupalištu jesu. Ono što odredbe dopuštaju samo pod posebnim uvjetom (stan uz posao u
          poslovnoj zoni) broji se kao protivno, jer se uvjet iz katastra ne vidi. Zelenilo s postojećim građevinama
          (Z6, Meje i Bačvice) list crta istom bojom kao zaštitno zelenilo Z5; odvojili smo ga po oznakama otisnutim
          na listu 2025., pa su ondje postojeće kuće u skladu s planom. Ceste i infrastruktura su dopuštene svugdje. Zgrada kojoj ne znamo vrstu jer je nema
          u katastru protivna je samo tamo gdje plan ne predviđa nikakvu zgradu (zelenilo, rekreacija, plaže). Ovo je
          gruba provjera po skupinama namjene, a ne provjera pojedine građevinske dozvole — zgrada može biti starija od
          plana ili legalizirana.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Za one koji žele promijeniti pravila</h3>
        <p className="mt-1">
          Izvadci odredbi s citatima i stranicama su u{" "}
          <code className="font-mono text-xs">data/gup-grad/odredbe/izvor/</code>. Pravila brojanja su u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/pravila.ts</code>, izračun u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/izracun.ts</code>, a mjerenja po česticama izvode skripte
          u <code className="font-mono text-xs">scripts/gup-grad/</code>. Podaci OpenStreetMapa © OpenStreetMap
          contributors, ODbL. Kako je razvrstana pojedina čestica vidi se na
          karti:{" "}
          <Link href="/karta?pogled=gup-provjera" className="fokus font-semibold text-emerald-700 underline">
            Provjera GUP-a
          </Link>
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
