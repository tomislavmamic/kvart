/**
 * Navod GUP-a kao stranica: isti ulomak kao u skočnom prozoru. Na nju vodi
 * svaka poveznica navoda kad nema JavaScripta, i ona je adresa koja se može
 * poslati („pogledaj što plan kaže”).
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { TijeloUlomka } from "@/components/gup-dokument/ulomak";
import { izdanje } from "@/lib/gup-dokument/izdanja";
import { imenaNavoda, razrijesi } from "@/lib/gup-dokument/navodi";
import { createPageMetadata } from "@/lib/metadata";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await imenaNavoda()).map((id) => ({ id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const u = await razrijesi((await params).id);
  return createPageMetadata({
    title: u ? `GUP: ${u.naslov}` : "Navod iz GUP-a",
    description: u?.opis ? `Što GUP Splita kaže: ${u.opis}.` : "Doslovan tekst ili isječak kartografskog prikaza GUP-a Splita.",
  });
}

export default async function NavodPage({ params }: Props) {
  const u = await razrijesi((await params).id);
  if (!u) notFound();
  const izd = izdanje(u.izdanje);
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.06em] text-kamen-drugi">
        Iz GUP-a{izd ? ` · ${izd.naziv}` : ""}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{u.naslov}</h1>
      {u.opis && <p className="mt-2 text-kamen-drugi">{u.opis}</p>}
      <div className="mt-6 rounded-xl bg-white p-5">
        <TijeloUlomka u={u} />
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a
          href={u.href}
          className="fokus meta inline-flex items-center rounded-full bg-maslina px-5 py-2.5 text-sm font-semibold text-white hover:bg-maslina-tamna"
        >
          {u.list ? "Otvori cijeli list" : "Otvori u cijelom dokumentu"} →
        </a>
        <a
          href={u.list ? u.list.url : u.dokument?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="fokus meta text-sm text-kamen-drugi underline hover:text-kamen-tinta"
        >
          Izvornik (PDF, split.hr)
        </a>
        <Link href="/gup" className="fokus meta text-sm text-kamen-drugi underline hover:text-kamen-tinta">
          Split po GUP-u
        </Link>
      </p>
      {u.dokument && <p className="mt-6 text-sm text-kamen-drugi">{u.dokument.naslov}. {u.dokument.izvor}.</p>}
    </div>
  );
}
