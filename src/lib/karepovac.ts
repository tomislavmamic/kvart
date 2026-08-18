export const KAREPOVAC_NAV = [
  { href: "/karepovac/zrak", label: "Pregled" },
  { href: "/karepovac/dojava", label: "Javi miris" },
  { href: "/karepovac/ukljuci-se", label: "Uključi se" },
  { href: "/karepovac/metodologija", label: "Kako mjerimo" },
  { href: "/karepovac/podaci", label: "Podaci" },
  { href: "/karepovac/financije", label: "Novac i troškovi" },
  { href: "/karepovac/postaje", label: "Postaje" },
] as const;

export const KAREPOVAC_PUBLIC_STATE = {
  status: "U pripremi",
  hasLiveMeasurements: false,
  hasPublicStations: false,
  donationUrl: null,
  fundingGoal: null,
  amountRaised: null,
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

export const KAREPOVAC_BUDGET_CATEGORIES = [
  { id: "sensors", label: "Senzori za H₂S i druga odabrana mjerenja", amount: null },
  { id: "controllers", label: "Upravljačka elektronika i prijenos podataka", amount: null },
  { id: "enclosures", label: "Kućišta i nosači otporni na vrijeme", amount: null },
  { id: "power", label: "Napajanje i solarna oprema", amount: null },
  { id: "calibration", label: "Umjeravanje i referentni rad", amount: null },
  { id: "connectivity", label: "Veza s postajama i rad mrežne stranice", amount: null },
  { id: "maintenance", label: "Zamjenski senzori i održavanje", amount: null },
  { id: "contingency", label: "Pričuva za nepredviđeno", amount: null },
] as const;
