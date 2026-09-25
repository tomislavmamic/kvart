/**
 * Jedan kartografski prikaz GUP-a u punoj veličini (150 dpi, pločice).
 * Navod lista vodi ovamo s okvirom u adresi, pa se preglednik otvori
 * približen na mjesto na koje se navod poziva.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { PreglednikLista } from "@/components/gup-dokument/preglednik-lista";
import { izdanjaLista } from "@/lib/gup-dokument/izdanja";
import { ucitajListove } from "@/lib/gup-dokument/podaci";
import { createPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ list: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return Object.keys(await ucitajListove()).map((list) => ({ list }));
}

export async function generateMetadata({ params }: Props) {
  const l = (await ucitajListove())[(await params).list];
  return createPageMetadata({
    title: l ? `GUP Splita: ${l.naslov} (${l.izvor})` : "GUP Splita: kartografski prikaz",
    description: "Kartografski prikaz Generalnog urbanističkog plana Splita u mjerilu 1:10 000, u punoj veličini.",
  });
}

export default async function ListPage({ params }: Props) {
  const l = (await ucitajListove())[(await params).list];
  if (!l) notFound();
  const izdanja = izdanjaLista(l.id);
  return (
    <div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {izdanja.map((i) => (
          <Link key={i.id} href={`${i.put}#karte`} className="fokus meta flex items-center text-kamen-drugi hover:text-maslina">
            ← {i.naziv}
          </Link>
        ))}
      </p>
      <h1 className="mt-2 text-2xl font-bold">{l.naslov}</h1>
      <p className="mt-1 text-sm text-kamen-drugi">
        {l.izvor} · mjerilo 1:10 000 ·{" "}
        <a href={l.url} target="_blank" rel="noopener noreferrer" className="fokus underline hover:text-kamen-tinta">
          izvornik (PDF, split.hr)
        </a>
      </p>
      <div className="mt-4 h-[72dvh] min-h-[420px] overflow-hidden rounded-xl bg-white">
        <PreglednikLista list={l} />
      </div>
      <p className="mt-2 text-sm text-kamen-drugi">
        Približi s dva prsta ili kotačićem miša. List je iscrtan iz izvornika na 150 točaka po inču — dovoljno da se
        čitaju oznake zona i tumač znakova; za pojedinu česticu mjerodavan je izvornik.
      </p>
    </div>
  );
}
