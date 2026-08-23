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

import { azoAdresa, type Postaja } from "@/lib/vjetar";
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
import {
  adresaModela,
  procitajAzoNiz,
  procitajDubine,
  procitajModelskiVjetar,
  slozeniVjetar,
  vrhSata,
  type SatniVjetar,
} from "@/lib/sim/vrijeme-satno";

/** AZO-ove oznake postaja i veličina; iste kao u `vjetar.ts`. */
const AZO = { split3: 305, split2: 304, brzina: 477, smjer: 478 } as const;

/** METAR i AZO se objavljuju u satu; kraći rok ne bi donio noviji podatak. */
const ROK_VJETRA = 900;

/** Tablice Zavoda stižu sa satnim korakom, ali s kašnjenjem od nekoliko sati. */
const ROK_POSTAJA = 1800;

/** Poziv koji ne smije držati prikaz stranice. */
const ISTEK_MS = 6000;

/**
 * Razmak između uzastopnih poziva prema AZO-u, u milisekundama.
 *
 * AZO-ov izvoz ima ogradu na brzinu, i to strogu: brzina i smjer traže se dvama
 * pozivima (jedan zahtjev nosi samo jedan polutant — `polutant=477,478` vrati
 * 404, a ponovljeni parametar tiho uzme samo prvi), a drugi poziv vrati
 * `429 Too many requests` sve dok između njih ne prođe oko pet sekundi.
 * Izmjereno 21. 8. 2026.: razmak 0 i 2 s → 429, 5 s → 200.
 *
 * Posljedica prebrzog dohvata nije bila prazna karta nego gora stvar: smjer bi
 * izostao, svaki bi sat pao na modelski vjetar, i crta bi izgledala uredno dok
 * bi tiho prestala biti izmjerena.
 *
 * Zato AZO ne stoji na putu prikaza. Stranica se crta na modelskom vjetru, koji
 * pokriva sve satove odjednom, a izmjereni stiže naknadno s
 * `/api/karepovac/sim/vjetar` — ondje ovih nekoliko sekundi plati predmemorija
 * jednom u petnaest minuta, a ne svaki posjetitelj.
 */
const RAZMAK_AZO_MS = 5500;

// Bez dijakritike: zaglavlje HTTP-a nosi samo znakove do 255.
const ZAGLAVLJA = {
  "user-agent": "kvart (Karepovac air watch; +https://kvart-sage.vercel.app)",
} as const;

function pricekaj(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
 * Čita izmjereni satni vjetar s AZO-ovih postaja, redom i bez navale.
 *
 * Args:
 *   sada: Trenutak za koji se traži dan unatrag.
 *
 * Returns:
 *   Vjetar po satu s prve postaje koja je javila i brzinu i smjer; prazno ako
 *   nijedna nije.
 */
export async function azoSerije(
  sada: Date,
): Promise<Map<Postaja, Map<string, SatniVjetar>>> {
  const izlaz = new Map<Postaja, Map<string, SatniVjetar>>();
  // Obje postaje, a ne samo prva koja javi: prva vodi model, ali druga ima
  // svoje mjesto na karti i ondje pokazuje što je sama izmjerila.
  for (const postaja of ["split3", "split2"] as const) {
    const brzine = await uzmi(azoAdresa(postaja, AZO.brzina, sada), ROK_VJETRA);
    await pricekaj(RAZMAK_AZO_MS);
    const smjerovi = await uzmi(azoAdresa(postaja, AZO.smjer, sada), ROK_VJETRA);
    const niz = procitajAzoNiz(postaja, brzine, smjerovi);
    if (niz.size) izlaz.set(postaja, niz);
    await pricekaj(RAZMAK_AZO_MS);
  }
  return izlaz;
}

/**
 * Vjetar koji vodi model: prva postaja koja je javila i brzinu i smjer.
 *
 * Args:
 *   sada: Trenutak za koji se traži dan unatrag.
 *
 * Returns:
 *   Vjetar po satu s te postaje; prazno ako nijedna nije javila.
 */
export async function azoVjetar(sada: Date): Promise<Map<string, SatniVjetar>> {
  const serije = await azoSerije(sada);
  // Redoslijed je isti kao u `vjetar.ts`: nije po udaljenosti nego po tome što
  // je prošlo provjeru prema izmjerenom H₂S-u.
  for (const postaja of ["split3", "split2"] as const) {
    const niz = serije.get(postaja);
    if (niz?.size) return niz;
  }
  return new Map();
}

/**
 * Dohvaća sve izvore i slaže vremensku crtu.
 *
 * Izmjereni vjetar ovdje **ne** ulazi: AZO traži pet sekundi između dvaju
 * poziva, što je predugo da stoji pred prvim prikazom. Crta se slaže na
 * modelskom vjetru, koji pokriva sve satove, a izmjereni se dodaje naknadno
 * (`primijeniVjetar`) čim ga `/api/karepovac/sim/vjetar` isporuči.
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

  const [model, ...tablice] = await Promise.all([
    // Dva dana unatrag pokrivaju i zalet, dva unaprijed s viškom pokrivaju tri sata.
    uzmi(adresaModela(2, 2), ROK_VJETRA),
    ...stranice.map((s) => uzmi(s.url, ROK_POSTAJA, "tekst")),
  ]);

  const poPostaji = new Map<string, string[]>();
  stranice.forEach((s, i) => {
    const tekst = tablice[i];
    if (typeof tekst !== "string") return;
    poPostaji.set(s.postaja, [...(poPostaji.get(s.postaja) ?? []), tekst]);
  });

  const satovi: string[] = [];
  for (
    let t = najstariji.getTime();
    t <= najnoviji.getTime();
    t += 3600000
  ) {
    satovi.push(new Date(t).toISOString());
  }

  const vjetrovi: Map<string, SatniVjetar> = slozeniVjetar(satovi, [
    procitajModelskiVjetar(model),
  ]);

  return slozCrtu(vrh, vjetrovi, procitajDubine(model), slozOcitanja(poPostaji));
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
