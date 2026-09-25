/**
 * Ulomak GUP-a: doslovan tekst s istaknutim citatom, ili isječak lista.
 * Isti prikaz u skočnom prozoru (ProzorNavoda) i na stranici navoda
 * (/gup/navod/<id>), pa nema kukica ni stanja.
 */
import type { ReactNode } from "react";

import type { Ulomak } from "@/lib/gup-dokument/model";

import { IsjecakLista } from "./isjecak-lista";

/** Tekst bloka s <mark> na rasponima [od, do). */
export function sOznakama(t: string, oznake?: [number, number][]): ReactNode {
  if (!oznake?.length) return t;
  const out: ReactNode[] = [];
  let i = 0;
  for (const [a, b] of oznake) {
    if (a > i) out.push(t.slice(i, a));
    out.push(
      <mark key={a} className="navod-oznaka">
        {t.slice(a, b)}
      </mark>,
    );
    i = b;
  }
  if (i < t.length) out.push(t.slice(i));
  return out;
}

export function TijeloUlomka({ u }: { u: Ulomak }) {
  if (u.list) {
    const l = u.list;
    return l.okvir ? (
      <IsjecakLista list={l} okvir={l.okvir} tocka={l.tocka} alt={`${l.naslov} — isječak (${l.izvor})`} />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element -- sličica lista je statična datoteka
      <img
        src={`/gup/listovi/${l.id}/slicica.webp`}
        width={l.slicica.sirina}
        height={l.slicica.visina}
        alt={`${l.naslov} (${l.izvor})`}
        className="h-auto w-full rounded-lg bg-white"
      />
    );
  }
  const blokovi = u.blokovi ?? [];
  return (
    <div className="space-y-2 text-kamen-tekst">
      {blokovi.map((b, i) => {
        const skok = i > 0 && b.s !== blokovi[i - 1].s;
        const stranica = skok ? <p className="text-xs text-kamen-tih">— str. {b.s} —</p> : null;
        if (b.v === "tab") {
          return (
            <div key={b.id}>
              {stranica}
              {/* eslint-disable-next-line @next/next/no-img-element -- tablica kao slika stranice glasnika */}
              <img
                src={b.src}
                width={b.w}
                height={b.h}
                alt={`Tablica: ${b.t.slice(0, 300)}`}
                className={`h-auto w-full rounded bg-white ${b.oznake ? "ring-2 ring-amber-300" : ""}`}
              />
            </div>
          );
        }
        const tekst = sOznakama(b.t, b.oznake);
        return (
          <div key={b.id}>
            {stranica}
            {b.v === "cl" ? (
              <p className="font-semibold text-kamen-tinta">{tekst}</p>
            ) : b.v === "n" ? (
              <p className="font-semibold text-kamen-tinta">{tekst}</p>
            ) : b.v === "li" ? (
              <p className={b.nast ? "pl-4" : "relative pl-4 before:absolute before:left-0 before:content-['–']"}>{tekst}</p>
            ) : (
              <p>{tekst}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
