/**
 * Imena navoda i poveznica na njih — bez datoteka, za poslužitelj i preglednik.
 *
 * Navod je jedno mjesto u GUP-u na koje se stranica poziva: rečenica odredbi
 * ili dio kartografskog prikaza. Poveznica na navod vodi na /gup/navod/<id>
 * (ulomak kao stranica, radi i bez JavaScripta), a klik na nju otvara skočni
 * prozor s istim ulomkom (ProzorNavoda, u korijenskom layoutu).
 *
 * Imena navoda iz izvadaka odredbi slažu se iz godine i koda, pa ih karta
 * može složiti sama, bez popisa: ppmin-2015-1_4, gradnja-2025-3_2, namjena-2015-M_K5.
 */

/** Kod u imenu navoda: samo slova, brojke i podvlaka („M/K5” → „M_K5”, „1.4” → „1_4”). */
export const kodUImenu = (kod: string) => kod.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Najmanja građevna čestica urbanog pravila (izvadak ppmin-<godina>.json). */
export const navodPpmin = (godina: number | string, kodPravila: string) => `ppmin-${godina}-${kodUImenu(kodPravila)}`;

/** Nova stambena gradnja u urbanom pravilu (izvadak gradnja-<godina>.json). */
export const navodGradnja = (godina: number | string, kodPravila: string) => `gradnja-${godina}-${kodUImenu(kodPravila)}`;

/** Što odredbe dopuštaju u namjeni (izvadak dopusteno.json). */
export const navodNamjena = (godina: number | string, klasa: string) => `namjena-${godina}-${kodUImenu(klasa)}`;

/** Kartografski prikaz namjene i urbanih pravila po godini plana. */
export const LIST_NAMJENE: Record<number, string> = { 2006: "namjena-2008", 2015: "namjena-2014", 2025: "namjena-2025" };
export const LIST_URBANIH_PRAVILA: Record<number, string> = {
  2006: "urbana-pravila-2012",
  2015: "urbana-pravila-2014",
  2025: "urbana-pravila-2025",
};

export const putNavoda = (id: string) => `/gup/navod/${id}`;

/**
 * Navod mjesta na listu, složen na licu mjesta (skočni prozor čestice):
 * `list:<list>:<x>,<y>` — točka kao udio lista. Nije u popisu navoda;
 * ProzorNavoda ga sam razriješi iz podataka o listu (/api/gup/listovi).
 */
export const PREDMETAK_TOCKE = "list:";
export function navodTocke(list: string, [x, y]: [number, number]): string {
  return `${PREDMETAK_TOCKE}${list}:${x.toFixed(5)},${y.toFixed(5)}`;
}
export function procitajNavodTocke(id: string): { list: string; tocka: [number, number] } | null {
  const m = /^list:([a-z0-9-]+):(-?[\d.]+),(-?[\d.]+)$/.exec(id);
  return m ? { list: m[1], tocka: [Number(m[2]), Number(m[3])] } : null;
}

/** Točka na listu za zemljopisni položaj, po uklapanju lista; null ako list nema uklapanje ili je točka izvan. */
export function tockaNaListu(
  uklapanje: [number, number, number, number, number, number] | undefined,
  [e, n]: [number, number],
): [number, number] | null {
  if (!uklapanje) return null;
  const [a, b, c, d, f, g] = uklapanje;
  const x = a * e + b * n + c;
  const y = d * e + f * n + g;
  return x > 0 && x < 1 && y > 0 && y < 1 ? [x, y] : null;
}

/** Okvir oko točke na listu, `polumjer` metara na svaku stranu. */
export function okvirOkoTocke(
  uklapanje: [number, number, number, number, number, number],
  [x, y]: [number, number],
  polumjer = 350,
): [number, number, number, number] {
  const [a, b, , d, f] = uklapanje;
  const dx = Math.hypot(a, b) * polumjer;
  const dy = Math.hypot(d, f) * polumjer;
  return [Math.max(0, x - dx), Math.max(0, y - dy), Math.min(1, x + dx), Math.min(1, y + dy)];
}

/**
 * Istaknuto u cijelom tekstu, u adresi stranice dokumenta:
 * `?oznaci=s37-5:10-80.120-160,s37-6:0-44` — sidro bloka i rasponi znakova
 * u njegovu tekstu. Adresa tako sama nosi što treba istaknuti, bez upita.
 */
export function kodirajOznake(oznake: [string, [number, number][]][]): string {
  return oznake.map(([sidro, r]) => `${sidro}:${r.map(([a, b]) => `${a}-${b}`).join(".")}`).join(",");
}

export function dekodirajOznake(s: string): [string, [number, number][]][] {
  const out: [string, [number, number][]][] = [];
  for (const dio of s.split(",")) {
    const i = dio.lastIndexOf(":");
    if (i <= 0) continue;
    const rasponi = dio
      .slice(i + 1)
      .split(".")
      .map((r) => r.split("-").map(Number) as [number, number])
      .filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b) && b > a);
    out.push([dio.slice(0, i), rasponi]);
  }
  return out;
}

/** Oznaka poveznice na navod; ista za JSX (Navod) i HTML nizove (skočni prozori karte). */
export const KLASA_NAVODA = "navod fokus";

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Poveznica na navod kao HTML niz — za Leafletove skočne prozore. `tekst` se
 * escapea. `href` je kamo vodi bez JavaScripta (zadano: stranica navoda).
 */
export function navodHtml(id: string, tekst: string, href = putNavoda(id)): string {
  return `<a href="${esc(href)}" data-gup-navod="${esc(id)}" class="${KLASA_NAVODA}">${esc(tekst)}</a>`;
}
