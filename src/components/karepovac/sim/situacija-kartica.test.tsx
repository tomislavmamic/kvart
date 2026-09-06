import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SituacijaKartica } from "@/components/karepovac/sim/situacija-kartica";
import { slozKadar } from "@/lib/sim/kadrovi";
import { bojaZa, ZADANA_BOJA } from "@/lib/sim/ljestvica";
import type { Situacija } from "@/lib/sim/situacija";

/**
 * Kartica na telefonu: pri otvaranju skupljena (sat, izvor, naslov) da karta
 * drži 80 % zaslona; raširena na dodir. Ništa se ne skriva iza unutarnjeg
 * listanja, a rečenica o izvoru i starosti očitanja stoji odmah pod satom.
 */

const SAT = "2026-09-05T12:00:00.000Z";
const GLEDATELJ = new Date("2026-09-05T12:25:00.000Z");
const LJESTVICA = bojaZa(ZADANA_BOJA.sumporovodik, "sumporovodik").ljestvica;

function situacija(dio: Partial<Situacija> = {}): Situacija {
  return {
    sat: SAT,
    vrsta: "sada",
    razina: "nema",
    podrucja: [],
    nosi: { azimut: 200, opis: "prema jugozapadu" },
    trend: "stabilno",
    pouzdanost: "visoka",
    razlozi: ["Vjetar je izmjeren, sat nije prognoza."],
    promjena: null,
    izvorVjetra: "vrboran",
    ...dio,
  };
}

function nacrtaj(
  dio: { sazeta?: boolean; prosirena?: boolean; osvjezavanje?: "mirno" | "u tijeku" | "greska"; crtaSada?: string } = {},
) {
  const kadar = slozKadar(SAT, 0, { sat: SAT, smjerOd: 20, brzina: 0.7, tisina: false, izvor: "vrboran" }, 80);
  return renderToStaticMarkup(
    <SituacijaKartica
      situacija={situacija()}
      kadar={kadar}
      izracunat
      ljestvica={LJESTVICA}
      prijedlozi
      sadaStvarno={GLEDATELJ}
      crtaSada={dio.crtaSada ?? SAT}
      osvjezavanje={dio.osvjezavanje}
      sadaOcitanja={[
        { postaja: "vrboran", smjerOd: 20, brzina: 0.7, tisina: false, promjenjiv: false, opazeno: "2026-09-05T12:20:00.000Z" },
      ]}
      sazeta={dio.sazeta}
      pocetnoProsirena={dio.prosirena}
      naOsvjezi={() => {}}
      naVise={() => {}}
      plocaOtvorena={false}
    />,
  );
}

/** Tekst bez oznaka, s jednostrukim razmacima. */
function tekst(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

test("kartica se ne skraćuje unutarnjim listanjem", () => {
  const html = nacrtaj();
  const sekcija = html.match(/<section[^>]*>/)![0];
  assert.doesNotMatch(sekcija, /max-h-|overflow-y-auto/, "bez gornje granice i klizača");
});

test("pri otvaranju je na telefonu skupljena: sat, „sada”, izvor i naslov, pa strelica za više", () => {
  const html = nacrtaj();
  assert.match(tekst(html), /14:00 sada · izmjeren 14:20, Vrboran/, "jedan redak: kad, odakle");
  assert.match(html, /<button[^>]*aria-expanded="false"[^>]*aria-label="Više o ovom satu"/);
  // Skupljeni blok vidi se samo na telefonu; puna kartica na širokom zaslonu.
  assert.match(html, /class="px-3\.5 pb-1\.5 pt-1\.5 sm:hidden"/);
  assert.match(html, /class="hidden sm:contents"/);
  // Čitač zaslona dobiva istu rečenicu bez obzira na skupljenost.
  assert.match(html, /aria-live="polite"[^>]*>14:00, sub, 05\. 09\., sada: nema naznaka mirisa u naseljima, pouzdanost visoka</);
});

test("raširena: rečenica o izvoru i starosti stoji odmah pod satom, u jednom retku, i „Postavke” po imenu", () => {
  const html = nacrtaj({ prosirena: true });
  assert.match(html, /class="contents"/);
  assert.doesNotMatch(html, /hidden sm:contents/);
  const sat = html.indexOf("14:00", html.indexOf('class="contents"'));
  const izvor = html.indexOf("izmjeren 14:20 (prije 5 min), Vrboran");
  const naslov = html.indexOf("Nema naznaka mirisa", izvor);
  assert.ok(sat > 0 && izvor > sat && naslov > izvor, "sat → izvor → naslov");
  assert.match(html, /0,7 m\/s/);
  assert.match(html, />Postavke</);
  assert.match(html, /<button[^>]*aria-expanded="true"[^>]*aria-label="Manje o ovom satu"/);
});

test("na telefonu legenda ne troši redak, a pilula za dojavu je kratka s punom rečenicom za čitač", () => {
  const html = nacrtaj({ prosirena: true });
  assert.match(html, /aria-label="Legenda boja"/);
  assert.match(html, /class="hidden [^"]*sm:flex"[^>]*>\s*<span>sloj/);
  assert.match(html, />Javi miris</);
  assert.match(html, /aria-label="Osjećate miris\? Javite ga za ovaj sat"/);
  assert.match(html, /href="\/karepovac\/dojava\?sat=2026-09-05T12%3A00%3A00\.000Z"/);
});

test("uz otvorenu karticu mjesta ili postaje ostaje samo skupljeni blok, bez strelice za širenje", () => {
  const html = nacrtaj({ sazeta: true, prosirena: true });
  assert.match(html, /class="hidden sm:contents"/);
  assert.doesNotMatch(html, /Više o ovom satu/);
});

test("kad osvježavanje ne uspije, obavijest je gumb za novi pokušaj, a i skupljena kartica kaže da su podaci stari", () => {
  const stara = "2026-09-05T08:00:00.000Z";
  const html = nacrtaj({ crtaSada: stara, osvjezavanje: "greska", prosirena: true });
  assert.match(html, /<button[^>]*>podaci od 10:00, prije 4 h — osvježavanje nije uspjelo · <span[^>]*>pokušaj opet<\/span><\/button>/);
  assert.doesNotMatch(nacrtaj({ crtaSada: stara, osvjezavanje: "u tijeku", prosirena: true }), /pokušaj opet/);
  assert.match(tekst(nacrtaj({ crtaSada: stara, osvjezavanje: "u tijeku" })), /podaci od 10:00, prije 4 h — osvježavam…/);
});
