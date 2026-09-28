export type SiteNavigationItem = {
  id: "razgovor" | "karta" | "planovi" | "karepovac" | "problemi";
  href: string;
  label: string;
  description: string;
  external?: boolean;
  activePrefixes: readonly string[];
};

export type SecondaryNavigationItem = {
  href: string;
  label: string;
};

export function resolveWhatsAppUrl(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.includes("REPLACE")) return null;

  try {
    const url = new URL(candidate);
    if (url.hostname !== "chat.whatsapp.com") return null;
    return url.pathname.replace(/\/+$/, "").length > 1 ? candidate : null;
  } catch {
    return null;
  }
}

export const WHATSAPP_URL = resolveWhatsAppUrl(
  process.env.NEXT_PUBLIC_WHATSAPP_URL,
);

export const PRIMARY_NAV_ITEMS: readonly SiteNavigationItem[] = [
  {
    id: "razgovor",
    href: WHATSAPP_URL ?? "/o-inicijativi",
    label: "Razgovor",
    description: WHATSAPP_URL ? "WhatsApp grupa" : "Kako se uključiti",
    external: Boolean(WHATSAPP_URL),
    activePrefixes: [],
  },
  {
    id: "karta",
    href: "/karta",
    label: "Karta",
    description: "Istraži kvart",
    activePrefixes: ["/karta"],
  },
  {
    id: "planovi",
    // Ulaz u sve stranice o GUP-u: plan na snazi, prijedlog izmjena i
    // analize. One same žive pod /gup i /plan, pa i tamo ostaje aktivna.
    href: "/planovi",
    label: "Planovi",
    description: "Što se smije graditi",
    activePrefixes: ["/planovi", "/gup", "/plan"],
  },
  {
    id: "karepovac",
    // Vodi na simulator, a ne na pregled: tko klikne „Karepovac” prvo pita
    // kamo miris ide sada, a tek onda što sve pratimo. S njega se u pregled
    // ulazi poveznicom u kutu.
    href: "/karepovac/sim",
    label: "Karepovac",
    description: "Kamo miris ide sada",
    activePrefixes: ["/karepovac"],
  },
  {
    id: "problemi",
    href: "/prijedlozi",
    label: "Problemi",
    description: "Prijavi ili pregledaj",
    activePrefixes: ["/prijedlozi", "/prijavi"],
  },
];

export const SECONDARY_NAV_ITEMS: readonly SecondaryNavigationItem[] = [
  { href: "/dokumenti", label: "Dokumenti" },
  { href: "/podaci", label: "Prostorni podaci" },
  { href: "/o-inicijativi", label: "O inicijativi" },
];

export function isNavigationItemActive(
  pathname: string,
  item: Pick<SiteNavigationItem, "activePrefixes">,
): boolean {
  return item.activePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
