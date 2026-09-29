import type { Category, Neighborhood } from "@/lib/constants";

export const FEATURED_PROPOSALS = [
  {
    slug: "pracenje-zagadenja-zraka",
    title: "Praćenje zagađenja zraka",
    description: "Mjerne postaje u kvartu, dojave mirisa i javno dostupni podaci. Povezujemo mjerenja s vjetrom kako bismo bolje razumjeli utjecaj Karepovca.",
    category: "ostalo" as Category,
    neighborhoods: ["dracevac", "bilice"] as Neighborhood[],
    subject: "Zrak i okoliš",
    detail: "Postaje · mjerenja · sudjelovanje",
    image: "/karepovac/kvart-prosjek.png",
    imageAlt: "Model raspršenja zraka s Karepovca nad Dračevcem i Bilicama",
    visualNote: "Animirani model raspršenja · procjena, ne mjerenje",
  },
  {
    slug: "uredenje-rekreativne-zone-dracevac",
    title: "Uređenje rekreativne zone Dračevac",
    description: "Dječja terasa, cageball i teretana u zelenilu. Čuvamo postojeća stabla i dodajemo velike krošnje za više hlada.",
    category: "zelenilo" as Category,
    neighborhoods: ["dracevac"] as Neighborhood[],
    subject: "Rekreacija i zelenilo",
    detail: "≈ 2.238 m² · tri terase za igru i sport",
    image: "/prijedlozi/rekreacija-render-hlad.png",
    imageAlt: "Prijedlog rekreativne zone na tri visinske razine s cageballom i teretanom",
    visualNote: "Idejni prikaz · otvorite 3D plan parka",
  },
  {
    slug: "uredenje-nogostupa",
    title: "Uređenje nogostupa",
    description: "Gušći drvored za više hlada, povezani nogostupi i očuvana postojeća sadnja. Razgledajte novi raspored u 3D prikazu.",
    category: "ceste" as Category,
    neighborhoods: ["dracevac"] as Neighborhood[],
    subject: "Pješaci i drvored",
    detail: "490 m ceste · 46 mjesta za sadnju · više hlada",
    image: "/prijedlozi/nogostupi-render-hlad.png",
    imageAlt: "Nogostupi u hladu razvijenih krošnji uz postojeće zgrade Dračevca",
    visualNote: "Idejni prikaz · gušći drvored i razvijene krošnje",
  },
  {
    slug: "pristupna-cesta-bilice",
    title: "Pristupna cesta za Bilice",
    description: "Provjera spoja Bilica kroz radnu zonu uz korištenje postojećih cesta i očuvanje zgrada. Razrađena etapa u 3D prikazu, usporedba alternativa i neriješeni izlaz na glavnu cestu.",
    category: "ceste" as Category,
    neighborhoods: ["bilice", "dracevac"] as Neighborhood[],
    subject: "Promet i pristup",
    detail: "DPU radne zone · usporedba trasa · 3D prikaz",
    image: "/prijedlozi/bilice-trasa.svg",
    imageAlt: "Karta kandidata cestovne veze Bilica: nova etapa i postojeći nastavak, izlaz na D1 nije potvrđen",
    visualNote: "Ista geometrija kao u 3D prikazu · kandidat za provjeru",
  },
  {
    slug: "skolski-autobus-bilice-dracevac",
    title: "Školski autobus za Bilice i Dračevac",
    description: "Dračevac: prilaz iz radne zone do R1 ili stajalište uz sjeverni rub rotora. Bilice: uključiti stajalište uz novi ulaz koji je već prikazan u DPU-u.",
    category: "ceste" as Category,
    neighborhoods: ["bilice", "dracevac"] as Neighborhood[],
    subject: "Djeca i javni prijevoz",
    detail: "R1 ili sjeverni rub · Bilice uz planski ulaz",
    image: "/prijedlozi/skolski-autobus.svg",
    imageAlt: "R1 i sjeverni rub rotora kao dvije mogućnosti za Dračevac te stajalište uz planski ulaz u Bilice",
    visualNote: "DPU i novi prijedlozi stajališta · R1 s prilazom iz radne zone",
  },
] as const;

export type FeaturedProposal = (typeof FEATURED_PROPOSALS)[number];

export function getFeaturedProposal(slug: string) {
  return FEATURED_PROPOSALS.find((proposal) => proposal.slug === slug);
}
