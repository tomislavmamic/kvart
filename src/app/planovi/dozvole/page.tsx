/**
 * /planovi/dozvole: zahtjevi za građevinsku i lokacijsku dozvolu po važećem
 * GUP-u na zemljištu koje prijedlog GUP-a 2025. stavlja u urbanu sanaciju,
 * sa svim ishodima. Brojke se čitaju na poslužitelju iz istog geojsona koji
 * karta učita (scripts/gup-grad/dozvole-sanacija.py).
 */
import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { DozvolePrikaz } from "@/components/gup-grad/dozvole-prikaz";
import { BOJE_ISHODA, ISHODI, NAZIV_ISHODA, datum, type PodaciDozvola, type Predmet } from "@/lib/gup-grad/dozvole";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Dozvole na zemljištu koje novi GUP stavlja u urbanu sanaciju",
  description:
    "Karta i popis svih zahtjeva za građevinsku i lokacijsku dozvolu od 2006. na zemljištu u Splitu koje prijedlog GUP-a 2025. označava kao urbanu sanaciju: izdane, odbijene, obustavljene i one u obradi.",
});

const vanjska = "fokus text-emerald-700 underline";

async function ucitaj(): Promise<{ podaci: PodaciDozvola; osnovni: Predmet[] }> {
  const put = path.join(process.cwd(), "public", "geo", "gup-grad", "dozvole-sanacija-2025.geojson");
  const podaci = JSON.parse(await readFile(put, "utf8")) as PodaciDozvola;
  const osnovni = podaci.features
    .map((f) => f.properties as Predmet & { sloj: string })
    .filter((p) => p.sloj === "akt" && !p.izmjena);
  return { podaci, osnovni };
}

export default async function DozvolePage() {
  const { podaci, osnovni } = await ucitaj();
  const z = podaci.zbroj;
  const n = (f: (p: Predmet) => boolean) => osnovni.filter(f).length;
  const izdaneNove = n((p) => p.ishod === "izdana" && p.zahvat_vrsta === "nova zgrada");
  const iz2026 = n((p) => (p.datum ?? p.zaprimljeno ?? "").startsWith("2026"));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm">
        <Link href="/planovi" className="fokus text-emerald-700 underline">
          Planovi
        </Link>
      </p>
      <h1 className="mt-1 max-w-4xl text-2xl font-bold text-zinc-900 [text-wrap:balance]">
        Dozvole na zemljištu koje novi GUP stavlja u urbanu sanaciju
      </h1>
      <p className="mt-3 max-w-3xl text-zinc-700">
        Prijedlog GUP-a iz travnja 2025. dijelove izgrađenih naselja na{" "}
        <Navod id="list-planske-mjere-2025">listu 4.d</Navod> označava kao urbanu sanaciju. Tamo će se do donošenja
        urbanističkog plana uređenja (UPU) smjeti samo rekonstruirati i zamijeniti postojeće zgrade. Po važećem GUP-u Grad na
        tom zemljištu rješava zahtjeve za dozvole kao i drugdje. Ovdje su svi zahtjevi za građevinsku i lokacijsku dozvolu
        podneseni ondje otkako je važeći GUP stupio na snagu 2006.: izdani, odbijeni, obustavljeni, proslijeđeni i oni u
        obradi.
      </p>

      <dl className="mt-6 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [n((p) => p.ishod === "izdana"), "izdanih dozvola", `od toga ${izdaneNove} za novu zgradu`],
          [n((p) => p.ishod === "odbijena"), "odbijenih zahtjeva", null],
          [n((p) => p.ishod === "obustavljena" || p.ishod === "proslijeđena"), "obustavljenih ili proslijeđenih", null],
          [n((p) => p.ishod === "u obradi"), "u obradi", null],
        ].map(([b, s, d]) => (
          <div key={s as string} className="flex flex-col">
            <dt className="order-2 text-sm text-zinc-600">{s}</dt>
            <dd className="order-1 text-3xl font-bold tabular-nums text-zinc-900">{b}</dd>
            {d && <dd className="order-3 text-xs text-zinc-500">{d}</dd>}
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-3xl text-sm text-zinc-600">
        Ukupno {osnovni.length} zahtjeva na {z.cestice} čestica, od toga {iz2026} iz 2026., uz još{" "}
        {z.predmeti - osnovni.length} izmjena i produljenja dozvola. Čestica nosi boju prvog ishoda po redu{" "}
        {ISHODI.slice(0, 5).map((i, k) => (
          <span key={i}>
            <span aria-hidden className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-baseline" style={{ background: BOJE_ISHODA[i] }} />
            {NAZIV_ISHODA[i]}
            {k < 4 ? ", " : ""}
          </span>
        ))}
        . Zelenim rubom omeđena je urbana sanacija s lista 4.d.
      </p>

      <DozvolePrikaz />

      <section className="mt-12 max-w-3xl text-sm leading-relaxed text-zinc-700">
        <h2 id="izvori" className="scroll-mt-20 border-b border-zinc-200 pb-2 text-xl font-bold text-zinc-900">
          Izvori i način izračuna
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Predmeti su iz dvaju javnih registara Ministarstva prostornoga uređenja, graditeljstva i državne imovine. Registar
            eDozvola (WFS servis) za svaki predmet daje obuhvat zahvata, odnosno građevnu česticu, ali je stao s krajem 2025.
            (zadnji zahtjev zaprimljen je {datum(z.zadnji_u_edozvoli)}), pa ondje „u obradi” znači stanje iz tog vremena.
            Ostali predmeti, uključujući one iz 2026., i ishodi predmeta koji su u eDozvoli bili neriješeni skinuti su{" "}
            {datum(podaci.izradjeno)} s geoportala{" "}
            <a href="https://ispu.mgipu.hr/" className={vanjska}>
              ISPU
            </a>{" "}
            (Registar dozvola/akata) za sve plohe sanacije. Takav predmet vezan je uz česticu na kojoj ga je geoportal iscrtao.
          </li>
          <li>
            Predmet je na karti ako je barem pola njegova obuhvata u urbanoj sanaciji, a čestica ako je barem pola nje u
            obuhvatu predmeta ili barem pola obuhvata na njoj. Urbana sanacija je ploha s{" "}
            <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga GUP-a, prenesena kao na stranici{" "}
            <Link href="/gup/zabrana" className={vanjska}>
              zabrane gradnje
            </Link>
            , bez planova na snazi. Uzeti su samo predmeti riješeni ili zaprimljeni od 2. veljače 2006., kad je GUP (Službeni
            glasnik Grada Splita 1/06) stupio na snagu.
          </li>
          <li>
            Vrsta zahvata (nova zgrada, rekonstrukcija) čita se iz opisa u predmetu; gdje ga nema, piše „nije navedeno”.
            Obustavljen postupak obično znači da je podnositelj povukao zahtjev. Razlog odbijanja registar ne navodi.
          </li>
          <li>
            Registri ne moraju biti potpuni, a predmet koji je na karti geoportala skriven ispod većeg oblika može promaknuti,
            pa su brojke najmanje.{" "}
            <a href="/geo/gup-grad/dozvole-sanacija-2025.csv" className={vanjska}>
              Cijeli popis predmeta (CSV)
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
