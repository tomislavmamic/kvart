/**
 * Dohvat cijele vremenske crte simulatora, iz javnih izvora.
 *
 * Sve što crta treba stiže s četiriju mjesta i nijedno od njih nije dovoljno
 * samo:
 *
 * - **AZO** (`iszz.azo.hr`) — izmjeren satni vjetar s gradskih postaja. Isti
 *   izvoz koji `vjetar.ts` već traži vraća cijeli dan, pa se ovdje čita kao niz.
 * - **Open-Meteo** — modelski vjetar i dubina miješanog sloja, unatrag i
 *   unaprijed. Za prognozirane satove jedini izvor; za prošle zamjena kad
 *   mjerenje fali. Dubina sloja je uvijek odavde jer se u blizini ne mjeri.
 * - **Zavod za javno zdravstvo SDŽ** — satne tablice s obiju postaja uz plohu.
 *
 * Dohvat ne visi o posjetitelju nego o vremenu: odgovori se drže u
 * predmemoriji podataka, zajedničkoj za sve, pa broj poziva prema izvoru ovisi
 * o roku, ne o prometu. Izvor koji padne ne ruši stranicu — sat ostaje bez
 * vjetra i na crti se vidi kao rupa, a ne kao izmišljen zrak.
 */

import {
  type Kadar,
  type Crta,
  type OcitanjePostaje,
  SATI_UNAPRIJED,
  SATI_UNATRAG,
  SATI_ZALETA,
  slozCrtu,
} from "@/lib/sim/kadrovi";
import {
  adresaTablice,
  mjeseci,
  procitajTablicu,
  SIM_POSTAJE,
} from "@/lib/sim/postaje-satno";
import { vrhSata, type SatniVjetar } from "@/lib/sim/vrijeme-satno";
import { satniVjetar } from "@/lib/vjetar-sat";

/** METAR i AZO se objavljuju u satu; kraći rok ne bi donio noviji podatak. */
const ROK_VJETRA = 900;

/** Tablice Zavoda stižu sa satnim korakom, ali s kašnjenjem od nekoliko sati. */
const ROK_POSTAJA = 1800;

/** Poziv koji ne smije držati prikaz stranice. */
const ISTEK_MS = 6000;

// Bez dijakritike: zaglavlje HTTP-a nosi samo znakove do 255.
const ZAGLAVLJA = {
  "user-agent": "kvart (Karepovac air watch; +https://kvart-sage.vercel.app)",
} as const;

async function uzmi(
  url: string,
  rok: number,
  oblik: "json" | "tekst" = "json",
): Promise<unknown | null> {
  try {
    const odgovor = await fetch(url, {
      headers: ZAGLAVLJA,
      signal: AbortSignal.timeout(ISTEK_MS),
      next: { revalidate: rok },
    });
    if (!odgovor.ok) return null;
    return oblik === "json" ? await odgovor.json() : await odgovor.text();
  } catch {
    // Izvor koji ne odgovori ne smije srušiti stranicu; sat bez njega ostaje
    // rupa na crti, i tako se i vidi.
    return null;
  }
}

/**
 * Slaže mjerenja s obiju postaja u niz po satu.
 *
 * Args:
 *   tablice: Sadržaj mjesečnih tablica, po postaji.
 *
 * Returns:
 *   Očitanja po satu; sat u kojem nijedan uređaj nije radio ipak dobiva
 *   zapis s `null`, da se na karti vidi da je postaja ondje i da šuti.
 */
export function slozOcitanja(
  tablice: ReadonlyMap<string, readonly string[]>,
): Map<string, readonly OcitanjePostaje[]> {
  const poSatu = new Map<string, OcitanjePostaje[]>();
  for (const postaja of SIM_POSTAJE) {
    const stranice = tablice.get(postaja.oznaka) ?? [];
    for (const stranica of stranice) {
      for (const o of procitajTablicu(stranica, postaja.stupac)) {
        const zapis: OcitanjePostaje = {
          postaja: postaja.oznaka,
          tvar: postaja.tvar,
          vrijednost: o.vrijednost,
          jedinica: postaja.jedinica,
          ispodGranice: o.ispodGranice,
        };
        const dosad = poSatu.get(o.sat) ?? [];
        poSatu.set(o.sat, [...dosad.filter((x) => x.postaja !== postaja.oznaka), zapis]);
      }
    }
  }
  return poSatu;
}

/**
 * Dohvaća sve izvore i slaže vremensku crtu.
 *
 * Vjetar bira `satniVjetar` — isto pravilo kao svugdje — ali bez čekanja
 * na izmjereni AZO niz: on traži sekunde, predugo za prvi prikaz, pa stiže
 * naknadno (`primijeniVjetar`) čim ga `/api/karepovac/vjetar` isporuči.
 * Opažanje za tekući sat ulazi odmah, jer ne košta ništa.
 *
 * Args:
 *   sada: Trenutak za koji se crta slaže; zadano je sadašnji.
 *
 * Returns:
 *   Crta s kadrovima zaleta i kadrovima prikaza.
 */
export async function dohvatiCrtu(sada: Date = new Date()): Promise<Crta> {
  const vrh = vrhSata(sada);
  const najstariji = new Date(vrh.getTime() - (SATI_UNATRAG + SATI_ZALETA) * 3600000);
  const najnoviji = new Date(vrh.getTime() + SATI_UNAPRIJED * 3600000);

  const trazeniMjeseci = mjeseci(najstariji, vrh);
  const stranice = SIM_POSTAJE.flatMap((p) =>
    trazeniMjeseci.map((m) => ({ postaja: p.oznaka, url: adresaTablice(p.oznaka, m) })),
  );

  const [vjetar, ...tablice] = await Promise.all([
    // Dva dana unatrag pokrivaju i zalet, dva unaprijed s viškom pokrivaju tri sata.
    satniVjetar(sada, 2, 2, 0),
    ...stranice.map((s) => uzmi(s.url, ROK_POSTAJA, "tekst")),
  ]);

  const poPostaji = new Map<string, string[]>();
  stranice.forEach((s, i) => {
    const tekst = tablice[i];
    if (typeof tekst !== "string") return;
    poPostaji.set(s.postaja, [...(poPostaji.get(s.postaja) ?? []), tekst]);
  });

  return slozCrtu(vrh, vjetar.vjetrovi, vjetar.dubine, slozOcitanja(poPostaji));
}

/**
 * Ugrađuje izmjereni vjetar u već složenu crtu.
 *
 * Prognozirani satovi ostaju netaknuti: mjerenja budućnosti nema, pa bi zapis s
 * postaje ondje mogao doći samo iz krivo poravnatog sata.
 *
 * Args:
 *   crta: Crta složena na modelskom vjetru.
 *   izmjereno: Vjetar po satu s AZO-ovih postaja.
 *
 * Returns:
 *   Crta u kojoj svaki sat koji mjerenje pokriva nosi izmjereni vjetar.
 */
export function primijeniVjetar(
  crta: Crta,
  izmjereno: ReadonlyMap<string, SatniVjetar>,
): Crta {
  const zamijeni = (k: Kadar): Kadar => {
    const v = izmjereno.get(k.sat);
    if (!v || k.vrsta === "prognoza" || !k.stanje) return k;
    return {
      ...k,
      vjetar: v,
      izvor: v.izvor,
      stanje: { ...k.stanje, smjerOd: v.smjerOd, brzina: v.brzina },
    };
  };
  return {
    ...crta,
    zalet: crta.zalet.map(zamijeni),
    kadrovi: crta.kadrovi.map(zamijeni),
  };
}

/** Kadrovi koje simulacija mora proći da dođe do zadanog: zalet pa crta do njega. */
export function doKadra(crta: Crta, pomak: number): Kadar[] {
  return [...crta.zalet, ...crta.kadrovi.filter((k) => k.pomak <= pomak)];
}
