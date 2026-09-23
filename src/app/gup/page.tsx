import Link from "next/link";

import { GupInfografika, type PodaciInfografike } from "@/components/gup-grad/infografika";
import { GODINE, type Godina } from "@/lib/gup-grad/model";
import { izracunaj, ucitajMjerenja } from "@/lib/gup-grad/podaci";
import { INACICE } from "@/lib/gup-grad/pravila";
import { pravokutnici, voronoi } from "@/lib/gup-grad/raspored";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Split po GUP-u: koliko čega ima i koliko je potrošeno",
  description:
    "Površina svake namjene iz Generalnog urbanističkog plana Splita 2006., 2015. i 2025., koliko je od toga već izgrađeno i koliko je izgrađeno protivno planu.",
});

async function pripremi(): Promise<PodaciInfografike> {
  const d = await ucitajMjerenja();
  const rezultati = Object.fromEntries(INACICE.map((i) => [i.id, izracunaj(d, i.pravila)]));
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
          čestici, i posebno na svakom njezinom dijelu koji pada u drugu zonu, izmjereno je koliko je pokriveno zgradom,
          cestom, nogostupom ili parkiralištem, grobljem ili športskim objektom. Zgrade dolaze iz dva izvora: katastra,
          koji zna vrstu zgrade, i snimke Grada iz 2025., koja vidi i zgrade kojih u katastru nema. Iskorištenost je ista
          za sve tri godine — mjeri se današnje stanje prema namjeni iz svake inačice plana.
        </p>
        <p className="mt-2">
          Koliko čestice je „potrošeno” pitanje je dogovora, pa grafikon nudi tri načina brojanja: samo pokriveni dio,
          cijela čestica pokrivena barem 20 %, i svaka čestica na kojoj išta stoji.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Što je „protivno planu”</h3>
        <p className="mt-1">
          Svaka vrsta korištenja uspoređena je s onim što namjena dopušta: stambena zgrada u mješovitoj zoni je u skladu,
          u zaštitnom zelenilu nije. Ceste i infrastruktura su dopuštene svugdje. Zgrada kojoj ne znamo vrstu jer je nema
          u katastru protivna je samo tamo gdje plan ne predviđa nikakvu zgradu (zelenilo, rekreacija, plaže). Ovo je
          gruba provjera po skupinama namjene, a ne provjera pojedine građevinske dozvole — zgrada može biti starija od
          plana ili legalizirana.
        </p>

        <h3 className="mt-5 font-bold text-zinc-900">Za one koji žele promijeniti pravila</h3>
        <p className="mt-1">
          Pravila brojanja su u <code className="font-mono text-xs">src/lib/gup-grad/pravila.ts</code>, izračun u{" "}
          <code className="font-mono text-xs">src/lib/gup-grad/izracun.ts</code>, a mjerenja po česticama izvode skripte
          u <code className="font-mono text-xs">scripts/gup-grad/</code>. Za kvart, s pročitanim oznakama namjene, vidi{" "}
          <Link href="/plan" className="fokus font-semibold text-emerald-700 underline">
            što nacrt GUP-a mijenja u Dračevcu i Bilicama
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
