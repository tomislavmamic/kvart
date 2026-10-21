/**
 * /planovi/dozvole: zahtjevi za građevinsku i lokacijsku dozvolu po važećem
 * GUP-u na zemljištu koje prijedlog GUP-a 2025. stavlja u urbanu sanaciju,
 * sa svim ishodima. Karta je preko cijele širine (SIROKA_KARTA u
 * site-chrome.tsx), a sav tekst je u ploči uz nju (DozvolePrikaz); ovdje se
 * iscrtavaju uvod i izvori, s datumima iz istog geojsona koji karta učita
 * (scripts/gup-grad/dozvole-sanacija.py).
 */
import { readFile } from "fs/promises";
import path from "path";
import Link from "next/link";

import { Navod } from "@/components/gup-dokument/navod";
import { DozvolePrikaz } from "@/components/gup-grad/dozvole-prikaz";
import { datum, type PodaciDozvola } from "@/lib/gup-grad/dozvole";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Dozvole na zemljištu koje novi GUP stavlja u urbanu sanaciju",
  description:
    "Karta i popis svih zahtjeva za građevinsku i lokacijsku dozvolu od 2006. na zemljištu u Splitu koje prijedlog GUP-a 2025. označava kao urbanu sanaciju: izdane, odbijene, obustavljene i one u obradi.",
});

const vanjska = "fokus text-emerald-700 underline";

async function ucitaj(): Promise<Pick<PodaciDozvola, "izradjeno" | "zbroj">> {
  const put = path.join(process.cwd(), "public", "geo", "gup-grad", "dozvole-sanacija-2025.geojson");
  const { izradjeno, zbroj } = JSON.parse(await readFile(put, "utf8")) as PodaciDozvola;
  return { izradjeno, zbroj };
}

export default async function DozvolePage() {
  const { izradjeno, zbroj } = await ucitaj();

  const uvod = (
    <p>
      Svi zahtjevi za građevinsku i lokacijsku dozvolu kojima je obuhvat barem pola u plohama urbane sanacije (izgrađeni
      dio) s <Navod id="list-planske-mjere-2025">lista 4.d</Navod> prijedloga GUP-a 2025.: izdani, odbijeni, obustavljeni
      (zahtjev povučen), proslijeđeni drugom tijelu i oni u obradi. Na tom bi zemljištu do donošenja UPU-a bile dopuštene
      samo rekonstrukcija i zamjena (
      <Link href="/gup/zabrana" className={vanjska}>
        zabrana gradnje
      </Link>
      ).
    </p>
  );

  const izvori = (
    <div className="space-y-2">
      <p>
        <strong className="text-zinc-800">Izvori.</strong> Predmeti: registar eDozvola Ministarstva prostornoga uređenja,
        graditeljstva i državne imovine (WFS, obuhvati zahvata i zgrade), skinuto {datum(izradjeno)}. Taj registar je stao s
        krajem 2025. (zadnji zahtjev {datum(zbroj.zadnji_u_edozvoli)}), pa ondje „u obradi” znači stanje tada. Ostali
        predmeti, uključujući one iz 2026., i ishodi predmeta koji su u eDozvoli bili neriješeni skinuti su {datum(izradjeno)}{" "}
        s geoportala{" "}
        <a href="https://ispu.mgipu.hr/" className={vanjska}>
          ISPU
        </a>{" "}
        (Registar akata) za sve plohe sanacije (oznaka ISPU). Uzeti su samo predmeti riješeni ili zaprimljeni od 2. 2. 2006.,
        kad je važeći GUP stupio na snagu. Obustavljen postupak obično znači da je podnositelj povukao zahtjev; proslijeđen je
        predmet koji je poslan drugom tijelu. Urbana sanacija: <Navod id="list-planske-mjere-2025">list 4.d</Navod> prijedloga
        GUP-a (travanj 2025.), vektoriziran, bez planova na snazi. Čestice: katastar DGU-a.
      </p>
      <p>
        <strong className="text-zinc-800">Granice.</strong> Vrsta zahvata (nova zgrada, rekonstrukcija) čita se iz opisa u
        predmetu; gdje ga nema, piše „nije navedeno”. Brojke na vrhu ne broje izmjene i produljenja dozvola. Registar ne
        mora biti potpun. Čestica je na karti ako je barem pola nje u obuhvatu akta ili barem pola obuhvata na njoj; predmet
        s ISPU-a veže se na česticu na kojoj ga je geoportal iscrtao. Predmet skriven ispod većeg oblika na ISPU-ovoj karti
        može promaknuti, pa su brojke najmanje. Razlog odbijanja registar ne navodi.
      </p>
      <p>
        <a href="/geo/gup-grad/dozvole-sanacija-2025.csv" className={vanjska}>
          Cijeli popis predmeta (CSV)
        </a>
      </p>
    </div>
  );

  return <DozvolePrikaz uvod={uvod} izvori={izvori} />;
}
