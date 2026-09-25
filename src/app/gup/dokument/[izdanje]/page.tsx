import { notFound } from "next/navigation";

import { StranicaIzdanja } from "@/components/gup-dokument/stranica-izdanja";
import { IZDANJA, izdanje, ZADANO_IZDANJE } from "@/lib/gup-dokument/izdanja";
import { createPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ izdanje: string }> };

export const dynamicParams = false;

/** Zadano izdanje je na /gup/dokument (next.config preusmjerava /gup/dokument/2015). */
export function generateStaticParams() {
  return IZDANJA.filter((i) => i.id !== ZADANO_IZDANJE).map((i) => ({ izdanje: i.id }));
}

export async function generateMetadata({ params }: Props) {
  const izd = izdanje((await params).izdanje);
  return createPageMetadata({
    title: izd ? `GUP Splita: ${izd.naziv} (${izd.podnaslov})` : "GUP Splita",
    description: izd ? `${izd.status} Cijeli tekst odredbi i kartografski prikazi.` : "Generalni urbanistički plan Splita.",
  });
}

export default async function IzdanjePage({ params }: Props) {
  const izd = izdanje((await params).izdanje);
  if (!izd || izd.id === ZADANO_IZDANJE) notFound();
  return <StranicaIzdanja izd={izd} />;
}
