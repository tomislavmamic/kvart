/**
 * Račun XYZ pločica za vlastito posluživanje podloge.
 *
 * Zašto uopće postoji: DGU-ov geoportal je izmjereno spor pod usporednim
 * opterećenjem — pojedinačna pločica stigne za 0,4 s, ali osam njih odjednom
 * troši oko 4 s. To plaća SVAKI posjetitelj, pri svakom pomaku karte, a
 * „sporija veza je normalna” je zapisana obveza (vidi PRODUCT.md).
 *
 * Kvart je 3 × 2 km i svi gledaju isto. Pločica dohvaćena jednom vrijedi za
 * sve ostale, pa se DGU pita jednom, a dalje odgovara predmemorija ruba
 * mreže. Isti postupak kojim se već poslužuje sjenčani reljef, samo što se
 * ovdje pločice ne izrađuju unaprijed nego se pamte pri prvom traženju.
 *
 * Ovdje je samo račun — bez `fetch`, bez Next-a — da se granice i pretvorbe
 * mogu ispitati bez mreže (vidi tests/plocice.test.ts).
 */
import { BASE_LAYERS, MAP_MAX_BOUNDS, type BaseLayer } from "./map-views";

/** Polumjer Zemlje u Web Mercatoru (EPSG:3857). */
const R = 6_378_137;

/** Pola opsega — rub svijeta u metrima, i po x i po y. */
const RUB = Math.PI * R;

/**
 * Koliko piksela ima stranica poslužene pločice.
 *
 * 512, a ne 256: pločica od 512 px pokriva istu površinu kao četiri od 256
 * i traži jednako mnogo metara po pikselu, dakle ista razlučivost uz
 * četvrtinu zahtjeva. Mjereno na geoportalu: jedna od 512 px = 0,86–1,3 s,
 * četiri od 256 px = 3,85 s. Uz predmemoriju to znači i četiri puta manje
 * upisa, i četiri puta manje pitanja DGU-u dok je predmemorija hladna.
 *
 * Klijent to prati s `tileSize: 512` i `zoomOffset: -1`, pa je (z, x, y) u
 * adresi i dalje obična XYZ pločica standardne mreže.
 */
export const PLOCICA_PX = 512;

/**
 * Najmanji i najveći zum koji se poslužuje.
 *
 * Karta radi na z12–19, a `zoomOffset: -1` znači da u adresu dolazi zum
 * manji za jedan — dakle 11–18. Izvan toga se ne poslužuje: raspon je ovdje
 * i ograda protiv toga da se ruta upotrijebi kao općeniti posrednik prema
 * geoportalu.
 */
export const ZUM_OD = 11;
export const ZUM_DO = 18;

export interface Okvir {
  zapad: number;
  jug: number;
  istok: number;
  sjever: number;
}

/**
 * Granice pločice u Web Mercatoru.
 *
 * Args:
 *   z: Zum standardne XYZ mreže.
 *   x: Stupac.
 *   y: Redak, 0 = najsjeverniji.
 *
 * Returns:
 *   Granice u metrima (EPSG:3857).
 */
export function okvir3857(z: number, x: number, y: number): Okvir {
  const raspon = (2 * RUB) / 2 ** z;
  const zapad = -RUB + x * raspon;
  const sjever = RUB - y * raspon;
  return { zapad, jug: sjever - raspon, istok: zapad + raspon, sjever };
}

/** Mercatorov y u zemljopisnu širinu. */
function uSirinu(y: number): number {
  return (180 / Math.PI) * (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2);
}

/**
 * Granice iste pločice u stupnjevima.
 *
 * Pločica je kvadrat u Mercatoru, a u stupnjevima trapez — sjeverni i južni
 * rub nisu jednako široki. Poslužitelj je svejedno crta kao pravokutnik, pa
 * slika ima sitno izobličenje. To NIJE regresija: Leaflet je i dosad za
 * INSPIRE servis tražio upravo tako (mercatorska pločica opisana u 4326), a
 * na veličini jedne pločice je razlika ispod piksela.
 */
export function okvir4326(z: number, x: number, y: number): Okvir {
  const m = okvir3857(z, x, y);
  return {
    zapad: (m.zapad / RUB) * 180,
    istok: (m.istok / RUB) * 180,
    jug: uSirinu(m.jug),
    sjever: uSirinu(m.sjever),
  };
}

/** Postoji li pločica s tim koordinatama na tom zumu. */
export function uMrezi(z: number, x: number, y: number): boolean {
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y))
    return false;
  if (z < ZUM_OD || z > ZUM_DO) return false;
  const n = 2 ** z;
  return x >= 0 && x < n && y >= 0 && y < n;
}

/**
 * Dodiruje li pločica obuhvat karte.
 *
 * Ovo je ograda, ne optimizacija: bez nje bi ruta posluživala DGU-ove
 * podloge za bilo koju točku na svijetu, dakle bila bi otvoreni posrednik
 * prema tuđem servisu, na naš račun i pod našim imenom.
 */
export function uObuhvatu(z: number, x: number, y: number): boolean {
  const o = okvir4326(z, x, y);
  const [[jug, zapad], [sjever, istok]] = MAP_MAX_BOUNDS;
  return !(o.istok < zapad || o.zapad > istok || o.sjever < jug || o.jug > sjever);
}

/** Podloge koje se poslužuju preko nas — sve WMS, i nijedna druga. */
export function podlogaZaPosluzivanje(id: string): BaseLayer | null {
  const b = BASE_LAYERS.find((x) => x.id === id);
  return b && b.type === "wms" ? b : null;
}

/**
 * Adresa GetMap zahtjeva prema izvornom servisu.
 *
 * WMS 1.1.1 namjerno: ondje je parametar `srs`, a granice idu u redoslijedu
 * x,y (dakle dužina pa širina) i za 4326. U 1.3.0 se za EPSG:4326 redoslijed
 * osi obrće u širina,dužina, što je klasičan izvor tiho krivo postavljenih
 * pločica.
 *
 * Args:
 *   base: Podloga iz registra.
 *   z, x, y: Standardna XYZ pločica.
 *
 * Returns:
 *   Puna adresa za dohvat slike od DGU-a.
 */
export function adresaIzvora(
  base: BaseLayer,
  z: number,
  x: number,
  y: number,
): string {
  const cetiriTriDvaSest = base.wmsCrs === "EPSG:4326";
  const o = cetiriTriDvaSest ? okvir4326(z, x, y) : okvir3857(z, x, y);
  const q = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: base.wmsLayers ?? "",
    styles: "",
    srs: cetiriTriDvaSest ? "EPSG:4326" : "EPSG:3857",
    bbox: `${o.zapad},${o.jug},${o.istok},${o.sjever}`,
    width: String(PLOCICA_PX),
    height: String(PLOCICA_PX),
    format: "image/jpeg",
  });
  return `${base.url}?${q}`;
}

/**
 * Koliko dugo pločica smije stajati u predmemoriji.
 *
 * Godina dana, i to bez griže savjesti: snimka iz 2011. i snimka iz 2023. su
 * gotovi, datirani proizvodi — DOF 2023 se neće promijeniti u DOF 2023.
 * Pojavi li se nova godina, ona dolazi kao NOVA podloga s vlastitim id-em,
 * dakle i vlastitom adresom, pa staru ne treba obeskrijepiti.
 */
export const PREDMEMORIJA_S = 31_536_000;

/**
 * Zaglavlje predmemorije za uspješno posluženu pločicu.
 *
 * `s-maxage` drži rub mreže, `max-age` preglednik. `immutable` govori
 * pregledniku da ne pita ponovno ni pri osvježavanju stranice.
 */
export function zaglavljaPlocice(): Record<string, string> {
  return {
    "Content-Type": "image/jpeg",
    "Cache-Control": `public, max-age=${PREDMEMORIJA_S}, s-maxage=${PREDMEMORIJA_S}, immutable`,
  };
}

/**
 * Zaglavlje za neuspjeh.
 *
 * Kratko, i to je bitno: kad geoportal padne na minutu, ne smijemo tu minutu
 * zapamtiti na godinu dana i time sami sebi trajno razbiti podlogu.
 */
export function zaglavljaGreske(): Record<string, string> {
  return { "Cache-Control": "public, max-age=0, s-maxage=30" };
}
