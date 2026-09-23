/**
 * Premali ostaci za kartu provjere GUP-a, po načinu brojanja i godini:
 * `/api/gup-ostaci/<inačica>-<godina>` → { ostaci: [[čestica, klasa], …] }.
 *
 * Ostatak ovisi o susjednim česticama po cijelom gradu, a karta učitava
 * čestice po pločicama — pa ga ne može izračunati sama. Računa ga isti
 * izracun.ts kao /gup, pri gradnji (sve kombinacije su poznate unaprijed).
 */
import { GODINE, type Godina } from "@/lib/gup-grad/model";
import { ostaci, ucitajMjerenja } from "@/lib/gup-grad/podaci";
import { INACICE } from "@/lib/gup-grad/pravila";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return INACICE.flatMap((i) => GODINE.map((g) => ({ kljuc: `${i.id}-${g}` })));
}

export async function GET(_req: Request, ctx: { params: Promise<{ kljuc: string }> }) {
  const { kljuc } = await ctx.params;
  const m = /^(.+)-(\d{4})$/.exec(kljuc);
  const inacica = INACICE.find((i) => i.id === m?.[1]);
  const godina = Number(m?.[2]) as Godina;
  if (!inacica || !GODINE.includes(godina)) {
    return Response.json({ error: "Nepoznata inačica ili godina." }, { status: 404 });
  }
  const d = await ucitajMjerenja();
  return Response.json({ ostaci: ostaci(d, godina, inacica.pravila) });
}
