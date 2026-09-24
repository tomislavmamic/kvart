/**
 * Premali ostaci za kartu provjere GUP-a, po načinu brojanja i godini:
 * `/api/gup-ostaci/<inačica>-<godina>` →
 *   { ostaci: [[čestica, klasa], …],
 *     ppmin: { <kod pravila>: { stanovanje?, gospodarska?, javna?, izvor, citat } } }
 *
 * Ostatak ovisi o susjednim česticama po cijelom gradu, a karta učitava
 * čestice po pločicama — pa ga ne može izračunati sama. Računa ga isti
 * izracun.ts kao /gup, pri gradnji (sve kombinacije su poznate unaprijed).
 * `ppmin` je najmanja građevna čestica iz odredbi po području urbanog
 * pravila i vrsti, izabrana po istim pravilima — za skočni prozor.
 */
import { GODINE, KLASE, type Godina } from "@/lib/gup-grad/model";
import { najmanjaCestica, VRSTA_ZA_KLASU, type NajmanjaCestica } from "@/lib/gup-grad/odredbe";
import { ostaci, ucitajMjerenja, ucitajPpmin } from "@/lib/gup-grad/podaci";
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
  const [d, tab] = await Promise.all([ucitajMjerenja(), ucitajPpmin()]);
  const ppmin: Record<string, Partial<Record<string, NajmanjaCestica>>> = {};
  for (const kod of Object.keys(tab.godine[String(godina)] ?? {})) {
    for (const kl of KLASE) {
      const vrsta = VRSTA_ZA_KLASU[kl.kod];
      if (!vrsta) continue;
      const n = najmanjaCestica(tab, godina, kod, kl.kod, inacica.pravila);
      if (n) (ppmin[kod] ??= {})[vrsta] = n;
    }
  }
  return Response.json({ ostaci: ostaci(d, godina, inacica.pravila, tab), ppmin });
}
