/**
 * Nasumična oznaka dojavitelja — bez imena, bez kontakta, bez praćenja.
 *
 * Ruži dojava treba znati je li dvadeset dojava došlo od dvadeset ljudi ili
 * od jednoga upornog. Bez toga se ne razlikuje „smrdi svaku noć” od „jedan
 * čovjek javlja svaku noć”, a to su dva posve različita nalaza.
 *
 * Zato preglednik pamti nasumičan niz znakova. Što on **nije**: nije ime,
 * nije kontakt, ne putuje između uređaja, ne ide nijednoj trećoj strani i
 * ne govori tko je dojavitelj — govori samo da su dvije dojave došle iz
 * istog preglednika. Tko ga želi maknuti, `zaboraviDojavitelja` ga briše i
 * sljedeća dojava kreće kao nova osoba.
 *
 * Stoji u `localStorage`, ne u kolačiću: kolačić bi putovao uz svaki
 * zahtjev prema poslužitelju, a ovo treba samo obrascu i samo pri slanju.
 */

const KLJUC = "kvart:dojavitelj";

/** Oblik oznake: dovoljno dug da se dva preglednika ne sudare. */
const DULJINA = 16;

function nasumicna(): string {
  const bajtovi = new Uint8Array(DULJINA);
  crypto.getRandomValues(bajtovi);
  return Array.from(bajtovi, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Vraća oznaku ovog preglednika, stvarajući je pri prvoj dojavi.
 *
 * Kad `localStorage` nije dostupan — privatni prozor, isključeni kolačići,
 * ugrađeni preglednik — dojava se šalje bez oznake. To je slabija dojava
 * (ne može se sažeti), ali svakako bolja od odbijene.
 *
 * @returns Oznaku, ili `null` ako je preglednik ne dopušta zapamtiti.
 */
export function oznakaDojavitelja(): string | null {
  try {
    const dosad = localStorage.getItem(KLJUC);
    if (dosad) return dosad;
    const nova = nasumicna();
    localStorage.setItem(KLJUC, nova);
    return nova;
  } catch {
    return null;
  }
}

/** Briše oznaku; sljedeća dojava kreće kao nova osoba. */
export function zaboraviDojavitelja(): void {
  try {
    localStorage.removeItem(KLJUC);
  } catch {
    // Nema je gdje ni obrisati; ionako je nije bilo.
  }
}
