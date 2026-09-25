/**
 * Stranica jednog izdanja GUP-a na /gup/dokument: kartografski prikazi
 * (sličice, svaka vodi na list u punoj veličini) i cijeli tekst odredbi, uz
 * sadržaj koji prati čitanje (sadrzaj-izdanja.tsx).
 *
 * Tekst je prepisan iz PDF-a Službenog glasnika po stranicama i člancima,
 * s tablicama kao slikama stranice (scripts/gup-grad/dokument.py). Na nj
 * vode navodi s /gup i s karte čestica, s istaknutim citatom (Oznacivac).
 */
import Link from "next/link";

import { IZDANJA, putLista, type Izdanje } from "@/lib/gup-dokument/izdanja";
import { ucitajDokument, ucitajListove } from "@/lib/gup-dokument/podaci";
import { SIDRO_KARATA, sadrzajDokumenta, sidroDokumenta } from "@/lib/gup-dokument/sadrzaj";

import { Oznacivac } from "./oznacivac";
import { MjestoCitanja, SadrzajIzdanja, TrakaSadrzaja } from "./sadrzaj-izdanja";
import { TekstDokumenta } from "./tekst-dokumenta";

export async function StranicaIzdanja({ izd }: { izd: Izdanje }) {
  const [dokumenti, listovi] = await Promise.all([Promise.all(izd.dokumenti.map(ucitajDokument)), ucitajListove()]);

  return (
    <MjestoCitanja dokumenti={dokumenti.map((d) => sadrzajDokumenta(izd, d))}>
      <div className="mx-auto max-w-3xl lg:grid lg:max-w-none lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <nav aria-label="Izdanja plana" className="traka-vodoravna -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {IZDANJA.map((i) => {
              const odabrano = i.id === izd.id;
              return (
                <Link
                  key={i.id}
                  href={i.put}
                  aria-current={odabrano ? "page" : undefined}
                  className={`fokus meta-cip inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-sm font-semibold ${
                    odabrano
                      ? "border-maslina bg-maslina text-white"
                      : "border-kamen-rub bg-white text-kamen-tekst hover:border-maslina hover:text-maslina"
                  }`}
                >
                  {i.naziv}
                </Link>
              );
            })}
          </nav>

          <h1 className="mt-5 text-2xl font-bold">Generalni urbanistički plan Splita</h1>
          <p className="mt-1 font-semibold text-kamen-tekst">
            {izd.naziv} — {izd.podnaslov}
          </p>
          <p className="mt-3 text-kamen-tekst">{izd.status}</p>
          <p className="mt-3 text-sm text-kamen-drugi">
            Tekst je prepisan iz izvornog PDF-a po stranicama i člancima, tablice su slike stranice. Mjerodavan je
            izvornik: {dokumenti.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ", "}
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="fokus underline hover:text-kamen-tinta">
                  {d.kratko} (PDF)
                </a>
              </span>
            ))}
            . Što je od ovoga izračunato, na{" "}
            <Link href="/gup" className="fokus font-semibold text-maslina underline">
              Split po GUP-u
            </Link>
            .
          </p>

          <section aria-labelledby={SIDRO_KARATA} className="mt-8">
            <h2 id={SIDRO_KARATA} className="scroll-mt-24 text-lg font-bold">
              Kartografski prikazi <span className="font-normal text-kamen-drugi">· {izd.listovi.length}</span>
            </h2>
            {/* na telefonu traka koja se pomiče prstom, od sm mreža u kojoj se vide svi listovi */}
            <ul className="traka-vodoravna -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {izd.listovi.map(({ id, napomena }) => {
                const l = listovi[id];
                if (!l) return null;
                return (
                  <li key={id} className="w-64 shrink-0 snap-start sm:w-auto">
                    <Link href={putLista(id)} className="fokus group block rounded-xl bg-white p-2 hover:shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element -- sličica lista, statična datoteka */}
                      <img
                        src={`/gup/listovi/${id}/slicica.webp`}
                        width={l.slicica.sirina}
                        height={l.slicica.visina}
                        loading="lazy"
                        alt=""
                        className="h-auto w-full rounded-lg bg-white"
                      />
                      <span className="mt-2 block text-sm font-semibold leading-snug text-kamen-tinta group-hover:text-maslina">
                        {l.naslov}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-kamen-drugi">{napomena ?? l.izvor}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-8">
            <TrakaSadrzaja />
            {dokumenti.map((d, i) => (
              <section key={d.id} aria-labelledby={sidroDokumenta(d.id)} className={i === 0 ? "mt-6 lg:mt-2" : "mt-10"}>
                <h2 id={sidroDokumenta(d.id)} className="scroll-mt-24 border-b border-kamen-tlo pb-2 text-lg font-bold">
                  {d.naslov}
                  <span className="mt-0.5 block text-sm font-normal text-kamen-drugi">{d.izvor}</span>
                </h2>
                <div className="mt-4">
                  <TekstDokumenta izd={izd} dok={d} />
                </div>
              </section>
            ))}
          </div>
          <Oznacivac />
        </div>
        {/* Od lg stupac lijevo od teksta, ispod lg donja ploča koju otvara traka
            iznad teksta. U kodu stoji iza teksta, da tipkovnica ne prolazi kroz
            sve stavke sadržaja prije nego što dođe do stranice. */}
        <SadrzajIzdanja />
      </div>
    </MjestoCitanja>
  );
}
