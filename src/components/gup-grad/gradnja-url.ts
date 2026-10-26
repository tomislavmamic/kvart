/**
 * Stanje /gup/gradnja u poveznici, da se podijeljena poveznica otvori na
 * istom pogledu: `?v=karta&c=17.25/43.51234/16.45123&s=13.11&p=upu&t=16.45110,43.51201`
 *
 *  - v: prikaz (karta; bez njega pregled)
 *  - c: zum/širina/dužina karte
 *  - s: kodovi vidljivih kategorija (gradnja.ts), točkom odvojeni; bez njega zadano (samo stambeno)
 *  - p: istaknuta zapreka („Što priječi gradnju”)
 *  - t: odabrano mjesto, dužina,širina
 *
 * Piše se kroz window.history (Next ga prati, docs: linking-and-navigating):
 * pomak karte zamjenjuje zapis, a otvaranje karte ili kartice dodaje novi,
 * pa ih tipka Natrag zatvori.
 */
import { KATEGORIJE, KATEGORIJA_PO_KODU, PREPREKA_PO_ID, SKUPINE_GRADNJE, type IdKategorije, type IdPrepreke } from "@/lib/gup-grad/gradnja";

export type Prozor = "pregled" | "karta";

export interface StanjeUrl {
  prozor: Prozor;
  pogled: { zum: number; lat: number; lng: number } | null;
  skrivene: ReadonlySet<IdKategorije>;
  prepreka: IdPrepreke | null;
  tocka: [number, number] | null;
}

/** Zadano je na karti stambeno i ono o čemu odlučuje plan na snazi (ondje stambeno može biti dopušteno). */
export const ZADANO_VIDLJIVE: readonly IdKategorije[] = [SKUPINE_GRADNJE.stambeno.glavna, SKUPINE_GRADNJE.stambeno.uvjetna!, "po-planu"];
export const zadanoSkrivene = (): ReadonlySet<IdKategorije> =>
  new Set(KATEGORIJE.map((k) => k.id).filter((id) => !ZADANO_VIDLJIVE.includes(id)));

const broj = (s: string | undefined) => (s !== undefined && s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);

export function procitajUrl(search: string): StanjeUrl {
  const q = new URLSearchParams(search);
  const c = q.get("c")?.split("/").map(broj);
  const pogled = c && c.length === 3 && c.every((v) => v !== null) ? { zum: c[0]!, lat: c[1]!, lng: c[2]! } : null;
  const t = q.get("t")?.split(",").map(broj);
  const tocka = t && t.length === 2 && t.every((v) => v !== null) ? ([t[0]!, t[1]!] as [number, number]) : null;
  const s = q.get("s");
  let skrivene = zadanoSkrivene();
  if (s !== null) {
    const vidljive = new Set(s.split(".").map((k) => KATEGORIJA_PO_KODU.get(Number(k))?.id).filter(Boolean));
    skrivene = new Set(KATEGORIJE.map((k) => k.id).filter((id) => !vidljive.has(id)));
  }
  const p = q.get("p");
  return {
    prozor: q.get("v") === "karta" || pogled || tocka ? "karta" : "pregled",
    pogled,
    skrivene,
    prepreka: p && p in PREPREKA_PO_ID ? (p as IdPrepreke) : null,
    tocka,
  };
}

export function napisiUrl(s: StanjeUrl): string {
  const q = new URLSearchParams();
  if (s.prozor === "karta") {
    q.set("v", "karta");
    if (s.pogled) q.set("c", `${Math.round(s.pogled.zum * 100) / 100}/${s.pogled.lat.toFixed(5)}/${s.pogled.lng.toFixed(5)}`);
    const zadano = zadanoSkrivene();
    const isto = zadano.size === s.skrivene.size && [...zadano].every((id) => s.skrivene.has(id));
    if (!isto)
      q.set(
        "s",
        KATEGORIJE.filter((k) => !s.skrivene.has(k.id))
          .map((k) => k.kod)
          .join("."),
      );
    if (s.prepreka) q.set("p", s.prepreka);
    if (s.tocka) q.set("t", `${s.tocka[0].toFixed(6)},${s.tocka[1].toFixed(6)}`);
  }
  const t = q.toString().replaceAll("%2F", "/").replaceAll("%2C", ",");
  return `${window.location.pathname}${t ? `?${t}` : ""}${window.location.hash}`;
}
