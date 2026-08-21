/**
 * Riječi kojima se opisuje trenutačno stanje zraka nad kvartom.
 *
 * Odvojeno od dohvata i od modela jer je ovdje jedino pravilo koje se tiče
 * povjerenja: prikaz smije reći **kamo** zrak s plohe ide, a ne koliko mirisa
 * nosi. Zato ovdje nema ni jedne riječi o jačini, granici ni opasnosti.
 *
 * Vjetrovi se zovu domaćim imenima jer ih tako i zovu ljudi koji javljaju
 * miris; puni smjer u stupnjevima ostaje uz ime, da se dade provjeriti.
 */

import { OKVIR } from "@/generated/karepovac-karta";
import { POSTAJE, type Vjetar, type ZrakSada } from "@/lib/vjetar";

/** Domaća imena po smjeru iz kojega puše. */
const IMENA = [
  "tramontana",
  "bura",
  "levant",
  "jugo",
  "oštro",
  "lebić",
  "pulenat",
  "maestral",
] as const;

/** Koliko smjer smije odstupati da bi zrak još išao na kvart. */
const RASPON = 45;

/**
 * Granice skretanja struje oko reljefa, u stupnjevima.
 *
 * Nisu odabrane po osjećaju nego po tome što model daje: pri dubokom sloju
 * (600 m) medijan skretanja je 0,6°, pri 260 m je 1,3°, pri 120 m 2,9°, pri
 * 55 m 6,7°, a pri 25 m 9,2°. Prag od 3° tako dijeli duboke od srednjih, a
 * 7° srednje od plitkih.
 */
const SKRETANJE_OSJETNO = 3;
const SKRETANJE_JAKO = 7;

/**
 * Domaće ime vjetra koji puše iz zadanog smjera.
 *
 * Args:
 *   smjerOd: Meteorološki smjer iz kojega puše, u stupnjevima.
 *
 * Returns:
 *   Ime vjetra, npr. „levant”.
 */
export function imeVjetra(smjerOd: number): string {
  const k = Math.round((((smjerOd % 360) + 360) % 360) / 45) % 8;
  return IMENA[k];
}

/** Najmanji kut između dva smjera, u stupnjevima. */
function razlikaKuta(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Nosi li vjetar iz zadanog smjera zrak s plohe prema kvartu.
 *
 * Args:
 *   smjerOd: Meteorološki smjer iz kojega puše, u stupnjevima.
 *
 * Returns:
 *   Istina ako je os nošenja unutar `RASPON` stupnjeva od osi ploha → kvart.
 */
export function nosiPremaKvartu(smjerOd: number): boolean {
  return razlikaKuta((smjerOd + 180) % 360, OKVIR.azimut) <= RASPON;
}

/** Ispod ovoga se postaje smatraju složnima po smjeru. */
const SLOZAN_SMJER = 45;

/** Ispod ovoga se smatraju složnima po brzini. */
const SLOZNA_BRZINA = 2;

export type OpisZraka = {
  /** Kratka oznaka stanja za natpis na karti. */
  readonly natpis: string;
  /** Rečenica ispod karte. */
  readonly recenica: string;
  /** Stanje za bojanje i za čitač zaslona. */
  readonly stanje: "prema" | "mimo" | "stoji" | "nepoznato";
  /** Vrijeme na koje se prikaz odnosi, već napisano po naški. */
  readonly kada: string | null;
  /** Rečenica o neslaganju postaja; ništa kad se slažu ili kad je samo jedna. */
  readonly raspon: string | null;
  /** Ograda kad kartu vodi postaja koja se na arhivi nije pokazala. */
  readonly zadrska: string | null;
};

const sat = new Intl.DateTimeFormat("hr-HR", {
  timeZone: "Europe/Zagreb",
  hour: "2-digit",
  minute: "2-digit",
});

function napisiSat(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : sat.format(t);
}

/**
 * Opisuje koliko se postaje međusobno razilaze.
 *
 * Vjetar nad gradom nije jedan broj: zračna luka stoji na otvorenom uz more i
 * ljeti čita višestruko jače od postaja u gradu. Kad se razlika vidi, mora se
 * i napisati — inače karta izgleda sigurnija nego što mjerenja dopuštaju.
 *
 * Args:
 *   ocitanja: Sva očitanja iz istog kruga dohvata.
 *
 * Returns:
 *   Rečenica s očitanjima, ili ništa ako se postaje slažu.
 */
/** Postaje koje na provjeri arhive nisu pogodile noćne epizode. */
const SLABE = new Set(["aerodrom", "ldsp"]);

/**
 * Ograda kad kartu vodi postaja koja se na arhivi nije pokazala.
 *
 * Args:
 *   vjetar: Očitanje koje vodi kartu.
 *
 * Returns:
 *   Rečenica upozorenja, ili ništa.
 */
export function opisiSlabuPostaju(vjetar: Vjetar): string | null {
  if (!SLABE.has(vjetar.postaja)) return null;
  return (
    "Bliže postaje sada šute, pa kartu vodi zračna luka. Na dvije godine " +
    "mjerenja njezin vjetar noću nije pogađao epizode plina uz plohu — " +
    "uzmite ovaj prikaz s više zadrške nego inače."
  );
}

export function opisiRaspon(ocitanja: readonly Vjetar[]): string | null {
  const mjerodavna = ocitanja.filter((o) => !o.promjenjiv);
  if (mjerodavna.length < 2) return null;

  const brzine = mjerodavna.map((o) => o.brzina);
  const najmanja = Math.min(...brzine);
  const najveca = Math.max(...brzine);
  let razmakSmjera = 0;
  for (const a of mjerodavna) {
    for (const b of mjerodavna) {
      const d = Math.abs(((a.smjerOd - b.smjerOd + 540) % 360) - 180);
      if (d > razmakSmjera) razmakSmjera = d;
    }
  }

  const razilaze =
    razmakSmjera > SLOZAN_SMJER ||
    (najmanja >= 0.3 && najveca / najmanja >= SLOZNA_BRZINA);
  if (!razilaze) return null;

  const popis = mjerodavna
    .map(
      (o) =>
        `${POSTAJE[o.postaja].oznaka} ${Math.round(o.smjerOd)}° i ` +
        `${o.brzina.toFixed(1).replace(".", ",")} m/s`,
    )
    .join(", ");
  return `Postaje se u ovom satu ne slažu — ${popis}. Karta ide po najbližoj.`;
}

function metriUSloju(dubina: number): string {
  return dubina >= 1000 ? `${(dubina / 1000).toFixed(1)} km` : `${dubina} m`;
}

/**
 * Sastavlja natpis i rečenicu za trenutačno stanje.
 *
 * Args:
 *   zrak: Stanje iz `dohvatiZrak`.
 *
 * Returns:
 *   Riječi za prikaz; nikad ne tvrde koliko mirisa ima.
 */
/**
 * Opisuje koliko reljef skreće struju, riječima primjerenima brojci.
 *
 * Ovo je popravak tvrdnje koja je sama sebi proturječila. Kartica je pisala
 * „struja se ne penje uz padinu nego je obilazi” i uz to ispisivala izmjereno
 * skretanje — pa je pri dubokom sloju stajalo da struja obilazi padinu, a
 * odmah zatim da skreće 1°. Rečenica je bila napisana za jedan slučaj vremena
 * i nije se mijenjala kad je brojka postala živa.
 *
 * Args:
 *   skretanje: Medijan i najveće skretanje polja, u stupnjevima.
 *
 * Returns:
 *   Rečenicu koja stoji uz kartu strujnica.
 */
export function opisiSkretanje(skretanje: {
  readonly medijan: number;
  readonly najvece: number;
}): string {
  const brojke =
    `skreće ${skretanje.medijan}° u prosjeku, a nad padinama i do `
    + `${skretanje.najvece}°`;
  if (skretanje.medijan >= SKRETANJE_JAKO) {
    return `struja se ne penje uz padinu nego je obilazi, pa ${brojke}`;
  }
  if (skretanje.medijan >= SKRETANJE_OSJETNO) {
    return `reljef struju osjetno zavija, pa ${brojke}`;
  }
  return `reljef struju sada jedva zavija — ${brojke}`;
}

export function opisiZrak(zrak: ZrakSada): OpisZraka {
  const kada = napisiSat(zrak.vjetar?.opazeno);
  const sloj = metriUSloju(zrak.stanje.dubina);

  if (zrak.izvor === "pretpostavka" || !zrak.vjetar) {
    return {
      natpis: "pretpostavljeni slučaj",
      recenica:
        "Trenutačni vjetar sada ne možemo dohvatiti, pa prikaz stoji na " +
        "slučaju o kojem ljudi najčešće javljaju: slab jugoistočnjak pod " +
        "niskim poklopcem zraka.",
      stanje: "nepoznato",
      kada: null,
      raspon: null,
      zadrska: null,
    };
  }

  const { brzina, smjerOd, tisina, promjenjiv } = zrak.vjetar;
  const brzo = brzina.toFixed(1).replace(".", ",");
  const raspon = opisiRaspon(zrak.ocitanja);
  const zadrska = opisiSlabuPostaju(zrak.vjetar);

  if (tisina) {
    return {
      natpis: `tišina — ${brzo} m/s`,
      recenica:
        `Vjetra gotovo nema (${brzo} m/s), pa zrak s plohe ne odlazi nikamo ` +
        `nego se zadržava i polako širi. Sloj u kojem se miješa debeo je ${sloj}.`,
      stanje: "stoji",
      kada,
      raspon,
      zadrska,
    };
  }

  if (promjenjiv) {
    return {
      natpis: `promjenjiv — ${brzo} m/s`,
      recenica:
        `Postaja javlja promjenjiv smjer pri ${brzo} m/s, pa se ne može reći ` +
        `kamo zrak s plohe ide. Sloj u kojem se miješa debeo je ${sloj}.`,
      stanje: "nepoznato",
      kada,
      raspon,
      zadrska,
    };
  }

  const ime = imeVjetra(smjerOd);
  const prema = nosiPremaKvartu(smjerOd);
  return {
    natpis: `${ime} ${Math.round(smjerOd)}° — ${brzo} m/s`,
    recenica: prema
      ? `Puše ${ime} (${Math.round(smjerOd)}°, ${brzo} m/s), dakle s plohe ` +
        `prema kvartu. Sloj u kojem se zrak miješa debeo je ${sloj}: što je ` +
        `tanji, to se manje razrjeđuje.`
      : `Puše ${ime} (${Math.round(smjerOd)}°, ${brzo} m/s), dakle zrak s plohe ` +
        `ide mimo kvarta. Sloj u kojem se miješa debeo je ${sloj}.`,
    stanje: prema ? "prema" : "mimo",
    kada,
    raspon,
    zadrska,
  };
}
