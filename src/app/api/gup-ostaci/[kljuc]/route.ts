/**
 * Premali ostaci za kartu provjere GUP-a, po načinu brojanja i godini:
 * `/api/gup-ostaci/<inačica>-<godina>` →
 *   { ostaci: [[čestica, klasa], …],
 *     posudjeno: [[čestica, klasa, pikseli, od toga protivno], …]  — vrt zgrade sa susjedne čestice,
 *     ppmin: { <kod pravila>: { stanovanje?, gospodarska?, javna?, izvor, citat } },
 *     gradnja: { <kod pravila>: { novaGradnja, kig, kis, nova_stambena, izvor, citat } },
 *     navodi: [id, …] }  — navodi GUP-a za ovu godinu (ppmin-, gradnja-, namjena-…)
 *
 * Ostatak i posuđena okućnica ovise o susjednim česticama po cijelom
 * gradu, a karta učitava čestice po pločicama — pa ih ne može izračunati
 * sama. Računa ga isti
 * izracun.ts kao /gup, pri gradnji (sve kombinacije su poznate unaprijed).
 * `ppmin` je najmanja građevna čestica iz odredbi po području urbanog
 * pravila i vrsti, izabrana po istim pravilima; `gradnja` je što odredbe
 * ondje dopuštaju graditi (za stambene i mješovite zone) — oboje treba karti
 * da presudi česticu isto kao /gup, i skočnom prozoru da kaže zašto.
 */
import { GODINE, KLASE, type Godina } from "@/lib/gup-grad/model";
import { najmanjaCestica, uvjetiGradnje, VRSTA_ZA_KLASU, type NajmanjaCestica } from "@/lib/gup-grad/odredbe";
import { ostaci, ucitajMjerenja, ucitajOdredbe } from "@/lib/gup-grad/podaci";
import { INACICE } from "@/lib/gup-grad/pravila";
import { imenaNavoda } from "@/lib/gup-dokument/navodi";

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
  const [d, o] = await Promise.all([ucitajMjerenja(), ucitajOdredbe()]);
  const ppmin: Record<string, Partial<Record<string, NajmanjaCestica>>> = {};
  for (const kod of Object.keys(o.ppmin.godine[String(godina)] ?? {})) {
    for (const kl of KLASE) {
      const vrsta = VRSTA_ZA_KLASU[kl.kod];
      if (!vrsta) continue;
      const n = najmanjaCestica(o.ppmin, godina, kod, kl.kod, inacica.pravila);
      if (n) (ppmin[kod] ??= {})[vrsta] = n;
    }
  }
  const gradnja: Record<
    string,
    { novaGradnja: boolean; kig: number | null; kis: number | null; nova_stambena: string; izvor: string; citat: string }
  > = {};
  for (const kod of Object.keys(o.gradnja.godine[String(godina)] ?? {})) {
    const u = uvjetiGradnje(o.gradnja, godina, kod, "S", inacica.pravila);
    if (u.pravilo) {
      gradnja[kod] = {
        novaGradnja: u.novaGradnja,
        kig: u.kig,
        kis: u.kis,
        nova_stambena: u.pravilo.nova_stambena,
        izvor: u.pravilo.izvor,
        citat: u.pravilo.citat,
      };
    }
  }
  // Skočni prozor čestice povezuje izvor odredbe s njezinim tekstom (navod GUP-a)
  // samo ako taj navod postoji — pa mu treba popis, a sam ga ne može znati.
  const navodi = (await imenaNavoda()).filter((id) => /^(ppmin|gradnja|namjena)-(\d{4})-/.exec(id)?.[2] === String(godina));
  return Response.json({ ...ostaci(d, godina, inacica.pravila, o), ppmin, gradnja, navodi });
}
