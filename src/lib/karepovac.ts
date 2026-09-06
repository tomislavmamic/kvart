export const KAREPOVAC_NAV = [
  { href: "/karepovac/zrak", label: "Pregled" },
  { href: "/karepovac/dojava", label: "Javi miris" },
  { href: "/karepovac/ukljuci-se", label: "Uključi se" },
  { href: "/karepovac/metodologija", label: "Kako mjerimo" },
  { href: "/karepovac/podaci", label: "Podaci" },
  { href: "/karepovac/financije", label: "Novac i troškovi" },
  { href: "/karepovac/postaje", label: "Postaje" },
] as const;

/**
 * Što projekt javno zna, a što ne.
 *
 * Dvije istine o novcu stoje jedna uz drugu i ne smiju se pomiješati: okvirna
 * cijena opreme POSTOJI (po stavci u popisu predloženih postaja,
 * `src/lib/sim/prijedlozi-postaja.ts`, zbrojena u `cijenaFaze`) — a cilj
 * prikupljanja, primatelj uplata i troškovi izvan opreme NE postoje. Stranica
 * o novcu mora reći oboje, jer tko je u simulatoru vidio „600–1.500 €” pa
 * ovdje pročita „iznos nije potvrđen”, zaključi da jedna od dviju stranica laže.
 *
 * Izvor se imenuje točno. Plan potječe iz GitHubova zahtjeva #28, ali #28
 * nosi samo grublje zbrojeve po fazama (A 3–6, B 1–2, C 2–10 tisuća €) za
 * kraći popis; popis je otad proširen (sjeveroistok, Žnjan, kampus) i cijene
 * po stavci žive u kodu, ne u #28. Pripisati brojke #28 značilo bi da tko
 * klikne izvor nađe druge brojke.
 */
export const KAREPOVAC_PUBLIC_STATE = {
  status: "U pripremi",
  hasLiveMeasurements: false,
  hasPublicStations: false,
  donationUrl: null,
  fundingGoal: null,
  amountRaised: null,
  /** Okvirna cijena opreme, bez montaže; nije cilj ni ponuda. */
  hasEquipmentEstimate: true,
  /** Odakle su brojke: popis predloženih postaja u kodu, izrastao iz plana u #28. */
  equipmentEstimateSource: "predložene postaje (proširen popis iz #28)",
  /**
   * Dan zadnje promjene stanja (ISO `YYYY-MM-DD`), upisan rukom kad se
   * nešto doista promijeni — voditelj, primatelj, otvaranje prijava.
   * Dok je `null`, obavijest o pripremi ne piše datum: izmišljen datum
   * gori je od nikakvog.
   */
  updatedOn: null as string | null,
} as const;

export const KAREPOVAC_DATA_KINDS = [
  {
    id: "community",
    label: "Izmjereno na našoj postaji",
  },
  {
    id: "official",
    label: "Službeno mjerenje",
  },
  {
    id: "estimated",
    label: "Procijenjeni smjer širenja prema vjetru",
  },
] as const;

export const KAREPOVAC_PHASES = [
  {
    status: "Sada",
    title: "Dogovor o projektu",
    description:
      "Odredit ćemo tko vodi projekt i tko smije primati donacije. Dogovorit ćemo kako čuvamo podatke stanovnika i možemo li senzore usporediti s pouzdanim mjerenjem.",
  },
  {
    status: "Sljedeće",
    title: "Nabava i početna provjera",
    description:
      "Sastavit ćemo najmanje tri jednaka mjerna uređaja. Prije postavljanja provjerit ćemo rade li stabilno, šalju li podatke i štite li ih kućišta od vremenskih uvjeta.",
  },
  {
    status: "Prije objave",
    title: "Usporedba i umjeravanje",
    description:
      "Uređaji će neko vrijeme raditi jedni uz druge i uspoređivat ćemo ih s pouzdanim mjerenjem. Tek tada ćemo znati koje vrijednosti smijemo objaviti.",
  },
  {
    status: "Pokusni rad",
    title: "Pokusni rad u kvartu",
    description:
      "Postavit ćemo uređaje na odabrana mjesta i 30 dana pratiti rade li redovito, možemo li ih održavati i jesu li podaci stanovnika zaštićeni.",
  },
  {
    status: "Cilj",
    title: "Objava mjerenja",
    description:
      "Objavit ćemo provjerena mjerenja, stanje svake postaje i podatke za preuzimanje. Procjenu smjera širenja prema vjetru prikazat ćemo odvojeno.",
  },
] as const;

/**
 * Skupine troška i što o svakoj znamo.
 *
 * `amount` je POTVRĐENI iznos i ostaje `null` dok proračun ne bude odobren.
 * `estimate` kaže pokriva li skupinu okvirna cijena opreme iz popisa
 * predloženih postaja: senzori, zapisivači i napajanje jesu u popisu; kućišta
 * i nosači samo dijelom (jarbol i kućište senzora da, nosači i zaštita ne);
 * umjeravanje, veza, održavanje i pričuva nisu procijenjeni nigdje. Razlika
 * između „okvirno” i „nije procijenjeno” je ono što stranica o novcu mora reći.
 */
export const KAREPOVAC_BUDGET_CATEGORIES = [
  { id: "sensors", label: "Senzori za H₂S i druga odabrana mjerenja", amount: null, estimate: "popis-postaja" },
  { id: "controllers", label: "Upravljačka elektronika i prijenos podataka", amount: null, estimate: "popis-postaja" },
  { id: "enclosures", label: "Kućišta i nosači otporni na vrijeme", amount: null, estimate: "djelomicno" },
  { id: "power", label: "Napajanje i solarna oprema", amount: null, estimate: "popis-postaja" },
  { id: "calibration", label: "Umjeravanje i referentni rad", amount: null, estimate: null },
  { id: "connectivity", label: "Veza s postajama i rad mrežne stranice", amount: null, estimate: null },
  { id: "maintenance", label: "Zamjenski senzori i održavanje", amount: null, estimate: null },
  { id: "contingency", label: "Pričuva za nepredviđeno", amount: null, estimate: null },
] as const;

export type BudgetEstimate = (typeof KAREPOVAC_BUDGET_CATEGORIES)[number]["estimate"];

/** Rečenica uz skupinu troška; puna, na 1 rem, jer nosi značenje stranice. */
export const BUDGET_ESTIMATE_LABEL: Record<NonNullable<BudgetEstimate> | "nije", string> = {
  "popis-postaja": "Okvirno u popisu predloženih postaja — vidi cijenu opreme gore.",
  djelomicno: "Djelomično u popisu predloženih postaja: jarbol i kućište senzora da, nosači i zaštita ne.",
  nije: "Nije procijenjeno.",
};
