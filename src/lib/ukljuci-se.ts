/**
 * Ponuda pomoći za mjerne postaje: što se nudi, za koju postaju i kako se javiti.
 *
 * Prijave i donacije nisu otvorene (`KAREPOVAC_PUBLIC_STATE`), a namjera se
 * svejedno može zabilježiti danas — bez uplate, bez obveze i bez primatelja.
 * Ovdje je čista logika koju obrazac, poslužiteljska radnja i stranice dijele;
 * nema baze ni pristupa zaglavljima, pa se sve dade provjeriti testom.
 *
 * Popis postaja (`PRIJEDLOZI_POSTAJA`) ovdje se NE uvozi: modul čita samo
 * oblik zapisa (tip), a same podatke dobiva od pozivatelja. Tako obrazac u
 * pregledniku ne nosi popis koji mu ne treba, a stranica koja popis ima može
 * provjeriti isto pravilo kao i poslužitelj.
 */
import type { PrijedlogPostaje } from "@/lib/sim/prijedlozi-postaja";

/**
 * Tri vrste pomoći, onim redom kojim ih stranica nudi.
 *
 * Mjesto je prvo jer ga je najteže naći, a devet od trinaest predloženih
 * postaja bez njega ne postoji. Novac je zadnji, jer za njega još nema ni
 * primatelja: stavka bilježi namjeru, ne obećanje.
 */
export const VRSTE_POMOCI = [
  {
    id: "mjesto",
    natpis: "Mjesto za postaju",
    opis: "vrt, balkon ili krov, sa strujom iz kuće",
  },
  {
    id: "znanje",
    natpis: "Znanje ili ruke",
    opis: "elektronika, montaža, održavanje, obrada podataka",
  },
  {
    id: "novac",
    natpis: "Novac kad se donacije otvore",
    opis: "okvirno, bez ikakve obveze",
  },
] as const;

export type VrstaPomoci = (typeof VRSTE_POMOCI)[number]["id"];

const POZNATE_VRSTE: ReadonlySet<string> = new Set(VRSTE_POMOCI.map((v) => v.id));

/**
 * Ograda na učestalost ponuda: vlastiti spremnik, da se ne broji zajedno s
 * prijavama problema — susjedi iza istog CGNAT-a dijele adresu, i peta
 * tuđa prijava ne smije šestom susjedu zatvoriti obrazac za pomoć.
 */
export const OGRADA_PONUDE = { bucket: "ponuda", max: 5 } as const;

/** Najdulji dopušteni unos po polju; poslužitelj i obrazac drže isto. */
export const NAJDULJE = {
  podrucje: 120,
  kontakt: 200,
  poruka: 2000,
} as const;

/** Što faza znači, riječima iz `prijedlozi-postaja.ts`: A prvo, B zatim, C po potrebi. */
export const NAZIV_FAZE: Record<PrijedlogPostaje["faza"], string> = {
  A: "faza A — prvo",
  B: "faza B — zatim",
  C: "faza C — po potrebi",
};

export const FAZE = ["A", "B", "C"] as const;

/**
 * Traži li postaja dvorište ili balkon stanovnika, a ne dozvolu ustanove.
 *
 * Čita se iz `uvjeti`, jer to polje već kaže tko treba pristati: „dvorište ili
 * balkon stanovnika” je poziv susjedu, a „dozvola upravitelja plohe” ili
 * „dogovor sa Zavodom” nije nešto što stanovnik može ponuditi. Pravilo je
 * ovdje, a ne u popisu, da popis ostane opis terena, a ne obrazac.
 */
export function trebaStanovnika(p: Pick<PrijedlogPostaje, "uvjeti">): boolean {
  return /dvorište|balkon/i.test(p.uvjeti);
}

/** „600–1.500 €” — hrvatska tisućica, crtica bez razmaka, kao na kartici u simulatoru. */
export function eur(od: number, do_: number): string {
  const f = (n: number) => n.toLocaleString("hr-HR");
  return `${f(od)}–${f(do_)} €`;
}

/** Sirovi unos iz obrasca, prije ikakve provjere. */
export type PonudaUnos = {
  readonly vrste: readonly string[];
  readonly postaja: string;
  readonly podrucje: string;
  readonly kontakt: string;
  readonly poruka: string;
};

/** Provjerena ponuda, spremna za zapis. */
export type Ponuda = {
  readonly vrste: readonly VrstaPomoci[];
  readonly postaja: string | null;
  readonly podrucje: string | null;
  readonly kontakt: string | null;
  readonly poruka: string | null;
};

export type ProvjeraPonude =
  | { readonly ok: true; readonly ponuda: Ponuda }
  | { readonly ok: false; readonly error: string };

/**
 * Provjera ponude, ista u pregledniku i na poslužitelju.
 *
 * Poslužitelj je ponavlja jer sve što stigne prolazi kroz preglednik: vrsta
 * pomoći mora biti s popisa, postaja mora postojati, a duljine su ograničene
 * da se kontakt ne pretvori u pismo. Sve što nije obvezno prazno je `null`,
 * ne prazan niz — tako i baza kaže „nije rečeno”, a ne „rečeno je ništa”.
 */
export function provjeriPonudu(
  unos: PonudaUnos,
  poznatePostaje: ReadonlySet<string>,
): ProvjeraPonude {
  const vrste = [...new Set(unos.vrste.map((v) => v.trim()))];
  if (vrste.length === 0) {
    return { ok: false, error: "Označite barem jedno: mjesto, znanje ili novac." };
  }
  if (!vrste.every((v) => POZNATE_VRSTE.has(v))) {
    return { ok: false, error: "Vrsta pomoći nije s popisa." };
  }

  const postaja = unos.postaja.trim();
  if (postaja && !poznatePostaje.has(postaja)) {
    return { ok: false, error: "Odaberite postaju s popisa ili ostavite prazno." };
  }

  const podrucje = unos.podrucje.trim();
  if (podrucje.length > NAJDULJE.podrucje) {
    return {
      ok: false,
      error: `Ulica ili dio naselja stane u ${NAJDULJE.podrucje} znakova.`,
    };
  }
  const kontakt = unos.kontakt.trim();
  if (kontakt.length > NAJDULJE.kontakt) {
    return { ok: false, error: `Kontakt stane u ${NAJDULJE.kontakt} znakova.` };
  }
  const poruka = unos.poruka.trim();
  if (poruka.length > NAJDULJE.poruka) {
    return { ok: false, error: `Poruka stane u ${NAJDULJE.poruka} znakova.` };
  }

  return {
    ok: true,
    ponuda: {
      vrste: vrste as VrstaPomoci[],
      postaja: postaja || null,
      podrucje: podrucje || null,
      kontakt: kontakt || null,
      poruka: poruka || null,
    },
  };
}
