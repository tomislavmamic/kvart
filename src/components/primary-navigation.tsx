import Link from "next/link";
import {
  PRIMARY_NAV_ITEMS,
  isNavigationItemActive,
  type SiteNavigationItem,
} from "@/lib/site-navigation";

type PrimaryNavigationProps = {
  variant: "hero" | "header" | "menu";
  pathname?: string;
  onNavigate?: () => void;
};

const NAV_CLASS = {
  // Crte među gumbima su razmak od 1 px kroz koji se vidi podloga; na
  // mobitelu su dva stupca, a peti gumb zauzima cijeli zadnji red.
  hero: "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/30 bg-kamen-tlo text-kamen-tinta shadow-lg md:grid-cols-5",
  header: "flex items-center gap-4 text-sm",
  menu: "flex flex-col gap-1 text-sm",
} as const;

export function PrimaryNavigation({
  variant,
  pathname = "",
  onNavigate,
}: PrimaryNavigationProps) {
  return (
    <nav aria-label="Glavni načini sudjelovanja" className={NAV_CLASS[variant]}>
      {PRIMARY_NAV_ITEMS.map((item, index) => (
        <NavigationItem
          key={item.id}
          item={item}
          variant={variant}
          active={isNavigationItemActive(pathname, item)}
          onNavigate={onNavigate}
          zadnjiNeparni={index === PRIMARY_NAV_ITEMS.length - 1 && PRIMARY_NAV_ITEMS.length % 2 === 1}
        />
      ))}
    </nav>
  );
}

function NavigationItem({
  item,
  variant,
  active,
  onNavigate,
  zadnjiNeparni,
}: {
  item: SiteNavigationItem;
  variant: PrimaryNavigationProps["variant"];
  active: boolean;
  onNavigate?: () => void;
  /** Zadnji gumb kad ih je neparan broj: na mobitelu zauzima cijeli red. */
  zadnjiNeparni: boolean;
}) {
  const className = navigationItemClass(variant, active, zadnjiNeparni);
  const content =
    variant === "hero" ? (
      <>
        <span className="font-bold">{item.label}</span>
        <span className="mt-0.5 text-sm text-kamen-drugi">{item.description}</span>
      </>
    ) : (
      <span className="whitespace-nowrap">{item.label}</span>
    );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function navigationItemClass(
  variant: PrimaryNavigationProps["variant"],
  active: boolean,
  zadnjiNeparni: boolean,
) {
  if (variant === "hero") {
    return `fokus meta flex min-h-20 flex-col justify-center bg-white px-4 py-3 transition-colors hover:bg-maslina-vez ${
      zadnjiNeparni ? "col-span-2 md:col-span-1" : ""
    }`;
  }

  if (variant === "menu") {
    return `fokus meta rounded-lg px-3 py-2.5 ${
      active
        ? "bg-kamen-plitko font-medium text-kamen-tinta"
        : "text-kamen-tekst hover:bg-kamen-plitko hover:text-kamen-tinta"
    }`;
  }

  return `fokus meta flex items-center px-1 py-2 ${
    active
      ? "font-medium text-kamen-tinta"
      : "text-kamen-drugi hover:text-kamen-tinta"
  }`;
}
