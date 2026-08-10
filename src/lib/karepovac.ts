export const KAREPOVAC_NAV = [
  { href: "/karepovac", label: "Pregled" },
  { href: "/karepovac/ukljuci-se", label: "Uključi se" },
  { href: "/karepovac/metodologija", label: "Kako mjerimo" },
  { href: "/karepovac/podaci", label: "Podaci" },
  { href: "/karepovac/financije", label: "Financije" },
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
    label: "Izmjereno na postaji građanske mreže",
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
    title: "Dogovor i izvedivost",
    description:
      "Potvrditi odgovornu organizaciju, proračun, privatnost domaćina i mogućnost usporednog umjeravanja.",
  },
  {
    status: "Sljedeće",
    title: "Nabava i test na stolu",
    description:
      "Sastaviti najmanje tri jednaka H₂S čvora i provjeriti šum, pomak, vezu, napajanje i kućište.",
  },
  {
    status: "Prije objave",
    title: "Usporedba i umjeravanje",
    description:
      "Postaje rade zajedno uz prikladan referentni instrument; tek izvještaj odlučuje što smijemo tvrditi.",
  },
  {
    status: "Pilot",
    title: "Mreža u vrtovima i na balkonima",
    description:
      "Odabrane lokacije prolaze 30 dana provjere dostupnosti, održavanja i zaštite privatnosti.",
  },
  {
    status: "Cilj",
    title: "Javna mjerenja",
    description:
      "Objaviti provjerena mjerenja, stanje postaja, otvorene podatke i odvojenu procjenu smjera prema vjetru.",
  },
] as const;

export const KAREPOVAC_BUDGET_CATEGORIES = [
  { id: "sensors", label: "H₂S i odabrani senzorski moduli", amount: null },
  { id: "controllers", label: "Upravljači i komunikacija", amount: null },
  { id: "enclosures", label: "Kućišta i nosači otporni na vrijeme", amount: null },
  { id: "power", label: "Napajanje i solarna oprema", amount: null },
  { id: "calibration", label: "Umjeravanje i referentni rad", amount: null },
  { id: "connectivity", label: "Povezivost i hosting", amount: null },
  { id: "maintenance", label: "Zamjenski senzori i održavanje", amount: null },
  { id: "contingency", label: "Pričuva za nepredviđeno", amount: null },
] as const;
