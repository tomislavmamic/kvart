/**
 * Jedno mjesto istine za satni vjetar — za sve modele na stranici.
 *
 * Vjetar se dosad birao na četiri mjesta: kartica uživo (`vjetar.ts`),
 * crta simulatora (`sim/dohvat.ts`), dopuna tekućeg sata u API-ju i zalet
 * kartice (`zrak.ts`). Svako je imalo svoje pravilo, pa su se dvije karte
 * istoga kvarta znale razići — i razišle su se. Odsad pravilo stoji ovdje,
 * a svi ga ostali samo zovu.
 *
 * **Pravilo, po satu:**
 *
 * 1. **Izmjereni AZO niz** (Split-3, pa Split-2) — gdje god sat pokriva.
 * 2. **Opažanje koje vodi kartu** (`dohvatiZrak`: AZO, DHMZ, METAR…) — samo
 *    za tekući sat, dok ga AZO još nije objavio.
 * 3. **Model** (Open-Meteo) — svi ostali sati, i jedini izvor za prognozu.
 *
 * Dubina miješanog sloja uvijek je modelska: u blizini se ne mjeri.
 *
 * Podjela rada s ostalim modulima: `vjetar.ts` zna što izvori javljaju
 * **sada**, `sim/vrijeme-satno.ts` zna čitati njihove satne zapise, a ovaj
 * modul bira. HTTP oblik za preglednik daje `/api/karepovac/vjetar`, uvijek
 * kroz `satniVjetar` — stalan JSON, pa ga jednog dana mogu čitati i skripte
 * izvan stranice.
 *
 * AZO ima ogradu na brzinu (dva poziva u ~5 s), pa dohvat izmjerenog niza
 * može trajati sekundama kad predmemorija nije topla. Tko ne smije čekati
 * (prikaz stranice), zada `rokIzmjerenogMs` — istekom roka prolaz ide bez
 * izmjerenog niza, a pozivi u pozadini griju predmemoriju za sljedeći.
 */

import { azoAdresa, dohvatiZrak, type Postaja, type ZrakSada } from "@/lib/vjetar";
import {
  adresaModela,
  procitajAzoNiz,
  procitajDubine,
  procitajModelskiVjetar,
  vrhSata,
  type SatniVjetar,
} from "@/lib/sim/vrijeme-satno";

/** AZO-ove oznake postaja i veličina; iste kao u `vjetar.ts`. */
const AZO = { split3: 305, split2: 304, brzina: 477, smjer: 478 } as const;

/** METAR i AZO se objavljuju u satu; kraći rok ne bi donio noviji podatak. */
const ROK_VJETRA = 900;

/** Poziv koji ne smije držati prikaz stranice. */
const ISTEK_MS = 6000;

/**
 * Razmak između uzastopnih poziva prema AZO-u, u milisekundama.
 *
 * AZO-ov izvoz ima ogradu na brzinu, i to strogu: brzina i smjer traže se
 * dvama pozivima (jedan zahtjev nosi samo jedan polutant), a drugi poziv
 * vrati `429 Too many requests` dok između njih ne prođe oko pet sekundi.
 * Izmjereno 21. 8. 2026.: razmak 0 i 2 s → 429, 5 s → 200.
 */
const RAZMAK_AZO_MS = 5500;

// Bez dijakritike: zaglavlje HTTP-a nosi samo znakove do 255.
const ZAGLAVLJA = {
  "user-agent": "kvart (Karepovac air watch; +https://kvart-sage.vercel.app)",
} as const;

function pricekaj(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function uzmi(url: string, rok: number): Promise<unknown | null> {
  try {
    const odgovor = await fetch(url, {
      headers: ZAGLAVLJA,
      signal: AbortSignal.timeout(ISTEK_MS),
      next: { revalidate: rok },
    });
    if (!odgovor.ok) return null;
    return await odgovor.json();
  } catch {
    // Izvor koji ne odgovori ne smije srušiti stranicu.
    return null;
  }
}

/**
 * Poziv prema AZO-u koji ogradu na brzinu plaća samo kad je udari.
 *
 * Stara je izvedba spavala 5,5 s između svih poziva, bezuvjetno — pa je
 * dohvat izmjerenog niza trajao šesnaest sekundi i kad su svi odgovori već
 * bili u predmemoriji. Tko je na niz čekao s rokom (zalet kartice, 3 s),
 * nikad ga nije dočekao i tiho je padao na model — i dvije su se karte
 * opet razilazile, ovaj put kroz povijest. Sad se prvo pokuša odmah:
 * pogodak iz predmemorije ne košta ništa, a tek odbijeni poziv čeka
 * ogradu pa pokušava još jednom.
 */
async function uzmiUzOgradu(url: string): Promise<unknown | null> {
  const prvi = await uzmi(url, ROK_VJETRA);
  if (prvi !== null) return prvi;
  await pricekaj(RAZMAK_AZO_MS);
  return uzmi(url, ROK_VJETRA);
}

/**
 * Čita izmjereni satni vjetar s AZO-ovih postaja, redom i bez navale.
 *
 * Args:
 *   sada: Trenutak za koji se traži dan unatrag.
 *
 * Returns:
 *   Vjetar po satu, po postaji; prazno za postaju koja nije javila oboje.
 */
export async function azoSerije(
  sada: Date,
): Promise<Map<Postaja, Map<string, SatniVjetar>>> {
  const izlaz = new Map<Postaja, Map<string, SatniVjetar>>();
  // Obje postaje, a ne samo prva koja javi: prva vodi model, ali druga ima
  // svoje mjesto na karti i ondje pokazuje što je sama izmjerila.
  for (const postaja of ["split3", "split2"] as const) {
    const brzine = await uzmiUzOgradu(azoAdresa(postaja, AZO.brzina, sada));
    const smjerovi = await uzmiUzOgradu(azoAdresa(postaja, AZO.smjer, sada));
    const niz = procitajAzoNiz(postaja, brzine, smjerovi);
    if (niz.size) izlaz.set(postaja, niz);
  }
  return izlaz;
}

/**
 * Izmjereni niz koji vodi model: prva postaja koja je javila oboje.
 */
export async function azoVjetar(sada: Date): Promise<Map<string, SatniVjetar>> {
  const serije = await azoSerije(sada);
  // Redoslijed je isti kao u `vjetar.ts`: nije po udaljenosti nego po tome
  // što je prošlo provjeru prema izmjerenom H₂S-u.
  for (const postaja of ["split3", "split2"] as const) {
    const niz = serije.get(postaja);
    if (niz?.size) return niz;
  }
  return new Map();
}

/**
 * Dopunjava izmjereni niz opažanjem za tekući sat, kad ga niz ne pokriva.
 *
 * AZO često javi zadnji sat s kašnjenjem, a karta na `/karepovac` tada vodi
 * po najsvježijem opažanju (DHMZ, METAR…). Bez ove dopune bi simulator isti
 * sat vrtio na modelu, pa bi dvije karte istoga kvarta nosile dva vjetra —
 * i to baš na satu koji svi gledaju.
 *
 * Args:
 *   satovi: Izmjereni satni niz koji vodi model.
 *   vrh: Početak tekućeg sata.
 *   opazanje: Opažanje koje trenutačno vodi kartu, ili ništa.
 *
 * Returns:
 *   Niz s dopunjenim tekućim satom; ulaz se ne mijenja.
 */
export function dopuniSadasnjim(
  satovi: ReadonlyMap<string, SatniVjetar>,
  vrh: Date,
  opazanje: {
    postaja: Postaja;
    smjerOd: number;
    brzina: number;
    promjenjiv?: boolean;
  } | null,
): Map<string, SatniVjetar> {
  const izlaz = new Map(satovi);
  const sat = vrh.toISOString();
  // Promjenjiv smjer (METAR VRB) nije smjer: upisati ga značilo bi voditi
  // perjanicu brojkom koja ništa ne znači. Sat tada ostaje na modelu, a
  // natpis uz kartu i dalje smije reći „promjenjiv”.
  if (!opazanje || opazanje.promjenjiv || izlaz.has(sat)) return izlaz;
  izlaz.set(sat, {
    sat,
    smjerOd: opazanje.smjerOd,
    brzina: opazanje.brzina,
    tisina: opazanje.brzina < 0.5,
    izvor: opazanje.postaja,
  });
  return izlaz;
}

export type SatniVjetarISlojevi = {
  /** Vjetar po satu, već izabran po pravilu ovog modula. */
  readonly vjetrovi: Map<string, SatniVjetar>;
  /** Dubina miješanog sloja po satu, uvijek modelska. */
  readonly dubine: Map<string, number>;
  /** Nizovi po postaji, za pribadače; prazno kad se izmjereno nije čekalo. */
  readonly serije: Map<Postaja, Map<string, SatniVjetar>>;
  /** Trenutačna očitanja i stanje koje vodi kartu; ništa ako dohvat padne. */
  readonly sada: ZrakSada | null;
};

/**
 * Satni vjetar i dubina sloja za zadani raspon, po pravilu ovog modula.
 *
 * Args:
 *   sada: Trenutak prikaza.
 *   unatragDana: Koliko dana unatrag model mora pokriti.
 *   unaprijedDana: Koliko dana unaprijed (prognoza).
 *   rokIzmjerenogMs: Rok čekanja na izmjereni AZO niz; bez roka se čeka do
 *     kraja, nula ga preskače, a istek roka znači prolaz bez izmjerenoga.
 *
 * Returns:
 *   Vjetar i dubine po satu, nizovi postaja i trenutačna očitanja.
 */
export async function satniVjetar(
  sada: Date = new Date(),
  unatragDana: number = 2,
  unaprijedDana: number = 2,
  rokIzmjerenogMs?: number,
): Promise<SatniVjetarISlojevi> {
  const [model, zrak, serije] = await Promise.all([
    uzmi(adresaModela(unatragDana, unaprijedDana), ROK_VJETRA),
    dohvatiZrak(sada).catch(() => null),
    rokIzmjerenogMs === 0
      ? Promise.resolve(new Map<Postaja, Map<string, SatniVjetar>>())
      : rokIzmjerenogMs === undefined
        ? azoSerije(sada).catch(() => new Map<Postaja, Map<string, SatniVjetar>>())
        : Promise.race([
            azoSerije(sada).catch(
              () => new Map<Postaja, Map<string, SatniVjetar>>(),
            ),
            pricekaj(rokIzmjerenogMs).then(
              () => new Map<Postaja, Map<string, SatniVjetar>>(),
            ),
          ]),
  ]);

  let izmjereno = new Map<string, SatniVjetar>();
  for (const postaja of ["split3", "split2"] as const) {
    const niz = serije.get(postaja);
    if (niz?.size) {
      izmjereno = niz;
      break;
    }
  }
  izmjereno = dopuniSadasnjim(izmjereno, vrhSata(sada), zrak?.vjetar ?? null);

  const vjetrovi = new Map(procitajModelskiVjetar(model));
  for (const [sat, v] of izmjereno) vjetrovi.set(sat, v);

  return { vjetrovi, dubine: procitajDubine(model), serije, sada: zrak };
}
