/**
 * Cijeli tekst jednog dokumenta GUP-a na /gup/dokument, blok po blok.
 *
 * Svaki blok nosi svoje sidro (s37-5), članak i sidro članka (cl-53), a na
 * prijelazu stranice stoji oznaka sa sidrom stranice (str-37) — navodi se
 * pozivaju na stranice glasnika, pa stranica mora biti vidljiva u tekstu.
 * Tekst bloka je jedan tekstualni čvor, pa se rasponi istaknutog navoda
 * (Oznacivac) mogu primijeniti izravno na znakove.
 */
import type { ReactNode } from "react";

import { sidro, type Izdanje } from "@/lib/gup-dokument/izdanja";
import type { Blok, Dokument } from "@/lib/gup-dokument/model";

/*
 * Izgled blokova je u globals.css (.gup-tekst), a ne u utilityjima na svakom
 * bloku: tekst pročišćenog plana ima ~2 500 blokova, a RSC ga šalje dvaput
 * (HTML i podaci za hidraciju), pa bi isti niz razreda na svakom bloku
 * stranici dodao stotine kilobajta.
 */
function Naslov({ b, id }: { b: Blok; id: string }) {
  const r = b.r ?? 5;
  if (r === 1) return <h3 id={id}>{b.t}</h3>;
  if (r === 2) return <h4 id={id}>{b.t}</h4>;
  if (r <= 4) return <h5 id={id}>{b.t}</h5>;
  return <h6 id={id}>{b.t}</h6>;
}

export function TekstDokumenta({ izd, dok }: { izd: Izdanje; dok: Dokument }) {
  const s = (lokalno: string) => sidro(izd, dok.id, lokalno);
  const out: ReactNode[] = [];
  let popis: ReactNode[] = [];
  let zadnjaStranica = 0;

  const zatvoriPopis = () => {
    if (popis.length) {
      out.push(
        <ul key={`ul-${out.length}`}>
          {popis}
        </ul>,
      );
      popis = [];
    }
  };

  for (const b of dok.blokovi) {
    if (b.s !== zadnjaStranica) {
      zatvoriPopis();
      out.push(
        <p key={`str-${b.s}`} id={s(`str-${b.s}`)} className="str">
          {dok.kratko}, str. {b.s}
        </p>,
      );
      zadnjaStranica = b.s;
    }
    const id = s(b.id);
    if (b.v === "li") {
      popis.push(
        // nastavak stavke s prethodne stranice: bez nove oznake popisa
        <li key={b.id} id={id} className={b.nast ? "nast" : undefined}>
          {b.t}
        </li>,
      );
      continue;
    }
    zatvoriPopis();
    if (b.v === "cl") {
      out.push(
        <h5 key={b.id} id={s(b.a!)} className="cl">
          <span id={id}>{b.t}</span>
        </h5>,
      );
    } else if (b.v === "n") {
      out.push(<Naslov key={b.id} b={b} id={id} />);
    } else if (b.v === "tab") {
      out.push(
        <figure key={b.id} id={id} data-tablica>
          <a href={b.src} target="_blank" rel="noopener noreferrer" className="fokus block rounded">
            {/* eslint-disable-next-line @next/next/no-img-element -- tablica kao slika stranice glasnika */}
            <img src={b.src} width={b.w} height={b.h} loading="lazy" alt={`Tablica: ${b.t.slice(0, 400)}`} className="h-auto w-full rounded bg-white" />
          </a>
          <figcaption className="mt-1 text-xs text-kamen-tih">Tablica kao u izvorniku — dodirni za punu veličinu.</figcaption>
        </figure>,
      );
    } else {
      out.push(
        <p key={b.id} id={id}>
          {b.t}
        </p>,
      );
    }
  }
  zatvoriPopis();
  return <div className="gup-tekst">{out}</div>;
}
